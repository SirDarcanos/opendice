# Changelog

Notable changes to `opendice`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html): anything that changes the
public API is a major version, and the `breaking` label on GitHub marks issues and pull
requests that would.

## The name

This package was `@openfray/dice` up to and including 1.1.0, and is `opendice` from 1.1.0
onward — `opendice@1.1.0` carries the same code as `@openfray/dice@1.1.0`. The old name
stays on npm, deprecated, so nothing that depends on it breaks.

```bash
npm uninstall @openfray/dice && npm install opendice
```

Every import changes with it: `from '@openfray/dice'` becomes `from 'opendice'`.

A rename is not a version, so it has no entry below.

## [Unreleased]

Reserved for 2.0.0 because `DieGroup` gains required result fields. No release is being cut yet.

### Added

- Every dice group now reports `keptFlags`, one boolean per entry in `results`. The markers
  preserve which occurrence counted when a die and a bound recorded the same number.
  `results` and `kept` keep their existing contents and order.

### Changed

- Advantage state now belongs to each dice group. `DieGroup.advantageState` is required and
  `RollResult.advantageState` has been removed, so a formula containing both `adv` and `dis`
  keeps both facts instead of whichever group was evaluated last. Equivalent `kh` and `kl`
  keep rules report `normal` because they were not explicitly described as advantage or
  disadvantage.
- Contextual advantage and disadvantage now read the sole dice group in the original
  formula, whatever its number of sides, and require its written count to be at least 2.
  Several groups, a conflicting written state, a keep rule, a bound or an explosion throw
  instead of making the target depend on search order. A matching written state passes
  unchanged. Bonus dice groups are appended afterward, and `normal` remains a universal
  no-op. Invalid JavaScript context values now throw instead of being treated as
  disadvantage.
- `adv` and `dis` now require a written dice count of at least 2. `1d20adv` and `d20dis`
  throw instead of silently rolling two dice and warning; write `2d20adv` and `2d20dis`.
  `RollContext.advantage` follows the same count rule rather than adding a die.
- A dice formula may inspect at most 100 recognised tag entries. Entries must be lowercase
  words the grammar can produce, and duplicates count towards the limit. The 1,000-character
  formula limit now counts outer spaces instead of trimming unbounded padding first.

### Fixed

- Every number parsed from a formula must now remain an exact whole number. Oversized
  maximum bounds and keep counts could previously survive because they did not raise the
  total; a maximum could put `Infinity` into `results`, which JSON serialised as `null`.
- `keptFlags(group)` now reads the markers recorded during the roll instead of matching
  equal numbers afterward. It previously marked the wrong entries when equal values from
  different per-die or total bounds did not share the same outcome. Existing calls keep
  working, and old objects without recorded markers retain the former best-effort matching.

## [1.4.0] — 2026-08-22

Two more ways to read dice, and a README that stops repeating the documentation site.

### Added

- `kh` and `kl` with no number after them keep one die, so `3d100kh` is `3d100kh1`. The
  count was mandatory and a bare `kh` was a parse error, which no reading of the formula
  explained. `4d6kh0` still throws: leaving the number out is not writing zero.
- Floors and ceilings. `2d6min3` gives every die a value it has to beat and `2d6max5` one
  it may not pass; `totalmin` and `totalmax` set the bound against the group's total
  instead. The bound goes into `results` as a value the dice competed against rather than
  rewriting a face, so nothing rolled is lost and `total` can still be checked against
  `kept`. A group that kept a bound reports no highest or lowest face, since a bound is not
  a die. A bound must be at least 1, and does not combine with `kh`, `kl`, `adv`, `dis` or
  `!`.

### Changed

