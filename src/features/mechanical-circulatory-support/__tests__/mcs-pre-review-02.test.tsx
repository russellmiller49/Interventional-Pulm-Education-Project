import { fireEvent, render, screen } from '@testing-library/react'

import {
  MCS_IABP_PRESSURE_SCALE,
  MCS_IABP_REFERENCE_LANDMARKS,
  MCS_IABP_REFERENCE_SOURCE_ID,
} from '../content/iabpWaveformReference'
import { mcsLessonTransfers } from '../content/lessonTransfers'
import { mcsScenarioById } from '../content/scenarios'
import { mcsSectionLearningContract } from '../content/sectionLearningContracts'
import { mcsSources } from '../content/sources'
import { mcsStoryProblems } from '../content/storyProblems'
import { MCS_UNLOADING_BASE_LEVEL } from '../content/unloadingExamples'
import { McsIabpWaveformReference } from '../components/stage/McsIabpWaveformReference'
import { McsUnloadingComparison } from '../components/stage/McsUnloadingComparison'
import { afterloadCostView, inflowLimitView } from '../components/teaching/selectors'
import {
  LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD,
  LVAD_HIGH_AFTERLOAD_MAP_MMHG,
  LVAD_SUSPECTED_THROMBOSIS_POWER_W,
} from '../engine/model'
import { replayMcsUnloadingComparison } from '../engine/unloadingComparison'
import type { McsAction } from '../engine/types'
import { mcsReplay, type McsReplayProbe } from '../test-support/replayHarness'

/**
 * MCS-PRE-REVIEW-02 — the coupled-model contract.
 *
 * Every number asserted below was read off the production reducer through the replay harness, at
 * matched simulated times, with a no-action control in the same comparison. The suite exists to
 * hold two different kinds of statement:
 *
 *  - **preservation.** The physiology, the thresholds, the waveform amplitudes and the answer keys
 *    this slice deliberately did not touch are pinned here, so a later change that quietly moves
 *    one has to say so. Several of these are the *unrepaired* behaviours that OD-02 and OD-03 own;
 *    pinning them is not endorsing them, and each says which decision it belongs to.
 *  - **the repairs.** Each one is stated as the thing a learner can now read, not as the presence
 *    of a string.
 *
 * Positive and negative controls run together throughout: a claim that something responds is paired
 * with a state where it must not, so deleting a phenomenon cannot pass as fixing it.
 */

const IMPELLA_SECTION_SUCTION: readonly McsAction[] = [
  { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.36 },
  { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 7 },
]

const setRv = (value: number): McsAction => ({
  type: 'SET_PATIENT_CONTROL',
  control: 'rightVentricularContractility',
  value,
})

const setSvr = (value: number): McsAction => ({
  type: 'SET_PATIENT_CONTROL',
  control: 'systemicVascularResistanceDynSecCm5',
  value,
})

const impella = (probe: McsReplayProbe) => {
  if (probe.diagnostics.kind !== 'impella') throw new Error('expected impella diagnostics')
  return probe.diagnostics
}

const lvad = (probe: McsReplayProbe) => {
  if (probe.diagnostics.kind !== 'lvad') throw new Error('expected lvad diagnostics')
  return probe.diagnostics
}

const section = (id: string) => mcsSectionLearningContract(id)

