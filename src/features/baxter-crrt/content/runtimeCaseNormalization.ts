import type {
  ConfiguredPatientModelState,
  CrrtEngineFixture,
  CrrtModality,
  CrrtScheduledEventDefinition,
  SolutePoolState,
} from '../engine/types'
import {
  collectCrrtCaseSemanticIssues,
  runtimeCrrtCaseSchema,
  type RuntimeCrrtCase,
} from './schema'

type RuntimeSoluteConfiguration =
  RuntimeCrrtCase['engineFixtureConfiguration']['patient']['solutes']

function normalizeModality(
  modality: RuntimeCrrtCase['initialPrescription']['modality'],
): CrrtModality {
  switch (modality) {
    case 'SCUF':
      return 'scuf'
    case 'CVVH':
      return 'cvvh'
    case 'CVVHD':
      return 'cvvhd'
    case 'CVVHDF':
      return 'cvvhdf'
    default:
      return assertNever(modality)
  }
}

function uniqueSourceIds(...groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flat())]
}

function buildMmolSolute(
  id: 'sodium' | 'potassium' | 'bicarbonate' | 'urea-marker',
  concentrationMmolPerLiter: number,
  configuration: RuntimeSoluteConfiguration[typeof id],
  patientSourceIds: readonly string[],
): SolutePoolState {
  return {
    id,
    amountUnit: 'mmol',
    concentrationUnit: 'mmol/L',
    concentrationPerLiter: concentrationMmolPerLiter,
    distributionVolumeLiters: configuration.distributionVolumeLiters,
    productionAmountPerHour: configuration.productionAmountPerHour,
    inputAmountPerHour: configuration.inputAmountPerHour,
    residualClearanceMlMin: configuration.residualClearanceMlPerMin,
    filterPermeabilityFraction: configuration.filterPermeabilityFraction,
    reviewStatus: configuration.reviewStatus,
    sourceIds: uniqueSourceIds(patientSourceIds, configuration.sourceIds),
  }
}

function buildMgSolute(
  id: 'creatinine-marker' | 'phosphate' | 'magnesium',
  concentrationMgPerDeciliter: number,
  configuration: RuntimeSoluteConfiguration[typeof id],
  patientSourceIds: readonly string[],
): SolutePoolState {
  return {
    id,
    amountUnit: 'mg',
    concentrationUnit: 'mg/L',
    // Exact unit conversion only; the normalizer supplies no clinical value.
    concentrationPerLiter: concentrationMgPerDeciliter * 10,
    distributionVolumeLiters: configuration.distributionVolumeLiters,
    productionAmountPerHour: configuration.productionAmountPerHour,
    inputAmountPerHour: configuration.inputAmountPerHour,
    residualClearanceMlMin: configuration.residualClearanceMlPerMin,
    filterPermeabilityFraction: configuration.filterPermeabilityFraction,
    reviewStatus: configuration.reviewStatus,
    sourceIds: uniqueSourceIds(patientSourceIds, configuration.sourceIds),
  }
}

function normalizePatient(definition: RuntimeCrrtCase): ConfiguredPatientModelState {
  const authored = definition.initialPatient
  const configuration = definition.engineFixtureConfiguration.patient
  const soluteConfiguration = configuration.solutes

  return {
    status: 'configured',
    synthetic: true,
    bodyWeightKg: authored.simulatedBodyWeightKg,
    hematocritFraction: authored.hematocritFraction,
    intravascularReserveMl: authored.intravascularReserveMl,
    initialIntravascularReserveMl: authored.intravascularReserveMl,
    totalFluidOverloadMl: authored.totalFluidOverloadMl,
    vascularRefillCapacityMlHour: authored.vascularRefillCapacityMlPerHour,
    urineOutputMlHour: authored.urineOutputMlPerHour,
    residualKidneyClearanceMlMin: authored.residualRenalClearanceMlPerMin,
    heartRatePerMinute: authored.hemodynamics.heartRatePerMin,
    meanArterialPressureMmHg: authored.hemodynamics.meanArterialPressureMmHg,
    vasopressorSupportIndex: configuration.vasopressorSupportIndex,
    temperatureCelsius: authored.temperatureCelsius,
    pH: authored.solutes.pH,
    systemicIonizedCalciumMmolL: authored.solutes.systemicIonizedCalciumMmolPerL,
    totalCalciumMmolL: configuration.totalCalciumMmolL,
    glucoseMgDl: authored.solutes.glucoseMgPerDl,
    hemodynamicStressIndex: configuration.hemodynamicStressIndex,
    solutes: {
      sodium: buildMmolSolute(
        'sodium',
        authored.solutes.sodiumMmolPerL,
        soluteConfiguration.sodium,
        authored.sourceIds,
      ),
      potassium: buildMmolSolute(
        'potassium',
        authored.solutes.potassiumMmolPerL,
        soluteConfiguration.potassium,
        authored.sourceIds,
      ),
      bicarbonate: buildMmolSolute(
        'bicarbonate',
        authored.solutes.bicarbonateMmolPerL,
        soluteConfiguration.bicarbonate,
        authored.sourceIds,
      ),
      'urea-marker': buildMmolSolute(
        'urea-marker',
        authored.solutes.smallSoluteMarkerMmolPerL,
        soluteConfiguration['urea-marker'],
        authored.sourceIds,
      ),
      'creatinine-marker': buildMgSolute(
        'creatinine-marker',
        authored.solutes.creatinineMgPerDl,
        soluteConfiguration['creatinine-marker'],
        authored.sourceIds,
      ),
      phosphate: buildMgSolute(
        'phosphate',
        authored.solutes.phosphateMgPerDl,
        soluteConfiguration.phosphate,
        authored.sourceIds,
      ),
      magnesium: buildMgSolute(
        'magnesium',
        authored.solutes.magnesiumMgPerDl,
        soluteConfiguration.magnesium,
        authored.sourceIds,
      ),
    },
    reviewStatus: configuration.reviewStatus,
    sourceIds: [...authored.sourceIds],
  }
}

