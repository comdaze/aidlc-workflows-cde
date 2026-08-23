// aidlc-akp-registry.ts — the consume-side index, COMPUTED, never stored
// (team-knowledge plugin).
//
// CONTRACT.md §4.3 rejects committing a `registry.json`: every MR would have to
// rewrite that one shared file, which kills "one card per file never conflicts"
// (NFR-1) and adds a "forgot to regenerate" silent-failure mode. So the index is
// derived here, at consume time, from frontmatter only — which is also how
// NFR-5 is met: the pull stage reads THIS table, then fetches the handful of
// cards it actually wants.
//
//   bun aidlc-akp-registry.ts --bundle <dir> [--tags a,b] [--type "Practice"]
//        [--domain <topic>] [--seat <agent-slug>] [--query <text>]
//        [--include-deprecated] [--stale-only] [--today YYYY-MM-DD]
//        [--limit <n>] [--json | --markdown]
//
// Exit 0 always when the bundle is readable (an empty result set is an answer).
import { resolve } from "node:path";
import {
  type YamlMap,
  conceptId,
  discoverCardPaths,
  errorMessage,
  isList,
  isStale,
  parseDate,
  extPath,
  path as dig,
  readCard,
  str,
  trustTier,
} from "./aidlc-akp-cards.ts";

export interface RegistryEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
  status: string;
  trust_tier: string;
  stale: boolean;
  stale_after: string;
  verified_at: string;
  class: string;
  generalization: string;
  /** Practice: the target team.md heading. Domain Knowledge: the knowledge seat. */
  destination: string;
  origin_project: string;
  supersedes: string;
  path: string;
}

export interface RegistryFilter {
  tags?: string[];
  type?: string;
  domain?: string;
  seat?: string;
  query?: string;
  includeDeprecated?: boolean;
  staleOnly?: boolean;
  limit?: number;
}

function lastVerifiedAt(fm: YamlMap): string {
  const raw = fm.verified;
  const events = isList(raw) ? raw : raw === undefined ? [] : [raw];
  const dates = events
    .map((e) => str(dig("at", e)))
    .map((s) => ({ s, d: parseDate(s) }))
    .filter((x): x is { s: string; d: Date } => x.d !== null)
    .sort((a, b) => b.d.getTime() - a.d.getTime());
  return dates[0]?.s ?? "";
}

function topicOf(id: string): string {
  const seg = id.split("/");
  if (seg[0] === "knowledge") return (seg[1] === "domains" ? seg[2] : seg[1]) ?? "";
  return seg[1] ?? "";
}

