#!/usr/bin/env bash
# Re-vendor the four authored tools from the plugin into this hub repo.
# Usage: ./sync-from-plugin.sh /path/to/aidlc-workflows-cde
#
# One implementation, two sides (VENDORED.md). A hand-edit here is reverted by
# the next sync, so fix things upstream in the plugin instead.
set -euo pipefail

repo="${1:-}"
if [[ -z "$repo" ]]; then
  echo "usage: $0 /path/to/aidlc-workflows-cde" >&2
  exit 2
fi

src="$repo/plugins/team-knowledge/tools"
if [[ ! -d "$src" ]]; then
  echo "not a team-knowledge checkout: $src does not exist" >&2
  exit 2
fi

here="$(cd "$(dirname "$0")" && pwd)"
for file in aidlc-akp-cards.ts aidlc-akp-validate.ts aidlc-akp-registry.ts aidlc-akp-lifecycle.ts; do
  cp "$src/$file" "$here/$file"
  echo "vendored $file"
done

commit="$(git -C "$repo" rev-parse --short HEAD 2>/dev/null || echo unknown)"
version="$(
  python3 - "$repo/plugins/team-knowledge/.aidlc-plugin/plugin.json" <<'PY' 2>/dev/null || echo unknown
import json, sys
print(json.load(open(sys.argv[1]))["version"])
PY
)"
cat > "$here/VENDOR-STAMP.txt" <<EOF
source:  $repo
commit:  $commit
plugin:  team-knowledge $version
synced:  $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
echo "wrote VENDOR-STAMP.txt (commit $commit, plugin $version) — commit it"
