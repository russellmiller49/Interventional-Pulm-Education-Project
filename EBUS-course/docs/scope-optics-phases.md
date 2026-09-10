# Scope-simulator optics — phase-by-phase prompts

Paste **one phase at a time** into a fresh session. Every phase starts by loading
the `scope-sim-optics` skill, which carries the shared repo map, axis
conventions, calibration rule, and validation commands — so these prompts stay
short and you don't re-read large context each phase.

Language here is deliberately generic (optical camera, sector image, tubular
channel, target structure, flow channel, device profile) to describe an
**educational, training-only** anatomy scope simulator — not a medical device.

---

## Phase 1 — Calibrated forward-oblique optical camera

```
Load the scope-sim-optics skill, then do this phase only.

Goal: the optical pane (apps/web/src/features/simulator/BronchoscopyView.tsx)
currently aims the camera straight along probe.tangent. Replace that with a
calibrated forward-oblique optical axis derived from the scope pose frame, so
the view matches a forward-oblique device profile.

1. In apps/web/src/features/simulator/pose.ts add a small, reusable frame helper
   (SimulatorProbePose already owns position/tangent/depthAxis/lateralAxis):
   - interface SimulatorScopeFrame { position, shaftAxis, depthAxis, lateralAxis }
     (all THREE.Vector3)
   - resolveScopeFrame(pose): clones + normalizes the pose axes into a frame.
   - resolveForwardObliqueOpticalAxis(frame, offsetDeg = 30, sign = 1):
       forward = shaftAxis*cos(θ) + (sign * depthAxis)*sin(θ), normalized,
       θ = degToRad(offsetDeg). The sign MUST be a parameter (the scan side may
       need flipping after visual review) — do not hard-code it.

2. In BronchoscopyView.tsx, replace forward.copy(probe.tangent) with:
       const frame = resolveScopeFrame(probe)
       const forward = resolveForwardObliqueOpticalAxis(frame, offsetDeg, sign)
   and offset the camera along the frame axes:
       camera.position.copy(frame.position)
         .add(frame.shaftAxis.clone().multiplyScalar(eyeOffsetShaftMm))
         .add(frame.depthAxis.clone().multiplyScalar(eyeOffsetDepthMm))
         .add(frame.lateralAxis.clone().multiplyScalar(eyeOffsetLateralMm))
       camera.up.copy(frame.lateralAxis)
       camera.lookAt(target.copy(camera.position).add(forward))
   For now default offsetDeg = 30, sign = 1, and eye offsets = 0 (constants at the
   top of the file; Phase 2 moves them into a device profile). Keep the existing
   shader and channel mesh untouched.

3. Add a URL debug mode ?bronchDebug=1 that draws three colored lines from the
   scope position: the shaft axis, the optical axis, and the scan-side (depth)
   axis. Keep it out of the normal render path.

Acceptance / tests (vitest, in simulator.test.ts or a sibling):
- resolveForwardObliqueOpticalAxis returns a unit vector 30° off the shaft axis
  (assert the dot product ≈ cos(30°)).
- Flipping the sign points the axis toward the opposite scan side (assert the
  depth-axis component changes sign).

Validate: npm run typecheck && npm test. Keep changes additive and neutral.
```

---

## Phase 2 — One device-calibration record, shared by app and tools

```
Load the scope-sim-optics skill, then do this phase only.

Goal: stop hard-coding the 30° optical offset (and camera constants) inside
BronchoscopyView. Introduce a single optional device-calibration record and make
the manifest the source of truth, following the single-source-of-truth rule in
the skill.

1. apps/web/src/features/simulator/types.ts — add optional, additive fields to
   SimulatorCaseManifest:
     endoscope_camera?: {
       model: string                      // opaque id, e.g. 'bf_uc180f'
       optical_axis_offset_deg: number
       obliquity_axis: 'depth_axis' | 'negative_depth_axis'
                     | 'lateral_axis' | 'negative_lateral_axis'
       fov_deg: number
       near_mm: number
       far_mm: number
       eye_offset_mm: { shaft: number; depth: number; lateral: number }
       circular_aperture?: boolean
       lens_distortion?: boolean
       scope_tip_occlusion?: boolean
     }
     ultrasound_probe?: { sector_angle_deg: number; displayed_range_mm: number;
                          optical_axis_offset_deg?: number }
   Existing cases without these must still load.

2. BronchoscopyView.tsx — read endoscope_camera from the case manifest instead of
   the Phase-1 constants: derive offsetDeg, the sign (from obliquity_axis), the
   eye offsets, and FOV/near/far. Fall back to the Phase-1 defaults when the field
   is absent so older manifests keep working.

3. scripts/cases/build-simplified-simulator-assets.mjs — emit an endoscope_camera
   (and ultrasound_probe) block into case_manifest.simplified.web.json with the
   default profile (offset 30, a chosen obliquity_axis, sensible FOV/near/far/eye
   offsets). This script is the source of the default web manifest.

Acceptance / tests: a manifest with endoscope_camera drives the optical axis
(offset + sign) the same way Phase 1 verified; a manifest without it still
resolves to the defaults. Validate: npm run typecheck && npm test && npm run build.
```

