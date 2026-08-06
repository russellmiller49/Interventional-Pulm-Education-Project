import { baxterCrrtPilotFixtures } from '../content/pilotCases'
import { createInitialCrrtSimulationState } from '../engine/initialState'
import { crrtSimulationReducer } from '../engine/reducer'
import { createSyntheticFixture } from '../engine/testSupport/syntheticFixture'
import type { CrrtEngineFixture, CrrtSimulationState } from '../engine/types'
import {
  calculateCrrtMachineFluidLedger,
  checkCrrtFluidConservation,
  crrtLedgerIsFullyBalanced,
} from '../circuitFluidLedger'
import {
  auditCrrtFrames,
  auditCrrtSimulationFrame,
  collectCrrtNumericRows,
  crrtNumericMetricNames,
  crrtUnreachableDowntimeReasons,
} from '../numericAudit'

function runFixture(fixture: CrrtEngineFixture, steps = 12, stepSeconds = 3_600) {
  let state = crrtSimulationReducer(createInitialCrrtSimulationState({ fixture }), {
    type: 'SET_DELIVERY_STATE',
    deliveryState: 'running',
  })
  const frames: CrrtSimulationState[] = [state]
  for (let index = 0; index < steps; index += 1) {
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: stepSeconds })
    frames.push(state)
  }
  return frames
}

function syntheticFrames(steps = 12) {
  return runFixture(createSyntheticFixture(), steps)
}

