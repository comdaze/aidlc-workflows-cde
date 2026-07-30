# VENDORED — s_repo-to-ddd

此目录收编自王小刚(gawan)的个人项目 SwarmAI 的 `s_repo-to-ddd` skill。
收编(vendor)而非引用的原因:交付客户环境需自包含、版本锁定、可本地适配。
上游演进不自动影响本插件;择优回灌时更新本文件。

| 项 | 值 |
|---|---|
| 源 repo | https://github.com/xg-gh-25/SwarmAI |
| 源路径 | `backend/skills/s_repo-to-ddd/` |
| 收编基准 | SwarmAI-main 快照,VERSION 1.27.0(2026-07-24 下载) |
| 收编日期 | 2026-07-26 |
| 收编人 | peipeihe |
| 上游知会 | ☐ 待办——知会小刚老师(礼节 + license 确认) |

## 收编内容

```
scripts/ai_ready_helpers.py        # 生成/校验引擎(fail-closed 门控),纯标准库
scripts/test_ai_ready_helpers.py   # 上游测试套件
scripts/test_local_deviations.py   # ★ 本地新增,非上游:本地改动的回归测试
scripts/__init__.py
templates/domain-spec.md.tmpl      # ⚠ 死模板,渲染器不读它 — 见下方「模板状态」
INSTRUCTIONS.md                    # LLM agent 的生成流程指令(GENERATE 各步)
SKILL.md                           # skill 门面(触发词/说明)
```

### 模板状态:`templates/domain-spec.md.tmpl` 是死模板(CraftAI 实战测试 L3)

**渲染器不读它。** spec-details 由 `project_domain_skeleton()` /
`_render_domain_skeleton_body()` 纯字符串拼出,是 **8 节中文结构**;而这份模板是
**9 节英文结构**(含 `§9 Traceability Matrix`、`{{RULE_ID}}` 占位符、
`verify_traceability` 覆盖门)。两者互不引用。

保留原因:它对应 legacy/SQL 那条路径(`domain_rules` manifest +
`compute_business_rules_dimension` 的 traceability 计分),二期若接那条路径会用到。

**读它的人请注意:spec-details 不会长成模板那样。** 章节号对照表在
`knowledge/config-channel.md`。把模板当成实际结构去写 spec 或写审核清单,会
写错位置——这正是 L2 的成因。

**未收编**:`install.sh`(那是把 skill 装进 Claude Code/Kiro 当独立 skill 用的;
本插件的宿主是 AIDLC v2 的 plugin 机制,安装由 v2 composer 管)。
**未收编**:SwarmAI 宿主的 tree-sitter AST 层(`backend/core/code_intel/parser.py`
等)——绑定其 backend(SQLite/FTS5/native 依赖),见 CONTRACT §7 精度声明。

## 收编时测试基线(2026-07-26,python3 -m pytest)

**240 passed / 8 failed / 3 skipped**

8 个失败全部因 `ModuleNotFoundError: No module named 'core' / 'code_intel'`——
这些测试导入 SwarmAI 宿主的 backend 模块(真实 exporter 对拍、宿主 recall 联测),
**在宿主之外必然失败,属预期的宿主耦合边界,非收编缺陷**:

```
TestGenerationWriteReadLoop::test_generate_then_recall_domain      (宿主 recall)
TestSpecDetailsIndexRow::*  (3 个)                                  (宿主 DDD index)
TestValidatorMatchesRealExporter::* (3 个)                          (宿主 json_exporter 对拍)
TestEquivalenceLayer::test_e2e_on_real_swarmai_domains              (宿主真实产物)
```

插件 CI 跑 vendor 测试时应 deselect 上述 8 项(见 tests/ 的运行脚本);
其余 240 项是本插件依赖的行为契约,必须全绿。

## 本地改动清单(相对上游,逐条记录)

来源:CraftAI 首次实战测试(2026-07-29,Kiro IDE,brownfield 519 文件仓库)。
报告见 `docs/aidlc-knowledge-plugin-bootstrap-test-report.md`(被测项目侧)。
14 项发现中,以下是落到 vendor 内的修复;每处代码都带
`LOCAL DEVIATION (CraftAI field test <id>)` 注释,便于回灌时定位。

**这批修复的共同形状:全部是「报告成功、内容为空或为错」的静默错误。** 静默错误
比报错危险——一个不够怀疑的 agent 会把空产物直接交给人类审核。所以每一条都配了
回归测试,而不是只改代码:静默回归在绿色的测试运行里是看不见的。

