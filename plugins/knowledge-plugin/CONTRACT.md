# knowledge-plugin — 设计与集成契约

> **本文档的用途**:顺丰 AIDLC 共建项目中,"知识工程插件"(knowledge-plugin)的
> 设计说明与模块间集成契约。它同时是给新加入同事的 context 文档——不需要
> 前置背景即可读懂。
>
> Status: DRAFT v0.1 · 2026-07-26 · owner: peipeihe

---

## 第一部分:背景(没跟过这个项目的人从这里读)

### 1.1 客户与项目是什么

顺丰科技在大规模推进 AI 研发提效(CIO 刘谭仁的年度重点)。上海峰会后,CIO 指定
**办公研发组**(为人力资源/财务/审计等部门开发内部系统,如人资 ERP)作为试点团队,
与 AWS 开展 AIDLC 共建:**选一个真实项目/模块,AWS 工程师实际参与,几周内跑出
能上线的成果 + 一套可复制的做法**。

客户的核心痛点(客户自己的原话归纳,来自 7 月的多轮沟通):

| # | 痛点(客户原话) | 本质 |
|---|---|---|
| Q1 | "为什么 5 个人不能变 1 个人?" | 组织与知识共享——一个模块 5 个研发各用各的 AI,知识不互通 |
| Q2 | "会做,但写不出那篇作文" | 知识显性化——老员工会做,但写不出 AI 能读懂的领域知识;ERP 存量逻辑深,代码里读不全 |
| Q3 | "好的实践没沉淀下来,效能就没提上来" | 知识沉淀——各人 skill/prompt 散落,做完不总结 |
| Q4 | "越快越乱——核心功能控不住,不敢上" | 质量与信心——AI 生成快但质量失控,核心系统不敢用 AI 上线 |

时间约束:客户明确只给 **约两个月窗口**,希望看到实操结果而非方法论交流。

### 1.2 我们手里的两个技术资产

**资产一:AIDLC v2 workflows**(awslabs 官方开源,github.com/awslabs/aidlc-workflows,v2 分支,GA)

AI-DLC 方法论的多 harness 实现:5 阶段 32 stage 的**软件开发全流程编排**
(Initialization → Ideation → Inception → Construction → Operation),14 个
agent 角色分工,**每个 stage 有人工审批 gate**,审计日志,支持 Claude Code /
Kiro(IDE+CLI)/ Codex / opencode。可按 scope 裁剪(mvp/poc/feature/enterprise 等
9 档)。它回答的是:**"AI 干活时,流程怎么规范、人怎么把关"**——直接对应客户的 Q4
(质量门控、敢上线)和 Q1 的一半(gate 审批人分配 = 角色重定义)。

对我们重要的两个机制:
- **`reverse-engineering` stage**(inception 阶段,brownfield 条件触发):把存量代码
  逆向成 9 个 markdown 文档,写入 `codekb/<repo>/` 目录;下游 5 个 stage(需求分析、
  应用设计、功能设计、代码生成等)读这个目录获得上下文。**产物是浅层的**
  (概览级),这是它的短板,也是我们的插入点。
- **官方 plugin 机制**(参考实现 `plugins/test-pro`):第三方可以打包
  stages/overlay/agents/knowledge/tools 成插件,**不改 v2 核心代码**就能增强工作流。
  插件卸载 = 回到原生 v2。

**资产二:SwarmAI 的知识工程引擎**(王小刚老师的个人项目,github.com/xg-gh-25/SwarmAI)

小刚老师(AWS 中国区研发团队)在内部实践 AI-native 转型中沉淀的一套系统。与本项目
直接相关的是其中的 **`s_repo-to-ddd` skill**:输入任意代码库(+文档),输出一套让
AI(和人)真正理解该项目的结构化知识:

