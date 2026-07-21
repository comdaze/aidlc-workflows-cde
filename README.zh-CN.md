# AI-DLC — 一套核心，多个 harness

[English](README.md) | **中文**

> [!WARNING]
> **GA Preview——积极开发中。** 接口、stage 定义、agent 阵容与安装模型仍在
> 演进，版本之间可能有破坏性变更。依赖它的场景请钉住已知可用的版本，并
> 审阅所有生成产出。已交付/进行中/规划中的内容见 [roadmap](roadmap.md)。

**AI-DLC 方法论**（AI-Driven Development Life Cycle）的原生实现，一份源码
运行在多个 harness 上——Claude Code、Kiro IDE、Kiro CLI、Codex CLI。11 个
领域专家 agent 走 32 阶段工作流，每道审批门由你把关。

> 本文档为中文精简版，聚焦本 fork 的主线用法；框架的完整文档（架构、全部
> scope、深度/测试策略、CLI 工具、参考文献）见 [英文版 README](README.md)
> 与 [docs/](docs/README.md)。

## CDE PoC 加速器——本 fork 的主角

本 fork 附带 **[poc-accelerator 插件](plugins/poc-accelerator/README.zh-CN.md)**：
面向 CDE 认证 SA 的**八步、3-5 个工作日客户 PoC 交付流程**——CDK 优先部署、
三档费用分析（pilot / 生产 / 超产能）、留痕的交接质量清单、双端接线的团队
知识复用。

### 在聊天窗口快速安装

在目标项目的 Kiro 聊天会话窗口中输入：

```text
安装https://github.com/comdaze/aidlc-workflows的poc 加速插件到这个项目
```

如需可复现的手动安装流程，或使用其他 harness，请使用下方步骤。

从 clone 到跑起来共五步（Kiro IDE；完整细节与其他 harness 见
[插件中文 README](plugins/poc-accelerator/README.zh-CN.md)）：

```bash
# 1. 基础框架进项目（已有 .kiro/ + aidlc/ 则跳过）
cp -r dist/kiro-ide/.kiro <project>/.kiro && cp -r dist/kiro-ide/aidlc <project>/aidlc && cp dist/kiro-ide/AGENTS.md <project>/AGENTS.md

# 2. compose 插件（从 dist 读取，只写进 <project>/.kiro/，无需预拷贝）
PLUGIN_ROOT="$(pwd)/dist/plugins/poc-accelerator/kiro-ide"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" AIDLC_HARNESS_DIR=.kiro bun "$PLUGIN_ROOT/hooks/compose.ts"

# 3. 选择插件（在项目目录内执行）
cd <project> && bun .kiro/tools/aidlc-utility.ts select-plugins aidlc,poc-accelerator

# 4. MCP 配置：从 .kiro/knowledge/aidlc-pipeline-deploy-agent/mcp-setup.md
#    的全球区或中国区示例创建 .kiro/settings/mcp.json

# 5. 验收——全绿即安装成功
bun .kiro/tools/aidlc-utility.ts doctor
```

然后在 Kiro 中通过任一显式入口启动客户交付流程：

```text
/poc-accelerator-cde Build a safe customer demo for <客户场景>
# 或
/aidlc --scope poc-accelerator-cde Build a safe customer demo for <客户场景>
```

不要使用 `/aidlc pocx` 或裸 `/aidlc poc`：`pocx` 不是别名，核心 `poc`
仍是独立的、用完即弃的可行性 spike scope。

> 首次运行：把组织规则基线（部署规范、安全红线、团队知识仓库地址）写入
> `aidlc/spaces/default/memory/org.md`——填了仓库地址，流程步骤 1 才会自动
> 检查可复用的行业知识包。

## 唯一前置：bun

所有 harness 的钩子与 CLI 工具经 **bun** 运行：

```bash
curl -fsSL https://bun.sh/install | bash   # macOS/Linux（或用 brew install oven-sh/bun/bun）
```

> bun 必须在**非交互 shell** 的 PATH 上（harness 用它跑钩子）——zsh 读
> `~/.zshenv`、bash 读 `~/.bashrc`，而安装器写的是 `~/.zshrc`。若终端里
> `which bun` 正常但 harness 找不到，把 PATH export 复制到对应文件。

## 为什么用 AI-DLC

临时的 AI 编码在项目变认真后会失控：上下文在 prompt 间漂移、决策理由无处
可查、模型悄悄做你没要求的事。AI-DLC 用结构约束工作：每个阶段有明确负责
角色，每个决策过审批门，框架从你的纠正中学习并不再重犯。同一引擎既能跑
用完即弃的 PoC，也能跑受监管的企业级交付——只是执行更多阶段、更深的深度。

## 更多内容（英文）

- 各 harness 的安装与差异：[Quick Start](README.md#quick-start) 与
  [docs/guide/harnesses/](docs/guide/harnesses/)
- 阶段/角色/scope/知识体系：[docs/guide/](docs/README.md)
- 插件机制与二次开发：[docs/reference/18-plugin-mechanism.md](docs/reference/18-plugin-mechanism.md)
- 上游方法论：[AWS 博客](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)
