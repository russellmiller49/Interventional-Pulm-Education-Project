# Baxter CRRT formative pilot feedback form

Instrument status: `planning draft` — not approved for data collection

Instrument version: `CRRT-PILOT-FEEDBACK-draft.1`

Related plan: [pilot-study-plan.md](./pilot-study-plan.md)

Related implementation boundary: [phase-7-status.md](./phase-7-status.md)

This instrument remains scoped to the protected `CRRT-04`, `CRRT-10`, and `CRRT-13` pilot. The
18-case catalog, rapid-drill manifests, and Mastery engine semantics are review-only foundation
records and must not be assigned as participant tasks.

## Participant notice

This form evaluates a synthetic professional-education module. It does not assess employment
performance, certify CRRT/device competence, provide patient-specific advice, or replace supervised
training, the current operator's manual, or local protocol.

Do not enter a patient name, date of birth, medical-record number, real clinical event, colleague or
institution name, email address, phone number, or other identifying information. Report an urgent
clinical, device, privacy, or accessibility concern directly to the pilot facilitator.

Use this instrument only after the product/data owner approves the participant notice, consent,
storage system, access, retention, deletion, and institutional-review requirements. Free-text fields
must not be sent through the module analytics endpoint or stored in CRRT local progress.

## Administration record — facilitator completes

| Stable field ID         | Entry                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| `ADMIN-PILOT-ID`        | Approved pilot ID: `[enter approved ID]`                            |
| `ADMIN-PARTICIPANT-ID`  | Assigned participant ID: `[enter approved ID]`                      |
| `ADMIN-SESSION-DATE`    | Approved date format: `[enter approved date]`                       |
| `ADMIN-BUILD`           | Git revision/build: `[enter exact revision]`                        |
| `ADMIN-ENGINE`          | Engine version: `[enter exact version]`                             |
| `ADMIN-SCHEMA`          | Authored/runtime schema version: `[enter exact version]`            |
| `ADMIN-CONTENT`         | Protected pilot content version: `[enter exact version]`            |
| `ADMIN-PHASE7-MANIFEST` | Phase 7 manifest version present in build: `[enter exact version]`  |
| `ADMIN-DEVICE-PROFILE`  | Device profile version: `[enter exact version]`                     |
| `ADMIN-ENVIRONMENT`     | Browser/OS/assistive technology: `[enter approved environment]`     |
| `ADMIN-FACILITATOR`     | Facilitator code: `[enter code; do not use a name unless approved]` |
| `ADMIN-CONSENT`         | Approved notice/consent recorded: [ ] Yes [ ] No — stop if No       |

## A. Participant context

Choose one answer per item unless the item says otherwise. Store the stable choice code, not the
full display text.

**`CTX-ROLE` — Which lens best matches how you approached this session?**

- [ ] `prescriber` — Prescriber perspective
- [ ] `operator` — Bedside operator perspective
- [ ] `integrated` — Integrated/team perspective
- [ ] `educator-reviewer` — Educator or reviewer perspective
- [ ] `prefer-not` — Prefer not to answer

**`CTX-CRRT-EXPERIENCE` — Your prior CRRT experience**

- [ ] `none` — No prior CRRT education or practice
- [ ] `education-only` — Prior education/simulation, no supervised clinical use
- [ ] `supervised-limited` — Limited supervised clinical experience
- [ ] `regular` — Regular clinical use within current role
- [ ] `educator-expert` — Educator or subject-matter reviewer
- [ ] `prefer-not` — Prefer not to answer

**`CTX-PRISMAX-FAMILIARITY` — Your prior familiarity with PrisMax**

- [ ] `none`
- [ ] `observed-only`
- [ ] `supervised-use`
- [ ] `current-user`
- [ ] `trainer-reviewer`
- [ ] `prefer-not`

**`CTX-ACCESS-METHODS` — Which access methods did you use? Select all that apply.**

