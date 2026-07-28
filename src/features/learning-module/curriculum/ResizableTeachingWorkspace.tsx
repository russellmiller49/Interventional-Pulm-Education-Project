'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

import styles from './teaching-workspace.module.css'

type WorkspacePane = 'primary' | 'secondary' | 'tertiary'
type ResizeBoundary = 'primary-secondary' | 'secondary-tertiary'

interface PaneWidths {
  readonly primary: number
  readonly secondary: number
}

interface WorkspaceGeometry {
  readonly originX: number
  readonly usableWidth: number
}

export interface TeachingWorkspacePaneLabels {
  readonly primary: string
  readonly secondary: string
  readonly tertiary: string
}

interface ResizableTeachingWorkspaceProps {
  /** Live device or bedside surface. */
  readonly primary: ReactNode
  /** The teaching panel: illustrations and interactive explanation of what is being taught. */
  readonly secondary: ReactNode
  /** The activity surface the learner acts through. */
  readonly tertiary: ReactNode
  readonly paneLabels: TeachingWorkspacePaneLabels
  readonly workspaceLabel: string
  /** Force a single pane, e.g. when a parent already owns the pane switcher. */
  readonly activePane?: WorkspacePane
  readonly className?: string
}

const preferredMinimums = {
  primary: 340,
  secondary: 280,
  tertiary: 300,
} as const

const COMPACT_WORKSPACE_THRESHOLD_PX =
  preferredMinimums.primary + preferredMinimums.secondary + preferredMinimums.tertiary + 40

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function scaledMinimums(usableWidth: number) {
  const preferredTotal =
    preferredMinimums.primary + preferredMinimums.secondary + preferredMinimums.tertiary
  // Below the preferred total, reserve part of the width as draggable range. Scaling the minimums
  // to exactly 100% makes the separators look interactive while leaving them nowhere to move.
  const scale = Math.min(1, (usableWidth / preferredTotal) * 0.78)
  return {
    primary: preferredMinimums.primary * scale,
    secondary: preferredMinimums.secondary * scale,
    tertiary: preferredMinimums.tertiary * scale,
  }
}

function normalizeWidths(usableWidth: number, preferred?: PaneWidths): PaneWidths {
  const minimums = scaledMinimums(usableWidth)
  const desiredPrimary = preferred?.primary ?? usableWidth * 0.43
  const desiredSecondary = preferred?.secondary ?? usableWidth * 0.29
  const primary = clamp(
    desiredPrimary,
    minimums.primary,
    usableWidth - minimums.secondary - minimums.tertiary,
  )
  const secondary = clamp(
    desiredSecondary,
    minimums.secondary,
    usableWidth - primary - minimums.tertiary,
  )
  return { primary, secondary }
}

function geometryFor(workspace: HTMLElement): WorkspaceGeometry | null {
  const bounds = workspace.getBoundingClientRect()
  if (bounds.width <= 0) return null
  const computed = window.getComputedStyle(workspace)
  const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0
  const paddingRight = Number.parseFloat(computed.paddingRight) || 0
  const handleWidth = Array.from(
    workspace.querySelectorAll<HTMLElement>('[data-teaching-resize-handle]'),
  ).reduce((total, handle) => total + handle.getBoundingClientRect().width, 0)
  return {
    originX: bounds.left + paddingLeft,
    usableWidth: Math.max(0, bounds.width - paddingLeft - paddingRight - handleWidth),
  }
}

/**
 * Three independently scrolling, resizable panes: live surface, teaching panel, activity surface.
 *
 * Generalized from the hemodynamics PAC workspace so other critical-care modules can adopt the
 * same reading arrangement. Separators are keyboard-operable; each pane is a labelled region.
 */
