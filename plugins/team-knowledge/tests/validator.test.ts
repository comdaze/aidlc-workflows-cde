import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isStale,
  normalizeVerified,
  parseYaml,
  readCard,
  ruleDigest,
  ruleSection,
  serializeCard,
  splitFrontmatter,
  topLevelKeys,
  trustTier,
  type YamlMap,
} from "../tools/aidlc-akp-cards.ts";
import { checkDeposit } from "../tools/aidlc-sensor-akp-push.ts";
import { checkPull } from "../tools/aidlc-sensor-akp-pull.ts";
import { buildRegistry, filterRegistry } from "../tools/aidlc-akp-registry.ts";
import { DEFAULT_POLICY, type Finding, validateBundle } from "../tools/aidlc-akp-validate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOOD = join(HERE, "fixtures", "hub");
const BAD = join(HERE, "fixtures", "bad");
const LEARNINGS_TOOL = join(HERE, "..", "..", "..", "dist", "claude", ".claude", "tools", "aidlc-learnings.ts");
const TODAY = new Date("2026-08-11T00:00:00Z");

function findingsFor(all: Finding[], card: string, rule?: string): Finding[] {
  return all.filter((f) => f.card === card && (rule === undefined || f.rule === rule));
}

function fmOf(relPath: string): YamlMap {
  const read = readCard(BAD, join(BAD, relPath));
  if (!read.ok) throw new Error(`${relPath}: ${read.failure.error}`);
  return read.card.frontmatter;
}

// --- §10.6: the three ported OKF derived functions ---------------------------

describe("OKF derived functions (§10.6 — ported, not reinvented)", () => {
  test("a bare `verified` mapping normalises to a single-element list (SPEC §5.2 MUST)", () => {
    const events = normalizeVerified(fmOf("bare-verified.md"));
    expect(events).toEqual([{ by: "human:alice", at: "2026-08-09" }]);
  });

  test("trust tier has exactly three states, and `process:` lands on machine-confirmed", () => {
    expect(trustTier(fmOf("bare-verified.md"))).toBe("human-reviewed");
    expect(trustTier(fmOf("no-stale-after.md"))).toBe("machine-confirmed");
    expect(trustTier(parseYaml("type: Practice\ntitle: x") as YamlMap)).toBe("unverified");
  });

  test("a missing stale_after makes is_stale FALSE — the fail-open is pinned on purpose (§8.2)", () => {
    // If a future change "fixes" this to true, the forgetting mechanism silently
    // changes meaning for every card with no clock. Break this test deliberately
    // or not at all.
    expect(isStale(fmOf("no-stale-after.md"), TODAY)).toBe(false);
    expect(isStale(parseYaml("stale_after: not-a-date") as YamlMap, TODAY)).toBe(false);
    expect(isStale(parseYaml("stale_after: 2026-08-11") as YamlMap, TODAY)).toBe(true);
    expect(isStale(parseYaml("stale_after: 2026-08-12") as YamlMap, TODAY)).toBe(false);
  });
});

// --- the YAML subset the card schema actually uses ---------------------------

describe("card frontmatter reader", () => {
  test("reads a flow mapping wrapped across lines (§6.6's sample shape)", () => {
    const fm = fmOf("bad-seat.md");
    const wrapped = readCard(GOOD, join(GOOD, "knowledge", "domains", "spot-market", "intraday-price-shape.md"));
    if (!wrapped.ok) throw new Error(wrapped.failure.error);
    const origin = (wrapped.card.frontmatter.cde as YamlMap).origin as YamlMap;
    expect(origin.project).toBe("agentic-power-trading");
    expect(origin.content_key).toBe("70e94c13bfa0f8ca");
    expect(origin.content_key_scope).toBe("project");
    expect((fm.cde as YamlMap).knowledge_seat).toBe("aidlc-turbine-agent");
  });

  test("an unterminated frontmatter block is an error, not a silent partial read", () => {
    const split = splitFrontmatter("---\ntype: Practice\n\n# 规则\n");
    expect("error" in split).toBe(true);
  });

  test("the dedupe digest covers the `# 规则` section only, normalised", () => {
    const wrapped = "# 规则\n\nOne rule,\nwrapped over lines.[^s]\n\n# 为什么\n\nIrrelevant to the digest.\n";
    const flat = "# 规则\n\nOne rule, wrapped over lines.\n\n# 为什么\n\nSomething else entirely.\n";
    expect(ruleSection(wrapped)).toContain("wrapped over lines");
    expect(ruleDigest(wrapped)).toBe(ruleDigest(flat));
    expect(ruleDigest("# 领域事实\n\nNo rule section here.\n")).toBeNull();
  });
});

