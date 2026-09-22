/**
 * MV-PRE-REVIEW-02 — initialization, causality and gas exchange.
 *
 * Each block pins one contract this batch introduced, against the behaviour that was reproduced on
 * the base (`bf613270`). The numbers asserted are the model's own relationships and tolerances set by
 * sample cadence and breath-to-breath variability, not screenshot values; nothing here certifies
 * that a modeled response is clinically right.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BedsidePanel } from '../components/BedsidePanel'
import CaseActivity from '../components/MechanicalVentilationCaseActivityV2'
import { MechanicalVentilationTeachingPanel } from '../components/MechanicalVentilationTeachingPanel'
import { VentilationSafetyReassessment } from '../components/teaching/safety'
import { VentilationCo2Response } from '../components/teaching/ventilation'
import { formatMonitorField } from '../content/deviceDisplay'
import { peepComparisonTimeControl } from '../content/peepComparison'
import { coachingReadingSnapshot } from '../content/postActionCoaching'
import { patientReportAvailability } from '../content/patientReport'
import { referenceAlarmSet } from '../content/referenceAlarmSet'
import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import { baselineGasOrigin } from '../engine/arterialGas'
import { runPeepComparison } from '../engine/peepComparison'
import {
  ardsPeepBand,
  bicarbonateFromPhAndPaCO2,
  isCaseResolved,
  observedTidalVolumeMl,
  phFromBicarbonateAndPaCO2,
  spo2FromPaO2,
} from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import {
  PREPARED_HISTORY_SECONDS,
  advanceSimulation,
  applyIntervention,
  createInitialSimulationState,
  isPreparedHistorySample,
} from '../engine/simulation'
import { triggerDelayEvidence } from '../engine/triggerEvidence'
import {
  ventilatorDeviceIds,
  type VentilationAction,
  type VentilationSimulationState,
} from '../engine/types'
import { attemptForBranch, liveCaseIds, runInventoryArm } from '../test-support/causalInventory'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

const DEVICE = 'hamilton-c6'

afterEach(() => cleanup())

function opened(caseId: string, branch?: string, deviceId = DEVICE): VentilationSimulationState {
  const attempt = branch ? attemptForBranch(caseId, branch, deviceId) : 1
  return createInitialSimulationState(caseId, 'practice', attempt, deviceId)
}

function run(state: VentilationSimulationState, seconds: number): VentilationSimulationState {
  return advanceSimulation({ ...state, paused: false }, seconds)
}

function dispatch(state: VentilationSimulationState, ...actions: VentilationAction[]) {
  return actions.reduce(ventilationSimulationReducer, state)
}

const liveBranches = liveCaseIds().flatMap((caseId) =>
  mechanicalVentilationCaseById
    .get(caseId)!
    .branchOptions.map((branch) => ({ caseId, branch }) as const),
)

/* ------------------------------------------------------------------------------------------------
 * C4 — the case opens on a breath, from one continuous history, in its own epoch
 * ---------------------------------------------------------------------------------------------- */

