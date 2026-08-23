# vibe —— 自由编程，但照样沉淀

[English](README.md) | **中文** · **装到别的项目**：[INSTALL.zh-CN.md](INSTALL.zh-CN.md)
—— 在把它发给任何人之前先读那份文档的第一节。它在本 fork 的引擎和原版上游 v2 上都能跑；
那一节记录了还剩哪些引擎差异，以及每一条各自实测到了什么程度。

安装后叫 **`aidlc-vibe`**。一个 stage、没有轨道、收工前没有审批门 —— 但记忆和知识照常加载，
而你学到的东西是**走框架的准入门**写回去的，不是手改文件。

它和 `poc-accelerator` 是相反的取舍：那个插件加结构，让客户交付站得住；这个插件去结构，
只留下会复利的那一部分。

## 给你什么、不给你什么

| | |
| --- | --- |
| **给** | 记忆读取（`org → team → project → phase` 链，任何会话本来就在上下文里）· 知识读取（lead agent 的席位照常加载）· 沉淀走 §13 准入门 —— 冲突检查、幂等、一条 `RULE_LEARNED` 审计行 · stage 开始/产物写入/收工都进审计轨迹 |
| **不给** | 任何关于"你建的东西对不对"的结论。没有需求捕获、没有评审过的设计、没有验收标准，所以这里的任何东西都**不能**当作正确性或完整性的证据。需要那个结论就用 `feature` / `mvp` / `enterprise` —— 这个 scope 刻意给不出来 |

## 怎么用

在 Kiro 里，从 agent 选择器里挑 **`aidlc-vibe`**，直接开口说话就行 —— 这个 agent 会在第一个回合
自己开容器，不用记任何命令。在任何 harness 上，scope 命令做的是同一件事：

```text
/vibe <你要开始做的事>
# 或
/aidlc --scope vibe <你要开始做的事>
```

然后就正常干活。任何时候可以说三句话：

| 你说 | 会发生什么 |
| --- | --- |
| 其他任何话 | 正常自由编程。不问仪式问题、不报 stage 进度、不开门 |
| **沉淀**（"记一下" / sediment） | 从会话日记里捞出候选条目，你挑，确认的走准入门写入。**可重复** —— 长会话应该沉淀不止一次 |
| **收工**（close） | 写会话日志、开那唯一一道审批门、结束容器 |

这个 scope 解析出来是 **4 个会执行的 stage**：三个初始化 stage
（`workspace-scaffold`、`workspace-detection`、`state-init` —— 引擎序幕，负责搭出记录树和状态文件）
加上 `vibe-session`。没有第四件事在等着发生。

## agent 入口（Kiro）

这件事插件只用**一个**文件：`agents/aidlc-vibe.md`。它的 frontmatter 就是 Kiro 的 agent 配置
（`tools`、`resources`、`description`），正文就是 prompt；它同时还是 stage 的 `lead_agent`，
所以两条入口路径行为完全一致。

**旁边刻意没有 `aidlc-vibe.json`。** Kiro 把 `agents/` 下的 `.md` 和 `.json` 都当 agent 配置读，
而两者同名时**`.md` 胜出** —— 于是那个 `.json` 孪生文件是静默惰性的。这件事在这里造成了连续三次误修：
JSON 里的 `tools` 被改了三次（旧名字 → 干脆不写 → `["*"]`），而观察到的行为一次都没变，
因为那个文件从来没被读。它的 `resources` 同样从未生效。

核心那 14 个 agent **确实**两个都带，而它们的 `.md` 里放的才是真正生效的配置
（`tools: ["read","write","shell"]`），`.json` 里则是过时的 0.x 词汇表加一个 `hooks` 键。
**不要照抄这一对** —— 它正是把缺陷藏起来的那个形状。

这个 agent 是**入口**，不是 stage 的替代品。选中它仍然会开容器，因为写入路径需要它（见下一节）。
agent 去掉的是那条命令，和"我在启动一个流程"的感觉。

四件要知道的事：

- **JSON 刻意不带 `hooks` 键。** Kiro 官方文档自己就互相矛盾 —— 两处说 IDE 忽略这个**字段**，
  一处说 IDE 忽略**带这个字段的整个 agent**。在这种含糊下，安全形状是干脆不写，因为它带来的失败
  （agent 在选择器里悄悄消失）没有任何可见症状。而且 hook 本来就该放 `.kiro/hooks/`。
  插件测试把"没有这个键"钉住了。顺带一提：核心那 14 个 `aidlc-*-agent.json` 全都带 `"hooks": {}`，
  所以如果你的选择器里看不到它们，这是第一个该查的地方。
