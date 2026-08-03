# Kiro Spec hook probe — raw capture (2026-07-31)

Evidence for [kiro-spec-integration.md](../kiro-spec-integration.md).

Curated from the probe log: trigger headers and payloads, with the large
`tool_response` echoes of the probe's own shell commands elided — those were
self-referential noise, not evidence. Session ids and absolute paths are kept:
they carry no secrets, and the paths are what demonstrate the workspace-scoping
and `cwd`-vs-`file_path` behaviour.

Probed on Kiro IDE with the `.kiro/hooks/*.json` **v2** hook format (not the
`.kiro.hook` v1.0.0 format that `harness/kiro-ide/` currently targets).

## Trigger tally, whole capture

```
  19 "hook_event_name":"PostFileCreate"
  21 "hook_event_name":"PostFileSave"
   2 "hook_event_name":"PostTaskExec"
  40 "hook_event_name":"PostToolUse"
   2 "hook_event_name":"PreTaskExec"
```

Two spec tasks were executed (`1.1`, `1.2`), giving two Pre/Post pairs. An
earlier control test completed an **agent todo-list** task and produced **zero**
task-trigger firings — that is the basis for "the task triggers are spec-only".

## Task triggers — the four firings

Task 1.1, hook in pass-through mode (exit 0):

```json
{"session_id":"sess_7f667c0b-9489-4c80-a145-ae757dbac8a6","hook_event_name":"PreTaskExec","cwd":"/Users/zhihay/workspaces/student-sandbox-spectest","spec_name":"/Users/zhihay/workspaces/student-sandbox-spectest/.kiro/specs/readme-documentation/tasks.md","task_name":"1.1 创建 verification 包骨架、数据模型与依赖固定文件"}
{"session_id":"sess_7f667c0b-9489-4c80-a145-ae757dbac8a6","hook_event_name":"PostTaskExec","cwd":"/Users/zhihay/workspaces/student-sandbox-spectest","spec_name":"/Users/zhihay/workspaces/student-sandbox-spectest/.kiro/specs/readme-documentation/tasks.md","task_name":"1.1 创建 verification 包骨架、数据模型与依赖固定文件","task_success":true}
```

Task 1.2, hook **armed to exit 2** on the Pre firing:

```json
{"session_id":"sess_df7da87c-5772-4796-b32d-2182436d6379","hook_event_name":"PreTaskExec","cwd":"/Users/zhihay/workspaces/student-sandbox-spectest","spec_name":"/Users/zhihay/workspaces/student-sandbox-spectest/.kiro/specs/readme-documentation/tasks.md","task_name":"1.2 实现 contract.py 契约常量与必备事实清单"}
{"session_id":"sess_df7da87c-5772-4796-b32d-2182436d6379","hook_event_name":"PostTaskExec","cwd":"/Users/zhihay/workspaces/student-sandbox-spectest","spec_name":"/Users/zhihay/workspaces/student-sandbox-spectest/.kiro/specs/readme-documentation/tasks.md","task_name":"1.2 实现 contract.py 契约常量与必备事实清单","task_success":true}
```

**The Post firing for 1.2 is the finding.** The hook refused the task with exit 2
and stderr, and the task still completed with `task_success: true`.

## Exit-2 blocking test — branch log

The probe logged which branch it took. All three lines across the capture:

```
  -> not armed: exit 0, passing through      <- my standalone self-test, unarmed
  -> ARMED: sentinel consumed, exiting 2     <- my standalone self-test, armed
  -> ARMED: sentinel consumed, exiting 2     <- the REAL firing, task 1.2
```

The first two are self-tests run directly from a shell to prove the script
exits 0 unarmed and 2 armed — so a null result could not be blamed on a broken
probe. Only the third is a real hook firing.

Within the real-test segment there is **exactly one** `PreTaskExec` and **zero**
pass-through lines. That rules out "blocked, then auto-retried": a retry would
have fired `PreTaskExec` again and, with the sentinel already consumed, logged
the pass-through branch.

Corroboration off the event stream: `verification/contract.py` exists (33 KB) and
`tasks.md` shows `1.2` as `[x]`.

## File-event payload shape

```json
{"session_id":"sess_7f667c0b…","hook_event_name":"PostFileCreate","cwd":"/Users/zhihay/workspaces/student-sandbox-spectest","file_path":"/Users/zhihay/workspaces/student-sandbox-spectest/.kiro/specs/readme-documentation/verification/models.py"}
```

