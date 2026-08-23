// aidlc-codekb-adapter.ts — knowledge-plugin 的核心适配器。
//
// 职责(CONTRACT §3):把 s_repo-to-ddd 产出的 .ai-ready/ 深度知识,映射为
// AIDLC v2 reverse-engineering stage 的 codekb 9 文件契约,供下游 stage
// (requirements-analysis / application-design / functional-design /
//  code-generation …)无感消费。
//
// 行为:
//   - `.ai-ready/` 不存在 → exit 0 + "not present, native RE applies"
//     (可插拔开关:未筑底时 v2 原生 RE 照跑,插件不拦路)
//   - 必需文件缺失 → exit 1 报缺(fail-closed,不产出静默残缺的 codekb)
//   - 幂等:重跑覆盖 9 文件,不追加
//
// Self-contained — no import of the framework's aidlc-lib (a plugin tool ships
// in its own delta and must not depend on a sibling core tool being present).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

interface Flags {
  repoPath?: string;   // 目标 repo 根(含 .ai-ready/)
  outputDir?: string;  // codekb 目录(由 stage 用 aidlc-utility.ts codekb-path 解析后传入)
}

function parseFlags(argv: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo-path") out.repoPath = argv[++i];
    else if (argv[i] === "--output-dir") out.outputDir = argv[++i];
  }
  return out;
}

function fail(msg: string): never {
  process.stderr.write(`aidlc-codekb-adapter: ${msg}\n`);
  process.exit(1);
}

// ---------- .ai-ready/ 读取(CONTRACT §2) ----------

const REQUIRED_DOCS = [
  "PRODUCT.md",
  "TECH.md",
  "IMPROVEMENT.md",
  "PROJECT.md",
  "REVIEW-REPORT.md",
] as const;

interface AiReady {
  docs: Record<string, string>; // 上面 5 个 + 可选 BLIND-SPOTS.md
  codeIntel: CodeIntel;
  aiReadyMeta: Record<string, unknown>;
  specDetails: { file: string; content: string }[];
}

interface CodeIntel {
  version: number | string;
  repo?: Record<string, unknown>;
  modules?: Module[];
  routes?: Route[];
  entry_points?: Route[];
  dependencies?: Record<string, unknown>;
  domains?: Domain[];
  packages?: { name?: string; root?: string }[];
}
interface Module {
  path?: string;
  name?: string;
  purpose?: string;
  description?: string;
  depends_on?: string[];
  depended_by?: string[];
  [k: string]: unknown;
}
interface Route {
  id?: string;
  method?: string;
  path?: string;
  file_path?: string;
  file?: string;
  line?: number;
  line_number?: number;
  type?: string;
  description?: string;
  [k: string]: unknown;
}
interface Domain {
  id?: string;
  name?: string;
  summary?: string;
  entities?: string[];
  business_rules?: { rule?: string; anchor?: string | null; verified?: boolean }[];
  [k: string]: unknown;
}

function loadAiReady(repoPath: string): AiReady | null {
  const dir = join(repoPath, ".ai-ready");
  if (!existsSync(dir)) return null;

  const docs: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of REQUIRED_DOCS) {
    const p = join(dir, name);
    if (existsSync(p)) docs[name] = readFileSync(p, "utf-8");
    else missing.push(name);
  }
  const ciPath = join(dir, "code-intel.json");
  if (!existsSync(ciPath)) missing.push("code-intel.json");
  const metaPath = join(dir, "ai-ready.json");
  if (!existsSync(metaPath)) missing.push("ai-ready.json");
  if (missing.length) fail(`.ai-ready/ present but missing required files: ${missing.join(", ")}`);

  let codeIntel: CodeIntel;
  try {
    codeIntel = JSON.parse(readFileSync(ciPath, "utf-8"));
  } catch (e) {
    fail(`code-intel.json is not valid JSON: ${errorMessage(e)}`);
  }
  // CONTRACT §2.1:version 数值比较(v2 是字符串 "2.0",v3 是数值 3.0)
  const ver = Number(codeIntel.version);
  if (!Number.isFinite(ver) || ver < 2) fail(`code-intel.json version must be >= 2, got: ${codeIntel.version}`);

  let aiReadyMeta: Record<string, unknown> = {};
  try {
    aiReadyMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    /* meta 解析失败不致命——只影响 timestamp 的丰富度 */
  }

  const blind = join(dir, "BLIND-SPOTS.md");
  if (existsSync(blind)) docs["BLIND-SPOTS.md"] = readFileSync(blind, "utf-8");

  const specDetails: AiReady["specDetails"] = [];
  const sdDir = join(dir, "spec-details");
  if (existsSync(sdDir)) {
    for (const f of readdirSync(sdDir).filter((f) => f.endsWith(".spec.md")).sort()) {
      specDetails.push({ file: f, content: readFileSync(join(sdDir, f), "utf-8") });
    }
  }
  return { docs, codeIntel, aiReadyMeta, specDetails };
}

