---
id: poc-accelerator-team-knowledge-deposit
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-poc-accelerator-team-knowledge-deposit.ts
default_severity: advisory
description: Verifies the PoC knowledge-deposit artifact records a probed team-knowledge git repository URL, an approved non-empty entry list, and how the harvest was submitted (poc-accelerator plugin, advisory)
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

# poc-accelerator-team-knowledge-deposit sensor (poc-accelerator)

ADVISORY. Fires when `poc-accelerator-team-knowledge-deposit.md` is written
(pass-through on every other stage output). This is the closing end of the
team-knowledge loop the `poc-accelerator-team-knowledge-preflight` sensor
opens, and it is deliberately **independent** of it: step 08 owes a deposit
whether or not step 01 ran, so this check never consults the preflight record.

Checks the artifact ends the prose record with one fenced `yaml` block opening
with `deposit:` and verifies deterministically:

- `resolution:` is exactly one of `merge-request-opened`, `branch-pushed`, or
  `patch-prepared` — there is no skip value, and no "nothing to deposit".
- `repo_url:` is present and shaped like a git remote — `https://`,
  `http://`, `ssh://`, `git://`, `file://`, or the scp-like
  `git@host:team/repo.git`, each with a non-empty path. A bare local
  directory is rejected: a deposit has to be pushed somewhere others read.
- `repo_probe:` is exactly `git-ls-remote-ok`. A failed probe means the stage
  asks for a URL that works, not that the deposit is done.
- `entries:` lists at least one promoted entry — an empty harvest is not an
  outcome of a delivered PoC.
- `sanitization_approved_by:` names who approved what left the engagement.
- `merge-request-opened` additionally requires `branch:` and `review_url:`.
- `branch-pushed` additionally requires `branch:` and `owner:` (who opens the
  merge request).
- `patch-prepared` additionally requires `patch_path:`, `owner:`, and
  `blocked_reason:` — a refused push is an owned handoff with a named reason.

`repo_url_source:` is checked when present (`preflight-artifact`,
`memory-layer`, or `user-provided`) and reported as a finding otherwise.

## Optional team-knowledge delegation

When the `team-knowledge` plugin is installed, step 5 also authors the
harvest as OKF v0.2 cards and runs that plugin's validator in produce mode before
pushing. Two extra fields record it, and both are checked **only when present**:

- `validate:` must be `akp-validate-ok` — a recorded validator run has to be a
  passing one; a failing gate is fixed, not reported.
- `cards:` lists OKF card concept IDs, and a non-empty list requires
  `validate: akp-validate-ok`, so an unvalidated card never reaches a reviewer.

`entries:` stays required either way. A record written without that plugin omits
both new fields and is judged exactly as it was before — the composer does not
enforce `dependencies`, so `poc-accelerator` has to stay valid on its own.

## Advisory note

The framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here
is REPORTED (audit rows + detail file), not enforced — the same contract as
every core sensor. The stage prose owns resolving the URL, obtaining the
sanitization approval, and pushing the branch; this sensor makes a handoff
that quietly kept the harvest inside the workflow record visible the moment
the artifact is written.
