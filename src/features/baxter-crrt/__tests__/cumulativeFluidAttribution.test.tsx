/**
 * The operations surface used to publish two cumulative fluid totals straight
 * off `deliveredTherapy`, with no attribution check at all.
 *
 * Both are built on the machine patient-fluid-removal term, which the C0/C1
 * ledger withholds outright when the makeup attribution is unresolved — and the
 * engine accumulates that term from the *entered* patient-fluid-removal
 * setting. So an unresolved run published a cumulative number derived from the
 * setting and labelled it as removal, which is precisely the substitution the
 * ledger exists to prevent.
 *
 * Every shipped fixture holds makeup at zero, which hid this rather than
 * closing it.
 */
import { render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PrismaxPilotInterface } from '../components/PrismaxPilotInterface'
import {
  createInitialPrismaxPilotInterfaceState,
  prismaxPilotInterfaceReducer,
  selectPrismaxPilotCaseOperationsDisplay,
  selectPrismaxPilotOperationsDisplay,
  type PrismaxPilotInterfaceAction,
  type PrismaxPilotInterfaceState,
} from '../engine/deviceAdapters/prismax'
import { createInitialCrrtSimulationState } from '../engine/initialState'
import {
  crrtCleanRunWithMakeupBag,
  crrtCumulativeFluidReviewStates,
  crrtMakeupRunningState,
  crrtMakeupWithoutBagState,
  crrtPriorMakeupThenZeroState,
} from '../engine/testSupport/cumulativeFluidStates'
import { runningState } from '../engine/testSupport/livePressureStates'
import type { CrrtSimulationState } from '../engine/types'

const ui = createInitialPrismaxPilotInterfaceState()

function view(state: CrrtSimulationState) {
  return selectPrismaxPilotCaseOperationsDisplay(ui, state)
}

function reduce(
  state: PrismaxPilotInterfaceState,
  ...actions: readonly PrismaxPilotInterfaceAction[]
): PrismaxPilotInterfaceState {
  return actions.reduce(prismaxPilotInterfaceReducer, state)
}

