import manifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import type { CtTrace } from '../content/ct-types'
import { displayPoint, undisplayPoint, type DisplayPreset } from './coordinates'

export const NATIVE_CT_BASE = '/branch-tracing/native-v1'
export const NATIVE_CT = {
  size: 512,
  spacing: [0.689453125, 0.689453125, 0.5],
  origin: [-182.1552734375, -374.1552734375, -368.5],
  window: [-1000, 400],
} as const
export const CT_TRACES = manifest.traces as unknown as CtTrace[]
export function traceById(id: string): CtTrace {
  const trace = CT_TRACES.find((t) => t.id === id)
  if (!trace) throw new Error(`Unknown CT trace: ${id}`)
  return trace
}
export const sliceZ = (slice: number) => NATIVE_CT.origin[2] + slice * NATIVE_CT.spacing[2]
export const nativeImageUrl = (slice: number) =>
  `${NATIVE_CT_BASE}/axial/${String(slice).padStart(3, '0')}.png`
export function pixelToDisplay(
  pixel: readonly number[],
  center: readonly number[],
  size: number,
  preset: DisplayPreset,
) {
  const p = displayPoint(
    [((pixel[0] - center[0]) * 100) / size, ((pixel[1] - center[1]) * 100) / size],
    preset,
  )
  return [p[0] + 50, p[1] + 50] as [number, number]
}
export function displayToPixel(
  point: readonly number[],
  center: readonly number[],
  size: number,
  preset: DisplayPreset,
) {
  const p = undisplayPoint([point[0] - 50, point[1] - 50], preset)
  return [center[0] + (p[0] * size) / 100, center[1] + (p[1] * size) / 100] as [number, number]
}
export const DISPLAY_TRANSFORM: Record<DisplayPreset, string> = {
  standard: '',
  mirror: 'scale(-1 1)',
  rul: 'rotate(-90)',
  'upper-division': 'rotate(90)',
}
export const ORIENTATION_LABELS: Record<
  DisplayPreset,
  { top: string; right: string; bottom: string; left: string }
> = {
  standard: { top: 'A', right: 'L', bottom: 'P', left: 'R' },
  mirror: { top: 'A', right: 'R', bottom: 'P', left: 'L' },
  rul: { top: 'L', right: 'P', bottom: 'R', left: 'A' },
  'upper-division': { top: 'R', right: 'A', bottom: 'L', left: 'P' },
}
export const ORIENTATION_NOTES: Record<DisplayPreset, string> = {
  standard: 'Standard axial view, seen from the feet: patient right is screen-left.',
  mirror:
    'Left/right reflection. The book uses this convention for the middle lobe, lingula and lower lobes when tracing caudally.',
  rul: 'Right upper lobe: 90° counterclockwise from standard axial. The right lateral chest wall is below the airway.',
  'upper-division':
    'Left upper division: 90° clockwise from standard axial. The left lateral chest wall is below the airway.',
}
