---
title: Key order shuffled by a human editor
type: Domain Knowledge
tags: [testing]
description: Everything required is present, only the top-level key order deviates from §6.4.
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
  generalization: industry-generic
  origin:
    project: fixture
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb000e
    content_key_scope: team
  sanitization: { by: human:alice, at: 2026-08-09 }
  knowledge_seat: aidlc-shared
---

# 领域事实

The fixed key order exists so that appending one `verified` event produces a
one-line diff instead of a reordered block. A human editor shuffling it is a
WARNING, not a rejection — the writer's own self-check is where it must never
happen.
