import { useEffect, useRef, useState } from 'react'
import { decodeGzip } from '@bronchoscopy-core/compression'
import type { SlicePlane } from '@bronchoscopy-core/ct'
import type { CtMetadata, LoadedNoduleAsset, Vec3 } from './types'
import { rasToPatient } from '@bronchoscopy-core/devices'

export interface SliceResult {
  plane: SlicePlane
  rgba: Uint8ClampedArray
  signed: boolean
  nativeRegions: number
}
interface Client {
  plane: SlicePlane
  windowHu: [number, number]
  tip: Vec3
  nodule: LoadedNoduleAsset | null
  target: Vec3 | null
  receive: (result: SliceResult) => void
}
const brokers = new WeakMap<Uint8Array, CtBroker>()
class CtBroker {
  readonly worker = new Worker(
    new URL('../../../src/lib/bronchoscopy-core/ct.worker.ts', import.meta.url),
    { type: 'module' },
  )
  readonly clients = new Map<string, Client>()
  private sequence = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private controller = new AbortController()
  private inFlight = false
  private dirty = false
  private overlay: LoadedNoduleAsset | null = null
  signed = false
  closed = false
  constructor(
    readonly ct: CtMetadata,
    volume: Uint8Array,
  ) {
    const preview = Int16Array.from(volume, (v) =>
      Math.round(ct.windowHu[0] + (v / 255) * (ct.windowHu[1] - ct.windowHu[0])),
    )
    this.worker.postMessage(
      { type: 'init', geometry: ct, volume: preview.buffer, native: ct.nativeBricks },
      [preview.buffer],
    )
    this.worker.onmessage = (e) => {
      if (e.data.id !== this.sequence) return
      for (const image of e.data.images) {
        const client = this.clients.get(image.plane.axis)
        if (client)
          client.receive({ ...image, signed: this.signed, nativeRegions: e.data.nativeRegions })
      }
      this.inFlight = false
      if (this.dirty) this.schedule()
    }
    if (ct.signedPreview) void this.promote(ct.signedPreview)
  }
  async promote(source: NonNullable<CtMetadata['signedPreview']>) {
    try {
      const response = await fetch(source.url, { signal: this.controller.signal })
      if (!response.ok) return
      const bytes = await decodeGzip(await response.arrayBuffer())
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
      if (
        hash !== source.sha256 ||
        bytes.byteLength !== this.ct.sizeXyz.reduce((a, b) => a * b, 1) * 2 ||
        this.closed
      )
        return
      this.worker.postMessage(
        { type: 'init', geometry: this.ct, volume: bytes, native: this.ct.nativeBricks },
        [bytes],
      )
      this.signed = true
      this.schedule()
    } catch {
      /* Legacy preview stays usable if an optional source level is unavailable. */
    }
  }
  update(client: Client) {
    this.clients.set(client.plane.axis, client)
    this.schedule()
  }
  schedule() {
    this.dirty = true
    if (this.inFlight) return
    if (this.timer || this.closed) return
    this.timer = setTimeout(() => {
      this.timer = null
      const clients = [...this.clients.values()]
      if (!clients.length) return
      this.dirty = false
      this.inFlight = true
      const nodule = clients[0].nodule
      if (nodule !== this.overlay) {
        this.overlay = nodule
        if (nodule) {
          const residual = nodule.residual.slice(),
            alpha = nodule.alpha.slice()
          this.worker.postMessage(
            {
              type: 'overlay',
              overlay: {
                geometry: {
                  sizeXyz: nodule.metadata.sizeXyz,
                  spacingXyzMm: nodule.metadata.spacingXyzMm,
                  originLps: [0, 0, 0],
                  directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
                },
                residual,
                alpha,
              },
            },
            [residual.buffer, alpha.buffer],
          )
        } else this.worker.postMessage({ type: 'overlay' })
      }
      const target = clients[0].target
      const overlayOrigin =
        nodule && target
          ? rasToPatient(target).map(
              (v, i) => v - nodule.metadata.centroidIndexXyz[i] * nodule.metadata.spacingXyzMm[i],
            )
          : undefined
      this.worker.postMessage({
        type: 'render',
        id: ++this.sequence,
        planes: clients.map((c) => c.plane),
        low: this.ct.windowHu[0],
        high: this.ct.windowHu[1],
        windows: Object.fromEntries(clients.map((c) => [c.plane.axis, c.windowHu])),
        tip: clients[0].tip,
        overlayOrigin,
      })
    }, 50)
  }
  remove(key: string) {
    this.clients.delete(key)
    if (!this.clients.size) {
      this.closed = true
      this.controller.abort()
      this.worker.terminate()
      if (this.timer) clearTimeout(this.timer)
    } else this.schedule()
  }
}
/** One worker, one signed volume and one 64 MiB native cache for all three CT panes. */
export function useCtSlice(
  ct: CtMetadata,
  volume: Uint8Array,
  plane: SlicePlane,
  tip: Vec3,
  windowHu: [number, number],
  nodule: LoadedNoduleAsset | null,
  target: Vec3 | null,
) {
  const broker = useRef<CtBroker | null>(null),
    [result, setResult] = useState<SliceResult | null>(null)
  useEffect(() => {
    let current = brokers.get(volume)
    if (!current || current.closed) {
      current = new CtBroker(ct, volume)
      brokers.set(volume, current)
    }
    broker.current = current
    return () => {
      current.remove(plane.axis)
      broker.current = null
    }
  }, [ct, volume, plane.axis])
  useEffect(() => {
    broker.current?.update({ plane, tip, windowHu, nodule, target, receive: setResult })
  }, [plane, tip, windowHu, nodule, target])
  return result
}
