# Mode: pilot — the first run beyond peripheral imaging

Use once, when the pattern first leaves the imaging module. The boundaries, edit classes and
workflow are in `SKILL.md`; this file sets the scope and the stopping point.

1. Read `SKILL.md`, the editorial standard, the repository map and the approved examples. Read a
   small sample of the current peripheral-imaging copy as the voice baseline; don't edit it.
2. Inventory the remaining IP and critical-care modules, starting from the repository map and
   confirming each against the tree: route, canonical copy sources, copy gates, tests, locales.
3. Choose exactly two pilots with good source coverage:
   - one IP module — EBUS if its source is workable (`EBUS-course/` is a separately built app),
     otherwise the best-covered IP module;
   - one critical-care module — mechanical ventilation or hemodynamics.

   Explain the choice. Don't create a module to satisfy a preference.

4. Run [implement](implement.md) on each, each in its own worktree and branch, across every
   in-scope surface — controls, tooltips, cases, rationales and accessible text, not just titles.
5. Stop with two working pilots, their reports and before/after pairs, the E2 tickets, a
   source-coverage statement, and a prioritized list of the remaining modules with a one-line state
   for each. Edit no other module and claim no rollout. Ask before pushing or opening PRs unless
   the user already asked for them.
