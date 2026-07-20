# PoC Documentation Guide

Good documentation answers four questions for someone who has never seen the
repo:

1. What is this?
2. How do I run this?
3. How do I tear this down?
4. Why was it built this way?

If answering any of them requires messaging the SA or scheduling a meeting,
the documentation is incomplete. In a CDE engagement the repo is what the
customer keeps after the SA leaves; the README and ADRs are how the work
survives the handoff.

## The README

The README is the entry point: it takes a stranger from "just cloned" to
"running" without reading source. Keep it scannable, with these sections:

- **Purpose** — what the PoC does and the customer problem it validates.
- **Architecture** — core components and how they connect, with a diagram of
  what was *actually deployed*. An aspirational diagram of a system you did
  not build is worse than none; keep it consistent with the step-7 stack
  inventory.
- **Prerequisites** — everything needed before the first command, including
  the non-obvious account steps (e.g. Bedrock model access must be enabled in
  the target account/region before first invocation — the classic
  `AccessDeniedException` a README never mentioned).
- **Setup and run** — numbered, complete, ordered. Configuration-only for a
  new account/region (this is the same portability proof the step-8 demo
  package asserts).
- **Teardown** — the exact `cdk destroy` command and any manual cleanup.
  Orphaned infrastructure costs the customer real money; a PoC without a
  teardown section is not delivered.
- **Known limitations** — what is deliberately not production-ready, pointing
  at the extension recommendations.

If a section grows long, split it into a dedicated file
(`docs/DEPLOYMENT_GUIDE.md`, `docs/TROUBLESHOOTING.md`) and link it; the
README stays scannable.

## Architecture decision records (ADRs)

ADRs record *why* the system looks the way it does. Without them the
customer's engineer finds DynamoDB and has to guess: chosen for the access
pattern, or a default nobody questioned?

- Write an ADR (`docs/adr/NNNN-<topic>.md`) for any decision where a
  competent engineer would ask "why this way?" — data store, model choice,
  sync vs. async, AgentCore vs. a fallback runtime, and any region/partition
  fallback recorded as a design deviation.
- Content over format: what was decided, the constraints, the alternatives
  considered with pros/cons, and why this one won.
- Skip obvious defaults (S3 for static files, CloudWatch for logs). ADR noise
  buries the decisions that matter.

The step-2 solution design already captures these decisions in the workflow
record — the ADR repeats the decision *inside the repo the customer keeps*,
because the workflow record does not travel with the code.

## PoC-specific guidance

- Start the README at the walking skeleton (purpose, prerequisites, run,
  teardown for the first slice) and grow it with each expansion; a handoff-day
  documentation sprint always misses the tribal knowledge.
- The step-8 handoff gate checks the four questions are answerable from the
  repo alone; the demo package references the README rather than duplicating
  it.
- Keep customer-confidential context out of the repo docs — business rules
  confirmed for project memory stay in the workflow record, not the README.
