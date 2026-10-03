# MCS-PRE-REVIEW-03 scope audit

Compared authorized baseline `41a34608ec556a59270b4c3b2b5bbb1c924653be` to PR head `c94994f78a23f091c11514760d8299c0a293db9d`. Every changed path is listed below. This is an MCS-local review; no shared runtime file was repaired.

| Path                                                                                                  | Classification                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `docs/gap-remediation/self-paced/MCS-PRE-REVIEW-03-handoff.md`                                        | Implementation handoff and reported evidence; independently verified where stated in the sanity report. |
| `e2e/mcs-pre-review-03.spec.ts`                                                                       | Browser regressions; rendered geometry, keyboard and state assertions.                                  |
| `src/features/mechanical-circulatory-support/__tests__/mcs-pre-review-03-display.test.tsx`            | Unit regression/contract tests; not runtime behavior.                                                   |
| `src/features/mechanical-circulatory-support/__tests__/mcs-pre-review-03-state.test.tsx`              | Unit regression/contract tests; not runtime behavior.                                                   |
| `src/features/mechanical-circulatory-support/__tests__/mcs-pre-review-03.test.tsx`                    | Unit regression/contract tests; not runtime behavior.                                                   |
| `src/features/mechanical-circulatory-support/__tests__/targeted-introductions.test.tsx`               | Unit regression/contract tests; not runtime behavior.                                                   |
| `src/features/mechanical-circulatory-support/components/McsCaseWorkflow.tsx`                          | Case navigation, explanation layout and authored-condition presentation; no predicates.                 |
| `src/features/mechanical-circulatory-support/components/McsMonitor.tsx`                               | Waveform/PV presentation, labels, units and trend composition.                                          |
| `src/features/mechanical-circulatory-support/components/McsPressureFlowTrend.tsx`                     | Display-only pressure/flow chart, physical axes, legend and table.                                      |
| `src/features/mechanical-circulatory-support/components/circulation-map/CirculationMap.tsx`           | SVG open-path fill correction, route letters/key and numbered stops.                                    |
| `src/features/mechanical-circulatory-support/components/circulation-map/circulation-map.module.css`   | MCS-scoped presentation, responsive rules, control styling and contrast.                                |
| `src/features/mechanical-circulatory-support/components/circulation-map/circulationMapGeometry.ts`    | Label positions and removal of old label anchors; pathway coordinates unchanged.                        |
| `src/features/mechanical-circulatory-support/components/mechanical-circulatory-support.module.css`    | MCS-scoped presentation, responsive rules, control styling and contrast.                                |
| `src/features/mechanical-circulatory-support/components/monitorDisplay.ts`                            | Display interpolation and trend arithmetic; independently challenged and repaired.                      |
| `src/features/mechanical-circulatory-support/components/stage/McsIntroTeaching.tsx`                   | Introductory figure and text layout.                                                                    |
| `src/features/mechanical-circulatory-support/components/stage/McsPathwayTour.tsx`                     | Distinct conceptual transvalvular versus apical/outflow routes.                                         |
| `src/features/mechanical-circulatory-support/components/stage/McsPumpCutaway.tsx`                     | Label leader endpoints and separate line-style legend.                                                  |
| `src/features/mechanical-circulatory-support/components/stage/McsSimulatorPane.tsx`                   | Task-directed monitor disclosure and presentation composition.                                          |
| `src/features/mechanical-circulatory-support/components/stage/McsStageHost.tsx`                       | Top Continue, run identity/disclosure and task/map emphasis.                                            |
| `src/features/mechanical-circulatory-support/components/stage/McsUnloadingComparison.tsx`             | Stacked comparison rows; unchanged computed values.                                                     |
| `src/features/mechanical-circulatory-support/components/stage/mcs-flow.module.css`                    | MCS-scoped presentation, responsive rules, control styling and contrast.                                |
| `src/features/mechanical-circulatory-support/components/stage/mcs-stage.module.css`                   | MCS-scoped presentation, responsive rules, control styling and contrast.                                |
| `src/features/mechanical-circulatory-support/components/stage/mcs-unloading.module.css`               | MCS-scoped presentation, responsive rules, control styling and contrast.                                |
| `src/features/mechanical-circulatory-support/components/teaching/DeviceSelectionIntegrationPanel.tsx` | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/IabpEfficacyLimitsPanel.tsx`         | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/IabpTimingTriggeringPanel.tsx`       | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/ImpellaSuctionPurgeRvPanel.tsx`      | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/ImpellaUnloadingPlacementPanel.tsx`  | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/LvadAlarmsEmergenciesPanel.tsx`      | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/LvadParametersAssessmentPanel.tsx`   | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/SignalToPerfusionPanel.tsx`          | Teaching-panel grid/reflow and local display composition; no clinical content/predicate update.         |
| `src/features/mechanical-circulatory-support/components/teaching/shared.tsx`                          | MCS-local teaching primitives; populated source/component/destination boxes.                            |
| `src/features/mechanical-circulatory-support/engine/model.ts`                                         | Unchanged ECG-expression extraction and phase exports ONLY; invariance verified.                        |

## Local repair scope

The three code commits modify only the MCS feature and its browser tests. They preserve the PR’s model extraction without further engine edits. Added regression tests inspect historical ECG point arrays, real focus/navigation behavior, full serialized simulation state, text boundaries and computed contrast. The second and third commits change CSS and browser checks only. The document-focus scrolling rule is scoped to the presence of the MCS module; shared/global stylesheets remain untouched.

No source/contract, clinical threshold, scenario key, scoring condition, shared component, global stylesheet, migration, production data, or raw authoring asset is changed.

## Review boundaries

The authorized baseline is the merge base. The four implementation commits are `cc38602cd44e78f148513fca7cddc9d810746f8f`, `b8d609070c0bd428ad7c1714165bdfd6a5ec13aa`, `69a114c2f954790426027b8cb6306685b8f5c212`, and `c94994f78a23f091c11514760d8299c0a293db9d`.

Current main `7525229328102d0c01d97528b5db22448665437b` has no path overlap with the 33 PR files. Since Claude’s integration SHA, main added the ECMO Prompt-03 review. Other changes since the authorized baseline include ventilation, bronchoscopy foundations, beta feedback/access, documentation, media and build configuration. None changes MCS physiology.
