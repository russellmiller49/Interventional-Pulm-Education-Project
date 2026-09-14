# Guided EBUS flow and coverage

Generated from the canonical curriculum and activity registry with `npx tsx scripts/ebus-guided/flow-coverage.ts`.

26 stable lessons, 7 chapters, 114 explicit activities. Measurement phantoms precede capture. Topic identifiers remain historical analytics categories.

## Migration convention

The old Orientation → Worked example → prediction → activity → observation → explanation → transfer positions no longer control rendering, acquisition, disclosure or completion. Each row below names its actual replacement activities. Foundation includes the original objective, recall, concept, paragraphs and checklist. Worked teaching includes its original context and reasoning. Each original lesson still has its knowledge, observation and transfer decision, required lab/matching/sequence, takeaways, references and limitation. Explanations appear with the committed response; matching/sequence explanations remain available after their decisions. None of the source paragraphs were deleted.

The full browser journey checks rendered teaching and every task, completes actual controls and records, then completes the three optional coached cases and eight final cases. Unit checks supplement it; source arrays alone are not treated as proof of visible teaching.

The four companion knowledge decisions now follow guided model work and have `-application-v2` identities. Five revised image interpretations have new `-v2` identities. Their original objects and persisted keys remain historical. Historic completion does not certify a newly introduced interpretation or case-record task.

## Course overview

| Chapter                                        | Stable lessons                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Define the examination and prepare             | `clinical-question`, `preparation`                                                       |
| Understand the scope and establish contact     | `scope-orientation`, `acoustic-contact`, `contact-cutaway-model`                         |
| Obtain and interpret a useful ultrasound image | `image-depth`, `gain-contrast`, `doppler`, `measurement-phantoms`, `capture`             |
| Identify anatomical windows and stations       | `ct-map`, `station-seven`, `right-paratracheal`, `left-paratracheal`, `hilar-interlobar` |
| Describe nodes and plan the examination        | `node-characterization`, `systematic-staging`, `eus-b`, `eus-b-route-model`              |
| Sample and preserve useful tissue              | `needle-safety`, `needle-assembly-model`, `adequacy-rose`, `specimen-triage`             |
| Troubleshoot, recover, and report              | `difficult-acquisition`, `complications-recovery`, `results-reporting`                   |

## Lesson coverage

### clinical-question — Define the clinical question

**Status:** Redesigned using supported content.

**Objective:** Distinguish a diagnostic target from a complete nodal staging examination.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ers2026`, `chest2024`, `ics2023`.

| Activity identity                                                                     | Presentation / evidence | Required action and decisions                                | Teaching                                                      |
| ------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `clinical-question:clinical-request` — Define what the examination must answer        | briefing / diagram      | read                                                         | foundation, worked                                            |
| `clinical-question:information-needs` — State the information needed                  | case / none             | matching; `purpose-predict` [none], `purpose-observe` [none] | Current task instruction; response reasoning after commitment |
| `clinical-question:apply-another-situation` — Consider a different diagnostic request | case / none             | questions; `purpose-transfer` [none]                         | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions.

**Representation limit:** The course teaches procedural reasoning. It does not choose a diagnostic pathway for an individual patient.

### preparation — Preparation and the airway plan

**Status:** Redesigned using supported content.

**Objective:** Identify unresolved preparation issues that should pause an elective EBUS procedure.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`.

| Activity identity                                            | Presentation / evidence | Required action and decisions                          | Teaching                                                      |
| ------------------------------------------------------------ | ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `preparation:readiness` — Resolve the readiness issue        | briefing / diagram      | read                                                   | foundation, worked                                            |
| `preparation:team-check` — Agree on the next safe step       | case / none             | sequence; `prep-predict` [none], `prep-observe` [none] | Current task instruction; response reasoning after commitment |
| `preparation:apply-another-situation` — Decide when to pause | case / none             | questions; `prep-transfer` [none]                      | takeaways                                                     |

**Completion evidence:** The original action sequence plus all three safe-to-continue decisions.

**Representation limit:** Drug holds, fasting intervals, airway devices, and sedative doses must follow current local guidance and the responsible clinical team.

### scope-orientation — Scope orientation and the imaging plane

**Status:** Redesigned using supported content.

