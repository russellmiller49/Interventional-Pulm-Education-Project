# Bronch Navigation Trainer: shared optics and CT

The trainer now uses the same patient-space optical frame, tissue shader and CT sampler as Synchronized Bronchoscopy and EBUS. Saved node camera adjustments still determine the reviewed branch views. The existing route and scoring logic, scope-controller input contract, nodule locations and airway graph are retained.

## Rendering and correlation

Initial branch view at the same 1600 × 1100 viewport: [before](navigation-imaging-review/before.png) and [after](navigation-imaging-review/after.png). The CT plane now follows the rendered optical camera, including its calibrated offset from the decision node.

- Welded mesh indexing produces smooth surface normals without changing airway vertex positions. Continuous tissue shading replaces the orange bands and square highlights. Field of view is constrained by the longest panel dimension, so a wider pane does not reveal a wider optical field.
- The optical camera publishes its rendered LPS frame. CT crosshairs and the 3D scope marker use that frame, including saved camera offsets. Occluded optical labels are removed from the visible and keyboard-accessible UI.
- The 3D scene updates the tip and viewing cone without recreating its WebGL context during insertion. Distant terminal markers are quieter, the route has shaded depth cues, and surface normals are smooth. Geometry and materials created by a scene are disposed when it is replaced; shared source geometry stays cached.

## CT

The original signed CT is resampled into a gzip preview at the trainer's existing 256 × 256 × 318 grid. This retains HU values from −1024 to 1887, including values lost by the older 8-bit windowed preview. The 29,414,890-byte derived asset is checked in, and its decoded hash is verified before use. Legacy case manifests still load their original preview.

All three panes share one worker, one signed preview and one 64 MiB native-region cache. Native 64³ regions use the same source CT and publication path as Synchronized Bronchoscopy. Per-pane window/level and follow-scope controls work with slice browsing, zoom, pan and route overlays. Patient-space inverse transforms account for direction cosines, reversed axes and anisotropic spacing. Displayed dimensions preserve physical aspect ratio. Airway-aligned CT uses transported route frames. Nodule residuals are placed in patient coordinates and added in HU before windowing.

The producer waits for a completed CT request before submitting the latest queued pose. This prevents continuous movement from discarding every completed image on slower devices. Slice results carry the exact plane that produced their pixels, so overlays never use a different resampling plane.

## Compatibility and validation

The reproducible route audit compares **208 terminal routes and 1,535 decision stops** with `origin/main`. All agree. The default route still has six decisions, ends at Node 91, and excludes terminal stub Node 156. Saved `scope_calibration.json` is byte-for-byte unchanged. All 120 comparisons of saved calibration plus live shaft rotation/flexion produce the same optical axes as the previous camera math. The audit also checks signed CT hashes, oblique/reversed transforms, nodule residual placement and session validation.

Practice/test progress is saved locally with a case/source identity. Reload restores the target, chosen route, current stop, insertion distance, profile and recorded test answers, with movement paused. An answered assessment stop restores the selected branch as well as its score, so advancement remains available after reload. Malformed or mismatched sessions are rejected. This uses no new database or server state.

Browser journeys completed five beginner stops and seven advanced stops, including wrong-choice feedback, withdrawal, session restore, CT controls and static CT-to-camera alignment, with no browser errors. Assessment resume is checked separately. Evidence and remaining review gates are recorded in the delivery checklist and `navigation-imaging-review/browser-review.json`. Physical controller operation and the 60 fps target require the reference desktop/controller; headless software WebGL cannot establish those measurements.

## Reproduce

```sh
/Applications/Slicer.app/Contents/bin/PythonSlicer navigation_module/scripts/prepare-shared-ct.py --source /path/to/primary/new_anatomy_module/target_clean_ct.nrrd --case-dir navigation_module/web/public/cases/default --airway-case-dir public/airway-anatomy/case-001
npx esbuild navigation_module/scripts/verify-shared-imaging.mts --bundle --platform=node --format=esm --packages=external --tsconfig=navigation_module/web/tsconfig.json --outfile=node_modules/.cache/navigation-review/verify.mjs
node node_modules/.cache/navigation-review/verify.mjs
node navigation_module/scripts/browser-shared-imaging-review.mjs
npm --prefix navigation_module/web run typecheck
npm --prefix navigation_module/web run build
```

The browser script defaults to port 3132; set `NAVIGATION_REVIEW_URL` for another server. The development server serves generated native CT from this worktree's `public/airway-anatomy` directory. Production uses the existing module-asset fallback route. Native-region publication remains a separate release step; unavailable regions retain the signed preview.
