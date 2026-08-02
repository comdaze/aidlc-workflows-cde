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
