// aidlc-sensor-poc-accelerator-team-knowledge-preflight.ts — ADVISORY
// team-knowledge preflight gate (poc-accelerator plugin).
//
// Reads poc-accelerator-team-knowledge-preflight.md (written by step 01) and
// verifies its fenced `yaml` preflight block records a probed team-knowledge
// git repository URL plus a machine-readable resolution: a matched pack
// import, or a search that found no match. There is no skip resolution — the
// repository is a required input, and step 08 pushes the PoC's knowledge
// harvest back to the same URL. ADVISORY (no blocking severity in the
// framework yet). Needs only the --output-path the dispatcher always passes.
// Shipped to the harness tools dir via the plugin's contributes.tools.
import { existsSync, readFileSync } from "node:fs";

// Self-contained — no import of the framework's aidlc-lib (a plugin tool ships
// in its own delta and must not depend on a sibling core tool being present).
const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const ARTIFACT_FILENAME = "poc-accelerator-team-knowledge-preflight.md";
const RESOLUTIONS = ["pack-imported", "no-pack-match"] as const;
type Resolution = (typeof RESOLUTIONS)[number];
const URL_SOURCES = ["memory-layer", "user-provided"] as const;
// Whether the team-knowledge plugin's card tools were on hand for this run.
// See the delegation block in checkPreflight: recorded only when the step used
// them, and never required.
const CARD_TOOLING = ["available", "absent"] as const;
const PROBE_OK = "git-ls-remote-ok";
const GIT_SCHEMES = ["https", "http", "ssh", "git", "file"];

interface Result {
  pass: boolean;
  findings_count: number;
  findings: string[];
  resolution: string;
}

interface Flags {
  stage?: string;
  outputPath?: string;
}

function parseFlags(argv: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stage") out.stage = argv[++i];
    else if (argv[i] === "--output-path") out.outputPath = argv[++i];
  }
  return out;
}

function fail(msg: string): never {
  process.stderr.write(`aidlc-sensor-poc-accelerator-team-knowledge-preflight: ${msg}\n`);
  process.exit(1);
}

// Pass-through when the sensor fired on a write it doesn't own (the dispatcher
// fires on EVERY write under the record dir, not just the preflight artifact).
function passThrough(): never {
  process.stdout.write(
    `${JSON.stringify({ pass: true, findings_count: 0, findings: [], resolution: "not-applicable" })}\n`,
  );
  process.exit(0);
}

