import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeVerified, readCard, type YamlMap } from "../tools/aidlc-akp-cards.ts";
import { validateBundle } from "../tools/aidlc-akp-validate.ts";
import {
  carryAffirmations,
  collectFeedback,
  ownersFor,
  parseCodeowners,
  proposeArchive,
  reviewDebt,
} from "../tools/aidlc-akp-lifecycle.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOOD = join(HERE, "fixtures", "hub");
const PRACTICE = "practices/data-boundary/mock-data-synthesis";

/** A throwaway copy, because carry-affirmations and propose-archive write files. */
function scratchBundle(): string {
  const dir = mkdtempSync(join(tmpdir(), "team-knowledge-"));
  cpSync(GOOD, dir, { recursive: true });
  return dir;
}

function writeFeedback(bundle: string, body: unknown, name = "2026-11-01.json"): void {
  const dir = join(bundle, "feedback", "another-project");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(body, null, 2));
}

describe("CODEOWNERS routing (last match wins)", () => {
  const rules = parseCodeowners(readFileSync(join(GOOD, "CODEOWNERS"), "utf-8"));

  test("a nested rule overrides the broader one — first-match would misroute every override", () => {
    expect(ownersFor(rules, PRACTICE)).toEqual(["@security-reviewers"]);
    expect(ownersFor(rules, "practices/testing/some-card")).toEqual(["@practice-owners"]);
    expect(ownersFor(rules, "knowledge/aws/region-availability-probe")).toEqual(["@aws-specialists"]);
    expect(ownersFor(rules, "packs/energy/pack")).toEqual(["@knowledge-maintainers"]);
  });
});

describe("review-debt (weekly)", () => {
  test("a healthy bundle owes nothing — a quiet week produces no issue churn", () => {
    expect(reviewDebt(GOOD, new Date("2026-08-11T00:00:00Z"), 30)).toHaveLength(0);
  });

  test("cards past their clock surface, grouped by their owner, most overdue first", () => {
    const rows = reviewDebt(GOOD, new Date("2027-03-01T00:00:00Z"), 30);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("knowledge/aws/region-availability-probe");
    expect(ids).toContain(PRACTICE);
    expect(ids).not.toContain("knowledge/domains/spot-market/intraday-price-shape");
    // aws (stale 2026-12-07) is further overdue than the practice (2027-02-05).
    expect(ids[0]).toBe("knowledge/aws/region-availability-probe");
    expect(rows.find((r) => r.id === PRACTICE)?.owners).toEqual(["@security-reviewers"]);
  });

  test("the horizon pulls in cards that are due soon, not only overdue ones", () => {
    expect(reviewDebt(GOOD, new Date("2026-11-20T00:00:00Z"), 30).map((r) => r.id)).toEqual([
      "knowledge/aws/region-availability-probe",
    ]);
    expect(reviewDebt(GOOD, new Date("2026-11-20T00:00:00Z"), 0)).toHaveLength(0);
  });

  test("a disputed card is surfaced FIRST even while perfectly fresh — and is not deprecated", () => {
    const bundle = scratchBundle();
    writeFeedback(bundle, {
      project: "another-project",
      date: "2026-08-10",
      imported: [PRACTICE],
      disputed: [{ card: PRACTICE, by: "human:dave", at: "2026-08-10", evidence: "fitted mock passed review" }],
    });
    const rows = reviewDebt(bundle, new Date("2026-08-11T00:00:00Z"), 30);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(PRACTICE);
    expect(rows[0]?.disputed_by).toEqual(["human:dave"]);
    // A dispute never mutates the card: deprecation stays a human act.
    const read = readCard(bundle, join(bundle, `${PRACTICE}.md`));
    if (!read.ok) throw new Error(read.failure.error);
    expect(read.card.frontmatter.status).toBe("stable");
  });
});

