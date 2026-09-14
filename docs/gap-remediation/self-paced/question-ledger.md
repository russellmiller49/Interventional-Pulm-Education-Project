# G00 representative question-purpose ledger

Nine deliberately selected activities: three EBUS questions, three CRRT case fields, and three Hemodynamics questions. Selection covers orientation, anatomy, troubleshooting, generic reasoning forms, signal interpretation and data validity. This is a lightweight teaching-purpose sample, not a census or a psychometric analysis. No answer-position or longest-option scores were calculated.

The quoted prompts, options and explanations below were read from the **resolved current runtime exports** at `9ef04539118b889a344992c63ba35808ee477f0e`, not inferred solely from authoring templates or the external report. EBUS questions can be replaced during curriculum assembly; CRRT cases are generated and patched before export. Source locations therefore include those assembly paths.

All dispositions are **proposals for the named future module slice**. G00 changed no item, answer, explanation, source, approval or clinical fact. Existing draft/pending review status remains. Removing a question always preserves its useful underlying teaching. The common target for retained checks is explanation without submission, optional retry and free Continue, with no grade or help-history write.

| Sample                          | Disposition                                          | Next slice |
| ------------------------------- | ---------------------------------------------------- | ---------- |
| EBUS orientation-predict        | Replace with a worked rotation comparison            | EBUS-01/02 |
| EBUS seven-predict              | Keep as optional reinforcement                       | EBUS-01/02 |
| EBUS difficulty-predict         | Combine with the existing troubleshooting comparison | EBUS-01/02 |
| CRRT-05 goal field              | Remove the scored question; keep the stated goal     | CRRT-01/02 |
| CRRT-15 mechanism field         | Replace with a worked pressure-trend comparison      | CRRT-01/02 |
| CRRT-16 reassessment-plan field | Combine with an ungraded reassessment guide          | CRRT-01/02 |
| HD hd-why-predict-1             | Keep as optional reinforcement                       | HD-01/03   |
| HD hd-place-predict-1           | Rewrite the interaction as optional tracing/reveal   | HD-02/03   |
| HD pac-derived-predict-1        | Keep as optional reinforcement                       | HD-01/03   |

## Current feedback behavior shared by these samples

EBUS `components/QuestionBody.tsx` builds `AnswerVerdict` only after `committed`; `content/authoring.ts` sets `explanation` equal to the correct option rationale. `LessonHost.tsx` requires selection before submission and forces revision of unsafe responses. It also writes first attempts/support use. These are implementation findings, not new clinical judgments.

CRRT `components/CrrtCasePlayer.tsx` requires its five reasoning fields before committing that form, but `engine/learningSession.ts` already permits independent intervention, time, reassessment and debrief. `REVEAL_DEBRIEF` does not require a submitted prediction; mastery mode suppresses hints. The case-field descriptions and debrief below contain the useful teaching currently behind generic labels. Do not falsely describe all CRRT operations as answer-locked.

HD `components/stage/HemodynamicsStageHost.tsx` renders question feedback after a committed choice; the optional future reveal must be independent of `pendingChoice`/commitment. Separate the five-correct recognition quota from real PAC/measurement protections. Quoted feedback is existing draft content, not a G00 endorsement or faculty review.

## EBUS — orientation-predict (scope-orientation)

Source: `src/features/ebus-guided/content/prepare.ts; resolved by content/curriculum.ts`. Renderer: `src/features/ebus-guided/components/{LessonHost,QuestionBody}.tsx`.

**Actual prompt:** At a stable airway position, the node disappears during rotation and reappears when rotation is reversed. What best explains this?

- `a`: The node changed histology during the sweep
- `b`: The imaging plane moved through and away from the node
- `c`: The processor measured a new node size automatically

**Current explanation:** A two-dimensional sector samples different tissue as the scope rotates.

**Purpose:** Relate reversible image appearance to a changed imaging plane while airway position stays fixed.

**Friction:** One alternative says histology changed during a rotation. It does not create a useful competing explanation; mandatory submission adds little to the worked demonstration.

**Proposed disposition:** Replace the MCQ with the existing rotation/reversal comparison and an immediately available explanation. Keep any optional prediction local, and label modeled views accurately.

## EBUS — seven-predict (station-seven)

Source: `src/features/ebus-guided/content/locate.ts; resolved by content/curriculum.ts`. Renderer: `src/features/ebus-guided/components/{LessonHost,QuestionBody}.tsx`.

**Actual prompt:** A confirmed subcarinal node is sampled through the left main bronchus. Which station should be recorded?

- `a`: Station 10L because the scope is on the left
- `b`: Station 7
- `c`: Station 4L because the image is obtained from a left-sided window

**Current explanation:** The target’s anatomical compartment defines the station.

