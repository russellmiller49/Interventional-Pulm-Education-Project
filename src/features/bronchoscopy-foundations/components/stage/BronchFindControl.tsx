'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import {
  FIND_FRAME_SIZE,
  findFrame,
  markerCentre,
  markerNames,
  type FindMarker,
} from '../../content/findFrames'
import type { BronchFind, BronchFindRow } from '../../content/types'
import styles from './bronch-stage.module.css'
import courseStyles from './course-flow.module.css'
import { MATCHED_WORDS, UNMATCHED_WORDS } from './verdictWords'

/**
 * Click-on-image questions: a frame of the normal survey, where the scope came from, and one
 * opening to click. The answer is the click, not a name picked from a list.
 *
 * Each frame carries the survey's own outlines. Before an answer they are drawn without names; each
 * is a button whose accessible name says where it is ("Opening B, at 4 o'clock"), never what it
 * is, so the task is the same from a keyboard or a screen reader. The first click on an image is
 * the answer: the names appear, the opening asked for is marked, and the reason is given in
 * landmarks. One image is shown at a time. A row may show its frame turned, as a rotated scope
 * shows it; the outlines and their positions turn with it.
 */
export function BronchFindControl({
  find,
  answers,
  revealed = false,
  onAnswer,
}: {
  readonly find: BronchFind
  readonly answers: Readonly<Record<string, string>>
  readonly revealed?: boolean
  readonly onAnswer: (rowId: string, markerId: string) => void
}) {
  const firstOpen = find.rows.findIndex((row) => answers[row.id] === undefined)
  const [shown, setShown] = useState(firstOpen < 0 ? 0 : firstOpen)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const focusFeedback = useRef(false)
  const index = Math.min(shown, find.rows.length - 1)
  const row = find.rows[index]
  const answer = answers[row.id]
  useEffect(() => {
    if (!focusFeedback.current) return
    focusFeedback.current = false
    feedbackRef.current?.focus()
  })
  const done = find.rows.filter((entry) => answers[entry.id] !== undefined).length
  return (
    <div className={styles.act} data-bronch-find={find.id} data-find-done={done}>
      <p className={styles.verdict}>{find.prompt}</p>
      <p className={styles.kicker} data-find-position>
        Image {index + 1} of {find.rows.length}
      </p>
      <FindRow
        key={row.id}
        row={row}
        answer={answer}
        revealed={revealed}
        feedbackRef={feedbackRef}
        onAnswer={(markerId) => {
          focusFeedback.current = true
          onAnswer(row.id, markerId)
        }}
      />
      <div className={styles.actRow}>
        {index > 0 ? (
          <button
            type="button"
            className={courseStyles.secondary}
            data-find-previous
            onClick={() => setShown(index - 1)}
          >
            Previous image
          </button>
        ) : null}
        {index < find.rows.length - 1 && (answer !== undefined || revealed) ? (
          <button
            type="button"
            className={courseStyles.primary}
            data-find-next
            onClick={() => setShown(index + 1)}
          >
            Next image
          </button>
        ) : null}
      </div>
    </div>
  )
}

function points(marker: FindMarker): string {
  return marker.points.join(' ')
}

