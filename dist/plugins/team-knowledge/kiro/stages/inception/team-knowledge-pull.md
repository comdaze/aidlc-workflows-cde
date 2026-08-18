---
slug: team-knowledge-pull
number: 2.95
name: Team Knowledge Pull
plugin: team-knowledge
phase: inception
execution: CONDITIONAL
condition: Runs when a team knowledge hub is reachable for this space — a `## Team Knowledge Repository` URL in any memory layer, or one the human supplies — and is skipped only when the human declines to name one. Place it before the design-class stages so imported rules are in force while decisions are made, or invoke it directly at any point.
# Not on the `vibe` scope, while team-knowledge-push is. This stage carries a
# human shortlist gate and sits upstream of construction, so on a rails-free
# scope it would fire before the session opens — turning "start working" into a
# hub search, which is the one property that scope exists to protect. Pulling is
# cheap to ask for on demand (aidlc-akp-registry.ts); an unrequested gate is not.
lead_agent: aidlc-developer-agent
support_agents: []
mode: inline
produces:
  - team-knowledge-pull-preflight
consumes: []
requires_stage: []
sensors:
  - required-sections
  - akp-pull
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
inputs: The confirmed intent, the active space's memory and knowledge layers, and the team knowledge hub's git URL (from a memory layer or asked here)
outputs: team-knowledge-pull-preflight.md and akp-feedback.json (under this stage's record dir, engine-resolved); imported Practice rules land in the space's team.md through the framework's learnings persist path, and Domain Knowledge cards land under the space's knowledge seats
---

# Team Knowledge Pull

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

This stage imports what the team already learned, from a shared hub repository of
OKF v0.2 cards, into this workflow's space. It is the consuming half of
`team-knowledge-push`; the two are independent — either can run without the other.

Two rules shape every step below, and both come from the framework's own
invariants rather than from this plugin:

- **The hub is a candidate source, not an authority.** A card never overwrites a
  local rule. Practice cards enter `team.md` only through
  `aidlc-learnings.ts persist`, which gives conflict checking, idempotency, and a
  `RULE_LEARNED` audit row. Hand-editing a memory file is not an alternative
  path; it is the failure this stage exists to prevent.
- **Read the index, then the cards you want.** Never read the whole bundle into
  context. `aidlc-akp-registry.ts` computes the index from frontmatter on demand
  (there is no committed registry to go stale).

Load `knowledge/aidlc-akp/card-authoring.md` before judging a card, and
`knowledge/aidlc-akp/hub-operations.md` before touching the repository.

## Steps

### Step 1: Resolve and Probe the Hub

Determine the active space from the workflow state (default: `default`), then
resolve the hub URL in this order:

1. A `## Team Knowledge Repository` section naming a git URL in
   `aidlc/spaces/<space>/memory/org.md`, `team.md`, or `project.md`.
2. Otherwise ask this required question: **provide the team knowledge hub's git
   URL** (`https://host/team/knowledge.git`,
   `ssh://git@host/team/knowledge.git`, or `git@host:team/knowledge.git`). A
   bare local path is not an answer — the same URL is what `team-knowledge-push`
   opens a merge request against. Do not take credentials from files or chat
   history; rely on the ambient git credential helper or SSH agent, and if
   access is missing, say so and ask for it to be configured rather than working
   around it.

Probe it read-only before trusting it: `git ls-remote --heads <url>`. A failed
probe is **not** a resolution — report what failed and ask for a URL that works
or for access to be granted. Record the probe date.

If the human declines to name a hub, this stage is SKIPPED (that is what the
`condition` above means) — it does not fabricate a local-only substitute.

Register the confirmed URL under `## Team Knowledge Repository` in
`aidlc/spaces/<space>/memory/project.md` when no memory layer carries it yet, so
later stages and later runs resolve it without re-asking.

### Step 2: Fetch and Index — Without Reading the Bundle

Fetch into a scratch directory (ask before cloning into the workspace), then
compute the index and search it:

```bash
bun {{HARNESS_DIR}}/tools/aidlc-akp-registry.ts --bundle <hub> --markdown \
  --query "<term from the intent>" --limit 40
bun {{HARNESS_DIR}}/tools/aidlc-akp-registry.ts --bundle <hub> --markdown \
  --tags <tag>,<tag> --type Practice
```

Derive the search terms from the confirmed intent, the domain, and the AWS
services in play. Record every query you ran — an unmatched search is an
auditable claim, not a shrug.

Then run the validator in **consume** mode over the bundle:

```bash
bun {{HARNESS_DIR}}/tools/aidlc-akp-validate.ts --bundle <hub> --mode consume
```

Consume mode is deliberately more forgiving than the hub's own gate (§6.2): only
the three OKF hard requirements reject. A missing `cde:` block means "this card
carries no CDE metadata" — treat it as `unverified` and have a human complete
the provenance before relying on it. It is **not** a reason to refuse the
bundle, and reporting a house-rule breach as "not OKF compliant" is a category
error worth avoiding out loud.

### Step 3: Shortlist With the Human, Then Read Only the Shortlist

Present the matched index rows — concept ID, type, title, tags, status, trust
tier, and any STALE marker. Ask which cards apply to this work. Read the full
text of the shortlisted cards only.

For each shortlisted card, check what the index already told you:

- **`trust_tier: unverified`** — no human has confirmed it. Usable as a lead,
  never as a rule.
- **STALE** (`today >= stale_after`) — the card has lost its *default*
  authority, not its content (§8.2). Say so explicitly and ask a named human to
  re-affirm it before it is used. Record the re-affirmer. If nobody re-affirms
  it, drop it from the import; do not import it quietly.
- **`generalization: needs-recalibration`** — its numbers/thresholds are
  domain-specific. Import the reasoning; re-derive the values here.
- **`status: deprecated`** — follow the successor link instead.

### Step 4: Import Practice Cards Through the Learnings Ritual

For every shortlisted `type: Practice` card, build one selections file and hand
it to the framework's own persist path — never write `team.md` directly:

```json
{
  "stage_slug": "team-knowledge-pull",
  "selections": [
    {
      "candidate_id": "practices/data-boundary/mock-data-synthesis",
      "type": "learning",
      "scope": "team",
      "heading": "## Mandated",
      "text": "<the card's \"# 规则\" section, verbatim>",
      "source": "user_addition"
    }
  ]
}
```

```bash
bun {{HARNESS_DIR}}/tools/aidlc-learnings.ts persist \
  --slug team-knowledge-pull --selections-json <path>
```

Field rules, each load-bearing:

- `candidate_id` is the **card's concept ID**. It is stable and unique, which
  sidesteps the position-derived candidate IDs of journal candidates; the
  idempotency key is `(stage_slug, candidate_id)`, so a concept ID also makes a
  re-run a no-op instead of a duplicate. Never reuse a `candidate_id` inside one
  persist call.
- `scope` is `"team"`, from the card's `cde.memory_target`. `org` is not
  available — `persist` has no `org.md` write path (§10.1). A card claiming an
  org-level rule is imported as team-level or not at all; escalating it is a
  human, framework-level decision.
- `heading` is the card's `cde.heading`, which the hub validator already
  restricted to the eight headings `team.md` ships.
- `text` is the card's `# 规则` section verbatim. Do not paraphrase: the local
  Content-Key is computed from this text, and a paraphrase breaks the trace.

Confirm each entry with the human one at a time. `persist` refuses a rule that
contradicts an `org.md` guardrail — when it does, that is the answer, not an
obstacle: report the conflict and drop the card.

Then copy every shortlisted `type: Domain Knowledge` card into
`aidlc/spaces/<space>/knowledge/<cde.knowledge_seat>/`, **keeping its
frontmatter**. The frontmatter is what carries the trust signals and the
provenance forward; stripping it turns a sourced, dated, human-verified card
into anonymous prose.

### Step 5: Register the Feedback Record

Write `akp-feedback.json` into this stage's record dir. `team-knowledge-push`
carries it into the hub's `feedback/<project>/<date>.json` on its branch, which
is what lets the hub's weekly `carry-affirmations` job refresh `verified` and
`stale_after` on cards this project actually used:

```json
{
  "project": "<sanitized project code, not the customer name>",
  "intent": "<intent record dir name>",
  "date": "<YYYY-MM-DD>",
  "imported": ["practices/data-boundary/mock-data-synthesis"],
  "affirmed": [{ "card": "practices/data-boundary/mock-data-synthesis", "by": "human:<id>", "at": "<YYYY-MM-DD>" }],
  "disputed": [{ "card": "knowledge/aws/<card>", "by": "human:<id>", "at": "<YYYY-MM-DD>", "evidence": "<what contradicted it>" }]
}
```

A `disputed` entry does **not** deprecate anything: a falsification claim can
itself be wrong. It pushes the card to the top of the hub's review list, in red.
Deprecation stays a human act, expressed as a successor card.

### Step 6: Record the Pull Artifact

Create `team-knowledge-pull-preflight.md` with the active space, the hub URL
and how it was resolved, the probe result and date, every query run, the
consume-mode validator summary, the shortlist with each card's trust tier and
staleness, what was imported where, and the persist receipt. End it with the
machine-readable record the `akp-pull` sensor verifies — one fenced `yaml` block
whose first line is `pull:`:

```yaml
pull:
  resolution: cards-imported | no-card-match | report-only
  repo_url: <git URL of the team knowledge hub>
  repo_url_source: memory-layer | user-provided
  repo_probe: git-ls-remote-ok
  probed_at: <YYYY-MM-DD>
  sources_searched:
    - <repo_url> @ <revision or date>
    - aidlc/spaces/<space>/knowledge/aidlc-shared/
  imported:                          # required for cards-imported
    - practices/data-boundary/mock-data-synthesis
  practices_persisted:               # required key for cards-imported ([] is a valid answer)
    - practices/data-boundary/mock-data-synthesis
  persist_slug: team-knowledge-pull  # required when practices_persisted is non-empty
  stale_imported: []                 # concept IDs imported while stale
  stale_reconfirmed_by: human:<id>   # required when stale_imported is non-empty
  search_terms:                      # required for no-card-match
    - <term>
  blocked_reason: <why persist was unreachable>   # required for report-only
  owner: <who runs the import in a real workflow> # required for report-only
  handoff:                                        # required for report-only
    - practices/<topic>/<card>
```

**The `report-only` resolution is the one honest degraded path.** Under
`--stage ... --single` there is no synthesized intent and no state file, so
`aidlc-learnings.ts` cannot run at all (§10.5). In that mode this stage does the
search and the reporting, records `report-only` with a named owner and the
handoff list, and stops. It does **not** hand-edit memory and call it done. Any
other blocked import takes the same shape: an owned, named handoff.

### Step 7: Import Gate

Present the shortlist, what was imported where, and any card dropped for
staleness or conflict. Ask only:

- **Approve the import** — continue with these rules in force.
- **Request changes** — adjust the shortlist, or drop specific cards.

### Step 8: Update State

Mark `team-knowledge-pull` complete in `<record>/aidlc-state.md`.

## Sensors

The required-sections sensor validates that the written record is reviewable.
The plugin's `akp-pull` sensor (deterministic TypeScript, advisory like every
framework sensor) verifies the `pull:` block records a probed git URL, a valid
resolution, that Practice imports went through `persist` rather than a memory
edit, and that any stale card was re-affirmed by a named human. The human import
gate is the authoritative acceptance.

## Learn

Maintain `<record>/<phase>/<stage>/memory.md` with timestamped notes on which
cards applied, which did not, and why. A card that did not survive contact with
this project is a `disputed` feedback entry with evidence — that is how the hub
learns it was wrong, and it is worth more than a silent non-use.
