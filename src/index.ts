// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

/**
 * Honest dice for d20 systems: a formula parser, a CSPRNG with modulo-bias rejection,
 * and one `roll()` that reports every die it kept and every die it dropped.
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
