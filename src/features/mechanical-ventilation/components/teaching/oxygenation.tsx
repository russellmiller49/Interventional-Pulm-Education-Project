'use client'

/**
 * Section 7 — Oxygenation: action and consequence.
 *
 * The live patient view accompanies the separate MV-02 matched replay. It reports oxygenation,
 * pressure and circulation together, without implying that an uncontrolled trend establishes
 * causation or that a waveform estimate is an acquired passive plateau.
 */
import { useState } from 'react'

import type { TrendSample, VentilationSimulationState } from '../../engine'
import { peepComparisonSnapshot } from '../../engine/peepComparison'
import {
  ModelBoundary,
  TextEquivalent,
  direction,
  directionGlyph,
  directionWord,
  round,
  styles,
} from './shared'

type Lever = 'fio2' | 'peep' | 'mean-pressure'

const leverCopy: Readonly<
  Record<
    Lever,
    {
      readonly label: string
      readonly buys: string
      readonly costs: string
      readonly limitedBy: string
    }
  >
> = {
  fio2: {
    label: 'Inspired oxygen',
    buys: 'In this model, increasing FiO₂ raises the oxygenation target without directly changing respiratory mechanics.',
    costs:
      'This comparison does not model the longer-term risks of oxygen exposure. Better saturation alone does not establish that the cause of hypoxemia has improved.',
    limitedBy:
      'The authored shunt fraction and oxygenation response. FiO₂ does not change the shunt fraction in this example.',
  },
  peep: {
    label: 'Baseline pressure',
    buys: 'The MV-01 case represents recruitment by assigning a lower shunt fraction and higher compliance within a specified PEEP range.',
    costs:
      'The higher-PEEP state assigns lower compliance and lower arterial pressure. Read the actual pressure, delivered volume and circulatory response together.',
    limitedBy:
      'These discrete case states do not measure recruitment or identify an individual patient’s best PEEP. Quantitative interpretation remains subject to faculty review.',
  },
  'mean-pressure': {
    label: 'Mean airway pressure',
    buys: 'Mean airway pressure summarizes pressure across the breath. It is a reported value, not an independent setting.',
    costs:
      'Timing changes can alter expiratory time and delivery. They would add another variable to this PEEP comparison.',
    limitedBy:
      'The current gas-exchange calculation uses FiO₂, PEEP and shunt; it does not independently model an oxygenation benefit from longer inspiration.',
  },
}

function trendDelta(trends: readonly TrendSample[], field: keyof TrendSample): number {
  if (trends.length < 2) return 0
  const window = trends.slice(-Math.min(trends.length, 30))
  return (window.at(-1)?.[field] ?? 0) - (window[0]?.[field] ?? 0)
}

