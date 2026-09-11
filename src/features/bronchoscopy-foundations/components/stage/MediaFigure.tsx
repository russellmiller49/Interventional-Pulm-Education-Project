'use client'

import { useEffect, useState } from 'react'

import {
  CT_CORRELATION_URL,
  type CtCorrelationData,
} from '@/lib/airway-anatomy-lesson/ct-correlation'
import { QUIZ_FRAMES_URL, type QuizFramesData } from '@/lib/airway-anatomy-lesson/airway-quiz'

import { SCOPE_PHOTO_ATLAS_URL, type MediaRef } from '../../content/media'
import styles from './bronch-stage.module.css'

/**
 * One authored media reference, drawn from the real teaching files already under `public/`.
 *
 * The figure never prints the structure's or the annotation's name: an identify row asks the
 * learner to name what the image shows, so the only words here are the caption the section
 * authored (passed by the caller) and a neutral description. Every file carries a pending
 * asset-register status (A19), which the caption strip below the figure says once.
 */
interface ScopePhotoAtlas {
  readonly images: readonly {
    readonly id: string
    readonly src: string
    readonly width: number
    readonly height: number
    readonly annotations: readonly { readonly id: string; readonly points: readonly number[][] }[]
  }[]
}

const manifests = new Map<string, Promise<unknown>>()

function fetchManifest<T>(url: string): Promise<T> {
  const cached = manifests.get(url)
  if (cached) return cached as Promise<T>
  const promise = (async () => {
    if (typeof fetch !== 'function') throw new Error('No fetch in this environment')
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
    return (await response.json()) as T
  })()
  promise.catch(() => manifests.delete(url))
  manifests.set(url, promise)
  return promise
}

function useManifest<T>(url: string): T | null | 'failed' {
  const [data, setData] = useState<T | null | 'failed'>(null)
  useEffect(() => {
    let cancelled = false
    fetchManifest<T>(url).then(
      (loaded) => {
        if (!cancelled) setData(loaded)
      },
      () => {
        if (!cancelled) setData('failed')
      },
    )
    return () => {
      cancelled = true
    }
  }, [url])
  return data
}

export function mediaDescription(media: MediaRef): string {
  switch (media.kind) {
    case 'scope-photo':
      return media.highlight
        ? 'A photograph of the bronchoscope with one part outlined'
        : 'A photograph of the bronchoscope'
    case 'endoscopic-still':
      return media.outline
        ? 'An endoscopic still with one opening outlined'
        : 'An endoscopic still from the annotated survey'
    case 'ct-slice':
      return `A CT slice, ${media.plane} plane`
    case 'survey-clip':
      return 'A still from the annotated survey, at this stop'
  }
}

export const MEDIA_PENDING_NOTE = 'Authored teaching media, pending clinical review.'

function Frame({
  src,
  width,
  height,
  alt,
  outline,
}: {
  readonly src: string
  readonly width: number
  readonly height: number
  readonly alt: string
  readonly outline?: readonly number[] | null
}) {
  return (
    <span className={styles.figureFrame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static teaching files under public/ */}
      <img className={styles.figureImage} src={src} alt={alt} width={width} height={height} />
      {outline && outline.length >= 6 ? (
        <svg
          className={styles.figureOverlay}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points={outline.join(' ')}
            fill="rgba(113, 225, 229, 0.12)"
            stroke="#71e1e5"
            strokeWidth={Math.max(2, width / 300)}
          />
        </svg>
      ) : null}
    </span>
  )
}

function ScopePhotoFigure({
  media,
}: {
  readonly media: Extract<MediaRef, { kind: 'scope-photo' }>
}) {
  const atlas = useManifest<ScopePhotoAtlas>(SCOPE_PHOTO_ATLAS_URL)
  if (atlas === null) return <p role="status">Loading the photograph…</p>
  if (atlas === 'failed') return <p role="status">The photograph could not be loaded.</p>
  const image = atlas.images.find((candidate) => candidate.id === media.imageId)
  if (!image) return <p role="status">The photograph is not in the atlas.</p>
  const annotation = media.highlight
    ? image.annotations.find((candidate) => candidate.id === media.highlight)
    : undefined
  return (
    <Frame
      src={image.src}
      width={image.width}
      height={image.height}
      alt={mediaDescription(media)}
      outline={annotation ? annotation.points.flat() : null}
    />
  )
}

function StillFigure({
  media,
}: {
  readonly media: Extract<MediaRef, { kind: 'endoscopic-still' | 'survey-clip' }>
}) {
  const frames = useManifest<QuizFramesData>(QUIZ_FRAMES_URL)
  if (frames === null) return <p role="status">Loading the still…</p>
  if (frames === 'failed') return <p role="status">The still could not be loaded.</p>
  const structure = frames.structures[media.structureId]
  if (!structure) return <p role="status">The still is not in the atlas.</p>
  const outline = media.kind === 'endoscopic-still' && media.outline ? structure.poly : null
  return (
    <Frame
      src={structure.img}
      width={frames.meta.width}
      height={frames.meta.height}
      alt={mediaDescription(media)}
      outline={outline}
    />
  )
}

function CtFigure({ media }: { readonly media: Extract<MediaRef, { kind: 'ct-slice' }> }) {
  const ct = useManifest<CtCorrelationData>(CT_CORRELATION_URL)
  if (ct === null) return <p role="status">Loading the CT slice…</p>
  if (ct === 'failed') return <p role="status">The CT slice could not be loaded.</p>
  const structure = ct.structures[media.structureId]
  if (!structure) return <p role="status">The CT slice is not in the atlas.</p>
  const src = media.plane === 'axial' ? structure.axial : structure.coronal
  return <Frame src={src} width={512} height={512} alt={mediaDescription(media)} />
}

export function MediaFigure({
  media,
  caption,
  compact = false,
}: {
  readonly media: MediaRef
  readonly caption?: string
  readonly compact?: boolean
}) {
  return (
    <figure
      className={`${styles.figure} ${compact ? styles.thumb : ''}`}
      data-media-kind={media.kind}
      data-media-id={'imageId' in media ? media.imageId : media.structureId}
    >
      {media.kind === 'scope-photo' ? (
        <ScopePhotoFigure media={media} />
      ) : media.kind === 'ct-slice' ? (
        <CtFigure media={media} />
      ) : (
        <StillFigure media={media} />
      )}
      {caption ? <figcaption className={styles.figureCaption}>{caption}</figcaption> : null}
    </figure>
  )
}
