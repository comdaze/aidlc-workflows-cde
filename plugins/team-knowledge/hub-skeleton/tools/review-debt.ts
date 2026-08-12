#!/usr/bin/env bun
// review-debt.ts — weekly. Who owes a review (CONTRACT §8.4).
//
// Groups due and disputed cards by the SAME CODEOWNERS file that routes merge
// request review, so admission responsibility and review responsibility land on
// one person and no second assignment mechanism is needed.
//
// Prints `NO-DEBT` and nothing else when nothing is due — a quiet week must not
// produce an issue update.
import { runCli } from "./aidlc-akp-lifecycle.ts";

const argv = process.argv.slice(2);
if (!argv.includes("--bundle")) argv.push("--bundle", ".");
process.exit(runCli(["review-debt", ...argv]));
