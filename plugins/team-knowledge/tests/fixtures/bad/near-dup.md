---
type: Practice
title: Near-duplicate rule
description: Says the same thing as dup-a in different words — and is NOT detected. That is the pinned limit.
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
    project: fixture-c
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb0006
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
---

# 规则

Integration suites always target a throwaway environment that the same pipeline
job destroys afterwards, so passing tests never rely on leftovers from an earlier
execution.
