---
target: reverse-engineering
plugin: knowledge-plugin
adds:
  produces:
    - deep-codekb-from-ai-ready
fragments:
  - anchor: after-step:3
    order: 100
---

## fragment: after-step:3

### Step 3a (knowledge-plugin): Deep codekb from .ai-ready/ (if present)

After the architect has written the 9 native artifacts, check whether this repo
carries a knowledge-engineering base:

```
ls <repo>/.ai-ready/ 2>/dev/null
```

**If `.ai-ready/` does NOT exist** — do nothing. The native 9 artifacts from
Step 3 stand as-is. (The deep knowledge base is produced by the
knowledge-plugin bootstrap flow — vendor/repo-to-ddd — typically run once per
repo with senior review before the first AIDLC intent. Absent that, native RE
is the honest baseline.)

**If `.ai-ready/` exists** — upgrade the codekb to the deep, anchored version:

1. Resolve the codekb directory (same tool, same contract as Step 3):

   ```
   bun {{HARNESS_DIR}}/tools/aidlc-utility.ts codekb-path --repo <repo>
   ```

2. Run the adapter, passing the repo root and the directory printed above:

   ```
   bun {{HARNESS_DIR}}/tools/aidlc-codekb-adapter.ts --repo-path <repo> --output-dir <codekb-dir>
   ```

   The adapter overwrites the 9 artifacts with versions derived from
   `.ai-ready/` (DDD 4-docs + code-intel.json + spec-details). It is
   idempotent and fail-closed: if `.ai-ready/` is structurally incomplete it
   exits non-zero and the run must surface the error — never silently keep a
   half-adapted codekb. On the `not present, native RE applies` output, keep
   the native artifacts.

3. Report in the completion summary (Step 5) which codekb variant this run
   produced — `native` or `deep (.ai-ready)` — and, for the deep variant:
   the count of domains, spec-details files, and **unverified business rules**
   (rules pending senior sign-off). Reviewers must know the knowledge tier
   they are approving on top of.

Why this exists: the native artifacts are overview-grade. The `.ai-ready/`
base carries per-domain business rules with code/doc anchors and human
sign-off markers — downstream stages (requirements-analysis, functional-design,
code-generation) consume the same 9 filenames but reason from a far deeper,
verifiable context. Removing this plugin (or deleting `.ai-ready/`) restores
native behavior exactly.
