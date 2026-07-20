export interface HemodynamicsSource {
  id: string
  version: string
  title: string
  citation: string
  year: number
  sourceType:
    | 'guideline'
    | 'review'
    | 'manufacturer-labeling'
    | 'reference-package'
    | 'workflow-manual'
    | 'educational-model'
  url?: string
  suppliedFilename?: string
  intendedUse: string
  limitation?: string
}

export const hemodynamicsSources: readonly HemodynamicsSource[] = [
  {
    id: 'esc-ers-ph-2022',
    version: '2022.1',
    title: '2022 ESC/ERS pulmonary hypertension guidance',
    citation: 'Humbert M, et al. 2022 ESC/ERS Guidelines for pulmonary hypertension.',
    year: 2022,
    sourceType: 'guideline',
    url: 'https://www.escardio.org/static-file/Escardio/Guidelines/Products/Essential%20Messages/2022%20Gls%20EM/2022%20PH%20Guidelines_Essential%20messages.pdf',
    intendedUse:
      'Current hemodynamic definition of pulmonary hypertension and pre-capillary physiology.',
    limitation:
      'The model explicitly notes uncertainty in treatment evidence for PVR between 2 and 3 WU.',
  },
  {
    id: 'esicm-shock-2025',
    version: '2025.1',
    title: 'ESICM circulatory shock and hemodynamic monitoring guideline',
    citation:
      'Cecconi M, et al. ESICM guideline on circulatory shock and hemodynamic monitoring. Intensive Care Med. 2025.',
    year: 2025,
    sourceType: 'guideline',
    url: 'https://www.esicm.org/esicm-guideline-circulatory-shock-haemodynamic-monitoring/',
    intendedUse:
      'Dynamic fluid assessment, serial perfusion reassessment, flow monitoring, and echocardiography-first framing.',
  },
  {
    id: 'ssc-sepsis-2026',
    version: '2026.1',
    title: 'Surviving Sepsis Campaign adult guideline',
    citation:
      'Society of Critical Care Medicine. Surviving Sepsis Campaign Adult Guidelines. 2026.',
    year: 2026,
    sourceType: 'guideline',
    url: 'https://www.sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-adult-guidelines',
    intendedUse:
      'Dynamic reassessment, individualized fluid decisions, norepinephrine-first vasopressor framing, and an initial MAP target near 65 mmHg.',
  },
  {
    id: 'pac-waveforms-part-1-2021',
    version: '2021.1',
    title: 'The contemporary pulmonary artery catheter. Part 1',
    citation:
      'Bootsma IT, et al. The contemporary pulmonary artery catheter. Part 1: placement and waveform analysis. J Clin Monit Comput. 2021.',
    year: 2021,
    sourceType: 'review',
    url: 'https://link.springer.com/article/10.1007/s10877-021-00662-8',
    suppliedFilename: 's10877-021-00662-8.pdf',
    intendedUse:
      'Catheter advancement, RA/RV/PA/PAWP waveform morphology, artifacts, and placement safety.',
  },
  {
    id: 'pac-derived-part-2-2021',
    version: '2021.1',
    title: 'The contemporary pulmonary artery catheter. Part 2',
    citation:
      'Bootsma IT, et al. The contemporary pulmonary artery catheter. Part 2: measurements, limitations, and clinical applications. J Clin Monit Comput. 2021.',
    year: 2021,
    sourceType: 'review',
    url: 'https://doi.org/10.1007/s10877-021-00673-5',
    suppliedFilename: '10877_2021_Article_673.pdf',
    intendedUse:
      'Thermodilution, derived hemodynamics, interpretation limits, and technical validation.',
  },
  {
    id: 'pac-review-2014',
    version: '2014.1',
    title: 'Pulmonary artery catheter review',
    citation:
      'Gilbert-Kawai E, et al. Pulmonary artery catheterization. Best Pract Res Clin Anaesthesiol. 2014.',
    year: 2014,
    sourceType: 'review',
    url: 'https://doi.org/10.1016/j.bpa.2014.08.003',
    suppliedFilename: 'Pulmonary artery catheter.pdf',
    intendedUse: 'Foundational catheter technique, waveform interpretation, and limitations.',
  },
  {
    id: 'edwards-swan-ganz-ifu-2025',
    version: 'DOC-0552124A',
    title: 'Swan-Ganz pulmonary artery catheter instructions for use',
    citation: 'Edwards Lifesciences. Swan-Ganz Catheters IFU, document DOC-0552124A.',
    year: 2025,
    sourceType: 'manufacturer-labeling',
    url: 'https://eifu.edwards.com/eifu/5970f1b346e0fb00015e5f4d/DOC-0552124A.pdf',
    intendedUse:
      'Visual route and advancement states through the right heart into the pulmonary artery and distal wedge position.',
    limitation:
      'The module is state-driven education and does not teach bedside insertion or replace the current IFU.',
  },
  {
    id: 'master-hemodynamics-reference',
    version: 'supplied-2026-07',
    title: 'Master Hemodynamics and Hemodynamic Monitoring Reference',
    citation: 'User-supplied educational reference package.',
    year: 2026,
    sourceType: 'reference-package',
    suppliedFilename: 'Master_Hemodynamics_and_Hemodynamic_Monitoring_Reference.docx',
    intendedUse: 'Curriculum scope, equations, case concepts, and terminology cross-check.',
    limitation:
      'Where definitions conflict, current guidelines govern; the older 3-WU pre-capillary threshold is not used.',
  },
  {
    id: 'monitor-workflow-supplied',
    version: 'workflow-only-1',
    title: 'Supplied bedside-monitor workflow manuals',
    citation: 'User-supplied monitor and cardiac-output workflow reference files.',
    year: 2021,
    sourceType: 'workflow-manual',
    suppliedFilename: 'fdacovideuas_137229.pdf; 51414b09bd404c5ba256ae4501365f69.pdf',
    intendedUse:
      'Generic workflow concepts such as zeroing, wedge capture, and cardiac-output trial review.',
    limitation:
      'No screenshots, branding, proprietary layout, or exact vendor visual design are reproduced.',
  },
  {
    id: 'icu-hemodynamics-model-v1',
    version: '1.0.0-preview.1',
    title: 'ICU Hemodynamics Lab educational circulation model',
    citation: 'Original deterministic educational model for this module.',
    year: 2026,
    sourceType: 'educational-model',
    intendedUse:
      'Links ventricular loading, vascular resistance/compliance, volume, PEEP, and signal-system effects to coherent simulated trends.',
    limitation:
      'Not a validated digital twin, clinical device, dosing model, or patient-specific prediction tool.',
  },
] as const

export const hemodynamicsSourceById = new Map(
  hemodynamicsSources.map((source) => [source.id, source]),
)
