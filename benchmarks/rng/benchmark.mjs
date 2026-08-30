// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

import { roll, rollDie } from '../../dist/index.js'

const BUFFER_SIZES = [1, 16, 64, 256, 1024]
const SAMPLES = 7
const WARMUPS = 2

const getRandomValues = crypto.getRandomValues.bind(crypto)

/** Create the previous source, which asks the platform for one newly allocated word. */
function oneWordSource() {
  return () => {
    const words = new Uint32Array(1)
    getRandomValues(words)
    return words[0]
  }
}

/** Create a source that refills a reusable typed array when its words have been consumed. */
function bufferedSource(size) {
  const words = new Uint32Array(size)
  let next = size
  return () => {
    if (next === size) {
      getRandomValues(words)
      next = 0
    }
    return words[next++]
  }
}

const candidates = [
  {
    name: 'one-word',
    create: () => oneWordSource(),
    createFresh: () => oneWordSource(),
  },
  ...BUFFER_SIZES.map((size) => ({
    name: `buffer-${size}`,
    create: () => bufferedSource(size),
    createFresh: () => bufferedSource(size),
  })),
]

const metrics = [
  {
    name: 'cold-source',
    operations: 20_000,
    sourceFactory: 'createFresh',
    run(create, operations) {
      let checksum = 0
      for (let i = 0; i < operations; i++) checksum ^= create()()
      return checksum
    },
  },
  {
    name: 'random-word',
    operations: 200_000,
    run(create, operations) {
      const source = create()
      let checksum = 0
      for (let i = 0; i < operations; i++) checksum ^= source()
      return checksum
    },
  },
  {
    name: 'roll-d20',
    operations: 200_000,
    run(create, operations) {
      const source = create()
      let checksum = 0
      for (let i = 0; i < operations; i++) checksum += rollDie(20, source)
      return checksum
    },
  },
  {
    name: 'roll-2d6+3',
    operations: 20_000,
    run(create, operations) {
      const source = create()
      let checksum = 0
      for (let i = 0; i < operations; i++) checksum += roll('2d6+3', { rand: source }).total
      return checksum
    },
  },
  {
    name: 'roll-1000d6',
    operations: 100,
    run(create, operations) {
      const source = create()
      let checksum = 0
      for (let i = 0; i < operations; i++) checksum += roll('1000d6', { rand: source }).total
      return checksum
    },
  },
]

/** Return the median of an already sorted list. */
function median(values) {
  return values[Math.floor(values.length / 2)]
}

/** Run the refill candidates through raw and caller-visible workloads. */
export function runRngBenchmark(environment) {
  const rows = []
  let checksum = 0

  for (const metric of metrics) {
    for (const candidate of candidates) {
      const create = candidate[metric.sourceFactory ?? 'create']
      for (let i = 0; i < WARMUPS; i++) {
        checksum ^= metric.run(create, metric.operations)
      }

      const samplesMs = []
      for (let i = 0; i < SAMPLES; i++) {
        const started = performance.now()
        checksum ^= metric.run(create, metric.operations)
        samplesMs.push(performance.now() - started)
      }

      const sorted = [...samplesMs].sort((a, b) => a - b)
      rows.push({
        metric: metric.name,
        candidate: candidate.name,
        operations: metric.operations,
        samplesMs,
        medianNsPerOperation: (median(sorted) * 1_000_000) / metric.operations,
      })
    }
  }

  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    environment,
    configuration: {
      samples: SAMPLES,
      warmups: WARMUPS,
      bufferSizes: BUFFER_SIZES,
    },
    checksum,
    rows,
  }
}
