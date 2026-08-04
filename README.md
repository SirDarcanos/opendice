# @openfray/dice

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

So this roll was 5 + 3 + 3 = 11, and you can show a player exactly that.

## What you can use

Six things. Most projects only ever need the first one.

| Function                    | What it does                                                     |
| --------------------------- | ---------------------------------------------------------------- |
| `roll(formula, options?)`   | Rolls a formula and returns the result. **Start here.**          |
| `parseFormula(text, opts?)` | Reads a formula **without rolling it**. For checking user input. |
| `rollDie(sides, source?)`   | Rolls one die. No formula, no parsing.                           |
| `cryptoRandom()`            | The raw random number the dice are built on.                     |
| `keptFlags(group)`          | Marks which dice counted, for greying out the rest.              |
| `d20Group(result)`          | Finds the d20 in a result, if there is exactly one.              |

Each is explained below.

---

## `roll(formula, options?)`

The main function. Give it a formula, get a result.

```ts
roll('1d20') //      one twenty-sided die
roll('3d8') //       three eight-sided dice, added together
roll('1d20+5') //    one d20, plus 5
roll('2d6-1') //     two d6, minus 1
roll('1d78') //      any number of sides works, not just the usual ones
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
| `2d10 fire` | A label on the end. See [Labels](#labels) — it's never math. |

Spaces are ignored, and capital letters are fine: `2D6 + 3` works.

### What you get back

```ts
const r = roll('1d20adv+5')
```

| Property         | Example       | Meaning                                                                        |
| ---------------- | ------------- | ------------------------------------------------------------------------------ |
| `total`          | `22`          | The final number.                                                              |
| `dice`           | see below     | One entry per group of dice.                                                   |
| `modifier`       | `5`           | All the plain numbers added together.                                          |
| `modifiers`      | `[5]`         | Each plain number on its own.                                                  |
| `formula`        | `'1d20adv+5'` | What you passed in.                                                            |
| `advantageState` | `'advantage'` | `'normal'`, `'advantage'` or `'disadvantage'`.                                 |
| `naturalHigh`    | `false`       | Would be `true` if the kept d20 showed a 20. See [below](#natural-20s-and-1s). |
| `naturalLow`     | `false`       | Would be `true` if it showed a 1.                                              |
| `tag`            | `undefined`   | The label on the end, if there was one.                                        |

Each entry in `dice` describes one group of dice:

```ts
r.dice[0]
// {
//   sides: 20,          the kind of die
//   results: [4, 17],   every die that was rolled
//   kept: [17],         the ones that counted toward the total
//   sign: 1,            1 for added, -1 for subtracted (as in '10-1d4')
//   total: 17,          what this group contributed
// }
```

`results` and `kept` differ whenever dice are thrown away — with advantage, or with
`kh`/`kl`. Keeping both means you can show the player the die that was dropped instead of
hiding it.

### Why `modifiers` as well as `modifier`

`modifier` is the sum. `modifiers` is the list. If a character has a +1 of their own and
something else applies a −6, the sum is −5 — which tells the player nothing about where it
came from. The list lets you print `+1 −6` instead.

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

If two different things in your game each grant advantage and disadvantage, work out the
net result yourself and pass one answer. This library does not know your rules.

**`bonuses`** adds extra numbers or extra dice, without changing the formula text. It takes
plain numbers and formula fragments:

```ts
roll('1d20+7', { bonuses: [2, '1d4'] }) // rolls 1d20 + 7 + 2 + 1d4
```

This is for bonuses your code discovers at run time — a spell that adds a d4, say — so you
don't have to build formula strings by hand.

## Labels

A formula can end in a word: `2d10+8 fire`. The word is carried along with the result and
never affects the maths.

You must say which words you accept:

```ts
roll('2d10+8 fire', { tags: ['fire', 'cold'] }).tag // 'fire'

roll('2d10+8 fire') // throws an error
```

That may look fussy, but "fire" means nothing to a dice library — it's a damage type in one
game, an element or a suit in another. So the library knows a formula _can_ end in a label
and nothing about which labels are real. You supply the list.

An unknown word is an error rather than a silent label, because a stray word at the end of
a formula is usually a typo. Better to see the mistake than to have it quietly travel
along.

## Natural 20s and 1s

`naturalHigh` is `true` when the kept d20 came up 20. `naturalLow` is `true` when it came
up 1.

That is all they mean: **what the die showed**. Whether a 20 is a critical hit, an
automatic success, or nothing at all is your game's business, so you don't have to declare
anything to get these — a saving throw reports them the same as an attack does.

Both are `false` unless exactly one d20 was kept. A 20 on one of four dice isn't a natural
anything.

### Critical hits are not in here

This library has no idea what a critical hit is. If your game doubles damage on one, you do
it — and everything you need is already on the result. The three common ways:

```ts
// 1. Roll twice as many dice: change the formula.
roll('4d10+8') // instead of 2d10+8

// 2. Double the dice total, leaving the modifier alone.
const r = roll('2d6+5')
const total = r.dice[0].total * 2 + r.modifier

// 3. Maximise the dice, then roll them as well.
const g = roll('2d6').dice[0]
const total2 = g.results.length * g.sides + g.total
```

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
```

It throws on anything it can't read, so a bad formula fails at the moment the person typed
it rather than in the middle of a game.

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

It throws if `sides` isn't a whole number of 1 or more.

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
out the 4 while highlighting the 17, so a player sees both dice and understands why one
counted:

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

## `d20Group(result)`

Finds the d20 in a result, when there's exactly one.

```ts
import { roll, d20Group } from '@openfray/dice'

d20Group(roll('1d20+7')) // the d20's group
d20Group(roll('2d6')) // undefined — no d20
d20Group(roll('1d20+1d20')) // undefined — more than one
```

Useful when you want to display the d20 by itself — big, in the middle of the screen —
with the modifiers listed separately. It returns `undefined` rather than guessing when
there's no single obvious die to show.

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
  code that smoothed that out would make your roll log a lie, and players notice.

## What this library does not do

- **It doesn't know any game's rules.** No characters, no conditions, no spells, no
  critical hits. It doesn't even track what a roll was _for_ — there's no "roll type" to
  set, because a setting the library never reads would only look like it did something.
- **It doesn't decide advantage for you.** You work out the net result and tell it.
- **Exploding dice aren't supported yet.** `1d6!` is recognised but rejected.

## Where it came from

This was the dice engine inside [OpenFray](https://openfray.app), a combat tracker for
Dungeons and Dragons. Every roll in the app went through one function, so that randomness
had exactly one place to live and could be checked in one place. That turned out to be
useful on its own, so it moved out here.

OpenFray is licensed AGPL-3.0. These dice are MIT: they aren't the product, and they're
more use to people if they're easy to reuse.

## Licence

MIT — see [LICENSE](./LICENSE).
