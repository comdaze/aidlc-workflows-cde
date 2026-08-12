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

/**
 * Every sequence item under a `script:` / `before_script:` / `after_script:` key,
 * as raw text. A deliberately small YAML subset: this repo ships no YAML parser
 * (tools/VENDORED.md — nothing outside the Node standard library), and the check
 * that matters needs only the item text.
 *
 * Block scalars (`- |`, `- >`) own the more-indented lines that follow, so those
 * lines are NOT items — a colon inside a heredoc'd curl or git-push is harmless.
 */
function scriptItems(yaml: string): { key: string; item: string; line: number }[] {
  const SCRIPT_KEYS = /^(\s*)(script|before_script|after_script):\s*$/;
  const out: { key: string; item: string; line: number }[] = [];
  const lines = yaml.split(/\r?\n/);
  let key: string | null = null;
  let keyIndent = 0;
  let blockScalarIndent: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;

    // Inside a block scalar: consume every more-indented line.
    if (blockScalarIndent !== null) {
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }

    const opener = SCRIPT_KEYS.exec(line);
    if (opener) {
      key = opener[2] as string;
      keyIndent = (opener[1] as string).length;
      continue;
    }
    if (key === null) continue;

    // Dedent to or past the key ends the block.
    if (indent <= keyIndent) {
      key = null;
      continue;
    }
    if (line.trimStart().startsWith("#")) continue;

    const item = /^\s*-\s*(.*)$/.exec(line);
    if (!item) continue;
    const text = (item[1] as string).trim();
    // `|`, `>`, and their modifiers (`-`, `+`, an explicit indent digit).
    if (/^[|>][-+0-9]*$/.test(text)) {
      blockScalarIndent = indent;
      continue;
    }
    out.push({ key, item: text, line: i + 1 });
  }
  return out;
}

/**
 * True when a sequence item would parse as a MAPPING rather than a string.
 *
 * An unquoted (plain) YAML scalar containing colon-space, or ending in a colon,
 * is a key/value pair. Wrapping the whole item in quotes makes it a string again,
 * whatever it contains.
 */
