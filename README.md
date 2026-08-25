# net-examples-frontend

The Aspire Quotes SPA: a small React application that signs in against the Auth API
and exercises the Quotes API from the outside — a random quote, the paginated
catalog, publishing a new quote, and a v0/v1 transport switch on every quote page.
It exists to prove the contract end to end — one token, one correlation id, both
quote transports — not to demonstrate front-end architecture.

This repository is **frontend-focused and self-contained**: it carries its own CI,
its own conventions, its own mock platform, and a snapshot of the API contract. The
.NET side of the system lives in
[net-examples](https://github.com/josnelihurt/net-examples), which consumes this
repository as a **git submodule pinned by commit, mounted at `frontend/`**.

## The two-repository topology

```
net-examples (.NET)                          this repository (SPA)
├── src/ AppHost, Auth, Quotes               ├── src/            React + TypeScript on Vite
├── tests/ BDD specs, architecture tests     ├── e2e/            playwright-bdd journeys
├── docs/openapi/*.yaml   contract truth     ├── contracts/      frozen snapshot of that document
├── frontend/ = git submodule, pinned   ◄────┤                   (drift-gated against its raw URL)
└── scripts/e2e.sh runs the full-stack e2e   └── .claude/agents/ specialized review agents
```

Two rules keep the pair healthy:

- **Never a submodule the other way.** This repository's only dependency on
  net-examples is the public read-only raw URL of its frozen OpenAPI document,
  consumed by the contract-sync tripwire — a repository cycle is impossible by
  construction.
- **The pin moves via pull request in net-examples.** Landing on `main` here does
  not change what the backend runs until that repository bumps its submodule
  pointer — an explicit, reviewable step.

## Quickstart

```bash
brew install pnpm        # or: npm i -g pnpm — once per machine
pnpm install
pnpm run dev:mock        # SPA + MSW mock platform at http://localhost:5173 — no backend needed
```

`dev:mock` is the default development flow: the app boots the MSW worker before
first render (`src/main.tsx`), and every API journey is served by the mock
platform — the seeded eight-quote catalog and the two development accounts
(scaffolding credentials from the backend seed, documented in net-examples'
dev-credentials page; the mock layer accepts exactly those).

Plain `pnpm run dev` runs the SPA without mocks and proxies `/api/*` to the
`AUTH_API_HTTP(S)` / `QUOTES_API_HTTP(S)` targets — the environment Aspire's
`AddViteApp(...).WithReference(...)` injects when the SPA runs inside the
net-examples checkout. Standalone, export those variables yourself or use
`dev:mock`.

## Stack

| Concern | Choice |
| --- | --- |
| UI | React 19 + TypeScript 5.9 (strict, `erasableSyntaxOnly`) |
| Build / dev server | Vite 8 |
| Unit tests | Vitest 4 + Testing Library, against the MSW Node server |
| Browser journeys | Playwright + playwright-bdd (Gherkin), mocked by default |
| Mocks | MSW 2 — one handler set for unit, Storybook and mocked e2e |
| Component workshop | Storybook 10 (`@storybook/react-vite`, addon-a11y) |
| API types | Generated from the contract snapshot (`pnpm run gen:api`) |
| Package manager | pnpm, pinned via `packageManager` ([why](docs/package-manager-security.md)) |

## The contract

`contracts/quotes-v1.openapi.yaml` is this repository's snapshot of net-examples'
frozen `docs/openapi/quotes-v1.openapi.yaml`. `pnpm run gen:api` generates
`src/api/schema.d.ts` from the snapshot and CI fails on drift between the two.
The [contract-sync](.github/workflows/contract-sync.yml) workflow guards the
snapshot against the backend repository: a daily job diffs it against the frozen
document's raw URL, and a manual dispatch (sync input) refreshes the snapshot,
regenerates the types and opens the sync PR for review. The hand-written fetch
wrapper (`src/api/client.ts`) derives its payload types from the generated
schema, so client and contract cannot drift apart silently.

The mock handlers (`src/mocks/`) mirror the same contract: the seed's eight
quotes and two accounts, the twelve-character text rule, the near-duplicate
fingerprint guard, the read-only scope, and the RFC 9457 problem envelope.

## Testing topology

| Suite | Command | Runs against |
| --- | --- | --- |
| Unit | `pnpm test` | MSW Node server (`onUnhandledRequest: 'error'`) |
| Browser journeys (default) | `pnpm run test:e2e` | real SPA in chromium, MSW worker — no backend, no database |
| Browser journeys (full-stack) | `pnpm run test:e2e:fullstack` | real Auth + Quotes APIs + throwaway PostgreSQL — **from a net-examples checkout** (`scripts/e2e.sh` there) |
| Component workshop | `pnpm run storybook` / `pnpm run build-storybook` | pure-props stories; the mock worker is wired for future flows |

The feature files and step definitions are shared by both e2e modes, so the same
journeys run against the mock platform here and against the real platform from
the parent checkout. Every scenario in the mocked suite owns a fresh browser
context — and therefore a fresh seeded catalog — so scenarios cannot observe each
other's publishes.

## Repository layout

```
src/api/         the only network module: hand-written fetch + generated types
src/pages/       four screens (login, random quote, catalog, publish)
src/components/  presentational components, each with a Storybook story
src/mocks/       seed + MSW handlers + browser/node entry points
e2e/             Gherkin features + playwright-bdd steps (shared by both modes)
contracts/       frozen OpenAPI snapshot + drift machinery (CI + workflow)
.github/         ci (conventions, lint/test/build, mocked e2e, secrets hygiene), contract-sync, merge-me
.claude/agents/  frontend-reviewer, test-author, contract-syncer
```

## Conventions and process

Branch names and commit messages follow hard rules enforced by CI; big changes
land as stacked pull requests merged bottom-up by the `merge-me` workflow. The
full reference is [docs/contributing.md](docs/contributing.md); the agent-facing
summary is [AGENTS.md](AGENTS.md).

### The squash-merge stack wedge

When the bottom PR of a stack squash-merges, the layers above still carry its
diff as real commits while the base carries the same diff as the squash, so
GitHub reports them CONFLICTING and every atomic merge fails — this repository's
bootstrap stack hit it twice. The repair is the one sanctioned exception to
"never force-push mid-stack branches", bottom-up, one layer at a time (deinit
the frontend submodule first if a rebase needs to cross the tree→gitlink
boundary):

```bash
git fetch origin
git rebase --onto origin/<base> <old-base-tip> <branch>
git push --force-with-lease origin <branch>
```

The next event re-evaluates and merge-me lands the layer.
[net-examples' README](https://github.com/josnelihurt/net-examples#the-squash-merge-stack-wedge)
carries the full write-up.
