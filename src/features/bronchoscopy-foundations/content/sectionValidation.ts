import { stageStepLocationErrors } from '@/features/learning-module/stage/stageModel'
import type { StageStepLocation } from '@/features/learning-module/stage/stageModel'

import {
  SCOPE_CONTROL_IDS,
  SCOPE_MODES,
  isAirwayLabel,
  type ScopeGoal,
  type ScopeGoalTest,
  type ScopeViewSpec,
} from '../components/scope/types'
import { MANIFEST_CASES } from '../data/generated/cases.generated'
import { MANIFEST_DRILLS } from '../data/generated/drills.generated'
import { MANIFEST_MODULES } from '../data/generated/modules.generated'
import { MANIFEST_OBJECTIVES } from '../data/generated/objectives.generated'
import { MANIFEST_QUESTION_SEEDS } from '../data/generated/questionSeeds.generated'
import { sourceRefErrors, type ClaimClass, type SourceRef } from '../data/sources'
import { GRAMMAR_ROW_IDS } from './grammar'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from './landmarks'
import {
  bronchLearnerCopyErrors,
  optionAbsoluteErrors,
  type BronchCopyOptions,
} from './learnerCopy'
import { LOCAL_POLICY_BY_ID } from './localPolicies'
import { mediaRefErrors, type MediaRef } from './media'
import { REVIEW_ITEM_IDS } from './reviewRegister'
import { BRONCH_SECTION_IDS, BRONCH_SECTION_STAGE } from './sectionIds'
import { isSpineStopId } from './spine'
import type {
  AuthoredCapstoneCase,
  AuthoredChoice,
  AuthoredItem,
  AuthoredMicroCase,
  BronchAct,
  BronchSectionDefinition,
  BronchTeachingBlock,
  BronchWorkspace,
} from './types'

/**
 * Everything that is wrong with one section definition, in words an author can act on.
 *
 * Run at import by the section index (a problem is a build failure, not a learner surprise), by
 * `scripts/bronchoscopy-foundations/check-section.mts <id>` while a section is being written, and by
 * the section-definition test. Set-level rules (unique item ids across the module, every core
 * objective homed exactly once, the key-is-longest fraction) live in `validateAllSections`.
 */
const PRECOMMIT_BLOCK_KINDS = new Set(['question', 'signals', 'pattern', 'discriminators'])
const CHOICE_ID = /^[a-d]$/
const MODULE_IDS = new Set(MANIFEST_MODULES.map((module) => module.id))
const OBJECTIVE_BY_ID = new Map(
  MANIFEST_OBJECTIVES.map((objective) => [objective.id, objective] as const),
)
const DRILL_IDS = new Set(MANIFEST_DRILLS.map((drill) => drill.id))
const CASE_IDS = new Set(MANIFEST_CASES.map((entry) => entry.id))
const SEED_IDS = new Set(MANIFEST_QUESTION_SEEDS.map((seed) => seed.id))
const SECTION_INDEX = new Map(BRONCH_SECTION_IDS.map((id, index) => [id, index] as const))
const GRAMMAR = new Set<string>(GRAMMAR_ROW_IDS)

class Collector {
  readonly errors: string[] = []

  add(...messages: readonly (string | readonly string[])[]): void {
    for (const message of messages) {
      if (typeof message === 'string') this.errors.push(message)
      else this.errors.push(...message)
    }
  }

  copy(where: string, value: string | undefined, options: BronchCopyOptions = {}): void {
    if (value === undefined) return
    this.add(bronchLearnerCopyErrors(where, value, options))
  }

  title(where: string, value: string): void {
    this.copy(where, value, { allowDigits: false })
    if (value.length > 90)
      this.add(`${where} is longer than a title should be (${value.length} characters).`)
  }
}

function sourceErrors(where: string, refs: readonly SourceRef[], claimClass: ClaimClass): string[] {
  const errors: string[] = []
  refs.forEach((ref, index) => errors.push(...sourceRefErrors(`${where} source ${index + 1}`, ref)))
  if (refs.length === 0 && claimClass !== 'design') {
    errors.push(
      `${where} is a ${claimClass} claim with no source; only a design claim may stand alone.`,
    )
  }
  const prefixes = new Set(refs.map((ref) => ref.sourceId[0]))
  if (claimClass === 'transcript-source' && !prefixes.has('T')) {
    errors.push(`${where} is a transcript-source claim with no transcript cited.`)
  }
  if (claimClass === 'source' && !prefixes.has('S')) {
    errors.push(`${where} is a source claim with no course textbook or manual cited.`)
  }
  if (claimClass === 'update' && !prefixes.has('U')) {
    errors.push(`${where} is an update claim with no external clarification cited.`)
  }
  return errors
}

