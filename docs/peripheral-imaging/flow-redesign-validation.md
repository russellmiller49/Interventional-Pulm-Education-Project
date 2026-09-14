# Peripheral imaging flow verification

Run in `codex-imaging-9-13`, branch `codex/peripheral-imaging-flow`, against baseline `d209c800` on September 13, 2026 (Pacific). This report distinguishes source inspection, executed checks and outstanding human review. The supplied redesign brief informed this module update; no release or shared-data changes were authorized or made.

## Environment and commands

The module was served with `npx next dev --webpack --hostname 127.0.0.1 --port 3147`. An existing server in this same checkout occupied the original port; only that checkout's process was stopped. Other checkouts were left running. The dedicated browser suite rejects non-local hosts and creates isolated browser contexts. No authenticated clinical data or production fixtures are used.

| Check                 | Command                                                                                                                                                                                                                                                                                | Outcome                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Baseline module tests | `npx jest --runInBand src/features/peripheral-imaging --silent`                                                                                                                                                                                                                        | 29 suites, 194 tests passed before changes.                                                                      |
| Updated module tests  | `npx jest --runInBand src/features/peripheral-imaging --silent`                                                                                                                                                                                                                        | 30 suites, 214 tests passed.                                                                                     |
| Feature lint          | `npx eslint src/features/peripheral-imaging`                                                                                                                                                                                                                                           | Passed.                                                                                                          |
| Repository type check | `npm run type-check`                                                                                                                                                                                                                                                                   | Passed after correcting an unsupported Testing Library matcher option in the updated test.                       |
| Browser regression    | `PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3147 PERIPHERAL_IMAGING_OUTPUT_DIR=/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/peripheral-imaging-flow-2026-09-13/browser-verified npx playwright test --config=playwright.peripheral-imaging.config.ts` | 19 tests passed (3.1 minutes), including all 19 direct section links and eight complete representative journeys. |
| Whitespace            | `git diff --check`                                                                                                                                                                                                                                                                     | Passed.                                                                                                          |

Prettier was run only on the explicitly changed TS, TSX, CSS and Markdown paths. The normal pre-commit hook runs staged-file lint/format checks. No shared stage source, global CSS, dependency, release catalog, persistence schema or question-answer key changed. Full-repository Jest, production build, cross-browser/screen-reader testing, shared-data fixtures and deployment were not run for this feature-local update. The real Next route compiled and rendered for every section during browser verification.

## Executed behavior

- All 19 section definitions validate their authored activity order, content references and pre-interpretation teaching. Rendered component tests check every essential block body, bullet and technical detail at its assigned activity; suites are mocked in those content tests. Browser direct links separately exercise the actual image implementation.
- Complete browser journeys cover projection, field, timing, DTS, CBCT, sampling-component MPR review, changing anatomy and dose records. Each journey makes a wrong interpretation, reads feedback, retries, completes the changed transfer item and checks persisted completion. Practice and capstone journeys retain their existing first-decision and eligibility policies.
- Saved projection pixels survive image manipulation, read-to-read comparison, resize, outline expansion, back/review and demonstration replay. Crop/zoom do not change acquisition metadata. Restricted field context fails the existing task predicate. First answers remain immutable through retry and reload; unfinished sections restart honestly.
- Timing is exercised with reduced motion/manual stepping and separate pulse-width and pulse-rate comparisons. DTS independent plane navigation remains enabled without keyed plane shortcuts. Independent MPR permits slice/slab review while withholding sampling-window readouts, target-slice shortcuts and mounted 3D truth geometry.
- CBCT centering uses both real rendered scout projections. Learner-declared checks gate capture; changing setup invalidates readiness, checks and capture. No collision or physiological verification is inferred from the checklist. The existing CT substitute is explicitly identified as not reconstructed from the simulated orbit.
- Asset loading is deliberately failed. Image-based Continue remains disabled, teaching stays visible, replay remains accessible and no attempt/completion is written.
- Viewports: 1440×900, 1280×720, 1024×768, 390×844 and 320×740. The suite also checks 200% root-font enlargement at 900 and 1440 pixels, keyboard activation and transition focus. This is text enlargement, not an assertion of browser-level zoom or a full assistive-technology audit. No Steps/Teaching/Simulator tabs or horizontal page overflow are accepted.

