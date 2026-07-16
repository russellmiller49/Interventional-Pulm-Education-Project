import {
  adaptControlDescriptor,
  adaptInitialSettingsForDevice,
  canonicalToNativeControlValue,
  createDefaultMechanicalVentilationSettings,
  getVentilatorDeviceProfile,
  getVentilatorModeLabel,
  nativeToCanonicalControlValue,
  ventilatorDeviceProfiles,
  ventilatorDeviceSources,
} from '../content'
import {
  updateVentilatorControl,
  ventilatorDeviceIds,
  type VentilatorControlDescriptor,
} from '../engine'

const riseDescriptor: VentilatorControlDescriptor = {
  key: 'pRampMs',
  label: 'Rise',
  unit: 'ms',
  minimum: 0,
  maximum: 2000,
  step: 10,
}

describe('ventilator device profiles', () => {
  it('defines one complete, source-backed profile for every supported device', () => {
    expect(ventilatorDeviceProfiles.map((profile) => profile.id)).toEqual(ventilatorDeviceIds)
    const sourceIds = new Set(ventilatorDeviceSources.map((source) => source.id))
    for (const profile of ventilatorDeviceProfiles) {
      expect(profile.displayName).not.toHaveLength(0)
      expect(profile.orientationSteps.length).toBeGreaterThanOrEqual(4)
      expect(profile.deferredModes.length).toBeGreaterThan(0)
      expect(profile.sourceIds.length).toBeGreaterThan(0)
      expect(profile.sourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true)
      expect(profile.modes.length).toBeGreaterThanOrEqual(7)
      expect(new Set(profile.modes.map((mode) => mode.id)).size).toBe(profile.modes.length)
      expect(profile.modes.slice(0, 3).map((mode) => mode.id)).toEqual([
        'volume-ac',
        'pressure-ac',
        'pressure-support',
      ])
      for (const mode of profile.modes) {
        expect(mode.label).not.toHaveLength(0)
        expect(mode.description.length).toBeGreaterThan(20)
      }
    }
    for (const source of ventilatorDeviceSources) {
      expect(source.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
      expect(source.intendedUse.length).toBeGreaterThan(20)
      expect(source.limitations.length).toBeGreaterThan(20)
    }
  })

  it('uses the required device-native vocabulary for the three shared modes', () => {
    expect(
      ventilatorDeviceProfiles.map((profile) => [
        getVentilatorModeLabel(profile.id, 'volume-ac'),
        getVentilatorModeLabel(profile.id, 'pressure-ac'),
        getVentilatorModeLabel(profile.id, 'pressure-support'),
      ]),
    ).toEqual([
      ['(S)CMV', 'PCV+', 'SPONT'],
      ['VC-AC', 'PC-AC', 'SPN-CPAP/PS'],
      ['A/C + VC', 'A/C + PC', 'SPONT + PS'],
      ['Volume A/C', 'Pressure A/C', 'CPAP/PSV'],
    ])
  })

  it('maps each requested advanced mode to the device that actually exposes it', () => {
    expect(getVentilatorDeviceProfile('hamilton-c6').modes.map((mode) => mode.label)).toEqual(
      expect.arrayContaining([
        'SIMV',
        'PSIMV+',
        'APVcmv',
        'APVsimv / SIMV+',
        'DuoPAP',
        'APRV',
        'ASV',
        'INTELLiVENT-ASV',
      ]),
    )
    expect(
      getVentilatorDeviceProfile('drager-evita-v800-v600').modes.map((mode) => mode.label),
    ).toEqual(expect.arrayContaining(['VC-SIMV', 'PC-SIMV', 'PC-APRV', 'SPN-CPAP/VS']))
    expect(
      getVentilatorDeviceProfile('puritan-bennett-980').modes.map((mode) => mode.label),
    ).toEqual(
      expect.arrayContaining([
        'SIMV + VC',
        'SIMV + PC',
        'A/C + VC+',
        'SIMV + VC+',
        'BiLevel',
        'SPONT + PAV+',
        'SPONT + VS',
      ]),
    )
    expect(getVentilatorDeviceProfile('carefusion-avea').modes.map((mode) => mode.label)).toEqual(
      expect.arrayContaining([
        'Volume SIMV',
        'Pressure SIMV',
        'PRVC A/C',
        'PRVC SIMV',
        'APRV/BiPhasic',
        'TCPL A/C',
        'TCPL SIMV',
      ]),
    )
  })

  it('keeps neonatal-only TCPL and Volume Guarantee source-listed but locked', () => {
    const avea = getVentilatorDeviceProfile('carefusion-avea')
    expect(
      avea.modes.filter((mode) => mode.id.startsWith('tcpl')).map((mode) => mode.availability),
    ).toEqual(['requires-neonatal', 'requires-neonatal'])
    expect(avea.features.find((feature) => feature.id === 'volume-guarantee')).toMatchObject({
      availability: 'requires-neonatal',
    })
    expect(
      getVentilatorDeviceProfile('drager-evita-v800-v600').features.find(
        (feature) => feature.id === 'volume-guarantee',
      ),
    ).toMatchObject({ availability: 'requires-neonatal' })
  })

  it('converts Evita absolute Pinsp and seconds back to canonical driving pressure and milliseconds', () => {
    const pressure = {
      ...createDefaultMechanicalVentilationSettings('pressure-ac'),
      peepCmH2O: 8,
      deltaPControlCmH2O: 15,
    }
    expect(
      canonicalToNativeControlValue('drager-evita-v800-v600', pressure, 'deltaPControlCmH2O', 15),
    ).toBe(23)
    expect(
      nativeToCanonicalControlValue('drager-evita-v800-v600', pressure, 'deltaPControlCmH2O', 23),
    ).toBe(15)
    expect(canonicalToNativeControlValue('drager-evita-v800-v600', pressure, 'pRampMs', 120)).toBe(
      0.12,
    )
    expect(nativeToCanonicalControlValue('drager-evita-v800-v600', pressure, 'pRampMs', 0.12)).toBe(
      120,
    )
  })

  it('maps PB980 and AVEA rise controls in their documented direction and clamps native input', () => {
    const support = createDefaultMechanicalVentilationSettings('pressure-support')
    expect(canonicalToNativeControlValue('puritan-bennett-980', support, 'pRampMs', 0)).toBe(100)
    expect(canonicalToNativeControlValue('puritan-bennett-980', support, 'pRampMs', 2000)).toBe(1)
    expect(nativeToCanonicalControlValue('puritan-bennett-980', support, 'pRampMs', 101)).toBe(0)
    expect(canonicalToNativeControlValue('carefusion-avea', support, 'pRampMs', 0)).toBe(1)
    expect(canonicalToNativeControlValue('carefusion-avea', support, 'pRampMs', 2000)).toBe(9)
    expect(nativeToCanonicalControlValue('carefusion-avea', support, 'pRampMs', 99)).toBe(2000)
    expect(
      canonicalToNativeControlValue('puritan-bennett-980', support, 'spontaneousRampMs', 0),
    ).toBe(100)
    expect(
      canonicalToNativeControlValue('carefusion-avea', support, 'spontaneousRampMs', 2000),
    ).toBe(9)
  })

  it('keeps C6 as the regression cap and explicitly labels undocumented AVEA simulator ranges', () => {
    const support = {
      ...createDefaultMechanicalVentilationSettings('pressure-support'),
      pRampMs: 600,
    }
    const c6 = adaptInitialSettingsForDevice(support, 'hamilton-c6')
    const pb980 = adaptInitialSettingsForDevice(support, 'puritan-bennett-980')
    expect(c6.mode).toBe('pressure-support')
    expect(pb980.mode).toBe('pressure-support')
    if (c6.mode === 'pressure-support' && pb980.mode === 'pressure-support') {
      expect(c6.pRampMs).toBe(200)
      expect(pb980.pRampMs).toBe(600)
    }
    const aveaDescriptor = adaptControlDescriptor('carefusion-avea', support, {
      ...riseDescriptor,
      key: 'peepCmH2O',
      label: 'PEEP',
      unit: 'cmH₂O',
      minimum: 0,
      maximum: 30,
      step: 1,
    })
    expect(aveaDescriptor.rangeNote).toMatch(/Simulator range/i)
  })

  it('ignores controls unsupported by the active canonical mode', () => {
    const volume = createDefaultMechanicalVentilationSettings('volume-ac')
    const support = createDefaultMechanicalVentilationSettings('pressure-support')
    for (const deviceId of ventilatorDeviceIds) {
      expect(updateVentilatorControl(volume, 'pressureSupportCmH2O', 25, deviceId)).toBe(volume)
      expect(updateVentilatorControl(support, 'vtMl', 900, deviceId)).toBe(support)
    }
  })
})
