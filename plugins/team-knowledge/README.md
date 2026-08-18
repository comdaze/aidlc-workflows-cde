**English** | [中文](README.zh-CN.md)

# team-knowledge

Team-level knowledge that **crosses projects**. Two scope-independent stages move
it in and out of a shared git repository of [OKF v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
cards, without breaking the framework's three standing invariants: an LLM never
writes long-term memory, a human makes the value judgements, and a deterministic
tool does the writing.

- **`/team-knowledge-pull`** (inception) — search the hub, shortlist with a human,
  and import. `Practice` cards go through `aidlc-learnings.ts persist`;
  `Domain Knowledge` cards land under the space's knowledge seats.
- **`/team-knowledge-push`** (operation) — turn this workflow's affirmed team
  rules and confirmed domain knowledge into cards, validate them locally against
  the same gate the hub runs, and open a merge request.

Design and rationale: [`CONTRACT.md`](CONTRACT.md). Everything below is the
as-built summary.

## The problem it solves

AI-DLC's memory and knowledge layers are a **single-project loop**. Rule memory
persists across intents but not across repositories; team knowledge stops at the
local space; `knowledge-plugin`'s `.ai-ready/` output serves only the repo it was
distilled from. `poc-accelerator` already had a cross-project channel, but it was
welded into two stages of one scope.

So a judgement a human made during a delivery — a rule, a correction, a domain
fact, a route that was tried and rejected — stayed in that repository. The next
project, different people, different repo, paid the same learning cost again.

## What travels, and what structurally cannot

| Source | Default |
|---|---|
| `team.md` rules that passed the learning ritual | candidate |
| space `knowledge/` prose meeting the five preservation rules | candidate |
| a `.ai-ready/` industry pack, whole, with provenance | candidate |
| `project.md` rules | **excluded** — only a named human re-grade at the export gate admits one |
| stage `memory.md` journals | never |
| audit / state / sensor evidence | never |

That table is how "the hub does not accumulate personalized content" is enforced:
by **structure**, not by a reviewer's diligence. Project-scoped material is never
listed as a candidate, so it is not something a review has to catch.

The five preservation rules — anything leaving a project is **confirmed**,
**sanitized**, **graded for generalization**, **dated**, and (for a technical
assertion) **carries the evidence that proved it**. The last one earns its place:
a wrong technical claim in a shared repository gets reused, and reuse is
invisible.

## The card

One card, one file — which is what keeps two projects depositing in the same week
from conflicting, and makes a lifecycle change a single-file `git mv` and a trace
a single-file `git blame`. Standard OKF field names, with every extension of ours
inside a single `cde:` namespace:

```yaml
type: Practice                    # | Domain Knowledge | Knowledge Pack
title: …
description: …
tags: [mock-data, data-boundary]
status: stable                    # | draft | deprecated
generated: { by: aidlc-vibe/2.5.59, at: 2026-08-09T09:51:56Z }   # who WROTE it
verified:                                                        # who CONFIRMED it
  - { by: human:alice, at: 2026-08-09T09:51:56Z }
stale_after: 2027-02-05           # = max(verified.at) + policy half-life
sources: [ … ]                    # ≥1, cited from the body as [^id]
cde:
  class: judges                   # | knows
  generalization: industry-generic # | needs-recalibration
  origin: { project, intent, stage, content_key, content_key_scope }
  sanitization: { by: human:alice, at: 2026-08-09 }   # who approved it LEAVING
  memory_target: team             # Practice only — `org` has no write path
  heading: "## Mandated"          # Practice only — one of team.md's 8 headings
  knowledge_seat: aidlc-shared    # Domain Knowledge only
```

Four decisions in there are load-bearing:

- **`generated` and `verified` are different people.** The agent that wrote a card
  is not the human who confirmed it is true. `verified` is an event *list*, so a
  re-affirmation appends rather than overwrites and the history survives.
- **`cde.sanitization` is separate from `verified`.** "This is true" and "this may
  leave the delivery site" are two different judgements; merged into one field,
  one of them quietly disappears.
- **`content_key_scope` is recorded because the Content-Key hashes scope into the
  digest.** Without it, the key cannot be matched back to the `RULE_LEARNED`
  audit row it came from.
- **`stale_after` is required, and reverse-computed with zero tolerance.** OKF's
  own `is_stale` returns *false* for a missing `stale_after` — it fails open, so
  "no clock" would read as "never expires". That tolerance is exactly where a
  forgetting mechanism dies quietly.

## Nothing derived is committed

The index, staleness, trust tier, usage statistics, and the dedupe digests are all
computed on demand. A committed `registry.json` would be one shared file every
merge request has to rewrite — it breaks "one card, one file, never conflicts" on
its own, and adds a "forgot to regenerate" silent-failure mode for free.

## Tools

| Tool | What it does |
|---|---|
| `aidlc-akp-cards.ts` | card reader/writer, plus the three OKF derived functions ported verbatim (`normalize_verified`, `trust_tier`, `is_stale`) |
| `aidlc-akp-validate.ts` | the fail-closed gate — **one** implementation, run on both sides |
| `aidlc-akp-registry.ts` | the computed index (`--tags`, `--type`, `--domain`, `--query`) |
| `aidlc-akp-lifecycle.ts` | the three scheduled hub jobs: `review-debt`, `carry-affirmations`, `propose-archive` |
| `aidlc-sensor-akp-{pull,push}.ts` | the two advisory record sensors |

### Two verdicts, deliberately not merged

| Verdict | Basis | Producing our own cards | Consuming a third-party bundle |
|---|---|---|---|
| `okf-nonconformant` | OKF SPEC §11's three hard requirements | reject | reject |
| `cde-policy-violation` | our house rules (required fields, the clock, deny patterns, dedupe, vocabularies) | reject | **warning** |

Conflating them causes two specific errors: telling our own authors a house-rule
breach is "not OKF compliant", and refusing a perfectly legal third-party bundle
because it lacks our `cde:` block. A bundle with no `cde:` metadata is a bundle
with no CDE metadata — treat it as unverified, ask a human to fill in the
provenance, and carry on.

## The hub repository

[`hub-skeleton/`](hub-skeleton/) is a working starting point: `index.md`,
`log.md`, `README.md` (including the honest statement of where the sanitization
boundary actually is), `CODEOWNERS`, `policy/lifecycle.json`, a `.gitlab-ci.yml`
with the MR gate plus the three scheduled jobs, and the five tool entry points as
thin wrappers over the vendored validator.

```bash
git init my-team-knowledge && cd my-team-knowledge
cp -R <repo>/plugins/team-knowledge/hub-skeleton/. .
./tools/sync-from-plugin.sh <repo>      # vendor the gate; writes VENDOR-STAMP.txt
bun tools/validate-cards.ts             # should pass on an empty bundle
```

Then record the URL in the space memory of any project that should reach it:

```markdown
## Team Knowledge Repository
https://gitlab.example.com/team/aidlc-knowledge.git
```

**A bot may open a merge request. A bot may never merge one.** `main` is
protected, the bot token stops at pushing a branch, and merging — the single
authoritative write in the whole loop — is a human act by a CODEOWNER. The
scheduled jobs are all proposal-shaped and silent when there is nothing to do.

## Install

Follow the generic plugin install in [`PLUGINS.md`](../../PLUGINS.md), with
`<plugin>` = `team-knowledge`. Both stages are on every core scope and
`CONDITIONAL`: without a hub URL in memory and without a human naming one, they
skip rather than blocking the workflow.

`team-knowledge-push` is additionally on the `vibe` scope, and `team-knowledge-pull`
is deliberately not. A free-form session's whole justification is that what it
learned survives, and its sedimentation already lands in `team.md` through the same
learnings ritual push reads from — so at 4.95, after close-out, the export half
applies unchanged. Pull would fire at 2.95, *before* the session opens, turning
"start working" into a hub search plus a shortlist gate; that is the one property
the `vibe` scope exists to protect. Pulling on a free-form session is a
`aidlc-akp-registry.ts` query away when you want it, which is the right cost for
something you asked for. One caveat if you enter `vibe` from Kiro's agent picker
rather than by scope command: `aidlc-vibe` is written as a standalone persona that
does not orchestrate, so it will not hand off to this stage's `aidlc-developer-agent`
seat on its own. Enter via `/vibe` or `/aidlc --scope vibe` when you want the
close-out handoff to happen by itself.

## Known limits, stated rather than papered over

- **Only exact duplicates are caught.** The dedupe digest is the normalized
  `# 规则` text and the Content-Key includes scope, so two teams wording one
  lesson differently will both be admitted. CODEOWNERS review is the only
  defence; `tests/validator.test.ts` deliberately pins a near-duplicate that is
  *not* flagged, so nobody mistakes the limit for solved.
- **`verified` mixes two strengths of confirmation.** OKF defines it as "checked
  against the sources"; a spoke saying "I used this and it held" is close but not
  identical. The approximation is accepted rather than inventing a second
  freshness semantics — if it ever causes a real misjudgement the fix is a new
  field, not a changed meaning.
- **Org-level knowledge has no automated channel.** `aidlc-learnings.ts persist`
  accepts only `project` and `team`, so `cde.memory_target` is always `team`. Such
  content can live in the hub as an ordinary card; it simply has no automatic
  landing path, and the plugin ships no `proposed_tier: org` field — a stored
  field that can never take effect misleads more than its absence.
- **`--single` cannot write memory.** Under `--stage … --single` there is no
  synthesized intent, so `aidlc-learnings.ts` cannot run. The pull stage's
  `report-only` resolution is that path made explicit: search, report, name an
  owner, hand off — never hand-edit `team.md` and call it done.

## Interop with `poc-accelerator`

`poc-accelerator` already had its own team-knowledge channel welded into Step 01
and Step 08. With this plugin installed alongside it, both ends delegate: Step 01
searches the hub through `aidlc-akp-registry.ts` and inherits the trust signals,
Step 08 authors OKF cards and runs `aidlc-akp-validate.ts --mode produce` before
pushing.

The delegation is **optional by construction**, and that is a deliberate
constraint rather than caution: the composer does not read `dependencies` today
(plugin mechanism §7 lists it as deferred), so a plugin that assumed a sibling was
installed would fail at *runtime*. Without this plugin, poc's two steps behave
exactly as before and their sensor verdicts are unchanged — the four new record
fields (`card_tooling` / `cards_imported`, `validate` / `cards`) are checked only
when present.

What did **not** converge: the git-remote URL judgement is still one copy per
plugin, because a sensor runs from the hook path and must not import across
plugins. `tests/inherited-git-contract.test.ts` feeds the same 18 URLs to all
three sensors so any drift is a red test — which is what makes §10.7's
"inherited verbatim" checkable. Collapsing it into one module is a follow-up for
whenever the composer starts enforcing `dependencies`.

## Tests

```bash
bun test plugins/team-knowledge/tests/
bun test plugins/poc-accelerator/tests/sensors.test.ts   # the pinned pre-convergence verdicts
```

105 assertions here across content validation, the §11 rule table, the three
ported OKF functions, the writer's key order, both sensors, the lifecycle jobs,
the cross-plugin git-contract equivalence, and a contract test that runs the real
`aidlc-learnings.ts persist` on selections built from a card. Wired into the
repo's integration tier automatically.
