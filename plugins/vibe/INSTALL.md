# Installing `vibe` in another project

Chinese: [INSTALL.zh-CN.md](INSTALL.zh-CN.md) · What the plugin *is*:
[README.md](README.md)

## Read this first: the plugin needs this fork's engine

> [!IMPORTANT]
> **Do not pair this plugin with an upstream `awslabs/aidlc-workflows` install.**
> Three fixes it depends on live in this fork's `core/`, not in the plugin. With
> stock upstream the plugin does not degrade gracefully — its first step errors out.

| Needs | Without it |
| --- | --- |
| `bolt set-autonomy` works on a fresh workflow (**A10**) | **Step 1 of the stage fails outright.** A newly generated state file has no `Construction Autonomy Mode` field, so the command hard-errors. The Stop hook then nudges the parked container as an abandoned workflow, every turn, up to the cap. |
| Load-steering continuations are followable (**A11**) | The `continue` token is emitted *after* a ~16 KB rule payload and gets truncated away, so the chain can never advance. Same bundle re-delivered every turn, forever. |
| Learnings identity is content-keyed (**A13**) | A second `sediment` in one session can **silently discard a rule you approved** while reporting success. |

All three are recorded in `docs/fork/divergence.md` (rows A10, A11, A13) and are
offerable upstream; once they land upstream this warning goes away. Until then,
**ship the fork, not the plugin alone.**

The practical consequence: give the recipient this whole repository (or an archive
of it), not just `plugins/vibe/`.

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
