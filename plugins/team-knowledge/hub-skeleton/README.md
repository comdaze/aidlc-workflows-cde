**English** | 中文见下

# Team Knowledge Hub

A shared, git-versioned bundle of **team-level knowledge**: rules the team has
confirmed, domain facts with their evidence, and the reasoning behind decisions —
in [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).

Deposits arrive from AI-DLC workflows through the `team-knowledge` plugin's
`team-knowledge-push` stage; projects consume them through `team-knowledge-pull`.
Nothing here requires that plugin, though: the bundle is plain Markdown with YAML
frontmatter, readable with `cat` and reviewable with `git diff`.

## What is in here, and what is deliberately not

| In | Out |
|---|---|
| team-level rules that passed a project's learning ritual | anything project-specific (`project.md` rules are structurally excluded from the export surface) |
| domain facts, graded and dated, with the evidence that proved them | stage journals, audit logs, sensor evidence |
| industry packs, whole, with provenance | customer identifiers, account IDs, endpoints, credentials, unmasked samples |
| the reasoning and the cost of a decision | anything nobody confirmed |

## An honest declaration about the sanitization boundary

The CI gate scans every file — **frontmatter included** — against the deny
patterns in `policy/lifecycle.json`. Those patterns catch *shapes*: access keys,
twelve-digit account numbers, internal hostnames, private key headers.

They cannot catch a sentence that is confidential because of **who said it**, and
a read boundary cannot stop a capable agent inferring an excluded fact from the
evidence around it. So the deny patterns are a **backstop, not the gate**. The
gate is `cde.sanitization.by` — a named human who approved that this specific
content may leave the delivery site. If that name is absent, the card does not
merge. If the name is there and the content should not have travelled, that is a
human accountability question, which is the only kind of question it could ever
have been.

## How to consume it

```bash
# The index is COMPUTED, never committed — there is no registry.json to go stale.
bun tools/gen-registry.ts --markdown --query "<topic>"
bun tools/gen-registry.ts --markdown --type Practice --tags aws

# Read the handful of cards you actually want. Do not read the bundle.
cat practices/<topic>/<card>.md
```

Three signals on every card decide how much weight it carries:

- **`trust_tier`** (derived) — `unverified` / `machine-confirmed` /
  `human-reviewed`, from whether any `verified[].by` is a `human:` actor.
- **stale** (derived) — `today >= stale_after`. A stale card has lost its
  *default* authority, not its content: re-confirm it with a named human before
  relying on it.
- **`cde.generalization`** — `industry-generic` travels as written;
  `needs-recalibration` means the reasoning travels and the numbers do not.

## How to contribute

1. Branch: `knowledge/<yyyy-mm-dd>-<topic-slug>`. Never commit to the default
   branch; never force-push.
2. **One card, one file.** This is what keeps two projects depositing in the same
   week from conflicting, and what makes a lifecycle change a single-file
   `git mv` and a trace a single-file `git blame`.
3. Run the gate locally before you push — it is the same code CI runs:
   ```bash
   bun tools/validate-cards.ts
   ```
4. Open a merge request. A CODEOWNER reviews and merges. **Merging is the only
   authoritative write in this repository**, and only a human does it.

### Correcting a card

A correction is a **new card**, not an edit: the replacement carries
`cde.supersedes: <old concept ID>`, the old card flips to `status: deprecated`
with a markdown link forward, and **both land in the same merge request**. Split
across two, the tree spends time holding a card that is superseded and still
reads as authoritative — and someone will read it in that window. The gate
rejects the split. The old file is never moved or deleted: `deprecated` already
means "kept for links and history, no longer current", and moving it would break
the inbound links the trace depends on.

### The freshness clock is arithmetic

`stale_after = max(verified[].at) + half_life(type/topic)` from
`policy/lifecycle.json`. The gate recomputes it with **zero** days of tolerance,
so re-affirming a card is two edits in one MR — append a `verified` event *and*
move `stale_after` — and a hand-typed distant date is rejected, not believed.

