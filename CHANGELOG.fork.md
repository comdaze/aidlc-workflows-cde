# Fork changelog

This is the **CDE fork's** own changelog, and the only place fork release notes
are added from 2026-08-01 onward. `CHANGELOG.md` belongs to upstream
`awslabs/aidlc-workflows`: the fork takes upstream's entries as they are and adds
none of its own — see the frozen-version policy in
`docs/fork/divergence.md` A3.

One historical exception lives in `CHANGELOG.md` rather than here: the 16 entries
`## [2.3.11]` through `## [2.3.26]`, published by the fork before this policy
existed. They stay where they are — the block is inert, upstream only appends at
the top of that file, and moving them would rewrite already-published history for
no gain. Do not resolve `CHANGELOG.md` with `git checkout --theirs` or you will
delete them.

**Why a separate file.** The fork used to bump `core/tools/aidlc-version.ts`,
add its own `## [N.N.N]` heading to `CHANGELOG.md`, and move the README badge.
Upstream ships roughly 1.6 releases a day, so those three files became the
fork's largest permanent conflict surface — 223 of the 341 upstream edits to
files this fork diverges on, measured over 60 days — and the patch numbers
collided outright twice (the fork's 2.5.8/2.5.9 against upstream's, then the
fork's 2.5.31 against upstream's `cd209eb1`). Nothing in the framework reads
this file, so it can never conflict.

**Framework version:** always upstream's, unmodified. Read it from
`core/tools/aidlc-version.ts` or `aidlc --version`.

**Plugin versions:** each plugin carries its own in
`plugins/<name>/.aidlc-plugin/plugin.json`, and that is the number to bump for
CDE-specific work. This restores the policy the fork already had at
`80a96461`: *"Going forward plugin-only changes bump the plugin version only."*

Entries below are keyed by date and by the upstream version the fork was
sitting on, not by a fork version number.

## 2026-08-18 (team-knowledge 0.3.0) — on upstream 2.5.59

**Two live deposits, four days apart, exposed three ways `team-knowledge-push`
could report a clean run while having checked less than it appeared to.** All
three are prose fixes to the stage plus three new entries in `CONTRACT.md` §13 —
no tool or schema change, so a card that passed yesterday still passes.
Plugin-only, nothing for `docs/fork/divergence.md`.

* **Step 5 now validates inside the hub checkout, scoped with `--card` — not an
  isolated staging directory.** Rule 7 dedupe compares digests *within one
  bundle*, so a bundle holding only your own new cards has nothing to compare
  against and passes **vacuously**: it reports clean because it looked at
  nothing. The 2026-08-18 deposit did exactly that, following the old wording,
  and its 7 cards never met the 26 cards then on `main`. Re-run afterwards with
  hub context they all pass — so the outcome was right and the *coverage* was
  absent, which is precisely why this class of defect survives. New `CONTRACT.md`
  §13.6 records that the blindness is structural (no committed registry, no
  network — the validator only knows the bundle in hand), so the prose is a
  mitigation and not a guard.
* **Step 4 now requires the card to state which freshness window its path
  implies, and why that number is right.** `halfLifeDays()` takes its topic from
  `topicOf()` — the concept ID's *path segment* — and silently falls back to the
  plain `type` window when there is no policy entry, which is usually the longest
  one. So the directory sets the shelf life, `tags:` does not correct it, and
  nothing warns: the arithmetic is always right and the input is never checked.
  The step also names the judgement that actually decides it — current state of
  something that changes, versus a settled fact — and warns against inferring it
  from how specific a title looks. A defect pinned to a released version *with*
  the version that fixed it is settled and correctly gets a long window; current
  behaviour of a fast-moving dependency is not. New `CONTRACT.md` §13.7, which
  records that turning this into a hard guarantee would need a new §11 rule and
  is deliberately not done here.
* **Step 1 treats a failed probe as a knowledge question before a credentials
  one, and names the bootstrap it cannot solve.** A host may refuse git over one
  transport while serving the same repository over another, and refuse it in a
  way that reads like a missing repository — so the diagnosis goes to access when
  it belongs to protocol. The step now says to try the other transport form, to
  register the URL in a usable form under the `## Team Knowledge Repository`
  heading resolution actually reads, and to report a wrong registration rather
  than quietly working around it. It also states the limit plainly: a card about
  reaching the hub is unreadable until the hub is reached, so what makes it
  available is a *previous* `team-knowledge-pull` in that project — a
  one-time-per-project bootstrap, not an ordering inside one workflow. When the
  project has never pulled, say so at close-out.
* **Step 2 adds a conventions survey; Step 3 asks how much of the deposit came
  through the `project.md` re-grade.** Reading the hub's `index.md` and topic
  tree before choosing destination paths stops the tree becoming the sum of
  independent inventions — nothing in the validator objects to a path, because a
  path is only wrong relative to a convention no file states. And when most of a
  deposit arrives by hand-opened re-grade (7 of 7 on 2026-08-18), the structural
  exclusion §5.2 leans on is a review gate in structural clothing; the cause is
  upstream routing, so the step says to name it rather than fix it here. New
  `CONTRACT.md` §13.8.
* **Two operational traps are now written down where they bite.** Step 5: build
  the `--card` list as a shell array, because `zsh` does not word-split an
  unquoted `$VAR` — it arrives as one argument, the tool sees zero `--card`
  flags, and it silently validates the whole bundle; the tell is `cards_checked`
  not matching your count. Step 6: keep `-o merge_request.description`
  single-line and short, because a long value has been seen to hang the push and
  then fail with no message — and push options only fire on a ref-updating push,
  so once the branch is up to date a retry reports "Everything up-to-date" and
  creates nothing. The honest resolution there is `branch-pushed` with a named
  owner, never a manufactured empty commit and never a force-push.

Verified: `package.ts --check` in sync; team-knowledge 110 pass, vibe 19 pass,
t68 7 pass, `ci-changelog-guard` OK (180 entries preserved, 0 new); no test
asserted on the changed prose (the `{{HARNESS_DIR}}` assertion covers sensor
`command` fields, not stage bash blocks). The installed `.kiro` copy was
refreshed by hand and confirmed byte-identical to `dist/` for all 12 composed
files — compose is no-clobber and exits 0 with no output, so its silence is not
evidence.

