import type { PneumothoraxCase } from './types'

export type Disposition =
  | 'emergency'
  | 'observation'
  | 'aspiration'
  | 'ambulatory'
  | 'chest-drain'
  | 'escalate'

export interface FrameworkResult {
  framework: 'ACCP 2001' | 'BTS 2023'
  disposition: Disposition
  headline: string
  rationale: string[]
}

export interface DualFrameworkResult {
  accp: FrameworkResult
  bts: FrameworkResult
  agreement: boolean
  comparisonNote: string
  recurrencePrevention: string
}

export function isPhysiologicallyUnstable(clinicalCase: PneumothoraxCase): boolean {
  return clinicalCase.hemodynamicCompromise || clinicalCase.severeHypoxemia
}

function isStableByAccpVitals(clinicalCase: PneumothoraxCase): boolean {
  const vitals = clinicalCase.accpVitals

  return (
    vitals.respiratoryRate < 24 &&
    vitals.heartRate >= 60 &&
    vitals.heartRate <= 120 &&
    vitals.roomAirSpo2 > 90 &&
    vitals.bloodPressureStable &&
    vitals.speaksFullSentences
  )
}

export function evaluateAccp(clinicalCase: PneumothoraxCase): FrameworkResult {
  const rationale: string[] = []

  if (isPhysiologicallyUnstable(clinicalCase) || !isStableByAccpVitals(clinicalCase)) {
    return {
      framework: 'ACCP 2001',
      disposition: 'emergency',
      headline: 'Urgent decompression and drainage',
      rationale: [
        'American College of Chest Physicians stability criteria are not met, so physiology takes priority over size.',
      ],
    }
  }

  if (clinicalCase.persistentAirLeakDays >= 3) {
    return {
      framework: 'ACCP 2001',
      disposition: 'escalate',
      headline: 'Specialist escalation for persistent air leak',
      rationale: [
        'The 2001 framework escalates persistent air leak earlier, around days 3 to 5 after drainage and system checks.',
      ],
    }
  }

  if (clinicalCase.type === 'ssp' || clinicalCase.underlyingLungDisease) {
    return {
      framework: 'ACCP 2001',
      disposition: 'chest-drain',
      headline: 'Chest drain and admission',
      rationale: [
        'Secondary spontaneous pneumothorax has less respiratory reserve, so the historical framework favors drainage and monitoring.',
      ],
    }
  }

  rationale.push('The patient meets the historical stable-patient vital sign criteria.')

  if (clinicalCase.sizeCategory === 'small' && clinicalCase.symptomBurden === 'minimal') {
    rationale.push('Small primary spontaneous pneumothorax is observation territory in ACCP 2001.')
    return {
      framework: 'ACCP 2001',
      disposition: 'observation',
      headline: 'Observe with repeat assessment',
      rationale,
    }
  }

  rationale.push(
    'Large size or meaningful symptoms move the historical pathway toward aspiration or drainage.',
  )

  return {
    framework: 'ACCP 2001',
    disposition: 'aspiration',
    headline: 'Needle aspiration or catheter drainage',
    rationale,
  }
}

export function evaluateBts(clinicalCase: PneumothoraxCase): FrameworkResult {
  if (isPhysiologicallyUnstable(clinicalCase)) {
    return {
      framework: 'BTS 2023',
      disposition: 'emergency',
      headline: 'Urgent decompression and drainage',
      rationale: [
        'British Thoracic Society guidance treats tension physiology or significant hypoxia as a high-risk emergency.',
      ],
    }
  }

  if (clinicalCase.persistentAirLeakDays >= 5) {
    return {
      framework: 'BTS 2023',
      disposition: 'escalate',
      headline: 'Specialist escalation for persistent air leak',
      rationale: [
        'The 2023 pathway uses time-bounded reassessment and escalation when an air leak persists around days 5 to 7.',
      ],
    }
  }

  if (
    clinicalCase.type === 'ssp' ||
    clinicalCase.underlyingLungDisease ||
    clinicalCase.ventilated ||
    clinicalCase.type === 'traumatic'
  ) {
    return {
      framework: 'BTS 2023',
      disposition: 'chest-drain',
      headline: 'Monitored intervention pathway',
      rationale: [
        'High-risk characteristics, including underlying lung disease or ventilated/traumatic context, favor monitored intervention.',
      ],
    }
  }

  if (clinicalCase.symptomBurden === 'minimal') {
    return {
      framework: 'BTS 2023',
      disposition: 'observation',
      headline: 'Conservative management with safety-netting',
      rationale: [
        'The 2023 pathway de-emphasizes size for stable, minimally symptomatic primary spontaneous pneumothorax.',
        'Procedure avoidance is reasonable when follow-up and return precautions are reliable.',
      ],
    }
  }

  if (clinicalCase.symptomBurden === 'severe') {
    return {
      framework: 'BTS 2023',
      disposition: 'chest-drain',
      headline: 'Short-term drainage for rapid symptom relief',
      rationale: [
        'Severe symptoms shift the patient-priority question toward rapid relief and monitored drainage.',
      ],
    }
  }

  return {
    framework: 'BTS 2023',
    disposition: 'ambulatory',
    headline: 'Ambulatory device or aspiration pathway',
    rationale: [
      'For stable symptomatic primary spontaneous pneumothorax, the pathway weighs patient preference, local availability, and rapid symptom relief.',
    ],
  }
}

export function evaluateBothFrameworks(clinicalCase: PneumothoraxCase): DualFrameworkResult {
  const accp = evaluateAccp(clinicalCase)
  const bts = evaluateBts(clinicalCase)
  const agreement = accp.disposition === bts.disposition

  return {
    accp,
    bts,
    agreement,
    comparisonNote: comparisonNote(clinicalCase, accp.disposition, bts.disposition, agreement),
    recurrencePrevention: recurrencePreventionText(clinicalCase),
  }
}

function comparisonNote(
  clinicalCase: PneumothoraxCase,
  accpDisposition: Disposition,
  btsDisposition: Disposition,
  agreement: boolean,
) {
  if (agreement) {
    return 'Both frameworks converge here, which usually means physiology, high-risk context, or persistent air leak timing is dominating the decision.'
  }

  if (accpDisposition === 'aspiration' && btsDisposition === 'observation') {
    return 'Classic divergence: ACCP 2001 reacts to size, while BTS 2023 prioritizes symptoms, patient priorities, and follow-up reliability.'
  }

  if (clinicalCase.persistentAirLeakDays >= 3 && clinicalCase.persistentAirLeakDays < 5) {
    return 'The divergence is timing: ACCP 2001 escalates persistent air leak before the BTS 2023 day-5 window.'
  }

  return 'The frameworks diverge; identify whether size, symptom burden, local ambulatory care, or risk context is driving the difference.'
}

function recurrencePreventionText(clinicalCase: PneumothoraxCase) {
  if (clinicalCase.highRiskOccupation) {
    return 'High-risk occupation, such as aviation or diving, lowers the threshold for definitive recurrence-prevention discussion.'
  }

  if (clinicalCase.recurrence !== 'none' || clinicalCase.type === 'ssp') {
    return 'Recurrence or secondary spontaneous pneumothorax should prompt prevention counseling, smoking cessation, pleurodesis or surgical options, and specialist follow-up.'
  }

  return 'For a first primary spontaneous pneumothorax, counsel about recurrence risk, smoking cessation, follow-up, and return precautions.'
}
