# Agent worktree rules

Run `npm run wt -- context` before reading or editing project files. Stop if the
reported worktree, branch, module, or role does not match the assigned task.

- The main checkout is control-only. Do not edit features, commit, run a dev
  server, or run Supabase mutations there.
- Work only on `codex/<module>/<task>` or `claude/<module>/<task>` branches
  created by `npm run wt -- start ...`.
- Stay inside the module’s owned paths. Shared paths must be declared by
  `config/worktrees/modules.json` and claimed before editing:
  `npm run wt -- claim <path> --reason "<why>"`.
- Claim multiple shared paths in one command. The CLI sorts them to avoid
  deadlocks. Release each claim when the work is complete.
- Treat every mount reported by `wt context` as read-only. This includes
  `.env.local`, selected legacy corpus/manual paths, and
  `local-data/inputs/`. Never copy, edit, stage, or remove their targets.
- Supabase reads use `supabase-read`. Prepare, start, stop, migrate, reset,
  seed, import, and upload operations require the matching exclusive
  `supabase-<operation>` claim.
- Do not switch branches inside a worktree, force-push, broadly stage with
  `git add .`, merge another agent’s task branch, or resolve conflicts
  automatically.
- Do not run `git fetch` or `git pull` from parallel task sessions. `wt start`
  and `wt finish` serialize remote-ref updates through the shared fetch lock.
- Run `npm run wt -- context` and `npm run wt:guard` before committing, then
  stage only reviewed paths. The pre-commit hook repeats the scope guard.
- Agent pull requests use merge commits. Squash and rebase merges are not part
  of this workflow because `wt finish` verifies ancestry against
  `origin/main`.

Use `npm run wt -- doctor` for stale worktrees, mounts, leases, process records,
or ports. See `docs/development/worktree-isolation.md` for recovery and manual
preflight instructions.
