// CONTRACT §10.7 says this plugin inherits poc-accelerator's git contract
// "verbatim" (原样继承). That sentence is only true if something checks it.
//
// A sensor cannot import across plugins — it runs from the hook path and must not
// fail because a sibling plugin was not installed — so the git-remote judgement is
// necessarily duplicated in both plugins' sensor tools. This file is what keeps
// the duplication from drifting: same inputs, same verdict, or a red test naming
// the URL that diverged.
//
// poc's sensors run their `main()` unconditionally at import, so they are driven
// as subprocesses (exactly how the dispatcher calls them). This plugin's export
// their `check*` functions, so they are called directly.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDeposit } from "../tools/aidlc-sensor-akp-push.ts";
import { checkPull } from "../tools/aidlc-sensor-akp-pull.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const POC_DEPOSIT_TOOL = join(
  HERE,
  "..",
  "..",
  "poc-accelerator",
  "tools",
  "aidlc-sensor-poc-accelerator-team-knowledge-deposit.ts",
);
const POC_ARTIFACT = "poc-accelerator-team-knowledge-deposit.md";

/** Every git remote form git itself accepts as a fetch/push URL. */
const ACCEPTED = [
  "https://example.com/team/kb.git",
  "http://example.com/team/kb",
  "ssh://git@example.com/team/kb.git",
  "git://example.com/kb",
  "file:///srv/git/kb.git",
  "git@example.com:team/kb.git",
  "user@example.com:kb.git",
];

/**
 * Refused, each for a stated reason — a bare local directory, a Windows drive
 * letter (which is a directory, not a remote), a bare host with no path, an
 * unsupported scheme, a scheme with no path, and whitespace.
 */
const REFUSED = [
  "/Users/me/kb",
  "./kb",
  "kb",
  "C:/repos/kb",
  "example.com",
  "ftp://example.com/kb",
  "https://example.com",
  "https://example.com/",
  "file://relative/path",
  "https://exa mple.com/kb",
  "",
];

function pocFaultsUrl(url: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), "akp-inherit-"));
  const path = join(dir, POC_ARTIFACT);
  writeFileSync(
    path,
    "# Deposit\n\n```yaml\ndeposit:\n" +
      "  resolution: branch-pushed\n" +
      (url === "" ? "" : `  repo_url: ${url}\n`) +
      "  repo_probe: git-ls-remote-ok\n" +
      "  sanitization_approved_by: named owner\n" +
      "  entries:\n    - x (knows, industry-generic)\n" +
      "  branch: b\n  owner: named owner\n```\n",
  );
  const proc = Bun.spawnSync([process.execPath, POC_DEPOSIT_TOOL, "--output-path", path]);
  const out = new TextDecoder().decode(proc.stdout).trim();
  const parsed = JSON.parse(out) as { findings: string[] };
  return parsed.findings.some((f) => f.startsWith("repo_url"));
}

function akpPushFaultsUrl(url: string): boolean {
  const result = checkDeposit(
    "# Deposit\n\n```yaml\ndeposit:\n" +
      "  resolution: branch-pushed\n" +
      (url === "" ? "" : `  repo_url: ${url}\n`) +
      "  repo_probe: git-ls-remote-ok\n" +
      "  validate: akp-validate-ok\n" +
      "  sanitization_approved_by: human:alice\n" +
      "  cards:\n    - practices/x/y\n" +
      "  branch: b\n  owner: human:bob\n```\n",
  );
  return result.findings.some((f) => f.startsWith("repo_url"));
}

function akpPullFaultsUrl(url: string): boolean {
  const result = checkPull(
    "# Pull\n\n```yaml\npull:\n" +
      "  resolution: no-card-match\n" +
      (url === "" ? "" : `  repo_url: ${url}\n`) +
      "  repo_probe: git-ls-remote-ok\n" +
      "  sources_searched:\n    - x\n" +
      "  search_terms:\n    - t\n```\n",
  );
  return result.findings.some((f) => f.startsWith("repo_url"));
}

describe("§10.7 — the inherited git-remote judgement does not drift", () => {
  for (const url of ACCEPTED) {
    test(`accepted by all three sensors: ${url}`, () => {
      expect(pocFaultsUrl(url)).toBe(false);
      expect(akpPushFaultsUrl(url)).toBe(false);
      expect(akpPullFaultsUrl(url)).toBe(false);
    });
  }

  for (const url of REFUSED) {
    test(`refused by all three sensors: ${url === "" ? "(absent)" : url}`, () => {
      expect(pocFaultsUrl(url)).toBe(true);
      expect(akpPushFaultsUrl(url)).toBe(true);
      expect(akpPullFaultsUrl(url)).toBe(true);
    });
  }
});

describe("§10.7 — the inherited resolution vocabulary does not drift", () => {
  test("the deposit side keeps poc's exact three outcomes, and no skip value", () => {
    const poc = readVocabulary(POC_DEPOSIT_TOOL);
    const akp = readVocabulary(join(HERE, "..", "tools", "aidlc-sensor-akp-push.ts"));
    expect(akp).toEqual(poc);
    expect(akp).toEqual(["merge-request-opened", "branch-pushed", "patch-prepared"]);
    for (const skipish of ["skip", "skipped", "none", "not-applicable", "nothing-to-deposit"]) {
      expect(akp).not.toContain(skipish);
    }
  });
});

/** Read the RESOLUTIONS tuple out of a sensor source, without importing it. */
function readVocabulary(toolPath: string): string[] {
  const source = require("node:fs").readFileSync(toolPath, "utf-8") as string;
  const m = source.match(/const RESOLUTIONS = \[([^\]]*)\]/);
  if (!m) throw new Error(`no RESOLUTIONS tuple in ${toolPath}`);
  return [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1] as string);
}
