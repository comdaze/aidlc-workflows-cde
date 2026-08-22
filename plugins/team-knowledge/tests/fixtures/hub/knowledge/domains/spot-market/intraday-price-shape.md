---
type: Domain Knowledge
title: Provincial spot market intraday price shape
description: Twin load peaks, midday solar suppression, and the evening ramp — causes and typical bands.
tags: [power-trading, spot-market]
status: stable
generated: { by: human:alice, at: 2026-08-09T10:00:00Z }
verified:
  - { by: human:alice, at: 2026-08-09T10:00:00Z }
stale_after: 2027-08-09
sources:
  - id: rules
    resource: https://example.com/provincial-spot-market-rules
    title: Provincial spot market operating rules
    last_modified: 2026-03-01
cde:
  class: knows
  generalization: needs-recalibration
  origin: { agent_system: aidlc, project: agentic-power-trading, intent: 260809-mock-dataset,
            stage: vibe-session, content_key: 70e94c13bfa0f8ca,
            content_key_scope: project }
  sanitization: { by: human:alice, at: 2026-08-09 }
  knowledge_seat: aidlc-shared
---

# 领域事实

Intraday clearing prices follow a twin-peak load curve. Midday solar output
suppresses the trough; the evening ramp is steepest between the solar rolloff and
the second load peak.[^rules]

# 校准提示

The bands are province-specific and the card is graded
`needs-recalibration`: reuse the shape and the causal story, re-derive every
number from the target market's own published clearing data.

[^rules]: Provincial spot market operating rules
