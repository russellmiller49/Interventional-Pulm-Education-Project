import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  RecordedExampleSource,
  RecordedFrameSource,
} from '../../../../../src/lib/ebus-recorded-contract'
type Snapshot = { image: string; source: RecordedFrameSource }
import {
  createKnobologyFrameState,
  reduceKnobologyFrameState,
  type KnobologySimulatorAction,
} from '@/features/knobology/logic'
import { useKnobologyVideoLookup } from '@/features/knobology/useKnobologyVideoLookup'
import {
  getKnobologyVideoDepthCm,
  getKnobologyVideoSegmentSrc,
  getKnobologyVideoSegmentStart,
  getKnobologyVideoSegmentEnd,
  KNOBOLOGY_VIDEO_DEPTHS_CM,
  KNOBOLOGY_VIDEO_DEPTH_LEVELS,
  KNOBOLOGY_VIDEO_VALUE_LEVELS,
  resolveKnobologyVideoSegment,
  type KnobologyVideoSegment,
} from '@/features/knobology/videoSegments'
import {
  EMPTY_EBUS_OBSERVATION,
  type EbusObservation,
  type EbusWorkbenchConfig,
  type EbusControl,
} from '../../../../../src/lib/ebus-guided-bridge'
import { RecordedFrameView } from './RecordedFrameView'
import {
  RECORDED_FRAME_FIT_LABELS,
  recordedFramePixelSeparation,
  type RecordedFrameFit,
} from './recordedFrameRegion'

/** Controls that pick a recorded example; the rest act on the frame that is already decoded. */
const SELECTION_CONTROLS: EbusControl[] = ['depth', 'gain', 'contrast', 'doppler']
/** Trackball units per normalised frame unit, matching `MEASUREMENT_TRACKBALL_SENSITIVITY`. */
const TRACKBALL_UNITS_PER_FRAME = 1 / 0.0012

/**
 * What a recorded clip actually is, for the caption and the frame's provenance
 * (EBUS-PRE-REVIEW-02, L7-1).
 *
 * The lookup holds one clip per step of one control: `Depth4_Gain_3` is the third recorded gain
 * step at 4 cm, and it says nothing about contrast. The slider used to read "Gain level 8" while
 * the caption beside it read "Gain 100", two scales for one thing and neither of them a device
 * unit. Everything user-facing now names the example, and the frame carries the segment, file and
 * window it came from.
 */
function describeExample(segment: KnobologyVideoSegment): RecordedExampleSource {
  const numeric = typeof segment.value === 'number' ? segment.value : 0
  const control =
    segment.control === 'contrast' ? 'contrast' : segment.control === 'gain' ? 'gain' : 'flow'
  return {
    control,
    index: control === 'flow' ? 1 : Math.max(1, Math.min(KNOBOLOGY_VIDEO_VALUE_LEVELS.length, numeric)),
    levels: control === 'flow' ? 1 : KNOBOLOGY_VIDEO_VALUE_LEVELS.length,
    segmentId: segment.name,
    file: `Depth${segment.depth}.mp4`,
    startSeconds: getKnobologyVideoSegmentStart(segment),
    endSeconds: getKnobologyVideoSegmentEnd(segment),
    depthCm: segment.depth,
  }
}

function exampleSentence(example: RecordedExampleSource): string {
  const varied =
    example.control === 'flow'
      ? 'a flow-mode recording'
      : `${example.control} example ${example.index} of ${example.levels}`
  return `Depth ${example.depthCm} cm · ${varied} · clip ${example.segmentId}, ${example.startSeconds.toFixed(1)}–${example.endSeconds.toFixed(1)} s of ${example.file}`
}

