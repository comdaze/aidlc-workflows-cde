# Customer-Delivery PoC Playbook

## Purpose

Use this playbook for a 3–5 working-day customer PoC that proves one business
flow and leaves a runnable demo, CDK deployment package, architecture evidence,
and a clear extension path. It is not a production-readiness checklist.

## Eight-step cadence

1. **Requirements capture (about 2h):** agree the one-page problem statement,
   exclusions, acceptance criteria, data posture, and customer approver.
2. **Solution design (about 2h):** choose the smallest AWS architecture and
   TypeScript CDK stack plan that can demonstrate the accepted outcome.
3. **Environment readiness (about 1h):** establish the non-production account,
   region, CDK bootstrap, and baseline deployment.
4. **Walking skeleton (about 4h):** demo one real vertical slice early; stop or
   change direction before expanding if it invalidates the value hypothesis.
5. **Feature expansion (1–2d):** implement only customer-approved core behavior.
6. **Test validation (about 4h):** map each criterion to repeatable evidence.
7. **CDK deployment (about 2h):** deploy and smoke test only through CDK.
8. **Demo and handoff (about 2h):** obtain acceptance, document the
   production-extension backlog, and deliver the cost analysis (pilot,
   production, and 2x–10x over-production tiers with a per-service breakdown
   and explicit assumptions) so the customer sees the cost curve and their
   options, not just a working demo.

## CDE alignment

- Steps 1–2 support **Scope Agreement**.
- Steps 3–6 support **Iterative Build**; the Step 4 demo and Step 5 review are
  the **Pair Review** moments.
- Steps 7–8 support **Handoff**.

## Data and customer safety

Never handle real customer production data as a default. Use synthetic or masked
samples. If real customer data is essential, pause and use the approved
GenAIIC (Generative AI Innovation Center) co-creation path; record only the
approval reference and data owner, not data
values. Do not state or imply that a passing PoC is production ready.

## Handoff quality checklist

Verify every item at step 8 before the customer acceptance gate, and record
the checked list in the demo package. Each item traces to a detailed
knowledge file; the checklist is the 30-second verification pass, not a
replacement for the rules.

- [ ] Demo runs end-to-end with the documented safe sample input.
- [ ] README answers the four questions (what / run / teardown / why) without
      reading source; non-obvious prerequisites (e.g. model access) included.
- [ ] Architecture diagram shows what was actually deployed — consistent with
      the step-7 stack inventory.
- [ ] Teardown command documented and verified against the deployed stack.
- [ ] Test evidence includes the invalid-input case proving safe, specific
      error messages; no ARNs, account IDs, or stack traces in any recorded
      response or smoke output.
- [ ] Portability proof holds: redeploy to another account/region is
      configuration-only (no hardcoded account, region, or partition).
- [ ] ADRs exist for every decision a customer engineer would question, and
      their two-way/one-way door notes agree with the extension
      recommendations.
- [ ] Cost analysis covers pilot / production / over-production with
      per-service breakdown and inline assumptions; parametrized model
      committed; customer-facing copy at `docs/COST_ANALYSIS.md`.
- [ ] Value-metrics register has named owners; no fabricated CFN/MRR/SFDC
      values anywhere.
- [ ] No customer-confidential material in repo docs; only synthetic or
      approved masked data anywhere in the deliverable.

## Completion definition

A completed PoC has: a customer-visible demo, TypeScript CDK source and deployed
stack evidence, test evidence, a diagram, a repo README answering
what/run/teardown/why (with ADRs for real tradeoff decisions), explicit
limitations, an extension recommendation, a three-tier cost analysis (pilot /
production / over-production, per-service breakdown, every figure labeled
with its assumptions), and an owner for value
tracking. Do not fabricate pipeline, MRR, CloudFormation, or SFDC metrics;
cost figures are estimates with cited pricing sources, never quotes.
