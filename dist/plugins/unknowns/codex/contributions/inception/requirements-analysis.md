---
target: requirements-analysis
plugin: unknowns
adds:
  required_sections:
    - "Over-Specification Risks"
fragments:
  - anchor: after-step:6
    order: 100
---

## fragment: after-step:6

### Step 6b (unknowns): Over-Specification Analysis

Step 6 asked what is **missing**. Ask the symmetric question, which the six
dimensions do not cover: what is specified so tightly that it forecloses an
approach that would be clearly better?

Both directions are the same defect — unaccounted-for unknowns — and they fail
differently. Under-specified requirements get filled with industry defaults that
are reasonable in general and wrong here. Over-specified ones get followed past
the point where a pivot was obviously right. The second is harder to catch,
because a tight, confident, wrong requirement reads as good work.

Walk the requirement set and classify every prescriptive statement — one that
names a mechanism, a technology, a data shape, an interaction, or a threshold:

- **Real constraint** — it is a fact about the world the project must live in: a
  regulation, an existing contract, a system that will not change, a measured
  limit. Keep it, and attach the reason. A constraint carrying its reason can be
  correctly re-evaluated later; one without a reason gets obeyed forever or
  discarded on a whim.
- **Incidental choice** — it was someone's first idea and got written down in the
  grammar of a decision. This is the expensive category, because nothing about the
  text distinguishes it from the row above. Turn each one into a Step 7 clarifying
  question that asks whether the specific mechanism is required or whether the
  outcome is what matters.

Record the analysis under an `## Over-Specification Risks` heading in the
requirements output. For each entry: the requirement as written, the approach it
rules out, the classification, and — for a real constraint — the reason it is real.

Two guardrails:

- **Do not relax anything yourself.** This step surfaces a tension; the human
  resolves it. An agent that quietly reinterprets a requirement it judged
  incidental has produced exactly the silent-guess failure this analysis exists to
  prevent.
- **An empty result is a valid result.** Write "no over-specification risks
  identified" when that is true. Manufacturing a risk trains the reader to skim
  the section, which costs more than the section is worth.
