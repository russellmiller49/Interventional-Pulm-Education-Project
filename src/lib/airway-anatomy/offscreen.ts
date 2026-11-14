import type { Camera, Scene, WebGLRenderer, WebGLRenderTarget } from 'three'

/**
 * Render `scene` from `camera` into `target` in the middle of a frame, then hand the renderer back
 * exactly as it was. In a WebXR session the current target is the headset framebuffer, which three
 * binds at the start of every XR frame; resetting to `null` instead would send the rest of the frame
 * to the page canvas and leave the headset black. XR is off for the pass so three renders this mono
 * camera rather than the stereo headset cameras.
 */
export function renderOffscreen(
  renderer: Pick<WebGLRenderer, 'getRenderTarget' | 'setRenderTarget' | 'render' | 'xr'>,
  scene: Scene,
  camera: Camera,
  target: WebGLRenderTarget,
) {
  const previousTarget = renderer.getRenderTarget()
  const xrWasEnabled = renderer.xr.enabled
  renderer.xr.enabled = false
  try {
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
  } finally {
    renderer.setRenderTarget(previousTarget)
    renderer.xr.enabled = xrWasEnabled
  }
}
