---
slug: poc-accelerator-step-05-feature-expansion
number: 3.82
name: PoC Feature Expansion
plugin: poc-accelerator
phase: construction
execution: ALWAYS
condition: Always executes after the walking-skeleton review to complete only approved core behavior.
lead_agent: aidlc-developer-agent
support_agents:
  - aidlc-product-agent
  - aidlc-quality-agent
mode: inline
workspace_requires: true
produces:
  - poc-accelerator-feature-summary
  - poc-accelerator-feature-review
consumes:
  - artifact: poc-accelerator-skeleton-review
    required: true
  - artifact: poc-accelerator-requirements-brief
    required: true
  - artifact: poc-accelerator-acceptance-criteria
    required: true
requires_stage:
  - poc-accelerator-step-04-walking-skeleton
sensors:
  - type-check
  - required-sections
  - upstream-coverage
scopes:
  - poc-accelerator-cde
inputs: Approved skeleton review, requirements brief, and acceptance criteria
outputs: Expanded application and CDK source plus poc-accelerator-feature-summary.md and poc-accelerator-feature-review.md (under this stage's record dir, engine-resolved)
---

# PoC Feature Expansion

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

## Steps

### Step 1: Reconfirm the Approved Boundary

Read the skeleton review and acceptance criteria. Translate customer feedback
into a short ordered implementation list. Defer production hardening, unrelated
features, and unconfirmed industry rules to the extension recommendations.

### Step 2: Implement Core Behavior

Extend the workspace code and TypeScript CDK definitions sequentially, filling
in the layout the skeleton established (per the PoC code organization
knowledge): new behavior goes in small, single-purpose files named for what
they do, store and external-system access stays behind the client/adapter
seams, and nothing accumulates in a `utils` file. A file crossing ~500 lines
is a split signal. Follow the robust-portable-code knowledge as behavior
grows: every new external call is wrapped in its own named function with a
safe, specific error message; async consumers get a dead-letter queue in CDK;
environment-specific values go to configuration, and account/region/partition
always come from `Stack.of(this)`. Validate CDK/CloudFormation changes through
the AWS IaC MCP server before each deploy, and consult the AWS
documentation/knowledge MCP servers for service behavior instead of guessing
API semantics. Keep a trace
from each change to an acceptance criterion; add or update tests alongside the
change. Apply the redaction placeholder to every data-handling path and use
only approved synthetic or masked data.

### Step 3: Verify Locally and in the PoC Environment

Run build, the repo's real linter, type checks, tests, `cdk synth`, and the safe
deployed flow — once, here, as the authority on this workspace's code. Then land
any deferred sensor work before the gate:

```bash
bun {{HARNESS_DIR}}/tools/aidlc-sensor.ts flush --stage poc-accelerator-step-05-feature-expansion
```

`type-check` carries a coalesce window, so a burst of edits produces one real
fire plus a recorded debt; flush converts that debt into a verification instead
of letting the stage close on an unchecked write.

Capture any intentional shortfall with its owner and follow-up path rather than
quietly treating it as done. In the diff review, treat test-suite tampering as
a first-class signal: a skipped test, a weakened assertion, or modified test
setup usually means the implementation is wrong and the evidence is being
hidden — the fix is the implementation, never the test.

### Step 4: Write the Reviewable Summary

Create `poc-accelerator-feature-summary.md` (changes, criterion traceability,
tests, and deployment impact) and `poc-accelerator-feature-review.md` (open
risks, exclusions, and review decision). Keep the workspace README current
with the growing behavior, and write an ADR (`docs/adr/`) for each decision a
customer engineer would question — data store, model choice, sync vs. async,
runtime fallback — per the documentation guide knowledge.

### Step 5: SA Review Gate

Ask only:

- **Approve implementation** — proceed to test validation.
- **Request changes** — revise the approved core behavior.

### Step 6: Update State

Mark `poc-accelerator-step-05-feature-expansion` complete in `<record>/aidlc-state.md`.

## Sensors

The `type-check` sensor runs on TypeScript changes and coalesces repeat fires
inside its window — Step 3's flush closes the window before the gate. Markdown
sensors ensure feature evidence cites the skeleton review, requirements, and
criteria.

The stock `linter` sensor is deliberately NOT bound here, for the reason given
in step 04's `## Sensors`: it wraps eslint only, so it is a permanent no-op on a
PoC whose application code is not JS/TS. Step 3 runs the repo's own linter
instead; a JS/TS-only PoC can add `linter` back to this stage's `sensors:` list.

## Learn

Maintain timestamped interpretations, deviations, tradeoffs, and open questions
in `<record>/<phase>/<stage>/memory.md`. Keep unresolved domain rules visible
for the customer rather than assuming them.
