# Kiro Spec integration boundary — measured, not inferred

**What this answers:** "can AI-DLC 2.0 merge with Kiro's native Spec mode?"

**Short answer:** it can be *observed*, not *governed*. AI-DLC can record what
Kiro Spec does; it cannot stop it. Running both as drivers at once is worse than
either alone, for a reason measured below.

Everything here was captured live on 2026-07-31 by registering probe hooks and
executing real Kiro Spec tasks. Reproduction steps are in §5 — **re-run them
before trusting any of this on a newer Kiro build**, because every finding is a
property of Kiro's hook surface, not of this repo, and it can change without
notice. Prefer re-measuring to citing.

> Companion: [`kiro-ide-hook-payload.md`](kiro-ide-hook-payload.md) documents the
> older `.kiro.hook` v1.0.0 / `USER_PROMPT` channel that `harness/kiro-ide/`
> targets today. This chapter measures the **newer `.kiro/hooks/*.json` v2
> channel**, which behaves differently. Both are accurate about their own
> mechanism; §4 is the part that matters for the harness.

## 1. The starting point: v2 has no idea Kiro Spec exists

```bash
grep -rn '\.kiro/specs' core/ harness/ docs/ plugins/   # no matches
```

Not a documented decision — simply absent. The two systems were designed without
reference to each other.

## 2. Spec task triggers exist, and are spec-only

`PreTaskExec` and `PostTaskExec` fire on **Kiro Spec task execution**. They do
**not** fire on agent task-list (todo) transitions — tested by completing an
agent todo and observing zero firings, against controls that did fire.

Payloads, verbatim from the capture:

```json
{"session_id":"sess_7f667c0b…","hook_event_name":"PreTaskExec",
 "cwd":"/Users/…/student-sandbox-spectest",
 "spec_name":"/Users/…/.kiro/specs/readme-documentation/tasks.md",
 "task_name":"1.1 创建 verification 包骨架、数据模型与依赖固定文件"}

{"session_id":"sess_7f667c0b…","hook_event_name":"PostTaskExec",
 "cwd":"/Users/…/student-sandbox-spectest",
 "spec_name":"/Users/…/.kiro/specs/readme-documentation/tasks.md",
 "task_name":"1.1 创建 verification 包骨架、数据模型与依赖固定文件",
 "task_success":true}
```

Field notes:

- **`spec_name` is the absolute path to `tasks.md`**, not a spec name. The field
  name misleads; the value is more useful than the name suggests (it yields the
  spec directory).
- **`task_name` carries the hierarchical number + title** (`1.1 …`), which lines
  up with the `tasks.md` checkbox — usable as an identifier.
- **`PostTaskExec` carries `task_success`.** A pass/fail verdict, not merely
  "it ran". This is what makes an audit bridge worth building.
- Pre → Post timestamps give duration (4m40s for the observed task).

**Unverified:** whether the triggers fire once per *execution* or only on a
status *transition*. Re-running an already-`[x]` task produced neither trigger
(one observation, not a conclusion). Do not build counting or billing on this
without measuring it.

## 3. `PreTaskExec` exit 2 does NOT block a spec task

This is the load-bearing finding. A `PreTaskExec` hook that exits 2 with stderr —
the documented block contract for that trigger class — did not prevent the task
from running to completion.

Evidence chain from one run:

| time | event |
|---|---|
| 08:50:18 | `PreTaskExec` fired for task `1.2 实现 contract.py …`; hook exited 2 with stderr |
| 08:56:10 | `contract.py` created — the task was doing its work |
| 09:03:49, 09:06:16 | further task-driven file writes |
| 09:07:02 | `PostTaskExec` fired, **same task**, `task_success: true` |

Corroborated off the event stream: `contract.py` exists (33 KB) and `tasks.md`
shows `1.2` as `[x]`.

"Blocked then auto-retried" is ruled out: a retry would fire `PreTaskExec` again
and — with the sentinel already consumed — log the pass-through branch. Within
this run there is exactly one `PreTaskExec` and **zero** pass-through lines.

Full capture, including the standalone self-tests that proved the probe exits 0
unarmed and 2 armed: [research/2026-07-31-kiro-spec-hook-probe.md](research/2026-07-31-kiro-spec-hook-probe.md).

