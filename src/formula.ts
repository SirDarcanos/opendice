// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

/**
 * The formula grammar, parsed into a structured form `roll()` evaluates.
 *
 *   NdM              standard             2d6
 *   NdM+K / NdM-K    modifier             1d20+7, 10-1d4
 *   Nd20adv/Nd20dis  advantage/disadv     2d20adv — roll N, keep highest/lowest
 *   NdMkhX / NdMklX  keep highest/lowest  4d6kh3 — a blank X keeps 1
 *   NdM!             exploding            1d6! — a top face rolls again and adds
 *   NdM!p            penetrating          1d6!p — as `!`, but each extra roll counts 1 less
 *   NdMxK            group multiplier     1d6x10 — this group's total, times K
 *   +1d4             additive sub-roll    1d8+1d4+3
 *   " fire"          trailing tag         metadata, never math
 *
 * The trailing tag is whatever the caller says it is — a category here, a colour there —
 * so the parser knows a formula *can* carry one and nothing about which are real: pass
 * the set you recognise as `tags`. Without it a trailing word is a parse error like any
 * other stray token, so a typo is never silently swallowed as a tag.
 */

import { MAX_SIDES } from './rng.ts'

export type AdvantageState = 'normal' | 'advantage' | 'disadvantage'

/** Longest formula accepted. A formula this long is generated, not typed. */
const MAX_FORMULA_LENGTH = 1000

/**
 * Most dice one roll may ask for, counting every term. Rolling is one draw per die, so
 * without a ceiling `99999999d6` is a request to hang the process — and a formula is
 * exactly the kind of thing that arrives from somewhere untrusted.
 */
export const MAX_DICE = 1000

/**
 * How many times one die may explode, so `results` can hold this many rolls plus the
 * first. Lives here with the other limits; `roll()` enforces it.
 */
export const MAX_EXPLOSIONS = 100

/** Characters a formula can legitimately contain; everything else is not one. */
const FORMULA_CHARACTERS = /[^a-z0-9+\-! ]/gi

/** The first character of a formula that is not one of those, if there is one. */
const FORBIDDEN_CHARACTER = /[^a-z0-9+\-! ]/i

export interface DiceTerm {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
  /** Keep the highest/lowest N rolled dice. */
  keep?: { mode: 'kh' | 'kl'; n: number }
  /** adv/dis sugar, recorded so the roll result can report it. */
  advantage?: 'advantage' | 'disadvantage'
  /** Every die landing on its top face is rolled again and added. */
  explode?: true
  /**
   * Penetrating: every roll after the first counts 1 less. Set alongside `explode`, since
   * a penetrating die is an exploding one — what changes is what each extra roll is worth,
   * not when the next one happens.
   */
  penetrate?: true
  /** Multiply this group's total by a whole number. Binds to the group, never the sum. */
  multiplier?: number
}

export interface FlatTerm {
  kind: 'flat'
  value: number
}

export type Term = DiceTerm | FlatTerm

export interface Formula {
  source: string
  terms: Term[]
  /** The trailing tag, when the formula carried one the caller recognises. */
  tag?: string
}

export interface ParseOptions {
  /**
   * Trailing words to accept as a tag, lowercased. Anything else at the end of a
   * formula is a parse error — which is the point: an unrecognised word is far more
   * often a typo than a tag, and swallowing it would hide the mistake.
   *
   * `& object` rules out a bare string, which is an iterable of single letters: passing
   * `'fire'` rather than `['fire']` would otherwise quietly accept `f`, `i`, `r` and `e`.
   */
  tags?: Iterable<string> & object
}

/**
 * A copy holding only its own properties. Every optional field here is read by asking
 * whether it is there, and a plain `{}` inherits from `Object.prototype` — so anything
 * that can pollute that prototype could otherwise forge a keep rule, a tag, or the
 * random source itself, and the roll log would report the forgery as fact.
 */
export function ownProperties<T extends object>(source: T): T {
  return Object.assign(Object.create(null), source) as T
}

