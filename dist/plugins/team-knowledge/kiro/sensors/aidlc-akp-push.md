---
id: akp-push
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-akp-push.ts
default_severity: advisory
description: Verifies the team-knowledge push artifact records a probed hub git repository URL, a clean local validator run, a named sanitization approver, a non-empty card list, and one of the three submission outcomes with its required fields — merge request opened, branch pushed, or patch prepared with a named owner and blocking reason (team-knowledge plugin, advisory)
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

# akp-push sensor (team-knowledge)

ADVISORY. Fires when `team-knowledge-push-deposit.md` is written
(pass-through on every other stage output). This is the closing end of the loop
the `akp-pull` sensor opens, and it is deliberately **independent** of it: a
workflow owes the team what it learned whether or not it imported anything, so
this check never consults the pull record.

Checks the artifact ends the prose record with one fenced `yaml` block opening
with `deposit:` and verifies deterministically:

- `resolution:` is exactly one of `merge-request-opened`, `branch-pushed`, or
  `patch-prepared` — inherited verbatim from the `poc-accelerator` deposit
  sensor (§10.7). There is no skip value and no "nothing to deposit".
- `repo_url:` is present and shaped like a git remote (`https://`, `http://`,
  `ssh://`, `git://`, `file:///abs/path`, or `git@host:team/repo.git`). A bare
  local directory is rejected: a deposit has to be pushed somewhere others read.
- `repo_probe:` is exactly `git-ls-remote-ok`.
- `validate:` is exactly `akp-validate-ok` — FR-5/§8.3 require the *same*
  validator that gates the hub MR to pass locally, in `produce` mode, before
  the branch is pushed. Cards that cannot pass the gate should never reach a
  human reviewer.
- `cards:` lists at least one card concept ID.
- `sanitization_approved_by:` names the human who approved what leaves the
  delivery site. Deny patterns are the machine backstop only (§4.1/§4.6).
- `reclassified_from_project:` being non-empty requires
  `reclassification_approved_by:` — `project.md` rules are *structurally*
  excluded from the export surface, and only a named human re-grade admits one
  (FR-2/§5.2).
- `merge-request-opened` additionally requires `branch:` and `review_url:`.
- `branch-pushed` additionally requires `branch:` and `owner:` (who opens the
  merge request).
- `patch-prepared` additionally requires `patch_path:`, `owner:`, and
  `blocked_reason:` — a refused push is an owned handoff with a named reason,
  never a skip (FR-6).

`repo_url_source:` is checked when present (`pull-artifact`, `memory-layer`, or
`user-provided`).

## Advisory note

The framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is
REPORTED (audit rows + detail file), not enforced. The stage prose owns
resolving the URL, obtaining the sanitization approval, running the validator,
and pushing the branch; this sensor makes a handoff that quietly kept the
harvest inside the workflow record visible the moment the artifact is written.
