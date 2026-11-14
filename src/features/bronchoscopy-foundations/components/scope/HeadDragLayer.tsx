'use client'

import { useRef, type PointerEvent } from 'react'
import { MODEL_DEFLECTION_LIMIT_DEG } from '../../engine/scope/scopeInputs'
import type { ScopeCommand, ScopeControlKey, ScopeInputMode } from './types'
import styles from './scope-scene.module.css'

/**
 * The control head, worked by hand: drag up or down on it to move the thumb lever, and drag
 * across it to turn the control section, as the wrist does.
 *
 * It lies over the close-up of the control head and sends the same commands as the sliders under
 * the view, which stay as the keyboard and screen-reader path (this layer is hidden from assistive
 * technology). A drag keeps to the axis it starts on, so a lever movement does not also turn the
 * head. A finger is left alone: on a touch screen a drag here scrolls the page as it always has,
 * and the sliders work the controls.
 */

/** Degrees of tip deflection per pixel dragged: about 100 px for the lever's whole travel. */
export const LEVER_DEG_PER_PX = 1.2
/** Degrees of rotation per pixel dragged across the head. */
export const WRIST_DEG_PER_PX = 0.9
/** How far a drag travels before it is read as a lever movement or a turn. */
const AXIS_LOCK_PX = 5

/**
 * The lever goes down for the tip to go up, and positive deflection is the tip toward U. Dragging
 * down therefore raises the deflection.
 */
export function leverDragDeflection(startDeg: number, dyPx: number): number {
  const next = Math.round(startDeg + dyPx * LEVER_DEG_PER_PX)
  return Math.max(-MODEL_DEFLECTION_LIMIT_DEG, Math.min(MODEL_DEFLECTION_LIMIT_DEG, next))
}

/**
 * In the close-up the surface facing the learner moves to the right as rotation rises (the lever,
 * on the left at rest, comes round to the front). Dragging right therefore raises the rotation:
 * the head follows the hand.
 */
export function wristDragRotation(dxPx: number): number {
  return Math.round(dxPx * WRIST_DEG_PER_PX)
}

interface Drag {
  readonly pointerId: number
  readonly x: number
  readonly y: number
  readonly startDeflectionDeg: number
  axis: 'lever' | 'wrist' | null
  /** Rotation already sent in this drag, so each movement sends only what is new. */
  sentRotationDeg: number
  lastDeflectionDeg: number
}

export function HeadDragLayer({
  deflectionDeg,
  controls,
  enabled,
  onCommand,
}: {
  readonly deflectionDeg: number
  readonly controls: readonly ScopeControlKey[]
  readonly enabled: boolean
  readonly onCommand: (command: ScopeCommand, inputMode: ScopeInputMode) => void
}) {
  const drag = useRef<Drag | null>(null)
  const lever = controls.includes('deflect')
  const wrist = controls.includes('rotate')
  if (!lever && !wrist) return null

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || event.pointerType === 'touch' || event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startDeflectionDeg: deflectionDeg,
      axis: lever && !wrist ? 'lever' : wrist && !lever ? 'wrist' : null,
      sentRotationDeg: 0,
      lastDeflectionDeg: deflectionDeg,
    }
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return
      current.axis = Math.abs(dy) >= Math.abs(dx) ? 'lever' : 'wrist'
    }
    if (current.axis === 'lever') {
      const next = leverDragDeflection(current.startDeflectionDeg, dy)
      if (next === current.lastDeflectionDeg) return
      current.lastDeflectionDeg = next
      onCommand({ type: 'set-deflection', deg: next }, 'pointer')
      return
    }
    const total = wristDragRotation(dx)
    const step = total - current.sentRotationDeg
    if (step === 0) return
    current.sentRotationDeg = total
    onCommand({ type: 'rotate', deg: step }, 'pointer')
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    drag.current = null
  }

  return (
    <div
      className={styles.headDrag}
      aria-hidden="true"
      data-head-drag={lever && wrist ? 'lever wrist' : lever ? 'lever' : 'wrist'}
      data-head-drag-enabled={enabled ? 'true' : 'false'}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  )
}

/** What the close-up says the hand can do there, for the controls this step has. */
export function headDragHint(controls: readonly ScopeControlKey[]): string | null {
  const lever = controls.includes('deflect')
  const wrist = controls.includes('rotate')
  if (lever && wrist) return 'Drag up or down to move the lever. Drag sideways to turn your wrist.'
  if (lever) return 'Drag up or down to move the lever.'
  if (wrist) return 'Drag sideways to turn your wrist.'
  return null
}
