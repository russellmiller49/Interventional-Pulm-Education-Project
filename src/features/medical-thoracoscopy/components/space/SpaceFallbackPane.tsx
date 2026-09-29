'use client'

import { useState, type KeyboardEvent } from 'react'

import { pleuralZone } from '../../content/pleuralZones'
import { ControlDock } from './ControlDock'
import { KeyMapHelp } from './KeyMapHelp'
import styles from './space-pane.module.css'
import { SpaceCrossSection } from './SpaceCrossSection'
import { spaceKeyAction } from './spaceKeyMap'
import { DOCK_WORDS, VIEW_WORDS } from './spaceWords'
import { commandPart, spaceControlId, type SpacePaneProps } from './types'
import { ZoneLedger } from './ZoneLedger'

/**
 * The space pane without WebGL: the Chest view as a cut through the space, the Scope view in words,
 * the control dock, the model's estimate and the keys. Everything it shows comes from the state it
 * is given, the same state the 3D scene draws, so the same commands give the same ledger with it or
 * without it.
 *
 * The keys act while the pane itself has focus, never while a button or field inside it does, so
 * those keep their own keys; the arrows scroll the page everywhere else.
 */
export function SpaceFallbackPane(props: SpacePaneProps) {
  const { state, operable, reducedMotion, onCommand } = props
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

  const inViewWords =
    state.inView.length === 0
      ? VIEW_WORDS.nothingInView
      : `${VIEW_WORDS.inView}: ${state.inView.map((zone) => pleuralZone(zone).name).join(', ')}.`

  return (
    <section
      className={styles.pane}
      aria-label={VIEW_WORDS.paneLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-readiness={state.readiness.kind}
    >
      <div className={styles.views}>
        <figure className={styles.chestView} aria-labelledby={spaceControlId('chest-heading')}>
          <h3 id={spaceControlId('chest-heading')} className={styles.viewHeading}>
            {VIEW_WORDS.chestHeading}
          </h3>
          {state.crossSection ? (
            <SpaceCrossSection section={state.crossSection} ledger={state.ledger} />
          ) : (
            <p className={styles.viewWaiting}>
              {state.readiness.kind === 'loading'
                ? state.readiness.what
                : state.readiness.kind === 'unavailable'
                  ? state.readiness.why
                  : DOCK_WORDS.paused}
            </p>
          )}
          <figcaption className={styles.viewNote}>
            {VIEW_WORDS.chestNote}
            {state.crossSection ? ` ${state.crossSection.seenFrom}` : ''}
          </figcaption>
        </figure>
        <section className={styles.scopeView} aria-labelledby={spaceControlId('scope-heading')}>
          <h3 id={spaceControlId('scope-heading')} className={styles.viewHeading}>
            {VIEW_WORDS.scopeHeading}
          </h3>
          <p className={styles.inView} data-in-view={state.inView.join(' ')}>
            {inViewWords}
          </p>
        </section>
      </div>
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