One mechanism detail is not distinguishable from outside: Kiro may have ignored
the exit code entirely, or blocked the task-runner while the agent did the work
anyway and then marked the task complete. **It does not change the conclusion** —
the exit 2 did not prevent completion, so it confers no veto.

## 4. The consequence that matters for the harness

The v2 hook channel delivers a **Claude-shaped JSON payload on stdin**, which the
older `USER_PROMPT` channel does not. Verified from the capture:

| Claim | `.kiro.hook` v1.0.0 (existing doc) | `.kiro/hooks/*.json` v2 (measured) |
|---|---|---|
| context channel | `USER_PROMPT` env var; **stdin dead** | **stdin carries JSON** |
| shell command | **not recoverable** (stdout only) | `tool_input.command`, full command |
| file path | scraped from `toolResult` prose, workspace-relative | `file_path`, **absolute** |
| write-tool payload | not available | `tool_input.path` + full content, on **both** Pre and Post |
| project dir | absent (`process.cwd()` fallback) | `cwd` present on every payload |
| spec task events | `spec` toolType never fires | `PreTaskExec` / `PostTaskExec` fire |

If the harness targeted the v2 channel, several shipped workarounds become
unnecessary: `extractWrittenPath()`'s prose scraping, `runtime-compile` dropping
its command filter, and `sync-statusline` deriving stage from the audit tail
because "the IDE gives no task payload". A fourth — the reviewer-scope note that
Kiro IDE "ships no registration … a pre-tool matcher has nothing to inspect
there" — is only **half** answered: there is now plenty to inspect, but whether a
pre-tool hook can *act* on it is the open question below.

**Now measured — the write-tool payload is there.** All three write tools fire
both `PreToolUse` and `PostToolUse`, and `tool_input` carries an absolute `path`
plus the full write payload (`text`, or `oldStr`/`newStr`/`replace_all`):

```json
{"hook_event_name":"PreToolUse","cwd":"/Users/…/aidlc-workflows-cde","tool_name":"fs_write",
 "tool_input":{"path":"/tmp/aidlc-probe-scratch/probe-target.txt","text":"PROBE LINE ONE\nPROBE LINE TWO\n"}}
```

So on the v2 channel `extractWrittenPath()`'s prose scraping has nothing left to
do, and the content is available *before* the write lands, not just after.
`PreToolUse` is shaped like `PostToolUse` minus `tool_response`. `read_file` and
`list_directory` also expose `tool_input.path`, so a read-scope check has
something to inspect on the Post side at least.

**What still gates the enforcement work** is the other half of the reviewer-scope
question, and it is a bigger one: **whether `PreToolUse` exit 2 actually blocks.**
§3 showed `PreTaskExec` exit 2 does not. `aidlc-block` and `aidlc-reviewer-scope`
both assume `preToolUse` exit 2 is a live-verified block — verified on the **v1**
channel, never on v2. Until that is measured, treat the v2 payload as good for
*observing* tool calls, not for refusing them. Also unmeasured: whether
`PreToolUse` fires for read tools at all.

> [!IMPORTANT] **The path key differs between the two event families, and the
> core hooks match neither.** Tool events carry `tool_input.path`; file events
> (`PostFileCreate` / `PostFileSave`) carry a top-level `file_path`. Counted over
> the captures: 46 × `path` and **0** × `file_path` on tool events, against 41 ×
> `file_path` on file events. The core hooks expect the Claude shape
> `{tool_input:{file_path}}`, so an adapter must **map `path` → `file_path`**
> rather than forward the payload verbatim. This is the near-miss class that
> reads as working and silently no-ops — the same failure mode as the
> `file`-vs-`file_path` bug that made `blind_spot_scan` publish a clean report
> over an empty set.

Also noted: `cwd` is the hook-owning workspace, and a path may point **outside**
it (observed: a `cwd` in one workspace with a `file_path` in another). Do not
assume the target is under `cwd`.

## 5. Reproduction

Register probe hooks that log their stdin, run a real spec task, read the log.
The essential shape (one file per trigger under `.kiro/hooks/`):

