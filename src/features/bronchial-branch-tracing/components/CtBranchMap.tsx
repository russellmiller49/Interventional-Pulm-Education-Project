'use client'

import { useEffect, useRef, useState } from 'react'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import type { LocalSession } from '../engine/local-session'
import { NativeCtViewer } from './NativeCtViewer'
import type { LocalCtExercise, CtTrace, CtBranchChoice } from '../content/ct-types'
import { parentMap } from '../geometry/parent-map'
import styles from './branch-tracing.module.css'

export function CtParentMap({
  trace,
  active = 0,
  labels = true,
  ctLabels,
  choice = null,
  onChoose,
}: {
  trace: CtTrace
  active?: number
  labels?: boolean
  ctLabels?: string[]
  choice?: CtBranchChoice | null
  onChoose?: (value: CtBranchChoice) => void
}) {
  const map = parentMap(trace, active)
  if (!map) return null
  return (
    <figure className={styles.parentMap}>
      <figcaption>
        Looking distally from <strong>{map.parent}</strong> · fixed parent view
      </figcaption>
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Model direction schematic from ${map.parent}. Numbered daughters and projected patient R, A and S directions.`}
      >
        <circle cx="100" cy="100" r="82" fill="#07151b" stroke="#69838d" />
        {map.axes.map((a) => (
          <g key={a.label}>
            <path
              d={`M100 100 L${100 + a.point[0] * 85} ${100 + a.point[1] * 85}`}
              stroke="#536b73"
              strokeDasharray="2 3"
            />
            <text
              x={100 + a.point[0] * 92}
              y={100 + a.point[1] * 92}
              textAnchor="middle"
              fill="#a8bec8"
              fontSize="10"
            >
              {a.label}
            </text>
          </g>
        ))}
        {map.points.map((p) => (
          <g key={p.edgeId}>
            <path
              d={`M100 100 L${p.x} ${p.y}`}
              stroke={choice === p.edgeId ? '#81f1ed' : '#849da7'}
              strokeWidth={choice === p.edgeId ? 3 : 1}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="14"
              fill="#142f39"
              stroke={choice === p.edgeId ? '#81f1ed' : '#f6c66c'}
              strokeWidth="2"
            />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill="white" fontSize="12">
              {p.number}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.mapChoices}>
        {map.points.map((p) =>
          onChoose ? (
            <button key={p.edgeId} onClick={() => onChoose(p.edgeId)}>
              Opening {p.number}
            </button>
          ) : (
            <p key={p.edgeId}>
              {p.number}
              {labels ? ` · ${ctLabels?.[p.sourceIndex] ?? p.label}` : ''}
              {choice === p.edgeId ? ' · your continuation' : ''}
            </p>
          ),
        )}
        {onChoose && <button onClick={() => onChoose('unresolved')}>Opening unresolved</button>}
      </div>
      <p className={styles.small}>
        R: patient right · A: anterior · S: superior. Projected model directions, not measured
        opening shapes. CT display rotation does not rotate this view.
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
}: {
  trace: CtTrace
  recorded: boolean[]
  branches: (CtBranchChoice | null)[]
  active?: number
  reveal?: boolean
  onReview?: (index: number) => void
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
  return (
    <section ref={mapRef} className={styles.progressiveMap} aria-label="Connected route map">
      <h3>Your route map · {recorded.filter(Boolean).length} recorded stops</h3>
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
      {!recorded.some(Boolean) && (
        <p>Record a division to add your interpretation. Future continuations are not prefilled.</p>
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
