---
okf_version: "0.2"
---

# Team Knowledge Hub

An OKF v0.2 bundle of team-level knowledge: confirmed rules, evidenced domain
facts, and the reasoning behind decisions. See `README.md` for how to consume it
and how to contribute; `policy/lifecycle.json` for the freshness policy.

This is the **only** `index.md` in the bundle that declares `okf_version`. A
nested `index.md` under `packs/<pack>/` is that pack's manifest, not the bundle
root — the CI gate enforces the distinction.

## Sections

- `practices/` — `type: Practice`. Rules that land in a project's `team.md`.
- `knowledge/domains/` — `type: Domain Knowledge`, per business domain.
- `knowledge/aws/` — platform knowledge. Shortest half-life in the policy (120
  days): availability and behaviour facts age fastest.
- `knowledge/engineering/` — cross-cutting engineering knowledge.
- `packs/` — `type: Knowledge Pack`. A coherent bundle for one industry.
- `references/` — mirrored external material (OKF §6.3).

## Reading order for a newcomer

1. `README.md` — the consumption and contribution contract, including the honest
   statement of where the sanitization boundary actually is.
2. `policy/lifecycle.json` — the half-lives, the grace window, the deny patterns.
3. `bun tools/gen-registry.ts --markdown` — the computed index of everything here.
