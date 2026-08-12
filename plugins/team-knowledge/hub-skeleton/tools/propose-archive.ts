#!/usr/bin/env bun
// propose-archive.ts — monthly. Cards stale past the grace window (§8.4).
//
// With `--apply` it writes `ARCHIVE-PROPOSAL.md` for a bot merge request. It does
// NOT flip any card's `status`, and that is not timidity: a bare `deprecated`
// with no successor link is rejected by the gate (§11.8), and it would leave a
// reader at a dead end. Archiving is a human decision between three options —
// re-affirm, supersede, or accept — and this job's whole purpose is to put that
// decision in front of the person who owns the card.
//
// **Never auto-merge this MR.** Prints `NO-PROPOSAL` when nothing is past grace.
import { runCli } from "./aidlc-akp-lifecycle.ts";

const argv = process.argv.slice(2);
if (!argv.includes("--bundle")) argv.push("--bundle", ".");
process.exit(runCli(["propose-archive", ...argv]));
