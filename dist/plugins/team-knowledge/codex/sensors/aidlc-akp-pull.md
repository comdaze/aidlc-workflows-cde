---
id: akp-pull
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-akp-pull.ts
default_severity: advisory
description: Verifies the team-knowledge pull artifact records a probed hub git repository URL, a machine-readable resolution (cards imported, no match, or the named degraded report-only handoff), that Practice imports went through the learnings persist ritual, and that any stale card was re-affirmed by a named human (team-knowledge plugin, advisory)
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

# akp-pull sensor (team-knowledge)

ADVISORY. Fires when `team-knowledge-pull-preflight.md` is written
(pass-through on every other stage output). Checks the artifact ends the prose
record with one fenced `yaml` block opening with `pull:` and verifies
deterministically:

- `resolution:` is exactly one of `cards-imported`, `no-card-match`, or
  `report-only`. There is no skip value — the hub is a required input. The
  third value is the one honest degraded outcome: `--single` runs cannot reach
  `aidlc-learnings.ts persist` (CONTRACT §10.5), so a single-stage run reports
  and hands off rather than hand-editing `team.md` and calling it done.
- `repo_url:` is present and shaped like a git remote — `https://`, `http://`,
  `ssh://`, `git://`, `file:///abs/path`, or the scp-like
  `git@host:team/repo.git`. A bare local directory is rejected: the same URL is
  what the push stage opens a merge request against. Inherited verbatim from
  the `poc-accelerator` sensors (§10.7).
- `repo_probe:` is exactly `git-ls-remote-ok`. A failed probe is not a
  resolution — the stage asks for a URL that works (FR-9).
- `sources_searched:` lists at least one query/seat that was searched.
- `cards-imported` additionally requires a non-empty `imported:` list of card
  **concept IDs** (FR-14 — the reverse-trace registration point) and a
  `practices_persisted:` key. An empty `practices_persisted:` list is a valid
  answer; its *absence* is not, because that is what hides whether the persist
  ritual ran. A non-empty one additionally requires `persist_slug:`.
- `no-card-match` additionally requires a non-empty `search_terms:` list, and
  may not also list imported cards.
- `report-only` additionally requires `blocked_reason:`, `owner:`, and a
  non-empty `handoff:` list — and may **not** claim `practices_persisted`,
  which is precisely what the degraded run could not do.
- `stale_imported:` being non-empty requires `stale_reconfirmed_by:`. A stale
  card has lost its default authority; re-affirming it is a human act
  (FR-13/§8.2).

`repo_url_source:` is checked when present (`memory-layer` or `user-provided`).

## Advisory note

The framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is
REPORTED (audit rows + detail file), not enforced — the same contract as every
core sensor. The stage prose owns resolving the URL, running the registry query,
and driving the persist ritual; this sensor makes a pull record that quietly
skipped the hub, or that wrote memory without the audit trail, visible the
moment the artifact is written.
