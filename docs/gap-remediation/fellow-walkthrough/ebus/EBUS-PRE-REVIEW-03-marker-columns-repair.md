# EBUS marker-column stability — bounded engineering repair

Base: `46c5bb94f779a1464da6198bba4bcf8550379419` (freshly fetched `origin/main`, 2026-09-30). Branch: `codex/ebus-label-columns-20260930`. Separate checkout: `Interventional-Pulm-Education-Worktrees/codex-ebus-label-columns-20260930`.

## Ownership and scope

Fresh GitHub inventory: 22 open PRs, none with EBUS changed paths. The complete titles, head SHAs and changed paths are preserved in `open-pr-inventory.json` in the external evidence directory below. Read-only EBUS worktree status checks found no dirty implementation work. Allowed process working-directory checks identified the separate `ebus-8bc35d13-independent` review as active. Its reveal repair checkout, four reviewed paths and commit `8bc35d13` remain untouched; this branch starts directly from current main and does not include that repair. Literature and Device Intelligence are excluded; Wolf remains held. No publication, push, merge or deployment.

The roadmap's `03_EBUS_ANATOMY_AND_SWEEP_USABILITY.md` section A addresses L3-3, readable references and preservation of canonical mappings and actual geometric anchors. `structureCallouts.ts` explicitly promises markers keep their columns; the existing lesson-3 browser test requires unchanged columns after rotation. In contrast, `observerCamera.ts` and its former unit test deliberately allowed column reassignment after crossing a hysteresis band. This mismatch is screen-space presentation, not an anatomical calibration question.

## Baseline and repair

On the actual lesson-3 scope model, C remains canonical `optical_lens`. The historical mapping is A=`channel_outlet`, B=`legacy_distal_body`, C=`optical_lens`, D=`transducer_face`. At 1246×1021 and 768×1024, the unmodified helper moves C from its initial left column to the right during repeated `[40, 0, -40, -85, 0]` rotations. It remains on the right even after returning to the original pose. The enlarged-text 1024×768 case did not reproduce a baseline swap; it is additional regression coverage.

The helper now reuses the remembered column for every existing canonical ID. Fresh IDs retain the original median split. The callout handle already stores the map across renders, including temporary hidden markers. The width argument remains available to existing callers. No changes to surface anchors, model geometry, camera, pose, canonical mapping, optical/imaging behavior, selection, acquisition, sweep thresholds, bridge/session validation or learner records.

Unit regressions cover large repeated crossings and resize, new-ID assignment, a returning hidden ID and nonmutation of the caller's map. The new browser regression pins all four historical IDs/letters, observes genuine host messages, drives the existing range control, repeats ten rotations, resizes the view, and checks columns, DOM positions, containment and within-column glyph separation. Fonts and two animation frames settle before measuring projections. It does not inject observations or acquisition evidence.

Settled baseline/final comparison: **36 snapshots, zero differences in canonical ID, letter, or projected anchor coordinates (`ax`, `ay`)** at identical poses and viewports. Baseline C differs from its starting column in nine recorded snapshots in each normal-text case; final column changes are zero. The images show the same model and leader endpoint with C in the retained left column. Label positions change as intended; surface endpoints remain identical.

## Verification

| Check                                                              | Actual result                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| New unit regressions against baseline                              | 2 failed, 6 passed: repeated crossing and returning-ID contracts reproduce the defect           |
| Settled browser baseline                                           | 2 failed (desktop/tablet column swaps), 2 passed (enlarged text and phone fallback)             |
| Embedded guided Vitest suites after repair                         | 48 passed in 8 files, including existing surface-anchor, geometry and acquisition-window checks |
| Embedded TypeScript                                                | Passed                                                                                          |
| Existing host bridge and additional-model compatibility Jest tests | 10 passed in 2 suites                                                                           |
| Built embedded application                                         | Passed; isolated generated output includes the repair                                           |
| Existing anatomy/sweep Playwright spec plus initial new regression | 13 passed: 12 actual browser journeys and 1 reset-readiness helper test                         |
| Final settled, mapping-pinned regression                           | 4 passed: three rendered rotation/resize cases and existing phone fallback                      |
| Scoped explicit ESLint (`--no-ignore`)                             | Passed; ordinary root lint ignores the embedded app, so explicit checking was also run          |

The existing browser spec now passes its formerly failing column assertion, hover/focus/Enter selection and optional named reference. It also checks keyboard focus against a stationary pointer, absence of unnecessary lesson-4 letters, wheel/Escape and zoom behavior, route-model named labels, seven genuine sweep journeys and a demonstration with no learner samples. The shared helper's second consumer (`ModelViewport`) is covered by the route-model check.

The final four-case run occurred after adding settled-layout measurements and hardcoded historical mapping assertions to the new test. Those additions change test code only; the runtime is the same as in the 13-pass run. Counts from the two runs are not presented as 17 unique journeys.

## Limits and owner holds

This is scoped engineering verification, not whole-module clinical, media-rights or release acceptance. No clinical/anatomical owner choice is needed for this column repair; existing source, clinical/model, redaction and rights gates remain intact. Stable columns last for the callout view's lifetime; deliberate scene reconstruction still receives a fresh initial split. Persistence across reconstructed scenes was not added or claimed.

Phones at 390 and 320 pixels retain the authored desktop/tablet lab fallback and have no scope-model iframe. No rendered phone rotation acceptance is claimed. Separate light-theme qualification, touch hardware, DPR variation, native browser zoom, CSS zoom stress and the full repository build/typecheck were not newly performed. Existing keyboard and modified-wheel/browser-zoom-shortcut regressions did run. No dependency, lockfile, auth or security configuration changes; local preview uses a temporary test-only token without private environment files. Analytics backend calls lack credentials in this isolated preview and are not accepted as verified.

The first evidence run also includes a phone readiness timeout (the intentional fallback has no iframe), and an enlarged-text resize check that initially reused the same width. Those harness errors were corrected; the original failed artifacts are retained. Early projection comparisons were taken before initial/resize layout settled; the final settled comparison supersedes them and has no anchor or identity differences.

## Review artifacts

External local evidence: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ebus-label-columns-20260930/`.

- `open-pr-inventory.json`: fresh full open-PR scope inventory.
- `unit-baseline.log`, `vitest-final.log`, `types-final.log`, `jest-compatibility.log`, `lint-explicit-final.log`, `build-settled-final.log`.
- `browser-final.log` / `.json`: existing compatibility journeys and initial new regression.
- `browser-settled-baseline.log` / `.json`, `browser-settled-final.log` / `.json`: matched deterministic evidence.
- `settled-baseline-final-comparison.json`: 36-snapshot coordinate/identity comparison; geometry JSON and before/after marker PNGs alongside it.
- `repair.patch`: final local commit diff, exported after commit.

Next step: independent review of this separate layout-only commit. Do not combine it with the reveal repair under review by editing that review checkout.
