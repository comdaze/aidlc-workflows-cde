---
slug: knowledge-plugin-bootstrap
name: Knowledge Base Bootstrap
plugin: knowledge-plugin
phase: inception
execution: CONDITIONAL
condition: Execute when the project is brownfield AND the target repo has no .ai-ready/ directory (or its knowledge base is stale/unreviewed). Skip for greenfield projects and for repos whose .ai-ready/ is present and current.
lead_agent: aidlc-developer-agent
support_agents:
  - aidlc-architect-agent
mode: inline
produces:
  - ai-ready-knowledge-base
consumes: []
requires_stage:
  - state-init
sensors:
  - required-sections
scopes:
  - enterprise
  - feature
  - mvp
  - workshop
inputs: "<repo> source tree + optional <repo>/docs-input/ (customer docs: config exports, BPM flows, feishu docs — see {{HARNESS_DIR}}/knowledge/config-channel.md)"
outputs: "<repo>/.ai-ready/ (PRODUCT/TECH/IMPROVEMENT/PROJECT.md + code-intel.json + REVIEW-REPORT.md + ai-ready.json + spec-details/*.spec.md) + <repo>/AGENTS.md"
---

# Knowledge Base Bootstrap

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Builds the deep, anchored knowledge base (`.ai-ready/`) for a brownfield repo
using the vendored repo-to-ddd engine. `reverse-engineering` upgrades its codekb
from this base via the knowledge-plugin overlay. This stage is where domain
knowledge is BORN; the human approval gate at its end is where a senior domain
expert SIGNS it.

ORDERING — read this before assuming when this stage runs. Compile does NOT
honour an authored frontmatter `number:`; it harvests the number pinned in
`stage-graph.json`, or auto-seeds `<phase-prefix>.<next free index>` for a new
slug. A plugin stage is therefore seeded AFTER every core stage in its phase, so
inside a workflow this stage runs at the END of inception — after
`reverse-engineering`, which by then has already written the shallow native
codekb that the downstream stages consumed. Its only ordering edge is
`requires_stage: [state-init]`; there is no edge that puts it ahead of
`reverse-engineering`, and the additive contribution seam cannot add one
(`adds.requires_stage` is declared-and-logged, not implemented). CONSEQUENCE: run
inside a workflow, this stage's knowledge reaches the NEXT requirement (via the
`reverse-engineering` freshness rerun), not the current one. To have it feed the
current run, run it out-of-band BEFORE the first intent — see the plugin README
§4 "Run the bootstrap before you start a workflow".

## Steps

### Step 1: Check Conditions

Read `<record>/aidlc-state.md` to confirm the project is brownfield. Then check
the target repo:

- Not brownfield → report skipped with reason `greenfield project`.
- `<repo>/.ai-ready/code-intel.json` exists AND
  `bun {{HARNESS_DIR}}/tools/aidlc-ai-ready-gen.ts validate --repo-path <repo>`
  passes AND the user confirms the base is current → report skipped with
  reason `knowledge base present and valid`.

To skip: run
`bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage knowledge-plugin-bootstrap --result skipped --reason "<reason>"`.

ISOLATED RUNS — when the run-stage directive you are executing carries
`"single": true` (a stage-runner invocation, `/knowledge-plugin-bootstrap`), the
skip command above does NOT apply and must not be attempted:

- There is no main workflow, so the bare command fails with `No active intent
  workflow state found (aidlc-state.md is absent)`.
- Adding `--single` does not help either: `report --single` accepts forward
  outcomes only (`approved`, `completed`, `complete`, `done`) and rejects
  `skipped` with `report commits forward outcomes only`.

So on a `single` run, if the conditions above say this stage should not do the
work, tell the user plainly why (greenfield, or base present and valid) and STOP
without calling `report` at all. Never report `completed` for work that was not
done — that writes a false audit row.

Also on a `single` run there is no `<record>/aidlc-state.md` to read: determine
brownfield by inspecting the target repo directly (source files present) and have
the user confirm, rather than guessing.

Environment sanity (before any work):
`bun {{HARNESS_DIR}}/tools/aidlc-ai-ready-gen.ts check` — python3 + the
vendored engine must be available; if not, surface the error and stop.

### Step 2: Generate the Knowledge Base

Follow the vendored engine's own workflow verbatim:
`{{HARNESS_DIR}}/tools/vendor/repo-to-ddd/INSTRUCTIONS.md`
(INGEST → UNDERSTAND → ENRICH → GENERATE → VERIFY), with two additions:

1. **Customer docs channel** — if `<repo>/docs-input/` exists, include it as
   ENRICH corpus per `{{HARNESS_DIR}}/knowledge/config-channel.md`: rules
   extracted from docs anchor to the doc location and start `verified: false`.
2. **Honest coverage** — config-only/undocumented areas are declared in
   REVIEW-REPORT.md and spec-details §8, never glossed over.

The engine's fail-closed gates are not optional: after generation, run

```
bun {{HARNESS_DIR}}/tools/aidlc-ai-ready-gen.ts validate --repo-path <repo>
```

Any error → fix the generated artifacts and re-validate. Never hand a failing
knowledge base to the gate.

### Step 3: Prepare the Senior Review Package

The approval gate for this stage is a **domain sign-off**, not a formality.
Present to the approver:

- per-domain spec files (`.ai-ready/spec-details/*.spec.md`) with counts:
  total business rules, verified vs `unverified`;
- the review checklist `{{HARNESS_DIR}}/knowledge/senior-review-checklist.md`
  (rule-by-rule confirm / correct / leave-unverified — watch the two
  high-risk classes: invented constraints and false "does not exist" claims);
- REVIEW-REPORT.md coverage declaration.

Corrections made during review are applied to the spec files directly
(`[human]` marks) and, where they reveal a wrong prior belief, recorded as
KEM-lite `[correction]` entries in `.ai-ready/IMPROVEMENT.md`
(per `{{HARNESS_DIR}}/knowledge/kem-lite.md`).

### Step 4: Completion Handoff

Hand completion to `stage-protocol.md` via
`bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage knowledge-plugin-bootstrap --result <outcome>`.
The engine owns all lifecycle transitions and advancement.

### Step 5: Present Completion & Request Approval

Use stage-protocol.md completion template. The summary MUST state:

- domains / flows / steps generated; spec-details file count;
- business rules total, with verified vs **unverified remaining** (the
  knowledge-maturity number the team will track run over run);
- coverage tiers (code-verified / doc+human-confirmed / doc-only);
- reminder: approving this gate means the `[human]`-marked content is
  trusted as fact by every downstream stage.
