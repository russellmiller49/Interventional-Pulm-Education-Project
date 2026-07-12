import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ClinicalCaseFlow } from '../components/clinical/ClinicalCaseFlow'
import { GranulationCase } from '../components/clinical/GranulationCase'
import { PhysicsLensDrawer } from '../components/clinical/PhysicsLensDrawer'
import type { PhysicsLensConfig, StentClinicalCase } from '../engine/learningLabTypes'

jest.mock('../components/learning-lab/StentArchitectureViewport', () => ({
  StentArchitectureViewport: ({ reducedMotion }: { reducedMotion: boolean }) => (
    <div
      data-reduced-motion={String(reducedMotion)}
      data-testid="mock-stent-architecture-viewport"
    />
  ),
}))

const physicsLens: PhysicsLensConfig = {
  preset: 'curve-end-loading',
  architectureIds: ['studded-silicone'],
  loadMode: 'bend',
  clinicalQuestion: 'Where could a curved airway create repeated end contact?',
  observationPrompts: [
    'Inspect the inner curve for gapping.',
    'Inspect both device ends for repeated contact.',
  ],
  debrief:
    'Visible end motion identifies a place to inspect clinically; it does not calculate mucosal stress.',
  evidenceBoundary:
    'This authored scene does not calculate tissue pressure or prove the cause of granulation.',
  evidenceRefs: [],
}

const caseWithLens: StentClinicalCase = {
  id: 'test-curved-airway',
  lessonId: 'fit-behavior',
  requiredForLesson: false,
  title: 'Curved-airway fit check',
  stem: 'A supported main bronchus curves between two usable landing zones.',
  findings: [
    {
      id: 'curve',
      label: 'Airway geometry',
      value: 'The target segment has a pronounced curve.',
      emphasis: 'important',
    },
  ],
  decisions: [
    {
      id: 'opening-plan',
      question: 'What should control the opening plan?',
      instruction: 'Commit before revealing the airway findings.',
      options: [
        {
          id: 'fit-first',
          label: 'Inspect fit, landing zones, and branch relationships',
          rationale: 'Fit and anatomy define the job before a device family is selected.',
          domains: ['fit', 'mechanical-job'],
        },
        {
          id: 'force-first',
          label: 'Choose the greatest displayed force first',
          rationale: 'A displayed force cannot substitute for the anatomic and clinical job.',
          domains: ['architecture'],
        },
      ],
      correctChoiceId: 'fit-first',
      evidenceRefs: [],
    },
    {
      id: 'follow-up-plan',
      question: 'What belongs in follow-up?',
      options: [
        {
          id: 'reassess',
          label: 'Reassess fit, symptoms, patency, and the ongoing indication',
          rationale: 'Surveillance and an exit strategy belong in the initial prescription.',
          domains: ['surveillance', 'fit'],
        },
        {
          id: 'placement-endpoint',
          label: 'Treat placement as the endpoint',
          rationale: 'Placement does not resolve later fit, secretion, or indication changes.',
          domains: ['surveillance'],
        },
      ],
      correctChoiceId: 'reassess',
      evidenceRefs: [],
    },
  ],
  physicsLens,
  finalTakeaway: 'Fit, surveillance, and an exit strategy remain linked throughout the plan.',
  evidenceRefs: [],
  clinicalReviewStatus: 'draft',
}

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
    writable: true,
  })
}

async function commitOpeningDecision(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('radio', {
      name: 'Inspect fit, landing zones, and branch relationships',
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))
}

