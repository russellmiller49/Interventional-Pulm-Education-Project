import type { PneumothoraxCase, PneumothoraxRecommendation } from './types'

export function isPhysiologicallyUnstable(clinicalCase: PneumothoraxCase) {
  return clinicalCase.hemodynamicCompromise || clinicalCase.severeHypoxemia
}

export function evaluatePneumothoraxPathway(
  clinicalCase: PneumothoraxCase,
): PneumothoraxRecommendation {
  const rationale: string[] = []

  if (isPhysiologicallyUnstable(clinicalCase)) {
    rationale.push('Hemodynamic compromise or severe hypoxemia overrides size-based reasoning.')
    return {
      disposition: 'emergency',
      recommendation:
        'Treat as urgent decompression and tube-drainage territory while stabilizing the patient.',
      rationale,
      recurrencePrevention: recurrencePreventionText(clinicalCase),
    }
  }

  if (clinicalCase.persistentAirLeakDays >= 5) {
    rationale.push('Persistent air leak has reached the time-bounded escalation window.')
    rationale.push(
      'Confirm drain patency and position, avoid unnecessary suction, and escalate deliberately.',
    )
    return {
      disposition: 'escalate',
      recommendation:
        'Seek specialist escalation for persistent air leak: surgical, bronchoscopic, blood patch, or pleurodesis options depending on anatomy and fitness.',
      rationale,
      recurrencePrevention: recurrencePreventionText(clinicalCase),
    }
  }

  if (
    clinicalCase.type === 'ssp' ||
    clinicalCase.underlyingLungDisease ||
    clinicalCase.ventilated ||
    clinicalCase.type === 'traumatic'
  ) {
    rationale.push(
      'Secondary, traumatic, ventilated, or physiologically fragile cases have less reserve.',
    )
    return {
      disposition: 'chest-drain',
      recommendation:
        'Use a monitored pathway with aspiration or small-bore drain selection based on patient state, local expertise, and imaging.',
      rationale,
      recurrencePrevention: recurrencePreventionText(clinicalCase),
    }
  }

  if (clinicalCase.type === 'psp' && clinicalCase.symptomBurden === 'minimal') {
    rationale.push('Stable minimally symptomatic PSP can be considered for conservative care.')
    rationale.push('Size alone should not force an invasive pathway in current teaching.')
    return {
      disposition: 'conservative',
      recommendation:
        'Consider conservative management with safety-netting and follow-up if reliable and locally supported.',
      rationale,
      recurrencePrevention: recurrencePreventionText(clinicalCase),
    }
  }

  rationale.push('Stable symptomatic PSP can be considered for aspiration or ambulatory pathway.')
  return {
    disposition: 'aspiration-or-ambulatory',
    recommendation:
      'Consider needle aspiration or ambulatory device pathway where local systems, symptoms, and follow-up support it.',
    rationale,
    recurrencePrevention: recurrencePreventionText(clinicalCase),
  }
}

function recurrencePreventionText(clinicalCase: PneumothoraxCase) {
  if (clinicalCase.highRiskOccupation) {
    return 'Discuss definitive recurrence prevention because aviation/diving or similar exposure changes the risk tolerance.'
  }

  if (clinicalCase.recurrence !== 'none' || clinicalCase.type === 'ssp') {
    return 'Discuss recurrence prevention, pleurodesis or surgery, smoking cessation, and specialty follow-up.'
  }

  return 'Counsel on recurrence risk, smoking cessation, follow-up, and return precautions.'
}
