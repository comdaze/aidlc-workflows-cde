// aidlc-akp-validate.ts — the ONE fail-closed card validator, run on BOTH sides
// (team-knowledge plugin). CONTRACT.md §11 is the rule table; §6.2 is the
// two-verdict split that makes the same code correct in both places:
//
//   okf-nonconformant     (SPEC §11's three hard requirements)
//       produce: reject   consume: reject
//   cde-policy-violation  (our house rules, §11 table rows 4-12)
//       produce: reject   consume: WARN
//
// Conflating those two is the failure this split exists to prevent: reporting a
// house-rule breach as "not OKF compliant" to our own authors, and refusing a
// perfectly legal third-party bundle because it lacks our `cde:` block.
//
//   bun aidlc-akp-validate.ts --bundle <dir> [--mode produce|consume]
//                             [--policy <path>] [--card <path>]... [--today YYYY-MM-DD]
//                             [--agents-dir <path>] [--json]
//
// Exit codes: 0 clean (warnings allowed), 1 rejected, 2 usage error.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Card,
  type YamlMap,
  addDays,
  conceptId,
  discoverCardPaths,
  errorMessage,
  isList,
  isMap,
  isStale,
  isoDay,
  keyOrderViolations,
  normalizeVerified,
  parseDate,
  parseYaml,
  extBlock,
  extPath,
  sanitizationBlock,
  path as dig,
  readCard,
  ruleDigest,
  ruleSection,
  splitFrontmatter,
  str,
  trustTier,
} from "./aidlc-akp-cards.ts";

// --- policy -----------------------------------------------------------------

export interface Policy {
  half_life_days: Record<string, number>;
  archive_grace_days: number;
  deny_patterns: string[];
  controlled_tags: string[];
}

/** Shipped defaults — mirrored by the hub skeleton's `policy/lifecycle.json` (§8.1). */
export const DEFAULT_POLICY: Policy = {
  half_life_days: {
    Practice: 180,
    "Domain Knowledge": 365,
    "Domain Knowledge:aws": 120,
    "Knowledge Pack": 365,
  },
  archive_grace_days: 90,
  deny_patterns: [
    "(?i)AKIA[0-9A-Z]{16}",
    "(?i)ASIA[0-9A-Z]{16}",
    "\\b\\d{12}\\b",
    "\\.internal\\b",
    "\\.corp\\b",
    "(?i)-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "(?i)\\bBearer [A-Za-z0-9._~+/-]{20,}",
    "(?i)\\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\\s*[:=]\\s*\\S+",
    "(?i)\\b[a-z0-9._%+-]+@(?!example\\.(?:com|org))[a-z0-9.-]+\\.[a-z]{2,}\\b",
  ],
  controlled_tags: [
    "aws",
    "aws-cn",
    "cost",
    "data-boundary",
    "delivery",
    "deployment",
    "engineering",
    "genai",
    "iot",
    "mock-data",
    "observability",
    "power-trading",
    "security",
    "spot-market",
    "testing",
  ],
};

function loadPolicy(explicit: string | undefined, bundleRoot: string): Policy {
  const candidates = [explicit, join(bundleRoot, "policy", "lifecycle.json")].filter(
    (p): p is string => typeof p === "string" && p !== "",
  );
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const parsed = JSON.parse(readFileSync(candidate, "utf-8")) as Partial<Policy>;
    return {
      half_life_days: { ...DEFAULT_POLICY.half_life_days, ...(parsed.half_life_days ?? {}) },
      archive_grace_days: parsed.archive_grace_days ?? DEFAULT_POLICY.archive_grace_days,
      deny_patterns: parsed.deny_patterns ?? DEFAULT_POLICY.deny_patterns,
      controlled_tags: parsed.controlled_tags ?? DEFAULT_POLICY.controlled_tags,
    };
  }
  return DEFAULT_POLICY;
}

// --- vocabulary -------------------------------------------------------------

