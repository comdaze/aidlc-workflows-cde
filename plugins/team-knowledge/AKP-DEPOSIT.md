# AKP-Deposit — Agent Knowledge Protocol: Deposit Module

**Specification v0.1**

**Status:** Draft  
**Date:** 2026-08-11  
**Authors:** Sean Yang (AWS GCR — CDE)  
**Builds on:** [OKF v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) (Google Cloud, 2026-06)

---

## About the Agent Knowledge Protocol

The **Agent Knowledge Protocol (AKP)** is an open protocol for the safe,
governed flow of knowledge between AI agent systems and shared repositories.
It is organized as independent, composable modules:

| Module | Scope | Status |
|--------|-------|--------|
| **akp-deposit** | How knowledge safely enters a shared hub (this document) | v0.1 Draft |
| **akp-discovery** | How agents discover deposit candidates from memory, sessions, and corrections | Planned |
| **akp-evolution** | Lifecycle management: freshness, correction, archival, and deprecation | Planned |

Each module is self-contained. An implementation may adopt any subset. The
modules share a common card format (Section 4) and validator interface (Section
5) but impose no ordering on each other.

---

## Abstract

The Open Knowledge Format (OKF v0.2) defines how agent knowledge is
**represented** — markdown files with YAML frontmatter and trust signals.
It does not define how knowledge **enters** a shared repository safely.

This module — **akp-deposit** — fills that gap. It defines a minimal,
vendor-neutral protocol for any AI agent system to propose knowledge into a
shared OKF bundle, with fail-closed validation, human authority over admission,
and full provenance.

The protocol is:
- **Format-first:** builds on OKF v0.2; no proprietary extensions required.
- **Transport-agnostic:** works over git (primary), HTTP API, or MCP tool calls.
- **Agent-neutral:** no dependency on any framework, harness, or memory system.
- **Human-authoritative:** an agent may propose; only a human may admit.

---

## 1. Problem Statement

Every production agent memory system in 2026 (Mem0, Zep, Letta, Cognee,
Cloudflare Agent Memory) assumes the agent has authority to write memory
directly. No system natively implements a human-review-promotion gate.

This creates three failure modes at team scale:
1. **Unchecked propagation.** A wrong fact written by one agent is consumed by
   others without review.
2. **Confidentiality breach.** Agent-written memory may contain customer
   identifiers, credentials, or NDA-covered content.
3. **Authority confusion.** No record of who confirmed a piece of knowledge, so
   stale or wrong entries cannot be traced back.

AKP-Deposit addresses all three by separating the act of **proposing** knowledge
(which an agent may do) from the act of **admitting** it (which only a human may
do).

---

## 2. Terminology

| Term | Definition |
|------|-----------|
| **Hub** | A shared OKF v0.2 bundle (typically a git repository) that multiple projects consume. |
| **Spoke** | A project, session, or agent instance that proposes knowledge to the hub. |
| **Card** | One markdown file representing one concept, conforming to OKF v0.2 plus the AKP extensions. |
| **Deposit** | The act of proposing one or more cards from a spoke to the hub. |
| **Admission** | The act of a named human merging the deposit into the hub's protected branch. |
| **Validator** | A deterministic, fail-closed tool that checks every card before it reaches a reviewer. |

---

## 3. The Five Preservation Rules

Any card proposed through this protocol MUST satisfy all five. They are cheap to
check and each prevents a specific failure.

1. **Confirmed.** The knowledge was validated by a human or by reproducible
   evidence. An untested hypothesis is not a deposit.
2. **Sanitized.** No account IDs, credentials, internal hostnames, customer
   names, endpoints, or unmasked sample data. A named human approved the
   sanitization (recorded in `akp.sanitized_by`).
3. **Graded for generalization.** Marked `industry-generic` (travels as-is) or
   `needs-recalibration` (reasoning travels, thresholds do not).
