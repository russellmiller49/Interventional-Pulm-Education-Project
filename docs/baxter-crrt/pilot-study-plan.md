# Baxter CRRT formative pilot study plan

Status: `planning draft` — not approved to recruit, enroll, or collect pilot data

Product under study: authenticated/unlisted PrisMax three-case vertical slice

Companion instrument: [pilot-feedback-form.md](./pilot-feedback-form.md)

## 1. Purpose and decision boundary

This plan describes a formative usability, educational-coherence, and safety-language pilot for the
synthetic `CRRT-04`, `CRRT-10`, and `CRRT-13` workflows. The pilot is intended to find problems,
not to validate a digital twin, prove patient benefit, establish clinical competence, certify device
operation, compare products, or support patient-specific treatment decisions.

No recruitment, entitlement expansion, data collection, or pilot session may begin until the
activation prerequisites in section 3 are documented for the exact code/content/profile revision.

## 2. Evaluation questions

The pilot should determine whether intended users can:

1. Understand the draft/non-endorsement/simulated-value boundary.
2. Traverse `Read → Define → Select → Predict → Run → Reassess → Reflect` without facilitator rescue.
3. Complete the five-field prediction commitment and understand why controls are initially locked.
4. Distinguish immediate device/circuit changes from delayed simulated patient changes.
5. Distinguish prescribed from delivered dose in `CRRT-04`.
6. Distinguish machine PFR from whole-patient balance and tolerance in `CRRT-10`.
7. Interpret an access-pressure pattern causally and correct the cause before acknowledgement-only
   behavior in `CRRT-13`.
8. Recognize accepted alternatives, reassessment requirements, and the causal debrief.
9. Operate the responsive interface with the required keyboard, screen-reader, zoom, motion, and
   mobile accommodations.
10. Identify copy, controls, model behavior, or scoring that appears clinically misleading,
    device-inaccurate, inaccessible, or overly confident.

## 3. Activation prerequisites

- [ ] Name the product owner, pilot lead, technical lead, data steward, accessibility lead, and issue
      escalation owner.
- [ ] Record the exact git revision, route, engine/schema/content/device-profile versions, source
      matrix revision, and pilot dates.
- [ ] Obtain written pilot-scope disposition from a CRRT-experienced nephrologist, critical care
      physician, CRRT nurse educator, and PrisMax-trained device reviewer.
- [ ] Resolve or explicitly stop on every critical clinical/device finding; an unchecked review
      intake is not approval.
- [ ] Complete accessibility review for the pilot tasks and supported browser/assistive-technology matrix.
- [ ] Approve reviewed-English-only/fallback behavior and assign a localization reviewer.
- [ ] Approve a CRRT-specific authenticated pilot entitlement/cohort and test that it does not expose
      the module through public navigation, search, sitemap, or unauthenticated access.
- [ ] Approve participant notice/consent, privacy notice, data fields, retention, access, export,
      deletion, and incident-response procedures.
- [ ] Determine whether institutional quality-improvement, education-research, privacy, legal, or
      ethics/IRB review is required; record the responsible authority's determination.
- [ ] Approve the participant target and role distribution rather than inferring a sample size in code.
- [ ] Approve facilitator script, feedback instrument, compensation if any, and stop/escalation rules.

## 4. Participants and sampling

### Intended perspectives

The research/product owner should deliberately sample the roles that the product is expected to
serve, which may include:

- CRRT prescribers or supervised prescriber trainees.
- Bedside CRRT operators or supervised operator trainees.
- Integrated-team users who coordinate prescription, operation, delivery, and reassessment.
- CRRT educators, nephrologists, critical care clinicians, pharmacists, nutrition specialists, and
  accessibility reviewers for expert review rather than learner-outcome inference.

### Values requiring approval

| Field                               | Approved value |
| ----------------------------------- | -------------- |
| Total participant target            | Pending        |
| Prescriber-lens target              | Pending        |
| Operator-lens target                | Pending        |
| Integrated-team target              | Pending        |
| Accessibility/assistive-tech target | Pending        |
| Experience strata                   | Pending        |
| Recruitment source                  | Pending        |
| Compensation                        | Pending        |

