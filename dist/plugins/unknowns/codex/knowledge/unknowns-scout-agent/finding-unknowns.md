# Finding unknowns

> Methodology for the `unknowns` plugin. Distilled, with attribution, from Thariq
> Shihipar's essay "A field guide to Claude Fable 5: Finding your unknowns"
> (Anthropic, Claude Code team) — the map/territory framing, the four-way
> breakdown, and the fail-both-ways argument are his. Content was rephrased for
> compliance with licensing restrictions.

## The gap that matters

The prompt, the stage artifacts, the design docs — that is the **map**. The
codebase, the production constraints, the decisions nobody wrote down, the taste
that was never articulated — that is the **territory**. Where they disagree, the
agent has no choice but to guess, and the more work it does per instruction the
more of those guesses accumulate unexamined.

The consequence is uncomfortable for a framework built out of stages: a stronger
model does not shrink that gap. It makes the gap the dominant term, because
everything else it used to be blamed for has gotten better.

## The four kinds, and which one actually hurts

| | Meaning | Where it shows up here |
| --- | --- | --- |
| **Known knowns** | What the human wrote down | Requirements, acceptance criteria |
| **Known unknowns** | Open questions they know are open | `## Assumptions & Open Questions`, the composer's UA dimension |
| **Unknown knowns** | Standards so obvious to them they were never written, but they would recognise a violation instantly | Nowhere — this is the expensive one |
| **Unknown unknowns** | Not considered at all | Nowhere — the composer *estimates* it (CSU) but nothing searches for it |

The framework handles the top two well and is structurally blind to the bottom
two. That blindness is the reason this plugin exists.

## Failing in both directions

The failure is not "too vague". It is **not accounting for the unknowns**, which
produces two opposite-looking failures:

- **Too vague** — the agent falls back on industry defaults. Defaults are
  reasonable in general and wrong here, which is exactly what makes them hard to
  catch: nothing looks broken.
- **Too specific** — the agent follows the instruction past the point where a
  different approach was clearly better. A tight, confident, wrong specification
  reads as professional work.

This matters more in AIDLC than in a bare chat session, because this framework is
a machine for producing very specific maps. Stages, required sections, sensors,
gates — all of it pushes toward more specification. There is a measured dimension
for ambiguity (IAE) and none for its opposite. So the over-specification check is
not a nice-to-have here; it is the missing half of a check the framework already
performs in one direction.

## Why calibration comes before evaluation

Every approval gate in this framework asks the human a question it never checks
they can answer: *is this good?*

When the human cannot yet say what good looks like in a domain, the gate does not
fail loudly — it passes. They approve, because nothing looks wrong, and the gate
becomes theatre while still producing an audit row that says a human reviewed it.
That is worse than no gate, because the record now overstates what happened.

Generating options does not fix it. Showing five variations to someone who cannot
rank them produces a coin flip with extra steps. The move that works is to raise
the human's evaluative capacity first — the vocabulary, the few dimensions that
matter, and concrete contrasts at each — and only then ask them to judge.

One caution that follows directly from the fail-both-ways argument: the ladder you
build may itself be the industry default. When the human's ranking disagrees with
yours, that disagreement is data about this specific domain. Record it as an open
question. Do not resolve it in your own favour.

## Deviating during implementation

No plan survives contact with the code, so the question is never whether the plan
was wrong — it is whether the disagreement left a trail.

Classify before acting:

- **Reversible** — take the most reversible option, log it (what the plan said,
  what you did, why, what it would take to revisit), and keep going. Do not block
  a human on a decision you can undo.
- **Irreversible or scope-changing** — stop at a safe checkpoint and ask. Cheap
  deviation is fine; expensive deviation needs a human.

"Conservative" means reversible, not simple. And an unlogged deviation is worse
than no log at all, because the log claims completeness — the next reader trusts
it precisely where it is silent.

## The discipline that keeps this cheap

Every artifact here is scaffolding. It exists to change what happens next and then
to die with the intent. Three habits protect that:

1. **Absence is a valid finding.** A scan that must produce findings will produce
   fabricated ones, and the reader learns to discount all of them.
2. **Rank by blast radius.** Architecture-changers first, behaviour-definers next,
   naming and cosmetics dropped rather than listed.
3. **Nothing downstream depends on these artifacts being maintained.** The moment
   a blindspot register has to be kept current, it has become a liability with a
   filename.