// --- the good bundle --------------------------------------------------------

describe("a conforming bundle passes the produce-side gate", () => {
  const report = validateBundle({ bundleRoot: GOOD, mode: "produce", today: TODAY });

  test("no blocking findings", () => {
    if (report.rejected) throw new Error(report.findings.map((f) => `§11.${f.rule} ${f.card}: ${f.message}`).join("\n"));
    expect(report.cards_checked).toBe(3);
  });

  test("no warnings either — the fixture cards use the controlled vocabulary and the canonical key order", () => {
    if (report.warnings.length > 0) throw new Error(report.warnings.map((f) => `${f.card}: ${f.message}`).join("\n"));
  });

  test("the clock is derived per type AND per topic — aws has the short half-life", () => {
    expect(DEFAULT_POLICY.half_life_days["Domain Knowledge:aws"]).toBe(120);
    // knowledge/aws/… verified 2026-08-09 + 120d = 2026-12-07, which the card declares.
    const read = readCard(GOOD, join(GOOD, "knowledge", "aws", "region-availability-probe.md"));
    if (!read.ok) throw new Error(read.failure.error);
    expect(read.card.frontmatter.stale_after).toBe("2026-12-07");
  });
});

// --- §11 rule table --------------------------------------------------------

describe("§11 rule table — produce mode", () => {
  const report = validateBundle({ bundleRoot: BAD, mode: "produce", today: TODAY });
  const all = [...report.findings, ...report.warnings];

  test("rule 1: unparseable / unterminated frontmatter is okf-nonconformant", () => {
    const hits = findingsFor(report.findings, "unterminated", "1");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.verdict).toBe("okf-nonconformant");
  });

  test("rule 2: a missing `type` is okf-nonconformant, not a house-rule breach", () => {
    const hits = findingsFor(report.findings, "no-type", "2");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.verdict).toBe("okf-nonconformant");
  });

  test("rule 5: the clock is reverse-computed — a hand-typed 2099 is rejected", () => {
    const hits = findingsFor(report.findings, "bad-clock", "5");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.message).toContain("2027-02-05");
  });

  test("rule 6: deny patterns match inside FRONTMATTER values, not just the body", () => {
    const hits = findingsFor(report.findings, "deny-hit", "6");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.message.includes("AKIA"))).toBe(true);
  });

  test("rule 7: exact duplicates are caught, in both directions", () => {
    expect(findingsFor(report.findings, "dup-a", "7").length).toBe(1);
    expect(findingsFor(report.findings, "dup-b", "7").length).toBe(1);
    expect(findingsFor(report.findings, "dup-a", "7")[0]?.message).toContain("dup-b");
  });

  test("rule 7: a NEAR duplicate is NOT caught — §13.1's limit, pinned so nobody assumes it is solved", () => {
    // The only defence against a re-worded duplicate is CODEOWNERS review. If
    // this test ever starts failing because near-duplicates are detected, that
    // is a real feature — update §13.1 in the same change.
    expect(findingsFor(all, "near-dup", "7")).toHaveLength(0);
  });

  test("rule 8: a deprecated card with no successor link is rejected", () => {
    expect(findingsFor(report.findings, "deprecated-orphan", "8").length).toBe(1);
  });

  test("rule 8: splitting a supersession across two MRs is rejected", () => {
    const hits = findingsFor(report.findings, "supersede-split", "8");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.message).toContain("supersede-target");
    expect(hits[0]?.message).toContain("deprecated");
  });

  test("rule 9: heading vocabulary and the team-only memory target", () => {
    const hits = findingsFor(report.findings, "bad-heading", "9");
    expect(hits.map((h) => h.message).join(" ")).toContain("## House Rules");
    expect(hits.some((h) => h.message.includes('must be "team"'))).toBe(true);
  });

  test("rule 10: an unknown knowledge seat is rejected", () => {
    expect(findingsFor(report.findings, "bad-seat", "10")[0]?.message).toContain("aidlc-turbine-agent");
  });

  test("rule 11: an out-of-vocabulary tag is a WARNING, never a rejection", () => {
    const hits = findingsFor(all, "bad-heading", "11");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.verdict).toBe("warning");
    expect(report.findings.some((f) => f.rule === "11")).toBe(false);
  });

  test("rule 12: shuffled key order is a WARNING on a hand-edited card", () => {
    const hits = findingsFor(all, "key-order", "12");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.verdict).toBe("warning");
  });

  test("a Practice card with no `# 规则` section cannot be persisted, so it is rejected", () => {
    const dir = mkdtempSync(join(tmpdir(), "akp-noruled-"));
    writeFileSync(
      join(dir, "card.md"),
      "---\ntype: Practice\ntitle: t\ndescription: d\ntags: [testing]\nstatus: stable\n" +
        "generated: { by: process:x, at: 2026-08-09 }\nverified:\n  - { by: human:a, at: 2026-08-09 }\n" +
        "stale_after: 2027-02-05\nsources:\n  - id: s\n    resource: docs/x.md\n" +
        "cde:\n  class: judges\n  generalization: industry-generic\n  origin:\n    project: p\n    intent: i\n" +
        "    stage: s\n    content_key: k\n    content_key_scope: project\n  sanitization: { by: human:a, at: 2026-08-09 }\n" +
        '  memory_target: team\n  heading: "## Mandated"\n---\n\n# 为什么\n\nNo rule section at all.\n',
    );
    const only = validateBundle({ bundleRoot: dir, mode: "produce", today: TODAY });
    expect(only.findings.some((f) => f.rule === "7" && f.message.includes("# 规则"))).toBe(true);
  });
});

