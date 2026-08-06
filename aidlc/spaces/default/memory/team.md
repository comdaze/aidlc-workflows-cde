# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

<!-- Affirmed during practices-discovery. Example: -->
<!-- We use GitHub Flow with feature branches. Branches live 3-5 days max. -->
<!-- Hotfixes branch from main and merge back via expedited review. -->

## Walking Skeleton

<!-- Affirmed during practices-discovery. Example: -->
<!-- We don't run a walking skeleton — our deployment pipeline is mature -->
<!-- and the slice cost outweighs the value at our maturity stage. -->

## Testing Posture

<!-- Affirmed during practices-discovery. Example: -->
<!-- We use BDD. Specifications drive scenarios; scenarios drive code. -->
<!-- Each Unit ships with feature files in /features/. -->

- Name a defensive test for the condition it checks, not for a theory about when that condition can arise. A guard whose name asserts an impossible precondition stops being read as a live constraint: `set-autonomy` hard-fails on a missing state field, and its test was labelled the "v4 legacy state file" guard — so a freshly generated file hitting that exact branch went unexamined for as long as the label held. General; applies to any defensive branch. (learned 2026-08-06) <!-- cid:vibe-session:c10 -->
- Where a template is the contract, assert the generator against it, not only the fixtures. Comparing a fixture to its template proves nothing about the code that writes the real artifact: fixtures authored from a template agree with it forever while the generator disagrees with both. Measured — the missing generator-to-template edge let a documented state-file field go unwritten in every scope. General; applies wherever a template, schema, or golden file is claimed as a contract. (learned 2026-08-06) <!-- cid:vibe-session:c11 -->
- Asserting that a document contains a command is not asserting that the command works. Prose assertions are legitimate for prose — wording, presence of a rationale — but must never stand in for behavioural coverage of what the document instructs. Measured: a stage file's self-described load-bearing command satisfied a `toContain` check while failing at runtime, for the field it was supposed to set. General. (learned 2026-08-06) <!-- cid:vibe-session:c12 -->
- Do not put a wall-clock budget in a setup hook: it makes the suite's green a function of machine load rather than of correctness. Two tests here fail intermittently with "a beforeEach/afterEach hook timed out" against an unnamed test — a `beforeAll` that spawns builds under a fixed timeout. Every assertion passes in every run; only the lifecycle clock loses. That is precisely why such a failure survives indefinitely as "a known flake": it never points at a broken claim, so re-running until green feels justified. Derive the budget from the work, or retry the hook. General. (learned 2026-08-06) <!-- cid:vibe-session:c20 -->
## Deployment

<!-- Affirmed during practices-discovery. -->

## Code Style

<!-- Team-specific conventions beyond the linter. Example: -->
<!-- - Prefer named exports over default exports -->
<!-- - All async functions return Result<T, E>, never throw -->

## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->

## Tooling and Diagnostics
- A file's location can give it a role its author never declared — check what the HOST does with a directory, not only what our framework reads from it. Kiro treats both `.md` and `.json` under `.kiro/agents/` as agent configs, so a persona file intended purely as a stage prompt became a selectable picker entry in its own right; two filename stems produced two entries, and the one without `resources` or tool settings was the more discoverable of the two. Nothing reported a problem, because at the file level nothing was wrong. General: applies to any directory a host tool scans by convention. (learned 2026-08-06) <!-- cid:vibe-session:c3 -->
- A remediation message must name the case its reader will actually hit, not only the case the author had in mind. A compose drop advised "collides with an existing file (core or another plugin) — rename it to a plugin-namespaced path", but the file it collided with was the plugin's own previously-composed copy, which every plugin author hits on every edit; renaming the source would have been exactly the wrong fix. Diagnosing correctly means comparing against the tool's own prior output, not merely observing that a file exists. General. (learned 2026-08-06) <!-- cid:vibe-session:c6 -->
