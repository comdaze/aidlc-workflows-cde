# Robust, Portable PoC Code

Good code is readable, defensive, and portable — three aspects of one goal:
code the customer's engineers can pick up, understand, run in their own
account, and extend without a rewrite. In CDE work the deliverable lands
directly in a customer non-production environment, so these qualities are not
polish; they are what the customer judges first at handoff.

## 1. Readability and style

Readability is the cheapest quality lever. The habits that matter:

- **Comments explain why, not what.** `# increment i` is noise.
  `# the market clears half-hourly, so we round to the same boundary` records
  a fact the reader cannot recover from code alone.
- **No commented-out dead code.** Delete it; git remembers.
- **No unused imports.** The linter sensor flags these.
- **One casing convention per language.** snake_case for Python, camelCase
  for TypeScript.
- **No magic numbers.** `SECONDS_PER_DAY = 86400` beats a bare `86400`; the
  constant's name is documentation.

Run `ruff`/`black` (Python) or `eslint`/`prettier` (TypeScript) before every
review gate — the framework's linter and type-check sensors fire on workspace
code, but they only catch the mechanical half. Naming and why-comments are
judgment; that half is on the author.

## 2. Error handling at external boundaries

Every call that leaves your code — DynamoDB, Bedrock, a third-party API — can
fail. A PoC that ignores this crashes during the customer demo and leaks
internals in the response. Three rules at every external boundary:

1. **Wrap external calls** (`try/except`, `try/catch`), one call per
   clearly-named function, so the failure message can say *which* dependency
   failed (generation vs. persistence), not just that something did.
2. **Return safe, specific error messages.** Raw exceptions carry table ARNs,
   account IDs, file paths, and stack traces. Log the full detail server-side
   (CloudWatch); return the caller a message that is specific ("item not
   found", "email field is required") without exposing system internals.
   Vague ("something went wrong") is as bad as leaky.
3. **Don't let async failures vanish.** Work consumed off a queue has nowhere
   to surface errors. Attach a dead-letter queue in the CDK definition
   (`deadLetterQueue: { queue, maxReceiveCount: 3 }` on the SQS event source)
   so after N failed attempts the message lands somewhere visible and
   re-processable instead of disappearing.

Centralize the boundary in one decorator/middleware rather than repeating
try/except boilerplate in every route: catch what escapes the handler, map
known exceptions to proper HTTP status codes, emit a metric with the error
type. Handlers then read as business logic; the defensive layer is written
once and applied everywhere. This also gives the demo basic failure-rate
visibility without extra infrastructure.

## 3. Portability

The customer stands the PoC up in their own account — often three of them.
The test: **could someone deploy this to a different account and region by
editing configuration only, without touching source or CDK code?**

No tool catches a portability defect. A hardcoded account ID is valid code,
lints clean, and passes every security scan; it only fails at deploy time in
the customer's account — exactly at the handoff moment. Two habits prevent
it:

1. **Externalize everything that changes between environments.** Resource
   name prefixes, instance sizes, CIDR ranges, model IDs → `cdk.json` context
   or a typed props/config file. The deployer never reads source to discover
   what is configurable.
2. **Never write down the deploy-time account or region.** The toolchain
   already knows them from the credential chain: `Stack.of(this).account` and
   `Stack.of(this).region` in CDK constructs, `AWS::AccountId` /
   `AWS::Region` pseudo-parameters in raw CloudFormation. Config holds values
   that genuinely differ by environment; account/region come from the tool.

This matters double for this plugin's China-partition reality: an ARN
assembled with a hardcoded `arn:aws:` prefix breaks in `aws-cn`. Build ARNs
with `Stack.of(this).partition` (or `Arn.format`) so the same stack deploys
to both partitions.

## PoC-specific guidance

- The step-6 test evidence should include one invalid-input case proving the
  safe-error-message behavior, and the smoke test in step 7 must not leak
  internals in its recorded output.
- The step-8 demo package's launch steps are the portability proof: if they
  require editing source to point at the demo account, the portability test
  failed — fix it before handoff, not in the extension recommendations.
- Right-size the ceremony: a one-slice PoC does not need a config framework —
  a single typed config module and one error-handling decorator are enough.
  What it can never have is a hardcoded account ID or a bare stack trace in
  an HTTP response.