// ---------- 9 文件生成(CONTRACT §3 映射表) ----------

const HEADER = (src: string) =>
  `<!-- generated-by: knowledge-plugin codekb-adapter | source: .ai-ready/${src} | do not hand-edit: regenerated on every reverse-engineering rerun -->\n\n`;

/** 从 markdown 全文提取指定 H2 节(含标题行);找不到返回 null。 */
function extractSection(md: string, headingPattern: RegExp): string | null {
  const lines = md.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) && headingPattern.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

function routeLoc(r: Route): string {
  const file = r.file_path ?? r.file ?? "?";
  const line = r.line ?? r.line_number;
  return line != null ? `${file}:L${line}` : `${file}`;
}

function businessOverview(a: AiReady): string {
  const parts = [HEADER("PRODUCT.md + PROJECT.md"), "# Business Overview\n", a.docs["PRODUCT.md"].trim()];
  parts.push("\n\n---\n\n## Current Project State (from PROJECT.md)\n", a.docs["PROJECT.md"].trim());
  return parts.join("\n");
}

function architecture(a: AiReady): string {
  const parts = [HEADER("TECH.md + code-intel.json"), "# Architecture\n"];
  const arch = extractSection(a.docs["TECH.md"], /architec|架构/i);
  parts.push(arch ?? a.docs["TECH.md"].trim());
  const mods = a.codeIntel.modules ?? [];
  if (mods.length) {
    parts.push("\n\n## Module Topology (from code-intel.json)\n");
    parts.push("| Module | Purpose | Depends on |");
    parts.push("|---|---|---|");
    for (const m of mods) {
      const name = m.path ?? m.name ?? "?";
      const purpose = (m.purpose ?? m.description ?? "").toString().split("\n")[0];
      const deps = (m.depends_on ?? []).slice(0, 6).join(", ");
      parts.push(`| \`${name}\` | ${purpose} | ${deps} |`);
    }
  }
  return parts.join("\n");
}

function codeStructure(a: AiReady): string {
  const parts = [HEADER("code-intel.json modules[]"), "# Code Structure\n"];
  const mods = a.codeIntel.modules ?? [];
  if (!mods.length) parts.push("_code-intel.json carries no modules[] — see architecture.md for the prose layout._");
  for (const m of mods) {
    const name = m.path ?? m.name ?? "?";
    const purpose = (m.purpose ?? m.description ?? "").toString().split("\n")[0];
    parts.push(`- \`${name}\` — ${purpose}`);
  }
  return parts.join("\n");
}

function apiDocumentation(a: AiReady): string {
  const parts = [HEADER("code-intel.json routes[] + entry_points[]"), "# API Documentation\n"];
  const routes = a.codeIntel.routes ?? [];
  const entries = a.codeIntel.entry_points ?? [];
  if (routes.length) {
    parts.push("## HTTP Routes\n");
    parts.push("| Method | Path | Location |");
    parts.push("|---|---|---|");
    for (const r of routes) parts.push(`| ${r.method ?? "?"} | \`${r.path ?? "?"}\` | \`${routeLoc(r)}\` |`);
  }
  if (entries.length) {
    parts.push("\n## Non-HTTP Entry Points\n");
    parts.push("| Type | Name/Path | Location |");
    parts.push("|---|---|---|");
    for (const e of entries) parts.push(`| ${e.type ?? "?"} | \`${e.path ?? e.id ?? "?"}\` | \`${routeLoc(e)}\` |`);
  }
  if (!routes.length && !entries.length)
    parts.push("_No routes or entry points recorded in code-intel.json (config-heavy system? see component-inventory.md)._ ");
  return parts.join("\n");
}

function componentInventory(a: AiReady): string {
  // 深度差异化点:业务域 + 带锚点的业务规则 + spec-details 指针(CONTRACT §3 #5)
  const parts = [HEADER("code-intel.json domains[] + spec-details/"), "# Component Inventory\n"];
  const domains = a.codeIntel.domains ?? [];
  if (domains.length) {
    parts.push(
      "> Business-domain view. Every rule below carries a code/doc anchor; rules marked `unverified` are LLM-inferred and pending senior sign-off — do NOT treat them as confirmed facts.\n"
    );
    for (const d of domains) {
      parts.push(`## ${d.name ?? d.id ?? "?"}\n`);
      if (d.summary) parts.push(`${d.summary}\n`);
      if (d.entities?.length) parts.push(`**Entities:** ${d.entities.join(", ")}\n`);
      const rules = d.business_rules ?? [];
      if (rules.length) {
        parts.push("| Business rule | Anchor | Verified |");
        parts.push("|---|---|---|");
        for (const r of rules) {
          const v = r.verified === true ? "✅" : "⚠️ unverified";
          parts.push(`| ${r.rule ?? ""} | \`${r.anchor ?? "—"}\` | ${v} |`);
        }
        parts.push("");
      }
    }
  }
  if (a.specDetails.length) {
    parts.push("## Deep Domain Specs (spec-details)\n");
    parts.push("Full per-domain specifications — business rules, workflows, coverage gaps, traceability:\n");
    for (const s of a.specDetails) parts.push(`- \`.ai-ready/spec-details/${s.file}\``);
  }
  if (!domains.length && !a.specDetails.length)
    parts.push("_No domain layer generated (code-intel v2 baseline). Module view: see code-structure.md._");
  return parts.join("\n");
}

