---
type: Practice
title: Deprecated with nowhere to go
description: Marked deprecated but links to no successor card.
tags: [testing]
status: deprecated
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
    content_key: aaaa0000bbbb0007
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Corrections"
---

# 规则

Deprecating a card without naming its successor leaves a reader with a dead end:
the rule is no longer current and nothing says what replaced it. §4.4 is why the
file is not moved either — the inbound links have to keep resolving.
