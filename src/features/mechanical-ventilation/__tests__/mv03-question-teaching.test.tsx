import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { MechanicalVentilationCourseCheck } from '../components/MechanicalVentilationCourseCheck'
import {
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  ventilationQuestionById,
  ventilationUnitQuestions,
} from '../content/learningQuestions'
import {
  ventilationQuestionTeaching,
  ventilationQuestionTeachingById,
} from '../content/questionTeaching'

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

const airTrapping = [
  'expiration-and-air-trapping:check',
  'expiration-and-air-trapping:transfer',
  'expiration-and-air-trapping:placement',
  'high-peak-pressure-integration:transfer',
  'ventilation-and-co2:final',
]
const oxygenationVersusVentilation = [
  'ventilation-and-co2:check',
  'ventilation-and-co2:placement',
  'oxygenation-response:transfer',
  'breathing-with-support:transfer',
  'ventilation-and-co2:transfer',
]

type Kind = 'placement' | 'final' | 'review'
function kindOf(questionId: string): Kind {
  if (questionId.endsWith(':placement')) return 'placement'
  if (questionId.endsWith(':final')) return 'final'
  return 'review'
}

function openItem(questionId: string) {
  const kind = kindOf(questionId)
  const list =
    kind === 'placement'
      ? ventilationPlacementQuestions
      : kind === 'final'
        ? ventilationFinalQuestions
        : ventilationUnitQuestions
  const index = list.findIndex((question) => question.id === questionId)
  expect(index).toBeGreaterThanOrEqual(0)
  render(<MechanicalVentilationCourseCheck kind={kind} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a worked application' }), {
    target: { value: String(index) },
  })
}

describe('MV-03 explanatory feedback batch (content)', () => {
  it('reviews at most ten items, starting with air trapping and oxygenation-versus-ventilation confusion', () => {
    expect(ventilationQuestionTeaching.length).toBeLessThanOrEqual(10)
    expect(new Set(ventilationQuestionTeaching.map((item) => item.questionId))).toEqual(
      new Set([...airTrapping, ...oxygenationVersusVentilation]),
    )
  })

  it('gives every item a named teaching reason and an explanation that stands without an answer', () => {
    for (const teaching of ventilationQuestionTeaching) {
      const question = ventilationQuestionById.get(teaching.questionId)!
      const best = question.choices.find((choice) => choice.id === question.correctId)!
      expect(['keep', 'rewrite', 'replace', 'combine', 'remove']).toContain(teaching.disposition)
      expect(teaching.review).toBe('not-reviewed')
      expect(teaching.concept.length).toBeGreaterThan(30)
      expect(teaching.purpose.length).toBeGreaterThan(30)
      expect(teaching.explanation.length).toBeGreaterThan(200)
      expect(teaching.explanation).not.toContain(best.rationale)
      expect(teaching.nextCheck.length).toBeGreaterThan(40)
      if (teaching.presentation === 'question') expect(teaching.hint!.length).toBeGreaterThan(30)
      else expect(teaching.comparison!.rows.length).toBeGreaterThan(1)
      for (const choice of question.choices) expect(choice.rationale.length).toBeGreaterThan(60)
      for (const partner of teaching.combinedWith ?? []) {
        const other = ventilationQuestionTeachingById.get(partner)!
        expect(other.combinedWith).toContain(teaching.questionId)
        expect(other.comparison?.id).toBe(teaching.comparison?.id)
      }
    }
  })

  it('explains each potentially harmful choice and never flags one without saying why', () => {
    const harmful = ventilationQuestionTeaching.flatMap((teaching) =>
      ventilationQuestionById.get(teaching.questionId)!.choices.filter((choice) => choice.unsafe),
    )
    expect(harmful).toHaveLength(3)
    for (const choice of harmful) expect(choice.safety!.length).toBeGreaterThan(60)
    for (const question of ventilationQuestionById.values())
      for (const choice of question.choices) if (choice.safety) expect(choice.unsafe).toBe(true)
  })

  it('keeps the rate comparison arithmetic exact', () => {
    const rows = ventilationQuestionTeachingById.get('expiration-and-air-trapping:check')!
      .comparison!.rows
    for (const [rate, cycle, inspiratory, expiratory] of rows) {
      expect(Number(cycle)).toBeCloseTo(60 / Number(rate), 5)
      expect(Number(expiratory)).toBeCloseTo(Number(cycle) - Number(inspiratory), 5)
    }
  })
})

