/**
 * The composed document, scanned before the commitment.
 *
 * Each section is mounted on the real stage and read at two moments — on entry, and at the
 * prediction step reached the way a learner reaches it — and every text node, every prose
 * container re-split into sentences, and every accessible name is held to the section's deny
 * patterns and to the sentences of its keyed answers. The one excused surface is the choice
 * fieldset itself, which has to name the answers. Hidden DOM counts: a sentence that is in the
 * document but folded is a sentence a curious learner can open.
 */
import { fireEvent } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .anatomyModule(),
)

import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import { mcsSectionSpec } from '../content/sectionSpecs'
import { buildMcsStageLesson } from '../content/stageLessons'
import { mcsMapAnswerSectionIds } from '../content/mapAnswerTargets'
import {
  answerIdentification,
  continueStep,
  currentStepId,
  mountSection,
  setupMcsStage,
  stepRowStates,
  teardownMcsStage,
  walkTheLoop,
} from '../test-support/mcsStage'

jest.setTimeout(60_000)

const sections = mcsSectionLearningContracts.map(
  (contract) => [contract.sectionId, contract] as const,
)

/**
 * The sentences a section must not say before the commitment: its own deny patterns, and the
 * sentences of the keyed identification and prediction answers and their rationales. Phrases
 * under three words are dropped so a two-word label cannot fire on ordinary prose.
 */
function denySetFor(sectionId: string): { patterns: RegExp[]; phrases: string[] } {
  const contract = mcsSectionLearningContracts.find(
    (candidate) => candidate.sectionId === sectionId,
  )!
  const spec = mcsSectionSpec(sectionId)
  const best = contract.predictionItem.choices.find((choice) => choice.plausibility === 'best')
  const phrases = [
    ...(best ? sentences(best.rationale) : []),
    ...sentences(contract.predictionItem.explanation),
    ...sentences(contract.commonMisinterpretation),
    ...contract.recognizeOptions
      .filter((option) => option.correct)
      .flatMap((option) => sentences(option.feedback)),
  ].filter((phrase) => phrase.split(/\s+/).length >= 3)
  return { patterns: [...spec.precommitDenyPatterns], phrases }
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

/** Every unit of disclosure in the document, with the answer control removed first. */
function disclosureUnits(): string[] {
  const clone = document.body.cloneNode(true) as HTMLElement
  for (const excused of clone.querySelectorAll('[data-prediction-choices]')) excused.remove()
  const units: string[] = []
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim()
    if (text) units.push(text)
  }
  for (const container of clone.querySelectorAll(
    'p, li, dd, dt, td, th, desc, title, text, h1, h2, h3, h4, summary',
  )) {
    units.push(...sentences(container.textContent ?? ''))
  }
  for (const labelled of clone.querySelectorAll('[aria-label]')) {
    const label = labelled.getAttribute('aria-label')?.trim()
    if (label) units.push(label)
  }
  return units
}

function leaks(sectionId: string): string[] {
  const { patterns, phrases } = denySetFor(sectionId)
  const units = disclosureUnits()
  const found: string[] = []
  for (const unit of units) {
    for (const pattern of patterns) {
      if (pattern.test(unit)) found.push(`${pattern} ← "${unit.slice(0, 120)}"`)
    }
    for (const phrase of phrases) {
      if (unit.includes(phrase)) found.push(`phrase ← "${unit.slice(0, 120)}"`)
    }
  }
  return [...new Set(found)]
}

function stepListLeaks(sectionId: string): string[] {
  const lesson = buildMcsStageLesson(sectionId)
  const found: string[] = []
  const rows = [...document.querySelectorAll('[data-step-list] li')]
  if (rows.length !== lesson.steps.length) found.push(`step list has ${rows.length} rows`)
  rows.forEach((row, index) => {
    if (index <= lesson.predictionStepIndex) return
    if (row.getAttribute('data-step-state') !== 'locked')
      found.push(`row ${index + 1} is not locked`)
    if (row.textContent?.includes(lesson.steps[index].title)) {
      found.push(`row ${index + 1} prints its title before it is reached`)
    }
  })
  return found
}

function driveToPrediction(sectionId: string): void {
  if (mcsSectionSpec(sectionId).walksTheLoop) walkTheLoop()
  answerIdentification(sectionId)
  continueStep()
}

beforeEach(() => {
  setupMcsStage()
})

afterEach(() => {
  teardownMcsStage()
})

describe('the rendered pre-commitment scan', () => {
  it.each(sections)('%s says nothing withheld on entry', (sectionId) => {
    mountSection(sectionId)
    expect(leaks(sectionId)).toEqual([])
    expect(stepListLeaks(sectionId)).toEqual([])
  })

  it.each(sections)(
    '%s says nothing withheld at the prediction, with the stem on screen',
    (sectionId) => {
      mountSection(sectionId)
      driveToPrediction(sectionId)
      expect(currentStepId()).toBe(`${sectionId}-predict`)
      expect(leaks(sectionId)).toEqual([])
      expect(stepListLeaks(sectionId)).toEqual([])
      // Opening the folded teaching does not change the answer.
      const reveal = document.querySelector<HTMLButtonElement>('[data-teaching-reveal]')
      if (reveal) fireEvent.click(reveal)
      for (const details of document.querySelectorAll('details')) details.setAttribute('open', '')
      expect(leaks(sectionId)).toEqual([])
    },
  )

  it.each(sections)('%s lights nothing on the map that answers a place question', (sectionId) => {
    mountSection(sectionId)
    if (mcsMapAnswerSectionIds().includes(sectionId)) {
      expect(document.querySelector('[data-map-emphasis-target]')).toBeNull()
      expect(document.querySelector('[data-map-emphasis-caption]')).toBeNull()
      expect(document.querySelector('[data-map-answer-marking-label]')).toBeNull()
    }
    driveToPrediction(sectionId)
    expect(stepRowStates().filter((state) => state === 'current')).toHaveLength(1)
  })

  it('withholds the monitor causality and the target text before the commitment', () => {
    mountSection('lvad-parameters-assessment')
    expect(document.body.textContent).toContain('Withheld for now')
    expect(document.querySelector('[data-monitor-highlight-note]')).toBeNull()
    driveToPrediction('lvad-parameters-assessment')
    expect(document.querySelector('[data-monitor-highlight-note]')).toBeNull()
  })

  it('covers the flow account on the section whose prediction is what it will show', () => {
    mountSection('mcs-foundations-signals')
    expect(document.querySelector('[data-flow-account-withheld]')).toBeInTheDocument()
    expect(document.querySelector('[data-context-line]')?.textContent).toContain(
      'covered until you commit',
    )
    expect(document.querySelector('[data-series="effective-flow"]')).toBeNull()
    driveToPrediction('mcs-foundations-signals')
    expect(document.querySelector('[data-flow-account-withheld]')).toBeInTheDocument()
  })

  it('has a deny set that fires on the keyed answers, so an empty scan means something', () => {
    for (const [sectionId, contract] of sections) {
      const { patterns, phrases } = denySetFor(sectionId)
      const best = contract.predictionItem.choices.find((choice) => choice.plausibility === 'best')!
      const answerText = [best.label, best.rationale, contract.predictionItem.explanation].join(' ')
      const fires =
        patterns.some((pattern) => pattern.test(answerText)) ||
        phrases.some((phrase) => answerText.includes(phrase))
      expect(fires).toBe(true)
    }
  })
})