| # | 日期 | 文件 | 改动 | 原因(实战证据) |
|---|---|---|---|---|
| C1 | 2026-07-29 | `scripts/ai_ready_helpers.py` | 新增 `_render_domain_business_rules()`;§5 渲染域级 `business_rules` + 总数/verified/unverified 计数行(置于 `[human]` 桩之上) | §5 原本只渲染 `[human]` 空桩,域级 `business_rules` 在 8 个 section 里一处都不出现。实测 107 条规则、0 条可见,senior 拿到的是**空白签字表**,而完成摘要报的「107 条」在产物中无从核对。**这直接否掉插件立意** |
| C1b | 2026-07-29 | 同上 | `regenerate_spec_preserving_human()` 只丢弃 stub 行(新增 `_SPEC_HUMAN_STUB_RE`),不再丢弃整个 §5 body | C1 的连带修复。原逻辑「§5 只保留 HTML 注释、其余全丢」在 §5 只有 stub 时是对的;一旦 §5 有了机器渲染的规则,人只要加一条 `[human]` 就会把机器规则全删——保护功能变成数据丢失 bug |
| C2 | 2026-07-29 | 同上 | `blind_spot_scan()`:声明了 `risk_areas`/`hot_zones` 但无一条带 `file_path` 时 `raise ValueError`,不再返回 `clean:True` | 两处 `if not fp: continue` 会跳过全部条目。字段名写成 `file` 时返回「零盲点」,与「真的没有盲点」在输出上**不可区分**——而这是全流程唯一的反向覆盖检查。实测:6 条 risk_areas(含 2 critical)+ 6 条 hot_zones,报零盲点;修正字段名后真实结果是 12 跨度 / 9 已覆盖 / **3 盲点**。做法与 `extract_entry_anchors` 的 LOUD-on-empty 同构(那里已做对) |
| H3 | 2026-07-29 | 同上 | `check_llm_assertion_guards()` 增加断言文本守卫(必须有非空 `rule`/`cond`/`case`);`_fmt_assertion_row()` 无文本时渲染 `⚠ NO RULE TEXT` 而非空串 | 文本键写成 `statement` 时,assertion guards / `finalize_v3` / `validate_code_intel_json` **全部通过**,但渲染出 `\| 业务规则 \|  (anchor: ...) \|`——有锚点、没内容,门全绿。与该函数既有的「plain-string / 缺 verified 即未裁决」把关同源 |
| H4 | 2026-07-29 | 同上 | 新增 `_fmt_line_range()` + `_LINE_RANGE_STR_RE`;接受 `[start,end]` / `"start-end"` / `"start"` / int,其余 raise。`_render_domain_skeleton_body` 改用它 | `lr[0]`/`lr[1]` 无类型守卫,字符串被逐字符索引。实测三例:`"88-102"→8-8`、`"71-87"→7-1`、`"206-247"→2-0`。产出**看似合法、实则指错行**的锚点,能通过只校验文件部分的 `check_business_rule_anchor_files`,然后误导人工审核——恰是 senior 清单要防的错误,但**由框架产生而非 LLM 产生** |
| M1 | 2026-07-29 | 同上 | 内层闭包 `_file_of` 提升为模块级 `_anchor_file_part()`;`blind_spot_scan` 用它剥掉 rule anchor 的行号 | `documented_files.add(anchor)` 加的是 `src/x.py:42`,永远不等于 `steps[].file_path` 的 `src/x.py`。docstring 承诺「documented iff step **或** business_rule anchor 覆盖」,实际 rule 锚点那一半从不命中,盲点数被系统性高估 |
| M2 | 2026-07-29 | 同上 | 新增 `_business_rules_dimension_from_domains()`;`compute_business_rules_dimension()` 在 legacy `domain_rules` 缺失时回退到 `domains[].business_rules`(计 coverage + anchored);legacy 路径不变,两条路径都补 `source`/`anchored` 字段 | 该维度只键 legacy/SQL 的 `domain_rules` 层,而本插件产物的规则在 `domains[].business_rules`。结果:**唯一衡量本插件核心价值的评分维度,在它面向的任何仓库上永远 N/A**,且 detail 文案断言「non-legacy/non-SQL repo has no business rules to extract」——实测 107 条规则、95 条带锚点,这句话不成立 |
| M3 | 2026-07-29 | 同上 | `select_verification_tasks()` 增加 `_is_discriminative()`:排除 bulk 提交(≥50 个源文件,或 >30% 全量源文件;≤3 文件恒保留) | 压平历史仓库(客户交付常见)里,一次触碰全仓库的提交不具区分度:`correct_file` 退化成字母序第一个。实测 2 提交仓库返回 2 个退化任务,恰好越过 INSTRUCTIONS「少于 2 个任务则跳过 VERIFY」的阈值,让隔离式 VERIFY 对着噪声跑 |
| M4 | 2026-07-29 | `INSTRUCTIONS.md` | Level 3 热区排序补回退链:fix-commit → import 扇入 → 文件行数;并要求在 REVIEW-REPORT 声明所用依据 | `parse_git_gotchas` 在压平/浅历史上返回 `[]`,而 Level 3 是 MANDATORY,原文只认 fix-commit 计数,拿不到信号就没有输入 |
| M3b | 2026-07-29 | `INSTRUCTIONS.md` | Step 5.1 补充:bulk 提交已被拒 → 压平历史常得 0 任务;此时**手写 3-4 个任务**,保持子 agent 只读产物的隔离,并在 REVIEW-REPORT 声明任务系手写 | 配合 M3。隔离式 VERIFY 是本流程价值最高的步骤之一(实测抓到两处跨文档矛盾),不能因为拿不到 git 任务就整段跳过 |
| — | 2026-07-29 | `INSTRUCTIONS.md` | 字段形状显式化:`line_range` 是 LIST;断言文本键只读 `rule`/`cond`/`case`;`risk_areas`/`hot_zones` 的字段是 `file_path` 不是 `file`;域级规则渲染进 §5 | H3/H4/C2/C1 的成因都是「LLM 写了另一个字段名,门全绿」。守卫治果,文档治因 |
| — | 2026-07-29 | `scripts/test_local_deviations.py` | **新增文件**(非上游):上述每条一个测试类,47 项 | 见下方「为什么测试单独放一个文件」 |

