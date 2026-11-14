'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import manifest from '../../../../public/branch-tracing/mpr-v1/manifest.json'
import { planeLabels } from '../geometry/orientation'
import { useCtFrame } from './useCtFrame'
import styles from './reference-ct.module.css'

/**
 * A coronal or sagittal reconstruction beside the axial CT (public/branch-tracing/mpr-v1, built by
 * scripts/branch-tracing/build-reference-planes.mjs).
 *
 * It holds no task and never grades. The bench says which plane is shown, which axial slice it is
 * on and what to follow; this component draws that plane with true proportions, a line at the
 * axial level, the followed point and the lesion, and reports a click as the native voxel under
 * it ({ slice, pixel }, the same shape the axial viewer uses), so the bench can move the axial CT
 * there.
 *
 * Planes are one voxel per pixel: rows are slices with superior at the top, columns are i
 * (coronal, patient right at screen-left) or j (sagittal, anterior at screen-left). Rows are drawn
 * DISPLAY_ASPECT (slice spacing / pixel spacing) tall.
 */
export type ReferencePlane = 'coronal' | 'sagittal'
export interface ReferencePick {
  slice: number
  pixel: [number, number]
}

export const MPR_BASE = '/branch-tracing/mpr-v1'
const ASPECT = manifest.spacingXyzMm[2] / manifest.spacingXyzMm[0]
const K_BOTTOM = manifest.crop.k[0]
const K_TOP = manifest.crop.k[1]
const HEIGHT = (K_TOP - K_BOTTOM + 1) * ASPECT
/** The shipped axial slices every reference plane spans. */
export const REFERENCE_SLICE_RANGE = [K_BOTTOM, K_TOP] as const
/** Per plane: which native index it is fixed at (range) and which axis runs across it. */
export const REFERENCE_PLANES = {
  coronal: {
    range: [manifest.coronal.planes[0], manifest.coronal.planes[1]],
    columns: [manifest.crop.i[0], manifest.crop.i[1]],
  },
  sagittal: {
    range: [manifest.sagittal.planes[0], manifest.sagittal.planes[1]],
    columns: [manifest.crop.j[0], manifest.crop.j[1]],
  },
} as const satisfies Record<
  ReferencePlane,
  { range: readonly [number, number]; columns: readonly [number, number] }
>

const PRELOAD_RADIUS = 3
const LETTER_SIZE = 9
const STEP_TEXT: Record<ReferencePlane, { down: [string, string]; up: [string, string] }> = {
  coronal: {
    down: ['− Ant', 'One plane toward the front'],
    up: ['Post +', 'One plane toward the back'],
  },
  sagittal: {
    down: ['− Right', "One plane toward the patient's right"],
    up: ['Left +', "One plane toward the patient's left"],
  },
}
const PLANE_NAME: Record<ReferencePlane, string> = { coronal: 'Coronal', sagittal: 'Sagittal' }

const clampTo = (range: readonly [number, number], value: number) =>
  Math.max(range[0], Math.min(range[1], Math.round(value)))
const width = (plane: ReferencePlane) =>
  REFERENCE_PLANES[plane].columns[1] - REFERENCE_PLANES[plane].columns[0] + 1

export const referencePlaneUrl = (plane: ReferencePlane, index: number) =>
  `${MPR_BASE}/${plane}/${String(index).padStart(3, '0')}.png`

/** The plane through a native pixel: its row j for coronal, its column i for sagittal. */
export function referenceIndexFor(plane: ReferencePlane, pixel: readonly number[]) {
  return clampTo(REFERENCE_PLANES[plane].range, plane === 'coronal' ? pixel[1] : pixel[0])
}
/** Native slice and pixel to picture units (the SVG viewBox): pixel centres at +0.5. */
export function referencePoint(
  plane: ReferencePlane,
  slice: number,
  pixel: readonly number[],
): [number, number] {
  const column = plane === 'coronal' ? pixel[0] : pixel[1]
  return [column - REFERENCE_PLANES[plane].columns[0] + 0.5, (K_TOP - slice + 0.5) * ASPECT]
}
/** Picture units on plane `index` back to the native voxel, as an axial slice and pixel. */
export function referencePick(
  plane: ReferencePlane,
  index: number,
  [x, y]: readonly number[],
): ReferencePick {
  const column = x + REFERENCE_PLANES[plane].columns[0] - 0.5
  const slice = clampTo(REFERENCE_SLICE_RANGE, K_TOP + 0.5 - y / ASPECT)
  return { slice, pixel: plane === 'coronal' ? [column, index] : [index, column] }
}

