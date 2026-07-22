import {
  advanceWindkesselCompartments,
  createInitialCirculationCompartments,
  totalCirculatingVolumeMl,
  type CirculationCompartmentState,
  type CirculationParameters,
  type HemodynamicMeasurements,
  type MechanicalSupportEffect,
} from '@/features/hemodynamics-core'

import { clamp, moveTowardExp } from './math'
import type {
  IcuDeviceStates,
  IcuPatientState,
  IcuPhysiologyCalibration,
  IcuTherapyEffect,
} from './types'

const REFERENCE_CIRCULATING_VOLUME_ML = 4_360
const FIXED_CARDIAC_VOLUME_ML = 260
const SCALABLE_VASCULAR_VOLUME_ML = REFERENCE_CIRCULATING_VOLUME_ML - FIXED_CARDIAC_VOLUME_ML

function coreCirculatingVolumeFraction(volumeMl: number): number {
  return clamp((volumeMl - FIXED_CARDIAC_VOLUME_ML) / SCALABLE_VASCULAR_VOLUME_ML, 0.2, 1.8)
}

function activePeep(devices: IcuDeviceStates): number {
  return devices.ventilator.status === 'running' ? devices.ventilator.peepCmH2O : 3
}

export function createIcuPhysiologyCalibration(
  patient: IcuPatientState,
  devices: IcuDeviceStates,
): IcuPhysiologyCalibration {
  return {
    initialDrivers: { ...patient.drivers },
    initialHemodynamics: { ...patient.hemodynamics },
    initialPeepCmH2O: activePeep(devices),
  }
}

