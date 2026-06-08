---
name: webxr-anatomy-models
description: >-
  Build and integrate new 3D anatomy models into this project's WebXR spatial viewer (Next.js +
  React Three Fiber + @react-three/xr), and work on the immersive viewer itself. Use this whenever
  the user wants to add/import a new anatomy GLB or CT/NRRD volume, register a model for the /xr
  spatial route, define segments/structures, or change anything that runs in the headset — controls,
  clipping, CT planes, grab, the in-scene panel, Quest 3 / Vision Pro behavior — or whenever editing
  src/components/3d/AnatomyViewer.tsx or src/components/3d/xr/*. It encodes the working conventions
  and the hard-won pitfalls (CSP for controller assets, VR-only, pointer-event input, world-space
  clipping, tone-mapped UI) so new XR work doesn't repeat them. Reach for it even if the user just
  says "add a model", "the headset viewer", or "spatial anatomy" without naming the files.
---

# WebXR anatomy models

This project ships an immersive 3D anatomy viewer for **Meta Quest 3** and **Apple Vision Pro**,
built on Next.js 16 + React 19 + React Three Fiber 9 + three 0.180 + **@react-three/xr v6**. This
skill covers two things: (1) **adding a new anatomy model** to the viewer, and (2) the **XR
conventions** any change to the immersive viewer must follow.

The viewer is hard-won. Before editing anything that runs in the headset, read
[references/xr-conventions.md](references/xr-conventions.md) — it explains the rules below and why
they exist (each maps to a real bug we hit and fixed).

## Where things live

| Concern                                       | File                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Model data (source of truth)                  | `src/data/printable-models.ts` → `anatomyModels`                            |
| XR route list (`/xr`)                         | `src/data/models.ts` → `MODELS` (auto-derived from `anatomyModels`)         |
| Types                                         | `src/lib/types.ts` (`AnatomyModel`, `AnatomySegment`, `AnatomyVolumeAsset`) |
| Asset loading / segment binding / volume math | `src/lib/3d-utils.ts`                                                       |
| The viewer (desktop + XR)                     | `src/components/3d/AnatomyViewer.tsx`                                       |
| XR store config                               | `src/components/3d/xr/xrStore.ts`                                           |
| /xr route wrapper (owns viewer state)         | `src/components/3d/AnatomySpatialRouteViewer.tsx`                           |
| GLB / NRRD assets                             | `public/models/` (+ Draco decoder in `public/draco/`)                       |
| CSP / headers (controller assets!)            | `next.config.mjs`                                                           |

Routes: `/xr/[slug]` → `AnatomySpatialRouteViewer` → `AnatomyViewerDynamic` → `AnatomyViewer`.
`/learn/anatomy` is the desktop page. **Both routes are auth-gated** (redirect to `/login`).

## Adding a new anatomy model

### 1. Prepare the GLB

- Export a **glTF-binary (.glb)**, **Draco-compressed** (the loader expects the decoder at `/draco/`).
- Keep it lean — these load over the network into a standalone Quest GPU. The current
  `lymph-node-education.glb` is ~13 MB; that's about the ceiling. Decimate if larger.
- **Name your meshes/nodes to match segment ids.** Meshes bind to segments in
  `applySegmentColors` ([3d-utils.ts](src/lib/3d-utils.ts)) by, in order: `userData.segmentId`,
  `userData.segmentLabel`, the mesh name, then ancestor node names — normalized and matched against
  each segment's `id` or `name`. Any mesh that matches nothing becomes its **own auto-created
  segment** (palette color). So either pre-author clean node names that equal your segment ids, or
  accept auto-derived segments and refine them in data.

### 2. Place assets

Put the `.glb` (and any CT volume `.nrrd` + segmentation `.nrrd`) under `public/models/`. Reference
them with `resolveModuleAssetPath('/models/your-file.glb')` (see existing entries) so the module
asset origin / caching headers apply.

### 3. Register the model in `src/data/printable-models.ts`

Add an entry to `anatomyModels`. Minimum viable model:

```ts
{
  id: 'my-model',
  slug: 'my-model',                 // becomes /xr/my-model
  name: 'My Anatomy',
  category: /* an AnatomyCategory */,
  description: '...',
  clinicalRelevance: '...',
  relatedProcedures: [],
  downloads: [
    { format: 'glb', url: resolveModuleAssetPath('/models/my-model.glb'), sizeMB: 6 },
    // optional: { format: 'usdz', url: resolveModuleAssetPath('/models/my-model.usdz') }
  ],
  thumbnail: '/models/my-model-thumb.png',
  defaultCamera: { position: [0, 0.1, 2.5], target: [0, 0, 0], autoFit: true },
  segments: [
    { id: 'aorta', name: 'Aorta', description: '', color: '#ff6b6b', visibleByDefault: true },
    // ...one per structure you want individually controllable
  ],
}
```

`MODELS` in `models.ts` is derived automatically from any `anatomyModels` entry with a `glb`
download — no edit needed there. The model is then live at `/xr/<slug>`.

### 4. (Optional) CT/NRRD volume + clipping

If the model has a registered CT volume, add `volume` (`AnatomyVolumeAsset`):

```ts
volume: {
  format: 'nrrd',
  url: resolveModuleAssetPath('/models/my-model-ct.nrrd'),
  axis: 'z',
  window: { low: -1000, high: 500 },          // HU window/level
  patientToModelMatrix: [/* 16 numbers, row-major: patient mm -> model space */],
  volumeCenterPatientMm: [x, y, z],
  segmentation: { format: 'nrrd', url: resolveModuleAssetPath('/models/my-model-seg.nrrd') },
  // ctAlignment / ctSliceOrientation override defaults if registration is off
}
```

Getting `patientToModelMatrix` right is the hard part — the CT planes and the clipping plane both
derive from it. Use the desktop `/learn/anatomy/ct-alignment` sandbox to tune alignment; it reports
a suggested translation via `onSceneMetrics`. The clipping plane is computed in **model-local**
space and re-projected to world each frame (see conventions), so it tracks the model in XR.

### 5. Verify

```bash
npx tsc --noEmit
npx eslint src/data/printable-models.ts src/data/models.ts
npm run build
```

Then test in a headset (the viewer can't be exercised in a browser preview — auth-gated, no
Storybook story). See "Verifying & testing" below.

## XR conventions — the rules any headset change must follow

These are summarized here; the **why** and the code patterns are in
[references/xr-conventions.md](references/xr-conventions.md). Read it before changing the viewer.

1. **VR is the only immersive mode.** Vision Pro has no functional WebXR `immersive-ar`. Don't add
   `immersive-ar`/`hit-test`. Enter via `xrStore.enterVR()`.
2. **Input = R3F pointer events, never `getController(0/1)`.** `onPointerDown/Move/Up`, `onClick`
   work across Quest controllers, Quest hands, and Vision Pro pinch; the index-based controller API
   silently misses Vision Pro's transient-pointer. Use **pointer capture** for grabs/drags/sliders.
3. **`controller: { model: false }` in the XR store.** Loading the controller GLB from the CDN was
   leaving Quest with no controllers/ray at all. The ray + events come from the input source itself.
4. **CSP must allow `https://cdn.jsdelivr.net` in `connect-src`** ([next.config.mjs](next.config.mjs)).
   `@react-three/xr` still fetches input profiles / hand assets from there; blocking it breaks input.
