/**
 * The Navigator's source registry: every reference an objective, a rationale or a teaching number
 * cites. A citation names a source by id; the tests refuse an id that is not registered here, so a
 * reference cannot be invented in copy.
 */
export type NavigatorSourceKind =
  | 'blueprint'
  | 'guideline'
  | 'consensus'
  | 'trial'
  | 'primary-study'
  | 'review'
  | 'regulatory'
  | 'society-resource'

export interface NavigatorSource {
  readonly id: string
  readonly kind: NavigatorSourceKind
  readonly citation: string
  readonly year: number
  readonly url?: string
}

export const NAVIGATOR_SOURCES: readonly NavigatorSource[] = [
  {
    id: 'aabip-blueprint-2024',
    kind: 'blueprint',
    citation:
      'American Association for Bronchology and Interventional Pulmonology. Interventional Pulmonology Board Certification Examination Content (blueprint), 2024.',
    year: 2024,
    url: 'https://www.aabronchology.org/assets/IP_BOARDS/IP%20Board%20Exam%20Blueprint%202024.pdf',
  },
  {
    id: 'aabip-ipass',
    kind: 'society-resource',
    citation:
      'American Association for Bronchology and Interventional Pulmonology. iPASS: board-style question practice (official app description).',
    year: 2026,
    url: 'https://aabip.memberclicks.net/ipass-ipf',
  },
  {
    id: 'iaslc-node-map-2009',
    kind: 'consensus',
    citation:
      'Rusch VW, Asamura H, Watanabe H, et al. The IASLC Lung Cancer Staging Project: a proposal for a new international lymph node map in the forthcoming seventh edition of the TNM classification for lung cancer. J Thorac Oncol. 2009;4(5):568-577.',
    year: 2009,
  },
  {
    id: 'tnm9-n-descriptors-2024',
    kind: 'consensus',
    citation:
      'Huang J, Osarogiagbon RU, Giroux DJ, et al. The IASLC Lung Cancer Staging Project: proposals for the revision of the N descriptors in the forthcoming ninth edition of the TNM classification for lung cancer. J Thorac Oncol. 2024;19(5):749-765.',
    year: 2024,
  },
  {
    id: 'accp-staging-2013',
    kind: 'guideline',
    citation:
      'Silvestri GA, Gonzalez AV, Jantz MA, et al. Methods for staging non-small cell lung cancer: diagnosis and management of lung cancer, 3rd ed: American College of Chest Physicians evidence-based clinical practice guidelines. Chest. 2013;143(5 Suppl):e211S-e250S.',
    year: 2013,
  },
  {
    id: 'ers-esge-ests-ebus-2015',
    kind: 'guideline',
    citation:
      'Vilmann P, Clementsen PF, Colella S, et al. Combined endobronchial and esophageal endosonography for the diagnosis and staging of lung cancer: European Society of Gastrointestinal Endoscopy (ESGE) guideline, in cooperation with the European Respiratory Society (ERS) and the European Society of Thoracic Surgeons (ESTS). Endoscopy. 2015;47(6):545-559.',
    year: 2015,
  },
  {
    id: 'fujiwara-2010',
    kind: 'primary-study',
    citation:
      'Fujiwara T, Yasufuku K, Nakajima T, et al. The utility of sonographic features during endobronchial ultrasound-guided transbronchial needle aspiration for lymph node staging in patients with lung cancer: a standard endobronchial ultrasound image classification system. Chest. 2010;138(3):641-647.',
    year: 2010,
  },
  {
    id: 'light-1972',
    kind: 'primary-study',
    citation:
      'Light RW, Macgregor MI, Luchsinger PC, Ball WC Jr. Pleural effusions: the diagnostic separation of transudates and exudates. Ann Intern Med. 1972;77(4):507-513.',
    year: 1972,
  },
  {
    id: 'bts-investigation-2010',
    kind: 'guideline',
    citation:
      'Hooper C, Lee YCG, Maskell N; BTS Pleural Guideline Group. Investigation of a unilateral pleural effusion in adults: British Thoracic Society pleural disease guideline 2010. Thorax. 2010;65(Suppl 2):ii4-ii17.',
    year: 2010,
  },
  {
    id: 'bts-pleural-2023',
    kind: 'guideline',
    citation:
      'Roberts ME, Rahman NM, Maskell NA, et al. British Thoracic Society guideline for pleural disease. Thorax. 2023;78(Suppl 3):s1-s42.',
    year: 2023,
  },
  {
    id: 'mist2-2011',
    kind: 'trial',
    citation:
      'Rahman NM, Maskell NA, West A, et al. Intrapleural use of tissue plasminogen activator and DNase in pleural infection. N Engl J Med. 2011;365(6):518-526.',
    year: 2011,
  },
  {
    id: 'ats-mpe-2018',
    kind: 'guideline',
    citation:
      'Feller-Kopman DJ, Reddy CB, DeCamp MM, et al. Management of malignant pleural effusions: an official ATS/STS/STR clinical practice guideline. Am J Respir Crit Care Med. 2018;198(7):839-849.',
    year: 2018,
  },
  {
    id: 'time2-2012',
    kind: 'trial',
    citation:
      'Davies HE, Mishra EK, Kahan BC, et al. Effect of an indwelling pleural catheter vs chest tube and talc pleurodesis for relieving dyspnea in patients with malignant pleural effusion: the TIME2 randomized controlled trial. JAMA. 2012;307(22):2383-2389.',
    year: 2012,
  },
  {
    id: 'lan-1997',
    kind: 'primary-study',
    citation:
      'Lan RS, Lo SK, Chuang ML, Yang CT, Tsao TC, Lee CH. Elastance of the pleural space: a predictor for the outcome of pleurodesis in patients with malignant pleural effusion. Ann Intern Med. 1997;126(10):768-774.',
    year: 1997,
  },
  {
    id: 'brown-psp-2020',
    kind: 'trial',
    citation:
      'Brown SGA, Ball EL, Perrin K, et al. Conservative versus interventional treatment for spontaneous pneumothorax. N Engl J Med. 2020;382(5):405-415.',
    year: 2020,
  },
  {
    id: 'fda-metal-stents-2005',
    kind: 'regulatory',
    citation:
      'U.S. Food and Drug Administration. FDA public health notification: complications from metallic tracheal stents in patients with benign airway disorders. July 29, 2005.',
    year: 2005,
  },
  {
    id: 'ernst-cao-2004',
    kind: 'review',
    citation:
      'Ernst A, Feller-Kopman D, Becker HD, Mehta AC. Central airway obstruction. Am J Respir Crit Care Med. 2004;169(12):1278-1297.',
    year: 2004,
  },
  {
    id: 'accp-ip-procedures-2003',
    kind: 'guideline',
    citation:
      'Ernst A, Silvestri GA, Johnstone D; American College of Chest Physicians. Interventional pulmonary procedures: guidelines from the American College of Chest Physicians. Chest. 2003;123(5):1693-1717.',
    year: 2003,
  },
  {
    id: 'ers-ats-ip-statement-2002',
    kind: 'consensus',
    citation:
      'Bolliger CT, Mathur PN, Beamis JF, et al. ERS/ATS statement on interventional pulmonology. Eur Respir J. 2002;19(2):356-373.',
    year: 2002,
  },
  {
    id: 'freitag-stenosis-2007',
    kind: 'consensus',
    citation:
      'Freitag L, Ernst A, Unger M, Kovitz K, Marquette CH. A proposed classification system of central airway stenosis. Eur Respir J. 2007;30(1):7-12.',
    year: 2007,
  },
] as const

export type NavigatorSourceId = (typeof NAVIGATOR_SOURCES)[number]['id']

export const NAVIGATOR_SOURCE_IDS: ReadonlySet<string> = new Set(
  NAVIGATOR_SOURCES.map((source) => source.id),
)

const byId = new Map<string, NavigatorSource>(
  NAVIGATOR_SOURCES.map((source) => [source.id, source]),
)

/** The source, or a thrown error naming the id: a typo fails the build, not the learner. */
export function navigatorSource(id: NavigatorSourceId): NavigatorSource {
  const source = byId.get(id)
  if (!source) throw new Error(`board-navigator: no source "${id}"`)
  return source
}