function reviewIdErrors(where: string, ids: readonly string[] | undefined): string[] {
  return (ids ?? [])
    .filter((id) => !REVIEW_ITEM_IDS.has(id))
    .map((id) => `${where} names an unknown review item ${id}.`)
}

function denyErrors(
  where: string,
  text: string | undefined,
  patterns: readonly RegExp[],
): string[] {
  if (!text) return []
  return patterns
    .filter((pattern) => pattern.test(text))
    .map(
      (pattern) =>
        `${where} is seen before the prediction and carries the keyed answer (${pattern.source}).`,
    )
}

function mediaErrors(where: string, media: MediaRef | undefined): readonly string[] {
  return media ? mediaRefErrors(where, media) : []
}

function choiceSetErrors(
  c: Collector,
  where: string,
  choices: readonly AuthoredChoice[],
  item?: AuthoredItem,
): void {
  const ids = choices.map((choice) => choice.id)
  if (choices.length < 3 || choices.length > 4)
    c.add(`${where} has ${choices.length} choices; three or four.`)
  if (new Set(ids).size !== ids.length) c.add(`${where} repeats a choice id.`)
  for (const id of ids) if (!CHOICE_ID.test(id)) c.add(`${where} choice id "${id}" is not a to d.`)
  const best = choices.filter((choice) => choice.plausibility === 'best')
  if (best.length !== 1) c.add(`${where} has ${best.length} best choices; exactly one.`)
  const distractors = choices.filter((choice) => choice.plausibility !== 'best')
  const wrongModels = distractors.filter(
    (choice) => choice.plausibility !== 'reasonable-but-incomplete',
  )
  if (wrongModels.length < 2) c.add(`${where} offers fewer than two wrong mental models.`)
  if (best[0] && distractors.length > 0) {
    const longest = Math.max(...distractors.map((choice) => choice.label.length))
    if (best[0].label.length > 1.25 * longest) {
      c.add(
        `${where}: the keyed choice (${best[0].label.length} characters) is more than a quarter longer than the longest distractor (${longest}); length cues the key.`,
      )
    }
  }
  for (const choice of choices) {
    const at = `${where} choice ${choice.id}`
    c.copy(`${at} label`, choice.label)
    c.add(optionAbsoluteErrors(`${at} label`, choice.label))
    c.copy(`${at} rationale`, choice.rationale, {
      surface: 'rationale',
      registerExemptions: item?.registerExemptions,
      copyExemptions: item?.copyExemptions,
    })
    if (choice.rationale.trim().length < 40)
      c.add(`${at} rationale is too short to explain anything.`)
  }
}

function itemErrors(
  c: Collector,
  where: string,
  item: AuthoredItem,
  section: BronchSectionDefinition,
  precommit: boolean,
): void {
  const options: BronchCopyOptions = { copyExemptions: item.copyExemptions }
  if (item.seedId && !SEED_IDS.has(item.seedId))
    c.add(`${where} adapts an unknown seed ${item.seedId}.`)
  if (item.seedId === 'Q12' || item.seedId === 'Q32') {
    c.add(
      `${where} adapts ${item.seedId}, which is not a learner item in this course (Q12 is the completion sentence; Q32 is a test fixture).`,
    )
  }
  c.copy(`${where} stem`, item.stem, options)
  c.copy(`${where} situation`, item.situation, options)
  c.copy(`${where} explanation`, item.explanation, {
    surface: 'rationale',
    registerExemptions: item.registerExemptions,
    copyExemptions: item.copyExemptions,
  })
  c.add(mediaErrors(`${where} media`, item.media))
  choiceSetErrors(c, where, item.choices, item)
  if (item.objectiveIds.length === 0) c.add(`${where} addresses no objective.`)
  for (const id of item.objectiveIds)
    if (!OBJECTIVE_BY_ID.has(id)) c.add(`${where} names an unknown objective ${id}.`)
  c.add(sourceErrors(where, item.sourceRefs, item.claimClass))
  for (const id of item.localPolicyIds ?? []) {
    if (!LOCAL_POLICY_BY_ID.has(id)) c.add(`${where} names an unknown local policy ${id}.`)
  }
  c.add(reviewIdErrors(where, item.reviewItemIds))
  if (item.choiceAirways) {
    const keys = Object.keys(item.choiceAirways).sort()
    const ids = item.choices.map((choice) => choice.id).sort()
    if (keys.join() !== ids.join())
      c.add(`${where} maps airways for choices ${keys.join()} but has ${ids.join()}.`)
    for (const label of Object.values(item.choiceAirways)) {
      if (label !== null && !isAirwayLabel(label))
        c.add(`${where} maps a choice to an unknown airway ${label}.`)
    }
  }
  if (precommit) {
    c.add(denyErrors(`${where} stem`, item.stem, section.precommitDenyPatterns))
    c.add(denyErrors(`${where} situation`, item.situation, section.precommitDenyPatterns))
  }
}

