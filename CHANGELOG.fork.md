# Fork changelog

This is the **CDE fork's** own changelog, and the only place fork release notes
are added from 2026-08-01 onward. `CHANGELOG.md` belongs to upstream
`awslabs/aidlc-workflows`: the fork takes upstream's entries as they are and adds
none of its own — see the frozen-version policy in
`docs/reference/20-fork-divergence.md` A3.

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
the full cost accounting are in `docs/reference/20-fork-divergence.md` B1.

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
  `docs/reference/20-fork-divergence.md`.
