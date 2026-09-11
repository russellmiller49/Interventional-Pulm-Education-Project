# Nodule-directed CT tracing — source and placement review

September 11, 2026 · `c3-target1-r1` · `targets-v1` · engineering and image review for an ungraded, unpublished module.

## Reused function and source frame

The exporter imports `residualHuAt` directly from `src/lib/bronchoscopy-core/ct-overlay.ts`, the shared function used by the bronch-navigation-trainer CT worker. It reads the trainer's existing `lung_nodule_1` signed residual and alpha volumes from `navigation_module/web/public/cases/default`. No trainer code or donor asset is changed.

For each native acquisition pixel, the exporter calculates **original signed CT HU + interpolated residual HU**, then applies the existing −1000 to 400 HU window. This avoids adding intensity to an already windowed grayscale image or applying alpha twice. The saved patch is transparent where the signal is absent and contains opaque, already-composited grayscale pixels where the signal is present. Both CT and patch receive the same SVG crop, scale, rotation and reflection. Native pixel centers remain at integer IJK indices.

The original NRRD hash is `572afc5bf6b2d80b28439e0397ad4e24e4eb6dfb2630780593259e081ae0a29b`. The original 512×512×636 LPS basis and 0.689453125×0.689453125×0.5 mm spacing are unchanged. The source CT, both airway graphs, source label files, donor data and compositor are hash checked. The manifest records these hashes. All 236 `native-v1` PNGs remain byte-identical.

The donor is scaled to 0.65 in all axes. Its placement is authored simulation on one source patient, not a finding in the original scan. Each target is centered near the end of a connected, labeled airway route, choosing air-containing source tissue within 6 mm of its terminal point. The last learner checkpoint lies upstream in visible source air, outside the donor signal. First and second checkpoints retain their previous coordinates. This adds a distal tracing task rather than placing a decorative nodule next to the previous regional endpoint.

## Authored targets

| Target             | Segment                         | Distal branch label | Terminal edge |
| ------------------ | ------------------------------- | ------------------- | ------------- |
| r-apical-anterior  | RS1 · right apical              | RB1b                | 117           |
| r-apical-posterior | RS1 · right apical              | RB1a                | 122           |
| r-middle-lateral   | RS4 · right middle lobe lateral | RB4a                | 156           |
| r-middle-medial-a  | RS5 · right middle lobe medial  | RB5a                | 243           |
| r-middle-medial-b  | RS5 · right middle lobe medial  | RB5b                | 249           |
| r-anterior-upper   | RS3 · right anterior            | RB3a                | 67            |
| r-anterior-lower   | RS3 · right anterior            | RB3a                | 131           |
| l-apicoposterior   | LS1+2 · left apicoposterior     | LB1+2               | 415           |
| l-anterior         | LS3 · left anterior             | LB3                 | 357           |
| l-inferior-lingula | LS5 · left inferior lingular    | LB5                 | 353           |
| l-superior         | LS6 · left lower lobe superior  | LB6                 | 281           |
| r-anterior-basal   | RS8 · right anterior basal      | RB8                 | 220           |
| l-lateral-basal    | LS9 · left lateral basal        | LB9                 | 103           |

The 13 targets cover ten segments through 17 existing lesson traces. Practice offers one representative target for each segment and a mixed four-target set. Each Learn prediction/transfer pair has a different target. Where coarse source labels do not resolve a finer subdivision, the module retains the segmental bronchus label; it does not invent suffixes from graph depth. Segmental/subsegmental terminology remains grounded in the supplied textbook figures and the prior [nomenclature review](nomenclature-review.md).

Visual inspection of all placements caught a distracting background opacity at the initial lingular endpoint. The final lingular target uses edge 353 farther along LB5. The lateral middle-lobe target was also shifted slightly upstream into air-containing source tissue. These are authored target-placement choices; no source tissue or airway geometry was edited.

## Graph correspondence

All 70 edges in the selected root-to-target paths have matching node IDs and vertex counts in the original and labeled graphs. Complete vertex arrays match for 68 edges. The two incident LB6 edges at node 186 (edge 184's last vertex and edge 281's first vertex) contain a pre-existing 0.1349908221 mm junction-coordinate difference between those two hash-pinned graphs. Both graph versions retain the same junction topology and LB6 lineage. The builder explicitly permits only those two reviewed vertices and records their offsets; every other vertex must match exactly. It keeps the original CT graph unchanged. The terminal nodule and distal checkpoint are away from that junction.

This correspondence supports transferring the existing segment label. It is not a clinical registration tolerance, approved ostial annotation or continuous-lumen validation. Every displayed checkpoint is independently checked to lie on its assigned original polyline within 0.0001 mm rounding tolerance.

## Teaching and behavior

The nodule and named segment are the known planning destination. **Show target** is orientation assistance and does not complete an activity or reveal airway reference coordinates. Learners trace from the parent, record three lumen marks or explicit unresolved responses, describe the course, and record the distal airway–nodule relationship. Learn then reveals the comparison; Practice/Assess wait for set submission. Each response receives matching review guidance, including uncertainty and possible adjacent-structure responses, without an automated clinical grade.

The CT can show the original image without the simulated nodule through a labeled toggle. A missing patch is disclosed with a retry control; marking is disabled while a required CT/patch image is unavailable. Changing target focus, slice, crop or display does not change recorded native-pixel coordinates. The secondary exterior/virtual-airway viewer remains available for anatomy comparison; the UI explicitly locates the simulated nodule in the CT stack.

The 377 generated PNGs comprise 373 compact nodule patches and four additional native planes (239, 476–478), totaling 1,101,884 bytes. No full source CT, donor volume or textbook page is added to public assets. The browser requests patches only for the displayed target/plane. Rebuilding prunes only obsolete PNG paths previously listed by this exporter's manifest.

## Verification and limits

Asset tests verify all original/generated hashes, each patch's dimensions and alpha footprint, the changing slice footprint, signed source-HU windowing and the shared compositor's numerical output at all 13 target centers. All target paths are connected, label matched and supplied with every required axial plane. Native patient/display round trips, unchanged proximal samples and the unoccluded distal reference points are also checked.

Rendered and browser tests cover actual wrong marks, required relationship selection, changed-target transfer, manual comparison/completion, named segment selection, nodule registration through rotation and slice changes, original-image toggle, patch retry and worksheet export. [QA report](qa-report.md) records results and screenshots.

This is CT route-planning practice. The overlay does not model instrument travel, biopsy acquisition, tool-in-lesion, diagnostic yield or clinical competence. The original source graph contains partial-volume and unresolved distal intervals. Source-derived comparisons support self-review; faculty approval and validation on a separate patient remain outside this unpublished version's claims.
