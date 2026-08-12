# Card Authoring — the five preservation rules and the destination decision

Methodology knowledge for the `team-knowledge` plugin. Read it before
writing a card or judging an imported one. Vocabulary is inherited from
`plugins/vibe/knowledge/aidlc-vibe/vibe-sedimentation.md` on purpose: this is the
same sedimentation act, one layer further out.

## 1. What a card is, and what it is not

A card records **a human judgement that cannot be re-derived from code**: a rule,
a correction, a domain fact with its evidence, a route that was tried and
rejected. That is the opposite of a generated document.

The distinction has a practical consequence worth stating plainly: a card must
never be regenerated from source. An agent that "refreshes" a card from the
repository does not update it — it destroys the authority a human put into it.
Freshness here is re-affirmation by a person, not re-derivation by a tool.

So: if a question can be answered by reading the code, it is not a card. That
belongs to `knowledge-plugin`'s `.ai-ready/` output, which *is* derived and
*should* be regenerated.

## 2. The five preservation rules

Anything leaving the project satisfies all five. They are cheap to check and each
one has a specific failure it prevents.

1. **Confirmed.** A hypothesis that was never validated stays in the stage
   journal. The hub is not a place to park guesses where they will read as facts.
2. **Sanitized.** No account IDs, endpoints, credentials, internal hostnames,
   NDA-covered customer names, or unmasked sample data. The project code in
   `cde.origin.project` is a slug, not the customer.
3. **Graded for generalization.** `industry-generic` travels as-is;
   `needs-recalibration` means the reasoning travels and the numbers do not. An
   ungraded card gets its thresholds copied into a context where they are wrong.
4. **Dated.** `generated.at`, every `verified[].at`, and `stale_after`. Undated
   knowledge cannot be aged, and knowledge that cannot be aged cannot be
   forgotten.
5. **Technical assertions carry their evidence.** "Service X is unavailable in
   region Y" needs the probe, the date, and the command. This is the most
   important of the five: a wrong technical claim in a shared repository gets
   reused, and reuse is invisible.

## 3. The destination decision

| The entry is… | Card type | Where it lands on import |
|---|---|---|
| a rule about *how we work* | `Practice` | `team.md`, under `cde.heading`, via `aidlc-learnings.ts persist` |
| a fact about *the domain or a platform* | `Domain Knowledge` | `spaces/<space>/knowledge/<cde.knowledge_seat>/` |
| a coherent bundle for one industry | `Knowledge Pack` | imported as a pack, with its own manifest |

`cde.class` is a second, orthogonal axis:

- **`knows`** — a fact. Wrong facts are corrected by evidence.
- **`judges`** — a boundary or a value call (a data red line, a safety limit).
  Wrong judgements are corrected by a person. Verify these first when importing;
  a stale `judges` card is the more dangerous of the two.

**There is no `org` destination.** `aidlc-learnings.ts persist` accepts only
`project` and `team`, so `cde.memory_target` is always `team`. A card that argues
for an org-level policy is legitimate content — it simply has no automatic
landing path, and escalating it is a human, framework-level decision. The plugin
deliberately ships no `proposed_tier: org` field: a field that is stored and can
never take effect misleads more than its absence does.

## 4. Writing the two body sections

```markdown
# 规则

<the rule, self-contained, imperative, with [^footnote] attribution>

# 为什么

<the reasoning, the cost, and what was given up>

[^id]: <the source, matching a sources[].id>
```

`# 规则` is the **only** range the dedupe digest covers, and it is the exact text
an importing project persists into `team.md`. Two consequences:

- Keep it self-contained. A rule that needs `# 为什么` to be intelligible arrives
  in the other project without it.
- Do not restate the `verified` history or the sources inside it. If the digest
  covered the whole card, the same rule's fingerprint would drift every time
  someone re-affirmed it, and dedupe would silently stop working.

`# 为什么` is where the price goes. A rule that travels without its tradeoff gets
applied where the tradeoff is unacceptable.

## 5. The freshness clock is arithmetic

`stale_after = max(verified[].at) + half_life(type/topic)`, from
`policy/lifecycle.json`. The validator recomputes it and compares with **zero**
days of tolerance, so:

- Re-affirming a card is two edits in one MR: append a `verified` event **and**
  move `stale_after` forward. The validator checks they agree.
- A hand-typed distant date is rejected, not believed.
- `cde.review_interval_days` overrides the policy default, and the body must say
  why. AWS-facing knowledge has the shortest half-life in the shipped policy
  (120 days) because it is the fastest-moving surface in the bundle.

Going stale is **not** deletion. It withdraws the card's *default* authority: the
importing stage must surface the warning and get a named human to re-affirm it
before use. Honest forgetting is revoking default trust, not making knowledge
disappear.

One trap worth knowing: OKF's own `is_stale` returns **false** when `stale_after`
is missing or unparseable — it fails open, so "no clock" reads as "never
expires". That is precisely why `stale_after` is a required field on our side.
The tolerance for a missing clock is where a forgetting mechanism quietly dies.

## 6. Two verdicts, kept apart

- **`okf-nonconformant`** — the three hard requirements of OKF SPEC §11
  (parseable frontmatter mapping, non-empty `type`, valid structure files).
  Rejected on both sides.
- **`cde-policy-violation`** — our house rules (required fields, the clock, deny
  patterns, dedupe, heading and seat vocabularies). Rejected when *we* produce;
  a **warning** when we consume someone else's bundle.

Keep the two labels distinct in what you say to a human. Reporting a house-rule
breach as "not OKF compliant" is wrong on the facts, and refusing a legal
third-party bundle for lacking our `cde:` block is wrong on the standard: OKF
requires consumers to tolerate missing optional fields, unknown types, unknown
extension keys, and broken links. A bundle with no `cde:` metadata is a bundle
with no CDE metadata — treat it as unverified, ask a human to complete the
provenance, and move on.

## 7. Corrections replace; they never overwrite

Editing a card in place erases the record of what the team used to believe, and
that record is often the most useful thing in the bundle. A correction is:

1. a new card with the corrected content and `cde.supersedes: <old concept ID>`;
2. the old card flipped to `status: deprecated` with a markdown link forward;
3. **both in the same merge request.**

The single-MR rule is not tidiness. Split in two, the tree spends time holding a
card that has been superseded and still reads as `stable` — and someone will read
it in that window. The old file is not moved or deleted: `deprecated` already
means "kept for links and history, no longer current", and moving it would break
the inbound links that make the trace work.