**Purpose:** Distinguish target anatomical station from the bronchial approach used to image/sample it.

**Friction:** The alternatives correspond to the approach-versus-target confusion, so the question has a teaching purpose. The short correct rationale repeats the explanation; required submission and hidden explanation are the main friction.

**Proposed disposition:** Keep as optional reinforcement beside the two-approach worked example. Permit direct explanation, repeat and Continue; retain meaningful station titles and current anatomy review boundaries.

## EBUS — difficulty-predict (difficult-acquisition)

Source: `src/features/ebus-guided/content/complete.ts; resolved by content/curriculum.ts`. Renderer: `src/features/ebus-guided/components/{LessonHost,QuestionBody}.tsx`.

**Actual prompt:** The scope view is stable and tissue echoes are present, but the target’s far border is outside the sector. What should be adjusted first?

- `a`: The specimen container
- `b`: The depth field
- `c`: The needle force

**Current explanation:** The acquisition problem is framing, rather than absent contact.

**Purpose:** Identify a framing problem and connect it to the relevant image control.

**Friction:** The container/needle-force alternatives do not meaningfully compare image-control explanations. The same lesson already matches failure patterns to checks.

**Proposed disposition:** Combine this check with the existing matching/worked comparison. Keep its useful framing-versus-contact distinction visible; do not invent a harder distractor set or change device guidance without review.

## CRRT — CRRT-05 / goalOptions

Source: `src/features/baxter-crrt/content/completeCases.ts` resolved `baxterCrrtCases`; renderer `components/CrrtCasePlayer.tsx`. Status: `pending`.

**Case title:** Compare pre- and post-filter replacement flow in CVVH

**Actual decision field:** 1 · Goal (a form field, not a separate authored question stem).

- `crrt05-goal-focus`: Define the pre- versus post-replacement tradeoff
- `crrt05-goal-isolated-value`: Treat one isolated value as the complete goal

**Current feedback/content:** Use the full clinical picture and acknowledge uncertainty; no single value should be treated as a universal threshold. Alternate description: This ignores the rest of the clinical picture and the need for reassessment.

**Current debrief:** Causal debrief for CRRT-05. Connect the goal, action, response, and reassessment. Compare your prediction with the observed mechanism and response.

**Purpose:** State the specific pre/post replacement comparison before the actual device experiment.

**Friction:** The choice asks the learner to favor a stated goal over ignoring context; it does not require a CRRT-specific discrimination.

**Proposed disposition:** Remove the scored goal question. Render the existing case goal as scaffolding and preserve the subsequent real flow comparison. Do not remove required device prescription/setup checks.

## CRRT — CRRT-15 / mechanismOptions

Source: `src/features/baxter-crrt/content/completeCases.ts` resolved `baxterCrrtCases`; renderer `components/CrrtCasePlayer.tsx`. Status: `pending`.

**Case title:** Localize rising filter and effluent pressure trends

**Actual decision field:** 2 · Mechanism (a form field, not a separate authored question stem).

- `crrt15-mechanism-causal`: Choose the mechanism that best links the findings
- `crrt15-mechanism-display-equals-outcome`: Assume a displayed prescription guarantees the patient response

**Current feedback/content:** Low effective flow and procoagulant burden can contribute to rising filter burden over time; changing one contributor can alter the trend without proving a bedside diagnosis. Alternate description: This treats the prescription, actual treatment delivery, and patient response as if they were the same thing.

**Current debrief:** Causal debrief for CRRT-15. Connect the goal, action, response, and reassessment. Compare your prediction with the observed mechanism and response.

**Purpose:** Connect a pressure trend to the modeled contributors and distinguish hypothesis from a proven device/patient cause.

**Friction:** “Choose the mechanism” is a meta-instruction, not a mechanism option. Its description carries the actual teaching; changing option order would not solve this.

**Proposed disposition:** Replace with a worked pressure-trend comparison using the existing supported controls and model boundaries. A clinician-reviewed contrast may later become an optional question; the display-offset/source hold remains.

## CRRT — CRRT-16 / reassessmentOptions

Source: `src/features/baxter-crrt/content/completeCases.ts` resolved `baxterCrrtCases`; renderer `components/CrrtCasePlayer.tsx`. Status: `pending`.

**Case title:** Recurrent filter loss across access, filtration, downtime, and policy domains

**Actual decision field:** 5 · Reassessment plan (a form field, not a separate authored question stem).

- `crrt16-reassess-trends`: Reassess access, filter trends, effective delivery, downtime, and recurrence
- `crrt16-reassess-none`: Do not reassess after the intervention

**Current feedback/content:** Required reassessment of patient, circuit, device, delivery, and recurrence as applicable. Alternate description: This misses a required safety step: confirming the patient and treatment response.

