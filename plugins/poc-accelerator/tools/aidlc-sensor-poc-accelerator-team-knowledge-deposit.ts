// aidlc-sensor-poc-accelerator-team-knowledge-deposit.ts — ADVISORY
// team-knowledge deposit gate (poc-accelerator plugin).
//
// Reads poc-accelerator-team-knowledge-deposit.md (written by step 08) and
// verifies its fenced `yaml` deposit block records a probed team-knowledge git
// repository URL, a named sanitization approver, a non-empty entry list, and
// how the harvest was submitted: a merge request, a pushed branch awaiting
// one, or — when the push was refused — a prepared patch with a named owner
// and the blocking reason. There is no skip resolution: the deposit is owed
// whether or not step 01's preflight ran, which is why this check never reads
// the preflight record. ADVISORY (no blocking severity in the framework yet).
// Needs only the --output-path the dispatcher always passes. Shipped to the
// harness tools dir via the plugin's contributes.tools.
import { existsSync, readFileSync } from "node:fs";

// Self-contained — no import of the framework's aidlc-lib or of the sibling
// preflight sensor (a plugin tool ships in its own delta and must not depend
// on another tool being present next to it).
const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const ARTIFACT_FILENAME = "poc-accelerator-team-knowledge-deposit.md";
const RESOLUTIONS = ["merge-request-opened", "branch-pushed", "patch-prepared"] as const;
type Resolution = (typeof RESOLUTIONS)[number];
const URL_SOURCES = ["preflight-artifact", "memory-layer", "user-provided"] as const;
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
  process.stderr.write(`aidlc-sensor-poc-accelerator-team-knowledge-deposit: ${msg}\n`);
  process.exit(1);
}

// Pass-through when the sensor fired on a write it doesn't own (the dispatcher
// fires on EVERY write under the record dir, not just the deposit artifact).
function passThrough(): never {
  process.stdout.write(
    `${JSON.stringify({ pass: true, findings_count: 0, findings: [], resolution: "not-applicable" })}\n`,
  );
  process.exit(0);
}

// Extract the LAST fenced yaml block whose first non-blank line is `deposit:`.
// Last wins so an inline example earlier in the record cannot shadow the
// authoritative block the stage appends at the end.
function extractDepositBlock(content: string): string | null {
  let found: string | null = null;
  for (const m of content.matchAll(/^```yaml[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)) {
    const body = m[1];
    const firstLine = body.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
    if (firstLine.trim() === "deposit:") found = body;
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

// Git remote shape, offline. Accepts what git accepts as a fetch/push URL:
// a supported scheme with a host and a path (`https://host/team/kb.git`,
// `ssh://git@host/team/kb`, `git://host/kb`, `file:///abs/path`) or the
// scp-like default clone form (`git@host:team/kb.git`). Rejects a bare local
// directory and a bare host — a deposit nobody else can fetch is not a deposit.
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

function checkDeposit(content: string): Result {
  const findings: string[] = [];
  const block = extractDepositBlock(content);
  if (!block) {
    return {
      pass: false,
      findings_count: 1,
      findings: [
        `no fenced yaml block opening with "deposit:" found — the artifact must end with the machine-readable deposit record`,
      ],
      resolution: "missing",
    };
  }

  const resolution = blockScalar(block, "resolution");
  if (!RESOLUTIONS.includes(resolution as Resolution)) {
    findings.push(
      `resolution "${resolution || "(absent)"}" is not one of: ${RESOLUTIONS.join(", ")} — the deposit is owed regardless of step 01, so there is no skip resolution`,
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
      `repo_probe "${probe || "(absent)"}" is not "${PROBE_OK}" — a failed or unrecorded \`git ls-remote\` is not a deposit`,
    );
  }

  const urlSource = blockScalar(block, "repo_url_source");
  if (urlSource !== "" && !URL_SOURCES.includes(urlSource as (typeof URL_SOURCES)[number])) {
    findings.push(`repo_url_source "${urlSource}" is not one of: ${URL_SOURCES.join(", ")}`);
  }

  if (blockList(block, "entries").length === 0) {
    findings.push(
      "entries is empty or absent — list the promoted entries with their knows/judges class and generalization grade",
    );
  }

  if (blockScalar(block, "sanitization_approved_by") === "") {
    findings.push(
      "sanitization_approved_by is absent — name who approved what left the customer engagement",
    );
  }

  const requireField = (key: string, why: string): void => {
    if (blockScalar(block, key) === "") findings.push(`${resolution} requires a non-empty ${key}: (${why})`);
  };

  if (resolution === "merge-request-opened") {
    requireField("branch", "the pushed branch");
    requireField("review_url", "the merge/pull request URL");
  } else if (resolution === "branch-pushed") {
    requireField("branch", "the pushed branch");
    requireField("owner", "who opens the merge request");
  } else if (resolution === "patch-prepared") {
    requireField("patch_path", "where the patch was written");
    requireField("owner", "who lands it");
    requireField("blocked_reason", "why the push was refused");
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

  process.stdout.write(`${JSON.stringify(checkDeposit(content))}\n`);
}

main();
