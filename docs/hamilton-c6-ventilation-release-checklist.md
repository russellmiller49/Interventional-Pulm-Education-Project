# HAMILTON-C6 ventilation simulator release checklist

Module: `/hamilton-c6-ventilation`  
Locked device profile: HAMILTON-C6 Operator’s Manual, software 1.2.x, document 10197564/00  
Current status: authenticated draft

The publication status in `src/features/hamilton-c6-ventilation/content/deviceProfile.ts` must remain `draft` until every required sign-off below is recorded.

## Independent clinical review

- [ ] Clinician reviewer 1 independently verifies all 15 case mechanisms, safety priorities, accepted intervention paths, harmful paths, thresholds, and debriefs.
- [ ] Clinician reviewer 2 independently verifies the same items without relying on reviewer 1’s findings.
- [ ] Both reviewers verify the five engine-validation cases first: MV-01, MV-04, MV-06, MV-11, and MV-15.
- [ ] Both reviewers then verify MV-02, MV-03, MV-05, MV-07–10, and MV-12–14 before v1 approval.
- [ ] Every case has at least one safe, clinically coherent path to its endpoint across the permitted seeded branches.
- [ ] Every critical-error rule is clinically consequential and does not punish an accepted alternative.

## C6-trained device review

- [ ] A C6-trained reviewer verifies `(S)CMV`, `PCV+`, and `SPONT` vocabulary and control behavior against manual 10197564/00.
- [ ] The reviewer verifies trigger selection, ETS, P-ramp, TI/TI-max, peak flow and flow pattern, apnea backup, TRC, alarm acknowledgement, holds, freeze, O₂ enrichment, manual breath, screen lock, and mode confirmation.
- [ ] The reviewer confirms that SPONT P-ramp never exceeds 200 ms and that MV-11 uses 200 ms slow baseline, 70–120 ms target, and less than 30 ms overshoot ranges.
- [ ] The reviewer confirms that ASV, INTELLiVENT-ASV, IntelliSync+, PAV, and NAVA are not presented as simulated v1 modes.
- [ ] The original CSS/SVG facsimile does not use copied screenshots, logos, manufacturer artwork, or imply manufacturer endorsement.

## Waveform and model review

- [ ] Paw, flow, volume, and educator-only Pmus polarity and units are correct.
- [ ] Flow starvation, double triggering, reverse triggering, ineffective effort, autotriggering, early and late cycling, P-ramp mismatch, resistive pressure separation, dynamic hyperinflation, and pneumothorax compliance loss are recognizable without answer labels in Practice.
- [ ] Immediate waveform effects precede slower gas-exchange, medication, and disease responses.
- [ ] 1x, 5x, and 30x advancement remain equivalent within declared tolerances.
- [ ] The waveform buffer remains fixed at 600 samples and trends remain bounded.
- [ ] The development calibration panel is absent from production output.

## Workflow, privacy, and safety

- [ ] Learn and Practice always reload isolated clean states.
- [ ] Practice requires prediction commitment before ventilator or bedside therapy changes.
- [ ] Mastery requires at least 80% and no critical error.
- [ ] Hints unlock after 60 simulated seconds, deduct five points, and remain hidden in timed challenge.
- [ ] Local storage contains only version, attempts, completed case IDs, best scores, critical-error status, and last station.
- [ ] Analytics contain only case ID, station, pathway, completion, score, and error count.
- [ ] No free text, live physiology, waveform samples, or PHI is persisted or transmitted.
- [ ] High-risk actions remain recognition-and-priority exercises and defer technique to local protocols.
- [ ] The educational-use and non-endorsement statements are visible.

## Accessibility and localization

- [ ] All C6 controls, mode selection, alarms, holds, workflow choices, and intervention cards are keyboard operable.
- [ ] Alarm priority is communicated in text and does not rely on color.
- [ ] Every waveform has an accessible summary and current-value text equivalent.
- [ ] Layout reflows without horizontal page overflow at desktop, tablet, and 320 px mobile widths.
- [ ] Reduced-motion preference is respected.
- [ ] Zoom and text scaling remain usable at 200%.
- [ ] Spanish and Simplified Chinese routes retain reviewed-English simulator copy until independent clinical translation review is signed.

## Approval record

| Role                       | Name | Date | Revision reviewed | Approved |
| -------------------------- | ---- | ---- | ----------------- | -------- |
| Clinician reviewer 1       |      |      |                   |          |
| Clinician reviewer 2       |      |      |                   |          |
| C6-trained device reviewer |      |      |                   |          |
| Accessibility reviewer     |      |      |                   |          |
| Localization reviewer      |      |      |                   |          |
| Product owner              |      |      |                   |          |
