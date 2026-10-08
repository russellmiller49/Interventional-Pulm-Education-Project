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

/**
 * What each badge is compared against (fellow walkthrough A40). A badge is the channel's trend
 * against this patient's own earlier state in the scripted scene — the reference the readings were
 * authored to. "Steady" is no lasting change: a brief change that has settled is told in the
 * reading's words, not in the badge. Nothing here is a number, a rate or a threshold.
 */
export const MONITOR_TREND_MEANING: Readonly<Record<MonitorTrend, string>> = {
  steady:
    'no lasting change from the earlier state; a brief change that has settled is described in the words',
  new: 'not present in the earlier state',
  rising: 'higher than the earlier state and still moving',
  falling: 'lower than the earlier state and still moving',
  lost: 'present earlier and no longer available',
}

const TREND_ORDER: readonly MonitorTrend[] = ['steady', 'new', 'rising', 'falling', 'lost']

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
      <p className={styles.boundaryLine} data-trend-legend>
        <strong>Reading the badges.</strong> Each badge compares its channel with this patient’s own
        earlier state in this scripted scene, not with a normal range:{' '}
        {TREND_ORDER.filter((trend) => readings.some((reading) => reading.trend === trend))
          .map((trend) => `${MONITOR_TREND_WORDS[trend]} — ${MONITOR_TREND_MEANING[trend]}`)
          .join('; ')}
        .
      </p>
      <p className={styles.boundaryLine} data-model-boundary>
        <strong>Model boundary.</strong> {MONITOR_BOUNDARY}
      </p>
    </div>
  )
}