export const CARD_TYPES = ["Practice", "Domain Knowledge", "Knowledge Pack"] as const;
export const STATUSES = ["draft", "stable", "deprecated"] as const;
export const CDE_CLASSES = ["knows", "judges"] as const;
export const GENERALIZATIONS = ["industry-generic", "needs-recalibration"] as const;
export const CONTENT_KEY_SCOPES = ["project", "team"] as const;

/** §10.4 — the 8 `## ` headings `team.md` ships. A house rule, not a tool limit. */
export const VALID_HEADINGS = [
  "## Way of Working",
  "## Walking Skeleton",
  "## Testing Posture",
  "## Deployment",
  "## Code Style",
  "## Forbidden",
  "## Mandated",
  "## Corrections",
] as const;

/** Fallback roster — used when no installed `agents/` dir is discoverable. */
export const FALLBACK_SEATS = [
  "aidlc-shared",
  "aidlc-architect-agent",
  "aidlc-architecture-reviewer-agent",
  "aidlc-aws-platform-agent",
  "aidlc-compliance-agent",
  "aidlc-composer-agent",
  "aidlc-delivery-agent",
  "aidlc-design-agent",
  "aidlc-developer-agent",
  "aidlc-devsecops-agent",
  "aidlc-operations-agent",
  "aidlc-pipeline-deploy-agent",
  "aidlc-product-agent",
  "aidlc-product-lead-agent",
  "aidlc-quality-agent",
] as const;

function resolveSeats(explicit: string | undefined): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const dirs = [explicit, join(here, "..", "agents")].filter((p): p is string => typeof p === "string" && p !== "");
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const seats = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => basename(f, ".md"));
    if (seats.length > 0) return ["aidlc-shared", ...seats];
  }
  return [...FALLBACK_SEATS];
}

const ACTOR_RE = /^(?:human:\S+|process:\S+|\S+\/\S+)$/;

// --- findings ---------------------------------------------------------------

export type Verdict = "okf-nonconformant" | "cde-policy-violation" | "warning";

export interface Finding {
  card: string;
  verdict: Verdict;
  rule: string;
  message: string;
}

export interface ValidateOptions {
  bundleRoot: string;
  mode: "produce" | "consume";
  policy?: Policy;
  today?: Date;
  seats?: string[];
  /** Report only these concept IDs; whole-bundle context is still loaded. */
  only?: Set<string>;
}

export interface ValidateReport {
  mode: "produce" | "consume";
  cards_checked: number;
  rejected: boolean;
  findings: Finding[];
  warnings: Finding[];
}

function topicOf(id: string): string | null {
  const seg = id.split("/");
  if (seg[0] === "knowledge") return (seg[1] === "domains" ? seg[2] : seg[1]) ?? null;
  if (seg.length > 1) return seg[1] ?? null;
  return null;
}

export function halfLifeDays(policy: Policy, type: string, id: string): number | null {
  const topic = topicOf(id);
  if (topic !== null) {
    const scoped = policy.half_life_days[`${type}:${topic}`];
    if (typeof scoped === "number") return scoped;
  }
  const plain = policy.half_life_days[type];
  return typeof plain === "number" ? plain : null;
}

