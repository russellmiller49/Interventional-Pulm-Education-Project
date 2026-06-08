# WebXR viewer conventions (the why behind the rules)

Every rule here maps to a real bug we hit building this viewer. Read the relevant section before
changing that part of `src/components/3d/AnatomyViewer.tsx` or `src/components/3d/xr/*`.

## Contents

1. Library & session model (@react-three/xr v6, VR-only)
2. The XR store (`xrStore.ts`)
3. CSP / controller & input assets
4. Input: pointer events, not `getController`
5. In-scene UI only + tone mapping
6. World-space clipping that tracks the model
7. Placement: model vs panel in one frame; billboard + drag
8. Performance on standalone Quest
9. Diagnosing "nothing works" in the headset
10. Verification constraints

---

## 1. Library & session model

Use **@react-three/xr v6** (pmndrs), which unifies Quest controllers, Quest hands, and Vision Pro
pinch into one R3F pointer-event model. Pattern:

```tsx
import { XR, useXR } from '@react-three/xr'
const xrStore = useMemo(() => createAnatomyXRStore(), [])
<Canvas> <XR store={xrStore}> {/* scene */} </XR> </Canvas>
<button onClick={() => xrStore.enterVR()}>Enter VR</button>
```

**VR only.** Apple Vision Pro's WebXR `immersive-ar` is non-functional (Apple ships the flag but it
does nothing), and we don't need passthrough. VR works on both headsets, so it's the single mode.
Don't request `immersive-ar`, `hit-test`, or `bounded-floor`. Exit with
`xrStore.getState().session?.end()`. Mirror session presence into local state by subscribing to the
store (`xrStore.subscribe(...)`) — `useXR` only works inside `<XR>`.

## 2. The XR store (`src/components/3d/xr/xrStore.ts`)

```ts
createXRStore({
  offerSession: 'immersive-vr', // never auto-offer AR
  foveation: 1, // ease the standalone Quest GPU
  frameRate: 'high',
  controller: { model: false }, // <-- critical, see §3
})
```

`controller`, `hand`, `transientPointer`, `gaze` default to enabled — exactly what we want for
cross-headset input. `model: false` keeps the **ray pointer + pointer events** (they come from the
XR input source) while skipping the controller GLB load.

## 3. CSP / controller & input assets — the silent killer

`@react-three/xr` / `@pmndrs/xr` fetch WebXR input profiles and controller/hand models at runtime
from:

```
https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/
```

This project has a **strict CSP**. If `connect-src` doesn't allow that host, the fetch is blocked and
the controller subtree never mounts — **no model, no ray, no pointer events at all** (the scene still
renders, which hides the cause). Two defenses, both applied:

