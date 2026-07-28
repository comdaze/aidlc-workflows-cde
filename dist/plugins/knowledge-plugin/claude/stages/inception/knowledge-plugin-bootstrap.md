---
slug: knowledge-plugin-bootstrap
number: 2.05
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
**before** reverse-engineering runs, using the vendored repo-to-ddd engine.
Reverse-engineering (2.1) then upgrades its codekb from this base via the
knowledge-plugin overlay. This stage is where domain knowledge is BORN; the
human approval gate at its end is where a senior domain expert SIGNS it.

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
