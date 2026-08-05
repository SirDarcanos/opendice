// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

/**
 * The randomness core. The goal is not "true" randomness but **unbiased, uniform, and
 * unpredictable-to-a-human**, with enough transparency that anyone can check it. Trust
 * comes from a visible roll log, never from tampering — so there is deliberately no
 * "anti-streak" or "feels-fair" logic here. Real dice clump; so do these.
 */

/** A source of uniformly-distributed unsigned 32-bit integers. */
export type RandomSource = () => number

const UINT32_RANGE = 2 ** 32

/**
 * The most faces one draw can address. Above this, the largest exact multiple of `sides`
 * inside the uint32 range is zero, so every draw would land above the ceiling and the
 * rejection loop would never end.
 */
export const MAX_SIDES = UINT32_RANGE

/**
 * How many rejections in a row mean the source is broken rather than unlucky. Every die
 * accepts more than half of all draws, so a working source reaching this is a one-in-2^1000
 * event, while a source that only ever returns a rejected value would otherwise spin
 * forever. This is the guard the explosion cap cannot give: rejection happens first.
 */
const MAX_REDRAWS = 1000

/**
 * The platform CSPRNG's own function, taken once as this module loads. Looked up on every
 * call instead, `crypto.getRandomValues` can be replaced by anything else sharing the page
 * — an analytics tag, a dependency further down the bundle — and every roll after that is
 * theirs, reported by a roll log that still looks honest. Taking it here closes that
 * window. It cannot close the one before this module loads, and nothing in JavaScript can.
 */
const getRandomValues = crypto.getRandomValues.bind(crypto)

/**
 * The platform CSPRNG — `crypto.getRandomValues`, not `Math.random`, whose quality the
 * spec allows to vary across engines. Available in browsers and in Node 19 and later.
 */
export const cryptoRandom: RandomSource = () => {
  const buf = new Uint32Array(1)
  getRandomValues(buf)
  return buf[0]
}

/**
 * Roll a fair die in [1, sides] using rejection sampling to remove modulo bias: draw a
 * 32-bit value, reject any landing in the short remainder above the largest exact
 * multiple of `sides`, and redraw. Every face is exactly equally likely. One draw per
 * die — never derive several dice from one number.
 */
export function rollDie(sides: number, rand: RandomSource = cryptoRandom): number {
  if (typeof sides !== 'number' || !Number.isInteger(sides) || sides < 1 || sides > MAX_SIDES) {
    // TypeScript does not stop a JavaScript caller passing text here, and this message is
    // as likely to be shown to someone as any other. A number describes itself harmlessly;
    // anything else is named by its type rather than repeated.
    const got = typeof sides === 'number' ? String(sides) : typeof sides
    throw new Error(`rollDie: sides must be a whole number from 1 to ${MAX_SIDES}, got ${got}`)
  }
  // Largest multiple of `sides` that fits in the uint32 range; reject at or above it.
  const ceiling = Math.floor(UINT32_RANGE / sides) * sides
  let x = rand() >>> 0
  for (let redraws = 0; x >= ceiling; redraws++) {
    if (redraws >= MAX_REDRAWS) {
      throw new Error(`rollDie: the random source rejected ${MAX_REDRAWS} draws in a row`)
    }
    x = rand() >>> 0
  }
  return (x % sides) + 1
}