4. **Dated.** `generated.at`, every `verified[].at`, and `stale_after` are
   present. Undated knowledge cannot be aged; knowledge that cannot be aged
   cannot be forgotten.
5. **Evidence-backed** (technical assertions). A factual claim carries the probe,
   the date, and the command/URL that proved it. A wrong technical claim in a
   shared repository gets reused invisibly.

---

## 4. Card Format

A card is a standard OKF v0.2 concept file with the following AKP extension
fields under an `akp:` namespace (analogous to how OKF allows custom extension
keys):

```yaml
---
type: Practice                    # | Domain Knowledge | Knowledge Pack
title: "Short imperative title"
description: "One-line summary"
tags: [aws, s3-tables]
status: stable                    # | draft | deprecated

# --- OKF v0.2 trust signals (REQUIRED by AKP) ---
generated:
  by: "<agent-system>/<version>"  # who WROTE the card
  at: "2026-08-11T09:51:56Z"
verified:                         # who CONFIRMED the knowledge (at least 1 entry)
  - by: "human:<identifier>"
    at: "2026-08-11T09:51:56Z"
stale_after: "2027-02-05"        # = max(verified.at) + half_life

sources:                          # at least 1, cited from body as [^id]
  - id: s1
    url: "https://..."            # or inline text evidence
    
# --- AKP extension fields ---
akp:
  # REQUIRED
  class: judges                   # | knows
  generalization: industry-generic # | needs-recalibration
  sanitized_by:
    by: "human:<identifier>"
    at: "2026-08-11"
  origin:
    project: "<project-slug>"     # NOT customer name
    agent_system: "<system-name>" # e.g. aidlc, kirocrew, cursor, manual
    session: "<opaque-id>"        # traceability, not replayability

  # OPTIONAL
  memory_target: team             # Practice only — where it lands on import
  heading: "## Mandated"          # Practice only — target heading in team rules
  knowledge_seat: aidlc-shared    # Domain Knowledge only — target seat
  supersedes: "<old-card-id>"     # when correcting a prior card
  review_interval_days: 90        # overrides policy half-life (must justify in body)
---

# Rule

<The rule or fact, self-contained, imperative, with [^footnote] attribution.>

# Reasoning

<The reasoning, the cost, and what was given up.>

[^s1]: <source detail>
```

### 4.1 Naming Convention

File path: `<type-dir>/<topic-slug>/<concept-slug>.md`

- `practices/<topic>/<slug>.md`
- `knowledge/domains/<domain>/<slug>.md`
- `knowledge/<platform>/<slug>.md`
- `packs/<pack>/pack.md`

One card, one file. This is what keeps concurrent deposits from conflicting and
makes lifecycle changes traceable via `git blame`.

### 4.2 Body Sections

| Section | Purpose | Scope |
|---------|---------|-------|
| `# Rule` | The self-contained rule or fact. This is the **only** range the dedupe digest covers, and the exact text that an importing project persists. | All card types |
| `# Reasoning` | The tradeoff, the cost, what was given up. A rule without its reasoning gets applied where the tradeoff is unacceptable. | All card types |

The `# Rule` section must be self-contained — a rule that needs `# Reasoning` to
be intelligible arrives in other projects without it.

---

## 5. Validator Contract

The validator is a deterministic, fail-closed function with this interface:

```typescript
interface ValidatorResult {
  valid: boolean;
  verdict: "ok" | "okf-nonconformant" | "akp-policy-violation";
  errors: ValidatorError[];
  warnings: ValidatorWarning[];
}

interface ValidatorError {
  rule: string;       // e.g. "missing-stale-after", "deny-pattern-match"
  file: string;
  line?: number;
  message: string;
}

function validate(cards: string[], policy: Policy): ValidatorResult;
```

### 5.1 Validation Rules (fail-closed: any failure rejects the deposit)

