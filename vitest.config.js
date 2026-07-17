import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Vitest's own default include (`**/*.{test,spec}.*`) has no knowledge
    // of Playwright — it was also collecting tests/e2e/*.spec.js and trying
    // to run Playwright's `test.describe()` outside the Playwright runner,
    // which crashes immediately. Extend (not replace) the default exclude
    // list so Vitest keeps ignoring node_modules/.git going forward too.
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
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
      // A floor, not an aspiration — set just under this session's actual
      // numbers (52.2%/46%/75%/54.9%) so it fails the build on a real
      // regression without chasing 100% on code this project has
      // deliberately left untested on purpose (the OTP/email-verification
      // branches in api/auth.js and api/_lib/mailer.js, unreachable without
      // real GMAIL_USER/GMAIL_APP_PASSWORD credentials — see
      // tests/vitest.setup.js and ROADMAP.md's nodemailer live-send note).
      // Raise these deliberately as real coverage grows; this isn't meant to
      // be hit exactly.
      thresholds: {
        statements: 50,
        branches: 42,
        functions: 70,
        lines: 52,
      },
    },
  },
});
