// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

import { cryptoRandom, rollDie, type RandomSource } from './rng.ts'
import {
  parseFormula,
  type AdvantageState,
  type DiceTerm,
  type FlatTerm,
  type Term,
} from './formula.ts'

/**
 * One chokepoint for every roll. Parse a formula, apply advantage and any extra
 * bonuses the caller has resolved, roll each term through the CSPRNG, and return
 * enough detail to render the result and to show your work.
 *
 * Deliberately not effect-aware: whatever decides that a roll has advantage, or that
 * Bless adds a d4, lives in the caller and hands the answer in through `RollContext`.
 * That keeps the randomness auditable on its own.
 */

export interface DieGroup {
  sides: number
  sign: 1 | -1
  /** Every die rolled, including those dropped by adv/dis/keep. */
  results: number[]
  /** The dice kept toward the total. */
  kept: number[]
  /** This group's signed contribution to the total. */
  total: number
  /**
   * The one die this group kept showed its highest face — `sides` on a `d{sides}`.
   * A fact about the die and nothing more: whether that matters is yours to decide.
   * False unless the group kept exactly one die, since a 20 among four dice is not
   * the result of anything on its own.
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
  /**
   * Each flat modifier on its own, in the order it was added — the creature's own
   * bonus first, then whatever the effects contributed. The breakdown reads them out
   * rather than the sum, so `+1 -6` says where a −5 came from.
   */
  modifiers: number[]
  total: number
  advantageState: AdvantageState
  /** The formula's trailing tag, when it carried one the caller recognises. */
  tag?: string
}

export interface RollContext {
  /** Force advantage/disadvantage on the first plain d20 term. Net it yourself. */
  advantage?: AdvantageState
  /** Extra additive terms folded in, e.g. Bless `'1d4'`; numbers or formula fragments. */
  bonuses?: (number | string)[]
  /** Injectable randomness for tests; defaults to the CSPRNG. */
  rand?: RandomSource
  /** Trailing words to accept as a tag — see `ParseOptions`. */
  tags?: Iterable<string>
}

/** Apply adv/dis to the first plain d20 term (roll two, keep highest/lowest). */
function applyAdvantage(terms: Term[], advantage: 'advantage' | 'disadvantage'): Term[] {
  let applied = false
  return terms.map((t) => {
    if (applied || t.kind !== 'dice' || t.sides !== 20 || t.keep || t.advantage) {
      return t
    }
    applied = true
    return {
      ...t,
      count: 2,
      keep: { mode: advantage === 'advantage' ? 'kh' : 'kl', n: 1 },
      advantage,
    }
  })
}

/** Turn extra bonuses (numbers or formula fragments) into additive terms. */
function bonusTerms(bonuses: (number | string)[]): Term[] {
  return bonuses.flatMap((b) =>
    typeof b === 'number' ? [{ kind: 'flat', value: b } satisfies FlatTerm] : parseFormula(b).terms,
  )
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
  for (let i = 0; i < term.count; i++) results.push(rollDie(term.sides, rand))
  const kept = keptDice(results, term.keep)
  const sum = kept.reduce((a, b) => a + b, 0)
  const sole = kept.length === 1 ? kept[0] : undefined
  return {
    sides: term.sides,
    sign: term.sign,
    results,
    kept,
    total: term.sign * sum,
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
  const rand = ctx.rand ?? cryptoRandom
  const parsed = parseFormula(formula, { tags: ctx.tags })
  let terms = parsed.terms
  if (ctx.advantage && ctx.advantage !== 'normal') {
    terms = applyAdvantage(terms, ctx.advantage)
  }
  if (ctx.bonuses && ctx.bonuses.length > 0) {
    terms = [...terms, ...bonusTerms(ctx.bonuses)]
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

  return {
    formula: parsed.source,
    dice,
    modifier,
    modifiers,
    total,
    advantageState,
    ...(parsed.tag !== undefined ? { tag: parsed.tag } : {}),
  }
}