describe('MCS-PRE-REVIEW-02 · the replay harness reads the production model', () => {
  it('gives every arm the same starting state and the same model time', () => {
    const result = mcsReplay({ id: 'matched-time', device: 'impella' }, [
      { id: 'no-action' },
      { id: 'rv-down', actions: [setRv(0.2)] },
      { id: 'rv-up', actions: [setRv(1.2)] },
    ])
    const times = Object.values(result.arms).map((probe) => probe.timeSeconds)
    for (const time of times) expect(time).toBeCloseTo(result.baseline.timeSeconds + 8.02, 8)
    expect(Math.max(...times) - Math.min(...times)).toBeLessThan(1e-9)
  })

  it('conserves the modeled circulating volume across every arm', () => {
    const result = mcsReplay({ id: 'conservation', device: 'impella' }, [
      { id: 'no-action' },
      { id: 'rv-down', actions: [setRv(0.2)] },
      {
        id: 'level-9',
        actions: [
          { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 9 },
        ],
      },
      {
        id: 'rp-on',
        actions: [{ type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true }],
      },
    ])
    // The solver holds the total at 4100 × circulatingVolumeFraction + 260 mL. None of these arms
    // touches preload, so every one of them must land on the same total.
    for (const probe of Object.values(result.arms))
      expect(probe.totalCirculatingVolumeMl).toBeCloseTo(
        result.baseline.totalCirculatingVolumeMl,
        0,
      )
  })

  it('returns the same values whatever order the arms are replayed in', () => {
    const forward = mcsReplay({ id: 'order', device: 'impella', setup: IMPELLA_SECTION_SUCTION }, [
      { id: 'a' },
      { id: 'b', actions: [setRv(0.9)] },
    ])
    const reverse = mcsReplay({ id: 'order', device: 'impella', setup: IMPELLA_SECTION_SUCTION }, [
      { id: 'b', actions: [setRv(0.9)] },
      { id: 'a' },
    ])
    expect(forward.arms.a.metrics).toEqual(reverse.arms.a.metrics)
    expect(forward.arms.b.metrics).toEqual(reverse.arms.b.metrics)
  })

  it('keeps the stopped, unpowered and correct-topology controls behaving as before', () => {
    const result = mcsReplay({ id: 'regression-controls', device: 'lvad' }, [
      { id: 'running' },
      { id: 'stopped', actions: [{ type: 'SET_LVAD_CONTROL', control: 'running', value: false }] },
      {
        id: 'power-off',
        actions: [{ type: 'SET_LVAD_CONTROL', control: 'powerConnected', value: false }],
      },
    ])
    expect(result.arms.running.metrics.deviceFlowLMin).toBeGreaterThan(3)
    for (const armId of ['stopped', 'power-off']) {
      const probe = result.arms[armId]
      expect(probe.metrics.deviceFlowLMin).toBe(0)
      expect(probe.metrics.pumpPowerW).toBe(0)
      // With no pump transfer the effective flow is the native contribution and nothing else.
      expect(probe.metrics.effectiveSystemicFlowLMin).toBeCloseTo(probe.metrics.nativeFlowLMin, 2)
    }
    expect(result.arms['power-off'].activeAlarmIds).toContain('lvad-power-disconnected')
  })

  it('keeps right-sided support serial rather than additive, and recirculation subtractive', () => {
    const rp = mcsReplay({ id: 'serial-rp', device: 'impella', setup: IMPELLA_SECTION_SUCTION }, [
      { id: 'rp-off' },
      {
        id: 'rp-on',
        actions: [{ type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true }],
      },
    ])
    const on = rp.arms['rp-on']
    expect(on.metrics.rightDeviceFlowLMin).toBeGreaterThan(0)
    // Effective systemic delivery is native + left pump − regurgitant return. The right pump's
    // litres are in series across the lungs and never appear as a second systemic stream.
    expect(on.metrics.effectiveSystemicFlowLMin).toBeCloseTo(
      on.metrics.nativeFlowLMin + on.metrics.leftDeviceFlowLMin - on.metrics.recirculatingFlowLMin,
      1,
    )

    const ai = mcsReplay({ id: 'recirculation', device: 'lvad' }, [
      { id: 'none' },
      {
        id: 'severe',
        actions: [
          { type: 'SET_PATIENT_CONTROL', control: 'aorticInsufficiencySeverity', value: 1 },
        ],
      },
    ])
    expect(ai.arms.none.metrics.recirculatingFlowLMin).toBe(0)
    expect(ai.arms.severe.metrics.recirculatingFlowLMin).toBeGreaterThan(0)
    expect(ai.arms.severe.activeAlarmIds).toContain('lvad-recirculation')
  })
})

