'use client'

import { useState, type Dispatch } from 'react'
import type { VentilationAction, VentilationSimulationState } from '../../engine'
import { CapturedBreath } from '../stage/CapturedBreath'
import { IdealizedComparison } from './IdealizedComparison'
import { ModelBoundary, styles } from './shared'

const traceCopy = {
  Pressure:
    'Airway pressure is measured at the airway opening in cmH₂O. Read it in relation to PEEP. During a passive, no-flow inspiratory hold, a settled plateau can estimate static end-inspiratory alveolar pressure; it does not directly sample every alveolus.',
  Flow: 'Flow is measured in L/min. Read against zero: above the line is gas going into the patient; below the line is gas coming out. The rate and direction of flow determine how breath-relative volume changes.',
  Volume:
    'Volume is measured in mL relative to the breath’s starting reference. It accumulates during inward flow and falls during outward flow. This display is not total lung volume; return to the displayed baseline cannot establish complete emptying or exclude a leak.',
}

/** The retained panel supports live dispatch only where its embedding supplies it. The stage’s
 * first five lessons use FoundationTeaching instead, with one guarded interaction location.
 */
export function VentilationWaveformAnatomy({
  state,
  dispatch,
}: {
  state: VentilationSimulationState
  dispatch?: Dispatch<VentilationAction>
}) {
  const [selected, setSelected] = useState<keyof typeof traceCopy>('Pressure')
  const [capture, setCapture] = useState(state.waveforms)
  return (
    <section className={styles.panel} aria-labelledby="mv-anatomy-teaching">
      <header className={styles.panelHeader}>
        <h2 id="mv-anatomy-teaching">Three traces, one breath</h2>
        <p>
          Connect the signals at one instant. Cursor and phase controls inspect a captured breath
          without altering the patient.
        </p>
      </header>
      <CapturedBreath label="Captured live-patient breath" samples={capture} guided />
      <button type="button" onClick={() => setCapture(state.waveforms)}>
        Capture another complete breath
      </button>
      <div className={styles.componentToggles}>
        {(Object.keys(traceCopy) as (keyof typeof traceCopy)[]).map((trace) => (
          <button
            key={trace}
            type="button"
            aria-pressed={trace === selected}
            onClick={() => setSelected(trace)}
          >
            {trace}
          </button>
        ))}
      </div>
      <p>{traceCopy[selected]}</p>
      {dispatch ? (
        <details>
          <summary>Explore simulated patient mechanics</summary>
          <p>
            These controls change the live patient model, not a ventilator setting. Changing more
            than one input no longer isolates one mechanism.
          </p>
          {(['complianceScale', 'resistanceScale'] as const).map((key) => (
            <label key={key} className={styles.complianceSlider}>
              <span>
                {key === 'complianceScale' ? 'Respiratory-system compliance' : 'Airway resistance'}{' '}
                · {state.teachingMechanics[key].toFixed(2)}× baseline
              </span>
              <input
                type="range"
                min={0.25}
                max={4}
                step={0.05}
                value={state.teachingMechanics[key]}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_TEACHING_MECHANICS',
                    overrides: { [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          <p>
            Possible causes of increased airway resistance include secretions, bronchospasm or tube
            obstruction. A multiplier does not identify a diagnosis.
          </p>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'SET_TEACHING_MECHANICS',
                overrides: { complianceScale: 1, resistanceScale: 1 },
              })
            }
          >
            Restore patient mechanics
          </button>
        </details>
      ) : (
        <p>
          Read-only patient view. Patient changes are made at the enabled controls in the simulator;
          this panel provides inspection only.
        </p>
      )}
      <details>
        <summary>Conventional VC and PC: optional idealized reference</summary>
        <IdealizedComparison />
      </details>
      <ModelBoundary>
        These captured traces come from the simulated patient. The optional idealized comparison has
        separate, fixed, authored inputs and does not operate the live patient. Passive expiration
        depends on mechanics, prior delivery, PEEP and the time available; its flow need not be
        identical in different modes.
      </ModelBoundary>
    </section>
  )
}
