---
id: poc-accelerator-team-knowledge-preflight
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-poc-accelerator-team-knowledge-preflight.ts
default_severity: advisory
description: Verifies the PoC team-knowledge preflight artifact records a probed team-knowledge git repository URL and a machine-readable resolution — pack imported, or searched with no match (poc-accelerator plugin, advisory)
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

- `resolution:` is exactly one of `pack-imported` or `no-pack-match` —
  silence or a missing value never passes, and there is no skip value: the
  team knowledge repository is a required input to the workflow.
- `repo_url:` is present and shaped like a git remote — `https://`,
  `http://`, `ssh://`, `git://`, `file://`, or the scp-like
  `git@host:team/repo.git`, each with a non-empty path. A bare local
  directory is rejected: step 8 has to push a branch to this URL.
- `repo_probe:` is exactly `git-ls-remote-ok`. A failed probe is not a
  resolution — the stage asks for a URL that works.
- `sources_searched:` lists at least one searched path/URL (the active
  space's local knowledge seats are always searched first).
- `pack-imported` additionally requires `pack:` and `import_path:`.
- `no-pack-match` additionally requires a non-empty `search_terms:` list, so
  "nothing matched" is an auditable claim rather than an assertion.

`repo_url_source:` is checked when present (`memory-layer` or
`user-provided`) and reported as a finding when it carries any other value.

## Optional team-knowledge delegation

When the `team-knowledge` plugin is installed, step 1 searches the hub
through that plugin's computed card index instead of grepping prose. Two extra
fields record it, and both are checked **only when present**:

- `card_tooling:` is `available` or `absent`.
- `cards_imported:` lists OKF card concept IDs (bundle-relative paths without
  `.md`), and a non-empty list requires `card_tooling: available` — a record
  cannot claim card imports without the tooling that produces card IDs.

A record written without that plugin omits both and is judged exactly as it was
before that plugin existed. That is deliberate: the composer does not enforce
`dependencies` today, so `poc-accelerator` has to stay valid on its own.

## Advisory note

The framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here
is REPORTED (audit rows + detail file), not enforced — the same contract as
every core sensor. The stage prose still owns resolving the repository URL,
asking for it when memory is silent, and probing it; this sensor makes an
incomplete preflight record — or one that quietly dropped the repository —
visible the moment the artifact is written.
