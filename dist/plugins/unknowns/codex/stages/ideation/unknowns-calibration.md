---
slug: unknowns-calibration
number: 1.9
name: Evaluation Calibration
plugin: unknowns
phase: ideation
execution: CONDITIONAL
condition: Execute when a downstream approval gate will ask the human to judge work in a domain where they cannot yet name what good looks like. Skip when the human can already state the dimensions they will judge on.
lead_agent: unknowns-scout-agent
support_agents: []
mode: inline
produces:
  - unknowns-evaluation-ladder
consumes:
  - artifact: unknowns-blindspot-register
    required: false
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
inputs: The blindspot register when one exists, the intent statement, and the human's own account of how they will judge the result
outputs: unknowns-evaluation-ladder.md (under this stage's record dir, engine-resolved)
---

# Evaluation Calibration

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Every approval gate in this framework asks the human a question it never verifies
they can answer: *is this good?* When they cannot yet say what good looks like in
the domain, the gate does not fail loudly — it passes, because nothing looks wrong.
The gate becomes theatre and still emits an audit row saying a human reviewed it,
which is worse than having no gate, because the record now overstates what
happened.

This stage exists to make the downstream gates real. Its output is not a plan or a
design; it is the human's raised ability to judge one domain.

## Steps

### Step 1: Load Agent Personas

Load unknowns-scout-agent persona from `agents/unknowns-scout-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/unknowns-scout-agent/`.

### Step 2: Find the Domain That Needs a Ladder

Read the blindspot register if one exists — its `## Starting Point` and
`## What Good Looks Like` sections point straight at the candidate domains. Then
ask the human one question, in the stage-protocol question format:

> When this is delivered, how will you tell whether it is good? Name the specific
> things you will look at.

Read the answer for capacity, not for content:

- A concrete, dimensioned answer ("p99 under 200ms, no new IAM wildcard, error
  messages name the failing field") means they can already judge. No ladder needed.
- A **single-word or affect-only** answer ("it should feel clean", "just make it
  look professional", "I'll know when I see it") is the signal this stage fires on.
  It is not laziness — it is the honest report of someone who has not yet been
  given the vocabulary.

Pick **at most one** domain per run: the one whose gate is nearest and hardest to
reverse. A ladder for three domains is a document nobody reads.

### Step 3: Decide Applicability

If the human named the dimensions they will judge on, run:

`bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage unknowns-calibration --result skipped --reason "<the dimensions they named, verbatim>"`

Record the dimensions in the reason. They are a better input to the downstream gate
than any ladder you would have built, and the skip row is where they survive.

### Step 4: Build the Ladder

Teach, don't survey. Write `unknowns-evaluation-ladder` to this stage's
engine-resolved record dir:

- `## Domain` — what this ladder covers, and explicitly what it does not.
- `## Vocabulary` — the terms practitioners use for the things the human was
  gesturing at. Short. This is the part that converts "make it feel cleaner" into a
  request that can be acted on, because a person cannot ask for what they cannot
  name.
- `## Dimensions of Good` — **three to five**, no more. For each: what it is, why it
  matters here specifically, and a concrete contrast at three levels — clearly
  bad / acceptable / clearly good. Concrete means an example, a number, or a named
  artefact; "high quality" is not a level.
- `## How To Check Each Dimension` — for each dimension, the cheapest way for the
  human to check it at the gate. A command, a place to look, a comparison to make.
  A dimension the human cannot check is not on the ladder; delete it.
- `## Disagreements` — populated in Step 5.
- `## What This Ladder Does Not Cover` — the parts of the domain this run did not
  reach, so the human knows the boundary of what they can now judge. A ladder that
  claims to cover a whole domain is the same failure this stage was built to fix,
  one level up.

Five dimensions is a ceiling, not a target. Three well-chosen dimensions the human
will actually check beat seven they will skim.

### Step 5: Calibration Check

Building the ladder does not prove the human can now use it. Check it, cheaply.

For two or three of the dimensions, present a **pair** of concrete examples — one
better, one worse, both plausible — and ask the human which is better and why. One
pair at a time. Do not reveal your own ranking first.

Then, for each pair:

- **They agree with your ranking and give a reason on the ladder's terms** — the
  dimension is calibrated. Note it.
- **They agree but for a different reason** — your dimension is roughly right and
  its description is not. Rewrite the description in their terms; theirs is the one
  that will be used at the gate.
- **They disagree with your ranking** — this is the important case, and it is not
  an error to correct. Your "what good looks like" may be the industry default
  rather than the right answer for this project, which is precisely the failure
  mode a confident generic answer produces. Record both positions under
  `## Disagreements` with the reasoning on each side, and mark the dimension
  unresolved. **Do not resolve it in your own favour, and do not quietly drop it.**

An unresolved dimension is a legitimate outcome. It travels to the downstream gate
as a known open question, which is strictly better than a false consensus.

### Step 6: Open the Approval Gate

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage unknowns-calibration --result awaiting-approval`.

### Step 7: Present Completion & Request Approval

Completion emoji: :straight_ruler:
Review path: this stage's engine-resolved record dir.
Lead with the dimensions and where each one landed in the calibration check
(calibrated / reworded / unresolved). Name the downstream gate this ladder is meant
to serve, so the human can judge whether it will actually help there.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
ladder, then report `--result revised` before re-presenting.

## Sensors

This stage's output is a markdown artefact under its record dir. The imported
`required-sections` sensor checks its content shape.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Two entries earn their keep here:

- **Every disagreement from Step 5**, under Open questions, with both positions.
  A disagreement about what good means in this project's domain is a candidate for
  the memory layer, and it is the kind of thing that is obvious now and
  unreconstructable in a month.
- **Any dimension the human never checked** at the downstream gate, if you can see
  it. That is evidence the dimension was yours rather than theirs, and the next
  ladder should not carry it.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