export function deriveIcuCirculationParameters(
  patient: IcuPatientState,
  devices: IcuDeviceStates,
  calibration: IcuPhysiologyCalibration = createIcuPhysiologyCalibration(patient, devices),
): CirculationParameters {
  const drivers = patient.drivers
  const initialDrivers = calibration.initialDrivers
  const initialHemodynamics = calibration.initialHemodynamics
  const medications = patient.medications
  const leftContractility = clamp(
    initialHemodynamics.leftVentricularContractility -
      (drivers.leftVentricularFailureSeverity - initialDrivers.leftVentricularFailureSeverity) *
        0.78 +
      medications.inotropeTier * 0.14,
    0.18,
    1.55,
  )
  const rightContractility = clamp(
    initialHemodynamics.rightVentricularContractility -
      (drivers.rightVentricularFailureSeverity - initialDrivers.rightVentricularFailureSeverity) *
        0.74 +
      medications.inotropeTier * 0.1,
    0.18,
    1.5,
  )
  const svr = clamp(
    initialHemodynamics.systemicVascularResistanceDynSecCm5 -
      (drivers.vasoplegiaSeverity - initialDrivers.vasoplegiaSeverity) * 1_050 +
      medications.vasopressorTier * 260,
    320,
    2_600,
  )
  const pvr = clamp(
    initialHemodynamics.pulmonaryVascularResistanceWU +
      (drivers.pulmonaryVascularObstructionSeverity -
        initialDrivers.pulmonaryVascularObstructionSeverity) *
        10 +
      (drivers.lungInjurySeverity - initialDrivers.lungInjurySeverity) * 1.8,
    0.7,
    16,
  )
  const peep = activePeep(devices)
  const circulatingVolumeFraction = coreCirculatingVolumeFraction(
    patient.hemodynamics.circulatingVolumeMl,
  )
  const volumeRatio = clamp(
    patient.hemodynamics.circulatingVolumeMl / Math.max(1, initialHemodynamics.circulatingVolumeMl),
    0.35,
    2,
  )
  const initialPeepFactor = clamp(
    1 - Math.max(0, calibration.initialPeepCmH2O - 5) * 0.025,
    0.5,
    1.05,
  )
  const currentPeepFactor = clamp(1 - Math.max(0, peep - 5) * 0.025, 0.5, 1.05)
  const initialTamponadeFactor = clamp(1 - initialDrivers.tamponadePressureMmHg * 0.035, 0.25, 1)
  const currentTamponadeFactor = clamp(
    1 - (patient.tamponadeDrained ? 0 : drivers.tamponadePressureMmHg) * 0.035,
    0.25,
    1,
  )
  const leftRatio =
    leftContractility / Math.max(0.18, initialHemodynamics.leftVentricularContractility)
  const rightDeliveryRatio =
    (rightContractility / Math.max(0.18, initialHemodynamics.rightVentricularContractility)) *
    ((0.8 + initialHemodynamics.pulmonaryVascularResistanceWU * 0.08) / (0.8 + pvr * 0.08))
  const afterloadRatio = clamp(
    initialHemodynamics.systemicVascularResistanceDynSecCm5 / Math.max(320, svr),
    0.45,
    2.2,
  )
  const heartRateRatio =
    patient.hemodynamics.heartRateBpm / Math.max(30, initialHemodynamics.heartRateBpm)
  const nativeCardiacOutput = clamp(
    initialHemodynamics.nativeCardiacOutputLMin *
      volumeRatio ** 0.42 *
      clamp(leftRatio, 0.25, 2.2) ** 0.78 *
      clamp(rightDeliveryRatio, 0.2, 2.2) ** 0.52 *
      afterloadRatio ** 0.28 *
      clamp(currentPeepFactor / initialPeepFactor, 0.45, 1.5) *
      clamp(currentTamponadeFactor / initialTamponadeFactor, 0.2, 4) *
      clamp(heartRateRatio, 0.4, 2),
    0.3,
    12,
  )

  return {
    heartRateBpm: patient.hemodynamics.heartRateBpm,
    respiratoryRateBpm: patient.respiratory.spontaneousRatePerMin,
    bodySurfaceAreaM2: patient.bodySurfaceAreaM2,
    referenceCardiacOutputLMin: nativeCardiacOutput,
    circulatingVolumeFraction,
    stressedVenousVolumeMl: 800 * circulatingVolumeFraction,
    venousComplianceMlMmHg: 105,
    systemicVascularResistanceDynSecCm5: svr,
    pulmonaryVascularResistanceWU: pvr,
    systemicArterialComplianceMlMmHg: 1.45,
    pulmonaryArterialComplianceMlMmHg: 2.3,
    leftVentricularContractility: leftContractility,
    rightVentricularContractility: rightContractility,
    leftVentricularCompliance: 0.72,
    rightVentricularCompliance: 0.82,
    rightAtrialPressureSetPointMmHg: 6,
    leftAtrialPressureSetPointMmHg: 10,
    pericardialPressureMmHg: patient.tamponadeDrained ? 0 : drivers.tamponadePressureMmHg,
    peepCmH2O: peep,
    pleuralPressureSwingMmHg: patient.respiratory.intubated ? 1 : 4,
    arterialOxygenSaturationPercent: patient.respiratory.spo2Percent,
    mixedVenousOxygenSaturationPercent: clamp(
      75 - patient.perfusion.oxygenExtractionRatio * 55,
      35,
      80,
    ),
    tricuspidRegurgitationSeverity: drivers.rightVentricularFailureSeverity * 0.35,
    shuntFraction: patient.respiratory.shuntFraction,
    rhythmRegularity: 1,
    spontaneousBreathingFraction: patient.respiratory.intubated ? 0.1 : 1,
    fluidResponsiveness: clamp(1.2 - circulatingVolumeFraction, 0, 1),
  }
}

