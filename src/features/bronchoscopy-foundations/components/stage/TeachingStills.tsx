'use client'

import { useRef, useState } from 'react'
import {
  TEACHING_STILLS,
  TEACHING_STILL_SIZE,
  teachingStillUrl,
  teachingStillsNote,
  type TeachingStillId,
} from '../../content/teachingStills'
import { MediaEnlargeDialog } from './MediaEnlargeDialog'
import styles from './course-flow.module.css'

/**
 * A teaching screen's pictures, drawn from the course's 3D models: one picture, or a small grid,
 * each with its caption. A picture opens larger when it is pressed.
 */
export function TeachingStills({
  ids,
  heading,
}: {
  readonly ids: readonly TeachingStillId[]
  /** A line over the pictures, when the screen needs to say what the set is. */
  readonly heading?: string
}) {
  const [open, setOpen] = useState<TeachingStillId | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const note = teachingStillsNote(ids)
  return (
    <section className={styles.stills} data-teaching-stills data-count={ids.length}>
      {heading ? <h3 className={styles.stillsHeading}>{heading}</h3> : null}
      <div className={styles.stillsGrid}>
        {ids.map((id) => {
          const still = TEACHING_STILLS[id]
          return (
            <figure key={id} className={styles.still} data-teaching-still={id}>
              <button
                type="button"
                className={styles.stillButton}
                aria-label={`Enlarge the picture: ${still.caption}`}
                onClick={(event) => {
                  opener.current = event.currentTarget
                  setOpen(id)
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={teachingStillUrl(id)}
                  alt={still.alt}
                  width={TEACHING_STILL_SIZE.width}
                  height={TEACHING_STILL_SIZE.height}
                  loading="lazy"
                  decoding="async"
                />
              </button>
              <figcaption>{still.caption}</figcaption>
            </figure>
          )
        })}
      </div>
      <p className={styles.stillsNote}>{note}</p>
      <MediaEnlargeDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? TEACHING_STILLS[open].caption : ''}
        returnFocusTo={opener}
      >
        {open ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.stillLarge}
            src={teachingStillUrl(open)}
            alt={TEACHING_STILLS[open].alt}
            width={TEACHING_STILL_SIZE.width}
            height={TEACHING_STILL_SIZE.height}
          />
        ) : null}
      </MediaEnlargeDialog>
    </section>
  )
}
