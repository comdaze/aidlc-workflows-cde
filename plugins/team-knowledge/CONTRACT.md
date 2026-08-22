# team-knowledge — 需求与设计文档

> 状态：**已实现**（插件 v0.1.0）。本文是 `plugins/team-knowledge/` 的需求与集成契约，
> 对应仓库约定与 `plugins/knowledge-plugin/CONTRACT.md` 一致。
>
> 版本：0.1（2026-08-09）· 目标框架版本：upstream 2.5.59 · 卡片格式：OKF v0.2

---

## 0. 实现说明（as-built，2026-08-11）

P0–P4 已落地并全绿（86 条断言，`bun test plugins/team-knowledge/tests/`）；
compose 到真实 Claude 安装零 drop，`--doctor` 49 项全过并报告
`team-knowledge=2` 个启用 stage，引擎分配的显示编号为 2.9 / 4.8。
下面三处与本文原稿不同，都是被引擎行为**验证**出来的，不是取舍：

1. **stage slug 必须带插件前缀。** compose 硬性要求插件自有 stage 的 slug 以
   `<plugin>-` 开头（`scripts/plugin-hooks-template/compose.ts:1005`），否则整个 stage
   被 degraded-drop 掉、文件在盘上却永不上图。因此 §9.1 的 `team-knowledge-pull` /
   `team-knowledge-push` 实际为 **`team-knowledge-pull` / `team-knowledge-push`**
   （文件名同步，slug == 文件名 stem）。调用命令相应为 `/team-knowledge-pull`。
   产物名 `team-knowledge-{pull-preflight,push-deposit}` 同样满足 §8 的命名空间要求。
2. **§8.4 的三个定时任务作为插件工具实现，hub 侧只放薄封装。** 它们是对 bundle 做
   运算的 TS，与 validate / registry 同类；`tools/aidlc-akp-lifecycle.ts` 提供
   `review-debt | carry-affirmations | propose-archive` 三个子命令，
   hub 骨架 `tools/` 下 §7.1 承诺的五个文件名是对 vendored 模块的薄封装。
   这样"双侧共用一份实现"（§8.3）对定时任务同样成立，而不是只对校验器成立。
3. **`propose-archive` 不翻 `status`。** §11.8 会拒收"deprecated 且无后继链接"的卡，
   所以自动归档只能产出 `ARCHIVE-PROPOSAL.md` 决策清单交人处理——这与 §4.4 一致，
   在此写明是因为"归档"一词容易被读成"自动降级"。

hub 骨架是 P1 的可运行起点（含 MR 门禁与三个 scheduled job 的 `.gitlab-ci.yml`、
CODEOWNERS、policy、五个工具入口与 `sync-from-plugin.sh`），维护在
`agent-knowledge-governance` 仓库根的 `hub/`。本插件曾带一份 `hub-skeleton/` 副本，
因两处维护必然漂移而删除。

### 0.1 P5 的实际形态：委派 + 具名降级，不是"两份合成一份"

P5 已做，但**没有**按字面把两份实现删成一份，原因是一个硬约束：composer 今天
根本不解析 `aidlc.contributes` / lockfile / `dependencies`（插件机制 §7 明列 deferred）。
所以 `poc-accelerator` 声明依赖本插件只是文档，用户单独启用 poc 时不会带上 akp，
而 sensor 跑在 hook 路径上、不能因为兄弟插件没装就崩。落地方案：

- **stage prose 委派。** poc Step 01 / Step 08 在 `{{HARNESS_DIR}}/tools/aidlc-akp-*.ts`
  存在时改走卡片索引与 `--mode produce` 校验；不存在时走原有 prose 流程，并在记录里
  写 `card_tooling: absent`。降级是**具名**的，不是静默的。
- **sensor 字段新增但全部可选。** preflight 多 `card_tooling` / `cards_imported`，
  deposit 多 `validate` / `cards`；**只在出现时**校验，`entries:` 依旧必填。因此
  §12 P5 的完成判据"原 sensor 判定不变"成立——且是被测出来的，不是声明的：
  `plugins/poc-accelerator/tests/sensors.test.ts` 先以黑盒 CLI 钉住了改动前的全部
  判定（28 条），改完后仍全绿。
- **共享判定用等价测试收敛，而不是共享代码。** git 远端 URL 判定在两个插件里各有
  一份（sensor 不能跨插件 import）；`tests/inherited-git-contract.test.ts` 用同一批
  18 个 URL 同时喂三个 sensor，任何一侧漂移都会红。§10.7 的"原样继承"从此可验证。

代价说清楚：`isGitRemoteUrl` 与 block 解析 helper 仍是两份代码。这是为"poc 可独立
安装"付的价；等 composer 真正解析 `dependencies` 之后，可以再收成一份。

---

## 1. 背景与问题陈述

AIDLC 当前的知识与记忆分层是**单项目闭环**的：

- 规则记忆（`aidlc/spaces/<space>/memory/{org,team,project}.md`）跨 intent 持久，但不跨仓库。
- 团队知识（`spaces/<space>/knowledge/`）同样止步于本地 space。
- `knowledge-plugin` 从棕地代码提炼出带锚点的深度知识（`.ai-ready/`），也只服务当前仓库。
- `poc-accelerator` 已经有一条**跨项目**通道（Step 1 预检读、Step 8 沉淀写团队知识库 git
  remote），但它绑死在该 scope 的两个 stage 内，其他 scope 与插件无法复用。

结果是：一次交付里人类做出的判断（规则、修正、领域事实、被否决的路线）在项目结束后停留在
该仓库内。下一个项目由不同的人、在不同的仓库里从零开始，重复付出同样的学习成本。

本插件要解决的是**团队级知识的跨项目流转**，并且必须在流转过程中不破坏现有分层的三条不变量：
LLM 不直接写长期记忆、人类做价值判断、确定性工具落盘。

### 1.1 四个必须回答的问题

| 问题 | 本文对应章节 |
|---|---|
| 1. 有什么 —— 存什么、不存什么 | §5 导出面 |
| 2. 什么形式 —— 怎么组织、怎么 merge | §6 卡片 schema、§7 hub 组织 |
| 3. 怎么进化 —— 新鲜、遗忘、修正 | §8 生命周期与自动化 |
| 4. 怎么用 —— 下一个项目如何消费 | §9 插件侧设计 |

---

## 2. 目标与非目标

### 2.1 目标

- **G1** 把已过学习仪式的团队级规则与已确认的领域知识，沉淀到一个团队共享 git 仓库
  （示例：`https://gitlab.aws.dev/zhihay/aidlc-cde-knowledge`）。
