import { prismaflexDeviceProfile } from '../../content/deviceProfiles'
import { createInitialCrrtSimulationState } from '../initialState'
import type { ActiveAlarm, ConfiguredPrescriptionState } from '../types'
import {
  prismaflexAlarmCategoryCandidates,
  prismaflexDeviceAdapter,
  prismaflexSetupSteps,
} from '../deviceAdapters/prismaflex'
import { getBaxterCrrtDeviceAdapter } from '../deviceAdapters/registry'

const configuredPrescription: ConfiguredPrescriptionState = {
  status: 'configured',
  modality: 'cvvhdf',
  flows: {
    bloodFlowMlMin: 180,
    dialysateFlowMlHour: 1_000,
    pbpFlowMlHour: 200,
    preReplacementFlowMlHour: 300,
    postReplacementFlowMlHour: 500,
    patientFluidRemovalMlHour: 100,
    syringeFlowMlHour: 0,
    makeupFlowMlHour: 0,
  },
  anticoagulation: 'none',
  reviewStatus: 'pending',
  sourceIds: ['DEV-PF-006'],
}

const alarm: ActiveAlarm = {
  id: 'ACCESS_OBSTRUCTION:0:1',
  code: 'ACCESS_OBSTRUCTION',
  cause: 'access-obstruction',
  urgency: 'therapy-interruption',
  startedAtSeconds: 0,
  active: true,
  deviceMappingStatus: 'pending-device-adapter',
  reviewStatus: 'pending',
}

describe('operational Prismaflex manual-reference adapter', () => {
  it('exposes the sourced setup sequence and four-category alarm vocabulary', () => {
    expect(prismaflexSetupSteps.map((step) => step.id)).toEqual([
      'choose-patient',
      'enter-patient-information',
      'choose-therapy',
      'choose-anticoagulation',
      'load-set',
      'prepare-solutions',
      'install-syringe-if-applicable',
      'verify-setup',
      'prime',
      'prime-test',
      'pretreatment-settings',
      'flow-settings',
      'anticoagulation-settings-if-applicable',
      'review-prescription',
      'connect-patient',
      'verify-patient-connection',
      'start-treatment',
    ])
    expect(prismaflexAlarmCategoryCandidates.map((category) => category.label)).toEqual([
      'Warning',
      'Malfunction',
      'Caution',
      'Advisory',
    ])
    expect(prismaflexDeviceAdapter.mapEngineAlarm(alarm)).toMatchObject({
      engineAlarmId: alarm.id,
      code: alarm.code,
      priorityLabel: 'Caution',
    })
  })

  it('validates all representable modalities while rejecting unsourced extensions', () => {
    expect(prismaflexDeviceAdapter.profile).toBe(prismaflexDeviceProfile)
    expect(prismaflexDeviceAdapter.runtimeStatus).toBe('operational-v1')
    expect(getBaxterCrrtDeviceAdapter('prismaflex-g5036003-6xx')).toBe(prismaflexDeviceAdapter)
    expect(prismaflexDeviceAdapter.validatePrescription(configuredPrescription)).toEqual({
      valid: true,
      errors: [],
    })

    const invalid = prismaflexDeviceAdapter.validatePrescription({
      ...configuredPrescription,
      flows: { ...configuredPrescription.flows, makeupFlowMlHour: 20 },
      anticoagulation: 'systemic-concept',
    })
    expect(invalid).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'UNSOURCED_MAKEUP_FLOW' }),
        expect.objectContaining({ code: 'CLINICAL_PROTOCOL_REQUIRED' }),
      ]),
    })
  })

  it('supports running, interruption, and end transitions', () => {
    const engineState = createInitialCrrtSimulationState({
      deviceId: 'prismaflex-g5036003-6xx',
    })
    const initial = prismaflexDeviceAdapter.createInitialDeviceState()
    expect(initial.adapterStatus).toBe('operational-v1')

    const running = prismaflexDeviceAdapter.reduceDeviceAction(
      initial,
      { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
      { simulationTimeSeconds: 0, engineState },
    )
    expect(running).toMatchObject({
      deliveryState: 'running',
      bloodPumpRunning: true,
      fluidPumpsRunning: true,
      patientConnected: true,
      returnClampClosed: false,
    })

    const paused = prismaflexDeviceAdapter.reduceDeviceAction(
      running,
      { type: 'SET_DELIVERY_STATE', deliveryState: 'paused' },
      { simulationTimeSeconds: 60, engineState },
    )
    expect(paused).toMatchObject({
      deliveryState: 'paused',
      bloodPumpRunning: false,
      fluidPumpsRunning: false,
    })

    const ended = prismaflexDeviceAdapter.reduceDeviceAction(
      paused,
      { type: 'SET_DELIVERY_STATE', deliveryState: 'ended' },
      { simulationTimeSeconds: 90, engineState },
    )
    expect(ended.deliveryState).toBe('ended')
    expect(
      prismaflexDeviceAdapter.reduceDeviceAction(
        ended,
        { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
        { simulationTimeSeconds: 120, engineState },
      ),
    ).toBe(ended)
  })

  it('projects the softkey, four-scale, history, calculation, alarm, and stop/end display', () => {
    const state = createInitialCrrtSimulationState({
      deviceId: 'prismaflex-g5036003-6xx',
    })
    expect(prismaflexDeviceAdapter.selectDisplayModel({ ...state, alarms: [alarm] })).toMatchObject(
      {
        deviceId: 'prismaflex-g5036003-6xx',
        adapterStatus: 'operational-v1',
        navigationParadigm: 'softkey-workflow',
        scaleLayout: ['Dialysate scale', 'Replacement scale', 'PBP scale', 'Effluent scale'],
        displayedCalculationContexts: [
          expect.stringMatching(/pump target Qeff/i),
          expect.stringMatching(/dose-section Qeff/i),
          'TMP',
          'Filter pressure drop',
        ],
        historyAvailable: true,
        stopEndOptions: expect.arrayContaining(['Stop treatment', 'End treatment']),
        alarms: [{ priorityLabel: 'Caution' }],
      },
    )
    expect(() =>
      prismaflexDeviceAdapter.selectDisplayModel(createInitialCrrtSimulationState()),
    ).toThrow(/requires a Prismaflex simulation state/i)
  })
})
