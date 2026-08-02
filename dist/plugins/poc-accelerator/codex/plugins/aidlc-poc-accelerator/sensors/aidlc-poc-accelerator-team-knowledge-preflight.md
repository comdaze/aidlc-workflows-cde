---
id: poc-accelerator-team-knowledge-preflight
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-poc-accelerator-team-knowledge-preflight.ts
default_severity: advisory
description: Verifies the PoC team-knowledge preflight artifact records a machine-readable resolution — pack imported, user-provided source, or an explicit user skip (poc-accelerator plugin, advisory)
category: document-shape
matches: "**/{aidlc-docs,intents}/**"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  findings: string[]
  resolution: string
timeout_seconds: 5
---

# poc-accelerator-team-knowledge-preflight sensor (poc-accelerator)

ADVISORY. Fires when `poc-accelerator-team-knowledge-preflight.md` is written
(pass-through on every other stage output). Checks the artifact ends the
prose record with one fenced `yaml` block opening with `preflight:` and
verifies deterministically:

- `resolution:` is exactly one of `pack-imported`, `user-source-provided`,
  or `skipped-by-user` — silence or a missing value never passes.
- `sources_searched:` lists at least one searched path/URL (the active
  space's local knowledge seats are always searched first).
- `pack-imported` additionally requires `pack:` and `import_path:`.
- `user-source-provided` additionally requires `source:` (the approved URL
  or local path the user supplied).
- `skipped-by-user` additionally requires `decided_by:` and `reason:` — an
  explicit skip is a recorded decision, not an inference.

## Advisory note

The framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here
is REPORTED (audit rows + detail file), not enforced — the same contract as
every core sensor. The stage prose still owns asking the user for a URL/local
path or an explicit skip; this sensor makes an incomplete or silent preflight
record visible the moment the artifact is written.
