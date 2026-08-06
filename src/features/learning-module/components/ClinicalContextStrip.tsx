'use client'

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

import styles from './learning-module-v2.module.css'

/**
 * The patient/clinical context strip every critical-care activity frame opens with.
 *
 * It is a horizontal scroll container: `overflow: auto` under a `max-height`, holding the context
 * items, the immediate goal and the safety constraints in one row. Every activity gives it more
 * content than fits — on the ECMO Learn route, 3094px of content in a 1585px box at 1600 × 900, and
 * 1903px hidden at 1024 × 768 — and what is off to the right is ABG/MAP, the active-alarm row, the
 * immediate goal, and the safety-constraints block including the manufacturer/ELSO guidance line.
 *
 * It used to carry no `tabindex`, and it holds no focusable descendant a `Tab` could land on inside
 * it, so a pointer was the only way to reach any of that. This is the `scrollable-region-focusable`
 * case, and on a route claiming human-test readiness it is a blocker rather than a preference: a
 * keyboard-only learner could not read the safety constraints at all.
 *
 * So the strip takes the tab stop itself. Three details are deliberate:
 *
 *  - **Left/Right/Home/End are handled rather than left to the platform.** A focused scroller does
 *    scroll with the arrow keys natively, but a browser gives it no *horizontal* Home/End — those
 *    scroll the block axis, which here has nothing to move — so the two keys that jump to the far
 *    ends would do nothing on the one axis that overflows. Handling all four keeps the behaviour one
 *    thing rather than half platform and half not, and `preventDefault` is what stops the native
 *    scroll from being applied on top of the handled one.
 *  - **The role and the accessible name stay exactly as they were.** `<section>` with `aria-label`
 *    is already a named `region`, which is how a screen-reader user jumps to the clinical context in
 *    the first place; the tab stop is added beside it, not traded for it.
 *  - **The instruction is described, not displayed.** `aria-describedby` announces how to drive the
 *    strip when it receives focus. It is `sr-only`, so the clinical content and its order are
 *    untouched — nothing was added to, removed from, or reordered in what is on screen.
 */
export function ClinicalContextStrip({ children }: { readonly children: ReactNode }) {
  const stripRef = useRef<HTMLElement>(null)
  const hintId = useId()

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const strip = stripRef.current
    if (!strip) return
    // The strip is the tab stop; a key pressed on something inside it belongs to that thing. There
    // are no focusable descendants today, and this keeps that from becoming a bug if one is added.
    if (event.target !== strip) return
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

    const maximum = Math.max(0, strip.scrollWidth - strip.clientWidth)
    if (maximum === 0) return

    // A quarter of the visible width per press. A fixed ~40px line step is the platform default for
    // a scroller, but the hidden span here is measured in four figures, and 24 presses to reach the
    // safety constraints is a reachable-in-principle that nobody would use.
    const step = Math.max(64, Math.round(strip.clientWidth * 0.25))

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        strip.scrollLeft = Math.min(maximum, strip.scrollLeft + step)
        break
      case 'ArrowLeft':
        event.preventDefault()
        strip.scrollLeft = Math.max(0, strip.scrollLeft - step)
        break
      case 'End':
        event.preventDefault()
        strip.scrollLeft = maximum
        break
      case 'Home':
        event.preventDefault()
        strip.scrollLeft = 0
        break
      default:
        break
    }
  }

  return (
    <section
      ref={stripRef}
      className={styles.contextStrip}
      aria-label="Clinical context"
      aria-describedby={hintId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <p id={hintId} className="sr-only">
        This clinical context row scrolls sideways. With it focused, use the left and right arrow
        keys to reach the rest of it, or Home and End for the first and last items.
      </p>
      {children}
    </section>
  )
}
