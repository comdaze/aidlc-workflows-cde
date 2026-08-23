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
//   3. The stage PARKS the container (and never grants autonomy). The engine then
//      answers the Stop hook's probe with the terminal `parked` directive, which
//      the hook honours as a clean turn-end; without the park, every turn that
//      ends mid-session gets nudged as an abandoned workflow AND pays a ~16 KB
//      stage-rules re-delivery. Autonomy is the opposite of what this stage
//      needs: `park` refuses under autonomous, and the Stop hook DECLINES a
//      parked allow under autonomous. (An earlier revision granted autonomy on
//      the strength of a prose claim that it was "the Stop hook's first
//      carve-out" — it is the gate-floor hook's carve-out, not the Stop hook's,
//      and the content-only test here let that claim stand. PROPERTY 3 is now
//      pinned behaviourally against the real tools, not by substring.)
//   4. The scope declares no keywords. "vibe" is exactly the word a user types
//      casually, so keyword inference would hijack requests meant for real work.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

  test("PROPERTY 3 (content): the stage parks the container and never grants autonomy", () => {
    const body = readFileSync(stageFiles[0] ?? "", "utf-8");
    expect(body).toContain("aidlc-orchestrate.ts park");
    // And says why, so the next editor does not read it as boilerplate.
    expect(body.toLowerCase()).toContain("load-bearing");
    // The regression this file previously pinned INTO place: granting autonomy
    // disables the very release path park provides. The command must be absent
    // as an instruction (it may appear inside "do not run" prose — assert the
    // exact instruction shape instead).
    expect(body).not.toContain("set-autonomy --mode autonomous");
    // Close-out must unpark before opening the gate, or the completed workflow
    // answers `parked` instead of `done` forever after.
    expect(body).toContain("unpark");
    expect(body.indexOf("unpark")).toBeLessThan(body.indexOf("--result awaiting-approval"));
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

// PROPERTY 3, behaviourally — the parked-container lifecycle against the REAL
// tools, in a throwaway project composed from dist/. Content assertions above
// prove the stage file SAYS park; this proves the sequence it prescribes WORKS:
// a fresh vibe workflow parks, a plain `next` (the Stop hook's probe shape)
// answers `parked`, sedimentation stays fully functional while parked, and
// close-out can unpark and open the gate. Every prior defect in this area was a
// prose claim no behaviour backed ("asserting a document contains a command is
// not asserting the command works" — team.md), so this block spawns everything.
describe(`${PLUGIN_NAME} plugin — parked-container lifecycle (real tools)`, () => {
  const BUN = process.execPath;

  function run(cwd: string, cmd: string[], env?: Record<string, string>) {
    const r = spawnSync(BUN, cmd, {
      cwd,
      encoding: "utf-8" as const,
      // Every tool resolves the harness dir via AIDLC_HARNESS_DIR at call time;
      // without it the default is .kiro and the .claude install is invisible.
      env: { ...process.env, AIDLC_HARNESS_DIR: ".claude", ...env },
      timeout: 30_000,
    });
    return { code: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? "") };
  }

  test(
    "park -> next answers parked -> surface/persist work while parked -> unpark -> gate opens",
    () => {
      const proj = mkdtempSync(join(tmpdir(), "vibe-park-"));
      try {
        // Framework install (dist/claude), then compose + enable this plugin.
        cpSync(join(REPO_ROOT, "dist", "claude", ".claude"), join(proj, ".claude"), { recursive: true });
        const compose = run(proj, [join(REPO_ROOT, "dist", "plugins", "vibe", "claude", "hooks", "compose.ts")], {
          AIDLC_PLUGIN_ROOT: join(REPO_ROOT, "dist", "plugins", "vibe", "claude"),
          AIDLC_PROJECT_DIR: proj,
          AIDLC_HARNESS_DIR: ".claude",
        });
        expect(compose.code).toBe(0);
        const TOOLS = join(proj, ".claude", "tools");
        expect(run(proj, [join(TOOLS, "aidlc-utility.ts"), "select-plugins", "aidlc,vibe"]).code).toBe(0);

        // Open a vibe container and resolve the skeleton-stance round-trip.
        expect(run(proj, [join(TOOLS, "aidlc-utility.ts"), "intent-create", "--scope", "vibe", "--arguments", "parked lifecycle probe", "--label", "park-probe"]).code).toBe(0);
        expect(run(proj, [join(TOOLS, "aidlc-orchestrate.ts"), "report", "--stage", STAGE_SLUG, "--skeleton-stance", "scope-dependent"]).code).toBe(0);

        // Step 1's park: exits 0 and emits the terminal parked directive.
        const park = run(proj, [join(TOOLS, "aidlc-orchestrate.ts"), "park"]);
        expect(park.code).toBe(0);
        expect(park.out).toContain('"kind":"parked"');

        // The Stop hook's probe shape — a plain `next` — now answers parked,
        // which is the release that stops the per-turn nudge + rules re-delivery.
        expect(run(proj, [join(TOOLS, "aidlc-orchestrate.ts"), "next"]).out).toContain('"kind":"parked"');

        // Sedimentation stays fully functional while parked. surface/persist
        // gate on Current Stage, which park does not move.
        const intentDir = readdirSync(join(proj, "aidlc", "spaces", "default", "intents")).find((d) => d.includes("park-probe"));
        expect(intentDir).toBeTruthy();
        const stageDir = join(proj, "aidlc", "spaces", "default", "intents", intentDir ?? "", "construction", STAGE_SLUG);
        mkdirSync(stageDir, { recursive: true });
        writeFileSync(
          join(stageDir, "memory.md"),
          "## Interpretations\n- 2026-08-10T00:00:00Z — parked probe entry\n\n## Deviations\n\n## Tradeoffs\n\n## Open questions\n",
        );
        expect(run(proj, [join(TOOLS, "aidlc-runtime.ts"), "compile"]).code).toBe(0);
        const surface = run(proj, [join(TOOLS, "aidlc-learnings.ts"), "surface", "--slug", STAGE_SLUG]);
        expect(surface.code).toBe(0);
        expect(surface.out).toContain('"stage_slug":"vibe-session"');
        // BIND `space`/`intent` from surface rather than asserting or hardcoding
        // them. The pair moves together across framework versions — a build whose
        // `surface` emits them is a build whose `persist` REQUIRES them, and one
        // that emits neither rejects neither. So:
        //   * asserting they exist fails on a build that predates them;
        //   * hardcoding them passes while the stage instruction ("copy verbatim
        //     from surface") rots unobserved;
        //   * omitting them fails on a build that requires them —
        //     `missing or non-string space (bind it from surface's output)`, which
        //     is exactly how this block failed against upstream v2 while every
        //     content assertion above stayed green.
        // Binding is the only form that follows the pair instead of pinning one
        // side of it, and it exercises the same route the stage prose prescribes.
        const surfaced = JSON.parse(
          surface.out.slice(surface.out.indexOf("{"), surface.out.lastIndexOf("}") + 1),
        );
        const selections = join(proj, "selections.json");
        writeFileSync(
          selections,
          JSON.stringify({
            stage_slug: STAGE_SLUG,
            ...(typeof surfaced.space === "string" ? { space: surfaced.space } : {}),
            ...("intent" in surfaced ? { intent: surfaced.intent } : {}),
            selections: [{ candidate_id: "c1", type: "learning", scope: "project", heading: "Tooling and Diagnostics", text: "Parked probe rule. Project-specific. (learned 2026-08-10)" }],
          }),
        );
        const persist = run(proj, [join(TOOLS, "aidlc-learnings.ts"), "persist", "--slug", STAGE_SLUG, "--selections-json", selections]);
        expect(persist.code).toBe(0);
        expect(persist.out).toContain('"rule_learned":1');

        // Close-out: unpark first, then the gate opens normally.
        writeFileSync(join(stageDir, "vibe-session-log.md"), "# Vibe Session Log — park probe\n");
        expect(run(proj, [join(TOOLS, "aidlc-state.ts"), "unpark"]).code).toBe(0);
        const gate = run(proj, [join(TOOLS, "aidlc-orchestrate.ts"), "report", "--stage", STAGE_SLUG, "--result", "awaiting-approval"]);
        expect(gate.code).toBe(0);
        expect(gate.out).toContain('"kind":"print"');
      } finally {
        rmSync(proj, { recursive: true, force: true });
      }
    },
    { timeout: 180_000 },
  );
});

// The agent surface. This plugin ships its own seat rather than borrowing
// aidlc-developer-agent's, for two reasons that both break silently if edited
// away: the borrowed seat's knowledge dir was accumulating vibe-only prose that
// every developer-agent stage then had to load, and a Kiro picker entry needs a
// prompt file it owns.
describe(`${PLUGIN_NAME} plugin — agent surface`, () => {
  const PERSONA = join(PLUGIN_ROOT, "agents", "aidlc-vibe.md");
  const personaFrontmatter = (): string =>
    readFileSync(PERSONA, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";

  test("the seat is ONE file — no same-stem .json to shadow it", () => {
    // The whole configuration lives in the .md frontmatter, and there must be no
    // `aidlc-vibe.json` beside it. Kiro reads both formats out of agents/ as
    // agent configs, and when a .md and a .json share a stem the .md wins — so a
    // .json twin is silently inert. That cost three consecutive wrong fixes here:
    // the JSON's `tools` was edited three times (0.x names, then omitted, then
    // ["*"]) and the observed behaviour never changed, because the file was never
    // being read. Its `resources` never applied either.
    //
    // The 14 core agents do ship both, and their .md carries the real config
    // (`tools: ["read","write","shell"]`) while the .json holds a stale 0.x
    // vocabulary. Do not copy the pair; it is the shape that hides the defect.
    const files = readdirSync(join(PLUGIN_ROOT, "agents")).sort();
    expect(files).toEqual(["aidlc-vibe.md"]);
  });

  test("the frontmatter grants the full toolset with the wildcard", () => {
    // Measured three times in a live Kiro session, all before the shadowing was
    // understood: 0.x names -> one tool; key omitted -> one tool; ["*"] in the
    // JSON -> one tool. The fix was never about the value; it was about which
    // file gets read. `["*"]` is the form meaning "everything" (9 of 40+ working
    // configs on a real machine use it, including the stock `developer` agent),
    // and it is the only form that does not pin a tool-name vocabulary that
    // shifts between IDE versions — `fs_read`/`fs_write`/`execute_bash` are 0.x
    // names and do not resolve on 1.x, where the tags are `read`/`write`/`shell`.
    expect(personaFrontmatter()).toMatch(/^tools:\s*\["\*"\]\s*$/m);
  });

  test("the frontmatter pins the knowledge seat and the memory layer", () => {
    // `resources` has to live here too, for the same shadowing reason. Memory
    // also reaches the model through the harness's always-on steering include, so
    // this is belt-and-braces for the memory files — but the knowledge seat is
    // NOT ambient, and pinning it is the only thing that puts the sedimentation
    // guide in front of the model before it is needed.
    const fm = personaFrontmatter();
    expect(fm).toContain("resources:");
    expect(fm).toContain("knowledge/aidlc-vibe/vibe-sedimentation.md");
    expect(fm).toContain("aidlc/spaces/default/memory/org.md");
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
});
