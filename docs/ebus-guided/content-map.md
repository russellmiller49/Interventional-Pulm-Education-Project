# EBUS guided course — content map

Authoring snapshot of the canonical TypeScript curriculum. Runtime order, counts and navigation come from `src/features/ebus-guided/content/curriculum.ts`; this document is a review aid, not a second registry.

The intended learner has basic flexible-bronchoscopy and chest-CT knowledge. The course assesses knowledge and clinical reasoning (Miller: knows / knows how). Guided controls rehearse selected acquisition actions, without certifying procedural performance. Suggested order supplies scaffolding; individual lesson links remain available for targeted review. The prerequisite reminder is shown at the start of every lesson.

Each lesson includes orientation → worked example → prediction → activity → observation → explanation → changed-context transfer. Retrieval returns in final cases and optional later-day practice. Times below are estimates requiring learner piloting.

| Order | Lesson / topic                                        | Minutes | Required activity          | Sources                     |
| ----- | ----------------------------------------------------- | ------- | -------------------------- | --------------------------- |
| 1     | Define the clinical question (Prepare)                | 6       | Match findings and actions | ers2026, chest2024, ics2023 |
| 2     | Preparation and the airway plan (Prepare)             | 7       | Reconstruct a sequence     | ics2023                     |
| 3     | Scope orientation and the imaging plane (Prepare)     | 8       | Scope/anatomy lab          | ics2023, simulation         |
| 4     | Acoustic contact and coupling (Prepare)               | 8       | Scope/anatomy lab          | ics2023, simulation         |
| 5     | Choose an appropriate image depth (Optimize)          | 7       | Recorded ultrasound lab    | ics2023, simulation         |
| 6     | Gain, contrast, and tissue detail (Optimize)          | 7       | Recorded ultrasound lab    | ics2023, simulation         |
| 7     | Doppler and the intended needle path (Optimize)       | 7       | Recorded ultrasound lab    | ics2023, simulation         |
| 8     | Freeze, measure, and document the image (Optimize)    | 8       | Recorded ultrasound lab    | ics2023, simulation         |
| 9     | Translate the CT into a nodal map (Locate)            | 7       | Match findings and actions | atlas, iaslc9               |
| 10    | Find station 7 (Locate)                               | 8       | Scope/anatomy lab          | atlas, iaslc9, simulation   |
| 11    | Right paratracheal stations: 2R and 4R (Locate)       | 8       | Scope/anatomy lab          | atlas, simulation           |
| 12    | Left paratracheal stations: 2L and 4L (Locate)        | 8       | Scope/anatomy lab          | atlas, ics2023, simulation  |
| 13    | Hilar and interlobar stations (Locate)                | 7       | Match findings and actions | atlas, iaslc9               |
| 14    | Describe the node without diagnosing the image (Plan) | 6       | Match findings and actions | ics2023, ers2026            |
| 15    | Systematic staging and TNM ninth edition (Plan)       | 9       | Reconstruct a sequence     | ers2026, iaslc9, ics2023    |
| 16    | Where EUS-B complements EBUS (Plan)                   | 7       | Match findings and actions | ers2026, ics2023            |
| 17    | Needle safety and the sampling sequence (Sample)      | 8       | Reconstruct a sequence     | ics2023                     |
| 18    | Adequacy, passes, and ROSE (Sample)                   | 7       | Match findings and actions | chest2024, ics2023          |
| 19    | Specimen triage and traceability (Sample)             | 7       | Match findings and actions | chest2024, ics2023, ats2020 |
| 20    | Troubleshoot a difficult acquisition (Complete)       | 7       | Match findings and actions | ics2023, ers2026            |
| 21    | Recognize complications and plan recovery (Complete)  | 7       | Reconstruct a sequence     | ics2023                     |
| 22    | Interpret the result and close the loop (Complete)    | 8       | Match findings and actions | ers2026, ics2023            |

## 1. Define the clinical question

- Stable ID: `clinical-question`.
- Objective: Distinguish a diagnostic target from a complete nodal staging examination.
- Prerequisite recall: Review axial chest CT orientation and the major airway bifurcations before starting this course.
- Learning act: Match each clinical request with its immediate information need.
- Transfer: For isolated adenopathy, lymphoma and granulomatous disease are both being considered. What should be discussed before sampling?
- Model/procedural boundary: The course teaches procedural reasoning. It does not choose a diagnostic pathway for an individual patient.

## 2. Preparation and the airway plan

