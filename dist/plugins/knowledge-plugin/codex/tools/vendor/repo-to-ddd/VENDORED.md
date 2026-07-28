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
scripts/__init__.py
templates/domain-spec.md.tmpl      # spec-details 9 节模板
INSTRUCTIONS.md                    # LLM agent 的生成流程指令(GENERATE 各步)
SKILL.md                           # skill 门面(触发词/说明)
```

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

| 日期 | 文件 | 改动 | 原因 |
|---|---|---|---|
| — | — | 无(纯收编,零改动) | — |

> 规则:任何本地改动必须登记在上表,并优先考虑是否该回馈上游。

## 在插件内跑 vendor 测试

```bash
# 默认 python3;pytest 装在别的解释器时用 AIDLC_PYTHON 指定
AIDLC_PYTHON=python3.12 bun ../../aidlc-ai-ready-gen.ts test   # (从本目录) 或在插件根: bun tools/aidlc-ai-ready-gen.ts test
# 预期:240 passed, 3 skipped, 8 deselected(宿主耦合项自动排除)
```