```
<repo>/AGENTS.md                    ← AI 的入口文档(≤150 行)
<repo>/.ai-ready/
  ├── PRODUCT.md                    ← 为什么:目的/受众/边界
  ├── TECH.md                       ← 怎么做:架构/约定/技术栈
  ├── IMPROVEMENT.md                ← 学到的:坑/失败/模式
  ├── PROJECT.md                    ← 现在:优先级/决策/阻塞
  ├── code-intel.json               ← 机器可读:模块/依赖/路由/入口
  ├── REVIEW-REPORT.md              ← 给人看的:评分/缺口/审核分工
  └── spec-details/<domain>.spec.md ← 每个业务域的深度规格:业务规则+代码锚点
```

它的核心思想(也是差异化价值):**每条 AI 生成的知识断言必须带代码锚点
(file:line)和 verified 标记;无锚点的标为"LLM 推断、未验证",绝不冒充事实;
生成末尾有 fail-closed 校验门(锚点核算/断言守卫/引用完整性),不过就整体失败。**
这直接回答客户 Q2(把"作文"从代码和文档里提取出来,而不是让人写)和 Q3 的基础
(知识有了统一的结构化存放地)。

已核实的工程事实(2026-07 读代码验证,非听说):
- `scripts/ai_ready_helpers.py` 约 4000 行,校验门控真实在调用链上;自带约 4000 行测试
- **零第三方依赖,纯 Python 标准库**——刻意设计为可分发
- SwarmAI 对自己跑出过完整产物(11 个 spec-details),dog-food 过
- 结构提取在**可分发形态下由 LLM agent 依 INSTRUCTIONS 执行**(文件/模块/路由级);
  SwarmAI 宿主里另有 tree-sitter AST 引擎(符号级),但那套绑定其 backend,不随 skill 分发

### 1.3 为什么要融合(而不是二选一)

两个资产恰好是**同一闭环的两半**,各自缺对方:

- v2 有流程和 gate,但 reverse-engineering 产物浅——AI 在深水区(ERP 存量逻辑)
  拿不到够用的领域知识 → 客户 Q2/Q3 没答案;
- 小刚引擎产出深度知识,但它不管"知识之后怎么规范地干活"——没有流程 gate、
  审批、审计 → 客户 Q4/Q1 没答案。

融合后的完整闭环:

```
【逆向筑底】小刚引擎:代码+文档 → 带锚点、senior 签字的领域知识(.ai-ready/)
      │
      ▼
【正向跑通】AIDLC v2:真实需求 → story → 设计 → 代码 → 测试 → 上线
            (每个 gate 客户角色审批;下游 stage 消费上面的知识)
      │
      ▼
【沉淀回流】跑需求中的纠偏/教训 → 结构化写回 IMPROVEMENT.md
            → v2 的 RE stage 重跑时自动吸收 → 下一个需求更快
            (= 知识飞轮的第一圈,一期由人推,二期才自动化)
```

这也正是客户 7/21 会上自己描述的理想:"先设计理想 pipeline 倒推"、"一层层的
markdown(product/tech/improve)"、"规范公告出去、gatekeeper 守门"。

### 1.4 融合的工程形态(一句话)

**做一个 v2 插件(knowledge-plugin),把小刚的 s_repo-to-ddd 收编(vendor)进插件,
用一个文件级 adapter 把它的产物翻译成 v2 reverse-engineering stage 的 codekb 格式。**
三个代码库互不修改:

| 代码库 | 动不动 | 角色 |
|---|---|---|
| awslabs/aidlc-workflows | **不改** | 流程骨架,纯安装使用,可随上游升级 |
| xg-gh-25/SwarmAI | **不改** | 只收编其 s_repo-to-ddd skill(带版本戳),记录在 VENDORED.md |
| **本 repo(aidlc-workflows-cde)** | 所有改动在这里 | `plugins/knowledge-plugin/` 一个目录装下全部 |

可插拔由两级机制保证(不靠纪律):插件卸载 → 纯 v2;插件装了但 `.ai-ready/`
不存在 → adapter 静默退出,v2 原生 RE 照跑。

---

## 第二部分:契约(开发的人从这里读)