describe('C4 · opening measurements come from a delivered breath', () => {
  it.each(liveBranches)(
    '$caseId · $branch opens with an exhaled breath on the trace',
    ({ caseId, branch }) => {
      const state = opened(caseId, branch)
      // Base: MV-04, MV-05, MV-07 and MV-12 had no completed inflation here and printed the analytic
      // prediction (MV-05 "VTE 1400", MV-12 "VTE 1021").
      expect(observedTidalVolumeMl(state.waveforms)).toBeDefined()
      expect(state.measurements.exhaledVtSource).toBe('trace')
      expect(state.waveforms.every(isPreparedHistorySample)).toBe(true)
      expect(state.waveforms[0].time).toBeLessThan(-11.9)
    },
  )

  it('does not open MV-05 or MV-12 on the clamped prediction', () => {
    expect(opened('MV-05').measurements.exhaledVtMl).toBeLessThan(400)
    expect(opened('MV-12').measurements.exhaledVtMl).toBeLessThan(800)
  })

  it.each(liveBranches)(
    '$caseId · $branch: the last prepared expiration is a whole expiration, not one cut short',
    ({ caseId, branch }) => {
      const state = opened(caseId, branch)
      const w = state.waveforms
      const onsets: number[] = []
      const offs: number[] = []
      for (let i = 1; i < w.length; i += 1) {
        if (w[i].phase === 'inspiration' && w[i - 1].phase === 'expiration') onsets.push(w[i].time)
        if (w[i].phase === 'expiration' && w[i - 1].phase === 'inspiration') offs.push(w[i].time)
      }
      const lastOnset = onsets.at(-1)!
      const previousOff = offs.filter((time) => time < lastOnset).at(-1)!
      const previousOnset = onsets.filter((time) => time < previousOff).at(-1)!
      // The expiration that ends at the last prepared onset lasts as long as the one before it
      // (within two samples). On the base the schedule restarted at zero and cut it short: MV-10's
      // to 0.02 s, MV-13's to 0.54 of 2.55 s.
      const expiration = lastOnset - previousOff
      const cycle = lastOnset - previousOnset
      const inspiration = previousOff - previousOnset
      expect(Math.abs(expiration - (cycle - inspiration))).toBeLessThan(0.05)
      expect(expiration).toBeGreaterThan(0.3)
    },
  )

  it('evaluates opening alarms on the patient shown, at time zero', () => {
    for (const { caseId, branch } of liveBranches) {
      const state = opened(caseId, branch)
      // Base: stamped 4 s — the end of the priming run — in a case that had not started.
      expect(state.alarms.every((alarm) => alarm.startedAt === 0)).toBe(true)
      expect(state.alarmHistory.every((alarm) => alarm.active)).toBe(true)
    }
  })

  it('opens with the authored presentation and no history the learner made', () => {
    for (const { caseId, branch } of liveBranches) {
      const state = opened(caseId, branch)
      const definition = mechanicalVentilationCaseById.get(caseId)!
      expect(state.simulationTime).toBe(0)
      expect(state.paused).toBe(true)
      expect(state.interventions).toEqual([])
      expect(state.holdRecords).toEqual([])
      expect(state.trends).toEqual([])
      expect(Object.values(state.risk).every((value) => value === 0)).toBe(true)
      expect(state.criticalErrors).toEqual([])
      expect(state.patient.gasExchange).toEqual(definition.initialPatient.gasExchange)
      expect(state.patient.human).toEqual(definition.initialPatient.human)
      expect(state.arterialGasSamples).toHaveLength(1)
    }
  })

  it('re-opens a fresh epoch on restart and on a device change, carrying nothing across', () => {
    const definition = mechanicalVentilationCaseById.get('MV-07')!
    let state = run(opened('MV-07'), 30)
    state = applyIntervention(state, definition, 'order-abg')
    state = dispatch(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
    state = run(state, 20)
    const restarted = dispatch(state, {
      type: 'LOAD_CASE',
      caseId: 'MV-07',
      experience: 'practice',
      attempt: 1,
    })
    expect(restarted).toEqual(opened('MV-07'))
    for (const deviceId of ventilatorDeviceIds) {
      const changed = dispatch(state, { type: 'CHANGE_DEVICE', deviceId })
      expect(changed.simulationTime).toBe(0)
      expect(changed.interventions).toEqual([])
      expect(changed.holdRecords).toEqual([])
      expect(changed.arterialGasSamples).toHaveLength(1)
      expect(changed.patient.gasExchange).toEqual(definition.initialPatient.gasExchange)
    }
  })

  it('gives the same patient on every console where the case settings are the same', () => {
    for (const caseId of liveCaseIds()) {
      const reference = opened(caseId)
      for (const deviceId of ventilatorDeviceIds) {
        const other = createInitialSimulationState(caseId, 'practice', 1, deviceId)
        if (
          JSON.stringify(other.ventilator.settings) !==
          JSON.stringify(reference.ventilator.settings)
        ) {
          continue // a documented device adaptation (rise-time bounds); a different ventilator setting
        }
        expect(other.patient).toEqual(reference.patient)
        expect(other.measurements).toEqual(reference.measurements)
        expect(other.waveforms).toEqual(reference.waveforms)
      }
    }
  })

  it('prints no exhaled volume on a console until a breath has been exhaled', () => {
    const cold: VentilationSimulationState = {
      ...opened('MV-12'),
      waveforms: [],
      measurements: { ...opened('MV-12').measurements, exhaledVtSource: 'predicted' },
    }
    expect(
      formatMonitorField(cold, { metric: 'exhaledTidalVolume', label: 'VTE', unit: 'ml' }),
    ).toBe('---')
    expect(
      formatMonitorField(cold, { metric: 'minuteVolume', label: 'ExpMinVol', unit: 'l/min' }),
    ).toBe('---')
    const warm = opened('MV-12')
    expect(
      formatMonitorField(warm, { metric: 'exhaledTidalVolume', label: 'VTE', unit: 'ml' }),
    ).toBe(warm.measurements.exhaledVtMl.toFixed(0))
  })

  it('does not raise a low-volume alarm off a predicted volume', () => {
    const cold = run(
      {
        ...opened('MV-09'),
        waveforms: [],
        ventilator: { ...opened('MV-09').ventilator, frozen: true },
      },
      0.1,
    )
    expect(cold.measurements.exhaledVtSource).toBe('predicted')
    expect(cold.alarms.map((alarm) => alarm.code)).not.toContain('VT_LOW')
  })
})

/* ------------------------------------------------------------------------------------------------
 * C1 — no action changes nothing the case does not contain; actions are attributable
 * ---------------------------------------------------------------------------------------------- */

describe('C1 · untreated trajectories and matched-time attribution', () => {
  it.each(liveBranches)(
    '$caseId · $branch holds its presentation for three untreated minutes',
    ({ caseId, branch }) => {
      const start = opened(caseId, branch)
      const later = run(start, 180)
      const g0 = start.patient.gasExchange
      const g1 = later.patient.gasExchange
      // Base: MV-14 SpO₂ 76 → 97, MV-08 98 → 86, MV-01 84 → 94, MV-05 PaCO₂ 62 → 92.
      expect(Math.abs(g1.paO2MmHg - g0.paO2MmHg)).toBeLessThan(0.5)
      expect(Math.abs(g1.spo2Percent - g0.spo2Percent)).toBeLessThan(0.5)
      // Delivered minute ventilation varies breath to breath; the anchor is its average.
      expect(Math.abs(g1.paCO2MmHg - g0.paCO2MmHg)).toBeLessThan(2.5)
      const h0 = start.patient.hemodynamics
      const h1 = later.patient.hemodynamics
      const faultActs = h0.obstructiveShock && h0.mapMmHg > 42
      if (faultActs) {
        // The authored obstructive-shock ceiling is a fault state, and it still acts untreated.
        expect(h1.mapMmHg).toBeLessThan(h0.mapMmHg)
      } else {
        expect(Math.abs(h1.mapMmHg - h0.mapMmHg)).toBeLessThan(1.5)
        expect(Math.abs(h1.heartRatePerMin - h0.heartRatePerMin)).toBeLessThan(2)
        // Base: MV-01 108/62 became 116/58 on the first step.
        expect(Math.abs(h1.systolicMmHg - h0.systolicMmHg)).toBeLessThanOrEqual(2)
      }
      const deepSedation = start.patient.human.sedationScore <= -4
      if (!deepSedation) {
        // Base: MV-02 dyspnea 6.0 → 2.5 and MV-15 8.0 → 6.1 without anything being done.
        expect(
          Math.abs(later.patient.human.dyspneaScore - start.patient.human.dyspneaScore),
        ).toBeLessThan(0.3)
      }
    },
  )

  function atTime(caseId: string, branch: string, actions: readonly [number, VentilationAction][]) {
    const armed = runInventoryArm({
      caseId,
      branch,
      sampleTimes: [60, 180],
      arm: {
        id: 'arm',
        label: 'arm',
        actions: actions.map(([at, action]) => ({ at, label: action.type, action })),
      },
    })
    const control = runInventoryArm({
      caseId,
      branch,
      sampleTimes: [60, 180],
      arm: { id: 'none', label: 'none', actions: [] },
    })
    return { arm: armed.snapshots, control: control.snapshots }
  }

  it('MV-01: PEEP in the recruiting band raises saturation against the matched control', () => {
    const { arm, control } = atTime('MV-01', 'standard', [
      [12, { type: 'SET_CONTROL', control: 'peepCmH2O', value: 10 }],
    ])
    expect(arm[1].gas.spo2 - control[1].gas.spo2).toBeGreaterThan(5)
    expect(control[1].gas.spo2).toBe(84)
    expect(control[1].alarms).toContain('SPO2_LOW')
  })

  it('MV-01: overdistending PEEP lowers MAP and raises plateau against the matched control', () => {
    const { arm, control } = atTime('MV-01', 'standard', [
      [12, { type: 'SET_CONTROL', control: 'peepCmH2O', value: 16 }],
    ])
    expect(control[1].hemodynamics.map - arm[1].hemodynamics.map).toBeGreaterThan(10)
    expect(arm[1].breath.plateauEstimateCmH2O).toBeGreaterThan(
      control[1].breath.plateauEstimateCmH2O,
    )
  })

  it('MV-14: decompression restores compliance and MAP; oxygenation has no modeled dependency', () => {
    const { arm, control } = atTime('MV-14', 'unstable', [
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'decompress-pneumothorax' }],
    ])
    expect(arm[1].hemodynamics.map - control[1].hemodynamics.map).toBeGreaterThan(15)
    expect(
      control[1].breath.plateauEstimateCmH2O - arm[1].breath.plateauEstimateCmH2O,
    ).toBeGreaterThan(20)
    // Stated on the case page (content/caseModelNotes.ts) and held for review; not drifting in
    // either arm, where the base let both climb identically to 97 %.
    expect(arm[1].gas.spo2).toBe(control[1].gas.spo2)
    expect(control[1].gas.spo2).toBe(76)
  })

  it('MV-13: the treatment that reaches the branch lowers peak pressure; the wrong one does nothing', () => {
    const right = atTime('MV-13', 'secretions', [
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'inspect-circuit' }],
      [33, { type: 'PERFORM_INTERVENTION', interventionId: 'suction-airway' }],
    ])
    expect(right.control[1].breath.peakCmH2O - right.arm[1].breath.peakCmH2O).toBeGreaterThan(15)
    const wrong = atTime('MV-13', 'secretions', [
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'bronchodilator' }],
    ])
    expect(wrong.arm[1].breath).toEqual(wrong.control[1].breath)
  })

  it('MV-08: stopping the false triggers lets the alkalosis correct, and only then', () => {
    const { arm, control } = atTime('MV-08', 'condensate', [
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'inspect-circuit' }],
      [33, { type: 'PERFORM_INTERVENTION', interventionId: 'drain-condensate' }],
    ])
    expect(control[1].gas.paCO2).toBeCloseTo(29, 0)
    expect(arm[1].gas.paCO2 - control[1].gas.paCO2).toBeGreaterThan(8)
    expect(arm[1].breath.totalRatePerMin).toBeLessThan(control[1].breath.totalRatePerMin)
  })

  it('MV-15: asking and treating relieves distress; deep sedation silences the report instead', () => {
    const treat = atTime('MV-15', 'pain-bladder-delirium', [
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'communication-board' }],
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'treat-pain' }],
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'relieve-bladder' }],
      [12, { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 11 }],
      [12, { type: 'SET_CONTROL', control: 'pRampMs', value: 100 }],
    ])
    expect(treat.control[1].human.dyspnea).toBe(8)
    expect(treat.control[1].human.dyspnea - treat.arm[1].human.dyspnea).toBeGreaterThan(3)
    const sedated = atTime('MV-15', 'pain-bladder-delirium', [
      [12, { type: 'PERFORM_INTERVENTION', interventionId: 'deepen-sedation' }],
    ])
    expect(sedated.arm[1].human.rass).toBe(-5)
    expect(sedated.arm[1].human.reportability).toBe('index-only')
    expect(sedated.control[1].human.reportability).toBe('reported')
  })

  it('MV-05: the authored correction delivers real breaths, not one-sample flickers', () => {
    // Base: PS 18 → 12 with ETS 25 → 40 made the delivered rate flicker, the breath clock re-grid
    // into one-sample inspirations, and the console report an exhaled volume of 1–2 mL.
    const { arm, control } = atTime('MV-05', 'pressure-support-dominant', [
      [12, { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 12 }],
      [12, { type: 'SET_CONTROL', control: 'etsPercent', value: 40 }],
    ])
    expect(arm[0].breath.exhaledVtMl).toBeGreaterThan(150)
    expect(arm[1].breath.exhaledVtMl).toBeGreaterThan(150)
    expect(arm[1].breath.intrinsicPeepCmH2O).toBeLessThan(control[1].breath.intrinsicPeepCmH2O)
    expect(arm[1].breath.totalRatePerMin).toBeGreaterThan(control[1].breath.totalRatePerMin)
  })

  it('keeps a patient-triggered breath aligned with its effort when the rate changes', () => {
    // A one-off re-grid must not shift every later breath off the neural effort: MV-07 with every
    // effort captured delivers the same breath the absolute grid always gave.
    const state = run(
      dispatch(run(opened('MV-07'), 12), {
        type: 'SET_CONTROL',
        control: 'triggerThreshold',
        value: 1.5,
      }),
      60,
    )
    expect(state.measurements.totalRatePerMin).toBe(26)
    expect(state.measurements.exhaledVtMl).toBeGreaterThan(240)
  })
})