```json
{
  "version": "v1",
  "hooks": [{
    "name": "Probe PostTaskExec",
    "trigger": "PostTaskExec",
    "action": {
      "type": "command",
      "command": "sh -c 'printf \"\\n===== PostTaskExec %s =====\\n\" \"$(date -Iseconds)\" >> /tmp/probe.log; cat >> /tmp/probe.log'",
      "timeout": 15
    }
  }]
}
```

Discipline that made the result trustworthy, worth keeping:

1. **Always register controls** on trigger families known to work (`PostToolUse`,
   `PostFileCreate`). A silent probe is otherwise indistinguishable from a
   trigger that does not exist.
2. **Self-test the hook command** standalone before trusting a null result, so a
   broken script cannot masquerade as a missing trigger.
3. **For a blocking test, make it one-shot** — gate exit 2 on a sentinel file the
   hook consumes as it blocks. An unconditional exit-2 `PreTaskExec` would leave
   the workspace unable to run any spec task.
4. **Treat the hook set as frozen once a session starts.** Register every probe
   you need, *then* start a fresh session. Measured across a full session, none
   of the three mid-session mutations took effect: a hook created by `createHook`
   never fired (while a hook registered at session start fired on the same tool
   call), an edit to a registered hook's command kept running the old command,
   and a deleted hook file kept firing. The registry appears to be snapshotted at
   session start, contents and all.

   One observation conflicts and is recorded rather than smoothed over: in the
   earliest session, four hooks written by `createHook` into a `.kiro/` that had
   not existed before **did** fire, on the very next tool call. Later sessions
   never reproduced it. So "mid-session registration never takes effect" is the
   safe operating assumption, not an established fact — do not build a workflow
   that depends on mid-session pickup either way. Register, then restart; it costs
   one restart and removes the whole question.

   An earlier session recorded the opposite for creation — a newly written hook
   firing on the very next tool call. Unreconciled, so rely on mid-session pickup
   in neither direction. The practical consequence is the one that matters for
   method: **a mid-session probe's silence is not evidence about the trigger**, it
   is more likely evidence about registration. That is what invalidated the first
   attempt at the write-tool measurement.
5. **Hooks are workspace-scoped.** Probes must live in the workspace where the
   spec runs, or they capture nothing.

## 6. What this permits, and what it forbids

| Integration shape | Verdict |
|---|---|
| **Export specs from v2** — a contribution on `units-generation`/`delivery-planning` that also emits `.kiro/specs/<f>/{requirements,design,tasks}.md` from artifacts already produced. Specs are an *export*, not a second driver. | **Viable.** Additive, no core change, no second state machine. |
| **Unidirectional audit bridge** — a `PostTaskExec` hook emitting an audit row per spec task (name, `task_success`, duration). | **Viable.** Makes Kiro-side execution visible in v2's audit trail, which is the compliance argument v2 exists for. |
| **Serial handoff** — run v2 through inception, `park` the workflow, hand construction to Kiro Spec. | **Viable** today with no code. The audit bridge is its natural upgrade. |
| **Bidirectional governance** — v2 gates spec tasks, spec reports into v2's state machine. | **Out.** §3: `PreTaskExec` confers no veto. Also two writers on one workflow's truth, which this codebase rejects elsewhere by design. |

### Why running both as drivers is worse than either

An asymmetry, not a symmetric conflict:

- `aidlc-block` is a `preToolUse` hook with **no tool filter**, and `preToolUse`
  exit 2 *is* a working block (the adapter calls it a live-verified contract — on
  the v1 channel; see §4, it is not yet measured on v2). So while an AI-DLC gate
  is open with no human turn since, it blocks the tool calls a spec task needs —
  and Kiro shows no reason why.
- Yet AI-DLC **cannot** gate a spec task at the clean task boundary (§3).

**AI-DLC can break Kiro Spec crudely, but cannot govern it cleanly.** Both ends
of the trade are bad. Pick one driver per phase; do not run both.

`aidlc-block` has an off-switch (`humanPresenceGuardDisabled()`), but using it to
force coexistence removes the human-presence guarantee — the property being sold.
Not a workaround.
