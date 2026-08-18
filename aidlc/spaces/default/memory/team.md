# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Team Knowledge Repository

git@ssh.gitlab.aws.dev:zhihay/team-knowledge-hub.git

Read by the `team-knowledge` plugin's `team-knowledge-pull` / `team-knowledge-push`
stages; without this section both self-skip. Configuration, not an affirmed rule —
the learnings admission gate does not own this heading.

SSH form on purpose: `gitlab.aws.dev` refuses git over HTTPS (403, "use
Midway-signed SSH keys"), so the HTTPS URL would fail the stages' own
`git ls-remote` probe. Verified 2026-08-14 — `git ls-remote --heads` over SSH
returns `main` plus two `knowledge/*` deposit branches.

`zhihay/knowledge-hub` resolves to the same repository (identical ref SHAs), so
one path is a GitLab rename-redirect of the other. Which one is canonical could
not be established without authenticated access; if this is the redirect, GitLab
drops it once anything else claims the path, so re-verify before relying on it
long-term.

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
- 要判断一个测试实际约束了什么，读实现而不是读测试名——测试名描述的范围常比它真正守的范围大。实测：一个名为 `PROPERTY 1: exactly one stage` 的断言，数的是该插件自己 `stages/` 目录下的文件数，而不是它在执行网格里占的阶段数；照测试名会以为"给这个 scope 加任何阶段都会变红"，实际上完全不设防。代价是双向的：既可能因误以为有守护而放心改，也可能因误以为被挡住而绕远路——本次是后者，差点为一个不存在的约束改设计。通用。 (learned 2026-08-14) <!-- cid:vibe-session:c16:1e7d548d31176095 -->
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
- `gitlab.aws.dev` 拒绝一切 git over HTTPS——不要再用 HTTPS 试。clone/fetch/ls-remote/push 走 HTTPS 一律 403，附 `This GitLab instance does not allow git operations via HTTPS for security reasons. Please use Midway-signed SSH keys.`。唯一可用形式是 SSH：`git@ssh.gitlab.aws.dev:<namespace>/<repo>.git`——主机名是 `ssh.gitlab.aws.dev`，不是 `gitlab.aws.dev`。推论：写进 memory、配置或脚本的仓库地址必须是 SSH 形式，HTTPS 地址会让任何以只读探测开路的流程（如 team-knowledge 两个 stage 的 Step 1 `git ls-remote`）在第一步就失败。反面证据不成立：Web UI 的 HTTPS 照常响应（302 到 Midway IdP），所以"浏览器能打开"不是"git 能用"的证据，也不能用无认证的 HTTPS 请求判断仓库是否存在。实测 2026-08-14：同两个仓库路径，HTTPS 全 403，SSH 返回 `main` 加两个 `knowledge/*` 分支；另用一个不存在的路径做对照，SSH 确实报错，证明探测有区分力。通用于该实例上的全部仓库。 (learned 2026-08-14) <!-- cid:vibe-session:c19:b5a538422f7e7c23 -->
- 跨插件的 scope 引用是安全的，不会因兄弟插件缺失而崩：`transposeScopeGrid(stages, allowedScopes)` 会过滤掉不在 allowedScopes 里的 scope 名，所以插件 A 的 stage 在 `scopes:` 里声明插件 B 提供的 scope，在 B 未安装的环境里只是静默不生成该列。值得记是因为直觉相反——composer 目前不读 `dependencies`（插件机制 §7 列为 deferred），容易以为跨插件引用会在运行时崩，从而不敢用这个手段去做本该做的编排。证据是读 `aidlc-graph.ts` 的 `transposeScopeGrid` 实现，不是从现象推断。通用于 AIDLC 插件机制。 (learned 2026-08-14) <!-- cid:vibe-session:c15:c8254c0596733828 -->
- 用单行 grep 判断多行散文是否存在会给假阴性，而这种假阴性会直接导向错误动作。实测：核对一段新写入的 persona 文本是否落盘时 pattern 匹配失败，实际是该句在文件里跨行（`...end of the` 换行 `workflow.`），差点据此重跑一次已经成功的安装步骤。判断散文存在性要读文件；判断生成物是否一致要对源做逐字节 diff，例如 `diff <(sed 's/{{TOKEN}}/value/g' src) dst` 一次证明全部文件在位。通用，且与已沉淀的"文档包含命令 ≠ 命令有效"同族——都是拿错误形态的证据去回答一个验证问题。 (learned 2026-08-14) <!-- cid:vibe-session:c22:5dcb1c82b7ad88e4 -->