describe("carry-affirmations (weekly)", () => {
  test("no feedback means no commit", () => {
    const { changes } = carryAffirmations(scratchBundle(), new Date("2026-09-01T00:00:00Z"), true);
    expect(changes).toHaveLength(0);
  });

  test("an affirmation appends a verified event AND moves the clock, together", () => {
    const bundle = scratchBundle();
    writeFeedback(bundle, {
      project: "another-project",
      date: "2026-11-01",
      imported: [PRACTICE],
      affirmed: [{ card: PRACTICE, by: "human:dave", at: "2026-11-01" }],
    });
    const { changes } = carryAffirmations(bundle, new Date("2026-11-02T00:00:00Z"), true);
    expect(changes).toHaveLength(1);
    // Practice half-life is 180 days: 2026-11-01 + 180 = 2027-04-30.
    expect(changes[0]?.stale_after_to).toBe("2027-04-30");

    const read = readCard(bundle, join(bundle, `${PRACTICE}.md`));
    if (!read.ok) throw new Error(read.failure.error);
    expect(normalizeVerified(read.card.frontmatter)).toHaveLength(2);
    expect(read.card.frontmatter.stale_after).toBe("2027-04-30");

    // The two edits must agree — which is exactly what the validator recomputes.
    const report = validateBundle({ bundleRoot: bundle, mode: "produce", today: new Date("2026-11-02T00:00:00Z") });
    if (report.rejected) throw new Error(report.findings.map((f) => `${f.card}: ${f.message}`).join("\n"));
    expect(report.warnings.filter((w) => w.rule === "12")).toHaveLength(0);
  });

  test("re-running is idempotent — the same affirmation is not appended twice", () => {
    const bundle = scratchBundle();
    writeFeedback(bundle, {
      project: "another-project",
      date: "2026-11-01",
      affirmed: [{ card: PRACTICE, by: "human:dave", at: "2026-11-01" }],
    });
    const today = new Date("2026-11-02T00:00:00Z");
    carryAffirmations(bundle, today, true);
    const after = readFileSync(join(bundle, `${PRACTICE}.md`), "utf-8");
    const second = carryAffirmations(bundle, today, true);
    expect(second.changes).toHaveLength(0);
    expect(readFileSync(join(bundle, `${PRACTICE}.md`), "utf-8")).toBe(after);
  });

  test("a future-dated or unknown-card affirmation is refused out loud, not applied", () => {
    const bundle = scratchBundle();
    writeFeedback(bundle, {
      project: "another-project",
      date: "2026-11-01",
      affirmed: [
        { card: PRACTICE, by: "human:dave", at: "2099-01-01" },
        { card: "practices/nope/missing", by: "human:dave", at: "2026-11-01" },
      ],
    });
    const { changes, skipped } = carryAffirmations(bundle, new Date("2026-11-02T00:00:00Z"), true);
    expect(changes).toHaveLength(0);
    expect(skipped.join(" ")).toContain("future");
    expect(skipped.join(" ")).toContain("not a card in this bundle");
  });

  test("feedback is read from JSON, so it never becomes a typeless OKF concept (§7.2)", () => {
    const bundle = scratchBundle();
    writeFeedback(bundle, { project: "p", date: "2026-11-01", affirmed: [{ card: PRACTICE, by: "human:d", at: "2026-11-01" }] });
    expect(collectFeedback(bundle).affirmed).toHaveLength(1);
    // …and a bundle carrying feedback still passes the OKF gate.
    const report = validateBundle({ bundleRoot: bundle, mode: "produce", today: new Date("2026-08-11T00:00:00Z") });
    expect(report.rejected).toBe(false);
  });
});

describe("propose-archive (monthly)", () => {
  test("stale is not enough — the grace window has to pass too", () => {
    // aws card goes stale 2026-12-07; grace is 90 days → 2027-03-07.
    expect(proposeArchive(GOOD, new Date("2027-01-01T00:00:00Z"))).toHaveLength(0);
    const due = proposeArchive(GOOD, new Date("2027-03-08T00:00:00Z"));
    expect(due.map((c) => c.id)).toEqual(["knowledge/aws/region-availability-probe"]);
  });

  test("it proposes; it never flips status itself — a bare deprecated card would fail §11.8", () => {
    const bundle = scratchBundle();
    const before = readFileSync(join(bundle, "knowledge", "aws", "region-availability-probe.md"), "utf-8");
    proposeArchive(bundle, new Date("2027-03-08T00:00:00Z"));
    expect(readFileSync(join(bundle, "knowledge", "aws", "region-availability-probe.md"), "utf-8")).toBe(before);
  });

  test("a deprecated card is already out of the lifecycle and is never re-proposed", () => {
    const bundle = scratchBundle();
    const path = join(bundle, "knowledge", "aws", "region-availability-probe.md");
    writeFileSync(path, readFileSync(path, "utf-8").replace("status: stable", "status: deprecated"));
    expect(proposeArchive(bundle, new Date("2027-03-08T00:00:00Z"))).toHaveLength(0);
  });
});

describe("the lifecycle CLI is proposal-shaped", () => {
  const tool = join(HERE, "..", "tools", "aidlc-akp-lifecycle.ts");

  test("each job prints a NO-* marker when there is nothing to do, so CI makes no noise", () => {
    for (const [command, marker] of [
      ["review-debt", "NO-DEBT"],
      ["carry-affirmations", "NO-CHANGES"],
      ["propose-archive", "NO-PROPOSAL"],
    ] as const) {
      const proc = Bun.spawnSync(["bun", tool, command, "--bundle", GOOD, "--today", "2026-08-11"]);
      expect(proc.exitCode).toBe(0);
      expect(new TextDecoder().decode(proc.stdout)).toContain(marker);
    }
  });

  test("carry-affirmations without --apply changes nothing on disk", () => {
    const bundle = scratchBundle();
    writeFeedback(bundle, { project: "p", date: "2026-11-01", affirmed: [{ card: PRACTICE, by: "human:d", at: "2026-11-01" }] });
    const before = readFileSync(join(bundle, `${PRACTICE}.md`), "utf-8");
    const proc = Bun.spawnSync(["bun", tool, "carry-affirmations", "--bundle", bundle, "--today", "2026-11-02"]);
    expect(proc.exitCode).toBe(0);
    expect(new TextDecoder().decode(proc.stdout)).toContain("would apply");
    expect(readFileSync(join(bundle, `${PRACTICE}.md`), "utf-8")).toBe(before);
  });
});