| ID | Rule | Checks |
|----|------|--------|
| V1 | OKF conformance | Parseable YAML frontmatter, non-empty `type`, valid structure |
| V2 | Required fields | `generated`, `verified` (at least 1), `stale_after`, `sources` (at least 1), `akp.sanitized_by`, `akp.class`, `akp.generalization`, `akp.origin` |
| V3 | Clock arithmetic | `stale_after == max(verified[].at) + half_life(type/topic)` with zero-day tolerance |
| V4 | Deny patterns | No match against `policy.deny_patterns` in full file content (frontmatter included) |
| V5 | Deduplicate | `# Rule` section normalized text does not match any existing card in the hub |
| V6 | Controlled vocabulary | `tags` within `policy.controlled_tags` union freeform; `akp.heading` in known headings; `type` in {Practice, Domain Knowledge, Knowledge Pack} |
| V7 | Sanitization present | `akp.sanitized_by.by` starts with `human:` |
| V8 | Supersession integrity | If `akp.supersedes` is set, the referenced card exists and will be flipped to `deprecated` in the same deposit |

### 5.2 Two Verdict Classes (kept distinct)

- **`okf-nonconformant`** — violates OKF SPEC section 11. Rejected on both hub and spoke.
- **`akp-policy-violation`** — violates AKP house rules. Rejected when we produce;
  a **warning** when consuming a third-party bundle that lacks `akp:` fields.

---

## 6. Transport Bindings

AKP-Deposit is transport-agnostic. Three bindings are defined:

### 6.1 Git Binding (primary, reference implementation)

```
Spoke                           Hub (git repo, protected main branch)
-----                           ---
1. Author card(s)               
2. Run validator locally        
3. If valid:                    
   - git checkout -b knowledge/<date>-<topic>
   - git add <card files>
   - git commit (one purposeful commit)
   - git push origin <branch>
   - Open merge request          -> 4. CI runs same validator
                                    5. CODEOWNER reviews
                                    6. Human merges (= admission)
```

Constraints:
- Never commit to the default branch directly.
- Never force-push.
- Bot tokens may open branches and MRs; they may NEVER merge.
- No write access is not a skip — `git format-patch` into a handoff record.

### 6.2 MCP Binding

```json
{
  "tools": [
    {
      "name": "akp_deposit_propose",
      "description": "Propose one or more OKF cards to the team knowledge hub.",
      "parameters": {
        "cards": "Card[] — array of card objects (frontmatter + body)",
        "hub_url": "string — git URL of the hub repository",
        "dry_run": "boolean — validate only, do not create branch/MR"
      },
      "returns": {
        "valid": "boolean",
        "errors": "ValidatorError[]",
        "mr_url": "string | null — merge request URL if not dry_run"
      }
    },
    {
      "name": "akp_deposit_search",
      "description": "Search existing hub cards to check for duplicates before proposing.",
      "parameters": {
        "query": "string",
        "type": "string? — filter by card type",
        "tags": "string[]? — filter by tags"
      },
      "returns": {
        "cards": "CardSummary[] — id, title, status, stale, trust_tier"
      }
    },
    {
      "name": "akp_deposit_validate",
      "description": "Dry-run validation without creating a branch.",
      "parameters": {
        "cards": "Card[]",
        "policy_url": "string? — URL to policy/lifecycle.json"
      },
      "returns": "ValidatorResult"
    },
    {
      "name": "akp_deposit_template",
      "description": "Return an empty card template for the given type.",
      "parameters": {
        "type": "Practice | Domain Knowledge | Knowledge Pack"
      },
      "returns": "string — card markdown with placeholder fields"
    }
  ]
}
```

### 6.3 HTTP Binding (for non-git systems)

```
POST /deposits
  Body: { cards: Card[], spoke_id: string }
  Response: { valid: boolean, errors: [], deposit_id: string, review_url: string }

GET  /cards?query=...&type=...&tags=...
GET  /cards/:id
POST /feedback/:card_id  { verdict: "affirmed" | "disputed", by: string, evidence?: string }
```