describe('MV-03 explanatory feedback batch (rendered, self-paced)', () => {
  it('opens hint and explanation before any answer, then explains a harmful choice without blocking', () => {
    const id = 'ventilation-and-co2:transfer'
    const teaching = ventilationQuestionTeachingById.get(id)!
    const question = ventilationQuestionById.get(id)!
    const harmful = question.choices.find((choice) => choice.unsafe)!
    openItem(id)

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('status')).toHaveTextContent(teaching.hint!)
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(screen.getByText(teaching.explanation)).toBeInTheDocument()
    expect(screen.getByText(teaching.nextCheck)).toBeInTheDocument()
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true)
    expect(screen.getAllByText(harmful.safety!)).toHaveLength(1)

    fireEvent.click(screen.getByRole('radio', { name: harmful.label }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    const compared = document.querySelector(`[data-compared-choice="${harmful.id}"]`)!
    expect(compared).toHaveTextContent('This does not fit the case.')
    expect(compared).toHaveTextContent(harmful.rationale)
    expect(screen.getAllByText(harmful.safety!)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByText(teaching.explanation)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(localStorage.length).toBe(0)
  })

  it('explains both tempting console changes in the trapped-gas emergency', () => {
    openItem('high-peak-pressure-integration:transfer')
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    const question = ventilationQuestionById.get('high-peak-pressure-integration:transfer')!
    for (const choice of question.choices.filter((item) => item.unsafe))
      expect(screen.getByText(choice.safety!)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-safety-note]')).toHaveLength(2)
  })

  it('replaces the weak air-trapping question with a worked rate comparison that needs no answer', () => {
    const id = 'expiration-and-air-trapping:check'
    const teaching = ventilationQuestionTeachingById.get(id)!
    const question = ventilationQuestionById.get(id)!
    openItem(id)
    const picker = screen.getByRole('combobox', {
      name: 'Choose a worked application',
    }) as HTMLSelectElement
    expect(picker.selectedOptions[0].textContent).toMatch(/\(worked comparison\)$/)
    const card = document.querySelector<HTMLElement>(`[data-worked-comparison="${id}"]`)!
    expect(within(card).queryAllByRole('radio')).toHaveLength(0)
    const table = within(card).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(teaching.comparison!.rows.length + 1)
    expect(within(card).getByText(teaching.explanation)).toBeInTheDocument()
    for (const choice of question.choices) {
      expect(card.textContent).toContain(choice.label)
      expect(card.textContent).toContain(choice.rationale)
    }
    expect(card.textContent).toContain('This fits the case.')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('shows one oxygenation-versus-CO₂ comparison on both the starting-concepts and review routes', () => {
    openItem('ventilation-and-co2:placement')
    expect(document.querySelector('[data-comparison="oxygenation-and-co2-axes"]')).not.toBeNull()
    cleanup()
    openItem('oxygenation-response:transfer')
    expect(document.querySelector('[data-comparison="oxygenation-and-co2-axes"]')).not.toBeNull()
  })

  it.each([...airTrapping, ...oxygenationVersusVentilation])(
    '%s saves nothing and shows no grade',
    (id) => {
      openItem(id)
      const explain = screen.queryByRole('button', { name: 'Show explanation' })
      if (explain) fireEvent.click(explain)
      expect(screen.getByText(ventilationQuestionTeachingById.get(id)!.explanation)).toBeVisible()
      expect(localStorage.length).toBe(0)
      expect(document.body.textContent).not.toMatch(
        /\bscore\b|passed|mastered|first attempt|correct on this attempt|\d+\s?%/i,
      )
    },
  )
})
