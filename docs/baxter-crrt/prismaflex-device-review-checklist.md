# Baxter CRRT Prismaflex device review intake

Status: `reviewer scaffold implemented / pending` — no Phase 8 learner activation

Device scope: `prismaflex-g5036003-6xx`, G5036003 Revision 05.2011, program 6.xx

Review state: a non-runnable reviewer-only profile, adapter candidate, and original softkey review
console are implemented. No Prismaflex learner interface or runtime action is authorized; every box
is intentionally unchecked.

## Review record and activation gate

- [ ] Record the Prismaflex-trained reviewer, review date, code revision, source-matrix revision,
      engine/content versions, and exact local device software/configuration.
- [ ] Verify the supplied G5036003 file identity and SHA-256
      `6d311624ec075c86ff539d3a86f3ed77cd2ca467346168ee4985af09f0a9224b`; record printed and PDF page
      numbers for every finding.
- [ ] Confirm the reviewed PrisMax v1 pilot/curriculum is stable and the product owner has explicitly
      authorized Phase 8 before any Prismaflex learner control is implemented.
- [ ] Identify the intended market, installed program version, enabled therapies, disposable sets,
      accessories, solutions, anticoagulation options, and local workflow; do not infer them from a
      multi-market 2011 manual.
- [ ] Confirm a Prismaflex-trained reviewer is independent of the implementer and can inspect the
      exact source-mapped build.
- [ ] Confirm the route stays draft/unlisted and no Prismaflex fidelity or training claim appears
      before this checklist and all other applicable approvals are complete.

## Device separation

- [ ] Confirm Prismaflex has a separate immutable device profile and adapter ID and does not inherit
      PrisMax screens, alarm categories, pressure operating points, display corrections, flow limits,
      setup sequence, or end-treatment behavior.
- [ ] Confirm only canonical patient, access, circuit, prescription, and delivered-therapy state is
      shared; device navigation and presentation remain adapter-specific.
- [ ] Confirm switching device profiles reconstructs a clean interface and cannot retain PrisMax
      setup completion, hints, alarm state, limits, or display values.
- [ ] Confirm unsupported PrisMax features, the Nordic PrisMax marketing sheet, and Auto Effluent do
      not activate Prismaflex behavior.
- [ ] Confirm all Prismaflex feature/profile values remain `pending` until the exact target
      configuration and source are reviewed.

## Navigation, setup, and interface

- [ ] Review the softkey and arrow-based navigation model against G5036003 sections 4:2-4:16 (PDF
      pp62-76) without reproducing protected screen artwork or trade dress.
- [ ] Verify every learner-facing screen label, prompt, help summary, control, and disabled state
      against the matching program-version source.
- [ ] Verify the full enabled setup order, required entries, prime/review/connect gates, and invalid
      transitions for every released therapy/set combination.
- [ ] Verify the status/operations, history, alarm/help, stop/end, return-blood/discard, and clean
      reload workflows separately from PrisMax.
- [ ] Verify original CSS/SVG artwork and accessible text equivalents accurately represent only the
      pumps, scales, clamps, detectors, and connection points needed by the curriculum.
- [ ] Document administrator, service, network, remote-control, and unsupported configuration
      surfaces that remain excluded.

## Pumps, scales, sets, and fluids

- [ ] Verify the documented four occlusive fluid pumps and four-scale representation against
      G5036003 sections 3:8-3:11 (PDF pp52-55) for the exact target configuration.
- [ ] Verify therapy/set-dependent pump use, source/effluent bag placement, line routing, scale
      mapping, bag-change behavior, scale-open behavior, and depletion/full conditions.
- [ ] Verify enabled set and accessory identifiers and compatibility from an authoritative source;
      do not use a generic flow range or marketing claim.
- [ ] Verify each enabled solution profile, connection, line/scale association, volume, and workflow;
      local availability must be documented separately.
- [ ] Confirm citrate/calcium and actionable anticoagulation controls remain absent unless a
      versioned local protocol and separate clinical/device approvals exist.

## Flow, pressure, and displayed calculations

- [ ] Review every enabled flow range, increment, unit, rounding behavior, and validation against
      the exact therapy, set, program version, and configuration.
- [ ] Review Prismaflex CRRT flow, patient-fluid-removal, dose, predilution, and filtration-fraction
      definitions against G5036003 sections 5:3-5:19 (PDF pp97-113).
- [ ] Verify pressure operating-point establishment and reset behavior around flow changes, pump
      restarts, alarm continuation, and self-test against G5036003 sections 3:5-3:7 (PDF pp49-51).
- [ ] Verify access, filter, return, and effluent pressure signs, units, display values, and derived
      behavior with independent hand calculations and tests.