function FindRow({
  row,
  answer,
  revealed,
  feedbackRef,
  onAnswer,
}: {
  readonly row: BronchFindRow
  readonly answer: string | undefined
  readonly revealed: boolean
  readonly feedbackRef: React.RefObject<HTMLParagraphElement | null>
  readonly onAnswer: (markerId: string) => void
}) {
  const frame = findFrame(row.frameId)
  const rotation = row.rotation ?? 0
  const plural = row.marks ?? 'openings'
  const singular = plural === 'structures' ? 'structure' : 'opening'
  const names = markerNames(frame, rotation, plural === 'structures' ? 'Structure' : 'Opening')
  const target = frame.markers.find((marker) => marker.id === row.targetId)
  const chosen = frame.markers.find((marker) => marker.id === answer)
  const open = answer === undefined && !revealed
  const matched = answer === row.targetId
  const { width, height } = FIND_FRAME_SIZE
  // A quarter turn swaps the frame's sides; scale it so the turned frame still fits its box.
  const scale = rotation === 90 || rotation === 270 ? height / width : 1
  const choose = (markerId: string) => {
    if (open) onAnswer(markerId)
  }
  const onKey = (event: KeyboardEvent<SVGPolygonElement>, markerId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    choose(markerId)
  }
  return (
    <div className={styles.row} data-find-row={row.id} data-find-rotation={rotation || undefined}>
      <p data-find-context>{row.context}</p>
      <p className={styles.findPrompt} data-find-prompt>
        {row.prompt}
      </p>
      <div
        className={styles.findFrame}
        style={{ '--media-aspect': width / height } as CSSProperties}
        data-find-frame={row.frameId}
      >
        <div
          className={styles.findTurn}
          style={{ transform: rotation ? `rotate(${rotation}deg) scale(${scale})` : undefined }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static teaching files under public/ */}
          <img
            className={styles.figureImage}
            src={frame.src}
            width={width}
            height={height}
            alt={`A bronchoscopic view with ${frame.markers.length} ${plural} outlined. ${row.context}`}
          />
          <svg
            className={styles.findOverlay}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="group"
            aria-label={
              open ? `The outlined ${plural}. Choose one.` : `The outlined ${plural}, named`
            }
          >
            {frame.markers.map((marker) => {
              const isTarget = marker.id === row.targetId
              const isChosen = marker.id === answer
              return (
                <polygon
                  key={marker.id}
                  points={points(marker)}
                  className={styles.findOutline}
                  data-find-marker={marker.id}
                  data-state={open ? 'open' : isTarget ? 'target' : isChosen ? 'chosen' : 'other'}
                  vectorEffect="non-scaling-stroke"
                  role={open ? 'button' : 'img'}
                  tabIndex={open ? 0 : undefined}
                  aria-label={
                    open ? names.get(marker.id) : `${names.get(marker.id)}: ${marker.name}`
                  }
                  onClick={() => choose(marker.id)}
                  onKeyDown={(event) => onKey(event, marker.id)}
                />
              )
            })}
            {open
              ? null
              : frame.markers.map((marker) => {
                  const centre = markerCentre(marker)
                  return (
                    <text
                      key={marker.id}
                      x={centre.x}
                      y={centre.y}
                      className={styles.findLabel}
                      // Names stay upright when the frame is turned.
                      transform={
                        rotation ? `rotate(${-rotation} ${centre.x} ${centre.y})` : undefined
                      }
                      aria-hidden="true"
                      data-find-label={marker.id}
                    >
                      {shortName(marker.name)}
                    </text>
                  )
                })}
          </svg>
        </div>
      </div>
      {open ? (
        <p className={styles.boundaryLine}>Click or tap an outlined {singular}.</p>
      ) : (
        <p
          ref={feedbackRef}
          tabIndex={-1}
          className={styles.verdict}
          role="status"
          data-find-verdict={answer === undefined ? 'shown' : matched ? 'held' : 'other'}
        >
          {answer === undefined ? null : (
            <>
              <strong>{matched ? MATCHED_WORDS : UNMATCHED_WORDS}</strong>{' '}
              {matched ? null : (
                <span data-find-chosen>You clicked {chosen?.name ?? 'elsewhere'}. </span>
              )}
            </>
          )}
          <strong data-find-answer>{target?.name}.</strong> {row.rationale}
        </p>
      )}
    </div>
  )
}

/**
 * "RB6 · Superior" is drawn as "RB6"; a bronchus without a code keeps its name; a paired structure
 * ("True vocal cord, left of the image") is drawn by its name alone.
 */
function shortName(name: string): string {
  if (name.includes(' · ')) return name.split(' · ')[0]
  return name.replace(/, (left|right) of the image$/, '').replace(/ bronchus$/, '')
}
