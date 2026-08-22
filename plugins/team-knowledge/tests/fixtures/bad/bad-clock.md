---
type: Practice
title: Hand-typed freshness clock
description: stale_after was chosen by hand instead of derived from the policy half-life.
tags: [testing]
status: stable
generated: { by: process:fixture, at: 2026-08-09T00:00:00Z }
verified:
  - { by: human:alice, at: 2026-08-09 }
stale_after: 2099-01-01
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
    content_key: aaaa0000bbbb0002
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
---

# 规则

Freshness is arithmetic, not intent: max(verified.at) + the policy half-life,
compared with zero days of tolerance. A card that declares itself fresh until
2099 is asserting immortality, and rule 5 is what turns that from a habit into a
mechanical failure.
