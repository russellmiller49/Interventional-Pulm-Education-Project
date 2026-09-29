import { claims as registeredClaims, type Claim } from './claimRegister'
import { CONTROL_IDS, MODEL_CONTROLS } from './controlPanel'
import {
  curriculumSection,
  curriculumSections,
  integratedCases,
  practiceScenarios,
} from './curriculum'
import { deviceDefinitions } from './deviceDefinitions'
import { thoracoscopyCopyErrors, type ThoracoscopyCopyOptions } from './learnerCopy'
import { MODEL_BOUNDARY_IDS } from './modelBoundaries'
import { isPleuralZoneId, pleuralZones } from './pleuralZones'
import { THORACOSCOPY_SECTION_IDS, type ThoracoscopySectionId } from './sectionIds'
import { THORACOSCOPY_SPINE } from './spine'
import { TEACHING_EXAMPLES } from './teachingExamples'
import {
  FIDELITY_LABELS,
  type AuthoredQuestion,
  type ClaimId,
  type SectionSignal,
  type ThoracoscopySectionSpec,
} from './types'
import { LANDMARK_IDS } from './landmarks'

/**
 * Everything wrong with one section, in words an author can act on. The section index runs it
 * as it loads, so a problem is a build failure rather than something a learner meets; the spec
 * test runs it again with each rule broken on purpose.
 *
 * Set-level rules (unique question ids, where the best choice sits, which sections are written)
 * are in `validateSectionSet`.
 */
const SECTION_INDEX = new Map(THORACOSCOPY_SECTION_IDS.map((id, index) => [id, index] as const))
const LATER_ENTRIES = new Set<string>([
  ...practiceScenarios.map((scenario) => scenario.id),
  ...integratedCases.map((item) => item.id),
])
const FIDELITY = new Set<string>(FIDELITY_LABELS)
const LANDMARKS = new Set<string>(LANDMARK_IDS)
const EXAMPLES = new Set<string>(TEACHING_EXAMPLES.map((example) => example.id))
const BOUNDARIES = new Set<string>(MODEL_BOUNDARY_IDS)
const CONTROLS = new Set<string>(CONTROL_IDS)
const SECTION_TITLES = new Set<string>(curriculumSections.map((section) => section.title))
/** A forward link in learner copy names a section by its printed title: taught in “Title”. */
const TAUGHT_IN = /taught in “([^”]+)”/gi
const DEVICE_IDS = new Set<string>(deviceDefinitions.devices.map((device) => device.id))
const AUTHORED_LABELS = new Set<string>([
  'Authored construct',
  'Authored, illustrative',
  'Awaiting clinical review',
])

class Problems {
  readonly list: string[] = []

  add(message: string): void {
    this.list.push(message)
  }

  copy(where: string, text: string, options: ThoracoscopyCopyOptions = {}): void {
    this.list.push(...thoracoscopyCopyErrors(where, text, options))
    for (const [, title] of text.matchAll(TAUGHT_IN)) {
      if (!SECTION_TITLES.has(title))
        this.list.push(`${where} links to “${title}”, not a section title`)
    }
  }

  heading(where: string, text: string): void {
    this.copy(where, text, { allowDigits: false })
  }
}

function sentenceCount(text: string): number {
  return text
    .trim()
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .filter(Boolean).length
}

/** Every claim id a section cites, wherever it cites it. */
export function sectionClaimIds(spec: ThoracoscopySectionSpec): ReadonlySet<ClaimId> {
  const example = TEACHING_EXAMPLES.find((entry) => entry.id === spec.teachingExample)
  return new Set<ClaimId>([
    ...spec.anchor.claimIds,
    ...spec.blocks.flatMap((block) => block.claimIds),
    ...spec.workedExample.claimIds,
    ...spec.activity.claimIds,
    ...spec.question.claimIds,
    ...spec.transfer.claimIds,
    ...spec.harmfulReflex.claimIds,
    ...spec.misconceptions.flatMap((entry) => entry.claimIds),
    ...spec.signals.flatMap((signal) => signal.claimIds),
    ...(example?.claimIds ?? []),
  ])
}

