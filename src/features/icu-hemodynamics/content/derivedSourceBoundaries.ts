/**
 * What the registered sources actually support for H5, and how far each claim was verified.
 *
 * H4 established the three-level distinction — a source id resolves, a registered claim text covers
 * a topic, a statement was checked against source text at a locator — and could honestly claim only
 * the second, because no supplied document was found. During H5 the supplied hemodynamics reference
 * workspace was located and several registered documents were read directly, so this file carries
 * per-topic depth rather than one module-wide level. A topic is marked
 * `source-text-and-locator-verified` only where the underlying document was actually read against
 * the claim during H5 authoring, with the locator recorded beside it. The documents themselves
 * remain outside this repository, and nothing here changes that.
 */

import { hemodynamicsSourceById } from './sources'

/* ------------------------------------------------------------------ *
 * Claim topics
 * ------------------------------------------------------------------ */

export const DERIVED_CLAIM_TOPICS = [
  /* Topics a registered record's claim text covers. */
  'derived-variable-formulas',
  'derived-interpretation-limits',
  'resistance-unit-conventions',
  'adult-reference-intervals',
  'ph-hemodynamic-definition',
  'papi-phenotype-context',
  'cpo-formula-and-risk-context',
  'pa-compliance-cohort-distribution',
  'ppv-conditional-threshold',
  'flow-method-provenance',
  'educational-model-boundary',
  /**
   * Deliberately unmapped. No registered record's claim text names any of these, so a statement
   * needing one is a source gap by construction and stays one until the source set is expanded.
   */
  'bsa-estimating-formula',
  'universal-derived-normal-ranges',
  'small-denominator-numeric-criterion',
  'derived-value-treatment-targets',
] as const

export type DerivedClaimTopic = (typeof DERIVED_CLAIM_TOPICS)[number]

/**
 * Source id → the topics that record's own registered `intendedUse` covers.
 *
 * Each entry quotes the phrase from `sources.ts` it was read off, so a reviewer can re-run the
 * audit against the registry without reading this file's reasoning.
 */
const claimTopicsBySourceId: ReadonlyMap<string, readonly DerivedClaimTopic[]> = new Map([
  // "Thermodilution, derived hemodynamics, interpretation limits, and technical validation."
  [
    'pac-derived-part-2-2021',
    [
      'derived-variable-formulas',
      'derived-interpretation-limits',
      'resistance-unit-conventions',
      'adult-reference-intervals',
      'papi-phenotype-context',
      'flow-method-provenance',
    ] as const,
  ],
  // "Current hemodynamic definition of pulmonary hypertension, pre-capillary physiology,
  //  direct-Fick versus thermodilution method framing ... and PVR calculation."
  [
    'esc-ers-ph-2022',
    ['ph-hemodynamic-definition', 'derived-variable-formulas', 'flow-method-provenance'] as const,
  ],
  // "Derivation and context-specific interpretation of PAPi, including the ... cut point in acute
  //  inferior myocardial infarction with suspected RV dysfunction."
  ['papi-rvmi-2012', ['papi-phenotype-context'] as const],
  // "Cardiac-power-output formula and the high-risk context of values around or below ... W in
  //  acute cardiac disease and cardiogenic shock."
  ['cpo-acute-cardiac-2007', ['cpo-formula-and-risk-context'] as const],
  // "Contemporary distribution and directional interpretation of PA compliance across a broad
  //  right-heart-catheterization cohort."
  ['pa-compliance-outcomes-2026', ['pa-compliance-cohort-distribution'] as const],
  // "Origin and conditional interpretation of the PPV threshold near ... during controlled
  //  mechanical ventilation."
  ['ppv-sepsis-2000', ['ppv-conditional-threshold'] as const],
  // "Links ventricular loading, vascular resistance/compliance, volume, PEEP, and signal-system
  //  effects to coherent simulated trends."
  ['icu-hemodynamics-model-v1', ['educational-model-boundary'] as const],
])

/** True only when the record resolves *and* its registered claim text covers the topic. */
export function derivedSourceSupportsClaim(sourceId: string, topic: DerivedClaimTopic): boolean {
  if (!hemodynamicsSourceById.has(sourceId)) return false
  return (claimTopicsBySourceId.get(sourceId) ?? []).includes(topic)
}

/** Every registered record whose claim covers the topic. Empty means the source set has a gap. */
export function derivedSourcesSupportingClaim(topic: DerivedClaimTopic): readonly string[] {
  return [...claimTopicsBySourceId]
    .filter(([, topics]) => topics.includes(topic))
    .map(([id]) => id)
    .sort()
}