- **`"tools": ["*"]` —— 通配符，不写任何更窄的东西。** 之前两种写法都在真实 Kiro IDE 会话里实测过，
  结果都是 agent 只剩**一个**工具（skill 加载器）—— 能把一份操作手册读进上下文，却一步都执行不了：

  | 声明方式 | 结果 |
  | --- | --- |
  | `["fs_read","fs_write","execute_bash","thinking"]` | 只有一个工具 |
  | 干脆不写这个键 | 只有一个工具 |

  也就是说**省略 `tools` 并不会继承默认 agent 的能力**，而是给你一个几乎什么都没有的 agent。
  而 `fs_read`/`fs_write`/`execute_bash` 是 CLI 2.x / IDE 0.x 的名字，在 IDE 1.x 上解析不出来 ——
  当前的标签是 `read`/`write`/`shell`。

  `["*"]` 才是"全都要"的写法，也是自带的 `developer` agent 用的那个 —— 一台真实机器上 40 多个
  可用配置里有 9 个就是这么写的。它同时也是唯一不把自己绑死在某一代 IDE 工具名词汇表上的写法。

  **护栏应该放在 harness 自己的权限设置里**，那样对所有 agent 都生效 —— 而不是塞进某一个 agent
  的配置里，那里一旦搞错 schema 版本就会静默地把这个席位废掉。测试钉住了 `["*"]`
  以及"不出现任何白名单/拒绝名单"。

  顺带一个关于安装的事实：核心那 14 个 `aidlc-*-agent.json` 全都写着 0.x 的旧名字，
  所以在 IDE 1.x 上带着同样的缺陷。它们是为**委派**而不是为**选择**设计的，委派路径是否也受影响
  我没有实测 —— 但从选择器里挑它们中的任何一个，都不会得到一个能干活的席位。
- **在非 Kiro 的 harness 上这个 JSON 是惰性的。** Claude 读 `.md`、Codex 读 `.toml`、
  opencode 读自己的原生孪生 —— 拷过去的 JSON 在那边只是无害的多余文件，入口仍然是 scope 命令。

有一个边界情况 agent 会明说：插件的 `agents/` 无论启用与否都会被拷过去，所以**禁用**了 vibe 插件时，
选择器条目还在，但它的 stage 已经被过滤出图外。prompt 会检测到容器开不起来并直接讲清楚，
而不是干了一小时之后才发现没地方沉淀。

## 在已装好的环境里迭代这个插件

下面两条是把这个插件 dogfood 到框架自己仓库时实测出来的，不知道就会白耗一下午：

**改插件源码不会更新一个已经装过它的环境。** compose 是 **no-clobber** 拷贝，所以你改完源码、
`bun scripts/package.ts`、再 compose 之后，安装侧还是旧字节。compose 什么都不打印、退出码 0。
得先把安装侧那个文件删掉：

```bash
rm <project>/.kiro/aidlc-common/stages/construction/vibe-session.md
# 然后重新 compose；新内容就落地了，drop 也会自清
```

**唯一的信号是一条 doctor 行。** 这次跳过被记到 `.drops` 文件里、不走 stdout，表现为
`Hook drops (plugin-compose-vibe): 1 degraded of 1`。任何一次你**期望它改动什么**的 compose
之后，都该跑一下 `aidlc-utility.ts doctor`。

而它给的修复建议会把你带错方向：它说这个文件"和一个已存在的文件（core 或别的插件）冲突 ——
把它改成插件命名空间下的路径"。但在"安装侧过期"这种情况下，冲突的对象是这个插件**自己**上一次的产物，
改源码的名字恰恰是错的修法。

**一个 stage 的容器照样要付 walking-skeleton 那次往返。** 因为它是 construction 阶段的 stage，
directive 会带着 `gate: "unresolved"` 过来，不把 `--skeleton-stance` 报回去引擎就不往下走。
用框架默认值答案是 `scope-dependent`，回落到本 scope 的 `skeleton: off` —— 结果是对的，
但这个问题本来就不该问一个只有一个 stage 的 scope。stage 的第 1 步现在把它写明了。

## 为什么要有一个 stage，而不是只写个 steering 文件

因为难的部分只在**写**。读记忆是免费的 —— 每个 harness 本来就把那些文件放进环境上下文，
跟有没有 workflow 无关。但**写得可靠**不免费：沉淀工具会拒绝执行，除非请求的 stage 正是状态文件里的
`Current Stage`，而这道校验换来的正是冲突检查、幂等和审计行。一个停驻的 stage 能满足它，
一个 steering 文件不能。

所以这个 stage 不是来给你的工作排序的。它是来托住那个让沉淀可信的前提条件的。

