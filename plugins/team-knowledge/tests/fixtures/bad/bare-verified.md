---
type: Domain Knowledge
title: Verified as a bare mapping, not a list
description: SPEC §5.2 says a bare mapping counts as a single-element list — this card must NOT be faulted for it.
tags: [testing]
status: stable
generated: { by: process:fixture, at: 2026-08-09T00:00:00Z }
verified: { by: human:alice, at: 2026-08-09 }
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
    content_key: aaaa0000bbbb000c
    content_key_scope: team
  sanitization: { by: human:alice, at: 2026-08-09 }
  knowledge_seat: aidlc-shared
---

# 领域事实

`normalize_verified` in the OKF reference parser promotes a bare mapping to a
single-element list, and the SPEC states that as a MUST. This card is otherwise
clean: it exists so the port is pinned, and so nobody "tidies up" the
normalisation into a type error.
