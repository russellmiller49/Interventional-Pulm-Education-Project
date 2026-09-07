import { SHARED_CRITICAL_CARE_THRESHOLDS as sharedThresholds } from '@/features/critical-care/content/sharedClinicalThresholds'

import { HEMODYNAMIC_CLINICAL_THRESHOLDS as thresholds } from './clinicalThresholds'

export interface HemodynamicsSource {
  id: string
  version: string
  title: string
  citation: string
  year: number
  sourceType:
    | 'guideline'
    | 'review'
    | 'original-research'
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
      'Current hemodynamic definition of pulmonary hypertension, pre-capillary physiology, direct-Fick versus thermodilution method framing, repeated CO measurement, and PVR calculation.',
    limitation: `The model explicitly notes uncertainty in treatment evidence for PVR between ${thresholds.pulmonaryHypertension.elevatedPvrWoodUnits} and 3 WU.`,
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
      'Dynamic fluid evaluation, serial perfusion review, flow monitoring, and echocardiography-first framing.',
  },
  {
    id: 'ssc-sepsis-2026',
    version: '2026-03-23',
    title: 'Surviving Sepsis Campaign: international guidelines 2026',
    citation:
      'Prescott HC, Antonelli M, Alhazzani W, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026. Crit Care Med. 2026. doi:10.1097/CCM.0000000000007075.',
    year: 2026,
    sourceType: 'guideline',
    url: 'https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-international-guidelines-for-management-of-sepsis-and-septic-shock-2026',
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
    id: 'cvp-measurement-2017',
    version: '2017.1',
    title: 'Comparison of central venous pressure measurement techniques',
    citation:
      'Roger C, Muller L, Riou B, et al. Comparison of different techniques of central venous pressure measurement in mechanically ventilated critically ill patients. Br J Anaesth. 2017;118(2):223–231.',
    year: 2017,
    sourceType: 'original-research',
    url: 'https://doi.org/10.1093/bja/aew386',
    intendedUse:
      'End-expiratory CVP measurement at the base of the c wave and the limits of respiratory-cycle monitor averaging during controlled mechanical ventilation.',
    limitation:
      'Single-center comparison in mechanically ventilated adults without spontaneous breathing; respiratory timing and waveform interpretation must match the patient’s actual ventilation mode.',
  },
  {
    id: 'papi-rvmi-2012',
    version: '2012.1',
    title: 'PAPi in acute inferior myocardial infarction',
    citation:
      'Korabathina R, Heffernan KS, Paruchuri V, et al. The pulmonary artery pulsatility index identifies severe right ventricular dysfunction in acute inferior myocardial infarction. Catheter Cardiovasc Interv. 2012;80(4):593–600. doi:10.1002/ccd.23309.',
    year: 2012,
    sourceType: 'original-research',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21954053/',
    intendedUse: `Derivation and context-specific interpretation of PAPi, including the ${sharedThresholds.pulmonaryArteryPulsatilityIndex.acuteRvInfarctionHighRiskMax} high-risk cut point in acute inferior myocardial infarction with suspected RV dysfunction.`,
    limitation: `Small, single-center cohort. The ${sharedThresholds.pulmonaryArteryPulsatilityIndex.acuteRvInfarctionHighRiskMax} cut point is phenotype-specific and is not a universal definition of RV failure.`,
  },
  {
    id: 'papi-lvad-rvf-2016',
    version: '2016.1',
    title: 'PAPi and right ventricular failure after LVAD implantation',
    citation:
      'Morine KJ, Kiernan MS, Pham DT, Paruchuri V, Denofrio D, Kapur NK. Pulmonary artery pulsatility index is associated with right ventricular failure after left ventricular assist device surgery. J Card Fail. 2016;22(2):110–116. doi:10.1016/j.cardfail.2015.10.019.',
    year: 2016,
    sourceType: 'original-research',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26564619/',
    intendedUse: `Population-specific interpretation of PAPi in durable continuous-flow LVAD candidates, including the ${sharedThresholds.pulmonaryArteryPulsatilityIndex.advancedHeartFailureTeachingMax} receiver-operating-characteristic cut point for postoperative right ventricular failure.`,
    limitation: `Single-center retrospective cohort of 132 continuous-flow LVAD recipients. The ${sharedThresholds.pulmonaryArteryPulsatilityIndex.advancedHeartFailureTeachingMax} cut point is specific to that surgical population and that study's definition of postoperative RV failure; it is neither a general advanced-heart-failure threshold nor a treatment target.`,
  },
  {
    id: 'cpo-acute-cardiac-2007',
    version: '2007.1',
    title: 'Cardiac power output and acute cardiac mortality',
    citation:
      'Mendoza DD, Cooper HA, Panza JA. Cardiac power output predicts mortality across a broad spectrum of patients with acute cardiac disease. Am Heart J. 2007;153(3):366–370. doi:10.1016/j.ahj.2006.11.014.',
    year: 2007,
    sourceType: 'original-research',
    url: 'https://pubmed.ncbi.nlm.nih.gov/17307413/',
    intendedUse: `Cardiac-power-output formula and the high-risk context of values around or below ${sharedThresholds.cardiacPowerOutput.highRiskTeachingWatts} W in acute cardiac disease and cardiogenic shock.`,
    limitation: `Observational single-unit cohort; the reported dichotomous cut point was ${sharedThresholds.cardiacPowerOutput.originalCohortWatts} W and should not replace the full shock phenotype or serial response.`,
  },
  {
    id: 'ppv-sepsis-2000',
    version: '2000.1',
    title: 'Pulse-pressure variation and fluid responsiveness',
    citation:
      'Michard F, Boussat S, Chemla D, et al. Relation between respiratory changes in arterial pulse pressure and fluid responsiveness in septic patients with acute circulatory failure. Am J Respir Crit Care Med. 2000;162(1):134–138. doi:10.1164/ajrccm.162.1.9903035.',
    year: 2000,
    sourceType: 'original-research',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10903232/',
    intendedUse: `Origin and conditional interpretation of the PPV threshold near ${thresholds.pulsePressureVariation.responsivePercent} during controlled mechanical ventilation.`,
    limitation:
      'The threshold came from a selected, mechanically ventilated cohort and is not valid with spontaneous effort, irregular rhythm, RV failure, low tidal volume, or an invalid arterial trace.',
  },
  {
    id: 'pa-compliance-outcomes-2026',
    version: '2026.1',
    title: 'Pulmonary artery compliance and adverse cardiac events',
    citation:
      'Mounsey LA, Nemeth SM, Kosyakovsky LB, et al. Association of Pulmonary Artery Compliance and Adverse Cardiac Events. JACC Adv. 2026;5(1). doi:10.1016/j.jacadv.2025.102357.',
    year: 2026,
    sourceType: 'original-research',
    url: 'https://www.jacc.org/doi/10.1016/j.jacadv.2025.102357',
    intendedUse:
      'Contemporary distribution and directional interpretation of PA compliance across a broad right-heart-catheterization cohort.',
    limitation:
      'Single-center observational cohort. Its median and interquartile range describe that population and are not universal normal limits.',
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
    version: '3e-ch2-2025',
    title: 'Normal waveforms, artifacts, and pitfalls',
    citation:
      'Ragosta M, Kennedy JLW. Normal Waveforms, Artifacts, and Pitfalls. In: Ragosta M, ed. Textbook of Clinical Hemodynamics. 3rd ed. Elsevier; 2025:15–49. doi:10.1016/B978-0-443-11642-1.00002-2.',
    year: 2025,
    sourceType: 'reference-package',
    url: 'https://www.sciencedirect.com/book/9780443116421/textbook-of-clinical-hemodynamics',
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
      'Leveling and zeroing, hydrostatic pressure error, waveform-quality review, and qualitative fast-flush response patterns.',
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
