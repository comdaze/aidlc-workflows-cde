// vibe plugin — content guards.
//
// The schema checks mirror the other plugins' (frontmatter validity, namespacing,
// scope identity, manifest shape). The rest of this file pins the four properties
// this plugin's DESIGN rests on, each of which would break silently if edited
// away — the container would keep composing and keep looking installed:
//
//   1. Exactly one stage. Two stages is a workflow, which is the thing this scope
//      exists not to be.
//   2. Enterable from nothing: no consumes, no requires_stage, execution ALWAYS.
//      A container that needs an upstream artifact cannot open a bare session.
//   3. The stage sets autonomy to `autonomous`. That is the Stop hook's first
//      carve-out; without it, every turn that ends mid-session gets nudged as an
//      abandoned workflow, up to the block cap.
//   4. The scope declares no keywords. "vibe" is exactly the word a user types
//      casually, so keyword inference would hijack requests meant for real work.
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
const AGENTS_DIR = join(REPO_ROOT, "dist", "claude", ".claude", "agents");
const PLUGIN_NAME = "vibe";
const SCOPE_NAME = "vibe";
const STAGE_SLUG = "vibe-session";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".md")) out.push(path);
  }
  return out;
}

// The core roster (dist) unioned with this plugin's own agents/ bucket: a
// plugin-shipped stage may name a plugin-shipped persona as lead_agent at
// author-validation time, which is exactly what this stage does.
function agentRoster(): string[] {
  const core = readdirSync(AGENTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => basename(file, ".md"));
  const plugin = walk(join(PLUGIN_ROOT, "agents")).map((file) => basename(file, ".md"));
  return [...new Set([...core, ...plugin, "orchestrator"])].sort();
}

const stageFiles = walk(join(PLUGIN_ROOT, "stages"));
const scopeFiles = walk(join(PLUGIN_ROOT, "scopes"));

describe(`${PLUGIN_NAME} plugin — content validation`, () => {
  test("PROPERTY 1: exactly one stage (two would make it a workflow)", () => {
    expect(stageFiles).toHaveLength(1);
    expect(basename(stageFiles[0] ?? "", ".md")).toBe(STAGE_SLUG);
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

      test(`${filename} belongs only to the free-form scope`, () => {
        expect(frontmatter.scopes).toEqual([SCOPE_NAME]);
      });

      test("PROPERTY 2: enterable from nothing — no consumes, no requires_stage, ALWAYS", () => {
        expect(frontmatter.consumes).toEqual([]);
        expect(frontmatter.requires_stage).toEqual([]);
        expect(frontmatter.execution).toBe("ALWAYS");
      });
    }
  });

  test("PROPERTY 3: the stage sets autonomy to autonomous (the Stop hook carve-out)", () => {
    const body = readFileSync(stageFiles[0] ?? "", "utf-8");
    expect(body).toContain("set-autonomy --mode autonomous");
    // And says why, so the next editor does not read it as boilerplate.
    expect(body.toLowerCase()).toContain("load-bearing");
  });

  test("the stage keeps exactly one approval gate, at close-out", () => {
    const body = readFileSync(stageFiles[0] ?? "", "utf-8");
    const gates = body.match(/--result awaiting-approval/g) ?? [];
    expect(gates).toHaveLength(1);
  });

  test("scope identity remains stable", () => {
    expect(scopeFiles).toHaveLength(1);
    const [scopePath] = scopeFiles;
    if (!scopePath) throw new Error("scope file missing after length assertion");
    const raw = readFileSync(scopePath, "utf-8");
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    expect(scalarField(frontmatter, "name")).toBe(SCOPE_NAME);
    expect(scalarField(frontmatter, "plugin")).toBe(PLUGIN_NAME);
    expect(scalarField(frontmatter, "runner")).toBe("true");
  });

  test("PROPERTY 4: the scope declares no keywords (explicit selection only)", () => {
    const raw = readFileSync(scopeFiles[0] ?? "", "utf-8");
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    expect(frontmatter).toMatch(/^keywords:\s*\[\]\s*$/m);
  });

  test("the plugin name is NOT aidlc-prefixed (reserved for core)", () => {
    // compose refuses any scope/agent declaring `plugin: aidlc-*` because a
    // plugin-owned runner uses the bare name and would clobber core's
    // `aidlc-<name>` runner path. The host plugin is named `aidlc-vibe` by the
    // packager; the internal name must stay bare.
    expect(PLUGIN_NAME.startsWith("aidlc-")).toBe(false);
    expect(SCOPE_NAME.startsWith("aidlc-")).toBe(false);
    // The AGENT is deliberately `aidlc-vibe` — compose's rejection reads the
    // `plugin:` FIELD, not the agent name, and an `aidlc-`-shaped agent name is
    // what puts one clean entry in Kiro's picker. So the field must stay bare
    // even though the name does not.
    const persona = readFileSync(join(PLUGIN_ROOT, "agents", "aidlc-vibe.md"), "utf-8");
    const front = persona.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    expect(scalarField(front, "plugin")).toBe(PLUGIN_NAME);
    expect(scalarField(front, "name")).toBe("aidlc-vibe");
  });

  test("manifest identifies the source and supported content", () => {
    const manifestPath = join(PLUGIN_ROOT, ".aidlc-plugin", "plugin.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe(PLUGIN_NAME);
    expect(manifest.version).toBeTruthy();
    expect(manifest.aidlc?.contributes).toEqual({
      stages: "stages/",
      agents: "agents/",
      scopes: "scopes/",
      knowledge: "knowledge/",
    });
  });
});