`t188-plugin-compose` reports **74 pass, 1 fail** here, and the failure is
**pre-existing and unrelated to this change** — recorded because the number
differs from the 08-14 entry above. The failing item is the `(unnamed)` `afterAll`
hook, which was never given an explicit timeout while its sibling `beforeAll` got
`TIMEOUT_MS` (60 s); it therefore inherits Bun's 5 s default for a recursive
delete of a multi-project temp tree, and every observed failure lands just over
that line: 5390 / 5458 / 5566 / 5736 / 6292 ms. All 74 assertions pass in every
run. Reproduced at **clean HEAD with zero dirty files**, and *not* reproduced with
only this change applied to clean HEAD — so it is machine-load-dependent, not
content-dependent. The fix the existing team rule prescribes is to derive the
budget from the work or retry the hook; that is a `tests/` edit outside
`plugins/`, so it is left for its own change with a `docs/fork/divergence.md` row
rather than folded in here.

## 2026-08-14 (team-knowledge 0.2.0, vibe 0.3.1) — on upstream 2.5.59

**A free-form session can now publish what it confirmed to the team hub.**
`team-knowledge-push` joins the `vibe` scope grid; `team-knowledge-pull`
deliberately does not. Plugin-only change — no `core/` or `harness/` edits, so
nothing new to record in `docs/fork/divergence.md`.

* **team-knowledge 0.2.0 — `push` (4.95, operation) is now on the `vibe`
  scope.** The vibe scope's whole justification is that what a session learned
  survives it, and its sedimentation already lands in `team.md` through the same
  `aidlc-learnings.ts persist` ritual this stage reads from — so at 4.95, after
  close-out, the export half applies unchanged. `pull` (2.95, inception) is
  excluded on purpose and must not be added for symmetry: it carries a human
  shortlist gate upstream of construction, so on a rails-free scope it would
  fire *before* the session opens, turning "start working" into a hub search.
  Pulling stays a `aidlc-akp-registry.ts` query away for whoever wants it.
  Unchanged for every other scope, and still `CONDITIONAL` — no hub URL in
  memory means both stages self-skip.
* **The G2 scope test is now per-stage, and still an equality.** The single
  `CORE_SCOPES` equality became an `EXPECTED_SCOPES` map keyed by slug, with a
  loud throw for an undeclared slug. Kept as equality rather than loosened to a
  superset check because scope membership is a pure transpose
  (`transposeScopeGrid`): a name added or dropped changes which workflows a
  stage silently appears in, with no error anywhere. `CONTRACT.md` G2 now
  separates "invocable from any scope" (the capability) from "which scopes it is
  on by default" (membership) — the change is a membership trade, not a G2
  exception.
* **vibe 0.3.1 — the prose that assumed close-out was the end is corrected.**
  "One stage" describes what the vibe plugin contributes, not a guarantee about
  the grid; the line that must hold is that *nothing gates the session itself*.
  The persona now runs `next` after its gate and reports what the engine
  actually returns instead of announcing the workflow complete, and states the
  honest limit when handed a stage led by another seat: entered from Kiro's
  agent picker there is no conductor to take the handoff, so use `/vibe` or
  `/aidlc --scope vibe` when you want it to happen by itself. No behavioural
  change to the stage — `plugins/vibe/tests/plugin.test.ts` PROPERTY 1 counts
  the plugin's own stage files, not grid rows, so it never guarded this.
* **`PLUGINS.md` gains the team-knowledge setup section it was missing** —
  composing alone does nothing until a `## Team Knowledge Repository` URL exists
  in a memory layer.

Verified: `package.ts --check` in sync; team-knowledge 110 pass, vibe 19 pass,
t188 plugin-compose 74 pass, 7 scope/version unit files 71 pass; `doctor` 45/45
on a live dogfood install with all four plugins enabled.

## 2026-08-09 (vibe plugin 0.3.0, core A16) — on upstream 2.5.59
**The vibe container now actually parks, and the engine no longer swallows
`--new-intent` against a parked workflow.** Both diagnosed live in one Kiro IDE
dogfood session (this repo, intent `260809-openwiki-plugin-eval`), where every
conversational turn paid a ~16 KB stage-rules re-delivery and the container's
own birth command was answered with `parked`.

* **vibe 0.3.0 — Step 1 parks instead of granting autonomy.** The stage's
  premise ("autonomy is the Stop hook's first carve-out") was wrong: autonomy is
  the *gate-floor* hook's carve-out, and for the Stop hook it raises the block
  cap 2→8 and hard-disables the conversational carve-out — the grant was the one
  thing keeping the per-turn nudge loop alive. A parked container is what the
  Stop hook actually releases (`parked` is its terminal allow), and "parked
  container" was this scope's own description all along. Verified against the
  real tools: fresh vibe workflows park cleanly (no human-turn dance — the 0.2.6
  refusal documentation is obsolete for Step 1), `surface`/`persist` work while
  parked, and close-out unparks before opening the gate (a new Step 5 item —
  skipping it leaves a workflow that answers `parked` instead of `done`
  forever). PROPERTY 3 in the plugin tests is now behavioural (spawns the whole
  lifecycle in a composed throwaway project), not a substring check. Drops the
  A10 install dependency; INSTALL.md tables updated.
* **core A16 — Branch 2.5 (parked) now self-disables for `--new-intent`,** like
  `--resume`/`--stage`/`--phase`/`--review`. Without it a parked active intent
  swallowed the birth of a sibling intent — deterministically hit by vibe's
  documented "open a second container" route, and a prerequisite for 0.3.0
  (every vibe container is now parked). One condition + one t114 regression
  test; recorded as divergence A16, upstream-bound.

## 2026-08-09 (vibe plugin 0.2.6) — on upstream 2.5.59
**Opening a fresh vibe container tripped the human-presence guard twice, and the
stage invited a 105 KB protocol read it never uses.** Both observed dogfooding
the plugin on Kiro IDE (agentic-power-trading, intent `260809-mock-dataset`).

