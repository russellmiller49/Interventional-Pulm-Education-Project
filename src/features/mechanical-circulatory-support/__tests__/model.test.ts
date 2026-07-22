import { mcsPracticeScenarios } from '../content'
import {
  advanceMcsSimulation,
  computeMechanicalSupport,
  createInitialMcsState,
  deriveBaselineMeasurements,
  deriveIabpCycleState,
  hasMcsMastery,
  mcsReducer,
  nextIabpBalloonMorph,
  totalMcsCirculatingVolume,
} from '../engine'

describe('MCS deterministic circulation and device adapters', () => {
  it.each(['iabp', 'impella', 'lvad'] as const)(
    '%s remains bounded and volume-conserving across fixed steps',
    (device) => {
      const initial = createInitialMcsState('learn', device)
      const before = totalMcsCirculatingVolume(initial)
      const advanced = advanceMcsSimulation(initial, 2)
      const after = totalMcsCirculatingVolume(advanced)
      expect(after).toBeCloseTo(before, 3)
      expect(advanced.metrics.mapMmHg).toBeGreaterThan(20)
      expect(advanced.metrics.effectiveSystemicFlowLMin).toBeGreaterThan(0)
      expect(
        Object.values(advanced.metrics).every(
          (value) => typeof value !== 'number' || Number.isFinite(value),
        ),
      ).toBe(true)
    },
  )

  it('is timestep-equivalent between one second and fifty explicit fixed steps', () => {
    const initial = createInitialMcsState('learn', 'impella')
    const whole = advanceMcsSimulation(initial, 1)
    let split = initial
    for (let index = 0; index < 50; index += 1) split = advanceMcsSimulation(split, 0.02)
    expect(split.metrics.effectiveSystemicFlowLMin).toBeCloseTo(
      whole.metrics.effectiveSystemicFlowLMin,
      6,
    )
    expect(split.metrics.pcwpMmHg).toBeCloseTo(whole.metrics.pcwpMmHg, 6)
    expect(split.compartments.leftVentricularVolumeMl).toBeCloseTo(
      whole.compartments.leftVentricularVolumeMl,
      6,
    )
    expect(totalMcsCirculatingVolume(split)).toBeCloseTo(totalMcsCirculatingVolume(whole), 6)
  })

  it.each(['iabp', 'impella', 'lvad'] as const)(
    '%s remains physiologically interpretable over a 30-second run',
    (device) => {
      const initial = createInitialMcsState('learn', device)
      const initialVolume = totalMcsCirculatingVolume(initial)
      const advanced = advanceMcsSimulation(initial, 30)
      expect(totalMcsCirculatingVolume(advanced)).toBeCloseTo(initialVolume, 3)
      expect(advanced.metrics.lvedvMl).toBeGreaterThanOrEqual(35)
      expect(advanced.metrics.lvedvMl).toBeLessThan(180)
      expect(advanced.metrics.pcwpMmHg).toBeGreaterThanOrEqual(2)
      expect(advanced.metrics.pcwpMmHg).toBeLessThanOrEqual(42)
    },
  )

  it.each(['impella', 'lvad'] as const)(
    '%s flow is constrained by the modeled pump pressure gradient',
    (device) => {
      const state = createInitialMcsState('learn', device)
      const baseline = deriveBaselineMeasurements(state.patient)
      const lowGradient = computeMechanicalSupport(
        state.patient,
        state.device,
        {
          ...state.compartments,
          systemicArterialPressureMmHg: 70,
          pulmonaryVenousPressureMmHg: 20,
        },
        baseline,
        0,
      )
      const highGradient = computeMechanicalSupport(
        state.patient,
        state.device,
        {
          ...state.compartments,
          systemicArterialPressureMmHg: 150,
          pulmonaryVenousPressureMmHg: 10,
        },
        baseline,
        0,
      )
      expect(highGradient.deviceFlowLMin).toBeLessThan(lowGradient.deviceFlowLMin)
      expect(highGradient.effect.displaySignals?.pressureGradientMmHg).toBe(140)
    },
  )

  it('models IABP timing harm and recovery without inventing continuous device flow', () => {
    const definition = mcsPracticeScenarios[0]
    let state = createInitialMcsState('practice', 'iabp', definition)
    expect(state.alarms.some((item) => item.id === 'iabp-late-deflation')).toBe(true)
    expect(state.metrics.deviceFlowLMin).toBe(0)
    state = mcsReducer(state, { type: 'INSPECT', id: 'arterial' })
    state = mcsReducer(state, { type: 'SELECT_PREDICTION', id: definition.correctPredictionId })
    state = mcsReducer(state, { type: 'COMMIT_PREDICTION' })
    state = mcsReducer(state, { type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: 0 })
    state = advanceMcsSimulation(state, 1)
    expect(state.alarms.some((item) => item.id === 'iabp-late-deflation')).toBe(false)
    expect(state.metrics.timingQualityPercent).toBeGreaterThanOrEqual(80)
  })

  it('uses one IABP cycle state for assist ratio and timing-offset animation', () => {
    const state = createInitialMcsState('learn', 'iabp')
    if (state.device.kind !== 'iabp') throw new Error('Expected IABP state')

    expect(deriveIabpCycleState(0.5, 60, state.device).inflated).toBe(true)
    expect(
      deriveIabpCycleState(0.3, 60, { ...state.device, inflationOffsetMs: -180 }).inflated,
    ).toBe(true)
    expect(
      deriveIabpCycleState(0.5, 60, { ...state.device, inflationOffsetMs: 180 }).inflated,
    ).toBe(false)
    expect(deriveIabpCycleState(1.5, 60, { ...state.device, assistRatio: 2 }).assistedBeat).toBe(
      false,
    )
    expect(
      deriveIabpCycleState(1.04, 60, { ...state.device, deflationOffsetMs: 180 }).inflated,
    ).toBe(true)
    expect(deriveIabpCycleState(2.5, 60, { ...state.device, assistRatio: 3 }).assistedBeat).toBe(
      false,
    )
    expect(deriveIabpCycleState(3.5, 60, { ...state.device, assistRatio: 3 }).assistedBeat).toBe(
      true,
    )
    expect(deriveIabpCycleState(0.5, 60, { ...state.device, running: false }).inflated).toBe(false)
    expect(nextIabpBalloonMorph(0.4, true, true)).toBe(1)
    expect(nextIabpBalloonMorph(0.4, false, true)).toBe(0)
    expect(nextIabpBalloonMorph(0, true, false)).toBeCloseTo(0.18)
  })

  it('makes IABP assist ratios and trigger quality change effective assistance', () => {
    let oneToOne = createInitialMcsState('learn', 'iabp')
    oneToOne = mcsReducer(oneToOne, { type: 'SET_IABP_CONTROL', control: 'assistRatio', value: 1 })
    let oneToThree = createInitialMcsState('learn', 'iabp')
    oneToThree = mcsReducer(oneToThree, {
      type: 'SET_IABP_CONTROL',
      control: 'assistRatio',
      value: 3,
    })
    expect(oneToOne.metrics.effectiveSystemicFlowLMin).toBeGreaterThan(
      oneToThree.metrics.effectiveSystemicFlowLMin,
    )

    let irregular = createInitialMcsState('learn', 'iabp')
    irregular = mcsReducer(irregular, { type: 'SET_RHYTHM', rhythm: 'atrial-fibrillation' })
    irregular = mcsReducer(irregular, {
      type: 'SET_IABP_CONTROL',
      control: 'triggerSource',
      value: 'internal',
    })
    expect(irregular.metrics.timingQualityPercent).toBeLessThan(50)
    expect(irregular.alarms.some((item) => item.id === 'iabp-trigger-unreliable')).toBe(true)
  })

  it('increases Impella flow with performance level when preload is adequate and detects suction when it is not', () => {
    let adequate = createInitialMcsState('learn', 'impella')
    adequate = mcsReducer(adequate, {
      type: 'SET_IMPELLA_CONTROL',
      control: 'performanceLevel',
      value: 3,
    })
    const lowLevelFlow = adequate.metrics.deviceFlowLMin
    adequate = mcsReducer(adequate, {
      type: 'SET_IMPELLA_CONTROL',
      control: 'performanceLevel',
      value: 7,
    })
    expect(adequate.metrics.deviceFlowLMin).toBeGreaterThan(lowLevelFlow)

    let underfilled = createInitialMcsState('practice', 'impella', mcsPracticeScenarios[3])
    underfilled = advanceMcsSimulation(underfilled, 0.5)
    expect(underfilled.alarms.some((item) => item.id === 'impella-left-suction')).toBe(true)
  })

  it('unloads the LV with higher Impella support and remains RV/preload dependent', () => {
    let lowSupport = createInitialMcsState('learn', 'impella')
    lowSupport = mcsReducer(lowSupport, {
      type: 'SET_IMPELLA_CONTROL',
      control: 'performanceLevel',
      value: 2,
    })
    lowSupport = advanceMcsSimulation(lowSupport, 1)
    let highSupport = createInitialMcsState('learn', 'impella')
    highSupport = mcsReducer(highSupport, {
      type: 'SET_IMPELLA_CONTROL',
      control: 'performanceLevel',
      value: 8,
    })
    highSupport = advanceMcsSimulation(highSupport, 1)
    expect(highSupport.metrics.pcwpMmHg).toBeLessThan(lowSupport.metrics.pcwpMmHg)
    expect(highSupport.metrics.lvedvMl).toBeLessThan(lowSupport.metrics.lvedvMl)

    let rvLimited = createInitialMcsState('learn', 'impella')
    rvLimited = mcsReducer(rvLimited, {
      type: 'SET_PATIENT_CONTROL',
      control: 'preloadPercent',
      value: 60,
    })
    rvLimited = mcsReducer(rvLimited, {
      type: 'SET_PATIENT_CONTROL',
      control: 'rightVentricularContractility',
      value: 0.3,
    })
    rvLimited = mcsReducer(rvLimited, {
      type: 'SET_PATIENT_CONTROL',
      control: 'pulmonaryVascularResistanceWU',
      value: 7,
    })
    rvLimited = mcsReducer(rvLimited, {
      type: 'SET_IMPELLA_CONTROL',
      control: 'performanceLevel',
      value: 8,
    })
    expect(rvLimited.metrics.deviceFlowLMin).toBeLessThan(highSupport.metrics.deviceFlowLMin)
    expect(rvLimited.alarms.some((item) => item.id === 'impella-left-suction')).toBe(true)
  })

  it('keeps CP and 5.5 as distinct left-pump variants with loading-dependent flow bounds', () => {
    let cp = createInitialMcsState('learn', 'impella')
    cp = mcsReducer(cp, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: 9,
    })
    let fiveFive = createInitialMcsState('learn', 'impella')
    fiveFive = mcsReducer(fiveFive, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'leftVariant',
      value: '55',
    })
    fiveFive = mcsReducer(fiveFive, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: 9,
    })

    expect(cp.device.kind === 'impella' && cp.device.left.variant).toBe('cp')
    expect(fiveFive.device.kind === 'impella' && fiveFive.device.left.variant).toBe('55')
    expect(fiveFive.metrics.leftDeviceFlowLMin).toBeGreaterThan(cp.metrics.leftDeviceFlowLMin)
    expect(cp.metrics.leftDeviceFlowLMin).toBeLessThanOrEqual(4.3)
    expect(fiveFive.metrics.leftDeviceFlowLMin).toBeLessThanOrEqual(5.5)
    expect(fiveFive.metrics.deviceFlowLMin).toBe(fiveFive.metrics.leftDeviceFlowLMin)
    expect(fiveFive.metrics.rightDeviceFlowLMin).toBe(0)
  })

  it('models RP as a caval-to-pulmonary pump without adding RP flow directly to systemic output', () => {
    let rpOnly = createInitialMcsState('learn', 'impella')
    rpOnly = mcsReducer(rpOnly, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'leftEnabled',
      value: false,
    })
    rpOnly = mcsReducer(rpOnly, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'rightEnabled',
      value: true,
    })
    rpOnly = mcsReducer(rpOnly, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'right',
      control: 'performanceLevel',
      value: 9,
    })

    expect(rpOnly.metrics.leftDeviceFlowLMin).toBe(0)
    expect(rpOnly.metrics.deviceFlowLMin).toBe(0)
    expect(rpOnly.metrics.rightDeviceFlowLMin).toBeGreaterThan(0)
    expect(rpOnly.metrics.rightDeviceFlowLMin).toBeLessThanOrEqual(4)
    expect(rpOnly.alarms.some((item) => item.id === 'impella-right-flow-imbalance')).toBe(true)
    expect(rpOnly.metrics.effectiveSystemicFlowLMin).toBe(rpOnly.metrics.nativeFlowLMin)
    expect(rpOnly.metrics.effectiveSystemicFlowLMin).not.toBeCloseTo(
      rpOnly.metrics.nativeFlowLMin + rpOnly.metrics.rightDeviceFlowLMin,
      1,
    )
    expect(rpOnly.supportEffect.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'systemic-venous', to: 'pulmonary-arterial' }),
      ]),
    )
    const inspected = mcsReducer(rpOnly, { type: 'INSPECT', id: 'device' })
    expect(inspected.responseMessage).toMatch(/left pump 0\.0 L\/min · RP [1-9]/i)

    if (rpOnly.device.kind !== 'impella') throw new Error('Expected Impella state')
    const underfilledSupport = computeMechanicalSupport(
      { ...rpOnly.patient, preloadPercent: 50 },
      rpOnly.device,
      {
        ...rpOnly.compartments,
        systemicVenousVolumeMl: 850,
        systemicVenousPressureMmHg: 2,
      },
      deriveBaselineMeasurements({ ...rpOnly.patient, preloadPercent: 50 }),
      0,
    )
    expect(underfilledSupport.rightDeviceFlowLMin).toBeLessThan(rpOnly.metrics.rightDeviceFlowLMin)
    expect(underfilledSupport.alarms.some((item) => item.id === 'impella-right-suction')).toBe(true)

    const highPvrPatient = { ...rpOnly.patient, pulmonaryVascularResistanceWU: 9 }
    const highPvrSupport = computeMechanicalSupport(
      highPvrPatient,
      rpOnly.device,
      rpOnly.compartments,
      deriveBaselineMeasurements(highPvrPatient),
      0,
    )
    expect(highPvrSupport.rightDeviceFlowLMin).toBeLessThan(rpOnly.metrics.rightDeviceFlowLMin)
  })

  it('runs left and right pumps simultaneously while conserving volume and exposing pump balance', () => {
    const leftOnly = advanceMcsSimulation(createInitialMcsState('learn', 'impella'), 1)
    let biPella = createInitialMcsState('learn', 'impella')
    biPella = mcsReducer(biPella, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'leftVariant',
      value: '55',
    })
    biPella = mcsReducer(biPella, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'rightEnabled',
      value: true,
    })
    const beforeVolume = totalMcsCirculatingVolume(biPella)
    biPella = advanceMcsSimulation(biPella, 1)

    expect(biPella.metrics.leftDeviceFlowLMin).toBeGreaterThan(0)
    expect(biPella.metrics.rightDeviceFlowLMin).toBeGreaterThan(0)
    expect(biPella.metrics.deviceFlowLMin).toBe(biPella.metrics.leftDeviceFlowLMin)
    expect(biPella.metrics.pumpBalanceLMin).toBeCloseTo(
      biPella.metrics.rightDeviceFlowLMin - biPella.metrics.leftDeviceFlowLMin,
      2,
    )
    expect(biPella.metrics.effectiveSystemicFlowLMin).toBeCloseTo(
      biPella.metrics.nativeFlowLMin +
        biPella.metrics.leftDeviceFlowLMin -
        biPella.metrics.recirculatingFlowLMin,
      1,
    )
    expect(biPella.metrics.effectiveSystemicFlowLMin).not.toBeCloseTo(
      biPella.metrics.nativeFlowLMin +
        biPella.metrics.leftDeviceFlowLMin +
        biPella.metrics.rightDeviceFlowLMin,
      1,
    )
    expect(biPella.supportEffect.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'left-ventricular', to: 'systemic-arterial' }),
        expect.objectContaining({ from: 'systemic-venous', to: 'pulmonary-arterial' }),
      ]),
    )
    expect(biPella.metrics.rapMmHg).toBeLessThan(leftOnly.metrics.rapMmHg)
    expect(totalMcsCirculatingVolume(biPella)).toBeCloseTo(beforeVolume, 3)
  })

  it('applies Impella controls and position alarms to the selected pump side only', () => {
    let state = createInitialMcsState('learn', 'impella')
    state = mcsReducer(state, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'rightEnabled',
      value: true,
    })
    if (state.device.kind !== 'impella') throw new Error('Expected Impella state')
    const originalLeft = { ...state.device.left }
    state = mcsReducer(state, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'right',
      control: 'position',
      value: 'too-distal',
    })
    state = mcsReducer(state, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'right',
      control: 'performanceLevel',
      value: 8,
    })
    state = mcsReducer(state, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'right',
      control: 'purgeState',
      value: 'high-pressure',
    })

    expect(state.device.kind === 'impella' && state.device.left).toEqual(originalLeft)
    expect(state.device.kind === 'impella' && state.device.right.position).toBe('too-distal')
    expect(state.device.kind === 'impella' && state.device.right.performanceLevel).toBe(8)
    expect(state.actionIds).toEqual(
      expect.arrayContaining([
        'impella:right:set-position',
        'impella:right:set-level',
        'impella:right:set-purge',
      ]),
    )
    expect(state.alarms.some((item) => item.id === 'impella-right-position')).toBe(true)
    expect(state.alarms.some((item) => item.id === 'impella-right-purge-high')).toBe(true)
    expect(state.alarms.some((item) => item.id === 'impella-left-position')).toBe(false)
    expect(state.alarms.some((item) => item.id === 'impella-left-purge-high')).toBe(false)
  })

  it('makes LVAD flow afterload-sensitive and separates recirculation from effective flow', () => {
    const normal = advanceMcsSimulation(createInitialMcsState('learn', 'lvad'), 0.5)
    let highAfterload = createInitialMcsState('learn', 'lvad')
    highAfterload = mcsReducer(highAfterload, {
      type: 'SET_PATIENT_CONTROL',
      control: 'systemicVascularResistanceDynSecCm5',
      value: 2050,
    })
    expect(highAfterload.metrics.deviceFlowLMin).toBeLessThan(normal.metrics.deviceFlowLMin)

    let regurgitation = createInitialMcsState('learn', 'lvad')
    regurgitation = mcsReducer(regurgitation, {
      type: 'SET_PATIENT_CONTROL',
      control: 'aorticInsufficiencySeverity',
      value: 0.8,
    })
    expect(regurgitation.metrics.recirculatingFlowLMin).toBeGreaterThan(0)
    expect(regurgitation.metrics.effectiveSystemicFlowLMin).toBeLessThan(
      regurgitation.metrics.nativeFlowLMin + regurgitation.metrics.deviceFlowLMin,
    )
  })

  it('sets zero LVAD device flow for power loss or controller failure and exposes critical alarms', () => {
    let powerLoss = createInitialMcsState('learn', 'lvad')
    powerLoss = mcsReducer(powerLoss, {
      type: 'SET_LVAD_CONTROL',
      control: 'powerConnected',
      value: false,
    })
    expect(powerLoss.metrics.deviceFlowLMin).toBe(0)
    expect(
      powerLoss.alarms.some(
        (item) => item.id === 'lvad-power-disconnected' && item.priority === 'critical',
      ),
    ).toBe(true)

    let controllerFailure = createInitialMcsState('learn', 'lvad')
    controllerFailure = mcsReducer(controllerFailure, {
      type: 'SET_LVAD_CONTROL',
      control: 'controllerFault',
      value: true,
    })
    expect(controllerFailure.metrics.deviceFlowLMin).toBe(0)
    expect(controllerFailure.alarms.some((item) => item.id === 'lvad-controller-fault')).toBe(true)
  })

  it('blocks unauthorized durable-LVAD speed changes and withholds mastery after the error', () => {
    let state = createInitialMcsState('practice', 'lvad', mcsPracticeScenarios[6])
    state = mcsReducer(state, { type: 'INSPECT', id: 'device' })
    state = mcsReducer(state, {
      type: 'SELECT_PREDICTION',
      id: state.scenario!.correctPredictionId,
    })
    state = mcsReducer(state, { type: 'COMMIT_PREDICTION' })
    const originalSpeed = state.device.kind === 'lvad' ? state.device.speedRpm : 0
    state = mcsReducer(state, { type: 'SET_LVAD_CONTROL', control: 'speedRpm', value: 5600 })
    expect(state.device.kind === 'lvad' ? state.device.speedRpm : 0).toBe(originalSpeed)
    expect(state.criticalErrors).toContain('lvad-unauthorized-speed-change')
    state = mcsReducer(state, { type: 'REASSESS' })
    state = mcsReducer(state, { type: 'COMPLETE' })
    expect(hasMcsMastery(state)).toBe(false)
  })

  it('enforces scenario permissions and the adjust-observe step before reassessment', () => {
    const definition = mcsPracticeScenarios[0]
    let state = createInitialMcsState('practice', 'iabp', definition)
    state = mcsReducer(state, { type: 'INSPECT', id: 'arterial' })
    state = mcsReducer(state, { type: 'SELECT_PREDICTION', id: definition.correctPredictionId })
    state = mcsReducer(state, { type: 'COMMIT_PREDICTION' })
    const preload = state.patient.preloadPercent
    state = mcsReducer(state, {
      type: 'SET_PATIENT_CONTROL',
      control: 'preloadPercent',
      value: 140,
    })
    expect(state.patient.preloadPercent).toBe(preload)
    expect(state.responseMessage).toMatch(/outside the permitted controls/i)
    state = mcsReducer(state, { type: 'REASSESS' })
    expect(state.reassessed).toBe(false)
    expect(state.responseMessage).toMatch(/management adjustment/i)
  })

  it('has a no-critical-error mastery path for the first IABP practice case', () => {
    const definition = mcsPracticeScenarios[0]
    let state = createInitialMcsState('practice', 'iabp', definition)
    state = mcsReducer(state, { type: 'INSPECT', id: 'arterial' })
    state = mcsReducer(state, { type: 'SELECT_PREDICTION', id: definition.correctPredictionId })
    state = mcsReducer(state, { type: 'COMMIT_PREDICTION' })
    state = mcsReducer(state, { type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: 0 })
    state = advanceMcsSimulation(state, 1)
    state = mcsReducer(state, { type: 'REASSESS' })
    state = mcsReducer(state, { type: 'COMPLETE' })
    expect(state.criticalErrors).toEqual([])
    expect(state.score?.total).toBeGreaterThanOrEqual(80)
    expect(hasMcsMastery(state)).toBe(true)
  })

  it.each(mcsPracticeScenarios.map((scenario) => [scenario.id, scenario] as const))(
    'has at least one safe mastery path for %s',
    (_id, definition) => {
      let state = createInitialMcsState('practice', definition.device, definition)
      for (const actionId of definition.requiredActionIds.filter((id) =>
        id.startsWith('inspect:'),
      )) {
        state = mcsReducer(state, { type: 'INSPECT', id: actionId })
      }
      state = mcsReducer(state, { type: 'SELECT_PREDICTION', id: definition.correctPredictionId })
      state = mcsReducer(state, { type: 'COMMIT_PREDICTION' })

      switch (definition.id) {
        case 'IABP-01':
          state = mcsReducer(state, {
            type: 'SET_IABP_CONTROL',
            control: 'deflationOffsetMs',
            value: 0,
          })
          break
        case 'IABP-02':
          state = mcsReducer(state, {
            type: 'SET_IABP_CONTROL',
            control: 'triggerSource',
            value: 'pressure',
          })
          state = mcsReducer(state, { type: 'SET_IABP_CONTROL', control: 'assistRatio', value: 1 })
          break
        case 'IABP-03':
          state = mcsReducer(state, { type: 'ESCALATE' })
          break
        case 'IMP-01':
          state = mcsReducer(state, {
            type: 'SET_IMPELLA_CONTROL',
            control: 'performanceLevel',
            value: 3,
          })
          state = mcsReducer(state, {
            type: 'SET_PATIENT_CONTROL',
            control: 'preloadPercent',
            value: 115,
          })
          state = mcsReducer(state, {
            type: 'SET_PATIENT_CONTROL',
            control: 'rightVentricularContractility',
            value: 1.1,
          })
          state = mcsReducer(state, {
            type: 'SET_PATIENT_CONTROL',
            control: 'pulmonaryVascularResistanceWU',
            value: 2,
          })
          break
        case 'IMP-02':
          state = mcsReducer(state, {
            type: 'SET_IMPELLA_CONTROL',
            control: 'position',
            value: 'correct',
          })
          break
        case 'IMP-03':
          state = mcsReducer(state, {
            type: 'SET_PATIENT_CONTROL',
            control: 'systemicVascularResistanceDynSecCm5',
            value: 800,
          })
          state = mcsReducer(state, {
            type: 'SET_IMPELLA_CONTROL',
            control: 'purgeState',
            value: 'normal',
          })
          break
        case 'LVAD-01':
          state = mcsReducer(state, {
            type: 'SET_PATIENT_CONTROL',
            control: 'systemicVascularResistanceDynSecCm5',
            value: 800,
          })
          break
        case 'LVAD-02':
          state = mcsReducer(state, {
            type: 'SET_PATIENT_CONTROL',
            control: 'rightVentricularContractility',
            value: 1.2,
          })
          state = mcsReducer(state, {
            type: 'SET_PATIENT_CONTROL',
            control: 'pulmonaryVascularResistanceWU',
            value: 1.5,
          })
          state = mcsReducer(state, { type: 'ESCALATE' })
          break
        case 'LVAD-03':
          state = mcsReducer(state, {
            type: 'SET_LVAD_CONTROL',
            control: 'powerConnected',
            value: true,
          })
          state = mcsReducer(state, { type: 'ESCALATE' })
          break
      }
      state = advanceMcsSimulation(state, 1)
      state = mcsReducer(state, { type: 'REASSESS' })
      state = mcsReducer(state, { type: 'COMPLETE' })
      expect(state.criticalErrors).toEqual([])
      expect(state.score?.total).toBeGreaterThanOrEqual(80)
      expect(hasMcsMastery(state)).toBe(true)
    },
  )
})
