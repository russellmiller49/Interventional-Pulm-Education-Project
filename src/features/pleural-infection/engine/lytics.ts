export type LyticChoice =
  | 'alteplase10Dnase5'
  | 'alteplaseOnly'
  | 'dnaseOnly'
  | 'placebo'
  | 'salineIrrigation'

export interface LyticResult {
  label: string
  effect: string
  caution: string
}

export function evaluateLyticChoice(choice: LyticChoice): LyticResult {
  if (choice === 'alteplase10Dnase5') {
    return {
      label: 'Tissue plasminogen activator (tPA) 10 mg plus DNase 5 mg',
      effect:
        'Combination therapy improved radiographic clearance and reduced surgical referral and length of stay in MIST2 teaching.',
      caution:
        'Assess bleeding risk and medication timing; do not treat the dose as patient-specific advice.',
    }
  }

  if (choice === 'alteplaseOnly') {
    return {
      label: 'tPA alone',
      effect: 'Single-agent fibrinolytic therapy did not show the same MIST2 teaching benefit.',
      caution: 'Avoid teaching monotherapy as the preferred pathway.',
    }
  }

  if (choice === 'dnaseOnly') {
    return {
      label: 'DNase alone',
      effect: 'DNase monotherapy is a teaching trap and was not beneficial in MIST2.',
      caution: 'Use combination therapy or an alternative strategy rather than DNase alone.',
    }
  }

  if (choice === 'salineIrrigation') {
    return {
      label: 'Pleural irrigation',
      effect:
        'Normal saline irrigation is a pilot-data alternative to discuss when lytics are unsuitable or bleeding risk cannot be mitigated.',
      caution:
        'Frame as selected-pathway teaching, not universal replacement for lytics or surgery.',
    }
  }

  return {
    label: 'Placebo / drainage alone',
    effect:
      'Drainage alone can be sufficient when source control is achieved, but residual collections need early reassessment.',
    caution:
      'Do not delay escalation when fever, inflammatory markers, output, or imaging fail to improve.',
  }
}

/**
 * Stable, locale-independent identifier for the bleeding-overlay note. The UI
 * maps it to a localized string (messages `pleuralInfection.workflow.bleeding.note.*`).
 * The English `note` string mirrors it for tests/non-UI use.
 */
export type BleedingNoteCode = 'anticoagulated' | 'baseline'

export function bleedingRisk(anticoagulated: boolean) {
  return {
    percent: anticoagulated ? 8.2 : 4.1,
    noteCode: (anticoagulated ? 'anticoagulated' : 'baseline') as BleedingNoteCode,
    note: anticoagulated
      ? 'Therapeutic anticoagulation increases bleeding concern and should trigger mitigation planning.'
      : 'Baseline pleural bleeding signal for lytic teaching is 4.1%.',
  }
}
