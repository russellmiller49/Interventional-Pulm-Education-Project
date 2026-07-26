'use client'

/**
 * Section 6 — Oxygenation: action and consequence.
 *
 * The lesson asks the learner to predict a benefit *and* a safety consequence, so the panel is
 * built as two facing columns over the same trend window: what the action is meant to buy, and
 * what it costs. Selecting a lever states what it moves on each side and what limits it — never
 * a target value, because those belong to the pending source reconciliation.
 */
import { useState } from 'react'

import type { TrendSample, VentilationSimulationState } from '../../engine'
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
    buys: 'A higher alveolar oxygen tension in every unit that is still ventilated. It works fastest and is the least mechanically disruptive of the three.',
    costs:
      'Nothing mechanical or haemodynamic in the short run — which is exactly why it is easy to leave high. Its cost is that it treats the number while leaving the reason for the shunt untouched.',
    limitedBy:
      'How much of the hypoxaemia is shunt rather than low ventilation-perfusion matching. Shunt is, by definition, the part oxygen alone does not reach.',
  },
  peep: {
    label: 'Baseline pressure',
    buys: 'Alveoli held open through expiration, so gas exchange happens in units that were previously collapsing between breaths. It works on the cause of shunt rather than around it.',
    costs:
      'Every pressure in the breath rises with it, and the raised intrathoracic pressure reduces venous return. Units that were already open are distended further without being recruited.',
    limitedBy:
      'Whether the lung has recruitable units at all, and what the circulation will tolerate. Both limits are read from the response, not predicted from the setting.',
  },
  'mean-pressure': {
    label: 'Mean airway pressure',
    buys: 'The time-weighted pressure the lung is held at across the whole cycle — the quantity oxygenation actually tracks. Longer inspiration raises it without raising the peak.',
    costs:
      'The same haemodynamic burden as baseline pressure, arriving by a different route, plus a shortened expiratory time that can leave the previous breath incompletely emptied.',
    limitedBy:
      'The expiratory limb. Any change that buys mean pressure by taking time from expiration has to be checked against whether expiratory flow still reaches zero.',
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
      trend: direction(spo2Delta, 0.5),
    },
    {
      id: 'shunt',
      label: 'Shunt fraction',
      value: `${round(patient.gasExchange.shuntFraction * 100)} %`,
      trend: 'flat' as const,
    },
  ]

  const costRows = [
    {
      id: 'mean',
      label: 'Mean airway pressure',
      value: `${round(measurements.meanAirwayPressureCmH2O, 1)} cmH₂O`,
      trend: direction(plateauDelta, 0.5),
    },
    {
      id: 'plateau',
      label: 'Plateau pressure',
      value:
        measurements.plateauPressureCmH2O > 0
          ? `${round(measurements.plateauPressureCmH2O, 1)} cmH₂O`
          : 'Not measured',
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
      label: 'Trapped pressure',
      value: `${round(measurements.intrinsicPeepCmH2O, 1)} cmH₂O`,
      trend: direction(trappedDelta, 0.3),
    },
  ]

  const summary = `Over the recent trend window, oxygen saturation is ${round(patient.gasExchange.spo2Percent)} percent and ${directionWord[direction(spo2Delta, 0.5)]}, with an arterial oxygen tension of ${round(patient.gasExchange.paO2MmHg)} millimetres of mercury and a shunt fraction of ${round(patient.gasExchange.shuntFraction * 100)} percent. Against that, mean airway pressure is ${round(measurements.meanAirwayPressureCmH2O, 1)} centimetres of water, plateau ${measurements.plateauPressureCmH2O > 0 ? round(measurements.plateauPressureCmH2O, 1) : 'not measured'}, mean arterial pressure ${round(patient.hemodynamics.mapMmHg)} millimetres of mercury and ${directionWord[direction(mapDelta, 1)]}, and trapped pressure ${round(measurements.intrinsicPeepCmH2O, 1)}. Baseline pressure is set to ${round(ventilator.settings.peepCmH2O, 1)} and inspired oxygen to ${round(ventilator.settings.oxygenPercent)} percent.${selected ? ` The selected lever is ${leverCopy[selected].label}.` : ''}`

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
                  <em data-trend={row.trend} aria-hidden="true">
                    {directionGlyph[row.trend]}
                  </em>
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
                  <em data-trend={row.trend} aria-hidden="true">
                    {directionGlyph[row.trend]}
                  </em>
                </strong>
              </div>
            ))}
          </div>
        </div>
        <figcaption>
          Both columns are live. The arrow beside each value is its direction over the recent trend
          window, not a judgement about whether the value is acceptable.
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
            Commit to both halves of the prediction: the direction you expect on the left, and the
            signal on the right that would tell you to stop. A prediction with only a benefit in it
            cannot be wrong in a useful way.
          </p>
        </div>
      )}

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        Gas exchange, shunt, and the haemodynamic response come from the bounded educational model.
        No target saturation, oxygen tension, or pressure limit is stated here — those belong to
        this module’s source reconciliation, to the evidence for the specific condition, and to
        local policy.
      </ModelBoundary>
    </section>
  )
}