## 改它之前该知道的设计细节

**容器故意停在 `in-progress`，而且有两个钩子依赖这一点。**

- `aidlc-block`（人类在场底线）只在**门开着**时触发。没有开着的门它就短路 ——
  这就是为什么自由用工具不会被干扰，也是为什么**原生 Kiro Spec 可以在这个容器里跑**。
  实测的注意点：这个 stage 也**管不住** spec task（`PreTaskExec` 的 exit 2 没有否决权），
  所以它是观察，不是监督。见
  [`docs/fork/kiro-spec-integration.md`](../../docs/fork/kiro-spec-integration.md)。
- Stop 钩子会对"回合结束时还有待办指令"发出提醒。第 1 步**把容器真正停车**
  （`aidlc-orchestrate.ts park`）：引擎对钩子自己的探测回答终态 `parked` 指令，钩子据此干净放行 ——
  不再提醒，也不再每回合重发约 16 KB 的 stage 规则包。
  **删掉这一步，每个在会话中间结束的回合都会被当成弃置的 workflow 来提醒。**
  不要用 `set-autonomy --mode autonomous` 替代（旧版曾这么做）：park 在 autonomous 下拒绝执行，
  Stop 钩子在 autonomous 下也拒绝 parked 放行，两个机制互相抵消。
  插件测试钉住了停车步骤和停车生命周期（parked 下 surface/persist 可用；收工先 unpark 再开门）。

**默认不绑任何 sensor。** 唯一的产物是收工时才写一次的会话日志，所以文档形 sensor 只会带来摩擦、
检查不到任何有价值的东西。两个代码 sensor 是真选项 —— 它们的 glob 按文件类型匹配、不看是谁写的，
所以绑上就意味着验证跟着代码走，无论是你写的还是 spec task 写的；而且它们现在有节流窗口，
成本是每个窗口一次工具链，不是每次写入一次。**只有在仓库真的配了那套工具链时才绑** ——
产不出发现的 sensor 就是纯延迟（实测：某个没装 eslint 的项目上，每次写入 11 秒、50 次、零发现）。

**收工之后容器就没了。** workflow 完成、`Current Stage` 清空，想再沉淀就得开新会话。
这个边界是刻意的：已经收割过的日记不该被收割第二次。

## 安装

和任何 AIDLC 插件一样，详见 [PLUGINS.md](../../PLUGINS.md)。简版：

```bash
# Claude Code
/plugin marketplace add <repo>/dist/plugins/vibe/claude
/plugin install aidlc-vibe@aidlc-plugins        # SessionStart 钩子自动 compose

# Codex CLI
codex plugin marketplace add <repo>/dist/plugins/vibe/codex
codex plugin add aidlc-vibe@aidlc-plugins      # 一次性 hook 信任确认

# Kiro CLI / Kiro IDE / opencode —— 显式 compose
PLUGIN_ROOT="<repo>/dist/plugins/vibe/kiro-ide"   # 或 kiro / opencode
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "$PLUGIN_ROOT/hooks/compose.ts"
```

然后选中它（要列出完整的启用集合，`aidlc` 代表核心）：

```bash
bun <harness-dir>/tools/aidlc-utility.ts select-plugins aidlc,vibe
```

不需要 MCP 配置，也没有其他设置 —— 这个插件只加一个 scope、一个 stage、一个人格文件、
一个 Kiro 选择器条目、一份知识文件。

> **命名**：目录和 manifest 是 `vibe`，安装后的 host 插件是 `aidlc-vibe`（前缀由打包器加）。
> 内部名必须不带前缀 —— compose 会拒绝任何声明 `plugin: aidlc-*` 的 scope 或 agent 文件，
> 因为插件自有的 runner 用裸名，会和 core 的 `aidlc-<name>` runner 路径撞车。

## 验证插件内容

```bash
bun test plugins/vibe/tests/plugin.test.ts
```

除了 schema 合法性，测试还钉住了这个设计赖以成立的四条性质：只有一个 stage、
从零就能进入、停车步骤在且写明了原因（并对真实工具验证了停车生命周期）、scope 不声明关键词
（这样一句随口的"vibe"不会劫持一个本该走正经流程的请求）。

agent 那一面也有守卫，因为那里每一种失败都是静默的：选择器条目不带 `hooks` 键、
`prompt` 和 `name` 都指向真实存在的文件、`resources` 仍然钉住记忆层、
没有任何限制工具的键悄悄回来（也就是默认 agent 的能力仍然是继承的）、
知识仍然留在本插件自己的席位里而不是漏进某个核心 agent 的目录。
