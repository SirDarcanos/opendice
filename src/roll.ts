// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

/**
 * One chokepoint for every roll: parse a formula, apply the advantage and bonuses the
 * caller has already resolved, roll each term through the CSPRNG, and return enough
 * detail to show the working rather than just the answer.
 *
 * What it never does is work out *whether* a roll should have advantage, or what an
 * extra die is for. Those answers arrive through `RollContext`, which is what keeps the
 * randomness auditable on its own.
 */

import { cryptoRandom, rollDie, type RandomSource } from './rng.ts'
import {
  MAX_EXPLOSIONS,
  assertRollable,
  ownProperties,
  parseFormula,
  type AdvantageState,
  type DiceTerm,
  type FlatTerm,
  type Term,
} from './formula.ts'

export interface DieGroup {
  sides: number
  sign: 1 | -1
  /** Every die rolled, including those dropped by adv/dis/keep. */
  results: number[]
  kept: number[]
  /**
   * What this group's kept dice were multiplied by, 1 unless the formula said otherwise.
   * Reported so `total` can be checked against `kept` rather than taken on trust.
   */
  multiplier: number
  /** This group's signed contribution to the total. */
  total: number
  /**
   * The one die this group kept showed its highest face. False unless exactly one die
   * was kept, since a top face among several is not the result of anything on its own.
   */
  naturalHigh: boolean
  /** The one die this group kept came up 1, on the same terms. */
  naturalLow: boolean
}

export interface RollResult {
  formula: string
  dice: DieGroup[]
  /** Sum of flat numeric modifiers (dice are not counted here). */
  modifier: number
  /** Each flat modifier separately, in order, so `+1 -6` can be shown rather than `-5`. */
  modifiers: number[]
  total: number
  advantageState: AdvantageState
  /** The formula's trailing tag, when it carried one the caller recognises. */
  tag?: string
}

export interface RollContext {
  /** Force advantage/disadvantage on the first plain d20 term. Net it yourself. */
  advantage?: AdvantageState
  /** Extra terms to add: plain numbers, or formula fragments like `'1d4'`. */
  bonuses?: (number | string)[]
  /**
   * Injectable randomness for tests; defaults to the CSPRNG. A result records what the
   * dice showed and never where the numbers came from, so a rigged source produces a
   * result identical to a fair one: pass only a source you trust, and never one a user
   * of your program can choose.
   */
  rand?: RandomSource
  /** Trailing words to accept as a tag — see `ParseOptions`. */
  tags?: Iterable<string> & object
}

/** Apply adv/dis to the first plain d20 term (roll two, keep highest/lowest). */
function applyAdvantage(terms: Term[], advantage: 'advantage' | 'disadvantage'): Term[] {
  let applied = false
  return terms.map((t) => {
    if (applied || t.kind !== 'dice' || t.sides !== 20 || t.keep || t.advantage) {
      return t
    }
    applied = true
    return ownProperties<DiceTerm>({
      ...t,
      count: 2,
      keep: { mode: advantage === 'advantage' ? 'kh' : 'kl', n: 1 },
      advantage,
    })
  })
}

/** Turn extra bonuses (numbers or formula fragments) into additive terms. */
function bonusTerms(bonuses: (number | string)[]): Term[] {
  return bonuses.flatMap((b) => {
    if (typeof b !== 'number') return parseFormula(b).terms
    // A formula can only say a whole number, and a bonus is the same arithmetic. NaN or
    // a fraction would otherwise pass straight through into the total.
    if (!Number.isSafeInteger(b)) {
      throw new Error(`A numeric bonus must be a whole number that stays exact, got ${b}`)
    }
    return [{ kind: 'flat', value: b } satisfies FlatTerm]
  })
}

/**
 * Roll one die, rolling again while it lands on its top face; returns the whole chain.
 * A die of fewer than two sides never explodes — every roll would be a top face.
 */
function explodeDie(sides: number, rand: RandomSource): number[] {
  const chain = [rollDie(sides, rand)]
  if (sides < 2) return chain
  while (chain[chain.length - 1] === sides && chain.length <= MAX_EXPLOSIONS) {
    chain.push(rollDie(sides, rand))
  }
  return chain
}

/** Apply a keep rule: the n highest (kh) or lowest (kl) results; no rule keeps them all. */
function keptDice(results: number[], keep: DiceTerm['keep']): number[] {
  if (!keep) return results
  const desc = [...results].sort((a, b) => b - a)
  const n = Math.min(keep.n, results.length)
  return keep.mode === 'kh' ? desc.slice(0, n) : desc.slice(results.length - n)
}

/** Roll one dice term into its DieGroup: all results, the kept subset, the signed total. */
function rollGroup(term: DiceTerm, rand: RandomSource): DieGroup {
  const results: number[] = []
  for (let i = 0; i < term.count; i++) {
    if (term.explode) results.push(...explodeDie(term.sides, rand))
    else results.push(rollDie(term.sides, rand))
  }
  const kept = keptDice(results, term.keep)
  const sum = kept.reduce((a, b) => a + b, 0)
  const multiplier = term.multiplier ?? 1
  const sole = kept.length === 1 ? kept[0] : undefined
  return {
    sides: term.sides,
    sign: term.sign,
    results,
    kept,
    multiplier,
    total: term.sign * sum * multiplier,
    naturalHigh: sole === term.sides,
    naturalLow: sole === 1,
  }
}

/**
 * Which of a group's dice counted, aligned to `results` so the UI can dim the ones
 * advantage or a keep rule dropped. Matched one for one, so a tie between two equal
 * dice drops exactly one of them.
 */
export function keptFlags(group: DieGroup): boolean[] {
  const pool = [...group.kept]
  return group.results.map((value) => {
    const i = pool.indexOf(value)
    if (i === -1) return false
    pool.splice(i, 1)
    return true
  })
}

/**
 * The one group of dice in a roll, when there is exactly one — the die to show large
 * while the modifiers sit beside it. Returns nothing rather than guessing when a roll
 * mixes several kinds of die, since which of them is "the" die is yours to know.
 */
export function soleDieGroup(result: RollResult): DieGroup | undefined {
  return result.dice.length === 1 ? result.dice[0] : undefined
}

/** Parse, apply adv/dis and bonuses, roll, and report what the dice did. */
export function roll(formula: string, ctx: RollContext = {}): RollResult {
  const options = ownProperties(ctx)
  const rand = options.rand ?? cryptoRandom
  const parsed = parseFormula(formula, { tags: options.tags })
  let terms = parsed.terms
  if (options.advantage && options.advantage !== 'normal') {
    terms = applyAdvantage(terms, options.advantage)
  }
  if (options.bonuses && options.bonuses.length > 0) {
    terms = [...terms, ...bonusTerms(options.bonuses)]
    assertRollable(terms)
  }

  const dice: DieGroup[] = []
  const modifiers: number[] = []
  let modifier = 0
  let total = 0
  let advantageState: AdvantageState = 'normal'

  for (const term of terms) {
    if (term.kind === 'flat') {
      modifiers.push(term.value)
      modifier += term.value
      total += term.value
      continue
    }
    if (term.advantage) advantageState = term.advantage
    const group = rollGroup(term, rand)
    total += group.total
    dice.push(group)
  }

  return ownProperties({
    formula: parsed.source,
    dice,
    modifier,
    modifiers,
    total,
    advantageState,
    ...(parsed.tag !== undefined ? { tag: parsed.tag } : {}),
  })
}
