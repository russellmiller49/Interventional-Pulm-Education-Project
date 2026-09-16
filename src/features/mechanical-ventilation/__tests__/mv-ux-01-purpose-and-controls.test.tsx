import { readFileSync } from 'fs'
import path from 'path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MechanicalVentilationCourseCheck } from '../components/MechanicalVentilationCourseCheck'
import {
  ventilationGenericQuestionPurpose,
  ventilationLearningUnits,
  ventilationUnitById,
} from '../content/learningCurriculum'
import {
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  ventilationUnitQuestions,
  type VentilationQuestion,
} from '../content/learningQuestions'
import { ventilationQuestionTeachingById } from '../content/questionTeaching'

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

const groups = {
  placement: ventilationPlacementQuestions,
  final: ventilationFinalQuestions,
  review: ventilationUnitQuestions,
} as const
type Kind = keyof typeof groups

const picker = () =>
  screen.getByRole('combobox', { name: 'Choose a worked application' }) as HTMLSelectElement
const radios = () => screen.getAllByRole('radio') as HTMLInputElement[]

/** Opens the card on one question, whichever saved entry lists it. */
function openQuestion(questionId: string) {
  const kind = (Object.keys(groups) as Kind[]).find((key) =>
    groups[key].some((question) => question.id === questionId),
  )!
  const index = groups[kind].findIndex((question) => question.id === questionId)
  render(<MechanicalVentilationCourseCheck kind={kind} />)
  fireEvent.change(picker(), { target: { value: String(index) } })
}

/** The purpose line: the paragraph under the "Optional reinforcement" eyebrow. */
function purposeText() {
  const card = document.querySelector<HTMLElement>('[data-reinforcement]')!
  return card.querySelectorAll('p')[1].textContent ?? ''
}

/**
 * MV-UX-01 defect 1. The generic purpose used to be built as
 * `'Apply ' + unit.title.toLowerCase() + ' to a short authored case.'`, which turned a
 * question-shaped or two-sentence unit title into a sentence such as
 * "Apply did oxygenation improve at a cost? to a short authored case."
 */
const malformed = [
  /\bApply [a-z][^.]*\?/, // a question embedded after "Apply"
  /\bApply [a-z][^.]*\.\s[a-z]/, // a second sentence lower-cased mid-line
  /^apply\b/i, // any surviving "Apply <lowercased title>" construction
]

/** The six items MV-SAFETY-01 reported: they carry no MV-03 record, so they take the generic line. */
const reportedItems = [
  'oxygenation-response:check',
  'oxygenation-response:final',
  'safety-reassessment-and-human-factors:check',
  'safety-reassessment-and-human-factors:placement',
  'safety-reassessment-and-human-factors:final',
  'high-peak-pressure-integration:final',
]

