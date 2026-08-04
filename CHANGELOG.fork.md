# Fork changelog

This is the **CDE fork's** own changelog, and the only place fork release notes
are added from 2026-08-01 onward. `CHANGELOG.md` belongs to upstream
`awslabs/aidlc-workflows`: the fork takes upstream's entries as they are and adds
none of its own — see the frozen-version policy in
`docs/fork/divergence.md` A3.

One historical exception lives in `CHANGELOG.md` rather than here: the 16 entries
`## [2.3.11]` through `## [2.3.26]`, published by the fork before this policy
existed. They stay where they are — the block is inert, upstream only appends at
the top of that file, and moving them would rewrite already-published history for
no gain. Do not resolve `CHANGELOG.md` with `git checkout --theirs` or you will
delete them.

**Why a separate file.** The fork used to bump `core/tools/aidlc-version.ts`,
add its own `## [N.N.N]` heading to `CHANGELOG.md`, and move the README badge.
Upstream ships roughly 1.6 releases a day, so those three files became the
fork's largest permanent conflict surface — 223 of the 341 upstream edits to
files this fork diverges on, measured over 60 days — and the patch numbers
collided outright twice (the fork's 2.5.8/2.5.9 against upstream's, then the
fork's 2.5.31 against upstream's `cd209eb1`). Nothing in the framework reads
this file, so it can never conflict.

**Framework version:** always upstream's, unmodified. Read it from
`core/tools/aidlc-version.ts` or `aidlc --version`.

**Plugin versions:** each plugin carries its own in
`plugins/<name>/.aidlc-plugin/plugin.json`, and that is the number to bump for
CDE-specific work. This restores the policy the fork already had at
`80a96461`: *"Going forward plugin-only changes bump the plugin version only."*

Entries below are keyed by date and by the upstream version the fork was
sitting on, not by a fork version number.

## 2026-08-04 (ci) — on upstream 2.5.33

**`.gitlab-ci.yml` is deleted; every guard in this repo is now a human step.** The
file was added 2026-08-02, disabled a day later with a blanket
`workflow: rules: - when: never`, and is now gone. Nothing runs on a server for a
push or a merge request. `docs/fork/divergence.md` carries the replacement: the
three commands that are the merge gate, the weekly upstream-drift ritual that used
to be a scheduled job, and the one-line recovery if you want the pipeline back.

Two things worth knowing, both recorded in that chapter:

* **If a merge request will not merge, look at the merge checks.** With no pipeline
  created, a project with GitLab's **Pipelines must succeed** check enabled
  (Settings → Merge requests) blocks every MR forever, waiting on a success that
  cannot arrive. Turn CI off and that check off together.
* **The first CI attempt soured on a false red, not a real one.** Every job was
  gated to a merge-request event, `main`, a schedule, or a manual run, and the file
  had no top-level `workflow:` block — so a plain topic-branch push created a
  pipeline, found nothing to run, marked it failed, and mailed the project. The
  notification said `0 failed jobs`, which is the tell. `9b78ae27` fixed it
  properly; if the pipeline ever comes back, start from that commit's rule set.

## 2026-08-04 (plugin harness parity) — on upstream 2.5.33

**A plugin now composes identically on all five harnesses.** Composing
`poc-accelerator` into a scratch install of each and counting what landed showed
two of them silently degraded — every file present, but a missing entry point on
one and no orchestrator tables on another, with nothing failing to say so. All
three fixes are general, not CDE-specific: see `docs/fork/divergence.md` A9.

* **Codex had no stage runners.** Compose probes `<harness-dir>/skills` to decide
  whether to regenerate runners, but Codex discovers skills at
  `<project>/.agents/skills/` and ships nothing under `.codex/skills/`. Every stage,
  scope and sensor composed correctly and the orchestrator tables refreshed — but
  **runners=0**, so the plugin's stages had no `/…` entry point, and the only trace
  was an advisory drop. The probe now mirrors `resolveSkillsPath`, which is what
  `aidlc-runner-gen` writes through. Codex: **0 → 9 runners**.
