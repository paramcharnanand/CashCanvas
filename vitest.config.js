import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/vitest.setup.js"],
    testTimeout: 20_000,
    hookTimeout: 60_000, // mongodb-memory-server's first-run binary download can be slow
    // Each test file spins up its own mongodb-memory-server instance (real
    // mongod processes) plus bcrypt hashing in signup flows. Running files
    // in parallel under CPU contention was observed to cause rare,
    // non-reproducible-in-isolation flakes (an occasional dropped/delayed
    // response manifesting as an unexpected 401 or a rate-limit count being
    // one short). Running files sequentially trades a few seconds of wall
    // time for deterministic runs — worth it for a suite this size.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      // text: quick human-readable summary in CI logs. html: browsable
      // report for local debugging (gitignored, not committed). lcov:
      // standard format most coverage tools (Codecov, Coveralls, editor
      // plugins) can consume — this repo doesn't upload anywhere yet (see
      // docs/engineering-lessons/phase-7-ci-cd.md), but the artifact is
      // ready for that the day it's wired up. json-summary: machine-
      // readable totals for a future PR-comment/badge step.
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // Only measure the code this suite actually exercises server-side —
      // the frontend (src/) has no test coverage yet (Phase 6/8 concern,
      // not this phase's job to fake a number for) and test files/config
      // shouldn't count towards their own coverage.
      include: ["api/**/*.js"],
      exclude: ["**/*.test.js", "**/*.config.js"],
    },
  },
});
