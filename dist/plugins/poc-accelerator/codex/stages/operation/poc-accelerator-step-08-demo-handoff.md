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
consumes:
  - artifact: poc-accelerator-step-07-deployment-log
    required: true
  - artifact: poc-accelerator-smoke-test-results
    required: true
  - artifact: poc-accelerator-architecture-diagram
    required: true
  - artifact: poc-accelerator-feature-review
    required: true
requires_stage:
  - poc-accelerator-step-07-deployment
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - poc-accelerator-cde
inputs: Deployed PoC evidence, architecture diagram, implementation review, and customer acceptance criteria
outputs: poc-accelerator-demo-package.md, poc-accelerator-extension-recommendations.md, poc-accelerator-cost-projection.md, poc-accelerator-value-metrics-register.md (under this stage's record dir, engine-resolved)
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

### Step 5: Verify the Handoff Quality Checklist

Work through the handoff quality checklist in the PoC playbook item by item
and record the checked list (with evidence pointers) in
`poc-accelerator-demo-package.md`. An unchecked item is either fixed now or
presented at the gate as an explicit, owner-assigned exception — never
silently skipped.

### Step 6: Customer Acceptance Gate

Ask only:

- **Accept handoff** — record the demo result, extension path, cost projection, and owner.
- **Request changes** — return to the relevant approved PoC stage with a bounded request.

### Step 7: Update State

Mark `poc-accelerator-step-08-demo-handoff` complete in `<record>/aidlc-state.md`.

## Sensors

The Markdown sensors ensure handoff artifacts cite the deployed evidence,
architecture, and implementation review.

## Learn

Maintain timestamped interpretations, deviations, tradeoffs, and open questions
in `<record>/<phase>/<stage>/memory.md`. Customer-specific knowledge belongs in
project space memory only after approval.