/** Markdown link targets in the body: `[text](target)`. */
function linkTargets(body: string): string[] {
  return [...body.matchAll(/\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map((m) => (m[1] ?? "").trim());
}

/** Resolve a body link to a bundle concept ID, or null when it is external. */
function linkToConceptId(cardId: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const cleaned = target.replace(/#.*$/, "").replace(/\.md$/, "");
  if (cleaned === "") return null;
  if (cleaned.startsWith("/")) return cleaned.slice(1);
  if (cleaned.startsWith("./") || cleaned.startsWith("../")) {
    const dir = cardId.includes("/") ? cardId.slice(0, cardId.lastIndexOf("/")) : "";
    const parts = (dir === "" ? [] : dir.split("/")).concat(cleaned.split("/"));
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "." || part === "") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    return stack.join("/");
  }
  return cleaned;
}

// --- structure files (§11 rule 3) -------------------------------------------

function checkStructureFiles(bundleRoot: string, findings: Finding[]): void {
  for (const name of ["index.md", "log.md"] as const) {
    const abs = join(bundleRoot, name);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, "utf-8");
    if (!raw.startsWith("---")) continue;
    const split = splitFrontmatter(raw);
    if ("error" in split) {
      findings.push({ card: name, verdict: "okf-nonconformant", rule: "3", message: split.error });
      continue;
    }
    try {
      const parsed = parseYaml(split.frontmatterRaw);
      if (isMap(parsed) && str(parsed.type) !== "") {
        findings.push({
          card: name,
          verdict: "okf-nonconformant",
          rule: "3",
          message: `${name} is a reserved OKF structure file and must not declare a concept "type:"`,
        });
      }
    } catch (e) {
      findings.push({
        card: name,
        verdict: "okf-nonconformant",
        rule: "3",
        message: `frontmatter is not parseable YAML: ${errorMessage(e)}`,
      });
    }
  }
  // A nested index.md is a pack manifest, not the bundle root — only the root
  // one is the bundle's version anchor (§7.1/§7.3).
  for (const abs of nestedIndexes(bundleRoot)) {
    const raw = readFileSync(abs, "utf-8");
    const split = splitFrontmatter(raw);
    if ("error" in split) continue;
    let parsed: unknown;
    try {
      parsed = parseYaml(split.frontmatterRaw);
    } catch {
      continue;
    }
    if (isMap(parsed as YamlMap) && str((parsed as YamlMap).okf_version) !== "") {
      findings.push({
        card: conceptId(bundleRoot, abs),
        verdict: "cde-policy-violation",
        rule: "3",
        message: "only the bundle root index.md declares okf_version",
      });
    }
  }
}

function nestedIndexes(bundleRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (![".git", "node_modules", "tools"].includes(entry.name)) walk(abs);
      } else if (entry.name === "index.md" && dir !== bundleRoot) {
        out.push(abs);
      }
    }
  };
  walk(bundleRoot);
  return out.sort();
}

// --- the card checks --------------------------------------------------------

interface Ctx {
  policy: Policy;
  today: Date;
  seats: string[];
  byId: Map<string, Card>;
  digests: Map<string, string[]>;
  denyRes: Array<{ source: string; re: RegExp }>;
}

function compileDeny(patterns: string[]): Array<{ source: string; re: RegExp }> {
  const out: Array<{ source: string; re: RegExp }> = [];
  for (const raw of patterns) {
    // `(?i)` is a Python/Go inline flag the policy file may carry; JS needs /i.
    const insensitive = raw.startsWith("(?i)");
    const body = insensitive ? raw.slice(4) : raw;
    try {
      out.push({ source: raw, re: new RegExp(body, insensitive ? "i" : "") });
    } catch {
      // A malformed policy pattern is reported once, against the bundle.
      out.push({ source: raw, re: /(?!)/ });
    }
  }
  return out;
}

