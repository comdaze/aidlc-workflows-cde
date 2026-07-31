# Fork divergence from upstream `aidlc-workflows`

**What this is for.** This fork tracks `awslabs/aidlc-workflows` (branch `v2`).
Every upstream release is a merge, and a merge is only cheap if you know in
advance which files diverge and why. This is that list — the same discipline
`plugins/knowledge-plugin/tools/vendor/repo-to-ddd/VENDORED.md` applies to the
vendored engine, applied one level up to the fork itself.

**Read it as a checklist, not history.** Before an upstream sync, walk §2 and
decide each row. After a sync, run §4. §5 regenerates the whole table from git,
so re-derive rather than trust — the numbers below are a snapshot.

## 1. The shape of the problem

Divergence measured against the merge base with `github/v2`:

| Surface | Files changed by us | Conflict risk |
| --- | --- | --- |
| `plugins/` | 59 | **None.** Ours entirely; upstream has no such directory. |
| `docs/` | 7 | None in practice (new chapters + our own research notes). |
| `dist/` | 261 | **Not a conflict** — generated. Never merge it; regenerate (§3). |
| `core/` | 3 | Low. All three are small and policy-driven, not functional. |
| `harness/` | 6 | **One real risk**, the Kiro IDE adapter. See B1. |
| `tests/` | 1 | None — a new file. |

The plugin mechanism is doing its job: the majority of this fork's work lives in
`plugins/` and can never conflict. **Protect that property** — new CDE-specific
behaviour belongs in a plugin, not in `core/`. Anything that has to go outside
`plugins/` should be recorded here on the way in, not discovered at merge time.

## 2. The inventory

Ten files, but only **three logical changes**. Resolve by change, not by file.

### A1 — Replace `curl | bash` with a package-manager install (5 files)

| | |
| --- | --- |
| Files | `core/tools/aidlc-utility.ts` (doctor fix text) · `harness/{claude,codex,kiro,kiro-ide}/onboarding.fills.ts` (prereq bullet) |
| Class | **A — must diverge.** Internal policy: do not instruct users to pipe a network script into a shell. |
| Upstream | Optional suggestion, not a blocker. Upstream may well want it; not worth holding a sync for. |
| On conflict | Keep ours. The change is a self-contained string in each file; if upstream rewrites the surrounding text, re-apply the substitution rather than reverting their edit. |

Original upstream text, for recognition when re-applying:
`install via \`curl -fsSL https://bun.sh/install | bash\``.

### A2 — Inclusive-language fix in the security guide (1 file)

| | |
| --- | --- |
| File | `core/knowledge/aidlc-devsecops-agent/security-guide.md` — "whitelist URLs" → "validate against an approved allowlist" |
| Class | **A**, but a strong upstream candidate: uncontroversial, one line. |
| Upstream | **Offer it.** Cheapest possible contribution; removes a row from this table. |
| On conflict | Keep ours. |

### A3 — Framework version (1 file)

| | |
| --- | --- |
| File | `core/tools/aidlc-version.ts` |
| Class | **A — guaranteed conflict on every single upstream release.** |
| On conflict | Take upstream's number, then re-apply our patch level on top, and update `CHANGELOG.md` + the README badge in the same commit. `tests/unit/t68-version-changelog-sync.test.ts` pins all three agreeing, so a half-done resolution fails loudly. |

### B1 — Kiro IDE gate-render floor (4 files) — **upstream-bound**

| | |
| --- | --- |
| Files | `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` (+147) · `harness/kiro-ide/skills/aidlc/question-rendering.md` (+8) · `tests/unit/t219-kiro-ide-gate-render-floor.test.ts` (+230, new) · `docs/guide/harnesses/kiro-ide.md` |
| Commits | `fa2d9b63` (2.5.8), `fdb56a7a` (2.5.9) |
| Class | **B — should not be a fork divergence at all.** |

This is a general bug fix, not CDE-specific: the IDE gives the Stop hook no
transcript, so nothing verifies that an approval gate's options were actually
rendered in chat. Every Kiro IDE user of AI-DLC has this problem. Its own commit
message states "core remains byte-identical to upstream v2" — it was written to
be upstreamable.

