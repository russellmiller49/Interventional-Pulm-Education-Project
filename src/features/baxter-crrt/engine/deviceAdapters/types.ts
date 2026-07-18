import type { BaxterCrrtDeviceId, BaxterCrrtDraftDeviceProfile } from '../../content/deviceProfiles'
import type { ActiveAlarm, CrrtDeviceState, CrrtSimulationState, PrescriptionState } from '../types'

export interface SetupStepDefinition {
  readonly id: string
  readonly label: string
  readonly sourceIds: readonly string[]
  readonly reviewStatus: 'pending' | 'reviewed' | 'approved'
}

export interface DeviceValidationResult {
  readonly valid: boolean
  readonly errors: readonly {
    readonly code: string
    readonly message: string
    readonly sourceIds: readonly string[]
    readonly reviewStatus: 'pending' | 'reviewed' | 'approved'
  }[]
}

export type CrrtDeviceAction =
  | {
      readonly type: 'SET_DELIVERY_STATE'
      readonly deliveryState: CrrtDeviceState['deliveryState']
    }
  | { readonly type: 'ACKNOWLEDGE_ALARM'; readonly alarmId: string }

export interface DeviceAdapterContext {
  readonly simulationTimeSeconds: number
  readonly engineState: CrrtSimulationState
}

export interface DisplayAlarm {
  readonly engineAlarmId: string
  readonly code: string
  readonly label: string
  readonly priorityLabel: string
  readonly mappingReviewStatus: 'pending' | 'reviewed' | 'approved'
}

export interface DeviceDisplayModel {
  readonly deviceId: BaxterCrrtDeviceId
  readonly deliveryState: CrrtDeviceState['deliveryState']
  readonly adapterStatus: CrrtDeviceState['adapterStatus']
  readonly alarms: readonly DisplayAlarm[]
  readonly navigationParadigm: 'procedure-workflow' | 'softkey-workflow'
  readonly scaleLayout: readonly string[]
  readonly displayedCalculationContexts: readonly string[]
  readonly historyAvailable: true
  readonly stopEndOptions: readonly string[]
}

/**
 * Shared operational device contract. Adapters project one canonical engine
 * state into device-specific navigation, vocabulary, calculations, alarms,
 * scale topology, history, and stop/end controls.
 */
export interface CrrtDeviceAdapter {
  readonly id: BaxterCrrtDeviceId
  readonly runtimeStatus: 'operational-v1'
  readonly profile: Readonly<BaxterCrrtDraftDeviceProfile>

  createInitialDeviceState(): CrrtDeviceState
  getSetupSteps(): readonly SetupStepDefinition[]
  validatePrescription(input: PrescriptionState): DeviceValidationResult
  reduceDeviceAction(
    state: CrrtDeviceState,
    action: CrrtDeviceAction,
    context: DeviceAdapterContext,
  ): CrrtDeviceState
  mapEngineAlarm(alarm: ActiveAlarm): DisplayAlarm
  selectDisplayModel(state: CrrtSimulationState): DeviceDisplayModel
}
