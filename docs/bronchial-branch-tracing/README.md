# Bronchial branch tracing — CT-first course preview

Entry: `/en/learn/anatomy/branch-tracing`. Anonymous direct access, noindex, no catalog/search/sitemap listing. The module remains unpublished. This branch does not deploy or merge it.

> **Self-paced since BBT-01 (September 14, 2026).** The owner's self-paced decision supersedes the examination wording kept below as history: the orientation check, independent parent-view responses, Assess withholding comparisons until submission, first-attempt and hint records. Current behavior, storage and test contracts are in [the BBT-01 handoff](../gap-remediation/self-paced/BBT-01-handoff.md). `/assess` now opens four more routes with the same references and help as Practice. Source geometry, coordinates, assets and draft identities are unchanged.

Nine stable lessons now progress from a same-lumen warm-up to the explicit CT/parent-view orientation bridge, then local bifurcations, the four patterns, a short connected map and complete route interpretation. The native CT task includes captioned walkthroughs, comparison and separate retries. The first parent relationship is guided before an independent local application; a repeated opening quiz is not required for every pattern. Practice defaults to one coached route with immediate junction comparison; Assess withholds reference comparison until submission. All examples still use one teaching scan.

See [the current flow and nine-lesson preservation matrix](flow-redesign.md), [executed validation and instructor-review routes](flow-redesign-validation.md), and [generated coverage/annotation manifest](flow-coverage.json). The [earlier instructional update](instructional-update.md) retains historical evidence. All supplied model locators remain provisional; no reviewed wall contours or clinical accuracy grades have been introduced.

Fresh tasks start standard axial. The book's optional regional conventions transform the actual images and their orientation labels after learner initiation:

- Middle lobe, lingula and lower lobes: left/right reflection of standard axial.
- Right upper lobe: 90° counterclockwise.
- Left upper division: 90° clockwise.

Standard axial, airway detail, full field, image magnification, slice scrolling, keyboard marking and expanded CT viewing are available. Marks retain their native pixel identity across viewing changes. An explicit unresolved-continuation response is accepted. The secondary Practice explorer retains the whole-volume preview and matched exterior/virtual-airway view.

## Review

- [Historical c5 teaching brief](module-brief.md)
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

Version `c6-local-teaching-r1` preserves participation history in the existing activity store and saves compatible drafts separately on this device. The new orientation bridge has its own `observer-comparison-r2` completion contract; older orientation participation and unrelated lesson completion remain. Local lessons, full routes, Practice and Assess restore their answers and viewing state, including disclosed transformed displays. First responses and supported retries remain separate. Incompatible or damaged drafts are preserved before replacement; storage failures offer honest recovery. A completed worksheet does not demonstrate tracing competence.

## Reproduce anatomical names

`python3 scripts/branch-tracing/label_native_traces.py` updates only manifest annotations. It verifies the original and labeled graphs, checks every selected complete polyline and node connection, and assigns checkpoints to their source edges within 0.0001 mm numerical tolerance. `authoring/airway-nomenclature.json` records normalized names and the explicit textbook/topology basis for each assignment. The Slicer exporter also invokes this same annotator. Slice PNGs, coordinates and progress IDs remain unchanged.

## Reproduce nodule targets

The exporter imports `residualHuAt` from the same shared core used by the navigation trainer. It reads the original signed-HU volume and existing `lung_nodule_1` residual/alpha data, then computes compact composited patches before applying the lung window. It does not edit the CT or the trainer.

```sh
BRANCH_TRACING_CT_SOURCE='/Users/russellmiller/Projects/navigation_module/data/target/target_clean_ct.nrrd' \
npx tsx scripts/branch-tracing/build-targets.ts
```

`authoring/nodule-targets.json` defines the segment, distal edge and donor scale. `public/branch-tracing/targets-v1` holds the derived manifest, 373 patch images and four additional native planes (239, 476–478), totaling 1,101,884 PNG bytes. Previous generated assets are pruned only when listed in this exporter's preceding manifest. Original `native-v1` images and annotations are unchanged. The browser transforms patches and base CT together, discloses patch failures, and offers an original-CT toggle. Targets identify the planning destination; airway reference points remain withheld until the learner submits the required interpretation.
