# Bronchial branch tracing — native CT preview

Entry: `/en/learn/anatomy/branch-tracing`. Anonymous direct access, noindex, no catalog/search/sitemap listing. The module remains unpublished. This branch does not deploy or merge it.

Learn, Practice and Assess now use actual 512×512 CT slices at native 0.5 mm spacing. Eight lessons teach the book's reflection/rotation conventions and four tracing patterns. Learners follow the lumen, place marks at three CT levels, describe the course and compare their own trace with source-derived geometry. Each lesson requires another CT trace before completion. Practice and Assess each have four traces with comparison delayed until final submission. This revision replaces the earlier synthetic lesson UI.

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

Trace specifications are in `scripts/branch-tracing/authoring/ct-traces.json`. Native assets are in `public/branch-tracing/native-v1`: 236 acquisition planes, levels 240–475, fixed window −1000 to 400 HU, 48,335,710 PNG bytes. The browser loads the current plane and two neighbors, not the full stack. Original NRRD, source labels, textbook pages and personal metadata are not distributed. The existing 6.4 MB whole-volume explorer package remains reproducible with `python3 scripts/branch-tracing/build-preview.py`.

Version `c2-ct1-r2` uses the existing bounded activity store. First recorded participation and hint count survive restart/reload, as does lesson completion. Incomplete work restarts; raw CT marks stay in session memory, with explicit local worksheet export available at independent debrief. Old synthetic records remain historical. No clinical accuracy grade, mastery threshold, reviewed branch-label claim or new-patient transfer claim is assigned.