**Objective:** Relate scope rotation to a change in the ultrasound plane.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                                  | Presentation / evidence | Required action and decisions                           | Teaching                                                      |
| ---------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| `scope-orientation:distal-scope` — Identify the transducer                         | linked / demonstration  | read                                                    | foundation                                                    |
| `scope-orientation:plane-demonstration` — Relate the scope to the ultrasound plane | linked / demonstration  | read                                                    | worked                                                        |
| `scope-orientation:plane-interpretation` — Interpret a change in plane             | case / none             | questions; `orientation-predict` [none]                 | Current task instruction; response reasoning after commitment |
| `scope-orientation:acquire-sweep` — Acquire a gradual sweep                        | ultrasound / live       | acquire (guided)                                        | Current task instruction; response reasoning after commitment |
| `scope-orientation:review-acquisition` — Review this image                         | ultrasound / held       | questions; `orientation-observe` [retained-acquisition] | takeaways                                                     |
| `scope-orientation:apply-another-situation` — Review a different apparent size     | case / none             | questions; `orientation-transfer` [none]                | takeaways                                                     |

**Completion evidence:** simulator, scan, validated scope-orientation landmark/acquisition contract. Action, readiness and actual-frame gates remain required.

**Representation limit:** One calibrated anatomy model is used. Scope assists, limited degrees of freedom, and synthetic echoes do not reproduce hands-on navigation.

### acoustic-contact — Acoustic contact and coupling

**Status:** Redesigned using supported content.

**Objective:** Distinguish loss of acoustic contact from an image-brightness problem.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                      | Presentation / evidence | Required action and decisions                          | Teaching                                                      |
| ---------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `acoustic-contact:contact-example` — Compare contact and brightness    | linked / demonstration  | read                                                   | foundation, worked                                            |
| `acoustic-contact:contact-decision` — Identify the acquisition problem | case / none             | questions; `contact-predict` [none]                    | Current task instruction; response reasoning after commitment |
| `acoustic-contact:restore-window` — Restore the acoustic window        | linked / live           | acquire (guided)                                       | Current task instruction; response reasoning after commitment |
| `acoustic-contact:review-acquisition` — Compare the acquired images    | linked / held           | questions; `contact-observe-v2` [retained-acquisition] | takeaways                                                     |
| `acoustic-contact:apply-another-situation` — Reassess another window   | case / none             | questions; `contact-transfer` [none]                   | takeaways                                                     |

**Completion evidence:** simulator, coupling, validated acoustic-contact landmark/acquisition contract. Action, readiness and actual-frame gates remain required.

**Representation limit:** The grayscale image is simulated from one anatomy model. Contact quality is an authored model index; it is not a measured pressure or a clinical safety threshold.

### contact-cutaway-model — Contact, air gaps and acoustic shadowing

**Status:** Redesigned using supported content.

**Objective:** Use a local cutaway to distinguish missing coupling from a shadow behind a reflector.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 3 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                                   | Presentation / evidence | Required action and decisions                                                                | Teaching                                                      |
| ----------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `contact-cutaway-model:contact-mechanism` — Relate the wall, transducer and air gap | linked / demonstration  | read                                                                                         | foundation, worked                                            |
| `contact-cutaway-model:contact-states` — Compare the supported contact states       | linked / live           | acquire (guided)                                                                             | Current task instruction; response reasoning after commitment |
| `contact-cutaway-model:review-acquisition` — Explain the contact comparison         | linked / held           | questions; `cutaway-predict-application-v2` [none], `cutaway-observe` [retained-acquisition] | takeaways                                                     |
| `contact-cutaway-model:apply-another-situation` — Apply the contact principle       | case / none             | questions; `cutaway-transfer` [none]                                                         | takeaways                                                     |

**Completion evidence:** model, model, package contact. Action, readiness and actual-frame gates remain required.

**Representation limit:** Authored qualitative acoustic illustration. Brightness and balloon shape do not represent measured pressure, inflation volume or a calibrated clinical ultrasound response.

### image-depth — Choose an appropriate image depth

**Status:** Redesigned using supported content.

**Objective:** Adjust depth to display the target and tissue immediately beyond it.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                                  | Presentation / evidence    | Required action and decisions                        | Teaching                                                      |
| ---------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `image-depth:depth-example` — Compare the displayed fields                         | ultrasound / demonstration | read                                                 | foundation, worked                                            |
| `image-depth:field-decision` — Choose the control for the field                    | case / none                | questions; `depth-predict` [none]                    | Current task instruction; response reasoning after commitment |
| `image-depth:depth-comparison` — Frame the target and surrounding tissue           | ultrasound / live          | acquire (guided)                                     | Current task instruction; response reasoning after commitment |
| `image-depth:review-acquisition` — Interpret the two recorded fields               | ultrasound / held          | questions; `depth-observe-v2` [retained-acquisition] | takeaways                                                     |
| `image-depth:apply-another-situation` — Preserve the anatomy beyond another target | case / none                | questions; `depth-transfer` [none]                   | takeaways                                                     |

