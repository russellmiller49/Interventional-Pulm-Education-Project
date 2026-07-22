import { clamp } from './math'
import type {
  IcuCommand,
  IcuPatientState,
  IcuScenarioDefinition,
  IcuSimulationState,
} from './types'

export function actionIdsForIcuCommand(
  command: IcuCommand,
  state: Pick<IcuSimulationState, 'devices' | 'alarms'>,
): readonly string[] {
  if (command.type === 'assessment.order') return [`assessment:${command.assessmentId}`]
  if (command.type === 'diagnosis.commit')
    return ['diagnosis:commit', `diagnosis:${command.classification}`]
  if (command.type === 'therapy.prepare') {
    return [
      `therapy:${command.therapy}:prepare`,
      ...(command.configuration
        ? [`therapy:${command.therapy}:prepare:${command.configuration}`]
        : []),
    ]
  }
  if (command.type === 'therapy.start') {
    const circulatory =
      command.therapy === 'mcs' || (command.therapy === 'ecmo' && state.devices.ecmo.mode === 'va')
    return [
      `therapy:${command.therapy}:start`,
      ...(circulatory ? ['therapy:circulatory-support:start'] : []),
    ]
  }
  if (command.type === 'therapy.stop') return [`therapy:${command.therapy}:stop`]
  if (command.type === 'therapy.adjust') {
    const ids = [`device:${command.therapy}:${command.control}`]
    if (command.therapy === 'ecmo' || command.therapy === 'mcs') {
      ids.push('device:circulatory-support:adjust')
      const unsafe =
        (command.therapy === 'ecmo' && state.devices.ecmo.drainageLimited) ||
        (command.therapy === 'mcs' &&
          state.alarms.some(
            (alarm) =>
              alarm.active &&
              alarm.subsystem === 'mcs' &&
              (alarm.code.includes('suction') || alarm.code.includes('position')),
          ))
      if (unsafe && (command.control === 'rpm' || command.control === 'performance-level'))
        ids.push('device:circulatory-support:adjust:unsafe')
    }
    if (
      command.therapy === 'ventilator' &&
      command.control === 'peep-cmh2o' &&
      typeof command.value === 'number' &&
      command.value > 16
    ) {
      ids.push('device:ventilator:peep-cmh2o:unsafe-high')
    }
    if (
      command.therapy === 'crrt' &&
      command.control === 'patient-fluid-removal-ml-hour' &&
      typeof command.value === 'number' &&
      command.value > 0
    ) {
      ids.push('device:crrt:patient-fluid-removal-ml-hour:active')
    }
    return ids
  }
  if (command.type === 'care.perform') return [`care:${command.interventionId}`]
  if (command.type === 'alarm.acknowledge') return ['alarm:acknowledge']
  if (command.type === 'patient.reassess')
    return command.domains.map((domain) => `reassess:${domain}`)
  if (command.type === 'sandbox.adjust') return [`sandbox:${command.driver}`]
  if (command.type === 'session.complete') return ['session:complete']
  return ['time:advance']
}

const controlsByTherapy: Readonly<Record<string, ReadonlySet<string>>> = {
  ventilator: new Set([
    'mode',
    'tidal-volume-ml',
    'rate-per-min',
    'peep-cmh2o',
    'fio2',
    'inspiratory-pressure-cmh2o',
    'pressure-support-cmh2o',
  ]),
  ecmo: new Set(['mode', 'rpm', 'blood-flow-l-min', 'sweep-l-min', 'gas-fio2']),
  mcs: new Set([
    'assist-ratio',
    'performance-level',
    'inflation-offset-ms',
    'deflation-offset-ms',
    'position',
    'purge-state',
  ]),
  crrt: new Set([
    'blood-flow-ml-min',
    'dialysate-ml-hour',
    'replacement-ml-hour',
    'patient-fluid-removal-ml-hour',
  ]),
}

