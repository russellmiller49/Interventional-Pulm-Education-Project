# Brief for Codex (Astra) — the imaging suite and its assets

Extracted 2026-09-08 from the approved rebuild plan (owner: Russell Miller). The authoritative
TypeScript shapes are in `src/features/peripheral-imaging/components/suite/types.ts` and the
DOM-only stand-in the flow tests use is `src/features/peripheral-imaging/test-support/SuiteTestDouble.tsx`;
where this text and those files differ, the files win. Ask Claude before changing either.

## Implementation note (read this first)

The contract commit on `claude/fluoroview-stage` lays out the files this way:

- `src/features/peripheral-imaging/components/suite/types.ts` — the contract (Claude-owned).
- `components/suite/ImagingSuitePane.tsx` — the switch (Claude-owned): routes a step to your
  `SuiteScenePane` when its mode is in `SUITE_MODES_READY`, otherwise to `SuiteFallback`.
- `components/suite/SuiteScenePane.tsx` — **yours**. Currently a stub that renders the fallback.
  Put the R3F scene, the monitor, the dock and the readouts here (or in files it imports), and
  add each mode to `SUITE_MODES_READY` when its view honours every prop and data attribute.
- `components/suite/SuiteFallback.tsx` — Claude-owned: the draft's lab bodies inside the stage's
  lock, with the chain caption strip and the chain answer fieldset. Do not extend it.
- `components/suite/ChainAnswerFieldset.tsx` and `ChainCaptionStrip.tsx` — Claude-owned DOM
  pieces. The answer fieldset holds the radios; your 3D pins are `<label htmlFor={chainChoiceInputId(name, choiceId)}>`
  elements pointing at them. The caption strip is the DOM indicator you may replace visually but
  must keep the `data-chain-map` / `data-chain-pin` attributes for.
- `engine/labMetrics.ts` — Claude-owned: `LAB_CONTROLS` (every control's key, kind, range, label,
  default) and `labReadouts()`. Your dock renders from `LAB_CONTROLS[view.lab]` filtered by
  `view.controls`, with `id={controlElementId(key)}`; your readouts print `labReadouts()` for
  `view.readouts` through `formatReadout()`. Never re-derive a number the readouts already carry.
- `test-support/SuiteTestDouble.tsx` — Claude-owned: the DOM-only stand-in; read it to see the
  exact attributes and ids the flow tests expect.

The `SuiteInputs` in `types.ts` use the lab control keys one for one (`tipX/tipY/tipZ`,
`offsetX/offsetDepth`, `acquisitionOrbit`) rather than the tuple names in the text below.

### B1. What you are building and why

One 3D "imaging suite" scene that becomes the simulator pane of every Learn section of the
peripheral-imaging course, plus the Slicer/Blender assets it needs. The pedagogical map is the
**imaging chain** — (1) X-ray source → (2) beam → (3) patient → (4) detector → (5) reconstruction &
registration → (6) display & decision — drawn once in that scene; each section lights one stop and
each technology is shown as a different traversal of the same chain. The owner's verdict on the
draft: "I like the 3D visualisations, but we could do more/better to really give appreciation for
how the different technologies work." Today the scene never draws the chain: orbit/tilt move only
an `ArrowHelper` (`Scene3D.tsx:113-172`), the gantry is a separate toggle in a different world
(`:227-236`), the DRR is a 2D pane, DTS/CBCT are thumbnails or prose, fixed-vs-mobile changes prose
only (`SceneProps.kind` is dead, `:15`), the safety lab's orientation slider is inert (`:159,181`),
and radial EBUS / navigation have no visual at all.