describe('MCS-PRE-REVIEW-02 · F25 and F21 — what limits left-sided inflow', () => {
  it('names right-sided delivery as the limiting term in the section-6 suction state', () => {
    const result = mcsReplay(
      { id: 'section-6', device: 'impella', setup: IMPELLA_SECTION_SUCTION },
      [{ id: 'no-action' }],
    )
    const probe = result.arms['no-action']
    const diagnostics = impella(probe)
    expect(probe.activeAlarmIds).toContain('impella-left-suction')
    expect(diagnostics.leftPreloadLimiter).toBe('rv-delivery')
    expect(diagnostics.leftPreloadFactor).toBeLessThan(LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD)
    // The point of the finding: the displayed filling numbers are high at the same instant, and
    // neither of them is what raised the alarm. Both readings are correct.
    expect(probe.metrics.pcwpMmHg).toBeGreaterThanOrEqual(18)
    expect(probe.metrics.lvedvMl).toBeGreaterThan(120)
  })

  it('says so on the alarm itself rather than claiming the ventricle is empty', () => {
    const result = mcsReplay(
      { id: 'suction-alarm-copy', device: 'impella', setup: IMPELLA_SECTION_SUCTION },
      [{ id: 'no-action' }],
    )
    const alarm = result.arms['no-action'].state.alarms.find(
      (entry) => entry.id === 'impella-left-suction',
    )!
    expect(alarm.explanation).toMatch(/right-sided delivery/i)
    expect(alarm.explanation).not.toMatch(/available LV blood volume/i)
  })

  it('offers the limiting term to the suction panel, with the threshold beside it', () => {
    const result = mcsReplay(
      { id: 'suction-panel', device: 'impella', setup: IMPELLA_SECTION_SUCTION },
      [{ id: 'no-action' }],
    )
    const view = inflowLimitView(result.arms['no-action'].state)!
    expect(view.limiter).toBe('rv-delivery')
    expect(view.suction).toBe(true)
    expect(view.threshold).toBe(LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD)
    expect(view.label).toMatch(/right-sided delivery/i)
    // Negative control: a device with no left-sided inflow minimum has no such view.
    const lvadResult = mcsReplay({ id: 'no-view', device: 'lvad' }, [{ id: 'arm' }])
    expect(inflowLimitView(lvadResult.arms.arm.state)).toBeNull()
  })

  it('clears the suction state when right-sided delivery is restored, and not when the level rises', () => {
    const result = mcsReplay(
      { id: 'suction-response', device: 'impella', setup: IMPELLA_SECTION_SUCTION },
      [
        { id: 'no-action' },
        {
          id: 'level-9',
          actions: [
            { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 9 },
          ],
        },
        {
          id: 'rp-on',
          actions: [{ type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true }],
        },
      ],
    )
    // Positive control: the term the alarm turns on is the one that has to move.
    expect(impella(result.arms['rp-on']).leftPreloadFactor).toBeGreaterThan(
      LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD,
    )
    expect(result.arms['rp-on'].activeAlarmIds).not.toContain('impella-left-suction')
    // Negative control: asking the pump for more does not move it at all.
    expect(impella(result.arms['level-9']).leftPreloadFactor).toBeCloseTo(
      impella(result.arms['no-action']).leftPreloadFactor,
      6,
    )
    expect(result.arms['level-9'].activeAlarmIds).toContain('impella-left-suction')
  })

  it('records equal rounded wedge in the reference RV comparison — OD-03', () => {
    const result = mcsReplay({ id: 'f21', device: 'iabp' }, [
      { id: 'no-action' },
      { id: 'rv-down', actions: [setRv(0.2)] },
      {
        id: 'lv-down',
        actions: [
          { type: 'SET_PATIENT_CONTROL', control: 'leftVentricularContractility', value: 0.25 },
        ],
      },
    ])
    const control = result.arms['no-action']
    const rvDown = result.arms['rv-down']
    const lvDown = result.arms['lv-down']

    // The right-sided signature the section actually teaches is present and large.
    expect(rvDown.metrics.rapMmHg).toBeGreaterThan(control.metrics.rapMmHg + 8)
    expect(rvDown.metrics.papi).toBeLessThan(control.metrics.papi - 1)
    expect(rvDown.metrics.effectiveSystemicFlowLMin).toBeLessThan(
      control.metrics.effectiveSystemicFlowLMin - 1.5,
    )
    expect(rvDown.metrics.timingQualityPercent).toBe(control.metrics.timingQualityPercent)

    // The displayed wedge does not move at all, while the conserved compartments do. This is the
    // unrepaired display-mapping gap; OD-03 owns whether the displayed pressure should carry it.
    expect(rvDown.metrics.pcwpMmHg).toBe(control.metrics.pcwpMmHg)
    expect(rvDown.compartments.leftVentricularVolumeMl).toBeLessThan(
      control.compartments.leftVentricularVolumeMl - 40,
    )
    expect(rvDown.compartments.pulmonaryVenousPressureMmHg).toBeLessThan(
      control.compartments.pulmonaryVenousPressureMmHg - 3,
    )

    // Positive control on the same display: left-sided failure does move the displayed wedge, so
    // the number is not simply frozen.
    expect(lvDown.metrics.pcwpMmHg).toBeGreaterThan(control.metrics.pcwpMmHg + 4)
  })

  it('no longer tells the learner to watch the wedge for a right-sided limitation', () => {
    const option = section('iabp-efficacy-limits').recognizeOptions.find(
      (entry) => entry.id === 'wedge-rising',
    )!
    expect(option.correct).toBe(false)
    expect(option.feedback).not.toMatch(/underfilled rather than congested/i)
    expect(option.feedback).toMatch(/rounded displayed wedge at 20 mm Hg/i)
    // The key is untouched.
    expect(
      section('iabp-efficacy-limits').recognizeOptions.find((entry) => entry.correct)!.id,
    ).toBe('rap-rising')
  })
})

