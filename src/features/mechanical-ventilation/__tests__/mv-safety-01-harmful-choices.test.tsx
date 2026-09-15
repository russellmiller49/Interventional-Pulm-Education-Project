import { readFileSync } from 'fs'
import path from 'path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MechanicalVentilationCourseCheck } from '../components/MechanicalVentilationCourseCheck'
import { ventilationEvidenceById } from '../content/evidence'
import {
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  ventilationQuestionById,
  ventilationUnitQuestions,
} from '../content/learningQuestions'
import { ventilationQuestionTeaching } from '../content/questionTeaching'
import {
  VENTILATION_LEARNING_STORAGE_KEY,
  parseVentilationLearningProgress,
} from '../engine/learningProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : href.pathname + '?' + new URLSearchParams(href.query).toString()
      }
      {...props}
    >
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

interface ReviewerDecision {
  status: string
  reviewer: string | null
  role: string | null
  date: string | null
  reviewedVersion: string | null
}
interface Locator {
  statement: string
  evidenceId: string
  sourceClass: string
  finding: string
}
interface QueueItem {
  id: string
  questionId: string
  choiceId: string
  status: string
  unchangedForLegacyRecords: {
    prompt: string
    correctId: string
    choice: { id: string; label: string; rationale: string; unsafe: boolean }
  }
  learnerFacingSafety: { previous: string | null; current: string | null }
  teachingPoint: string
  sourceLocators: Locator[]
  otherMaterialConsulted: { sourceClass: string }[]
  evidenceSearched: string[]
  decisionNeeded: string | null
  notChecked: string[]
  reviewerDecision: ReviewerDecision
}
interface Queue {
  contentVersion: string
  preparedBy: string
  statusValues: string[]
  findingValues: string[]
  sourceClasses: Record<string, string>
  items: QueueItem[]
}

const queue = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'docs/gap-remediation/self-paced/MV-SAFETY-01-review-queue.json'),
    'utf8',
  ),
) as Queue

/** The ten potentially harmful choices the MV-03 handoff left without a safety explanation. */
const inventory = [
  ['oxygenation-response:check', '0'],
  ['oxygenation-response:final', '1'],
  ['safety-reassessment-and-human-factors:check', '1'],
  ['safety-reassessment-and-human-factors:check', '2'],
  ['safety-reassessment-and-human-factors:placement', '1'],
  ['safety-reassessment-and-human-factors:placement', '2'],
  ['safety-reassessment-and-human-factors:final', '1'],
  ['safety-reassessment-and-human-factors:final', '2'],
  ['high-peak-pressure-integration:final', '0'],
  ['high-peak-pressure-integration:final', '2'],
] as const

const key = (questionId: string, choiceId: string) => `${questionId}#${choiceId}`
const choiceOf = (item: QueueItem) =>
  ventilationQuestionById
    .get(item.questionId)!
    .choices.find((choice) => choice.id === item.choiceId)!
const supported = queue.items.filter((item) => item.status === 'supported-feedback-added')
const held = queue.items.filter((item) => item.status.startsWith('held-'))
const GRADE_TEXT = /\bscore\b|passed|mastered|first attempt|correct on this attempt|\d+\s?%/i

function openItem(questionId: string) {
  const kind = questionId.endsWith(':placement')
    ? 'placement'
    : questionId.endsWith(':final')
      ? 'final'
      : 'review'
  const list =
    kind === 'placement'
      ? ventilationPlacementQuestions
      : kind === 'final'
        ? ventilationFinalQuestions
        : ventilationUnitQuestions
  const index = list.findIndex((question) => question.id === questionId)
  expect(index).toBeGreaterThanOrEqual(0)
  const view = render(<MechanicalVentilationCourseCheck kind={kind} />)
  fireEvent.change(picker(), { target: { value: String(index) } })
  return view
}
const picker = () =>
  screen.getByRole('combobox', { name: 'Choose a worked application' }) as HTMLSelectElement
const noChoiceSelected = () =>
  screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)

function compare(label: string, choiceId: string) {
  fireEvent.click(screen.getByRole('radio', { name: label }))
  fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
  return document.querySelector<HTMLElement>(`[data-compared-choice="${choiceId}"]`)!
}

function honestDecision(decision: ReviewerDecision) {
  if (decision.status === 'NOT REVIEWED') {
    expect(decision.reviewer).toBeNull()
    expect(decision.role).toBeNull()
    expect(decision.date).toBeNull()
    expect(decision.reviewedVersion).toBeNull()
    return
  }
  expect(decision.reviewer).toBeTruthy()
  expect(decision.reviewer).not.toMatch(/claude|openai|gpt|assistant|\bai\b/i)
  expect(decision.role).toBeTruthy()
  expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(decision.reviewedVersion).toBe(queue.contentVersion)
}

