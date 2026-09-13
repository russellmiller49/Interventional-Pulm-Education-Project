# Bronchial branch tracing — local CT teaching preview

Entry: `/en/learn/anatomy/branch-tracing`. Anonymous direct access, noindex, no catalog/search/sitemap listing. The module remains unpublished. This branch does not deploy or merge it.

Nine lessons now begin with a single lumen, a local bifurcation and the parent-airway view, then progress through the four patterns, a short route and complete nodule approaches. The native CT teaching loop supports a captioned walkthrough, an attempt, immediate comparison, retries and an independent viewpoint response. Pattern lessons open at their local division. Practice defaults to one coached route with immediate junction comparison; Assess withholds comparison until submission. All examples still use one teaching scan.

See [the instructional update and review boundary](instructional-update.md) for the implementation, lesson alignment, draft contract and outstanding faculty work. All supplied model locators remain provisional; no reviewed wall contours or clinical accuracy grades have been introduced.

The book's conventions are applied to the actual images and their orientation labels:

- Middle lobe, lingula and lower lobes: left/right reflection of standard axial.
- Right upper lobe: 90° counterclockwise.
- Left upper division: 90° clockwise.

Standard axial, airway detail, full field, image magnification, slice scrolling, keyboard marking and expanded CT viewing are available. Marks retain their native pixel identity across viewing changes. An explicit unresolved-continuation response is accepted. The secondary Practice explorer retains the whole-volume preview and matched exterior/virtual-airway view.

## Review

- [Teaching brief](module-brief.md)
- [Source and coordinate audit](audit.md)
- [Architecture and progress](architecture-decision.md)
- [QA and H1–H12](qa-report.md)
- [Anatomical nomenclature and source figures](nomenclature-review.md)
- [Nodule source, placement and registration](nodule-target-review.md)
- [Clinical review boundary](clinical-review.md)
- [Slicer export evidence](native-export-review.json)
- [Browser measurements](browser-metrics.json)
- [Inspected screenshots](review/)

Run the normal website dev command, or `npx --no-install next dev --webpack -p 3110` if the unchanged embedded trainers are already built. Open `http://localhost:3110/en/learn/anatomy/branch-tracing`.

## Reproduce native CT assets

`export-native-slicer.py` verifies the original NRRD and graph hashes, loads the CT in an isolated Slicer process, and writes only the feature's windowed PNGs, manifest and export review. It does not save a scene or modify the source CT. The author's existing Slicer process is left alone.

```sh
BRANCH_TRACING_ROOT="$PWD" \
BRANCH_TRACING_CT_SOURCE='/Users/russellmiller/Projects/navigation_module/data/target/target_clean_ct.nrrd' \
/Applications/Slicer.app/Contents/MacOS/Slicer \
  --no-main-window --no-splash --disable-settings --ignore-slicerrc \
  --disable-cli-modules --python-script "$PWD/scripts/branch-tracing/export-native-slicer.py"
```

Trace specifications are in `scripts/branch-tracing/authoring/ct-traces.json`. Native assets are in `public/branch-tracing/native-v1`: 236 acquisition planes, levels 240–475, fixed window −1000 to 400 HU, 48,335,710 PNG bytes. The browser loads the current plane and two neighbors, not the full stack. Original NRRD, the full source label spreadsheet, textbook pages and personal metadata are not distributed. Selected anatomical names are included as derived teaching annotations. The existing 6.4 MB whole-volume explorer package remains reproducible with `python3 scripts/branch-tracing/build-preview.py`.

Version `c6-local-teaching-r1` preserves participation history in the existing activity store and saves compatible drafts separately on this device. Local lessons, full routes, Practice and Assess restore their answers and viewing state. Local attempts and retries remain separate. Incompatible drafts and storage failures produce explicit messages. A completed click sequence does not demonstrate tracing competence.

## Reproduce anatomical names

`python3 scripts/branch-tracing/label_native_traces.py` updates only manifest annotations. It verifies the original and labeled graphs, checks every selected complete polyline and node connection, and assigns checkpoints to their source edges within 0.0001 mm numerical tolerance. `authoring/airway-nomenclature.json` records normalized names and the explicit textbook/topology basis for each assignment. The Slicer exporter also invokes this same annotator. Slice PNGs, coordinates and progress IDs remain unchanged.

## Reproduce nodule targets

The exporter imports `residualHuAt` from the same shared core used by the navigation trainer. It reads the original signed-HU volume and existing `lung_nodule_1` residual/alpha data, then computes compact composited patches before applying the lung window. It does not edit the CT or the trainer.

```sh
BRANCH_TRACING_CT_SOURCE='/Users/russellmiller/Projects/navigation_module/data/target/target_clean_ct.nrrd' \
npx tsx scripts/branch-tracing/build-targets.ts
```

`authoring/nodule-targets.json` defines the segment, distal edge and donor scale. `public/branch-tracing/targets-v1` holds the derived manifest, 373 patch images and four additional native planes (239, 476–478), totaling 1,101,884 PNG bytes. Previous generated assets are pruned only when listed in this exporter's preceding manifest. Original `native-v1` images and annotations are unchanged. The browser transforms patches and base CT together, discloses patch failures, and offers an original-CT toggle. Targets identify the planning destination; airway reference points remain withheld until the learner submits the required interpretation.