* **opencode refreshed neither the scope grid nor the stage graph.** Its authored
  `SKILL.md` had an **em dash** where the shared sentinel literal has a hyphen, and
  no stage-graph marker pair at all. That broke the splice for plugins *and* for the
  framework's own `aidlc-utility.ts scope-table` / `stage-table` — both now work on
  opencode, verified before and after against a real install.
* **Kiro plugin auto-compose was a promise the modern IDE could not keep.** The
  emitter shipped only the legacy `.kiro.hook` compose hook, inert on Kiro IDE
  ≥ 1.0.1xx. It now emits a v2 `aidlc-plugin-compose.json` (`SessionStart`)
  alongside it, the same coexistence the framework's own Kiro tree uses. The
  supported Kiro path is still the explicit compose command — now documented as
  such in the plugin README instead of implied.
* **`poc-accelerator` 0.23.1 (docs only):** the plugin's MCP knowledge gained the
  **opencode** row it never had — `mcp` key in `opencode.json`, `type` per server,
  `command` and `args` collapsed into one array, `env` renamed `environment` — plus
  a worked translation of the Global example. Both READMEs and `PLUGINS.md` now
  state the five-harness support explicitly, with the opencode install path and the
  Kiro no-auto-compose note.

After: all five harnesses identical — 8 stages, 1 scope, 2 sensors, 9 runners,
scope row + 8 stage rows in the orchestrator table, **zero compose drops**.

## 2026-08-04 (sensor cost + hook overhead) — on upstream 2.5.33

**A real eight-step PoC run spent 16 minutes of measured wall-clock inside two
sensors, and 9 of those minutes discovering the same thing 50 times.** The run's
own audit is the evidence: 870 events, 314 sensor fires, 98.9% of sensor time in
`linter` + `type-check`, both firing on just 5 distinct files. Everything below
follows from that measurement. Nothing is CDE-specific, so all of it is
upstream-bound — see `docs/fork/divergence.md` A7 and A8.

