import type { ActivityShellProps } from '@/features/learning-module/components/ActivityShell'
import { ActivityChrome } from '@/features/learning-module/components/ActivityChrome'
import { AssumedConceptStrip } from '@/features/critical-care/components/AssumedConceptStrip'
import styles from './case-flow.module.css'

/** MV-only case presentation. The host and workflow keep their existing reducers and handlers. */
export function VentilationCaseLayout({
  patientContext,
  viewport,
  currentTask,
  activityId,
  assumedConceptIds = [],
  ...chrome
}: ActivityShellProps) {
  return (
    <div className={styles.flow} data-case-flow={chrome.phase}>
      <ActivityChrome {...chrome} layout="native-workbench" showProgressStepper={false}>
        <div className={styles.document}>
          {activityId && assumedConceptIds.length ? (
            <details>
              <summary>Prerequisite concepts</summary>
              <AssumedConceptStrip activityId={activityId} conceptIds={assumedConceptIds} />
            </details>
          ) : null}
          <details open={chrome.phase === 'recognize'}>
            <summary>Patient brief and context</summary>
            <div className={styles.context}>{patientContext}</div>
          </details>
          <div
            className={styles.workspace}
            data-case-debrief={chrome.phase === 'explain' || undefined}
          >
            <section
              className={styles.ventilator}
              aria-label="Working simulation"
              hidden={chrome.phase === 'explain'}
            >
              {viewport}
            </section>
            <section
              className={styles.task}
              aria-label={chrome.phase === 'explain' ? 'Case debrief' : 'Current task'}
            >
              {currentTask}
            </section>
          </div>
        </div>
      </ActivityChrome>
    </div>
  )
}
