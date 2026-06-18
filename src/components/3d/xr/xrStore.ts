import { createXRStore } from '@react-three/xr'

/**
 * Shared WebXR store for the anatomy viewer.
 *
 * Created once per viewer instance (via useMemo in the component). `@react-three/xr` v6
 * enables controllers, hands, transient-pointer (Apple Vision Pro pinch) and gaze by default,
 * exposing all of them through one synthetic pointer-event model. That unified model is what
 * lets the same grab/UI code work on Quest 3 controllers, Quest hand-tracking, and Vision Pro
 * pinch — replacing the old getController(0/1) path that never saw Vision Pro's pinch.
 *
 * We target VR only: Vision Pro has no functional WebXR `immersive-ar`, and we don't need
 * passthrough, so VR is the single shared immersive mode across both headsets.
 */
export function createAnatomyXRStore() {
  return createXRStore({
    // Only ever offer/auto-grant a VR session — never auto-request immersive-ar.
    offerSession: 'immersive-vr',
    // Max foveation eases the standalone Quest GPU when rendering large meshes + clipping.
    foveation: 1,
    frameRate: 'high',
    // Render Quest controllers as a ray only — `model: false` skips loading the controller GLB from
    // the @webxr-input-profiles CDN. The ray pointer + pointer events come straight from the XR input
    // source, so input no longer depends on that asset load (which was leaving Quest with no
    // controllers/ray at all). rayPointer + grabPointer stay enabled by default.
    controller: { model: false },
    // hand / transientPointer / gaze stay default `true`; Vision Pro pinch (transient-pointer) and
    // hand-tracking are unaffected by the controller option above.
  })
}
