# CRRT-FELLOW-04 — owner-review proposals

**Status of every proposal below: NOT REVIEWED.** None is implemented. Each needs an owner
decision in prompt 05 before any wording, option or key changes. Nothing here is a clinical or
device review, and nothing upgrades a source or review status.

Ten proposals: nine application-check items (F-06) and one structural proposal for Lesson 5
(X-03 / F-25). The implemented presentation work is in `CRRT-FELLOW-04-handoff.md` §3.

## How the nine items were chosen

All 25 learner-visible application checks were read (task IDs and cue statistics in the handoff,
§3.1). The editorial signals below were used **only to rank items for review**. They are not
evidence of how learners perform, and they are not a target to optimize:

| Signal (all 25 items)                                                     | Count    |
| ------------------------------------------------------------------------- | -------- |
| Items with one accepted answer                                            | 23       |
| Items with only two options                                               | 3        |
| Items where an accepted answer is the longest option                      | 23       |
| Distractors with absolute or proof wording (alone, proves, every, must …) | 22 of 46 |
| Accepted answers with such wording                                        | 2 of 27  |

The nine items below combine the largest length gap with absolute wording in a distractor or
only two options. In each, the distractor's weakness is how it is written, not its misconception.
Every proposed rewrite restates a misconception already named in that item's own authored
feedback. Where an option would be new, this is stated.

Lesson-level source records are listed for each item. The registry has no item-level claim map,
so no individual claim is asserted as source-supported.

---

### P-01 · Lesson 7, task 9 · `crrt-fluid-liberation` / `liberation-transfer`

- **Prompt:** "Urine output is improving, but substantial ongoing intake and unresolved
  solute/acid–base concerns remain. Which plan is supported?"
- **Options:**
  - `urine-only` (86 characters): "Stop CRRT solely because urine output increased; no specific
    follow-up plan is needed."
  - **`reassess` (key, 159):** "Reassess the original indication, native function, fluid and
    solute/acid–base needs and hemodynamics; define monitoring and contingencies before any trial
    off."
- **Weakness:** there are only two options. The distractor pairs an absolute ("solely") with an
  omission nobody would choose ("no specific follow-up plan is needed"). The item tests reading
  more than the distinction between improving urine output and every indication being resolved.
- **Cueing:** the key is 1.85× longer; the distractor has absolute wording; there are only two
  options.
- **Sources (lesson):** FLUID-PM-001, FLUID-PM-002, TEXT-CRRT-NEYRA-2026, WHITE-2024,
  GONEUTRAL-2024, GUID-RRT-ICU-2026.
- **Proposed rewrite:**
  - Key (same meaning, shorter): "Before any trial off, reassess the indication, fluid and
    solute/acid–base needs, native function and hemodynamics, and plan monitoring."
  - `urine-only`: "Plan a trial off now, since improving urine output shows the fluid and
    solute/acid–base needs are being met." This restates its own feedback: "Urine recovery alone
    does not establish that all fluid, solute and acid–base needs are met."
  - Optional **new** third option: "Continue unchanged until urine output passes a fixed
    threshold, then stop." This is drawn from the key's feedback: "rather than a universal stop
    threshold."
- **Clinical meaning changes?** The key does not change. The first distractor keeps its
  misconception in new words. The optional third option is a new choice.
- **Decision needed:** approve, edit or reject each line. Alternatively, turn the item into a
  worked comparison.

### P-02 · Lesson 8, task 9 · `crrt-pressure-profile-integration` / `case-reassess`

- **Prompt:** "Which handoff accounts for both this run and the limits of its observations?"
- **Options:**
  - `complete-runtime` (86): "Report the current hourly settings as delivered for the whole hour
    and omit the pause."
  - **`reconcile` (key, 140):** "Report regional findings, actions, current pump state, recorded
    delivery/downtime, both fluid ledgers and remaining patient/protocol checks."
  - `patient-neutral` (76): "Report patient fluid neutrality whenever the machine has removed
    some fluid."
- **Weakness:** the key is the only complete list. Its discriminating content appears only in
  the key's feedback: a corrected pressure profile does not establish recovery, and a paused
  escalation path stays open.
- **Cueing:** the key is 1.6–1.8× longer; one distractor uses "whenever".
- **Sources (lesson):** DEV-PM-009, DEV-PM-010, MATH-PM-002, FLUID-PM-002, TEXT-RRT-HOSTE-2024,
  REVIEW-CRRT-PRINCIPLES-2021, REVIEW-CKRT-CORE-2025, SYNTH-LAB-PRESSURE-001, GUID-RRT-ICU-2026.
