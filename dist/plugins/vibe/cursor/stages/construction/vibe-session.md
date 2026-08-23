---
slug: vibe-session
number: 3.90
name: Free-form Session
plugin: vibe
phase: construction
execution: ALWAYS
condition: The only stage in the vibe scope. Opens a container for free-form work and stays open until the user closes it.
lead_agent: aidlc-vibe
support_agents: []
mode: inline
produces:
  - vibe-session-log
consumes: []
requires_stage: []
sensors: []
scopes:
  - vibe
inputs: Whatever the user is about to work on, plus the memory and knowledge layers the harness already loads
outputs: vibe-session-log.md (under this stage's record dir, engine-resolved) — plus whatever you actually build, which lives in the repo, not here
---

# Free-form Session

MANDATORY: The close-out gate (Steps 5–6) follows stage-protocol.md — and every
command and message format that gate needs is already inlined in those steps. Do
**not** load the full protocol file for this stage: it has no ritual questions,
no stage plan, and no mid-stage gates, so the rest of the protocol buys nothing
here except context spend.

**Read this deviation before applying the protocol's gate rules.** This stage has
exactly **one** approval gate and it sits at close-out (Step 5), reached only when
the user asks to end the session. Between opening and close-out the stage stays
`in-progress` on purpose. That is not a shortcut around the gate rule — it is what
a container means, and two hook-level consequences depend on it:

- `aidlc-block` (the human-presence floor) only fires while a gate is **open**. No
  open gate, no interference — which is why free-form tool use works here, and
  why a native Kiro Spec run can proceed inside this container without being
  blocked mid-task.
- The Stop hook nudges a turn that ends with a pending directive. Step 1 **parks
  the container**, so the engine answers a plain `next` — including that hook's
  own probe — with the terminal `parked` directive, which the hook honours as a
  clean turn-end. Ending a turn mid-session is therefore not treated as
  abandoning a workflow, and the stage-rules bundle (~16 KB) is not re-delivered
  on every conversational turn. Do **not** set Construction Autonomy Mode to
  `autonomous` in this stage: `park` refuses under autonomous, and the Stop hook
  *declines* the parked allow under autonomous — the grant that an earlier
  revision of this stage made "load-bearing" was in fact the one thing keeping
  the nudge loop alive. (Autonomy's real carve-out is the human-presence
  gate-floor hook, and that hook already stands down here because this stage has
  no open gate mid-session.)

Do **not** add gates, required questions, or a stage plan to this stage. If a
piece of work needs those, it needs a different scope — say so and stop, rather
than growing rails here.

## What this stage does NOT claim

No requirements were captured, no design was reviewed, no acceptance criteria
exist. Nothing produced here is evidence that the result is correct, complete, or
production-ready, and the close-out summary must not imply otherwise. The value
on offer is continuity of context and a reviewed path for what you learn — not
verification.

## Steps

### Step 1: Open the Container (once, at session start)

1. Load the `aidlc-vibe` persona from `{{HARNESS_DIR}}/agents/aidlc-vibe.md` and
   its knowledge from `{{HARNESS_DIR}}/knowledge/aidlc-vibe/`, including
   `vibe-sedimentation.md`.

   Skip this if the session was entered by selecting the `aidlc-vibe` agent — that
   agent's prompt **is** this persona, and its `resources` already pinned the
   knowledge seat and the memory layer. Loading it twice is harmless but wastes a
   read; announcing it twice is worse, because the first line the user sees should
   be about their work.
2. **Expect one round-trip before the stage body runs.** Being a construction
   stage, this container inherits the walking-skeleton deferral: the `run-stage`
   directive arrives with `gate: "unresolved"` rather than a boolean, and the
   engine will not proceed until the stance is handed back. Resolve it from the
   memory layer's `## Walking Skeleton` prose (`org` → `team` → `project`, most
   specific non-empty wins) and report it:

   ```bash
   bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage vibe-session \
     --skeleton-stance scope-dependent
   ```

   With the shipped framework defaults the answer is `scope-dependent`, which
   falls back to this scope's `skeleton: off` — the right outcome, reached through
   a question a one-stage scope has no business being asked. Do not skip the
   round-trip anyway: the gate stays unresolved and the stage never opens.

