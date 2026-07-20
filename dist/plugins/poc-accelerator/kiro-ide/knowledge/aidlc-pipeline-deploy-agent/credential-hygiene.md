# Credential Hygiene in Customer Engagements

The secret-scanning tooling and leak response (rotate → revoke → purge) live
in the framework's devsecops pipeline knowledge; this file carries the
human-credential discipline CDE work needs day to day.

## Human AWS credentials

- **Prefer short-lived credentials over long-lived access keys.** IAM
  Identity Center (SSO) + assume-role gives per-person identity in audit
  logs and credentials that expire on their own. Long-lived `AKIA` keys are
  the riskiest common pattern in AWS.
- **Treat any long-lived key found on disk as also existing somewhere else**
  (a laptop backup, a chat paste, a CI secret). The response is rotation, not
  just deletion of the copy you found.

## Anti-patterns to recognize on sight

Each of these should stop you to check before moving on:

- `AKIA`-prefixed strings in code or config
- `sk_live_` and similar provider live keys
- Hardcoded production database URLs
- `.env` files shared through chat or shared drives — a local `.env` is
  workable; *sharing* it is the anti-pattern. The replacement is a secrets
  manager (Secrets Manager, SSM Parameter Store) so secrets are fetched
  per-person, audited, and revocable.

Flag what you find factually and follow the playbook's customer security
boundaries rule: work safely inside the existing pattern, put the migration
on the extension recommendations, and when unsure raise it before acting.