function checkCard(card: Card, ctx: Ctx): Finding[] {
  const out: Finding[] = [];
  const fm = card.frontmatter;
  const add = (verdict: Verdict, rule: string, message: string): void => {
    out.push({ card: card.id, verdict, rule, message });
  };
  const policyFail = (rule: string, message: string): void => add("cde-policy-violation", rule, message);

  // Rule 2 (OKF hard): `type` present and non-empty.
  const type = str(fm.type);
  if (type === "") {
    add("okf-nonconformant", "2", 'SPEC §11 requires a non-empty "type" on every concept');
  } else if (!(CARD_TYPES as readonly string[]).includes(type)) {
    policyFail("4", `type "${type}" is not one of: ${CARD_TYPES.join(", ")}`);
  }

  // Rule 4 — the house-rule required set, enums, and parseable dates.
  if (str(fm.title) === "") policyFail("4", "title is required (one-line display name)");
  if (str(fm.description) === "") policyFail("4", "description is required (one-sentence summary for index.md)");

  const tags = isList(fm.tags) ? fm.tags.map((t) => str(t)).filter((t) => t !== "") : [];
  if (tags.length === 0) policyFail("4", "tags is required and must list at least one tag");

  const status = str(fm.status) || "stable";
  if (!(STATUSES as readonly string[]).includes(status)) {
    policyFail("4", `status "${status}" is not one of: ${STATUSES.join(", ")}`);
  }

  const generated = fm.generated;
  if (!isMap(generated)) {
    policyFail("4", "generated is required: { by: <actor>, at: <ISO8601> }");
  } else {
    const by = str(generated.by);
    const at = str(generated.at);
    if (by === "") policyFail("4", "generated.by is required — who WROTE the card");
    else if (!ACTOR_RE.test(by)) {
      policyFail("4", `generated.by "${by}" is not an OKF §7 actor (human:<id>, process:<id>, or <producer>/<version>)`);
    }
    if (parseDate(at) === null) policyFail("4", `generated.at "${at || "(absent)"}" is not a parseable date`);
  }

  const verified = normalizeVerified(fm);
  if (fm.verified === undefined) {
    policyFail("4", "verified is required — the event list of who CONFIRMED the content (§4.5)");
  } else if (verified.length === 0) {
    policyFail("4", "verified carries no usable event — each entry needs { by, at }");
  }
  for (const [i, event] of verified.entries()) {
    if (event.by === "") policyFail("4", `verified[${i}].by is required`);
    else if (!ACTOR_RE.test(event.by)) policyFail("4", `verified[${i}].by "${event.by}" is not an OKF §7 actor`);
    if (parseDate(event.at) === null) policyFail("4", `verified[${i}].at "${event.at || "(absent)"}" is not a parseable date`);
  }

  const staleAfterRaw = str(fm.stale_after);
  const staleAfter = parseDate(staleAfterRaw);
  if (staleAfterRaw === "") {
    policyFail(
      "4",
      "stale_after is required — OKF's is_stale FAILS OPEN when it is absent, so a missing clock reads as never expires (§8.2)",
    );
  } else if (staleAfter === null) {
    policyFail("4", `stale_after "${staleAfterRaw}" is not a parseable YYYY-MM-DD date`);
  }

  const sources = isList(fm.sources) ? fm.sources : [];
  if (!isList(fm.sources) || sources.length === 0) {
    policyFail("4", "sources is required and must carry at least one entry");
  }
  for (const [i, source] of sources.entries()) {
    if (!isMap(source)) {
      policyFail("4", `sources[${i}] must be a mapping`);
      continue;
    }
    if (str(source.id) === "") policyFail("4", `sources[${i}].id is required — the body cites it as [^id]`);
    // §7.4: `resource` may be a RANGE DESCRIPTOR, not a path — never resolved.
    if (str(source.resource) === "") policyFail("4", `sources[${i}].resource is required`);
  }

  // Rule 5 — the freshness clock, recomputed and compared with 0-day tolerance.
  const cde = extBlock(fm);
  const overrideRaw = str(extPath("review_interval_days", fm));
  const override = overrideRaw === "" ? null : Number(overrideRaw);
  if (overrideRaw !== "" && (!Number.isFinite(override) || (override as number) <= 0)) {
    policyFail("4", `akp.review_interval_days "${overrideRaw}" is not a positive number of days`);
  }
  const lastVerified = verified
    .map((e) => parseDate(e.at))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (lastVerified && staleAfter !== null) {
    const window =
      Number.isFinite(override) && (override as number) > 0 ? (override as number) : halfLifeDays(ctx.policy, type, card.id);
    if (window === null) {
      policyFail("5", `no half_life_days policy entry for type "${type}" — add one to policy/lifecycle.json`);
    } else {
      const expected = isoDay(addDays(lastVerified, window));
      if (isoDay(staleAfter) !== expected) {
        policyFail(
          "5",
          `stale_after ${isoDay(staleAfter)} != max(verified.at) ${isoDay(lastVerified)} + ${window}d = ${expected} (tolerance 0 days)`,
        );
      }
    }
  }

  // Rule 6 — deny patterns over the WHOLE file, frontmatter included.
  for (const { source, re } of ctx.denyRes) {
    const hit = card.raw.match(re);
    if (hit) {
      policyFail(
        "6",
        `deny pattern /${source}/ matched "${(hit[0] ?? "").slice(0, 60)}" — the machine backstop caught it; named sanitization approval is the real gate (§4.1)`,
      );
    }
  }

  // Rule 7 — exact dedupe over the `# 规则` section only (§6.5).
  const digest = ruleDigest(card.body);
  if (digest !== null) {
    const others = (ctx.digests.get(digest) ?? []).filter((id) => id !== card.id);
    const liveOthers = others.filter((id) => str(ctx.byId.get(id)?.frontmatter.status) !== "deprecated");
    if (liveOthers.length > 0 && status !== "deprecated") {
      policyFail("7", `the "# 规则" section is byte-identical (normalized) to: ${liveOthers.join(", ")}`);
    }
  } else if (type === "Practice") {
    policyFail("7", 'a Practice card needs a non-empty "# 规则" section — it is the dedupe range AND the text pull persists');
  }

  // Rule 8 — supersession is one MR, both directions.
  if (status === "deprecated") {
    const successors = linkTargets(card.body)
      .map((t) => linkToConceptId(card.id, t))
      .filter((id): id is string => id !== null && ctx.byId.has(id));
    if (successors.length === 0) {
      policyFail(
        "8",
        "a deprecated card must link to its successor card, and that card must exist in this bundle (§4.4 — no archive/ move, the inbound links must keep resolving)",
      );
    }
  }
  const supersedes = str(extPath("supersedes", fm));
  if (supersedes !== "") {
    const target = ctx.byId.get(supersedes);
    if (!target) {
      policyFail("8", `akp.supersedes "${supersedes}" is not a card in this bundle — the replacement lands in the SAME MR`);
    } else if (str(target.frontmatter.status) !== "deprecated") {
      policyFail(
        "8",
        `cde.supersedes "${supersedes}" is still status "${str(target.frontmatter.status) || "stable"}" — flip it to deprecated in this same MR, or the tree holds a card that is superseded and still authoritative`,
      );
    }
  }

  // Rule 4/9/10 — the cde: block.
  if (!isMap(cde)) {
    policyFail("4", "the cde: block is required (§6.3.1) — provenance, sanitization approval, and memory destination");
  } else {
    const cls = str(cde.class);
    if (!(CDE_CLASSES as readonly string[]).includes(cls)) {
      policyFail("4", `akp.class "${cls || "(absent)"}" is not one of: ${CDE_CLASSES.join(", ")}`);
    }
    const generalization = str(cde.generalization);
    if (!(GENERALIZATIONS as readonly string[]).includes(generalization)) {
      policyFail("4", `akp.generalization "${generalization || "(absent)"}" is not one of: ${GENERALIZATIONS.join(", ")}`);
    }
    for (const field of ["project", "intent", "stage", "content_key"] as const) {
      if (str(dig(`origin.${field}`, cde)) === "") policyFail("4", `akp.origin.${field} is required`);
    }
    const keyScope = str(dig("origin.content_key_scope", cde));
    if (!(CONTENT_KEY_SCOPES as readonly string[]).includes(keyScope)) {
      policyFail(
        "4",
        `cde.origin.content_key_scope "${keyScope || "(absent)"}" is not one of: ${CONTENT_KEY_SCOPES.join(", ")} — the Content-Key hashes scope INTO the digest (§10.2), so a key without its scope cannot be traced back`,
      );
    }
    // Either field name, block form only. A bare-string `sanitized_by` yields
    // undefined here and fails below, which is correct: a string carries no
    // approval date.
    const sanitized = sanitizationBlock(cde);
    const sanitizedBy = str(dig("by", sanitized));
    if (sanitizedBy === "") {
      policyFail("4", "akp.sanitized_by.by is required — the NAMED human who approved this leaving the delivery site");
    } else if (!sanitizedBy.startsWith("human:")) {
      policyFail(
        "4",
        `akp.sanitized_by.by "${sanitizedBy}" must be a human: actor — sanitization is a value judgement and cannot be machine-approved (§2.2)`,
      );
    }
    const sanitizedAt = str(dig("at", sanitized));
    if (parseDate(sanitizedAt) === null) {
      policyFail("4", `akp.sanitized_by.at "${sanitizedAt || "(absent)"}" is not a parseable date`);
    }

    if (type === "Practice") {
      const target = str(cde.memory_target);
      if (target !== "team") {
        policyFail(
          "9",
          `cde.memory_target "${target || "(absent)"}" must be "team" — aidlc-learnings.ts persist has no org.md write path (§10.1)`,
        );
      }
      const heading = str(cde.heading);
      if (!(VALID_HEADINGS as readonly string[]).includes(heading)) {
        policyFail("9", `akp.heading "${heading || "(absent)"}" is not one of the 8 team.md headings: ${VALID_HEADINGS.join(", ")}`);
      }
    }
    if (type === "Domain Knowledge") {
      const seat = str(cde.knowledge_seat);
      if (seat === "") policyFail("10", "akp.knowledge_seat is required on a Domain Knowledge card");
      else if (!ctx.seats.includes(seat)) {
        policyFail("10", `akp.knowledge_seat "${seat}" is not an installed agent seat or "aidlc-shared"`);
      }
    }
  }

  // Rule 11 — controlled vocabulary is advisory by design.
  for (const tag of tags) {
    if (!ctx.policy.controlled_tags.includes(tag)) {
      add("warning", "11", `tag "${tag}" is not in the controlled vocabulary — add it to policy/lifecycle.json if it should be`);
    }
  }

  // Rule 12 — key order: writer self-check, human edits only warn.
  for (const violation of keyOrderViolations(card.frontmatterRaw)) {
    add("warning", "12", violation);
  }

  return out;
}

