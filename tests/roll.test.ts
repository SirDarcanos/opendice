// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

import { afterEach, describe, expect, it } from 'vitest'
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

describe('exploding dice', () => {
  it('rolls again and adds when a die lands on its top face', () => {
    // 6 explodes into 4: the chain stops because 4 is not a top face.
    const r = roll('1d6!', { rand: faceSeq(6, 4) })
    expect(r.dice[0].results).toEqual([6, 4])
    expect(r.total).toBe(10)
  })

  it('keeps going while the top face keeps coming up', () => {
    const r = roll('1d6!', { rand: faceSeq(6, 6, 2) })
    expect(r.dice[0].results).toEqual([6, 6, 2])
    expect(r.total).toBe(14)
  })

  it('does not explode a die that landed anywhere else', () => {
    const r = roll('1d6!', { rand: faceSeq(3) })
    expect(r.dice[0].results).toEqual([3])
    expect(r.total).toBe(3)
  })

  it('explodes each die of a group independently', () => {
    // Three dice: the first explodes, the other two do not.
    const r = roll('3d6!', { rand: faceSeq(6, 4, 2, 3) })
    expect(r.dice[0].results).toEqual([6, 4, 2, 3])
    expect(r.total).toBe(15)
  })

  it('adds the whole chain to the total, modifiers included', () => {
    expect(roll('1d6!+5', { rand: faceSeq(6, 2) }).total).toBe(13)
    expect(roll('10-1d6!', { rand: faceSeq(6, 1) }).total).toBe(3)
  })

  // A one-sided die shows its top face every time, so exploding it would never end.
  it('never explodes a die with fewer than two sides', () => {
    const r = roll('1d1!', { rand: () => 0 })
    expect(r.dice[0].results).toEqual([1])
    expect(r.total).toBe(1)
  })

  // A loaded source cannot hang the process: the chain is cut, and cut generously
  // enough that fair dice never reach it.
  it('cuts a runaway chain rather than looping forever', () => {
    const alwaysMax: RandomSource = () => 5 // a d6 rejects nothing at 5, giving face 6
    const r = roll('1d6!', { rand: alwaysMax })
    expect(r.dice[0].results.length).toBeLessThanOrEqual(101)
    expect(r.dice[0].results.every((v) => v === 6)).toBe(true)
  })

  it('reports no natural face once a die has exploded', () => {
    // The group kept several values, so there is no single die to read.
    expect(roll('1d6!', { rand: faceSeq(6, 4) }).dice[0].naturalHigh).toBe(false)
    // One roll that did not explode still reads normally.
    expect(roll('1d6!', { rand: faceSeq(1) }).dice[0].naturalLow).toBe(true)
  })
})

describe('group multiplier', () => {
  it('multiplies what the group kept', () => {
    const g = roll('1d6x10', { rand: faceSeq(3) }).dice[0]
    expect(g.kept).toEqual([3])
    expect(g.multiplier).toBe(10)
    expect(g.total).toBe(30)
  })

  it('multiplies the group total, never the flat modifiers', () => {
    const r = roll('1d6x10+5', { rand: faceSeq(3) })
    expect(r.total).toBe(35)
    expect(r.modifiers).toEqual([5])
  })

  it('reports 1 when the formula asked for no multiplier', () => {
    expect(roll('2d6', { rand: faceSeq(3, 5) }).dice[0].multiplier).toBe(1)
  })

  it('applies per group, so each keeps its own', () => {
    const r = roll('1d6x10+1d4x100', { rand: faceSeq(3, 2) })
    expect(r.dice.map((g) => g.total)).toEqual([30, 200])
    expect(r.total).toBe(230)
  })

  it('multiplies a subtracted group too', () => {
    expect(roll('-1d6x10', { rand: faceSeq(3) }).total).toBe(-30)
  })

  it('applies after a keep rule, advantage and an explosion', () => {
    expect(roll('4d6kh3x2', { rand: faceSeq(1, 5, 3, 6) }).total).toBe(28)
    expect(roll('1d20advx2', { rand: faceSeq(4, 18) }).total).toBe(36)
    expect(roll('1d6!x2', { rand: faceSeq(6, 2) }).total).toBe(16)
  })

  // The multiplier changes the total, not what the die showed.
  it('leaves the natural face reading the die itself', () => {
    const g = roll('1d20x2', { rand: faceSeq(20) }).dice[0]
    expect(g.naturalHigh).toBe(true)
    expect(g.total).toBe(40)
  })

  it('leaves keptFlags lined up with results', () => {
    expect(keptFlags(roll('1d20advx2', { rand: faceSeq(4, 18) }).dice[0])).toEqual([false, true])
  })
})