**Completion evidence:** knobology, depth. Action, readiness and actual-frame gates remain required.

**Representation limit:** These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

### gain-contrast — Gain, contrast, and tissue detail

**Status:** Redesigned using supported content.

**Objective:** Distinguish a brightness adjustment from a change in tissue characteristics.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                                | Presentation / evidence    | Required action and decisions                       | Teaching                                                      |
| -------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `gain-contrast:detail-example` — Compare brightness and tissue detail            | ultrasound / demonstration | read                                                | foundation, worked                                            |
| `gain-contrast:brightness-decision` — Explain a brightness change                | case / none                | questions; `gain-predict` [none]                    | Current task instruction; response reasoning after commitment |
| `gain-contrast:detail-comparison` — Adjust one image control at a time           | ultrasound / live          | acquire (guided)                                    | Current task instruction; response reasoning after commitment |
| `gain-contrast:review-acquisition` — Compare the retained detail                 | ultrasound / held          | questions; `gain-observe-v2` [retained-acquisition] | takeaways                                                     |
| `gain-contrast:apply-another-situation` — Distinguish poor contact from low gain | case / none                | questions; `gain-transfer` [none]                   | takeaways                                                     |

**Completion evidence:** knobology, gain. Action, readiness and actual-frame gates remain required.

**Representation limit:** These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

### doppler — Doppler and the intended needle path

**Status:** Redesigned using supported content.

**Objective:** Use Doppler as part of a vascular-path assessment without treating absent color as proof of safety.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                           | Presentation / evidence    | Required action and decisions                          | Teaching                                                      |
| --------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `doppler:flow-example` — Use flow and anatomy together                      | ultrasound / demonstration | read                                                   | foundation, worked                                            |
| `doppler:path-assessment` — Choose the additional assessment                | case / none                | questions; `doppler-predict` [none]                    | Current task instruction; response reasoning after commitment |
| `doppler:flow-comparison` — Compare grayscale and color recordings          | ultrasound / live          | acquire (guided)                                       | Current task instruction; response reasoning after commitment |
| `doppler:review-acquisition` — Interpret the recorded flow                  | ultrasound / held          | questions; `doppler-observe-v2` [retained-acquisition] | takeaways                                                     |
| `doppler:apply-another-situation` — Resolve an uncertain vascular structure | case / none                | questions; `doppler-transfer` [none]                   | takeaways                                                     |

**Completion evidence:** knobology, doppler. Action, readiness and actual-frame gates remain required.

**Representation limit:** These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

### measurement-phantoms — Sweep and measure geometric phantoms

**Status:** Redesigned using supported content.

**Objective:** Sweep through fixed shapes and record a central short-axis measurement using visible borders.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 3 takeaways. Sources: `atlas`, `simulation`.

| Activity identity                                                                    | Presentation / evidence | Required action and decisions                                                                | Teaching                                                      |
| ------------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `measurement-phantoms:measurement-plane` — Relate the plane to the requested axis    | linked / demonstration  | read                                                                                         | foundation, worked                                            |
| `measurement-phantoms:phantom-comparison` — Sweep and measure the analytic shapes    | linked / live           | acquire (guided)                                                                             | Current task instruction; response reasoning after commitment |
| `measurement-phantoms:review-acquisition` — Explain the dimension in this plane      | linked / held           | questions; `phantom-predict-application-v2` [none], `phantom-observe` [retained-acquisition] | takeaways                                                     |
| `measurement-phantoms:apply-another-situation` — Apply the axis limitation to a node | case / none             | questions; `phantom-transfer` [none]                                                         | takeaways                                                     |

**Completion evidence:** model, model, package measurement. Action, readiness and actual-frame gates remain required.

**Representation limit:** Analytic geometric phantoms with authored dimensions. The fictional station label teaches documentation and does not make these objects anatomical station boundaries.

### capture — Freeze, measure, and document the image

**Status:** Redesigned using supported content.