- Stable ID: `preparation`.
- Objective: Identify unresolved preparation issues that should pause an elective EBUS procedure.
- Prerequisite recall: The clinical question and likely specimen requirements should already be defined.
- Learning act: Order the preparation dependencies for this elective procedure.
- Transfer: A planned airway conduit may be too narrow for the EBUS scope while maintaining ventilation. Which issue needs resolution?
- Model/procedural boundary: Drug holds, fasting intervals, airway devices, and sedative doses must follow current local guidance and the responsible clinical team.

## 3. Scope orientation and the imaging plane

- Stable ID: `scope-orientation`.
- Objective: Relate scope rotation to a change in the ultrasound plane.
- Prerequisite recall: A linear EBUS transducer lies on one side of the distal scope.
- Learning act: Use Scope rotation to sweep through the rounded target. Compare Ultrasound with Anatomy and Bronchoscopy, then return to Ultrasound. Stop with the target visible in the sector.
- Transfer: A target looks smaller after a slight sweep while the depth setting is unchanged. What should you check before recording its size?
- Model/procedural boundary: One calibrated anatomy model is used. Scope assists, limited degrees of freedom, and synthetic echoes do not reproduce hands-on navigation.

## 4. Acoustic contact and coupling

- Stable ID: `acoustic-contact`.
- Objective: Distinguish loss of acoustic contact from an image-brightness problem.
- Prerequisite recall: The transducer is on one side of the distal scope. Rotating the scope changes which airway wall it faces.
- Learning act: Start with the transducer in the airway lumen. Gently increase Tip flexion and compare the ultrasound image with the initial poorly coupled sector. Use the Bronchoscopy view to inspect the tip relationship to the airway wall. Return to Ultrasound and stop when tissue echoes appear.
- Transfer: At another station the airway wall remains in view, but the ultrasound sector becomes dark after withdrawing slightly. What is the next acquisition check?
- Model/procedural boundary: The grayscale image is simulated from one anatomy model. Contact quality is an authored model index; it is not a measured pressure or a clinical safety threshold.

## 5. Choose an appropriate image depth

- Stable ID: `image-depth`.
- Objective: Adjust depth to display the target and tissue immediately beyond it.
- Prerequisite recall: Establish acoustic contact before optimizing the displayed image.
- Learning act: Move Image depth from 8 cm toward a view that includes the full target with less unused depth. Compare the 3 cm and 4 cm recordings and stop on either of those views.
- Transfer: At a different station, reducing depth removes a vessel just beyond the node from view. What should you do before planning a path?
- Model/procedural boundary: These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

## 6. Gain, contrast, and tissue detail

- Stable ID: `gain-contrast`.
- Objective: Distinguish a brightness adjustment from a change in tissue characteristics.
- Prerequisite recall: Depth sets the displayed field; gain acts on echoes within that field.
- Learning act: Reduce Image gain from level 8 and compare the nodal border and internal echoes. Explore Image contrast separately, then return to Image gain and stop at level 4 or 5 for this teaching example.
- Transfer: The sector turns dark when the transducer leaves the wall, although the prior gain level is unchanged. Which action comes first?
- Model/procedural boundary: These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

## 7. Doppler and the intended needle path

- Stable ID: `doppler`.
- Objective: Use Doppler as part of a vascular-path assessment without treating absent color as proof of safety.
- Prerequisite recall: A dark structure on gray-scale ultrasound may represent fluid, vessel lumen, or another low-echo structure.
- Learning act: Compare the gray-scale recording with Color Doppler. Activate Color Doppler and inspect where flow is displayed relative to the surrounding structures.
- Transfer: No color is seen in a structure that remains anatomically suspicious for a vessel. What is appropriate?
- Model/procedural boundary: These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

## 8. Freeze, measure, and document the image

- Stable ID: `capture`.
- Objective: Capture a selected image with two deliberately placed calipers and explain measurement limitations.
- Prerequisite recall: A change in the imaging plane can change apparent dimensions.
- Learning act: Freeze image, choose Measure, move the first marker, and select Set first caliper. Move the second marker to a distinct position, then Save image. Inspect your captured frame. This practices controls; border placement is not scored as a clinical measurement.
- Transfer: During real EBUS, an operator is ready to insert a needle while the image remains frozen. What is required?
- Model/procedural boundary: These controls select existing recorded ultrasound examples. Levels are specific to this teaching library, not recommended processor settings for patients.

## 9. Translate the CT into a nodal map

- Stable ID: `ct-map`.
- Objective: Use anatomical boundaries to map a target across CT and airway views.
- Prerequisite recall: The carina divides the trachea into the main bronchi. A rotated ultrasound sector is a different view of the same anatomy.
- Learning act: Match each source of information with the question it answers best.
- Transfer: Two similarly shaped nodes lie on opposite sides of a station boundary. How should samples be labeled?
- Model/procedural boundary: Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

