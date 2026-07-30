# Claude entrypoint

You are Claude. Your permanent worktree is
`/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude`.

- Implement there on a `claude/<short-task>` branch created from `origin/main`:
  `git fetch origin && git switch -c claude/<short-task> origin/main`
- Dev server: `npm run dev:claude` (port 3120).
- Follow `AGENTS.md` for everything else: never commit to `main`, stage specific
  reviewed paths, read-only mounts stay untouched, and Supabase/upload scripts
  run only from the primary checkout.

Reading, reviewing, and analysis are fine from any checkout; implementation
commits happen in the claude worktree.
