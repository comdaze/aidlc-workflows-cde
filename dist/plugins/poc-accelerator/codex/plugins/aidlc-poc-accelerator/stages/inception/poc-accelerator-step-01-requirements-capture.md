---
slug: poc-accelerator-step-01-requirements-capture
number: 2.80
name: PoC Requirements Capture
plugin: poc-accelerator
phase: inception
execution: ALWAYS
condition: Always executes first to establish a customer-confirmed delivery boundary.
lead_agent: aidlc-product-agent
support_agents:
  - aidlc-architect-agent
mode: inline
produces:
  - poc-accelerator-team-knowledge-preflight
  - poc-accelerator-requirements-brief
  - poc-accelerator-acceptance-criteria
  - poc-accelerator-domain-knowledge-capture
consumes: []
requires_stage: []
sensors:
  - required-sections
  - poc-accelerator-team-knowledge-preflight
scopes:
  - poc-accelerator-cde
inputs: Confirmed intent, customer discussion, and any approved non-production sample material
outputs: poc-accelerator-team-knowledge-preflight.md, poc-accelerator-requirements-brief.md, poc-accelerator-acceptance-criteria.md, poc-accelerator-domain-knowledge-capture.md (under this stage's record dir, engine-resolved)
---

# PoC Requirements Capture

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

## Steps

### Step 1: Mandatory Team Knowledge Preflight

Before reading customer context or asking domain questions, load
`aidlc-product-agent` and the PoC playbook, then create
`poc-accelerator-team-knowledge-preflight.md`.

1. Determine the active space from the workflow state (default: `default`) and
   search its local team knowledge seats for terms derived from the confirmed
   intent:
   - `aidlc/spaces/<space>/knowledge/aidlc-shared/`
   - `aidlc/spaces/<space>/knowledge/aidlc-product-agent/`
2. Read `aidlc/spaces/<space>/memory/org.md`, `team.md`, and `project.md`.
   If any layer names a Team Knowledge Repository, search its approved local
   checkout for a matching industry pack. If it provides only a remote URL,
   ask the user to approve reading or cloning it; do not use credentials from
   files or chat history.
3. If no matching pack exists, the repository is unavailable, or no source is
   configured, ask this required question before proceeding: **provide an
   approved team-knowledge URL or local path to search, or explicitly request
   that team knowledge be skipped for this PoC.** Do not infer a skip from
   silence. If the user provides a URL, record it and obtain any required
   read/clone approval before searching; if the user skips, record who made
   that decision and why.
4. Record the active space, every source/path searched, search terms, matching
   pack(s), revision/date, import path, the user's URL/path or explicit skip,
   and any access failure or missing configuration in the preflight artifact.
   Import only approved, sanitized pack content into the active space before
   relying on it.
5. End the artifact with the machine-readable record the
   `poc-accelerator-team-knowledge-preflight` sensor verifies — one fenced
   `yaml` block whose first line is `preflight:`:

   ```yaml
   preflight:
     resolution: pack-imported | user-source-provided | skipped-by-user
     sources_searched:
       - aidlc/spaces/<space>/knowledge/aidlc-shared/
       - aidlc/spaces/<space>/knowledge/aidlc-product-agent/
     pack: <matched pack>            # required for pack-imported
     import_path: <where it landed>  # required for pack-imported
     source: <approved URL or path>  # required for user-source-provided
     decided_by: <who chose to skip> # required for skipped-by-user
     reason: <why>                   # required for skipped-by-user
   ```

   The sensor fails the write when `resolution` is missing or not one of the
   three values, when `sources_searched` is empty, or when the fields required
   by the chosen resolution are absent — so a silent or incomplete preflight
   is surfaced deterministically, not by convention.

If a pack was imported, apply the playbook's freshness law before relying on
it: entries older than 6 months without an intervening reference are flagged
into this stage's customer calibration list for re-confirmation, and
"judges"-class entries (safety boundaries, data red lines) are verified first.

### Step 2: Load PoC Context

Read the confirmed intent, customer-provided context, existing project rules,
and the completed team-knowledge preflight. Treat customer data as restricted
by default: do not request, copy, or process real production data unless the
customer and the GenAIIC (Generative AI Innovation Center) co-creation process
have explicitly approved it.

### Step 3: Capture a One-Page Delivery Brief

Create `poc-accelerator-requirements-brief.md` with the customer problem,
primary user, narrow business outcome, in-scope flow, explicit exclusions,
3–5-day time box, AWS account/region owner, and assumptions. Keep the brief
small enough to review in one customer session. Before promising a capability,
sanity-check that the candidate AWS services exist in the target region and
partition via the AWS documentation MCP server (or the AWS MCP Remote endpoint
in Global regions, per the regional MCP setup knowledge) — especially for
aws-cn, where service availability differs.

### Step 4: Define Observable Acceptance

Create `poc-accelerator-acceptance-criteria.md` with measurable demo outcomes:
inputs, expected behavior, visible result, test evidence, and the named
customer approver. Separate a PoC success signal from a production requirement.

### Step 5: Capture and Validate Domain Knowledge

Create `poc-accelerator-domain-knowledge-capture.md`. Record the source of each
rule (team knowledge preflight, domain expert, approved document, or customer
calibration), unresolved terms, and any sample-data masking requirement. Write
stable customer-specific rules to the project memory only after the customer
confirms them.

### Step 6: Customer Scope Gate

Present the brief and acceptance criteria. Ask only:

- **Approve scope** — lock the PoC boundary and continue to solution design.
- **Request changes** — revise the boundary, success criteria, or data posture.

### Step 7: Update State

Mark `poc-accelerator-step-01-requirements-capture` complete in `<record>/aidlc-state.md`.

## Sensors

The required-sections sensor validates that written Markdown deliverables are
reviewable. The plugin's `poc-accelerator-team-knowledge-preflight` sensor
(a deterministic TypeScript check, advisory like every framework sensor)
verifies the preflight artifact's fenced `preflight:` block records a valid
resolution — pack imported, user-provided source, or an explicit skip with a
named decider — and reports `SENSOR_FAILED` with the missing fields when it
does not. The customer approval is the authoritative acceptance of scope.

## Learn

Maintain `<record>/<phase>/<stage>/memory.md` with timestamped interpretations,
deviations, tradeoffs, and open questions. Promote only customer-confirmed,
durable rules; never place customer-sensitive material in framework knowledge.
