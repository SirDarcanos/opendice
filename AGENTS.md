# Guidance for AI agents (and humans)

Read this before writing code here. [`CONTRIBUTING.md`](./CONTRIBUTING.md) covers setup,
style, tests and releases. This file covers the decisions that are easy to undo by
accident.

## What this package is

A dice roller. It parses a formula, rolls it fairly, and reports what the dice did.

Published as `opendice` under MIT. It is the engine [OpenFray](https://openfray.app) rolls
on; OpenFray is AGPL, this is not, because the dice are worth more reusable than protected.

## The line

> **The dice report what happened. The game decides what it means.**

Almost every useful addition can be argued for as "just a bit of dice logic", so this
erodes unless it is defended. Version 1 shipped without `RollKind`
(`'attack' | 'save' | 'check'`) and `CritRule`, both of which were removed before release.
Three rules came out of that, each already re-litigated once:

1. **No roll "kind".** No field says what a roll was for. A passthrough label the library
   never reads was proposed and rejected: a field that is ignored looks like it does
   something, and someone will set it expecting behaviour.
2. **Facts, not rulings.** `naturalHigh` says the kept die showed its top face. It does not
   say "critical hit", is not gated behind declaring the roll an attack, and works on a d78
   as readily as a d20. A proposal that needs the library to decide whether something is
   _good_ belongs in the caller.
3. **Labels are the caller's.** `2d10 fire` parses only if the caller passed `fire` in
   `tags`. An unrecognised word throws rather than being carried, because a stray word at
   the end of a formula is usually a typo.

Exploding dice (`1d6!`) are in, and are the example of what belongs: a way of rolling dice,
not a rule about what a roll means.

Penetrating dice (`1d6!p`) are in on the same grounds, and are the harder case: the −1 on
each extra roll looks like a ruling but is part of how the die is rolled, the way keeping
the highest three is. The test it passes is that nothing has to be known about the roll's
purpose to apply it. A penalty that depended on what the roll was for would not.

An explode threshold (`1d6!p>5`) was asked for alongside it and deferred — open, not
settled. Three things have to be decided together before anyone writes it:

- **`>` is not in the character allowlist**, and that allowlist is a security boundary
  rather than a grammar convenience. See the `source` entry under "Things that bite".
- **It belongs to `!` as much as to `!p`.** Shipping `1d6!p>5` while `1d6!>5` throws leaves
  a difference nobody can explain.
- **`>5` reads as "5 or more", not "more than 5".** Under the literal sign `1d6!p>5` is
  just `1d6!p` on a d6, which makes the obvious worked example a no-op. A grammar whose
  own example does nothing is the wrong grammar, so the sign is what should give way.

A group multiplier (`1d6x10`) is in on the same grounds. Two decisions about it were argued
and settled, and both will come back:

- **No division.** `1d20/3` needs a rounding rule, and down, to nearest, or in whose favour
  are all somebody's house rule. It would also give up whole-number totals, which the
  exactness check depends on.
- **No `*`, no brackets.** A multiplier binds to one dice group the way `kh3` does, so
  `1d6x10+5` can only be 35. General arithmetic needs precedence, and `1d20+3*2` would be
  silently wrong for whichever half of callers meant the other reading. It would also cost
  the flat-sum result model that `modifier`, `modifiers` and `DieGroup.sign` are built on.

## The randomness is load-bearing

`src/rng.ts` is the reason to trust this package.

- **CSPRNG plus modulo-bias rejection, one draw per die.** Never `Math.random`, never derive
  several dice from one number, never skip the rejection loop because the skew is small.
- **Never add "anti-streak" or "feels-fair" logic**, as an option or otherwise. Suppressing
  repeats is more detectably rigged over time than honest clumping, and it would make any
  record of the rolls inaccurate.
- **Every redraw loop has a bound.** The rejection loop throws after 1,000 rejections in a
  row. Every die accepts more than half of all draws, so a working source never approaches
  it; a source returning one rejected value forever used to spin the process to a halt.
- **The default source is exercised on purpose.** Every other test hands `rollDie` its own
  source, so for a long time the source real callers get was only checked for staying in
  range. Code reading `rand === cryptoRandom` could behave one way under test and another in
  production with the suite agreeing — a planted backdoor doing exactly that passed all 109
  tests. The chi-square tests over the default source close that. They catch a face nudged
  as often as one draw in a hundred; **they do not catch one in a thousand**, and no test
  that finishes in reasonable time will. A change to this file has to be read, not handed
  to CI.
- **`crypto.getRandomValues` is bound once, as the module loads.** Looked up per call it can
  be swapped by anything else sharing the page, and every roll after that is theirs with a
  roll log that still looks honest. Keep the binding at module scope.

`rand` is the one hole nothing here can close: a `RollResult` records what the dice showed
and never which source produced it, so a rigged source is indistinguishable from the CSPRNG
in the output. That is documented rather than fixed — an attestation field would be a claim
the library cannot check. Callers must not let untrusted code choose `rand`.

A change here can pass every test and still be wrong. Reason about it explicitly in the pull
request.

## Things that bite

- **`explode` cannot combine with `kh`/`kl`/`adv`/`dis`.** The grammar treats the suffixes as
  alternatives, so `4d6kh3!` and `4d6kh3!p` both throw. Do not "fix" it without first
  deciding what "keep the highest three" should mean when each die is an open-ended chain.
- **A die explodes at most 100 times**, so `results` can hold 101 entries. A die of fewer
  than two sides never explodes. Both bounds exist so a loaded `RandomSource` cannot hang the
  process, not because a fair die might reach them.
- **`source` is the caller's text, kept verbatim, so the parser polices what may be in it.**
  Whitespace is stripped before a formula is read, which once let a tab or a line break
  through into `RollResult.formula` and forge a line in a caller's roll log. The character
  allowlist is what stops that, not the grammar — widening it widens what a roll log can be
  made to say.
- **A formula is untrusted input, and everything in it that drives work is bounded**: 1,000
  dice per roll including bonuses, 2³² sides per die, 1,000 characters per formula. Each was
  an unbounded loop or allocation before. The sides bound is not a taste call — above 2³² the
  rejection ceiling rounds down to zero and `rollDie` never returns.
- **Optional fields are read through `ownProperties`.** Absence is how `keep`, `explode`,
  `advantage`, `tag` and every `RollContext` option are read, and a plain `{}` inherits from
  `Object.prototype`. Without it, anything able to pollute that prototype could pick the
  random source or forge a tag, and the roll log would report the forgery as fact. Anything
  the library both creates and later reads an optional field from goes through it.
- **`results` is flat.** An exploding group's `results` holds every roll it made, so it can
  be longer than the die count. A roll equal to `sides` is what caused the next one.
- **Penetrating records what a roll was worth, not the face it showed.** `!p` stores every
  roll after the first as one less, so `kept` still sums to `total` and a caller can check
  the arithmetic — but a recorded 5 on a d6 was a 6, which is why the chain continues on
  the face and not on the number stored. Reading a chain back is still exact: the first
  roll continued at `sides`, every later one at `sides - 1`. Moving the deduction into a
  separate field would keep `results` raw at the cost of that check, and was not taken.
  A penetrated 1 stores 0, the only 0 `results` can hold.
- **`soleDieGroup` counts groups, not dice.** `2d6+3` has one group; `1d20+1d6` has two and
  returns nothing.

## Verify prose the way you verify code

The most common defect in this repo's history is a README sentence that was never run.
Already caught: a `sign` field documented on a type that has none, a sample result claiming
a natural 20 for a roll that kept a 17, and a bullet saying the library "doesn't decide
advantage for you" directly above the option that decides it.

After changing behaviour or documentation, run every example against the built package, not
against the source:

```bash
npm run build
node --input-type=module -e "import { roll } from './dist/index.js'; …"
```

Claims about behaviour get the same treatment as code blocks. If you cannot run it, do not
assert it.

## Writing style

The README is for someone who has never used this and is not necessarily a programmer by
trade. Plain language, short sentences, every term explained before it is used. Jargon
dropped in without explanation is a bug — `parseFormula` and "exploding dice" both shipped
that way once.

It is reference, not narrative: say what a function does, what it returns, and what it
refuses. A reason earns its place when it tells the reader what to do differently;
otherwise it is padding.

Keep the game framing out of it. No players, characters, spells or damage types — this is a
dice library, and it may well be rolling for something that is not a game.
