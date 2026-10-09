'use client'

import { useState } from 'react'
import type { CtMark, LocalCtExercise } from '../content/ct-types'
import type { JunctionFeedbackPacket } from '../content/junction-feedback'
import {
  compareMarks,
  FILL_CAP_MM,
  type MarkComparison,
  type ModelLocator,
  type PlaneMove,
} from '../engine/junction-feedback'
import { displayAnswerLabel, divisionIdentities } from '../engine/branch-identity'
import styles from './branch-tracing.module.css'

const mm = (value: number) => `${value.toFixed(1)} mm`

/** "about 6 mm posterior and toward the patient's right", in patient directions. */
export function moveSentence(move: PlaneMove) {
  const parts: string[] = []
  if (Math.abs(move.posteriorMm) >= 0.4 * move.mm)
    parts.push(move.posteriorMm > 0 ? 'posterior' : 'anterior')
  if (Math.abs(move.leftMm) >= 0.4 * move.mm)
    parts.push(move.leftMm > 0 ? 'toward the patient’s left' : 'toward the patient’s right')
  const distance = move.mm < 1.5 ? '1 to 2 mm' : `about ${Math.round(move.mm)} mm`
  return `${distance} ${parts.join(' and ')}`.trim()
}

/** How a model locator is named to the learner: by code, or by role where codes repeat. */
export function locatorName(exercise: LocalCtExercise, locator: ModelLocator) {
  const checkpoint = exercise.trace.checkpoints[0]
  const identities = divisionIdentities(checkpoint)
  if (!identities?.anyRepeatedName) return locator.airway.code
  if (locator.role === 'parent') return `the parent (${locator.airway.code})`
  const daughter = identities.daughters.find((d) => d.sourceEdgeId === locator.edgeId)
  if (daughter)
    return `${daughter.role} (${daughter.code}${daughter.repeatedName ? `, ${daughter.direction.toLowerCase()}` : ''})`
  return locator.airway.code
}

export interface VerdictBand {
  tone: 'in' | 'near' | 'miss'
  headline: string
  detail: string
}

/**
 * The result band for one mark: what the mark is in, and for a miss, which way to move. Null when
 * the response was recorded as unresolved or the plane has no air mask.
 */
export function verdictBand(
  exercise: LocalCtExercise,
  comparison: MarkComparison,
): VerdictBand | null {
  const result = comparison.verdict
  const intended = comparison.intended
  if (!result || !intended) return null
  const target = locatorName(exercise, intended.locator)
  const move = `Move ${moveSentence(result.toIntended)} to reach ${target}.`
  // Only this division's own airways are named: the parent and the other daughter.
  const others = result.reached.filter(
    (r) => r.locator.role === 'parent' || r.locator.role === 'daughter',
  )
  if (result.verdict === 'intended-lumen')
    return {
      tone: 'in',
      headline: `In ${target}.`,
      detail: others.length
        ? `Your mark is inside ${target}. On slice ${comparison.slice} it is still one air column with ${locatorName(exercise, others[0].locator)}, and your mark is in the part that is ${target}.`
        : `Your mark is inside the lumen of ${target} on slice ${comparison.slice}.`,
    }
  const nearest = result.nearest ? locatorName(exercise, result.nearest) : ''
  if (result.verdict === 'near-fork')
    return {
      tone: 'near',
      headline:
        result.nearest?.role === 'parent'
          ? `Still in ${nearest}, before the fork.`
          : `At the fork, on the side of ${nearest}.`,
      detail: `On slice ${comparison.slice} ${target} and ${nearest} are one air column, and your mark is nearer ${nearest}. ${move}`,
    }
  if (result.verdict === 'other-airway')
    return {
      tone: 'miss',
      headline: `In ${nearest}, not ${target}.`,
      detail: `Your mark is inside the lumen of ${nearest} on slice ${comparison.slice}. ${move}`,
    }
  return result.markInAir
    ? {
        tone: 'miss',
        headline: 'In air that does not join a named airway.',
        detail: `The dark spot you marked does not connect to ${target} within ${FILL_CAP_MM} mm on slice ${comparison.slice}: lung, or a small branch off this route. ${move}`,
      }
    : {
        tone: 'miss',
        headline: 'Not in a lumen.',
        detail: `Your mark is on wall, vessel or lung, not on air. ${move}`,
      }
}

