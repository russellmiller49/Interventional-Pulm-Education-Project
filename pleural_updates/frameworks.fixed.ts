import type { PneumothoraxCase } from './types'

/**
 * frameworks.fixed.ts
 *
 * Restores the module's headline feature: ACCP 2001 and BTS 2023 are evaluated
 * INDEPENDENTLY so the learner can see where they agree and where they diverge.
 * The previous version collapsed both into one blended recommendation, which
 * erased the entire teaching point.
 *
 * Replace src/features/pneumothorax-pathway/engine/frameworks.ts with this
 * (and update the named export imports in the component + test accordingly).
 *
 * Clinical thresholds are sourced from the pleural knowledge document
 * section 8. Keep statements reviewable in content/lessons.ts.
 */

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
  /** True when both frameworks land on the same disposition. */
  agreement: boolean
  /** Plain-language note on why they agree or diverge. */
  comparisonNote: string
  recurrencePrevention: string
}

export function isPhysiologicallyUnstable(c: PneumothoraxCase): boolean {
  return c.hemodynamicCompromise || c.severeHypoxemia
}

/**
 * ACCP 2001: size- and stability-driven. "Stable" requires RR < 24, HR
 * 60-120, normal BP, SpO2 > 90% on room air, and full sentences. Size
 * (small vs large by the 3 cm apex-to-cupola rule) drives observation vs
 * intervention. Persistent air leak escalation at 3-5 days.
 */
export function evaluateAccp(c: PneumothoraxCase): FrameworkResult {
  const rationale: string[] = []

  if (isPhysiologicallyUnstable(c)) {
    return {
      framework: 'ACCP 2001',
      disposition: 'emergency',
      headline: 'Urgent decompression and drainage',
      rationale: ['Instability overrides size-based reasoning; treat as a drainage emergency.'],
    }
  }

  if (c.persistentAirLeakDays >= 3) {
    rationale.push('ACCP escalates persistent air leak earlier, at roughly 3-5 days.')
    return {
      framework: 'ACCP 2001',
      disposition: 'escalate',
      headline: 'Specialist escalation for persistent air leak',
      rationale,
    }
  }

  if (c.type === 'ssp') {
    rationale.push('ACCP treats almost all SSP with a chest drain and admission given low reserve.')
    return {
      framework: 'ACCP 2001',
      disposition: 'chest-drain',
      headline: 'Chest drain and admission',
      rationale,
    }
  }

  // PSP: size + stability driven
  rationale.push('Stable PSP is stratified by size using the apex-to-cupola measurement.')
  rationale.push(
    'Small stable PSP can be observed; large or symptomatic PSP is aspirated or drained.',
  )
  return {
    framework: 'ACCP 2001',
    disposition: c.symptomBurden === 'minimal' ? 'observation' : 'aspiration',
    headline: c.symptomBurden === 'minimal' ? 'Observe with oxygen' : 'Needle aspiration',
    rationale,
  }
}

/**
 * BTS 2023: moves away from size as the central breakpoint. Symptoms and
 * patient priorities drive the choice; conservative and ambulatory pathways
 * are explicitly endorsed for selected stable patients. Surgical/specialist
 * escalation for persistent air leak at roughly 5-7 days.
 */
export function evaluateBts(c: PneumothoraxCase): FrameworkResult {
  const rationale: string[] = []

  if (isPhysiologicallyUnstable(c)) {
    return {
      framework: 'BTS 2023',
      disposition: 'emergency',
      headline: 'Urgent decompression and drainage',
      rationale: ['Instability is the one place both frameworks fully agree: decompress now.'],
    }
  }

  if (c.persistentAirLeakDays >= 5) {
    rationale.push('BTS allows a slightly longer window before escalation, roughly 5-7 days.')
    return {
      framework: 'BTS 2023',
      disposition: 'escalate',
      headline: 'Specialist escalation for persistent air leak',
      rationale,
    }
  }

  if (c.type === 'ssp' || c.underlyingLungDisease || c.ventilated || c.type === 'traumatic') {
    rationale.push('Limited reserve favors a monitored intervention rather than observation.')
    return {
      framework: 'BTS 2023',
      disposition: 'chest-drain',
      headline: 'Monitored aspiration or small-bore drain',
      rationale,
    }
  }

  // PSP: symptom- and preference-driven, NOT size
  if (c.symptomBurden === 'minimal') {
    rationale.push('BTS de-emphasizes size: a stable, minimally symptomatic PSP can be observed.')
    rationale.push('Conservative care is explicitly endorsed when follow-up is reliable.')
    return {
      framework: 'BTS 2023',
      disposition: 'observation',
      headline: 'Conservative management with safety-netting',
      rationale,
    }
  }

  rationale.push('Symptomatic stable PSP suits an ambulatory device or aspiration pathway.')
  return {
    framework: 'BTS 2023',
    disposition: 'ambulatory',
    headline: 'Ambulatory device or aspiration',
    rationale,
  }
}

export function evaluateBothFrameworks(c: PneumothoraxCase): DualFrameworkResult {
  const accp = evaluateAccp(c)
  const bts = evaluateBts(c)
  const agreement = accp.disposition === bts.disposition

  let comparisonNote: string
  if (agreement) {
    comparisonNote =
      'Both frameworks converge here — a good sign the decision is robust regardless of which guideline your institution follows.'
  } else if (accp.disposition === 'aspiration' && bts.disposition === 'observation') {
    comparisonNote =
      'Classic divergence: ACCP leans on size and intervenes, BTS prioritizes symptoms and observes. This is the case to understand.'
  } else if (c.persistentAirLeakDays >= 3 && c.persistentAirLeakDays < 5) {
    comparisonNote =
      'They diverge on timing: ACCP escalates a persistent air leak earlier (3-5 days) than BTS (5-7 days).'
  } else {
    comparisonNote =
      'The frameworks diverge here — note which factor (size vs symptoms vs timing) is driving the difference.'
  }

  return {
    accp,
    bts,
    agreement,
    comparisonNote,
    recurrencePrevention: recurrencePreventionText(c),
  }
}

function recurrencePreventionText(c: PneumothoraxCase): string {
  if (c.highRiskOccupation) {
    return 'High-risk occupation (aviation/diving) lowers the threshold for definitive recurrence prevention in both frameworks.'
  }
  if (c.recurrence !== 'none' || c.type === 'ssp') {
    return 'Recurrence risk is high (SSP up to ~80%, ipsilateral recurrence): discuss pleurodesis or surgery, smoking cessation, and follow-up.'
  }
  return 'First PSP recurrence risk is ~30%: counsel on smoking cessation, follow-up, and return precautions.'
}