export function ResizableTeachingWorkspace({
  primary,
  secondary,
  tertiary,
  paneLabels,
  workspaceLabel,
  activePane,
  className,
}: ResizableTeachingWorkspaceProps) {
  const workspaceRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ boundary: ResizeBoundary; pointerId: number } | null>(null)
  const [widths, setWidths] = useState<PaneWidths | null>(null)
  const [availableWidth, setAvailableWidth] = useState(0)
  const [activeBoundary, setActiveBoundary] = useState<ResizeBoundary | null>(null)
  const [compactPane, setCompactPane] = useState<WorkspacePane>('primary')
  const primaryId = useId()
  const secondaryId = useId()
  const tertiaryId = useId()
  const instructionsId = useId()

  useEffect(() => {
    function fitToWorkspace() {
      const workspace = workspaceRef.current
      if (!workspace) return
      const geometry = geometryFor(workspace)
      if (!geometry || geometry.usableWidth <= 0) return
      setAvailableWidth(geometry.usableWidth)
      setWidths((current) => normalizeWidths(geometry.usableWidth, current ?? undefined))
    }

    const timer = window.setTimeout(fitToWorkspace, 0)
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitToWorkspace)
    if (workspaceRef.current) observer?.observe(workspaceRef.current)
    window.addEventListener('resize', fitToWorkspace)
    return () => {
      window.clearTimeout(timer)
      observer?.disconnect()
      window.removeEventListener('resize', fitToWorkspace)
    }
  }, [])

  function resizeAt(boundary: ResizeBoundary, clientX: number) {
    const workspace = workspaceRef.current
    if (!workspace) return
    const geometry = geometryFor(workspace)
    if (!geometry || geometry.usableWidth <= 0) return
    setAvailableWidth(geometry.usableWidth)
    setWidths((current) => {
      const normalized = normalizeWidths(geometry.usableWidth, current ?? undefined)
      const minimums = scaledMinimums(geometry.usableWidth)
      if (boundary === 'primary-secondary') {
        return {
          ...normalized,
          primary: clamp(
            clientX - geometry.originX,
            minimums.primary,
            geometry.usableWidth - normalized.secondary - minimums.tertiary,
          ),
        }
      }
      return {
        ...normalized,
        secondary: clamp(
          clientX - geometry.originX - normalized.primary,
          minimums.secondary,
          geometry.usableWidth - normalized.primary - minimums.tertiary,
        ),
      }
    })
  }

  function beginResize(boundary: ResizeBoundary, event: PointerEvent<HTMLDivElement>) {
    dragRef.current = { boundary, pointerId: event.pointerId }
    setActiveBoundary(boundary)
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeAt(boundary, event.clientX)
    event.preventDefault()
  }

  function continueResize(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    resizeAt(drag.boundary, event.clientX)
    event.preventDefault()
  }

  function endResize(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    setActiveBoundary(null)
  }

  function resizeWithKeyboard(boundary: ResizeBoundary, event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const workspace = workspaceRef.current
    if (!workspace) return
    const geometry = geometryFor(workspace)
    if (!geometry || geometry.usableWidth <= 0) return
    event.preventDefault()
    setAvailableWidth(geometry.usableWidth)
    setWidths((current) => {
      const normalized = normalizeWidths(geometry.usableWidth, current ?? undefined)
      const minimums = scaledMinimums(geometry.usableWidth)
      const direction = event.key === 'ArrowLeft' ? -24 : 24
      if (boundary === 'primary-secondary') {
        const maximum = geometry.usableWidth - normalized.secondary - minimums.tertiary
        const next =
          event.key === 'Home'
            ? minimums.primary
            : event.key === 'End'
              ? maximum
              : normalized.primary + direction
        return { ...normalized, primary: clamp(next, minimums.primary, maximum) }
      }
      const maximum = geometry.usableWidth - normalized.primary - minimums.tertiary
      const next =
        event.key === 'Home'
          ? minimums.secondary
          : event.key === 'End'
            ? maximum
            : normalized.secondary + direction
      return { ...normalized, secondary: clamp(next, minimums.secondary, maximum) }
    })
  }

  const workspaceStyle = widths
    ? ({
        '--tw-primary-width': `${widths.primary}px`,
        '--tw-secondary-width': `${widths.secondary}px`,
      } as CSSProperties)
    : undefined
  const tertiaryWidth =
    widths && availableWidth > 0
      ? Math.max(0, availableWidth - widths.primary - widths.secondary)
      : 0
  const compact = availableWidth > 0 && availableWidth < COMPACT_WORKSPACE_THRESHOLD_PX
  const visiblePane = activePane ?? compactPane
  const paneIdFor: Readonly<Record<WorkspacePane, string>> = {
    primary: primaryId,
    secondary: secondaryId,
    tertiary: tertiaryId,
  }

  return (
    <section
      ref={workspaceRef}
      className={[styles.workspace, className].filter(Boolean).join(' ')}
      style={workspaceStyle}
      aria-label={workspaceLabel}
      data-compact={compact || undefined}
    >
      <p id={instructionsId} className={styles.srOnly}>
        Each panel scrolls independently. Focus either vertical divider and use the left and right
        arrow keys to resize adjacent panels.
      </p>

      {compact && activePane === undefined ? (
        <div className={styles.compactPaneTabs} role="tablist" aria-label="Workspace panel views">
          <span>Space-saving view · choose a full-width panel</span>
          {(['primary', 'secondary', 'tertiary'] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              role="tab"
              aria-selected={visiblePane === pane}
              aria-controls={paneIdFor[pane]}
              tabIndex={visiblePane === pane ? 0 : -1}
              onClick={() => setCompactPane(pane)}
            >
              {paneLabels[pane]}
            </button>
          ))}
        </div>
      ) : null}

      <div
        id={primaryId}
        className={styles.pane}
        role="region"
        aria-label={`${paneLabels.primary} panel`}
        tabIndex={0}
        hidden={compact && visiblePane !== 'primary'}
        data-mobile-visible={activePane === undefined || activePane === 'primary'}
      >
        {primary}
      </div>
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-label={`Resize ${paneLabels.primary} and ${paneLabels.secondary} panels`}
        aria-controls={`${primaryId} ${secondaryId}`}
        aria-describedby={instructionsId}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.round(availableWidth)}
        aria-valuenow={Math.round(widths?.primary ?? 0)}
        aria-valuetext={`${Math.round(widths?.primary ?? 0)} pixel ${paneLabels.primary} width`}
        title="Drag to resize, or focus and use the left and right arrow keys"
        tabIndex={0}
        hidden={compact}
        data-teaching-resize-handle
        data-active={activeBoundary === 'primary-secondary' || undefined}
        onPointerDown={(event) => beginResize('primary-secondary', event)}
        onPointerMove={continueResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={(event) => resizeWithKeyboard('primary-secondary', event)}
      >
        <span aria-hidden="true" />
      </div>
      <div
        id={secondaryId}
        className={styles.pane}
        role="region"
        aria-label={`${paneLabels.secondary} panel`}
        tabIndex={0}
        hidden={compact && visiblePane !== 'secondary'}
        data-mobile-visible={activePane === undefined || activePane === 'secondary'}
      >
        {secondary}
      </div>
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-label={`Resize ${paneLabels.secondary} and ${paneLabels.tertiary} panels`}
        aria-controls={`${secondaryId} ${tertiaryId}`}
        aria-describedby={instructionsId}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.round(availableWidth)}
        aria-valuenow={Math.round(widths?.secondary ?? 0)}
        aria-valuetext={`${Math.round(widths?.secondary ?? 0)} pixel ${paneLabels.secondary} width and ${Math.round(tertiaryWidth)} pixel ${paneLabels.tertiary} width`}
        title="Drag to resize, or focus and use the left and right arrow keys"
        tabIndex={0}
        hidden={compact}
        data-teaching-resize-handle
        data-active={activeBoundary === 'secondary-tertiary' || undefined}
        onPointerDown={(event) => beginResize('secondary-tertiary', event)}
        onPointerMove={continueResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={(event) => resizeWithKeyboard('secondary-tertiary', event)}
      >
        <span aria-hidden="true" />
      </div>
      <div
        id={tertiaryId}
        className={styles.pane}
        role="region"
        aria-label={`${paneLabels.tertiary} panel`}
        tabIndex={0}
        hidden={compact && visiblePane !== 'tertiary'}
        data-mobile-visible={activePane === undefined || activePane === 'tertiary'}
      >
        {tertiary}
      </div>
    </section>
  )
}