---

## Phase 3 — Align the Python device model with the app

```
Load the scope-sim-optics skill, then do this phase only.

Goal: the Python device profile and the web app must use the SAME calibrated
optical offset and axes (single source of truth). Today
tools/ebus-simulator/src/ebus_simulator/device.py uses
video_axis_offset_deg=20.0 for model id bf_uc180f; the app now targets 30°.

1. In device.py, make video_axis_offset_deg (and sector_angle_deg,
   displayed_range_mm) come from a configurable profile rather than a literal.
   Prefer reading a device-profile record (the same numbers exported to the web
   manifest); accept an explicit override; default to the calibrated 30°.
   DevicePose already exposes shaft_axis_world / video_axis_world /
   probe_axis_world / lateral_axis_world — keep those as the shared conceptual
   axes; the app should not maintain an independent calculation.

2. Wherever the web-manifest export is generated on the Python side, write the
   same calibration numbers so build-simplified-simulator-assets.mjs and the
   Python tools cannot drift apart. If a shared profile file is the cleanest
   home, create one and have both consumers read it.

Acceptance: a syntax check passes (python -m py_compile device.py) and a small
pytest asserts the resolved optical axis is offset by the configured angle
(30° by default) from the shaft axis, matching the app's convention. Do not
require running the full render pipeline. Keep changes additive.
```

---

## Phase 4 — Distal tip, contact cap, and lens realism in the optical pane

```
Load the scope-sim-optics skill, then do this phase only.

Goal: make BronchoscopyView.tsx read like a real forward-oblique scope view by
adding foreground occlusion and lens effects. AnatomyScene.tsx already loads and
poses the scope tip model (SimulatorScopeModelAsset) — reuse that model or a
simplified distal-tip occluder here.

Add, each behind the endoscope_camera flags from Phase 2 where applicable:
1. A dark curved distal-tip occlusion at the lower/side edge of the frame.
2. An optional translucent distal contact cap over the tip.
3. A circular aperture / vignette mask around the image.
4. Mild barrel distortion and slight edge blur.
5. Headlight falloff tied to the optical axis (not just camera position).
6. Contact / proximity behavior so the camera cannot pass through the channel
   surface. Start with native three.js raycasting against the channel mesh —
   three-mesh-bvh is NOT installed; only propose adding it if profiling shows
   raycasting is too slow, and say so explicitly.

Keep everything optional and defaulted so cases without the flags are unchanged.
Acceptance: a vitest covering the pure helpers (aperture mask math, distortion
mapping, proximity clamp) plus a manual ?bronchDebug=1 check. Validate:
npm run typecheck && npm test.
```

---

## Phase 5 — Restore the sector-image style toggle (classic / realistic / physics)

```
Load the scope-sim-optics skill, then do this phase only.

Goal: SectorView.tsx has moved toward the "realistic" render as default. Keep
that, but restore an explicit style switch so reviewers can compare renders
side by side while tuning. See realistic_sector_rendering.md for the original
safe-rollout intent.

1. Add a runtime style resolver with precedence URL > localStorage > manifest >
   default, producing one of: 'classic' | 'realistic' | 'physics'
   (URL: ?sectorStyle=classic|realistic|physics). 'physics' is a placeholder
   path for now (Phase 6 wires the image); until then it falls back to
   'realistic' with a small badge indicating no snapshot is available.
2. SectorView.tsx: branch the render on the resolved style. 'classic' = the
   prior simple render; 'realistic' = current default; 'physics' = reserved.
   Keep the hover labels / educational overlays identical across styles.

Acceptance: vitest for the precedence resolver (URL beats localStorage beats
manifest beats default) and that an unknown value falls back safely. Validate:
npm run typecheck && npm test. Additive, backward-compatible.
```

