// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest'
import { rollDie, type RandomSource } from '../src/rng.ts'

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
