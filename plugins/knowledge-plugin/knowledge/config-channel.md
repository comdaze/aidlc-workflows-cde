# 配置态/文档知识通道 — 非代码知识如何进入知识底座

> 背景:顺丰人资/财经类系统"很多是配置性的,本身没大研发"(客户原话)——大量
> 业务规则存在于配置、BPM 流程、飞书文档,而非代码。纯代码提取会漏掉最重要的
> 知识。本通道定义这类知识如何进入 `.ai-ready/`,以及如何诚实标注其验证等级。

## 输入约定

客户侧提供的非代码材料统一放入:

```
<repo>/docs-input/
├── README.md            # 材料清单:每份文件一行(来源/日期/负责人)
├── <业务文档>.md         # 飞书导出转 markdown(保留标题层级)
├── <BPM流程说明>.md      # 流程图配文字说明;图片附导出 PNG 也可,但规则要有文字版
└── <配置导出>.{json,csv} # 系统配置的结构化导出
```

规则:
- 能转 markdown 的转 markdown(锚点定位需要行号/标题锚);
- 每份材料在 README.md 登记来源与日期——**没有出处的材料不进通道**;
- 客户敏感信息(薪资数值、人员数据)脱敏后再入,这里只要规则不要数据。

## 提取与锚点

生成阶段(vendor INSTRUCTIONS.md 的 GENERATE),docs-input/ 作为补充语料参与:

- 提取出的规则写入 spec-details `## 4 Core Business Rules`;
- 锚点格式:`docs-input/<file>.md#<标题锚>` 或 `docs-input/<file>.md:L<行号>`;
- `verified` 初始一律 `false`——**文档说的 ≠ 系统真的这么跑**(文档会过时,
  配置会被改),必须经 senior 审核(见 senior-review-checklist.md)才置 true。

## 验证等级(写进覆盖声明,别混淆)

| 等级 | 含义 | 标注 |
|---|---|---|
| 代码验证 | 规则有代码锚点,行为可从代码确认 | anchor 指向代码,verified 按审核 |
| 文档+人工确认 | 规则来自文档,senior 确认现行有效 | anchor 指向 docs-input,`[human]` |
| 仅文档 | 来自文档,未经人确认 | `unverified`,列入 §8 缺口 |

spec-details `## 8 Coverage & Known Gaps` 必须写清三个等级各占多少——
**"依据文档 + 人工确认"和"代码验证"是两种可信度,不许混着算覆盖率。**

## 更新

配置/流程变更时,更新 docs-input/ 对应文件(改文件,不改 spec)→ 下次
reverse-engineering 重跑时重新提取。spec-details 里的 `[human]` 内容保留,
与新提取冲突的,以冲突形式呈现给 senior 再裁决,不静默覆盖。