function questionProblems(
  problems: Problems,
  spec: ThoracoscopySectionSpec,
  question: AuthoredQuestion,
  where: string,
): void {
  if (!/^MT-Q-\d{2}-[a-z]$/.test(question.id)) problems.add(`${where}: id ${question.id}`)
  const number = String(curriculumSection(spec.id).number).padStart(2, '0')
  if (!question.id.startsWith(`MT-Q-${number}-`))
    problems.add(`${where}: id ${question.id} carries the section number ${number}`)
  if (question.purpose.trim().length === 0) problems.add(`${where}: names its teaching purpose`)
  problems.copy(`${where} stem`, question.stem)
  problems.copy(`${where} explanation`, question.explanation)
  if (question.choices.length < 3 || question.choices.length > 4)
    problems.add(`${where}: three or four choices`)
  const ids = question.choices.map((choice) => choice.id)
  if (ids.join('') !== 'abcd'.slice(0, ids.length)) problems.add(`${where}: choices are a to d`)
  const best = question.choices.filter((choice) => choice.plausibility === 'best')
  if (best.length !== 1) problems.add(`${where}: exactly one best choice`)
  for (const choice of question.choices) {
    problems.copy(`${where} choice ${choice.id}`, choice.label)
    problems.copy(`${where} choice ${choice.id} feedback`, choice.feedback)
    if (choice.feedback.trim() === choice.label.trim())
      problems.add(`${where} choice ${choice.id}: feedback says why, not the label again`)
  }
  if (question.answerPhrases.length === 0) problems.add(`${where}: lists its answer phrases`)
  const answer = [best[0]?.label ?? '', best[0]?.feedback ?? '', question.explanation].join(' ')
  const beforeAnswering: [string, string][] = [
    ['the section title', curriculumSection(spec.id).title],
    ['the objective', spec.objective],
    ['the clinical question', spec.clinicalQuestion],
    ['the activity prompt', spec.activity.prompt],
    ['the stem', question.stem],
  ]
  if (question.kind === 'prediction') {
    // Shown before a prediction as well: the teaching example, the signals' labels and the blocks
    // placed before the question.
    const example = TEACHING_EXAMPLES.find((entry) => entry.id === spec.teachingExample)
    if (example) {
      const text = [example.title, example.loaded, example.notPerformed].join(' ')
      beforeAnswering.push(['the teaching example', text])
    }
    const labels = spec.signals.map((signal) => `${signal.name} ${signal.detail}`).join(' ')
    beforeAnswering.push(['the signal labels', labels])
    for (const block of spec.blocks.filter((entry) => entry.when === 'before-question')) {
      const text = [block.heading, block.body, ...(block.list?.items ?? [])].join(' ')
      beforeAnswering.push([`block ${block.id}, placed before the question`, text])
    }
  }
  for (const phrase of question.answerPhrases) {
    if (!phrase.test(answer))
      problems.add(`${where}: answer phrase ${phrase} does not match the answer`)
    for (const [surface, text] of beforeAnswering) {
      if (phrase.test(text)) problems.add(`${where}: ${surface} gives the answer away (${phrase})`)
    }
  }
  if (question.claimIds.length === 0) problems.add(`${where}: cites a claim`)
}

function signalProblems(problems: Problems, signal: SectionSignal, where: string): void {
  if (!FIDELITY.has(signal.label)) problems.add(`${where}: label ${signal.label}`)
  if (AUTHORED_LABELS.has(signal.label) && signal.provenance !== 'authored')
    problems.add(`${where}: an authored label on a ${signal.provenance} signal`)
  if (signal.label === 'Derived from CT segmentation' && signal.provenance !== 'derived')
    problems.add(`${where}: a CT label on a ${signal.provenance} signal`)
  problems.heading(`${where} name`, signal.name)
  problems.copy(`${where} detail`, signal.detail)
  const devices = signal.deviceIds ?? []
  for (const id of devices) if (!DEVICE_IDS.has(id)) problems.add(`${where}: device ${id}`)
  if (signal.claimIds.length === 0 && devices.length === 0)
    problems.add(`${where}: cites a claim or a device definition`)
}

