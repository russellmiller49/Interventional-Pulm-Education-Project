import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import {
  stageStepLocationErrors,
  type StageLessonBase,
  type StageStepBase,
  type StageStepLocation,
} from '@/features/learning-module/stage/stageModel'

import dolphinAnatomyManifest from '@/features/dolphin-anatomy/content/dolphin-001-manifest.json'
import { DOLPHIN_SOURCE_IDS } from '../data/sources'
import { authoringRuleErrors, sectionSurfaces } from './authoringRules'
import { dolphinLearnerCopyErrors } from './learnerCopy'
import { dolphinObjectiveById } from './objectives'
import { dolphinSectionIds, type DolphinSectionId } from './pathway'
import { DOLPHIN_SECTIONS, dolphinSectionDefinition } from './sections'
import { toDolphinClinicalItem } from './stageItems'
import { DOLPHIN_NUMBER_IDS } from './teachingNumbers'
import type { AuthoredItem, DolphinAct, DolphinActKind, DolphinSectionDefinition } from './types'

/**
 * Sections → stage lessons: Recognize → Predict → Act → Explain → Transfer.
 *
 * Every step is open (self-paced): a learner may skip any step, and any item can show its
 * explanation before it is answered. What stays withheld is the teaching that answers the
 * prediction: post-commit blocks open at Explain. The validators run at import, so a section that
 * leaks its answer, cites an unknown source or states an unsourced number fails the build.
 */
export type DolphinInteraction =
  | { readonly kind: 'read' }
  | {
      readonly kind: 'prediction'
      readonly item: ClinicalLearningItem
      readonly authored: AuthoredItem
    }
  | { readonly kind: 'act'; readonly act: DolphinAct }
  | { readonly kind: 'explain' }
  | {
      readonly kind: 'transfer'
      readonly item: ClinicalLearningItem
      readonly authored: AuthoredItem
    }

export type DolphinStageStep = StageStepBase<DolphinInteraction>

export interface DolphinStageLesson extends StageLessonBase<DolphinStageStep> {
  readonly sectionId: DolphinSectionId
  readonly section: DolphinSectionDefinition
  readonly transferStepIndex: number
  readonly actStepIndex: number
}

const ACT_TITLES: Readonly<Record<DolphinActKind, string>> = {
  'scope-lab': 'Drive the scope',
  'branch-drill': 'Find the named branches',
  identify: 'Name each view',
  'anatomy-pick': 'Pick the structures',
  sort: 'Sort the statements',
  sequence: 'Put the steps in order',
  calculate: 'Work the ledger',
  report: 'Write the record',
  'instrument-drill': 'Work the instruments',
  scenario: 'Work the case',
  read: 'Read the worked example',
}

const ACT_LANDMARKS: Readonly<Record<DolphinActKind, StageStepLocation>> = {
  'scope-lab': {
    pane: 'simulator',
    landmark: 'Bronchoscope view',
    alsoPane: 'steps',
    alsoLandmark: 'Goals',
  },
  'branch-drill': {
    pane: 'simulator',
    landmark: 'Bronchoscope view',
    alsoPane: 'steps',
    alsoLandmark: 'Target',
  },
  identify: { pane: 'steps', landmark: 'Each view and its choices' },
  'anatomy-pick': {
    pane: 'simulator',
    landmark: '3D dolphin',
    alsoPane: 'steps',
    alsoLandmark: 'Prompt',
  },
  sort: { pane: 'steps', landmark: 'Each statement and its bins' },
  sequence: { pane: 'steps', landmark: 'The list to order' },
  calculate: { pane: 'steps', landmark: 'Lidocaine ledger' },
  report: { pane: 'steps', landmark: 'Bronchoscopy record' },
  scenario: { pane: 'steps', landmark: 'The case, frame by frame' },
  read: { pane: 'teaching', landmark: 'Worked example' },
  'instrument-drill': {
    pane: 'simulator',
    landmark: 'Instrument lab',
    alsoPane: 'steps',
    alsoLandmark: 'Instruments',
  },
}

