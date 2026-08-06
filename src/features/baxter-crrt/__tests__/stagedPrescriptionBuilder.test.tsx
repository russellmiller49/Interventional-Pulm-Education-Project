/**
 * C2 §5 — the staged prescription builder.
 *
 * The assertions here are about behaviour a learner can observe: three named steps in one order,
 * state that survives moving backwards, consequences that follow the entries, and the four
 * distinctions the module refuses to blur (prescribed versus delivered, effluent versus patient
 * loss, dialysate versus fluid the patient receives, and where each replacement port sits).
 */
import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtStagedPrescriptionBuilder } from '../components/CrrtStagedPrescriptionBuilder'
import {
  calculateCrrtMachineFluidLedger,
  CRRT_MAKEUP_ATTRIBUTION_CONFLICT,
} from '../circuitFluidLedger'
import { calculateEffluentDoseMlPerKgHour } from '../engine/clinicalMath'
import {
  CRRT_PRESCRIPTION_STAGE_IDS,
  CRRT_STARTING_CONSTRUCTION,
  calculateCrrtPredictedConsequences,
  crrtConstructionFlowRates,
  crrtConstructionGroups,
  crrtPrescriptionGoalOptions,
  crrtPrescriptionStages,
  unresolvedCrrtStagedPrescriptionSourceIds,
} from '../stagedPrescriptionModel'

/** Language a prescription tool must never introduce. */
const TARGET_LANGUAGE =
  /\b(target range|recommended dose|goal dose|should be set to|normal range|aim for)\b/i

function consequencesFor(overrides: Partial<typeof CRRT_STARTING_CONSTRUCTION> = {}) {
  return calculateCrrtPredictedConsequences({ ...CRRT_STARTING_CONSTRUCTION, ...overrides })
}

