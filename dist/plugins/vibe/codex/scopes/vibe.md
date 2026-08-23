---
name: vibe
plugin: vibe
depth: Minimal
# Deliberately empty. A free-form session must be asked for explicitly — a scope
# that answers to keywords would hijack requests meant for a real workflow, and
# "vibe" is exactly the kind of word a user types casually.
keywords: []
description: Free-form coding in a parked container that still sediments memory and knowledge
skeleton: off
runner: true
---

# vibe scope

One stage, no rails. The scope exists to hold a session where **you** drive and
the framework does only the two things worth keeping from a workflow: it loads
what the project already knows, and it gives what you learn a reviewed way back
into memory.

## Why one stage, why no gates

Every other scope answers "what should be built next?" by resolving a stage
plan. This one answers a different question — "how do I keep the accumulated
context without accepting the rails?" — so a plan is the wrong shape. The single
stage is a **container**, not a step: it opens, stays open while you work, and
closes only when you say so.

The consequence to understand before using it: this scope makes **no claim about
what you built**. No requirements were captured, no design was reviewed, no
acceptance criteria exist, so nothing here can be cited as evidence that the
result is correct or complete. If you need that claim, run `feature`, `mvp`, or
`enterprise` — this scope deliberately cannot produce it.

## What you still get

- **Memory, read.** The layered practice files (`org` → `team` → `project` →
  phase) reach the model through each harness's own always-on include. That is
  true in any session, workflow or not — this scope simply does not take it away.
- **Knowledge, read.** The stage declares a lead agent, so that agent's
  knowledge seat loads exactly as it does in any other stage.
- **Learnings, written through the gate.** On request, the §13 ritual surfaces
  candidates from the session diary and persists the ones you confirm. That path
  brings the three things hand-editing memory cannot: a conflict check against
  broader policy, idempotency, and a paired audit row that answers "where did
  this rule come from?".
- **Audit.** Stage start, artifact writes, learnings, and close-out land in the
  audit trail like any other stage.

## Activation

Three equivalent entries. They differ only in who opens the container:

```text
/vibe <what you are about to work on>
# or
/aidlc --scope vibe <what you are about to work on>
```

Or, in Kiro, pick **`aidlc-vibe`** from the agent picker and just start talking —
that agent's prompt opens the container on its first turn. Same stage, same
sedimentation path, no command to remember. The picker entry is the Kiro surface
only; on the other harnesses the scope commands above are the way in.

One session per container. After close-out the workflow completes and the
container is gone — sedimenting again means opening a new session, which is the
honest boundary: a closed session's diary has already been harvested.

"One stage" describes what *this plugin* contributes, not a guarantee about the
grid. Another plugin may put a stage on this scope, and one does: with
`team-knowledge` installed, `team-knowledge-push` (4.95, operation) follows
close-out and offers to publish the rules you just confirmed to a shared team hub.
It is `CONDITIONAL` and self-skips without a hub URL. The line that must hold is
not the stage count — it is that **nothing gates the session itself**, which is why
its sibling `team-knowledge-pull` (2.95, inception, human shortlist gate) is
deliberately kept off this scope.
