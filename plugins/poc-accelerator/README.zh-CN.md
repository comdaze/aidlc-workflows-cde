# poc-accelerator — 客户交付型 PoC 插件

[English](README.md) | **中文**

第一方 AIDLC 插件，面向**客户可见、CDK 部署的 PoC**。它新增一个专注的八步
交付 scope，不改动核心的 `poc`（后者仍是用完即弃的可行性 spike）。

## 交付什么

`poc-accelerator-cde` 按序执行以下专属步骤：

1. 需求捕获 — 1 页需求简报、验收标准、领域知识捕获
2. 方案设计 — 架构图 + TypeScript CDK Stack 计划
3. 环境就绪 — 批准的账号/区域、CDK bootstrap、基线部署
4. 骨架搭建 — 端到端最小切片，尽早给客户演示
5. 功能扩展 — 只实现客户确认的核心行为
6. 测试验证 — 可重复的单元/集成证据（LLM 行为出 eval 集）
7. CDK 部署 — 已部署 Stack + 冒烟测试证据
8. 交付演示 — 演示包、扩展建议、三档费用分析（pilot / 生产 / 超产能，
   按服务分解）、价值指标登记、交接质量清单，以及**必须执行的知识沉淀**
   （把脱敏后的收获提交回团队知识库）

插件只使用既有 AIDLC 角色：product、architect、developer、quality、
pipeline/deploy。不新增 agent 实现，也不会静默宣称生产就绪。

## 安装与运行（Kiro，五步启动 CDE 流程）

一切从本仓库**已提交的 `dist/`** 安装——无需构建。（只有改了 `plugins/`
或 `core/` 才需要 `bun scripts/package.ts` 重新生成。）下文 `<repo>` 是你
克隆的本仓库，`<project>` 是客户 PoC 项目目录。

**第 1 步 — 基础框架**（项目已有 `.kiro/` + `aidlc/` 则跳过）：

```bash
# Kiro IDE —— Kiro CLI 用 dist/kiro/ 替换 dist/kiro-ide/
cp -r <repo>/dist/kiro-ide/.kiro     <project>/.kiro
cp -r <repo>/dist/kiro-ide/aidlc     <project>/aidlc
cp    <repo>/dist/kiro-ide/AGENTS.md <project>/AGENTS.md
```

**第 2 步 — compose 插件。** 不需要把插件目录预拷进项目：composer 直接从
`AIDLC_PLUGIN_ROOT` 读内容、只写进项目的 `.kiro/`。

```bash
PLUGIN_ROOT="<repo>/dist/plugins/poc-accelerator/kiro-ide"   # Kiro CLI 用 kiro
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "$PLUGIN_ROOT/hooks/compose.ts"
```

> `AIDLC_PLUGIN_ROOT` 必须指向 harness 投影
> （`dist/plugins/poc-accelerator/<harness>/`），**不是**任何仓库根目录。composer 是
> 从投影里的宿主 manifest 取插件身份的；指向别处它会改用目录名，然后把每一条
> contribution 都当成外来内容跳过。另外，若 `<project>/.kiro/tools/aidlc-graph.ts`
> 不存在，composer 会静默退出 0 且什么都不写——所以先确认第 1 步真的落地了。

**第 3 步 — 插件选择 —— 仅在项目已有 selection 时才需要。** 没有 selection 时所有
已安装插件都是启用的，第 2 步做完插件就能用，`doctor` 会显示
`all enabled (no selection)`。所以这一步通常什么都不用做。

真正要小心的是反方向：一个**漏掉** `poc-accelerator` 的 selection 会把 8 个 stage
全关掉——而且是静默的，`doctor` 依然全绿，因为"缩小的 selection"是合法状态、不是
错误。实测 `select-plugins aidlc` 之后启用计数降为 `aidlc=29, bootstrap=3`，poc 那
行直接消失。所以只要 selection 存在，或你日后为别的插件建了一个，就必须把本插件
一起列进去：

```bash
cd <project>
bun .kiro/tools/aidlc-utility.ts select-plugins aidlc,poc-accelerator
```

**第 4 步 — MCP 配置（必需）。** 从插件知识文件
`knowledge/aidlc-pipeline-deploy-agent/mcp-setup.md`（compose 后位于安装的
`.kiro/knowledge/aidlc-pipeline-deploy-agent/`）的全球区或中国区示例创建
`.kiro/settings/mcp.json`。八步流程依赖它——区域可用性核实、CDK 校验、
步骤 8 费用分析都经这些 server。