describe('staged prescription model', () => {
  it('names exactly three stages, in the authored order', () => {
    expect([...CRRT_PRESCRIPTION_STAGE_IDS]).toEqual([
      'goals',
      'construction',
      'predicted-consequences',
    ])
    expect(crrtPrescriptionStages.map((stage) => stage.ordinal)).toEqual([1, 2, 3])
    expect(crrtPrescriptionStages.map((stage) => stage.shortTitle)).toEqual([
      'Goals',
      'Construction',
      'Predicted consequences',
    ])
  })

  it('groups construction in a stated causal order rather than one undifferentiated form', () => {
    expect(crrtConstructionGroups.map((group) => group.ordinal)).toEqual([1, 2, 3, 4, 5, 6])
    for (const group of crrtConstructionGroups) {
      expect(group.fieldIds.length).toBeGreaterThan(0)
      expect(group.causalNote.length).toBeGreaterThan(60)
    }
    // Patient fluid removal is asked after, and separately from, the flows that move solute.
    const removalGroup = crrtConstructionGroups.findIndex((group) =>
      group.fieldIds.includes('patientFluidRemovalMlPerHour'),
    )
    const transportGroup = crrtConstructionGroups.findIndex((group) =>
      group.fieldIds.includes('dialysateMlPerHour'),
    )
    expect(removalGroup).toBeGreaterThan(transportGroup)
    expect(removalGroup).not.toBe(transportGroup)
  })

  it('distinguishes a clearance goal from a net-removal goal in stage 1', () => {
    const groups = new Set(crrtPrescriptionGoalOptions.map((option) => option.group))
    expect([...groups].sort()).toEqual([
      'acid-base-electrolyte',
      'fluid-management',
      'operational-delivery',
      'solute-clearance',
    ])
    const netRemoval = crrtPrescriptionGoalOptions.find(
      (option) => option.id === 'goal-net-fluid-removal',
    )
    expect(netRemoval?.group).toBe('fluid-management')
    expect(netRemoval?.whatThePrescriptionMustDo).toMatch(/effluent intensity does not/i)
  })

  it('introduces no universal prescription target in the teaching copy', () => {
    const teachingCopy = [
      ...crrtPrescriptionStages.flatMap((stage) => [stage.title, stage.question, stage.summary]),
      ...crrtConstructionGroups.flatMap((group) => [group.title, group.causalNote]),
      ...crrtPrescriptionGoalOptions.flatMap((option) => [
        option.label,
        option.whatThePrescriptionMustDo,
      ]),
      consequencesFor().intensity.statement,
    ].join(' ')
    expect(teachingCopy).not.toMatch(TARGET_LANGUAGE)

    // The boundary list is the one place the words appear, and only to disclaim them.
    const boundaries = consequencesFor().modelBoundaries.join(' ')
    expect(boundaries).toMatch(/No target range, normal range, or alarm limit appears anywhere/i)
    expect(boundaries).toMatch(/not a recommendation for a patient/i)
  })

  it('reads consequences from the existing observers rather than recomputing them', () => {
    const consequences = consequencesFor()
    const ledger = calculateCrrtMachineFluidLedger(
      crrtConstructionFlowRates(CRRT_STARTING_CONSTRUCTION),
    )

    // Identical objects would be too weak a claim; identical values across every ledger field is
    // the thing that would break if a second arithmetic path appeared.
    expect(consequences.ledger).toEqual(ledger)
    expect(consequences.intensity.prescribedEffluentRateMlPerHour).toBe(ledger.totalEffluentMlHour)
    expect(consequences.filtrationBurden.qualitative).toBe(consequences.workbench.prePostExperiment)
  })

  /**
   * The defect the offline review harness caught: `calculatePrescriptionWorkbench` has no makeup
   * control and holds that term at zero, so reading the intensity's effluent rate from it put two
   * different total-effluent figures on one page as soon as a makeup flow was running. The ledger
   * is now the only source of that number.
   */
  it('states total effluent exactly once, even with a makeup flow running', () => {
    const unresolved = consequencesFor({ makeupMlPerHour: 40 })
    const totalEffluent = unresolved.ledger.totalEffluentMlHour

    expect(totalEffluent).toBe(2_140)
    expect(unresolved.intensity.prescribedEffluentRateMlPerHour).toBe(totalEffluent)
    // The workbench figure is the makeup-zero variant; it must not be what the learner is shown.
    expect(unresolved.workbench.effluentPumpTargetMlPerHour).toBe(2_100)
    expect(unresolved.intensity.prescribedEffluentRateMlPerHour).not.toBe(
      unresolved.workbench.effluentPumpTargetMlPerHour,
    )
    expect(unresolved.intensity.prescribedDoseMlPerKgHour).toBe(
      calculateEffluentDoseMlPerKgHour(totalEffluent, CRRT_STARTING_CONSTRUCTION.simulatedWeightKg),
    )
  })

  it('changes the engine-derived consequences when a supported entry changes', () => {
    const base = consequencesFor()
    const moreDialysate = consequencesFor({ dialysateMlPerHour: 2_000 })

    expect(moreDialysate.ledger.totalEffluentMlHour).toBe(base.ledger.totalEffluentMlHour + 1_000)
    expect(moreDialysate.intensity.prescribedDoseMlPerKgHour).toBeGreaterThan(
      base.intensity.prescribedDoseMlPerKgHour,
    )
    // Clearance intensity moved; net patient removal did not.
    expect(moreDialysate.ledger.machinePatientFluidRemovalMlHour).toBe(
      base.ledger.machinePatientFluidRemovalMlHour,
    )
  })

  it('separates prescribed from delivered intensity as soon as an hour is lost', () => {
    const running = consequencesFor()
    expect(running.intensity.separationIsVisible).toBe(false)
    expect(running.intensity.deliveredDoseMlPerKgHour).toBe(
      running.intensity.prescribedDoseMlPerKgHour,
    )

    const interrupted = consequencesFor({ downtimeHours: 6 })
    expect(interrupted.intensity.separationIsVisible).toBe(true)
    expect(interrupted.intensity.prescribedDoseMlPerKgHour).toBe(
      running.intensity.prescribedDoseMlPerKgHour,
    )
    expect(interrupted.intensity.deliveredDoseMlPerKgHour).toBeLessThan(
      interrupted.intensity.prescribedDoseMlPerKgHour,
    )
    expect(interrupted.intensity.deliveredHours).toBe(18)

    // The delivered figure is the engine's own dose expression over the smaller average rate, not
    // a second formula written in the builder.
    expect(interrupted.intensity.deliveredDoseMlPerKgHour).toBeCloseTo(
      calculateEffluentDoseMlPerKgHour(
        (interrupted.intensity.prescribedEffluentRateMlPerHour * 18) / 24,
        CRRT_STARTING_CONSTRUCTION.simulatedWeightKg,
      ),
      10,
    )
  })

  it('keeps total effluent distinct from what the patient loses', () => {
    const consequences = consequencesFor()
    expect(consequences.ledger.totalEffluentMlHour).toBe(2_100)
    expect(consequences.ledger.machinePatientFluidRemovalMlHour).toBe(100)
    expect(consequences.ledger.totalEffluentMlHour).not.toBe(
      consequences.ledger.machinePatientFluidRemovalMlHour,
    )

    // Fluid-neutral: effluent keeps running while the patient loses nothing.
    const neutral = consequencesFor({ patientFluidRemovalMlPerHour: 0 })
    expect(neutral.ledger.machinePatientFluidRemovalMlHour).toBe(0)
    expect(neutral.ledger.totalEffluentMlHour).toBeGreaterThan(0)
  })

  it('never represents dialysate as entering the patient', () => {
    const consequences = consequencesFor()
    expect(consequences.circuitView.neverEntersPatientPathLabels).toContain('Dialysate supply')
    expect(consequences.circuitView.entersPatientPathLabels).not.toContain('Dialysate supply')
    expect(consequences.ledger.neverEnteringPatientMlHour).toBe(
      CRRT_STARTING_CONSTRUCTION.dialysateMlPerHour,
    )
    // The blood-path total is the two replacement ports plus PBP — dialysate is not in it.
    expect(consequences.ledger.enteringBloodPathMlHour).toBe(
      CRRT_STARTING_CONSTRUCTION.preBloodPumpMlPerHour +
        CRRT_STARTING_CONSTRUCTION.preReplacementMlPerHour +
        CRRT_STARTING_CONSTRUCTION.postReplacementMlPerHour,
    )
  })

  it('keeps prefilter and postfilter replacement at their own circuit locations', () => {
    const preOnly = consequencesFor({
      modalityViewId: 'cvvh-pre',
      dialysateMlPerHour: 0,
      postReplacementMlPerHour: 0,
    })
    expect(preOnly.circuitView.enteredActivePaths.map((path) => path.pathId)).toContain(
      'pre-filter-replacement',
    )
    expect(preOnly.circuitView.consistencyNotes).toEqual([])

    const postOnly = consequencesFor({
      modalityViewId: 'cvvh-post',
      dialysateMlPerHour: 0,
      preReplacementMlPerHour: 0,
    })
    expect(postOnly.circuitView.enteredActivePaths.map((path) => path.pathId)).toContain(
      'post-filter-replacement',
    )
    expect(postOnly.circuitView.consistencyNotes).toEqual([])

    // The two ports are different paths with different text equivalents, not one control.
    expect(preOnly.circuitView.textEquivalent).toMatch(/before the filter, diluting blood/i)
    expect(postOnly.circuitView.textEquivalent).toMatch(/never crosses the membrane/i)
  })

  it('reports a disagreement between the chosen view and the entered flows', () => {
    const mismatch = consequencesFor({ modalityViewId: 'scuf' })
    expect(mismatch.circuitView.consistencyNotes.map((note) => note.fieldId).sort()).toEqual([
      'dialysateMlPerHour',
      'postReplacementMlPerHour',
      'preReplacementMlPerHour',
    ])
    for (const note of mismatch.circuitView.consistencyNotes) {
      expect(note.expectation).toBe('must-be-off')
    }
  })

  it('withholds every dependent value while the makeup attribution is unresolved', () => {
    const unresolved = consequencesFor({ makeupMlPerHour: 40 })

    expect(unresolved.resolution).toBe('unresolved-makeup-attribution')
    expect(unresolved.conflictId).toBe(CRRT_MAKEUP_ATTRIBUTION_CONFLICT.id)

    const byId = new Map(unresolved.fluidValues.map((value) => [value.id, value]))
    for (const id of ['crossing-membrane', 'net-fluid-to-patient', 'machine-recorded-removal']) {
      const value = byId.get(id)
      expect(value?.status).toBe('withheld')
      expect(value?.valueMlPerHour).toBeNull()
    }
    // Total effluent stays stateable because the effluent expression carries the makeup term.
    expect(byId.get('total-effluent')?.status).toBe('available')
    expect(byId.get('total-effluent')?.valueMlPerHour).toBe(2_140)

    // Nothing is reported as balanced, and no volume is attributed to patient loss.
    expect(unresolved.conservationChecks.map((check) => check.status)).toEqual([
      'unresolved',
      'unresolved',
      'unresolved',
      'unresolved',
    ])
    expect(unresolved.withheldNotice).toMatch(/withheld rather than guessed/i)
    expect(unresolved.withheldNotice).toMatch(/Substituting zero/i)
  })

  it('does not republish a withheld value through the workbench path', () => {
    const unresolved = consequencesFor({ makeupMlPerHour: 40 })
    const removalRow = unresolved.fluidValues.find(
      (value) => value.id === 'machine-recorded-removal',
    )
    const settingRow = unresolved.fluidValues.find(
      (value) => value.id === 'machine-removal-setting',
    )

    // The setting the learner typed is echoed; the machine's computed removal term is not.
    expect(settingRow?.valueMlPerHour).toBe(CRRT_STARTING_CONSTRUCTION.patientFluidRemovalMlPerHour)
    expect(settingRow?.label).toMatch(/setting/i)
    expect(removalRow?.valueMlPerHour).toBeNull()
    expect(removalRow?.label).not.toMatch(/setting/i)
  })

  it('fails closed rather than clamping an entry the source-backed expressions reject', () => {
    expect(() => consequencesFor({ simulatedWeightKg: 0 })).toThrow(/greater than zero/i)
    expect(() => consequencesFor({ hematocritPercent: 100 })).toThrow(/less than 100/i)
    expect(() => consequencesFor({ downtimeHours: 48 })).toThrow(/must not exceed/i)
  })

  it('resolves every citation it makes', () => {
    expect(unresolvedCrrtStagedPrescriptionSourceIds()).toEqual([])
  })
})

