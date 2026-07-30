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
outputs: "<repo>/.ai-ready/ (PRODUCT/TECH/IMPROVEMENT/PROJECT.md + code-intel.json + REVIEW-REPORT.md + ai-ready.json + BLIND-SPOTS.md + spec-details/*.spec.md + AGENTS.md)"
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

ISOLATED-RUN PROTOCOL EXEMPTIONS — what stage-protocol.md requires but a
`"single": true` directive CANNOT do. Read this before you start improvising:
three MANDATORY protocol actions are structurally unavailable in an isolated run,
because they resolve through the active intent that an isolated run deliberately
has none of. They need a core-engine change (a synthetic intent for `--single`),
which a plugin cannot make. Do NOT invent workarounds — do the documented
substitute and say so in the completion summary.

| Protocol requirement | Why it fails on `--single` | What to do instead |
| --- | --- | --- |
| §3 — log every question round (`aidlc-log.ts decision` / `answer`) | `resolveActiveProjectDir()` hard-errors with `No active workflow — refusing to log an interaction event with no resolvable intent` when there is no state file. The `--single` flag on `aidlc-log` only TAGS the Workflow field; it does not bypass that guard. | Keep the full Q&A in the stage's questions file (that file is the source of truth per §3 anyway) and state in the completion summary that no audit rows were emitted. Do not fabricate audit rows by other means. |
| §13 — persist learnings via `aidlc-learnings.ts persist` (emits `RULE_LEARNED`) | `aidlc-learnings.ts` has no `--single` handling at all and fails reading state (`State file not found: …/aidlc-state.md`). | Write the learnings where they belong for THIS plugin — KEM-lite `[correction]` / `[pitfall]` entries in `.ai-ready/IMPROVEMENT.md` per `{{HARNESS_DIR}}/knowledge/kem-lite.md` — and, only with explicit human approval, the team-level ones into the space memory `team.md`. Note in the summary that no `RULE_LEARNED` event was emitted. |
| §2 Part 0 — hold the gate (`report --result awaiting-approval`) and the reject/revise loop | `report --single` accepts FORWARD outcomes only (`approved`, `completed`, `complete`, `done`); `awaiting-approval` / `rejected` / `revised` are refused. The directive also carries `gate: false`. | Present the sign-off package and ask for approval as Step 5 describes, but understand the gate is NOT engine-held: `/aidlc --status` will not show it pending, and a rejection cannot be recorded as a transition. Say this explicitly at the gate so the approver knows their sign-off lives in the artifacts, not in the state machine. Iterate in-conversation, then `report --single --result completed` once. |

Also note the isolated record path has no intent segment — produces/memory resolve
under `aidlc/spaces/<space>/intents/<phase>/<stage>/` rather than the documented
`.../intents/<slug>-<id8>/<phase>/<stage>/`. Same root cause; nothing to do about
it from here, but do not "fix" it by hand-moving files.

If any of this matters for the engagement (auditable sign-off, recorded rejection
loop), run this stage inside a real workflow instead — accepting the ORDERING
consequence above — or run it isolated first and re-run it in-workflow later,
where the second run reports `skipped` cheaply once `.ai-ready/` validates.

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
   REVIEW-REPORT.md and spec-details §7 (Gaps & 改进区), never glossed over.
3. **Write the entry document to `<repo>/.ai-ready/AGENTS.md`, NOT the repo root.**
   The vendored INSTRUCTIONS say to write `AGENTS.md` at the output root and also
   forbid overwriting an existing one without asking. On an AI-DLC host those two
   rules collide by construction: the framework installs its own `AGENTS.md` at the
   project root (harness configuration), so following the vendored instruction
   literally overwrites it. Keep the generated entry document inside `.ai-ready/`.
   Merging any of it into the repo-root `AGENTS.md` is an OPTIONAL, explicitly
   approved human action — propose the merge at the gate, never perform it here.
   (This is the resolution of CraftAI field-test finding L1.)

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
  total business rules, verified vs `unverified`. These live in **§5 业务规则汇总**,
  which the renderer fills from `domains[].business_rules` together with the counts
  line. VERIFY THE SECTION IS NON-EMPTY before presenting the package: a rule that
  is not in `domains[].business_rules` is a rule no reviewer will see, and a blank
  §5 next to a completion message quoting a rule count is the exact failure this
  step exists to prevent (CraftAI field-test finding C1);
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