- **Proposed rewrite:**
  - Key: "Report findings, actions, pump state, recorded delivery and downtime, both fluid ledgers,
    and the checks still open."
  - `complete-runtime`: "Report the corrected pressure profile and the actions taken; the pause
    fixed the problem, so no checks remain open." This comes from the key's own rationale.
  - `patient-neutral`: "Report this hour's machine removal as the patient's fluid balance,
    alongside the settings and pressures." This restates "Machine removal is only one term."
- **Clinical meaning changes?** The key does not change. The first distractor's misconception
  changes from "omit the pause" to "a corrected profile closes the case"; both are in the
  authored feedback.
- **Decision needed:** approve, edit or reject, and say which misconception the item should test.

### P-03 · Lesson 7, task 7 · `crrt-fluid-liberation` / `flow-transfer`

- **Prompt:** "A different patient's immediate concern is excessive fluid loss during CRRT, while
  the need for solute support persists. What distinction should guide reassessment?"
- **Options:**
  - `dialysate` (65): "Dialysate flow is the same quantity as net patient fluid removal."
  - **`separate` (key, 122):** "Reassess net removal and all patient inputs/outputs while
    separately reviewing blood flow and solute-support requirements."
  - `pump` (65): "Increasing blood flow alone establishes a safer net-removal rate."
- **Weakness:** the key is 1.9× longer and is one of only two keys with absolute wording
  ("all"). One distractor says "alone … establishes".
- **Sources (lesson):** FLUID-PM-001, FLUID-PM-002, TEXT-CRRT-NEYRA-2026, WHITE-2024,
  GONEUTRAL-2024, SYNTH-LAB-FLUID-001, GUID-RRT-ICU-2026.
- **Proposed rewrite:**
  - Key: "Review net removal against every input and output, separately from blood flow and
    solute support."
  - `dialysate`: "Lower dialysate flow, since dialysate is the flow that sets how much fluid the
    patient loses."
  - `pump`: "Raise blood flow first, since a faster circuit makes the current net-removal rate
    safer to continue."
- **Clinical meaning changes?** No. Each distractor keeps the misconception in its own feedback.
- **Decision needed:** approve, edit or reject.

### P-04 · Lesson 2, task 6 · `crrt-circuit-pressures` / `pressure-transfer`

- **Prompt:** "At the same blood flow, return and filter pressures rise together while filter
  pressure drop stays unchanged. What should you inspect to refine the interpretation?"
- **Options:**
  - `filter` (84): "Focus on the filter alone because any higher filter pressure proves filter
    clotting."
  - **`return` (key, 121):** "Assess the patient and inspect the return path for increased
    resistance; the readings do not identify one specific cause."
  - `ignore` (78): "Treat the unchanged pressure drop as proof that no circuit problem is
    present."
- **Weakness:** both distractors use proof language ("alone", "any", "proves", "proof"). The key
  is the only hedged option.
- **Sources (lesson):** DEV-PM-009, DEV-PM-010, MATH-PM-002, TEXT-RRT-HOSTE-2024,
  REVIEW-CRRT-PRINCIPLES-2021, SYNTH-LAB-PRESSURE-001.
- **Proposed rewrite:**
  - Key: "Assess the patient and inspect the return path; the readings point to a region, not a
    specific cause."
  - `filter`: "Inspect the filter first; filter pressure rose, and a clotting filter raises it."
  - `ignore`: "Keep observing without inspecting; an unchanged filter pressure drop suggests the
    circuit is intact."
- **Clinical meaning changes?** No. The feedback already names both misreadings: downstream
  resistance raises filter pressure, and an unchanged difference can hide changed components.
- **Decision needed:** approve, edit or reject.

### P-05 · Lesson 8, task 10 · `crrt-pressure-profile-integration` / `integration-transfer`

- **Prompt:** "A separate handoff gives only the final pump settings and total effluent volume.
  It omits urine, external intake, interruption times and anticoagulation delivery. What can you
  conclude?"
- **Options:**
  - `patient-equals-effluent` (90): "Whole-patient fluid loss equals the effluent total, so the
    missing fields are unnecessary."
  - `dose-from-settings` (82): "The final settings establish the delivered dose for the entire
    treatment interval."
  - **`request-history` (key, 127):** "Retain the reported effluent total and request the missing
    patient and delivery history before reconciling balance or adequacy."
- **Weakness:** the key is the only option that acts; both distractors are flat conclusions
  ("establish", "unnecessary").
- **Sources (lesson):** as P-02.
- **Proposed rewrite:**
  - Key: "Keep the effluent total and request the missing patient and delivery history before
    reconciling balance or dose."
  - `patient-equals-effluent`: "Use the effluent total as the patient's fluid loss for now, and
    ask for the other fields later."
  - `dose-from-settings`: "Calculate the delivered dose from the final settings over the whole
    interval, then ask for the history."
