# Agent rules — parallel task worktrees

Several agent sessions work on this repository at the same time: Claude sessions (usually one per
lane) and Codex. Each task runs in its own worktree on its own branch, and every change reaches
`main` through a GitHub PR that the owner, Russell Miller, reviews and merges. Railway deploys
`main` to production on every merge.

## Checkouts

`P` = `/Users/russellmiller/Projects/Interventional-Pulm-Education-Project` (primary checkout),
`W` = `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees`.

| Checkout              | Path                          | Used for                                                                                   |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| Primary               | `$P`                          | Review, merging, pulling `main`, and all Supabase/upload scripts (`npm run dev` → 3001)    |
| Claude task worktrees | `$W/claude-<task>`            | One per task or lane, on a `claude/<task>` branch                                          |
| `claude`              | `$W/claude`                   | The `node_modules` that new worktrees clone; `npm run dev:claude` (3120) still works there |
| Codex                 | `$W/codex`, `$W/codex-<task>` | Codex work on `codex/*` branches (`npm run dev:codex` → 3110)                              |

Reading, reviewing and analysis are fine from any checkout. Leave other sessions' worktrees alone.

## Starting a task

```zsh
TASK=<short-task>
git -C $P fetch origin --prune
git -C $P worktree add --no-track -b "claude/${TASK}" "$W/claude-${TASK}" origin/main
cd "$W/claude-${TASK}"
cp -cR $W/claude/node_modules .       # APFS copy-on-write clone, never a symlink
test ! -e node_modules/node_modules   # a nested copy means node_modules already existed
node scripts/install-hooks.mjs && test -x .husky/_/pre-commit
npm run build:content                 # before tsc or a dev server
```

- Clone, don't symlink: a symlink shares one tree, and the caches tools write into it, across
  every worktree. If `package-lock.json` has changed since that checkout's install, run `npm ci`
  instead.
- `scripts/dev-with-training-apps.mjs` and `npm run build` also build the embedded training apps;
  for those, clone `EBUS-course/node_modules`, `EBUS-course/apps/web/node_modules` and
  `navigation_module/web/node_modules` the same way.
- Install the hooks: they live in the ignored `.husky/_/`, so a cloned worktree has no pre-commit
  hook (and no main-commit guard) until you do.
- Name the directory after the task; a date suffix (`claude-platform-1114`) is common. Once the PR
  has merged you may remove your own worktree with `git -C $P worktree remove <path>`.

## Branches and commits

- Claude branches are `claude/<task>`, Codex branches `codex/<task>`, both cut from `origin/main`.
  A stacked PR says in its body which PR merges first.
- Never commit to `main`. The pre-commit hook blocks it, checks staged PDFs and runs lint-staged;
  `ALLOW_MAIN_COMMIT=1` exists for deliberate human use only.
- Never commit to, push to, rebase or merge the other agent's branches. When a Codex PR needs a
  change, write it up (a patch or note in Local-Data) for Codex.
- Stage specific reviewed paths only — never `git add -A`, `git add .`, `git add -u` or
  `git commit -a` — and check `git diff --cached --name-only` before committing.
- No force-push and no rebase of a pushed branch. Pick up `main` by merging it in:
  `git fetch origin && git merge --no-edit origin/main`, then rerun the fast gate.
- The owner merges while you work: check `gh pr view <n> --json state,headRefOid` before every push.
- No `git stash`. The stash stack is shared by every worktree, so one session can pop another's
  entry. Set work aside with a WIP commit on your branch or a patch file outside the repo.
- The owner merges PRs. An agent merges only when he asks it to, for that PR.

## Dev servers and ports

Each lane has its own port, listed as a `claude-<lane>` entry in `.claude/launch.json`. Start the
server from your own worktree, after claiming a runtime slot (below):

```zsh
NODE_OPTIONS=--max-old-space-size=8192 npx next dev --port $PORT --webpack
node scripts/dev-with-training-apps.mjs --port $PORT   # EBUS and Bronchoscopy Foundations
```

| Lane                     | Port | Lane                                         | Port |
| ------------------------ | ---- | -------------------------------------------- | ---- |
| Platform                 | 3124 | Ventilation                                  | 3123 |
| EBUS                     | 3128 | Hemodynamics                                 | 3125 |
| Bronchoscopy Foundations | 3133 | ECMO                                         | 3147 |
| Branch Tracing           | 3127 | CRRT                                         | 3113 |
| Airway                   | 3135 | MCS                                          | 3122 |
| Peripheral Imaging       | 3126 | Shared read-only baseline on `main`, packets | 3170 |
| Primary checkout         | 3001 | `claude` checkout (`npm run dev:claude`)     | 3120 |

- Port 3110 is Codex's. The Branch Tracing Playwright config defaults to it, so always set
  `BRANCH_TRACING_BASE_URL` to your own server.
- A task without a lane port picks a free one (`lsof -nP -iTCP:$PORT -sTCP:LISTEN` prints nothing)
  and names it in its report. Local edits to `.claude/launch.json` are never staged.

