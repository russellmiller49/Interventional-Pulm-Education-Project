# Baxter CRRT accessibility and release checklist

Status: `pending` — exact-candidate learner and Phase 7/8 reviewer-route intake

Scope: authenticated/unlisted PrisMax three-case learner slice plus the always-guarded Phase 7/8
reviewer workspace. No automated evidence or prior viewport check is an accessibility disposition.

Approval state: no accessibility or release approval has been recorded; all approval boxes are intentionally unchecked

## 1. Review record

- [ ] Record the accessibility review-record ID/revision, exact candidate ID, candidate-manifest
      SHA-256, Git commit/tree OID, deployment/build digest, and canonical findings-ledger digest.
- [ ] Record accessibility reviewer name, role/qualifications, review date, code revision, browser/OS,
      assistive-technology versions, viewport/zoom settings, and engine/content/device-profile versions.
- [ ] Record the controlled-system reviewer subject ID, credential/assignment verification reference,
      authentication provider, attestation receipt ID/hash, signed timestamp/timezone, evidence
      custodian, and revocation/supersession state.
- [ ] Record the named accessibility conformance target and version selected by the product owner and
      accessibility reviewer; do not infer a target from automated checks.
- [ ] Record the exact route/access state tested and confirm the reviewer did not bypass a production
      entitlement or weaken the draft guard.
- [ ] Review Orientation, Learn, and Practice for each of `CRRT-04`, `CRRT-10`, and `CRRT-13` from a
      clean state; Mastery must remain unavailable.
- [ ] Review `/[locale]/baxter-crrt/review`, including every Phase 7/8 disclosure, reviewer case,
      drill, instructional tool, Mastery planner, Prismaflex console, and transfer-comparison state.
- [ ] Record each finding with severity, reproducible steps, expected behavior, owner, resolution,
      regression test, and exact revision retested.

## 2. Existing engineering evidence — not approval

The repository contains the preliminary evidence below. It narrows manual review but does not prove
assistive-technology usability or release readiness.

| Requirement                      | Existing evidence                                                                                                                          | Current conclusion                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Semantic pathway/mobile tabs     | Accessibility tests exercise roving Arrow/Home/End tabs and `aria-controls` for all five mobile surfaces                                   | Automated evidence; manual keyboard pass due           |
| Prediction/control gating        | `learningWorkflow.ui.test.tsx` exercises five required fields, lock/unlock, reset, and debrief                                             | Functional evidence; full keyboard pass due            |
| Stop/end dialog focus            | Accessibility tests cover initial focus, Tab/Shift+Tab containment, Escape close/focus return, and reload focus                            | Automated evidence; manual AT pass due                 |
| Circuit/pressure text equivalent | Circuit/accessibility tests check topology, flow, and a current-state screen-reader summary                                                | Automated semantic evidence                            |
| Trend/table access               | Tests cover a visible current-state endpoint summary and a keyboard-focusable horizontally scrollable table region                         | Automated semantic evidence                            |
| Non-color safety state           | Explicit icon/text says priority is not mapped pending device review; mobile global alarm wording is persistent                            | Automated evidence; device/manual review due           |
| Reduced motion                   | CSS/reduced-motion rules are asserted by circuit/accessibility tests                                                                       | Static evidence; OS-level pass due                     |
| Mobile workspace                 | Prior 390 × 844 QA plus authenticated 320 × 800 and 768 × 1024 learner/reviewer smoke                                                      | Current reflow smoke passed; full manual traversal due |
| Reflow hardening                 | Both routes had `clientWidth === scrollWidth`; opened case/tool/Mastery/Prismaflex/transfer disclosures remained contained                 | Live smoke passed on the unfrozen working build        |
| Target size                      | At 320 px, module-owned controls measured at least 44 CSS px; native reviewer inputs were excluded when their label is the intended target | Live smoke passed; exact-candidate target audit due    |
| Reviewed-English fallback        | Component tests verify explicit fallback on non-English routes                                                                             | Automated copy evidence                                |
| Release/access gate              | Route/layout/search/sitemap tests verify draft/unlisted/noindex behavior                                                                   | Automated policy evidence                              |
| Reviewer workspace semantics     | Component/static tests plus authenticated narrow/tablet disclosure smoke                                                                   | Contained; manual reviewer-route keyboard/AT pass due  |
| Phase 6 focused validation       | 4 suites/21 tests; all feature tests 24 suites/152 tests; type-check, scoped ESLint, and diff check passed                                 | Engineering evidence only                              |
| Rapid-drill clipping regression  | One implicit-grid defect found live, CSS-fixed, reverified with zero child overflow, and guarded by `accessibility.test.tsx`               | Passed on the current working build                    |
| Automated accessibility scan     | No complete scan result is recorded                                                                                                        | Missing                                                |
| Screen-reader walkthrough        | No VoiceOver/NVDA/JAWS walkthrough is recorded                                                                                             | Missing                                                |
| Live 320 px and tablet reflow    | Authenticated learner/reviewer smoke at 320 × 800 and 768 × 1024; no error-level browser logs                                              | Engineering smoke passed                               |
| 200% zoom/AT/motion/contrast     | No complete manual result is recorded                                                                                                      | Missing; all manual boxes remain unchecked             |