**Objective:** Capture a selected image with two deliberately placed calipers and explain measurement limitations.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                                  | Presentation / evidence    | Required action and decisions                          | Teaching                                                      |
| ---------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `capture:capture-context` — Choose the image before the measurement                | ultrasound / demonstration | read                                                   | foundation, worked                                            |
| `capture:plane-decision` — Explain the choice of plane                             | case / none                | questions; `capture-predict` [none]                    | Current task instruction; response reasoning after commitment |
| `capture:capture-frame` — Freeze, place calipers and save the frame                | ultrasound / live          | acquire (guided)                                       | Current task instruction; response reasoning after commitment |
| `capture:review-acquisition` — Inspect the capture record                          | ultrasound / held          | questions; `capture-observe-v2` [retained-acquisition] | takeaways                                                     |
| `capture:apply-another-situation` — Return to live guidance before needle movement | case / none                | questions; `capture-transfer` [none]                   | takeaways                                                     |

**Completion evidence:** knobology, capture. Action, readiness and actual-frame gates remain required.

**Representation limit:** These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

### ct-map — Translate the CT into a nodal map

**Status:** Redesigned using supported content.

**Objective:** Use anatomical boundaries to map a target across CT and airway views.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `atlas`, `iaslc9`.

| Activity identity                                                            | Presentation / evidence | Required action and decisions    | Teaching                                                      |
| ---------------------------------------------------------------------------- | ----------------------- | -------------------------------- | ------------------------------------------------------------- |
| `ct-map:regional-map` — Relate the target to its anatomical region           | regional / reference    | read                             | foundation                                                    |
| `ct-map:section-comparison` — Compare the model section and ultrasound plane | linked / demonstration  | read                             | worked                                                        |
| `ct-map:map-decision` — Identify the basis of a station assignment           | case / none             | questions; `map-predict` [none]  | Current task instruction; response reasoning after commitment |
| `ct-map:section-sweep` — Check landmarks and acquire a section               | linked / live           | acquire (guided)                 | Current task instruction; response reasoning after commitment |
| `ct-map:review-acquisition` — Explain the model and clinical CT distinction  | ultrasound / held       | questions; `map-observe` [none]  | takeaways                                                     |
| `ct-map:apply-another-situation` — Reconsider a target near a boundary       | case / none             | questions; `map-transfer` [none] | takeaways                                                     |

**Completion evidence:** simulator, scan, validated ct-map landmark/acquisition contract. Action, readiness and actual-frame gates remain required.

**Representation limit:** Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

### station-seven — Find station 7

**Status:** Redesigned using supported content.

**Objective:** Identify the subcarinal compartment and relate it to the two main bronchi.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `atlas`, `iaslc9`, `simulation`.

| Activity identity                                                      | Presentation / evidence | Required action and decisions                                | Teaching                                                      |
| ---------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `station-seven:subcarinal-region` — Locate the subcarinal region       | regional / reference    | read                                                         | foundation                                                    |
| `station-seven:assisted-window` — Compare the two bronchial approaches | linked / demonstration  | read                                                         | worked                                                        |
| `station-seven:station-decision` — Separate approach from station      | case / none             | questions; `seven-predict` [none]                            | Current task instruction; response reasoning after commitment |
| `station-seven:bronchial-sweeps` — Acquire both bronchial windows      | linked / live           | acquire (guided)                                             | Current task instruction; response reasoning after commitment |
| `station-seven:review-acquisition` — Interpret the acquired window     | ultrasound / held       | questions; `seven-observe` [retained-acquisition]            | takeaways                                                     |
| `station-seven:changed-position` — Compare another window              | ultrasound / live       | acquire (changed-window)                                     | Current task instruction; response reasoning after commitment |
| `station-seven:apply-another-situation` — Interpret the changed window | ultrasound / held       | questions; `seven-window-transfer-v2` [retained-acquisition] | takeaways                                                     |
| `station-seven:record-window` — Record what this window establishes    | record / held           | record (case-001-station-seven-window, station-window:v1)    | Current task instruction; response reasoning after commitment |

**Completion evidence:** simulator, scan, validated station-seven landmark/acquisition contract. Action, readiness and actual-frame gates remain required. The new case task must also be checked in this run; its versioned artifact is separate from historic lesson completion.

**Representation limit:** Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

**Case boundary:** Model evidence is not a complete station survey, a sample, a negative tissue result or live guidance after reload.

### right-paratracheal — Right paratracheal stations: 2R and 4R

**Status:** Redesigned using supported content.

**Objective:** Use vascular landmarks to distinguish right paratracheal levels.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `atlas`, `simulation`.

