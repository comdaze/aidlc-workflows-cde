// t263 — the sensor coalesce window: deferral, never silent skipping.
//
// covers: subcommand:aidlc-sensor:flush
// covers: function:readCoalesceLedger
// covers: function:pendingCoalescedFires
// covers: function:coalesceKey
//
// WHY THIS EXISTS. `coalesce_seconds` lets the dispatcher skip a re-fire whose
// (stage, sensor) pair already passed inside the window. It exists because the
// two code sensors run a whole-project toolchain: a measured PoC run fired them
// 100 times across 5 files for ~19 minutes of blocking wall-clock, 98.9% of that
// run's sensor time. But a skipped check in a framework whose thesis is that
// verification is not optional is only acceptable while four properties hold,
// and each is a test below — lose any one and the feature becomes a way to drop
// a verification without anyone noticing:
//
//   1. A coalesced fire opens NO audit pair. The decision happens before the
//      lock and before SENSOR_FIRED, so the trail never carries a half-fire.
//   2. The skip is RECORDED — a deferred count plus the newest output the sensor
//      has not seen — so the debt is discoverable, by `--doctor` among others.
//   3. A fire after a FAILED one is NEVER coalesced. The write following a
//      failure is the fix, and the fix must be checked.
//   4. `flush` discharges the debt by really firing, and clears the ledger.
//
// FIXTURE DISCIPLINE (t92's): stub per-sensor scripts are copied into an
// isolated temp dir and reached through AIDLC_SENSOR_SCRIPT_DIR, with fork
// manifests in a temp AIDLC_SENSORS_DIR. Nothing is written under
// tests/fixtures/**, and the shipped dist/ tools tree is never touched. Stubs
// also make the outcome deterministic: driving this through the real type-check
// sensor would make the assertions depend on whether `bunx tsc` resolves.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import type { Dirent } from "node:fs";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";

const BUN = process.execPath;
const CLAUDE_DIST = join(REPO_ROOT, "dist", "claude", ".claude");
const FIXTURE_SCRIPTS = join(REPO_ROOT, "tests", "fixtures", "v05-mr9-sensor-fire", "scripts");
// Any real stage slug: handleFire resolves the stage through the compiled graph
// but does not require the stage to declare the sensor.
const STAGE = "code-generation";
const WINDOW_SECONDS = 60;

let tmp: string;
let proj: string;
let sensorsDir: string;
let scriptDir: string;

/** Write a fork manifest for `id`, optionally carrying a coalesce window. */
function manifest(id: string, coalesceSeconds: number | null): void {
  const lines = [
    "---",
    `id: ${id}`,
    "kind: deterministic",
    `command: bun tools/aidlc-sensor-${id}.ts`,
    "default_severity: advisory",
    "description: t263 fork manifest",
    "timeout_seconds: 10",
  ];
  if (coalesceSeconds !== null) lines.push(`coalesce_seconds: ${coalesceSeconds}`);
  lines.push("---", "# stub", "");
  writeFileSync(join(sensorsDir, `aidlc-${id}.md`), lines.join("\n"), "utf-8");
}

function sensorCli(...args: string[]): { stdout: string; status: number | null } {
  const res = spawnSync(BUN, [join(proj, ".claude", "tools", "aidlc-sensor.ts"), ...args], {
    cwd: proj,
    encoding: "utf-8",
    env: {
      ...process.env,
      AIDLC_HARNESS_DIR: ".claude",
      AIDLC_SENSORS_DIR: sensorsDir,
      AIDLC_SENSOR_SCRIPT_DIR: scriptDir,
    },
  });
  return { stdout: `${res.stdout ?? ""}${res.stderr ?? ""}`, status: res.status };
}

const fire = (id: string, target = "target.md") =>
  sensorCli("fire", id, "--stage", STAGE, "--output-path", target);

/** Concatenated audit shards, wherever the record root resolved. */
function auditText(): string {
  let text = "";
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md") && dir.endsWith("audit")) text += readFileSync(p, "utf-8");
    }
  };
  walk(join(proj, "aidlc"));
  return text;
}

const eventCount = (ev: string): number =>
  auditText().split("\n").filter((l) => l === `**Event**: ${ev}`).length;

function ledger(): Record<
  string,
  { outcome?: string; deferred?: number; last_output_path?: string }
> {
  // A sibling of `.aidlc-sensors/`, not inside it: the evidence dir must stay
  // empty on a passing fire (t92 pins that), so the ledger sits beside it under
  // the record root's already-gitignored `.aidlc-*` prefix.
  const path = join(proj, "aidlc", "spaces", "default", "intents", ".aidlc-coalesce.json");
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

const entryFor = (id: string) => ledger()[`${STAGE}::${id}`];

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "aidlc-t263-"));
  proj = join(tmp, "proj");
  mkdirSync(proj, { recursive: true });
  cpSync(CLAUDE_DIST, join(proj, ".claude"), { recursive: true });
  writeFileSync(join(proj, "target.md"), "# target\n\n## One\n\n## Two\n", "utf-8");

  scriptDir = join(tmp, "stub-scripts");
  mkdirSync(scriptDir, { recursive: true });
  for (const name of ["aidlc-sensor-stub-pass.ts", "aidlc-sensor-stub-fail.ts"]) {
    copyFileSync(join(FIXTURE_SCRIPTS, name), join(scriptDir, name));
  }

  sensorsDir = join(tmp, "sensors");
  mkdirSync(sensorsDir, { recursive: true });
  manifest("stub-pass", WINDOW_SECONDS);
  manifest("stub-fail", WINDOW_SECONDS);
  // The control: same stub, no window. Proves the skipping is the field's doing
  // and that a manifest without it behaves exactly as before.
  copyFileSync(
    join(FIXTURE_SCRIPTS, "aidlc-sensor-stub-pass.ts"),
    join(scriptDir, "aidlc-sensor-stub-nowindow.ts"),
  );
  manifest("stub-nowindow", null);
});

afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("t263 sensor coalescing", () => {
  test("the field round-trips through the manifest schema (describe surfaces it)", () => {
    expect(sensorCli("describe", "stub-pass").stdout).toContain(
      `coalesce_seconds: ${WINDOW_SECONDS}`,
    );
    expect(sensorCli("describe", "stub-nowindow").stdout).not.toContain("coalesce_seconds");
  });

  test("first fire runs for real: one audit pair, ledger stamped passed", () => {
    const firedBefore = eventCount("SENSOR_FIRED");
    const r = fire("stub-pass");
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain('"coalesced"');
    expect(eventCount("SENSOR_FIRED")).toBe(firedBefore + 1);
    expect(entryFor("stub-pass")?.outcome).toBe("passed");
    expect(entryFor("stub-pass")?.deferred).toBe(0);
  });

  test("PROPERTY 1 + 2: a re-fire inside the window is deferred, opens no audit pair, and is recorded", () => {
    const before = auditText().length;
    const r = fire("stub-pass");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"coalesced":true');
    // No half-fire, no orphan row: the trail is byte-unchanged.
    expect(auditText().length).toBe(before);
    // The debt names the output the sensor has not seen.
    const entry = entryFor("stub-pass");
    expect(entry?.deferred).toBe(1);
    expect(entry?.last_output_path).toBe("target.md");
    // A second deferral accumulates rather than overwriting.
    fire("stub-pass");
    expect(entryFor("stub-pass")?.deferred).toBe(2);
  });

  test("the window is per (stage, sensor): a different sensor is unaffected", () => {
    const firedBefore = eventCount("SENSOR_FIRED");
    expect(fire("stub-fail").stdout).not.toContain('"coalesced"');
    expect(eventCount("SENSOR_FIRED")).toBe(firedBefore + 1);
  });

  test("PROPERTY 3: a fire after a FAILED one is never coalesced", () => {
    // stub-fail always reports pass:false, so its ledger outcome is `failed`.
    expect(entryFor("stub-fail")?.outcome).toBe("failed");
    const firedBefore = eventCount("SENSOR_FIRED");
    const r = fire("stub-fail");
    expect(r.stdout).not.toContain('"coalesced"');
    expect(eventCount("SENSOR_FIRED")).toBe(firedBefore + 1);
    expect(eventCount("SENSOR_FAILED")).toBeGreaterThan(0);
  });

  test("a manifest without the field never coalesces", () => {
    const firedBefore = eventCount("SENSOR_FIRED");
    expect(fire("stub-nowindow").stdout).not.toContain('"coalesced"');
    expect(fire("stub-nowindow").stdout).not.toContain('"coalesced"');
    expect(eventCount("SENSOR_FIRED")).toBe(firedBefore + 2);
    expect(entryFor("stub-nowindow")).toBeUndefined();
  });

  test("PROPERTY 4: flush really fires the deferred pair and clears the ledger", () => {
    expect(entryFor("stub-pass")?.deferred).toBeGreaterThan(0);
    const firedBefore = eventCount("SENSOR_FIRED");
    const r = sensorCli("flush");
    expect(r.stdout).toContain("re-fired on target.md");
    expect(eventCount("SENSOR_FIRED")).toBe(firedBefore + 1);
    expect(entryFor("stub-pass")?.deferred).toBe(0);
    expect(sensorCli("flush").stdout).toContain("no deferred sensor fires");
  });

  test("flush drops an entry whose recorded output has vanished, without firing", () => {
    // The pair is still stamped from the previous case, so one fire is enough to
    // create a debt; assert the debt exists rather than its exact count, which
    // depends on how many fires the earlier cases left inside the window.
    fire("stub-pass");
    expect(entryFor("stub-pass")?.deferred).toBeGreaterThan(0);
    rmSync(join(proj, "target.md"), { force: true });
    const firedBefore = eventCount("SENSOR_FIRED");
    const r = sensorCli("flush");
    expect(r.stdout).toContain("recorded output path is gone");
    expect(eventCount("SENSOR_FIRED")).toBe(firedBefore);
    expect(entryFor("stub-pass")).toBeUndefined();
    writeFileSync(join(proj, "target.md"), "# target\n\n## One\n\n## Two\n", "utf-8");
  });

  test("--stage narrows flush to one stage", () => {
    fire("stub-pass"); // stamp (or defer, if still inside the window)
    fire("stub-pass"); // defer
    const owed = entryFor("stub-pass")?.deferred ?? 0;
    expect(owed).toBeGreaterThan(0);
    expect(sensorCli("flush", "--stage", "no-such-stage").stdout).toContain(
      "no deferred sensor fires",
    );
    // Filtered out, so the debt is untouched.
    expect(entryFor("stub-pass")?.deferred).toBe(owed);
    expect(sensorCli("flush", "--stage", STAGE).stdout).toContain("re-fired");
  });

  test("both shipped code sensors carry the window; the document sensors do not", () => {
    const read = (id: string): string =>
      readFileSync(join(CLAUDE_DIST, "sensors", `aidlc-${id}.md`), "utf-8");
    for (const id of ["linter", "type-check"]) {
      expect(read(id)).toMatch(/^coalesce_seconds: \d+$/m);
    }
    for (const id of ["required-sections", "upstream-coverage", "claim-sources"]) {
      if (!existsSync(join(CLAUDE_DIST, "sensors", `aidlc-${id}.md`))) continue;
      expect(read(id)).not.toMatch(/^coalesce_seconds:/m);
    }
  });
});
