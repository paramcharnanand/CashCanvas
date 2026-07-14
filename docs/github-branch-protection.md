# Recommended Branch Protection Settings

This document is a **recommendation**, not a change log — nothing here has been applied. GitHub
branch protection lives in repository Settings, which this project's tooling deliberately does
not touch (see Phase 7 scope: CI/CD workflows are files in this repo; branch protection is a
GitHub setting, owned by whoever administers the repository). Apply these under **Settings →
Branches → Add branch protection rule** for `main`.

## Required status checks

Require these to pass before merging (they're the actual job names from
`.github/workflows/*.yml` — GitHub won't let you select a check that hasn't run at least once,
so merge one PR with the workflows present first if the list is empty):

- `Lint, test, build` (from `ci.yml`) — lint, the full Vitest suite, and a production build all
  have to succeed
- `npm audit` (from `security.yml`) — fails only on high/critical, actionable vulnerabilities
- `Dependency review` (from `security.yml`) — flags newly-introduced vulnerable/incompatible
  dependencies in the PR's diff specifically
- `Secret scanning` (from `security.yml`)

Also enable **"Require branches to be up to date before merging"** — otherwise a PR can pass
CI against a stale base and still introduce a conflict/regression once merged.

## Required reviews

- **Require at least 1 approving review** before merging. For a solo-maintainer project this is
  easy to work around (self-approve isn't possible, but a second maintainer or a scheduled
  self-review after a cooling-off period both work) — the point is making "did anyone besides
  the author look at this" a deliberate choice, not an accident.
- **Dismiss stale approvals when new commits are pushed** — an approval on commit A shouldn't
  silently cover commit B if the PR changed after review. This is the single highest-value,
  lowest-cost setting here: it's free, and it directly prevents "approved, then quietly
  changed" from ever being a real risk.

## Merge strategy

- **Require squash merging** (disable merge commits and rebase merging, or at minimum make
  squash the default). One commit per PR on `main` keeps history readable and keeps
  `git log --oneline` — which this project actively uses for context (see `CONTRIBUTING.md`'s
  commit conventions) — meaningful instead of cluttered with "fix typo" / "address review
  comment" noise.
- **Require linear history**. Combined with squash merging, this guarantees `main` is always a
  straight line — no merge commits, no surprise topology. Makes `git bisect` and rollback
  (`docs/release-process.md`) simpler because there's never an ambiguous "which parent" question.

## Signed commits (optional)

Recommended, not required. Enable **"Require signed commits"** if/when multiple people with
GPG/SSH signing already set up are contributing — it proves a commit actually came from the
account it claims to, which matters more as the contributor list grows past "just me." Not
worth the setup friction for a single maintainer today; revisit this the first time a second
regular contributor joins.

## Additional recommendations

- **Include administrators** in the branch protection rule — otherwise these rules are
  advisory for the repo owner and mandatory for everyone else, which defeats the point for a
  project explicitly trying to operate like "one maintained by a professional software team."
- **Restrict who can push directly to `main`** — force every change through a PR, including the
  maintainer's own. This is what actually makes the CI checks above meaningful: a required
  status check does nothing if someone can push straight past it.
- Do **not** require deployment reviews / environments-based approval gates for Vercel — the
  deployment itself is already fast, automatic, and covered by
  `.github/workflows/deploy-verify.yml`'s post-deploy checks; adding a manual approval gate in
  front of it would slow down the actual continuous-deployment model this project uses without
  a corresponding safety benefit (the CI checks above already gate what reaches `main`, which is
  the thing that triggers deployment).
