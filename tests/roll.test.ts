// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest'
import { d20Group, keptFlags, roll } from '../src/roll.ts'
import type { RandomSource } from '../src/rng.ts'

/** Deterministic source: yields the given die faces in order (face f -> f-1 raw). */
function faceSeq(...faces: number[]): RandomSource {
  let i = 0
  return () => {
    if (i >= faces.length) throw new Error('faceSeq exhausted')
    return faces[i++] - 1
  }
}

describe('roll', () => {
  it('sums dice and a flat modifier', () => {
    const r = roll('2d6+4', { rand: faceSeq(3, 5) })
    expect(r.dice[0].results).toEqual([3, 5])
    expect(r.dice[0].kept).toEqual([3, 5])
    expect(r.modifier).toBe(4)
    expect(r.total).toBe(12)
    expect(r.advantageState).toBe('normal')
  })

  it('flags a natural 20 as a crit', () => {
    const r = roll('1d20+7', { kind: 'attack', rand: faceSeq(20) })
    expect(r.total).toBe(27)
    expect(r.crit).toBe(true)
    expect(r.fumble).toBe(false)
  })

  it('flags a natural 1 as a fumble', () => {
    const r = roll('1d20+7', { kind: 'attack', rand: faceSeq(1) })
    expect(r.fumble).toBe(true)
    expect(r.crit).toBe(false)
  })

  it('keeps the highest on advantage', () => {
    const r = roll('1d20adv+5', { rand: faceSeq(4, 18) })
    expect(r.dice[0].results).toEqual([4, 18])
    expect(r.dice[0].kept).toEqual([18])
    expect(r.total).toBe(23)
    expect(r.advantageState).toBe('advantage')
  })

  it('keeps the lowest on disadvantage', () => {
    const r = roll('1d20dis+5', { rand: faceSeq(4, 18) })
    expect(r.dice[0].kept).toEqual([4])
    expect(r.total).toBe(9)
    expect(r.advantageState).toBe('disadvantage')
  })

  it('keeps the highest N (4d6kh3)', () => {
    const r = roll('4d6kh3', { rand: faceSeq(1, 5, 3, 6) })
    expect(r.dice[0].kept).toEqual([6, 5, 3])
    expect(r.total).toBe(14)
  })

  it('doubles dice but not modifiers on a crit (RAW, crit: true)', () => {
    const r = roll('2d10+8', { crit: true, rand: faceSeq(10, 10, 1, 1) })
    expect(r.dice[0].results).toHaveLength(4)
    expect(r.total).toBe(30) // (10+10+1+1) + 8
  })

  it('supports the double-total crit rule', () => {
    const r = roll('2d6+5', { crit: 'double-total', rand: faceSeq(3, 4) })
    expect(r.dice[0].results).toHaveLength(2) // rolled once
    expect(r.dice[0].total).toBe(14) // (3+4) doubled
    expect(r.total).toBe(19) // dice doubled, modifier untouched
  })

  it('supports the max-plus-roll crit rule', () => {
    const r = roll('2d6', { crit: 'max-plus-roll', rand: faceSeq(3, 4) })
    expect(r.dice[0].results).toHaveLength(2)
    expect(r.total).toBe(19) // 2*6 (max) + (3+4)
  })

  it('does not apply crit rules to attack/keep dice', () => {
    const r = roll('1d20adv', { crit: 'double-dice', rand: faceSeq(4, 18) })
    expect(r.dice[0].results).toHaveLength(2) // advantage's two dice, not doubled
    expect(r.total).toBe(18)
  })

  it('carries a trailing tag through to the result', () => {
    const r = roll('2d6 fire', { rand: faceSeq(2, 2), tags: ['fire'] })
    expect(r.tag).toBe('fire')
    expect(r.total).toBe(4)
  })

  it('composes additive sub-rolls into separate dice groups', () => {
    const r = roll('1d8+1d4+3', { rand: faceSeq(5, 2) })
    expect(r.dice).toHaveLength(2)
    expect(r.total).toBe(10)
  })

  it('subtracts negatively-signed dice', () => {
    const r = roll('10-1d4', { rand: faceSeq(2) })
    expect(r.modifier).toBe(10)
    expect(r.total).toBe(8)
  })

  it('does not flag crit/fumble on multi-die or non-d20 rolls', () => {
    expect(roll('2d20', { rand: faceSeq(20, 20) }).crit).toBe(false)
    expect(roll('1d6', { rand: faceSeq(1) }).fumble).toBe(false)
  })

  it('applies advantage from context to a plain d20', () => {
    const r = roll('1d20+5', { advantage: 'advantage', rand: faceSeq(4, 18) })
    expect(r.dice[0].kept).toEqual([18])
    expect(r.total).toBe(23)
    expect(r.advantageState).toBe('advantage')
  })

  it('applies disadvantage from context', () => {
    const r = roll('1d20+5', { advantage: 'disadvantage', rand: faceSeq(4, 18) })
    expect(r.dice[0].kept).toEqual([4])
    expect(r.advantageState).toBe('disadvantage')
  })

  it("treats advantage 'normal' as a no-op", () => {
    const r = roll('1d20+5', { advantage: 'normal', rand: faceSeq(7) })
    expect(r.dice[0].results).toHaveLength(1)
    expect(r.total).toBe(12)
  })

  it('folds in bonus terms (Bless) without touching the modifier', () => {
    const r = roll('1d20+5', { bonuses: ['1d4'], rand: faceSeq(10, 3) })
    expect(r.dice).toHaveLength(2)
    expect(r.modifier).toBe(5)
    expect(r.total).toBe(18) // 10 + 5 + 3
  })

  it('folds in negative numeric bonuses', () => {
    const r = roll('1d20+5', { bonuses: [-2], rand: faceSeq(10) })
    expect(r.total).toBe(13) // 10 + 5 - 2
  })
})

describe('keptFlags', () => {
  it('marks the die advantage kept and the one it dropped', () => {
    const r = roll('1d20+5', { advantage: 'advantage', rand: faceSeq(7, 18) })
    expect(r.dice[0].results).toEqual([7, 18])
    expect(keptFlags(r.dice[0])).toEqual([false, true])
  })

  it('drops exactly one of a tied pair', () => {
    const r = roll('1d20', { advantage: 'disadvantage', rand: faceSeq(12, 12) })
    expect(keptFlags(r.dice[0])).toEqual([true, false])
  })

  it('marks every die when none was dropped', () => {
    const r = roll('2d6', { rand: faceSeq(3, 5) })
    expect(keptFlags(r.dice[0])).toEqual([true, true])
  })
})

describe('d20Group', () => {
  it('finds the one d20 group behind a roll', () => {
    const r = roll('1d20+5', { rand: faceSeq(11) })
    expect(d20Group(r)?.results).toEqual([11])
  })

  it('gives nothing when the roll has no single d20 to show', () => {
    expect(d20Group(roll('2d6+3', { rand: faceSeq(2, 4) }))).toBeUndefined()
  })
})
