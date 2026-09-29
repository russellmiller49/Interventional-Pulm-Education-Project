# Handoff — MT-00a foundation manifest

| Field               | Value                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 1 of the first build round; work package MT-00                                                                                              |
| Branch              | `claude/mt-00a-foundation-manifest`                                                                                                         |
| Base                | `origin/main` `519415e8bb60baabe16c979a976d7e054458e3d2`                                                                                    |
| Prerequisite slices | `claude/mt-00b-legacy-safety` at `3660d24a`; `claude/mt-01a-sponsor-notice` at `12f13594`. Both merged into this branch as its first commit |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-00a-foundation-manifest.md`                |
| Owner decision      | OD-07: the revised plan governs, and the original supplies the inventory                                                                    |
| Date                | 2026-09-28                                                                                                                                  |

## Why

The revised plan cites an inventory it does not contain, and none of the three planning documents
is in the repository. This slice imports the inventory with the line each item came from, records
what the owner has decided, and sets out the contracts the rest of the build works to. After it,
the build no longer depends on files outside the repository to know what it is building.

## What changed

| Path                                                                          | Change                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/medical-thoracoscopy/implementation-manifest.json`                      | New. Nineteen sections, seven practice scenarios, four cases, four controls, eight spine phases, the diagnostic table's seven rows, five chapter names, the outcome alignment, corrected assumptions, model boundaries, budgets and the prototype gate. Each item names its planning layer and line |
| `docs/medical-thoracoscopy/owner-decisions.md`                                | New. OD-01 to OD-10, and every open item with the default being built                                                                                                                                                                                                                               |
| `docs/medical-thoracoscopy/plan-reconciliation.md`                            | New. The three layers, where the revised plan changes the original, and where the repository changes what both assumed                                                                                                                                                                              |
| `docs/medical-thoracoscopy/learning-contract.md`                              | New. Adopts the self-paced policy for this module                                                                                                                                                                                                                                                   |
| `docs/medical-thoracoscopy/fidelity-contract.md`                              | New. What each experience does and does not represent                                                                                                                                                                                                                                               |
| `docs/medical-thoracoscopy/module-plan.md`                                    | New. Learner, spine, controls, the diagnostic table, and the ladder of one concept per section                                                                                                                                                                                                      |
| `docs/medical-thoracoscopy/section-authoring-guide.md`                        | New                                                                                                                                                                                                                                                                                                 |
| `docs/medical-thoracoscopy/review-lanes.md`                                   | New. Reviewers are not assigned                                                                                                                                                                                                                                                                     |
| `docs/medical-thoracoscopy/repository-baseline.md`                            | New                                                                                                                                                                                                                                                                                                 |
| `docs/medical-thoracoscopy/README.md`, `handoffs/TEMPLATE.md`                 | New                                                                                                                                                                                                                                                                                                 |
| `scripts/medical-thoracoscopy/import_inventory.py`                            | New. Produces the manifest from the planning documents and refuses to write a string it cannot find on the cited line                                                                                                                                                                               |
| `scripts/medical-thoracoscopy/verify_inventory_import.py`                     | New. Repeats that comparison without rewriting the manifest                                                                                                                                                                                                                                         |
| `src/features/medical-thoracoscopy/__tests__/implementation-manifest.test.ts` | New. Pins the ids, order, counts, statuses and budgets                                                                                                                                                                                                                                              |

No application code, route, asset or learner-facing text changed.

### Outside the repository

Copies of the planning layers were gathered in the owner's local data, under
`medical_thoracoscopy/plans/`, with a short index. Nothing already in that folder was changed. The
first revision existed only inside a session log; it is now a file of its own.

## Claims and assets touched

None. The module plan's concept statements are authoring intent. They enter the claim register
when their sections are written.

## Checks run

| Command                                                                                             | Result                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `python3 scripts/medical-thoracoscopy/verify_inventory_import.py` with all three planning documents | Hashes and line counts match. 173 imported strings compared (131, 34 and 8 by layer); every one found on the line it cites |
| The same script given a wrong file, and given a manifest with one title altered                     | Fails both times, naming the hash and the line                                                                             |
| `npx jest src/features/medical-thoracoscopy --runInBand`                                            | 1 suite, 17 tests, all passing                                                                                             |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                         | Clean                                                                                                                      |
| `npm run lint`                                                                                      | 0 errors, 15 warnings. None is in a file this slice changed                                                                |
| Relative links in `docs/medical-thoracoscopy/`                                                      | All resolve                                                                                                                |
| `npx prettier --check` on the changed files                                                         | Clean                                                                                                                      |
| `git diff --check`                                                                                  | Clean                                                                                                                      |

The type check ran out of memory at Node's default heap limit on this machine after the
production build had run. It is not caused by this slice; see the repository baseline.

## Real browser observations

Not applicable. Nothing in this slice is rendered.

## Checks not run

- **Full test suite, Storybook build, production build.** Run for slice B. The next integration
  point follows slice 5.
- **Clinical review of the module plan.** Not run. The ladder is authoring intent.
- **A comparison of the manifest against the planning documents in CI.** The documents are not
  in the repository, so the comparison is a script run where they are.

## Unresolved decisions

Every row under "Open" in the owner decisions. The three that shape the next slices most:

- **T1**, which sections belong to which chapter.
- **T6**, the port for the prototype.
- **S1**, the wording of the sponsorship disclosure.

## What must not happen next

- Do not change a section id. Deep links, saved progress and the claim register use them.
- Do not edit the manifest by hand. Change `import_inventory.py`, run it, and run the verifier.
- Do not record a default as a decision. Only the owner's own decision moves a row to "Decided".
- Do not copy the planning documents into the repository.

This does not change publication status or constitute clinical approval.
