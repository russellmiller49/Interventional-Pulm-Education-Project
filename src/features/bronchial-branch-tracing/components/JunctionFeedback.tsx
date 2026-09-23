'use client'

import { useState } from 'react'
import type { CtMark, LocalCtExercise } from '../content/ct-types'
import {
  JUNCTION_FEEDBACK_OBSERVATION,
  JUNCTION_FEEDBACK_SCOPE,
  type JunctionFeedbackPacket,
} from '../content/junction-feedback'
import { compareMarks, type MarkComparison } from '../engine/junction-feedback'
import { displayAnswerLabel } from '../engine/branch-identity'
import styles from './branch-tracing.module.css'

const mm = (value: number) => `${value.toFixed(1)} mm`

/** One sentence per response: position against the model locators on that slice, never a verdict. */
export function positionSentence(comparison: MarkComparison) {
  const { intended, nearestOther, status } = comparison
  if (status === 'unresolved' || !intended)
    return `You recorded ${comparison.label} as unresolved on slice ${comparison.slice}. That is a valid response; see "Uncertain? Start here" below.`
  const code = intended.locator.airway.code
  if (!nearestOther)
    return `Your mark is ${mm(intended.mm)} from the ${code} model locator; no other named model airway crosses slice ${comparison.slice}.`
  const other = nearestOther.locator.airway.code
  if (status === 'nearest-other')
    return `Your mark is ${mm(nearestOther.mm)} from the ${other} model locator and ${mm(intended.mm)} from the ${code} locator: of the named model locators crossing slice ${comparison.slice}, ${other} is the closer one.`
  return `Your mark is ${mm(intended.mm)} from the ${code} model locator; the nearest other named model locator on slice ${comparison.slice}, ${other}, is ${mm(nearestOther.mm)} away.`
}

/**
 * The `beyondSpan` scalar compares the mark's distance from the intended locator with the
 * distance between the two locators themselves. Say that, rather than a shorter comparison
 * that reads as though the other locator were the farther one.
 */
export function spanSentence(comparison: MarkComparison) {
  const { intended, nearestOther, spanMm } = comparison
  if (!comparison.beyondSpan || !intended || !nearestOther || spanMm === null) return null
  return `Your mark is farther from the ${intended.locator.airway.code} locator (${mm(intended.mm)}) than that locator is from the ${nearestOther.locator.airway.code} locator (${mm(spanMm)}), so it lies outside the span between the two.`
}