// --- §6.2: the two-verdict split -------------------------------------------

describe("§6.2 — the same validator, two judgements", () => {
  test("a legal OKF card with no cde: block is REJECTED when we produce", () => {
    const report = validateBundle({ bundleRoot: BAD, mode: "produce", today: TODAY });
    expect(findingsFor(report.findings, "no-cde", "4").some((f) => f.message.startsWith("the cde: block is required"))).toBe(true);
  });

  test("…and only WARNED about when we consume someone else's bundle", () => {
    const report = validateBundle({ bundleRoot: BAD, mode: "consume", today: TODAY });
    expect(findingsFor(report.findings, "no-cde")).toHaveLength(0);
    expect(findingsFor(report.warnings, "no-cde", "4").length).toBeGreaterThan(0);
  });

  test("consume mode still hard-rejects the three OKF requirements", () => {
    const report = validateBundle({ bundleRoot: BAD, mode: "consume", today: TODAY });
    expect(report.rejected).toBe(true);
    expect(report.findings.every((f) => f.verdict === "okf-nonconformant")).toBe(true);
    expect(report.findings.map((f) => f.card).sort()).toEqual(["no-type", "unterminated"]);
  });
});

// --- the computed registry -------------------------------------------------

describe("the registry is computed, never committed (§4.3)", () => {
  const { entries } = buildRegistry(GOOD, TODAY);

  test("indexes every card with its derived trust tier and staleness", () => {
    expect(entries.map((e) => e.id)).toEqual([
      "knowledge/aws/region-availability-probe",
      "knowledge/domains/spot-market/intraday-price-shape",
      "practices/data-boundary/mock-data-synthesis",
    ]);
    const aws = entries.find((e) => e.id === "knowledge/aws/region-availability-probe");
    expect(aws?.trust_tier).toBe("human-reviewed");
    expect(aws?.stale).toBe(false);
    expect(aws?.destination).toBe("aidlc-aws-platform-agent");
  });

  test("filters by type, tag, domain topic, and free text", () => {
    expect(filterRegistry(entries, { type: "Practice" }).map((e) => e.id)).toEqual([
      "practices/data-boundary/mock-data-synthesis",
    ]);
    expect(filterRegistry(entries, { domain: "aws" }).map((e) => e.id)).toEqual([
      "knowledge/aws/region-availability-probe",
    ]);
    expect(filterRegistry(entries, { tags: ["spot-market"] })).toHaveLength(1);
    expect(filterRegistry(entries, { query: "synthetic" })).toHaveLength(1);
  });

  test("the same clock as the validator decides staleness", () => {
    const future = buildRegistry(GOOD, new Date("2027-06-01T00:00:00Z"));
    const stale = future.entries.filter((e) => e.stale).map((e) => e.id);
    expect(stale).toContain("knowledge/aws/region-availability-probe");
    expect(stale).toContain("practices/data-boundary/mock-data-synthesis");
    expect(stale).not.toContain("knowledge/domains/spot-market/intraday-price-shape");
  });
});

