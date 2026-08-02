# Fork divergence from upstream `aidlc-workflows`

**What this is for.** This fork tracks `awslabs/aidlc-workflows` (branch `v2`).
Every upstream release is a merge, and a merge is only cheap if you know in
advance which files diverge and why. This is that list — the same discipline
`plugins/knowledge-plugin/tools/vendor/repo-to-ddd/VENDORED.md` applies to the
vendored engine, applied one level up to the fork itself.

**Read it as a checklist, not history.** Before an upstream sync, walk §2 and
decide each row. After a sync, run §4. §5 regenerates the whole table from git,
so re-derive rather than trust — the numbers below are a snapshot.

**Sync log.**

| Date | Upstream | Conflicts | Notes |
| --- | --- | --- | --- |
| 2026-08-01 | `9c9201b8` (2.5.33) | 8 (3 source, 5 `dist/`) | **All eight were the version-number cluster.** `AGENTS.md`, `gen-coverage-registry.test.ts`, and `docs/guide/harnesses/kiro-ide.md` auto-merged clean. Adopted the frozen-version policy (A3), so an equivalent merge from here is a zero-conflict `git merge`. |
| 2026-07-31 | `d0cd10a6` (2.5.30) | 16 (8 source, 8 `dist/`) | The fork had been sitting on a 2.5.7 base. Found the dead IDE hook layer. See §7. |

**Cadence.** Weekly. Upstream runs 10–27 commits/week on `v2` and about 1.6
releases/day (49 distinct versions in 30 days), so a week is ~14 commits — one
sitting. A month is 60+ and nobody volunteers for it.

**CI.** `.gitlab-ci.yml` runs the guards on every MR into `main`: contract checks
(`bun run check` — dist byte-parity, typecheck, lint), the smoke + unit tiers, and
`scripts/ci-changelog-guard.ts` against `CI_MERGE_REQUEST_DIFF_BASE_SHA`. The
inherited `.github/workflows/ci.yml` is kept for upstream parity but does nothing
here — it keys off `github.event.pull_request.base.sha`.

A fourth job, `upstream-drift`, has no upstream counterpart and runs on a
**schedule** (configure it under Settings → CI/CD → Schedules on `main`). It is
what makes the weekly cadence a mechanism rather than a promise: it fetches
`github/v2`, prints how many commits are pending, runs the §5 derivation to print
the actual conflict surface, and fails on any collapsed GitHub alert block (the
A4 reformat trap). Advisory by construction — `allow_failure: true`, because being
behind upstream is not a build error. Read the log, then decide whether to spend
the session.

Everything before 2026-08-01 ran only when a human remembered. That is how 15
collapsed alert blocks and a 16-entry `CHANGELOG.md` deletion both got in without
anything noticing.

## 1. The shape of the problem

Divergence of the merged tree against `github/v2`, re-derived 2026-08-01 at
upstream `9c9201b8`:

| Surface | Files changed by us | Conflict risk |
| --- | --- | --- |
| `plugins/` | 59 | **None.** Ours entirely; upstream has no such directory. |
| `docs/` | 8 | None in practice (new chapters + our own research notes). |
| `dist/` | 256 | **Not a conflict** — generated. Never merge it; regenerate (§3). |
| `core/` | 2 | Low. Both are small and policy-driven, not functional. See A1, A2. |
| `harness/` | 6 | **One real risk**, the Kiro IDE adapter. See B1. |
| `tests/` | 2 | Low. One new file, one ratchet entry. See A5. |
| root files | 6 | Low. No longer includes `CHANGELOG.md` or the version — see A3. |

The plugin mechanism is doing its job: the majority of this fork's work lives in
`plugins/` and can never conflict. **Protect that property** — new CDE-specific
behaviour belongs in a plugin, not in `core/`. Anything that has to go outside
`plugins/` should be recorded here on the way in, not discovered at merge time.

