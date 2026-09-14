# EBUS: Guided Course

> **Superseded in part (2026-09-14, EBUS-01).** The owner's self-paced decision replaces the progress and assessment rules below: there is no Assess unlock, no first-decision record, no support-request record, no required repair of an unsafe choice and no case-completion record. Acquisition, held-image and record-task validity are unchanged. See [`docs/gap-remediation/self-paced/EBUS-01-handoff.md`](../gap-remediation/self-paced/EBUS-01-handoff.md). This file is kept as the historical design record.

Approved September 12, 2026. Early fellows; approximately three hours; full linear EBUS with introductory EUS-B; required guided simulator activities; formative assessment without a passing threshold. Separate unlisted /ebus-guided course and development links; no replacement of existing EBUS routes or progress.

September 13 implementation checkpoint: the six initial model packages, four companion lessons and the five Phase 1 lesson updates are built. The current course has 26 lessons; the sequence/counts below describe the original 22-lesson baseline. Further build, source and review tasks are tracked in [remaining-work.md](remaining-work.md).

## Reference and preservation

Reference: Peripheral Bronchoscopy Imaging shared stage at ab05b9d6. Reuse ModuleFrameV2, StageLayout, NowCard, StepList, LookInLine and AnswerVerdict, with Steps/Teaching/Simulator order, .26/.29/remainder fractions and 300/280/340 px floors. Keep shared components unchanged.
Reuse case_manifest.simplified.web.json, calibrated scope geometry, acoustic renderer, CT/endoscopy/ultrasound station media, and knobology reducer/video lookup. Legacy wrappers retain course storage and behavior. Guided workbenches have no course auth or persistent state.

## Teaching sequence

Prepare (clinical question, preparation, scope orientation, coupling); optimize (depth, gain/contrast, Doppler, measurement); locate (CT map, 7, right paratracheal, left paratracheal, hilar/interlobar); plan (morphology, staging, EUS-B); sample (needle sequence, adequacy/ROSE, triage); complete (difficult acquisition, complications/recovery, result interpretation/reporting). 22 lessons, estimated 162 guided minutes; nine required labs (five scope/anatomy, four recorded ultrasound controls); thirteen ordering/matching activities; eight final cases (about 25 minutes). Three additional practice cases are optional.
Each lesson specifies one objective, prerequisite recall, teaching, worked example, actual response/action, observation, explanation, transfer and sources. Semantic phases: Recognize/Predict/Act/Observe/Explain/Transfer. Procedure and specimen units use ordering and interpretation acts rather than artificial scope actions.

## Progress and assessment

One versioned course record: completed sections, last visited section, immutable first decisions, completed assessment/debrief. An unfinished lesson restarts at its first step on reload. Restart preserves first decisions. No migration from prior EBUS progress. Preset loading is not an action. Missing media or rendering never completes a lab. Unsafe choices require repair while preserving the first decision. Practice is optional; Assess unlocks after Learn and reports topic feedback without pass/fail.

## Delivery and checks

Pilot coupling lesson through actual parent route and embedded workbench before expanding. Test source/asset resolution, stage and response transitions, invalid/stale bridge messages, safety repair, reload, reset and release boundary; run existing embedded EBUS regressions and both type checks. Inspect browser reference and target at wide, compact and phone widths, keyboard operation and 200% zoom. Review claims/media rights separately from layout and record limitations. Commit only reviewed runtime paths and docs; open PR, no merge or deployment.

Implementation evidence and remaining review boundaries are recorded in [review.md](review.md). [content-map.md](content-map.md) maps the canonical lessons to objectives, activities and sources. All elapsed-time estimates are author estimates; learner timing and clinical validation remain pending.
