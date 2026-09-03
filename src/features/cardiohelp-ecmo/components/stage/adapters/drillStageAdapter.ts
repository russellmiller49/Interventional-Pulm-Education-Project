import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { pathwaySectionIndex } from '@/features/learning-module/curriculum/types'

import { clinicalPracticeScenarioById } from '../../../content/clinicalCases'
import { pairedCaseIdsForLesson } from '../../../content/curriculum'
import {
  cardiohelpLearnLessonByScenarioId,
  cardiohelpLearnLessons,
} from '../../../content/learnLessons'
import { ecmoLearnPredictionFor } from '../../../content/learnPredictionItems'
import type {
  GuidedLessonDefinition,
  GuidedStepPhase,
  GuidedWalkthroughStep,
  SupportMode,
} from '../../../engine/types'
import {
  defaultSurfacesFor,
  type StageLesson,
  type StagePhase,
  type StageStep,
} from '../stageModel'

/**
 * A guided drill, expressed as stage steps.
 *
 * The drill's own steps carry the six-word phase vocabulary the old player mapped onto the activity
 * contract, and the mapping is kept exactly: orient and observe are Recognize, interpret is Predict,
 * respond is Act, reassess is Observe, transfer is Transfer. One step is added that the drills never
 * had — an Explain step after the reassessment — so every drill has a place where its mechanism is
 * read after the prediction rather than nowhere. It is a read step; completion still fires on the
 * transfer step, so what the module records as "worked" is unchanged.
 */

const PHASE_BY_GUIDED_STEP: Readonly<Record<GuidedStepPhase, StagePhase>> = {
  orient: 'recognize',
  observe: 'recognize',
  interpret: 'predict',
  respond: 'act',
  reassess: 'observe',
  transfer: 'transfer',
}

export function resolveGuidedLesson(scenarioId: string): GuidedLessonDefinition {
  return cardiohelpLearnLessonByScenarioId.get(scenarioId) ?? cardiohelpLearnLessons[0]
}

function stageStepFromGuided(
  step: GuidedWalkthroughStep,
  ordinal: number,
  gate: StageStep['gate'],
): StageStep {
  const base = {
    id: step.id,
    ordinal,
    phase: PHASE_BY_GUIDED_STEP[step.phase],
    title: step.title,
    instruction: step.instruction,
    rationale: step.rationale,
    actionLabel: step.actionLabel,
    circuitView: step.preferredCircuitView,
    teaching: { prose: 'none', blocks: 'all' } as const,
    gate,
    expectedResponse: step.expectedResponse,
  }

  if (step.predictionScenarioId) {
    const prediction = ecmoLearnPredictionFor(step.predictionScenarioId)
    if (!prediction) {
      throw new Error(`Guided drill step has no authored prediction: ${step.id}`)
    }
    return {
      ...base,
      interaction: {
        kind: 'prediction',
        item: prediction.item,
        verdict: 'answer-verdict',
        commitments: prediction.commitments,
      },
      focusTarget: step.target,
      surfaces: defaultSurfacesFor(step.target, step.preferredCircuitView),
    }
  }

  if (step.transferScenarioId) {
    return {
      ...base,
      interaction: {
        kind: 'transfer-scenario',
        scenarioId: step.transferScenarioId,
        setupActions: step.transferSetupActions ?? [],
        actions: step.actions,
        target: step.target,
      },
      focusTarget: step.target,
      surfaces: defaultSurfacesFor(step.target, step.preferredCircuitView),
    }
  }

  if (step.interaction === 'task-pane') {
    return {
      ...base,
      interaction: { kind: 'model-advance', actions: step.actions },
      focusTarget: null,
      surfaces: defaultSurfacesFor(step.target, step.preferredCircuitView),
    }
  }

  if (step.actions.length === 0) {
    return {
      ...base,
      interaction: { kind: 'read' },
      focusTarget: step.target,
      surfaces: defaultSurfacesFor(step.target, step.preferredCircuitView),
    }
  }

  return {
    ...base,
    interaction: { kind: 'simulator-task', actions: step.actions, target: step.target },
    focusTarget: step.target,
    surfaces: defaultSurfacesFor(step.target, step.preferredCircuitView),
  }
}

function explainStep(scenarioId: string, ordinal: number): StageStep {
  return {
    id: `${scenarioId}-explain`,
    ordinal,
    phase: 'explain',
    title: 'What explains the pattern you worked',
    instruction:
      'Read what explains the pattern, which control it lived on, and the reflex it tempts. Then carry the reasoning forward.',
    actionLabel: 'I have read what explains it',
    interaction: { kind: 'read' },
    focusTarget: null,
    surfaces: [],
    teaching: { prose: 'none', blocks: 'all' },
    gate: 'after-prediction',
  }
}

export function buildDrillStageLesson(
  lesson: GuidedLessonDefinition,
  supportMode: SupportMode,
): StageLesson {
  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', supportMode)
  const sectionIndex = pathwaySectionIndex(pathway, lesson.scenarioId)
  const section = pathway.sections[sectionIndex]
  const predictionGuidedIndex = lesson.steps.findIndex((step) => step.predictionScenarioId)

  const steps: StageStep[] = []
  let ordinal = 1
  lesson.steps.forEach((guided, index) => {
    const gate: StageStep['gate'] =
      predictionGuidedIndex >= 0 && index > predictionGuidedIndex ? 'after-prediction' : 'open'
    if (guided.phase === 'transfer') {
      steps.push(explainStep(lesson.scenarioId, ordinal))
      ordinal += 1
    }
    steps.push(stageStepFromGuided(guided, ordinal, gate))
    ordinal += 1
  })
  if (!lesson.steps.some((guided) => guided.phase === 'transfer')) {
    steps.push(explainStep(lesson.scenarioId, ordinal))
  }

  const predictionStepIndex = steps.findIndex((step) => step.interaction.kind === 'prediction')
  const pairedCaseId = pairedCaseIdsForLesson(lesson.scenarioId)[0]
  const pairedCase = pairedCaseId ? clinicalPracticeScenarioById.get(pairedCaseId) : undefined

  return {
    kind: 'drill',
    sectionId: lesson.scenarioId,
    scenarioId: lesson.scenarioId,
    supportMode,
    title: section?.title ?? lesson.title,
    minutes: section?.minutes ?? 12,
    index: sectionIndex,
    total: pathway.sections.length,
    objectives: lesson.learningObjectives,
    steps,
    predictionStepIndex,
    lifecycleActivityId: `ecmo:learn:${lesson.scenarioId}`,
    ...(pairedCase ? { practicePairing: { caseId: pairedCase.id, title: pairedCase.title } } : {}),
  }
}
