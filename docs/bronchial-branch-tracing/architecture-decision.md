# Native CT within the shared clinical lesson stage

The shared stage and bounded activity store remain unchanged. Feature-owned CT reducers manage actual marks, course responses, manual reveal and completion. NativeCtViewer cannot award credit. Steps → Teaching → Simulator is explicit, with 0.26/0.29 opening fractions and 300/280/340 px floors. The mechanical-ventilation host at base `7da3886e` is the visual reference.

`/learn/anatomy/branch-tracing` and its Learn/Practice/Assess children are anonymous, unlisted and noindex. Assets under `/branch-tracing/` share the narrow public asset access. Existing admin anatomy routes remain protected; no catalog/search/sitemap addition or release action occurs.

## Native images and coordinates

Slicer reads the source NRRD and exports native 512×512 axial planes at 0.5 mm spacing, windowed −1000 to 400 HU. No interpolated through-plane resampling, synthetic fill or textbook images are used. The 236 PNGs contain only IHDR/IDAT/IEND chunks. The current image and at most two adjacent planes are fetched when browsing. The full 48.3 MB stack is not preloaded. Existing standalone packaging includes these feature assets without new hosting infrastructure.

Original IJK→LPS is diagonal: spacing [0.689453125, 0.689453125, 0.5], origin [−182.1552734375, −374.1552734375, −368.5]. Positive image x is patient left, positive y posterior, and increasing acquisition k cranial. The RAS matrix in Slicer is converted explicitly; no recentering is applied to source geometry.

The image, source points, learner points and orientation labels all use one display transform. Standard axial is unchanged; caudal tracing reflects x; RUL rotates −90°; left upper division rotates +90°. Clicks apply the inverse crop/zoom/display transform before recording native pixel coordinates. Repeated levels are valid for a horizontal airway; a returning route may reverse slice order. Full field and expanded viewing preserve the same coordinates.

Comparison points are sampled from the matching source graph and checked against native source intensities. They are sparse geometric comparison aids, not continuous physician annotations. Partial-volume departures in intervening distal graph geometry are documented and prevent a clinical accuracy-score claim.

## Teaching and evidence

The canonical eight lessons each use a real CT example, a three-checkpoint learner trace, course interpretation and a changed trace for transfer. Reference points are not mounted before recording the trace and course. Practice and Assess require all four recorded interpretations before any comparison appears. Backtracking restores the current recorded response; an edit must be recorded before final submission. Neither mode assigns automated clinical correctness.

The first CT participation record, with hint count, is immutable in the existing activity envelope. A lesson's initial trace is recorded before course/comparison; completion is stored only after transfer and manual Finish. No coordinates, images, free text, camera paths or answer keys are persisted. Incomplete lessons restart on reload. Old c1 records remain historical under their original prefix. A learner may explicitly download their session's CT worksheet locally.

## Preserved secondary explorer

The original whole-volume quantized 256³ preview and complete airway surface remain under `preview-v1`. The GLB exposes only Complete_airway, preserves its compressed buffer and uses original node scale plus case scale/rotation. It is loaded lazily for exterior/virtual comparisons. Graph traversal, backtracking, camera/slice independence and route export remain unchanged. No candidate subsegment labels become answer keys.

No added library, shared stage fork, second progress store, trainer rebuild edit or source-scene mutation is needed. Old synthetic renderers are no longer reachable from the learner routes; mathematical fixtures remain useful regression checks.

## Anatomical annotations

`nomenclature-v1` is additive manifest metadata. `airwayPath`, anchor/checkpoint `airway`, checkpoint `landmark` and `sourceEdgeId` come from the reproducible label annotator. It verifies the labeled and original case polylines before using explicit authoring assignments. UI controls, map entries, active CT reference labels and worksheet exports use these same fields. Repeated checkpoints retain the same bronchial name with relative proximal/distal qualifiers. Acquisition indices remain in image details; patient/image coordinates and the participation version are unchanged. Target identity is part of the task prompt; reference lumen positions are still mounted only after the existing submission boundary.
