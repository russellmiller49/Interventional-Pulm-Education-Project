import type { ClinicalContextId, FluidAppearance, UltrasoundPattern } from '../engine/types'

export const pleuralAnalysisDisclaimer =
  'This module is for education and simulation. It does not replace local protocols, specialist consultation, or patient-specific clinical judgment.'

export const clinicalContextOptions: readonly {
  id: ClinicalContextId
  label: string
  description: string
}[] = [
  {
    id: 'uncertain',
    label: 'Unclear presentation',
    description: 'No single syndrome explains the effusion before sampling.',
  },
  {
    id: 'heart-failure-diuresis',
    label: 'CHF after diuresis',
    description: 'Systemic pressure physiology with a risk of pseudoexudate chemistry.',
  },
  {
    id: 'hepatic-renal-systemic',
    label: 'Hepatic / renal / low albumin',
    description: 'A systemic transudate frame, especially when bilateral and anechoic.',
  },
  {
    id: 'pneumonia-infection',
    label: 'Pneumonia or infection',
    description: 'PFA should decide whether infection requires drainage or source control.',
  },
  {
    id: 'tb-exposure',
    label: 'TB or endemic exposure',
    description: 'Exposure history changes the value of lymphocytes, ADA, and biopsy.',
  },
  {
    id: 'malignancy',
    label: 'Cancer / pleural nodularity',
    description: 'Cytology and pleural targets matter even when chemistry is nonspecific.',
  },
  {
    id: 'post-procedure-lymphatic',
    label: 'Lymphatic / post procedure',
    description: 'Milky fluid, surgery, lymphoma, or yellow-nail phenotype triggers lipid tests.',
  },
  {
    id: 'trauma-hemothorax',
    label: 'Trauma / anticoagulation',
    description: 'Grossly bloody fluid needs a pleural hematocrit branch.',
  },
  {
    id: 'pancreatic-esophageal',
    label: 'Pancreatic / esophageal',
    description: 'Amylase and source anatomy can be decisive.',
  },
  {
    id: 'autoimmune',
    label: 'Autoimmune pleuritis',
    description: 'Rheumatoid and lupus effusions can mimic pleural infection.',
  },
]

export const ultrasoundPatternOptions: readonly {
  id: UltrasoundPattern
  label: string
  description: string
}[] = [
  {
    id: 'anechoic-unilateral',
    label: 'Anechoic unilateral',
    description: 'Can be transudate or exudate; clinical context decides whether to sample.',
  },
  {
    id: 'anechoic-bilateral',
    label: 'Anechoic bilateral',
    description: 'Supports systemic causes when the clinical story is obvious.',
  },
  {
    id: 'septated',
    label: 'Septated',
    description: 'Raises concern for infection, malignancy, or hemothorax.',
  },
  {
    id: 'complex-homogeneous',
    label: 'Complex homogeneous',
    description: 'Often needs drainage-level thinking when infection or blood is plausible.',
  },
  {
    id: 'nodular-thickened',
    label: 'Nodular / thickened pleura',
    description: 'A high-specificity malignancy clue when seen convincingly.',
  },
  {
    id: 'hematocrit-sign',
    label: 'Hematocrit sign',
    description: 'Layering blood products create a hemothorax branch.',
  },
  {
    id: 'too-small',
    label: '< 1 cm pocket',
    description: 'Usually a safety and observation decision before diagnostic sampling.',
  },
]

export const fluidAppearanceOptions: readonly {
  id: FluidAppearance
  label: string
}[] = [
  { id: 'straw', label: 'Straw / clear' },
  { id: 'serous', label: 'Serous' },
  { id: 'serosanguineous', label: 'Serosanguineous' },
  { id: 'bloody', label: 'Bloody' },
  { id: 'milky', label: 'Milky' },
  { id: 'turbid', label: 'Turbid' },
  { id: 'purulent', label: 'Gross pus' },
  { id: 'green', label: 'Green' },
  { id: 'food-particles', label: 'Food particles' },
  { id: 'urine-odor', label: 'Urine odor' },
]

