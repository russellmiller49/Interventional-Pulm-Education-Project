# Worktree and push quick guide

The rule to remember is:

> One task, one module scope, one worktree, one task branch, and one reviewed
> merge-commit pull request.

A module is an **ownership scope**, not a partial checkout. Every worktree
contains the full repository, but the scope guard allows commits only to that
module's owned paths and declared shared paths.

## Which checkout should I use?

| Checkout                                          | Use it for                                        | Do not use it for                                    |
| ------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Control (`Interventional-Pulm-Education-Project`) | `wt start`, `wt doctor`, review, and coordination | Editing, commits, dev servers, or Supabase mutations |
| Codex task                                        | One active `codex/<module>/<task>` branch         | A second unrelated task                              |
| Claude task                                       | One active `claude/<module>/<task>` branch        | A second unrelated task                              |
| Review (`review/integration`)                     | Clean integration tests and production builds     | Feature commits                                      |
| Temporary                                         | A genuinely concurrent extra task                 | Permanent parking                                    |

## 1. Pick the module

Choose the narrowest module that owns the main feature. Use `platform` only for
repository-wide infrastructure or intentional cross-module work.

```sh
# Show every valid learner-module ID.
jq -r '.modules[] | [.id, .group] | @tsv' config/worktrees/modules.json
```

Quick map:

| Group                   | Valid module IDs                                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical Care           | `critical-care`, `icu-hemodynamics`, `mechanical-ventilation`, `mechanical-circulatory-support`, `cardiohelp-ecmo`, `baxter-crrt`, `icu-simulation`                                                                                                      |
| Pleural                 | `pleural-curriculum`, `thoracentesis-planner`, `pleural-ultrasound`, `pleural-dataset-lab`, `pleural-fluid-analysis`, `chest-drainage`, `pleural-infection`, `pneumothorax-pathway`, `malignant-effusion`, `pleuroscopy`, `pleural-ultrasound-simulator` |
| Bronchoscopy/procedures | `intro-bronchoscopy`, `rigid-bronchoscopy`, `airway-stent-mechanics`, `thermal-ablation`, `peripheral-ablation`, `tracheostomy`, `ebus-suite`, `bronch-navigation-trainer`, `rapid-onsite-cytology`                                                      |
| Other learner modules   | `anatomy-xr`, `fluoroview`, `board-prep`, `journal-club-podcasts`, `literature`, `preference-cards`, `pccm-intro-course`, `socrates`                                                                                                                     |
| Cross-cutting           | `platform`                                                                                                                                                                                                                                               |

Examples:

- Literature search or taxonomy work: `literature`
- Preference-card catalog work: `preference-cards`
- ECMO teaching work: `cardiohelp-ecmo`
- Shared worktree tooling or CI: `platform`
- One module plus `package.json`: use the learner module and claim
  `package.json`; do not change the task to `platform` just for one shared file.

If the work truly changes several learner modules, use `platform` or update the
registry in a reviewed platform PR. Do not hide cross-module work inside one
learner module.

## 2. Start the task from the control checkout

```sh
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
npm run wt -- doctor
npm run wt -- start codex literature improve-search-filters
```

For Claude:

```sh
npm run wt -- start claude preference-cards catalog-cleanup
```

The resulting branches are:

```text
codex/literature/improve-search-filters
claude/preference-cards/catalog-cleanup
```

Use a short, lowercase, hyphenated task name. If the branch already exists,
attach it explicitly:

```sh
npm run wt -- start codex literature improve-search-filters --resume
```

Never use `git switch` inside an existing worktree to repurpose it.

## 3. Confirm context before editing

Change into the exact worktree path printed by `wt start`, then run:

```sh
npm run wt -- context
```

Confirm:

- role is `active` or `temporary`;
- agent, module, task, and branch are correct;
- mounts report `ok`;
- the worktree is clean;
- warnings and overlaps are understood.

Mounted inputs such as `.env.local`, corpora, manuals, GUDID, and raw assets are
read-only. Never edit, stage, copy over, or remove them.

## 4. Claim shared files before editing

Owned module files need no claim. Protected shared files do:

```sh
npm run wt -- claim package.json --reason "Add a module script"
npm run wt -- claim messages/en.json --reason "Add learner-facing copy"
```

Claim all needed files in one command when practical. Release claims after the
commit:

```sh
npm run wt -- release package.json messages/en.json
```

Supabase examples:

```sh
npm run wt -- claim supabase-read --reason "Run the module locally"
npm run wt -- claim supabase-migrate --reason "Apply the reviewed migration"
```

Only mutation owners may migrate, reset, seed, import, upload, start, prepare,
or stop local Supabase.

## 5. Develop and commit safely

Use the assigned port:

```sh
npm run wt -- dev
```

Before every commit:

```sh
npm run wt -- context
git status --short
git add path/you/reviewed another/exact/path
npm run wt:guard
git diff --cached --check
git diff --cached
git commit -m "feat(literature): improve search filters"
```

Never use:

```text
git add .
git add -A
git switch <another-branch>
git push --force
```

## 6. Push the task branch

Push the exact branch shown by `wt context`:

```sh
git push -u origin codex/literature/improve-search-filters
```

Then open a pull request into `main`. The PR should state:

- module and task;
- owned and shared paths changed;
- claims used;
- validation run;
- advisory warnings or unrelated failures.

Use a **merge commit**. Do not squash or rebase agent PRs, because `wt finish`
verifies that the task branch is an ancestor of `origin/main`.

Never merge one agent's working branch into another agent's branch.

## 7. Finish after the PR is merged

Stop the dev server, release all claims, and make sure the tree is clean. From
the task worktree:

```sh
npm run wt -- context
npm run wt -- finish
```

`finish` fetches safely, verifies merge ancestry, removes the disposable
worktree, and retains the branch. If it refuses, fix the reported condition;
do not manually delete a dirty worktree or lease.

## Copy-paste example

```sh
# Control checkout
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
npm run wt -- doctor
npm run wt -- start codex literature improve-search-filters

# Use the exact path printed by wt start
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/active/codex-literature-improve-search-filters
npm run wt -- context

# Edit only literature-owned files
git add src/features/literature/search.ts
npm run wt:guard
git diff --cached
git commit -m "feat(literature): improve search filters"
git push -u origin codex/literature/improve-search-filters

# Open PR to main and merge with a merge commit, then:
npm run wt -- finish
```

When anything looks wrong, stop and run:

```sh
npm run wt -- context
npm run wt -- doctor
```

Do not repair shared Git metadata by hand until `doctor` has identified the
exact stale worktree, process, mount, port, or lease.