export function buildRegistry(bundleRoot: string, today: Date): { entries: RegistryEntry[]; unreadable: string[] } {
  const entries: RegistryEntry[] = [];
  const unreadable: string[] = [];
  for (const abs of discoverCardPaths(bundleRoot)) {
    const read = readCard(bundleRoot, abs);
    if (!read.ok) {
      unreadable.push(`${read.failure.id}: ${read.failure.error}`);
      continue;
    }
    const { card } = read;
    const fm = card.frontmatter;
    const type = str(fm.type);
    entries.push({
      id: card.id,
      type,
      title: str(fm.title),
      description: str(fm.description),
      tags: isList(fm.tags) ? fm.tags.map((t) => str(t)).filter((t) => t !== "") : [],
      status: str(fm.status) || "stable",
      trust_tier: trustTier(fm),
      stale: isStale(fm, today),
      stale_after: str(fm.stale_after),
      verified_at: lastVerifiedAt(fm),
      class: str(extPath("class", fm)),
      generalization: str(extPath("generalization", fm)),
      destination: type === "Practice" ? str(extPath("heading", fm)) : str(extPath("knowledge_seat", fm)),
      origin_project: str(extPath("origin.project", fm)),
      supersedes: str(extPath("supersedes", fm)),
      path: abs,
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  return { entries, unreadable };
}

export function filterRegistry(entries: RegistryEntry[], filter: RegistryFilter): RegistryEntry[] {
  const needle = filter.query?.toLowerCase();
  let out = entries.filter((e) => {
    if (!filter.includeDeprecated && e.status === "deprecated") return false;
    if (filter.staleOnly && !e.stale) return false;
    if (filter.type && e.type !== filter.type) return false;
    if (filter.seat && e.destination !== filter.seat) return false;
    if (filter.domain && topicOf(e.id) !== filter.domain) return false;
    if (filter.tags && filter.tags.length > 0 && !filter.tags.some((t) => e.tags.includes(t))) return false;
    if (needle) {
      const haystack = `${e.id} ${e.title} ${e.description} ${e.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  if (filter.limit !== undefined && filter.limit > 0) out = out.slice(0, filter.limit);
  return out;
}

export function renderMarkdown(entries: RegistryEntry[]): string {
  if (entries.length === 0) return "_no matching cards_\n";
  const rows = entries.map((e) => {
    const trust = e.stale ? `${e.trust_tier} ⚠ STALE` : e.trust_tier;
    return `| \`${e.id}\` | ${e.type} | ${e.title} | ${e.tags.join(", ")} | ${e.status} | ${trust} | ${e.stale_after} | ${e.destination} |`;
  });
  return [
    "| concept ID | type | title | tags | status | trust | stale_after | destination |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

interface Flags {
  bundle?: string;
  json: boolean;
  markdown: boolean;
  today?: string;
  filter: RegistryFilter;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { json: false, markdown: false, filter: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--bundle") flags.bundle = argv[++i];
    else if (arg === "--tags") flags.filter.tags = (argv[++i] ?? "").split(",").map((t) => t.trim()).filter((t) => t !== "");
    else if (arg === "--type") flags.filter.type = argv[++i];
    else if (arg === "--domain") flags.filter.domain = argv[++i];
    else if (arg === "--seat") flags.filter.seat = argv[++i];
    else if (arg === "--query") flags.filter.query = argv[++i];
    else if (arg === "--limit") flags.filter.limit = Number(argv[++i]);
    else if (arg === "--include-deprecated") flags.filter.includeDeprecated = true;
    else if (arg === "--stale-only") flags.filter.staleOnly = true;
    else if (arg === "--today") flags.today = argv[++i];
    else if (arg === "--json") flags.json = true;
    else if (arg === "--markdown") flags.markdown = true;
  }
  return flags;
}

export function runCli(argv: string[]): number {
  const flags = parseFlags(argv);
  if (!flags.bundle) {
    process.stderr.write(
      "Usage: aidlc-akp-registry.ts --bundle <dir> [--tags a,b] [--type T] [--domain D] [--seat S]\n" +
        "                            [--query text] [--include-deprecated] [--stale-only]\n" +
        "                            [--today YYYY-MM-DD] [--limit n] [--json|--markdown]\n",
    );
    return 2;
  }
  const today = flags.today ? parseDate(flags.today) : new Date();
  if (today === null) {
    process.stderr.write(`aidlc-akp-registry: --today "${flags.today}" is not YYYY-MM-DD\n`);
    return 2;
  }
  const bundleRoot = resolve(flags.bundle);
  let built: ReturnType<typeof buildRegistry>;
  try {
    built = buildRegistry(bundleRoot, today);
  } catch (e) {
    process.stderr.write(`aidlc-akp-registry: ${errorMessage(e)}\n`);
    return 2;
  }
  const matched = filterRegistry(built.entries, flags.filter);

  if (flags.json) {
    process.stdout.write(
      `${JSON.stringify(
        { bundle: bundleRoot, computed_at: today.toISOString().slice(0, 10), total: built.entries.length, matched: matched.length, unreadable: built.unreadable, entries: matched },
        null,
        2,
      )}\n`,
    );
    return 0;
  }
  if (flags.markdown) {
    process.stdout.write(renderMarkdown(matched));
    for (const problem of built.unreadable) process.stdout.write(`\n> unreadable: ${problem}\n`);
    return 0;
  }
  process.stdout.write(`${matched.length}/${built.entries.length} card(s) in ${bundleRoot}\n`);
  for (const e of matched) {
    process.stdout.write(
      `${e.id}\n  ${e.type} · ${e.status} · ${e.trust_tier}${e.stale ? " · STALE" : ""} · stale_after ${e.stale_after || "(absent)"}\n  ${e.title}\n  tags: ${e.tags.join(", ")}\n`,
    );
  }
  for (const problem of built.unreadable) process.stdout.write(`unreadable: ${problem}\n`);
  return 0;
}

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));