function technologyStack(a: AiReady): string {
  const parts = [HEADER("TECH.md"), "# Technology Stack\n"];
  const stack = extractSection(a.docs["TECH.md"], /stack|technolog|技术栈/i);
  parts.push(
    stack ??
      `_TECH.md has no explicit stack section — full doc follows._\n\n${a.docs["TECH.md"].trim()}`,
  );
  return parts.join("\n");
}

function dependencies(a: AiReady): string {
  const parts = [HEADER("code-intel.json dependencies"), "# Dependencies\n"];
  const deps = a.codeIntel.dependencies ?? {};
  const keys = Object.keys(deps);
  if (!keys.length) parts.push("_code-intel.json carries no dependencies map._");
  for (const k of keys) {
    parts.push(`## ${k}\n`);
    parts.push("```json");
    parts.push(JSON.stringify((deps as Record<string, unknown>)[k], null, 2));
    parts.push("```");
  }
  return parts.join("\n");
}

function codeQualityAssessment(a: AiReady): string {
  // 覆盖缺口如实照录,不粉饰(CONTRACT §3 #8)
  const parts = [HEADER("REVIEW-REPORT.md + BLIND-SPOTS.md"), "# Code Quality Assessment\n"];
  parts.push(a.docs["REVIEW-REPORT.md"].trim());
  if (a.docs["BLIND-SPOTS.md"]) {
    parts.push("\n\n---\n\n## Blind Spots (risky code no spec documents — verbatim, unpolished)\n");
    parts.push(a.docs["BLIND-SPOTS.md"].trim());
  }
  return parts.join("\n");
}

function timestamp(a: AiReady): string {
  const gen = (a.aiReadyMeta.generated_at ?? a.aiReadyMeta.generated ?? "unknown") as string;
  const ver = (a.aiReadyMeta.version ?? "unknown") as string;
  return [
    HEADER("ai-ready.json"),
    "# Reverse Engineering Timestamp\n",
    `- **Knowledge base generated at:** ${gen}`,
    `- **ai-ready version:** ${ver}`,
    `- **codekb adapted at:** ${new Date().toISOString()}`,
    `- **Adapter:** knowledge-plugin aidlc-codekb-adapter v0.1.0`,
    "",
    "> Freshness contract: the v2 engine treats a stale timestamp as a rerun trigger.",
    "> Rerunning reverse-engineering regenerates .ai-ready/ (absorbing KEM-lite entries",
    "> written back by construction gates) and re-adapts this codekb — the read side of",
    "> the knowledge flywheel.",
  ].join("\n");
}

// ---------- main ----------

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.repoPath) fail("--repo-path is required");
  if (!flags.outputDir) fail("--output-dir is required (resolve it with aidlc-utility.ts codekb-path first)");

  const a = loadAiReady(flags.repoPath);
  if (a === null) {
    process.stdout.write("not present, native RE applies\n");
    process.exit(0);
  }

  mkdirSync(flags.outputDir, { recursive: true });
  const files: Record<string, string> = {
    "business-overview.md": businessOverview(a),
    "architecture.md": architecture(a),
    "code-structure.md": codeStructure(a),
    "api-documentation.md": apiDocumentation(a),
    "component-inventory.md": componentInventory(a),
    "technology-stack.md": technologyStack(a),
    "dependencies.md": dependencies(a),
    "code-quality-assessment.md": codeQualityAssessment(a),
    "reverse-engineering-timestamp.md": timestamp(a),
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(flags.outputDir, name), content.endsWith("\n") ? content : `${content}\n`);
  }
  process.stdout.write(
    `codekb adapted from .ai-ready/: 9 artifacts written to ${flags.outputDir} ` +
      `(${a.specDetails.length} spec-details, ${(a.codeIntel.domains ?? []).length} domains, ` +
      `${(a.codeIntel.routes ?? []).length} routes)\n`
  );
}

main();
