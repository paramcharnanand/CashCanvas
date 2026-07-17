import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * Flat ESLint config, scoped per part of the codebase rather than one
 * blanket ruleset — the backend (api/, server.js) is Node ESM with no DOM,
 * the frontend (src/) is browser React, and tests (tests/) are Node but
 * import Vitest's test globals explicitly rather than relying on injected
 * globals. See docs/engineering-lessons/phase-7-ci-cd.md for why lint runs
 * before tests in CI.
 */
export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },

  js.configs.recommended,

  // ── Backend: api/, server.js — Node, ESM ──────────────────────────────────
  {
    files: ["api/**/*.js", "server.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // ── Frontend: src/ — browser, React ───────────────────────────────────────
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules, // React 18 automatic JSX runtime — no `import React` required
      // Only the two classic, universally-accepted hook rules: rules-of-hooks
      // catches actual bugs (hooks called conditionally/out of order);
      // exhaustive-deps is a best-practice hint, not a hard error. NOT using
      // reactHooks.configs.recommended wholesale — v7's "recommended" is the
      // new React Compiler rule family (set-state-in-effect, immutability,
      // purity, etc.), which flags long-standing, working patterns
      // throughout App.jsx that were never written against these rules.
      // Adopting them now would mean rewriting completed, shipped, tested
      // code to satisfy a linter's opinion — out of scope for introducing
      // CI, not a correctness fix. Revisit if this project ever adopts the
      // React Compiler.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react/prop-types": "off", // no PropTypes anywhere in this codebase — not retrofitting them here
      // Cosmetic-only (unescaped apostrophes in JSX text, regex/string
      // escapes that don't change meaning) — real findings, but fixing ~40
      // occurrences across App.jsx is a mass edit unrelated to standing up
      // CI. Kept as warnings so they're visible without failing the build;
      // fix incrementally.
      "react/no-unescaped-entities": "warn",
      "no-useless-escape": "warn",
    },
  },

  // ── Tests: tests/ — Node, Vitest (globals imported explicitly, not injected) ──
  {
    files: ["tests/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Playwright fixtures and hooks are called with a positional fixtures
      // object even when a given fixture/hook needs none of them — `({},
      // use) => {...}` is the standard Playwright idiom for "no fixtures
      // needed here", not a mistake. This is exactly what
      // allowObjectPatternsAsParameters exists for.
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
    },
  },

  // ── Config files at the repo root — Node ──────────────────────────────────
  {
    files: ["*.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