**第 5 步 — 验收，然后启动：**

```bash
bun .kiro/tools/aidlc-utility.ts doctor
```

期望 **0 failed**，并出现下面这两行——它们才是真正证明插件 compose 成功的证据；
插件没装上的那次运行同样"全绿"，只是少了这两行：

```text
✓  Enabled plugins: ... enabled stage counts: aidlc=29, bootstrap=3, poc-accelerator=8
✓  Hook drops: none recorded
```

总检查项数取决于框架 install 而不是本插件：原版上游 `v2` install 是 39 passed，
本 fork 的是 44。两者都正常；判断标准是 `0 failed` 加上 `poc-accelerator=8`。

```text
/poc-accelerator-cde Build a safe customer demo for <场景>
# 或
/aidlc --scope poc-accelerator-cde Build a safe customer demo for <场景>
```

两者都是**受支持的显式启动命令**：直接 runner 固定 CDE scope，`/aidlc`
形式则把相同 scope 传给 orchestrator。不要使用 `/aidlc pocx`、`/aidlc poc
cde` 或裸 `/aidlc poc`：`pocx` 不是别名，核心 `poc` 则是独立的、用完即弃的
可行性 spike scope。插件不声明快捷关键词，因此不会通过含混的关键词推断误选
客户交付流程。

> **首次运行提示**：把组织规则基线写入
> `aidlc/spaces/default/memory/org.md`——部署规范、安全红线，以及一个
> `## Team Knowledge Repository` 标题，注明团队知识库的 **git URL**。团队
> 知识库是本流程的必需输入，且必须是 git 远端而非本地目录，因为流程在
> 两端都要用它：
>
> - **步骤 1 从它读。** 先搜索 active space 的本地知识，再探测 URL
>   （`git ls-remote`）并检索匹配的行业知识包。若所有 memory 层都没有 URL，
>   步骤 1 会作为必答问题向你索取——沉默、"稍后"、裸本地路径都不算答案，
>   也没有跳过路径。
> - **步骤 8 往它写。** 脱敏并经客户批准的知识收获，按团队知识库自身的
>   贡献流程提交（分支 + merge request）。这一步是**强制的，且与步骤 1
>   相互独立**：它自己解析 URL（预检产物 → memory 层 → 向你索取），所以
>   即使这次运行没读过团队知识，也照样把学到的东西沉淀回去。
>
> 两端各有一个确定性 TypeScript sensor（与框架其他 sensor 一样为
> advisory）：`poc-accelerator-team-knowledge-preflight` 校验预检产物记录了
> 探测通过的 git URL 与真实结论；`poc-accelerator-team-knowledge-deposit`
> 校验沉淀产物记录了经批准的条目清单，以及 merge request、已推送分支，或
> （推送被拒时）带署名 owner 的待落地 patch。

### 其他 harness

本插件对**全部五个** harness 都发布投影 —— Claude Code、Codex、Kiro CLI、
Kiro IDE、opencode —— 且在每一个上 compose 结果一致：8 个 stage、
`poc-accelerator-cde` scope、8 个 stage runner + 1 个 scope runner、两个 sensor，
以及 orchestrator 的 scope/stage 表刷新。Claude Code、Codex、opencode 走各自
host 的原生插件命令；两个 Kiro 用上面五步里的显式 compose 命令。

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/poc-accelerator/claude
/plugin install aidlc-poc-accelerator@aidlc-plugins   # SessionStart 钩子自动 compose

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/poc-accelerator/codex
codex plugin add aidlc-poc-accelerator@aidlc-plugins  # 一次性 hook 信任确认