* **Expected `set-autonomy` refusal is now documented in the stage and the
  persona.** The `/aidlc … --scope vibe` message fires `record-human-turn`
  *before* the new intent's audit ledger exists, so when Step 1 runs
  `set-autonomy --mode autonomous` in the same turn, `humanActedSinceGate` finds
  zero `HUMAN_TURN` rows and refuses — deterministically, on every fresh
  container. The observed session burned two `ERROR_LOGGED` round-trips (the
  second retry inside the same turn, against the agent's own parked note) and
  ran 17 minutes un-granted. The stage now says: expect one refusal, do not
  retry in-turn, re-run first thing after the user's next message. A core fix
  (counting the `WORKFLOW_STARTED` Request row as human presence, or minting
  `HUMAN_TURN` at intent birth from the initiating prompt) would remove the seam
  for all scopes and is offerable upstream; per the divergence policy the fork
  carries only the plugin-side prose.
* **Token: the stage no longer invites a full `stage-protocol.md` load.** The
  old first line ("MANDATORY: Follow stage-protocol.md…") pointed at a ~105 KB
  (~26k-token) file for a stage whose whole protocol surface is one close-out
  gate — and Steps 5–6 already inline every command and format that gate needs.
  The line now scopes the mandate to the close-out gate and explicitly forbids
  loading the full protocol during free-form work.
* **Diary timestamps must be real.** The dogfood diary carried fabricated
  `T00:00:00Z` timestamps; Step 2 now says to read the clock
  (`date -u +%Y-%m-%dT%H:%M:%SZ`), since harvest and audit order entries by it.

## 2026-08-06 (core fix, upstream-bound) — on upstream 2.5.33
**Load-steering continuations could not be followed on a harness that truncates
hook output, which made the Stop hook nag forever.** The continuation inlined the
whole rules bundle into its message and put the `continue` token *after* it —
16,583 chars across 37 entries on a stock install. Kiro IDE truncates hook output,
so every delivery ended mid-payload and the token never arrived.
Without the token the chain cannot advance, and the obvious recovery is a trap:
the chain's position lives in the token rather than in state, so calling `next`
again returns the head of the chain with the same token. Observed while dogfooding:
**seven identical deliveries in one session, zero progress**, each one spending the
full payload of context. Draining it took reading the token out of `next`'s JSON
and calling `continue` by hand.
Fixed by ordering: the token and its command lead, the payload follows. Truncated
rule text is recoverable — the method files are on disk and already ambient through
each harness's always-on include — whereas a truncated token is not. Recorded as
divergence row **A11**, offerable upstream as-is.
* **A failure that presents as "nothing to do" is worse than a crash.** Every
  delivery looked benign — a wall of rules already present on disk — so the
  reasonable conclusion each time was "already applied, continue". The reader was
  reasoning correctly about the wrong question, because the question (*echo this
  token back*) had been truncated away. The general rule: in any channel that can
  truncate, the actionable instruction precedes bulk context.
* The t121 assertion added with it pins index-of-token < index-of-payload, and was
  verified failing on the pre-fix order (316 vs 144) before being kept — after an
  earlier guard in this same session passed vacuously and had to be re-verified.

## 2026-08-06 (vibe 0.2.4) — on upstream 2.5.33
**Customer-facing install docs for the plugin, `INSTALL.md` + `INSTALL.zh-CN.md`,
because the one thing a recipient most needs to know was only recorded where they
would never look.** The plugin depends on three fixes that live in this fork's
`core/`, not in the plugin — and with stock upstream it does not degrade gracefully,
it fails at the stage's first step. That warning existed only in
`docs/fork/divergence.md` and this changelog.
The docs lead with that dependency and state what breaks without each fix (A10: step
1 hard-errors and the Stop hook then nudges the parked container every turn; A11: the
`continue` token is truncated away so the steering chain can never advance; A13: a
second sediment can silently discard an approved rule). Practical conclusion stated
plainly: **ship the fork, not the plugin alone.**
They also carry the operational knowledge this session paid for, which is otherwise
scattered: `plugins/vibe/` is source and `dist/plugins/vibe/<harness>/` is what
installs; framework-before-plugin ordering fails *silently*; `select-plugins` is
absolute rather than additive, and omitting a plugin leaves the files installed but
the stage filtered out; compose is no-clobber so an update needs the installed copies
deleted first, and the drop's own remediation text misdiagnoses that case; Kiro reads
agent configs at session start; the `/bin/sh` PATH trap and its one-line fix; and
that nothing under `aidlc/` is touched by install or uninstall.
Pointers added from both plugin READMEs and the `PLUGINS.md` table, since a document
nobody is routed to is the same as no document.

## 2026-08-06 (three core/harness fixes, all upstream-bound) — on upstream 2.5.33
Three defects the vibe dogfood surfaced, none of them vibe-specific. Divergence
rows **A12**, **A13**, **A14**.
**`aidlc-block` fired on every tool call (A12).** Registered as `PreToolUse` with no
matcher, so it ran on every read and every grep at ~80ms of bun startup each — to
reach a carve-out that returns 0 immediately under autonomous Construction or with
no gate open, which is the whole duration of a `vibe` session. Now matched on
`fs_write|str_replace|fs_append|execute_bash`, the same mutation surface the other
two Kiro hooks already use. A human-presence floor has no reason to gate a read.
**`persist` keyed learning identity on `candidate_id`, losing approved rules
silently (A13).** `surface` candidate IDs are positional, so a second persist in one
stage routinely reuses an id for different content. Measured: **7 rules written,
`rule_learned: 4` returned**, leaving 12 rules on disk with 9 audit rows — and where
a reused id targeted the same method file, the rule was **dropped entirely while the
tool reported success**. Identity is now a hash of destination + exact text,
*appended* to the historical marker so all 16 existing assertions keep passing, with
a `Content-Key` field joining `Candidate-ID` in the audit row. Two tests added;
verified failing on the old logic first.
**bun was unresolvable in `/bin/sh` hooks, and doctor could not see it (A14).** Every
entry point is a bare `bun` spawned through `/bin/sh`, which reads no rc file — not
`~/.zshrc`, not `~/.zshenv` (zsh-only) — so a GUI-launched IDE hands it launchd's
PATH, which excludes `~/.bun/bin`. Every hook then dies with 127 and records **no
drop**, because the hook never ran: the health files look clean while nothing fires.
Doctor's existing `bun installed` row is true by construction — it runs inside a
process bun already launched. The new row checks bun on a standard system path, and
the README gains the troubleshooting case its existing `~/.zshenv` row does not
cover (measured: that export was already present and did not help).
* **`team.md` is now tracked.** The six team-tier rules this session produced are
  generalisations meant for other projects, and under the local dogfood exclude they
  existed only on one machine. Force-added; `project.md`, the session diary and the
  audit stay excluded, which is the right line between general and local.
* Three wrong diagnoses preceded A14 — launchd's PATH, a `/usr/local/bin` symlink
  that worked by accident, and the README's `~/.zshenv` row. Each was tested in an
  environment that was not the failing one. A stripped-*looking* shell is not the
  shell the hook gets.

## 2026-08-06 (vibe 0.2.3) — on upstream 2.5.33
**The real defect: a same-stem `.json` beside the persona `.md` is silently inert,
so three consecutive fixes to it changed nothing.** Kiro reads both formats out of
`agents/` as agent configs, and when they share a stem the `.md` wins. The `.md`
had no `tools` key, so the seat had no tools — and every edit to
`aidlc-vibe.json` (0.x names → key omitted → `["*"]`) was made to a file that was
never read. Its `resources` never applied either.
Fixed by putting the whole configuration in the `.md` frontmatter — `tools: ["*"]`
plus `resources` for the knowledge seat and the memory files — and **deleting the
`.json`**. One file, one picker entry, nothing to shadow it.
* **Three wrong fixes, one diagnostic error.** Each round changed the value and
  re-tested; the value was never the variable. Three different inputs producing an
  identical result was the signal that the input wasn't reaching the system, and it
  took until the third repeat to read it that way. When a change provably lands on
  disk and the behaviour does not move, stop refining the change and prove the
  system is reading that file.
* **The claim that `resources` guaranteed the read path was false on IDE.** It was
  stated repeatedly here and is now corrected: memory reaches the model through the
  harness's always-on steering include, which is why nothing appeared broken. The
  frontmatter `resources` now does pin the knowledge seat, which is *not* ambient.
* **The 14 core agents carry the same trap without suffering from it**: their `.md`
  holds the working `tools: ["read","write","shell"]` while their `.json` holds
  0.x names, `hooks`, and `resources` that never apply. Copying that pair is what
  produced this bug. The README now says so explicitly.
* The previous test asserted `tools` on the JSON and passed — a guard written from
  the same wrong model as the code, reading the same ignored file. It now asserts
  the frontmatter and that `agents/` contains exactly one file.

## 2026-08-06 (vibe 0.2.2) — on upstream 2.5.33
**The 0.2.1 fix was wrong in the other direction: omitting `tools` does not inherit
the default agent's capability, it yields an agent with almost nothing.** Both
shapes were measured in a real Kiro IDE session and both left the seat with **one**
tool, the skill loader:
| Declared | Result |
| --- | --- |
| `["fs_read","fs_write","execute_bash","thinking"]` (0.2.0) | one tool |
| key omitted entirely (0.2.1) | one tool |
Now `"tools": ["*"]`. That is the form meaning "everything", and it is what the
stock `developer` agent uses — 9 of the 40+ working agent configs on a real machine
declare exactly that, and none of them omit the key. It is also the only form that
does not pin a tool-name vocabulary that shifts between IDE versions:
`fs_read`/`fs_write`/`execute_bash` are the CLI 2.x / IDE 0.x names and do not
resolve on IDE 1.x, where the tags are `read`/`write`/`shell`.
* **The lesson is about evidence, not about tool names.** 0.2.0 shipped a
  restriction by copying the 14 core agents. 0.2.1 replaced it with a guess
  ("omitting means inherit") that read plausibly and was never tested against a
  live picker. 0.2.2 came from reading 40+ working configs on the machine where it
  failed. A config format's defaults are not derivable from its documentation when
  working examples are sitting on disk.
* **Same defect exists in all 14 core `aidlc-*-agent.json` files** — every one
  declares the 0.x names. They are built for dispatch rather than selection, and
  whether the dispatch path is affected has not been measured; but selecting one
  from the Kiro picker will not give a working seat. Not addressed here.
* The test now pins `["*"]` plus the absence of any allowlist or deny list. The
  previous assertion had pinned the *broken* shape — a test written from the same
  wrong assumption as the code it guarded, which is why it passed.

## 2026-08-06 (vibe 0.2.1) — on upstream 2.5.33
**The `aidlc-vibe` agent declared a `tools` list, which silently disarmed it.**
`tools` is a RESTRICTION, not a grant: declaring it replaces the default agent's
toolset with exactly that list, cutting off skills, MCP tools and everything else.
The config shipped with `["fs_read","fs_write","execute_bash","thinking"]` — the
CLI 2.x / IDE 0.x names — and two failures compounded, because those names do not
resolve on IDE 1.x either. Measured in a real Kiro IDE session: the agent came up
with **one** tool, the skill loader. It could load a manual into context and could
not execute a single step of it.
Fixed by removing every tool-restricting key. The agent now inherits the default
agent's capability and adds only what is additive: `prompt`, `resources`,
`description`, `welcomeMessage`. A test pins that `tools`, `allowedTools`,
`excludedTools`, `toolsSettings` and `permissions` are all absent, and that the
key set is exactly those five.
* **Guardrails belong in the harness's permission settings, not in one agent's
  config.** The removed block also carried `toolsSettings.execute_bash.deniedCommands`
  for `rm -r` and `git push` — deprecated shape on IDE 1.0, and on the evidence
  above there is no reason to believe it was in force. A deny rule that silently
  does nothing is worse than no deny rule, because it is cited as protection.
* **The 14 core agents are shaped for dispatch, and this is why that shape is
  wrong for a picker entry.** They declare narrow `tools` plus an
  `execute_bash.allowedCommands` allowlist limited to framework tools — correct for
  a delegated seat, and the reason selecting one from the picker yields an agent
  that can barely act. Copying that shape is what caused this bug.
* Propagation note, learned the hard way in the same session: fixing the source is
  not fixing an install. `dist/` needed a repackage and the installed copy had to
  be **deleted** before compose would replace it — a no-clobber compose silently
  keeps the old bytes and exits 0.

## 2026-08-06 (core fix, upstream-bound) — on upstream 2.5.33
**Freshly initialised workflows were missing `Construction Autonomy Mode`, which
made autonomous Construction unreachable on every scope.** The state-file
generator wrote `## Current Status` with five fields and omitted this one, while
`state-template.md` documents it as belonging to that section. Since
`aidlc-bolt.ts set-autonomy` writes the field with `setFieldStrict` — which
hard-fails when the field is absent — the documented command could not run on a
clean start:
```
bun .kiro/tools/aidlc-bolt.ts set-autonomy --mode autonomous
→ {"error":"State update failed: Field not found in state file: ..."}
```
Reproduced with `--scope feature` on a scratch install, so this was never
vibe-specific. Every consumer that reads the field (`aidlc-stop.ts`'s block cap,
`state.ts park`, the scope-change and recompose refusals) silently took its
not-autonomous branch. Fixed by emitting the field as `unset` at generation time;
recorded as divergence row **A10** and offerable upstream as-is.
Found by dogfooding: the framework was installed into its own repository and a
real `vibe` session opened, at which point the Stop hook nudged the container as
an abandoned workflow — exactly what the missing field was supposed to prevent.
Two things worth carrying forward, both in A10:
* **A guard whose name asserts an impossible precondition stops being read as a
  live constraint.** t33 already tested this hard-fail and labelled it the "v4
  state file" guard. The failure was not merely reachable, it was *tested* — under
  a name that said it could not happen to a current file.
* **Comparing a fixture to a template proves nothing about the generator.** Every
  existing check compared shipped fixtures to `state-template.md`, and those
  fixtures were written *from* the template. The generator was never compared to
  either. The new guard in `t12-state-fixture-validation.test.ts` closes that
  edge, stays static (reads both shipped files, spawns nothing), and was verified
  **failing before the fix and passing after** — a guard nobody has watched fail
  is not yet a guard.

## 2026-08-06 (vibe 0.2.0) — on upstream 2.5.33
**`vibe` is now selectable as an agent, not just invoked as a command.** In Kiro,
pick **`aidlc-vibe`** from the agent picker and start talking — the agent opens the
container on its first turn, so there is no command to remember. The scope commands
(`/vibe`, `/aidlc --scope vibe`) are unchanged and remain the entry on every other
harness. Two new files, both inside the plugin:
* **`agents/aidlc-vibe.md`** — the plugin's own persona, now the stage's
  `lead_agent` **and** the picker entry's prompt, so both entries behave
  identically. This replaces the borrowed `aidlc-developer-agent` seat, which fixes
  a second problem: the vibe-only sedimentation guide was sitting in that core
  agent's knowledge dir, where every developer-agent stage had to load it. Knowledge
  moved to `knowledge/aidlc-vibe/`, and the test now pins that this plugin ships
  exactly one seat and it is its own.
* **`agents/aidlc-vibe.json`** — the Kiro agent config. `resources` pins the memory
  layer, this seat's knowledge, `aidlc-shared`, and both runner skills into context
  at session start, so **the read path is guaranteed by the agent itself** rather
  than by an always-on steering include.
**Both files share the stem `aidlc-vibe` on purpose.** Kiro reads `.md` *and*
`.json` under `.kiro/agents/` as agent configs, so two different stems produce two
picker entries — and the `.md` one carries no `resources`, `tools`, or
`toolsSettings`, making the more discoverable entry the degraded one. Caught by
dogfooding: the entry actually selected in a real install was the persona, so that
session ran with neither the tool posture nor the pinned memory. Sharing a stem is
how the 14 core agents ship and collapses the pair to one name — which is also the
name originally asked for. A test pins the two stems equal.

Worth knowing about the install this exposed: **all 14 core agents ship as `.md` +
`.json` pairs, so 14 delegated personas are themselves picker entries.** That is
upstream's existing shape, not introduced here, and it is not addressed by this
change.

The agent is an *entry*, not a replacement for the stage: selecting it still opens
the container, because the learnings tool still refuses to write unless the
requested stage is the state file's `Current Stage`. What it removes is the command
and the feeling of starting a workflow.
Four decisions worth recording, each of which fails silently if edited away:
* **The JSON carries no `hooks` key, deliberately.** Kiro's own docs disagree on
  the blast radius — two pages say the IDE ignores the *field*, one says it ignores
  any *agent containing* it. Omitting it is the only shape that is safe under both
  readings, and the failure it avoids (the agent quietly missing from the picker)
  has no visible symptom. A test pins the absence. Related and unfixed: the 14 core
  `aidlc-*-agent.json` files all carry `"hooks": {}`, so that is the first thing to
  check if the core agents are missing from a picker.
* **`toolsSettings` is kept even though IDE 1.0 deprecates it** for shell/fs rules
  in favour of `permissions.rules`. Consistency with the 14 core agent files and
  0.x compatibility won; the README documents the 1.x migration.
* **The tool posture is wide on purpose.** `fs_write` and `execute_bash` are
  unrestricted, because the framework-tools-only allowlist the core agents use
  would make a free-form coding seat useless for its one purpose. Auto-approval
  stays narrow (`fs_read`, `thinking`) and `rm -r` / `git push` stay denied.
* **A disabled plugin leaves the picker entry behind.** Plugin `agents/` are copied
  regardless of the enabled-plugin selection while the stage is filtered out of the
  graph, so the prompt detects that the container cannot open and says so — instead
  of working for an hour and then finding nowhere to sediment.
Verified by composing into a scratch install: both agent files land in
`.kiro/agents/`, the compiled graph shows `vibe-session` with `lead_agent:
aidlc-vibe` (still `mode: inline`, still no consumes or requires_stage), every
`resources` entry resolves against the install except the space memory glob (which
`workspace-scaffold` creates on first run, exactly as the 14 core agent files
declare it), and compose records zero drops. All five harnesses carry both files;
Codex nests them under `plugins/aidlc-vibe/agents/`.

Because the stage stays `mode: inline`, none of this needs the Kiro dispatch
surface — a *dispatched* stage naming a plugin agent would additionally require
`trustedAgents` registration in the install's `aidlc.json`, which a no-clobber
compose hook cannot write, and compose would reject the stage outright without it.

## 2026-08-04 (new plugin: vibe 0.1.0) — on upstream 2.5.33

**A plugin for the opposite trade from `poc-accelerator`: free-form coding with no
workflow rails, that still sediments.** Installed as `aidlc-vibe`. One scope, one
stage, one knowledge file — no MCP, no sensors bound, no approval gate until you
close out.

```text
/vibe <what you are about to work on>
```

Then work normally; say **sediment** to harvest the session diary through the §13
admission gate (repeatable), **close** to end the container.

* **Why a stage at all rather than a steering file.** Reading memory was already
  free — every harness includes the `org → team → project → phase` chain in ambient
  context whether or not a workflow is running. Writing it *well* is the hard part:
  the learnings tool refuses unless the requested stage is the state file's
  `Current Stage`, and that refusal is what buys the conflict check against broader
  policy, idempotency, and a `RULE_LEARNED` audit row. A parked stage satisfies it;
  a steering file cannot. The stage exists to hold that one precondition, not to
  sequence anyone's work.
* **The container stays `in-progress` on purpose, and two hooks depend on it.**
  `aidlc-block` fires only while a gate is *open*, so with no open gate free-form
  tool use is not interfered with — which also means **native Kiro Spec can run
  inside the container** (it cannot be *governed* there: `PreTaskExec` exit 2
  confers no veto, measured in `docs/fork/kiro-spec-integration.md`). And step 1
  sets `Construction Autonomy Mode: autonomous`, the Stop hook's first carve-out,
  without which every turn ending mid-session would be nudged as an abandoned
  workflow. The plugin test pins both.
* **What it deliberately does not give.** No requirements, no reviewed design, no
  acceptance criteria — so nothing produced in a vibe session is evidence of
  correctness or completeness. The scope file and README say so in those words, and
  point at `feature`/`mvp`/`enterprise` for when that claim is needed.
* **Sensors: none bound.** The only artifact is a session log written once at
  close-out. The two code sensors are documented as a one-line opt-in with the
  condition attached — bind them only if the repo has that toolchain, because a
  sensor that cannot produce a finding is pure latency (measured: 11 s per write,
  50 times, zero findings, on a project with no eslint).
* Verified by composing into a scratch install: scope + stage + knowledge land, a
  scope runner and a stage runner are generated, the compiled graph shows
  `vibe-session` with no consumes and no requires_stage, the scope resolves to
  **4** executing stages (three initialization + the container), and compose records
  zero drops.

Naming note: the directory and manifest are `vibe`; the packager prefixes the host
plugin to `aidlc-vibe`. The internal name has to stay unprefixed — compose refuses
any scope or agent declaring `plugin: aidlc-*`, because a plugin-owned runner uses
the bare name and would collide with core's `aidlc-<name>` runner path.

## 2026-08-04 (ci) — on upstream 2.5.33

**`.gitlab-ci.yml` is deleted; every guard in this repo is now a human step.** The
file was added 2026-08-02, disabled a day later with a blanket
`workflow: rules: - when: never`, and is now gone. Nothing runs on a server for a
push or a merge request. `docs/fork/divergence.md` carries the replacement: the
three commands that are the merge gate, the weekly upstream-drift ritual that used
to be a scheduled job, and the one-line recovery if you want the pipeline back.

Two things worth knowing, both recorded in that chapter:

* **If a merge request will not merge, look at the merge checks.** With no pipeline
  created, a project with GitLab's **Pipelines must succeed** check enabled
  (Settings → Merge requests) blocks every MR forever, waiting on a success that
  cannot arrive. Turn CI off and that check off together.
* **The first CI attempt soured on a false red, not a real one.** Every job was
  gated to a merge-request event, `main`, a schedule, or a manual run, and the file
  had no top-level `workflow:` block — so a plain topic-branch push created a
  pipeline, found nothing to run, marked it failed, and mailed the project. The
  notification said `0 failed jobs`, which is the tell. `9b78ae27` fixed it
  properly; if the pipeline ever comes back, start from that commit's rule set.

## 2026-08-04 (plugin harness parity) — on upstream 2.5.33

**A plugin now composes identically on all five harnesses.** Composing
`poc-accelerator` into a scratch install of each and counting what landed showed
two of them silently degraded — every file present, but a missing entry point on
one and no orchestrator tables on another, with nothing failing to say so. All
three fixes are general, not CDE-specific: see `docs/fork/divergence.md` A9.

* **Codex had no stage runners.** Compose probes `<harness-dir>/skills` to decide
  whether to regenerate runners, but Codex discovers skills at
  `<project>/.agents/skills/` and ships nothing under `.codex/skills/`. Every stage,
  scope and sensor composed correctly and the orchestrator tables refreshed — but
  **runners=0**, so the plugin's stages had no `/…` entry point, and the only trace
  was an advisory drop. The probe now mirrors `resolveSkillsPath`, which is what
  `aidlc-runner-gen` writes through. Codex: **0 → 9 runners**.
* **opencode refreshed neither the scope grid nor the stage graph.** Its authored
  `SKILL.md` had an **em dash** where the shared sentinel literal has a hyphen, and
  no stage-graph marker pair at all. That broke the splice for plugins *and* for the
  framework's own `aidlc-utility.ts scope-table` / `stage-table` — both now work on
  opencode, verified before and after against a real install.
* **Kiro plugin auto-compose was a promise the modern IDE could not keep.** The
  emitter shipped only the legacy `.kiro.hook` compose hook, inert on Kiro IDE
  ≥ 1.0.1xx. It now emits a v2 `aidlc-plugin-compose.json` (`SessionStart`)
  alongside it, the same coexistence the framework's own Kiro tree uses. The
  supported Kiro path is still the explicit compose command — now documented as
  such in the plugin README instead of implied.
* **`poc-accelerator` 0.23.1 (docs only):** the plugin's MCP knowledge gained the
  **opencode** row it never had — `mcp` key in `opencode.json`, `type` per server,
  `command` and `args` collapsed into one array, `env` renamed `environment` — plus
  a worked translation of the Global example. Both READMEs and `PLUGINS.md` now
  state the five-harness support explicitly, with the opencode install path and the
  Kiro no-auto-compose note.

After: all five harnesses identical — 8 stages, 1 scope, 2 sensors, 9 runners,
scope row + 8 stage rows in the orchestrator table, **zero compose drops**.

## 2026-08-04 (sensor cost + hook overhead) — on upstream 2.5.33

**A real eight-step PoC run spent 16 minutes of measured wall-clock inside two
sensors, and 9 of those minutes discovering the same thing 50 times.** The run's
own audit is the evidence: 870 events, 314 sensor fires, 98.9% of sensor time in
`linter` + `type-check`, both firing on just 5 distinct files. Everything below
follows from that measurement. Nothing is CDE-specific, so all of it is
upstream-bound — see `docs/fork/divergence.md` A7 and A8.

* **The toolchain probe is no longer re-paid per fire.** Every one of the 50
  `linter` fires ended `Note: tool-unavailable` after ~11 s, because the project
  has no eslint and `bunx eslint@10` went to the registry each time. The sensor
  now answers the no-config case from the filesystem before spawning anything
  (measured **8.4 s → 0.044 s** on that project's own file) and memoizes the
  availability probe per anchor dir, invalidated by a TTL *and* a
  dependency-manifest fingerprint so installing the tool is seen on the next fire.
  `type-check`'s `tsc --version` probe is memoized the same way.
* **New optional manifest field `coalesce_seconds`, set to 120 on both code
  sensors.** A repeat fire for the same (stage, sensor) pair inside the window is
  deferred instead of re-running the whole-project toolchain. Deferral, not
  dismissal: a fire after a FAILED one is never coalesced, the skip is counted in
  a coalesce ledger with the newest unseen output, **`aidlc-sensor flush
  [--stage <slug>]`** re-fires everything outstanding, and `--doctor` reports it
  under **Deferred sensor fires**. With the field absent, behaviour is unchanged.
* **The audit hot path reads a bounded tail.** `aidlc-sync-statusline` runs on
  every `execute_bash` and needs only the latest `STAGE_STARTED`; it was reading
  the entire trail, 276 KB by the end of that run. Now a 64 KB tail aligned to a
  block boundary, with a full-read fallback when the window holds no
  `STAGE_STARTED`. Same answer, verified against the real trail.
* **Kiro IDE ships one `PostToolUse(execute_bash)` hook instead of two.**
  `aidlc-runtime-compile` and `aidlc-sync-statusline` shared that matcher and are
  both payload-independent on the IDE, so each shell command paid two `bun`
  startups for nothing. The new `aidlc-shell-post` registration runs both core
  hooks in one process. **Upgrade note:** copying the tree over an existing
  install merges rather than prunes, so delete your old
  `aidlc-runtime-compile.json` and `aidlc-sync-statusline.json` — otherwise both
  fire alongside the merged hook and the two hooks run twice per shell command.
  `--doctor` reports the overlap under **Superseded hook registrations**.
* **Failed writes no longer look like lost data.** The Kiro adapter recorded a
  hook drop whenever it could not extract a path from a write's tool result — but
  7 of 7 drops in the measured run were permission denials and `str_replace`
  misses, i.e. writes that never happened. Those are now debug-level. An
  unrecognised wording still records a drop, because an unknown *success* wording
  is the decay the drop file exists to catch.
* **`poc-accelerator` 0.23.0: `linter` unbound from steps 4 and 5.** It wraps
  eslint only, so on a PoC whose application code is Python it fired 50 times for
  zero findings. Those stages now run the repo's own linter as part of an explicit
  pre-gate verification step (which also calls `aidlc-sensor flush`), and
  `type-check` stays bound for the CDK. A JS/TS-only PoC can add `linter` back to
  the stage's `sensors:` list.

## 2026-08-03 (poc-accelerator 0.22.0) — on upstream 2.5.33

**The PoC flow's team-knowledge loop is now mandatory at both ends, and the two
ends are independent.** A full run surfaced the hole: skip the team knowledge
repository at step 1 and step 8 never mentions knowledge again, so the
engagement's harvest quietly died inside the workflow record. Reading and
depositing are now separate obligations — neither is conditional on the other,
and neither has a skip path.

* **Step 1 requires the repository's git URL.** The `skipped-by-user`
  resolution is gone; the resolutions are now `pack-imported` and
  `no-pack-match`. The URL is resolved from the `## Team Knowledge Repository`
  section of `org.md` / `team.md` / `project.md`, or asked for as a required
  question, then probed read-only with `git ls-remote --heads`. A bare local
  path is rejected — a checkout can be searched, but only a remote can be
  pushed to. The confirmed URL is registered in `project.md` so later stages
  and later runs inherit it.
* **Step 8 always deposits, and resolves the URL itself.** New sub-step 5
  produces `poc-accelerator-team-knowledge-deposit.md`: resolve the URL
  (preflight artifact → memory layers → ask), probe it, assemble the harvest
  under the conservation laws, get a **named** sanitization approver, then
  branch + commit + merge request through the repository's own contribution
  process. When the push is refused, the deposit is not dropped — the patch is
  written into the record with the owner who will land it and the blocking
  reason. The step's remaining sub-steps shifted to 6/7/8.
* **A second deterministic sensor closes the loop.**
  `poc-accelerator-team-knowledge-deposit` (advisory, like every framework
  sensor) checks the fenced `deposit:` block: git-remote URL shape, probe
  recorded as `git-ls-remote-ok`, a non-empty entry list, a named approver, and
  the fields each outcome requires. It never reads the preflight record — that
  independence is the point. The existing preflight sensor gained the same
  URL-shape and probe checks and lost the skip branch.

Upgrade note: an in-flight PoC that already wrote a preflight artifact with
`resolution: skipped-by-user` will now report `SENSOR_FAILED` on rewrite. Add
the repository's git URL and re-run the preflight — or leave the old artifact
alone and let step 8 resolve the URL, which it does regardless.

## 2026-08-03 (docs) — on upstream 2.5.33

**Fork-authored documentation moved out of upstream's chapter numbering into
[`docs/fork/`](docs/fork/README.md).** `docs/reference/19-kiro-spec-integration.md`
and `docs/reference/20-fork-divergence.md` sat in a namespace upstream is still
filling — their numbered chapters run 00–18 and climb — so the day upstream adds
its own `19-*.md` the merge is an add/add conflict over a filename. New paths:

* `docs/fork/divergence.md` (was `20-fork-divergence.md`)
* `docs/fork/kiro-spec-integration.md` (was `19-kiro-spec-integration.md`)
* `docs/fork/research/2026-07-31-kiro-spec-hook-probe.md`
* `docs/fork/README.md` — new index

The two index rows in `docs/reference/00-overview.md` are gone with them, so that
file is byte-identical to upstream again. Nothing here is on the docs site's nav,
because the nav lives in upstream's `zensical.toml`; that is the deliberate trade.

Also recorded in `divergence.md` §2: **14 files of real divergence that no row
explained**, found by running the §5 derivation — the Codex marketplace layout
(the fork's first edits to `scripts/` and `tests/`), the hook-registration doctor
block in `core/tools/aidlc-utility.ts`, and the `poc-accelerator` documentation
living inside two upstream guide files. Listed, not yet classified.

## 2026-08-02 (doctor) — on upstream 2.5.33

**`--doctor` now tells you when your Kiro IDE hook layer is dead.** It used to
check only that the hook `.ts` bodies existed, never that the IDE was wired to run
any of them — which is why this fork shipped an inert hook layer for months while
`--doctor` stayed green. Three new rows on a Kiro IDE install:

* **Hook registration** — fails if `.kiro/hooks/` has legacy `*.kiro.hook` files
  but no v2 `*.json`. That combination fires nothing on Kiro IDE ≥ 1.0.1xx: no
  audit rows, no sensor dispatch, no human-presence mint, no approval-gate block.
* **Hook commands** — fails if a registered hook's script is missing from disk. A
  registered-but-broken hook is invisible in the IDE's panel.
* **Legacy files advisory** — when both generations are present (the shipped
  default), says so, and warns **not** to use the IDE's "Migrate legacy hooks"
  button: it would duplicate hooks this install already registers.

Kiro CLI shares the `.kiro` directory but wires hooks through `agents/aidlc.json`
and ships no registration files, so none of these rows appear for it.

Submitted upstream — the gap is general, not CDE-specific.

## 2026-08-02 (latest) — on upstream 2.5.33

**Plugin documentation moved out of `README.md` into a new [`PLUGINS.md`](PLUGINS.md).**
The plugin table, the chat-window install, the four-step manual install for every
harness, and the per-plugin setup notes all live there now; `README.md` keeps a
short pointer. Nothing was dropped — if you had bookmarked the README's plugin
section, it is all in `PLUGINS.md`.

**The README was also rebuilt from upstream's, which repaired damage you could
see.** The fork's copy had lost all **5** collapsible `<details>` harness install
sections (so every harness's install steps were permanently expanded), **16**
markdown links, and had all 8 GitHub alert blocks collapsed onto one line so they
rendered as plain blockquotes instead of coloured callouts. Restored.

Two live bugs fixed in `README.zh-CN.md` while doing it:

* It still told you to install bun with `curl -fsSL https://bun.sh/install | bash`
  — the earlier sweep had missed this file. Now `brew install bun` /
  `npm install -g bun`.
* The plugin-install line pointed at `github.com/comdaze/aidlc-workflows`, which
  **stopped resolving to this repository** when a fork of upstream was created
  under that exact name. Corrected to `aidlc-workflows-cde`.

## 2026-08-02 (later) — on upstream 2.5.33

**Installing `bun` and `uv` no longer requires piping a network script into a
shell, anywhere in the docs.** The fork's internal policy said this already, but
it was only ever applied in 5 files — `README.md`, `harness/opencode/`, both
harness guides, and four guide/reference chapters still told you to run
`curl … | bash`. Now all 13 sites use a package manager:

| Tool | Documented now |
| --- | --- |
| `bun` | `brew install bun` / `npm install -g bun` |
| `uv` / `uvx` | `brew install uv` / `pipx install uv` |

Each site links the vendor's installation guide for the other methods. Commands
were verified against the Homebrew API: formula `bun` is in homebrew-core at
1.3.14, which is the version this repo pins for CI. Note `brew install bun` is the
homebrew-core spelling — earlier fork text used the older `oven-sh/bun/bun` tap
form.

**Claude Code's own installer is deliberately unchanged.** Anthropic documents the
native installer as the recommended path and has deprecated npm installation of
Claude Code, so replacing it would push you onto a deprecated method for a tool
this project does not own.

Two sentences that went stale with the change were also fixed: the README no
longer tells you to choose between PowerShell and CMD blocks that no longer exist,
and the PATH tip no longer blames "the bun installer" for writing to `~/.zshrc`
when a package manager is now the documented path.

Submitted upstream as
[awslabs/aidlc-workflows#701](https://github.com/awslabs/aidlc-workflows/pull/701),
with the fork's text made **byte-identical to the PR** — so if it merges, this
divergence disappears on the next sync with no follow-up edit.

## 2026-08-02 — on upstream 2.5.33

**Removed the Kiro IDE gate-render floor.** It returned `{"decision":"block"}`
from the `stop` adapter path to force a re-render when a turn parked at an
approval gate or question batch whose options had never appeared in chat. On any
IDE ≥1.0 it was already doing nothing — the v2 `Stop` trigger cannot block — so
for current builds this changes no behaviour. **If you are on a pre-1.0 Kiro IDE,
you lose the hard block**; the protocol rule it enforced is retained as guidance
in `question-rendering.md`, and the conductor is now solely responsible for
honouring it.

It was deleted rather than migrated because the check is not expressible on a
trigger that can block: "did this turn end with an unrendered gate?" is only
answerable at end-of-turn, and `PreToolUse` fires too early while
`UserPromptSubmit` fires after the user has already replied to something they
could not see. Hard enforcement would need a redesign, and belongs upstream as a
designed feature rather than a fork patch in the enforcement spine. Reasoning and
the full cost accounting are in `docs/fork/divergence.md` B1.

Also: added `.gitlab-ci.yml`. The repo had no CI — the inherited
`.github/workflows/ci.yml` is GitHub-only and does nothing here, so every guard
ran only when someone remembered to run it locally. Wiring it up immediately
caught two already-landed defects: 15 collapsed GitHub alert blocks across the
READMEs and one reference doc, and a 16-entry deletion from `CHANGELOG.md` caused
by resolving that file with `git checkout --theirs` during the 2.5.33 merge. Both
are fixed. A scheduled `upstream-drift` job now reports pending upstream commits
and the real conflict surface.

## 2026-08-01 — on upstream 2.5.33

Adopted the frozen-version policy described above. `core/tools/aidlc-version.ts`,
`CHANGELOG.md`, and the README badge are now upstream's verbatim and the fork
does not bump them; this file takes over the fork's release notes. The
`2.5.31` heading the fork published on 2026-07-31 is superseded by the entry
below, because upstream independently shipped its own `2.5.31` and
`tests/unit/t68-version-changelog-sync.test.ts` rejects duplicate headings.

Absorbed upstream 2.5.31 through 2.5.33: sensor output parsing now tolerates
leading stdout noise from a sibling repo's package manager, `--doctor` warns
when a plugin ships an undiscoverable sensor manifest, and stage rules are
delivered deterministically as bounded `load-steering` directives with reviewer
checklists absorbed into reviewer agent bodies at build time.

**Upgrade:** re-copy your `dist/<harness>/` shell into the project, then re-run
`plugin sync` (or start a session and let the compose hook run) so plugin
contributions re-merge.

## 2026-07-31 — on upstream 2.5.30

Merged upstream v2 through 2.5.30 into this fork, which had been sitting on a
2.5.7 base. **The headline is a defect this fixes, not a feature: on Kiro IDE
≥ 1.0.1xx the fork's entire hooks layer was silently inert.** Kiro IDE stopped
executing the legacy `.kiro.hook` format, and this fork shipped only that
format — so audit emission, sensor dispatch, human-presence mint, the pre-tool
approval-gate block, and runtime-graph compile were all registered and none of
them ran. Upstream fixed this in 2.5.4 by shipping the v2 hook JSON schema
alongside legacy for coexistence; that fix is now in. Verify with `--doctor`
and confirm `.kiro/hooks/` contains `aidlc-*.json` files, not only
`.kiro.hook`.

* Also arriving from upstream: bundle-aware default-scope resolution for
  plugin-only installs, the ARS deterministic subcommand, hardened Kiro
  `execute_bash` permission lists, the 1.x stdin hook context channel, a v2 PR
  gate in CI, and `.gitattributes` pinning LF so Windows checkouts pass the
  drift guard.
* The Codex CLI floor moves to **≥ 0.145.0** (upstream): earlier releases defer
  compact-source `SessionStart` after a mid-turn auto-compaction, so a
  continuation can run without the restored workflow mission. `--doctor`
  enforces the pin.
* **The fork's Kiro IDE gate-render floor (previously released here as
  2.5.8/2.5.9) is inert on IDE 1.x and is not being re-announced.** It works by
  returning `{"decision":"block"}` from the Stop hook, and on the v2 schema the
  IDE's `Stop` trigger cannot block — upstream's own hook registration
  documents it as advisory-only. The code is retained but does nothing on a 1.x
  IDE; it needs re-implementing on a trigger that can genuinely block
  (`PreToolUse` and `UserPromptSubmit` can) or removing. Tracked as B1 in
  `docs/fork/divergence.md`.
