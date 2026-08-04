// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

/**
 * Roll dice in JavaScript or TypeScript.
 * A formula parser and one roll() over a CSPRNG with modulo-bias rejection.
 */

export { cryptoRandom, rollDie, type RandomSource } from './rng.ts'

export {
  parseFormula,
  type AdvantageState,
  type DiceTerm,
  type FlatTerm,
  type Formula,
  type ParseOptions,
  type Term,
} from './formula.ts'

export {
  soleDieGroup,
  keptFlags,
  roll,
  type DieGroup,
  type RollContext,
  type RollResult,
} from './roll.ts'
