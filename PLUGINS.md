**English** | [中文](README.zh-CN.md)

# AIDLC Plugins

This fork ships first-party **AIDLC plugins** on top of the AI-DLC framework. A
plugin never edits `core/`: it brings its own stages, scopes, knowledge, and tools,
and merges additive contributions into core stages. Plugins add; the install
selects. Design: [`docs/reference/18-plugin-mechanism.md`](docs/reference/18-plugin-mechanism.md).

For the framework itself — what AI-DLC is, which harnesses it runs on, and how to
install it — see [README.md](README.md).

| Plugin | What it adds | Details |
| --- | --- | --- |
| **`poc-accelerator`** | An eight-step, 3–5 working-day **customer PoC delivery flow** for CDE-certified SAs — CDK-first deployment, a three-tier cost analysis (pilot / production / over-production), a recorded handoff quality checklist, and team knowledge reuse wired into both ends of the flow. | [plugin README](plugins/poc-accelerator/README.md) |
| **`knowledge-plugin`** | **Brownfield deep knowledge engineering** — anchored `.ai-ready/` domain knowledge behind a senior sign-off gate, translated into the `reverse-engineering` codekb, with gate rejections written back as KEM-lite learnings. | [plugin README](plugins/knowledge-plugin/README.md) |
| **`test-pro`** | Comprehensive, traceable test coverage layered onto the workflow. Also the reference implementation of the plugin mechanism — copy its shape for your own plugin. | [plugin README](plugins/test-pro/README.md) |

## Quick install from the chat window

In the harness chat session for the target project, name the plugin you want:

```text
Install the poc-accelerator plugin from https://github.com/comdaze/aidlc-workflows-cde into this project
```

For a reproducible/manual installation or another harness, use the generic steps
below.

## Manual install — any plugin, any harness

Everything installs from this repository's **committed `dist/`**; no build needed.
(Re-run `bun scripts/package.ts` only if you edited `core/` or `plugins/`.)
`<repo>` is your clone of this repository, `<project>` is the target project, and
`<plugin>` is one of the names in the table above. Take the remaining two
placeholders from your harness row:

| Harness | `<harness>` | `<harness-dir>` |
| --- | --- | --- |
| Kiro IDE | `kiro-ide` | `.kiro` |
| Kiro CLI | `kiro` | `.kiro` |
| Claude Code | `claude` | `.claude` |
| Codex CLI | `codex` | `.codex` |
| opencode | `opencode` | `.aidlc` |

**Step 1 — install the framework first.** Copy `dist/<harness>/` into `<project>/`
as listed in [Pick your harness](README.md#pick-your-harness). Skip if the project
already has an AI-DLC install.

> [!IMPORTANT]
> The framework is a hard prerequisite, and getting the order wrong fails **silently**. The composer returns immediately — no error, no health record — when `<project>/<harness-dir>/tools/aidlc-graph.ts` is missing, because it validates every plugin stage against the *installed* engine's schema and agent roster before copying anything. Compose is idempotent, so a mis-ordered attempt only needs a re-run once the framework is in place.

**Step 2 — compose the plugin.** Nothing is pre-copied into the project: the
composer reads from `AIDLC_PLUGIN_ROOT` and writes only into
`<project>/<harness-dir>/`.

```bash
PLUGIN_ROOT="<repo>/dist/plugins/<plugin>/<harness>"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=<harness-dir> bun "$PLUGIN_ROOT/hooks/compose.ts"
```

Claude Code and Codex CLI can instead install through their native plugin
commands, which run the same composer from a `SessionStart` hook:

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/<plugin>/claude
/plugin install aidlc-<plugin>@aidlc-plugins

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/<plugin>/codex
codex plugin add aidlc-<plugin>@aidlc-plugins    # approve the one-time hook trust
```

**Step 3 — verify.** All green means installed:

```bash
cd <project>
bun <harness-dir>/tools/aidlc-utility.ts doctor
bun <harness-dir>/tools/aidlc-utility.ts plugin-list
```

`doctor` reports the enabled plugins and per-plugin enabled-stage counts, and
surfaces anything the composer dropped — a colliding file, a stage it refused, a
failed recompile.

**Step 4 — enable the plugin, if a selection already exists.** A shipped
`harness.json` has no `plugins` key, which means *every installed plugin is
enabled*, so a fresh install needs nothing here. Once a selection exists,
composing does not auto-enable; name the full enabled set, with `aidlc` for core:

```bash
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc,<plugin>
```

A composed-but-disabled plugin still copies its own files (runtime-filtered, so
inert) but does **not** merge its contributions into core stages. `doctor` shows an
advisory drop naming this exact command.

## Per-plugin setup

Composing installs a plugin; some need configuration or a specific entry point
before they do anything.

**`poc-accelerator`** — MCP configuration is **required**. Create
`<harness-dir>/settings/mcp.json` (Kiro), `.mcp.json` (Claude Code), or
`~/.codex/config.toml` (Codex) from the Global or China example in
`<harness-dir>/knowledge/aidlc-pipeline-deploy-agent/mcp-setup.md`. Regional
availability checks, CDK validation, and the step-8 cost analysis all run through
those servers. Then start the customer-delivery flow with either explicit entry:

```text
/poc-accelerator-cde Build a safe customer demo for <customer scenario>
# or
/aidlc --scope poc-accelerator-cde Build a safe customer demo for <customer scenario>
```

Do not use `/aidlc pocx` or bare `/aidlc poc`: `pocx` is not an alias, and core
`poc` remains the separate throwaway feasibility-spike scope.

**`knowledge-plugin`** — needs `python3` on PATH (the vendored engine is
standard-library only) and targets **brownfield** repositories: its bootstrap stage
runs only when the project has existing code and no current `.ai-ready/`, under the
`enterprise`, `feature`, `mvp`, or `workshop` scopes. It has no entry point of its
own — it activates inside the normal inception flow.

> [!NOTE]
> **First run, any plugin:** write the org rule baseline into `aidlc/spaces/default/memory/org.md` — deployment norms, security red lines, and (if your team maintains one) a `## Team Knowledge Repository` section naming an approved local checkout or repository URL.
