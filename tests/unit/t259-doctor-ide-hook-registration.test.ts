// t259-doctor-ide-hook-registration: doctor must report a DEAD Kiro IDE hook
// layer, not just present hook bodies.
//
// covers: subcommand:aidlc-utility:doctor
//
// WHY THIS EXISTS. Kiro IDE >= 1.0.1xx silently stopped executing the legacy
// `.kiro/hooks/*.kiro.hook` format. An install carrying only those files fires
// nothing — no audit rows, no sensor dispatch, no human-presence mint, no
// approval-gate block — and every pre-existing doctor check still passed,
// because those check that the hook `.ts` BODIES exist, never that the host is
// wired to invoke any of them. A whole harness shipped inert for months and the
// CLI reported green. This pins the three rows that close that gap.
//
// Kiro CLI shares the `.kiro` harness dir but wires hooks through
// agents/aidlc.json and ships no registration files, so case 5 pins that the
// rows do NOT fire for it — a false failure there would be worse than the gap.
//
// Asserts on report LABEL text, never on doctor's exit code: a copied tree fails
// unrelated checks (workspace shell, git state), so the exit code is not an
// observable for this behaviour. Same discipline as t83 and t212.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";

const BUN = process.execPath;
const IDE_DIST = join(REPO_ROOT, "dist", "kiro-ide");

let tmp: string;
let proj: string;
let hooksDir: string;
/** Pristine copies of the registration files, restored between cases. */
let shipped: { v2: Array<[string, string]>; legacy: Array<[string, string]> };

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "aidlc-t259-"));
  proj = join(tmp, "proj");
  cpSync(IDE_DIST, proj, { recursive: true });
  hooksDir = join(proj, ".kiro", "hooks");
  // Keep the byte contents so a case can restore exactly what shipped.
  const snapshot = (suffix: string): Array<[string, string]> =>
    readdirSync(hooksDir)
      .filter((f) => f.endsWith(suffix))
      .map((f) => [f, readFileSync(join(hooksDir, f), "utf-8")] as [string, string]);
  shipped = { v2: snapshot(".json"), legacy: snapshot(".kiro.hook") };
});

afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Reset .kiro/hooks/ to exactly what dist/kiro-ide ships. */
function restoreShipped(): void {
  for (const f of readdirSync(hooksDir)) {
    if (f.endsWith(".json") || f.endsWith(".kiro.hook")) {
      rmSync(join(hooksDir, f), { force: true });
    }
  }
  for (const [f, body] of [...shipped.v2, ...shipped.legacy]) {
    writeFileSync(join(hooksDir, f), body, "utf-8");
  }
}

function removeBySuffix(suffix: string): void {
  for (const f of readdirSync(hooksDir)) {
    if (f.endsWith(suffix)) rmSync(join(hooksDir, f), { force: true });
  }
}

/** Run the project's OWN doctor, harness pinned so cwd cannot decide it. */
function runDoctor(): string {
  const res = spawnSync(
    BUN,
    [join(proj, ".kiro", "tools", "aidlc-utility.ts"), "doctor", "--project-dir", proj],
    { encoding: "utf-8", env: { ...process.env, AIDLC_HARNESS_DIR: ".kiro" } },
  );
  return `${res.stdout ?? ""}${res.stderr ?? ""}`;
}

const REGISTRATION = /Kiro IDE hook registration/;
const COMMANDS = /Kiro IDE hook commands/;
const LEGACY_ADVISORY = /Legacy hook files:/;

/** The report line carrying `needle`, with its leading ✓/✗ marker. */
function row(out: string, needle: RegExp): string {
  return out.split("\n").find((l) => needle.test(l)) ?? "";
}

describe("t259 doctor — Kiro IDE hook registration", () => {
  test("1: as shipped (v2 + legacy) -> registration passes and counts both", () => {
    restoreShipped();
    const out = runDoctor();
    const r = row(out, REGISTRATION);
    expect(r).toContain("✓");
    expect(r).toMatch(/8 v2/);
    expect(r).toMatch(/9 legacy/);
  });

  test("2: as shipped -> every registered command resolves", () => {
    restoreShipped();
    expect(row(runDoctor(), COMMANDS)).toContain("✓");
  });

  test("3: as shipped -> advises against the IDE's Migrate button", () => {
    restoreShipped();
    const r = row(runDoctor(), LEGACY_ADVISORY);
    expect(r).toContain("✓");
    expect(r).toMatch(/Migrate/);
  });

  // THE REGRESSION THIS FILE EXISTS FOR: exactly what the fork shipped before
  // the 2.5.30 sync — nine legacy files, zero v2, hooks silently never firing.
  test("4: LEGACY ONLY -> registration FAILS and says the format is inert", () => {
    restoreShipped();
    removeBySuffix(".json");
    const r = row(runDoctor(), REGISTRATION);
    expect(r).toContain("✗");
    expect(r).toMatch(/0 v2/);
    expect(r).toMatch(/INERT/);
  });

  test("5: v2 only -> registration passes, no legacy advisory", () => {
    restoreShipped();
    removeBySuffix(".kiro.hook");
    const out = runDoctor();
    expect(row(out, REGISTRATION)).toContain("✓");
    expect(row(out, LEGACY_ADVISORY)).toBe("");
  });

  test("6: registered script missing -> commands row FAILS naming the script", () => {
    restoreShipped();
    rmSync(join(hooksDir, "aidlc-kiro-adapter.ts"), { force: true });
    const r = row(runDoctor(), COMMANDS);
    expect(r).toContain("✗");
    expect(r).toMatch(/aidlc-kiro-adapter\.ts/);
    // Restore so later cases (and any re-run) see a whole tree.
    cpSync(
      join(IDE_DIST, ".kiro", "hooks", "aidlc-kiro-adapter.ts"),
      join(hooksDir, "aidlc-kiro-adapter.ts"),
    );
  });

  // Kiro CLI shape: no registration files of either generation, no steering/.
  // The rows must be absent entirely rather than failing.
  test("7: Kiro CLI shape -> none of the three rows appear", () => {
    restoreShipped();
    removeBySuffix(".json");
    removeBySuffix(".kiro.hook");
    rmSync(join(proj, ".kiro", "steering"), { recursive: true, force: true });
    const out = runDoctor();
    expect(row(out, REGISTRATION)).toBe("");
    expect(row(out, COMMANDS)).toBe("");
    expect(row(out, LEGACY_ADVISORY)).toBe("");
    // Put steering back for isolation if this file is re-run in-process.
    cpSync(join(IDE_DIST, ".kiro", "steering"), join(proj, ".kiro", "steering"), {
      recursive: true,
    });
  });
});