// --- the writer ------------------------------------------------------------

describe("the writer holds the §6.4 key order", () => {
  test("serialisation is canonical and round-trips", () => {
    const read = readCard(GOOD, join(GOOD, "practices", "data-boundary", "mock-data-synthesis.md"));
    if (!read.ok) throw new Error(read.failure.error);
    const rewritten = serializeCard(read.card.frontmatter, read.card.body);
    const split = splitFrontmatter(rewritten);
    if ("error" in split) throw new Error(split.error);
    expect(topLevelKeys(split.frontmatterRaw)).toEqual([
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
    ]);
    const reparsed = parseYaml(split.frontmatterRaw) as YamlMap;
    expect(reparsed.stale_after).toBe("2027-02-05");
    expect(normalizeVerified(reparsed)).toEqual(normalizeVerified(read.card.frontmatter));
  });

  // The two assertions above are why a real style regression got through: they
  // check key ORDER and SEMANTIC equality, and a reflowed `tags:` breaks
  // neither. A fixed-point check (serialise twice, compare) would not have
  // caught it either — block style is a perfectly stable fixed point. The
  // property that actually protects NFR-2 is that the HAND-AUTHORED canonical
  // form and the MACHINE-WRITTEN canonical form are the same bytes, so a bot
  // touching one field changes exactly one field in the diff a human reviews.
  //
  // Measured before the fix: `tags: [aws, aws-cn]` came back as three block
  // lines, shifting every following line — on every card carry-affirmations
  // touched.
  test("a hand-authored canonical card survives a rewrite BYTE for byte", () => {
    // intraday-price-shape.md is excluded on purpose: it authors `cde.origin`
    // as a flow map wrapped across lines to exercise the parser (see the §6.6
    // test above), and block style is the writer's canonical form for it. Its
    // one-time normalisation is asserted separately below.
    const canonical = [
      join("practices", "data-boundary", "mock-data-synthesis.md"),
      join("knowledge", "aws", "region-availability-probe.md"),
    ];
    for (const rel of canonical) {
      const abs = join(GOOD, rel);
      const raw = readFileSync(abs, "utf-8");
      const read = readCard(GOOD, abs);
      if (!read.ok) throw new Error(read.failure.error);
      const rewritten = serializeCard(read.card.frontmatter, read.card.body);
      if (rewritten !== raw) {
        const a = raw.split("\n");
        const b = rewritten.split("\n");
        const first = a.findIndex((line, i) => line !== b[i]);
        throw new Error(
          `${rel} does not round-trip: line ${first + 1}\n  on disk: ${JSON.stringify(a[first])}\n  rewrite: ${JSON.stringify(b[first])}`,
        );
      }
    }
  });

  test("normalisation is one-time: the wrapped card reaches the canonical form and stays", () => {
    const abs = join(GOOD, "knowledge", "domains", "spot-market", "intraday-price-shape.md");
    const read = readCard(GOOD, abs);
    if (!read.ok) throw new Error(read.failure.error);
    const once = serializeCard(read.card.frontmatter, read.card.body);
    const dir = mkdtempSync(join(tmpdir(), "akp-fixedpoint-"));
    const out = join(dir, "card.md");
    writeFileSync(out, once);
    const again = readCard(dir, out);
    if (!again.ok) throw new Error(again.failure.error);
    expect(serializeCard(again.card.frontmatter, again.card.body)).toBe(once);
    // And the normalised card still validates — normalisation must not break §11.
    expect(validateBundle({ bundleRoot: dir, mode: "produce", today: TODAY }).rejected).toBe(false);
  });

  test("a shuffled card round-trips into the canonical order", () => {
    const read = readCard(BAD, join(BAD, "key-order.md"));
    if (!read.ok) throw new Error(read.failure.error);
    const dir = mkdtempSync(join(tmpdir(), "akp-writer-"));
    const out = join(dir, "card.md");
    writeFileSync(out, serializeCard(read.card.frontmatter, read.card.body));
    const again = readCard(dir, out);
    if (!again.ok) throw new Error(again.failure.error);
    const report = validateBundle({ bundleRoot: dir, mode: "produce", today: TODAY });
    expect(report.warnings.some((w) => w.rule === "12")).toBe(false);
    expect(report.rejected).toBe(false);
  });
});

