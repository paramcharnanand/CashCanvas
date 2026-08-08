# Release Process

CashCanvas deploys continuously: Vercel's native GitHub integration builds and deploys
**every push to `main`** automatically — there is no separate "cut a release" step distinct
from "merge to main" today. This document describes how to do that safely, how to roll back if
it goes wrong, and how versioning works given that model.

## Versioning strategy

`package.json`'s `version` field (currently `1.0.0`) is **not** bumped on every commit — that
would be noise given continuous deployment ships every merge anyway. Bump it at meaningful
milestones instead (a completed roadmap phase, a significant feature, a breaking API change),
following semantic versioning:

- **Patch** (`1.0.1`) — bug fixes, dependency updates, internal refactors with no behavior change
- **Minor** (`1.1.0`) — new features, backward-compatible API additions
- **Major** (`2.0.0`) — breaking changes (auth flow changes, removed endpoints, incompatible
  data-model migrations)

Tag the commit that bumps the version (`git tag v1.1.0 && git push --tags`) so
`https://github.com/<org>/CashCanvas/releases` has a real marker to diff against, even though
the deployment itself already happened on merge.

## Required secrets (for CI/CD workflows)

| Secret | Used by | Purpose |
|---|---|---|
| `VERCEL_TOKEN` | `.github/workflows/deploy-verify.yml` | Authenticates `vercel inspect` to confirm exactly 3 Serverless Functions are deployed. Generate at vercel.com → Account Settings → Tokens, add under this repo's Settings → Secrets and variables → Actions. Without it, the four HTTP-level checks in that workflow still run — only the function-count check is skipped, loudly, with an explanation. |

No other workflow in this repo needs a secret: `ci.yml` and `security.yml` run entirely against
the repo's own code and an ephemeral in-memory MongoDB the test suite creates itself.

## Release checklist

For a deliberate, milestone-worthy release (not every routine merge):

1. Confirm `main` is green: `.github/workflows/ci.yml` and `security.yml` both passing on the
   latest commit.
2. Bump `package.json`'s `version` per the strategy above.
3. Update `ROADMAP.md`'s progress table/percentage if a phase completed.
4. Update `CHECKPOINT.md` with the release commit hash and date.
5. Tag: `git tag vX.Y.Z && git push origin main --tags`.
6. Merge/push to `main` — Vercel deploys automatically.
7. Run the production deployment checklist below.

## Production deployment checklist

Since deployment is automatic on push, this is really a **post-deploy verification**
checklist — either run `.github/workflows/deploy-verify.yml` manually (Actions tab →
Deployment Verification → Run workflow), or do it by hand:

1. **Homepage loads**: `curl -o /dev/null -w '%{http_code}' https://cashcanvas.dev`
   → expect `200`.
2. **All 3 functions respond**: `/api/auth/profile`, `/api/files`, and a `POST` to
   `/api/categorize` should each return `401` unauthenticated (proves the function is alive and
   routed correctly — a 404/5xx/timeout means something broke).
3. **Exactly 3 Serverless Functions deployed**: `vercel inspect <url> --token $VERCEL_TOKEN` and
   count the `λ` lines under Builds. More than 3 means a new file landed directly under `api/`
   instead of `api/_lib/` — see `docs/security/threat-model.md` and ROADMAP.md's ADR on the
   underscore-prefix exclusion convention for why this matters (it's what keeps the deploy under
   the Hobby plan's 12-function cap; this exact class of regression broke production once
   already).
4. **No new warnings in the Vercel build log** beyond the known, pre-existing Vite chunk-size
   advisory (`vercel inspect <url> --logs`).
5. **Build parity** (only if you suspect a toolchain drift issue): compare `npm run build`'s
   local output size/module count against the deployed bundle. If `node_modules/vite`'s
   installed version doesn't match `package-lock.json`'s locked version, run `npm ci` to resync
   before comparing — this exact drift caused a false alarm once (see `CHECKPOINT.md`'s
   Deployment Verification section from the prior release).

## Rollback process

Two options, in order of preference:

### Option A — Instant rollback (fastest, no rebuild)

Vercel keeps every previous deployment. If the current production deploy is broken:

```bash
npx vercel rollback <previous-deployment-url> --token $VERCEL_TOKEN
```

Or via the dashboard: Deployments tab → find the last known-good deployment → "..." menu →
"Promote to Production". This re-points the production alias instantly with no new build —
the fastest way to stop user-facing breakage while you diagnose the actual fix.

### Option B — Revert commit (when the rollback itself needs to be permanent/tracked)

```bash
git revert <bad-commit-sha>
git push origin main
```

This triggers a normal new deployment from the reverted code — slower (waits for a full build)
but leaves a clear, permanent record in git history of what was reverted and why, which Option
A alone doesn't provide (an instant rollback doesn't change what's in `main`, so the "bad" code
is still there waiting to be reintroduced by the next unrelated merge unless someone reverts it
properly). Use Option A to stop the bleeding immediately, then follow up with Option B so the
fix is durable.

### After any rollback

- Re-run the production deployment checklist above against the now-restored deployment.
- Update `CHECKPOINT.md` documenting what broke, what was rolled back to, and the follow-up fix.
- If the break was caught by neither CI nor `deploy-verify.yml`, that's a gap — add a check
  that would have caught it (see `docs/engineering-lessons/phase-7-ci-cd.md` for how this
  project's pipeline is structured).