describe('MCS-PRE-REVIEW-02 · F29 — congestion pattern against support bottleneck', () => {
  const contract = section('mcs-device-selection-integration')

  it('measures a section-9 state whose wedge is elevated, not modest', () => {
    const result = mcsReplay(
      {
        id: 'section-9',
        device: 'impella',
        setup: contract.startingActions as readonly McsAction[],
      },
      [
        { id: 'no-action' },
        {
          id: 'level-8',
          actions: [
            { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
          ],
        },
      ],
    )
    const probe = result.arms['no-action']
    // Above the 15 mm Hg the module's own congestion framework cites, and level with the RAP.
    expect(probe.metrics.pcwpMmHg).toBeGreaterThan(15)
    expect(probe.metrics.rapMmHg).toBeGreaterThan(15)
    expect(Math.abs(probe.metrics.rapMmHg - probe.metrics.pcwpMmHg)).toBeLessThanOrEqual(2)
    // And the bottleneck is nonetheless right-sided, which is what makes the key defensible.
    expect(impella(probe).leftPreloadLimiter).toBe('rv-delivery')
    const gain =
      result.arms['level-8'].metrics.effectiveSystemicFlowLMin -
      probe.metrics.effectiveSystemicFlowLMin
    expect(gain).toBeGreaterThan(0)
    expect(gain).toBeLessThan(0.5)
    expect(result.arms['level-8'].activeAlarmIds).toContain('impella-left-suction')
  })

  it('keeps the key and stops calling that wedge modest', () => {
    const correct = contract.recognizeOptions.find((entry) => entry.correct)!
    expect(correct.id).toBe('right-sided')
    for (const option of contract.recognizeOptions) {
      expect(option.label).not.toMatch(/modest/i)
      expect(option.feedback).not.toMatch(/modest wedge/i)
    }
    expect(contract.startingContext).not.toMatch(/modestly elevated wedge/i)
    // The congestion panel is neither hidden nor contradicted: the section now points at it.
    expect(contract.startingContext).toMatch(/biventricular/i)
    // The distractor is refused on the bottleneck, not by denying the wedge is elevated.
    const distractor = contract.recognizeOptions.find((entry) => entry.id === 'left-sided')!
    expect(distractor.feedback).toMatch(/elevated/i)
    expect(distractor.feedback).toMatch(/suction|limiting the pump/i)
  })

  it('carries the same separation into the section-9 transfer', () => {
    const transfer = mcsLessonTransfers.find(
      (entry) => entry.lessonId === 'mcs-device-selection-integration',
    )!
    for (const contextItem of transfer.contextItems)
      expect(contextItem.value).not.toMatch(/only modestly elevated/i)
    expect(transfer.item.stem).not.toMatch(/only modestly elevated/i)
  })
})

describe('MCS-PRE-REVIEW-02 · F14 — the section-2 transfer says what the model produces', () => {
  it('has a native output no lower than the reference patient it is compared with', () => {
    const transfer = mcsLessonTransfers.find(
      (entry) => entry.lessonId === 'mcs-foundations-mechanisms',
    )!
    const transferRun = mcsReplay(
      {
        id: 'transfer',
        device: transfer.setupDevice,
        setup: transfer.setupActions as readonly McsAction[],
      },
      [{ id: 'arm' }],
    )
    const referenceRun = mcsReplay({ id: 'reference', device: 'iabp' }, [{ id: 'arm' }])
    const transferred = transferRun.arms.arm.metrics
    const reference = referenceRun.arms.arm.metrics

    // The reproduction: the output is the reference patient's, to within the module's own
    // native-flow deadband. What is actually different is the loading.
    expect(Math.abs(transferred.nativeFlowLMin - reference.nativeFlowLMin)).toBeLessThan(0.2)
    expect(transferred.pcwpMmHg).toBeGreaterThan(reference.pcwpMmHg + 4)
    expect(transferred.lvedvMl).toBeGreaterThan(reference.lvedvMl + 10)

    const hemodynamics = transfer.contextItems.find((item) => item.label === 'Hemodynamics')!
    expect(hemodynamics.value).not.toMatch(/low native output/i)
    expect(hemodynamics.value).toMatch(/high wedge pressure/i)
    // The key and the option set are untouched.
    expect(transfer.item.correctChoiceIds).toEqual(['compare-direct-lv-unloading'])
  })
})

describe('MCS-PRE-REVIEW-02 · F24 — the unloading response, read against the model’s resolution', () => {
  it('produces a real but small response that grows with the level', () => {
    const [filled] = replayMcsUnloadingComparison(6)
    const [filledEight] = replayMcsUnloadingComparison(8)
    expect(filled.id).toBe('filled')

    const sixVolume = filled.control.metrics.lvedvMl - filled.changed.metrics.lvedvMl
    const eightVolume = filledEight.control.metrics.lvedvMl - filledEight.changed.metrics.lvedvMl
    const sixFlow =
      filled.changed.metrics.leftDeviceFlowLMin - filled.control.metrics.leftDeviceFlowLMin
    const eightFlow =
      filledEight.changed.metrics.leftDeviceFlowLMin -
      filledEight.control.metrics.leftDeviceFlowLMin

    // Positive control: the phenomenon exists and is monotone in the setting.
    expect(sixVolume).toBeGreaterThan(0)
    expect(eightVolume).toBeGreaterThan(sixVolume)
    expect(sixFlow).toBeGreaterThan(0)
    expect(eightFlow).toBeGreaterThan(sixFlow)

    // Negative control: it was not amplified. P5→P6 still moves the displayed wedge by less than
    // one millimetre and the volume by less than the module's own display deadband.
    expect(
      Math.abs(filled.changed.metrics.pcwpMmHg - filled.control.metrics.pcwpMmHg),
    ).toBeLessThanOrEqual(1)
    expect(sixVolume).toBeLessThan(5.5)
    expect(eightVolume).toBeLessThan(20)
  })

  it('prints differences at displayed precision at matched times', () => {
    render(<McsUnloadingComparison />)
    const filled = () => document.querySelector('[data-unloading-condition="filled"]')!
    const delta = (metric: string) =>
      filled().querySelector(`[data-unloading-delta="${metric}"]`)!.textContent!

    expect(delta('pcwpMmHg')).toBe('No resolvable displayed change')
    expect(delta('lvedvMl')).toBe('−4 mL')
    expect(delta('leftDeviceFlowLMin')).toBe('+0.40 L/min')
    // One control column per example — the filled and the underfilled condition.
    expect(
      screen.getAllByRole('columnheader', { name: `P${MCS_UNLOADING_BASE_LEVEL} control` }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('columnheader', { name: /Difference at the same instant/ }),
    ).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'P8' }))
    expect(delta('lvedvMl')).toBe('−11 mL')
    expect(delta('leftDeviceFlowLMin')).toBe('+1.05 L/min')
    expect(delta('pcwpMmHg')).toBe('−1 mm Hg')
  })
})

