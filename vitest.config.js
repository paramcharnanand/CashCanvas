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
  },
});
