# Contributing

Thanks for wanting to help. Bug reports, ideas and pull requests are all welcome.

## The one rule

**This library rolls dice and reports what happened. It does not know your game's rules.**

Every contribution is measured against that. A change is in scope if it is about _dice_ —
a way of rolling them, or a fact about what they landed on. It is out of scope if it
decides what a result _means_.

| In scope                                           | Out of scope                                       |
| -------------------------------------------------- | -------------------------------------------------- |
| A new way to roll (exploding, rerolls, thresholds) | Critical hits, damage doubling, degrees of success |
| Reporting what the dice showed                     | Deciding whether that is good or bad               |
| Making a result easier to display                  | Character sheets, conditions, spells, initiative   |

Earlier versions had roll "kinds" and critical-hit rules in them. They came out before the
first release, because a dice library that knows what a saving throw is has stopped being a
dice library. Please don't put them back.

If you think something is a borderline case, open an issue before writing code — it is much
easier to talk about than to un-merge.

## Getting set up

You need Node 20 or newer.

```bash
npm install
npm test
```

Other things you can run:

```bash
npm run typecheck   # tsc, no output
npm run build       # compile to dist/
npx prettier --write .
```

CI runs all four on every pull request, so run them before you push.

## Writing code

- **Every named function opens with a one-line comment saying what it does.** In
  TypeScript that means a one-line JSDoc, so editors show it on hover.
- **No other comments unless the code cannot say it itself.** A non-obvious _why_, a
  gotcha, or a reason a thing is deliberately absent earns a comment. Narrating the next
  line does not.
- **Match the file you are in** — naming, style, comment density.
- Prettier decides formatting. Don't hand-align anything.

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

The randomness itself is the one place a change can pass its tests and still be wrong.
If you touch `rng.ts`, say in the pull request why the change keeps every face equally
likely.

## The README is documentation, not decoration

If you change behaviour, change the README in the same pull request — and **run the
examples you write**. Several errors have already been caught that way: a field that did
not exist, and a sample result that could not have happened. An example nobody ran is a
guess.

## Commits

- One concern per commit.
- The subject line says what changed, in the imperative: `Add exploding dice`.
- The body explains _why_, in prose.
- **Sign off** with `git commit -s`. That adds a `Signed-off-by:` line certifying you have
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