3. Park the container so the session is not treated as an abandoned workflow:

   ```bash
   bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts park
   ```

   This writes the `Parked` / `Parked At Stage` runtime markers (mutation lives
   in the spawned `aidlc-state.ts park`), emits a `WORKFLOW_PARKED` audit row,
   and returns the terminal `parked` directive. It is load-bearing, not cosmetic
   — see the deviation note above: a parked container is what makes the Stop
   hook release every mid-session turn instead of re-feeding the stage rules.
   "Parked container" is this scope's literal mechanism, not a metaphor.

   Everything in this stage works while parked — verified against the real
   tools: the diary is a plain file, `aidlc-learnings.ts surface`/`persist`
   check only that `vibe-session` is the Current Stage (park does not move it),
   and `report` never reads the marker. The one thing park suspends is `next`
   routing, which this stage does not use between opening and close-out.

   Do **not** run `set-autonomy` here (an earlier revision did). `park` refuses
   under autonomous mode, and the Stop hook declines a parked allow under
   autonomous — the two mechanisms are mutually exclusive, and park is the one
   this container needs.
4. Create `vibe-session-log.md` in this stage's record dir with just a heading and
   the session's one-line intent. It grows at close-out; it is not a live diary
   (that is `memory.md`, Step 2).
5. Tell the user in one line what is available (`sediment` to harvest learnings,
   `close` to end the session) and then **get out of the way**.

Steps 2 and 3 are bookkeeping the user did not ask for. Do them in **one** quiet
turn and report the result in a single line — the first thing they read should be
about their work, not about gate stances and park markers.

### Step 2: Free-form Work (the default state — no advance, no gate)

The user drives. Do the work they ask for, in whatever order they ask for it. In
this state:

- Ask **no** ritual questions. Ask only what you would ask in any normal
  conversation to do the task in front of you.
- Do **not** report stage progress, do **not** open a gate, do **not** advance.
- Native Kiro Spec is allowed inside this container. If the user drives a spec,
  let it drive — this stage cannot gate a spec task (`PreTaskExec` exit 2 confers
  no veto, measured), so do not pretend to supervise it. Record what it did in the
  diary like any other work.

**Keep the diary as you go** — it is the raw material for everything in Step 3,
and it is the one habit this stage does insist on. Append to
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent) under
`Interpretations`, `Deviations`, `Tradeoffs`, `Open questions`, each entry with an
ISO 8601 timestamp — the **real** current UTC time (read the clock:
`date -u +%Y-%m-%dT%H:%M:%SZ`), never a fabricated `T00:00:00Z` placeholder,
because the harvest ritual and the audit trail order entries by it. Write an
entry when you make a judgement call the next session
would want to know about: a constraint discovered, a route rejected and why, a
surprise in someone else's code, a decision taken with incomplete information.
Do not narrate what the diff already says.

### Step 3: Sediment on Request (repeatable, any number of times)

When the user asks to sediment ("沉淀" / "记一下" / "learn"), run the §13 ritual
against this stage:

```bash
bun {{HARNESS_DIR}}/tools/aidlc-learnings.ts surface --slug vibe-session
```

Present the surfaced candidates and parked open questions. The user selects,
edits, or discards each one; never self-select. Then build the selections file and
persist the confirmed set:

```json
{ "stage_slug": "vibe-session", "space": "…", "intent": "…", "selections": [ … ] }
```

```bash
bun {{HARNESS_DIR}}/tools/aidlc-learnings.ts persist --slug vibe-session \
  --selections-json <path>
```

**Copy `space` and `intent` verbatim out of the `surface` output above** — do not
re-derive them and do not invent them. `surface` resolves the pair at the moment
it runs and `persist` writes against that pinned pair rather than the live
active-intent cursor, so copying is what stops an intent switch between surfacing
and persisting from filing the rules under the wrong record.