// The agent surface. This plugin ships its own seat rather than borrowing
// aidlc-developer-agent's, for two reasons that both break silently if edited
// away: the borrowed seat's knowledge dir was accumulating vibe-only prose that
// every developer-agent stage then had to load, and a Kiro picker entry needs a
// prompt file it owns.
describe(`${PLUGIN_NAME} plugin — agent surface`, () => {
  const PERSONA = join(PLUGIN_ROOT, "agents", "aidlc-vibe.md");
  const KIRO_AGENT = join(PLUGIN_ROOT, "agents", "aidlc-vibe.json");

  test("persona and Kiro config share one filename stem (one picker entry, not two)", () => {
    // Kiro reads BOTH .md and .json under .kiro/agents/ as agent configs, so two
    // different stems produce two picker entries — and the .md one carries no
    // resources, tools, or toolsSettings, i.e. the more discoverable entry was
    // the degraded one. Measured in a real install: the user selected
    // `vibe-agent` and got the prompt without the tool posture or memory pinning.
    // Sharing a stem is how the 14 core agents are shipped, and it collapses the
    // pair to a single name.
    expect(basename(PERSONA, ".md")).toBe(basename(KIRO_AGENT, ".json"));
  });

  test("ships its own persona, with stem == frontmatter name", () => {
    expect(existsSync(PERSONA)).toBe(true);
    const frontmatter = readFileSync(PERSONA, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    expect(scalarField(frontmatter, "name")).toBe(basename(PERSONA, ".md"));
    expect(scalarField(frontmatter, "plugin")).toBe(PLUGIN_NAME);
  });

  test("the persona addresses the harness by token, never a literal dir", () => {
    // compose substitutes {{HARNESS_DIR}} in .md prose only, and this persona is
    // copied to all five harnesses. A hardcoded `.kiro/` would send a Claude,
    // Codex, or opencode session to a directory that does not exist — and it
    // would work perfectly for whoever authored it. The JSON twin is the
    // opposite case: it gets no substitution and is Kiro-only, so it must
    // hardcode `.kiro` (asserted below by the resources check).
    const body = readFileSync(PERSONA, "utf-8");
    expect(body).toContain("{{HARNESS_DIR}}/tools/");
    expect(body).not.toMatch(/\.(kiro|claude|codex|aidlc)\//);
  });

  test("the stage leads with that persona, not a borrowed core seat", () => {
    const frontmatter = parseStageFrontmatter(readFileSync(stageFiles[0] ?? "", "utf-8"));
    expect(frontmatter.lead_agent).toBe(basename(PERSONA, ".md"));
  });

  test("knowledge lands in its own seat (no core seat gets polluted)", () => {
    const seats = readdirSync(join(PLUGIN_ROOT, "knowledge"));
    expect(seats).toEqual([basename(PERSONA, ".md")]);
  });

  describe("Kiro picker entry", () => {
    const agent = JSON.parse(readFileSync(KIRO_AGENT, "utf-8"));

    test("declares NO hooks field", () => {
      // Kiro's docs are self-contradictory on the blast radius: two pages say the
      // IDE ignores the FIELD, one says it ignores any AGENT CONTAINING it. Under
      // that ambiguity a `hooks` key risks the whole agent vanishing from the
      // picker — the one failure mode with no visible symptom. Hooks belong in
      // .kiro/hooks/ regardless, which the IDE does read.
      expect("hooks" in agent).toBe(false);
    });

    test("prompt resolves to the shipped persona", () => {
      expect(agent.prompt).toBe(`file://${basename(PERSONA)}`);
    });

    test("name matches the filename so both surfaces agree", () => {
      // Kiro derives the agent name from the filename when `name` is omitted;
      // when both exist and disagree, which one the picker shows is unspecified.
      expect(agent.name).toBe(basename(KIRO_AGENT, ".json"));
    });

    test("pins the memory layer into context — the read path is the point", () => {
      const resources: string[] = agent.resources ?? [];
      expect(resources.some((r) => r.includes("spaces/default/memory/"))).toBe(true);
      expect(resources).toContain(`file://.kiro/knowledge/${basename(PERSONA, ".md")}/*.md`);
    });

    test("declares NO tool-restricting keys — the default agent's capability is inherited", () => {
      // `tools` is a RESTRICTION, not a grant: declaring it replaces the default
      // toolset with exactly that list, cutting off skills, MCP tools and
      // everything else the default agent has. Shipped once with
      // ["fs_read","fs_write","execute_bash","thinking"] — the CLI 2.x / IDE 0.x
      // names — and measured in a real Kiro IDE session: the agent ended up with
      // ONE tool (the skill loader), able to read the docx-cn manual into context
      // and unable to execute a single step of it. Two failures compounding: the
      // list restricted, and the legacy names did not resolve on IDE 1.x, so even
      // those four were not granted.
      //
      // A free-form coding seat must therefore add nothing to the tool surface
      // and take nothing away. Guardrails belong in the harness's own permission
      // settings, where they apply to every agent, not smuggled into one agent's
      // config where getting the schema version wrong disarms the seat entirely.
      for (const key of ["tools", "allowedTools", "excludedTools", "toolsSettings", "permissions"]) {
        expect(key in agent).toBe(false);
      }
      // What it DOES declare is purely additive.
      expect(Object.keys(agent).sort()).toEqual(
        ["description", "name", "prompt", "resources", "welcomeMessage"],
      );
    });
  });
});
