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

import styles from './icu-hemodynamics.module.css'

type PacWorkspacePane = 'monitor' | 'physiology' | 'controls'
type ResizeBoundary = 'monitor-physiology' | 'physiology-controls'

interface PaneWidths {
  readonly monitor: number
  readonly physiology: number
}

interface WorkspaceGeometry {
  readonly originX: number
  readonly usableWidth: number
}

interface ResizablePacWorkspaceProps {
  readonly monitor: ReactNode
  readonly physiology: ReactNode
  readonly controls: ReactNode
  readonly activePane?: PacWorkspacePane
  readonly className?: string
}

const preferredMinimums = {
  monitor: 340,
  physiology: 280,
  controls: 300,
} as const
const COMPACT_WORKSPACE_THRESHOLD_PX =
  preferredMinimums.monitor + preferredMinimums.physiology + preferredMinimums.controls + 40

const paneLabels: Readonly<Record<PacWorkspacePane, string>> = {
  monitor: 'Monitor',
  physiology: 'Anatomy',
  controls: 'Activity',
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function scaledMinimums(usableWidth: number) {
  const preferredTotal =
    preferredMinimums.monitor + preferredMinimums.physiology + preferredMinimums.controls
  // When the workspace is narrower than the preferred total, reserve part of the width as
  // draggable range. Scaling the minimums to exactly 100% made the separators look interactive
  // while leaving them no room to move on common laptop-sized activity viewports.
  const scale = Math.min(1, (usableWidth / preferredTotal) * 0.78)
  return {
    monitor: preferredMinimums.monitor * scale,
    physiology: preferredMinimums.physiology * scale,
    controls: preferredMinimums.controls * scale,
  }
}

function normalizeWidths(usableWidth: number, preferred?: PaneWidths): PaneWidths {
  const minimums = scaledMinimums(usableWidth)
  const desiredMonitor = preferred?.monitor ?? usableWidth * 0.43
  const desiredPhysiology = preferred?.physiology ?? usableWidth * 0.29
  const monitor = clamp(
    desiredMonitor,
    minimums.monitor,
    usableWidth - minimums.physiology - minimums.controls,
  )
  const physiology = clamp(
    desiredPhysiology,
    minimums.physiology,
    usableWidth - monitor - minimums.controls,
  )
  return { monitor, physiology }
}

function geometryFor(workspace: HTMLElement): WorkspaceGeometry | null {
  const bounds = workspace.getBoundingClientRect()
  if (bounds.width <= 0) return null
  const computed = window.getComputedStyle(workspace)
  const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0
  const paddingRight = Number.parseFloat(computed.paddingRight) || 0
  const handleWidth = Array.from(
    workspace.querySelectorAll<HTMLElement>('[data-pac-resize-handle]'),
  ).reduce((total, handle) => total + handle.getBoundingClientRect().width, 0)
  return {
    originX: bounds.left + paddingLeft,
    usableWidth: Math.max(0, bounds.width - paddingLeft - paddingRight - handleWidth),
  }
}

export function ResizablePacWorkspace({
  monitor,
  physiology,
  controls,
  activePane,
  className,
}: ResizablePacWorkspaceProps) {
  const workspaceRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ boundary: ResizeBoundary; pointerId: number } | null>(null)
  const [widths, setWidths] = useState<PaneWidths | null>(null)
  const [availableWidth, setAvailableWidth] = useState(0)
  const [activeBoundary, setActiveBoundary] = useState<ResizeBoundary | null>(null)
  const [compactPane, setCompactPane] = useState<PacWorkspacePane>('monitor')
  const monitorId = useId()
  const physiologyId = useId()
  const controlsId = useId()
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
      if (boundary === 'monitor-physiology') {
        return {
          ...normalized,
          monitor: clamp(
            clientX - geometry.originX,
            minimums.monitor,
            geometry.usableWidth - normalized.physiology - minimums.controls,
          ),
        }
      }
      return {
        ...normalized,
        physiology: clamp(
          clientX - geometry.originX - normalized.monitor,
          minimums.physiology,
          geometry.usableWidth - normalized.monitor - minimums.controls,
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
      if (boundary === 'monitor-physiology') {
        const maximum = geometry.usableWidth - normalized.physiology - minimums.controls
        const next =
          event.key === 'Home'
            ? minimums.monitor
            : event.key === 'End'
              ? maximum
              : normalized.monitor + direction
        return { ...normalized, monitor: clamp(next, minimums.monitor, maximum) }
      }
      const maximum = geometry.usableWidth - normalized.monitor - minimums.controls
      const next =
        event.key === 'Home'
          ? minimums.physiology
          : event.key === 'End'
            ? maximum
            : normalized.physiology + direction
      return { ...normalized, physiology: clamp(next, minimums.physiology, maximum) }
    })
  }

  const workspaceStyle = widths
    ? ({
        '--pac-monitor-width': `${widths.monitor}px`,
        '--pac-physiology-width': `${widths.physiology}px`,
      } as CSSProperties)
    : undefined
  const controlsWidth =
    widths && availableWidth > 0
      ? Math.max(0, availableWidth - widths.monitor - widths.physiology)
      : 0
  const compact = availableWidth > 0 && availableWidth < COMPACT_WORKSPACE_THRESHOLD_PX
  const visiblePane = activePane ?? compactPane

  return (
    <section
      ref={workspaceRef}
      className={[styles.resizablePacWorkspace, className].filter(Boolean).join(' ')}
      style={workspaceStyle}
      aria-label="Resizable PAC monitor, anatomy, and teaching workspace"
      data-compact={compact || undefined}
    >
      <p id={instructionsId} className={styles.srOnly}>
        Each panel scrolls independently. Focus either vertical divider and use the left and right
        arrow keys to resize adjacent panels.
      </p>

      {compact && activePane === undefined ? (
        <div
          className={styles.pacCompactPaneTabs}
          role="tablist"
          aria-label="Workspace panel views"
        >
          <span>Space-saving view · choose a full-width panel</span>
          {(['monitor', 'physiology', 'controls'] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              role="tab"
              aria-selected={visiblePane === pane}
              aria-controls={
                pane === 'monitor' ? monitorId : pane === 'physiology' ? physiologyId : controlsId
              }
              tabIndex={visiblePane === pane ? 0 : -1}
              onClick={() => setCompactPane(pane)}
            >
              {paneLabels[pane]}
            </button>
          ))}
        </div>
      ) : null}

      <div
        id={monitorId}
        className={styles.resizablePacPane}
        role="region"
        aria-label="Monitor panel"
        tabIndex={0}
        hidden={compact && visiblePane !== 'monitor'}
        data-mobile-visible={activePane === undefined || activePane === 'monitor'}
      >
        {monitor}
      </div>
      <div
        className={styles.pacResizeHandle}
        role="separator"
        aria-label="Resize monitor and anatomy panels"
        aria-controls={`${monitorId} ${physiologyId}`}
        aria-describedby={instructionsId}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.round(availableWidth)}
        aria-valuenow={Math.round(widths?.monitor ?? 0)}
        aria-valuetext={`${Math.round(widths?.monitor ?? 0)} pixel monitor width`}
        title="Drag to resize, or focus and use the left and right arrow keys"
        tabIndex={0}
        hidden={compact}
        data-pac-resize-handle
        data-active={activeBoundary === 'monitor-physiology' || undefined}
        onPointerDown={(event) => beginResize('monitor-physiology', event)}
        onPointerMove={continueResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={(event) => resizeWithKeyboard('monitor-physiology', event)}
      >
        <span aria-hidden="true" />
      </div>
      <div
        id={physiologyId}
        className={styles.resizablePacPane}
        role="region"
        aria-label="Anatomy and pressure-reference panel"
        tabIndex={0}
        hidden={compact && visiblePane !== 'physiology'}
        data-mobile-visible={activePane === undefined || activePane === 'physiology'}
      >
        {physiology}
      </div>
      <div
        className={styles.pacResizeHandle}
        role="separator"
        aria-label="Resize anatomy and PAC teaching panels"
        aria-controls={`${physiologyId} ${controlsId}`}
        aria-describedby={instructionsId}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.round(availableWidth)}
        aria-valuenow={Math.round(widths?.physiology ?? 0)}
        aria-valuetext={`${Math.round(widths?.physiology ?? 0)} pixel anatomy width and ${Math.round(controlsWidth)} pixel PAC teaching width`}
        title="Drag to resize, or focus and use the left and right arrow keys"
        tabIndex={0}
        hidden={compact}
        data-pac-resize-handle
        data-active={activeBoundary === 'physiology-controls' || undefined}
        onPointerDown={(event) => beginResize('physiology-controls', event)}
        onPointerMove={continueResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={(event) => resizeWithKeyboard('physiology-controls', event)}
      >
        <span aria-hidden="true" />
      </div>
      <div
        id={controlsId}
        className={styles.resizablePacPane}
        role="region"
        aria-label="PAC controls and waveform-teaching panel"
        tabIndex={0}
        hidden={compact && visiblePane !== 'controls'}
        data-mobile-visible={activePane === undefined || activePane === 'controls'}
      >
        {controls}
      </div>
    </section>
  )
}
