// aidlc-akp-lifecycle.ts — the three scheduled hub jobs, in one tool
// (team-knowledge plugin). CONTRACT.md §8.4.
//
//   review-debt         weekly  — who owes a review, grouped by CODEOWNERS
//   carry-affirmations  weekly  — spoke feedback → verified events + a moved clock
//   propose-archive     monthly — stale past the grace window → a human decision list
//
// Every one of them is PROPOSAL-SHAPED. A bot may open a merge request; a bot may
// never merge one (§8.4). None of these writes authoritative state on its own:
// with `--apply` they edit files on a branch that a human still has to merge.
// And each prints a NO-* marker when nothing changed, so a quiet week produces
// no commit, no MR, and no issue churn ("no-op runs are free", §4.1).
//
//   bun aidlc-akp-lifecycle.ts review-debt        --bundle <dir> [--horizon 30] [--markdown]
//   bun aidlc-akp-lifecycle.ts carry-affirmations --bundle <dir> [--apply]
//   bun aidlc-akp-lifecycle.ts propose-archive    --bundle <dir> [--apply]
//
// Exit 0 on success (including "nothing to do"), 2 on a usage/read error.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
  parseDate,
  readCard,
  serializeCard,
  str,
  trustTier,
} from "./aidlc-akp-cards.ts";
import { DEFAULT_POLICY, type Policy, halfLifeDays } from "./aidlc-akp-validate.ts";

function loadPolicy(bundleRoot: string): Policy {
  const file = join(bundleRoot, "policy", "lifecycle.json");
  if (!existsSync(file)) return DEFAULT_POLICY;
  const parsed = JSON.parse(readFileSync(file, "utf-8")) as Partial<Policy>;
  return {
    half_life_days: { ...DEFAULT_POLICY.half_life_days, ...(parsed.half_life_days ?? {}) },
    archive_grace_days: parsed.archive_grace_days ?? DEFAULT_POLICY.archive_grace_days,
    deny_patterns: parsed.deny_patterns ?? DEFAULT_POLICY.deny_patterns,
    controlled_tags: parsed.controlled_tags ?? DEFAULT_POLICY.controlled_tags,
  };
}

function loadCards(bundleRoot: string): { cards: Card[]; unreadable: string[] } {
  const cards: Card[] = [];
  const unreadable: string[] = [];
  for (const abs of discoverCardPaths(bundleRoot)) {
    const read = readCard(bundleRoot, abs);
    if (read.ok) cards.push(read.card);
    else unreadable.push(`${read.failure.id}: ${read.failure.error}`);
  }
  return { cards, unreadable };
}

function lastVerified(fm: YamlMap): Date | null {
  const raw = fm.verified;
  const events = isList(raw) ? raw : isMap(raw) ? [raw] : [];
  const dates = events
    .map((e) => parseDate(str(isMap(e) ? e.at : "")))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0] ?? null;
}

// --- CODEOWNERS -------------------------------------------------------------

interface OwnerRule {
  pattern: string;
  re: RegExp;
  owners: string[];
}

/**
 * Minimal CODEOWNERS reader. Last matching rule wins, which is what GitLab and
 * GitHub both do — a first-match implementation silently assigns the wrong
 * reviewer for every nested override.
 */
export function parseCodeowners(text: string): OwnerRule[] {
  const rules: OwnerRule[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
    const parts = trimmed.split(/\s+/);
    const pattern = parts[0] as string;
    const owners = parts.slice(1).filter((p) => p.startsWith("@") || p.includes("@"));
    if (owners.length === 0) continue;
    rules.push({ pattern, re: patternToRegExp(pattern), owners });
  }
  return rules;
}

