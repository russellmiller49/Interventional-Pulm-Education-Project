'use client'

import { useEffect, useRef, useState } from 'react'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import type { LocalSession } from '../engine/local-session'
import { NativeCtViewer } from './NativeCtViewer'
import type { LocalCtExercise, CtTrace, CtBranchChoice } from '../content/ct-types'
import { parentMap } from '../geometry/parent-map'
import { parentCameraCaption } from '../geometry/reference-frames'
import { divisionIdentities } from '../engine/branch-identity'
import { divisionLevels, levelPhrase } from '../engine/model-reference'
import styles from './branch-tracing.module.css'

export function CtParentMap({
  trace,
  active = 0,
  labels = true,
  choice = null,
  onChoose,
}: {
  trace: CtTrace
  active?: number
  /** Show the CT letters and source names on the openings; off while a matching try is open. */
  labels?: boolean
  choice?: CtBranchChoice | null
  onChoose?: (value: CtBranchChoice) => void
}) {
  const map = parentMap(trace, active)
  const checkpoint = trace.checkpoints[active]
  const identities = divisionIdentities(checkpoint)
  const levels = divisionLevels(checkpoint)
  if (!map || !identities || !levels) return null
  const caption = parentCameraCaption(
    { direction: map.direction, up: map.referenceUp, atJunction: true },
    map.parent,
  )
  return (
    <figure className={styles.parentMap} data-parent-map={checkpoint.id}>
      <figcaption>
        <strong>Model parent view</strong> · looking distally from <strong>{map.parent}</strong>
        <span className={styles.parentMapCaption}>{caption}</span>
      </figcaption>
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Model direction schematic from ${map.parent}. ${
          labels
            ? map.points.map((p) => `Opening ${p.number} is Daughter ${p.letter}`).join('; ')
            : `${map.points.length} numbered openings`
        }. Patient directions in this view: ${map.inPlane.map((a) => a.label).join(', ')}.${
          map.alongView.length
            ? ` The ${map.alongView.map((a) => a.pair).join(' and ')} axis runs along the line of sight.`
            : ''
        }`}
      >
        <circle cx="100" cy="100" r="82" fill="#07151b" stroke="#69838d" />
        {map.inPlane.map((a) => (
          <g key={a.label}>
            <path
              d={`M100 100 L${100 + a.point[0] * 82} ${100 + a.point[1] * 82}`}
              stroke="#536b73"
              strokeDasharray="2 3"
            />
            <text
              x={100 + a.point[0] * 93}
              y={100 + a.point[1] * 93 + 4}
              textAnchor="middle"
              fill="#c9dbe2"
              fontSize="12"
              fontWeight="650"
              data-axis-label={a.label}
            >
              {a.label}
            </text>
          </g>
        ))}
        {map.points.map((p) => (
          <g
            key={p.edgeId}
            data-opening={p.number}
            data-opening-letter={labels ? p.letter : undefined}
          >
            <path
              d={`M100 100 L${p.x} ${p.y}`}
              stroke={choice === p.edgeId ? '#81f1ed' : '#849da7'}
              strokeWidth={choice === p.edgeId ? 3 : 1}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="17"
              fill="#142f39"
              stroke={choice === p.edgeId ? '#81f1ed' : '#f6c66c'}
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={p.y + 5.5}
              textAnchor="middle"
              fill="white"
              fontSize="15"
              fontWeight="700"
            >
              {labels ? p.letter : p.number}
            </text>
            {labels && (
              <text
                x={p.x + 12}
                y={p.y - 11}
                textAnchor="middle"
                fill="#a8bec8"
                fontSize="8"
                aria-hidden="true"
              >
                {p.number}
              </text>
            )}
          </g>
        ))}
      </svg>
      {map.alongView.map((a) => (
        <p key={a.pair} className={styles.small} data-along-view={a.pair}>
          The {a.toward.name}–{a.into.name} axis runs along the line of sight here: {a.into.name}{' '}
          points into the view and {a.toward.name} back toward the viewer, so it has no arrow.
        </p>
      ))}
      <div className={styles.mapChoices}>
        {map.points.map((p) => {
          const daughter = identities.daughters[p.sourceIndex]
          const level = levels.daughters[p.sourceIndex]
          return onChoose ? (
            <button key={p.edgeId} onClick={() => onChoose(p.edgeId)}>
              Opening {p.number}
            </button>
          ) : (
            <p key={p.edgeId} data-opening-legend={p.number}>
              <strong>Opening {p.number}</strong>
              {labels
                ? ` · ${daughter.display}${
                    daughter.repeatedName
                      ? ''
                      : ` (source label “${daughter.direction.toLowerCase()}”)`
                  } · ${levelPhrase(level)}`
                : ''}
              {choice === p.edgeId ? ' · your continuation' : ''}
            </p>
          )
        })}
        {onChoose && <button onClick={() => onChoose('unresolved')}>Opening unresolved</button>}
      </div>
      <p className={styles.small}>
        Letters are the CT branch labels (A, B); numbers are the openings’ positions in this view.
        Directions are projected model directions, not measured opening shapes. CT display rotation
        does not rotate this view.
      </p>
    </figure>
  )
}

export function CtProgressiveMap({
  trace,
  recorded,
  branches,
  active = 0,
  reveal = true,
  onReview,
  worked = false,
}: {
  trace: CtTrace
  recorded: boolean[]
  branches: (CtBranchChoice | null)[]
  active?: number
  reveal?: boolean
  onReview?: (index: number) => void
  /**
   * The worked example's route, not the learner's (BBTF-08): `recorded` then marks the divisions
   * shown so far, and nothing on the map is attributed to the learner.
   */
  worked?: boolean
}) {
  const mapRef = useRef<HTMLElement>(null)
  const recordedKey = recorded.join(',')
  useEffect(() => {
    const scroller = mapRef.current?.parentElement
    const current = mapRef.current?.querySelector('[aria-current="step"]')
    if (scroller && current && getComputedStyle(scroller).overflowY === 'auto') {
      scroller.scrollTop +=
        current.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 30
    }
  }, [active, recordedKey])
  const recordedCount = recorded.filter(Boolean).length
  const total = trace.checkpoints.length
  const missing = trace.checkpoints
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !recorded[i])
    .map(({ p, i }) => `${i + 1}. ${p.decision?.parent.airway.code ?? 'Distal approach'}`)
  return (
    <section
      ref={mapRef}
      className={styles.progressiveMap}
      aria-label={worked ? 'Worked route map' : 'Connected route map'}
      data-map-owner={worked ? 'worked-example' : 'learner'}
    >
      <h3 data-map-state={worked ? 'worked' : recordedCount === total ? 'complete' : 'partial'}>
        {worked
          ? `Worked route map · ${recordedCount} of ${total} stops shown · model reference, not your route`
          : `Your route map · ${recordedCount} of ${total} ${total === 1 ? 'stop' : 'stops'} recorded`}
        {!worked && recordedCount < total && (
          <>
            {' '}
            <span className={styles.partialTag} data-map-partial>
              Partial
            </span>
          </>
        )}
      </h3>
      <ol className={styles.connectedRoute}>
        {trace.checkpoints.map((p, i) => {
          if (!recorded[i]) return null
          const decision = p.decision
          return (
            <li
              key={p.id}
              aria-current={i === active ? 'step' : undefined}
              data-map-division={p.id}
            >
              <strong>
                {i + 1}. {decision?.parent.airway.code ?? 'Distal approach'}
              </strong>
              {onReview && <button onClick={() => onReview(i)}>Review division {i + 1}</button>}
              {branches[i] === 'unresolved' && <p>Your continuation: unresolved</p>}
              {decision && (
                <ul>
                  {decision.options.map((option, n) => (
                    <li key={option.sourceEdgeId}>
                      {`Daughter ${String.fromCharCode(65 + n)}`}
                      {reveal && ` · ${option.airway.code}`}
                      {branches[i] === option.sourceEdgeId && <strong> · your selection</strong>}
                      {reveal && p.sourceEdgeId === option.sourceEdgeId && (
                        <span> · model continuation</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {decision && reveal && (
                <details>
                  <summary>Parent reference for division {i + 1}</summary>
                  <CtParentMap trace={trace} active={i} choice={branches[i]} />
                </details>
              )}
            </li>
          )
        })}
      </ol>
      {!worked && !recorded.some(Boolean) && (
        <p>Record a division to add your interpretation. Future continuations are not prefilled.</p>
      )}
      {worked && (
        <p>
          The worked example’s divisions, added as you step through them. None of this is your work,
          and it is not carried into your own trace.
        </p>
      )}
      {!worked && missing.length > 0 && recorded.some(Boolean) && (
        <p data-map-missing>
          Not recorded here: {missing.join(', ')}. Moving past a division without recording it is a
          valid way to work; those stops stay off this map rather than being filled in, and nothing
          is counted against you.
        </p>
      )}
      <details>
        <summary>How to read this map</summary>
        <p className={styles.small}>
          Connected divisions in source-route order, with every sibling retained. Your selections
          and unresolved responses are recorded separately. Continuing follows the source route even
          after a different or uncertain choice; it does not simulate your proposed path. Parent
          views have provisional opening positions. CT display changes never change this map.
        </p>
      </details>
    </section>
  )
}

export function CtLocalRouteMap({
  exercises,
  history,
  active,
}: {
  exercises: LocalCtExercise[]
  history: LocalSession['history']
  active: number
}) {
  const [review, setReview] = useState<number | null>(null)
  const trace = { ...exercises[0].trace, checkpoints: exercises.map((e) => e.trace.checkpoints[0]) }
  const reviewing = review !== null ? exercises[review] : null
  const attempt = reviewing ? history[reviewing.id]?.at(-1) : undefined
  return (
    <>
      <CtProgressiveMap
        trace={trace}
        active={active}
        recorded={exercises.map((e) => Boolean(history[e.id]?.length))}
        branches={exercises.map((e) => history[e.id]?.at(-1)?.branch ?? null)}
        onReview={setReview}
      />
      <HelpDialog
        open={review !== null}
        onClose={() => setReview(null)}
        title="Recorded division · review only"
      >
        {reviewing && attempt && (
          <>
            <p>Reviewing does not change the current task or your saved marks.</p>
            <NativeCtViewer
              key={reviewing.id}
              trace={reviewing.trace}
              active={0}
              local
              marks={attempt.marks}
              orientation={attempt.orientation}
              scopeAvailable={false}
              showAnchor
              teachingFrame={reviewing.frames.find(
                (f) => f.slice === reviewing.answerPoints[0].slice,
              )}
              initialView={{
                slice: reviewing.answerPoints[0].slice,
                focus: 'junction',
                full: false,
                magnification: 1,
                showNodule: false,
                showScope: false,
              }}
            />
          </>
        )}
      </HelpDialog>
    </>
  )
}