function parsesAsMapping(item: string): boolean {
  const text = item.trim();
  if (text === "") return false;
  const quoted =
    text.length > 1 &&
    ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')));
  if (quoted) return false;
  return /:\s/.test(text) || text.endsWith(":");
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

      test(`${filename} is on every core scope (G2 — scope-independent)`, () => {
        expect(((frontmatter.scopes as string[]) ?? []).slice().sort()).toEqual(CORE_SCOPES.slice().sort());
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

describe("hub skeleton (the repo side of the loop)", () => {
  const SKELETON = join(PLUGIN_ROOT, "hub-skeleton");

  test("ships the five tool names CONTRACT §7.1 promises, each a wrapper over a vendored module", () => {
    for (const name of ["validate-cards", "gen-registry", "review-debt", "carry-affirmations", "propose-archive"]) {
      const file = join(SKELETON, "tools", `${name}.ts`);
      expect(existsSync(file)).toBe(true);
      const body = readFileSync(file, "utf-8");
      // A wrapper, never a second implementation — one gate, both sides (§8.3).
      expect(body).toMatch(/import \{ runCli \} from "\.\/aidlc-akp-(validate|registry|lifecycle)\.ts"/);
    }
  });

  test("every module the wrappers import is one the sync script actually vendors", () => {
    const sync = readFileSync(join(SKELETON, "tools", "sync-from-plugin.sh"), "utf-8");
    const wrappers = readdirSync(join(SKELETON, "tools")).filter((f) => f.endsWith(".ts"));
    for (const wrapper of wrappers) {
      const body = readFileSync(join(SKELETON, "tools", wrapper), "utf-8");
      for (const m of body.matchAll(/from "\.\/(aidlc-akp-[a-z-]+\.ts)"/g)) {
        const module = m[1] as string;
        expect(sync).toContain(module);
        expect(existsSync(join(PLUGIN_ROOT, "tools", module))).toBe(true);
      }
    }
  });

  test("the skeleton policy matches the validator's shipped defaults — a drift changes every clock", () => {
    const shipped = JSON.parse(readFileSync(join(SKELETON, "policy", "lifecycle.json"), "utf-8"));
    const validator = readFileSync(join(PLUGIN_ROOT, "tools", "aidlc-akp-validate.ts"), "utf-8");
    for (const [key, value] of Object.entries(shipped.half_life_days as Record<string, number>)) {
      expect(validator).toContain(`${key.includes(" ") ? `"${key}"` : key}: ${value}`);
    }
    expect(validator).toContain(`archive_grace_days: ${shipped.archive_grace_days}`);
  });

  test("only the bundle root index.md declares okf_version (§7.3)", () => {
    const index = readFileSync(join(SKELETON, "index.md"), "utf-8");
    expect(index).toMatch(/^---\r?\nokf_version: "0\.2"/);
  });

  test("CI proposes and never merges — every scheduled job is guarded by a NO-* short circuit", () => {
    const ci = readFileSync(join(SKELETON, ".gitlab-ci.yml"), "utf-8");
    for (const marker of ["NO-DEBT", "NO-CHANGES", "NO-PROPOSAL"]) expect(ci).toContain(marker);
    expect(ci).toContain("merge_request.create");
    // A bot that can merge its own proposal has become the authority (§8.4).
    expect(ci).not.toMatch(/merge_when_pipeline_succeeds|auto_?merge|\bmerge_request\.merge\b/);
    expect(ci).toContain("bun tools/validate-cards.ts");
  });

  // The skeleton's CI is the one file in this plugin that no test could execute:
  // it runs on GitLab, not here. It shipped broken. Two `git commit -m` lines
  // carried a colon-space inside an UNQUOTED plain scalar, so YAML parsed the
  // sequence item as a mapping — `{"git commit -m \"chore(lifecycle)": "..."}` —
  // and GitLab rejected the whole config with "jobs:carry-affirmations:script
  // config should be a string or a nested array of strings". Zero jobs, a
  // yaml-invalid pipeline on every push, and a hub whose CI could never run.
  //
  // `yaml.safe_load`-style "does it parse" is not the check that catches this:
  // the document parses fine, it just parses to the WRONG TYPE. So assert the
  // type: every script entry must be a string.
  test("every script entry in the skeleton CI is a string, not a mapping — an unquoted colon silently changes the type", () => {
    const ci = readFileSync(join(SKELETON, ".gitlab-ci.yml"), "utf-8");
    const hazards = scriptItems(ci).filter((entry) => parsesAsMapping(entry.item));
    // Name the offenders: "expected 0" alone would not say which line to quote.
    expect(
      hazards.map((h) => `${h.key} line ${h.line}: ${h.item}`),
      "unquoted script entries that YAML parses as a mapping — wrap each in single quotes",
    ).toEqual([]);
  });

  // A guard that cannot fail is not a guard. If a refactor of the extractor above
  // ever stops finding items, the previous test passes on an empty list and the
  // bug walks back in. Pin the checker against the exact shape that broke.
  test("the script-entry checker detects the historical break and accepts its fix", () => {
    const broke = [
      "carry-affirmations:",
      "  script:",
      '    - git commit -m "chore(lifecycle): carry spoke affirmations"',
    ].join("\n");
    const fixed = [
      "carry-affirmations:",
      "  script:",
      `    - 'git commit -m "chore(lifecycle): carry spoke affirmations"'`,
    ].join("\n");
    expect(scriptItems(broke).filter((e) => parsesAsMapping(e.item))).toHaveLength(1);
    expect(scriptItems(fixed).filter((e) => parsesAsMapping(e.item))).toHaveLength(0);

    // Block scalars own their continuation lines: those are not sequence items
    // and a colon inside them is harmless. Miscounting them would fire falsely
    // on the curl and git-push steps this CI is built from.
    const blockScalar = ["review-debt:", "  script:", "    - |", '      curl --header "PRIVATE-TOKEN: $TOKEN" url'].join("\n");
    expect(scriptItems(blockScalar).filter((e) => parsesAsMapping(e.item))).toHaveLength(0);
  });
});

