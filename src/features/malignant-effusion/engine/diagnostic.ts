export type LungExpansion = 'full' | 'partial' | 'trapped'
export type ManagementArm = 'pleurodesisCandidate' | 'ipcOrRapidPleurodesis' | 'ipcPreferred'

export interface NondiagnosticTapRecommendation {
  shouldEscalate: boolean
  recommendation: string
  teachingPoint: string
}

export function afterNondiagnosticTaps(count: number): NondiagnosticTapRecommendation {
  if (count >= 2) {
    return {
      shouldEscalate: true,
      recommendation:
        'Stop fluid-only cycling and escalate toward pleural biopsy, image-guided biopsy, or pleuroscopy when suspicion remains high.',
      teachingPoint:
        'Repeated nondiagnostic cytology should not falsely reassure when imaging, history, or recurrence keeps MPE likely.',
    }
  }

  if (count === 1) {
    return {
      shouldEscalate: true,
      recommendation:
        'A second cytology sample can be considered in selected cases, but tissue strategy should already be visible if pretest probability is high.',
      teachingPoint:
        'One nondiagnostic tap is a fork: repeat selectively, but start planning tissue diagnosis when suspicion stays high.',
    }
  }

  return {
    shouldEscalate: false,
    recommendation:
      'Send adequate cytology and pair the result with imaging, lung expansion, symptoms, and patient goals.',
    teachingPoint:
      'Thoracentesis can diagnose some MPE, but negative cytology is not a rule-out test.',
  }
}

export function postDrainageBranch(lungExpansion: LungExpansion): {
  arm: ManagementArm
  recommendation: string
} {
  if (lungExpansion === 'full') {
    return {
      arm: 'pleurodesisCandidate',
      recommendation:
        'Expandable lung can be considered for talc pleurodesis, IPC, or combined outpatient strategy depending on goals and fitness.',
    }
  }

  if (lungExpansion === 'partial') {
    return {
      arm: 'ipcOrRapidPleurodesis',
      recommendation:
        'Partial expansion favors IPC-centered care or selected combined/rapid pleurodesis strategy rather than assuming talc alone will work.',
    }
  }

  return {
    arm: 'ipcPreferred',
    recommendation:
      'Trapped or non-expandable lung makes pleurodesis unlikely to succeed; IPC-centered symptom control is the core teaching branch.',
  }
}

export function diagnosticYieldLabel(strategy: 'thoracentesis' | 'pleuroscopy') {
  return strategy === 'thoracentesis'
    ? 'Thoracentesis cytology sensitivity is modeled as 40-60%, so negative results require context.'
    : 'Pleuroscopy/pleural biopsy is modeled as higher-yield tissue diagnosis, around 80-90% in this teaching frame.'
}
