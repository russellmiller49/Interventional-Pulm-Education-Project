import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  CitrateCalciumDashboardScaffold,
  CrrtPhase7InstructionalTools,
  FluidBalanceLedger,
  QualitativeEffluentExplorer,
  TransportMechanismLab,
} from '../components/CrrtPhase7InstructionalTools'
import {
  calculateSyntheticFluidLedger,
  calculateSyntheticTransport,
  fluidLedgerCandidateSourceIds,
  qualitativeEffluentProfiles,
  transportMechanismCandidateSourceIds,
} from '../instructionalToolsModel'

const transportInputs = {
  concentrationDifferenceLevel: 60,
  diffusivePassageLevel: 70,
  waterMovementLevel: 40,
  convectivePassageLevel: 50,
  adsorptiveAffinityLevel: 60,
  availableBindingSurfaceLevel: 80,
  moleculeClass: 'small-analogue' as const,
  flowArrangement: 'countercurrent' as const,
}

describe('Phase 7 reviewer-only instructional tool models', () => {
  it('calculates bounded, unitless transport indices without clinical outputs', () => {
    expect(calculateSyntheticTransport(transportInputs)).toEqual({
      diffusionIndex: 42,
      convectionIndex: 20,
      ultrafiltrationIndex: 40,
      adsorptionIndex: 48,
      comparisonText: 'The diffusion index is higher in this synthetic configuration.',
      moleculeObservation:
        'Within this authored analogue, the small-molecule label is paired with greater relative diffusive mobility; this is not a prediction for a named solute or membrane.',
      flowObservation:
        'In this conceptual path, countercurrent blood and dialysate streams run in opposite directions and the authored concentration difference is sustained along more of the path; no device performance is predicted.',
      adsorptionObservation:
        'The adsorption index reflects both synthetic binding affinity and available membrane surface; it is not a clearance estimate.',
    })

    expect(() =>
      calculateSyntheticTransport({
        ...transportInputs,
        concentrationDifferenceLevel: 101,
      }),
    ).toThrow(/must not exceed 100/i)
  })

  it('maps all four modalities without quantitative targets or outcome claims', () => {
    expect(Object.keys(qualitativeEffluentProfiles)).toEqual(['scuf', 'cvvh', 'cvvhd', 'cvvhdf'])
    expect(qualitativeEffluentProfiles.scuf.mechanismLabels).toEqual(['ultrafiltration'])
    expect(qualitativeEffluentProfiles.cvvhdf.mechanismLabels).toEqual([
      'diffusion',
      'ultrafiltration',
      'convection',
    ])

    for (const profile of Object.values(qualitativeEffluentProfiles)) {
      expect(profile.terms).toHaveLength(3)
      expect(`${profile.summary} ${profile.boundary}`).not.toMatch(/recommended|target rate/i)
    }
  })

  it('keeps machine removal separate while conserving the whole-patient ledger', () => {
    expect(
      calculateSyntheticFluidLedger({
        durationHours: 2,
        externalInputMlHour: 150,
        externalOutputMlHour: 45,
        machinePatientFluidRemovalMlHour: 75,
      }),
    ).toEqual({
      externalInputMl: 300,
      externalOutputMl: 90,
      machinePatientFluidRemovalMl: 150,
      combinedOutputMl: 240,
      wholePatientNetBalanceMl: 60,
      direction: 'positive',
    })
  })

  it('keeps each instructional model tied to an explicit pending candidate-source set', () => {
    expect(transportMechanismCandidateSourceIds).toEqual([
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'SYNTH-LAB-TRANSPORT-001',
    ])
    expect(fluidLedgerCandidateSourceIds).toEqual([
      'FLUID-PM-001',
      'FLUID-PM-002',
      'WHITE-2024',
      'GONEUTRAL-2024',
      'SYNTH-LAB-FLUID-001',
    ])
  })
})