---

## Phase 6 — Signal-render station snapshots + display under the labels

```
Load the scope-sim-optics skill, then do this phase only.

Goal: use the Python signal-render module for high-realism, station-anchored
sector images, and show them as the sector-image background with the existing
interactive labels on top.

Part A (Python, tools/ebus-simulator):
- Add a snapshot pipeline that, for each station preset, renders a grayscale
  sector image via physics_renderer.py and writes a PNG + sidecar JSON into
  apps/web/public/simulator/<case-id>/physics_snapshots/
  (e.g. station_4r_node_a__default.png / .json). Each JSON includes:
  { preset_key, image, metadata: { engine:'physics', engine_version, model,
    video_axis_offset_deg, sector_angle_deg, max_depth_mm, roll_deg, contact,
    shaft_axis, depth_axis, lateral_axis }, labels: [...], masks?: {...} }.
- Provide a command/script to regenerate these assets. Syntax-check only in CI;
  do not require a full render run.

Part B (web):
- types.ts: add optional physics_snapshots?: Record<string,string> to the
  manifest (additive).
- useSimulatorCase.ts: extend useSimulatorSectorSnapshot or add
  useSimulatorPhysicsSnapshot(caseData, presetKey) to load the per-preset PNG
  + JSON (mirrors how sector_snapshots is already read).
- SectorView.tsx 'physics' style: draw the PNG as the background, then render the
  existing SVG hover labels and educational color overlays on top unchanged.
- build-simplified-simulator-assets.mjs: reference generated physics_snapshots
  in the emitted manifest when present.

Acceptance: vitest that the physics loader resolves a preset to its PNG+metadata
and that SectorView composites labels over the image; missing snapshot falls back
to 'realistic'. Validate: npm run typecheck && npm test && npm run build.
```

---

## Phase 7 — Improve the free-drive sector image (fallback path)

```
Load the scope-sim-optics skill, then do this phase only.

Goal: keep the browser point-cloud / fan-plane sector as the free-drive path
(it's already tested and robust — live masks come from local fan-plane crossings,
not a thick-slab projection). Enhance it in small, independently-testable steps,
without running the Python pipeline in the browser:

1. gain, depth, and TGC controls that affect the canvas rendering.
2. seeded speckle variation that shifts subtly with scope motion.
3. a flow-overlay ("Doppler") mode driven by flow-channel masks only.
4. poor-contact degradation when the scope is far from the channel wall.
5. optional interpolation from nearby precomputed snapshots once an atlas exists
   (reuse Phase 6 metadata; skip cleanly when none are near).

Do each as an additive prop/control on SectorView with its own vitest. Validate:
npm run typecheck && npm test.
```

---

## Phase 8 — Access mode: make the optical pane trainee-facing after QA

```
Load the scope-sim-optics skill, then do this phase only.

Goal: today SimulatorPage.tsx computes
showVirtualBronchoscopyPane = showVirtualBronchoscopy && !publicTrainingMode,
and the route passes showVirtualBronchoscopy = appAdminSessionActive (admin
only). Add a reviewed opt-in so the improved optical pane can go trainee-facing
per case after station-by-station QA.

1. types.ts: add optional render_defaults.endoscopic_view_public?: boolean.
2. Resolve visibility as:
     showVirtualBronchoscopy =
       appAdminSessionActive
       || caseData.render_defaults.endoscopic_view_public === true
       || new URLSearchParams(location.search).get('bronchView') === '1'
   Keep the publicTrainingMode suppression as the final guard until QA is signed
   off; default endoscopic_view_public to false/absent.

Acceptance: vitest for the visibility resolver across (admin, manifest flag, URL
flag, none). Validate: npm run typecheck && npm test. Additive, off by default.
```

---

### Suggested order & QA note

Run phases 1 → 8 in order (2 and 3 together establish the single calibration
record before the realism work builds on it). Do a station-by-station review of
the optical pane and sector snapshots against reference video **before** Phase 8
turns the pane on for trainees.
