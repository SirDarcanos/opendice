# Changelog

Notable changes to `@openfray/dice`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html): anything that changes the
public API is a major version, and the `breaking` label on GitHub marks issues and pull
requests that would.

## [Unreleased]

Nothing yet.

## [1.0.0] — 2026-08-04

First release.

### Added

- `roll(formula, options?)` — parses a formula, rolls it, and returns the total along with
  every die rolled, which of them counted, and each flat modifier separately.
- A formula grammar: `2d6`, `1d20+7`, `10-1d4`, `1d8+1d4+3`, keep highest or lowest
  (`4d6kh3`, `4d6kl3`), advantage and disadvantage (`1d20adv`, `1d20dis`), exploding dice
  (`1d6!`), and an optional trailing label (`2d10 fire`).
- Any number of sides. `1d78` is as valid as `1d20`.
- `naturalHigh` and `naturalLow` on each group of dice, reporting whether the single die it
  kept landed on its highest or lowest face — for any die, not only a d20.
- `parseFormula(text, options?)` — reads a formula without rolling it, for checking input
  before it is used.
- `rollDie(sides, source?)` — one die, no formula.
- `cryptoRandom()` — the underlying random source, exported so it can be inspected.
- `keptFlags(group)` — which dice counted, aligned to the order they were rolled.
- `soleDieGroup(result)` — the one group of dice in a roll, when a roll used only one kind.
- A `rand` option taking any `RandomSource`, so rolls can be made deterministic in tests.
- TypeScript types, source maps, and npm provenance on every published release.

[unreleased]: https://github.com/OpenFrayApp/dice/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/OpenFrayApp/dice/releases/tag/v1.0.0
