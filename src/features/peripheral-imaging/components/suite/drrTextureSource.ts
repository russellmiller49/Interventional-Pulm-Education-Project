'use client'

import { CanvasTexture, LinearFilter, SRGBColorSpace, type WebGLRenderer } from 'three'
import { VolumeDRRRenderer } from '@fluoroview/volume-drr'
import { DEFAULT_FLUORO_SETTINGS } from '@fluoroview/knobology'
import { detectorFrameForAngles } from '@fluoroview/geometry'
import { IMAGING_CONFIG, loadAnatomyVolume, VOLUME_ASSET } from '../../lib/anatomy'
import { type ImagingGeometry, type Point3 } from '../../lib/physics'

export interface DrrPose {
  orbit: number
  tilt: number
  geometry?: ImagingGeometry
  /** Translating the CT by t is equivalent to translating the imaging frame by -t. */
  anatomyTranslation?: Point3
}
export type ProjectionState = 'loading' | 'ready' | 'failed'

/** The sole runtime boundary to FluoroView. One volume/context feeds both displays. */
export class DrrTextureSource {
  readonly texture: CanvasTexture
  private readonly engine: VolumeDRRRenderer
  private disposed = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<() => void>()
  private pose: DrrPose = { orbit: 0, tilt: 0 }
  revision = 0
  state: ProjectionState = 'loading'
  private readonly contextLost = (event: Event) => {
    if (this.disposed) return
    event.preventDefault()
    clearTimeout(this.timer)
    this.state = 'failed'
    this.notify()
  }

  constructor(
    readonly canvas: HTMLCanvasElement,
    size = 512,
  ) {
    canvas.addEventListener('webglcontextlost', this.contextLost)
    this.engine = new VolumeDRRRenderer({
      canvas,
      config: IMAGING_CONFIG,
      asset: VOLUME_ASSET,
      preserveDrawingBuffer: true,
    })
    // resize() retains explicit dimensions, including when the DOM rect is zero.
    this.engine.resize(1, { width: size, height: size, pixelRatio: 1 })
    this.texture = new CanvasTexture(canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.minFilter = this.texture.magFilter = LinearFilter
    this.texture.generateMipmaps = false
    this.texture.flipY = true
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private notify() {
    for (const listener of this.listeners) listener()
  }

  async load() {
    try {
      const volume = await loadAnatomyVolume()
      if (this.disposed) return
      await this.engine.load(volume)
      if (this.disposed) return
      this.state = 'ready'
      this.update(this.pose)
    } catch {
      if (!this.disposed) {
        this.state = 'failed'
        this.engine.dispose()
        this.notify()
      }
    }
  }

  update(pose: DrrPose) {
    this.pose = pose
    clearTimeout(this.timer)
    if (this.state !== 'ready' || this.disposed) return
    this.render(pose, true)
    this.timer = setTimeout(() => this.render(this.pose, false), 110)
  }

  render(pose: DrrPose, lowRes = false) {
    if (this.state !== 'ready' || this.disposed) return
    const metrics = this.engine.render({
      raoLaoDeg: pose.orbit,
      cranialCaudalDeg: pose.tilt,
      lowRes,
      // Tube-load controls never modulate DRR brightness.
      settings: { ...DEFAULT_FLUORO_SETTINGS, noiseEnabled: false },
      geometry: {
        isocenter_mm: (pose.anatomyTranslation?.map((n) => -n) as Point3 | undefined) ?? [0, 0, 0],
        ...(pose.geometry
          ? {
              source_to_isocenter_mm: pose.geometry.sod,
              source_to_detector_mm: pose.geometry.sid,
              pixel_pitch_mm: pose.geometry.field / IMAGING_CONFIG.detector_pixels[0],
            }
          : {}),
      },
    })
    this.texture.needsUpdate = true
    this.revision++
    this.notify()
    return metrics
  }

  resize(size: number) {
    this.engine.resize(1, { width: size, height: size, pixelRatio: 1 })
    this.update(this.pose)
  }

  snapshot(size = this.canvas.width) {
    if (this.state !== 'ready' || this.disposed) throw new Error('Projection unavailable')
    const copy = document.createElement('canvas')
    copy.width = copy.height = size
    const ctx = copy.getContext('2d')
    if (!ctx) throw new Error('Projection copy unavailable')
    ctx.drawImage(this.canvas, 0, 0, size, size)
    return copy
  }

  /** One context supplies every low-resolution projection; callbacks own their 2D copies. */
  async renderSequence(
    poses: readonly DrrPose[],
    options: {
      signal: AbortSignal
      immediate?: boolean
      onFrame: (canvas: HTMLCanvasElement, pose: DrrPose, index: number) => void
    },
  ) {
    clearTimeout(this.timer)
    for (let i = 0; i < poses.length; i++) {
      if (!options.immediate)
        await new Promise<void>((resolve, reject) => {
          const cancel = () => {
            cancelAnimationFrame(id)
            reject(new DOMException('Sequence stopped', 'AbortError'))
          }
          const id = requestAnimationFrame(() => {
            options.signal.removeEventListener('abort', cancel)
            resolve()
          })
          options.signal.addEventListener('abort', cancel, { once: true })
          if (options.signal.aborted) cancel()
        })
      if (options.signal.aborted || this.disposed)
        throw new DOMException('Sequence stopped', 'AbortError')
      if (this.state !== 'ready') throw new Error('Projection unavailable')
      this.render(poses[i], true)
      options.onFrame(this.snapshot(192), poses[i], i)
    }
  }

  /** Spike instrumentation only: queue time and completed upload are reported separately. */
  measureUpload(renderer: WebGLRenderer) {
    const sourceGl = this.canvas.getContext('webgl2')!
    const destinationGl = renderer.getContext()
    sourceGl.finish()
    destinationGl.finish()
    this.texture.needsUpdate = true
    const start = performance.now()
    renderer.initTexture(this.texture)
    const queued = performance.now()
    destinationGl.finish()
    return { queuedMs: queued - start, completedMs: performance.now() - start }
  }

  dispose() {
    const context = this.engine.isReady() ? this.canvas.getContext('webgl2') : null
    this.disposed = true
    clearTimeout(this.timer)
    this.listeners.clear()
    this.canvas.removeEventListener('webglcontextlost', this.contextLost)
    this.texture.dispose()
    this.engine.dispose()
    // A replaced mode must release its context, not wait for browser garbage collection.
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

/** The spike compares a quad against the existing SVG before suiteModel is introduced. */
export function referenceDetectorFrame(orbit: number, tilt: number) {
  return detectorFrameForAngles(IMAGING_CONFIG, orbit, tilt)
}