- **G2** 沉淀与消费两条通道都**与 scope 无关**，任何 scope 或插件均可调用。
  注意区分"可被任何 scope 调用"（能力）与"默认挂在哪些 scope 上"（成员资格）：
  后者是每个 stage 的 `scopes:` 列表，按 `transposeScopeGrid` 纯转置成执行网格。
  两者都挂满全部核心 scope；`team-knowledge-push` 另挂 `vibe`，而
  `team-knowledge-pull` **刻意不挂** ——它带人工筛选 gate 且位于 construction 上游
  （2.95），在无 rails 的 scope 上会跑在会话打开之前，破坏该 scope 唯一要守的属性。
  这是成员资格的取舍，不是 G2 的例外：pull 在 `vibe` 里依旧可被显式调用。
- **G3** 每条知识可端到端溯源：hub 卡片 ↔ 原项目审计行 ↔ 原 stage 记录。
- **G4** 知识有生命周期：新鲜度可判定、过期会降权、修正有明确路径、废弃不删除。
- **G5** 团队仓库不积累个性化内容——这一点靠**结构**保证，不靠审查员自觉（§5.2）。
- **G6** 采用行业标准格式（OKF v0.2），而非自造方言。

### 2.2 非目标

| 不做 | 理由 |
|---|---|
| 向量检索 / embedding / RAG | 框架当前是 path-loaded knowledge；检索层是框架级能力，不是本插件的职责 |
| 自动判定一条知识该不该外传 | 脱敏是价值判断，必须具名人类批准；机器只做 deny-pattern 兜底 |
| 自动 merge 到 hub | bot 可以开 MR，永不 merge。合入即权威，权威必须由人授予 |
| 从代码重新生成卡片 | 卡片是人类判断的沉淀，不可从代码再生；重新生成等于销毁权威（§4.1） |
| 写入 `org.md` | 框架无此写入路径，且 org 层属 upstream 资产（§10.1 已验证） |
| 替代 `knowledge-plugin` | 二者互补：那个插件产出**代码事实**，本插件流转**人类判断** |

### 2.3 约束

- **C1** 本插件必须完全落在 `plugins/` 内。按 `AGENTS.md` 的 upstream 分叉政策，
  `core/` 与 `harness/` 的改动是最后手段；如不可避免，须在 `docs/fork/divergence.md` 记录。
- **C2** 只 bump `plugins/team-knowledge/.aidlc-plugin/plugin.json` 的版本，
  不动 `core/tools/aidlc-version.ts`、README badge、`CHANGELOG.md`。
- **C3** 不得引入 `core/aidlc-common/stages/` 的顺序依赖（contribution seam 的 `adds`
  只实现 produces / sensors / consumes / required_sections，改不了执行顺序）。

---

## 3. 需求

### 3.1 功能需求

**沉淀（push）**

- **FR-1** 从活动 space 的 `team.md` 中识别尚未上库的规则候选，依据其 `RULE_LEARNED`
  审计行的 Content-Key 与 hub 现有卡片比对。
- **FR-2** `project.md` 的规则**默认不进入候选面**；只有在导出闸口被人类显式重新定级为
  team 级时才参与（§5.2）。
- **FR-3** space `knowledge/` 下的 prose 可作为候选，须满足五条保存守则（§5.3）。
- **FR-4** 逐条人工批准，含具名脱敏批准人；未获批准的条目不得离开本地。
- **FR-5** 生成符合 §6 的 OKF 卡片，本地 fail-closed 校验通过后推分支并开 MR。
- **FR-6** 推送被拒（无写权限）时产出 patch 文件并具名移交，**不允许"跳过"作为结论**。
- **FR-7** 产出 deposit 产物，由 sensor 校验其 YAML 块完整性。

**消费（pull）**

- **FR-8** 从 memory 层 `## Team Knowledge Repository` 读取 hub git URL；缺失则必答提问。
- **FR-9** `git ls-remote` 只读探测；探测失败不是结论，须重新索取 URL。
- **FR-10** 按 tags / domain / type 检索 hub（消费侧现算索引，§7.3）。
- **FR-11** `Practice` 卡的导入**必须走 `aidlc-learnings.ts persist`**，逐条人工确认，
  不直接改写 memory 文件（§9.2）。
- **FR-12** `Domain Knowledge` 卡拷入 `spaces/<space>/knowledge/<seat>/`，frontmatter 随卡保留。
- **FR-13** 导入 stale 卡片时必须显式告知并要求人类重新确认，方可使用。
- **FR-14** 产出 preflight 产物，记录导入的卡片 concept ID 清单（反向 trace 登记点）。

**生命周期（hub 侧）**

- **FR-15** MR pipeline fail-closed 校验每张卡（§11）。
- **FR-16** 定时任务产出到期复审清单，按 CODEOWNERS 分组。
- **FR-17** 定时任务把 spoke 端交回的使用确认聚合为 bot MR，刷新 `verified` 与 `stale_after`。
- **FR-18** 定时任务对超过宽限期的 stale 卡片开归档提案 MR；**永不 auto-merge**。

### 3.2 非功能需求

- **NFR-1（可合并性）** 两个项目在同一周沉淀，MR 之间不得产生冲突。
  ⇒ 一卡一文件；共享文件（索引、统计）一律不入库（§4.2）。
- **NFR-2（可读性）** 卡片无需工具即可 `cat` 阅读；git diff 是唯一的人工评审界面。
  ⇒ frontmatter 键序固定（§6.4）。
- **NFR-3（可溯源）** 任一卡片可在 1 跳内定位到原项目的审计行。
- **NFR-4（诚实失败）** 任何环节失败都必须显式：红 pipeline、bot MR、issue。
  不允许静默成功。
- **NFR-5（token 成本）** 消费侧一次导入不得整读 hub；先读索引再按需取卡。
- **NFR-6（互操作）** hub 是合规 OKF v0.2 bundle，可被任意 OKF 感知工具消费。

---

## 4. 关键设计决策

每条都记录被否决的方案，因为否决理由是这套设计的真正约束。

### 4.1 不采用 OpenWiki 的核心模型，只采纳 OKF 格式

