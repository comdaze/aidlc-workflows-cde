// plugins/unknowns/tests/plugin.test.ts — the unknowns plugin's OWN test harness.
//
// Shape copied from plugins/test-pro/tests/plugin.test.ts (the reference
// fixture): every stage's frontmatter passes the real validateStageFrontmatter,
// agents resolve against the real roster, produced artifacts are `unknowns-`
// namespaced, and every contribution targets a real core stage.
//
// Two guard families are specific to this plugin, and both exist because their
// failure mode is SILENT:
//
//   1. Anchor resolution. A contribution whose anchor names a heading the target
//      stage does not have composes "successfully" — the frontmatter `adds` land,
//      the prose vanishes, and the only signal is a line in a .drops file that
//      surfaces as a degraded doctor row nobody is looking at. So we resolve each
//      declared anchor against the REAL core stage source here, at author time.
//
//   2. Self-skip well-formedness. Both stages are CONDITIONAL and their skip step
//      is their cheapest, most-taken path. The engine rejects a skip report that
//      omits --stage, omits --reason, or names a slug other than the live cursor
//      — all three at runtime, mid-session. Assert the authored command instead.
//
// Run:  bun test plugins/unknowns/tests/plugin.test.ts

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseStageFrontmatter,
  scalarField,
} from "../../../dist/claude/.claude/tools/aidlc-lib.ts";
import {
  type ValidationContext,
  validateStageFrontmatter,
} from "../../../dist/claude/.claude/tools/aidlc-stage-schema.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, "..");
const REPO_ROOT = join(PLUGIN_ROOT, "..", "..");
const CORE_STAGES = join(REPO_ROOT, "dist", "claude", ".claude", "aidlc-common", "stages");
const AGENTS_DIR = join(REPO_ROOT, "dist", "claude", ".claude", "agents");

const PLUGIN_NAME = "unknowns";

// Anchors the compose hook actually implements (docs/reference/18-plugin-mechanism.md
// §3). `after-questions` is documented-but-unimplemented and drops with "unknown
// anchor", so it is deliberately absent from this set.
const IMPLEMENTED_ANCHOR_KINDS = ["after-step:", "before-step:", "end-of-steps", "in:"];

// --- helpers ---

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function agentRoster(): string[] {
  const coreSlugs = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
  const pluginSlugs = walk(join(PLUGIN_ROOT, "agents")).map((f) => basename(f, ".md"));
  return [...new Set([...coreSlugs, ...pluginSlugs, "orchestrator"])].sort();
}

// slug -> absolute path of the core stage source (contribution targets).
function coreStageFiles(): Map<string, string> {
  return new Map(walk(CORE_STAGES).map((p) => [basename(p, ".md"), p]));
}

const pluginStageFiles = walk(join(PLUGIN_ROOT, "stages"));
const contributionFiles = walk(join(PLUGIN_ROOT, "contributions"));
const pluginAgentFiles = walk(join(PLUGIN_ROOT, "agents"));

function frontmatterOf(raw: string): string {
  return raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
}

function bodyOf(raw: string): string {
  return raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/)?.[1] ?? "";
}

