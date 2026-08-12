---
title: No type at all
description: The one field OKF SPEC §11 makes mandatory is missing.
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
  class: knows
  generalization: industry-generic
  origin:
    project: fixture
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb0001
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
---

# 规则

A concept with no `type` is not an OKF concept — this is the only strictness the
reference parser's own `validate()` enforces, and it is rejected on BOTH sides.
