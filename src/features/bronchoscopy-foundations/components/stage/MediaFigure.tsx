'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

import {
  CT_CORRELATION_URL,
  type CtCorrelationData,
} from '@/lib/airway-anatomy-lesson/ct-correlation'
import { QUIZ_FRAMES_URL, type QuizFramesData } from '@/lib/airway-anatomy-lesson/airway-quiz'

import { SCOPE_PHOTO_ATLAS_URL, type MediaRef } from '../../content/media'
import styles from './bronch-stage.module.css'
import { MediaEnlargeDialog } from './MediaEnlargeDialog'
import { detailRegion, needsDetail, pointBounds, type DetailRegion } from './mediaDetail'

/**
 * One authored media reference, drawn from the real teaching files already under `public/`.
 *
 * The figure never prints the structure's or the annotation's name: an identify row asks the
 * learner to name what the image shows, so the only words here are the caption the section
 * authored (passed by the caller), the description the caller passes for a text alternative, and a
 * neutral description otherwise. Every file carries a pending asset-register status (A19), which
 * the caption strip below the figure says once.
 *
 * Every figure has a real Enlarge button (fellow walkthrough A18, A28, A29, SUP-13): the same file
 * and the same registered outline in a dialog sized to the viewport. Where a registered outline is
 * a small part of a photograph, the card also shows a detail cut from the same file around it, so
 * the outlined part can be read without opening anything. The image and its outline share one
 * coordinate system — the file's own — so the outline stays on its part at every size.
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
  const [loaded, setLoaded] = useState<{ url: string; data: T | 'failed' } | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchManifest<T>(url).then(
      (data) => {
        if (!cancelled) setLoaded({ url, data })
      },
      () => {
        if (!cancelled) setLoaded({ url, data: 'failed' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [url])
  return loaded?.url === url ? loaded.data : null
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
        : 'An endoscopic still from the course’s normal survey, with nothing marked on it'
    case 'ct-slice':
      return `A CT slice, ${media.plane} plane`
    case 'survey-clip':
      return 'A still from the course’s normal survey, at this stop, with nothing marked on it'
  }
}

export const MEDIA_PENDING_NOTE = 'Teaching media, pending clinical review.'

/**
 * The stills are frames of a recorded bronchoscopy video. The small rectangle in their lower corner
 * is part of that recorded frame, not a control on this page (SUP-13).
 */
export const PROCESSOR_ICON_NOTE =
  'The small rectangle in the lower corner is part of the recorded video frame, not a control on this page.'

/** What the enlarged view shows, so it is never read as a new or annotated picture. */
export const ENLARGED_SAME_FILE_NOTE =
  'The same file and outline as on the card, shown larger. Nothing is added to the image.'

function manifestUrl(media: MediaRef): string {
  switch (media.kind) {
    case 'scope-photo':
      return SCOPE_PHOTO_ATLAS_URL
    case 'ct-slice':
      return CT_CORRELATION_URL
    default:
      return QUIZ_FRAMES_URL
  }
}

interface ResolvedImage {
  readonly src: string
  readonly width: number
  readonly height: number
  /** The registered outline, as flat x, y pairs in the file's own coordinates. */
  readonly outline: readonly number[] | null
  readonly detail: DetailRegion | null
}

/** The file, its size and its registered outline, or why it cannot be shown. */
function resolveImage(media: MediaRef, data: unknown): ResolvedImage | string {
  switch (media.kind) {
    case 'scope-photo': {
      const atlas = data as ScopePhotoAtlas
      const image = atlas.images.find((candidate) => candidate.id === media.imageId)
      if (!image) return 'The photograph is not in the atlas.'
      const annotation = media.highlight
        ? image.annotations.find((candidate) => candidate.id === media.highlight)
        : undefined
      const outline = annotation ? annotation.points.flat() : null
      const bounds = outline ? pointBounds(outline) : null
      return {
        src: image.src,
        width: image.width,
        height: image.height,
        outline,
        detail:
          bounds && needsDetail(bounds, image.width, image.height)
            ? detailRegion(bounds, image.width, image.height)
            : null,
      }
    }
    case 'ct-slice': {
      const ct = data as CtCorrelationData
      const structure = ct.structures[media.structureId]
      if (!structure) return 'The CT slice is not in the atlas.'
      return {
        src: media.plane === 'axial' ? structure.axial : structure.coronal,
        width: 512,
        height: 512,
        outline: null,
        detail: null,
      }
    }
    case 'endoscopic-still':
    case 'survey-clip': {
      const frames = data as QuizFramesData
      const structure = frames.structures[media.structureId]
      if (!structure) return 'The still is not in the atlas.'
      return {
        src: structure.img,
        width: frames.meta.width,
        height: frames.meta.height,
        outline: media.kind === 'endoscopic-still' && media.outline ? structure.poly : null,
        detail: null,
      }
    }
  }
}

function loadingWords(media: MediaRef): { loading: string; failed: string } {
  switch (media.kind) {
    case 'scope-photo':
      return { loading: 'Loading the photograph…', failed: 'The photograph could not be loaded.' }
    case 'ct-slice':
      return { loading: 'Loading the CT slice…', failed: 'The CT slice could not be loaded.' }
    default:
      return { loading: 'Loading the still…', failed: 'The still could not be loaded.' }
  }
}