function blockErrors(
  c: Collector,
  block: BronchTeachingBlock,
  section: BronchSectionDefinition,
): void {
  const where = `${section.id} block "${block.id}"`
  c.title(`${where} heading`, block.heading)
  const surface = block.role === 'common-errors' ? 'rationale' : 'instruction'
  const options: BronchCopyOptions = {
    surface,
    registerExemptions: block.registerExemptions,
    copyExemptions: block.copyExemptions,
  }
  c.copy(`${where} body`, block.body, options)
  c.copy(`${where} points label`, block.pointsLabel, options)
  block.points?.forEach((point, index) => c.copy(`${where} point ${index + 1}`, point, options))
  if (block.points && block.points.length > 6)
    c.add(`${where} lists ${block.points.length} points; at most six.`)
  if (block.points?.length && !block.pointsLabel)
    c.add(`${where} lists points with no label for the list.`)
  if (block.registerExemptions?.length && block.role !== 'common-errors') {
    c.add(`${where} exempts a register phrase outside a common-errors block.`)
  }
  c.add(mediaErrors(`${where} media`, block.media))
  c.add(sourceErrors(where, block.sourceRefs, block.claimClass))
  c.add(reviewIdErrors(where, block.reviewItemIds))
  for (const id of block.localPolicyIds ?? []) {
    if (!LOCAL_POLICY_BY_ID.has(id)) c.add(`${where} names an unknown local policy ${id}.`)
  }
  if (block.claimClass === 'local-policy' && !block.localPolicyIds?.length) {
    c.add(`${where} is a local-policy claim that names no policy.`)
  }
  if (block.kind === 'boundary' && block.role !== 'boundary')
    c.add(`${where} is a boundary block with role ${block.role}.`)
  if (PRECOMMIT_BLOCK_KINDS.has(block.kind)) {
    for (const text of [block.heading, block.body, block.pointsLabel, ...(block.points ?? [])]) {
      c.add(denyErrors(where, text, section.precommitDenyPatterns))
    }
  }
}

function landmarkErrors(
  where: string,
  location: StageStepLocation,
  section: BronchSectionDefinition,
): string[] {
  const errors = [...stageStepLocationErrors(where, location)]
  const allowed = (pane: StageStepLocation['pane']): readonly string[] => {
    if (pane === 'steps') return Object.values(STEPS_LANDMARKS)
    if (pane === 'simulator') return Object.values(SIMULATOR_LANDMARKS)
    return [...Object.values(TEACHING_LANDMARKS), ...section.blocks.map((block) => block.heading)]
  }
  if (!allowed(location.pane).includes(location.landmark)) {
    errors.push(
      `${where} names "${location.landmark}", which is not a surface of the ${location.pane} pane.`,
    )
  }
  if (
    location.alsoPane &&
    location.alsoLandmark &&
    !allowed(location.alsoPane).includes(location.alsoLandmark)
  ) {
    errors.push(
      `${where} names "${location.alsoLandmark}", which is not a surface of the ${location.alsoPane} pane.`,
    )
  }
  return errors
}

function goalTestErrors(where: string, test: ScopeGoalTest): string[] {
  switch (test.type) {
    case 'location':
    case 'ledger':
      return isAirwayLabel(test.airway) ? [] : [`${where} names an unknown airway ${test.airway}.`]
    case 'ledger-complete':
      return test.airways
        .filter((label) => !isAirwayLabel(label))
        .map((label) => `${where} names an unknown airway ${label}.`)
    case 'all':
      return test.tests.flatMap((inner) => goalTestErrors(where, inner))
    default:
      return []
  }
}

function onlyWithout(test: ScopeGoalTest): boolean {
  if (test.type === 'without') return true
  if (test.type === 'all') return test.tests.every(onlyWithout)
  return false
}

function goalErrors(c: Collector, where: string, goals: readonly ScopeGoal[]): void {
  if (goals.length === 0) c.add(`${where} has no goal.`)
  for (const goal of goals) {
    c.copy(`${where} goal "${goal.id}"`, goal.label)
    c.add(goalTestErrors(`${where} goal "${goal.id}"`, goal.test))
    if (onlyWithout(goal.test))
      c.add(
        `${where} goal "${goal.id}" is met by doing nothing; pair a without-test with an action.`,
      )
  }
}