// --- the two sensors -------------------------------------------------------

describe("akp-pull sensor", () => {
  const block = (extra: string): string => `# record\n\n\`\`\`yaml\npull:\n${extra}\`\`\`\n`;
  const base =
    "  repo_url: https://example.com/team/knowledge.git\n" +
    "  repo_url_source: memory-layer\n" +
    "  repo_probe: git-ls-remote-ok\n" +
    "  probed_at: 2026-08-11\n" +
    "  sources_searched:\n    - https://example.com/team/knowledge.git @ 2026-08-11\n";

  test("accepts a complete cards-imported record", () => {
    const result = checkPull(
      block(
        `  resolution: cards-imported\n${base}  imported:\n    - practices/data-boundary/mock-data-synthesis\n` +
          "  practices_persisted:\n    - practices/data-boundary/mock-data-synthesis\n  persist_slug: team-knowledge-pull\n",
      ),
    );
    if (!result.pass) throw new Error(result.findings.join("\n"));
  });

  // Named for what it checks. It does NOT cover "skipped the persist ritual" —
  // its card IS in practices_persisted — and carrying that name meant the real
  // skip case went unasserted (and, below, was asserted as ALLOWED).
  test("a claimed persist with no persist_slug is rejected", () => {
    const result = checkPull(
      block(
        `  resolution: cards-imported\n${base}  imported:\n    - practices/x/y\n  practices_persisted:\n    - practices/x/y\n`,
      ),
    );
    expect(result.pass).toBe(false);
    expect(result.findings.join(" ")).toContain("persist_slug");
  });

  // FR-11/§9.2. The empty list is legitimate ONLY when no Practice card was
  // imported, so the fixture must not import one — the previous version of this
  // test imported `practices/x/y` and asserted pass, which enshrined the hole:
  // a record could claim a Practice import while the memory file was edited by
  // hand. Measured on a hand-written artifact before the fix: pass, 0 findings.
  test("an absent practices_persisted key is a finding — an empty list is not, when nothing was imported that needs it", () => {
    const withEmpty = checkPull(
      `# r\n\n\`\`\`yaml\npull:\n  resolution: cards-imported\n${base}  imported:\n    - knowledge/aws/x\n  practices_persisted: []\n\`\`\`\n`,
    );
    expect(withEmpty.pass).toBe(true);
    const withNone = checkPull(block(`  resolution: cards-imported\n${base}  imported:\n    - practices/x/y\n`));
    expect(withNone.findings.join(" ")).toContain("practices_persisted");
  });

  test("an imported Practice card missing from practices_persisted is rejected (FR-11)", () => {
    const result = checkPull(
      `# r\n\n\`\`\`yaml\npull:\n  resolution: cards-imported\n${base}  imported:\n    - practices/x/y\n    - knowledge/aws/z\n  practices_persisted: []\n\`\`\`\n`,
    );
    expect(result.pass).toBe(false);
    const joined = result.findings.join(" ");
    expect(joined).toContain("practices/x/y");
    expect(joined).toContain("FR-11");
    // The Domain Knowledge card is not implicated — it never goes through persist.
    expect(joined).not.toContain("knowledge/aws/z");
  });

  test("importing a stale card requires a named re-affirmer (FR-13)", () => {
    const result = checkPull(
      block(
        `  resolution: cards-imported\n${base}  imported:\n    - practices/x/y\n  practices_persisted: []\n` +
          "  stale_imported:\n    - practices/x/y\n",
      ),
    );
    expect(result.pass).toBe(false);
    expect(result.findings.join(" ")).toContain("stale_reconfirmed_by");
  });

  test("report-only is the honest degraded path, and may not claim a persist", () => {
    const good = checkPull(
      block(
        `  resolution: report-only\n${base}  blocked_reason: --single has no synthesized intent\n  owner: human:alice\n  handoff:\n    - practices/x/y\n`,
      ),
    );
    if (!good.pass) throw new Error(good.findings.join("\n"));
    const lying = checkPull(
      block(
        `  resolution: report-only\n${base}  blocked_reason: r\n  owner: human:alice\n  handoff:\n    - practices/x/y\n  practices_persisted:\n    - practices/x/y\n`,
      ),
    );
    expect(lying.pass).toBe(false);
  });

  test("there is no skip resolution, and a bare local path is not a repo", () => {
    expect(checkPull(block(`  resolution: skipped\n${base}`)).pass).toBe(false);
    expect(checkPull(block(`  resolution: no-card-match\n  repo_url: /Users/me/kb\n  repo_probe: git-ls-remote-ok\n  sources_searched:\n    - x\n  search_terms:\n    - t\n`)).pass).toBe(false);
    expect(checkPull("no yaml block at all").pass).toBe(false);
  });
});

