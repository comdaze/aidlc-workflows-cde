---
id: type-check
kind: deterministic
command: bun .aidlc/tools/aidlc-sensor-type-check.ts
default_severity: advisory
description: Wraps the project's configured type-checker (tsc by default for v0.5.0); fires on TS/TSX code outputs
category: code-quality
matches: "**/*.{ts,tsx}"
input_schema:
  file_path: string
output_schema:
  pass: boolean
  errors:
    - file: string
      line: number
      column: number
      message: string
timeout_seconds: 60
coalesce_seconds: 120
---

# type-check sensor

Wraps the project's configured type-checker. v0.5.0 defaults to tsc;
multi-language auto-detection (mypy, go vet, cargo-check) is deferred
to v0.6.0+.

Echoes Fowler's "type checkers" example from the harness-engineering article.

## Cost shape and the coalesce window

`tsc --project` type-checks the WHOLE project and the sensor then filters the
diagnostics down to the written file — correct semantics (cross-file inference
demands it), but it means the cost tracks project size, not edit size, and every
write re-pays it. `coalesce_seconds: 120` defers a re-fire for the same stage
inside two minutes of a PASS, records it in the coalesce ledger, and leaves
`aidlc-sensor flush` to land it before the stage's approval gate (`--doctor`
reports anything still outstanding). A fire after a FAILED one is never
coalesced, so the write that carries the fix is always checked.

The `tsc --version` probe is memoized per anchor dir for the same reason.

## Failure mode

Emits `SENSOR_FAILED` and writes detail to
`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-sensors/<stage-slug>/type-check-<fire-id>.md`,
where the space and intent come from the active cursors. The fire id is the
8-hex correlator from the `SENSOR_FIRED` row in the active record's
`audit/<host>-<clone-id>.md` shard. The detail contains the type-checker's
structured output.

## v0.6.0 carry-forward

Multi-language detection at framework boundary (read project type from
practices `## Tech Stack` section, dispatch appropriate type-checker).
