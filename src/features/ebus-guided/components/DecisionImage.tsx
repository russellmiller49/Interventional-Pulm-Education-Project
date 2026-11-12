'use client'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import { useHiddenImage } from './useHiddenImage'
import styles from './course.module.css'

/**
 * The reference images a case is read beside: a CT and an ultrasound still of the station the
 * case describes, from the teaching library (the ultrasound was added on 2026-11-11; cases had a
 * CT only, and most had no image at all).
 *
 * Neither is named or outlined here, because a case may ask for the station. Each is shown from
 * an object URL: the library files its images by station, so their addresses would name it. The
 * labelled views open in the debrief (`StationFigure`).
 */
function Picture({ path, alt, label }: { path: string; alt: string; label: string }) {
  const { url, failed } = useHiddenImage(path)
  return (
    <div className={styles.casePicture} data-case-picture={label}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} />
      ) : (
        <p role="status">
          {failed
            ? 'This reference image could not load. The anatomical description in the case provides the information for this decision.'
            : 'Loading reference image…'}
        </p>
      )}
      <span>{label}</span>
    </div>
  )
}
export function DecisionImage({ station }: { station: string }) {
  const entry = media[station as keyof typeof media]
  if (!entry) return null
  const base = '/socal-ebus-course/app'
  const ultrasound = entry.ebusVariants[0]
  return (
    <figure className={styles.figure} data-case-images>
      <div className={styles.casePictures}>
        <Picture
          label="CT"
          path={base + entry.ctVariants[0].image}
          alt="Axial thoracic CT reference. Use the target location and boundaries stated in the clinical situation."
        />
        {ultrasound && (
          <Picture
            label="Ultrasound"
            path={base + ultrasound.image}
            alt="EBUS ultrasound reference for the region the clinical situation describes."
          />
        )}
      </div>
      <figcaption className={styles.muted}>
        Reference CT and ultrasound from the teaching library, not this patient’s own images. Use
        the anatomical description in the case. Station labels and outlines open in the debrief.
      </figcaption>
    </figure>
  )
}