export const analysisFrameworkSteps = [
  {
    title: 'Start before the tube',
    body: 'History, exam, laterality, chronicity, ultrasound character, and pretest probability determine what PFA can and cannot prove.',
  },
  {
    title: 'Decide whether sampling is needed',
    body: 'Small unsafe pockets, obvious bilateral anechoic systemic effusions, and small PE-associated effusions may be managed without diagnostic thoracentesis.',
  },
  {
    title: 'Send the routine core',
    body: 'Appearance, paired protein and LDH, pH, glucose, and cell count with differential give the highest-yield first pass.',
  },
  {
    title: 'Classify, then distrust gently',
    body: "Light's criteria are sensitive for exudates, but diuresed CHF, hepatic hydrothorax, and post-CABG physiology can masquerade as exudates.",
  },
  {
    title: 'Let special tests answer specific questions',
    body: 'Triglycerides, hematocrit, creatinine, bilirubin, amylase, ADA, cytology, flow, and cultures should follow a clinical branch, not a reflex panel.',
  },
  {
    title: 'Reconcile mismatches',
    body: 'When PFA and the bedside story diverge, revisit the imaging, sample quality, pH handling, competing diagnoses, and need for biopsy or follow-up.',
  },
] as const

export const patternLibrary = [
  {
    pattern: 'Pseudoexudate',
    signal:
      'Positive Light criteria by a small margin after diuresis or in hepatic/systemic physiology',
    move: 'Check serum-pleural albumin gradient, protein gradient, and NT-proBNP.',
  },
  {
    pattern: 'Complicated parapneumonic effusion',
    signal:
      'Pneumonia context with pH < 7.2, glucose < 60, LDH > 1,000, very high cells, or positive microbiology',
    move: 'Think drainage and loculation management, not just exudate classification.',
  },
  {
    pattern: 'TB phenotype',
    signal:
      'Lymphocyte-predominant exudate with exposure risk, high protein, low mesothelial cells, and elevated ADA',
    move: 'Send cultures, but plan for pleural biopsy when suspicion remains high.',
  },
  {
    pattern: 'Chylothorax',
    signal:
      'Milky or turbid fluid with triglycerides > 110 mg/dL, or chylomicrons with intermediate triglycerides',
    move: 'Search for trauma, thoracic surgery, lymphoma, lymphatic disorders, or cirrhosis.',
  },
  {
    pattern: 'Hemothorax',
    signal:
      'Grossly bloody fluid or ultrasound hematocrit sign with PF/blood hematocrit ratio > 0.5',
    move: 'Escalate drainage and source-control thinking.',
  },
  {
    pattern: 'Malignancy trap',
    signal:
      'Recurrent unilateral effusion, pleural nodularity, weight loss, or cancer history despite bland chemistry',
    move: 'Do cytology correctly, then biopsy if the pretest probability remains high.',
  },
  {
    pattern: 'Yellow nail syndrome',
    signal:
      'Recurrent effusion with lymphedema, dystrophic yellow nails, bronchiectasis, and lymphocyte-predominant fluid',
    move: 'Let the bedside phenotype reopen the lymphatic differential, even when routine chemistry is nonspecific.',
  },
  {
    pattern: 'Extravascular-origin effusion',
    signal:
      'Very low protein or a fluid-specific ratio such as creatinine, bilirubin, glucose, amylase, or beta-2 transferrin',
    move: 'Stop repeating diagnostic taps and search for the source pathway feeding the pleural space.',
  },
] as const

export const pleuralAnalysisReferences = [
  {
    id: 'chopra-2025-pfa',
    citation:
      'Chopra A, Hu K, Feller-Kopman D, Judson MA. Pleural Fluid Analysis: Maximizing Diagnostic Yield in the Pleural Effusion Evaluation. CHEST. 2025;168(3):828-838.',
    source: 'Local PDF: pleural_analysis/PIIS0012369225006944.pdf',
    useNote:
      "Light's criteria, pseudoexudates, targeted tests, gross inspection, and PFA pattern tables.",
  },
  {
    id: 'chopra-2025-clinical',
    citation:
      'Chopra A, Hu K, Judson MA, Feller-Kopman D. Clinical Approach to a Pleural Effusion. CHEST. 2025.',
    source: 'Local PDF: pleural_analysis/PIIS0012369225058027.pdf',
    useNote:
      'Clinical context, history, ultrasound, radiographic patterns, blood testing, and diagnostic algorithm.',
  },
  {
    id: 'light-pleural-diseases',
    citation: 'Light RW. Pleural Diseases. Clinical manifestations and useful tests chapter.',
    source: 'Local PDF: pleural_analysis/pleural_analysis.pdf',
    useNote:
      'Classic clinical examination, transudate-exudate separation, pH/glucose/cell-count interpretation, and test limitations.',
  },
] as const
