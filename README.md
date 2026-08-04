# @openfray/dice

**Honest dice for d20 systems.** A formula parser, a CSPRNG with modulo-bias rejection,
and one `roll()` that reports every die it kept and every die it dropped.

MIT · zero dependencies · works in the browser and in Node 20+

```bash
npm install @openfray/dice
```

## Why this exists

It was the dice engine inside [OpenFray](https://openfray.app), a combat console for
Dungeons and Dragons, where it sat behind one function so that randomness had exactly one
place to live. That turned out to be the useful shape for anyone else too, so it moved
out.

The design goal is not "true" randomness. It is **unbiased, uniform, and
unpredictable-to-a-human, with enough transparency that players trust it** — which means
the interesting part is as much what it refuses to do as what it does.

## Using it

```ts
import { roll } from '@openfray/dice'

roll('1d20+7', { kind: 'attack' })
// { total: 23, dice: [{ sides: 20, results: [16], kept: [16], … }], modifier: 7, crit: false, … }

roll('4d6kh3') //            roll four, keep the best three
roll('1d20adv+5') //         advantage: roll two, keep the higher, both reported
roll('2d6+1d4+2') //         as many terms as you like
roll('10-1d4') //            terms can subtract
```

Everything a result carries is there so you can _show your work_:

```ts
const r = roll('1d20adv+5')
r.dice[0].results //  [4, 17]  — every die rolled
r.dice[0].kept //     [17]     — the ones that counted
r.modifiers //        [5]      — each flat modifier on its own, not just the sum
r.advantageState //   'advantage'
```

`keptFlags(group)` lines the kept dice up with the rolled ones, so a UI can dim the
dropped die rather than hide it.

### The grammar

| Formula     | Meaning                                    |
| ----------- | ------------------------------------------ |
| `2d6`       | standard                                   |
| `1d20+7`    | modifier — `10-1d4` subtracts              |
| `1d20adv`   | advantage: roll two, keep the higher       |
| `1d20dis`   | disadvantage: roll two, keep the lower     |
| `4d6kh3`    | keep highest three (`kl` keeps the lowest) |
| `1d8+1d4+3` | additive sub-rolls                         |
| `2d10 fire` | a trailing **tag** — metadata, never math  |

### Tags are yours, not ours

A trailing word is only a tag if you say it is:

```ts
parseFormula('2d10+8 fire', { tags: ['fire', 'cold'] }) // → { …, tag: 'fire' }
parseFormula('2d10+8 fire') //                             throws
```

A damage type in one game is a suit or an element in another, so the parser knows a
formula _can_ carry a tag and nothing about which are real. Passing an unrecognised word
is an error rather than a silent tag, because at the end of a formula a stray word is far
more often a typo than metadata — and a typo you can see beats one that travels.

### Advantage, bonuses, and crits

The library does not know what Bless is. Whatever decides that a roll has advantage, or
that something adds a `1d4`, lives in your code and hands the answer in:

```ts
roll('1d20+7', {
  kind: 'attack',
  advantage: 'advantage', // net it yourself; one adv + one disadv is your call
  bonuses: [2, '1d4'], // numbers or formula fragments
})
```

Crit rules apply to damage dice only, never to an attack roll or a flat modifier:

```ts
roll('2d6+4', { kind: 'damage', crit: 'double-dice' }) //    roll twice the dice
roll('2d6+4', { kind: 'damage', crit: 'max-plus-roll' }) //  max the dice, then roll
roll('2d6+4', { kind: 'damage', crit: 'double-total' }) //   roll once, double the dice total
```

`crit` and `fumble` on the result flag a natural 20 or 1, and only for a single kept d20
on `kind: 'attack'` — a 20 on a damage die is not a crit.

## The randomness

**You get all of this from `roll()` without asking.** There is nothing to configure and no
generator to pass in: `roll('1d20')` already goes through the CSPRNG below.

- **`crypto.getRandomValues`, not `Math.random`**, whose quality the specification allows
  to vary between engines.
- **Modulo bias is rejected, not ignored.** A 32-bit draw landing in the short remainder
  above the largest exact multiple of `sides` is thrown away and redrawn, so every face is
  _exactly_ equally likely rather than nearly so.
- **One draw per die.** Several dice are never derived from one number.
- **No "anti-streak" logic, ever.** Nothing here nudges results to feel fairer over time.
  Suppressing repeats is more detectably rigged across a campaign than honest clumping is,
  and it would make the log a lie. Real dice clump; so do these.

The two pieces are exported so you can reach past `roll()` when you want to — roll a
single die without the formula layer, or point the generator somewhere else:

```ts
import { rollDie, cryptoRandom } from '@openfray/dice'

rollDie(20) //                    one fair d20, same CSPRNG, no formula to parse
rollDie(6, myOwnSource) //        or your own RandomSource
cryptoRandom() //                 the raw uint32 draw, if you are auditing it
```

A `RandomSource` is any `() => number` yielding unsigned 32-bit integers, which is what
makes tests deterministic:

```ts
roll('1d20', { rand: () => 0 }) // → 1, every time
```

## What it deliberately isn't

- **Not a rules engine.** No conditions, no characters, no spells.
- **Not effect-aware.** It applies the advantage and bonuses you hand it and works none of
  them out for itself, which is what keeps the randomness auditable on its own.
- **No exploding dice yet.** `1d6!` is in the grammar and parses as an error.

## Licence

MIT. OpenFray itself is AGPL-3.0; the dice are not the product, and are deliberately
easier to reuse than the app around them.
