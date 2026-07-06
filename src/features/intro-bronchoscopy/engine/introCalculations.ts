export type BronchoscopyDecision = 'scope' | 'defer' | 'alternative' | 'stabilize'

export interface BronchoscopyDecisionInput {
  expectedBenefit: number
  physiologicRisk: number
  alternativeYield: number
  urgency: number
  resultChangesManagement: boolean
}

export interface BronchoscopyDecisionResult {
  decision: BronchoscopyDecision
  benefitScore: number
  riskScore: number
  rationale: string
}

export function assessBronchoscopyDecision(
  input: BronchoscopyDecisionInput,
): BronchoscopyDecisionResult {
  const benefitScore =
    input.expectedBenefit + input.urgency + (input.resultChangesManagement ? 2 : -2)
  const riskScore = input.physiologicRisk + Math.max(0, input.alternativeYield - 2)

  if (input.physiologicRisk >= 8 && input.urgency < 7) {
    return {
      decision: 'stabilize',
      benefitScore,
      riskScore,
      rationale: 'Stabilize physiology or choose a safer airway/anesthesia plan before scoping.',
    }
  }
  if (!input.resultChangesManagement && input.urgency < 8) {
    return {
      decision: 'defer',
      benefitScore,
      riskScore,
      rationale: 'The procedure should be deferred when the result is unlikely to change care.',
    }
  }
  if (input.alternativeYield >= input.expectedBenefit + 2 && input.urgency < 7) {
    return {
      decision: 'alternative',
      benefitScore,
      riskScore,
      rationale: 'A non-bronchoscopic alternative is likely to answer the question with less risk.',
    }
  }
  return {
    decision: benefitScore > riskScore ? 'scope' : 'defer',
    benefitScore,
    riskScore,
    rationale:
      benefitScore > riskScore
        ? 'Expected benefit exceeds risk when the indication, tools, team, and rescue plan align.'
        : 'Risk is not justified by the expected diagnostic or therapeutic benefit.',
  }
}

export interface EttOcclusionResult {
  percentOccluded: number
  residualAreaMm2: number
  severity: 'low' | 'moderate' | 'high' | 'critical'
  message: string
}

function circleArea(diameterMm: number): number {
  return Math.PI * (diameterMm / 2) ** 2
}

export function calculateEttOcclusion(
  ettInnerDiameterMm: number,
  scopeOuterDiameterMm: number,
): EttOcclusionResult {
  const ettArea = circleArea(ettInnerDiameterMm)
  const scopeArea = circleArea(scopeOuterDiameterMm)
  const percentOccluded = Math.min(100, Math.round((scopeArea / ettArea) * 100))
  const residualAreaMm2 = Math.max(0, ettArea - scopeArea)
  const severity =
    percentOccluded >= 70
      ? 'critical'
      : percentOccluded >= 55
        ? 'high'
        : percentOccluded >= 35
          ? 'moderate'
          : 'low'
  const message =
    severity === 'critical'
      ? 'Critical obstruction risk: withdraw, upsize the airway, or use a smaller scope if feasible.'
      : severity === 'high'
        ? 'High obstruction risk: shorten passes, preoxygenate, and watch ventilation continuously.'
        : severity === 'moderate'
          ? 'Moderate obstruction: monitor pressures, tidal volume, and expiratory time.'
          : 'Lower obstruction burden, though oxygenation and ventilation still require monitoring.'

  return { percentOccluded, residualAreaMm2, severity, message }
}

export interface BalQualityInput {
  targetSelected: boolean
  avoidedProximalSuction: boolean
  wedged: boolean
  instilledMl: number
  returnedMl: number
  sentCorrectTests: boolean
}

export interface BalQualityResult {
  score: number
  returnPercent: number
  quality: 'poor' | 'borderline' | 'adequate' | 'high-quality'
  misses: string[]
}

export function scoreBalQuality(input: BalQualityInput): BalQualityResult {
  const misses: string[] = []
  let score = 0
  if (input.targetSelected) score += 2
  else misses.push('Choose a target based on the disease pattern and CT.')
  if (input.avoidedProximalSuction) score += 2
  else misses.push('Avoid proximal suctioning before the wedge when infection yield matters.')
  if (input.wedged) score += 2
  else misses.push('Maintain a wedge so aliquots reach the distal airspace.')
  if (input.instilledMl >= 100) score += 2
  else misses.push('Instill at least 100 mL unless there is a deliberate exception.')
  const returnPercent =
    input.instilledMl > 0 ? Math.round((input.returnedMl / input.instilledMl) * 100) : 0
  if (input.returnedMl >= 30 || returnPercent >= 30) score += 1
  else misses.push('Low return can reduce confidence in interpretation.')
  if (input.sentCorrectTests) score += 1
  else misses.push('Send the correct microbiology, cytology, or cell-count studies.')

  const quality =
    score >= 9 ? 'high-quality' : score >= 7 ? 'adequate' : score >= 5 ? 'borderline' : 'poor'

  return { score, returnPercent, quality, misses }
}

