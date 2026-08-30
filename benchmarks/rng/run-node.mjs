// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

import { mkdir, writeFile } from 'node:fs/promises'
import { arch, platform, release } from 'node:os'
import { dirname, resolve } from 'node:path'
import { runRngBenchmark } from './benchmark.mjs'

const output = resolve(process.argv[2] ?? 'benchmarks/rng/results/node.json')
const result = runRngBenchmark({
  runtime: 'node',
  version: process.version,
  platform: platform(),
  release: release(),
  architecture: arch(),
  cpu: process.env.BENCHMARK_CPU ?? 'not recorded',
})

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`)
console.log(output)
