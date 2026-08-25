# AGENTS.md

Working agreements for coding agents in this repository. Humans reviewing the
results are the audience that matters — every rule below exists to keep what
lands reviewable. The full conventions reference is
[docs/contributing.md](docs/contributing.md).

## What this repository is

The Aspire Quotes SPA: React + TypeScript on Vite, contract-first, MSW-mocked.
It is consumed by [code.examples.net.quotes](https://github.com/josnelihurt/code.examples.net.quotes)
as a **git submodule pinned by commit, mounted at `frontend/`**. Two rules
follow from that:

- **Never add a submodule back to code.examples.net.quotes** (or any backend repository).
  The only cross-repo dependency allowed is the read-only public raw URL of
  code.examples.net.quotes' frozen OpenAPI document, consumed by the contract-sync
  machinery. A submodule the other way would recurse.
- **The pinned pointer moves via pull request in code.examples.net.quotes**, never from
  here. Landing on `main` here does not change what the backend runs until
  that repository bumps its pin.

Testing topology: unit tests and the default e2e suite run against MSW mocks
(`pnpm test`, `pnpm run test:e2e`) — no backend, no database, fully
self-contained. The full-stack e2e suite (real APIs + PostgreSQL) runs from a
code.examples.net.quotes checkout via `pnpm run test:e2e:fullstack`; do not try to make it
work standalone, it boots `dotnet` binaries from the parent tree by design.

## Big changes land as stacked pull requests

Never open one large PR. Decompose the change into an ordered chain in which
**every level compiles, passes lint, and passes every CI gate independently**.
If an intermediate level would be red, the split is wrong — redo the split.

1. **Build and verify the end state first** — all suites green, lint clean.
   Snapshot uncommitted work to a local backup branch
   (`git checkout -b backup/… && git add -A && git commit`) before splitting;
   never push the backup branch.
2. **Choose the split by decision**, bottom to top: foundations first;
   adapters beside the old implementation; plumbing as layers a later PR makes
   load-bearing; then the behavior switch; pure deletion; docs last.
3. **Cut branches in order**, each from the previous one's head, with names
   matching the branch rule (see docs/contributing.md).
4. **Verify at the load-bearing levels, not only the tip** — run
   `pnpm lint && pnpm test && pnpm run build` (plus the e2e suite when the
   change touches journeys) at each level that changes behavior.
5. **One commit per branch**, message as `type: lowercase imperative`.
6. **PR body** = **What** (one paragraph) · **Stack** (part N of M, prev +
   next links) · **Review pointers** · **Evidence** (which suites ran green
   *at this level*).
7. **Push the branches, open the PRs bottom-up** (bottom → `main`) and
   register the chain: `gh stack link <bottom-pr> … <top-pr>`.
8. **Merging is bottom-up and automatic.** Labeling a reviewed PR `merge-me`
   hands it to the merge-me workflow (`.github/workflows/merge-me.yml`,
   the shared code.examples.ci `merge-me` action, which merges green PRs itself — stack layers
   atomically. Never merge by hand, never force-push mid-stack branches, never
   edit PR bases by hand.

What matters most: every intermediate level green, per-level evidence in the
PR bodies, and a tip that matches the independently verified end state.
