# pnpm as the package manager

Decision note (2026-08-22, carried over from the net-examples monorepo this
repository was extracted from). The question: the JavaScript toolchain ran on
npm — install, scripts, CI. After the 2025–2026 wave of npm supply-chain
incidents, is npm still the right default, and if not what replaces it? This
page records the research, the decision, and the hardening that shipped with it.

**Decision: pnpm, pinned via `packageManager`, with a hardened install policy.**

## The threat and the defense

**npm's 2025–2026 incident wave was structural, not bad luck.** The September 2025
"Shai-Hulud" compromises (and the waves that followed) phished maintainer accounts
and pushed malicious releases whose payload ran as **install scripts** — arbitrary
code execution on every developer machine and CI runner that installed the
package, purely as a side effect of `npm install`. npm also **hoists everything
into a flat `node_modules`**, so code can import packages it never declared
(phantom dependencies) — a hiding place for planted code and a recurring source
of confusion bugs.

**pnpm removes both default-on mechanisms.** It uses the same registry and the
same packages — the defense is in what the *installer* does:

| npm default | pnpm default |
|-------------|--------------|
| Dependency install scripts (`postinstall`, …) **run automatically** | Scripts **blocked** unless allowlisted (`allowBuilds` in [pnpm-workspace.yaml](../pnpm-workspace.yaml)) |
| Flat hoisted `node_modules` — anything is importable | Strict symlinked layout — only declared dependencies are reachable |
| New releases installable the second they're published | `minimumReleaseAge: 1440` — a release must be 24 h old before it installs, so fast-moving attacks burn out before they reach us |
| Version chosen by whoever runs the command | `packageManager: pnpm@<exact>` pins one version for every machine and CI |

**Pinning matters as much as the manager.** Corepack — Node's built-in mechanism
for honoring `packageManager` — was voted out of the Node distribution, so the
documented path is a standalone pnpm install (`brew install pnpm` or
`npm i -g pnpm`). Once installed, pnpm itself honors the `packageManager` pin
and self-manages the exact version.

## The allowlist today

- `esbuild: true` — verifies/installs its platform binary; required by the Vite build.
- `msw: false` — its `postinstall` is telemetry-only; deliberately not run.

Additions to `allowBuilds` are a code-review event: that list is the single
switch that decides whether third-party code executes during `pnpm install`.

**Honest residual risk:** pnpm installs from the same registry with the same
package contents — publisher-side compromise is *mitigated* (delay, blocked
scripts), not eliminated. The next hardening steps if this ever needs to go
further: a stricter `minimumReleaseAge` (one week), `blockExoticSubdeps`, and
pnpm's `trustPolicy` — documented in
[pnpm's supply-chain guide](https://pnpm.io/supply-chain-security).

## Standard usage

```bash
brew install pnpm            # or: npm i -g pnpm — once per machine
pnpm install                 # install exactly what pnpm-lock.yaml pins
pnpm run dev:mock            # every npm script works identically: pnpm run <script>
pnpm dlx <tool>              # what npx used to do
```

The quickstart and the scripts table live in [README.md](../README.md).

## Decision and revisit trigger

**2026-08-22 — researched and migrated in one change.** The research happened in
the net-examples monorepo and the migration is native history here: PR #3
(`ef2955e`, "chore: replace npm with pnpm across the toolchain and ci") — the
filter-repo extraction carried it into this repository's first commits.
Rollback is a single revert — `package-lock.json` returns from git history.

**Revisit when:** a supply-chain policy stricter than the defaults above becomes
necessary (`trustPolicy`, one-week quarantine), or Aspire's JavaScript
integration (in [net-examples](https://github.com/josnelihurt/net-examples))
changes its package-manager handling.

## Sources

- [pnpm — Supply chain security (official)](https://pnpm.io/supply-chain-security)
- [Node.js Security — Hardening npm and pnpm configs post Shai-Hulud](https://www.nodejs-security.com/blog/hardening-your-npm-pnpm-config-for-shai-hulud)
- [Socket — Node.js TSC votes to stop distributing Corepack](https://socket.dev/blog/node-js-tsc-votes-to-stop-distributing-corepack)
- [pnpm/action-setup — CI setup reading `packageManager`](https://github.com/pnpm/action-setup)
- [Node.js — previous releases (EOL schedule)](https://nodejs.org/en/about/previous-releases)
