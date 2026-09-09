'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { VolumeDRRRenderer } from '@fluoroview/volume-drr'
import { DEFAULT_FLUORO_SETTINGS } from '@fluoroview/knobology'
import { IMAGING_CONFIG, loadAnatomyVolume, VOLUME_ASSET } from '../lib/anatomy'
import {
  DETECTOR_FIELD,
  DETECTOR_DISTANCE,
  SOURCE_DISTANCE,
  LESION_CENTER,
  LESION_RADIUS,
  projectToDetector,
  toolTipForDepth,
  beamDirection,
  radians,
  type Point3,
} from '../lib/physics'
import styles from '../imaging.module.css'

export function Projection({
  orbit,
  tilt,
  depth,
  field = 100,
  crop = false,
  zoom = 1,
  offset = [0, 0, 0],
  overlay = true,
  crosshair = false,
  registration,
}: {
  orbit: number
  tilt: number
  depth: number
  field?: number
  crop?: boolean
  zoom?: number
  offset?: Point3
  overlay?: boolean
  crosshair?: boolean
  registration?: { current: number; stored: number; showCurrent: boolean; showStored: boolean }
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<VolumeDRRRenderer | null>(null)
  const latest = useRef({ orbit, tilt })
  useEffect(() => {
    latest.current = { orbit, tilt }
  }, [orbit, tilt])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const id = useId().replace(/:/g, '')
  const [ox, oy, oz] = registration ? [0, 0, -registration.current] : offset
  useEffect(() => {
    let cancelled = false
    const config = { ...IMAGING_CONFIG, isocenter_mm: [-ox, -oy, -oz] as Point3 }
    const engine = new VolumeDRRRenderer({
      canvas: canvas.current!,
      config,
      asset: VOLUME_ASSET,
      preserveDrawingBuffer: true,
    })
    const draw = () => {
      engine.render({
        raoLaoDeg: latest.current.orbit,
        cranialCaudalDeg: latest.current.tilt,
        settings: { ...DEFAULT_FLUORO_SETTINGS, noiseEnabled: false },
        lowRes: false,
      })
    }
    let observer: ResizeObserver | undefined
    loadAnatomyVolume()
      .then(async (volume) => {
        if (cancelled) return
        await engine.load(volume)
        if (cancelled) {
          engine.dispose()
          return
        }
        renderer.current = engine
        draw()
        setStatus('ready')
        observer = new ResizeObserver(draw)
        observer.observe(canvas.current!)
      })
      .catch(() => {
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
      observer?.disconnect()
      if (renderer.current === engine) renderer.current = null
      engine.dispose()
    }
  }, [ox, oy, oz])
  useEffect(() => {
    const engine = renderer.current
    if (!engine) return
    engine.render({
      raoLaoDeg: orbit,
      cranialCaudalDeg: tilt,
      settings: { ...DEFAULT_FLUORO_SETTINGS, noiseEnabled: false },
      lowRes: true,
    })
    const timer = window.setTimeout(
      () =>
        engine.render({
          raoLaoDeg: orbit,
          cranialCaudalDeg: tilt,
          settings: { ...DEFAULT_FLUORO_SETTINGS, noiseEnabled: false },
          lowRes: false,
        }),
      110,
    )
    return () => window.clearTimeout(timer)
  }, [orbit, tilt])
  const screen = (point: Point3, translation: Point3 = [ox, oy, oz]) => {
    const p = projectToDetector(point.map((v, i) => v + translation[i]) as Point3, orbit, tilt)
    return [256 + (p[0] / DETECTOR_FIELD) * 512, 256 - (p[1] / DETECTOR_FIELD) * 512]
  }
  const target = screen(LESION_CENTER),
    tipWorld = toolTipForDepth(depth),
    tip = screen(tipWorld, registration ? [0, 0, 0] : undefined)
  const start = screen(
    [tipWorld[0] - 65, tipWorld[1], tipWorld[2]],
    registration ? [0, 0, 0] : undefined,
  )
  const normal = beamDirection(orbit, tilt)
  const radius =
    (((LESION_RADIUS * DETECTOR_DISTANCE) /
      (SOURCE_DISTANCE +
        LESION_CENTER.reduce((sum, v, i) => sum + (v + [ox, oy, oz][i]) * normal[i], 0))) *
      512) /
    DETECTOR_FIELD
  const stored = screen(LESION_CENTER, [0, 0, -(registration?.stored ?? 0)])
  const rightDirection = [
    Math.abs(Math.cos(radians(orbit))) > 0.2 ? (Math.cos(radians(orbit)) > 0 ? 'L' : 'R') : '',
    Math.abs(Math.sin(radians(orbit))) > 0.2 ? (Math.sin(radians(orbit)) > 0 ? 'A' : 'P') : '',
  ]
    .filter(Boolean)
    .join('/')
  const size = (512 * field) / 100
  const left = Math.min(512 - size, Math.max(0, target[0] - size / 2)),
    top = Math.min(512 - size, Math.max(0, target[1] - size / 2))
  return (
    <div
      className={styles.radiograph}
      role="img"
      aria-label={`CT-derived teaching projection at ${orbit} degrees obliquity and ${tilt} degrees tilt. Authored target and tool are overlaid in the same cone geometry.`}
      data-projection-state={status}
    >
      <div className={styles.radiographImage} style={{ transform: `scale(${zoom})` }}>
        <canvas ref={canvas} aria-hidden="true" />
        <svg viewBox="0 0 512 512" aria-hidden="true">
          <defs>
            <radialGradient id={id}>
              <stop offset="0" stopColor="#e9ecdf" stopOpacity=".7" />
              <stop offset=".8" stopColor="#cad0c6" stopOpacity=".35" />
              <stop offset="1" stopColor="#becac4" stopOpacity="0" />
            </radialGradient>
          </defs>
          {overlay && (
            <>
              {(!registration || registration.showCurrent) && (
                <circle cx={target[0]} cy={target[1]} r={radius} fill={`url(#${id})`} />
              )}
              {(!registration || registration.showCurrent) && (
                <circle
                  cx={target[0]}
                  cy={target[1]}
                  r={radius + 5}
                  fill="none"
                  stroke="#eec482"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}
              {registration?.showStored && (
                <circle
                  cx={stored[0]}
                  cy={stored[1]}
                  r={radius + 5}
                  fill="none"
                  stroke="#84e2d2"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
              )}
              <line
                x1={start[0]}
                y1={start[1]}
                x2={tip[0]}
                y2={tip[1]}
                stroke="#f5f7f1"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d={`M${tip[0] - 3},${tip[1] - 3}l6,6m-6,0l6,-6`}
                stroke="#fff"
                strokeWidth="1.25"
              />
            </>
          )}
        </svg>
      </div>
      {crosshair && (
        <svg className={styles.shutterMask} viewBox="0 0 512 512" aria-hidden="true">
          <path
            d="M256 36V476 M36 256H476"
            stroke="#abd2d7"
            strokeOpacity=".5"
            strokeWidth="1"
            strokeDasharray="4 5"
          />
        </svg>
      )}
      {field < 100 && (
        <svg className={styles.shutterMask} viewBox="0 0 512 512" aria-hidden="true">
          <path
            d={`M0,0H512V512H0Z M${left},${top}v${size}h${size}v-${size}Z`}
            fill="#04090d"
            fillRule="evenodd"
          />
          <rect
            x={left}
            y={top}
            width={size}
            height={size}
            fill="none"
            stroke={crop ? '#a6bdc8' : '#e7bc76'}
            strokeWidth="1.5"
            strokeDasharray={crop ? '5 4' : undefined}
          />
        </svg>
      )}
      <div className={styles.imageHeader}>
        <span>CT-derived DRR</span>
        <span>
          {orbit}° / {tilt}°
        </span>
      </div>
      <span
        className={styles.orientationL}
        title="Image-right direction in the teaching coordinate frame"
      >
        {rightDirection}
      </span>
      <div className={styles.imageFooter}>
        {registration
          ? 'Amber: current target · teal: stored contour'
          : 'Existing FluoroView CT · authored target / tool'}
      </div>
      {status === 'loading' && (
        <div className={styles.imageStatus}>Preparing CT-derived projection…</div>
      )}
      {status === 'failed' && (
        <div className={styles.imageStatus}>
          CT rendering unavailable. Use the 3D view and numerical projection result.
        </div>
      )}
    </div>
  )
}