function patternToRegExp(pattern: string): RegExp {
  let p = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  const anchoredDir = p.endsWith("/");
  if (anchoredDir) p = p.slice(0, -1);
  const escaped = p
    .split("/")
    .map((seg) => seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"))
    .join("/");
  // A bare `*` pattern, or a directory pattern, matches everything beneath it.
  return new RegExp(`^${escaped}(?:/.*)?$`);
}

export function ownersFor(rules: OwnerRule[], conceptPath: string): string[] {
  let owners: string[] = [];
  for (const rule of rules) if (rule.re.test(conceptPath)) owners = rule.owners;
  return owners;
}

// --- review-debt ------------------------------------------------------------

interface DebtRow {
  id: string;
  title: string;
  type: string;
  stale_after: string;
  days_overdue: number;
  trust_tier: string;
  disputed_by: string[];
  owners: string[];
}

export function reviewDebt(bundleRoot: string, today: Date, horizonDays: number): DebtRow[] {
  const { cards } = loadCards(bundleRoot);
  const codeownersPath = [join(bundleRoot, "CODEOWNERS"), join(bundleRoot, ".gitlab", "CODEOWNERS")].find((p) =>
    existsSync(p),
  );
  const rules = codeownersPath ? parseCodeowners(readFileSync(codeownersPath, "utf-8")) : [];
  const disputes = collectFeedback(bundleRoot).disputed;

  const rows: DebtRow[] = [];
  for (const card of cards) {
    if (str(card.frontmatter.status) === "deprecated") continue;
    const staleAfter = parseDate(str(card.frontmatter.stale_after));
    const disputedBy = disputes.get(card.id) ?? [];
    const due = staleAfter === null ? true : today.getTime() >= addDays(staleAfter, -horizonDays).getTime();
    if (!due && disputedBy.length === 0) continue;
    rows.push({
      id: card.id,
      title: str(card.frontmatter.title),
      type: str(card.frontmatter.type),
      stale_after: str(card.frontmatter.stale_after) || "(absent — never expires, which is itself the finding)",
      days_overdue:
        staleAfter === null ? 0 : Math.floor((today.getTime() - staleAfter.getTime()) / 86_400_000),
      trust_tier: trustTier(card.frontmatter),
      disputed_by: disputedBy,
      owners: ownersFor(rules, card.id),
    });
  }
  // Disputed first, in red; then most overdue.
  rows.sort((a, b) => {
    if ((b.disputed_by.length > 0 ? 1 : 0) !== (a.disputed_by.length > 0 ? 1 : 0)) {
      return (b.disputed_by.length > 0 ? 1 : 0) - (a.disputed_by.length > 0 ? 1 : 0);
    }
    return b.days_overdue - a.days_overdue;
  });
  return rows;
}

function renderDebt(rows: DebtRow[], today: Date): string {
  if (rows.length === 0) return "";
  const groups = new Map<string, DebtRow[]>();
  for (const row of rows) {
    const key = row.owners.length > 0 ? row.owners.join(" ") : "(no CODEOWNERS entry — maintainers)";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const out: string[] = [
    `# Review debt — ${isoDay(today)}`,
    "",
    "Re-affirming a card is two edits in ONE merge request: append a `verified`",
    "event and move `stale_after` forward by the policy half-life. The validator",
    "checks the two agree, with zero days of tolerance.",
    "",
    "A 🔴 row is disputed by a spoke project. A dispute does not deprecate",
    "anything — the falsification claim can itself be wrong. It puts the card",
    "first in this list; the correction is still a human opening a successor card.",
    "",
  ];
  for (const [owner, group] of [...groups.entries()].sort()) {
    out.push(`## ${owner}`, "");
    out.push("| card | type | stale_after | overdue | trust | note |");
    out.push("| --- | --- | --- | --- | --- | --- |");
    for (const row of group) {
      const note = row.disputed_by.length > 0 ? `🔴 disputed by ${row.disputed_by.join(", ")}` : "";
      out.push(
        `| \`${row.id}\` | ${row.type} | ${row.stale_after} | ${row.days_overdue > 0 ? `${row.days_overdue}d` : "due soon"} | ${row.trust_tier} | ${note} |`,
      );
    }
    out.push("");
  }
  return out.join("\n");
}

// --- feedback ---------------------------------------------------------------

interface Affirmation {
  card: string;
  by: string;
  at: string;
  source: string;
}

export function collectFeedback(bundleRoot: string): {
  affirmed: Affirmation[];
  disputed: Map<string, string[]>;
} {
  const dir = join(bundleRoot, "feedback");
  const affirmed: Affirmation[] = [];
  const disputed = new Map<string, string[]>();
  const walk = (d: string): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith(".json")) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(abs, "utf-8"));
      } catch {
        continue;
      }
      if (typeof parsed !== "object" || parsed === null) continue;
      const record = parsed as Record<string, unknown>;
      const rel = conceptId(bundleRoot, abs);
      for (const raw of Array.isArray(record.affirmed) ? record.affirmed : []) {
        if (typeof raw !== "object" || raw === null) continue;
        const item = raw as Record<string, unknown>;
        if (typeof item.card !== "string" || typeof item.by !== "string" || typeof item.at !== "string") continue;
        affirmed.push({ card: item.card, by: item.by, at: item.at, source: rel });
      }
      for (const raw of Array.isArray(record.disputed) ? record.disputed : []) {
        if (typeof raw !== "object" || raw === null) continue;
        const item = raw as Record<string, unknown>;
        if (typeof item.card !== "string" || typeof item.by !== "string") continue;
        disputed.set(item.card, [...(disputed.get(item.card) ?? []), item.by]);
      }
    }
  };
  walk(dir);
  return { affirmed, disputed };
}