/** The topics no registered record supports. These are H5's declared source gaps. */
export function derivedUnsupportedClaimTopics(): readonly DerivedClaimTopic[] {
  return DERIVED_CLAIM_TOPICS.filter((topic) => derivedSourcesSupportingClaim(topic).length === 0)
}

/* ------------------------------------------------------------------ *
 * Verification depth — per topic, with locators where text was read
 * ------------------------------------------------------------------ */

export type DerivedVerificationDepth =
  | 'registry-membership-only'
  | 'claim-text-audited'
  | 'source-text-and-locator-verified'

export interface DerivedClaimVerification {
  readonly topic: DerivedClaimTopic
  readonly depth: DerivedVerificationDepth
  /** Present exactly when depth is source-text-and-locator-verified. */
  readonly locator: string | null
  /** What was actually checked, in one sentence a reviewer can re-run. */
  readonly whatWasVerified: string
}

const PART2 =
  'Bootsma et al., J Clin Monit Comput 2022;36:17–31 (supplied document, read 2026-08-10)'

/**
 * The per-topic record of how far H5 verification actually went.
 *
 * `source-text-and-locator-verified` appears only for claims read against the supplied Bootsma
 * Part 2 text during H5 authoring. The PAPi, CPO, PPV, and PA-compliance primary papers and the
 * full ESC/ERS guideline text were not present in any project source location, so their topics stay
 * at claim-text depth even where Part 2 corroborates the surrounding framing.
 */
export const derivedClaimVerifications: readonly DerivedClaimVerification[] = Object.freeze([
  {
    topic: 'derived-variable-formulas',
    depth: 'source-text-and-locator-verified',
    locator: `${PART2}, Table 1, p. 18`,
    whatWasVerified:
      'CO = HR × SV/1000, CI = CO/BSA, SV = CO/HR × 1000, SVi = CI/HR × 1000, SVR = 80 × (MAP − CVP)/CO, PVR = 80 × (MPAP − PAWP)/CO, PAPi = (PASP − PADP)/CVP, and CPI = (MAP − CVP) × CI/451 as tabulated equations.',
  },
  {
    topic: 'resistance-unit-conventions',
    depth: 'source-text-and-locator-verified',
    locator: `${PART2}, Table 1, p. 18`,
    whatWasVerified:
      'Resistance reported in dyn·s·cm⁻⁵ with the ×80 factor from mmHg·min/L; the module states both unit forms with that conversion.',
  },
  {
    topic: 'adult-reference-intervals',
    depth: 'source-text-and-locator-verified',
    locator: `${PART2}, Table 1, p. 18`,
    whatWasVerified:
      'CI 2.5–4.0 L/min/m², SV 60–100 mL, SVi 33–47 mL/m², SVR 800–1200 dyn·s·cm⁻⁵ as tabulated adult reference figures, with PAPi and CPI marked population-specific rather than given intervals.',
  },
  {
    topic: 'papi-phenotype-context',
    depth: 'source-text-and-locator-verified',
    locator: `${PART2}, §7.2, p. 24 and Table 1, p. 18`,
    whatWasVerified:
      'PAPi defined as (systolic PAP − diastolic PAP)/CVP, with the statement that PAPi measurements and thresholds vary significantly between populations and thresholds from one population should not be extrapolated to another. The Korabathina 2012 cohort paper itself was not available, so the 0.9 figure stays at claim-text depth via the registry.',
  },
  {
    topic: 'ph-hemodynamic-definition',
    depth: 'source-text-and-locator-verified',
    locator: `${PART2}, §7.6, pp. 25–26`,
    whatWasVerified:
      'mPAP above 20 mmHg as the updated resting definition and PAWP at or below 15 mmHg distinguishing pre-capillary physiology, with the caveat that PAWP ≤ 15 mmHg does not rule out left-heart disease in HFpEF. The full 2022 ESC/ERS guideline document was not available; the 2-WU PVR component stays at claim-text depth via the registry.',
  },
  {
    topic: 'flow-method-provenance',
    depth: 'source-text-and-locator-verified',
    locator: `${PART2}, §3.1, p. 19`,
    whatWasVerified:
      'The direct Fick form CO = VO₂ / (1.34 × Hb × (SaO₂ − SvO₂)) with VO₂ "as directly measured by respirometry", and the statement that the direct technique is technically demanding and rarely used — the basis for keeping measured and assumed oxygen uptake separate downstream.',
  },
  {
    topic: 'derived-interpretation-limits',
    depth: 'source-text-and-locator-verified',
    locator: `${PART2}, §4.2–4.3, pp. 19 and 21`,
    whatWasVerified:
      'Intracardiac shunts falsify thermodilution CO and tricuspid regurgitation is reported with under-, over-, and no effect on CO — supporting fail-closed shunt handling and the refusal to assert a TR bias direction.',
  },
  {
    topic: 'cpo-formula-and-risk-context',
    depth: 'claim-text-audited',
    locator: null,
    whatWasVerified:
      'The registry claim for cpo-acute-cardiac-2007 covers the MAP × CO/451 formula and the cohort risk context; the Mendoza 2007 paper itself was not available. Part 2 (Table 1, p. 18; §7.9, p. 26) was read and carries the indexed (MAP − CVP) × CI/451 variant marked population-specific, which is why the module names its convention explicitly.',
  },
  {
    topic: 'pa-compliance-cohort-distribution',
    depth: 'claim-text-audited',
    locator: null,
    whatWasVerified:
      'The registry claim for pa-compliance-outcomes-2026 covers the cohort distribution and directional interpretation; the Mounsey 2026 paper was not available in any project source location.',
  },
  {
    topic: 'ppv-conditional-threshold',
    depth: 'claim-text-audited',
    locator: null,
    whatWasVerified:
      'The registry claim for ppv-sepsis-2000 covers the conditional threshold; the Michard 2000 paper was not available in any project source location.',
  },
  {
    topic: 'educational-model-boundary',
    depth: 'claim-text-audited',
    locator: null,
    whatWasVerified:
      'The module’s own model registration covers simulated trends and alarm boundaries; there is no external document to read.',
  },
  {
    topic: 'bsa-estimating-formula',
    depth: 'registry-membership-only',
    locator: null,
    whatWasVerified:
      'No registered record’s claim names a body-surface-area estimating formula, so this module implements none and treats BSA as a recorded value with provenance.',
  },
  {
    topic: 'universal-derived-normal-ranges',
    depth: 'registry-membership-only',
    locator: null,
    whatWasVerified:
      'No registered record claims universal normal ranges for the derived set; reference intervals are presented as the cited table’s figures, not universal limits.',
  },
  {
    topic: 'small-denominator-numeric-criterion',
    depth: 'registry-membership-only',
    locator: null,
    whatWasVerified:
      'No registered record states a numeric boundary for when a denominator is “too small”, so the module demonstrates sensitivity by perturbation instead of inventing a cutoff.',
  },
  {
    topic: 'derived-value-treatment-targets',
    depth: 'registry-membership-only',
    locator: null,
    whatWasVerified:
      'No registered record supports using any derived boundary here as a treatment target, and the threshold-context validator refuses the classification outright.',
  },
])

