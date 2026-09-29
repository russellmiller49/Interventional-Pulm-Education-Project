'use client'

import type { MouseEvent, PointerEvent, ReactNode } from 'react'

import {
  CONTROL_PANEL_LABEL,
  MODEL_CONTROLS,
  modelControl,
  type ControlId,
} from '../../content/controlPanel'
import { curriculumSection } from '../../content/curriculum'
import styles from './space-pane.module.css'
import {
  DEPTH_WORDS,
  DOCK_WORDS,
  KEY_WORDS,
  PIVOT_WORDS,
  ROLL_WORDS,
  taughtInWords,
} from './spaceWords'
import {
  PIVOT_HAND_DIRECTIONS,
  spaceControlId,
  type SpaceCommand,
  type SpaceInputMode,
  type SpacePaneProps,
} from './types'
import { useHeldCommand } from './useHeldCommand'

/**
 * The controls this contract has commands for. The others are shown with a note saying where they
 * are used from; a section that makes one of them usable needs the contract extended first.
 */
export const DOCK_OPERABLE_CONTROLS: readonly ControlId[] = ['scope']

/**
 * The control dock: the second control's three parts as buttons that repeat while held, the other
 * controls the section shows, and the model's waiting clock under reduced motion. While the anatomy
 * is loading or unavailable, the buttons stay in place and say why they wait; reading and the rest of
 * the page stay usable. Buttons are marked unavailable rather than disabled, so the one with focus
 * keeps it when the model pauses.
 */
export function ControlDock({ state, shown, operable, reducedMotion, onCommand }: SpacePaneProps) {
  const ready = state.readiness.kind === 'ready'
  const scopeUsable = ready && operable.includes('scope')
  const hold = useHeldCommand(onCommand, { enabled: scopeUsable, reducedMotion })
  const unsupported = operable.filter((id) => !DOCK_OPERABLE_CONTROLS.includes(id))
  if (unsupported.length > 0) {
    throw new Error(`The space pane has no commands for: ${unsupported.join(', ')}`)
  }

  const holdButton = (key: string, command: SpaceCommand, label: string): ReactNode => {
    const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !scopeUsable) return
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      const input: SpaceInputMode = event.pointerType === 'touch' ? 'touch' : 'pointer'
      hold.start(command, input)
    }
    // A click from the keyboard (no pointer, so no detail) is one step; the pointer's own step
    // came with the press.
    const onClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 && scopeUsable) onCommand(command, 'keyboard')
    }
    return (
      <button
        key={key}
        id={spaceControlId(key)}
        type="button"
        className={styles.holdButton}
        aria-disabled={!scopeUsable}
        onPointerDown={onPointerDown}
        onPointerUp={hold.stop}
        onPointerCancel={hold.stop}
        onLostPointerCapture={hold.stop}
        onContextMenu={(event) => event.preventDefault()}
        onClick={onClick}
      >
        {label}
      </button>
    )
  }

  const scope = modelControl('scope')
  const part = (id: string) => scope.parts.find((entry) => entry.id === id)
  const headingId = spaceControlId('dock-heading')

  return (
    <section className={styles.dock} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.dockHeading}>
        {CONTROL_PANEL_LABEL}
      </h3>
      {state.readiness.kind !== 'ready' ? (
        <div className={styles.paused} role="status">
          <p>
            {state.readiness.kind === 'loading' ? state.readiness.what : state.readiness.why}{' '}
            {DOCK_WORDS.paused}
          </p>
          {state.readiness.kind === 'unavailable' && state.readiness.canRetry ? (
            <button
              id={spaceControlId('retry')}
              type="button"
              className={styles.actionButton}
              onClick={() => onCommand({ kind: 'retry-geometry' }, 'pointer')}
            >
              {DOCK_WORDS.retry}
            </button>
          ) : null}
        </div>
      ) : null}
      {MODEL_CONTROLS.filter((control) => shown.includes(control.id)).map((control) => {
        const usable = operable.includes(control.id)
        const note = usable ? null : (
          <p className={styles.shownNote}>
            {taughtInWords(curriculumSection(control.taughtIn).title)}
          </p>
        )
        if (control.id !== 'scope') {
          return (
            <div key={control.id} className={styles.shownControl} data-control={control.id}>
              <h4 className={styles.controlName}>{control.name}</h4>
              {note}
            </div>
          )
        }
        return (
          <div key={control.id} className={styles.scopeControl} data-control="scope">
            <h4 className={styles.controlName}>{control.name}</h4>
            {note}
            <div
              role="group"
              aria-labelledby={spaceControlId('pivot-name')}
              className={styles.part}
            >
              <p id={spaceControlId('pivot-name')} className={styles.partName}>
                {part('pivot')?.name}
              </p>
              <p className={styles.partNote}>{DOCK_WORDS.pivotNote}</p>
              <div className={styles.pivotPad}>
                {PIVOT_HAND_DIRECTIONS.map((hand) =>
                  holdButton(`pivot-${hand}`, { kind: 'pivot', hand }, PIVOT_WORDS[hand]),
                )}
              </div>
            </div>
            <div
              role="group"
              aria-labelledby={spaceControlId('depth-name')}
              className={styles.part}
            >
              <p id={spaceControlId('depth-name')} className={styles.partName}>
                {part('depth')?.name}
              </p>
              <div className={styles.buttonRow}>
                {holdButton('depth-in', { kind: 'depth', direction: 'in' }, DEPTH_WORDS.in)}
                {holdButton('depth-out', { kind: 'depth', direction: 'out' }, DEPTH_WORDS.out)}
              </div>
            </div>
            <div role="group" aria-labelledby={spaceControlId('roll-name')} className={styles.part}>
              <p id={spaceControlId('roll-name')} className={styles.partName}>
                {part('roll')?.name}
              </p>
              <p className={styles.partNote}>{DOCK_WORDS.rollNote}</p>
              <div className={styles.buttonRow}>
                {holdButton(
                  'roll-anticlockwise',
                  { kind: 'roll', direction: 'anticlockwise' },
                  ROLL_WORDS.anticlockwise,
                )}
                {holdButton(
                  'roll-clockwise',
                  { kind: 'roll', direction: 'clockwise' },
                  ROLL_WORDS.clockwise,
                )}
              </div>
            </div>
            {usable ? (
              <p className={styles.partNote}>
                {reducedMotion ? KEY_WORDS.reducedNote : DOCK_WORDS.holdNote}
              </p>
            ) : null}
          </div>
        )
      })}
      {reducedMotion && state.clock.held ? (
        <div className={styles.stepControl}>
          <h4 className={styles.controlName}>{DOCK_WORDS.stepHeading}</h4>
          <p className={styles.partNote}>{DOCK_WORDS.stepNote}</p>
          <button
            id={spaceControlId('step')}
            type="button"
            className={styles.actionButton}
            onClick={() => onCommand({ kind: 'step-clock' }, 'pointer')}
          >
            {DOCK_WORDS.step}
          </button>
        </div>
      ) : null}
    </section>
  )
}
