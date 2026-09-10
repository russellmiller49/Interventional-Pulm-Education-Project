# CRRT, non-ECMO mechanical circulatory support, and other coverage gaps

## What the supplied corpus does not establish

The structural inventory identifies six critical-care sessions: hemodynamic monitoring, acid-base, ARDS, APRV, ECMO, and a ventilation bootcamp. There is no dedicated CRRT session in this bundle. Non-ECMO circulatory support appears briefly, including a mention in the ECMO discussion, rather than as a comprehensive MCS teaching series.

Therefore this package supplies a **workflow for extending the language profile**, not a fabricated transcript-derived CRRT or MCS lexicon. Passing mentions of a subject are not coverage of its terminology, physiology, device operation, or safety requirements.

## How to proceed without blocking all useful work

1. Inventory the target module's actual user-facing terms and the variables to which they bind.
2. Identify its supplied/approved articles, chapters, device instructions, glossary, and existing physician-reviewed examples.
3. Build a module-local terminology table with those source locators. Mark its basis as `module_source_supported`, not `transcript_derived`.
4. Apply E0 changes and well-supported E1 revisions. Leave ungrounded technical replacements in the E2 queue.
5. Report which parts of the module lack a language reference. Do not declare full domain validation.

Use `modes/calibrate.md` when additional renal-support or MCS transcripts become available. The same process applies to thoracoscopy, advanced airway ablation, transplant, ultrasound, or any topic that is only partly represented here.

## CRRT review questions — authored scaffold, not source-derived definitions

Ask the module's own references and implementation:

- Which therapy/mode is actually represented, and what is its formal name and accepted abbreviation?
- Does “flow” refer to blood, dialysate, replacement fluid, effluent, or a different implemented quantity?
- Does a removal value mean a device prescription, a measured delivered amount, or the patient's overall fluid balance?
- Are values absolute or indexed, and what denominator and units does the module use?
- Are a pressure, circuit alarm, or displayed clearance a measured value, model estimate, or qualitative demonstration?
- Which named anticoagulation method, access site, or circuit location is already specified?

Do not answer these questions by guessing. Do not silently change dose, fluid accounting, modality definitions, alarm thresholds, anticoagulation, or equations. The words “prescribed,” “delivered,” “net,” and “total” can change the clinical meaning and are not interchangeable style options.

## Non-ECMO MCS review questions — authored scaffold

Ask the module's own references and implementation:

- Which device/class and supported cardiac compartment are represented?
- Is the label describing pump speed, a support setting, estimated device flow, total patient flow, native output, or a pressure?
- What are the actual inflow/outflow locations, units, and measurement assumptions?
- Which control or observation is meant by “support,” “unloading,” “suction,” “pulsatility,” or “timing” in this module?
- Is a recommendation device-specific, configuration-specific, or explicitly general?
- Does the source distinguish physiologic response from an outcome benefit?

Preserve the module's existing clinical and device model. Do not generalize from an ECMO cannulation example to another support device, change treatment settings, or introduce clinical superiority claims.

## Incomplete source access

Record the source that was unavailable and its effect on the proposed change. Do not claim to have reviewed a document from its title, a referenced talk from its transcript excerpt, or a figure that was not supplied.

A useful output can be a partly implemented language revision with a precise remaining review queue. It should not be a fictitious complete specialty profile or a refusal to make any safe editorial improvements.
