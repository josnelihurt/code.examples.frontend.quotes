# Contributing: branches and commits

Branch names and commit messages follow hard rules, for humans and coding
agents alike. One implementation backs every enforcement point —
`scripts/check-conventions.sh` — so the CI gate, the optional local hooks and
a manual check can never drift apart. [AGENTS.md](../AGENTS.md) carries the
agent-facing summary; this page is the full reference.

## Branch naming

Every branch pushed to the repository matches:

```text
^(feature|hotfix|chore|docs|ci|fix)/[a-z0-9][a-z0-9-]*[a-z0-9]$
```

A prefix from the table below, a slash, then a kebab-case name of at least two
characters (digits allowed, e.g. a tracking issue number: `feature/msw-layer-2`).

| Prefix | Use |
| ------ | --- |
| `feature/` | new capability |
| `hotfix/` | urgent fix on a broken behavior |
| `chore/` | tooling, dependencies, repo upkeep |
| `docs/` | documentation changes |
| `ci/` | build and pipeline changes |
| `fix/` | non-urgent bug fixes |

Exemptions: `main` itself, and `backup/…` branches — those are local-only
snapshots the stacked-PR workflow (see [AGENTS.md](../AGENTS.md)) never pushes —
and `dependabot/…` branches, whose names automation chooses for us (their
commits still follow the commit rule).

## Commit messages

Every commit subject and every pull-request title matches:

```text
type(scope)!: lowercase imperative summary
```

- `type` — one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `chore`, `revert`
- `(scope)` — optional lowercase scope, e.g. `feat(e2e): …`
- `!` — optional breaking-change marker
- summary — imperative mood ("add", not "added"), starts with a lowercase
  letter or digit, no trailing period, whole line at most 72 characters

Why the PR title too: this repository squash-merges, so **the PR title becomes
the canonical commit on `main`**. GitHub appends ` (#N)` at merge time — that
suffix is legal only on the merged result (the push-side check allows it),
never in a PR title or an in-stack commit.

Good:

```text
feat: add the msw mock layer
refactor(e2e): split mocked and fullstack configs
feat(api)!: rename the auth endpoints
```

Bad:

```text
update stuff                        — no type
feat: Add capital summary           — summary must start lowercase
fix: ends with period.              — no trailing period
docs: document the workflow (#17)   — (#N) belongs to merged commits only
```

## Enforcement

### CI

The `conventions` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs on every pull request and every push to `main`. On a PR it checks the
branch name, every commit GitHub attributes to the PR (the pulls-API list —
exactly the commits the squash merge would collapse), and the PR title.
Commits carrying a trailing ` (#N)` are skipped on the PR side: the
server-side stack rebase materializes already-merged lower layers on upper
branches with the squash subject, and those artifacts are the base branch's
history, not this PR's contribution. On a push to `main` it checks the new
commits' subjects, validating with the ` (#N)` suffix stripped.

### Branch ruleset on `main`

A repository ruleset requires a pull request, a green `conventions` check, and
blocks force pushes and deletion before anything lands on `main`. It
deliberately does **not** require approvals, "up to date" branches, or a merge
queue (the one approval-adjacent flag kept on is GitHub's default
`require_extra_approval_for_unattributed_changes`): the merge-me automation
merges with `GITHUB_TOKEN`, which cannot bypass branch protection, and stacked
layers are rebased server-side when a lower layer merges.

To recreate the ruleset after a repository reset:

```bash
gh api -X POST repos/{owner}/{repo}/rulesets --input - <<'JSON'
{
  "name": "conventions",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "require_extra_approval_for_unattributed_changes": true
      } },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "conventions (branch names + commit messages)" } ] } },
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
JSON
```

## Local hooks (optional)

For feedback before the push, opt into the git hooks:

```bash
./scripts/setup-git-hooks.sh   # enable  (git config core.hooksPath .githooks)
git config --unset core.hooksPath   # undo
```

- `commit-msg` validates the subject of the commit being created.
- `pre-push` validates the branch name and every commit not yet on
  `origin/main` (the whole delta, so stacked branches are covered); `main`,
  and `backup/*` branches are exempt (the hook matches branch names; pushing a
  tag from a feature branch still validates that branch).

Pure git configuration — no package-manager lifecycle. CI enforces the same
rules regardless of whether the hooks are installed.

## The checker

```text
scripts/check-conventions.sh --branch <name>          # branch naming rule
scripts/check-conventions.sh --range <a>..<b>         # commit subjects in range
scripts/check-conventions.sh --title <text>           # PR title rule
                       [--allow-pr-number]            # tolerate one trailing " (#N)"
```

Modes combine; exit codes: `0` clean, `1` violations (all reported), `2` usage
error.