export function VentilationOxygenationTradeoff({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [selected, setSelected] = useState<Lever | null>(null)
  const { measurements, patient, trends, ventilator } = state
  const reading = peepComparisonSnapshot(state)
  const plateauLabel =
    reading.plateauSource === 'active occlusion' ? 'Active occlusion pressure' : 'Plateau estimate'

  const spo2Delta = trendDelta(trends, 'spo2Percent')
  const mapDelta = trendDelta(trends, 'mapMmHg')
  const plateauDelta = trendDelta(trends, 'plateauPressureCmH2O')
  const trappedDelta = trendDelta(trends, 'intrinsicPeepCmH2O')

  const benefitRows = [
    {
      id: 'spo2',
      label: 'Oxygen saturation',
      value: `${round(patient.gasExchange.spo2Percent)} %`,
      trend: direction(spo2Delta, 0.5),
    },
    {
      id: 'pao2',
      label: 'Arterial oxygen tension',
      value: `${round(patient.gasExchange.paO2MmHg)} mmHg`,
      trend: null,
    },
    {
      id: 'shunt',
      label: 'Model-assigned shunt fraction',
      value: `${round(patient.gasExchange.shuntFraction * 100)} %`,
      trend: null,
    },
  ]

  const costRows = [
    {
      id: 'mean',
      label: 'Mean airway pressure',
      value: `${round(measurements.meanAirwayPressureCmH2O, 1)} cmH₂O`,
      trend: null,
    },
    {
      id: 'plateau',
      label: plateauLabel,
      value:
        measurements.plateauPressureCmH2O > 0
          ? `${round(measurements.plateauPressureCmH2O, 1)} cmH₂O`
          : 'Unavailable',
      trend: direction(plateauDelta, 0.5),
    },
    {
      id: 'map',
      label: 'Mean arterial pressure',
      value: `${round(patient.hemodynamics.mapMmHg)} mmHg`,
      trend: direction(mapDelta, 1),
    },
    {
      id: 'trapped',
      label: 'Intrinsic PEEP estimate',
      value: `${round(measurements.intrinsicPeepCmH2O, 1)} cmH₂O`,
      trend: direction(trappedDelta, 0.3),
    },
  ]

  const summary = `Over the recent trend window, oxygen saturation is ${round(patient.gasExchange.spo2Percent)} percent and ${directionWord[direction(spo2Delta, 0.5)]}, with modeled arterial oxygen tension ${round(patient.gasExchange.paO2MmHg)} millimetres of mercury and model-assigned shunt ${round(patient.gasExchange.shuntFraction * 100)} percent. Mean airway pressure is ${round(measurements.meanAirwayPressureCmH2O, 1)} centimetres of water, ${plateauLabel.toLowerCase()} ${round(measurements.plateauPressureCmH2O, 1)}, mean arterial pressure ${round(patient.hemodynamics.mapMmHg)} millimetres of mercury and ${directionWord[direction(mapDelta, 1)]}, and intrinsic PEEP estimate ${round(measurements.intrinsicPeepCmH2O, 1)}. PEEP is ${round(ventilator.settings.peepCmH2O, 1)} and inspired oxygen ${round(ventilator.settings.oxygenPercent)} percent. ${reading.passiveInterpretationSupported ? 'Recent effort is absent; an estimate alone is not an acquired hold.' : 'Patient effort makes this pressure unsuitable for passive mechanics interpretation.'}${selected ? ` The selected lever is ${leverCopy[selected].label}.` : ''}`

  return (
    <section className={styles.panel} aria-labelledby="mv-oxygenation-teaching">
      <header className={styles.panelHeader}>
        <span>Action and consequence</span>
        <h2 id="mv-oxygenation-teaching">What it buys, and what it costs</h2>
        <p>
          Every oxygenation action is a trade. Reading only the left column is how a saturation
          improves while the patient gets worse — so both columns are shown at once, always.
        </p>
      </header>

      <figure className={styles.figure}>
        <div className={styles.tradeoffColumns} role="img" aria-label={summary}>
          <div className={styles.tradeoffColumn} data-side="benefit">
            <h3>What it buys</h3>
            {benefitRows.map((row) => (
              <div key={row.id} className={styles.tradeoffRow}>
                <span>{row.label}</span>
                <strong>
                  {row.value}{' '}
                  {row.trend ? (
                    <em data-trend={row.trend} aria-hidden="true">
                      {directionGlyph[row.trend]}
                    </em>
                  ) : null}
                </strong>
              </div>
            ))}
          </div>
          <div className={styles.tradeoffColumn} data-side="cost">
            <h3>What it costs</h3>
            {costRows.map((row) => (
              <div key={row.id} className={styles.tradeoffRow}>
                <span>{row.label}</span>
                <strong>
                  {row.value}{' '}
                  {row.trend ? (
                    <em data-trend={row.trend} aria-hidden="true">
                      {directionGlyph[row.trend]}
                    </em>
                  ) : null}
                </strong>
              </div>
            ))}
          </div>
        </div>
        <figcaption>
          Both columns report your live patient. Arrows use that reading’s own recorded trend;
          values without a recorded trend have no arrow. These trends have no matched control.
        </figcaption>
      </figure>

      <div className={styles.candidates} role="group" aria-label="Oxygenation levers">
        {(['fio2', 'peep', 'mean-pressure'] as const).map((lever) => (
          <button
            key={lever}
            type="button"
            aria-pressed={selected === lever}
            onClick={() => setSelected((current) => (current === lever ? null : lever))}
          >
            {leverCopy[lever].label}
          </button>
        ))}
      </div>

      {selected ? (
        <div className={styles.stepDetail}>
          <span>What it buys</span>
          <p>{leverCopy[selected].buys}</p>
          <span>What it costs</span>
          <p>{leverCopy[selected].costs}</p>
          <span>What limits it</span>
          <p>{leverCopy[selected].limitedBy}</p>
        </div>
      ) : (
        <div className={styles.stepDetail}>
          <span>Before choosing a lever</span>
          <p>
            Read oxygenation alongside pressure, delivery and MAP. You can inspect these signals
            without making a prediction. Use the separate matched example to distinguish a PEEP
            response from change during waiting.
          </p>
        </div>
      )}

      <TextEquivalent>{summary}</TextEquivalent>
      <p>
        Model-assigned compliance: {round(reading.modelCompliance)} mL/cm H₂O. This is not static
        compliance acquired from a hold.
      </p>
      <ModelBoundary>
        Gas exchange, shunt, and the haemodynamic response come from the bounded educational model.
        No target saturation, oxygen tension, or pressure limit is stated here — those belong to
        this module’s source reconciliation, to the evidence for the specific condition, and to
        local policy.
      </ModelBoundary>
    </section>
  )
}
