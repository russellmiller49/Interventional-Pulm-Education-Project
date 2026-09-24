import { fireEvent, render, screen } from '@testing-library/react'
import { McsUnloadingComparison } from '../components/stage/McsUnloadingComparison'
import { inflowLimitView } from '../components/teaching/selectors'
import {
  advanceMcsSimulation,
  createInitialMcsState,
  computeMechanicalSupport,
  deriveBaselineMeasurements,
} from '../engine/model'
import { mcsReducer } from '../engine/reducer'
import type { McsAction } from '../engine/types'
import { mcsReplay } from '../test-support/replayHarness'

const patient = (
  control:
    | 'preloadPercent'
    | 'rightVentricularContractility'
    | 'leftVentricularContractility'
    | 'pulmonaryVascularResistanceWU',
  value: number,
): McsAction => ({ type: 'SET_PATIENT_CONTROL', control, value })

test('comparison arms share model time even with zero, one and two actions', () => {
  const arms = [
    { id: 'control' },
    {
      id: 'flag',
      actions: [
        { type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true } as const,
      ],
    },
    {
      id: 'two',
      actions: [
        { type: 'SET_LVAD_CONTROL', control: 'speedChangeAuthorized', value: true } as const,
        { type: 'SET_LVAD_CONTROL', control: 'speedRpm', value: 5800 } as const,
      ],
    },
  ]
  const result = mcsReplay({ id: 'time', device: 'lvad' }, arms)
  const times = Object.values(result.arms).map((x) => x.timeSeconds)
  expect(Math.max(...times) - Math.min(...times)).toBeLessThan(1e-9)
  expect(result.arms.flag.metrics.deviceFlowLMin).toBe(result.arms.control.metrics.deviceFlowLMin)
  expect(
    result.arms.flag.metrics.pumpPowerW! - result.arms.control.metrics.pumpPowerW!,
  ).toBeCloseTo(2.8, 10)
  expect(mcsReplay({ id: 'time', device: 'lvad' }, [...arms].reverse()).arms).toEqual(result.arms)
})

test('rounded matched-time deltas do not mislabel nonzero responses as unresolved', () => {
  render(<McsUnloadingComparison />)
  const delta = (key: string) =>
    document.querySelector(`[data-unloading-condition="filled"] [data-unloading-delta="${key}"]`)
      ?.textContent
  expect(delta('pcwpMmHg')).toBe('No resolvable displayed change')
  expect(delta('lvedvMl')).toBe('−4 mL')
  expect(delta('leftDeviceFlowLMin')).toBe('+0.40 L/min')
  fireEvent.click(screen.getByRole('button', { name: 'P8' }))
  expect(delta('pcwpMmHg')).toBe('−1 mm Hg')
  expect(delta('lvedvMl')).toBe('−11 mL')
})

test('all three Impella limiting terms are reachable and remain current through reset', () => {
  const plans: [string, McsAction[], number][] = [
    ['rv-delivery', [patient('rightVentricularContractility', 0.2)], 8],
    [
      'circulating-volume',
      [
        patient('preloadPercent', 50),
        patient('rightVentricularContractility', 1.4),
        patient('pulmonaryVascularResistanceWU', 0.5),
      ],
      60,
    ],
    [
      'lv-compartment-filling',
      [
        patient('preloadPercent', 50),
        patient('rightVentricularContractility', 1.4),
        patient('leftVentricularContractility', 1.4),
        patient('pulmonaryVascularResistanceWU', 0.5),
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 9 },
      ],
      60,
    ],
  ]
  for (const [limiter, actions, seconds] of plans) {
    let state = createInitialMcsState('learn', 'impella', null, 417)
    const check = () =>
      expect(state.supportDiagnostics).toEqual(
        computeMechanicalSupport(
          state.patient,
          state.device,
          state.compartments,
          deriveBaselineMeasurements(state.patient),
          state.timeSeconds,
        ).diagnostics,
      )
    check()
    for (const action of actions) {
      state = mcsReducer(state, action)
      check()
    }
    state = advanceMcsSimulation(state, seconds)
    check()
    expect(inflowLimitView(state)?.limiter).toBe(limiter)
    expect(inflowLimitView(state)?.suction).toBe(true)
    if (limiter !== 'rv-delivery')
      expect(inflowLimitView(state)?.note).not.toMatch(/telling the same story/)
    state = mcsReducer(state, { type: 'RESET', seed: 417 })
    check()
    expect(state.supportDiagnostics).toEqual(
      createInitialMcsState('learn', 'impella', null, 417).supportDiagnostics,
    )
  }
})

test('a tie names one actual minimum without altering the numerical predicate', () => {
  const initial = createInitialMcsState('learn', 'impella', null, 417)
  const patientState = {
    ...initial.patient,
    rightVentricularContractility: 1.4,
    pulmonaryVascularResistanceWU: 0.5,
    preloadPercent: 90,
  }
  const compartments = { ...initial.compartments, leftVentricularVolumeMl: 110 }
  const { diagnostics } = computeMechanicalSupport(
    patientState,
    initial.device,
    compartments,
    deriveBaselineMeasurements(patientState),
    initial.timeSeconds,
  )
  if (diagnostics.kind !== 'impella') throw new Error('Expected Impella')
  expect(diagnostics.lvCompartmentFilling).toBe(1)
  expect(diagnostics.circulatingVolumeFactor).toBe(1)
  expect(diagnostics.rvDeliveryToLeftHeart).toBeGreaterThan(1)
  expect(diagnostics.leftPreloadFactor).toBe(1)
  expect(diagnostics.leftPreloadLimiter).toBe('lv-compartment-filling')
})

test('a matched replay rejects differing observation intervals', () => {
  expect(() =>
    mcsReplay({ id: 'different-times' }, [{ id: 'control' }, { id: 'later', observeSeconds: 30 }]),
  ).toThrow(/same observation interval/)
})