**Read the risk column, not the file counts.** File counts say `dist/` is the
problem; it is not, it is generated. What actually costs time is *how often
upstream edits a file the fork also edits*. Measured over 60 days across the 15
files this fork diverged on, upstream made 341 edits, distributed like this:

| Upstream edits (60d) | File | Fork's stake |
| --- | --- | --- |
| 81 | `README.md` | badge **resolved** (A3); the plugins section remains (A4) |
| 72 | `CHANGELOG.md` | **resolved** (A3) — upstream's, plus one inert frozen block |
| 70 | `core/tools/aidlc-version.ts` | **resolved** (A3) — no longer diverges |
| 37 | `tests/unit/gen-coverage-registry.test.ts` | **resolved** — the ratchet line went with B1 |
| 25 | `core/tools/aidlc-utility.ts` | one doctor string (A1) |
| 11 | `AGENTS.md` | the plugins paragraph + the changelog policy (A4) |
| 8 | `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` | **resolved** — B1 deleted, byte-identical again |
| 8, 7, 7, 7 | `harness/*/onboarding.fills.ts` | one prereq bullet each (A1) |
| 4 | `harness/kiro-ide/skills/aidlc/question-rendering.md` | one 8-line rule (A5) |
| 3 | `.gitignore` | A4 |
| 1 | `core/knowledge/.../security-guide.md` | one word (A2) |

The top three were **65% of the fork's entire exposure and none of them was a
feature** — they were version bookkeeping the fork created for itself. A3 removed
them; deleting B1 removed 45 more edits' worth, including the only high-severity
row. Exposure is down from 341 to **150**, and what is left is only three things:
A1/A2/A5 (**upstreamable**, 84 edits' worth, 9 changed lines total) and A4 (fork
identity, unavoidable, but additive to resolve).

**Source divergence is now 7 files, all one-liners or single bullets:**

```
core/knowledge/aidlc-devsecops-agent/security-guide.md   A2
core/tools/aidlc-utility.ts                              A1
harness/claude/onboarding.fills.ts                       A1
harness/codex/onboarding.fills.ts                        A1
harness/kiro/onboarding.fills.ts                         A1
harness/kiro-ide/onboarding.fills.ts                     A1
harness/kiro-ide/skills/aidlc/question-rendering.md      A5
```

`tests/` and `scripts/` are byte-identical to upstream. If A1, A2 and A5 land
upstream, `core/` and `harness/` go to zero and the fork becomes what it should
be: `plugins/` plus fork identity.

## 2. The inventory

Twenty-three files outside `plugins/` and `dist/`, but only **six logical
changes**. Resolve by change, not by file.

### A1 — Replace `curl | bash` with a package-manager install (5 files)

| | |
| --- | --- |
| Files | `core/tools/aidlc-utility.ts` (doctor fix text) · `harness/{claude,codex,kiro,kiro-ide}/onboarding.fills.ts` (prereq bullet) |
| Class | **A — must diverge.** Internal policy: do not instruct users to pipe a network script into a shell. |
| Upstream | Optional suggestion, not a blocker. Upstream may well want it; not worth holding a sync for. |
| On conflict | Keep ours. The change is a self-contained string in each file; if upstream rewrites the surrounding text, re-apply the substitution rather than reverting their edit. |

Original upstream text, for recognition when re-applying:
`install via \`curl -fsSL https://bun.sh/install | bash\``.

### A2 — Inclusive-language fix in the security guide (1 file)

| | |
| --- | --- |
| File | `core/knowledge/aidlc-devsecops-agent/security-guide.md` — "whitelist URLs" → "validate against an approved allowlist" |
| Class | **A**, but a strong upstream candidate: uncontroversial, one line. |
| Upstream | **Offer it.** Cheapest possible contribution; removes a row from this table. |
| On conflict | Keep ours. |

### A3 — Framework version — **RESOLVED 2026-08-01: the version line is frozen**