[OpenWiki](https://github.com/langchain-ai/openwiki) 的模型是"agent 持续重写文档"：内容从源码
派生、可随时重新生成，新鲜度 = 重新推导。**我们存的东西恰好相反**——规则、修正、带证据的判断
是人类判断的沉淀，不可从代码再生，重新生成等于销毁权威。其个人模式连接器
（Notion / Gmail / Slack）与脱敏边界也方向相反。

值得采纳的有两点：定时 CI 开 docs-MR 且"无变化不产生提交"的形态；以及它文档里那句诚实声明
——read boundary 挡不住 agent 从旁证推断出被忽略的内容。后者正是我们坚持
"deny-pattern 只是兜底、具名批准才是真正的门"的理由，应原样写入 hub README。

### 4.2 一卡一文件

否决方案：按主题聚合成大文件。

理由：两个项目同周沉淀必然在同一文件上冲突，NFR-1 直接失败。一卡一文件同时让生命周期操作
变成单文件 `git mv`、trace 变成单文件 `git blame`。卡片 ID 直接用 OKF 的 concept ID
（相对 bundle 根的路径去掉 `.md`），不另设 `id` 字段。

### 4.3 派生态不落盘

以下全部在消费时现算，不入库：

| 派生物 | 从哪算 |
|---|---|
| 索引（registry） | 扫全库 frontmatter |
| stale 状态 | `today >= stale_after`（OKF §5.5） |
| trust tier | `verified` 中有无 `human:` 前缀（OKF §5.3） |
| 使用统计 | `feedback/` 目录聚合 |
| 去重摘要 | 卡片 `# 规则` 小节归一化文本的哈希 |

否决方案：CI 生成并提交 `registry.json`。理由：每个 MR 都要重写这个共享文件，
"一卡一文件永不冲突"被它一票否决；且会引入"忘了重新生成"这一类静默失败。

### 4.4 不原地改写

修正 = 新卡 + 旧卡 `status: deprecated` + markdown 链接指向后继卡，且**必须在同一个 MR 内完成**。
分两次合入会留下一个中间态：一张卡已被取代但仍标 `stable`，而这个中间态一定会被人读到。

同时删掉了早期草案里的 `archive/` 目录：OKF 的 `deprecated` 语义已经是"保留供链接和历史、
不再当前"，移动文件会打断入链，反而破坏 trace。归档降级为可选的整理动作。

### 4.5 写者与确认者分离

采纳 OKF 的 `generated` / `verified` 二分。这是早期草案（单一 `last_affirmed` 字段）缺失的
一维：写卡片的 agent 不是确认内容为真的人，`verified` 是**事件列表**，每次复审 append 一条，
历史不丢。

### 4.6 脱敏批准不复用 `verified`

`cde.sanitization` 单列。理由：**"这条是真的"与"这条可以外传"是两个不同的判断**，
混在一个字段里会让其中一个悄悄消失。这也保留了 `poc-accelerator` 既有 sensor 的
`sanitization_approved_by` 语义。

### 4.7 独立 stage，不做 core stage 的 contribution

否决方案：以 contribution 形式挂到核心 stage 上。理由见 C3：`adds` 改不了执行顺序，
而 pull 必须发生在设计类 stage **之前**、push 必须在收尾**之后**。独立 stage 任何 scope
都能在任意位置调用，这才满足 G2。

`poc-accelerator` 的 Step 1 / Step 8 后续可改为调用本插件的工具，把两份实现收敛为一份。

---

## 5. 导出面：有什么，不存什么

### 5.1 三个来源流

| 来源 | 准入条件 | 默认 |
|---|---|---|
| `team.md` 规则 | 已过学习仪式（有 cid 标记 + `RULE_LEARNED` 审计行），且 hub 无同摘要卡片 | ✅ 候选 |
| `project.md` 规则 | 仅在导出闸口被人类显式重新定级为 team 级 | ❌ 结构性排除 |
| space `knowledge/` prose | 满足五条保存守则 | ✅ 候选 |
| `.ai-ready/` 提炼的行业包 | 整包导出，带来源与签字记录 | ✅ 按包 |
| stage `memory.md`（日记） | —— | ❌ 永不导出 |
| audit / state / sensor 证据 | —— | ❌ 永不导出 |

### 5.2 "不存个性化"靠结构，不靠自觉

这是 G5 的实现方式：`project.md` 层根本不在默认导出面上，stage 日记根本不在导出面上。
个性化内容不是"评审时被拒绝"，而是**首先就不会被列为候选**。

`org.md` 也不在导出/导入面上——不是因为策略，而是框架没有这条写入路径（§10.1）。

### 5.3 五条保存守则（沿用既有 vibe-sedimentation 词汇）

任何离开项目的条目必须：已确认（未验证的假设留在日记）、已脱敏、**已标注泛化等级**、
已标注日期、**技术断言携带其证据**。最后一条尤其重要：一条错误的技术断言一旦上库会被复用，
而复用是不可见的。

---

## 6. 卡片 schema 定稿（OKF v0.2）

### 6.1 "按 OKF 标准来"具体等于什么

**Google 没有发布 OKF 的 validator，也没有 JSON schema。**
[`GoogleCloudPlatform/knowledge-catalog`](https://github.com/GoogleCloudPlatform/knowledge-catalog)
只提供 `okf/SPEC.md`（纯 prose）+ 一个 Python 参考 agent，其
`okf/src/reference_agent/bundle/document.py` 是事实上的参考解析器，而它的 `validate()`
只强制一件事：`type` 非空。

因此"合规"不是跑官方工具，而是：(a) 遵守 SPEC §11 的三条硬性；(b) 字段名与语义逐字复用；
(c) 严格度由我们自己的 validator 承担，且只在我们的扩展空间内加严。

### 6.2 生产者严格 / 消费者宽容 —— 两套判定

OKF §11 明确：消费者 **MUST NOT** 因缺失可选字段、未知 `type`、未知扩展键、断链而拒绝
bundle。而我们要求 `title` / `description` / `tags` / `verified` / `sources` / `cde`
全部必填——**这是家规，不是 OKF 合规**。混为一谈会犯两个错：对内把家规违规报成"不符合 OKF"；
对外用家规拒收一个完全合法的第三方 bundle。

| 判定 | 依据 | 生产侧（我们的 MR） | 消费侧（导入他人 bundle） |
|---|---|---|---|
| `okf-nonconformant` | SPEC §11 三条 | 硬拒 | 硬拒 |
| `cde-policy-violation` | §11 家规表 | 硬拒 | 降级为 warning |

`cde:` 块缺失在消费侧的正确含义是"该包没有 CDE 元数据"，按 `unverified` 处理并要求人工补齐，
**不是拒收**。

### 6.3 字段表

标准字段用 OKF 原名；我们的扩展全部收在**一个** `cde:` 嵌套键下——SPEC 允许任意扩展键且要求
消费者保留未知键往返，收在一个命名空间内可杜绝未来 OKF 标准化新字段时撞名。

| 字段 | 必填 | 取值 / 含义 |
|---|---|---|
| `type` | ✅ OKF 硬性 | `Practice` / `Domain Knowledge` / `Knowledge Pack` |
| `title` | ✅ 家规 | 一行显示名 |
| `description` | ✅ 家规 | 一句话摘要，喂 `index.md` 与检索片段 |
| `tags` | ✅ 家规 | 受控词表；新 tag 只 warning |
| `status` | — | `draft` / `stable` / `deprecated`，缺省 `stable` |
| `generated` | ✅ 家规 | `{by: <actor>, at: <ISO8601>}`，谁**写**的 |
| `verified` | ✅ 家规 | 事件列表 `[{by, at}]`，谁**确认**过 |
| `stale_after` | ✅ 家规 | 绝对日期，由 policy 推导、validator 反算校验（§8.1） |
| `sources` | ✅ 家规 | ≥1 条；正文用 `[^id]` footnote 逐条归因 |
| `cde` | ✅ 家规 | 见 6.3.1 |

`actor` 用 OKF §7 约定：`human:<id>` / `process:<id>` / `<producer>/<version>`。

#### 6.3.1 `akp:` 扩展

**两个 profile，两套必填。** hub 是 host-neutral 闸口：一个共享 hub 里的每张卡，
不论谁写的，都必须过。`aidlc` 在其上追加 AIDLC 自己往返所需——即验证器的
`--profile aidlc`，由 push stage 对**自己的产出**运行。

早先这张表把两者混作一列，验证器便把 AIDLC 的契约施加于全 hub。后果是可测的：
Quick 写入的 54 张卡各带同十类错误（约 53 份），而唯一的通过办法是编一个
`intent: amsp-quick`——一个指向不存在之物的 trace 锚点，比留空更糟，因为读的人会去追。

**hub profile（全部卡片）**

| 字段 | 必填 | 含义 |
|---|---|---|
| `akp.class` | ✅ | `knows` / `judges` |
| `akp.generalization` | ✅ | `industry-generic` / `needs-recalibration` |
| `akp.origin` | ✅ | 产出系统**自己地址空间里的一个坐标** |
| `akp.origin.agent_system` | ✅ | 哪个 agent 系统产出（`aidlc` / `kirocrew` / `quick` / `cursor` / `manual`）。不写这一项，下面的坐标就落在一个没有名字的地址空间里：不认识产出方的读者无从知道 `intent` 或 `memory_id` 指的是什么 |
| `akp.origin.<坐标>` | ✅ 至少一项 | 在那个系统里定位所需的字段。**查形状不查词汇**：AIDLC 用 project/intent/stage/content_key，AMSP 宿主用 agent/machine/memory_id——两者回答同一个问题，各用自己的词 |
| `akp.sanitized_by` | ✅ | `{by: human:<id>, at: <date>}` 谁批准其**离开**交付现场 |
| `akp.origin.content_key_scope` | 记了 key 才必填 | 该 key 计算时的 scope（`project` / `team`） |
| `akp.memory_target` | 声明了才校验 | 若声明，**仅 `team`**（`org` 无写入路径，§10.1） |
| `akp.heading` | 声明了才校验 | 若声明，限 §10.4 的 8 个 |
| `akp.knowledge_seat` | 声明了才校验 | 若声明，须是已安装的 agent seat 或 `aidlc-shared` |
| `akp.supersedes` | — | 被本卡取代的 concept ID（与正文链接互为镜像） |
| `akp.review_interval_days` | — | 覆盖 policy 默认半衰期，须在正文说明理由 |

后三项是**条件式而非必填**：它们描述的是**导入目的地**——一条 Practice 规则落在
`team.md` 的哪个标题下、一张 Domain Knowledge 卡落在哪个席位。任何有记忆层的宿主
都有这个需求，但只有 AIDLC 的答案拼作 `## Testing Posture` / `aidlc-shared`；
一张永远不会被导入 AIDLC space 的卡，没有这样的目的地可写。SPEC §11 V6 原本就是
这个措辞（"`akp.heading` in known headings"），是验证器把它读成了必填。

**aidlc profile（追加）**

| 字段 | 追加要求 | 为什么 |
|---|---|---|
| `akp.origin.project` | ✅ | 来源项目代号（脱敏，非客户名） |
| `akp.origin.intent` | ✅ | intent 记录目录名 |
| `akp.origin.stage` | ✅ | stage slug |
| `akp.origin.content_key` | ✅ | 原项目 `RULE_LEARNED` 行的 Content-Key（trace 锚点） |
| `akp.memory_target` | Practice ✅ | pull 阶段要知道往哪写 |
| `akp.heading` | Practice ✅ | 同上，限 §10.4 的 8 个 |
| `akp.knowledge_seat` | Domain Knowledge ✅ | 落到哪个 agent seat 的 knowledge 目录 |

`content_key_scope` 是**条件于声明本身、而非条件于谁在声明**：记了 Content-Key 就
必须记 scope。理由不是家规——Content-Key 的算法是 `sha256(scope + "\0" + text)`（§10.2），
**含 scope**。一条 project 级规则在闸口被重新定级为 team 时，本地 key 是按 `project`
算的；不记 scope，将来拿 key 回查审计行会对不上。对不用 Content-Key 的宿主，这一条
自动空过——这正是要点。

命名空间为 `akp:`；`cde:` 仍被读取（历史卡片），写入端一律用 `akp:`。

### 6.4 固定键序（NFR-2）

参考实现用 `yaml.safe_dump(sort_keys=False)`，即**键序按作者原样保留、不排序**。任何写入端
（push 工具、carry-affirmations bot）键序不稳定，都会让改一个 `verified` 事件变成整块
frontmatter 重排，diff 一片红。写入器固定：

```
type, title, description, tags, status,
generated, verified, stale_after, sources, cde
```

### 6.5 完整样例：Practice 卡

`practices/data-boundary/mock-data-synthesis.md`

```markdown
---
type: Practice
title: Mock 行情数据必须全合成参数化生成
description: 演示与回测用数据不得对客户文件做统计拟合或数值摘录。
tags: [mock-data, data-boundary, power-trading]
status: stable
generated: { by: aidlc-vibe/2.5.59, at: 2026-08-09T09:51:56Z }
verified:
  - { by: human:zhihay, at: 2026-08-09T09:51:56Z }
stale_after: 2027-02-09
sources:
  - id: session
    resource: feedback/agentic-power-trading/2026-08-09.json
    title: 沉淀会话记录
    author: human:zhihay
    last_modified: 2026-08-09
cde:
  class: judges
  generalization: industry-generic
  origin:
    project: agentic-power-trading
    intent: 260809-mock-dataset
    stage: vibe-session
    content_key: e8b664a0a7862232
    content_key_scope: project
  sanitization: { by: human:zhihay, at: 2026-08-09 }
  memory_target: team
  heading: "## Mandated"
---

# 规则

mock 行情数据必须全合成参数化生成（种子可复现），参数只取公开领域常识值（限价区间、
日内形态）；不得对客户文件做任何统计拟合或数值摘录。mock 文件与原文件同名、结构等价，
可零改码替换数据目录。[^session]

# 为什么

拟合会把客户数值以统计特征的形式带出交付现场——形式上"没有复制数据"，实质上泄漏。
代价是 mock 上的回测指标与真实市场不可比，这一点必须随规则一起传递。

[^session]: 沉淀会话记录
```

`# 规则` 小节是**去重摘要的唯一计算范围**：`verified` 会随复审增长、`# 为什么` 可能补充，
若摘要覆盖全文，同一条规则的摘要会随时间漂移，去重失效。

### 6.6 完整样例：Domain Knowledge 卡（片段）

```markdown
---
type: Domain Knowledge
title: 山东现货市场日内价格形态
description: 双峰负荷、午间光伏压价、晚峰爬坡的成因与典型区间。
tags: [power-trading, spot-market, shandong]
status: stable
generated: { by: human:zhihay, at: 2026-08-09T10:00:00Z }
verified:
  - { by: human:zhihay, at: 2026-08-09T10:00:00Z }
stale_after: 2027-08-09
sources:
  - id: rules
    resource: https://<公开规则文件 URL>
    title: 省级现货市场运营规则
    last_modified: 2026-03-01
cde:
  class: knows
  generalization: needs-recalibration
  origin: { project: agentic-power-trading, intent: 260809-mock-dataset,
            stage: vibe-session, content_key: 70e94c13bfa0f8ca,
            content_key_scope: project }
  sanitization: { by: human:zhihay, at: 2026-08-09 }
  knowledge_seat: aidlc-shared
---
```

---

## 7. hub repo 组织

### 7.1 目录结构

```
aidlc-cde-knowledge/
  index.md                          # bundle 根；唯一允许带 frontmatter 的 index：okf_version: "0.2"
  log.md                            # CI 从 git 历史生成
  README.md                          # 消费与贡献契约（含 §4.1 的诚实声明）
  practices/<topic>/*.md             # type: Practice
  knowledge/domains/<domain>/*.md    # type: Domain Knowledge
  knowledge/aws/*.md                 #   半衰期最短
  knowledge/engineering/*.md
  packs/<pack>/pack.md               # type: Knowledge Pack（+ 同目录 index.md 作清单）
  references/                        # OKF §6.3 约定：外部材料镜像
  feedback/<project>/<date>.json     # 注意：JSON，不是 md
  policy/lifecycle.json
  tools/{validate-cards,gen-registry,review-debt,propose-archive,carry-affirmations}.ts
  CODEOWNERS
  .gitlab-ci.yml
```

### 7.2 `feedback/` 为什么是 JSON

OKF 合规要求 bundle 内每个非保留 `.md` 都是带 `type` 的 concept。反馈是机器消费的运行记录、
不是知识，塞成 concept 会污染知识图谱。改成 JSON 就完全落在 OKF 的 `.md` 规则之外。

```json
{
  "project": "agentic-power-trading",
  "intent": "260809-mock-dataset",
  "date": "2026-08-09",
  "imported": ["practices/data-boundary/mock-data-synthesis"],
  "affirmed": [{ "card": "practices/data-boundary/mock-data-synthesis",
                 "by": "human:zhihay", "at": "2026-08-09" }],
  "disputed": [{ "card": "knowledge/aws/...", "by": "human:zhihay",
                 "at": "2026-08-09", "evidence": "..." }]
}
```

`disputed` **不触发自动 deprecate**——证伪主张本身也可能错。它只把该卡顶到复审清单最前并标红，
deprecation 仍然是人开取代卡。

### 7.3 `okf_version` 的现实

照样声明，但别指望它被读：参考 bundle 的根 `index.md` **没有 frontmatter**，也没声明版本；
SPEC §12 要求消费者遇到不认识的版本应尽力消费而非拒绝。它是我们自己的版本锚，不是握手协议。

### 7.4 `sources[].resource` 的路径形态

SPEC §6.2 推荐链接用 `/` 开头，但参考 bundle 实际写的是不带前导斜杠的相对路径
（`policies/revenue-recognition.md`）。**跟参考实现走**，validator 两种都接受。
另注意 `sources[].resource` 允许是**范围描述符**而非路径（如 "all queries in project X"），
所以不能强制它可解析。

---

## 8. 生命周期与自动化

原则：判断留给人，机械的部分全部自动化；自动化**永不直接写权威状态**——它只做三件事：
拒绝不合格的、计算派生状态、把该人做的决定摆到人面前。所有迁移走 git（MR），不走旁路数据库。

### 8.1 新鲜度时钟

`stale_after = max(verified[].at) + half_life(type/topic)`，或 `cde.review_interval_days` 覆盖。
**validator 反算并比对（容差 0 天）**——手敲一个 2099 会被拒。这把新鲜度从自觉变成机械约束。

复审 = `verified` append 一条 + `stale_after` 前移，一个 MR 两处改动，validator 校验二者一致。

`policy/lifecycle.json`（策略即数据）：

```json
{
  "half_life_days": {
    "Practice": 180,
    "Domain Knowledge": 365,
    "Domain Knowledge:aws": 120,
    "Knowledge Pack": 365
  },
  "archive_grace_days": 90,
  "deny_patterns": ["(?i)AKIA[0-9A-Z]{16}", "\\b\\d{12}\\b", "\\.internal\\b", "..."],
  "controlled_tags": ["power-trading", "aws", "testing", "..."]
}
```

### 8.2 遗忘：stale ≠ 删除

stale 只让旧知识**失去默认权威**：消费端看到警告、必须重新确认才算数（FR-13）。
诚实的遗忘不是让知识消失，而是撤销它的默认可信度。重新确认即刷新 `verified` 与 `stale_after`。

> ⚠️ OKF `is_stale` 在 `stale_after` 缺失或不可解析时返回 **false**（fail-open）——
> **缺失 `stale_after` 等于永不过期**。这正是我们把它列为家规必填的原因：
> OKF 在此处的宽容恰好是遗忘机制的漏洞。

### 8.3 事件驱动：MR pipeline

每个 MR 跑 `validate-cards.ts`，fail-closed（规则表见 §11）。
**同一份 validator 在 spoke 端 push 前本地先跑**——不合格的东西不该到达人类评审面前
（与 `knowledge-plugin` 的 `aidlc-ai-ready-gen validate` 同一模式）。

### 8.4 定时驱动：scheduled pipelines

| 周期 | 任务 | 产出 | 判断者 |
|---|---|---|---|
| 每周 | `review-debt.ts` | 更新常驻 issue：到期卡片按 CODEOWNERS 分组 @到人 | 人复审 |
| 每周 | `carry-affirmations.ts` | 扫 `feedback/` 聚合成 bot MR，刷新 `verified` + `stale_after` | 人 merge |
| 每月 | `propose-archive.ts` | stale 超宽限期 → bot MR 归档提案 | **永不 auto-merge** |

**bot 可以开 MR，不能合 MR。** main 设保护分支、禁止直推；bot 用 project access token，
权限止于开分支与 MR。这样自动化自身的每次动作也留在 git 审计里。

参考 OpenWiki 的"no-op runs are free"：无变化不产生提交，定时任务不制造噪音。

### 8.5 评审人：CODEOWNERS 承担一半

按目录指派：`practices/testing/` → QA 背景成员；`knowledge/domains/<domain>/` → 行业 owner；
`policy/`、`tools/` → 维护者。GitLab 自动派单，`review-debt` 的到期清单按同一份 CODEOWNERS
分组——**准入责任与复审责任落在同一人头上**，不需要额外指派机制。

### 8.6 全链路

```
spoke 端                              hub 端
─────────                            ─────────
learnings 仪式（人）                  MR pipeline: validate fail-closed（机器）
   ↓ 导出候选                              ↓
knowledge-push:                       人评审 merge（CODEOWNERS）← 唯一权威写入点
  本地 validate（机器）                    ↓
  脱敏具名批准（人）                   每周 review-debt issue（机器提醒，人复审）
  branch + MR（机器）                  每周 carry-affirmations bot MR（机器搬运，人合）
                                      每月 propose-archive bot MR（机器提案，人合）
knowledge-pull:
  clone + gen-registry（机器现算）
  Practice 卡走 persist 仪式（人逐条确认）
  feedback 登记（机器）──────────────→ feedback/ 进入下一轮
```

人只出现在四处：项目内学习确认、沉淀脱敏批准、hub MR 评审、到期复审——全是价值判断。

---

## 9. 插件侧设计

### 9.1 交付形态

```
plugins/team-knowledge/
├── .aidlc-plugin/plugin.json
├── CONTRACT.md                     # 本文
├── README.md / README.zh-CN.md
├── stages/
│   ├── inception/team-knowledge-pull.md    # slug 必带插件前缀，见 §0
│   └── operation/team-knowledge-push.md
├── sensors/
│   ├── aidlc-akp-pull.md
│   └── aidlc-akp-push.md
├── tools/
│   ├── aidlc-akp-cards.ts          # 卡片读写 + OKF 三个派生函数的 TS 移植
│   ├── aidlc-akp-validate.ts       # = hub 的 validate-cards.ts，双侧共用
│   ├── aidlc-akp-registry.ts       # 消费侧现算索引
│   ├── aidlc-akp-lifecycle.ts      # §8.4 三个定时任务（见 §0.2）
│   ├── aidlc-sensor-akp-pull.ts
│   └── aidlc-sensor-akp-push.ts
├── knowledge/aidlc-akp/
│   ├── card-authoring.md           # 五条守则 + 目的地决策
│   └── hub-operations.md           # MR / 复审 / 归档流程
└── tests/
```

两个独立 stage，`scopes:` 列全量 scope；均可被 `/team-knowledge-pull`、
`/team-knowledge-push` 单独调用。**不做任何 core stage 的 contribution**（§4.7）。

插件名 `team-knowledge`（不得以 `aidlc-` 开头，那是 core 命名空间）；
agent seat 复用 `aidlc-developer-agent`，不新增 agent。

### 9.2 pull 路径为什么必须走 `persist`

否决方案：直接把卡片文本抄进 `team.md`。

理由：走 `aidlc-learnings.ts persist` 才能拿到三样东西——**冲突检查**（一条与 org 守则矛盾的
规则在落盘前被拒）、**幂等**（重跑不重复写）、**`RULE_LEARNED` 审计行**（半年后回答"这条规则
从哪来"）。hub 是候选来源，不是权威覆盖；"严格加法、不矛盾"的既有不变量因此得以保持。

导入时的 selections 构造：

| 字段 | 取值 |
|---|---|
| `candidate_id` | **卡片的 concept ID** |
| `type` | `"learning"` |
| `scope` | `"team"`（来自 `cde.memory_target`） |
| `heading` | `cde.heading` |
| `text` | 卡片 `# 规则` 小节文本 |
| `source` | `"user_addition"` |

用 concept ID 作 `candidate_id` 是刻意的：它稳定且唯一，绕开了日记候选 ID **按位置派生**
的既知陷阱（§10.3）。

---

## 10. 已验证的框架约束

以下每条都读过源码确认，是设计的硬边界而非猜测。

### 10.1 `persist` 只能写 `project.md` / `team.md`

`core/tools/aidlc-learnings.ts:75` `practiceFilePath(projectDir, scope: "project" | "team")`，
`:237-244` `LearningSelection.scope` 同样是二值联合类型。**`org.md` 没有写入路径。**

⇒ `cde.memory_target` 只允许 `team`。org 级规则没有自动化通道，属框架层改动
（且 org 层是 upstream 资产，见 C1/C2）。

### 10.2 Content-Key 含 scope

`aidlc-learnings.ts:407` `contentKey(scope, text) = sha256(scope + "\0" + text)[:16]`。

⇒ 必须记录 `content_key_scope`（§6.3.1）。同时意味着：一张卡被导入 A 项目后，
若 A 再次导出，本地重算的 key 与卡片原始 key 不同 ⇒ **key 不能作为跨项目去重依据**，
去重必须靠 §4.3 的文本摘要，并最终依赖人工评审（§13.1）。

### 10.3 `persist` 不校验 candidate_id 来源

`handlePersist`（`:467` 起）只解析 selections 文件并逐条落盘，**不与日记候选交叉校验**，
`--slug` 也不与 stage graph 校验。这正是 pull 路径可以复用 persist 的前提。

同时确认既知陷阱依然存在：幂等键是 `(stage_slug, candidate_id)` + Content-Key
（`:528-529`、`:546-548`），**不是内容**；行级幂等锚定在 `- <text> (learned ` 这个行形状上
（`:545`）。⇒ 一次 persist 内不得复用 candidate_id。concept ID 天然满足。

### 10.4 有效 heading 集合

`core/memory/org.md` 与 `team.md` 各 8 个 `## ` heading：
Way of Working / Walking Skeleton / Testing Posture / Deployment / Code Style /
Forbidden / Mandated / Corrections。（`project.md` 多 3 个，但 target 只允许 team。）

`persist` 在 heading 缺失时会自行创建（`ensureHeading`，`:450`），所以限定这 8 个是**家规**
（防 heading 泛滥），不是工具的硬要求。

### 10.5 `--single` 不能持久化 learnings

`plugins/knowledge-plugin/README.md` §4.1 已记录：`aidlc-learnings.ts` 完全没有 `--single`
处理，隔离运行下因缺 state 文件而失败。

⇒ **`team-knowledge-pull` 若要写 memory，必须在真实 workflow 内运行**，不能靠
`--stage ... --single`。可接受的降级：单跑模式只做检索与报告，把导入清单交给下一次
workflow 内运行；不得静默改用手写 memory 的方式假装成功。

### 10.6 OKF 参考语义必须逐字移植

`okf/src/reference_agent/bundle/document.py` 三个函数，TS 实现照抄不自创：

- `normalize_verified`：裸 mapping 视为单元素列表（SPEC §5.2 **MUST**）。
- `trust_tier`：无 `verified` → unverified；仅非 `human:` → machine-confirmed；
  有 `human:` → human-reviewed。派生，不存储。
- `is_stale`：`today >= stale_after`；缺失或不可解析 → **false（fail-open）**，见 §8.2 警告。

### 10.7 复用 poc-accelerator 的既有 git 契约

`resolution` 枚举无"跳过"取值；`repo_url` 必须是 git 远端形态
（`https://` / `http://` / `ssh://` / `git://` / `file:///abs/path` / `git@host:team/repo.git`），
**裸本地目录被拒**；`repo_probe` 必须是 `git-ls-remote-ok`，探测失败不是结论。
本插件的两个 sensor 原样继承这套判定。

---

## 11. validator 规则表

`aidlc-akp-validate.ts` 输出两类判定（§6.2），退出码与措辞分离。

**`okf-nonconformant`（两侧硬拒）**

1. frontmatter 可解析为 YAML mapping；未终止的 frontmatter 块报错。
2. `type` 存在且非空。
3. `index.md` / `log.md` 结构符合 SPEC §8 / §9（存在时）。

**`cde-policy-violation`（生产侧硬拒，消费侧 warning）**

4. §6.3 必填集齐全，枚举合法，日期可解析。
5. `stale_after == max(verified[].at) + policy 半衰期`（容差 0 天）。
6. deny-pattern 扫全文**含 frontmatter**（脱敏机器兜底）。
7. 去重：`# 规则` 小节归一化文本摘要撞库即拒，并指出已有卡片。
8. `status: deprecated` 卡必须有指向后继卡的链接，后继卡在**同一 MR 内**存在；
   被取代方在同一 MR 内已翻 `deprecated`。
9. `cde.heading` ∈ §10.4 的 8 个；`cde.memory_target == "team"`。
10. `cde.knowledge_seat` 是真实 agent seat 名或 `aidlc-shared`。
11. `tags` ⊆ 受控词表（不在 → warning，不报错）。
12. frontmatter 键序符合 §6.4（写入器自检；对人工编辑只 warning）。

**测试清单**（`tests/`，进 integration 层）

- 裸 `verified` mapping 归一化为单元素列表。
- trust tier 三档，含 `process:` 前缀落 machine-confirmed。
- `stale_after` 缺失 → `is_stale` 返回 false（**钉住 fail-open 语义**，防未来"修好"它）。
- 时钟反算：手写日期与 policy 不符 → 拒。
- deny-pattern 命中 frontmatter 内的值（不只正文）。
- 精确去重命中；**近似重复不命中**（钉住 §13.1 的已知局限，防误以为已解决）。
- 取代 MR 拆成两个 MR → 拒。
- 缺 `cde` 块：生产侧拒、消费侧仅 warning（钉住 §6.2 的双判定）。
- pull 构造的 selections 能被真实 `aidlc-learnings.ts persist` 接受（契约测试）。

---

## 12. 分期交付

| 期 | 内容 | 完成判据 |
|---|---|---|
| P0 | `policy/lifecycle.json` + `aidlc-akp-validate.ts` + OKF 派生函数移植 + 两张 fixture 卡 + §11 测试 | 测试全绿；对 fixture 卡双侧判定正确 |
| P1 | hub repo 骨架：`index.md` / `log.md` / README / CODEOWNERS / `.gitlab-ci.yml`（仅 MR 门禁） | 一个人工 MR 能被正确拒绝与通过 |
| P2 | `team-knowledge-push` stage + sensor + `gen-registry` | 从 agentic-power-trading 真实推出 3 张卡并 merge |
| P3 | `team-knowledge-pull` stage + sensor + persist 契约 | 在另一仓库导入这 3 张卡，`team.md` 出现带审计行的规则 |
| P4 | 三个定时任务 + `feedback/` 回路 | review-debt issue 生成；一次 affirmation bot MR 合入 |
| P5 | 把 `poc-accelerator` Step 1 / Step 8 改为调用本插件工具 | 两份实现收敛为一份，原 sensor 判定不变 |

P0 先做的理由：validator 同时是 hub 门禁与 spoke 自检，两侧共用一份；后续 stage 依赖它的判定
接口，反过来不成立。

---

## 13. 已知局限（不掩盖）

### 13.1 去重只能挡精确重复

Content-Key 含 scope 且基于精确文本；两个项目对同一条经验措辞略有不同，机器查不出来。
§11.7 只做精确去重，**近似重复的唯一防线是 CODEOWNERS 人工评审**。
不要期待自动化解决这一层——§11 的测试清单刻意钉住了这条局限。

### 13.2 `verified` 的语义近似

OKF 定义 `verified` = 对着 sources / resource 确认内容为真。spoke 端"我用过这条卡、有效"
严格说不是同一件事。本设计**接受这个近似**：它确实是人对该条知识仍然成立的表态，
且另造一个 `cde.affirmations` 列表会引入第二套新鲜度语义。
代价：`verified` 列表里混有两种强度的确认事件，从字段本身分辨不出。
若将来这个混淆造成误判，再拆分——届时是加字段，不是改语义，向后兼容。

### 13.3 org 级知识没有自动化通道

§10.1 的直接后果。org 层的改动是框架层决策，应走 `docs/fork/divergence.md` 的流程，
不该由知识卡片自动流入。

否决方案：加一个 `cde.proposed_tier: org` 提案标记（纯声明、无自动落地），让"我们认为这该成为
org 级策略"这类诉求可被表达。**决定：不加**（2026-08-09）。理由：一个存了却永远无法生效的字段，
比没有这个字段更容易误导——读者会以为写上就会发生什么。org 级诉求走人工流程，不在 schema 里
留占位。hub 里当然可以存这类内容作为普通卡片，它只是导入时没有自动落地路径。

### 13.4 FR-11 的传感器检查靠路径前缀推断，会漏不会误报

传感器只看产物，永远看不到 bundle，所以"这张导入的卡是不是 `Practice`"只能从 concept ID 的
`practices/` 前缀（§7.1 的布局约定）推断。一张被放在 `practices/` 之外的 Practice 卡会**漏检**，
但检查永不误报。

要把这个推断变成硬保证，需要给 validator 加一条 §11 规则：`type: Practice` 必须位于
`practices/` 下、`Domain Knowledge` 必须位于 `knowledge/` 下。当前**没有加**——它会改动已定稿的
§11 规则表，属于需要单独决策的范围扩张。

### 13.5 pull 无法在 `--single` 下写 memory

§10.5。这是 core 缺口（`--single` 缺合成 intent），插件无法修复。

### 13.6 去重是 bundle 内的,所以"校验哪个 bundle"决定了去重是否发生

§11.7 比对的是**同一个 bundle 内**卡片 `# 规则` 小节的归一化摘要。推论刺眼但直接：
把只含本次新卡的 staging 目录当 bundle 校验，去重**没有任何比较对象**，于是空转通过——
输出是干净的 `OK`，而它其实什么都没看。

这不是可以靠更严的规则修掉的，它是"派生态不落盘"（§4.3）的代价：hub 没有提交的
registry，validator 也不联网，所以它只知道手上这一份 bundle。缓解手段写在 push stage
的 Step 5——对 hub checkout 校验、用 `--card` 把 findings 限定到本次卡片——但**机制层面
没有守护**：一次 staging 校验和一次 hub 校验的输出形状完全相同。

实测于 2026-08-18 的一次 deposit：照 Step 5 早先的字面写法（`--bundle <staging>`）跑出
`OK — 7 card(s)`，而当时 hub main 上有 26 张卡从未参与比对。事后补跑（26 + 7 = 33 张
bundle，`--card` 限定 7 张）同样全过——**结论没错，缺的是覆盖**，而这正是这类缺陷难以
被发现的原因。

### 13.7 半衰期由卡片路径决定,而回退是静默的

`halfLifeDays()` 先查 `<type>:<topic>`，topic 取自 `topicOf()` ——即 concept ID 的**路径段**
（`knowledge/aws/x` → `aws`）。查不到就回退到 `half_life_days[<type>]`，而那通常是最长的
那一档（`Domain Knowledge` = 365 天）。`tags:` 里写 `aws` 不会纠正它。

于是"这张卡多久需要复审"实际上由**放在哪个目录**决定，而不是由内容易腐性决定，且没有任何
检查会报——时钟算术永远是对的，错的是输入。`cde.review_interval_days` 是正确出口，但它要求
作者先意识到默认值是多少。

关键的一点是**方向不能从标题推断**：一张钉在已发布版本上的缺陷卡（且已知哪个版本修了）
记录的是**既成事实**，不会腐坏，长窗口对它是对的；而一张记录快速演进依赖的**当前行为**
的卡不是既成事实，它拿到长窗口只是因为文件放在哪。两者的标题看起来一样具体，需要的窗口
相反。2026-08-18 的评审里就先按标题误判了一次，读了卡片正文才纠正。

缓解写在 push stage 的 Step 4：要求在卡片正文里写明所选路径给出多少天、以及为什么这个数
对这条断言是对的。这把一个不可检查的输入变成一个**可评审**的句子，但它仍然不是守护。
要变成硬保证，需要给 validator 加一条规则（例如：`Domain Knowledge` 落在没有 policy 条目
的 topic 下时，必须显式给出 `cde.review_interval_days`）——那是对已定稿 §11 规则表的扩张，
属于需要单独决策的范围，**当前没有加**。

### 13.8 `project.md` 的结构性排除依赖上游路由正确

§5.2 把"不存个性化"寄托在结构上：`project.md` 层不在默认导出面上。但这个保证的强度取决于
**learnings ritual 有没有把该 travel 的知识路由到 team 层**。若通用结论被写进了 project 层，
唯一出口就是导出闸口的人工 re-grade——于是这道结构闸门每次都被手动打开，实质变成穿着结构
外衣的评审闸门。

实测于 2026-08-18 的一次 deposit：`team.md` 只有 1 条规则（且被排除），7 张卡**全部**经
人工 re-grade 而来；没有这条路，那次 deposit 是零卡。

根因不在本插件，也修不在本插件：落笔时用的判据是"这个项目需要什么"，而决定知识是否 travel
的判据是"换个客户还成立吗"。缓解是在 push stage 的 Step 3 要求把这个比例说出来（见该步），
让它成为下一次收割的校准点，而不是每次重新发现。

---

## 14. 参考

- [OKF SPEC v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
  —— 本文卡片格式的规范来源
- [OKF 参考解析器 `document.py`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/src/reference_agent/bundle/document.py)
  —— §10.6 三个派生函数的移植源
- [OKF v0.2 trust signals 公告](https://cloud.google.com/blog/products/data-analytics/okf-v0-2-adds-trust-signals/)
- [OpenWiki](https://github.com/langchain-ai/openwiki) —— §4.1 的对照对象
- `plugins/knowledge-plugin/CONTRACT.md` —— 姊妹插件：代码事实侧
- `plugins/poc-accelerator/stages/{inception/...step-01...,operation/...step-08...}.md`
  —— §10.7 既有 git 契约的来源
- `docs/architecture/aidlc-knowledge-memory-visual-guide.zh-CN.md` —— 框架现有分层全景
- `docs/reference/18-plugin-mechanism.md` —— 插件机制规范
- `plugins/vibe/knowledge/aidlc-vibe/vibe-sedimentation.md` —— 五条保存守则与目的地决策的词汇来源

> 内容依许可要求改写；OKF 与 OpenWiki 的事实性描述来自其公开文档，已按上方链接标注来源。
