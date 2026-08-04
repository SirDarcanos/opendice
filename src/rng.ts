// SPDX-License-Identifier: MIT
// Copyright (C) 2026 OpenFray contributors

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
 * The platform CSPRNG — `crypto.getRandomValues`, not `Math.random`, whose quality the
 * spec allows to vary across engines. Available in browsers and in Node 19 and later.
 */
export const cryptoRandom: RandomSource = () => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

/**
 * Roll a fair die in [1, sides] using rejection sampling to remove modulo bias: draw a
 * 32-bit value, reject any landing in the short remainder above the largest exact
 * multiple of `sides`, and redraw. Every face is exactly equally likely. One draw per
 * die — never derive several dice from one number.
 */
export function rollDie(sides: number, rand: RandomSource = cryptoRandom): number {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error(`rollDie: sides must be a positive integer, got ${sides}`)
  }
  // Largest multiple of `sides` that fits in the uint32 range; reject at or above it.
  const ceiling = Math.floor(UINT32_RANGE / sides) * sides
  let x = rand() >>> 0
  while (x >= ceiling) x = rand() >>> 0
  return (x % sides) + 1
}
