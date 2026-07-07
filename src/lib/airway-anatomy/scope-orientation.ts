import type { ScopePoseSnapshot } from './types'

export const SCOPE_ORIENTATION_CALIBRATION_SCHEMA = 'airway_anatomy_scope_orientation/v1'
export const SCOPE_ORIENTATION_PROFILE_IDS = ['flexible', 'robotic'] as const
export const DEFAULT_SCOPE_ORIENTATION_PROFILE: ScopeOrientationProfileId = 'flexible'

export type ScopeOrientationProfileId = (typeof SCOPE_ORIENTATION_PROFILE_IDS)[number]

export interface ScopeOrientationAdjustment {
  rollDeg?: number
}

export interface ScopeOrientationProfile {
  label: string
  description: string
  adjustments: Record<string, ScopeOrientationAdjustment>
}

export interface ScopeOrientationCalibration {
  schema: string
  caseId: string
  defaultProfile: ScopeOrientationProfileId
  updatedAt?: string
  profiles: Record<ScopeOrientationProfileId, ScopeOrientationProfile>
}

const PROFILE_LABELS: Record<ScopeOrientationProfileId, string> = {
  flexible: 'Flexible',
  robotic: 'Robotic',
}

const PROFILE_DESCRIPTIONS: Record<ScopeOrientationProfileId, string> = {
  flexible: 'Flexible bronchoscopy wrist-roll orientation defaults.',
  robotic: 'Robotic bronchoscopy-style camera orientation baseline.',
}

export function createEmptyScopeOrientationCalibration(
  caseId = 'airway-anatomy-case-001',
): ScopeOrientationCalibration {
  return {
    schema: SCOPE_ORIENTATION_CALIBRATION_SCHEMA,
    caseId,
    defaultProfile: DEFAULT_SCOPE_ORIENTATION_PROFILE,
    profiles: {
      flexible: {
        label: PROFILE_LABELS.flexible,
        description: PROFILE_DESCRIPTIONS.flexible,
        adjustments: {},
      },
      robotic: {
        label: PROFILE_LABELS.robotic,
        description: PROFILE_DESCRIPTIONS.robotic,
        adjustments: {},
      },
    },
  }
}

export function normalizeScopeOrientationCalibration(
  value: unknown,
  caseId = 'airway-anatomy-case-001',
): ScopeOrientationCalibration {
  if (!isRecord(value)) {
    return createEmptyScopeOrientationCalibration(caseId)
  }

  const fallback = createEmptyScopeOrientationCalibration(
    typeof value.caseId === 'string' ? value.caseId : caseId,
  )
  const rawProfiles = isRecord(value.profiles) ? value.profiles : {}
  const profiles: ScopeOrientationCalibration['profiles'] = { ...fallback.profiles }

  for (const profileId of SCOPE_ORIENTATION_PROFILE_IDS) {
    const rawProfile = rawProfiles[profileId]
    if (!isRecord(rawProfile)) continue
    profiles[profileId] = {
      label: typeof rawProfile.label === 'string' ? rawProfile.label : PROFILE_LABELS[profileId],
      description:
        typeof rawProfile.description === 'string'
          ? rawProfile.description
          : PROFILE_DESCRIPTIONS[profileId],
      adjustments: parseScopeOrientationAdjustments(rawProfile.adjustments),
    }
  }

  return {
    schema: SCOPE_ORIENTATION_CALIBRATION_SCHEMA,
    caseId: fallback.caseId,
    defaultProfile:
      parseScopeOrientationProfileId(value.defaultProfile) ?? DEFAULT_SCOPE_ORIENTATION_PROFILE,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    profiles,
  }
}

export function parseScopeOrientationProfileId(value: unknown): ScopeOrientationProfileId | null {
  return value === 'flexible' || value === 'robotic' ? value : null
}

export function scopeOrientationAdjustmentFor(
  calibration: ScopeOrientationCalibration,
  profileId: ScopeOrientationProfileId,
  edgeId: number,
): ScopeOrientationAdjustment {
  return calibration.profiles[profileId]?.adjustments[String(edgeId)] ?? {}
}

export function applyScopeOrientationToPose(
  pose: ScopePoseSnapshot,
  calibration: ScopeOrientationCalibration,
  profileId: ScopeOrientationProfileId,
): ScopePoseSnapshot {
  const adjustment = scopeOrientationAdjustmentFor(calibration, profileId, pose.edgeId)
  const rollDeg = finiteNumber(adjustment.rollDeg) ?? 0
  if (rollDeg === 0) {
    return pose
  }
  return {
    ...pose,
    rollDeg: normalizeRollDeg(pose.rollDeg + rollDeg),
  }
}

export function updateScopeOrientationAdjustment(
  calibration: ScopeOrientationCalibration,
  profileId: ScopeOrientationProfileId,
  edgeId: number,
  adjustment: ScopeOrientationAdjustment | null,
): ScopeOrientationCalibration {
  const profile = calibration.profiles[profileId]
  const adjustments = { ...profile.adjustments }
  if (adjustment === null || finiteNumber(adjustment.rollDeg) === 0) {
    delete adjustments[String(edgeId)]
  } else {
    adjustments[String(edgeId)] = {
      rollDeg: normalizeRollDeg(Number(adjustment.rollDeg)),
    }
  }

  return {
    ...calibration,
    updatedAt: new Date().toISOString(),
    profiles: {
      ...calibration.profiles,
      [profileId]: {
        ...profile,
        adjustments,
      },
    },
  }
}

export function normalizeRollDeg(value: number) {
  if (!Number.isFinite(value)) return 0
  let next = value
  while (next > 180) next -= 360
  while (next < -180) next += 360
  return Math.round(next)
}

function parseScopeOrientationAdjustments(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([edgeId, rawAdjustment]) => {
      if (!/^\d+$/.test(edgeId) || !isRecord(rawAdjustment)) {
        return []
      }
      const rollDeg = finiteNumber(rawAdjustment.rollDeg)
      return rollDeg == null ? [] : [[edgeId, { rollDeg: normalizeRollDeg(rollDeg) }]]
    }),
  )
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
