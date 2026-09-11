# Continuous EBUS imaging

The simulator samples a versioned acoustic volume generated from its active simplified GLB. Optical rendering uses the shared mucosa shader, transported scope frames, camera optics and quality settings. The ultrasound image follows the longitudinal probe plane and stays stable while the scope is stationary. A worker performs sampling, attenuation, boundary echoes, coherent speckle, scan conversion and a finite point-spread filter; depth, gain, three TGC bands and freeze operate on the grayscale image. Teaching colors are a separate overlay and are suppressed during assessment.

## Registration and device calibration

- All 29 source meshes are closed. No display anatomy was moved or removed. The acoustic volume is LPS millimeters, 226 × 175 × 489 at 0.8 mm spacing, 19.3 MB decoded and 163 KB compressed. Browser/main and worker copies are bounded; the volume is loaded once per case.
- The active GLB SHA-256 is `98dab0cac8fe3a06772a980996742f1b21bb4a2963d262064c221562c91a64fb`. Source, compressed-data and decoded-data hashes are recorded and checked. Native CT gzip loading also handles HTTP servers that decompress responses automatically.
- The migrated 2L and 2R contacts were roughly 32 and 30 mm from their new route positions; 11Ri and 11Rs required approximately 10 and 7 mm adjustments. All contacts were reconciled with the active airway wall. `geometry/station-calibration-v2.json` preserves original and derived poses. Targets, route identities and anatomy are unchanged.
- The nominal [Olympus BF-UC180F](https://medical.olympusamerica.com/products/bf-uc180f-ebus-bronchoscope) profile uses 35° forward obliquity and 80° field of view. The case retains its separately recorded −6 mm optical-eye offset and scan-side calibration. Explicit older device records still load.
- The legacy physics snapshot is not registered to this anatomy version. It remains available offline; live display rejects unversioned snapshots, geometry mismatches, displacement over 0.5 mm and axis differences over 0.5°. Python rendering remains available for reference work.
- Continuous station approaches replace the abrupt one-millimeter snap boundary. Drive buttons and the existing hardware input adapter sweep insertion along the active lumen and stop before a wall crossing. Station selection remains an explicit move to a reviewed reference pose.

## Validation

The EBUS app passes **240 tests**, including 19 added imaging/registration tests and the existing 94 simulator tests. Type checking and its standalone production build pass. Tests cover all 11 station approaches, active-wall contact, longitudinal target intersection, transition continuity, large-step collision rejection, stationary and coherent imaging, coupling recovery, knob effects, coordinate conversion and snapshot rejection.

The browser review visits every station and checks freeze during rotation, resumed scanning, gain and advance/withdraw controls with no console errors. Screenshots and a recorded session are generated under `artifacts/ebus-browser-review`. A compact result is checked in at `docs/ebus-acoustic-review/browser-review.json`. Offline 384-pixel frames take approximately 8–11 ms after warmup on this desktop; this is renderer timing, not a verified end-to-end 30 fps benchmark. Software-rendered Chromium cannot establish the requested hardware optical frame rate.

Reference frames from the local 2L, 2R, 4L, 4R, 11L, 11Ri and 11Rs videos were inspected for grayscale texture, boundaries, anechoic regions and distal attenuation. They are not the same patient geometry and cannot establish pixelwise registration. No reference clinical media is included in the PR. Station 7 and dedicated 10L/10R ultrasound clips were absent from that folder. The volume uses modeled nodes/vessels and homogeneous surrounding tissue; matching real ultrasound appearance and clinical landmarks still requires expert review. Full acoustic wave propagation and diagnostic tissue characterization are outside this renderer.

## Reproduce

```sh
/Applications/Slicer.app/Contents/bin/PythonSlicer EBUS-course/scripts/cases/build-acoustic-volume.py --case-dir EBUS-course/apps/web/public/simulator/case-001
/Applications/Slicer.app/Contents/bin/PythonSlicer EBUS-course/scripts/cases/calibrate-acoustic-stations.py --case-dir EBUS-course/apps/web/public/simulator/case-001
npx esbuild EBUS-course/scripts/cases/render-acoustic-review.mts --bundle --platform=node --format=esm --packages=external --tsconfig=EBUS-course/apps/web/tsconfig.json --outfile=node_modules/.cache/ebus-review/review.mjs
node node_modules/.cache/ebus-review/review.mjs
node EBUS-course/scripts/cases/browser-acoustic-review.mjs
npm --prefix EBUS-course/apps/web test
npm --prefix EBUS-course/apps/web run typecheck
npm --prefix EBUS-course/apps/web run build
```

The browser script defaults to the implementation server on port 3131; set `EBUS_REVIEW_URL` for another server.
