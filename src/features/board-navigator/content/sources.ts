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
  {
    id: 'mist1-2005',
    kind: 'trial',
    citation:
      'Maskell NA, Davies CWH, Nunn AJ, et al. U.K. controlled trial of intrapleural streptokinase for pleural infection. N Engl J Med. 2005;352(9):865-874.',
    year: 2005,
  },
  {
    id: 'mist1-tube-size-2010',
    kind: 'primary-study',
    citation:
      'Rahman NM, Maskell NA, Davies CWH, et al. The relationship between chest tube size and clinical outcome in pleural infection. Chest. 2010;137(3):536-543.',
    year: 2010,
  },
  {
    id: 'time1-2015',
    kind: 'trial',
    citation:
      'Rahman NM, Pepperell J, Rehal S, et al. Effect of opioids vs NSAIDs and larger vs smaller chest tube size on pain control and pleurodesis efficacy among patients with malignant pleural effusion: the TIME1 randomized clinical trial. JAMA. 2015;314(24):2641-2653.',
    year: 2015,
  },
  {
    id: 'ample-2017',
    kind: 'trial',
    citation:
      'Thomas R, Fysh ETH, Smith NA, et al. Effect of an indwelling pleural catheter vs talc pleurodesis on hospitalization days in patients with malignant pleural effusion: the AMPLE randomized clinical trial. JAMA. 2017;318(19):1903-1912.',
    year: 2017,
  },
  {
    id: 'tapps-2020',
    kind: 'trial',
    citation:
      'Bhatnagar R, Piotrowska HEG, Laskawiec-Szkonter M, et al. Effect of thoracoscopic talc poudrage vs talc slurry via chest tube on pleurodesis failure rate among patients with malignant pleural effusions: a randomized clinical trial. JAMA. 2020;323(1):60-69.',
    year: 2020,
  },
  {
    id: 'puri-cost-2012',
    kind: 'primary-study',
    citation:
      'Puri V, Pyrdeck TL, Crabtree TD, et al. Treatment of malignant pleural effusion: a cost-effectiveness analysis. Ann Thorac Surg. 2012;94(2):374-380.',
    year: 2012,
  },
  {
    id: 'lent-2014',
    kind: 'primary-study',
    citation:
      'Clive AO, Kahan BC, Hooper CE, et al. Predicting survival in malignant pleural effusion: development and validation of the LENT prognostic score. Thorax. 2014;69(12):1098-1104.',
    year: 2014,
  },
  {
    id: 'rapid-2014',
    kind: 'primary-study',
    citation:
      'Rahman NM, Kahan BC, Miller RF, Gleeson FV, Nunn AJ, Maskell NA. A clinical score (RAPID) to identify those at risk for poor outcome at presentation in patients with pleural infection. Chest. 2014;145(4):848-855.',
    year: 2014,
  },
  {
    id: 'fysh-ipc-infection-2013',
    kind: 'primary-study',
    citation:
      'Fysh ETH, Tremblay A, Feller-Kopman D, et al. Clinical outcomes of indwelling pleural catheter-related pleural infections: an international multicenter study. Chest. 2013;144(5):1597-1602.',
    year: 2013,
  },
  {
    id: 'shojaee-hepatic-hydrothorax-2019',
    kind: 'primary-study',
    citation:
      'Shojaee S, Rahman N, Haas K, et al. Indwelling tunneled pleural catheters for refractory hepatic hydrothorax in patients with cirrhosis: a multicenter study. Chest. 2019;155(3):546-553.',
    year: 2019,
  },
  {
    id: 'chaddha-consensus-2021',
    kind: 'consensus',
    citation:
      'Chaddha U, Agrawal A, Feller-Kopman D, et al. Use of fibrinolytics and deoxyribonuclease in adult patients with pleural empyema: a consensus statement. Lancet Respir Med. 2021;9(9):1050-1064.',
    year: 2021,
  },
  {
    id: 'hibbert-thrombocytopenia-2013',
    kind: 'primary-study',
    citation:
      'Hibbert RM, Atwell TD, Lekah A, et al. Safety of ultrasound-guided thoracentesis in patients with abnormal preprocedural coagulation parameters. Chest. 2013;144(2):456-463.',
    year: 2013,
  },
  {
    id: 'accp-pneumothorax-2001',
    kind: 'consensus',
    citation:
      'Baumann MH, Strange C, Heffner JE, et al. Management of spontaneous pneumothorax: an American College of Chest Physicians Delphi consensus statement. Chest. 2001;119(2):590-602.',
    year: 2001,
  },
  {
    id: 'bts-pneumothorax-2010',
    kind: 'guideline',
    citation:
      'MacDuff A, Arnold A, Harvey J; BTS Pleural Disease Guideline Group. Management of spontaneous pneumothorax: British Thoracic Society pleural disease guideline 2010. Thorax. 2010;65(Suppl 2):ii18-ii31.',
    year: 2010,
  },
  {
    id: 'herth-ctbna-ebus-2004',
    kind: 'trial',
    citation:
      'Herth F, Becker HD, Ernst A. Conventional vs endobronchial ultrasound-guided transbronchial needle aspiration: a randomized trial. Chest. 2004;125(1):322-325.',
    year: 2004,
  },
  {
    id: 'lee-passes-2008',
    kind: 'primary-study',
    citation:
      'Lee HS, Lee GK, Lee HS, et al. Real-time endobronchial ultrasound-guided transbronchial needle aspiration in mediastinal staging of non-small cell lung cancer: how many aspirations per target lymph node station? Chest. 2008;134(2):368-374.',
    year: 2008,
  },
  {
    id: 'labarca-molecular-adequacy-2018',
    kind: 'primary-study',
    citation:
      'Labarca G, Folch E, Jantz M, Mehta HJ, Majid A, Fernandez-Bussy S. Adequacy of samples obtained by endobronchial ultrasound with transbronchial needle aspiration for molecular analysis in patients with non-small cell lung cancer: systematic review and meta-analysis. Ann Am Thorac Soc. 2018;15(10):1205-1216.',
    year: 2018,
  },
  {
    id: 'tnm8-detterbeck-2017',
    kind: 'consensus',
    citation:
      'Detterbeck FC, Boffa DJ, Kim AW, Tanoue LT. The eighth edition lung cancer stage classification. Chest. 2017;151(1):193-203.',
    year: 2017,
  },
  {
    id: 'cap-iaslc-amp-molecular-2018',
    kind: 'guideline',
    citation:
      'Lindeman NI, Cagle PT, Aisner DL, et al. Updated molecular testing guideline for the selection of lung cancer patients for treatment with targeted tyrosine kinase inhibitors: guideline from the College of American Pathologists, the International Association for the Study of Lung Cancer, and the Association for Molecular Pathology. Arch Pathol Lab Med. 2018;142(3):321-346.',
    year: 2018,
  },
  {
    id: 'yarmus-needle-gauge-2013',
    kind: 'trial',
    citation:
      'Yarmus LB, Akulian J, Lechtzin N, et al. Comparison of 21-gauge and 22-gauge aspiration needle in endobronchial ultrasound-guided transbronchial needle aspiration: results of the American College of Chest Physicians Quality Improvement Registry, Education, and Evaluation registry. Chest. 2013;143(4):1036-1043.',
    year: 2013,
  },
  {
    id: 'yarmus-molecular-passes-2013',
    kind: 'primary-study',
    citation:
      'Yarmus L, Akulian J, Gilbert C, et al. Optimizing endobronchial ultrasound for molecular analysis. How many passes are needed? Ann Am Thorac Soc. 2013;10(6):636-643.',
    year: 2013,
  },
  {
    id: 'casal-suction-2012',
    kind: 'trial',
    citation:
      'Casal RF, Staerkel GA, Ost D, et al. Randomized clinical trial of endobronchial ultrasound needle biopsy with and without aspiration. Chest. 2012;142(3):568-573.',
    year: 2012,
  },
  {
    id: 'sehgal-rose-meta-2018',
    kind: 'primary-study',
    citation:
      'Sehgal IS, Dhooria S, Aggarwal AN, Agarwal R. Impact of rapid on-site cytological evaluation (ROSE) on the diagnostic yield of transbronchial needle aspiration during mediastinal lymph node sampling: systematic review and meta-analysis. Chest. 2018;153(4):929-938.',
    year: 2018,
  },
  {
    id: 'trisolini-rose-genotyping-2015',
    kind: 'trial',
    citation:
      'Trisolini R, Cancellieri A, Tinelli C, et al. Randomized trial of endobronchial ultrasound-guided transbronchial needle aspiration with and without rapid on-site evaluation for lung cancer genotyping. Chest. 2015;148(6):1430-1437.',
    year: 2015,
  },
  {
    id: 'gupta-sarcoid-ebus-2014',
    kind: 'trial',
    citation:
      'Gupta D, Dadhwal DS, Agarwal R, Gupta N, Bal A, Aggarwal AN. Endobronchial ultrasound-guided transbronchial needle aspiration vs conventional transbronchial needle aspiration in the diagnosis of sarcoidosis. Chest. 2014;146(3):547-556.',
    year: 2014,
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
