# PoC Cost Analysis

At handoff the customer will ask what the system costs to run. "Let me get
back to you" leaks the momentum of a good demo. The cost analysis is a
first-class deliverable, and its point is not "what does it cost today" — it
is showing where the cost curve bends, whether there are economies of scale,
and where the architecture must change to stay cost-effective.

## The four parts of a complete analysis

1. **Scale estimates at three tiers.** Pilot (defined user count), production
   (the customer-agreed full load), and over-production (2x–10x). The third
   tier is what exposes inflection points; two data points always look
   linear.
2. **Per-service breakdown.** Each service, its cost driver (per-request,
   per-GB, per-token, per-session), and the estimated monthly cost at each
   tier. Price from the pricing MCP server for the target region and
   partition (CNY catalog for BJS/ZHY), citing source and quote date.
3. **Documented assumptions, inline.** Requests/month, active users, tokens
   per LLM call, data volume. Without them nobody can update the estimate
   when reality diverges — and it will.
4. **Architecture trade-offs at scale.** State where the current architecture
   stops being optimal and what the alternative is at that point.

## Reading the curve

- An all pay-per-request architecture scales linearly: no economies of scale.
  That is a legitimate finding — it tells the customer that if cost must drop
  at high volume, the architecture must change, and names where.
- Typical inflection points to check: managed LLM API vs. self-hosted model
  (API is almost always cheaper at pilot and early production; self-hosting
  can win at sustained high volume but trades away operational simplicity —
  make the crossover visible), DynamoDB on-demand vs. provisioned capacity at
  sustained load, per-request compute vs. always-on at high steady traffic,
  and AgentCore consumption pricing vs. a self-managed runtime.

## One-way vs. two-way doors

For each component that becomes expensive at scale, note whether swapping it
is a **two-way door** (abstracted behind a seam — swappable without a
rewrite) or a **one-way door** (hardcoded through the codebase — migration
required before alternatives can even be evaluated). This is where the code
organization seams pay off: an LLM call behind a client interface is a
two-way door; the same call inlined in fifty handlers is not. The framing
gives the customer "what are our options if cost becomes a problem", not just
a number.

## Make it live-adjustable

Build the estimate as a parametrized model — a spreadsheet or a small,
readable calc script committed with the analysis — so when the customer asks
"what if 50k users but only 60% active?" the number updates in the meeting,
not in a follow-up email.

## PoC-specific guidance

- The step-8 cost projection artifact carries this analysis; publish the
  customer-facing version at `docs/COST_ANALYSIS.md` in the workspace repo
  (the workflow record does not travel with the code).
- Every figure is a labeled estimate with its assumptions, never a quote or
  commitment; do not pull customer billing data without the data owner's
  approval.
- The two-way/one-way door notes should agree with the extension
  recommendations — a component named as a production swap must actually be
  behind a seam.
