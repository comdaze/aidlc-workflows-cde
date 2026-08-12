// aidlc-akp-cards.ts — OKF v0.2 card reader/writer + the three derived
// functions ported from the OKF reference parser (team-knowledge plugin).
//
// CONTRACT.md §10.6 is the binding requirement here: `normalize_verified`,
// `trust_tier`, and `is_stale` are ported from
// `okf/src/reference_agent/bundle/document.py` and must keep the reference
// semantics EXACTLY — including `is_stale`'s fail-open behaviour on a missing
// or unparseable `stale_after`. Do not "fix" that; §8.2 explains why the
// fail-open is the reason `stale_after` is a house-rule REQUIRED field, and
// `tests/validator.test.ts` pins it.
//
// Self-contained on purpose: a plugin tool ships in its own delta and must not
// depend on a sibling core tool (or an external YAML package) being present.
// The YAML reader is a deliberate SUBSET — see `parseYaml` for what it covers.
// Anything outside the subset is reported as unparseable, which is exactly the
// `okf-nonconformant` verdict rule 1 already owns.
//
// Also a small CLI, so a card can be inspected without a harness:
//   bun aidlc-akp-cards.ts show <card.md> [--bundle <dir>]
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// --- YAML subset ------------------------------------------------------------

export type YamlScalar = string | null;
export type YamlValue = YamlScalar | YamlValue[] | { [k: string]: YamlValue };
export type YamlMap = { [k: string]: YamlValue };

