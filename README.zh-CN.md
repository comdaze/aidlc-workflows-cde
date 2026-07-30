# AI-DLC — 一套核心，多个 harness

[English](README.md) | **中文**

> [!WARNING] **GA Preview——积极开发中。** 接口、stage 定义、agent 阵容与安装模型仍在 演进，版本之间可能有破坏性变更。依赖它的场景请钉住已知可用的版本，并 审阅所有生成产出。已交付/进行中/规划中的内容见 [roadmap](docs/roadmap.md)。

**AI-DLC 方法论**（AI-Driven Development Life Cycle）的原生实现，一份源码 运行在多个 harness 上——Claude Code、Kiro IDE、Kiro CLI、Codex CLI。11 个 领域专家 agent 走 32 阶段工作流，每道审批门由你把关。

> 本文档为中文精简版，聚焦本 fork 的主线用法；框架的完整文档（架构、全部 scope、深度/测试策略、CLI 工具、参考文献）见 [英文版 README](README.md) 与 docs/。

## 插件——本 fork 的主角

本 fork 在框架之上附带第一方 **AIDLC 插件**。插件从不改动 `core/`：它自带 stage、scope、knowledge 与 tools，并以增量方式把 contribution 合并进核心 stage。**插件负责添加，安装负责选择**。机制设计见 [`docs/reference/18-plugin-mechanism.md`](docs/reference/18-plugin-mechanism.md)。

| 插件 | 增加了什么 | 详情 |
| --- | --- | --- |
| **`poc-accelerator`** | 面向 CDE 认证 SA 的**八步、3-5 个工作日客户 PoC 交付流程**——CDK 优先部署、三档费用分析（pilot / 生产 / 超产能）、留痕的交接质量清单、双端接线的团队知识复用。 | [插件中文 README](plugins/poc-accelerator/README.zh-CN.md) |
| **`knowledge-plugin`** | **棕地深度知识工程**——带代码锚点的 `.ai-ready/` 领域知识，过 senior 签字门，再翻译成 `reverse-engineering` 的 codekb；门禁驳回理由以 KEM-lite 格式回写沉淀。 | [插件中文 README](plugins/knowledge-plugin/README.zh-CN.md) |
| **`test-pro`** | 叠加在工作流上的全面、可追溯测试覆盖。同时是插件机制的参考实现——写自己的插件可照抄其形状。 | [插件 README](plugins/test-pro/README.md) |

### 在聊天窗口快速安装

在目标项目的 harness 聊天会话窗口中，点名你要的插件：

```text
安装https://github.com/comdaze/aidlc-workflows的poc-accelerator插件到这个项目

```

如需可复现的手动安装流程，或使用其他 harness，请使用下方通用步骤。

### 手动安装——任意插件、任意 harness

全部内容从本仓库**已提交的 `dist/`** 安装，无需构建（只有你改了 `core/` 或 `plugins/` 才需重跑 `bun scripts/package.ts`）。下文 `<repo>` 是本仓库的 clone，`<project>` 是目标项目，`<plugin>` 是上表中的插件名。剩下两个占位符按你的 harness 取值：

| Harness | `<harness>` | `<harness-dir>` |
| --- | --- | --- |
| Kiro IDE | `kiro-ide` | `.kiro` |
| Kiro CLI | `kiro` | `.kiro` |
| Claude Code | `claude` | `.claude` |
| Codex CLI | `codex` | `.codex` |
| opencode | `opencode` | `.aidlc` |

