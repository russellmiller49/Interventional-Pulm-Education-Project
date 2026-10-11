'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  buildIndex,
  frameForTime,
  loadOverlayData,
  nearestFrame,
  polygonCentroid,
  shapesAt,
  timeForFrame,
  type FrameShape,
  type OverlayIndex,
} from '@/lib/airway-anatomy-lesson/video-atlas'

import styles from './course-flow.module.css'

/**
 * The annotated normal survey, played as the worked example of a survey: one pass from the larynx
 * through the right lung and then the left. The outlines are the survey's own annotation set,
 * drawn over the video and switched off with one control, so the learner can watch the order
 * first with the names and then without them.
 *
 * The clip and its outlines are the airway anatomy lesson's files; nothing is copied or redrawn.
 */
const VIDEO_SRC = '/airway-lesson/airway-survey-cropped.mp4'
const POSTER_SRC = '/airway-lesson/airway-survey-poster-cropped.jpg'

/** Where each part of the pass begins: the first frame the annotation set outlines the structure. */
const PARTS = [
  { id: 'larynx', label: 'Larynx', node: null },
  { id: 'carina', label: 'Carina', node: 'rmb' },
  { id: 'right', label: 'Right lung', node: 'rul' },
  { id: 'left', label: 'Left lung', node: 'lul' },
] as const

function flat(points: readonly number[]): string {
  const pairs: string[] = []
  for (let at = 0; at < points.length; at += 2) pairs.push(`${points[at]},${points[at + 1]}`)
  return pairs.join(' ')
}

export function SurveyVideo() {
  const video = useRef<HTMLVideoElement>(null)
  const [index, setIndex] = useState<OverlayIndex | null>(null)
  const [failed, setFailed] = useState(false)
  const [outlines, setOutlines] = useState(true)
  const [slow, setSlow] = useState(false)
  const [shapes, setShapes] = useState<readonly FrameShape[]>([])
  const outlinesId = useId()
  const slowId = useId()

  useEffect(() => {
    const abort = new AbortController()
    loadOverlayData(abort.signal)
      .then((data) => setIndex(buildIndex(data)))
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true)
      })
    return () => abort.abort()
  }, [])

  const sync = useCallback(() => {
    const element = video.current
    if (!element || !index) return
    const frame = nearestFrame(
      index,
      frameForTime(index.meta, element.currentTime),
      index.meta.step,
    )
    setShapes(shapesAt(index, frame))
  }, [index])

  // Follow the picture frame by frame while it plays; one reading is enough when it is still.
  useEffect(() => {
    const element = video.current
    if (!element || !index) return
    let handle = 0
    const loop = () => {
      sync()
      if (!element.paused && !element.ended) handle = requestAnimationFrame(loop)
    }
    const start = () => {
      cancelAnimationFrame(handle)
      loop()
    }
    sync()
    element.addEventListener('play', start)
    element.addEventListener('seeked', sync)
    element.addEventListener('pause', sync)
    return () => {
      cancelAnimationFrame(handle)
      element.removeEventListener('play', start)
      element.removeEventListener('seeked', sync)
      element.removeEventListener('pause', sync)
    }
  }, [index, sync])

  useEffect(() => {
    if (video.current) video.current.playbackRate = slow ? 0.5 : 1
  }, [slow])

  const parts = useMemo(
    () =>
      PARTS.map((part) => {
        if (!index || !part.node) return { ...part, seconds: 0 }
        const structure = index.structures.find((entry) => entry.node === part.node)
        return { ...part, seconds: structure ? timeForFrame(index.meta, structure.first) : 0 }
      }),
    [index],
  )

  const inView = index
    ? [...new Set(shapes.map((shape) => index.structures[shape.s]?.name).filter(Boolean))]
    : []

  return (
    <section className={styles.surveyVideo} data-survey-video aria-label="The survey, on video">
      <div className={styles.surveyFrame}>
        <video
          ref={video}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          controls
          playsInline
          muted
          preload="metadata"
          aria-label="A bronchoscopic survey of a normal airway, from the larynx through the right lung and then the left"
        />
        {index && outlines ? (
          <svg
            className={styles.surveyOverlay}
            viewBox={`0 0 ${index.meta.width} ${index.meta.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            data-survey-outlines={shapes.length}
          >
            {shapes.map((shape, at) => {
              const structure = index.structures[shape.s]
              const centre = polygonCentroid(shape.pts)
              return (
                <g key={`${shape.s}-${at}`}>
                  <polygon points={flat(shape.pts)} vectorEffect="non-scaling-stroke" />
                  <text x={centre.x} y={centre.y}>
                    {structure?.short}
                  </text>
                </g>
              )
            })}
          </svg>
        ) : null}
      </div>
      <div className={styles.surveyControls}>
        <label htmlFor={outlinesId}>
          <input
            id={outlinesId}
            type="checkbox"
            checked={outlines}
            onChange={(event) => setOutlines(event.target.checked)}
          />{' '}
          Show the names
        </label>
        <label htmlFor={slowId}>
          <input
            id={slowId}
            type="checkbox"
            checked={slow}
            onChange={(event) => setSlow(event.target.checked)}
          />{' '}
          Half speed
        </label>
        {parts.map((part) => (
          <button
            key={part.id}
            type="button"
            data-survey-part={part.id}
            disabled={!index && part.node !== null}
            onClick={() => {
              if (!video.current) return
              video.current.currentTime = part.seconds
              sync()
            }}
          >
            {part.label}
          </button>
        ))}
      </div>
      {failed ? (
        <p className={styles.surveyNote} data-media-state="failed">
          The names did not load. The video plays without them.
        </p>
      ) : (
        <p className={styles.surveyNote} data-survey-in-view>
          {outlines && inView.length ? `In view: ${inView.join(', ')}.` : ' '}
        </p>
      )}
    </section>
  )
}
