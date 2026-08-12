---
type: Practice
title: Duplicate rule A
description: Same normalised rule text as duplicate B.
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
    project: fixture-a
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb0004
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
---

# 规则

Every integration test must run against a disposable stack that is torn down in
the same job, so a green suite can never depend on state a previous run left
behind.
