import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MechanismScenarioLab } from '../components/clinical/MechanismScenarioLab'
import { getMechanismScenario } from '../content/mechanismScenarioRegistry'

describe('MechanismScenarioLab', () => {
  it('requires a prediction and all contributor checks before revealing the cough consequence', async () => {
    const user = userEvent.setup()
    const onPredictionCommitted = jest.fn()
    const onObservationCommitted = jest.fn()
    const onArchitectureCompleted = jest.fn()
    const onCompleted = jest.fn()
    const scenario = getMechanismScenario('cough-interface-response')

    render(
      <MechanismScenarioLab
        scenario={scenario}
        onArchitectureCompleted={onArchitectureCompleted}
        onPredictionCommitted={onPredictionCommitted}
        onObservationCommitted={onObservationCommitted}
        onCompleted={onCompleted}
      />,
    )

    expect(screen.getByTestId('mechanism-scenario-scene')).toHaveAttribute('data-motion', 'static')
    expect(screen.getAllByText('Locked until prediction')).toHaveLength(3)
    expect(
      screen.queryByText(/diameter-length coupling with axial end excursion/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Multifactorial interpretation retained')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advance scenario' })).toBeDisabled()

    await user.click(
      screen.getByRole('radio', {
        name: 'Identify architecture-specific motion, then assess the full interface context',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(onPredictionCommitted).toHaveBeenCalledWith({
      scenarioId: 'cough-interface-response',
      architectureFamily: 'braided-self-expanding-scaffold',
      predictionId: 'predict-architecture-plus-context',
    })
    expect(screen.getAllByText('Compare a cough excursion')).toHaveLength(2)
    expect(screen.getByText(/diameter-length coupling with axial end excursion/i)).toBeVisible()
    expect(screen.getByText(/possible foreshortening as braid geometry changes/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Advance scenario' }))

    const advanceButton = screen.getByRole('button', { name: 'Advance scenario' })
    expect(screen.getAllByText('Inspect the full tissue-response context')).toHaveLength(2)
    expect(advanceButton).toBeDisabled()

    for (const label of [
      'End contact and interface motion',
      'Secretions, colonization, or infection',
      'Dwell time and changing indication',
      'Host and wound-healing response',
    ]) {
      const checkbox = screen.getByRole('checkbox', { name: new RegExp(label, 'i') })
      checkbox.focus()
      await user.keyboard('[Space]')
      expect(checkbox).toBeChecked()
    }

    expect(advanceButton).toBeEnabled()
    expect(onObservationCommitted).toHaveBeenCalledTimes(4)
    expect(onObservationCommitted).toHaveBeenCalledWith({
      scenarioId: 'cough-interface-response',
      observationId: 'host-response',
    })
    await user.click(advanceButton)

    expect(screen.getAllByText('Reveal a multifactorial tissue response')).toHaveLength(2)
    expect(screen.getByText('Multifactorial interpretation retained')).toBeVisible()
    expect(screen.getByText(/no single cause assigned/i)).toBeVisible()
    expect(screen.getByText(/insufficient causal evidence for granulation/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Complete architecture and continue' }))

    expect(onArchitectureCompleted).toHaveBeenCalledWith({
      scenarioId: 'cough-interface-response',
      architectureFamily: 'braided-self-expanding-scaffold',
      consequenceId: 'cough-multifactorial-response',
    })
    expect(onCompleted).not.toHaveBeenCalled()
    expect(screen.getByText(/1 of 2 completed/i)).toBeVisible()
    expect(screen.getByRole('radio', { name: /Continuous-wall silicone tube/i })).toBeChecked()
    expect(screen.getAllByText('Establish the resting interface')).toHaveLength(2)

    await user.click(
      screen.getByRole('radio', {
        name: 'Identify architecture-specific motion, then assess the full interface context',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))
    await user.click(screen.getByRole('button', { name: 'Advance scenario' }))

    for (const label of [
      'End contact and interface motion',
      'Secretions, colonization, or infection',
      'Dwell time and changing indication',
      'Host and wound-healing response',
    ]) {
      await user.click(screen.getByRole('checkbox', { name: new RegExp(label, 'i') }))
    }

    await user.click(screen.getByRole('button', { name: 'Advance scenario' }))
    await user.click(screen.getByRole('button', { name: 'Complete scenario' }))

    expect(onArchitectureCompleted).toHaveBeenLastCalledWith({
      scenarioId: 'cough-interface-response',
      architectureFamily: 'solid-silicone-tube',
      consequenceId: 'cough-multifactorial-response',
    })
    expect(onArchitectureCompleted).toHaveBeenCalledTimes(2)
    expect(onCompleted).toHaveBeenCalledWith({
      scenarioId: 'cough-interface-response',
      architectureFamily: 'solid-silicone-tube',
      consequenceId: 'cough-multifactorial-response',
    })
    expect(onObservationCommitted).toHaveBeenCalledTimes(8)
    expect(screen.getByText(/2 of 2 completed/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Scenario completed' })).toBeDisabled()
  })

  it('resets revealed content and uses solid-wall motion when architecture changes', async () => {
    const user = userEvent.setup()
    const scenario = getMechanismScenario('cough-interface-response')

    render(<MechanismScenarioLab scenario={scenario} />)

    await user.click(
      screen.getByRole('radio', {
        name: 'Identify architecture-specific motion, then assess the full interface context',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))
    expect(screen.getByText(/diameter-length coupling with axial end excursion/i)).toBeVisible()

    await user.click(screen.getByRole('radio', { name: /Continuous-wall silicone tube/i }))

    expect(screen.getAllByText('Establish the resting interface')).toHaveLength(2)
    expect(screen.queryByText('Committed interpretation')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advance scenario' })).toBeDisabled()
    expect(
      screen.queryByText(/diameter-length coupling with axial end excursion/i),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('radio', {
        name: 'Identify architecture-specific motion, then assess the full interface context',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(screen.getByText(/whole-device sliding; solid-wall length is unchanged/i)).toBeVisible()
    expect(screen.getByText(/whole-device sliding or migration/i)).toBeVisible()
    expect(screen.getByText(/wire-scaffold foreshortening/i)).toBeVisible()
  })
})