## Knowing what you are testing

A dev server serves the working tree of the checkout that started it, uncommitted edits included,
and a port may be held by another session's server. Before reporting a test or screenshot:

```zsh
git rev-parse --show-toplevel                               # this worktree
git branch --show-current && git rev-parse --short HEAD     # branch and commit
git status --short                                          # edits the server also serves
lsof -a -p "$(lsof -nP -tiTCP:$PORT -sTCP:LISTEN)" -d cwd   # which checkout owns the server
```

- Before any Playwright run the `lsof` line must print your worktree; a reused port silently tests
  someone else's code. Suites whose config fixes a port get an untracked override config that
  points at your port.
- Quote the branch and head SHA with every result, in the PR body and on the status board.
- To tell your failures from pre-existing ones, run the same suite on `main` (the 3170 baseline,
  or a detached worktree: `git -C $P worktree add --detach <scratch>/main-baseline origin/main`)
  and compare failing test names; several suites are red on `main`.
  `docs/shared-checkout-protocol.md` predates worktrees: its staging rules still hold, but use the
  detached worktree instead of its `git stash` recipe.

## Expensive work: runtime and heavy slots

Every session on the machine shares its CPU, and the browser suites time out under load. Locks are
directories under `$W/_locks/`, taken with `mkdir` (it fails if the slot is held). Write who holds
it (lane, pid, time) into a file inside, and remove the directory when you finish.

- **Runtime slots** `runtime-1`, `runtime-2`, `runtime-3`: at most three sessions run the app at
  once. Claim one before starting a dev or production server; release it when the server stops.
  Work that does not run the app needs no slot.
- **Heavy slot** `heavy`, one for the whole machine: any Playwright run, full jest,
  `next build` / `npm run build`, clip encoding. Hold it for the run only.
- A lock whose pid no longer runs is stale; note it on the status board when you clear it.

The status board for the current round of work is `STATUS.md` in the round's folder under
`Interventional-Pulm-Local-Data/owner-decisions/` (`2026-11-14/` at the time of writing). It is
append-only, three lines per entry (when, who, what: PR, branch, head SHA, anything blocked), and
lists the round's single-writer files at the top.

## Gates

- **Type-check:** run it unpiped and check the exit code; an out-of-memory abort is otherwise
  silent, and a pipe reports the last command's status instead.

  ```zsh
  NODE_OPTIONS=--max-old-space-size=16384 npx tsc --noEmit -p . > "${TMPDIR:-/tmp}/tsc-${TASK}.log" 2>&1; echo $?
  ```

  The printed code must be 0. The production build checks the smaller `tsconfig.build.json`; see
  `docs/production-build-memory.md`.

