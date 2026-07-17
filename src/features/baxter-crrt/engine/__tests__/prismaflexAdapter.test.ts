import { prismaflexReviewCandidateDeviceProfile } from '../../content/deviceProfiles'
import { createInitialCrrtSimulationState } from '../initialState'
import { evaluateEngineReadiness } from '../readiness'
import type { ActiveAlarm, ConfiguredPrescriptionState } from '../types'
import {
  prismaflexAlarmCategoryCandidates,
  prismaflexDeviceAdapter,
  prismaflexSetupSteps,
} from '../deviceAdapters/prismaflex'

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
  citrateRequestedButDisabled: false,
  reviewStatus: 'pending',
  sourceIds: ['DEV-PF-006'],
}

const alarm: ActiveAlarm = {
  id: 'ACCESS_OBSTRUCTION:0:1',
  code: 'ACCESS_OBSTRUCTION',
  cause: 'access-obstruction',
  urgency: null,
  startedAtSeconds: 0,
  active: true,
  deviceMappingStatus: 'pending-device-adapter',
  reviewStatus: 'pending',
}

describe('Prismaflex reviewer-only Phase 8 adapter candidate', () => {
  it('exposes an immutable, source-mapped setup sequence in manual order', () => {
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
    expect(Object.isFrozen(prismaflexSetupSteps)).toBe(true)
    expect(prismaflexSetupSteps.every(Object.isFrozen)).toBe(true)
    expect(prismaflexSetupSteps.every((step) => Object.isFrozen(step.sourceIds))).toBe(true)
    expect(
      prismaflexSetupSteps.every(
        (step) => step.reviewStatus === 'pending' && step.sourceIds[0] === 'DEV-PF-002',
      ),
    ).toBe(true)
  })

  it('represents the four manual alarm categories without assigning one to an engine alarm', () => {
    expect(prismaflexAlarmCategoryCandidates.map((category) => category.label)).toEqual([
      'Warning',
      'Malfunction',
      'Caution',
      'Advisory',
    ])
    expect(Object.isFrozen(prismaflexAlarmCategoryCandidates)).toBe(true)
    expect(prismaflexAlarmCategoryCandidates.every(Object.isFrozen)).toBe(true)

    expect(prismaflexDeviceAdapter.mapEngineAlarm(alarm)).toEqual({
      engineAlarmId: alarm.id,
      code: alarm.code,
      label: 'Engine condition: ACCESS_OBSTRUCTION',
      priorityLabel: 'Prismaflex category mapping pending',
      mappingReviewStatus: 'pending',
    })
  })

  it('satisfies the adapter contract while keeping every prescription fail-closed', () => {
    expect(prismaflexDeviceAdapter.profile).toBe(prismaflexReviewCandidateDeviceProfile)
    expect(prismaflexDeviceAdapter.candidateStatus).toBe('reviewer-only-not-runtime-registered')
    expect(prismaflexDeviceAdapter.getSetupSteps()).toBe(prismaflexSetupSteps)

    expect(prismaflexDeviceAdapter.validatePrescription(configuredPrescription)).toEqual({
      valid: false,
      errors: [
        expect.objectContaining({
          code: 'TARGET_CONFIGURATION_REVIEW_REQUIRED',
          sourceIds: ['DEV-PF-006', 'DEV-PF-008'],
          reviewStatus: 'pending',
        }),
      ],
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
        expect.objectContaining({ code: 'ANTICOAGULATION_NOT_ACTIVATED' }),
        expect.objectContaining({ code: 'TARGET_CONFIGURATION_REVIEW_REQUIRED' }),
      ]),
    })
  })

  it('keeps device state deferred and refuses all runtime delivery actions', () => {
    const engineState = createInitialCrrtSimulationState({
      deviceId: 'prismaflex-g5036003-6xx',
    })
    const deviceState = prismaflexDeviceAdapter.createInitialDeviceState()

    expect(deviceState).toEqual({
      deliveryState: 'idle',
      bloodPumpRunning: false,
      fluidPumpsRunning: false,
      patientConnected: false,
      returnClampClosed: true,
      adapterStatus: 'deferred',
    })
    expect(evaluateEngineReadiness(engineState)).toMatchObject({
      readyForDraftSimulation: false,
      missing: expect.arrayContaining(['available device adapter']),
    })
    expect(() =>
      prismaflexDeviceAdapter.reduceDeviceAction(
        deviceState,
        { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
        { simulationTimeSeconds: 0, engineState },
      ),
    ).toThrow(/not registered in learner runtime/i)
  })

  it('selects only a pending display model for an unloaded Prismaflex review state', () => {
    const prismaflexState = createInitialCrrtSimulationState({
      deviceId: 'prismaflex-g5036003-6xx',
    })
    expect(
      prismaflexDeviceAdapter.selectDisplayModel({ ...prismaflexState, alarms: [alarm] }),
    ).toMatchObject({
      deviceId: 'prismaflex-g5036003-6xx',
      deliveryState: 'idle',
      adapterStatus: 'deferred',
      alarms: [{ priorityLabel: 'Prismaflex category mapping pending' }],
    })

    expect(() =>
      prismaflexDeviceAdapter.selectDisplayModel(createInitialCrrtSimulationState()),
    ).toThrow(/requires an unloaded Prismaflex review state/i)
  })
})
