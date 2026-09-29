'use client'

import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { ControlDock } from './ControlDock'
import { KeyMapHelp } from './KeyMapHelp'
import styles from './space-pane.module.css'
import { spaceKeyAction } from './spaceKeyMap'
import { VIEW_WORDS } from './spaceWords'
import { commandPart, type SpacePaneProps } from './types'
import { ZoneLedger } from './ZoneLedger'

/**
 * What every space pane shares, whichever way it draws the views: the keys, the refusal, the control
 * dock, the model's estimate and the key help. The views are given; everything here reads only the
 * state it is given, so the ledger is the same with the 3D scene and without it.
 *
 * The keys act while the pane itself has focus, never while a button or field inside it does, so
 * those keep their own keys; the arrows scroll the page everywhere else.
 */
export function SpacePaneShell(
  props: SpacePaneProps & { readonly views: ReactNode; readonly note?: string },
) {
  const { state, operable, reducedMotion, onCommand, views, note } = props
  const [helpOpen, setHelpOpen] = useState(false)
  const scopeUsable = state.readiness.kind === 'ready' && operable.includes('scope')

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return
    const target = event.target as HTMLElement
    if (target.closest('input, select, textarea, button, [contenteditable="true"]')) return
    const action = spaceKeyAction(event.key)
    if (!action) return
    if (action.kind === 'help') {
      event.preventDefault()
      if (!event.repeat) setHelpOpen((open) => !open)
      return
    }
    if (action.kind === 'retry-geometry') return
    if (action.kind === 'step-clock') {
      if (!(reducedMotion && state.clock.held) || event.repeat) return
      event.preventDefault()
      onCommand(action, 'keyboard')
      return
    }
    if (commandPart(action) === null || !scopeUsable) return
    event.preventDefault()
    // Under reduced motion a key held down still moves one step per press.
    if (reducedMotion && event.repeat) return
    onCommand(action, 'keyboard')
  }

  return (
    <section
      className={styles.pane}
      aria-label={VIEW_WORDS.paneLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-readiness={state.readiness.kind}
    >
      {note ? <p className={styles.paneNote}>{note}</p> : null}
      {views}
      <p className={styles.refusal} role="status" aria-live="polite">
        {state.refusal
          ? `${VIEW_WORDS.refusedPrefix} ${state.refusal.part}. ${state.refusal.words}`
          : ''}
      </p>
      <ControlDock {...props} />
      <ZoneLedger ledger={state.ledger} inView={state.inView} />
      <KeyMapHelp
        open={helpOpen}
        onToggle={() => setHelpOpen((open) => !open)}
        reducedMotion={reducedMotion}
      />
    </section>
  )
}
