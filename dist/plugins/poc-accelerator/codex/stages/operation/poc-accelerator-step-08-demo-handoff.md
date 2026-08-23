---
slug: poc-accelerator-step-08-demo-handoff
number: 4.81
name: PoC Demo and Handoff
plugin: poc-accelerator
phase: operation
execution: ALWAYS
condition: Always executes last to obtain customer acceptance and document the production extension path.
lead_agent: aidlc-product-agent
support_agents:
  - aidlc-architect-agent
  - aidlc-pipeline-deploy-agent
mode: inline
produces:
  - poc-accelerator-demo-package
  - poc-accelerator-extension-recommendations
  - poc-accelerator-cost-projection
  - poc-accelerator-value-metrics-register
  - poc-accelerator-team-knowledge-deposit
consumes:
  - artifact: poc-accelerator-step-07-deployment-log
    required: true
  - artifact: poc-accelerator-smoke-test-results
    required: true
  - artifact: poc-accelerator-architecture-diagram
    required: true
  - artifact: poc-accelerator-feature-review
    required: true
  - artifact: poc-accelerator-team-knowledge-preflight
    required: false
requires_stage:
  - poc-accelerator-step-07-deployment
sensors:
  - required-sections
  - upstream-coverage
  - poc-accelerator-team-knowledge-deposit
scopes:
  - poc-accelerator-cde
inputs: Deployed PoC evidence, architecture diagram, implementation review, customer acceptance criteria, and the team knowledge repository git URL (required — from the step-01 preflight, space memory, or asked here)
outputs: poc-accelerator-demo-package.md, poc-accelerator-extension-recommendations.md, poc-accelerator-cost-projection.md, poc-accelerator-value-metrics-register.md, poc-accelerator-team-knowledge-deposit.md (under this stage's record dir, engine-resolved)
---

# PoC Demo and Handoff

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

## Steps

### Step 1: Assemble the Customer Demo

Load the product, architect, and deployment personas. Create
`poc-accelerator-demo-package.md` with the problem statement, launch steps,
safe sample input, expected result, architecture diagram reference, CDK stack
reference, test evidence, and cleanup contact. The launch steps are the
portability proof: deploying to a different account and region must require
editing configuration only, never source or CDK code — if that does not hold,
fix it before handoff rather than deferring it to the extension
recommendations. Verify the workspace repo passes the documentation gate: a
stranger can answer "what is this / how do I run it / how do I tear it down /
why was it built this way" from the README and `docs/adr/` alone — the demo
package references the README rather than duplicating it.

### Step 2: Document the Production Extension Path

Create `poc-accelerator-extension-recommendations.md`. Separate achieved PoC
capabilities from production work such as a CI/CD pipeline, authentication,
resilience, observability, data governance, cost controls, security review,
and operational ownership. Note that the deliverable is pipeline-ready —
all-CDK infrastructure plus configuration-only portability wires directly
into any CI system — and point the CI/CD item at the follow-on workflow's
ci-pipeline and deployment-pipeline stages rather than building one inside
the PoC time box. Recommend a follow-on `feature` or `enterprise` workflow rather
than declaring the PoC production ready.

### Step 3: Project PoC and Production Costs

Create `poc-accelerator-cost-projection.md` per the cost analysis knowledge —
a three-tier, per-service breakdown that closes the business case for the
customer and the account team:

1. **PoC running cost (pilot tier)** — enumerate the deployed CDK stack's
   resources (from the deployment log), state the pricing assumptions (region,
   instance sizes, storage volume, request rates observed during smoke
   testing), and estimate the monthly cost of keeping the PoC running as-is.
   Prefer the AWS pricing MCP server (`awslabs.aws-pricing-mcp-server`,
   configured per the regional MCP setup knowledge) for real-time Price List
   API quotes; fall back to AWS pricing pages. Cite the pricing source and the
   date of the quote.
2. **Production-scale projection** — state explicit scale assumptions agreed
   with the customer (users, throughput, data volume, availability target),
   list the production additions from the extension recommendations that carry
   cost (multi-AZ, monitoring, backup, security services), and project a
   monthly cost range for the production architecture. Include the main cost
   levers (savings plans, reserved capacity, serverless tiers, storage classes)
   and which assumption dominates the range.
3. **Over-production tier (2x–10x)** — extend the same per-service model past
   the production load to expose the cost curve: where it stays linear (pure
   pay-per-request has no economies of scale — say so), where inflection
   points sit (managed LLM API vs. self-hosting, on-demand vs. provisioned
   capacity), and for each component that turns expensive at scale, whether
   swapping it is a two-way door (behind a seam) or a one-way door (rewrite
   first). These notes must agree with the extension recommendations.

Build the numbers as a parametrized model (spreadsheet or small calc script)
committed alongside the analysis so assumptions can be adjusted live in the
handoff conversation, and publish the customer-facing version at
`docs/COST_ANALYSIS.md` in the workspace repo. Every figure must be labeled as
an estimate with its assumptions inline. Do not present estimates as quotes or
commitments, and do not pull billing data from customer accounts without the
data owner's approval.

### Step 4: Record Value Signals Without Fabricating Business Data

Create `poc-accelerator-value-metrics-register.md` with the identifiers and
owners needed to later measure delivery duration, workshop-to-PoC conversion,
PoC-to-production conversion, deployed stack/resource inventory, estimated MRR,
and associated opportunity. It is a tracking register only: do not invent CFN,
MRR, or SFDC values, and do not integrate with customer or internal systems
without an approved connector and data owner. The estimated-MRR row may cite
the PoC running cost from `poc-accelerator-cost-projection.md` as its basis,
clearly labeled as an estimate.

### Step 5: Deposit the Knowledge Harvest into the Team Knowledge Repository

This step is **mandatory and independent of step 1**. It runs whether or not
the requirements-capture preflight ran, and it resolves the repository URL on
its own — a PoC that never read team knowledge still owes the team what it
learned. There is no skip path and no "nothing to deposit" outcome: a PoC that
produced verified technical claims, domain calibrations, and cost evidence has
a harvest by definition.

1. **Resolve the repository URL**, in this order:
   - `poc-accelerator-team-knowledge-preflight.md`, when this run produced one.
   - `## Team Knowledge Repository` in `aidlc/spaces/<space>/memory/org.md`,
     `team.md`, or `project.md`.
   - Otherwise ask this required question: **provide the team knowledge
     repository's git URL** (`https://host/team/knowledge.git`,
     `ssh://git@host/team/knowledge.git`, or `git@host:team/knowledge.git`).
     A bare local path is not an answer — the harvest has to be pushed. Do not
     take credentials from files or chat history; use the ambient git
     credential helper or SSH agent.

   Probe it read-only before writing anything: `git ls-remote --heads <url>`.
   A failed probe is re-asked, never recorded as done. When step 01 did not
   register the URL, register the confirmed one in
   `aidlc/spaces/<space>/memory/project.md` so the next engagement inherits it.