/* ------------------------------------------------------------------------------------------------
 * Scheduling — 1×, 5× and 30× are the same model handed time differently
 * ---------------------------------------------------------------------------------------------- */

describe('scheduling invariance', () => {
  it.each([
    { caseId: 'MV-01', branch: 'standard', actions: [] },
    {
      caseId: 'MV-14',
      branch: 'unstable',
      actions: [
        {
          at: 12,
          label: 'decompress',
          action: {
            type: 'PERFORM_INTERVENTION',
            interventionId: 'decompress-pneumothorax',
          } as VentilationAction,
        },
      ],
    },
    {
      caseId: 'MV-05',
      branch: 'pressure-support-dominant',
      actions: [
        {
          at: 12,
          label: 'ps',
          action: {
            type: 'SET_CONTROL',
            control: 'pressureSupportCmH2O',
            value: 12,
          } as VentilationAction,
        },
      ],
    },
  ])('$caseId gives identical readings at 1×, 5× and 30×', ({ caseId, branch, actions }) => {
    const runs = ([1, 5, 30] as const).map(
      (speed) =>
        runInventoryArm({
          caseId,
          branch,
          speed,
          sampleTimes: [30, 60, 150, 180],
          arm: { id: 'a', label: 'a', actions },
        }).snapshots,
    )
    expect(runs[1]).toEqual(runs[0])
    expect(runs[2]).toEqual(runs[0])
  })
})

