---
type: Practice
title: Mock market data must be fully synthetic and parameterised
description: Demo and backtest data must not statistically fit or numerically excerpt customer files.
tags: [mock-data, data-boundary, power-trading]
status: stable
generated: { by: aidlc-vibe/2.5.59, at: 2026-08-09T09:51:56Z }
verified:
  - { by: human:alice, at: 2026-08-09T09:51:56Z }
stale_after: 2027-02-05
sources:
  - id: session
    resource: feedback/agentic-power-trading/2026-08-09.json
    title: Sedimentation session record
    author: human:alice
    last_modified: 2026-08-09
cde:
  class: judges
  generalization: industry-generic
  origin:
    project: agentic-power-trading
    intent: 260809-mock-dataset
    stage: vibe-session
    content_key: e8b664a0a7862232
    content_key_scope: project
  sanitization: { by: human:alice, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
---

# 规则

Mock market data must be generated fully synthetically from parameters (with a
reproducible seed); parameters may only take public, domain-common values (price
caps, intraday shape). No statistical fitting against customer files and no
numerical excerpting of them. The mock file keeps the original filename and an
equivalent structure, so swapping the data directory needs zero code
changes.[^session]

# 为什么

Fitting carries customer values out of the delivery site as statistical
features — formally "no data was copied", substantively a leak. The price is that
backtest metrics on mock data are not comparable with the real market, and that
caveat must travel with the rule.

[^session]: Sedimentation session record
