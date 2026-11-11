'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { CtMark, CtNoduleTarget } from '../content/ct-types'
import { TARGET_CT_BASE, nativeImageUrl } from '../geometry/native-ct'
import {
  nativePixel,
  orientationLabels,
  orientationName,
  orientationTransform,
  orientedPixel,
  type CtOrientation,
  type OrientationOperation,
} from '../geometry/orientation'
import { placeOverlayLabels } from './ctOverlayLabels'
import { useCtFrame } from './useCtFrame'
import styles from './nav-bench.module.css'

/**
 * The axial CT beside the scope: one native slice at a time, turned and flipped by the learner.
 *
 * It holds no task. The bench says which slice a click counts on, what is already marked and what
 * to label; this component draws that on the right plane and reports clicks in native pixels.
 * Turning or flipping changes only the picture: every coordinate reported is patient space.
 */
export interface CtOverlayMark {
  id: string
  slice: number
  pixel: [number, number]
  label: string
  tone: 'ok' | 'miss' | 'shown'
}
export interface CtOverlayLocator {
  id: string
  slice: number
  pixel: [number, number]
  label: string
}
/** Where the learner has followed an airway to: their own pin, checked by nothing. */
export interface CtTrailPin {
  slice: number
  pixel: [number, number]
}
export interface CtSliderTick {
  slice: number
  label: string
  tone: 'opening' | 'lesion' | 'scope'
}

const OVERLAY_FONT = 3.6
const PRELOAD_RADIUS = 3
/** A press that moves less than this is a click; more, and it drags the picture. */
const DRAG_START_PX = 4
/** A trail pin shows, dimmed, this many slices either side of its own. */
const TRAIL_REACH = 3
const crosshair = ([x, y]: [number, number], reach = 3) =>
  `M${x - reach},${y}h${reach - 1} M${x + 1},${y}h${reach - 1} ` +
  `M${x},${y - reach}v${reach - 1} M${x},${y + 1}v${reach - 1}`