describe('Phase 7 reviewer-only instructional tool UI', () => {
  beforeEach(() => window.localStorage.clear())

  it('exposes an explicit reviewer boundary and has no progress persistence behavior', () => {
    const { container } = render(<CrrtPhase7InstructionalTools />)

    const tools = screen.getByRole('region', {
      name: 'Concept labs—isolated from learner runtime',
    })
    expect(tools).toHaveAttribute('data-reviewer-only', 'true')
    expect(tools).toHaveAttribute('data-review-status', 'pending')
    expect(tools).toHaveAttribute('data-scoring', 'none')
    expect(tools).toHaveAttribute('data-progress-write', 'none')
    expect(tools).toHaveAttribute('data-persistence', 'none')
    expect(within(tools).getByRole('note', { name: 'Reviewer-only boundary' })).toHaveTextContent(
      'Reviewer-only and pending multidisciplinary approval.',
    )
    expect(within(tools).getAllByText('Reviewer-only · pending')).toHaveLength(2)
    expect(within(tools).getAllByLabelText('Candidate source records')).toHaveLength(3)
    for (const sourceId of [
      ...transportMechanismCandidateSourceIds,
      ...fluidLedgerCandidateSourceIds,
    ]) {
      expect(within(tools).getByText(sourceId)).toBeVisible()
    }
    expect(within(tools).getByText(/do not validate the unitless index formulas/i)).toBeVisible()
    expect(within(tools).getByText(/do not validate the synthetic values/i)).toBeVisible()
    expect(container.querySelector('form')).not.toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('keeps each standalone tool reviewer-only, non-scoring, and non-persistent', () => {
    render(
      <>
        <TransportMechanismLab />
        <FluidBalanceLedger />
        <CitrateCalciumDashboardScaffold />
      </>,
    )

    for (const name of [
      'Transport Mechanism Lab',
      'Fluid Balance Ledger',
      'Citrate-Calcium Dashboard scaffold',
    ]) {
      const tool = screen.getByRole('region', { name })
      expect(tool).toHaveAttribute('data-reviewer-only', 'true')
      expect(tool).toHaveAttribute('data-review-status', 'pending')
      expect(tool).toHaveAttribute('data-scoring', 'none')
      expect(tool).toHaveAttribute('data-progress-write', 'none')
      expect(tool).toHaveAttribute('data-persistence', 'none')
    }
    expect(window.localStorage).toHaveLength(0)
  })

  it('shows a linked citrate-calcium domain scaffold without parameters or actions', () => {
    const { container } = render(<CitrateCalciumDashboardScaffold />)

    const dashboard = screen.getByRole('region', {
      name: 'Citrate-Calcium Dashboard scaffold',
    })
    expect(dashboard).toHaveAttribute('data-protocol-blocked', 'true')
    expect(
      within(dashboard).getByRole('note', { name: 'Protocol-blocked status' }),
    ).toHaveTextContent('No local protocol is loaded.')
    expect(
      within(dashboard).getByRole('list', { name: 'Blocked citrate-calcium domains' }),
    ).toHaveTextContent('Circuit monitoring domain')
    expect(within(dashboard).getAllByText('Unavailable')).toHaveLength(7)
    expect(within(dashboard).getAllByText('No parameters loaded')).toHaveLength(7)
    expect(within(dashboard).getByText('Not implemented')).toBeVisible()
    expect(within(dashboard).getByText('Disabled')).toBeVisible()
    expect(within(dashboard).getByText('PROTO-001')).toBeVisible()
    expect(within(dashboard).getByText('SAFETY-012')).toBeVisible()
    expect(container.querySelector('form, input, select, button')).not.toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('updates the transport comparison from keyboard-accessible range controls', () => {
    render(<TransportMechanismLab />)

    const concentration = screen.getByRole('slider', {
      name: 'Concentration difference (synthetic level)',
    })
    const waterMovement = screen.getByRole('slider', {
      name: 'Pressure-driven water movement (synthetic level)',
    })
    expect(concentration).toHaveAttribute('aria-describedby')
    expect(
      screen.getByText(
        'Diffusion 42.0; convection 20.0; ultrafiltration 40.0; adsorption 48.0. The diffusion index is higher in this synthetic configuration.',
      ),
    ).toBeInTheDocument()

    fireEvent.change(concentration, { target: { value: '20' } })
    fireEvent.change(waterMovement, { target: { value: '80' } })

    expect(
      screen.getByText(
        'Diffusion 14.0; convection 40.0; ultrafiltration 80.0; adsorption 48.0. The convection index is higher in this synthetic configuration.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Diffusion index: 14.0 out of 100 synthetic index points' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/does not calculate clearance, effluent dose, membrane capacity/i),
    ).toBeInTheDocument()
  })

  it('updates qualitative molecule, flow-direction, and adsorption observations', () => {
    render(<TransportMechanismLab />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Illustrative molecule class' }), {
      target: { value: 'middle-analogue' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Blood/dialysate path relationship' }), {
      target: { value: 'concurrent' },
    })
    fireEvent.change(
      screen.getByRole('slider', { name: 'Available binding surface (synthetic level)' }),
      {
        target: { value: '20' },
      },
    )

    expect(
      screen.getByText(/middle-molecule label is paired with less relative/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/concurrent blood and dialysate streams run in the same direction/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/adsorption index is constrained by limited available/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Adsorption index: 12.0 out of 100 synthetic index points' }),
    ).toBeInTheDocument()
  })

  it('provides keyboard-native qualitative effluent maps for SCUF, CVVH, CVVHD, and CVVHDF', () => {
    render(<QualitativeEffluentExplorer />)

    const explorer = screen.getByRole('region', {
      name: 'What can contribute to collected effluent?',
    })
    expect(within(explorer).getByRole('radio', { name: 'SCUF' })).toBeChecked()
    expect(
      within(explorer).getByRole('heading', { name: 'SCUF conceptual effluent map' }),
    ).toBeInTheDocument()
    expect(
      within(explorer).getByText(/collected effluent is membrane ultrafiltrate/i),
    ).toBeInTheDocument()

    fireEvent.click(within(explorer).getByRole('radio', { name: 'CVVH' }))
    expect(
      within(explorer).getByRole('heading', { name: 'CVVH conceptual effluent map' }),
    ).toBeInTheDocument()
    expect(
      within(explorer).getByText(/collected effluent is convective ultrafiltrate/i),
    ).toBeInTheDocument()

    fireEvent.click(within(explorer).getByRole('radio', { name: 'CVVHD' }))
    expect(
      within(explorer).getByText(/contains spent dialysate and may also include/i),
    ).toBeInTheDocument()

    fireEvent.click(within(explorer).getByRole('radio', { name: 'CVVHDF' }))
    expect(
      within(explorer).getByRole('heading', { name: 'CVVHDF conceptual effluent map' }),
    ).toBeInTheDocument()
    expect(
      within(explorer).getByText(/combines spent dialysate and ultrafiltrate/i),
    ).toBeInTheDocument()
    expect(
      within(explorer).getByText(
        /Effluent volume and patient-fluid removal are not interchangeable/i,
      ),
    ).toBeInTheDocument()
  })

  it('updates the ledger and provides a text-equivalent balance explanation', () => {
    render(<FluidBalanceLedger />)

    const tableRegion = screen.getByRole('region', {
      name: 'Synthetic fluid ledger; horizontally scrollable',
    })
    expect(tableRegion).toHaveAttribute('tabindex', '0')
    expect(within(tableRegion).getByRole('table')).toHaveAccessibleName(
      'Integrated volumes for the modeled interval',
    )
    expect(screen.getByText('+60 mL')).toBeInTheDocument()
    expect(
      screen.getByText('Modeled inputs exceed combined modeled outputs by 60 mL in this exercise.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole('spinbutton', { name: 'All external inputs (mL/hour)' }), {
      target: { value: '40' },
    })

    expect(screen.getByText('−160 mL')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Combined modeled outputs exceed modeled inputs by 160 mL in this exercise.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/do not establish a fluid goal, prescription/i)).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })
})
