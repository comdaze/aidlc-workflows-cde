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
   按服务分解）、价值指标登记、10 项交接质量清单

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

**第 3 步 — 选择插件**（在项目目录内执行）：

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
bun .kiro/tools/aidlc-utility.ts doctor    # 全绿 = 安装成功
```

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
> `aidlc/spaces/default/memory/org.md`——部署规范、安全红线，以及（若团队
> 维护）一个 `## Team Knowledge Repository` 标题，注明已批准的本地检出目录
> 或仓库 URL。流程步骤 1 总会先搜索 active space 的本地知识，再按该位置
> 检索匹配的行业知识包。未配置来源、无法访问或没有匹配项时，它会明确要求
> 你提供已批准的团队知识 URL/本地路径，或明确要求跳过本次 PoC 的团队知识；
> 绝不把沉默当作跳过——插件自带确定性 TypeScript
> sensor（`poc-accelerator-team-knowledge-preflight`，与框架其他 sensor
> 一样为 advisory），校验预检产物确实记录了知识包导入、你提供的来源，
> 或带署名决策人的明确跳过。

### 其他 harness

Claude Code 和 Codex 走各自的原生插件命令安装；MCP 配置分别写
`.mcp.json`（Claude Code）和 `~/.codex/config.toml`（Codex）。详见
[插件机制文档](../../docs/reference/18-plugin-mechanism.md)。

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/poc-accelerator/claude
/plugin install aidlc-poc-accelerator@aidlc-plugins   # SessionStart 钩子自动 compose

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/poc-accelerator/codex
codex plugin add aidlc-poc-accelerator@aidlc-plugins  # 一次性 hook 信任确认
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
