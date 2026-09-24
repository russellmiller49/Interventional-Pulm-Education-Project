import { MCS_IABP_PRESSURE_SCALE } from '../../content/iabpWaveformReference'
import { deriveIabpCycleState } from '../../engine/model'
import type { McsSimulationState } from '../../engine/types'
import { iabpStripView, iabpTimingView, tracePath } from '../teaching/selectors'
import { McsIabpLiveTraceLimits, McsIabpWaveformReference } from './McsIabpWaveformReference'
import styles from './mcs-stage.module.css'

/** Traces and balloon state share the existing engine clock. No diagnostic contour is invented. */
export function McsTimingFigure({
  state,
  annotated = true,
}: {
  state: McsSimulationState
  annotated?: boolean
}) {
  const timing = iabpTimingView(state)
  // One fixed pressure domain across every timing figure, so the five demonstrations in Section 3
  // are drawn against the same pressures and can be compared with one another and with the
  // authored reference below (F17). No sample changes; only the y mapping does.
  const strip = timing && iabpStripView(state, timing, annotated ? 3 : 2, MCS_IABP_PRESSURE_SCALE)
  if (!timing || !strip || state.device.kind !== 'iabp') return null
  const device = state.device
  const end = state.waveforms[state.waveforms.length - 1].time
  const start = end - strip.windowSeconds
  const cycleMs = 60000 / state.patient.heartRateBpm
  const balloonSamples = state.waveforms.filter((sample) => sample.time >= start)
  const marks = { notch: 'N', inflation: 'I', deflation: 'D', upstroke: 'U' }
  return (
    <>
      <figure className={styles.block} data-timing-figure={annotated ? 'reference' : 'independent'}>
        <h3>{annotated ? 'Timing reference' : 'Timing example'}</h3>
        <p>
          {annotated
            ? 'Annotated demonstration'
            : 'Changed example · identify the relationship without the diagnostic annotations'}{' '}
          · ECG, arterial pressure, then balloon inflation band.
        </p>
        <svg
          viewBox="0 0 320 162"
          role="img"
          aria-label={
            annotated
              ? 'Modeled assisted beats with valve closure, inflation, deflation and next ejection labeled'
              : 'Unannotated ECG and arterial traces with a synchronized balloon inflation band; equivalent timing observations follow'
          }
          data-iabp-reference-strip
        >
          <path d={tracePath(strip.ecg, 320, 30)} stroke="currentColor" fill="none" />
          <g transform="translate(0 44)">
            <path
              d={tracePath(strip.arterial, 320, 64)}
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </g>
          {balloonSamples.map((sample, index) =>
            deriveIabpCycleState(sample.time, state.patient.heartRateBpm, device).inflated ? (
              <rect
                key={sample.time}
                x={((sample.time - start) / strip.windowSeconds) * 320}
                y="122"
                width={Math.max(
                  1,
                  (((balloonSamples[index + 1]?.time ?? end + 0.02) - sample.time) /
                    strip.windowSeconds) *
                    320,
                )}
                height="10"
                fill="#54cbbb"
              />
            ) : null,
          )}
          {annotated
            ? strip.landmarks.map((landmark) => (
                <g key={`${landmark.id}-${landmark.beatIndex}`} data-iabp-landmark={landmark.id}>
                  <line
                    x1={landmark.x * 320}
                    x2={landmark.x * 320}
                    y1="36"
                    y2="136"
                    stroke="currentColor"
                    strokeDasharray={landmark.id === 'notch' ? '2 3' : '5 4'}
                    opacity="0.6"
                  />
                  <text
                    x={Math.min(307, landmark.x * 320 + 1)}
                    y={landmark.id === 'inflation' ? '158' : '147'}
                    fill="currentColor"
                    fontSize="11"
                  >
                    {marks[landmark.id]}
                  </text>
                </g>
              ))
            : null}
        </svg>
        {annotated ? (
          <p>
            U: systolic upstroke / next ejection. N: dicrotic-notch reference for aortic-valve
            closure. I: inflation starts. D: deflation completes. The filled band means balloon
            inflated. With late deflation the band can extend into the next beat, including a beat
            not selected for assistance by the 1:{device.assistRatio} schedule.
          </p>
        ) : null}
        <details>
          <summary>Text equivalent of timing observations</summary>
          <p>
            During an assisted cycle of {cycleMs.toFixed(0)} ms, the model’s valve-closure reference
            is {(timing.notchPhase * cycleMs).toFixed(0)} ms after cycle start. The balloon
            inflation band begins at {(timing.inflationPhase * cycleMs).toFixed(0)} ms and ends at{' '}
            {(timing.deflationPhase * cycleMs).toFixed(0)} ms. The next ejection reference is{' '}
            {(timing.nextUpstrokePhase * cycleMs).toFixed(0)} ms. Support is{' '}
            {device.running ? 'running' : 'stopped'} at 1:{device.assistRatio}.
          </p>
        </details>
        <figcaption>
          Authored timing references, not detected clinical landmarks. Zero offset aligns this
          model’s event; it is not a universal manufacturer setting. The arterial trace is drawn on
          a fixed {MCS_IABP_PRESSURE_SCALE.minMmHg}–{MCS_IABP_PRESSURE_SCALE.maxMmHg} mm Hg scale,
          the same one every timing figure and the reference contour below use.
        </figcaption>
        <McsIabpLiveTraceLimits />
      </figure>
      <McsIabpWaveformReference />
    </>
  )
}
