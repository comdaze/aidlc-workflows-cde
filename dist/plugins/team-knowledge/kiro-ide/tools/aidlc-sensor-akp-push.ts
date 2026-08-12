// aidlc-sensor-akp-push.ts — ADVISORY. team-knowledge PUSH record gate
// (team-knowledge plugin).
//
// Reads team-knowledge-push-deposit.md (written by the team-knowledge-push
// stage) and verifies its fenced `yaml` deposit block records a probed hub git
// URL, a clean LOCAL validator run, a named sanitization approver, a non-empty
// card list, and one of the three submission outcomes with its required fields.
//
// The three resolutions and the git-URL judgement are inherited verbatim from
// the poc-accelerator deposit sensor (§10.7): there is NO skip value and no
// "nothing to deposit" — a refused push is an owned, named handoff.
//
// ADVISORY (no blocking sensor severity in the framework yet). Deliberately
// self-contained, for the same reason as the pull sensor.
import { existsSync, readFileSync } from "node:fs";

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const ARTIFACT_FILENAME = "team-knowledge-push-deposit.md";
const RESOLUTIONS = ["merge-request-opened", "branch-pushed", "patch-prepared"] as const;
const URL_SOURCES = ["pull-artifact", "memory-layer", "user-provided"] as const;
const PROBE_OK = "git-ls-remote-ok";
const VALIDATE_OK = "akp-validate-ok";
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
  process.stderr.write(`aidlc-sensor-akp-push: ${msg}\n`);
  process.exit(1);
}

function passThrough(): never {
  process.stdout.write(
    `${JSON.stringify({ pass: true, findings_count: 0, findings: [], resolution: "not-applicable" })}\n`,
  );
  process.exit(0);
}

function extractDepositBlock(content: string): string | null {
  let found: string | null = null;
  for (const m of content.matchAll(/^```yaml[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)) {
    const body = m[1] ?? "";
    const firstLine = body.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
    if (firstLine.trim() === "deposit:") found = body;
  }
  return found;
}

function blockScalar(block: string, key: string): string {
  const m = block.match(new RegExp(`^[ \\t]+${key}:[ \\t]*(.*)$`, "m"));
  if (!m) return "";
  return (m[1] ?? "").trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function blockList(block: string, key: string): string[] {
  const m = block.match(new RegExp(`^([ \\t]+)${key}:[ \\t]*\\r?\\n((?:\\1[ \\t]*- .*\\r?\\n?)*)`, "m"));
  if (!m) return [];
  return [...(m[2] ?? "").matchAll(/^\s+- (.+)$/gm)]
    .map((x) => (x[1] ?? "").trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"))
    .filter((v) => v !== "");
}

function isGitRemoteUrl(url: string): boolean {
  if (url === "" || /\s/.test(url)) return false;
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (scheme) {
    const proto = (scheme[1] ?? "").toLowerCase();
    const rest = scheme[2] ?? "";
    if (!GIT_SCHEMES.includes(proto)) return false;
    if (proto === "file") return rest.startsWith("/") && rest.length > 1;
    const slash = rest.indexOf("/");
    return slash > 0 && rest.slice(slash + 1).trim() !== "";
  }
  const scp = url.match(/^(?:[^@:/\s]+@)?[^@:/\s]{2,}:(.+)$/);
  return scp !== null && (scp[1] ?? "").trim() !== "";
}

export function checkDeposit(content: string): Result {
  const findings: string[] = [];
  const block = extractDepositBlock(content);
  if (!block) {
    return {
      pass: false,
      findings_count: 1,
      findings: [
        'no fenced yaml block opening with "deposit:" found — the artifact must end with the machine-readable deposit record',
      ],
      resolution: "missing",
    };
  }

  const resolution = blockScalar(block, "resolution");
  if (!(RESOLUTIONS as readonly string[]).includes(resolution)) {
    findings.push(
      `resolution "${resolution || "(absent)"}" is not one of: ${RESOLUTIONS.join(", ")} — there is no skip value and no "nothing to deposit" outcome (§10.7)`,
    );
  }

  const repoUrl = blockScalar(block, "repo_url");
  if (repoUrl === "") {
    findings.push("repo_url is absent — record the team knowledge hub's git URL");
  } else if (!isGitRemoteUrl(repoUrl)) {
    findings.push(
      `repo_url "${repoUrl}" is not a git remote URL — expected https://, http://, ssh://, git://, file:///abs/path, or git@host:team/repo.git`,
    );
  }

  const probe = blockScalar(block, "repo_probe");
  if (probe !== PROBE_OK) {
    findings.push(`repo_probe "${probe || "(absent)"}" is not "${PROBE_OK}" — a failed or unrecorded \`git ls-remote\` is not a resolution`);
  }

  const urlSource = blockScalar(block, "repo_url_source");
  if (urlSource !== "" && !(URL_SOURCES as readonly string[]).includes(urlSource)) {
    findings.push(`repo_url_source "${urlSource}" is not one of: ${URL_SOURCES.join(", ")}`);
  }

  const validate = blockScalar(block, "validate");
  if (validate !== VALIDATE_OK) {
    findings.push(
      `validate "${validate || "(absent)"}" is not "${VALIDATE_OK}" — FR-5/§8.3 require the SAME validator to pass locally in produce mode before the branch is pushed; unvalidated cards must not reach a human reviewer`,
    );
  }

  const cards = blockList(block, "cards");
  if (cards.length === 0) {
    findings.push("cards is empty or absent — list every card concept ID this deposit carries");
  }
  for (const card of cards) {
    if (/\s/.test(card)) {
      findings.push(`"${card}" is not a card concept ID — use the bundle-relative path without .md (e.g. practices/data-boundary/mock-data-synthesis)`);
    }
  }

  if (blockScalar(block, "sanitization_approved_by") === "") {
    findings.push(
      "sanitization_approved_by is absent — a named human must approve what leaves the delivery site; deny patterns are only the machine backstop (§4.1/§4.6)",
    );
  }

  const reclassified = blockList(block, "reclassified_from_project");
  if (reclassified.length > 0 && blockScalar(block, "reclassification_approved_by") === "") {
    findings.push(
      `reclassified_from_project lists ${reclassified.length} project-scoped rule(s) but reclassification_approved_by is absent — project.md rules are structurally excluded from the export surface and only a named human re-grade admits one (FR-2/§5.2)`,
    );
  }

  if (resolution === "merge-request-opened") {
    if (blockScalar(block, "branch") === "") findings.push("merge-request-opened requires a non-empty branch:");
    if (blockScalar(block, "review_url") === "") findings.push("merge-request-opened requires a non-empty review_url:");
  } else if (resolution === "branch-pushed") {
    if (blockScalar(block, "branch") === "") findings.push("branch-pushed requires a non-empty branch:");
    if (blockScalar(block, "owner") === "") findings.push("branch-pushed requires a non-empty owner: — who opens the merge request");
  } else if (resolution === "patch-prepared") {
    if (blockScalar(block, "patch_path") === "") findings.push("patch-prepared requires a non-empty patch_path:");
    if (blockScalar(block, "owner") === "") findings.push("patch-prepared requires a non-empty owner: — who lands it");
    if (blockScalar(block, "blocked_reason") === "") {
      findings.push("patch-prepared requires a non-empty blocked_reason: — a refused push is an owned handoff with a named reason, never a skip (FR-6)");
    }
  }

  return { pass: findings.length === 0, findings_count: findings.length, findings, resolution: resolution || "missing" };
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

if (import.meta.main) main();