- **Fast gate, every commit:** `npx jest --findRelatedTests <changed files>` (this pulls in other
  lanes' tests that pin shared text), eslint and prettier on the changed files, and the type-check.
  Critical-care lanes add `npm run audit:critical-care-guides`.
- **Slow gate, once per PR head before hand-off:** the module's Playwright suite against your own
  server, in the heavy slot, with failing test names compared to the `main` baseline.

## Clinical sign-offs belong to the owner

- Finishing an implementation is not clinical approval. Passing gates, a pushed PR or an approved
  plan does not mean he has approved the clinical content, and merging a PR does not sign its
  numbers. PR bodies say which learner-facing wording, keyed answers and numbers await his review.
- In the teaching-number registers an agent may add or correct an unsigned row with its source
  (`docs/teaching-first-rules.md`), but never sets, changes or removes `signedBy` / `signedOn`
  without his written decision naming that row: his ruling in writing, in the conversation, on the
  PR, or recorded in an owner-decisions page or file. Rows he has not ruled on stay unsigned.
- The delegated form, in use since 2026-11-13:

  ```ts
  signedBy: 'Russell Miller, written decision of <YYYY-MM-DD> (sources checked by Claude)',
  signedOn: '<YYYY-MM-DD>', // the decision date
  ```

  Spread it from a named constant into each approved row only, never onto the shared `CHECK*`
  objects; record in `checkedBy` who read which source; pin the signed set in the module's
  `numbersSignoff.test.ts` (example: `src/features/baxter-crrt/`).

- Keep existing signatures intact. A signed value or its rendered wording changes only under his
  written decision for the new value, and is re-signed with that decision's date.
- State exactly what was read for each source: full text, abstract only, or not found.
  `npm run numbers:signoff` lists unsigned rows; it does not sign.

## Independent review of clinical changes

Before the owner merges a substantive clinical change (learner-facing clinical text, keyed
answers, cases, teaching numbers, or the physiology a simulator computes), a second reader that did
not write it reviews it.

- The reviewer gets the diff and his ruling verbatim, not the author's summary, plus the reviewer
  charter from `docs/teaching-first-rules.md`. It answers point by point: was each numbered point
  of the ruling addressed, and is any wording absolute or beyond its source.
- Current practice crosses models: a Fable-written clinical PR gets an Opus point-by-point read; an
  Opus PR that changes learner-facing words gets a Fable clinical read.
- Clinical PR bodies quote the ruling, carry a point-by-point table against it, and record the
  review's findings and what changed in response.
- Briefs for clinical work open with the true context (physician-authored fellow education, the
  ruling quoted); see the `clinical-prompt-framing` skill in `.claude/skills/`.
- When he places a clinical review hold on a PR, answer on the same branch with the smallest
  clinically accurate correction, push, and report.

## Shared files have one writer

Some files are live configuration or are read by several modules' tests, so each has one writer
per round. The round's `STATUS.md` holds the current assignments; on 2026-11-15 they were:

| File                                                                                                                                            | Writer                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `src/features/module-beta/rollout.ts` (its `lookFor` lines are the live review-form prompts)                                                    | Coordinating session, one PR per wave after its merges  |
| `.claude/launch.json`                                                                                                                           | Coordinating session                                    |
| Beta hub docs (`docs/module-beta-testing.md`)                                                                                                   | Coordinating session, after #479 merges                 |
| `src/features/critical-care/content/learningPathways.ts` and `activities.ts` (minutes must match), `sourceConflicts.ts`                         | Critical-care lane, in the order HD → MCS → ECMO/CRRT   |
| `src/data/airway-anatomy-lesson/airway-map.ts`, `src/lib/airway-anatomy/branch-debrief.ts`, `src/lib/airway-anatomy-lesson/view-orientation.ts` | Airway lane, merged after the Branch Tracing and BF PRs |
| `src/features/learning-module/` (shared lesson stage)                                                                                           | Nobody, unless the owner asks                           |

A lane that needs a change in a file it does not write puts a **"Hub note facts"** block in its PR
body (the exact line to add, change or remove, and why it is true once the PR merges) and notes it
on the status board. The writer applies it in its next PR.

## Module versioning registry

PR #479 (`codex/beta-revision-registry`, Codex's, open on 2026-11-15) adds a typed revision
registry (`src/features/module-beta/revisions.ts`), changelogs on the hub card and feedback
toolbar, and `docs/module-beta-versioning.md`.

- Until it merges, leave `src/features/module-beta/BetaHubSections.tsx` and
  `docs/module-beta-testing.md` alone; its conflict fix was handed to Codex as a patch.
- After it merges, each registry entry (version, changelog, section links) needs the owner's
  explicit approval, and merges or deployments never advance a version by themselves. His ruling
  of 2026-11-12: baseline each module when it is marked "ready". Later edits to the hub component
  and beta docs go through the coordinating session's hub-notes PRs.

## Rules

- Read-only mounts — never edit, stage, copy over, or delete them: `.env.local`,
  `IP_PubMed/nbib files`, `Critical_Care_Reference/{Device Manuals,Full_textbooks,Summary files}`,
  `Preference_card_module/{UCSD,AccessGUDID_Delimited_Full_Release_*}`, `local-data/inputs/*`.
- Commands that mutate shared local state run **only from the primary checkout**
  (enforced by `scripts/require-primary-checkout.mjs`): `literature:local:{prepare,start,reset,stop}`,
  `literature:import`, `literature:seed-taxonomy`, `literature:import-gold-reviews`, `upload:*`.
  Only one local Supabase instance can exist (fixed ports) — ask before running these.
- No write to production (database rows, Storage, applying a migration, deployment settings)
  without the owner's go-ahead for that specific action. Migrations are committed for him to apply.
- Patient-derived media and anything about test accounts stay in Local-Data, not in this public
  repository.

## Local data outside Git

Raw authoring inputs, private references, renders, prompts and secrets live in
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data` (override with `IP_LOCAL_DATA`).
The production build never reads that folder. The folder map, the read-only rules, and the
resolver helpers (`scripts/local-data-root.mjs`, `scripts/local_data.py`) are in
`docs/local-authoring-assets.md`. Read from it by absolute path when you need source knowledge
or an asset to regenerate a derived file; never copy it into a checkout, stage it, or commit it.

Before searching for source assets or following an old authoring path, read
`docs/local-authoring-assets.md`. Its folder map translates former repository paths to
Local-Data paths. Only the primary checkout carries the legacy symlink mounts; worktrees
resolve inputs through the helpers or Local-Data config. Raw inputs stay outside Git;
commit only regenerated runtime outputs. Never print the contents of `secrets/`.

## Learner-facing educational modules

Read `docs/teaching-first-rules.md` before writing, editing or reviewing learner-facing content.
The modules teach supervised fellows; they are not guidelines or instructions for use. In short:

- Teach the guideline, consensus or device number where one exists, with its source in the
  module's numbers register. "Check local protocol" may follow a number, never replace it.
- Key deterioration questions on first moves, not on "escalate".
- One boundary statement per module. Review status and authoring notes never reach the learner.
- Fix a wrong model before explaining it in the copy.
- A review reports what is wrong and what is not taught, with equal weight, and ends with its top
  three teaching improvements. Paste the reviewer charter from that page into every review or
  acceptance prompt for a learner-facing module.
