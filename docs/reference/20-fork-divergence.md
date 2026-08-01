# Fork divergence from upstream `aidlc-workflows`

**What this is for.** This fork tracks `awslabs/aidlc-workflows` (branch `v2`).
Every upstream release is a merge, and a merge is only cheap if you know in
advance which files diverge and why. This is that list — the same discipline
`plugins/knowledge-plugin/tools/vendor/repo-to-ddd/VENDORED.md` applies to the
vendored engine, applied one level up to the fork itself.

**Read it as a checklist, not history.** Before an upstream sync, walk §2 and
decide each row. After a sync, run §4. §5 regenerates the whole table from git,
so re-derive rather than trust — the numbers below are a snapshot.

**Sync log.** Last merge: `github/v2` @ `d0cd10a6` (upstream 2.5.30) on
2026-07-31, landing as fork 2.5.31. Sixteen conflicts — eight source, eight
`dist/`. See §7 for what that merge taught us.

## 1. The shape of the problem

Divergence measured against the merge base with `github/v2`, re-derived
2026-07-31 (base `d0cd10a6`):

| Surface | Files changed by us | Conflict risk |
| --- | --- | --- |
| `plugins/` | 59 | **None.** Ours entirely; upstream has no such directory. |
| `docs/` | 8 | None in practice (new chapters + our own research notes). |
| `dist/` | 261 | **Not a conflict** — generated. Never merge it; regenerate (§3). |
| `core/` | 3 | Low. All three are small and policy-driven, not functional. |
| `harness/` | 6 | **One real risk**, the Kiro IDE adapter. See B1. |
| `tests/` | 2 | Low. One new file, one ratchet entry. See A5. |
| root files | 6 | Low, but **two are guaranteed conflicts every release**. See A3, A4. |

The plugin mechanism is doing its job: the majority of this fork's work lives in
`plugins/` and can never conflict. **Protect that property** — new CDE-specific
behaviour belongs in a plugin, not in `core/`. Anything that has to go outside
`plugins/` should be recorded here on the way in, not discovered at merge time.

## 2. The inventory

Twenty-five files outside `plugins/` and `dist/`, but only **six logical
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

### A3 — Framework version (1 file)

| | |
| --- | --- |
| File | `core/tools/aidlc-version.ts` |
| Class | **A — guaranteed conflict on every single upstream release.** |
| On conflict | Take upstream's number, then re-apply our patch level on top, and update `CHANGELOG.md` + the README badge in the same commit. `tests/unit/t68-version-changelog-sync.test.ts` pins all three agreeing, so a half-done resolution fails loudly. |

### A4 — Fork-identity root files (4 files)

| | |
| --- | --- |
| Files | `README.zh-CN.md` (new, +130) · `AGENTS.md` (+10, the plugins paragraph) · `.gitignore` (+`.refer`, +`/build`) · `Config` (new, BuilderHub package descriptor) |
| Class | **A — must diverge.** These describe *this* repository, not the framework. |
| Upstream | No. `Config` and `/build` are GitFarm/Brazil artefacts; `.refer` is our scratch directory. The Chinese README is arguably offerable, but it would then need upstream maintenance. |
| On conflict | Keep ours, additively. `AGENTS.md` is the only one upstream also edits — take upstream's body and re-apply our `plugins/` paragraph, the same shape as A1. |

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
> **Do not submit this.** The branch described below (`upstream/kiro-ide-gate-render-floor`,
> `44d89644`) is off `9f914544`, which the 2.5.30 merge superseded, and more
> importantly the floor it carries is inert on IDE ≥1.0 — see B1. Delete the
> branch. The remainder of this section is kept only as the recipe for
> hand-assembling *some future* submission off a fork commit, since the mechanics
> (strip the version bump, strip the plugin edits, regenerate `dist/`) apply to any
> B-class row.

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

## 7. What the 2.5.30 merge taught us

Recorded because each of these will recur, and none was predicted by §2.

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
