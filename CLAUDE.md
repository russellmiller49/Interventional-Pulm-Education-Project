# Claude entrypoint

You are Claude, one of several agent sessions working on this repository in parallel. `AGENTS.md`
is the workflow; read it before changing anything. In short:

- Work in your own task worktree on a `claude/<task>` branch cut from `origin/main` (recipe in
  `AGENTS.md` → Starting a task). Run the app on your lane's port from `.claude/launch.json`, after
  claiming a runtime slot; port 3110 is Codex's.
- Never commit to `main`, never touch `codex/*` branches, never force-push or rebase a pushed
  branch (merge `origin/main` in instead), and never use `git stash`. Stage specific reviewed paths.
- Check which worktree, branch and commit you are testing, and which checkout owns the port,
  before reporting a result.
- The owner merges PRs and signs clinical content. Finishing an implementation is not clinical
  approval; never set `signedBy` / `signedOn` without his written decision.
- Shared single-writer files (`rollout.ts`, `.claude/launch.json` and the others in `AGENTS.md`)
  change only through their writer; hand changes over in a "Hub note facts" block in your PR body.
- Source knowledge and raw assets that are not in Git live in
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data`; the map is
  `docs/local-authoring-assets.md`. Read them in place, never copy them into the repo.

Reading, reviewing and analysis are fine from any checkout.