> 规则:任何本地改动必须登记在上表,并优先考虑是否该回馈上游。
> 上述 C1 / C2 / H3 / H4 / M1 / M2 **都是上游同样存在的缺陷**,不是宿主适配,
> 回灌价值高;知会小刚老师时建议一并提。

### 为什么本地测试单独放一个文件

`test_ai_ready_helpers.py` 是上游的套件,回灌/刷新时会被**整体替换**;而上述修复
必须落在上游的 `ai_ready_helpers.py` 里(bug 就在那儿)。所以刷新 vendor 时有
真实风险把修复静默改回去。测试放在 `test_local_deviations.py`(上游没有这个文件,
刷新不会覆盖它),刷新后第一次 `aidlc-ai-ready-gen.ts test` 就会红——而不是安静地
退回到「报告成功、内容为空」。

## 在插件内跑 vendor 测试

```bash
# 默认 python3;pytest 装在别的解释器时用 AIDLC_PYTHON 指定
AIDLC_PYTHON=python3.12 bun ../../aidlc-ai-ready-gen.ts test   # (从本目录) 或在插件根: bun tools/aidlc-ai-ready-gen.ts test
# 预期:287 passed, 3 skipped, 8 deselected
#   = 上游 240 + 本地 47;宿主耦合的 8 项自动排除
```

`test` 子命令同时跑两个文件(`test_ai_ready_helpers.py` + `test_local_deviations.py`),
两个都必须绿。

## 回灌 / 刷新 vendor 的流程

1. 下载新的上游快照,只替换 `scripts/ai_ready_helpers.py`、
   `scripts/test_ai_ready_helpers.py`、`INSTRUCTIONS.md`、`SKILL.md`、`templates/`。
   **不要动** `scripts/test_local_deviations.py`。
2. 跑 `bun tools/aidlc-ai-ready-gen.ts test`。上游套件应全绿;
   `test_local_deviations.py` 的失败项 = 被新快照覆盖掉的本地修复。
3. 对每个失败项:先查上游是否已自行修好(修好了就从上表移除该行,
   并在这里记一句「上游 vX 已修」);没修好则重新施加,注释保持
   `LOCAL DEVIATION (CraftAI field test <id>)` 格式。
4. 更新上方「收编基准」的版本戳与本文件的日期。
