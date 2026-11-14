'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * Where a lesson task's picture is drawn.
 *
 * A CRRT lesson is two panes on a desktop: the text on the left and the circuit, console or figure
 * on the right. The exercises were written as one column (instruction, selections, drawing,
 * summary), and their selections and their drawing share one component's state. So the drawing is
 * not moved in the source: the exercise wraps it in `CrrtLessonVisual`, and the lesson decides
 * where that renders.
 *
 * - No lesson pane (Practice, a test that renders one tool, a window too small for two panes):
 *   the children render in place, exactly where they are written.
 * - A lesson pane: the children render into the pane through a portal. The exercise keeps its
 *   state and its handlers; only the DOM position changes.
 *
 * Every visual also registers with the lesson, mounted or portalled, so the lesson knows whether
 * the current task brought a picture of its own. When none did, the lesson draws its reference
 * circuit in the pane instead of leaving it empty.
 */
interface CrrtLessonVisualHost {
  /** The pane to draw into, or null while the lesson is one column. */
  readonly target: HTMLElement | null
  /** Called once per mounted visual; returns its release. */
  readonly register: () => () => void
}

const CrrtLessonVisualContext = createContext<CrrtLessonVisualHost | null>(null)

export type CrrtLessonVisualSlot = 'lead' | 'support'

/** How the nearest lesson draws visuals: in its right pane, or in place. */
export function useCrrtLessonVisualPlacement(): 'pane' | 'inline' {
  return useContext(CrrtLessonVisualContext)?.target ? 'pane' : 'inline'
}

export function CrrtLessonVisual({
  slot = 'lead',
  children,
}: {
  /** `lead` is drawn first in the pane; `support` follows it. */
  readonly slot?: CrrtLessonVisualSlot
  readonly children: ReactNode
}) {
  const host = useContext(CrrtLessonVisualContext)
  const register = host?.register
  useEffect(() => register?.(), [register])
  if (host?.target)
    return createPortal(
      // Anything nested in a picture that is already in the pane stays where it is written.
      <CrrtLessonVisualContext.Provider value={null}>
        <div data-crrt-lesson-visual={slot}>{children}</div>
      </CrrtLessonVisualContext.Provider>,
      host.target,
    )
  // `display: contents`, so the wrapper adds no box and the exercise's own layout is unchanged.
  return (
    <div data-crrt-visual-inline={slot} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}

/**
 * The lesson's side of the contract.
 *
 * `target` is the pane element when the lesson is laid out as two panes and null otherwise;
 * `ownVisuals` is how many visuals the current task has mounted.
 */
export function useCrrtLessonVisualHost(target: HTMLElement | null) {
  const [ownVisuals, setOwnVisuals] = useState(0)
  const register = useCallback(() => {
    setOwnVisuals((count) => count + 1)
    return () => setOwnVisuals((count) => count - 1)
  }, [])
  const value = useMemo<CrrtLessonVisualHost>(() => ({ target, register }), [target, register])
  return { value, ownVisuals }
}

export function CrrtLessonVisualProvider({
  value,
  children,
}: {
  readonly value: CrrtLessonVisualHost
  readonly children: ReactNode
}) {
  return (
    <CrrtLessonVisualContext.Provider value={value}>{children}</CrrtLessonVisualContext.Provider>
  )
}
