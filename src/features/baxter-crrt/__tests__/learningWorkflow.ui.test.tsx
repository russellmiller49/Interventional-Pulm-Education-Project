import { fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'

import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { getBaxterCrrtCase } from '../content'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningExperience,
} from '../engine'

function CasePlayerHarness({ experience = 'practice' }: { experience?: CrrtLearningExperience }) {
  const caseDefinition = getBaxterCrrtCase(experience === 'mastery' ? 'CRRT-16' : 'CRRT-01')
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition,
      experience,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )

  return (
    <CrrtCasePlayer
      session={session}
      dispatch={dispatch}
      onRoleChange={(roleLens) => dispatch({ type: 'RESET', roleLens })}
      onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
      idNamespace={`workflow-${experience}`}
    />
  )
}

function submitCrrt01ClinicalPlan() {
  const definition = getBaxterCrrtCase('CRRT-01')
  const hidden = definition.hiddenMechanism
  const plan = within(screen.getByRole('region', { name: 'Plan your approach before acting' }))
  fireEvent.change(plan.getByRole('combobox', { name: '1 · Goal' }), {
    target: { value: hidden.correctGoalOptionId },
  })
  fireEvent.change(plan.getByRole('combobox', { name: '2 · Mechanism' }), {
    target: { value: hidden.correctMechanismOptionId },
  })
  for (const id of hidden.correctControlOptionIds) {
    const option = definition.controlOptions.find((candidate) => candidate.id === id)
    if (!option) throw new Error(`Missing CRRT-01 control option ${id}.`)
    fireEvent.click(plan.getByRole('checkbox', { name: option.label }))
  }
  fireEvent.change(plan.getByRole('combobox', { name: '4 · Expected response' }), {
    target: { value: hidden.correctResponseOptionId },
  })
  for (const id of hidden.correctReassessmentOptionIds) {
    const option = definition.reassessmentOptions.find((candidate) => candidate.id === id)
    if (!option) throw new Error(`Missing CRRT-01 reassessment option ${id}.`)
    fireEvent.click(plan.getByRole('checkbox', { name: option.label }))
  }
  fireEvent.click(plan.getByRole('button', { name: 'Submit plan and prediction' }))
}

describe('Baxter CRRT case player', () => {
  it('shows the four-stage reasoning ribbon, compact role lens, and four workspace tabs', () => {
    render(<CasePlayerHarness />)

    const ribbon = screen.getByRole('navigation', { name: 'CRRT case stages' })
    for (const label of ['Brief', 'Plan', 'Run', 'Debrief']) {
      expect(within(ribbon).getByText(label)).toBeInTheDocument()
    }
    expect(within(ribbon).getByText('Read + Define')).toBeInTheDocument()
    expect(within(ribbon).getByText('Select + Predict')).toBeInTheDocument()
    expect(within(ribbon).getByText('Act + Observe')).toBeInTheDocument()
    expect(within(ribbon).getByText('Reassess + Reflect')).toBeInTheDocument()
    const sharedPhases = screen.getByRole('group', { name: 'CRRT shared activity phases' })
    for (const label of ['Recognize', 'Predict', 'Act', 'Observe', 'Explain', 'Transfer']) {
      expect(within(sharedPhases).getByText(label)).toBeInTheDocument()
    }

    const roles = screen.getByRole('group', { name: 'View case through role lens' })
    expect(within(roles).getByRole('button', { name: 'Integrated' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(roles).getByRole('button', { name: 'Operator' }))
    expect(
      within(screen.getByRole('group', { name: 'View case through role lens' })).getByRole(
        'button',
        { name: 'Operator' },
      ),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('integrates the PrisMax simulator and circuit into one machine surface', () => {
    render(<CasePlayerHarness />)

    const tabs = screen.getByRole('tablist', { name: 'CRRT case surfaces' })
    const machineTab = within(tabs).getByRole('tab', { name: 'Machine + circuit' })
    fireEvent.click(machineTab)
    const panel = document.getElementById(machineTab.getAttribute('aria-controls') ?? '')

    expect(
      within(panel as HTMLElement).getByRole('heading', { name: 'PrisMax machine and circuit' }),
    ).toBeInTheDocument()
    expect(
      within(panel as HTMLElement).getByRole('region', {
        name: 'Original PrisMax functional educational facsimile',
      }),
    ).toBeInTheDocument()
    expect(
      within(panel as HTMLElement).getByLabelText('Circuit and fluid state'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Device profile' })).not.toBeInTheDocument()
  })

  it('unlocks authored machine controls only after the clinical plan is committed', () => {
    render(<CasePlayerHarness />)
    submitCrrt01ClinicalPlan()

    const tabs = screen.getByRole('tablist', { name: 'CRRT case surfaces' })
    const machineTab = within(tabs).getByRole('tab', { name: 'Machine + circuit' })
    fireEvent.click(machineTab)
    const machine = within(
      document.getElementById(machineTab.getAttribute('aria-controls') ?? '') as HTMLElement,
    )
    const setting = machine.getByRole('button', {
      name: 'Apply case setting: Adjust machine fluid removal after assessment',
    })
    expect(setting).toBeDisabled()
    fireEvent.click(
      machine.getByRole('button', {
        name: 'Record clinical step: Complete the initial clinical assessment',
      }),
    )
    expect(setting).toBeEnabled()
    fireEvent.click(setting)
    expect(machine.getByLabelText('Pilot flow displays')).toHaveTextContent('70 mL/h')
  })

  it('runs the masked capstone without hints or a case/device picker', () => {
    render(<CasePlayerHarness experience="mastery" />)

    expect(screen.getByRole('note', { name: 'Capstone safeguards.' })).toBeInTheDocument()
    expect(
      screen.getByText(/Case identity remains masked until causal debrief/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Reveal guidance/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /case/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /device/i })).not.toBeInTheDocument()
  })
})