export function commandPermitted(
  state: IcuSimulationState,
  scenario: IcuScenarioDefinition,
  command: IcuCommand,
): boolean {
  if (state.phase === 'debrief') return command.type === 'alarm.acknowledge'
  if (command.type === 'assessment.order')
    return scenario.capabilities.assessments.includes(command.assessmentId)
  if (command.type === 'diagnosis.commit') return true
  if (command.type === 'sandbox.adjust') {
    if (state.mode !== 'sandbox' || !Number.isFinite(command.value)) return false
    if (command.driver === 'tamponadePressureMmHg') return command.value >= 0 && command.value <= 25
    if (command.driver === 'bleedingRateMlHour') return command.value >= 0 && command.value <= 1_500
    return command.value >= 0 && command.value <= 1
  }
  if (command.type === 'care.perform')
    return scenario.capabilities.interventions.includes(command.interventionId)
  if (
    command.type === 'therapy.prepare' ||
    command.type === 'therapy.start' ||
    command.type === 'therapy.stop' ||
    command.type === 'therapy.adjust'
  ) {
    if (!scenario.capabilities.therapies.includes(command.therapy)) return false
    if (command.type === 'therapy.prepare' && command.therapy === 'ecmo') {
      if (command.configuration !== 'vv' && command.configuration !== 'va') return false
      if (!scenario.capabilities.ecmoModes.includes(command.configuration)) return false
    }
    if (command.type === 'therapy.prepare' && command.therapy === 'mcs') {
      if (
        command.configuration !== 'iabp' &&
        command.configuration !== 'left-impella' &&
        command.configuration !== 'rp-impella'
      )
        return false
      if (!scenario.capabilities.mcsDevices.includes(command.configuration)) return false
    }
    if (command.type === 'therapy.adjust') {
      if (!controlsByTherapy[command.therapy]?.has(command.control)) return false
    }
    if (command.type === 'therapy.start' && command.therapy === 'ecmo') {
      if (state.devices.ecmo.status !== 'ready') return false
      if (state.devices.mcs.status === 'running') return false
      if (!scenario.capabilities.ecmoModes.includes(state.devices.ecmo.mode)) return false
    }
    if (command.type === 'therapy.start' && command.therapy === 'mcs') {
      if (state.devices.mcs.status !== 'ready') return false
      if (state.devices.ecmo.status === 'running') return false
      if (
        state.devices.mcs.device === 'none' ||
        !scenario.capabilities.mcsDevices.includes(state.devices.mcs.device)
      )
        return false
    }
    if (command.type === 'therapy.start' && command.therapy === 'ventilator')
      return state.devices.ventilator.status === 'ready'
    if (command.type === 'therapy.start' && command.therapy === 'crrt')
      return state.devices.crrt.status === 'ready'
  }
  if (command.type === 'time.advance')
    return Number.isSafeInteger(command.seconds) && command.seconds > 0 && command.seconds <= 86_400
  if (command.type === 'patient.reassess')
    return command.domains.length > 0 && new Set(command.domains).size === command.domains.length
  if (command.type === 'alarm.acknowledge')
    return state.alarms.some((alarm) => alarm.id === command.alarmId && alarm.active)
  return true
}

export function applyCareIntervention(
  patient: IcuPatientState,
  interventionId: Extract<IcuCommand, { type: 'care.perform' }>['interventionId'],
): IcuPatientState {
  if (interventionId === 'fluid-bolus') {
    const volume = 500
    const dilution =
      patient.hemodynamics.circulatingVolumeMl / (patient.hemodynamics.circulatingVolumeMl + volume)
    return {
      ...patient,
      hemodynamics: {
        ...patient.hemodynamics,
        circulatingVolumeMl: clamp(patient.hemodynamics.circulatingVolumeMl + volume, 1_500, 8_000),
      },
      hematology: {
        ...patient.hematology,
        hemoglobinGdl: clamp(patient.hematology.hemoglobinGdl * dilution, 2, 22),
        hematocritPercent: clamp(patient.hematology.hematocritPercent * dilution, 5, 70),
        cumulativeCrystalloidMl: patient.hematology.cumulativeCrystalloidMl + volume,
      },
    }
  }
  if (interventionId === 'blood-products') {
    const volume = 350
    return {
      ...patient,
      hemodynamics: {
        ...patient.hemodynamics,
        circulatingVolumeMl: clamp(patient.hemodynamics.circulatingVolumeMl + volume, 1_500, 8_000),
      },
      hematology: {
        ...patient.hematology,
        hemoglobinGdl: clamp(patient.hematology.hemoglobinGdl + 1.1, 2, 22),
        hematocritPercent: clamp(patient.hematology.hematocritPercent + 3.3, 5, 70),
        cumulativeBloodProductMl: patient.hematology.cumulativeBloodProductMl + volume,
      },
    }
  }
  if (interventionId === 'vasopressor-up' || interventionId === 'vasopressor-down') {
    const delta = interventionId === 'vasopressor-up' ? 1 : -1
    return {
      ...patient,
      medications: {
        ...patient.medications,
        vasopressorTier: clamp(patient.medications.vasopressorTier + delta, 0, 3) as 0 | 1 | 2 | 3,
      },
    }
  }
  if (interventionId === 'inotrope-up' || interventionId === 'inotrope-down') {
    const delta = interventionId === 'inotrope-up' ? 1 : -1
    return {
      ...patient,
      medications: {
        ...patient.medications,
        inotropeTier: clamp(patient.medications.inotropeTier + delta, 0, 3) as 0 | 1 | 2 | 3,
      },
    }
  }
  if (interventionId === 'sedation-up' || interventionId === 'sedation-down') {
    const delta = interventionId === 'sedation-up' ? 1 : -1
    return {
      ...patient,
      medications: {
        ...patient.medications,
        sedationTier: clamp(patient.medications.sedationTier + delta, 0, 3) as 0 | 1 | 2 | 3,
      },
    }
  }
  if (interventionId === 'prone' || interventionId === 'supine')
    return {
      ...patient,
      respiratory: { ...patient.respiratory, prone: interventionId === 'prone' },
    }
  if (interventionId === 'antimicrobials') return { ...patient, antimicrobialsAdministered: true }
  if (interventionId === 'source-control')
    return {
      ...patient,
      sourceControlCompleted: true,
      drivers: {
        ...patient.drivers,
        bleedingRateMlHour: 0,
        infectionBurden: patient.drivers.infectionBurden * 0.35,
      },
    }
  if (interventionId === 'reperfusion')
    return {
      ...patient,
      reperfusionCompleted: true,
      drivers: {
        ...patient.drivers,
        pulmonaryVascularObstructionSeverity:
          patient.drivers.pulmonaryVascularObstructionSeverity * 0.22,
      },
    }
  if (interventionId === 'tamponade-drainage')
    return {
      ...patient,
      tamponadeDrained: true,
      drivers: { ...patient.drivers, tamponadePressureMmHg: 0 },
    }
  return patient
}
