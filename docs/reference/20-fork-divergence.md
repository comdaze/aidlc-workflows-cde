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
| 81 | `README.md` | badge (**resolved**, A3) + the plugins section (A4) |
| 72 | `CHANGELOG.md` | **resolved** — A3, no longer diverges |
| 70 | `core/tools/aidlc-version.ts` | **resolved** — A3, no longer diverges |
| 37 | `tests/unit/gen-coverage-registry.test.ts` | one ratchet line, exists only for B1 (A5) |
| 25 | `core/tools/aidlc-utility.ts` | one doctor string (A1) |
| 11 | `AGENTS.md` | the plugins paragraph + the changelog policy (A4) |
| 8 | `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` | 147 lines in the enforcement path (B1) |
| 8, 7, 7, 7 | `harness/*/onboarding.fills.ts` | one prereq bullet each (A1) |
| 4 | `harness/kiro-ide/skills/aidlc/question-rendering.md` | B1 |
| 3 | `.gitignore` | A4 |
| 1 | `core/knowledge/.../security-guide.md` | one word (A2) |
| 0 | `tests/unit/t219-kiro-ide-gate-render-floor.test.ts` | B1, ours alone |

The top three were **65% of the fork's entire exposure and none of them was a
feature** — they were version bookkeeping the fork created for itself. A3 removed
them. What remains is B1 (49 edits' worth, and the only high-severity one) and A1
(54 edits' worth, one string repeated across five files). Both have exits: B1
gets rewritten or deleted, A1 gets offered upstream.

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

### A5 — Coverage ratchet entry (1 file)

| | |
| --- | --- |
| File | `tests/unit/gen-coverage-registry.test.ts` — one line in `EXPECTED_NONE_TO_CLI` |
| Class | **A — a consequence of B1, and it disappears with it.** |
| Why | `tests/unit/t219-kiro-ide-gate-render-floor.test.ts` spawns the adapter under bun, so `mechanismsOf()` derives `cli` for it. That pin is a deliberate manual ratchet; an unregistered spawning test reds the suite. |
| On conflict | Take upstream's array, re-insert our one line. Upstream appends to this array most releases, so expect this row to conflict often and resolve trivially. |

### B1 — Kiro IDE gate-render floor (4 files) — **needs re-implementation, not upstreaming**

| | |
| --- | --- |
| Files | `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` (+147) · `harness/kiro-ide/skills/aidlc/question-rendering.md` (+8) · `tests/unit/t219-kiro-ide-gate-render-floor.test.ts` (+230, new) · `docs/guide/harnesses/kiro-ide.md` |
| Commits | `fa2d9b63` (2.5.8), `fdb56a7a` (2.5.9) |
| Class | **B — should not be a fork divergence at all — but see the defect below.** |

The problem it addresses is real and general, not CDE-specific: the IDE gives the
Stop hook no transcript, so nothing verifies that an approval gate's options were
actually rendered in chat. Every Kiro IDE user of AI-DLC has this.

**The mechanism, however, does not work on IDE 1.x.** The floor returns
`{"decision":"block"}` from the `stop` adapter path, which was written against
the pre-1.0 `agentStop` contract. The 2.5.30 merge brought in upstream's v2 hook
descriptor, which states the case plainly:

> advisory-only: the IDE's Stop trigger cannot block; enforcement relies on the
> conductor's own Stop protocol
>
> — `dist/kiro-ide/.kiro/hooks/aidlc-stop.json`

So the floor is **inert** on IDE ≥1.0. Submitting it upstream as-is would be
submitting a no-op, and that is why the prepared branch in §6 was abandoned.

**The action is a rewrite, not a submission.** Either move the check to a trigger
that can actually block — `PreToolUse` and `UserPromptSubmit` both honour
`exit 2` on the v2 channel, which this fork verified directly (see
`docs/reference/kiro-ide-hook-payload.md`) — or delete the floor and rely on the
conductor's Stop protocol as upstream does. Until one of those happens, this row
is dead weight that still costs a 147-line conflict in the enforcement path every
release, and `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` is a file upstream
edits actively (the 2.5.30 merge conflicted here again).

Note also that `tests/unit/t219-kiro-ide-gate-render-floor.test.ts` now collides
with upstream's `tests/unit/t219-claude-project-dir-quoting.test.ts` in the same
tier. Harmless — the repo already carries same-tier `t125` and `t205` duplicates
— but it makes `bun test tests/unit/t219*` ambiguous. Renumber if the floor
survives the rewrite.

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

## 6. Prepared upstream submission (B1) — **withdrawn**

> [!WARNING]
> **Do not submit this.** The branch described below was off `9f914544`, which the
> 2.5.30 merge superseded, and more importantly the floor it carries is inert on
> IDE ≥1.0 — see B1. It was **deleted 2026-08-01** (`upstream/kiro-ide-gate-render-floor`,
> local-only, last at `44d89644`; recoverable from the reflog if ever needed, though
> nothing on it is unique — the floor itself and its test are both on `main`, and
> its one commit was purely a re-packaging for submission). The remainder of this
> section is kept only as the recipe for hand-assembling *some future* submission
> off a fork commit, since the mechanics (strip the version bump, strip the plugin
> edits, regenerate `dist/`) apply to any B-class row.

The two local commits are **not** cherry-pickable as-is: both also bump
`core/tools/aidlc-version.ts` plus five `dist/*/tools/aidlc-version.ts` copies,
edit `CHANGELOG.md` and `README.md` (fork-specific), and `fa2d9b63` additionally
touches `plugins/poc-accelerator/tests/plugin.test.ts` — a plugin that does not
exist upstream, for an unrelated biome lint fix.

Hand-assemble instead. Take exactly four files onto a branch off `github/v2`:

```
harness/kiro-ide/hooks/aidlc-kiro-adapter.ts
harness/kiro-ide/skills/aidlc/question-rendering.md
tests/unit/t219-kiro-ide-gate-render-floor.test.ts
docs/guide/harnesses/kiro-ide.md
```

Then `bun scripts/package.ts` to regenerate `dist/kiro-ide/`, and leave the
version bump and CHANGELOG entry to upstream's own release process. Drop
everything else.

Once a B row lands upstream, delete it from §2 and re-run §5. If B1 is resolved
either way — rewritten and upstreamed, or deleted — the fork's `harness/`
divergence falls to the four `onboarding.fills.ts` one-liners, and A5 goes with
it.

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