// --- carry-affirmations -----------------------------------------------------

export interface CarryChange {
  id: string;
  added: Array<{ by: string; at: string }>;
  stale_after_from: string;
  stale_after_to: string;
}

export function carryAffirmations(
  bundleRoot: string,
  today: Date,
  apply: boolean,
): { changes: CarryChange[]; skipped: string[] } {
  const policy = loadPolicy(bundleRoot);
  const { cards } = loadCards(bundleRoot);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const { affirmed } = collectFeedback(bundleRoot);

  const perCard = new Map<string, Affirmation[]>();
  for (const a of affirmed) perCard.set(a.card, [...(perCard.get(a.card) ?? []), a]);

  const changes: CarryChange[] = [];
  const skipped: string[] = [];

  for (const [id, events] of [...perCard.entries()].sort()) {
    const card = byId.get(id);
    if (!card) {
      skipped.push(`${id}: affirmed in feedback but not a card in this bundle`);
      continue;
    }
    if (str(card.frontmatter.status) === "deprecated") {
      skipped.push(`${id}: deprecated — an affirmation does not revive it; supersede it instead`);
      continue;
    }
    const existing = isList(card.frontmatter.verified)
      ? card.frontmatter.verified
      : isMap(card.frontmatter.verified)
        ? [card.frontmatter.verified]
        : [];
    const seen = new Set(existing.filter(isMap).map((e) => `${str(e.by)}|${parseDateKey(str(e.at))}`));

    const added: Array<{ by: string; at: string }> = [];
    for (const event of events) {
      const at = parseDate(event.at);
      if (at === null) {
        skipped.push(`${id}: affirmation from ${event.source} has an unparseable date "${event.at}"`);
        continue;
      }
      if (at.getTime() > today.getTime()) {
        skipped.push(`${id}: affirmation dated ${event.at} is in the future — refused`);
        continue;
      }
      const key = `${event.by}|${isoDay(at)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      added.push({ by: event.by, at: isoDay(at) });
    }
    if (added.length === 0) continue;

    const merged = [...existing.filter(isMap), ...added.map((a) => ({ by: a.by, at: a.at }) as YamlMap)];
    const newest = merged
      .map((e) => parseDate(str((e as YamlMap).at)))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const window =
      Number(str((card.frontmatter.cde as YamlMap | undefined)?.review_interval_days)) ||
      halfLifeDays(policy, str(card.frontmatter.type), card.id);
    if (!newest || window === null) {
      skipped.push(`${id}: no half-life policy for type "${str(card.frontmatter.type)}"`);
      continue;
    }
    const to = isoDay(addDays(newest, window));
    const change: CarryChange = {
      id,
      added,
      stale_after_from: str(card.frontmatter.stale_after),
      stale_after_to: to,
    };
    changes.push(change);

    if (apply) {
      const next: YamlMap = { ...card.frontmatter, verified: merged, stale_after: to };
      writeFileSync(card.absPath, serializeCard(next, card.body));
    }
  }
  return { changes, skipped };
}

function parseDateKey(raw: string): string {
  const d = parseDate(raw);
  return d === null ? raw : isoDay(d);
}

// --- propose-archive --------------------------------------------------------

export interface ArchiveCandidate {
  id: string;
  title: string;
  stale_after: string;
  days_past_grace: number;
}

export function proposeArchive(bundleRoot: string, today: Date): ArchiveCandidate[] {
  const policy = loadPolicy(bundleRoot);
  const { cards } = loadCards(bundleRoot);
  const out: ArchiveCandidate[] = [];
  for (const card of cards) {
    if (str(card.frontmatter.status) === "deprecated") continue;
    if (!isStale(card.frontmatter, today)) continue;
    const staleAfter = parseDate(str(card.frontmatter.stale_after));
    if (staleAfter === null) continue;
    const deadline = addDays(staleAfter, policy.archive_grace_days);
    if (today.getTime() < deadline.getTime()) continue;
    out.push({
      id: card.id,
      title: str(card.frontmatter.title),
      stale_after: isoDay(staleAfter),
      days_past_grace: Math.floor((today.getTime() - deadline.getTime()) / 86_400_000),
    });
  }
  return out.sort((a, b) => b.days_past_grace - a.days_past_grace);
}

function renderArchiveProposal(candidates: ArchiveCandidate[], today: Date, graceDays: number): string {
  const lines = [
    `# Archive proposal — ${isoDay(today)}`,
    "",
    `These cards passed \`stale_after\` more than ${graceDays} days ago and nobody`,
    "re-affirmed them. For each one, a human picks exactly one of:",
    "",
    "1. **Re-affirm** — append a `verified` event and move `stale_after` (it is still true).",
    "2. **Supersede** — open a replacement card and flip this one to `deprecated`, in ONE merge request.",
    "3. **Accept the archive** — set `status: deprecated` with a note saying why nothing replaces it.",
    "",
    "This job deliberately does **not** flip `status` itself. A bare `deprecated`",
    "with no successor link is rejected by the validator (§11.8) — and rightly so:",
    "it would leave readers at a dead end. Archiving is a human decision, and this",
    "file only puts it in front of the person who owns it.",
    "",
    "| card | title | stale since | past grace |",
    "| --- | --- | --- | --- |",
    ...candidates.map((c) => `| \`${c.id}\` | ${c.title} | ${c.stale_after} | ${c.days_past_grace}d |`),
    "",
  ];
  return lines.join("\n");
}

// --- CLI --------------------------------------------------------------------

interface Flags {
  bundle?: string;
  today?: string;
  horizon: number;
  apply: boolean;
  json: boolean;
  markdown: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { horizon: 30, apply: false, json: false, markdown: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--bundle") flags.bundle = argv[++i];
    else if (arg === "--today") flags.today = argv[++i];
    else if (arg === "--horizon") flags.horizon = Number(argv[++i]);
    else if (arg === "--apply") flags.apply = true;
    else if (arg === "--json") flags.json = true;
    else if (arg === "--markdown") flags.markdown = true;
  }
  return flags;
}

function usage(): number {
  process.stderr.write(
    "Usage: aidlc-akp-lifecycle.ts <review-debt|carry-affirmations|propose-archive> --bundle <dir>\n" +
      "         [--today YYYY-MM-DD] [--horizon <days>] [--apply] [--json] [--markdown]\n",
  );
  return 2;
}

export function runCli(argv: string[]): number {
  const [command, ...rest] = argv;
  const flags = parseFlags(rest);
  if (!command || !flags.bundle) return usage();
  const today = flags.today ? parseDate(flags.today) : new Date();
  if (today === null) {
    process.stderr.write(`aidlc-akp-lifecycle: --today "${flags.today}" is not YYYY-MM-DD\n`);
    return 2;
  }
  const bundleRoot = resolve(flags.bundle);

  try {
    if (command === "review-debt") {
      const rows = reviewDebt(bundleRoot, today, flags.horizon);
      if (flags.json) {
        process.stdout.write(`${JSON.stringify({ computed_at: isoDay(today), rows }, null, 2)}\n`);
      } else if (rows.length === 0) {
        process.stdout.write("NO-DEBT — nothing due, nothing disputed. No issue update, no commit.\n");
      } else {
        process.stdout.write(renderDebt(rows, today));
      }
      return 0;
    }

    if (command === "carry-affirmations") {
      const { changes, skipped } = carryAffirmations(bundleRoot, today, flags.apply);
      if (flags.json) {
        process.stdout.write(`${JSON.stringify({ computed_at: isoDay(today), applied: flags.apply, changes, skipped }, null, 2)}\n`);
        return 0;
      }
      if (changes.length === 0) {
        process.stdout.write("NO-CHANGES — no new affirmation to carry. No commit, no MR.\n");
      } else {
        process.stdout.write(`${flags.apply ? "applied" : "would apply"} ${changes.length} card update(s):\n`);
        for (const change of changes) {
          process.stdout.write(
            `  ${change.id}: +${change.added.map((a) => `${a.by}@${a.at}`).join(", ")}; stale_after ${change.stale_after_from} -> ${change.stale_after_to}\n`,
          );
        }
      }
      for (const note of skipped) process.stdout.write(`  skipped: ${note}\n`);
      return 0;
    }

    if (command === "propose-archive") {
      const candidates = proposeArchive(bundleRoot, today);
      if (flags.json) {
        process.stdout.write(`${JSON.stringify({ computed_at: isoDay(today), candidates }, null, 2)}\n`);
        return 0;
      }
      if (candidates.length === 0) {
        process.stdout.write("NO-PROPOSAL — nothing stale beyond the grace window.\n");
        return 0;
      }
      const body = renderArchiveProposal(candidates, today, loadPolicy(bundleRoot).archive_grace_days);
      if (flags.apply) {
        writeFileSync(join(bundleRoot, "ARCHIVE-PROPOSAL.md"), body);
        process.stdout.write(`wrote ARCHIVE-PROPOSAL.md with ${candidates.length} candidate(s)\n`);
      } else {
        process.stdout.write(body);
      }
      return 0;
    }
  } catch (e) {
    process.stderr.write(`aidlc-akp-lifecycle: ${errorMessage(e)}\n`);
    return 2;
  }
  return usage();
}

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));
