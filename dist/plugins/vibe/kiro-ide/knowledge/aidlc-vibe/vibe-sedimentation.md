# Sedimentation in a free-form session

Loaded by the `vibe-session` stage. It answers one question — **where does a thing
you just learned belong?** — because in a session with no rails, that decision is
the only structure left, and getting it wrong is how a memory layer rots.

## The four destinations, and how to tell them apart

The test is never "what is this about?" It is **"who maintains it, what does it
travel with, and who reads it?"**

| Destination | Put here when | Reader |
| --- | --- | --- |
| **Session diary** (`memory.md`) | It is an observation about *this* session — a judgement call, a rejected route, a surprise. Default destination; everything starts here. | The next sedimentation pass |
| **Project memory** (`project.md`) | It is a **rule** that will hold for the rest of *this* project and can be checked mechanically. "Deployments use eu-central-1." | Every future session in this project |
| **Team memory** (`team.md`) | Same, but it holds beyond this project. Promote sparingly — a team rule you cannot defend to a colleague is noise with authority. | Every project the team runs |
| **Knowledge layer** (space `knowledge/<agent-seat>/`) | It is **prose that needs understanding**, not a rule to check: a domain fact, a technique, how someone else's system behaves. | The agent seat you file it under |

Two distinctions carry most of the weight:

**Rule vs. knowledge.** If it can be mechanically judged ("must", "never",
"always"), it is a rule and belongs in memory, where the admission gate can catch
it contradicting a broader policy. If it needs to be read and understood, it is
knowledge and belongs in the knowledge layer, where it loads per agent seat. Rules
and knowledge have different upgrade paths and different conflict semantics;
filing one as the other is why "we have documentation" coexists with "nobody
follows it".

**Project vs. team.** Ask: would this be true on the next project with a different
customer? If you hesitate, it is project-level. Over-promotion is the more common
error and the more expensive one, because a wrong team rule is applied silently
somewhere you are not watching.

## Write it through the tool, not by hand

Editing `project.md` directly is faster and worse. The learnings tool gives three
things you cannot get by hand:

1. **Conflict check.** A project rule contradicting an org guardrail is refused
   before it reaches disk. Hand-editing produces a memory layer that argues with
   itself, and the model resolves that argument silently, differently each time.
2. **Idempotency.** Re-running writes nothing twice. Hand-editing accumulates
   near-duplicates that slowly turn the layer into something nobody will read.
3. **A `RULE_LEARNED` audit row.** Six months later, "why do we do it this way?"
   has an answer with a date and a session attached. Without it, every rule looks
   equally authoritative — including the one someone typed while tired.

## Five conservation rules for anything leaving the session

Applied when promoting out of the diary, and non-negotiable for anything reaching
the knowledge layer, because that is what other people inherit:

1. **Confirmed before promoted.** An assumption you have not checked stays in the
   diary. The diary is allowed to be wrong; the memory layer is not.
2. **Sanitized.** No customer identifiers, account numbers, endpoints,
   credentials, or unmasked data. Ever, in any layer.
3. **Generalization-graded.** Say which parts are general and which need
   recalibration for a new context. The next reader must know what to trust
   directly and what to re-verify.
4. **Dated.** Every entry carries when it was learned or corrected. An undated
   claim cannot be aged out, and a layer nothing ages out of only grows.
5. **Technical claims carry their evidence.** "Service X is unavailable in region
   Y" needs the probe that showed it, not a memory of a conversation. A wrong
   technical claim, once promoted, costs far more to remove than it cost to verify
   — it gets reused, and the reuse is invisible.

## What not to record

A layer stays useful by refusing entries, not by collecting them:

- **What the diff already says.** "Added a retry to the client" is in git. The
  entry worth writing is *why* retrying was the right answer here.
- **Session mechanics.** Which tool you ran, what you renamed. Real, and worth
  nothing next month.
- **Transient facts.** A service outage, a colleague on leave. Leave them in the
  diary where they age out with the session.
- **Anything you would not defend.** If you cannot say why the next session should
  believe it, the honest destination is the diary — or the bin.

> A free-form session earns its keep at the moment of sedimentation. Everything
> before that is just work; this is the part that makes the next session start
> ahead of this one. And the way to keep it valuable is to be **stingy** — the
> failure mode of a memory layer is never too little, it is a pile nobody dares
> delete from.
