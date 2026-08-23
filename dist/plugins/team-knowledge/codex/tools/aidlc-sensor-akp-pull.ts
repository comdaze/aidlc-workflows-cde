// aidlc-sensor-akp-pull.ts — ADVISORY. team-knowledge PULL record gate
// (team-knowledge plugin).
//
// Reads team-knowledge-pull-preflight.md (written by the team-knowledge-pull
// stage) and verifies its fenced `yaml` pull block records a probed hub git URL
// plus a machine-readable resolution: cards imported, a search that matched
// nothing, or the honest degraded outcome (§10.5 — a `--single` run cannot reach
// aidlc-learnings.ts persist, so it reports and hands off instead of pretending).
// There is no skip resolution, and no "I hand-edited team.md instead".
//
// ADVISORY (the framework has no blocking sensor severity yet). Deliberately
// self-contained — no import of aidlc-lib, and no import of the plugin's own
// aidlc-akp-cards.ts either: a sensor runs from the hook path and must not fail
// because a sibling file did not land.
import { existsSync, readFileSync } from "node:fs";

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const ARTIFACT_FILENAME = "team-knowledge-pull-preflight.md";
const RESOLUTIONS = ["cards-imported", "no-card-match", "report-only"] as const;
type Resolution = (typeof RESOLUTIONS)[number];
const URL_SOURCES = ["memory-layer", "user-provided"] as const;
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
  process.stderr.write(`aidlc-sensor-akp-pull: ${msg}\n`);
  process.exit(1);
}

// The dispatcher fires on EVERY write under the record dir, not just ours.
function passThrough(): never {
  process.stdout.write(
    `${JSON.stringify({ pass: true, findings_count: 0, findings: [], resolution: "not-applicable" })}\n`,
  );
  process.exit(0);
}

// LAST fenced yaml block whose first non-blank line is `pull:` — so the schema
// example the stage prose shows earlier cannot shadow the real record.
function extractPullBlock(content: string): string | null {
  let found: string | null = null;
  for (const m of content.matchAll(/^```yaml[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)) {
    const body = m[1] ?? "";
    const firstLine = body.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
    if (firstLine.trim() === "pull:") found = body;
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

/** Whether the key is present at all (an empty list is not "absent"). */
function hasKey(block: string, key: string): boolean {
  return new RegExp(`^[ \\t]+${key}:`, "m").test(block);
}

// Git remote shape, offline — identical judgement to the poc-accelerator
// sensors (§10.7: this plugin inherits that contract verbatim rather than
// inventing a second, subtly different one).
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

export function checkPull(content: string): Result {
  const findings: string[] = [];
  const block = extractPullBlock(content);
  if (!block) {
    return {
      pass: false,
      findings_count: 1,
      findings: [
        'no fenced yaml block opening with "pull:" found — the artifact must end with the machine-readable pull record',
      ],
      resolution: "missing",
    };
  }

  const resolution = blockScalar(block, "resolution");
  if (!(RESOLUTIONS as readonly string[]).includes(resolution)) {
    findings.push(
      `resolution "${resolution || "(absent)"}" is not one of: ${RESOLUTIONS.join(", ")} — the hub is a required input, so there is no skip resolution`,
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
    findings.push(
      `repo_probe "${probe || "(absent)"}" is not "${PROBE_OK}" — a failed or unrecorded \`git ls-remote\` is not a resolution (FR-9)`,
    );
  }

  const urlSource = blockScalar(block, "repo_url_source");
  if (urlSource !== "" && !(URL_SOURCES as readonly string[]).includes(urlSource)) {
    findings.push(`repo_url_source "${urlSource}" is not one of: ${URL_SOURCES.join(", ")}`);
  }

  if (blockList(block, "sources_searched").length === 0) {
    findings.push("sources_searched is empty or absent — record the registry query and every local seat that was searched");
  }

  const imported = blockList(block, "imported");
  const practices = blockList(block, "practices_persisted");
  const staleImported = blockList(block, "stale_imported");

  if (resolution === "cards-imported") {
    if (imported.length === 0) {
      findings.push("cards-imported requires a non-empty imported: list of card concept IDs (FR-14 — this is the reverse-trace registration point)");
    }
    if (practices.length > 0 && blockScalar(block, "persist_slug") === "") {
      findings.push(
        "practices_persisted is non-empty but persist_slug is absent — a Practice card reaches team.md only through `aidlc-learnings.ts persist --slug <stage>` (FR-11/§9.2), never by editing the memory file",
      );
    }
    if (!hasKey(block, "practices_persisted")) {
      findings.push(
        "cards-imported requires a practices_persisted: key (an empty list is a valid answer when no Practice card was imported) — its absence hides whether the persist ritual ran",
      );
    }
    // FR-11/§9.2's actual obligation: a Practice card that was imported must
    // have gone through persist. Without this the honest-looking record
    // `imported: [practices/…]` + `practices_persisted: []` passes, which is
    // precisely the "I edited team.md by hand" case the whole pull design
    // exists to prevent — and the empty list is a legitimate answer only when
    // no Practice card was imported at all.
    //
    // Inference is by the `practices/` path prefix (§7.1's layout), because a
    // sensor sees the artifact and never the bundle. It can therefore MISS a
    // Practice card filed outside `practices/`, but it never fires falsely.
    const unpersisted = imported.filter(
      (id) => id.startsWith("practices/") && !practices.includes(id),
    );
    if (unpersisted.length > 0) {
      findings.push(
        `imported Practice card(s) ${unpersisted.join(", ")} are absent from practices_persisted — a Practice card reaches team.md only through the persist ritual (FR-11/§9.2). If a card was reviewed and dropped, remove it from imported: too; "imported" means it landed.`,
      );
    }
  } else if (resolution === "no-card-match") {
    if (blockList(block, "search_terms").length === 0) {
      findings.push("no-card-match requires a non-empty search_terms: list — an unmatched search is still an auditable claim");
    }
    if (imported.length > 0) findings.push("no-card-match cannot also list imported cards");
  } else if (resolution === "report-only") {
    if (blockScalar(block, "blocked_reason") === "") {
      findings.push("report-only requires blocked_reason: — the degraded path is owned and named, not implied (§10.5)");
    }
    if (blockScalar(block, "owner") === "") {
      findings.push("report-only requires owner: — who runs the import inside a real workflow");
    }
    if (blockList(block, "handoff").length === 0) {
      findings.push("report-only requires a non-empty handoff: list of the card concept IDs to import next run");
    }
    if (practices.length > 0) {
      findings.push("report-only cannot claim practices_persisted — persist is exactly what the degraded run could not do");
    }
  }

  if (staleImported.length > 0 && blockScalar(block, "stale_reconfirmed_by") === "") {
    findings.push(
      `stale_imported lists ${staleImported.length} stale card(s) but stale_reconfirmed_by is absent — a stale card has lost its default authority and a named human must re-affirm it before use (FR-13/§8.2)`,
    );
  }

  for (const entry of [...imported, ...practices, ...staleImported]) {
    if (/\s/.test(entry)) {
      findings.push(`"${entry}" is not a card concept ID — use the bundle-relative path without .md (e.g. practices/data-boundary/mock-data-synthesis)`);
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

  process.stdout.write(`${JSON.stringify(checkPull(content))}\n`);
}

if (import.meta.main) main();