describe('staged prescription builder surface', () => {
  beforeEach(() => window.localStorage.clear())

  function openStage(name: RegExp) {
    fireEvent.click(screen.getByRole('button', { name }))
  }

  it('presents Goals, Construction, and Predicted consequences in that order', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    const rail = screen.getByRole('navigation', { name: 'Prescription building steps' })
    const steps = within(rail).getAllByRole('button')
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Goals'),
      expect.stringContaining('Construction'),
      expect.stringContaining('Predicted consequences'),
    ])
    expect(steps[0]).toHaveAttribute('aria-current', 'step')
    expect(steps[1]).not.toHaveAttribute('aria-current')
  })

  it('is no longer one dense form: construction entries are hidden until their own step', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    expect(screen.queryByRole('spinbutton', { name: /^Dialysate flow/ })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('spinbutton', { name: /^Patient fluid removal/ }),
    ).not.toBeInTheDocument()

    openStage(/Continue to Construction/)
    expect(screen.getByRole('spinbutton', { name: /^Dialysate flow/ })).toBeInTheDocument()
    // And the goal checkboxes are no longer competing for the same screen.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('keeps staged state when the learner moves backward and forward again', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    const goal = screen.getByRole('checkbox', {
      name: /Take net fluid off the patient at a rate the circulation tolerates/,
    })
    fireEvent.click(goal)

    openStage(/Continue to Construction/)
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Dialysate flow/ }), {
      target: { value: '2000' },
    })

    openStage(/Back to Goals/)
    expect(
      screen.getByRole('checkbox', {
        name: /Take net fluid off the patient at a rate the circulation tolerates/,
      }),
    ).toBeChecked()

    openStage(/Continue to Construction/)
    expect(screen.getByRole('spinbutton', { name: /^Dialysate flow/ })).toHaveValue(2000)
  })

  it('moves the engine-derived predictions when a construction entry changes', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    openStage(/Continue to Construction/)
    openStage(/Continue to Predicted consequences/)
    expect(screen.getAllByText('2,100 mL/h').length).toBeGreaterThan(0)

    openStage(/Back to Construction/)
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Dialysate flow/ }), {
      target: { value: '2000' },
    })
    openStage(/Continue to Predicted consequences/)

    expect(screen.getAllByText('3,100 mL/h').length).toBeGreaterThan(0)
    // No stale copy of the previous figure survives anywhere on the step, including in the
    // circuit's own ledger, which reads the same entries.
    expect(screen.queryAllByText('2,100 mL/h')).toHaveLength(0)
  })

  it('shows prescribed and delivered intensity as two different numbers under downtime', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    openStage(/Continue to Construction/)
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Time not running/ }), {
      target: { value: '6' },
    })
    openStage(/Continue to Predicted consequences/)

    expect(screen.getByText('30 mL/kg/h')).toBeInTheDocument()
    expect(screen.getByText('22.5 mL/kg/h')).toBeInTheDocument()
    expect(screen.getByText(/ran for 18 of 24 hours/i)).toBeInTheDocument()
  })

  it('withholds the dependent fluid rows when a makeup flow is entered', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    openStage(/Continue to Construction/)
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Device makeup flow/ }), {
      target: { value: '40' },
    })
    openStage(/Continue to Predicted consequences/)

    // One effluent figure on the step, not two: the makeup-zero workbench variant is not shown.
    expect(screen.getAllByText('2,140 mL/h').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('2,100 mL/h')).toHaveLength(0)

    const notice = screen.getByRole('note', { name: 'Withheld results' })
    expect(notice).toHaveTextContent(/withheld, not zero/i)
    expect(notice).toHaveTextContent(/no registered source says which side of the membrane/i)

    // The one ledger reports itself unclosable rather than balanced.
    expect(screen.getByText(/This ledger cannot be closed/i)).toBeInTheDocument()
    expect(screen.queryByText('Balances')).not.toBeInTheDocument()
    expect(screen.getAllByText('Cannot be checked')).toHaveLength(4)
  })

  it('emits completion evidence only after an entry changes and step 3 is opened', () => {
    const onCompletionEvidence = jest.fn()
    render(<CrrtStagedPrescriptionBuilder onCompletionEvidence={onCompletionEvidence} />)

    openStage(/Continue to Construction/)
    openStage(/Continue to Predicted consequences/)
    expect(onCompletionEvidence).not.toHaveBeenCalled()

    openStage(/Back to Construction/)
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Blood flow/ }), {
      target: { value: '120' },
    })
    openStage(/Continue to Predicted consequences/)
    expect(onCompletionEvidence).toHaveBeenCalledTimes(1)

    openStage(/Back to Construction/)
    openStage(/Continue to Predicted consequences/)
    expect(onCompletionEvidence).toHaveBeenCalledTimes(1)
    expect(window.localStorage).toHaveLength(0)
  })

  it('keeps every predicted value unavailable while an entry is invalid', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    openStage(/Continue to Construction/)
    const weight = screen.getByRole('spinbutton', { name: /^Practice weight/ })
    fireEvent.change(weight, { target: { value: '' } })

    expect(weight).toHaveAttribute('aria-invalid', 'true')
    expect(weight).toHaveAccessibleDescription(/practice weight is required/i)
    expect(screen.getByRole('status')).toHaveTextContent(
      /every predicted consequence is unavailable.*practice weight/i,
    )

    openStage(/Continue to Predicted consequences/)
    expect(screen.queryByText('2,100 mL/h')).not.toBeInTheDocument()
    expect(screen.getByText(/unavailable until each entry is valid/i)).toBeInTheDocument()
  })

  it('rejects a downtime longer than the window instead of silently clamping it', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    openStage(/Continue to Construction/)
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Time not running/ }), {
      target: { value: '48' },
    })

    expect(screen.getByRole('spinbutton', { name: /^Time not running/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByRole('status')).toHaveTextContent(/time not running/i)
  })

  it('permits only the no-anticoagulation concept and no solution registry', () => {
    render(<CrrtStagedPrescriptionBuilder />)

    openStage(/Continue to Construction/)
    const anticoagulation = screen.getByRole('combobox', { name: 'Anticoagulation approach' })
    expect(anticoagulation).toHaveValue('none')
    expect(within(anticoagulation).getByRole('option', { name: /Systemic/ })).toBeDisabled()
    expect(within(anticoagulation).getByRole('option', { name: /Regional citrate/ })).toBeDisabled()
  })

  it('exposes no implementation or evidence-record id as primary learner copy', () => {
    render(<CrrtStagedPrescriptionBuilder />)
    openStage(/Continue to Construction/)
    openStage(/Continue to Predicted consequences/)

    for (const id of [
      'MATH-PM-001',
      'DOSE-PM-001',
      'FLUID-PM-002',
      'SYNTH-LAB-PRESCRIPTION-001',
      'CONFLICT-CRRT-MAKEUP-001',
    ]) {
      expect(screen.queryByText(id)).not.toBeInTheDocument()
    }
  })
})
