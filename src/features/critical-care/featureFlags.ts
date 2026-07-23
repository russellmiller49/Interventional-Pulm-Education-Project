export const criticalCareFeatureFlagNames = [
  'criticalCareDashboardV2',
  'hemodynamicsGuidedV2',
  'ventilationLearnV2',
  'mcsChromeV2',
  'ecmoChromeV2',
  'crrtChromeV2',
  'icuChromeV2',
] as const

export type CriticalCareFeatureFlagName = (typeof criticalCareFeatureFlagNames)[number]

export type CriticalCareFeatureFlags = Readonly<Record<CriticalCareFeatureFlagName, boolean>>

const defaults: CriticalCareFeatureFlags = {
  criticalCareDashboardV2: true,
  hemodynamicsGuidedV2: true,
  ventilationLearnV2: false,
  mcsChromeV2: false,
  ecmoChromeV2: false,
  crrtChromeV2: false,
  icuChromeV2: false,
}

const environmentKeys: Readonly<Record<CriticalCareFeatureFlagName, string>> = {
  criticalCareDashboardV2: 'CRITICAL_CARE_DASHBOARD_V2',
  hemodynamicsGuidedV2: 'HEMODYNAMICS_GUIDED_V2',
  ventilationLearnV2: 'VENTILATION_LEARN_V2',
  mcsChromeV2: 'MCS_CHROME_V2',
  ecmoChromeV2: 'ECMO_CHROME_V2',
  crrtChromeV2: 'CRRT_CHROME_V2',
  icuChromeV2: 'ICU_CHROME_V2',
}

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
  return fallback
}

export function resolveCriticalCareFeatureFlags(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): CriticalCareFeatureFlags {
  return Object.freeze(
    Object.fromEntries(
      criticalCareFeatureFlagNames.map((name) => [
        name,
        parseFlag(environment[environmentKeys[name]], defaults[name]),
      ]),
    ) as Record<CriticalCareFeatureFlagName, boolean>,
  )
}

export const criticalCareFeatureFlags = resolveCriticalCareFeatureFlags()