export function deriveIcuBaselineMeasurements(
  patient: IcuPatientState,
  parameters: CirculationParameters,
  calibration: IcuPhysiologyCalibration,
): HemodynamicMeasurements {
  const initial = calibration.initialHemodynamics
  const initialVolumeFraction = coreCirculatingVolumeFraction(initial.circulatingVolumeMl)
  const volumeFraction = parameters.circulatingVolumeFraction
  const peepDelta = (parameters.peepCmH2O - calibration.initialPeepCmH2O) * 0.14
  const tamponadeDelta =
    parameters.pericardialPressureMmHg - calibration.initialDrivers.tamponadePressureMmHg
  const rap = clamp(
    initial.rapMmHg +
      (volumeFraction - initialVolumeFraction) * 13 +
      (initial.rightVentricularContractility - parameters.rightVentricularContractility) * 15 +
      (parameters.pulmonaryVascularResistanceWU - initial.pulmonaryVascularResistanceWU) * 0.5 +
      peepDelta +
      tamponadeDelta * 0.65,
    -2,
    38,
  )
  const pawp = clamp(
    initial.pawpMmHg +
      (volumeFraction - initialVolumeFraction) * 15 +
      (initial.leftVentricularContractility - parameters.leftVentricularContractility) * 22 +
      peepDelta +
      tamponadeDelta * 0.55,
    1,
    45,
  )
  const cardiacOutput = parameters.referenceCardiacOutputLMin
  const meanPap = clamp(
    initial.meanPapMmHg +
      (pawp - initial.pawpMmHg) +
      (parameters.pulmonaryVascularResistanceWU * cardiacOutput -
        initial.pulmonaryVascularResistanceWU * initial.nativeCardiacOutputLMin),
    5,
    90,
  )
  const initialRawMap =
    initial.rapMmHg +
    (initial.nativeCardiacOutputLMin * initial.systemicVascularResistanceDynSecCm5) / 80
  const currentRawMap = rap + (cardiacOutput * parameters.systemicVascularResistanceDynSecCm5) / 80
  const map = clamp(initial.mapMmHg + currentRawMap - initialRawMap, 20, 180)
  const pulseScale = clamp(
    cardiacOutput /
      Math.max(30, parameters.heartRateBpm) /
      (initial.nativeCardiacOutputLMin / Math.max(30, initial.heartRateBpm)),
    0.25,
    2,
  )
  const systolic = map + (initial.systolicMmHg - initial.mapMmHg) * pulseScale
  const diastolic = map - (initial.mapMmHg - initial.diastolicMmHg) * pulseScale
  const pulsePressure = systolic - diastolic
  const papPulse = clamp(6 + parameters.rightVentricularContractility * 13, 4, 25)
  return {
    heartRateBpm: parameters.heartRateBpm,
    spo2Percent: patient.respiratory.spo2Percent,
    artSystolicMmHg: systolic,
    artDiastolicMmHg: diastolic,
    mapMmHg: map,
    rapMmHg: rap,
    rvSystolicMmHg: meanPap + papPulse * 0.58,
    rvDiastolicMmHg: rap,
    papSystolicMmHg: meanPap + papPulse * 0.58,
    papDiastolicMmHg: meanPap - papPulse * 0.42,
    meanPapMmHg: meanPap,
    pawpMmHg: pawp,
    cardiacOutputLMin: cardiacOutput,
    cardiacIndexLMinM2: cardiacOutput / patient.bodySurfaceAreaM2,
    svo2Percent: clamp(75 - patient.perfusion.oxygenExtractionRatio * 55, 35, 80),
    pulsePressureMaxMmHg: pulsePressure,
    pulsePressureMinMmHg: pulsePressure * 0.88,
  }
}

export function createIcuCirculationCompartments(
  patient: IcuPatientState,
  devices: IcuDeviceStates,
  calibration: IcuPhysiologyCalibration = createIcuPhysiologyCalibration(patient, devices),
): {
  parameters: CirculationParameters
  compartments: CirculationCompartmentState
} {
  const parameters = deriveIcuCirculationParameters(patient, devices, calibration)
  const measurements = deriveIcuBaselineMeasurements(patient, parameters, calibration)
  return {
    parameters,
    compartments: createInitialCirculationCompartments(parameters, measurements),
  }
}

export function aggregateMechanicalSupportEffects(
  effects: readonly IcuTherapyEffect[],
  nativeFlowLMin: number,
): MechanicalSupportEffect {
  const supports = effects
    .filter(
      (effect): effect is Extract<IcuTherapyEffect, { kind: 'mechanical-support' }> =>
        effect.kind === 'mechanical-support',
    )
    .map((effect) => effect.effect)
  if (supports.length > 1) {
    throw new Error('Concurrent ECMO and MCS effects are unsupported in ICU Simulator v1.')
  }
  const support = supports[0]
  if (!support) {
    return {
      transfers: [],
      nativeFlowLMin,
      deviceFlowLMin: 0,
      recirculatingFlowLMin: 0,
      effectiveSystemicFlowLMin: nativeFlowLMin,
    }
  }
  return {
    ...support,
    transfers: [...support.transfers],
    nativeFlowLMin: support.nativeFlowLMin ?? nativeFlowLMin,
    effectiveSystemicFlowLMin: clamp(support.effectiveSystemicFlowLMin, 0.1, 16),
  }
}

