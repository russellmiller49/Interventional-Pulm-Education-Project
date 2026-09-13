import { ecmoCircuitWalkStopsForSection } from '../../../content/circuitWalk'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { pathwaySectionIndex } from '@/features/learning-module/curriculum/types'

import { ecmoDeliveryAttribution } from '../../../content/deliveryAttribution'
import { ecmoFoundationLearningItemsFor } from '../../../content/foundationLearningItems'
import { ecmoFoundationSectionById } from '../../../content/foundationLessons'
import { ecmoFoundationTeachingTasks } from '../../../content/foundationTeachingTasks'
import {
  ecmoFoundationLessonRuntime,
  isEcmoSharedFoundationSectionId,
  type EcmoInteractiveFoundationSectionId,
} from '../../../content/foundationLessonRuntime'
import type { SupportMode } from '../../../engine/types'
import type { CircuitLocationDisclosure } from '../../CircuitAndMonitors'
import { STAGE_PHASES, type StageLesson, type StagePhase, type StageStep } from '../stageModel'

/**
 * The four introductory sections opt into concrete teaching tasks before independent questions.
 * The other six retain the existing six-phase runtime and its commitment gates.
 * Normal Learn diagrams show pressure locations; only an explicit unlabelled retrieval task
 * removes them until its own answer is submitted.
 */
export function foundationCircuitLocationDisclosure(
  sectionId: EcmoInteractiveFoundationSectionId,
  predictionCommitted: boolean,
  mapRetrieval = false,
): CircuitLocationDisclosure {
  // Normal Learn diagrams teach locations before questions. Only a deliberately unlabelled
  // retrieval task removes labels, until its own answer is submitted.
  return sectionId === 'circuit-flow-path' && mapRetrieval && !predictionCommitted
    ? 'withheld'
    : 'full'
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

  /*
   * A section that walks the circuit is read on the pressure-zone map, where the walk marks its
   * stop. Authored on every step of the section so the map is on screen from the first one, and
   * applied on entry only, so a learner who opens the bedside scene keeps it for that step.
   */
  const walksTheCircuit = ecmoCircuitWalkStopsForSection(sectionId).length > 0

  const focusedTasks = isEcmoSharedFoundationSectionId(sectionId)
    ? ecmoFoundationTeachingTasks[sectionId]
    : undefined
  const steps: StageStep[] = focusedTasks
    ? focusedTasks.map((task, index) => {
        const guided = task.actionId
          ? runtime.guidedActions.find((action) => action.id === task.actionId)
          : undefined
        if (task.actionId && !guided) throw new Error(`Missing guided comparison: ${task.actionId}`)
        const predictionIndex = focusedTasks.findIndex((entry) => entry.phase === 'predict')
        const interaction: StageStep['interaction'] =
          task.phase === 'predict'
            ? { kind: 'prediction', item: items.prediction, verdict: 'choice-reasoning' }
            : task.phase === 'transfer'
              ? { kind: 'transfer-item', item: items.transfer }
              : task.attribution
                ? { kind: 'attribution', attribution: ecmoDeliveryAttribution(sectionId)! }
                : guided
                  ? { kind: 'bounded-actions', actions: [guided] }
                  : { kind: 'read' }
        return {
          id: `${sectionId}-${task.id}`,
          ordinal: index + 1,
          phase: task.phase,
          title: task.title,
          instruction: task.instruction,
          lookIn: task.lookIn,
          foundationTask: task,
          focusTarget: null,
          gate: index > predictionIndex ? 'after-prediction' : 'open',
          actionLabel:
            task.phase === 'predict' || task.phase === 'transfer'
              ? 'Submit answer'
              : task.attribution
                ? 'Submit these answers'
                : 'Continue',
          interaction,
          teaching: { prose: 'none', blocks: [task.block] },
          ...(walksTheCircuit ? { circuitView: 'diagnostic' as const } : {}),
          surfaces:
            task.block === 'circuit-patient'
              ? ['circuit', 'monitor']
              : sectionId === 'blood-flow-versus-sweep'
                ? ['gas', 'monitor']
                : ['circuit'],
        }
      })
    : STAGE_PHASES.map((phase, index) => {
        const copy = runtime.phases[phase]
        const base = {
          id: `${sectionId}-${phase}`,
          ordinal: index + 1,
          phase,
          title: copy.objective,
          instruction: copy.requiredAction,
          lookIn: copy.lookIn,
          rationale: copy.teachingPoint,
          focusTarget: null,
          surfaces: SURFACES_BY_PHASE[phase],
          ...(walksTheCircuit ? { circuitView: 'diagnostic' as const } : {}),
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
              interaction: {
                kind: 'prediction',
                item: items.prediction,
                verdict: 'choice-reasoning',
              },
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
