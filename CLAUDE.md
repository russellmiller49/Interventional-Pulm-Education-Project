# Claude worktree entrypoint

Before doing anything else, run:

```sh
npm run wt -- context
```

Confirm the role is `active` or `temporary`, the branch starts with
`claude/`, and the reported module matches the task. The main/control checkout
and detached review worktree are not implementation locations.

Follow all rules in `AGENTS.md`. In particular:

- edit only registry-owned paths;
- claim shared files before editing them;
- never edit any external mount reported by `wt context`;
- acquire an exclusive Supabase mutation lease before any prepare, start,
  stop, migrate, reset, seed, import, or upload command;
- run `npm run wt -- context` and `npm run wt:guard` before a narrowly scoped
  commit;
- use a reviewed PR with a merge commit, then run `npm run wt -- finish`.