- The README is the short version and [rollful.dev/docs](https://rollful.dev/docs) is the
  reference. Keeping a full second copy of the documentation in the README meant two places
  to update and one of them going stale. Nothing about the package changed with it.

## [1.3.0] — 2026-08-06

The count written in front of `adv` and `dis` is now the count that gets rolled.

### Changed

- `adv` and `dis` no longer overwrite the count they were written with. The suffix says
  which one die survives, and the count says how many are thrown, so `4d20adv` rolls four
  d20 and keeps the highest. It used to roll two whatever the formula asked for: `4d20adv`
  was `2d20kh1`, and the `4` was discarded without a word.

### Deprecated

- A count of 1 with `adv` or `dis`. `1d20adv` still rolls, and still rolls two dice, but it
  now warns once per suffix that `2d20adv` is the formula it means. One die leaves the
  suffix nothing to choose between, so the count cannot be taken at face value. A future
  version will refuse it. The migration is mechanical: every `1d20adv` becomes `2d20adv`.

  The warning goes to `console.warn`, once per process per suffix rather than per roll. Note
  that `formula` on the result stays exactly as you wrote it, so a roll log built from it
  will show `1d20adv` beside two dice until the formula is fixed.

The `advantage` option in `RollContext` is unchanged, warns nothing, and still takes a plain
`1d20`: `roll('1d20+7', { advantage: 'advantage' })` rolls the second die for you. The option
applies advantage to a formula already written, where the suffix states the dice up front. A
formula already asking for more than two d20 now keeps its own count instead of being cut
back to two.

## [1.2.0] — 2026-08-06

A way of rolling dice that was missing, and a packaging fault that made the published
source maps useless.

### Added

- Penetrating dice: `1d6!p` explodes on a top face like `1d6!`, but every roll after the
  first counts 1 less. HackMaster uses this. The deduction comes off what a roll is worth
  and not off the face it landed on, so it never shortens a chain — a second roll showing a
  6 on a d6 is recorded as 5 and still rolls again. Only the extra rolls lose a point, so
  `1d6!p` is not `1d6!` minus 1, and a penetrated 1 is recorded as 0, the one case where
  `results` holds a number below 1. It takes a multiplier (`1d6!px2`), and carries the same
  two limits as `!`: 100 penetrations per die, and no combining with `kh`, `kl`, `adv` or
  `dis`. `DieGroup` is unchanged, so `kept` still sums to `total`; `DiceTerm` gained
  `penetrate`, set alongside `explode` rather than replacing it, so anything already
  reading `explode` keeps working.

### Fixed

- The published package includes `src`, so the source maps in it point at files that are
  there. Every `.js.map` and `.d.ts.map` names `../src/*.ts`, and `files` listed only
  `dist`, `README.md` and `LICENSE`, so the sources were left out of the tarball — a
  bundler reading them warned that the sourcemap for each of the four modules points to
  missing source files. It also makes the declaration maps work: go to definition on `roll`
  now opens `roll.ts` rather than the generated `roll.d.ts`.

## [1.1.0] — 2026-08-04

Hardening after an adversarial review of the package, and a group multiplier.

Several entries below are marked **Breaking**: they refuse input that 1.0.0 accepted. None
of it is input a working caller was likely to be sending on purpose, but read those entries
before upgrading — `tags: 'fire'`, `roll('2+5')`, `1d0`, a formula containing a tab or a
line break, and a `bonuses` fragment with no dice in it all throw now.

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
- `crypto.getRandomValues` is taken once as the module loads rather than looked up on every
  call. Anything else sharing the page — an analytics tag, a dependency further down the
  bundle — could replace it and own every roll from then on, reported by a roll log that
  still looked honest. This closes the window after load; nothing in JavaScript can close
  the one before it.
- `rollDie` names the type of a non-number instead of repeating it. TypeScript says
  `number`, but a JavaScript caller is not bound by that, and the message is as likely to be
  shown to someone as any other. `parseFormula` refuses non-text input the same way, rather
  than failing with `input.trim is not a function`.
- `bonuses` is capped at 100 entries. Every entry is parsed before the dice limit can refuse
  the roll, so a million of them burned about 2.4 seconds whatever they added up to.
- The publish workflow pins npm instead of installing `@latest` beside the OIDC credential.
- An error no longer repeats the input word for word. `roll('<img src=x onerror=…>')` threw
  an `Error` whose message carried that markup verbatim and twice — and a caller putting the
  message on a page, which is what an error about typed input is for, would have put the
  markup on the page with it. What is quoted is now shortened, and anything a formula could
  not contain is replaced. Escaping what you display is still the caller's job.

### Added

- A group multiplier: `1d6x10` rolls a d6 and multiplies that group by ten, and `2d6x3`
  adds both dice then triples them. It binds to one dice group the way `kh3` does, so it
  never applies to the whole sum and there is no precedence to get wrong — `1d6x10+5` is 35
  on a 3, not 80. It composes with keep rules, advantage and exploding, always applying last
  to whatever the group kept. `5x2` is not a formula: this multiplies dice, not arithmetic.
  `DieGroup` gained `multiplier`, so a total can still be checked against `kept`.

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

[unreleased]: https://github.com/SirDarcanos/opendice/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/SirDarcanos/opendice/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/SirDarcanos/opendice/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/SirDarcanos/opendice/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/SirDarcanos/opendice/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SirDarcanos/opendice/releases/tag/v1.0.0
