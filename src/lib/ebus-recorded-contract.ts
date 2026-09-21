/**
 * Which recorded example the frame came from (EBUS-PRE-REVIEW-02, L7-1).
 *
 * The recordings are a lookup, not a continuous simulator: each clip varies exactly one control
 * and holds the rest at whatever the recording was made with. `settings` below carries the
 * learner's selection, which is what the lab goal is checked against; this carries what the
 * recording itself is, so nothing has to present an example index as a device unit.
 */
export interface RecordedExampleSource {
  /** The control this recording varies. `flow` clips vary the flow mode, not a numeric level. */
  control: 'gain' | 'contrast' | 'flow'
  /** The recorded step, 1-based, as the lookup names it. */
  index: number
  /** How many recorded steps exist for that control at this depth. */
  levels: number
  /** The segment name in the lookup, e.g. `Depth4_Gain_3`. */
  segmentId: string
  /** The file the segment is read from, and the window inside it, in seconds. */
  file: string
  startSeconds: number
  endSeconds: number
  /** The depth the recording was made at, in cm, from the lookup rather than the control. */
  depthCm: number
}
/** Provenance for an actual decoded recording frame. Pixels stay in the mounted workbench. */
export interface RecordedFrameSource {
  type: 'recorded-frame'
  version: 1
  sessionId: string
  taskId: string
  frameId: string
  segmentId: string
  mediaTime: number
  width: number
  height: number
  /** The learner's selected control values at the moment of capture, unchanged by this batch. */
  settings: { depthMm: number; gain: number; contrast: number; doppler: boolean }
  /** What the recording behind those pixels actually is. Optional: older frames carry no example. */
  example?: RecordedExampleSource
  calipers: { x: number; y: number }[]
  held: boolean
  captured: boolean
}
export function isRecordedExampleSource(value: unknown): value is RecordedExampleSource {
  if (!value || typeof value !== 'object') return false
  const v = value as RecordedExampleSource
  return (
    ['gain', 'contrast', 'flow'].includes(v.control) &&
    [v.index, v.levels].every((n) => Number.isInteger(n) && n >= 1 && n <= 32) &&
    v.index <= v.levels &&
    ['segmentId', 'file'].every(
      (key) =>
        typeof v[key as 'segmentId' | 'file'] === 'string' &&
        String(v[key as 'segmentId' | 'file']).length > 0 &&
        String(v[key as 'segmentId' | 'file']).length < 180,
    ) &&
    [v.startSeconds, v.endSeconds].every((n) => Number.isFinite(n) && n >= 0 && n < 86400) &&
    v.endSeconds > v.startSeconds &&
    Number.isFinite(v.depthCm) &&
    v.depthCm > 0 &&
    v.depthCm <= 20
  )
}
export function isRecordedFrameSource(value: unknown): value is RecordedFrameSource {
  if (!value || typeof value !== 'object') return false
  const v = value as RecordedFrameSource
  return (
    v.type === 'recorded-frame' &&
    v.version === 1 &&
    ['sessionId', 'taskId', 'frameId', 'segmentId'].every(
      (key) =>
        typeof v[key as keyof RecordedFrameSource] === 'string' &&
        String(v[key as keyof RecordedFrameSource]).length > 0 &&
        String(v[key as keyof RecordedFrameSource]).length < 180,
    ) &&
    Number.isFinite(v.mediaTime) &&
    v.mediaTime >= 0 &&
    v.mediaTime < 86400 &&
    [v.width, v.height].every((n) => Number.isInteger(n) && n > 0 && n <= 8192) &&
    !!v.settings &&
    [v.settings.depthMm, v.settings.gain, v.settings.contrast].every(Number.isFinite) &&
    v.settings.depthMm >= 15 &&
    v.settings.depthMm <= 80 &&
    v.settings.gain >= 0 &&
    v.settings.gain <= 100 &&
    v.settings.contrast >= 0 &&
    v.settings.contrast <= 100 &&
    typeof v.settings.doppler === 'boolean' &&
    (v.example === undefined || isRecordedExampleSource(v.example)) &&
    Array.isArray(v.calipers) &&
    v.calipers.length <= 2 &&
    v.calipers.every((p) => p && [p.x, p.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) &&
    typeof v.held === 'boolean' &&
    typeof v.captured === 'boolean'
  )
}