function viewErrors(
  c: Collector,
  where: string,
  view: ScopeViewSpec,
  section: BronchSectionDefinition,
): void {
  if (view.sectionId !== section.id) c.add(`${where} belongs to section ${view.sectionId}.`)
  if (!SCOPE_MODES.includes(view.mode)) c.add(`${where} uses an unknown mode ${view.mode}.`)
  c.copy(`${where} boundary`, view.boundary)
  for (const label of [...(view.litAirways ?? []), ...(view.inaccessible ?? [])]) {
    if (!isAirwayLabel(label)) c.add(`${where} names an unknown airway ${label}.`)
  }
  if (view.start.kind === 'airway' && !isAirwayLabel(view.start.label))
    c.add(`${where} starts in an unknown airway.`)
}

function workspaceErrors(
  c: Collector,
  workspace: BronchWorkspace,
  section: BronchSectionDefinition,
): void {
  const where = `${section.id} workspace`
  switch (workspace.kind) {
    case 'scope':
      viewErrors(c, where, workspace.view, section)
      return
    case 'media':
      c.copy(`${where} caption`, workspace.caption)
      c.add(denyErrors(`${where} caption`, workspace.caption, section.precommitDenyPatterns))
      if (workspace.media.length === 0) c.add(`${where} shows no media.`)
      workspace.media.forEach((media, index) =>
        c.add(mediaRefErrors(`${where} media ${index + 1}`, media)),
      )
      return
    case 'map':
      c.copy(`${where} caption`, workspace.caption)
      c.add(denyErrors(`${where} caption`, workspace.caption, section.precommitDenyPatterns))
      for (const label of workspace.lit)
        if (!isAirwayLabel(label)) c.add(`${where} lights an unknown airway ${label}.`)
      return
    case 'monitor':
      c.copy(`${where} caption`, workspace.caption)
      c.add(denyErrors(`${where} caption`, workspace.caption, section.precommitDenyPatterns))
      workspace.readings.forEach((reading) => c.copy(`${where} ${reading.channel}`, reading.words))
      return
  }
}

