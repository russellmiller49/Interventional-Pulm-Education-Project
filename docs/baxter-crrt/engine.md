# Baxter CRRT v1 engine and adapter model

## Architecture

The deterministic engine owns canonical patient, access, circuit, fluid, solute, filter, delivery,
event, and outcome state. It advances through a 60-second internal step, applies authored scheduled
events, conserves bag/scale volume through one coupled feasible-delivery fraction, and emits bounded
trend samples. UI components dispatch typed actions and render projections; they do not calculate
clinical outcomes.

Runtime content passes through strict schema parsing, semantic validation, and one normalization
boundary. Missing event mappings, unresolved references, incompatible devices, duplicate bags,
invalid units, nonfinite values, or unsupported state paths fail closed.

## Device adapter contract

`CrrtDeviceAdapter` provides device identity, profile metadata, navigation, vocabulary, setup
sequence, display calculations, alarm presentation, interruption behavior, stop/end behavior, and
control dispatch over shared canonical state.

### PrisMax

- SCUF, CVVH, CVVHD, and CVVHDF.
- Procedure-oriented setup through operations, history, bag/scale state, alarms, interruption,
  stop/end, and disposition framing.
- AW8035 Rev B source context.
- Ambiguous post-filter and pre-infusion expressions remain unavailable.

### Prismaflex

- SCUF, CVVH, CVVHD, and CVVHDF.
- Softkey navigation, separate setup workflow, four-scale layout, alarm/help categories,
  interruption, and stop/end behavior.
- G5036003 Revision 05.2011 source context.
- Pump-target and dose-section `Qeff` are different typed display contexts and are never collapsed.

Adapters translate presentation and controls, not patient truth. Equivalent canonical fixtures run
to the declared numerical tolerance while device-specific projections remain visibly different.

## Profiles

Both defaults are `manual-reference` profiles with named manual revisions and
`localConfiguration: null`. `BaxterCrrtOptionalLocalConfiguration` is a strict, validated extension
point for later site-specific labels and enabled modalities. A local extension must identify its
base profile and sources. It cannot silently alter the base record.

## Learning sessions and outcomes

Session mode is `learner | review-preview`. Review preview runs every function but suppresses
persistence and telemetry. Learn is unscored; Practice is scored with bounded hint penalties;
Mastery is restricted to the content-owned masked capstone and requires ≥80, zero critical errors,
zero hints, and reassessment.

Every outcome contains deterministic replay identity, path matching, satisfied conditions,
critical errors, reassessment completion, domain scores when applicable, and a causal debrief.
Progress deliberately excludes replay internals and detailed timelines.

## Conceptual citrate state

Citrate-calcium content is structurally separate from prescription state. Its values are qualitative
directions and safety-check completion only. There is no field for a medication amount, infusion
rate, target, target range, titration, adjustment, or protocol instruction. UI, analytics, progress,
and schemas are tested for this boundary.
