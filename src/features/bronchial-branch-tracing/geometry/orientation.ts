import type { DisplayPreset } from './coordinates'

/** Image-space operation R * M. Patient-space coordinates never change. */
export interface CtOrientation {
  turns: 0 | 1 | 2 | 3
  reflected: boolean
}
export type OrientationOperation = 'left' | 'right' | 'flip' | 'reset'
export const STANDARD_ORIENTATION: CtOrientation = { turns: 0, reflected: false }
const quarter = (n: number) => (((n % 4) + 4) % 4) as CtOrientation['turns']
export function turnCt(o: CtOrientation, operation: OrientationOperation): CtOrientation {
  if (operation === 'reset') return { ...STANDARD_ORIENTATION }
  // Reflect about the CURRENT screen's vertical axis, including after rotation.
  if (operation === 'flip') return { turns: quarter(-o.turns), reflected: !o.reflected }
  return { ...o, turns: quarter(o.turns + (operation === 'right' ? 1 : -1)) }
}
export function orientationFor(preset: DisplayPreset): CtOrientation {
  return {
    turns: preset === 'rul' ? 3 : preset === 'upper-division' ? 1 : 0,
    reflected: preset === 'mirror',
  }
}
export const sameOrientation = (a: CtOrientation, b: CtOrientation) =>
  a.turns === b.turns && a.reflected === b.reflected
export const validOrientation = (o: CtOrientation) =>
  Number.isInteger(o.turns) && o.turns >= 0 && o.turns <= 3 && typeof o.reflected === 'boolean'
export function orientPoint(p: readonly number[], o: CtOrientation): [number, number] {
  const x = o.reflected ? -p[0] : p[0],
    y = p[1]
  return [
    [x, y],
    [-y, x],
    [-x, -y],
    [y, -x],
  ][o.turns] as [number, number]
}
export function unorientPoint(p: readonly number[], o: CtOrientation): [number, number] {
  const [x, y] = orientPoint(p, { turns: quarter(-o.turns), reflected: false })
  return [o.reflected ? -x : x, y]
}
export const orientationTransform = (o: CtOrientation) =>
  `rotate(${o.turns === 3 ? -90 : o.turns * 90}) scale(${o.reflected ? -1 : 1} 1)`
export function orientationName(o: CtOrientation) {
  if (sameOrientation(o, STANDARD_ORIENTATION)) return 'Standard axial'
  const rotation = ['', '90° clockwise', '180° rotation', '90° counterclockwise'][o.turns]
  return [o.reflected ? 'Left–right reflection' : '', rotation].filter(Boolean).join(' + ')
}
export function orientationLabels(o: CtOrientation) {
  const out = { top: '', right: '', bottom: '', left: '' }
  for (const [letter, point] of Object.entries({ A: [0, -1], L: [1, 0], P: [0, 1], R: [-1, 0] })) {
    const [x, y] = orientPoint(point, o)
    out[x === 1 ? 'right' : x === -1 ? 'left' : y === 1 ? 'bottom' : 'top'] = letter
  }
  return out
}
export function orientedPixel(
  pixel: readonly number[],
  center: readonly number[],
  size: number,
  o: CtOrientation,
): [number, number] {
  const p = orientPoint(
    [((pixel[0] - center[0]) * 100) / size, ((pixel[1] - center[1]) * 100) / size],
    o,
  )
  return [p[0] + 50, p[1] + 50]
}
export function nativePixel(
  point: readonly number[],
  center: readonly number[],
  size: number,
  o: CtOrientation,
): [number, number] {
  const p = unorientPoint([point[0] - 50, point[1] - 50], o)
  return [center[0] + (p[0] * size) / 100, center[1] + (p[1] * size) / 100]
}
