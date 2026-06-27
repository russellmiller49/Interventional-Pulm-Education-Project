export type AntiplateletStatus = 'none' | 'single' | 'dual'
export type AnticoagulantStatus = 'none' | 'held' | 'active'
export type BleedingRiskLevel = 'low' | 'elevated' | 'high'

/**
 * Stable, locale-independent identifiers for each bleeding-risk reason. The UI
 * maps these to localized strings (messages `thoracentesisPlanner.bleeding.reasons.*`)
 * so the conditional logic lives in one place instead of being duplicated per
 * language. The English `reasons` strings below mirror these for tests/non-UI use.
 */
export type BleedingReasonCode = 'inrHigh' | 'plateletsLow' | 'anticoagActive' | 'dapt' | 'none'

export interface BleedingRiskInput {
  inr: number
  platelets: number
  antiplatelet: AntiplateletStatus
  anticoagulant: AnticoagulantStatus
}

export interface BleedingRiskResult {
  level: BleedingRiskLevel
  reasons: string[]
  reasonCodes: BleedingReasonCode[]
  teachingPoint: string
}

export function classifyBleedingRisk(input: BleedingRiskInput): BleedingRiskResult {
  const reasons: string[] = []
  const reasonCodes: BleedingReasonCode[] = []

  if (input.inr >= 3) {
    reasons.push('INR is 3 or higher in this educational risk model.')
    reasonCodes.push('inrHigh')
  }

  if (input.platelets <= 20000) {
    reasons.push('Platelets are 20,000/uL or lower in this educational risk model.')
    reasonCodes.push('plateletsLow')
  }

  if (input.anticoagulant === 'active') {
    reasons.push('Therapeutic anticoagulation is active.')
    reasonCodes.push('anticoagActive')
  }

  if (input.antiplatelet === 'dual') {
    reasons.push('Dual antiplatelet therapy adds procedure-planning complexity.')
    reasonCodes.push('dapt')
  }

  const level: BleedingRiskLevel =
    input.inr >= 3 || input.platelets <= 20000
      ? 'high'
      : input.anticoagulant === 'active' || input.antiplatelet === 'dual'
        ? 'elevated'
        : 'low'

  return {
    level,
    reasons: reasons.length ? reasons : ['No high-risk lab or medication flags in this case.'],
    reasonCodes: reasonCodes.length ? reasonCodes : ['none'],
    teachingPoint:
      'Pleural procedure bleeding decisions are individualized; ultrasound guidance, indication, urgency, local policy, and medication timing matter more than a single lab number.',
  }
}

export type EntryPosition = 'posterior-medial' | 'mid-axillary' | 'lateral-safe' | 'too-low'

export interface VesselRiskResult {
  level: 'lower' | 'moderate' | 'higher'
  label: string
  teachingPoint: string
}

export function intercostalVesselRisk(entryPosition: EntryPosition): VesselRiskResult {
  if (entryPosition === 'posterior-medial') {
    return {
      level: 'higher',
      label: 'Posterior/medial',
      teachingPoint:
        'Posterior and medial approaches near the spine have more variable, exposed intercostal vessels; scan laterally for a safer window.',
    }
  }

  if (entryPosition === 'too-low') {
    return {
      level: 'higher',
      label: 'Below safe diaphragm boundary',
      teachingPoint:
        'A low entry risks diaphragm and abdominal structures; re-map the pocket and keep the diaphragm visible.',
    }
  }

  if (entryPosition === 'mid-axillary') {
    return {
      level: 'moderate',
      label: 'Mid-axillary',
      teachingPoint:
        'Mid-axillary access can be appropriate when ultrasound confirms fluid depth, rib-space anatomy, and diaphragm location.',
    }
  }

  return {
    level: 'lower',
    label: 'Lateral ultrasound-confirmed window',
    teachingPoint:
      'A lateral ultrasound-confirmed pocket with a clear diaphragm boundary is the preferred teaching target.',
  }
}
