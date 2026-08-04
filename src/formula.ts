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

export type AdvantageState = 'normal' | 'advantage' | 'disadvantage'

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
   */
  tags?: Iterable<string>
}

/** A DiceTerm from the parser's captures: blank count → 1; adv/dis desugars to 2 dice keep 1. */
function diceTerm(
  sign: 1 | -1,
  countStr: string,
  sidesStr: string,
  suffix: string | undefined,
): DiceTerm {
  const sides = Number(sidesStr)
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
  let expr = source.toLowerCase()
  const tags = opts.tags instanceof Set ? opts.tags : new Set(opts.tags ?? [])

  let tag: string | undefined
  const tagMatch = /\s+([a-z]+)$/.exec(expr)
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

  return { source, terms, ...(tag !== undefined ? { tag } : {}) }
}
