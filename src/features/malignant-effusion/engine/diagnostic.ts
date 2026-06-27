export type LungExpansion = 'full' | 'partial' | 'trapped'
export type ManagementArm = 'pleurodesisCandidate' | 'ipcOrRapidPleurodesis' | 'ipcPreferred'

/**
 * Stable, locale-independent identifier for each nondiagnostic-tap branch. The
 * UI maps these to localized strings (messages `malignantEffusion.nondiagnostic.*`)
 * so the conditional logic lives in one place instead of being duplicated per
 * language. The English `recommendation` / `teachingPoint` strings below mirror
 * these for tests/non-UI use.
 */
export type NondiagnosticTapCode = 'twoPlus' | 'one' | 'zero'

export interface NondiagnosticTapRecommendation {
  shouldEscalate: boolean
  code: NondiagnosticTapCode
  recommendation: string
  teachingPoint: string
}

export function afterNondiagnosticTaps(count: number): NondiagnosticTapRecommendation {
  if (count >= 2) {
    return {
      shouldEscalate: true,
      code: 'twoPlus',
      recommendation:
        'Stop fluid-only cycling and escalate toward pleural biopsy, image-guided biopsy, or pleuroscopy when suspicion remains high.',
      teachingPoint:
        'Repeated nondiagnostic cytology should not falsely reassure when imaging, history, or recurrence keeps MPE likely.',
    }
  }

  if (count === 1) {
    return {
      shouldEscalate: true,
      code: 'one',
      recommendation:
        'A second cytology sample can be considered in selected cases, but tissue strategy should already be visible if pretest probability is high.',
      teachingPoint:
        'One nondiagnostic tap is a fork: repeat selectively, but start planning tissue diagnosis when suspicion stays high.',
    }
  }

  return {
    shouldEscalate: false,
    code: 'zero',
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
    ? 'Thoracentesis cytology sensitivity is taught as roughly 40-60%, so negative results require context.'
    : 'Pleuroscopy or pleural biopsy usually offers higher-yield tissue diagnosis, around 80-90% in this teaching context.'
}
