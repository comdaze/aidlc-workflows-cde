---
slug: unknowns-blindspot-pass
number: 1.8
name: Blindspot Pass
plugin: unknowns
phase: ideation
execution: CONDITIONAL
condition: Execute when the initiative touches territory the human does not know well — an unfamiliar area of the codebase or an unfamiliar domain. Skip when the human reports working expertise in every area the work touches.
lead_agent: unknowns-scout-agent
support_agents:
  - aidlc-developer-agent
mode: inline
produces:
  - unknowns-blindspot-register
consumes:
  - artifact: intent-statement
    required: false
requires_stage:
  - intent-capture
sensors:
  - required-sections
scopes:
  - enterprise
  - feature
  - mvp
inputs: The intent statement, the workspace itself, and the human's self-reported familiarity with each area the work touches
outputs: unknowns-blindspot-register.md (under this stage's record dir, engine-resolved)
---

# Blindspot Pass

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

This stage does not advance the work. It runs before the expensive commitments —
requirements, design, code — because that is where an unknown is cheapest to find.
Its whole output is a better next instruction.

**Hard constraint: this stage edits no files in the workspace.** It reads, it
compares, it reports. A scout that starts building loses the outside view that
made it useful.

## Steps

### Step 1: Load Agent Personas

Load unknowns-scout-agent persona from `agents/unknowns-scout-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/unknowns-scout-agent/`.
Load aidlc-developer-agent persona from `agents/aidlc-developer-agent.md` for codebase-reading depth.

### Step 2: Establish the Starting Point

This is the load-bearing input and the only thing you must ask the human for. The
same territory produces a different useful report for a novice and for someone who
has shipped in it three times, so a pass run without it defaults to generic advice
— the exact failure mode this stage exists to prevent.

Ask one question, in the stage-protocol question format:

- List the distinct areas this initiative touches (technical areas, product
  domains, and any non-software domain such as design, data, or content).
- For each, ask the human to place themselves: **no experience** / **read about it,
  never shipped it** / **shipped it once or twice** / **working expertise**.

Accept a partial answer. "I don't know what areas this touches" is itself a
finding — record it and derive the area list yourself from the intent statement.

### Step 3: Decide Applicability

If the human reports **working expertise** in every area the initiative touches,
this stage has nothing cheap to add. Run:

`bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage unknowns-blindspot-pass --result skipped --reason "<the areas, and the expertise level reported for each>"`

Put the reported levels in the reason — that skip row is the only durable record
of the starting point when the stage does not run, and the next session will want
it. The engine records the skip and advances to the next in-scope stage.

Otherwise continue with the areas that scored below working expertise. Ignore the
rest; a pass over familiar ground is padding.

### Step 4: Scout the Territory

For each in-scope area, go look — do not reason from the intent statement alone:

- **In this repo** — the relevant modules, their history, the conventions actually
  in force (as opposed to documented), prior art for the thing being asked for,
  and half-finished migrations. Check whether names mean what they appear to mean.
- **Outside this repo** — for a domain the human has no experience in, what
  practitioners treat as table stakes, and the vocabulary they use for it. The
  human cannot ask for what they cannot name.

Read only. Note anything that contradicts the intent statement.

### Step 5: Write the Register

Write `unknowns-blindspot-register` to this stage's engine-resolved record dir,
with these sections:

- `## Starting Point` — the area list and the level reported for each, verbatim.
  Everything below is conditioned on it, and a later reader needs to know that.
- `## Landmines` — the mistakes someone new to this territory typically makes, plus
  the repo-specific potholes: deprecated paths still reachable, misleading names,
  patterns that are half-migrated. Each one concrete enough to avoid.
- `## Hidden Context` — decisions already taken that constrain this work, and the
  invariant each one protects. This is where the unknown knowns live: the reason
  the retry logic is shaped that way, the account model nobody mentions.
- `## What Good Looks Like` — two or three examples of this thing done well, from
  this repo where possible, so the human has something to calibrate against.
- `## Questions An Expert Would Ask` — the three to five questions someone
  experienced would ask before starting, each with your best current answer. Omit
  any question the codebase already answers; go read it instead and put the answer
  under Hidden Context.
- `## Rewritten Intent` — the human's original request, rewritten to carry what you
  found. This is the deliverable. The gap between their version and yours is the
  measurement this stage exists to produce.

Rank every list by blast radius: what would change the architecture or the
approach first, what would change behaviour next. Drop the trivia rather than
listing it at the bottom.

**"No significant blindspots in <area>" is a valid and valuable entry.** Write it
plainly when it is true. Do not manufacture a finding to justify the stage.

### Step 6: Open the Approval Gate

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage unknowns-blindspot-pass --result awaiting-approval`.

### Step 7: Present Completion & Request Approval

Completion emoji: :flashlight:
Review path: this stage's engine-resolved record dir.
Present the `## Rewritten Intent` diff first — original next to rewritten — then
the highest-blast-radius findings. That ordering is the point: the human should see
the gap between their map and the territory before they see the inventory.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
register, then report `--result revised` before re-presenting.

## Sensors

This stage's output is a markdown artefact under its record dir. The imported
`required-sections` sensor checks its content shape.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

One entry is worth making every time: **which of your findings the human already
knew.** That is the calibration signal for the next pass — a register that is 80%
already-known is a pass that cost more than it returned, and the next run should
narrow its areas rather than widen them.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
