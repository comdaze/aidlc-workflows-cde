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

**CI — there is none. Every guard in this chapter is a human step.**
`.gitlab-ci.yml` was added 2026-08-02 (`88c6aa42`), disabled 2026-08-03
(`25321eb2`, a blanket `workflow: rules: - when: never`), and deleted 2026-08-04.
The inherited `.github/workflows/ci.yml` still exists for upstream parity but does
nothing here — it keys off `github.event.pull_request.base.sha`, a GitHub-only
trigger. So no push and no merge request runs anything on a server.

Run these yourself, and treat them as the merge gate:

```bash
bun run check                                  # dist byte-parity + typecheck + lint
bun tests/run-tests.ts --smoke --unit --parallel 4
bun scripts/ci-changelog-guard.ts cde/main     # no CHANGELOG.md entry was dropped
```

And the fourth one, which used to be a scheduled job (`upstream-drift`) and is now
the weekly ritual this chapter's cadence depends on: fetch `github/v2`, count the
pending commits, run the §5 derivation for the real conflict surface, and check for
collapsed GitHub alert blocks (the A4 reformat trap).

> [!IMPORTANT]
> **The cadence is a promise again, not a mechanism.** That is the cost of deleting
> the CI, and it is the same condition that let 15 collapsed alert blocks and a
> 16-entry `CHANGELOG.md` deletion both land unnoticed before 2026-08-02. Upstream
> ships ~1.6 releases a day, so a week of not remembering is ~14 commits of drift.
> If the weekly sitting keeps slipping, re-enable the pipeline rather than
> re-discovering this paragraph.

> [!NOTE]
> **If a merge request will not merge, check the merge checks, not the branch.**
> With no pipeline being created, a project that has GitLab's **Pipelines must
> succeed** check enabled (Settings → Merge requests) blocks every MR forever — it
> waits on a success that can never arrive. Turning CI off and leaving that check
> on is the trap; turn both off together.
>
> Recovering the pipeline is one command, since the file is only deleted, never
> lost: `git show 25321eb2:.gitlab-ci.yml > .gitlab-ci.yml`, then replace the
> blanket `when: never` with the rule set from `9b78ae27`, which gates each job to
> a merge-request event, `main`, a schedule, or a manual run — and, critically,
> creates NO pipeline when none of those match. Without that block GitLab builds an
> empty pipeline on every topic-branch push, marks it failed, and mails the project
> — a red with `0 failed jobs`, which is what soured the first attempt at CI here.

## 1. The shape of the problem

Divergence of the merged tree against `github/v2`, re-derived 2026-08-01 at
upstream `9c9201b8`:

