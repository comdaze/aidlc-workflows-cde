# CI/CD Practices for Customer Environments

Supplements the framework's CI/CD patterns knowledge with the practices CDE
work in customer environments depends on. The PoC itself deploys manually
through CDK by design; these practices govern how you read the customer's
existing delivery machinery and what the extension recommendations point at.

## Read the existing pipeline first

Before adding or changing anything in a repo you did not create, read its
workflow files (`.github/workflows/*.yml`, `buildspec.yml`, pipeline CDK).
They tell you what the team trusts to ship code — and what they don't. A
missing test or security stage is information about the project before you
write a line; note it, don't silently "fix" it.

## Pipeline credentials

- **Use OIDC, not long-lived AWS keys, for CI auth.** Short-lived tokens via
  the CI system's identity federation (`aws-actions/configure-aws-credentials`
  with a role ARN on GitHub Actions; CodeBuild uses its service role natively)
  are the modern pattern.
- Long-lived access keys stored in CI secrets are a security finding to flag
  when you encounter them, not a pattern to copy.
- Scope the assumed role to the pipeline's actual needs — not administrator
  access with a pipeline attached.

## IaC delivery

- **Every resource is defined in IaC** — Terraform, CloudFormation, or CDK.
  In a brownfield estate, use whichever the customer already uses; do not
  introduce a new IaC tool because you prefer it. (This plugin's greenfield
  PoC standardizes on TypeScript CDK for speed — a scope decision, not a
  license to switch tools in the customer's existing stacks.)
- **IaC deploys belong in a pipeline, not on a laptop** — in production.
  Static scan first (cfn-lint/cfn-guard or the IaC MCP server for
  CloudFormation/CDK, Checkov or tfsec for Terraform), then plan/diff, then
  apply on merge, using the same OIDC pattern as the application pipeline.
  The PoC's manual `cdk deploy` is the time-boxed exception; the extension
  recommendations name the pipeline as production work.
- **State**: Terraform state lives in a remote backend (S3 + locking) —
  never on a developer machine. CloudFormation and CDK keep state in the AWS
  account itself.
- **Every infra change is a commit.** `git log` and `git blame` answer "why
  does this resource exist?" six months later; console-created infrastructure
  erases that history before it is written.
- **App code and infra code have different lifecycles.** App PRs are routine;
  infra PRs need the plan/diff output reviewed alongside the code diff — a
  bad app deploy degrades a service, a bad apply can take down an environment.

## GitOps

GitOps puts the **desired state of an environment in a git repo**, and a
controller **inside the environment** reconciles actual state to it. It is
not Kubernetes-specific: Argo CD and Flux apply the pattern to clusters;
Atlantis and Terraform Cloud apply it to IaC.

- CI never holds credentials to the live system — it only writes to git; the
  in-environment controller pulls.
- Drift is detected and reverted by the controller; deploy history is
  `git log`.
- When you join a project using this pattern, find the gitops repo first, and
  make changes through it — a direct deploy around the controller is drift
  that will be reverted. This is why step 3 checks for pipeline/GitOps
  ownership of the target account before any direct `cdk deploy`.
