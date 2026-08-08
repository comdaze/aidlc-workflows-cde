# 在别的项目里安装 `vibe`

English: [INSTALL.md](INSTALL.md) · 插件本身是什么：[README.zh-CN.md](README.zh-CN.md)

## 先读这一节：这个插件依赖本 fork 的引擎

> [!IMPORTANT]
> **不要把这个插件配上游 `awslabs/aidlc-workflows` 的安装。** 它依赖的三个修复在本
> fork 的 `core/` 里，不在插件里。配原版上游不是"功能略差"，而是**stage 第一步就报错**。

| 依赖 | 缺了会怎样 |
| --- | --- |
| 全新 workflow 上 `bolt set-autonomy` 可用（**A10**） | **stage 第 1 步直接失败。** 新生成的 state 文件里没有 `Construction Autonomy Mode` 字段，命令硬报错。之后 Stop 钩子会把这个刻意停住的容器当成弃置流程，每回合 nudge 一次直到上限。 |
| load-steering 续传可跟随（**A11**） | `continue` 的 token 排在约 16KB 规则正文**后面**，会被截断掉，链永远推不动 —— 同一批内容每回合重发一次。 |
| learnings 身份按内容取键（**A13**） | 同一会话里第二次 `沉淀` 可能**静默丢弃你已经批准的规则**，同时报告成功。 |

三条都记在 `docs/fork/divergence.md`（A10 / A11 / A13），都是可以提给上游的；上游收了之后
这段警告就作废。在那之前，**要发就发整个 fork，不要单发插件。**

实际结论：把**整个仓库**（或它的压缩包）交给对方，而不是只给 `plugins/vibe/`。

## 另外：`plugins/vibe/` 是源码，不是分发物

`plugins/vibe/` 是给打包器的手写输入。真正安装的是 `dist/plugins/vibe/<harness>/` 下
生成好的宿主插件 —— 它已入库，除非你改过 `core/` 或 `plugins/`，否则不需要任何构建步骤。

## 安装

`<repo>` 是本仓库的克隆，`<project>` 是目标项目。

| Harness | `<harness>` | `<harness-dir>` |
| --- | --- | --- |
| Kiro IDE | `kiro-ide` | `.kiro` |
| Kiro CLI | `kiro` | `.kiro` |
| Claude Code | `claude` | `.claude` |
| Codex CLI | `codex` | `.codex` |
| opencode | `opencode` | `.aidlc` |

**1. 先装框架。** 按 [Pick your harness](../../README.md#pick-your-harness) 把
`dist/<harness>/` 拷进 `<project>/`。项目里已有 AI-DLC 安装就跳过。

> [!WARNING]
> 顺序搞错会**静默失败**。当 `<project>/<harness-dir>/tools/aidlc-graph.ts` 不存在时，
> 组合器会直接返回 —— 不报错、不留健康记录 —— 因为它要先拿**已安装**引擎的 schema 校验
> 每个插件 stage。compose 是幂等的，所以顺序错了只要框架到位后重跑一次即可。

**2. compose 插件。**

```bash
PLUGIN_ROOT="<repo>/dist/plugins/vibe/<harness>"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=<harness-dir> bun "$PLUGIN_ROOT/hooks/compose.ts"
```

**3. 启用它。** compose 只负责拷文件，引擎看得见什么由**选择**决定。要把想启用的插件
**全部列出** —— 这个列表是绝对的，不是追加：

```bash
cd <project>
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc,vibe
```

这里漏掉 `vibe`，文件还在但 stage 会被过滤出图外，于是 agent 入口会去开一个不可能存在的
容器。prompt 会检测到并直接讲清楚，而不是干了一小时才发现没地方沉淀。

**4. 验证。**

```bash
bun <harness-dir>/tools/aidlc-utility.ts doctor
bun <harness-dir>/tools/aidlc-utility.ts plugin-list
```

`doctor` 应该报 `vibe enabled`，启用 stage 数为 1。

## Kiro IDE 专属事项

**agent 入口。** `aidlc-vibe` 会出现在 agent 选择器里，选中直接开口说话即可，它会在第一个
回合自己开容器。其他所有 harness 上入口是 `/vibe` 或 `/aidlc --scope vibe`。

agent 配置是**会话启动时**读的 —— 安装或更新之后要**开新会话**，否则旧配置仍然生效。

**不要点 Agent Hooks 面板里的 "Migrate legacy hooks to v1"。** 那些带删除线的 `legacy`
条目按设计就是惰性的（为 1.0 之前的 IDE 准备的），迁移会把已注册的钩子**重复注册一遍**。
如果你不在 1.0 之前的版本上，直接删掉它们：`rm <project>/.kiro/hooks/*.kiro.hook`。

**如果钩子报 `/bin/sh: bun: command not found`（127）**：从 GUI 启动的 IDE 继承的是
launchd 的 PATH，里面没有 `~/.bun/bin`；而钩子用的 `/bin/sh` 不读任何 rc 文件 ——
所以 `~/.zshrc` 和 `~/.zshenv` 都帮不上它。把 bun 放到系统路径上：

```bash
ln -s "$HOME/.bun/bin/bun" /usr/local/bin/bun
```

`doctor` 会直接检查这一项。注意 127 **不会**留下 drop 记录（钩子根本没跑起来）——
所以钩子健康文件看着干干净净，实际什么都没触发。

## 以后更新插件

compose 是 **no-clobber**：它绝不覆盖项目里已有的文件，所以更新后重新 compose 会静默保留
旧字节并正常退出 0。**得先删掉安装侧的副本**：

```bash
cd <project>
rm -f <harness-dir>/agents/aidlc-vibe.md \
      <harness-dir>/scopes/vibe.md \
      <harness-dir>/aidlc-common/stages/construction/vibe-session.md
rm -rf <harness-dir>/knowledge/aidlc-vibe
# 然后重跑第 2 步；如果选择被重置了，再跑第 3 步
```

被跳过的文件唯一的信号是一条 `.drops` 记录，由 `doctor` 以"降级钩子"行呈现 —— 而它给的
修复建议会让你"改成插件命名空间下的路径"，那对"安装侧过期"这种情况恰恰是错的修法。
**任何一次你期望它改动什么的 compose 之后，都跑一下 `doctor`。**

## 卸载

```bash
cd <project>
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc   # 去掉 vibe
```

这会把 stage 过滤掉、文件留在原地，随时可以重新启用。要连文件一起删，就删上面
*以后更新插件* 那一节列的路径。这两种做法都**不碰** `aidlc/` 下的任何东西
（workflow 状态、日记、审计、记忆层）。

## 它刻意不提供什么

没有需求、没有评审过的设计、没有验收标准 —— 所以**vibe 会话产出的任何东西都不构成
正确性或完整性的证据**。需要那个声明就用 `feature` / `mvp` / `enterprise`。
沉淀的规则仍然要过框架的准入门，这是这个 scope 唯一保留的保证。