# opencode —— 投影本身是带 SessionStart compose 钩子的 host 插件；
# 若你的 opencode 版本没有 marketplace 命令，就显式 compose：
PLUGIN_ROOT="<repo>/dist/plugins/poc-accelerator/opencode"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.aidlc bun "$PLUGIN_ROOT/hooks/compose.ts"
```

MCP 配置在每个 harness 上都是必需的，位置各不相同：`.mcp.json`（Claude Code）、
`~/.codex/config.toml`（Codex）、`.kiro/settings/mcp.json`（Kiro）、
`opencode.json` 顶层 `mcp` 键（opencode）。插件自带的 `mcp-setup.md` 知识文件
四种写法都给了，包括 opencode 那种把 command 和 args 合成一个数组的形态。
安装细节详见[插件机制文档](../../docs/reference/18-plugin-mechanism.md)。

> [!NOTE]
> **两个 Kiro harness 不会自动 compose。** 插件同时发布两代钩子文件
> （给 Kiro IDE ≥ 1.0.1xx 的 `aidlc-plugin-compose.json`，和给 pre-1.0 的
> legacy `.kiro.hook`），但它们只有在被装进项目的 `.kiro/hooks/` 之后才会触发。
> Kiro CLI 通过 `agents/aidlc.json` 挂钩子，完全不读投放进来的钩子文件。
> 这两个 harness 上请执行显式 compose 命令——那是受支持的路径。

### 更新一个已经装过本插件的项目

重跑 compose **不会**更新改动过的内容——这是整套流程里唯一一处会让 install 悄悄跑着
旧版本的地方。在 Kiro IDE 上实测：

| 情形 | 结果 |
| --- | --- |
| 内容未变，重新 compose | 0 drop，确实幂等 |
| 内容**已变**，重新 compose | 1 条 degraded drop，**文件没被更新** |
| 先从 install 删掉该文件，再 compose | 0 drop，新内容落地 |

composer 不会覆盖一个已存在的路径——它分不清那是自己上次的产物、还是 core 或别的插件
的文件，所以直接拒绝并记录
`collides with an existing file (core or another plugin); not overwritten`。
没有任何东西显式报错，流程继续跑旧的 stage。

抓住它的是 `doctor`，所以要看这一行，别信 compose 的退出码（它一直是 0）：

```text
✗  Hook drops (plugin-compose-poc-accelerator): 1 degraded of 1 ...
```

更新的做法是先删掉插件 compose 出来的文件再重新 compose。stage 落在
`.kiro/aidlc-common/stages/<phase>/`，runner 落在 `.kiro/skills/`：

```bash
cd <project>
rm -rf .kiro/aidlc-common/stages/*/poc-accelerator-* \
       .kiro/skills/poc-accelerator-* \
       .kiro/scopes/poc-accelerator-cde.md \
       .kiro/sensors/aidlc-poc-accelerator-* \
       .kiro/tools/aidlc-sensor-poc-accelerator-*
find aidlc -name 'plugin-compose-poc-accelerator.drops' -delete   # 它本来也会自清
# 然后重跑第 2 步的 compose 命令
```

## 护栏

- 所有基础设施用 TypeScript CDK；控制台手工建的资源不被接受。
- 默认合成或脱敏数据。真实客户数据必须走批准的 GenAIIC（Generative AI
  Innovation Center）共创路径。
- 全球区/中国区 MCP 配置二选一并有意识地选择；不提交凭证，客户交付环境
  不用浮动 `@latest` 版本。
- 登记 MRR、CFN、SFDC 跟进的标识与 Owner，但不编造业务数值，未经批准不
  连接这些系统。
- 交付费用测算全部是带假设标注、引用定价来源的估算——绝不是报价或承诺。
- 团队知识库 git URL 在流程两端都是必需项；步骤 8 的沉淀必须有署名批准人
  确认"哪些内容可以离开这次客户交付"。不沉淀任何客户机密内容，且走知识库
  自身的评审流程——绝不直推其默认分支。

## 上游升级

本插件从不改动 `core/`——所有 CDE 定制（stage、scope 与全部知识文件，含
给 quality/pipeline-deploy 角色的新增）都在 `plugins/poc-accelerator/`
之下、以叠加方式 compose。从上游升级框架即：

```bash
git fetch github            # awslabs 上游 remote
git merge github/v2         # 或 rebase；插件文件永不冲突
bun scripts/package.ts      # 重新生成全部 dist 投影
bash tests/run-tests.sh --smoke
```

预期冲突面：仅 `CHANGELOG.md` / `README.md` 徽章 /
`core/tools/aidlc-version.ts`（本 fork 的发布记录）以及
`core/tools/aidlc-utility.ts` + `harness/*/onboarding.fills.ts` 中少量安全
合规字符串（内部代码扫描强制，属上游回馈候选）。解法：取上游版本，若上游
尚未吸收则重打合规字符串。

## 验证插件内容

```bash
bun test plugins/poc-accelerator/tests/plugin.test.ts
```

测试用框架真实 stage schema 校验八个插件 stage、检查产物命名空间、验证
专属 scope，并确认每个必需输入都有插件内的生产者。
