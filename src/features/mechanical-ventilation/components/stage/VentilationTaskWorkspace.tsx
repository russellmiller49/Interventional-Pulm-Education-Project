import type { ReactNode } from 'react'
import type { VentilationTaskPresentation } from '../../content/taskPresentation'
import styles from './task-flow.module.css'

/** A task owns its illustration, real control, response, and submission in one document. */
export function VentilationTaskWorkspace({
  presentation,
  instruction,
  workbench,
  response,
}: {
  presentation: VentilationTaskPresentation
  instruction?: ReactNode
  workbench?: ReactNode
  response: ReactNode
}) {
  return (
    <div
      className={styles.workspace}
      data-task-presentation
      data-kind={presentation.kind}
      data-surface={presentation.surface}
    >
      {instruction}
      {workbench}
      {response}
    </div>
  )
}
