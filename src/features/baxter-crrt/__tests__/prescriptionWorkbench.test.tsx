import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtPrescriptionWorkbench } from '../components/CrrtPrescriptionWorkbench'
import {
  calculatePrescriptionWorkbench,
  calculateQualitativePrePostDilution,
  type PrescriptionWorkbenchInputs,
} from '../prescriptionWorkbenchModel'

const VALID_INPUTS: PrescriptionWorkbenchInputs = Object.freeze({
  simulatedWeightKg: 70,
  hematocritPercent: 30,
  bloodFlowMlPerMinute: 100,
  preBloodPumpMlPerHour: 200,
  dialysateMlPerHour: 1_000,
  preReplacementMlPerHour: 300,
  postReplacementMlPerHour: 500,
  patientFluidRemovalMlPerHour: 100,
  anticoagulationConcept: 'none',
  solutionProfileId: null,
  syntheticBagCapacityMl: null,
  syntheticBagStream: 'dialysate',
})

describe('learner prescription workbench model', () => {
  it('reuses source-backed math and keeps the requested output boundaries explicit', () => {
    const result = calculatePrescriptionWorkbench(VALID_INPUTS)

    expect(result.effluentPumpTargetMlPerHour).toBe(2_100)
    expect(result.effluentDoseMlPerKgHour).toBe(30)
    expect(result.plasmaFlowMlPerHour).toBe(4_200)
    expect(result.machinePatientFluidRemovalTermMlPerHour).toBe(100)
    expect(result.aggregateSourcePumpThroughputMlPerDay).toBe(48_000)
    expect(result.totalPredilutionFraction).toBe(0.5)
    expect(result.syntheticBagDuration).toBeNull()
    expect(result.unavailableOutputs.map((output) => output.id)).toEqual([
      'effective-clearance',
      'total-circuit-ultrafiltration',
      'quantitative-ff',
      'whole-patient-net-removal',
    ])
    expect(result.unavailableOutputs[1]?.sourceRecordIds).toEqual(['MATH-PM-004'])
    expect(result.unavailableOutputs[2]?.sourceRecordIds).toEqual(['MATH-PM-003', 'MATH-PM-006'])
    expect(result.unavailableOutputs[3]?.sourceRecordIds).toEqual(['FLUID-PM-001', 'FLUID-PM-002'])
    expect(result.sourceRecordIds).toEqual(
      expect.arrayContaining(['SYNTH-LAB-PRESCRIPTION-001', 'SYNTH-LAB-PREPOST-001']),
    )
  })

  it('calculates bag duration only from an explicitly synthetic capacity and selected active stream', () => {
    const available = calculatePrescriptionWorkbench({
      ...VALID_INPUTS,
      syntheticBagCapacityMl: 5_000,
    }).syntheticBagDuration

    expect(available).toMatchObject({
      status: 'available',
      stream: 'dialysate',
      capacityMl: 5_000,
      streamRateMlPerHour: 1_000,
      durationHours: 5,
    })
    expect(available?.limitation).toMatch(/teaching-only/i)

    const unavailable = calculatePrescriptionWorkbench({
      ...VALID_INPUTS,
      dialysateMlPerHour: 0,
      syntheticBagCapacityMl: 5_000,
    }).syntheticBagDuration

    expect(unavailable).toMatchObject({
      status: 'unavailable-zero-stream',
      durationHours: null,
      streamRateMlPerHour: 0,
    })
  })

  it('fails closed for unapproved anticoagulation and solution profiles', () => {
    expect(() =>
      calculatePrescriptionWorkbench({
        ...VALID_INPUTS,
        anticoagulationConcept: 'systemic' as never,
      }),
    ).toThrow(/must remain none/i)

    expect(() =>
      calculatePrescriptionWorkbench({
        ...VALID_INPUTS,
        solutionProfileId: 'local-solution' as never,
      }),
    ).toThrow(/must remain null/i)
  })

  it('rejects invalid patient and flow entries rather than normalizing them silently', () => {
    expect(() => calculatePrescriptionWorkbench({ ...VALID_INPUTS, simulatedWeightKg: 0 })).toThrow(
      /greater than zero/i,
    )
    expect(() =>
      calculatePrescriptionWorkbench({ ...VALID_INPUTS, hematocritPercent: 100 }),
    ).toThrow(/less than 100/i)
    expect(() =>
      calculatePrescriptionWorkbench({ ...VALID_INPUTS, dialysateMlPerHour: -1 }),
    ).toThrow(/zero or greater/i)
  })

  it('changes only transparent unitless and qualitative tendencies with the pre/post split', () => {
    expect(calculateQualitativePrePostDilution(600, 200)).toMatchObject({
      direction: 'pre-dominant',
      totalReplacementMlPerHour: 800,
      preReplacementShare: 0.75,
      postReplacementShare: 0.25,
      filterInletConcentrationSplitIndex: 0.25,
      filtrationFractionBurdenProxy: 'lower',
      effectiveClearanceTendencyProxy: 'lower',
      foulingTendencyProxy: 'lower',
      proxyStatus: 'authored-qualitative-proxy-source-limited',
    })
    expect(calculateQualitativePrePostDilution(200, 600)).toMatchObject({
      direction: 'post-dominant',
      filterInletConcentrationSplitIndex: 0.75,
      filtrationFractionBurdenProxy: 'higher',
      effectiveClearanceTendencyProxy: 'higher',
      foulingTendencyProxy: 'higher',
    })
    expect(calculateQualitativePrePostDilution(400, 400)).toMatchObject({
      direction: 'equal-split',
      filterInletConcentrationSplitIndex: 0.5,
      filtrationFractionBurdenProxy: 'middle',
    })
    expect(calculateQualitativePrePostDilution(0, 0)).toMatchObject({
      direction: 'not-active',
      filterInletConcentrationSplitIndex: null,
      filtrationFractionBurdenProxy: 'not-applicable',
    })
    expect(calculateQualitativePrePostDilution(600, 200).sourceRecordIds).toEqual([
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'SYNTH-LAB-PREPOST-001',
    ])
    expect(calculateQualitativePrePostDilution(600, 200).omittedVariableCaveat).toMatch(
      /does not model blood flow.*PBP dilution.*anticoagulation/i,
    )
  })
})

