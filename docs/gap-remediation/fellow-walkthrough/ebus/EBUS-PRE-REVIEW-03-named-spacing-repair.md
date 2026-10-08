# EBUS named-label spacing — bounded layout repair

Parent: reviewed column-retention commit `d95fd3e7e6c9593bc8cc6cc777b0d5fc3afa6fae`, on main baseline `46c5bb94f779a1464da6198bba4bcf8550379419`. Branch: `codex/ebus-label-spacing-20260930`; isolated checkout: `Interventional-Pulm-Education-Worktrees/codex-ebus-label-spacing-20260930`.

## Evidence and scope

The independent review cleared column retention and separately identified existing P2 named-label overlap. Its source is `/Users/russellmiller/Documents/Codex/2026-09-30/task-2/evidence/ebus-marker-review-d95fd3e7/review-index.json`. The roadmap's `03_EBUS_ANATOMY_AND_SWEEP_USABILITY.md` section A requires checking actual label collisions while preserving canonical mapping and surface endpoints. The self-paced contract remains authoritative.

Before implementation, main was freshly fetched and remained `46c5bb94`. All 22 current open PRs were refreshed with head SHAs and changed paths; none overlap EBUS. EBUS worktree status checks were clean; allowed process working-directory checks showed other active lanes, with no EBUS process. Neither reviewed EBUS checkout was modified. The CRRT, HD, ECMO and user-owned lanes remain untouched. Literature and Device Intelligence are excluded; Wolf is held. No push, publication, merge or deployment.

The smallest repair changes **named center spacing from 30 to 40 CSS pixels** in `structureCallouts.ts`. The CSS already specifies 34-pixel marker height, so named pills now get the same 6-pixel clearance as unnamed letters. Font sizes, text, tap targets, named-label visibility and margins remain intact. No changes to geometry, surface-anchor selection, canonical IDs/letters, column assignment, observer camera, pose, clinical/model criteria, acquisition or bridge behavior.

Both consumers are exercised: `LinkedModelView` scope labels and `ModelViewport` route labels. The narrow 768-pixel whole-scope view originally included a cross-column overlap as well as same-column collisions; the same spacing repair resolves it without shrinking or hiding any label. No cramped-layout impossibility or substantive packing redesign was needed in the tested states. This does not guarantee arbitrary future counts or canvas sizes can fit.

## Baseline/final measurements

| Rendered view                       | Matched states | Baseline overlap pairs | Final overlap pairs |
| ----------------------------------- | -------------- | ---------------------- | ------------------- |
| Scope, 1246×1021                    | 28             | 2                      | 0                   |
| Scope, 768×1024                     | 28             | 3                      | 0                   |
| Scope, 1024×768 with 200% root text | 28             | 2                      | 0                   |
| Route model and supported resizes   | 27             | 180                    | 0                   |

These are measured pair occurrences across snapshots, not 187 separate defects or 111 independent test cases. Every baseline overlap is 4 pixels vertically. Final minimum same-column box clearance is 6 pixels. All final boxes are inside their canvases; no missing-label workaround is used.

All 111 states preserve canonical IDs, letters, retained columns, label text, 34-pixel box heights and fonts. Route projected endpoints match exactly. Separate scope runs include up to 0.5-pixel horizontal projection differences at slightly different fractional canvas widths; no vertical endpoint changes. The differences are consistent with rounded canvas-center changes: after subtracting the rounded client midline derived from the existing 1-pixel border, no relative projection difference exceeds 0.11 pixel (the exported coordinates are rounded to 0.1 pixel). This is a derived comparison, not a claim of identical raw screen coordinates. Label width differences are at most 0.015625 pixel; label text, font and height differences are zero. Actual surface-anchor code and model assets are unchanged, and their existing tests pass.

The first comparison included larger transient horizontal differences immediately after restoring the supported viewport. The final regression explicitly waits until rendered label edge positions agree with the current canvas width, in addition to fonts and two animation frames. Original evidence remains available; `settled-baseline-final-comparison.json` is the final matched measurement set.

## Verification

| Check                                                                                                      | Actual outcome                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| New stress regression on parent baseline                                                                   | 4 expected failures, solely on measured overlap assertions                                                                        |
| Final stress regression                                                                                    | 4 passed, 111 rendered states                                                                                                     |
| Existing named-reference/hover/keyboard/lesson-4/route labels and reviewed column-retention browser checks | 7 passed                                                                                                                          |
| Embedded guided Vitest                                                                                     | 49 passed in 8 files, including fixed surface anchors, model geometry, acquisition windows and a new six-label packing regression |
| Host bridge/additional-model compatibility Jest                                                            | 10 passed in 2 suites                                                                                                             |
| Embedded TypeScript                                                                                        | Passed                                                                                                                            |
| Fresh production Vite embed build                                                                          | Passed and used in local Next preview                                                                                             |
| Explicit scoped ESLint with `--no-ignore`                                                                  | Passed                                                                                                                            |

The stress test uses genuine existing controls and rendered results: native range Home/End twice, repeated orbit in both directions, names, zoom, camera reset, supported resizes, whole-scope/distal scene reconstruction, compact fallback and supported reentry, lesson restart and page reload. The route path covers six target/approach combinations, orbit, zoom, reset and three viewport widths, including hidden/returning modeled parts. No acquisition observations or clinical state are seeded. Measurement attachments are emitted before overlap assertions so failures retain evidence.

The final four-case run includes the added canvas-width settling guard. The earlier four-pass run and seven compatibility checks use the same runtime repair. Counts are not added together as distinct browser journeys. Full repository build/typecheck, separate theme/DPR/native-zoom/touch/screen-reader qualification and whole-module clinical/media release acceptance were not performed. Phone scope rendering is not claimed: the existing 390-pixel desktop/tablet fallback was verified. The isolated preview has no private environment file or analytics backend credentials; analytics failures are outside this acceptance claim.

## Review artifacts and next step

External evidence: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ebus-label-spacing-20260930/`.

- `open-pr-inventory.json`: refreshed full open-PR inventory.
- `browser-settled-baseline.log` / `.json`, `browser-settled-final.log` / `.json`: baseline/final stress results and attached real box measurements.
- `settled-baseline-final-comparison.json`, `settled-baseline-*.json`, `settled-final-*.json`: exact measurement records and comparison; final-view PNGs alongside them.
- `browser-compatibility.log`, `vitest-final.log`, `jest-compatibility.log`, `types-final.log`, `lint-final.log`, `build-settled-final.log`.
- `repair.patch`: this spacing commit's diff against reviewed parent `d95fd3e7`, exported after commit.

Use the established transient dependency links to the primary checkout for review; no installation or lockfile change was made. Next step is independent review of this local spacing-only commit. Existing clinical, anatomical, source and media-rights release decisions remain owner-held; no new owner decision is needed for this bounded screen-space repair.