export const derivedClaimVerificationByTopic: ReadonlyMap<
  DerivedClaimTopic,
  DerivedClaimVerification
> = new Map(derivedClaimVerifications.map((verification) => [verification.topic, verification]))

export const DERIVED_VERIFICATION_NOTE =
  'Formula, unit, reference-interval, PH-definition, and PAPi-context claims were checked against the supplied Bootsma Part 2 review at the locators recorded in the H5 source boundaries. The PAPi, CPO, PPV, and PA-compliance primary papers and the full ESC/ERS guideline text were not available in any project source location, so those numeric boundaries rest on each record’s registered description. No source document is distributed in this repository, and sentence-level SME review remains open.'

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export function validateDerivedSourceBoundaries(): void {
  for (const [sourceId] of claimTopicsBySourceId) {
    if (!hemodynamicsSourceById.has(sourceId)) {
      throw new Error(`Derived claim-topic map cites an unregistered source: ${sourceId}`)
    }
  }
  const seen = new Set<DerivedClaimTopic>()
  for (const verification of derivedClaimVerifications) {
    if (seen.has(verification.topic)) {
      throw new Error(`Duplicate verification record for topic: ${verification.topic}`)
    }
    seen.add(verification.topic)
    if (
      (verification.depth === 'source-text-and-locator-verified') !==
      (verification.locator !== null)
    ) {
      throw new Error(
        `${verification.topic}: a locator must accompany source-text verification and only source-text verification.`,
      )
    }
    if (verification.whatWasVerified.trim().length < 40) {
      throw new Error(
        `${verification.topic}: the verification record does not say what was checked.`,
      )
    }
    /**
     * A topic no registered claim covers cannot have been verified beyond registry membership —
     * depth above the mapping would claim support the registry does not carry.
     */
    if (
      derivedSourcesSupportingClaim(verification.topic).length === 0 &&
      verification.depth !== 'registry-membership-only'
    ) {
      throw new Error(
        `${verification.topic} is unmapped in the claim-topic table but claims a deeper verification.`,
      )
    }
  }
  for (const topic of DERIVED_CLAIM_TOPICS) {
    if (!seen.has(topic)) {
      throw new Error(`Claim topic ${topic} has no verification record.`)
    }
  }
}

validateDerivedSourceBoundaries()
