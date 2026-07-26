// aidlc-ai-ready-gen.ts — 筑底工具的确定性半边。
//
// s_repo-to-ddd 的生成是「LLM agent 按 INSTRUCTIONS.md 执行 + python 校验门控」
// 的混合流程:agent 负责读代码/文档并起草(vendor/repo-to-ddd/INSTRUCTIONS.md),
// python(ai_ready_helpers.py)负责 fail-closed 校验(锚点核算/断言守卫/引用完整
// 性/finalize_v3)。本工具封装 python 半边,给 stage/agent 一个统一入口:
//
//   check    — 环境自检:python3 可用、vendor 脚本在位、可 import
//   validate — 对已生成的 <repo>/.ai-ready/code-intel.json 跑全部校验门控
//              (validate_code_intel_json;任何 error → exit 1 并列出)
//   test     — 跑 vendor 测试套件(排除 8 个宿主耦合项,见 VENDORED.md)
//
// 生成本身(GENERATE)由 stage 的 lead agent 按 vendor/repo-to-ddd/INSTRUCTIONS.md
// 执行——LLM 工作不属于本工具;本工具保证的是「生成完的东西过没过门」。
//
// Self-contained — no import of the framework's aidlc-lib.
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// vendor lives INSIDE tools/ — the packager ships only the contentDirs
// whitelist (stages/sensors/tools/contributions/scopes/agents/knowledge),
// so the vendored engine must ride along under tools/ to reach the host.
const VENDOR_SCRIPTS = join(HERE, "vendor", "repo-to-ddd", "scripts");
// 解释器可用 AIDLC_PYTHON 覆盖(例:pytest 装在 python3.12 而默认 python3 没有)
const PYTHON = process.env.AIDLC_PYTHON ?? "python3";

function fail(msg: string): never {
  process.stderr.write(`aidlc-ai-ready-gen: ${msg}\n`);
  process.exit(1);
}

function py(args: string[], opts: { cwd?: string } = {}) {
  // -B: never write __pycache__ into the vendored tree — it would leak into
  // the packager's dist projection and trip `package.ts --check`.
  return spawnSync(PYTHON, ["-B", ...args], { encoding: "utf-8", cwd: opts.cwd ?? VENDOR_SCRIPTS });
}

function cmdCheck(): void {
  const ver = py(["--version"]);
  if (ver.status !== 0) fail("python3 not found on PATH — the vendored engine requires python3 (stdlib only)");
  if (!existsSync(join(VENDOR_SCRIPTS, "ai_ready_helpers.py")))
    fail(`vendored engine missing: ${VENDOR_SCRIPTS}/ai_ready_helpers.py`);
  const imp = py(["-c", "import ai_ready_helpers; print('import-ok')"]);
  if (imp.status !== 0 || !imp.stdout.includes("import-ok")) fail(`vendored engine failed to import:\n${imp.stderr}`);
  process.stdout.write(`ok: ${ver.stdout.trim()} + vendored ai_ready_helpers importable\n`);
}

function cmdValidate(repoPath: string): void {
  // py() runs with cwd=VENDOR_SCRIPTS — a relative repo path must be resolved first
  const ci = resolve(repoPath, ".ai-ready", "code-intel.json");
  if (!existsSync(ci)) fail(`${ci} not found — run the GENERATE flow (vendor INSTRUCTIONS.md) first`);
  const script = `
import json, sys
from ai_ready_helpers import validate_code_intel_json
doc = json.load(open(${JSON.stringify(ci)}))
errors = validate_code_intel_json(doc)
if errors:
    print(f"FAIL: {len(errors)} validation error(s)")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
print("PASS: code-intel.json clears all fail-closed gates (anchor accounting / assertion guards / referential integrity)")
`;
  const r = py(["-c", script]);
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}

function cmdTest(): void {
  const probe = py(["-c", "import pytest; print(pytest.__version__)"]);
  if (probe.status !== 0)
    fail(
      "pytest not available to python3 — the vendored engine itself is stdlib-only, " +
        "but its test suite needs pytest. Install once: python3 -m pip install pytest"
    );
  // VENDORED.md:8 个宿主耦合测试(import SwarmAI backend 的 core/code_intel 模块)
  // 在宿主外必失败——用 -k 表达式排除(deselect 对类级选择器不可靠)
  const EXCLUDE =
    "not test_generate_then_recall_domain " +
    "and not TestSpecDetailsIndexRow " +
    "and not TestValidatorMatchesRealExporter " +
    "and not test_e2e_on_real_swarmai_domains";
  const r = py(["-m", "pytest", "test_ai_ready_helpers.py", "-q", "-k", EXCLUDE]);
  process.stdout.write(r.stdout.split("\n").slice(-4).join("\n"));
  process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "check":
      return cmdCheck();
    case "validate": {
      const i = rest.indexOf("--repo-path");
      if (i === -1 || !rest[i + 1]) fail("validate requires --repo-path <repo>");
      return cmdValidate(rest[i + 1]);
    }
    case "test":
      return cmdTest();
    default:
      fail(`unknown command: ${cmd ?? "(none)"} — expected check | validate --repo-path <repo> | test`);
  }
}

main();