// --- driver -----------------------------------------------------------------

export function validateBundle(options: ValidateOptions): ValidateReport {
  const policy = options.policy ?? loadPolicy(undefined, options.bundleRoot);
  const today = options.today ?? new Date();
  const seats = options.seats ?? resolveSeats(undefined);
  const findings: Finding[] = [];

  checkStructureFiles(options.bundleRoot, findings);

  const paths = discoverCardPaths(options.bundleRoot);
  const cards: Card[] = [];
  for (const abs of paths) {
    const read = readCard(options.bundleRoot, abs);
    if (!read.ok) {
      // Rule 1 (OKF hard): unparseable / unterminated frontmatter.
      findings.push({ card: read.failure.id, verdict: "okf-nonconformant", rule: "1", message: read.failure.error });
      continue;
    }
    cards.push(read.card);
  }

  const byId = new Map(cards.map((c) => [c.id, c]));
  const digests = new Map<string, string[]>();
  for (const card of cards) {
    const digest = ruleDigest(card.body);
    if (digest === null) continue;
    digests.set(digest, [...(digests.get(digest) ?? []), card.id]);
  }

  const ctx: Ctx = { policy, today, seats, byId, digests, denyRes: compileDeny(policy.deny_patterns) };
  for (const card of cards) {
    if (options.only && !options.only.has(card.id)) continue;
    findings.push(...checkCard(card, ctx));
  }

  const reported = options.only ? findings.filter((f) => options.only?.has(f.card) || !byId.has(f.card)) : findings;
  const hardVerdicts: Verdict[] = options.mode === "produce" ? ["okf-nonconformant", "cde-policy-violation"] : ["okf-nonconformant"];
  const hard = reported.filter((f) => hardVerdicts.includes(f.verdict));
  const soft = reported.filter((f) => !hardVerdicts.includes(f.verdict));

  return {
    mode: options.mode,
    cards_checked: options.only ? cards.filter((c) => options.only?.has(c.id)).length : cards.length,
    rejected: hard.length > 0,
    findings: hard,
    warnings: soft,
  };
}

