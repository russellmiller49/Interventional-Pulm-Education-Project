'use client'

import { useMemo } from 'react'
import { foundationTeaching, type FoundationUnitId } from '../../content/foundations'
import { ventilationSectionSpec } from '../../content/sectionSpecs'
import { getVentilatorDeviceProfile } from '../../content/deviceProfiles'
import { createLabSimulation } from '../../engine/learningLab'
import { advanceSimulation } from '../../engine/simulation'
import { ventilationSimulationReducer } from '../../engine/reducer'
import { plateauReadingValidity } from '../../content/plateauValidity'
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

/** Static worked reference from the actual engine. Never dispatched into the learner's session. */
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
  return (
    <div data-worked-hold>
      <p>
        <strong>
          Worked reference hold · actual simulated maneuver · separate from your patient
        </strong>
      </p>
      <p>
        Flowing peak {reference.baseline.measurements.peakPressureCmH2O.toFixed(1)} cmH₂O; plateau
        during the reference hold {reference.held.measurements.plateauPressureCmH2O.toFixed(1)}{' '}
        cmH₂O. {valid.interpretable ? 'Recent effort is absent in this reference.' : valid.reason}
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
  onShowControl,
}: {
  unitId: FoundationUnitId
  step: VentilationStageStep
  state: VentilationSimulationState
  stops: readonly BreathStopId[]
  onShowControl?: () => void
}) {
  const content = foundationTeaching[unitId]
  const reference = useMemo(
    () => createLabSimulation(unitId, 0, state.deviceId),
    [unitId, state.deviceId],
  )
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
      {unitId === 'breathing-with-support' || unitId === 'waveform-anatomy' ? (
        <CapturedBreath
          key={stops[0] ?? 'reference'}
          label="Captured reference · complete engine-generated breath"
          samples={reference.waveforms}
          guided
          stop={stops[0]}
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
