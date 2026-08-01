# AI-DLC — one core, many harnesses

This directory contains a native implementation of the AI-DLC (AI-Driven
Development Life Cycle) methodology that ships to many CLI harnesses — today
Claude Code, Kiro CLI, Kiro IDE, Codex CLI, and opencode, and any capable CLI you port it to — from
a single hand-authored source.

## Project Structure

- `core/` — **The hand-authored, harness-neutral source of truth.** Tools, stages (`aidlc-common/`), agents, memory (the rule/method layer), scopes, sensors, knowledge, hooks, and the 3 session skills. Prose names the harness directory with the `{{HARNESS_DIR}}` token; the packager substitutes `.claude`/`.kiro`/`.codex` per tree.
- `harness/<name>/` — **The thin per-harness authored surface.** Each holds `manifest.ts` (how to project `core/` into that harness's dist) plus the orchestrator skill and harness-specific files; `harness/codex/` and `harness/opencode/` add an `emit.ts` (per-shell emissions). `claude/`, `kiro/`, `kiro-ide/`, `codex/`, `opencode/`.
- `plugins/<name>/` — **Optional, owned AIDLC plugins** (the plugin mechanism; design in the single chapter `docs/reference/18-plugin-mechanism.md`, authoring guide `docs/harness-engineering/10-authoring-a-plugin.md`). Each holds `.aidlc-plugin/plugin.json` (the declarative manifest) + core-shaped subtrees (`stages/`, `contributions/`, `sensors/`, `tools/`, …) + `tests/`. `bun scripts/package.ts` emits a real host plugin per harness at `dist/plugins/<name>/{claude,codex,kiro,kiro-ide,opencode}/`; a compose hook merges the plugin into an install (new stages + the additive contribution seam). Plugins add, the install selects: `tools/data/harness.json` `plugins` filters the enabled graph/scope/runner surfaces while keeping installed files re-enableable. `plugins/test-pro/` is the reference fixture. Guarded by `tests/integration/t188-plugin-compose.test.ts` (mechanism) + `plugins/test-pro/tests/` (content, wired into the integration tier).
- `scripts/package.ts` — **The build entry.** `bun scripts/package.ts` regenerates every `dist/<harness>/`; `bun scripts/package.ts --check` is the byte-parity drift guard (CI tier). `manifest-types.ts` is the shared manifest contract.
- `dist/<harness>/` — **GENERATED, committed, drift-guarded.** `dist/claude/.claude/`, `dist/kiro/.kiro/` (+ `AGENTS.md`), `dist/kiro-ide/.kiro/` (+ `AGENTS.md`), `dist/codex/` (`.codex/` + `.agents/` + `AGENTS.md`), `dist/opencode/` (`.aidlc/` + `.opencode/` + `opencode.json` + `AGENTS.md`). Never hand-edit — `package.ts --check` fails CI on drift. Users copy `dist/<harness>/` into their project.
- `tests/` — All-TypeScript test suite (`t*.test.ts`, run via bun), four levels (smoke/unit/integration/e2e). Run `bash tests/run-tests.sh --help` for levels and profiles.
- `docs/guide/` — User Guide: getting started, workflows, scopes, agents, customization, troubleshooting
- `docs/harness-engineering/` — Harness Engineer Guide: reshaping AIDLC through configuration (stages, agents, scopes, rules, sensors, knowledge) without code, plus porting AIDLC to a new harness
- `docs/reference/` — Developer Reference: architecture, orchestrator, stage protocol, hooks, testing, contributing

## How It Works

The hand-authored source lives in `core/` (harness-neutral) + `harness/<name>/`
(per-CLI surfaces); `bun scripts/package.ts` regenerates the `dist/<harness>/`
trees. The core uses the same building blocks in every harness:

- **Skills** (`skills/aidlc/`) — Orchestrator (`SKILL.md`), stage protocol, and 32 stage files across 5 phases (initialization, ideation, inception, construction, operation)
- **Agents** (`agents/`) — 14 `aidlc-<role>-agent.md` files: 11 domain-expert personas (product, design, delivery, architect, aws-platform, compliance, devsecops, developer, quality, pipeline-deploy, operations), 2 review-only agents (product-lead, architecture-reviewer), and the adaptive-workflows composer (aidlc-composer-agent)
- **Method/rules** (`memory/`) — Layered config in the space memory layer: `org.md` (framework defaults), `team.md` (affirmed practices), `project.md` (project overrides), and `phases/<phase>.md` for ideation/inception/construction/operation
- **Sensors** (`sensors/`) — Deterministic verification manifests (advisory): `aidlc-required-sections.md`, `aidlc-upstream-coverage.md`, `aidlc-linter.md`, `aidlc-type-check.md`
- **Knowledge** (`knowledge/`) — Methodology reference. Per-agent under `aidlc-<agent>-agent/`; cross-agent material in `aidlc-shared/`
- **Tools** (`tools/`) — TypeScript CLI tools, all prefixed `aidlc-*.ts` and run via bun
- **Hooks** (`hooks/`) — 14 framework hooks, all prefixed `aidlc-*.ts`, covering audit emission, sensor dispatch, runtime-graph compile, session lifecycle, state validation, subagent tracking, statusline rendering, human-presence mint, exact dispatch-rule delivery, forwarding-loop enforcement, reviewer read-scope enforcement, and direct state-transition enforcement

## Working on This Project

- **Edit `core/` (or `harness/<name>/`), never `dist/`.** `dist/<harness>/` is generated. After editing, run `bun scripts/package.ts` to regenerate and `bun scripts/package.ts --check` to confirm no drift (the CI guard fails on a hand-edited or stale dist).
- The orchestrator skill (`harness/<name>/skills/aidlc/SKILL.md`) is per-harness; the engine and methodology live in `core/`.
- User-facing onboarding is rendered from `core/templates/onboarding.md` plus each harness's `onboarding.fills.ts`. Edit the shared template for common behavior and `harness/<name>/onboarding.fills.ts` for harness-specific commands, prerequisites, or conventions; the packager emits `dist/claude/.claude/CLAUDE.md` and the Kiro/Codex `AGENTS.md` files.
- "harness" has three senses in this repo: `harness/` (top-level, the per-CLI distribution surfaces — this effort), `docs/harness-engineering/` (the Harness Engineer Guide), and `tests/harness/` (test-suite helper library) — unrelated.
- See `docs/guide/` (User Guide), `docs/harness-engineering/` (Harness Engineer Guide), and `docs/reference/` (Developer Reference) for full documentation

## Test Suite

Run `bash tests/run-tests.sh --help` for levels and flags. See `docs/reference/09-testing.md` for full strategy.

## Utility Handler Checklist

See `docs/reference/11-contributing.md` § "Adding a Utility Handler" before implementing a new `/aidlc --*` command.

## Documentation Policy

IMPORTANT: When adding, removing, or renaming files, directories, commands, or flags — grep `docs/` and `README.md` for stale references and update them in the same commit.

## Upstream Divergence Policy

This is a fork of `awslabs/aidlc-workflows` (branch `v2`). Every file changed outside `plugins/` becomes a merge conflict on some future upstream release, so:

IMPORTANT: Prefer a plugin. CDE-specific behaviour belongs in `plugins/<name>/`, which can never conflict with upstream. Editing `core/` or `harness/` is a last resort, not a shortcut.

IMPORTANT: When a change outside `plugins/` is unavoidable, add a row to `docs/reference/20-fork-divergence.md` in the same commit — stating why it diverges and whether it is upstream-bound. That document is the checklist an upstream sync is driven from; an undocumented divergence is discovered at merge time, in the worst possible context.

Before merging upstream, read `docs/reference/20-fork-divergence.md` §4 (procedure) — in particular: never merge `dist/`, regenerate it; and after the merge, check plugin compose drops, because a renamed stage or moved anchor makes a contribution stop applying *silently* while tests stay green.

## Changelog Policy — this fork freezes the framework version

IMPORTANT: **This fork does NOT bump `core/tools/aidlc-version.ts`, the README badge, or `CHANGELOG.md`.** All three are upstream `awslabs/aidlc-workflows` property and are taken byte-for-byte on every sync. Do not touch them outside a sync merge, and inside a sync merge always resolve them to upstream's side.

Where the fork's changes go instead:

- **CDE-specific behaviour** belongs in a plugin, and the plugin carries its own version in `plugins/<name>/.aidlc-plugin/plugin.json`. Bump that.
- **Release notes for the fork** go in `CHANGELOG.fork.md`, keyed by date and by the upstream version the fork is sitting on. Nothing in the framework reads that file, so it can never conflict.
- **Framework-level changes that genuinely cannot be a plugin** are a fork divergence: record a row in `docs/reference/20-fork-divergence.md` §2 on the way in, and prefer offering the change upstream over carrying it.

Why: upstream ships roughly 1.6 releases a day. When the fork maintained its own version line, those three files became its largest permanent conflict surface — 223 of the 341 upstream edits to files this fork diverges on, over 60 days — and the patch numbers collided outright twice (the fork's 2.5.8/2.5.9 against upstream's, then the fork's 2.5.31 against upstream's `cd209eb1`), each collision tripping t68's duplicate-heading guard. This restores the policy the fork already had at `80a96461`: *"Going forward plugin-only changes bump the plugin version only."*

Both guards stay green under the freeze, and neither requires a bump: `tests/unit/t68-version-changelog-sync.test.ts` only pins that `aidlc-version.ts`, the latest `CHANGELOG.md` heading, and the README badge agree with each other — which upstream's own CI already guarantees — and `scripts/ci-changelog-guard.ts` only forbids *deleting* an existing heading, never requires adding one.

Upstream's own policy, for when you contribute a change to `awslabs/aidlc-workflows` rather than carrying it here: a user-visible PR bumps `core/tools/aidlc-version.ts` (the authored source; the per-harness `dist/<harness>/.../tools/aidlc-version.ts` copies are regenerated by `bun scripts/package.ts`), bumps the README badge, and adds a matching `## [X.Y.Z] - YYYY-MM-DD` heading + bullet(s) to `CHANGELOG.md` in the same commit. Entry shape: heading, one-paragraph summary including any upgrade instruction, then a flat bullet list focused on what users actually invoke. Pure doc sweeps, internal refactors, and test-only changes do NOT bump.