/** The consume-side gloss §6.2 demands: a missing `cde:` block is "no CDE metadata", not a reject. */
export function consumeAdvice(report: ValidateReport): string[] {
  const notes: string[] = [];
  const missingCde = report.warnings.filter((w) => w.message.startsWith("the cde: block is required"));
  for (const w of missingCde) {
    notes.push(
      `${w.card}: no cde: metadata — treat as unverified and have a human complete the provenance before relying on it (§6.2). This is NOT a reason to refuse the bundle.`,
    );
  }
  return notes;
}

interface Flags {
  bundle?: string;
  mode: "produce" | "consume";
  policy?: string;
  agentsDir?: string;
  today?: string;
  cards: string[];
  json: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { mode: "produce", cards: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--bundle") flags.bundle = argv[++i];
    else if (arg === "--mode") flags.mode = argv[++i] === "consume" ? "consume" : "produce";
    else if (arg === "--policy") flags.policy = argv[++i];
    else if (arg === "--agents-dir") flags.agentsDir = argv[++i];
    else if (arg === "--today") flags.today = argv[++i];
    else if (arg === "--card") {
      const v = argv[++i];
      if (v) flags.cards.push(v);
    } else if (arg === "--json") flags.json = true;
    else if (arg === "--help" || arg === "-h") flags.bundle = undefined;
  }
  return flags;
}