| | |
| --- | --- |
| Files | `core/tools/aidlc-version.ts` · `CHANGELOG.md` · the `README.md` badge |
| Class | **Was the single largest conflict surface in this table. Now zero.** |
| Policy | **The fork does not bump any of the three, and never adds a `CHANGELOG.md` entry.** Fork release notes live in `CHANGELOG.fork.md`; CDE behaviour lives in a plugin and bumps `plugins/<name>/.aidlc-plugin/plugin.json`. |
| On conflict | `aidlc-version.ts` and the README badge: resolve to upstream's side, always, no judgement. `CHANGELOG.md`: take upstream's new entries at the top and **leave the pre-policy fork block alone** — see the trap below. |

> [!IMPORTANT]
> **`CHANGELOG.md` is upstream's *plus* one frozen fork block. Do not resolve it with `git checkout --theirs`.**
> The fork published 16 entries of its own before this policy existed —
> `## [2.3.11]` through `## [2.3.26]`, the GitFarm-era plugin work — and they sit
> as a contiguous block between upstream's `## [2.4.0]` and `## [2.3.10]`.
> Upstream never had those headings, so a wholesale `--theirs` silently deletes
> 16 entries of fork history. That is exactly what happened at the 2.5.33 sync
> and `scripts/ci-changelog-guard.ts` is what caught it.
>
> The block is inert: it never changes, and upstream only ever appends at the top
> of the file, so it costs nothing to keep and produces no future conflict. The
> only hunk that can conflict is the top of the file, and under this policy only
> upstream writes there — so from here `CHANGELOG.md` should stop conflicting
> altogether.

This row used to read *"take upstream's number, then re-apply our patch level on
top"*. That was the wrong instruction, and it was expensive. Measured over 60
days, these three files absorbed **223 of the 341** upstream edits to files this
fork diverges on — 65% of the entire conflict surface, for pure bookkeeping. And
the patch numbers collided outright twice: the fork's 2.5.8/2.5.9 against
upstream's own, then the fork's 2.5.31 against upstream's `cd209eb1`. Each
collision trips `t68`'s duplicate-heading guard, and each resolution meant
deciding what to do with an entry that had already shipped.

**The freeze is guard-safe.** `t68` only pins that the three agree *with each
other*, which upstream's CI already guarantees; it never requires the fork to
bump. `scripts/ci-changelog-guard.ts` only forbids *deleting* an existing
heading, never requires adding one.

This restores a policy the fork already had and drifted off. At `80a96461`:
*"Going forward plugin-only changes bump the plugin version only."* Every commit
from plugin 0.17.0 to 0.21.0 carries *"core version frozen per the
zero-divergence policy"*. The drift began at `fa2d9b63`/`fdb56a7a` (2.5.8/2.5.9)
— the B1 gate-render floor, the first change that could not be a plugin. It
forced a core edit, which forced a core version bump, which un-froze the version
line. See §7.

### A4 — Fork-identity root files (6 files)

| | |
| --- | --- |
| Files | `README.md` (+177/−65: the plugins section, the install walkthrough, the 中文 link) · `README.zh-CN.md` (new) · `AGENTS.md` (the plugins paragraph + the A3 changelog policy) · `CHANGELOG.fork.md` (new, A3) · `.gitignore` (+`.refer`, +`/build`) · `Config` (BuilderHub package descriptor) |
| Class | **A — must diverge.** These describe *this* repository, not the framework. |
| Upstream | No. `Config` and `/build` are GitFarm/Brazil artefacts; `.refer` is our scratch directory; the plugins section is about plugins upstream does not ship. The Chinese READMEs are arguably offerable but would then need upstream maintenance. |
| On conflict | Keep ours, additively. `README.md` and `AGENTS.md` are the two upstream also edits: take upstream's body and re-apply our section, the same shape as A1. `CHANGELOG.fork.md` can never conflict — nothing upstream has that path. |

**Watch for formatter damage in this row.** At the 2026-08-01 sync, all 8 GitHub
alert blocks in `README.md` were collapsed to a single line
(`> [!NOTE] text…` instead of `> [!NOTE]` then `> text…`), which silently
degrades them to plain blockquotes. Upstream had all 7 of its own correctly
formed, so this was fork-side damage — plus 2 more in `README.zh-CN.md` and 2
each in the `knowledge-plugin` READMEs, 14 in total. Fixed in that sync. The
check is one line:

```bash
grep -rnE '^> \[!(NOTE|IMPORTANT|WARNING|TIP|CAUTION)\] .' --include='*.md' . | grep -v node_modules
```

Anything it prints is a broken alert. This is the failure mode to expect from
carrying a heavily-edited prose file: not a merge conflict, a silent reformat.

### A5 — Chat-rendering rule in the question-rendering annex (1 file) — **upstream-bound**

| | |
| --- | --- |
| File | `harness/kiro-ide/skills/aidlc/question-rendering.md` — one 8-line bullet at the head of `Rules:` |
| Class | **B — general, not CDE-specific.** The last survivor of B1 (below), and the part worth keeping. |
| Upstream | **Offer it.** It is harness-neutral guidance derived from two field failures, it costs upstream nothing, and it removes this row. |
| On conflict | Additive insertion into a list. Take upstream's file, re-insert the bullet. |

States that writing a gate to the questions *file* is the audit record and not the
presentation, so parking a turn on a bare "waiting for you" line without the
numbered options in that same chat message is a protocol violation. Observed twice
in the field: the user was asked to "reply with a number" they had never been
shown.

The rule is prose the conductor reads, and it stands on its own — nothing verifies
it, because the IDE hands the Stop hook no transcript. That was exactly B1's
premise, and B1's answer (a hook that blocks) turned out not to be available. The
rule outlived the mechanism.

### ~~B1 — Kiro IDE gate-render floor~~ — **DELETED 2026-08-01**

| | |
| --- | --- |
| Was | `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` (+145) · `harness/kiro-ide/skills/aidlc/question-rendering.md` (+8) · `tests/unit/t219-kiro-ide-gate-render-floor.test.ts` (+230) · `tests/unit/gen-coverage-registry.test.ts` (+3) · `docs/guide/harnesses/kiro-ide.md` — 386 lines |
| Commits | `fa2d9b63` (2.5.8), `fdb56a7a` (2.5.9) |
| Outcome | Removed. All five files are byte-identical to upstream again, except the annex bullet retained as A5. |

**Why it was deleted rather than rewritten.** The floor returned
`{"decision":"block"}` from the `stop` adapter path, written against the pre-1.0
`agentStop` contract. Upstream's v2 hook descriptor states the case plainly:

> advisory-only: the IDE's Stop trigger cannot block; enforcement relies on the
> conductor's own Stop protocol
>
> — `dist/kiro-ide/.kiro/hooks/aidlc-stop.json`

So it was inert on any IDE ≥1.0 — which is every current build — and had been
since the fork shipped it.

Migrating it to a trigger that *can* block does not work either, and the reason is
worth recording because it is easy to miss. `PreToolUse` and `UserPromptSubmit` do
honour `exit 2` on the v2 channel (this fork verified that directly — see
`docs/reference/kiro-ide-hook-payload.md`). But the floor's question is *"is this
turn ending with an unrendered gate?"*, and that is only answerable at
end-of-turn. At `PreToolUse` the turn has not ended; at `UserPromptSubmit` the
user has already been shown — or not shown — the gate and has replied to
something they could not see. The timing is inverted, so a migration is a
redesign, not a move. If hard enforcement is genuinely wanted it belongs upstream
as a designed feature (a marker written when the gate is recorded, checked on the
*next* `UserPromptSubmit`), not as a fork patch in the enforcement spine.

**What it cost while it existed.** 386 lines, 49 upstream edits of exposure across
its files over 60 days, the only high-severity conflict in this table (145 lines
in `aidlc-kiro-adapter.ts`, a file upstream edits actively — it conflicted in both
the 2.5.30 and 2.5.33 syncs), a `gen-coverage-registry` ratchet line that was red
on the fork from 2.5.8 until 2026-08-01, a `t219` filename collision with
upstream's own `t219-claude-project-dir-quoting.test.ts`, and — via the core
version bump it forced — the un-freezing of the version line that became 65% of
the fork's total conflict surface. See §7.

