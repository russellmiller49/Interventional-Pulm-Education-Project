'use client'

import { formatReadout, LAB_METRICS, labReadouts, type LabMetricId } from '../../engine/labMetrics'
import { ImagingLab } from '../ImagingLab'
import { ChainAnswerFieldset } from './ChainAnswerFieldset'
import { ChainCaptionStrip } from './ChainCaptionStrip'
import styles from './suite-fallback.module.css'
import { SUITE_DOM, type ImagingSuitePaneProps } from './types'

/**
 * The simulator pane until the suite's view for a mode lands: the draft's lab body — its 2D
 * projection, its slices, its timing diagram, the current 3D anatomy scene — inside the stage's
 * lock, under the chain caption, with the chain answer fieldset when a step asks for one.
 *
 * Everything the stage needs is honoured here: the controls disable while the learner decides or
 * looks back and the pane says why, the goals are listed, the boundary sentence is printed, and
 * every change reaches the session through `onLabChange`. When Codex's `SuiteScenePane` declares
 * a mode ready, `ImagingSuitePane` stops routing that mode here.
 */
export function SuiteFallback(props: ImagingSuitePaneProps) {
  const { view, lab, onLabChange, controlsEnabled, lockedReason, pausedReason, goals } = props
  const readouts = view.lab ? labReadouts(view.lab, lab.values, view.sectionId) : {}
  const metricIds: readonly LabMetricId[] =
    view.readouts ?? (Object.keys(readouts) as LabMetricId[])
  return (
    <div
      className={styles.pane}
      {...{
        [SUITE_DOM.scene]: '',
        [SUITE_DOM.mode]: view.mode,
        [SUITE_DOM.state]: 'fallback',
        [SUITE_DOM.lit]: view.litStop ?? '',
      }}
    >
      <ChainCaptionStrip lit={view.litStop} caption={props.chainCaption} />
      {props.chainAnswer ? <ChainAnswerFieldset answer={props.chainAnswer} /> : null}
      {!controlsEnabled && (lockedReason ?? pausedReason) ? (
        <p className={styles.reason} role="status">
          {lockedReason ?? pausedReason}
        </p>
      ) : null}
      {view.lab ? (
        <fieldset className={styles.controls} disabled={!controlsEnabled} data-suite-controls>
          <ImagingLab
            lab={view.lab}
            lessonId={view.sectionId}
            values={{ ...lab.values }}
            onChange={(values) => onLabChange(values)}
          />
        </fieldset>
      ) : null}
      {view.lab && metricIds.length > 0 ? (
        <dl className={styles.readouts} aria-label="The readouts" {...{ [SUITE_DOM.readouts]: '' }}>
          {metricIds.map((metric) => (
            <div key={metric} {...{ [SUITE_DOM.readout]: metric }}>
              <dt>{LAB_METRICS[metric].label}</dt>
              <dd>{formatReadout(metric, readouts[metric])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {goals.length > 0 ? (
        <ul className={styles.goals} aria-label="What this step is waiting for" data-suite-goals>
          {goals.map(({ goal, met }) => (
            <li key={goal.label} data-met={met ? 'true' : 'false'}>
              {goal.label}
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.boundary} {...{ [SUITE_DOM.boundary]: '' }}>
        <strong>Model boundary.</strong> {view.boundary}
      </p>
      {props.children}
    </div>
  )
}