Do not enroll real patients or use patient records. Do not ask participants to enter real patient
details, local credentials, protected health information, or identifiable incident narratives.

## 5. Session design

### 5.1 Preparation

1. Assign a pilot participant ID outside the simulator according to the approved data plan.
2. Confirm consent/notice and explain how to report a safety or privacy concern.
3. State that all values and cases are simulated and unreviewed until formal approval.
4. Explain that the pilot does not assess employment competency or award certification.
5. Record the approved role/experience categories without collecting unnecessary identifiers.
6. Start from a clean module state and the assigned supported browser/assistive-technology setup.

### 5.2 Core tasks

| Task | Workflow                                                                                      | Primary observations                                                        |
| ---- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A    | Locate draft/safety/profile/source boundaries and complete Orientation setup/reload.          | Mental model, terminology, navigation, keyboard/focus, device expectations. |
| B    | Complete `CRRT-04` in Learn, then from clean state in Practice.                               | Prediction lock, prescription sequence, dose/downtime, reassessment.        |
| C    | Complete `CRRT-10` in Learn or Practice according to randomized/approved order.               | PFR/balance distinction, tolerance, team coordination, alternative path.    |
| D    | Complete `CRRT-13` in Learn or Practice according to randomized/approved order.               | Pressure trend, cause-first correction, acknowledgement distinction.        |
| E    | Review score/debrief/source limitations and explain what the result does and does not mean.   | Causal understanding, confidence calibration, competency boundary.          |
| F    | Complete the structured pilot feedback form and report any urgent safety/accessibility issue. | Usability, clarity, credibility, potential harm, missing alternative.       |

The study lead must decide and record whether cases are counterbalanced, fixed in instructional
order, or split across participants. The plan must not claim comparative learning effects unless a
separately reviewed study design supports them.

### 5.3 Facilitator behavior

- Use a versioned neutral script.
- Do not coach the clinical answer unless the session is explicitly a guided Learn observation.
- Record when and why assistance was needed using approved structured categories.
- Stop and document, rather than normalize, clinically misleading, inaccessible, or unsafe behavior.
- Never solicit real patient examples containing identifying information.
- Route urgent findings to the named safety/product owner before another participant is exposed.

## 6. Data collection boundary

### 6.1 Existing in-module structured telemetry

The current server boundary permits only strict, bounded event summaries such as stable case/lesson
ID, pathway, device, role, score, critical-error count, hint count, elapsed time, time to first safe
action, completion, and reassessment completion. It rejects free text, laboratory/trend arrays, and
detailed action logs. These events are associated with an authenticated user at ingestion; they are
not anonymous merely because aggregate reports may be produced later.

Before pilot activation, the data steward must approve whether each existing field is needed and
document retention, role-based access, export, deletion, aggregation, and identity-separation rules.

### 6.2 Detailed local CRRT progress

The browser-local progress record may contain only its versioned allowlist: device, role, completed
lesson/case IDs, attempts, best non-critical score, critical-error attempt count, hint use, last station, and
engine/content versions. It must not be copied into a study dataset without a separately reviewed
schema and explicit participant notice.

### 6.3 Facilitator and feedback data

The feedback form defines stable structured item IDs. Open comments, if approved, must be stored in
the approved research/product system, not added to CRRT analytics or local progress. The facilitator
must redact accidental patient, colleague, institution, or participant identifiers before analysis
according to the approved protocol.

Do not collect:

- PHI or real patient data.
- Free-text clinical reasoning inside the simulator.
- Full trend/laboratory arrays or detailed action/replay logs in analytics.
- Device screenshots containing local operational or patient information.
- Employment-evaluation or credentialing decisions.
- Unapproved audio/video/screen recordings.

## 7. Measures

### 7.1 Structured process measures

- Task completion by stable task/case ID.
- Completion of all five prediction fields before action.
- Time to first safe action where approved and bounded.
- Number of hints in Learn/Practice.
- Required reassessment completion.
- Practice score and separate critical-error-candidate count.
- Need for facilitator assistance by approved category.
- Clean-state/reset failure or state leakage.
- Accessibility block by task and assistive-technology/browser combination.

