'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { ResizableTeachingWorkspace } from '@/features/learning-module/curriculum'

import styles from './mechanical-ventilation-v2.module.css'

/**
 * Below this measured Learn-viewport height the workspace switches to its laptop arrangement.
 *
 * The number is the measured shell budget, not a round figure. The shared shell hands the Learn
 * viewport 557px at 1600x900 and 1440x900, 479px at 1024x768, and 377px at 1280x720. Anything at
 * or under about 500px cannot carry the full-size section rail, run control, and console together,
 * so 500 separates the two real cases this module sees.
 */
const LAPTOP_DENSITY_BELOW_PX = 500

export type VentilationWorkspaceDensity = 'comfortable' | 'laptop'

/**
 * Density measured from the Learn viewport's own box.
 *
 * Deliberately not the window: what matters is the height the shared shell has left after its
 * header, clinical context strip, and bottom bar, and that is not a function of the display size
 * alone. Deliberately not the workspace frame either — the frame's height depends on how tall the
 * rail is, and the rail's height depends on the density, which would oscillate.
 */
/**
 * How much of the viewport's box the shell actually leaves on screen.
 *
 * At and below 1199px the shared shell keeps a 30rem minimum on the simulation viewport while its
 * own grid row is shorter — at 1024x768 the viewport is handed a 480px box inside about 407px, and
 * because the frames above it clip rather than scroll, the last ~70px sits behind the bottom bar.
 * That predates this package and lives in `learning-module-v2.module.css`, which this module does
 * not own. Measuring the distance from the viewport's top to the bottom bar's top and capping the
 * viewport there keeps the workspace inside the space a learner can see, without touching the
 * shared stylesheet.
 */
function visibleHeightFor(viewport: HTMLElement): number | null {
  const shell = viewport.closest('[data-critical-care-activity-shell]')
  const bottomBar = shell?.querySelector(':scope > footer')
  if (!bottomBar) return null
  const top = viewport.getBoundingClientRect().top
  const barTop = bottomBar.getBoundingClientRect().top
  const available = Math.round(barTop - top)
  return available > 0 ? available : null
}

export function useVentilationWorkspaceDensity(): {
  readonly density: VentilationWorkspaceDensity
  /** Pixels the shell actually leaves visible, or null while nothing has been laid out. */
  readonly availableHeight: number | null
  /**
   * A callback ref, not a `useRef` object: the lesson renders a launch gate and a resume banner
   * before the workspace, so a mount-time effect reading `ref.current` finds null and never
   * measures anything. The callback re-runs the measurement when the viewport actually appears.
   */
  readonly measureViewport: (node: HTMLElement | null) => void
} {
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [density, setDensity] = useState<VentilationWorkspaceDensity>('comfortable')
  const [availableHeight, setAvailableHeight] = useState<number | null>(null)

  useEffect(() => {
    if (!viewport) return undefined

    function fitToViewport() {
      if (!viewport) return
      const box = viewport.getBoundingClientRect().height
      // A zero box means nothing has been laid out yet; keep the roomier default rather than
      // flashing the compact arrangement.
      if (box <= 0) return
      const visible = visibleHeightFor(viewport)
      // The cap converges in one pass: the bottom bar's position does not depend on this element,
      // so shrinking the viewport does not move the measurement that produced the cap.
      setAvailableHeight(visible !== null && visible < box ? visible : null)
      setDensity(Math.min(box, visible ?? box) < LAPTOP_DENSITY_BELOW_PX ? 'laptop' : 'comfortable')
    }

    fitToViewport()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitToViewport)
    observer?.observe(viewport)
    window.addEventListener('resize', fitToViewport)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', fitToViewport)
    }
  }, [viewport])

  return { density, availableHeight, measureViewport: setViewport }
}

/**
 * Bring the active section chip into view inside the rail's horizontal scroller.
 *
 * The shared rail scrolls sideways and never scrolls itself, so on the tenth section a learner saw
 * "Section 10 of 10" above a strip showing sections one to four with nothing highlighted — the rail
 * promises "jump ahead or revisit any section" while not showing where they are. This only moves an
 * existing scroll container; the rail's markup, order, and behaviour are untouched.
 */
export function useActiveSectionInView(
  sectionId: string,
  /** Re-run once the measured density settles: it changes how many chips fit in the strip. */
  density: VentilationWorkspaceDensity,
): (node: HTMLElement | null) => void {
  const [rail, setRail] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!rail) return undefined
    const active = rail.querySelector<HTMLElement>('ol button[aria-current="step"]')
    const scroller = active?.closest('ol')
    if (!active || !scroller) return undefined

    function centreActive() {
      if (!active || !scroller) return
      if (scroller.clientWidth <= 0) return
      const activeBox = active.getBoundingClientRect()
      const scrollerBox = scroller.getBoundingClientRect()
      if (activeBox.left >= scrollerBox.left && activeBox.right <= scrollerBox.right) return
      /*
       * Absolute, from offsets rather than a delta off the current scroll position. A delta has to
       * be right first time; this is idempotent, so a re-run after the density measurement changes
       * how many chips fit lands in the same place instead of compounding a stale correction.
       */
      const offsetWithinScroller = active.offsetLeft - scroller.offsetLeft
      scroller.scrollLeft = Math.max(
        0,
        offsetWithinScroller - (scroller.clientWidth - active.offsetWidth) / 2,
      )
    }

    // Re-centre when the rail is re-laid out as well as on mount: the measured density arrives a
    // frame later and changes how many chips fit, so a single mount-time pass leaves the active
    // section off-screen at exactly the widths where it matters most.
    centreActive()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(centreActive)
    observer?.observe(scroller)
    return () => observer?.disconnect()
  }, [rail, sectionId, density])

  return setRail
}

export interface MechanicalVentilationLearnWorkspaceProps {
  /** Live ventilator surface. */
  readonly primary: ReactNode
  /** Teaching explanation for the current section or phase. */
  readonly secondary: ReactNode
  /** The surface the learner acts through. */
  readonly tertiary: ReactNode
}

/**
 * The Learn workspace frame.
 *
 * `ResizableTeachingWorkspace` is `height: 100%`, so it only becomes three independently scrolling
 * panes when something gives it a definite height. Previously its wrapper was `min-h-[40rem]`
 * inside a scrolling viewport: measured at 1280x720 the workspace stood 638px tall in a 377px
 * window, the viewport scrolled as one 948px block, and reaching the learner controls scrolled the
 * ventilator out of sight. This frame takes exactly the height the viewport's last row gives it
 * and passes it down, so each pane scrolls on its own and the console, the teaching panel, and the
 * current task stay side by side.
 */
export function MechanicalVentilationLearnWorkspace({
  primary,
  secondary,
  tertiary,
}: MechanicalVentilationLearnWorkspaceProps) {
  return (
    <div className={styles.workspaceFrame} data-mv-learn-workspace>
      <ResizableTeachingWorkspace
        workspaceLabel="Resizable ventilator, teaching, and activity workspace"
        paneLabels={{ primary: 'Ventilator', secondary: 'Teaching', tertiary: 'Your turn' }}
        primary={primary}
        secondary={secondary}
        tertiary={tertiary}
      />
    </div>
  )
}
