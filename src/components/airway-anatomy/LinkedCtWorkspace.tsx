'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  makeSlicePlane,
  orientationLabel,
  patientToSlicePixel,
  type SliceAxis,
  type SlicePlane,
} from '../../lib/bronchoscopy-core/ct'
import { times, type OpticalFrame } from '../../lib/bronchoscopy-core/frame'
import type { CtPreviewAsset } from '../../lib/airway-anatomy/types'

export interface CtSliceImage {
  plane: SlicePlane
  rgba: Uint8ClampedArray
}
interface CtResult {
  id: number
  images: CtSliceImage[]
  nativeRegions: number
  cacheBytes: number
}
const AXES: SliceAxis[] = ['axial', 'coronal', 'sagittal', 'oblique']
export function useLinkedCt(
  ct: CtPreviewAsset | undefined,
  volume: Int16Array | undefined,
  frame: OpticalFrame | null,
  low: number,
  high: number,
) {
  const [result, setResult] = useState<CtResult | null>(null)
  const [follow, setFollowValue] = useState(true),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState<[number, number]>([0, 0])
  const [offset, setOffset] = useState(0),
    [axis, setAxis] = useState<SliceAxis>('axial')
  const [windowLevel, setWindowLevel] = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [heldFrame, setHeldFrame] = useState<OpticalFrame | null>(null)
  const setFollow = useCallback(
    (value: boolean) => {
      setFollowValue(value)
      if (!value) setHeldFrame(frame)
    },
    [frame],
  )
  const sliceFrame = follow ? frame : (heldFrame ?? frame)
  const worker = useRef<Worker | null>(null),
    sequence = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const planes = useMemo(
    () =>
      ct && sliceFrame
        ? AXES.map((a) =>
            makeSlicePlane(ct, a, sliceFrame!, zoom, pan, a === axis ? offset : 0, 384),
          )
        : [],
    [ct, sliceFrame, zoom, pan, offset, axis],
  )
  const desired = useRef({ planes, low, high, tip: frame?.position })
  const inFlight = useRef(false),
    dirty = useRef(false)
  const schedule = useCallback(() => {
    dirty.current = true
    if (inFlight.current || timer.current || !worker.current) return
    timer.current = setTimeout(() => {
      timer.current = null
      if (!worker.current || !desired.current.planes.length) return
      dirty.current = false
      inFlight.current = true
      worker.current.postMessage({ type: 'render', id: ++sequence.current, ...desired.current })
    }, 80)
  }, [])
  useEffect(() => {
    desired.current = {
      planes,
      low: windowLevel ? windowLevel[0] - windowLevel[1] / 2 : low,
      high: windowLevel ? windowLevel[0] + windowLevel[1] / 2 : high,
      tip: frame?.position,
    }
  }, [planes, low, high, windowLevel, frame])
  useEffect(() => {
    if (!ct || !volume?.length) return
    const instance = new Worker(
      new URL('../../lib/bronchoscopy-core/ct.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.current = instance
    instance.onmessage = (event) => {
      if (event.data.id !== sequence.current) return
      setResult(event.data)
      inFlight.current = false
      if (dirty.current) schedule()
    }
    instance.onerror = () => setError('CT resampling could not start. Reload this view to retry.')
    // Transfer a single copy; the original remains available to the immersive viewer.
    const copy = volume.slice()
    instance.postMessage(
      { type: 'init', geometry: ct, volume: copy.buffer, native: ct.nativeBricks },
      [copy.buffer],
    )
    schedule()
    return () => {
      instance.terminate()
      worker.current = null
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      inFlight.current = false
      dirty.current = false
    }
  }, [ct, volume, schedule])
  useEffect(() => {
    if (planes.length) schedule()
  }, [planes, low, high, windowLevel, schedule])
  return {
    result,
    planes,
    follow,
    setFollow,
    zoom,
    setZoom,
    pan,
    setPan,
    offset,
    setOffset,
    axis,
    setAxis,
    windowLevel,
    setWindowLevel,
    error,
  }
}
export type LinkedCtController = ReturnType<typeof useLinkedCt>
export function LinkedCtWorkspace({
  controller,
  frame,
  low,
  high,
}: {
  controller: LinkedCtController
  frame: OpticalFrame
  low: number
  high: number
}) {
  const c = controller
  const [level, width] = c.windowLevel ?? [(low + high) / 2, high - low]
  return (
    <section
      className="rounded-lg border border-slate-700 bg-slate-950 p-3"
      aria-label="Linked CT views"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <strong className="text-sm text-white">Linked CT</strong>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={c.follow}
            onChange={(e) => {
              c.setFollow(e.target.checked)
              c.setOffset(0)
            }}
          />
          Follow scope
        </label>
        <span>{c.result?.nativeRegions ? 'Source resolution near scope' : 'CT preview'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {AXES.map((axis) => {
          const image = c.result?.images.find((i) => i.plane.axis === axis)
          return (
            <div
              key={axis}
              className={`relative overflow-hidden rounded border ${c.axis === axis ? 'border-cyan-300' : 'border-slate-800'} bg-black`}
            >
              <button
                type="button"
                onClick={() => c.setAxis(axis)}
                className="absolute left-1 top-1 z-10 rounded bg-black/70 px-1 text-[11px] capitalize text-white"
              >
                {axis === 'oblique' ? 'Scope oblique' : axis}
              </button>
              {image ? (
                <CtCanvas
                  image={image}
                  frame={frame}
                  onPan={(dx, dy) => {
                    c.setAxis(axis)
                    c.setPan([c.pan[0] - dx, c.pan[1] - dy])
                  }}
                  onSlice={(delta) => {
                    c.setAxis(axis)
                    c.setFollow(false)
                    c.setOffset(c.offset + delta)
                  }}
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-xs text-slate-400">
                  {c.error ?? 'Loading CT…'}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300">
        <label>
          Zoom {c.zoom.toFixed(1)}×
          <input
            aria-label="CT zoom"
            className="mt-1 w-full accent-cyan-300"
            type="range"
            min="1"
            max="6"
            step="0.1"
            value={c.zoom}
            onChange={(e) => c.setZoom(Number(e.target.value))}
          />
        </label>
        <label>
          {c.axis} offset {c.offset.toFixed(0)} mm
          <input
            aria-label="CT slice offset"
            className="mt-1 w-full accent-cyan-300"
            type="range"
            min="-100"
            max="100"
            step="0.5"
            value={c.offset}
            onChange={(e) => {
              c.setFollow(false)
              c.setOffset(Number(e.target.value))
            }}
          />
        </label>
        <label>
          Level {Math.round(level)} HU
          <input
            aria-label="CT level"
            className="mt-1 w-full accent-cyan-300"
            type="range"
            min="-1000"
            max="500"
            step="10"
            value={level}
            onChange={(e) => c.setWindowLevel([Number(e.target.value), width])}
          />
        </label>
        <label>
          Width {Math.round(width)} HU
          <input
            aria-label="CT width"
            className="mt-1 w-full accent-cyan-300"
            type="range"
            min="50"
            max="2000"
            step="10"
            value={width}
            onChange={(e) => c.setWindowLevel([level, Number(e.target.value)])}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>Drag to pan · scroll to browse slices</span>
        <button
          type="button"
          className="text-cyan-200"
          onClick={() => {
            c.setZoom(1)
            c.setPan([0, 0])
            c.setOffset(0)
            c.setFollow(true)
            c.setWindowLevel(null)
          }}
        >
          Reset CT
        </button>
      </div>
    </section>
  )
}
function CtCanvas({
  image,
  frame,
  onPan,
  onSlice,
}: {
  image: CtSliceImage
  frame: OpticalFrame
  onPan: (x: number, y: number) => void
  onSlice: (mm: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    drag = useRef<[number, number] | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const { plane, rgba } = image
    canvas.width = plane.width
    canvas.height = plane.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), plane.width, plane.height), 0, 0)
    const p = patientToSlicePixel(plane, frame.position)
    ctx.strokeStyle = Math.abs(p.offPlaneMm) < 1 ? '#67e8f9' : '#fbbf24'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p.x, 0)
    ctx.lineTo(p.x, plane.height)
    ctx.moveTo(0, p.y)
    ctx.lineTo(plane.width, p.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(orientationLabel(times(plane.down, -1)), plane.width / 2, 16)
    ctx.fillText(orientationLabel(plane.down), plane.width / 2, plane.height - 6)
    ctx.fillText(orientationLabel(times(plane.right, -1)), 10, plane.height / 2)
    ctx.fillText(orientationLabel(plane.right), plane.width - 10, plane.height / 2)
  }, [image, frame])
  return (
    <canvas
      ref={ref}
      className="block w-full touch-none"
      style={{ aspectRatio: image.plane.widthMm / image.plane.heightMm }}
      onWheel={(e) => {
        onSlice(Math.sign(e.deltaY))
      }}
      onPointerDown={(e) => {
        drag.current = [e.clientX, e.clientY]
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        onPan(
          ((e.clientX - drag.current[0]) * image.plane.widthMm) / e.currentTarget.clientWidth,
          ((e.clientY - drag.current[1]) * image.plane.heightMm) / e.currentTarget.clientHeight,
        )
        drag.current = [e.clientX, e.clientY]
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
    />
  )
}
/** One persistent GPU texture. Plane and pixels come from the same resampling result. */
export function CorrelatedCtPlane({
  image,
  opacity,
}: {
  image: CtSliceImage | undefined
  opacity: number
}) {
  const texture = useMemo(() => {
    const created = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat)
    created.flipY = true
    created.colorSpace = THREE.SRGBColorSpace
    created.minFilter = THREE.LinearFilter
    created.magFilter = THREE.LinearFilter
    return created
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    if (image) updateTexture(texture, image)
  }, [image, texture])
  const matrix = useMemo(() => {
    if (!image) return new THREE.Matrix4()
    const p = image.plane
    return new THREE.Matrix4()
      .makeBasis(
        new THREE.Vector3(...p.right),
        new THREE.Vector3(...p.down).negate(),
        new THREE.Vector3(...p.normal).negate(),
      )
      .setPosition(...p.center)
  }, [image])
  if (!image || opacity < 0.01) return null
  return (
    <mesh matrix={matrix} matrixAutoUpdate={false}>
      <planeGeometry args={[image.plane.widthMm, image.plane.heightMm]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function updateTexture(texture: THREE.DataTexture, image: CtSliceImage) {
  texture.image = {
    data: new Uint8Array(image.rgba.buffer, image.rgba.byteOffset, image.rgba.byteLength),
    width: image.plane.width,
    height: image.plane.height,
  }
  texture.needsUpdate = true
}
