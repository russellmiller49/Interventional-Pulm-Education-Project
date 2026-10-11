'use client'

import { useMemo } from 'react'
import { foundationTeaching, type FoundationUnitId } from '../../content/foundations'
import { getVentilatorDeviceProfile } from '../../content/deviceProfiles'
import { createLabSimulation } from '../../engine/learningLab'
import { advanceSimulation, HOLD_SECONDS } from '../../engine/simulation'
import { ventilationSimulationReducer } from '../../engine/reducer'
import { plateauReadingValidity } from '../../content/plateauValidity'
import { plateauAcquisition } from '../../content/plateauAcquisition'
import { ventilationReferenceMarker } from '../../content/referenceEvidence'
import type { VentilationSimulationState } from '../../engine/types'
import type { VentilationStageStep } from '../../content/stageLessons'
import { breathStop, type BreathStopId } from '../../content/breathSpine'
import { IdealizedComparison } from '../teaching/IdealizedComparison'
import { CapturedBreath } from './CapturedBreath'
import styles from './ventilation-stage.module.css'

export function SettingMap({ state }: { state: VentilationSimulationState }) {
  const profile = getVentilatorDeviceProfile(state.deviceId)
  const s = state.ventilator.settings
  const monitor = (metric: string, fallback: string) =>
    profile.display.monitorFields.find((f) => f.metric === metric)?.label ?? fallback
  const name = (key: keyof typeof profile.controlLabels, fallback: string) =>
    profile.controlLabels[key] ?? fallback
  return (
    <table className={styles.settingMap} data-setting-map>
      <caption>{profile.shortName}: selected settings → results to check</caption>
      <thead>
        <tr>
          <th scope="col">Selected input</th>
          <th scope="col">Separate result</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            {s.mode === 'volume-ac'
              ? `${name('vtMl', 'VT')}: ${s.vtMl} mL · selected tidal volume`
              : `${name('deltaPControlCmH2O', 'Inspiratory pressure')}: selected pressure`}{' '}
            · breath delivery
          </td>
          <td>{monitor('exhaledTidalVolume', 'Exhaled VT')} · measured exhaled tidal volume</td>
        </tr>
        <tr>
          <td>{name('ratePerMin', 'Rate')} · selected respiratory rate</td>
          <td>{monitor('totalRate', 'Total rate')} · all delivered breaths/min</td>
        </tr>
        <tr>
          <td>
            {s.mode === 'volume-ac'
              ? 'VC has no selected plateau; pressure depends on delivery and the load.'
              : `${name('deltaPControlCmH2O', 'Inspiratory pressure')} · pressure above PEEP in this model`}
          </td>
          <td>
            {monitor('peakPressure', 'Peak pressure')} · measured airway pressure; plateau needs an
            interpretable hold
          </td>
        </tr>
        <tr>
          <td>{name('oxygenPercent', 'Oxygen')} · selected oxygen fraction</td>
          <td>SpO₂ · modeled patient oxygenation response over time</td>
        </tr>
      </tbody>
    </table>
  )
}

/**
 * Static worked reference from the actual engine. Never dispatched into the learner's session.
 *
 * The walkthrough read the two plateaus on this screen — 12.9 here, "Plateau · modeled 13.5" in
 * the Readings panel — as one patient measured twice. They are two different quantities, and the
 * difference is implemented rather than clinical:
 *
 *   - the Readings number is `observedPlateauPressureCmH2O`, the airway pressure at the last
 *     end-inspiratory sample less the pressure still spent on resistance at that instant. Nothing
 *     is occluded; it is an estimate off the trace.
 *   - this number is read after the valves have actually been shut for two seconds, and the
 *     engine scales the elastic term by `1 - holdRelaxationFraction(secondsHeld)` while they are
 *     (`simulation.ts`, the hold branch of the equation of motion). Two seconds of that term is
 *     about 4.6% of the elastic pressure, which is the gap.
 *
 * So the difference is a modeled relaxation during the occlusion, stated as such. Whether the
 * amplitude and time constant of that term match real respiratory-system stress relaxation is a
 * clinical question and is in the review queue, not answered here — and the two values are not
 * averaged, rounded together or renamed to make them agree.
 */
export function WorkedHold({ device }: { device: VentilationSimulationState['deviceId'] }) {
  const reference = useMemo(() => {
    const baseline = createLabSimulation('mechanics-load-and-pressure', 0, device)
    const held = ventilationSimulationReducer(baseline, {
      type: 'PERFORM_HOLD',
      hold: 'inspiratory',
    })
    return { baseline, held: advanceSimulation(held, 2) }
  }, [device])
  const valid = plateauReadingValidity(reference.held)
  const estimate = reference.baseline.measurements.plateauPressureCmH2O
  const acquisition = plateauAcquisition(reference.held)
  /* The occlusion's own reading, so the number and the "acquired hold" label beside it agree. */
  const held = acquisition.valueCmH2O ?? acquisition.estimateCmH2O
  return (
    <div data-worked-hold>
      <p>
        <strong>
          Worked reference hold · actual simulated maneuver · separate from your patient
        </strong>
      </p>
      <p>
        Flowing peak {reference.baseline.measurements.peakPressureCmH2O.toFixed(1)} cmH₂O; plateau
        during the reference hold {held.toFixed(1)} cmH₂O ({acquisition.label}).{' '}
        {valid.interpretable ? 'Recent effort is absent in this reference.' : valid.reason}
      </p>
      <p data-worked-hold-difference>
        Before the valves shut, the same reference publishes a plateau <em>estimate</em> of{' '}
        {estimate.toFixed(1)} cmH₂O, taken from the last end-inspiratory sample with the resistive
        pressure at that instant removed. The held reading is {held.toFixed(1)} cmH₂O after two
        seconds of an actual {HOLD_SECONDS}-second occlusion, during which this model relaxes the
        elastic pressure a little. One is an unoccluded estimate and the other a timed hold, so
        expect them to differ a little.
      </p>
      <CapturedBreath
        label="Captured reference: delivered breath and inspiratory hold"
        samples={reference.held.waveforms.filter((s) => s.time >= -1)}
        whole={false}
      />
    </div>
  )
}