The live smoke used the current unfrozen working build, not a formal candidate. It did not complete
full tab-order traversal, 200% zoom, VoiceOver plus a second assistive technology, OS-level
reduced-motion behavior, contrast, or an exact-candidate accessibility disposition.

## 3. Keyboard and focus

- [ ] Complete every Orientation setup step, adjustment, stop/resume/end action, and clean reload
      using the keyboard only.
- [ ] Complete prediction, intervention, time advancement, hint, reassessment, and debrief in Learn
      for all three pilot cases using the keyboard only.
- [ ] Complete the same workflows in Practice, including case and role changes, without pointer use.
- [ ] Verify logical focus order follows Case → Machine → Circuit → Patient/trends → Debrief on the
      responsive workspace without forcing the user through decorative SVG elements.
- [ ] Verify all custom tab patterns implement correct arrow, Home/End where applicable, Enter/Space,
      selected state, and focus behavior.
- [ ] Verify disabled and prediction-locked controls cannot receive or trigger unintended actions
      and explain why they are unavailable.
- [ ] Verify visible focus meets contrast/visibility expectations on light, dark, selected, alarm,
      disabled, and scrolled surfaces.
- [ ] Verify opening/closing alarm, help, stop/end, and debrief surfaces places and returns focus
      predictably; Escape behavior must not discard clinical-workflow state unexpectedly.
- [ ] Verify internally scrollable device/circuit regions are focusable, labeled, and keyboard
      scrollable without creating a keyboard trap.
- [ ] On the guarded reviewer route, operate every disclosure, case selector, prediction gate,
      ordered review gate, instructional tool, Mastery planner, Prismaflex softkey/arrow control,
      and transfer-comparison surface without a pointer.
- [ ] Confirm reviewer-only controls cannot write learner progress, emit learner analytics, create a
      score, or imply activation through their accessible name, state, or feedback.

## 4. Screen reader and semantics

- [ ] Run VoiceOver with Safari on macOS for the complete pilot path and record results.
- [ ] Run at least one additional supported screen-reader/browser combination selected by the product
      owner and accessibility reviewer; record why that matrix represents the intended audience.
- [ ] Confirm one clear page heading and logical section/heading hierarchy for case, machine,
      circuit, patient/trends, debrief, sources, and review boundaries.
- [ ] Confirm every form control has a unique accessible name, current value/state, required status,
      and associated instruction/error text.
- [ ] Confirm tab/tabpanel relationships, selected state, hidden-panel behavior, and focus announcements.
- [ ] Confirm circuit topology, active flow, pressure values, missing signals, bag/scale state, and
      treatment state have concise text equivalents that update with the same engine state as the SVG.
- [ ] Confirm each patient/laboratory/pressure/dose/balance trend has an accessible current-value and
      directional summary; raw visual position or color must not be required.
- [ ] Confirm the global safety summary communicates alarm/fault existence and affected domain even
      when the relevant mobile tab is inactive.
- [ ] Confirm live announcements are priority-appropriate, not duplicated by multiple regions, and
      do not repeatedly interrupt while simulation time advances.
- [ ] Confirm simulated values, draft state, professional-education disclaimer, non-endorsement, and
      pending review status are exposed to screen-reader users.
- [ ] Confirm the reviewer route announces its reviewer-only/non-runnable boundary, unfrozen or exact
      candidate identity, disclosure state, source status, unavailable actions, and all explicit
      cross-device limitations.

## 5. Visual, color, target, and reflow review

- [ ] Verify text, controls, focus indicators, disabled states, selected states, chart elements, and
      safety messages meet the project's approved contrast standard.
- [ ] Verify alarm/fault state and priority use text/icon/shape in addition to color; no information
      is conveyed by flashing, animation, or sound alone.
- [ ] Verify all pointer targets used in the active workflow are at least 44 by 44 CSS pixels or have
      an approved equivalent spacing treatment.
- [ ] Verify the module remains usable at 200% browser zoom on supported desktop viewports without
      loss of content, action, focus, or safety state.
- [ ] Verify no page-level horizontal overflow at 320 CSS pixels for Orientation, all three Learn
      cases, all three Practice cases, prediction errors, alarm/fault state, and debrief.
- [ ] Verify wide device/circuit graphics, if internally scrollable, do not obscure their label,
      instructions, global safety state, or keyboard focus.
- [ ] Verify tablet layouts in portrait and landscape; controls must not overlap, collapse into
      inaccessible order, or hide the active state.
- [ ] Verify text-spacing overrides and long labels do not clip or obscure controls and values.
- [ ] Verify browser text-size increase does not detach labels/units from the value they describe.
- [ ] Repeat 320-pixel, 200%-zoom, text-spacing, target, contrast, and overflow review for every
      reviewer-only Phase 7/8 surface; learner-route results do not cover the reviewer workspace.

## 6. Motion, timing, and sensory alternatives

