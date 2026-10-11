'use client'

import type { MonitorChannel, MonitorReading, MonitorTrend } from '../../content/types'
import styles from './bronch-stage.module.css'

/** The channel names the panel prints; the same words the Teaching panel uses for the patient. */
export const MONITOR_CHANNEL_WORDS: Readonly<Record<MonitorChannel, string>> = {
  responsiveness: 'Responsiveness',
  'respiratory-effort': 'Respiratory effort',
  airflow: 'Airflow',
  oximetry: 'Oximetry',
  capnography: 'Capnography',
  'heart-rate': 'Heart rate',
  'blood-pressure': 'Blood pressure',
  'peak-pressure': 'Peak airway pressure',
  'exhaled-volume': 'Exhaled volume',
  'airway-view': 'Airway view',
}

export const MONITOR_TREND_WORDS: Readonly<Record<MonitorTrend, string>> = {
  steady: 'steady',
  rising: 'rising',
  falling: 'falling',
  lost: 'lost',
  new: 'new',
}

/** The one line under the monitor. A case's values are written for it, not computed. */
export const MONITOR_BOUNDARY = 'Teaching case. The values are written for this case.'

/** A reading's number as the monitor shows it: "91 %", "118/72 mmHg". */
export function readingValue(reading: MonitorReading): string | null {
  if (reading.value === undefined) return null
  return reading.unit === '%'
    ? `${reading.value}%`
    : `${reading.value} ${reading.unit ?? ''}`.trim()
}

/**
 * The monitor in a teaching case: each channel with its number where it has one, what it means in
 * words, and its trend against this patient's own baseline. The airway view is a channel like the
 * others, listed beside them because a clear picture says nothing about the patient.
 */
export function MonitorPanel({
  readings,
  caption,
}: {
  readonly readings: readonly MonitorReading[]
  readonly caption: string
}) {
  return (
    <div className={styles.workspace} data-monitor-workspace>
      <p className={styles.caption} data-workspace-caption>
        {caption}
      </p>
      <dl className={styles.monitor} aria-label="The monitor" data-monitor>
        {readings.map((reading) => (
          <div key={reading.channel} data-monitor-channel={reading.channel}>
            <dt>{MONITOR_CHANNEL_WORDS[reading.channel]}</dt>
            {readingValue(reading) ? (
              <dd className={styles.monitorValue} data-monitor-value>
                {readingValue(reading)}
              </dd>
            ) : null}
            <dd>{reading.words}</dd>
            <dd>
              <span className={styles.trend} data-trend={reading.trend}>
                {MONITOR_TREND_WORDS[reading.trend]}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.boundaryLine} data-model-boundary>
        {MONITOR_BOUNDARY}
      </p>
    </div>
  )
}
