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
 *   NdMminK/NdMmaxK  bound on each die    2d6min3 — a die under 3 counts as 3
 *   NdMtotalminK     bound on the sum     2d6totalmin3 — a sum under 3 counts as 3
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

/** Longest raw formula input accepted. A formula this long is generated, not typed. */
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

/** A `min`/`max` bound, with the `total` prefix that sets it against the sum instead. */
const BOUND_SUFFIX = /^(total)?(min|max)(\d+)$/

/** Most recognised tag entries one parse may inspect. */
const MAX_TAGS = 100

/** Characters a formula can legitimately contain; everything else is not one. */
const FORMULA_CHARACTERS = /[^a-z0-9+\-! ]/gi

/** The first character of a formula that is not one of those, if there is one. */
const FORBIDDEN_CHARACTER = /[^a-z0-9+\-! ]/i

/** The complete shape of a tag the formula grammar can produce. */
const TAG = /^[a-z]+$/

export interface DiceTerm {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
  /** Keep the highest/lowest N rolled dice. */
  keep?: { mode: 'kh' | 'kl'; n: number }
  /**
   * A value the dice have to beat (`min`) or may not exceed (`max`), joining the pool
   * rather than rewriting a face. `die` gives every die its own copy, `total` sets one
   * against the sum.
   */
  bound?: { mode: 'min' | 'max'; value: number; scope: 'die' | 'total' }
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
   * often a typo than a tag, and swallowing it would hide the mistake. At most 100 entries
   * may be inspected; each must contain only lowercase ASCII letters, and duplicates count
   * towards the limit.
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

/** Read grammar digits without allowing rounding or infinity into a parsed formula. */
function exactInteger(digits: string, field: string): number {
  const value = Number(digits)
  if (!Number.isSafeInteger(value)) {
    throw new Error(`A ${field} must be a whole number that stays exact`)
  }
  return value
}

/** Collect a finite, valid set of tag words from caller-owned configuration. */
function recognisedTags(accepted: ParseOptions['tags']): Set<string> {
  if (accepted === undefined) return new Set()
  if (typeof accepted === 'string') {
    throw new Error('Dice tags must be a list of words, not a single string')
  }
  if (accepted === null || typeof accepted[Symbol.iterator] !== 'function') {
    throw new Error('Dice tags must be an iterable list of words')
  }
  const tags = new Set<string>()
  let count = 0
  for (const tag of accepted) {
    if (count >= MAX_TAGS) {
      throw new Error(`A roll may recognise at most ${MAX_TAGS} tags`)
    }
    count++
    if (typeof tag !== 'string' || tag.length > MAX_FORMULA_LENGTH || !TAG.test(tag)) {
      throw new Error(
        `A recognised tag must be a lowercase word of at most ${MAX_FORMULA_LENGTH} letters`,
      )
    }
    tags.add(tag)
  }
  return tags
}

/** The largest total these terms could reach, for checking every total stays exact. */
function largestTotal(terms: Term[]): number {
  return terms.reduce((sum, t) => {
    if (t.kind === 'flat') return sum + Math.abs(t.value)
    let most = t.count * t.sides * (t.explode ? MAX_EXPLOSIONS + 1 : 1)
    // A `min` carries a group past anything its dice could roll, so the ceiling counts
    // it. A `max` only lowers a group and cannot raise it.
    if (t.bound?.mode === 'min') {
      most = Math.max(most, t.bound.scope === 'die' ? t.count * t.bound.value : t.bound.value)
    }
    return sum + most * (t.multiplier ?? 1)
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

/** A DiceTerm from the parser's captures: blank count → 1; adv/dis keeps 1 of the count. */
function diceTerm(
  sign: 1 | -1,
  countStr: string,
  sidesStr: string,
  suffix: string | undefined,
  multiplierStr: string | undefined,
): DiceTerm {
  const sides = exactInteger(sidesStr, 'die side count')
  if (sides < 1 || sides > MAX_SIDES) {
    throw new Error(`A die must have between 1 and ${MAX_SIDES} sides, but this one has ${sides}`)
  }
  const term: DiceTerm = {
    kind: 'dice',
    sign,
    count: countStr === '' ? 1 : exactInteger(countStr, 'die count'),
    sides,
  }
  const bound = suffix ? BOUND_SUFFIX.exec(suffix) : null
  if (suffix === 'adv' || suffix === 'dis') {
    // adv/dis keeps one die out of the several rolled, and the count says how many are
    // thrown, so `4d20adv` keeps the best of four. Fewer than two dice leave the suffix
    // nothing to choose between, so the written count is refused rather than changed.
    if (term.count < 2) {
      throw new Error(`"${suffix}" must choose between at least 2 dice`)
    }
    term.advantage = suffix === 'adv' ? 'advantage' : 'disadvantage'
    term.keep = { mode: suffix === 'adv' ? 'kh' : 'kl', n: 1 }
  } else if (suffix === '!' || suffix === '!p') {
    term.explode = true
    if (suffix === '!p') term.penetrate = true
  } else if (bound) {
    const value = exactInteger(bound[3], 'bound')
    // Below 1 a `min` is a floor no die falls through and a `max` erases the dice.
    if (value < 1) {
      throw new Error(`A bound must be at least 1, but "${suffix}" bounds the dice at ${value}`)
    }
    term.bound = {
      mode: bound[2] as 'min' | 'max',
      value,
      scope: bound[1] ? 'total' : 'die',
    }
  } else if (suffix) {
    // A blank count keeps one, the way a blank count in front of the `d` rolls one die.
    const written = suffix.slice(2)
    const n = written === '' ? 1 : exactInteger(written, 'keep count')
    if (n < 1) {
      throw new Error(`A keep rule must keep at least one die, but "${suffix}" keeps none`)
    }
    term.keep = { mode: suffix.slice(0, 2) as 'kh' | 'kl', n }
  }
  if (multiplierStr) {
    const times = exactInteger(multiplierStr.slice(1), 'multiplier')
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
  if (input.length > MAX_FORMULA_LENGTH) {
    throw new Error(
      `Dice formula is too long: ${input.length} characters, the limit is ${MAX_FORMULA_LENGTH}`,
    )
  }
  const source = input.trim()
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
  const tags = recognisedTags(ownProperties(opts).tags)

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
  const re =
    /([+-]?)(?:(\d*)d(\d+)(adv|dis|kh\d*|kl\d*|totalmin\d+|totalmax\d+|min\d+|max\d+|!p?)?(x\d+)?|(\d+))/y
  let pos = 0
  while (pos < expr.length) {
    re.lastIndex = pos
    const m = re.exec(expr)
    if (!m || m.index !== pos) {
      throw new Error(`Cannot parse "${excerpt(source)}" near "${excerpt(expr.slice(pos))}"`)
    }
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1
    if (m[6] !== undefined) {
      terms.push({ kind: 'flat', value: sign * exactInteger(m[6], 'modifier') })
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
