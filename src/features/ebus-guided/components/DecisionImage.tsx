'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import styles from './course.module.css'
export function DecisionImage({ station }: { station: string }) {
  const [url, setUrl] = useState(''),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    let disposed = false,
      objectUrl = ''
    const entry = media[station as keyof typeof media]
    if (!entry) return
    const controller = new AbortController()
    fetch('/socal-ebus-course/app' + entry.ctVariants[0].image, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('image unavailable')
        return r.blob()
      })
      .then((blob) => {
        if (disposed) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [station])
  return (
    <figure className={styles.figure}>
      {url ? (
        <Image
          unoptimized
          width={900}
          height={650}
          src={url}
          alt="Axial thoracic CT reference. Use the target location and boundaries stated in the clinical situation."
        />
      ) : (
        <p role="status">
          {failed
            ? 'The reference image could not load. The stated anatomical description provides the information for this decision.'
            : 'Loading reference CT…'}
        </p>
      )}
      <figcaption className={styles.muted}>
        Reference CT · Use the anatomical description in the case. Station labels and teaching
        annotations are withheld until debrief.
      </figcaption>
    </figure>
  )
}
