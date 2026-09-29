'use client'

import { pleuralZone } from '../../content/pleuralZones'
import styles from './space-pane.module.css'
import { SpaceCrossSection } from './SpaceCrossSection'
import { SpacePaneShell } from './SpacePaneShell'
import { DOCK_WORDS, VIEW_WORDS } from './spaceWords'
import { spaceControlId, type SpacePaneProps, type SpacePaneState } from './types'

/**
 * The space pane without WebGL: the Chest view as a cut through the space, the Scope view in words,
 * the control dock, the model's estimate and the keys. Everything it shows comes from the state it
 * is given, the same state the 3D scene draws, so the same commands give the same ledger with it or
 * without it.
 */
export function SpaceFallbackPane(props: SpacePaneProps & { readonly note?: string }) {
  return <SpacePaneShell {...props} views={<SpaceFallbackViews state={props.state} />} />
}

/** The Chest view as a cut, and the Scope view in words. */
export function SpaceFallbackViews({ state }: { readonly state: SpacePaneState }) {
  const inViewWords =
    state.inView.length === 0
      ? VIEW_WORDS.nothingInView
      : `${VIEW_WORDS.inView}: ${state.inView.map((zone) => pleuralZone(zone).name).join(', ')}.`
  return (
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
  )
}
