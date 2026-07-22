# Baxter CRRT module requirements

## Product outcome

Provide deterministic adult-ICU education that connects CRRT concepts, PrisMax operation, circuit
behavior, delivered therapy, simulated patient response, clinical reasoning, and team
communication. Authored content and the pure engine own clinical and scoring logic; React renders
their state.

The module is not an operating guide, treatment calculator, institutional policy, competency
credential, or patient-specific recommendation. Exact values, timings, coefficients, score rules,
and case endpoints are synthetic educational calibration.

## Release and information architecture

- Release stages remain `private-development | sme-review | unlisted-preview | published`.
- The current `unlisted-preview` stage is public by direct link, unlisted, noindex, and excluded
  from discovery.
- The learner information architecture is Overview / Learn / Practice / Assess.
- `/review` and `review-preview` do not exist; progress and allowlisted telemetry use the same
  learner runtime.
- Non-English routes show a reviewed-English fallback and do not imply localized clinical review.

## Required learning inventory

- One immutable 18-case registry, ordered `CRRT-01` through `CRRT-18`.
- Seven LearnBlock-shaped draft lessons with claim-level source IDs.
- Ten core Practice cases across six stations and seven collapsed optional cases.
- Five cause-first safety drills: AIR, BLOOD-LEAK, GAIN-LOSS, BAG-SCALE, and WRONG-SOLUTION.
- Two embedded labs: Prescription Workbench and Pressure Localization.
- One masked PrisMax capstone backed by `CRRT-16`, gated on all ten core cases.
- `CRRT-16` must never appear in Learn or Practice pickers.

Each Practice case requires a prediction commitment, safe path, accepted alternative, unsafe path,
educational critical-error rule, deterministic response, reassessment, and causal debrief.

## Device boundary

- PrisMax is the only learner runtime profile and device adapter.
- The case-data Zod device enum intentionally retains both historical IDs for schema/provenance
  compatibility, but runtime lists accept only `prismax-aw8035-2xx`.
- Prismaflex adapter, calculations, selector, and cross-device exercise are absent.
- An optional advanced Learn note tells previously trained learners to transfer verification
  domains—not memorized screens—and to relearn PrisMax-specific workflow.
- Ambiguous PrisMax formula passages remain explicitly unavailable rather than inferred.

## Persistence, telemetry, and privacy

- Progress retains key `baxter-crrt-progress-v3` and the existing V3 DTO shape.
- The content-version bump intentionally resets incompatible pre-publication progress.
- Lesson IDs are the seven new stable Learn IDs; Practice progress accepts the 17 curated cases but
  rejects `CRRT-16`.
- Analytics sections are `overview | learn | practice | assess` and contain no device, drill, tool,
  free-text reasoning, action history, laboratory array, or trend array.

## Medication and safety boundaries

- Citrate content teaches recognition, verification, reassessment, and escalation only; it exposes
  no medication amount, rate, target, range, titration, or adjustment instruction.
- Wrong-solution content stops at preservation of a safe state, verification, and escalation.
- Safety copy directs learners to current manufacturer instructions, local policy, supervision, and
  clinical judgment and makes no certification claim.

## Interface and accessibility

- The seven engine phases remain intact while the UI groups them into Brief, Plan, Run, and Debrief.
- Case surfaces are Case / Machine + circuit / Patient & trends / Debrief.
- The Integrated/Operator/Prescriber lens is a compact control inside the case player.
- Semantic navigation, keyboard tab behavior, visible focus, 44-pixel targets, reduced motion,
  200% zoom, 320-pixel reflow, tablet layout, and text equivalents are required.
