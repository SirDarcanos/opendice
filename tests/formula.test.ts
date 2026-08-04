// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

import { afterEach, describe, expect, it } from 'vitest'
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

  it('finds a tag however much space precedes it', () => {
    expect(parseFormula('2d10+8    fire', { tags: ['fire'] }).tag).toBe('fire')
  })

  it('rejects tags given as a single string rather than a list of words', () => {
    expect(() => parseFormula('1d6 f', { tags: 'fire' as unknown as string[] })).toThrow()
  })
})

// A formula is the one input here that routinely arrives from somewhere untrusted, so
// every part of it that drives work is bounded. Each of these used to hang the process.
describe('limits on what a formula may ask for', () => {
  it('accepts the largest roll it allows', () => {
    expect(parseFormula('1000d6').terms[0]).toMatchObject({ count: 1000 })
    expect(parseFormula('1d4294967296').terms[0]).toMatchObject({ sides: 4294967296 })
  })

  it('rejects more dice than a roll allows, counting every term', () => {
    expect(() => parseFormula('1001d6')).toThrow(/at most/)
    expect(() => parseFormula('99999999d20')).toThrow(/at most/)
    expect(() => parseFormula('600d6+600d6')).toThrow(/at most/)
  })

  it('rejects a die with more sides than one draw can address', () => {
    expect(() => parseFormula('1d4294967297')).toThrow(/sides/)
  })

  it('rejects a die with no sides rather than leaving it to fail at roll time', () => {
    expect(() => parseFormula('1d0')).toThrow(/sides/)
  })

  it('rejects a formula too long to have been typed', () => {
    expect(() => parseFormula('1d6' + ' '.repeat(50_000) + '+1')).toThrow(/too long/)
  })

  // Past 2^53 a total stops being exact, so `1d6+99999999999999999999` used to report a
  // rounded number and `1d6+` four hundred nines used to report Infinity.
  it('rejects a total too large to stay exact', () => {
    expect(() => parseFormula('1d6+99999999999999999999')).toThrow(/exact/)
    expect(() => parseFormula('1d6+' + '9'.repeat(400))).toThrow(/exact/)
    expect(() => parseFormula('1d6+9007199254740991+9007199254740991')).toThrow(/exact/)
  })

  it('allows the largest total that is still exact', () => {
    expect(parseFormula(`1d1+${Number.MAX_SAFE_INTEGER - 1}`).terms[1]).toMatchObject({
      value: Number.MAX_SAFE_INTEGER - 1,
    })
  })

  // `2+5` is arithmetic with no dice in it, and `roll()` answering 7 would be reporting
  // a total with nothing rolled to back it up. `parseFormula` is the documented way to
  // check what someone typed, so it has to be the thing that says no.
  it('rejects a formula that rolls no dice', () => {
    expect(() => parseFormula('2+5')).toThrow(/at least one die/)
    expect(() => parseFormula('5')).toThrow(/at least one die/)
    expect(() => parseFormula('10-3')).toThrow(/at least one die/)
    expect(() => parseFormula('0d6')).toThrow(/at least one die/)
    expect(() => parseFormula('0d6+5')).toThrow(/at least one die/)
  })

  // Keeping none of them is not a way of rolling dice, and reads as a typo for kh1.
  it('rejects a keep rule that keeps no dice', () => {
    expect(() => parseFormula('4d6kh0')).toThrow(/at least one/)
    expect(() => parseFormula('4d6kl0')).toThrow(/at least one/)
  })
})

// An error message is the one place raw input travels back out of this library, and a
// caller showing one on a page would otherwise be pasting whatever was typed into it.
describe('quoting bad input back', () => {
  it('strips anything a formula could not contain', () => {
    const attempt = () => parseFormula('<img src=x onerror=alert(1)>')
    expect(attempt).toThrow(/Cannot parse/)
    expect(attempt).not.toThrow(/<img/)
    expect(attempt).not.toThrow(/onerror=/)
  })

  it('still shows enough of a typo to find it', () => {
    expect(() => parseFormula('2d6 + x')).toThrow(/x/)
    expect(() => parseFormula('1d6*2')).toThrow(/1d6\?2/)
  })

  it('quotes a bounded amount however long the input', () => {
    try {
      parseFormula('<'.repeat(900))
      expect.unreachable()
    } catch (e) {
      expect((e as Error).message.length).toBeLessThan(140)
    }
  })
})

// Reading an optional field asks whether it is there, and a plain object inherits from
// Object.prototype — so anything that can pollute it could otherwise forge parts of a
// formula nobody wrote.
describe('a polluted Object.prototype', () => {
  const polluted: string[] = []

  /** Add an inherited property, remembered so afterEach can take it off again. */
  function pollute(key: string, value: unknown): void {
    polluted.push(key)
    Object.defineProperty(Object.prototype, key, { value, configurable: true })
  }

  afterEach(() => {
    for (const key of polluted.splice(0)) {
      delete (Object.prototype as Record<string, unknown>)[key]
    }
  })

  it('cannot supply the tags the caller never accepted', () => {
    pollute('tags', ['fire'])
    expect(() => parseFormula('2d10+8 fire')).toThrow()
  })

  it('cannot forge a tag on the result', () => {
    pollute('tag', 'poisoned')
    expect(parseFormula('2d6').tag).toBeUndefined()
  })

  it('cannot forge a keep rule or an explosion on a term', () => {
    pollute('keep', { mode: 'kl', n: 1 })
    pollute('explode', true)
    const term = parseFormula('4d6').terms[0]
    expect(term.kind === 'dice' && term.keep).toBeUndefined()
    expect(term.kind === 'dice' && term.explode).toBeUndefined()
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
