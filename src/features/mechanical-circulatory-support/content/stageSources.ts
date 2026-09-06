import { MCS_CONTROL_PANEL } from './controlPanel'
import { mcsIncrementForSection } from './deviceIncrements'
import { mcsLessons } from './lessons'
import { mcsLessonTransferByLessonId } from './lessonTransfers'
import { mcsSectionLearningContractById } from './sectionLearningContracts'
import { mcsSectionSpec } from './sectionSpecs'
import { mcsSources } from './sources'
import { mcsStoryProblemsFor } from './storyProblems'
import { MCS_SUPPORT_GRAMMAR } from './supportGrammar'
import { MCS_SUPPORT_SPINE } from './supportSpine'

/**
 * Every source a section cites, for the footer that cites them all in one place.
 *
 * Derived from the content registries rather than reported by the panes at render, so the set
 * cannot go stale behind a surface that quietly starts citing something new. The lesson's own
 * sources come first, in their authored order; the prediction and transfer items, the story
 * problems, and the constructs the section stands on (the spine, the control panel, the one
 * table, the increment) follow. Each id appears once. `stage-sources.test.ts` holds the set to
 * what the section's surfaces actually cite.
 */

export interface McsStageSources {
  readonly sourceIds: readonly string[]
}

const registered = new Set(mcsSources.map((source) => source.id))

export function mcsStageSources(sectionId: string): McsStageSources {
  const lesson = mcsLessons.find((candidate) => candidate.id === sectionId)
  const contract = mcsSectionLearningContractById.get(sectionId)
  const transfer = mcsLessonTransferByLessonId.get(sectionId)
  const spec = mcsSectionSpec(sectionId)
  const collected: string[] = []
  const add = (ids: readonly string[]) => {
    for (const id of ids) {
      if (!registered.has(id)) continue
      if (!collected.includes(id)) collected.push(id)
    }
  }
  add(lesson?.sourceIds ?? [])
  add(contract?.predictionItem.evidenceIds ?? [])
  add(transfer?.item.evidenceIds ?? [])
  for (const story of mcsStoryProblemsFor(sectionId)) add(story.item.evidenceIds)
  if (spec.walksTheLoop) {
    add(MCS_SUPPORT_SPINE.sourceIds)
    add(MCS_CONTROL_PANEL.sourceIds)
  }
  if (spec.grammarRowIds.length > 0) add(MCS_SUPPORT_GRAMMAR.sourceIds)
  const increment = mcsIncrementForSection(sectionId)
  if (increment) add(increment.sourceIds)
  return { sourceIds: collected }
}
