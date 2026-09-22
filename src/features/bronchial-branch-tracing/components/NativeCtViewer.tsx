'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import type {
  AnnotationReview,
  CtMark,
  CtTrace,
  CtTeachingFrame,
  CtViewerState,
} from '../content/ct-types'
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
import { ctDisplayCaption, parentCameraCaption } from '../geometry/reference-frames'
import { letterFor } from '../engine/branch-identity'
import type { ScopeAnnotation } from './ClinicalAirwayView'
import { nativeImageUrl, sliceZ, targetForTrace, TARGET_CT_BASE } from '../geometry/native-ct'
import { placeOverlayLabels } from './ctOverlayLabels'
import { useCtFrame } from './useCtFrame'
import styles from './branch-tracing.module.css'
import { resetPaneScroll } from './resetPaneScroll'

const OVERLAY_FONT = 3.4
/** Native planes kept warm around the browsed slice. The full stack is never fetched. */
const PRELOAD_RADIUS = 2

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
  local?: boolean
  orientationControls?: boolean
  highlightRegion?: boolean
  scopeAvailable?: boolean
  answerSlice?: number
  sliceRequest?: { slice: number; serial: number; focusAirway?: boolean }
  teachingFrame?: CtTeachingFrame
  annotationReview?: AnnotationReview
  initialView?: CtViewerState
  onViewChange?: (view: CtViewerState) => void
  onReadyChange?: (ready: boolean) => void
  onDisplayedSliceChange?: (slice: number | null) => void
  onTargetReady?: () => void
  /** Stable names for the learner's marks, so A and B are told apart on the image. */
  markLabels?: string[]
  /** Bumped to restore the authored crop for this division without changing any coordinate. */
  focusRequest?: number
  /** Controls placed with the CT: the demonstration transport belongs beside the image. */
  belowImage?: React.ReactNode
  /** Model centreline crossings on the displayed plane, drawn as dotted crosshairs without text. */
  courseLocators?: { id: string; pixel: [number, number]; ariaLabel: string }[]
  /** Name the daughters' model response points in the paired view when the camera is at the fork. */
  scopeLabels?: boolean
  /** Initial paired-view state when the saved view has none. */
  scopeDefault?: boolean
  /** Bumped by the host to open or close the paired view for a teaching moment. */
  scopeRequest?: { show: boolean; serial: number }
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
  local = false,
  orientationControls = true,
  highlightRegion = false,
  scopeAvailable = true,
  answerSlice,
  sliceRequest,
  teachingFrame,
  annotationReview,
  initialView,
  onViewChange,
  onReadyChange,
  onDisplayedSliceChange,
  onTargetReady,
  markLabels,
  focusRequest = 0,
  belowImage,
  courseLocators = [],
  scopeLabels = false,
  scopeDefault,
  scopeRequest,
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
    slice: initialView?.slice ?? trace.anchor.slice,
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
  // The plane on screen before the current request, used to tell a real
  // navigation from a request for the plane the learner is already looking at.
  const sliceRef = useRef(slice)
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
  const [full, setFull] = useState(initialView?.full ?? false)
  const [targetFocus, setTargetFocus] = useState<{ active: number; levelRequest: number } | null>(
    initialView?.focus === 'target' ? { active, levelRequest } : null,
  )
  const focusedOnTarget =
    targetFocus?.active === active && targetFocus?.levelRequest === levelRequest
  const [startFocus, setStartFocus] = useState<{ active: number; levelRequest: number } | null>(
    !initialView || initialView.focus === 'start' ? { active, levelRequest } : null,
  )
  const focusedOnStart = startFocus?.active === active && startFocus?.levelRequest === levelRequest
  const [showNodule, setShowNodule] = useState(initialView?.showNodule ?? !local)
  const [showScope, setShowScope] = useState(initialView?.showScope ?? scopeDefault ?? !local)
  const firstScopeRequest = useRef(scopeRequest?.serial)
  useEffect(() => {
    if (!scopeRequest || scopeRequest.serial === firstScopeRequest.current) return
    setShowScope(scopeRequest.show)
  }, [scopeRequest])
  const [magnification, setMagnification] = useState(initialView?.magnification ?? 1)
  const [cursor, setCursor] = useState<[number, number]>([50, 50])
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [inPageExpanded, setInPageExpanded] = useState(false)
  const [showOverlays, setShowOverlays] = useState(true)
  const [wheelSlices, setWheelSlices] = useState(false)
  const viewer = useRef<HTMLElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  // A different junction opens its own view. Revealing a reference or checking an
  // answer is not a new plane, so it must not move the pane the learner set.
  useEffect(() => resetPaneScroll(viewer.current), [active, levelRequest])
  useEffect(() => {
    const changed = () => setExpanded(document.fullscreenElement === viewer.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const fullscreenSupported =
    typeof document !== 'undefined' &&
    document.fullscreenEnabled &&
    typeof viewer.current?.requestFullscreen === 'function'
  const closeExpanded = useCallback(() => {
    setInPageExpanded(false)
    if (typeof document !== 'undefined' && document.fullscreenElement === viewer.current)
      void document.exitFullscreen().catch(() => undefined)
    expandButton.current?.focus()
  }, [])
  useEffect(() => {
    if (!inPageExpanded) return
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeExpanded()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [inPageExpanded, closeExpanded])
  async function toggleExpanded() {
    if (expanded || inPageExpanded) {
      closeExpanded()
      return
    }
    // Fullscreen needs a user gesture and may be denied by the embedding policy.
    // An in-page enlargement is the fallback, not an error message.
    if (fullscreenSupported && viewer.current) {
      try {
        await viewer.current.requestFullscreen()
        return
      } catch {
        /* fall through to the in-page enlargement */
      }
    }
    setInPageExpanded(true)
  }
  const surface = useRef<HTMLDivElement>(null)
  const url = nativeImageUrl(slice)
  const patch = showNodule ? target.patch.frames.find((frame) => frame.slice === slice) : undefined
  const patchUrl = patch ? `${TARGET_CT_BASE}/${patch.path}` : null
  const request = useMemo(() => ({ slice, url, patchUrl }), [slice, url, patchUrl])
  const frame = useCtFrame(request, retry)
  const { shown, ready, failed, pending } = frame
  const reportImage = frame.report
  // The plane whose pixels are on screen. Every label, overlay and caption reads
  // this, so a slice number is never printed beside another plane's image.
  const shownSlice = shown?.slice ?? slice
  // Host captions must advance with the decoded image, before either is painted.
  // Requested view state remains separate so rapid stepping and drafts keep their semantics.
  useLayoutEffect(() => {
    onDisplayedSliceChange?.(shown?.slice ?? null)
  }, [shown?.slice, onDisplayedSliceChange])
  useEffect(() => {
    onReadyChange?.(Boolean(ready))
  }, [ready, onReadyChange])
  useEffect(() => {
    if (ready && showNodule && slice === target.slice) onTargetReady?.()
  }, [ready, showNodule, slice, target.slice, onTargetReady])
  const patchFailed = Boolean(patchUrl) && failed && !frame.baseFailed
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
  // Frame 3 is named by the airway the camera looks along, never by the CT display.
  const scopeAirwayCode = focusedOnStart
    ? trace.anchor.airway.code
    : (checkpoint.decision?.parent.airway.code ?? checkpoint.airway.code)
  // Opening labels exist only where stable source-edge identity supports them: at the fork pose,
  // each daughter's own model response point, in the CT letter order.
  const scopeAnnotations = useMemo<ScopeAnnotation[] | undefined>(
    () =>
      scopeLabels && scope.atJunction && checkpoint.decision
        ? checkpoint.decision.options.map((option, i) => ({
            id: `opening-${option.sourceEdgeId}`,
            lps: option.lps,
            text: `${letterFor(i)} · ${option.airway.code}`,
            ariaLabel: `Daughter ${letterFor(i)} · ${option.airway.code}: model response point`,
          }))
        : undefined,
    [scopeLabels, scope.atJunction, checkpoint.decision],
  )
  const project = (pixel: readonly number[]): [number, number] =>
    orientedPixel([pixel[0], pixel[1]], center, size, orientation)
  const annotations: {
    id: string
    kind: 'model' | 'mark'
    point: [number, number]
    reach: number
    ariaLabel: string
    text: string | null
    teaching?: boolean
    referenceIndex?: number
    contour?: [number, number][]
    /** A model centreline crossing on this plane; dotted, unlabelled, never a boundary. */
    course?: boolean
  }[] = []
  if (ready && showOverlays) {
    for (const locator of courseLocators)
      annotations.push({
        id: locator.id,
        kind: 'model',
        point: project(locator.pixel),
        reach: 2.2,
        ariaLabel: locator.ariaLabel,
        text: null,
        teaching: true,
        course: true,
      })
    if (showAnchor && shownSlice === trace.anchor.slice)
      annotations.push({
        id: 'anchor',
        kind: 'model',
        point: project(trace.anchor.pixel),
        reach: 4,
        ariaLabel: `Starting airway: ${trace.anchor.airway.name}`,
        text: trace.anchor.airway.code,
      })
    if (teachingFrame?.slice === shownSlice) {
      const reviewed = annotationReview?.status === 'faculty-reviewed'
      teachingFrame.overlays.forEach((overlay, i) =>
        annotations.push({
          id: `model-${i}`,
          kind: 'model',
          point: project(overlay.pixel),
          reach: 3,
          ariaLabel: `${reviewed ? 'Reviewed annotation' : 'Model locator'}: ${overlay.label}`,
          text: overlay.label,
          teaching: true,
          contour: reviewed && overlay.contour ? overlay.contour.map(project) : undefined,
        }),
      )
    }
    marks.forEach((mark, i) => {
      if (!mark?.pixel || mark.slice !== shownSlice) return
      annotations.push({
        id: `mark-${i}`,
        kind: 'mark',
        point: project(mark.pixel),
        reach: 3,
        ariaLabel: `Your mark ${i + 1}`,
        text: markLabels?.[i] ?? 'Your mark',
      })
    })
    trace.checkpoints.forEach((point, i) => {
      if (point.slice !== shownSlice || (!revealed && i > referenceThrough)) return
      annotations.push({
        id: `reference-${point.id}`,
        kind: 'model',
        point: project(point.pixel),
        reach: 3,
        referenceIndex: i + 1,
        ariaLabel: `Reference: ${point.airway.name}${point.landmark ? `, ${point.landmark.toLowerCase()}` : ''}`,
        text: i === active ? point.airway.code : null,
      })
    })
  }
  const toneById = new Map(annotations.map((a) => [a.id, a.kind]))
  // Only the text moves. Every anchor above stays on its projected native coordinate.
  const placedLabels = placeOverlayLabels(
    annotations
      .filter((a) => a.text)
      .map((a) => ({ id: a.id, point: a.point, text: a.text as string })),
    { fontSize: OVERLAY_FONT },
  ).map((label) => ({ ...label, tone: toneById.get(label.id) ?? 'model' }))
  const crosshair = ([x, y]: [number, number], reach = 3) =>
    `M${x - reach},${y}h${reach - 1} M${x + 1},${y}h${reach - 1} ` +
    `M${x},${y - reach}v${reach - 1} M${x},${y + 1}v${reach - 1}`
  const submissionSlice = answerSlice ?? checkpoint.slice
  const atCheckpoint = slice === submissionSlice
  // Both actions keep their place whatever the response state is: the row's size
  // and the buttons' DOM identity do not change when the response slice is reached,
  // so a second click never lands on a control that moved under the pointer.
  // Shown while a response can be placed, and kept afterwards while responses
  // exist, so checking an answer does not resize the column under the image.
  const answerControls =
    onMark || (local && marks.some(Boolean)) ? (
      <div className={styles.answerGuidance} data-answer-guidance>
        <p role="status">
          {failed
            ? 'Image unavailable. Retry this slice before marking.'
            : !ready
              ? `Loading slice ${slice} before marking.`
              : !onMark
                ? `Reviewing slice ${slice}. Responses stay as you placed them.`
                : atCheckpoint
                  ? `Response slice ${submissionSlice}: mark the lumen, or record uncertainty.`
                  : `Exploring slice ${slice}. Your current task is unchanged; marks are recorded on slice ${submissionSlice}.`}
        </p>
        <div className={styles.answerActions}>
          <button
            onClick={() => {
              setStartFocus(null)
              setTargetFocus(null)
              setSlice(submissionSlice)
            }}
          >
            Go to response slice
          </button>
          {/* Kept in the layout between marking and review so the row, and the CT
              above it, do not move when the learner checks an answer. */}
          <button
            className={onMark ? undefined : styles.reservedControl}
            aria-hidden={onMark ? undefined : true}
            tabIndex={onMark ? undefined : -1}
            disabled={!onMark || !ready || !atCheckpoint}
            onClick={() => onMark?.({ slice, pixel: null })}
          >
            Lumen unresolved here
          </button>
        </div>
      </div>
    ) : null
  useEffect(() => {
    if (!sliceRequest) return
    setSlice(sliceRequest.slice)
    // Asking for the plane already on screen is not a navigation: the learner's
    // crop, magnification and scroll position stay as they left them.
    setStartFocus((current) =>
      sliceRequest.focusAirway
        ? { active, levelRequest }
        : sliceRequest.slice === sliceRef.current
          ? current
          : null,
    )
    if (sliceRequest.focusAirway) {
      setFull(false)
      setMagnification(1)
    }
    setTargetFocus((current) =>
      !sliceRequest.focusAirway && sliceRequest.slice === sliceRef.current ? current : null,
    )
  }, [sliceRequest, setSlice, active, levelRequest])
  useEffect(() => {
    sliceRef.current = slice
  }, [slice])
  // Focus CT view: return to the crop this division was authored with. It changes
  // the display only; no coordinate, region or anatomical claim is created.
  const firstFocusRequest = useRef(focusRequest)
  useEffect(() => {
    if (focusRequest === firstFocusRequest.current) return
    setFull(false)
    setTargetFocus(null)
    setStartFocus(null)
  }, [focusRequest])
  useEffect(() => {
    onViewChange?.({
      slice,
      focus: focusedOnTarget ? 'target' : focusedOnStart ? 'start' : 'junction',
      full,
      magnification,
      showNodule,
      showScope,
    })
  }, [
    slice,
    focusedOnTarget,
    focusedOnStart,
    full,
    magnification,
    showNodule,
    showScope,
    onViewChange,
  ])
  const canMark = Boolean(onMark) && ready && atCheckpoint
  const clampSlice = (value: number) => Math.max(trace.range[0], Math.min(trace.range[1], value))
  useEffect(() => {
    // Off by default: an ordinary wheel or trackpad gesture over the image scrolls
    // the page. Slice stepping on the wheel is an explicit, reversible local mode,
    // and a browser zoom gesture is never intercepted.
    const target = surface.current
    if (!target || !wheelSlices) return
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      event.preventDefault()
      setSlice((current) =>
        Math.max(trace.range[0], Math.min(trace.range[1], current + (event.deltaY > 0 ? -1 : 1))),
      )
    }
    target.addEventListener('wheel', wheel, { passive: false })
    return () => target.removeEventListener('wheel', wheel)
  }, [setSlice, trace.range, wheelSlices])
  useEffect(() => {
    if (!wheelSlices) return
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setWheelSlices(false)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [wheelSlices])
  useEffect(() => {
    // Preload the planes immediately around the browsed slice so stepping does not
    // blank the image. The full native stack is never eagerly downloaded.
    const neighbors: HTMLImageElement[] = []
    for (let offset = -PRELOAD_RADIUS; offset <= PRELOAD_RADIUS; offset++) {
      const k = slice + offset
      if (offset === 0 || k < trace.range[0] || k > trace.range[1]) continue
      const img = new Image()
      img.src = nativeImageUrl(k)
      neighbors.push(img)
    }
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
  const sliceControls = (
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
  )
  // Tools that change only how the native plane is displayed. They keep a fixed
  // place beside the image so the slice controls never move under the pointer.
  const viewTools = (
    <div className={styles.ctViewTools} role="group" aria-label="CT view tools">
      <label className={styles.ctMagnifier}>
        <span>Magnify</span>
        <input
          aria-label="CT magnification"
          type="range"
          min="1"
          max="4"
          step=".1"
          value={magnification}
          onChange={(e) => setMagnification(Number(e.target.value))}
        />
        <output>{magnification.toFixed(1)}×</output>
      </label>
      <button aria-pressed={!showOverlays} onClick={() => setShowOverlays((value) => !value)}>
        {showOverlays ? 'Hide overlays' : 'Show overlays'}
      </button>
      <button aria-pressed={wheelSlices} onClick={() => setWheelSlices((value) => !value)}>
        {wheelSlices ? 'Wheel steps slices: on' : 'Wheel steps slices: off'}
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
      {scopeAvailable && (
        <button aria-pressed={showScope} onClick={() => setShowScope((v) => !v)}>
          {showScope ? 'Hide parent airway view' : 'Show parent airway view'}
        </button>
      )}
    </div>
  )
  const manualOrientationControls = (
    <>
      <button onClick={() => setOrientation(turnCt(orientation, 'left'))}>↶ Rotate 90° left</button>
      <button onClick={() => setOrientation(turnCt(orientation, 'right'))}>
        ↷ Rotate 90° right
      </button>
      <button onClick={() => setOrientation(turnCt(orientation, 'flip'))}>⇆ Flip left–right</button>
    </>
  )
  const targetBar = !local && (
    <div className={styles.targetBar}>
      <div>
        <strong>Target · {target.segment.code}</strong>
        <span>{target.segment.name} · simulated nodule</span>
      </div>
      <button onClick={showTarget}>Show target</button>
    </div>
  )
  const orientationBlock = (orientationControls ||
    !sameOrientation(orientation, STANDARD_ORIENTATION)) && (
    <div className={styles.ctViewButtons} role="group" aria-label="CT orientation">
      {local ? (
        <>
          <button
            aria-pressed={sameOrientation(orientation, STANDARD_ORIENTATION)}
            onClick={() => setOrientation(STANDARD_ORIENTATION)}
          >
            Return to standard axial
          </button>
          <button
            aria-pressed={sameOrientation(orientation, orientationFor(trace.preset))}
            onClick={() => setOrientation(orientationFor(trace.preset))}
          >
            Show tracing view
          </button>
          <details>
            <summary>More orientation controls</summary>
            {manualOrientationControls}
          </details>
        </>
      ) : (
        <>
          {manualOrientationControls}
          <button onClick={() => setOrientation(STANDARD_ORIENTATION)}>
            Return to standard axial
          </button>
        </>
      )}
    </div>
  )
  return (
    <section
      ref={viewer}
      className={`${styles.nativeViewer} ${local ? styles.localViewer : ''} ${
        inPageExpanded ? styles.ctEnlarged : ''
      }`}
      data-ct-enlarged={inPageExpanded || undefined}
      aria-label="CT tracing viewer"
    >
      <div className={styles.nativeHeading}>
        <div>
          <h2>{local ? 'Axial CT' : 'CT tracing stack'}</h2>
          <span>{local ? orientationName(orientation) : `${trace.region} · 0.5 mm slices`}</span>
        </div>
        <button ref={expandButton} className={styles.ctExpand} onClick={toggleExpanded}>
          {expanded || inPageExpanded ? 'Close expanded views' : 'Expand CT views'}
        </button>
      </div>
      <div
        className={`${styles.pairedViews} ${!showScope || !scopeAvailable ? styles.ctOnly : ''}`}
        aria-label="CT and supporting views"
      >
        <div className={styles.pairedColumn}>
          {(!local || (showScope && scopeAvailable)) && (
            <h3>
              Axial CT <span>{orientationName(orientation)}</span>
            </h3>
          )}
          <div
            ref={surface}
            className={styles.nativeImage}
            data-preset={preset}
            data-slice={shownSlice}
            data-requested-slice={slice}
            data-ct-ready={Boolean(ready)}
            data-region-highlight={highlightRegion || undefined}
          >
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
                , axial CT slice {shownSlice}, {orientationName(orientation)}
              </title>
              <rect width="100" height="100" fill="#020507" />
              <g
                transform={`translate(50 50) ${orientationTransform(orientation)} scale(${100 / size}) translate(${-center[0]} ${-center[1]})`}
              >
                {shown && (
                  <image
                    key={`shown-${shown.url}-${retry}`}
                    href={shown.url}
                    x={-0.5}
                    y={-0.5}
                    width="512"
                    height="512"
                    onLoad={() => reportImage(shown.url, 'ok')}
                    onError={() => reportImage(shown.url, 'error')}
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
                    onLoad={() => reportImage(shown.patchUrl as string, 'ok')}
                    onError={() => reportImage(shown.patchUrl as string, 'error')}
                  />
                )}
                {/* The requested plane decodes out of sight, then replaces the one
                    above in a single step. The learner never sees a blank frame,
                    and no label is ever attached to the previous plane's pixels. */}
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
                    data-ct-pending={pending.slice}
                    onLoad={() => reportImage(pending.url, 'ok')}
                    onError={() => reportImage(pending.url, 'error')}
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
                    onLoad={() => reportImage(pending.patchUrl!, 'ok')}
                    onError={() => reportImage(pending.patchUrl!, 'error')}
                  />
                )}
              </g>
              {ready &&
                showOverlays &&
                showNodule &&
                shownSlice === target.slice &&
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
              {annotations.map((annotation) => (
                <g
                  key={annotation.id}
                  role="img"
                  data-teaching-overlay={annotation.teaching || undefined}
                  data-course-locator={annotation.course || undefined}
                  data-ct-reference={annotation.referenceIndex}
                  aria-label={annotation.ariaLabel}
                >
                  {annotation.contour && (
                    <polygon
                      points={annotation.contour.map((point) => point.join(',')).join(' ')}
                      fill="none"
                      stroke="#f6c66c"
                      strokeWidth=".45"
                    />
                  )}
                  {annotation.kind === 'mark' ? (
                    <circle
                      cx={annotation.point[0]}
                      cy={annotation.point[1]}
                      r="2.3"
                      fill="none"
                      stroke="#81f1ed"
                      strokeWidth=".65"
                    />
                  ) : (
                    /* A gapped crosshair, not a ring: the model location is marked
                       without covering the few pixels of lumen underneath it. It is
                       a locator, never a wall or a boundary. */
                    <path
                      d={crosshair(annotation.point, annotation.reach)}
                      stroke={annotation.course ? '#e9c77e' : '#f6c66c'}
                      strokeWidth={annotation.course ? '.5' : '.6'}
                      strokeDasharray={annotation.course ? '.5 .4' : undefined}
                      fill="none"
                    />
                  )}
                </g>
              ))}
              {placedLabels.map((label) => (
                <g key={`label-${label.id}`} aria-hidden="true">
                  <line
                    x1={label.point[0]}
                    y1={label.point[1]}
                    x2={label.leader[0]}
                    y2={label.leader[1]}
                    stroke={label.tone === 'mark' ? '#81f1ed' : '#f6c66c'}
                    strokeWidth=".25"
                    opacity=".85"
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor={label.textAnchor}
                    fontSize={OVERLAY_FONT}
                    fill={label.tone === 'mark' ? '#a8fffa' : '#ffe0a1'}
                    stroke="#07151b"
                    strokeWidth=".55"
                    paintOrder="stroke"
                  >
                    {label.text}
                  </text>
                </g>
              ))}
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
              // While a previous plane is still on screen the notice is a chip, not a
              // cover: the image stays readable and says which plane it is. Only a
              // failure, or having nothing decoded yet, takes the whole frame.
              <div
                className={`${styles.ctLoad} ${shown && !failed ? styles.ctLoadChip : ''}`}
                role={failed ? 'alert' : 'status'}
                data-ct-load={failed ? 'failed' : 'loading'}
              >
                {failed ? (
                  <>
                    {patchFailed
                      ? 'The simulated nodule could not load.'
                      : 'This CT slice could not load.'}{' '}
                    <button onClick={() => setRetry((v) => v + 1)}>Retry slice</button>
                  </>
                ) : shown ? (
                  `Loading slice ${slice}… showing slice ${shown.slice}`
                ) : (
                  'Loading CT slice…'
                )}
              </div>
            )}
          </div>
          <p className={styles.pairCaption}>
            Slice {shownSlice} · patient directions stay attached to the image.
          </p>
        </div>
        {showScope && scopeAvailable && (
          <div
            className={styles.pairedColumn}
            data-paired-scope-column
            data-scope-pose={[scope.position, scope.direction, scope.up]
              .map((v) => v.map((n) => n.toFixed(4)).join(','))
              .join('|')}
          >
            <h3>
              Virtual bronchoscopy{' '}
              <span>
                {focusedOnStart
                  ? `Model parent view · looking distally from ${trace.anchor.airway.code}`
                  : atCheckpoint
                    ? `Model parent view · ${stationLabel}`
                    : 'Model parent view · following the model route'}
              </span>
            </h3>
            <p className={styles.referenceNotice}>
              Camera follows the model reference route, including after a different branch choice.
            </p>
            <ClinicalAirwayView
              paired
              position={scope.position}
              direction={scope.direction}
              referenceUp={scope.up}
              roll={0}
              slice={slice}
              annotations={scopeAnnotations}
            />
            <p className={styles.pairCaption} data-scope-caption>
              {parentCameraCaption(scope, scopeAirwayCode)}{' '}
              {scope.atJunction
                ? 'The CT beside it shows the daughter level; browse back to the division.'
                : scope.planeGapMm < 0.26
                  ? 'Scope just proximal to this CT level.'
                  : `CT plane is ${scope.planeGapMm.toFixed(1)} mm from the nearest route point; scope remains on the airway.`}
              {scope.atDistalLimit &&
                ' Near the distal model limit: a closed surface is not evidence of airway obstruction.'}
            </p>
            <p className={styles.pairCaption} data-display-caption>
              {ctDisplayCaption(orientation)}
            </p>
          </div>
        )}
      </div>
      {/* The slice row keeps one fixed place directly under the image, above the
          guidance whose wording changes. Reaching the response plane never moves it. */}
      <div className={styles.ctControlBand}>
        {sliceControls}
        {belowImage}
        {viewTools}
        {answerControls}
      </div>
      {targetBar}
      {orientationBlock}
      <div className={styles.ctViewButtons}>
        {!local && orientationControls && (demonstrate || revealed) && (
          <button onClick={() => setOrientation(orientationFor(trace.preset))}>
            Show book convention
          </button>
        )}
      </div>
      {orientationPending && (
        <p className={styles.orientationPrompt}>
          Record the display you choose before marking. Standard axial is valid; a display change
          never changes the source coordinates.
        </p>
      )}
      {scopeAvailable && (
        <p className={styles.pairExplanation}>
          Compare the branch relationships. An axial cross-section and a view down the lumen have
          different shapes; rotating the CT does not create an endoscopic projection.
        </p>
      )}
      {!local && (
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
      )}
      {!local && (
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
            <strong>Previous junction</strong>
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
            <strong>Next junction</strong>
            <span>
              {active === trace.checkpoints.length - 1
                ? 'End of route'
                : active >= maxActive
                  ? 'Record this junction first'
                  : 'View junction'}
            </span>
          </button>
        </div>
      )}
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
      {checkpoint.visibilityNote && (
        <p className={styles.ctInstruction}>{checkpoint.visibilityNote}</p>
      )}
      {revealed && (
        <p className={styles.ctLegend}>
          <span>○ ring · your trace</span>
          <span>＋ open crosshair · model reference — not yet faculty reviewed</span>
        </p>
      )}
      {courseLocators.length > 0 && showOverlays && (
        <p className={styles.ctLegend} data-course-legend>
          <span>
            ＋ dotted crosshair · model centreline crossing on this plane (course locator, not a
            lumen boundary)
          </span>
        </p>
      )}
      <details className={styles.options}>
        <summary>Image details, orientation and controls</summary>
        <p>
          Standard axial is viewed from the feet: patient right is screen-left. Rotation and
          reflection change only the display. Patient-space marks stay fixed. The scope follows the
          model reference route at the CT plane. At a junction it looks from the parent toward the
          fork; while browsing it stays approximately 4 mm proximal to the selected level. Its
          reference orientation is fixed for each region; rotating the CT does not roll the camera.
          CT-derived surface, not recorded bronchoscopy or a scored camera checkpoint.
        </p>
        {!local && (
          <button aria-pressed={!showNodule} onClick={() => setShowNodule((value) => !value)}>
            {showNodule ? 'View original CT without nodule' : 'Restore simulated nodule'}
          </button>
        )}
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
          Focus the image. Arrow keys move the cursor; Shift moves faster; Enter places a mark; Page
          Up and Page Down change the slice. The mouse wheel scrolls the page unless you turn on
          Wheel steps slices, which Escape or the same button turns off again. Magnify enlarges the
          native pixels beside the image; it adds no resolution and validates nothing. Hide overlays
          removes the rings, crosshairs and labels and restores them immediately. Acquisition slice
          index: {shownSlice}; patient z: {sliceZ(shownSlice).toFixed(1)} mm.
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
      {!local && !showNodule && (
        <p className={styles.ctInstruction} role="status">
          Original CT · simulated nodule hidden
        </p>
      )}
    </section>
  )
}