Absolute `file_path`, and `cwd` supplied. One capture had a `cwd` in one
workspace with a `file_path` in a **different** workspace, so `file_path` must
not be assumed to live under `cwd`.

## Shell-event payload shape

`PostToolUse` (matcher `execute_bash`) carries the full command:

```json
{"session_id":"sess_f1c4cb5e…","hook_event_name":"PostToolUse","cwd":"/Users/zhihay/workspaces/aidlc-workflows-cde","tool_name":"execute_bash","tool_input":{"command":"…full command text…"},"tool_response":"Output:\n…\nExit Code: 0"}
```

**Only `execute_bash` was captured** — the probe's matcher excluded write tools,
so this capture says nothing about `tool_input` for `fs_write` / `str_replace` /
`fs_append`. That gap is called out in the chapter as the thing to measure next.

## Follow-up attempt: blocked, and why (same day)

Measuring the write-tool gap was attempted immediately afterwards and **could not
be completed in that session**. Probes for `PreToolUse` / `PostToolUse` on
`fs_write|str_replace|fs_append` never fired; neither did a diagnostic
`PostToolUse` probe with **no matcher at all**, despite the write tools provably
running (the target file carried all three edits).

Cause: the probe cleanup had `rm -rf`'d `.kiro/`, and hook pickup never recovered
for the rest of the session even after `createHook` recreated the directory and
wrote valid files. Last firing of the pre-deletion probes was 14:50:09, the
deletion followed at ~14:50, and nothing fired thereafter.

Two lessons, both now in the chapter's §5:

- Remove hook probe **files**, not the directory.
- A silent probe is only evidence when a control fires in the *same* window. Here
  the matcher-free control was itself silent, which is what identified the stale
  registry rather than a wrong matcher regex — exactly the discrimination the
  control discipline exists for.

---

## Write-tool run — raw capture (session `sess_be38d26e`)

Closes the write-tool gap the section above flagged as "the thing to measure
next". A fresh session restored hook pickup: the three probe files written at
14:56–14:57 (before this session began at ~15:02) all fired.

### The write-tool payloads

`PreToolUse` and `PostToolUse` both fire for all three write tools, and the
matcher alternation `fs_write|str_replace|fs_append` matches. Verbatim, one
firing each (`PostToolUse` shown only for `fs_write`; the other two are identical
plus their own `tool_response`):

```json
{"session_id":"sess_be38d26e…","hook_event_name":"PreToolUse","cwd":"/Users/zhihay/workspaces/aidlc-workflows-cde","tool_name":"fs_write","tool_input":{"path":"/tmp/aidlc-probe-scratch/probe-target.txt","text":"PROBE LINE ONE\nPROBE LINE TWO\n"}}
{"session_id":"sess_be38d26e…","hook_event_name":"PostToolUse","cwd":"/Users/zhihay/workspaces/aidlc-workflows-cde","tool_name":"fs_write","tool_input":{"path":"/tmp/aidlc-probe-scratch/probe-target.txt","text":"PROBE LINE ONE\nPROBE LINE TWO\n"},"tool_response":"Created the /tmp/aidlc-probe-scratch/probe-target.txt file."}
{"session_id":"sess_be38d26e…","hook_event_name":"PreToolUse","cwd":"/Users/zhihay/workspaces/aidlc-workflows-cde","tool_name":"str_replace","tool_input":{"path":"/tmp/aidlc-probe-scratch/probe-target.txt","oldStr":"PROBE LINE TWO","newStr":"PROBE LINE TWO EDITED","replace_all":false}}
{"session_id":"sess_be38d26e…","hook_event_name":"PreToolUse","cwd":"/Users/zhihay/workspaces/aidlc-workflows-cde","tool_name":"fs_append","tool_input":{"path":"/tmp/aidlc-probe-scratch/probe-target.txt","text":"PROBE LINE THREE APPENDED"}}
```

Three things follow, and they are what the chapter's §4 was waiting on:

- **`tool_input.path` is present and absolute** on both Pre and Post. Nothing has
  to be scraped out of prose.
- **The full write payload is present too** (`text`, or `oldStr`/`newStr`/
  `replace_all`) — and on `PreToolUse`, i.e. *before* the write lands.
- **`PreToolUse` carries `tool_input` but no `tool_response`.** Otherwise the two
  payloads are the same shape.

### Payload contract across every tool captured

Derived by parsing both logs and reducing to distinct
`(hook_event_name, tool_name)` → key sets:

