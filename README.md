# @openfray/dice

[![NPM](https://nodei.co/npm/@openfray/dice.svg?style=shields&data=n,v,u,d&color=blue)](https://www.npmjs.com/package/@openfray/dice)

Roll dice in JavaScript or TypeScript. You write `2d6+3`, you get a number back — plus
every die that was rolled, so you can show your work.

The dice are fair. They use your computer's secure random number generator, and nothing in
here ever nudges a result.

MIT licence · no dependencies · works in a browser and in Node 20 or newer

```bash
npm install @openfray/dice
```

## Your first roll

```ts
import { roll } from '@openfray/dice'

const result = roll('2d6+3')

result.total // 11
```

`roll()` takes a formula as text and gives you back an object. `total` is the number you
usually want. Everything else on that object is there to explain how it got there:

```ts
result.dice[0].results // [5, 3]  — the two dice that were rolled
result.modifier //        3       — the +3
result.formula //         '2d6+3' — what you asked for
```

So this roll was 5 + 3 + 3 = 11, and you can show someone exactly that.

## What you can use

Six things. Most projects only ever need the first one.

| Function                    | What it does                                                     |
| --------------------------- | ---------------------------------------------------------------- |
| `roll(formula, options?)`   | Rolls a formula and returns the result. **Start here.**          |
| `parseFormula(text, opts?)` | Reads a formula **without rolling it**. For checking user input. |
| `rollDie(sides, source?)`   | Rolls one die. No formula, no parsing.                           |
| `cryptoRandom()`            | The raw random number the dice are built on.                     |
| `keptFlags(group)`          | Marks which dice counted, for greying out the rest.              |
| `soleDieGroup(result)`      | Finds the dice in a result, if it used only one kind.            |

Each is explained below.

---

## `roll(formula, options?)`

The main function. Give it a formula, get a result.

```ts
roll('1d20') //      one twenty-sided die
roll('3d8') //       three eight-sided dice, added together
roll('1d20+5') //    one d20, plus 5
roll('2d6-1') //     two d6, minus 1
roll('1d78') //      unusual numbers of sides are fine, not just the usual ones
```

### The formula language

| You write   | It means                                                     |
| ----------- | ------------------------------------------------------------ |
| `2d6`       | Roll two six-sided dice and add them up.                     |
| `1d20+7`    | Roll a d20 and add 7. Use `-7` to subtract.                  |
| `1d8+1d4+3` | Mix as many dice and numbers as you like.                    |
| `4d6kh3`    | Roll four d6, **k**eep the **h**ighest **3**.                |
| `4d6kl3`    | Same, but keep the **l**owest 3.                             |
| `1d20adv`   | Roll two d20 and keep the higher one. ("advantage")          |
| `1d20dis`   | Roll two d20 and keep the lower one. ("disadvantage")        |
| `1d6!`      | Exploding — see [below](#exploding-dice).                    |
| `2d10 fire` | A label on the end. See [Labels](#labels) — it's never math. |

Spaces are ignored, and capital letters are fine: `2D6 + 3` works.

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

Each entry in `dice` describes one group of dice:

```ts
r.dice[0]
// {
//   sides: 20,          the kind of die
//   results: [4, 17],   every die that was rolled
//   kept: [17],         the ones that counted toward the total
//   sign: 1,            1 for added, -1 for subtracted (as in '10-1d4')
//   total: 17,          what this group contributed
//   naturalHigh: false, the kept die showed the highest face — see below
//   naturalLow: false,  the kept die showed a 1
// }
```

`results` and `kept` differ whenever dice are thrown away — with `adv`/`dis`, or with
`kh`/`kl`. Keeping both means you can show the die that was dropped instead of hiding it,
so nobody has to take the total on trust.

### Why `modifiers` as well as `modifier`

`modifier` is the sum. `modifiers` is the list. If one thing adds 1 and another takes away
6, the sum is −5 — which says nothing about where it came from. The list lets you print
`+1 −6` instead, so the arithmetic is visible.

### Options

Everything is optional.

```ts
roll('1d20+7', {
  advantage: 'advantage', // or 'disadvantage'
  bonuses: [2, '1d4'], // extra things to add
  tags: ['fire', 'cold'], // labels you accept — see below
  rand: myRandomSource, // your own randomness, for tests
})
```

**`advantage`** does the same as writing `adv` in the formula. Use whichever suits: the
formula when it's fixed, the option when your code decides at run time.

If several things in your project would each set this, work out the net result yourself
and pass one answer. This library has no rules of its own to apply.

**`bonuses`** adds extra numbers or extra dice, without changing the formula text. It takes
plain numbers and formula fragments:

```ts
roll('1d20+7', { bonuses: [2, '1d4'] }) // rolls 1d20 + 7 + 2 + 1d4
```

This is for extras your code works out while running, so you don't have to build formula
strings by hand.

A plain number has to be a whole one, the same as a `+3` written into a formula. A fraction,
`NaN` or an infinity is refused rather than folded into the total.

## Exploding dice

Put a `!` after a die and it becomes **exploding**: whenever it lands on its highest face,
you roll it again and add the new number. If that also lands on the highest face, you roll
again — so there is no maximum.

```ts
roll('1d6!') // rolled 6, then 4  → results [6, 4],    total 10
roll('1d6!') // rolled 6, 6, then 2 → results [6, 6, 2], total 14
roll('1d6!') // rolled 3          → results [3],       total 3
```

Several systems use this — Savage Worlds, Shadowrun and Deadlands among them — because it
lets a small die produce a big number now and then.

Every roll in the chain appears in `results`, in the order it happened, so you can show
someone how a 14 came out of one d6. You can always tell where a chain started, too: a
roll equal to the number of sides is what caused the next one.

Each die in a group explodes on its own:

```ts
roll('3d6!') // first die rolled 6 then 4, the others 2 and 3
// results: [6, 4, 2, 3], total 15
```

Two things it will not do:

- **It won't combine with `kh`, `kl`, `adv` or `dis`.** `4d6kh3!` is rejected rather than
  guessed at, because "keep the highest three" has no obvious meaning once each die is an
  open-ended chain.
- **It won't run away.** A die can explode 100 times and then the chain is cut. A fair d6
  reaching even ten in a row is a one-in-sixty-million event, so this never fires in
  practice — it's there so a deliberately loaded random source can't hang your program. A
  one-sided die never explodes at all, since every roll would be a top face.

## Labels

A formula can end in a word: `2d10+8 fire`. The word is carried along with the result and
never affects the maths.

You must say which words you accept:

```ts
roll('2d10+8 fire', { tags: ['fire', 'cold'] }).tag // 'fire'

roll('2d10+8 fire') // throws an error
```

Give it a list, even for a single word. A bare `'fire'` is refused, because JavaScript
reads a string as its separate letters — it would accept `f`, `i`, `r` and `e` and nothing
else:

```ts
roll('2d10+8 fire', { tags: ['fire'] }) // right
roll('2d10+8 fire', { tags: 'fire' }) //   throws an error
```

That may look fussy, but "fire" means nothing on its own. It might be a category, a colour,
a material, a kind of damage — that depends entirely on what you are building. So the
library knows a formula _can_ end in a label, and nothing about which labels are real. You
supply the list.

An unknown word is an error rather than a silent label, because a stray word at the end of
a formula is usually a typo. Better to see the mistake than to have it quietly travel
along.

## Highest and lowest faces

Every group of dice reports whether the die it kept landed on its highest or lowest face:

```ts
roll('1d20').dice[0].naturalHigh // true if the d20 came up 20
roll('1d6').dice[0].naturalHigh //  true if the d6 came up 6
roll('1d78').dice[0].naturalHigh // true if the d78 came up 78
roll('1d20').dice[0].naturalLow //  true if it came up 1
```

That is all they mean: **what the die showed**. Whether landing on the top of a die is
special, and what happens if it is, is entirely up to you — so there is nothing to declare
and nothing to switch on.

Both are `false` unless that group kept exactly **one** die, because a 6 among four dice
isn't the result of anything on its own:

```ts
roll('3d6').dice[0].naturalHigh //   always false — three dice counted
roll('4d6kh1').dice[0].naturalHigh // true if the kept die is a 6
```

When a roll mixes dice, each group answers for itself — the library never picks one to
speak for the whole roll, because which die decides a roll is yours to know:

```ts
const r = roll('1d20+1d4')
r.dice[0].naturalHigh // the d20
r.dice[1].naturalHigh // the d4
```

## Limits

A formula is usually something a person typed, so there is a limit on what one can ask
for. Each of these is refused with an error rather than attempted:

| Limit                                | Why                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **1,000 dice** in one roll           | Every die is rolled separately, so `99999999d6` is a way of asking a program to stop responding rather than a roll anyone wants.     |
| **4,294,967,296 sides** on a die     | That is how many faces one random number covers. More would mean drawing twice for one die, and the fairness rests on one draw each. |
| **1,000 characters** in a formula    | Longer than anyone types.                                                                                                            |
| **100 explosions** on one die        | See [exploding dice](#exploding-dice).                                                                                               |
| **A total of 9,007,199,254,740,991** | Above that, JavaScript stops counting in exact whole numbers. A total that cannot be exact is refused rather than quietly rounded.   |

Bonuses count towards the dice limit, so this is refused just as `roll('1200d6')` is:

```ts
roll('600d6', { bonuses: ['600d6'] }) // throws an error
```

All of these sit far above ordinary use. If you are reaching one, something is generating
formulas rather than a person writing them.

A keep rule has to keep at least one die, so `4d6kh0` is refused too — it reads as a typo
for `4d6kh1`, and quietly counting nothing would be worse than saying so.

## A formula has to roll something

Every formula must roll at least one die. Plain arithmetic is refused:

```ts
roll('2d6+3') // fine
roll('2+5') //   throws an error — no dice in it
roll('0d6') //   throws an error — a die nobody rolls
```

`2+5` is 7 whoever works it out, and answering it here would mean handing back a `total`
with an empty `dice` list behind it — a number with nothing to show for itself. If you
want to add a plain number to a roll, put it in the formula or pass it as a bonus:

```ts
roll('1d20+5')
roll('1d20', { bonuses: [5] })
```

## Showing an error to someone

Every error here quotes the text it could not read, so you can show the person what went
wrong. What it quotes is shortened, and anything a formula could not contain is replaced
with a `?`:

```ts
roll('1d6*2') // Error: Cannot parse "1d6?2" near "?2"
```

That is deliberate. If a formula arrives from a text box on a web page and the error goes
back onto that page, an error repeating the input word for word would put whatever was
typed — markup and all — straight into your page. Nothing a real formula says is lost,
because a formula cannot contain those characters in the first place.

This makes the message safer to show, not safe: **escape anything you put on a page**, from
here or anywhere else.

## `parseFormula(text, options?)`

Reads a formula and tells you what it means — **without rolling anything**.

`roll()` calls this for you, so you rarely need it directly. Reach for it when you want to
check a formula before using it. The usual case is validating something a person typed:

```ts
import { parseFormula } from '@openfray/dice'

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

It throws on anything it can't read, so a bad formula fails at the moment the person typed
it rather than somewhere further along.

What it returns:

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

`terms` is the formula broken into pieces. You could use it to show someone what a formula
will do before they commit to it — "two six-sided dice, plus 3".

It takes the same `tags` option as `roll()`:

```ts
parseFormula('2d6 fire', { tags: ['fire'] }).tag // 'fire'
```

## `rollDie(sides, source?)`

Rolls a single die. No formula, no parsing, no result object — just a number.

```ts
import { rollDie } from '@openfray/dice'

rollDie(20) // a number from 1 to 20
rollDie(6) // a number from 1 to 6
rollDie(78) // a number from 1 to 78
```

Use it when you only need one die and don't need the breakdown. It uses exactly the same
fair randomness as `roll()`.

It throws if `sides` isn't a whole number from 1 to 4,294,967,296 — see
[Limits](#limits).

## `cryptoRandom()`

The raw random number everything else is built on: an integer from 0 to 4,294,967,295.

```ts
import { cryptoRandom } from '@openfray/dice'

cryptoRandom() // 2847193056
```

You almost certainly don't need this. It's exported so you can inspect the source of
randomness, or wrap it, rather than having to take our word for it.

## `keptFlags(group)`

When dice are thrown away, this tells you **which ones**, in the same order they were
rolled.

```ts
import { roll, keptFlags } from '@openfray/dice'

const r = roll('1d20adv') // rolled [4, 17], kept [17]
keptFlags(r.dice[0]) // [false, true]
```

It exists for showing results on screen. Line the flags up with `results` and you can grey
out the 4 while highlighting the 17, so someone can see both dice and why one counted:

```ts
const group = r.dice[0]
const flags = keptFlags(group)

group.results.forEach((value, i) => {
  console.log(value, flags[i] ? '(counted)' : '(dropped)')
})
// 4 (dropped)
// 17 (counted)
```

If two dropped dice show the same number, exactly one of them is marked as kept — the
flags always match the real count.

## `soleDieGroup(result)`

Finds the dice in a result, when the roll used only one kind of die.

```ts
import { roll, soleDieGroup } from '@openfray/dice'

soleDieGroup(roll('1d20+7')) // the d20's group — the +7 is not dice
soleDieGroup(roll('2d6+3')) //  the 2d6 group
soleDieGroup(roll('1d20+1d6')) // undefined — two kinds of die
```

Useful when you want to show the dice by themselves — large, in the middle of the screen —
with the plain numbers listed beside them. It returns `undefined` rather than guessing when
a roll mixes kinds of die, since only you know which of them is the one that matters.

## Testing your own code

Pass your own randomness to make rolls predictable:

```ts
roll('1d20', { rand: () => 0 }) // always 1
```

A random source is any function returning a whole number from 0 to 4,294,967,295. The
lowest number gives the lowest face:

```ts
// A source that plays back a fixed sequence of faces.
function faces(...list: number[]) {
  let i = 0
  return () => list[i++] - 1
}

roll('2d6+3', { rand: faces(5, 3) }).total // 11, every time
```

Only ever pass a source your own code decides on. A result says what the dice showed, never
where the numbers came from, so a rigged source produces a result that looks exactly like a
fair one — there is no way to tell them apart afterwards. If someone using your program can
choose the source, they can choose the roll.

## About the randomness

You get all of this from `roll()` without asking. There is nothing to switch on.

- **It uses `crypto.getRandomValues`, not `Math.random`.** The JavaScript standard lets
  `Math.random` be poor quality, and it varies between browsers.
- **It removes bias instead of ignoring it.** Turning a random 32-bit number into a d6
  naively makes some faces very slightly likelier than others. This throws away the draws
  that would cause that and draws again, so every face is _exactly_ as likely as every
  other.
- **Every die gets its own draw.** Several dice are never squeezed out of one number.
- **Nothing is ever nudged.** There's no "you've rolled badly, here's a good one" logic and
  there never will be. Real dice come up 1 three times in a row sometimes; so do these. Any
  code that smoothed that out would make any record of the rolls a lie, and people notice.
- **Nothing outside your program can reach in and change it.** The options you pass are read
  as you passed them, so other code running alongside cannot slip in its own randomness, a
  label, or an extra die. The one exception is the `rand` option above — that one is yours
  to guard, because it replaces the randomness outright.

## What this library does not do

- **It has no rules of its own.** It rolls dice and reports what happened. Whether a high
  roll is good, what a label stands for, whether a total passes or fails — all yours.

## Where it came from

This is the dice engine [OpenFray](https://openfray.app) rolls on. Every roll there goes
through one function, so that randomness has exactly one place to live and can be checked
in one place. That turned out to be useful on its own, so it lives here now, with
everything that knew about OpenFray's subject matter left behind.

OpenFray is licensed AGPL-3.0. These dice are MIT: they aren't the product, and they're
more use to people if they're easy to reuse.

## Licence

MIT — see [LICENSE](./LICENSE).
