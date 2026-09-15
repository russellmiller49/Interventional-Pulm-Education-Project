import { mechanicalVentilationSource } from './schema'
import { ventilatorDeviceSources } from './deviceProfiles'
import type { VentilatorDeviceId } from '../engine/types'

export type VentilationSourceClass =
  | 'manufacturer'
  | 'curriculum'
  | 'clinical-reference'
  | 'educational-model'
  | 'guideline'
  | 'supplied-transcripts'
  | 'modeling-preprint'

/** One learner-facing name per class, shared by every source surface so the names cannot drift. */
export const ventilationSourceClassLabel: Readonly<Record<VentilationSourceClass, string>> = {
  manufacturer: 'Manufacturer source',
  curriculum: 'Supplied case set, author not stated',
  guideline: 'Clinical guideline',
  'clinical-reference': 'Clinical reference',
  'educational-model': 'Teaching model built for this simulation',
  'supplied-transcripts': 'Supplied lecture transcripts, not identified',
  'modeling-preprint': 'Modeling preprint',
}

/**
 * What is known about a source's identity, and how it is known. A document check confirms what a
 * file is; it is not a clinical review of how this module uses the source.
 */
export interface VentilationSourceIdentity {
  readonly status: 'checked-against-supplied-file' | 'as-cited-not-checked' | 'not-identified'
  /** ISO date of the document check, when one was made. */
  readonly checkedOn?: string
  readonly note: string
  /** Another registry record for the same work. */
  readonly sameWorkAs?: string
}

const identityStatusLabel: Readonly<Record<VentilationSourceIdentity['status'], string>> = {
  'checked-against-supplied-file': 'Identity checked against the supplied file',
  'as-cited-not-checked': 'Identity as cited, not checked',
  'not-identified': 'Identity not established',
}

export function ventilationSourceIdentityLine(identity: VentilationSourceIdentity): string {
  const checked = identity.checkedOn ? ` (${identity.checkedOn})` : ''
  return `${identityStatusLabel[identity.status]}${checked}: ${identity.note}`
}

export const VENTILATION_CLINICAL_REVIEW_LINE =
  'Clinical review of how this module uses it: none recorded yet.'

export interface VentilationEvidenceReference {
  id: string
  deviceId?: VentilatorDeviceId
  sourceClass: VentilationSourceClass
  reviewedAt?: string
  title: string
  citation: string
  sourceUrl?: string
  pages?: string
  supports: readonly string[]
  limitations: string
  identity?: VentilationSourceIdentity
}

const TOBIN_3E =
  'In: Tobin MJ, ed. Principles and Practice of Mechanical Ventilation. 3rd ed. McGraw-Hill; 2013.'
const TOBIN_3E_IDENTITY =
  'The 3rd edition’s copyright page gives McGraw-Hill, 2013, with Martin J. Tobin as editor.'

const PREPRINT_LIMITATIONS =
  'A preprint about computational respiratory models, cited by the supplied case set for simulator design. It does not validate this module’s model or its teaching values.'

type CasebookReference = Pick<
  VentilationEvidenceReference,
  'title' | 'sourceClass' | 'limitations'
> & {
  readonly identity: VentilationSourceIdentity
}

/**
 * The eight references printed in the supplied case set, named from the files that could be found.
 * Citation and stated use stay exactly as the case set prints them.
 */
