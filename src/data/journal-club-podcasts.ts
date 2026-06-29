export const journalClubPodcastHubs = [
  'Landmark Studies',
  'Lung Nodules, Early Lung Cancer & Staging',
  'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
  'Bronchoscopic Ablation & Intratumoral Therapy',
  'Pleural Disease, Thoracoscopy & Chest Drains',
  'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
  'Emphysema, BLVR & Hyperinflation',
  'Training, Procedural Safety & Program Design',
] as const

export const defaultJournalClubPodcastHub = journalClubPodcastHubs[0]

export const podcastLanguages = ['english', 'spanish', 'mandarin', 'arabic', 'korean'] as const

export type JournalClubPodcastHub = (typeof journalClubPodcastHubs)[number]
export type PodcastLanguage = (typeof podcastLanguages)[number]

export interface JournalClubPodcastEpisode {
  id: string
  title: string
  citation: string
  year: number
  journal: string
  primaryHub: JournalClubPodcastHub
  secondaryHubs?: JournalClubPodcastHub[]
  tags: string[]
  synopsis: string
  publicationUrl: string
  audio: Record<PodcastLanguage, string>
}

export const landmarkJournalClubPodcastHub = 'Landmark Studies'
export const landmarkPodcastTag = 'Landmark Study'

function makePodcastAudio(episodeId: string): Record<PodcastLanguage, string> {
  return {
    english: `v1/${episodeId}/english.mp3`,
    mandarin: `v1/${episodeId}/mandarin.mp3`,
    spanish: `v1/${episodeId}/spanish.mp3`,
    arabic: `v1/${episodeId}/arabic.mp3`,
    korean: `v1/${episodeId}/korean.mp3`,
  }
}

