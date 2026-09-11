/// <reference lib="webworker" />
import {
  renderAcousticFrame,
  type AcousticVolume,
  type AcousticPose,
  type AcousticControls,
} from './acoustic'
import { RENDERING_QUALITY } from './quality'
type Request =
  | { type: 'init'; volume: AcousticVolume }
  | {
      type: 'render'
      id: number
      pose: AcousticPose
      controls: AcousticControls
      width: number
      height: number
    }
let volume: AcousticVolume | null = null,
  queued: Extract<Request, { type: 'render' }> | null = null,
  scheduled = false
let averageMs = 16,
  samples = 0
self.onmessage = (event: MessageEvent<Request>) => {
  if (event.data.type === 'init') {
    volume = event.data.volume
    return
  }
  queued = event.data
  if (scheduled) return
  scheduled = true
  setTimeout(() => {
    scheduled = false
    if (!volume || !queued) return
    const request = queued
    queued = null
    const quality =
      samples > 20 && averageMs > 26
        ? RENDERING_QUALITY.low
        : samples > 20 && averageMs > 20
          ? RENDERING_QUALITY.balanced
          : RENDERING_QUALITY.high
    const start = performance.now(),
      frame = renderAcousticFrame(
        volume,
        request.pose,
        request.controls,
        request.width,
        request.height,
        quality.acousticBeams,
        quality.acousticSamples,
      )
    const renderMs = performance.now() - start
    averageMs = averageMs * 0.9 + renderMs * 0.1
    samples++
    self.postMessage({ id: request.id, frame, renderMs }, [
      frame.rgba.buffer,
      frame.labelImage.buffer,
    ])
  }, 0)
}