function actErrors(c: Collector, act: BronchAct, section: BronchSectionDefinition): void {
  const where = `${section.id} act`
  switch (act.kind) {
    case 'scope-lab':
      viewErrors(c, `${where} view`, act.view, section)
      goalErrors(c, where, act.goals)
      if (act.observe) {
        if (act.observe.view) viewErrors(c, `${where} observe view`, act.observe.view, section)
        goalErrors(c, `${where} observe`, act.observe.goals)
      }
      if (Boolean(act.observe) !== Boolean(section.steps.observe)) {
        c.add(
          `${where}: an Observe step needs both an observe block on the act and observe step text.`,
        )
      }
      return
    case 'sort': {
      const { sort } = act
      c.copy(`${where} prompt`, sort.prompt)
      if (sort.origins.length < 2) c.add(`${where} has fewer than two origins.`)
      if (sort.rows.length < 4) c.add(`${where} has fewer than four rows.`)
      const origins = new Set(sort.origins.map((origin) => origin.id))
      for (const origin of sort.origins) {
        c.copy(`${where} origin ${origin.id}`, origin.label)
        c.copy(`${where} origin ${origin.id} definition`, origin.definition)
        if (!sort.rows.some((row) => row.origin === origin.id))
          c.add(`${where} origin ${origin.id} answers no row; a decoy origin is a trick.`)
      }
      for (const row of sort.rows) {
        c.copy(`${where} row ${row.id}`, row.statement)
        c.copy(`${where} row ${row.id} rationale`, row.rationale, { surface: 'rationale' })
        if (!origins.has(row.origin))
          c.add(`${where} row ${row.id} names an unknown origin ${row.origin}.`)
      }
      c.add(sourceErrors(where, sort.sourceRefs, 'synthesis'))
      return
    }
    case 'identify': {
      const { identify } = act
      c.copy(`${where} prompt`, identify.prompt)
      if (identify.rows.length < 3) c.add(`${where} has fewer than three views.`)
      for (const row of identify.rows) {
        const at = `${where} view ${row.id}`
        c.add(mediaRefErrors(at, row.media))
        c.copy(`${at} prompt`, row.prompt)
        c.copy(`${at} rationale`, row.rationale, { surface: 'rationale' })
        if (row.choices.length < 3 || row.choices.length > 5)
          c.add(`${at} has ${row.choices.length} choices; three to five.`)
        if (!row.choices.some((choice) => choice.id === row.answerId))
          c.add(`${at} keys an answer that is not a choice.`)
        row.choices.forEach((choice) => c.copy(`${at} choice ${choice.id}`, choice.label))
      }
      c.add(sourceErrors(where, identify.sourceRefs, 'synthesis'))
      return
    }
    case 'sequence': {
      const { sequence } = act
      c.copy(`${where} prompt`, sequence.prompt)
      c.copy(`${where} rationale`, sequence.rationale)
      if (sequence.steps.length < 4) c.add(`${where} has fewer than four steps.`)
      const ids = new Set(sequence.steps.map((step) => step.id))
      if (ids.size !== sequence.steps.length) c.add(`${where} repeats a step id.`)
      for (const step of sequence.steps) {
        c.copy(`${where} step ${step.id}`, step.label)
        c.copy(`${where} step ${step.id} detail`, step.detail)
      }
      for (const id of sequence.criticalStepIds ?? [])
        if (!ids.has(id)) c.add(`${where} marks an unknown step ${id} as critical.`)
      c.add(sourceErrors(where, sequence.sourceRefs, 'synthesis'))
      return
    }
    case 'ledger': {
      const { ledger } = act
      c.copy(`${where} prompt`, ledger.prompt)
      c.copy(`${where} boundary`, ledger.boundary)
      c.copy(`${where} total prompt`, ledger.totalPrompt)
      if (ledger.rows.length < 2) c.add(`${where} has fewer than two rows.`)
      for (const row of ledger.rows) {
        c.copy(`${where} row ${row.id}`, row.label)
        c.copy(`${where} row ${row.id} detail`, row.detail)
        if (row.kind === 'measured') {
          for (const value of [row.concentrationMgPerMl, row.volumeMl]) {
            if (!Number.isFinite(value) || value <= 0)
              c.add(`${where} row ${row.id} has a non-positive amount.`)
          }
        } else {
          c.copy(`${where} row ${row.id} reason`, row.reason)
        }
      }
      if (ledger.rows.some((row) => row.kind === 'unknown') !== ledger.totalIsUnknown) {
        c.add(`${where}: totalIsUnknown must be true exactly when a row is unknown.`)
      }
      choiceSetErrors(c, `${where} total`, ledger.totalChoices)
      for (const id of ledger.localPolicyIds)
        if (!LOCAL_POLICY_BY_ID.has(id)) c.add(`${where} names an unknown local policy ${id}.`)
      c.add(sourceErrors(where, ledger.sourceRefs, 'synthesis'))
      return
    }
    case 'report': {
      const { report } = act
      c.copy(`${where} prompt`, report.prompt)
      c.copy(`${where} evidence title`, report.evidenceTitle)
      report.media?.forEach((media, index) =>
        c.add(mediaRefErrors(`${where} media ${index + 1}`, media)),
      )
      if (report.fields.length < 3) c.add(`${where} has fewer than three fields.`)
      for (const field of report.fields) {
        const at = `${where} field ${field.id}`
        c.copy(`${at} label`, field.label)
        c.copy(`${at} evidence`, field.evidence)
        if (!field.options.some((option) => option.supported))
          c.add(`${at} has no supported option.`)
        if (!field.options.some((option) => !option.supported))
          c.add(`${at} has no unsupported option to refuse.`)
        for (const option of field.options) {
          c.copy(`${at} option ${option.id}`, option.label)
          c.copy(`${at} option ${option.id} rationale`, option.rationale, { surface: 'rationale' })
        }
      }
      c.add(sourceErrors(where, report.sourceRefs, 'synthesis'))
      return
    }
    case 'scenario': {
      const { scenario } = act
      c.title(`${where} title`, scenario.title)
      c.copy(`${where} boundary`, scenario.boundary)
      if (scenario.frames.length < 2) c.add(`${where} has fewer than two frames.`)
      for (const frame of scenario.frames) {
        const at = `${where} frame ${frame.id}`
        c.copy(`${at} situation`, frame.situation)
        c.copy(`${at} prompt`, frame.prompt)
        frame.readings.forEach((reading) => c.copy(`${at} ${reading.channel}`, reading.words))
        c.add(mediaErrors(`${at} media`, frame.media))
        if (frame.readings.length === 0 && !frame.media)
          c.add(`${at} shows nothing in the Simulator panel.`)
        choiceSetErrors(c, at, frame.choices, {
          registerExemptions: frame.registerExemptions,
        } as AuthoredItem)
      }
      c.add(sourceErrors(where, scenario.sourceRefs, 'synthesis'))
      return
    }
  }
}

