import { imagingLearningActivities, type ImagingLearningActivity } from './learningActivities'
import { imagingLesson, peripheralImagingSectionIds, type ImagingSectionId } from './pathway'
import { imagingSectionSpec } from './sectionSpecs'

/**
 * Where a demonstration was first shown.
 *
 * Reports 2.8 and 3.4 (fellow walkthrough, PDF pp.19 and 29): the same worked demonstration — the
 * frontal overlap that separates when the projection changes; crop and zoom on a stored frame —
 * opens several sections with the same cue, and by the third time the learner was clicking past it
 * without reading what the section had added. The sections are not merged or reordered: a later
 * section keeps its demonstration, with its full examples and cue, and says up front that it is a
 * reminder from an earlier section and what is new here.
 *
 * A reuse is recognised by the authored example titles, which name one authored state each
 * (`teachingExamples.ts`). Two activities of the same section that share an example are the
 * section's own progression, not a reminder.
 */
export interface DemonstrationOrigin {
  readonly sectionId: ImagingSectionId
  readonly number: number
  readonly title: string
  readonly activityId: string
  /** The example titles this demonstration shares with the original. */
  readonly shared: readonly string[]
  /** What this section adds to the reminder: its one new concept. */
  readonly newHere: string
}

export function demonstrationOrigin(
  sectionId: ImagingSectionId,
  activity: ImagingLearningActivity,
): DemonstrationOrigin | null {
  const examples = activity.examples ?? []
  if (activity.task !== 'read' || examples.length === 0) return null
  // One reminder per section: the first demonstration that reuses earlier examples carries it;
  // a later activity of the same section is the section's own progression.
  const own = imagingLearningActivities(sectionId)
  const position = peripheralImagingSectionIds.indexOf(sectionId)
  const firstReuse = own.find(
    (candidate) =>
      candidate.task === 'read' &&
      (candidate.examples ?? []).some((title) =>
        peripheralImagingSectionIds
          .slice(0, position)
          .some((earlierId) =>
            imagingLearningActivities(earlierId).some(
              (earlier) => earlier.task === 'read' && earlier.examples?.includes(title),
            ),
          ),
      ),
  )
  if (firstReuse && firstReuse.id !== activity.id) return null
  for (const earlierId of peripheralImagingSectionIds.slice(0, position)) {
    for (const earlier of imagingLearningActivities(earlierId)) {
      if (earlier.task !== 'read' || !earlier.examples?.length) continue
      const shared = examples.filter((title) => earlier.examples!.includes(title))
      if (shared.length === 0) continue
      return {
        sectionId: earlierId,
        number: peripheralImagingSectionIds.indexOf(earlierId) + 1,
        title: imagingLesson(earlierId).title,
        activityId: earlier.id,
        shared,
        newHere: imagingSectionSpec(sectionId).newConcept,
      }
    }
  }
  return null
}

/** Every reminder on the pathway, for the tests and the handoff. */
export function demonstrationReminders(): readonly {
  readonly activityId: string
  readonly origin: DemonstrationOrigin
}[] {
  return peripheralImagingSectionIds.flatMap((sectionId) =>
    imagingLearningActivities(sectionId).flatMap((activity) => {
      const origin = demonstrationOrigin(sectionId, activity)
      return origin ? [{ activityId: activity.id, origin }] : []
    }),
  )
}
