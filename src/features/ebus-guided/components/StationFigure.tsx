'use client'
import Image from 'next/image'
import { useState } from 'react'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import styles from './course.module.css'
export const STATION_IDS = Object.keys(media) as (keyof typeof media)[]
export function StationFigure({
  station,
  allowSelect = false,
}: {
  station: string
  allowSelect?: boolean
}) {
  const [selected, setSelected] = useState(station)
  const [view, setView] = useState<'ctVariants' | 'bronchoscopyVariants' | 'ebusVariants'>(
    'ctVariants',
  )
  const [plane, setPlane] = useState(0)
  const [marked, setMarked] = useState(false)
  const id = selected in media ? (selected as keyof typeof media) : '7'
  const variants = media[id][view]
  const asset = variants[Math.min(plane, variants.length - 1)]
  const reveal = 'revealImage' in asset ? asset.revealImage : undefined
  return (
    <section className={styles.figure}>
      <h2>Station {id}: compare the views</h2>
      <p className={styles.muted}>
        Existing EBUS teaching library · Representative views, not a synchronized patient
        examination.
      </p>
      {allowSelect && (
        <label>
          Station{' '}
          <select
            value={id}
            onChange={(e) => {
              setSelected(e.target.value)
              setPlane(0)
              setMarked(false)
            }}
          >
            {STATION_IDS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <div className={styles.diagramLabels} role="group" aria-label="Station image type">
        {(
          [
            ['ctVariants', 'CT'],
            ['bronchoscopyVariants', 'Bronchoscopy'],
            ['ebusVariants', 'Ultrasound'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => {
              setView(key)
              setPlane(0)
              setMarked(false)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {variants.length > 1 && (
        <div className={styles.diagramLabels}>
          {variants.map((v, i) => (
            <button key={v.id} aria-pressed={i === plane} onClick={() => setPlane(i)}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      <Image
        width={800}
        height={650}
        unoptimized
        src={'/socal-ebus-course/app' + (marked && reveal ? reveal : asset.image)}
        alt={
          view === 'ctVariants'
            ? 'Thoracic CT reference for station ' + id
            : view === 'bronchoscopyVariants'
              ? 'Airway landmark reference for station ' + id
              : 'Ultrasound reference for station ' + id
        }
      />
      {reveal && (
        <button
          className={styles.secondary}
          aria-pressed={marked}
          onClick={() => setMarked((v) => !v)}
        >
          {marked ? 'Hide annotations' : 'Show annotations'}
        </button>
      )}
      <p className={styles.muted}>
        Use the airway and vascular boundaries taught in this lesson. A single ultrasound frame
        alone does not establish station identity or histology.
      </p>
    </section>
  )
}