export function sectionProblems(
  spec: ThoracoscopySectionSpec,
  claims: readonly Claim[] = registeredClaims,
): readonly string[] {
  const problems = new Problems()
  const at = (part: string) => `${spec.id} ${part}`
  const index = SECTION_INDEX.get(spec.id)
  if (index === undefined) return [`${spec.id}: not a section`]

  const state = curriculumSection(spec.id).state
  if (state === 'in-preparation') problems.add(at('is written, so the curriculum says so'))
  if (!Number.isInteger(spec.revision) || spec.revision < 1) problems.add(at('revision'))
  if (!(THORACOSCOPY_SPINE as readonly string[]).includes(spec.spinePhase))
    problems.add(at(`spine phase ${spec.spinePhase}`))

  problems.copy(at('objective'), spec.objective)
  if (sentenceCount(spec.objective) !== 1) problems.add(at('objective is one sentence'))
  problems.copy(at('new concept'), spec.newConcept)
  problems.copy(at('increment'), spec.increment)
  if (!/plus one/i.test(spec.increment)) problems.add(at('increment is stated as a count'))
  problems.copy(at('clinical question'), spec.clinicalQuestion)
  if (!spec.clinicalQuestion.trim().endsWith('?'))
    problems.add(at('clinical question is a question'))

  for (const id of spec.suggestedBackground) {
    const earlier = SECTION_INDEX.get(id)
    if (earlier === undefined || earlier >= index)
      problems.add(at(`suggested background ${id} comes earlier`))
  }
  for (const id of spec.usedAgainBy) {
    const later = SECTION_INDEX.get(id as ThoracoscopySectionId)
    if (later === undefined ? !LATER_ENTRIES.has(id) : later <= index)
      problems.add(at(`used again by ${id}, which comes later`))
  }

  const anchor = spec.anchor
  problems.copy(at('analogy'), anchor.analogy)
  problems.copy(at('precise statement'), anchor.precise)
  problems.heading(at('checklist label'), anchor.checklistLabel)
  anchor.checklist.forEach((item, n) => problems.copy(at(`checklist ${n + 1}`), item))
  if (anchor.checklist.length === 0 || anchor.checklist.length > 4)
    problems.add(at('checklist has four items or fewer'))
  problems.copy(at('application'), anchor.application)
  if (anchor.claimIds.length === 0) problems.add(at('anchor cites a claim'))

  if (spec.teachingExample !== null && !EXAMPLES.has(spec.teachingExample))
    problems.add(at(`teaching example ${spec.teachingExample}`))
  for (const control of [...spec.controls.shown, ...spec.controls.operable])
    if (!CONTROLS.has(control)) problems.add(at(`control ${control}`))
  for (const control of spec.controls.operable) {
    if (!spec.controls.shown.includes(control))
      problems.add(at(`a usable control ${control} is shown`))
    const taughtIn = MODEL_CONTROLS.find((entry) => entry.id === control)?.taughtIn
    const taughtAt = taughtIn ? SECTION_INDEX.get(taughtIn) : undefined
    if (taughtAt === undefined || taughtAt > index)
      problems.add(at(`control ${control} is usable only from the section that teaches it`))
  }

  if (spec.blocks.length === 0) problems.add(at('has teaching blocks'))
  if (spec.question.kind === 'prediction' && !spec.blocks.some((b) => b.when === 'after-question'))
    problems.add(at('a prediction is followed by the teaching that answers it'))
  if (spec.question.kind === 'retrieval' && spec.blocks.some((b) => b.when === 'after-question'))
    problems.add(at('a retrieval question comes after all the teaching'))
  if (spec.transfer.kind !== 'retrieval') problems.add(at('the transfer comes after the teaching'))
  const blockIds = new Set<string>()
  for (const block of spec.blocks) {
    const where = at(`block ${block.id}`)
    if (blockIds.has(block.id)) problems.add(`${where}: id is unique`)
    blockIds.add(block.id)
    problems.heading(`${where} heading`, block.heading)
    problems.copy(`${where} body`, block.body, { exemptions: block.copyExemptions })
    if (block.list) {
      problems.heading(`${where} list label`, block.list.label)
      if (block.list.items.length === 0 || block.list.items.length > 8)
        problems.add(`${where}: eight items or fewer`)
      block.list.items.forEach((item, n) =>
        problems.copy(`${where} item ${n + 1}`, item, { exemptions: block.copyExemptions }),
      )
    }
    if (block.claimIds.length === 0) problems.add(`${where}: cites a claim`)
  }

  const worked = spec.workedExample
  problems.heading(at('worked example heading'), worked.heading)
  problems.copy(at('worked example situation'), worked.situation)
  if (worked.steps.length < 2) problems.add(at('worked example is shown in full'))
  worked.steps.forEach((step, n) => {
    problems.copy(at(`worked step ${n + 1}`), step.action)
    problems.copy(at(`worked step ${n + 1} reason`), step.reason)
  })
  problems.copy(at('worked example outcome'), worked.outcome)
  if (worked.claimIds.length === 0) problems.add(at('worked example cites a claim'))

  const activity = spec.activity
  problems.copy(at('activity prompt'), activity.prompt)
  if (activity.claimIds.length === 0) problems.add(at('activity cites a claim'))
  if (activity.kind === 'tour') {
    const visited = activity.stops.map((stop) => stop.zone)
    if (
      [...visited].sort().join() !==
      pleuralZones
        .map((zone) => zone.id)
        .sort()
        .join()
    )
      problems.add(at('tour visits every zone once'))
    for (const stop of activity.stops) {
      if (!isPleuralZoneId(stop.zone)) problems.add(at(`tour zone ${stop.zone}`))
      for (const landmark of stop.landmarks)
        if (!LANDMARKS.has(landmark)) problems.add(at(`tour landmark ${landmark}`))
      problems.copy(at(`tour ${stop.zone}`), stop.notice)
    }
  } else if (activity.kind === 'pivot') {
    if (activity.targets.length < 2) problems.add(at('pivot has two targets or more'))
    for (const target of activity.targets) {
      if (!isPleuralZoneId(target.zone)) problems.add(at(`pivot zone ${target.zone}`))
      problems.copy(at(`pivot ${target.zone}`), target.handAndTip)
    }
  } else if (activity.order.join() !== pleuralZones.map((zone) => zone.id).join()) {
    problems.add(at('survey keeps the order of the zone list'))
  }

  questionProblems(problems, spec, spec.question, at('question'))
  questionProblems(problems, spec, spec.transfer, at('transfer'))
  problems.copy(at('transfer, what changed'), spec.transfer.whatChanged)
  if (spec.transfer.stem.trim() === spec.question.stem.trim())
    problems.add(at('transfer is a different situation'))

  const reflex = spec.harmfulReflex
  problems.copy(at('harmful reflex'), reflex.move)
  problems.copy(at('harmful reflex risk'), reflex.risk)
  problems.copy(at('harmful reflex in this model'), reflex.inThisModel)
  if (!/not modeled/i.test(reflex.inThisModel))
    problems.add(at('says what the model does not model about the harmful reflex'))
  if (reflex.claimIds.length === 0) problems.add(at('harmful reflex cites a claim'))

  spec.misconceptions.forEach((entry, n) => {
    problems.copy(at(`misconception ${n + 1}`), entry.belief)
    problems.copy(at(`misconception ${n + 1} correction`), entry.correction)
    if (entry.claimIds.length === 0) problems.add(at(`misconception ${n + 1} cites a claim`))
  })

  if (spec.modelLeavesOut.shared.length === 0 && spec.modelLeavesOut.section.length === 0)
    problems.add(at('says what the model leaves out'))
  for (const id of spec.modelLeavesOut.shared)
    if (!BOUNDARIES.has(id)) problems.add(at(`model boundary ${id}`))
  spec.modelLeavesOut.section.forEach((text, n) => problems.copy(at(`leaves out ${n + 1}`), text))

  if (spec.signals.length === 0) problems.add(at('labels its signals'))
  spec.signals.forEach((signal, n) => signalProblems(problems, signal, at(`signal ${n + 1}`)))

  // The claim register and the section agree about which claims the section shows.
  const cited = sectionClaimIds(spec)
  const byId = new Map(claims.map((claim) => [claim.id, claim] as const))
  for (const id of cited) {
    const claim = byId.get(id)
    if (!claim) {
      problems.add(at(`cites ${id}, which is not in the claim register`))
      continue
    }
    const surface = claim.surfaces.find((entry) => entry.kind === 'section' && entry.id === spec.id)
    if (!surface) problems.add(at(`cites ${id}, which does not list the section`))
    else if (surface.state !== 'written') problems.add(at(`${id} lists the section as written`))
  }
  for (const claim of claims) {
    const written = claim.surfaces.some(
      (entry) => entry.kind === 'section' && entry.id === spec.id && entry.state === 'written',
    )
    if (written && !cited.has(claim.id as ClaimId))
      problems.add(at(`${claim.id} lists the section but the section does not cite it`))
  }

  return problems.list
}

/** Rules across the written sections together. */
export function sectionSetProblems(specs: readonly ThoracoscopySectionSpec[]): readonly string[] {
  const problems: string[] = []
  const order = specs.map((spec) => SECTION_INDEX.get(spec.id) ?? -1)
  if (order.some((value, n) => n > 0 && value <= order[n - 1]))
    problems.push('sections are listed in the course order')
  const questions = specs.flatMap((spec) => [spec.question, spec.transfer])
  const ids = questions.map((question) => question.id)
  if (new Set(ids).size !== ids.length) problems.push('question ids are unique')
  const bestAt = questions.map((question) =>
    question.choices.findIndex((choice) => choice.plausibility === 'best'),
  )
  if (bestAt.length > 1 && new Set(bestAt).size === 1)
    problems.push('the best choice is not always in the same position')
  return problems
}

export function assertSections(specs: readonly ThoracoscopySectionSpec[]): void {
  const problems = [...specs.flatMap((spec) => sectionProblems(spec)), ...sectionSetProblems(specs)]
  if (problems.length > 0) throw new Error(`Medical Thoracoscopy sections:\n${problems.join('\n')}`)
}
