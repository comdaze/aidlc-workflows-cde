# KEM-lite — 知识写回格式与规程

> KEM(Knowledge Entry Model)是"一条知识 = 一个可寻址对象"的数据模型(源自
> SwarmAI 的 DDD 设计)。一期用其字段子集(KEM-lite),**人工审批写回**;二期若
> 引入 cultivation 自动化,这些 entry 零迁移直接可用——这是现在就固定格式的原因。

## 什么时候写(触发点,按优先级)

1. **gate 驳回**(最高优先)——审批人 Request Changes 并给出理由的时刻,就是知识
   产生的时刻。驳回理由里"不对,应该是 X"的部分即候选 entry。
2. **stage learnings 环节**——v2 stage-protocol §13 的 learnings ritual 中,用户
   选择保留的、**与目标 repo 领域相关**的教训(与 AIDLC 工作流自身相关的教训走
   v2 原生 rules 通道,不写这里;判据:换一个工具做这个项目,这条教训还成立吗?
   成立 → 领域知识,写这里)。
3. **构建/测试阶段发现的与文档不符的行为**——代码实际行为与 spec/文档冲突且以
   代码为准的,记 pitfall。

## 写到哪

`<repo>/.ai-ready/IMPROVEMENT.md`,按 entry 类型追加到对应 section
(What Failed / What Worked / Known Issues / Gotchas——依该文件既有结构)。
若 repo 无 `.ai-ready/`(未筑底),本规程整体不适用——不要另创文件。

## 格式(每条两行)

```markdown
- [pitfall] 工资项 X 的舍入规则与文档不符,以代码实现为准(四舍六入五成双) — anchor: src/salary/calc.py:L88
  <!-- kem: type=pitfall | date=2026-08-05 | source=gate:code-generation | verified=human -->
```

字段规则:

| 字段 | 取值 | 说明 |
|---|---|---|
| 行首类型标签 | `[pitfall]` `[decision]` `[guideline]` `[correction]` | 小刚 7 型分类的一期子集:别这么做 / 我们选了A因为 / 应该这么做 / 纠正了一个错误认知 |
| 正文 | 一句话,自包含 | 换个人、换个会话读到也能懂;不写"如上所述" |
| `anchor` | `file:L行号` 或 `docs-input/xxx.md#锚` | 代码或文档位置;真没有锚点的判断类 entry 可省,但要慎重 |
| `type` | 同行首标签 | 机器可读冗余 |
| `date` | YYYY-MM-DD | 当天 |
| `source` | `gate:<stage>` 或 `learnings:<stage>` | 产生此条的环节 |
| `verified` | `human` | 一期恒为 human——写回前必经人批准 |

## 规程(propose-approve,绝不静默写)

1. 起草 entry(可多条),在 stage 的完成消息或 learnings 环节**展示给用户**;
2. 用户逐条 keep/drop(v2 的 learnings ritual 本身就是这个交互,复用它);
3. 仅 keep 的条目追加写入,写入动作在回复中明示("已写回 IMPROVEMENT.md 2 条");
4. 不修改、不删除既有内容——**只追加**(一期无 supersede;冲突时新 entry 用
   `[correction]` 指出旧认知错在哪,不动旧行)。

## 回流(写回之后发生什么)

下一个 intent 开跑 → reverse-engineering stage 因 freshness 重跑 → `.ai-ready/`
重新生成时吸收这些 entry(IMPROVEMENT.md 是生成输入之一)→ adapter 重出 codekb
→ 下游 stage 读到。**知识飞轮的第一圈,由此闭合。**