describe('CRRT numeric audit on real engine runs', () => {
  it('raises no flag across a clean synthetic run', () => {
    expect(auditCrrtFrames(syntheticFrames())).toEqual([])
  })

  it('raises no flag across every authored pilot fixture', () => {
    expect(baxterCrrtPilotFixtures.length).toBeGreaterThan(0)
    for (const fixture of baxterCrrtPilotFixtures) {
      const flags = auditCrrtFrames(runFixture(fixture, 6))
      expect({ fixture: fixture.id, flags }).toEqual({ fixture: fixture.id, flags: [] })
    }
  })

  it('carries every metric the dump is required to print', () => {
    const frames = syntheticFrames(1)
    const last = frames[frames.length - 1]
    const names = crrtNumericMetricNames(last)
    const rows = collectCrrtNumericRows(last)

    // The closeout list, item by item, so a field cannot silently drop out.
    const required: Readonly<Record<string, readonly string[]>> = {
      'access pressure': ['access-pressure'],
      'filter pressure': ['filter-pressure'],
      'return pressure': ['return-pressure'],
      'effluent pressure': ['effluent-pressure'],
      TMP: ['transmembrane-pressure'],
      'filter pressure drop': ['filter-pressure-drop'],
      'filtration fraction': ['filtration-fraction'],
      'prescribed intensity': ['prescribed-effluent-rate', 'prescribed-effluent-dose'],
      'delivered intensity': ['delivered-dose', 'cumulative-actual-effluent'],
      'cumulative downtime': ['cumulative-downtime'],
      'downtime by reason': [
        'downtime.not-started',
        'downtime.paused',
        'downtime.access',
        'downtime.alarm',
        'downtime.bag-scale',
        'downtime.other',
      ],
      'machine fluid ledger': [
        'ledger.entering-blood-path',
        'ledger.never-enters-patient',
        'ledger.crossing-membrane',
        'ledger.total-effluent',
        'ledger.machine-patient-fluid-removal',
        'ledger.net-to-patient',
      ],
      'whole-patient ledger': [
        'patient-ledger.external-input',
        'patient-ledger.external-output',
        'patient-ledger.net-balance',
        'cumulative-whole-patient-balance',
        'cumulative-machine-patient-fluid-removal',
      ],
    }

    for (const [requirement, metrics] of Object.entries(required)) {
      for (const metric of metrics) {
        expect({ requirement, metric, present: names.includes(metric) }).toEqual({
          requirement,
          metric,
          present: true,
        })
      }
    }

    // Every printed row is a real value or an explicit null, never undefined.
    for (const row of rows) {
      expect(row.value === null || Number.isFinite(row.value)).toBe(true)
      expect(row.unit.length).toBeGreaterThan(0)
    }
  })

  it('labels each number as modelled, calculated, authored, or cumulative', () => {
    const frames = syntheticFrames(1)
    const rows = collectCrrtNumericRows(frames[frames.length - 1])
    const kindFor = (metric: string) => rows.find((row) => row.metric === metric)?.kind

    expect(kindFor('access-pressure')).toBe('modelled')
    expect(kindFor('filter-pressure')).toBe('modelled')
    expect(kindFor('return-pressure')).toBe('modelled')
    expect(kindFor('effluent-pressure')).toBe('modelled')
    expect(kindFor('transmembrane-pressure')).toBe('calculated')
    expect(kindFor('filter-pressure-drop')).toBe('calculated')
  })

  it('reports filtration fraction as an authored input, not a response to the flows', () => {
    const frames = syntheticFrames(1)
    const row = collectCrrtNumericRows(frames[frames.length - 1]).find(
      (candidate) => candidate.metric === 'filtration-fraction',
    )

    expect(row?.kind).toBe('authored')
    expect(row?.note).toMatch(/does not respond to the flows/i)

    // Prove the claim rather than only asserting the label: doubling every
    // fluid flow leaves the reported filtration fraction untouched.
    const base = frames[frames.length - 1]
    const doubled: CrrtSimulationState = {
      ...base,
      circuit: {
        ...base.circuit,
        flows: {
          ...base.circuit.flows,
          dialysateFlowMlHour: base.circuit.flows.dialysateFlowMlHour * 2,
          postReplacementFlowMlHour: base.circuit.flows.postReplacementFlowMlHour * 2,
        },
      },
    }
    const reported = (state: CrrtSimulationState) =>
      collectCrrtNumericRows(state).find((row) => row.metric === 'filtration-fraction')?.value

    expect(reported(doubled)).toBe(reported(base))
  })

  it('reports the alarm downtime bucket as unreachable rather than as a measured zero', () => {
    const frames = syntheticFrames(1)
    const row = collectCrrtNumericRows(frames[frames.length - 1]).find(
      (candidate) => candidate.metric === 'downtime.alarm',
    )

    expect(crrtUnreachableDowntimeReasons).toContain('alarm')
    expect(row?.note).toMatch(/never incremented/i)

    for (const reason of ['paused', 'access', 'bag-scale', 'other']) {
      const other = collectCrrtNumericRows(frames[frames.length - 1]).find(
        (candidate) => candidate.metric === `downtime.${reason}`,
      )
      expect(other?.note).toBeNull()
    }
  })
})

