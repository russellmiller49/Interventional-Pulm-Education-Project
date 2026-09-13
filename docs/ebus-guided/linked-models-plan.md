# Linked EBUS models — Phase 1

User selected the Phase 1 anatomy/scope pilot on September 13, 2026. Base: `7206e287`. Requested reference: the educational review and 3D build plan supplied in Downloads. The document guides the model design; its later phases are not part of this pass.

## Delivery

Extend only `scope-orientation`, `acoustic-contact`, `ct-map`, `station-seven`, and `right-paratracheal`, using the current shared stage and a linked model workspace. Build anatomy and semantic scope assets with deterministic Blender/Slicer scripts and native sources outside Git. Add a station 7 comparison from both main bronchi, a 4R vascular-landmark/boundary task, and preserve the actual unannotated acquisition during Observe. Keep original routes, calibration, acoustic behavior, course IDs and first responses.

The learner should distinguish observer orbit from scope movement, identify the transducer and optical direction, relate a model section to the acquisition plane, and justify a nodal location from anatomical landmarks. These are knowledge and modeled acquisition tasks, not clinical competence or procedural safety validation.

## Source findings and representation

The primary simplified GLB already contains left and right brachiocephalic veins and an esophagus. Preserve them as named structures. Its station meshes are sampled by the current point-set generator and classified as nodes in the acoustic volume; they are not automatically complete IASLC compartments. Keep node instances and boundary aids separate.

The acoustic builder explicitly describes the simplified anatomy as relocated presentation geometry and says that the historical CT physics snapshot is not registered to it. Audit source CT/segmentation and coordinate transforms in Slicer. Do not imply that a representative CT is registered to a moved teaching model. A section sampled from the common anatomy volume must be labeled as a model section, with reference CT shown separately unless registration is established.

Preserve the existing LPS-mm → web mapping `(L, P, S) → (L, S, -P)`, model scale, optical profile and fan anchor. Record source hashes and round-trip landmarks. Mesh cleanup must not silently move geometry used by the acoustic renderer. Device additions are illustrative unless a dimension is from the existing calibration or manufacturer profile.

## Checks

Follow-up: add hover discovery labels to the visible scope/anatomy meshes using their existing semantic names. Reuse the linked viewer and keyboard/touch structure selector. Hover must not change selection, acquisition, or completion; labels follow the existing reveal boundary and clear during dragging, on leaving the model, or with Escape. Verify real pointer movement, label placement, selection preservation, and the unannotated Observe state in the browser.

Image follow-up: extend discovery to ultrasound and model sections only when the existing lesson `reveal` flag permits image interpretation. Use the displayed ultrasound frame's label image and the exact rendered section's sampled labels, with CSS scaling/letterboxing accounted for. Preserve the pixel buffer, acquisition, and completion state. Include touch/keyboard inspection and verify that labels and accessible hints are absent throughout concealed acquisition/Observe and return in explanation.

Validate export hierarchy, axes/units, geometry equivalence, semantic selection, frame/pose identity and source dependencies. Exercise actual linked views and both station 7 approaches through the lesson route. Demonstrations and camera orbit must not complete activities. Test wrong landmark, frozen/read-only Observe, stale messages, reload/restart, reduced motion, compact/device gates and historical first attempts. Run existing EBUS regression suites, root/embedded type checks, lint and production build. Clinical/anatomical review remains explicitly pending for newly authored aids.