function microCaseErrors(
  c: Collector,
  entry: AuthoredMicroCase,
  section: BronchSectionDefinition,
): void {
  const where = `${section.id} practice ${entry.id}`
  if (!/^(C\d{2}|mc-[a-z0-9-]+)$/.test(entry.id))
    c.add(`${where} id is neither a manifest case nor mc-<slug>.`)
  if (entry.manifestCaseId && !CASE_IDS.has(entry.manifestCaseId))
    c.add(`${where} adapts an unknown case ${entry.manifestCaseId}.`)
  c.title(`${where} title`, entry.presentationTitle)
  c.copy(`${where} situation`, entry.situation)
  if (entry.item.situation)
    c.add(`${where} item carries its own situation; the case's situation is shown instead.`)
  itemErrors(c, `${where} item`, entry.item, section, false)
}

export function bronchSectionErrors(section: BronchSectionDefinition): readonly string[] {
  const c = new Collector()
  const id = section.id
  if (!SECTION_INDEX.has(id)) return [`Unknown section id ${id}.`]

  c.title(`${id} title`, section.title)
  c.title(`${id} short title`, section.shortTitle)
  c.title(`${id} recognize title`, section.recognizeTitle)
  if (section.minutes < 4 || section.minutes > 12)
    c.add(`${id} claims ${section.minutes} minutes; four to twelve.`)

  for (const moduleId of section.moduleIds)
    if (!MODULE_IDS.has(moduleId)) c.add(`${id} names an unknown module ${moduleId}.`)
  if (section.objectives.length === 0) c.add(`${id} homes no objective.`)
  for (const entry of section.objectives) {
    const objective = OBJECTIVE_BY_ID.get(entry.objectiveId)
    if (!objective) c.add(`${id} names an unknown objective ${entry.objectiveId}.`)
    else if (!section.moduleIds.includes(objective.moduleId))
      c.add(`${id} homes ${entry.objectiveId}, which belongs to ${objective.moduleId}.`)
    c.copy(`${id} objective ${entry.objectiveId} subtask`, entry.subtask)
  }
  const needsHands = section.objectives.some(
    (entry) => entry.evidence === 'observed-physical-skill-required',
  )
  if (needsHands && !section.physicalSkillNote)
    c.add(
      `${id} has an objective that needs observed physical skill and no note saying what the app cannot see.`,
    )
  c.copy(`${id} physical skill note`, section.physicalSkillNote)
  for (const drillId of section.drillIds)
    if (!DRILL_IDS.has(drillId)) c.add(`${id} names an unknown drill ${drillId}.`)
  const index = SECTION_INDEX.get(id) ?? 0
  for (const prerequisite of section.prerequisites) {
    if ((SECTION_INDEX.get(prerequisite) ?? Infinity) >= index)
      c.add(`${id} lists ${prerequisite}, which does not come before it, as a prerequisite.`)
  }

  const precommit: readonly [string, string][] = [
    ['clinical question', section.clinicalQuestion],
    ['objective', section.objective],
    ['why', section.why],
    ['recognize instruction', section.steps.recognize.instruction],
    ['title', section.title],
    ['short title', section.shortTitle],
    ['recognize title', section.recognizeTitle],
  ]
  for (const [label, text] of precommit) {
    c.copy(`${id} ${label}`, text, { allowDigits: !label.includes('title') })
    c.add(denyErrors(`${id} ${label}`, text, section.precommitDenyPatterns))
  }
  for (const [label, text] of [
    ['new concept', section.newConcept],
    ['increment sentence', section.incrementSentence],
    ['harmful reflex', section.harmfulReflex],
    ['model boundary', section.modelBoundary],
    ['anchor analogy', section.anchor.analogy],
    ['anchor statement', section.anchor.precise],
    ['anchor checklist label', section.anchor.checklistLabel],
  ] as const) {
    c.copy(`${id} ${label}`, text)
  }
  if (section.anchor.checklist.length < 1 || section.anchor.checklist.length > 4)
    c.add(`${id} anchor checklist has ${section.anchor.checklist.length} items; one to four.`)
  section.anchor.checklist.forEach((item, i) => c.copy(`${id} anchor checklist ${i + 1}`, item))
  if (!/^This section adds one idea/.test(section.incrementSentence))
    c.add(
      `${id} increment sentence does not count its idea out loud ("This section adds one idea …").`,
    )

  for (const stop of section.spineStops)
    if (!isSpineStopId(stop)) c.add(`${id} names an unknown airway stop ${stop}.`)
  for (const row of section.grammarRowIds)
    if (!GRAMMAR.has(row)) c.add(`${id} highlights an unknown grammar row ${row}.`)
  const strip = section.controlStrip
  const states = SCOPE_CONTROL_IDS.map((control) => strip.states[control])
  if (states.some((state) => state === undefined))
    c.add(`${id} control strip leaves a control out.`)
  const thisOne = states.filter((state) => state === 'this-one').length
  if (strip.verdict === 'this-control' && thisOne === 0)
    c.add(`${id} control strip says a control is the answer and marks none.`)
  if (strip.verdict !== 'this-control' && thisOne > 0)
    c.add(`${id} control strip says no control fixes it and marks one.`)
  c.copy(`${id} control strip sentence`, strip.sentence)

  if (section.precommitDenyPatterns.length === 0)
    c.add(`${id} lists no phrase that would give its answer away.`)
  const keyed = section.prediction.choices.find((choice) => choice.plausibility === 'best')
  const postcommit = [keyed?.label ?? '', section.prediction.explanation, section.newConcept].join(
    ' ',
  )
  for (const pattern of section.precommitDenyPatterns) {
    if (pattern.flags.includes('g'))
      c.add(
        `${id} deny pattern ${pattern.source} is global; global patterns keep state between tests.`,
      )
    if (!pattern.test(postcommit))
      c.add(
        `${id} deny pattern ${pattern.source} matches neither the keyed answer, its explanation nor the new concept, so it guards nothing.`,
      )
  }

  for (const policyId of section.localPolicyIds)
    if (!LOCAL_POLICY_BY_ID.has(policyId)) c.add(`${id} names an unknown local policy ${policyId}.`)
  c.add(reviewIdErrors(id, section.reviewItemIds))

  const blocks = section.blocks
  if (blocks.length < 3) c.add(`${id} has fewer than three teaching blocks.`)
  if (blocks[0]?.kind !== 'question') c.add(`${id} does not open with a question block.`)
  if (!blocks.some((block) => block.role === 'normal-reference' || block.role === 'worked-example'))
    c.add(`${id} has no normal reference or worked example.`)
  if (!blocks.some((block) => block.role === 'common-errors'))
    c.add(`${id} has no block on common errors and their correction.`)
  if (!blocks.some((block) => block.kind === 'after-commitment'))
    c.add(`${id} has no block that waits for the commitment.`)
  const blockIds = blocks.map((block) => block.id)
  if (new Set(blockIds).size !== blockIds.length) c.add(`${id} repeats a block id.`)
  const headings = blocks.map((block) => block.heading)
  if (new Set(headings).size !== headings.length) c.add(`${id} repeats a block heading.`)
  for (const block of blocks) blockErrors(c, block, section)

  workspaceErrors(c, section.workspace, section)
  actErrors(c, section.act, section)

  const steps = section.steps
  c.add(landmarkErrors(`${id} Recognize`, steps.recognize.lookIn, section))
  c.title(`${id} Act title`, steps.act.title)
  c.copy(`${id} Act instruction`, steps.act.instruction)
  c.add(landmarkErrors(`${id} Act`, steps.act.lookIn, section))
  if (steps.observe) {
    c.title(`${id} Observe title`, steps.observe.title)
    c.copy(`${id} Observe instruction`, steps.observe.instruction)
    c.add(landmarkErrors(`${id} Observe`, steps.observe.lookIn, section))
  }
  c.title(`${id} Explain title`, steps.explain.title)
  c.copy(`${id} Explain instruction`, steps.explain.instruction)

  itemErrors(c, `${id} prediction`, section.prediction, section, true)
  itemErrors(c, `${id} transfer`, section.transfer, section, false)
  c.copy(`${id} transfer variant`, section.transfer.transferVariant)
  if (
    section.transfer.retrievesFrom &&
    (SECTION_INDEX.get(section.transfer.retrievesFrom) ?? Infinity) >= index
  ) {
    c.add(
      `${id} transfer retrieves from ${section.transfer.retrievesFrom}, which does not come before it.`,
    )
  }
  if (section.prediction.stem.trim() === section.transfer.stem.trim())
    c.add(`${id} transfer repeats the prediction's stem.`)

  const stage = BRONCH_SECTION_STAGE[id]
  if ((stage === 'mechanism' || stage === 'application') && section.practice.length === 0) {
    c.add(`${id} is a ${stage} section with no practice case paired to it.`)
  }
  for (const entry of section.practice) microCaseErrors(c, entry, section)

  return c.errors
}