- [ ] `pointer-touch`
- [ ] `keyboard-only`
- [ ] `screen-reader`
- [ ] `voice-control`
- [ ] `magnification-zoom`
- [ ] `reduced-motion`
- [ ] `high-contrast-color-adjustment`
- [ ] `other-approved-method`
- [ ] `prefer-not`

Do not describe a diagnosis or medical history in this form.

## B. Task completion record

For each task, record one approved code: `independent`, `completed-with-approved-hint`,
`completed-with-facilitator-assistance`, `not-completed-usability`,
`not-completed-accessibility`, `stopped-safety-or-content`, or `not-attempted`.

| Stable item ID         | Task                                                  | Code | Issue category only |
| ---------------------- | ----------------------------------------------------- | ---- | ------------------- |
| `TASK-ORIENTATION`     | Find boundaries and complete Orientation setup/reload |      |                     |
| `TASK-CRRT04-LEARN`    | Complete `CRRT-04` Learn                              |      |                     |
| `TASK-CRRT04-PRACTICE` | Complete `CRRT-04` Practice                           |      |                     |
| `TASK-CRRT10`          | Complete assigned `CRRT-10` pathway                   |      |                     |
| `TASK-CRRT13`          | Complete assigned `CRRT-13` pathway                   |      |                     |
| `TASK-DEBRIEF`         | Interpret debrief and limits of the result            |      |                     |

Do not place action logs, clinical reasoning, laboratory arrays, or identifying narrative in the
issue-category column.

## C. Rating scale

For `RATE-01` through `RATE-20`, select `1` strongly disagree, `2` disagree, `3` neither,
`4` agree, `5` strongly agree, or `NA` not applicable/unable to assess.

| ID        | Statement                                                                                           | 1   | 2   | 3   | 4   | 5   | NA  |
| --------- | --------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- |
| `RATE-01` | I could tell this was a draft synthetic education module, not a clinical device or treatment guide. |     |     |     |     |     |     |
| `RATE-02` | The current reasoning-loop step was clear.                                                          |     |     |     |     |     |     |
| `RATE-03` | I understood the five prediction fields required before controls unlocked.                          |     |     |     |     |     |     |
| `RATE-04` | Locked or unavailable controls explained what I needed to do next.                                  |     |     |     |     |     |     |
| `RATE-05` | Machine, circuit, patient/trends, and debrief information were easy to locate.                      |     |     |     |     |     |     |
| `RATE-06` | I could distinguish immediate device/circuit response from delayed simulated patient response.      |     |     |     |     |     |     |
| `RATE-07` | `CRRT-04` clearly distinguished prescribed dose from delivered dose and downtime.                   |     |     |     |     |     |     |
| `RATE-08` | `CRRT-10` clearly distinguished machine PFR from whole-patient balance and simulated tolerance.     |     |     |     |     |     |     |
| `RATE-09` | `CRRT-13` connected an access-pressure pattern to cause-first inspection and correction.            |     |     |     |     |     |     |
| `RATE-10` | The module separated alarm acknowledgement from correcting the underlying cause.                    |     |     |     |     |     |     |
| `RATE-11` | Hints supported reasoning without simply revealing an answer.                                       |     |     |     |     |     |     |
| `RATE-12` | Required reassessment made the result of an action easier to understand.                            |     |     |     |     |     |     |
| `RATE-13` | The debrief connected my goal, prediction, action, response, and next step.                         |     |     |     |     |     |     |
| `RATE-14` | Accepted alternatives and score feedback felt understandable and fair for this synthetic case.      |     |     |     |     |     |     |
| `RATE-15` | Device terms/workflow were consistent without implying a manufacturer replica.                      |     |     |     |     |     |     |
| `RATE-16` | Text, controls, focus, and safety state were perceivable with my access method.                     |     |     |     |     |     |     |
| `RATE-17` | The information organization supported rather than overloaded the task.                             |     |     |     |     |     |     |
| `RATE-18` | Simulated values, source limitations, and pending review status were apparent.                      |     |     |     |     |     |     |
| `RATE-19` | I knew when to reassess, communicate, or escalate rather than adjust the device.                    |     |     |     |     |     |     |
| `RATE-20` | I would consider the revised module useful as one part of supervised professional education.        |     |     |     |     |     |     |

