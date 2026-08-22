// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // A worktree under `.claude/` is a second checkout of this repo, tests and all, so
    // without this a stale copy of the suite runs beside the real one — and passes, being
    // the code it shipped with. One of them hid 133 outdated tests among the real ones
    // and doubled every run until it was noticed.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
