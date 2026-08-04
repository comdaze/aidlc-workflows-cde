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
inputs: Confirmed intent, the team knowledge repository git URL (required — from space memory or asked), customer discussion, and any approved non-production sample material
outputs: poc-accelerator-team-knowledge-preflight.md, poc-accelerator-requirements-brief.md, poc-accelerator-acceptance-criteria.md, poc-accelerator-domain-knowledge-capture.md (under this stage's record dir, engine-resolved)
---

# PoC Requirements Capture

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

## Steps

### Step 1: Mandatory Team Knowledge Repository Preflight

Before reading customer context or asking domain questions, load
`aidlc-product-agent` and the PoC playbook, then create
`poc-accelerator-team-knowledge-preflight.md`.

The team knowledge repository is a **required input to this workflow**, and it
must be a **git repository URL** — an approved local checkout may be searched,
but it does not satisfy this step on its own, because the same repository is
where step 8 deposits this PoC's knowledge harvest. There is no skip path:
this step does not continue to customer context until a reachable git URL is
recorded.

1. Determine the active space from the workflow state (default: `default`) and
   search its local team knowledge seats for terms derived from the confirmed
   intent:
   - `aidlc/spaces/<space>/knowledge/aidlc-shared/`
   - `aidlc/spaces/<space>/knowledge/aidlc-product-agent/`
2. Resolve the repository URL in this order:
   - `aidlc/spaces/<space>/memory/org.md`, `team.md`, `project.md` — a
     `## Team Knowledge Repository` section naming a git URL.
   - Otherwise ask this required question: **provide the team knowledge
     repository's git URL** (`https://host/team/knowledge.git`,
     `ssh://git@host/team/knowledge.git`, or `git@host:team/knowledge.git`).
     Silence, "later", and a bare local path are not answers — ask again. Do
     not take credentials from files or chat history; rely on the ambient git
     credential helper or SSH agent, and if access is missing, say so and ask
     the user to configure it rather than working around it.
3. Probe the URL read-only before trusting it: `git ls-remote --heads <url>`.
   A failed probe is not a resolution — report what failed and ask for a URL
   that works or for the access to be granted. Record the probe date.
4. Search the repository for an industry pack matching the customer's domain:
   use the approved local checkout when one exists, otherwise ask the user to
   approve a clone into a scratch directory. Import only approved, sanitized
   pack content into the active space before relying on it.
5. Register the confirmed URL under `## Team Knowledge Repository` in
   `aidlc/spaces/<space>/memory/project.md` when no memory layer already
   carries it, so later stages and later runs resolve it without re-asking.
   This is a convenience, not a dependency — step 8 deposits the harvest
   whether or not this step ran, and resolves the URL itself when the memory
   layers are silent.
6. Record the active space, the repository URL and how it was resolved, the
   probe result and date, every source/path searched, search terms, matching
   pack(s), revision/date, and the import path in the preflight artifact.
7. End the artifact with the machine-readable record the
   `poc-accelerator-team-knowledge-preflight` sensor verifies — one fenced
   `yaml` block whose first line is `preflight:`:

   ```yaml
   preflight:
     resolution: pack-imported | no-pack-match
     repo_url: <git URL of the team knowledge repository>
     repo_url_source: memory-layer | user-provided
     repo_probe: git-ls-remote-ok
     probed_at: <YYYY-MM-DD>
     sources_searched:
       - aidlc/spaces/<space>/knowledge/aidlc-shared/
       - aidlc/spaces/<space>/knowledge/aidlc-product-agent/
       - <repo_url> @ <revision or date>
     pack: <matched pack>              # required for pack-imported
     import_path: <where it landed>    # required for pack-imported
     search_terms:                     # required for no-pack-match
       - <term>
   ```

   The sensor fails the write when `resolution` is missing or not one of the
   two values, when `repo_url` is absent or is not a git remote URL, when the
   probe is not recorded as `git-ls-remote-ok`, when `sources_searched` is
   empty, or when the fields required by the chosen resolution are absent — so
   an incomplete preflight, or one that quietly dropped the repository, is
   surfaced deterministically rather than by convention.

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
verifies the preflight artifact's fenced `preflight:` block records a probed
git repository URL plus a valid resolution — pack imported, or searched with
no match — and reports `SENSOR_FAILED` with the missing fields when it does
not. The customer approval is the authoritative acceptance of scope.

## Learn

Maintain `<record>/<phase>/<stage>/memory.md` with timestamped interpretations,
deviations, tradeoffs, and open questions. Promote only customer-confirmed,
durable rules; never place customer-sensitive material in framework knowledge.
