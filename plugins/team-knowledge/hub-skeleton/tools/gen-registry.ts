#!/usr/bin/env bun
// gen-registry.ts — the computed index (CONTRACT §4.3, §7.3).
//
// Deliberately NOT committed anywhere. A `registry.json` in the repo would be one
// shared file that every merge request has to rewrite, which single-handedly
// breaks "one card, one file, never conflicts" — and adds a "forgot to
// regenerate" silent-failure mode on top. CI publishes it as a job artifact; a
// consumer computes it on demand.
import { runCli } from "./aidlc-akp-registry.ts";

const argv = process.argv.slice(2);
if (!argv.includes("--bundle")) argv.push("--bundle", ".");
process.exit(runCli(argv));
