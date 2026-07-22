import {
  advanceWindkesselCompartments,
  createInitialCirculationCompartments,
  totalCirculatingVolumeMl,
  type CirculationCompartmentState,
  type CirculationParameters,
  type HemodynamicMeasurements,
  type MechanicalSupportEffect,
} from '@/features/hemodynamics-core'

import { clamp, moveTowardExp, roundTo } from './math'
import type { IcuDeviceStates, IcuPatientState, IcuTherapyEffect } from './types'

const REFERENCE_CIRCULATING_VOLUME_ML = 4_360

function activePeep(devices: IcuDeviceStates): number {
  return devices.ventilator.status === 'running' ? devices.ventilator.peepCmH2O : 3
}

export function deriveIcuCirculationParameters(
  patient: IcuPatientState,
  devices: IcuDeviceStates,
): CirculationParameters {
  const drivers = patient.drivers
  const medications = patient.medications
  const leftContractility = clamp(
    1 - drivers.leftVentricularFailureSeverity * 0.78 + medications.inotropeTier * 0.14,
    0.18,
    1.55,
  )
  const rightContractility = clamp(
    1 - drivers.rightVentricularFailureSeverity * 0.74 + medications.inotropeTier * 0.1,
    0.18,
    1.5,
  )
  const svr = clamp(
    1_450 - drivers.vasoplegiaSeverity * 1_050 + medications.vasopressorTier * 260,
    320,
    2_600,
  )
  const pvr = clamp(
    1.7 + drivers.pulmonaryVascularObstructionSeverity * 10 + drivers.lungInjurySeverity * 1.8,
    0.7,
    16,
  )
  const peep = activePeep(devices)
  const circulatingVolumeFraction = clamp(
    patient.hemodynamics.circulatingVolumeMl / REFERENCE_CIRCULATING_VOLUME_ML,
    0.4,
    1.55,
  )
  const preloadFactor = clamp((circulatingVolumeFraction - 0.35) / 0.65, 0.12, 1.35)
  const peepFactor = clamp(1 - Math.max(0, peep - 5) * 0.025, 0.5, 1.05)
  const tamponadeFactor = clamp(
    1 - (patient.tamponadeDrained ? 0 : drivers.tamponadePressureMmHg) * 0.035,
    0.25,
    1,
  )
  const rvDelivery = clamp(
    (rightContractility * preloadFactor * peepFactor) / (0.8 + pvr * 0.08),
    0.12,
    1.2,
  )
  const strokeVolumeMl =
    76 *
    preloadFactor ** 0.42 *
    leftContractility ** 0.78 *
    rvDelivery ** 0.52 *
    clamp(1_200 / svr, 0.55, 1.45) ** 0.28 *
    tamponadeFactor
  const nativeCardiacOutput = clamp(
    (strokeVolumeMl * patient.hemodynamics.heartRateBpm) / 1_000,
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
): HemodynamicMeasurements {
  const volumeFraction = parameters.circulatingVolumeFraction
  const peepPressure = parameters.peepCmH2O * 0.14
  const tamponade = parameters.pericardialPressureMmHg
  const rap = clamp(
    5 +
      (volumeFraction - 1) * 13 +
      (1 - parameters.rightVentricularContractility) * 15 +
      parameters.pulmonaryVascularResistanceWU * 0.5 +
      peepPressure +
      tamponade * 0.65,
    -2,
    38,
  )
  const pawp = clamp(
    8 +
      (volumeFraction - 1) * 15 +
      (1 - parameters.leftVentricularContractility) * 22 +
      peepPressure +
      tamponade * 0.55,
    1,
    45,
  )
  const cardiacOutput = parameters.referenceCardiacOutputLMin
  const meanPap = clamp(pawp + parameters.pulmonaryVascularResistanceWU * cardiacOutput, 5, 90)
  const map = clamp(
    rap + (cardiacOutput * parameters.systemicVascularResistanceDynSecCm5) / 80,
    20,
    180,
  )
  const pulsePressure = clamp(
    (cardiacOutput * 1_000) / Math.max(30, parameters.heartRateBpm) / 1.5,
    5,
    80,
  )
  const papPulse = clamp(6 + parameters.rightVentricularContractility * 13, 4, 25)
  return {
    heartRateBpm: parameters.heartRateBpm,
    spo2Percent: patient.respiratory.spo2Percent,
    artSystolicMmHg: map + pulsePressure * 0.62,
    artDiastolicMmHg: map - pulsePressure * 0.38,
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
): {
  parameters: CirculationParameters
  compartments: CirculationCompartmentState
} {
  const parameters = deriveIcuCirculationParameters(patient, devices)
  const measurements = deriveIcuBaselineMeasurements(patient, parameters)
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
  startTimeSeconds: number,
  durationSeconds: number,
): {
  patient: IcuPatientState
  parameters: CirculationParameters
  compartments: CirculationCompartmentState
  support: MechanicalSupportEffect
} {
  const parameters = deriveIcuCirculationParameters(patient, devices)
  const baseline = deriveIcuBaselineMeasurements(patient, parameters)
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
    baseline.rapMmHg * 0.72 + nextCompartments.systemicVenousPressureMmHg * 0.28,
    -2,
    40,
  )
  const pawp = clamp(
    (baseline.pawpMmHg ?? 10) * 0.72 + nextCompartments.pulmonaryVenousPressureMmHg * 0.28,
    1,
    50,
  )
  const mapFromFlow = rap + (effectiveFlow * parameters.systemicVascularResistanceDynSecCm5) / 80
  const map = clamp(
    mapFromFlow * 0.76 + nextCompartments.systemicArterialPressureMmHg * 0.24,
    15,
    220,
  )
  const pulsePressure = clamp(
    (effectiveFlow * 1_000) / Math.max(30, patient.hemodynamics.heartRateBpm) / 1.55,
    4,
    85,
  )
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
        mapMmHg: roundTo(map, 1),
        systolicMmHg: roundTo(map + pulsePressure * 0.62, 1),
        diastolicMmHg: roundTo(map - pulsePressure * 0.38, 1),
        cardiacOutputLMin: roundTo(effectiveFlow, 2),
        nativeCardiacOutputLMin: roundTo(baseline.cardiacOutputLMin, 2),
        effectiveSystemicFlowLMin: roundTo(effectiveFlow, 2),
        rapMmHg: roundTo(rap, 1),
        pawpMmHg: roundTo(pawp, 1),
        meanPapMmHg: roundTo(meanPap, 1),
        systemicVascularResistanceDynSecCm5: roundTo(
          parameters.systemicVascularResistanceDynSecCm5,
          0,
        ),
        pulmonaryVascularResistanceWU: roundTo(parameters.pulmonaryVascularResistanceWU, 2),
        leftVentricularContractility: roundTo(parameters.leftVentricularContractility, 3),
        rightVentricularContractility: roundTo(parameters.rightVentricularContractility, 3),
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
    drivers: { ...patient.drivers, infectionBurden: roundTo(infectionBurden, 6) },
    hemodynamics: {
      ...patient.hemodynamics,
      circulatingVolumeMl: roundTo(nextVolume, 1),
    },
    respiratory: {
      ...patient.respiratory,
      intubated: devices.ventilator.status === 'running' || patient.respiratory.intubated,
      paO2MmHg: roundTo(paO2, 1),
      paCO2MmHg: roundTo(paCO2, 1),
      bicarbonateMmolL: roundTo(bicarbonate, 1),
      pH: roundTo(pH, 3),
      spo2Percent: roundTo(spo2, 1),
      meanAirwayPressureCmH2O:
        devices.ventilator.status === 'running'
          ? roundTo(
              devices.ventilator.peepCmH2O +
                Math.max(
                  0,
                  devices.ventilator.plateauPressureCmH2O - devices.ventilator.peepCmH2O,
                ) *
                  0.36,
              1,
            )
          : 3,
      plateauPressureCmH2O: devices.ventilator.plateauPressureCmH2O,
      minuteVentilationLMin: roundTo(
        Math.max(spontaneousMinuteVentilation, ventilatorMinuteVentilation),
        1,
      ),
    },
    renal: {
      ...patient.renal,
      creatinineMgDl: roundTo(creatinine, 2),
      bunMgDl: roundTo(bun, 1),
      potassiumMmolL: roundTo(potassium, 2),
      bicarbonateMmolL: roundTo(bicarbonate, 1),
      urineOutputMlHour: roundTo(urineOutput, 1),
      cumulativeUrineMl: roundTo(patient.renal.cumulativeUrineMl + urineMl, 1),
      cumulativeCrrtRemovalMl: roundTo(patient.renal.cumulativeCrrtRemovalMl + crrtRemovalMl, 1),
    },
    hematology: {
      ...patient.hematology,
      hemoglobinGdl: roundTo(hemoglobin, 2),
      hematocritPercent: roundTo(hemoglobin * 3, 1),
      cumulativeBloodLossMl: roundTo(patient.hematology.cumulativeBloodLossMl + bloodLossMl, 1),
    },
    perfusion: {
      ...patient.perfusion,
      lactateMmolL: roundTo(lactate, 2),
      temperatureC: roundTo(temperature, 2),
      oxygenDeliveryMlMin: roundTo(oxygenDelivery, 0),
      oxygenExtractionRatio: roundTo(extraction, 3),
      capillaryRefillSeconds: roundTo(clamp(1.5 + Math.max(0, lactate - 2) * 0.7, 1, 12), 1),
      mottlingScore: roundTo(clamp((lactate - 1.5) / 1.5, 0, 5), 0),
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
