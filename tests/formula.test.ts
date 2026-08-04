// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest'
import { parseFormula } from '../src/formula.ts'

describe('parseFormula', () => {
  it('parses dice and a flat modifier', () => {
    expect(parseFormula('2d6+4').terms).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6 },
      { kind: 'flat', value: 4 },
    ])
  })

  it('defaults the count to 1', () => {
    expect(parseFormula('d20').terms).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 20 }])
  })

  it('expands advantage into two dice keeping the highest', () => {
    expect(parseFormula('1d20adv+5').terms).toEqual([
      {
        kind: 'dice',
        sign: 1,
        count: 2,
        sides: 20,
        advantage: 'advantage',
        keep: { mode: 'kh', n: 1 },
      },
      { kind: 'flat', value: 5 },
    ])
  })

  it('expands disadvantage into two dice keeping the lowest', () => {
    expect(parseFormula('1d20dis').terms[0]).toMatchObject({
      advantage: 'disadvantage',
      keep: { mode: 'kl', n: 1 },
    })
  })

  it('parses keep-highest/lowest', () => {
    expect(parseFormula('4d6kh3').terms[0]).toMatchObject({ keep: { mode: 'kh', n: 3 } })
    expect(parseFormula('5d6kl2').terms[0]).toMatchObject({ keep: { mode: 'kl', n: 2 } })
  })

  it('parses a trailing tag the caller recognises', () => {
    const f = parseFormula('2d10+8 fire', { tags: ['fire', 'cold'] })
    expect(f.tag).toBe('fire')
    expect(f.terms).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 10 },
      { kind: 'flat', value: 8 },
    ])
  })

  // The parser knows a formula can carry a tag, never which tags are real. A word it
  // was not told about is far more often a typo than a tag, so it fails rather than
  // swallowing it — the mistake surfaces instead of travelling as metadata.
  it('rejects a trailing word it was not told to expect', () => {
    expect(() => parseFormula('2d10+8 fire')).toThrow()
    expect(() => parseFormula('2d10+8 banana', { tags: ['fire'] })).toThrow()
  })

  it('takes its tags as a Set as readily as an array', () => {
    expect(parseFormula('1d4 cold', { tags: new Set(['cold']) }).tag).toBe('cold')
  })

  it('leaves the tag off entirely when the formula carries none', () => {
    expect('tag' in parseFormula('1d20+3', { tags: ['fire'] })).toBe(false)
  })

  it('parses subtracted dice (Bane-style)', () => {
    expect(parseFormula('10-1d4').terms).toEqual([
      { kind: 'flat', value: 10 },
      { kind: 'dice', sign: -1, count: 1, sides: 4 },
    ])
  })

  it('composes additive sub-rolls', () => {
    expect(parseFormula('1d8+1d4+3').terms).toHaveLength(3)
  })

  it('throws on malformed or unsupported input', () => {
    expect(() => parseFormula('')).toThrow()
    expect(() => parseFormula('nonsense')).toThrow()
  })
})

describe('exploding dice', () => {
  it('marks a term as exploding', () => {
    expect(parseFormula('1d6!').terms[0]).toMatchObject({ sides: 6, count: 1, explode: true })
    expect(parseFormula('3d10!').terms[0]).toMatchObject({ sides: 10, count: 3, explode: true })
  })

  it('leaves a plain term alone', () => {
    expect('explode' in parseFormula('1d6').terms[0]).toBe(false)
  })

  it('sits alongside other terms', () => {
    const t = parseFormula('1d6!+1d4+2').terms
    expect(t).toHaveLength(3)
    expect(t[0]).toMatchObject({ explode: true })
    expect('explode' in t[1]).toBe(false)
  })

  // The suffixes are alternatives in the grammar, so exploding and keeping cannot be
  // asked for together — which sidesteps having to define what keeping the highest of
  // several open-ended chains would even mean.
  it('cannot be combined with a keep rule or advantage', () => {
    expect(() => parseFormula('4d6kh3!')).toThrow()
    expect(() => parseFormula('1d20adv!')).toThrow()
    expect(() => parseFormula('1d6!!')).toThrow()
  })
})
