---
type: Practice
title: The card that should have been deprecated
description: Still stable while supersede-split claims to replace it.
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
    project: fixture
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb0009
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
---

# 规则

This card is the supersession target used by the split-MR fixture. It is
intentionally left at `status: stable` so the validator has something to catch.
