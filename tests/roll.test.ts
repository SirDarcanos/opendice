// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest'
import { keptFlags, roll, soleDieGroup } from '../src/roll.ts'
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

  it('reports the highest face on the kept die', () => {
    const r = roll('1d20+7', { rand: faceSeq(20) })
    expect(r.total).toBe(27)
    expect(r.dice[0].naturalHigh).toBe(true)
    expect(r.dice[0].naturalLow).toBe(false)
  })

  it('reports the lowest face on the kept die', () => {
    const r = roll('1d20+7', { rand: faceSeq(1) })
    expect(r.dice[0].naturalLow).toBe(true)
    expect(r.dice[0].naturalHigh).toBe(false)
  })

  // The highest face of a d78 is 78. Nothing here assumes a twenty-sided die.
  it('reads the highest face off whatever die was rolled', () => {
    expect(roll('1d78', { rand: faceSeq(78) }).dice[0].naturalHigh).toBe(true)
    expect(roll('1d78', { rand: faceSeq(77) }).dice[0].naturalHigh).toBe(false)
    expect(roll('1d3', { rand: faceSeq(3) }).dice[0].naturalHigh).toBe(true)
    expect(roll('1d78', { rand: faceSeq(1) }).dice[0].naturalLow).toBe(true)
  })

  // Which die decides a roll is the caller's business, so each group answers for
  // itself rather than one of them speaking for the whole roll.
  it('answers per group when a roll mixes dice', () => {
    const r = roll('1d20+1d4', { rand: faceSeq(20, 2) })
    expect(r.dice[0].naturalHigh).toBe(true)
    expect(r.dice[1].naturalHigh).toBe(false)
  })

  // It is a fact about the dice, not a ruling, so nothing has to be declared to get
  // it — there is no roll "kind" to opt in with, and a save reports it as readily as
  // an attack. What it means is the caller's business.
  it('reports it whatever the roll was for, with nothing declared', () => {
    expect(roll('1d20', { rand: faceSeq(20) }).dice[0].naturalHigh).toBe(true)
    expect(roll('1d20+3', { rand: faceSeq(1) }).dice[0].naturalLow).toBe(true)
  })

  // Advantage keeps one of two, so the kept die still counts.
  it('reads the kept die, not the dropped one', () => {
    expect(roll('1d20adv', { rand: faceSeq(1, 20) }).dice[0].naturalHigh).toBe(true)
    expect(roll('1d20adv', { rand: faceSeq(1, 20) }).dice[0].naturalLow).toBe(false)
    expect(roll('1d20dis', { rand: faceSeq(1, 20) }).dice[0].naturalLow).toBe(true)
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

  // Doubling damage on a critical hit is a rule, not a dice operation, so it lives in
  // the caller. Each of the three common ways to do it is reachable from what roll()
  // already returns, which is why the library needs no opinion about them.
  it('leaves crit damage to the caller, who has everything they need', () => {
    // Double the dice: rewrite the formula.
    expect(roll('4d10+8', { rand: faceSeq(10, 10, 1, 1) }).total).toBe(30)
    // Double the dice total: arithmetic on the result.
    const r = roll('2d6+5', { rand: faceSeq(3, 4) })
    expect(r.dice[0].total * 2 + r.modifier).toBe(19)
    // Maximise then roll: the maximum is count × sides, which the group reports.
    const g = roll('2d6', { rand: faceSeq(3, 4) }).dice[0]
    expect(g.results.length * g.sides + g.total).toBe(19)
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

  it('reports nothing when a group kept more than one die', () => {
    expect(roll('2d20', { rand: faceSeq(20, 20) }).dice[0].naturalHigh).toBe(false)
    expect(roll('3d6', { rand: faceSeq(1, 1, 1) }).dice[0].naturalLow).toBe(false)
    // Keeping one of several still counts — it is the kept die that is read.
    expect(roll('4d6kh1', { rand: faceSeq(1, 6, 2, 3) }).dice[0].naturalHigh).toBe(true)
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

describe('soleDieGroup', () => {
  it('finds the one group of dice behind a roll', () => {
    expect(soleDieGroup(roll('1d20+5', { rand: faceSeq(11) }))?.results).toEqual([11])
  })

  it('counts groups, not dice — flat modifiers are not a group', () => {
    expect(soleDieGroup(roll('2d6+3', { rand: faceSeq(2, 4) }))?.results).toEqual([2, 4])
  })

  it('gives nothing rather than guessing when a roll mixes kinds of die', () => {
    expect(soleDieGroup(roll('1d20+1d6', { rand: faceSeq(11, 3) }))).toBeUndefined()
  })
})
