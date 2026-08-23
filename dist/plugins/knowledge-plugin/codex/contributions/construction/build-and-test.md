---
target: build-and-test
plugin: knowledge-plugin
adds:
  produces:
    - kem-lite-writeback
fragments:
  - anchor: after-step:11
    order: 100
---

## fragment: after-step:11

### Step 11a (knowledge-plugin): KEM-lite knowledge write-back

Applies only when `<repo>/.ai-ready/` exists (knowledge-engineering base
present). Otherwise skip silently.

Before presenting the approval gate, collect **domain-knowledge candidates**
from this stage's run — per `{{HARNESS_DIR}}/knowledge/kem-lite.md`:

- test failures whose root cause was a **wrong assumption about the domain**
  (the knowledge base said/omitted X, reality is Y → `[pitfall]` with anchor
  to the code or test that proves Y);
- fragile areas discovered while making tests pass (→ `[guideline]`,
  e.g. "always run X before touching Y");
- gate rejection reasons from this stage's revision loops
  (→ `[correction]`/`[pitfall]`).

Filter test: *would this entry still hold if the team used a different tool
on this repo?* Yes → domain knowledge, propose it here. No → it belongs to
the v2 learnings/rules channel, not to the repo's knowledge base.

Present the candidates in the completion message for keep/drop. For kept
entries, append them to `<repo>/.ai-ready/IMPROVEMENT.md` in the KEM-lite
two-line format (see kem-lite.md), and state explicitly how many entries were
written. Never write without the user's keep decision; never modify or delete
existing content — append only.