> 插件内部分两个模块,可并行开发,只在本契约汇合:
> - **模块 P(plugin/adapter)**:插件骨架、overlay、adapter 工具、测试
> - **模块 V(vendor/知识产物)**:s_repo-to-ddd 收编、顺丰适配、senior 审核流程
>
> 模块 P 只依赖 §2 的 `.ai-ready/` 格式(可用 fixture 开发);
> 模块 V 只依赖 SwarmAI 源码 + 客户模块访问权。互不阻塞。

### 2. `.ai-ready/` 产物契约(模块 V 的输出 = adapter 的输入)

位置:`<repo>/.ai-ready/`(+ 仓库根 `AGENTS.md`)。adapter 消费的必需集:

| 文件 | 必需 | adapter 消费的关键内容 |
|---|---|---|
| `PRODUCT.md` | ✅ | 目的/受众/边界 |
| `TECH.md` | ✅ | 架构/约定/技术栈 |
| `IMPROVEMENT.md` | ✅ | gotchas/patterns + KEM-lite entries(§5) |
| `PROJECT.md` | ✅ | 当前优先级/决策 |
| `code-intel.json` | ✅ | 见 §2.1 |
| `REVIEW-REPORT.md` | ✅ | 评分/缺口 |
| `ai-ready.json` | ✅ | 版本/生成时间 |
| `spec-details/<domain>.spec.md` | ⭕ 至少 1 个 | 业务规则+锚点(深度差异化的来源) |
| `BLIND-SPOTS.md` | ⭕ 若生成 | 未覆盖风险 |

#### 2.1 code-intel.json 必需字段子集(adapter 只依赖这些,其余字段忽略)

```jsonc
{
  "version": ">=2",        // 数值比较,勿用字符串等值(v2→v3 是 2.0 字符串→3.0 数值)
  "repo": {},
  "modules": [],           // → code-structure / dependencies
  "routes": [],            // → api-documentation(v3 时含稳定 id)
  "entry_points": [],
  "dependencies": {},
  "domains": [],           // v3 可选;有则 component-inventory 按业务域分组
  "packages": []           // 可选;monorepo 时消费
}
```

adapter 对缺失的**可选**字段静默降级;对缺失的**必需**字段报错退出(fail-closed,
与上游门控哲学一致——宁可失败也不产出静默残缺的知识)。

#### 2.2 spec-details 的 section 依赖(依 vendor 模板的 9 节结构)

adapter 与审核流程依赖其中三节:
- `## 4. Core Business Rules`——每条规则须带 `anchor`(代码或文档位置)+ `verified` 标
- `## 8. Coverage & Known Gaps`——如实的覆盖声明(哪些没看到、依据什么)
- `## 9. Traceability Matrix`

人工确认过的内容以 `[human]` 行内标记(与 §5 同一约定;senior 签字的痕迹)。

### 3. codekb 映射表(adapter 的输出 = v2 下游 stage 的输入)

输出位置:v2 运行时由
`bun {{HARNESS_DIR}}/tools/aidlc-utility.ts codekb-path --repo <repo>` 打印的目录
(`aidlc/spaces/<active-space>/codekb/<repo>/`)。9 文件全部生成(这是 v2 RE stage
的 produces 契约,少一个下游会缺档):

| # | codekb 文件 | 来源 | 规则 |
|---|---|---|---|
| 1 | `business-overview.md` | PRODUCT.md + PROJECT.md 摘录 | 保留原文,文件头加 `generated-by: knowledge-plugin` |
| 2 | `architecture.md` | TECH.md 架构节 + code-intel modules 顶层分组 | |
| 3 | `code-structure.md` | code-intel modules[] | 目录树 + 每模块一行职责 |
| 4 | `api-documentation.md` | code-intel routes[] / entry_points[] | method + path + file:line 表格 |
| 5 | `component-inventory.md` | domains[](有则)+ spec-details 索引 | **深度差异化点**:每个业务域附核心业务规则(带锚点)+ 指向对应 spec-details 文件的链接 |
| 6 | `technology-stack.md` | TECH.md 技术栈节 | |
| 7 | `dependencies.md` | code-intel dependencies | 内部/外部依赖两节 |
| 8 | `code-quality-assessment.md` | REVIEW-REPORT.md + BLIND-SPOTS.md | **覆盖缺口如实照录,不粉饰**(可信度来自诚实) |
| 9 | `reverse-engineering-timestamp.md` | ai-ready.json 生成时间 + adapter 运行时间 | v2 靠它判断 freshness,过期触发重跑(飞轮的读侧入口) |