**第 1 步——先装框架。** 按 [Pick your harness](README.md#pick-your-harness) 把 `dist/<harness>/` 拷进 `<project>/`。项目已有 AI-DLC 安装则跳过。

> [!IMPORTANT] 框架是硬前置，而且顺序搞错会**静默失败**。当 `<project>/<harness-dir>/tools/aidlc-graph.ts` 不存在时，composer 直接返回——不报错，也不写健康记录——因为它要用**已安装引擎**自己的 schema 与 agent 名册校验插件的每个 stage，才决定拷不拷。compose 是幂等的，所以顺序错了只需补上框架再跑一次。

**第 2 步——compose 插件。** 无需预拷贝：composer 从 `AIDLC_PLUGIN_ROOT` 读取，只写进 `<project>/<harness-dir>/`。

```bash
PLUGIN_ROOT="<repo>/dist/plugins/<plugin>/<harness>"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=<harness-dir> bun "$PLUGIN_ROOT/hooks/compose.ts"

```

Claude Code 与 Codex CLI 也可走各自的原生插件命令，它们通过 `SessionStart` 钩子调用同一个 composer：

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/<plugin>/claude
/plugin install aidlc-<plugin>@aidlc-plugins

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/<plugin>/codex
codex plugin add aidlc-<plugin>@aidlc-plugins    # 首次需批准钩子信任

```

**第 3 步——验收。** 全绿即安装成功：

```bash
cd <project>
bun <harness-dir>/tools/aidlc-utility.ts doctor
bun <harness-dir>/tools/aidlc-utility.ts plugin-list

```

`doctor` 会报出已启用插件、每插件的启用 stage 数，以及 composer 记录的任何 drop——文件冲突、被拒的 stage、失败的重编译。

**第 4 步——若已存在选择集，启用插件。** 出厂的 `harness.json` 没有 `plugins` 键，语义是*已装插件全部启用*，全新安装无需这一步。一旦存在选择集，compose 不会自动启用；此时要列出完整启用集，核心用 `aidlc` 表示：

```bash
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc,<plugin>

```

已 compose 但被禁用的插件，其自带文件照样会拷进去（运行时会被过滤，无害），但**不会**把 contribution 合并进核心 stage。`doctor` 会给出一条 advisory drop，并附上该跑的命令。

### 各插件的额外配置

compose 只负责装上；部分插件在真正干活前还需要配置或专用入口。

**`poc-accelerator`** —— MCP 配置是**必需**的。从 `<harness-dir>/knowledge/aidlc-pipeline-deploy-agent/mcp-setup.md` 的全球区或中国区示例，创建 `<harness-dir>/settings/mcp.json`（Kiro）、`.mcp.json`（Claude Code）或 `~/.codex/config.toml`（Codex）。区域可用性检查、CDK 校验、第 8 步费用分析全部经由这些 server。然后通过任一显式入口启动客户交付流程：

```text
/poc-accelerator-cde Build a safe customer demo for <客户场景>
# 或
/aidlc --scope poc-accelerator-cde Build a safe customer demo for <客户场景>

```

不要使用 `/aidlc pocx` 或裸 `/aidlc poc`：`pocx` 不是别名，核心 `poc` 仍是独立的、用完即弃的可行性 spike scope。

**`knowledge-plugin`** —— 需要 PATH 上有 `python3`（vendored 引擎纯标准库），且面向**棕地**仓库：其 bootstrap stage 仅在项目已有存量代码、且 `.ai-ready/` 缺失或过期时触发，scope 限 `enterprise`、`feature`、`mvp`、`workshop`。它没有自己的入口命令——在正常的 inception 流程中自动上路。

> **首次运行（任意插件）：** 把组织规则基线（部署规范、安全红线，以及团队若有维护的知识仓库地址）写入 `aidlc/spaces/default/memory/org.md`——填了仓库地址，`poc-accelerator` 流程步骤 1 才会自动检查可复用的行业知识包。

## 唯一前置：bun

所有 harness 的钩子与 CLI 工具经 **bun** 运行：

```bash
curl -fsSL https://bun.sh/install | bash   # macOS/Linux（或用 brew install oven-sh/bun/bun）

```

> bun 必须在**非交互 shell** 的 PATH 上（harness 用它跑钩子）——zsh 读 `~/.zshenv`、bash 读 `~/.bashrc`，而安装器写的是 `~/.zshrc`。若终端里 `which bun` 正常但 harness 找不到，把 PATH export 复制到对应文件。

## 为什么用 AI-DLC

临时的 AI 编码在项目变认真后会失控：上下文在 prompt 间漂移、决策理由无处 可查、模型悄悄做你没要求的事。AI-DLC 用结构约束工作：每个阶段有明确负责 角色，每个决策过审批门，框架从你的纠正中学习并不再重犯。同一引擎既能跑 用完即弃的 PoC，也能跑受监管的企业级交付——只是执行更多阶段、更深的深度。

## 更多内容（英文）

- 各 harness 的安装与差异：[Quick Start](README.md#quick-start) 与 docs/guide/harnesses/
- 阶段/角色/scope/知识体系：docs/guide/
- 插件机制与二次开发：docs/reference/18-plugin-mechanism.md
- 上游方法论：[AWS 博客](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)