| Activity identity                                                                   | Presentation / evidence | Required action and decisions                                | Teaching                                                      |
| ----------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `right-paratracheal:right-region` — Locate the right paratracheal compartment       | regional / reference    | read                                                         | foundation                                                    |
| `right-paratracheal:right-landmarks` — Use the trachea, SVC and azygos relationship | linked / demonstration  | read                                                         | worked                                                        |
| `right-paratracheal:right-boundary` — Identify the relevant boundary                | case / none             | questions; `right-predict` [none]                            | Current task instruction; response reasoning after commitment |
| `right-paratracheal:right-sweep` — Acquire the right paratracheal window            | linked / live           | acquire (guided)                                             | Current task instruction; response reasoning after commitment |
| `right-paratracheal:review-acquisition` — Interpret the acquired compartment        | ultrasound / held       | questions; `right-observe` [retained-acquisition]            | takeaways                                                     |
| `right-paratracheal:right-changed` — Acquire a changed right paratracheal position  | ultrasound / live       | acquire (changed-window)                                     | Current task instruction; response reasoning after commitment |
| `right-paratracheal:apply-another-situation` — Compare the changed window           | ultrasound / held       | questions; `right-window-transfer-v2` [retained-acquisition] | takeaways                                                     |

**Completion evidence:** simulator, scan, validated right-paratracheal landmark/acquisition contract. Action, readiness and actual-frame gates remain required.

**Representation limit:** Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

### left-paratracheal — Left paratracheal stations: 2L and 4L

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Identify the left paratracheal window using the aortic arch and left pulmonary artery.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `atlas`, `ics2023`, `simulation`.

| Activity identity                                                                 | Presentation / evidence | Required action and decisions     | Teaching                                                      |
| --------------------------------------------------------------------------------- | ----------------------- | --------------------------------- | ------------------------------------------------------------- |
| `left-paratracheal:left-region` — Locate 4L beside its vascular landmarks         | regional / reference    | read                              | foundation, worked                                            |
| `left-paratracheal:left-boundary` — Distinguish the left-sided compartments       | case / none             | questions; `left-predict` [none]  | Current task instruction; response reasoning after commitment |
| `left-paratracheal:left-assisted` — Explore the supported 4L window               | regional / live         | acquire (guided)                  | Current task instruction; response reasoning after commitment |
| `left-paratracheal:left-relationships` — Interpret the vascular relationships     | regional / none         | questions; `left-observe` [none]  | takeaways                                                     |
| `left-paratracheal:apply-another-situation` — Consider a lateral subaortic target | case / none             | questions; `left-transfer` [none] | takeaways                                                     |

**Completion evidence:** simulator, scan. Action, readiness and actual-frame gates remain required.

**Representation limit:** Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

### hilar-interlobar — Hilar and interlobar stations

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Distinguish hilar from interlobar compartments using bronchial landmarks.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `atlas`, `iaslc9`.

| Activity identity                                                                   | Presentation / evidence | Required action and decisions                            | Teaching                                                      |
| ----------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `hilar-interlobar:bronchial-relations` — Locate targets by bronchial relationships  | regional / reference    | read                                                     | foundation, worked                                            |
| `hilar-interlobar:regional-identity` — Separate station anatomy from case side      | regional / none         | matching; `hilar-predict` [none], `hilar-observe` [none] | Current task instruction; response reasoning after commitment |
| `hilar-interlobar:apply-another-situation` — Apply the primary side to another case | case / none             | questions; `hilar-transfer` [none]                       | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions.

**Representation limit:** Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

### node-characterization — Describe the node without diagnosing the image

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Distinguish features that inform suspicion from findings that establish pathology.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `ers2026`.

| Activity identity                                                                              | Presentation / evidence | Required action and decisions                                      | Teaching                                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `node-characterization:description-evidence` — Describe the appearance before its implications | briefing / diagram      | read                                                               | foundation, worked                                            |
| `node-characterization:node-description` — Write a bounded node description                    | record / none           | record (written-node-description-v1, node-description:v1)          | Current task instruction; response reasoning after commitment |
| `node-characterization:description-reasoning` — Separate description from pathology            | case / none             | matching; `morphology-predict` [none], `morphology-observe` [none] | Current task instruction; response reasoning after commitment |
| `node-characterization:apply-another-situation` — Interpret a different morphology report      | case / none             | questions; `morphology-transfer` [none]                            | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions. The new case task must also be checked in this run; its versioned artifact is separate from historic lesson completion.

**Representation limit:** The reference image has no linked pathology result in this course. It must not be used as a labeled benign or malignant training example.

**Case boundary:** This is description and reasoning from supplied features, not a scored clinical-image recognition task. Any reference image is a separate example.

