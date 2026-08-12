---
type: Domain Knowledge
title: A perfectly legal OKF card with no CDE metadata
description: What a third-party bundle looks like — produce rejects it, consume only warns.
tags: [testing]
status: stable
generated: { by: someones-tool/1.0, at: 2026-08-09T00:00:00Z }
verified:
  - { by: human:carol, at: 2026-08-09 }
stale_after: 2027-08-09
sources:
  - id: s
    resource: docs/fixture.md
---

# 领域事实

This card is legal OKF: parseable frontmatter, a non-empty `type`, and nothing
else required by the standard. It carries no `cde:` block, because whoever wrote
it never heard of ours.

On the produce side that is a policy violation — our own cards must be traceable.
On the consume side it means "this bundle has no CDE metadata": treat it as
unverified, have a human complete the provenance, and do NOT refuse the bundle.
OKF §11 requires exactly that tolerance of consumers.
