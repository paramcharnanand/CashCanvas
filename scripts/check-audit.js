#!/usr/bin/env node
// Wraps `npm audit --json` so CI fails on real, unaddressed high/critical
// risk while carving out exactly one reviewed, documented exception.
//
// npm's own `--audit-level` flag is all-or-nothing per severity — it can't
// express "fail on every high/critical EXCEPT this one GHSA ID". This
// script parses the JSON report itself so the allowlist stays narrow,
// explicit, and keyed by advisory ID (never by package name), so a *new*
// advisory against an already-allowlisted package still fails CI.
import { execSync } from "node:child_process";

// --- Accepted-risk allowlist --------------------------------------------
// Add an entry here ONLY after the advisory has been reviewed and formally
// accepted — see the matching ADR in ROADMAP.md for the rationale.
//
// To remove an exception: run `npm audit` and check whether a non-breaking
// fix now exists for the underlying package. If so, run `npm audit fix`
// (no --force) and delete the entry below.
export const ACCEPTED_RISKS = {
  "GHSA-qwww-vcr4-c8h2": {
    summary: "React Router RSC CSRF advisory",
    doc: "Documented in ADR-028 (ROADMAP.md).",
    reasons: ["application is not using RSC", "upstream non-breaking fix unavailable"],
  },
};

const FAILING_SEVERITIES = new Set(["high", "critical"]);
const GHSA_PATTERN = /advisories\/(GHSA-[a-z0-9-]+)/i;

// npm's JSON nests the actual advisory (with its GHSA URL) on the root
// vulnerable package; downstream packages that merely depend on it (e.g.
// react-router-dom depending on react-router) reference it by name in
// `via` instead of repeating the advisory object. Walk that chain to find
// the real GHSA ID(s) behind any given finding.
function resolveGhsaIds(pkgName, vulnerabilities, seen = new Set()) {
  if (seen.has(pkgName)) return [];
  seen.add(pkgName);
  const advisory = vulnerabilities[pkgName];
  if (!advisory) return [];

  const ids = new Set();
  for (const entry of advisory.via || []) {
    if (typeof entry === "string") {
      resolveGhsaIds(entry, vulnerabilities, seen).forEach((id) => ids.add(id));
    } else if (entry && typeof entry.url === "string") {
      const match = entry.url.match(GHSA_PATTERN);
      if (match) ids.add(match[1]);
    }
  }
  return [...ids];
}

// Pure function — no process access — so it's unit-testable without
// shelling out to npm.
export function evaluateReport(report, acceptedRisks = ACCEPTED_RISKS) {
  const vulnerabilities = report.vulnerabilities || {};
  const blocking = [];
  const accepted = new Set();

  for (const [pkgName, advisory] of Object.entries(vulnerabilities)) {
    if (!FAILING_SEVERITIES.has(advisory.severity)) continue;

    const ghsaIds = resolveGhsaIds(pkgName, vulnerabilities);
    const unaccepted = ghsaIds.filter((id) => !(id in acceptedRisks));

    if (ghsaIds.length > 0 && unaccepted.length === 0) {
      ghsaIds.forEach((id) => accepted.add(id));
      continue;
    }

    blocking.push({
      package: pkgName,
      severity: advisory.severity,
      advisories: unaccepted.length > 0 ? unaccepted : ["(no advisory URL found)"],
    });
  }

  return { blocking, accepted: [...accepted] };
}

function runAudit() {
  try {
    const stdout = execSync("npm audit --json", {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (err) {
    // npm audit exits non-zero whenever it finds ANY vulnerability — the
    // JSON report we need is still on stdout.
    if (err.stdout) return JSON.parse(err.stdout);
    throw err;
  }
}

function printAccepted(id, acceptedRisks) {
  const risk = acceptedRisks[id];
  console.log("------------------------------------------------");
  console.log("Accepted Risk:");
  console.log("");
  console.log(id);
  console.log(risk.summary);
  console.log("");
  console.log(risk.doc);
  console.log("");
  console.log("Not failing CI because:");
  for (const reason of risk.reasons) console.log(`- ${reason}`);
  console.log("------------------------------------------------");
}

function main() {
  const report = runAudit();
  const { blocking, accepted } = evaluateReport(report);

  for (const id of accepted) printAccepted(id, ACCEPTED_RISKS);

  if (blocking.length > 0) {
    console.error("\nBlocking vulnerabilities (not in the accepted-risk allowlist):\n");
    for (const finding of blocking) {
      console.error(`  ${finding.package} [${finding.severity}] ${finding.advisories.join(", ")}`);
    }
    console.error("\nnpm audit: FAILED.");
    process.exit(1);
  }

  console.log("\nnpm audit: no unaccepted high/critical vulnerabilities.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