describe('MCS-PRE-REVIEW-02 · F17 — the timing contour', () => {
  const timingSetup = (inflation: number, deflation: number): readonly McsAction[] => [
    { type: 'SET_IABP_CONTROL', control: 'assistRatio', value: 2 },
    { type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: inflation },
    { type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: deflation },
  ]

  const beatSummary = (probe: McsReplayProbe) => {
    const cycle = 60 / probe.patient.heartRateBpm
    const byBeat = new Map<number, typeof probe.state.waveforms>()
    for (const sample of probe.state.waveforms) {
      const index = Math.floor(sample.time / cycle)
      byBeat.set(index, [...(byBeat.get(index) ?? []), sample])
    }
    const complete = [...byBeat.entries()]
      .filter(([, samples]) => samples.length >= Math.floor(cycle / 0.02) - 1)
      .slice(-4)
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1)
    const pick = (assisted: boolean) => {
      const beats = complete.filter(([, samples]) => samples[0].assistedBeat === assisted)
      return {
        systolicPeak: mean(
          beats.map(([, samples]) =>
            Math.max(
              ...samples.filter((s) => (s.time % cycle) / cycle < 0.42).map((s) => s.arterialMmHg),
            ),
          ),
        ),
        diastolicPeak: mean(
          beats.map(([, samples]) =>
            Math.max(
              ...samples.filter((s) => (s.time % cycle) / cycle >= 0.42).map((s) => s.arterialMmHg),
            ),
          ),
        ),
        endDiastolic: mean(beats.map(([, samples]) => samples[samples.length - 1].arterialMmHg)),
      }
    }
    return { assisted: pick(true), unassisted: pick(false) }
  }

  it('pins what the live trace does not show, so the reference cannot be quietly retired', () => {
    const result = mcsReplay({ id: 'aligned', device: 'iabp', setup: timingSetup(0, 0) }, [
      { id: 'arm' },
    ])
    const { assisted, unassisted } = beatSummary(result.arms.arm)

    // Reproduced, and deliberately not repaired: at aligned timing the augmented peak sits below
    // the systolic peak, and the assisted end-diastolic pressure is a fraction of a millimetre
    // below the unassisted one. Amplifying either would be tuning a waveform to a sentence.
    expect(assisted.diastolicPeak).toBeLessThan(assisted.systolicPeak)
    expect(assisted.diastolicPeak).toBeGreaterThan(unassisted.diastolicPeak + 10)
    expect(Math.abs(assisted.endDiastolic - unassisted.endDiastolic)).toBeLessThan(2)
  })

  it('still separates the five timing references by their event landmarks', () => {
    const states = [
      ['aligned', 0, 0],
      ['early-inflation', -120, 0],
      ['late-inflation', 120, 0],
      ['early-deflation', 0, -120],
      ['late-deflation', 0, 120],
    ] as const
    const probes = states.map(([id, inflation, deflation]) => {
      const result = mcsReplay({ id, device: 'iabp', setup: timingSetup(inflation, deflation) }, [
        { id: 'arm' },
      ])
      const diagnostics = result.arms.arm.diagnostics
      if (diagnostics.kind !== 'iabp') throw new Error('expected iabp diagnostics')
      return { id, diagnostics, alarms: result.arms.arm.activeAlarmIds }
    })
    const aligned = probes[0]
    expect(aligned.diagnostics.timingQuality).toBe(1)
    expect(aligned.alarms).toHaveLength(0)
    for (const probe of probes.slice(1)) {
      expect(probe.diagnostics.timingQuality).toBeLessThan(1)
      expect(probe.alarms).toContain(`iabp-${probe.id}`)
    }
    // Inflation errors move the inflation landmark and leave deflation alone, and the reverse.
    expect(probes[1].diagnostics.inflationStartPhase).toBeLessThan(
      aligned.diagnostics.inflationStartPhase,
    )
    expect(probes[2].diagnostics.inflationStartPhase).toBeGreaterThan(
      aligned.diagnostics.inflationStartPhase,
    )
    expect(probes[3].diagnostics.deflationEndPhase).toBeLessThan(
      aligned.diagnostics.deflationEndPhase,
    )
    expect(probes[4].diagnostics.deflationEndPhase).toBeGreaterThan(
      aligned.diagnostics.deflationEndPhase,
    )
  })

  it('draws an authored reference that names its five landmarks and refuses to be a run result', () => {
    render(<McsIabpWaveformReference />)
    const figure = document.querySelector('[data-iabp-authored-reference]')!
    for (const landmark of MCS_IABP_REFERENCE_LANDMARKS)
      expect(figure.querySelector(`[data-iabp-reference-landmark="${landmark.id}"]`)).not.toBeNull()
    expect(figure.textContent).toMatch(/not this patient’s trace/i)
    expect(figure.textContent).toMatch(/not a run of this simulation/i)
    expect(figure.textContent).toMatch(/ideally/i)
    // No magnitude is claimed for the reductions the booklet describes without one.
    expect(figure.textContent).not.toMatch(/15[–-]20\s*mm\s*Hg/i)
    expect(figure.textContent).toMatch(
      new RegExp(`${MCS_IABP_PRESSURE_SCALE.minMmHg}–${MCS_IABP_PRESSURE_SCALE.maxMmHg} mm Hg`),
    )
  })

  it('registers the booklet it drew the relationships from, with its limits', () => {
    const source = mcsSources.find((entry) => entry.id === MCS_IABP_REFERENCE_SOURCE_ID)!
    expect(source.sourceType).toBe('manufacturer')
    expect(source.limitation).toMatch(/no millimetre-of-mercury magnitude/i)
    expect(source.limitation).toMatch(/OD-06/)
  })
})