export function classifyStenosis(percentNarrowing: number): {
  severity: 'none' | 'mild' | 'moderate' | 'severe' | 'critical'
  label: string
} {
  const pct = Math.max(0, Math.min(100, Math.round(percentNarrowing)))
  if (pct >= 90) return { severity: 'critical', label: `${pct}% critical narrowing` }
  if (pct >= 70) return { severity: 'severe', label: `${pct}% severe narrowing` }
  if (pct >= 50) return { severity: 'moderate', label: `${pct}% moderate narrowing` }
  if (pct >= 25) return { severity: 'mild', label: `${pct}% mild narrowing` }
  return { severity: 'none', label: `${pct}% minimal narrowing` }
}

export interface ForeignBodyInput {
  shape: 'round-smooth' | 'sharp' | 'organic' | 'embedded' | 'peripheral'
  airwayControlNeeded: boolean
}

export function recommendForeignBodyTool(input: ForeignBodyInput): {
  primary: 'basket' | 'forceps' | 'cryo' | 'balloon' | 'rigid'
  backup: string
  rationale: string
} {
  if (input.airwayControlNeeded || input.shape === 'sharp') {
    return {
      primary: 'rigid',
      backup: 'Secure airway, protect the glottis, and prepare forceps or basket backup.',
      rationale: 'Sharp or high-risk objects need stronger airway control and extraction options.',
    }
  }
  if (input.shape === 'organic') {
    return {
      primary: 'cryo',
      backup: 'Basket or forceps if the object does not freeze or fragments.',
      rationale: 'Water-containing organic material often adheres well to a cryoprobe.',
    }
  }
  if (input.shape === 'round-smooth') {
    return {
      primary: 'basket',
      backup: 'Forceps may slide off; have a retrieval net or secured-airway plan ready.',
      rationale: 'Baskets capture smooth mobile objects better than pinching forceps.',
    }
  }
  if (input.shape === 'peripheral') {
    return {
      primary: 'balloon',
      backup: 'Dislodge proximally, then retrieve with basket, forceps, or cryo.',
      rationale: 'A balloon may free a lodged peripheral object but is not the final grasper.',
    }
  }
  return {
    primary: 'forceps',
    backup: 'Plan for bleeding from granulation and consider staged extraction.',
    rationale: 'Embedded chronic objects may require grasping after granulation is managed.',
  }
}

export type BleedingAction =
  | 'announce'
  | 'suction'
  | 'protect-good-lung'
  | 'wedge'
  | 'topical'
  | 'escalate'

export function scoreBleedingSequence(actions: BleedingAction[]): {
  score: number
  complete: boolean
  feedback: string
} {
  const expected: BleedingAction[] = [
    'announce',
    'suction',
    'protect-good-lung',
    'wedge',
    'topical',
    'escalate',
  ]
  const score = actions.reduce(
    (total, action, index) => total + (expected[index] === action ? 1 : 0),
    0,
  )
  return {
    score,
    complete: score === expected.length,
    feedback:
      score === expected.length
        ? 'Sequence protects oxygenation, isolates the source, and escalates deliberately.'
        : 'Prioritize announcement, view, good-lung protection, isolation, topical control, then escalation.',
  }
}

export type CaoPattern = 'intrinsic' | 'extrinsic' | 'mixed' | 'dynamic'

export function planCentralAirwayObstruction(pattern: CaoPattern): string[] {
  const base = ['Review CT in axial/coronal/sagittal planes', 'Avoid blind airway manipulation']
  if (pattern === 'extrinsic') {
    return [...base, 'Preserve spontaneous ventilation when feasible', 'Assemble advanced backup']
  }
  if (pattern === 'intrinsic') {
    return [...base, 'Plan bronchoscopic guidance', 'Prepare debulking or coring options']
  }
  if (pattern === 'dynamic') {
    return [
      ...base,
      'Assess collapse during quiet breathing and cough',
      'Consider positive pressure response',
    ]
  }
  return [
    ...base,
    'Plan both debulking and dilation/stent contingencies',
    'Coordinate anesthesia and rescue',
  ]
}
