# Agent rules — permanent worktrees

Three permanent checkouts share one repository. There is no start/claim/finish
lifecycle; each agent always works in its own directory.

| Checkout | Path                                                        | Purpose                                                                                 |
| -------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Primary  | `…/Projects/Interventional-Pulm-Education-Project`          | Review, merging, pulling `main`, and all Supabase/upload scripts (`npm run dev` → 3001) |
| Claude   | `…/Projects/Interventional-Pulm-Education-Worktrees/claude` | Claude implementation work (`npm run dev:claude` → 3120)                                |
| Codex    | `…/Projects/Interventional-Pulm-Education-Worktrees/codex`  | Codex implementation work (`npm run dev:codex` → 3110)                                  |

## Workflow per task (from your own worktree)

1. `git fetch origin && git switch -c <agent>/<short-task> origin/main` (`<agent>` is `claude` or `codex`).
2. Implement. Stage specific reviewed paths only — never `git add -A` or `git add .`.
3. Commit normally. The pre-commit hook blocks commits on `main`, checks staged PDFs, and runs lint-staged.
4. `git push -u origin <branch>` and open a GitHub PR into `main`. Any merge method (merge/squash/rebase) is fine.
5. After the PR merges, start the next task from a fresh branch off `origin/main` in the same directory. No worktree cleanup is ever needed.

## Rules

- Never commit to `main`. The hook enforces this; `ALLOW_MAIN_COMMIT=1` exists for deliberate human use only.
- Read-only mounts — never edit, stage, copy over, or delete them: `.env.local`,
  `IP_PubMed/nbib files`, `Critical_Care_Reference/{Device Manuals,Full_textbooks,Summary files}`,
  `Preference_card_module/{UCSD,AccessGUDID_Delimited_Full_Release_*}`, `local-data/inputs/*`.
- Commands that mutate shared local state run **only from the primary checkout**
  (enforced by `scripts/require-primary-checkout.mjs`): `literature:local:{prepare,start,reset,stop}`,
  `literature:import`, `literature:seed-taxonomy`, `literature:import-gold-reviews`, `upload:*`.
  Only one local Supabase instance can exist (fixed ports) — ask before running these.
- No force-pushes, no rebasing a pushed branch, and never work on or merge the other agent's branch.
