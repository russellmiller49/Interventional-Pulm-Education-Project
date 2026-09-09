/** All dimensions/ranges in this file are authored teaching geometry, 2026-09-08.
 * The CT renderer supplies anatomical context; these functions do not estimate dose or device performance.
 * World axes: x patient left, y anterior, z superior. Cone geometry matches the original FluoroView renderer; DTS uses its separately identified parallel model.
 */
export type Point3 = [number, number, number]
export const radians = (degrees: number) => (degrees * Math.PI) / 180
export const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))
export const LESION_RADIUS = 9
export const WINDOW_RADIUS = 0.65
export const SHAFT_RADIUS = 0.38
export const SLICE_THICKNESS = 1.5
export const LESION_CENTER: Point3 = [85, -20, -30]
export const SOURCE_DISTANCE = 720
export const DETECTOR_DISTANCE = 1200
export const DETECTOR_FIELD = 640
export function projectPoint([x, y, z]: Point3, orbit: number, tilt = 0): [number, number] {
  const a = radians(orbit),
    b = radians(tilt)
  return [
    x * Math.cos(a) + y * Math.sin(a),
    z * Math.cos(b) + (x * Math.sin(a) - y * Math.cos(a)) * Math.sin(b),
  ]
}
export function beamDirection(orbit: number, tilt = 0): Point3 {
  const a = radians(orbit),
    b = radians(tilt)
  return [-Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b), Math.sin(b)]
}
/** Cone projection in detector-plane mm; matches the original FluoroView volume renderer. */
export function projectToDetector(point: Point3, orbit: number, tilt = 0): [number, number] {
  const normal = beamDirection(orbit, tilt)
  const depth = point.reduce((sum, n, i) => sum + n * normal[i], 0)
  const magnification = DETECTOR_DISTANCE / (SOURCE_DISTANCE + depth)
  const projected = projectPoint(point, orbit, tilt)
  return [projected[0] * magnification, projected[1] * magnification]
}
/** Move along the initial source–target ray so frontal overlap survives cone divergence. */
export function toolTipForDepth(depth: number): Point3 {
  const ray: Point3 = [LESION_CENTER[0], LESION_CENTER[1] + SOURCE_DISTANCE, LESION_CENTER[2]]
  const length = Math.hypot(...ray)
  return LESION_CENTER.map((n, i) => n + (ray[i] * depth) / length) as Point3
}
export function temporalMetrics(
  rate: number,
  widthMs: number,
  currentMa: number,
  speedMmS: number,
) {
  return {
    masPerSecond: ((rate * widthMs) / 1000) * currentMa,
    inFrameBlur: (speedMmS * widthMs) / 1000,
    interFrameTravel: speedMmS / rate,
    intervalMs: 1000 / rate,
  }
}
export function kapGyCm2(kermaMgy: number, areaCm2: number) {
  return (kermaMgy / 1000) * areaCm2
}
export function kapMicroGyM2(gyCm2: number) {
  return gyCm2 * 100
}
/** Project the intersection with a finite slice; thickness 0 is an exact plane. */
export function sphereSliceRadius(position: number, radius = LESION_RADIUS, thickness = 0) {
  const nearest = Math.max(0, Math.abs(position) - thickness / 2)
  return nearest <= radius ? Math.sqrt(Math.max(0, radius * radius - nearest * nearest)) : 0
}
/** Fictional side window spans tip−14 to tip−6 along x, not a device specification. */
export function windowRelationship(tip: Point3) {
  const [x, y, z] = tip
  const a = x - 14,
    b = x - 6
  const closestX = clamp(0, a, b)
  const radialOffset = Math.hypot(y, z)
  const intersects =
    closestX ** 2 + Math.max(0, radialOffset - WINDOW_RADIUS) ** 2 < LESION_RADIUS ** 2
  const full = Math.max(a * a, b * b) + (radialOffset + WINDOW_RADIUS) ** 2 < LESION_RADIUS ** 2
  const tipInside = x * x + y * y + z * z < LESION_RADIUS ** 2
  return {
    intersects,
    full,
    tipInside,
    label: full
      ? 'Sampling window fully within the sphere'
      : intersects
        ? 'Sampling window partly intersects the sphere'
        : 'Sampling window outside the sphere',
  }
}
/** Simple shift-and-add displacement at a selected plane, not vendor reconstruction. */
export function dtsShift(objectDepth: number, planeDepth: number, angle: number) {
  return (objectDepth - planeDepth) * Math.tan(radians(angle))
}
export function centeredForTeaching(x: number, depth: number) {
  return Math.abs(x) <= 8 && Math.abs(depth) <= 8
}
