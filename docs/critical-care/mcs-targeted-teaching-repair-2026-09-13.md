# MCS targeted teaching repair — September 13, 2026

Implementation baseline: `d209c8006e693e9d4ee8a250347911e191508029` (clean worktree, fetched `origin/main`). Branch: `codex/mcs-targeted-teaching`. This is a bounded repair of five introductory Learn sections, not a clinical approval or release.

## Scope and importing path

The real `src/app/[locale]/mechanical-circulatory-support/learn/page.tsx` mounts `McsStageHost`, which builds the existing section through `stageLessons`, `sectionLearningContracts`, `sectionSpecs`, and `lessonTransfers`. The additional introductory steps feed that same host. The nine section IDs, pathway resolver, existing progress adapter, optional 3D gate, Practice, and Challenge/Assess routes remain in place. The shared stage and hemodynamics engine are unchanged.

The older prediction-first instructions and rendered tests conflicted with this assignment's request to explain foundational concepts first. The exception is confined to the five selected introductions. Their subsequent independent questions still withhold answer-bearing explanations, feedback, 3D causal descriptions, and controls until the appropriate commitment. The other four sections retain their instructional sequences. Small shared provenance and location wording corrections keep the alternate teaching panels consistent.

Desktop order remains Steps → Teaching → Simulator, with explicit opening fractions 0.26/0.29 and minimum widths 300/280/340. Compact layouts use the existing full-width pane tabs. The task control leads its simulator pane; full reference monitoring is optional during the introductory demonstrations. Small-screen maps retain readable labels in a keyboard-scrollable area instead of shrinking the text.

## Implemented learner journeys

Every URL starts with `/en/mechanical-circulatory-support/learn?lesson=`.