## Failures retained and corrected

The baseline suite was green. Intermediate failures are not described as baseline failures.

1. Tests that depended on obsolete panel positions and fixed step numbers failed after the activity migration. They now locate authored activity IDs and real interaction types; disclosure, first-answer, readiness and scoring assertions remain.
2. Initial browser run: 7 passed, 3 failed. A saved field comparison was lost between reading activities, and the acquisition layout squeezed the room canvas to zero width, blocking readiness. Related reading activities now share a frozen capture, and the acquisition grid gives the rendering surface nonzero dimensions.
3. Targeted rerun: field and acquisition movement passed; current-anatomy exposed the same zero-width problem in a comparison layout. Comparison presentation now selects the image-first layout for navigation and registration too.
4. Expanded browser run: 18 passed, 1 failed. The remaining test demanded an SVG from the text-based provenance activity. It now verifies the five visible provenance entries explicitly. Their presentation was also separated into labeled source/result rows. Required canvas assertions still fail if a canvas is absent or lacks image signal.
5. Feature lint rejected a redundant reset of a ref through the props object. Reset already occurs in the owning host/demonstration handler; the duplicate was removed. TypeScript caught a browser-only `exact` option used with Testing Library; string names already match exactly and that option was removed.

6. The next full run passed 18 tests; the new scout-pixel assertion requested WebGL from a 2D snapshot canvas. It now uses the helper’s 2D pixel path. The CBCT journey then passed separately, including preserved scout pixels/capture after back/review and demonstration replay.
7. Screenshot inspection found an existing narrow-screen SVG background covering the MPR CT canvas. The opt-in course style makes that overlay transparent; browser checks now require all three CT canvases to contain image signal and the phone overlays to be transparent. The final complete run passed all 19 tests.

Raw intermediate logs and failure screenshots remain in the local output folder described below. No failed run was overwritten by a success report.

## Visual evidence

