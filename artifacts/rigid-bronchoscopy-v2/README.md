# Rigid bronchoscopy v2 golden renders

Captured from `http://localhost:3001/en/rigid-bronchoscopy/learn` on 2026-07-11 against
asset-manifest build `f768081bdbeed4a3`.

## Exact compact matrix

Every `compact-final-*` image is exactly 544 × 318 pixels. The set covers:

- controlled and spontaneous-assisted ventilation;
- low- and high-frequency jet ventilation;
- right- and left-mainstem procedural poses;
- fixed-complete and expiratory/ball-valve obstruction;
- main-axial and BB2401/BB2402 accessory instrument routes;
- normal and authored cutaway views for each instrument route.

## Responsive smoke renders

- `desktop-final-*`: 1280 × 900 browser viewport, 743 × 760 rendered scene.
- `mobile-final-*`: 390 × 844 browser viewport, 340 × 317 rendered scene.

These responsive sets include controlled ventilation, low-frequency jet ventilation, the validated
right-mainstem pose, and both instrument-entry routes. The images are visual-regression fixtures;
they are not clinical approval. Reviewer sign-off remains governed by
`docs/rigid-bronchoscopy-v2-release-checklist.md`.
