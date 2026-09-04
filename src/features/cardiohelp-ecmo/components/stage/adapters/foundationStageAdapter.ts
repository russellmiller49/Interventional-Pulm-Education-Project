import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { pathwaySectionIndex } from '@/features/learning-module/curriculum/types'

import { ecmoDeliveryAttribution } from '../../../content/deliveryAttribution'
import { ecmoFoundationLearningItemsFor } from '../../../content/foundationLearningItems'
import { ecmoFoundationSectionById } from '../../../content/foundationLessons'
import {
  ecmoFoundationLessonRuntime,
  type EcmoInteractiveFoundationSectionId,
} from '../../../content/foundationLessonRuntime'
import type { SupportMode } from '../../../engine/types'
import type { CircuitLocationDisclosure } from '../../CircuitAndMonitors'
import { STAGE_PHASES, type StageLesson, type StagePhase, type StageStep } from '../stageModel'

/**
 * A foundation section, expressed as stage steps.
 *
 * The runtime already authors one block of copy per activity phase — objective, required action,
 * teaching point — and one clean state per phase where the phase's content assumes it. The six
 * phases become six steps in contract order, with the prediction item in the Predict step, the
 * bounded actions in the Act step, and the transfer item in the Transfer step, whose commitment is
 * what records the section as worked. Nothing about the runtime, the items, or the walk changes;
 * the adapter only says which of them each step shows.
 */

/**
 * The one foundation section whose keyed prediction *is* the channel placements.
 *
 * `circuit-flow-path` asks where in the blood path the circuit reports pInt, so the diagnostic map
 * beside that question must not answer it. No other section keys on a placement, and nine of them
 * teach *from* the placements.
 */
export function foundationCircuitLocationDisclosure(
  sectionId: EcmoInteractiveFoundationSectionId,
  predictionCommitted: boolean,
): CircuitLocationDisclosure {
  return sectionId === 'circuit-flow-path' && !predictionCommitted ? 'withheld' : 'full'
}

const SURFACES_BY_PHASE: Readonly<Record<StagePhase, StageStep['surfaces']>> = {
  recognize: ['circuit'],
  predict: ['circuit'],
  act: ['circuit'],
  observe: ['circuit', 'monitor'],
  explain: ['circuit'],
  transfer: ['circuit'],
}

const PROSE_BY_PHASE: Readonly<Record<StagePhase, StageStep['teaching']['prose']>> = {
  recognize: 'summary',
  predict: 'none',
  act: 'none',
  observe: 'none',
  explain: 'full',
  transfer: 'summary',
}

export function buildFoundationStageLesson(
  sectionId: EcmoInteractiveFoundationSectionId,
  supportMode: SupportMode,
): StageLesson {
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const resolvedMode = runtime.supportMode ?? supportMode
  const section = ecmoFoundationSectionById.get(sectionId)
  if (!section) throw new Error(`Foundation section has no record: ${sectionId}`)
  const items = ecmoFoundationLearningItemsFor(sectionId)
  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', resolvedMode)
  const sectionIndex = pathwaySectionIndex(pathway, sectionId)
  const pathwaySection = pathway.sections[sectionIndex]

  const steps: StageStep[] = STAGE_PHASES.map((phase, index) => {
    const copy = runtime.phases[phase]
    const base = {
      id: `${sectionId}-${phase}`,
      ordinal: index + 1,
      phase,
      title: copy.objective,
      instruction: copy.requiredAction,
      rationale: copy.teachingPoint,
      focusTarget: null,
      surfaces: SURFACES_BY_PHASE[phase],
      teaching: { prose: PROSE_BY_PHASE[phase], blocks: 'all' } as const,
      gate: (phase === 'recognize' || phase === 'predict' ? 'open' : 'after-prediction') as
        | 'open'
        | 'after-prediction',
      // Only an authored mapping loads a state on entry; unmapped phases keep the learner's state.
      entryVariantId: runtime.initialVariantIdByPhase?.[phase],
    }
    switch (phase) {
      case 'predict':
        return {
          ...base,
          actionLabel: 'Commit this prediction',
          interaction: { kind: 'prediction', item: items.prediction, verdict: 'choice-reasoning' },
        }
      case 'act': {
        /*
         * A section that authors an attribution gets a real judgement to make here; the rest keep
         * the bounded actions. Before this the Act step of every foundation section was the same
         * Continue button, which is how the first section came to promise a selection it did not
         * offer.
         */
        const attribution = ecmoDeliveryAttribution(sectionId)
        if (attribution) {
          return {
            ...base,
            actionLabel: 'Commit these answers',
            interaction: { kind: 'attribution', attribution },
          }
        }
        return {
          ...base,
          actionLabel: 'Continue',
          interaction: { kind: 'bounded-actions', actions: runtime.guidedActions },
        }
      }
      case 'transfer':
        return {
          ...base,
          actionLabel: 'Commit this answer',
          interaction: { kind: 'transfer-item', item: items.transfer },
        }
      default:
        return { ...base, actionLabel: 'Continue', interaction: { kind: 'read' } }
    }
  })

  return {
    kind: 'foundation',
    sectionId,
    scenarioId: sectionId,
    supportMode: resolvedMode,
    title: pathwaySection?.title ?? section.title,
    minutes: pathwaySection?.minutes ?? section.minutes,
    index: sectionIndex,
    total: pathway.sections.length,
    objectives: [],
    steps,
    predictionStepIndex: steps.findIndex((step) => step.interaction.kind === 'prediction'),
    lifecycleActivityId: `ecmo:learn:${sectionId}`,
  }
}