describe('MV-SAFETY-01 review queue and content', () => {
  it('accounts for all ten choices MV-03 left unexplained, and leaves no harmful choice unaccounted for', () => {
    expect(queue.items.map((item) => key(item.questionId, item.choiceId)).sort()).toEqual(
      inventory.map(([questionId, choiceId]) => key(questionId, choiceId)).sort(),
    )
    expect(new Set(queue.items.map((item) => item.id)).size).toBe(inventory.length)
    expect(queue.statusValues.sort()).toEqual(
      [
        'already-adequate',
        'held-for-faculty-RT-review',
        'held-for-source-review',
        'supported-feedback-added',
      ].sort(),
    )
    for (const item of queue.items) expect(queue.statusValues).toContain(item.status)

    const queued = new Set(queue.items.map((item) => key(item.questionId, item.choiceId)))
    const mv03Batch = new Set(ventilationQuestionTeaching.map((teaching) => teaching.questionId))
    const harmful = [...ventilationQuestionById.values()].flatMap((question) =>
      question.choices.filter((choice) => choice.unsafe).map((choice) => ({ question, choice })),
    )
    expect(harmful).toHaveLength(13)
    for (const { question, choice } of harmful) {
      if (queued.has(key(question.id, choice.id))) continue
      expect(mv03Batch.has(question.id)).toBe(true)
      expect(choice.safety!.length).toBeGreaterThan(60)
    }
  })

  it('adds learner-facing safety wording only where the queue records support for it', () => {
    for (const item of queue.items) {
      const choice = choiceOf(item)
      expect(choice.unsafe).toBe(true)
      expect(item.learnerFacingSafety.previous).toBeNull()
      expect(choice.safety ?? null).toBe(item.learnerFacingSafety.current)
      expect(item.teachingPoint.length).toBeGreaterThan(40)
      expect(item.notChecked.length).toBeGreaterThan(0)
      if (item.status === 'supported-feedback-added') {
        expect(choice.safety!.length).toBeGreaterThan(60)
        expect(choice.safety).not.toMatch(/\byou\b|\bscore|incorrect|wrong answer|penalt/i)
        expect(
          item.sourceLocators.some(
            (locator) =>
              locator.finding === 'supports' &&
              locator.sourceClass === 'checked-published-source' &&
              ventilationEvidenceById.has(locator.evidenceId),
          ),
        ).toBe(true)
      } else {
        expect(choice.safety).toBeUndefined()
      }
      if (item.status.startsWith('held-')) {
        expect(item.evidenceSearched.length).toBeGreaterThan(0)
        expect(item.decisionNeeded!.length).toBeGreaterThan(40)
      }
    }
    expect(supported.length + held.length).toBe(queue.items.length)
  })

  it('keeps every stem, choice label, rationale, key and harmful marker that saved records rely on', () => {
    for (const item of queue.items) {
      const question = ventilationQuestionById.get(item.questionId)!
      const choice = choiceOf(item)
      expect(question.prompt).toBe(item.unchangedForLegacyRecords.prompt)
      expect(question.correctId).toBe(item.unchangedForLegacyRecords.correctId)
      expect({
        id: choice.id,
        label: choice.label,
        rationale: choice.rationale,
        unsafe: Boolean(choice.unsafe),
      }).toEqual(item.unchangedForLegacyRecords.choice)
    }
  })

  it('is a request for review, with every source classed and every locator registered or declared', () => {
    expect(queue.preparedBy).toMatch(/not a clinical reviewer/)
    for (const item of queue.items) {
      honestDecision(item.reviewerDecision)
      expect(item.sourceLocators.length).toBeGreaterThan(0)
      for (const locator of item.sourceLocators) {
        expect(Object.keys(queue.sourceClasses)).toContain(locator.sourceClass)
        expect(queue.findingValues).toContain(locator.finding)
        expect(
          locator.evidenceId === 'none' ||
            locator.evidenceId.startsWith('unregistered:') ||
            ventilationEvidenceById.has(locator.evidenceId),
        ).toBe(true)
        if (locator.sourceClass === 'checked-published-source')
          expect(ventilationEvidenceById.get(locator.evidenceId)?.identity?.status).toBe(
            'checked-against-supplied-file',
          )
        if (locator.sourceClass === 'checked-manufacturer-source')
          expect(ventilationEvidenceById.get(locator.evidenceId)?.sourceClass).toBe('manufacturer')
      }
      for (const material of item.otherMaterialConsulted)
        expect(Object.keys(queue.sourceClasses)).toContain(material.sourceClass)
    }
  })
})

