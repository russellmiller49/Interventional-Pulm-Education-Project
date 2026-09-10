import { patientToVoxel, trilinear, type CtGeometry } from './ct'
import type { Point3 } from './frame'
export interface CtResidualOverlay {
  geometry: CtGeometry
  residual: Int16Array
  alpha: Uint8Array
}
/** Apply the lesion residual in HU before windowing, using its patient-space placement. */
export function residualHuAt(
  overlay: CtResidualOverlay | undefined,
  point: Point3,
  origin?: Point3,
) {
  if (!overlay || !origin) return 0
  const g = { ...overlay.geometry, originLps: origin },
    ijk = patientToVoxel(g, point)
  if (ijk.some((v, i) => v < 0 || v > g.sizeXyz[i] - 1)) return 0
  const index = (i: number, j: number, k: number) => (k * g.sizeXyz[1] + j) * g.sizeXyz[0] + i
  const alpha = trilinear(g, ijk, (i, j, k) => overlay.alpha[index(i, j, k)]) / 255
  return alpha <= 0.004
    ? 0
    : alpha * trilinear(g, ijk, (i, j, k) => overlay.residual[index(i, j, k)])
}