## 3. `dist/` is generated — never merge it

261 files diverge and that is expected. The resolution is mechanical:

```bash
git checkout --ours dist/            # or --theirs; the content is discarded either way
bun scripts/package.ts               # regenerate from core/ + harness/ + plugins/
bun scripts/package.ts --check       # byte-parity gate: must print all trees in sync
```

Byte-parity is what makes this safe: a mis-resolved `dist/` cannot survive
`--check`. **Never hand-edit a `dist/` conflict hunk** — the result would be a
tree that no source produces, and the drift guard would fail CI on it anyway.

## 4. Upstream sync procedure

Do this **on a cadence, not on demand.** Resolving a 147-line conflict in the
enforcement spine under delivery pressure is how the fork breaks.

```bash
git fetch github
git switch -c sync/upstream-$(date +%Y%m%d)
git merge github/v2
#  resolve per §2 (by logical change), and per §3 for dist/
bun scripts/package.ts && bun scripts/package.ts --check
bash tests/run-tests.sh --ci
```

Then the step that is always forgotten:

**Check the compose drops.** Plugins splice contributions into core stage source
by slug and anchor. If upstream renames a stage or moves an anchor, the merge
succeeds, the tests pass, and the contribution **silently stops applying** —
compose records an advisory drop rather than failing. So after every sync, in a
scratch install:

```bash
bun <harness-dir>/tools/aidlc-utility.ts plugin-list
bun <harness-dir>/tools/aidlc-utility.ts doctor      # reports drops per plugin
```

Confirm each plugin's stage count and contribution sentinels are still there. A
green test suite does **not** cover this — the plugin content tests validate the
plugin against the framework's validators, not that its anchors still resolve in
the merged stage source.

**Establish the failure baseline before you read the results.** A `--ci` run on
this fork is not green, and almost none of that is the fork's fault. The cheap way
to tell the difference is a throwaway worktree at upstream tip:

```bash
git worktree add /tmp/upstream-tip github/v2 --detach
ln -s "$PWD/node_modules" /tmp/upstream-tip/node_modules
( cd /tmp/upstream-tip && bun test tests/integration/t89.test.ts )   # etc.
git worktree remove /tmp/upstream-tip
```

Anything that reproduces there is upstream's, not yours. As of the 2.5.30 merge
(288 files, 5840 assertions, 5 failing files / 21 failing assertions):

| Failure | Verdict |
| --- | --- |
| `integration/t19` (1) | **Environment.** Anthropic blocks this region, so the live Claude substrate cannot answer. It also trips the preflight, which then *skips* the whole Claude-dependent tier — so a `--ci` run here never exercises those files at all. |
| `integration/t89` (13) | **Upstream defect.** `core/aidlc-common/stages/ideation/intent-capture.md` imports the new `claim-sources` sensor, but `tests/fixtures/v05-mr7b-sensor-resolution/` was never given an `aidlc-claim-sources.md`, so `compileStageGraph()` throws "unknown sensor id". Reproduces at `d0cd10a6`. A one-file fixture addition; a good cheap upstream contribution. |
| `integration/t92` (4) | **Environment.** `tsc` exceeds the 30s per-test timeout on this machine. Reproduces at `d0cd10a6`. |
| `integration/t66` (2) | **Upstream defect.** Designer-export golden fixture drift. Reproduces at `d0cd10a6`. |
| `unit/gen-coverage-registry` (1) | **Was ours; fixed.** The A5 ratchet entry was missing. Fixed in the 2.5.31 follow-up. |
| `integration/t188` | **Flaky, ours.** `beforeEach/afterEach hook timed out` under load; passed clean in the 2.5.31 run. Re-run before believing it. |

## 5. Re-deriving this table

Do not trust the counts above; regenerate them.