export function dolphinActTitle(act: DolphinAct): string {
  return ACT_TITLES[act.kind]
}

function buildLesson(section: DolphinSectionDefinition): DolphinStageLesson {
  const index = dolphinSectionIds.indexOf(section.id)
  const firstBlock = section.blocks.find((block) =>
    ['question', 'signals', 'pattern', 'discriminators'].includes(block.kind),
  )
  const steps: DolphinStageStep[] = [
    {
      id: `${section.id}:recognize`,
      ordinal: 1,
      phase: 'recognize',
      title: 'Read the question',
      instruction: section.recognizeInstruction,
      lookIn: { pane: 'teaching', landmark: firstBlock?.heading ?? 'The question' },
      actionLabel: 'Continue',
      interaction: { kind: 'read' },
      gate: 'open',
    },
    {
      id: `${section.id}:predict`,
      ordinal: 2,
      phase: 'predict',
      title: 'Commit to a prediction',
      instruction:
        'Choose the answer you expect, then check it. The teaching that answers it opens after you commit.',
      lookIn: { pane: 'steps', landmark: 'Prediction' },
      actionLabel: 'Check my answer',
      interaction: {
        kind: 'prediction',
        item: toDolphinClinicalItem(section.id, section.prediction, 'predict'),
        authored: section.prediction,
      },
      gate: 'open',
    },
    {
      id: `${section.id}:act`,
      ordinal: 3,
      phase: 'act',
      title: dolphinActTitle(section.act),
      instruction: actPrompt(section.act),
      lookIn: ACT_LANDMARKS[section.act.kind],
      actionLabel: 'Continue',
      interaction: { kind: 'act', act: section.act },
      gate: 'open',
    },
    {
      id: `${section.id}:explain`,
      ordinal: 4,
      phase: 'explain',
      title: 'Read the explanation',
      instruction:
        'Read the one idea and the teaching that opened in the Teaching panel, with the explanation of your prediction.',
      lookIn: { pane: 'teaching', landmark: 'The one idea' },
      actionLabel: 'Continue',
      interaction: { kind: 'explain' },
      gate: 'open',
    },
    {
      id: `${section.id}:transfer`,
      ordinal: 5,
      phase: 'transfer',
      title: 'Apply it to a new case',
      instruction: 'The same idea in a changed situation. Choose, then check.',
      lookIn: { pane: 'steps', landmark: 'New case' },
      actionLabel: 'Check my answer',
      interaction: {
        kind: 'transfer',
        item: toDolphinClinicalItem(section.id, section.transfer, 'transfer'),
        authored: section.transfer,
      },
      gate: 'open',
    },
  ]
  return {
    sectionId: section.id,
    section,
    title: section.title,
    minutes: section.minutes,
    index,
    total: dolphinSectionIds.length,
    steps,
    predictionStepIndex: 1,
    actStepIndex: 2,
    transferStepIndex: 4,
  }
}

export function actPrompt(act: DolphinAct): string {
  switch (act.kind) {
    case 'sort':
      return act.sort.prompt
    case 'sequence':
      return act.sequence.prompt
    case 'identify':
      return act.identify.prompt
    case 'scenario':
      return `Work the case: ${act.scenario.title}. Choose at each frame; a choice that does not hold shows why.`
    default:
      return act.prompt
  }
}

// ── Validation ──────────────────────────────────────────────────────────────────────────────────

const PRECOMMIT_KINDS = new Set(['question', 'signals', 'pattern', 'discriminators'])
const ANATOMY_IDS = new Set(dolphinAnatomyManifest.structures.map((structure) => structure.id))

