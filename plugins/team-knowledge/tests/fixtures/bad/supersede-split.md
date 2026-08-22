---
type: Practice
title: Successor landing without its predecessor flipped
description: Declares cde.supersedes, but the target card is still marked stable — the split-MR trap.
tags: [testing]
status: stable
generated: { by: process:fixture, at: 2026-08-09T00:00:00Z }
verified:
  - { by: human:alice, at: 2026-08-09 }
stale_after: 2027-02-05
sources:
  - id: s
    resource: docs/fixture.md
cde:
  class: judges
  generalization: industry-generic
  origin:
    agent_system: aidlc
    project: fixture
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb0008
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
  supersedes: supersede-target
---

# 规则

A replacement card and the deprecation of what it replaces land in ONE merge
request. Split across two, the tree spends time holding a card that is superseded
and still reads as authoritative — see [supersede-target](supersede-target.md).
