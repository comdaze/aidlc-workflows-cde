---
type: Practice
title: Deny pattern hiding inside a frontmatter value
description: The secret is in a source resource, not in the prose — rule 6 scans the whole file.
tags: [testing]
status: stable
generated: { by: process:fixture, at: 2026-08-09T00:00:00Z }
verified:
  - { by: human:alice, at: 2026-08-09 }
stale_after: 2027-02-05
sources:
  - id: s
    resource: s3://bucket/AKIAIOSFODNN7EXAMPLE/evidence.json
    title: Evidence bundle
cde:
  class: judges
  generalization: industry-generic
  origin:
    project: fixture
    intent: 260809-fixture
    stage: vibe-session
    content_key: aaaa0000bbbb0003
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Forbidden"
---

# 规则

Deny patterns are scanned over the entire file INCLUDING frontmatter. A reviewer
skims the prose; the access key rides along in a `sources[].resource`, which is
exactly where a body-only scan would miss it.
