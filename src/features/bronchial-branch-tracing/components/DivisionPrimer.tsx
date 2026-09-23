import type { LocalCtExercise } from '../content/ct-types'
import { DIRECTION_CHANGE, lessonNumber } from '../content/course-guide'
import {
  JUNCTION_FEEDBACK_OBSERVATION,
  type JunctionFeedbackPacket,
} from '../content/junction-feedback'
import { divisionIdentities } from '../engine/branch-identity'
import { count } from '../engine/display-text'
import { divisionCourse, type DivisionCourse } from '../engine/model-reference'
import { NATIVE_CT } from '../geometry/native-ct'
import styles from './branch-tracing.module.css'

const sliceOf = (z: number) => Math.round((z - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])

export function courseFor(exercise: LocalCtExercise) {
  const checkpoint = exercise.trace.checkpoints[0]
  const identities = divisionIdentities(checkpoint)
  return divisionCourse(
    checkpoint,
    sliceOf,
    (i) => identities?.daughters[i]?.display ?? exercise.answerPoints[i]?.label ?? '',
  )
}

/** Sentences that state the division's source levels. Generated from the export, never judged. */
export function courseSentences(course: DivisionCourse, lessonId: string) {
  const sentences = [
    `The parent point (${course.parentCode}) is on slice ${course.parentSlice} and the model node at about slice ${course.nodeSlice}${
      course.approach === 'same level'
        ? ', so the parent runs almost within one axial plane here'
        : course.approach === 'cranial'
          ? ', so this parent runs toward cranial levels (higher slice numbers)'
          : ', so this parent is followed caudally (toward lower slice numbers)'
    }.`,
    `${course.daughters
      .map(
        (d) =>
          `${d.label}’s response slice, ${d.slice}, ${
            d.fromNode === 'same level'
              ? 'lies on the node’s level'
              : `lies ${count(d.slices, 'slice')} ${d.fromNode} of the node`
          }`,
      )
      .join('; ')}.`,
  ]
  const directions = new Set(
    course.daughters.map((d) => d.fromNode).filter((r) => r !== 'same level'),
  )
  if (course.inPlane)
    sentences.push(
      'The parent point, the node and the response slices lie within one slice of each other: this division lies almost within one axial plane.',
    )
  else if (course.reverses)
    sentences.push(
      `So at least one daughter turns back against the direction you arrived from. ${DIRECTION_CHANGE.definition[1]}${
        lessonId === DIRECTION_CHANGE.lessonId
          ? ''
          : ` Lesson ${lessonNumber(DIRECTION_CHANGE.lessonId)} teaches this change in tracing direction in full.`
      }`,
    )
  else if (directions.size > 1)
    sentences.push('The two daughters leave the node in opposite slice directions.')
  return sentences
}

/**
 * Teaching a learner needs before marking a division, shown in the worked example and kept one
 * click away during the try (BBTF-07): the division's source levels, and, where the BBT-02 packet
 * already wrote them, "Where the paths diverge" and "Which wall or lumen decides it". The packet
 * text is shown exactly as authored, with its review status; nothing is added to it.
 */
export function DivisionPrimer({
  exercise,
  packet,
  lessonId,
}: {
  exercise: LocalCtExercise
  packet?: JunctionFeedbackPacket
  lessonId: string
}) {
  const course = courseFor(exercise)
  if (!course) return null
  return (
    <div className={styles.divisionPrimer} data-division-primer={exercise.spec.checkpointId}>
      <h4>Levels at this division</h4>
      {courseSentences(course, lessonId).map((sentence) => (
        <p key={sentence}>{sentence}</p>
      ))}
      <p className={styles.small}>
        From the source model’s point levels, not a reviewed course description.
      </p>
      {packet &&
        (packet.entryLimitation ? (
          // The limitation above the task already summarises this reading; keep the full text
          // one click away rather than repeating it at length.
          <details>
            <summary>Where the paths diverge and which wall or lumen decides it</summary>
            <PacketReading packet={packet} />
          </details>
        ) : (
          <PacketReading packet={packet} />
        ))}
    </div>
  )
}

function PacketReading({ packet }: { packet: JunctionFeedbackPacket }) {
  return (
    <>
      <h4>Where the paths diverge</h4>
      <p>{packet.divergence}</p>
      <h4>Which wall or lumen decides it</h4>
      <p>{packet.continuity}</p>
      <p className={styles.small}>
        Image readings: {JUNCTION_FEEDBACK_OBSERVATION.by}, {JUNCTION_FEEDBACK_OBSERVATION.date}.{' '}
        {JUNCTION_FEEDBACK_OBSERVATION.status}.
      </p>
    </>
  )
}