/** Items a section owns, for set-level checks. */
export function sectionItems(section: BronchSectionDefinition): readonly AuthoredItem[] {
  return [section.prediction, section.transfer, ...section.practice.map((entry) => entry.item)]
}

/** Rules that hold across the whole set of sections. */
export function validateAllSections(
  sections: readonly BronchSectionDefinition[],
): readonly string[] {
  const errors: string[] = []
  const seen = new Map<string, string>()
  for (const section of sections) {
    errors.push(...bronchSectionErrors(section))
    for (const item of sectionItems(section)) {
      const owner = seen.get(item.id)
      if (owner) errors.push(`Item ${item.id} appears in both ${owner} and ${section.id}.`)
      seen.set(item.id, section.id)
    }
  }
  const homed = new Map<string, string>()
  for (const section of sections) {
    for (const entry of section.objectives) {
      const owner = homed.get(entry.objectiveId)
      if (owner)
        errors.push(`Objective ${entry.objectiveId} is homed in both ${owner} and ${section.id}.`)
      homed.set(entry.objectiveId, section.id)
    }
  }
  if (sections.length === BRONCH_SECTION_IDS.length) {
    for (const objective of MANIFEST_OBJECTIVES) {
      if (objective.track === 'core' && !homed.has(objective.id))
        errors.push(`Core objective ${objective.id} has no section.`)
    }
  }
  const items = sections.flatMap(sectionItems)
  const keyLongest = items.filter((item) => {
    const best = item.choices.find((choice) => choice.plausibility === 'best')
    return (
      best &&
      item.choices.every((choice) => choice === best || choice.label.length < best.label.length)
    )
  }).length
  if (items.length >= 10 && keyLongest / items.length >= 0.5) {
    errors.push(
      `The keyed choice is the longest in ${keyLongest} of ${items.length} items; choosing the longest option must not beat chance.`,
    )
  }
  return errors
}