describe("akp-push sensor", () => {
  const base =
    "  repo_url: git@example.com:team/knowledge.git\n" +
    "  repo_url_source: pull-artifact\n" +
    "  repo_probe: git-ls-remote-ok\n" +
    "  probed_at: 2026-08-11\n" +
    "  validate: akp-validate-ok\n" +
    "  sanitization_approved_by: human:alice\n" +
    "  cards:\n    - practices/data-boundary/mock-data-synthesis\n";
  const block = (extra: string): string => `# record\n\n\`\`\`yaml\ndeposit:\n${extra}\`\`\`\n`;

  test("accepts a merge-request-opened record", () => {
    const result = checkDeposit(
      block(`  resolution: merge-request-opened\n${base}  branch: knowledge/2026-08-11-data-boundary\n  review_url: https://example.com/mr/1\n`),
    );
    if (!result.pass) throw new Error(result.findings.join("\n"));
  });

  test("a deposit that skipped the local validator is rejected (FR-5)", () => {
    const result = checkDeposit(
      block(
        "  resolution: merge-request-opened\n  repo_url: git@example.com:team/knowledge.git\n  repo_probe: git-ls-remote-ok\n" +
          "  sanitization_approved_by: human:alice\n  cards:\n    - practices/x/y\n  branch: b\n  review_url: https://example.com/mr/1\n",
      ),
    );
    expect(result.pass).toBe(false);
    expect(result.findings.join(" ")).toContain("akp-validate-ok");
  });

  test("a refused push is an owned handoff, never a skip (FR-6)", () => {
    const owned = checkDeposit(
      block(`  resolution: patch-prepared\n${base}  patch_path: 0001-knowledge.patch\n  owner: human:bob\n  blocked_reason: no write access\n`),
    );
    if (!owned.pass) throw new Error(owned.findings.join("\n"));
    const unowned = checkDeposit(block(`  resolution: patch-prepared\n${base}  patch_path: 0001.patch\n`));
    expect(unowned.pass).toBe(false);
    expect(checkDeposit(block(`  resolution: skipped\n${base}`)).pass).toBe(false);
  });

  test("re-grading a project.md rule to team level needs a named approver (FR-2)", () => {
    const result = checkDeposit(
      block(
        `  resolution: branch-pushed\n${base}  branch: b\n  owner: human:bob\n  reclassified_from_project:\n    - practices/x/y\n`,
      ),
    );
    expect(result.pass).toBe(false);
    expect(result.findings.join(" ")).toContain("reclassification_approved_by");
  });

  test("sanitization must be named — the deny patterns are only the backstop", () => {
    const result = checkDeposit(
      block(
        "  resolution: branch-pushed\n  repo_url: git@example.com:team/knowledge.git\n  repo_probe: git-ls-remote-ok\n" +
          "  validate: akp-validate-ok\n  cards:\n    - practices/x/y\n  branch: b\n  owner: human:bob\n",
      ),
    );
    expect(result.pass).toBe(false);
    expect(result.findings.join(" ")).toContain("sanitization_approved_by");
  });
});

