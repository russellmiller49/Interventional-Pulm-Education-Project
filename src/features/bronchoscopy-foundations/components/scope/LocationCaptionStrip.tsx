'use client'

import { SPINE_STOPS, type SpineStopId } from '../../content/spine'
import styles from './scope-fallback.module.css'

/**
 * The airway as a DOM strip: the location caption printed verbatim, then the six spine stops
 * with the current one marked `aria-current="step"`.
 *
 * This is the indicator the fallback pane and the test double show; Codex's 3D scene may draw
 * the spine its own way but prints the same caption. The strip carries titles only — the caption
 * is the one surface that numbers a stop (`spineCaption`). It never answers anything; answers go
 * through `TreeAnswerFieldset`.
 */
export function LocationCaptionStrip({
  caption,
  current,
}: {
  readonly caption: string
  readonly current: SpineStopId | null
}) {
  return (
    <div>
      <p className={styles.caption} data-location-caption>
        {caption}
      </p>
      <ol className={styles.spineStrip} aria-label="Airway" data-spine-strip>
        {SPINE_STOPS.map((stop) => (
          <li
            key={stop.id}
            aria-current={stop.id === current ? 'step' : undefined}
            data-spine-stop={stop.id}
          >
            {stop.title}
          </li>
        ))}
      </ol>
    </div>
  )
}
