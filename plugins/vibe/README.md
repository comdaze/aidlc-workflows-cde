# vibe — free-form coding that still sediments

**Chinese**: [README.zh-CN.md](README.zh-CN.md)

Installed as **`aidlc-vibe`**. One stage, no rails, no approval gate until you
close out — but memory and knowledge load as usual, and what you learn goes back
through the framework's admission gate instead of being hand-written into a file.

It is the opposite trade from `poc-accelerator`: that plugin adds structure to make
a customer delivery defensible; this one removes structure and keeps only the part
that compounds.

## What it does and does not give you

| | |
| --- | --- |
| **Gives** | Memory read (the `org → team → project → phase` chain, already ambient in any session) · knowledge read (the lead agent's seat loads normally) · learnings written through the §13 gate — conflict check, idempotency, and a `RULE_LEARNED` audit row · audit trail for stage start, artifact writes and close-out |
| **Does not give** | Any claim about what you built. No requirements, no reviewed design, no acceptance criteria — so nothing here is evidence of correctness or completeness. Need that? Run `feature`, `mvp`, or `enterprise`; this scope deliberately cannot produce it |

## Use it

In Kiro, pick **`aidlc-vibe`** from the agent picker and start talking — the agent
opens the container on its first turn, so there is no command to remember. On any
harness, the scope commands do the same thing:

```text
/vibe <what you are about to work on>
# or
/aidlc --scope vibe <what you are about to work on>
```

Then just work. Three things you can say at any point:

| Say | What happens |
| --- | --- |
| anything else | Normal free-form work. No ritual questions, no stage progress, no gate |
| **sediment** ("沉淀" / "记一下") | Surfaces candidates from the session diary; you pick; confirmed ones are written through the admission gate. Repeatable — a long session should do it more than once |
| **close** | Writes the session log, opens the one approval gate, ends the container |

The scope resolves to **4 executing stages**: the three initialization stages
(`workspace-scaffold`, `workspace-detection`, `state-init` — the engine preamble
that scaffolds the record tree and the state file) plus `vibe-session`. There is
no fourth thing waiting to happen.

## The agent entry (Kiro)

The plugin ships two files that make it selectable rather than invoked:

- `agents/aidlc-vibe.md` — the persona. It is the stage's `lead_agent` **and** the
  picker entry's prompt, so both entries behave identically.
- `agents/aidlc-vibe.json` — the Kiro agent config. `resources` pins the memory
  layer, this seat's knowledge, and the two runner skills into context at session
  start, which means the read path is guaranteed by the agent itself rather than
  by an always-on steering file.

**The two files share one filename stem on purpose.** Kiro reads both `.md` and
`.json` under `.kiro/agents/` as agent configs, so two different stems produce
**two** picker entries — and the `.md` one carries no `resources`, `tools`, or
`toolsSettings`, which makes the more discoverable entry the degraded one.
Measured in a real install before this was fixed: the entry that got selected was
the persona, so the session ran without the tool posture or the pinned memory.
Sharing a stem is how the 14 core agents ship, and it collapses the pair to a
single name. Do not rename one without the other.

The agent is an **entry**, not a replacement for the stage. Selecting it still
opens the container, because the write path needs it (see the next section). What
the agent removes is the command and the sense of starting a workflow.

Four things to know:

- **The JSON deliberately has no `hooks` key.** Kiro's docs are self-contradictory
  about the blast radius — two pages say the IDE ignores the *field*, one says it
  ignores any *agent containing* it. Under that ambiguity the safe shape is to omit
  it, since the failure it risks (the agent silently missing from the picker) has
  no visible symptom. Hooks belong in `.kiro/hooks/` regardless. The plugin test
  pins the absence. Worth knowing: the 14 core `aidlc-*-agent.json` files all carry
  `"hooks": {}`, so if your picker is missing those, this is the first thing to
  check.
- **It declares no tools, on purpose — `tools` is a restriction, not a grant.**
  Listing tools *replaces* the default agent's toolset with exactly that list,
  cutting off skills, MCP tools and everything else. This config shipped once with
  `["fs_read","fs_write","execute_bash","thinking"]` and was measured in a real
  Kiro IDE session: the agent came up with **one** tool, the skill loader — able to
  load a manual into context and unable to execute a single step of it. Two
  failures compounded, because those are the CLI 2.x / IDE 0.x names and they did
  not resolve on IDE 1.x, so even the four were not granted.

  So the seat now inherits the default agent's capability and adds only a prompt,
  `resources`, a description and a welcome message. **Put guardrails in the
  harness's own permission settings**, where they apply to every agent — not in one
  agent's config, where getting the schema version wrong silently disarms the seat.
  A test pins that no tool-restricting key is present.
- **On non-Kiro harnesses the JSON is inert.** Claude reads `.md` agents, Codex
  reads `.toml`, opencode reads its own native twin — the copied JSON is harmless
  noise there, and the scope commands remain the entry.

One edge case the agent handles out loud: plugin `agents/` are copied regardless of
the enabled-plugin selection, so a *disabled* vibe plugin leaves the picker entry
in place while its stage is filtered out of the graph. The prompt detects that the
container cannot open and says so, rather than working for an hour and then
discovering it has nowhere to sediment.

## Iterating on this plugin against a live install

Two things measured while dogfooding this plugin on the framework repo itself, both
of which will waste your afternoon if you do not know them:

**Editing the plugin does not update an install that already has it.** Compose
copies **no-clobber**, so after you change a source file, `bun scripts/package.ts`,
and re-compose, the installed copy still holds the old bytes. Compose prints
nothing and exits 0. Delete the installed file first:

```bash
rm <project>/.kiro/aidlc-common/stages/construction/vibe-session.md
# then re-compose; the new content lands and the drop self-clears
```

**The only signal is a doctor row.** The skip is recorded to a `.drops` file, not
stdout, and surfaces as `Hook drops (plugin-compose-vibe): 1 degraded of 1`. Run
`aidlc-utility.ts doctor` after any compose you expected to change something.

Its remediation text will misdiagnose you: it says the file "collides with an
existing file (core or another plugin) — rename it to a plugin-namespaced path".
For a stale install the collided file is the plugin's **own** previous output, and
renaming the source is exactly the wrong fix.

**A one-stage container still pays the walking-skeleton round-trip.** Being a
construction stage, the directive arrives with `gate: "unresolved"` and the engine
will not proceed until a `--skeleton-stance` is reported back. With the shipped
defaults the answer is `scope-dependent`, falling back to this scope's
`skeleton: off` — the right outcome, via a question a one-stage scope has no
business being asked. Step 1 of the stage now documents it.

## Why a stage at all, instead of just a steering file

Because the write path is the only part that is hard. Reading memory is free —
every harness already includes those files in ambient context, workflow or not.
Writing memory *well* is not: the learnings tool refuses to run unless the
requested stage is the state file's `Current Stage`, and that check is what buys
you the conflict check, the idempotency and the audit row. A parked stage satisfies
it; a steering file cannot.

So the stage is not there to sequence your work. It is there to hold the one
precondition that makes sedimentation trustworthy.

## Design notes worth knowing before you edit it

**The container stays `in-progress` on purpose, and two hooks depend on that.**

- `aidlc-block` (the human-presence floor) fires only while a gate is *open*.
  With no open gate it short-circuits, which is why free-form tool use is not
  interfered with — and why a **native Kiro Spec run can proceed inside this
  container**. The measured caveat: this stage cannot *govern* a spec task either
  (`PreTaskExec` exit 2 confers no veto), so it observes rather than supervises.
  See [`docs/fork/kiro-spec-integration.md`](../../docs/fork/kiro-spec-integration.md).
- The Stop hook nudges a turn that ends with a pending directive. Step 1 sets
  `Construction Autonomy Mode: autonomous`, which is that hook's first carve-out.
  **Remove that line and every turn ending mid-session gets nudged as an
  abandoned workflow**, up to the block cap. The plugin test pins it.

**No sensors are bound by default.** The only artifact is a session log written
once at close-out, so a document-shape sensor would cost friction and check
nothing. The two code sensors are a real option — their globs match by file type,
not by author, so binding them makes verification follow the code whether you or a
spec task wrote it, and they now coalesce so the cost is one toolchain run per
window rather than one per write. Add them to the installed stage's `sensors:`
list *only if the repo actually has that toolchain configured* — a sensor that
cannot produce a finding is pure latency (measured: 11 s per write, 50 times, zero
findings, on a project with no eslint).

**After close-out the container is gone.** The workflow completes, `Current Stage`
clears, and sedimenting again means opening a new session. That boundary is
deliberate: a harvested diary should not be harvested twice.

## Install

Same as any AIDLC plugin — see [PLUGINS.md](../../PLUGINS.md). Short form:

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/vibe/claude
/plugin install aidlc-vibe@aidlc-plugins        # SessionStart hook composes

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/vibe/codex
codex plugin add aidlc-vibe@aidlc-plugins      # approve the one-time hook trust

# Kiro CLI / Kiro IDE / opencode — explicit compose
PLUGIN_ROOT="<repo>/dist/plugins/vibe/kiro-ide"   # or kiro / opencode
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "$PLUGIN_ROOT/hooks/compose.ts"
```

Then select it (naming the full enabled set, `aidlc` for core):

```bash
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc,vibe
```

No MCP configuration and no other setup — the plugin adds one scope, one stage, one
persona, one Kiro picker entry and one knowledge file, and nothing else.

> **Naming**: the directory and manifest are `vibe`; the installed host plugin is
> `aidlc-vibe` (the packager adds the prefix). The internal name must stay
> unprefixed — compose refuses any scope or agent declaring `plugin: aidlc-*`,
> because a plugin-owned runner uses the bare name and would collide with core's
> `aidlc-<name>` runner path.

## Verify the plugin content

```bash
bun test plugins/vibe/tests/plugin.test.ts
```

Beyond schema validity, the test pins the four properties the design rests on:
exactly one stage, enterable from nothing, the autonomy line present with its
reason, and a keyword-free scope (so a casual "vibe" cannot hijack a request meant
for real work).

It also guards the agent surface, where every failure is silent: the picker entry
carries no `hooks` key, its `prompt` and `name` resolve to the shipped files,
`resources` still pins the memory layer, no tool-restricting key has crept back in
(so the default agent's capability is still inherited), and knowledge stays in this
plugin's own seat instead of leaking into a core agent's.
