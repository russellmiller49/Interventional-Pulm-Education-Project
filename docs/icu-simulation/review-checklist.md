# ICU Simulator release review checklist

Initial status: private development. Publication is a separate explicit change.

## Integrated physiology and simulation review

- [ ] One canonical patient owns hemodynamics, respiratory state, gas exchange, volume, renal and
      solute state, hematology, perfusion, and acid-base state.
- [ ] No adapter independently writes overlapping patient vitals.
- [ ] No-device baselines and enabled source-module behaviors match reviewed calibration fixtures.
- [ ] PEEP/hemodynamic, ECMO gas/flow, MCS transfer/unloading, CRRT fluid/solute, bleeding, and
      transfusion couplings are reviewed and bounded.
- [ ] Fixed-step, fast-forward, replay, conservation, finite-output, and 24-hour equivalence tests
      pass.
- [ ] Unsupported combinations fail closed before the learner can activate them.

## Scenario review

- [ ] Septic shock with ARDS and AKI has reviewed resuscitation, ventilation, CRRT, and optional VV
      rescue paths without making VV ECMO circulatory support.
- [ ] LV cardiogenic shock has reviewed no-device, IABP, Impella, and VA branches appropriate to the
      authored states and one bounded seeded complication.
- [ ] Massive PE/RV shock keeps reperfusion definitive and any RP/VA support an optional rescue.
- [ ] Hemorrhagic shock models ongoing loss, oxygen delivery, blood-product support, and source
      control without an ECMO-dependent core path.
- [ ] Tamponade prioritizes recognition and urgent drainage; support escalation does not relieve the
      external constraint.
- [ ] Mixed cardiogenic-vasodilatory shock requires serial mechanism reclassification after flow is
      restored.
- [ ] Every scenario has accepted alternatives, unsafe paths, critical-error rules, checkpoint
      transitions, causal debriefs, evidence IDs, and a safe masterable run.

## Device and clinical review

- [ ] Two critical-care clinicians independently review all six scenario families and scoring.
- [ ] A ventilation reviewer verifies enabled modes, settings, alarms, and waveform behavior.
- [ ] An ECMO clinician and CARDIOHELP-trained reviewer verify enabled VV/VA behavior and controls.
- [ ] An MCS reviewer verifies IABP and enabled Impella support, placement assumptions, and alarms.
- [ ] A CRRT clinician and PrisMax-trained reviewer verify prescriptions, fluid/solute effects,
      pressure/alarm behavior, and interruption paths.
- [ ] Source revisions, simulator bounds, and unsupported/proprietary algorithms remain visible.

## Safety, privacy, accessibility, and release

- [ ] Educational, non-patient-specific, non-protocol, and non-endorsement notices remain visible.
- [ ] Deployment is an abstract team/readiness workflow and contains no invasive technique.
- [ ] Medication actions contain no numeric dose or titration protocol.
- [ ] Local progress and resume data contain synthetic bounded state only and fail closed by version.
- [ ] Server analytics accept summary allowlist fields only and reject detailed state/free text.
- [ ] Keyboard, screen reader, non-color alarm, reduced-motion, 200% zoom, mobile reflow, focus, and
      WebGL fallback checks pass.
- [ ] Private-development and SME-review routes remain guarded, unlisted, noindex, and absent from
      search/navigation/sitemap.
- [ ] `npm test`, `npm run type-check`, `npm run lint`, `npm run build`, and `git diff --check` pass,
      or unrelated failures are documented.

## Approval record

| Role                       | Name | Date | Engine/content revision | Approved |
| -------------------------- | ---- | ---- | ----------------------- | -------- |
| Critical-care reviewer 1   |      |      |                         |          |
| Critical-care reviewer 2   |      |      |                         |          |
| Ventilation reviewer       |      |      |                         |          |
| ECMO clinician             |      |      |                         |          |
| CARDIOHELP device reviewer |      |      |                         |          |
| MCS reviewer               |      |      |                         |          |
| CRRT clinician             |      |      |                         |          |
| PrisMax device reviewer    |      |      |                         |          |
| Accessibility reviewer     |      |      |                         |          |
| Product owner              |      |      |                         |          |
