'use client'

import { mcsAnatomyTargets, type McsAnatomyTargetId } from '../content/primarySurfaces'
import type { McsSimulationState } from '../engine'
import styles from './mechanical-circulatory-support.module.css'

interface PathwayRow {
  readonly targetId: McsAnatomyTargetId
  readonly component: string
  readonly bloodEntersFrom: string
  readonly bloodReturnsTo: string
  readonly status: string
  readonly running: boolean
}

/**
 * Source, active component, destination — one row per pathway the current mechanism can carry.
 *
 * Every row the topology *can* have is rendered, running or not, for two reasons. A learner asked to
 * say where a right-sided pump returns blood has to be able to read that before switching it on; and
 * a Learn section whose primary target is a pathway would otherwise be pointing at a region that
 * does not exist until the learner has already done the thing the section is teaching.
 */
function pathwayRows(state: McsSimulationState): readonly PathwayRow[] {
  if (state.device.kind === 'iabp') {
    return [
      {
        targetId: 'anatomy:iabp-balloon-in-descending-aorta',
        component: 'Balloon in the descending thoracic aorta',
        bloodEntersFrom: 'Nothing enters it',
        bloodReturnsTo: 'Nothing returns from it',
        status: state.device.running
          ? `Inflating in diastole · 1:${state.device.assistRatio}`
          : 'Paused',
        running: state.device.running,
      },
    ]
  }
  if (state.device.kind === 'lvad') {
    return [
      {
        targetId: 'anatomy:lvad-apical-inflow-and-aortic-outflow',
        component: 'Implanted continuous-flow pump',
        bloodEntersFrom: 'Left ventricular apex',
        bloodReturnsTo: 'Ascending aorta, through the outflow graft',
        status: state.device.powerConnected
          ? `Running at ${state.device.speedRpm} rpm`
          : 'External power path lost',
        running: state.device.powerConnected,
      },
    ]
  }
  const left = state.device.left
  const right = state.device.right
  return [
    {
      targetId: 'anatomy:left-pump-inlet-and-outlet',
      component: `Left-sided microaxial pump (${left.variant === '55' ? '5.5' : 'CP'})`,
      bloodEntersFrom: 'Left ventricle, through an inlet below the aortic valve',
      bloodReturnsTo: 'Ascending aorta, through an outlet above the valve',
      status: !left.enabled
        ? 'Not in place'
        : !left.running
          ? 'In place, paused'
          : `Running at level ${left.performanceLevel} · placement ${left.position === 'correct' ? 'aligned' : left.position.replace('-', ' ')}`,
      running: left.enabled && left.running,
    },
    {
      targetId: 'anatomy:right-pump-caval-to-pulmonary-path',
      component: 'Right-sided microaxial pump (RP)',
      bloodEntersFrom: 'Inferior vena cava',
      bloodReturnsTo: 'Pulmonary artery, bypassing the right ventricle',
      status: !right.enabled
        ? 'Not in place — its pathway is drawn so it can be read before it is started'
        : !right.running
          ? 'In place, paused'
          : `Running at level ${right.performanceLevel}`,
      running: right.enabled && right.running,
    },
  ]
}

/**
 * The anatomy pane's authored highlight targets, rendered as readable text beside the model.
 *
 * Split out of `McsAnatomy3D` so it can be rendered — and asserted — without the WebGL stack behind
 * it. The three-dimensional view is the illustration; this is the part a learner, a screen reader,
 * and a test can all read.
 */
export function McsAnatomyPathwaySummary({
  state,
  highlightTarget,
}: {
  state: McsSimulationState
  highlightTarget?: McsAnatomyTargetId
}) {
  const highlighted = highlightTarget ? mcsAnatomyTargets[highlightTarget] : undefined
  return (
    <section
      className={styles.pathwaySummary}
      aria-label="Support pathway: where blood enters and where it returns"
      data-anatomy-target="anatomy:support-pathway-overview"
      data-anatomy-highlighted={
        highlightTarget === 'anatomy:support-pathway-overview' ? 'true' : undefined
      }
    >
      <header>
        <span className={styles.monitorLabel}>SUPPORT PATHWAY</span>
        <strong>Source · active component · destination</strong>
      </header>
      {highlighted ? (
        <p className={styles.surfaceHighlightNote} data-anatomy-highlight-note>
          <strong>Look here now:</strong> {highlighted.label}. {highlighted.textEquivalent}
        </p>
      ) : null}
      <ul>
        {pathwayRows(state).map((row) => (
          <li
            key={row.targetId}
            data-anatomy-target={row.targetId}
            data-anatomy-highlighted={highlightTarget === row.targetId ? 'true' : undefined}
            data-running={row.running}
          >
            <strong>{row.component}</strong>
            <dl>
              <div>
                <dt>Blood enters from</dt>
                <dd>{row.bloodEntersFrom}</dd>
              </div>
              <div>
                <dt>Blood returns to</dt>
                <dd>{row.bloodReturnsTo}</dd>
              </div>
              <div>
                <dt>Now</dt>
                <dd>{row.status}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className={styles.pathwayDirectionNote}>
        The direction blood travels is a property of the pathway. It is not the direction the
        catheter or cannula was advanced.
      </p>
    </section>
  )
}
