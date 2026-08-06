/**
 * Bibliographic provenance for the filling-pressure congestion material.
 *
 * These three papers are not in `docs/critical-care/source-manifest.json` and are not in
 * `mcsSources`, and both of those absences are deliberate rather than accidental.
 *
 * The manifest is a shared file this package does not own. `mcsSources` is MCS-owned, but its
 * `sourceType` union lives in `engine/types.ts`, which this package may not modify, and that union
 * has no member that describes a peer-reviewed cohort study or a registry analysis: the closest
 * members are `guideline` and `reference-package`, and calling Ortega-Hernández or Garan either of
 * those would be a false claim about what kind of evidence it is. Rather than round a study into the
 * nearest wrong box, the records live here with an accurate kind of their own, and the serialized
 * follow-up is recorded in `docs/critical-care/mcs-live-teaching-panels.md`.
 *
 * The same reasoning applies one level up, to the reference kinds the shared evidence renderers use.
 * `CriticalCareValueReferenceKind` has `guideline-recommendation` and `cohort-observation` and
 * nothing between them. The ACC document states in its own preface that Concise Clinical Guidance is
 * transitional guidance issued *before* the evidence required for an expert consensus decision
 * pathway or a clinical practice guideline, so rendering it under a badge reading "Guideline
 * recommendation" would overstate it. The congestion material therefore prints its own source kind
 * in words instead of borrowing that vocabulary.
 */

/** What kind of evidence a congestion-framework source is. Spelled out wherever it is shown. */
export type McsClinicalSourceKind =
  | 'expert-consensus-statement'
  | 'single-center-retrospective-cohort'
  | 'multicenter-registry-analysis'

export const mcsClinicalSourceKindLabels: Readonly<Record<McsClinicalSourceKind, string>> =
  Object.freeze({
    'expert-consensus-statement': 'Expert consensus statement',
    'single-center-retrospective-cohort': 'Single-center retrospective cohort study',
    'multicenter-registry-analysis': 'Multicenter registry analysis',
  })

export interface McsClinicalSourceRecord {
  readonly id: string
  readonly kind: McsClinicalSourceKind
  readonly title: string
  readonly authors: string
  readonly journal: string
  readonly year: number
  /** The concise citation shown beside the record. */
  readonly citation: string
  /** Where inside the source the claim comes from. */
  readonly locator: string
  /** The population the source studied or addressed. */
  readonly population: string
  /** The condition under which the source's statement applies. */
  readonly appliesWhen: string
  /** What the source does not support, stated wherever it is cited. */
  readonly doNotInfer: string
}

export const MCS_ACC_CONSENSUS_SOURCE_ID = 'acc-cs-concise-clinical-guidance-2025'
export const MCS_ORTEGA_COHORT_SOURCE_ID = 'ortega-hernandez-ami-cs-congestion-2023'
export const MCS_GARAN_COMPLETE_PROFILE_SOURCE_ID = 'garan-cswg-complete-pac-profile-2020'

