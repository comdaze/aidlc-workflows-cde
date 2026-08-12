---
type: Practice
title: Heading and memory target both out of vocabulary
description: Targets a heading team.md does not ship, and asks to be written to org.md.
tags: [testing, plasma-physics]
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
    content_key: aaaa0000bbbb000a
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: org
  heading: "## House Rules"
---

# 规则

`org.md` has no write path in `aidlc-learnings.ts persist` (§10.1), so a card
asking for it is asking for something the framework cannot do. The heading
vocabulary is a house rule against heading sprawl — `persist` would happily
create "## House Rules" and nobody would ever look there. The out-of-vocabulary
tag on this card is a WARNING only, by design.
