import { useEffect, useMemo, useRef, useState } from 'react'
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
} from '@/features/knobology/videoSegments'
import {
  EMPTY_EBUS_OBSERVATION,
  type EbusObservation,
  type EbusWorkbenchConfig,
  type EbusControl,
} from '../../../../../src/lib/ebus-guided-bridge'

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
  const [playbackPaused, setPlaybackPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const video = useRef<HTMLVideoElement>(null)
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
  const validMeasurement =
    !!state.measurementStart &&
    !!state.measurementEnd &&
    Math.hypot(
      state.measurementStart.x - state.measurementEnd.x,
      state.measurementStart.y - state.measurementEnd.y,
    ) > 0.025
  const allowed = (control: EbusControl) => !config.locked && config.controls.includes(control)
  function act(control: EbusControl, action: KnobologySimulatorAction) {
    if (!allowed(control) || !frameReady) return
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
      animation = 0,
      frameCallback = 0
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
      if (element.requestVideoFrameCallback)
        frameCallback = element.requestVideoFrameCallback(() => {
          if (!cancelled) setReadyKey(segment.name)
        })
      else setReadyKey(segment.name)
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
    void element.play().catch(() => {})
    return () => {
      cancelled = true
      cancelAnimationFrame(animation)
      if (frameCallback) element.cancelVideoFrameCallback(frameCallback)
      element.removeEventListener('loadedmetadata', seek)
      element.removeEventListener('loadeddata', report)
      element.removeEventListener('seeked', report)
      element.removeEventListener('error', fail)
    }
  }, [segment])
  // Let the selected frame reach the compositor before pausing so a newly selected clip
  // can still report its actual frame in reduced-motion mode.
  useEffect(() => {
    const element = video.current
    if (!element) return
    if (frameReady && (state.frozen || config.locked || playbackPaused)) element.pause()
    else void element.play().catch(() => {})
  }, [state.frozen, config.locked, key, frameReady, playbackPaused])
  useEffect(
    () =>
      onObservation({
        ...EMPTY_EBUS_OBSERVATION,
        usedControls: actions.used,
        actionCount: actions.count,
        lastAction: actions.last,
        ready: status === 'ready',
        frameReady,
        depth: getKnobologyVideoDepthCm(state.depth) * 10,
        gain: state.gain,
        contrast: state.contrast,
        doppler: state.colorDoppler,
        frozen: state.frozen,
        measured: validMeasurement,
        saved: !!capture && state.saved,
      }),
    [actions, status, frameReady, state, capture, validMeasurement, onObservation],
  )
  const processor = (
    control: EbusControl,
    actionId: 'TOGGLE_FREEZE' | 'MEASURE_MODE' | 'MEASURE_SET' | 'CURSOR_MODE',
  ) => act(control, { type: 'PROCESSOR_ACTION', actionId })
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
  return (
    <div className="guided-workbench">
      <h2>EBUS workbench</h2>
      <p className="guided-label">Recorded ultrasound clips · Educational controls</p>
      {(status === 'error' || error) && (
        <p role="alert" className="guided-error">
          {error || 'The image library could not load. Reload to retry.'}
        </p>
      )}
      <div className="guided-media">
        {segment && (
          <video
            ref={video}
            src={getKnobologyVideoSegmentSrc(segment.depth)}
            muted
            playsInline
            preload="auto"
            aria-label="Ultrasound teaching clip"
          />
        )}
        {!frameReady && !error && <p role="status">Loading the selected ultrasound image…</p>}
        {state.calipers && (
          <svg viewBox="0 0 100 100" aria-label="Movable measurement calipers">
            {[state.measurementStart, state.measurementEnd].map(
              (p, i) =>
                p && (
                  <g
                    key={i}
                    stroke={i === state.activeMeasurementMarker ? '#ffff93' : '#69f5de'}
                    strokeWidth=".6"
                  >
                    <path
                      d={
                        'M' +
                        (p.x * 100 - 2) +
                        ' ' +
                        p.y * 100 +
                        'h4 M' +
                        p.x * 100 +
                        ' ' +
                        (p.y * 100 - 2) +
                        'v4'
                      }
                    />
                  </g>
                ),
            )}
          </svg>
        )}
      </div>
      <p role="status">
        {state.frozen ? 'Image frozen' : playbackPaused ? 'Clip paused' : 'Live clip'} · Depth{' '}
        {getKnobologyVideoDepthCm(state.depth)} cm
      </p>
      <button
        disabled={!frameReady || state.frozen || config.locked}
        onClick={() => setPlaybackPaused((v) => !v)}
      >
        {playbackPaused ? 'Play clip' : 'Pause clip'}
      </button>
      <p className="guided-label">
        Each control selects a recorded example. Combined settings are not a continuous ultrasound
        simulation. Control levels and caliper positions are educational; no clinical measurement is
        reported.
      </p>
      <fieldset disabled={config.locked || !frameReady}>
        <legend>Image controls</legend>
        {(['depth', 'gain', 'contrast'] as const)
          .filter((c) => config.controls.includes(c))
          .map((control) => {
            const values: readonly number[] =
              control === 'depth' ? KNOBOLOGY_VIDEO_DEPTH_LEVELS : KNOBOLOGY_VIDEO_VALUE_LEVELS
            const index = values.reduce(
              (best, v, i) =>
                Math.abs(v - state[control]) < Math.abs(values[best] - state[control]) ? i : best,
              0,
            )
            return (
              <label key={control}>
                {control === 'depth' ? 'Depth' : control === 'gain' ? 'Gain' : 'Contrast'}{' '}
                <output>
                  {control === 'depth'
                    ? getKnobologyVideoDepthCm(state.depth) + ' cm'
                    : 'level ' + (index + 1)}
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
                  onChange={(e) => {
                    setLastControl(control)
                    act(control, {
                      type: 'SET_NUMERIC_FIELD',
                      field: control,
                      value: values[Number(e.target.value)],
                    })
                  }}
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
          <button aria-pressed={state.frozen} onClick={() => processor('freeze', 'TOGGLE_FREEZE')}>
            {state.frozen ? 'Resume image' : 'Freeze image'}
          </button>
        )}
        {config.controls.includes('measure') && (
          <div>
            <p>
              Freeze → Measure → move the first marker → Set first caliper → move the second marker.
              Compare two distinct positions on the image.
            </p>
            <div className="guided-tabs">
              <button disabled={!state.frozen} onClick={() => processor('measure', 'MEASURE_MODE')}>
                Measure
              </button>
              <button
                disabled={!state.measurementStart}
                onClick={() => processor('measure', 'MEASURE_SET')}
              >
                Set first caliper
              </button>
              <button
                disabled={!state.measurementEnd}
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
                  disabled={!state.measurementStart}
                  onClick={() =>
                    act('measure', { type: 'MOVE_TRACKBALL', deltaX: Number(x), deltaY: Number(y) })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="guided-label">
              Active marker:{' '}
              {state.activeMeasurementMarker === null ? 'none' : state.activeMeasurementMarker + 1}.{' '}
              {validMeasurement ? 'Two distinct caliper positions recorded.' : ''}
            </p>
          </div>
        )}
        {config.controls.includes('save') && (
          <button disabled={!state.frozen || !validMeasurement} onClick={save}>
            Save image
          </button>
        )}
      </fieldset>
      {capture && (
        <figure>
          <img src={capture} alt="Saved teaching image with the calipers you placed" />
          <figcaption>
            Captured in this activity. The image remains here until an acquisition control changes.
          </figcaption>
        </figure>
      )}
      {config.locked && <p>Controls are paused during review.</p>}
    </div>
  )
}
