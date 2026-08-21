[English](README.md) | **中文**

# team-knowledge

让团队级知识**跨项目流转**。两个与 scope 无关的 stage 把知识搬进搬出一个共享 git
仓库，卡片格式为 [OKF v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)，
并且不破坏框架既有的三条不变量：LLM 不直接写长期记忆、人类做价值判断、确定性工具落盘。

- **`/team-knowledge-pull`**（inception）——检索 hub、与人一起挑选、导入。
  `Practice` 卡走 `aidlc-learnings.ts persist`；`Domain Knowledge` 卡落到 space 的
  knowledge seat。
- **`/team-knowledge-push`**（operation）——把本次工作流已确认的团队规则与领域知识写成
  卡片，用与 hub 门禁**同一份**校验器本地先跑通，再开 MR。

设计与论证见 [`CONTRACT.md`](CONTRACT.md)，本文是实现后的概览。

## 它解决什么

AI-DLC 的记忆与知识分层是**单项目闭环**：规则记忆跨 intent 但不跨仓库，团队知识止步
本地 space，`knowledge-plugin` 的 `.ai-ready/` 只服务它自己那个仓库。
`poc-accelerator` 早有一条跨项目通道，但绑死在该 scope 的两个 stage 里。

结果是一次交付里人类做出的判断——规则、修正、领域事实、被否决的路线——留在了那个仓库。
下一个项目换了人、换了仓库，重付一遍同样的学习成本。

## 什么能走，什么在结构上就走不了

| 来源 | 默认 |
|---|---|
| 过了学习仪式的 `team.md` 规则 | 候选 |
| 满足五条保存守则的 space `knowledge/` prose | 候选 |
| `.ai-ready/` 行业包（整包，带来源） | 候选 |
| `project.md` 规则 | **排除**——只有在导出闸口被具名人类重新定级才进 |
| stage `memory.md` 日记 | 永不 |
| audit / state / sensor 证据 | 永不 |

这张表就是"团队仓库不积累个性化内容"的实现方式：靠**结构**，不靠审查员自觉。项目级
内容不是"评审时被拒绝"，而是首先就不会被列为候选——所以它不是评审需要抓住的东西。

五条保存守则：任何离开项目的条目必须**已确认**、**已脱敏**、**已标注泛化等级**、
**已标注日期**，技术断言还必须**携带其证据**。最后一条尤其重要：一条错误的技术断言
一旦上库会被复用，而复用是不可见的。

## 卡片

一卡一文件——这既让两个项目同周沉淀不冲突，也让生命周期操作变成单文件 `git mv`、
trace 变成单文件 `git blame`。标准字段用 OKF 原名，我们的扩展全部收在一个 `cde:`
命名空间下（字段表见 README 英文版或 CONTRACT §6.3）。

其中四个决定是承重的：

- **`generated` 与 `verified` 是两个人。** 写卡片的 agent 不是确认内容为真的人。
  `verified` 是**事件列表**，复审 append 而非覆盖，历史不丢。
- **`cde.sanitization` 与 `verified` 分列。** "这条是真的"与"这条可以外传"是两个
  判断；混在一个字段里，其中一个会悄悄消失。
- **必须记 `content_key_scope`。** Content-Key 的算法是 `sha256(scope + "\0" + text)`，
  含 scope；不记 scope，将来拿 key 回查审计行会对不上。
- **`stale_after` 必填，且零容差反算。** OKF 自己的 `is_stale` 在该字段缺失时返回
  **false**（fail-open）——"没有时钟"会被读成"永不过期"。这份宽容恰恰是遗忘机制
  静默失效的地方。

## 派生态一律不入库

索引、stale 状态、trust tier、使用统计、去重摘要全部消费时现算。committed 的
`registry.json` 是一个每个 MR 都要重写的共享文件——它一票否决"一卡一文件永不冲突"，
还附送"忘了重新生成"这一类静默失败。

## 两类判定，刻意不合并

| 判定 | 依据 | 我们生产自己的卡 | 消费第三方 bundle |
|---|---|---|---|
| `okf-nonconformant` | OKF SPEC §11 三条硬性 | 硬拒 | 硬拒 |
| `cde-policy-violation` | 我们的家规 | 硬拒 | **warning** |

混为一谈会犯两个错：对内把家规违规报成"不符合 OKF"；对外用家规拒收一个完全合法的
第三方 bundle。`cde:` 块缺失的正确含义是"该包没有 CDE 元数据"——按 unverified 处理、
请人补齐溯源信息，而不是拒收。

## hub 仓库

骨架在 `agent-knowledge-governance` 仓库根的 `hub/`：`index.md`、`log.md`、`README.md`（含关于脱敏边界到底在哪的诚实声明）、
`CODEOWNERS`、`policy/lifecycle.json`、含 MR 门禁与三个定时任务的 `.gitlab-ci.yml`，
以及五个工具入口（对 vendored 校验器的薄封装）。

本插件曾带一份副本 `hub-skeleton/`。同一份骨架维护在两个仓库里必然漂移——
`sync-from-plugin.sh` 已经分叉且无人发现，因为"权威副本在仓库根 hub/"这句话是注释
而不是检查。该副本已删除，它的测试随骨架迁走，现在对着骨架本体跑。

