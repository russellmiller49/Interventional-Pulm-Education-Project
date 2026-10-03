'use client'

import type { MediaRef } from '../../content/media'
import styles from './bronch-stage.module.css'
import { MEDIA_PENDING_NOTE, MediaFigure } from './MediaFigure'

/**
 * The Simulator panel when a section reads from real images: the figures and the authored caption.
 *
 * Where a section sets two or more images side by side to be compared (fellow walkthrough A25),
 * they sit in one row at a height a laptop screen can hold together, each with the note saying what
 * it is and which way it faces, and the comparison note under both. Each still opens full size
 * from its own Enlarge button, so the row never has to be as large as either image can be.
 */
export function MediaWorkspace({
  media,
  caption,
  mediaNotes,
  comparisonNote,
}: {
  readonly media: readonly MediaRef[]
  readonly caption: string
  readonly mediaNotes?: readonly string[]
  readonly comparisonNote?: string
}) {
  const compare = media.length > 1
  return (
    <div className={styles.workspace} data-media-workspace>
      <p className={styles.caption} data-workspace-caption>
        {caption}
      </p>
      <div className={styles.mediaGrid} data-media-compare={compare ? 'true' : undefined}>
        {media.map((entry, index) => (
          <div key={`${entry.kind}-${index}`} className={styles.mediaCell}>
            <MediaFigure
              media={entry}
              enlargeLabel={
                compare ? `Enlarge image ${index + 1} of ${media.length}` : 'Enlarge this image'
              }
              dialogTitle={compare ? `Image ${index + 1} of ${media.length}, enlarged` : undefined}
            />
            {mediaNotes?.[index] ? (
              <p className={styles.mediaNote} data-media-frame>
                {mediaNotes[index]}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {comparisonNote ? (
        <p className={styles.mediaNote} data-media-comparison>
          {comparisonNote}
        </p>
      ) : null}
      <p className={styles.boundaryLine} data-model-boundary>
        {MEDIA_PENDING_NOTE}
      </p>
    </div>
  )
}