- `next.config.mjs` `connect-src` includes `https://cdn.jsdelivr.net` (kept in sync with the
  embedded-app policy's `.replace()`).
- `controller: { model: false }` removes the dependency on the controller GLB specifically — this is
  why Vision Pro (pinch, no controller model) worked before Quest (controllers) did.

**CSP is build/serve-time.** Any header change needs a rebuild+redeploy to take effect; testing the
old build looks like the fix failed.

## 4. Input: pointer events, not `getController(0/1)`

The old code used `gl.xr.getController(0/1)` + `selectstart/selectend`. On Vision Pro, with
hand-tracking enabled, hands occupy `inputSources[0/1]` and the pinch (transient-pointer) lands at
index 2+, so the controller path never sees it. **Use R3F pointer events on meshes** — the store
dispatches them for all input types:

```tsx
// grab/drag (translation that follows the ray; rotation from ray-direction delta)
const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
  e.stopPropagation()
  ;(e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
  const dir = e.ray.direction.clone().normalize()
  const dist = Number.isFinite(e.distance) ? e.distance : e.ray.origin.distanceTo(e.point)
  // store anchor = origin + dir*dist, and offset = target.position - anchor
}
```

**Pointer capture is essential** for grabs/drags/sliders — it keeps `pointermove` flowing even when
the ray leaves the object mid-drag. `@react-three/xr` supports `e.target.setPointerCapture(id)`.
For buttons, prefer `onPointerDown` over `onClick` (immediate, no click-synthesis edge cases).
Put handlers on the wrapping `<group>` so events bubble from child meshes/text.

## 5. In-scene UI only + tone mapping

- **DOM/HTML UI does not render inside an immersive session.** Every control the user touches in the
  headset is an in-scene mesh: `XRControlPanel`, `XRControlButton`, `XRTextPlane`, `XRSlider`.
- The scene uses **ACES tone mapping** (R3F default) + exposure 1.2, which desaturates/darkens pure
  white. UI text/colors looked grey until we set **`toneMapped={false}`** on the UI materials. Any
  new in-scene UI material should set it too.
- `XRTextPlane` renders text to a `CanvasTexture` (white fill + dark stroke) on an unlit
  `meshBasicMaterial`. `XRSlider` is a dependency-free track/fill/knob with the fill+knob meshes
  opting out of raycast (`raycast={() => null}`) so only the origin-centred track is hit and
  `worldToLocal(point).x` maps straight to a 0..1 value.

## 6. World-space clipping that tracks the model

three evaluates `material.clippingPlanes` in **world space**, but the cut is naturally defined in the
model's local frame (from `patientToModelMatrix` or the bounding box). On desktop the model sits at
the origin so it happened to work; in XR the model is placed/scaled/grabbed, so a model-space plane
applied as world-space drifts and sweeps through the anatomy.

Fix (`XRClippingController` in `AnatomyViewer.tsx`): build the plane in the **group-local** frame
once (memoized on clip params), then re-project to world from the group's **live matrix every
frame**, mutating one shared `Plane` instance the materials reference:

```tsx
useFrame(() => {
  if (!enabled || !localPlane) return
  const world = worldPlaneRef.current.copy(localPlane)
  const target = targetRef.current
  if (target) {
    target.updateMatrixWorld()
    world.applyMatrix4(target.matrixWorld)
  }
})
// toggle gl.localClippingEnabled + assign material.clippingPlanes = [worldPlaneRef.current] on enable
```

`Plane.applyMatrix4(matrix)` computes the normal matrix internally. Because the same `Plane` instance
is mutated in place, three reads the updated cut each render with no per-frame `needsUpdate`.

## 7. Placement: keep model and panel in one frame; billboard + drag

The original bug: the panel was placed **camera-relative** (billboarded to the head at entry) while
the model was **world-fixed**, so they collided on entry — and the collision shifted with the user's
height. Rules:

- **Model:** world-fixed, front-and-centre at eye level, sized so it doesn't dominate (≈0.55 m). See
  `computeSpatialPlacement`. It's grabbable via `XRGrabbableModel`.
- **Panel:** parked off to the side on the first frame, then **billboards to face the user** every
  frame (`panel.quaternion.copy(camera.getWorldQuaternion(...))`) and is **draggable by its header
  bar** (pointer-capture translation that sets `panel.position`). Position/rotation are managed
  **imperatively** (not via props) so React's reconciler never fights the drag.
- Don't reintroduce a camera-relative panel placed against a world-fixed model.

## 8. Performance on standalone Quest

- `foveation: 1` on the store.
- The 13 MB GLB loads once (fine); the real cost is the NRRD `VolumeSlice` path, which rebuilds CPU
  canvas textures on every slice change. The slice slider is **throttled** (`throttleMs`, with a
  forced final emit on release) so scrubbing doesn't rebuild a texture every frame.
- Per-plane CT visibility lets users show just one plane, cutting texture rebuilds.

## 9. Diagnosing "nothing works" in the headset

Surface the input count as on-panel text and read it in the headset:

```tsx
const xrInputCount = useXR((s) => s.inputSourceStates.length)
```

- `0` → the session isn't reporting input sources (session/feature problem).
- `≥1` but no ray/interaction → inputs are detected, so suspect the **asset/CSP** path (§3) or
  occlusion (the model in front of the panel intercepting the ray).
  Remove the readout once things are confirmed.

## 10. Verification constraints

- Reachable here: `npx tsc --noEmit`, `npx eslint <files>`, `npm run build`.
- **Not** reachable: the live viewer — `/xr/*` and `/learn/*` redirect to `/login`, and there's no
  Storybook story for it. Real XR behavior must be tested on a physical Quest 3 / Vision Pro.
- After any `next.config.mjs` / CSP change, **rebuild + redeploy** before testing.
- ESLint note: `react-hooks/immutability` false-positives on three.js object mutation (e.g.
  `gl.localClippingEnabled = …`, `volume.windowLow = …`). Use a scoped `eslint-disable` with a
  comment rather than restructuring valid three.js code.
