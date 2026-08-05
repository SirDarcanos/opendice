# Contributing

Bug reports, ideas and pull requests are welcome.

## The one rule

**This library rolls dice and reports what happened. It does not know your game's rules.**

A change is in scope if it is about dice — a way of rolling them, or a fact about what they
landed on. It is out of scope if it decides what a result means.

| In scope                                           | Out of scope                                       |
| -------------------------------------------------- | -------------------------------------------------- |
| A new way to roll (exploding, rerolls, thresholds) | Critical hits, damage doubling, degrees of success |
| Reporting what the dice showed                     | Deciding whether that is good or bad               |
| Making a result easier to display                  | Character sheets, conditions, spells, initiative   |

Roll "kinds" and critical-hit rules were both in earlier versions and were removed before
the first release. Please do not put them back.

For a borderline case, open an issue before writing code.

## Setup

Node 20 or newer.

```bash
npm install
npm test
```

| Command                  | What it does       |
| ------------------------ | ------------------ |
| `npm test`               | Run the suite      |
| `npm run typecheck`      | `tsc`, no output   |
| `npm run build`          | Compile to `dist/` |
| `npx prettier --write .` | Format everything  |

CI runs all four on every pull request. Run them before pushing.

## Writing code

- **Every named function opens with a one-line JSDoc** saying what it does, so editors show
  it on hover.
- **No other comments unless the code cannot say it itself.** A non-obvious why, a gotcha,
  or a reason something is deliberately absent earns one. Narrating the next line does not.
- **Match the file you are in** — naming, style, comment density.
- Prettier decides formatting. Do not hand-align anything.

## Tests

Everything testable ships with tests, and a change in behaviour updates its tests in the
same commit. Tests live in `tests/`, mirroring `src/`.

Use the `rand` option to make rolls deterministic rather than testing distributions:

```ts
const faces =
  (...list: number[]) =>
  () =>
    list.shift()! - 1

roll('2d6+3', { rand: faces(5, 3) }).total // 11, every time
```

The randomness is the one place a change can pass its tests and still be wrong. If you
touch `rng.ts`, say in the pull request why the change keeps every face equally likely.
[`AGENTS.md`](./AGENTS.md) explains what the tests there do and do not catch.

## Documentation

If you change behaviour, change the README in the same pull request, and **run the examples
you write** against the built package. Errors caught that way already: a field that did not
exist, and a sample result that could not have happened.

## Commits

- One concern per commit.
- Subject line in the imperative: `Add exploding dice`.
- The body explains why.
- **Sign off** with `git commit -s`, which adds a `Signed-off-by:` line certifying you have
  the right to submit the code under this licence. There is no CLA.

## Releases

Maintainers only:

1. Bump `version` in `package.json` and add a section to `CHANGELOG.md`.
2. Merge to `main`.
3. Draft a GitHub release tagged `v<version>` and publish it.

The publish workflow refuses to run if the tag and `package.json` disagree, then publishes
to npm with provenance.

## Licence

MIT. By contributing you agree your contributions are licensed under the same terms.
