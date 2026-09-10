/// <reference lib="webworker" />
import {
  patientToVoxel,
  trilinear,
  reslice,
  type CtGeometry,
  type NativeBricks,
  type SlicePlane,
} from './ct'
import type { Point3 } from './frame'
import { decodeGzip } from './compression'

let nativeGeometry: CtGeometry | undefined
let geometry: CtGeometry,
  volume: Int16Array,
  native: NativeBricks | undefined,
  latest = 0
const cache = new Map<string, Int16Array>(),
  pending = new Map<string, Promise<void>>(),
  failed = new Set<string>()
let cacheBytes = 0
const MAX_CACHE_BYTES = 64 * 1024 * 1024
function keyAt(ijk: Point3) {
  const s = native!.brickSize
  return ijk.map((v) => Math.floor(v / s)).join('-')
}
function samplePreview(point: Point3) {
  return trilinear(
    geometry,
    patientToVoxel(geometry, point),
    (i, j, k) => volume[(k * geometry.sizeXyz[1] + j) * geometry.sizeXyz[0] + i] ?? -1024,
  )
}
function sample(point: Point3) {
  if (!native) return samplePreview(point)
  const g = nativeGeometry!,
    ijk = patientToVoxel(g, point)
  let missing = false
  const value = trilinear(g, ijk, (i, j, k) => {
    const s = native!.brickSize,
      key = keyAt([i, j, k]),
      brick = cache.get(key)
    if (!brick) {
      missing = true
      return 0
    }
    const x = Math.floor(i / s) * s,
      y = Math.floor(j / s) * s
    const sx = Math.min(s, g.sizeXyz[0] - x),
      sy = Math.min(s, g.sizeXyz[1] - y)
    return brick[((k % s) * sy + (j % s)) * sx + (i % s)] ?? -1024
  })
  return missing ? samplePreview(point) : value
}
async function loadBrick(key: string) {
  if (cache.has(key) || failed.has(key)) return
  if (pending.has(key)) return pending.get(key)
  const task = (async () => {
    try {
      const response = await fetch(`${native!.baseUrl}/${key}.i16.gz`)
      if (!response.ok || !response.body) throw new Error('Native CT region unavailable')
      const bytes = await decodeGzip(await response.arrayBuffer())
      const brick = new Int16Array(bytes)
      while (cacheBytes + brick.byteLength > MAX_CACHE_BYTES && cache.size) {
        const oldest = cache.keys().next().value!
        cacheBytes -= cache.get(oldest)!.byteLength
        cache.delete(oldest)
      }
      cache.set(key, brick)
      cacheBytes += brick.byteLength
    } catch {
      failed.add(key)
    } finally {
      pending.delete(key)
    }
  })()
  pending.set(key, task)
  return task
}
function send(id: number, planes: SlicePlane[], low: number, high: number) {
  if (id !== latest) return
  const images = planes.map((plane) => ({ plane, rgba: reslice(plane, low, high, sample) }))
  self.postMessage(
    { id, images, nativeRegions: cache.size, cacheBytes },
    images.map((i) => i.rgba.buffer),
  )
}
type CtWorkerRequest =
  | { type: 'init'; geometry: CtGeometry; volume: ArrayBuffer; native?: NativeBricks }
  | { type: 'render'; id: number; planes: SlicePlane[]; low: number; high: number; tip: Point3 }
async function handleRequest(m: CtWorkerRequest) {
  if (m.type === 'init') {
    geometry = m.geometry
    volume = new Int16Array(m.volume)
    native = m.native
    nativeGeometry = native ? { ...geometry, ...native } : undefined
    cache.clear()
    failed.clear()
    cacheBytes = 0
    return
  }
  if (m.type !== 'render' || !volume) return
  const { id, planes, low, high } = m as {
    id: number
    planes: SlicePlane[]
    low: number
    high: number
  }
  if (id !== latest) return
  send(id, planes, low, high)
  if (!native) return
  // Only promote the region around the probe, keeping the full-volume preview available.
  const wanted = new Set<string>(),
    g = { ...geometry, ...native }
  for (const plane of planes)
    for (let y = -48; y <= 48; y += 16)
      for (let x = -48; x <= 48; x += 16) {
        const p = m.tip.map(
          (v: number, i: number) => v + plane.right[i] * x + plane.down[i] * y,
        ) as Point3
        const ijk = patientToVoxel(g, p)
        if (ijk.every((v, i) => v >= 0 && v < g.sizeXyz[i])) wanted.add(keyAt(ijk))
      }
  // Touch the LRU entries in the active region before admitting new bricks.
  for (const key of wanted) {
    const value = cache.get(key)
    if (value) {
      cache.delete(key)
      cache.set(key, value)
    }
  }
  const keys = [...wanted].filter((k) => !cache.has(k) && !failed.has(k))
  for (let i = 0; i < keys.length; i += 4) {
    if (id !== latest) return
    await Promise.all(keys.slice(i, i + 4).map(loadBrick))
  }
  if (keys.length) send(id, planes, low, high)
}

let queued: Extract<CtWorkerRequest, { type: 'render' }> | null = null,
  scheduled = false
self.onmessage = (event: MessageEvent<CtWorkerRequest>) => {
  if (event.data.type === 'init') {
    void handleRequest(event.data)
    return
  }
  latest = event.data.id
  queued = event.data
  if (!scheduled) {
    scheduled = true
    setTimeout(() => {
      scheduled = false
      if (queued) void handleRequest(queued)
    }, 0)
  }
}