**It is also the single highest-risk row in this table.** The merge base is
literally `ccf284b5 fix(kiro-ide): never read stdin in adapter entry paths` —
upstream actively edits this file. Every release we keep it local, we re-resolve
a 147-line conflict in the enforcement path.

**Upstreaming it is the highest-leverage action available on this table**, and it
gets harder every release. See §6 for the prepared submission.

## 3. `dist/` is generated — never merge it

261 files diverge and that is expected. The resolution is mechanical:

```bash
git checkout --ours dist/            # or --theirs; the content is discarded either way
bun scripts/package.ts               # regenerate from core/ + harness/ + plugins/
bun scripts/package.ts --check       # byte-parity gate: must print all trees in sync
```

Byte-parity is what makes this safe: a mis-resolved `dist/` cannot survive
`--check`. **Never hand-edit a `dist/` conflict hunk** — the result would be a
tree that no source produces, and the drift guard would fail CI on it anyway.

## 4. Upstream sync procedure

Do this **on a cadence, not on demand.** Resolving a 147-line conflict in the
enforcement spine under delivery pressure is how the fork breaks.

```bash
git fetch github
git switch -c sync/upstream-$(date +%Y%m%d)
git merge github/v2
#  resolve per §2 (by logical change), and per §3 for dist/
bun scripts/package.ts && bun scripts/package.ts --check
bash tests/run-tests.sh --ci
```

Then the step that is always forgotten:

**Check the compose drops.** Plugins splice contributions into core stage source
by slug and anchor. If upstream renames a stage or moves an anchor, the merge
succeeds, the tests pass, and the contribution **silently stops applying** —
compose records an advisory drop rather than failing. So after every sync, in a
scratch install:

```bash
bun <harness-dir>/tools/aidlc-utility.ts plugin-list
bun <harness-dir>/tools/aidlc-utility.ts doctor      # reports drops per plugin
```

Confirm each plugin's stage count and contribution sentinels are still there. A
green test suite does **not** cover this — the plugin content tests validate the
plugin against the framework's validators, not that its anchors still resolve in
the merged stage source.

Known pre-existing test failures, so a sync is not blamed for them: one assertion
in `tests/unit/gen-coverage-registry.test.ts` and one `beforeEach/afterEach` hook
timeout in `tests/integration/t188-plugin-compose.test.ts`. Both reproduce on a
clean tree with this fork's changes stashed.

## 5. Re-deriving this table

Do not trust the counts above; regenerate them.

```bash
B=$(git merge-base HEAD github/v2)

# which surfaces diverge, and by how much
git diff --name-only $B..HEAD | cut -d/ -f1 | sort | uniq -c | sort -rn

# the actual conflict surface: files BOTH sides changed
comm -12 \
  <(git diff --name-only $B..HEAD        -- core harness tests scripts | sort) \
  <(git diff --name-only $B..github/v2   -- core harness tests scripts | sort)
```

The second command is the one that matters. Anything it prints and this document
does not explain is an undocumented divergence — add a row.

## 6. Prepared upstream submission (B1)

The two local commits are **not** cherry-pickable as-is: both also bump
`core/tools/aidlc-version.ts` plus five `dist/*/tools/aidlc-version.ts` copies,
edit `CHANGELOG.md` and `README.md` (fork-specific), and `fa2d9b63` additionally
touches `plugins/poc-accelerator/tests/plugin.test.ts` — a plugin that does not
exist upstream, for an unrelated biome lint fix.

Hand-assemble instead. Take exactly four files onto a branch off `github/v2`:

```
harness/kiro-ide/hooks/aidlc-kiro-adapter.ts
harness/kiro-ide/skills/aidlc/question-rendering.md
tests/unit/t219-kiro-ide-gate-render-floor.test.ts
docs/guide/harnesses/kiro-ide.md
```

Then `bun scripts/package.ts` to regenerate `dist/kiro-ide/`, and leave the
version bump and CHANGELOG entry to upstream's own release process. Drop
everything else.

Once it lands upstream, delete row B1 from §2 and re-run §5 — the fork's
`harness/` divergence should fall to the four `onboarding.fills.ts` one-liners.