The HTTP layer MUST NOT provide a merge endpoint. It opens a MR/PR on the
underlying git repo; admission remains a human action in the git forge UI.

---

## 7. Agent Integration Requirements

An agent system implementing AKP-Deposit MUST:

1. **Never self-approve sanitization.** The `akp.sanitized_by` field requires
   a `human:` prefix. The agent asks; a human confirms.
2. **Run the validator before submitting.** A card that fails locally must not
   reach the hub's reviewer queue.
3. **Deduplicate before proposing.** Call `akp_deposit_search` (or check the
   hub's existing cards) to avoid duplicate deposits.
4. **Record provenance faithfully.** `akp.origin.agent_system` identifies the
   calling system; `generated.by` identifies the tool version that wrote the card.
5. **Surface the MR URL to the human.** The deposit is not "done" until a human
   merges it. The agent must communicate this.

An agent system implementing AKP-Deposit SHOULD:

- Suggest deposits proactively when it detects knowledge worth preserving (a
  confirmed correction, a verified platform behavior, a team-level rule).
- Include the reasoning (`# Reasoning`) section explaining the cost/tradeoff.
- Check `stale_after` of related existing cards and offer to re-affirm them.

---

## 8. Lifecycle Operations (post-admission)

These operations fall under the planned **akp-evolution** module. AKP-Deposit
defines only how consuming agents interact with them at the feedback level:

| Operation | Trigger | Agent role |
|-----------|---------|-----------|
| **Affirm** | Agent used a card and it held true | Append to `feedback/` via `POST /feedback` with `verdict: affirmed` |
| **Dispute** | Agent found a card incorrect | Append to `feedback/` with `verdict: disputed` + evidence |
| **Correct** | A card needs updating | Propose a new card with `akp.supersedes` + deprecate the old — same deposit |
| **Re-affirm (freshness)** | Card approaching `stale_after` | A named human appends a `verified` entry and moves `stale_after` forward |

Disputed cards are NOT automatically deprecated. A dispute is a signal for human
review, not an authority grant to the disputing agent.

The full lifecycle protocol (scheduled review-debt, automated affirmation
carry-forward, archival proposals) will be specified in **akp-evolution**.

---

## 9. Security Model

| Invariant | Enforced by |
|-----------|-------------|
| No unchecked content enters the hub | Validator (fail-closed, runs both spoke-side and hub CI) |
| No credentials/PII in cards | Deny patterns + named human sanitization approval |
| No silent authority escalation | Protected branch + bot tokens limited to branch+MR |
| Provenance is always traceable | `akp.origin` + `generated.by` + git commit author |
| Stale knowledge loses default trust | Arithmetic clock (`stale_after`), zero tolerance |

The protocol's security does NOT depend on:
- Agent honesty (the validator is deterministic)
- Network isolation (the hub is readable; writes go through the gate)
- Any single agent system's integrity

---

## 10. Relationship to Existing Standards

| Standard | Relationship |
|---------|-------------|
| **OKF v0.2** | AKP builds on OKF. A valid AKP card is a valid OKF concept. The `akp:` namespace is an OKF extension key. |
| **MCP** | AKP's MCP binding exposes deposit as standard MCP tools. Any MCP-capable agent can call them. |
| **A2A** | AKP does not define agent-to-agent communication. Agents deposit independently; the hub is the meeting point. |
| **AIKP** | AKP is narrower and implementation-ready. It solves one problem (safe deposit) rather than the full knowledge lifecycle. Could serve as a module within AIKP. |
| **NIST AI Agent Standards** | AKP's provenance and human-authority model aligns with NIST's security/identity pillar. |

---

## 11. Conformance Levels

| Level | Requirements |
|-------|-------------|
| **AKP-Read** | Can consume hub cards; respects `stale_after` and trust tier; can submit feedback. |
| **AKP-Propose** | AKP-Read + can author valid cards + runs validator + opens MR/deposit. |
| **AKP-Full** | AKP-Propose + proactive deposit suggestion + lifecycle operations (affirm/dispute/correct). |

---

## 12. Reference Implementation

The reference implementation lives at:
`plugins/team-knowledge/` in the [aidlc-workflows](https://github.com/awslabs/aidlc-workflows) repository.

Components:
- `tools/aidlc-akp-validate.ts` — the validator (V1-V8)
- `tools/aidlc-akp-cards.ts` — card authoring engine
- the hub skeleton — a ready-to-use hub repository template, maintained in
  `agent-knowledge-governance` at its top-level `hub/`
- its `tools/` — scheduled jobs (review-debt, carry-affirmations, propose-archive)

---

## Appendix A: Example Deposit Flow (autonomous agent)

```
User session: debugging S3 Tables performance
  |
  v
Agent discovers: "S3 Tables federated catalog has a 2.3s fixed overhead"
Agent: "This finding is worth depositing to team knowledge. Confirm?"
User: "Yes, deposit it"
  |
  v
Agent calls: akp_deposit_search(query="S3 Tables overhead")
  -> No existing card found
  |
  v
Agent drafts card (type: Domain Knowledge, class: knows, sources: [test report])
Agent: "Please confirm this content is safe to leave the project
        (no customer info / credentials): [shows card]"
User: "Confirmed"
  |
  v
Agent calls: akp_deposit_propose(cards=[card], hub_url="git@...", dry_run=false)
  -> Validator passes
  -> Branch created: knowledge/2026-08-11-s3-tables-overhead
  -> MR opened: https://gitlab.example.com/.../merge_requests/42
  |
  v
Agent: "MR submitted. Awaiting CODEOWNER review and merge."
```

---

## Appendix B: Example Deposit Flow (CLI / non-agent)

```bash
# A human (or CI script) deposits manually
akp-deposit \
  --hub-repo git@gitlab.example.com:team/knowledge-hub.git \
  --type "Domain Knowledge" \
  --title "S3 Tables federated catalog fixed overhead" \
  --content "S3 Tables federated catalog incurs a 2.3s fixed overhead..." \
  --reasoning "The bottleneck is Lake Formation credential delegation, not data volume..." \
  --sources '[{"id":"s1","text":"table7-performance-report.md, 2026-08-06"}]' \
  --tags aws,s3-tables \
  --class knows \
  --generalization industry-generic \
  --sanitized-by "human:sean" \
  --origin '{"project":"power-trading","agent_system":"manual"}'

# Output:
# OK  Validator passed (8/8 rules)
# OK  Branch: knowledge/2026-08-11-s3-tables-overhead
# OK  MR: https://gitlab.example.com/.../merge_requests/42
```

---

## Appendix C: Future AKP Modules

### akp-discovery (planned)

How agents identify deposit candidates from their own memory and sessions:
- Trigger heuristics (when a correction, a verified fact, or a team-level rule
  emerges during work)
- Candidate ranking (generalization potential, evidence strength, novelty)
- Integration with framework-specific memory layers (AIDLC learning ritual,
  KiroCrew lessons, IDE rules files)

### akp-evolution (planned)

Full lifecycle management for admitted cards:
- Freshness clock enforcement and re-affirmation workflows
- Scheduled review-debt surfacing
- Automated affirmation carry-forward from spoke feedback
- Archival proposals for cards stale beyond the grace window
- Correction protocol (supersession, single-MR integrity)
- Dispute resolution workflow

---

## Changelog

- **v0.1 (2026-08-11):** Initial draft of akp-deposit. Defines the five
  preservation rules, card format with `akp:` extension, validator contract
  (V1-V8), three transport bindings (git/MCP/HTTP), agent integration
  requirements, security model, and conformance levels.
