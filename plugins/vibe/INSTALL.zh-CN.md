# 在别的项目里安装 `vibe`

English: [INSTALL.md](INSTALL.md) · 插件本身是什么：[README.zh-CN.md](README.zh-CN.md)

## 先读这一节：配哪个引擎

这个插件在**本 fork 的引擎**和**原版上游 `awslabs/aidlc-workflows` v2** 上都能跑。
以前不是这样 —— 如果你看到的是这页的旧版本，它写着不要配上游。对着上游 2.6.61 实测
（2026-08-23），当时给的两条理由都已不成立：

| 曾经的依赖 | 现状 |
| --- | --- |
| learnings 身份按内容取键（**A13**） | **已消除。** 上游自己实现了内容取键（`createHash("sha256")` + `cidMarker`），所以"第二次沉淀静默丢弃已批准规则"这个风险在上游不存在。依据是读 `core/tools/aidlc-learnings.ts` 的实现，不是读它的说明。 |
| fresh workflow 上 `set-autonomy` 可用（**A10**） | **0.3.0 起消除** —— stage 改为停车容器，不再授予 autonomy。 |
| parked 分支放行 `--new-intent`（**A16**） | **上游已有** —— 它们 Branch 2.5 的 self-disable 列表里带 `!flags.newIntent`，所以"在停车容器旁边开第二个容器"在上游也成立。 |

剩下的是一个仍未修的引擎缺陷加一处非功能差异。两者都不阻碍安装，但你应该知道：

- **A11（上游仍未合并，[#729](https://github.com/awslabs/aidlc-workflows/pull/729)）。**
  上游的 Stop hook 把规则正文排在承载链位置的 `continue` token **前面**，会截断的
  harness 可能把 token 切掉，投递循环就再也推不动。这个分支在**所有核心 scope 上都会
  触发** —— 在 `feature` 容器上实测，配本仓库的 memory 层是 21 段、17KB payload ——
  但**`vibe` 容器到不了它**：第一次 `next` 返回 `run-stage`，没有 `continue_token`，
  `rules_in_context` 为空数组，这是带着同一份满载 memory 验证的。vibe 的 bundle 是空
  的，引擎原样返回 directive；memory 层仍然经由 harness 的常驻 include 到达模型。
- **A7（仅本 fork 有）。** 本 fork 给两个代码 sensor 加了 coalesce 窗口，上游是每次
  写入触发一次。只在你把 `linter`/`type-check` 显式加进 stage 的 `sensors:` 列表时
  才有影响 —— 默认不绑，而 stage 的 Sensors 段引用的是加了窗口后的成本。

都记在 `docs/fork/divergence.md`（A7、A11；A13 和 A16 在那里已关闭）。

实际结论：**可以只发 `dist/plugins/vibe/<harness>/`** —— 它是自包含的（只用 node
内置模块，加上从目标项目动态加载的引擎自带 `aidlc-lib.ts` / `aidlc-stage-schema.ts`）。
如果对方还没有任何 AI-DLC 安装，发整个仓库仍然最省事，因为他需要一个框架来 compose。

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
| GitHub Copilot | `copilot` | `.aidlc` |
| Cursor | `cursor` | `.cursor` |

后两个随上游 2.6.x 出现，插件投影到它们不需要携带任何 Copilot / Cursor 专有内容。
但它们是**产出了、没实跑过** —— 没有在这两个 harness 上跑过 vibe 会话，请当作未测试
而非已支持。

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
