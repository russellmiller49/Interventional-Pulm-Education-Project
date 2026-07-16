# Multi-device mechanical ventilation simulator release checklist

Canonical module: `/mechanical-ventilation`  
Legacy redirect: `/hamilton-c6-ventilation`  
Current status: unlisted public tester preview

The tester preview is intentionally absent from site navigation and search, is marked `noindex`, and
is reachable without authentication only by direct URL. The publication status in
`src/features/mechanical-ventilation/content/deviceProfiles.ts` must not be changed from
`tester-preview` to `published` until every required sign-off below is recorded. The supplied PB980
service manual and AVEA modes guide are not complete operator manuals; neither profile may be marked
review-approved until the applicable operator manual and an independent device-trained reviewer are
added to the review set.

## Independent clinical review

- [ ] Two clinicians independently verify all 15 case mechanisms, safety priorities, accepted paths,
      harmful paths, thresholds, and debriefs.
- [ ] Both reviewers verify MV-01, MV-04, MV-06, MV-11, and MV-15 before the remaining ten cases.
- [ ] Every case has at least one safe, coherent resolution path on all four selectable devices.
- [ ] Shared mastery remains based on 15 clinical cases rather than 60 device-case combinations.
- [ ] Every critical-error rule is clinically consequential and does not punish an accepted alternative.

## Independent device review

- [ ] A C6-trained reviewer verifies `(S)CMV`, `PCV+`, `SPONT`, `SIMV`, `PSIMV+`, `APVcmv`,
      `APVsimv/SIMV+`, `DuoPAP`, `APRV`, `ASV`, `INTELLiVENT-ASV`, `IntelliSync+`, controls,
      alarms, maneuvers, and immediate press-and-turn behavior against manuals 10197564/00 and
      624954/05.
- [ ] An Evita V800/V600-trained reviewer verifies `VC-AC`, `PC-AC`, `SPN-CPAP/PS`, `VC-SIMV`,
      `PC-SIMV`, `PC-APRV`, `SPN-CPAP/VS`, `AutoFlow`, absolute `Pinsp`, `Slope` in seconds, the
      white-screen layout, and touch-turn-confirm behavior against software 3.1n.
- [ ] A PB980-trained reviewer verifies `A/C + VC`, `A/C + PC`, `SPONT + PS`, `SIMV + VC`,
      `SIMV + PC`, `A/C + VC+`, `SIMV + VC+`, `BiLevel`, `SPONT + PAV+`, `SPONT + VS`,
      `Rise Time %`, `ESENS`, constant-access controls, and knob confirmation against the applicable
      operator manual.
- [ ] An AVEA-trained reviewer verifies `Volume A/C`, `Pressure A/C`, `CPAP/PSV`, `Volume SIMV`,
      `Pressure SIMV`, `PRVC A/C`, `PRVC SIMV`, `APRV/BiPhasic`, rise 1–9, `PSV Cycle`, advanced
      settings, and Touch-Turn-Touch/Accept against the applicable operator manual.
- [ ] PB980 and AVEA operator manuals are cited, revision-locked, hashed, and reviewed; the supplied
      service manual, brochure, and modes guide remain clearly labeled as incomplete source sets.
- [ ] TCPL and Volume Guarantee remain visibly source-listed but locked for the adult casebook; they
      cannot be activated until a separately sourced, modeled, and independently reviewed neonatal
      test-lung pathway exists.
- [ ] AutoFlow and IntelliSync+ are presented as adjunct features rather than standalone modes.
- [ ] Reviewers explicitly acknowledge that adaptive pressure, proportional support, ASV,
      INTELLiVENT-ASV, AutoFlow, and IntelliSync+ use bounded original educational response adapters
      rather than proprietary manufacturer algorithms or validated closed-loop control logic.
- [ ] Every console is an original brand-free CSS/SVG training facsimile with no copied screenshots,
      logos, manufacturer artwork, or endorsement implication.

## Adapter, waveform, and model review

