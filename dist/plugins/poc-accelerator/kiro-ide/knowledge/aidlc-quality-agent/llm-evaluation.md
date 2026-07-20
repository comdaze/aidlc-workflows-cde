# LLM Evaluation and Test Design for PoCs

## Test design categories

Coverage is necessary, not sufficient — a 100% report of happy-path tests
gives false confidence. The question is "would an auditor believe this
suite?" Design cases across five categories per feature: **core** (the happy
path), **edge** (unusual but valid inputs), **boundary** (limits: empty, max,
off-by-one), **error** (invalid inputs and failing dependencies), and
**security** (injection, authorization, data exposure). Use the language
community's standard framework (pytest, Vitest/Jest, JUnit) — a custom test
runner is a tax the next maintainer pays for nothing.

## LLM evaluation (evals)

LLM-driven behavior is non-deterministic: exact-match unit tests either fail
spuriously or get watered down until they assert nothing. **Eval LLM
endpoints; don't unit-test them.** The deterministic code *around* the LLM
call (prompt assembly, output parsing, guardrail logic, fallbacks) still gets
normal unit tests.

- **Build an eval set** of representative inputs with expected outcomes —
  drawn from the acceptance criteria and customer-calibrated examples, not
  invented convenience cases. Even 15–30 cases beat zero.
- **Pick a grader per case type**: exact match (closed answers), substring or
  regex (key facts present), numeric tolerance (predictions/scores),
  LLM-as-judge (open-ended quality — pin the judge model + prompt for
  reproducibility), behavioral (did the agent call the right tool with the
  right arguments).
- **Assert on aggregate accuracy** against a threshold (e.g. ≥ 90% of the
  eval set passes), not on individual cases — a single flipped case failing
  the build teaches teams to delete evals.
- **Grow the set from failures.** Every wrong answer in real usage becomes a
  new eval case; the set is the regression suite for non-deterministic code
  and compounds in value the longer it is maintained.
- Version the eval set with the code and hand it off with the PoC: it is what
  makes a later model or prompt swap safely evaluable (the cost analysis's
  two-way door for LLM components depends on it).
