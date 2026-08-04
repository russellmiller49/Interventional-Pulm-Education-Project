import {
  calculateCrrtMachineFluidLedger,
  calculateCrrtWholePatientLedger,
  checkCrrtFluidConservation,
  CRRT_MAKEUP_ATTRIBUTION_CONFLICT,
  crrtLedgerIsFullyBalanced,
  crrtWorkedLedgerExample,
} from '../circuitFluidLedger'
import { emptyExternalFluidRates } from '../engine/fluidModel'
import type { CrrtFlowRates } from '../engine/types'

const noFlows: CrrtFlowRates = {
  bloodFlowMlMin: 0,
  dialysateFlowMlHour: 0,
  pbpFlowMlHour: 0,
  preReplacementFlowMlHour: 0,
  postReplacementFlowMlHour: 0,
  patientFluidRemovalMlHour: 0,
  syringeFlowMlHour: 0,
  makeupFlowMlHour: 0,
}

function flows(overrides: Partial<CrrtFlowRates>): CrrtFlowRates {
  return { ...noFlows, ...overrides }
}

function allBalanced(ledger: ReturnType<typeof calculateCrrtMachineFluidLedger>) {
  return crrtLedgerIsFullyBalanced(checkCrrtFluidConservation(ledger))
}

describe('CRRT machine fluid ledger', () => {
  it('reproduces the worked example: 2,100 mL/h effluent against 100 mL/h of patient loss', () => {
    const ledger = calculateCrrtMachineFluidLedger(crrtWorkedLedgerExample.flows)

    expect(ledger.totalEffluentMlHour).toBe(2_100)
    expect(ledger.machinePatientFluidRemovalMlHour).toBe(100)
    expect(ledger.neverEnteringPatientMlHour).toBe(1_000)
    expect(ledger.enteringBloodPathMlHour).toBe(1_000)
    expect(ledger.crossingMembraneMlHour).toBe(1_100)
    expect(ledger.netFluidToPatientMlHour).toBe(-100)
    expect(ledger.effluentPerMillilitreRemoved).toBe(21)
    expect(allBalanced(ledger)).toBe(true)
  })

  it('keeps effluent and net patient removal distinct across every modality shape', () => {
    const cases: readonly { readonly label: string; readonly flows: CrrtFlowRates }[] = [
      { label: 'SCUF', flows: flows({ patientFluidRemovalMlHour: 150 }) },
      {
        label: 'CVVHD',
        flows: flows({ dialysateFlowMlHour: 1_500, patientFluidRemovalMlHour: 80 }),
      },
      {
        label: 'CVVH pre-filter',
        flows: flows({ preReplacementFlowMlHour: 1_800, patientFluidRemovalMlHour: 120 }),
      },
      {
        label: 'CVVH post-filter',
        flows: flows({ postReplacementFlowMlHour: 1_200, patientFluidRemovalMlHour: 120 }),
      },
      {
        label: 'CVVHDF',
        flows: flows({
          dialysateFlowMlHour: 1_000,
          preReplacementFlowMlHour: 600,
          postReplacementFlowMlHour: 400,
          pbpFlowMlHour: 200,
          patientFluidRemovalMlHour: 100,
        }),
      },
    ]

    for (const scenario of cases) {
      const ledger = calculateCrrtMachineFluidLedger(scenario.flows)
      expect(allBalanced(ledger)).toBe(true)
      expect(ledger.machinePatientFluidRemovalMlHour).toBe(scenario.flows.patientFluidRemovalMlHour)
      // The teaching claim: effluent is never a reading of patient loss unless
      // nothing else is running.
      const onlyRemoval =
        scenario.flows.dialysateFlowMlHour === 0 &&
        scenario.flows.preReplacementFlowMlHour === 0 &&
        scenario.flows.postReplacementFlowMlHour === 0 &&
        scenario.flows.pbpFlowMlHour === 0
      if (onlyRemoval) {
        expect(ledger.totalEffluentMlHour).toBe(ledger.machinePatientFluidRemovalMlHour)
      } else {
        expect(ledger.totalEffluentMlHour).toBeGreaterThan(
          ledger.machinePatientFluidRemovalMlHour ?? Number.NEGATIVE_INFINITY,
        )
      }
    }
  })

  it('moves replacement between the pre- and post-filter ports without changing the ledger totals', () => {
    const pre = calculateCrrtMachineFluidLedger(
      flows({
        dialysateFlowMlHour: 1_000,
        preReplacementFlowMlHour: 1_000,
        patientFluidRemovalMlHour: 100,
      }),
    )
    const post = calculateCrrtMachineFluidLedger(crrtWorkedLedgerExample.flows)

    expect(pre.totalEffluentMlHour).toBe(post.totalEffluentMlHour)
    expect(pre.crossingMembraneMlHour).toBe(post.crossingMembraneMlHour)
    expect(pre.machinePatientFluidRemovalMlHour).toBe(post.machinePatientFluidRemovalMlHour)
    expect(allBalanced(pre)).toBe(true)
  })

  it('never lets dialysate count as fluid entering the patient', () => {
    const ledger = calculateCrrtMachineFluidLedger(
      flows({ dialysateFlowMlHour: 2_500, patientFluidRemovalMlHour: 0 }),
    )

    expect(ledger.enteringBloodPathMlHour).toBe(0)
    expect(ledger.neverEnteringPatientMlHour).toBe(2_500)
    expect(ledger.netFluidToPatientMlHour).toBe(0)
    expect(ledger.machinePatientFluidRemovalMlHour).toBe(0)
    expect(allBalanced(ledger)).toBe(true)
  })

  it('reports an undefined rather than infinite effluent ratio when nothing is removed', () => {
    const ledger = calculateCrrtMachineFluidLedger(flows({ dialysateFlowMlHour: 1_000 }))

    expect(ledger.effluentPerMillilitreRemoved).toBeNull()
  })

  it('withholds every dependent quantity when a makeup flow is running', () => {
    const ledger = calculateCrrtMachineFluidLedger(
      flows({ dialysateFlowMlHour: 1_000, patientFluidRemovalMlHour: 100, makeupFlowMlHour: 40 }),
    )

    expect(ledger.resolution).toBe('unresolved-makeup-attribution')
    // The volume is never attributed to the patient — not as removal, not as
    // net fluid, not as a ratio.
    expect(ledger.machinePatientFluidRemovalMlHour).toBeNull()
    expect(ledger.netFluidToPatientMlHour).toBeNull()
    expect(ledger.crossingMembraneMlHour).toBeNull()
    expect(ledger.effluentPerMillilitreRemoved).toBeNull()
    expect(ledger.unresolvedReason).toMatch(/makeup flow of 40 mL\/h/i)

    // What the sources do state is still stated.
    expect(ledger.totalEffluentMlHour).toBe(1_140)
    expect(ledger.neverEnteringPatientMlHour).toBe(1_000)
    expect(ledger.prescribedPatientFluidRemovalMlHour).toBe(100)
  })

  it('cannot present a non-zero makeup term as a resolved, balanced ledger', () => {
    // The invariant the owner decision turns on: an unresolved attribution must
    // never reach a learner as a closed ledger. Swept across a range of makeup
    // values and therapy shapes so it cannot pass by coincidence.
    // A negative makeup is not swept: the source expression itself rejects it
    // (`assertNonNegativeNumber` in engine/units.ts), so it is unreachable state.
    for (const makeupFlowMlHour of [0.5, 1, 40, 250, 5_000]) {
      for (const shape of [
        { patientFluidRemovalMlHour: 100 },
        { dialysateFlowMlHour: 1_000, patientFluidRemovalMlHour: 100 },
        { postReplacementFlowMlHour: 1_000, patientFluidRemovalMlHour: 100 },
        { dialysateFlowMlHour: 800, preReplacementFlowMlHour: 400, pbpFlowMlHour: 100 },
      ]) {
        const ledger = calculateCrrtMachineFluidLedger(flows({ ...shape, makeupFlowMlHour }))
        const checks = checkCrrtFluidConservation(ledger)

        expect(ledger.resolution).toBe('unresolved-makeup-attribution')
        expect(crrtLedgerIsFullyBalanced(checks)).toBe(false)
        expect(checks.some((check) => check.status === 'unresolved')).toBe(true)
        // No check may report "balanced" off a suppressed quantity.
        expect(checks.filter((check) => check.status === 'balanced')).toHaveLength(0)
        expect(ledger.machinePatientFluidRemovalMlHour).toBeNull()
      }
    }
  })

  it('returns to a resolved balanced ledger the moment makeup is zero', () => {
    const ledger = calculateCrrtMachineFluidLedger(
      flows({ dialysateFlowMlHour: 1_000, patientFluidRemovalMlHour: 100, makeupFlowMlHour: 0 }),
    )

    expect(ledger.resolution).toBe('resolved')
    expect(ledger.unresolvedReason).toBeNull()
    expect(allBalanced(ledger)).toBe(true)
  })

  it('records the makeup attribution conflict rather than resolving it', () => {
    expect(CRRT_MAKEUP_ATTRIBUTION_CONFLICT.status).toBe('unresolved-source-attribution-conflict')
    expect(CRRT_MAKEUP_ATTRIBUTION_CONFLICT.sourceRecordIds).toEqual([
      'MATH-PM-001',
      'FLUID-PM-002',
    ])
    expect(CRRT_MAKEUP_ATTRIBUTION_CONFLICT.symbol).toBe('Qmakeup')
    expect(CRRT_MAKEUP_ATTRIBUTION_CONFLICT.observation).toMatch(/omits it/i)
  })

  it('holds every authored C0/C1 example at zero makeup', () => {
    expect(crrtWorkedLedgerExample.flows.makeupFlowMlHour).toBe(0)
    expect(calculateCrrtMachineFluidLedger(crrtWorkedLedgerExample.flows).resolution).toBe(
      'resolved',
    )
  })

  it('detects a deliberately broken ledger', () => {
    const ledger = calculateCrrtMachineFluidLedger(crrtWorkedLedgerExample.flows)
    // The worked example resolves, so the membrane term is a number here; the
    // assertion states that rather than assuming it.
    expect(ledger.crossingMembraneMlHour).not.toBeNull()
    const tampered = {
      ...ledger,
      crossingMembraneMlHour: (ledger.crossingMembraneMlHour ?? 0) + 250,
    }

    const failures = checkCrrtFluidConservation(tampered).filter(
      (check) => check.status !== 'balanced',
    )
    expect(failures.map((check) => check.id)).toEqual(
      expect.arrayContaining([
        'effluent-equals-membrane-plus-dialysate',
        'membrane-minus-added-equals-machine-removal',
      ]),
    )
  })
})

describe('CRRT whole-patient ledger', () => {
  it('is a different number from the machine ledger for the same hour', () => {
    const machine = calculateCrrtMachineFluidLedger(crrtWorkedLedgerExample.flows)
    const patient = calculateCrrtWholePatientLedger(
      {
        ...emptyExternalFluidRates,
        maintenanceInputMlHour: 60,
        nutritionInputMlHour: 40,
        urineOutputMlHour: 10,
      },
      machine.machinePatientFluidRemovalMlHour ?? 0,
      0,
    )

    expect(patient.externalInputMlHour).toBe(100)
    expect(patient.externalOutputMlHour).toBe(10)
    // 100 in, 10 out as urine, 100 removed by the machine.
    expect(patient.netBalanceMlHour).toBe(-10)
    expect(patient.netBalanceMlHour).not.toBe(-machine.totalEffluentMlHour)
  })

  it('carries unintended device net gain into the patient balance', () => {
    const patient = calculateCrrtWholePatientLedger(emptyExternalFluidRates, 100, 25)

    expect(patient.netBalanceMlHour).toBe(-75)
  })
})
