# opendice

[![NPM](https://nodei.co/npm/opendice.svg?style=shields&data=n,v,u,d&color=blue)](https://www.npmjs.com/package/opendice)

Roll dice in JavaScript or TypeScript. Write `2d6+3`, get the total back along with every
die that was rolled.

The randomness comes from the platform's cryptographic random number generator, with
modulo bias removed. Nothing here adjusts a result.

MIT licence · no dependencies · browser and Node 20 or newer

```bash
npm install opendice
```

## Your first roll

```ts
import { roll } from 'opendice'

const result = roll('2d6+3')

result.total // 11
```

`roll()` takes a formula as text and returns an object. `total` is the number; the rest
describes how it was reached.

```ts
result.dice[0].results // [5, 3]  — the two dice that were rolled
result.modifier //        3       — the +3
result.formula //         '2d6+3' — what you asked for
```

## API

| Function                    | What it does                                           |
| --------------------------- | ------------------------------------------------------ |
| `roll(formula, options?)`   | Rolls a formula and returns the result                 |
| `parseFormula(text, opts?)` | Reads a formula without rolling it, for checking input |
| `rollDie(sides, source?)`   | Rolls one die and returns a number                     |
| `cryptoRandom()`            | The raw random number the dice are built on            |
| `keptFlags(group)`          | Which dice counted, aligned to the roll order          |
| `soleDieGroup(result)`      | The dice in a result, if it used only one kind         |

---

## `roll(formula, options?)`

```ts
roll('1d20') //      one twenty-sided die
roll('3d8') //       three eight-sided dice, added together
roll('1d20+5') //    one d20, plus 5
roll('2d6-1') //     two d6, minus 1
roll('1d78') //      any number of sides, not only the usual ones
```

### The formula language

| You write   | It means                                                                  |
| ----------- | ------------------------------------------------------------------------- |
| `2d6`       | Roll two six-sided dice and add them up.                                  |
| `1d20+7`    | Roll a d20 and add 7. Use `-7` to subtract.                               |
| `1d8+1d4+3` | Mix as many dice and numbers as you like.                                 |
| `4d6kh3`    | Roll four d6, **k**eep the **h**ighest **3**.                             |
| `4d6kl3`    | Same, but keep the **l**owest 3.                                          |
| `1d20adv`   | Roll two d20 and keep the higher one. ("advantage")                       |
| `1d20dis`   | Roll two d20 and keep the lower one. ("disadvantage")                     |
| `1d6!`      | Exploding — see [below](#exploding-dice).                                 |
| `1d6x10`    | Roll a d6, multiply that group by 10 — see [below](#multiplying-a-group). |
| `2d10 fire` | A label on the end. See [Labels](#labels) — it is never maths.            |

Spaces are ignored and capitals are accepted: `2D6 + 3` works.

### What you get back

```ts
const r = roll('1d20adv+5')
```

| Property         | Example       | Meaning                                        |
| ---------------- | ------------- | ---------------------------------------------- |
| `total`          | `22`          | The final number.                              |
| `dice`           | see below     | One entry per group of dice.                   |
| `modifier`       | `5`           | All the plain numbers added together.          |
| `modifiers`      | `[5]`         | Each plain number on its own.                  |
| `formula`        | `'1d20adv+5'` | What you passed in.                            |
| `advantageState` | `'advantage'` | `'normal'`, `'advantage'` or `'disadvantage'`. |
| `tag`            | `undefined`   | The label on the end, if there was one.        |

Each entry in `dice` describes one group:

```ts
r.dice[0]
// {
//   sides: 20,          the kind of die
//   results: [4, 17],   every die that was rolled
//   kept: [17],         the ones that counted toward the total
//   sign: 1,            1 for added, -1 for subtracted (as in '10-1d4')
//   multiplier: 1,      what the kept dice were multiplied by
//   total: 17,          what this group contributed
//   naturalHigh: false, the kept die showed the highest face — see below
//   naturalLow: false,  the kept die showed a 1
// }
```

`results` and `kept` differ whenever dice are discarded — with `adv`/`dis`, or `kh`/`kl`.
Both are reported so a display can show the dropped die rather than hide it.

`modifier` is the sum of the plain numbers; `modifiers` is the list. A `+1` and a `−6` sum
to −5, which does not say where it came from — the list lets you print `+1 −6`.

### Options

All optional.

```ts
roll('1d20+7', {
  advantage: 'advantage', // or 'disadvantage'
  bonuses: [2, '1d4'], // extra things to add
  tags: ['fire', 'cold'], // labels you accept — see below
  rand: myRandomSource, // your own randomness, for tests
})
```

**`advantage`** does the same as writing `adv` in the formula: use the formula when it is
fixed, the option when your code decides at run time. If several things in your program
would each set it, resolve them yourself and pass one answer — this library applies no
rules of its own.

**`bonuses`** adds numbers or dice without editing the formula text:

```ts
roll('1d20+7', { bonuses: [2, '1d4'] }) // rolls 1d20 + 7 + 2 + 1d4
```

A numeric bonus must be a whole number that stays exact, the same as a `+3` written into a
formula. A fraction, `NaN` or an infinity throws rather than being folded into the total.
A roll accepts at most 100 bonuses.

## Exploding dice

A `!` after a die makes it **exploding**: when it lands on its highest face, it is rolled
again and the new number added. A roll that also lands on the highest face explodes again,
so there is no maximum.

```ts
roll('1d6!') // rolled 6, then 4    → results [6, 4],    total 10
roll('1d6!') // rolled 6, 6, then 2 → results [6, 6, 2], total 14
roll('1d6!') // rolled 3            → results [3],       total 3
```

Savage Worlds, Shadowrun and Deadlands all use this.

Every roll in the chain appears in `results`, in the order it happened. A roll equal to the
number of sides is the one that caused the next.

Each die in a group explodes on its own:

```ts
roll('3d6!') // first die rolled 6 then 4, the others 2 and 3
// results: [6, 4, 2, 3], total 15
```

Two constraints:

- **It does not combine with `kh`, `kl`, `adv` or `dis`.** `4d6kh3!` throws, because "keep
  the highest three" has no defined meaning once each die is an open-ended chain.
- **A die explodes at most 100 times.** A fair d6 reaching ten in a row is roughly a
  one-in-sixty-million event, so the cap exists to stop a loaded random source hanging the
  process, not to bound fair dice. A one-sided die never explodes.

## Multiplying a group

`x` followed by a whole number multiplies that group's total:

```ts
roll('1d6x10') // a d6, times ten: 10, 20, 30, 40, 50 or 60
roll('2d6x3') //  both dice added up, then tripled
```

It multiplies **that group of dice**, never the whole sum, so the `+5` below is added
afterwards:

```ts
roll('1d6x10+5') // rolled 3 -> 3 x 10 + 5 = 35
```

This is why there is no `*` and no brackets: a multiplier binds to one group the way `kh3`
does, so what it applies to is never in question. `5x2` is not a formula — this multiplies
dice, not arithmetic.

It combines with everything else and always applies last, to whatever the group kept:

```ts
roll('4d6kh3x2') //  keep the best three, then double them
roll('1d20advx2') // advantage, then double the die that won
roll('1d6!x2') //    let it explode, then double the whole chain
```

`multiplier` is reported on the group, so a total can be checked:

```ts
const g = roll('2d6x3', { rand: faces(2, 4) }).dice[0]
g.kept //       [2, 4]
g.multiplier // 3
g.total //      18
```

There is no division: it needs a rounding rule — down, to nearest, in whose favour — and
choosing one would be this library deciding what a roll means. Write `Math.floor(total / 3)`
yourself.

## Labels

A formula may end in a word: `2d10+8 fire`. It is carried on the result and never affects
the maths.

You must declare which words you accept:

```ts
roll('2d10+8 fire', { tags: ['fire', 'cold'] }).tag // 'fire'

roll('2d10+8 fire') // throws
```

Pass a list or a `Set`, even for one word. A bare string is refused because JavaScript
iterates a string as separate letters, so `tags: 'fire'` would accept `f`, `i`, `r` and `e`:

```ts
roll('2d10+8 fire', { tags: ['fire'] }) // right
roll('2d10+8 fire', { tags: 'fire' }) //   throws
```

The library knows a formula can end in a label and nothing about which labels are real —
"fire" could be a category, a colour, a material — so the list is yours to supply.

An unknown word throws rather than being carried silently: at the end of a formula, a stray
word is usually a typo.

## Highest and lowest faces

Each group reports whether the die it kept landed on its highest or lowest face:

```ts
roll('1d20').dice[0].naturalHigh // true if the d20 came up 20
roll('1d6').dice[0].naturalHigh //  true if the d6 came up 6
roll('1d78').dice[0].naturalHigh // true if the d78 came up 78
roll('1d20').dice[0].naturalLow //  true if it came up 1
```

That is all they report: **what the die showed**. Whether a top face is significant is for
the caller to decide, so there is nothing to configure.

Both are `false` unless the group kept exactly **one** die:

```ts
roll('3d6').dice[0].naturalHigh //   always false — three dice counted
roll('4d6kh1').dice[0].naturalHigh // true if the kept die is a 6
```

When a roll mixes dice, each group answers for itself:

```ts
const r = roll('1d20+1d4')
r.dice[0].naturalHigh // the d20
r.dice[1].naturalHigh // the d4
```

## Limits

A formula is usually text somebody typed, so each of these throws rather than being
attempted:

| Limit                                | Why                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **1,000 dice** in one roll           | Every die is rolled separately, so `99999999d6` stops the program responding rather than producing a roll.                            |
| **4,294,967,296 sides** on a die     | One random draw covers that many faces. More would mean two draws per die, and the fairness rests on one.                             |
| **100 bonuses** on one roll          | Each is parsed before the dice can be counted, so the list is bounded too.                                                            |
| **1,000 characters** in a formula    | Longer than anyone types.                                                                                                             |
| **100 explosions** on one die        | See [exploding dice](#exploding-dice).                                                                                                |
| **A total of 9,007,199,254,740,991** | Above that JavaScript stops counting in exact whole numbers, and a total that cannot be exact is refused rather than quietly rounded. |

Bonuses count towards the dice limit:

```ts
roll('600d6', { bonuses: ['600d6'] }) // throws, as roll('1200d6') does
```

A keep rule must keep at least one die, so `4d6kh0` throws.

## A formula has to roll something

Every formula must roll at least one die:

```ts
roll('2d6+3') // fine
roll('2+5') //   throws — no dice in it
roll('0d6') //   throws — a die nobody rolls
```

Answering `2+5` would mean returning a `total` with an empty `dice` list behind it. To add
a plain number, put it in the formula or pass it as a bonus:

```ts
roll('1d20+5')
roll('1d20', { bonuses: [5] })
```

## What a formula may contain

Letters, digits, `+`, `-`, `!` and ordinary spaces. Nothing else — not a tab, not a line
break, not any other Unicode space:

```ts
roll('2D6 + 3') // fine — spaces and capitals both
roll('1d\n20') //  throws
roll('1d6*2') //   throws
```

This matters because `result.formula` returns the text you passed, verbatim. A line break
would survive into that field and from there into whatever the roll is written to:

```text
mallory rolled 1d
20 = 5
```

One roll, two lines in the log. The same applies to a CSV row or a database record.
Refusing the character keeps `formula` a single line of plain text.

It also rules out characters that resemble the ones a formula uses: `4d6Kh3` written with a
Kelvin sign throws rather than being read as `4d6kh3`.

## Errors

Every error quotes the text it could not read, shortened, so it can be shown to whoever
typed it:

```ts
roll('2d6 + x') // Error: Cannot parse "2d6 + x" near "+x"
roll('1d6*2') //   Error: A dice formula may only contain letters, digits, spaces, "+", "-" and "!", but this one has U+002A
```

A rejected character is named by its code point rather than repeated, so an error cannot
carry a payload into wherever you display it. That makes the message safer to show, not
safe: **escape anything you put on a page**, from here or anywhere else.

## `parseFormula(text, options?)`

Reads a formula and reports what it means, without rolling anything. `roll()` calls it for
you; call it directly to check a formula before use — usually something a person typed.

```ts
import { parseFormula } from 'opendice'

function isValid(text: string): boolean {
  try {
    parseFormula(text)
    return true
  } catch {
    return false
  }
}

isValid('2d6+3') // true
isValid('two dice') // false
isValid('5') // false — no dice in it
```

It throws on anything it cannot read, so a bad formula fails where it was typed rather than
further along. What it returns:

```ts
parseFormula('2d6+3')
// {
//   source: '2d6+3',
//   terms: [
//     { kind: 'dice', sign: 1, count: 2, sides: 6 },
//     { kind: 'flat', value: 3 },
//   ],
// }
```

`terms` is the formula broken into pieces — enough to describe a formula back to someone
before they commit to it.

It takes the same `tags` option as `roll()`:

```ts
parseFormula('2d6 fire', { tags: ['fire'] }).tag // 'fire'
```

## `rollDie(sides, source?)`

One die, no formula, no result object.

```ts
import { rollDie } from 'opendice'

rollDie(20) // a number from 1 to 20
rollDie(6) // a number from 1 to 6
rollDie(78) // a number from 1 to 78
```

Same randomness as `roll()`. Throws if `sides` is not a whole number from 1 to
4,294,967,296 — see [Limits](#limits).

## `cryptoRandom()`

The raw random number everything else is built on: an integer from 0 to 4,294,967,295.

```ts
import { cryptoRandom } from 'opendice'

cryptoRandom() // 2847193056
```

Exported so the source of randomness can be inspected or wrapped.

## `keptFlags(group)`

Which dice counted, in the order they were rolled.

```ts
import { roll, keptFlags } from 'opendice'

const r = roll('1d20adv') // rolled [4, 17], kept [17]
keptFlags(r.dice[0]) // [false, true]
```

For display: line the flags up with `results` to grey out the 4 and highlight the 17.

```ts
const group = r.dice[0]
const flags = keptFlags(group)

group.results.forEach((value, i) => {
  console.log(value, flags[i] ? '(counted)' : '(dropped)')
})
// 4 (dropped)
// 17 (counted)
```

If two discarded dice show the same number, exactly one is marked kept, so the flags always
match the real count.

## `soleDieGroup(result)`

The dice in a result, when the roll used one kind of die.

```ts
import { roll, soleDieGroup } from 'opendice'

soleDieGroup(roll('1d20+7')) //  the d20's group — the +7 is not dice
soleDieGroup(roll('2d6+3')) //   the 2d6 group
soleDieGroup(roll('1d20+1d6')) // undefined — two kinds of die
```

For showing the dice on their own with the flat numbers listed beside them. It returns
`undefined` rather than guessing when a roll mixes kinds of die.

## Testing your own code

Pass your own randomness to make rolls predictable:

```ts
roll('1d20', { rand: () => 0 }) // always 1
```

A random source is any function returning a whole number from 0 to 4,294,967,295. The
lowest number gives the lowest face.

```ts
// A source that plays back a fixed sequence of faces.
function faces(...list: number[]) {
  let i = 0
  return () => list[i++] - 1
}

roll('2d6+3', { rand: faces(5, 3) }).total // 11, every time
```

**Only pass a source your own code chooses.** A result records what the dice showed, never
which source produced them, so a rigged source is indistinguishable from a fair one in the
output. If someone using your program can choose the source, they can choose the roll.

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

## What this library does not do

It has no rules of its own. It rolls dice and reports what happened. Whether a high roll is
good, what a label stands for, whether a total passes or fails — all of that is the
caller's.

## Where it came from

Extracted from [OpenFray](https://openfray.app), which routes every roll through one
function so randomness has a single place to live and be checked. Everything that knew
about OpenFray's subject matter was left behind. OpenFray is AGPL-3.0; these dice are MIT.

## Licence

MIT © Nicola Mustone — see [LICENSE](./LICENSE).
