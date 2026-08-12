// Field-level pin tests for the poc-accelerator team-knowledge sensors.
//
// WHY BLACK-BOX: these tests were written BEFORE the team-knowledge
// convergence touched either sensor, and their whole job is to pin the CURRENT
// verdicts so "原 sensor 判定不变" (CONTRACT §12 P5's completion criterion) is a
// verifiable claim rather than an assertion. So they invoke the tools exactly as
// the sensor dispatcher does — a real subprocess, `--stage` + `--output-path`,
// JSON on stdout — instead of importing internals. That also pins the parts an
// import could not reach: the exit codes, the pass-through on a write the sensor
// does not own, and the missing-flag failure.
//
// If a change here goes red, the sensor's contract moved. That is either a bug or
// a deliberate contract change that belongs in the plugin's README and in
// team-knowledge/CONTRACT.md §0 — never a quiet test edit.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(HERE, "..", "tools");
const PREFLIGHT_TOOL = join(TOOLS, "aidlc-sensor-poc-accelerator-team-knowledge-preflight.ts");
const DEPOSIT_TOOL = join(TOOLS, "aidlc-sensor-poc-accelerator-team-knowledge-deposit.ts");
const PREFLIGHT_ARTIFACT = "poc-accelerator-team-knowledge-preflight.md";
const DEPOSIT_ARTIFACT = "poc-accelerator-team-knowledge-deposit.md";

interface SensorResult {
  pass: boolean;
  findings_count: number;
  findings: string[];
  resolution: string;
}

interface Run {
  exitCode: number;
  result: SensorResult | null;
  stderr: string;
}

/** Invoke a sensor the way the dispatcher does: real process, real file. */
function runSensor(tool: string, filename: string | null, content: string | null, stage = "step"): Run {
  const dir = mkdtempSync(join(tmpdir(), "poc-sensor-"));
  const args = [process.execPath, tool, "--stage", stage];
  if (filename !== null) {
    const path = join(dir, filename);
    if (content !== null) writeFileSync(path, content);
    args.push("--output-path", path);
  }
  const proc = Bun.spawnSync(args);
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  let result: SensorResult | null = null;
  if (stdout !== "") {
    try {
      result = JSON.parse(stdout) as SensorResult;
    } catch {
      result = null;
    }
  }
  return { exitCode: proc.exitCode ?? -1, result, stderr: new TextDecoder().decode(proc.stderr) };
}

function preflight(block: string): SensorResult {
  const run = runSensor(PREFLIGHT_TOOL, PREFLIGHT_ARTIFACT, `# Preflight\n\n\`\`\`yaml\npreflight:\n${block}\`\`\`\n`);
  if (run.result === null) throw new Error(`no JSON on stdout (exit ${run.exitCode}): ${run.stderr}`);
  return run.result;
}

function deposit(block: string): SensorResult {
  const run = runSensor(DEPOSIT_TOOL, DEPOSIT_ARTIFACT, `# Deposit\n\n\`\`\`yaml\ndeposit:\n${block}\`\`\`\n`);
  if (run.result === null) throw new Error(`no JSON on stdout (exit ${run.exitCode}): ${run.stderr}`);
  return run.result;
}

const PREFLIGHT_BASE =
  "  repo_url: https://example.com/team/knowledge.git\n" +
  "  repo_url_source: memory-layer\n" +
  "  repo_probe: git-ls-remote-ok\n" +
  "  probed_at: 2026-08-11\n" +
  "  sources_searched:\n    - aidlc/spaces/default/knowledge/aidlc-shared/\n";

const DEPOSIT_BASE =
  "  repo_url: https://example.com/team/knowledge.git\n" +
  "  repo_url_source: preflight-artifact\n" +
  "  repo_probe: git-ls-remote-ok\n" +
  "  probed_at: 2026-08-11\n" +
  "  sanitization_approved_by: named data owner\n" +
  "  entries:\n    - Mock data must be synthetic (judges, industry-generic)\n";

// --- the dispatcher-facing contract, shared by both sensors -------------------