2. **Assemble the harvest** from the stage `memory.md` files, the domain
   knowledge capture, the ADRs, and the test evidence. Apply the playbook's
   conservation laws to every entry: customer-confirmed, sanitized, classified
   **knows** or **judges**, graded industry-generic vs. needs-recalibration,
   dated, and — for any technical claim such as a service's regional
   availability or an endpoint's behavior — citing the evidence that proved it.
   Nothing customer-confidential leaves the engagement: no account
   identifiers, endpoints, credentials, customer names under NDA, or unmasked
   sample data.

3. **Get sanitization approval.** Present the exact entry list and ask the
   customer contact or named data owner to approve what leaves the engagement,
   then record the approver by name. The approval covers *content*; it is not
   a vote on whether to deposit.

4. **Submit through the repository's own contribution process.** Clone or
   fetch into a scratch directory, branch
   (`knowledge/<yyyy-mm-dd>-<domain-slug>`), make one purposeful commit, push
   the branch, and open the merge/pull request. Never commit to the default
   branch, never force-push, never commit credentials — the framework's git
   safety line applies to the team repository exactly as it does to the
   customer's.

   **When the `team-knowledge` plugin is installed** — check for
   `{{HARNESS_DIR}}/tools/aidlc-akp-validate.ts` — write the harvest as OKF v0.2
   cards instead of leaving it as a prose list, one card per file, following that
   plugin's `knowledge/aidlc-akp/card-authoring.md`. One card per file is not
   housekeeping: it is what keeps two PoCs depositing in the same week from
   conflicting, and what makes a later correction a single-file change. Then run
   the same gate the hub's own merge requests run, *before* you push:

   ```bash
   bun {{HARNESS_DIR}}/tools/aidlc-akp-validate.ts --bundle <staging> --mode produce
   ```

   Produce mode rejects on both verdict classes. Fix and re-run until clean — do
   not push a card the gate would reject and explain it in the MR description
   instead. Record `validate: akp-validate-ok` and the card concept IDs.

   Two things the gate gives you that a prose list cannot: `stale_after` is
   reverse-computed from the policy half-life with zero days of tolerance, so the
   playbook's freshness law becomes arithmetic instead of a habit; and a
   `Practice` card carries the `cde.heading` that lets the *next* project import
   it through `aidlc-learnings.ts persist` — with a conflict check and a
   `RULE_LEARNED` audit row — instead of by hand.

   **When that plugin is not installed**, deposit the prose entry list as before
   and omit both fields. Nothing in this step depends on that plugin, and the
   entry list stays required either way.

