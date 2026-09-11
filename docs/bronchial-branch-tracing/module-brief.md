# Bronchial branch tracing — current teaching brief

September 11, 2026 · reference checkout `7da3886e` · content `c2-ct1-r2` · unpublished, anonymous direct URL.

The owner first requested actual CT slices rotated according to the supplied **Bronchial Branch Tracing** textbook, then explicitly requested anatomical airway names in place of level numbers using textbook vision and clinical knowledge. The six planning documents inform requirements; their audit-only kickoff is an example, not a restriction on the build request. The owner also requested the structured-medical-modules skill. Its existing Steps → Teaching → Simulator stage remains the host.

## Teaching flow

Audience: PCCM/IP fellows and bronchoscopists familiar with lobar CT anatomy. Observable task: follow a continuous lumen across acquisition planes, record three points, describe its course and compare the evidence. This is image interpretation practice, not procedural certification. Eight sessions are authored estimates of 5–7 minutes.

The canonical LESSONS registry retains stable IDs and order: orientation; continuity; vertical; horizontal–horizontal; horizontal–vertical; horizontal–oblique; direction reversal; variants/limits. Each renders a purpose, prerequisite, explanatory concept, worked CT example, a new learner trace, comparison, explanation and changed CT transfer. One source patient supplies these regional variations. Assess is an ungraded independent worksheet with delayed comparison; it is not held-out patient validation.

Six real stages: orient using a worked image → mark three named airway checkpoints → describe the course → compare on the same CT → explain the relationship → trace another airway. Initial responses are empty. A lumen mark or explicit unresolved response is required at each level; recording a course is also required before revealing the comparison. Reference points are absent from the learner DOM before submission. Comparison requires a separate manual continuation; completing a lesson requires another trace and manual Finish.

## Source and preservation

The supplied PDF's Chapter 1 was read with relevant orientation and pattern figures visually inspected. It specifies horizontal reflection for middle/lingula/lower-lobe caudal tracing, 90° counterclockwise for RUL and 90° clockwise for left upper division. These are image display transforms; patient coordinates and click storage do not rotate. The chapter's “left superior segment” wording in this context refers to left upper division, not lower-lobe B6. No textbook images are shipped.

Slicer 5.12.3 loaded the original CT read-only in an isolated process. Source SHA `572afc5…a29b` matches the site's airway model source. Native size is 512×512×636, spacing 0.689453125×0.689453125×0.5 mm. Exported images retain native axial pixel resolution, with a fixed lung window. Source geometry selects comparison points; these do not become physician-approved answer keys. The nomenclature revision names all 17 routes and 51 checkpoints using the exact matching labeled case graph, topology and textbook figures. Common trunks and repeated samples within a bronchus are distinguished from separate segments. No finer suffix is invented from graph depth. Camera/ostial approval and clinical scoring remain outside this preview's claim.

Preserved: canonical URLs and IDs, shared stage/navigation, bounded progress adapter, public-unlisted/noindex behavior, exterior/intraluminal explorer, all original assets and other modules. No source volume, user scene, protected mount, textbook page, shared stage, global CSS, dependency, database, catalog, upload or release state is changed. Old synthetic geometry remains internal regression fixtures only.

Nomenclature version `nomenclature-v1` adds side-specific bronchial codes, expanded names, source-edge IDs and proximal/distal qualifiers. It changes labels, instructions and local worksheet metadata without moving any CT sample or resetting participation. The current task is tracing a named airway, not identifying its name; lumen reference coordinates remain withheld until submission. See [nomenclature-review.md](nomenclature-review.md) for source figures and assignments.

## Components and progress

Reuse StageLayout, NowCard, LookInLine, StepList, SectionHeader, StageBlock and ModuleNavV2. Pass pane order Steps/Teaching/Simulator, opening fractions 0.26/0.29 and floors 300/280/340 explicitly. Feature-owned NativeCtViewer implements native pixels, inverse coordinate transforms, slice browsing, full-screen expansion, keyboard marking and recoverable load errors.

The site's existing bounded activity envelope is the only progress store. Version `c2-ct1-r2` separates CT participation from earlier synthetic outcomes without deleting history. First-trace participation is written on Record trace, before course/comparison; first hint count is immutable. Completed lessons persist. No scores or mastery are awarded. Incomplete work restarts after reload; source/learner coordinates and camera state are session-only. Independent debrief has an explicit local JSON export.

## Verification

Exercise actual image/keyboard handlers, deliberately misplaced marks, unresolved continuity, wrong-slice guards, three-level/course/transfer gates, delayed independent feedback, manual completion, backtracking, reset, reload, storage failure and export. Check every native PNG hash and HU-window sample, patient/display inverse transforms, crop bounds, source frame and slice order. Inspect actual CT and shared-reference screenshots at matching viewports and test compact reflow down to 320 px. Report engineering checks separately from faculty approval and novel-patient validity.