### systematic-staging — Systematic staging and TNM ninth edition

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Plan an ordered nodal examination and distinguish single- from multiple-station N2 disease.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ers2026`, `iaslc9`, `ics2023`.

| Activity identity                                                                  | Presentation / evidence | Required action and decisions                                | Teaching                                                      |
| ---------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `systematic-staging:staging-purpose` — Define the coverage needed for staging      | case / diagram          | read                                                         | foundation, worked                                            |
| `systematic-staging:case-plan` — Plan the examination for this primary side        | record / none           | record (left-lung-workup-v1, plan:v1)                        | Current task instruction; response reasoning after commitment |
| `systematic-staging:sampling-order` — Reconcile order with the examination plan    | case / none             | sequence; `staging-predict` [none], `staging-observe` [none] | Current task instruction; response reasoning after commitment |
| `systematic-staging:apply-another-situation` — Count stations and nodes separately | case / none             | questions; `staging-transfer` [none]                         | takeaways                                                     |

**Completion evidence:** The original action sequence plus all three safe-to-continue decisions. The new case task must also be checked in this run; its versioned artifact is separate from historic lesson completion.

**Representation limit:** The vignettes assume the stated primary side and complete station information. Full TNM grouping, resectability, and treatment require additional clinical data and multidisciplinary review.

**Case boundary:** The later examination and specimen findings are supplied fictional history. Your work records the plan and interprets that history; it does not perform a patient examination or generate tissue.

### eus-b — Where EUS-B complements EBUS

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Identify a target for which an esophageal approach may complement the airway examination.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ers2026`, `ics2023`.

| Activity identity                                                     | Presentation / evidence | Required action and decisions                        | Teaching                                                      |
| --------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `eus-b:complementary-route` — Identify what a second route can add    | regional / diagram      | read                                                 | foundation, worked                                            |
| `eus-b:route-coverage` — Match the route to the remaining question    | regional / none         | matching; `eus-predict` [none], `eus-observe` [none] | Current task instruction; response reasoning after commitment |
| `eus-b:apply-another-situation` — Identify an unresolved regional gap | case / none             | questions; `eus-transfer` [none]                     | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions.

**Representation limit:** This is an introduction to route selection. The course does not simulate esophageal insertion, adrenal assessment, or EUS-B needle technique.

### eus-b-route-model — Compare airway and esophageal windows

**Status:** Redesigned using supported content.

**Objective:** Compare two approaches to a fixed modeled target and identify gaps that an esophageal examination does not resolve.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 3 takeaways. Sources: `combined2015`, `atlas`, `simulation`.

| Activity identity                                                                       | Presentation / evidence | Required action and decisions                                                                        | Teaching                                                      |
| --------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `eus-b-route-model:route-orientation` — Compare the approach to the same target         | linked / demonstration  | read                                                                                                 | foundation, worked                                            |
| `eus-b-route-model:route-comparison` — Compare supported and unsupported locators       | linked / live           | acquire (guided)                                                                                     | Current task instruction; response reasoning after commitment |
| `eus-b-route-model:review-acquisition` — Explain the route comparison                   | linked / held           | questions; `route-model-predict-application-v2` [none], `route-model-observe` [retained-acquisition] | takeaways                                                     |
| `eus-b-route-model:apply-another-situation` — Preserve an unexamined region in the plan | case / none             | questions; `route-model-transfer` [none]                                                             | takeaways                                                     |

**Completion evidence:** model, model, package routes. Action, readiness and actual-frame gates remain required.

**Representation limit:** Same-frame anatomical orientation model with derived preset locators and one authored lower example. No clinical reachability, esophageal navigation, acoustic image or puncture safety is simulated.

### needle-safety — Needle safety and the sampling sequence

**Status:** Redesigned using supported content.

