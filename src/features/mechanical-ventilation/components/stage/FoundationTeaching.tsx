'use client'

import { useMemo } from 'react'
import { foundationTeaching, type FoundationUnitId } from '../../content/foundations'
import { ventilationSectionSpec } from '../../content/sectionSpecs'
import { getVentilatorDeviceProfile } from '../../content/deviceProfiles'
import { createLabSimulation } from '../../engine/learningLab'
import { advanceSimulation, HOLD_SECONDS } from '../../engine/simulation'
import { ventilationSimulationReducer } from '../../engine/reducer'
import { plateauReadingValidity } from '../../content/plateauValidity'
import { plateauAcquisition } from '../../content/plateauAcquisition'
import { ventilationReferenceMarker } from '../../content/referenceEvidence'
import type { VentilationSimulationState } from '../../engine/types'
import type { VentilationStageStep } from '../../content/stageLessons'
import type { BreathStopId } from '../../content/breathSpine'
import { IdealizedComparison } from '../teaching/IdealizedComparison'
import { CapturedBreath } from './CapturedBreath'
import styles from './ventilation-stage.module.css'

function SettingMap({ state }: { state: VentilationSimulationState }) {
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
function WorkedHold({ device }: { device: VentilationSimulationState['deviceId'] }) {
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
        elastic pressure a little. They are an unoccluded estimate and a timed hold, not one
        measurement reported twice, and they are left as the two numbers the model produces. Whether
        the modeled relaxation matches a real patient&rsquo;s is a clinical question this module has
        not had reviewed.
      </p>
      <CapturedBreath
        label="Captured reference: delivered breath and inspiratory hold"
        samples={reference.held.waveforms.filter((s) => s.time >= -1)}
        whole={false}
      />
    </div>
  )
}

export function FoundationTeaching({
  unitId,
  step,
  state,
  stops,
  roundIndex = 0,
  showCapturedReference = true,
  onShowControl,
}: {
  unitId: FoundationUnitId
  step: VentilationStageStep
  state: VentilationSimulationState
  stops: readonly BreathStopId[]
  /**
   * Which application this step belongs to. The reference used to be built from round 0 always,
   * so Section 1 step 10 — "A new complete breath is shown on a longer respiratory cycle" —
   * re-rendered the original 3.74 s breath and even kept the cursor the learner had left on it.
   */
  roundIndex?: 0 | 1
  /** False when the step already shows the marked reference beside its own instruction. */
  showCapturedReference?: boolean
  onShowControl?: () => void
}) {
  const content = foundationTeaching[unitId]
  const reference = useMemo(
    () => createLabSimulation(unitId, roundIndex, state.deviceId),
    [unitId, roundIndex, state.deviceId],
  )
  const marker = ventilationReferenceMarker(unitId, roundIndex)
  const worked =
    step.phase === 'recognize' ||
    ['prediction', 'sort', 'interpret'].includes(step.interaction.kind)
  if (!worked && step.interaction.kind !== 'explain')
    return (
      <section
        className={styles.block}
        data-teaching-block="guide"
        data-maneuver={step.guide?.maneuver}
      >
        <h2>
          {unitId === 'mechanics-load-and-pressure' || unitId === 'modes-and-breath-delivery'
            ? 'Change one simulated patient property'
            : 'Perform and observe this experiment'}
        </h2>
        <p>{step.guide?.look}</p>
        <p>{step.guide?.note}</p>
        {onShowControl ? (
          <button type="button" className={styles.toolButton} onClick={onShowControl}>
            Show the active control
          </button>
        ) : null}
        <p>
          Read the recorded baseline and result before explaining the response. An unchanged
          measurement can be informative.
        </p>
      </section>
    )
  return (
    <section
      className={styles.block}
      data-foundation-teaching
      data-teaching-block="method"
      id="mv-foundation-teaching"
      tabIndex={-1}
    >
      <p className={styles.kicker}>
        {worked ? 'Learn the concept · worked demonstration' : 'Review the mechanism'}
      </p>
      <h2>{content.title}</h2>
      <p>
        <strong>By the end:</strong> {content.purpose}
      </p>
      <p>{content.explanation}</p>
      {showCapturedReference &&
      (unitId === 'breathing-with-support' || unitId === 'waveform-anatomy') ? (
        <CapturedBreath
          key={`${roundIndex}:${stops[0] ?? 'reference'}`}
          label={`Captured reference · application ${roundIndex + 1}`}
          samples={reference.waveforms}
          guided
          stop={stops[0]}
          marker={marker ?? undefined}
        />
      ) : null}
      {unitId === 'controls-and-goals' ? <SettingMap state={state} /> : null}
      {unitId === 'mechanics-load-and-pressure' ? <WorkedHold device={state.deviceId} /> : null}
      {unitId === 'modes-and-breath-delivery' ? <IdealizedComparison /> : null}
      <p>{content.worked}</p>
      <p className={styles.quickNote}>{content.boundary}</p>
      {unitId === 'breathing-with-support' ? (
        <details data-teaching-block="orientation">
          <summary>Why a ventilator exists</summary>
          {ventilationSectionSpec(unitId).orientation?.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </details>
      ) : null}
      <details>
        <summary>Playback, patient properties and measurements</summary>
        <p>
          Run, Pause, step and speed control playback and elapsed simulated time. A hold is a
          measurement maneuver that occludes flow at a breath boundary. Patient compliance and
          resistance controls alter simulated patient properties; they are not bedside ventilator
          settings. The native console and educational setting shortcuts use the same patient state.
        </p>
      </details>
    </section>
  )
}