- [ ] Verify Prismaflex filter pressure drop, including its documented display correction, against
      G5036003 section 3:7 (PDF p51); do not reuse the PrisMax correction.
- [ ] Confirm pressure limits/operating points are device-profile behavior and never presented as
      universal clinical normal ranges.
- [ ] Supply exact Prismaflex device facts needed by the separate `cross-device-equivalence` review;
      do not approve shared-engine equivalence or numeric tolerances in this device-domain record.

## Alarm, safety, and cause correction

- [ ] Review the Prismaflex alarm categories Warning, Malfunction, Caution, and Advisory against
      G5036003 sections 10:2-10:7 (PDF pp166-171); do not map PrisMax priority names by analogy.
- [ ] For every implemented alarm, map the device label/category, detection input, stopped pumps,
      clamp response, screen/help behavior, acknowledgement, override, clearing condition, and
      escalation boundary to an exact source record.
- [ ] Verify acknowledgement never clears the underlying engine fault and correction recomputes the
      device response before resume.
- [ ] Verify air, blood leak, access, return, filter/TMP, effluent, bag/scale, gain/loss, leak, power,
      and repeated-alarm behaviors only if individually source-mapped and curriculum-required.
- [ ] Adjudicate every Prismaflex-specific unsafe action and critical-error candidate jointly with
      the clinical reviewers; confirm accepted alternatives cannot be penalized.
- [ ] Verify a persistent text/icon safety summary remains available when a mobile tab hides the
      affected device or circuit panel.

## Stop/end and blood disposition

- [ ] Verify stop, temporary pause, resume, end treatment, recirculation if available, disconnect,
      and clean-reload semantics for the exact target profile.
- [ ] Review return-blood versus discard wording and available device workflow without encoding a
      universal clinical decision or unsupported local policy.
- [ ] Confirm an irreversible end cannot be represented as a reversible pause and that a new case
      cannot inherit ended-treatment state.
- [ ] Confirm recurrent high-risk conditions prompt the reviewed escalation/end pathway and cannot
      be dismissed solely through acknowledgement.

## Accessibility and localization

- [ ] Complete keyboard-only operation of all Prismaflex setup, adjustment, alarm, help, and stop/end
      controls with logical focus order and visible focus.
- [ ] Verify screen-reader names, state, errors, circuit/pressure summaries, and priority-appropriate
      live announcements without duplicate or excessive speech.
- [ ] Verify text/icon/shape conveys alarm category and state without color or sound alone.
- [ ] Verify minimum 44-pixel targets, reduced-motion behavior, 200% zoom, 320-pixel page containment,
      tablet layout, and keyboard-scrollable internal graphics.
- [ ] Review the English source vocabulary and every translated string; retain explicit
      reviewed-English fallback until clinical/device translation approval.

## Inputs for separate cross-device-equivalence validation

These checks belong to an independently attested `cross-device-equivalence` record. A Prismaflex
device reviewer may supply device evidence but cannot establish equivalence by completing this
checklist.

- [ ] Run identical canonical prescriptions and action schedules through PrisMax and Prismaflex
      adapters and compare patient, circuit, delivered-dose, balance, and solute outcomes within the
      approved tolerance.
- [ ] Prove adapter differences affect navigation/display/device response only and do not fork the
      shared clinical truth.
- [ ] Test clean switching, replay determinism, time equivalence, alarm cause correction, and all
      Prismaflex case safe/alternative/unsafe/critical paths.
- [ ] Complete a cross-device transfer usability review that checks whether learners recognize both
      shared principles and machine-specific differences.
- [ ] Record all intentional differences and prohibit generic “Baxter machine” language that hides
      device-generation differences.

## Disposition

- [ ] Attach every finding with source ID, page/section, implementation/test reference, severity,
      owner, required change, and resolution evidence.
- [ ] Reset affected records to `pending` after any consequential source, profile, adapter, case, or
      model change and recheck the exact revision.
- [ ] Record any completed device disposition in a
      [canonical `prismaflex-device` domain record](./review-packet/domain-review.template.md),
      including exact candidate/profile/configuration binding, scope/findings digests, normalized
      disposition, authenticated receipt, timestamp, and receipt SHA-256. One reviewer cannot
      approve clinical content, cross-device equivalence, activation, or publication.
- [ ] Obtain every mandatory candidate/manifest/ledger/domain-scope-bound record plus the separate
      `cross-device-equivalence` record and Phase 8/publication authorizations before learner release.

Creating or completing this intake does not itself authorize Phase 8, public release, competency
credit, or a claim that the simulator reproduces a locally installed Prismaflex system.
