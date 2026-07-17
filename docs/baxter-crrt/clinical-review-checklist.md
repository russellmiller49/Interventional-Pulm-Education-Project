# Baxter CRRT clinical review intake

Status: `pending` — draft intake artifact generated for the Phase 4-5 vertical slice  
Scope: `CRRT-04`, `CRRT-10`, and `CRRT-13` on the authenticated, unlisted draft route  
Review state: formal Phase 6 clinical review has not started; every box is intentionally unchecked

## Review record and boundaries

- [ ] Record reviewer names, roles, review date, code revision, content version, engine version, and
      source-matrix revision.
- [ ] Assign a CRRT-experienced nephrologist, a critical-care physician, and a CRRT nurse educator.
      Each must complete a separate candidate-bound canonical domain record for `nephrology`,
      `critical-care`, or `crrt-nurse-education`; this combined intake cannot substitute for those
      three independent attestations.
- [ ] Confirm every exact patient value, flow, time, condition band, coefficient, and score trigger is
      labeled synthetic, deterministic, `reviewStatus: pending`, and not a clinical target or device
      limit.
- [ ] Confirm the module remains professional education only, gives no patient-specific advice or
      competency credit, and keeps Mastery unavailable.
- [ ] Confirm regional citrate-calcium dosing is absent; do not activate it without a versioned local
      protocol, solution/calcium details, monitoring rules, and separate approval.
- [ ] Confirm the route remains authenticated, unlisted, draft, absent from primary navigation, and
      unpublished regardless of this intake outcome.

## Source and calibration review

- [ ] Trace every consequential case statement, success condition, accepted path, unsafe action,
      critical-error candidate, hint, and debrief claim to a stable `SourceRecord` and exact
      implementation/test location.
- [ ] Review `RENAL-2009` only as context for weight-normalized intensity and
      prescribed-versus-delivered teaching; verify it is not used to validate a case target.
- [ ] Review `WHITE-2024` and `GONEUTRAL-2024` only as context for whole-patient fluid accounting and
      tolerance-guided reassessment; verify no study value is copied into the case as a recommendation.
- [ ] Review `SYNTH-CRRT-04`, `SYNTH-CRRT-10`, and `SYNTH-CRRT-13` against the development calibration
      panel, engine fixtures, source IDs, units, deterministic seed, and boundary tests.
- [ ] Confirm immediate machine/circuit effects and delayed simulated patient/laboratory responses
      are distinct, causal, reproducible, and clinically plausible for education.
- [ ] Confirm prescribed dose differs from delivered dose after downtime, machine PFR differs from
      whole-patient balance, and pressure changes arise from the pressure model rather than UI labels.

## Case review: `CRRT-04`

- [ ] Trace the implemented source set: `DEV-PM-005`, `MATH-PM-001`, `DOSE-PM-001`, `DEV-PM-009`,
      `DEV-PM-013`, `RENAL-2009`, and `SYNTH-CRRT-04`; resolve any missing or excess case source.
- [ ] Verify the case goal, CVVHD mechanism, BFR-first teaching sequence, dialysate/PFR controls,
      delayed laboratory direction, interruption, and delivered-dose reassessment are coherent.
- [ ] Review all exact starting values, flow options, the synthetic prescribed-dose completion band,
      the six-hour time advance, solute response, and downtime calibration in `SYNTH-CRRT-04`.
- [ ] Verify `crrt04-primary-path` and `crrt04-alternative-path` reach acceptable physiologic and
      safety endpoints without rewarding one exact prescription.
- [ ] Adjudicate `crrt04-critical-start-before-review` and `crrt04-critical-ignore-downtime`, including
      their action/condition triggers, evidence, severity, learner feedback, and test coverage.
- [ ] Verify the debrief accurately links goal, prescription, actual pump delivery, downtime, delayed
      response, reassessment, and the transfer question for supervised practice.

## Case review: `CRRT-10`

- [ ] Trace the implemented source set: `FLUID-PM-001`, `DEV-PM-009`, `DEV-PM-013`, `WHITE-2024`,
      `GONEUTRAL-2024`, and `SYNTH-CRRT-10`; resolve any missing or excess case source.
- [ ] Verify the learner must reconcile machine PFR with maintenance fluid, medication carriers,
      nutrition, boluses, blood products, urine, drains, other outputs, and downtime.
- [ ] Review every exact input/output rate, PFR choice, balance interval, hemodynamic stress response,
      tolerance band, success condition, and engine coefficient in `SYNTH-CRRT-10`.
- [ ] Verify `crrt10-tolerance-guided-removal-path` and `crrt10-input-coordination-alternative` respond
      to simulated tolerance and the stated team goal rather than chasing a single number.
- [ ] Adjudicate `crrt10-critical-unreassessed-pfr-increase` and
      `crrt10-critical-ignore-whole-balance`, including their mapped unsafe actions, exact triggers,
      evidence, severity, learner feedback, and safe/alternative/critical-path tests.
- [ ] Verify the debrief separates machine removal, external inputs/outputs, cumulative patient
      balance, tolerance, reassessment, and team communication.

## Case review: `CRRT-13`

- [ ] Trace the implemented source set: `DEV-PM-009`, `DEV-PM-013`, and `SYNTH-CRRT-13`; resolve any
      missing or excess case source and require added evidence for each clinical safety rule.
- [ ] Verify access pressure is interpreted as a trend at the current operating point, not as a
      universal normal or a patient-care threshold.
- [ ] Review the exact resistance, position, flow, pressure, alarm, fault, timing, and recovery
      calibration in `SYNTH-CRRT-13`; confirm each displayed change is model-derived.
- [ ] Verify `crrt13-cause-first-path` and `crrt13-pause-correct-resume-alternative` distinguish
      positioning, kink/clamp, reduced intravascular reserve, and catheter dysfunction, then confirm
      restored flow and delivery.
- [ ] Adjudicate `crrt13-critical-increase-bfr` and `crrt13-critical-acknowledgement-only`, plus
      `crrt13-critical-anticoagulation-first` if present in the final registry; verify each mapped
      unsafe action, trigger, evidence, severity, learner feedback, and path test.
- [ ] Verify the debrief preserves cause-first troubleshooting, reassessment, escalation boundaries,
      and transfer to supervised clinical practice.

## Scoring, hints, and outcome review

- [ ] Verify Practice uses the fixed 100-point rubric: goal 15, modality/prescription 20,
      machine/circuit 20, safety/troubleshooting 20, monitoring/reassessment 15, and
      communication/coordination 10.
- [ ] Verify scoring rewards physiologic and safety endpoints, required reassessment, and explicit
      accepted alternatives; it must not require exact matching of a preferred machine setting.
- [ ] Verify Learn is guided and unscored; Practice requires the five-field prediction commitment
      before intervention, device action, or time advancement.
- [ ] Verify hint deductions are bounded and disclosed, critical-error candidates are reported
      separately from score, and no result claims competency or unlocks Mastery.
- [ ] Verify clean reloads across case, pathway, and role remove predictions, actions, hints, scores,
      trends, critical-error state, and device/simulation state.

## Pending disposition

- [ ] Attach findings with source ID, code/test reference, severity, owner, and required change;
      consequential changes must reset the affected record to `pending`.
- [ ] Transfer each completed review into a separate
      [canonical domain record](./review-packet/domain-review.template.md), including the exact
      candidate, scope/findings digests, normalized disposition, authenticated receipt, timestamp,
      and receipt SHA-256. This intake itself never changes activation or publication state.
