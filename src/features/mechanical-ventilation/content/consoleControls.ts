import {
  isAdaptivePressureMode,
  isAdaptiveSupportMode,
  isSimvMode,
  isTwoLevelMode,
} from '../engine/modes'
import type {
  MechanicalVentilationSettings,
  VentilatorControlKey,
  VentilatorDeviceId,
} from '../engine/types'
import {
  adaptControlDescriptor,
  canonicalToNativeControlValue,
  getVentilatorDeviceProfile,
} from './deviceProfiles'
import { orderControlsForDevice } from './deviceDisplay'

/**
 * The numeric settings a console shows on its Controls screen, for the mode it is in, in that
 * vendor's labels, units, order and native values.
 *
 * Built here rather than inside the console component so the Learn stage's guided task can name the
 * same control the learner will find: "Set V̇SENS to 1.5 L/min" is read off the tile the PB980 draws,
 * not typed a second time.
 */
export interface ConsoleNumericControl {
  key: VentilatorControlKey
  label: string
  value: number
  unit: string
  minimum: number
  maximum: number
  step: number
  rangeNote?: string
}

export function buildConsoleNumericControls(
  deviceId: VentilatorDeviceId,
  settings: MechanicalVentilationSettings,
): ConsoleNumericControl[] {
  const simvActive = isSimvMode(settings.deviceMode)
  const adaptivePressureActive = isAdaptivePressureMode(settings.deviceMode)
  const twoLevelActive = isTwoLevelMode(settings.deviceMode)
  const adaptiveSupportActive = isAdaptiveSupportMode(settings.deviceMode)
  const controls: ConsoleNumericControl[] = [
    {
      key: 'oxygenPercent',
      label: 'Oxygen',
      value: settings.oxygenPercent,
      unit: '%',
      minimum: 21,
      maximum: 100,
      step: 1,
    },
    {
      key: 'peepCmH2O',
      label: 'PEEP/CPAP',
      value: settings.peepCmH2O,
      unit: 'cmH₂O',
      minimum: 0,
      maximum: 30,
      step: 1,
    },
    {
      key: 'triggerThreshold',
      label: settings.trigger.type === 'flow' ? 'Flow trigger' : 'Pressure trigger',
      value:
        settings.trigger.type === 'flow'
          ? settings.trigger.thresholdLMin
          : settings.trigger.thresholdCmH2O,
      unit: settings.trigger.type === 'flow' ? 'L/min' : 'cmH₂O',
      minimum:
        settings.trigger.type === 'flow' ? (settings.mode === 'pressure-support' ? 0.5 : 1) : -15,
      maximum: settings.trigger.type === 'flow' ? 10 : -0.1,
      step: settings.trigger.type === 'flow' ? 0.5 : 0.5,
    },
    {
      key: 'highPressureLimitCmH2O',
      label: 'High pressure',
      value: settings.highPressureLimitCmH2O,
      unit: 'cmH₂O',
      minimum: 10,
      maximum: 80,
      step: 1,
    },
  ]
  if (settings.mode === 'volume-ac') {
    controls.splice(
      0,
      0,
      {
        key: 'vtMl',
        label: 'Vt',
        value: settings.vtMl,
        unit: 'mL',
        minimum: 100,
        maximum: 1000,
        step: 10,
      },
      {
        key: 'ratePerMin',
        label: 'Rate',
        value: settings.ratePerMin,
        unit: '/min',
        minimum: 4,
        maximum: 40,
        step: 1,
      },
    )
    if (!settings.advanced.autoFlowEnabled) {
      controls.splice(
        2,
        0,
        {
          key: 'peakFlowLMin',
          label: 'Peak flow',
          value: settings.peakFlowLMin,
          unit: 'L/min',
          minimum: 10,
          maximum: 150,
          step: 5,
        },
        {
          key: 'pausePercent',
          label: 'Tip pause',
          value: settings.pausePercent,
          unit: '%',
          minimum: 0,
          maximum: 50,
          step: 5,
        },
      )
    }
  }
  if (
    settings.mode === 'pressure-ac' &&
    !twoLevelActive &&
    !adaptiveSupportActive &&
    !adaptivePressureActive
  ) {
    controls.splice(
      0,
      0,
      {
        key: 'deltaPControlCmH2O',
        label: 'Pcontrol',
        value: settings.deltaPControlCmH2O,
        unit: 'cmH₂O',
        minimum: 5,
        maximum: 45,
        step: 1,
      },
      {
        key: 'ratePerMin',
        label: 'Rate',
        value: settings.ratePerMin,
        unit: '/min',
        minimum: 4,
        maximum: 40,
        step: 1,
      },
      {
        key: 'inspiratoryTimeSeconds',
        label: 'TI',
        value: settings.inspiratoryTimeSeconds,
        unit: 's',
        minimum: 0.2,
        maximum: 3,
        step: 0.1,
      },
      {
        key: 'pRampMs',
        label: 'P-ramp',
        value: settings.pRampMs,
        unit: 'ms',
        minimum: 0,
        maximum: Math.min(1000, Math.floor((settings.inspiratoryTimeSeconds * 1000) / 3)),
        step: 10,
      },
    )
  }
  if (adaptivePressureActive && settings.mode === 'pressure-ac') {
    controls.unshift(
      {
        key: 'ratePerMin',
        label: 'Rate',
        value: settings.ratePerMin,
        unit: '/min',
        minimum: 4,
        maximum: 40,
        step: 1,
      },
      {
        key: 'inspiratoryTimeSeconds',
        label: 'TI',
        value: settings.inspiratoryTimeSeconds,
        unit: 's',
        minimum: 0.2,
        maximum: 3,
        step: 0.1,
      },
      {
        key: 'pRampMs',
        label: 'P-ramp',
        value: settings.pRampMs,
        unit: 'ms',
        minimum: 0,
        maximum: Math.min(1000, Math.floor((settings.inspiratoryTimeSeconds * 1000) / 3)),
        step: 10,
      },
    )
  }
  if (
    settings.mode === 'pressure-support' &&
    settings.deviceMode !== 'proportional-assist' &&
    settings.deviceMode !== 'volume-support'
  ) {
    controls.splice(
      0,
      0,
      {
        key: 'pressureSupportCmH2O',
        label: 'Psupport',
        value: settings.pressureSupportCmH2O,
        unit: 'cmH₂O',
        minimum: 0,
        maximum: 30,
        step: 1,
      },
      {
        key: 'pRampMs',
        label: 'P-ramp',
        value: settings.pRampMs,
        unit: 'ms',
        minimum: 0,
        maximum: 200,
        step: 10,
      },
      {
        key: 'etsPercent',
        label: 'ETS',
        value: settings.etsPercent,
        unit: '%',
        minimum: 5,
        maximum: 80,
        step: 5,
      },
      {
        key: 'tiMaxSeconds',
        label: 'TI max',
        value: settings.tiMaxSeconds,
        unit: 's',
        minimum: 0.5,
        maximum: 3,
        step: 0.1,
      },
      {
        key: 'apneaRatePerMin',
        label: 'Apnea rate',
        value: settings.apneaRatePerMin,
        unit: '/min',
        minimum: 5,
        maximum: 30,
        step: 1,
      },
    )
  }
  if (adaptivePressureActive || settings.deviceMode === 'volume-support') {
    controls.unshift({
      key: 'targetVtMl',
      label: 'Target Vt',
      value: settings.advanced.targetVtMl,
      unit: 'mL',
      minimum: 100,
      maximum: 1000,
      step: 10,
    })
  }
  if (simvActive) {
    controls.push(
      {
        key: 'spontaneousPressureSupportCmH2O',
        label: 'Spontaneous PS',
        value: settings.advanced.spontaneousPressureSupportCmH2O,
        unit: 'cmH₂O',
        minimum: 0,
        maximum: 30,
        step: 1,
      },
      {
        key: 'spontaneousRampMs',
        label: 'Spontaneous rise',
        value: settings.advanced.spontaneousRampMs,
        unit: 'ms',
        minimum: 0,
        maximum: 2000,
        step: 10,
      },
      {
        key: 'spontaneousCyclePercent',
        label: 'Spontaneous cycle',
        value: settings.advanced.spontaneousCyclePercent,
        unit: '%',
        minimum: 5,
        maximum: 80,
        step: 5,
      },
    )
  }
  if (twoLevelActive) {
    controls.unshift(
      {
        key: 'pHighCmH2O',
        label: 'P high',
        value: settings.advanced.pHighCmH2O,
        unit: 'cmH₂O',
        minimum: 5,
        maximum: 50,
        step: 1,
      },
      {
        key: 'pLowCmH2O',
        label: 'P low',
        value: settings.advanced.pLowCmH2O,
        unit: 'cmH₂O',
        minimum: 0,
        maximum: 20,
        step: 1,
      },
      {
        key: 'tHighSeconds',
        label: 'T high',
        value: settings.advanced.tHighSeconds,
        unit: 's',
        minimum: 0.2,
        maximum: 15,
        step: 0.1,
      },
      {
        key: 'tLowSeconds',
        label: 'T low',
        value: settings.advanced.tLowSeconds,
        unit: 's',
        minimum: 0.1,
        maximum: 3,
        step: 0.1,
      },
      {
        key: 'spontaneousPressureSupportCmH2O',
        label: 'Spontaneous PS',
        value: settings.advanced.spontaneousPressureSupportCmH2O,
        unit: 'cmH₂O',
        minimum: 0,
        maximum: 30,
        step: 1,
      },
    )
  }
  if (settings.deviceMode === 'proportional-assist') {
    controls.unshift({
      key: 'proportionalSupportPercent',
      label: 'Proportional support',
      value: settings.advanced.proportionalSupportPercent,
      unit: '%',
      minimum: 5,
      maximum: 95,
      step: 5,
    })
  }
  if (adaptiveSupportActive) {
    controls.unshift({
      key: 'minuteVolumePercent',
      label: '%MinVol',
      value: settings.advanced.minuteVolumePercent,
      unit: '%',
      minimum: 25,
      maximum: 350,
      step: 5,
    })
  }
  if (settings.deviceMode === 'intellivent-asv') {
    controls.unshift(
      {
        key: 'targetSpO2LowPercent',
        label: 'Target SpO₂ low',
        value: settings.advanced.targetSpO2LowPercent,
        unit: '%',
        minimum: 85,
        maximum: 98,
        step: 1,
      },
      {
        key: 'targetPetCO2MmHg',
        label: 'Target PetCO₂',
        value: settings.advanced.targetPetCO2MmHg,
        unit: 'mm Hg',
        minimum: 25,
        maximum: 80,
        step: 1,
      },
    )
  }
  const adapted = controls.map((control) => {
    const descriptor = adaptControlDescriptor(deviceId, settings, control)
    const triggerLabel =
      control.key === 'triggerThreshold' && settings.trigger.type === 'pressure'
        ? 'Pressure trigger'
        : descriptor.label
    return {
      ...control,
      ...descriptor,
      label: triggerLabel,
      value: canonicalToNativeControlValue(deviceId, settings, control.key, control.value),
    }
  })
  // Each vendor presents the same settings in its own order — the Evita's therapy bar, the
  // AVEA's primary-control row, the C6's three purpose groups.
  return orderControlsForDevice(getVentilatorDeviceProfile(deviceId).display, adapted)
}