5. **All XR UI must be in-scene meshes.** DOM/HTML does not render inside an immersive session.
6. **UI materials use `toneMapped={false}`.** The scene's ACES tone-mapping otherwise greys out white
   text and UI colors.
7. **Clipping planes are world-space.** Author the plane in the model's local frame, then re-project
   from the model group's live `matrixWorld` every frame (the `XRClippingController` pattern) so the
   cut tracks placement/scale/grab.
8. **Keep the model and panel in the same reference frame.** Mixing a camera-relative panel with a
   world-fixed model makes them collide on entry. The panel billboards to face the user and is
   draggable by its header; the model sits world-fixed, front-and-centre.
9. **Reuse the existing in-scene components** in `AnatomyViewer.tsx`: `XRGrabbableModel`,
   `XRClippingController`, `XRControlPanel`, `XRControlButton`, `XRTextPlane`, `XRSlider`. Don't
   reinvent input/UI primitives.

## Verifying & testing

- Automated (all reachable here): `npx tsc --noEmit`, `npx eslint <files>`, `npm run build`.
- The immersive viewer **cannot** be verified in a browser preview: `/xr/*` and `/learn/*` redirect
  to `/login`, and there's no Storybook story. Real behavior needs a physical **Quest 3** / **Vision
  Pro**, and **CSP/header changes require a rebuild+redeploy** to take effect.
- Diagnostic pattern: surface `useXR((s) => s.inputSourceStates.length)` as on-panel text to confirm
  the headset is reporting input sources (0 = none detected; ≥1 = detected, so a missing ray points
  to an asset/CSP problem rather than detection).
- Known unresolved risk to watch on Quest: three.js clipping + WebXR **multiview** can freeze on
  entering VR. If it does, disable multiview or fall back to the CT slice planes.
