import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Pleural Fluid Analysis "Learn" section — taught before
 * the interactive cockpit (Practice) and the disease-matching quiz (Assess).
 * Aligns with the interpretation engine (Light's criteria + pseudoexudate
 * reasoning). Board sections come from the pleural-effusions chapter; a unit test
 * guards that the ids still resolve.
 */

export const fluidBoardSlug = 'pleural-effusions'

export const fluidBoardSectionIds = [
  'algorithm-1-new-pleural-effusion-diagnostic-initial-therapeutic-pathway',
  'table-1-pleural-fluid-classification-frequent-etiologies-high-yield',
  'pre-procedure-evaluation',
  'pathophysiology-epidemiology',
] as const

export const fluidObjectives = [
  "Classify fluid as transudate vs. exudate with Light's criteria, and recognize the pseudoexudate trap.",
  'Choose targeted pleural fluid tests from the gross appearance and the clinical story.',
  'Turn the fluid pattern into a ranked differential, and know when to escalate beyond fluid testing.',
] as const

export const fluidCoreBlocks: LearnBlock[] = [
  {
    id: 'lights-criteria',
    title: "Transudate vs. exudate: Light's criteria",
    paragraphs: [
      "The first fork in any effusion work-up is transudate versus exudate, and Light's criteria are the first-line tool. The fluid is an exudate if it meets any one of three criteria — so the rule is very sensitive for exudates.",
    ],
    bullets: [
      'Pleural-fluid protein / serum protein > 0.5.',
      'Pleural-fluid LDH / serum LDH > 0.6.',
      'Pleural-fluid LDH > two-thirds of the upper limit of normal serum LDH.',
      'Meets none → transudate (think a systemic cause: heart failure, cirrhosis, nephrotic syndrome).',
    ],
  },
  {
    id: 'pseudoexudate',
    title: 'The pseudoexudate trap',
    paragraphs: [
      "Because Light's criteria are sensitive, they over-call exudate — most often in a heart-failure patient who has been diuresed, which concentrates the fluid and nudges it across the threshold. When the whole picture looks transudative but Light's labels it exudate by a small margin, reconcile before chasing an exudative work-up.",
    ],
    bullets: [
      'Serum-to-pleural albumin gradient > 1.2 g/dL suggests a transudate despite Light’s criteria.',
      'Serum-to-pleural protein gradient > 3.1 g/dL points the same way.',
      'A high NT-proBNP supports a cardiac (transudative) source.',
      "Use the gradient/BNP when the story is classic heart failure but Light's is barely exudative.",
    ],
  },
  {
    id: 'what-to-order',
    title: 'What to order — and why',
    bullets: [
      'Always: cell count and differential; protein and LDH (for Light’s); glucose; pH (parapneumonic risk); cytology when malignancy is on the table.',
      'Selectively, driven by the story: ADA (tuberculosis), amylase (pancreatic source or esophageal rupture), triglycerides and cholesterol (chylothorax vs. pseudochylothorax).',
      'More selective still: pleural-fluid creatinine (urinothorax), bilirubin (bilothorax), and hematocrit (hemothorax).',
      'Send the pH on a blood-gas analyzer, and pair every number with the clinical context.',
    ],
  },
  {
    id: 'gross-appearance',
    title: 'Read the gross appearance first',
    bullets: [
      'Turbid or frankly purulent → think complicated parapneumonic effusion or empyema.',
      'Milky → chylothorax or pseudochylothorax (the triglyceride/cholesterol split tells them apart).',
      'Bloody → malignancy, pulmonary embolism, or trauma; confirm hemothorax with a fluid-to-blood hematocrit ratio > 0.5.',
      'Other clues: food particles (esophageal rupture), a urine smell (urinothorax), green fluid (bilothorax).',
    ],
  },
  {
    id: 'numbers-to-differential',
    title: 'From numbers to a differential',
    bullets: [
      'Lymphocyte-predominant exudate → tuberculosis, malignancy, or chronic processes (and pair with ADA, cytology).',
      'Neutrophil-predominant exudate → acute processes, especially parapneumonic effusion.',
      'Low glucose / low pH → parapneumonic/empyema, rheumatoid, or malignant effusion.',
      'Cytology is specific but not sensitive — a negative tap does not rule out malignancy; escalate to tissue when suspicion stays high.',
    ],
  },
]

export const fluidGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'targeted-test-pearls',
    title: 'Targeted-test pearls and the rare effusions',
    level: 'advanced',
    bullets: [
      'ADA elevated (often > 40 IU/L) with a lymphocytic exudate supports tuberculous pleuritis.',
      'Very high amylase → pancreaticopleural fistula or esophageal rupture.',
      'Triglycerides > ~110 mg/dL → chylothorax; high cholesterol with low triglycerides in chronic disease → pseudochylothorax.',
      'Fluid-to-serum creatinine > 1 → urinothorax; fluid-to-serum bilirubin > 1 → bilothorax.',
    ],
  },
  {
    id: 'escalate-beyond-fluid',
    title: 'When to escalate beyond the fluid',
    level: 'advanced',
    bullets: [
      'After one or two nondiagnostic cytology samples with persistent suspicion of malignancy, move to image-guided pleural biopsy or thoracoscopy rather than repeating fluid-only tests.',
      'Let the pretest probability and imaging — not a single lab cutoff — drive the escalation.',
    ],
  },
]
