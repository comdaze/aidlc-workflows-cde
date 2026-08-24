# Installing `vibe` in another project

Chinese: [INSTALL.zh-CN.md](INSTALL.zh-CN.md) · What the plugin *is*:
[README.md](README.md)

## Read this first: which engine you pair it with

This plugin runs on **either** this fork's engine or stock upstream
`awslabs/aidlc-workflows` v2. That was not always true, and if you are following an
older copy of this page, it told you not to use upstream — measured against
upstream 2.6.61 (2026-08-23), the two reasons it gave no longer hold:

| Former dependency | Status |
| --- | --- |
| Learnings identity is content-keyed (**A13**) | **Gone.** Upstream implemented content-keyed identity themselves (`createHash("sha256")` + `cidMarker`), so the "a second `sediment` silently discards an approved rule" hazard does not exist there. Verified by reading `core/tools/aidlc-learnings.ts`, not its prose. |
| `set-autonomy` works on a fresh workflow (**A10**) | **Gone since 0.3.0**, which parks the container instead of granting autonomy. |
| The parked branch honours `--new-intent` (**A16**) | **Present upstream** — their Branch 2.5 self-disable list carries `!flags.newIntent`, so opening a second container beside a parked one works there too. |

What that leaves is one open engine defect and one cosmetic difference. Neither
blocks installation, and you should know both:

- **A11 (still open upstream, [#729](https://github.com/awslabs/aidlc-workflows/pull/729)).**
  Upstream's Stop hook emits the rules payload *before* the `continue` token that
  carries the chain position, so a truncating harness can cut the token off and the
  delivery loop cannot advance. This fires on **every core scope** — measured on a
  `feature` container, the bundle is 21 segments and a 17 KB payload with this
  repository's memory layer — but **a `vibe` container does not reach it**: its
  first `next` answers `run-stage`, with no `continue_token` and
  `rules_in_context: []`, verified with that same full memory layer. `vibe`'s
  bundle is empty, so the engine returns the directive unchanged; the memory layer
  still reaches the model through the harness's always-on include.
- **A7 (fork-only).** This fork gives the two code sensors a coalesce window; on
  upstream they fire once per write. Only matters if you opt into
  `linter`/`type-check` in the stage's `sensors:` list, which is off by default —
  the stage's own Sensors section quotes the coalesced cost.

Recorded in `docs/fork/divergence.md` (rows A7, A11; A13 and A16 are closed there).

The practical consequence: **you can ship `dist/plugins/vibe/<harness>/` on its
own** — it is self-contained (only node built-ins, plus the installed engine's own
`aidlc-lib.ts` / `aidlc-stage-schema.ts` loaded from the target project). Sending
the whole repository is still the simplest option if the recipient has no AI-DLC
install yet, since they need a framework to compose into.

## Also note: `plugins/vibe/` is source, not the distributable

`plugins/vibe/` is hand-authored input to the packager. What installs is the
generated host plugin under `dist/plugins/vibe/<harness>/`, which is committed — no
build step needed unless you edited `core/` or `plugins/`.

## Install

`<repo>` is the clone of this repository, `<project>` is the target project.

| Harness | `<harness>` | `<harness-dir>` |
| --- | --- | --- |
| Kiro IDE | `kiro-ide` | `.kiro` |
| Kiro CLI | `kiro` | `.kiro` |
| Claude Code | `claude` | `.claude` |
| Codex CLI | `codex` | `.codex` |
| opencode | `opencode` | `.aidlc` |
| GitHub Copilot | `copilot` | `.aidlc` |
| Cursor | `cursor` | `.cursor` |

The last two arrived with upstream 2.6.x and the plugin projects to them without
carrying anything Copilot- or Cursor-specific. They are **emitted but not
exercised**: no vibe session has been run on either, so treat them as untested
rather than supported.

**1. Install the framework first.** Copy `dist/<harness>/` into `<project>/` per
[Pick your harness](../../README.md#pick-your-harness). Skip if the project already
has an AI-DLC install.

> [!WARNING]
> Getting this order wrong **fails silently**. The composer returns immediately —
> no error, no health record — when `<project>/<harness-dir>/tools/aidlc-graph.ts`
> is missing, because it validates every plugin stage against the *installed*
> engine's schema first. Compose is idempotent, so a mis-ordered attempt just needs
> a re-run once the framework is in place.

**2. Compose the plugin.**

```bash
PLUGIN_ROOT="<repo>/dist/plugins/vibe/<harness>"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=<harness-dir> bun "$PLUGIN_ROOT/hooks/compose.ts"
```

**3. Enable it.** Compose copies the files; the selection decides what the engine
sees. Name every plugin you want enabled — the list is absolute, not additive:

```bash
cd <project>
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc,vibe
```

Omitting `vibe` here leaves the files installed but filters the stage out of the
graph, and the agent entry then opens a container that cannot exist. The prompt
detects that and says so rather than working for an hour with nowhere to sediment.

**4. Verify.**

```bash
bun <harness-dir>/tools/aidlc-utility.ts doctor
bun <harness-dir>/tools/aidlc-utility.ts plugin-list
```

`doctor` should report `vibe enabled` with an enabled-stage count of 1.

## Kiro IDE specifics

**The agent entry.** `aidlc-vibe` appears in the agent picker; select it and start
talking. It opens the container on its first turn. On every other harness the entry
is `/vibe` or `/aidlc --scope vibe`.

Agent configs are read **at session start** — after installing or updating, open a
new session or the old config stays in force.

**Do not click "Migrate legacy hooks to v1"** in the Agent Hooks panel. The
struck-through `legacy` entries are inert by design (they exist for pre-1.0 IDEs);
migrating them double-registers hooks that are already registered. Delete them
instead if you are not on a pre-1.0 IDE: `rm <project>/.kiro/hooks/*.kiro.hook`.

**If hooks die with `/bin/sh: bun: command not found` (127):** a GUI-launched IDE
inherits launchd's PATH, which excludes `~/.bun/bin`, and a hook's `/bin/sh` reads
no rc file — so `~/.zshrc` and `~/.zshenv` do not help it. Put bun on a system
path:

```bash
ln -s "$HOME/.bun/bin/bun" /usr/local/bin/bun
```

`doctor` checks this directly. A 127 records **no** drop, because the hook never
ran — the hook-health files look clean while nothing fires.

## Updating the plugin later

Compose is **no-clobber**: it never overwrites a file the project already has, so
re-composing after an update silently keeps the old bytes and exits 0. Delete the
installed copies first:

```bash
cd <project>
rm -f <harness-dir>/agents/aidlc-vibe.md \
      <harness-dir>/scopes/vibe.md \
      <harness-dir>/aidlc-common/stages/construction/vibe-session.md
rm -rf <harness-dir>/knowledge/aidlc-vibe
# then re-run step 2, and step 3 if the selection was reset
```

The only signal for a skipped file is a `.drops` record surfaced by `doctor` as a
degraded hook row — and its remediation text will suggest renaming to a
plugin-namespaced path, which is the wrong fix for a stale install. Run `doctor`
after any compose you expected to change something.

## Uninstall

```bash
cd <project>
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc   # drop vibe
```

That filters the stage out and leaves the files in place, re-enableable. To remove
the files too, delete the paths listed under *Updating* above. Nothing under
`aidlc/` (workflow state, diaries, audit, the memory layer) is touched by either.

## What it deliberately does not give

No requirements, no reviewed design, no acceptance criteria — so **nothing produced
in a vibe session is evidence of correctness or completeness.** Use `feature`,
`mvp`, or `enterprise` when that claim is needed. Sedimented learnings still go
through the framework's admission gate, which is the one guarantee this scope keeps.