// Mirror of the compose hook's locateAnchor, reduced to presence: does the target
// stage contain the heading this anchor needs? Returns null when it resolves, or
// the reason it would drop.
function anchorDropReason(stageSource: string, anchor: string): string | null {
  const step = (n: string): string | null => {
    if (!/^\d+$/.test(n)) return `step "${n}" is not an integer`;
    const want = Number(n);
    // A plain `### Step 7` or a range heading `### Step 4-8:` that contains it.
    for (const m of stageSource.matchAll(/^### Step (\d+)(?:\s*-\s*(\d+))?\b/gm)) {
      const lo = Number(m[1]);
      const hi = m[2] ? Number(m[2]) : lo;
      if (want >= lo && want <= hi) return null;
    }
    return `no "### Step ${n}" heading (a range like "### Step 4-8" would count)`;
  };
  if (anchor.startsWith("after-step:")) return step(anchor.slice("after-step:".length));
  if (anchor.startsWith("before-step:")) return step(anchor.slice("before-step:".length));
  if (anchor === "end-of-steps") {
    return /^## Steps\b/m.test(stageSource) ? null : 'no "## Steps" section';
  }
  if (anchor.startsWith("in:")) {
    const comp = anchor.slice(3);
    if (!/^[\w -]+$/.test(comp)) return `bad in: compartment "${comp}"`;
    return new RegExp(`^## ${comp}\\b`, "m").test(stageSource)
      ? null
      : `no "## ${comp}" section`;
  }
  return `unknown anchor "${anchor}"`;
}

describe(`${PLUGIN_NAME} plugin — own content validation`, () => {
  test("has stages and contributions to validate", () => {
    expect(pluginStageFiles.length).toBeGreaterThan(0);
    expect(contributionFiles.length).toBeGreaterThan(0);
  });

  // --- Every plugin stage passes the framework's stage schema ---
  describe("stage frontmatter (same validator as core)", () => {
    const ctx: ValidationContext = { agents: agentRoster() };
    for (const file of pluginStageFiles) {
      const name = basename(file);
      const raw = readFileSync(file, "utf-8");

      test(`${name} validates`, () => {
        const r = validateStageFrontmatter(parseStageFrontmatter(raw), ctx);
        if (!r.valid) throw new Error(`${name}: ${r.errors.join("; ")}`);
        expect(r.valid).toBe(true);
      });

      test(`${name} slug matches filename stem`, () => {
        expect(parseStageFrontmatter(raw).slug).toBe(name.replace(/\.md$/, ""));
      });

      test(`${name} declares plugin: ${PLUGIN_NAME}`, () => {
        expect(parseStageFrontmatter(raw).plugin).toBe(PLUGIN_NAME);
      });

      test(`${name} has a non-empty body`, () => {
        expect(bodyOf(raw).trim().length).toBeGreaterThan(0);
      });

      test(`${name} produces only ${PLUGIN_NAME}- namespaced artifacts`, () => {
        for (const artifact of (parseStageFrontmatter(raw).produces as string[]) ?? []) {
          expect(artifact.startsWith(`${PLUGIN_NAME}-`)).toBe(true);
        }
      });

      // This plugin's contract with the user: both stages are cheap and skip
      // themselves. A stage authored ALWAYS could not skip at all (the engine
      // rejects `--result skipped` for a non-CONDITIONAL stage), which would turn
      // an opt-in scout into mandatory ceremony on every run.
      test(`${name} is CONDITIONAL`, () => {
        expect(parseStageFrontmatter(raw).execution).toBe("CONDITIONAL");
      });

      // The engine rejects a skip that omits --stage, omits --reason, or names a
      // slug other than the live cursor. All three fail at runtime, mid-session,
      // on this plugin's most-travelled path.
      test(`${name} authors a well-formed self-skip`, () => {
        const slug = parseStageFrontmatter(raw).slug as string;
        const body = bodyOf(raw);
        const skips = [...body.matchAll(/report\s+--stage\s+(\S+)\s+--result\s+skipped\s+--reason\s+(\S)/g)];
        if (skips.length === 0) {
          throw new Error(
            `${name}: no self-skip command found. A CONDITIONAL stage in this plugin must author ` +
              `\`report --stage ${slug} --result skipped --reason "<reason>"\` — without it the ` +
              `applicability check has no way to stand down and the stage becomes mandatory.`
          );
        }
        for (const m of skips) {
          expect(m[1]).toBe(slug);
        }
      });
    }
  });

  // --- Contributions: real target, namespaced additions, RESOLVING anchors ---
  describe("contributions (target resolution + anchors)", () => {
    const cores = coreStageFiles();
    for (const file of contributionFiles) {
      const name = basename(file);
      const raw = readFileSync(file, "utf-8");
      const fm = frontmatterOf(raw);
      const target = fm.match(/^target:\s*(.+)$/m)?.[1].trim() ?? "";

      test(`${name} targets a real core stage`, () => {
        expect(target).toBeTruthy();
        if (!cores.has(target)) {
          throw new Error(`${name}: target "${target}" is not a core stage slug`);
        }
      });

      test(`${name} declares plugin: ${PLUGIN_NAME}`, () => {
        expect(fm.match(/^plugin:\s*(.+)$/m)?.[1].trim()).toBe(PLUGIN_NAME);
      });

      test(`${name} adds.produces are ${PLUGIN_NAME}- namespaced`, () => {
        const addsBlock = fm.match(/^adds:\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m)?.[1] ?? "";
        const producesSection = addsBlock.match(/produces:\n((?:\s+- [\w-]+\n?)*)/);
        const items = producesSection
          ? [...producesSection[1].matchAll(/^\s+- ([\w-]+)/gm)].map((m) => m[1])
          : [];
        for (const artifact of items) {
          expect(artifact.startsWith(`${PLUGIN_NAME}-`)).toBe(true);
        }
      });

      const anchors = [...fm.matchAll(/^\s*-\s*anchor:\s*(.+)$/gm)].map((m) => m[1].trim());

      test(`${name} declares at least one anchor`, () => {
        expect(anchors.length).toBeGreaterThan(0);
      });

      test(`${name} uses only implemented anchor kinds`, () => {
        for (const a of anchors) {
          const ok = IMPLEMENTED_ANCHOR_KINDS.some((k) =>
            k.endsWith(":") ? a.startsWith(k) : a === k
          );
          if (!ok) {
            throw new Error(
              `${name}: anchor "${a}" is not an implemented kind. ` +
                `Implemented: ${IMPLEMENTED_ANCHOR_KINDS.join(", ")}. ` +
                `(after-questions is documented but drops as "unknown anchor".)`
            );
          }
        }
      });

      test(`${name} every anchor resolves in ${target}`, () => {
        const stageSource = readFileSync(cores.get(target) as string, "utf-8");
        for (const a of anchors) {
          const why = anchorDropReason(stageSource, a);
          if (why) {
            throw new Error(
              `${name}: anchor "${a}" would DROP against ${target} — ${why}. ` +
                `Compose still exits 0 and the frontmatter adds still land, so the prose ` +
                `vanishes silently; only a .drops row (degraded doctor check) reports it.`
            );
          }
        }
      });

      // Each declared anchor needs its matching `## fragment: <anchor>` prose
      // block. A declared anchor with no block splices nothing.
      test(`${name} has a prose block for every declared anchor`, () => {
        const body = bodyOf(raw);
        for (const a of anchors) {
          const heading = `## fragment: ${a}`;
          if (!body.includes(heading)) {
            throw new Error(`${name}: declares anchor "${a}" but has no "${heading}" block`);
          }
        }
      });

      // The splice bounds each block with `<!-- /plugin:… -->`. A lookalike line
      // inside the prose is mistaken for a terminator and corrupts upgrades.
      test(`${name} prose contains no sentinel lookalike`, () => {
        expect(/<!--\s*\/?plugin:/.test(bodyOf(raw))).toBe(false);
      });
    }
  });

  // --- Agent naming ---
  describe("agent naming", () => {
    for (const file of pluginAgentFiles) {
      const name = basename(file);
      test(`${name} agent name matches filename stem`, () => {
        const fm = frontmatterOf(readFileSync(file, "utf-8"));
        expect(scalarField(fm, "name")).toBe(basename(file, ".md"));
      });

      test(`${name} has a display_name`, () => {
        const fm = frontmatterOf(readFileSync(file, "utf-8"));
        expect(scalarField(fm, "display_name")).toBeTruthy();
      });
    }
  });

  // --- Manifest ---
  describe("manifest", () => {
    const manifestPath = join(PLUGIN_ROOT, ".aidlc-plugin", "plugin.json");
    test("plugin.json exists + parses", () => {
      expect(existsSync(manifestPath)).toBe(true);
      const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(m.name).toBe(PLUGIN_NAME);
      expect(m.version).toBeTruthy();
      expect(m.aidlc?.contributes).toBeTruthy();
    });

    // Every declared subtree must exist, and every shipped subtree must be
    // declared. An undeclared subtree is copied by nothing and is dead weight;
    // a declared-but-absent one is a manifest that lies about the plugin.
    test("contributes keys and on-disk subtrees agree", () => {
      const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const declared: Record<string, string> = m.aidlc.contributes;
      for (const [key, rel] of Object.entries(declared)) {
        if (!existsSync(join(PLUGIN_ROOT, rel))) {
          throw new Error(`manifest declares ${key}: "${rel}" but that directory does not exist`);
        }
      }
      const declaredDirs = new Set(
        Object.values(declared).map((r) => r.replace(/\/$/, ""))
      );
      for (const dir of ["stages", "agents", "knowledge", "sensors", "scopes", "tools"]) {
        if (existsSync(join(PLUGIN_ROOT, dir)) && !declaredDirs.has(dir)) {
          throw new Error(`${dir}/ exists on disk but no contributes key declares it`);
        }
      }
      // `contributions/` is the overlays subtree under its conventional name.
      if (existsSync(join(PLUGIN_ROOT, "contributions")) && declared.overlays === undefined) {
        throw new Error('contributions/ exists but manifest declares no "overlays" key');
      }
    });
  });
});
