// adapter.test.ts — knowledge-plugin codekb adapter 契约测试(CONTRACT §2/§3)。
import { describe, expect, test, beforeAll } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ADAPTER = join(HERE, "..", "tools", "aidlc-codekb-adapter.ts");
const FIXTURE_REPO = join(HERE, "fixtures", "sample-repo");

const NINE = [
  "business-overview.md",
  "architecture.md",
  "code-structure.md",
  "api-documentation.md",
  "component-inventory.md",
  "technology-stack.md",
  "dependencies.md",
  "code-quality-assessment.md",
  "reverse-engineering-timestamp.md",
];

function runAdapter(repoPath: string, outputDir: string) {
  return spawnSync("bun", [ADAPTER, "--repo-path", repoPath, "--output-dir", outputDir], {
    encoding: "utf-8",
  });
}

describe("codekb adapter — CONTRACT §3", () => {
  let out: string;

  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), "codekb-"));
    const r = runAdapter(FIXTURE_REPO, out);
    if (r.status !== 0) throw new Error(`adapter failed: ${r.stderr}`);
  });

  test("writes all 9 artifacts (v2 RE produces[] contract)", () => {
    for (const f of NINE) expect(existsSync(join(out, f))).toBe(true);
  });

  test("every artifact carries the generated-by header", () => {
    for (const f of NINE) {
      expect(readFileSync(join(out, f), "utf-8")).toContain("generated-by: knowledge-plugin");
    }
  });

  test("component-inventory carries anchored rules and honest unverified marks", () => {
    const inv = readFileSync(join(out, "component-inventory.md"), "utf-8");
    expect(inv).toContain("Salary Configuration");
    expect(inv).toContain("src/salary/calc.py:L88");
    expect(inv).toContain("⚠️ unverified"); // verified:false 绝不冒充事实
    expect(inv).toContain("spec-details/salary-config.spec.md");
  });

  test("api-documentation lists routes with file:line locations", () => {
    const api = readFileSync(join(out, "api-documentation.md"), "utf-8");
    expect(api).toContain("/api/salary/{id}");
    expect(api).toContain("src/api/salary.py:L42");
  });

  test("code-quality-assessment includes blind spots verbatim (no polishing)", () => {
    const q = readFileSync(join(out, "code-quality-assessment.md"), "utf-8");
    expect(q).toContain("rules_loader.py");
    expect(q).toContain("Blind Spots");
  });

  test("timestamp records both generation and adaptation time", () => {
    const t = readFileSync(join(out, "reverse-engineering-timestamp.md"), "utf-8");
    expect(t).toContain("2026-07-26T08:00:00Z");
    expect(t).toContain("codekb adapted at");
  });

  test("idempotent — rerun overwrites, no residue/append", () => {
    const before = readFileSync(join(out, "business-overview.md"), "utf-8");
    const r = runAdapter(FIXTURE_REPO, out);
    expect(r.status).toBe(0);
    const after = readFileSync(join(out, "business-overview.md"), "utf-8");
    // 除 timestamp 外内容应稳定;overview 不含时间,应逐字节相同
    expect(after).toBe(before);
  });
});

describe("codekb adapter — pluggability & fail-closed (CONTRACT §3 行为约定)", () => {
  test("no .ai-ready/ → exit 0 with 'native RE applies' (可插拔开关)", () => {
    const emptyRepo = mkdtempSync(join(tmpdir(), "norepo-"));
    const out = mkdtempSync(join(tmpdir(), "codekb-"));
    const r = runAdapter(emptyRepo, out);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("not present, native RE applies");
    for (const f of NINE) expect(existsSync(join(out, f))).toBe(false);
    rmSync(emptyRepo, { recursive: true, force: true });
  });

  test("missing required file → exit 1 naming the gap (fail-closed)", () => {
    const broken = mkdtempSync(join(tmpdir(), "broken-"));
    cpSync(FIXTURE_REPO, broken, { recursive: true });
    rmSync(join(broken, ".ai-ready", "TECH.md"));
    const out = mkdtempSync(join(tmpdir(), "codekb-"));
    const r = runAdapter(broken, out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("TECH.md");
    rmSync(broken, { recursive: true, force: true });
  });

  test("code-intel version < 2 → exit 1 (数值比较,防字符串等值坑)", () => {
    const old = mkdtempSync(join(tmpdir(), "oldver-"));
    cpSync(FIXTURE_REPO, old, { recursive: true });
    const ciPath = join(old, ".ai-ready", "code-intel.json");
    const ci = JSON.parse(readFileSync(ciPath, "utf-8"));
    ci.version = "1.0";
    writeFileSync(ciPath, JSON.stringify(ci));
    const out = mkdtempSync(join(tmpdir(), "codekb-"));
    const r = runAdapter(old, out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("version");
    rmSync(old, { recursive: true, force: true });
  });
});