// --- §9.2: the persist contract --------------------------------------------

describe("§9.2 — the selections the pull stage builds are accepted by the real persist tool", () => {
  test("aidlc-learnings.ts parses a card-derived selections file without complaint", async () => {
    const read = readCard(GOOD, join(GOOD, "practices", "data-boundary", "mock-data-synthesis.md"));
    if (!read.ok) throw new Error(read.failure.error);
    const rule = ruleSection(read.card.body);
    expect(rule).toBeTruthy();

    const dir = mkdtempSync(join(tmpdir(), "akp-persist-"));
    const selections = join(dir, "selections.json");
    writeFileSync(
      selections,
      JSON.stringify(
        {
          stage_slug: "team-knowledge-pull",
          selections: [
            {
              candidate_id: read.card.id,
              type: "learning",
              scope: (read.card.frontmatter.cde as YamlMap).memory_target,
              heading: (read.card.frontmatter.cde as YamlMap).heading,
              text: rule,
              source: "user_addition",
            },
          ],
        },
        null,
        2,
      ),
    );

    const proc = Bun.spawnSync([
      "bun",
      LEARNINGS_TOOL,
      "persist",
      "--slug",
      "team-knowledge-pull",
      "--selections-json",
      selections,
      "--project-dir",
      dir,
    ]);
    const stderr = new TextDecoder().decode(proc.stderr);

    // The shape must be ACCEPTED, and the write must actually land: `persist`
    // templates the memory file and the audit shard, so a bare project dir is
    // enough. What §10.5 forbids is running the STAGE under `--single` (no
    // synthesized intent); the tool contract itself holds here.
    expect(stderr).not.toContain("selections-json malformed");
    expect(stderr).not.toContain("selections-json is malformed");
    if (proc.exitCode !== 0) throw new Error(`persist exited ${proc.exitCode}: ${stderr}`);

    const written = readFileSync(join(dir, "aidlc", "spaces", "default", "memory", "team.md"), "utf-8");
    expect(written).toContain("## Mandated");
    // The concept ID is the candidate_id — stable, unique, and idempotent on re-run.
    expect(written).toContain(`cid:team-knowledge-pull:${read.card.id}`);

    // Re-running the same selections must be a no-op, not a duplicate line.
    const again = Bun.spawnSync([
      "bun",
      LEARNINGS_TOOL,
      "persist",
      "--slug",
      "team-knowledge-pull",
      "--selections-json",
      selections,
      "--project-dir",
      dir,
    ]);
    expect(again.exitCode).toBe(0);
    expect(readFileSync(join(dir, "aidlc", "spaces", "default", "memory", "team.md"), "utf-8")).toBe(written);
  });
});