**Objective:** Identify the safety checks that precede and follow a needle pass.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`.

| Activity identity                                                               | Presentation / evidence | Required action and decisions                              | Teaching                                                      |
| ------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `needle-safety:sampling-states` — Follow the sampling sequence                  | sampling / diagram      | read                                                       | foundation, worked                                            |
| `needle-safety:safe-sequence` — Link needle actions to current guidance         | sampling / none         | sequence; `needle-predict` [none], `needle-observe` [none] | Current task instruction; response reasoning after commitment |
| `needle-safety:apply-another-situation` — Respond when the tip leaves the image | case / none             | questions; `needle-transfer` [none]                        | takeaways                                                     |

**Completion evidence:** The original action sequence plus all three safe-to-continue decisions.

**Representation limit:** This activity teaches safety checkpoints without simulated needle passage. Exact handling, stops, extensions, and sampling motions must follow the current device IFU and supervised instruction.

### needle-assembly-model — Needle assembly and live-tip visibility

**Status:** Redesigned using supported content.

**Objective:** Distinguish sheath movement from needle exposure and stop advancement when live tip guidance is lost.

**Teaching preserved:** 2 paragraphs, 3 checklist entries, recall, worked context/reasoning, 3 takeaways. Sources: `ics2023`, `simulation`.

| Activity identity                                                                      | Presentation / evidence | Required action and decisions                                                                  | Teaching                                                      |
| -------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `needle-assembly-model:needle-components` — Relate sheath, needle, stylet and outlet   | linked / demonstration  | read                                                                                           | foundation, worked                                            |
| `needle-assembly-model:needle-states` — Practice the supported assembly states         | sampling / live         | acquire (guided)                                                                               | Current task instruction; response reasoning after commitment |
| `needle-assembly-model:review-acquisition` — Interpret the live-tip limitation         | sampling / held         | questions; `assembly-predict-application-v2` [none], `assembly-observe` [retained-acquisition] | takeaways                                                     |
| `needle-assembly-model:apply-another-situation` — Recover when live visibility is lost | case / none             | questions; `assembly-transfer` [none]                                                          | takeaways                                                     |

**Completion evidence:** model, model, package needle. Action, readiness and actual-frame gates remain required.

**Representation limit:** Generic mechanical and imaging-plane illustration. No patient tissue mechanics, device dimensions, force, sampling yield or clinically validated puncture trajectory is modeled.

### adequacy-rose — Adequacy, passes, and ROSE

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Distinguish a useful on-site assessment from final diagnosis and assay adequacy.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `chest2024`, `ics2023`.

| Activity identity                                                                             | Presentation / evidence | Required action and decisions                          | Teaching                                                      |
| --------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `adequacy-rose:adequacy-endpoints` — Separate representation, diagnosis and study suitability | sampling / diagram      | read                                                   | foundation, worked                                            |
| `adequacy-rose:specimen-evidence` — Reconcile the written ROSE communication                  | record / none           | record (left-lung-workup-v1, adequacy:v1)              | Current task instruction; response reasoning after commitment |
| `adequacy-rose:adequacy-reasoning` — Identify which endpoint remains unresolved               | sampling / none         | matching; `rose-predict` [none], `rose-observe` [none] | Current task instruction; response reasoning after commitment |
| `adequacy-rose:apply-another-situation` — Plan when ROSE is unavailable                       | case / none             | questions; `rose-transfer` [none]                      | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions. The new case task must also be checked in this run; its versioned artifact is separate from historic lesson completion.

**Representation limit:** The numeric pass and gauge guidance is from CHEST 2024 for the stated malignancy context. Local laboratory requirements and patient safety govern the individual acquisition plan.

**Case boundary:** The later examination and specimen findings are supplied fictional history. Your work records the plan and interprets that history; it does not perform a patient examination or generate tissue.

### specimen-triage — Specimen triage and traceability

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Choose handling plans that preserve the requested diagnostic options.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `chest2024`, `ics2023`, `ats2020`.

| Activity identity                                                                         | Presentation / evidence | Required action and decisions                              | Teaching                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `specimen-triage:specimen-request` — Connect each specimen to the requested studies       | sampling / diagram      | read                                                       | foundation, worked                                            |
| `specimen-triage:allocation-plan` — Allocate the case specimens                           | record / none           | record (left-lung-workup-v1, allocation:v1)                | Current task instruction; response reasoning after commitment |
| `specimen-triage:traceability` — Preserve the source through processing                   | sampling / none         | matching; `triage-predict` [none], `triage-observe` [none] | Current task instruction; response reasoning after commitment |
| `specimen-triage:apply-another-situation` — Resolve an unspecified laboratory requirement | case / none             | questions; `triage-transfer` [none]                        | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions. The new case task must also be checked in this run; its versioned artifact is separate from historic lesson completion.

**Representation limit:** No universal transport medium or specimen quantity is specified. Use the receiving laboratory’s instructions and supervised clinical judgment.

**Case boundary:** The later examination and specimen findings are supplied fictional history. Your work records the plan and interprets that history; it does not perform a patient examination or generate tissue.

### difficult-acquisition — Troubleshoot a difficult acquisition

**Status:** Redesigned using supported content.

**Objective:** Choose the acquisition problem to correct before escalating needle attempts.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`, `ers2026`.