export function isMap(v: YamlValue | undefined): v is YamlMap {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isList(v: YamlValue | undefined): v is YamlValue[] {
  return Array.isArray(v);
}

/** Scalar read that tolerates a missing/wrong-typed value (returns ""). */
export function str(v: YamlValue | undefined): string {
  return typeof v === "string" ? v : "";
}

/** Dotted lookup: `path("cde.origin.project", fm)`. */
export function path(dotted: string, root: YamlValue | undefined): YamlValue | undefined {
  let cur: YamlValue | undefined = root;
  for (const seg of dotted.split(".")) {
    if (!isMap(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

class YamlError extends Error {}

/** Strip a trailing `# comment`, respecting quotes. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1] ?? ""))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(raw: string): YamlScalar {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null") return null;
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"');
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

/** Parse a flow collection (`{...}` / `[...]`) starting at `i`. */
function parseFlow(text: string, i: number): { value: YamlValue; next: number } {
  const open = text[i];
  const close = open === "{" ? "}" : "]";
  i++;
  const items: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let buf = "";
  for (; i < text.length; i++) {
    const c = text[i] as string;
    if (quote) {
      buf += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      buf += c;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") {
      if (depth === 0) {
        if (c !== close) throw new YamlError(`flow collection closed with "${c}", expected "${close}"`);
        items.push(buf);
        return { value: open === "{" ? flowMap(items) : flowSeq(items), next: i + 1 };
      }
      depth--;
    }
    if (c === "," && depth === 0) {
      items.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  throw new YamlError(`unterminated flow collection (missing "${close}")`);
}

function flowValue(raw: string): YamlValue {
  const s = raw.trim();
  if (s.startsWith("{") || s.startsWith("[")) return parseFlow(s, 0).value;
  return unquote(s);
}

function flowSeq(items: string[]): YamlValue[] {
  return items.filter((s) => s.trim() !== "").map(flowValue);
}

function flowMap(items: string[]): YamlMap {
  const out: YamlMap = {};
  for (const item of items) {
    if (item.trim() === "") continue;
    const colon = splitKey(item);
    if (colon === null) throw new YamlError(`flow mapping entry "${item.trim()}" is not "key: value"`);
    out[colon.key] = flowValue(colon.rest);
  }
  return out;
}

/** Split `key: rest` at the first top-level colon (quote- and flow-aware). */
function splitKey(line: string): { key: string; rest: string } | null {
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === ":" && depth === 0) {
      const after = line[i + 1];
      if (after === undefined || after === " " || after === "\t") {
        return { key: unquote(line.slice(0, i)) ?? "", rest: line.slice(i + 1) };
      }
    }
  }
  return null;
}

interface Line {
  indent: number;
  text: string;
}

/**
 * Parse the YAML subset the card schema uses:
 *   - block mappings and block sequences, indentation-scoped
 *   - inline flow mappings/sequences, INCLUDING ones wrapped across lines
 *     (CONTRACT §6.6's sample wraps `cde.origin: { … }` over two lines)
 *   - single/double quoted and plain scalars, `#` comments, `null`/`~`
 * Not covered (and reported as an error rather than mis-read): anchors,
 * aliases, tags, block scalars (`|`/`>`), multi-document streams, complex keys.
 */
export function parseYaml(text: string): YamlValue {
  const lines: Line[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const noComment = stripComment(raw);
    if (noComment.trim() === "") continue;
    if (/^\s*(---|\.\.\.)\s*$/.test(noComment)) continue;
    if (/^\s*(&|\*|!!?[a-z])/i.test(noComment) && !/^\s*-/.test(noComment)) {
      throw new YamlError(`unsupported YAML construct: "${noComment.trim()}"`);
    }
    lines.push({ indent: raw.length - raw.trimStart().length, text: noComment.trimEnd() });
  }
  if (lines.length === 0) return null;
  const cursor = { i: 0 };
  const value = parseBlock(lines, cursor, lines[0]?.indent ?? 0);
  if (cursor.i < lines.length) {
    throw new YamlError(`unexpected indentation at "${lines[cursor.i]?.text.trim()}"`);
  }
  return value;
}

function parseBlock(lines: Line[], cursor: { i: number }, indent: number): YamlValue {
  const first = lines[cursor.i];
  if (!first) return null;
  return first.text.trimStart().startsWith("- ") || first.text.trim() === "-"
    ? parseSeq(lines, cursor, indent)
    : parseMap(lines, cursor, indent);
}

/** Consume `{`/`[` continuation lines until the collection balances. */
function joinFlow(lines: Line[], cursor: { i: number }, start: string): string {
  let acc = start;
  while (!flowBalanced(acc)) {
    cursor.i++;
    const next = lines[cursor.i];
    if (!next) throw new YamlError(`unterminated flow collection starting at "${start.trim()}"`);
    acc += ` ${next.text.trim()}`;
  }
  return acc;
}

function flowBalanced(text: string): boolean {
  let quote: string | null = null;
  let depth = 0;
  for (const c of text) {
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
  }
  return depth === 0;
}

function parseMap(lines: Line[], cursor: { i: number }, indent: number): YamlMap {
  const out: YamlMap = {};
  while (cursor.i < lines.length) {
    const line = lines[cursor.i] as Line;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new YamlError(`unexpected indentation at "${line.text.trim()}"`);
    const body = line.text.trimStart();
    if (body.startsWith("- ")) break;
    const split = splitKey(body);
    if (split === null) throw new YamlError(`expected "key: value", got "${body}"`);
    const rest = split.rest.trim();
    if (rest === "") {
      cursor.i++;
      const next = lines[cursor.i];
      out[split.key] = next && next.indent > indent ? parseBlock(lines, cursor, next.indent) : null;
      continue;
    }
    if (rest.startsWith("{") || rest.startsWith("[")) {
      out[split.key] = flowValue(joinFlow(lines, cursor, rest));
      cursor.i++;
      continue;
    }
    out[split.key] = unquote(rest);
    cursor.i++;
  }
  return out;
}

function parseSeq(lines: Line[], cursor: { i: number }, indent: number): YamlValue[] {
  const out: YamlValue[] = [];
  while (cursor.i < lines.length) {
    const line = lines[cursor.i] as Line;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new YamlError(`unexpected indentation at "${line.text.trim()}"`);
    const body = line.text.trimStart();
    if (!body.startsWith("- ") && body !== "-") break;
    const item = body === "-" ? "" : body.slice(2).trim();
    if (item === "") {
      cursor.i++;
      const next = lines[cursor.i];
      out.push(next && next.indent > indent ? parseBlock(lines, cursor, next.indent) : null);
      continue;
    }
    if (item.startsWith("{") || item.startsWith("[")) {
      out.push(flowValue(joinFlow(lines, cursor, item)));
      cursor.i++;
      continue;
    }
    // `- key: value` opens an inline mapping whose siblings are indented to
    // the key's column (the `sources:` list in §6.5 is exactly this shape).
    const split = splitKey(item);
    if (split !== null) {
      const keyIndent = indent + 2;
      const rebuilt: Line[] = [{ indent: keyIndent, text: `${" ".repeat(keyIndent)}${item}` }];
      cursor.i++;
      while (cursor.i < lines.length) {
        const cont = lines[cursor.i] as Line;
        if (cont.indent < keyIndent) break;
        if (cont.indent === keyIndent && cont.text.trimStart().startsWith("- ")) break;
        rebuilt.push(cont);
        cursor.i++;
      }
      const sub = { i: 0 };
      out.push(parseMap(rebuilt, sub, keyIndent));
      continue;
    }
    out.push(unquote(item));
    cursor.i++;
  }
  return out;
}

// --- Frontmatter ------------------------------------------------------------

export interface Card {
  /** Bundle-relative concept ID (path minus `.md`), `/`-separated. */
  id: string;
  absPath: string;
  raw: string;
  frontmatterRaw: string;
  frontmatter: YamlMap;
  body: string;
}

export interface CardReadFailure {
  id: string;
  absPath: string;
  error: string;
}

export type CardRead = { ok: true; card: Card } | { ok: false; failure: CardReadFailure };

export function conceptId(bundleRoot: string, absPath: string): string {
  return relative(bundleRoot, absPath).split(sep).join("/").replace(/\.md$/, "");
}

/** Split a `---`-delimited frontmatter block. An unterminated block is an error. */
export function splitFrontmatter(raw: string): { frontmatterRaw: string; body: string } | { error: string } {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!/^---[ \t]*\r?\n/.test(normalized)) {
    return { error: "no frontmatter block — an OKF concept opens with a `---` delimited YAML block" };
  }
  const rest = normalized.replace(/^---[ \t]*\r?\n/, "");
  const close = rest.match(/^---[ \t]*$/m);
  if (!close || close.index === undefined) {
    return { error: "frontmatter block is not terminated by a closing `---`" };
  }
  return {
    frontmatterRaw: rest.slice(0, close.index),
    body: rest.slice(close.index + (close[0]?.length ?? 3)).replace(/^\r?\n/, ""),
  };
}

export function readCard(bundleRoot: string, absPath: string): CardRead {
  const id = conceptId(bundleRoot, absPath);
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf-8");
  } catch (e) {
    return { ok: false, failure: { id, absPath, error: `unreadable: ${errorMessage(e)}` } };
  }
  const split = splitFrontmatter(raw);
  if ("error" in split) return { ok: false, failure: { id, absPath, error: split.error } };
  let parsed: YamlValue;
  try {
    parsed = parseYaml(split.frontmatterRaw);
  } catch (e) {
    return { ok: false, failure: { id, absPath, error: `frontmatter is not parseable YAML: ${errorMessage(e)}` } };
  }
  if (!isMap(parsed)) {
    return { ok: false, failure: { id, absPath, error: "frontmatter does not parse to a YAML mapping" } };
  }
  return {
    ok: true,
    card: { id, absPath, raw, frontmatterRaw: split.frontmatterRaw, frontmatter: parsed, body: split.body },
  };
}

/** Reserved bundle filenames — OKF §8/§9 structure files, not concepts. */
export const RESERVED_BASENAMES = new Set(["index.md", "log.md", "README.md", "CODEOWNERS.md"]);

/** Every non-reserved `.md` under the bundle, sorted, skipping VCS/tooling dirs. */
export function discoverCardPaths(bundleRoot: string): string[] {
  const skip = new Set([".git", "node_modules", "tools", "feedback", ".gitlab", ".github"]);
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
        if (!skip.has(entry.name)) walk(abs);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      if (RESERVED_BASENAMES.has(entry.name)) continue;
      out.push(abs);
    }
  };
  if (!existsDir(bundleRoot)) return out;
  walk(bundleRoot);
  return out.sort();
}

function existsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// --- OKF derived functions (§10.6 — ported verbatim, do not "improve") -------

export interface VerifiedEvent {
  by: string;
  at: string;
}

/**
 * Port of `normalize_verified`. A BARE MAPPING counts as a single-element list
 * (SPEC §5.2 MUST). Anything else that is not a mapping is dropped.
 */
export function normalizeVerified(frontmatter: YamlMap): VerifiedEvent[] {
  const raw = frontmatter.verified;
  const events: VerifiedEvent[] = [];
  const push = (v: YamlValue): void => {
    if (!isMap(v)) return;
    events.push({ by: str(v.by), at: str(v.at) });
  };
  if (isMap(raw)) push(raw);
  else if (isList(raw)) for (const item of raw) push(item);
  return events;
}

export type TrustTier = "unverified" | "machine-confirmed" | "human-reviewed";

/**
 * Port of `trust_tier`. No `verified` events → unverified; any `human:` actor →
 * human-reviewed; otherwise (e.g. `process:` or a producer/version actor) →
 * machine-confirmed. DERIVED — never stored on the card (§4.3).
 */
export function trustTier(frontmatter: YamlMap): TrustTier {
  const events = normalizeVerified(frontmatter);
  if (events.length === 0) return "unverified";
  return events.some((e) => e.by.startsWith("human:")) ? "human-reviewed" : "machine-confirmed";
}

/** `YYYY-MM-DD` (optionally an ISO8601 instant) → epoch day, or null. */
export function parseDate(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Port of `is_stale`. `today >= stale_after`. A MISSING or UNPARSEABLE
 * `stale_after` returns FALSE — the reference implementation fails OPEN, i.e.
 * "no expiry recorded" reads as "never expires". CONTRACT §8.2 calls this out
 * as the hole that makes `stale_after` a house-rule required field; the
 * validator closes it, this function must not.
 */
export function isStale(frontmatter: YamlMap, today: Date): boolean {
  const raw = str(frontmatter.stale_after);
  if (raw === "") return false;
  const when = parseDate(raw);
  if (when === null) return false;
  return today.getTime() >= when.getTime();
}

// --- Dedupe digest ----------------------------------------------------------

/**
 * The `# 规则` section — the ONLY range the dedupe digest covers (§6.5).
 * `# Rule` is accepted as an English alias so an English-authored card is not
 * silently un-dedupable. Returns null when the card has no rule section (a
 * Domain Knowledge card usually does not).
 */
export function ruleSection(body: string): string | null {
  // Line-scanned rather than one regex: a `$`-terminated lookahead under the
  // `m` flag stops at the FIRST line end, which silently yields an empty
  // capture and turns every card into "no rule section".
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^#[ \t]+(?:规则|Rule)[ \t]*$/.test(l));
  if (start === -1) return null;
  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#[ \t]/.test(line)) break;
    collected.push(line);
  }
  const text = collected.join("\n").trim();
  return text === "" ? null : text;
}

/** Whitespace- and footnote-normalized text, so formatting churn is not a new rule. */
export function normalizeRuleText(text: string): string {
  return text
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\r?\n\s*/g, " ")
    .trim()
    .toLowerCase();
}