export function advanceIcuHemodynamics(
  patient: IcuPatientState,
  devices: IcuDeviceStates,
  compartments: CirculationCompartmentState,
  effects: readonly IcuTherapyEffect[],
  calibration: IcuPhysiologyCalibration,
  startTimeSeconds: number,
  durationSeconds: number,
): {
  patient: IcuPatientState
  parameters: CirculationParameters
  compartments: CirculationCompartmentState
  support: MechanicalSupportEffect
} {
  const parameters = deriveIcuCirculationParameters(patient, devices, calibration)
  const baseline = deriveIcuBaselineMeasurements(patient, parameters, calibration)
  const support = aggregateMechanicalSupportEffects(effects, baseline.cardiacOutputLMin)
  let nextCompartments = compartments
  const fixedSteps = Math.max(0, Math.round(durationSeconds / 0.02))
  for (let index = 0; index < fixedSteps; index += 1) {
    nextCompartments = advanceWindkesselCompartments(
      nextCompartments,
      parameters,
      baseline,
      startTimeSeconds + index * 0.02,
      0.02,
      support,
    )
  }
  const effectiveFlow = support.effectiveSystemicFlowLMin
  const rap = clamp(
    baseline.rapMmHg * 0.98 + nextCompartments.systemicVenousPressureMmHg * 0.02,
    -2,
    40,
  )
  const pawp = clamp(
    (baseline.pawpMmHg ?? 10) * 0.98 + nextCompartments.pulmonaryVenousPressureMmHg * 0.02,
    1,
    50,
  )
  const initial = calibration.initialHemodynamics
  const initialRawMap =
    initial.rapMmHg +
    (initial.nativeCardiacOutputLMin * initial.systemicVascularResistanceDynSecCm5) / 80
  const mapFromFlow =
    initial.mapMmHg +
    rap +
    (effectiveFlow * parameters.systemicVascularResistanceDynSecCm5) / 80 -
    initialRawMap
  const map = clamp(
    mapFromFlow * 0.99 + nextCompartments.systemicArterialPressureMmHg * 0.01,
    15,
    220,
  )
  const pulseScale = clamp(
    effectiveFlow /
      Math.max(30, patient.hemodynamics.heartRateBpm) /
      (initial.nativeCardiacOutputLMin / Math.max(30, initial.heartRateBpm)),
    0.2,
    2.5,
  )
  const systolic = map + (initial.systolicMmHg - initial.mapMmHg) * pulseScale
  const diastolic = map - (initial.mapMmHg - initial.diastolicMmHg) * pulseScale
  const meanPap = clamp(
    pawp + parameters.pulmonaryVascularResistanceWU * Math.max(0.5, baseline.cardiacOutputLMin),
    5,
    100,
  )
  return {
    patient: {
      ...patient,
      hemodynamics: {
        ...patient.hemodynamics,
        mapMmHg: map,
        systolicMmHg: systolic,
        diastolicMmHg: diastolic,
        cardiacOutputLMin: effectiveFlow,
        nativeCardiacOutputLMin: baseline.cardiacOutputLMin,
        effectiveSystemicFlowLMin: effectiveFlow,
        rapMmHg: rap,
        pawpMmHg: pawp,
        meanPapMmHg: meanPap,
        systemicVascularResistanceDynSecCm5: parameters.systemicVascularResistanceDynSecCm5,
        pulmonaryVascularResistanceWU: parameters.pulmonaryVascularResistanceWU,
        leftVentricularContractility: parameters.leftVentricularContractility,
        rightVentricularContractility: parameters.rightVentricularContractility,
        pericardialPressureMmHg: parameters.pericardialPressureMmHg,
      },
    },
    parameters,
    compartments: nextCompartments,
    support,
  }
}

