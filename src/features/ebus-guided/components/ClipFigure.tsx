'use client'
import { useRef, useState } from 'react'

import { teachingClip, type ClipMark, type ClipMarkKind } from '../content/clips'
import styles from './clip-figure.module.css'

/**
 * A patient recording a lesson reads: play it, scrub it, and stop on the frames the lesson asks
 * about. A stop shows that exact frame as a still, so anything drawn over it is on the frame it
 * was drawn for; nothing is drawn over the moving picture.
 *
 * Labels stay closed until the learner has answered (or opened the explanation), so the still is
 * read before it is named. Nothing plays until the learner presses Play.
 */
const COLOURS: Record<ClipMarkKind, string> = {
  node: '#78e68c',
  vessel: '#7dc3ff',
  pleura: '#ffcd7d',
  needle: '#ffff93',
  stylet: '#ffff93',
}

/** One mark on a paused frame, drawn in a 1000 x 1000 box stretched over it. */
export function Mark({ mark, number }: { mark: ClipMark; number: number }) {
  const colour = COLOURS[mark.kind]
  const shape = mark.shape
  // The overlay's box is 1000 x 1000 units stretched over the frame.
  // The number sits at the top of an ellipse or outline, and at the start of a line.
  const at =
    shape.type === 'ellipse'
      ? [shape.cx, shape.cy - shape.ry]
      : shape.type === 'polygon'
        ? shape.points.reduce((top, point) => (point[1] < top[1] ? point : top))
        : shape.points[0]
  const x = at[0] * 1000,
    y = Math.max(34, at[1] * 1000 - 30)
  return (
    <g data-clip-mark={mark.kind}>
      {shape.type === 'ellipse' ? (
        <ellipse
          cx={shape.cx * 1000}
          cy={shape.cy * 1000}
          rx={shape.rx * 1000}
          ry={shape.ry * 1000}
          fill="none"
          stroke={colour}
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
        />
      ) : shape.type === 'polygon' ? (
        <polygon
          points={shape.points.map(([px, py]) => px * 1000 + ',' + py * 1000).join(' ')}
          fill="none"
          stroke={colour}
          strokeWidth="4"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <polyline
          points={shape.points.map(([px, py]) => px * 1000 + ',' + py * 1000).join(' ')}
          fill="none"
          stroke={colour}
          strokeWidth="4"
          strokeDasharray="10 8"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <ellipse cx={x} cy={y} rx="20" ry="30" fill="#06161c" stroke={colour} strokeWidth="2" />
      <text
        x={x}
        y={y + 13}
        textAnchor="middle"
        fill="#f4fbfa"
        fontSize="36"
        fontWeight="700"
        transform={`translate(${x} ${y}) scale(0.67 1) translate(${-x} ${-y})`}
      >
        {number}
      </text>
    </g>
  )
}

export function ClipFigure({ clip: slug, unlocked }: { clip: string; unlocked: boolean }) {
  const clip = teachingClip(slug)
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [stopId, setStopId] = useState<string | null>(null)
  const [labels, setLabels] = useState(false)
  if (!clip) return null
  const { built } = clip
  const stop = clip.stops.find((entry) => entry.id === stopId) ?? null
  const still = stop ? built.stops.find((entry) => entry.id === stop.id) : undefined
  const showMarks = !!stop && labels && unlocked && stop.marks.length > 0
  const toClip = () => {
    setStopId(null)
    setLabels(false)
  }
  const toggle = () => {
    const element = video.current
    if (!element) return
    toClip()
    if (element.paused) void element.play()
    else element.pause()
  }
  return (
    <section className={styles.clip} data-clip={clip.slug} data-clip-outlines={clip.outlines}>
      <h2>{clip.title}</h2>
      <p className={styles.what}>{clip.what}</p>
      <div className={styles.frame} style={{ aspectRatio: built.width + ' / ' + built.height }}>
        {/* The video stays mounted under a still, so returning to it keeps its place. */}
        <video
          ref={video}
          src={built.src}
          poster={built.stops[0]?.image}
          width={built.width}
          height={built.height}
          muted
          loop
          playsInline
          preload="metadata"
          hidden={!!still}
          aria-label={clip.title + ': patient recording'}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        />
        {still && stop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={still.image}
            width={built.width}
            height={built.height}
            alt={clip.title + ': ' + stop.label.toLowerCase()}
            data-clip-still={stop.id}
          />
        )}
        {showMarks && stop && (
          <svg
            className={styles.marks}
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
            data-clip-marks={stop.id}
          >
            {stop.marks.map((mark, index) => (
              <Mark key={index} mark={mark} number={index + 1} />
            ))}
          </svg>
        )}
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={toggle} data-clip-play>
          {playing && !still ? 'Pause' : still ? 'Back to the recording' : 'Play'}
        </button>
        <label className={styles.scrub}>
          <span>
            {time.toFixed(1)} of {built.durationS.toFixed(1)} s
          </span>
          <input
            type="range"
            aria-label="Position in the recording"
            min={0}
            max={built.durationS}
            step={0.05}
            value={Math.min(time, built.durationS)}
            disabled={!!still}
            onChange={(event) => {
              const next = Number(event.target.value)
              setTime(next)
              if (video.current) video.current.currentTime = next
            }}
          />
        </label>
      </div>
      <div className={styles.controls} role="group" aria-label="Paused frames">
        {clip.stops.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={stopId === entry.id}
            data-clip-stop={entry.id}
            onClick={() => {
              video.current?.pause()
              setStopId((current) => (current === entry.id ? null : entry.id))
              setLabels(false)
            }}
          >
            {entry.label}
          </button>
        ))}
        {stop && stop.marks.length > 0 && (
          <button
            type="button"
            aria-pressed={labels && unlocked}
            disabled={!unlocked}
            data-clip-labels
            onClick={() => setLabels((value) => !value)}
          >
            {labels && unlocked ? 'Hide labels' : 'Show labels'}
          </button>
        )}
      </div>
      {stop && stop.marks.length > 0 && !unlocked && (
        <p className={styles.note} data-clip-locked>
          The labels for this frame open after you answer.
        </p>
      )}
      {showMarks && stop && (
        <ol className={styles.legend} data-clip-legend>
          {stop.marks.map((mark, index) => (
            <li key={index} data-kind={mark.kind}>
              <span aria-hidden="true">{index + 1}</span>
              {mark.label}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
