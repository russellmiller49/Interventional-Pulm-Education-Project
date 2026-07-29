# Dynamic worktree isolation

This repository keeps a complete 35-module ownership registry while
provisioning only the worktrees needed by active tasks. The normal topology is:

```text
Interventional-Pulm-Education-Project/             control/main
Interventional-Pulm-Education-Worktrees/
  active/                                           Codex and Claude primary tasks
  review/integration/                               detached integration review
  temporary/                                        short-lived overflow tasks
Interventional-Pulm-Local-Data/                    private, heavyweight inputs
```

The default cap is five total worktrees, including control and review. Worktree
metadata is discovered with `git rev-parse --git-common-dir`,
`git rev-parse --git-dir`, and `git rev-parse --show-toplevel`; tooling never
assumes that `.git` is a directory.

For the short, copy-paste workflow and the complete module-ID map, see
[`worktree-push-quick-guide.md`](./worktree-push-quick-guide.md).

## Daily workflow

From any checkout, inspect context:

```sh
npm run wt -- context
npm run wt -- doctor
```

Start a task from the current `origin/main`:

```sh
npm run wt -- start codex literature taxonomy-cleanup
npm run wt -- start claude critical-care ecmo-case-copy
```

An existing branch is never attached implicitly:

```sh
npm run wt -- start codex literature taxonomy-cleanup --resume
```

`start` serializes fetches, validates the registry, assigns the primary agent
port or a temporary port, writes per-worktree state beneath the worktree Git
directory, configures a per-worktree exclude file, and provisions only the
module’s declared external-input profile.

Do not run concurrent `git fetch` or `git pull` commands from task worktrees.
Linked worktrees share remote refs; `start` and `finish` deliberately serialize
those updates through a common lock.

Before editing a shared file, claim it:

```sh
npm run wt -- claim package.json --reason "Add the module validation script"
npm run wt -- claim messages/en.json src/components/layout/Nav.tsx \
  --reason "Expose the new route"
```

Claims are exclusive and acquired in lexical order. Release them after the
commit:

```sh
npm run wt -- release package.json
```

Use the assigned dev-server port:

```sh
npm run wt -- dev
```

The process record contains the PID, OS process start time, actual command,
worktree, branch, port, and lease creation time. `doctor` compares all of these
instead of trusting a reusable PID.

Before committing:

```sh
npm run wt -- context
git add path/you/reviewed
npm run wt:guard
git commit
```

The scope guard blocks control or detached commits, branch/module mismatches,
active Git operations, private/generated paths, another module’s exclusive
paths, undeclared shared paths, and protected shared files without a claim.
Stale bases, path overlap, and ownership ambiguity are advisory warnings with
stable IDs. A warning may be recorded with `--ack WT-WARN-...` on `start` or
`finish`; warnings do not suppress hard safety failures.

The hook runs `lint-staged` without its backup stash or partially-staged-file
hiding. Git stashes are shared repository state, so agents must preserve their
own unstaged work and stage only reviewed paths.

If a full-suite failure is proven to originate outside the task scope, record
it as `WT-WARN-UNRELATED-SUITE-FAILURE` in the PR validation notes. It remains
advisory; it never authorizes an out-of-scope repair.

After a reviewed merge-commit PR reaches `origin/main`:

```sh
npm run wt -- finish
```

`finish` requires a clean tree, no Git operation, no held lease or live dev
process, and verifies that the task branch is an ancestor of `origin/main`.
The worktree is removed and the branch is retained unless
`--delete-branch` is explicitly supplied.

## Supabase leases

Multiple worktrees may hold read leases:

```sh
npm run wt -- claim supabase-read --reason "Run the literature UI"
```

Mutations are exclusive and identify the operation:

```sh
npm run wt -- claim supabase-reset --reason "Validate migrations from empty state"
npm run literature:local:reset
npm run wt -- release supabase-reset
```

Use the matching resources for `prepare`, `start`, `stop`, `migrate`, `seed`,
`import`, and `upload`. The wrapped npm scripts refuse to run without the
matching mutation lease. Direct Supabase CLI mutations are outside the safe
workflow and must not be used by agents.

## External inputs and excludes

Machine-local input paths live in:

```text
/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/config/worktrees.local.json
```

That file contains paths, never secrets. Secrets and input targets are
read-only. Task worktrees receive `.env.local` plus only the symlinks declared
by `inputMountTargets`. Legacy corpus/manual paths are retained where existing
commands depend on them; conflict-prone raw inputs use
`local-data/inputs/<name>`. The source directory is never placed in a Git
checkout.

The common Git exclude contains only universally local paths:
`local-data`, ECMO previews, Playwright reports, and test results. Additional
task-only exclusions live under the per-worktree Git directory and are selected
with `git config --worktree core.excludesFile`.

`wt context` reports visible untracked paths, ignored paths inside owned/shared
scope, and the `git check-ignore -v` provenance. It does not recursively scan
`node_modules`, `.next`, caches, or the external data tree.

## Manual preflight and recovery

If the CLI itself is unavailable, do not improvise branch switches. Run:

```sh
git rev-parse --show-toplevel
git rev-parse --git-common-dir
git rev-parse --git-dir
git status --short --branch
git worktree list --porcelain
git rev-list --left-right --count origin/main...HEAD
```

Then inspect the registry and machine-local config. Shared leases are beneath
the discovered common Git directory in `wt/leases`; worktree context and
excludes are beneath the discovered per-worktree Git directory in `wt`.

Do not remove a dirty worktree, delete a lease owned by a live task, or guess
that a squash-equivalent branch was merged. Preserve work outside Git before
recovery, then use reviewed merge commits.

## Port map

| Slot               |      Port |
| ------------------ | --------: |
| Integration review |      3100 |
| Codex primary      |      3110 |
| Claude primary     |      3120 |
| Temporary tasks    | 3130–3149 |

The control checkout normally owns no server.