export function advanceIcuSlowPhysiology(
  patient: IcuPatientState,
  devices: IcuDeviceStates,
  effects: readonly IcuTherapyEffect[],
  durationSeconds: number,
): IcuPatientState {
  const seconds = Math.max(0, durationSeconds)
  const hours = seconds / 3_600
  const infectionDecayTimeSeconds = patient.sourceControlCompleted ? 10_800 : 28_800
  const infectionBurden = patient.antimicrobialsAdministered
    ? patient.drivers.infectionBurden * Math.exp(-seconds / infectionDecayTimeSeconds)
    : patient.drivers.infectionBurden
  const bleedingRate = patient.sourceControlCompleted ? 0 : patient.drivers.bleedingRateMlHour
  const bloodLossMl = bleedingRate * hours
  const crrtRemovalRate = effects
    .filter(
      (effect): effect is Extract<IcuTherapyEffect, { kind: 'volume-removal' }> =>
        effect.kind === 'volume-removal',
    )
    .reduce((sum, effect) => sum + effect.rateMlHour, 0)
  const crrtRemovalMl = crrtRemovalRate * hours
  const renalPerfusion = clamp(patient.hemodynamics.mapMmHg / 70, 0, 1.2)
  const urineTarget = 65 * (1 - patient.drivers.acuteKidneyInjurySeverity * 0.92) * renalPerfusion
  const urineOutput = moveTowardExp(patient.renal.urineOutputMlHour, urineTarget, seconds, 1_800)
  const urineMl = urineOutput * hours
  const nextVolume = clamp(
    patient.hemodynamics.circulatingVolumeMl - bloodLossMl - crrtRemovalMl - urineMl,
    1_500,
    8_000,
  )

  const gasEffects = effects.filter(
    (effect): effect is Extract<IcuTherapyEffect, { kind: 'gas-exchange' }> =>
      effect.kind === 'gas-exchange',
  )
  const spontaneousMinuteVentilation = (patient.respiratory.spontaneousRatePerMin * 350) / 1_000
  const ventilatorMinuteVentilation =
    devices.ventilator.status === 'running' ? devices.ventilator.minuteVentilationLMin : 0
  const alveolarMinuteVentilation =
    Math.max(spontaneousMinuteVentilation, ventilatorMinuteVentilation) *
    (1 - patient.respiratory.deadSpaceFraction)
  const extracorporealCo2Removal = gasEffects
    .filter((effect) => effect.source === 'ecmo')
    .reduce((sum, effect) => sum + effect.co2RemovalMlMin, 0)
  const co2Removal = alveolarMinuteVentilation * 28 + extracorporealCo2Removal
  const paCo2Target = clamp(
    (patient.respiratory.co2ProductionMlMin / Math.max(30, co2Removal)) * 40,
    18,
    140,
  )
  const paCO2 = moveTowardExp(patient.respiratory.paCO2MmHg, paCo2Target, seconds, 180)
  const oxygenationCapacity = Math.max(
    0.21 * (1 - patient.respiratory.shuntFraction),
    gasEffects.reduce((sum, effect) => sum + effect.oxygenationCapacity, 0),
  )
  const proneBonus = patient.respiratory.prone ? 24 : 0
  const paO2Target = clamp(
    38 + oxygenationCapacity * 230 - patient.respiratory.shuntFraction * 55 + proneBonus,
    25,
    500,
  )
  const paO2 = moveTowardExp(patient.respiratory.paO2MmHg, paO2Target, seconds, 120)
  const spo2 = clamp(100 / (1 + (26.8 / Math.max(10, paO2)) ** 2.7), 30, 100)

  const clearance = effects
    .filter(
      (effect): effect is Extract<IcuTherapyEffect, { kind: 'solute-clearance' }> =>
        effect.kind === 'solute-clearance',
    )
    .reduce((sum, effect) => sum + effect.clearanceMlMin, 0)
  const aki = patient.drivers.acuteKidneyInjurySeverity
  const creatinineTarget = 0.9 + aki * 4.8 + Math.max(0, 65 - patient.hemodynamics.mapMmHg) * 0.025
  const bunTarget = 16 + aki * 72
  const clearanceFraction = clamp(clearance / 60, 0, 1)
  const creatinine = moveTowardExp(
    patient.renal.creatinineMgDl,
    creatinineTarget * (1 - clearanceFraction * 0.55),
    seconds,
    10_800,
  )
  const bun = moveTowardExp(
    patient.renal.bunMgDl,
    bunTarget * (1 - clearanceFraction * 0.48),
    seconds,
    14_400,
  )
  const potassiumTarget = 4 + aki * 2.2 + Math.max(0, patient.perfusion.lactateMmolL - 4) * 0.08
  const potassium = moveTowardExp(
    patient.renal.potassiumMmolL,
    potassiumTarget - clearanceFraction * 1.2,
    seconds,
    5_400,
  )
  const bicarbonateTarget = clamp(
    24 - aki * 5 - patient.perfusion.lactateMmolL * 0.55 + clearanceFraction * 6,
    6,
    32,
  )
  const bicarbonate = moveTowardExp(
    patient.respiratory.bicarbonateMmolL,
    bicarbonateTarget,
    seconds,
    3_600,
  )
  const pH = clamp(6.1 + Math.log10(bicarbonate / Math.max(0.3, 0.03 * paCO2)), 6.5, 7.8)

  const hemoglobin = clamp(patient.hematology.hemoglobinGdl - bloodLossMl / 1_200, 2, 22)
  const arterialOxygenContent = 1.34 * hemoglobin * (spo2 / 100) + 0.003 * paO2
  const oxygenDelivery = patient.hemodynamics.effectiveSystemicFlowLMin * 10 * arterialOxygenContent
  const extraction = clamp(
    patient.respiratory.oxygenConsumptionMlMin / Math.max(80, oxygenDelivery),
    0.15,
    0.9,
  )
  const hypoperfusion =
    Math.max(0, extraction - 0.42) * 15 + Math.max(0, 60 - patient.hemodynamics.mapMmHg) * 0.06
  const infectionLactate = infectionBurden * 1.2
  const lactateTarget = clamp(1.2 + hypoperfusion + infectionLactate, 0.7, 20)
  const lactate = moveTowardExp(patient.perfusion.lactateMmolL, lactateTarget, seconds, 1_800)

  const temperatureEffects = effects.filter(
    (effect): effect is Extract<IcuTherapyEffect, { kind: 'temperature' }> =>
      effect.kind === 'temperature',
  )
  const targetTemperature = temperatureEffects.length
    ? temperatureEffects.reduce(
        (sum, effect) => sum + effect.targetTemperatureC * effect.strength,
        0,
      ) / temperatureEffects.reduce((sum, effect) => sum + effect.strength, 0)
    : 37 + infectionBurden * 1.2
  const temperature = moveTowardExp(
    patient.perfusion.temperatureC,
    targetTemperature,
    seconds,
    7_200,
  )

  return {
    ...patient,
    drivers: { ...patient.drivers, infectionBurden },
    hemodynamics: {
      ...patient.hemodynamics,
      circulatingVolumeMl: nextVolume,
    },
    respiratory: {
      ...patient.respiratory,
      intubated: devices.ventilator.status === 'running' || patient.respiratory.intubated,
      paO2MmHg: paO2,
      paCO2MmHg: paCO2,
      bicarbonateMmolL: bicarbonate,
      pH,
      spo2Percent: spo2,
      meanAirwayPressureCmH2O:
        devices.ventilator.status === 'running'
          ? devices.ventilator.peepCmH2O +
            Math.max(0, devices.ventilator.plateauPressureCmH2O - devices.ventilator.peepCmH2O) *
              0.36
          : 3,
      plateauPressureCmH2O: devices.ventilator.plateauPressureCmH2O,
      minuteVentilationLMin: Math.max(spontaneousMinuteVentilation, ventilatorMinuteVentilation),
    },
    renal: {
      ...patient.renal,
      creatinineMgDl: creatinine,
      bunMgDl: bun,
      potassiumMmolL: potassium,
      bicarbonateMmolL: bicarbonate,
      urineOutputMlHour: urineOutput,
      cumulativeUrineMl: patient.renal.cumulativeUrineMl + urineMl,
      cumulativeCrrtRemovalMl: patient.renal.cumulativeCrrtRemovalMl + crrtRemovalMl,
    },
    hematology: {
      ...patient.hematology,
      hemoglobinGdl: hemoglobin,
      hematocritPercent: hemoglobin * 3,
      cumulativeBloodLossMl: patient.hematology.cumulativeBloodLossMl + bloodLossMl,
    },
    perfusion: {
      ...patient.perfusion,
      lactateMmolL: lactate,
      temperatureC: temperature,
      oxygenDeliveryMlMin: oxygenDelivery,
      oxygenExtractionRatio: extraction,
      capillaryRefillSeconds: clamp(1.5 + Math.max(0, lactate - 2) * 0.7, 1, 12),
      mottlingScore: clamp((lactate - 1.5) / 1.5, 0, 5),
    },
  }
}

export function reconcileCompartmentVolume(
  compartments: CirculationCompartmentState,
  patient: IcuPatientState,
): CirculationCompartmentState {
  const mismatch = patient.hemodynamics.circulatingVolumeMl - totalCirculatingVolumeMl(compartments)
  return {
    ...compartments,
    systemicVenousVolumeMl: clamp(compartments.systemicVenousVolumeMl + mismatch, 500, 4_200),
  }
}
