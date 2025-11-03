export async function detectXR() {
  const supportsXR = typeof navigator !== 'undefined' && 'xr' in navigator
  let immersiveVR = false
  let immersiveAR = false

  if (supportsXR) {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr

    if (xr) {
      try {
        immersiveVR = await xr.isSessionSupported('immersive-vr')
      } catch {
        // ignore errors from feature detection
      }
      try {
        immersiveAR = await xr.isSessionSupported('immersive-ar')
      } catch {
        // ignore errors from feature detection
      }
    }
  }

  return { supportsXR, immersiveVR, immersiveAR }
}