describe('MV-SAFETY-01 safety feedback (rendered, self-paced)', () => {
  it.each([...new Set(supported.map((item) => item.questionId))])(
    '%s shows its safety notes with the explanation, before any answer',
    (questionId) => {
      openItem(questionId)
      const noted = ventilationQuestionById
        .get(questionId)!
        .choices.filter((choice) => choice.safety)
      fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
      expect(noChoiceSelected()).toBe(true)
      expect(document.querySelectorAll('[data-safety-note]')).toHaveLength(noted.length)
      for (const choice of noted) expect(screen.getByText(choice.safety!)).toBeInTheDocument()
      expect(localStorage.length).toBe(0)
    },
  )

  it.each(supported.map((item) => [item.id, item] as const))(
    '%s: choosing the harmful option explains the harm at once, then Try again and Continue work',
    (_id, item) => {
      openItem(item.questionId)
      const choice = choiceOf(item)
      const compared = compare(choice.label, choice.id)
      expect(compared).toHaveTextContent('This does not fit the case.')
      expect(compared).toHaveTextContent(choice.rationale)
      expect(compared.nextElementSibling).toHaveAttribute('data-safety-note')
      expect(compared.nextElementSibling).toHaveTextContent(
        'Potential harm in this case: ' + choice.safety,
      )
      expect(document.body.textContent).not.toMatch(GRADE_TEXT)
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(document.querySelector('[data-reinforcement-explanation]')).toBeNull()
      expect(noChoiceSelected()).toBe(true)
      const before = picker().value
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      expect(picker().value).not.toBe(before)
      expect(localStorage.length).toBe(0)
    },
  )

  it('adds no safety note to a held choice, which is still explained and never blocks', () => {
    for (const item of held) {
      openItem(item.questionId)
      const choice = choiceOf(item)
      const compared = compare(choice.label, choice.id)
      expect(compared).toHaveTextContent('This does not fit the case.')
      expect(compared).toHaveTextContent(choice.rationale)
      expect(compared.nextElementSibling?.hasAttribute('data-safety-note') ?? false).toBe(false)
      expect(document.body.textContent).not.toContain(item.teachingPoint)
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
      cleanup()
    }
  })

  it('lets a wrong reading be retried until the fitting one, with no grade', () => {
    const question = ventilationQuestionById.get('high-peak-pressure-integration:final')!
    const wrong = question.choices.find((choice) => choice.safety)!
    const best = question.choices.find((choice) => choice.id === question.correctId)!
    openItem(question.id)
    expect(compare(wrong.label, wrong.id)).toHaveTextContent('This does not fit the case.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    const fitting = compare(best.label, best.id)
    expect(fitting).toHaveTextContent('This fits the case.')
    expect(fitting.nextElementSibling?.hasAttribute('data-safety-note') ?? false).toBe(false)
    expect(document.body.textContent).not.toMatch(GRADE_TEXT)
    expect(localStorage.length).toBe(0)
  })

  it('opens again at the first item with nothing revealed after a reload', () => {
    const view = openItem('safety-reassessment-and-human-factors:final')
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    view.unmount()
    render(<MechanicalVentilationCourseCheck kind="final" />)
    expect(picker()).toHaveValue('0')
    expect(document.querySelector('[data-reinforcement-explanation]')).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('reads a legacy record that chose these options with its meaning intact, and never rewrites it', () => {
    const answeredAt = '2026-09-01T12:00:00.000Z'
    const answer = (choiceId: string) => ({
      choiceId,
      confidence: 'sure',
      reviewed: true,
      answeredAt,
    })
    const record = {
      version: 1,
      units: {},
      placement: { 'safety-reassessment-and-human-factors:placement': answer('1') },
      finalAnswers: {
        'oxygenation-response:final': answer('1'),
        'safety-reassessment-and-human-factors:final': answer('2'),
        'high-peak-pressure-integration:final': answer('0'),
      },
      finalHistory: [
        { score: 6, total: ventilationFinalQuestions.length, safe: false, completedAt: answeredAt },
      ],
      review: {
        'oxygenation-response:check': answer('0'),
        'safety-reassessment-and-human-factors:check': answer('2'),
      },
    }
    const raw = JSON.stringify(record)
    const parsed = parseVentilationLearningProgress(raw)
    expect(parsed.placement).toEqual(record.placement)
    expect(parsed.finalAnswers).toEqual(record.finalAnswers)
    expect(parsed.review).toEqual(record.review)
    expect(parsed.finalHistory).toEqual(record.finalHistory)

    localStorage.setItem(VENTILATION_LEARNING_STORAGE_KEY, raw)
    openItem('safety-reassessment-and-human-factors:final')
    const choice = ventilationQuestionById.get('safety-reassessment-and-human-factors:final')!
      .choices[1]
    compare(choice.label, choice.id)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem(VENTILATION_LEARNING_STORAGE_KEY)).toBe(raw)
  })
})
