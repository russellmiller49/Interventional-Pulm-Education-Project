import type { EffusionPattern, ManagementImplication, PatternScore } from './types'

export const patternToManagement: Record<EffusionPattern, ManagementImplication> = {
  simpleAnechoic: 'thoraReasonable',
  complexNonSeptated: 'thoraReasonable',
  septatedLoculated: 'considerTubeAndAdjuncts',
  echogenic: 'considerTubeAndAdjuncts',
}

const teachingByPattern: Record<EffusionPattern, string> = {
  simpleAnechoic:
    'Simple anechoic fluid can be a transudate or exudate; the image does not replace clinical context or pleural fluid analysis.',
  complexNonSeptated:
    'Complex nonseptated fluid may still be sampled safely when the pocket is accessible, but the broader story decides urgency.',
  septatedLoculated:
    'Septations or locules suggest fibrin, infection, blood, or malignant complexity and should prompt drainage/source-control thinking when the clinical context fits.',
  echogenic:
    'Echogenic fluid raises concern for pus, blood, cellular debris, or malignancy; do not treat it as a simple free-flowing effusion.',
}

export function scoreClassification(
  answer: EffusionPattern,
  groundTruth: EffusionPattern,
): PatternScore {
  return {
    correct: answer === groundTruth,
    teachingPoint: teachingByPattern[groundTruth],
  }
}

export function describeManagement(implication: ManagementImplication) {
  return implication === 'thoraReasonable'
    ? 'Thoracentesis may be reasonable if the pocket is safe and the clinical question requires sampling or symptom relief.'
    : 'Consider tube drainage and adjuncts when infection, blood, loculation, or malignant complexity fits the case.'
}
