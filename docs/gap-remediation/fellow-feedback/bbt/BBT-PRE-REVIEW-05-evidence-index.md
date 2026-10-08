# BBT-PRE-REVIEW-05 — evidence index and structured decision records

Companion to [`BBT-PRE-REVIEW-05-owner-decision-packet.md`](BBT-PRE-REVIEW-05-owner-decision-packet.md). The machine-readable form, with full hashes, is [`BBT-PRE-REVIEW-05-source-index.json`](BBT-PRE-REVIEW-05-source-index.json).

**Status: NOT REVIEWED.** No reviewer, date or decision is recorded anywhere in this packet. Nothing here is implemented.

## Where the evidence is

Evidence root (local only, not in Git, not uploaded):

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/bbt-pre-review-05-2026-10-04`

- Open **`review-surface.html`** from that folder in a browser. It steps through the native planes for OD-01 and OD-02 with a toggle for the existing model points, and shows the two OD-05 examples.
- `sha256sums.txt` lists the SHA-256 of all 405 evidence files; its own SHA-256 is `d7e82dbc1f401b9f8ad3658044ad5b802f65a3943eac1411c8f51f0d03b809f8`.
- `README.md` in that folder says how every image was made and how to reproduce it.

### What the images are

- **native** — the CT's own axial plane at the module's window (−1000/400 HU), decoded from the original volume and enlarged by nearest-neighbour only. Nothing is drawn on the pixels.
- **overlay** — the same pixels with existing model points: source-graph centreline crossings, the exported parent and response points, the graph node. Model locators, not walls, not reviewed annotations.
- **display** — the same native pixels under a learner display transform. A screen operation only.
- **module screenshot** — the module's own page in an isolated headless browser (fresh context, synthetic drafts, no owner profile).

No contour was drawn, no contrast was changed, no landmark was added and no geometry was moved. No clinical image is in Git.

## Source and hash validation

| Check                                                          | Result     |
| -------------------------------------------------------------- | ---------- |
| CT source SHA-256 equals the manifest's `sourceSha256`         | yes        |
| Source graph SHA-256 equals the manifest's `sourceGraphSha256` | yes        |
| Route registry's source hashes equal the manifest              | yes        |
| Label file SHA-256 equals the registry's `sourceLabelsSha256`  | yes        |
| Exported planes whose file hash equals the manifest            | 236 of 236 |
| Exported planes pixel-identical to the native plane            | 236 of 236 |
| Exported points whose slice, pixel and HU agree with the CT    | 183 of 183 |
| Draft signatures reproduced by the read-only harness           | 21 of 21   |
| Camera poses for both OD-05 examples equal the pinned fixture  | yes        |
| Implementation pack files hash-matching its manifest           | 12 of 12   |

These checks tie the evidence to its sources. They are not anatomy validation, and no application test or build is claimed as such.

## Sources

| ID   | Source                                                                                                                                                  | Where                                                                          | SHA-256                            | Role                                                                                                                                                             | In Git?                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| S-01 | `/Users/russellmiller/Projects/navigation_module/data/target/target_clean_ct.nrrd`                                                                      | local (outside the repository and outside Local-Data)                          | `572afc5bf6b2d80b…`                | Original teaching CT (NRRD, int16 HU). The native source every plane is decoded from.                                                                            | local only — never in Git, never uploaded                    |
| S-02 | `public/branch-tracing/native-v1/manifest.json`                                                                                                         | repository                                                                     | `3cd614847f371541…`                | Native export manifest: source hashes, IJK-to-LPS matrix, window, 236 asset hashes, nomenclature reference                                                       | in Git (already shipped with the module)                     |
| S-03 | `public/branch-tracing/native-v1/axial/`                                                                                                                | repository                                                                     | per file in S-02 (assets[].sha256) | The 236 exported axial planes (slices 240–475) the learner sees                                                                                                  | in Git (already shipped with the module)                     |
| S-04 | `public/fluoroview/cases/patient-new/metadata/airway_graph.json`                                                                                        | repository                                                                     | `68226a87928135f8…`                | Source airway graph (498 nodes, 497 edges, LPS mm). The manifest's sourceGraphSha256                                                                             | in Git (already shipped with the module)                     |
| S-05 | `public/airway-anatomy/case-001/metadata/airway_graph.json`                                                                                             | repository                                                                     | `ea98834c7612e596…`                | Labelled copy of the same graph (nomenclature record's sourceLabeledGraphSha256)                                                                                 | in Git (already shipped with the module)                     |
| S-06 | `public/airway-anatomy/case-001/metadata/centerline_labels.json`                                                                                        | repository                                                                     | `fc446faabf765459…`                | Source edge labels (from labels_cleaned_names.xlsx). The registry's sourceLabelsSha256                                                                           | in Git (already shipped with the module)                     |
| S-07 | `src/features/bronchial-branch-tracing/geometry/branch-decisions.json`                                                                                  | repository                                                                     | `1a78138c5e4e991a…`                | Exported route registry: 17 routes, every junction's node, parent point and daughter response points                                                             | in Git (already shipped with the module)                     |
| S-08 | `src/features/bronchial-branch-tracing/geometry/paired-routes.json`                                                                                     | repository                                                                     | `ddd2a61893a0da64…`                | Centreline polylines of the 70 route edges used for model locators and the parent camera                                                                         | in Git (already shipped with the module)                     |
| S-09 | `public/branch-tracing/targets-v1/manifest.json`                                                                                                        | repository                                                                     | `39b6d787ed6df488…`                | Route and simulated-target manifest                                                                                                                              | in Git (already shipped with the module)                     |
| S-10 | `scripts/branch-tracing/authoring/airway-nomenclature.json`                                                                                             | repository                                                                     | `c1d5c8ff205e7292…`                | Authored airway names per source edge, with the stated basis for each                                                                                            | in Git (already shipped with the module)                     |
| S-11 | `scripts/branch-tracing/build-branch-decisions.mjs`                                                                                                     | repository                                                                     | `b68c5b587b3b3de5…`                | Generator of S-07: the rule that places parent and daughter response points                                                                                      | in Git (already shipped with the module)                     |
| S-12 | `scripts/branch-tracing/export-native-slicer.py`                                                                                                        | repository                                                                     | `00920930a9b2015d…`                | Generator of S-02/S-03: window, slice range, IJK-to-LPS                                                                                                          | in Git (already shipped with the module)                     |
| S-13 | `src/features/bronchial-branch-tracing/content/local-exercises.ts`                                                                                      | repository                                                                     | `f99b8319e570db9e…`                | Builds each local exercise: demonstration planes, browsable interval, answer points, review status                                                               | in Git (already shipped with the module)                     |
| S-14 | `src/features/bronchial-branch-tracing/content/lessons.ts`                                                                                              | repository                                                                     | `c8d570f3fe46333a…`                | Lesson registry, lesson text and each lesson's book page pointer                                                                                                 | in Git (already shipped with the module)                     |
| S-15 | `src/features/bronchial-branch-tracing/content/junction-feedback.ts`                                                                                    | repository                                                                     | `4329d6fde60bb986…`                | BBT-02 five-junction packet text (NOT REVIEWED), including the first-junction entry note                                                                         | in Git (already shipped with the module)                     |
| S-16 | `src/features/bronchial-branch-tracing/content/course-guide.ts`                                                                                         | repository                                                                     | `e0b86585b1eb431f…`                | Four-pattern reference, terms, More routes overlap computation                                                                                                   | in Git (already shipped with the module)                     |
| S-17 | `src/features/bronchial-branch-tracing/content/practice.ts`                                                                                             | repository                                                                     | `5e9dcd4df831ca2a…`                | Practice, mixed-set and More routes route lists                                                                                                                  | in Git (already shipped with the module)                     |
| S-18 | `src/features/bronchial-branch-tracing/geometry/paired-scope.ts`                                                                                        | repository                                                                     | `59e1d26a688244d9…`                | Parent camera: position, forward vector and reference up per regional preset                                                                                     | in Git (already shipped with the module)                     |
| S-19 | `src/features/bronchial-branch-tracing/geometry/parent-map.ts`                                                                                          | repository                                                                     | `595777b4c0aba906…`                | Direction schematic: A/B letters by source index, opening numbers by screen position                                                                             | in Git (already shipped with the module)                     |
| S-20 | `src/features/bronchial-branch-tracing/geometry/reference-frames.ts`                                                                                    | repository                                                                     | `a2c2712247e2ffb6…`                | The three reference frames, projections and captions                                                                                                             | in Git (already shipped with the module)                     |
| S-21 | `src/features/bronchial-branch-tracing/geometry/orientation.ts`                                                                                         | repository                                                                     | `ea7da120887afc7f…`                | Learner CT display transform                                                                                                                                     | in Git (already shipped with the module)                     |
| S-22 | `src/features/bronchial-branch-tracing/engine/ct-draft.ts`                                                                                              | repository                                                                     | `de4a3c76f4d308d6…`                | Draft signature, viewer schema, draft read/write and recovery copy                                                                                               | in Git (already shipped with the module)                     |
| S-23 | `src/features/bronchial-branch-tracing/engine/junction-feedback.ts`                                                                                     | repository                                                                     | `ff8dee5f5399c946…`                | Mark-to-model-locator comparison in millimetres                                                                                                                  | in Git (already shipped with the module)                     |
| S-24 | `src/features/bronchial-branch-tracing/content/ct-types.ts`                                                                                             | repository                                                                     | `e9e93c0acef5128c…`                | Types, including the faculty-reviewed annotation record and optional contour                                                                                     | in Git (already shipped with the module)                     |
| S-25 | `src/features/bronchial-branch-tracing/__tests__/fixtures/parent-camera-baseline.json`                                                                  | repository                                                                     | `692837dc0698a381…`                | Pinned camera pose and schematic projection for all 128 authored decisions                                                                                       | in Git (already shipped with the module)                     |
| S-26 | `src/features/bronchial-branch-tracing/__tests__/fixtures/draft-signatures-baseline.json`                                                               | repository                                                                     | `366998721d4ed51c…`                | Pinned 21 draft signatures                                                                                                                                       | in Git (already shipped with the module)                     |
| S-27 | `docs/bronchial-branch-tracing/clinical-review.md`                                                                                                      | repository                                                                     | `48e1ba6658ad6ead…`                | Clinical review boundary record (engineering review, not faculty sign-off)                                                                                       | in Git (already shipped with the module)                     |
| S-28 | `docs/bronchial-branch-tracing/nomenclature-review.md`                                                                                                  | repository                                                                     | `e3412a2f7a0d6048…`                | Nomenclature assignments by an AI session using the textbook; not faculty sign-off                                                                               | in Git (already shipped with the module)                     |
| S-29 | `docs/gap-remediation/bbt/BBT-02-junction-packet.md`                                                                                                    | repository                                                                     | `9531bc460282cb66…`                | BBT-02 five-junction faculty packet, NOT REVIEWED                                                                                                                | in Git (already shipped with the module)                     |
| S-30 | `docs/gap-remediation/fellow-feedback/bbt/BBT-PRE-REVIEW-01-first-junction.md`                                                                          | repository                                                                     | `51309dbd1b656b36…`                | Prompt 01 first-junction reconciliation (containment, not resolution)                                                                                            | in Git (already shipped with the module)                     |
| S-31 | `/Users/russellmiller/Projects/textbooks/Interventional Pulmonology/bronchial branch tracing.pdf`                                                       | local (owner's textbook folder; outside the repository and outside Local-Data) | `18a027c7374532c5…`                | Kurimoto & Morita, Bronchial Branch Tracing (2020). Text layer read for locators only; figures not inspected                                                     | copyrighted — local only; no page or passage copied into Git |
| S-32 | `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/module_update_9_19/BBT_Claude_Implementation_Pack/Branch_Tracing_Fellow_Walkthrough.docx` | Local-Data                                                                     | `80ab48e08642409f…`                | The AI first-year-fellow walkthrough (19 September 2026). A report of findings, not a human usability session or a clinical review                               | local only — not in Git, not uploaded                        |
| S-33 | `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/module_update_9_19/BBT_Claude_Implementation_Pack/MANIFEST.json`                          | Local-Data                                                                     | `59dde84348e5df4e…`                | Implementation pack manifest; all 12 listed files hash-match                                                                                                     | local only — not in Git, not uploaded                        |
| S-34 | `.next/standalone (BUILD_ID 1j_42VcNarufE2tLdGqUb)`                                                                                                     | this worktree, untracked build output                                          | —                                  | Existing production build used only to screenshot the module's own pages. Built at the smoke SHA 6586d516; no BBT path differs between that SHA and the base SHA | not in Git                                                   |

Full hashes are in the JSON index.

### Native CT frame (S-01, S-02)

| Property         | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Size             | 512 × 512 × 636 voxels                                               |
| Spacing          | 0.689453125 × 0.689453125 × 0.5 mm                                   |
| Space            | left-posterior-superior (+x patient left, +y posterior, +z superior) |
| Direction matrix | `(0.689453125,0,0) (0,0.689453125,0) (0,0,0.5)` (diagonal)           |
| Origin           | `(-182.15527343749997,-374.15527343749989,-368.5)` mm                |
| Slice rule       | z(k) = −368.5 + 0.5 · k mm; a higher slice index is more cranial     |
| Exported planes  | slices 240–475, window −1000/400 HU, 8-bit                           |
| Pixel convention | voxel-centre: pixel i covers [i − 0.5, i + 0.5)                      |

## Evidence

Paths are relative to the evidence root. “Slices” are native slice indices; z is LPS millimetres.

### Whole packet

| ID      | Path                                  | Native locator | Graph | Kind            | SHA-256             | Purpose                                                                                                             |
| ------- | ------------------------------------- | -------------- | ----- | --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| E-00-01 | `review-surface.html`                 | —              | —     | local HTML page | `2f8ff628d4185fa3…` | One local review page: steps through the OD-01 and OD-02 planes with a model-point toggle; shows the OD-05 examples |
| E-00-02 | `sha256sums.txt`                      | —              | —     | hash list       | `d7e82dbc1f401b9f…` | SHA-256 of every evidence file                                                                                      |
| E-00-03 | `source/source-identity.json`         | —              | —     | JSON            | `79f197a6464baec9…` | Source hashes, NRRD header, and the export consistency checks                                                       |
| E-00-04 | `source/nrrd-header.txt`              | —              | —     | text            | `cdb9be4324cddc1d…` | The CT's own header: size, spacing, origin, direction, space                                                        |
| E-99-01 | `scripts/build_native_evidence.py`    | —              | —     | script          | `9415c0b61895a250…` | Script that produced the evidence (read-only on every source)                                                       |
| E-99-02 | `scripts/check_exporter_rule.py`      | —              | —     | script          | `a3de86d644ebb236…` | Script that produced the evidence (read-only on every source)                                                       |
| E-99-03 | `scripts/module-harness.ts`           | —              | —     | script          | `812f4babb5e8c7da…` | Script that produced the evidence (read-only on every source)                                                       |
| E-99-04 | `scripts/capture-parent-view.spec.ts` | —              | —     | script          | `b0ccccdbbb113fc0…` | Script that produced the evidence (read-only on every source)                                                       |
| E-99-05 | `scripts/build_source_index.py`       | —              | —     | script          | `e44a4ddae17f5c2e…` | Script that produced the evidence (read-only on every source)                                                       |
| E-99-06 | `scripts/validate_packet.py`          | —              | —     | script          | `d80dff589fd4dd43…` | Script that produced the evidence (read-only on every source)                                                       |

### OD-01 — first bifurcation

| ID      | Path                                                               | Native locator                      | Graph                  | Kind                                  | SHA-256                                      | Purpose                                                                                                            |
| ------- | ------------------------------------------------------------------ | ----------------------------------- | ---------------------- | ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| E-00-05 | `source/exporter-rule-check.json`                                  | —                                   | —                      | JSON                                  | `bbadefa4db9f9b4a…`                          | Every exported parent and daughter point checked against the generator rule                                        |
| E-00-06 | `source/draft-signature-dependence.json`                           | —                                   | —                      | JSON                                  | `ddd9d6d28ebfcf15…`                          | The 21 draft signatures reproduced, consumers of junction-1, and which signatures move under in-memory experiments |
| E-01-01 | `od-01/contact-sheet-native.png`                                   | slice 411–366 (z -163.0 to -185.5)  | node 1; edges 0 → 1, 2 | image                                 | `c62e936e1b3f1a2e…`                          | All 46 planes 411 → 366 in the lesson's crop, no annotation                                                        |
| E-01-02 | `od-01/contact-sheet-overlay.png`                                  | slice 411–366 (z -163.0 to -185.5)  | node 1; edges 0 → 1, 2 | image                                 | `83c595198e759590…`                          | The same planes with existing model points                                                                         |
| E-01-03 | `od-01/detail-native/`                                             | slices 411–366 (z -163.0 to -185.5) | node 1; edges 0 → 1, 2 | image set (one file per native slice) | `118cd5771672f6b2…` (46 files; listing hash) | Lesson crop ×8, no annotation, one file per plane                                                                  |
| E-01-04 | `od-01/detail-overlay/`                                            | slices 411–366 (z -163.0 to -185.5) | node 1; edges 0 → 1, 2 | image set (one file per native slice) | `0a022e871d641e8d…` (46 files; listing hash) | Lesson crop ×8 with existing model points                                                                          |
| E-01-05 | `od-01/full-x1-native/`                                            | slices 411–366 (z -163.0 to -185.5) | node 1; edges 0 → 1, 2 | image set (one file per native slice) | `2fffe201850e220b…` (46 files; listing hash) | Full field ×1, no annotation (orientation context for every plane)                                                 |
| E-01-06 | `od-01/full-x1-overlay/`                                           | slices 411–366 (z -163.0 to -185.5) | node 1; edges 0 → 1, 2 | image set (one file per native slice) | `613c97a4776af7fc…` (46 files; listing hash) | Full field ×1 with model points and the lesson's crop rectangle                                                    |
| E-01-07 | `od-01/detail-native/slice-408.png`                                | slice 408 (z -164.5)                | node 1; edges 0 → 1, 2 | image                                 | `0306411e502aad96…`                          | Slice 408, no annotation — exported parent point (current demonstration start)                                     |
| E-01-16 | `od-01/detail-overlay/slice-408.png`                               | slice 408 (z -164.5)                | node 1; edges 0 → 1, 2 | image                                 | `b28b9d9072dd018d…`                          | Slice 408, existing model points — exported parent point (current demonstration start)                             |
| E-01-08 | `od-01/detail-native/slice-392.png`                                | slice 392 (z -172.5)                | node 1; edges 0 → 1, 2 | image                                 | `7ee818d5a3d68db7…`                          | Slice 392, no annotation — plane nearest graph node 1                                                              |
| E-01-17 | `od-01/detail-overlay/slice-392.png`                               | slice 392 (z -172.5)                | node 1; edges 0 → 1, 2 | image                                 | `0435402b0911bc1f…`                          | Slice 392, existing model points — plane nearest graph node 1                                                      |
| E-01-09 | `od-01/detail-native/slice-387.png`                                | slice 387 (z -175.0)                | node 1; edges 0 → 1, 2 | image                                 | `3d76527ce3ed7dc8…`                          | Slice 387, no annotation — current daughter response plane                                                         |
| E-01-18 | `od-01/detail-overlay/slice-387.png`                               | slice 387 (z -175.0)                | node 1; edges 0 → 1, 2 | image                                 | `8781fc476d8400b7…`                          | Slice 387, existing model points — current daughter response plane                                                 |
| E-01-10 | `od-01/detail-native/slice-384.png`                                | slice 384 (z -176.5)                | node 1; edges 0 → 1, 2 | image                                 | `3d08f0ba3f08afb1…`                          | Slice 384, no annotation — caudal end of the lesson's browsable interval                                           |
| E-01-19 | `od-01/detail-overlay/slice-384.png`                               | slice 384 (z -176.5)                | node 1; edges 0 → 1, 2 | image                                 | `7d3c3d40d96f29d6…`                          | Slice 384, existing model points — caudal end of the lesson's browsable interval                                   |
| E-01-11 | `od-01/detail-native/slice-376.png`                                | slice 376 (z -180.5)                | node 1; edges 0 → 1, 2 | image                                 | `0b6bfbde618b79f1…`                          | Slice 376, no annotation — last plane with both crossings in one air region                                        |
| E-01-20 | `od-01/detail-overlay/slice-376.png`                               | slice 376 (z -180.5)                | node 1; edges 0 → 1, 2 | image                                 | `1fcdb6e4885c5fea…`                          | Slice 376, existing model points — last plane with both crossings in one air region                                |
| E-01-12 | `od-01/detail-native/slice-375.png`                                | slice 375 (z -181.0)                | node 1; edges 0 → 1, 2 | image                                 | `d12de93e04d46c08…`                          | Slice 375, no annotation — first plane with the crossings in separate air regions                                  |
| E-01-21 | `od-01/detail-overlay/slice-375.png`                               | slice 375 (z -181.0)                | node 1; edges 0 → 1, 2 | image                                 | `dd79b8069ae8bf48…`                          | Slice 375, existing model points — first plane with the crossings in separate air regions                          |
| E-01-13 | `od-01/detail-native/slice-374.png`                                | slice 374 (z -181.5)                | node 1; edges 0 → 1, 2 | image                                 | `4fda08deec1c8f43…`                          | Slice 374, no annotation — candidate band                                                                          |
| E-01-22 | `od-01/detail-overlay/slice-374.png`                               | slice 374 (z -181.5)                | node 1; edges 0 → 1, 2 | image                                 | `0977d476fd1e7095…`                          | Slice 374, existing model points — candidate band                                                                  |
| E-01-14 | `od-01/detail-native/slice-372.png`                                | slice 372 (z -182.5)                | node 1; edges 0 → 1, 2 | image                                 | `7d6d9da1c985d698…`                          | Slice 372, no annotation — candidate band; the walkthrough's proposed limit                                        |
| E-01-23 | `od-01/detail-overlay/slice-372.png`                               | slice 372 (z -182.5)                | node 1; edges 0 → 1, 2 | image                                 | `acd6e7f3d1a360c5…`                          | Slice 372, existing model points — candidate band; the walkthrough's proposed limit                                |
| E-01-15 | `od-01/detail-native/slice-370.png`                                | slice 370 (z -183.5)                | node 1; edges 0 → 1, 2 | image                                 | `d440a477f78b6e12…`                          | Slice 370, no annotation — candidate band                                                                          |
| E-01-24 | `od-01/detail-overlay/slice-370.png`                               | slice 370 (z -183.5)                | node 1; edges 0 → 1, 2 | image                                 | `65f9653602b378b9…`                          | Slice 370, existing model points — candidate band                                                                  |
| E-01-25 | `od-01/full-native/`                                               | slices 408–366 (z -164.5 to -185.5) | node 1; edges 0 → 1, 2 | image set (one file per native slice) | `5d99dc142b412cc8…` (13 files; listing hash) | Full field ×2, no annotation, for 13 key planes                                                                    |
| E-01-26 | `od-01/full-overlay/`                                              | slices 408–366 (z -164.5 to -185.5) | node 1; edges 0 → 1, 2 | image set (one file per native slice) | `3ed480b30e807772…` (13 files; listing hash) | Full field ×2 with model points, for 13 key planes                                                                 |
| E-01-27 | `od-01/measurements.json`                                          | slice 411–366 (z -163.0 to -185.5)  | node 1; edges 0 → 1, 2 | JSON                                  | `190e918832124f93…`                          | Per-plane arithmetic: crossings, HU on the line between them, connected air regions at three thresholds            |
| E-01-28 | `od-01/measurements.csv`                                           | slice 411–366 (z -163.0 to -185.5)  | node 1; edges 0 → 1, 2 | CSV                                   | `46ca1b6872ddab2b…`                          | The same as a table                                                                                                |
| E-01-29 | `od-05/central-junction-1/app-01-worked-example-page.png`          | slice 408 (z -164.5)                | node 1; edges 0 → 1, 2 | module screenshot (isolated browser)  | `e45abb1f474ebc92…`                          | Current learner task: Lesson 3 worked example at slice 408 with the entry note and the branch identities           |
| E-01-30 | `od-05/central-junction-1/app-02-parent-view-step-paired-view.png` | slice 387 (z -175.0)                | node 1; edges 0 → 1, 2 | module screenshot (isolated browser)  | `74fbc84d45cf4814…`                          | The module's paired parent view at this division (model camera)                                                    |

### OD-02 — left main bronchus interval

| ID      | Path                                 | Native locator                      | Graph                    | Kind                                  | SHA-256                                      | Purpose                                                                                                                         |
| ------- | ------------------------------------ | ----------------------------------- | ------------------------ | ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| E-02-01 | `od-02/contact-sheet-native.png`     | slice 360–338 (z -188.5 to -199.5)  | node 3; edges 2 → 5, 496 | image                                 | `c2d210f793072e12…`                          | All 23 planes 360 → 338 in the lesson's crop, no annotation                                                                     |
| E-02-02 | `od-02/contact-sheet-overlay.png`    | slice 360–338 (z -188.5 to -199.5)  | node 3; edges 2 → 5, 496 | image                                 | `e36ecb651707256d…`                          | The same planes with every source edge that crosses the crop                                                                    |
| E-02-03 | `od-02/detail-native/`               | slices 360–338 (z -188.5 to -199.5) | node 3; edges 2 → 5, 496 | image set (one file per native slice) | `d502f447428fd15b…` (23 files; listing hash) | Lesson crop ×8, no annotation                                                                                                   |
| E-02-04 | `od-02/detail-overlay/`              | slices 360–338 (z -188.5 to -199.5) | node 3; edges 2 → 5, 496 | image set (one file per native slice) | `84f5664e4aa80665…` (23 files; listing hash) | Lesson crop ×8 with existing model points                                                                                       |
| E-02-05 | `od-02/full-x1-native/`              | slices 360–338 (z -188.5 to -199.5) | node 3; edges 2 → 5, 496 | image set (one file per native slice) | `a669ffe57e0031f6…` (23 files; listing hash) | Full field ×1, no annotation                                                                                                    |
| E-02-06 | `od-02/full-x1-overlay/`             | slices 360–338 (z -188.5 to -199.5) | node 3; edges 2 → 5, 496 | image set (one file per native slice) | `dbccfb3033def1ad…` (23 files; listing hash) | Full field ×1 with model points and the crop rectangle                                                                          |
| E-02-07 | `od-02/detail-native/slice-356.png`  | slice 356 (z -190.5)                | node 3; edges 2 → 5, 496 | image                                 | `66621959258a8a98…`                          | Slice 356, no annotation — above the lesson interval                                                                            |
| E-02-15 | `od-02/detail-overlay/slice-356.png` | slice 356 (z -190.5)                | node 3; edges 2 → 5, 496 | image                                 | `17b07ca5bb22dda5…`                          | Slice 356, existing model points — above the lesson interval                                                                    |
| E-02-08 | `od-02/detail-native/slice-352.png`  | slice 352 (z -192.5)                | node 3; edges 2 → 5, 496 | image                                 | `b2bfc2751f6a4375…`                          | Slice 352, no annotation — Lesson 1 interval start                                                                              |
| E-02-16 | `od-02/detail-overlay/slice-352.png` | slice 352 (z -192.5)                | node 3; edges 2 → 5, 496 | image                                 | `dc715fde5cb47d2c…`                          | Slice 352, existing model points — Lesson 1 interval start                                                                      |
| E-02-09 | `od-02/detail-native/slice-351.png`  | slice 351 (z -193.0)                | node 3; edges 2 → 5, 496 | image                                 | `69b8470d56dae8ae…`                          | Slice 351, no annotation — inside the interval                                                                                  |
| E-02-17 | `od-02/detail-overlay/slice-351.png` | slice 351 (z -193.0)                | node 3; edges 2 → 5, 496 | image                                 | `772278b469b6ab35…`                          | Slice 351, existing model points — inside the interval                                                                          |
| E-02-10 | `od-02/detail-native/slice-350.png`  | slice 350 (z -193.5)                | node 3; edges 2 → 5, 496 | image                                 | `1993f5c3c022ec31…`                          | Slice 350, no annotation — first plane with one air region at −900 HU                                                           |
| E-02-18 | `od-02/detail-overlay/slice-350.png` | slice 350 (z -193.5)                | node 3; edges 2 → 5, 496 | image                                 | `9037eb743a4e2766…`                          | Slice 350, existing model points — first plane with one air region at −900 HU                                                   |
| E-02-11 | `od-02/detail-native/slice-349.png`  | slice 349 (z -194.0)                | node 3; edges 2 → 5, 496 | image                                 | `a481d588f58a7acf…`                          | Slice 349, no annotation — first plane with one air region at −950 HU                                                           |
| E-02-19 | `od-02/detail-overlay/slice-349.png` | slice 349 (z -194.0)                | node 3; edges 2 → 5, 496 | image                                 | `91676eef3ce161cc…`                          | Slice 349, existing model points — first plane with one air region at −950 HU                                                   |
| E-02-12 | `od-02/detail-native/slice-348.png`  | slice 348 (z -194.5)                | node 3; edges 2 → 5, 496 | image                                 | `75057e281b6de336…`                          | Slice 348, no annotation — Lesson 1 response plane                                                                              |
| E-02-20 | `od-02/detail-overlay/slice-348.png` | slice 348 (z -194.5)                | node 3; edges 2 → 5, 496 | image                                 | `3bcadcdcdb33da05…`                          | Slice 348, existing model points — Lesson 1 response plane                                                                      |
| E-02-13 | `od-02/detail-native/slice-344.png`  | slice 344 (z -196.5)                | node 3; edges 2 → 5, 496 | image                                 | `4e519ec649a4efda…`                          | Slice 344, no annotation — exported parent point of junction-3                                                                  |
| E-02-21 | `od-02/detail-overlay/slice-344.png` | slice 344 (z -196.5)                | node 3; edges 2 → 5, 496 | image                                 | `64eee4d3a5d6f404…`                          | Slice 344, existing model points — exported parent point of junction-3                                                          |
| E-02-14 | `od-02/detail-native/slice-339.png`  | slice 339 (z -199.0)                | node 3; edges 2 → 5, 496 | image                                 | `756aeb9a8017b224…`                          | Slice 339, no annotation — plane nearest graph node 3                                                                           |
| E-02-22 | `od-02/detail-overlay/slice-339.png` | slice 339 (z -199.0)                | node 3; edges 2 → 5, 496 | image                                 | `57e8014aa74ffe5f…`                          | Slice 339, existing model points — plane nearest graph node 3                                                                   |
| E-02-23 | `od-02/full-native/`                 | slices 356–340 (z -190.5 to -198.5) | node 3; edges 2 → 5, 496 | image set (one file per native slice) | `6bcdad41b03e2db7…` (6 files; listing hash)  | Full field ×2, no annotation, six key planes                                                                                    |
| E-02-24 | `od-02/full-overlay/`                | slices 356–340 (z -190.5 to -198.5) | node 3; edges 2 → 5, 496 | image set (one file per native slice) | `191c23db1d8d08e5…` (6 files; listing hash)  | Full field ×2 with model points, six key planes                                                                                 |
| E-02-25 | `od-02/measurements.json`            | slice 360–338 (z -188.5 to -199.5)  | node 3; edges 2 → 5, 496 | JSON                                  | `38e3992cc3683d02…`                          | Per-plane arithmetic: source edges crossing the crop, connected air regions, slice-to-slice tracking of the neighbouring region |

### OD-04 — four patterns

| ID      | Path                        | Native locator | Graph | Kind | SHA-256             | Purpose                                                                                             |
| ------- | --------------------------- | -------------- | ----- | ---- | ------------------- | --------------------------------------------------------------------------------------------------- |
| E-00-07 | `source/book-locators.json` | —              | —     | JSON | `f4391622a36220c8…` | Textbook locators read from the PDF text layer, and each lesson's page pointer checked against them |

### OD-05 — CT to parent view

| ID      | Path                                                                     | Native locator                     | Graph                      | Kind                                 | SHA-256             | Purpose                                                                                                                                       |
| ------- | ------------------------------------------------------------------------ | ---------------------------------- | -------------------------- | ------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| E-05-01 | `od-05/camera.json`                                                      | —                                  | —                          | JSON                                 | `e3cd1b2c4320d827…` | Both examples: three frames, camera position/forward/up/basis, schematic and perspective projections, patient axes, candidate roll arithmetic |
| E-05-02 | `od-05/native-planes.json`                                               | —                                  | —                          | JSON                                 | `2dbc4dbcfe97af72…` | Decision records and crop boxes for the two examples                                                                                          |
| E-05-03 | `od-05/central-junction-1/native-slice-408.png`                          | slice 408 (z -164.5)               | node 1; edges 0 → 1, 2     | image                                | `7fee2e60d5257cc3…` | Central fork, slice 408, no annotation (frame 1)                                                                                              |
| E-05-06 | `od-05/central-junction-1/overlay-slice-408.png`                         | slice 408 (z -164.5)               | node 1; edges 0 → 1, 2     | image                                | `bde73f6e064f16b6…` | Central fork, slice 408, existing model points (frame 1)                                                                                      |
| E-05-04 | `od-05/central-junction-1/native-slice-392.png`                          | slice 392 (z -172.5)               | node 1; edges 0 → 1, 2     | image                                | `a1410c2342661e9d…` | Central fork, slice 392, no annotation (frame 1)                                                                                              |
| E-05-07 | `od-05/central-junction-1/overlay-slice-392.png`                         | slice 392 (z -172.5)               | node 1; edges 0 → 1, 2     | image                                | `30b9db1317c64d36…` | Central fork, slice 392, existing model points (frame 1)                                                                                      |
| E-05-05 | `od-05/central-junction-1/native-slice-387.png`                          | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | image                                | `86abc2fda6e7aed0…` | Central fork, slice 387, no annotation (frame 1)                                                                                              |
| E-05-08 | `od-05/central-junction-1/overlay-slice-387.png`                         | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | image                                | `bda8dd54f7c10923…` | Central fork, slice 387, existing model points (frame 1)                                                                                      |
| E-05-09 | `od-05/central-junction-1/display-standard-overlay-slice-387.png`        | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | image                                | `5e9d57a0b68d566c…` | Central fork, frame 2 = lesson default (standard axial)                                                                                       |
| E-05-10 | `od-05/central-junction-1/display-mirror-overlay-slice-387.png`          | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | image                                | `0e5c8d6a0eb875ac…` | Central fork, frame 2 = regional preset (left–right reflection)                                                                               |
| E-05-11 | `od-05/central-junction-1/display-standard-native-slice-387.png`         | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | image                                | `98d3e6eef3ffda31…` | As E-05-09 without model points                                                                                                               |
| E-05-12 | `od-05/central-junction-1/display-mirror-native-slice-387.png`           | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | image                                | `018c6cd534b8f4fd…` | As E-05-10 without model points                                                                                                               |
| E-05-13 | `od-05/central-junction-1/app-02-parent-view-step-paired-view.png`       | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | module screenshot (isolated browser) | `74fbc84d45cf4814…` | Central fork, frame 3: the module's paired view with its A/B letters                                                                          |
| E-05-14 | `od-05/central-junction-1/app-02-parent-view-step-parent-map.png`        | —                                  | node 1; edges 0 → 1, 2     | module screenshot (isolated browser) | `48715239087d9fe3…` | Central fork: the module's direction schematic                                                                                                |
| E-05-15 | `od-05/central-junction-1/app-02-parent-view-step-page.png`              | slice 387 (z -175.0)               | node 1; edges 0 → 1, 2     | module screenshot (isolated browser) | `b72ac82ecad049bc…` | Central fork: whole page at the parent-view step                                                                                              |
| E-05-16 | `od-05/central-junction-1/app-02-parent-view-step-facts.json`            | —                                  | node 1; edges 0 → 1, 2     | JSON                                 | `267ca3095b87bfc7…` | Central fork: pose attribute, captions and letters read from the page                                                                         |
| E-05-17 | `od-05/central-junction-1/app-01-worked-example-paired-view.png`         | slice 408 (z -164.5)               | node 1; edges 0 → 1, 2     | module screenshot (isolated browser) | `de7bc0886e4a9f71…` | Central fork: paired view during the worked example at slice 408 (before any response)                                                        |
| E-05-18 | `od-05/central-junction-1/app-01-worked-example-facts.json`              | —                                  | node 1; edges 0 → 1, 2     | JSON                                 | `519a0ebe24b972af…` | Central fork: page facts during the worked example                                                                                            |
| E-05-20 | `od-05/subsegmental-junction-14/contact-sheet-native.png`                | slice 428–400 (z -154.5 to -168.5) | node 14; edges 13 → 28, 29 | image                                | `374ab659c19947b0…` | RB1 region, planes 428 → 400, no annotation                                                                                                   |
| E-05-21 | `od-05/subsegmental-junction-14/contact-sheet-overlay.png`               | slice 428–400 (z -154.5 to -168.5) | node 14; edges 13 → 28, 29 | image                                | `5598aefd1eb5fdef…` | RB1 region with existing model points                                                                                                         |
| E-05-22 | `od-05/subsegmental-junction-14/native-slice-401.png`                    | slice 401 (z -168.0)               | node 14; edges 13 → 28, 29 | image                                | `faef45b1ac8e6dd7…` | Subsegmental fork, slice 401, no annotation (frame 1)                                                                                         |
| E-05-26 | `od-05/subsegmental-junction-14/overlay-slice-401.png`                   | slice 401 (z -168.0)               | node 14; edges 13 → 28, 29 | image                                | `0fa99329e0c756a6…` | Subsegmental fork, slice 401, existing model points (frame 1)                                                                                 |
| E-05-23 | `od-05/subsegmental-junction-14/native-slice-416.png`                    | slice 416 (z -160.5)               | node 14; edges 13 → 28, 29 | image                                | `106a9836b3187392…` | Subsegmental fork, slice 416, no annotation (frame 1)                                                                                         |
| E-05-27 | `od-05/subsegmental-junction-14/overlay-slice-416.png`                   | slice 416 (z -160.5)               | node 14; edges 13 → 28, 29 | image                                | `97174be056a1d507…` | Subsegmental fork, slice 416, existing model points (frame 1)                                                                                 |
| E-05-24 | `od-05/subsegmental-junction-14/native-slice-422.png`                    | slice 422 (z -157.5)               | node 14; edges 13 → 28, 29 | image                                | `4c64060a3332eeea…` | Subsegmental fork, slice 422, no annotation (frame 1)                                                                                         |
| E-05-28 | `od-05/subsegmental-junction-14/overlay-slice-422.png`                   | slice 422 (z -157.5)               | node 14; edges 13 → 28, 29 | image                                | `393e6dd633b25c69…` | Subsegmental fork, slice 422, existing model points (frame 1)                                                                                 |
| E-05-25 | `od-05/subsegmental-junction-14/native-slice-424.png`                    | slice 424 (z -156.5)               | node 14; edges 13 → 28, 29 | image                                | `abb88286b41e2084…` | Subsegmental fork, slice 424, no annotation (frame 1)                                                                                         |
| E-05-29 | `od-05/subsegmental-junction-14/overlay-slice-424.png`                   | slice 424 (z -156.5)               | node 14; edges 13 → 28, 29 | image                                | `c18b9228011ae4b6…` | Subsegmental fork, slice 424, existing model points (frame 1)                                                                                 |
| E-05-30 | `od-05/subsegmental-junction-14/display-standard-overlay-slice-422.png`  | slice 422 (z -157.5)               | node 14; edges 13 → 28, 29 | image                                | `1d9d2da7e79bdd58…` | Subsegmental fork, slice 422, frame 2 = lesson default (standard axial)                                                                       |
| E-05-31 | `od-05/subsegmental-junction-14/display-standard-native-slice-422.png`   | slice 422 (z -157.5)               | node 14; edges 13 → 28, 29 | image                                | `bb7e1ac5fd8bb98a…` | Subsegmental fork, slice 422, frame 2 = lesson default (standard axial), no model points                                                      |
| E-05-32 | `od-05/subsegmental-junction-14/display-standard-overlay-slice-424.png`  | slice 424 (z -156.5)               | node 14; edges 13 → 28, 29 | image                                | `61a02f1e84751ab4…` | Subsegmental fork, slice 424, frame 2 = lesson default (standard axial)                                                                       |
| E-05-33 | `od-05/subsegmental-junction-14/display-standard-native-slice-424.png`   | slice 424 (z -156.5)               | node 14; edges 13 → 28, 29 | image                                | `fccfd7d167268b49…` | Subsegmental fork, slice 424, frame 2 = lesson default (standard axial), no model points                                                      |
| E-05-34 | `od-05/subsegmental-junction-14/display-rul-overlay-slice-422.png`       | slice 422 (z -157.5)               | node 14; edges 13 → 28, 29 | image                                | `7f2ed40ad9972091…` | Subsegmental fork, slice 422, frame 2 = regional preset (90° counterclockwise)                                                                |
| E-05-35 | `od-05/subsegmental-junction-14/display-rul-native-slice-422.png`        | slice 422 (z -157.5)               | node 14; edges 13 → 28, 29 | image                                | `1d35385b36b20c99…` | Subsegmental fork, slice 422, frame 2 = regional preset (90° counterclockwise), no model points                                               |
| E-05-36 | `od-05/subsegmental-junction-14/display-rul-overlay-slice-424.png`       | slice 424 (z -156.5)               | node 14; edges 13 → 28, 29 | image                                | `f8ed3398c782b855…` | Subsegmental fork, slice 424, frame 2 = regional preset (90° counterclockwise)                                                                |
| E-05-37 | `od-05/subsegmental-junction-14/display-rul-native-slice-424.png`        | slice 424 (z -156.5)               | node 14; edges 13 → 28, 29 | image                                | `ef7963fbf983249b…` | Subsegmental fork, slice 424, frame 2 = regional preset (90° counterclockwise), no model points                                               |
| E-05-38 | `od-05/subsegmental-junction-14/app-02-parent-view-step-paired-view.png` | slice 422 (z -157.5)               | node 14; edges 13 → 28, 29 | module screenshot (isolated browser) | `f416e9c58b0e3be3…` | Subsegmental fork, frame 3: the module's paired view with its A/B letters                                                                     |
| E-05-39 | `od-05/subsegmental-junction-14/app-02-parent-view-step-parent-map.png`  | —                                  | node 14; edges 13 → 28, 29 | module screenshot (isolated browser) | `610ded650f993fe5…` | Subsegmental fork: the module's direction schematic                                                                                           |
| E-05-40 | `od-05/subsegmental-junction-14/app-02-parent-view-step-page.png`        | —                                  | node 14; edges 13 → 28, 29 | module screenshot (isolated browser) | `408a6d0996069c50…` | Subsegmental fork: whole page at the parent-view step                                                                                         |
| E-05-41 | `od-05/subsegmental-junction-14/app-02-parent-view-step-facts.json`      | —                                  | node 14; edges 13 → 28, 29 | JSON                                 | `1e2546c091bb8095…` | Subsegmental fork: pose attribute, captions and letters read from the page                                                                    |
| E-05-42 | `od-05/subsegmental-junction-14/app-01-worked-example-page.png`          | —                                  | node 14; edges 13 → 28, 29 | module screenshot (isolated browser) | `6d72a6b98f122986…` | Subsegmental fork: Lesson 4 worked example page (identities stated before marking)                                                            |

Every evidence item is local only and none is flagged as missing. What is missing is listed next.

## Missing evidence

| ID   | Decisions                         | What is missing                                                                                                                             | Where it was expected                                                                                             | What cannot be concluded without it                                                                                                                                        |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-01 | OD-01, OD-02, OD-03, OD-05, OD-06 | Any attributable human annotation or review: no reviewed plane, contour, landmark, opening position, caption or name exists for this CT.    | exercise.review (faculty-reviewed record: reviewer, date, geometryVersion) and the BBT-02 packet's decision table | Which plane shows the carina; what the LMSB lucency is; whether a/b names are right for this patient; whether opening letters sit on the real openings; any lumen verdict. |
| M-02 | OD-04, OD-03                      | The textbook's figures were not inspected; only the text layer was read. The PDF is outside Local-Data and outside the local-authoring map. | /Users/russellmiller/Projects/textbooks/Interventional Pulmonology/bronchial branch tracing.pdf                   | Whether the module's examples match the book's figures; a four-pattern figure for the course reference.                                                                    |
| M-03 | OD-01, OD-02                      | Coronal and sagittal reformats of the two regions were not prepared.                                                                        | would be derived from S-01                                                                                        | Nothing essential; offered only if the owner wants them to choose planes.                                                                                                  |
| M-04 | OD-03                             | The source label workbook labels_cleaned_names.xlsx was not opened; its derived centerline_labels.json was used.                            | Interventional-Pulm-Local-Data/raw-assets/anatomy/new_anatomy_module/                                             | Whether the workbook holds finer names than the derived file.                                                                                                              |
| M-05 | OD-05                             | No recorded bronchoscopy of this patient and no reviewed ostium map.                                                                        | does not exist                                                                                                    | Whether the modelled view matches what a scope would show at each fork.                                                                                                    |
| M-06 | all                               | No human learner or faculty observation. The walkthrough was an AI persona.                                                                 | owner's personal review (the next phase)                                                                          | Any claim about how real first-year fellows read these planes.                                                                                                             |

## Structured decision records

One record per decision, in the same fields. “Mechanically verifiable” and “Interpretation” are kept apart on purpose.

### OD-01 — The introductory / first bifurcation

| Field                       | Record                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision ID                 | OD-01                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Current review status       | **NOT REVIEWED** · OPEN · reviewer: — · date: — · decision: —                                                                                                                                                                                                                                                                                                                                                                                      |
| Source / version / hash     | S-01, S-02, S-03, S-04, S-07, S-06, S-08, S-11, S-13, S-15, S-30 (table above; full hashes in the JSON index)                                                                                                                                                                                                                                                                                                                                      |
| Current task / consumer     | Lesson 3 example 1 (central-right.junction-1.bifurcation): “Follow Trachea through this division. Mark each daughter on its answer slice, or record uncertainty.” Both daughter response points are on native slice 387; the worked demonstration plays slices 408 → 387 (22 planes); the learner can browse 384–411. Since Prompt 01, an entry note says before the task that the two main bronchi share one air column throughout that interval. |
| Reported concern            | BBTF-01 (walkthrough p. 9, Fig. 7; first of its top ten): the first bifurcation exercise never shows a bifurcation. The answer slice sits in one shared air column, the browsable interval ends at 384, and the same junction opens Lesson 9, Practice and More routes. The report's proposal (extend to about 372, move the answer slices below the carinal spur) is a candidate, not an approved plane.                                          |
| Existing reviewed evidence  | None. Every local exercise carries review.status “provisional”; the BBT-02 five-junction packet is NOT REVIEWED; clinical-review.md states that engineering review is not faculty sign-off; asset-inventory.json records no checkpoint-level physician approval. No reviewed contour, landmark or plane exists for this division.                                                                                                                  |
| Exact question for reviewer | **What should the first visible bifurcation teaching example actually show, and which native planes/points should be used for parent and daughters?**                                                                                                                                                                                                                                                                                              |
| Implementation status       | **NOT IMPLEMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                                |

**What is mechanically verifiable**

- Source identity: the CT hash equals the manifest; the graph hash equals the manifest; 236 of 236 exported planes are pixel-identical to the native plane under the manifest window; 183 of 183 exported points agree with the CT in slice, pixel and HU.
- Native frame: 512 × 512 × 636, spacing 0.689453125 × 0.689453125 × 0.5 mm, space left-posterior-superior, direction matrix diagonal, origin (−182.155, −374.155, −368.5) mm; z(k) = −368.5 + 0.5·k, so a higher slice index is more cranial.
- Graph node 1 (the graph's own field carinaNodeId; node kind “carina”) is at LPS (−11.958, −155.962, −172.421) mm = slice index 392.16. Parent edge 0 (source label TR) runs k 626.56 → 392.16; daughter edge 1 (RMSB) k 392.16 → 365.48; daughter edge 2 (LMSB) k 392.16 → 339.18.
- The response points are generated by a rule, not chosen per junction: parent point = min(8 mm, 0.65 × edge length) proximal to the node; daughter point = min(5 mm, 0.55 × edge length) distal, with an HU fallback. Across the export 110 of 115 distinct daughter points sit at that nominal rule (80 at 5 mm, 30 at 0.55 × length), 2 at a fallback, 3 limited by a route's distal sample; all 57 parent points sit at the rule. Here: parent exactly 8.0 mm proximal (slice 408); both daughters exactly 5.0 mm distal (slice 387), pixels (240.63, 315.70) and (253.01, 316.66), 8.6 mm apart.
- The browsable interval 384–411 is derived (demonstration and answer levels ± 3 planes); nothing in it was chosen by inspection.
- Threshold arithmetic on the native planes (4-connected air regions; −950, −900 and −850 HU give the same result): the edge-1 and edge-2 centreline crossings lie in ONE air region on every plane from 392 to 376, and in SEPARATE regions from 375 caudally. On the straight line between the two crossings the maximum is −940 HU at 387, −885 at 384, −552 at 376, −218 at 375 (14 of 200 samples above −400 HU), +81 at 374 and +114 at 372.
- Offsets: plane 375 is 12 planes (6.0 mm) caudal to the response plane, 9 planes (4.5 mm) caudal to the interval's caudal end, and 8.6 mm caudal to the node. Along the centrelines it is 16.2 mm (edge 1) and 15.4 mm (edge 2) from the node; plane 372 is 19.2 and 17.6 mm.
- Consumers: junction-1 is the first checkpoint of all 17 routes (17 exist). Draft signatures: the harness reproduces all 21 pinned signatures; moving both daughter response points (in memory only) changes 14 of 21, and 16 of 21 when the export's derived crop fields are regenerated as the generator would.

**What remains interpretation**

- “The carina”, “the visible split” and “two lumens with a ridge between them” are image readings. No plane, wall or landmark has been annotated by a person. The arithmetic above is a proxy at stated thresholds.
- AI observation of the contact sheet (this session, unreviewed): one round lumen on 411–396; widening and transverse elongation on 395–388; one elongated air column on 387–376; a waist at 375; a thin partition on 374–372; two separate oval lumens by 371–366.
- The shipped entry note and BBT-02 packet say the separate lumens appear “at about slice 378 to 375” (an authoring reading of 2026-09-14). The arithmetic puts the first separation at 375, with one air region still present on 378–376. That text is NOT REVIEWED; whether it should change is part of this decision.
- Why the node sits about 8.6 mm cranial to the first separation: a centreline graph branches where the medial axis divides, inside the widening parent, proximal to the wall between the daughters. Offered as engineering context; it is not an anatomical finding.
- What a learner should mark on any of these planes, and what counts as an acceptable mark, is a teaching judgement.

**Candidate change(s) — none applied**

- Option A — keep slice 387 and describe it plainly as a proximal model reference; add reviewed visible-split teaching separately (planes chosen by the owner from the 376–370 band), outside the signed exercise data.
- Option B — choose reviewed new demonstration and/or response planes for this junction (a per-junction exception to the generator rule, or a changed rule).
- Option C — replace the introductory example with another existing fork; junction-1 stays as it is on the routes.

**Sub-questions**

- Is slice 387 acceptable as a proximal model-reference location, described as such, rather than a visible two-lumen bifurcation?
- Which native planes best show continuity through the split, and what should a learner mark on them?
- Should Lesson 3 change only its demonstration, also its response planes, or use a different fork?
- Which of Lesson 9, Practice and More routes should adopt the same reviewed change?

**Affected consumers**

- Lesson 1 interval 1 (central-right.junction-1.same-lumen; Trachea 416 → 412): parent lumen only; not asked for two daughters.
- Lesson 2 (central-right.junction-1.viewpoint; Trachea 416 → 412): parent lumen only.
- Lesson 3 example 1 (central-right.junction-1.bifurcation): the two-daughter task on slice 387.
- Lesson 9: worked route RS8 (right-lower-basal), the learner's route LS9 (left-lower-basal) and the transfer route LS5 (left-lingula) all open with junction-1.
- Practice: all 10 single-target routes and the mixed set of 4.
- More routes (/assess): all 4 routes.
- content/junction-feedback.ts packet junction-1 (entry note, divergence, continuity, revisit intervals 392→387 and 387→384) and docs/gap-remediation/bbt/BBT-02-junction-packet.md.

**Draft / signature compatibility**

- Stable ids to keep under any option: checkpoint id junction-1, node 1, edges 0/1/2, trace ids, lesson ids, exercise id central-right.junction-1.bifurcation.
- Response planes changed in the export (Option B on the routes): 14 of 21 signatures move at minimum — learn.continuity, learn.variants-limits, both route sets and all 10 single-target Practice sets — and 16 of 21 (adding learn.follow-one-airway and learn.orientation) once the generator recomputes this junction's crop fields. The five unaffected are Lessons 4–8.
- A new source version would be needed: the registry is hash-pinned by tests and by the Prompt 01–04 protected lists.
- A draft whose signature no longer matches is not resumed; it is kept under a recovery key on the next successful save (engine/ct-draft.ts). Old marks are not re-read against new planes. Adding a signature alias would make them be, which the brief rules out for changed anatomy.
- Option A implemented outside the signed objects (as the Prompt 01 entry note was) moves no signature. If it widens the exercise's browsable range, learn.continuity moves.
- Option C changes learn.continuity only (shown in memory: 71168219 → 7fe48a82 when example 1 is swapped for junction-10).

**Missing evidence**

- No attributable human annotation of the carinal plane, the wall, or an acceptable mark region.
- No reviewed contour exists in the module (the type and drawing path exist; no exercise uses them).
- Coronal or sagittal reformats were not prepared. The native volume supports them; the module is axial only.
- The textbook figures were not inspected (text layer only).
- No human learner observation of this exercise.

### OD-02 — Left main bronchus interval 352 → 348: the neighbouring lucency

| Field                       | Record                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decision ID                 | OD-02                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Current review status       | **NOT REVIEWED** · OPEN · reviewer: — · date: — · decision: —                                                                                                                                                                                                                                                                                                                                                                                                |
| Source / version / hash     | S-01, S-02, S-03, S-04, S-07, S-06, S-10, S-13, S-14 (table above; full hashes in the JSON index)                                                                                                                                                                                                                                                                                                                                                            |
| Current task / consumer     | Lesson 1 interval 2 (central-left.junction-3.same-lumen): “Follow LMSB to the nearby answer slice and mark the same lumen, or record uncertainty.” Start slice 352, response slice 348, browsable 345–355, standard axial. Captions are generic (“Inspect the air column and its bounding walls on this neighboring plane”). The lesson's teaching says: “A nearby lucency that is not continuous with it, such as another bronchus, is a different airway.” |
| Reported concern            | BBTF-24 (walkthrough p. 6, Fig. 4): at 352 a separate round lucency sits next to the left main bronchus; by 350 a neck joins them; by 348 they are one elongated lumen. The lesson's rule says a non-continuous lucency is a different airway, and here it becomes continuous, with no caption.                                                                                                                                                              |
| Existing reviewed evidence  | None. BBT-01 holds the whole introductory interval and its copy for faculty review (BBT-01 handoff, holds table). No caption or annotation for this lucency exists.                                                                                                                                                                                                                                                                                          |
| Exact question for reviewer | **What is the neighbouring/merging lucency, and what is the accurate explanatory caption?**                                                                                                                                                                                                                                                                                                                                                                  |
| Implementation status       | **NOT IMPLEMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**What is mechanically verifiable**

- The interval is rule-generated: the exported parent point of junction-3 is 8.0 mm proximal to graph node 3 on edge 2 (slice 344); the same-lumen exercise starts 8 planes above it (352) and responds 4 planes above it (348).
- Graph: edge 2 (source label LMSB) ends at node 3 at k 339.18. Edge 496 (source label LUL) runs from node 3 cranially to node 21 at k 347.78. From node 21, edge 21 (source label LUL; authored name “LUL division · Left upper division bronchus”) continues cranially to k 370.76 and edge 20 (LB4+5) runs caudally.
- On planes 360–351 the air region that contains the edge-2 crossing contains no other source-edge crossing, and a separate air region about 31 mm to the patient-left and 14 mm anterior (centreline to centreline at 352) contains the crossing of edge 21. The two are one 4-connected air region from slice 350 caudally at −900 HU and from slice 349 at −950 HU. From 347 caudally the same region also contains the crossings of edges 496 and 20.
- So the lesson's five planes (352, 351, 350, 349, 348) span exactly the planes on which the two air regions join. The join is about 10 planes (5 mm) cranial to graph node 3.
- At the response pixel on slice 348 the nearest voxel is −868 HU.

**What remains interpretation**

- What the neighbouring lucency IS. The source graph places edge 21 in it, and the authored nomenclature calls that edge the left upper division bronchus. Both are unreviewed model labels (the raw source label for edges 496 and 21 is simply LUL). Naming the lucency from that is an inference.
- AI observation of the contact sheet (unreviewed): an elongated lumen with a separate small round lucency to its patient-left and anterior on 360–353; a tail toward it at 352; a neck at 351–350; one elongated lumen on 349–345.
- Whether a learner who marks the joined region at 348 has “stayed in the left main bronchus”, and how that should be explained, is a teaching judgement.

**Candidate change(s) — none applied**

- Add one reviewed caption to this interval naming the structure and saying why the traced lumen is still the left main bronchus.
- Or move the interval to planes where no second lumen joins (for example cranial of 353), which changes the exercise geometry.
- Or keep the interval and use the join as the teaching point, with reviewed wording.

**Affected consumers**

- Lesson 1 interval 2 only. junction-3 is also the second checkpoint of six left-sided routes, but there it is the LMSB → LLL / LUL division (parent 344, responses 332 and 341), not this interval.

**Draft / signature compatibility**

- A caption or teaching sentence held outside the signed exercise data (lesson text, or a lookup keyed by checkpoint id) moves no signature.
- Moving the interval changes the exercise's trace and answer point, so learn.follow-one-airway moves and its drafts are kept for recovery, not resumed.

**Missing evidence**

- No attributable identification of the lucency.
- No reviewed caption.
- The exact textbook page for single-lumen following is still unconfirmed (Lesson 1 pointer: “Chapter 1 · exact page not yet confirmed”).

### OD-03 — Duplicate and provisional branch names

| Field                       | Record                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision ID                 | OD-03                                                                                                                                                                                                                                                                                                                                           |
| Current review status       | **NOT REVIEWED** · HELD for the owner · reviewer: — · date: — · decision: —                                                                                                                                                                                                                                                                     |
| Source / version / hash     | S-04, S-06, S-07, S-10, S-28, S-31 (table above; full hashes in the JSON index)                                                                                                                                                                                                                                                                 |
| Current task / consumer     | Since Prompt 03 every division is shown as Parent / Daughter A / Daughter B with the source code appended, and the source direction label appended when a code repeats (for example “Daughter A · RB3a · more cranial”). Stored labels and source codes are unchanged. Subsegment letters are shown with a pending-review note and never asked. |
| Reported concern            | BBTF-06 and BBTF-34 (walkthrough pp. 12, 14, 16–17): RB3a → RB3a / RB3a, LB6 → LB6 / LB6, RB4 → RB4 / RB4a and LB9 → LB9 / LB9 cannot be told apart by name; the RB1 a/b assignment was asked before it was given.                                                                                                                              |
| Existing reviewed evidence  | None. nomenclature-review.md: “Anatomical assignments by Codex using the owner-supplied textbook and existing case assets; this is not faculty sign-off.” The junction packet marks every a/b assignment “pending faculty review”.                                                                                                              |
| Exact question for reviewer | **Which duplicate/source labels may remain as source labels, and which require reviewed nomenclature or revised a/b assignment?**                                                                                                                                                                                                               |
| Implementation status       | **NOT IMPLEMENTED**                                                                                                                                                                                                                                                                                                                             |

**Source-identity table** (stable technical identity · neutral display identity · anatomical name)

| Example                                  | Node | Role       | Edge | Raw source label | Authored name | Module code | Source direction | Response slice | Origin of the code                                            |
| ---------------------------------------- | ---- | ---------- | ---- | ---------------- | ------------- | ----------- | ---------------- | -------------- | ------------------------------------------------------------- |
| RB1 a/b (provisional) · `junction-14`    | 14   | Parent     | 13   | RB1              | RB1           | RB1         | —                | 401            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 28   | RB1              | RB1b          | RB1b        | More anterior    | 422            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter B | 29   | RB1              | RB1a          | RB1a        | More posterior   | 424            | authored (nomenclature-v1)                                    |
| RB5 a/b (provisional) · `junction-20`    | 20   | Parent     | 19   | RB5              | RB5           | RB5         | —                | 307            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 40   | —                | RB5a          | RB5a        | More cranial     | 309            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter B | 41   | —                | RB5b          | RB5b        | More caudal      | 301            | authored (nomenclature-v1)                                    |
| RB3 → RB3 / RB3a · `junction-8`          | 8    | Parent     | 7    | RB3              | —             | RB3         | —                | 384            | inherited from the parent or the raw label; no authored entry |
|                                          |      | Daughter A | 14   | RB3              | —             | RB3         | More anterior    | 386            | inherited from the parent or the raw label; no authored entry |
|                                          |      | Daughter B | 15   | RB3              | RB3a          | RB3a        | More posterior   | 386            | authored (nomenclature-v1)                                    |
| RB3a → RB3a / RB3a · `junction-16`       | 16   | Parent     | 15   | RB3              | RB3a          | RB3a        | —                | 386            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 32   | RB3              | RB3a          | RB3a        | More cranial     | 396            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter B | 33   | RB3              | RB3a          | RB3a        | More caudal      | 384            | authored (nomenclature-v1)                                    |
| RB4 → RB4 / RB4a · `junction-19`         | 19   | Parent     | 18   | RB4              | RB4           | RB4         | —                | 307            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 38   | RB4              | —             | RB4         | More anterior    | 307            | inherited from the parent or the raw label; no authored entry |
|                                          |      | Daughter B | 39   | RB4              | RB4a          | RB4a        | More posterior   | 307            | authored (nomenclature-v1)                                    |
| LB6 → LB6 / LB6 (first) · `junction-11`  | 11   | Parent     | 10   | LB6              | LB6           | LB6         | —                | 325            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 22   | LB6              | —             | LB6         | More caudal      | 324            | inherited from the parent or the raw label; no authored entry |
|                                          |      | Daughter B | 23   | LB6              | LB6           | LB6         | More cranial     | 334            | authored (nomenclature-v1)                                    |
| LB6 → LB6 / LB6 (second) · `junction-25` | 25   | Parent     | 23   | LB6              | LB6           | LB6         | —                | 332            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 49   | LB6              | —             | LB6         | More left        | 337            | inherited from the parent or the raw label; no authored entry |
|                                          |      | Daughter B | 50   | LB6              | LB6           | LB6         | More right       | 345            | authored (nomenclature-v1)                                    |
| LB6 → LB6 / LB6 (third) · `junction-52`  | 52   | Parent     | 50   | LB6              | LB6           | LB6         | —                | 343            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 101  | LB6              | —             | LB6         | More left        | 358            | inherited from the parent or the raw label; no authored entry |
|                                          |      | Daughter B | 102  | LB6              | —             | LB6         | More right       | 354            | inherited from the parent or the raw label; no authored entry |
| LB9 → LB9 / LB9 · `junction-53`          | 53   | Parent     | 51   | LB9              | LB9           | LB9         | —                | 272            | authored (nomenclature-v1)                                    |
|                                          |      | Daughter A | 103  | LB9              | —             | LB9         | More cranial     | 262            | inherited from the parent or the raw label; no authored entry |
|                                          |      | Daughter B | 104  | LB9              | —             | LB9         | More caudal      | 252            | inherited from the parent or the raw label; no authored entry |

Consumers: `junction-14` — Lesson 4 example 1; routes right-upper-apical (RS1: Practice single target and mixed set), right-upper-entry, right-upper-distal; `junction-20` — Lesson 6 examples 1 and 2; routes middle-lobe-caudal (RS5: Practice), middle-lobe-entry (mixed set), middle-lobe-cranial; overview naming line RS5 → RB5 → RB5b; `junction-8` — Routes upper-oblique-lateral (RS3: Practice, More routes) and upper-oblique-medial; `junction-16` — Lesson 7 example 1; routes upper-oblique-lateral (RS3: Practice, More routes) and upper-oblique-medial; `junction-19` — Lesson 5 example 2; route middle-lobe-lateral (RS4: Practice); `junction-11` — Lesson 8 example 1; route left-lower-returning (LS6: Practice single target and mixed set); `junction-25` — Lesson 8 example 2; same route; `junction-52` — Lesson 8 example 3; same route; `junction-53` — Route left-lower-basal (LS9: Lesson 9 learner's route, Practice).

Review status of every row: **NOT REVIEWED**.

**What is mechanically verifiable**

- Identity table (node, parent edge, daughter edges, raw source label, authored name, module code, source direction, response slice, consumers): generated from S-04, S-06, S-07 and S-10 and printed below this record.
- The raw source labels (centerline_labels.json) name territories, not subsegments: every edge in the RB1, RB3, RB4, LB6 and LB9 territories carries the same label; the RB5 daughters (edges 40, 41) carry no raw label.
- The authored names (airway-nomenclature.json, nomenclature-v1, 36 edges) add RB1a, RB1b, RB3a, RB4a, RB5a and RB5b, each with a written basis. Where no name was authored, a daughter inherits its parent's code: edge 14 stays RB3 beside RB3a; edge 38 stays RB4 beside RB4a; all LB6 and LB9 descendants stay LB6 and LB9.
- Daughter A and B are the source option order (index 0 and 1), never a screen position. Direction labels come from the axis with the largest spread between the daughters' response points.
- Textbook text layer (AI reading, not a review): p. 27 gives B1a dorsal and B1b ventral; pp. 46–47 give B5a horizontal and B5b caudal, and B4a / B4b as the two daughters of B4; p. 27 places B3b ventral and B3a lateral. These match the directions the authored basis states.

**What remains interpretation**

- Whether the authored a/b assignments are right for THIS patient's anatomy.
- Whether the unnamed siblings should be called RB3b and RB4b, as the textbook's general scheme would suggest. No name was added.
- Whether LB6 and LB9 descendants should carry finer names at all.

**Candidate change(s) — none applied**

- Keep all current source labels with neutral A/B display (no change).
- Approve, revise or remove individual a/b assignments (RB1a/b, RB5a/b, RB3a, RB4a).
- Name currently unnamed siblings (for example edge 14, edge 38) from a reviewed source.

**Affected consumers**

- RB1 a/b: Lesson 4 example 1; routes right-upper-apical (RS1: Practice single and mixed set), right-upper-entry, right-upper-distal.
- RB5 a/b: Lesson 6 (both examples); routes middle-lobe-caudal (RS5), middle-lobe-entry (mixed set), middle-lobe-cranial; the overview's RS5 → RB5 → RB5b naming line.
- RB3a: Lesson 7 example 1; routes upper-oblique-lateral (RS3: Practice, More routes), upper-oblique-medial.
- RB4 / RB4a: Lesson 5 example 2; route middle-lobe-lateral (RS4).
- LB6: Lesson 3 example 2, Lesson 8 (three examples); route left-lower-returning (LS6: Practice single and mixed set).
- LB9: route left-lower-basal (LS9: Lesson 9 learner's route, Practice).

**Draft / signature compatibility**

- Display-only naming (as Prompt 03 did) moves no signature and no stored label.
- Changing an airway code in the export changes airway.code and option.label inside the signed route data, so every signature that includes that route moves; stored answer labels (for example “A · RB1b”) in old drafts would then name the old code.

**Missing evidence**

- No attributable nomenclature review.
- Textbook figures 2.9–2.10 and 2.47–2.49 were not inspected as images.
- The full source label workbook (labels_cleaned_names.xlsx) was not opened; its derived JSON was used.

### OD-04 — Four patterns and direction reversal

| Field                       | Record                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision ID                 | OD-04                                                                                                                                                                                                                                                                                                                                               |
| Current review status       | **NOT REVIEWED** · OWNER-HELD · reviewer: — · date: — · decision: —                                                                                                                                                                                                                                                                                 |
| Source / version / hash     | S-14, S-16, S-27, S-31 (table above; full hashes in the JSON index)                                                                                                                                                                                                                                                                                 |
| Current task / consumer     | The course reference names four patterns and maps them to Lessons 4–7; each definition is two sentences taken verbatim from that lesson. “A change in tracing direction” is listed as related, not a fifth pattern, and taught in Lesson 8. Since Prompt 04 a short primer before marking notes where a daughter turns back and points to Lesson 8. |
| Reported concern            | BBTF-19, BBTF-07, BBTF-45 (walkthrough pp. 5, 9–10, 14, 16): the objectives promise four patterns the lesson titles never name; direction reversal is met in Lesson 3 (LB6) and Lesson 6 (RB5a) before Lesson 8 teaches it; a left-upper-division note sat in the LB6 lesson.                                                                       |
| Existing reviewed evidence  | None. clinical-review.md records that the four-pattern concepts were “read from the supplied PDF” by an AI session and leaves “case-specific exemplars and explanation wording” for review.                                                                                                                                                         |
| Exact question for reviewer | **How should the four patterns and direction reversal be introduced?**                                                                                                                                                                                                                                                                              |
| Implementation status       | **NOT IMPLEMENTED**                                                                                                                                                                                                                                                                                                                                 |

**What is mechanically verifiable**

- The textbook IS available locally (S-31), outside Local-Data. Prompt 04 recorded it as unavailable in that session; this session read its text layer. Figures were not inspected.
- Text layer, printed p. 7: section 1.3 step IV introduces four patterns by name — Vertical, Horizontal–horizontal, Horizontal–vertical, Horizontal–oblique — as one vertical pattern plus three for a route nearly parallel to the axial images. The module's four names and their order (Lessons 4, 5, 6, 7) match.
- Locators: vertical p. 7, Figs. 1.12–1.13; horizontal–horizontal pp. 7–10, Figs. 1.14–1.16 (and 1.21–1.22); horizontal–vertical p. 10, Fig. 1.17 (and 1.23); horizontal–oblique pp. 11–12, Figs. 1.18–1.20; one-line reminders for all four on p. 15.
- Text layer, printed pp. 15–17, Figs. 1.24–1.26: a separate section on bronchi that run caudally and then turn cranially (middle lobe, lingula, lower lobes), with right B6a as the representative case. It comes AFTER the four patterns.
- Lesson page pointers checked against the text layer: Lessons 2–6, 8 and 9 are consistent. Lesson 7's pointer lists Figs. 1.18–1.23, but Figs. 1.21–1.22 are captioned horizontal–horizontal and Fig. 1.23 horizontal–vertical. Lesson 1's pointer is still “exact page not yet confirmed”.
- Current sequence: 1 Follow one airway · 2 Relate CT to the parent airway view · 3 Follow the airway through a bifurcation · 4 vertical · 5 horizontal–horizontal · 6 horizontal–vertical · 7 horizontal–oblique · 8 Build a short route map (change in tracing direction) · 9 Build and check a complete CT trace.
- A daughter first turns back against the direction of travel in Lesson 3 example 2 (junction-6: parent followed caudally 332 → node 321.1, LB6 response on 326). The same condition holds at Lesson 4 example 2 (junction-9) and Lesson 7 example 1 (junction-16), and in Lesson 6 one daughter (RB5a) rises from an in-plane parent — all before Lesson 8.

**What remains interpretation**

- Whether each lesson's CT example is a valid instance of the pattern it is labelled with (for example Lesson 4 example 2, RLL → basal / RB6, under “vertical”; Lesson 6, RB5 → RB5a / RB5b, under “horizontal–vertical”). The textbook's own examples differ from the module's.
- AI reading: the textbook's caudal-then-cranial section also states that the relative position of the two B6a daughters is opposite between the axial-CT branch diagram and the bronchoscopic view at the B6 orifice. Lesson 8's text teaches continuity through the turn and mentions the coronal MPR; it does not carry that statement.
- The module reads the textbook's “left superior segment” as the left upper division. The text layer supports the context (traced toward the apex; listed beside the lingular bronchus) but never says “upper division”.
- “Spur angle”: the textbook uses “the angle of the spur” (pp. 4, 15) and “the spur direction” (p. 16) without a separate definition.

**Candidate change(s) — none applied**

- Storyboard 1 (no reorder): keep the sequence; make the existing turn-back primer at Lesson 3 example 2 a short captioned demonstration of that same division, with reviewed wording, and keep Lesson 8 as the full treatment.
- Storyboard 2 (no reorder): add the textbook's diagram-inversion point to Lesson 8's teaching, with reviewed wording and the pp. 15–17 locator, so Lesson 8 covers both halves of the textbook's section.

**Sub-questions**

- Taxonomy: are the four names, as used, the textbook's, and is “a change in tracing direction” correctly kept outside them?
- Regional applicability: is each lesson's example a fair instance of its pattern on this CT?
- Should a reversal be taught earlier than Lesson 8, and if so where?
- Should any lesson be reordered or replaced?

**Affected consumers**

- Overview and course reference; Lessons 3–8; the turn-back primer; Lesson 8's optional regional note.

**Draft / signature compatibility**

- Lesson text in content/lessons.ts for Lessons 1–8 is outside the local signatures (they hash exercises only), so wording changes move nothing.
- Reordering lessons changes no signature by itself (signatures are per lesson id) but changes lesson numbers shown to learners and the saved “last lesson” pointer's meaning.
- Replacing an example changes that lesson's signature (its exercise list).

**Missing evidence**

- Textbook figures not inspected; no figure was drawn.
- No source review of the four definitions' wording against the book by a person.
- The textbook PDF is not in Local-Data and not in the local-authoring map.

### OD-05 — CT-to-parent-view correspondence and opening labels

| Field                       | Record                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decision ID                 | OD-05                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Current review status       | **NOT REVIEWED** · HELD for the owner · reviewer: — · date: — · decision: —                                                                                                                                                                                                                                                                                                                                              |
| Source / version / hash     | S-01, S-07, S-08, S-18, S-19, S-20, S-21, S-25, S-34 (table above; full hashes in the JSON index)                                                                                                                                                                                                                                                                                                                        |
| Current task / consumer     | Every local lesson offers a paired model parent view beside the CT. At a division the camera sits on the parent centreline 8 mm proximal to the node, looks at the node, and holds a per-region reference direction at the top. Letters A / B are drawn at each daughter's model response point when it is in line of sight. A direction schematic numbers the openings by screen position and letters them by CT order. |
| Reported concern            | BBTF-04, BBTF-13 (walkthrough pp. 10, 12, Figs. 9, 12): the bronchoscopic view was hidden and unlabelled; diagrams were tiny and numbered 1/2 against the CT's A/B. Prompt 03 repaired discoverability and labelling; whether the labels correspond to the real openings was left to the owner.                                                                                                                          |
| Existing reviewed evidence  | None. clinical-review.md leaves “actual browser pose, FOV, roll, visible ostia/spurs” for approval. The parent-view openings are named in each exercise's provisional review reason.                                                                                                                                                                                                                                     |
| Exact question for reviewer | **Are the current CT-to-parent-view correspondence and opening labels anatomically useful and appropriate for teaching?**                                                                                                                                                                                                                                                                                                |
| Implementation status       | **NOT IMPLEMENTED**                                                                                                                                                                                                                                                                                                                                                                                                      |

**What is mechanically verifiable**

- Central fork, junction-1 (Lesson 3 example 1). Frame 1: node 1; parent edge 0, point on slice 408; Daughter A = edge 1 (source code RMSB, “more right”), Daughter B = edge 2 (LMSB, “more left”), both on slice 387. Frame 2: lesson default standard axial (A up, R screen-left); regional preset left–right reflection (A up, L screen-left). Frame 3: camera at LPS [-11.5543, -155.3175, -164.4569], forward [-0.050505, -0.080611, -0.995465] (caudal), reference up [0, −1, 0] (anterior), 8.0 mm from the node, 80° field of view, roll 0. Screen right = patient right. Daughter A projects to screen right (+0.83, −0.06), Daughter B to screen left (−0.87, +0.07).
- Subsegmental fork, junction-14 (Lesson 4 example 1). Frame 1: node 14; parent edge 13 (RB1), point on slice 401; Daughter A = edge 28 (source code RB1b, “more anterior”) on slice 422; Daughter B = edge 29 (RB1a, “more posterior”) on slice 424. Frame 2: lesson default standard axial; regional preset 90° counterclockwise (L up, A screen-left). Frame 3: camera at LPS [-48.155, -160.7597, -168.1703], forward [-0.316663, -0.083487, 0.944857] (cranial, tilted about 19° toward patient right), reference up [1, 0, 0] (patient left), 7.983 mm from the node. Screen right = posterior. Daughter A projects to screen left (−0.64, +0.01), Daughter B to screen right (+0.53, −0.03).
- The module's own pages report the same poses (data-scope-pose equals the harness to four decimals) and both equal the pinned fixture.
- In both examples the regional preset display and the camera share the same in-plane patient directions (central: A up, patient right on screen right; RB1: patient left up, anterior on screen left). In the lesson's default standard axial display they differ by a reflection (central) or a quarter turn (RB1).
- Letters follow the source option order and are drawn at the 5 mm (or 0.55 × length) model response point, projected with the rendered camera and tested for line of sight against the model surface.
- The reference up is a per-preset rule (anterior for reflected regions; patient left for the right upper lobe; patient right for the left upper division; superior when the preferred axis lies along the view). It does not depend on the learner's CT display.
- Candidate roll arithmetic (od-05/camera.json): the daughters' screen positions under each other reference direction, for comparison only.

**What remains interpretation**

- Whether a letter drawn at a model response point sits on the actual opening of that daughter. A label on a modelled opening is a model annotation.
- Whether the per-region roll matches how the scope is actually held at each fork, and whether it is the convention worth teaching.
- AI observation of the captures (unreviewed): at the tracheal division both letters fall near the mouths of two openings; at RB1 both letters fall close together near the centre of a small lumen.

**Candidate change(s) — none applied**

- Accept the current correspondence and labels as a teaching aid, with their model-annotation wording.
- Accept for central forks only, and withhold opening letters at subsegmental forks until reviewed.
- Change the roll rule or the label anchor for named regions, from a reviewed convention.

**Affected consumers**

- Every local lesson's paired view and parent-view step (Lessons 2–8); the direction schematic; route lessons and Practice once a junction is recorded or revealed.

**Draft / signature compatibility**

- The camera and the letters are computed at display time and are not part of any draft signature. Changing the roll rule or label anchors moves no signature.
- It would change the pinned camera fixture (128 decisions) and the saved parent-view choice's meaning for the independent matching try (stored as an opening number).

**Missing evidence**

- No reviewed ostium positions and no recorded bronchoscopy of this patient to compare with.
- Line-of-sight results were taken from the module's render, not recomputed here.
- Only two examples were prepared (plus numbers for junction-20 and junction-16 in camera.json).

### OD-06 — Qualitative lumen comparison policy

| Field                            | Record                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision ID                      | OD-06                                                                                                                                                                                                                                                                                                           |
| Current review status            | **NOT REVIEWED** · OPEN (proposal only) · reviewer: — · date: — · decision: —                                                                                                                                                                                                                                   |
| Source / version / hash          | S-13, S-15, S-23, S-24 (table above; full hashes in the JSON index)                                                                                                                                                                                                                                             |
| Current task / consumer          | After Check, each mark is compared with model locators on that plane: distance in millimetres to the intended locator and to the nearest other named model airway, with the statuses nearest-intended, nearest-other and unresolved. The text says the comparison cannot establish which lumen contains a mark. |
| Reported concern                 | BBTF-05 (walkthrough pp. 7, 10, 13): distances without a verdict; the report asked for a result band (in intended lumen / near the fork / likely another airway).                                                                                                                                               |
| Existing reviewed evidence       | None. No reviewed contour, wall annotation or accepted-alternative mark exists.                                                                                                                                                                                                                                 |
| Exact question for reviewer      | **Is there sufficient reviewed anatomical evidence to support any future qualitative lumen comparison policy?**                                                                                                                                                                                                 |
| What the evidence supports today | The evidence is currently insufficient: zero reviewed contours or wall annotations exist.                                                                                                                                                                                                                       |
| Implementation status            | **NOT IMPLEMENTED**                                                                                                                                                                                                                                                                                             |

**What is mechanically verifiable**

- The comparison is distance to centreline points only (engine/junction-feedback.ts). No inside/outside-lumen test, no accuracy band, no radius threshold.
- Model locators are centreline samples; the copy says “not reviewed wall contours or an answer key”.
- The annotation type supports a faculty-reviewed record (reviewer, date, geometry version) and an optional contour, and the viewer draws a contour only for that status. No exercise carries one: every review status is provisional.

**What remains interpretation**

- Whether any distance or threshold would be a fair stand-in for “inside the intended lumen” on this CT.

**Candidate change(s) — none applied**

- None proposed. A qualitative result would first need reviewed contours or accepted mark regions for the junctions concerned.

**Affected consumers**

- The comparison after Check in Lessons 3–8, Lesson 9, Practice and More routes.

**Draft / signature compatibility**

- Adding review records or contours to exercise data changes the signed review field, so the affected lesson signatures move.

**Missing evidence**

- Reviewed contours or mark regions for any junction.

### OD-07 — Instructional role of More routes

| Field                       | Record                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision ID                 | OD-07                                                                                                                                                                                                      |
| Current review status       | **NOT REVIEWED** · OWNER-HELD (proposal only) · reviewer: — · date: — · decision: —                                                                                                                        |
| Source / version / hash     | S-14, S-16, S-17 (table above; full hashes in the JSON index)                                                                                                                                              |
| Current task / consumer     | More routes is the fourth tab, at /assess: four routes on the same CT, presented since Prompt 04 as “Optional: 4 revisit routes, same CT”, with the same reference and help as Practice.                   |
| Reported concern            | BBTF-49 (walkthrough p. 19): two of the four routes were the worked example and transfer route of Lesson 9, all four can be picked in Practice, and the address says /assess although nothing is assessed. |
| Existing reviewed evidence  | None needed for the facts above; the role is an instructional-design choice.                                                                                                                               |
| Exact question for reviewer | **Should More routes retain a distinct revisit role, be merged into Practice, or be re-scoped later?**                                                                                                     |
| Implementation status       | **NOT IMPLEMENTED**                                                                                                                                                                                        |

**What is mechanically verifiable**

- Routes and targets: left-lingula (LS5), upper-oblique-lateral (RS3), right-lower-basal (RS8), left-upper-anterior (LS3).
- Overlap computed from the registries: all 4 are Practice targets; 2 are also in Lesson 9 (RS8 worked example, LS5 transfer route).
- It shares the Practice host; no score, no withheld reference, no completion requirement. Its draft key and signature are separate from Practice (assess.… = c6-local-teaching-r1.75f10d17).
- The /assess address is kept for compatibility with existing links and drafts.

**What remains interpretation**

- Whether a separate revisit set adds teaching value beyond Practice.

**Candidate change(s) — none applied**

- Keep as a distinct optional revisit set (current).
- Merge into Practice.
- Re-scope later (for example non-overlapping targets).

**Affected consumers**

- The More routes tab and /assess; overview course map; course outline.

**Draft / signature compatibility**

- Merging or changing the route list changes the set's draft key and signature; existing More routes drafts would be kept for recovery, not resumed. The /assess address should keep resolving.

**Missing evidence**

- No learner evidence on whether the set is used or useful.

## Separate runtime follow-up (not part of this packet)

Pre-existing and unrelated to this packet: the magnification slider reaches 4× (components/NativeCtViewer.tsx, range input max 4) while the saved viewer schema allows at most 2.5 (engine/ct-draft.ts viewerSchema). A magnification above 2.5 is saved, and on reload the local lesson draft fails to parse and is not resumed. The owner's brief records it reproduced at 3×; the Prompt 04 handoff logged it in Lessons 4 and 7. It was not re-run here.

Required before: **Prompt 06 combined acceptance**. Status: **NOT FIXED — separate runtime follow-up**. Not changed here: magnifier behaviour, draft validation, draft schema, parser, runtime state.

## Reproduce

The four scripts are in the evidence folder's `scripts/`; `README.md` there gives the commands. They read the CT, the graph and the module's files and write only to the evidence folder (and, for the index generator, these two documents).
