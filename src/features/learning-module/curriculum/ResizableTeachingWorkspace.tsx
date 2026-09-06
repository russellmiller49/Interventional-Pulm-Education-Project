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

/**
 * How wide each pane opens, and how narrow it may be dragged.
 *
 * Both are per-caller because the slots are positional and the content is not: this workspace was
 * generalized from a layout whose widest pane happened to be the first one, and a module that puts
 * its instruction column first still needs its device pane to be the widest. ECMO does exactly
 * that. Omitted, both fall back to the values every caller had before the options existed, so a
 * caller that passes neither behaves identically to the version that had no options.
 */
export interface TeachingWorkspaceWidthFractions {
  /** Fraction of the usable width the primary pane opens at. */
  readonly primary: number
  readonly secondary: number
}

export interface TeachingWorkspacePaneMinimums {
  /** Pixels below which the pane may not be dragged, before compact scaling. */
  readonly primary: number
  readonly secondary: number
  readonly tertiary: number
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
  /**
   * Which pane the compact, one-pane view should show — followed, not forced.
   *
   * Below the compact threshold only one pane is on screen. Which one should depend on where the
   * current step's work is: a step answered by clicking a place on a diagram in the device pane is
   * unanswerable if the compact view is parked on the instruction, and vice versa. Changing this
   * moves the learner; they can still switch panes themselves afterwards, which is why it is a
   * preference rather than `activePane`. Omitted, the view opens on `primary` and stays wherever
   * the learner puts it, which is what every caller did before this existed.
   */
  readonly preferredCompactPane?: WorkspacePane
  /** Opening widths, as fractions of the usable width. Defaults to 43% / 29% / the rest. */
  readonly defaultWidthFractions?: TeachingWorkspaceWidthFractions
  /** Drag floors in pixels. Defaults to 340 / 280 / 300. */
  readonly paneMinimums?: TeachingWorkspacePaneMinimums
  readonly className?: string
}

const preferredMinimums: TeachingWorkspacePaneMinimums = {
  primary: 340,
  secondary: 280,
  tertiary: 300,
}

const defaultWidthFractions: TeachingWorkspaceWidthFractions = { primary: 0.43, secondary: 0.29 }