You own `src/features/peripheral-imaging/components/suite/**` (except `types.ts` and
`SuiteFallback.tsx`, which Claude writes), `lib/{radialEbus,scatter,rayProfile}.ts`, the additive
geometry parameter in `lib/physics.ts`, additive changes to `fluoro-viewer/src/volume-drr.ts`, all
assets under `public/peripheral-imaging/**` with their scripts under `scripts/peripheral-imaging/**`,
`__tests__/{assets,suiteModel,radialEbus,scatter,rayProfile,routes,suiteViewSpec}.test.ts`, the
scene's e2e pixel checks, and the asset docs (`docs/peripheral-imaging/slicer-assets.md`,
`public/peripheral-imaging/README.md`, currently stale). Do not edit
`src/features/learning-module/stage/**`, `content/**`, `engine/**`, `components/stage/**`, the
routes, or `data/*.ts` — ask Claude for any change there. Read first: `module-plan.md`,
`slicer-assets.md`, `validation.md`, `Scene3D.tsx`, `ProjectionView.tsx`, `ImagingLab.tsx`,
`lib/physics.ts`, `lib/anatomy.ts`, `lib/tomosynthesis.ts`, `fluoro-viewer/src/volume-drr.ts` and
`geometry.ts`, `src/components/fluoroview/CarmInsetView.tsx` (its `SchematicGantry` at `:225` is
the starting primitive), `e2e/peripheral-imaging.spec.ts`.

### B2. The contract you implement (Claude commits it first; do not change shapes without asking)

`components/suite/types.ts`:

```ts
export type SuiteMode =
  | 'projection'
  | 'signal'
  | 'field'
  | 'time'
  | 'dts'
  | 'dts-prior'
  | 'cbct'
  | 'sampling'
  | 'rebus'
  | 'navigation'
  | 'augmented'
  | 'staff'
  | 'dose'
  | 'room'
export type ChainStop = 'source' | 'beam' | 'patient' | 'detector' | 'reconstruction' | 'display'
export type SuiteLayer =
  | 'Airways'
  | 'Lungs'
  | 'Ribs and spine'
  | 'Thoracic envelope'
  | 'table'
  | 'gantry'
  | 'cone'
  | 'ray'
  | 'monitor'
  | 'staff'
  | 'barrier'
  | 'isodose'
  | 'fov'
  | 'planes'
  | 'probe'
  | 'fieldGenerator'
  | 'labels'
export interface SuiteInputs {
  // all mm / deg / s; every field optional with authored defaults
  orbit
  tilt
  toolDepth
  geometry: { sod; sid; field } // default 720 / 1200 / 640 — the DRR's IMAGING_CONFIG
  fieldPercent
  crop
  zoom
  focalSpotMm // 100 / false / 1 / 0.6
  pulseRate
  pulseWidthMs
  speedMmS
  phase // phase = clock seconds
  sweepDeg
  planeDepth
  priorLayer: 'measured' | 'prior' | 'blend'
  orbitSpanDeg
  orbitProgress
  projectionCount // 200 / 0..1 / 24|36
  anatomyOffset: Point3
  toolFollowsAnatomy // acquisition vs registration semantics
  displacement
  storedDisplacement
  showStored
  showCurrent
  tip: Point3
  axial
  coronal
  sagittal
  slab
  probeAlong
  probeLateralMm
  transducerTurns
  probeState: 'probe' | 'tool'
  staffDistanceM
  barrier
  kermaMgy
  areaCm2
  variant: 'fixed' | 'mobile' | 'generic'
}
export interface SuiteViewSpec {
  sectionId
  mode: SuiteMode
  litStop: ChainStop | null /* null while a chain-answered prediction is open */
  stopSentence
  camera: 'suite' | 'beam' | 'anterior' | 'side' | 'head' | 'target' | 'room' | 'console'
  layers: SuiteLayer[]
  variant
  monitor: 'beside' | 'below' | 'hidden'
  animation?: { kind: 'pulse' | 'sweep' | 'orbit' | 'transducer' | 'exchange'; autoplay; loop }
  bindings: {
    input: keyof SuiteInputs
    control: string /* an existing lab control key */
    scale?
  }[]
  defaults: Partial<SuiteInputs>
  lab?: LabId
  controls?: string[]
  readouts?: LabMetricId[]
  chainAnswer?: boolean
  boundary: string
}
export interface ChainAnswer {
  name
  legend
  choices: { id; label; stop: ChainStop | null }[]
  selectedChoiceId
  committedChoiceId?
  correctChoiceIds?
  onSelect
  disabled
  hint?
}
export interface ImagingSuitePaneProps {
  view: SuiteViewSpec
  lab: { values: LabValues; events: readonly string[] }
  onLabChange(patch: LabValues)
  onLabReset()
  controlsEnabled: boolean
  lockedReason?
  pausedReason?
  goals: { goal: LabGoal; met: boolean }[]
  chainCaption: string
  chainAnswer?: ChainAnswer
  spotlightKey?
  children?
}
```