describe('learner prescription workbench UI', () => {
  beforeEach(() => window.localStorage.clear())

  it('is learner-available with informational provenance and no competency claim', () => {
    render(<CrrtPrescriptionWorkbench />)

    const workbench = screen.getByRole('region', { name: 'Full Prescription Workbench' })
    expect(workbench).toHaveAttribute('data-reviewer-only', 'false')
    expect(workbench).toHaveAttribute('data-review-metadata', 'informational')
    expect(workbench).toHaveAttribute('data-progress-write', 'learner-mode-only')
    expect(workbench).toHaveAttribute('data-persistence', 'learner-mode-only')
    expect(workbench).toHaveAttribute('data-scoring', 'tool-specific')
    expect(workbench).toHaveAttribute('data-competency', 'none')
    expect(
      within(workbench).getByRole('note', { name: 'Educational calculation boundary' }),
    ).toHaveTextContent(/calculation practice.*not for patient care/i)
    expect(window.localStorage).toHaveLength(0)
  })

  it('emits completion evidence only after an input change is followed by output inspection', () => {
    const onCompletionEvidence = jest.fn()
    render(<CrrtPrescriptionWorkbench onCompletionEvidence={onCompletionEvidence} />)

    const outputs = screen.getByRole('region', { name: 'Educational calculation outputs' })
    fireEvent.focus(outputs)
    expect(onCompletionEvidence).not.toHaveBeenCalled()

    fireEvent.blur(outputs)
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Dialysate flow/ }), {
      target: { value: '1200' },
    })
    expect(onCompletionEvidence).not.toHaveBeenCalled()

    fireEvent.focus(outputs)
    expect(onCompletionEvidence).toHaveBeenCalledTimes(1)
    fireEvent.focus(outputs)
    expect(onCompletionEvidence).toHaveBeenCalledTimes(1)
  })

  it('permits only no anticoagulation and leaves the solution registry unavailable', () => {
    render(<CrrtPrescriptionWorkbench />)

    const anticoagulation = screen.getByRole('combobox', { name: 'Anticoagulation concept' })
    expect(anticoagulation).toHaveValue('none')
    expect(anticoagulation).toHaveAccessibleDescription(
      'No dosing, target, monitoring, or recommendation is provided.',
    )
    expect(within(anticoagulation).getByRole('option', { name: /Systemic/ })).toBeDisabled()
    expect(within(anticoagulation).getByRole('option', { name: /Regional citrate/ })).toBeDisabled()

    const solution = screen.getByRole('combobox', { name: 'Locally verified solution profile' })
    expect(solution).toBeDisabled()
    expect(solution).toHaveTextContent(/no site profile loaded/i)
    expect(solution).toHaveAccessibleDescription(
      'No composition, bag assignment, compatibility, or local stock is inferred.',
    )

    expect(
      screen.getByRole('combobox', { name: 'Entered stream for division' }),
    ).toHaveAccessibleDescription(
      'Capacity ÷ selected entered rate only; this does not predict scale or alarm behavior.',
    )
  })

  it('renders source-linked arithmetic while keeping disputed outputs visibly unavailable', () => {
    render(<CrrtPrescriptionWorkbench />)

    expect(screen.getByText('2,100 mL/h')).toBeInTheDocument()
    expect(screen.getByText('30 mL/kg/h')).toBeInTheDocument()
    expect(screen.getByText('4,200 mL/h')).toBeInTheDocument()
    expect(screen.getByText('48 L/day')).toBeInTheDocument()
    expect(screen.getAllByText('Unavailable in this workbench')).toHaveLength(4)
    expect(screen.getByText(/do not support estimating effective clearance/i)).toBeInTheDocument()
    expect(screen.getByText(/pre-infusion circuit-flow term is not available/i)).toBeInTheDocument()
    expect(
      screen.getByText(/whole-patient balance also requires patient inputs/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/No target range and no delivered-dose/i)).toBeInTheDocument()
    expect(screen.getByText('Aggregate source-pump/bag throughput')).toBeInTheDocument()
    expect(
      screen.getByText(/dialysate remains separate from blood-side\/patient input/i),
    ).toBeInTheDocument()
  })

  it('updates the accessible qualitative experiment without presenting a best split', () => {
    render(<CrrtPrescriptionWorkbench />)

    fireEvent.change(screen.getByRole('spinbutton', { name: /^Pre-replacement flow/ }), {
      target: { value: '700' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Post-replacement flow/ }), {
      target: { value: '100' },
    })

    expect(
      screen.getByRole('img', {
        name: 'Entered replacement split: 87.5 percent pre-filter and 12.5 percent post-filter',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('0.13')).toBeInTheDocument()
    expect(screen.getAllByText('Lower than inverse split')).toHaveLength(3)
    expect(
      screen.getByText(/Neither connection position is declared universally best/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/quantitative FF is unavailable/i)).toBeInTheDocument()
    expect(screen.getByText('Clinical context')).toBeInTheDocument()
    expect(screen.getByText('Critical-care guidance')).toBeInTheDocument()
    expect(screen.getByText('Comparison boundary')).toBeInTheDocument()
    expect(screen.getByText('Practice-value boundary')).toBeInTheDocument()
    expect(screen.queryByText('REVIEW-CKRT-CORE-2025')).not.toBeInTheDocument()
    expect(screen.queryByText('SYNTH-LAB-PRESCRIPTION-001')).not.toBeInTheDocument()
    expect(
      screen.getByText(/does not model blood flow.*PBP dilution.*anticoagulation/i),
    ).toBeInTheDocument()
  })

  it('keeps invalid raw text and makes every calculated output visibly unavailable', () => {
    render(<CrrtPrescriptionWorkbench />)

    const weight = screen.getByRole('spinbutton', { name: /^Example weight/ })
    fireEvent.change(weight, { target: { value: '' } })

    expect(weight).toHaveValue(null)
    expect(weight).toHaveAttribute('aria-invalid', 'true')
    expect(weight).toHaveAccessibleDescription(/example weight is required/i)
    expect(screen.getAllByText('Unavailable — correct entries')).toHaveLength(6)
    expect(screen.queryByText('2,100 mL/h')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      /all calculated outputs are unavailable.*example weight/i,
    )
    expect(
      screen.getByText(/correct every invalid entry before viewing the qualitative comparison/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Unavailable — correct every invalid entry.')).toBeInTheDocument()

    fireEvent.change(weight, { target: { value: '70' } })
    expect(weight).toHaveValue(70)
    expect(weight).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('2,100 mL/h')).toBeInTheDocument()
    expect(screen.queryByText('Unavailable — correct entries')).not.toBeInTheDocument()
  })

  it('fails all calculated outputs closed for an invalid optional capacity', () => {
    render(<CrrtPrescriptionWorkbench />)

    const capacity = screen.getByRole('spinbutton', { name: /^Practice bag capacity/ })
    fireEvent.change(capacity, { target: { value: '-1' } })

    expect(capacity).toHaveValue(-1)
    expect(capacity).toHaveAttribute('aria-invalid', 'true')
    expect(capacity).toHaveAccessibleDescription(/must be greater than zero/i)
    expect(screen.getAllByText('Unavailable — correct entries')).toHaveLength(6)
    expect(screen.getByRole('status')).toHaveTextContent(/practice bag capacity/i)
  })

  it('fails closed when individually finite entries overflow a derived calculation', () => {
    render(<CrrtPrescriptionWorkbench />)

    const bloodFlow = screen.getByRole('spinbutton', { name: /^Blood flow/ })
    fireEvent.change(bloodFlow, { target: { value: '1e308' } })

    expect(bloodFlow).toHaveValue(1e308)
    expect(bloodFlow).not.toHaveAttribute('aria-invalid')
    expect(screen.getAllByText('Unavailable — correct entries')).toHaveLength(6)
    expect(screen.getByRole('status')).toHaveTextContent(/exceeds a finite calculation boundary/i)
  })

  it('withholds bag duration until a positive practice capacity is entered', () => {
    render(<CrrtPrescriptionWorkbench />)

    expect(
      screen.getByText(/No result — enter an optional practice bag capacity/i),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Practice bag capacity/ }), {
      target: { value: '5000' },
    })

    expect(screen.getByText('5 h')).toBeInTheDocument()
    expect(screen.getByText(/this is not a PrisMax bag, scale, change-time/i)).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })
})
