import { DOLPHIN_SPINE } from '../../content/spine'
import type { SpineStopId } from '../../content/types'
import styles from '../stage/dolphin-stage.module.css'

/**
 * The passage drawn as its stops, blowhole first, with the section's stops lit. Shown where a
 * section has no simulator work, so the panel is never blank and the map is always one glance away.
 */
export function DolphinPassageMap({
  lit,
  caption,
}: {
  readonly lit: readonly SpineStopId[]
  readonly caption: string
}) {
  const litSet = new Set(lit)
  return (
    <figure className={styles.simulatorFigure} data-dolphin-passage-map>
      <ol className={styles.passage} aria-label="The passage, blowhole to numbered branch">
        {DOLPHIN_SPINE.map((stop) => (
          <li key={stop.id} data-stop={stop.id} data-lit={litSet.has(stop.id) || undefined}>
            <span className={styles.passageDot} aria-hidden="true" />
            <span>
              <strong>{stop.name}</strong>
              <small>{stop.note}</small>
            </span>
          </li>
        ))}
      </ol>
      <figcaption className={styles.paneCaption}>{caption}</figcaption>
    </figure>
  )
}
