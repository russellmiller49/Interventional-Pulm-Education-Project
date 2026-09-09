# Peripheral bronchoscopy imaging — curriculum and model contract

Authoring date: 2026-09-08. Replaces the learner-facing FluoroView route at /fluoroview.

## Scope and instructional design

Learners: pulmonary and IP fellows with basic CT anatomy and bronchoscopy knowledge; technologists and suite staff can use the same fundamentals. Desktop or tablet for labs, phone for review; short resumable units. Intended level: Miller knows how (Bloom apply/analyze), not procedural competence. Supervised C-arm operation, anesthesia, radiation credentialing and biopsy training remain necessary.

Need: the former front door was a large simulator with four objectives and no ordered curriculum, retrieval schedule or completion contract. No relevant learner analytics were found. The redesign uses the medical-education-modules skill (Kern, Gagné, cognitive load, worked-to-independent practice) and the repository education skill. Content types: device physics, procedural timeline and systematic image interpretation.

Spine: plan current anatomy → acquire the missing information → verify lesion and actual sampling component → reassess after change → record exposure and outcome. One lesson registry supplies pathway, titles, counts, minutes and next-incomplete navigation.

Objectives and alignment:

| ID       | Discrimination (apply/analyze; knows how)                                            | Lessons                                             | Checks                                        |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------- |
| choose   | Select imaging for the question and distinguish navigation, lesion and tool evidence | imaging-questions, current-anatomy, two-dimensional | choose-1, anatomy-1, workflow-1; case-1       |
| optimize | Distinguish projection, contrast, field, sampling and temporal problems              | projection, signal, field, time                     | geometry-1, signal-1, field-1, time-1; case-2 |
| dts      | Interpret limited-angle measurements and prior-informed reconstruction               | dts-acquisition, dts-interpretation                 | dts-1, prior-1; case-3                        |
| cbct     | Plan an acquisition and distinguish fixed/mobile workflow constraints                | cbct-acquisition, fixed-suite, mobile-suite         | acquisition-1, fixed-1, mobile-1; case-4      |
| verify   | Assess the actual sampling component and the validity of its acquisition state       | tool-confirmation, changing-anatomy                 | tool-1, change-1; case-5, case-6              |
| protect  | Select staff protection and interpret patient dose indices                           | staff-protection, dose-reporting                    | safety-1, dose-1; case-7, case-8              |

Every lesson has one primary concept, an explicit prerequisite list, recall, cited teaching blocks, a worked example, a committed check with option-specific feedback, takeaways and a named next destination. The data file carries the individual lesson specs: outcome, concept, prerequisites, clinical question (why), worked reasoning, model activity, checks and source provenance. Check records carry the wrong mental models as option rationales and a harmful-reflex flag for safety-critical cases. All stems are authored teaching scenarios. Checks occupy a separate screen: no teaching, takeaways or interpreted image findings beside a pending item.

## Stage ladder and retrieval

| Stage       | Lessons in canonical order          | Single increment / scaffold                                         | Minutes |
| ----------- | ----------------------------------- | ------------------------------------------------------------------- | ------- |
| Orientation | imaging-questions                   | Information question / worked                                       | 4       |
| Foundation  | current-anatomy, projection         | Map timestamp; projection depth / worked + lab                      | 5, 6    |
| Mechanism   | signal, field, time                 | Signal budget; acquired field; measured time / worked + lab         | 5, 6, 6 |
| Application | two-dimensional                     | Integrates prior 2D concepts / guided                               | 5       |
| Mechanism   | dts-acquisition, dts-interpretation | Limited angles; reconstruction provenance / worked + lab            | 6, 5    |
| Mechanism   | cbct-acquisition                    | Volume acquisition / guided lab                                     | 6       |
| Application | fixed-suite, mobile-suite           | Suite-specific application of acquisition requirements / completion | 4, 4    |
| Application | tool-confirmation, changing-anatomy | Sampling window; validity after change / guided → independent       | 7, 6    |
| Mechanism   | staff-protection, dose-reporting    | Scatter protection; dose quantities / worked + lab                  | 5, 6    |
| Practice    | suite-cases                         | Interleaves existing concepts, no new mechanisms / independent      | 12      |