/** Drives the pilot reducer to the Operations screen so the totals render. */
function operationsInterfaceState(): PrismaxPilotInterfaceState {
  return reduce(
    createInitialPrismaxPilotInterfaceState(),
    { type: 'SELECT_NEW_PATIENT' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'patient' },
    { type: 'SELECT_CVVHD' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'therapy' },
    { type: 'SET_PRESCRIPTION_VALUE', field: 'bloodFlowMlMin', value: 120 },
    { type: 'SET_PRESCRIPTION_VALUE', field: 'dialysateFlowMlHour', value: 1_500 },
    { type: 'SET_PRESCRIPTION_VALUE', field: 'patientFluidRemovalMlHour', value: 250 },
    { type: 'COMMIT_PRESCRIPTION' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'sets' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' },
    { type: 'START_PRIME' },
    { type: 'COMPLETE_PRIME' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'review' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' },
    { type: 'START_TREATMENT' },
  )
}

function renderOperations(engineState: CrrtSimulationState) {
  const interfaceState = operationsInterfaceState()
  return render(
    <PrismaxPilotInterface
      state={interfaceState}
      dispatch={() => {}}
      operationsDisplay={selectPrismaxPilotCaseOperationsDisplay(interfaceState, engineState)}
    />,
  )
}

function cumulativeRow(container: HTMLElement): HTMLElement {
  const row = container.querySelector('[data-cumulative-fluid]')
  if (!row) throw new Error('The cumulative fluid row is not rendered.')
  return row as HTMLElement
}

describe('cumulative fluid attribution — adapter contract', () => {
  it('reports no case and null totals on the case-free selector', () => {
    const display = selectPrismaxPilotOperationsDisplay(ui)
    expect(display.cumulativeFluid.resolution).toBe('no-case-attached')
    expect(display.cumulativeMachinePatientFluidRemovalMl).toBeNull()
    expect(display.cumulativeWholePatientBalanceMl).toBeNull()
    expect(display.cumulativeFluid.withheldReason).not.toBeNull()
  })

  it('treats an unconfigured prescription as no case rather than a total of zero', () => {
    const display = view(createInitialCrrtSimulationState())
    expect(display.cumulativeFluid.resolution).toBe('no-case-attached')
    expect(display.cumulativeMachinePatientFluidRemovalMl).toBeNull()
    expect(display.cumulativeWholePatientBalanceMl).toBeNull()
  })

  it('preserves the exact engine totals on an ordinary zero-makeup case', () => {
    for (const state of [runningState(), crrtCleanRunWithMakeupBag()]) {
      const display = view(state)
      expect(display.cumulativeFluid.resolution).toBe('available')
      expect(display.cumulativeMachinePatientFluidRemovalMl).toBe(
        state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl,
      )
      expect(display.cumulativeWholePatientBalanceMl).toBe(
        state.deliveredTherapy.cumulativeWholePatientBalanceMl,
      )
      expect(display.cumulativeFluid.withheldReason).toBeNull()
    }
  })

  it('reports unresolved attribution while makeup is running', () => {
    const state = crrtMakeupRunningState()
    const display = view(state)
    expect(display.cumulativeFluid.resolution).toBe('unresolved-makeup-attribution')
    expect(display.cumulativeMachinePatientFluidRemovalMl).toBeNull()
    expect(display.cumulativeWholePatientBalanceMl).toBeNull()
    // The engine really does hold a number here; that is the point.
    expect(state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl).toBeGreaterThan(0)
  })

  /**
   * The window question. The ledger is defined over rates, so a setting that
   * has returned to zero looks resolved to it. The totals do not forget.
   */
  it('keeps withholding after the makeup setting returns to zero', () => {
    const state = crrtPriorMakeupThenZeroState()
    expect(state.circuit.flows.makeupFlowMlHour).toBe(0)
    const display = view(state)
    expect(display.cumulativeFluid.resolution).toBe('unresolved-makeup-attribution')
    expect(display.cumulativeFluid.makeupDeliveredMlInWindow).toBeGreaterThan(0)
    expect(display.cumulativeMachinePatientFluidRemovalMl).toBeNull()
    expect(display.cumulativeWholePatientBalanceMl).toBeNull()
    expect(display.cumulativeFluid.withheldReason).toMatch(
      /Returning the makeup setting to zero does not settle what the totals already contain/i,
    )
  })

  it('withholds on a makeup rate even when no bag lets it be delivered', () => {
    const display = view(crrtMakeupWithoutBagState())
    expect(display.cumulativeFluid.resolution).toBe('unresolved-makeup-attribution')
    expect(display.cumulativeFluid.makeupDeliveredMlInWindow).toBe(0)
    expect(display.cumulativeMachinePatientFluidRemovalMl).toBeNull()
  })

  it('matches the expected resolution for every review state', () => {
    for (const review of crrtCumulativeFluidReviewStates()) {
      expect([review.id, view(review.state).cumulativeFluid.resolution]).toEqual([
        review.id,
        review.expected,
      ])
    }
  })

  it('never reconstructs a withheld total from the setting or another field', () => {
    const state = crrtPriorMakeupThenZeroState()
    const display = view(state)
    expect(display.cumulativeMachinePatientFluidRemovalMl).toBeNull()
    expect(display.cumulativeMachinePatientFluidRemovalMl).not.toBe(0)
    // The entered setting is still published as context, and is not the result.
    expect(display.treatmentContext.patientFluidRemovalMlHour).toBe(
      state.circuit.flows.patientFluidRemovalMlHour,
    )
    expect(display.cumulativeWholePatientBalanceMl).toBeNull()
  })

  it('keeps the pressure projection free of any fluid-conservation result', () => {
    for (const review of crrtCumulativeFluidReviewStates()) {
      const display = view(review.state)
      const serialised =
        JSON.stringify(display.pressureSignals) + JSON.stringify(display.treatmentContext)
      for (const forbidden of [
        'cumulativeMachinePatientFluidRemovalMl',
        'cumulativeWholePatientBalanceMl',
        'fluidLedger',
        'crossingMembrane',
        'netFluidToPatient',
      ]) {
        expect([review.id, forbidden, serialised.includes(forbidden)]).toEqual([
          review.id,
          forbidden,
          false,
        ])
      }
    }
  })
})

describe('cumulative fluid attribution — what a learner sees', () => {
  it('states both totals when the attribution is settled', () => {
    const state = runningState()
    const { container } = renderOperations(state)
    const row = cumulativeRow(container)
    expect(row.getAttribute('data-cumulative-fluid')).toBe('available')
    expect(row.textContent).not.toMatch(/Withheld/)
    expect(row.textContent).toMatch(/\d+ mL \/ .*\d+ mL/)
  })

  it('renders Withheld for both totals when the attribution is unresolved', () => {
    const { container } = renderOperations(crrtPriorMakeupThenZeroState())
    const row = cumulativeRow(container)
    expect(row.getAttribute('data-cumulative-fluid')).toBe('unresolved-makeup-attribution')
    expect(within(row).getByText(/Withheld \/ Withheld/)).toBeInTheDocument()
    expect(row.querySelector('[data-withheld="true"]')).not.toBeNull()
  })

  it('explains that the registered sources do not settle the makeup term', () => {
    const { container } = renderOperations(crrtMakeupRunningState())
    const row = cumulativeRow(container)
    expect(row.textContent).toMatch(/no registered source says which side of the membrane/i)
    expect(row.textContent).toMatch(/no volume is attributed to patient loss/i)
    expect(row.textContent).toMatch(/whole-patient balance/i)
  })

  it('renders no zero, bare dash, balance claim, or prior value while withheld', () => {
    const { container } = renderOperations(crrtPriorMakeupThenZeroState())
    const row = cumulativeRow(container)
    const text = row.textContent ?? ''
    expect(text).not.toMatch(/\b0 mL\b/)
    expect(text).not.toMatch(/—\s*\/\s*—/)
    expect(text).not.toMatch(/Balances/i)
    // The engine's contaminated totals must not appear anywhere on the surface.
    const engine = crrtPriorMakeupThenZeroState().deliveredTherapy
    expect(container.textContent).not.toContain(
      `${Math.round(engine.cumulativeMachinePatientFluidRemovalMl)} mL`,
    )
  })

  it('does not substitute the entered patient-fluid-removal setting for the result', () => {
    const state = crrtPriorMakeupThenZeroState()
    const { container } = renderOperations(state)
    const row = cumulativeRow(container)
    expect(row.textContent).not.toContain(`${state.circuit.flows.patientFluidRemovalMlHour} mL`)

    // The setting is only ever presented where it is named as a setting: the
    // prescription entry, whose note says it is not whole-patient balance.
    const source = readFileSync(
      join(process.cwd(), 'src/features/baxter-crrt/components/PrismaxPilotInterface.tsx'),
      'utf8',
    )
    expect(source).toMatch(
      /field: 'patientFluidRemovalMlHour',[\s\S]*?label: 'Patient fluid removal',[\s\S]*?note: 'Machine setting only; it is not whole-patient balance\.'/,
    )
    // The treatment-status list never restates the setting as a removal figure.
    const status = cumulativeRow(container).closest('dl')
    expect(status?.textContent).not.toMatch(/Patient fluid removal/)
    // Where the profile does show it, it is named as a setting.
    expect(screen.getByText('Patient fluid removal set to')).toBeInTheDocument()
  })

  it('leaves the pressure panel unchanged by the withholding', () => {
    const withheld = renderOperations(crrtPriorMakeupThenZeroState())
    const pressures = within(
      within(withheld.container).getByRole('list', { name: 'Simulated pressure signals' }),
    ).getAllByRole('listitem')
    expect(pressures).toHaveLength(6)
    expect(pressures.filter((item) => /Unavailable/.test(item.textContent ?? ''))).toHaveLength(0)
  })
})

describe('cumulative fluid attribution — architecture', () => {
  it('leaves the determination in the adapter, not in React', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/baxter-crrt/components/PrismaxPilotInterface.tsx'),
      'utf8',
    )
    // The component branches on the adapter's resolution and does no fluid work.
    expect(source).toMatch(/operations\.cumulativeFluid\.resolution === 'available'/)
    expect(source).not.toMatch(/makeupFlowMlHour/)
    expect(source).not.toMatch(/calculateCrrtMachineFluidLedger/)
    expect(source).not.toMatch(/cumulativePumpVolumeMl/)
    const imports = [...source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    )
    for (const pattern of [/circuitFluidLedger/, /engine\/fluidModel/, /engine\/clinicalMath/]) {
      expect(imports.filter((specifier) => pattern.test(specifier))).toEqual([])
    }
  })

  it('reads the ledger’s own resolution rather than inventing a second rule', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/baxter-crrt/engine/deviceAdapters/prismax.ts'),
      'utf8',
    )
    expect(source).toMatch(/calculateCrrtMachineFluidLedger/)
    expect(source).toMatch(/ledger\.resolution !== 'resolved'/)
    expect(source).toMatch(/CRRT_MAKEUP_ATTRIBUTION_CONFLICT/)
  })
})
