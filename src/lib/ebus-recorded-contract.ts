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
  settings: { depthMm: number; gain: number; contrast: number; doppler: boolean }
  calipers: { x: number; y: number }[]
  held: boolean
  captured: boolean
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
    Array.isArray(v.calipers) &&
    v.calipers.length <= 2 &&
    v.calipers.every((p) => p && [p.x, p.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) &&
    typeof v.held === 'boolean' &&
    typeof v.captured === 'boolean'
  )
}
