---
type: Domain Knowledge
title: Knowledge seat that does not exist
description: Names an agent seat that is not in the installed roster.
tags: [testing]
status: stable
generated: { by: process:fixture, at: 2026-08-09T00:00:00Z }
verified:
  - { by: human:alice, at: 2026-08-09 }
stale_after: 2027-08-09
sources:
  - id: s
    resource: docs/fixture.md
cde:
  class: knows
  generalization: needs-recalibration
  origin:
    project: fixture
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb000b
    content_key_scope: team
  sanitization: { by: human:alice, at: 2026-08-09 }
  knowledge_seat: aidlc-turbine-agent
---

# 领域事实

A Domain Knowledge card lands in `spaces/<space>/knowledge/<seat>/`. A seat that
does not exist means the card lands in a directory no agent ever loads — present
on disk, invisible at runtime.