/* ------------------------------------------------------------------------------------------------
 * C5 — the presenting gas is one coherent tuple, and says where it came from
 * ---------------------------------------------------------------------------------------------- */

describe('C5 · presenting gas coherence and provenance', () => {
  it.each(liveCaseIds())(
    '%s: pH, PaCO₂ and bicarbonate agree under the model’s own equation',
    (caseId) => {
      const definition = mechanicalVentilationCaseById.get(caseId)!
      const gas = definition.initialPatient.gasExchange
      const provenance = definition.initialGasProvenance!
      const computed = phFromBicarbonateAndPaCO2(gas.bicarbonateMmolL, gas.paCO2MmHg)
      if (Object.values(provenance).every((origin) => origin === 'case-source')) {
        // MV-01 and MV-02 print all three; they agree to the precision the casebook prints them
        // (HCO₃⁻ to the nearest integer moves pH by up to ±0.02 at these PaCO₂ values).
        expect(Math.abs(computed - gas.pH)).toBeLessThan(0.025)
      } else {
        expect(computed).toBeCloseTo(gas.pH, 6)
      }
    },
  )

  it('derives the bicarbonate the casebook left out instead of defaulting it to 24', () => {
    // Base: MV-05 7.33 / 62 / 24, which the model turned into pH 7.21 on its first step.
    const mv05 = mechanicalVentilationCaseById.get('MV-05')!
    expect(mv05.initialGasProvenance?.bicarbonateMmolL).toBe('derived')
    expect(mv05.initialPatient.gasExchange.bicarbonateMmolL).toBeCloseTo(
      bicarbonateFromPhAndPaCO2(7.33, 62),
      6,
    )
    const oneSecond = run(opened('MV-05'), 1)
    expect(oneSecond.patient.gasExchange.pH).toBeCloseTo(7.33, 2)
  })

  it('puts a PaO₂ the casebook left out on the model’s own saturation curve', () => {
    // Base: MV-14 76 % beside 76 mmHg (curve: 96 %); MV-13 88 % beside 83 mmHg (curve: 96 %).
    for (const caseId of ['MV-13', 'MV-14']) {
      const gas = mechanicalVentilationCaseById.get(caseId)!.initialPatient.gasExchange
      expect(spo2FromPaO2(gas.paO2MmHg)).toBeCloseTo(gas.spo2Percent, 6)
    }
  })

  it('names a specimen the casebook never supplied as the simulator’s', () => {
    expect(baselineGasOrigin(opened('MV-14').arterialGasSamples[0])).toBe('simulator-start')
    expect(baselineGasOrigin(opened('MV-05').arterialGasSamples[0])).toBe('partly-supplied')
    expect(baselineGasOrigin(opened('MV-01').arterialGasSamples[0])).toBe('supplied')
    const { container } = render(
      <BedsidePanel
        state={opened('MV-05')}
        definition={mechanicalVentilationCaseById.get('MV-05')!}
      />,
    )
    expect(container.querySelector('[data-abg-provenance]')?.textContent).toMatch(
      /HCO₃⁻ computed from the casebook’s other two values/,
    )
  })

  it('moves CO₂ in proportion to delivered ventilation from the patient’s own anchor', () => {
    const start = opened('MV-01')
    const halved = run(dispatch(start, { type: 'SET_CONTROL', control: 'vtMl', value: 210 }), 600)
    // Twice the anchor, within the 180 s time constant after ten minutes.
    expect(halved.patient.gasExchange.paCO2MmHg).toBeGreaterThan(
      start.patient.gasExchange.paCO2MmHg * 1.8,
    )
    expect(start.physiologyReference.paCO2MmHg).toBe(52)
  })
})

