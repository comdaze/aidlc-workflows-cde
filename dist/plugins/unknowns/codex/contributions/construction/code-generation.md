---
target: code-generation
plugin: unknowns
fragments:
  - anchor: in:Learn
    order: 100
---

## fragment: in:Learn

### Deviation discipline (unknowns)

The four headings above say what to record. They do not say what to **do** when
the code disagrees with the design — and that gap is where the unknowns of an
implementation are either captured or lost. Some unknowns only appear once the
files are open; the plan being wrong in places is normal, so the only question
that matters is whether the disagreement left a trail.

Classify before you act:

- **Reversible** — take the most reversible option available, log it under
  **Deviations**, and keep going. Do not stop for a decision you can undo; a
  session that blocks on every surprise costs more than the surprises. The entry
  needs four things: what the design said, what you did instead, why, and what it
  would take to revisit. The fourth is the one that gets skipped and the one the
  next session actually needs.
- **Irreversible or scope-changing** — stop at a safe checkpoint and ask. Log it
  under **Open questions** with the options you see. Deviating cheaply is fine;
  deviating expensively needs a human. A data migration, a public contract, a
  deleted column, and a new external dependency are all in this category even when
  they look like the obvious move.

**Conservative means reversible, not simple.** The simpler option is sometimes the
one that is harder to back out of, and picking it because it is smaller is not
conservatism.

**An unlogged deviation is worse than no log.** A log claims completeness, so the
next reader trusts it exactly where it is silent — they will conclude the
implementation followed the design everywhere the file does not say otherwise.
That is a worse starting position than knowing there is no record at all.

One thing not to write down: what the diff already shows. "Renamed the handler" is
in git. The entry worth making is why the design's shape did not survive contact
with the code.