function normalizeEvents(definition: RuntimeCrrtCase): CrrtScheduledEventDefinition[] {
  const mappings = new Map(
    definition.engineFixtureConfiguration.timedEventMappings.map((mapping) => [
      mapping.timedEventId,
      mapping.action,
    ]),
  )

  return definition.timedEvents.map((event) => {
    const action = mappings.get(event.id)
    if (!action) {
      throw new Error(`Timed event ${event.id} is missing an engine mapping.`)
    }
    return {
      id: event.id,
      atSeconds: event.atSimulationSeconds,
      jitterSeconds: event.jitterSeconds,
      action,
      reviewStatus: event.reviewStatus,
      sourceIds: [...event.sourceIds],
    }
  })
}

/**
 * Normalizes a previously parsed runtime case. Callers accepting unknown input
 * should use parseRuntimeCrrtCaseToEngineFixture so Zod and semantic validation
 * run before any engine state can be created.
 */
export function normalizeRuntimeCrrtCaseToEngineFixture(
  definition: RuntimeCrrtCase,
): CrrtEngineFixture {
  const semanticIssues = collectCrrtCaseSemanticIssues(definition)
  if (semanticIssues.length > 0) {
    throw new Error(`Runtime CRRT case cannot be normalized: ${semanticIssues.join('; ')}`)
  }

  const configuration = definition.engineFixtureConfiguration
  const authoredAccess = definition.initialAccess
  const authoredPrescription = definition.initialPrescription

  return {
    id: definition.id,
    patient: normalizePatient(definition),
    access: {
      status: 'configured',
      catheterDescriptor: authoredAccess.catheter.descriptor,
      nominalFlowCapacityMlMin: authoredAccess.catheter.nominalFlowCapacityMlPerMin,
      accessResistanceMmHgPerMlMin: authoredAccess.accessResistanceMmHgPerMlPerMin,
      returnResistanceMmHgPerMlMin: authoredAccess.returnResistanceMmHgPerMlPerMin,
      positionResistanceMultiplier: configuration.access.positionResistanceMultiplier,
      recirculationFraction: authoredAccess.recirculationFraction,
      partialThrombusFraction: authoredAccess.partialThrombusFraction,
      accessKinked: authoredAccess.accessLineState === 'kinked',
      returnKinked: authoredAccess.returnLineState === 'kinked',
      accessConnected: authoredAccess.connectionState === 'connected',
      returnConnected: authoredAccess.connectionState === 'connected',
      reviewStatus: configuration.access.reviewStatus,
      sourceIds: [...authoredAccess.sourceIds],
    },
    prescription: {
      status: 'configured',
      modality: normalizeModality(authoredPrescription.modality),
      flows: {
        bloodFlowMlMin: authoredPrescription.bloodFlowMlPerMin,
        dialysateFlowMlHour: authoredPrescription.dialysateFlowMlPerHour,
        pbpFlowMlHour: authoredPrescription.preBloodPumpFlowMlPerHour,
        preReplacementFlowMlHour: authoredPrescription.preReplacementFlowMlPerHour,
        postReplacementFlowMlHour: authoredPrescription.postReplacementFlowMlPerHour,
        patientFluidRemovalMlHour: authoredPrescription.patientFluidRemovalMlPerHour,
        syringeFlowMlHour: authoredPrescription.syringeFlowMlPerHour,
        makeupFlowMlHour: authoredPrescription.makeupFlowMlPerHour,
      },
      anticoagulation: 'none',
      citrateRequestedButDisabled: false,
      reviewStatus: configuration.prescription.reviewStatus,
      sourceIds: [...authoredPrescription.sourceIds],
    },
    bags: configuration.bags.map((bag) => ({ ...bag, sourceIds: [...bag.sourceIds] })),
    externalFluidRates: { ...configuration.externalFluidRates },
    unintendedDeviceNetGainRateMlHour: configuration.unintendedDeviceNetGainRateMlHour,
    modelConfiguration: {
      ...configuration.modelConfiguration,
      pressure: {
        ...configuration.modelConfiguration.pressure,
        sourceIds: [...configuration.modelConfiguration.pressure.sourceIds],
      },
      filter: {
        ...configuration.modelConfiguration.filter,
        anticoagulationProtectionFraction: {
          ...configuration.modelConfiguration.filter.anticoagulationProtectionFraction,
        },
        sourceIds: [...configuration.modelConfiguration.filter.sourceIds],
      },
      hemodynamic: {
        ...configuration.modelConfiguration.hemodynamic,
        sourceIds: [...configuration.modelConfiguration.hemodynamic.sourceIds],
      },
      sourceIds: [...configuration.modelConfiguration.sourceIds],
    },
    events: normalizeEvents(definition),
    reviewStatus: definition.reviewStatus,
    sourceIds: uniqueSourceIds(
      configuration.sourceIds,
      definition.initialPatient.sourceIds,
      definition.initialAccess.sourceIds,
      definition.initialPrescription.sourceIds,
    ),
  }
}

/** Parse, semantically validate, and normalize an unknown authored payload. */
export function parseRuntimeCrrtCaseToEngineFixture(input: unknown): CrrtEngineFixture {
  return normalizeRuntimeCrrtCaseToEngineFixture(runtimeCrrtCaseSchema.parse(input))
}

function assertNever(value: never): never {
  throw new Error(`Unsupported CRRT modality: ${String(value)}`)
}