describe('limits', () => {
  it('counts bonuses towards the dice a roll may use', () => {
    expect(() => roll('600d6', { bonuses: ['600d6'] })).toThrow(/at most/)
  })

  it('leaves a roll within the limit alone', () => {
    expect(roll('500d6', { bonuses: ['500d6'] }).dice).toHaveLength(2)
  })

  // A formula can only say a whole number; a bonus is the same arithmetic, and these
  // used to travel straight through into the total.
  it('refuses a numeric bonus that is not an exact whole number', () => {
    expect(() => roll('1d6', { bonuses: [NaN] })).toThrow(/whole number/)
    expect(() => roll('1d6', { bonuses: [Infinity] })).toThrow(/whole number/)
    expect(() => roll('1d6', { bonuses: [1.5] })).toThrow(/whole number/)
    expect(() => roll('1d6', { bonuses: [2 ** 53] })).toThrow(/whole number/)
  })

  it('takes a negative whole bonus', () => {
    expect(roll('1d6', { rand: faceSeq(4), bonuses: [-2] }).total).toBe(2)
  })
})

describe('negative and signed terms', () => {
  it('subtracts a whole dice group', () => {
    const r = roll('-1d6', { rand: faceSeq(4) })
    expect(r.dice[0].sign).toBe(-1)
    expect(r.dice[0].total).toBe(-4)
    expect(r.total).toBe(-4)
  })

  it('reaches a negative total', () => {
    expect(roll('1d6-10', { rand: faceSeq(3) }).total).toBe(-7)
    expect(roll('-2d6-3', { rand: faceSeq(4, 5) }).total).toBe(-12)
  })

  it('keeps the highest of a subtracted advantage roll, then subtracts it', () => {
    const r = roll('-1d20adv', { rand: faceSeq(4, 18) })
    expect(r.dice[0].kept).toEqual([18])
    expect(r.total).toBe(-18)
  })

  // The grammar has no operators beyond a leading sign, so none of this is arithmetic
  // it will guess at.
  it('refuses anything that is not a sum of terms', () => {
    for (const f of ['1d20+-5', '--5', '1d6+', '1d6*2', '(1d6+1)*2', '1d6^2', '1.5d6', '1d-6']) {
      expect(() => roll(f)).toThrow()
    }
  })
})

// Every option here is read by asking whether it is there, and `roll('1d20')` passes a
// plain `{}` — which inherits from Object.prototype. Anything able to pollute that could
// otherwise choose the randomness itself, and the roll log would report the result as fact.
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

  it('cannot supply the random source', () => {
    pollute('rand', () => {
      throw new Error('the inherited source was used')
    })
    expect(() => roll('1d20')).not.toThrow()
  })

  it('cannot force advantage', () => {
    pollute('advantage', 'advantage')
    // faceSeq holds one face, so a second die would throw rather than quietly appear.
    const r = roll('1d20', { rand: faceSeq(11) })
    expect(r.dice[0].results).toEqual([11])
    expect(r.advantageState).toBe('normal')
  })

  it('cannot add bonuses of its own', () => {
    pollute('bonuses', [1000])
    expect(roll('1d20', { rand: faceSeq(11) }).total).toBe(11)
  })

  it('cannot forge a tag on the result', () => {
    pollute('tag', 'poisoned')
    expect(roll('1d6', { rand: faceSeq(3) }).tag).toBeUndefined()
  })

  it('cannot make a die explode', () => {
    pollute('explode', true)
    expect(roll('1d6', { rand: faceSeq(6) }).dice[0].results).toEqual([6])
  })

  it('cannot drop dice with a keep rule', () => {
    pollute('keep', { mode: 'kl', n: 1 })
    expect(roll('4d6', { rand: faceSeq(6, 5, 3, 2) }).dice[0].kept).toEqual([6, 5, 3, 2])
  })
})