- **Clinical meaning changes?** No. The misconceptions stay the same: effluent is not patient
  loss, and settings are not delivery. All three options now act, so the item tests the
  misconception rather than the grammar.
- **Decision needed:** approve, edit or reject.

### P-06 · Lesson 5, task 10 · `crrt-alarms-troubleshooting` / `alarm-transfer`

- **Prompt:** "In a different run, the alert is acknowledged and the pressure looks less
  abnormal, but the blood pump remains stopped and recorded effluent has not increased. What has
  been verified?"
- **Options:**
  - `restored` (70): "Successful treatment delivery has been verified by the pressure alone."
  - **`not-restored` (key, 102):** "Delivery has not been demonstrated; reassess the cause and
    device state before permitted continuation."
- **Weakness:** there are only two options, and the distractor contradicts the stem (the pump is
  stopped).
- **Sources (lesson):** DEV-PM-005, DEV-PM-008, DEV-PM-012, DEV-PM-013, DEV-PM-014,
  TEXT-RRT-HOSTE-2024, GUID-RRT-ICU-2026.
- **Proposed rewrite:**
  - Key: "Delivery has not been shown; reassess the cause and device state before any permitted
    continuation."
  - `restored`: "Treatment delivery has resumed, since the pressure is closer to its starting
    value."
  - **New** third option: "The cause has been corrected, since the alert was acknowledged and the
    pressure improved." This comes from the key's feedback: "Acknowledgement, pressure at stopped
    flow and actual delivery are separate observations."
- **Clinical meaning changes?** The key does not change. The third option is a new choice.
- **Decision needed:** approve, edit or reject the new option; confirm that the key stays the
  only accepted answer.

### P-07 · Lesson 3, task 5 · `crrt-solute-transport` / `transport-transfer`

- **Prompt:** "A CVVH illustration increases replacement flow and matching filtration while
  holding net CRRT removal fixed. What is the main distinction?"
- **Options:**
  - **`convection` (key, 114):** "More water crosses the membrane with convective solute
    transport; the replacement offsets part of that water loss."
  - `replacement-dialysate` (74): "Replacement stays on the fluid side of the membrane and acts
    as dialysate."
  - `all-patient-loss` (74): "All increased effluent must be additional net fluid loss from the
    patient."
- **Weakness:** the key is the longest option, and one distractor says "All … must".
- **Sources (lesson):** REVIEW-CRRT-PRINCIPLES-2021, TEXT-RRT-HOSTE-2024, REVIEW-CKRT-CORE-2025,
  GUID-RRT-ICU-2026, SYNTH-LAB-TRANSPORT-001.
- **Proposed rewrite:**
  - Key (same meaning, shorter): "More water crosses the membrane, carrying solute by
    convection; replacement offsets part of that water."
  - `replacement-dialysate`: "Replacement works like dialysate: it runs on the fluid side and
    clears solute by diffusion."
  - `all-patient-loss`: "The extra effluent is extra fluid removed from the patient, even though
    the removal setting is unchanged."
- **Clinical meaning changes?** No. The key's wording, "offsets part of that water", is kept
  as authored. The owner may also want to review that phrase for this stem, where filtration and
  replacement rise together; that is a clinical-wording question and is not changed here.
- **Decision needed:** approve, edit or reject. Separately, decide whether "offsets part of"
  should stay.

### P-08 · Lesson 5, task 8 · `crrt-alarms-troubleshooting` / `alarm-continuation`

- **Prompt:** "The modeled access cause has been corrected while treatment is paused. Which
  continuation plan is supported?"
- **Options:**
  - **`resume-verify` (key, 104):** "Use the permitted case resume action, then reassess the
    patient, pressures, pump state and new delivery."
  - `universal` (76): "Use the same resume sequence for every device alarm once it is
    acknowledged."
  - `return` (82): "Perform blood return automatically because the pressure improved during the
    pause."
- **Weakness:** both distractors carry absolutes ("every", "automatically"). The key is the only
  option with reassessment.
- **Sources (lesson):** as P-06.
- **Proposed rewrite:**
  - `universal`: "Resume with the same steps used for the previous alert, since this alert has
    been acknowledged."
  - `return`: "Return the blood and end the run, since the pressure improved while paused."
  - Key: unchanged.
- **Clinical meaning changes?** No. Both distractors keep the misconceptions named in their
  feedback: there is no universal restart sequence, and a stopped-pump pressure is not evidence
  that blood return is appropriate.
- **Decision needed:** approve, edit or reject.

### P-09 · Lesson 6, task 8 · `crrt-anticoagulation` / `citrate-transfer`

- **Prompt:** "A handoff reports rising circuit pressures during RCA. Sampling sites and current
  calcium/acid-base trends are missing. Which next step is justified?"
