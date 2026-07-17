import type { BaxterCrrtDeviceId, BaxterCrrtReviewStatus } from '../content/deviceProfiles'

export const crrtExperiences = ['orientation', 'learn', 'practice', 'mastery'] as const
export type CrrtExperience = (typeof crrtExperiences)[number]

export const crrtRoleLenses = ['prescriber', 'operator', 'integrated'] as const
export type CrrtRoleLens = (typeof crrtRoleLenses)[number]

export const crrtStationIds = [
  'orientation',
  'define-goal',
  'build-prescription',
  'setup-start',
  'monitor-dose-fluid',
  'pressures-troubleshooting',
  'anticoagulation-complications-liberation',
] as const
export type CrrtStationId = (typeof crrtStationIds)[number]

export const crrtModalities = ['scuf', 'cvvh', 'cvvhd', 'cvvhdf'] as const
export type CrrtModality = (typeof crrtModalities)[number]

export const crrtSoluteIds = [
  'sodium',
  'potassium',
  'bicarbonate',
  'urea-marker',
  'creatinine-marker',
  'phosphate',
  'magnesium',
] as const
export type CrrtSoluteId = (typeof crrtSoluteIds)[number]

export type CrrtAnticoagulationMethod = 'none' | 'systemic-concept'

export interface SolutePoolState {
  readonly id: CrrtSoluteId
  readonly amountUnit: 'mmol' | 'mg' | 'model-unit'
  readonly concentrationUnit: 'mmol/L' | 'mg/L' | 'model-unit/L'
  readonly concentrationPerLiter: number
  readonly distributionVolumeLiters: number
  readonly productionAmountPerHour: number
  readonly inputAmountPerHour: number
  readonly residualClearanceMlMin: number
  readonly filterPermeabilityFraction: number
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export interface UnconfiguredPatientModelState {
  readonly status: 'unconfigured'
  readonly synthetic: true
  readonly reviewStatus: 'pending'
  readonly sourceIds: readonly string[]
}

export interface ConfiguredPatientModelState {
  readonly status: 'configured'
  readonly synthetic: true
  readonly bodyWeightKg: number
  readonly hematocritFraction: number
  readonly intravascularReserveMl: number
  readonly initialIntravascularReserveMl: number
  readonly totalFluidOverloadMl: number
  readonly vascularRefillCapacityMlHour: number
  readonly urineOutputMlHour: number
  readonly residualKidneyClearanceMlMin: number
  readonly heartRatePerMinute: number
  readonly meanArterialPressureMmHg: number
  readonly vasopressorSupportIndex: number
  readonly temperatureCelsius: number
  readonly pH: number
  readonly systemicIonizedCalciumMmolL: number
  readonly totalCalciumMmolL: number | null
  readonly glucoseMgDl: number | null
  readonly hemodynamicStressIndex: number
  readonly solutes: Readonly<Partial<Record<CrrtSoluteId, SolutePoolState>>>
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export type PatientModelState = UnconfiguredPatientModelState | ConfiguredPatientModelState

export interface UnconfiguredAccessState {
  readonly status: 'unconfigured'
  readonly reviewStatus: 'pending'
  readonly sourceIds: readonly string[]
}

export interface ConfiguredAccessState {
  readonly status: 'configured'
  readonly catheterDescriptor: string
  readonly nominalFlowCapacityMlMin: number
  readonly accessResistanceMmHgPerMlMin: number
  readonly returnResistanceMmHgPerMlMin: number
  readonly positionResistanceMultiplier: number
  readonly recirculationFraction: number
  readonly partialThrombusFraction: number
  readonly accessKinked: boolean
  readonly returnKinked: boolean
  readonly accessConnected: boolean
  readonly returnConnected: boolean
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export type AccessState = UnconfiguredAccessState | ConfiguredAccessState

export const crrtFlowRateKeys = [
  'bloodFlowMlMin',
  'dialysateFlowMlHour',
  'pbpFlowMlHour',
  'preReplacementFlowMlHour',
  'postReplacementFlowMlHour',
  'patientFluidRemovalMlHour',
  'syringeFlowMlHour',
  'makeupFlowMlHour',
] as const
export type CrrtFlowRateKey = (typeof crrtFlowRateKeys)[number]
export type CrrtFlowRates = Readonly<Record<CrrtFlowRateKey, number>>

export interface UnconfiguredPrescriptionState {
  readonly status: 'unconfigured'
  readonly modality: null
  readonly flows: CrrtFlowRates
  readonly anticoagulation: 'none'
  readonly citrateRequestedButDisabled: false
  readonly reviewStatus: 'pending'
  readonly sourceIds: readonly string[]
}

export interface ConfiguredPrescriptionState {
  readonly status: 'configured'
  readonly modality: CrrtModality
  readonly flows: CrrtFlowRates
  readonly anticoagulation: CrrtAnticoagulationMethod
  readonly citrateRequestedButDisabled: boolean
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export type PrescriptionState = UnconfiguredPrescriptionState | ConfiguredPrescriptionState

export type CrrtFlowTerm =
  | 'dialysate'
  | 'pbp'
  | 'pre-replacement'
  | 'post-replacement'
  | 'syringe'
  | 'makeup'
  | 'effluent'

export interface BagState {
  readonly id: string
  readonly label: string
  readonly flowTerm: CrrtFlowTerm
  readonly direction: 'source' | 'effluent'
  readonly capacityMl: number
  readonly calculatedVolumeMl: number
  readonly measuredVolumeMl: number
  readonly cumulativePumpVolumeMl: number
  readonly connected: boolean
  readonly scaleOpen: boolean
  readonly externalInterferenceMl: number
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export interface FilterState {
  readonly filterId: string | null
  readonly effectivePermeabilityFraction: number
  readonly foulingBurdenFraction: number
  readonly clotBurdenFraction: number
  readonly bloodFlowInterruptionFraction: number
  readonly lowEffectiveBloodFlowFraction: number
  readonly procoagulantBurdenFraction: number
}

export interface CrrtPressureState {
  readonly inputConvention: 'raw-sensor'
  readonly accessPressureMmHg: number | null
  readonly filterPressureMmHg: number | null
  readonly returnPressureMmHg: number | null
  readonly effluentPressureMmHg: number | null
  readonly prismaxTransmembranePressureMmHg: number | null
  readonly prismaxFilterPressureDropMmHg: number | null
}

export interface DisabledCitrateState {
  readonly status: 'disabled-pending-local-protocol'
  readonly protocolProfileId: null
  readonly citrateDeliveryRate: null
  readonly calciumReplacementRate: null
  readonly postFilterIonizedCalcium: null
  readonly reviewStatus: 'pending'
  readonly sourceIds: readonly ['PROTO-001']
}

export interface CircuitState {
  readonly modality: CrrtModality | null
  readonly flows: CrrtFlowRates
  readonly anticoagulation: CrrtAnticoagulationMethod
  readonly filter: FilterState
  readonly airDetected: boolean
  readonly bloodLeakDetected: boolean
  readonly bags: readonly BagState[]
  readonly pressures: CrrtPressureState
  readonly citrate: DisabledCitrateState
}

export interface CrrtDeviceState {
  readonly deliveryState: 'idle' | 'running' | 'paused' | 'ended'
  readonly bloodPumpRunning: boolean
  readonly fluidPumpsRunning: boolean
  readonly patientConnected: boolean
  readonly returnClampClosed: boolean
  readonly adapterStatus: 'available-phase-3' | 'deferred'
}

export interface ExternalFluidRates {
  readonly maintenanceInputMlHour: number
  readonly medicationCarrierInputMlHour: number
  readonly nutritionInputMlHour: number
  readonly bloodProductInputMlHour: number
  readonly bolusInputMlHour: number
  readonly otherInputMlHour: number
  readonly urineOutputMlHour: number
  readonly drainOutputMlHour: number
  readonly otherOutputMlHour: number
}

export interface FluidLedgerTotals {
  readonly maintenanceInputMl: number
  readonly medicationCarrierInputMl: number
  readonly nutritionInputMl: number
  readonly bloodProductInputMl: number
  readonly bolusInputMl: number
  readonly otherInputMl: number
  readonly urineOutputMl: number
  readonly drainOutputMl: number
  readonly otherOutputMl: number
  readonly machinePatientFluidRemovalMl: number
  readonly unintendedDeviceNetGainMl: number
}

export type DowntimeReason = 'not-started' | 'paused' | 'access' | 'alarm' | 'bag-scale' | 'other'

export interface DeliveredTherapyState {
  readonly prescribedEffluentRateMlHour: number | null
  readonly prescribedEffluentDoseMlKgHour: number | null
  readonly cumulativeActualEffluentMl: number
  readonly deliveredDoseMlKgHour: number | null
  readonly chartingWindowSeconds: number
  readonly cumulativeDowntimeSeconds: number
  readonly downtimeSecondsByReason: Readonly<Record<DowntimeReason, number>>
  readonly cumulativeMachinePatientFluidRemovalMl: number
  readonly cumulativeWholePatientBalanceMl: number
  readonly fluidLedger: FluidLedgerTotals
  readonly filtrationFraction: number | null
  readonly treatmentTimeSeconds: number
  readonly setTimeSeconds: number
}

export interface PressureModelParameters {
  readonly accessReferencePressureMmHg: number
  readonly disconnectedAccessPressureMmHg: number
  readonly returnReferencePressureMmHg: number
  readonly disconnectedReturnPressureMmHg: number
  readonly observedEffluentPressureMmHg: number
  readonly filterResistanceMmHgPerMlMin: number
  readonly partialThrombusResistanceGainAtFullBurden: number
  readonly foulingResistanceGainMmHgPerMlMinAtFullBurden: number
  readonly clotResistanceGainMmHgPerMlMinAtFullBurden: number
  readonly accessKinkResistanceMultiplier: number
  readonly returnKinkResistanceMultiplier: number
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export interface FilterProgressionParameters {
  readonly foulingFractionPerHourAtRiskOne: number
  readonly clotFractionPerHourAtRiskOne: number
  readonly filtrationFractionWeight: number
  readonly interruptionWeight: number
  readonly lowFlowWeight: number
  readonly accessDysfunctionWeight: number
  readonly hematocritWeight: number
  readonly procoagulantWeight: number
  readonly anticoagulationProtectionFraction: Readonly<Record<CrrtAnticoagulationMethod, number>>
  readonly referenceHematocritFraction: number
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export interface HemodynamicModelParameters {
  readonly stressGainPerExcessRemovalLiter: number
  readonly stressRecoveryPerHour: number
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export interface EngineModelConfiguration {
  readonly pressure: PressureModelParameters | null
  readonly filter: FilterProgressionParameters | null
  readonly hemodynamic: HemodynamicModelParameters | null
  /** Explicit authored input; the disputed PrisMax Qpre expression is never derived. */
  readonly filterInletConcentrationFraction: number | null
  /** Explicit authored educational input; no clinical target range is implied. */
  readonly filtrationFraction: number | null
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export const crrtEngineFaultIds = [
  'access-obstruction',
  'access-disconnection',
  'return-obstruction',
  'return-disconnection',
  'filter-fouling',
  'effluent-obstruction',
  'air-detected',
  'blood-leak-detected',
  'supply-bag-empty',
  'effluent-bag-full',
  'scale-open',
  'fluid-gain-loss',
  'power-interruption',
] as const
export type CrrtEngineFaultId = (typeof crrtEngineFaultIds)[number]

export type ExternalFluidRateKey = keyof ExternalFluidRates

export type CrrtScheduledEventAction =
  | { readonly type: 'SET_FAULT'; readonly fault: CrrtEngineFaultId; readonly active: boolean }
  | {
      readonly type: 'SET_EXTERNAL_FLUID_RATE'
      readonly field: ExternalFluidRateKey
      readonly rateMlHour: number
    }
  | { readonly type: 'SET_ACCESS_RESISTANCE'; readonly resistanceMmHgPerMlMin: number }
  | { readonly type: 'SET_RETURN_RESISTANCE'; readonly resistanceMmHgPerMlMin: number }
  | {
      readonly type: 'SET_FILTER_RISK'
      readonly procoagulantBurdenFraction: number
      readonly lowEffectiveBloodFlowFraction: number
    }
  | {
      readonly type: 'SET_DELIVERY_STATE'
      readonly deliveryState: CrrtDeviceState['deliveryState']
    }
  | {
      readonly type: 'SET_OBSERVED_EFFLUENT_PRESSURE'
      readonly pressureMmHg: number
    }

export interface CrrtScheduledEventDefinition {
  readonly id: string
  readonly atSeconds: number
  readonly jitterSeconds: Readonly<{ minimum: number; maximum: number }> | null
  readonly action: CrrtScheduledEventAction
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export interface CrrtScheduledEvent extends CrrtScheduledEventDefinition {
  readonly scheduledAtSeconds: number
}

export interface ScenarioState {
  readonly status: 'unloaded' | 'loaded'
  readonly fixtureId: string | null
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly activeFaults: readonly CrrtEngineFaultId[]
  readonly eventQueue: readonly CrrtScheduledEvent[]
  readonly appliedEventIds: readonly string[]
  readonly externalFluidRates: ExternalFluidRates
  readonly unintendedDeviceNetGainRateMlHour: number
  readonly modelConfiguration: EngineModelConfiguration
  readonly sourceIds: readonly string[]
}

export type EngineAlarmUrgency = 'attention' | 'therapy-interruption' | 'safety-stop'

export type EngineAlarmCode =
  | 'ACCESS_OBSTRUCTION'
  | 'ACCESS_DISCONNECTION'
  | 'RETURN_OBSTRUCTION'
  | 'RETURN_DISCONNECTION'
  | 'FILTER_FOULING'
  | 'EFFLUENT_OBSTRUCTION'
  | 'AIR_DETECTED'
  | 'BLOOD_LEAK_DETECTED'
  | 'SUPPLY_BAG_EMPTY'
  | 'EFFLUENT_BAG_FULL'
  | 'SCALE_OPEN'
  | 'FLUID_GAIN_LOSS'
  | 'POWER_INTERRUPTION'

export interface ActiveAlarm {
  readonly id: string
  readonly code: EngineAlarmCode
  readonly cause: CrrtEngineFaultId
  /** Null until a reviewed device adapter supplies a device-specific priority. */
  readonly urgency: EngineAlarmUrgency | null
  readonly startedAtSeconds: number
  readonly acknowledgedAtSeconds?: number
  readonly resolvedAtSeconds?: number
  readonly active: boolean
  readonly deviceMappingStatus: 'pending-device-adapter'
  readonly reviewStatus: 'pending'
}

export interface InterventionRecord {
  readonly id: string
  readonly type: CrrtScheduledEventAction['type'] | 'ACKNOWLEDGE_ALARM'
  readonly atSeconds: number
  readonly source: 'engine-event' | 'engine-action'
}

export interface TrendSample {
  readonly timeSeconds: number
  readonly prescribedEffluentDoseMlKgHour: number | null
  readonly deliveredDoseMlKgHour: number | null
  readonly cumulativeActualEffluentMl: number
  readonly cumulativeMachinePatientFluidRemovalMl: number
  readonly cumulativeWholePatientBalanceMl: number
  readonly accessPressureMmHg: number | null
  readonly filterPressureMmHg: number | null
  readonly returnPressureMmHg: number | null
  readonly transmembranePressureMmHg: number | null
  readonly foulingBurdenFraction: number
  readonly clotBurdenFraction: number
  readonly hemodynamicStressIndex: number | null
  readonly soluteConcentrationsPerLiter: Readonly<Partial<Record<CrrtSoluteId, number>>>
}

export interface CrrtSimulationState {
  readonly engineVersion: string
  readonly schemaVersion: string
  readonly contentVersion: string
  readonly deviceProfileVersion: string
  readonly protocolProfileVersion: string | null
  readonly simulationTimeSeconds: number
  readonly seed: number
  readonly randomState: number
  readonly nextAlarmSequence: number
  readonly nextInterventionSequence: number
  readonly experience: CrrtExperience
  readonly deviceId: BaxterCrrtDeviceId
  readonly roleLens: CrrtRoleLens
  readonly patient: PatientModelState
  readonly access: AccessState
  readonly circuit: CircuitState
  readonly prescription: PrescriptionState
  readonly device: CrrtDeviceState
  readonly deliveredTherapy: DeliveredTherapyState
  readonly scenario: ScenarioState
  readonly alarms: readonly ActiveAlarm[]
  readonly alarmHistory: readonly ActiveAlarm[]
  readonly interventions: readonly InterventionRecord[]
  readonly trends: readonly TrendSample[]
}

export interface CrrtEngineFixture {
  readonly id: string
  readonly patient: ConfiguredPatientModelState
  readonly access: ConfiguredAccessState
  readonly prescription: ConfiguredPrescriptionState
  readonly bags?: readonly BagState[]
  readonly externalFluidRates: ExternalFluidRates
  readonly unintendedDeviceNetGainRateMlHour: number
  readonly modelConfiguration: EngineModelConfiguration
  readonly events: readonly CrrtScheduledEventDefinition[]
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly sourceIds: readonly string[]
}

export interface CreateCrrtStateOptions {
  readonly experience?: CrrtExperience
  readonly roleLens?: CrrtRoleLens
  readonly deviceId?: BaxterCrrtDeviceId
  readonly seed?: number
  readonly attempt?: number
  readonly fixture?: CrrtEngineFixture
}

export type CrrtEngineAction =
  | { readonly type: 'RESET'; readonly options?: CreateCrrtStateOptions }
  | {
      readonly type: 'LOAD_FIXTURE'
      readonly fixture: CrrtEngineFixture
      readonly experience: CrrtExperience
      readonly roleLens: CrrtRoleLens
      readonly attempt: number
      readonly deviceId?: BaxterCrrtDeviceId
    }
  | {
      readonly type: 'SET_DELIVERY_STATE'
      readonly deliveryState: CrrtDeviceState['deliveryState']
    }
  | { readonly type: 'SET_PRESCRIPTION'; readonly prescription: ConfiguredPrescriptionState }
  | { readonly type: 'SET_EXTERNAL_FLUID_RATES'; readonly rates: ExternalFluidRates }
  | { readonly type: 'SET_FAULT'; readonly fault: CrrtEngineFaultId; readonly active: boolean }
  | { readonly type: 'CORRECT_FAULT'; readonly fault: CrrtEngineFaultId }
  | { readonly type: 'ACKNOWLEDGE_ALARM'; readonly alarmId: string }
  | { readonly type: 'ADVANCE_TIME'; readonly seconds: number }