5. **When the push is refused** (no write access, protected namespace, no
   network), the deposit is not dropped: write the patch
   (`git format-patch`) into this stage's record dir, name the owner who will
   land it, and record the blocking reason. That is an owned, recorded handoff
   — the one thing it is not is a skip.

6. Create `poc-accelerator-team-knowledge-deposit.md` with the resolved URL and
   how it was resolved, the probe result, the branch and review URL (or the
   patch path and its owner), the approved entry list with grades, and the
   named approver. End it with the machine-readable record the
   `poc-accelerator-team-knowledge-deposit` sensor verifies — one fenced `yaml`
   block whose first line is `deposit:`:

   ```yaml
   deposit:
     resolution: merge-request-opened | branch-pushed | patch-prepared
     repo_url: <git URL of the team knowledge repository>
     repo_url_source: preflight-artifact | memory-layer | user-provided
     repo_probe: git-ls-remote-ok
     probed_at: <YYYY-MM-DD>
     sanitization_approved_by: <named approver>
     entries:
       - <entry title> (knows|judges, industry-generic|needs-recalibration)
     validate: akp-validate-ok          # optional — a PASSING team-knowledge gate run
     cards:                             # optional — OKF card concept IDs
       - practices/<topic>/<card>
     branch: <pushed branch>            # required unless patch-prepared
     review_url: <MR/PR URL>            # required for merge-request-opened
     owner: <who lands it>              # required for branch-pushed, patch-prepared
     patch_path: <path to the patch>    # required for patch-prepared
     blocked_reason: <why the push was refused>  # required for patch-prepared
   ```

   The sensor fails the write when `resolution` is missing or not one of the
   three values, when `repo_url` is absent or is not a git remote URL, when the
   probe is not recorded as `git-ls-remote-ok`, when `entries` is empty, when
   `sanitization_approved_by` is absent, or when the fields required by the
   chosen resolution are missing — so a handoff that quietly kept the harvest
   in the record is surfaced deterministically.

   `validate` and `cards` are checked **only when present**: a recorded validator
   run must be a passing one, and a non-empty `cards` list requires it — an
   unvalidated card must never reach a human reviewer. `entries` stays required
   even when `cards` is present, so a record written without the
   `team-knowledge` plugin is judged exactly as it was before.

### Step 6: Verify the Handoff Quality Checklist

Work through the handoff quality checklist in the PoC playbook item by item
and record the checked list (with evidence pointers) in
`poc-accelerator-demo-package.md`. An unchecked item is either fixed now or
presented at the gate as an explicit, owner-assigned exception — never
silently skipped.

### Step 7: Customer Acceptance Gate

Ask only:

- **Accept handoff** — record the demo result, extension path, cost projection, knowledge deposit, and owner.
- **Request changes** — return to the relevant approved PoC stage with a bounded request.

### Step 8: Update State

Mark `poc-accelerator-step-08-demo-handoff` complete in `<record>/aidlc-state.md`.

## Sensors

The Markdown sensors ensure handoff artifacts cite the deployed evidence,
architecture, and implementation review. The plugin's
`poc-accelerator-team-knowledge-deposit` sensor (a deterministic TypeScript
check, advisory like every framework sensor) verifies the deposit artifact's
fenced `deposit:` block records a probed git repository URL, a non-empty
approved entry list, and one of the three submission outcomes with its
required fields.

## Learn

Maintain timestamped interpretations, deviations, tradeoffs, and open questions
in `<record>/<phase>/<stage>/memory.md`. Customer-specific knowledge belongs in
project space memory only after approval; the generalized, sanitized harvest
goes to the team knowledge repository in Step 5 — that submission is what makes
the next engagement start ahead of this one.