/* ------------------------------------------------------------------------------------------------
 * S9-1 / S9-2 — the matched comparison and the unmapped PEEP
 * ---------------------------------------------------------------------------------------------- */

describe('S9 · PEEP comparison and the PEEP-13 region', () => {
  it('holds the recruited state at PEEP 13 instead of reverting to the PEEP-5 lung', () => {
    expect([5, 7, 8, 12, 12.5, 13, 13.5, 14, 18].map(ardsPeepBand)).toEqual([
      'baseline',
      'baseline',
      'recruited',
      'recruited',
      'recruited',
      'recruited',
      'recruited',
      'overdistended',
      'overdistended',
    ])
    const at = (peep: number) =>
      run(
        dispatch(opened('MV-01'), { type: 'SET_CONTROL', control: 'peepCmH2O', value: peep }),
        120,
      )
    const [twelve, thirteen, fourteen] = [12, 13, 14].map(at)
    // Delivered as 13 — only the lung-state lookup is held.
    expect(thirteen.ventilator.settings.peepCmH2O).toBe(13)
    expect(thirteen.patient.mechanics.complianceLPerCmH2O).toBe(
      twelve.patient.mechanics.complianceLPerCmH2O,
    )
    // Base: 12 → 13 fell back to the PEEP-5 shunt and dropped saturation, then 14 rose again.
    expect(thirteen.patient.gasExchange.spo2Percent).toBeLessThanOrEqual(
      twelve.patient.gasExchange.spo2Percent + 0.01,
    )
    expect(thirteen.patient.gasExchange.spo2Percent).toBeGreaterThanOrEqual(
      fourteen.patient.gasExchange.spo2Percent - 0.01,
    )
    expect(isCaseResolved(thirteen, mechanicalVentilationCaseById.get('MV-01')!)).toBe(true)
  })

  it('reads the time-control sentence off the arms that were run', () => {
    const result = runPeepComparison(10, 45)
    expect(peepComparisonTimeControl(result)).toMatch(/does not drift/)
    expect(peepComparisonTimeControl(result)).not.toMatch(/rises while waiting/)
    const drifting = {
      ...result,
      unchanged: {
        ...result.unchanged,
        patient: {
          ...result.unchanged.patient,
          gasExchange: { ...result.unchanged.patient.gasExchange, spo2Percent: 92 },
        },
      },
    }
    expect(peepComparisonTimeControl(drifting)).toMatch(/also moves at PEEP 5/)
  })

  it('says which window the live oxygenation panel’s arrows compare', () => {
    const state = run(opened('MV-01'), 45)
    render(<MechanicalVentilationTeachingPanel lessonId="oxygenation-response" state={state} />)
    expect(document.body.textContent).toMatch(/last 30 simulated seconds[^.]*from 1[56] to 4[45] s/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * S10-1 — the CO₂ explanation is the model that runs
 * ---------------------------------------------------------------------------------------------- */

describe('S10-1 · CO₂ explanation', () => {
  it('states the relationship the model computes and names the unused descriptors', () => {
    const state = run(createInitialSimulationState('MV-LAB', 'learn', 1, DEVICE), 30)
    const { container } = render(<VentilationCo2Response state={state} />)
    const model = container.querySelector('[data-co2-model]')?.textContent ?? ''
    expect(model).toMatch(/inverse proportion to the minute ventilation actually delivered/)
    expect(model).toMatch(/will not reproduce the number on screen/)
    expect(model).toMatch(/Minute ventilation is not alveolar ventilation/)
    // The dead-space fraction is no longer a row of the delivery tier.
    const delivery = container.querySelector('[data-tier="delivery"]')?.textContent ?? ''
    expect(delivery).not.toMatch(/Dead-space/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * C3 / S13-1 — alarms are what the console raises
 * ---------------------------------------------------------------------------------------------- */

describe('C3 · MV-13 high-pressure alarm', () => {
  it.each(
    ventilatorDeviceIds.flatMap((deviceId) =>
      ['secretions', 'hme-or-ett', 'bronchospasm'].map((branch) => ({ deviceId, branch })),
    ),
  )(
    '$deviceId · $branch: no alarm is injected and the limit is the case’s',
    ({ deviceId, branch }) => {
      const state = run(opened('MV-13', branch, deviceId), 30)
      expect(state.deviceId).toBe(deviceId)
      expect(state.ventilator.settings.highPressureLimitCmH2O).toBe(60)
      expect(state.measurements.peakPressureCmH2O).toBeLessThan(60 - 3)
      expect(state.alarms.map((alarm) => alarm.code)).not.toContain('HIGH_PRESSURE')
    },
  )

  it('states the mismatch beside the stem instead of painting an alarm', () => {
    jest.useFakeTimers()
    render(<CaseActivity caseId="MV-13" deviceId={DEVICE} mode="challenge" section="practice" />)
    act(() => jest.advanceTimersByTime(10))
    const note = document.querySelector('[data-case-model-note]')?.textContent ?? ''
    expect(note).toMatch(/high-pressure limit at 60 cmH₂O/)
    expect(note).toMatch(/held for RT and device review/)
    expect(screen.queryByText('High pressure')).toBeNull()
    jest.useRealTimers()
  })
})

describe('S13-1 · the alarm-sorting panel', () => {
  it('sorts a separate, labelled reference set when the live patient has no alarm', () => {
    const live = opened('MV-15')
    expect(live.alarms).toEqual([])
    const { container } = render(<VentilationSafetyReassessment state={live} />)
    const figure = container.querySelector('[data-alarm-source]')!
    expect(figure.getAttribute('data-alarm-source')).toBe('reference')
    expect(figure.getAttribute('data-reference-case')).toBe('MV-14')
    expect(container.textContent).toMatch(/Your patient has no active alarm/)
    // The reference is what the simulator raises for MV-14 as it opens, and nothing was added to MV-15.
    expect(
      referenceAlarmSet(DEVICE)
        .alarms.map((alarm) => alarm.code)
        .sort(),
    ).toEqual(['MAP_LOW', 'PRESSURE_LIMITATION', 'SPO2_LOW'].sort())
    expect(live.alarms).toEqual([])
  })

  it('sorts the live patient’s own alarms when it has some', () => {
    const { container } = render(<VentilationSafetyReassessment state={opened('MV-06')} />)
    expect(container.querySelector('[data-alarm-source]')?.getAttribute('data-alarm-source')).toBe(
      'live',
    )
  })
})

/* ------------------------------------------------------------------------------------------------
 * C6 — a report needs a patient who can give one
 * ---------------------------------------------------------------------------------------------- */

describe('C6 · symptoms and reportability', () => {
  it('takes the report away with deep sedation or paralysis, keeping the index', () => {
    const definition = mechanicalVentilationCaseById.get('MV-15')!
    const sedated = run(
      applyIntervention(run(opened('MV-15'), 5), definition, 'deepen-sedation'),
      60,
    )
    expect(sedated.patient.human.canCommunicate).toBe(false)
    expect(patientReportAvailability(sedated).availability).toBe('index-only')
    expect(coachingReadingSnapshot(sedated).dyspnea).toBeNull()
    expect(coachingReadingSnapshot(sedated).pain).toBeNull()
    expect(coachingReadingSnapshot(run(opened('MV-15'), 5)).dyspnea).toBe(8)
  })

  it('does not print the dyspnea score on Practice until the patient has been asked', () => {
    jest.useFakeTimers()
    render(<CaseActivity caseId="MV-06" deviceId={DEVICE} mode="challenge" section="practice" />)
    act(() => jest.advanceTimersByTime(10))
    const grid = document.querySelector('[aria-label="Current comfort and sedation"]')!
    expect(grid.textContent).toMatch(/DyspneaAssess patient/)
    expect(document.querySelector('[data-consciousness-boundary]')?.textContent).toMatch(
      /does not lower consciousness/,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Assess the patient at the bedside' }))
    expect(grid.textContent).toMatch(/3\.0 \/ 10 · Patient report · modeled/)
    jest.useRealTimers()
  })

  it('labels the index of a patient who cannot answer as an index, not a report', () => {
    const { container } = render(
      <BedsidePanel
        state={opened('MV-04')}
        definition={mechanicalVentilationCaseById.get('MV-04')!}
      />,
    )
    expect(container.textContent).toMatch(/Internal index · not a patient report/)
    expect(container.textContent).not.toMatch(/reports severe breathing discomfort/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * D5 carry-forward — the trigger contract from batch 01 still holds on the new engine
 * ---------------------------------------------------------------------------------------------- */

describe('D5 · trigger evidence after the engine changes', () => {
  it('never reports a measured trigger interval on a live case, because none exists in the model', () => {
    for (const caseId of liveCaseIds()) {
      let state = opened(caseId)
      for (let index = 0; index < 120; index += 1) {
        state = run(state, 0.5)
        expect(triggerDelayEvidence(state).status).not.toBe('measured')
      }
      const w = state.waveforms
      for (let i = 2; i < w.length; i += 1) {
        if (w[i].phase === 'inspiration' && w[i - 1].phase === 'expiration') {
          // No live case produces an effort that is under way before the breath it would trigger.
          expect(-w[i - 1].pmusCmH2O).toBeLessThan(1.5)
        }
      }
    }
  })
})

it('keeps the held clinical case out of every live replay', () => {
  expect(liveCaseIds()).not.toContain('MV-03')
  expect(liveCaseIds()).toHaveLength(14)
  expect(PREPARED_HISTORY_SECONDS).toBeGreaterThanOrEqual(12)
})
