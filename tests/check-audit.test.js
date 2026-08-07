import { describe, it, expect } from "vitest";
import { evaluateReport, ACCEPTED_RISKS, assertUsableReport } from "../scripts/check-audit.js";

function advisory({ severity, url, viaPackage }) {
  return {
    severity,
    isDirect: false,
    via: viaPackage ? [viaPackage] : [{ source: 1, name: "pkg", url, severity }],
    effects: [],
  };
}

describe("evaluateReport", () => {
  it("passes when the only high finding is the accepted react-router advisory", () => {
    const report = {
      vulnerabilities: {
        "react-router": advisory({
          severity: "high",
          url: "https://github.com/advisories/GHSA-qwww-vcr4-c8h2",
        }),
        "react-router-dom": advisory({ severity: "high", viaPackage: "react-router" }),
      },
    };

    const result = evaluateReport(report);

    expect(result.blocking).toEqual([]);
    expect(result.accepted).toEqual(["GHSA-qwww-vcr4-c8h2"]);
  });

  it("fails on a new, unlisted high-severity advisory", () => {
    const report = {
      vulnerabilities: {
        "js-yaml": advisory({
          severity: "high",
          url: "https://github.com/advisories/GHSA-5p4m-2wfm-xmqj",
        }),
      },
    };

    const result = evaluateReport(report);

    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0]).toMatchObject({
      package: "js-yaml",
      severity: "high",
      advisories: ["GHSA-5p4m-2wfm-xmqj"],
    });
  });

  it("fails on any critical-severity advisory, even for an allowlisted package", () => {
    const report = {
      vulnerabilities: {
        "react-router": advisory({
          severity: "critical",
          url: "https://github.com/advisories/GHSA-new-critical-id",
        }),
      },
    };

    const result = evaluateReport(report);

    expect(result.blocking).toHaveLength(1);
  });

  it("does not gate on moderate/low severity findings", () => {
    const report = {
      vulnerabilities: {
        postcss: advisory({
          severity: "moderate",
          url: "https://github.com/advisories/GHSA-some-moderate-id",
        }),
      },
    };

    const result = evaluateReport(report);

    expect(result.blocking).toEqual([]);
    expect(result.accepted).toEqual([]);
  });

  it("passes on a clean report", () => {
    expect(evaluateReport({ vulnerabilities: {} })).toEqual({ blocking: [], accepted: [] });
  });

  it("still fails a different GHSA ID against an already-allowlisted package", () => {
    const report = {
      vulnerabilities: {
        "react-router": advisory({
          severity: "high",
          url: "https://github.com/advisories/GHSA-different-id-0000",
        }),
      },
    };

    const result = evaluateReport(report, ACCEPTED_RISKS);

    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0].advisories).toEqual(["GHSA-different-id-0000"]);
  });
});

describe("assertUsableReport", () => {
  it("does not throw on a clean report shape (vulnerabilities: {})", () => {
    expect(() => assertUsableReport({ vulnerabilities: {} })).not.toThrow();
  });

  it("does not throw on a report with real findings", () => {
    expect(() =>
      assertUsableReport({
        vulnerabilities: { "react-router": { severity: "high", via: [] } },
      })
    ).not.toThrow();
  });

  it("throws on the shape npm audit emits for a registry/network failure (no vulnerabilities key)", () => {
    const registryFailure = {
      message:
        "request to https://registry.npmjs.org/react-router failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org",
      error: { code: "ENOTFOUND" },
    };

    expect(() => assertUsableReport(registryFailure)).toThrow(/vulnerabilities/i);
  });
});
