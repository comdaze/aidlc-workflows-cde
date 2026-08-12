#!/usr/bin/env bun
// carry-affirmations.ts — weekly. Spoke feedback → verified events (§8.4).
//
// Reads `feedback/<project>/<date>.json`, appends each new affirmation to the
// card's `verified` list, and recomputes `stale_after` from the policy half-life.
// Both edits, together, in one bot merge request — the gate rejects them if they
// disagree.
//
// `--apply` writes; without it this is a dry run. Prints `NO-CHANGES` when there
// is nothing to carry, so no commit and no MR are produced.
//
// A `disputed` entry is NOT acted on here: a falsification claim can itself be
// wrong. It surfaces in review-debt, in red, and the correction is a human
// opening a successor card.
import { runCli } from "./aidlc-akp-lifecycle.ts";

const argv = process.argv.slice(2);
if (!argv.includes("--bundle")) argv.push("--bundle", ".");
process.exit(runCli(["carry-affirmations", ...argv]));
