# unknowns

Find the unknowns before they get expensive.

The prompt, the requirements, the design docs — that is the **map**. The codebase,
the production constraints, the decisions nobody wrote down, the taste nobody
articulated — that is the **territory**. Where they disagree the agent guesses, and
a stronger model does not shrink that gap; it makes the gap the dominant term,
because everything else has gotten better.

This plugin adds the two checks the framework is structurally blind to, and skips
the ones it already performs.

## The design constraint, first

**Everything this plugin produces is scaffolding that dies with the intent.**

That is a hard constraint, not a preference. The techniques this plugin implements
work because they are cheap and throwaway; AIDLC's instinct is artifact + gate +
sensor + audit row, and applying that instinct here would make them expensive,
which destroys the property that made them work. So:

- No downstream stage requires an `unknowns-*` artifact.
- Nothing here is meant to be maintained, updated, or carried into the outcomes
  pack.
- Both stages are `CONDITIONAL` and self-skip in one step. The skip is the normal
  case, and the skip reason carries the finding that justified it.

If a `unknowns-*` artifact ever needs keeping current, it has become a liability
with a filename. Delete it.

## What it ships

### Two stages (ideation)

| Stage | What it does | Skips when |
| --- | --- | --- |
| `unknowns-blindspot-pass` | Scouts territory the human does not know: landmines, the constraints nobody wrote down, what good looks like, the questions an expert would ask — and a rewritten version of the request. Reads only; edits nothing. | The human reports working expertise in every area the work touches |
| `unknowns-calibration` | Raises the human's ability to judge one domain **before** a downstream gate asks them to approve work in it: vocabulary, 3–5 dimensions of good with concrete contrasts, and a check that they can actually apply them | The human can already name the dimensions they will judge on |

`unknowns-calibration` is the one to care about. Every approval gate in this
framework asks the human a question it never verifies they can answer — *is this
good?* — and when they cannot yet say what good looks like, the gate does not fail
loudly. It passes. The gate becomes theatre and still emits an audit row saying a
human reviewed it, which is worse than no gate because the record now overstates
what happened. This stage is the cheapest available fix, and unlike a
post-implementation quiz it strengthens machinery that already exists rather than
sitting beside it.

Both stages sit in **ideation**, which is deliberate and also a mechanical
constraint: a plugin stage is numbered after every core stage in its phase, so
placing them in inception would have put them *after* `application-design` — too
late to inform the design they exist to inform. In ideation they run at the
ideation/inception boundary, before requirements and design commit.

### Two contributions

| Target | Anchor | What it adds |
| --- | --- | --- |
| `requirements-analysis` | `after-step:6` | The **over-specification** check — the symmetric half of Step 6's completeness analysis |
| `code-generation` | `in:Learn` | The **deviation decision rule** — reversible: take the conservative option, log, continue; irreversible or scope-changing: stop at a safe checkpoint |

The over-specification check is the sharpest idea in the source essay: under- and
over-specification are the same defect (unaccounted-for unknowns) failing in two
directions. Too vague and the agent uses industry defaults that are reasonable in
general and wrong here; too specific and it follows the instruction past the point
where a pivot was clearly right. The second is harder to catch because a tight,
confident, wrong requirement reads as good work — and AIDLC is a machine for
producing very specific maps, with a measured dimension for ambiguity (the
composer's IAE) and none for its opposite.

### One agent + its knowledge

`unknowns-scout-agent` — a scout, not a producer. Every other seat exists to
create something; this one exists to make visible what the human did not know they
needed to say. Its governing rule: **absence is a valid finding.** A scout that
must always return something will invent something.

## What it deliberately does not ship

- **No merge quiz.** A quiz written and graded by the same agent that wrote the
  code is a structural conflict of interest, and prose guardrails against
  sycophancy do not survive a strong gradient. It also overlaps the existing
  reviewer seats and gates. `unknowns-calibration` attacks the same problem
  earlier, where it is cheaper — which is the source essay's own argument. If a
  quiz lands in a later version, it must be authored by a review-only seat.
- **Nothing for `application-design`.** Its ADR format already records
  alternatives considered, trade-offs, and a reversibility assessment, and its
  architecture-options block already forces the comparison. A "foreclosed
  alternatives" section there would be a second copy of an existing mechanism.
- **No implementation-notes stage.** Core already has the diary: `## Learn` in every
  stage, four fixed headings, ISO 8601 timestamps, routed into the memory layer
  through the §13 admission gate. This plugin adds the missing decision rule and
  nothing else.
- **No interview stage.** `intent-capture` already generates and collects
  clarifying questions.

## Cost when enabled

Two extra rows in the `enterprise` / `feature` / `mvp` scope grids. Both are
`CONDITIONAL` and self-skip after one question, so the expected cost on a run
where they do not apply is two short exchanges. That is the intended trade: a
blindspot pass that fires only when the human remembers to ask for it is
self-defeating — not knowing you need it is the definition of the category.

`poc` is excluded on purpose. So is every scope not listed.

## Attribution

The method is distilled, with attribution, from Thariq Shihipar's essay
[A field guide to Claude Fable 5: Finding your unknowns](https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns)
(Anthropic, Claude Code team). The map/territory framing, the four-way breakdown of
unknowns, the fail-both-ways argument, the conservative-deviation rule, and the
observation that generating options is useless to someone who cannot rank them are
his. The stage mechanics, the gate wiring, the calibration-check protocol, and
everything specific to AIDLC are not.

Content was rephrased for compliance with licensing restrictions.

## Tests

```bash
bun test plugins/unknowns/tests/plugin.test.ts
```
