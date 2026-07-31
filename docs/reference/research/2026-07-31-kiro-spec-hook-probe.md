# Kiro Spec hook probe — raw capture (2026-07-31)

Evidence for [19-kiro-spec-integration.md](../19-kiro-spec-integration.md).

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
