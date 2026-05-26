export type AntiplateletStatus = 'none' | 'single' | 'dual'
export type AnticoagulantStatus = 'none' | 'held' | 'active'
export type BleedingRiskLevel = 'low' | 'elevated' | 'high'

export interface BleedingRiskInput {
  inr: number
  platelets: number
  antiplatelet: AntiplateletStatus
  anticoagulant: AnticoagulantStatus
}

export interface BleedingRiskResult {
  level: BleedingRiskLevel
  reasons: string[]
  teachingPoint: string
}

export function classifyBleedingRisk(input: BleedingRiskInput): BleedingRiskResult {
  const reasons: string[] = []

  if (input.inr >= 3) {
    reasons.push('INR is 3 or higher in this educational risk model.')
  }

  if (input.platelets <= 20000) {
    reasons.push('Platelets are 20,000/uL or lower in this educational risk model.')
  }

  if (input.anticoagulant === 'active') {
    reasons.push('Therapeutic anticoagulation is active.')
  }

  if (input.antiplatelet === 'dual') {
    reasons.push('Dual antiplatelet therapy adds procedure-planning complexity.')
  }

  const level: BleedingRiskLevel =
    input.inr >= 3 || input.platelets <= 20000
      ? 'high'
      : input.anticoagulant === 'active' || input.antiplatelet === 'dual'
        ? 'elevated'
        : 'low'

  return {
    level,
    reasons: reasons.length ? reasons : ['No modeled high-risk lab or medication flags.'],
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