/**
 * A short, inert excerpt of input to quote in an error. Errors are the one place raw
 * input travels back out, and a caller showing one on a page would otherwise be pasting
 * whatever was typed straight into it. A formula cannot contain anything replaced here,
 * so nothing a real one would say is lost.
 */
function excerpt(text: string): string {
  const inert = text.replace(FORMULA_CHARACTERS, '?')
  return inert.length > 40 ? `${inert.slice(0, 40)}…` : inert
}

/** The largest total these terms could reach, for checking every total stays exact. */
function largestTotal(terms: Term[]): number {
  return terms.reduce((sum, t) => {
    if (t.kind === 'flat') return sum + Math.abs(t.value)
    return sum + t.count * t.sides * (t.explode ? MAX_EXPLOSIONS + 1 : 1) * (t.multiplier ?? 1)
  }, 0)
}

/** Throw unless these terms can be rolled: some dice, few enough of them, an exact total. */
export function assertRollable(terms: Term[]): void {
  const count = terms.reduce((n, t) => (t.kind === 'dice' ? n + t.count : n), 0)
  // `2+5` is arithmetic, and `0d6` is a die nobody rolls. Either would report a total
  // with an empty `dice` to back it up, which is not this library answering.
  if (count < 1) {
    throw new Error('A dice formula must roll at least one die, but this one rolls none')
  }
  if (count > MAX_DICE) {
    throw new Error(`A roll may use at most ${MAX_DICE} dice, but this one asks for ${count}`)
  }
  // Past 2^53 JavaScript starts rounding, so a total would be quietly wrong rather than
  // large. Dice alone cannot reach it; a written-out number can.
  if (!Number.isSafeInteger(largestTotal(terms))) {
    throw new Error(
      `A roll may not reach a total above ${Number.MAX_SAFE_INTEGER}, where whole numbers stop being exact`,
    )
  }
}

/**
 * Which suffixes have already warned that a count of 1 is being read as 2.
 *
 * Keyed by the suffix, so it holds two entries at the most. Keyed by the formula it would
 * be a set filled from untrusted input — `1d20adv`, `01d20adv`, `001d20adv` and so on all
 * parse to the same roll and would each add a line to it.
 */
const warnedSuffixes = new Set<string>()

/** Forget which warnings have been given. For tests; not exported from the package. */
export function resetAdvantageWarnings(): void {
  warnedSuffixes.clear()
}

/**
 * Warn, once per suffix, that `1d20adv` rolls two dice. Once rather than per roll because
 * a warning on every roll of a long fight is a warning nobody reads, and because this is
 * a library writing to somebody else's console.
 *
 * The formula in the message is rebuilt from numbers the parser has already read, never
 * pasted from the caller's text — the same reason `excerpt` exists.
 */
function warnSingleDie(sides: number, suffix: 'adv' | 'dis'): void {
  if (warnedSuffixes.has(suffix)) return
  warnedSuffixes.add(suffix)
  console.warn(
    `opendice: "1d${sides}${suffix}" rolls 2 dice, not 1. "${suffix}" keeps one die out of ` +
      `several, so it needs at least two to choose between — write "2d${sides}${suffix}". ` +
      `A future version will refuse a count below 2.`,
  )
}

