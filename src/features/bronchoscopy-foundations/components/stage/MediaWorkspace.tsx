'use client'

import type { MediaRef } from '../../content/media'
import styles from './bronch-stage.module.css'
import { MEDIA_PENDING_NOTE, MediaFigure } from './MediaFigure'

/** The Simulator panel when a section reads from real images: the figures and the authored caption. */
export function MediaWorkspace({
  media,
  caption,
}: {
  readonly media: readonly MediaRef[]
  readonly caption: string
}) {
  return (
    <div className={styles.workspace} data-media-workspace>
      <p className={styles.caption} data-workspace-caption>
        {caption}
      </p>
      <div className={styles.mediaGrid}>
        {media.map((entry, index) => (
          <MediaFigure key={`${entry.kind}-${index}`} media={entry} />
        ))}
      </div>
      <p className={styles.boundaryLine} data-model-boundary>
        {MEDIA_PENDING_NOTE}
      </p>
    </div>
  )
}
