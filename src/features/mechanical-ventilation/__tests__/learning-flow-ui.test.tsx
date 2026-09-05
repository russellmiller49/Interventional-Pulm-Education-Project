import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MechanicalVentilationLearningActivity } from '../components/MechanicalVentilationLearningActivity'
import { MechanicalVentilationCourseHome } from '../components/MechanicalVentilationCourseHome'
import { MechanicalVentilationCourseCheck } from '../components/MechanicalVentilationCourseCheck'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { unitQuestion, ventilationPlacementQuestions } from '../content/learningQuestions'
import {
  emptyVentilationLearningProgress,
  emptyVentilationUnitProgress,
  VENTILATION_LEARNING_STORAGE_KEY,
} from '../engine/learningProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  window.localStorage.clear()
  window.scrollTo = jest.fn()
})

describe('staged ventilation learning', () => {
  it('starts the same first unit from the hub and renders its serialized unit number correctly', async () => {
    const home = render(<MechanicalVentilationCourseHome />)
    expect(await screen.findByRole('link', { name: 'Start — The whole breath' })).toHaveAttribute(
      'href',
      '/mechanical-ventilation/learn?activity=breathing-with-support',
    )
    home.unmount()
    render(
      <MechanicalVentilationLearningActivity
        unit={JSON.parse(JSON.stringify(ventilationLearningUnits[0]))}
      />,
    )
    expect(await screen.findByText('Unit 1 of 14')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explore the breath' })).toBeInTheDocument()
  })

  it('keeps teaching and rationales outside the commit boundary, then restores a committed answer', async () => {
    const unit = ventilationLearningUnits[0]
    const question = unitQuestion(unit.id, 'check')
    const state = {
      ...emptyVentilationLearningProgress(),
      units: { [unit.id]: { ...emptyVentilationUnitProgress(), step: 'check' } },
    }
    localStorage.setItem(VENTILATION_LEARNING_STORAGE_KEY, JSON.stringify(state))
    const mounted = render(<MechanicalVentilationLearningActivity unit={unit} />)
    const commit = await screen.findByRole('button', { name: 'Commit answer' })
    expect(commit).toBeDisabled()
    expect(screen.queryByText(unit.analogy)).not.toBeInTheDocument()
    expect(screen.queryByText(unit.example.conclusion)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: unit.title })).not.toBeInTheDocument()
    for (const option of question.choices)
      expect(screen.queryByText(option.rationale)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: question.choices[0].label }))
    expect(screen.queryByText(question.choices[0].rationale)).not.toBeInTheDocument()
    fireEvent.click(commit)
    expect(screen.getByText(question.choices[0].rationale)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveFocus()
    mounted.unmount()
    render(<MechanicalVentilationLearningActivity unit={unit} />)
    expect(await screen.findByRole('button', { name: 'Try the transfer case' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: question.choices[0].label })).toBeChecked()
    expect(screen.getByRole('radio', { name: question.choices[0].label })).toBeDisabled()
  })

  it('requires the transfer commitment and reviewed feedback before completion', async () => {
    const unit = ventilationLearningUnits[0]
    const check = unitQuestion(unit.id, 'check')
    const transfer = unitQuestion(unit.id, 'transfer')
    const state = {
      ...emptyVentilationLearningProgress(),
      units: {
        [unit.id]: {
          ...emptyVentilationUnitProgress(),
          step: 'transfer',
          answers: {
            [check.id]: {
              choiceId: check.correctId,
              confidence: 'sure',
              reviewed: true,
              answeredAt: '2026-09-05T01:00:00.000Z',
            },
          },
        },
      },
    }
    localStorage.setItem(VENTILATION_LEARNING_STORAGE_KEY, JSON.stringify(state))
    render(<MechanicalVentilationLearningActivity unit={unit} />)
    await screen.findByRole('button', { name: 'Commit answer' })
    expect(screen.queryByRole('button', { name: 'Complete this unit' })).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('radio', {
        name: transfer.choices.find((option) => option.id === transfer.correctId)!.label,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit answer' }))
    fireEvent.click(screen.getByRole('button', { name: 'See your takeaways' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete this unit' }))
    expect(screen.getByRole('link', { name: 'Continue — Read the traces' })).toHaveAttribute(
      'href',
      '/mechanical-ventilation/learn?activity=waveform-anatomy',
    )
    expect(
      JSON.parse(localStorage.getItem(VENTILATION_LEARNING_STORAGE_KEY)!).units[unit.id]
        .completedAt,
    ).toBeDefined()
  })

  it('names missing final-check prerequisites and offers the same next step', async () => {
    render(<MechanicalVentilationCourseCheck kind="final" />)
    expect(
      await screen.findByRole('heading', { name: 'Finish the learning path first.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue — The whole breath' })).toHaveAttribute(
      'href',
      '/mechanical-ventilation/learn?activity=breathing-with-support',
    )
    for (const unit of ventilationLearningUnits)
      expect(screen.getByRole('link', { name: unit.title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start final check' })).not.toBeInTheDocument()
  })

  it('withholds placement feedback until all answers are committed', async () => {
    render(<MechanicalVentilationCourseCheck kind="placement" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start placement check' }))
    const question = ventilationPlacementQuestions[0]
    fireEvent.click(screen.getByRole('radio', { name: question.choices[0].label }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit answer' }))
    expect(screen.queryByText(question.choices[0].rationale)).not.toBeInTheDocument()
    expect(
      screen.getByText('Answer recorded. Explanations follow the last question.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }))
    expect(screen.getByRole('heading', { name: 'Question 2 of 8' })).toBeInTheDocument()
  })

  it('lets learning continue if local storage is blocked', async () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled')
    })
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('disabled')
    })
    try {
      render(<MechanicalVentilationLearningActivity unit={ventilationLearningUnits[0]} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Explore the breath' }))
      await waitFor(() => expect(screen.getByText(/Progress cannot be saved/)).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'See a worked example' })).toBeInTheDocument()
    } finally {
      get.mockRestore()
      set.mockRestore()
    }
  })
})
