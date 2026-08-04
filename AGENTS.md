# Guidance for AI agents (and humans)

Read this before writing code here. [`CONTRIBUTING.md`](./CONTRIBUTING.md) covers setup,
style, tests and releases; this file covers the decisions that are easy to undo by
accident.

## What this package is

A dice roller. It parses a formula, rolls it fairly, and reports what the dice did.

It is published as `@openfray/dice` (MIT) and it is the engine
[OpenFray](https://openfray.app) rolls on. OpenFray is AGPL; this is not, because the dice
are not the product and are worth more reusable than protected.

## The line, and why it keeps moving back

> **The dice report what happened. The game decides what it means.**

This is the whole design. It is also the thing that erodes, because almost every useful
addition can be argued for as "just a bit of dice logic".

The first version of this package had `RollKind` (`'attack' | 'save' | 'check'`) and
`CritRule` (including `max-plus-roll`, one table's house rule out of OpenFray's campaign
settings). Both came out before release. Three rules fell out of that, and each has already
been re-litigated once:

1. **No roll "kind".** There is no field saying what a roll was _for_. One was proposed as
   a passthrough label the library never reads — rejected, because a field that is ignored
   is worse than no field: it looks like it does something, and someone will set it
   expecting behaviour.
2. **Facts, not rulings.** `naturalHigh` says the kept die showed its top face. It does not
   say "critical hit", it is not gated behind declaring the roll an attack, and it works on
   a d78 as readily as a d20. If a proposal needs the library to decide whether something
   is _good_, it belongs in the caller.
3. **Labels are the caller's.** `2d10 fire` only parses if the caller passed `fire` in
   `tags`. The library knows a formula _can_ end in a label and nothing about which are
   real. An unrecognised word throws rather than being swallowed, because at the end of a
   formula a stray word is usually a typo.

Exploding dice (`1d6!`) are in, and are the example of what _does_ belong: a way of rolling
dice, not a rule about what a roll means.

## The randomness is load-bearing

`src/rng.ts` is the reason anyone would trust this package. Two rules:

- **CSPRNG plus modulo-bias rejection, one draw per die.** Never `Math.random`, never
  derive several dice from one number, never skip the rejection loop because the skew is
  small.
- **Never add "anti-streak" or "feels-fair" logic.** Not as an option, not off by default.
  Suppressing repeats is more detectably rigged over time than honest clumping, and it
  would make any record of the rolls a lie.
- **Every loop that redraws has a bound.** The rejection loop gives up after 1000 rejections
  in a row and throws. Every die accepts more than half of all draws, so a working source
  never comes close; a source that returns one rejected value forever would otherwise spin
  the process to a halt, which it did until it was bounded.

`rand` is the one hole nothing here can close: a `RollResult` records what the dice showed
and never which source produced it, so a rigged source is indistinguishable from the CSPRNG
in the output. That is documented rather than fixed — an attestation field would be a claim
the library cannot check. Callers must not let untrusted code choose `rand`.

A change here can pass every test and still be wrong. If you touch it, reason about it
explicitly in the pull request.

## Things that bite

- **`explode` cannot combine with `kh`/`kl`/`adv`/`dis`.** The grammar treats the suffixes
  as alternatives, so `4d6kh3!` throws. That is deliberate: "keep the highest three" has no
  obvious meaning once each die is an open-ended chain. Don't "fix" it without deciding
  what it should mean.
- **A die explodes at most 100 times**, so `results` can hold 101 entries — the first roll
  plus 100 explosions. A die of fewer than two sides never explodes. Both exist so a loaded
  `RandomSource` cannot hang the process — not because a fair die might reach them.
- **A formula is untrusted input, and every part of it that drives work is bounded**: 1000
  dice per roll counting bonuses, 2³² sides per die, 1000 characters per formula. Each was
  an unbounded loop or allocation before. The sides bound is not a taste call — above 2³²
  the rejection ceiling rounds down to zero and `rollDie` never returns.
- **Optional fields are read through `ownProperties`.** Absence is how `keep`, `explode`,
  `advantage`, `tag` and every `RollContext` option are read, and a plain `{}` inherits from
  `Object.prototype` — so without it, anything able to pollute that prototype could pick the
  random source or forge a tag, and the roll log would report the forgery as fact. Anything
  the library both creates and later reads an optional field from must go through it.
- **`results` is flat.** An exploding group's `results` holds every roll it made, so it can
  be longer than the die count. The chain is still readable: a roll equal to `sides` is
  what caused the next one.
- **`soleDieGroup` counts groups, not dice.** `2d6+3` has one group; `1d20+1d6` has two and
  returns nothing.

## Verify prose the way you verify code

The most common defect in this repo's history is not a bug — it is a **README sentence
that was never run**. Already caught: a `sign` field documented on a type that has none, a
sample result claiming a natural 20 for a roll that kept a 17, and a bullet saying the
library "doesn't decide advantage for you" directly above the option that decides it.

So: after changing behaviour or documentation, **run every example against the built
package**, not against the source.

```bash
npm run build
node --input-type=module -e "import { roll } from './dist/index.js'; …"
```

Claims about behaviour deserve the same treatment as code blocks. If you cannot run it,
don't assert it.

## Writing style

The README is for someone who has never used this and is not necessarily a programmer by
trade. Plain language, short sentences, every term explained before it is used. Jargon
dropped in without explanation is a bug — `parseFormula` and "exploding dice" both shipped
that way once and had to be fixed.

Keep the game framing out of it too. No players, characters, spells or damage types: this
is a dice library, and someone may well be using it for something that is not a game.
