# Baxter CRRT engine and runtime

## Architecture

The deterministic engine owns canonical patient, access, circuit, fluid, solute, filter, delivery,
event, and outcome state. It advances through bounded internal steps, applies authored scheduled
events, conserves bag/scale volume, and emits bounded trends. UI components dispatch typed actions
and render projections; they do not calculate clinical outcomes.

Runtime cases pass through strict schema parsing, semantic validation, and one normalization
boundary. Missing mappings, unresolved references, incompatible runtime devices, duplicate bags,
invalid units, nonfinite values, or unsupported state paths fail closed.

## PrisMax runtime

`CrrtDeviceAdapter` and the calculation adapter resolve only `prismax-aw8035-2xx`. The runtime
supports the source-described SCUF, CVVH, CVVHD, and CVVHDF educational contexts, procedure-oriented
setup, Operations, history, bag/scale state, pressure displays, alarm presentation, interruption,
and stop/end framing within the stated AW8035 Rev B boundary.

The Prismaflex runtime adapter and calculation implementation were deleted. Historical Prismaflex
records remain in provenance, and the schema enum remains intentionally broad enough to parse the
unchanged case registry. Neither creates a learner-selectable runtime branch.

## Learning sessions and outcomes

`CrrtLearningExperience` is `practice | mastery`. The engine retains its seven reasoning phases:
Read, Define, Select, Predict, Run, Reassess, and Reflect. The four-stage ribbon is a presentation
grouping only.

Practice is scored with bounded hint penalties. Mastery is restricted to the content-owned masked
capstone and requires ≥80, zero critical errors, zero hints, and reassessment. Persistence and
telemetry are learner-runtime constants; the deleted review mode no longer suppresses them.

Every outcome contains deterministic replay identity, matched paths, satisfied conditions, critical
errors, reassessment completion, domain scores, and a causal debrief. Progress deliberately excludes
replay internals and detailed timelines.

## Progress and analytics

Progress preserves the V3 key and DTO while allowlisting the new seven lesson IDs, 17 Practice case
IDs, five drills, two labs, and one capstone. A content-version mismatch fails closed to a fresh
record.

Analytics validates only bounded summary events by Overview/Learn/Practice/Assess section. It never
accepts device identity, detailed actions, clinical free text, laboratory arrays, or trend arrays.

## Conceptual citrate state

Citrate-calcium content remains structurally separate from prescription state. It contains
qualitative directions and safety checks only, with no medication amount, infusion rate, target,
target range, titration, adjustment, or protocol instruction.
