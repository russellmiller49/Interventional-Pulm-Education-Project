export type BoardReviewCategory =
  | 'airway'
  | 'oncology'
  | 'pleura'
  | 'procedures'
  | 'quality'
  | 'practice-management'
  | 'navigation'
  | 'ablation'

export interface BoardReviewChapterMeta {
  slug: string
  title: string
  description: string
  summary: string
  category: BoardReviewCategory
  estimatedMinutes: number
  examDomains: string[]
  tags: string[]
  focus: string[]
  sourceFile: string
  order: number
  published?: boolean
}

export const boardReviewChapters: BoardReviewChapterMeta[] = [
  {
    slug: 'rigid-bronchoscopy',
    title: 'Rigid Bronchoscopy: Indications, Technique, and Troubleshooting',
    description:
      'Procedural playbook covering patient selection, anesthesia, instrument sequencing, and complication rescue for therapeutic rigid bronchoscopy.',
    summary:
      'Aligns modern malignant and benign airway obstruction management with stepwise rigid bronchoscopy technique, including ventilation strategies, debulking workflow, stenting pearls, and crisis algorithms.',
    category: 'airway',
    estimatedMinutes: 32,
    examDomains: ['Rigid bronchoscopy', 'Bleeding control', 'Airway stents'],
    tags: ['central airway obstruction', 'therapeutic bronchoscopy', 'stents'],
    focus: ['Debulking sequence', 'Foreign body extraction', 'Complication mitigation'],
    sourceFile: 'rigid-bronchoscopy-indications-technique.mdx',
    order: 1,
  },
  {
    slug: 'anesthesia-for-ip',
    title: 'Anesthesia for Interventional Pulmonology',
    description:
      'Sedation, airway device, and ventilation strategy selection for EBUS, peripheral navigation, rigid procedures, and pleuroscopy.',
    summary:
      'Exam-focused guide to matching anesthetic depth and airway devices to procedure goals while preventing atelectasis, oxygen toxicity during thermal therapies, and hemodynamic collapse in high-risk physiology.',
    category: 'airway',
    estimatedMinutes: 28,
    examDomains: ['Sedation strategy', 'Ventilation', 'Crisis response'],
    tags: ['EBUS', 'BLVR', 'airway fire prevention'],
    focus: ['Ventilation bundles', 'Airway device matching', 'Hypoxemia algorithms'],
    sourceFile: 'anesthesia-for-ip.mdx',
    order: 2,
  },
  {
    slug: 'bronchoscopy-in-high-risk-patients',
    title: 'Bronchoscopy in High-Risk Patients & Complication Management',
    description:
      'Risk stratification, antithrombotic management, and complication mitigation for bronchoscopy in unstable or complex patients.',
    summary:
      'Covers pre-procedural optimization, sedative tailoring, bleeding algorithms, hypoxemia rescue, and special considerations for pregnancy and pulmonary hypertension.',
    category: 'airway',
    estimatedMinutes: 30,
    examDomains: ['Complications', 'Risk mitigation', 'Bleeding algorithms'],
    tags: ['pregnancy', 'pulmonary hypertension', 'antithrombotics'],
    focus: ['Bleeding control', 'Hypoxemia rescue', 'Scenario algorithms'],
    sourceFile: 'bronchoscopy-in-high-risk-patients-and-complications-in-bronchoscopy.mdx',
    order: 3,
  },
  {
    slug: 'peripheral-biopsy-techniques',
    title: 'Peripheral Biopsy Techniques: Conventional & Cryobiopsy',
    description:
      'Decision pathways for conventional, navigational, and cryobiopsy approaches to peripheral pulmonary lesions.',
    summary:
      'Integrates lesion characterization, tool selection, rEBUS/fluoro targeting, cryobiopsy protocols, complication avoidance, and yield optimization pearls.',
    category: 'oncology',
    estimatedMinutes: 34,
    examDomains: ['Peripheral lesions', 'Cryobiopsy', 'Yield optimization'],
    tags: ['robotic bronchoscopy', 'radial EBUS', 'cryobiopsy'],
    focus: ['Tool sequencing', 'Complication prevention', 'Quality metrics'],
    sourceFile: 'peripheral-biopsy-techniques-conventional-sampling-and-transbronchial-cryobiopsy.mdx',
    order: 4,
  },
  {
    slug: 'lung-cancer-staging',
    title: 'Lung Cancer Staging & Linear EBUS',
    description:
      'TNM-9 staging updates paired with systematic EBUS-TBNA workflows, sampling order, and decision algorithms.',
    summary:
      'Emphasizes imaging triage, nodal maps, systematic versus targeted staging, sample adequacy, troubleshooting, and post-test decision making including mediastinoscopy triggers.',
    category: 'oncology',
    estimatedMinutes: 33,
    examDomains: ['TNM staging', 'EBUS technique', 'Invasive staging'],
    tags: ['mediastinal staging', 'systematic sampling', 'TNM-9'],
    focus: ['Station mapping', 'Sampling order', 'Negative EBUS interpretation'],
    sourceFile: 'lung-cancer-staging-and-linear-ebus.mdx',
    order: 5,
  },
  {
    slug: 'lung-cancer-screening',
    title: 'Lung Cancer Screening & Nodule Pathways',
    description:
      'USPSTF/ACCP screening frameworks, Lung-RADS updates, incidental nodule management, and shared decision-making.',
    summary:
      'Summarizes eligibility requirements, program infrastructure, nodule follow-up algorithms, reimbursement coding, and approach to positive screens and quality metrics.',
    category: 'oncology',
    estimatedMinutes: 26,
    examDomains: ['Screening guidelines', 'Nodule management', 'Program metrics'],
    tags: ['lung-rads', 'shared decision-making', 'incidental nodules'],
    focus: ['Eligibility pathways', 'Algorithm memorization', 'Quality requirements'],
    sourceFile: 'lung-cancer-screening.mdx',
    order: 6,
  },
  {
    slug: 'pleural-effusions',
    title: 'Pleural Effusions & Pleural Interventions',
    description:
      'Diagnostic algorithms, ultrasound-guided thoracentesis, chest tubes, IPCs, and malignant effusion pathways.',
    summary:
      'Highlights ultrasound-first evaluation, manometry use, tube size selection, IPC versus pleurodesis decisions, complication management, and trapped lung considerations.',
    category: 'pleura',
    estimatedMinutes: 32,
    examDomains: ['Thoracentesis', 'Malignant effusions', 'Pleural ultrasound'],
    tags: ['thoracentesis', 'IPC', 'pleurodesis'],
    focus: ['Safety thresholds', 'Algorithmic management', 'Complication rescue'],
    sourceFile: 'pleural-effusions-and-pleural-interventions.mdx',
    order: 7,
  },
  {
    slug: 'pleural-infections',
    title: 'Pleural Infections',
    description:
      'Empyema staging, diagnostic approach, drainage strategies, fibrinolytics, and escalation to surgery.',
    summary:
      'Covers imaging and microbiology, RAPID score risk stratification, tube management, intrapleural tPA/DNase protocols, and team-based management of complex infection.',
    category: 'pleura',
    estimatedMinutes: 24,
    examDomains: ['Empyema staging', 'Drainage algorithms', 'IET protocols'],
    tags: ['intrapleural therapy', 'empyema', 'small-bore drains'],
    focus: ['RAPID score use', 'Drain troubleshooting', 'Escalation criteria'],
    sourceFile: 'pleural-infections.mdx',
    order: 8,
  },
  {
    slug: 'pneumothorax-and-pal',
    title: 'Pneumothorax, Prolonged Air Leak, & Bronchopleural Fistula',
    description:
      'Evidence-based pathways for spontaneous/secondary pneumothorax, PAL management, and bronchoscopic closure techniques.',
    summary:
      'Explores chest tube selection, suction strategies, blood patching, valves/spigots, fistula closure options, and postoperative/ventilated patient nuances.',
    category: 'pleura',
    estimatedMinutes: 29,
    examDomains: ['Pneumothorax algorithms', 'PAL management', 'Bronchoscopic closure'],
    tags: ['air leak', 'endobronchial valves', 'thoracic surgery interface'],
    focus: ['Chest tube strategy', 'Valve selection', 'Weaning pathways'],
    sourceFile: 'pneumothorax-prolonged-air-leaks-and-bronchopleural-fistula.mdx',
    order: 9,
  },
  {
    slug: 'indwelling-pleural-catheters',
    title: 'Indwelling Pleural Catheters & Pleurodesis',
    description:
      'Patient selection, procedural technique, outpatient pathways, and quality metrics for IPCs and chemical/surgical pleurodesis.',
    summary:
      'Details IPC insertion technique, autopleurodesis acceleration, infection troubleshooting, talc pleurodesis protocols, and multidisciplinary malignant effusion care.',
    category: 'pleura',
    estimatedMinutes: 25,
    examDomains: ['Malignant effusion', 'IPC management', 'Pleurodesis'],
    tags: ['IPC', 'talc', 'malignant pleural effusion'],
    focus: ['Autopleurodesis', 'Infection management', 'Program logistics'],
    sourceFile: 'indwelling-pleural-catheters-and-pleurodesis.mdx',
    order: 10,
  },
  {
    slug: 'percutaneous-tracheostomy',
    title: 'Percutaneous Tracheostomy & Cricothyroidotomy',
    description:
      'Bedside airway creation techniques, patient selection, complication avoidance, and emergency conversion algorithms.',
    summary:
      'Includes pre-procedure assessment, bronchoscopic guidance, stepwise dilation, troubleshooting, post-procedure care, and when to favor surgical approaches.',
    category: 'procedures',
    estimatedMinutes: 27,
    examDomains: ['Tracheostomy', 'Emergency airway', 'Complications'],
    tags: ['percutaneous trach', 'cricothyroidotomy', 'critical care'],
    focus: ['Patient selection', 'Bleeding control', 'Emergency rescue'],
    sourceFile: 'percutaneous-tracheostomy-and-cricothyroidotomy.mdx',
    order: 11,
  },
  {
    slug: 'coding-and-billing',
    title: 'Coding, Billing, & Documentation for IP',
    description:
      'Revenue cycle essentials, current procedural terminology (CPT) updates, modifier usage, and compliance pearls for interventional pulmonology.',
    summary:
      'Translates bronchoscopy, pleural, and navigation procedure coding into exam-ready tables with modifier guidance, facility vs professional splits, and documentation checklists.',
    category: 'practice-management',
    estimatedMinutes: 22,
    examDomains: ['CPT coding', 'Modifiers', 'Documentation'],
    tags: ['revenue cycle', 'compliance', 'CPT updates'],
    focus: ['High-yield codes', 'Modifiers', 'Payer language'],
    sourceFile: 'coding-and-billing.mdx',
    order: 12,
  },
  {
    slug: 'airway-stents',
    title: 'Airway Stent Selection & Troubleshooting',
    description:
      'Evidence-based guidance on selecting, deploying, and troubleshooting silicone and metallic airway stents across benign and malignant disease.',
    summary:
      'Covers sizing strategies, deployment workflows, complication prevention, emergent rescue tactics, and post-placement surveillance algorithms for airway stents.',
    category: 'airway',
    estimatedMinutes: 30,
    examDomains: ['Stent selection', 'Deployment technique', 'Complication management'],
    tags: ['silicone stents', 'metallic stents', 'granulation tissue'],
    focus: ['Sizing pearls', 'Deployment pitfalls', 'Rescue algorithms'],
    sourceFile: 'airway-stents.mdx',
    order: 13,
  },
  {
    slug: 'non-malignant-cao',
    title: 'Management of Non-Malignant Central Airway Obstruction',
    description:
      'Approach to benign central airway obstruction including inflammatory, post-intubation, and structural etiologies with procedural and medical strategies.',
    summary:
      'Reviews classification, diagnostic imaging, airway stabilization, dilation/incision techniques, adjuvant therapies, and long-term follow-up pathways for benign CAO.',
    category: 'airway',
    estimatedMinutes: 28,
    examDomains: ['Benign CAO', 'Dilation techniques', 'Adjuvant therapy'],
    tags: ['benign stenosis', 'dilation', 'spray cryotherapy'],
    focus: ['Etiology-specific algorithms', 'Scar modulation', 'Surveillance planning'],
    sourceFile: 'non-malignant-cao.mdx',
    order: 14,
  },
  {
    slug: 'early-stage-lung-cancer',
    title: 'Treatment Options for Early-Stage Lung Cancer',
    description:
      'Comparative review of surgical and non-surgical therapies for stage I–II lung cancer including SBRT, ablation, and shared decision frameworks.',
    summary:
      'Highlights modern surgical approaches, stereotactic radiation, bronchoscopic ablative trials, patient selection, and perioperative optimization for early-stage disease.',
    category: 'oncology',
    estimatedMinutes: 27,
    examDomains: ['Stage I/II therapy', 'SBRT', 'Bronchoscopic ablation'],
    tags: ['SBRT', 'segmentectomy', 'bronchoscopic ablation'],
    focus: ['Shared decision making', 'Ablative pathways', 'Perioperative optimization'],
    sourceFile: 'treatment-options-for-early-stage-lung-cancer.mdx',
    order: 15,
  },
  {
    slug: 'advanced-peripheral-bronchoscopy-radial-probe-electromagnetic-navigation-and-robotic-bronchoscopy',
    title: 'Advanced Peripheral Bronchoscopy: Radial, EMN, and Robotic Navigation',
    description:
      'Comprehensive strategies for radial probe EBUS, electromagnetic navigation, and robotic bronchoscopy including target selection, workflow integration, and troubleshooting.',
    summary:
      'Covers pre-procedural imaging, airway planning, lesion targeting, navigation platform comparisons, and yield optimization for peripheral pulmonary lesions.',
    category: 'navigation',
    estimatedMinutes: 36,
    examDomains: ['Radial probe EBUS', 'EM navigation', 'Robotic bronchoscopy'],
    tags: ['peripheral lesions', 'navigation', 'robotics'],
    focus: ['Target planning', 'Navigation workflow', 'Complication mitigation'],
    sourceFile:
      'advanced-peripheral-bronchoscopy-radial-probe-electromagnetic-navigation-and-robotic-bronchoscopy.mdx',
    order: 16,
  },
  {
    slug: 'bronchoscopic-and-surgical-treatment-for-copd-and-chronic-bronchitis',
    title: 'Bronchoscopic & Surgical Treatment for COPD and Chronic Bronchitis',
    description:
      'Decision frameworks for lung volume reduction, endobronchial valves, coils, targeted vapor therapy, and surgical options in advanced COPD/chronic bronchitis.',
    summary:
      'Discusses patient selection, physiologic testing, device selection, staged treatment pathways, and complication management for bronchoscopic lung volume reduction and surgery.',
    category: 'ablation',
    estimatedMinutes: 32,
    examDomains: ['BLVR', 'COPD interventions', 'Valve therapy'],
    tags: ['COPD', 'lung volume reduction', 'valves'],
    focus: ['Selection criteria', 'Valve deployment', 'Complication rescue'],
    sourceFile: 'bronchoscopic-and-surgical-treatment-for-copd-and-chronic-bronchitis.mdx',
    order: 17,
  },
  {
    slug: 'diagnostic-approach-to-pulmonary-nodules',
    title: 'Diagnostic Approach to Pulmonary Nodules',
    description:
      'Risk stratification, imaging follow-up, and biopsy selection for pulmonary nodules using evidence-based algorithms.',
    summary:
      'Integrates guideline pathways, probability calculators, and multidisciplinary decision making to plan diagnostics and surveillance.',
    category: 'oncology',
    estimatedMinutes: 24,
    examDomains: ['Pulmonary nodules', 'Risk models', 'Diagnostic algorithms'],
    tags: ['nodule', 'risk assessment', 'imaging follow-up'],
    focus: ['Risk calculators', 'Follow-up intervals', 'Biopsy decisions'],
    sourceFile: 'diagnostic-approach-to-pulmonary-nodules.mdx',
    order: 18,
  },
  {
    slug: 'management-of-malignant-central-airway-obstruction',
    title: 'Management of Malignant Central Airway Obstruction',
    description:
      'Algorithmic approach to malignant central airway obstruction including debulking modalities, stent selection, systemic therapy coordination, and post-procedure care.',
    summary:
      'Highlights multimodality therapy, energy selection, stent decision-making, palliative frameworks, and outcome predictors for malignant airway obstruction.',
    category: 'airway',
    estimatedMinutes: 34,
    examDomains: ['Malignant CAO', 'Thermal therapy', 'Stenting'],
    tags: ['malignant obstruction', 'stenting', 'debulking'],
    focus: ['Modality selection', 'Team coordination', 'Post-procedure care'],
    sourceFile: 'management-of-malignant-central-airway-obstruction.mdx',
    order: 19,
  },
  {
    slug: 'mechanical-debridement-and-balloon-dilitation',
    title: 'Mechanical Debridement & Balloon Dilation',
    description:
      'Technique review for rigid/flexible mechanical coring, microdebriders, and balloon dilation in benign and malignant airway disease.',
    summary:
      'Discusses instrument selection, setup, procedural sequencing, complication avoidance, and combined modality use for mechanical airway restoration.',
    category: 'airway',
    estimatedMinutes: 26,
    examDomains: ['Mechanical debulking', 'Balloon dilation', 'Airway restoration'],
    tags: ['mechanical debridement', 'balloon dilation', 'benign stenosis'],
    focus: ['Tool selection', 'Technique steps', 'Complication mitigation'],
    sourceFile: 'mechanical-debridement-and-balloon-dilitation.mdx',
    order: 20,
  },
  {
    slug: 'pathology-histology-cytology-rose-and-molecular-markers',
    title: 'Pathology: Histology, Cytology, ROSE & Molecular Markers',
    description:
      'Biopsy handling, ROSE best practices, immunohistochemistry panels, and molecular testing pathways for lung cancer and ILD.',
    summary:
      'Reviews sample preparation, cell block optimization, reflex testing, and communication with pathology to maximize diagnostic yield.',
    category: 'oncology',
    estimatedMinutes: 28,
    examDomains: ['ROSE', 'Molecular testing', 'Specimen handling'],
    tags: ['pathology', 'ROSE', 'molecular markers'],
    focus: ['Specimen triage', 'Testing pathways', 'Communication with pathology'],
    sourceFile: 'pathology-histology-cytology-rose-and-molecular-markers.mdx',
    order: 21,
  },
  {
    slug: 'real-time-peripheral-imaging-techniques',
    title: 'Real-Time Peripheral Imaging Techniques',
    description:
      'Advanced imaging modalities for peripheral lung lesions including cone-beam CT, augmented fluoroscopy, and tomosynthesis.',
    summary:
      'Covers workflow integration, radiation safety, lesion visualization strategies, and troubleshooting for real-time guidance systems.',
    category: 'navigation',
    estimatedMinutes: 30,
    examDomains: ['Cone-beam CT', 'Augmented fluoroscopy', 'Tomosynthesis'],
    tags: ['imaging guidance', 'peripheral lung', 'cone-beam CT'],
    focus: ['Workflow integration', 'Radiation considerations', 'Target visualization'],
    sourceFile: 'real-time-peripheral-imaging-techniques.mdx',
    order: 22,
  },
  {
    slug: 'thermal-ablatitive-therapies',
    title: 'Thermal Ablative Therapies',
    description:
      'Principles of laser, APC, cryotherapy, and vapor ablation for airway disease with emphasis on safety and technique selection.',
    summary:
      'Highlights device physics, energy delivery parameters, patient selection, and combination approaches for malignant and benign airway pathology.',
    category: 'ablation',
    estimatedMinutes: 29,
    examDomains: ['Laser therapy', 'APC', 'Cryotherapy'],
    tags: ['thermal ablation', 'APC', 'laser'],
    focus: ['Energy selection', 'Safety protocols', 'Technique pearls'],
    sourceFile: 'thermal-ablatitive-therapies.mdx',
    order: 23,
  },
  {
    slug: 'rigid-bronchoscopy-indications-technique-and-troubleshooting',
    title: 'Rigid Bronchoscopy: Technique & Troubleshooting Companion',
    description:
      'Supplemental atlas providing advanced troubleshooting, complex case pearls, and expanded technique guides for rigid bronchoscopy.',
    summary:
      'Adds nuanced decision trees, troubleshooting scenarios, and advanced instrumentation workflows that complement the core rigid bronchoscopy module.',
    category: 'airway',
    estimatedMinutes: 20,
    examDomains: ['Rigid bronch troubleshooting', 'Advanced techniques'],
    tags: ['rigid bronchoscopy', 'advanced technique', 'troubleshooting'],
    focus: ['Complex scenarios', 'Instrumentation pearls', 'Rescue planning'],
    sourceFile: 'rigid-bronchoscopy-indications-technique-and-troubleshooting.mdx',
    order: 24,
  },
]

export const boardReviewCategoryLabels: Record<BoardReviewCategory, string> = {
  airway: 'Airway & Bronchoscopy',
  oncology: 'Oncology & Staging',
  pleura: 'Pleural Disease',
  procedures: 'Critical Procedures',
  quality: 'Quality & Safety',
  navigation: 'Navigation & Imaging',
  ablation: 'Therapeutic Ablation',
  'practice-management': 'Practice Management',
}

export const boardReviewChapterMap = boardReviewChapters.reduce<Record<string, BoardReviewChapterMeta>>(
  (acc, chapter) => {
    acc[chapter.slug] = chapter
    return acc
  },
  {},
)

export const boardReviewChapterBySourceFile = boardReviewChapters.reduce<Record<string, BoardReviewChapterMeta>>(
  (acc, chapter) => {
    acc[chapter.sourceFile] = chapter
    return acc
  },
  {},
)
