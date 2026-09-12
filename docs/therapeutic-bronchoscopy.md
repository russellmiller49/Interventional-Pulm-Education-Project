# Therapeutic bronchoscopy — instrument prototype

## Delivered boundary

Owner request (11 September 2026): create a separate module using the Synchronized Airway Anatomy assets; add instruments for biopsy and tumor debulking, using the owner-authored review and supplied videos. The module is an unlisted admin preview at `/en/admin/therapeutic-bronchoscopy`. Its Overview, Learn, Practice and Assess views use the `mode` query; `lesson=forceps|cryoprobe|snare` opens a guided lesson. The existing `/en/learn/anatomy/airway` implementation is restored to the pre-abnormalities baseline `7da3886e`. No global navigation, authentication, release catalog, database, source CT or reviewed airway mesh is changed.

The three original Blender abnormality GLBs remain independent of the source airway. Forceps, cryoprobe and snare are articulated Three.js meshes, with physical placement in patient LPS millimetres. The thermal-ablation module contains a standalone canvas application rather than reusable 3D tool assets; this module links its principles and uses blue cryo/yellow energy controls.

## What can be done

- Choose an obstructing, polypoid or shallow mucosal lesion at four airway locations, with adjustable size and wall position. Compare with normal anatomy at the same scope position. Scenario changes reset the procedure.
- Steer with the mouse or arrows; advance/withdraw using controls or W/S; roll using Q/E. A generic 6 mm scope-tip envelope is constrained by the reviewed lumen and current tumor geometry. Approach target establishes a checked centerline pose and aims the working channel; the learner must still deploy and engage the instrument.
- Advance and rotate forceps; open the cups, contact tumor, close to take a local bite, then retrieve the closed instrument to register a specimen. Shallow tumor can produce a smaller bite. Normal airway wall is not a resection target.
- Contact tumor with a cryoprobe, develop visible adhesion, detach tissue, withdraw the assembly en bloc, transfer the retained tissue, and re-enter. Freezing or thawing alone never removes tissue. Retained tissue is represented by a generic fragment.
- Enclose the discrete attachment of a polypoid lesion in an adjustable snare loop. Tightening captures a stalk only when it lies inside the loop; thermal resection also checks the modeled inspired oxygen and return circuit. A plane at the captured stalk removes the protruding solid and caps the residual attachment.
- Tissue injury adds a source-attached blood film and impaired local visibility. An empty working channel permits suction, which clears the film without stopping its source. Blood can also be introduced as a scenario option. Obscured vision blocks further tissue actions.

## Simulation contract and limits

A Web Worker constructs a local signed-distance grid from the closed lesion surface. Bounded sphere subtraction creates biopsy/cryo defects; stalk-plane subtraction creates snare resection. Marching tetrahedra shares indexed edge intersections and outward winding, including the fresh cut surface. The displayed residual mesh is also used for scope collision and instrument contact. Empty residuals stay empty. The residual percentage and specimen volume derive from occupied grid nodes, not clinical obstruction measurements or specimen measurements.

New scenarios terminate their old worker; revision and request checks reject stale responses. Original geometry buffers are copied before worker initialization. Busy operations lock repeat actions; preparation and cut failures/timeouts expose Reload model. No tissue action is credited until the worker returns a nonzero removed volume, and specimen collection requires retrieval/transfer.

Scope and tool dimensions, bite shapes, adherence animation, lesion dimensions, blood rates and suction effects are authored simulation parameters. Maximum grid spacing starts at 0.5 mm and increases for large lesions to bound work. Tool collision uses the tip axis and a protected bite radius, not full deformable jaws/wire or a flexible scope shaft. En-bloc withdrawal is a discrete external-assembly state, not a simulated transit through the upper airway. A generic fragment represents retained tissue; there is no histology. The model does not simulate rigid access, airway management, anesthesia, generator-specific dose, delayed necrosis, perforation, hemostasis, blood loss, physiology, instrument compatibility or hardware haptics. This is a functional educational prototype awaiting clinician and learner validation.

## Teaching flow and preservation

The canonical registry is `src/features/therapeutic-bronchoscopy/data/curriculum.ts`. All three instrument lessons use the shared `StageLayout`, `NowCard`, `LookInLine` and `StepList` without modifying them. The reference host is the current mechanical ventilation lesson stage, particularly `breathing-with-support`. Desktop pane order is Steps → Teaching → Simulator, fractions 0.26/0.29/remainder and minimum widths 300/280/340 px. Feature-local palette and viewport sizing adapt the existing stage.

Each lesson starts with an actual normal/lesion comparison, collects a prediction, shows feedback after submission, exposes a worked sequence and requires a retrieved specimen from a real tissue action. Observation and explanation precede a transfer procedure in the left mainstem bronchus. The final completion gate requires a new retrieved specimen and return to the airway in that changed case. Back is read-only review and cannot repeat engine actions. Practice permits open exploration; Assess withholds its three decision explanations until submission. Unsafe operations receive immediate feedback.

Completed lessons and first prediction attempts remain in memory while navigating within the module. Reload restarts them. There is no new progress store, persistence promise, mastery designation or procedural competence score. Completing an observation/reflection step is an acknowledgement; course completion still requires the two real specimen-retrieval tasks.

## Sources and provenance

