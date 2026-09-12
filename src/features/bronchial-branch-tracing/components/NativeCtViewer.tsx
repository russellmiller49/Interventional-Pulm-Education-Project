'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import type { CtMark, CtTrace } from '../content/ct-types'
import {
  STANDARD_ORIENTATION,
  nativePixel,
  orientedPixel,
  orientationFor,
  orientationLabels,
  orientationName,
  orientationTransform,
  sameOrientation,
  turnCt,
  type CtOrientation,
} from '../geometry/orientation'
import { pairedScope } from '../geometry/paired-scope'
import { nativeImageUrl, sliceZ, targetForTrace, TARGET_CT_BASE } from '../geometry/native-ct'
import styles from './branch-tracing.module.css'
import { resetPaneScroll } from './resetPaneScroll'

const ClinicalAirwayView = dynamic(
  () => import('./ClinicalAirwayView').then((m) => m.ClinicalAirwayView),
  {
    ssr: false,
    loading: () => <p role="status">Loading virtual bronchoscopy…</p>,
  },
)
interface Props {
  trace: CtTrace
  marks: (CtMark | null)[]
  active: number
  levelRequest?: number
  onActive?: (index: number) => void
  onMark?: (mark: CtMark) => void
  revealed?: boolean
  showAnchor?: boolean
  orientation?: CtOrientation
  onOrientation?: (orientation: CtOrientation) => void
  orientationPending?: boolean
  demonstrate?: boolean
  maxActive?: number
  referenceThrough?: number
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
  orientation: controlledOrientation,
  onOrientation,
  orientationPending = false,
  demonstrate = false,
  maxActive = trace.checkpoints.length - 1,
  referenceThrough = -1,
}: Props) {
  const target = targetForTrace(trace)
  const checkpoint = trace.checkpoints[active]
  const stationLabel = checkpoint.decision
    ? `${checkpoint.decision.parent.airway.code} junction`
    : 'Distal nodule approach'
  const stationName = checkpoint.decision?.parent.airway.name ?? checkpoint.airway.name
  const [sliceState, setSliceState] = useState({
    active,
    levelRequest,
    slice: trace.anchor.slice,
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
  const [localOrientation, setLocalOrientation] = useState<CtOrientation>(STANDARD_ORIENTATION)
  const orientation = controlledOrientation ?? localOrientation
  const setOrientation = (value: CtOrientation) => {
    setLocalOrientation(value)
    onOrientation?.(value)
  }
  const preset = sameOrientation(orientation, STANDARD_ORIENTATION)
    ? 'standard'
    : sameOrientation(orientation, orientationFor('mirror'))
      ? 'mirror'
      : sameOrientation(orientation, orientationFor('rul'))
        ? 'rul'
        : sameOrientation(orientation, orientationFor('upper-division'))
          ? 'upper-division'
          : 'custom'
  const [full, setFull] = useState(false)
  const [targetFocus, setTargetFocus] = useState<{ active: number; levelRequest: number } | null>(
    null,
  )
  const focusedOnTarget =
    targetFocus?.active === active && targetFocus?.levelRequest === levelRequest
  const [startFocus, setStartFocus] = useState<{ active: number; levelRequest: number } | null>({
    active,
    levelRequest,
  })
  const focusedOnStart = startFocus?.active === active && startFocus?.levelRequest === levelRequest
  const [showNodule, setShowNodule] = useState(true)
  const [magnification, setMagnification] = useState(1)
  const [cursor, setCursor] = useState<[number, number]>([50, 50])
  const [imageStatus, setImageStatus] = useState<{ url: string; failed: boolean } | null>(null)
  const [patchStatus, setPatchStatus] = useState<{ url: string; failed: boolean } | null>(null)
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [expandError, setExpandError] = useState(false)
  const viewer = useRef<HTMLElement>(null)
  useEffect(() => resetPaneScroll(viewer.current), [active, levelRequest, referenceThrough])
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
  const patch = showNodule ? target.patch.frames.find((frame) => frame.slice === slice) : undefined
  const patchUrl = patch ? `${TARGET_CT_BASE}/${patch.path}` : null
  const patchReady = !patchUrl || (patchStatus?.url === patchUrl && !patchStatus.failed)
  const ready = imageStatus?.url === url && !imageStatus.failed && patchReady
  const patchFailed = patchUrl && patchStatus?.url === patchUrl && patchStatus.failed
  const failed = (imageStatus?.url === url && imageStatus.failed) || patchFailed
  const center = full
    ? [255.5, 255.5]
    : focusedOnTarget
      ? target.pixel
      : focusedOnStart
        ? trace.anchor.pixel
        : (checkpoint.cropCenter ?? trace.cropCenter)
  const size =
    (full
      ? 512
      : focusedOnTarget
        ? 190
        : focusedOnStart
          ? 110
          : (checkpoint.cropSize ?? trace.cropSize)) / magnification
  const labels = orientationLabels(orientation)
  const scope = useMemo(
    () => pairedScope(trace, slice, active, focusedOnStart),
    [trace, slice, active, focusedOnStart],
  )
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
    const pixel = nativePixel(point, center, size, orientation)
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
  function selectCheckpoint(index: number) {
    if (index < 0 || index > maxActive) return
    setTargetFocus(null)
    setStartFocus(null)
    setSlice(trace.checkpoints[index].slice)
    onActive?.(index)
  }
  function showTarget() {
    setStartFocus(null)
    setTargetFocus({ active, levelRequest })
    setFull(false)
    setMagnification(1)
    setShowNodule(true)
    setSlice(target.slice)
  }
  return (
    <section ref={viewer} className={styles.nativeViewer} aria-label="CT tracing viewer">
      <div className={styles.nativeHeading}>
        <div>
          <h2>CT tracing stack</h2>
          <span>{trace.region} · 0.5 mm slices</span>
        </div>
        <button className={styles.ctExpand} onClick={toggleExpanded}>
          {expanded ? 'Close expanded views' : 'Expand both views'}
        </button>
      </div>
      <div className={styles.targetBar}>
        <div>
          <strong>Target · {target.segment.code}</strong>
          <span>{target.segment.name} · simulated nodule</span>
        </div>
        <button onClick={showTarget}>Show target</button>
      </div>
      <div className={styles.ctViewButtons} role="group" aria-label="CT orientation">
        <button onClick={() => setOrientation(turnCt(orientation, 'left'))}>
          ↶ Rotate 90° left
        </button>
        <button onClick={() => setOrientation(turnCt(orientation, 'right'))}>
          ↷ Rotate 90° right
        </button>
        <button onClick={() => setOrientation(turnCt(orientation, 'flip'))}>
          ⇆ Flip left–right
        </button>
        <button onClick={() => setOrientation(STANDARD_ORIENTATION)}>Reset to standard</button>
      </div>
      {expandError && <p role="status">Expanded view is unavailable in this browser.</p>}
      <div className={styles.pairedViews} aria-label="Paired CT and virtual bronchoscopy">
        <div className={styles.pairedColumn}>
          <h3>
            Axial CT <span>{orientationName(orientation)}</span>
          </h3>
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
                {focusedOnTarget
                  ? `Target in ${target.segment.name}`
                  : focusedOnStart
                    ? `Starting airway: ${trace.anchor.airway.name}`
                    : `At ${stationLabel}: ${stationName}`}
                , axial CT slice {slice}, {orientationName(orientation)}
              </title>
              <rect width="100" height="100" fill="#020507" />
              <g
                transform={`translate(50 50) ${orientationTransform(orientation)} scale(${100 / size}) translate(${-center[0]} ${-center[1]})`}
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
                {patchUrl && (
                  <image
                    key={`${patchUrl}-${retry}`}
                    href={patchUrl}
                    x={target.patch.originPixel[0] - 0.5}
                    y={target.patch.originPixel[1] - 0.5}
                    width={target.patch.size[0]}
                    height={target.patch.size[1]}
                    data-ct-nodule={target.id}
                    onLoad={() => setPatchStatus({ url: patchUrl, failed: false })}
                    onError={() => setPatchStatus({ url: patchUrl, failed: true })}
                  />
                )}
              </g>
              {ready &&
                showNodule &&
                slice === target.slice &&
                (() => {
                  const p = orientedPixel(target.pixel, center, size, orientation)
                  return (
                    <g aria-label={`Simulated nodule target in ${target.segment.code}`}>
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r="7"
                        fill="none"
                        stroke="#e6b0ef"
                        strokeWidth=".35"
                        strokeDasharray="1 1"
                      />
                      <text
                        x={p[0]}
                        y={p[1] + 11}
                        textAnchor="middle"
                        fill="#f3c8fa"
                        fontSize="3.6"
                        stroke="#07151b"
                        strokeWidth=".5"
                        paintOrder="stroke"
                      >
                        Target nodule
                      </text>
                    </g>
                  )
                })()}
              {ready &&
                showAnchor &&
                slice === trace.anchor.slice &&
                (() => {
                  const p = orientedPixel(trace.anchor.pixel, center, size, orientation)
                  return (
                    <g aria-label={`Starting airway: ${trace.anchor.airway.name}`}>
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r="3"
                        fill="none"
                        stroke="#f1ca79"
                        strokeWidth=".5"
                      />
                      <text
                        x={p[0] + (p[0] > 60 ? -4 : 4)}
                        y={p[1]}
                        textAnchor={p[0] > 60 ? 'end' : 'start'}
                        fill="#ffe1a6"
                        fontSize="4.3"
                        stroke="#07151b"
                        strokeWidth=".6"
                        paintOrder="stroke"
                      >
                        {trace.anchor.airway.code}
                      </text>
                    </g>
                  )
                })()}
              {ready &&
                marks.map((mark, i) => {
                  if (!mark?.pixel || mark.slice !== slice) return null
                  const p = orientedPixel(mark.pixel, center, size, orientation)
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
                      {i === active && (
                        <text
                          x={p[0] + (p[0] > 60 ? -4 : 4)}
                          y={p[1] - 2}
                          textAnchor={p[0] > 60 ? 'end' : 'start'}
                          fill="#a8fffa"
                          stroke="#07151b"
                          strokeWidth=".5"
                          paintOrder="stroke"
                          fontSize="4.3"
                        >
                          Your mark
                        </text>
                      )}
                    </g>
                  )
                })}
              {ready &&
                trace.checkpoints.map((point, i) => {
                  if (point.slice !== slice || (!revealed && i > referenceThrough)) return null
                  const p = orientedPixel(point.pixel, center, size, orientation)
                  return (
                    <g
                      key={point.id}
                      data-ct-reference={i + 1}
                      aria-label={`Reference: ${point.airway.name}${point.landmark ? `, ${point.landmark.toLowerCase()}` : ''}`}
                    >
                      <path
                        d={`M${p[0] - 2},${p[1]}h4 M${p[0]},${p[1] - 2}v4`}
                        stroke="#f6c66c"
                        strokeWidth=".6"
                      />
                      {i === active && (
                        <text
                          x={p[0] + (p[0] > 60 ? -4 : 4)}
                          y={p[1] + 5}
                          textAnchor={p[0] > 60 ? 'end' : 'start'}
                          fill="#ffe0a1"
                          stroke="#07151b"
                          strokeWidth=".5"
                          paintOrder="stroke"
                          fontSize="4.3"
                        >
                          {point.airway.code}
                        </text>
                      )}
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
                    {patchFailed
                      ? 'The simulated nodule could not load.'
                      : 'This CT slice could not load.'}{' '}
                    <button
                      onClick={() => {
                        setImageStatus(null)
                        setPatchStatus(null)
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
          <p className={styles.pairCaption}>
            Slice {slice} · patient directions stay attached to the image.
          </p>
        </div>
        <div className={styles.pairedColumn}>
          <h3>
            Virtual bronchoscopy{' '}
            <span>
              {focusedOnStart
                ? `Looking distally from ${trace.anchor.airway.code}`
                : atCheckpoint
                  ? `Parent view · ${stationLabel}`
                  : 'Following the same target route'}
            </span>
          </h3>
          <ClinicalAirwayView
            paired
            position={scope.position}
            direction={scope.direction}
            referenceUp={scope.up}
            roll={0}
            slice={slice}
          />
          <p className={styles.pairCaption}>
            {scope.atJunction
              ? 'Looking from the parent toward this fork. CT shows the daughter level; browse back to the division.'
              : scope.planeGapMm < 0.26
                ? 'Scope just proximal to this CT level.'
                : `CT plane is ${scope.planeGapMm.toFixed(1)} mm from the nearest route point; scope remains on the airway.`}
            {scope.atDistalLimit &&
              ' Near the distal model limit: a closed surface is not evidence of airway obstruction.'}
          </p>
        </div>
      </div>
      <div className={styles.ctViewButtons}>
        {(demonstrate || revealed) && (
          <button onClick={() => setOrientation(orientationFor(trace.preset))}>
            Show book convention
          </button>
        )}
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
      {orientationPending && (
        <p className={styles.orientationPrompt}>
          Turn or reflect the CT, then check your orientation in Steps before marking the lumen.
        </p>
      )}
      <p className={styles.pairExplanation}>
        Compare the branch relationships. An axial cross-section and a view down the lumen have
        different shapes; rotating the CT does not create an endoscopic projection.
      </p>
      <div className={styles.ctActiveAirway} aria-live="polite">
        <strong>
          {focusedOnTarget
            ? `Target region · ${target.segment.code}`
            : focusedOnStart
              ? `Starting airway · ${trace.anchor.airway.code}`
              : `${active + 1} of ${trace.checkpoints.length} · ${stationLabel}`}
        </strong>
        <span>
          {focusedOnTarget
            ? target.segment.name
            : focusedOnStart
              ? trace.anchor.airway.name
              : stationName}
        </span>
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
          <span>Caudal ← Browse adjacent CT slices → Cranial</span>
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
      <div className={styles.ctLevels} role="group" aria-label="Airway checkpoints">
        <button
          onClick={() => {
            setTargetFocus(null)
            setStartFocus({ active, levelRequest })
            setSlice(trace.anchor.slice)
          }}
          aria-label={`Start: ${trace.anchor.airway.name}`}
        >
          <strong>Start</strong>
          <span>{trace.anchor.airway.code}</span>
        </button>
        <button disabled={active === 0} onClick={() => selectCheckpoint(active - 1)}>
          <strong>Previous</strong>
          <span>Review junction</span>
        </button>
        <button
          aria-pressed={atCheckpoint && !focusedOnStart}
          onClick={() => selectCheckpoint(active)}
          aria-label="Current junction CT"
        >
          <strong>
            {checkpoint.decision ? checkpoint.decision.parent.airway.code : 'Approach'}
          </strong>
          <span>Marking slice</span>
        </button>
        <button
          disabled={active >= maxActive}
          onClick={() => selectCheckpoint(active + 1)}
          aria-label="View next junction"
        >
          <strong>Next</strong>
          <span>
            {active === trace.checkpoints.length - 1
              ? 'End of route'
              : active >= maxActive
                ? 'Record this junction first'
                : 'View junction'}
          </span>
        </button>
      </div>
      {checkpoint.decision && (
        <p className={styles.ctInstruction}>
          <button
            onClick={() => {
              setTargetFocus(null)
              setStartFocus(null)
              setSlice(checkpoint.decision!.parent.slice)
            }}
          >
            View parent CT before this fork
          </button>{' '}
          Follow its walls to the marking slice using adjacent CT slices.
        </p>
      )}
      {onMark && (
        <p className={styles.ctInstruction}>
          {!atCheckpoint ? (
            <button onClick={() => selectCheckpoint(active)}>
              Return to current junction to mark the lumen
            </button>
          ) : (
            <>
              Mark the daughter lumen you chose
              {checkpoint.decision ? ' in Steps' : ' toward the nodule'}.{' '}
              <button disabled={!ready} onClick={() => onMark({ slice, pixel: null })}>
                Lumen unresolved here
              </button>
            </>
          )}
        </p>
      )}
      {checkpoint.visibilityNote && (
        <p className={styles.ctInstruction}>{checkpoint.visibilityNote}</p>
      )}
      {revealed && (
        <p className={styles.ctLegend}>
          <span>○ Your trace</span>
          <span>＋ Source-derived comparison</span>
        </p>
      )}
      <details className={styles.options}>
        <summary>Image details, orientation and controls</summary>
        <p>
          Standard axial is viewed from the feet: patient right is screen-left. Rotation and
          reflection change only the display. Patient-space marks stay fixed. The scope follows the
          selected route at the CT plane. At a junction it looks from the parent toward the fork;
          while browsing it stays approximately 4 mm proximal to the selected level. Its reference
          orientation is fixed for each region; rotating the CT does not roll the camera. CT-derived
          surface, not recorded bronchoscopy or a scored camera checkpoint.
        </p>
        <button aria-pressed={!showNodule} onClick={() => setShowNodule((value) => !value)}>
          {showNodule ? 'View original CT without nodule' : 'Restore simulated nodule'}
        </button>
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
            setTargetFocus(null)
            setStartFocus({ active, levelRequest })
            setFull(false)
            setMagnification(1)
          }}
        >
          Show starting airway
        </button>
        <p>
          Focus the image. Arrow keys move the cursor; Shift moves faster; Enter places a mark. Page
          Up/Down or the mouse wheel scrolls the CT. Acquisition slice index: {slice}; patient z:{' '}
          {sliceZ(slice).toFixed(1)} mm.
        </p>
        <p>
          Native 512×512 axial acquisition planes; 0.69×0.69 mm in-plane spacing. Fixed lung window
          −1000 to 400 HU. Display rotation does not alter patient coordinates.
        </p>
        <p>
          Simulated nodule added to real CT using the navigation trainer’s intensity overlay. CT
          route planning does not demonstrate instrument reach or tool-in-lesion.
        </p>
      </details>
      {!showNodule && (
        <p className={styles.ctInstruction} role="status">
          Original CT · simulated nodule hidden
        </p>
      )}
    </section>
  )
}
