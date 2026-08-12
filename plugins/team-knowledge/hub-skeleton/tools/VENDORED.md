# Vendored tools — one implementation, two sides

The hub gate and every spoke's pre-push self-check must be the **same** code
(CONTRACT §8.3). Two implementations that agree today will disagree the first
time one is fixed, and the failure is silent: a card that the spoke blessed and
the hub rejects, or worse, the reverse.

So the four authored files below are **vendored** from the plugin, not rewritten:

| file | authored at |
|---|---|
| `aidlc-akp-cards.ts` | `plugins/team-knowledge/tools/aidlc-akp-cards.ts` |
| `aidlc-akp-validate.ts` | `plugins/team-knowledge/tools/aidlc-akp-validate.ts` |
| `aidlc-akp-registry.ts` | `plugins/team-knowledge/tools/aidlc-akp-registry.ts` |
| `aidlc-akp-lifecycle.ts` | `plugins/team-knowledge/tools/aidlc-akp-lifecycle.ts` |

The five files named in CONTRACT §7.1 — `validate-cards.ts`, `gen-registry.ts`,
`review-debt.ts`, `carry-affirmations.ts`, `propose-archive.ts` — are thin
wrappers that call into them. They exist so the CI file and the README can name a
job by what it does rather than by which module it lives in.

## Syncing

```bash
./sync-from-plugin.sh /path/to/aidlc-workflows-cde
```

The script copies the four files and records the source commit in
`VENDOR-STAMP.txt`. Commit that stamp: it is how a reader six months from now
answers "which version of the gate rejected my card".

Do not hand-edit a vendored file. A fix belongs upstream in the plugin, followed
by a re-sync — otherwise the next sync silently reverts it, which is the same
divergence this arrangement exists to prevent.

## Requirements

[bun](https://bun.com) only. The tools import nothing outside the Node standard
library and each other — no YAML package, no framework library. That is
deliberate: the gate has to run in a bare CI image and inside a spoke's harness
without either one installing anything.