export function TracingCtViewer({
  slice,
  range,
  onSlice,
  orientation,
  onTurn,
  center,
  size,
  target,
  showNodule,
  markSlice,
  markLabel,
  onMark,
  marks,
  locators,
  tip,
  ticks,
  wheelSlices,
  onReadyChange,
  trail,
  onTrail,
}: {
  slice: number
  range: readonly [number, number]
  onSlice: (slice: number) => void
  orientation: CtOrientation
  /** Absent while the scope is moving: the CT cannot be turned then. */
  onTurn?: (operation: OrientationOperation) => void
  /** The crop, in native pixels: centre and width of the square field shown. */
  center: readonly [number, number]
  size: number
  target: CtNoduleTarget
  showNodule: boolean
  /** The slice a click places a mark on; absent when nothing is being marked. */
  markSlice?: number
  markLabel?: string
  onMark?: (mark: CtMark) => void
  marks: CtOverlayMark[]
  locators: CtOverlayLocator[]
  /** Where the scope tip is, with the direction it looks projected onto the plane. */
  tip?: { slice: number; pixel: [number, number]; heading: [number, number] } | null
  ticks: CtSliderTick[]
  /** The mouse wheel steps slices over the image (a fixed workspace that does not scroll). */
  wheelSlices: boolean
  onReadyChange?: (ready: boolean) => void
  /** Pins the learner has dropped while following an airway, on any slice. */
  trail?: readonly CtTrailPin[]
  /** A click where nothing is being marked drops a pin there. */
  onTrail?: (pin: CtTrailPin) => void
}) {
  const [retry, setRetry] = useState(0)
  const [cursor, setCursor] = useState<[number, number]>([50, 50])
  const [magnification, setMagnification] = useState(1)
  // The picture can be dragged away from where the bench centred it. The offset is kept in native
  // pixels and belongs to that centre: when the bench moves the field (a new step, a drive), the
  // picture is centred again.
  const centreKey = `${center[0].toFixed(2)}:${center[1].toFixed(2)}:${size}`
  const [panned, setPanned] = useState<{ key: string; pan: [number, number] }>({
    key: '',
    pan: [0, 0],
  })
  const pan = panned.key === centreKey ? panned.pan : ([0, 0] as [number, number])
  const view: [number, number] = [
    Math.max(0, Math.min(511, center[0] + pan[0])),
    Math.max(0, Math.min(511, center[1] + pan[1])),
  ]
  const isPanned = pan[0] !== 0 || pan[1] !== 0
  const drag = useRef<{
    pointer: number
    x: number
    y: number
    pan: [number, number]
    moved: boolean
  } | null>(null)
  const surface = useRef<HTMLDivElement>(null)
  const clamp = (value: number) => Math.max(range[0], Math.min(range[1], Math.round(value)))
  const url = nativeImageUrl(slice)
  const patch = showNodule ? target.patch.frames.find((frame) => frame.slice === slice) : undefined
  const patchUrl = patch ? `${TARGET_CT_BASE}/${patch.path}` : null
  const request = useMemo(() => ({ slice, url, patchUrl }), [slice, url, patchUrl])
  const frame = useCtFrame(request, retry)
  const { shown, ready, failed, pending, report } = frame
  // Every label reads the plane whose pixels are on screen, never the one still loading.
  const shownSlice = shown?.slice ?? slice
  useEffect(() => {
    onReadyChange?.(Boolean(ready))
  }, [ready, onReadyChange])
  useEffect(() => {
    // Keep the planes around the browsed slice decoded so stepping never blanks the image.
    const neighbours: HTMLImageElement[] = []
    for (let offset = -PRELOAD_RADIUS; offset <= PRELOAD_RADIUS; offset++) {
      const k = slice + offset
      if (offset === 0 || k < range[0] || k > range[1]) continue
      const img = new Image()
      img.src = nativeImageUrl(k)
      neighbours.push(img)
    }
    return () => neighbours.forEach((img) => (img.onload = null))
  }, [slice, range])
  const sliceRef = useRef(slice)
  useEffect(() => {
    sliceRef.current = slice
  }, [slice])
  useEffect(() => {
    const element = surface.current
    if (!element || !wheelSlices) return
    const wheel = (event: WheelEvent) => {
      // A browser zoom gesture is never intercepted.
      if (event.ctrlKey || event.metaKey) return
      event.preventDefault()
      const next = Math.max(
        range[0],
        Math.min(range[1], sliceRef.current + (event.deltaY > 0 ? -1 : 1)),
      )
      if (next !== sliceRef.current) onSlice(next)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [wheelSlices, range, onSlice])

  const field = size / magnification
  const project = (pixel: readonly number[]) => orientedPixel(pixel, view, field, orientation)
  const canMark = Boolean(onMark) && ready && markSlice === slice
  const canPin = Boolean(onTrail) && ready && !canMark
  function place(point: [number, number]) {
    if (!canMark) return
    const pixel = nativePixel(point, view, field, orientation)
    if (pixel.every((value) => value >= 0 && value <= 511)) onMark?.({ slice, pixel })
  }
  /** A click where nothing is being marked: the learner's own pin, for following an airway. */
  function pin(point: [number, number]) {
    if (!canPin) return
    const pixel = nativePixel(point, view, field, orientation)
    if (pixel.every((value) => value >= 0 && value <= 511)) onTrail?.({ slice: shownSlice, pixel })
  }
  const viewPoint = (event: PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect()
    return [
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    ]
  }
  function key(event: KeyboardEvent) {
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    if (move[event.key]) {
      event.preventDefault()
      const [dx, dy] = move[event.key]
      const step = event.shiftKey ? 5 : 1
      setCursor(([x, y]) => [
        Math.max(1, Math.min(99, x + dx * step)),
        Math.max(1, Math.min(99, y + dy * step)),
      ])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      place(cursor)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      onSlice(clamp(slice + (event.key === 'PageUp' ? 1 : -1)))
    }
  }

  const labels = orientationLabels(orientation)
  const inField = ([x, y]: [number, number]) => x >= 0 && x <= 100 && y >= 0 && y <= 100
  const drawnMarks = ready
    ? marks
        .filter((mark) => mark.slice === shownSlice)
        .map((mark) => ({ ...mark, point: project(mark.pixel) }))
        .filter((mark) => inField(mark.point))
    : []
  const drawnLocators = ready
    ? locators
        .filter((locator) => locator.slice === shownSlice)
        .map((locator) => ({ ...locator, point: project(locator.pixel) }))
        .filter((locator) => inField(locator.point))
    : []
  const drawnTrail = ready
    ? (trail ?? [])
        .map((entry, index) => ({ ...entry, id: `trail-${index}`, point: project(entry.pixel) }))
        .filter(
          (entry) => Math.abs(entry.slice - shownSlice) <= TRAIL_REACH && inField(entry.point),
        )
    : []
  const placedLabels = placeOverlayLabels(
    [
      ...drawnLocators.map((l) => ({ id: `locator-${l.id}`, point: l.point, text: l.label })),
      ...drawnMarks.map((m) => ({ id: `mark-${m.id}`, point: m.point, text: m.label })),
    ],
    { fontSize: OVERLAY_FONT },
  )
  const tipPoint = tip && ready && Math.abs(tip.slice - shownSlice) <= 2 ? project(tip.pixel) : null
  const tipAhead =
    tip && tipPoint
      ? project([tip.pixel[0] + tip.heading[0] * 14, tip.pixel[1] + tip.heading[1] * 14])
      : null
  const nodulePoint =
    ready && showNodule && shownSlice === target.slice ? project(target.pixel) : null
  const span = Math.max(1, range[1] - range[0])

  return (
    <div className={styles.ctPane} data-ct-viewer>
      <div className={styles.ctToolbar} role="group" aria-label="Turn the CT">
        <button onClick={() => onTurn?.('left')} disabled={!onTurn} data-ct-turn="left">
          Rotate left
        </button>
        <button onClick={() => onTurn?.('right')} disabled={!onTurn} data-ct-turn="right">
          Rotate right
        </button>
        <button onClick={() => onTurn?.('flip')} disabled={!onTurn} data-ct-turn="flip">
          Flip
        </button>
        <button onClick={() => onTurn?.('reset')} disabled={!onTurn} data-ct-turn="reset">
          Standard axial
        </button>
        <label className={styles.ctMagnify}>
          <span>Zoom</span>
          <input
            aria-label="CT magnification"
            type="range"
            min="1"
            max="4"
            step=".25"
            value={magnification}
            onChange={(e) => setMagnification(Number(e.target.value))}
          />
        </label>
        {isPanned && (
          <button onClick={() => setPanned({ key: '', pan: [0, 0] })} data-ct-recentre>
            Recentre
          </button>
        )}
      </div>
      <div className={styles.squareSlot}>
        <div
          ref={surface}
          className={styles.ctSquare}
          data-ct-image
          data-orientation={`${orientation.turns}${orientation.reflected ? 'r' : ''}`}
          data-slice={shownSlice}
          data-requested-slice={slice}
          data-ct-ready={Boolean(ready)}
          data-can-mark={canMark || undefined}
          data-can-pin={canPin || undefined}
          data-ct-panned={isPanned || undefined}
        >
          <svg
            viewBox="0 0 100 100"
            role="group"
            aria-label={`Axial CT, slice ${shownSlice}, ${orientationName(orientation)}. ${
              canMark
                ? `Arrow keys move the cursor and Enter marks ${markLabel ?? 'the lumen'}. `
                : ''
            }Page Up and Page Down change the slice. Drag to move the picture.`}
            tabIndex={0}
            onKeyDown={key}
            onPointerDown={(event) => {
              setCursor(viewPoint(event))
              drag.current = {
                pointer: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                pan,
                moved: false,
              }
              event.currentTarget.setPointerCapture?.(event.pointerId)
            }}
            onPointerMove={(event) => {
              const held = drag.current
              if (!held || held.pointer !== event.pointerId) return
              if (
                !held.moved &&
                Math.hypot(event.clientX - held.x, event.clientY - held.y) < DRAG_START_PX
              )
                return
              held.moved = true
              // The same drag on screen is the same move of the picture however the CT is turned.
              const rect = event.currentTarget.getBoundingClientRect()
              const at = (x: number, y: number): [number, number] => [
                ((x - rect.left) / rect.width) * 100,
                ((y - rect.top) / rect.height) * 100,
              ]
              const from = nativePixel(at(held.x, held.y), center, field, orientation)
              const to = nativePixel(at(event.clientX, event.clientY), center, field, orientation)
              setPanned({
                key: centreKey,
                pan: [held.pan[0] + from[0] - to[0], held.pan[1] + from[1] - to[1]],
              })
            }}
            onPointerUp={(event) => {
              const held = drag.current
              drag.current = null
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              if (!held || held.pointer !== event.pointerId || held.moved) return
              // A press that did not drag is a click: a mark where one is asked for, a pin elsewhere.
              const point = viewPoint(event)
              if (canMark) place(point)
              else pin(point)
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
          >
            <rect width="100" height="100" fill="#020507" />
            <g
              transform={`translate(50 50) ${orientationTransform(orientation)} scale(${100 / field}) translate(${-view[0]} ${-view[1]})`}
            >
              {shown && (
                <image
                  key={`shown-${shown.url}-${retry}`}
                  href={shown.url}
                  x={-0.5}
                  y={-0.5}
                  width="512"
                  height="512"
                  onLoad={() => report(shown.url, 'ok')}
                  onError={() => report(shown.url, 'error')}
                />
              )}
              {shown?.patchUrl && (
                <image
                  key={`shown-${shown.patchUrl}-${retry}`}
                  href={shown.patchUrl}
                  x={target.patch.originPixel[0] - 0.5}
                  y={target.patch.originPixel[1] - 0.5}
                  width={target.patch.size[0]}
                  height={target.patch.size[1]}
                  data-ct-nodule={target.id}
                  onLoad={() => report(shown.patchUrl as string, 'ok')}
                  onError={() => report(shown.patchUrl as string, 'error')}
                />
              )}
              {/* The requested plane decodes out of sight, then replaces the one above in one step. */}
              {pending && (
                <image
                  key={`pending-${pending.url}-${retry}`}
                  href={pending.url}
                  x={-0.5}
                  y={-0.5}
                  width="512"
                  height="512"
                  visibility="hidden"
                  aria-hidden="true"
                  onLoad={() => report(pending.url, 'ok')}
                  onError={() => report(pending.url, 'error')}
                />
              )}
              {pending?.patchUrl && (
                <image
                  key={`pending-${pending.patchUrl}-${retry}`}
                  href={pending.patchUrl}
                  x={target.patch.originPixel[0] - 0.5}
                  y={target.patch.originPixel[1] - 0.5}
                  width={target.patch.size[0]}
                  height={target.patch.size[1]}
                  visibility="hidden"
                  aria-hidden="true"
                  onLoad={() => report(pending.patchUrl!, 'ok')}
                  onError={() => report(pending.patchUrl!, 'error')}
                />
              )}
            </g>
            {nodulePoint && inField(nodulePoint) && (
              <g aria-label="Simulated lesion" data-ct-lesion-ring>
                <circle
                  cx={nodulePoint[0]}
                  cy={nodulePoint[1]}
                  r={Math.max(4, (14 * 100) / field)}
                  fill="none"
                  stroke="#e6b0ef"
                  strokeWidth=".35"
                  strokeDasharray="1 1"
                />
                <text
                  x={nodulePoint[0]}
                  y={nodulePoint[1] + Math.max(4, (14 * 100) / field) + 4}
                  textAnchor="middle"
                  fill="#f3c8fa"
                  fontSize="3.4"
                  stroke="#07151b"
                  strokeWidth=".5"
                  paintOrder="stroke"
                >
                  Lesion
                </text>
              </g>
            )}
            {tipPoint && tipAhead && inField(tipPoint) && (
              <g
                aria-label="Scope tip"
                data-ct-scope-tip
                opacity={tip?.slice === shownSlice ? 1 : 0.45}
              >
                <line
                  x1={tipPoint[0]}
                  y1={tipPoint[1]}
                  x2={tipAhead[0]}
                  y2={tipAhead[1]}
                  stroke="#7fe3ff"
                  strokeWidth=".5"
                />
                <circle cx={tipPoint[0]} cy={tipPoint[1]} r="1.3" fill="#7fe3ff" />
              </g>
            )}
            {drawnTrail.map((entry) => (
              <g
                key={entry.id}
                opacity={entry.slice === shownSlice ? 1 : 0.4}
                data-ct-trail={entry.slice}
                aria-hidden="true"
              >
                <circle
                  cx={entry.point[0]}
                  cy={entry.point[1]}
                  r="1.7"
                  className={styles.ctTrail}
                />
                <circle cx={entry.point[0]} cy={entry.point[1]} r=".45" fill="#9be7c4" />
              </g>
            ))}
            {drawnLocators.map((locator) => (
              <path
                key={locator.id}
                d={crosshair(locator.point)}
                stroke="#f6c66c"
                strokeWidth=".6"
                fill="none"
                data-ct-locator={locator.label}
              />
            ))}
            {drawnMarks.map((mark) => (
              <circle
                key={mark.id}
                cx={mark.point[0]}
                cy={mark.point[1]}
                r="2.3"
                fill="none"
                className={styles.ctMark}
                data-ct-mark={mark.label}
                data-mark-tone={mark.tone}
              />
            ))}
            {placedLabels.map((label) => (
              <g key={label.id} aria-hidden="true">
                <line
                  x1={label.point[0]}
                  y1={label.point[1]}
                  x2={label.leader[0]}
                  y2={label.leader[1]}
                  stroke="#f6c66c"
                  strokeWidth=".25"
                  opacity=".85"
                />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor={label.textAnchor}
                  fontSize={OVERLAY_FONT}
                  fill="#ffe0a1"
                  stroke="#07151b"
                  strokeWidth=".55"
                  paintOrder="stroke"
                >
                  {label.text}
                </text>
              </g>
            ))}
            {canMark && (
              <path
                className={styles.ctCursor}
                aria-hidden="true"
                d={`M${cursor[0] - 1.6},${cursor[1]}h3.2 M${cursor[0]},${cursor[1] - 1.6}v3.2`}
                stroke="white"
                strokeWidth=".35"
              />
            )}
          </svg>
          <span className={styles.edgeTop} data-ct-edge="top">
            {labels.top}
          </span>
          <span className={styles.edgeRight} data-ct-edge="right">
            {labels.right}
          </span>
          <span className={styles.edgeBottom} data-ct-edge="bottom">
            {labels.bottom}
          </span>
          <span className={styles.edgeLeft} data-ct-edge="left">
            {labels.left}
          </span>
          {failed && (
            <div className={styles.ctLoad} role="alert">
              Slice {slice} could not be loaded.{' '}
              <button onClick={() => setRetry((value) => value + 1)}>Retry</button>
            </div>
          )}
        </div>
      </div>
      <div className={styles.sliceRow}>
        <button
          aria-label="One slice toward the feet"
          onClick={() => onSlice(clamp(slice - 1))}
          disabled={slice <= range[0]}
        >
          − Feet
        </button>
        <div className={styles.sliceTrack}>
          <div className={styles.sliceTicks} aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={`${tick.tone}-${tick.label}-${tick.slice}`}
                data-tick-tone={tick.tone}
                data-tick-slice={tick.slice}
                style={{ left: `${((tick.slice - range[0]) / span) * 100}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <input
            aria-label="CT slice"
            type="range"
            min={range[0]}
            max={range[1]}
            step="1"
            value={slice}
            onChange={(e) => onSlice(clamp(Number(e.target.value)))}
          />
        </div>
        <button
          aria-label="One slice toward the head"
          onClick={() => onSlice(clamp(slice + 1))}
          disabled={slice >= range[1]}
        >
          Head +
        </button>
        <output className={styles.sliceReadout} aria-live="off">
          Slice {shownSlice}
        </output>
      </div>
    </div>
  )
}