行为约定:
- adapter **幂等**:重跑覆盖 9 文件,不追加、不留残档。
- `.ai-ready/` 不存在 → exit 0 并输出 `not present, native RE applies`
  (= 可插拔开关的下半:没筑底时 v2 原生 RE 照常工作)。

### 4. 顺丰配置态/BPM 的文档通道(模块 V 的关键适配)

背景:顺丰人资系统"很多是配置性的,本身没大研发"(客户原话)——业务规则大量
存在于配置、BPM 流程、飞书文档,而非代码。纯代码提取会漏掉最重要的知识。

- **输入**:客户提供的飞书文档/配置导出/BPM 流程说明,统一放
  `<repo>/docs-input/`(位置暂定,模块 V 确定后回填此处)。
- **提取**:作为 s_repo-to-ddd 生成阶段的补充语料;产出的规则写入 spec-details
  `## 4`,anchor 指向文档位置(格式 `docs-input/xxx.md#L12` 或标题锚),
  `verified` 由 senior 审核后置 true。
- **覆盖声明**:纯配置无代码的部分,在 `## 8` 与 BLIND-SPOTS.md 中如实标注
  "未经代码验证,依据文档 + 人工确认"。

### 5. KEM-lite 写回格式(沉淀回流的载体)

> KEM(Knowledge Entry Model)是小刚设计中"一条知识 = 一个可寻址对象"的数据模型。
> 一期用其字段子集(故称 KEM-lite),人工审批写回;二期若引入 cultivation 自动化,
> 这些 entry 零迁移直接可用——这是现在就约定格式的原因。

写回目标:`<repo>/.ai-ready/IMPROVEMENT.md` 对应 section 追加。格式:

```markdown
- [pitfall] 工资项 X 的舍入规则与文档不符,以代码为准 — anchor: src/salary/calc.py:L88
  <!-- kem: type=pitfall | date=2026-08-05 | source=gate:code-generation | verified=human -->
```

- `type` ∈ {pitfall, decision, guideline, correction}(小刚 7 型分类的一期子集)
- `source` = 产生此条的 v2 gate/stage 名
- **触发点**(overlay 挂载):functional-design / code-generation / build-and-test
  三个 stage 的 learnings 环节;**gate 驳回理由是最高优先的 entry 来源**
  (人明确说"不对,应该是 X"的时刻,就是知识产生的时刻)
- 写回前须人批准(propose-approve,绝不静默写)——一期中"人"即整个审批环节

回流闭环:写回后,下一个需求开跑时 v2 的 RE stage 因 freshness 重跑
→ adapter 重新生成 codekb → 下游 stage 读到新知识。**飞轮第一圈由此闭合,全程
在 v2 工作流内,无需额外机制。**

### 6. 插件目录与模块归属(repo: aidlc-workflows-cde, branch: feature/knowledge-plugin)

