// t219-kiro-ide-gate-render-floor: the Kiro IDE stop adapter's gate-render
// floor. Kiro IDE delivers no transcript to the Stop hook, so nothing can
// VERIFY the question-rendering annex was honored; observed field failure:
// the conductor writes the approval gate to the questions file, prints a bare
// "waiting at the gate" line with NO options in chat, and parks. The floor
// blocks the FIRST allowed stop at each open gate ([?]) with an on-task
// instruction to render the options in chat, one-shot per gate signature.
//
// covers: file:harness/kiro-ide/hooks/aidlc-kiro-adapter.ts
//
// Methodology: subprocess against the packaged dist/kiro-ide tree (the same
// surface t218 contracts) — each case runs `bun .kiro/hooks/aidlc-kiro-adapter.ts
// stop` in a scratch project and asserts the stdout decision. Invariants:
//   1. Open gate + core allow -> {"decision":"block"} naming question-rendering.
//   2. Same gate, second stop -> passthrough allow (one-shot marker).
//   3. New gate signature -> the floor re-arms.
//   4. Autonomous Construction -> no floor (unattended runs must park freely).
//   5. AIDLC_GATE_RENDER_FLOOR=0 -> no floor (deterministic off-switch).
//   6. No workflow state -> no floor (adapter is a no-op outside AIDLC).
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_RECORD_DIR,
  DEFAULT_SPACE,
  intentsDirOf,
  seededRecordDir,
  seededStateFile,
} from "../harness/fixtures.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KIRO_IDE_TREE = join(REPO_ROOT, "dist", "kiro-ide", ".kiro");

function seedShell(dir: string): void {
  const intentsDir = intentsDirOf(dir, DEFAULT_SPACE);
  mkdirSync(join(dir, "aidlc", "spaces", DEFAULT_SPACE, "memory"), { recursive: true });
  mkdirSync(seededRecordDir(dir), { recursive: true });
  writeFileSync(join(dir, "aidlc", "active-space"), `${DEFAULT_SPACE}\n`, "utf-8");
  writeFileSync(join(intentsDir, "active-intent"), `${DEFAULT_RECORD_DIR}\n`, "utf-8");
}

// The brownfield fixture with requirements-analysis flipped to [?] awaiting-
// approval and an explicit Current Stage line, so the CORE stop hook takes its
// human-wait carve-out (allow) and hands the decision to the adapter's floor.
function gateOpenState(extraLines = ""): string {
  const base = readFileSync(
    join(REPO_ROOT, "tests", "fixtures", "state-brownfield-feature.md"),
    "utf-8",
  );
  return `${base.replace(
    "- [-] requirements-analysis — EXECUTE",
    "- [?] requirements-analysis — EXECUTE",
  )}\n## Session State\n- **Current Stage**: requirements-analysis\n${extraLines}`;
}

function scratchProject(state: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "t219-"));
  cpSync(KIRO_IDE_TREE, join(dir, ".kiro"), { recursive: true });
  seedShell(dir);
  if (state !== null) writeFileSync(seededStateFile(dir), state, "utf-8");
  return dir;
}

// Run the adapter's stop target exactly as the .kiro.hook registers it. stdin
// is intentionally NOT written (the IDE never writes it).
function runStop(dir: string, extraEnv: Record<string, string> = {}): string {
  const r = spawnSync("bun", [join(dir, ".kiro", "hooks", "aidlc-kiro-adapter.ts"), "stop"], {
    cwd: dir,
    input: "",
    encoding: "utf-8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...extraEnv },
    timeout: 30_000,
  });
  return r.stdout ?? "";
}

const FLOOR_MARK = "question-rendering.md";

describe("t219 kiro-ide gate-render floor (stop adapter)", () => {
  test("open gate -> first stop blocks with the render instruction; second stop passes", () => {
    const dir = scratchProject(gateOpenState());
    try {
      const first = runStop(dir);
      expect(first).toContain('"decision":"block"');
      expect(first).toContain(FLOOR_MARK);
      // One-shot: the re-stop at the SAME gate passes through (no decision).
      const second = runStop(dir);
      expect(second).not.toContain(FLOOR_MARK);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a new gate signature re-arms the floor", () => {
    const dir = scratchProject(gateOpenState());
    try {
      expect(runStop(dir)).toContain(FLOOR_MARK); // arm + consume gate 1
      // The workflow advances: requirements-analysis approved, user-stories
      // now sits at the gate. New [?] slug set -> new signature -> re-arm.
      const advanced = gateOpenState()
        .replace("- [?] requirements-analysis — EXECUTE", "- [x] requirements-analysis — EXECUTE")
        .replace("- [ ] user-stories — EXECUTE", "- [?] user-stories — EXECUTE")
        .replace("**Current Stage**: requirements-analysis", "**Current Stage**: user-stories");
      writeFileSync(seededStateFile(dir), advanced, "utf-8");
      expect(runStop(dir)).toContain(FLOOR_MARK);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("autonomous Construction is exempt", () => {
    const dir = scratchProject(gateOpenState("- **Construction Autonomy Mode**: autonomous\n"));
    try {
      expect(runStop(dir)).not.toContain(FLOOR_MARK);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("AIDLC_GATE_RENDER_FLOOR=0 disables the floor", () => {
    const dir = scratchProject(gateOpenState());
    try {
      expect(runStop(dir, { AIDLC_GATE_RENDER_FLOOR: "0" })).not.toContain(FLOOR_MARK);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no workflow state -> no floor", () => {
    const dir = scratchProject(null);
    try {
      expect(runStop(dir)).not.toContain(FLOOR_MARK);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
