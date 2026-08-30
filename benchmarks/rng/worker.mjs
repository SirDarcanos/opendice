// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

import { runRngBenchmark } from './benchmark.mjs'

export default {
  fetch() {
    return Response.json(
      runRngBenchmark({
        runtime: 'workerd',
        userAgent: 'Cloudflare workerd',
      }),
    )
  },
}