/** One sentence per response: distance to the model centres on that slice. */
export function positionSentence(comparison: MarkComparison) {
  const { intended, nearestOther, status } = comparison
  if (status === 'unresolved' || !intended)
    return `You recorded ${comparison.label} as unresolved on slice ${comparison.slice}. See "Could not separate them? Do this" below, then mark it.`
  const code = intended.locator.airway.code
  if (!nearestOther)
    return `Your mark is ${mm(intended.mm)} from the ${code} centre; no other named airway crosses slice ${comparison.slice}.`
  const other =
    nearestOther.locator.airway.code === code
      ? `other ${code} branch`
      : nearestOther.locator.airway.code
  if (status === 'nearest-other')
    return `Your mark is ${mm(nearestOther.mm)} from the ${other} centre and ${mm(intended.mm)} from the ${code} centre.`
  return `Your mark is ${mm(intended.mm)} from the ${code} centre; the next nearest named airway on slice ${comparison.slice}, ${other}, is ${mm(nearestOther.mm)} away.`
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
  if (nearestOther && nearestOther.locator.edgeId === nearestSibling.locator.edgeId) return null
  return `The other daughter of this division, ${nearestSibling.locator.airway.code}, is ${mm(nearestSibling.mm)} away on this slice.`
}

/** The model locator a missed mark ended up in or nearer, for the written guidance. */
function missedInto(comparison: MarkComparison): ModelLocator | null {
  const result = comparison.verdict
  if (result) {
    if (result.verdict === 'intended-lumen') return null
    if (result.nearest) return result.nearest
  }
  return comparison.status === 'nearest-other' ? (comparison.nearestOther?.locator ?? null) : null
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
  const checkpoint = exercise.trace.checkpoints[0]
  const anchorSlice = exercise.trace.anchor.slice
  const unresolved = comparisons.filter((c) => c.status === 'unresolved')
  return (
    <div className={styles.junctionFeedback} data-junction-feedback>
      <h3>Where your marks are</h3>
      <ul className={styles.verdictList}>
        {comparisons.map((c) => {
          const band = verdictBand(exercise, c)
          const sibling = band ? null : siblingSentence(c)
          return (
            <li key={c.slot} data-mark-status={c.status} data-mark-verdict={c.verdict?.verdict}>
              <strong>
                {displayAnswerLabel(checkpoint, c.slot, c.label)} · slice {c.slice}.
              </strong>{' '}
              {band && (
                <span className={styles.verdictBand} data-verdict-tone={band.tone} role="status">
                  <strong>{band.headline}</strong> {band.detail}
                </span>
              )}{' '}
              <span className={band ? styles.small : undefined}>
                {positionSentence(c)}
                {sibling ? ` ${sibling}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
      <p className={styles.small}>
        The result reads the CT’s own air: your mark is in a lumen when the air under it connects to
        the centre of that airway. Anywhere inside the lumen counts; you do not need to hit the gold
        crosshair. Your marks stay where you placed them.
      </p>
      {unresolved.length > 0 && (
        <>
          <h3>Could not separate them? Do this</h3>
          <p>
            {packet?.moreEvidence ??
              `Go back to ${exercise.trace.anchor.airway.code} on slice ${anchorSlice} and step toward the answer slice one slice at a time. Keep the dark lumen and its wall in view; when a wall appears inside it, you have two lumens. Then mark each one.`}
          </p>
          <p className={styles.revisitControls}>
            <button onClick={() => onGoToSlice(anchorSlice)}>
              Go to the parent slice {anchorSlice}
            </button>
            {[...new Set(unresolved.map((c) => c.slice))].map((slice) => (
              <button key={slice} onClick={() => onGoToSlice(slice)}>
                Go to answer slice {slice}
              </button>
            ))}
          </p>
          <p>
            Then use Redo branch marks below and mark the lumen. The gold crosshairs on the CT show
            where each one is.
          </p>
        </>
      )}
      {packet && (
        <>
          <h3>Where the paths diverge</h3>
          <p>{packet.divergence}</p>
          <h3>Which wall or lumen decides it</h3>
          <p>{packet.continuity}</p>
          {comparisons.map((c) => {
            const into = missedInto(c)
            const entry = packet.whenNearer[c.slot]
            if (!into || !entry) return null
            if (entry.appliesTo !== 'any' && !entry.appliesTo.some((role) => role === into.role))
              return null
            return (
              <p key={c.slot} data-when-nearer={c.slot}>
                {entry.text}
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
            <summary>Levels and distances at this division</summary>
            <ul>
              {packet.known.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
          <NamingAid packet={packet} />
        </>
      )}
    </div>
  )
}

/** Names are taught first; the question is optional, unrecorded and can be repeated. */
function NamingAid({ packet }: { packet: JunctionFeedbackPacket }) {
  const [choice, setChoice] = useState<string | null>(null)
  const [namesShown, setNamesShown] = useState(false)
  const naming = packet.naming
  const revealed = choice !== null || namesShown
  return (
    <details data-naming-aid>
      <summary>Name the daughters</summary>
      {naming.demonstration.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {naming.try && (
        <div className={styles.namingTry}>
          <p>
            <strong>Try it:</strong> {naming.try.prompt}
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