describe('MCS-PRE-REVIEW-02 · F27 and F28 — the durable pump’s measurands', () => {
  it('keeps flow generated from speed and loading, with power derived after it', () => {
    const result = mcsReplay({ id: 'estimator', device: 'lvad' }, [
      { id: 'no-action' },
      {
        id: 'thrombosis',
        actions: [{ type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true }],
      },
    ])
    const control = result.arms['no-action']
    const flagged = result.arms.thrombosis
    // Unrepaired and pinned: the flag adds a flat wattage and never enters the flow formula. OD-02
    // owns whether this module should instead model a controller's estimate.
    expect(lvad(control).thrombosisPowerAdditionW).toBe(0)
    expect(lvad(flagged).thrombosisPowerAdditionW).toBe(LVAD_SUSPECTED_THROMBOSIS_POWER_W)
    // The displayed watts move by the flat addition, give or take the tenth that one-decimal
    // rounding and a 0.01 L/min flow difference put on top of it.
    expect(flagged.metrics.pumpPowerW! - control.metrics.pumpPowerW!).toBeGreaterThan(
      LVAD_SUSPECTED_THROMBOSIS_POWER_W - 0.05,
    )
    expect(flagged.metrics.pumpPowerW! - control.metrics.pumpPowerW!).toBeLessThan(
      LVAD_SUSPECTED_THROMBOSIS_POWER_W + 0.15,
    )
    expect(Math.abs(flagged.metrics.deviceFlowLMin - control.metrics.deviceFlowLMin)).toBeLessThan(
      0.05,
    )
    expect(flagged.activeAlarmIds).toContain('lvad-high-power')
    // The displayed flow is the modeled transfer, rounded — not a separate estimate fed back in.
    expect(lvad(control).deviceFlow).toBeCloseTo(control.metrics.deviceFlowLMin, 1)
  })

  it('shows that the afterload alarm reads a different pressure from the one on the monitor', () => {
    const result = mcsReplay({ id: 'afterload', device: 'lvad' }, [
      { id: 'no-action' },
      { id: 'svr-1900', actions: [setSvr(1900)] },
    ])
    const control = result.arms['no-action']
    const loaded = result.arms['svr-1900']

    // The phenomenon Section 8 teaches is present: same speed, higher resistance, less flow.
    expect(loaded.device).toEqual(control.device)
    expect(loaded.metrics.deviceFlowLMin).toBeLessThan(control.metrics.deviceFlowLMin - 0.4)
    expect(lvad(loaded).afterloadFactor).toBeLessThan(lvad(control).afterloadFactor)

    // Reproduced and not repaired: the alarm's input is far below the displayed mean and the
    // alarm stays quiet through a demonstrably afterload-limited state. OD-02 owns the predicate.
    expect(lvad(control).highAfterloadPredicateInput).toBeLessThan(control.metrics.mapMmHg - 25)
    expect(loaded.metrics.mapMmHg).toBeGreaterThan(LVAD_HIGH_AFTERLOAD_MAP_MMHG + 30)
    expect(loaded.activeAlarmIds).not.toContain('lvad-high-afterload')

    // What is repaired: the cost is now readable, and the alarm says which number it is not.
    const view = afterloadCostView(loaded.state)!
    expect(view.costPercent).toBeGreaterThan(15)
    expect(view.alarmRaised).toBe(false)
    expect(view.alarmInputMmHg).toBeLessThan(loaded.metrics.mapMmHg)
  })

  it('says on the alarm itself which pressure its predicate reads', () => {
    const raised = mcsReplay({ id: 'alarm-copy', device: 'lvad' }, [
      {
        id: 'arm',
        actions: [
          setSvr(2200),
          { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 145 },
        ],
      },
    ])
    const alarm = raised.arms.arm.state.alarms.find((entry) => entry.id === 'lvad-high-afterload')
    expect(alarm).toBeDefined()
    expect(alarm!.explanation).toMatch(/without support/i)
    expect(alarm!.explanation).toMatch(/not the mean pressure on the monitor/i)
    expect(alarm!.explanation).not.toMatch(/^Elevated aortic pressure reduces/)
  })

  it('keeps the speed-change authorization and the reference patient’s pressure unchanged', () => {
    const unauthorized = mcsReplay({ id: 'authorization', device: 'lvad' }, [
      { id: 'arm', actions: [{ type: 'SET_LVAD_CONTROL', control: 'speedRpm', value: 5800 }] },
    ])
    // The safety interlock is untouched: an unauthorized speed dispatch changes nothing.
    expect(unauthorized.arms.arm.device).toMatchObject({ speedRpm: 5200 })

    const reference = mcsReplay({ id: 'reference-map', device: 'lvad' }, [{ id: 'arm' }])
    // Pinned as the open OD-02 decision, not endorsed: the reference state's displayed mean
    // pressure is high and this slice did not tune it toward any target.
    expect(reference.arms.arm.metrics.mapMmHg).toBeGreaterThan(95)
  })
})

