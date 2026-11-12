'use client'
import Image from 'next/image'
import { useState } from 'react'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import ebusAnnotations from '../../../../EBUS-course/apps/web/src/content/ebus-annotations.json'
import styles from './course.module.css'
export const STATION_IDS = Object.keys(media) as (keyof typeof media)[]

/**
 * The owner's outlines for a station's ultrasound still (2026-11-11). They were already in the
 * teaching library (`ebus-annotations.json`, keyed by each still's `annotationKey`) and drawn by
 * the lab app's own explorer; this course showed marked CT and airway images but never these.
 *
 * Each outline is numbered on the image and named in a list under it, because names written on
 * the image run into each other where two nodes lie side by side. Two outlines with the same
 * station label are two distinct nodes in that station (confirmed by the owner for 2L, 4L, 10R
 * and 11Ri).
 */
interface StillRegion {
  label: string
  /** [x, y] in the still's own pixels. */
  points: number[][]
}
interface StillAnnotation {
  width: number
  height: number
  regions: StillRegion[]
}
export function stillAnnotation(annotationKey: string | undefined): StillAnnotation | undefined {
  return annotationKey
    ? (ebusAnnotations as Record<string, StillAnnotation | undefined>)[annotationKey]
    : undefined
}
/** How an outline's label is shown: the course's spelling and sentence case, nodes called nodes. */
export function stillRegionName(label: string) {
  if (/^station /i.test(label)) return label + ' node'
  const name = label.replace(/azygous/i, 'azygos').toLowerCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}
export const stillRegionKind = (label: string) =>
  /^station /i.test(label) ? 'node' : /lung/i.test(label) ? 'lung' : 'vessel'
export const STILL_COLOURS = { node: '#78e68c', vessel: '#7dc3ff', lung: '#ffcd7d' } as const
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
  const outlines = stillAnnotation('annotationKey' in asset ? asset.annotationKey : undefined)
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
      <div className={styles.stillFrame}>
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
        {marked && outlines && (
          <svg
            className={styles.stillOverlay}
            viewBox={`0 0 ${outlines.width} ${outlines.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            data-still-outlines={id}
          >
            {outlines.regions.map((region, index) => {
              const colour = STILL_COLOURS[stillRegionKind(region.label)]
              const cx = region.points.reduce((sum, p) => sum + p[0], 0) / region.points.length
              const cy = region.points.reduce((sum, p) => sum + p[1], 0) / region.points.length
              const r = outlines.width * 0.019
              return (
                <g key={index} data-still-region={stillRegionKind(region.label)}>
                  <polygon
                    points={region.points.map((p) => p[0] + ',' + p[1]).join(' ')}
                    fill="none"
                    stroke={colour}
                    strokeWidth={outlines.width * 0.004}
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="#06161c"
                    stroke={colour}
                    strokeWidth={r * 0.14}
                  />
                  <text
                    x={cx}
                    y={cy + r * 0.38}
                    textAnchor="middle"
                    fill="#f4fbfa"
                    fontSize={r * 1.15}
                    fontWeight="700"
                  >
                    {index + 1}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
      {marked && outlines && (
        <ol className={styles.stillLegend} data-still-legend>
          {outlines.regions.map((region, index) => (
            <li key={index} data-kind={stillRegionKind(region.label)}>
              <span aria-hidden="true">{index + 1}</span>
              {stillRegionName(region.label)}
            </li>
          ))}
        </ol>
      )}
      {!reveal && outlines && (
        <button
          className={styles.secondary}
          aria-pressed={marked}
          data-still-outline-toggle
          onClick={() => setMarked((v) => !v)}
        >
          {marked ? 'Hide outlines' : 'Show outlines'}
        </button>
      )}
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