- **Options:**
  - `empiric-citrate` (79): "Increase citrate to reverse the pressure change, then seek the
    missing samples."
  - **`parallel-assessment` (key, 110):** "Assess patient and circuit, verify delivery, and
    obtain correctly identified systemic and circuit information."
  - `ignore-systemic` (85): "Use the pressure trend as a substitute for systemic calcium and
    acid-base assessment."
- **Weakness:** as written, `ignore-systemic` is implausible ("as a substitute"). The key is the
  longest option.
- **Sources (lesson):** TEXT-CRRT-NEYRA-2026, REVIEW-CKRT-CORE-2025, GUID-RRT-ICU-2026,
  SYNTH-LAB-CITRATE-001, CITRATE-SIAARTI-2023-MECHANISM, CITRATE-SIAARTI-2023-SAMPLING,
  CITRATE-SCHNEIDER-2017-METABOLISM, CITRATE-SCHNEIDER-2017-PATTERNS,
  CITRATE-ICU-GUIDE-2026-SAFETY.
- **Proposed rewrite:**
  - `ignore-systemic`: "Localize the pressure change first; the calcium and acid–base review can
    wait for the next routine samples." This comes from the key's feedback: "Mechanical
    localization and the anticoagulation review answer different questions."
  - Key: "Assess the patient and circuit, verify delivery, and get correctly labeled systemic and
    circuit samples."
  - `empiric-citrate`: unchanged.
- **Clinical meaning changes?** The rewritten distractor tests a sequencing misconception ("the
  metabolic review can wait") instead of a substitution one. Both are in the authored feedback,
  but this changes what the item tests, so it needs owner review.
- **Decision needed:** approve, edit or reject.

---

### P-10 · Lesson 5 split (X-03, F-25) — a proposal only

Lesson 5, **"Alarms and cause-first troubleshooting"** (`crrt-alarms-troubleshooting`), has ten
tasks over two runs. Since Batch 03, its "Lesson tasks" outline shows two labeled parts.
Nothing below is implemented. No ID, route, order or prerequisite changed in this batch.

| Part                        | Tasks | IDs                                                                                                       | Guided run                           |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1 · Set-up and a normal run | 1–4   | `machine-orientation`, `machine-setup`, `normal-delivery`, `delivery-interpretation`                      | workflow (guided version of CRRT-04) |
| 2 · An alert, cause-first   | 5–10  | `alarm-arrival`, `alarm-localize`, `alarm-repair`, `alarm-continuation`, `alarm-verify`, `alarm-transfer` | access (guided version of CRRT-13)   |

**What a real split would touch** (why it is not done here):

- **Identity and URLs.** A new lesson ID would be needed for one part, for example
  `crrt-alarms-first-response`, with the existing ID kept for the other. Saved links to
  `learn?lesson=crrt-alarms-troubleshooting&…` and saved `lastLocation.taskId` values would stop
  resolving for tasks that move. `validCrrtLearningLocation` would then drop the saved location,
  so it fails safe.
- **Local history.** `selfPaced.visitedLessonIds` holds the old ID. A new lesson would start as
  "not visited" even for learners who opened those tasks. Legacy `completedLessonIds` must not be
  rewritten, under the storage contract and F-20.
- **Order and numbering.** `BAXTER_CRRT_LEARN_LESSON_IDS` would grow to nine. "Lesson N of 8",
  the hub's "Eight lessons" and every later lesson number would change, including the Practice
  reuse labels ("Lesson 5 (tasks 5–9)" would move).
- **Pathway and catalog.** The pathway sections (`critical-care/content/learningPathways.ts`) and
  activity seeds (`activities.ts`) would change: title, stage order, the authored minutes
  estimate. So would the curriculum station's `lessonIds`, the Lesson 8 prerequisite list
  (`crrt:learn:crrt-alarms-troubleshooting`), the analytics allowlist of lesson IDs
  (`src/lib/baxter-crrt-analytics.ts`), the two-part outline in `learnSequence.ts`, and the
  dormant `lessonClinicalAnchors.ts`, which is pinned to the lesson ID list.
- **Clinical content.** None. The ten tasks and their runs are unchanged by any option.

**Options:**

- **A.** Keep one lesson with the Batch-03 two-part outline. This is the status quo.
- **B.** Split into two lessons along the part boundary, with a new ID for one part and the
  migration notes above.
- **C.** Keep one ID and add a "Part 2 starts here" resume point in the outline and the hub
  sequence, with no new ID.

**Decision needed:** A, B or C. The implementer's view, which is not a recommendation on clinical
grounds: A or C until pilot observations show where learners stop. B is a content and progress
migration of its own and should be a separately scoped change.
