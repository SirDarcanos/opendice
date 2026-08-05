// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

import { describe, expect, it } from 'vitest'
import { rollDie, type RandomSource } from '../src/rng.ts'
import { roll } from '../src/roll.ts'

/** A source returning the given raw uint32 values in order. */
function rawSeq(...values: number[]): RandomSource {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error('rawSeq exhausted')
    return values[i++]
  }
}

describe('rollDie', () => {
  it('maps a raw draw to a face via rejection-free modulo', () => {
    // x = face - 1 is always below the ceiling, so it maps straight to the face.
    expect(rollDie(6, rawSeq(0))).toBe(1)
    expect(rollDie(6, rawSeq(5))).toBe(6)
    expect(rollDie(20, rawSeq(19))).toBe(20)
  })

  it('rejects values at or above the unbiased ceiling and redraws', () => {
    const ceiling = Math.floor(2 ** 32 / 6) * 6
    // First draw is in the biased remainder (rejected); second is valid.
    expect(rollDie(6, rawSeq(ceiling, 5))).toBe(6)
  })

  it('throws on a non-positive or non-integer number of sides', () => {
    expect(() => rollDie(0)).toThrow()
    expect(() => rollDie(-4)).toThrow()
    expect(() => rollDie(2.5)).toThrow()
  })

  // Above 2^32 the ceiling rounds down to zero, so every draw sits at or above it. The
  // loop would then redraw forever: a hang, not a wrong answer.
  // TypeScript says `number`; JavaScript callers are not bound by that, and this message
  // is as likely to end up on a page as any other error here.
  it('names the type rather than repeating a non-number', () => {
    const attempt = () => rollDie("'; DROP TABLE rolls" as unknown as number)
    expect(attempt).toThrow(/got string/)
    expect(attempt).not.toThrow(/DROP/)
  })

  it('throws on more sides than one draw can address', () => {
    expect(() => rollDie(2 ** 32 + 1, rawSeq(0))).toThrow()
    expect(() => rollDie(Number.MAX_SAFE_INTEGER, rawSeq(0))).toThrow()
  })

  it('still rolls the largest die one draw can address', () => {
    expect(rollDie(2 ** 32, rawSeq(0))).toBe(1)
  })

  // A source stuck in the rejection zone used to spin forever. Every die accepts more
  // than half of all draws, so giving up says the source is broken, never that a fair
  // one was unlucky.
  it('gives up on a source that rejects every draw instead of hanging', () => {
    const ceiling = Math.floor(2 ** 32 / 20) * 20
    expect(() => rollDie(20, () => ceiling)).toThrow(/rejected/)
  })

  it('stays within range across many real CSPRNG draws', () => {
    for (let i = 0; i < 2000; i++) {
      const v = rollDie(20)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
  })

  it('produces every face of a d6 over many draws (sanity, not a distribution test)', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(rollDie(6))
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]))
  })
})

/**
 * Every other test here hands `rollDie` a source of its own, which means the source real
 * callers get — the default one — is never exercised for anything but staying in range.
 * Code reading `rand === cryptoRandom` could therefore behave one way under test and
 * another way in production, and the suite would agree with it. These draw from the
 * default source and check the shape of what comes out.
 */
describe('the default source, which every other test replaces', () => {
  /** Pearson's chi-square against a flat expectation. */
  function chiSquare(counts: number[], draws: number): number {
    const expected = draws / counts.length
    return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0)
  }

  // 19 degrees of freedom puts an honest run near 19 and under 44 all but once in a
  // thousand. 100 is far enough out that this cannot flake, and at 200k draws it still
  // catches a face nudged as rarely as one draw in a hundred.
  it('deals a d20 evenly over 200,000 draws of its own randomness', () => {
    const counts = new Array(20).fill(0)
    for (let i = 0; i < 200_000; i++) counts[rollDie(20) - 1]++
    expect(Math.min(...counts)).toBeGreaterThan(0)
    expect(chiSquare(counts, 200_000)).toBeLessThan(100)
  })

  it('deals a d6 evenly too, where the rejection window is a different size', () => {
    const counts = new Array(6).fill(0)
    for (let i = 0; i < 60_000; i++) counts[rollDie(6) - 1]++
    expect(chiSquare(counts, 60_000)).toBeLessThan(50)
  })

  // Same again through the public entry point, so `roll()` is known to reach the CSPRNG
  // rather than only `rollDie` being known to.
  // Looked up per call, this is replaceable by anything else sharing the page, and a
  // roll log would report the results of the replacement as fact.
  it('ignores crypto.getRandomValues being replaced after this module loaded', () => {
    const real = crypto.getRandomValues
    try {
      crypto.getRandomValues = ((buf: Uint32Array) => {
        buf[0] = 19 // a d20 would read this as a natural 20, every time
        return buf
      }) as typeof crypto.getRandomValues
      const seen = new Set<number>()
      for (let i = 0; i < 200; i++) seen.add(rollDie(20))
      expect(seen.size).toBeGreaterThan(1)
    } finally {
      crypto.getRandomValues = real
    }
  })

  it('reaches every face through roll() as well', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2_000; i++) seen.add(roll('1d20').total)
    expect(seen.size).toBe(20)
  })
})
