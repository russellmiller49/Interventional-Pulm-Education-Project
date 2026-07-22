import type { IcuReviewStatus } from '../engine/types'

export interface IcuEvidenceSource {
  id: string
  title: string
  organization: string
  year: number
  url: string
  sourceType: 'guideline' | 'consensus' | 'device-source' | 'educational-model'
  appliesTo: readonly string[]
  reviewStatus: IcuReviewStatus
  limitation: string
}

export const ICU_EVIDENCE_SOURCES: readonly IcuEvidenceSource[] = Object.freeze([
  {
    id: 'ICU-ESICM-SHOCK',
    title: 'Circulatory shock and hemodynamic monitoring guidance',
    organization: 'European Society of Intensive Care Medicine',
    year: 2025,
    url: 'https://www.esicm.org/esicm-guideline-circulatory-shock-haemodynamic-monitoring/',
    sourceType: 'guideline',
    appliesTo: ['shock classification', 'serial reassessment', 'hemodynamic monitoring'],
    reviewStatus: 'pending',
    limitation:
      'Scenario thresholds remain educational abstractions pending multidisciplinary review.',
  },
  {
    id: 'ICU-SSC-2026',
    title: 'Surviving Sepsis Campaign adult guidance',
    organization: 'Society of Critical Care Medicine',
    year: 2026,
    url: 'https://sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-adult-guidelines',
    sourceType: 'guideline',
    appliesTo: ['sepsis', 'antimicrobials', 'source control', 'vasoactive support'],
    reviewStatus: 'pending',
    limitation:
      'The simulator uses relative medication tiers and does not encode dosing protocols.',
  },
  {
    id: 'ICU-ELSO',
    title: 'ELSO ECMO guidelines',
    organization: 'Extracorporeal Life Support Organization',
    year: 2025,
    url: 'https://www.elso.org/ecmo-resources/elso-ecmo-guidelines.aspx',
    sourceType: 'guideline',
    appliesTo: ['VV ECMO', 'VA ECMO', 'support readiness', 'complications'],
    reviewStatus: 'pending',
    limitation:
      'Cannulation technique and patient-specific eligibility decisions are outside scope.',
  },
  {
    id: 'ICU-ATS-ARDS',
    title: 'An Update on Management of Adult Patients with ARDS',
    organization: 'American Thoracic Society',
    year: 2024,
    url: 'https://www.atsjournals.org/doi/10.1164/rccm.202311-2011ST',
    sourceType: 'guideline',
    appliesTo: ['lung-protective ventilation', 'prone positioning', 'ARDS'],
    reviewStatus: 'pending',
    limitation:
      'The respiratory model is a bounded educational approximation, not a bedside protocol.',
  },
  {
    id: 'ICU-KDIGO-AKI',
    title: 'Acute Kidney Injury guideline resources',
    organization: 'Kidney Disease: Improving Global Outcomes',
    year: 2012,
    url: 'https://kdigo.org/guidelines/acute-kidney-injury/',
    sourceType: 'guideline',
    appliesTo: ['AKI', 'renal replacement therapy', 'fluid balance'],
    reviewStatus: 'pending',
    limitation:
      'Draft updates are not treated as authoritative; CRRT settings require local protocol review.',
  },
  {
    id: 'ICU-MV-ENGINE',
    title: 'Mechanical ventilation module equation-of-motion model',
    organization: 'Interventional Pulmonology Education',
    year: 2026,
    url: '/mechanical-ventilation',
    sourceType: 'educational-model',
    appliesTo: ['airway pressure', 'minute ventilation', 'gas exchange'],
    reviewStatus: 'pending',
    limitation:
      'The integrated adapter reuses pure mechanics but not the standalone reducer or clock.',
  },
  {
    id: 'ICU-MCS-ENGINE',
    title: 'Mechanical circulatory support educational model',
    organization: 'Interventional Pulmonology Education',
    year: 2026,
    url: '/mechanical-circulatory-support',
    sourceType: 'educational-model',
    appliesTo: ['IABP', 'left Impella', 'RP Impella'],
    reviewStatus: 'pending',
    limitation:
      'Device flow and unloading effects are educational surrogates and require SME calibration.',
  },
  {
    id: 'ICU-ECMO-ENGINE',
    title: 'CARDIOHELP ECMO educational model',
    organization: 'Interventional Pulmonology Education',
    year: 2026,
    url: '/cardiohelp-ecmo',
    sourceType: 'educational-model',
    appliesTo: ['circuit flow', 'sweep gas', 'VV versus VA support'],
    reviewStatus: 'pending',
    limitation: 'Console behavior is summarized through a device-neutral ICU adapter.',
  },
  {
    id: 'ICU-CRRT-ENGINE',
    title: 'Baxter CRRT educational model',
    organization: 'Interventional Pulmonology Education',
    year: 2026,
    url: '/baxter-crrt',
    sourceType: 'educational-model',
    appliesTo: ['effluent dose', 'fluid removal', 'solute clearance', 'circuit pressure'],
    reviewStatus: 'pending',
    limitation:
      'Exact alarm priority remains unmapped unless a reviewed adapter source supplies it.',
  },
  {
    id: 'ICU-HEMO-CORE',
    title: 'Shared six-compartment hemodynamics model',
    organization: 'Interventional Pulmonology Education',
    year: 2026,
    url: '/icu-hemodynamics',
    sourceType: 'educational-model',
    appliesTo: ['preload', 'afterload', 'ventricular function', 'mechanical support transfer'],
    reviewStatus: 'pending',
    limitation: 'The Windkessel model is qualitative and must not be used for patient care.',
  },
  {
    id: 'ICU-SCENARIO-MODEL',
    title: 'Integrated ICU scenario model specification',
    organization: 'Interventional Pulmonology Education',
    year: 2026,
    url: '/icu-simulation',
    sourceType: 'educational-model',
    appliesTo: ['scenario timing', 'scoring', 'accepted alternatives', 'debrief'],
    reviewStatus: 'pending',
    limitation:
      'All scenario trajectories are synthetic and await multidisciplinary clinical approval.',
  },
  {
    id: 'ICU-ACC-CARDIOGENIC',
    title: 'Concise Clinical Guidance for Cardiogenic Shock',
    organization: 'American College of Cardiology',
    year: 2025,
    url: 'https://www.acc.org/guidelines/guidelines/2025/03/17/19/42/cardiogenic-shock-concise-clinical-guidance',
    sourceType: 'consensus',
    appliesTo: ['cardiogenic shock', 'hemodynamic assessment', 'temporary mechanical support'],
    reviewStatus: 'pending',
    limitation:
      'Device selection and escalation remain authored alternatives pending current SME review.',
  },
  {
    id: 'ICU-ESC-PE',
    title: 'Acute Pulmonary Embolism: Diagnosis and Management',
    organization: 'European Society of Cardiology',
    year: 2019,
    url: 'https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/acute-pulmonary-embolism/',
    sourceType: 'guideline',
    appliesTo: ['high-risk pulmonary embolism', 'reperfusion', 'RV shock'],
    reviewStatus: 'pending',
    limitation:
      'Reperfusion is represented as an abstract milestone; no patient-specific eligibility logic is provided.',
  },
  {
    id: 'ICU-TRAUMA-HEMORRHAGE',
    title: 'European guideline on management of major bleeding and coagulopathy following trauma',
    organization: 'European multidisciplinary guideline group',
    year: 2023,
    url: 'https://doi.org/10.1186/s13054-023-04327-7',
    sourceType: 'guideline',
    appliesTo: ['hemorrhage control', 'blood-product resuscitation', 'coagulopathy'],
    reviewStatus: 'pending',
    limitation:
      'The synthetic scenario abstracts blood products and source control and is not a transfusion protocol.',
  },
  {
    id: 'ICU-ESC-PERICARDIAL',
    title: 'ESC Guidelines for the Management of Myocarditis and Pericarditis',
    organization: 'European Society of Cardiology',
    year: 2025,
    url: 'https://www.escardio.org/guidelines/clinical-practice-guidelines/pocket-guidelines/pericardial-diseases/',
    sourceType: 'guideline',
    appliesTo: ['cardiac tamponade', 'diagnosis', 'urgent drainage'],
    reviewStatus: 'pending',
    limitation:
      'Drainage is an abstract milestone and does not teach invasive procedural technique.',
  },
])

export const ICU_EVIDENCE_BY_ID: ReadonlyMap<string, IcuEvidenceSource> = new Map(
  ICU_EVIDENCE_SOURCES.map((source) => [source.id, source]),
)

export const ICU_EDUCATIONAL_BOUNDARIES = Object.freeze({
  title: 'Educational simulation — not clinical guidance',
  disclaimer:
    'This module uses synthetic adult ICU patients and simplified physiology for education only. It does not provide patient-specific advice, replace local protocols, manufacturer instructions, expert consultation, or bedside clinical judgment.',
  constraints: Object.freeze([
    'Do not enter real-patient information.',
    'Medication actions use relative tiers rather than doses.',
    'Cannulation, intubation, vascular access, and drainage technique are not simulated.',
    'Device availability, contraindications, setup, and alarm response depend on current instructions and local policy.',
    'Modeled responses and scores are learning aids, not predictions of clinical outcome.',
  ]),
  syntheticPatientsOnly: true as const,
  noRealPatientData: true as const,
  noMedicationDoses: true as const,
  noInvasiveProcedureTechnique: true as const,
})
