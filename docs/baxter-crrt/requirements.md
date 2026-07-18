# Baxter CRRT v1 requirements

## Product outcome

Provide a deterministic adult-ICU professional education module that connects device operation,
circuit behavior, delivered therapy, simulated patient response, clinical reasoning, and team
communication. React presents state; authored content and the pure engine own clinical and scoring
logic.

The module is not an operating guide, treatment calculator, institutional policy, competency
credential, or device-equivalence claim. All patient values, event magnitudes, timings, engine
coefficients, scoring thresholds, and case endpoints are synthetic educational calibration.

## Release and access

- `BaxterCrrtReleaseStage` is `private-development | sme-review | published`.
- `private-development` and `sme-review` are admin-only, unlisted, noindex, absent from navigation,
  site search, and sitemap.
- `published` is public, listed, searchable, sitemap-included, and indexable.
- Review status, reviewer identity, source notes, and limitations are provenance only and never
  decide runtime availability.
- The current stage is `sme-review`; this implementation does not publish.
- `/review` runs the complete module in `review-preview` mode with telemetry and persistence
  suppressed.

## Required learning inventory

- Exactly `CRRT-01` through `CRRT-18` in one learner registry.
- Exactly seven cause-first rapid drills.
- Exactly six learner instructional tools.
- One masked PrisMax Mastery capstone: score at least 80, no critical error, no hint use, and
  completed reassessment.
- Two operational device adapters: PrisMax and Prismaflex.
- One cross-device workflow-translation capstone with no clinical-interchangeability claim.

Every case includes a prediction commitment, required safe path, accepted alternative, unsafe
path, educational critical-error rule, deterministic timed response, reassessment, causal debrief,
transfer question, and claim-level sources. Every drill exposes safe, accepted-alternative, unsafe,
critical-error, cause-first verification, correction boundary, and reassessment behavior.

## Devices and profiles

- Canonical patient, access, circuit, fluid, solute, filter, and outcome state is device-neutral.
- Device adapters own screen order, vocabulary, displayed calculations, alarms, controls,
  interruption, and stop/end presentation.
- PrisMax supports SCUF, CVVH, CVVHD, and CVVHDF; setup-to-operations workflow; history;
  bags/scales; curriculum alarm mappings; interruption; stop/end; and disposition framing.
- Prismaflex separately models softkey navigation, four scales, setup, display calculations,
  alarm/help behavior, interruption, and stop/end workflow.
- Default profiles are tied to named manual revisions and contain no local override.
- A strict optional local-extension schema may later add validated configuration labels without
  changing or silently overriding the manual-reference base.
- Prismaflex pump-target and dose-section `Qeff` remain separately named contexts.
- Ambiguous PrisMax formula passages remain explicitly unavailable; the engine never silently
  repairs the manual.

## Medication and citrate boundary

- `CRRT-09` teaches protocol identity, applicability, version, responsibility, verification, and
  escalation without medication quantities.
- `CRRT-17` and the citrate dashboard teach only linked trend direction, safety-context checks,
  reassessment, and escalation.
- Conceptual citrate state has no dose, target range, adjustment, titration, rate, or actionable
  protocol fields.
- No local solution inventory, medication protocol, or blood-disposition procedure is inferred.

## Persistence, telemetry, and privacy

- Learner progress uses the v3 allowlisted DTO and intentionally resets incompatible older private
  results.
- Learn, Practice, and Mastery records are isolated.
- Progress contains no patient identifiers, free-text reasoning, screenshots, live trend series, or
  detailed action log.
- Analytics accepts only allowlisted module, case, device, drill, tool, experience, and event IDs.
- `review-preview` produces no progress write and no telemetry.

## Interface and accessibility

- Preserve `Read → Define → Select → Predict → Run → Reassess → Reflect`.
- Desktop and responsive mobile layouts expose case, machine, circuit, patient, and debrief state.
- Global alarms remain available independent of active mobile tab.
- Keyboard navigation, focus restoration, semantic summaries, 44-pixel targets, reduced motion,
  200% zoom, 320-pixel reflow, tablet layout, and reviewed-English fallback are required.

## Explicit exclusions

No pediatric workflow, ECMO integration, TPE, hemoperfusion, service mode, local stock list,
medication dosing, citrate targets, patient-specific recommendation, runtime generative AI,
certification, or independent competency claim is included.
