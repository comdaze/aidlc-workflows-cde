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
   production-extension backlog, deliver the cost analysis (pilot,
   production, and 2x–10x over-production tiers with a per-service breakdown
   and explicit assumptions) so the customer sees the cost curve and their
   options, not just a working demo — and deposit the sanitized knowledge
   harvest back into the team knowledge repository. The deposit is mandatory
   and does not depend on step 1 having found anything there.

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

**Customer security boundaries.** Work safely inside the customer's existing
security pattern, then propose the fix — you will not refactor their secrets
pipeline in a 3–5-day PoC. Do not make the existing pattern worse, do not
lecture, and put the migration (e.g. long-lived keys → SSO/assume-role,
shared `.env` → a secrets manager) on the extension recommendations as an
owned follow-up. When you encounter a security anti-pattern you recognize —
long-lived keys, shared credentials, hardcoded production endpoints — flag it
factually to the customer contact. And when something looks off and you are
not sure, raise it before you act: customer security boundaries are not the
place to guess.

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
- [ ] Knowledge promoted out of the record (rules, industry knowledge)
      follows the knowledge governance laws: customer-confirmed, sanitized,
      generalization-graded, dated, and technical claims carry verification
      evidence.
- [ ] The harvest is deposited in the team knowledge repository through its
      contribution process, and `poc-accelerator-team-knowledge-deposit.md`
      records the probed git URL, the approved entry list, and the merge
      request, pushed branch, or — when the push was refused — the prepared
      patch with a named owner. "No team repository" is not an outcome: the
      URL is asked for here if nothing upstream supplied it.

## Knowledge governance (sedimentation and reuse)

Knowledge harvested from a PoC serves four audiences — same-project members
(automatic via the space layers), other projects (copy the team-knowledge
directory), the team (industry packs + plugin releases), and the organization
(generalized methodology into the plugin).

**The team knowledge repository closes the loop at both ends, and each end
stands on its own.** Step 1 reads from it; step 8 writes back to it. Neither
is conditional on the other, and neither can be skipped — a PoC that skipped
the read still owes the write, and a PoC that found nothing to import still
has something to contribute. The repository is identified by a **git URL**,
not a local directory: a checkout can be searched, but only a remote can be
pushed to, and step 8 pushes.

**The read end (step 1).** The first action of requirements capture is a
mandatory team-knowledge preflight, not an optional reminder. First search the
active space's local knowledge seats:
`aidlc/spaces/<space>/knowledge/aidlc-shared/` and
`aidlc/spaces/<space>/knowledge/aidlc-product-agent/`. Then read
`aidlc/spaces/<space>/memory/{org,team,project}.md` for an approved
`## Team Knowledge Repository` git URL; when no layer carries one, ask the user
for it as a required question — silence, "later", and a bare local path are not
answers. Probe the URL read-only (`git ls-remote --heads <url>`) before
trusting it; a failed probe is re-asked, not recorded as resolved. Then search
it for an industry pack matching the customer's domain, using the approved
local checkout when one exists and asking approval to clone otherwise. Record
the URL and how it was resolved, the probe, all sources and queries, matches,
revision/date, and the import path in the team-knowledge preflight artifact —
ending with the fenced `preflight:` yaml block the plugin's deterministic
`poc-accelerator-team-knowledge-preflight` sensor verifies (a missing
resolution, a non-git or absent URL, an unrecorded probe, or an empty search
record is reported as `SENSOR_FAILED`). Import an approved, sanitized pack into
the active space before customer domain capture, then apply the freshness law.
Register the confirmed URL in `project.md` so later stages and later runs
inherit it.

**The write end (step 8).** At PoC close, submit the promoted harvest back
through the repository's contribution process: a branch, one purposeful commit,
and a merge request carrying the conservation-law checklist. Step 8 resolves
the URL itself — preflight artifact, then memory layers, then a required
question — so a run that never executed the preflight still deposits. Get a
named approver for what leaves the engagement, never push to the default
branch, and when write access is refused, prepare the patch and name the owner
who will land it rather than dropping the deposit. The
`poc-accelerator-team-knowledge-deposit` sensor verifies the fenced `deposit:`
record the same deterministic way. Knowledge that stays in one project's seat
helps no one else.

Three conservation laws govern every promotion out of the workflow record:

1. **Confirm, sanitize, then promote.** Raw captures leave the record only
   after customer confirmation; promoted content carries a generalization
   grade (industry-generic vs. needs-recalibration) so the next user knows
   what to trust and what to re-ask.
2. **Technical claims carry verification evidence.** A promoted technical
   assertion (an API's regional availability, an endpoint behavior) must cite
   its test evidence — wrong context reused is costlier than one extra
   verification at harvest time.
3. **Freshness check on reuse; a reference renews life.** Entries carry
   learned/corrected dates. When importing knowledge older than 6 months with
   no intervening reference, re-confirm or delete the entry — do not build on
   it silently.

**Team-knowledge file convention:** classify entries as **knows** (what it
is, how it connects — so the agent can find it) or **judges** (what may be
touched, who owns it — so the agent can decide). "Judges" entries are the
first thing to verify when reusing a pack: they define the new PoC's safety
boundaries and carry the highest cost of error.

## Completion definition

A completed PoC has: a customer-visible demo, TypeScript CDK source and deployed
stack evidence, test evidence, a diagram, a repo README answering
what/run/teardown/why (with ADRs for real tradeoff decisions), explicit
limitations, an extension recommendation, a three-tier cost analysis (pilot /
production / over-production, per-service breakdown, every figure labeled
with its assumptions), and an owner for value
tracking. Do not fabricate pipeline, MRR, CloudFormation, or SFDC metrics;
cost figures are estimates with cited pricing sources, never quotes.
