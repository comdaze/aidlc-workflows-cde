---
slug: team-knowledge-push
number: 4.95
name: Team Knowledge Push
plugin: team-knowledge
phase: operation
execution: CONDITIONAL
condition: Runs at close-out when the workflow produced team-level learnings or confirmed domain knowledge and a team knowledge hub is reachable. Skipped only when the human declines to name a hub, or affirms there is nothing that has passed the learning ritual yet — never skipped because pushing was inconvenient. This is the one stage of the pair that is also on the rails-free `vibe` scope: a free-form session's whole justification is that what it learned survives, and its sedimentation already lands in `team.md` through the same learnings ritual this stage reads from, so the export half applies unchanged. The import half deliberately does not — see team-knowledge-pull.
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
  - vibe
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
failed probe is re-asked, never recorded as done.

**A probe failure is a knowledge question before it is a credentials question.**
Some hosts refuse git over one transport entirely while serving the same
repository over another, and refuse it in a way that reads like a missing
repository or a permissions problem — so the diagnosis goes to access when it
belongs to protocol. Before concluding anything, try the other transport form of
the same URL. If a form works, two things follow and both are this stage's
business: say in the deposit record which form was probed, and treat the
registered URL as wrong rather than unlucky.

**Register the URL in a form the probe can actually use, under the heading this
stage reads.** Write it to `## Team Knowledge Repository` in
`aidlc/spaces/<space>/memory/project.md` when no layer carries it — that exact
heading, because resolution step 2 looks for it and nowhere else. A URL parked
under some other heading is invisible to this stage even though a human reading
the file would find it immediately, and a URL in a transport form the host
refuses fails every flow that opens with a read-only probe. Say so in the deposit
record when you find either: correcting the memory layer is not this stage's
product, and a silent re-diagnosis next quarter is the cost of not naming it.

There is a bootstrap this stage cannot solve, so do not pretend to. If the hub
holds a card about reaching the hub, it is unreadable until the hub is reached.
What makes that knowledge available at the moment it is needed is a *previous*
`team-knowledge-pull` in this project having imported it into the local layers —
a one-time-per-project bootstrap, not an ordering within one workflow. When this
project has never pulled, say so in the completion summary and suggest it.

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
review, or not at all. Do not present the machine check as sufficient. A keyword
query is also not a digest comparison — running one does not discharge Step 5's
in-bundle dedupe, and neither substitutes for the other.

**Survey the hub's conventions, not only its content.** Read the hub's
`index.md` and its existing topic tree before you choose any destination path in
Step 4:

```bash
bun {{HARNESS_DIR}}/tools/aidlc-akp-registry.ts --bundle <hub> --json
```

Reuse an existing topic directory wherever one fits, and when you introduce a new
one say in the deposit record why no existing topic would do. Without this the
tree becomes the sum of independent inventions — each deposit reasonable on its
own, the whole unnavigable — and nothing in the validator objects, because a path
is only wrong relative to a convention no file states. Where the hub has no
precedent at all, say that too: the first deposit into an empty topic space is
setting the convention, and it should be visible that it did.

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

When **most or all** of a deposit arrives this way, that is worth saying out loud
rather than just recording. It means the learnings ritual upstream routed
travelling knowledge to the project layer, and the structural exclusion this
stage relies on is being opened by hand every time — which makes it a review gate
wearing a structural gate's clothes. The usual cause is the question the rule was
written under: "what does this project need" produces a project-level rule, while
the test that decides whether knowledge travels is "would this still hold for
another customer". Name it in the deposit record so the next harvest starts
further along, and note that this stage cannot fix it — the fix is upstream.

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

**The topic in that lookup comes from the card's path, so the directory you pick
sets the shelf life — and it does so silently.** A path whose topic has no policy
entry falls back to the plain `type` window, which is usually the longest one
available; a `tags:` entry naming the topic does not correct it. So state, in the
card body, which window the chosen path implies and why that number is right for
this claim. One sentence is enough, and it is the only thing that makes a wrong
clock reviewable — the arithmetic is always correct, and it is the input nobody
checks.

The question to answer is whether the assertion describes **the current state of
something that changes** or **a settled fact**. A defect pinned to a released
version, with the version that fixed it, is settled: it will not become false, and
a long window is right. Current behaviour of a fast-moving dependency or
framework is not settled, and inherits a long window only because of where the
file sits — that is the case for `cde.review_interval_days`. Do not infer this
from how specific the title looks; a version number in a title is as likely to
mean "settled" as "perishable", and the two want opposite windows.

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

Validate **inside the scratch checkout from Step 6**, with the cards copied to
their hub paths, scoped to this deposit's cards:

```bash
bun {{HARNESS_DIR}}/tools/aidlc-akp-validate.ts --bundle <hub-checkout> --mode produce \
  --card <hub-checkout>/<path/to/card>.md   # one --card per card in this deposit
```

Not an isolated staging directory, and this is not a preference. Rule 7 dedupe
compares digests **within one bundle**, so a bundle holding only your own new
cards has nothing to compare against and the check passes vacuously — it reports
clean because it looked at nothing. `--card` keeps the *findings* scoped to this
deposit while the bundle still supplies the hub's existing cards as dedupe
context. Validating a staging dir is how a deposit gets a green validator run and
no duplicate check at all, and nothing in the output says so.

Two traps worth naming, because both produce a confident wrong reading:

- **Do not point `--bundle` at this stage's record dir.** The stage journal lives
  there, `memory.md` has no frontmatter, and it trips rule 1 as
  `okf-nonconformant` — a finding about the diary, reported as if the deposit were
  malformed.
- **Build the `--card` list as a shell array.** In `zsh` an unquoted `$VAR`
  holding `--card a --card b` is **not** word-split; it arrives as a single
  argument, the tool sees zero `--card` flags, and it silently validates and
  reports the whole bundle. The tell is `cards_checked` not matching your card
  count — check it every time.

Produce mode rejects on **both** verdict classes. Fix and re-run until clean; do
not push a card the gate would reject, and do not "explain it in the MR
description" instead. If the validator's complaint looks wrong, that is a finding
about the validator or the policy — raise it as such, in its own change, rather
than routing around it.

Expect findings against cards you did not write when the hub carries older ones.
Report the scoped run, and say plainly that the unscoped total belongs to
pre-existing cards — never fold someone else's non-conformance into this
deposit's result, in either direction.

### Step 6: Submit Through the Repository's Own Process

Fetch into a scratch checkout, then:

1. Branch: `knowledge/<yyyy-mm-dd>-<topic-slug>`.
2. Copy the cards to their paths, plus `akp-feedback.json` from a pull run in
   this workflow to `feedback/<project>/<date>.json`.
3. One purposeful commit.
4. Push the branch and open the merge request. Never commit to the default
   branch, never force-push, never commit credentials — the framework's git
   safety line applies to the team repository exactly as to the customer's.

When the host opens the merge request from a push option, keep the description
**short and single-line** and let the commit message carry the reasoning. A long
option value has been observed to make the push hang and then fail with no
message, and the failure is not recoverable in place: push options only fire on a
push that updates a ref, so once the branch is up to date a retry reports
"Everything up-to-date" and creates nothing. If that happens, the honest
resolution is `branch-pushed` with a named owner and the host's
create-merge-request URL — not a manufactured empty commit to trigger it, and not
a force-push.

After any git command that times out, verify state before retrying. A blind retry
on an ambiguous failure is how a duplicate commit or a lost staging set happens;
`git ls-remote` plus `git log -1` answers it in one step.

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