```bash
git init my-team-knowledge && cd my-team-knowledge
cp -R <akg-repo>/hub/. .
./tools/sync-from-plugin.sh <repo>      # vendor 门禁，并写下 VENDOR-STAMP.txt
bun tools/validate-cards.ts             # 空库应当通过
```

然后把 URL 写进需要访问它的项目的 space memory：

```markdown
## Team Knowledge Repository
https://gitlab.example.com/team/aidlc-knowledge.git
```

**bot 可以开 MR，永不合 MR。** main 是保护分支，bot token 权限止于推分支；合入——
整条链路上唯一的权威写入点——由 CODEOWNER 人工完成。三个定时任务全是"提案"形态，
无变化时不产生任何提交或噪音。

## 安装

按 [`PLUGINS.md`](../../PLUGINS.md) 的通用插件安装步骤，`<plugin>` 填
`team-knowledge`。两个 stage 挂在全部核心 scope 上且为 `CONDITIONAL`：memory 里
没有 hub 地址、人也不给，就跳过，不会卡住工作流。

`team-knowledge-push` 额外挂在 `vibe` scope 上，`team-knowledge-pull` 刻意不挂。
自由会话的全部理由就是"学到的东西要留下来"，而它的沉淀本来就通过 push 所读的同一条
learnings 仪式落进 `team.md`——所以 4.95 这个位置（收尾之后）导出这一半原样适用。
pull 在 2.95，会跑在会话**打开之前**，把"开始干活"变成一次 hub 检索加人工筛选 gate，
而这正是 `vibe` scope 存在要保护的那个属性。自由会话里想拉的时候，一条
`aidlc-akp-registry.ts` 查询就够了——主动要的东西付这个代价是合适的。一个前提要注意：
如果你是从 Kiro 的 agent picker 选 `aidlc-vibe` 进来（而不是走 scope 命令），那个
persona 被写成不做编排的独立座位，不会自己交接到本 stage 的 `aidlc-developer-agent`
座位。想让收尾自动接上，用 `/vibe` 或 `/aidlc --scope vibe` 进入。

## 已知局限（不掩盖）

- **只能挡精确重复。** 去重摘要是归一化后的 `# 规则` 文本，Content-Key 又含 scope，
  所以两个团队措辞不同的同一条经验会被双双收录。唯一防线是 CODEOWNERS 人工评审；
  `tests/validator.test.ts` 刻意钉住了一个"近似重复且未被命中"的用例，防止有人误以为
  这层已经解决。
- **`verified` 混了两种强度的确认。** OKF 定义它是"对着 sources 确认为真"，而 spoke 端
  "我用过这条、有效"严格说不是同一件事。本设计接受这个近似，而不是另造一套新鲜度语义；
  若将来真的造成误判，修法是加字段，不是改语义。
- **org 级知识没有自动化通道。** `persist` 只接受 `project` 与 `team`，因此
  `cde.memory_target` 恒为 `team`。这类内容可以作为普通卡片存在 hub 里，只是没有自动
  落地路径；插件也**不**提供 `proposed_tier: org` 字段——一个存了却永远无法生效的字段
  比没有它更容易误导。
- **`--single` 写不了 memory。** `--stage … --single` 下没有合成 intent，
  `aidlc-learnings.ts` 跑不起来。pull stage 的 `report-only` 就是把这条路显式化：
  检索、报告、具名移交——绝不手改 `team.md` 假装完成。

## 与 `poc-accelerator` 的互操作

`poc-accelerator` 原本就有一条焊死在 Step 01 / Step 08 里的团队知识通道。两个插件
同时安装时，两端都改为委派：Step 01 走 `aidlc-akp-registry.ts` 的卡片索引并继承信任
信号，Step 08 写成 OKF 卡片并在推送前跑 `aidlc-akp-validate.ts --mode produce`。

委派**在构造上是可选的**，这不是谨慎而是硬约束：composer 今天不解析 `dependencies`
（插件机制 §7 列为 deferred），所以一个假定兄弟插件已安装的插件会在**运行时**崩。
不装本插件，poc 那两步行为与从前完全一致、sensor 判定不变——新增的四个记录字段
（`card_tooling` / `cards_imported`、`validate` / `cards`）只在出现时才校验。

**没有**收敛掉的部分：git 远端 URL 判定仍是每个插件各一份，因为 sensor 跑在 hook
路径上、不能跨插件 import。`tests/inherited-git-contract.test.ts` 用同一批 18 个 URL
同时喂三个 sensor，任何漂移都会红——这才让 §10.7 的"原样继承"变成可验证的说法。
等 composer 真正开始强制 `dependencies` 时，再收成一份模块。

## 测试

```bash
bun test plugins/team-knowledge/tests/
bun test plugins/poc-accelerator/tests/sensors.test.ts   # 收敛前被钉死的判定
```

本插件 105 条断言，覆盖内容校验、§11 规则表、三个 OKF 派生函数的移植、写入器键序、
两个 sensor、生命周期任务、跨插件 git 契约等价性，以及一条契约测试——用卡片构造的
selections 交给**真实的** `aidlc-learnings.ts persist` 跑通并验证幂等。已自动接入
仓库的 integration 层。
