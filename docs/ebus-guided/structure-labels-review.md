# Landmark letter repair

September 13, 2026. Focused follow-up to local commit `488871d0`, using the existing shared lesson stage and Phase 1 brief. The learner screenshot showed an A–H selector with no corresponding marks on the anatomy. This made the landmark task ambiguous.

## Result

The same candidate order now supplies the dropdown, mesh picking, anonymous hover text and clickable letter callouts. Leaders attach to actual mesh vertices; the selected letter, leader and structure are highlighted. Callouts follow the observer camera, fit into two spaced columns, and support keyboard activation. Anatomical names are omitted from marker text, accessibility labels and tooltips during identification. Observe conceals the model and markers; worked teaching and Explain retain the existing named discovery.

The current “Find…” instruction and selection/check controls now precede the model. Switching to a different model exposes a return control for the required landmark view. Selecting another structure clears previous feedback. Empty selection disables the check. Isolated structures remain selectable through the letters. Off-screen leaders are suppressed with a reset-view hint. Observer actions and marker selection do not complete landmarks or produce acquisition credit.

Changed application paths: `EBUS-course/apps/web/src/guided/LinkedModelView.tsx`, `structureCallouts.ts`, and `guided.css`. No geometry, pose calibration, source assets, acquisition rules, answer keys, progress storage, legacy EBUS route or release state changed.

## Verification

- Embedded build and standalone asset preparation: PASS. Refreshed the existing local preview on port 3145.
- Root and embedded type checks: PASS. Focused browser-script ESLint and `git diff --check`: PASS.
- Existing linked-model, image-discovery and acquisition-window suites: 14 tests PASS.
- `scripts/ebus-guided/browser-structure-labels.ts`: PASS on right-paratracheal, scope-orientation, station-seven and ct-map. Verified identical marker/option mapping, all leaders visible initially, every marker selects its option, reverse dropdown selection, anonymous hover and Escape, no completion/acquisition credit, moving leaders during orbit, wrong-answer retry, keyboard activation, isolation, and concealed Observe.
- Right-paratracheal layout at 1440, 1280 and 900 pixels: no overlapping letter buttons or document overflow. Inspected real-model screenshots in `artifacts/ebus-guided/structure-labels/`, including unselected anatomy, selected anatomy, scope tip, compact view and concealed Observe. Markers use the source anatomy; no mock models or fabricated response state.
- Existing `browser-phase1-followup.ts`: all five lessons PASS, including real retained-image pixel comparisons, changed-position transfer, restart/review, stale-session rejection, keyboard/compact, phone and missing-model gates. Results remain in `artifacts/ebus-guided/phase-1-followup/browser-result.json`.

## Structured lesson contract for this repair

| Rule | Result and evidence                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| H1   | PASS — canonical routes and registry unchanged; real direct-link journeys exercised.                               |
| H2   | PASS — worked teaching precedes identification in the five lesson regressions.                                     |
| H3   | PASS — existing shared stage reused; no shared-layout edits.                                                       |
| H4   | PASS — current landmark, visible letter referents and real answer/check controls colocated.                        |
| H5   | PASS — rendered markers and instruction inspected in actual lessons.                                               |
| H6   | PASS — selection/orbit alone yield no identification or acquisition credit; real checks and sweeps still required. |
| H7   | PASS — anonymous markers/hover, wrong-answer retry, feedback clearing and concealed Observe verified.              |
| H8   | PASS — geometry and engine untouched; existing acoustic/window tests and retained-image comparisons pass.          |
| H9   | PASS — storage untouched; reset, stale-session and review regressions pass.                                        |
| H10  | PASS — instructions explicitly reference visible letters on the 3D model and the existing check control.           |
| H11  | PASS — scoped feature repair; no push, deployment or release changes.                                              |
| H12  | PASS — actual browser interactions and inspected wide/compact screenshots; no simulated progress injection.        |

This verifies the interface repair, not clinical validation of the teaching geometry. Existing faculty/source review items in `phase-1-followup-review.md` remain unchanged. Work stays local.
