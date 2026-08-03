# Fork-owned documentation

Everything in this directory is authored by **this fork** and has no upstream
counterpart. It lives here rather than in `docs/reference/` for one reason:
upstream `awslabs/aidlc-workflows` has no `docs/fork/` path, so nothing here can
ever produce a merge conflict.

| Document | What it covers |
| --- | --- |
| [Fork divergence](divergence.md) | Every deviation from upstream outside `plugins/`, why it exists, which rows are upstream-bound, the conflict-resolution recipe per logical change, and the upstream sync procedure. **Read §4 before merging upstream.** |
| [Kiro Spec integration boundary](kiro-spec-integration.md) | Measured limits of merging with Kiro's native Spec mode: the spec task triggers and their payloads, why `PreTaskExec` confers no veto, which integration shapes are viable, and the richer v2 hook channel the harness does not yet target |
| [research/](research/) | Raw captures backing the chapters above |

## Adding a document here

Two rules, both from `divergence.md` A6:

- **Do not number files.** `docs/reference/` numbering is upstream's namespace;
  a fork file called `19-*.md` collides the day upstream adds its own.
- **Do not index it from an upstream-owned file.** Add a row to the table above,
  not to `docs/reference/00-overview.md` or `zensical.toml`. Both belong to
  upstream, and a pointer to a chapter upstream does not ship is a line you
  re-resolve on every sync.

The trade is that these chapters are outside the published site's nav, because
the nav lives in an upstream file. Read them in the repository.