```bash
B=$(git merge-base HEAD github/v2)

# which surfaces diverge, and by how much
git diff --name-only $B..HEAD | cut -d/ -f1 | sort | uniq -c | sort -rn

# the actual conflict surface: files BOTH sides changed
comm -12 \
  <(git diff --name-only $B..HEAD        -- core harness tests scripts | sort) \
  <(git diff --name-only $B..github/v2   -- core harness tests scripts | sort)
```

The second command is the one that matters. Anything it prints and this document
does not explain is an undocumented divergence — add a row.

## 6. How to submit a row upstream

Upstreaming is the only action on this table that makes divergence go *down*.
Everything else just manages it. **A1, A2 and A5 are the open candidates** — 9
changed lines across 7 files, worth 84 upstream edits of exposure over 60 days.

**Never cherry-pick a fork commit.** Fork commits are contaminated by design: the
old ones bump `core/tools/aidlc-version.ts` plus five `dist/*/tools/aidlc-version.ts`
copies, edit `CHANGELOG.md` and `README.md`, and some also touch `plugins/`, which
does not exist upstream. Hand-assemble instead:

```bash
git switch -c upstream/<topic> github/v2      # branch off upstream tip, not the fork
git checkout <fork-ref> -- <only the files that row owns>
bun scripts/package.ts                        # regenerate dist/ from upstream + the change
bun run check && bun tests/run-tests.ts --smoke --unit
```

Then drop everything else — including anything the row does not own. A fork commit
usually carries unrelated `plugins/` or fork-identity edits.

> [!IMPORTANT]
> **A submission DOES bump the version, even though the fork never does.** A3
> freezes the version *for the fork*; it says nothing about upstream's rules.
> Upstream's `CONTRIBUTING.md` PR checklist requires that a user-visible change
> bump `core/tools/aidlc-version.ts`, move the README badge, and add a matching
> `## [X.Y.Z] - YYYY-MM-DD` entry to `CHANGELOG.md` in the same commit — and their
> `t68` enforces all three agreeing. Submitting without them fails their CI.
>
> Expect to re-bump on review: at ~1.6 releases/day, upstream will very likely
> ship your patch number before merging. That is normal there and their own
> `AGENTS.md` documents the rebase-and-re-bump resolution. Say so in the PR body
> so a reviewer knows you will follow up.

**Check upstream tip first, every time.** Upstream ships ~1.6 releases/day. At the
2.5.33 sync a hand-written `t89` fixture fix was completed and then thrown away
because upstream had shipped the identical five files and two assertions in the
meantime. `git fetch` before you write anything.

Once a row lands upstream, delete it from §2 and re-derive §1 with §5. If A1, A2
and A5 all land, `core/` and `harness/` divergence goes to **zero** and the fork
reduces to `plugins/` plus the A4 identity files — the shape §7 argues it should
have had all along.

**A note on `dist/` in a submission.** Regenerating is mandatory (upstream's own
drift guard fails otherwise) but it inflates the diff. That is expected and
correct: upstream commits `dist/` too, and `package.ts --check` is what proves the
generated trees match the source you changed.

## 7. What the merges taught us

Recorded because each of these will recur, and none was predicted by §2.

### From 2.5.33 (2026-08-01)

**The fork's merge cost was self-inflicted, and one change caused all of it.**
This merge produced 8 conflicts and *every one* was the version number —
`core/tools/aidlc-version.ts`, `CHANGELOG.md`, the README badge, and the five
generated `dist/` copies. `AGENTS.md`, `gen-coverage-registry.test.ts`, and
`docs/guide/harnesses/kiro-ide.md` all auto-merged. So the merge would have been
**zero-conflict** if the fork had not been maintaining its own version line.