You export `resolveSuiteInputs(spec, labValues)` (bindings → defaults → the lab's own clamps, the
`num()` rule at `ImagingLab.tsx:47-50`) and `suiteViewErrors(spec)` (import-time validation: known
mode/layers/camera, bindings reference real control keys, `litStop === null` whenever
`chainAnswer`). Claude authors the per-section `SUITE_VIEWS` entries as data against your validator.
`ImagingSuitePane` = `SuiteScene` (canvas + monitor + `ChainStrip`) + the control dock
(`LabControls`, bound through `bindings`; ids `peripheral-imaging-control-<key>`) + readouts from
Claude's `labReadouts` (passed in) + the goal spotlight + `[data-model-boundary]` + the caption
printed verbatim.

DOM contract the flow tests and e2e depend on: `[data-suite-scene][data-suite-mode][data-suite-state=
ready|failed][data-lit]`, canvas `data-three-state=ready`, monitor wrapper `[data-projection-state=
ready|failed]`, `[data-suite-anim=running|idle]`, `[data-chain-map] [data-chain-pin=<stop>]`,
`[data-chain-answer]` fieldset with a visually-hidden radio group (rows `[data-off-chain]`,
`[data-chain-outcome]`), `[data-readouts] [data-readout=<id>]`, scouts `[data-scout-state=ready]`,
`[data-model-boundary]`. Keep the existing `Authored target` and `Sampling window` labels and the
`[data-dts-state]`/`[data-ct-state]` hooks the current e2e reads.

### B3. Hard rules

1. **Every drawn number derives from `lib/physics.ts`.** `beamDirection` is the source→detector
   normal n; detector axes are U = [cos a, sin a, 0], V = [sin a·sin b, −cos a·sin b, cos b];
   source = iso − 720·n; detector centre = iso + 480·n (`fluoro-viewer/src/geometry.ts:31-66`).
   `suiteModel.ts` is pure (no three/React) and a unit test asserts its frame equals
   `detectorFrameForAngles(IMAGING_CONFIG, orbit, tilt)` to 8 decimals over
   `[-75,0,30,90]×[-25,0,25]` (extend `__tests__/physics.test.ts:33-44`). The scene, the DRR, the
   SVG overlays and the readouts must never disagree.
2. **No new runtime dependencies. No CDN.** three ^0.180, @react-three/fiber ^9.4, drei ^10.7 only.
   Draco decoder from `/fluoroview/draco/` (trailing slash). Assets under `/peripheral-imaging/`
   get none of the relaxed CSP/MIME headers (`next.config.mjs:275-370` apply to `/fluoroview/*`
   only): PNG/GLB/JSON only, no `.wasm`/`.raw` there. Keep `public/peripheral-imaging` under
   ≈12 MB total; Draco-compress GLBs; no raw DICOM headers, names or absolute paths in any asset;
   every asset carries manifest provenance with the source SHA (`slicer-assets.md` discipline).
3. **Context budget: two WebGL contexts per page** (the R3F canvas + the DRR's WebGL2 canvas),
   created lazily (DTS/rEBUS/staff/dose/sampling never create the DRR). `frameloop='demand'`,
   `'always'` only while an animation runs, `'never'` when offscreen (IntersectionObserver); dpr
   [1,1.5]; ≤8 `<Html>` per view; dispose every geometry/material/texture; `useGLTF.preload`.
4. **Reduced motion and hidden tabs.** `prefers-reduced-motion` → no tweens, completed state + a
   visible "Step" button that advances one pulse/projection/degree; that button is also the
   deterministic driver for verification (a backgrounded preview tab throttles rAF — assert settled
   state, never animation timing). `useFrame` clocks are delta-clamped (1/30 s).
5. **Model boundaries are printed, not implied.** Each view prints its `boundary` sentence (§B7).
   Never a dose prediction, a vendor reconstruction, a collision/clearance claim, or a device
   specification; all angles/tolerances are authored (`module-plan.md:49-55`).
6. **Accessibility.** Chain pins are `<label htmlFor>` elements rendered through `<Html
portal={overlayRef}>` outside the `role="img"` canvas host, pointing at radios in one DOM
   `<fieldset>` (`ChainStrip`) — the `cardiohelp-ecmo/components/circuit-map/CircuitMapAnswerFieldset.tsx`
   pattern — so clicking a pin checks its radio, arrow keys move between stops, `disabled` locks a
   committed answer. Pin labels need their own class (`styles.modelLabel` is `pointer-events:none`).
7. **Fallbacks.** No WebGL2 (`load()` throws, `volume-drr.ts:176-178`) → monitor
   `data-projection-state=failed`, the 3D still runs with a flat detector plate. R3F error →
   `SceneBoundary` → Claude's `SuiteFallback`. Context loss → `WebGLContextGuard` remount (copy
   `cardiohelp-ecmo/components/ecmo-circuit/WebGLContextGuard.tsx`).
