'use client'

import { useState } from 'react'
import type { CtMark, LocalCtExercise } from '../content/ct-types'
import {
  JUNCTION_FEEDBACK_OBSERVATION,
  JUNCTION_FEEDBACK_SCOPE,
  type JunctionFeedbackPacket,
} from '../content/junction-feedback'
import { compareMarks, type MarkComparison } from '../engine/junction-feedback'
import styles from './branch-tracing.module.css'

const mm = (value: number) => `${value.toFixed(1)} mm`

/** One sentence per response: position against the model locators on that slice, never a verdict. */
export function positionSentence(comparison: MarkComparison) {
  const { intended, others, status } = comparison
  if (status === 'unresolved' || !intended)
    return `You recorded ${comparison.label} as unresolved on slice ${comparison.slice}. That is a valid response; see "Uncertain? Start here" below.`
  const code = intended.locator.airway.code
  const nearest = others[0]
  if (status === 'nearest-other' && nearest)
    return `Your mark is ${mm(nearest.mm)} from the ${nearest.locator.airway.code} model locator and ${mm(intended.mm)} from the ${code} locator: it sits nearer ${nearest.locator.airway.code}.`
  const context = nearest
    ? `; the nearest other model airway on this slice, ${nearest.locator.airway.code}, is ${mm(nearest.mm)} away`
    : '; no other named model airway crosses this slice'
  const span = comparison.beyondSpan
    ? ` It is farther from the ${code} locator than that other locator is, so re-check the connection to the parent before accepting it.`
    : ''
  return `Your mark is ${mm(intended.mm)} from the ${code} model locator${context}.${span}`
}

export function JunctionFeedback({
  exercise,
  marks,
  packet,
  onGoToSlice,
}: {
  exercise: LocalCtExercise
  marks: readonly (CtMark | null)[]
  packet: JunctionFeedbackPacket | undefined
  onGoToSlice: (slice: number) => void
}) {
  const comparisons = compareMarks(exercise, marks)
  if (!comparisons.length) return null
  const decision = exercise.trace.checkpoints[0].decision!
  const nearerOther = comparisons.filter((c) => c.status === 'nearest-other')
  const unresolved = comparisons.filter((c) => c.status === 'unresolved')
  return (
    <div className={styles.junctionFeedback} data-junction-feedback>
      <h3>Where your marks sit</h3>
      <ul>
        {comparisons.map((c) => (
          <li key={c.slot} data-mark-status={c.status}>
            <strong>
              {c.label} · slice {c.slice}.
            </strong>{' '}
            {positionSentence(c)}
          </li>
        ))}
      </ul>
      <p className={styles.small}>
        Distances are measured on the slice between your mark and the model centreline samples. They
        show where a mark sits, not why it was placed there. A mark inside the intended lumen can
        lie a few millimetres from its locator; a mark nearer another locator is a reason to
        re-trace, not a verdict, and by itself it cannot show that a vessel or another structure was
        taken for this airway. Your marks stay exactly where you placed them; the gold rings are
        model references, not corrections.
      </p>
      {unresolved.length > 0 && (
        <>
          <h3>Uncertain? Start here</h3>
          <p>
            {packet?.moreEvidence ??
              `Return to ${exercise.trace.anchor.airway.code} on slice ${exercise.trace.anchor.slice} and step toward the answer slice one slice at a time, keeping the air column and its wall in view. The general explanation below describes the method for this division.`}
          </p>
          <p>
            Reference trace: the gold rings mark the model locators on the demonstration slices.
            Replay the walkthrough below, then redo the marks or continue. An unresolved response
            stays unresolved: it is neither counted against you nor turned into an identification.
          </p>
        </>
      )}
      {packet ? (
        <>
          <h3>Where the paths diverge</h3>
          <p>{packet.divergence}</p>
          <h3>Which wall or lumen decides it</h3>
          <p>{packet.continuity}</p>
          {nearerOther.map((c) => {
            const code = decision.options[c.slot].airway.code
            return packet.whenNearer[code] ? (
              <p key={c.slot} data-when-nearer={code}>
                {packet.whenNearer[code]}
              </p>
            ) : null
          })}
          <h3>Slices to revisit</h3>
          <ul className={styles.revisitList}>
            {packet.revisit.map((r) => (
              <li key={`${r.from}-${r.to}`}>
                <span>
                  {r.from} to {r.to}: {r.look}.
                </span>
                <span className={styles.revisitControls}>
                  <button onClick={() => onGoToSlice(r.from)}>Go to slice {r.from}</button>
                  <button onClick={() => onGoToSlice(r.to)}>Go to slice {r.to}</button>
                </span>
              </li>
            ))}
          </ul>
          <details>
            <summary>Known relationships and open review items</summary>
            <h4>From the source model</h4>
            <ul>
              {packet.known.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Pending faculty review</h4>
            <ul>
              {packet.uncertain.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className={styles.small}>
              Image readings: {JUNCTION_FEEDBACK_OBSERVATION.by},{' '}
              {JUNCTION_FEEDBACK_OBSERVATION.date}. {JUNCTION_FEEDBACK_OBSERVATION.status}.
            </p>
          </details>
          <NamingAid packet={packet} />
        </>
      ) : (
        <p data-feedback-scope>
          Authored feedback for this division is not written yet. BBT-02 covers five pilot junctions
          ({JUNCTION_FEEDBACK_SCOPE.join(', ')}); the position comparison above and the general
          explanation below still apply here.
        </p>
      )}
    </div>
  )
}

/** Names are shown directly; the try is optional, unrecorded and can be repeated. */
function NamingAid({ packet }: { packet: JunctionFeedbackPacket }) {
  const [choice, setChoice] = useState<string | null>(null)
  const [namesShown, setNamesShown] = useState(false)
  const naming = packet.naming
  const revealed = choice !== null || namesShown
  return (
    <details data-naming-aid>
      <summary>Name the daughters (optional)</summary>
      {naming.demonstration.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {naming.uncertainty && <p className={styles.small}>{naming.uncertainty}</p>}
      {naming.try && (
        <div className={styles.namingTry}>
          <p>
            <strong>Try it (optional):</strong> {naming.try.prompt}
          </p>
          <div className={styles.namingChoices}>
            {naming.try.choices.map((option) => (
              <button
                key={option.code}
                aria-pressed={choice === option.code}
                onClick={() => setChoice(option.code)}
              >
                {option.text}
              </button>
            ))}
            <button aria-pressed={namesShown} onClick={() => setNamesShown(true)}>
              Show the names
            </button>
          </div>
          {revealed && (
            <p role="status">
              {choice !== null
                ? naming.try.explanation[choice]
                : naming.try.explanation[naming.try.describes]}{' '}
              Nothing is recorded; choose again if you like.
            </p>
          )}
        </div>
      )}
    </details>
  )
}
