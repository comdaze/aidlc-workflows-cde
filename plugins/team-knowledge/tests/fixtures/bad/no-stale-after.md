---
type: Domain Knowledge
title: No freshness clock at all
description: stale_after is absent, so OKF's is_stale fails open and this card never expires.
tags: [testing]
status: stable
generated: { by: process:fixture, at: 2026-08-09T00:00:00Z }
verified:
  - { by: process:some-pipeline, at: 2026-08-09 }
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
    content_key: aaaa0000bbbb000d
    content_key_scope: team
  sanitization: { by: human:alice, at: 2026-08-09 }
  knowledge_seat: aidlc-shared
---

# 领域事实

Two things are pinned by this card at once. `is_stale` returns FALSE for a missing
`stale_after` — the reference implementation fails open, so "no clock recorded"
reads as "never expires", which is the hole the forgetting mechanism would quietly
fall through. And because every `verified[].by` here is a `process:` actor and not
a `human:` one, the derived trust tier is `machine-confirmed`, not
`human-reviewed`.
