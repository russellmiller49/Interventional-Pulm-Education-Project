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

export const MONITOR_BOUNDARY =
  'Scripted readings in words, against this patient’s own earlier state. Not a physiological model, and never a threshold.'

/**
 * The monitor: scripted readings in words, each with its trend against this patient's own
 * baseline. The airway view is a channel like the others — a moving picture that reports nothing
 * about the patient — which is the point the panel makes by listing it beside them.
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
        <strong>Model boundary.</strong> {MONITOR_BOUNDARY}
      </p>
    </div>
  )
}