describe('CRRT numeric audit flag classes', () => {
  function lastFrame(): CrrtSimulationState {
    const frames = syntheticFrames(4)
    return frames[frames.length - 1]
  }

  it('fires on a nonfinite value', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      circuit: {
        ...base.circuit,
        pressures: { ...base.circuit.pressures, accessPressureMmHg: Number.NaN },
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    expect(flags.some((item) => item.kind === 'nonfinite-value')).toBe(true)
    expect(flags.find((item) => item.kind === 'nonfinite-value')?.metric).toBe('access-pressure')
  })

  it('fires on impossible conservation', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      deliveredTherapy: {
        ...base.deliveredTherapy,
        cumulativeWholePatientBalanceMl:
          base.deliveredTherapy.cumulativeWholePatientBalanceMl + 500,
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    expect(flags.some((item) => item.kind === 'impossible-conservation')).toBe(true)
  })

  it('fires when delivered effluent exceeds what the prescription permits', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      deliveredTherapy: {
        ...base.deliveredTherapy,
        cumulativeActualEffluentMl: base.deliveredTherapy.cumulativeActualEffluentMl * 10 + 1_000,
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    expect(flags.some((item) => item.kind === 'delivered-exceeds-possible')).toBe(true)
  })

  it('fires when treatment time exceeds set time', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      deliveredTherapy: {
        ...base.deliveredTherapy,
        treatmentTimeSeconds: base.deliveredTherapy.setTimeSeconds + 60,
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    expect(
      flags.some(
        (item) => item.kind === 'delivered-exceeds-possible' && item.metric === 'treatment-time',
      ),
    ).toBe(true)
  })

  it('fires when a value labelled calculated cannot be recomputed from the modelled sites', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      circuit: {
        ...base.circuit,
        pressures: {
          ...base.circuit.pressures,
          prismaxTransmembranePressureMmHg:
            (base.circuit.pressures.prismaxTransmembranePressureMmHg ?? 0) + 12,
        },
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    const mismatch = flags.find((item) => item.kind === 'measured-calculated-mismatch')
    expect(mismatch?.metric).toBe('transmembrane-pressure')
    expect(mismatch?.reason).toMatch(/presented as calculated, so it must be recomputable/i)
  })

  it('names the double-offset case specifically for the filter pressure drop', () => {
    const base = lastFrame()
    const filter = base.circuit.pressures.filterPressureMmHg ?? 0
    const returnPressure = base.circuit.pressures.returnPressureMmHg ?? 0
    // The displayed value with the -25 display offset applied a second time.
    const doubleOffset = filter - returnPressure - 25 - 25
    const broken: CrrtSimulationState = {
      ...base,
      circuit: {
        ...base.circuit,
        pressures: {
          ...base.circuit.pressures,
          prismaxFilterPressureDropMmHg: doubleOffset,
        },
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    const mismatch = flags.find((item) => item.metric === 'filter-pressure-drop')
    expect(mismatch?.reason).toMatch(/applied twice/i)
  })

  it('fires when the stored prescription no longer matches the flows', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      deliveredTherapy: {
        ...base.deliveredTherapy,
        prescribedEffluentRateMlHour:
          (base.deliveredTherapy.prescribedEffluentRateMlHour ?? 0) + 250,
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    expect(flags.some((item) => item.kind === 'stale-prescription')).toBe(true)
  })

  it('fires on an unexplained makeup term instead of reporting it as patient loss', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      circuit: {
        ...base.circuit,
        flows: { ...base.circuit.flows, makeupFlowMlHour: 40 },
      },
    }

    const flags = auditCrrtSimulationFrame(broken)
    const makeup = flags.filter((item) => item.kind === 'unexplained-makeup')
    expect(makeup.length).toBeGreaterThan(0)
    expect(makeup[0].reason).toMatch(/could not be checked/i)
    expect(makeup.some((item) => /makeup flow of 40 mL\/h/i.test(item.reason))).toBe(true)

    // The suppressed quantities must be reported as withheld, not as numbers.
    const rows = collectCrrtNumericRows(broken)
    const value = (metric: string) => rows.find((row) => row.metric === metric)?.value
    expect(value('ledger.machine-patient-fluid-removal')).toBeNull()
    expect(value('ledger.net-to-patient')).toBeNull()
    expect(value('ledger.crossing-membrane')).toBeNull()
    expect(value('patient-ledger.net-balance')).toBeNull()
    // And the effluent total, which the sources do state, is still stated.
    expect(value('ledger.total-effluent')).not.toBeNull()
  })

  it('never lets a suppressed makeup state read as a balanced ledger', () => {
    const base = lastFrame()
    const broken: CrrtSimulationState = {
      ...base,
      circuit: { ...base.circuit, flows: { ...base.circuit.flows, makeupFlowMlHour: 250 } },
    }

    const ledger = calculateCrrtMachineFluidLedger(broken.circuit.flows)
    const checks = checkCrrtFluidConservation(ledger)

    expect(ledger.resolution).toBe('unresolved-makeup-attribution')
    expect(crrtLedgerIsFullyBalanced(checks)).toBe(false)
    expect(checks.filter((check) => check.status === 'balanced')).toHaveLength(0)
    // The audit must speak up rather than pass silently.
    expect(auditCrrtSimulationFrame(broken).length).toBeGreaterThan(0)
  })
})
