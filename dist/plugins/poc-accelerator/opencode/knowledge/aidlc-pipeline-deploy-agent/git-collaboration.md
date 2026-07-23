# Git Collaboration in Customer Repos

CDE work often lands in a repository the customer owns, alongside the
customer's engineers. Two different actors touch git there, with different
rules:

- **The workflow's agents** follow the framework's git safety line: no force
  pushes, no history rewriting, no destructive operations — clean commits the
  first time, on a branch, never directly to a protected mainline.
- **The SA as a human collaborator** needs the discipline below for the
  moments outside the workflow: pairing with customer engineers, reviewing
  their PRs, untangling a shared branch.

## Before the first commit: discover, don't assume

Run `git branch -r` and `git log --graph --oneline -20` on the customer repo
before writing code. A live `develop` branch, long-lived PR branches, or
`release/*` branches each mean a different model — match what the customer
does, not what you prefer, and record the observed model in the environment
readiness evidence. (The framework's branching-strategies knowledge carries
the full menu and how AIDLC maps onto each.)

## Rebase discipline (human, on your own branches only)

- Rebasing your own unshared feature branch keeps history linear and keeps
  `git bisect` and reverts useful. Never rebase a branch others have pulled —
  the commits their work is based on stop existing, breaking their local
  history.
- If a rebase requires a force push, use `--force-with-lease`, never plain
  `--force`: it refuses to clobber commits someone else pushed while you were
  rebasing. One word longer, always worth it.
- The workflow's agents do neither — they do not rebase or force-push at all.
  These two rules exist for the SA's own hands.

## Resolving conflicts: understand both sides

Never blindly pick one side. Ask three questions: what did each side intend,
do they conflict logically or only textually, and what is the correct
combined state? In a customer repo the "other side" is often the customer's
engineer — when intent is unclear, that is a conversation, not a guess.

## History the customer will read

The delivered repo's history is part of the deliverable. The workflow's
squash-at-merge and one-purpose commits produce a readable history by
default; if you (the human) accumulated noisy WIP commits on your own
unshared branch, clean them up before opening the PR — your working process
is not the public record. Do not rewrite anything already shared.
