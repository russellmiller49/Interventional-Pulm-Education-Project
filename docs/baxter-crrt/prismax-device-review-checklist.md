# Baxter CRRT PrisMax device review intake

Status: `pending` — draft intake artifact generated for the Phase 4-5 vertical slice  
Device scope: `prismax-aw8035-2xx`, PrisMax Operator's Manual AW8035 Rev B JUN2019, program 2.XX  
Review state: formal Phase 6 device review has not started; every box is intentionally unchecked

## Review record and device identity

- [ ] Record the PrisMax-trained reviewer, review date, code revision, profile/content/engine versions,
      source-matrix revision, and available local device software/set/configuration details.
- [ ] Verify the supplied AW8035 Rev B file identity and SHA-256
      `204543b8c205e535cb9d45c970b8231362839177f3795b6164edcef3b834f1ff`; record printed manual and
      PDF page numbers for each finding.
- [ ] Confirm AW8035 does not establish the locally installed market, software, options, sets,
      accessories, solutions, or practice; keep every unmatched feature disabled and pending.
- [ ] Confirm Prismaflex behavior is not merged into this adapter and the Nordic marketing sheet does
      not activate hemoperfusion, citrate/calcium, Auto Effluent, ranges, or accessories.
- [ ] Confirm the route remains authenticated, unlisted, draft, unpublished, and clearly labeled as
      an original educational facsimile rather than manufacturer-endorsed device training.

## Navigation, setup, and wording

- [ ] Review the distinction between Procedure and Operations surfaces against `DEV-PM-002` and
      AW8035 manual pp9-11 (PDF pp10-12).
- [ ] Review every learner-facing label, paraphrase, control, disabled state, help/source note, and
      event/history term; identify wording that implies unsupported fidelity or clinical direction.
- [ ] Verify the implemented setup order against `DEV-PM-005` and AW8035 manual pp39-64: patient,
      therapy, prescription, set, fluids, prime, review, connect, and start concepts.
- [ ] Verify state-machine gates prevent connect/start before the implemented prime and review steps;
      confirm blocked actions do not silently advance device or engine state.
- [ ] Review Operations display content against `DEV-PM-003`, operating controls/history against
      `DEV-PM-006` and `DEV-PM-016`, and document every intentionally excluded stop/end, bag/syringe,
      lock, administrator, or service behavior.
- [ ] Verify original artwork and text equivalents accurately teach the relevant pumps, clamps,
      sensors, detectors, lines, bags, and scales without copying protected manual figures.

## Flow, pressure, and fluid calculations

- [ ] Verify therapy/set-specific modes, available flows, ranges, increments, units, rounding, and
      validation against `DEV-PM-011` and `DEV-PM-015`; do not infer a universal Baxter value.
- [ ] Verify the profile-enabled effluent target terms and units against `MATH-PM-001` and AW8035
      manual p217 (PDF p218); confirm absent pumps contribute zero and disabled options cannot leak in.
- [ ] Verify TMP against `MATH-PM-002`, filter pressure drop against `DEV-PM-010`, and all display
      corrections/sign conventions with unit tests and hand calculations.
- [ ] Verify patient-fluid-removal and catch-up/gain-loss concepts against `DEV-PM-012`,
      `FLUID-PM-001`, and `FLUID-PM-002`; device wording must not imply whole-patient balance.
- [ ] Verify weight-normalized effluent/UFR dose display against `DOSE-PM-001`; no displayed value may
      imply a clinically approved target or substitute prescribed dose for delivered dose.
- [ ] Confirm disputed `MATH-PM-004`/`CONFLICT-001` and `MATH-PM-006`/`CONFLICT-002` expressions remain
      inactive until matching-revision authoritative clarification is reviewed.

## Alarm and pressure mapping

- [ ] Review the priority model, alarm-window anatomy, event wording, and acknowledge/continue actions
      against `DEV-PM-007` and AW8035 manual pp93-100.
- [ ] Map each implemented pilot alarm family and troubleshooting instruction to the exact AW8035
      table/page under `DEV-PM-008`; keep unverified priority, threshold, pump, and clamp consequences
      generic, disabled, or visibly pending.
- [ ] Confirm alarm acknowledgement never clears the underlying fault or earns correction credit
      (`SAFETY-001`, `SAFETY-008`).
- [ ] Verify access/filter/return pressure trends depend on flow, resistance, and operating point
      (`DEV-PM-009`, manual pp197-204), not a universal normal or hard-coded UI animation.
- [ ] Adjudicate the device-side mapping and feedback for increasing BFR with unresolved access
      limitation (`SAFETY-009`) and continuing repeated high-risk alarms without escalation
      (`SAFETY-010`); record what the real device does and what remains a clinical rule.

## Pilot-case device walk-throughs

- [ ] `CRRT-04`: run both accepted paths and each blocked/critical path; verify BFR-first prescription
      entry, dialysate/PFR entry, prime/review/start sequence, operations values, interruption/resumption,
      downtime, history, and prescribed-versus-delivered display behavior; specifically adjudicate
      `crrt04-critical-start-before-review` and the device aspects of
      `crrt04-critical-ignore-downtime`.
- [ ] `CRRT-10`: verify machine PFR and cumulative machine removal use device-accurate terminology and
      remain visually and mathematically distinct from the whole-patient fluid ledger; review the
      device aspects of `crrt10-critical-unreassessed-pfr-increase` and
      `crrt10-critical-ignore-whole-balance` without converting clinical rules into device behavior.
- [ ] `CRRT-13`: verify the synthetic access-resistance/position fault produces model-derived pressure
      and alarm behavior; inspect, reposition/correct, acknowledge, escalate, and BFR-change paths must
      preserve cause-first behavior and confirmed delivery reassessment; specifically adjudicate
      `crrt13-critical-increase-bfr`, `crrt13-critical-acknowledgement-only`, and the device aspects of
      `crrt13-critical-anticoagulation-first` if it remains in the final registry.
- [ ] For all three cases, compare the development calibration panel with device state, engine state,
      source IDs, event IDs, pressures, flows, dose/downtime, fluid totals, matched path, and candidate
      critical errors; record every mismatch.
- [ ] Verify case/pathway/role changes load a clean device state with no retained setup step, delivery
      state, flow, pressure, fault, alarm, acknowledgement, or history.

## Exclusions and pending disposition

- [ ] Confirm citrate/calcium controls and calculations are absent, Prismaflex is unavailable, and no
      optional/local configuration is implied by inactive controls or artwork.
- [ ] Record excluded or simplified pumps/clamps, scale behavior, bag changes, stop/end behavior,
      recirculation, blood return, set/solution compatibility, and alarm consequences for later review.
- [ ] Attach findings with source ID, exact manual page, code/test reference, severity, owner, and
      required change; consequential changes must reset the affected record to `pending`.
- [ ] Recommend `reviewed` only after all applicable findings are resolved and the exact revision is
      rechecked; `approved` publication requires separate clinical, accessibility, localization,
      product, and release decisions.
