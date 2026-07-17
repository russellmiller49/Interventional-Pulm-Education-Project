import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { recordSiteModuleEvent } from '@/lib/analytics'

import { CrrtLearningWorkflow } from '../components/CrrtLearningWorkflow'
import { CrrtPhase7CaseReview } from '../components/CrrtPhase7CaseReview'
import {
  baxterCrrtPhase7ReviewCases,
  getBaxterCrrtPilotCase,
  type RuntimeCrrtCase,
} from '../content'
import { createCrrtLearningSession } from '../engine'

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: jest.fn(),
}))

const reviewCases = baxterCrrtPhase7ReviewCases.cases

function selectValue(name: string, value: string) {
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
}

function selectIndexedCheckbox(groupName: string, index: number) {
  const group = screen.getByRole('group', { name: groupName })
  fireEvent.click(within(group).getAllByRole('checkbox')[index])
}

function performIntervention(definition: RuntimeCrrtCase, interventionId: string) {
  const intervention = definition.interventions.find((candidate) => candidate.id === interventionId)
  if (!intervention) throw new Error(`Missing test intervention ${interventionId}.`)
  const article = screen
    .getAllByText(intervention.label)
    .map((element) => element.closest('article'))
    .find((candidate): candidate is HTMLElement => candidate instanceof HTMLElement)
  if (!article) throw new Error(`Could not find intervention card for ${interventionId}.`)
  fireEvent.click(within(article).getByRole('button', { name: 'Perform' }))
}

describe('Phase 7 reviewer-only case runner', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.mocked(recordSiteModuleEvent).mockClear()
  })

  it('exposes all four candidates only inside an explicit non-persistent reviewer boundary', () => {
    render(<CrrtPhase7CaseReview />)

    const runner = screen.getByTestId('crrt-phase7-case-review')
    expect(runner).toHaveAttribute('data-reviewer-only', 'true')
    expect(runner).toHaveAttribute('data-review-status', 'pending')
    expect(runner).toHaveAttribute('data-runtime-audience', 'reviewer')
    expect(runner).toHaveAttribute('data-scoring', 'candidate-preview-only')
    expect(runner).toHaveAttribute('data-analytics', 'none')
    expect(runner).toHaveAttribute('data-progress-write', 'none')
    expect(runner).toHaveAttribute('data-persistence', 'none')
    expect(runner).toHaveAttribute('data-competency', 'none')
    expect(runner).toHaveAttribute('data-learner-selection', 'none')
    expect(
      within(runner).getByRole('note', { name: 'Reviewer runtime—not a learner activity.' }),
    ).toHaveTextContent(/no analytics.*no progress or local storage.*no competency/i)

    const selector = within(runner).getByRole('combobox', { name: 'Review case candidate' })
    expect(
      within(selector)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(['CRRT-01', 'CRRT-02', 'CRRT-05', 'CRRT-06', 'CRRT-07', 'CRRT-11', 'CRRT-15'])
    expect(within(selector).queryByRole('option', { name: /CRRT-04/ })).not.toBeInTheDocument()
    expect(
      within(runner).getByRole('navigation', { name: 'CRRT reviewer reasoning sequence' }),
    ).toBeInTheDocument()
    expect(within(runner).getByText(/CRRT-01 · Reviewer score preview/)).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
    expect(recordSiteModuleEvent).not.toHaveBeenCalled()
  })

  it('switches only among reviewer cases, restores focus, and reconstructs a clean session', async () => {
    const user = userEvent.setup()
    render(<CrrtPhase7CaseReview />)

    const selector = screen.getByRole('combobox', { name: 'Review case candidate' })
    await user.selectOptions(selector, 'CRRT-06')

    expect(screen.getByRole('combobox', { name: 'Review case candidate' })).toHaveValue('CRRT-06')
    expect(screen.getByText(/CRRT-06 · Reviewer score preview/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Reviewer-only interactive case runner. CRRT-06. Attempt 1.',
      }),
    ).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '1 · Goal' })).toHaveValue('')
    expect(screen.getByTestId('crrt-phase7-case-review')).toHaveAttribute(
      'data-runtime-audience',
      'reviewer',
    )

    await user.click(screen.getByRole('button', { name: 'Clean attempt' }))
    expect(screen.getByText('Attempt 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Reviewer-only interactive case runner. CRRT-06. Attempt 2.',
      }),
    ).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '1 · Goal' })).toHaveValue('')
    expect(window.localStorage).toHaveLength(0)
    expect(recordSiteModuleEvent).not.toHaveBeenCalled()
  })

  it('runs prediction, intervention, reassessment, and a candidate-only score without writes', () => {
    const definition = reviewCases[0]
    render(<CrrtPhase7CaseReview />)

    selectValue('1 · Goal', definition.hiddenMechanism.correctGoalOptionId)
    selectValue('2 · Mechanism', definition.hiddenMechanism.correctMechanismOptionId)
    for (const controlId of definition.hiddenMechanism.correctControlOptionIds) {
      selectIndexedCheckbox(
        '3 · Planned control',
        definition.controlOptions.findIndex((option) => option.id === controlId),
      )
    }
    selectValue('4 · Expected response', definition.hiddenMechanism.correctResponseOptionId)
    for (const reassessmentId of definition.hiddenMechanism.correctReassessmentOptionIds) {
      selectIndexedCheckbox(
        '5 · Reassessment plan',
        definition.reassessmentOptions.findIndex((option) => option.id === reassessmentId),
      )
    }
    fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))

    for (const interventionId of definition.requiredActionIds) {
      performIntervention(definition, interventionId)
    }
    fireEvent.click(screen.getByRole('button', { name: '+5 min' }))

    for (const reassessmentId of definition.requiredReassessmentIds) {
      selectIndexedCheckbox(
        'Select every reassessment you actually completed',
        definition.reassessmentOptions.findIndex((option) => option.id === reassessmentId),
      )
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commit reassessment' }))
    fireEvent.click(screen.getByRole('button', { name: /Reveal causal debrief/ }))

    const score = screen.getByRole('region', { name: 'Candidate score preview' })
    expect(score).toHaveTextContent(/\/100/)
    expect(score).toHaveTextContent(/Reviewer-only rubric output/i)
    expect(score).toHaveTextContent(/not saved or competency-bearing/i)
    expect(screen.queryByRole('region', { name: 'Practice score' })).not.toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
    expect(recordSiteModuleEvent).not.toHaveBeenCalled()
  })

  it('namespaces all reviewer workflow IDs so it can coexist with the learner workflow', () => {
    const learnerCase = getBaxterCrrtPilotCase('CRRT-04')
    const learnerSession = createCrrtLearningSession({
      caseDefinition: learnerCase,
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
    })
    const { container } = render(
      <>
        <CrrtLearningWorkflow
          session={learnerSession}
          dispatch={jest.fn()}
          availableCases={[learnerCase]}
          mobileSurface="case"
          onCaseChange={jest.fn()}
          onRoleChange={jest.fn()}
          onReset={jest.fn()}
        />
        <CrrtPhase7CaseReview />
      </>,
    )

    expect(document.getElementById('baxter-crrt-mobile-panel-case')).toBeInTheDocument()
    expect(
      document.getElementById('baxter-crrt-phase7-review-baxter-crrt-mobile-panel-case'),
    ).toBeInTheDocument()
    expect(document.getElementById('crrt-case-findings')).toBeInTheDocument()
    expect(
      document.getElementById('baxter-crrt-phase7-review-crrt-case-findings'),
    ).toBeInTheDocument()

    const ids = [...container.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