```
plugins/knowledge-plugin/
├── .aidlc-plugin/plugin.json        # 模块P:插件声明(仿 test-pro)
├── contributions/                    # 模块P:对 v2 现有 stage 的 overlay 注入
│   ├── inception/reverse-engineering.md      # 调用 gen 工具 + adapter
│   └── construction/{functional-design,code-generation,build-and-test}.md  # KEM-lite 写回
├── tools/                            # 模块P
│   ├── aidlc-ai-ready-gen.ts        # TS 薄壳:spawn python3 跑 vendor 脚本
│   └── aidlc-codekb-adapter.ts      # 本契约 §3 的实现
├── vendor/repo-to-ddd/              # 模块V:s_repo-to-ddd 收编
│   ├── scripts/{ai_ready_helpers.py, test_ai_ready_helpers.py, __init__.py}
│   ├── templates/domain-spec.md.tmpl
│   ├── INSTRUCTIONS.md
│   └── VENDORED.md                  # 源 repo + commit + 收编日期 + 本地改动清单
├── knowledge/                        # 模块V:方法论文档
│   ├── kem-lite.md                  # §5 格式的完整定义
│   ├── senior-review-checklist.md   # senior 审核 spec-details 的清单
│   └── config-channel.md            # §4 文档通道的操作规则
└── tests/                            # 模块P:adapter 测试(fixture .ai-ready/)
                                      # 模块V:vendor 测试跑绿(收编质量底线)
```

环境依赖:客户环境需 **python3**(vendor 脚本零三方依赖,仅标准库,已核实)
+ **bun**(v2 本身的要求)。

### 7. 提取精度声明(如实,防止过度承诺)

一期使用 s_repo-to-ddd 的**可分发形态**:结构由 LLM agent 依 INSTRUCTIONS 提取
(文件/模块/路由级,grep 辅助),经 `ai_ready_helpers.py` 的 fail-closed 门控保证
下限。**不含** SwarmAI 宿主的 tree-sitter AST 层(符号级精度)。

- 对顺丰场景,这个形态**基本无损甚至更合适**:客户的知识大头在配置态/文档(§4),
  本来就不是 AST 能读的;LLM 提取 + 锚点门控的架构天然覆盖。
- AST 层为**二期可选升级**;升级封闭在 vendor 目录内部,本契约的接口不变。

### 8. 明确不在一期范围(防 scope 蔓延)

| 不做 | 原因 | 何时再议 |
|---|---|---|
| cultivation 治理自动化(daemon/decay/health 评分) | 一期知识量小,人工 gate 即最好的质量控制;且该引擎绑定 SwarmAI 宿主 | 二期,知识条目上量后 |
| behavioral-equivalence(spec↔运行时行为验证) | 上游本身未接 runtime(代码注释自认 consumer API) | 上游 wire 后 |
| tree-sitter AST 精度 | §7;引入即拖入 SwarmAI backend 依赖 | 二期,若客户有大型标准代码库诉求 |
| Agent 网络/统一工作台 | 客户四层构想的上两层;先证明底下两层(知识+pipeline)能转 | 试点成功后 |

### 9. 一期里程碑(对齐客户两个月窗口的前半)

| 周 | 交付 | 客户侧配合 |
|---|---|---|
| W1 筑底 | 目标模块的 `.ai-ready/` 全套 + senior 审核签字 | 1-2 名 senior,每天约 1 小时审核 |
| W2 接入 | v2(Kiro harness)在客户环境跑通 + plugin 装载 + gate 审批人映射表 | PMO 定各 gate 审批人 |
| W3 跑真需求 | 1 个真实需求走完 v2 全流程并上线 | 该模块 1-2 名开发全程参与 |
| W4 回流+复盘 | 第 2 个需求验证知识复用;量化数据(时长/返工/senior 投入)复盘 | 复盘会 |

成功判据(提前与客户钉死):① 真实需求经 AI 流程上线,senior 只审批未写代码;
② 第 2 个需求明显快于第 1 个(证明沉淀→复用成立);③ 一套留在顺丰的资产
(spec-details + 审批角色表 + SOP)。

### 10. 待办回填

- [ ] 模块 V 的 owner
- [ ] vendor 基准 commit(收编时的 SwarmAI 版本戳)
- [ ] docs-input/ 实际位置与格式(§4)
- [ ] 顺丰目标模块名(客户现场共创时定)
- [ ] 知会小刚老师(收编其个人项目代码的礼节与 license 确认;顺带问配置态
      提取他是否已有方案,避免重复造)
