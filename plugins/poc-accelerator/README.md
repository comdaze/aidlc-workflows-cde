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
8. Demo and handoff — demo package, extension advice, a three-tier cost analysis (pilot / production / over-production with per-service breakdown), a value-metrics register, and the mandatory knowledge deposit back into the team knowledge repository

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

> `AIDLC_PLUGIN_ROOT` must point at the harness projection
> (`dist/plugins/poc-accelerator/<harness>/`), **not** at a repository root. The
> composer takes the plugin's identity from the host manifest inside the
> projection; pointed elsewhere it reads the directory name instead and skips
> every contribution as foreign. It also exits 0 and writes nothing if
> `<project>/.kiro/tools/aidlc-graph.ts` is missing — so check step 1 landed
> before assuming step 2 worked.

**Step 3 — Plugin selection — only if the project uses one.** With no selection
recorded, every installed plugin is enabled and this one works straight after
step 2; `doctor` reports `all enabled (no selection)`. So this step is usually a
no-op.

It matters in the inverse direction: a selection that **omits**
`poc-accelerator` disables all 8 stages — silently, with `doctor` still green,
because a narrowed selection is a valid state and not an error (measured:
`select-plugins aidlc` drops the enabled counts to `aidlc=29, bootstrap=3` with
no poc row). So whenever a selection exists, or you create one later for any
other plugin, this plugin has to be named in it:

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
bun .kiro/tools/aidlc-utility.ts doctor
```

Expect **0 failed** and these two rows, which are the ones that actually prove the
plugin composed — a green run with the plugin missing looks identical without them:

```text
✓  Enabled plugins: ... enabled stage counts: aidlc=29, bootstrap=3, poc-accelerator=8
✓  Hook drops: none recorded
```

The total row count depends on the framework install, not on this plugin: 39
passed on a stock upstream `v2` install, 44 on this fork's. Either is fine;
`0 failed` plus `poc-accelerator=8` is the signal.

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
> `aidlc/spaces/default/memory/org.md` — deployment norms, security red lines,
> and a `## Team Knowledge Repository` section naming your team knowledge
> repository's **git URL**. That repository is a required input, and the URL
> has to be a git remote rather than a local directory, because the flow uses
> it at both ends:
>
> - **Step 1 reads from it.** It searches the active space's local knowledge
>   first, then probes the URL (`git ls-remote`) and searches it for a matching
>   industry pack. If no memory layer carries a URL, Step 1 asks you for one as
>   a required question — silence, "later", and a bare local path are not
>   answers, and there is no skip path.
> - **Step 8 writes back to it.** The sanitized, customer-approved harvest is
>   deposited through the repository's contribution process (branch + merge
>   request). This is mandatory and **independent of Step 1**: it resolves the
>   URL itself — preflight artifact, then memory layers, then asking you — so a
>   run that never read team knowledge still contributes what it learned.
>
> Both ends carry a deterministic TypeScript sensor (advisory, like every
> framework sensor): `poc-accelerator-team-knowledge-preflight` checks the
> preflight artifact records a probed git URL and a real resolution, and
> `poc-accelerator-team-knowledge-deposit` checks the deposit artifact records
> the approved entry list plus a merge request, a pushed branch, or — when the
> push was refused — a prepared patch with a named owner.

### Other harnesses

The plugin ships a projection for **all five** harnesses — Claude Code, Codex,
Kiro CLI, Kiro IDE, opencode — and composes identically on each: 8 stages, the
`poc-accelerator-cde` scope, 8 stage runners + the scope runner, both sensors, and
the orchestrator's scope/stage tables refreshed. Claude Code, Codex, and opencode
install through their hosts' native plugin commands; both Kiro harnesses use the
explicit compose command in the five-step install above.

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/poc-accelerator/claude
/plugin install aidlc-poc-accelerator@aidlc-plugins   # SessionStart hook composes

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/poc-accelerator/codex
codex plugin add aidlc-poc-accelerator@aidlc-plugins  # approve the one-time hook trust

# opencode — the projection is a host plugin with a SessionStart compose hook;
# if your opencode build has no marketplace command, compose explicitly:
PLUGIN_ROOT="<repo>/dist/plugins/poc-accelerator/opencode"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.aidlc bun "$PLUGIN_ROOT/hooks/compose.ts"
```

MCP configuration is required on every harness and the location differs:
`.mcp.json` (Claude Code), `~/.codex/config.toml` (Codex),
`.kiro/settings/mcp.json` (Kiro), or the top-level `mcp` key in `opencode.json`
(opencode). The plugin's `mcp-setup.md` knowledge file carries all four, including
opencode's one-array `command` shape. See the
[plugin mechanism](../../docs/reference/18-plugin-mechanism.md) for install detail.

> [!NOTE]
> **The two Kiro harnesses do not auto-compose.** The plugin ships both hook
> generations (`aidlc-plugin-compose.json` for Kiro IDE ≥ 1.0.1xx and the legacy
> `.kiro.hook` for pre-1.0 builds), but they only fire if you install those files
> under the project's `.kiro/hooks/`. Kiro CLI wires hooks through
> `agents/aidlc.json` and ignores dropped hook files entirely. On both, run the
> explicit compose command — it is the supported path.

### Updating the plugin in a project that already has it

Re-running compose does **not** update changed content, and this is the one place
where an install can silently keep running an old version. Measured on Kiro IDE:

| Situation | Result |
| --- | --- |
| Re-compose, content unchanged | 0 drops — genuinely idempotent |
| Re-compose, content **changed** | 1 degraded drop, **file not updated** |
| Delete the file from the install, then compose | 0 drops, new content lands |

The composer will not overwrite a path that already exists — it cannot tell its own
earlier output from a core or another plugin's file, so it refuses and records
`collides with an existing file (core or another plugin); not overwritten`. Nothing
fails loudly; the flow keeps running the old stage.

`doctor` is what catches it, so read the row rather than trusting compose's exit
code (it stays 0):

```text
✗  Hook drops (plugin-compose-poc-accelerator): 1 degraded of 1 ...
```

To update, remove the plugin's composed files first, then compose. The stages land
in `.kiro/aidlc-common/stages/<phase>/`, the runners in `.kiro/skills/`:

```bash
cd <project>
rm -rf .kiro/aidlc-common/stages/*/poc-accelerator-* \
       .kiro/skills/poc-accelerator-* \
       .kiro/scopes/poc-accelerator-cde.md \
       .kiro/sensors/aidlc-poc-accelerator-* \
       .kiro/tools/aidlc-sensor-poc-accelerator-*
find aidlc -name 'plugin-compose-poc-accelerator.drops' -delete   # self-clears anyway
# then re-run the step-2 compose command
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
- The team knowledge repository git URL is required at both ends of the flow,
  and the step-8 deposit needs a named approver for what leaves the customer
  engagement. Nothing customer-confidential is deposited, and the branch goes
  through the repository's review process — never straight to its default
  branch.

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