Evidence root, outside Git:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/peripheral-imaging-flow-2026-09-13/`

- `before-1440.png`: inspected original three-pane presentation. This is a layout baseline, not an imaging acquisition baseline.
- `browser-verified/`: final actual browser screenshots of projection at five widths, text enlargement, fixed baseline/current image pairs, field crop/zoom, timing detail, DTS independent plane, CBCT scouts/capture, phone MPR, dose records and the course entry.
- `browser/`, `browser-second/`, `browser-expanded/`, `browser-final/`: intermediate failure evidence and corrected-layout context.
- The frozen baseline image is a separate captured image/state object in the lesson. The browser compares its pixel data; layout-before/after screenshots do not establish acquisition immutability.

The isolated `captured-volume.png` and `sampling-phone.png` figure captures temporarily suppress page headers/footers only for export; their image content is unchanged. Viewport screenshots retain the actual application navigation. The intermediate captures are retained so their obscured backgrounds and capture artifacts remain auditable.

Inspected final screenshots show readable CT-derived projection pairs at laptop width, unchanged baseline versus enlarged stored display, separate timing samples, reconstructed teaching-plane texture, and vertically stacked MPR panels on a phone. The views remain illustrative teaching evidence: authored lesions/tools, schematic MPR relationships and CT-derived backgrounds are not new clinical acquisitions. Images are read in document flow and may require scrolling, particularly the three phone MPR planes. Instructor observation should assess whether that tradeoff supports the intended task.

## Repository teaching contract

| Rule                    | Result and evidence                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1 One course           | PASS: canonical 19-section order, eight chapter groups, common Start/Continue resolver; hub, Practice and Assess browser checks.                                                                             |
| H2 Teach before testing | PASS for delivered content/flow: section-specific sequences and worked explanations precede interpretation; real guided actions and changed transfer items. Educational efficacy remains unvalidated.        |
| H3 Fixed shared stage   | NOT APPLICABLE to the retired layout: the current module redesign replaces three panes. The shell is feature-local; shared stage defaults are untouched.                                                     |
| H4 Current task         | PASS under the current design: one heading/instruction, current evidence and response, one primary footer action. Existing NowCard action model/reducer semantics retained without the old pane composition. |
| H5 Rendered teaching    | PASS: all-section rendered content tests and real-route browser entry checks; see preservation matrix for destinations.                                                                                      |
| H6 Real completion      | PASS: existing lab/event predicates and committed responses, image readiness guards, deliberate continuation; no dwell timer or route-visit completion.                                                      |
| H7 Disclosure           | PASS for tested boundaries: independent teaching configuration, withheld keyed outputs/shortcuts, first commitment before feedback; Practice/Assess policies unchanged.                                      |
| H8 Fidelity             | PASS for preservation and tested model invariants: existing geometry, projection, timing, reconstruction, field, acquisition and scoring tests retained. No new clinical-physics validation is claimed.      |
| H9 History              | PASS: stable question IDs, original and v2 records remain resolvable, no rescore, first-answer persistence and honest reload boundary.                                                                       |
| H10 Language            | PASS for targeted copy/source inspection and existing copy checks; faculty review remains appropriate.                                                                                                       |
| H11 Scope               | PASS: feature code, dedicated test configuration/tests and docs only; no release, deployment or shared-data change.                                                                                          |
| H12 Actual use          | PASS for the listed automated routes/viewports and inspected screenshots. Human usability, faculty and medical-physics review remain outstanding.                                                            |

## Remaining review

Run the instructor script in `flow-redesign.md` with first-time learners. Faculty/medical-physics reviewers should assess adequacy of projection labels, schematic sampling relationships, task-specific image readability, radiation wording and the distinction between a declared checklist and verified real-world readiness. Existing missing capabilities remain explicit: manual recentering workflow, detector lag, full scatter/noise/exposure response, clinical dose, collision detection and physiological safety are not simulated or newly claimed. No clinical images were fabricated to fill those gaps.

The task boundary is a reviewable implementation/PR. It does not merge, deploy, publish or validate clinical competence.

## Changed paths

All paths are relative to the repository root. No shared feature implementation changed.

```text
docs/peripheral-imaging/flow-preservation-matrix.md
docs/peripheral-imaging/flow-redesign-validation.md
docs/peripheral-imaging/flow-redesign.md
e2e/peripheral-imaging.spec.ts
playwright.peripheral-imaging.config.ts
src/features/peripheral-imaging/__tests__/learning-activities.test.tsx
src/features/peripheral-imaging/__tests__/stage-host.test.tsx
src/features/peripheral-imaging/__tests__/stage-lessons.test.ts
src/features/peripheral-imaging/__tests__/stage-precommit-leak.rendered.test.tsx
src/features/peripheral-imaging/__tests__/stage-session.test.ts
src/features/peripheral-imaging/components/PeripheralImagingHub.tsx
src/features/peripheral-imaging/components/PeripheralImagingLearnLanding.tsx
src/features/peripheral-imaging/components/hub/ImagingPathwayAccordion.tsx
src/features/peripheral-imaging/components/peripheral-imaging-module.module.css
src/features/peripheral-imaging/components/stage/ImagingActivityShell.tsx
src/features/peripheral-imaging/components/stage/ImagingStageHost.tsx
src/features/peripheral-imaging/components/stage/ImagingTeachingColumn.tsx
src/features/peripheral-imaging/components/stage/LessonDemonstration.tsx
src/features/peripheral-imaging/components/stage/TeachingPanels.tsx
src/features/peripheral-imaging/components/stage/imaging-flow.module.css
src/features/peripheral-imaging/components/suite/LabDock.tsx
src/features/peripheral-imaging/components/suite/Monitor.tsx
src/features/peripheral-imaging/components/suite/SuiteScene.tsx
src/features/peripheral-imaging/components/suite/suite-scene.module.css
src/features/peripheral-imaging/components/suite/types.ts
src/features/peripheral-imaging/components/suite/views/ConeBeamView.tsx
src/features/peripheral-imaging/content/labGoals.ts
src/features/peripheral-imaging/content/learningActivities.ts
src/features/peripheral-imaging/content/pathwayResolver.ts
src/features/peripheral-imaging/content/sectionSpecs.ts
src/features/peripheral-imaging/content/stageLessons.ts
src/features/peripheral-imaging/content/teachingExamples.ts
src/features/peripheral-imaging/data/lessons.ts
src/features/peripheral-imaging/engine/labMetrics.ts
src/features/peripheral-imaging/test-support/stageHarness.tsx
```