describe('airway-stent clinical case components', () => {
  beforeEach(() => {
    installMatchMedia(false)
  })

  it('requires a keyboard-accessible opening commitment before revealing findings', async () => {
    const user = userEvent.setup()
    const onDecisionCommitted = jest.fn()
    render(<ClinicalCaseFlow caseData={caseWithLens} onDecisionCommitted={onDecisionCommitted} />)

    expect(
      screen.getByRole('group', { name: 'What should control the opening plan?' }),
    ).toBeVisible()
    expect(screen.queryByText('The target segment has a pronounced curve.')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Fit and anatomy define the job before a device family is selected.'),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('physics-lens-drawer')).not.toBeInTheDocument()

    const fitFirst = screen.getByRole('radio', {
      name: 'Inspect fit, landing zones, and branch relationships',
    })
    const forceFirst = screen.getByRole('radio', {
      name: 'Choose the greatest displayed force first',
    })
    expect(fitFirst).toHaveAttribute('name', 'opening-plan')
    expect(forceFirst).toHaveAttribute('name', 'opening-plan')

    fitFirst.focus()
    await user.keyboard('[Space]')
    expect(fitFirst).toBeChecked()
    expect(screen.getByRole('button', { name: 'Commit and reveal' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(screen.getByText('The target segment has a pronounced curve.')).toBeVisible()
    expect(
      screen.getByText('Fit and anatomy define the job before a device family is selected.'),
    ).toBeVisible()
    expect(screen.getByTestId('physics-lens-drawer')).toBeVisible()
    expect(onDecisionCommitted).toHaveBeenCalledWith({
      caseId: 'test-curved-airway',
      choiceId: 'fit-first',
      decisionId: 'opening-plan',
      initial: true,
      revised: false,
    })
  })

  it('requires every committed plan to be defensible while keeping the lens optional', async () => {
    const user = userEvent.setup()
    const onComplete = jest.fn()
    const onDecisionCommitted = jest.fn()
    const onPhysicsLensOpen = jest.fn()
    render(
      <ClinicalCaseFlow
        caseData={caseWithLens}
        onComplete={onComplete}
        onDecisionCommitted={onDecisionCommitted}
        onPhysicsLensOpen={onPhysicsLensOpen}
      />,
    )

    await commitOpeningDecision(user)
    await user.click(
      screen.getByRole('radio', {
        name: 'Reassess fit, symptoms, patency, and the ongoing indication',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    const lensTrigger = screen.getByRole('button', {
      name: /Where could a curved airway create repeated end contact\?/i,
    })
    const completeButton = screen.getByRole('button', { name: 'Complete clinical case' })
    expect(lensTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(completeButton).toBeEnabled()

    await user.click(
      screen.getByRole('radio', { name: 'Choose the greatest displayed force first' }),
    )

    expect(
      screen.getByRole('status', {
        name: '',
      }),
    ).toHaveTextContent('A revised choice is selected')
    expect(completeButton).toBeDisabled()

    const enabledRecommit = screen
      .getAllByRole('button', { name: 'Revise and recommit' })
      .find((button) => !button.hasAttribute('disabled'))
    expect(enabledRecommit).toBeDefined()
    await user.click(enabledRecommit as HTMLButtonElement)

    expect(onDecisionCommitted).toHaveBeenLastCalledWith({
      caseId: 'test-curved-airway',
      choiceId: 'force-first',
      decisionId: 'opening-plan',
      initial: true,
      revised: true,
    })
    expect(completeButton).toBeDisabled()

    await user.click(
      screen.getByRole('radio', {
        name: 'Inspect fit, landing zones, and branch relationships',
      }),
    )
    const correctRecommit = screen
      .getAllByRole('button', { name: 'Revise and recommit' })
      .find((button) => !button.hasAttribute('disabled'))
    expect(correctRecommit).toBeDefined()
    await user.click(correctRecommit as HTMLButtonElement)

    expect(onDecisionCommitted).toHaveBeenLastCalledWith({
      caseId: 'test-curved-airway',
      choiceId: 'fit-first',
      decisionId: 'opening-plan',
      initial: true,
      revised: true,
    })
    expect(completeButton).toBeEnabled()

    await user.click(completeButton)

    expect(onComplete).toHaveBeenCalledWith('test-curved-airway')
    expect(onPhysicsLensOpen).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Case completed' })).toBeDisabled()
    expect(
      screen.getByText(
        'Fit, surveillance, and an exit strategy remain linked throughout the plan.',
      ),
    ).toBeVisible()
  })

  it('gates completion on required manipulate and surveillance interactions', async () => {
    const user = userEvent.setup()
    const onComplete = jest.fn()
    const { rerender } = render(
      <ClinicalCaseFlow
        caseData={caseWithLens}
        completedInteractionIds={['inspect-deformation']}
        requiredInteractionIds={['inspect-deformation', 'surveillance-plan']}
        onComplete={onComplete}
      />,
    )

    await commitOpeningDecision(user)
    await user.click(
      screen.getByRole('radio', {
        name: 'Reassess fit, symptoms, patency, and the ongoing indication',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    const completeButton = screen.getByRole('button', { name: 'Complete clinical case' })
    expect(screen.getByText('1 of 2 required clinical interactions complete')).toBeVisible()
    expect(completeButton).toBeDisabled()

    rerender(
      <ClinicalCaseFlow
        caseData={caseWithLens}
        completedInteractionIds={['inspect-deformation', 'surveillance-plan']}
        requiredInteractionIds={['inspect-deformation', 'surveillance-plan']}
        onComplete={onComplete}
      />,
    )

    expect(screen.getByText('2 of 2 required clinical interactions complete')).toBeVisible()
    expect(completeButton).toBeEnabled()
    await user.click(completeButton)
    expect(onComplete).toHaveBeenCalledWith('test-curved-airway')
  })

  it('requires a controlled surveillance or exit commitment for every required case', async () => {
    const user = userEvent.setup()
    const onComplete = jest.fn()
    const onSurveillancePlanCompleted = jest.fn()
    const requiredNoDeviceCase: StentClinicalCase = {
      ...caseWithLens,
      id: 'required-no-device-case',
      requiredForLesson: true,
      surveillancePlanMode: 'no-device',
    }
    const { rerender } = render(
      <ClinicalCaseFlow
        caseData={requiredNoDeviceCase}
        onComplete={onComplete}
        onSurveillancePlanCompleted={onSurveillancePlanCompleted}
      />,
    )

    await commitOpeningDecision(user)
    await user.click(
      screen.getByRole('radio', {
        name: 'Reassess fit, symptoms, patency, and the ongoing indication',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    const surveillanceHeading = screen.getByRole('heading', {
      name: 'Prescribe reassessment and the conditions for reconsidering a stent',
    })
    const surveillanceSection = surveillanceHeading.closest('section')
    expect(surveillanceSection).not.toBeNull()
    expect(
      within(surveillanceSection as HTMLElement).getByText(
        /does not create a device-surveillance obligation/i,
      ),
    ).toBeVisible()
    expect(
      screen.queryByText(/initial examination at approximately 4–6 weeks/i),
    ).not.toBeInTheDocument()

    const completeButton = screen.getByRole('button', { name: 'Complete clinical case' })
    expect(completeButton).toBeDisabled()

    for (const checkbox of within(surveillanceSection as HTMLElement).getAllByRole('checkbox')) {
      await user.click(checkbox)
    }
    await user.click(
      within(surveillanceSection as HTMLElement).getByRole('button', {
        name: 'Commit surveillance plan',
      }),
    )

    expect(onSurveillancePlanCompleted).toHaveBeenCalledTimes(1)
    expect(completeButton).toBeDisabled()

    rerender(
      <ClinicalCaseFlow
        caseData={requiredNoDeviceCase}
        onComplete={onComplete}
        onSurveillancePlanCompleted={onSurveillancePlanCompleted}
        surveillancePlanCompleted
      />,
    )

    expect(completeButton).toBeEnabled()
    await user.click(completeButton)
    expect(onComplete).toHaveBeenCalledWith('required-no-device-case')
  })

  it('keeps the lens collapsed by default and opening it does not complete the case', async () => {
    const user = userEvent.setup()
    const onComplete = jest.fn()
    const onPhysicsLensOpen = jest.fn()
    render(
      <ClinicalCaseFlow
        caseData={caseWithLens}
        onComplete={onComplete}
        onPhysicsLensOpen={onPhysicsLensOpen}
      />,
    )

    await commitOpeningDecision(user)

    const lensTrigger = screen.getByRole('button', {
      name: /Where could a curved airway create repeated end contact\?/i,
    })
    expect(lensTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('mock-stent-architecture-viewport')).not.toBeInTheDocument()

    await user.click(lensTrigger)

    expect(lensTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByTestId('mock-stent-architecture-viewport')).toBeVisible()
    expect(onPhysicsLensOpen).toHaveBeenCalledWith('test-curved-airway')
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Complete clinical case' })).toBeDisabled()
  })

  it('rehydrates a completed case with its defensible decisions and debrief', () => {
    const onDecisionCommitted = jest.fn()
    render(
      <ClinicalCaseFlow
        caseData={caseWithLens}
        initiallyCompleted
        onDecisionCommitted={onDecisionCommitted}
      />,
    )

    expect(screen.getByText('The target segment has a pronounced curve.')).toBeVisible()
    expect(screen.getAllByText('Defensible choice')).toHaveLength(caseWithLens.decisions.length)
    expect(screen.getByRole('button', { name: 'Case completed' })).toBeDisabled()
    expect(screen.getByText(caseWithLens.finalTakeaway)).toBeVisible()
    expect(onDecisionCommitted).not.toHaveBeenCalled()
  })
})

describe('PhysicsLensDrawer', () => {
  beforeEach(() => {
    installMatchMedia(false)
  })

  it('provides observation prompts, a text equivalent, and an evidence boundary', async () => {
    const user = userEvent.setup()
    const onOpen = jest.fn()
    render(<PhysicsLensDrawer config={physicsLens} onOpen={onOpen} />)

    const trigger = screen.getByRole('button', {
      name: /Where could a curved airway create repeated end contact\?/i,
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/Optional and collapsed by default/i)).toBeVisible()
    expect(screen.queryByText(/Inspect the inner curve for gapping\./)).not.toBeInTheDocument()

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByTestId('mock-stent-architecture-viewport')).toBeVisible()
    expect(screen.getByText(/Inspect the inner curve for gapping\./)).toBeVisible()
    expect(screen.getByText('Text equivalent and debrief')).toBeVisible()
    expect(screen.getByText(physicsLens.debrief)).toBeVisible()
    expect(
      screen.getByText(/This authored scene does not calculate tissue pressure/i),
    ).toBeVisible()
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('shows a static, disabled motion control when reduced motion is requested', async () => {
    installMatchMedia(true)
    const user = userEvent.setup()
    render(<PhysicsLensDrawer config={physicsLens} />)

    await user.click(
      screen.getByRole('button', {
        name: /Where could a curved airway create repeated end contact\?/i,
      }),
    )

    expect(await screen.findByRole('button', { name: 'Static pose shown' })).toBeDisabled()
    expect(await screen.findByTestId('mock-stent-architecture-viewport')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )
  })
})

describe('GranulationCase', () => {
  it('teaches a multifactorial differential without presenting a deterministic equation', async () => {
    const user = userEvent.setup()
    const onDifferentialCompleted = jest.fn()
    render(<GranulationCase onDifferentialCompleted={onDifferentialCompleted} />)

    expect(screen.getByText('Plausible multifactorial pathway')).toBeVisible()
    expect(screen.getByText('Fit, contact, and motion')).toBeVisible()
    expect(screen.getByText('Secretions, colonization, and infection')).toBeVisible()
    expect(screen.getByText('Wound healing, host biology, and time')).toBeVisible()
    expect(screen.getByText(/not a validated patient-specific equation/i)).toBeVisible()
    expect(
      screen.getByText(/does not calculate tissue pressure, assign a complication probability/i),
    ).toBeVisible()

    await user.click(screen.getByRole('checkbox', { name: 'Granulation tissue' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Infection or biofilm-associated obstruction' }),
    )

    expect(screen.getByRole('heading', { name: 'Granulation tissue' })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Infection or biofilm-associated obstruction' }),
    ).toBeVisible()
    expect(screen.getByText(/More than one process can coexist/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Commit differential' }))
    expect(onDifferentialCompleted).toHaveBeenCalledWith(['granulation', 'infection'])
  })
})