- Mudambi L, Miller R, Eapen GA. **Malignant central airway obstruction.** J Thorac Dis. 2017;9(Suppl 10):S1087–S1110. [DOI 10.21037/jtd.2017.07.27](https://doi.org/10.21037/jtd.2017.07.27). Owner-supplied PDF, read at S1094–S1100 and Figures 7–10: instrument use, electrosurgery, fire precautions, cryoadhesion and en-bloc cryoextraction. Inspired oxygen below 40% is one modeled thermal gate from S1095; satisfying it does not establish clinical fire safety. No universal energy/power/freeze-time prescription is provided.
- [CHEST management of central airway obstruction guideline (2024)](https://www.chestnet.org/guidelines-and-topic-collections/guidelines/interventional-pulmonary/management-of-central-airway-obstruction): context for multidisciplinary therapeutic bronchoscopy and rigid airway access. This prototype's flexible optical view does not represent a recommendation for standalone flexible management of severe obstruction.
- [ERBE pulmonology educational material](https://en.erbegroup.com/en-en/medical-specialties/pulmonology/): corroborating visual/mechanistic context for snare and cryo tools; not used as a commercial compatibility or dosing specification.
- Owner-supplied `Bronch videos and animations.mp4` and two image collages: visual references only. No supplied reference media are copied into public assets. Document content was treated as source material, not agent instructions.

## Verification

Validation commands, screenshots and H1–H12 findings follow. Generated local artifacts are under `artifacts/therapeutic-bronchoscopy/` and are ignored by Git.

- `npx jest --runInBand src/features/therapeutic-bronchoscopy src/lib/airway-anatomy src/lib/bronchoscopy-core`: **84 tests, 10 suites passed**. Includes closed cut surfaces, changed collision, empty residuals, shallow bites, repeated cuts, missed/normal-wall contact, cryo contact loss, retrieval, oxygen/circuit/capture interlocks and suction behavior.
- Bundle and run `scripts/therapeutic-bronchoscopy/review-geometry.mts` with esbuild/Node: **12 real-asset instrument/location combinations passed**. Each required a checked approach, contact/capture, nonzero removed volume and valid residual collision. Forceps left approximately 96–99% of the original mesh; cryo 88–96%; snare 10%. These are scenario-specific mesh estimates, not measured clinical responses.
- `scripts/therapeutic-bronchoscopy/visual-review.mjs`: **passed with zero uncaught browser errors**. Real forceps/cryo/snare sequences; high-oxygen block; specimen transfer/re-entry; suction; forceps lesson and left-mainstem transfer; submission-gated assessment feedback; reload; rapid scenario replacement; shallow mucosal biopsy; model-download and worker failure/retry; original anatomy route; 1440×1080 and 390×844 layouts.
- `scripts/therapeutic-bronchoscopy/lesson-review.mjs`: **passed with zero uncaught browser errors**. Cryo and snare lessons, read-only back/review, actual transfer procedures and completion gates; bounds checks keep the optical view on screen during instrument use; 1024×768 compact layout. Browser scripts accept `BRONCH_REVIEW_AUTH_ENV` pointing to the existing local development auth environment. They do not print credentials or change authentication.
- The live in-app browser also confirmed keyboard deployment, biopsy, a visible residual defect and specimen retrieval. The saved dark theme was inspected and feature-local contrast corrected.
- TypeScript and feature lint passed. `npm run build` passed, including training-app/content builds, critical-care/cardiac asset validation and standalone packaging. Existing Mermaid dependency warnings remain outside this feature. The final copy cleanup was followed by another Next production build.
- Inspected actual screenshots: `forceps-contact.png`, `forceps-bite.png`, `cryoadhesion.png`, `cryo-defect.png`, `snare-loop.png`, `snare-defect.png`, the three guided lesson states, transfer, assessment debrief, mobile/compact, asset failure and worker failure. `reference-stage.png` records the existing ventilation stage at the matching 1440×1080 viewport. Screenshots are under `artifacts/therapeutic-bronchoscopy/browser/`.

| Rule | Result and evidence                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS — Overview entry, canonical three-lesson registry, next-incomplete resolver and explicit secondary Practice.                                                |
| H2   | PASS — normal/lesion comparison, prediction, worked instrument sequence, actual action, explanation and changed-location procedure in every lesson.              |
| H3   | PASS — shared stage/frame imports; explicit pane order, fractions and floors; matching reference/target screenshots inspected.                                   |
| H4   | PASS — one NowCard action, subordinate StepList; locations validate and name actual labels or headings in the rendered panels.                                   |
| H5   | PASS — teaching, worked steps, feedback and actual residual/specimen observations render in their intended phases.                                               |
| H6   | PASS — specimen retrieval is required in both the initial and transfer procedures; freezing, visiting, waiting and clicking Continue cannot produce completion.  |
| H7   | PASS — prediction and assessment responses are explicitly submitted; later teaching is withheld; back is review; unsafe actions get immediate feedback.          |
| H8   | PASS — reviewed LPS airway/assets retained; displayed and collidable tissue agree; new controls operate the real transition engine; model estimates are labeled. |
| H9   | PASS — honest session-only progress and first responses; reload boundary tested; no mastery or new storage adapter.                                              |
| H10  | PASS — conventional instrument/airway language and visible control names; no histology inferred from synthetic morphology.                                       |
| H11  | PASS — separate unlisted admin route with existing auth; no shared-stage, release, database, source CT or global navigation changes.                             |
| H12  | PASS — engine and actual-asset checks plus real browser journeys, unsafe/wrong actions, back/reset/reload, failure/retry and desktop/compact review.             |

This record verifies the prototype's software behavior and teaching interface. Clinical appearance review, hands-on validation and studies of educational effectiveness remain outside this delivery.