/** The words a learner can read before committing the prediction. */
export function precommitSurfaces(
  section: DolphinSectionDefinition,
): readonly { where: string; text: string }[] {
  return [
    { where: 'title', text: section.title },
    { where: 'summary', text: section.summary },
    { where: 'clinical question', text: section.clinicalQuestion },
    { where: 'recognize instruction', text: section.recognizeInstruction },
    { where: 'workspace caption', text: section.workspace.caption },
    ...section.blocks
      .filter((block) => PRECOMMIT_KINDS.has(block.kind))
      .flatMap((block) => [
        { where: `block ${block.id} heading`, text: block.heading },
        { where: `block ${block.id} body`, text: block.body },
        ...(block.points ?? []).map((point, i) => ({
          where: `block ${block.id} point ${i + 1}`,
          text: point,
        })),
      ]),
    { where: 'prediction situation', text: section.prediction.situation ?? '' },
    { where: 'prediction stem', text: section.prediction.stem },
  ].filter((surface) => surface.text.length > 0)
}

export function itemErrors(
  where: string,
  item: AuthoredItem,
  section: DolphinSectionDefinition,
): string[] {
  const errors: string[] = []
  if (item.choices.length !== 4)
    errors.push(`${where} has ${item.choices.length} choices; four are required.`)
  const best = item.choices.filter((choice) => choice.plausibility === 'best')
  if (best.length !== 1) errors.push(`${where} has ${best.length} best choices.`)
  for (const choice of item.choices) {
    const reflex = (section.harmfulReflexPatterns ?? []).some((pattern) =>
      pattern.test(choice.label),
    )
    if (choice.plausibility === 'unsafe' && !reflex) {
      errors.push(
        `${where} choice ${choice.id} is unsafe but does not name the section's harmful reflex.`,
      )
    }
    if (choice.plausibility === 'best' && reflex) {
      errors.push(`${where} keys a choice that names the harmful reflex.`)
    }
  }
  for (const id of item.objectiveIds) {
    if (!dolphinObjectiveById.has(id)) errors.push(`${where} names an unknown objective ${id}.`)
  }
  if (item.sourceIds.length === 0) errors.push(`${where} cites no source.`)
  return errors
}

function actErrors(where: string, act: DolphinAct): string[] {
  const errors: string[] = []
  switch (act.kind) {
    case 'sort': {
      if (act.sort.rows.length < 4) errors.push(`${where} sorts fewer than four rows.`)
      const origins = new Set(act.sort.origins.map((o) => o.id))
      for (const row of act.sort.rows) {
        if (!origins.has(row.origin)) errors.push(`${where} row ${row.id} names an unknown bin.`)
      }
      for (const origin of origins) {
        if (!act.sort.rows.some((row) => row.origin === origin))
          errors.push(`${where} bin ${origin} holds no row.`)
      }
      break
    }
    case 'sequence':
      if (act.sequence.steps.length < 4) errors.push(`${where} orders fewer than four steps.`)
      break
    case 'scenario':
      if (act.scenario.frames.length < 2) errors.push(`${where} has fewer than two frames.`)
      for (const frame of act.scenario.frames) {
        if (frame.choices.filter((c) => c.plausibility === 'best').length !== 1) {
          errors.push(`${where} frame ${frame.id} must key exactly one choice.`)
        }
      }
      break
    case 'anatomy-pick':
      for (const prompt of act.prompts) {
        if (!ANATOMY_IDS.has(prompt.answerId))
          errors.push(`${where} ${prompt.id} names no structure of the 3D model.`)
      }
      break
    case 'scope-lab':
      if (!act.goals.some((goal) => goal.kind !== 'avoid')) {
        errors.push(`${where} has only avoid goals; a lab needs a place to reach.`)
      }
      break
    default:
      break
  }
  return errors
}