const casebookReferences: Readonly<Record<number, CasebookReference>> = {
  1: {
    title: 'Case-set reference 1: Patient–Ventilator Dyssynchrony',
    sourceClass: 'clinical-reference',
    limitations:
      'The same review as the separately listed Antonogiannaki 2017 record, cited again by the supplied case set. The stated use is the case set’s own description.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: 'Same article as the registered Antonogiannaki 2017 review; the supplied PDF matches the journal, pages and DOI.',
      sameWorkAs: 'antonogiannaki-dyssynchrony-2017',
    },
  },
  2: {
    title: 'Case-set reference 2: Fighting the Ventilator',
    sourceClass: 'clinical-reference',
    limitations:
      'The same chapter as the separately listed Tobin 3rd edition chapter 53 record, cited again by the supplied case set. The stated use is the case set’s own description.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: 'Same chapter as the registered Tobin chapter 53 record; the supplied chapter PDF names the three authors cited.',
      sameWorkAs: 'tobin-3e-fighting-ventilator',
    },
  },
  3: {
    title: 'Case-set reference 3: Psychological Problems in the Ventilated Patient',
    sourceClass: 'clinical-reference',
    limitations:
      'Textbook chapter cited by the supplied case set for patient-centered cases. The stated use is the case set’s own description and has not been checked against the chapter text.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: `The 19-page chapter PDF names Yoanna Skrobik as author of chapter 54. ${TOBIN_3E_IDENTITY}`,
    },
  },
  4: {
    title: 'Case-set reference 4: Addressing Respiratory Discomfort in the Ventilated Patient',
    sourceClass: 'clinical-reference',
    limitations:
      'Textbook chapter cited by the supplied case set for patient-centered cases. The stated use is the case set’s own description and has not been checked against the chapter text.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: `The 26-page chapter PDF names Robert B. Banzett, Thomas Similowski and Robert Brown as authors of chapter 55. ${TOBIN_3E_IDENTITY}`,
    },
  },
  5: {
    title: 'Case-set reference 5: ventilation lecture transcripts (not identified)',
    sourceClass: 'supplied-transcripts',
    limitations:
      'The case set names no speaker, course, date or file, so what these transcripts say cannot be checked. No statement in this module should rest on them alone.',
    identity: {
      status: 'not-identified',
      checkedOn: '2026-09-15',
      note: 'The case set gives only a topic list. A search of the supplied reference folders found no transcript set that matches it.',
    },
  },
  6: {
    title:
      'Case-set reference 6: A Model-Based Approach to Synthetic Data Set Generation for Patient-Ventilator Waveforms for Machine Learning and Educational Use',
    sourceClass: 'modeling-preprint',
    limitations: PREPRINT_LIMITATIONS,
    identity: {
      status: 'as-cited-not-checked',
      note: 'Cited by the case set as arXiv:2103.15684 (2021). No copy is available locally and no link was followed, so authors, version and any later publication were not checked.',
    },
  },
  7: {
    title:
      'Case-set reference 7: Validation of a Computational Respiratory System Model for Mechanical Ventilation',
    sourceClass: 'modeling-preprint',
    limitations: PREPRINT_LIMITATIONS,
    identity: {
      status: 'as-cited-not-checked',
      note: 'Cited by the case set as a 2026 preprint, arXiv:2607.06210. No copy is available locally and no link was followed, so authors, version and any later publication were not checked.',
    },
  },
  8: {
    title:
      'Case-set reference 8: Patient-specific prediction of regional lung mechanics in ARDS patients with physics-based models',
    sourceClass: 'modeling-preprint',
    limitations: PREPRINT_LIMITATIONS,
    identity: {
      status: 'as-cited-not-checked',
      note: 'Cited by the case set as arXiv:2408.14607 (2024). No copy is available locally and no link was followed, so authors, version and any later publication were not checked.',
    },
  },
}

