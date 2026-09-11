'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

import { loadQuizFrames, type QuizFramesData } from '@/lib/airway-anatomy-lesson/airway-quiz'

import { STILL_STRUCTURE_IDS } from '../../content/media'
import styles from '../bronchoscopy-foundations-hub.module.css'

/**
 * The atlas: one endoscopic still per structure the course can show, in the registry's order,
 * captioned with the structure's name. The stills are the airway-anatomy lesson's, read from its
 * manifest; nothing here is labelled before it is shown, because this page is a reference, not a
 * check.
 */
export function AirwayStillAtlas() {
  const [data, setData] = useState<QuizFramesData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadQuizFrames()
      .then((frames) => {
        if (!cancelled) setData(frames)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) {
    return (
      <p role="status" data-airway-atlas="unavailable">
        The stills could not be loaded. Open the page again later.
      </p>
    )
  }

  if (!data) {
    return (
      <p role="status" data-airway-atlas="loading">
        Loading the stills…
      </p>
    )
  }

  return (
    <ul className={styles.atlas} data-airway-atlas="ready">
      {STILL_STRUCTURE_IDS.map((id) => {
        const structure = data.structures[id]
        if (!structure) return null
        return (
          <li key={id} data-atlas-still={id}>
            <figure>
              <Image
                src={structure.img}
                alt={structure.name}
                width={data.meta.width}
                height={data.meta.height}
                unoptimized
              />
              <figcaption>
                <strong>{structure.name}</strong>
                <span>{structure.short}</span>
              </figcaption>
            </figure>
          </li>
        )
      })}
    </ul>
  )
}
