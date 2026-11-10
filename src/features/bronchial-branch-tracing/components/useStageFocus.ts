'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Keeps keyboard focus on the bench when a step moves on.
 *
 * A step's button often disappears with the step ("Check the circle", "Drive on"), and focus then
 * falls back to the page: the next Tab starts from the top of the document. When the stage changes
 * and focus has been lost that way, it moves to the task card's heading, which says what to do
 * now. Focus that is still on something in the page is left alone.
 */
export function useStageFocus(container: RefObject<HTMLElement | null>, stage: string) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const heading = container.current?.querySelector<HTMLElement>('[data-now-card] h2')
    if (!heading) return
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }, [container, stage])
}
