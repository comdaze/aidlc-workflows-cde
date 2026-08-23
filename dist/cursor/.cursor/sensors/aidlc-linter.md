---
id: linter
kind: deterministic
command: bun .cursor/tools/aidlc-sensor-linter.ts
default_severity: advisory
description: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs
category: code-quality
matches: "**/*.{ts,js}"
input_schema:
  file_path: string
output_schema:
  pass: boolean
  violations:
    - file: string
      line: number
      rule: string
      message: string
timeout_seconds: 30
coalesce_seconds: 120
---

# linter sensor

Wraps the project's configured linter. v0.5.0 defaults to eslint; multi-language
auto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.

Echoes Fowler's "Eslint, Semgrep" examples from the harness-engineering article.

## Cost shape and the coalesce window

The linter's cost is the project, not the written file: it resolves eslint
through `bunx` and lints from the nearest package root. Firing once per write
therefore re-pays the same price for the tenth edit of a file as for the first.
`coalesce_seconds: 120` caps that — a second fire for the same stage inside two
minutes of a PASS is deferred, counted in the coalesce ledger, and landed by
`aidlc-sensor flush` (run it before the stage's approval gate; `--doctor` reports
anything still outstanding). A fire after a FAILED one is never coalesced.

Two cheap gates run before any subprocess: an on-disk config walk (no eslint
config anywhere up the tree → immediate quiet PASS) and a memoized availability
probe. A measured PoC run spent 9 minutes across 50 fires re-discovering that
eslint was not installed; both gates exist so that answer is paid for once.

## Failure mode

Emits `SENSOR_FAILED` and writes detail to
`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-sensors/<stage-slug>/linter-<fire-id>.md`,
where the space and intent come from the active cursors. The fire id is the
8-hex correlator from the `SENSOR_FIRED` row in the active record's
`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured
output (file, line, rule, message per violation).

## v0.6.0 carry-forward

Multi-language detection at framework boundary (read project type from
practices `## Tech Stack` section, dispatch appropriate linter).
