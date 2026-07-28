import { readFileSync } from 'node:fs'
import path from 'node:path'

import { SHARED_CRITICAL_CARE_THRESHOLDS } from '../content/sharedClinicalThresholds'

const engineFiles = [
  'src/features/icu-hemodynamics/engine/simulation.ts',
  'src/features/mechanical-ventilation/engine/simulation.ts',
  'src/features/icu-simulation/engine/simulation.ts',
] as const

describe('shared critical-care clinical thresholds', () => {
  it('keeps repeated MAP and oxygen-saturation alarm boundaries in one registry', () => {
    expect(SHARED_CRITICAL_CARE_THRESHOLDS.meanArterialPressure).toMatchObject({
      lowMmHg: 65,
      criticalLowMmHg: 55,
    })
    expect(SHARED_CRITICAL_CARE_THRESHOLDS.oxygenSaturation).toMatchObject({
      lowPercent: 90,
      criticalLowPercent: 85,
    })
    expect(SHARED_CRITICAL_CARE_THRESHOLDS.cardiacPowerOutput).toMatchObject({
      highRiskTeachingWatts: 0.6,
      originalCohortWatts: 0.53,
    })
    expect(SHARED_CRITICAL_CARE_THRESHOLDS.pulmonaryArteryPulsatilityIndex).toMatchObject({
      acuteRvInfarctionHighRiskMax: 0.9,
      advancedHeartFailureTeachingMax: 1.85,
    })

    const engineSource = engineFiles
      .map((file) => readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n')
    const oxygenAlarmSource = engineFiles
      .filter((file) => !file.includes('icu-hemodynamics'))
      .map((file) => readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n')

    expect(engineSource).not.toMatch(/mapMmHg\s*<\s*(?:55|65)\b/)
    expect(oxygenAlarmSource).not.toMatch(/spo2Percent\s*<\s*(?:85|90)\b/i)
  })

  it('keeps cross-module PAPi and CPO cohort boundaries out of module-local registries', () => {
    const hemodynamicsThresholdSource = readFileSync(
      path.join(process.cwd(), 'src/features/icu-hemodynamics/content/clinicalThresholds.ts'),
      'utf8',
    )
    const mcsWorkbenchSource = readFileSync(
      path.join(
        process.cwd(),
        'src/features/mechanical-circulatory-support/components/McsWorkbench.tsx',
      ),
      'utf8',
    )

    expect(hemodynamicsThresholdSource).not.toMatch(
      /\b(?:cardiacPowerOutput|pulmonaryArteryPulsatilityIndex)\s*:/,
    )
    expect(mcsWorkbenchSource).not.toMatch(/metrics\.papi\s*<\s*1\.5\b/)
  })
})