`RATE-20` is an acceptability item, not a statement that the build is approved or sufficient for
supervised training.

## D. Safety and fidelity screen

Select `yes`, `no`, or `unable to assess`. Any `yes` on `SAFE-01` through `SAFE-06` must be reviewed
before the next participant session under the pilot stop rules.

| ID        | Question                                                                                                | Yes | No  | Unable |
| --------- | ------------------------------------------------------------------------------------------------------- | --- | --- | ------ |
| `SAFE-01` | Did any instruction, control, score, or debrief appear likely to encourage an unsafe real-world action? |     |     |        |
| `SAFE-02` | Did any simulated number look like a recommended patient target or universal device limit?              |     |     |        |
| `SAFE-03` | Did acknowledgement appear to resolve a fault whose cause remained active?                              |     |     |        |
| `SAFE-04` | Did the module penalize an alternative that should be reviewed as potentially acceptable?               |     |     |        |
| `SAFE-05` | Did device wording, sequence, pressure, calculation, or alarm behavior appear inaccurate or misleading? |     |     |        |
| `SAFE-06` | Did keyboard, screen-reader, zoom, color, motion, or tab state hide a safety condition?                 |     |     |        |
| `SAFE-07` | Was the non-endorsement and professional-education-only boundary clear?                                 |     |     |        |
| `SAFE-08` | Was it clear that Practice does not establish clinical or device competence?                            |     |     |        |

If an urgent issue is reported, stop the session and use the approved incident process. Do not ask
the participant to document a real patient or identifiable event here.

## E. Prioritized structured findings

Choose up to three categories: `navigation-focus`, `prediction-lock-instructions`,
`machine-workflow`, `circuit-pressure-display`, `patient-trend-display`,
`dose-downtime-explanation`, `pfr-whole-balance-explanation`, `alarm-cause-correction`,
`hint-feedback`, `scoring-accepted-alternative`, `debrief-transfer`, `source-safety-boundary`,
`accessibility-reflow`, `terminology-reading-load`, or `no-priority-revision`.

**`PRIORITY-1`**: `[enter category code]`

**`PRIORITY-2`**: `[enter category code]`

**`PRIORITY-3`**: `[enter category code]`

## F. Optional comments — approved storage only

Do not use these fields unless the data plan explicitly approves free-text collection and storage.
Never send them through `/api/analytics` or save them in `baxter-crrt-progress-v2` (or any obsolete
CRRT progress key).

**`COMMENT-HELPFUL` — What most helped you understand cause and effect?**

> Response:

**`COMMENT-CONFUSING` — What was most confusing or difficult to use?**

> Response:

**`COMMENT-SAFETY` — Describe a potential safety, fidelity, or accepted-alternative issue without
patient, colleague, institution, or participant identifiers.**

> Response:

**`COMMENT-ACCESS` — Describe an access barrier and the browser/assistive method used, without
personal medical information.**

> Response:

## G. Facilitator closeout

- [ ] `CLOSE-NO-PHI` — Reviewed for accidental patient/personal identifiers and followed the approved
      redaction/escalation procedure.
- [ ] `CLOSE-URGENT` — Routed every urgent safety, device, privacy, or accessibility finding before
      another participant session.
- [ ] `CLOSE-VERSION` — Linked ratings/findings to the exact recorded build/content versions.
- [ ] `CLOSE-STORAGE` — Stored the form only in the approved system with approved access/retention.
- [ ] `CLOSE-NOT-COMPETENCY` — Did not place this result in an employment competency or credential record.

Facilitator disposition code:

- [ ] `continue-approved-protocol`
- [ ] `continue-after-nonurgent-fix`
- [ ] `pause-clinical-device-review`
- [ ] `pause-accessibility`
- [ ] `pause-privacy-security`
- [ ] `stop-product-owner-review`

This closeout is an operational pilot disposition only. It is not clinical, device, accessibility,
publication, or competency approval.
