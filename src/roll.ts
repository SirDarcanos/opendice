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

export type RollKind = 'attack' | 'save' | 'check' | 'damage' | 'raw'

/**
 * How a critical hit inflates damage dice. Only plain damage dice are affected
 * (never attack rolls, never flat modifiers):
 * - `none`          — not a crit
 * - `double-dice`   — RAW: roll twice as many dice
 * - `double-total`  — roll once, then double the dice total
 * - `max-plus-roll` — add the dice maximum, then roll once (a common house rule)
 */
export type CritRule = 'none' | 'double-dice' | 'double-total' | 'max-plus-roll'

export interface DieGroup {
  sides: number
  sign: 1 | -1
  /** Every die rolled, including those dropped by adv/dis/keep. */
  results: number[]
  /** The dice kept toward the total. */
  kept: number[]
  /** This group's signed contribution to the total (after any crit rule). */
  total: number
}

export interface RollResult {
  formula: string
  kind: RollKind
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
  /** Natural 20 on a single d20. */
  crit: boolean
  /** Natural 1 on a single d20. */
  fumble: boolean
  advantageState: AdvantageState
  /** The formula's trailing tag, when it carried one the caller recognises. */
  tag?: string
}

export interface RollContext {
  rollerId?: string
  targetId?: string
  kind?: RollKind
  /** Crit handling for damage dice. `true` is shorthand for RAW `double-dice`. */
  crit?: boolean | CritRule
  /** Force advantage/disadvantage on the d20 (the effect layer resolves the net). */
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

/** Resolve the crit option to a rule: `true` → RAW double-dice, absent/false → none. */
function normalizeCrit(crit: boolean | CritRule | undefined): CritRule {
  if (crit === true) return 'double-dice'
  if (!crit) return 'none'
  return crit
}

/** Apply a keep rule: the n highest (kh) or lowest (kl) results; no rule keeps them all. */
function keptDice(results: number[], keep: DiceTerm['keep']): number[] {
  if (!keep) return results
  const desc = [...results].sort((a, b) => b - a)
  const n = Math.min(keep.n, results.length)
  return keep.mode === 'kh' ? desc.slice(0, n) : desc.slice(results.length - n)
}

/** Roll one dice term into its DieGroup: all results, the kept subset, the signed total. */
function rollGroup(term: DiceTerm, critRule: CritRule, rand: RandomSource): DieGroup {
  // Crit rules only apply to plain damage dice — never attack/keep/adv terms.
  const rule = term.keep || term.advantage ? 'none' : critRule
  const count = term.count * (rule === 'double-dice' ? 2 : 1)
  const results: number[] = []
  for (let i = 0; i < count; i++) results.push(rollDie(term.sides, rand))
  const kept = keptDice(results, term.keep)
  const sum = kept.reduce((a, b) => a + b, 0)

  let contribution: number
  switch (rule) {
    case 'double-total':
      contribution = sum * 2
      break
    case 'max-plus-roll':
      contribution = term.count * term.sides + sum
      break
    default: // 'none' and 'double-dice' (the extra dice are already rolled)
      contribution = sum
  }
  return { sides: term.sides, sign: term.sign, results, kept, total: term.sign * contribution }
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

/** The d20 group behind a roll, when there is exactly one — what the UI shows raw. */
export function d20Group(result: RollResult): DieGroup | undefined {
  const d20s = result.dice.filter((g) => g.sides === 20)
  return d20s.length === 1 ? d20s[0] : undefined
}

/** Crit/fumble are only meaningful for a single kept d20. */
function critFumble(dice: DieGroup[]): { crit: boolean; fumble: boolean } {
  const d20s = dice.filter((g) => g.sides === 20)
  if (d20s.length !== 1 || d20s[0].kept.length !== 1) {
    return { crit: false, fumble: false }
  }
  const value = d20s[0].kept[0]
  return { crit: value === 20, fumble: value === 1 }
}

/** Parse, apply adv/dis and bonuses, roll, and flag a natural 20 or 1 on an attack. */
export function roll(formula: string, ctx: RollContext = {}): RollResult {
  const rand = ctx.rand ?? cryptoRandom
  const critRule = normalizeCrit(ctx.crit)
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
    const group = rollGroup(term, critRule, rand)
    total += group.total
    dice.push(group)
  }

  // A natural 20 / 1 only crits or fumbles on an attack roll — saves and checks
  // (and damage) don't.
  const { crit, fumble } = ctx.kind === 'attack' ? critFumble(dice) : { crit: false, fumble: false }
  return {
    formula: parsed.source,
    kind: ctx.kind ?? 'raw',
    dice,
    modifier,
    modifiers,
    total,
    crit,
    fumble,
    advantageState,
    ...(parsed.tag !== undefined ? { tag: parsed.tag } : {}),
  }
}
