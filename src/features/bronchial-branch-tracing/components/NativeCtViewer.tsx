'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import type { CtMark, CtTrace } from '../content/ct-types'
import { DISPLAY_PRESETS, type DisplayPreset } from '../geometry/coordinates'
import {
  DISPLAY_TRANSFORM,
  ORIENTATION_LABELS,
  ORIENTATION_NOTES,
  displayToPixel,
  nativeImageUrl,
  pixelToDisplay,
  sliceZ,
} from '../geometry/native-ct'
import styles from './branch-tracing.module.css'

interface Props {
  trace: CtTrace
  marks: (CtMark | null)[]
  active: number
  levelRequest?: number
  onActive?: (index: number) => void
  onMark?: (mark: CtMark) => void
  revealed?: boolean
  showAnchor?: boolean
}
export function NativeCtViewer({
  trace,
  marks,
  active,
  levelRequest = 0,
  onActive,
  onMark,
  revealed = false,
  showAnchor = false,
}: Props) {
  const [sliceState, setSliceState] = useState({
    active,
    levelRequest,
    slice: revealed ? trace.checkpoints[active].slice : trace.anchor.slice,
  })
  const slice =
    sliceState.active === active && sliceState.levelRequest === levelRequest
      ? sliceState.slice
      : trace.checkpoints[active].slice
  const setSlice = useCallback(
    (update: SetStateAction<number>) =>
      setSliceState((previous) => {
        const current =
          previous.active === active && previous.levelRequest === levelRequest
            ? previous.slice
            : trace.checkpoints[active].slice
        return {
          active,
          levelRequest,
          slice: typeof update === 'function' ? update(current) : update,
        }
      }),
    [active, levelRequest, trace],
  )
  const [preset, setPreset] = useState<DisplayPreset>(trace.preset)
  const [full, setFull] = useState(false)
  const [magnification, setMagnification] = useState(1)
  const [cursor, setCursor] = useState<[number, number]>([50, 50])
  const [imageStatus, setImageStatus] = useState<{ url: string; failed: boolean } | null>(null)
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [expandError, setExpandError] = useState(false)
  const viewer = useRef<HTMLElement>(null)
  useEffect(() => {
    const changed = () => setExpanded(document.fullscreenElement === viewer.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  async function toggleExpanded() {
    try {
      setExpandError(false)
      if (document.fullscreenElement === viewer.current) await document.exitFullscreen()
      else await viewer.current?.requestFullscreen()
    } catch {
      setExpandError(true)
    }
  }
  const surface = useRef<HTMLDivElement>(null)
  const url = nativeImageUrl(slice)
  const ready = imageStatus?.url === url && !imageStatus.failed
  const failed = imageStatus?.url === url && imageStatus.failed
  const center = full ? [255.5, 255.5] : trace.cropCenter
  const size = (full ? 512 : trace.cropSize) / magnification
  const labels = ORIENTATION_LABELS[preset]
  const checkpoint = trace.checkpoints[active]
  const atCheckpoint = slice === checkpoint.slice
  const canMark = Boolean(onMark) && ready && atCheckpoint
  const clampSlice = (value: number) => Math.max(trace.range[0], Math.min(trace.range[1], value))
  useEffect(() => {
    const target = surface.current
    if (!target) return
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      event.preventDefault()
      setSlice((current) =>
        Math.max(trace.range[0], Math.min(trace.range[1], current + (event.deltaY > 0 ? -1 : 1))),
      )
    }
    target.addEventListener('wheel', wheel, { passive: false })
    return () => target.removeEventListener('wheel', wheel)
  }, [setSlice, trace.range])
  useEffect(() => {
    // Preload only the nearest planes. The full native stack is never eagerly downloaded.
    const neighbors = [slice - 1, slice + 1]
      .filter((k) => k >= trace.range[0] && k <= trace.range[1])
      .map((k) => {
        const img = new Image()
        img.src = nativeImageUrl(k)
        return img
      })
    return () => {
      neighbors.forEach((img) => {
        img.onload = null
      })
    }
  }, [slice, trace.range])
  function place(point: [number, number]) {
    if (!canMark) return
    const pixel = displayToPixel(point, center, size, preset)
    if (pixel.every((value) => value >= 0 && value <= 511)) onMark?.({ slice, pixel })
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
      const increment = event.shiftKey ? 5 : 1
      setCursor(([x, y]) => [
        Math.max(1, Math.min(99, x + dx * increment)),
        Math.max(1, Math.min(99, y + dy * increment)),
      ])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      place(cursor)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      setSlice((k) => clampSlice(k + (event.key === 'PageUp' ? 1 : -1)))
    }
  }
  function selectLevel(index: number) {
    setSlice(trace.checkpoints[index].slice)
    onActive?.(index)
  }
  return (
    <section ref={viewer} className={styles.nativeViewer} aria-label="CT tracing viewer">
      <div className={styles.nativeHeading}>
        <div>
          <h2>CT tracing stack</h2>
          <span>{trace.region} · 0.5 mm slices</span>
        </div>
        <button className={styles.ctExpand} onClick={toggleExpanded}>
          {expanded ? 'Close expanded CT' : 'Expand CT'}
        </button>
      </div>
      <div className={styles.ctViewButtons} role="group" aria-label="CT orientation">
        <button aria-pressed={preset === trace.preset} onClick={() => setPreset(trace.preset)}>
          Book tracing view
        </button>
        <button aria-pressed={preset === 'standard'} onClick={() => setPreset('standard')}>
          Standard axial
        </button>
        <button
          aria-pressed={full}
          onClick={() => {
            setFull((v) => !v)
            setMagnification(1)
          }}
        >
          {full ? 'Airway detail' : 'Full CT field'}
        </button>
      </div>
      {expandError && <p role="status">Expanded view is unavailable in this browser.</p>}
      <div className={styles.ctOrientation}>
        <strong>{DISPLAY_PRESETS[preset]}</strong>
        <span>{preset === 'standard' ? 'Viewed from the feet' : trace.region}</span>
      </div>
      <div ref={surface} className={styles.nativeImage} data-preset={preset} data-slice={slice}>
        <svg
          viewBox="0 0 100 100"
          role="group"
          aria-label="CT image. Arrow keys move the cursor; Enter places a mark; Page Up and Page Down change the slice."
          tabIndex={0}
          onKeyDown={key}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const point: [number, number] = [
              ((event.clientX - rect.left) / rect.width) * 100,
              ((event.clientY - rect.top) / rect.height) * 100,
            ]
            setCursor(point)
            place(point)
          }}
        >
          <title>
            {trace.region}, axial CT level {slice}, {DISPLAY_PRESETS[preset]}
          </title>
          <rect width="100" height="100" fill="#020507" />
          <g
            transform={`translate(50 50) ${DISPLAY_TRANSFORM[preset]} scale(${100 / size}) translate(${-center[0]} ${-center[1]})`}
          >
            <image
              key={`${url}-${retry}`}
              href={url}
              x={-0.5}
              y={-0.5}
              width="512"
              height="512"
              onLoad={() => setImageStatus({ url, failed: false })}
              onError={() => setImageStatus({ url, failed: true })}
            />
          </g>
          {ready &&
            showAnchor &&
            slice === trace.anchor.slice &&
            (() => {
              const p = pixelToDisplay(trace.anchor.pixel, center, size, preset)
              return (
                <g aria-label="Starting airway">
                  <circle cx={p[0]} cy={p[1]} r="3" fill="none" stroke="#f1ca79" strokeWidth=".5" />
                  <text x={p[0] + 4} y={p[1]} fill="#ffe1a6" fontSize="3">
                    Start
                  </text>
                </g>
              )
            })()}
          {ready &&
            marks.map((mark, i) => {
              if (!mark?.pixel || mark.slice !== slice) return null
              const p = pixelToDisplay(mark.pixel, center, size, preset)
              return (
                <g key={i} aria-label={`Your mark ${i + 1}`}>
                  <circle
                    cx={p[0]}
                    cy={p[1]}
                    r="2.3"
                    fill="none"
                    stroke="#81f1ed"
                    strokeWidth=".65"
                  />
                  <text
                    x={p[0] + 3}
                    y={p[1] - 2}
                    fill="#a8fffa"
                    stroke="#07151b"
                    strokeWidth=".5"
                    paintOrder="stroke"
                    fontSize="3.2"
                  >
                    {i + 1}
                  </text>
                </g>
              )
            })}
          {ready &&
            revealed &&
            trace.checkpoints.map((point, i) => {
              if (point.slice !== slice) return null
              const p = pixelToDisplay(point.pixel, center, size, preset)
              return (
                <g key={point.id} data-ct-reference={i + 1}>
                  <path
                    d={`M${p[0] - 2},${p[1]}h4 M${p[0]},${p[1] - 2}v4`}
                    stroke="#f6c66c"
                    strokeWidth=".6"
                  />
                  <text
                    x={p[0] + 3}
                    y={p[1] + 4}
                    fill="#ffe0a1"
                    stroke="#07151b"
                    strokeWidth=".5"
                    paintOrder="stroke"
                    fontSize="3"
                  >
                    Reference {i + 1}
                  </text>
                </g>
              )
            })}
          {canMark && (
            <g className={styles.ctCursor} aria-hidden="true">
              <path
                d={`M${cursor[0] - 1.6},${cursor[1]}h3.2 M${cursor[0]},${cursor[1] - 1.6}v3.2`}
                stroke="white"
                strokeWidth=".35"
              />
            </g>
          )}
        </svg>
        <span className={styles.nativeTop}>{labels.top}</span>
        <span className={styles.nativeRight}>{labels.right}</span>
        <span className={styles.nativeBottom}>{labels.bottom}</span>
        <span className={styles.nativeLeft}>{labels.left}</span>
        {!ready && (
          <div className={styles.ctLoad} role={failed ? 'alert' : 'status'}>
            {failed ? (
              <>
                This CT slice could not load.{' '}
                <button
                  onClick={() => {
                    setImageStatus(null)
                    setRetry((v) => v + 1)
                  }}
                >
                  Retry slice
                </button>
              </>
            ) : (
              'Loading CT slice…'
            )}
          </div>
        )}
      </div>
      <div className={styles.nativeSliceControls}>
        <button
          aria-label="More caudal CT slice"
          onClick={() => setSlice((k) => clampSlice(k - 1))}
          disabled={slice === trace.range[0]}
        >
          −
        </button>
        <label>
          <span>
            Caudal ← <strong>Level {slice}</strong> → Cranial
          </span>
          <input
            aria-label="CT slice"
            type="range"
            min={trace.range[0]}
            max={trace.range[1]}
            step="1"
            value={slice}
            onChange={(e) => setSlice(Number(e.target.value))}
          />
        </label>
        <button
          aria-label="More cranial CT slice"
          onClick={() => setSlice((k) => clampSlice(k + 1))}
          disabled={slice === trace.range[1]}
        >
          +
        </button>
      </div>
      <div className={styles.ctLevels} role="group" aria-label="Trace levels">
        <button onClick={() => setSlice(trace.anchor.slice)}>
          <strong>Start</strong>
          <span>Parent airway</span>
        </button>
        {trace.checkpoints.map((point, i) => (
          <button
            key={point.id}
            aria-pressed={active === i && atCheckpoint}
            onClick={() => selectLevel(i)}
          >
            <strong>{i + 1}</strong>
            <span>Level {point.slice}</span>
            {marks[i] && <span aria-label="recorded">✓</span>}
          </button>
        ))}
      </div>
      {onMark && (
        <p className={styles.ctInstruction}>
          {!atCheckpoint ? (
            <button onClick={() => setSlice(checkpoint.slice)}>
              Return to trace level {checkpoint.slice} to place mark {active + 1}
            </button>
          ) : (
            <>
              Click the continuing lumen to place <strong>mark {active + 1}</strong>.{' '}
              <button disabled={!ready} onClick={() => onMark({ slice, pixel: null })}>
                Lumen unresolved at this level
              </button>
            </>
          )}
        </p>
      )}
      {revealed && (
        <p className={styles.ctLegend}>
          <span>○ Your trace</span>
          <span>＋ Source-derived comparison</span>
        </p>
      )}
      <details className={styles.options}>
        <summary>Orientation, zoom and keyboard controls</summary>
        <p>{ORIENTATION_NOTES[preset]}</p>
        <label>
          Image magnification{' '}
          <input
            aria-label="CT magnification"
            type="range"
            min="1"
            max="2.5"
            step=".1"
            value={magnification}
            onChange={(e) => setMagnification(Number(e.target.value))}
          />
        </label>
        <button
          onClick={() => {
            setSlice(trace.anchor.slice)
            setFull(false)
            setMagnification(1)
          }}
        >
          Show starting airway
        </button>
        <p>
          Focus the image. Arrow keys move the cursor; Shift moves faster; Enter places a mark. Page
          Up/Down or the mouse wheel scrolls the CT. Patient z: {sliceZ(slice).toFixed(1)} mm.
        </p>
        <p>
          Native 512×512 axial acquisition planes; 0.69×0.69 mm in-plane spacing. Fixed lung window
          −1000 to 400 HU. Display rotation does not alter patient coordinates.
        </p>
      </details>
    </section>
  )
}