```
PostFileCreate  -               top=[cwd, file_path, hook_event_name, session_id]
PostFileSave    -               top=[cwd, file_path, hook_event_name, session_id]
PreTaskExec     -               top=[cwd, hook_event_name, session_id, spec_name, task_name]
PostTaskExec    -               top=[cwd, hook_event_name, session_id, spec_name, task_name, task_success]
PreToolUse      fs_write        top=[cwd, hook_event_name, session_id, tool_input, tool_name]
                                tool_input=[path, text]
PreToolUse      fs_append       tool_input=[path, text]
PreToolUse      str_replace     tool_input=[newStr, oldStr, path, replace_all]
PostToolUse     fs_write        top=[… , tool_input, tool_name, tool_response]
                                tool_input=[path, text]
PostToolUse     fs_append       tool_input=[path, text]
PostToolUse     str_replace     tool_input=[newStr, oldStr, path, replace_all]
PostToolUse     execute_bash    tool_input=[command, cwd, run_in_background, timeout]
PostToolUse     read_file       tool_input=[limit, offset, path]
PostToolUse     list_directory  tool_input=[depth, explanation, path]
```

`session_id` + `cwd` are on **every** payload regardless of trigger.
`grep_search` is absent from the table only because the no-matcher probe piped
through `head -c 600` and its lines did not survive JSON parsing; read raw, it
carries `{query, caseSensitive, excludePattern, explanation, includePattern}`.
That truncation is the probe's, not Kiro's — the full-`cat` probe shows
`tool_response` arriving complete.

Note `read_file` and `list_directory` also expose `tool_input.path`, so a
read-scope check has something to inspect at least on the **Post** side.

### Key-name split across event families — counted

The table above shows it structurally; these are the counts backing the warning
in the chapter's §4, because an adapter that forwards verbatim will silently
no-op rather than fail:

```
tool events, "tool_input":{"path"        46
tool events, "tool_input":{"file_path"    0
file events, top-level "file_path"       41
```

Tool events say `path`; file events say `file_path`. The core hooks expect the
Claude shape `{tool_input:{file_path}}`, so neither family matches as-is and an
adapter must map.

### The registry is snapshotted at session start

Three mutations were attempted mid-session. **None took effect**, and each was
established against a control that fired in the same window:

| mutation | method | result |
|---|---|---|
| **create** a hook | `createHook` wrote `probe-block-test.json` (`PreToolUse`, matcher `fs_append`) and `probe-read-pre.json` | never fired — while the pre-existing `probe-write-pre` fired on the *same* `fs_append` call |
| **edit** a registered hook's command | pointed `probe-write-pre.json` at a different script | the **old** command still ran (old log header), so contents are cached, not re-read at fire time |
| **delete** a registered hook file | `rm probe-write-post.json` | still fired afterwards |

The create test is the clean one: two `PreToolUse` hooks both matching
`fs_append`, one registered at session start and one created minutes later. The
registered one fired, the new one did not, on the same tool call. Multiple hooks
per trigger definitely do run (`probe-alltools` and `probe-write-post` both fired
for the same `fs_append`), so this is not first-match-wins short-circuiting.

The block script was self-tested standalone first — exit 0 unarmed, exit 2 armed,
sentinel consumed — so its silence as a hook is attributable to registration, not
to a broken script:

```
===== PreToolUse(BLOCKTEST) … =====
{"self_test":"unarmed"}
  -> not armed: exit 0, passing through
===== PreToolUse(BLOCKTEST) … =====
{"self_test":"armed"}
  -> ARMED: sentinel consumed, exiting 2
```

#### This revises the earlier session's explanation

The section above attributed that session's dead probes to `rm -rf .kiro/`
breaking a directory watcher. A snapshot-at-session-start registry explains the
same silence without the watcher story: **those probes were mid-session
creations, which do not fire whether or not anything was deleted.**

The two sessions do genuinely conflict on one point — the earlier one recorded a
newly written hook firing on the very next tool call; this one measured the
opposite three ways. Unreconciled, and it does not need reconciling to be
actionable: **do not rely on mid-session hook pickup in either direction.**
Register probes, then start a new session, then treat the hook set as frozen.

Whole-directory removal was not re-tested here, so whether it differs from
single-file removal is still open. Single-file removal is now known *not* to
deregister.

### Still unmeasured, and now blocked until a new session

Both probes exist on disk and will be live at the next session start:

- **`PreToolUse` on read tools** (`probe-read-pre.json`, matcher
  `read_file|read_files|grep_search|list_directory`) — whether read-scope
  enforcement can act *before* a read.