describe("poc-accelerator team-knowledge sensors — dispatcher contract", () => {
  for (const [name, tool, artifact] of [
    ["preflight", PREFLIGHT_TOOL, PREFLIGHT_ARTIFACT],
    ["deposit", DEPOSIT_TOOL, DEPOSIT_ARTIFACT],
  ] as const) {
    test(`${name}: passes through a write it does not own`, () => {
      const run = runSensor(tool, "some-other-artifact.md", "# not ours\n");
      expect(run.exitCode).toBe(0);
      expect(run.result).toEqual({ pass: true, findings_count: 0, findings: [], resolution: "not-applicable" });
    });

    test(`${name}: passes through when its own artifact does not exist yet`, () => {
      const run = runSensor(tool, artifact, null);
      expect(run.exitCode).toBe(0);
      expect(run.result?.resolution).toBe("not-applicable");
    });

    test(`${name}: fails loudly without --output-path`, () => {
      const run = runSensor(tool, null, null);
      expect(run.exitCode).toBe(1);
      expect(run.stderr).toContain("--output-path is required");
    });

    test(`${name}: exits 0 even when the record is bad — ADVISORY, never blocking`, () => {
      const run = runSensor(tool, artifact, "# record with no yaml block at all\n");
      expect(run.exitCode).toBe(0);
      expect(run.result?.pass).toBe(false);
      expect(run.result?.resolution).toBe("missing");
    });

    test(`${name}: the LAST matching block wins, so a prose example cannot shadow the record`, () => {
      const opener = name === "preflight" ? "preflight" : "deposit";
      const example = `\`\`\`yaml\n${opener}:\n  resolution: nonsense\n\`\`\`\n`;
      const real =
        name === "preflight"
          ? `\`\`\`yaml\npreflight:\n  resolution: no-pack-match\n${PREFLIGHT_BASE}  search_terms:\n    - wind\n\`\`\`\n`
          : `\`\`\`yaml\ndeposit:\n  resolution: branch-pushed\n${DEPOSIT_BASE}  branch: knowledge/2026-08-11-x\n  owner: named owner\n\`\`\`\n`;
      const run = runSensor(tool, artifact, `# doc\n\n${example}\nprose\n\n${real}`);
      expect(run.result?.pass).toBe(true);
    });
  }
});

// --- preflight ---------------------------------------------------------------

