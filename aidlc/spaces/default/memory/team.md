# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

<!-- Affirmed during practices-discovery. Example: -->
<!-- We use GitHub Flow with feature branches. Branches live 3-5 days max. -->
<!-- Hotfixes branch from main and merge back via expedited review. -->

- A compatibility shim written in the old vocabulary tends to inherit the old defect. While fixing an identity key to be content-derived, the legacy branch used the legacy MARKER as its test — but a marker without a content hash cannot tell you whether the content matches, so the legacy path would have reproduced the exact bug being fixed. Express the compatibility test in terms of the new invariant (here: does the text already exist), not the old key. General. (learned 2026-08-06) <!-- cid:vibe-session:c32:802caa02ecd93849 -->
- Collapsing two surfaces into one NAME is not a simplification if the host resolves them by name — it is the introduction of a shadowing bug. Renaming a persona file to match its config twin, to merge two picker entries into one, silently made the config dead for three release cycles. When two surfaces are redundant, delete the redundant one rather than making it collide with the one that wins. General. (learned 2026-08-06) <!-- cid:vibe-session:c24:2ce0a686a6a031fa -->
## Walking Skeleton

<!-- Affirmed during practices-discovery. Example: -->
<!-- We don't run a walking skeleton — our deployment pipeline is mature -->
<!-- and the slice cost outweighs the value at our maturity stage. -->

## Testing Posture

<!-- Affirmed during practices-discovery. Example: -->
<!-- We use BDD. Specifications drive scenarios; scenarios drive code. -->
<!-- Each Unit ships with feature files in /features/. -->

- Name a defensive test for the condition it checks, not for a theory about when that condition can arise. A guard whose name asserts an impossible precondition stops being read as a live constraint: `set-autonomy` hard-fails on a missing state field, and its test was labelled the "v4 legacy state file" guard — so a freshly generated file hitting that exact branch went unexamined for as long as the label held. General; applies to any defensive branch. (learned 2026-08-06) <!-- cid:vibe-session:c10 -->
- Where a template is the contract, assert the generator against it, not only the fixtures. Comparing a fixture to its template proves nothing about the code that writes the real artifact: fixtures authored from a template agree with it forever while the generator disagrees with both. Measured — the missing generator-to-template edge let a documented state-file field go unwritten in every scope. General; applies wherever a template, schema, or golden file is claimed as a contract. (learned 2026-08-06) <!-- cid:vibe-session:c11 -->
- Asserting that a document contains a command is not asserting that the command works. Prose assertions are legitimate for prose — wording, presence of a rationale — but must never stand in for behavioural coverage of what the document instructs. Measured: a stage file's self-described load-bearing command satisfied a `toContain` check while failing at runtime, for the field it was supposed to set. General. (learned 2026-08-06) <!-- cid:vibe-session:c12 -->
- Do not put a wall-clock budget in a setup hook: it makes the suite's green a function of machine load rather than of correctness. Two tests here fail intermittently with "a beforeEach/afterEach hook timed out" against an unnamed test — a `beforeAll` that spawns builds under a fixed timeout. Every assertion passes in every run; only the lifecycle clock loses. That is precisely why such a failure survives indefinitely as "a known flake": it never points at a broken claim, so re-running until green feels justified. Derive the budget from the work, or retry the hook. General. (learned 2026-08-06) <!-- cid:vibe-session:c20 -->
- 归因测试失败用两个杠杆：同一份代码两次全量运行的失败集漂移（19 个文件失败 → 4 个，零代码变化）本身就是 flake 证据；对剩余失败做基线对照——把被测改动临时还原后重跑同一失败集，失败数持平（14 vs 13）即证明与改动无关。比逐个读失败原因快且结论硬。通用方法。 (learned 2026-08-09) (learned 2026-08-11) <!-- cid:vibe-session:c9:5fb480112d66f082 -->
- 跑长测试套件（分钟级以上）必须把完整输出落到日志文件，再从日志提取失败名单——绝不为拿名单把套件重跑一遍。实测代价：194 个文件的 unit 层约 13 分钟，为补一个被自己 tail 截掉的失败名单整层重跑，被用户手动中止。后台进程 + 日志文件（如 nohup/落盘再 grep）是正确形态。通用方法。 (learned 2026-08-09) (learned 2026-08-11) <!-- cid:vibe-session:c10:2abfbcc9461d4784 -->
## Deployment

<!-- Affirmed during practices-discovery. -->

## Code Style

<!-- Team-specific conventions beyond the linter. Example: -->
<!-- - Prefer named exports over default exports -->
<!-- - All async functions return Result<T, E>, never throw -->

## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->

## Tooling and Diagnostics
- A file's location can give it a role its author never declared — check what the HOST does with a directory, not only what our framework reads from it. Kiro treats both `.md` and `.json` under `.kiro/agents/` as agent configs, so a persona file intended purely as a stage prompt became a selectable picker entry in its own right; two filename stems produced two entries, and the one without `resources` or tool settings was the more discoverable of the two. Nothing reported a problem, because at the file level nothing was wrong. General: applies to any directory a host tool scans by convention. (learned 2026-08-06) <!-- cid:vibe-session:c3 -->
- A remediation message must name the case its reader will actually hit, not only the case the author had in mind. A compose drop advised "collides with an existing file (core or another plugin) — rename it to a plugin-namespaced path", but the file it collided with was the plugin's own previously-composed copy, which every plugin author hits on every edit; renaming the source would have been exactly the wrong fix. Diagnosing correctly means comparing against the tool's own prior output, not merely observing that a file exists. General. (learned 2026-08-06) <!-- cid:vibe-session:c6 -->
- Three different inputs producing a byte-identical outcome is evidence the input is not reaching the system — not evidence that the input is still wrong. Measured: an agent config's `tools` was edited three times (stale names, then omitted, then a wildcard) and the observed behaviour never moved once, because a same-stem file was shadowing the one being edited. Both intermediate conclusions were correct about the format and irrelevant to the failure. When a change is confirmed on disk and behaviour does not move, stop refining the change and prove the system reads that file. General. (learned 2026-08-06) <!-- cid:vibe-session:c23:d8f9ca714f7e38f7 -->
- Do not infer a mechanism from an observed outcome and then promote it as a rule. An observed idempotent result does not tell you what the idempotency is keyed on: a re-run wrote nothing, from which "keyed on content" was inferred and persisted into project memory, while the source keyed on a positional id — the opposite. A false technical rule in the memory layer is read as authoritative by every later session, and the tool exposes no retract verb. Read the mechanism before promoting a claim about it. General. (learned 2026-08-06) <!-- cid:vibe-session:c11:1570a8d9f910f963 -->
- When diagnosing an environment problem, the probe must run in the environment where the failure lives. A stripped-LOOKING shell is not the shell the failing process gets: `env -i sh -c` reports sh's built-in default PATH, which is not what a GUI-launched app hands a hook, and the difference happened to contain the directory that made a wrong fix look sufficient. Three successive diagnoses failed this way before the real mechanism was established. General. (learned 2026-08-06) <!-- cid:vibe-session:c28:2e09488ed6688d03 -->
- When a newly-added component is the first thing to fail, check whether it is merely the first USER of a shared dependency rather than the cause. A new agent reported as broken was simply the first thing in that session to invoke the shared runtime, which was missing from the PATH; the component was the symptom's location, not its origin. General. (learned 2026-08-06) <!-- cid:vibe-session:c30:32e203d5dcc7472e -->