Read the pair off the output rather than assuming it: a build whose `surface`
emits `space`/`intent` **requires** them in the selections file and fails with
`missing or non-string space` if either is absent; a build that emits neither
requires neither and ignores them if present. The output is the judge in both
directions, which is why this shape is spelled out here at all — the deviation
note at the top of this stage tells you **not** to load the protocol file, so the
one requirement in the ritual that is easy to get wrong has to travel with the
command.

Why through the tool rather than editing the memory files directly: the tool
brings the conflict check against broader policy (a project rule contradicting an
org guardrail is refused before it lands), idempotency (re-running writes nothing
twice), and a `RULE_LEARNED` audit row that answers "where did this rule come
from?". Hand-editing gives up all three, which is the whole reason this stage
exists inside the framework instead of beside it.

This step is repeatable and non-terminal — sedimenting does not close the
session. A long session should sediment more than once: at natural boundaries,
while the reasoning is still fresh.

### Step 4: Promote Reusable Knowledge (optional, on request)

Rules go to memory via Step 3. **Prose that needs understanding** — a domain fact,
a technique, a system's behaviour worth reusing — goes to the active space's
knowledge layer instead, under the agent seat that would need it. Ask the user
which seat before writing, and apply the conservation rules from this plugin's
knowledge file: confirmed, sanitized, generalization-graded, dated, and technical
claims carrying the evidence that proved them.

Skip this step unless the user asks. Most sessions produce rules, not knowledge.

### Step 5: Close Out (only when the user asks to end the session)

1. Offer to sediment once more if the diary has entries added since the last
   harvest. A closed session's diary is not harvested again — this is the last
   chance, and saying so is part of the offer.
2. Complete `vibe-session-log.md`: what was worked on, what landed (with file or
   commit references), what was sedimented, what is left open. Keep it short and
   factual. State plainly that this session made no correctness claim.
3. Unpark — the container is closing, so the park marker must not outlive it:

   ```bash
   bun {{HARNESS_DIR}}/tools/aidlc-state.ts unpark
   ```

   Skipping this leaves a completed-but-parked workflow whose next plain `next`
   answers `parked` instead of `done`, and the Stop hook would keep releasing a
   gate it should be holding. Unpark first, then open the gate.
4. Open the gate:

   ```bash
   bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage vibe-session --result awaiting-approval
   ```

### Step 6: Present Completion & Request Approval

Completion emoji: :sparkles:
Review path: this stage's engine-resolved record dir.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report Request Changes with
`--result rejected --user-input "<feedback>"`, revise the session log, then report
`--result revised` before re-presenting.

After approval the workflow completes and the container is gone. Sedimenting
again means opening a new session — which is correct, because this diary has been
harvested.

## Sensors

**None bound, deliberately.** The stage's only artifact is a session log written
once at close-out, so a document-shape sensor firing on every write inside the
record dir would cost friction and check nothing worth checking.

The two code sensors are a different question: their globs (`**/*.{ts,js}` and
`**/*.{ts,tsx}`) match by file type, not by who wrote the file, so binding them
makes verification follow the code regardless of whether you or a spec task wrote
it. **Their cost depends on which engine you installed**: on an engine that gives
them a coalesce window it is one toolchain run per window, and without one it is a
run per write. Check before opting in — the difference is roughly an order of
magnitude in a session that touches many files. Opt in by adding the ids to this
stage's `sensors:` list in the installed copy:

```yaml
sensors:
  - linter
  - type-check
```

Bind them only if the repo actually has that toolchain configured. A sensor that
cannot produce a finding is pure latency — measured at 11 seconds per write on a
project with no eslint, 50 times, for zero findings.

## Learn

`<record>/<phase>/<stage>/memory.md` is the session diary and the input to Step 3.
Unlike a normal stage, it is written **continuously** rather than at completion,
because a container session has no natural single moment of reflection.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