function compactThreshold(minimums: TeachingWorkspacePaneMinimums): number {
  return minimums.primary + minimums.secondary + minimums.tertiary + 40
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function scaledMinimums(usableWidth: number, minimums: TeachingWorkspacePaneMinimums) {
  const preferredTotal = minimums.primary + minimums.secondary + minimums.tertiary
  // Below the preferred total, reserve part of the width as draggable range. Scaling the minimums
  // to exactly 100% makes the separators look interactive while leaving them nowhere to move.
  const scale = Math.min(1, (usableWidth / preferredTotal) * 0.78)
  return {
    primary: minimums.primary * scale,
    secondary: minimums.secondary * scale,
    tertiary: minimums.tertiary * scale,
  }
}

function normalizeWidths(
  usableWidth: number,
  minimums: TeachingWorkspacePaneMinimums,
  fractions: TeachingWorkspaceWidthFractions,
  preferred?: PaneWidths,
): PaneWidths {
  const floors = scaledMinimums(usableWidth, minimums)
  const desiredPrimary = preferred?.primary ?? usableWidth * fractions.primary
  const desiredSecondary = preferred?.secondary ?? usableWidth * fractions.secondary
  const primary = clamp(
    desiredPrimary,
    floors.primary,
    usableWidth - floors.secondary - floors.tertiary,
  )
  const secondary = clamp(
    desiredSecondary,
    floors.secondary,
    usableWidth - primary - floors.tertiary,
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
  preferredCompactPane,
  defaultWidthFractions: widthFractions = defaultWidthFractions,
  paneMinimums: minimums = preferredMinimums,
  className,
}: ResizableTeachingWorkspaceProps) {
  const workspaceRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<Record<WorkspacePane, HTMLButtonElement | null>>({
    primary: null,
    secondary: null,
    tertiary: null,
  })
  const dragRef = useRef<{ boundary: ResizeBoundary; pointerId: number } | null>(null)
  const [widths, setWidths] = useState<PaneWidths | null>(null)
  const [availableWidth, setAvailableWidth] = useState(0)
  const [activeBoundary, setActiveBoundary] = useState<ResizeBoundary | null>(null)
  const [compactPane, setCompactPane] = useState<WorkspacePane>(preferredCompactPane ?? 'primary')
  /*
   * Follow the caller's preference when it changes, and only then.
   *
   * React's adjust-state-while-rendering pattern rather than an effect: writing it on every render
   * would undo a learner's own pane choice on the next clock tick, and an effect would render the
   * wrong pane once before correcting it. This moves them exactly when the thing they are being
   * asked to do moves, and leaves them where they put themselves in between.
   */
  const [followedCompactPane, setFollowedCompactPane] = useState(preferredCompactPane)
  if (preferredCompactPane !== followedCompactPane) {
    setFollowedCompactPane(preferredCompactPane)
    if (preferredCompactPane) setCompactPane(preferredCompactPane)
  }
  const primaryId = useId()
  const secondaryId = useId()
  const tertiaryId = useId()
  const instructionsId = useId()

  /*
   * The layout options, reachable from the mount-once effect without re-running it.
   *
   * Callers pass object literals, so putting them in the dependency array would tear down and
   * rebuild the ResizeObserver on every render. They are static per caller in practice; the ref is
   * what makes that safe rather than assumed.
   */
  const layoutRef = useRef({ minimums, widthFractions })
  useEffect(() => {
    layoutRef.current = { minimums, widthFractions }
  })

  useEffect(() => {
    function fitToWorkspace() {
      const workspace = workspaceRef.current
      if (!workspace) return
      const geometry = geometryFor(workspace)
      if (!geometry || geometry.usableWidth <= 0) return
      setAvailableWidth(geometry.usableWidth)
      setWidths((current) =>
        normalizeWidths(
          geometry.usableWidth,
          layoutRef.current.minimums,
          layoutRef.current.widthFractions,
          current ?? undefined,
        ),
      )
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
      const normalized = normalizeWidths(
        geometry.usableWidth,
        minimums,
        widthFractions,
        current ?? undefined,
      )
      const floors = scaledMinimums(geometry.usableWidth, minimums)
      if (boundary === 'primary-secondary') {
        return {
          ...normalized,
          primary: clamp(
            clientX - geometry.originX,
            floors.primary,
            geometry.usableWidth - normalized.secondary - floors.tertiary,
          ),
        }
      }
      return {
        ...normalized,
        secondary: clamp(
          clientX - geometry.originX - normalized.primary,
          floors.secondary,
          geometry.usableWidth - normalized.primary - floors.tertiary,
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
      const normalized = normalizeWidths(
        geometry.usableWidth,
        minimums,
        widthFractions,
        current ?? undefined,
      )
      const floors = scaledMinimums(geometry.usableWidth, minimums)
      const direction = event.key === 'ArrowLeft' ? -24 : 24
      if (boundary === 'primary-secondary') {
        const maximum = geometry.usableWidth - normalized.secondary - floors.tertiary
        const next =
          event.key === 'Home'
            ? floors.primary
            : event.key === 'End'
              ? maximum
              : normalized.primary + direction
        return { ...normalized, primary: clamp(next, floors.primary, maximum) }
      }
      const maximum = geometry.usableWidth - normalized.primary - floors.tertiary
      const next =
        event.key === 'Home'
          ? floors.secondary
          : event.key === 'End'
            ? maximum
            : normalized.secondary + direction
      return { ...normalized, secondary: clamp(next, floors.secondary, maximum) }
    })
  }

  /*
   * Before the first measurement the caller's own fractions are published as percentages.
   *
   * The stylesheet's `var(--tw-primary-width, 43%)` fallback is the whole-workspace default, so a
   * caller that opens at a different split used to paint one frame at 43/29 and then jump. That
   * frame is not cosmetic here: `FitWidthSurface` measures the pane it is in during exactly that
   * window to scale the device console to it.
   */
  const workspaceStyle = widths
    ? ({
        '--tw-primary-width': `${widths.primary}px`,
        '--tw-secondary-width': `${widths.secondary}px`,
      } as CSSProperties)
    : ({
        '--tw-primary-width': `${widthFractions.primary * 100}%`,
        '--tw-secondary-width': `${widthFractions.secondary * 100}%`,
      } as CSSProperties)
  const tertiaryWidth =
    widths && availableWidth > 0
      ? Math.max(0, availableWidth - widths.primary - widths.secondary)
      : 0
  const compact = availableWidth > 0 && availableWidth < compactThreshold(minimums)
  const visiblePane = activePane ?? compactPane

  /**
   * The WAI-ARIA tabs keyboard model for the compact pane switcher.
   *
   * The tablist shipped with roving tabIndex and no key handling, which is the worst half of the
   * pattern on its own: Tab landed on the active tab, the other two sat at tabIndex −1, and no key
   * moved focus — so a keyboard-only learner could never reach the Teaching or activity pane at a
   * compact width at all. Selection follows focus (the panes are mounted throughout, so switching
   * is cheap), arrows wrap in both directions, Home and End jump to the ends, and Up/Down mirror
   * Left/Right. Pointer activation is untouched, and a parent that owns the switcher via
   * `activePane` never renders this tablist in the first place.
   */
  function tablistKeyDown(pane: WorkspacePane, event: KeyboardEvent<HTMLButtonElement>) {
    const order: readonly WorkspacePane[] = ['primary', 'secondary', 'tertiary']
    const index = order.indexOf(pane)
    let next: WorkspacePane
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = order[(index + 1) % order.length]
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = order[(index + order.length - 1) % order.length]
        break
      case 'Home':
        next = order[0]
        break
      case 'End':
        next = order[order.length - 1]
        break
      default:
        return
    }
    event.preventDefault()
    setCompactPane(next)
    tabRefs.current[next]?.focus()
  }
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
              ref={(element) => {
                tabRefs.current[pane] = element
              }}
              aria-selected={visiblePane === pane}
              aria-controls={paneIdFor[pane]}
              tabIndex={visiblePane === pane ? 0 : -1}
              onClick={() => setCompactPane(pane)}
              onKeyDown={(event) => tablistKeyDown(pane, event)}
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
