# knowledge-plugin — 棕地深度知识工程

[English](README.md) | **中文**

> 面向棕地仓库的第一方 **AIDLC 插件**：把核心 `reverse-engineering` 的概览级 codekb
> 替换成**带代码锚点、经人工签字的领域知识**，并让门禁驳回理由以 KEM-lite 格式回写
> 沉淀，被下一次 reverse-engineering 重跑自动吸收，闭合知识飞轮。
>
> 完整设计与集成契约：[`CONTRACT.md`](CONTRACT.md)。
> 插件机制：[`docs/reference/18-plugin-mechanism.md`](../../docs/reference/18-plugin-mechanism.md)。

## 1. 它做什么

核心的 `reverse-engineering` stage 把存量代码逆向成 9 个 markdown 文件，下游 5 个
stage 读这个目录获得上下文。但那些产物是**概览级**的——够用来认路，不够支撑一个业务
逻辑沉淀了多年的代码库。本插件把 [SwarmAI](https://github.com/xg-gh-25/SwarmAI) 的
`s_repo-to-ddd` 引擎收编进来，先产出一套深度知识库，再翻译成同样的 9 个文件名。

差异化来自这个引擎的一条铁律：**每条 AI 生成的知识断言必须带代码或文档锚点
（`file:line`）和 `verified` 标记。** 无锚点的断言标为「LLM 推断、未验证」，绝不冒充
事实；生成末尾是 fail-closed 校验门（锚点核算 / 断言守卫 / 引用完整性），不过就整体
失败，而不是产出静默残缺的知识。

三个挂载点：

```
【逆向筑底】筑底 stage —— 代码 + 文档 → 带锚点、senior 签字的 .ai-ready/
      │
      ▼
【正向消费】reverse-engineering Step 3a —— adapter 用 .ai-ready/ 重写
      │                                     那 9 个 codekb 文件（文件名不变）
      ▼
【沉淀回流】3 个 construction stage —— 门禁驳回 → IMPROVEMENT.md 的 KEM-lite entry
                                       → 下次 RE 重跑时吸收
```

不新增任何 agent：筑底 stage 由 `aidlc-developer-agent` 主导、`aidlc-architect-agent`
支援，并绑定核心的 `required-sections` sensor。

## 2. 前置条件

| 要求 | 原因 |
| --- | --- |
| `python3` | vendored 引擎的校验半边。纯标准库，零三方依赖。若默认 `python3` 不合适，用 `AIDLC_PYTHON` 覆盖解释器。 |
| `bun` | 框架本身的要求。 |
| **棕地**仓库 | 筑底 stage 在绿地项目永不触发——没有存量代码可逆向。 |
| scope 为 `enterprise` / `feature` / `mvp` / `workshop` | 筑底 stage 的 `scopes:` 清单。注意**不含** `poc`。 |

动手前先自检环境：

```bash
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts check
# ok: Python 3.x.y + vendored ai_ready_helpers importable
```

本文中 `<harness-dir>` 指你所用 harness 的安装目录——`.kiro`（Kiro IDE / CLI）、
`.claude`、`.codex` 或 `.aidlc`（opencode）；`<repo>` 指被逆向的棕地仓库。stage 与
contribution 文件里写的是 `{{HARNESS_DIR}}` 占位符，由 composer 替你替换。

## 3. 安装

各 harness 的通用安装步骤见[根 README](../../README.zh-CN.md#手动安装任意插件任意-harness)。
Kiro 场景下，在项目已装好框架之后：

```bash
PLUGIN_ROOT="<repo>/dist/plugins/knowledge-plugin/kiro-ide"   # Kiro CLI 用 kiro
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "$PLUGIN_ROOT/hooks/compose.ts"
```

> [!IMPORTANT] 必须**先**装框架。当 `<project>/<harness-dir>/tools/aidlc-graph.ts`
> 不存在时，composer 直接返回——不报错，也不写健康记录——因为它要用**已安装引擎**的
> schema 校验插件的每个 stage，才决定拷不拷。compose 是幂等的，顺序错了只需补上框架
> 再跑一次。

确认 compose 真的落地：

```bash
ls .kiro/aidlc-common/stages/inception/knowledge-plugin-bootstrap.md
grep -c 'plugin:knowledge-plugin' .kiro/aidlc-common/stages/inception/reverse-engineering.md   # 应为 2
bun .kiro/tools/aidlc-utility.ts plugin-list
```

## 4. 怎么用

**插件整体没有专属命令**——它在正常工作流里自动上路。在棕地仓库起需求时，描述**你真正
想让它做的那个变更**，不是「建知识库」；筑底 stage 会自己加入计划，你不需要在描述里点名。

```text
/aidlc --scope feature 给人资 ERP 的工资计算模块加上跨月补发的处理
```

有两件事决定这条命令管不管用，而且两个坑都会实际踩到：这次运行必须落进包含筑底 stage 的
scope（见下），以及——因为该 stage 被排在 inception 的**最后**——走工作流的运行喂不到它
自己的下游 stage，所以实践中要先单独把筑底跑掉（§4.1）。

**务必显式指定 scope。** 筑底 stage 只在 `enterprise` / `feature` / `mvp` /
`workshop` 下运行，而裸写 `/aidlc <描述>` 并不能可靠落进这四档：

- `feature` 和 `enterprise` 的 `keywords` 是**空数组**，关键词推断永远命中不了它们。
- 没命中任何关键词的描述被判为 `freeform`，引擎发的是 **compose offer**，不是静默
  落到 `feature`。回 "compose" 之后由 composer 自行提 EXECUTE/SKIP 网格，筑底 stage 在不
  在里面是当场判断的，不保证。纯中文描述通常就落在这一支。
- 命中了关键词的短描述（按空白切分 ≤5 词）会被路由到**不含**筑底 stage 的 scope：
  `fix`/`bug`/`broken` → `bugfix`，`refactor`/`clean up`/`simplify` → `refactor`，
  `deploy`/`infra` → `infra`，`security`/`CVE`/`patch` → `security-patch`，
  `prototype`/`spike`/`poc` → `poc`。超过这个词数的命中被判为偶然，退回 `freeform`
  ——但词数是按**空白**切分的，中文再长也只算一两个词，所以中文描述里只要混进一个英文
  关键词就必定走关键词路由。「fix 一下工资计算的 bug」会进 `bugfix`，知识库不会建。

传了 `--scope` 就完全跳过推断，路由是确定的。`feature` 是 Standard 深度；`enterprise`
是 Comprehensive、门最密。（只有 `bugfix` / `feature` / `mvp` / `security-patch` 声明了
`runner: true`，所以没有 `/aidlc-enterprise` 快捷入口，用 `/aidlc --scope enterprise`。）

> [!IMPORTANT] **活跃 workflow 的 scope 压过一切，`--scope` 覆盖不了。**
> scope 优先级是：活跃的 `aidlc-state.md` → `--scope` 标志 → `AWS_AIDLC_DEFAULT_SCOPE`
> 环境变量 → `feature`。所以只要有一个 `poc` scope 的活跃 workflow，**任何**入口都会被
> 拒——包括 `/knowledge-plugin-bootstrap` 和显式的 `--scope feature`：
> `Stage "knowledge-plugin-bootstrap" is skipped for scope "poc"`。先把那个 workflow
> 做完或搁置，或用
> `bun <harness-dir>/tools/aidlc-utility.ts scope-change --scope feature` 切换，
> 或者换一个 intent。

### 4.1 先单独跑筑底，再开工作流

**走工作流路由时，这个 stage 排在 inception 的最后——对本次运行来说太晚了。** 编译**不
采用**frontmatter 里写的 `number:`；它从 `stage-graph.json` 取已钉住的编号，新 slug 则
自动播种 `<阶段前缀>.<下一个空闲序号>`，所以插件 stage 一定落在本阶段所有核心 stage 之后。
实际编译出来是 `2.9`，而它唯一的排序边是 `requires_stage: [state-init]`——没有任何边把它
排到 `reverse-engineering`（`2.1`）前面。引擎写进计划的顺序证实了这一点：

```
- [ ] reverse-engineering — EXECUTE
- [ ] requirements-analysis — EXECUTE
- [ ] application-design — EXECUTE
- [ ] delivery-planning — EXECUTE
- [ ] knowledge-plugin-bootstrap — EXECUTE     ← 最后
```

于是 `reverse-engineering` 先写出浅层的原生 codekb，下游 stage 吃的是那一份，等
`.ai-ready/` 存在时这轮已经结束。深度知识只对**下一个**需求生效（靠
`reverse-engineering` 的 freshness 重跑）。增量 contribution 机制补不了这个顺序：
`adds.requires_stage` 属于「声明了只记日志、未实现」
（`IMPLEMENTED_ADDS = produces | sensors | consumes | required_sections`）。

**所以先把筑底单独跑掉，再开工作流：**

```bash
# 0. 确认没有活跃 workflow，或其 scope 在 enterprise/feature/mvp/workshop 之内
bun <harness-dir>/tools/aidlc-utility.ts status
```

```text
# 1. 先建知识库（无活跃 workflow 时默认 scope 是 feature）
/knowledge-plugin-bootstrap

# 2. 再开真需求——这时 reverse-engineering 才找得到 .ai-ready/
/aidlc --scope feature 给人资 ERP 的工资计算模块加上跨月补发的处理
```

第 2 步的 `reverse-engineering` 完成摘要必须报 `deep (.ai-ready)` 而不是 `native`。这是
判断插件有没有生效的唯一可靠信号。

这个顺序的代价：单跑的 directive 带 `gate: false`，没有引擎强制的审批门——senior 签字从
「有留痕的流程转换」降级成你自己的纪律。要留痕就手工记进 `.ai-ready/REVIEW-REPORT.md` 和
`IMPROVEMENT.md`。

### 4.2 各入口分别是什么效果

| 入口 | 跑不跑筑底 | 说明 |
| --- | --- | --- |
| `/knowledge-plugin-bootstrap` | 无活跃 workflow 时跑 | runner 无参（`argument-hint: ""`，body 无 `$ARGUMENTS`），传不了 `--scope`。活跃 workflow 的 scope 不合规时被拒。`gate: false`，且 `CONDITIONAL` 条件不被引擎求值。 |
| `/aidlc --stage knowledge-plugin-bootstrap --single --scope feature` | 同上 | 裸命令形式。有活跃 workflow 时 `--scope` 同样被忽略。 |
| `/aidlc --scope enterprise\|feature\|mvp\|workshop <需求>` | 跑，但排最后 | 深度知识进不了本轮（§4.1）。 |
| `/aidlc-feature <需求>`、`/aidlc-mvp <需求>` | 跑，但排最后 | scope runner，scope 已烘死。 |
| `/aidlc <需求>`（不带 `--scope`） | 不可靠 | freeform 走 compose offer，筑底是否入网格由 composer 当场定。 |
| `/aidlc --scope poc\|bugfix\|refactor\|infra\|security-patch <需求>` | 不跑 | 这五档不含该 stage。 |
| `/poc-accelerator-cde <场景>` | 不跑 | `poc-accelerator-cde` scope 不含该 stage。 |
| 任意入口，绿地项目 | 不跑 | Step 1 报 skipped。 |

### 4.3 一次性筑底 —— stage `knowledge-plugin-bootstrap`

| 字段 | 值 |
| --- | --- |
| 阶段 / 编译编号 | inception / 自动播种在本阶段最后（stock 安装里是 `2.9`）——见 §4.1 |
| 执行 | `CONDITIONAL` —— 棕地**且** `.ai-ready/` 不存在（或过期 / 未审核） |
| 主导 / 支援 | `aidlc-developer-agent` / `aidlc-architect-agent`，`mode: inline` |
| 产出 artifact | `ai-ready-knowledge-base` |
| 输入 | `<repo>` 源码树 + 可选 `<repo>/docs-input/` |
| 输出 | `<repo>/.ai-ready/` + `<repo>/AGENTS.md` |

**Step 1 条件与环境自检。** 读 `aidlc-state.md` 确认棕地，跑上面的 `check`；项目是绿地，
或 `.ai-ready/` 已存在且 `validate` 通过、你确认是当前的，则 report skipped 并记录原因。
单跑模式下没有 `aidlc-state.md`，也没法记录 skip——`report --single` 只接受前向结果——所以
该 stage 会说明情况后停下，而不是写一条虚假的 `completed`。

**Step 2 生成。** 主导 agent 严格照 vendored 引擎自己的工作流执行
（`tools/vendor/repo-to-ddd/INSTRUCTIONS.md`：INGEST → UNDERSTAND → ENRICH → GENERATE
→ VERIFY），产出：

```
<repo>/AGENTS.md                     ← AI 的入口文档（≤150 行）
<repo>/.ai-ready/
  ├── PRODUCT.md                     ← 为什么：目的 / 受众 / 边界
  ├── TECH.md                        ← 怎么做：架构 / 约定 / 技术栈
  ├── IMPROVEMENT.md                 ← 学到的：坑 / 模式 / KEM-lite entry
  ├── PROJECT.md                     ← 现在：优先级 / 决策 / 阻塞
  ├── code-intel.json                ← 机器可读：模块 / 路由 / 入口
  ├── REVIEW-REPORT.md               ← 给人看的：评分 / 缺口 / 审核分工
  ├── BLIND-SPOTS.md                 ← 无 spec 覆盖的高风险代码
  └── spec-details/<domain>.spec.md  ← 每个业务域的深度规格：业务规则 + 锚点
```

生成完必须过 fail-closed 门——这不是可选项：

```bash
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts validate --repo-path <repo>
# PASS: code-intel.json clears all fail-closed gates
```

有任何 error 就修产物再校验。**绝不把失败的知识库交到 gate。**

**Step 3 senior 审核包。** 这个 stage 的审批门是**领域签字，不是形式审批。** agent 会
呈上：每个 domain 的 spec 文件及规则计数（总数、verified vs `unverified`）、
[`knowledge/senior-review-checklist.md`](knowledge/senior-review-checklist.md) 清单、
REVIEW-REPORT.md 的覆盖声明。重点盯清单点出的两类高危：**凭空发明的约束**、以及
**错误的「这个不存在」断言**。你的修正以 `[human]` 标记直接落进 spec 文件；凡是暴露
出「之前的认知是错的」，另外以 KEM-lite `[correction]` 记进 `IMPROVEMENT.md`。

**Step 5 完成摘要。** 必须报出：生成的 domain / flow / step 数与 spec 文件数；业务规则
总数及**剩余 unverified 数**（团队要一轮轮追的知识成熟度指标）；三档覆盖等级（代码验证
/ 文档+人工确认 / 仅文档）；以及一句提醒——批准这道 gate 意味着下游每个 stage 都把
`[human]` 标记的内容当事实用。

#### 配置态 / 文档通道

当业务规则大量存在于配置、BPM 流程、飞书文档而非代码里时，把导出物放
`<repo>/docs-input/`。它们会作为 ENRICH 语料；从文档提取的规则 anchor 指向文档位置，
初始 `verified: false`，等 senior 审核后才置 true。纯配置无代码的部分，在 spec-details
§8 与 BLIND-SPOTS.md 中如实标注，不粉饰。规则见
[`knowledge/config-channel.md`](knowledge/config-channel.md)。

### 4.4 每次需求 —— `reverse-engineering` Step 3a

contribution 在核心 Step 3 之后插入一步，逻辑严格二分：

- **`.ai-ready/` 不存在** → 什么都不做，原生 9 个产物照用。这是可插拔开关的下半：
  没筑底时原生 RE 完全按出厂行为工作。
- **`.ai-ready/` 存在** → 解析 codekb 目录，再跑 adapter：

```bash
CODEKB=$(bun <harness-dir>/tools/aidlc-utility.ts codekb-path --repo <repo>)
bun <harness-dir>/tools/aidlc-codekb-adapter.ts --repo-path <repo> --output-dir "$CODEKB"
```

两个参数都是必需的。adapter **幂等**（覆盖，不追加、不留残档）且 **fail-closed**
（`.ai-ready/` 结构不完整则非零退出，绝不留下半适配的 codekb）。

文件名不变——`requirements-analysis`、`functional-design`、`code-generation` 读的还是
那 9 个名字，只是改为从带锚点、带签字标记的规则出发推理。两处升级最明显：

| codekb 文件 | 深度版多了什么 |
| --- | --- |
| `component-inventory.md` | 按业务域分组，每域附核心业务规则（带锚点）+ 指向对应 spec-details 文件的链接。 |
| `code-quality-assessment.md` | 覆盖缺口从 REVIEW-REPORT.md + BLIND-SPOTS.md 原样照录，不粉饰——可信度来自诚实。 |

RE 的完成摘要会报本次产出的是哪个变体（`native` 还是 `deep (.ai-ready)`），深度版还会
报 domain 数、spec-details 文件数、**未验证规则数**——审批人必须知道自己是在哪一档知识
上签字。

### 4.5 飞轮 —— KEM-lite 回写

`functional-design`、`code-generation`、`build-and-test` 三个 stage 的 contribution
扩展了各自的 learnings 环节，提议把教训写回 `IMPROVEMENT.md`：

```markdown
- [pitfall] 工资项 X 的舍入规则与文档不符,以代码为准 — anchor: src/salary/calc.py:L88
  <!-- kem: type=pitfall | date=2026-08-05 | source=gate:code-generation | verified=human -->
```

`type` 四选一：`pitfall` / `decision` / `guideline` / `correction`；`source` 记录产生
此条的 gate 或 stage。**门禁驳回理由是最高优先的 entry 来源**——人明确说「不对，应该是
X」的那一刻，就是知识产生的时刻。回写一律 propose-approve，绝不静默写。格式见
[`knowledge/kem-lite.md`](knowledge/kem-lite.md)。

闭环靠 freshness：下个需求开跑时 RE 重跑，从更新后的 `.ai-ready/` 重新生成 codekb，
下游 stage 即读到新知识。不需要额外机制，全程在 AIDLC 工作流内完成。

## 5. 手动工具入口

确定性的那一半可以单独用：

```bash
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts check                        # 环境自检
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts validate --repo-path <repo>  # 校验现有知识库
bun <harness-dir>/tools/aidlc-ai-ready-gen.ts test                         # vendor 测试套件（需 pytest）
bun <harness-dir>/tools/aidlc-codekb-adapter.ts --repo-path <repo> --output-dir <codekb>
```

刻意**没有 `generate` 子命令**。生成是 LLM 依 `INSTRUCTIONS.md` 干的活；本工具保证的是
「生成完的东西过没过门」，不替你生成。

## 6. 筑底 stage 没触发时的排查

按此顺序查：

1. **绿地项目** —— 设计上就永不触发。
2. **scope 落在四档之外** —— 最常见的原因。`bugfix`、`refactor`、`infra`、
   `security-patch`、`poc`、`poc-accelerator-cde` 全都不含这个 stage。用
   `bun <harness-dir>/tools/aidlc-utility.ts status` 查当前 scope，并参考 §4 显式钉
   `--scope`。
3. **用了 composed scope** —— 如果你对 scope offer 回了 "compose"，由 composer 的
   EXECUTE/SKIP 网格决定，筑底 stage 不保证在里面。
4. **`.ai-ready/` 已存在且有效** —— 这是正常的、会被记录的 skip。
5. **插件是否 composed 且启用** —— `plugin-list` 看选择集；`doctor` 报每插件的启用
   stage 数以及 composer 记录的任何 drop。

## 7. 目录结构

```
plugins/knowledge-plugin/
├── .aidlc-plugin/plugin.json         # 插件声明 —— name / version / contributes
├── CONTRACT.md                       # 设计与集成契约（含客户背景）
├── stages/inception/
│   └── knowledge-plugin-bootstrap.md # 唯一的新 stage
├── contributions/                    # 对 4 个核心 stage 的增量修改
│   ├── inception/reverse-engineering.md          # Step 3a —— adapter 覆盖
│   └── construction/{functional-design,code-generation,build-and-test}.md
├── knowledge/
│   ├── kem-lite.md                   # 回写格式的完整定义
│   ├── senior-review-checklist.md    # senior 逐条签字清单
│   └── config-channel.md             # docs-input/ 的操作规则
├── tools/
│   ├── aidlc-ai-ready-gen.ts         # python 校验半边的 TS 薄壳
│   ├── aidlc-codekb-adapter.ts       # .ai-ready/ → 9 文件 codekb 的映射实现
│   └── vendor/repo-to-ddd/           # 收编的 s_repo-to-ddd（见 VENDORED.md）
└── tests/adapter.test.ts             # adapter 契约测试（fixture 驱动）
```

vendored 引擎搭在 `tools/` 下面，是因为 packager 只投射一个内容目录白名单——放在插件
根的 `vendor/` 永远到不了宿主。（`CONTRACT.md` §6 仍把它画在插件根，DRAFT 的那一处已
过时。）

## 8. 一期范围与已知限制

明确**不在**一期范围（[`CONTRACT.md`](CONTRACT.md) §8）：

| 不做 | 原因 |
| --- | --- |
| cultivation 治理自动化（daemon / decay / health 评分） | 一期知识量小，人工 gate 即最好的质量控制；且该引擎绑定 SwarmAI 宿主。 |
| tree-sitter AST 符号级精度 | 引入即拖入 SwarmAI backend 依赖。一期用可分发形态：LLM 在文件 / 模块 / 路由级提取，由 python fail-closed 门保住下限。 |
| behavioral-equivalence（spec ↔ 运行时行为验证） | 上游本身尚未接 runtime。 |

如实的精度声明：一期**不含** AST 级提取。对于知识大头在配置态和文档里的代码库，这个
形态基本无损——那部分知识本来就不是 AST 能读的。

待办项记在 [`CONTRACT.md`](CONTRACT.md) §10，包括 vendor 基准 commit、`docs-input/`
的最终位置，以及收编代码的上游知会。

收编溯源：`s_repo-to-ddd` 取自 SwarmAI VERSION 1.27.0（2026-07-24 快照），2026-07-26
收编。完整记录与本地改动清单见
[`tools/vendor/repo-to-ddd/VENDORED.md`](tools/vendor/repo-to-ddd/VENDORED.md)。

## 9. 测试本插件

```bash
bun test plugins/knowledge-plugin/tests/adapter.test.ts
```

测试用 fixture `.ai-ready/` 驱动 adapter，断言 CONTRACT §3 的各项义务：9 个产物全部
写出、每个都带 `generated-by` 文件头、`component-inventory.md` 里有带锚点的规则和如实
的 `unverified` 标记、重跑幂等无残档、`.ai-ready/` 缺失时 `exit 0` + `native RE
applies`、必需文件缺失或 `code-intel.json` 版本低于 2 时 fail-closed `exit 1` 并点名
缺口。

测试运行器会自动发现 `plugins/*/tests/`，所以这些测试跑在 integration 层：
`bash tests/run-tests.sh --integration`。

## 参见

- [`CONTRACT.md`](CONTRACT.md) —— 设计与集成契约，含客户背景
- [Plugin Mechanism](../../docs/reference/18-plugin-mechanism.md) —— 插件机制的规范性设计
- [Authoring a Plugin](../../docs/harness-engineering/10-authoring-a-plugin.md) —— 插件编写指南
- [Brownfield knowledge](../../core/knowledge/aidlc-shared/brownfield.md) —— 核心原生的棕地处理