Trace it back and it is one decision. B1 was the first fork change that could not
be a plugin. It forced an edit to `core/`, which under the inherited changelog
policy forced a core version bump, which un-froze a version line the fork had
deliberately frozen at `80a96461`. From then on the three bookkeeping files
conflicted on every single release — 223 upstream edits over 60 days — the patch
numbers collided twice, and each collision needed a judgement call about an entry
that had already shipped. B1 also brought the `gen-coverage-registry` ratchet line
(37 more edits) and the 147-line adapter conflict (8 more, the only high-severity
one). And it does not work on IDE ≥1.0.

**The lesson is not "B1 was a mistake."** It is that *the first change which
escapes `plugins/` is much more expensive than it looks*, because it can drag
policy obligations behind it that outlive the change itself. Price that in before
accepting a core edit, and prefer offering it upstream.

B1 was deleted the same day (§2), keeping only the 8-line prose rule as A5. What
survived is worth noticing: the *rule* was correct and general — chat rendering is
mandatory before parking a turn, derived from two real field failures — and only
the *enforcement mechanism* was unavailable. 386 lines of machinery reduced to 8
lines of prose that say the same thing to the only reader who can act on it. When
a hook cannot verify something, the honest form is an instruction, not a hook that
looks like it verifies.

**Fixing a red test can be the wrong move — check whether upstream already did.**
`t89`'s 13 failures were a genuine upstream fixture gap, so the fix was written
by hand: five `aidlc-claim-sources.md` fixtures plus two assertion updates. Moving
it onto an upstream base to submit it revealed upstream had shipped *the same five
files and the same two assertions* in 2.5.33 — the work was thrown away. **Before
writing a fix for anything that reproduces at upstream tip, `git fetch` and check
whether tip has moved.** Upstream ships ~1.6 releases a day; the tip you measured
against this morning is not the tip.

### From 2.5.30 (2026-07-31)

**A dead hook layer can sit there for releases without anyone noticing.** The
fork shipped nine legacy `.kiro.hook` files and zero v2 `.json` hooks. Upstream
`#614` (`17686cec`) records that Kiro IDE ≥1.0.1xx silently stopped executing the
legacy format — field-proven on 1.0.165. So the fork's entire IDE hook layer
(audit, sensors, mint, block, runtime-compile) was inert on any current IDE, and
the test suite could not see it because the suite tests the *files*, not whether
the host loads them. **Lesson: after any sync, diff `dist/<harness>/.kiro/hooks/`
against upstream's — a hook the host no longer loads is invisible to CI.**

**A `CHANGELOG.md` conflict can be unresolvable by "keep both".** The fork's
local `2.5.8` / `2.5.9` headings collided with upstream's own `2.5.8` / `2.5.9`,
and `t68` rejects duplicate `## [N.N.N]` headings. Renumbering ours forward would
have re-announced a feature we had just learned was broken. **Lesson: when fork
patch numbers collide with upstream's, supersede — fold the fork's entries into a
single new entry at the post-merge version — rather than renumber.**

**"Both sides only added" is a real resolution, and the common one.** The
`aidlc-kiro-adapter.ts` conflict looked like the highest-risk row in this table
and resolved in minutes: upstream added `isRecord()` + `PAYLOAD_TARGETS`, we had
added `countBlankAnswers()` + `selfPacedQuestionMode()`, and neither touched the
other. Read both hunks before assuming you must choose.

**Prefer upstream's prose even where ours is not wrong.** Upstream's rewrite of
`docs/reference/kiro-ide-hook-payload.md` documents both IDE hook generations,
which ours did not. Taking theirs and appending a dated fork observation — in
this case that `tool_input` *was* populated on Pre/Post for write and shell tools
on a newer build, contradicting their `tool_input: {}` table — keeps the fork's
measurement without maintaining a parallel chapter.

**Verify `dist/` staging, not just `dist/` content.** After `git checkout --ours dist/`
plus a regenerate, eight files were correct in the working tree but still held the
placeholder in the index. `bun scripts/package.ts --check` reads the working tree
and passed anyway. **Lesson: after the regenerate, `git add -A dist` and confirm
`git status --porcelain` shows nothing unstaged — `--check` will not catch a
staging mistake.**