// Extract the LAST fenced yaml block whose first non-blank line is
// `preflight:`. Last wins so an inline example earlier in the record cannot
// shadow the authoritative block the stage appends at the end.
function extractPreflightBlock(content: string): string | null {
  let found: string | null = null;
  for (const m of content.matchAll(/^```yaml[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)) {
    const body = m[1];
    const firstLine = body.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
    if (firstLine.trim() === "preflight:") found = body;
  }
  return found;
}

// Scalar read: `  key: value` at any indent inside the block. First match wins.
function blockScalar(block: string, key: string): string {
  const m = block.match(new RegExp(`^[ \\t]+${key}:[ \\t]*(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

// List read: `  key:` followed by `- item` lines at the key's indent or
// deeper (YAML allows both). Empty when absent.
function blockList(block: string, key: string): string[] {
  const m = block.match(new RegExp(`^([ \\t]+)${key}:[ \\t]*\\r?\\n((?:\\1[ \\t]*- .*\\r?\\n?)*)`, "m"));
  if (!m) return [];
  return [...m[2].matchAll(/^\s+- (.+)$/gm)]
    .map((x) => x[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"))
    .filter((v) => v !== "");
}

// Whether a key is present at all. An empty list is present; an absent key is not.
function hasKey(block: string, key: string): boolean {
  return new RegExp(`^[ \\t]+${key}:`, "m").test(block);
}

// Git remote shape, offline. Accepts what git accepts as a fetch/push URL:
// a supported scheme with a host and a path (`https://host/team/kb.git`,
// `ssh://git@host/team/kb`, `git://host/kb`, `file:///abs/path`) or the
// scp-like default clone form (`git@host:team/kb.git`). Rejects a bare local
// directory and a bare host — step 08 has to push a branch to this URL, so
// "somewhere on my laptop" is not a team knowledge repository.
function isGitRemoteUrl(url: string): boolean {
  if (url === "" || /\s/.test(url)) return false;
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (scheme) {
    const proto = (scheme[1] ?? "").toLowerCase();
    const rest = scheme[2] ?? "";
    if (!GIT_SCHEMES.includes(proto)) return false;
    // file:// carries no host — an absolute path is the whole locator.
    if (proto === "file") return rest.startsWith("/") && rest.length > 1;
    const slash = rest.indexOf("/");
    return slash > 0 && rest.slice(slash + 1).trim() !== "";
  }
  // scp-like `[user@]host:path`. The 2-char host floor rejects a Windows
  // drive letter (`C:/repos/kb`), which is a local directory, not a remote.
  const scp = url.match(/^(?:[^@:/\s]+@)?[^@:/\s]{2,}:(.+)$/);
  return scp !== null && (scp[1] ?? "").trim() !== "";
}

function checkPreflight(content: string): Result {
  const findings: string[] = [];
  const block = extractPreflightBlock(content);
  if (!block) {
    return {
      pass: false,
      findings_count: 1,
      findings: [
        `no fenced yaml block opening with "preflight:" found — the artifact must end with the machine-readable preflight record`,
      ],
      resolution: "missing",
    };
  }

  const resolution = blockScalar(block, "resolution");
  if (!RESOLUTIONS.includes(resolution as Resolution)) {
    findings.push(
      `resolution "${resolution || "(absent)"}" is not one of: ${RESOLUTIONS.join(", ")} — the team knowledge repository is required, so there is no skip resolution`,
    );
  }

  const repoUrl = blockScalar(block, "repo_url");
  if (repoUrl === "") {
    findings.push("repo_url is absent — record the team knowledge repository's git URL");
  } else if (!isGitRemoteUrl(repoUrl)) {
    findings.push(
      `repo_url "${repoUrl}" is not a git remote URL — expected https://, http://, ssh://, git://, file:///abs/path, or git@host:team/repo.git`,
    );
  }

  const probe = blockScalar(block, "repo_probe");
  if (probe !== PROBE_OK) {
    findings.push(
      `repo_probe "${probe || "(absent)"}" is not "${PROBE_OK}" — a failed or unrecorded \`git ls-remote\` is not a resolution`,
    );
  }

  const urlSource = blockScalar(block, "repo_url_source");
  if (urlSource !== "" && !URL_SOURCES.includes(urlSource as (typeof URL_SOURCES)[number])) {
    findings.push(`repo_url_source "${urlSource}" is not one of: ${URL_SOURCES.join(", ")}`);
  }

  if (blockList(block, "sources_searched").length === 0) {
    findings.push(
      "sources_searched is empty or absent — record every local seat and configured source that was searched",
    );
  }

  if (resolution === "pack-imported") {
    if (blockScalar(block, "pack") === "") findings.push("pack-imported requires a non-empty pack:");
    if (blockScalar(block, "import_path") === "") findings.push("pack-imported requires a non-empty import_path:");
  } else if (resolution === "no-pack-match") {
    if (blockList(block, "search_terms").length === 0) {
      findings.push("no-pack-match requires a non-empty search_terms: list — an unmatched search is still an auditable claim");
    }
  }

  // --- team-knowledge delegation, OPTIONAL by construction ---------------
  // When the team-knowledge plugin is installed, this step searches the hub
  // through its computed card index instead of grepping prose, and records which
  // OKF cards it imported. Those fields are checked ONLY when present, so a
  // record written without that plugin — or written before it existed — keeps
  // exactly the verdict it had before (poc-accelerator stays independently
  // installable; `dependencies` is not enforced by the composer today).
  const cardTooling = blockScalar(block, "card_tooling");
  if (cardTooling !== "" && !CARD_TOOLING.includes(cardTooling as (typeof CARD_TOOLING)[number])) {
    findings.push(`card_tooling "${cardTooling}" is not one of: ${CARD_TOOLING.join(", ")}`);
  }
  const cardsImported = blockList(block, "cards_imported");
  if (cardsImported.length > 0 && cardTooling !== "available") {
    findings.push(
      "cards_imported lists cards but card_tooling is not \"available\" — a card can only be imported through the team-knowledge tools, so this record claims something it could not have done",
    );
  }
  for (const card of cardsImported) {
    if (/\s/.test(card)) {
      findings.push(
        `cards_imported entry "${card}" is not a card concept ID — use the bundle-relative path without .md (e.g. practices/data-boundary/mock-data-synthesis)`,
      );
    }
  }
  if (hasKey(block, "cards_imported") && cardTooling === "") {
    findings.push("cards_imported is recorded without card_tooling: — say whether the team-knowledge tools were available");
  }

  return {
    pass: findings.length === 0,
    findings_count: findings.length,
    findings,
    resolution: resolution || "missing",
  };
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) fail("--output-path is required");
  if (!flags.outputPath.endsWith(ARTIFACT_FILENAME)) passThrough();
  if (!existsSync(flags.outputPath)) passThrough();

  let content: string;
  try {
    content = readFileSync(flags.outputPath, "utf-8");
  } catch (err) {
    fail(`failed to read ${flags.outputPath}: ${errorMessage(err)}`);
  }

  process.stdout.write(`${JSON.stringify(checkPreflight(content))}\n`);
}

main();
