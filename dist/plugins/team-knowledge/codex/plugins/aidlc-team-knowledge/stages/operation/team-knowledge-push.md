---
slug: team-knowledge-push
number: 4.95
name: Team Knowledge Push
plugin: team-knowledge
phase: operation
execution: CONDITIONAL
condition: Runs at close-out when the workflow produced team-level learnings or confirmed domain knowledge and a team knowledge hub is reachable. Skipped only when the human declines to name a hub, or affirms there is nothing that has passed the learning ritual yet — never skipped because pushing was inconvenient.
lead_agent: aidlc-developer-agent
support_agents: []
mode: inline
produces:
  - team-knowledge-push-deposit
consumes:
  - artifact: team-knowledge-pull-preflight
    required: false
requires_stage: []
sensors:
  - required-sections
  - akp-push
scopes:
  - bugfix
  - enterprise
  - feature
  - infra
  - mvp
  - poc
  - refactor
  - security-patch
  - workshop
inputs: The active space's team.md (rules that already passed the learning ritual, with their RULE_LEARNED audit rows), the space knowledge seats, the pull artifact when this run produced one, and the team knowledge hub's git URL
outputs: team-knowledge-push-deposit.md and the authored OKF cards (under this stage's record dir, engine-resolved); the cards are submitted to the hub as a branch plus merge request
---

# Team Knowledge Push

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

This stage sediments what *this* workflow learned into the shared hub, as OKF
v0.2 cards. It is the producing half of `team-knowledge-pull` and independent of
it: a workflow that imported nothing still owes the team what it learned.

Three constraints decide the whole design, and none of them is negotiable here:

- **A bot may open a merge request. A bot may never merge one.** Merging is
  granting authority, and authority is granted by a human (§8.4).
- **Structure keeps personal content out, not vigilance.** `project.md` rules and
  stage journals are not on the candidate list at all (§5.2). Deny patterns are a
  machine backstop; the real gate is a named human's sanitization approval.
- **The same validator that gates the hub MR runs here first.** Something that
  cannot pass the gate should never reach a reviewer's queue (§8.3).

Load `knowledge/aidlc-akp/card-authoring.md` before writing a card and
`knowledge/aidlc-akp/hub-operations.md` before touching the repository.

## Steps

### Step 1: Resolve and Probe the Hub

Resolve the URL in this order:

1. `team-knowledge-pull-preflight.md`, when this run produced one.
2. `## Team Knowledge Repository` in `aidlc/spaces/<space>/memory/org.md`,
   `team.md`, or `project.md`.
3. Otherwise ask this required question: **provide the team knowledge hub's git
   URL**. A bare local path is not an answer — the harvest has to be pushed
   somewhere others read. Do not take credentials from files or chat history; use
   the ambient git credential helper or SSH agent.

Probe it read-only before writing anything: `git ls-remote --heads <url>`. A
failed probe is re-asked, never recorded as done. Register the confirmed URL in
`aidlc/spaces/<space>/memory/project.md` if no layer carries it yet.

### Step 2: Assemble the Candidate List — Note What Is Structurally Absent

Read `aidlc/spaces/<space>/memory/team.md` and the space knowledge seats. The
candidate surface is exactly:

| Source | Admitted when | Default |
|---|---|---|
| `team.md` rules | already passed the learning ritual (a `cid` marker plus a `RULE_LEARNED` audit row) and the hub has no card with the same rule text | candidate |
| space `knowledge/` prose | it satisfies the five preservation rules below | candidate |
| a `.ai-ready/` industry pack | exported whole, with its provenance and sign-off record | candidate, per pack |
| `project.md` rules | **only** after a human explicitly re-grades one to team level at this gate | excluded |
| stage `memory.md` journals | — | never |
| audit / state / sensor evidence | — | never |

The exclusions are the point: personalized content is not "rejected in review",
it is never listed. Say what you excluded and why, so the human can override
deliberately rather than discover the omission later.

The five preservation rules — anything leaving the project must be **confirmed**
(an unverified hypothesis stays in the journal), **sanitized**, **graded for
generalization**, **dated**, and, for a technical assertion, **carrying the
evidence that proved it**. That last one matters most: a wrong technical claim in
the hub gets reused, and reuse is invisible.

Cross-check each `team.md` candidate against the hub before proposing it:

```bash
bun {{HARNESS_DIR}}/tools/aidlc-akp-registry.ts --bundle <hub> --json --query "<rule keyword>"
```

Be honest about the limit here. The `RULE_LEARNED` Content-Key hashes the *scope*
into the digest, so a key computed locally will not match the key a card recorded
in another project (§10.2) — the key is a trace anchor, not a cross-project
dedupe key. The validator catches only *exact* duplicates of the `# 规则` text
(§13.1). Two teams phrasing one lesson differently is caught by CODEOWNERS
review, or not at all. Do not present the machine check as sufficient.

### Step 3: Per-Entry Approval and a Named Sanitization Approver

Present the candidate list one entry at a time with its proposed class
(`knows` / `judges`), generalization grade, destination, and evidence. Nothing
leaves the workspace without approval.

Then ask a named human — the data owner or customer contact where one applies —
to approve **what leaves the delivery site**, and record them by name. This is a
separate judgement from "is this true", which is why it lives in
`cde.sanitization` and not in `verified` (§4.6): merged into one field, one of
the two would quietly disappear.

If a `project.md` rule is being re-graded to team level, capture that decision
and the approver here; the deposit record reports both.

### Step 4: Author the Cards — One Card, One File

Write each entry into this stage's record dir under its hub-relative path:
`practices/<topic>/<slug>.md`, `knowledge/domains/<domain>/<slug>.md`,
`knowledge/aws/<slug>.md`, `knowledge/engineering/<slug>.md`, or
`packs/<pack>/pack.md`. One card per file, always — a shared file would make two
projects depositing in the same week conflict, which is exactly what NFR-1
forbids, and it is what makes a lifecycle move a single-file `git mv` and a trace
a single-file `git blame`.

Frontmatter, in this fixed key order (§6.4 — a wobbling order turns a one-line
`verified` append into a whole-block diff):

```
type, title, description, tags, status,
generated, verified, stale_after, sources, cde
```

The clock is mechanical, not a matter of taste:
`stale_after = max(verified[].at) + half_life(type/topic)` from
`policy/lifecycle.json`, or `cde.review_interval_days` when the card explains why
it differs. The validator recomputes it with **zero** days of tolerance, so a
hand-typed far-future date is rejected rather than believed.

`cde.origin.content_key` is the Content-Key from the rule's `RULE_LEARNED` audit
row, and `cde.origin.content_key_scope` is the scope that key was computed under.
Recording the scope is not bookkeeping: the key is `sha256(scope + "\0" + text)`,
so without its scope the key cannot be matched back to the audit row it came
from.

Write the `# 规则` section first and keep it self-contained — it is the text the
importing project persists into `team.md` and the only range the dedupe digest
covers. Put the cost, the tradeoff, and what was given up under `# 为什么`; a
rule that travels without its price gets applied where it does not belong.
Attribute every claim with a `[^id]` footnote matching a `sources[].id`.

### Step 5: Validate Locally, Fail Closed

```bash
bun {{HARNESS_DIR}}/tools/aidlc-akp-validate.ts --bundle <staging> --mode produce
```

Produce mode rejects on **both** verdict classes. Fix and re-run until clean; do
not push a card the gate would reject, and do not "explain it in the MR
description" instead. If the validator's complaint looks wrong, that is a finding
about the validator or the policy — raise it as such, in its own change, rather
than routing around it.

### Step 6: Submit Through the Repository's Own Process

Fetch into a scratch checkout, then:

1. Branch: `knowledge/<yyyy-mm-dd>-<topic-slug>`.
2. Copy the cards to their paths, plus `akp-feedback.json` from a pull run in
   this workflow to `feedback/<project>/<date>.json`.
3. One purposeful commit.
4. Push the branch and open the merge request. Never commit to the default
   branch, never force-push, never commit credentials — the framework's git
   safety line applies to the team repository exactly as to the customer's.

A **correction** is one MR, not two: the new card, the old card flipped to
`status: deprecated` with a markdown link to its successor, and
`cde.supersedes` on the new card. Split across two MRs, the tree spends time
holding a card that is superseded and still marked `stable` — and something will
read it in that window. The validator rejects the split.

When the push is refused (no write access, protected namespace, no network), the
deposit is **not** dropped: write the patch (`git format-patch`) into this
stage's record dir, name the owner who will land it, and record the blocking
reason. That is an owned, recorded handoff. The one thing it is not is a skip —
there is no skip resolution.

### Step 7: Record the Deposit Artifact

Create `team-knowledge-push-deposit.md` with the resolved URL and how it was
resolved, the probe result, the validator result, the branch and review URL (or
the patch path and its owner), the card list with classes and grades, the named
sanitization approver, and anything re-graded from `project.md` with its
approver. End it with the machine-readable record the `akp-push` sensor
verifies — one fenced `yaml` block whose first line is `deposit:`:

```yaml
deposit:
  resolution: merge-request-opened | branch-pushed | patch-prepared
  repo_url: <git URL of the team knowledge hub>
  repo_url_source: pull-artifact | memory-layer | user-provided
  repo_probe: git-ls-remote-ok
  probed_at: <YYYY-MM-DD>
  validate: akp-validate-ok
  sanitization_approved_by: human:<id>
  cards:
    - practices/data-boundary/mock-data-synthesis
  reclassified_from_project: []              # project.md rules re-graded to team
  reclassification_approved_by: human:<id>   # required when the list is non-empty
  feedback_carried: feedback/<project>/<YYYY-MM-DD>.json
  branch: knowledge/<yyyy-mm-dd>-<topic>     # required unless patch-prepared
  review_url: <MR/PR URL>                    # required for merge-request-opened
  owner: <who lands it>                      # required for branch-pushed, patch-prepared
  patch_path: <path to the patch>            # required for patch-prepared
  blocked_reason: <why the push was refused> # required for patch-prepared
```

### Step 8: Deposit Gate

Ask only:

- **Accept the deposit** — record the review URL (or the patch owner) and close out.
- **Request changes** — adjust the entry list, the grades, or the card text.

Merging the MR is deliberately **not** on this list. It happens in the hub, by a
CODEOWNER, after review — that is the single authoritative write point in the
whole loop.

### Step 9: Update State

Mark `team-knowledge-push` complete in `<record>/aidlc-state.md`.

## Sensors

The required-sections sensor validates that the deposit record is reviewable.
The plugin's `akp-push` sensor (deterministic TypeScript, advisory like every
framework sensor) verifies the `deposit:` block records a probed git URL, a clean
local validator run, a non-empty card list, a named sanitization approver, and
one of the three submission outcomes with its required fields. The human deposit
gate is the authoritative acceptance; the hub's MR review is the authoritative
admission.

## Learn

Maintain `<record>/<phase>/<stage>/memory.md` with what was proposed, what the
human dropped, and why. A rejected candidate is worth recording: the reason it
was too project-specific to travel is itself a calibration for the next harvest.
