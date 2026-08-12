---
type: Domain Knowledge
title: Region-availability checks must be probed, never assumed
description: Service and model availability differs by partition; record the probe, the command, and the date.
tags: [aws, aws-cn]
status: stable
generated: { by: process:aidlc-akp-push, at: 2026-08-09T11:00:00Z }
verified:
  - { by: human:bob, at: 2026-08-09 }
stale_after: 2026-12-07
sources:
  - id: probe
    resource: all region-availability probes recorded in this engagement's deployment log
    title: Deployment log probes
    last_modified: 2026-08-09
cde:
  class: knows
  generalization: industry-generic
  origin:
    project: agentic-power-trading
    intent: 260809-mock-dataset
    stage: poc-accelerator-step-03-environment-readiness
    content_key: 41b7c2d9ee0a3f55
    content_key_scope: team
  sanitization: { by: human:bob, at: 2026-08-09 }
  knowledge_seat: aidlc-aws-platform-agent
---

# 领域事实

Service, model, and API-surface availability differs between partitions and
between regions inside a partition. A capability is only "available" once it has
been probed in the target region, with the command and the date recorded.[^probe]

# 为什么

This card carries the shortest half-life in the bundle (120 days) because it is
the fastest-moving surface: an availability fact that was true last quarter is not
evidence today. `sources[].resource` here is a range descriptor rather than a
path, which OKF explicitly allows — so it is never resolved as a link.

[^probe]: Deployment log probes