| Activity identity                                                                           | Presentation / evidence | Required action and decisions                                      | Teaching                                                      |
| ------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `difficult-acquisition:acquisition-problem` — Classify the problem before changing controls | case / diagram          | read                                                               | foundation, worked                                            |
| `difficult-acquisition:problem-action` — Choose the first response to each problem          | case / none             | matching; `difficulty-predict` [none], `difficulty-observe` [none] | Current task instruction; response reasoning after commitment |
| `difficult-acquisition:apply-another-situation` — Recognize the limit of the current window | case / none             | questions; `difficulty-transfer` [none]                            | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions.

**Representation limit:** Troubleshooting examples omit patient physiology and do not simulate rescue treatment or advanced sampling techniques.

### complications-recovery — Recognize complications and plan recovery

**Status:** Redesigned using supported content.

**Objective:** Identify deterioration that requires stopping acquisition and prompt team assessment.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ics2023`.

| Activity identity                                                                                 | Presentation / evidence | Required action and decisions                                  | Teaching                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `complications-recovery:patient-response` — Respond to the patient and communicate the limitation | case / diagram          | read                                                           | foundation, worked                                            |
| `complications-recovery:recovery-sequence` — Prioritize the patient during deterioration          | case / none             | sequence; `recovery-predict` [none], `recovery-observe` [none] | Current task instruction; response reasoning after commitment |
| `complications-recovery:apply-another-situation` — Plan recovery and escalation                   | case / none             | questions; `recovery-transfer` [none]                          | takeaways                                                     |

**Completion evidence:** The original action sequence plus all three safe-to-continue decisions.

**Representation limit:** This lesson is not an emergency treatment algorithm. Medication, hemostasis, airway rescue, monitoring, and discharge decisions follow current local protocols and responsible clinicians.

### results-reporting — Interpret the result and close the loop

**Status:** Redesigned with an explicitly bounded reference/cognitive task.

**Objective:** Distinguish negative representative sampling from an uninformative or incomplete examination.

**Teaching preserved:** 3 paragraphs, 3 checklist entries, recall, worked context/reasoning, 2 takeaways. Sources: `ers2026`, `ics2023`.

| Activity identity                                                                    | Presentation / evidence | Required action and decisions                              | Teaching                                                      |
| ------------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `results-reporting:report-evidence` — Build the conclusion from the evidence         | record / diagram        | read                                                       | foundation, worked                                            |
| `results-reporting:reconciled-report` — Construct the case report                    | record / none           | record (left-lung-workup-v1, report:v1)                    | Current task instruction; response reasoning after commitment |
| `results-reporting:result-meaning` — Reconcile the result with the clinical question | case / none             | matching; `result-predict` [none], `result-observe` [none] | Current task instruction; response reasoning after commitment |
| `results-reporting:apply-another-situation` — Close the loop on unresolved findings  | case / none             | questions; `result-transfer` [none]                        | takeaways                                                     |

**Completion evidence:** The original matching distinctions plus all three safe-to-continue decisions. The new case task must also be checked in this run; its versioned artifact is separate from historic lesson completion.

**Representation limit:** The case statements are authored examples. An individual next step requires the full clinical and pathological context.

**Case boundary:** The later examination and specimen findings are supplied fictional history. Your work records the plan and interprets that history; it does not perform a patient examination or generate tissue.

## Historical item identities

Retained source objects for changed image/application items:

- `contact-observe`: What changed when the scan window returned?
- `depth-observe`: When depth was reduced in this clip set, why did the target occupy more of the screen?
- `gain-observe`: Why should morphology be interpreted after image optimization?
- `doppler-observe`: What does the color-flow recording add to the gray-scale image?
- `capture-observe`: What has your saved frame demonstrated in this exercise?
- `cutaway-predict`: An air gap is present. Which adjustment can restore the acoustic path?
- `phantom-predict`: A fixed phantom looks smaller after the plane is moved. What is the most direct explanation?
- `route-model-predict`: The same station 7 node is viewed from the esophagus. What changes?
- `assembly-predict`: A needle-like line remains after the imaging plane changes. What must be established before further advancement?

The unchanged first-response store preserves these keys, including wrong first choices. Coached case keys use `<case>-coached-v1:<question>`; independent practice and assessment retain their existing keys. Case-record first submissions are immutable under case/content/task versions. Source-window/session guards still govern live work.

## Remaining review dependencies

No new clinical-image bank, expert border/axis truth, pathology gallery, 4R/10R contrast, additional anatomy, device-specific mechanics or faculty approval is claimed. See [the implementation review](flow-redesign-review.md) for exact validation, visual evidence, provenance and remaining owner/faculty work.
