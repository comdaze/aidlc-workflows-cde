# knowledge-plugin — brownfield deep knowledge engineering

**English** | [中文](README.zh-CN.md)

> A first-party **AIDLC plugin** for brownfield repositories: it replaces core's
> overview-grade `reverse-engineering` codekb with **anchored, human-signed domain
> knowledge**, and closes the knowledge flywheel by writing gate rejections back as
> KEM-lite entries that the next reverse-engineering rerun absorbs.
>
> Full design and integration contract (Chinese): [`CONTRACT.md`](CONTRACT.md).
> Plugin mechanism: [`docs/reference/18-plugin-mechanism.md`](../../docs/reference/18-plugin-mechanism.md).

## 1. What it does

Core's `reverse-engineering` stage turns existing code into 9 markdown files that
five downstream stages read for context. Those files are **overview-grade** — good
enough to orient, too shallow for a codebase whose business logic lives in years of
accumulated rules. This plugin vendors the `s_repo-to-ddd` engine from
[SwarmAI](https://github.com/xg-gh-25/SwarmAI) to produce a deep knowledge base
first, then translates it into the same 9 filenames.

The differentiator is the engine's rule: **every AI-generated assertion carries a
code or doc anchor (`file:line`) and a `verified` marker.** Anchorless claims are
labelled LLM-inferred and unverified rather than passed off as fact, and generation
ends in fail-closed gates (anchor accounting, assertion guards, referential
integrity) that fail the whole run instead of emitting quietly-incomplete knowledge.

Three mount points:

```
[bootstrap]   bootstrap stage — code + docs → .ai-ready/ with anchors + senior sign-off
      │
      ▼
[consume]     reverse-engineering Step 3a — adapter rewrites the 9 codekb files
      │                                     from .ai-ready/ (same filenames)
      ▼
[flywheel]    3 construction stages — gate rejections → KEM-lite in IMPROVEMENT.md
                                      → absorbed on the next RE rerun
```

It adds no agents: the bootstrap stage is led by `aidlc-developer-agent` with
`aidlc-architect-agent` in support, and binds core's `required-sections` sensor.

## 2. Prerequisites

| Requirement | Why |
| --- | --- |
| `python3` | The vendored engine's validation half. Standard library only, no third-party packages. Override the interpreter with `AIDLC_PYTHON` if `python3` isn't the right one. |
| `bun` | The framework's own requirement. |
| A **brownfield** repository | The bootstrap stage never runs on greenfield — there is no existing code to reverse. |
| Scope `enterprise`, `feature`, `mvp`, or `workshop` | The bootstrap stage's `scopes:` list. Note `poc` is **not** included. |

Check the environment before anything else:

```bash
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts check
# ok: Python 3.x.y + vendored ai_ready_helpers importable
```

Throughout this README, `<harness-dir>` is your harness's install directory —
`.kiro` (Kiro IDE / CLI), `.claude`, `.codex`, or `.aidlc` (opencode) — and `<repo>`
is the brownfield repository being reverse-engineered. The stage and contribution
files carry a `{{HARNESS_DIR}}` token that the composer substitutes for you.

## 3. Install

Generic per-harness install steps are in the [root README](../../README.md#manual-install--any-plugin-any-harness).
For Kiro, after the framework is already in the project:

```bash
PLUGIN_ROOT="<repo>/dist/plugins/knowledge-plugin/kiro-ide"   # kiro for Kiro CLI
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "$PLUGIN_ROOT/hooks/compose.ts"
```

> [!IMPORTANT] The framework must be installed **first**. The composer returns
> immediately — no error, no health record — when
> `<project>/<harness-dir>/tools/aidlc-graph.ts` is missing, because it validates
> every plugin stage against the *installed* engine's schema before copying
> anything. Compose is idempotent, so a mis-ordered attempt only needs a re-run.

Confirm composition landed:

```bash
ls .kiro/aidlc-common/stages/inception/knowledge-plugin-bootstrap.md
grep -c 'plugin:knowledge-plugin' .kiro/aidlc-common/stages/inception/reverse-engineering.md   # expect 2
bun .kiro/tools/aidlc-utility.ts plugin-list
```

## 4. How to use it

There is **no dedicated command** for the plugin as a whole — it activates inside
the normal workflow. On a brownfield repo you describe **the actual change you want
built**, not "build a knowledge base"; the bootstrap stage joins the plan on its own
and you never name it in the description.

```text
/aidlc --scope feature Add cross-month back-pay handling to the payroll module
```

Two things decide whether that works, and both bite in practice: the run has to
land in a scope that includes the bootstrap stage (below), and — because the stage
is ordered LAST in inception — a workflow-routed run does not feed its own
downstream stages, so in practice you run the bootstrap first, separately (§4.1).

**Name the scope explicitly.** The bootstrap stage runs only under `enterprise`,
`feature`, `mvp`, or `workshop`, and a bare `/aidlc <description>` does not reliably
land in one of those:

- `feature` and `enterprise` declare `keywords: []`, so keyword inference can never
  match them.
- A description that matches no keyword is routed as `freeform`, which emits a
  **compose offer** rather than defaulting to `feature`. Replying "compose" lets the
  composer propose its own EXECUTE/SKIP grid — whether the bootstrap stage is in it is decided
  case by case, not guaranteed.
- A short description (≤5 whitespace-separated words) that *does* match a keyword
  routes to a scope that **excludes** the bootstrap stage: `fix`/`bug`/`broken` → `bugfix`,
  `refactor`/`clean up`/`simplify` → `refactor`, `deploy`/`infra` → `infra`,
  `security`/`CVE`/`patch` → `security-patch`, `prototype`/`spike`/`poc` → `poc`.
  Above that word count a keyword hit is treated as incidental and falls back to
  `freeform` — but note the count splits on whitespace, so CJK text of any length
  counts as one or two words and always takes the keyword route when one matches.

Passing `--scope` skips inference entirely, so the routing is deterministic.
`feature` is Standard depth; `enterprise` is Comprehensive with the densest gates.
(Only `bugfix`, `feature`, `mvp`, and `security-patch` declare `runner: true`, so
there is no `/aidlc-enterprise` shortcut — use `/aidlc --scope enterprise`.)

> [!IMPORTANT] **An active workflow's scope wins, and `--scope` cannot override it.**
> Scope precedence is: active `aidlc-state.md` → `--scope` flag → the
> `AWS_AIDLC_DEFAULT_SCOPE` env var → `feature`. So while a `poc`-scope workflow is
> active, *every* entry point into this stage is refused — including
> `/knowledge-plugin-bootstrap` and an explicit `--scope feature`:
> `Stage "knowledge-plugin-bootstrap" is skipped for scope "poc"`. Complete or park
> that workflow, switch it with
> `bun <harness-dir>/tools/aidlc-utility.ts scope-change --scope feature`, or use a
> different intent.

### 4.1 Run the bootstrap before you start a workflow

**Routed inside a workflow, this stage runs LAST in inception — too late to help
that run.** Compile does not honour an authored frontmatter `number:`; it harvests
the number pinned in `stage-graph.json` or auto-seeds `<phase-prefix>.<next free
index>` for a new slug, so a plugin stage lands after every core stage in its phase.
The compiled position is `2.9`, and its only ordering edge is
`requires_stage: [state-init]` — nothing puts it ahead of `reverse-engineering`
(`2.1`). The plan the engine writes confirms it:

```
- [ ] reverse-engineering — EXECUTE
- [ ] requirements-analysis — EXECUTE
- [ ] application-design — EXECUTE
- [ ] delivery-planning — EXECUTE
- [ ] knowledge-plugin-bootstrap — EXECUTE     ← last
```

`reverse-engineering` therefore writes the shallow native codekb first, the
downstream stages consume that, and `.ai-ready/` only exists once the run is over.
The deep knowledge reaches the **next** requirement, via the `reverse-engineering`
freshness rerun. The additive contribution seam cannot fix the order:
`adds.requires_stage` is declared-and-logged, not implemented
(`IMPLEMENTED_ADDS = produces | sensors | consumes | required_sections`).

**So run the bootstrap out-of-band first, then start the workflow:**

```bash
# 0. No active workflow, or one whose scope is enterprise/feature/mvp/workshop
bun <harness-dir>/tools/aidlc-utility.ts status
```

```text
# 1. Build the knowledge base (default scope with no active workflow is `feature`)
/knowledge-plugin-bootstrap

# 2. Then the real requirement — reverse-engineering now finds .ai-ready/
/aidlc --scope feature Add cross-month back-pay handling to the payroll module
```

Step 2's `reverse-engineering` completion summary must report `deep (.ai-ready)`
rather than `native`. That is the only reliable signal the plugin took effect.

The cost of this sequence: an isolated run carries `gate: false`, so there is no
engine-enforced approval gate — the senior sign-off becomes your own discipline
rather than a recorded transition. Keep the audit trail by hand in
`.ai-ready/REVIEW-REPORT.md` and `IMPROVEMENT.md`.

### 4.2 Entry points, and what each one actually does

| Entry | Runs the bootstrap? | Notes |
| --- | --- | --- |
| `/knowledge-plugin-bootstrap` | Yes, with no active workflow | Runner is argument-less (`argument-hint: ""`, no `$ARGUMENTS`), so you cannot pass `--scope`. Refused under an active non-qualifying-scope workflow. `gate: false`, and the `CONDITIONAL` condition is not evaluated by the engine. |
| `/aidlc --stage knowledge-plugin-bootstrap --single --scope feature` | Same as above | The raw form. `--scope` is still ignored when a workflow is active. |
| `/aidlc --scope enterprise\|feature\|mvp\|workshop <requirement>` | Yes, but last | Deep knowledge misses the current run (§4.1). |
| `/aidlc-feature <requirement>`, `/aidlc-mvp <requirement>` | Yes, but last | Scope runners with the scope baked in. |
| `/aidlc <requirement>` (no `--scope`) | Unreliable | Freeform routes to a compose offer; whether the bootstrap stage lands in the composed grid is decided case by case. |
| `/aidlc --scope poc\|bugfix\|refactor\|infra\|security-patch <requirement>` | No | These five exclude the stage. |
| `/poc-accelerator-cde <scenario>` | No | The `poc-accelerator-cde` scope excludes the stage. |
| Any entry, greenfield project | No | Step 1 reports skipped. |

### 4.3 One-time bootstrap — stage `knowledge-plugin-bootstrap`

| Field | Value |
| --- | --- |
| Phase / compiled number | inception / auto-seeded last in the phase (`2.9` in a stock install) — see §4.1 |
| Execution | `CONDITIONAL` — brownfield **and** no `.ai-ready/` (or stale/unreviewed) |
| Lead / support | `aidlc-developer-agent` / `aidlc-architect-agent`, `mode: inline` |
| Produces | `ai-ready-knowledge-base` |
| Inputs | `<repo>` source tree + optional `<repo>/docs-input/` |
| Outputs | `<repo>/.ai-ready/` + `<repo>/AGENTS.md` |

**Step 1 — conditions and environment.** Reads `aidlc-state.md` to confirm
brownfield, runs the `check` above, and skips (with a recorded reason) when the
project is greenfield or when `.ai-ready/` already exists and `validate` passes and
you confirm it is current. On an isolated run there is no `aidlc-state.md` and no
way to record a skip — `report --single` accepts forward outcomes only — so the
stage explains the situation and stops instead of writing a false `completed` row.

**Step 2 — generate.** The lead agent follows the vendored engine's own workflow
verbatim (`tools/vendor/repo-to-ddd/INSTRUCTIONS.md`: INGEST → UNDERSTAND → ENRICH
→ GENERATE → VERIFY), producing:

```
<repo>/AGENTS.md                     ← the AI entry document (≤150 lines)
<repo>/.ai-ready/
  ├── PRODUCT.md                     ← why: purpose / audience / boundaries
  ├── TECH.md                        ← how: architecture / conventions / stack
  ├── IMPROVEMENT.md                 ← learned: pitfalls / patterns / KEM-lite entries
  ├── PROJECT.md                     ← now: priorities / decisions / blockers
  ├── code-intel.json                ← machine-readable: modules / routes / entry points
  ├── REVIEW-REPORT.md               ← for humans: scores / gaps / review assignments
  ├── BLIND-SPOTS.md                 ← risky code no spec documents
  └── spec-details/<domain>.spec.md  ← per-domain depth: business rules + anchors
```

Generation then has to clear the fail-closed gates — not optional:

```bash
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts validate --repo-path <repo>
# PASS: code-intel.json clears all fail-closed gates
```

Any error means fix the artifacts and re-validate. A failing knowledge base is
never handed to the gate.

**Step 3 — the senior review package.** This stage's approval gate is a **domain
sign-off, not a formality.** The agent presents per-domain spec files with rule
counts (total, verified vs `unverified`), the checklist in
[`knowledge/senior-review-checklist.md`](knowledge/senior-review-checklist.md), and
REVIEW-REPORT.md's coverage declaration. Watch the two high-risk classes the
checklist calls out: **invented constraints** and **false "this doesn't exist"
claims**. Corrections land in the spec files as `[human]` marks; where a correction
reveals a wrong prior belief, it is also recorded as a KEM-lite `[correction]` entry
in `IMPROVEMENT.md`.

**Step 5 — completion summary.** Must state domains / flows / steps generated, spec
file count, business rules total with **unverified remaining** (the knowledge
maturity number to track run over run), the three coverage tiers (code-verified /
doc+human-confirmed / doc-only), and a reminder that approving this gate means every
downstream stage treats the `[human]`-marked content as fact.

#### The customer-docs channel

When business rules live in configuration, BPM flows, or wiki/feishu documents
rather than code, put the exports under `<repo>/docs-input/`. They join the ENRICH
corpus; extracted rules anchor to the document location and start `verified: false`
until a senior signs them. Config-only areas with no code are declared honestly in
spec-details §8 and BLIND-SPOTS.md rather than glossed over. Rules:
[`knowledge/config-channel.md`](knowledge/config-channel.md).

### 4.4 Every run — `reverse-engineering` Step 3a

The contribution splices one step in after core's Step 3. It is strictly binary:

- **`.ai-ready/` absent** → do nothing; the native 9 artifacts stand. This is the
  pluggability switch: no bootstrap means native RE still works exactly as shipped.
- **`.ai-ready/` present** → resolve the codekb dir, then run the adapter:

```bash
CODEKB=$(bun <harness-dir>/tools/aidlc-utility.ts codekb-path --repo <repo>)
bun <harness-dir>/tools/aidlc-codekb-adapter.ts --repo-path <repo> --output-dir "$CODEKB"
```

Both flags are required. The adapter is **idempotent** (overwrites, never appends)
and **fail-closed** (a structurally incomplete `.ai-ready/` exits non-zero rather
than leaving a half-adapted codekb).

The filenames do not change — `requirements-analysis`, `functional-design`, and
`code-generation` read the same 9 names, but now reason from anchored rules with
sign-off markers. The two clearest upgrades:

| codekb file | What the deep variant adds |
| --- | --- |
| `component-inventory.md` | Grouped by business domain, each with its core business rules (anchored) and a link to the domain's spec-details file. |
| `code-quality-assessment.md` | Coverage gaps recorded verbatim from REVIEW-REPORT.md + BLIND-SPOTS.md, unpolished — credibility comes from honesty. |

The RE completion summary reports which variant this run produced (`native` or
`deep (.ai-ready)`) and, for the deep variant, the domain count, spec-details count,
and **unverified rule count** — reviewers must know the knowledge tier they are
approving on top of.

### 4.5 The flywheel — KEM-lite write-back

Contributions to `functional-design`, `code-generation`, and `build-and-test` extend
each stage's learnings step to propose write-backs to `IMPROVEMENT.md`:

```markdown
- [pitfall] Salary item X rounds differently than the doc says; code wins — anchor: src/salary/calc.py:L88
  <!-- kem: type=pitfall | date=2026-08-05 | source=gate:code-generation | verified=human -->
```

`type` is one of `pitfall` / `decision` / `guideline` / `correction`; `source` names
the gate or stage that produced the entry. **Gate rejections are the highest-priority
source** — the moment a human says "no, it should be X" is the moment knowledge is
created. Write-back is always propose-then-approve, never silent. Format:
[`knowledge/kem-lite.md`](knowledge/kem-lite.md).

The loop closes on freshness: the next requirement's RE rerun regenerates the codekb
from the updated `.ai-ready/`, so downstream stages read the newer knowledge. No
extra machinery — it all happens inside the AIDLC workflow.

## 5. Manual tool entry points

The deterministic half is usable standalone:

```bash
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts check                        # environment self-test
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts validate --repo-path <repo>  # gate an existing base
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts test                         # vendor suite (needs pytest)
bun <harness-dir>/tools/aidlc-codekb-adapter.ts --repo-path <repo> --output-dir <codekb>
```

There is deliberately **no `generate` subcommand**. Generation is LLM work driven by
`INSTRUCTIONS.md`; this tool guarantees that what was generated cleared the gates.

## 6. When the bootstrap stage doesn't fire

Check in this order:

1. **Greenfield project** — it never fires, by design.
2. **Scope** — the run landed outside `enterprise`/`feature`/`mvp`/`workshop`. This is
   the most common cause: `bugfix`, `refactor`, `infra`, `security-patch`, `poc`, and
   `poc-accelerator-cde` all exclude the stage. Check with
   `bun <harness-dir>/tools/aidlc-utility.ts status`, and see §4 on pinning `--scope`.
3. **A composed scope** — if you replied "compose" to the scope offer, the composer's
   EXECUTE/SKIP grid decides; the bootstrap stage is not guaranteed to be in it.
4. **`.ai-ready/` already present and valid** — that is a normal, reported skip.
5. **Plugin composed and enabled** — `plugin-list` shows the selection;
   `doctor` reports enabled-stage counts and any drop the composer recorded.

## 7. Layout

```
plugins/knowledge-plugin/
├── .aidlc-plugin/plugin.json         # manifest — name, version, contributes
├── CONTRACT.md                       # design + integration contract (Chinese)
├── stages/inception/
│   └── knowledge-plugin-bootstrap.md # the ONE new stage
├── contributions/                    # additive modifications to 4 core stages
│   ├── inception/reverse-engineering.md          # Step 3a — adapter overlay
│   └── construction/{functional-design,code-generation,build-and-test}.md
├── knowledge/
│   ├── kem-lite.md                   # write-back format definition
│   ├── senior-review-checklist.md    # rule-by-rule sign-off checklist
│   └── config-channel.md             # docs-input/ operating rules
├── tools/
│   ├── aidlc-ai-ready-gen.ts         # TS shell over the python validation half
│   ├── aidlc-codekb-adapter.ts       # the .ai-ready/ → 9-file codekb mapping
│   └── vendor/repo-to-ddd/           # vendored s_repo-to-ddd (see VENDORED.md)
└── tests/adapter.test.ts             # adapter contract tests (fixture-driven)
```

The vendored engine rides under `tools/` because the packager only projects a
whitelist of content directories — `vendor/` at the plugin root would never reach
the host. (`CONTRACT.md` §6 still draws it at the plugin root; that part of the
DRAFT is out of date.)

## 8. Scope and known limits

Deliberately **not** in phase one ([`CONTRACT.md`](CONTRACT.md) §8):

| Not doing | Why |
| --- | --- |
| Cultivation automation (daemon / decay / health scoring) | Knowledge volume is small; the human gate is the best quality control. The engine is also bound to the SwarmAI host. |
| tree-sitter AST symbol-level precision | Would drag in the SwarmAI backend. Phase one uses the distributable form: LLM extraction at file/module/route level, bounded below by the python fail-closed gates. |
| behavioral-equivalence (spec ↔ runtime verification) | Upstream isn't wired to a runtime yet. |

Honest precision statement: phase one does **not** include AST-level extraction. For
codebases whose knowledge lives largely in configuration and documents, that form is
roughly lossless — such knowledge was never AST-readable in the first place.

Open items are tracked in [`CONTRACT.md`](CONTRACT.md) §10, including the vendor
baseline commit, the final `docs-input/` location, and upstream notification for the
vendored code.

Vendoring provenance: `s_repo-to-ddd` from SwarmAI VERSION 1.27.0 (snapshot
2026-07-24), vendored 2026-07-26. Full record and local-change list:
[`tools/vendor/repo-to-ddd/VENDORED.md`](tools/vendor/repo-to-ddd/VENDORED.md).

## 9. Testing this plugin

```bash
bun test plugins/knowledge-plugin/tests/adapter.test.ts
```

The suite drives the adapter against a fixture `.ai-ready/` and asserts the
CONTRACT §3 obligations: all 9 artifacts written, the `generated-by` header on each,
anchored rules and honest `unverified` marks in `component-inventory.md`, idempotent
reruns with no residue, `exit 0` + `native RE applies` when `.ai-ready/` is absent,
and fail-closed `exit 1` naming the gap on a missing required file or a
`code-intel.json` below version 2.

The runner discovers `plugins/*/tests/` automatically, so these run in the
integration tier: `bash tests/run-tests.sh --integration`.

## See also

- [`CONTRACT.md`](CONTRACT.md) — design and integration contract, with the customer background
- [Plugin Mechanism](../../docs/reference/18-plugin-mechanism.md) — the normative plugin design
- [Authoring a Plugin](../../docs/harness-engineering/10-authoring-a-plugin.md) — the author guide
- [Brownfield knowledge](../../core/knowledge/aidlc-shared/brownfield.md) — core's native brownfield handling
