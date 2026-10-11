'use client'

import { MCS_AF_TRIGGER_CONTAINMENT, MCS_AF_TRIGGER_LIMIT } from '../content/afTriggerLimit'
import { mcsAfTriggerComparison } from '../content/afTriggerComparison'
import type { McsSimulationState } from '../engine/types'

/**
 * All three of this model's trigger ratings at once, where a trigger is chosen.
 *
 * The disagreement MCS-03 recorded was answered, until now, one trigger at a time: a learner moved
 * the selector to arterial pressure, watched the figure rise and the alarm go, and read that as the
 * correction. Printing the three ratings together under the same settings and the same simulated
 * instant removes the sequence that made it look like a repair, and puts the checked device
 * labeling in the same block as the numbers it disagrees with.
 *
 * Presentation only. It reads live state, runs the comparison on separate copies, dispatches
 * nothing, disables nothing, recommends no trigger and grades no answer.
 */
export function McsAfTriggerComparison({ state }: { readonly state: McsSimulationState }) {
  const comparison = mcsAfTriggerComparison(state)
  if (!comparison) return null
  return (
    <details data-af-trigger-comparison open>
      <summary>{MCS_AF_TRIGGER_CONTAINMENT.comparisonLead}</summary>
      <p>{MCS_AF_TRIGGER_CONTAINMENT.comparisonScope}</p>
      <table data-af-trigger-comparison-table>
        <caption>
          Atrial fibrillation, 1:{comparison.assistRatio}, inflation {comparison.inflationOffsetMs}{' '}
          ms and deflation {comparison.deflationOffsetMs} ms, balloon{' '}
          {comparison.running ? 'running' : 'stopped'}, all three read at{' '}
          {comparison.observedAtSeconds.toFixed(2)} simulated seconds.
        </caption>
        <thead>
          <tr>
            <th scope="col">Trigger source</th>
            <th scope="col">Simulator synchrony rating</th>
            <th scope="col">Simulator trigger alarm</th>
          </tr>
        </thead>
        <tbody>
          {comparison.ratings.map((rating) => (
            <tr
              key={rating.source}
              data-af-trigger-rating={rating.source}
              data-selected={rating.selected || undefined}
            >
              <th scope="row">
                {rating.label}
                {rating.selected ? <small> · selected now</small> : null}
              </th>
              <td>{rating.synchronyPercent === null ? '—' : `${rating.synchronyPercent}%`}</td>
              <td>{rating.triggerAlarmActive ? 'Raised' : 'Quiet'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p data-af-trigger-comparison-hold>
        <strong>{MCS_AF_TRIGGER_LIMIT.heldLead}.</strong> {MCS_AF_TRIGGER_LIMIT.deviceLabeling} The
        highest figure in this table belongs to the trigger that material advises against, so do not
        read the table as a ranking. {MCS_AF_TRIGGER_LIMIT.atTheControl}
      </p>
    </details>
  )
}