// ── The capstone ─────────────────────────────────────────────────────────────────────────────────

export const CAPSTONE_CASE_IDS = ['C01', 'C04', 'C05', 'C06', 'C07', 'C09', 'C10', 'C16'] as const
export const CAPSTONE_CRITICAL_IDS: ReadonlySet<string> = new Set([
  'C01',
  'C04',
  'C05',
  'C06',
  'C10',
])

/** A stand-in section for item checks that have no section of their own. */
function capstoneHost(pairedSectionId: BronchSectionDefinition['id']): BronchSectionDefinition {
  return { id: pairedSectionId, precommitDenyPatterns: [] } as unknown as BronchSectionDefinition
}

export function capstoneErrors(cases: readonly AuthoredCapstoneCase[]): readonly string[] {
  const c = new Collector()
  const ids = cases.map((entry) => entry.id)
  if (ids.join() !== CAPSTONE_CASE_IDS.join()) {
    c.add(
      `The capstone must hold ${CAPSTONE_CASE_IDS.join(', ')} in that order; it holds ${ids.join(', ')}.`,
    )
  }
  for (const entry of cases) {
    const where = `capstone ${entry.id}`
    if (!CASE_IDS.has(entry.id)) c.add(`${where} is not a manifest case.`)
    if (entry.item.id !== entry.id)
      c.add(`${where} item id ${entry.item.id} must equal the case id.`)
    if (entry.critical !== CAPSTONE_CRITICAL_IDS.has(entry.id))
      c.add(`${where} has the wrong critical flag.`)
    if (!SECTION_INDEX.has(entry.pairedSectionId)) c.add(`${where} pairs to an unknown section.`)
    c.title(`${where} title`, entry.presentationTitle)
    c.copy(`${where} situation`, entry.situation)
    if (entry.item.situation)
      c.add(`${where} item carries its own situation; the case's situation is shown instead.`)
    itemErrors(c, `${where} item`, entry.item, capstoneHost(entry.pairedSectionId), false)
  }
  const c16 = cases.find((entry) => entry.id === 'C16')
  if (c16) {
    const text = [
      c16.situation,
      c16.item.stem,
      c16.item.explanation,
      ...c16.item.choices.flatMap((choice) => [choice.label, choice.rationale]),
    ].join(' ')
    if (
      /\b\d+\s*(cfu|colony|colonies)\b|10\s*\^|susceptib\w*\s+(to|values?)\s+\w+cillin|mg\/kg/i.test(
        text,
      )
    ) {
      c.add(
        'capstone C16 carries a colony count, a susceptibility value or a dose; its answer is that the data are missing.',
      )
    }
  }
  return c.errors
}
