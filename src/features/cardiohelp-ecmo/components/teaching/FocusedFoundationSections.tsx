import { Children, isValidElement, type ReactNode } from 'react'
import { useStageTeachingScope } from '../stage/StageTeachingScope'

/** Stable section heading IDs select existing content. Unselected sections are not mounted. */
export function FocusedFoundationSections({
  children,
  panelId,
  className,
}: {
  readonly children: ReactNode
  readonly panelId: string
  readonly className: string
}) {
  const scope = useStageTeachingScope()
  const content = !scope?.teachingSections
    ? children
    : Children.toArray(children).filter((child) => {
        if (
          !isValidElement<{ 'aria-labelledby'?: string; 'data-presentation-section'?: string }>(
            child,
          )
        )
          return false
        const id = child.props['aria-labelledby'] ?? child.props['data-presentation-section']
        return !id || scope.teachingSections?.includes(id)
      })
  return (
    <div className={className} data-teaching-panel={panelId}>
      {content}
    </div>
  )
}
