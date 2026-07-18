import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  CitrateCalciumDashboardScaffold,
  CrrtPhase7InstructionalTools,
  FluidBalanceLedger,
  TransportMechanismLab,
} from '../components/CrrtPhase7InstructionalTools'
import { baxterCrrtInstructionalToolManifest } from '../content'
import {
  calculateSyntheticFluidLedger,
  calculateSyntheticTransport,
  qualitativeEffluentProfiles,
} from '../instructionalToolsModel'

describe('learner instructional tools', () => {
  beforeEach(() => window.localStorage.clear())

  it('registers exactly six learner-available tools and keeps unresolved expressions local', () => {
    expect(baxterCrrtInstructionalToolManifest).toHaveLength(6)
    expect(baxterCrrtInstructionalToolManifest.map((tool) => tool.id)).toEqual([
      'LAB-TRANSPORT',
      'LAB-PRESCRIPTION',
      'LAB-PREPOST-DILUTION',
      'LAB-PRESSURE-LOCALIZATION',
      'LAB-FLUID-LEDGER',
      'LAB-CITRATE-DASHBOARD',
    ])
    expect(
      baxterCrrtInstructionalToolManifest.every(
        (tool) => tool.learnerAvailable && tool.progressPersistenceAvailable,
      ),
    ).toBe(true)
    expect(
      baxterCrrtInstructionalToolManifest.find((tool) => tool.id === 'LAB-PRESCRIPTION')
        ?.unavailableExpressions,
    ).toHaveLength(2)
  })

  it('renders all six artifacts in the learner workspace without reviewer-only gates', () => {
    render(<CrrtPhase7InstructionalTools />)

    const tools = screen.getByRole('region', { name: 'Interactive concept labs' })
    expect(tools).toHaveAttribute('data-reviewer-only', 'false')
    expect(tools).toHaveAttribute('data-analytics', 'allowlisted')
    expect(tools).toHaveAttribute('data-progress-write', 'learner-mode-only')
    for (const heading of [
      'Transport Mechanism Lab',
      'Full Prescription Workbench',
      'Pre- versus post-dilution split',
      'Pressure Localization Lab',
      'Fluid Balance Ledger',
      'Conceptual Citrate-Calcium Dashboard',
    ]) {
      expect(within(tools).getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(within(tools).getByText('Unavailable outputs')).toBeInTheDocument()
  })

  it('keeps transport and fluid calculations synthetic, bounded, and conservative', () => {
    expect(
      calculateSyntheticTransport({
        concentrationDifferenceLevel: 60,
        diffusivePassageLevel: 70,
        waterMovementLevel: 40,
        convectivePassageLevel: 50,
        adsorptiveAffinityLevel: 60,
        availableBindingSurfaceLevel: 80,
        moleculeClass: 'small-analogue',
        flowArrangement: 'countercurrent',
      }),
    ).toMatchObject({
      diffusionIndex: 42,
      convectionIndex: 20,
      ultrafiltrationIndex: 40,
      adsorptionIndex: 48,
    })
    expect(Object.keys(qualitativeEffluentProfiles)).toEqual(['scuf', 'cvvh', 'cvvhd', 'cvvhdf'])
    expect(
      calculateSyntheticFluidLedger({
        durationHours: 2,
        externalInputMlHour: 150,
        externalOutputMlHour: 45,
        machinePatientFluidRemovalMlHour: 75,
      }),
    ).toMatchObject({
      externalInputMl: 300,
      combinedOutputMl: 240,
      wholePatientNetBalanceMl: 60,
    })
  })

  it('allows keyboard-native learner interaction in transport and fluid tools', () => {
    render(
      <>
        <TransportMechanismLab />
        <FluidBalanceLedger />
      </>,
    )
    const concentration = screen.getByRole('slider', {
      name: 'Concentration difference (relative level)',
    })
    fireEvent.change(concentration, { target: { value: '20' } })
    expect(
      screen.getByRole('img', { name: 'Diffusion index: 14.0 out of 100 relative scale points' }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole('spinbutton', { name: /All external inputs/i }), {
      target: { value: '200' },
    })
    expect(screen.getByText(/Whole-patient net balance/i)).toBeInTheDocument()
  })

  it('makes citrate direction-only and requires safety checks before escalation', () => {
    const { container } = render(<CitrateCalciumDashboardScaffold />)
    const dashboard = screen.getByRole('region', {
      name: 'Conceptual Citrate-Calcium Dashboard',
    })
    expect(dashboard).toHaveAttribute('data-conceptual-only', 'true')
    expect(within(dashboard).getAllByRole('combobox')).toHaveLength(4)
    expect(within(dashboard).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('slider')).not.toBeInTheDocument()
    expect(container.querySelector('[name*="dose"], [name*="target"], [name*="adjust"]')).toBeNull()

    const escalation = within(dashboard).getByRole('button', {
      name: 'Record escalation and reassessment',
    })
    expect(escalation).toBeDisabled()
    for (const check of within(dashboard).getAllByRole('checkbox')) fireEvent.click(check)
    expect(escalation).toBeEnabled()
    fireEvent.click(escalation)
    expect(within(dashboard).getByRole('status')).toHaveTextContent(/responsible clinical team/i)
  })
})