These measures describe behavior in a synthetic educational case. They are not clinical-performance
outcomes and must not be interpreted as proof of competence.

### 7.2 Structured perception measures

The feedback form covers:

- Navigation and control clarity.
- Prediction and reasoning-loop clarity.
- Immediate/delayed response distinction.
- Dose/downtime, PFR/balance, and pressure-cause clarity.
- Debrief usefulness and feedback fairness.
- Device terminology/behavior credibility.
- Accessibility and cognitive load.
- Confidence calibration and professional-education boundary.
- Perceived risk of misleading or unsafe interpretation.

### 7.3 Expert review measures

Clinical/device reviewers should classify each issue by affected source record, case/path, severity,
likelihood of learner harm, proposed correction, and whether the current pilot must pause. An expert
opinion does not change a source record to approved until the exact revised implementation is
rechecked and the formal checklist disposition is recorded.

## 8. Analysis plan

Because participant targets and design are pending, this plan makes no inferential-power claim.
Before data collection, the pilot lead must freeze:

- Participant/role strata and target.
- Primary formative questions.
- Required descriptive summaries.
- Missing-data and duplicate-session rules.
- How assisted versus unassisted completion is represented.
- How critical safety/accessibility findings override favorable averages.
- Whether case order is fixed or counterbalanced.
- How open comments are coded by at least the approved reviewers.

Report counts and distributions with denominators and role/context, not an unsupported pass rate.
Do not combine Learn and Practice scores as if they measure the same construct. Do not compare device
profiles until Prismaflex has a separately validated adapter and reviewed transfer study.

## 9. Stop, pause, and escalation rules

Pause recruitment immediately when any of the following occurs:

- A module action or debrief could reasonably encourage an unsafe clinical or device behavior.
- An accepted safe alternative is penalized as a critical error.
- A critical fault can be cleared by acknowledgement without cause correction.
- State leaks across learner, pathway, role, case, or attempt.
- Real patient data or unapproved identifiers are captured or transmitted.
- The draft route becomes discoverable or accessible outside the approved cohort.
- A keyboard/screen-reader user cannot perceive or respond to an active safety condition.
- A deterministic replay diverges in a way that changes outcome or scoring.
- A reviewer identifies a source/version/configuration mismatch affecting implemented behavior.

The pilot lead documents the incident, affected versions/participants, containment, owner, decision,
and required retest. Restart requires the named product/safety owners and applicable reviewer to
approve the exact corrected revision.

## 10. Go/no-go disposition after the formative pilot

The pilot may support a decision to revise, repeat, expand, or stop. It cannot by itself authorize
publication, competency credit, the remaining 15 cases, citrate, or Prismaflex.

- [ ] Clinical reviewers accept the exact pilot mechanisms, paths, endpoints, critical-error rules,
      debriefs, and limitations.
- [ ] PrisMax reviewer accepts the exact target profile/workflow/calculations and documented exclusions.
- [ ] Accessibility reviewer accepts the supported matrix with critical/serious findings resolved.
- [ ] Product/data owners accept privacy, telemetry, entitlement, retention, and support operations.
- [ ] Localization reviewer accepts the released-language/fallback boundary.
- [ ] Pilot lead documents findings, changes, unresolved risks, and whether another pilot is required.
- [ ] Product owner records a separate decision about Phase 7; pilot completion alone is not approval.
- [ ] Publication owner records a separate future release decision; draft/unlisted/noindex remains default.

## 11. Unresolved plan fields

- Named owners and reviewers.
- Institutional review/ethics determination.
- Participant target and role distribution.
- Recruitment and compensation.
- Approved browser/assistive-technology matrix.
- Pilot entitlement/cohort mechanism.
- Data retention, access, export, deletion, and incident response.
- Recording policy.
- Case ordering/counterbalancing.
- Go/no-go authority and thresholds.

These blanks require human decisions and must not be silently filled by implementation code.