/** Named only when the nearest locator is not the other daughter, so the two scopes stay distinct. */
export function siblingSentence(comparison: MarkComparison) {
  const { intended, nearestOther, nearestSibling } = comparison
  if (!intended || !nearestSibling) return null
  if (nearestOther && nearestOther.locator.airway.code === nearestSibling.locator.airway.code)
    return null
  return `The other daughter of this division, ${nearestSibling.locator.airway.code}, is ${mm(nearestSibling.mm)} away on this slice.`
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
  const parentCode = decision.parent.airway.code
  const anchorSlice = exercise.trace.anchor.slice
  const unresolved = comparisons.filter((c) => c.status === 'unresolved')
  return (
    <div className={styles.junctionFeedback} data-junction-feedback>
      <h3>Where your marks sit</h3>
      <ul>
        {comparisons.map((c) => {
          const span = spanSentence(c)
          const sibling = siblingSentence(c)
          return (
            <li key={c.slot} data-mark-status={c.status}>
              <strong>
                {displayAnswerLabel(exercise.trace.checkpoints[0], c.slot, c.label)} · slice{' '}
                {c.slice}.
              </strong>{' '}
              {positionSentence(c)}
              {sibling ? ` ${sibling}` : ''}
              {span ? ` ${span}` : ''}
            </li>
          )
        })}
      </ul>
      <p className={styles.small}>
        Distances are measured on the slice between your mark and the model centreline samples. They
        show where a mark sits, not why it was placed there. This comparison cannot establish which
        lumen contains a mark: follow continuity from {parentCode} through the intervening slices. A
        mark inside the intended lumen can lie a few millimetres from its locator; a mark nearer
        another locator is a reason to re-trace, not a verdict, and by itself it cannot show that a
        vessel or another structure was taken for this airway. Your marks stay exactly where you
        placed them; the gold crosshairs are model references, not corrections.
      </p>
      {unresolved.length > 0 && (
        <>
          <h3>Uncertain? Start here</h3>
          <p>
            {packet?.moreEvidence ??
              `Return to ${exercise.trace.anchor.airway.code} on slice ${anchorSlice} and step toward the answer slice one slice at a time, keeping the air column and its wall in view. The general explanation below describes the method for this division.`}
          </p>
          <p className={styles.revisitControls}>
            <button onClick={() => onGoToSlice(anchorSlice)}>
              Go to the parent slice {anchorSlice}
            </button>
            {[...new Set(unresolved.map((c) => c.slice))].map((slice) => (
              <button key={slice} onClick={() => onGoToSlice(slice)}>
                Go to response slice {slice}
              </button>
            ))}
          </p>
          <p>
            Reference trace: the gold crosshairs mark the model locators on the demonstration
            slices. Replay the walkthrough below, then redo the marks or continue. An unresolved
            response stays unresolved: it is neither counted against you nor turned into an
            identification.
          </p>
        </>
      )}
      {packet ? (
        <>
          <h3>Where the paths diverge</h3>
          <p>{packet.divergence}</p>
          <h3>Which wall or lumen decides it</h3>
          <p>{packet.continuity}</p>
          {comparisons.map((c) => {
            if (c.status !== 'nearest-other' || !c.nearestOther) return null
            const code = decision.options[c.slot].airway.code
            const entry = packet.whenNearer[code]
            if (!entry) return null
            const nearest = c.nearestOther.locator.airway.code
            if (entry.appliesTo === 'any' || entry.appliesTo.includes(nearest))
              return (
                <p key={c.slot} data-when-nearer={code}>
                  {entry.text}
                </p>
              )
            return (
              <p key={c.slot} data-when-nearer-scope={code}>
                Your {code} mark sits nearer the {nearest} model locator. The written guidance for
                this division compares {code} with {entry.appliesTo.join(' and ')}; {nearest} is a
                different model airway crossing this slice, so that comparison does not apply to
                your mark. Return to {parentCode} on slice {anchorSlice} and follow the lumen into
                this division one slice at a time; the comparison above cannot say which lumen your
                mark is in.
              </p>
            )
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
            <SourceIdentifiers exercise={exercise} />
          </details>
          <NamingAid packet={packet} />
        </>
      ) : (
        <>
          <p data-feedback-scope>
            A written explanation of this division has not been authored yet, so nothing below
            describes its walls or its course. The position comparison above, the general
            explanation below and the CT interval you just browsed are what is available here.
          </p>
          <p className={styles.revisitControls}>
            <button onClick={() => onGoToSlice(anchorSlice)}>
              Go to the parent slice {anchorSlice}
            </button>
            {exercise.answerPoints.map((p, i) => (
              <button key={p.slice} onClick={() => onGoToSlice(p.slice)}>
                Go to {displayAnswerLabel(exercise.trace.checkpoints[0], i, p.label)} · slice{' '}
                {p.slice}
              </button>
            ))}
          </p>
          <details>
            <summary>Source and review details</summary>
            <SourceIdentifiers exercise={exercise} />
          </details>
        </>
      )}
    </div>
  )
}

/**
 * Technical identifiers stay here, in the source and review detail, and out of the teaching
 * sentences above.
 */
function SourceIdentifiers({ exercise }: { exercise: LocalCtExercise }) {
  const { teaching, spec, review } = exercise
  return (
    <ul className={styles.small}>
      <li>Source case: {teaching.sourceCase}.</li>
      <li>
        Division: {spec.checkpointId} · parent source edge {teaching.parentEdge}
        {teaching.daughterEdges.length
          ? ` · daughter source edges ${teaching.daughterEdges.join(', ')}`
          : ''}
        .
      </li>
      <li>
        Volume {teaching.sourceSha256.slice(0, 12)}… · airway graph{' '}
        {teaching.graphSha256.slice(0, 12)}….
      </li>
      <li>
        Authored feedback exists for these divisions only: {JUNCTION_FEEDBACK_SCOPE.join(', ')}.
      </li>
      <li>
        {review.status === 'provisional'
          ? review.reason
          : `Reviewed by ${review.reviewer}, ${review.date}.`}
      </li>
    </ul>
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