- **`PreToolUse` exit 2 as a block** (`probe-block-test.json`, one-shot
  sentinel-gated on `fs_append`) — whether the v2 channel honours the block
  contract that `PreTaskExec` demonstrably does not (§3). `aidlc-block` and
  `aidlc-reviewer-scope` both rest on this, and it is asserted from the v1
  channel, not measured on v2.

To run them: start a fresh session, confirm `probe-read-pre` fires on any read,
then `touch /tmp/aidlc-probe-block.armed` and issue one `fs_append` to a scratch
path. If the append lands anyway, `PreToolUse` exit 2 is no more a veto than
`PreTaskExec` exit 2 — which would matter a great deal more.

Probe files live in the **untracked** `.kiro/hooks/` at the repo root. `.kiro/`
is not gitignored here: do not commit it.

## `PreToolUse` exit-2 blocking test — raw capture

Answers the question the write-tool round left as "the only thing gating the
enforcement work". Probe design: refuse **only** calls whose payload carries the
marker `AIDLC_BLOCK_PROBE_EXIT2`, so it is self-limiting by content — it cannot
interfere with normal work and needs no sentinel to clean up. Both branches log.

```
===== PreToolUse(fs_write) 2026-07-31T16:05:05+08:00 =====
{… "tool_name":"fs_write","tool_input":{"path":"/tmp/aidlc-probe-scratch/control-unmarked.txt","text":"control write, no marker present…
  -> pass-through: exit 0

===== PreToolUse(fs_write) 2026-07-31T16:05:34+08:00 =====
{… "tool_name":"fs_write","tool_input":{"path":"/tmp/aidlc-probe-scratch/armed-should-be-blocked.txt","text":"AIDLC_BLOCK_PROBE_EXIT2…
  -> EXIT2 BRANCH: writing stderr and exiting 2
```

Outcome on disk:

```
/tmp/aidlc-probe-scratch/
  control-unmarked.txt          67 bytes   <- pass-through call landed
  armed-should-be-blocked.txt   ABSENT     <- exit-2 call was refused
```

**`PreToolUse` exit 2 blocks the tool call.** The control write proves the probe
was not simply breaking every call, which is the only reading a single blocked
write would also support.

Contrast with §3 of the chapter: exit 2 blocks a **tool call** but does *not*
block a **spec task**. Two triggers, two different behaviours, no shared
semantics — measure each one you intend to enforce on.

### The `ask` contract — confounded, needs a redo

```
===== ASK probe fired 2026-07-31T16:07:58+08:00 =====
  -> emitting permissionDecision=ask on stdout, exit 0
===== PreToolUse(fs_write) 2026-07-31T16:07:58+08:00 =====
{… "path":"/tmp/aidlc-probe-scratch/ask-contract-target.txt" …}
  -> pass-through: exit 0
```

The write landed (92 bytes) with no confirmation prompt. But **two hooks matched
that same call** — both probes used the matcher `fs_write` — and the second exited
0 with empty stdout. A last-writer-wins merge across matching hooks explains the
outcome just as well as "ask is not honoured". Re-test with exactly one matching
hook before treating this as a result.

### Hook-pickup timing — the fourth data point

This round produced the observation that corrected the "registry is snapshotted at
session start" claim. The exit-2 probe did **not** fire early in a session, then
**did** fire roughly 25 minutes later *in that same session* — the payload's
`session_id` matches the session that had earlier seen nothing. Combined with the
two earlier contradictory observations, pickup is eventually consistent with
unbounded latency, not session-frozen. Chapter §5 item 4 carries the operating
rule.

## Read tools + the `ask` redo — raw capture (session `sess_2c7f5544`)

Closes both items the write-tool round left open. Two probe files registered
before this session started, with **deliberately disjoint matchers** so the
last-writer-wins confound of the previous `ask` attempt cannot recur:

| probe | trigger | matcher | question |
|---|---|---|---|
| `probe-read-block.json` | `PreToolUse` | `read_file\|read_files\|grep_search\|list_directory` | do read tools fire, and does exit 2 refuse a read? |
| `probe-ask-solo.json` | `PreToolUse` | `fs_append` | does `permissionDecision: ask` gate, with exactly one matching hook? |

Both log to `/tmp/aidlc-read-probe.log`. Liveness is not assumed: the read probe
fired on the session's ordinary reads before any test was staged, which is what
makes a null result elsewhere interpretable.

### `PreToolUse` fires for every read tool

All four matched tools fired, each carrying its own input shape:

```
tool_name":"read_file"       tool_input":{"path":"/abs/path", "offset":null,"limit":null}
tool_name":"read_files"      tool_input":{"paths":["/abs/one","/abs/two"], …}
tool_name":"grep_search"     tool_input":{"query":"ask","caseSensitive":null,"excludePattern":null, …}
tool_name":"list_directory"  tool_input":{"path":"/abs/dir","explanation":"…"}
```

Firing tally for the session: `read_file` × 4, `read_files` × 1,
`grep_search` × 1, `list_directory` × 1, `fs_append` × 1.

Note the key varies with the tool — `path` for the single-target reads, **`paths`
(array)** for `read_files`, and **`query` with no path at all** for
`grep_search`. A read-scope check cannot assume one field: `read_files` needs
every element checked, and a content search has no path to check against scope.

### `PreToolUse` exit 2 blocks a read

A/B on the same tool, same directory, same session. The probe refuses only
payloads carrying `AIDLC_READ_BLOCK_PROBE`, which here rides in the target's
filename:

```
===== PreToolUse(read) 2026-07-31T16:18:51+08:00 =====
{… "tool_name":"read_file","tool_input":{"path":"/tmp/aidlc-read-probe/control-target.txt" …}}
  -> pass-through: exit 0

===== PreToolUse(read) 2026-07-31T16:18:56+08:00 =====
{… "tool_name":"read_file","tool_input":{"path":"/tmp/aidlc-read-probe/AIDLC_READ_BLOCK_PROBE-target.txt" …}}
  -> BLOCK BRANCH: exit 2
```

Outcome: the control read returned the file's contents; the marked read returned
no content at all. The marked file **exists on disk** (120 bytes), so the refusal
is the hook's, not a missing target — the reading that a single blocked call
would also support.

What the agent receives in place of the content is worth recording, because it is
not a bare error:

```
Tool "read_file" was intercepted by PreToolUse hooks before execution.
… <HOOK_INSTRUCTION> … [the hook's stderr] …
The tool was NOT executed. Address each hook instruction, then decide whether to
proceed with the original tool call, modify your approach, or take a different action.
```

So the block is **real at the tool boundary** (nothing executed) but is
**presented to the model as advisory** — the surface explicitly invites deciding
to proceed with the original call. Enforcement therefore depends on the agent
honouring the refusal, which the Kiro system prompt does instruct. For
`aidlc-reviewer-scope` that is the difference between a hard sandbox and a
strongly-worded fence; the stderr should read as a refusal with a reason, since
it is the only thing standing between the model and a retry.

### The `ask` contract does NOT gate — clean single-hook redo

The confound is removed: the `fs_append` matcher is disjoint from the read
probe's, and the log shows exactly **one** hook entry for the call.

```
===== PreToolUse(fs_append) ASK 2026-07-31T16:19:08+08:00 =====
{… "tool_name":"fs_append","tool_input":{"path":"/tmp/aidlc-r…
  -> emitting permissionDecision=ask, exit 0 (SOLE matching hook)
```

Emitted on stdout, exit 0:

```json
{"hookSpecificOutput":{"permissionDecision":"ask","permissionDecisionReason":"AIDLC probe: clean single-hook test of the ask contract"}}
```

Outcome: **no confirmation prompt appeared and the append landed.** Target went
from 24 bytes (baseline) to 153 bytes, with the appended text present. Same
verdict as the confounded run, now on a test that supports it.

Consequence: on the v2 channel there is exactly **one** enforcement primitive —
exit 2, all-or-nothing. There is no "escalate to the human" middle setting, so a
hook that wants a human in the loop must refuse outright and say why in stderr.
Anything relying on `ask` to soften a gate should be designed as a hard refusal
instead.

### Scoreboard after this round

| Question | Verdict |
|---|---|
| `PreToolUse` fires on write tools | yes (previous round) |
| `PreToolUse` fires on read tools | **yes — all four probed** |
| `PreToolUse` exit 2 blocks a write | yes (previous round) |
| `PreToolUse` exit 2 blocks a read | **yes** |
| `PreTaskExec` exit 2 blocks a spec task | no (§3) |
| `permissionDecision: ask` gates a call | **no — clean test** |

Every `PreToolUse` finding needed for `aidlc-block` and `aidlc-reviewer-scope`
now holds on v2. The remaining unmeasured surface is not about blocking:
whether `PreTaskExec`/`PostTaskExec` fire per execution or per status transition
(§2), still one observation only.