Each unit after the first includes explicit retrieval of an earlier concept in its recall prompt and a second check drawn from an earlier lesson. Repeated items have separate lesson-scoped attempt keys; a correct prior response cannot silently complete a later unit. The capstone uses eight different surface situations and retains first decisions. Review is always available; no unsupported test-out or competence label. Deviations: no placement pretest (narrow fellow audience; free browsing supports experienced users); stage order returns to mechanism when a new modality is introduced, explicitly named in navigation. Multi-control lessons field/time use one common concept with deeper physics in optional disclosure. Authored estimates require learner piloting.

Completion: all lesson questions committed and their debrief reviewed. Completion can include errors and is labeled Complete / review needed. First-attempt accuracy is immutable within the current saved learning record. No mastery claim. Capstone passed only if at least 7/8 correct AND every safety-critical item correct; otherwise review needed. Changing controls alone never completes a lesson. Reset is explicit and clears only this course after confirmation. Lab controls, phase and last lesson persist locally; unavailable storage is reported. Required progress is never attributed to hands-on competence.

## One decision aid

The imaging decision guide is defined once in data/resources.ts and reused as a reference. Decision panel: geometry, acquisition field, temporal sampling, information source, reassessment. The guide links to relevant lesson ids.

## Models and numbers

All scene geometry, control ranges, slice positions, timing examples and synthetic image appearances are authored for teaching on 2026-09-08. No patient-derived anatomy or copied media. Procedural 3D chest/airway, source/detector C-arm, fixed support, mobile base, needle/window, shield and staff meshes are original code assets. Reuse installed Three.js/R3F: user explicitly requests built 3D models and the repo already depends on them, so no new heavy dependency is justified.

Coordinate convention: model x = patient left, y = anterior, z = superior. Projection lab uses parallel rays; obliquity/tilt are model rotations, not unverified console direction rules. Geometry is schematic, not an attenuation ray tracer. DTS is a shift-and-add illustration of plane-selective superposition, not a vendor reconstruction. MPR is analytic slicing of the same spherical lesion and fictional needle side window; it cannot predict safety or diagnostic yield. Acquisition lab is a checklist/state exercise, not a collision detector. All lab angles and tolerances are authored rather than recommended acquisition settings. 3D can be orbited with a pointer and reset to named views using keyboard buttons; SVG and text results provide alternatives without WebGL.

Dose lab computes KAP = kerma × area with authored inputs and explicit units, not skin dose. Temporal lab computes mAs/s and ideal motion displacement at fixed energy/geometry; never labels this patient dose. Inverse-square illustration holds output fixed and treats scatter as a point source; no physical shield attenuation or safe-distance prediction. Numeric clinical recommendations are deferred to current IFU/local protocol. No universal apnea duration, pressure/PEEP target, occupational limit table or scan-count ceiling is taught. No measured instrument safety margin is inferred from the 3D models.

## Evidence and review

The user's Peripheral_Bronchoscopy_Imaging_Knowledge_Document_v2.md is a synthesis used as source material, not operational instructions. Clinical claims are mapped to published papers, professional reports and guidelines in sources.ts. No video, transcript or manufacturer marketing references appear in the learner module. Exact study yields are not used as a device ranking. Current abstracts and accessible full text are checked where available; limitations are visible per source. All rewritten clinical prose is independently authored from the supplied synthesis and cited published materials. Reference metadata checked 2026-09-08.

Verification: pure projection/analytic geometry, pulse-output/dose-unit arithmetic, prerequisite closure, source ids and progress validation; UI commit boundary, immutable attempts, critical-error pass block and reload/resume; responsive browser inspection and keyboard/accessibility checks; repo lint, type check, test and build. Review rubric and cueing audit run as separate passes. No deployment or clinical validation claimed.

Evaluation after release: pilot with 3–5 fellows and a technologist using start, resume, change controls, finish, and locate-term tasks. Collect consented time estimates, first-attempt errors and drop-off using the site's future analytics policy; no new tracking is introduced. Review retention with mixed cases at a later teaching session. This is a post-release proposal, not a claim that a pilot occurred.
