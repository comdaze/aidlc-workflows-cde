// aidlc-sensor-poc-accelerator-team-knowledge-preflight.ts — ADVISORY
// team-knowledge preflight gate (poc-accelerator plugin).
//
// Reads poc-accelerator-team-knowledge-preflight.md (written by step 01) and
// verifies its fenced `yaml` preflight block records a machine-readable
// resolution: a matched pack import, a user-provided source, or an explicit
// user skip with a named decider and reason. ADVISORY (no blocking severity
// in the framework yet). Needs only the --output-path the dispatcher always
// passes. Shipped to the harness tools dir via the plugin's contributes.tools.
import { existsSync, readFileSync } from "node:fs";

// Self-contained — no import of the framework's aidlc-lib (a plugin tool ships
// in its own delta and must not depend on a sibling core tool being present).
const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const ARTIFACT_FILENAME = "poc-accelerator-team-knowledge-preflight.md";
const RESOLUTIONS = ["pack-imported", "user-source-provided", "skipped-by-user"] as const;
type Resolution = (typeof RESOLUTIONS)[number];

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
      `resolution "${resolution || "(absent)"}" is not one of: ${RESOLUTIONS.join(", ")} — silence is not a skip`,
    );
  }

  if (blockList(block, "sources_searched").length === 0) {
    findings.push(
      "sources_searched is empty or absent — record every local seat and configured source that was searched",
    );
  }

  if (resolution === "pack-imported") {
    if (blockScalar(block, "pack") === "") findings.push("pack-imported requires a non-empty pack:");
    if (blockScalar(block, "import_path") === "") findings.push("pack-imported requires a non-empty import_path:");
  } else if (resolution === "user-source-provided") {
    if (blockScalar(block, "source") === "") {
      findings.push("user-source-provided requires a non-empty source: (the approved URL or local path)");
    }
  } else if (resolution === "skipped-by-user") {
    if (blockScalar(block, "decided_by") === "") findings.push("skipped-by-user requires a non-empty decided_by:");
    if (blockScalar(block, "reason") === "") findings.push("skipped-by-user requires a non-empty reason:");
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