- [ ] Canonical settings yield the same patient physiology regardless of selected display vocabulary.
- [ ] Device adapters clamp to the intersection of documented limits and the case-safe simulation envelope.
- [ ] Undocumented AVEA limits remain visibly labeled as simulator ranges.
- [ ] Unconfirmed Evita, PB980, and AVEA settings do not change patient physiology; confirmation and
      cancellation work with pointer and keyboard input.
- [ ] Paw, flow, volume, and educator-only Pmus polarity and units are correct.
- [ ] All 15 baseline phenotypes remain recognizable on all four devices.
- [ ] Every adult-selectable mode initializes all 15 cases with finite, bounded pressure, tidal volume,
      rate, waveforms, gas exchange, and hemodynamics.
- [ ] Immediate waveform effects precede slower gas-exchange, medication, and disease responses.
- [ ] 1x, 5x, and 30x advancement remain equivalent, waveform samples remain bounded at 600, and the
      development calibration panel is absent from production output.

## Routing, progress, analytics, privacy, and safety

- [ ] The canonical route, unlisted policy, authentication resolver, and analytics module ID all use
      `mechanical-ventilation`; site search and navigation do not expose the tester preview.
- [ ] Every locale-aware legacy URL permanently redirects to the corresponding canonical URL.
- [ ] V1 local progress migrates non-destructively to `mechanical-ventilation-progress-v2`, defaults to
      HAMILTON-C6, preserves shared completion/mastery, and retains the legacy storage record.
- [ ] Device changes require confirmation and reset time, waveforms, interventions, predictions, alarms,
      reassessment, critical errors, and pending settings without changing shared mastery.
- [ ] Per-device/per-case attempt counts remain separate from the 15-case completion percentage.
- [ ] Interaction and completion analytics include `deviceId`; device switches emit `device_changed`.
- [ ] Local storage and analytics contain no waveform samples, live physiology, free text, or PHI.
- [ ] Learn and Practice reload isolated clean states; Practice requires prediction commitment.
- [ ] Mastery requires at least 80% and no critical error; hints unlock after 60 simulated seconds and
      remain unavailable in timed challenge mode.
- [ ] High-risk actions remain recognition-and-priority exercises that defer technique to local protocols.
- [ ] Educational-use, source-boundary, non-endorsement, and operator-manual limitations remain visible.

## Accessibility, responsive QA, and localization

- [ ] Device selection, reset confirmation, native mode selection, controls, alarms, holds, workflow
      choices, source details, and Practice gating are keyboard operable.
- [ ] Alarm priority is communicated in text and every waveform has a current-value text equivalent.
- [ ] Each console is visually inspected at desktop, tablet, 320 px mobile, 200% zoom, and reduced motion.
- [ ] Layout reflows without horizontal page overflow or obscuring the live case workspace.
- [ ] Spanish and Simplified Chinese routes retain reviewed-English simulator copy until independent
      clinical translation review is signed.

## Verification

- [ ] Targeted Jest tests pass for profiles, adapters, clamping, pending confirmation, all 60 baseline
      device-case paths, every adult-selectable mode across all 15 cases, reset behavior, migration,
      analytics, redirect, preview visibility, auth bypass, and hidden search/navigation behavior.
- [ ] Full `npm test`, `npm run type-check`, `npm run lint`, `npm run build`, and `git diff --check` pass.

## Approval record

| Role                   | Name | Date | Revision reviewed | Approved |
| ---------------------- | ---- | ---- | ----------------- | -------- |
| Clinician reviewer 1   |      |      |                   |          |
| Clinician reviewer 2   |      |      |                   |          |
| C6 device reviewer     |      |      |                   |          |
| Evita device reviewer  |      |      |                   |          |
| PB980 device reviewer  |      |      |                   |          |
| AVEA device reviewer   |      |      |                   |          |
| Accessibility reviewer |      |      |                   |          |
| Localization reviewer  |      |      |                   |          |
| Product owner          |      |      |                   |          |
