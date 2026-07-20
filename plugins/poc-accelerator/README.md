# poc-accelerator — customer-delivery PoC plugin

**English** | [中文](README.zh-CN.md)

A first-party AIDLC plugin for a **customer-facing, CDK-deployed PoC**. It adds
a focused eight-step delivery scope without changing core `poc`, which remains
a throwaway feasibility spike.

## What it delivers

`poc-accelerator-cde` runs these dedicated steps in order:

1. Requirements capture — one-page brief, acceptance criteria, domain knowledge capture
2. Solution design — architecture diagram and TypeScript CDK stack plan
3. Environment readiness — approved account/region, CDK bootstrap, baseline deployment
4. Walking skeleton — early end-to-end customer demo
5. Feature expansion — only validated core behavior
6. Test validation — repeatable unit/integration evidence
7. CDK deployment — deployed stack and smoke-test evidence
8. Demo and handoff — demo package, extension advice, a three-tier cost analysis (pilot / production / over-production with per-service breakdown), and a value-metrics register

The plugin uses only existing AIDLC personas: product, architect, developer,
quality, and pipeline/deploy. It has no new agent implementation and does not
silently claim production readiness.

## Install and run (Kiro, five steps to the CDE flow)

Everything installs from this repository's **committed `dist/`** — no build
needed. (Rebuild with `bun scripts/package.ts` only if you edited `plugins/`
or `core/`.) `<repo>` below is your clone of this repository; `<project>` is
the customer PoC project directory.

**Step 1 — Base framework** (skip if the project already has `.kiro/` +
`aidlc/`):

```bash
# Kiro IDE — for Kiro CLI use dist/kiro/ instead of dist/kiro-ide/
cp -r <repo>/dist/kiro-ide/.kiro     <project>/.kiro
cp -r <repo>/dist/kiro-ide/aidlc     <project>/aidlc
cp    <repo>/dist/kiro-ide/AGENTS.md <project>/AGENTS.md
```

**Step 2 — Compose the plugin.** No pre-copy into the project: the composer
reads from `AIDLC_PLUGIN_ROOT` and writes only into the project's `.kiro/`.

```bash
PLUGIN_ROOT="<repo>/dist/plugins/poc-accelerator/kiro-ide"   # kiro for Kiro CLI
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "$PLUGIN_ROOT/hooks/compose.ts"
```

**Step 3 — Select plugins** (run inside the project directory):

```bash
cd <project>
bun .kiro/tools/aidlc-utility.ts select-plugins aidlc,poc-accelerator
```

**Step 4 — MCP configuration (required).** Create `.kiro/settings/mcp.json`
from the Global or China example in this plugin's knowledge file
`knowledge/aidlc-pipeline-deploy-agent/mcp-setup.md` (composed into the
install at `.kiro/knowledge/aidlc-pipeline-deploy-agent/`). The eight-step
flow depends on it — regional availability checks, CDK validation, and the
step-8 cost analysis all run through these servers.

**Step 5 — Verify, then start:**

```bash
bun .kiro/tools/aidlc-utility.ts doctor    # all green = installed
```

```text
/poc-accelerator-cde Build a safe customer demo for <scenario>
# or
/aidlc --scope poc-accelerator-cde Build a safe customer demo for <scenario>
```

Both are **supported explicit activation commands**: the direct runner fixes
the CDE scope, while the `/aidlc` form passes the same scope to the
orchestrator. Do not use `/aidlc pocx`, `/aidlc poc cde`, or bare `/aidlc
poc`: `pocx` is not an alias, and core `poc` is the separate throwaway
feasibility-spike scope. The plugin declares no shortcut keywords so the
customer-delivery flow is never selected by ambiguous inference.

> **First-run tip:** write the org rule baseline into
> `aidlc/spaces/default/memory/org.md` — deployment norms, security red
> lines, and (if your team maintains one) a `## Team Knowledge Repository`
> section naming an approved local checkout or repository URL. Step 1 always
> searches the active space's local knowledge first, then searches that source
> for a matching industry pack. If no source is configured, access is blocked,
> or no pack matches, Step 1 explicitly asks you to provide an approved team
> knowledge URL/local path or to skip team knowledge for this PoC. It never
> treats silence as a skip — the plugin ships a deterministic TypeScript
> sensor (`poc-accelerator-team-knowledge-preflight`, advisory like every
> framework sensor) that checks the preflight artifact records a pack import,
> your provided source, or an explicit skip with a named decider.

### Other harnesses

Claude Code and Codex install through their native plugin commands; MCP
configuration goes to `.mcp.json` (Claude Code) or `~/.codex/config.toml`
(Codex). See the [plugin mechanism](../../docs/reference/18-plugin-mechanism.md)
for details.

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/poc-accelerator/claude
/plugin install aidlc-poc-accelerator@aidlc-plugins   # SessionStart hook composes

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/poc-accelerator/codex
codex plugin add aidlc-poc-accelerator@aidlc-plugins  # approve the one-time hook trust
```

## Guardrails

- All infrastructure is TypeScript CDK; console-only resources are not accepted.
- Start with synthetic or masked data. Real customer data requires the approved
  GenAIIC (Generative AI Innovation Center) co-creation path.
- Choose the Global or China MCP configuration deliberately; do not commit
  credentials or use a floating `@latest` package version.
- Record identifiers and owners for MRR, CFN, and SFDC follow-up, but do not
  fabricate business values or connect to those systems without approval.
- Cost figures in the handoff projection are estimates with cited pricing
  sources and inline assumptions — never quotes or commitments.

## Upstream upgrades

This plugin never edits `core/` — all CDE-specific content (stages, scope,
and every knowledge file, including additions for the quality and
pipeline-deploy personas) lives under `plugins/poc-accelerator/` and composes
additively. Upgrading the framework from upstream is therefore:

```bash
git fetch github            # the awslabs upstream remote
git merge github/v2         # or rebase; plugin files never conflict
bun scripts/package.ts      # regenerate every dist projection
bash tests/run-tests.sh --smoke
```

Expected conflict surface: only `CHANGELOG.md` / `README.md` badge /
`core/tools/aidlc-version.ts` (this fork's release-note entries) and the
small security-compliance string edits in `core/tools/aidlc-utility.ts` +
`harness/*/onboarding.fills.ts` (GitFarm-mandated; candidates for
upstreaming). Resolve by taking upstream and re-applying the compliance
strings if upstream has not absorbed them.

## Validate plugin content

```bash
bun test plugins/poc-accelerator/tests/plugin.test.ts
```

The test validates the eight plugin stages against the framework's real stage
schema, checks namespaced artifacts, verifies the dedicated scope, and confirms
that each required input has a plugin-stage producer.
