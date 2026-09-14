import type { ReactNode } from 'react'
import { LessonShell } from '@/features/learning-module/stage/LessonShell'
import styles from './branch-tracing.module.css'

/** Full routes keep the current decision and evolving map beside their CT evidence. */
export function CtRouteWorkspace({
  section,
  stageId,
  label,
  header,
  contextStrip,
  task,
  teaching,
  simulator,
  overlay,
  footer,
  explanationOpen = false,
  map,
}: {
  section: 'learn' | 'practice' | 'assess'
  stageId: string
  label: string
  header: ReactNode
  contextStrip?: ReactNode
  task: ReactNode
  map?: ReactNode
  teaching: ReactNode
  simulator: ReactNode
  overlay: ReactNode
  footer: ReactNode
  explanationOpen?: boolean
}) {
  return (
    <LessonShell
      module="bronchial-branch-tracing"
      section={section}
      stage={stageId}
      label={label}
      header={header}
      contextStrip={contextStrip}
      footer={footer}
    >
      <div className={styles.routeWorkspace}>
        <section className={styles.routeTask} aria-label="Current route decision">
          {task}
          {explanationOpen ? (
            teaching
          ) : (
            <details>
              <summary>Tracing guidance and source context</summary>
              {teaching}
            </details>
          )}
        </section>
        <section className={styles.routeEvidence} aria-label="Route CT evidence">
          {simulator}
        </section>
        {map && (
          <section className={styles.routeMap} aria-label="Route map and review">
            {map}
          </section>
        )}
      </div>
      {overlay}
    </LessonShell>
  )
}