type Patch = (typeof manifest.patches)[number]
const PATCHES = new Map<string, Patch>(manifest.patches.map((patch) => [patch.id, patch]))

export interface ReferenceCtViewProps {
  plane: ReferencePlane
  /** The plane shown: row j for coronal, column i for sagittal. Clamped to what ships. */
  index: number
  onIndexChange: (index: number) => void
  /** The axial slice the bench is on, drawn as a line across the plane. */
  axialSlice: number
  /** The point the plane follows: the scope tip, a fork or the lesion. */
  focus?: { slice: number; pixel: readonly [number, number] }
  /** Names the followed point on the Follow control, e.g. "scope tip". */
  focusLabel?: string
  /** Draws this lesion's patch where the plane crosses it. */
  target?: { id: string }
  /** A click or Enter on the picture: the native voxel under it. */
  onPick?: (pick: ReferencePick) => void
  /** The mouse wheel steps planes over the picture (a fixed workspace that does not scroll). */
  wheelPlanes?: boolean
}

/** Remounts per plane, so a coronal picture is never drawn with sagittal geometry. */
export function ReferenceCtView(props: ReferenceCtViewProps) {
  return <PlaneView key={props.plane} {...props} />
}

function PlaneView({
  plane,
  index: requested,
  onIndexChange,
  axialSlice,
  focus,
  focusLabel,
  target,
  onPick,
  wheelPlanes = false,
}: ReferenceCtViewProps) {
  const range = REFERENCE_PLANES[plane].range
  const columns = REFERENCE_PLANES[plane].columns
  const W = width(plane)
  const index = clampTo(range, requested)
  const [retry, setRetry] = useState(0)
  const [following, setFollowing] = useState(true)
  const [cursor, setCursor] = useState<[number, number]>([W / 2, HEIGHT / 2])
  const surface = useRef<HTMLDivElement>(null)

  const patch = target ? PATCHES.get(target.id) : undefined
  const sprite = patch?.[plane]
  const spriteUrl = sprite ? `${MPR_BASE}/${sprite.path}` : null
  const crossesPatch = (at: number) =>
    Boolean(sprite && at >= sprite.planes[0] && at <= sprite.planes[1])
  const url = referencePlaneUrl(plane, index)
  const patchUrl = crossesPatch(index) ? spriteUrl : null
  const request = useMemo(() => ({ slice: index, url, patchUrl }), [index, url, patchUrl])
  const { shown, ready, failed, pending, report } = useCtFrame(request, retry)
  // Everything drawn on the picture reads the plane whose pixels are on screen.
  const shownIndex = shown?.slice ?? index

  const move = (next: number) => {
    setFollowing(false)
    const clamped = clampTo(range, next)
    if (clamped !== index) onIndexChange(clamped)
  }
  const latest = useRef({ index, onIndexChange, move })
  useEffect(() => {
    latest.current = { index, onIndexChange, move }
  })
  // Follow: the plane goes to the focus point whenever it moves, until the learner moves the plane.
  const focusIndex = focus ? referenceIndexFor(plane, focus.pixel) : null
  useEffect(() => {
    if (following && focusIndex !== null && focusIndex !== latest.current.index)
      latest.current.onIndexChange(focusIndex)
  }, [following, focusIndex])

  useEffect(() => {
    // Keep the planes around this one decoded so stepping never blanks the picture.
    const neighbours: HTMLImageElement[] = []
    for (let offset = -PRELOAD_RADIUS; offset <= PRELOAD_RADIUS; offset++) {
      const at = index + offset
      if (offset === 0 || at < range[0] || at > range[1]) continue
      const img = new Image()
      img.src = referencePlaneUrl(plane, at)
      neighbours.push(img)
    }
    return () => neighbours.forEach((img) => (img.onload = null))
  }, [plane, index, range])

  useEffect(() => {
    const element = surface.current
    if (!element || !wheelPlanes) return
    const wheel = (event: WheelEvent) => {
      // A browser zoom gesture is never intercepted.
      if (event.ctrlKey || event.metaKey) return
      event.preventDefault()
      latest.current.move(latest.current.index + (event.deltaY > 0 ? -1 : 1))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [wheelPlanes])

  function pick(point: [number, number]) {
    if (!onPick) return
    if (point[0] < 0 || point[0] > W || point[1] < 0 || point[1] > HEIGHT) return
    onPick(referencePick(plane, shownIndex, point))
  }
  function key(event: KeyboardEvent) {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    if (steps[event.key]) {
      event.preventDefault()
      const size = event.shiftKey ? 5 : 1
      setCursor(([x, y]) => [
        Math.max(0, Math.min(W, x + steps[event.key][0] * size)),
        Math.max(0, Math.min(HEIGHT, y + steps[event.key][1] * size * ASPECT)),
      ])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(cursor)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      move(index + (event.key === 'PageUp' ? 1 : -1))
    }
  }

  const labels = planeLabels(plane)
  const axialY = (K_TOP - axialSlice + 0.5) * ASPECT
  const showAxial = axialSlice >= K_BOTTOM && axialSlice <= K_TOP
  const focusPoint = focus ? referencePoint(plane, focus.slice, focus.pixel) : null
  const focusOffPlane =
    focus && Math.abs((plane === 'coronal' ? focus.pixel[1] : focus.pixel[0]) - shownIndex) > 2
  const drawPatch = (at: number, href: string, hidden: boolean) => {
    if (!patch || !sprite || !crossesPatch(at)) return null
    const [frameWidth, frameRows] = sprite.frame
    const planes = sprite.planes[1] - sprite.planes[0] + 1
    const start = plane === 'coronal' ? patch.origin[0] : patch.origin[1]
    return (
      <svg
        x={start - columns[0]}
        y={(K_TOP - patch.slices[1]) * ASPECT}
        width={frameWidth}
        height={frameRows * ASPECT}
        viewBox={`0 ${(at - sprite.planes[0]) * frameRows} ${frameWidth} ${frameRows}`}
        preserveAspectRatio="none"
        overflow="hidden"
        visibility={hidden ? 'hidden' : undefined}
        aria-hidden={hidden || undefined}
        data-ref-lesion={hidden ? undefined : patch.id}
      >
        <image
          href={href}
          width={frameWidth}
          height={frameRows * planes}
          preserveAspectRatio="none"
          onLoad={() => report(href, 'ok')}
          onError={() => report(href, 'error')}
        />
      </svg>
    )
  }
  const step = STEP_TEXT[plane]
  const name = PLANE_NAME[plane]

  return (
    <div className={styles.pane} data-ref-view data-ref-plane={plane}>
      <div className={styles.toolbar}>
        <span className={styles.title}>{name}</span>
        <button
          type="button"
          aria-pressed={following && Boolean(focus)}
          disabled={!focus}
          onClick={() => setFollowing((value) => !value)}
          aria-label={`Follow the ${focusLabel ?? 'marked point'}`}
          data-ref-follow={following && focus ? 'on' : 'off'}
        >
          Follow
        </button>
      </div>
      <div
        ref={surface}
        className={styles.slot}
        data-ref-image
        data-ref-index={shownIndex}
        data-ref-requested-index={index}
        data-ref-ready={Boolean(ready)}
      >
        <svg
          viewBox={`0 0 ${W} ${HEIGHT}`}
          role="group"
          aria-label={`${name} reconstruction, plane ${shownIndex}, superior at the top. ${
            onPick
              ? 'Click, or move with the arrow keys and press Enter, to go to that point on the axial CT. '
              : ''
          }Page Up and Page Down change the plane.`}
          tabIndex={0}
          onKeyDown={key}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const scale = Math.min(rect.width / W, rect.height / HEIGHT)
            if (!(scale > 0)) return
            const point: [number, number] = [
              (event.clientX - rect.left - (rect.width - W * scale) / 2) / scale,
              (event.clientY - rect.top - (rect.height - HEIGHT * scale) / 2) / scale,
            ]
            setCursor(point)
            pick(point)
          }}
        >
          <rect width={W} height={HEIGHT} fill="#020507" />
          {shown && (
            <image
              key={`shown-${shown.url}-${retry}`}
              href={shown.url}
              width={W}
              height={HEIGHT}
              preserveAspectRatio="none"
              onLoad={() => report(shown.url, 'ok')}
              onError={() => report(shown.url, 'error')}
            />
          )}
          {shown?.patchUrl && drawPatch(shown.slice, shown.patchUrl, false)}
          {/* The requested plane decodes out of sight, then replaces the one above in one step. */}
          {pending && (
            <image
              key={`pending-${pending.url}-${retry}`}
              href={pending.url}
              width={W}
              height={HEIGHT}
              preserveAspectRatio="none"
              visibility="hidden"
              aria-hidden="true"
              onLoad={() => report(pending.url, 'ok')}
              onError={() => report(pending.url, 'error')}
            />
          )}
          {pending?.patchUrl && drawPatch(pending.slice, pending.patchUrl, true)}
          {showAxial && (
            <g data-ref-axial-line={axialSlice} aria-label={`Axial slice ${axialSlice}`}>
              <line
                x1={0}
                x2={W}
                y1={axialY}
                y2={axialY}
                stroke="#f6c66c"
                strokeWidth=".8"
                strokeDasharray="4 3"
                opacity=".9"
              />
            </g>
          )}
          {focusPoint && (
            <path
              // A crosshair with an open centre, so a small airway or the lesion stays visible.
              d={`M${focusPoint[0] - 11},${focusPoint[1]}h6 M${focusPoint[0] + 5},${focusPoint[1]}h6 M${focusPoint[0]},${focusPoint[1] - 11}v6 M${focusPoint[0]},${focusPoint[1] + 5}v6`}
              stroke="#7fe3ff"
              strokeWidth="1.1"
              fill="none"
              opacity={focusOffPlane ? 0.45 : 1}
              data-ref-focus={focusOffPlane ? 'off-plane' : 'on-plane'}
              aria-label={focusLabel ?? 'Marked point'}
            />
          )}
          {onPick && (
            <path
              className={styles.cursor}
              aria-hidden="true"
              d={`M${cursor[0] - 3},${cursor[1]}h6 M${cursor[0]},${cursor[1] - 3}v6`}
              stroke="white"
              strokeWidth=".7"
            />
          )}
          <g className={styles.letters} aria-hidden="true">
            <text x={W / 2} y={LETTER_SIZE + 2} textAnchor="middle" data-ref-edge="top">
              {labels.top}
            </text>
            <text
              x={W - 4}
              y={HEIGHT / 2}
              textAnchor="end"
              dominantBaseline="middle"
              data-ref-edge="right"
            >
              {labels.right}
            </text>
            <text x={W / 2} y={HEIGHT - 4} textAnchor="middle" data-ref-edge="bottom">
              {labels.bottom}
            </text>
            <text x={4} y={HEIGHT / 2} dominantBaseline="middle" data-ref-edge="left">
              {labels.left}
            </text>
          </g>
        </svg>
        {failed && (
          <div className={styles.load} role="alert">
            {name} plane {index} could not be loaded.{' '}
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              Retry
            </button>
          </div>
        )}
      </div>
      <div className={styles.sliderRow}>
        <button
          type="button"
          aria-label={step.down[1]}
          onClick={() => move(index - 1)}
          disabled={index <= range[0]}
        >
          {step.down[0]}
        </button>
        <input
          aria-label={`${name} plane`}
          type="range"
          min={range[0]}
          max={range[1]}
          step="1"
          value={index}
          onChange={(event) => move(Number(event.target.value))}
        />
        <button
          type="button"
          aria-label={step.up[1]}
          onClick={() => move(index + 1)}
          disabled={index >= range[1]}
        >
          {step.up[0]}
        </button>
        <output className={styles.readout} aria-live="off">
          Plane {shownIndex}
        </output>
      </div>
    </div>
  )
}