/** A DiceTerm from the parser's captures: blank count → 1; adv/dis keeps 1 of the count. */
function diceTerm(
  sign: 1 | -1,
  countStr: string,
  sidesStr: string,
  suffix: string | undefined,
  multiplierStr: string | undefined,
): DiceTerm {
  const sides = Number(sidesStr)
  if (sides < 1 || sides > MAX_SIDES) {
    throw new Error(`A die must have between 1 and ${MAX_SIDES} sides, but this one has ${sides}`)
  }
  const term: DiceTerm = {
    kind: 'dice',
    sign,
    count: countStr === '' ? 1 : Number(countStr),
    sides,
  }
  if (suffix === 'adv' || suffix === 'dis') {
    // adv/dis keeps one die out of the several rolled, and the count says how many are
    // thrown, so `4d20adv` keeps the best of four. One die has nothing to choose between,
    // so it is read as two and warned about rather than refused: `1d20adv` is what callers
    // have written since the suffix existed, and what they meant by it was never in doubt.
    //
    // A count of 0 is left alone for `assertRollable` to refuse as no dice at all. Reading
    // that as two would turn "roll nothing" into a roll.
    if (term.count === 1) {
      warnSingleDie(sides, suffix)
      term.count = 2
    }
    term.advantage = suffix === 'adv' ? 'advantage' : 'disadvantage'
    term.keep = { mode: suffix === 'adv' ? 'kh' : 'kl', n: 1 }
  } else if (suffix === '!' || suffix === '!p') {
    term.explode = true
    if (suffix === '!p') term.penetrate = true
  } else if (suffix) {
    // A blank count keeps one, the way a blank count in front of the `d` rolls one die.
    const written = suffix.slice(2)
    const n = written === '' ? 1 : Number(written)
    if (n < 1) {
      throw new Error(`A keep rule must keep at least one die, but "${suffix}" keeps none`)
    }
    term.keep = { mode: suffix.slice(0, 2) as 'kh' | 'kl', n }
  }
  if (multiplierStr) {
    const times = Number(multiplierStr.slice(1))
    if (times < 1) {
      throw new Error(
        `A multiplier must be at least 1, but "${multiplierStr}" would erase the dice`,
      )
    }
    term.multiplier = times
  }
  return term
}

/** Parse a dice formula into structured terms. Throws on malformed input. */
export function parseFormula(input: string, opts: ParseOptions = {}): Formula {
  if (typeof input !== 'string') {
    throw new Error(`A dice formula must be text, not ${typeof input}`)
  }
  const source = input.trim()
  if (source.length > MAX_FORMULA_LENGTH) {
    throw new Error(
      `Dice formula is too long: ${source.length} characters, the limit is ${MAX_FORMULA_LENGTH}`,
    )
  }
  // Only what a formula is written with. The parser strips whitespace before reading a
  // formula but `source` keeps it verbatim, so without this a tab, a newline or a
  // zero-width space rides through into `RollResult.formula` — and a newline there
  // forges a second line in whatever log or row the caller writes the roll to. The
  // Kelvin sign gets in the same way, by lowercasing to a plain `k`.
  const stray = FORBIDDEN_CHARACTER.exec(source)
  if (stray) {
    const point = stray[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
    throw new Error(
      `A dice formula may only contain letters, digits, spaces, "+", "-" and "!", but this one has U+${point}`,
    )
  }
  let expr = source.toLowerCase()
  const accepted = ownProperties(opts).tags
  if (typeof accepted === 'string') {
    throw new Error('Dice tags must be a list of words, not a single string')
  }
  const tags = accepted instanceof Set ? accepted : new Set(accepted ?? [])

  let tag: string | undefined
  // One space, not a run of them: `\s+` here backtracks quadratically over long padding,
  // and the run is stripped a few lines below anyway.
  const tagMatch = /\s([a-z]+)$/.exec(expr)
  if (tagMatch && tags.has(tagMatch[1])) {
    tag = tagMatch[1]
    expr = expr.slice(0, tagMatch.index)
  }
  expr = expr.replace(/\s+/g, '')
  if (expr === '') throw new Error(`Empty dice formula: "${excerpt(source)}"`)

  const terms: Term[] = []
  const re = /([+-]?)(?:(\d*)d(\d+)(adv|dis|kh\d*|kl\d*|!p?)?(x\d+)?|(\d+))/y
  let pos = 0
  while (pos < expr.length) {
    re.lastIndex = pos
    const m = re.exec(expr)
    if (!m || m.index !== pos) {
      throw new Error(`Cannot parse "${excerpt(source)}" near "${excerpt(expr.slice(pos))}"`)
    }
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1
    if (m[6] !== undefined) {
      terms.push({ kind: 'flat', value: sign * Number(m[6]) })
    } else {
      terms.push(diceTerm(sign, m[2], m[3], m[4], m[5]))
    }
    pos = re.lastIndex
  }

  assertRollable(terms)
  return ownProperties({
    source,
    terms: terms.map(ownProperties),
    ...(tag !== undefined ? { tag } : {}),
  })
}