export function ruleDigest(body: string): string | null {
  const section = ruleSection(body);
  if (section === null) return null;
  return createHash("sha256").update(normalizeRuleText(section), "utf8").digest("hex").slice(0, 32);
}

// --- Writer -----------------------------------------------------------------

/** §6.4 — the fixed top-level key order every writer emits. */
export const FRONTMATTER_KEY_ORDER = [
  "type",
  "title",
  "description",
  "tags",
  "status",
  "generated",
  "verified",
  "stale_after",
  "sources",
  "cde",
] as const;

/** Top-level keys in authored order (raw text scan — the writer's self-check). */
export function topLevelKeys(frontmatterRaw: string): string[] {
  const keys: string[] = [];
  for (const line of frontmatterRaw.replace(/\r\n/g, "\n").split("\n")) {
    if (line === "" || /^\s/.test(line) || line.startsWith("#")) continue;
    const split = splitKey(stripComment(line));
    if (split !== null) keys.push(split.key);
  }
  return keys;
}

/**
 * Key-order deviations against §6.4. Only keys present in both the card and the
 * canonical order are compared; an unknown extension key is ignored here (rule
 * 4 owns "is it allowed at all"). Returns [] when the order is canonical.
 */
export function keyOrderViolations(frontmatterRaw: string): string[] {
  const canonical = FRONTMATTER_KEY_ORDER as readonly string[];
  const present = topLevelKeys(frontmatterRaw).filter((k) => canonical.includes(k));
  const expected = canonical.filter((k) => present.includes(k));
  if (present.join(",") === expected.join(",")) return [];
  return [`top-level key order is "${present.join(", ")}" — §6.4 fixes it at "${expected.join(", ")}"`];
}