export const journalClubPodcastEpisodes = [
  {
    id: 'aabip-lung-cancer-staging',
    title:
      'American Association for Bronchology and Interventional Pulmonology (AABIP) Evidence-Based Guidelines on Bronchoscopic Diagnosis and Staging of Lung Cancer',
    citation:
      'Miller, R. J., et al. (2025). "American Association for Bronchology and Interventional Pulmonology (AABIP) Evidence-Based Guidelines on Bronchoscopic Diagnosis and Staging of Lung Cancer." J Bronchology Interv Pulmonol 32(4).',
    year: 2025,
    journal: 'J Bronchology Interv Pulmonol 32(4).',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: [
      'EBUS',
      'Guideline',
      'Lung Cancer',
      'Lung Nodules',
      'Multidisciplinary Care',
      'Program Development',
      'ROSE',
      'Staging',
      'TTNB',
      'Ultrasound',
    ],
    synopsis:
      'Evidence-based AABIP guidance frames bronchoscopic diagnosis and staging of lung cancer, emphasizing local expertise, patient factors, and evolving technology when choosing sampling and staging strategies.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41024606/',
    audio: {
      english: 'v1/aabip-lung-cancer-staging/english.mp3',
      mandarin: 'v1/aabip-lung-cancer-staging/mandarin.mp3',
      spanish: 'v1/aabip-lung-cancer-staging/spanish.mp3',
      arabic: 'v1/aabip-lung-cancer-staging/arabic.mp3',
      korean: 'v1/aabip-lung-cancer-staging/korean.mp3',
    },
  },
  {
    id: 'pure-ggn-nomogram',
    title:
      'Clinic-radiologic predictors of pathological characteristics in pure ground-glass nodules: Development and validation of a predictive nomogram',
    citation:
      'Zhu, S., et al. (2026). "Clinic-radiologic predictors of pathological characteristics in pure ground-glass nodules: Development and validation of a predictive nomogram." J Thorac Cardiovasc Surg 171(3): 742-753.e717.',
    year: 2026,
    journal: 'J Thorac Cardiovasc Surg 171(3): 742-753.e717.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: ['GGO', 'Lung Cancer', 'Lung Nodules', 'Staging', 'Thoracic Surgery'],
    synopsis:
      'A large surgical pGGN cohort links CT size and density features with invasive pathology and molecular or immune markers, supporting a nomogram to guide surveillance and treatment decisions.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41106472/',
    audio: {
      english: 'v1/pure-ggn-nomogram/english.mp3',
      mandarin: 'v1/pure-ggn-nomogram/mandarin.mp3',
      spanish: 'v1/pure-ggn-nomogram/spanish.mp3',
      arabic: 'v1/pure-ggn-nomogram/arabic.mp3',
      korean: 'v1/pure-ggn-nomogram/korean.mp3',
    },
  },
  {
    id: 'false-n2-upstaging-ebus',
    title:
      'Estimating False Multistation N2 Upstaging From Cross-Contamination During EBUS-TBNA Without ROSE: Insights From a Monte Carlo Analysis',
    citation:
      'Sagar, A. S., et al. (2026). "Estimating False Multistation N2 Upstaging From Cross-Contamination During EBUS-TBNA Without ROSE: Insights From a Monte Carlo Analysis." J Bronchology Interv Pulmonol 33(3).',
    year: 2026,
    journal: 'J Bronchology Interv Pulmonol 33(3).',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: ['EBUS', 'Lung Cancer', 'Lung Nodules', 'ROSE', 'Staging'],
    synopsis:
      'This EBUS-TBNA study evaluates whether changing needles between N2 stations matters when ROSE is unavailable, favoring selective use in higher-risk settings over routine needle changes.',
    publicationUrl: 'https://doi.org/10.1097/LBR.0000000000001070',
    audio: {
      english: 'v1/false-n2-upstaging-ebus/english.mp3',
      mandarin: 'v1/false-n2-upstaging-ebus/mandarin.mp3',
      spanish: 'v1/false-n2-upstaging-ebus/spanish.mp3',
      arabic: 'v1/false-n2-upstaging-ebus/arabic.mp3',
      korean: 'v1/false-n2-upstaging-ebus/korean.mp3',
    },
  },
  {
    id: 'global-ebus-n2-survey',
    title:
      'Global Survey on Current Practices of Endobronchial Ultrasound Approaches to N2 Staging in Non-Small Cell Lung Cancer Following the Ninth Edition of the TNM Classification',
    citation:
      'Kontogianni, K., et al. (2026). "Global Survey on Current Practices of Endobronchial Ultrasound Approaches to N2 Staging in Non-Small Cell Lung Cancer Following the Ninth Edition of the TNM Classification." J Bronchology Interv Pulmonol 33(1).',
    year: 2026,
    journal: 'J Bronchology Interv Pulmonol 33(1).',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: [
      'Airway Stents',
      'Chest Drains',
      'EBUS',
      'Guideline',
      'Lung Cancer',
      'Lung Nodules',
      'Staging',
      'Ultrasound',
    ],
    synopsis:
      'Opinions on implementing TNM-9 are inconsistent, within the IP community, particularly regarding needle change for different N2 stations. Education, reliable data, and consensus guidelines are needed.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41216665/',
    audio: {
      english: 'v1/global-ebus-n2-survey/english.mp3',
      mandarin: 'v1/global-ebus-n2-survey/mandarin.mp3',
      spanish: 'v1/global-ebus-n2-survey/spanish.mp3',
      arabic: 'v1/global-ebus-n2-survey/arabic.mp3',
      korean: 'v1/global-ebus-n2-survey/korean.mp3',
    },
  },
  {
    id: 'navigation-vs-ttnb',
    title: 'Navigational Bronchoscopy or Transthoracic Needle Biopsy for Lung Nodules',
    citation:
      'Lentz, R. J., et al. (2025). "Navigational Bronchoscopy or Transthoracic Needle Biopsy for Lung Nodules." N Engl J Med 392(21): 2100-2112.',
    year: 2025,
    journal: 'N Engl J Med 392(21): 2100-2112.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Lung Cancer',
      'Lung Nodules',
      'Navigation Bronchoscopy',
      'Pneumothorax',
      'Randomized Trial',
      'Screening',
      'Staging',
      'TTNB',
    ],
    synopsis:
      'Randomized comparison of navigational bronchoscopy and transthoracic needle biopsy for lung nodules, useful for discussing diagnostic strategy, yield, and complication tradeoffs.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40387025/',
    audio: {
      english: 'v1/navigation-vs-ttnb/english.mp3',
      mandarin: 'v1/navigation-vs-ttnb/mandarin.mp3',
      spanish: 'v1/navigation-vs-ttnb/spanish.mp3',
      arabic: 'v1/navigation-vs-ttnb/arabic.mp3',
      korean: 'v1/navigation-vs-ttnb/korean.mp3',
    },
  },
  {
    id: 'intrapleural-tissue-plasminogen-activator-2011',
    title: 'Intrapleural Use of Tissue Plasminogen Activator and DNase in Pleural Infection',
    citation:
      'Rahman, N. M., et al. (2011). "Intrapleural Use of Tissue Plasminogen Activator and DNase in Pleural Infection." N Engl J Med 365(6): 518-526.',
    year: 2011,
    journal: 'N Engl J Med 365(6): 518-526.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Chest Drains',
      'Empyema',
      'Pleural Disease',
      'Pleural Infection',
      'Randomized Trial',
    ],
    synopsis:
      'The MIST2 factorial trial established combined intrapleural tPA and DNase as a key medical strategy for pleural infection, improving radiographic clearance and reducing surgical referral compared with either agent alone.',
    publicationUrl: 'https://doi.org/10.1056/NEJMoa1012740',
    audio: makePodcastAudio('intrapleural-tissue-plasminogen-activator-2011'),
  },
  {
    id: 'bronchial-genomic-classifier-diagnostic-2015',
    title: 'A Bronchial Genomic Classifier for the Diagnostic Evaluation of Lung Cancer',
    citation:
      'Silvestri, G. A., et al. (2015). "A Bronchial Genomic Classifier for the Diagnostic Evaluation of Lung Cancer." N Engl J Med 373(3): 243-251.',
    year: 2015,
    journal: 'N Engl J Med 373(3): 243-251.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Bronchoscopy',
      'Diagnostic Yield',
      'Lung Cancer',
      'Molecular Diagnostics',
      'Risk Stratification',
    ],
    synopsis:
      'This AEGIS-derived classifier showed how airway gene-expression testing could refine post-bronchoscopy risk assessment when lung cancer remains suspected after a nondiagnostic procedure.',
    publicationUrl: 'https://doi.org/10.1056/NEJMoa1504601',
    audio: makePodcastAudio('bronchial-genomic-classifier-diagnostic-2015'),
  },
  {
    id: 'endobronchial-ultrasonography-guide-sheath-2004',
    title:
      'Endobronchial Ultrasonography Using a Guide Sheath Increases the Ability to Diagnose Peripheral Pulmonary Lesions Endoscopically',
    citation:
      'Kurimoto, N., et al. (2004). "Endobronchial Ultrasonography Using a Guide Sheath Increases the Ability to Diagnose Peripheral Pulmonary Lesions Endoscopically." Chest 126(3): 959-965.',
    year: 2004,
    journal: 'Chest 126(3): 959-965.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Diagnostic Yield',
      'EBUS',
      'Lung Nodules',
      'Peripheral Lesions',
      'Radial EBUS',
    ],
    synopsis:
      'A foundational radial EBUS guide-sheath study demonstrating that confirming and maintaining access to peripheral lesions could improve bronchoscopic diagnosis.',
    publicationUrl: 'https://doi.org/10.1378/chest.126.3.959',
    audio: makePodcastAudio('endobronchial-ultrasonography-guide-sheath-2004'),
  },
  {
    id: 'effect-of-an-ipc-vs-talc-pleurodesis-on-hospitalization-days-in-patients-with-mpe-the-ample-rct',
    title:
      'Effect of an Indwelling Pleural Catheter vs Talc Pleurodesis on Hospitalization Days in Patients With Malignant Pleural Effusion: The AMPLE RCT',
    citation:
      'Thomas, R., et al. (2017). "Effect of an Indwelling Pleural Catheter vs Talc Pleurodesis on Hospitalization Days in Patients With Malignant Pleural Effusion: The AMPLE Randomized Clinical Trial." JAMA 318(19): 1903-1912.',
    year: 2017,
    journal: 'JAMA 318(19): 1903-1912.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'IPC',
      'Malignant Pleural Effusion',
      'Pleural Disease',
      'Pleurodesis',
      'Randomized Trial',
    ],
    synopsis:
      'The AMPLE trial compared IPC with talc pleurodesis using hospitalization days as a patient-centered endpoint, shaping practical discussions around outpatient pleural management.',
    publicationUrl: 'https://doi.org/10.1001/jama.2017.17426',
    audio: makePodcastAudio(
      'effect-of-an-ipc-vs-talc-pleurodesis-on-hospitalization-days-in-patients-with-mpe-the-ample-rct',
    ),
  },
  {
    id: 'respiratory-infections-increase-risk-2012',
    title:
      'Respiratory Infections Increase the Risk of Granulation Tissue Formation Following Airway Stenting in Patients With Malignant Airway Obstruction',
    citation:
      'Ost, D. E., et al. (2012). "Respiratory Infections Increase the Risk of Granulation Tissue Formation Following Airway Stenting in Patients With Malignant Airway Obstruction." Chest 141(6): 1473-1481.',
    year: 2012,
    journal: 'Chest 141(6): 1473-1481.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Airway Stents',
      'Bronchoscopy Safety',
      'Central Airway Obstruction',
      'Granulation Tissue',
      'Therapeutic Bronchoscopy',
    ],
    synopsis:
      'This airway-stent outcomes study linked lower respiratory tract infection with later granulation tissue, highlighting infection surveillance as part of longitudinal stent care.',
    publicationUrl: 'https://doi.org/10.1378/chest.11-2005',
    audio: makePodcastAudio('respiratory-infections-increase-risk-2012'),
  },
  {
    id: 'coldice-2020',
    title:
      'Diagnostic Accuracy of Transbronchial Lung Cryobiopsy for Interstitial Lung Disease Diagnosis (COLDICE)',
    citation:
      'Troy, L. K., et al. (2020). "Diagnostic Accuracy of Transbronchial Lung Cryobiopsy for Interstitial Lung Disease Diagnosis (COLDICE): A Prospective, Comparative Study." Lancet Respir Med 8(2): 171-181.',
    year: 2020,
    journal: 'Lancet Respir Med 8(2): 171-181.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Bronchoscopy Safety',
      'Cryobiopsy',
      'Diagnostic Yield',
      'Interstitial Lung Disease',
      'Tissue Acquisition',
    ],
    synopsis:
      'COLDICE prospectively compared transbronchial cryobiopsy with surgical lung biopsy in multidisciplinary ILD diagnosis, anchoring modern discussions of bronchoscopic tissue acquisition.',
    publicationUrl: 'https://doi.org/10.1016/S2213-2600(19)30342-X',
    audio: makePodcastAudio('coldice-2020'),
  },
  {
    id: 'cost-effectiveness-of-indwelling-pleural-catheter-compared-with-talc-in-malignant-pleural-effusion',
    title:
      'Cost-Effectiveness of Indwelling Pleural Catheter Compared With Talc in Malignant Pleural Effusion',
    citation:
      'Olfert, J. A. P., et al. (2017). "Cost-Effectiveness of Indwelling Pleural Catheter Compared With Talc in Malignant Pleural Effusion." Respirology 22(4): 764-770.',
    year: 2017,
    journal: 'Respirology 22(4): 764-770.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Cost Effectiveness',
      'IPC',
      'Malignant Pleural Effusion',
      'Pleural Disease',
      'Pleurodesis',
    ],
    synopsis:
      'A health-economic analysis comparing IPC and talc strategies for malignant pleural effusion, useful for connecting clinical outcomes with resource use and patient pathways.',
    publicationUrl: 'https://doi.org/10.1111/resp.12962',
    audio: makePodcastAudio(
      'cost-effectiveness-of-indwelling-pleural-catheter-compared-with-talc-in-malignant-pleural-effusion',
    ),
  },
  {
    id: 'endoscopic-treatment-malignant-airway-1996',
    title: 'Endoscopic Treatment of Malignant Airway Obstructions in 2,008 Patients',
    citation:
      'Cavaliere, S., et al. (1996). "Endoscopic Treatment of Malignant Airway Obstructions in 2,008 Patients." Chest 110(6): 1536-1542.',
    year: 1996,
    journal: 'Chest 110(6): 1536-1542.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Airway Stents',
      'Central Airway Obstruction',
      'Laser Therapy',
      'Rigid Bronchoscopy',
      'Therapeutic Bronchoscopy',
    ],
    synopsis:
      'A large early therapeutic bronchoscopy series describing multimodality endoscopic management for malignant airway obstruction, including laser, brachytherapy, and silicone stenting.',
    publicationUrl: 'https://doi.org/10.1378/chest.110.6.1536',
    audio: makePodcastAudio('endoscopic-treatment-malignant-airway-1996'),
  },
  {
    id: 'transbronchial-cryobiopsy-new-tool-2009',
    title: 'Transbronchial Cryobiopsy: A New Tool for Lung Biopsies',
    citation:
      'Babiak, A., et al. (2009). "Transbronchial Cryobiopsy: A New Tool for Lung Biopsies." Respiration 78(2): 203-208.',
    year: 2009,
    journal: 'Respiration 78(2): 203-208.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Bronchoscopy Safety',
      'Cryobiopsy',
      'Diagnostic Yield',
      'Interstitial Lung Disease',
      'Tissue Acquisition',
    ],
    synopsis:
      'One of the early clinical reports framing transbronchial cryobiopsy as a larger-sample bronchoscopic biopsy technique for diffuse lung disease.',
    publicationUrl: 'https://doi.org/10.1159/000203987',
    audio: makePodcastAudio('transbronchial-cryobiopsy-new-tool-2009'),
  },
  {
    id: 'dedicated-tracheobronchial-stent-1990',
    title: 'A Dedicated Tracheobronchial Stent',
    citation: 'Dumon, J. F. (1990). "A Dedicated Tracheobronchial Stent." Chest 97(2): 328-332.',
    year: 1990,
    journal: 'Chest 97(2): 328-332.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Airway Stents',
      'Central Airway Obstruction',
      'Rigid Bronchoscopy',
      'Silicone Stents',
      'Therapeutic Bronchoscopy',
    ],
    synopsis:
      'The classic Dumon stent report introduced a dedicated molded silicone tracheobronchial stent design that became central to airway intervention practice.',
    publicationUrl: 'https://doi.org/10.1378/chest.97.2.328',
    audio: makePodcastAudio('dedicated-tracheobronchial-stent-1990'),
  },
  {
    id: 'endobronchial-valves-emphysema-without-2015',
    title: 'Endobronchial Valves for Emphysema Without Interlobar Collateral Ventilation',
    citation:
      'Klooster, K., et al. (2015). "Endobronchial Valves for Emphysema Without Interlobar Collateral Ventilation." N Engl J Med 373(24): 2325-2335.',
    year: 2015,
    journal: 'N Engl J Med 373(24): 2325-2335.',
    primaryHub: 'Emphysema, BLVR & Hyperinflation',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'BLVR',
      'Endobronchial Valves',
      'Emphysema',
      'Hyperinflation',
      'Randomized Trial',
    ],
    synopsis:
      'The STELVIO trial showed clinically meaningful benefit from endobronchial valves when collateral ventilation is absent, sharpening patient-selection principles for BLVR.',
    publicationUrl: 'https://doi.org/10.1056/NEJMoa1507807',
    audio: makePodcastAudio('endobronchial-valves-emphysema-without-2015'),
  },
  {
    id: 'complications-therapeutic-bronchoscopy-malignant-2015',
    title:
      'Complications Following Therapeutic Bronchoscopy for Malignant Central Airway Obstruction: Results of the AQuIRE Registry',
    citation:
      'Ost, D. E., et al. (2015). "Complications Following Therapeutic Bronchoscopy for Malignant Central Airway Obstruction: Results of the AQuIRE Registry." Chest 148(2): 450-471.',
    year: 2015,
    journal: 'Chest 148(2): 450-471.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Bronchoscopy Safety',
      'Central Airway Obstruction',
      'Quality Registry',
      'Risk Stratification',
      'Therapeutic Bronchoscopy',
    ],
    synopsis:
      'AQuIRE provided multicenter complication and risk-factor data for therapeutic bronchoscopy in malignant central airway obstruction, grounding procedural safety discussions in registry outcomes.',
    publicationUrl: 'https://doi.org/10.1378/chest.14-1530',
    audio: makePodcastAudio('complications-therapeutic-bronchoscopy-malignant-2015'),
  },
  {
    id: 'technical-aspects-of-ebus-tbna',
    title: 'Technical Aspects of Endobronchial Ultrasound-Guided Transbronchial Needle Aspiration',
    citation:
      'Wahidi, M. M., et al. (2016). "Technical Aspects of Endobronchial Ultrasound-Guided Transbronchial Needle Aspiration: CHEST Guideline and Expert Panel Report." Chest 149(3): 816-835.',
    year: 2016,
    journal: 'Chest 149(3): 816-835.',
    primaryHub: 'Training, Procedural Safety & Program Design',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [landmarkPodcastTag, 'Bronchoscopy Safety', 'EBUS', 'Guideline', 'Staging', 'Training'],
    synopsis:
      'CHEST technical guidance for EBUS-TBNA consolidated practical questions around procedure performance, sample handling, and staging technique.',
    publicationUrl: 'https://doi.org/10.1378/chest.15-1216',
    audio: makePodcastAudio('technical-aspects-of-ebus-tbna'),
  },
  {
    id: 'electromagnetic-navigation-bronchoscopy-peripheral-2019',
    title:
      'Electromagnetic Navigation Bronchoscopy for Peripheral Pulmonary Lesions: One-Year Results of the Prospective, Multicenter NAVIGATE Study',
    citation:
      'Folch, E. E., et al. (2019). "Electromagnetic Navigation Bronchoscopy for Peripheral Pulmonary Lesions: One-Year Results of the Prospective, Multicenter NAVIGATE Study." J Thorac Oncol 14(3): 445-458.',
    year: 2019,
    journal: 'J Thorac Oncol 14(3): 445-458.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Diagnostic Yield',
      'ENB',
      'Lung Nodules',
      'Navigation Bronchoscopy',
      'Pneumothorax',
    ],
    synopsis:
      'NAVIGATE supplied large prospective multicenter data on electromagnetic navigation bronchoscopy performance and safety for peripheral pulmonary lesions.',
    publicationUrl: 'https://doi.org/10.1016/j.jtho.2018.11.013',
    audio: makePodcastAudio('electromagnetic-navigation-bronchoscopy-peripheral-2019'),
  },
  {
    id: 'endobronchial-ultrasound-guided-transbronchial-2005',
    title:
      'Endobronchial Ultrasound-Guided Transbronchial Needle Aspiration for Staging of Lung Cancer',
    citation:
      'Yasufuku, K., et al. (2005). "Endobronchial Ultrasound-Guided Transbronchial Needle Aspiration for Staging of Lung Cancer." Lung Cancer 50(3): 347-354.',
    year: 2005,
    journal: 'Lung Cancer 50(3): 347-354.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Diagnostic Yield',
      'EBUS',
      'Lung Cancer',
      'Mediastinal Staging',
      'Staging',
    ],
    synopsis:
      'An early convex-probe EBUS-TBNA lung cancer staging study that helped establish real-time ultrasound-guided mediastinal needle aspiration as a minimally invasive staging tool.',
    publicationUrl: 'https://doi.org/10.1016/j.lungcan.2005.07.013',
    audio: makePodcastAudio('endobronchial-ultrasound-guided-transbronchial-2005'),
  },
  {
    id: 'randomized-comparison-indwelling-pleural-1999',
    title:
      'A Randomized Comparison of Indwelling Pleural Catheter and Doxycycline Pleurodesis in the Management of Malignant Pleural Effusions',
    citation:
      'Putnam, J. B., Jr., et al. (1999). "A Randomized Comparison of Indwelling Pleural Catheter and Doxycycline Pleurodesis in the Management of Malignant Pleural Effusions." Cancer 86(10): 1992-1999.',
    year: 1999,
    journal: 'Cancer 86(10): 1992-1999.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'IPC',
      'Malignant Pleural Effusion',
      'Pleural Disease',
      'Pleurodesis',
      'Randomized Trial',
    ],
    synopsis:
      'A pivotal randomized comparison that helped move outpatient indwelling pleural catheter management into the malignant pleural effusion treatment conversation.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/10570423/',
    audio: makePodcastAudio('randomized-comparison-indwelling-pleural-1999'),
  },
  {
    id: 'prospective-controlled-trial-ebus-2011',
    title:
      'A Prospective Controlled Trial of EBUS-TBNA Compared With Mediastinoscopy for Mediastinal Lymph Node Staging of Lung Cancer',
    citation:
      'Yasufuku, K., et al. (2011). "A Prospective Controlled Trial of Endobronchial Ultrasound-Guided Transbronchial Needle Aspiration Compared With Mediastinoscopy for Mediastinal Lymph Node Staging of Lung Cancer." J Thorac Cardiovasc Surg 142(6): 1393-1400.e1.',
    year: 2011,
    journal: 'J Thorac Cardiovasc Surg 142(6): 1393-1400.e1.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'EBUS',
      'Lung Cancer',
      'Mediastinal Staging',
      'Mediastinoscopy',
      'Staging',
    ],
    synopsis:
      'This prospective comparison of EBUS-TBNA with mediastinoscopy informed the shift toward endosonographic mediastinal staging in potentially resectable lung cancer.',
    publicationUrl: 'https://doi.org/10.1016/j.jtcvs.2011.08.037',
    audio: makePodcastAudio('prospective-controlled-trial-ebus-2011'),
  },
  {
    id: 'mediastinoscopy-endosonography-mediastinal-nodal-2010',
    title: 'Mediastinoscopy vs Endosonography for Mediastinal Nodal Staging of Lung Cancer',
    citation:
      'Annema, J. T., et al. (2010). "Mediastinoscopy vs Endosonography for Mediastinal Nodal Staging of Lung Cancer: A Randomized Trial." JAMA 304(20): 2245-2252.',
    year: 2010,
    journal: 'JAMA 304(20): 2245-2252.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'EBUS',
      'EUS',
      'Lung Cancer',
      'Mediastinoscopy',
      'Randomized Trial',
      'Staging',
    ],
    synopsis:
      'The ASTER randomized trial compared surgical staging with an endosonography-first strategy, supporting combined endoscopic staging pathways before mediastinoscopy.',
    publicationUrl: 'https://doi.org/10.1001/jama.2010.1705',
    audio: makePodcastAudio('mediastinoscopy-endosonography-mediastinal-nodal-2010'),
  },
  {
    id: 'effect-of-an-indwelling-pleural-catheter-vs-chest-tube-and-talc-pleurodesis-for-relieving-dyspnea-in-patients-with-malignant-pleural-effusion-the-time2-rct',
    title:
      'Effect of an Indwelling Pleural Catheter vs Chest Tube and Talc Pleurodesis for Relieving Dyspnea in Patients With Malignant Pleural Effusion: The TIME2 RCT',
    citation:
      'Davies, H. E., et al. (2012). "Effect of an Indwelling Pleural Catheter vs Chest Tube and Talc Pleurodesis for Relieving Dyspnea in Patients With Malignant Pleural Effusion: The TIME2 Randomized Controlled Trial." JAMA 307(22): 2383-2389.',
    year: 2012,
    journal: 'JAMA 307(22): 2383-2389.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'IPC',
      'Malignant Pleural Effusion',
      'Pleural Disease',
      'Pleurodesis',
      'Randomized Trial',
    ],
    synopsis:
      'TIME2 compared IPC with chest tube talc pleurodesis for breathlessness relief, helping define tradeoffs between symptom control, hospitalization, and repeat procedures.',
    publicationUrl: 'https://doi.org/10.1001/jama.2012.5535',
    audio: makePodcastAudio(
      'effect-of-an-indwelling-pleural-catheter-vs-chest-tube-and-talc-pleurodesis-for-relieving-dyspnea-in-patients-with-malignant-pleural-effusion-the-time2-rct',
    ),
  },
  {
    id: 'liberate-2018',
    title:
      'A Multicenter Randomized Controlled Trial of Zephyr Endobronchial Valve Treatment in Heterogeneous Emphysema (LIBERATE)',
    citation:
      'Criner, G. J., et al. (2018). "A Multicenter Randomized Controlled Trial of Zephyr Endobronchial Valve Treatment in Heterogeneous Emphysema (LIBERATE)." Am J Respir Crit Care Med 198(9): 1151-1164.',
    year: 2018,
    journal: 'Am J Respir Crit Care Med 198(9): 1151-1164.',
    primaryHub: 'Emphysema, BLVR & Hyperinflation',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'BLVR',
      'Endobronchial Valves',
      'Emphysema',
      'Hyperinflation',
      'Randomized Trial',
    ],
    synopsis:
      'LIBERATE supplied pivotal randomized evidence for Zephyr endobronchial valve therapy in selected heterogeneous emphysema, including benefit and pneumothorax-risk framing.',
    publicationUrl: 'https://doi.org/10.1164/rccm.201803-0590OC',
    audio: makePodcastAudio('liberate-2018'),
  },
  {
    id: 'randomized-study-endobronchial-valves-2010',
    title: 'A Randomized Study of Endobronchial Valves for Advanced Emphysema',
    citation:
      'Sciurba, F. C., et al. (2010). "A Randomized Study of Endobronchial Valves for Advanced Emphysema." N Engl J Med 363(13): 1233-1244.',
    year: 2010,
    journal: 'N Engl J Med 363(13): 1233-1244.',
    primaryHub: 'Emphysema, BLVR & Hyperinflation',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'BLVR',
      'Endobronchial Valves',
      'Emphysema',
      'Hyperinflation',
      'Randomized Trial',
    ],
    synopsis:
      'The VENT trial was an early randomized evaluation of endobronchial valves for advanced emphysema, clarifying both potential benefit and the importance of patient selection.',
    publicationUrl: 'https://doi.org/10.1056/NEJMoa0900928',
    audio: makePodcastAudio('randomized-study-endobronchial-valves-2010'),
  },
  {
    id: 'effectiveness-safety-bronchial-thermoplasty-2010',
    title: 'Effectiveness and Safety of Bronchial Thermoplasty in the Treatment of Severe Asthma',
    citation:
      'Castro, M., et al. (2010). "Effectiveness and Safety of Bronchial Thermoplasty in the Treatment of Severe Asthma: A Multicenter, Randomized, Double-Blind, Sham-Controlled Clinical Trial." Am J Respir Crit Care Med 181(2): 116-124.',
    year: 2010,
    journal: 'Am J Respir Crit Care Med 181(2): 116-124.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Bronchial Thermoplasty',
      'Bronchoscopy Safety',
      'Randomized Trial',
      'Severe Asthma',
      'Therapeutic Bronchoscopy',
    ],
    synopsis:
      'The sham-controlled AIR2 trial remains the central randomized study for bronchial thermoplasty in severe asthma, balancing quality-of-life signals with short-term respiratory adverse events.',
    publicationUrl: 'https://doi.org/10.1164/rccm.200903-0354OC',
    audio: makePodcastAudio('effectiveness-safety-bronchial-thermoplasty-2010'),
  },
  {
    id: 'outpatient-talc-administration-indwelling-2018',
    title: 'Outpatient Talc Administration by Indwelling Pleural Catheter for Malignant Effusion',
    citation:
      'Bhatnagar, R., et al. (2018). "Outpatient Talc Administration by Indwelling Pleural Catheter for Malignant Effusion." N Engl J Med 378(14): 1313-1322.',
    year: 2018,
    journal: 'N Engl J Med 378(14): 1313-1322.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'IPC',
      'Malignant Pleural Effusion',
      'Pleural Disease',
      'Pleurodesis',
      'Randomized Trial',
    ],
    synopsis:
      'IPC-PLUS tested outpatient talc delivery through an indwelling pleural catheter, showing how ambulatory IPC management can be combined with pleurodesis intent.',
    publicationUrl: 'https://doi.org/10.1056/NEJMoa1716883',
    audio: makePodcastAudio('outpatient-talc-administration-indwelling-2018'),
  },
  {
    id: 'lung-cancer-diagnosis-staging-2015',
    title:
      'Lung Cancer Diagnosis and Staging With Endobronchial Ultrasound-Guided Transbronchial Needle Aspiration Compared With Conventional Approaches',
    citation:
      'Navani, N., et al. (2015). "Lung Cancer Diagnosis and Staging With Endobronchial Ultrasound-Guided Transbronchial Needle Aspiration Compared With Conventional Approaches: An Open-Label, Pragmatic, Randomised Controlled Trial." Lancet Respir Med 3(4): 282-289.',
    year: 2015,
    journal: 'Lancet Respir Med 3(4): 282-289.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    secondaryHubs: [landmarkJournalClubPodcastHub],
    tags: [
      landmarkPodcastTag,
      'Diagnostic Yield',
      'EBUS',
      'Lung Cancer',
      'Randomized Trial',
      'Staging',
    ],
    synopsis:
      'The Lung-BOOST pragmatic randomized trial evaluated EBUS-TBNA as an initial diagnostic and staging approach for suspected lung cancer, emphasizing efficient pathway design.',
    publicationUrl: 'https://doi.org/10.1016/S2213-2600(15)00029-6',
    audio: makePodcastAudio('lung-cancer-diagnosis-staging-2015'),
  },
  {
    id: 'ipn-program-time-to-diagnosis',
    title:
      'Reduction in Time-to-Diagnosis for Lung Cancer Resulting From Implementation of a Formal Incidental Pulmonary Nodule (IPN) Program Compared With Traditional Referral Pathways',
    citation:
      'Mahajan, A. K., et al. (2026). "Reduction in Time-to-Diagnosis for Lung Cancer Resulting From Implementation of a Formal Incidental Pulmonary Nodule (IPN) Program Compared With Traditional Referral Pathways." J Bronchology Interv Pulmonol 33(2).',
    year: 2026,
    journal: 'J Bronchology Interv Pulmonol 33(2).',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: [
      'Lung Cancer',
      'Lung Nodules',
      'Multidisciplinary Care',
      'Program Development',
      'Staging',
    ],
    synopsis:
      'Implementation of a formal IPN program can reduce time-to-diagnosis of lung cancer in patients presenting with an IPN by 134 days compared with traditional referral patterns. Formal IPN programs can result in a shift towards an earlier stage of diagnosis for lung cancer.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41549999/',
    audio: {
      english: 'v1/ipn-program-time-to-diagnosis/english.mp3',
      mandarin: 'v1/ipn-program-time-to-diagnosis/mandarin.mp3',
      spanish: 'v1/ipn-program-time-to-diagnosis/spanish.mp3',
      arabic: 'v1/ipn-program-time-to-diagnosis/arabic.mp3',
      korean: 'v1/ipn-program-time-to-diagnosis/korean.mp3',
    },
  },
  {
    id: 'swe-transthoracic-biopsy',
    title:
      'Shear-wave elastography-guided transthoracic biopsy for lung lesions: a randomised controlled trial',
    citation:
      'Kuo, Y. W., et al. (2026). "Shear-wave elastography-guided transthoracic biopsy for lung lesions: a randomised controlled trial." Eur Respir J 67(3).',
    year: 2026,
    journal: 'Eur Respir J 67(3).',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: [
      'Bronchoscopy Safety',
      'Lung Cancer',
      'Lung Nodules',
      'Pneumothorax',
      'Randomized Trial',
      'ROSE',
      'Staging',
      'TTNB',
      'Ultrasound',
    ],
    synopsis:
      'Randomized trial suggesting shear-wave elastography guidance can improve diagnostic yield and shorten biopsy time for subpleural lung lesions without increasing complications.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41198395/',
    audio: {
      english: 'v1/swe-transthoracic-biopsy/english.mp3',
      mandarin: 'v1/swe-transthoracic-biopsy/mandarin.mp3',
      spanish: 'v1/swe-transthoracic-biopsy/spanish.mp3',
      arabic: 'v1/swe-transthoracic-biopsy/arabic.mp3',
      korean: 'v1/swe-transthoracic-biopsy/korean.mp3',
    },
  },
  {
    id: 'icg-fiducial-markers',
    title:
      'Spot On: Indocyanine Green-Soaked Fiducial Markers for Lung Nodules Prior to Thoracic Surgery',
    citation:
      'Benn, B. S., et al. (2025). "Spot On: Indocyanine Green-Soaked Fiducial Markers for Lung Nodules Prior to Thoracic Surgery." CHEST Pulmonary 3(1): 100131.',
    year: 2025,
    journal: 'CHEST Pulmonary 3(1): 100131.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: ['Lung Cancer', 'Lung Nodules', 'Staging', 'Thoracic Surgery'],
    synopsis:
      'Multi-institutional experience showing bronchoscopic ICG-soaked fiducial markers can help surgeons localize small peripheral lesions and support lung-sparing resection.',
    publicationUrl: 'https://doi.org/10.1016/j.chpulm.2024.100131',
    audio: {
      english: 'v1/icg-fiducial-markers/english.mp3',
      mandarin: 'v1/icg-fiducial-markers/mandarin.mp3',
      spanish: 'v1/icg-fiducial-markers/spanish.mp3',
      arabic: 'v1/icg-fiducial-markers/arabic.mp3',
      korean: 'v1/icg-fiducial-markers/korean.mp3',
    },
  },
  {
    id: 'sts-screendetected-nodules',
    title:
      'The Society of Thoracic Surgeons (2025) Expert Consensus Document on Interventions for Screen-Detected Lung Nodules',
    citation:
      'Servais, E. L., et al. (2026). "The Society of Thoracic Surgeons (2025) Expert Consensus Document on Interventions for Screen-Detected Lung Nodules." Ann Thorac Surg 121(6): 1283-1297.',
    year: 2026,
    journal: 'Ann Thorac Surg 121(6): 1283-1297.',
    primaryHub: 'Lung Nodules, Early Lung Cancer & Staging',
    tags: [
      'Guideline',
      'Lung Cancer',
      'Lung Nodules',
      'Multidisciplinary Care',
      'Pneumothorax',
      'Program Development',
      'Screening',
      'Staging',
      'Thoracic Surgery',
    ],
    synopsis:
      'Preoperative pulmonary rehabilitation and smoking cessation were emphasized. This STS consensus defines perioperative quality standards for CT LCS programs, supporting shared decision-making, multidisciplinary care, and quality improvement.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41633462/',
    audio: {
      english: 'v1/sts-screendetected-nodules/english.mp3',
      mandarin: 'v1/sts-screendetected-nodules/mandarin.mp3',
      spanish: 'v1/sts-screendetected-nodules/spanish.mp3',
      arabic: 'v1/sts-screendetected-nodules/arabic.mp3',
      korean: 'v1/sts-screendetected-nodules/korean.mp3',
    },
  },
  {
    id: 'rab-rose-accuracy',
    title:
      'Accuracy of Rapid On-Site Evaluation in Robotic-Assisted Bronchoscopy Fine Needle Aspirations of Lung Nodules',
    citation:
      'Chen-Yost, H. I., et al. (2026). "Accuracy of Rapid On-Site Evaluation in Robotic-Assisted Bronchoscopy Fine Needle Aspirations of Lung Nodules." J Bronchology Interv Pulmonol 33(2).',
    year: 2026,
    journal: 'J Bronchology Interv Pulmonol 33(2).',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: ['Cryotherapy', 'Lung Cancer', 'Robotic Bronchoscopy', 'ROSE'],
    synopsis:
      'Three fine needle passes were sufficient for diagnostic results, with a plateau in subsequent biopsies. Histopathologic tissue diagnosis was superior with the cryoprobe than with tissue obtained using conventional forceps.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41718084/',
    audio: {
      english: 'v1/rab-rose-accuracy/english.mp3',
      mandarin: 'v1/rab-rose-accuracy/mandarin.mp3',
      spanish: 'v1/rab-rose-accuracy/spanish.mp3',
      arabic: 'v1/rab-rose-accuracy/arabic.mp3',
      korean: 'v1/rab-rose-accuracy/korean.mp3',
    },
  },
  {
    id: 'frostbite2-cryobiopsy-forceps',
    title:
      'Cryobiopsy vs Forceps for Bronchoscopic Lung Biopsy: The FROSTBITE-2 Randomized Clinical Trial',
    citation:
      'Thiboutot, J., et al. (2026). "Cryobiopsy vs Forceps for Bronchoscopic Lung Biopsy: The FROSTBITE-2 Randomized Clinical Trial." Jama 335(23): 2038-2045.',
    year: 2026,
    journal: 'Jama 335(23): 2038-2045.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: [
      'Bronchoscopy Safety',
      'Cryobiopsy',
      'Cryotherapy',
      'Randomized Trial',
      'Robotic Bronchoscopy',
    ],
    synopsis:
      'Randomized trial comparing bronchoscopic cryobiopsy with forceps biopsy for peripheral lung lesions, highlighting tissue acquisition strategy and safety considerations.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/42149700/',
    audio: {
      english: 'v1/frostbite2-cryobiopsy-forceps/english.mp3',
      mandarin: 'v1/frostbite2-cryobiopsy-forceps/mandarin.mp3',
      spanish: 'v1/frostbite2-cryobiopsy-forceps/spanish.mp3',
      arabic: 'v1/frostbite2-cryobiopsy-forceps/arabic.mp3',
      korean: 'v1/frostbite2-cryobiopsy-forceps/korean.mp3',
    },
  },
  {
    id: 'multihospital-rab-outcomes',
    title:
      'Diagnostic Outcomes of Robotic Bronchoscopy in a Multidisciplinary, Multi-Hospital Lung Nodule Program',
    citation:
      'Deitz, R. L., et al. (2026). "Diagnostic Outcomes of Robotic Bronchoscopy in a Multidisciplinary, Multi-Hospital Lung Nodule Program." J Surg Res 324: 210-220.',
    year: 2026,
    journal: 'J Surg Res 324: 210-220.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: [
      'EBUS',
      'Multidisciplinary Care',
      'Program Development',
      'Robotic Bronchoscopy',
      'Ultrasound',
    ],
    synopsis:
      'Long-term multidisciplinary program experience suggesting robotic bronchoscopy can serve as an initial sampling approach for solid lung lesions with acceptable performance and low complication rates.',
    publicationUrl: 'https://doi.org/10.1016/j.jss.2026.04.031',
    audio: {
      english: 'v1/multihospital-rab-outcomes/english.mp3',
      mandarin: 'v1/multihospital-rab-outcomes/mandarin.mp3',
      spanish: 'v1/multihospital-rab-outcomes/spanish.mp3',
      arabic: 'v1/multihospital-rab-outcomes/arabic.mp3',
      korean: 'v1/multihospital-rab-outcomes/korean.mp3',
    },
  },
  {
    id: 'enb-needle-forceps-synergy',
    title:
      'Diagnostic Yield and Synergistic Impact of Needle Aspiration and Forceps Biopsy With Electromagnetic Navigation Bronchoscopy for Peripheral Pulmonary Lesions: A Randomized Controlled Trial',
    citation:
      'Kim, Y. W., et al. (2025). "Diagnostic Yield and Synergistic Impact of Needle Aspiration and Forceps Biopsy With Electromagnetic Navigation Bronchoscopy for Peripheral Pulmonary Lesions: A Randomized Controlled Trial." Chest 168(1): 236-247.',
    year: 2025,
    journal: 'Chest 168(1): 236-247.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: [
      'Bronchoscopy Safety',
      'ENB',
      'Lung Cancer',
      'Pneumothorax',
      'Randomized Trial',
      'Robotic Bronchoscopy',
    ],
    synopsis:
      'Randomized ENB study evaluating how needle aspiration and forceps biopsy contribute to diagnostic yield for peripheral pulmonary lesions.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39993594/',
    audio: {
      english: 'v1/enb-needle-forceps-synergy/english.mp3',
      mandarin: 'v1/enb-needle-forceps-synergy/mandarin.mp3',
      spanish: 'v1/enb-needle-forceps-synergy/spanish.mp3',
      arabic: 'v1/enb-needle-forceps-synergy/arabic.mp3',
      korean: 'v1/enb-needle-forceps-synergy/korean.mp3',
    },
  },
  {
    id: 'rope-dynamic-cell-imaging',
    title:
      'Proceduralist-Directed Rapid On-Site Pathologic Evaluation (ROPE) Using Dynamic Cell Imaging: A Pilot Study of Peripheral Pulmonary Lesion Sampling Through Robotic Bronchoscopy',
    citation:
      'Matus, I., et al. (2026). "Proceduralist-Directed Rapid On-Site Pathologic Evaluation (ROPE) Using Dynamic Cell Imaging: A Pilot Study of Peripheral Pulmonary Lesion Sampling Through Robotic Bronchoscopy." J Bronchology Interv Pulmonol 33(1).',
    year: 2026,
    journal: 'J Bronchology Interv Pulmonol 33(1).',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: ['Cryobiopsy', 'Cryotherapy', 'Robotic Bronchoscopy', 'ROPE', 'ROSE'],
    synopsis:
      'Pilot study of proceduralist-directed rapid on-site pathologic evaluation using dynamic cell imaging, with high concordance between intraprocedural assessment and final pathology.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41370749/',
    audio: {
      english: 'v1/rope-dynamic-cell-imaging/english.mp3',
      mandarin: 'v1/rope-dynamic-cell-imaging/mandarin.mp3',
      spanish: 'v1/rope-dynamic-cell-imaging/spanish.mp3',
      arabic: 'v1/rope-dynamic-cell-imaging/arabic.mp3',
      korean: 'v1/rope-dynamic-cell-imaging/korean.mp3',
    },
  },
  {
    id: 'rab-cryobiopsy-ggo',
    title:
      'Robotic-assisted bronchoscopy-guided cryobiopsy for the diagnosis of ground-glass opacity-predominant peripheral pulmonary nodules',
    citation:
      'Zhang, C., et al. (2026). "Robotic-assisted bronchoscopy-guided cryobiopsy for the diagnosis of ground-glass opacity-predominant peripheral pulmonary nodules." Respir Res.',
    year: 2026,
    journal: 'Respir Res.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: [
      'Bronchoscopy Safety',
      'CBCT',
      'Cryobiopsy',
      'Cryotherapy',
      'GGO',
      'Lung Cancer',
      'Multidisciplinary Care',
      'Pneumothorax',
      'Program Development',
      'Randomized Trial',
      'Robotic Bronchoscopy',
    ],
    synopsis:
      'Single-center experience suggesting ssRAB plus mobile CBCT-guided cryobiopsy can achieve high diagnostic yield for GGO-predominant peripheral nodules with a favorable safety profile.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/42116052/',
    audio: {
      english: 'v1/rab-cryobiopsy-ggo/english.mp3',
      mandarin: 'v1/rab-cryobiopsy-ggo/mandarin.mp3',
      spanish: 'v1/rab-cryobiopsy-ggo/spanish.mp3',
      arabic: 'v1/rab-cryobiopsy-ggo/arabic.mp3',
      korean: 'v1/rab-cryobiopsy-ggo/korean.mp3',
    },
  },
  {
    id: 'confirm-small-nodules',
    title:
      'Shape-sensing robotic-assisted bronchoscopy with integrated mobile cone-beam CT for small nodules: results from the prospective multicentre CONFIRM study',
    citation:
      'Husta, B. C., et al. (2026). "Shape-sensing robotic-assisted bronchoscopy with integrated mobile cone-beam CT for small nodules: results from the prospective multicentre CONFIRM study." Thorax 81(3): 267-275.',
    year: 2026,
    journal: 'Thorax 81(3): 267-275.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: [
      'Bronchoscopy Safety',
      'CBCT',
      'Lung Cancer',
      'Pneumothorax',
      'Randomized Trial',
      'Robotic Bronchoscopy',
      'Tool-in-Lesion',
      'TTNB',
    ],
    synopsis:
      'Prospective multicenter CONFIRM study of shape-sensing robotic bronchoscopy with integrated mobile CBCT for small nodules, focused on tool-in-lesion verification and outcomes.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41698810/',
    audio: {
      english: 'v1/confirm-small-nodules/english.mp3',
      mandarin: 'v1/confirm-small-nodules/mandarin.mp3',
      spanish: 'v1/confirm-small-nodules/spanish.mp3',
      arabic: 'v1/confirm-small-nodules/arabic.mp3',
      korean: 'v1/confirm-small-nodules/korean.mp3',
    },
  },
  {
    id: 'lateral-decubitus-rab',
    title:
      'Superiority of Lateral Decubitus Strategy in Preventing Atelectasis From Obscuring Targets During Robotic Bronchoscopy: Lateral Decubitus Strategy vs Ventilatory Strategy to Prevent Atelectasis Trial',
    citation:
      'Boster, J. M., et al. (2026). "Superiority of Lateral Decubitus Strategy in Preventing Atelectasis From Obscuring Targets During Robotic Bronchoscopy: Lateral Decubitus Strategy vs Ventilatory Strategy to Prevent Atelectasis Trial." Chest 169(4): 1124-1134.',
    year: 2026,
    journal: 'Chest 169(4): 1124-1134.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: [
      'Atelectasis',
      'Bronchoscopy Safety',
      'CBCT',
      'EBUS',
      'Randomized Trial',
      'Robotic Bronchoscopy',
      'Tool-in-Lesion',
      'Ultrasound',
    ],
    synopsis:
      'Randomized trial showing lateral decubitus positioning reduced atelectasis obscuring dependent robotic bronchoscopy targets and improved tool-in-lesion confirmation.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41513124/',
    audio: {
      english: 'v1/lateral-decubitus-rab/english.mp3',
      mandarin: 'v1/lateral-decubitus-rab/mandarin.mp3',
      spanish: 'v1/lateral-decubitus-rab/spanish.mp3',
      arabic: 'v1/lateral-decubitus-rab/arabic.mp3',
      korean: 'v1/lateral-decubitus-rab/korean.mp3',
    },
  },
  {
    id: 'ssrab-cbct-verification',
    title:
      'Tool in lesion verification of shape-sensing robotic-assisted bronchoscopy with cone beam CT in sampling peripheral pulmonary nodules',
    citation:
      'Chan, L. T., et al. (2026). "Tool in lesion verification of shape-sensing robotic-assisted bronchoscopy with cone beam CT in sampling peripheral pulmonary nodules." Thorax 81(6): 571-580.',
    year: 2026,
    journal: 'Thorax 81(6): 571-580.',
    primaryHub: 'Robotic / Navigation Bronchoscopy & Tissue Acquisition',
    tags: [
      'Bronchoscopy Safety',
      'CBCT',
      'Lung Cancer',
      'Pneumothorax',
      'Randomized Trial',
      'Robotic Bronchoscopy',
      'Tool-in-Lesion',
    ],
    synopsis:
      'ssRAB with CBCT can effectively reach and biopsy small pulmonary nodules, including perifissural, peripleural and paramediastinal lesions with a strong safety profile. NCT05867953.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41391887/',
    audio: {
      english: 'v1/ssrab-cbct-verification/english.mp3',
      mandarin: 'v1/ssrab-cbct-verification/mandarin.mp3',
      spanish: 'v1/ssrab-cbct-verification/spanish.mp3',
      arabic: 'v1/ssrab-cbct-verification/arabic.mp3',
      korean: 'v1/ssrab-cbct-verification/korean.mp3',
    },
  },
  {
    id: 'enb-microwave-ablation',
    title:
      'A novel technique for microwave ablation of malignant pulmonary nodules: electromagnetic navigation bronchoscopy with real-time digital subtraction angiography and computed tomography imaging guidance',
    citation:
      'Xu, Y., et al. (2025). "A novel technique for microwave ablation of malignant pulmonary nodules: electromagnetic navigation bronchoscopy with real-time digital subtraction angiography and computed tomography imaging guidance." Eur J Cardiothorac Surg 67(3).',
    year: 2025,
    journal: 'Eur J Cardiothorac Surg 67(3).',
    primaryHub: 'Bronchoscopic Ablation & Intratumoral Therapy',
    tags: ['Ablation', 'Bronchoscopy Safety', 'CBCT', 'ENB', 'Lung Cancer', 'Microwave Ablation'],
    synopsis:
      'Minor complications included haemoptysis (n = 2) and postoperative fever (n = 3), which resolved spontaneously. ENB combined with real-time 2D DSA guidance and 3D CBCT may be a feasible and safe technique for MWA of malignant pulmonary nodules.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40045172/',
    audio: {
      english: 'v1/enb-microwave-ablation/english.mp3',
      mandarin: 'v1/enb-microwave-ablation/mandarin.mp3',
      spanish: 'v1/enb-microwave-ablation/spanish.mp3',
      arabic: 'v1/enb-microwave-ablation/arabic.mp3',
      korean: 'v1/enb-microwave-ablation/korean.mp3',
    },
  },
  {
    id: 'bronchoscopic-intratumoural-therapies',
    title: 'Bronchoscopic intratumoural therapies for non-small cell lung cancer',
    citation:
      'DeMaio, A. and D. Sterman (2020). "Bronchoscopic intratumoural therapies for non-small cell lung cancer." Eur Respir Rev 29(156).',
    year: 2020,
    journal: 'Eur Respir Rev 29(156).',
    primaryHub: 'Bronchoscopic Ablation & Intratumoral Therapy',
    tags: ['Ablation', 'Lung Cancer'],
    synopsis:
      'This review surveys bronchoscopic intratumoral treatment strategies for NSCLC, highlighting how local delivery and immunotherapy combinations could expand interventional pulmonology beyond diagnosis.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/32554757/',
    audio: {
      english: 'v1/bronchoscopic-intratumoural-therapies/english.mp3',
      mandarin: 'v1/bronchoscopic-intratumoural-therapies/mandarin.mp3',
      spanish: 'v1/bronchoscopic-intratumoural-therapies/spanish.mp3',
      arabic: 'v1/bronchoscopic-intratumoural-therapies/arabic.mp3',
      korean: 'v1/bronchoscopic-intratumoural-therapies/korean.mp3',
    },
  },
  {
    id: 'pef-carcinoid-ablation',
    title:
      'Bronchoscopic pulsed-electric field ablation for carcinoid tumor: robotic-assisted and non-robotic approach',
    citation:
      'Fernandez-Bussy, S., et al. (2026). "Bronchoscopic pulsed-electric field ablation for carcinoid tumor: robotic-assisted and non-robotic approach." Lung Cancer 214: 109333.',
    year: 2026,
    journal: 'Lung Cancer 214: 109333.',
    primaryHub: 'Bronchoscopic Ablation & Intratumoral Therapy',
    tags: [
      'Ablation',
      'Bronchoscopy Safety',
      'Carcinoid',
      'CBCT',
      'EBUS',
      'Lung Cancer',
      'PEF',
      'Robotic Bronchoscopy',
      'Thoracic Surgery',
      'Tool-in-Lesion',
    ],
    synopsis:
      'PEF ablation delivered via ssRAB and EBUS for pulmonary carcinoid tumors appeared feasible and safe, with promising short-term radiographic responses. This approach may provide a minimally invasive treatment option for patients who are not candidates for surgery or radiation.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41762471/',
    audio: {
      english: 'v1/pef-carcinoid-ablation/english.mp3',
      mandarin: 'v1/pef-carcinoid-ablation/mandarin.mp3',
      spanish: 'v1/pef-carcinoid-ablation/spanish.mp3',
      arabic: 'v1/pef-carcinoid-ablation/arabic.mp3',
      korean: 'v1/pef-carcinoid-ablation/korean.mp3',
    },
  },
  {
    id: 'synergistic-pef-preclinical',
    title:
      'Bronchoscopy-guided synergistic pulsed irreversible electroporation ablation as a novel intervention therapy for lung lesions: A pilot study in a preclinical model',
    citation:
      'Zhang, J., et al. (2026). "Bronchoscopy-guided synergistic pulsed irreversible electroporation ablation as a novel intervention therapy for lung lesions: A pilot study in a preclinical model." Transl Res 291: 40-50.',
    year: 2026,
    journal: 'Transl Res 291: 40-50.',
    primaryHub: 'Bronchoscopic Ablation & Intratumoral Therapy',
    tags: [
      'Ablation',
      'Benign Stenosis',
      'Bronchoscopy Safety',
      'IRE',
      'Lung Cancer',
      'Pneumothorax',
      'Thoracic Surgery',
    ],
    synopsis:
      'Preclinical porcine study supporting the feasibility and safety of bronchoscopy-guided synergistic irreversible electroporation for lung lesion ablation near critical structures.',
    publicationUrl: 'https://www.translationalres.com/article/S1931-5244(26)00073-3/fulltext',
    audio: {
      english: 'v1/synergistic-pef-preclinical/english.mp3',
      mandarin: 'v1/synergistic-pef-preclinical/mandarin.mp3',
      spanish: 'v1/synergistic-pef-preclinical/spanish.mp3',
      arabic: 'v1/synergistic-pef-preclinical/arabic.mp3',
      korean: 'v1/synergistic-pef-preclinical/korean.mp3',
    },
  },
  {
    id: 'bronc-rfii-oneyear',
    title:
      'Safety and efficacy of a novel transbronchial radiofrequency ablation system for lung tumours: One year follow-up from the first multi-centre large-scale clinical trial (BRONC-RFII)',
    citation:
      'Zhong, C., et al. (2025). "Safety and efficacy of a novel transbronchial radiofrequency ablation system for lung tumours: One year follow-up from the first multi-centre large-scale clinical trial (BRONC-RFII)." Respirology 30(1): 51-61.',
    year: 2025,
    journal: 'Respirology 30(1): 51-61.',
    primaryHub: 'Bronchoscopic Ablation & Intratumoral Therapy',
    tags: [
      'Ablation',
      'Bronchoscopy Safety',
      'GGO',
      'Lung Cancer',
      'Pneumothorax',
      'Randomized Trial',
      'RFA',
    ],
    synopsis:
      'Two subjects died during the follow-up period. Transbronchial RFA utilizing an automatic saline microperfusion system is a viable, safe and efficacious approach for the treatment for lung tumours, particularly for patients with GGNs.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39197870/',
    audio: {
      english: 'v1/bronc-rfii-oneyear/english.mp3',
      mandarin: 'v1/bronc-rfii-oneyear/mandarin.mp3',
      spanish: 'v1/bronc-rfii-oneyear/spanish.mp3',
      arabic: 'v1/bronc-rfii-oneyear/arabic.mp3',
      korean: 'v1/bronc-rfii-oneyear/korean.mp3',
    },
  },
  {
    id: 'pef-lung-cancer-ablation',
    title:
      'Safety and Efficacy of Bronchoscopic Pulsed Electric Field Ablation for Lung Cancer and Metastases',
    citation:
      'Mahmood, K., et al. (2026). "Safety and Efficacy of Bronchoscopic Pulsed Electric Field Ablation for Lung Cancer and Metastases." JTO Clinical and Research Reports: 100983.',
    year: 2026,
    journal: 'JTO Clinical and Research Reports: 100983.',
    primaryHub: 'Bronchoscopic Ablation & Intratumoral Therapy',
    tags: ['Ablation', 'Bronchoscopy Safety', 'Lung Cancer', 'PEF', 'Robotic Bronchoscopy'],
    synopsis:
      'Early clinical report of bronchoscopic pulsed electric field ablation for lung cancer and metastases, emphasizing procedural safety and mixed early local-control signals.',
    publicationUrl: 'https://doi.org/10.1016/j.jtocrr.2026.100983',
    audio: {
      english: 'v1/pef-lung-cancer-ablation/english.mp3',
      mandarin: 'v1/pef-lung-cancer-ablation/mandarin.mp3',
      spanish: 'v1/pef-lung-cancer-ablation/spanish.mp3',
      arabic: 'v1/pef-lung-cancer-ablation/arabic.mp3',
      korean: 'v1/pef-lung-cancer-ablation/korean.mp3',
    },
  },
  {
    id: 'rab-cryoablation-nodules',
    title:
      'Shape-Sensing Robotic-Assisted Bronchoscopic Cryoablation for Primary and Metastatic Pulmonary Nodules: Feasibility, Safety, and Early Outcomes',
    citation:
      'Xu, L., et al. (2026). "Shape-Sensing Robotic-Assisted Bronchoscopic Cryoablation for Primary and Metastatic Pulmonary Nodules: Feasibility, Safety, and Early Outcomes." Respiration: 1-13.',
    year: 2026,
    journal: 'Respiration: 1-13.',
    primaryHub: 'Bronchoscopic Ablation & Intratumoral Therapy',
    tags: [
      'Ablation',
      'Bronchoscopy Safety',
      'CBCT',
      'Cryotherapy',
      'Lung Cancer',
      'Multidisciplinary Care',
      'Program Development',
      'Robotic Bronchoscopy',
      'Thoracic Surgery',
    ],
    synopsis:
      'Feasibility series of ssRAB-guided transbronchial cryoablation for primary and metastatic pulmonary nodules, with favorable short-term safety and early local-control findings.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41911076/',
    audio: {
      english: 'v1/rab-cryoablation-nodules/english.mp3',
      mandarin: 'v1/rab-cryoablation-nodules/mandarin.mp3',
      spanish: 'v1/rab-cryoablation-nodules/spanish.mp3',
      arabic: 'v1/rab-cryoablation-nodules/arabic.mp3',
      korean: 'v1/rab-cryoablation-nodules/korean.mp3',
    },
  },
  {
    id: 'relief-trial-protocol',
    title:
      'Chest drain REgular FLushing in ComplIcated parapneumonic EFfusions and empyemas: Study protocol for the RELIEF randomized controlled trial',
    citation:
      'Boyle, T. K., et al. (2026). "Chest drain REgular FLushing in ComplIcated parapneumonic EFfusions and empyemas: Study protocol for the RELIEF randomized controlled trial." PLoS One 21(3): e0331725.',
    year: 2026,
    journal: 'PLoS One 21(3): e0331725.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: [
      'Airway Stents',
      'Chest Drains',
      'Guideline',
      'Pleural Effusion',
      'Pleural Infection',
      'Randomized Trial',
      'Screening',
      'Thoracoscopy',
      'Ultrasound',
    ],
    synopsis:
      'Protocol for the RELIEF randomized trial comparing regular saline flushing with as-needed flushing for small-bore chest drains in pleural infection.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41785244/',
    audio: {
      english: 'v1/relief-trial-protocol/english.mp3',
      mandarin: 'v1/relief-trial-protocol/mandarin.mp3',
      spanish: 'v1/relief-trial-protocol/spanish.mp3',
      arabic: 'v1/relief-trial-protocol/arabic.mp3',
      korean: 'v1/relief-trial-protocol/korean.mp3',
    },
  },
  {
    id: 'collaborationi-pleural-biopsy',
    title:
      'Diagnostic yield and safety of probe-based confocal laser endomicroscopy-guided pleural biopsy via semirigid thoracoscope in diagnosing patients with unknown pleural effusion: a protocol for a multicentre, randomised controlled trial (COLLABORATION-I)',
    citation:
      'Deng, M. M., et al. (2026). "Diagnostic yield and safety of probe-based confocal laser endomicroscopy-guided pleural biopsy via semirigid thoracoscope in diagnosing patients with unknown pleural effusion: a protocol for a multicentre, randomised controlled trial (COLLABORATION-I)." BMJ Open 16(6): e117208.',
    year: 2026,
    journal: 'BMJ Open 16(6): e117208.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: [
      'Bronchoscopy Safety',
      'Chest Drains',
      'Lung Cancer',
      'Pleural Effusion',
      'Randomized Trial',
      'Rigid Bronchoscopy',
      'Thoracoscopy',
    ],
    synopsis:
      'The findings will be disseminated through journal publications and conference presentations. NCT06741839.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/42242740/',
    audio: {
      english: 'v1/collaborationi-pleural-biopsy/english.mp3',
      mandarin: 'v1/collaborationi-pleural-biopsy/mandarin.mp3',
      spanish: 'v1/collaborationi-pleural-biopsy/spanish.mp3',
      arabic: 'v1/collaborationi-pleural-biopsy/arabic.mp3',
      korean: 'v1/collaborationi-pleural-biopsy/korean.mp3',
    },
  },
  {
    id: 'discordant-pleural-exudates',
    title:
      'Incidence of Discordant Pleural Fluid Exudates and Diagnostic Patterns: A Retrospective Cohort Study',
    citation:
      'Addala, D. N., et al. (2025). "Incidence of Discordant Pleural Fluid Exudates and Diagnostic Patterns: A Retrospective Cohort Study." Chest 168(6): 1517-1527.',
    year: 2025,
    journal: 'Chest 168(6): 1517-1527.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: ['Chest Drains', 'Lung Cancer', 'Pleural Effusion', 'Pleural Infection', 'Thoracoscopy'],
    synopsis:
      'Our results indicate that discordant pleural effusions are common and represent a biologically distinct entity with different diagnostic patterns compared with concordant effusions. Clinicians should assess for discordance early and tailor investigations accordingly.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40588125/',
    audio: {
      english: 'v1/discordant-pleural-exudates/english.mp3',
      mandarin: 'v1/discordant-pleural-exudates/mandarin.mp3',
      spanish: 'v1/discordant-pleural-exudates/spanish.mp3',
      arabic: 'v1/discordant-pleural-exudates/arabic.mp3',
      korean: 'v1/discordant-pleural-exudates/korean.mp3',
    },
  },
  {
    id: 'uk-local-anaesthetic-thoracoscopy',
    title: 'Local Anaesthetic Thoracoscopy Practice in the UK in 2024: A Snapshot Survey',
    citation:
      'Westley, R., et al. (2025). "Local Anaesthetic Thoracoscopy Practice in the UK in 2024: A Snapshot Survey." Respiration 104(10): 730-735.',
    year: 2025,
    journal: 'Respiration 104(10): 730-735.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: [
      'Chest Drains',
      'Guideline',
      'Pleural Effusion',
      'Pleural Infection',
      'Pneumothorax',
      'Thoracic Surgery',
      'Thoracoscopy',
    ],
    synopsis:
      'These results support the need for identifying best practice and standardisation of LAT practices, with outcome reporting. These survey results will form the basis of applications to the national and international respiratory societies to develop relevant standards.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40435993/',
    audio: {
      english: 'v1/uk-local-anaesthetic-thoracoscopy/english.mp3',
      mandarin: 'v1/uk-local-anaesthetic-thoracoscopy/mandarin.mp3',
      spanish: 'v1/uk-local-anaesthetic-thoracoscopy/spanish.mp3',
      arabic: 'v1/uk-local-anaesthetic-thoracoscopy/arabic.mp3',
      korean: 'v1/uk-local-anaesthetic-thoracoscopy/korean.mp3',
    },
  },
  {
    id: 'tactic-mpe-trial',
    title:
      'Medical thoracoscopy with talc poudrage and indwelling pleural catheter insertion versus medical thoracoscopy with talc poudrage alone for patients with symptomatic malignant pleural effusion (TACTIC): a randomised, controlled phase 3 trial',
    citation:
      'Dipper, A., et al. (2026). "Medical thoracoscopy with talc poudrage and indwelling pleural catheter insertion versus medical thoracoscopy with talc poudrage alone for patients with symptomatic malignant pleural effusion (TACTIC): a randomised, controlled phase 3 trial." Lancet Respir Med 14(4): 341-349.',
    year: 2026,
    journal: 'Lancet Respir Med 14(4): 341-349.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: [
      'Chest Drains',
      'IPC',
      'Lung Cancer',
      'Pleural Effusion',
      'Randomized Trial',
      'Thoracoscopy',
    ],
    synopsis:
      'Phase 3 trial of talc poudrage with or without indwelling pleural catheter insertion during medical thoracoscopy for symptomatic malignant pleural effusion.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41763237/',
    audio: {
      english: 'v1/tactic-mpe-trial/english.mp3',
      mandarin: 'v1/tactic-mpe-trial/mandarin.mp3',
      spanish: 'v1/tactic-mpe-trial/spanish.mp3',
      arabic: 'v1/tactic-mpe-trial/arabic.mp3',
      korean: 'v1/tactic-mpe-trial/korean.mp3',
    },
  },
  {
    id: 'thoracoscopy-without-ptx',
    title:
      'Medical Thoracoscopy With vs Without Prior Artificial Pneumothorax for Patients With Minimal or Absent Pleural Effusion',
    citation:
      'Wang, K., et al. (2026). "Medical Thoracoscopy With vs Without Prior Artificial Pneumothorax for Patients With Minimal or Absent Pleural Effusion." Chest 169(1): 269-279.',
    year: 2026,
    journal: 'Chest 169(1): 269-279.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: [
      'Bronchoscopy Safety',
      'Chest Drains',
      'Guideline',
      'Pleural Effusion',
      'Pneumothorax',
      'Randomized Trial',
      'Thoracoscopy',
    ],
    synopsis:
      'Randomized noninferiority trial suggesting artificial pneumothorax may not be necessary before medical thoracoscopy in patients with minimal or absent pleural effusion.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40712947/',
    audio: {
      english: 'v1/thoracoscopy-without-ptx/english.mp3',
      mandarin: 'v1/thoracoscopy-without-ptx/mandarin.mp3',
      spanish: 'v1/thoracoscopy-without-ptx/spanish.mp3',
      arabic: 'v1/thoracoscopy-without-ptx/arabic.mp3',
      korean: 'v1/thoracoscopy-without-ptx/korean.mp3',
    },
  },
  {
    id: 'pleural-manometry-ptx',
    title:
      'Pleural Manometry in Pneumothorax: Evaluating Tension Physiology and Predicting Outcomes',
    citation:
      'Latifi, A., et al. (2026). "Pleural Manometry in Pneumothorax: Evaluating Tension Physiology and Predicting Outcomes." Chest 169(3): 830-836.',
    year: 2026,
    journal: 'Chest 169(3): 830-836.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: [
      'Chest Drains',
      'Manometry',
      'Pleural Effusion',
      'Pneumothorax',
      'Randomized Trial',
      'Thoracoscopy',
    ],
    synopsis:
      'Study of pleural manometry in pneumothorax evaluating tension physiology and whether pressure measurements help predict clinical outcomes.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41076067/',
    audio: {
      english: 'v1/pleural-manometry-ptx/english.mp3',
      mandarin: 'v1/pleural-manometry-ptx/mandarin.mp3',
      spanish: 'v1/pleural-manometry-ptx/spanish.mp3',
      arabic: 'v1/pleural-manometry-ptx/arabic.mp3',
      korean: 'v1/pleural-manometry-ptx/korean.mp3',
    },
  },
  {
    id: 'postthoracentesis-us-vs-cxr',
    title:
      'Post-Thoracentesis Ultrasound versus Chest Radiography for the Evaluation of Effusion Evacuation and Lung Reexpansion: A Multicenter Study',
    citation:
      'Ratwani, A., et al. (2025). "Post-Thoracentesis Ultrasound versus Chest Radiography for the Evaluation of Effusion Evacuation and Lung Reexpansion: A Multicenter Study." Ann Am Thorac Soc 22(9): 1321-1328.',
    year: 2025,
    journal: 'Ann Am Thorac Soc 22(9): 1321-1328.',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: ['Chest Drains', 'Lung Cancer', 'Pleural Effusion', 'Thoracoscopy', 'Ultrasound'],
    synopsis:
      'Multicenter study suggesting post-thoracentesis ultrasound can be an effective alternative to chest radiography for evaluating pleural space evacuation in simple effusions.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40439529/',
    audio: {
      english: 'v1/postthoracentesis-us-vs-cxr/english.mp3',
      mandarin: 'v1/postthoracentesis-us-vs-cxr/mandarin.mp3',
      spanish: 'v1/postthoracentesis-us-vs-cxr/spanish.mp3',
      arabic: 'v1/postthoracentesis-us-vs-cxr/arabic.mp3',
      korean: 'v1/postthoracentesis-us-vs-cxr/korean.mp3',
    },
  },
  {
    id: 'scope-pleural-infection',
    title:
      'Saline lavage alone prolongs drainage compared with intrapleural enzyme therapy in pleural infection: the SCOPE randomised controlled trial',
    citation:
      'Porcel, J. M., et al. (2026). "Saline lavage alone prolongs drainage compared with intrapleural enzyme therapy in pleural infection: the SCOPE randomised controlled trial." Eur Respir J 67(6).',
    year: 2026,
    journal: 'Eur Respir J 67(6).',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: [
      'Chest Drains',
      'Pleural Effusion',
      'Pleural Infection',
      'Randomized Trial',
      'Thoracoscopy',
    ],
    synopsis:
      'In pleural infection, saline lavage alone results in a longer drainage duration than IET. In this small superiority trial, adding saline lavage to IET did not demonstrate a clinically meaningful advantage over IET alone.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41713953/',
    audio: {
      english: 'v1/scope-pleural-infection/english.mp3',
      mandarin: 'v1/scope-pleural-infection/mandarin.mp3',
      spanish: 'v1/scope-pleural-infection/spanish.mp3',
      arabic: 'v1/scope-pleural-infection/arabic.mp3',
      korean: 'v1/scope-pleural-infection/korean.mp3',
    },
  },
  {
    id: 'vats-vs-percutaneous-tpc',
    title:
      'The Impact of Video-assisted Thoracoscopic Versus Percutaneous Tunneled Pleural Catheter Techniques on Pleurodesis Outcomes: A Retrospective, Single-center Study',
    citation:
      'Lin, J., et al. (2025). "The Impact of Video-assisted Thoracoscopic Versus Percutaneous Tunneled Pleural Catheter Techniques on Pleurodesis Outcomes: A Retrospective, Single-center Study." J Bronchology Interv Pulmonol 32(2).',
    year: 2025,
    journal: 'J Bronchology Interv Pulmonol 32(2).',
    primaryHub: 'Pleural Disease, Thoracoscopy & Chest Drains',
    tags: ['Chest Drains', 'IPC', 'Pleural Effusion', 'Thoracic Surgery', 'Thoracoscopy'],
    synopsis:
      'Thoracoscopic TPC placements may be associated with higher pleurodesis rates compared with a percutaneous technique. Our results are only hypothesis-generating, and these findings warrant confirmation in prospective studies.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40051083/',
    audio: {
      english: 'v1/vats-vs-percutaneous-tpc/english.mp3',
      mandarin: 'v1/vats-vs-percutaneous-tpc/mandarin.mp3',
      spanish: 'v1/vats-vs-percutaneous-tpc/spanish.mp3',
      arabic: 'v1/vats-vs-percutaneous-tpc/arabic.mp3',
      korean: 'v1/vats-vs-percutaneous-tpc/korean.mp3',
    },
  },
  {
    id: 'biodegradable-airway-stents',
    title: 'Biodegradable Stents-A New Option for Benign Central Airway Stenosis',
    citation:
      'Karcoglu, O., et al. (2025). "Biodegradable Stents-A New Option for Benign Central Airway Stenosis." Respirology 30(12): 1176-1183.',
    year: 2025,
    journal: 'Respirology 30(12): 1176-1183.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: ['Airway Stents', 'Benign Stenosis', 'CAO', 'Rigid Bronchoscopy', 'Thoracic Surgery'],
    synopsis:
      'Clinical experience with biodegradable airway stents for benign central airway stenosis, highlighting feasibility, early complications, and the need for follow-up strategies.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40878035/',
    audio: {
      english: 'v1/biodegradable-airway-stents/english.mp3',
      mandarin: 'v1/biodegradable-airway-stents/mandarin.mp3',
      spanish: 'v1/biodegradable-airway-stents/spanish.mp3',
      arabic: 'v1/biodegradable-airway-stents/arabic.mp3',
      korean: 'v1/biodegradable-airway-stents/korean.mp3',
    },
  },
  {
    id: 'airway-stent-fistula',
    title:
      'Efficacy and Safety of Airway Stent Placement in the Treatment of Airway Esophageal Fistula',
    citation:
      'Li, X., et al. (2025). "Efficacy and Safety of Airway Stent Placement in the Treatment of Airway Esophageal Fistula." Respiration 104(7): 476-484.',
    year: 2025,
    journal: 'Respiration 104(7): 476-484.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: ['AEF', 'Airway Stents', 'Bronchoscopy Safety', 'CAO', 'Thoracic Surgery'],
    synopsis:
      'Study of airway stenting for airway-esophageal fistula, focused on symptom palliation, quality of life, and survival in esophageal cancer-associated fistula.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39961291/',
    audio: {
      english: 'v1/airway-stent-fistula/english.mp3',
      mandarin: 'v1/airway-stent-fistula/mandarin.mp3',
      spanish: 'v1/airway-stent-fistula/spanish.mp3',
      arabic: 'v1/airway-stent-fistula/arabic.mp3',
      korean: 'v1/airway-stent-fistula/korean.mp3',
    },
  },
  {
    id: 'balloon-cryoablation-cao',
    title:
      'Efficacy and safety of novel airway balloon cryoablation system for malignant central airway obstruction: a prospective, multicentre, randomised, non-inferiority study',
    citation:
      'Liu, J., et al. (2025). "Efficacy and safety of novel airway balloon cryoablation system for malignant central airway obstruction: a prospective, multicentre, randomised, non-inferiority study." Thorax 80(11): 820-828.',
    year: 2025,
    journal: 'Thorax 80(11): 820-828.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: [
      'Airway Stents',
      'Bronchoscopy Safety',
      'CAO',
      'Cryotherapy',
      'Lung Cancer',
      'Malignant CAO',
      'Randomized Trial',
      'Thoracic Surgery',
    ],
    synopsis:
      'This study supports this novel system as an alternative to cryoablation via bronchoscope for MCAO patients. ChiCTR2100042051.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40796274/',
    audio: {
      english: 'v1/balloon-cryoablation-cao/english.mp3',
      mandarin: 'v1/balloon-cryoablation-cao/mandarin.mp3',
      spanish: 'v1/balloon-cryoablation-cao/spanish.mp3',
      arabic: 'v1/balloon-cryoablation-cao/arabic.mp3',
      korean: 'v1/balloon-cryoablation-cao/korean.mp3',
    },
  },
  {
    id: 'cryotherapy-airway-stenosis',
    title: 'Impact of cryotherapy on airway stenosis: In vivo, ex vivo, and in vitro studies',
    citation:
      'Chae, G., et al. (2026). "Impact of cryotherapy on airway stenosis: In vivo, ex vivo, and in vitro studies." J Therm Biol 136: 104399.',
    year: 2026,
    journal: 'J Therm Biol 136: 104399.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: ['Airway Stents', 'Benign Stenosis', 'CAO', 'Cryotherapy'],
    synopsis:
      "Cryoablation may inhibit stenosis progression by reducing TGF-1-regulated extracellular matrix deposition and fibrosis. These findings provide mechanistic insights into cryotherapy's therapeutic benefits for BCAS management.",
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41610749/',
    audio: {
      english: 'v1/cryotherapy-airway-stenosis/english.mp3',
      mandarin: 'v1/cryotherapy-airway-stenosis/mandarin.mp3',
      spanish: 'v1/cryotherapy-airway-stenosis/spanish.mp3',
      arabic: 'v1/cryotherapy-airway-stenosis/arabic.mp3',
      korean: 'v1/cryotherapy-airway-stenosis/korean.mp3',
    },
  },
  {
    id: 'accp-cao-guideline',
    title:
      'Management of Central Airway Obstruction: An American College of Chest Physicians Clinical Practice Guideline',
    citation:
      'Mahmood, K., et al. (2025). "Management of Central Airway Obstruction: An American College of Chest Physicians Clinical Practice Guideline." Chest 167(1): 283-295.',
    year: 2025,
    journal: 'Chest 167(1): 283-295.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: [
      'Airway Stents',
      'CAO',
      'Guideline',
      'Lung Cancer',
      'Malignant CAO',
      'Multidisciplinary Care',
      'Program Development',
      'Rigid Bronchoscopy',
      'Screening',
    ],
    synopsis:
      'Therapeutic options and outcomes are dependent on the underlying etiology of CAO. A multidisciplinary approach and shared decision-making with the patient are strongly encouraged.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39029785/',
    audio: {
      english: 'v1/accp-cao-guideline/english.mp3',
      mandarin: 'v1/accp-cao-guideline/mandarin.mp3',
      spanish: 'v1/accp-cao-guideline/spanish.mp3',
      arabic: 'v1/accp-cao-guideline/arabic.mp3',
      korean: 'v1/accp-cao-guideline/korean.mp3',
    },
  },
  {
    id: 'rigid-bronchoscopy-suite',
    title:
      'Safety and feasibility of performing rigid bronchoscopy in the bronchoscopy suite instead of the operating room',
    citation:
      'Mahajan, A. K., et al. (2025). "Safety and feasibility of performing rigid bronchoscopy in the bronchoscopy suite instead of the operating room." J Thorac Dis 17(6): 3667-3672.',
    year: 2025,
    journal: 'J Thorac Dis 17(6): 3667-3672.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: ['Airway Stents', 'Bronchoscopy Safety', 'CAO', 'Rigid Bronchoscopy'],
    synopsis:
      'Single-center experience suggesting rigid bronchoscopy for complex airway disease can be performed safely in a bronchoscopy suite for carefully selected patients.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40688339/',
    audio: {
      english: 'v1/rigid-bronchoscopy-suite/english.mp3',
      mandarin: 'v1/rigid-bronchoscopy-suite/mandarin.mp3',
      spanish: 'v1/rigid-bronchoscopy-suite/spanish.mp3',
      arabic: 'v1/rigid-bronchoscopy-suite/arabic.mp3',
      korean: 'v1/rigid-bronchoscopy-suite/korean.mp3',
    },
  },
  {
    id: 'tracheobronchial-stent-trends',
    title:
      'Temporal Trends and Mortality in Tracheobronchial Stenting in the United States: a national cohort study',
    citation:
      'Wayne, M. T., et al. (2026). "Temporal Trends and Mortality in Tracheobronchial Stenting in the United States: a national cohort study." Ann Am Thorac Soc.',
    year: 2026,
    journal: 'Ann Am Thorac Soc.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: ['Airway Stents', 'CAO', 'Guideline', 'Lung Cancer', 'Thoracic Surgery'],
    synopsis:
      'Tracheobronchial stenting incidence and mortality for CAO have both increased over time. Regional variation and high in-hospital mortality highlight the need to better define indications and track outcomes of tracheobronchial stenting in patients with CAO.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/42011560/',
    audio: {
      english: 'v1/tracheobronchial-stent-trends/english.mp3',
      mandarin: 'v1/tracheobronchial-stent-trends/mandarin.mp3',
      spanish: 'v1/tracheobronchial-stent-trends/spanish.mp3',
      arabic: 'v1/tracheobronchial-stent-trends/arabic.mp3',
      korean: 'v1/tracheobronchial-stent-trends/korean.mp3',
    },
  },
  {
    id: 'pediatric-therapeutic-bronchoscopy',
    title:
      'Therapeutic Bronchoscopic Interventions for Non Foreign-Body Removal Indications in Children',
    citation:
      'Madan, K., et al. (2025). "Therapeutic Bronchoscopic Interventions for Non Foreign-Body Removal Indications in Children." Pediatr Pulmonol 60(1): e27462.',
    year: 2025,
    journal: 'Pediatr Pulmonol 60(1): e27462.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: [
      'Airway Stents',
      'Benign Stenosis',
      'CAO',
      'Cryotherapy',
      'Pediatrics',
      'Rigid Bronchoscopy',
    ],
    synopsis:
      'Thirty-three (46%) children required a repeat bronchoscopic procedure. Like adults, multimodality therapeutic bronchoscopic airway interventions are feasible and safe in children for CAO and other central airway indications.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39739345/',
    audio: {
      english: 'v1/pediatric-therapeutic-bronchoscopy/english.mp3',
      mandarin: 'v1/pediatric-therapeutic-bronchoscopy/mandarin.mp3',
      spanish: 'v1/pediatric-therapeutic-bronchoscopy/spanish.mp3',
      arabic: 'v1/pediatric-therapeutic-bronchoscopy/arabic.mp3',
      korean: 'v1/pediatric-therapeutic-bronchoscopy/korean.mp3',
    },
  },
  {
    id: 'wabip-airway-stenting',
    title:
      'World Association for Bronchology and Interventional Pulmonology (WABIP) Guidelines on Airway Stenting for Benign Central Airway Obstruction',
    citation:
      'Chaddha, U., et al. (2025). "World Association for Bronchology and Interventional Pulmonology (WABIP) Guidelines on Airway Stenting for Benign Central Airway Obstruction." Respirology 30(7): 587-604.',
    year: 2025,
    journal: 'Respirology 30(7): 587-604.',
    primaryHub: 'Central Airway Obstruction, Stents & Therapeutic Bronchoscopy',
    tags: [
      'Airway Stents',
      'Benign Stenosis',
      'CAO',
      'Guideline',
      'Multidisciplinary Care',
      'Program Development',
      'Thoracic Surgery',
    ],
    synopsis:
      'WABIP guideline addressing airway stenting for benign central airway obstruction, using systematic evidence review, expert experience, and modified Delphi consensus.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40575842/',
    audio: {
      english: 'v1/wabip-airway-stenting/english.mp3',
      mandarin: 'v1/wabip-airway-stenting/mandarin.mp3',
      spanish: 'v1/wabip-airway-stenting/spanish.mp3',
      arabic: 'v1/wabip-airway-stenting/arabic.mp3',
      korean: 'v1/wabip-airway-stenting/korean.mp3',
    },
  },
  {
    id: 'breathe-airway-scaffolds',
    title:
      'Airway Scaffolds for Emphysema-related Hyperinflation: Six-Month Results from the BREATHE Trial',
    citation:
      'Tana, A., et al. (2025). "Airway Scaffolds for Emphysema-related Hyperinflation: Six-Month Results from the BREATHE Trial." Am J Respir Crit Care Med 211(7): 1175-1184.',
    year: 2025,
    journal: 'Am J Respir Crit Care Med 211(7): 1175-1184.',
    primaryHub: 'Emphysema, BLVR & Hyperinflation',
    tags: [
      'Airway Scaffolds',
      'BLVR',
      'Bronchoscopy Safety',
      'Emphysema',
      'Hyperinflation',
      'Pneumothorax',
      'Randomized Trial',
    ],
    synopsis:
      'BREATHE trial report providing early clinical evidence on airway scaffolds for emphysema-related hyperinflation, including feasibility, safety, physiology, and quality-of-life signals.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40387356/',
    audio: {
      english: 'v1/breathe-airway-scaffolds/english.mp3',
      mandarin: 'v1/breathe-airway-scaffolds/mandarin.mp3',
      spanish: 'v1/breathe-airway-scaffolds/spanish.mp3',
      arabic: 'v1/breathe-airway-scaffolds/arabic.mp3',
      korean: 'v1/breathe-airway-scaffolds/korean.mp3',
    },
  },
  {
    id: 'ebv-blvr-consensus',
    title:
      'Bronchoscopic Lung Volume Reduction with Endobronchial Valves: A Consensus Statement on Practical Aspects of Patient Selection and Periprocedural Management',
    citation:
      'Wahidi, M. M., et al. (2026). "Bronchoscopic Lung Volume Reduction with Endobronchial Valves: A Consensus Statement on Practical Aspects of Patient Selection and Periprocedural Management." Respiration 105(3): 397-420.',
    year: 2026,
    journal: 'Respiration 105(3): 397-420.',
    primaryHub: 'Emphysema, BLVR & Hyperinflation',
    tags: [
      'BLVR',
      'Emphysema',
      'Endobronchial Valves',
      'Guideline',
      'Hyperinflation',
      'Randomized Trial',
    ],
    synopsis:
      'Consensus statement offering practical guidance on patient selection and periprocedural management for bronchoscopic lung volume reduction with endobronchial valves.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40952939/',
    audio: {
      english: 'v1/ebv-blvr-consensus/english.mp3',
      mandarin: 'v1/ebv-blvr-consensus/mandarin.mp3',
      spanish: 'v1/ebv-blvr-consensus/spanish.mp3',
      arabic: 'v1/ebv-blvr-consensus/arabic.mp3',
      korean: 'v1/ebv-blvr-consensus/korean.mp3',
    },
  },
  {
    id: 'oneway-valves-elvr',
    title:
      'Comparison of Efficacy and Safety of Different Types of One-Way Valves in Endoscopic Lung Volume Reduction in Patients with Severe Lung Emphysema',
    citation:
      'Sgarbossa, T., et al. (2025). "Comparison of Efficacy and Safety of Different Types of One-Way Valves in Endoscopic Lung Volume Reduction in Patients with Severe Lung Emphysema." Respiration 104(4): 281-289.',
    year: 2025,
    journal: 'Respiration 104(4): 281-289.',
    primaryHub: 'Emphysema, BLVR & Hyperinflation',
    tags: [
      'BLVR',
      'Bronchoscopy Safety',
      'Emphysema',
      'Endobronchial Valves',
      'Hyperinflation',
      'Pneumothorax',
      'Randomized Trial',
    ],
    synopsis:
      'We recommend choosing the valve type based on individual bronchial anatomy. However, further randomized studies are needed to confirm our results.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39586268/',
    audio: {
      english: 'v1/oneway-valves-elvr/english.mp3',
      mandarin: 'v1/oneway-valves-elvr/mandarin.mp3',
      spanish: 'v1/oneway-valves-elvr/spanish.mp3',
      arabic: 'v1/oneway-valves-elvr/arabic.mp3',
      korean: 'v1/oneway-valves-elvr/korean.mp3',
    },
  },
  {
    id: 'severe-ptx-after-blvr',
    title:
      'Lessons Learned: Risk Factors and Clinical Impact of Severe Pneumothorax After Endoscopic Lung Volume Reduction With Endobronchial Valves',
    citation:
      'Brock, J. M., et al. (2025). "Lessons Learned: Risk Factors and Clinical Impact of Severe Pneumothorax After Endoscopic Lung Volume Reduction With Endobronchial Valves." Chest 167(4): 1012-1023.',
    year: 2025,
    journal: 'Chest 167(4): 1012-1023.',
    primaryHub: 'Emphysema, BLVR & Hyperinflation',
    tags: [
      'Atelectasis',
      'BLVR',
      'Emphysema',
      'Endobronchial Valves',
      'Hyperinflation',
      'Pneumothorax',
    ],
    synopsis:
      'Retrospective BLVR study identifying risk factors and clinical impact of severe pneumothorax after endobronchial valve therapy.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39521377/',
    audio: {
      english: 'v1/severe-ptx-after-blvr/english.mp3',
      mandarin: 'v1/severe-ptx-after-blvr/mandarin.mp3',
      spanish: 'v1/severe-ptx-after-blvr/spanish.mp3',
      arabic: 'v1/severe-ptx-after-blvr/arabic.mp3',
      korean: 'v1/severe-ptx-after-blvr/korean.mp3',
    },
  },
  {
    id: 'chest-drain-removal',
    title: 'A National Evaluation of Intercostal Chest Drain Removal Strategies',
    citation:
      'Veale, N., et al. (2026). "A National Evaluation of Intercostal Chest Drain Removal Strategies." Chest 169(3): 849-858.',
    year: 2026,
    journal: 'Chest 169(3): 849-858.',
    primaryHub: 'Training, Procedural Safety & Program Design',
    tags: [
      'Bronchoscopy Safety',
      'Chest Drains',
      'Education',
      'Multidisciplinary Care',
      'Pneumothorax',
      'Program Development',
      'Randomized Trial',
    ],
    synopsis:
      'Clamping trials are safe but do not appear to be associated with reduced rates of recurrent pneumothorax. An ultracautious approach using digital air leak devices in combination with clamping could represent a viable strategy in selected patients.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41192553/',
    audio: {
      english: 'v1/chest-drain-removal/english.mp3',
      mandarin: 'v1/chest-drain-removal/mandarin.mp3',
      spanish: 'v1/chest-drain-removal/spanish.mp3',
      arabic: 'v1/chest-drain-removal/arabic.mp3',
      korean: 'v1/chest-drain-removal/korean.mp3',
    },
  },
  {
    id: 'hfnc-highrisk-bronchoscopy-rct',
    title:
      'Comparison of High-Flow Nasal Cannula and Conventional Oxygen Therapy for High Risk Patients During Bronchoscopy Examination: A Multicenter Randomized Controlled Trial',
    citation:
      'Qin, H., et al. (2025). "Comparison of High-Flow Nasal Cannula and Conventional Oxygen Therapy for High Risk Patients During Bronchoscopy Examination: A Multicenter Randomized Controlled Trial." Ann Am Thorac Soc 22(7): 1018-1026.',
    year: 2025,
    journal: 'Ann Am Thorac Soc 22(7): 1018-1026.',
    primaryHub: 'Training, Procedural Safety & Program Design',
    tags: [
      'Benign Stenosis',
      'Bronchoscopy Safety',
      'Education',
      'HFNC',
      'Multidisciplinary Care',
      'Program Development',
      'Randomized Trial',
    ],
    synopsis:
      'Multicenter randomized trial comparing high-flow nasal cannula with conventional oxygen therapy during bronchoscopy in high-risk patients.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/40106752/',
    audio: {
      english: 'v1/hfnc-highrisk-bronchoscopy-rct/english.mp3',
      mandarin: 'v1/hfnc-highrisk-bronchoscopy-rct/mandarin.mp3',
      spanish: 'v1/hfnc-highrisk-bronchoscopy-rct/spanish.mp3',
      arabic: 'v1/hfnc-highrisk-bronchoscopy-rct/arabic.mp3',
      korean: 'v1/hfnc-highrisk-bronchoscopy-rct/korean.mp3',
    },
  },
  {
    id: 'hfnc-bronchoscopy-metaanalysis',
    title:
      'High-Flow Nasal Cannula Versus Conventional Oxygen Therapy During Bronchoscopy: A Meta-Analysis of Randomized Controlled Trials',
    citation:
      'Miranda Fliess de Castro, R., et al. (2026). "High-Flow Nasal Cannula Versus Conventional Oxygen Therapy During Bronchoscopy: A Meta-Analysis of Randomized Controlled Trials." J Bronchology Interv Pulmonol 33(3).',
    year: 2026,
    journal: 'J Bronchology Interv Pulmonol 33(3).',
    primaryHub: 'Training, Procedural Safety & Program Design',
    tags: [
      'Bronchoscopy Safety',
      'Education',
      'HFNC',
      'Multidisciplinary Care',
      'Program Development',
      'Randomized Trial',
    ],
    synopsis:
      'HFNC significantly reduces hypoxemic events and improves oxygenation compared with COT during bronchoscopy. Although anesthetic use slightly increased, there was no difference in procedure time or patient comfort.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/42076910/',
    audio: {
      english: 'v1/hfnc-bronchoscopy-metaanalysis/english.mp3',
      mandarin: 'v1/hfnc-bronchoscopy-metaanalysis/mandarin.mp3',
      spanish: 'v1/hfnc-bronchoscopy-metaanalysis/spanish.mp3',
      arabic: 'v1/hfnc-bronchoscopy-metaanalysis/arabic.mp3',
      korean: 'v1/hfnc-bronchoscopy-metaanalysis/korean.mp3',
    },
  },
  {
    id: 'fellow-participation-bronchoscopy',
    title:
      'Impact of Pulmonary and Critical Care Fellow Participation during Advanced Diagnostic Bronchoscopy',
    citation:
      'Chrissian, A. A., et al. (2025). "Impact of Pulmonary and Critical Care Fellow Participation during Advanced Diagnostic Bronchoscopy." ATS Sch 6(1): 36-51.',
    year: 2025,
    journal: 'ATS Sch 6(1): 36-51.',
    primaryHub: 'Training, Procedural Safety & Program Design',
    tags: [
      'Bronchoscopy Safety',
      'EBUS',
      'Education',
      'Multidisciplinary Care',
      'Program Development',
      'ROSE',
      'Ultrasound',
    ],
    synopsis:
      'Procedures performed with fellows on the steepest portion of the ADB learning curve are the least efficient. Fellowship directors and faculty bronchoscopists should acknowledge these potential impacts on ABD practice while optimizing the approach to bronchoscopy training.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39909026/',
    audio: {
      english: 'v1/fellow-participation-bronchoscopy/english.mp3',
      mandarin: 'v1/fellow-participation-bronchoscopy/mandarin.mp3',
      spanish: 'v1/fellow-participation-bronchoscopy/spanish.mp3',
      arabic: 'v1/fellow-participation-bronchoscopy/arabic.mp3',
      korean: 'v1/fellow-participation-bronchoscopy/korean.mp3',
    },
  },
  {
    id: 'ip-thoracic-surgery-collaboration',
    title:
      'Integrating interventional pulmonology and thoracic surgery: a multidisciplinary approach to advanced pulmonary care',
    citation:
      'Swenson, K., et al. (2026). "Integrating interventional pulmonology and thoracic surgery: a multidisciplinary approach to advanced pulmonary care." J Thorac Dis 18(2): 159.',
    year: 2026,
    journal: 'J Thorac Dis 18(2): 159.',
    primaryHub: 'Training, Procedural Safety & Program Design',
    tags: [
      'Airway Stents',
      'BLVR',
      'Bronchoscopy Safety',
      'Education',
      'Lung Cancer',
      'Multidisciplinary Care',
      'Pleural Infection',
      'Program Development',
      'Randomized Trial',
      'Thoracic Surgery',
    ],
    synopsis:
      'Framework article describing collaboration between interventional pulmonology and thoracic surgery for advanced pulmonary care, program design, and embedded clinical research.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/41816400/',
    audio: {
      english: 'v1/ip-thoracic-surgery-collaboration/english.mp3',
      mandarin: 'v1/ip-thoracic-surgery-collaboration/mandarin.mp3',
      spanish: 'v1/ip-thoracic-surgery-collaboration/spanish.mp3',
      arabic: 'v1/ip-thoracic-surgery-collaboration/arabic.mp3',
      korean: 'v1/ip-thoracic-surgery-collaboration/korean.mp3',
    },
  },
  {
    id: 'vr-ebus-anatomy-trainer',
    title: 'Virtual Reality Anatomy Trainer Turns Teaching Endobronchial Ultrasound Inside-Out',
    citation:
      'New, M. L., et al. (2025). "Virtual Reality Anatomy Trainer Turns Teaching Endobronchial Ultrasound Inside-Out." Chest 167(5): 1440-1450.',
    year: 2025,
    journal: 'Chest 167(5): 1440-1450.',
    primaryHub: 'Training, Procedural Safety & Program Design',
    tags: [
      'Bronchoscopy Safety',
      'EBUS',
      'Education',
      'Multidisciplinary Care',
      'Program Development',
      'Randomized Trial',
      'Simulation',
      'Ultrasound',
    ],
    synopsis:
      'A VR anatomy trainer was preferred by learners because it provided visualization that aligned best with the procedural perspective. This approach helped learners of all spatial reasoning ability improve their procedural performance.',
    publicationUrl: 'https://pubmed.ncbi.nlm.nih.gov/39662667/',
    audio: {
      english: 'v1/vr-ebus-anatomy-trainer/english.mp3',
      mandarin: 'v1/vr-ebus-anatomy-trainer/mandarin.mp3',
      spanish: 'v1/vr-ebus-anatomy-trainer/spanish.mp3',
      arabic: 'v1/vr-ebus-anatomy-trainer/arabic.mp3',
      korean: 'v1/vr-ebus-anatomy-trainer/korean.mp3',
    },
  },
] satisfies JournalClubPodcastEpisode[]

export const journalClubPodcastTags = Array.from(
  new Set(journalClubPodcastEpisodes.flatMap((episode) => episode.tags)),
).sort((a, b) => a.localeCompare(b))
