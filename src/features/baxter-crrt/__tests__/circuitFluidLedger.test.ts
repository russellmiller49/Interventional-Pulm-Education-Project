import {
  calculateCrrtMachineFluidLedger,
  calculateCrrtWholePatientLedger,
  checkCrrtFluidConservation,
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
  return checkCrrtFluidConservation(ledger).every((check) => check.balanced)
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
        expect(ledger.totalEffluentMlHour).toBeGreaterThan(ledger.machinePatientFluidRemovalMlHour)
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

  it('flags the makeup term rather than silently reporting it as patient loss', () => {
    const ledger = calculateCrrtMachineFluidLedger(
      flows({ patientFluidRemovalMlHour: 100, makeupFlowMlHour: 40 }),
    )
    const makeupCheck = checkCrrtFluidConservation(ledger).find(
      (check) => check.id === 'makeup-term-inflates-machine-removal',
    )

    expect(ledger.machinePatientFluidRemovalMlHour).toBe(140)
    expect(ledger.prescribedPatientFluidRemovalMlHour).toBe(100)
    expect(makeupCheck?.balanced).toBe(false)
    expect(makeupCheck?.residualMlHour).toBe(40)
    // The conservation identities themselves still hold; only the makeup
    // reconciliation is flagged.
    expect(
      checkCrrtFluidConservation(ledger)
        .filter((check) => check.id !== 'makeup-term-inflates-machine-removal')
        .every((check) => check.balanced),
    ).toBe(true)
  })

  it('detects a deliberately broken ledger', () => {
    const ledger = calculateCrrtMachineFluidLedger(crrtWorkedLedgerExample.flows)
    const tampered = { ...ledger, crossingMembraneMlHour: ledger.crossingMembraneMlHour + 250 }

    const failures = checkCrrtFluidConservation(tampered).filter((check) => !check.balanced)
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
      machine.machinePatientFluidRemovalMlHour,
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
