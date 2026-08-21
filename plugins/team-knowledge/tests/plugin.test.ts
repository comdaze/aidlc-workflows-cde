import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseStageFrontmatter, scalarField } from "../../../dist/claude/.claude/tools/aidlc-lib.ts";
import { type ValidationContext, validateStageFrontmatter } from "../../../dist/claude/.claude/tools/aidlc-stage-schema.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, "..");
const REPO_ROOT = join(PLUGIN_ROOT, "..", "..");
const AGENTS_DIR = join(REPO_ROOT, "dist", "claude", ".claude", "agents");
const CORE_SENSORS_DIR = join(REPO_ROOT, "core", "sensors");
const PLUGIN_NAME = "team-knowledge";

/** Every core scope — G2 says both stages are scope-independent. */
const CORE_SCOPES = [
  "bugfix",
  "enterprise",
  "feature",
  "infra",
  "mvp",
  "poc",
  "refactor",
  "security-patch",
  "workshop",
];

/**
 * The exact scope membership each stage claims. Kept as an EQUALITY per stage,
 * not a superset check: scope membership is a pure transpose of these lists
 * (aidlc-graph.ts transposeScopeGrid), so a name added or dropped here changes
 * which workflows the stage silently appears in — with no error anywhere. An
 * equality makes that a red test.
 *
 * The asymmetry is deliberate. Both stages are on every core scope (G2). `push`
 * is additionally on the rails-free `vibe` scope: a free-form session's whole
 * justification is that what it learned survives, its sedimentation already
 * lands in `team.md` through the same learnings ritual this stage reads from,
 * and at 4.95 it falls after close-out. `pull` is NOT, and must not be added
 * for symmetry's sake — it carries a human shortlist gate and sits upstream of
 * construction, so on that scope it would fire *before* the session opens,
 * turning "start working" into a hub search.
 */
const EXPECTED_SCOPES: Record<string, string[]> = {
  "team-knowledge-pull": CORE_SCOPES,
  "team-knowledge-push": [...CORE_SCOPES, "vibe"],
};

function walk(dir: string, ext = ".md"): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path, ext));
    else if (entry.name.endsWith(ext)) out.push(path);
  }
  return out;
}



function agentRoster(): string[] {
  return readdirSync(AGENTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => basename(file, ".md"));
}