export function runCli(argv: string[]): number {
  const flags = parseFlags(argv);
  if (!flags.bundle) {
    process.stderr.write(
      "Usage: aidlc-akp-validate.ts --bundle <dir> [--mode produce|consume] [--policy <path>]\n" +
        "                            [--card <path>]... [--today YYYY-MM-DD] [--agents-dir <path>] [--json]\n",
    );
    return 2;
  }
  const bundleRoot = resolve(flags.bundle);
  const only =
    flags.cards.length > 0
      ? new Set(flags.cards.map((c) => conceptId(bundleRoot, isAbsolute(c) ? c : resolve(c))))
      : undefined;
  const today = flags.today ? parseDate(flags.today) : null;
  if (flags.today && today === null) {
    process.stderr.write(`aidlc-akp-validate: --today "${flags.today}" is not YYYY-MM-DD\n`);
    return 2;
  }

  let report: ValidateReport;
  try {
    report = validateBundle({
      bundleRoot,
      mode: flags.mode,
      policy: loadPolicy(flags.policy, bundleRoot),
      today: today ?? new Date(),
      seats: resolveSeats(flags.agentsDir),
      only,
    });
  } catch (e) {
    process.stderr.write(`aidlc-akp-validate: ${errorMessage(e)}\n`);
    return 2;
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ ...report, advice: consumeAdvice(report) }, null, 2)}\n`);
    return report.rejected ? 1 : 0;
  }

  const line = (f: Finding): string => `  [${f.verdict} §11.${f.rule}] ${f.card}: ${f.message}`;
  process.stdout.write(`aidlc-akp-validate (${report.mode}) — ${report.cards_checked} card(s)\n`);
  if (report.findings.length > 0) {
    process.stdout.write(`REJECTED — ${report.findings.length} blocking finding(s):\n`);
    for (const f of report.findings) process.stdout.write(`${line(f)}\n`);
  }
  if (report.warnings.length > 0) {
    process.stdout.write(`${report.warnings.length} warning(s):\n`);
    for (const f of report.warnings) process.stdout.write(`${line(f)}\n`);
  }
  for (const note of consumeAdvice(report)) process.stdout.write(`  note: ${note}\n`);
  if (!report.rejected && report.warnings.length === 0) process.stdout.write("OK — every card passes\n");
  return report.rejected ? 1 : 0;
}

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));

// Re-exported so the registry tool and the tests share one staleness clock.
export { isStale, trustTier, ruleSection };