| Section / URL suffix          | Connected learning sequence                                                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcs-foundations-signals`     | Native circulation and IABP orientation → existing circulation walk → measurement definitions and three guided inspections → fresh pressure/flow questions → inspect-only task → captured unchanged readings and structured interpretation → transport case.                           |
| `mcs-foundations-mechanisms`  | Annotated parallel/serial pathways → circulation walk → independent application → select all three devices in any order → retained engine results with patient, seed, configuration and interval → control classification → changed loading case with a required captured observation. |
| `iabp-timing-triggering`      | Normal assisted beat with U/N/I/D references → four separate timing demonstrations → changed example without diagnostic annotations → inflation correction → captured timing response → changed rhythm/trigger and a required observation.                                             |
| `impella-unloading-placement` | Aligned LV inlet/aortic outlet and insertion-versus-flow distinction → bounded CP P5-to-P6 unloading demonstration → fresh application → specifically too-deep simulated fault → captured response → afterload transfer. Too-shallow does not satisfy the too-deep task.               |
| `lvad-parameters-assessment`  | Controller and patient-quantity tour → guided SVR change at fixed speed → fresh model-estimator question → larger afterload experiment → captured direction/magnitude → clinical assessment transfer. Speed authorization is unavailable in this task.                                 |

The timing strip and balloon band use the existing engine timing selectors and cycle state, not another animation clock. The normal reference includes three beats so a complete assisted cycle and an unassisted comparison are visible. The independent example uses a different inflation offset and assist ratio from the demonstrations. The text equivalent provides event observations without naming the diagnosis.

## Quantities, state and evidence

- For represented parallel LV-to-aorta support, concurrent native forward flow plus left-pump flow minus represented recirculation matches the existing engine, within rounding and clamps. Pre-support native output is different. Serial RP flow is not added to systemic flow. No equations or conservation logic changed.
- IABP is labeled as having no separate pump-flow stream; its effect on native loading can change native forward output. Device estimates and modeled effective flow are not bedside cardiac-output measurements.
- The LVAD teaching model produces flow from speed/loading, then derives electrical power and PI. It does not implement the manufacturer's flow estimator. Electrical power and calculated cardiac power output both use watts but remain distinct; CPO is a pressure–flow product. LV volume is labeled modeled volume, and simulated SvO2 is labeled oxygen balance, not a direct oxygen-delivery measurement.
- Device comparison selections rebuild the same reference patient and compartments and observe eight simulated seconds. This authored interval is not a clinical stabilization time, equivalent support dose, or mastery criterion. Configuration identity and all three results remain available, including when the last selection is IABP.
- One-variable tasks repeat from their captured baseline. Setup, demonstrations and reset clear learner action IDs. A feature-local dispatch guard intersects task permissions with scenario restrictions, fails closed for setup/reset/clock actions, and locks review. The workbench retains its separate open exploration mode.
- Back shows an immutable earlier state together with its matching baseline. Return to current task restores the preserved live task without replaying setup. Transfer uses a fresh seed and clears setup actions; a mechanism selection retains that transfer patient's authored loading.
- Learn records the actual submitted answer and states whether it was correct. A wrong submission can be worked through with feedback; it is not called a correct answer or clinical competence. Required actions and transfer observations cannot be replaced by a generic control visit.
- Persistence remains `interventionalpulm:mcs-progress:v1`. Completed sections and case/score history survive. Incomplete sections restart with their reference on reload/direct later-phase entry. In-session answers and captures are not a new durable attempt store or mid-step resume promise.

## Executed evidence

Baseline command: `npm test -- --runInBand src/features/mechanical-circulatory-support` — **29 suites, 686 tests passed** before changes. No pre-existing failures in this scoped suite.

Final commands and results:

| Command                                                               | Result                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --runInBand src/features/mechanical-circulatory-support` | **30 suites, 703 tests passed**; includes all nine actual-host walkthroughs, Practice/Challenge disclosure and progress suites, flow/conservation/placement tests, and 17 new discriminating cases.                               |
| `npx tsc --noEmit --pretty false`                                     | Passed (exit 0).                                                                                                                                                                                                                  |
| `npx eslint src/features/mechanical-circulatory-support`              | Passed (exit 0).                                                                                                                                                                                                                  |
| `git diff --check`                                                    | Passed.                                                                                                                                                                                                                           |
| `npx next build --webpack`                                            | Passed (exit 0): optimized application compiled, TypeScript passed, 767 static pages generated, and all four MCS routes were emitted. This directly checks the Next application without regenerating sibling training-app assets. |

Build warnings came from the unchanged Mermaid/Langium dependency import chain, next-intl/contentlayer cache dependency parsing, and missing global metadataBase. No scoped MCS build error occurred. The final two-line overview wording change was followed by the focused one-door tests and TypeScript/lint confirmation.

Browser: the actual Next route ran on `http://localhost:3135`, using the repository's existing local-development auth route and a task-only local token. All five selected lessons were completed through the UI, including their transfer work. The browser's completed history remained available after reload; Overview's Continue pointed to the first remaining section, `iabp-efficacy-limits`.

| Browser check    | Observed evidence                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1440×900         | Three panes in the approved order; first reference visible without an answer; reverse-order comparison retained all three results; captured review returned to the transfer patient.                                                                   |
| 1280×800         | Complete assisted-cycle reference, changed unannotated timing example, focused inflation control, and timing correction/trigger transfer completed.                                                                                                    |
| 768×900          | LVAD parameter tour and fixed-speed afterload task completed through pane tabs.                                                                                                                                                                        |
| 390×844          | Impella teaching/map and unloading guide; too-shallow rejected, too-deep accepted; observation and transfer completed; 3D suitability gate offered the lightweight alternative.                                                                        |
| Keyboard         | First lesson's answer, inspection, observation and transfer controls operated with Space/Enter. Arrow keys changed timing and SVR. Map scroll area accepts keyboard focus and horizontal panning.                                                      |
| Reduced motion   | Browser media emulation enabled; static timing reference and task controls remained usable. Playback starts paused for the selected introductions.                                                                                                     |
| Zoom             | CDP 200% visual magnification and a 720×450 CSS viewport with 2× scale were exercised; the latter had zero document horizontal overflow and reachable Read/Continue actions. Native browser-menu 200% zoom was not exposed by this automation surface. |
| Reload / history | Fresh direct entries start at teaching; completed history persisted and Continue resolved the next incomplete section after reload.                                                                                                                    |
| Optional 3D      | Closed anatomy was not loaded. At mobile width the existing suitability gate offered Continue on this device and Open lightweight alternative. Heavy 3D rendering was not needed to finish a selected lesson.                                          |