* **The toolchain probe is no longer re-paid per fire.** Every one of the 50
  `linter` fires ended `Note: tool-unavailable` after ~11 s, because the project
  has no eslint and `bunx eslint@10` went to the registry each time. The sensor
  now answers the no-config case from the filesystem before spawning anything
  (measured **8.4 s → 0.044 s** on that project's own file) and memoizes the
  availability probe per anchor dir, invalidated by a TTL *and* a
  dependency-manifest fingerprint so installing the tool is seen on the next fire.
  `type-check`'s `tsc --version` probe is memoized the same way.
* **New optional manifest field `coalesce_seconds`, set to 120 on both code
  sensors.** A repeat fire for the same (stage, sensor) pair inside the window is
  deferred instead of re-running the whole-project toolchain. Deferral, not
  dismissal: a fire after a FAILED one is never coalesced, the skip is counted in
  a coalesce ledger with the newest unseen output, **`aidlc-sensor flush
  [--stage <slug>]`** re-fires everything outstanding, and `--doctor` reports it
  under **Deferred sensor fires**. With the field absent, behaviour is unchanged.
* **The audit hot path reads a bounded tail.** `aidlc-sync-statusline` runs on
  every `execute_bash` and needs only the latest `STAGE_STARTED`; it was reading
  the entire trail, 276 KB by the end of that run. Now a 64 KB tail aligned to a
  block boundary, with a full-read fallback when the window holds no
  `STAGE_STARTED`. Same answer, verified against the real trail.
* **Kiro IDE ships one `PostToolUse(execute_bash)` hook instead of two.**
  `aidlc-runtime-compile` and `aidlc-sync-statusline` shared that matcher and are
  both payload-independent on the IDE, so each shell command paid two `bun`
  startups for nothing. The new `aidlc-shell-post` registration runs both core
  hooks in one process. **Upgrade note:** copying the tree over an existing
  install merges rather than prunes, so delete your old
  `aidlc-runtime-compile.json` and `aidlc-sync-statusline.json` — otherwise both
  fire alongside the merged hook and the two hooks run twice per shell command.
  `--doctor` reports the overlap under **Superseded hook registrations**.
* **Failed writes no longer look like lost data.** The Kiro adapter recorded a
  hook drop whenever it could not extract a path from a write's tool result — but
  7 of 7 drops in the measured run were permission denials and `str_replace`
  misses, i.e. writes that never happened. Those are now debug-level. An
  unrecognised wording still records a drop, because an unknown *success* wording
  is the decay the drop file exists to catch.
* **`poc-accelerator` 0.23.0: `linter` unbound from steps 4 and 5.** It wraps
  eslint only, so on a PoC whose application code is Python it fired 50 times for
  zero findings. Those stages now run the repo's own linter as part of an explicit
  pre-gate verification step (which also calls `aidlc-sensor flush`), and
  `type-check` stays bound for the CDK. A JS/TS-only PoC can add `linter` back to
  the stage's `sensors:` list.

## 2026-08-03 (poc-accelerator 0.22.0) — on upstream 2.5.33

**The PoC flow's team-knowledge loop is now mandatory at both ends, and the two
ends are independent.** A full run surfaced the hole: skip the team knowledge
repository at step 1 and step 8 never mentions knowledge again, so the
engagement's harvest quietly died inside the workflow record. Reading and
depositing are now separate obligations — neither is conditional on the other,
and neither has a skip path.

* **Step 1 requires the repository's git URL.** The `skipped-by-user`
  resolution is gone; the resolutions are now `pack-imported` and
  `no-pack-match`. The URL is resolved from the `## Team Knowledge Repository`
  section of `org.md` / `team.md` / `project.md`, or asked for as a required
  question, then probed read-only with `git ls-remote --heads`. A bare local
  path is rejected — a checkout can be searched, but only a remote can be
  pushed to. The confirmed URL is registered in `project.md` so later stages
  and later runs inherit it.
* **Step 8 always deposits, and resolves the URL itself.** New sub-step 5
  produces `poc-accelerator-team-knowledge-deposit.md`: resolve the URL
  (preflight artifact → memory layers → ask), probe it, assemble the harvest
  under the conservation laws, get a **named** sanitization approver, then
  branch + commit + merge request through the repository's own contribution
  process. When the push is refused, the deposit is not dropped — the patch is
  written into the record with the owner who will land it and the blocking
  reason. The step's remaining sub-steps shifted to 6/7/8.
* **A second deterministic sensor closes the loop.**
  `poc-accelerator-team-knowledge-deposit` (advisory, like every framework
  sensor) checks the fenced `deposit:` block: git-remote URL shape, probe
  recorded as `git-ls-remote-ok`, a non-empty entry list, a named approver, and
  the fields each outcome requires. It never reads the preflight record — that
  independence is the point. The existing preflight sensor gained the same
  URL-shape and probe checks and lost the skip branch.

Upgrade note: an in-flight PoC that already wrote a preflight artifact with
`resolution: skipped-by-user` will now report `SENSOR_FAILED` on rewrite. Add
the repository's git URL and re-run the preflight — or leave the old artifact
alone and let step 8 resolve the URL, which it does regardless.

## 2026-08-03 (docs) — on upstream 2.5.33

**Fork-authored documentation moved out of upstream's chapter numbering into
[`docs/fork/`](docs/fork/README.md).** `docs/reference/19-kiro-spec-integration.md`
and `docs/reference/20-fork-divergence.md` sat in a namespace upstream is still
filling — their numbered chapters run 00–18 and climb — so the day upstream adds
its own `19-*.md` the merge is an add/add conflict over a filename. New paths:

* `docs/fork/divergence.md` (was `20-fork-divergence.md`)
* `docs/fork/kiro-spec-integration.md` (was `19-kiro-spec-integration.md`)
* `docs/fork/research/2026-07-31-kiro-spec-hook-probe.md`
* `docs/fork/README.md` — new index

The two index rows in `docs/reference/00-overview.md` are gone with them, so that
file is byte-identical to upstream again. Nothing here is on the docs site's nav,
because the nav lives in upstream's `zensical.toml`; that is the deliberate trade.

Also recorded in `divergence.md` §2: **14 files of real divergence that no row
explained**, found by running the §5 derivation — the Codex marketplace layout
(the fork's first edits to `scripts/` and `tests/`), the hook-registration doctor
block in `core/tools/aidlc-utility.ts`, and the `poc-accelerator` documentation
living inside two upstream guide files. Listed, not yet classified.

## 2026-08-02 (doctor) — on upstream 2.5.33

**`--doctor` now tells you when your Kiro IDE hook layer is dead.** It used to
check only that the hook `.ts` bodies existed, never that the IDE was wired to run
any of them — which is why this fork shipped an inert hook layer for months while
`--doctor` stayed green. Three new rows on a Kiro IDE install:

* **Hook registration** — fails if `.kiro/hooks/` has legacy `*.kiro.hook` files
  but no v2 `*.json`. That combination fires nothing on Kiro IDE ≥ 1.0.1xx: no
  audit rows, no sensor dispatch, no human-presence mint, no approval-gate block.
* **Hook commands** — fails if a registered hook's script is missing from disk. A
  registered-but-broken hook is invisible in the IDE's panel.
* **Legacy files advisory** — when both generations are present (the shipped
  default), says so, and warns **not** to use the IDE's "Migrate legacy hooks"
  button: it would duplicate hooks this install already registers.

Kiro CLI shares the `.kiro` directory but wires hooks through `agents/aidlc.json`
and ships no registration files, so none of these rows appear for it.

Submitted upstream — the gap is general, not CDE-specific.

## 2026-08-02 (latest) — on upstream 2.5.33

**Plugin documentation moved out of `README.md` into a new [`PLUGINS.md`](PLUGINS.md).**
The plugin table, the chat-window install, the four-step manual install for every
harness, and the per-plugin setup notes all live there now; `README.md` keeps a
short pointer. Nothing was dropped — if you had bookmarked the README's plugin
section, it is all in `PLUGINS.md`.

**The README was also rebuilt from upstream's, which repaired damage you could
see.** The fork's copy had lost all **5** collapsible `<details>` harness install
sections (so every harness's install steps were permanently expanded), **16**
markdown links, and had all 8 GitHub alert blocks collapsed onto one line so they
rendered as plain blockquotes instead of coloured callouts. Restored.

Two live bugs fixed in `README.zh-CN.md` while doing it:

* It still told you to install bun with `curl -fsSL https://bun.sh/install | bash`
  — the earlier sweep had missed this file. Now `brew install bun` /
  `npm install -g bun`.
* The plugin-install line pointed at `github.com/comdaze/aidlc-workflows`, which
  **stopped resolving to this repository** when a fork of upstream was created
  under that exact name. Corrected to `aidlc-workflows-cde`.

## 2026-08-02 (later) — on upstream 2.5.33

**Installing `bun` and `uv` no longer requires piping a network script into a
shell, anywhere in the docs.** The fork's internal policy said this already, but
it was only ever applied in 5 files — `README.md`, `harness/opencode/`, both
harness guides, and four guide/reference chapters still told you to run
`curl … | bash`. Now all 13 sites use a package manager:

| Tool | Documented now |
| --- | --- |
| `bun` | `brew install bun` / `npm install -g bun` |
| `uv` / `uvx` | `brew install uv` / `pipx install uv` |

Each site links the vendor's installation guide for the other methods. Commands
were verified against the Homebrew API: formula `bun` is in homebrew-core at
1.3.14, which is the version this repo pins for CI. Note `brew install bun` is the
homebrew-core spelling — earlier fork text used the older `oven-sh/bun/bun` tap
form.

**Claude Code's own installer is deliberately unchanged.** Anthropic documents the
native installer as the recommended path and has deprecated npm installation of
Claude Code, so replacing it would push you onto a deprecated method for a tool
this project does not own.

Two sentences that went stale with the change were also fixed: the README no
longer tells you to choose between PowerShell and CMD blocks that no longer exist,
and the PATH tip no longer blames "the bun installer" for writing to `~/.zshrc`
when a package manager is now the documented path.

Submitted upstream as
[awslabs/aidlc-workflows#701](https://github.com/awslabs/aidlc-workflows/pull/701),
with the fork's text made **byte-identical to the PR** — so if it merges, this
divergence disappears on the next sync with no follow-up edit.

## 2026-08-02 — on upstream 2.5.33

**Removed the Kiro IDE gate-render floor.** It returned `{"decision":"block"}`
from the `stop` adapter path to force a re-render when a turn parked at an
approval gate or question batch whose options had never appeared in chat. On any
IDE ≥1.0 it was already doing nothing — the v2 `Stop` trigger cannot block — so
for current builds this changes no behaviour. **If you are on a pre-1.0 Kiro IDE,
you lose the hard block**; the protocol rule it enforced is retained as guidance
in `question-rendering.md`, and the conductor is now solely responsible for
honouring it.

It was deleted rather than migrated because the check is not expressible on a
trigger that can block: "did this turn end with an unrendered gate?" is only
answerable at end-of-turn, and `PreToolUse` fires too early while
`UserPromptSubmit` fires after the user has already replied to something they
could not see. Hard enforcement would need a redesign, and belongs upstream as a
designed feature rather than a fork patch in the enforcement spine. Reasoning and
the full cost accounting are in `docs/fork/divergence.md` B1.

Also: added `.gitlab-ci.yml`. The repo had no CI — the inherited
`.github/workflows/ci.yml` is GitHub-only and does nothing here, so every guard
ran only when someone remembered to run it locally. Wiring it up immediately
caught two already-landed defects: 15 collapsed GitHub alert blocks across the
READMEs and one reference doc, and a 16-entry deletion from `CHANGELOG.md` caused
by resolving that file with `git checkout --theirs` during the 2.5.33 merge. Both
are fixed. A scheduled `upstream-drift` job now reports pending upstream commits
and the real conflict surface.

## 2026-08-01 — on upstream 2.5.33

Adopted the frozen-version policy described above. `core/tools/aidlc-version.ts`,
`CHANGELOG.md`, and the README badge are now upstream's verbatim and the fork
does not bump them; this file takes over the fork's release notes. The
`2.5.31` heading the fork published on 2026-07-31 is superseded by the entry
below, because upstream independently shipped its own `2.5.31` and
`tests/unit/t68-version-changelog-sync.test.ts` rejects duplicate headings.

Absorbed upstream 2.5.31 through 2.5.33: sensor output parsing now tolerates
leading stdout noise from a sibling repo's package manager, `--doctor` warns
when a plugin ships an undiscoverable sensor manifest, and stage rules are
delivered deterministically as bounded `load-steering` directives with reviewer
checklists absorbed into reviewer agent bodies at build time.

**Upgrade:** re-copy your `dist/<harness>/` shell into the project, then re-run
`plugin sync` (or start a session and let the compose hook run) so plugin
contributions re-merge.

## 2026-07-31 — on upstream 2.5.30

Merged upstream v2 through 2.5.30 into this fork, which had been sitting on a
2.5.7 base. **The headline is a defect this fixes, not a feature: on Kiro IDE
≥ 1.0.1xx the fork's entire hooks layer was silently inert.** Kiro IDE stopped
executing the legacy `.kiro.hook` format, and this fork shipped only that
format — so audit emission, sensor dispatch, human-presence mint, the pre-tool
approval-gate block, and runtime-graph compile were all registered and none of
them ran. Upstream fixed this in 2.5.4 by shipping the v2 hook JSON schema
alongside legacy for coexistence; that fix is now in. Verify with `--doctor`
and confirm `.kiro/hooks/` contains `aidlc-*.json` files, not only
`.kiro.hook`.

* Also arriving from upstream: bundle-aware default-scope resolution for
  plugin-only installs, the ARS deterministic subcommand, hardened Kiro
  `execute_bash` permission lists, the 1.x stdin hook context channel, a v2 PR
  gate in CI, and `.gitattributes` pinning LF so Windows checkouts pass the
  drift guard.
* The Codex CLI floor moves to **≥ 0.145.0** (upstream): earlier releases defer
  compact-source `SessionStart` after a mid-turn auto-compaction, so a
  continuation can run without the restored workflow mission. `--doctor`
  enforces the pin.
* **The fork's Kiro IDE gate-render floor (previously released here as
  2.5.8/2.5.9) is inert on IDE 1.x and is not being re-announced.** It works by
  returning `{"decision":"block"}` from the Stop hook, and on the v2 schema the
  IDE's `Stop` trigger cannot block — upstream's own hook registration
  documents it as advisory-only. The code is retained but does nothing on a 1.x
  IDE; it needs re-implementing on a trigger that can genuinely block
  (`PreToolUse` and `UserPromptSubmit` can) or removing. Tracked as B1 in
  `docs/fork/divergence.md`.