describe('MCS-PRE-REVIEW-02 · F35 — LVAD-02’s whole success condition', () => {
  const scenario = mcsScenarioById.get('LVAD-02')!

  it('pairs the ratio with a flow condition and moves both on the intended action', () => {
    expect(scenario.successCriteria.map((criterion) => criterion.metric)).toEqual([
      'papi',
      'deviceFlowLMin',
    ])
    const result = mcsReplay({ id: 'LVAD-02', section: 'practice', device: 'lvad', scenario }, [
      { id: 'no-action' },
      {
        id: 'intended',
        actions: [
          setRv(0.9),
          { type: 'SET_PATIENT_CONTROL', control: 'pulmonaryVascularResistanceWU', value: 2.5 },
        ],
      },
      {
        id: 'speed-up',
        actions: [
          { type: 'SET_LVAD_CONTROL', control: 'speedChangeAuthorized', value: true },
          { type: 'SET_LVAD_CONTROL', control: 'speedRpm', value: 5800 },
        ],
      },
    ])
    const control = result.arms['no-action']
    const intended = result.arms.intended

    // The ratio is not flat here: it moves a long way, and so does everything around it.
    expect(control.metrics.papi).toBeLessThan(1)
    expect(intended.metrics.papi).toBeGreaterThan(control.metrics.papi + 1)
    expect(intended.metrics.rapMmHg).toBeLessThan(control.metrics.rapMmHg - 8)
    expect(intended.metrics.deviceFlowLMin).toBeGreaterThan(control.metrics.deviceFlowLMin + 2)

    // Negative control: the plausible alternative satisfies neither condition.
    const speedUp = result.arms['speed-up']
    expect(speedUp.metrics.papi).toBeLessThan(1)
    expect(speedUp.metrics.deviceFlowLMin).toBeLessThan(2.8)
  })

  it('says in the debrief why the ratio moved here and barely moves in section 9', () => {
    expect(scenario.debrief.join(' ')).toMatch(
      /worked comparison that restores modeled RV contractility/i,
    )
    expect(scenario.debrief.join(' ')).toMatch(/not.*a response measure on its own/i)
    const rpResult = mcsReplay(
      {
        id: 'section-9-rp',
        device: 'impella',
        setup: section('mcs-device-selection-integration').startingActions as readonly McsAction[],
      },
      [
        { id: 'rp-off' },
        {
          id: 'rp-on',
          actions: [{ type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true }],
        },
      ],
    )
    // Positive control for the section-9 claim the debrief refers to: adding right-sided support
    // moves the ratio by less than the module's own display deadband for it.
    expect(
      Math.abs(rpResult.arms['rp-on'].metrics.papi - rpResult.arms['rp-off'].metrics.papi),
    ).toBeLessThanOrEqual(0.25)
  })
})