Actual model readings retained during the reverse-order browser run:

| Quantity                       |               IABP | Impella CP P5 | Durable LVAD 5200 rpm |
| ------------------------------ | -----------------: | ------------: | --------------------: |
| Concurrent native flow (L/min) |               4.51 |          3.32 |                  2.53 |
| Pump estimate (L/min)          | No separate stream |          2.44 |                  3.77 |
| Modeled effective flow (L/min) |               4.51 |          5.76 |                  6.30 |
| Pulse pressure (mm Hg)         |                 30 |            22 |                    17 |

All three used seed 418 and were captured at 8.00 simulated seconds. These are executed model observations, not clinical comparative effectiveness data. The changed IABP example improved modeled synchrony from 73% to 100% after inflation correction. The transfer trigger comparison was 50% to 74%; feedback explicitly did not generalize this to a preferred clinical trigger.

Screenshots were captured and inspected in this task's browser tool output (reference, comparison review, independent timing question, mobile map, LVAD tour and final focused control). No mockups were substituted. The full five-by-every-viewport Cartesian matrix and a new heavy-3D rendering test were not executed. Non-target Learn and Practice/Assess transitions are covered by the regression suites; browser checks of those routes were entry smoke checks only.

## Source and faculty review boundaries

New or materially revised teaching remains draft for faculty review. Existing source IDs and publication status are retained; no recall sweep or clinical approval is implied.

