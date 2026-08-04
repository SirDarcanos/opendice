// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

/**
 * The formula grammar, parsed into a structured form `roll()` evaluates.
 *
 *   NdM              standard             2d6
 *   NdM+K / NdM-K    modifier             1d20+7, 10-1d4
 *   1d20adv/1d20dis  advantage/disadv     roll two, keep highest/lowest
 *   NdMkhX / NdMklX  keep highest/lowest  4d6kh3
 *   NdM!             exploding            1d6! — a top face rolls again and adds
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

/** Throw if these terms together ask for more dice than one roll is allowed. */
export function assertDiceLimit(terms: Term[]): void {
  const count = terms.reduce((n, t) => (t.kind === 'dice' ? n + t.count : n), 0)
  if (count > MAX_DICE) {
    throw new Error(`A roll may use at most ${MAX_DICE} dice, but this one asks for ${count}`)
  }
}

/** A DiceTerm from the parser's captures: blank count → 1; adv/dis desugars to 2 dice keep 1. */
function diceTerm(
  sign: 1 | -1,
  countStr: string,
  sidesStr: string,
  suffix: string | undefined,
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
    term.advantage = suffix === 'adv' ? 'advantage' : 'disadvantage'
    term.count = 2
    term.keep = { mode: suffix === 'adv' ? 'kh' : 'kl', n: 1 }
  } else if (suffix === '!') {
    term.explode = true
  } else if (suffix) {
    term.keep = { mode: suffix.slice(0, 2) as 'kh' | 'kl', n: Number(suffix.slice(2)) }
  }
  return term
}

/** Parse a dice formula into structured terms. Throws on malformed input. */
export function parseFormula(input: string, opts: ParseOptions = {}): Formula {
  const source = input.trim()
  if (source.length > MAX_FORMULA_LENGTH) {
    throw new Error(
      `Dice formula is too long: ${source.length} characters, the limit is ${MAX_FORMULA_LENGTH}`,
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
  if (expr === '') throw new Error(`Empty dice formula: "${source}"`)

  const terms: Term[] = []
  const re = /([+-]?)(?:(\d*)d(\d+)(adv|dis|kh\d+|kl\d+|!)?|(\d+))/y
  let pos = 0
  while (pos < expr.length) {
    re.lastIndex = pos
    const m = re.exec(expr)
    if (!m || m.index !== pos) {
      throw new Error(`Cannot parse "${source}" near "${expr.slice(pos)}"`)
    }
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1
    if (m[5] !== undefined) {
      terms.push({ kind: 'flat', value: sign * Number(m[5]) })
    } else {
      terms.push(diceTerm(sign, m[2], m[3], m[4]))
    }
    pos = re.lastIndex
  }

  assertDiceLimit(terms)
  return ownProperties({
    source,
    terms: terms.map(ownProperties),
    ...(tag !== undefined ? { tag } : {}),
  })
}