- [ ] Enable the operating system's reduced-motion setting and verify pump, tubing, fluid, trend,
      transition, and alarm animations stop or reduce without hiding state changes.
- [ ] Verify no flashing content exceeds the approved safety threshold and no essential state is
      communicated by flashing alone.
- [ ] Verify any audio is optional, has an equivalent visible/text indication, and can be muted
      without losing information.
- [ ] Verify simulation time advancement is learner-initiated, clearly labeled, reversible only
      where the model permits, and does not create an inaccessible response timeout.
- [ ] Verify no timed interaction expires a prediction, hint, reassessment, or debrief response.

## 7. Cognitive load, errors, and educational safety

- [ ] Confirm the `Read → Define → Select → Predict → Run → Reassess → Reflect` sequence is visible,
      current, and announced without relying on position or color alone.
- [ ] Confirm required prediction fields identify missing input before controls unlock and focus moves
      to or clearly announces the error summary.
- [ ] Confirm immediate device/circuit change and delayed simulated patient response are labeled and
      not visually or semantically conflated.
- [ ] Confirm prescribed/delivered dose and machine-PFR/whole-patient balance pairs have explicit,
      persistent names and explanatory text.
- [ ] Confirm acknowledgement and cause correction are separately named and the UI does not imply
      that acknowledgement resolved an active fault.
- [ ] Confirm destructive or irreversible actions have an accessible confirmation/description and
      cannot be triggered by accidental focus movement.
- [ ] Confirm clean case/pathway/role reset is apparent and does not retain hidden prediction, hint,
      score, alarm, or simulation state.
- [ ] Confirm error, hint, critical-error, and score language is respectful, specific, and does not
      imply clinical competence or patient-specific advice.

## 8. Localization review

- [ ] Verify English is the authoritative reviewed copy for the current draft.
- [ ] Record each locale identifier, message-catalog/corpus SHA-256, clinical scope, reviewer record,
      exact candidate ID, and disposition; a route existing does not mean its clinical copy is reviewed.
- [ ] Verify every non-English route exposes the reviewed-English fallback notice before clinical
      content and does not silently display unreviewed machine translation.
- [ ] Verify `lang`, reading order, punctuation, units, abbreviations, and accessible names remain
      correct on each supported route.
- [ ] Assign a clinical localization reviewer before any translation becomes authoritative.
- [ ] Verify longer translated labels at 320 px, 200% zoom, and text-spacing overrides before release.

## 9. Browser/device matrix

Record actual results; do not mark a row complete based solely on a component test.

The 2026-07-17 reflow smoke above does not complete a row in this matrix because an exact frozen
candidate, exact browser/OS versions, full keyboard traversal, and assistive-technology evidence
were not recorded together.

Every completed row must record exact OS, browser, and assistive-technology versions, candidate ID,
learner/reviewer routes exercised, evidence artifact digest, reviewer, date/timezone, and finding IDs.

| Environment                         | Exact versions | Learner route | Reviewer route | Keyboard | Screen reader | 200% zoom | 320 px/reflow | Reduced motion | Evidence/findings |
| ----------------------------------- | -------------- | ------------- | -------------- | -------- | ------------- | --------- | ------------- | -------------- | ----------------- |
| Safari + macOS + VoiceOver          | Pending        | Pending       | Pending        | Pending  | Pending       | Pending   | Pending       | Pending        |                   |
| Chrome + macOS                      | Pending        | Pending       | Pending        | Pending  | N/A/planned   | Pending   | Pending       | Pending        |                   |
| Additional approved AT/browser pair | Pending        | Pending       | Pending        | Pending  | Pending       | Pending   | Pending       | Pending        |                   |
| iOS Safari                          | Pending        | Pending       | Pending        | Pending  | Pending       | Pending   | Pending       | Pending        |                   |
| Android Chrome                      | Pending        | Pending       | Pending        | Pending  | Pending       | Pending   | Pending       | Pending        |                   |

## 10. Release and publication disposition

- [ ] All critical and serious accessibility findings are resolved and retested on the exact revision.
- [ ] Remaining lower-severity findings have an explicit product-owner risk disposition and owner/date.
- [ ] Automated tests, TypeScript, lint, full Jest, production build, and browser smoke pass after the
      final accessibility change.
- [ ] Clinical and PrisMax device reviews are complete for the exact content/profile versions.
- [ ] Separate `localization`, `privacy-data-governance`, `entitlement-security`, `product-owner`,
      and `publication-approval` domain records are complete for the exact candidate.
- [ ] Draft/noindex/unlisted restrictions remain until the publication owner separately changes them.
- [ ] Accessibility reviewer records `APPROVED-WITHIN-RECORDED-SCOPE` for the exact candidate in a
      separate authenticated domain record; a completed checklist alone is not approval.
- [ ] The product owner and publication approver complete separate candidate-bound records, record
      the release state, and confirm no certificate or copy implies independent operator or clinical
      competence.

Completion of engineering checks does not substitute for an accessibility review. Until the
accessibility disposition, all other mandatory and applicable conditional domain records, and the
separate authorization records are complete, the module remains an authenticated, unlisted draft.