describe('MV-UX-01 purpose line', () => {
  it.each(ventilationLearningUnits.map((unit) => [unit.id, unit] as const))(
    '%s composes one well-formed sentence with no re-cased authored text',
    (_id, unit) => {
      const purpose = ventilationGenericQuestionPurpose(unit)
      for (const pattern of malformed) expect(purpose).not.toMatch(pattern)
      expect(purpose).toMatch(/^[A-Z]/)
      expect(purpose.endsWith('.')).toBe(true)
      // One sentence: no sentence-ending punctuation before the final period.
      expect(purpose.slice(0, -1)).not.toMatch(/[.?!]/)
      // The authored outcome is carried verbatim, not lower-cased or re-worded.
      expect(purpose).toContain(unit.outcome.replace(/\.$/, ''))
    },
  )

  it.each(reportedItems)('%s no longer renders the malformed purpose', (questionId) => {
    openQuestion(questionId)
    const purpose = purposeText()
    for (const pattern of malformed) expect(purpose).not.toMatch(pattern)
    const unit = ventilationUnitById.get(
      [...Object.values(groups)].flat().find((q) => q.id === questionId)!.unitId,
    )!
    expect(purpose).toBe(ventilationGenericQuestionPurpose(unit))
    // Visible before answering, with nothing chosen.
    expect(radios().every((radio) => !radio.checked)).toBe(true)
  })

  it.each(Object.keys(groups) as Kind[])(
    '%s shows a purpose for every item and keeps the authored MV-03 wording where there is one',
    (kind) => {
      render(<MechanicalVentilationCourseCheck kind={kind} />)
      groups[kind].forEach((question: VentilationQuestion, index: number) => {
        fireEvent.change(picker(), { target: { value: String(index) } })
        const teaching = ventilationQuestionTeachingById.get(question.id)
        if (teaching?.presentation === 'worked-comparison') return
        const purpose = purposeText()
        expect(purpose.length).toBeGreaterThan(0)
        for (const pattern of malformed) expect(purpose).not.toMatch(pattern)
        if (teaching) expect(purpose).toBe(teaching.purpose)
        else
          expect(purpose).toBe(
            ventilationGenericQuestionPurpose(ventilationUnitById.get(question.unitId)!),
          )
      })
    },
  )

  it('keeps ids, stems, labels, keyed answers, rationales and safety notes untouched', () => {
    for (const question of Object.values(groups).flat()) {
      expect(question.id).toBe(`${question.unitId}:${question.id.split(':')[1]}`)
      expect(question.choices.some((choice) => choice.id === question.correctId)).toBe(true)
      for (const choice of question.choices) expect(choice.rationale.length).toBeGreaterThan(0)
    }
    openQuestion('safety-reassessment-and-human-factors:final')
    fireEvent.click(
      screen.getByRole('radio', { name: 'Record completion because the sound has diminished' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    expect(document.querySelectorAll('[data-safety-note]').length).toBeGreaterThan(0)
  })
})

describe('MV-UX-01 radio controls', () => {
  const css = readFileSync(
    path.join(__dirname, '..', 'components', 'ventilation-course.module.css'),
    'utf8',
  )
  const block = (selector: string) =>
    css
      .slice(css.indexOf(selector + ' {'))
      .slice(0, css.slice(css.indexOf(selector + ' {')).indexOf('}'))

  it('declares the light scheme the fixed light palette assumes', () => {
    // Without this the site or OS dark scheme is inherited and the user agent paints an unchecked
    // radio as a dark filled dot on the white card.
    expect(block('.course')).toMatch(/color-scheme:\s*light/)
    expect(block('.question')).toMatch(/color-scheme:\s*light/)
  })

  it('marks the chosen row with more than color, and keeps focus visible', () => {
    const checked = block('.choice:has(input:checked)')
    expect(checked).toMatch(/background:/)
    expect(checked).toMatch(/border-color:/)
    expect(checked).toMatch(/box-shadow:\s*inset/)
    expect(block('.choice input:focus-visible')).toMatch(/outline:\s*3px solid/)
    expect(css).toMatch(/@media \(forced-colors: active\)/)
  })

  it('keeps the native control authoritative and unchecked until a learner acts', () => {
    openQuestion('safety-reassessment-and-human-factors:final')
    const group = radios()
    expect(group.length).toBeGreaterThan(1)
    for (const radio of group) {
      expect(radio.tagName).toBe('INPUT')
      expect(radio.type).toBe('radio')
      expect(radio.disabled).toBe(false)
      expect(radio.checked).toBe(false)
      expect(radio.name).toBe('safety-reassessment-and-human-factors:final')
    }
    // Reading the explanation first still checks nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(radios().every((radio) => !radio.checked)).toBe(true)
  })

  it('checks exactly one control, and Try again returns every control to unchecked', () => {
    openQuestion('oxygenation-response:final')
    const target = radios()[1]
    fireEvent.click(target)
    expect(radios().filter((radio) => radio.checked)).toHaveLength(1)
    expect(radios()[1].checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(radios().every((radio) => !radio.checked)).toBe(true)
    // Continue works with no correct answer and stores nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(localStorage.length).toBe(0)
  })
})
