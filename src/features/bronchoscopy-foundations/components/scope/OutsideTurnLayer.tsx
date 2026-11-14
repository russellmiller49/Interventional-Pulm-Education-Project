'use client'

import { useRef, type PointerEvent } from 'react'
import styles from './scope-scene.module.css'

/**
 * Turning the outside model by hand: drag across the picture and the model follows.
 *
 * It lies over the picture and is hidden from assistive technology; the view buttons beside it
 * are the keyboard and screen-reader path, and the touch path too. A finger is left alone, so a
 * drag on a touch screen scrolls the page as it always has.
 */
export function OutsideTurnLayer({
  onTurn,
}: {
  /** The pixels moved since the last call. */
  readonly onTurn: (dxPx: number, dyPx: number) => void
}) {
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (dx === 0 && dy === 0) return
    current.x = event.clientX
    current.y = event.clientY
    onTurn(dx, dy)
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    drag.current = null
  }
  return (
    <div
      className={styles.outsideTurn}
      aria-hidden="true"
      data-outside-turn
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  )
}
