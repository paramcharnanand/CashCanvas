# Phase 7 Engineering Lessons: CI/CD, Explained for a Junior Developer

This document teaches the concepts behind Phase 7, using this actual project — CashCanvas — as
the running example. If you're new to CI/CD, read this before touching
`.github/workflows/*.yml`. Everything here is grounded in something real that happened in this
repository, not a hypothetical.

## What is CI (Continuous Integration)?

CI means: **every time someone proposes a change, a robot automatically checks that the change
doesn't break anything, before a human has to.**

"Integration" refers to the old, painful way software used to get built: everyone worked on
their own branch for weeks, then tried to merge it all together at once, and *that's* when you
discovered your change conflicted with someone else's, or broke a test, or didn't even compile.
CI's whole idea is: integrate constantly (every push, every PR), in small pieces, so problems
show up in minutes, not weeks.

**In this repo:** `.github/workflows/ci.yml` runs on every `push` and every `pull_request`. It
lints the code, runs the full Vitest suite (84 tests when Phase 7 shipped this workflow; run
`npm test` for today's real count), and builds the production bundle. If any of those fail, you
find out on the PR page — not after it's merged, not after it's deployed, not after a user hits
it.

## What is CD (Continuous Deployment)?

CD means: **once a change passes all the checks, it goes live automatically — no human has to
manually click "deploy."**

CashCanvas already has this, and it happened before Phase 7 even started: Vercel's GitHub
integration watches this repo, and every push to `main` triggers an automatic build and
deploy. That's genuinely continuous deployment — there's no separate "release" button.

What Phase 7 adds isn't the deployment itself — it's the **safety net around it**:
`.github/workflows/deploy-verify.yml` runs *after* Vercel reports a successful deploy and
checks that the live site actually works (homepage loads, the three API functions respond,
exactly 3 Serverless Functions exist — not 18, which is a real bug this project hit and fixed).
Deploying automatically is only safe if something is also automatically checking that what got
deployed is actually correct.

## Why GitHub Actions?

GitHub Actions is GitHub's own CI/CD runner, built into the same place the code already lives.
The alternative would be a separate service (CircleCI, Jenkins, Travis) that you'd have to
connect to GitHub, pay for separately, and configure permissions for. Since this repo is
already on GitHub, GitHub Actions means:

- Workflows live in the repo itself (`.github/workflows/*.yml`), version-controlled like any
  other code — you can see exactly what changed and when, in the same `git log`.
- No separate account, no separate billing, no separate place to configure secrets.
- It reacts natively to GitHub events (`push`, `pull_request`, and — used by
  `deploy-verify.yml` — `deployment_status`, which Vercel's GitHub integration posts).

## Why `npm ci` instead of `npm install` in CI?

This one has a real story attached to it. Late in this project, a check found that the local
development machine had `vite@6.4.1` installed, but the committed `package-lock.json` actually
locked `vite@6.4.3` — the version Vercel's servers installed fresh. The local and deployed
builds produced slightly different output because of this drift.

`npm install` will, under some circumstances, update `node_modules` in ways that don't
perfectly match what's frozen in `package-lock.json` — it's designed to be flexible. `npm ci`
does the opposite on purpose: it deletes `node_modules` first, then installs **exactly** what
the lockfile says, and it **fails outright** if `package.json` and `package-lock.json` disagree
about anything. That's precisely the property you want in CI: you're not trying to be flexible,
you're trying to prove that what gets tested and built is *exactly* what's committed — nothing
more, nothing less, nothing silently different from what a teammate would get.

```yaml
# .github/workflows/ci.yml
- name: Install dependencies
  run: npm ci
```

## Why caching dependencies matters

Installing every npm package from scratch on every single CI run is slow — this project has
~500 packages once devDependencies are counted, and downloading all of them takes real time on
every push. Caching means: if `package-lock.json` hasn't changed since the last run, reuse the
previously-downloaded packages instead of fetching them all again.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "24.x"
    cache: "npm" # <- this line does the caching
```

`actions/setup-node`'s built-in cache keys itself off the hash of `package-lock.json`
automatically — change a dependency, get a fresh cache; don't change it, reuse the old one.
This is the difference between a CI run taking 10 seconds to install dependencies versus a
minute or more, on every single push.

## Why lint runs before tests

Order matters for a simple reason: **fail fast, and fail cheap first.**

ESLint checking this whole codebase takes about a second. The full test suite — which spins up
real in-memory MongoDB instances, hashes real passwords with bcrypt, and runs the entire Vitest
suite — takes around 10-25 seconds depending on suite size. If a change has an obvious problem
ESLint can catch (an unused variable,
a duplicate object key, calling a hook conditionally), there's no reason to make the CI run wait
through 13 seconds of test setup just to report something a 1-second check already knew.

This project's linter caught a real bug this way: `api/_lib/transaction-cleaner.js` had the key
`AMZN` defined twice in the same object (`no-dupe-keys`, a rule that's part of ESLint's default
recommended set). It happened to map to the same value both times, so it was never going to
cause a test to fail — but it was genuinely dead, confusing code that a human reviewer had
missed. Lint caught it in under a second; no test would ever have caught it at all, because
nothing about the *behavior* was wrong, just the code's clarity.

## Why automated tests protect the project

A test is a promise that gets checked automatically, forever, every time anything changes. The
alternative — "I tested it manually, it worked" — is a promise that gets checked exactly once,
by one person, and is never checked again. Six months later, when someone else changes
something nearby, nothing tells them they just broke the thing you tested manually back then.

This project has a very concrete example of *why* this matters, not just an abstract one.
During Phase 4, a bug was found where CSV/formula-injection payloads (`=cmd|'/c calc'!A1`) in a
transaction description would get stored raw and later exported into a spreadsheet, where
Excel would interpret them as a formula. The fix was a few lines
(`sanitizeCsvField()` in `api/_lib/validation.js`). The regression test
(`tests/security.test.js`, "CSV/formula injection sanitization") is what actually proves that
fix keeps working — not just today, but the next time anyone touches upload handling, six
months from now, without necessarily remembering this specific threat existed.

**The Vitest suite protects this project on every single push** (`npm test` — run it to see
today's real count; it was 84 tests when this workflow first shipped and has grown since) —
covering authentication, sessions, CSRF, rate limiting, input validation, CSV injection,
duplicate uploads, and logging hygiene. Every one of them runs automatically, forever, which is
the entire point.

## Why branch protection matters

CI checks are only meaningful if they're actually *required*. Without branch protection, a
passing or failing check on a PR is just information — someone can merge (or push directly to
`main`) regardless of what it says. Branch protection is the GitHub *setting* that turns "CI
ran and reported a result" into "CI has to pass, or the merge button is disabled."

This project's specific recommendations are in `docs/github-branch-protection.md` — required
status checks, required reviews, dismissing stale approvals, squash merging for a clean
history. None of that is applied automatically by writing workflow files; it's a separate,
deliberate step a repository administrator takes in GitHub's Settings tab.

## What are artifacts?

An artifact is a file (or folder) a CI run produces that you want to keep and look at *after*
the run finishes — CI runners are temporary; once the job ends, everything on disk in that
runner is gone unless you explicitly save it as an artifact.

```yaml
# .github/workflows/ci.yml
- name: Upload test coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
```

This project uploads two: the **coverage report** (so you can click into a specific CI run on
GitHub and see exactly which lines were and weren't exercised by tests) and the **production
build** (`dist/`, so you can download and inspect exactly what would have been deployed, without
having to rebuild it locally).

## What do coverage reports mean?

Coverage measures **which lines of code actually ran** while the test suite executed — not
whether the code is *correct*, just whether a test ever touched it at all. 100% coverage
doesn't mean "no bugs"; it means "every line was executed by some test," which is a much weaker
claim (a test can execute a line and still fail to check whether it did the right thing).

Coverage is most useful as a *map of blind spots* — code with 0% coverage has literally never
been run by anything you'd notice breaking. Running `npm run test:coverage` in this project
currently shows the backend (`api/`) at roughly 52% statement coverage — some modules like
`api/_lib/validation.js` are near 100% (it's pure, easily-tested logic), while others like
`api/_lib/recaptcha.js` are much lower (it mostly wraps a real external network call, which the
test suite deliberately doesn't hit — see `tests/vitest.setup.js` disabling reCAPTCHA in tests).
Low coverage on a thin wrapper around an external API is a completely different situation from
low coverage on core business logic — coverage percentage alone doesn't tell you which one
you're looking at; you have to actually look.

## What does Dependabot do?

Dependabot is GitHub's automated dependency-update bot. It watches `package.json` (and, in this
repo, the GitHub Actions workflow files too — see `.github/dependabot.yml`), and when a newer
version of something is published, it opens a PR bumping it.

Left unconfigured, this means dozens of tiny PRs, one per package, most of which are trivial
patch bumps. This project's `.github/dependabot.yml` groups minor/patch updates together into
one weekly PR instead, and — this is the important part — **explicitly refuses to
auto-propose major version bumps**, requiring a human to evaluate those individually.

Why that distinction matters, concretely: this project once had to upgrade `nodemailer` across
a major version (6 → 9) to clear a security vulnerability. That upgrade needed a real decision —
checking exactly which APIs this app actually used, confirming none of the breaking changes in
that major version touched them, and verifying with a live test before trusting it (see
ROADMAP.md's ADR-013). A bot cannot make that judgment call; a human has to. Major-version
Dependabot PRs are intentionally excluded from auto-grouping so that judgment call always
happens, every time, instead of being silently rubber-stamped.

## How this project's CI/CD pipeline actually works, end to end

Put together, here's what happens when you push a commit to CashCanvas:

1. **You push** (to any branch, or open a PR).
2. **`ci.yml` runs**: checkout → Node 24.x setup (with npm cache) → `npm ci` → lint → tests
   with coverage → production build → upload coverage + build artifacts. Any failure stops
   here and shows up on the PR/commit.
3. **`security.yml` runs in parallel**: `npm audit` (fails only on high/critical), dependency
   review (PRs only — diffs what a PR is adding), and secret scanning across the diff/history.
4. If you're merging to `main` and everything above passed: **Vercel deploys automatically**
   (this part isn't a workflow file in this repo — it's Vercel's own GitHub integration,
   already connected before Phase 7 started).
5. **Vercel reports a `deployment_status` event** back to GitHub once the deploy finishes.
6. **`deploy-verify.yml` reacts to that event**: checks the homepage loads, all three API
   functions respond correctly, and — critically — that exactly 3 Serverless Functions were
   deployed, not more. This last check exists because this exact project once broke production
   by accidentally exceeding Vercel's Hobby-plan function limit (18 files got detected as
   functions instead of the intended 3) — this workflow is what makes sure that specific class
   of regression can never silently reach production again.
7. **Weekly**, independent of any push: `security.yml`'s schedule re-runs `npm audit` (so a
   newly-published vulnerability against an *unchanged* dependency still gets caught), and
   Dependabot checks for updates.

Every piece of this exists because something concrete either already went wrong once (the
function-count bug, the `vite` version drift, the duplicate `AMZN` key, the flaky test caused by
a stale MongoDB connection cache) or is a known, well-understood risk this project's threat
model already documents (`docs/security/threat-model.md`). None of it is generic
best-practice-for-its-own-sake — read `ROADMAP.md`'s Architecture Decision Records if you want
the specific reasoning behind any individual piece.