- [Getinge IABP training reference](https://getinge.training/a/media/file/193610/attachment/?rnd=1653495882): inspected timing references and separate early/late inflation/deflation teaching. Supports general event relationships, not this model's numerical response or bedside settings.
- [FDA-hosted Impella 5.5 instructions](https://www.fda.gov/media/140766/download): inspected inlet/outlet and too-deep/too-shallow positioning discussion. Used for orientation only; 5.5 controls or dimensions were not generalized to CP.
- [FDA-hosted HeartMate 3 IFU, October 2018](https://www.accessdata.fda.gov/cdrh_docs/pdf16/P160054S008D.pdf): inspected parameter definitions (printed 1-21/1-22), flow display (4-13) and pressure-gradient dependence (5-54). Corroborates the distinction between real device estimation and this authored engine. It is a dated reference, not a claim to have reviewed the current device's full instructions.
- [Rüschen et al., PMID 27609634](https://pubmed.ncbi.nlm.nih.gov/27609634/): abstract-level corroboration of combined native and assist output; not an operating guide or clinical validation of the simulator.
- Existing `engine/model.ts`, reducers, teaching selectors and progress adapter were traced and exercised directly. The physiology implementation is the source for all displayed simulation-response claims.

The arterial waveform is schematic; reference markers are authored events, not detected dicrotic notches. Early/late deflation diagnosis from a faithful clinical contour is outside the present model. The malposition fault changes model support but does not reproduce every clinical chamber-flow or device-alarm phenotype. No manufacturer controller algorithm, oxygen transport balance, organ response, dosing protocol, or clinical competence assessment was added. Faculty review should concentrate on these boundaries and the new timing/application language.

A corrupt local `.next/dev/prerender-manifest.json` interrupted a browser navigation. Only this task's dev server was restarted and its generated cache moved aside; navigation then worked. Isolated local analytics requests returned server errors without connected Supabase configuration. Local completion history and the scoped analytics/privacy regression tests passed; production analytics connectivity was not verified.

## Acceptance in this repair's scope

| Rule | Status / evidence                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS: existing overview, nine IDs, resolver and Learn/Practice/Challenge routes retained; historical Challenge label remains the Assess route.                          |
| H2   | PASS: all five connected reference → guided example → fresh application journeys completed.                                                                             |
| H3   | PASS: shared stage reused with explicit dimensions; no shared stage edits.                                                                                              |
| H4   | PASS: Now card owns the task, controls and submission; locations name the visible blocks.                                                                               |
| H5   | PASS: introductory content and actual captured results rendered in the real routes.                                                                                     |
| H6   | PASS: named state predicates, retained comparisons and required observations exercised; reading is not graded as a treatment.                                           |
| H7   | PASS: actual first responses retained in-session; wrong/unsafe and hidden-DOM disclosure regression checks pass.                                                        |
| H8   | PASS within model scope: existing equations, waveforms, assets and scenario permissions preserved; fidelity limits stated.                                              |
| H9   | PASS: completed history survives reload; no new persistence schema or invented prior answers.                                                                           |
| H10  | PASS for targeted copy: conventional quantities, purpose-labeled controls, and draft provenance.                                                                        |
| H11  | PASS: feature-local changes and report only; no release, access, database, deployment or shared-engine changes.                                                         |
| H12  | PASS for the executed five journeys and listed viewport/emulation checks; native menu zoom, full viewport cross-product and heavy 3D remain unverified as stated above. |

## Changed files

The list below is relative to the repository root; the PR diff is the review surface.

- `docs/critical-care/mcs-targeted-teaching-repair-2026-09-13.md`

- `src/features/mechanical-circulatory-support/__tests__/m4-teaching-panels.test.tsx`

- `src/features/mechanical-circulatory-support/__tests__/stage-learner-review.test.tsx`

- `src/features/mechanical-circulatory-support/__tests__/stage-precommit-leak.rendered.test.tsx`

- `src/features/mechanical-circulatory-support/__tests__/stage-walkthrough.test.tsx`

- `src/features/mechanical-circulatory-support/__tests__/targeted-introductions.test.tsx`

- `src/features/mechanical-circulatory-support/components/McsControls.tsx`

- `src/features/mechanical-circulatory-support/components/McsHub.tsx`

- `src/features/mechanical-circulatory-support/components/stage/McsCapturedResults.tsx`

- `src/features/mechanical-circulatory-support/components/stage/McsIntroTeaching.tsx`

- `src/features/mechanical-circulatory-support/components/stage/McsSimulatorPane.tsx`

- `src/features/mechanical-circulatory-support/components/stage/McsStageHost.tsx`

- `src/features/mechanical-circulatory-support/components/stage/McsTaskControls.tsx`

- `src/features/mechanical-circulatory-support/components/stage/McsTeachingColumn.tsx`

- `src/features/mechanical-circulatory-support/components/stage/McsTimingFigure.tsx`

- `src/features/mechanical-circulatory-support/components/stage/mcs-stage.module.css`

- `src/features/mechanical-circulatory-support/components/teaching/LvadParametersAssessmentPanel.tsx`

- `src/features/mechanical-circulatory-support/content/commonModel.ts`

- `src/features/mechanical-circulatory-support/content/introductorySteps.ts`

- `src/features/mechanical-circulatory-support/content/lessonTransfers.ts`

- `src/features/mechanical-circulatory-support/content/lessons.ts`

- `src/features/mechanical-circulatory-support/content/primarySurfaces.ts`

- `src/features/mechanical-circulatory-support/content/sectionLearningContracts.ts`

- `src/features/mechanical-circulatory-support/content/sectionSpecs.ts`

- `src/features/mechanical-circulatory-support/content/stageLessons.ts`

- `src/features/mechanical-circulatory-support/engine/learningSession.ts`

- `src/features/mechanical-circulatory-support/engine/reducer.ts`

- `src/features/mechanical-circulatory-support/test-support/mcsStage.tsx`