function emitScalar(value: YamlScalar): string {
  if (value === null) return "";
  if (value === "" || /^[\s]|[\s]$|^[&*!|>%@`]|: |#| #|^-$|^[[{]/.test(value)) return JSON.stringify(value);
  return value;
}

function emitFlowMap(map: YamlMap): string {
  const inner = Object.entries(map)
    .map(([k, v]) => `${k}: ${isMap(v) || isList(v) ? "?" : emitScalar(v as YamlScalar)}`)
    .join(", ");
  return `{ ${inner} }`;
}

function emitFlowSeq(items: YamlValue[]): string {
  return `[${items.map((v) => emitScalar(v as YamlScalar)).join(", ")}]`;
}

function emitValue(value: YamlValue, indent: number, flowMapKeys: Set<string>, key: string): string {
  const pad = " ".repeat(indent);
  if (isList(value)) {
    if (value.length === 0) return " []\n";
    // A short scalar list stays on one line. Without this the writer reflows an
    // untouched `tags: [a, b, c]` into three block-style lines the moment any
    // OTHER field changes — a 4-line diff for a field nobody edited, on every
    // card carry-affirmations touches. §6.4 fixes key ORDER for exactly this
    // reason (NFR-2: the git diff is the only human review surface), and style
    // drift defeats it just as thoroughly. Measured against the shipped
    // fixtures before the fix: every card drifted on line 5.
    if (FLOW_SEQ_KEYS.has(key) && value.every((v) => !isMap(v) && !isList(v))) {
      return ` ${emitFlowSeq(value)}\n`;
    }
    let out = "\n";
    for (const item of value) {
      if (isMap(item)) {
        const flow = flowMapKeys.has(key) && Object.values(item).every((v) => !isMap(v) && !isList(v));
        if (flow) {
          out += `${pad}  - ${emitFlowMap(item)}\n`;
        } else {
          const entries = Object.entries(item);
          out += entries
            .map(([k, v], i) =>
              i === 0
                ? `${pad}  - ${k}:${emitValue(v, indent + 4, flowMapKeys, k)}`
                : `${pad}    ${k}:${emitValue(v, indent + 4, flowMapKeys, k)}`,
            )
            .join("");
        }
      } else {
        out += `${pad}  - ${emitScalar(item as YamlScalar)}\n`;
      }
    }
    return out;
  }
  if (isMap(value)) {
    if (flowMapKeys.has(key) && Object.values(value).every((v) => !isMap(v) && !isList(v))) {
      return ` ${emitFlowMap(value)}\n`;
    }
    let out = "\n";
    for (const [k, v] of Object.entries(value)) out += `${pad}  ${k}:${emitValue(v, indent + 2, flowMapKeys, k)}`;
    return out;
  }
  return value === null ? "\n" : ` ${emitScalar(value)}\n`;
}

/** Keys whose mapping values are written inline, matching §6.5's sample. */
const FLOW_MAP_KEYS = new Set(["generated", "verified", "sanitization"]);

/** Keys whose scalar LISTS stay on one line, matching §6.5's sample. */
const FLOW_SEQ_KEYS = new Set(["tags"]);

/**
 * Serialize frontmatter with the §6.4 key order. Canonical keys first in that
 * order, then any remaining keys in their input order (so an unknown extension
 * key round-trips instead of being dropped — OKF §11 requires consumers to
 * preserve unknown keys).
 */
export function serializeFrontmatter(frontmatter: YamlMap): string {
  const canonical = FRONTMATTER_KEY_ORDER as readonly string[];
  const ordered = [
    ...canonical.filter((k) => k in frontmatter),
    ...Object.keys(frontmatter).filter((k) => !canonical.includes(k)),
  ];
  let out = "";
  for (const key of ordered) {
    const value = frontmatter[key];
    if (isList(value) && value.length === 0) {
      out += `${key}: []\n`;
      continue;
    }
    out += `${key}:${emitValue(value as YamlValue, 0, FLOW_MAP_KEYS, key)}`;
  }
  return out;
}

export function serializeCard(frontmatter: YamlMap, body: string): string {
  const trimmed = body.replace(/^\s*\n/, "").replace(/\s*$/, "");
  return `---\n${serializeFrontmatter(frontmatter)}---\n\n${trimmed}\n`;
}

// --- CLI --------------------------------------------------------------------

export function runCli(argv: string[]): number {
  const [cmd, target] = argv;
  if (cmd !== "show" || target === undefined) {
    process.stderr.write("Usage: aidlc-akp-cards.ts show <card.md> [--bundle <dir>]\n");
    return 2;
  }
  const bundleIdx = argv.indexOf("--bundle");
  const bundle = bundleIdx >= 0 ? (argv[bundleIdx + 1] ?? ".") : ".";
  const read = readCard(bundle, target);
  if (!read.ok) {
    process.stderr.write(`${read.failure.id}: ${read.failure.error}\n`);
    return 1;
  }
  const { card } = read;
  process.stdout.write(
    `${JSON.stringify(
      {
        id: card.id,
        type: str(card.frontmatter.type),
        title: str(card.frontmatter.title),
        status: str(card.frontmatter.status) || "stable",
        trust_tier: trustTier(card.frontmatter),
        verified: normalizeVerified(card.frontmatter),
        stale: isStale(card.frontmatter, new Date()),
        stale_after: str(card.frontmatter.stale_after),
        rule_digest: ruleDigest(card.body),
      },
      null,
      2,
    )}\n`,
  );
  return 0;
}

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));