function frontmatterOf(file: string): string {
  return readFileSync(file, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
}

const stageFiles = walk(join(PLUGIN_ROOT, "stages"));
const sensorFiles = walk(join(PLUGIN_ROOT, "sensors"));

describe(`${PLUGIN_NAME} plugin — content validation`, () => {
  test("ships exactly the two scope-independent stages", () => {
    expect(stageFiles.map((f) => basename(f, ".md")).sort()).toEqual(["team-knowledge-pull", "team-knowledge-push"]);
  });

  describe("stage front matter", () => {
    const context: ValidationContext = { agents: agentRoster() };
    for (const file of stageFiles) {
      const filename = basename(file);
      const frontmatter = parseStageFrontmatter(readFileSync(file, "utf-8"));

      test(`${filename} validates against the framework schema`, () => {
        const result = validateStageFrontmatter(frontmatter, context);
        if (!result.valid) throw new Error(`${filename}: ${result.errors.join("; ")}`);
        expect(result.valid).toBe(true);
      });

      test(`${filename} keeps its identity and artifacts namespaced`, () => {
        expect(frontmatter.slug).toBe(basename(file, ".md"));
        expect(frontmatter.plugin).toBe(PLUGIN_NAME);
        for (const artifact of (frontmatter.produces as string[]) ?? []) {
          expect(artifact.startsWith(`${PLUGIN_NAME}-`)).toBe(true);
        }
      });

      test(`${filename} claims exactly its declared scope membership (G2)`, () => {
        const expected = EXPECTED_SCOPES[frontmatter.slug as string];
        // A new stage with no entry fails loudly rather than passing vacuously —
        // an undeclared scope list is the drift this equality exists to catch.
        if (!expected) {
          throw new Error(`${filename}: no EXPECTED_SCOPES entry for slug "${frontmatter.slug}"`);
        }
        expect(((frontmatter.scopes as string[]) ?? []).slice().sort()).toEqual(expected.slice().sort());
      });

      test(`${filename} reuses an existing agent seat rather than adding one`, () => {
        expect(agentRoster()).toContain(frontmatter.lead_agent as string);
      });

      test(`${filename} declares only sensors that exist in core or in this plugin`, () => {
        const shipped = sensorFiles.map((f) => basename(f, ".md").replace(/^aidlc-/, ""));
        const core = walk(CORE_SENSORS_DIR).map((f) => basename(f, ".md").replace(/^aidlc-/, ""));
        for (const sensor of (frontmatter.sensors as string[]) ?? []) {
          expect([...shipped, ...core]).toContain(sensor);
        }
      });
    }
  });

  test("adds no agent and no scope of its own (§9.1 — reuse the developer seat)", () => {
    expect(existsSync(join(PLUGIN_ROOT, "agents"))).toBe(false);
    expect(existsSync(join(PLUGIN_ROOT, "scopes"))).toBe(false);
  });

  test("adds no contribution to any core stage (§4.7 — `adds` cannot reorder execution)", () => {
    expect(existsSync(join(PLUGIN_ROOT, "contributions"))).toBe(false);
  });

  describe("sensor manifests", () => {
    test("are flat and named aidlc-<id>.md — anything else composes but never fires", () => {
      for (const file of sensorFiles) {
        expect(basename(file)).toMatch(/^aidlc-[a-z0-9-]+\.md$/);
        expect(dirname(file)).toBe(join(PLUGIN_ROOT, "sensors"));
      }
      expect(sensorFiles).toHaveLength(2);
    });

    for (const file of sensorFiles) {
      const filename = basename(file);
      const frontmatter = frontmatterOf(file);

      test(`${filename} id matches the filename stem`, () => {
        expect(scalarField(frontmatter, "id")).toBe(basename(file, ".md").replace(/^aidlc-/, ""));
      });

      test(`${filename} is advisory and deterministic`, () => {
        expect(scalarField(frontmatter, "default_severity")).toBe("advisory");
        expect(scalarField(frontmatter, "kind")).toBe("deterministic");
      });

      test(`${filename} points at a script this plugin ships`, () => {
        const command = scalarField(frontmatter, "command");
        expect(command).toContain("{{HARNESS_DIR}}/tools/");
        const script = command.replace(/^.*\{\{HARNESS_DIR\}\}\/tools\//, "").trim();
        expect(existsSync(join(PLUGIN_ROOT, "tools", script))).toBe(true);
      });
    }
  });

  test("every shipped tool is prefixed so it cannot collide with core", () => {
    const tools = readdirSync(join(PLUGIN_ROOT, "tools")).filter((f) => f.endsWith(".ts"));
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) expect(tool.startsWith("aidlc-akp-") || tool.startsWith("aidlc-sensor-akp-")).toBe(true);
  });

  test("manifest identifies the source and supported content", () => {
    const manifestPath = join(PLUGIN_ROOT, ".aidlc-plugin", "plugin.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe(PLUGIN_NAME);
    expect(manifest.version).toBeTruthy();
    expect(manifest.dependencies).toEqual(["core"]);
    expect(manifest.aidlc?.contributes).toEqual({
      stages: "stages/",
      knowledge: "knowledge/",
      sensors: "sensors/",
      tools: "tools/",
    });
  });

  test("the knowledge the stages tell an agent to load actually ships", () => {
    for (const file of stageFiles) {
      const body = readFileSync(file, "utf-8");
      for (const m of body.matchAll(/knowledge\/(aidlc-[a-z-]+)\/([a-z-]+\.md)/g)) {
        expect(existsSync(join(PLUGIN_ROOT, "knowledge", m[1] as string, m[2] as string))).toBe(true);
      }
    }
  });

  test("the artifact filenames the sensors gate are the ones the stages write", () => {
    const pull = readFileSync(join(PLUGIN_ROOT, "tools", "aidlc-sensor-akp-pull.ts"), "utf-8");
    const push = readFileSync(join(PLUGIN_ROOT, "tools", "aidlc-sensor-akp-push.ts"), "utf-8");
    expect(pull).toContain('"team-knowledge-pull-preflight.md"');
    expect(push).toContain('"team-knowledge-push-deposit.md"');
    const pullStage = readFileSync(join(PLUGIN_ROOT, "stages", "inception", "team-knowledge-pull.md"), "utf-8");
    const pushStage = readFileSync(join(PLUGIN_ROOT, "stages", "operation", "team-knowledge-push.md"), "utf-8");
    expect(pullStage).toContain("team-knowledge-pull-preflight.md");
    expect(pushStage).toContain("team-knowledge-push-deposit.md");
  });
});