## 10. Find station 7

- Stable ID: `station-seven`.
- Objective: Identify the subcarinal compartment and relate it to the two main bronchi.
- Prerequisite recall: The medial space between the main bronchi differs from the lateral hilar compartments.
- Learning act: Review the subcarinal relationship in Anatomy and Bronchoscopy. In Ultrasound, use Scope rotation to bring the rounded target into the sector and keep its borders visible.
- Transfer: The main bronchi are visible on CT. A node lies lateral to the right main bronchus rather than between the bronchi. What should you reconsider?
- Model/procedural boundary: Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

## 11. Right paratracheal stations: 2R and 4R

- Stable ID: `right-paratracheal`.
- Objective: Use vascular landmarks to distinguish right paratracheal levels.
- Prerequisite recall: The IASLC map uses compartment boundaries that may not match the tracheal midline.
- Learning act: At the assisted right paratracheal start, compare Anatomy with Ultrasound. Sweep Scope rotation until the target appears. Identify nearby vascular structures in the anatomical view before returning to the ultrasound sector.
- Transfer: A target anterior to the trachea is just right of the left lateral tracheal wall and lies within the lower paratracheal level. Which map principle applies?
- Model/procedural boundary: Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

## 12. Left paratracheal stations: 2L and 4L

- Stable ID: `left-paratracheal`.
- Objective: Identify the left paratracheal window using the aortic arch and left pulmonary artery.
- Prerequisite recall: The side boundary of stations 2 and 4 follows the left lateral tracheal wall.
- Learning act: Use Anatomy to inspect the left paratracheal target and adjacent vessels. Return to Ultrasound and adjust Scope rotation to bring the target into the sector. This is an assisted scan, not an access or needle simulation.
- Transfer: A PET-avid subaortic node is lateral to the ligamentum arteriosum. What is the best interpretation?
- Model/procedural boundary: Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

## 13. Hilar and interlobar stations

- Stable ID: `hilar-interlobar`.
- Objective: Distinguish hilar from interlobar compartments using bronchial landmarks.
- Prerequisite recall: Medial subcarinal nodes remain station 7; mainstem adjacency alone is insufficient.
- Learning act: Match the bronchial relationship with the station.
- Transfer: A malignant 11L node is found in a patient with a left lung primary. What nodal category does that involvement represent?
- Model/procedural boundary: Station names follow anatomical boundaries, not the apparent shape of a single node. The teaching library contains representative views; the 3D model assists position and does not establish independent station-identification competence.

## 14. Describe the node without diagnosing the image

- Stable ID: `node-characterization`.
- Objective: Distinguish features that inform suspicion from findings that establish pathology.
- Prerequisite recall: Gain, contrast, plane, and contact influence the displayed appearance.
- Learning act: Separate the observation from the information that still requires tissue.
- Transfer: A PET-negative node is visible during indicated systematic mediastinal staging. Should its bland appearance alone exclude it from the sampling plan?
- Model/procedural boundary: The reference image has no linked pathology result in this course. It must not be used as a labeled benign or malignant training example.

## 15. Systematic staging and TNM ninth edition

- Stable ID: `systematic-staging`.
- Objective: Plan an ordered nodal examination and distinguish single- from multiple-station N2 disease.
- Prerequisite recall: Station identity comes from anatomy; the primary tumor side determines whether many stations are ipsilateral or contralateral.
- Learning act: For a left lung primary with targets at 4R, 7, and 11L, order their sampling from highest to lowest N category.
- Transfer: In a right lung cancer, malignancy is confirmed in two nodes within 4R and nowhere else after staging. Which ninth-edition N2 subdivision fits the known distribution?
- Model/procedural boundary: The vignettes assume the stated primary side and complete station information. Full TNM grouping, resectability, and treatment require additional clinical data and multidisciplinary review.

## 16. Where EUS-B complements EBUS

- Stable ID: `eus-b`.
- Objective: Identify a target for which an esophageal approach may complement the airway examination.
- Prerequisite recall: The airway route provides useful access to paratracheal, subcarinal, hilar, and interlobar stations.
- Learning act: Match the access problem to the appropriate planning principle.
- Transfer: A 4L target remains difficult to assess because an airway window is unstable. What is a reasonable next discussion?
- Model/procedural boundary: This is an introduction to route selection. The course does not simulate esophageal insertion, adrenal assessment, or EUS-B needle technique.

## 17. Needle safety and the sampling sequence