export const ventilationEvidence: readonly VentilationEvidenceReference[] = [
  {
    id: 'aarc-assessment-2024',
    sourceClass: 'guideline',
    reviewedAt: '2026-09-05',
    title: 'AARC Clinical Practice Guideline: Patient–Ventilator Assessment (2024)',
    citation: 'Goodfellow LT, et al. Respir Care. 2024;69:1042–1054. doi:10.4187/respcare.12007.',
    sourceUrl:
      'https://www.aarc.org/wp-content/uploads/2024/10/patient-ventilator-assessment-aarc-cpg.pdf',
    supports: [
      'Assessment of delivered tidal volume using predicted body weight, plateau pressure, PEEP, and auto-PEEP',
      'Direct bedside patient–ventilator assessment',
    ],
    limitations:
      'General adult assessment guidance; individual settings and emergency care require clinical assessment and current local protocols. Source check is not independent clinical sign-off.',
  },
  {
    id: 'ats-ards-2024',
    sourceClass: 'guideline',
    reviewedAt: '2026-09-05',
    title: 'ATS guideline: Management of Adult Patients with ARDS (2024)',
    citation:
      'Qadir N, et al. Am J Respir Crit Care Med. 2024;209:24–36. doi:10.1164/rccm.202311-2011ST.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10870893/',
    supports: [
      'Adult ARDS: tidal volume 4–8 mL/kg predicted body weight and plateau pressure below 30 cmH₂O',
    ],
    limitations:
      'These exact limits are ARDS-scoped guideline recommendations, not a full ventilator prescription or a guarantee against injury. Source check is not independent clinical sign-off.',
  },
  ...ventilatorDeviceSources.map((source) => ({
    id: source.id,
    deviceId: source.deviceId,
    sourceClass: 'manufacturer' as const,
    title: source.title,
    citation: `${source.citation} Source snapshot SHA-256: ${source.sourceSha256}.`,
    pages: source.pages,
    supports: [source.intendedUse],
    limitations: source.limitations,
  })),
  {
    id: 'pb980-operator-manual-pt00101843a00-online',
    deviceId: 'puritan-bennett-980',
    sourceClass: 'manufacturer',
    title: 'Puritan Bennett 980 Series Ventilator Operator’s Manual',
    citation:
      'Covidien. Puritan Bennett 980 Series Ventilator Operator’s Manual. Part PT00101843A00.',
    sourceUrl:
      'https://asiapac.medtronic.com/content/dam/covidien/library/us/en/product/acute-care-ventilation/PuritanBennett980Ventilator_OperatorsManual_en_US_PT00101843A00.pdf',
    pages: 'Mode setup, breath-type descriptions, and technical specifications reviewed online',
    supports: [
      'SIMV with VC, PC, and VC+ mandatory breath types',
      'BiLevel, PAV+, Volume Support, and device-native control vocabulary',
    ],
    limitations:
      'Consulted as an online corroborating source. A revision-locked local snapshot has not yet been archived and hashed, so complete operator-workflow verification remains a publication blocker.',
  },
  {
    id: 'supplied-casebook-2026',
    sourceClass: 'curriculum',
    title: 'Virtual Mechanical Ventilation Simulator Casebook',
    citation:
      'Virtual Mechanical Ventilation Simulator Casebook. Supplied Word document: fifteen cases, simulator design notes and eight references. No author, date or reviewer is stated. The registered JSON case set holds the same fifteen cases and eight references.',
    supports: [
      'Fifteen case scenarios: objectives, starting state, expected and unsafe actions, hint ladders and debriefs',
      'Simulator design notes: physiology state, waveform signatures and the slower timing of blood-gas updates',
    ],
    limitations:
      'A supplied synthesis, not a clinical source or independent validation: its clinical statements need their own sources. Its scoring and examination guidance is not used by this self-paced module. Device-specific settings are normalized through bounded educational profiles and remain draft pending review.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: 'The supplied document names no author, date or reviewer, and its file properties record software rather than a person as its creator.',
    },
  },
  {
    id: 'tobin-3e-setting-ventilator',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Setting the Ventilator',
    citation: `Holets SR, Hubmayr RD. Setting the Ventilator. ${TOBIN_3E} Chapter 5.`,
    pages: 'Supplied chapter PDF, 30 pages',
    supports: [
      'Breath-variable reasoning for ventilator settings',
      'Linking delivered ventilation to mechanics and gas-exchange reassessment',
    ],
    limitations:
      'Textbook chapter supplied by the course author. It supports clinical concepts, not the fidelity of any training-console workflow.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: `The 30-page chapter PDF names Steven R. Holets and Rolf D. Hubmayr. ${TOBIN_3E_IDENTITY}`,
    },
  },
  {
    id: 'tobin-3e-peep',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Positive End-Expiratory Pressure',
    citation: `Navalesi P, Maggiore SM. Positive End-Expiratory Pressure. ${TOBIN_3E} Chapter 10.`,
    pages: 'Supplied chapter PDF, 75 pages',
    supports: [
      'PEEP effects on recruitment and oxygenation',
      'Concurrent pressure and hemodynamic reassessment after a PEEP change',
    ],
    limitations:
      'Textbook chapter supplied by the course author. The lesson uses bounded responses and does not prescribe patient-specific PEEP.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: `The 75-page chapter PDF names Paolo Navalesi and Salvatore Maurizio Maggiore. ${TOBIN_3E_IDENTITY}`,
    },
  },
  {
    id: 'tobin-3e-copd',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Mechanical Ventilation in COPD',
    citation: `Laghi F. Mechanical Ventilation in Chronic Obstructive Pulmonary Disease. ${TOBIN_3E} Chapter 31.`,
    pages: 'Supplied chapter PDF, 33 pages',
    supports: [
      'Expiratory flow limitation, dynamic hyperinflation, and intrinsic PEEP',
      'Hemodynamic consequences of excessive end-inspiratory lung volume',
      'Cycling assessment in pressure support for obstructive physiology',
    ],
    limitations:
      'Textbook chapter supplied by the course author. Quantitative patient response remains an educational approximation.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: `The 33-page chapter PDF names Franco Laghi. ${TOBIN_3E_IDENTITY}`,
    },
  },
  {
    id: 'tobin-3e-monitoring',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Monitoring',
    citation: `Jubran A, Tobin MJ. Monitoring during Mechanical Ventilation. ${TOBIN_3E} Chapter 48.`,
    pages: 'Supplied chapter PDF, 36 pages',
    supports: [
      'Measurement validation and interpretation of airway pressure and flow',
      'Inspiratory and expiratory occlusion measurements',
      'Limitations introduced by timing and signal error',
    ],
    limitations:
      'Textbook chapter supplied by the course author. Monitoring examples do not validate the generated waveform morphology.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: `The 36-page chapter PDF names Amal Jubran and Martin J. Tobin. ${TOBIN_3E_IDENTITY}`,
    },
  },
  {
    id: 'tobin-3e-fighting-ventilator',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Fighting the Ventilator',
    citation: `Tobin MJ, Jubran A, Laghi F. Fighting the Ventilator. ${TOBIN_3E} Chapter 53.`,
    pages: 'Supplied chapter PDF, 37 pages',
    supports: [
      'Concurrent stabilization and mechanism localization during acute deterioration',
      'Peak-to-plateau pressure comparison for resistive versus elastic load',
      'Pressure and flow waveform clues for unmet demand, intrinsic PEEP, and secretions',
    ],
    limitations:
      'Textbook chapter supplied by the course author. Emergency actions remain recognition-and-priority exercises governed by local protocols.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: `The 37-page chapter PDF names Martin J. Tobin, Amal Jubran and Franco Laghi. ${TOBIN_3E_IDENTITY}`,
    },
  },
  {
    id: 'antonogiannaki-dyssynchrony-2017',
    sourceClass: 'clinical-reference',
    title: 'Patient–Ventilator Dyssynchrony',
    citation:
      'Antonogiannaki E-M, Georgopoulos D, Akoumianaki E. Patient–Ventilator Dyssynchrony. Korean J Crit Care Med. 2017;32(4):307-322. doi:10.4266/kjccm.2017.00535.',
    pages: '307-322; supplied article PDF',
    supports: [
      'Trigger, cycling, and assist-magnitude definitions of dyssynchrony',
      'Joint assessment of patient comfort and pressure/flow waveforms',
      'Mechanism-specific setting changes followed by reassessment',
    ],
    limitations:
      'Narrative review. It supports bedside recognition concepts but does not validate automated scoring or synthetic patient response.',
    identity: {
      status: 'checked-against-supplied-file',
      checkedOn: '2026-09-15',
      note: 'The 16-page article PDF prints the three authors, Korean J Crit Care Med 2017;32(4):307–322 and the cited DOI.',
    },
  },
  ...mechanicalVentilationSource.sources.map((source): VentilationEvidenceReference => {
    const reference = casebookReferences[source.id]
    if (!reference) throw new Error(`Unclassified casebook source ${source.id}`)
    return {
      id: `casebook-source-${source.id}`,
      ...reference,
      citation: source.citation,
      supports: [source.use],
    }
  }),
  {
    id: 'bounded-ventilation-model',
    sourceClass: 'educational-model',
    title: 'Bounded patient-ventilator response model',
    citation: 'Original browser-based educational simulation model created for this module.',
    supports: [
      'Deterministic fixed-step waveforms and trigger/target/cycle interactions',
      'Bounded gas-exchange, hemodynamic, comfort, and intervention responses',
      'Seeded repeatable branch variation and regression testing',
      'Simplified SIMV, adaptive pressure, two-level, proportional-assist, volume-support, ASV, INTELLiVENT-ASV, AutoFlow, and IntelliSync+ response adapters',
    ],
    limitations:
      'Not a validated patient digital twin, clinical prediction system, ventilator, or treatment guide. Adaptive and closed-loop behaviors are original bounded teaching approximations and do not reproduce proprietary manufacturer algorithms.',
  },
] as const

export const ventilationEvidenceById = new Map(
  ventilationEvidence.map((reference) => [reference.id, reference]),
)
