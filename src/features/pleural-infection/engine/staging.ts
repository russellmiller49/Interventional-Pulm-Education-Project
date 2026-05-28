export type InfectionUltrasoundPattern = 'freeFlowing' | 'complex' | 'septated' | 'large'
export type ParapneumonicStage = 'uncomplicated' | 'complicated' | 'empyema'

export interface ParapneumonicInput {
  ph?: number
  glucose?: number
  ldh?: number
  gramStain: boolean
  frankPus: boolean
  usPattern: InfectionUltrasoundPattern
}

export interface ParapneumonicClassification {
  stage: ParapneumonicStage
  reasons: string[]
  action: string
}

export function classifyParapneumonic(input: ParapneumonicInput): ParapneumonicClassification {
  const reasons: string[] = []

  if (input.frankPus) {
    reasons.push('Frank pus is empyema in this teaching model.')
  }

  if (input.gramStain) {
    reasons.push('Positive Gram stain indicates pleural infection.')
  }

  if (reasons.length) {
    return {
      stage: 'empyema',
      reasons,
      action: 'Drain with antibiotics and reassess source control early.',
    }
  }

  if (input.ph !== undefined && input.ph <= 7.2) {
    reasons.push('Pleural pH is 7.20 or lower.')
  }

  if (input.glucose !== undefined && input.glucose < 60) {
    reasons.push('Pleural glucose is below 60 mg/dL.')
  }

  if (input.ldh !== undefined && input.ldh > 1000) {
    reasons.push('Pleural LDH is above 1,000 IU/L.')
  }

  if (
    input.usPattern === 'complex' ||
    input.usPattern === 'septated' ||
    input.usPattern === 'large'
  ) {
    reasons.push('Imaging has high-risk complexity or size features.')
  }

  if (reasons.length) {
    return {
      stage: 'complicated',
      reasons,
      action: 'Use antibiotics plus small-bore image-guided drainage when safe, then reassess.',
    }
  }

  return {
    stage: 'uncomplicated',
    reasons: ['No drainage-level chemistry, microbiology, pus, or complex imaging in this case.'],
    action: 'Antibiotics with close clinical reassessment may be reasonable in the right context.',
  }
}

export function antibioticDuration(stage: ParapneumonicStage) {
  if (stage === 'uncomplicated') {
    return 'Up to 2 weeks, tailored to clinical response.'
  }

  if (stage === 'complicated') {
    return 'Often 2-4 weeks, tailored to source control and clinical response.'
  }

  return 'Often 4-6 weeks, tailored to drainage, organism, and clinical response.'
}