export const mcsCongestionSources: readonly McsClinicalSourceRecord[] = Object.freeze([
  {
    id: MCS_ACC_CONSENSUS_SOURCE_ID,
    kind: 'expert-consensus-statement',
    title:
      '2025 Concise Clinical Guidance: An ACC Expert Consensus Statement on the Evaluation and Management of Cardiogenic Shock',
    authors: 'Sinha SS, Morrow DA, Kapur NK, Kataria R, Roswell RO',
    journal: 'Journal of the American College of Cardiology',
    year: 2025,
    citation: 'Sinha SS, et al. J Am Coll Cardiol. 2025;85(16):1618–1641.',
    locator: 'Section 4.4, Invasive Hemodynamics, pages 1626–1627',
    population: 'Cardiogenic shock broadly, including both AMI-CS and heart-failure-related CS.',
    appliesWhen:
      'Reading invasive hemodynamics to characterize a congestion profile in cardiogenic shock, alongside imaging and the rest of the clinical picture.',
    doNotInfer:
      'This is expert consensus integrating the best available evidence. It is not a validated treatment algorithm, it does not select a support device, and it does not replace clinical judgment.',
  },
  {
    id: MCS_ORTEGA_COHORT_SOURCE_ID,
    kind: 'single-center-retrospective-cohort',
    title:
      'Dynamic Invasive Hemodynamic Congestion Profile Impacts Acute Myocardial Infarction Complicated by Cardiogenic Shock Outcomes: A Real-World Single-Center Study',
    authors: 'Ortega-Hernández JA, González-Pacheco H, Gopar-Nieto R, et al.',
    journal: 'Journal of Cardiac Failure',
    year: 2023,
    citation: 'Ortega-Hernández JA, et al. J Card Fail. 2023;29(5):745–756.',
    locator: 'Hemodynamic Congestion, methods page 746, and the serial-profile results',
    population:
      '295 patients with AMI-CS and a pulmonary artery catheter at one center, 2006–2021, reviewed retrospectively.',
    appliesWhen:
      'Reading the cut points this study used to sort its own cohort into four congestion profiles, and the outcomes it associated with them over the first 24 hours.',
    doNotInfer:
      'These are cohort operational definitions and prognostic associations in one single-center AMI-CS population. They are not universal thresholds, not treatment targets, and not a definition of ventricular failure.',
  },
  {
    id: MCS_GARAN_COMPLETE_PROFILE_SOURCE_ID,
    kind: 'multicenter-registry-analysis',
    title:
      'Complete Hemodynamic Profiling With Pulmonary Artery Catheters in Cardiogenic Shock Is Associated With Lower In-Hospital Mortality',
    authors: 'Garan AR, Kanwar M, Thayer KL, et al.',
    journal: 'JACC: Heart Failure',
    year: 2020,
    citation: 'Garan AR, et al. JACC Heart Fail. 2020;8(11):903–913.',
    locator: 'Classification of PAC Usage, page 905, and the Discussion',
    population:
      '1,414 patients with cardiogenic shock across eight tertiary centers in the Cardiogenic Shock Working Group registry, 2016–2019.',
    appliesWhen:
      'Asking what a complete invasive hemodynamic profile contains, and what a partial one leaves unanswered.',
    doNotInfer:
      'This study defines what counts as a complete profile. It publishes no filling-pressure cut point, and it does not say what any individual value means.',
  },
])

export const mcsCongestionSourceById: ReadonlyMap<string, McsClinicalSourceRecord> = new Map(
  mcsCongestionSources.map((source) => [source.id, source]),
)

/**
 * Resolve an evidence id, loudly.
 *
 * An unresolvable id would render as a missing citation — which reads exactly like an unsourced
 * claim — so this throws at the call site rather than returning undefined.
 */
export function mcsCongestionSource(id: string): McsClinicalSourceRecord {
  const record = mcsCongestionSourceById.get(id)
  if (!record) throw new Error(`No MCS congestion source registered for ${id}`)
  return record
}

function validateCongestionSources(): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const source of mcsCongestionSources) {
    if (seen.has(source.id)) errors.push(`duplicate congestion source id: ${source.id}`)
    seen.add(source.id)
    for (const field of [
      'title',
      'authors',
      'journal',
      'citation',
      'locator',
      'population',
      'appliesWhen',
      'doNotInfer',
    ] as const) {
      if (!String(source[field] ?? '').trim()) {
        errors.push(`${source.id}: ${field} is empty`)
      }
    }
    if (!mcsClinicalSourceKindLabels[source.kind]) {
      errors.push(`${source.id}: no label for source kind ${source.kind}`)
    }
    if (!Number.isInteger(source.year) || source.year < 1900) {
      errors.push(`${source.id}: implausible year ${source.year}`)
    }
  }
  return errors
}

const congestionSourceErrors = validateCongestionSources()
if (congestionSourceErrors.length > 0) {
  throw new Error(`Invalid MCS congestion sources:\n- ${congestionSourceErrors.join('\n- ')}`)
}