export function validateDolphinSection(section: DolphinSectionDefinition): readonly string[] {
  const errors: string[] = []
  const where = section.id
  for (const surface of sectionSurfaces(section)) {
    errors.push(
      ...dolphinLearnerCopyErrors(`${where}: ${surface.where}`, surface.text, {
        allowDigits: !/heading$|title$/.test(surface.where),
      }),
    )
  }
  errors.push(...authoringRuleErrors(section).map((error) => `${where}: ${error}`))
  for (const surface of precommitSurfaces(section)) {
    for (const pattern of section.precommitDenyPatterns) {
      if (pattern.test(surface.text)) {
        errors.push(`${where}: the ${surface.where} carries the keyed answer (${pattern}).`)
      }
    }
  }
  errors.push(
    ...itemErrors(`${where} prediction`, section.prediction, section),
    ...itemErrors(`${where} transfer`, section.transfer, section),
    ...section.practice.flatMap((c) => itemErrors(`${where} practice ${c.id}`, c.item, section)),
    ...actErrors(`${where} act`, section.act),
  )
  const index = dolphinSectionIds.indexOf(section.id)
  for (const earlier of section.transfer.retrievesFrom ?? []) {
    if (dolphinSectionIds.indexOf(earlier) >= index) {
      errors.push(`${where} transfer retrieves from ${earlier}, which is not earlier.`)
    }
  }
  const allSources = [
    ...section.sourceIds,
    ...section.blocks.flatMap((b) => b.sourceIds),
    ...section.prediction.sourceIds,
    ...section.transfer.sourceIds,
  ]
  for (const id of allSources) {
    if (!DOLPHIN_SOURCE_IDS.has(id)) errors.push(`${where} cites an unknown source ${id}.`)
  }
  const allNumbers = [
    ...section.blocks.flatMap((b) => b.numberIds ?? []),
    ...(section.prediction.numberIds ?? []),
    ...(section.transfer.numberIds ?? []),
    ...section.practice.flatMap((c) => c.item.numberIds ?? []),
  ]
  for (const id of allNumbers) {
    if (!DOLPHIN_NUMBER_IDS.has(id)) errors.push(`${where} names an unknown number ${id}.`)
  }
  const needsPractice =
    index >= dolphinSectionIds.indexOf('choosing-the-instrument') &&
    index <= dolphinSectionIds.indexOf('recovery-and-return')
  if (needsPractice && (section.practice.length < 3 || section.practice.length > 5)) {
    errors.push(`${where} needs three to five practice cases; it has ${section.practice.length}.`)
  }
  for (const microCase of section.practice) {
    if (microCase.sectionId !== section.id)
      errors.push(`${where} practice ${microCase.id} names another section.`)
  }
  return errors
}

const LESSONS = new Map<DolphinSectionId, DolphinStageLesson>()
for (const section of DOLPHIN_SECTIONS) LESSONS.set(section.id, buildLesson(section))

export function dolphinStageLesson(sectionId: DolphinSectionId): DolphinStageLesson | null {
  return LESSONS.get(sectionId) ?? null
}

export function validateDolphinStageLessons(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const section of DOLPHIN_SECTIONS) {
    if (dolphinSectionDefinition(section.id) !== section)
      errors.push(`${section.id} is registered twice.`)
    errors.push(...validateDolphinSection(section))
    const lesson = LESSONS.get(section.id)!
    for (const step of lesson.steps) {
      errors.push(...stageStepLocationErrors(`${section.id} step ${step.id}`, step.lookIn))
      errors.push(
        ...dolphinLearnerCopyErrors(`${section.id} step title`, step.title, { allowDigits: false }),
      )
    }
    for (const item of [
      section.prediction,
      section.transfer,
      ...section.practice.map((c) => c.item),
    ]) {
      const key = `${section.id}:${item.id}`
      if (ids.has(item.id)) errors.push(`Item id ${item.id} is used twice (${key}).`)
      ids.add(item.id)
    }
  }
  const order = DOLPHIN_SECTIONS.map((section) => dolphinSectionIds.indexOf(section.id))
  if (order.some((value, i) => i > 0 && value <= order[i - 1])) {
    errors.push('The authored sections are not in canonical order.')
  }
  return errors
}

const lessonErrors = validateDolphinStageLessons()
if (lessonErrors.length > 0) {
  throw new Error(`The dolphin bronchoscopy sections are invalid:\n${lessonErrors.join('\n')}`)
}