function Frame({
  image,
  alt,
  detailMarked,
  large = false,
}: {
  readonly image: ResolvedImage
  readonly alt: string
  /** Mark, on the whole photograph, the window the detail beside it shows. */
  readonly detailMarked: boolean
  readonly large?: boolean
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const { src, width, height, outline, detail } = image
  if (failedSource === src)
    return (
      <span role="status" data-media-state="failed">
        The teaching image could not be loaded. Reload to try again; a missing image does not
        establish visual recognition.
      </span>
    )
  return (
    <span
      className={`${styles.figureFrame} ${large ? styles.figureFrameLarge : ''}`}
      style={{ '--media-aspect': width / height } as CSSProperties}
      data-media-frame-size={large ? 'enlarged' : 'card'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static teaching files under public/ */}
      <img
        className={styles.figureImage}
        src={src}
        onError={() => setFailedSource(src)}
        alt={alt}
        width={width}
        height={height}
      />
      {(outline && outline.length >= 6) || (detailMarked && detail) ? (
        <svg
          className={styles.figureOverlay}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          data-media-overlay
        >
          {outline && outline.length >= 6 ? (
            <polygon
              points={outline.join(' ')}
              fill="rgba(113, 225, 229, 0.12)"
              stroke="#71e1e5"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              data-media-outline
            />
          ) : null}
          {detailMarked && detail ? (
            <rect
              x={detail.x}
              y={detail.y}
              width={detail.width}
              height={detail.height}
              fill="none"
              stroke="#ffce57"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
              data-media-detail-window
            />
          ) : null}
        </svg>
      ) : null}
    </span>
  )
}

/** A window onto the same file around the registered outline; the outline keeps its coordinates. */
function Detail({
  image,
  large = false,
}: {
  readonly image: ResolvedImage
  readonly large?: boolean
}) {
  const { detail, src, width, height, outline } = image
  if (!detail) return null
  return (
    <span className={`${styles.detailFrame} ${large ? styles.detailFrameLarge : ''}`}>
      <svg
        className={styles.detail}
        viewBox={`${detail.x} ${detail.y} ${detail.width} ${detail.height}`}
        aria-hidden="true"
        data-media-detail={large ? 'enlarged' : 'card'}
      >
        <image href={src} x={0} y={0} width={width} height={height} preserveAspectRatio="none" />
        {outline && outline.length >= 6 ? (
          <polygon
            points={outline.join(' ')}
            fill="none"
            stroke="#71e1e5"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            data-media-outline
          />
        ) : null}
      </svg>
      <span className={styles.detailLabel}>Detail, same photograph</span>
    </span>
  )
}

export function MediaFigure({
  media,
  caption,
  compact = false,
  alt,
  enlargeLabel,
  dialogTitle,
}: {
  readonly media: MediaRef
  readonly caption?: string
  readonly compact?: boolean
  /** An item-specific text alternative; the neutral description is used otherwise (A20). */
  readonly alt?: string
  /** The Enlarge button's accessible name; it always starts with the visible word "Enlarge". */
  readonly enlargeLabel?: string
  readonly dialogTitle?: string
}) {
  const data = useManifest<unknown>(manifestUrl(media))
  const [open, setOpen] = useState(false)
  const enlargeButton = useRef<HTMLButtonElement>(null)
  const description = alt ?? mediaDescription(media)
  const words = loadingWords(media)
  const resolved = data === null || data === 'failed' ? data : resolveImage(media, data)
  const still = media.kind === 'endoscopic-still' || media.kind === 'survey-clip'
  return (
    <figure
      className={`${styles.figure} ${compact ? styles.thumb : ''}`}
      data-media-kind={media.kind}
      data-media-id={'imageId' in media ? media.imageId : media.structureId}
      data-media-has-detail={
        resolved && typeof resolved === 'object' && resolved.detail ? 'true' : undefined
      }
    >
      {resolved === null ? (
        <p role="status">{words.loading}</p>
      ) : resolved === 'failed' ? (
        <p role="status" data-media-state="failed">
          {words.failed}
        </p>
      ) : typeof resolved === 'string' ? (
        <p role="status" data-media-state="failed">
          {resolved}
        </p>
      ) : (
        <>
          <div className={styles.figureBody} data-has-detail={resolved.detail ? 'true' : undefined}>
            <Frame image={resolved} alt={description} detailMarked />
            <Detail image={resolved} />
          </div>
          <div className={styles.figureTools}>
            <button
              ref={enlargeButton}
              type="button"
              className={styles.enlarge}
              aria-haspopup="dialog"
              aria-label={enlargeLabel ?? 'Enlarge this image'}
              onClick={() => setOpen(true)}
              data-media-enlarge
            >
              Enlarge
            </button>
          </div>
          <MediaEnlargeDialog
            open={open}
            onClose={() => setOpen(false)}
            title={dialogTitle ?? caption ?? 'Teaching image, enlarged'}
            returnFocusTo={enlargeButton}
          >
            <p data-media-dialog-description>{description}</p>
            <div
              className={styles.enlargedPair}
              data-has-detail={resolved.detail ? 'true' : undefined}
            >
              <Frame image={resolved} alt={description} detailMarked large />
              <Detail image={resolved} large />
            </div>
            <p className={styles.figureCaption}>
              {ENLARGED_SAME_FILE_NOTE}
              {still ? ` ${PROCESSOR_ICON_NOTE}` : ''}
            </p>
          </MediaEnlargeDialog>
        </>
      )}
      {caption ? <figcaption className={styles.figureCaption}>{caption}</figcaption> : null}
    </figure>
  )
}