export function GuidedKnobology({
  config,
  onObservation,
}: {
  config: EbusWorkbenchConfig
  onObservation: (v: EbusObservation) => void
}) {
  const [state, setState] = useState(() =>
    createKnobologyFrameState({
      id: 'guided-image',
      title: 'Guided acquisition',
      symptom: '',
      instructions: '',
      focusControl: 'depth',
      start: {
        depth:
          KNOBOLOGY_VIDEO_DEPTH_LEVELS[
            KNOBOLOGY_VIDEO_DEPTHS_CM.findIndex((v) => v === config.initialDepth / 10)
          ] ?? 60,
        gain: config.initialGain,
        contrast: 43,
      },
      target: { depth: 60, gain: 43, contrast: 43 },
      successMessage: '',
    }),
  )
  const [lastControl, setLastControl] = useState<'depth' | 'gain' | 'contrast'>('gain')
  const [actions, setActions] = useState({ count: 0, last: '', used: [] as EbusControl[] })
  const [readyKey, setReadyKey] = useState('')
  const [error, setError] = useState('')
  const [capture, setCapture] = useState<string | null>(null)
  const [playbackPaused, setPlaybackPaused] = useState(true)
  const [baseline, setBaseline] = useState<Snapshot | null>(null)
  const [held, setHeld] = useState<Snapshot | null>(null)
  const [decoded, setDecoded] = useState<Snapshot | null>(null)
  const [fit, setFit] = useState<RecordedFrameFit>('image')
  const [enlarged, setEnlarged] = useState(false)
  const [fullscreenDenied, setFullscreenDenied] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const { lookup, status } = useKnobologyVideoLookup()
  const resolved = useMemo(
    () =>
      lookup
        ? resolveKnobologyVideoSegment(lookup, {
            depth: state.depth,
            gain: state.gain,
            contrast: state.contrast,
            control: lastControl,
            flowMode: state.colorDoppler ? 'color' : null,
          })
        : null,
    [lookup, state.depth, state.gain, state.contrast, state.colorDoppler, lastControl],
  )
  const segment = resolved?.segment
  const key = segment?.name ?? ''
  const frameReady = !!key && readyKey === key && !error
  const example = useMemo(() => (segment ? describeExample(segment) : null), [segment])
  /**
   * A selection is usable as soon as the lookup resolves it; the frame catches up on its own
   * (EBUS-PRE-REVIEW-02, L7-4). Readiness is a separate thing and is never claimed early.
   */
  const controlsUsable = !config.locked && status === 'ready' && !!segment && !error
  const validMeasurement =
    !!state.measurementStart &&
    !!state.measurementEnd &&
    Math.hypot(
      state.measurementStart.x - state.measurementEnd.x,
      state.measurementStart.y - state.measurementEnd.y,
    ) > 0.025
  const pixelSeparation =
    state.measurementStart && state.measurementEnd
      ? recordedFramePixelSeparation(state.measurementStart, state.measurementEnd)
      : null
  const snapshot = useCallback(
    (isHeld: boolean): Snapshot | null => {
      const element = video.current
      if (!element || element.readyState < 2 || element.seeking || !key || !element.videoWidth)
        return null
      const canvas = document.createElement('canvas')
      canvas.width = element.videoWidth
      canvas.height = element.videoHeight
      const context = canvas.getContext('2d')
      if (!context) return null
      try {
        // The whole recorded frame, never the display region: the held image keeps the device
        // banner and anything else the recording carries outside the sector.
        context.drawImage(element, 0, 0)
        const calipers = [state.measurementStart, state.measurementEnd].filter(
          (point): point is { x: number; y: number } => !!point,
        )
        context.strokeStyle = '#6ff2db'
        context.lineWidth = 3
        for (const point of calipers) {
          const x = point.x * canvas.width,
            y = point.y * canvas.height
          context.beginPath()
          context.moveTo(x - 9, y)
          context.lineTo(x + 9, y)
          context.moveTo(x, y - 9)
          context.lineTo(x, y + 9)
          context.stroke()
        }
        const image = canvas.toDataURL('image/png')
        let hash = 2166136261
        for (let i = 0; i < image.length; i++)
          hash = Math.imul(hash ^ image.charCodeAt(i), 16777619)
        return {
          image,
          source: {
            type: 'recorded-frame',
            version: 1,
            sessionId: config.sessionId,
            taskId: config.recordedTask ?? 'practice',
            frameId: config.sessionId + ':' + (hash >>> 0).toString(16),
            segmentId: key,
            mediaTime: element.currentTime,
            width: canvas.width,
            height: canvas.height,
            settings: {
              depthMm: getKnobologyVideoDepthCm(state.depth) * 10,
              gain: state.gain,
              contrast: state.contrast,
              doppler: state.colorDoppler,
            },
            ...(example ? { example } : {}),
            calipers,
            held: isHeld,
            captured: !!capture && state.saved,
          },
        }
      } catch {
        setError('The selected recording could not be captured. Reload the workbench to retry.')
        return null
      }
    },
    [
      key,
      example,
      config.sessionId,
      config.recordedTask,
      state.depth,
      state.gain,
      state.contrast,
      state.colorDoppler,
      state.measurementStart,
      state.measurementEnd,
      state.saved,
      capture,
    ],
  )
  const allowed = (control: EbusControl) => !config.locked && config.controls.includes(control)
  /**
   * Apply the learner's latest intent (EBUS-PRE-REVIEW-02, L7-3 / L7-4).
   *
   * Every control used to be dropped while the next clip was decoding, and the fieldset was
   * disabled for the same 20 ms, which blurred whatever was focused — so a run of arrow presses
   * registered once and then went nowhere. A control that selects a recorded example now always
   * applies; the frame follows. Controls that act on the decoded frame still need one.
   */
  function act(control: EbusControl, action: KnobologySimulatorAction) {
    if (!allowed(control)) return
    if (!SELECTION_CONTROLS.includes(control) && !frameReady) return
    if (SELECTION_CONTROLS.includes(control) && control !== 'doppler')
      setLastControl(control as 'depth' | 'gain' | 'contrast')
    setState((current) => ({ ...reduceKnobologyFrameState(current, action), saved: false }))
    setCapture(null)
    setActions((a) => ({
      count: a.count + 1,
      last: control,
      used: [...new Set([...a.used, control])],
    }))
  }
  useEffect(() => {
    const element = video.current
    if (!element || !segment) return
    setReadyKey('')
    setError('')
    let cancelled = false,
      animation = 0
    const start = getKnobologyVideoSegmentStart(segment) + 0.025,
      end = getKnobologyVideoSegmentEnd(segment)
    const report = () => {
      if (
        cancelled ||
        element.readyState < 2 ||
        element.seeking ||
        element.currentTime < start - 0.05 ||
        element.currentTime >= end
      )
        return
      // A decoded, seeked frame can be drawn while paused. Never play to manufacture readiness.
      setReadyKey(segment.name)
    }
    const seek = () => {
      try {
        element.currentTime = start
      } catch {
        /* Metadata will retry. */
      }
      report()
    }
    const fail = () => {
      setReadyKey('')
      setError('This teaching clip could not load. Reload the activity to retry.')
    }
    const loop = () => {
      if (!element.paused && element.currentTime >= end - 0.045) element.currentTime = start
      animation = requestAnimationFrame(loop)
    }
    element.addEventListener('loadedmetadata', seek)
    element.addEventListener('loadeddata', report)
    element.addEventListener('seeked', report)
    element.addEventListener('error', fail)
    if (element.readyState >= 1) seek()
    animation = requestAnimationFrame(loop)
    element.pause()
    setPlaybackPaused(true)
    return () => {
      cancelled = true
      cancelAnimationFrame(animation)
      element.removeEventListener('loadedmetadata', seek)
      element.removeEventListener('loadeddata', report)
      element.removeEventListener('seeked', report)
      element.removeEventListener('error', fail)
    }
  }, [segment])
  // Playback begins only with an explicit learner action. Layout and hydration cannot start it.
  useEffect(() => {
    const element = video.current
    if (!element) return
    if (config.locked && !playbackPaused) setPlaybackPaused(true)
    if (!frameReady || state.frozen || config.locked || playbackPaused) element.pause()
    else void element.play().catch(() => setPlaybackPaused(true))
  }, [state.frozen, config.locked, key, frameReady, playbackPaused])
  useEffect(() => {
    if (!frameReady) return
    if (config.locked) video.current?.pause()
    const actual = snapshot(config.locked)
    if (!actual) return
    setDecoded(actual)
    if (config.locked) setHeld(actual)
    else setHeld(null)
    setBaseline((prior) => prior ?? actual)
  }, [frameReady, config.locked, snapshot])
  useEffect(
    () =>
      onObservation({
        ...EMPTY_EBUS_OBSERVATION,
        usedControls: actions.used,
        actionCount: actions.count,
        lastAction: actions.last,
        ready: status === 'ready',
        frameReady: frameReady && !!decoded && (!config.locked || !!held),
        /*
         * While a newer selection is still decoding there is no current frame to describe, so no
         * provenance is reported rather than the previous frame's (EBUS-PRE-REVIEW-02, L7-4). The
         * held frame is a different thing and keeps its own.
         */
        recorded: config.locked ? held?.source : frameReady ? decoded?.source : undefined,
        depth: getKnobologyVideoDepthCm(state.depth) * 10,
        gain: state.gain,
        contrast: state.contrast,
        doppler: state.colorDoppler,
        frozen: state.frozen,
        measured: validMeasurement,
        saved: !!capture && state.saved,
      }),
    [
      actions,
      status,
      frameReady,
      state,
      capture,
      validMeasurement,
      onObservation,
      config.locked,
      held,
      decoded,
    ],
  )
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (enlarged && !element.open) {
      element.showModal()
      // Fullscreen makes the recording as large as the display allows; the host iframe already
      // carries `allow="fullscreen"`. Where it is refused the dialog still fills the workbench,
      // and the caption says so rather than pretending the view is bigger than it is.
      element.requestFullscreen?.().then(
        () => setFullscreenDenied(false),
        () => setFullscreenDenied(true),
      )
    }
    if (!enlarged && element.open) {
      if (document.fullscreenElement === element) void document.exitFullscreen?.()
      element.close()
    }
  }, [enlarged])
  const processor = (
    control: EbusControl,
    actionId: 'TOGGLE_FREEZE' | 'MEASURE_MODE' | 'MEASURE_SET' | 'CURSOR_MODE',
  ) => act(control, { type: 'PROCESSOR_ACTION', actionId })
  /** Pointer and touch placement, expressed as the same trackball move the buttons make. */
  const placeCaliper = (point: { x: number; y: number }) => {
    const active =
      state.activeMeasurementMarker === 1 && state.measurementEnd
        ? state.measurementEnd
        : state.measurementStart
    if (!active) return
    act('measure', {
      type: 'MOVE_TRACKBALL',
      deltaX: (point.x - active.x) * TRACKBALL_UNITS_PER_FRAME,
      deltaY: (point.y - active.y) * TRACKBALL_UNITS_PER_FRAME,
    })
  }
  const placementOpen =
    state.calipers && !config.locked && state.frozen && !!state.measurementStart && frameReady
  function save() {
    if (!allowed('save') || !frameReady || !state.frozen || !validMeasurement || !video.current)
      return
    const canvas = document.createElement('canvas')
    canvas.width = video.current.videoWidth
    canvas.height = video.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video.current, 0, 0)
    ctx.strokeStyle = '#6ff2db'
    ctx.lineWidth = 3
    for (const point of [state.measurementStart!, state.measurementEnd!]) {
      const x = point.x * canvas.width,
        y = point.y * canvas.height
      ctx.beginPath()
      ctx.moveTo(x - 9, y)
      ctx.lineTo(x + 9, y)
      ctx.moveTo(x, y - 9)
      ctx.lineTo(x, y + 9)
      ctx.stroke()
    }
    setCapture(canvas.toDataURL('image/png'))
    setState((s) => ({
      ...reduceKnobologyFrameState(s, { type: 'PROCESSOR_ACTION', actionId: 'SAVE_REC' }),
      saved: true,
    }))
    setActions((a) => ({
      count: a.count + 1,
      last: 'save',
      used: [...new Set([...a.used, 'save' as const])],
    }))
  }
  const currentMedia = (
    <>
      {segment && (
        <video
          ref={video}
          hidden={config.locked && !!held}
          src={getKnobologyVideoSegmentSrc(segment.depth)}
          muted
          playsInline
          preload="auto"
          aria-label="Ultrasound teaching clip"
        />
      )}
      {config.locked && held && (
        <img src={held.image} alt="Held recorded image from this acquisition" data-recorded-held />
      )}
    </>
  )
  const fitToggle = (
    <div className="guided-tabs recorded-fit" role="group" aria-label="Displayed region">
      {(['image', 'frame'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={fit === option}
          data-recorded-fit-option={option}
          onClick={() => setFit(option)}
        >
          {RECORDED_FRAME_FIT_LABELS[option]}
        </button>
      ))}
    </div>
  )
  return (
    <div className="guided-workbench guided-recording">
      <h2>EBUS workbench</h2>
      <p className="guided-label">Recorded ultrasound clips · Educational controls</p>
      {(status === 'error' || error) && (
        <p role="alert" className="guided-error">
          {error || 'The image library could not load. Reload to retry.'}
        </p>
      )}
      <div className="recorded-workspace">
        {/*
          The recording being manipulated comes first, so that when the pair stacks it is the one
          beside the controls; the previous comparison stays right below it, full size
          (EBUS-PRE-REVIEW-02, L6-1). Each figure says which it is.
        */}
        <div className="recorded-images">
          <figure className="recorded-current">
            <RecordedFrameView
              fit={fit}
              media={currentMedia}
              calipers={
                state.calipers && !config.locked
                  ? [state.measurementStart, state.measurementEnd]
                  : undefined
              }
              activeCaliper={state.activeMeasurementMarker}
              connectLine
              onPlace={placementOpen ? placeCaliper : undefined}
            />
            {!frameReady && !error && (
              <p role="status" className="recorded-busy" data-recorded-busy>
                Loading the selected ultrasound image…
              </p>
            )}
            <figcaption>
              <strong>{config.locked ? 'Held recording.' : 'Current recording.'}</strong>{' '}
              {example ? exampleSentence(example) : 'Selecting a recording…'}
              {state.colorDoppler ? ' · Color Doppler' : ' · Grayscale'}.
            </figcaption>
          </figure>
        </div>
          {baseline && config.recordedTask !== 'capture' && (
            <figure className="recorded-baseline">
              <RecordedFrameView
                fit={fit}
                media={
                  <img
                    src={baseline.image}
                    alt="Previous recorded image retained for comparison"
                    data-recorded-baseline
                  />
                }
              />
              <figcaption>
                <strong>Previous recording.</strong>{' '}
                {baseline.source.example
                  ? exampleSentence(baseline.source.example)
                  : 'Selected depth ' + baseline.source.settings.depthMm / 10 + ' cm'}
                {baseline.source.settings.doppler ? ' · Color Doppler' : ' · Grayscale'}. These
                pixels stay fixed until you keep a new comparison.
              </figcaption>
            </figure>
          )}
        <div className="recorded-controls">
          <p role="status" aria-busy={!frameReady}>
            {config.locked
              ? 'Held recording'
              : !frameReady
                ? 'Loading the selected recording'
                : state.frozen
                  ? 'Image frozen'
                  : playbackPaused
                    ? 'Recording paused'
                    : 'Recording playing'}{' '}
            · Depth {getKnobologyVideoDepthCm(state.depth)} cm
          </p>
          {fitToggle}
          <button type="button" onClick={() => setEnlarged(true)} data-recorded-enlarge>
            Enlarge the image
          </button>
          <fieldset hidden={config.locked} disabled={!controlsUsable} aria-busy={!frameReady}>
            <legend>Image controls</legend>
            {(['depth', 'gain', 'contrast'] as const)
              .filter((c) => config.controls.includes(c))
              .map((control) => {
                const values: readonly number[] =
                  control === 'depth' ? KNOBOLOGY_VIDEO_DEPTH_LEVELS : KNOBOLOGY_VIDEO_VALUE_LEVELS
                const index = values.reduce(
                  (best, v, i) =>
                    Math.abs(v - state[control]) < Math.abs(values[best] - state[control])
                      ? i
                      : best,
                  0,
                )
                return (
                  <label key={control}>
                    {control === 'depth' ? 'Depth' : control === 'gain' ? 'Gain' : 'Contrast'}{' '}
                    <output>
                      {control === 'depth'
                        ? getKnobologyVideoDepthCm(state.depth) + ' cm'
                        : 'example ' + (index + 1) + ' of ' + values.length}
                    </output>
                    <input
                      aria-label={
                        control === 'depth'
                          ? 'Image depth'
                          : control === 'gain'
                            ? 'Image gain'
                            : 'Image contrast'
                      }
                      type="range"
                      min="0"
                      max={values.length - 1}
                      step="1"
                      value={index}
                      disabled={state.frozen}
                      onChange={(e) =>
                        act(control, {
                          type: 'SET_NUMERIC_FIELD',
                          field: control,
                          value: values[Number(e.target.value)],
                        })
                      }
                    />
                  </label>
                )
              })}
            {config.controls.includes('doppler') && (
              <button
                disabled={state.frozen}
                aria-pressed={state.colorDoppler}
                onClick={() =>
                  act('doppler', { type: 'SET_COLOR_DOPPLER', enabled: !state.colorDoppler })
                }
              >
                Color Doppler
              </button>
            )}
            {config.controls.includes('freeze') && (
              <button
                aria-pressed={state.frozen}
                disabled={!frameReady}
                onClick={() => processor('freeze', 'TOGGLE_FREEZE')}
              >
                {state.frozen ? 'Resume image' : 'Freeze image'}
              </button>
            )}
            {config.controls.includes('measure') && (
              <div>
                <p>
                  Freeze → Measure → place the first caliper on the image or move it with the
                  buttons → Set first caliper → place the second. Compare two distinct positions on
                  the image.
                </p>
                <div className="guided-tabs">
                  <button
                    disabled={!state.frozen || !frameReady}
                    onClick={() => processor('measure', 'MEASURE_MODE')}
                  >
                    Measure
                  </button>
                  <button
                    disabled={!state.measurementStart || !frameReady}
                    onClick={() => processor('measure', 'MEASURE_SET')}
                  >
                    Set first caliper
                  </button>
                  <button
                    disabled={!state.measurementEnd || !frameReady}
                    onClick={() => processor('measure', 'CURSOR_MODE')}
                  >
                    Switch caliper
                  </button>
                </div>
                <div className="guided-tabs" role="group" aria-label="Move active caliper">
                  {[
                    ['Left', -15, 0],
                    ['Right', 15, 0],
                    ['Up', 0, -15],
                    ['Down', 0, 15],
                  ].map(([label, x, y]) => (
                    <button
                      key={label}
                      disabled={!state.measurementStart || !frameReady}
                      onClick={() =>
                        act('measure', {
                          type: 'MOVE_TRACKBALL',
                          deltaX: Number(x),
                          deltaY: Number(y),
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="guided-label">
                  Active marker:{' '}
                  {state.activeMeasurementMarker === null
                    ? 'none'
                    : state.activeMeasurementMarker + 1}
                  .{' '}
                  {pixelSeparation !== null && (
                    <span data-caliper-separation>
                      Separation on the recorded frame: {Math.round(pixelSeparation)} px of 1920 ×
                      1080. That is a distance on the picture, not a calibrated measurement, and two
                      separated points are not evidence that either sits on a border.
                    </span>
                  )}
                </p>
              </div>
            )}
            {config.controls.includes('save') && (
              <button disabled={!state.frozen || !validMeasurement || !frameReady} onClick={save}>
                Save image
              </button>
            )}
          </fieldset>
          <button
            disabled={!frameReady || state.frozen || config.locked}
            onClick={() => setPlaybackPaused((v) => !v)}
          >
            {playbackPaused ? 'Play clip' : 'Pause clip'}
          </button>
          {config.recordedTask !== 'capture' && (
            <button
              disabled={!frameReady || config.locked}
              onClick={() => {
                video.current?.pause()
                setPlaybackPaused(true)
                const actual = snapshot(false)
                if (actual) setBaseline(actual)
              }}
            >
              Keep this image for comparison
            </button>
          )}
          <p className="guided-label">
            Each control selects a recorded example, and each recording varies one control at a
            time: a gain example holds whatever contrast it was recorded with, and the level you
            select for the other control does not change it. Combined settings are not a continuous
            ultrasound simulation. Example numbers and caliper positions are educational; no
            clinical measurement is reported.
          </p>
        </div>
      </div>
      {capture && !config.locked && (
        <figure>
          <img src={capture} alt="Saved teaching image with the calipers you placed" />
          <figcaption>
            Captured in this activity. The image remains here until an acquisition control changes.
          </figcaption>
        </figure>
      )}
      {config.locked && <p>Controls are paused during review.</p>}
      <dialog ref={dialog} className="recorded-enlarged" onClose={() => setEnlarged(false)}>
        <div className="recorded-enlarged-head">
          <h3>{config.locked ? 'Held recording' : 'Current recording'}</h3>
          {fitToggle}
          <button type="button" onClick={() => setEnlarged(false)}>
            Close
          </button>
        </div>
        {enlarged && (
          <RecordedFrameView
            fit={fit}
            className="recorded-enlarged-frame"
            media={
              <img
                src={(config.locked ? held : decoded)?.image ?? ''}
                alt={
                  config.locked
                    ? 'Held recorded image, enlarged'
                    : 'The recorded image currently selected, enlarged'
                }
                data-recorded-enlarged
              />
            }
            calipers={
              state.calipers && !config.locked
                ? [state.measurementStart, state.measurementEnd]
                : undefined
            }
            activeCaliper={state.activeMeasurementMarker}
            connectLine
          />
        )}
        <p className="guided-label">
          {example ? exampleSentence(example) : ''} · 1920 × 1080 recorded pixels, shown whole or
          cropped to the measured image area; nothing is upscaled past the recording.
          {fullscreenDenied
            ? ' This browser did not allow a full-screen view, so the image is as large as the workbench allows.'
            : ''}
        </p>
      </dialog>
    </div>
  )
}
