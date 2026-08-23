---
name: poc-accelerator-cde
plugin: poc-accelerator
depth: Minimal
# Deliberately empty: the customer-delivery workflow must be selected with
# `--scope poc-accelerator-cde`, not inferred from a short PoC keyword.
keywords: []
description: Deliver a customer-facing, CDK-deployed proof of concept in eight focused steps
skeleton: off
runner: true
---

# poc-accelerator-cde scope

A customer-delivery proof of concept for a 3–5 working-day engagement,
aligned with the CDE (Customer Development Engineering) working model. It is
intentionally distinct from core `poc`: core `poc` is a disposable feasibility
spike, whereas this scope produces a running demo, a TypeScript CDK deployment
package, an architecture decision record, and production-extension advice.

## Why these stages, why skip those

The eight dedicated stages mirror the CDE flow: agree scope, design a small
solution, prepare an AWS environment, demonstrate a walking skeleton, expand
only the validated core flow, test it, deploy it through CDK, and hand it over.
It deliberately omits the full production lifecycle, compliance assessment,
and enterprise operational design. Those are follow-on `feature` or
`enterprise` work, not shortcuts to production readiness.

## Activation (required)

After composing and selecting the `poc-accelerator` plugin, start this flow
with either explicit scope entry:

```text
/poc-accelerator-cde <customer scenario>
# or
/aidlc --scope poc-accelerator-cde <customer scenario>
```

The direct runner has `poc-accelerator-cde` fixed as its scope; the `/aidlc`
form passes the same scope to the orchestrator. Do **not** use `/aidlc pocx`,
`/aidlc poc cde`, or bare `/aidlc poc`. `pocx` is not a supported alias, and
core `poc` intentionally remains the throwaway feasibility-spike scope. This
scope declares no keywords so a short free-form request cannot silently select
the wrong workflow.

The eight `poc-accelerator-*` stages execute in order; framework
Initialization stages remain the engine preamble and are not part of the
customer-facing eight-step flow.