## Automation, and its hard limit

| Cadence | Job | Output |
|---|---|---|
| every MR | `validate-cards.ts` | fail-closed gate on both verdict classes |
| weekly | `review-debt.ts` | one standing issue: cards due or disputed, grouped by CODEOWNERS |
| weekly | `carry-affirmations.ts` | a bot MR carrying spoke affirmations into `verified` + the clock |
| monthly | `propose-archive.ts` | a bot MR proposing archival for cards stale past the grace window |

**A bot may open a merge request. A bot may never merge one.** `main` is
protected, direct pushes are disabled, and the bot token's reach ends at opening
a branch and an MR — so every automated action is itself in the git audit trail.
Jobs are proposal-shaped and silent when there is nothing to do: no diff, no
commit, no issue churn.

One limit stated plainly: the gate catches only **exact** duplicates of a card's
`# 规则` text. Two teams wording the same lesson differently will both be
admitted. CODEOWNERS review is the only defence against that, and no amount of
tooling changes it.

## Layout

```text
index.md                          # bundle root — the only index.md declaring okf_version
log.md                            # generated from git history
README.md                         # this file
practices/<topic>/*.md            # type: Practice        → team.md rules
knowledge/domains/<domain>/*.md    # type: Domain Knowledge
knowledge/aws/*.md                 #   shortest half-life in the policy
knowledge/engineering/*.md
packs/<pack>/pack.md               # type: Knowledge Pack (+ index.md as its manifest)
references/                        # mirrored external material (OKF §6.3)
feedback/<project>/<date>.json     # JSON, not Markdown — see below
policy/lifecycle.json              # half-lives, grace window, deny patterns, controlled tags
tools/                             # the gate and the scheduled jobs
CODEOWNERS                         # admission responsibility == review responsibility
```

`feedback/` is JSON on purpose. An OKF bundle requires every non-reserved `.md`
to be a concept with a `type`; feedback is a machine-consumed operational record,
not knowledge, and as a concept it would pollute the knowledge graph.

A `disputed` feedback entry does **not** deprecate anything — a falsification
claim can itself be wrong. It puts the card first in the review list, in red; the
correction is still a human opening a successor card.

---

# 团队知识库（中文）

一个用 git 管理的**团队级知识**共享库：团队已确认的规则、带证据的领域事实、以及
决策背后的理由，格式为 OKF v0.2。

- **有什么**：过了学习仪式的团队级规则、已确认且分级过的领域知识、整包的行业知识。
- **没有什么**：项目专属规则（`project.md` 层在结构上就不在导出面）、阶段日记、
  审计与传感器证据、任何客户标识与未脱敏样本。
- **怎么读**：`bun tools/gen-registry.ts --markdown --query <主题>` 现算索引，
  再只读你要的那几张卡。索引不入库，因此不存在"忘了重新生成"这一类静默失败。
- **怎么写**：一卡一文件；本地先跑 `bun tools/validate-cards.ts`（与 CI 同一份
  代码）；开分支 + MR，由 CODEOWNER 评审合入 —— **合入是本库唯一的权威写入点**。
- **怎么改**：修正 = 新卡 + 旧卡翻 `deprecated` + 指向后继的链接，**必须同一个
  MR**。拆成两个 MR 会留下"已被取代却仍标 stable"的中间态，而这个中间态一定会被
  人读到。
- **新鲜度是算术**：`stale_after = max(verified[].at) + 半衰期`，校验器零容差反算。
  复审 = 追加一条 `verified` + 前移 `stale_after`，两处改动同一个 MR。
- **脱敏边界**：deny pattern 只认"形状"（AK、12 位账号、内网域名），认不出"因为
  谁说的所以机密"。它是兜底，不是门；门是 `cde.sanitization.by` 里那个具名的人。
- **自动化的边界**：bot 可以开 MR，永不合 MR；机器只做精确去重，近似重复只能靠
  CODEOWNERS 人工评审。