describe('MCS-PRE-REVIEW-02 · F26 — the low-preload story keeps its own identity', () => {
  it('states the scope of the loading change and still names no dose', () => {
    const volume = mcsStoryProblems.find((story) => story.id === 'story-volume-for-suction')!
    expect(volume.changeScope).toMatch(/55 per cent to 100 per cent/)
    expect(volume.changeScope).toMatch(/rescales the entire circulation/i)
    expect(volume.changeScope).toMatch(
      /response magnitude cannot be translated into a bedside fluid-challenge response/i,
    )
    // MCS-PRE-REVIEW-01's guard, kept: no figure here can be read as a dose.
    expect(volume.changeScope).not.toMatch(/\b\d+\s*(mL|ml|millilitres|cc)\b/)
    expect(volume.changeScope).not.toMatch(/bolus of|give \d|over \d+ minutes/i)
  })

  it('measures the response as a rescaling of the whole circulation, not an addition to it', () => {
    const low = mcsReplay(
      {
        id: 'story-baseline',
        device: 'impella',
        settleSeconds: 5,
        setup: [
          { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 7 },
          { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 55 },
        ],
      },
      [
        { id: 'no-action' },
        {
          id: 'volume',
          actions: [{ type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 100 }],
        },
      ],
    )
    const control = low.arms['no-action']
    const volume = low.arms.volume
    // The control changes the solver's whole circulating volume, which is why the response is big.
    expect(volume.totalCirculatingVolumeMl).toBeGreaterThan(control.totalCirculatingVolumeMl + 1500)
    expect(volume.metrics.mapMmHg).toBeGreaterThan(control.metrics.mapMmHg + 25)
    expect(volume.activeAlarmIds).not.toContain('impella-left-suction')

    // Negative control, and the OD-03 case in one: the same intervention in the section's own
    // right-ventricular-failure patient does not clear suction and raises both filling pressures.
    const rvFailure = mcsReplay(
      { id: 'rv-failure-volume', device: 'impella', setup: IMPELLA_SECTION_SUCTION },
      [
        { id: 'no-action' },
        {
          id: 'volume',
          actions: [{ type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 140 }],
        },
      ],
    )
    expect(rvFailure.arms.volume.activeAlarmIds).toContain('impella-left-suction')
    expect(rvFailure.arms.volume.metrics.rapMmHg).toBeGreaterThan(
      rvFailure.arms['no-action'].metrics.rapMmHg,
    )
    expect(rvFailure.arms.volume.metrics.pcwpMmHg).toBeGreaterThan(
      rvFailure.arms['no-action'].metrics.pcwpMmHg,
    )
  })
})

describe('MCS-PRE-REVIEW-02 · F19 — task 01’s atrial-fibrillation containment is untouched', () => {
  it('leaves the three trigger ratings, the alarm threshold and the held conditions exactly as they were', () => {
    const af: readonly McsAction[] = [{ type: 'SET_RHYTHM', rhythm: 'atrial-fibrillation' }]
    const result = mcsReplay({ id: 'af', device: 'iabp', setup: af }, [
      {
        id: 'ecg',
        actions: [{ type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'ecg' }],
      },
      {
        id: 'pressure',
        actions: [{ type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'pressure' }],
      },
      {
        id: 'internal',
        actions: [{ type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'internal' }],
      },
    ])
    expect(result.arms.ecg.metrics.timingQualityPercent).toBe(50)
    expect(result.arms.pressure.metrics.timingQualityPercent).toBe(74)
    expect(result.arms.internal.metrics.timingQualityPercent).toBe(40)
    expect(result.arms.ecg.activeAlarmIds).toContain('iabp-trigger-unreliable')
    expect(result.arms.internal.activeAlarmIds).toContain('iabp-trigger-unreliable')
    expect(result.arms.pressure.activeAlarmIds).not.toContain('iabp-trigger-unreliable')

    // Sinus control: the ratings and the quiet alarm are the model's, not a special case.
    const sinus = mcsReplay({ id: 'sinus', device: 'iabp' }, [
      {
        id: 'ecg',
        actions: [{ type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'ecg' }],
      },
    ])
    expect(sinus.arms.ecg.metrics.timingQualityPercent).toBe(100)

    // The two held conditions are still held, and still the only two.
    const held = [...mcsScenarioById.values()].flatMap((scenario) =>
      scenario.successCriteria
        .filter((criterion) => criterion.classification.held)
        .map((criterion) => `${scenario.id}:${criterion.metric}`),
    )
    expect(held.sort()).toEqual([
      'CAP-IABP-01:timingQualityPercent',
      'IABP-02:timingQualityPercent',
    ])
  })
})