| Surface | Files changed by us | Conflict risk |
| --- | --- | --- |
| `plugins/` | 59 | **None.** Ours entirely; upstream has no such directory. |
| `docs/` | 8 | None in practice. Fork-authored chapters live under `docs/fork/`, a path upstream has none of — see A6. |
| `dist/` | 256 | **Not a conflict** — generated. Never merge it; regenerate (§3). |
| `core/` | 2 | Low. Both are small and policy-driven, not functional. See A1, A2. |
| `harness/` | 6 | **One real risk**, the Kiro IDE adapter. See B1. |
| `tests/` | 3 | Low. One new file, one ratchet entry, one appended guard. See A5, A10. |
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
| 81 | `README.md` | badge **resolved** (A3); plugins section (A4) + install text (A1, in PR #701) |
| 72 | `CHANGELOG.md` | **resolved** (A3) — upstream's, plus one inert frozen block |
| 70 | `core/tools/aidlc-version.ts` | **resolved** (A3) — no longer diverges |
| 37 | `tests/unit/gen-coverage-registry.test.ts` | **resolved** — the ratchet line went with B1 |
| 25 | `core/tools/aidlc-utility.ts` | one doctor string (A1, in PR #701) |
| 11 | `AGENTS.md` | the plugins paragraph + the changelog policy (A4) |
| 8 | `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` | **resolved** — B1 deleted, byte-identical again |
| 8, 7, 7, 7, — | `harness/*/onboarding.fills.ts` (5) | one prereq sentence each (A1, in PR #701) |
| 4 | `harness/kiro-ide/skills/aidlc/question-rendering.md` | one 8-line rule (A5) |
| 3 | `.gitignore` | A4 |
| 1 | `core/knowledge/.../security-guide.md` | one word (A2) |

The top three were **65% of the fork's entire exposure and none of them was a
feature** — they were version bookkeeping the fork created for itself. A3 removed
them; deleting B1 removed 45 more edits' worth, including the only high-severity
row. Exposure is down from 341 to **150**.

What is left is only two kinds of thing:

- **A1, A2, A5 — upstreamable, and A1 is already submitted** as
  [#701](https://github.com/awslabs/aidlc-workflows/pull/701). The fork's text is
  byte-identical to that PR, so A1 self-resolves on merge.
- **A4 — fork identity.** Unavoidable, but every hunk is additive.

**Fork changes outside `plugins/` and `dist/`, measured against the merge base:**

| Surface | Files | Rows |
| --- | --- | --- |
| `docs/` | 16 | A1 (7 files) + A6 (`docs/fork/`, 4 files) + 5 files no row explains — see §2's unclassified note |
| `harness/` | 7 | A1 (5 `onboarding.fills.ts`) + A5 + `codex/manifest.ts` (unclassified) |
| `core/` | 2 | A1 (`aidlc-utility.ts`) + A2 — but `aidlc-utility.ts` also carries +92 unclassified lines |
| `tests/` | 6 | A10 (1 appended guard) + 5 files no row explains — see §2's unclassified note |
| `scripts/` | 2 | **all unclassified** |
| root | 9 | A1 (`README.md` install text) + A4 |

Re-derived 2026-08-03. `tests/` and `scripts/` **were** byte-identical to upstream
and no longer are — the drift arrived without a row, which is the exact failure
this document exists to prevent. See the unclassified note at the end of §2.
**Note the measurement
trap:** diff against `git merge-base HEAD github/v2`, not against `github/v2`. The
latter also reports files where upstream is merely *ahead* — after the 2.5.33 sync
that was four `tests/` files and `docs/reference/09-testing.md` from #668, none of
which the fork has touched at all.

## 2. The inventory

Forty-one files outside `plugins/` and `dist/` (re-derived 2026-08-03), but only
**eight live logical changes** (A1, A2, A4, A5, A6, A7, A8, A9 — A3 and B1 are
resolved) plus one cluster no row explains yet. Resolve by change, not by file.

> [!NOTE]
> The file counts in §1 and §5's aggregate table were derived on 2026-08-03 and do
> **not** include A7/A8/A9 (added 2026-08-04): +8 `core/` files, +3 `harness/`
> files, +2 `scripts/` files, +5 `docs/` files. In particular, B1's
> "byte-identical again" claim for `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts`
> is **no longer true** — A8 re-opens that file. It is a 40-line addition rather
> than B1's 145, and it is upstream-bound, but treat the adapter as a live conflict
> surface again. A9 also puts `scripts/` on the map for the first time with a
> classified row (the two files there were previously "all unclassified").

### A1 — No piped shell scripts for `bun` / `uv` (13 files) — **submitted upstream**

| | |
| --- | --- |
| Files | `core/tools/aidlc-utility.ts` (doctor fix hint) · `harness/{claude,codex,kiro,kiro-ide,opencode}/onboarding.fills.ts` · `README.md` · `docs/guide/01-getting-started.md` · `docs/guide/15-troubleshooting.md` · `docs/guide/harnesses/{kiro-cli,kiro-ide}.md` · `docs/reference/{06-hooks-and-tools,11-contributing,14-claude-features}.md` |
| Class | **A — must diverge until the PR lands.** Internal policy: do not instruct users to pipe a network script into a shell. |
| Upstream | **Submitted: [awslabs/aidlc-workflows#701](https://github.com/awslabs/aidlc-workflows/pull/701).** The fork's text is byte-identical to that PR, so **A1 disappears from this table the moment it merges** — no follow-up edit needed. |
| On conflict | Keep ours. Each site is a self-contained sentence; if upstream rewrites the surrounding prose, re-apply the substitution rather than reverting their edit. |

The canonical wording, so every site stays consistent:

```
bun        brew install bun   /  npm install -g bun     https://bun.com/docs/installation
uv / uvx   brew install uv    /  pipx install uv        https://docs.astral.sh/uv/getting-started/installation/
```

`brew install bun` is the homebrew-core spelling. Earlier fork text used the older
`oven-sh/bun/bun` tap form; both work, but only one matches upstream's PR, and
matching is what closes the row.

> [!IMPORTANT]
> **Claude Code's own installer is deliberately left as a piped script.** Anthropic
> documents the native installer as the recommended path and has *deprecated* npm
> installation of Claude Code, so replacing it would push readers onto a deprecated
> method for a tool this project does not own. The policy is applied to the two
> prerequisites this project asks for — `bun` and `uv` — not to third-party tools
> whose vendors own the guidance. `brew install --cask claude-code` exists and is
> already mentioned in `docs/reference/11-contributing.md` if you want it.

**This row was under-applied for months.** It was recorded as 5 files, but the
policy was only ever satisfied in those 5 — `README.md`, `harness/opencode/`, both
harness guides, and four reference/guide docs still told the reader to pipe a
script into a shell. If a row states a *policy* rather than a patch, verify the
policy holds repo-wide, not just in the files the original commit happened to
touch:

```bash
grep -rnE 'bun\.sh/install|astral\.sh/uv/install|irm bun\.sh' \
  --include='*.ts' --include='*.md' core harness docs README.md
```

Anything it prints is a gap. (It also matches the recognition snippet in this
chapter, which is the one legitimate hit.)

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
| Files | `README.md` (**+12 lines, 2 hunks**: the 中文 link and an 11-line pointer to `PLUGINS.md`) · `PLUGINS.md` (new) · `README.zh-CN.md` (new) · `AGENTS.md` (the plugins paragraph + the A3 changelog policy) · `CHANGELOG.fork.md` (new, A3) · `.gitignore` (+`.refer`, +`/build`) · `Config` (BuilderHub package descriptor) |
| Class | **A — must diverge.** These describe *this* repository, not the framework. |
| Upstream | No. `Config` and `/build` are GitFarm/Brazil artefacts; `.refer` is our scratch directory; the plugin docs are about plugins upstream does not ship. The Chinese READMEs are arguably offerable but would then need upstream maintenance. |
| On conflict | Keep ours, additively. `README.md` and `AGENTS.md` are the two upstream also edits: take upstream's body and re-apply our two hunks. `PLUGINS.md`, `README.zh-CN.md` and `CHANGELOG.fork.md` can never conflict — upstream has no such paths. |

**`README.md` was the fork's worst file and is now nearly clean.** It carried a
101-line inline plugins section, which moved to `PLUGINS.md` (upstream has no such
path, so it cannot conflict) leaving a short pointer. Divergence went from
**+176/−62 across 20 hunks** to **+21/−9 across 3**, and one of those three is A1,
which self-resolves when #701 merges. What remains after that is 12 additive lines.

**The extraction also uncovered why this file kept conflicting: it had been
destructively reformatted, and most of the "divergence" was damage, not content.**
Measured against the merge base, upstream carried **5** collapsible `<details>`
harness sections and **56** markdown links; the fork carried **0** and **40**. All
8 GitHub alert blocks were collapsed onto one line, and stray blank lines had been
inserted before closing code fences. So the fork was shipping a README with the
harness install sections permanently expanded, 16 links gone, and every alert
rendering as a plain blockquote.

The rebuild starts from upstream's file and re-adds only the two genuine fork
hunks, which restores all of it. Same treatment found two live bugs in
`README.zh-CN.md`: a piped `bun` installer the A1 sweep had missed (that file was
outside the grep scope), and a plugin-install URL of
`github.com/comdaze/aidlc-workflows` — which stopped pointing at this repository
the moment a real fork of upstream was created under that exact name.

> [!TIP]
> **Prefer a separate file over an inline section for anything upstream does not
> have.** `PLUGINS.md`, `README.zh-CN.md`, `CHANGELOG.fork.md` all cost exactly zero
> merge effort forever, because upstream has no file at those paths. Every line of
> fork content living inside a file upstream also edits is a line you re-resolve on
> a cadence — and, as this file proved, a surface where silent formatting damage can
> hide among the legitimate diff.

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

### A6 — Fork-authored documentation lives in `docs/fork/` (4 files)

| | |
| --- | --- |
| Files | `docs/fork/README.md` · `docs/fork/divergence.md` (this file) · `docs/fork/kiro-spec-integration.md` · `docs/fork/research/2026-07-31-kiro-spec-hook-probe.md` |
| Class | **A — must diverge, and free.** Upstream has no `docs/fork/`, so no file here can ever conflict. |
| Upstream | `divergence.md` and the index are about *this* repository and never go upstream. `kiro-spec-integration.md` is a measurement of Kiro's hook surface and **is** offerable — upstream has nothing on it (checked 2026-08-03: zero branches, PRs or open issues; their only statement is `README.md`'s "stay in Vibe mode, decline spec mode"). Offering it would move the file, not copy it. |
| On conflict | Cannot conflict. |

**These two chapters were `docs/reference/19-…` and `20-…` until 2026-08-03, and
that was a conflict waiting on a calendar.** Upstream's numbered `docs/reference/`
chapters run 00–18 and climb; the moment upstream adds its own `19-*.md` the merge
is an add/add conflict over a filename, and the fork's chapter has to be renamed
anyway. Sitting in upstream's numbering space also cost two rows in
`docs/reference/00-overview.md` — a file upstream edits — so a doc upstream does
not have was generating permanent resolution work in a file upstream does.

> [!IMPORTANT]
> **Do not index fork chapters from an upstream-owned file.** The move removed the
> two `00-overview.md` rows, and that file is now byte-identical to upstream again.
> Do not put them back, and do not add them to `zensical.toml`'s nav either —
> both files belong to upstream and both are edited there. A nav entry for a
> chapter upstream does not ship is a line you re-resolve on every sync, forever.
> `docs/fork/README.md` is the index; `AGENTS.md` already points at this file, and
> that pointer is an existing A4 hunk rather than a new surface.

This is the A4 `PLUGINS.md` lesson applied to a directory: **anything upstream
does not have belongs at a path upstream does not have.** `plugins/`,
`CHANGELOG.fork.md`, `PLUGINS.md`, `README.zh-CN.md` and now `docs/fork/` all cost
exactly zero merge effort forever, for the same reason.

One consequence to accept: `docs/fork/` is outside the published site's nav, so
these chapters do not appear on the docs site. That is the correct trade — the nav
lives in an upstream file.

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

### A7 — Sensor cost: probe memo + coalesce window (8 files) — **upstream-bound**

| | |
| --- | --- |
| Files | `core/tools/{aidlc-lib,aidlc-sensor,aidlc-sensor-schema,aidlc-sensor-linter,aidlc-sensor-type-check,aidlc-utility}.ts` · `core/hooks/aidlc-sync-statusline.ts` · `core/sensors/aidlc-{linter,type-check}.md` · docs: `docs/harness-engineering/06-sensors.md` · `docs/reference/07-sensor-system.md` · `docs/guide/12-cli-commands.md` |
| Class | **B — general, not CDE-specific.** Nothing here knows about CDE, PoCs or plugins; it is a cost bug in the sensor spine that any project with a whole-project toolchain hits. |
| Upstream | **Offer it.** The measurement is the argument (below), and the design is additive: one optional manifest field, one new subcommand, one doctor row. Default behaviour with the field absent is byte-for-byte the old behaviour. |
| On conflict | Keep ours, re-apply onto upstream's version. The pieces are independent — the probe memo, the coalesce ledger and the bounded audit tail can each be re-applied alone. |

Measured on a real eight-step PoC run (`goldwind-edm-poc`, 870 audit events, 314
sensor fires):

| | fires | failures | median | total |
| --- | --- | --- | --- | --- |
| `linter` | 50 | 0 | 10.8 s | **542 s** |
| `type-check` | 50 | 13 | 9.0 s | **406 s** |
| the three document sensors | 214 | 12 | ~50 ms | 11 s |

**98.9% of sensor wall-clock in two sensors, on 5 distinct files.** Three separate
causes, three fixes:

1. **The probe was re-paid per fire.** Every one of the 50 `linter` fires ended
   `Note: tool-unavailable` after ~11 s: the project has no eslint, so `bunx
   eslint@10` went to the registry and failed, 50 times, to re-derive the same
   answer. Now: an on-disk config walk answers the no-config case with zero
   subprocesses (measured 8.4 s → 0.044 s on that project's own file), and the
   availability probe is memoized per anchor dir with a TTL plus a
   dependency-manifest fingerprint so `bun add eslint` is still seen next fire.
2. **Whole-project cost paid per write.** `tsc --project` checks everything and
   the sensor then filters to the written file — correct semantics, but the tenth
   edit costs what the first did. Now: optional `coalesce_seconds` (120 on both
   code sensors) defers a repeat fire for the same stage, `aidlc-sensor flush`
   lands the deferred work before a gate, `--doctor` reports what is outstanding,
   and a fire after a FAILED one is never coalesced.
3. **The audit hot path read everything.** `aidlc-sync-statusline` runs on every
   `execute_bash` and needs only the latest `STAGE_STARTED`; it was reading the
   whole trail, 276 KB by the end of that run. Now: a 64 KB bounded tail aligned
   to a block boundary, falling back to the full read when the window holds no
   `STAGE_STARTED`. Verified same-answer on the real trail.

> [!IMPORTANT]
> **Coalescing must never become silent skipping.** The three properties that keep
> it deferral — no coalesce after a FAILED fire, a recorded `deferred` count with
> the newest unseen path, and `flush` + a `--doctor` row to discharge it — are the
> whole reason this is acceptable in a framework whose thesis is that verification
> is not optional. If a future edit drops any of them, the feature becomes a way
> to lose a check quietly. The stamp is also written *after* the terminal audit
> row on purpose: a crash mid-fire must leave the pair fireable, not
> falsely-verified.

### A8 — Kiro IDE: one PostToolUse(execute_bash) hook, not two (3 files) — **upstream-bound**

| | |
| --- | --- |
| Files | `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` (+~40) · `harness/kiro-ide/hooks/aidlc-shell-post.json` (new) · `harness/kiro-ide/manifest.ts` · `docs/guide/harnesses/kiro-ide.md`. Deletes `hooks/aidlc-{runtime-compile,sync-statusline}.json`. |
| Class | **B — general, not CDE-specific.** |
| Upstream | **Offer it** together with A7 — same run produced both findings. |
| On conflict | Keep ours. If upstream has since edited either superseded `.json`, that edit is moot: re-apply the merge and carry their description text into `aidlc-shell-post.json`. |

`aidlc-runtime-compile` and `aidlc-sync-statusline` were two registrations sharing
the `execute_bash` matcher, and both are payload-independent on the IDE — so every
shell command paid two `bun` startups to run two hooks that need nothing from the
event. `aidlc-shell-post` runs both in one process via a `__shell_post__` fan-out
in the adapter, mirroring the existing `__audit_and_sensors__` pattern. The core
hook files are untouched and still run in the same order.

Also in the adapter: failed writes are no longer recorded as hook drops. A
permission denial or a `str_replace` whose anchor never matched has no artifact to
audit, so declining is correct — but recording it made
`.aidlc-hooks-health/kiro-adapter.drops` read like lost data (7 of 7 drops in the
measured run were failures, not decay). Unknown wordings still record a drop,
because an unrecognised *success* wording is exactly the decay the drop file
exists to catch.

> [!WARNING]
> **Copying a tree over an install merges; it never prunes.** An install upgraded
> in place keeps its old `aidlc-runtime-compile.json` / `aidlc-sync-statusline.json`
> and runs the same two hooks twice per shell command. Harmless (idempotent,
> advisory) but pure overhead — `--doctor` reports it under **Superseded hook
> registrations**. The legacy `.kiro.hook` pair is deliberately left split: pre-1.0
> IDE has no v2 reader.

### A9 — Plugin parity across all five harnesses (4 files) — **upstream-bound**

| | |
| --- | --- |
| Files | `scripts/plugin-hooks-template/compose.ts` · `scripts/package.ts` · `harness/opencode/skills/aidlc/SKILL.md` · `docs/reference/18-plugin-mechanism.md` |
| Class | **B — general, not CDE-specific.** Two host-shape bugs in the plugin mechanism plus the sentinel drift they exposed; nothing here knows about CDE or PoCs. |
| Upstream | **Offer it.** Small, independently applicable, and it makes upstream's own "validated across all four harness projections" claim true for five. |
| On conflict | Keep ours; each of the three fixes is independent. The `compose.ts` hunk must stay in sync with `resolveSkillsPath` — if upstream changes that resolver, re-derive the probe rather than re-applying the patch verbatim. |

Measured by composing `poc-accelerator` into a scratch install of each of the five
harnesses and counting what landed. Before: two harnesses were silently degraded.

- **Codex got no stage runners.** Compose probes `<harness-dir>/skills` to decide
  whether to regenerate runners, but Codex discovers skills at
  `<project>/.agents/skills/` and ships nothing under `.codex/skills/`. Every file
  composed correctly and the orchestrator tables refreshed (that lookup already had
  the `.agents` fallback) — but `runners=0`, so the plugin had no `/…` entry point,
  and the only trace was an advisory drop. The probe now mirrors
  `aidlc-runtime-paths.ts` `resolveSkillsPath`, which is what `aidlc-runner-gen`
  writes through. Codex: 0 → 9 runners.
- **opencode refreshed neither table.** Its authored `SKILL.md` carried an em dash
  where the shared sentinel literal has a hyphen, and no stage-graph marker pair at
  all. That broke the splice for plugins **and** for the framework's own
  `aidlc-utility.ts scope-table` / `stage-table` — verified by running both against
  an opencode install before and after.
- **Kiro plugin auto-compose was a dead promise.** The emitter shipped only the
  legacy `.kiro.hook` compose hook, which is inert on Kiro IDE ≥ 1.0.1xx. It now
  emits the v2 `.json` alongside it (`SessionStart`), same coexistence the framework's
  own Kiro tree uses. The supported Kiro path remains the explicit compose command.

After: all five harnesses identical — 8 stages, 1 scope, 2 sensors, 9 runners,
scope row + 8 stage rows in the orchestrator table, zero compose drops.

> [!IMPORTANT]
> **A one-character drift in a sentinel is a silently dead code path.** The
> opencode em dash cost two table refreshes for as long as that file existed, and
> nothing failed — no test, no doctor row, no drop. When porting to a sixth
> harness, diff the `<!-- BEGIN: … -->` literals against `aidlc-utility.ts` rather
> than eyeballing them.

### A10 — Generated state files were missing `Construction Autonomy Mode` (2 files) — **upstream-bound**
| | |
| --- | --- |
| Files | `core/tools/aidlc-utility.ts` (one line in the state-file template literal) · `tests/integration/t12-state-fixture-validation.test.ts` (additive guard, appended test) |
| Class | **B — general, not CDE-specific.** A plain defect in upstream's state-file generator. Nothing here knows about CDE, PoCs, or any fork plugin. |
| Upstream | **Offer it.** One line plus one static test; independently applicable and it restores an engine capability that is currently unreachable from a clean start on every scope. |
| On conflict | Keep ours. If upstream rewrites the `## Current Status` block, re-derive from `state-template.md` rather than re-applying the patch — the point of the row is that the two files must agree, not that this exact line exists. |
`state-template.md` documents `- **Construction Autonomy Mode**: [unset/autonomous/gated]`
under `## Current Status`. The generator emitted that section with five fields and
never wrote this one, so **every freshly initialised workflow, in every scope,
produced a state file without the field.** `aidlc-bolt.ts set-autonomy` writes it
with `setFieldStrict`, which hard-fails on an absent field, so:
```
bun .kiro/tools/aidlc-bolt.ts set-autonomy --mode autonomous
→ {"error":"State update failed: Field not found in state file: \"Construction Autonomy Mode\"..."}
```
Reproduced on a scratch install with `--scope feature`, not just the fork's own
`vibe` scope — the field appeared 0 times and the command failed identically. The
consequence is that **autonomous Construction could not be switched on at all**
through the documented command, and every consumer that reads the field via
`getField` (the Stop hook's block cap, `state.ts park`, `utility.ts`
scope-change/recompose refusals) silently took its not-autonomous branch.
Found by installing the framework into this repository and opening a real session
— the Stop hook then nudged the container as an abandoned workflow, which is
precisely what the missing field was supposed to prevent.
> [!IMPORTANT]
> **The guard was right; the brand-new file was what looked legacy.** t33 already
> tested `set-autonomy`'s hard-fail on an absent field and labelled it the "v4
> state file" guard — so the failure was not only reachable, it was *tested*, under
> a name that said it could not happen to a current file. A guard whose name
> asserts an impossible precondition stops being read as a live constraint.
>
> Nothing caught it because every existing check compared a **fixture** to the
> template, and the fixtures were written *from* the template. The generator was
> never compared to either. The new guard closes exactly that edge, and it is
> deliberately static (it reads both shipped files, spawns nothing) so it stays
> inside t12's "Mechanism: none" character. Verified failing before the fix and
> passing after — a guard nobody has watched fail is not yet a guard.
Note the file cost: `core/tools/aidlc-utility.ts` now carries **three** fork
stakes (A1's doctor hint, U2's +92 doctor lines, and this line). It is upstream's
25-edits-in-60-days file, so pricing this as "one line" understates it — the
merge cost is per-file, not per-line.

### Unclassified — real divergence with no row above (found 2026-08-03)

Running §5 against the merge base turns up 14 files that none of A1–A6 explains.
They are listed, not judged: each needs a class, an upstream verdict and an
on-conflict instruction, and none of that should be invented from a diff. **Until
they have rows, §2 is not a complete checklist and a sync will hit these
unprepared** — which is the failure mode the document exists to prevent.

| Cluster | Files | What it is |
| --- | --- | --- |
| **U1 — Codex plugin-marketplace layout** | `scripts/package.ts` · `scripts/manifest-types.ts` · `harness/codex/manifest.ts` · `tests/harness/harness-matrix.ts` · `tests/integration/t188-plugin-compose.test.ts` · `docs/reference/18-plugin-mechanism.md` · `docs/harness-engineering/10-authoring-a-plugin.md` | Commit `20a9cf44`. Emits Codex's current repository-marketplace layout (`.agents/plugins/marketplace.json` → `./plugins/aidlc-<name>/`) instead of the flat `.codex-plugin/` projection. **Reads as harness-neutral and upstream-bound**, and it is the first fork change to touch `scripts/` and `tests/` — the two surfaces this document claimed were byte-identical. |
| **U2 — Kiro IDE hook-registration doctor check** | `core/tools/aidlc-utility.ts` (+92, shares the file with A1's 2-line hint) · `tests/unit/t259-doctor-ide-hook-registration.test.ts` (new) · `tests/unit/gen-coverage-registry.test.ts` (ratchet) · `tests/.coverage-registry.json` (ratchet) | Makes `doctor` report a *dead* Kiro IDE hook layer rather than only checking that hook bodies exist — the gap that let the fork ship an inert IDE hook layer for months (§7, 2.5.30). **Also reads as upstream-bound**; it is a general defect in their doctor, not CDE behaviour. Note the shape: a `core/` edit plus a ratchet entry is exactly B1's cost profile (§7). `CHANGELOG.fork.md` says "Submitted upstream" for this, but **no such PR exists** — checked 2026-08-03, the only open fork PR is #701 (A1). Treat it as unsent. |
| **U3 — `poc-accelerator` docs inside upstream guide files** | `docs/guide/05-scopes-and-depth.md` (+6) · `docs/guide/13-customization.md` (+50) | Documents a fork plugin inside two files upstream edits. **A4's own TIP argues against this shape** — the content belongs in `plugins/poc-accelerator/README.md` or `PLUGINS.md` with at most a pointer left behind, the same treatment `README.md` got. |
| **U4 — Kiro hook-payload fork observation** | `docs/reference/kiro-ide-hook-payload.md` (+23) | The dated measurement note appended to upstream's chapter. §7 explains the *decision* (prefer upstream's prose, append a dated observation) but no row owns the file. Companion to A6's `kiro-spec-integration.md`, and offerable with it. |

Two of these are the pattern §7 warns about: a change that could not be a plugin,
taken as a core/scripts edit without pricing the sync cost. Both look
upstream-bound, which is the cheap exit — §6 is the procedure.

## 3. `dist/` is generated — never merge it

261 files diverge and that is expected. The resolution is mechanical:

```bash
git checkout --ours dist/            # or --theirs; the content is discarded either way
bun scripts/package.ts               # regenerate from core/ + harness/ + plugins/
bun scripts/package.ts --check       # byte-parity gate: must print all trees in sync
```

Byte-parity is what makes this safe: a mis-resolved `dist/` cannot survive
`--check`. **Never hand-edit a `dist/` conflict hunk** — the result would be a
tree that no source produces, and `bun scripts/package.ts --check` catches it the
moment you run the gate above.

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
| **Timeout flakes (a whole class, not a list)** | **Environmental.** Any test that spawns a subprocess — a tool, a hook, `run-tests` itself — can exceed its per-test or hook timeout when the tier runs `--parallel 8` on a loaded machine. Observed on `integration/t188`, `unit/t248`, `smoke/t05`, `unit/t150` in a single afternoon; every one passed standalone, and `t248` and `t05` were confirmed green on an unmodified `github/v2` worktree too. **Signature:** the message says `timed out after <n>ms` or `a beforeEach/afterEach hook timed out`, and there is **no assertion diff** — no `Expected`/`Received`. A real failure always prints one. **Re-run the single file before investigating** — that is a retry, not a bug hunt. If it becomes frequent, lower `--parallel` rather than raising timeouts; `--parallel 4` has been reliable on this hardware where `-P 8` was not. |

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

**Open submissions.** A1 is [#701](https://github.com/awslabs/aidlc-workflows/pull/701).
A2 (one word, inclusive language) and A5 (one 8-line rule) are still unsent and
should go as separate PRs — they are unrelated concerns and bundling them would
give a reviewer three reasons to hesitate instead of one to agree.

**Make the fork's text byte-identical to the submission.** This is the step that
actually closes a row. If the fork keeps its own phrasing while the PR carries
different phrasing, the divergence survives the merge and you get to resolve it
again by hand. A1 was brought into line with #701 before the PR was opened, so a
merge erases the row with no follow-up edit.

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