/**
 * The worked sentence for Section 2 reads "At the cursor in the inspiratory interval…". The walk
 * moves the same figure's cursor to whichever landmark the learner picks, so on Trigger the
 * sentence sat beside a cursor at 0.00 s (walkthrough S2-1). A worked sentence that is written for
 * one landmark is printed where the cursor is on it, and otherwise says where it applies.
 */
const WORKED_READING_STOP: Partial<Record<FoundationUnitId, BreathStopId>> = {
  'waveform-anatomy': 'inspiration',
}

/** Steps on which a foundation section's own worked figure is the evidence being read. */
export function foundationFigureStep(step: VentilationStageStep): boolean {
  return (
    step.phase === 'recognize' ||
    ['prediction', 'sort', 'interpret', 'explain'].includes(step.interaction.kind)
  )
}

/**
 * The foundation section's worked evidence — the engine-generated reference breath, the setting
 * map, the reference hold or the idealized comparison — with the sentence that says how to read it
 * placed before it, and the limit that applies to it directly after it.
 */
export function FoundationEvidence({
  unitId,
  state,
  stops,
  roundIndex = 0,
  showCapturedReference = true,
  landmarkChooser = false,
}: {
  unitId: FoundationUnitId
  state: VentilationSimulationState
  stops: readonly BreathStopId[]
  /** True on the walk, where the landmark buttons above move this figure's cursor. */
  landmarkChooser?: boolean
  /**
   * Which application this step belongs to. The reference used to be built from round 0 always,
   * so Section 1 step 10 — "A new complete breath is shown on a longer respiratory cycle" —
   * re-rendered the original 3.74 s breath and even kept the cursor the learner had left on it.
   */
  roundIndex?: 0 | 1
  /** False when the step already shows the marked reference beside its own instruction. */
  showCapturedReference?: boolean
}) {
  const content = foundationTeaching[unitId]
  const reference = useMemo(
    () => createLabSimulation(unitId, roundIndex, state.deviceId),
    [unitId, roundIndex, state.deviceId],
  )
  const marker = ventilationReferenceMarker(unitId, roundIndex)
  const readingStop = WORKED_READING_STOP[unitId]
  /*
   * On the walk the learner's landmark places the cursor. Elsewhere a step that lights several
   * stops shows the figure at the one its worked sentence reads, rather than at the first.
   */
  const figureStop =
    !landmarkChooser && readingStop !== undefined && stops.includes(readingStop)
      ? readingStop
      : stops[0]
  const figure =
    showCapturedReference &&
    (unitId === 'breathing-with-support' || unitId === 'waveform-anatomy') ? (
      <CapturedBreath
        key={`${roundIndex}:${figureStop ?? 'reference'}`}
        label={`Captured reference · Part ${roundIndex + 1}`}
        samples={reference.waveforms}
        guided
        stop={figureStop}
        marker={marker ?? undefined}
      />
    ) : null
  const cursorElsewhere =
    figure !== null &&
    readingStop !== undefined &&
    figureStop !== undefined &&
    figureStop !== readingStop
  return (
    <div data-foundation-teaching data-lesson-part="evidence" id="mv-foundation-teaching">
      <h4>Worked demonstration · {content.title}</h4>
      <p>
        <strong>This demonstration:</strong> {content.purpose}
      </p>
      <p>{content.explanation}</p>
      {!cursorElsewhere ? (
        <p data-worked-reading>{content.worked}</p>
      ) : landmarkChooser ? (
        <p data-worked-reading-stop={readingStop}>
          The worked reading for this figure is at {breathStop(readingStop!).title}; choose that
          landmark above to put the cursor there.
        </p>
      ) : null}
      {figure}
      {unitId === 'controls-and-goals' ? <SettingMap state={state} /> : null}
      {unitId === 'mechanics-load-and-pressure' ? <WorkedHold device={state.deviceId} /> : null}
      {unitId === 'modes-and-breath-delivery' ? <IdealizedComparison /> : null}
      {content.boundary ? (
        <p className={styles.quickNote} data-point-of-use-limit>
          {content.boundary}
        </p>
      ) : null}
    </div>
  )
}

/** What playback, a hold and the patient-property controls each do — for the More detail disclosure. */
export function PlaybackAndMeasurementNote() {
  return (
    <p>
      Run, Pause, step and speed control playback and elapsed simulated time. A hold is a
      measurement maneuver that occludes flow at a breath boundary. Patient compliance and
      resistance controls alter simulated patient properties; they are not bedside ventilator
      settings. The native console and educational setting shortcuts use the same patient state.
    </p>
  )
}
