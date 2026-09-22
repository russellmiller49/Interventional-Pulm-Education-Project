'use client'

/**
 * Section 8 — Ventilation: measured response over time.
 *
 * The lesson's discipline is "observe delivery before interpreting delayed gas exchange". So the
 * figure is one time axis with two tiers on it: the delivery signals, which move on the next
 * breath, and the gas-exchange signals, which move over minutes. Reading the lower tier before the
 * upper one has settled is the error the section exists to prevent.
 */
import { useState } from 'react'

import type { TrendSample, VentilationSimulationState } from '../../engine'
import { exhaledVolumeReading } from '../../content/measurementReadiness'
import {
  ModelBoundary,
  TextEquivalent,
  direction,
  directionGlyph,
  directionWord,
  round,
  styles,
  trendWindow,
  trendWindowLabel,
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

  const window = trendWindow(trends)
  const co2Delta =
    window.samples.length >= 2
      ? (window.samples.at(-1)?.paCO2MmHg ?? 0) - (window.samples[0]?.paCO2MmHg ?? 0)
      : 0
  const co2Trend = direction(co2Delta, 0.5)
  const hasTrend = window.samples.length >= 2
  const volume = exhaledVolumeReading(state)
  const reference = state.physiologyReference

  const deliveryRows = [
    {
      id: 'minute',
      label: 'Minute ventilation',
      value:
        volume.minuteVentilationLMin === null
          ? 'Awaiting a completed breath'
          : `${round(volume.minuteVentilationLMin, 1)} L/min`,
    },
    {
      id: 'vt',
      label: 'Exhaled tidal volume',
      value:
        volume.exhaledVtMl === null
          ? 'Awaiting a completed breath'
          : `${round(volume.exhaledVtMl)} mL`,
    },
    { id: 'rate', label: 'Total rate', value: `${round(measurements.totalRatePerMin)} /min` },
  ]

  const exchangeRows = [
    { id: 'paco2', label: 'Arterial CO₂', value: `${round(patient.gasExchange.paCO2MmHg)} mmHg` },
    { id: 'ph', label: 'pH', value: round(patient.gasExchange.pH, 2).toFixed(2) },
    {
      id: 'bicarb',
      label: 'Bicarbonate',
      value: `${round(patient.gasExchange.bicarbonateMmolL, 1)} mmol/L`,
    },
  ]

  const co2Path = trendSeriesPath(trends, 'paCO2MmHg')

  const deliveryText =
    volume.minuteVentilationLMin === null
      ? 'Delivery right now: no completed breath on the trace yet, so no exhaled volume or minute ventilation is reported'
      : `Delivery right now: minute ventilation ${round(volume.minuteVentilationLMin, 1)} litres per minute from an exhaled tidal volume of ${round(volume.exhaledVtMl ?? 0)} millilitres at ${round(measurements.totalRatePerMin)} breaths per minute`
  const summary = `${deliveryText}. Gas exchange: arterial carbon dioxide ${round(patient.gasExchange.paCO2MmHg)} millimetres of mercury, ${hasTrend ? `${directionWord[co2Trend]} over the last ${window.samples.length} simulated seconds (${trendWindowLabel(window)})` : 'with no trend history yet'}, at a pH of ${round(patient.gasExchange.pH, 2).toFixed(2)}. In this model arterial CO₂ follows delivered minute ventilation from this patient’s own starting point — ${round(reference.paCO2MmHg)} millimetres of mercury at ${round(reference.minuteVentilationLMin, 1)} litres per minute. The selected tier is ${tierCopy[selected].label}.`

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
                ? `Arterial CO₂ is ${directionWord[co2Trend]} ${directionGlyph[co2Trend]} over the last ${window.samples.length} simulated seconds (${trendWindowLabel(window)}).`
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

      {/*
       * S10-1. The delivery tier used to list a dead-space fraction beside minute ventilation and the
       * exchange tier a CO₂ production, which invites the alveolar-ventilation calculation — and a
       * fellow who did it got 36 mmHg against the 40 on screen. The model never reads either
       * field. What it does compute is stated here instead, with this patient's own anchor, and
       * the two descriptors are named as what they are.
       */}
      <div className={styles.stepDetail} data-co2-model>
        <span>How this simulator computes arterial CO₂</span>
        <p>
          Arterial CO₂ moves in inverse proportion to the minute ventilation actually delivered,
          starting from this patient’s own values when the case opened ({round(reference.paCO2MmHg)}{' '}
          mmHg at {round(reference.minuteVentilationLMin, 1)} L/min). Halve the delivered
          ventilation and it heads toward twice that value; double it and it heads toward half. That
          is the alveolar-ventilation relationship with CO₂ production and the dead-space fraction
          both held at their starting values — so it explains the direction and the proportion here,
          but it is not computed from them, and working the equation from the case’s dead-space
          fraction and CO₂ production will not reproduce the number on screen.
        </p>
        <p>
          Minute ventilation is not alveolar ventilation. A change that alters the dead-space
          fraction — rapid shallow breathing, for example — is not represented, so this model treats
          every litre of delivered ventilation alike. The case also records a dead-space fraction of{' '}
          {round(patient.gasExchange.deadSpaceFraction * 100)} % and a CO₂ production of{' '}
          {round(patient.gasExchange.co2ProductionMlMin)} mL/min as descriptors; the CO₂ calculation
          does not use them.
        </p>
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