describe("poc-accelerator-team-knowledge-preflight — field verdicts", () => {
  test("a complete pack-imported record passes", () => {
    const r = preflight(`  resolution: pack-imported\n${PREFLIGHT_BASE}  pack: wind-energy\n  import_path: aidlc/spaces/default/knowledge/aidlc-shared/wind.md\n`);
    if (!r.pass) throw new Error(r.findings.join("\n"));
    expect(r.resolution).toBe("pack-imported");
  });

  test("a complete no-pack-match record passes — an unmatched search is a resolution", () => {
    const r = preflight(`  resolution: no-pack-match\n${PREFLIGHT_BASE}  search_terms:\n    - wind farm\n    - power trading\n`);
    if (!r.pass) throw new Error(r.findings.join("\n"));
  });

  test("there is no skip resolution", () => {
    for (const value of ["skipped", "not-applicable", "deferred", ""]) {
      const r = preflight(`  resolution: ${value}\n${PREFLIGHT_BASE}`);
      expect(r.pass).toBe(false);
      expect(r.findings.join(" ")).toContain("is not one of: pack-imported, no-pack-match");
    }
  });

  test("repo_url must be a git remote — a bare local directory is refused", () => {
    for (const url of ["/Users/me/kb", "./kb", "C:/repos/kb", "example.com", "ftp://host/kb"]) {
      const r = preflight(`  resolution: no-pack-match\n  repo_url: ${url}\n  repo_probe: git-ls-remote-ok\n  sources_searched:\n    - x\n  search_terms:\n    - t\n`);
      expect(r.pass).toBe(false);
      expect(r.findings.join(" ")).toContain("is not a git remote URL");
    }
  });

  test("every git remote form git itself accepts is accepted here", () => {
    for (const url of [
      "https://example.com/team/kb.git",
      "http://example.com/team/kb",
      "ssh://git@example.com/team/kb.git",
      "git://example.com/kb",
      "file:///srv/git/kb.git",
      "git@example.com:team/kb.git",
    ]) {
      const r = preflight(`  resolution: no-pack-match\n  repo_url: ${url}\n  repo_probe: git-ls-remote-ok\n  sources_searched:\n    - x\n  search_terms:\n    - t\n`);
      if (!r.pass) throw new Error(`${url}: ${r.findings.join("; ")}`);
    }
  });

  test("an unrecorded or failed probe is not a resolution", () => {
    for (const probe of ["", "failed", "ls-remote-failed", "ok"]) {
      const r = preflight(`  resolution: no-pack-match\n  repo_url: https://example.com/team/kb.git\n${probe === "" ? "" : `  repo_probe: ${probe}\n`}  sources_searched:\n    - x\n  search_terms:\n    - t\n`);
      expect(r.pass).toBe(false);
      expect(r.findings.join(" ")).toContain('is not "git-ls-remote-ok"');
    }
  });

  test("sources_searched must name at least one searched place", () => {
    const r = preflight(`  resolution: no-pack-match\n  repo_url: https://example.com/team/kb.git\n  repo_probe: git-ls-remote-ok\n  search_terms:\n    - t\n`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("sources_searched is empty or absent");
  });

  test("pack-imported requires pack and import_path", () => {
    const r = preflight(`  resolution: pack-imported\n${PREFLIGHT_BASE}`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("pack-imported requires a non-empty pack:");
    expect(r.findings.join(" ")).toContain("pack-imported requires a non-empty import_path:");
  });

  test("no-pack-match requires search_terms — an unmatched search is still auditable", () => {
    const r = preflight(`  resolution: no-pack-match\n${PREFLIGHT_BASE}`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("no-pack-match requires a non-empty search_terms:");
  });

  test("repo_url_source is checked only when present, against its own two values", () => {
    const absent = preflight(`  resolution: no-pack-match\n  repo_url: https://example.com/team/kb.git\n  repo_probe: git-ls-remote-ok\n  sources_searched:\n    - x\n  search_terms:\n    - t\n`);
    expect(absent.pass).toBe(true);
    const bogus = preflight(`  resolution: no-pack-match\n  repo_url: https://example.com/team/kb.git\n  repo_url_source: guessed\n  repo_probe: git-ls-remote-ok\n  sources_searched:\n    - x\n  search_terms:\n    - t\n`);
    expect(bogus.pass).toBe(false);
    expect(bogus.findings.join(" ")).toContain("is not one of: memory-layer, user-provided");
    // `preflight-artifact` belongs to the DEPOSIT sensor's vocabulary, not this one.
    const wrongSide = preflight(`  resolution: no-pack-match\n  repo_url: https://example.com/team/kb.git\n  repo_url_source: preflight-artifact\n  repo_probe: git-ls-remote-ok\n  sources_searched:\n    - x\n  search_terms:\n    - t\n`);
    expect(wrongSide.pass).toBe(false);
  });
});

// --- deposit ------------------------------------------------------------------

describe("poc-accelerator-team-knowledge-deposit — field verdicts", () => {
  test("all three submission outcomes pass when complete", () => {
    const mr = deposit(`  resolution: merge-request-opened\n${DEPOSIT_BASE}  branch: knowledge/2026-08-11-wind\n  review_url: https://example.com/mr/1\n`);
    if (!mr.pass) throw new Error(mr.findings.join("\n"));
    const pushed = deposit(`  resolution: branch-pushed\n${DEPOSIT_BASE}  branch: knowledge/2026-08-11-wind\n  owner: named owner\n`);
    if (!pushed.pass) throw new Error(pushed.findings.join("\n"));
    const patch = deposit(`  resolution: patch-prepared\n${DEPOSIT_BASE}  patch_path: 0001-knowledge.patch\n  owner: named owner\n  blocked_reason: no write access\n`);
    if (!patch.pass) throw new Error(patch.findings.join("\n"));
  });

  test("it never consults the preflight record — the deposit is owed either way", () => {
    // The artifact is alone in its temp dir: no preflight file exists anywhere.
    const r = deposit(`  resolution: branch-pushed\n${DEPOSIT_BASE}  branch: b\n  owner: named owner\n`);
    expect(r.pass).toBe(true);
  });

  test('there is no skip resolution and no "nothing to deposit"', () => {
    for (const value of ["skipped", "nothing-to-deposit", ""]) {
      const r = deposit(`  resolution: ${value}\n${DEPOSIT_BASE}`);
      expect(r.pass).toBe(false);
      expect(r.findings.join(" ")).toContain("is not one of: merge-request-opened, branch-pushed, patch-prepared");
    }
  });

  test("an empty harvest is not an outcome of a delivered PoC", () => {
    const r = deposit(
      `  resolution: branch-pushed\n  repo_url: https://example.com/team/kb.git\n  repo_probe: git-ls-remote-ok\n  sanitization_approved_by: named owner\n  branch: b\n  owner: named owner\n`,
    );
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("entries is empty or absent");
  });

  test("sanitization approval must be named", () => {
    const r = deposit(
      `  resolution: branch-pushed\n  repo_url: https://example.com/team/kb.git\n  repo_probe: git-ls-remote-ok\n  entries:\n    - x (knows, industry-generic)\n  branch: b\n  owner: named owner\n`,
    );
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("sanitization_approved_by is absent");
  });

  test("each resolution's own required fields", () => {
    const mr = deposit(`  resolution: merge-request-opened\n${DEPOSIT_BASE}`);
    expect(mr.findings.join(" ")).toContain("merge-request-opened requires a non-empty branch:");
    expect(mr.findings.join(" ")).toContain("merge-request-opened requires a non-empty review_url:");

    const pushed = deposit(`  resolution: branch-pushed\n${DEPOSIT_BASE}`);
    expect(pushed.findings.join(" ")).toContain("branch-pushed requires a non-empty branch:");
    expect(pushed.findings.join(" ")).toContain("branch-pushed requires a non-empty owner:");

    // A refused push is an owned handoff with a named reason, never a skip.
    const patch = deposit(`  resolution: patch-prepared\n${DEPOSIT_BASE}`);
    expect(patch.findings.join(" ")).toContain("patch-prepared requires a non-empty patch_path:");
    expect(patch.findings.join(" ")).toContain("patch-prepared requires a non-empty owner:");
    expect(patch.findings.join(" ")).toContain("patch-prepared requires a non-empty blocked_reason:");
  });

  test("repo_url_source accepts the deposit's own three values", () => {
    for (const source of ["preflight-artifact", "memory-layer", "user-provided"]) {
      const r = deposit(
        `  resolution: branch-pushed\n  repo_url: https://example.com/team/kb.git\n  repo_url_source: ${source}\n  repo_probe: git-ls-remote-ok\n  sanitization_approved_by: o\n  entries:\n    - x (knows, industry-generic)\n  branch: b\n  owner: o\n`,
      );
      if (!r.pass) throw new Error(`${source}: ${r.findings.join("; ")}`);
    }
    const bogus = deposit(
      `  resolution: branch-pushed\n  repo_url: https://example.com/team/kb.git\n  repo_url_source: invented\n  repo_probe: git-ls-remote-ok\n  sanitization_approved_by: o\n  entries:\n    - x\n  branch: b\n  owner: o\n`,
    );
    expect(bogus.pass).toBe(false);
  });

  test("the same git-remote judgement as the preflight sensor", () => {
    for (const url of ["/Users/me/kb", "C:/repos/kb", "example.com"]) {
      const r = deposit(`  resolution: branch-pushed\n  repo_url: ${url}\n  repo_probe: git-ls-remote-ok\n  sanitization_approved_by: o\n  entries:\n    - x\n  branch: b\n  owner: o\n`);
      expect(r.pass).toBe(false);
      expect(r.findings.join(" ")).toContain("is not a git remote URL");
    }
  });
});

// --- the team-knowledge delegation (added by the convergence) --------------
//
// Everything below is checked ONLY when the field is present. The verdicts pinned
// above are what prove that: they are all written without these fields and they
// all still pass unchanged. That is the property that keeps poc-accelerator
// installable on its own — the composer does not enforce `dependencies`, so a
// record produced without the hub plugin must remain valid.

describe("preflight — optional team-knowledge delegation fields", () => {
  const complete = `  resolution: pack-imported\n${PREFLIGHT_BASE}  pack: wind-energy\n  import_path: aidlc/spaces/default/knowledge/aidlc-shared/wind.md\n`;

  test("absent fields change nothing — the pre-convergence record still passes", () => {
    expect(preflight(complete).pass).toBe(true);
  });

  test("card_tooling: absent is a valid answer, and the honest one without the plugin", () => {
    expect(preflight(`${complete}  card_tooling: absent\n`).pass).toBe(true);
  });

  test("importing cards records the concept IDs and that the tooling was there", () => {
    const r = preflight(`${complete}  card_tooling: available\n  cards_imported:\n    - practices/data-boundary/mock-data-synthesis\n`);
    if (!r.pass) throw new Error(r.findings.join("\n"));
  });

  test("claiming imported cards without the tooling is refused", () => {
    const r = preflight(`${complete}  card_tooling: absent\n  cards_imported:\n    - practices/data-boundary/mock-data-synthesis\n`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("claims something it could not have done");
  });

  test("a card list needs concept IDs, not prose titles", () => {
    const r = preflight(`${complete}  card_tooling: available\n  cards_imported:\n    - Mock data must be synthetic\n`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("is not a card concept ID");
  });

  test("an unknown card_tooling value is refused", () => {
    expect(preflight(`${complete}  card_tooling: maybe\n`).pass).toBe(false);
  });

  test("an empty cards_imported list still has to say whether the tooling was there", () => {
    const r = preflight(`${complete}  cards_imported: []\n`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("without card_tooling");
  });
});

describe("deposit — optional team-knowledge delegation fields", () => {
  const complete = `  resolution: branch-pushed\n${DEPOSIT_BASE}  branch: knowledge/2026-08-11-wind\n  owner: named owner\n`;

  test("absent fields change nothing — the pre-convergence record still passes", () => {
    expect(deposit(complete).pass).toBe(true);
  });

  test("cards travel alongside entries, behind a passing validator run", () => {
    const r = deposit(`${complete}  validate: akp-validate-ok\n  cards:\n    - practices/data-boundary/mock-data-synthesis\n`);
    if (!r.pass) throw new Error(r.findings.join("\n"));
  });

  test("cards without a passing validator run are refused", () => {
    const r = deposit(`${complete}  cards:\n    - practices/data-boundary/mock-data-synthesis\n`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("an unvalidated card never reaches a human reviewer");
  });

  test("a recorded validator run must be a passing one", () => {
    const r = deposit(`${complete}  validate: failed\n`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("a failing gate is fixed, not reported");
  });

  test("entries stays required even when cards are present — poc's own verdict is untouched", () => {
    const r = deposit(
      `  resolution: branch-pushed\n  repo_url: https://example.com/team/kb.git\n  repo_probe: git-ls-remote-ok\n  sanitization_approved_by: o\n  validate: akp-validate-ok\n  cards:\n    - practices/x/y\n  branch: b\n  owner: o\n`,
    );
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("entries is empty or absent");
  });

  test("a card list needs concept IDs, not prose titles", () => {
    const r = deposit(`${complete}  validate: akp-validate-ok\n  cards:\n    - Mock data must be synthetic (judges)\n`);
    expect(r.pass).toBe(false);
    expect(r.findings.join(" ")).toContain("is not a card concept ID");
  });
});
