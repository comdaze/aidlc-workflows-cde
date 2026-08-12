# Hub Operations — merge requests, review debt, archiving

Methodology knowledge for the `team-knowledge` plugin. Read it before
touching the hub repository from either stage.

## 1. One authoritative write point

```
spoke                                  hub
─────                                  ───
learning ritual (human)                MR pipeline: validate, fail closed (machine)
   ↓                                        ↓
team-knowledge-push:                   CODEOWNER review + merge (human)  ← the ONLY authority grant
  local validate (machine)                  ↓
  named sanitization approval (human)  weekly review-debt issue (machine reminds, human reviews)
  branch + MR (machine)                weekly carry-affirmations bot MR (machine carries, human merges)
                                       monthly propose-archive bot MR (machine proposes, human merges)
team-knowledge-pull:
  fetch + computed index (machine)
  Practice cards via persist (human confirms each)
  feedback registered (machine) ─────→ feedback/ feeds the next round
```

A human appears in exactly four places, and all four are value judgements:
confirming a learning inside the project, approving sanitization on the way out,
reviewing the hub MR, and re-affirming a card at review time. Everything else is
mechanical and automated.

**Automation never writes authoritative state.** It does three things only:
reject what does not qualify, compute derived state, and put a decision in front
of the person who owns it. `main` is a protected branch with direct pushes
disabled; the bot holds a project access token whose reach ends at opening a
branch and an MR. That way each automated action is itself in the git audit
trail.

## 2. Git discipline

- Branch name: `knowledge/<yyyy-mm-dd>-<topic-slug>`.
- One purposeful commit per deposit. The MR *is* the review interface, and
  `git diff` is the whole review UI — one card per file is what keeps that
  readable and keeps two projects depositing in the same week from conflicting.
- Never commit to the default branch. Never force-push. Never commit
  credentials. The framework's git safety line applies to the team repository
  exactly as it does to a customer's.
- No write access is not a skip. `git format-patch` into the stage record dir,
  name the owner who will land it, record the blocking reason. An owned handoff
  is a resolution; silence is not.

## 3. Nothing derived is committed

| Derived thing | Computed from | Why not stored |
|---|---|---|
| the index / registry | a scan of every card's frontmatter | a committed `registry.json` is one shared file every MR rewrites — it single-handedly breaks "one card per file never conflicts", and adds a "forgot to regenerate" silent failure |
| stale status | `today >= stale_after` | a stored boolean is wrong the day after it is written |
| trust tier | whether any `verified[].by` starts with `human:` | derived by OKF's own reference parser; storing it invites the two to disagree |
| usage statistics | aggregating `feedback/` | same shared-file conflict |
| dedupe digests | the normalized `# 规则` text | recomputable, and stale copies mis-report |

`aidlc-akp-registry.ts` computes the index on demand. If you find yourself
wanting to commit it "for speed", the cost you are buying is a merge conflict on
every deposit.

## 4. Scheduled jobs

| Cadence | Job | Output | Who decides |
|---|---|---|---|
| weekly | `review-debt.ts` | updates one standing issue: cards past `stale_after`, grouped by CODEOWNERS and @-mentioned | the owner re-affirms or supersedes |
| weekly | `carry-affirmations.ts` | scans `feedback/`, opens a bot MR appending `verified` events and moving `stale_after` | a human merges |
| monthly | `propose-archive.ts` | cards stale beyond `archive_grace_days` → a bot MR proposing archival | a human merges; **never** auto-merged |

Two properties keep these from becoming noise: **no-op runs produce no commit**
(no diff, no MR, no issue edit), and every job is *proposal-shaped*. A job that
starts merging its own proposals has quietly become the authority.

Grouping the review-debt list by the same CODEOWNERS file that routes MR review
is deliberate: whoever admitted a card owns keeping it true. No second assignment
mechanism is needed.

## 5. `feedback/` is JSON, and that is not cosmetic

An OKF bundle requires every non-reserved `.md` file to be a concept with a
`type`. Feedback is a machine-consumed operational record, not knowledge — as a
concept it would pollute the knowledge graph. Writing it as JSON puts it outside
the `.md` rule entirely.

`disputed` entries do **not** trigger automatic deprecation. A falsification claim
can itself be wrong. A dispute pushes the card to the top of the review list, in
red; the correction is still a human opening a successor card.

## 6. What the automation cannot do

- **Near-duplicate detection.** The Content-Key hashes scope into the digest and
  the dedupe digest is exact text, so two teams wording the same lesson
  differently will both be admitted. The only defence is CODEOWNERS review. The
  test suite deliberately pins this limit (a near-duplicate fixture that must
  *not* be flagged) so a future reader does not mistake it for solved.
- **Deciding what may leave a delivery site.** Deny patterns catch shapes —
  access keys, twelve-digit account numbers, internal domains. They cannot catch
  a sentence that is confidential because of who said it. A read boundary also
  cannot stop an agent inferring an excluded fact from surrounding evidence.
  That is why the named human sanitization approval is the actual gate and the
  patterns are only a backstop, and why the hub README says so out loud.
- **Distinguishing the two strengths of `verified`.** OKF defines `verified` as
  "checked against the sources". A spoke saying "I used this card and it held" is
  close to that but not identical. The plugin accepts the approximation rather
  than inventing a second freshness semantics; the cost is that the `verified`
  list mixes two strengths of confirmation and you cannot tell them apart from
  the field. If that ever causes a real misjudgement, the fix is a new field, not
  a changed meaning — additive, backward compatible.
