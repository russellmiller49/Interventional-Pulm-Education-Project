'use client'

/**
 * Section 7 — Ventilation: measured response over time.
 *
 * The lesson's discipline is "observe delivery before interpreting delayed gas exchange". So the
 * figure is one time axis with two tiers on it: the delivery signals, which move on the next
 * breath, and the gas-exchange signals, which move over minutes. Reading the lower tier before the
 * upper one has settled is the error the section exists to prevent.
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

type Tier = 'delivery' | 'exchange'

const tierCopy: Readonly<
  Record<Tier, { readonly label: string; readonly when: string; readonly body: string }>
> = {
  delivery: {
    label: 'Delivery',
    when: 'Changes on the next breath',
    body: 'What the ventilator is moving in and out of the chest. It responds to a setting change immediately and it is measured directly, so it is the tier that tells you whether your change actually happened. If delivery did not move, nothing downstream will, and the question is mechanical rather than physiological.',
  },
  exchange: {
    label: 'Gas exchange',
    when: 'Changes over minutes',
    body: 'What the delivered ventilation did to carbon dioxide and pH. It lags delivery by the time it takes the body’s stores to re-equilibrate, so an unchanged value shortly after an adjustment is uninformative rather than reassuring. Judging a change here too early is how a working adjustment gets reversed.',
  },
}

function trendSeriesPath(
  trends: readonly TrendSample[],
  field: keyof TrendSample,
  width = 300,
  height = 46,
): string {
  const window = trends.slice(-Math.min(trends.length, 60))
  if (window.length < 2) return ''
  const values = window.map((sample) => sample[field] as number)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = Math.max(0.5, maximum - minimum)
  return window
    .map((sample, index) => {
      const x = (index / (window.length - 1)) * width
      const y = height - ((values[index] - minimum) / span) * (height - 8) - 4
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export function VentilationCo2Response({ state }: { readonly state: VentilationSimulationState }) {
  const [selected, setSelected] = useState<Tier>('delivery')
  const { measurements, patient, trends } = state

  const window = trends.slice(-Math.min(trends.length, 30))
  const co2Delta =
    window.length >= 2 ? (window.at(-1)?.paCO2MmHg ?? 0) - (window[0]?.paCO2MmHg ?? 0) : 0
  const co2Trend = direction(co2Delta, 0.5)
  const hasTrend = window.length >= 2

  const deliveryRows = [
    {
      id: 'minute',
      label: 'Minute ventilation',
      value: `${round(measurements.minuteVentilationLMin, 1)} L/min`,
    },
    { id: 'vt', label: 'Exhaled tidal volume', value: `${round(measurements.exhaledVtMl)} mL` },
    { id: 'rate', label: 'Total rate', value: `${round(measurements.totalRatePerMin)} /min` },
    {
      id: 'deadspace',
      label: 'Dead-space fraction',
      value: `${round(patient.gasExchange.deadSpaceFraction * 100)} %`,
    },
  ]

  const exchangeRows = [
    { id: 'paco2', label: 'Arterial CO₂', value: `${round(patient.gasExchange.paCO2MmHg)} mmHg` },
    { id: 'ph', label: 'pH', value: round(patient.gasExchange.pH, 2).toFixed(2) },
    {
      id: 'bicarb',
      label: 'Bicarbonate',
      value: `${round(patient.gasExchange.bicarbonateMmolL, 1)} mmol/L`,
    },
    {
      id: 'production',
      label: 'CO₂ production',
      value: `${round(patient.gasExchange.co2ProductionMlMin)} mL/min`,
    },
  ]

  const co2Path = trendSeriesPath(trends, 'paCO2MmHg')

  const summary = `Delivery right now: minute ventilation ${round(measurements.minuteVentilationLMin, 1)} litres per minute from an exhaled tidal volume of ${round(measurements.exhaledVtMl)} millilitres at ${round(measurements.totalRatePerMin)} breaths per minute, against a dead-space fraction of ${round(patient.gasExchange.deadSpaceFraction * 100)} percent. Gas exchange: arterial carbon dioxide ${round(patient.gasExchange.paCO2MmHg)} millimetres of mercury, ${hasTrend ? directionWord[co2Trend] : 'with no trend history yet'}, at a pH of ${round(patient.gasExchange.pH, 2).toFixed(2)}, with carbon dioxide production ${round(patient.gasExchange.co2ProductionMlMin)} millilitres per minute. The selected tier is ${tierCopy[selected].label}.`

  return (
    <section className={styles.panel} aria-labelledby="mv-ventilation-teaching">
      <header className={styles.panelHeader}>
        <span>Response over time</span>
        <h2 id="mv-ventilation-teaching">Two tiers, two clocks</h2>
        <p>
          Delivery answers on the next breath. Gas exchange answers over minutes. Reading the second
          before the first has settled is how a change that worked gets judged a failure.
        </p>
      </header>

      <figure className={styles.figure}>
        <div className={styles.tierStack} role="img" aria-label={summary}>
          <div className={styles.tier} data-tier="delivery" data-active={selected === 'delivery'}>
            <h3>
              Delivery <small>changes on the next breath</small>
            </h3>
            <div className={styles.tierRows}>
              {deliveryRows.map((row) => (
                <div key={row.id} className={styles.tradeoffRow}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.tierArrow} aria-hidden="true">
            <span>then, over minutes</span>
          </div>

          <div className={styles.tier} data-tier="exchange" data-active={selected === 'exchange'}>
            <h3>
              Gas exchange <small>changes over minutes</small>
            </h3>
            <div className={styles.tierRows}>
              {exchangeRows.map((row) => (
                <div key={row.id} className={styles.tradeoffRow}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            {co2Path ? (
              <svg className={styles.tierSpark} viewBox="0 0 300 46" aria-hidden="true">
                <path className={styles.trace} d={co2Path} />
              </svg>
            ) : null}
            <p className={styles.tierNote}>
              {hasTrend
                ? `Arterial CO₂ is ${directionWord[co2Trend]} ${directionGlyph[co2Trend]} across the recent trend window.`
                : 'No trend history yet — advance the case before reading a direction here.'}
            </p>
          </div>
        </div>
        <figcaption>
          The upper tier is measured at the airway and moves at once. The lower tier is the body’s
          response and lags it. The spark line is the recent arterial CO₂ trend.
        </figcaption>
      </figure>

      <div className={styles.componentToggles}>
        {(['delivery', 'exchange'] as const).map((tier) => (
          <button
            key={tier}
            type="button"
            aria-pressed={selected === tier}
            onClick={() => setSelected(tier)}
          >
            {tierCopy[tier].label}
          </button>
        ))}
      </div>

      <div className={styles.stepDetail}>
        <span>{tierCopy[selected].when}</span>
        <p>{tierCopy[selected].body}</p>
      </div>

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        The lag between the two tiers is a modeled equilibration, not a validated pharmacokinetic
        timing. No target carbon dioxide tension or pH is stated: what counts as adequate depends on
        the condition being treated, and belongs to this module’s pending source reconciliation.
      </ModelBoundary>
    </section>
  )
}