**Current debrief:** CRRT-16: Recurrent filter loss across access, filtration, downtime, and policy domains Access dysfunction, concentration effects, interruptions, and other patient or protocol factors can combine rather than act alone.

**Purpose:** Remind the learner which observations belong in reassessing recurrent filter loss.

**Friction:** The alternative is simply to omit reassessment. The form forces an answer and the outcome path counts reassessment for mastery despite already supporting independent debrief.

**Proposed disposition:** Combine the plan with an ungraded after-action guide and optional explanation. If the learner reports a reassessment, retain its actual meaning; skip must not mark observations as performed.

## Hemodynamics — hd-why-predict-1

Source: `src/features/icu-hemodynamics/content/stageItems.ts` → `hemodynamicsStageItems['why-measure'].prediction`. Status: `draft`.

**Actual prompt:** An adult is hypotensive after a long operation. The arterial line is level, zeroed and crisp, and its mean pressure is low. What does that number establish on its own?

- `driving-pressure-only`: That arterial pressure is low at the measurement site, without establishing cardiac output or cause.
- `needs-fluid`: That the circulation is under-filled, so the next step is to give fluid.
- `heart-failing`: That the heart is failing, because pressure is what the heart produces.

**Current explanation:** A valid arterial pressure establishes pressure at the measurement site. Cardiac output and additional clinical context help interpret it. A low pressure alone neither establishes fluid benefit nor mandates a pulmonary-artery catheter or a specific treatment.

**Purpose:** Distinguish a valid measured pressure from causal interpretation or a treatment decision.

**Friction:** The alternatives represent different overinterpretations of one signal. The existing explanation is useful; hiding it until submission adds avoidable friction.

**Proposed disposition:** Keep as an optional check after the pressure-versus-flow teaching. Show explanation directly and allow wrong-answer retry/Continue. Preserve uncertainty and existing source status.

## Hemodynamics — hd-place-predict-1

Source: `src/features/icu-hemodynamics/content/stageItems.ts` → `hemodynamicsStageItems['waveform-interpretation'].prediction`. Status: `draft`.

**Actual prompt:** The line is trustworthy and the tracing from the catheter tip is on the monitor with its chamber label covered. Where is the tip?

- `ra`: The right atrium
- `rv`: The right ventricle
- `pa`: The pulmonary artery
- `wedge`: The wedge
- `cannot-name`: It cannot be named from this display

**Current explanation:** The systolic number cannot tell the ventricle from the artery, because they normally share it. The diastole can: diastolic pressure that falls low and climbs, with no notch, is the ventricle; a diastolic step-up and a notch on the way down is the artery.

**Purpose:** Compare tracing morphology and measurement context to locate a catheter tip.

**Friction:** This item depends on a real displayed tracing; the answer cannot be meaningfully reviewed as text alone. The current answer-first interaction and separate five-correct quota impede self-paced comparison.

**Proposed disposition:** Rewrite the interaction as optional predict/reveal alongside labeled reference tracings. The reveal can name the chamber without submitting a response. Keep the real trace pairing, safety indicators and source limitations; do not infer acquired measurements from a reveal.

## Hemodynamics — pac-derived-predict-1

Source: `src/features/icu-hemodynamics/content/stageItems.ts` → `hemodynamicsStageItems['derived-hemodynamics'].prediction` (reuses `content/pacLearningItems.ts`). Status: `draft`.

**Actual prompt:** SVR is calculated from MAP, RAP, and cardiac output. The transducer is off level and atmospheric zero has not been established. How should the displayed SVR be interpreted?

- `withhold-svr`: Withhold precise SVR interpretation until the invasive-pressure inputs are valid.
- `use-map-only`: Interpret SVR from MAP alone because RAP and flow contribute little.
- `assume-normal-flow`: Substitute a normal cardiac output so the resistance can still be trended.

**Current explanation:** Derived hemodynamics are not independent measurements; stale, missing, or invalid inputs make the result non-interpretable.

**Purpose:** Recognize that a derived value inherits invalid or missing input measurements.

**Friction:** The question teaches a useful validity principle. Required commitment should not hide the explanation or control whether invalid data are withheld.

**Proposed disposition:** Keep as optional reinforcement, with the formula/input-validity explanation available immediately. Preserve derived-value withholding regardless of whether the learner answers correctly or skips.

## Review and legacy implications

Keep existing item IDs where useful to interpret legacy records, even if an item is retired from current learning. No sample receives a new approval, source identity or safety classification in G00. EBUS acquisition/anatomy and clinical-media review, CRRT device/model/source review, and HD tracing/source review remain scoped follow-ups. The v2 decision itself needs no assessment-standard approval.