8. **Jest has no `@fluoroview` mapper.** `drrTextureSource.ts` is the only module that imports
   `@fluoroview/*`; tests mock at that boundary. Node 26 is the default here; one unrelated
   repo-wide jest failure exists (`scripts/ip-preference-cards/check-brochure-intake-static-exposure.test.ts`).

### B4. Architecture (files under `components/suite/` unless noted)

| File                                                              | Exports / role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suiteModel.ts` (pure)                                            | `suiteFrame(orbit, tilt, geometry, iso)` → `{source, detectorCenter, normal, u, v, corners}`; `detectorPoint(frame,[u,v])`; `rayThrough(frame, p)` (hit = `projectToDetector(p)`); `collimator/coneFrustum(frame, fieldPercent)` centred on the target's projection like the SVG shutter (`ProjectionView.tsx:140-142`); `magnification = sid/(sod+depth)`, `penumbraMm = f·(M−1)`; `temporal(inputs)` (= `temporalMetrics` + `pulseIsOn`, `sampledTipAt`, `blurSegment`); `dtsArc(sweep)` (13 frames, angle formula of `tomosynthesis.ts:63-66`), `dtsPlaneQuad`, `smearWidth = dtsShift(d,p,+s/2) − dtsShift(d,p,−s/2)`, `missingWedge`; `cbctOrbitSamples(span, n)`, `fovCylinder(variant)` (panel/2·sod/sid: fixed 640 → 192 mm, mobile 300 → 90 mm), `targetInsideTeachingVolume ≡ centeredForTeaching`, `sweptEnvelope`, `GANTRY_VARIANTS`; `samplingPlanes`; `registration(inputs)`; `rebusProbe`; `staff`; `dosePlanes`; `chainStopAnchors(frame)` |
| `drrTextureSource.ts`                                             | owns the one `VolumeDRRRenderer` on the monitor canvas (`preserveDrawingBuffer: true`, non-zero layout rect — `resize()` reads `getBoundingClientRect()`, `volume-drr.ts:333-337`), a `THREE.CanvasTexture` (`needsUpdate` + `invalidate()` after each render), low-res immediately then full after 110 ms idle (`ProjectionView.tsx:94-114`), `geometry` overrides so the isocenter can move without re-creating the renderer (today it re-uploads the 7 MB volume on every offset change, `ProjectionView.tsx:52-93`), `snapshot()` (`drawImage` copy for scouts and CBCT frames), `renderSequence()` (one projection per rAF, `AbortSignal`, textures disposed by the view). Exposure settings stay at defaults: the lab's mA/pulse must not drive DRR brightness.                                                                                                                                                                                      |
| `SuiteScene.tsx` (`'use client'`, `next/dynamic`)                 | the R3F canvas + `Monitor` + `ChainStrip` + toolbar; picks the view by `spec.mode`; `SuiteContext` provides `{drr, volume, reducedMotion, invalidate, frame, inputs, spec}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Anatomy.tsx`                                                     | from `Scene3D.tsx:63-112` (clone, tint, visibility, dispose) + a `map` (gray, registered) tint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Room.tsx`                                                        | table, floor, monitor boom, workstation (the "reconstruction" stop), field-generator board (navigation only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ParametricCarm.tsx`                                              | C ring, source housing + emissive focal spot, collimator blades, detector housing, cone frustum; hierarchy `group rz(orbit) → rx(tilt)`; envelope shell; variants `fixed` (floor/ceiling mount, 640 mm panel, full orbit) / `mobile` (cart, 300 mm panel, tighter envelope) / `generic`. Procedural three.js or authored GLB parts — your call — but the posed source/detector must land on `suiteFrame`'s positions (test). If GLB: node contract `CARM_root/CARM_orbit/CARM_tilt/{CARM_source,CARM_detector,CARM_collimator_{top,bottom,left,right}}`, root scale 0.001, rest pose orbit 0 / tilt 0.                                                                                                                                                                                                                                                                                                                                                     |
| `DetectorImage.tsx`                                               | the DRR quad facing the source (`MeshBasicMaterial toneMapped={false}`), UV crop for panel/collimation/crop-display, 3D overlays from `detectorPoint()`; opaque housing behind                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Monitor.tsx` (DOM)                                               | hosts the DRR canvas + `ProjectionOverlays` (extract the SVG at `ProjectionView.tsx:152-234`; keep `Projection` as the 2D fallback)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ChainStrip.tsx` + `ChainPins.tsx`                                | indicator mode (rows move the camera; lit stop `aria-current="step"`, glowing pin) and answer mode (§B3.6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CameraRig.tsx`, `animation.ts`                                   | presets incl. beam's-eye; `useSuiteClock`, `useChunkedSequence`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `views/*.tsx`                                                     | `ProjectionView3D` (projection, signal) · `FieldView` · `TimeView` · `TomosynthesisView` (dts, dts-prior) · `ConeBeamView` (cbct) · `SamplingView` · `RadialEbusView` · `RegistrationView` (navigation, augmented) · `StaffView` · `DoseView`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `routes.ts`                                                       | `REBUS_ROUTE`, `TOOL_ROUTE` — authored `Point3[]` inside the airway toward `LESION_CENTER` (from Slicer, §B6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `lib/radialEbus.ts`, `lib/scatter.ts`, `lib/rayProfile.ts` (pure) | §B5.7, §B5.10, §B5.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lib/physics.ts` (additive)                                       | `ImagingGeometry {sod,sid,field}`, `DEFAULT_GEOMETRY`, optional `geometry` on `projectToDetector`, `magnificationAt` — existing callers/tests unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `fluoro-viewer/src/volume-drr.ts` (additive)                      | `render({…, geometry?})` merges isocenter/SOD/SID before `detectorFrameForAngles` (`:266-273`, and in `computeThicknessProxy`); `resize(scale?, size?)` bypasses the zero-rect trap; `main.ts` and `volume-drr.test.ts` untouched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Reference implementations to copy: CanvasTexture + dispose
(`cardiohelp-ecmo/components/ecmo-circuit/BedsideScene.tsx:78-96`); `frameloop` switching
(`airway-stent-mechanics/components/explorer/StentExplorerViewport.tsx:171`);
IntersectionObserver + context-loss remount (`cardiohelp-ecmo/components/EcmoCircuit3D.tsx:148-208`);
reduced-motion snap (`CarmInsetView.tsx:168-171`); the retired procedural table/support/C-arm
(`git show 22466779:src/features/peripheral-imaging/lib/models.ts`) and its pose hierarchy
(`git show 22466779:…/Scene3D.tsx`); scope tube along a route (`src/components/fluoroview/Anatomy3DView.tsx:66-131`).

### B5. The views — what moves, what the learner controls, what it teaches

1. **projection / signal** (sections projection, signal; controls orbit, tilt, depth). Gantry, cone
   and DRR move together. Draw the single ray source→target→detector with the tool tip on it — same
   detector pixel, different depth; a second orbit shows the rays diverge (parallax; readout =
   `parallaxSeparation`, the number at `ImagingLab.tsx:64-66`). For `signal`, `rayProfile`
   (marching `sampleAnatomy`, `anatomy.ts:70-86`) colours the tissue along the ray and reports
   `rayTissueMm`; rotating the beam clears the heart/rib off the ray — that is the lesson.
2. **field** (controls field %, crop, zoom; new optional `sod`, `focalSpot`). Blades narrow the
   frustum; the irradiated segment shrinks; crop toggle crops the detector image but not the cone;
   zoom enlarges the monitor only; move the table along the beam to show SOD/SID, M and penumbra.
3. **time** (rate, width, speed). The focal spot pulses; the tool moves at the authored speed;
   frames land on the monitor as discrete samples; in-frame blur vs inter-frame jump; a pause stops
   motion. The DRR behind the overlay is static.
4. **dts / dts-prior** (sweep, plane, priorLayer). The source sweeps the authored arc; the 13 atlas
   thumbnails (`dts-projections.png`) accumulate on quads along the arc; a focal-plane quad slides
   through the volume while `reconstructTeachingPlane` updates; smear bars for out-of-plane objects;
   the missing wedge drawn as the unsampled sectors; `dts-prior` colours prior-derived content.
   Optional (your call): regenerate the projections in cone geometry consistent with the suite.
5. **cbct** (acquisitionOrbit, offsetX, offsetDepth, kind + readiness). ~200° orbit animation on
   demand; N low-res frames accumulate along the arc (`renderSequence`, 24–36 × 192², cached
   textures); FOV cylinder + the teaching-volume box (`centeredForTeaching`, ±8 mm); an off-centre
   target falls outside (truncation); the "reconstructed volume" = the CT's MPR quads, labelled as
   the CT standing in; fixed vs mobile are two gantry variants with a drawn swept envelope
   (explicitly not a clearance test); scouts become two `snapshot()` 2D copies (removes two WebGL2
   contexts from the mobile-suite lab).
6. **sampling** (tip, slices, slab). The analytic sphere + side-window needle at the real
   `LESION_CENTER`; three plane quads the slice sliders move; the existing MPR grid linked below.
7. **rebus** (probeAlong, probeLateral, probeState; new section radial-ebus). A probe on
   `REBUS_ROUTE` inside the airway mesh near the target; a rotating transducer; a procedural 360°
   radial B-mode image on a canvas (`lib/radialEbus.ts`: bright wall ring, aerated-lung
   snowstorm/reverberation, hypoechoic nodule with a defined margin, one vessel) as a function of
   the probe's transverse offset from the nodule: within (concentric) / adjacent (eccentric) / no
   signal; probe-out then tool-in on `TOOL_ROUTE`, which exits on a slightly different trajectory.
   Reuse `thoracic-ultrasound-simulator/engine/simulateBMode.ts` primitives (attenuation, TGC,
   speckle) if they fit; otherwise a compact analytic model. Authored teaching model, labelled.
8. **navigation** (section current-anatomy; shift, previous, overlay, showCurrent). Field-generator
   board under the table; a sensor dot at the catheter tip that sits exactly on the gray registered
   map airway while the current lung (coloured, `Anatomy` translated by `[0,0,−displacement]`) and
   the true nodule have moved; the virtual target vs the true one; a local update snaps the virtual
   target. Share the rigid-translation state with the 2D registration overlay
   (`ProjectionView.tsx:41-60,176-186`) so 2D and 3D agree.
9. **augmented** (section changing-anatomy). The stored contour projected along rays from the
   source through the OLD target position onto the live detector image while the lung has moved;
   toggle.
10. **staff** (distance, orbit, shield). The irradiated volume as the scatter source; illustrative
    1/r² isodose rings on the floor with an authored tube-side weighting (knowledge doc §11.7; the
    higher-scatter region is on the beam-entrance side); the barrier casts a geometric shadow
    sector; the orientation slider rotates the gantry (today it is inert). Not a survey, no
    attenuation factors, no safe distance.
11. **dose** (kerma, area). Labelled planes: kerma × area just after the collimator, the reference
    point on the beam axis (equipment convention), skin entry from `rayProfile`; `kapGyCm2`
    invariance across two planes. No skin/organ/effective dose.
12. **room** (hub hero). The suite at rest, camera `suite`, monitor hidden — one canvas.

Retire the `AnimatedGantryGlb` "C-arm motion" toggle from the labs (a different world, no
mechanism); keep `fluoroview-carm.glb` and its asset test until the owner decides (§F).

### B6. Slicer / Blender asset tasks (your judgement on tooling; document every step in `slicer-assets.md`)

Source data lives in the primary checkout, gitignored: `…/Interventional-Pulm-Education-Project/
fluoro_2/New_patient/` (`target_clean_ct.nrrd` 232 MB, SHA `572afc5b…`; `Final_airway_target.vtk`;
`SEGMENTATION.seg.nrrd`; `Centerline/` with 488 centerline + 502 network curves; the SlicerHeart
`C_arm_files/` rig with per-axis `.h5` transforms). Existing pipeline:
`scripts/peripheral-imaging/build-slicer-anatomy.py` (runs inside Slicer 5.12.3, `--python-script`;
writes `thorax.glb`, `ct-atlas.png`, `manifest.json`), `build-dts-projections.py`,
`export-models.ts`; regeneration commands in `slicer-assets.md`.

1. **Bake a faint authored nodule into the CT atlas** at `LESION_CENTER = [85,−20,−30]`, radius 9 mm,
   part-solid (≈−350 HU core, soft margin; a solid variant can come later). Today the CT contains
   no nodule (the target is an overlay), so conspicuity cannot change with angle; the `signal` and
   `field` sections need it. Parameterise the script; record density and radius in
   `manifest.json`; update `__tests__/assets.test.ts` (it currently asserts lung density
   −1050…−400 HU at the target — change to assert the nodule density and that the surrounding lung
   stays lung). The DTS atlas already adds a sphere before projection — keep them consistent.
2. **A cropped tissue labelmap around the target** (≈64³ at 1 mm, LAS, PNG atlas like `ct-atlas.png`):
   airway lumen / airway wall / aerated lung / nodule / vessel, from `SEGMENTATION.seg.nrrd`, the
   airway VTK and a thresholded vessel class — drives `lib/radialEbus.ts` and `rayProfile`
   (tissue classes along the ray). Manifest with class ids and provenance.
3. **The probe and tool routes**: export the centerline path from the trachea to the terminal
   airway nearest `LESION_CENTER` (from `Centerline/`), resampled at 2 mm, as `routes.json`
   (`REBUS_ROUTE`), plus an authored `TOOL_ROUTE` that leaves the last 10 mm on a slightly different
   trajectory. A node test decodes the CT atlas with `sharp` and asserts every `REBUS_ROUTE` point
   samples as air (HU < −700) — the test name must say "in air", not "in lumen".
4. **Gantry and room geometry** — procedural three.js is acceptable; if you author GLB parts
   (Blender/Slicer), follow the node contract in §B4, Draco-compress, keep each variant ≤600 KB,
   and provide the rest-pose measurements so `suiteModel` tests can check them. The retired
   schematic `fixed-cbct-suite.glb`/`mobile-cbct-suite.glb` (`git show 22466779:public/peripheral-imaging/<name>`)
   are available as references only.
5. **Optional**: cone-geometry DTS projections (replacing the parallel-beam atlas) so the drawn arc
   and the refocused image share one geometry; keep the 13-view/5-sweep layout and `dts.json`.
6. **Docs**: rewrite `public/peripheral-imaging/README.md` (it names GLBs that no longer exist),
   extend `slicer-assets.md` (provenance table, regeneration commands, budgets, interpretation
   limits) and note the gantry-asset retirement decision as open.

### B7. Model-boundary sentences (one per view; printed under the scene)

projection/signal: "Authored cone geometry (720/1200 mm, 640 mm field) shared with the DRR and
readouts; the CT supplies anatomy, the target and tool are authored. The ray colouring is a
relative attenuation proxy from quantised CT, not exposure or dose." · field: "Blades, cone and
irradiated segment are drawn from the authored geometry; scatter, automatic exposure regulation
and detector readout are not modelled. Focal-spot blur uses f × (M − 1) with an authored 0.6 mm
spot at an exaggerated drawing scale." · time: "Pulses and motion run in slowed authored time; the
image behind the overlay is a static DRR. Display refresh, lag and controller behaviour are not
simulated." · dts/dts-prior: "The 13 thumbnails are parallel-beam teaching projections of a CT with
an added target and tool; the arc is drawn in cone geometry for orientation. Shift-and-add is not a
vendor reconstruction; the 'prior' layer is the planning CT blended for illustration." · cbct: "The
orbit, projection count, panel sizes and swept envelope are authored; the 'reconstructed volume' is
the original CT standing in for a reconstruction. The envelope is a drawn volume, not a collision or
clearance test; the teaching volume encodes the exercise's ±8 mm centering tolerance, not a device
field of view." · sampling: "Analytic sphere and side-window cylinder over CT context, as in the
linked slices; no vessels, pleura, deformation or tissue acquisition." · rebus: "An authored
radial-image model driven by the probe's offset from the nodule; not a device simulation, and a
concentric pattern here does not show where a later tool samples." · navigation/augmented: "Rigid
translation of CT and target by the learner; the map, sensor and field generator are schematic. No
ventilation, deformation, tracking error or vendor registration is modelled." · staff: "Rings are an
illustrative point-source 1/r² about the irradiated volume with an authored tube-side weighting; the
barrier casts a geometric shadow only. Not a survey, no attenuation factors, no safe distance." ·
dose: "Planes mark where quantities are defined: kerma × area after the collimator, a reference
point on the beam axis per the equipment convention, and skin entry from the CT envelope. KAP is
computed from authored inputs; no skin, organ or effective dose."

### B8. Order of work, effort, and what to report

1. **Spike (0.5–1 d): DRR on the detector.** `DrrTextureSource` + `DetectorImage` + `Monitor`;
   confirm orientation at orbit 30 / tilt 15 against the SVG overlay, the `resize` zero-rect trap,
   and upload cost. **Report the result to Claude before continuing** — the whole concept rests on
   it.
2. `physics.ts` geometry param + `volume-drr.ts` overrides + `suiteModel.ts` + agreement tests (1 d).
3. `SuiteScene` shell: canvas, `Anatomy`, `Room`, `ParametricCarm`, `CameraRig`, layers,
   `ChainStrip`/`ChainPins` (both modes), data attributes, fallbacks, context loss;
   `ImagingSuitePane` against the contract; wire the geometry lab (1.5–2 d).
4. projection/parallax + signal ray profile; nodule bake (§B6.1) (1.5 d). **Sync point 3**: Claude
   merges and `projection` runs end-to-end on the stage.
5. field → time → CBCT (sequence, FOV, envelope, variants, scouts) → DTS (+ prior) → sampling →
   navigation + augmented → staff → dose (≈8–9 d, each view merged as it lands).
6. Radial EBUS: labelmap (§B6.2), routes (§B6.3), `lib/radialEbus.ts`, view, tests (2 d).
7. Retire `Scene3D`/`SamplingScene3D`/gantry toggle; e2e scene checks; docs; lint/type-check/build (1–1.5 d).

Roughly 16–19 developer-days. Tests you own: `suiteModel.test.ts` (agreement, orbit samples, FOV,
teaching-volume ≡ `centeredForTeaching`, DTS angles, smear monotonicity, KAP invariance, 1/r²),
`radialEbus.test.ts`, `scatter.test.ts`, `rayProfile.test.ts`, `routes.test.ts` (in air),
`suiteViewSpec.test.ts` (every section has a spec; bindings reference real keys; answer-mode specs
have `litStop: null`), `assets.test.ts` (updated), a `ChainStrip` RTL + jest-axe test, and the
e2e scene steps (`[data-suite-mode]`/`[data-suite-state=ready]`, `data-three-state` + pixel signal,
monitor `[data-projection-state=ready]` + signal, slider → `toDataURL` change, CBCT "Run the orbit"
→ `data-suite-anim` running→idle + thumbnail count, DTS plane change, rEBUS presets → pattern text,
staff orientation → canvas change, `page.emulateMedia({reducedMotion:'reduce'})` → idle at once).
Browser verification: dev server from `.claude/launch.json`, sign in via
`/api/local-dev-auth?token=$LOCAL_DEV_AUTH_TOKEN&next=/en/peripheral-imaging` (never print the token),
navigate (never `location.reload()`), keep the preview tab fronted for screenshots.

Git: branch `codex/fluoroview-suite` from the contract commit on `claude/fluoroview-stage`; small
commits per step; PRs against `claude/fluoroview-stage`; never commit to `main`; stage specific
reviewed paths; Slicer runs only from the primary checkout's data, never modifying an open scene.
