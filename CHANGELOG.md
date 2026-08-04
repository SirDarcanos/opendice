# Changelog

Notable changes to `@openfray/dice`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html): anything that changes the
public API is a major version, and the `breaking` label on GitHub marks issues and pull
requests that would.

## [Unreleased]

Hardening after an adversarial review of the package. Some of it changes the public API, so
the next release is a major version.

### Security

- A formula can no longer hang the process. `1d4294967297` used to spin forever — above 2³²
  sides the rejection ceiling rounds down to zero, so every draw was rejected — and
  `99999999d6` rolled dice one at a time until the process ran out of memory. A formula is
  bounded to 1,000 dice, 2³² sides per die and 1,000 characters, and bonuses count towards
  the dice limit.
- `rollDie` gives up after 1,000 rejected draws in a row rather than redrawing forever. A
  `RandomSource` returning a value the die always rejects used to hang, which is exactly
  what the explosion cap exists to prevent — rejection just happens first.
- Options and terms are read as own properties. A polluted `Object.prototype` could
  otherwise supply the `rand` source for a roll that passed none, force advantage, add
  bonuses, or forge a `tag` on the result — with the roll reporting all of it as fact.
- Parsing no longer slows down quadratically on a formula padded with whitespace.
- A formula may only contain letters, digits, spaces, `+`, `-` and `!`. Whitespace is
  stripped before a formula is read but `formula` keeps the text verbatim, so a tab, a line
  break, a non-breaking space, U+2028 or a zero-width space all used to ride through into
  `RollResult.formula` — and a line break there forges an extra line in whatever log or CSV
  row the caller writes the roll to, which is the one artifact this package exists to make
  trustworthy. Twenty-five code points could do it, U+212A among them: it lowercases to a
  plain `k`, so `4d6Kh3` parsed and left the sign in `formula`.
- An error no longer repeats the input word for word. `roll('<img src=x onerror=…>')` threw
  an `Error` whose message carried that markup verbatim and twice — and a caller putting the
  message on a page, which is what an error about typed input is for, would have put the
  markup on the page with it. What is quoted is now shortened, and anything a formula could
  not contain is replaced. Escaping what you display is still the caller's job.

### Fixed

- A total that cannot be exact is refused instead of quietly rounded. `1d6+99999999999999999999`
  reported a rounded number and `1d6+` followed by four hundred nines reported `Infinity`.
- A numeric `bonuses` entry must be a whole number that stays exact. `NaN`, an infinity and
  `1.5` used to pass straight through into the total.
- `4d6kh0` is refused rather than keeping no dice and contributing nothing.
- **Breaking:** a formula must roll at least one die. `roll('2+5')` answered 7 and
  `roll('0d6')` answered 0, both handing back a total with an empty `dice` list behind it.
  `parseFormula` is the documented way to check what someone typed, so it is what refuses
  them — which also means a `bonuses` fragment has to contain dice, and a plain number
  should be passed as a number.

### Changed

- **Breaking:** `tags` takes a list or a `Set`, and a bare string is now refused. A string
  is an iterable of single letters, so `tags: 'fire'` used to quietly accept `f`, `i`, `r`
  and `e`. TypeScript rejects it too.
- **Breaking:** `parseFormula` rejects a die with no sides (`1d0`) and one with more sides
  than a single draw can address, rather than parsing it and failing later at roll time.
  Checking a formula now catches everything rolling it would.
- `parseFormula` and `roll` return objects with no prototype. Reading, spreading and
  `JSON.stringify` are unchanged; `console.log` labels them `[Object: null prototype]`.

### Documented

- A rigged `rand` produces a result identical to a fair one — nothing records which source
  a roll used. Only pass a source your own code chooses.

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
