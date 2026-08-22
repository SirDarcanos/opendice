# opendice

[![NPM](https://nodei.co/npm/opendice.svg?style=shields&data=n,v,u,d&color=blue)](https://www.npmjs.com/package/opendice)

Roll dice in JavaScript or TypeScript. Write `2d6+3`, get the total back along with every
die that was rolled.

The randomness comes from the platform's cryptographic random number generator, with
modulo bias removed. Nothing here adjusts a result, and nothing here decides what one
means.

**[rollful.dev/docs](https://rollful.dev/docs) is the reference** — every suffix, every
result field, every limit, and the HTTP API. This file is the short version.

MIT licence · no dependencies · browser and Node 20 or newer

## Install

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/package/opendice).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 20 or higher is required.

Installation is done using the
[`npm install` command](https://docs.npmjs.com/downloading-and-installing-packages-locally):

```bash
npm install opendice
```

pnpm and yarn work the same way. There are no dependencies and no build step: the package
ships as ES modules with TypeScript types.

## Quick start

```ts
import { roll } from 'opendice'

const result = roll('2d6+3')

result.total // 11
```

`roll()` takes a formula as text and returns an object. `total` is the number; the rest
describes how it was reached.

```ts
result.dice[0].results // [5, 3]  — the two dice that were rolled
result.dice[0].kept //    [5, 3]  — the ones that counted
result.modifier //        3       — the +3
result.formula //         '2d6+3' — what you asked for
```

Anything a formula cannot mean throws, so text somebody typed is safe to hand straight to
it.

## The formula language

| You write      | It means                                                 |
| -------------- | -------------------------------------------------------- |
| `2d6`          | Roll two six-sided dice and add them up.                 |
| `1d20+7`       | Roll a d20 and add 7. Use `-7` to subtract.              |
| `1d8+1d4+3`    | Mix as many dice and numbers as you like.                |
| `4d6kh3`       | Roll four d6, **k**eep the **h**ighest **3**.            |
| `4d6kl3`       | Same, but keep the **l**owest 3.                         |
| `4d6kh`        | Leave the number out and it keeps 1.                     |
| `2d20adv`      | Roll two d20 and keep the higher one. ("advantage")      |
| `2d20dis`      | Roll two d20 and keep the lower one. ("disadvantage")    |
| `2d6min3`      | Every die counts at least 3. `max` caps instead.         |
| `2d6totalmin3` | The dice **added up** count at least 3. `totalmax` caps. |
| `1d6!`         | Exploding: a top face rolls again and adds.              |
| `1d6!p`        | Penetrating: as `!`, but each extra roll counts 1 less.  |
| `1d6x10`       | Roll a d6, multiply that group by 10.                    |
| `2d10 fire`    | A label on the end, if you passed `fire` in `tags`.      |

Spaces are ignored and capitals are accepted: `2D6 + 3` works. A suffix binds to its own
group of dice, never to the whole sum: a `1d6x10+5` that rolled a 3 is 35 and not 55, and
`2d6totalmin8+1` is never below 9 rather than never below 8.

Full grammar, including which suffixes combine and which do not, at
**[rollful.dev/docs/reference/grammar](https://rollful.dev/docs/reference/grammar)**.

## API

| Function                    | What it does                                           |
| --------------------------- | ------------------------------------------------------ |
| `roll(formula, options?)`   | Rolls a formula and returns the result                 |
| `parseFormula(text, opts?)` | Reads a formula without rolling it, for checking input |
| `rollDie(sides, source?)`   | Rolls one die and returns a number                     |
| `cryptoRandom()`            | The raw random number the dice are built on            |
| `keptFlags(group)`          | Which dice counted, aligned to the roll order          |
| `soleDieGroup(result)`      | The dice in a result, if it used only one kind         |

Every signature, option and result field at
**[rollful.dev/docs/reference/package](https://rollful.dev/docs/reference/package)**.

## Documentation

| Page                                                                                   | What it covers                                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Roll dice in JavaScript](https://rollful.dev/docs)                                    | Start here                                      |
| [The formula grammar](https://rollful.dev/docs/reference/grammar)                      | Every suffix, and which ones combine            |
| [Result fields](https://rollful.dev/docs/reference/results)                            | Everything a roll reports, and what it does not |
| [Limits](https://rollful.dev/docs/reference/limits)                                    | What a formula may ask for before it is refused |
| [Errors](https://rollful.dev/docs/reference/errors)                                    | What throws, and what each message says         |
| [The package](https://rollful.dev/docs/reference/package)                              | Exports, types, module format                   |
| [Versioning](https://rollful.dev/docs/reference/versioning)                            | What a major version means here                 |
| [Validate a formula someone typed](https://rollful.dev/docs/guides/validate-a-formula) | Checking input before you roll it               |
| [Show the working in a UI](https://rollful.dev/docs/guides/show-the-working)           | Dimming the dice that were dropped              |
| [Survive the limits](https://rollful.dev/docs/guides/limits-and-failures)              | Handling a formula the library refuses          |
| [Why every die comes back](https://rollful.dev/docs/explanation/showing-the-working)   | Why a result is a record, not just a number     |
| [What Rollful does not know](https://rollful.dev/docs/explanation/fairness)            | What the randomness can and cannot promise      |
| [Roll dice over HTTP](https://rollful.dev/docs/api)                                    | The same dice without installing anything       |

## The randomness

All of this applies to `roll()` by default. There is nothing to switch on.

- **`crypto.getRandomValues`, not `Math.random`.** The JavaScript standard permits
  `Math.random` to be low quality, and implementations differ.
- **Modulo bias is removed, not ignored.** Reducing a 32-bit number to a d6 naively makes
  some faces slightly likelier. Draws that would cause that are discarded and redrawn, so
  every face is exactly as likely as every other.
- **One draw per die.** Several dice are never derived from one number.
- **No result is ever adjusted.** There is no "you have rolled badly, here is a good one"
  logic, and there will not be. Dice come up 1 three times in a row sometimes; so do these.
  Smoothing that out would make any record of the rolls inaccurate.
- **The options you pass are read as you passed them**, so other code sharing the page
  cannot inject its own randomness, a label, or an extra die. The exception is `rand`, which
  replaces the randomness outright and is yours to guard.

The one thing it cannot promise, and why, at
**[rollful.dev/docs/explanation/fairness](https://rollful.dev/docs/explanation/fairness)**.

## What this library does not do

It has no rules of its own. It rolls dice and reports what happened. Whether a high roll is
good, what a label stands for, whether a total passes or fails — all of that is the
caller's.

## Where it came from

Extracted from [OpenFray](https://openfray.app), which routes every roll through one
function so randomness has a single place to live and be checked. Everything that knew
about OpenFray's subject matter was left behind. OpenFray is AGPL-3.0; these dice are MIT.

## Contributing

Any constructive contribution is welcome — a bug fix, a new way of rolling, a fix to the
documentation, a test, a typo.

Everything you need is in [CONTRIBUTING.md](./CONTRIBUTING.md): setup, the commands, the
code style, and what "done" means. [AGENTS.md](./AGENTS.md) covers the decisions that are
easy to undo by accident.

## Licence

MIT © Nicola Mustone — see [LICENSE](./LICENSE).
