# SoCal EBUS Prep

This repository now targets the web app only. The active application lives in `apps/web`, with shared curriculum content and case assets kept at the repo root.

1. Ultrasound Foundations + EBUS Knobology
2. Mediastinal Station Map
3. CT ↔ Bronchoscopic ↔ Ultrasound Station Explorer

## Commands

From the repo root:

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run test
```

These commands proxy into `apps/web`.

## Notes for curriculum assets

- Use app-owned SVGs, illustrations, and de-identified sample images.
- Do **not** ship slide screenshots directly in the app UI.
- Keep all educational content in JSON/Markdown so it can be updated without restructuring the codebase.
- Make every simulation clearly educational and not a diagnostic device.

## Case 001 Co-Registration

The case 001 viewer now uses one shared patient-space scene rooted in `model/case_001_ct.nrrd`. The build step reads its `space origin`, `space directions`, and `sizes`, converts each `.mrk.json` control point into LPS world space, derives voxel indices with the inverse IJK-to-world transform, parses segmentation metadata from `model/case_001_segmentation.nrrd`, and writes the runtime payload to `content/cases/case_001.runtime.json`.

Source-of-truth order matters: CT geometry comes first, segmentation comes second, markups provide targets, and the GLB is optional display polish only. The segmentation labelmap is trusted before the GLB because it carries explicit medical-image geometry and segment metadata, while the GLB is a presentation export that must be brought back into patient space with an explicit inverse transform instead of being auto-centered or rescaled independently.

## Repo layout

```text
apps/
  web/
content/
  cases/
  course/
  modules/
  quizzes/
  stations/
assets/
  pretest/
features/
  case3d/
model/
scripts/
```
