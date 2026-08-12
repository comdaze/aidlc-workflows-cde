#!/usr/bin/env bun
// validate-cards.ts — the hub MR gate (CONTRACT §11).
//
// A wrapper, not a second implementation: the same `aidlc-akp-validate.ts` a
// spoke runs before pushing. Defaults to `--bundle .` and `--mode produce`, so
// `bun tools/validate-cards.ts` from the repo root is the whole gate.
//
// produce mode rejects on BOTH verdict classes — okf-nonconformant AND
// cde-policy-violation. Pass `--mode consume` to judge a THIRD-PARTY bundle,
// where our house rules are warnings and only OKF's three hard requirements
// reject.
import { runCli } from "./aidlc-akp-validate.ts";

const argv = process.argv.slice(2);
if (!argv.includes("--bundle")) argv.push("--bundle", ".");
if (!argv.includes("--mode")) argv.push("--mode", "produce");
process.exit(runCli(argv));