- Stable ID: `needle-safety`.
- Objective: Identify the safety checks that precede and follow a needle pass.
- Prerequisite recall: The target station, stable acoustic window, and vascular path should be established before sampling.
- Learning act: Order the broad safety checkpoints around a pass. Device-specific manipulations follow the current IFU.
- Transfer: A densely calcified target resists needle entry. Which response is appropriate?
- Model/procedural boundary: This activity teaches safety checkpoints without simulated needle passage. Exact handling, stops, extensions, and sampling motions must follow the current device IFU and supervised instruction.

## 18. Adequacy, passes, and ROSE

- Stable ID: `adequacy-rose`.
- Objective: Distinguish a useful on-site assessment from final diagnosis and assay adequacy.
- Prerequisite recall: The sampling plan includes both a clinical question and specimen-testing requirements.
- Learning act: Match each statement with the information it provides.
- Transfer: ROSE is unavailable for a planned EBUS procedure. What should the team do?
- Model/procedural boundary: The numeric pass and gauge guidance is from CHEST 2024 for the stated malignancy context. Local laboratory requirements and patient safety govern the individual acquisition plan.

## 19. Specimen triage and traceability

- Stable ID: `specimen-triage`.
- Objective: Choose handling plans that preserve the requested diagnostic options.
- Prerequisite recall: The most useful tissue can become unusable for a planned assay if it is placed in the wrong medium.
- Learning act: Match each requested study with its planning requirement.
- Transfer: Granulomas are found in a node, but infection remains plausible and no microbiology was sent. What should the result discussion acknowledge?
- Model/procedural boundary: No universal transport medium or specimen quantity is specified. Use the receiving laboratory’s instructions and supervised clinical judgment.

## 20. Troubleshoot a difficult acquisition

- Stable ID: `difficult-acquisition`.
- Objective: Choose the acquisition problem to correct before escalating needle attempts.
- Prerequisite recall: Contact, depth, gain, vascular assessment, and tip visibility are separate checks.
- Learning act: Match each observed problem to the check it calls for.
- Transfer: A target remains behind an interposed vessel after several attempts to improve the window. What is the next step?
- Model/procedural boundary: Troubleshooting examples omit patient physiology and do not simulate rescue treatment or advanced sampling techniques.

## 21. Recognize complications and plan recovery

- Stable ID: `complications-recovery`.
- Objective: Identify deterioration that requires stopping acquisition and prompt team assessment.
- Prerequisite recall: A tissue target never takes priority over a deteriorating patient.
- Learning act: Order the broad response priorities to procedural deterioration.
- Transfer: A patient reports fever and worsening chest discomfort after discharge following EBUS. What should the discharge plan support?
- Model/procedural boundary: This lesson is not an emergency treatment algorithm. Medication, hemostasis, airway rescue, monitoring, and discharge decisions follow current local protocols and responsible clinicians.

## 22. Interpret the result and close the loop

- Stable ID: `results-reporting`.
- Objective: Distinguish negative representative sampling from an uninformative or incomplete examination.
- Prerequisite recall: The report must preserve station identity, acquisition quality, and the question the examination was intended to answer.
- Learning act: Match each result statement to its appropriate limitation.
- Transfer: A complete, representative systematic endosonographic staging examination is negative. What does the 2026 ERS/ESGE/ESTS recommendation say about routine add-on mediastinoscopy?
- Model/procedural boundary: The case statements are authored examples. An individual next step requires the full clinical and pathological context.

## Final-case blueprint

Cases unlock when every required lesson is completed. Each has three decisions and an acknowledged debrief, with immediate unsafe-choice feedback and otherwise delayed correctness. Results recommend topic review; they do not apply a pass mark.

| Case                                          | Topic    | Lesson targets                                            |
| --------------------------------------------- | -------- | --------------------------------------------------------- |
| Before the first examination                  | Prepare  | clinical-question, preparation                            |
| An image changes during the examination       | Optimize | acoustic-contact, image-depth, doppler                    |
| Reconcile the station labels                  | Locate   | right-paratracheal, hilar-interlobar, systematic-staging  |
| A target remains unassessed                   | Plan     | left-paratracheal, eus-b, difficult-acquisition           |
| Preserve the distribution of disease          | Plan     | systematic-staging, specimen-triage                       |
| During tissue acquisition                     | Sample   | needle-safety, adequacy-rose, capture                     |
| An unresolved cause of adenopathy             | Sample   | specimen-triage, node-characterization, results-reporting |
| Finish the examination and follow the results | Complete | complications-recovery, results-reporting                 |

Clinical references and validation limits are recorded in [review.md](review.md). Source labels resolve through [sources.ts](../../src/features/ebus-guided/content/sources.ts).
