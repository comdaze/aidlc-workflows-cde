---
type: Practice
title: Duplicate rule B
description: Same normalised rule text as duplicate A, only the line wrapping differs.
tags: [testing]
status: stable
generated: { by: process:fixture, at: 2026-08-09T00:00:00Z }
verified:
  - { by: human:bob, at: 2026-08-09 }
stale_after: 2027-02-05
sources:
  - id: s
    resource: docs/fixture.md
cde:
  class: judges
  generalization: industry-generic
  origin:
    agent_system: aidlc
    project: fixture-b
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb0005
    content_key_scope: project
  sanitization: { by: human:bob, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
---

# 规则

Every integration test must run against a disposable stack that is torn down in the same job, so a green suite can never depend on state a previous run left behind.
