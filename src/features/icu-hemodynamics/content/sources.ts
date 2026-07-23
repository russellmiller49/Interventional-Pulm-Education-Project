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
      'Whitener S, Konoske R, Mark JB. Pulmonary artery catheter. Best Pract Res Clin Anaesthesiol. 2014;28(4):323-335.',
    year: 2014,
    sourceType: 'review',
    url: 'https://doi.org/10.1016/j.bpa.2014.08.003',
    suppliedFilename: 'Pulmonary artery catheter.pdf',
    intendedUse:
      'Chamber-by-chamber waveform recognition during advancement, insertion-depth landmarks, normal intracardiac pressures, and abnormal a/c/v patterns.',
  },
  {
    id: 'emcrit-rhc-supplied-2026',
    version: 'supplied-2026-07-23',
    title: 'Right heart catheterization (RHC)',
    citation: 'EMCrit Project. Right heart catheterization (RHC). User-supplied PDF capture.',
    year: 2026,
    sourceType: 'reference-package',
    url: 'https://emcrit.org/ibcc/rhc/',
    suppliedFilename: 'Right heart catheterization (RHC) - EMCrit Project.pdf',
    intendedUse:
      'Conceptual cross-check for PA-versus-RV morphology, PA-to-wedge transition, rough catheter-depth context, and pressure leveling.',
    limitation:
      'Used as a clinical and visual reference only. The module uses original explanatory text and original deterministic SVG traces.',
  },
  {
    id: 'clinical-hemodynamics-waveforms',
    version: 'ch2-supplied',
    title: 'Normal waveforms, artifacts, and pitfalls',
    citation:
      'Ragosta M, Kennedy JLW. Normal waveforms, artifacts, and pitfalls. In: Textbook of Clinical Hemodynamics. Elsevier.',
    year: 2026,
    sourceType: 'reference-package',
    suppliedFilename: 'Normal physiology and waveforms.pdf',
    intendedUse:
      'Wave-by-wave morphology and ECG timing for the RA, RV, PA, wedge, LV, and aortic tracings; West zones; and the catalogue of measurement artifacts.',
    limitation:
      'Catheterization-laboratory reference. Bedside ICU monitors damp and filter differently, so morphology is taught qualitatively rather than as a calibrated device trace.',
  },
  {
    id: 'arterial-pressure-five-step-2020',
    version: '2020.1',
    title: 'How to measure blood pressure using an arterial catheter',
    citation:
      'Saugel B, et al. How to measure blood pressure using an arterial catheter: a systematic 5-step approach. Crit Care. 2020;24:172.',
    year: 2020,
    sourceType: 'review',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7183114/',
    intendedUse:
      'Leveling and zeroing, hydrostatic pressure error, waveform-quality assessment, and qualitative fast-flush response patterns.',
    limitation:
      'The module uses original schematic traces for qualitative education; they are not copied figures, calibrated device output, or a substitute for current monitor instructions.',
  },
  {
    id: 'edwards-swan-ganz-ifu-2023',
    version: 'DOC-0222632A',
    title: 'Swan-Ganz IQ pulmonary artery catheter instructions for use',
    citation: 'Edwards Lifesciences. Swan-Ganz IQ Catheter IFU, document DOC-0222632A. 2023.',
    year: 2023,
    sourceType: 'manufacturer-labeling',
    url: 'https://eifu.edwards.com/eifu/5970f1b346e0fb00015e5f4d/DOC-0222632A.pdf',
    intendedUse:
      'Manufacturer-labeled transient balloon occlusion for pulmonary artery occlusion-pressure measurement, with balloon-inflation and placement safeguards.',
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
