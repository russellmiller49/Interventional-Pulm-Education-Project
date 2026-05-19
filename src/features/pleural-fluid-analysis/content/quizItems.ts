import type { FluidAppearance, UltrasoundPattern } from '../engine/types'

export interface PleuralAnalysisQuizItem {
  id: string
  stem: string
  findings: readonly string[]
  appearance: FluidAppearance
  ultrasound: UltrasoundPattern
  answerDiseaseId: string
  choices: readonly string[]
  explanation: string
  difficulty: 'core' | 'advanced' | 'rare'
}

export const pleuralAnalysisQuizItems: readonly PleuralAnalysisQuizItem[] = [
  {
    id: 'pseudoexudate-chf',
    stem: 'A patient with orthopnea and edema has bilateral anechoic effusions after aggressive diuresis.',
    findings: [
      "Meets Light's criteria only by protein ratio",
      'Serum-pleural albumin gradient 1.5 g/dL',
      'Serum NT-proBNP 4,200 pg/mL',
      'pH 7.48, glucose 112 mg/dL',
    ],
    appearance: 'straw',
    ultrasound: 'anechoic-bilateral',
    answerDiseaseId: 'congestive-heart-failure',
    choices: [
      'congestive-heart-failure',
      'malignant-pleural-effusion',
      'tuberculous-pleural-effusion',
      'rheumatoid-pleural-effusion',
    ],
    explanation:
      "This is the classic pseudoexudate trap: Light's criteria are sensitive, but albumin gradient and NT-proBNP pull the diagnosis back toward CHF.",
    difficulty: 'core',
  },
  {
    id: 'empyema-pattern',
    stem: 'A febrile patient with pneumonia has a complex septated effusion.',
    findings: ['Pleural pH 7.05', 'Glucose 28 mg/dL', 'LDH 1,850 U/L', 'Neutrophils 92%'],
    appearance: 'turbid',
    ultrasound: 'septated',
    answerDiseaseId: 'parapneumonic-empyema',
    choices: [
      'parapneumonic-empyema',
      'chylothorax',
      'hepatic-hydrothorax',
      'yellow-nail-syndrome',
    ],
    explanation:
      'Pneumonia context with low pH, low glucose, high LDH, neutrophils, and septations points to complicated parapneumonic effusion or empyema.',
    difficulty: 'core',
  },
  {
    id: 'tb-lymphocytic',
    stem: 'A young patient with TB exposure has a unilateral exudative effusion.',
    findings: ['Lymphocytes 86%', 'Protein 5.2 g/dL', 'ADA 74 IU/L', 'Mesothelial cells 2%'],
    appearance: 'serous',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'tuberculous-pleural-effusion',
    choices: [
      'tuberculous-pleural-effusion',
      'congestive-heart-failure',
      'urinothorax',
      'pulmonary-embolism',
    ],
    explanation:
      'The exposure history plus lymphocyte-predominant high-protein exudate, high ADA, and low mesothelial cells is the TB pattern.',
    difficulty: 'core',
  },
  {
    id: 'yellow-nail',
    stem: 'A patient has recurrent pleural effusions, leg lymphedema, bronchiectasis, and slow-growing dystrophic yellow nails.',
    findings: [
      'Lymphocyte-predominant effusion',
      'Often serous or lipid-tinged',
      'Cultures and cytology negative',
      'Effusions may be recurrent and bilateral',
    ],
    appearance: 'serous',
    ultrasound: 'anechoic-bilateral',
    answerDiseaseId: 'yellow-nail-syndrome',
    choices: [
      'yellow-nail-syndrome',
      'peritoneal-dialysis-effusion',
      'bilothorax',
      'rheumatoid-pleural-effusion',
    ],
    explanation:
      'Yellow nail syndrome is a lymphatic disorder; the diagnostic move is connecting lymphedema and dystrophic yellow nails to the effusion.',
    difficulty: 'rare',
  },
  {
    id: 'pseudochylothorax',
    stem: 'A chronic milky effusion occurs in a patient with remote TB pleuritis.',
    findings: [
      'Triglycerides 42 mg/dL',
      'Cholesterol 310 mg/dL',
      'No chylomicrons',
      'Long-standing pleural disease',
    ],
    appearance: 'milky',
    ultrasound: 'complex-homogeneous',
    answerDiseaseId: 'pseudochylothorax',
    choices: ['pseudochylothorax', 'chylothorax', 'parapneumonic-empyema', 'hepatic-hydrothorax'],
    explanation:
      'Milky fluid is not automatically chyle. High cholesterol with low triglycerides and chronic pleural history favors pseudochylothorax.',
    difficulty: 'rare',
  },
  {
    id: 'urinothorax',
    stem: 'A patient develops an ipsilateral effusion after obstructive uropathy.',
    findings: [
      'Pleural fluid smells like urine',
      'PF/serum creatinine ratio 1.7',
      'Protein 0.8 g/dL',
      'pH 7.18',
    ],
    appearance: 'urine-odor',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'urinothorax',
    choices: ['urinothorax', 'bilothorax', 'parapneumonic-empyema', 'congestive-heart-failure'],
    explanation:
      'Urinothorax is a rare extravascular-origin effusion; urine odor and PF/serum creatinine above 1 are the key clues.',
    difficulty: 'rare',
  },
  {
    id: 'bilothorax',
    stem: 'A patient has a right-sided effusion after hepatobiliary surgery.',
    findings: [
      'Green pleural fluid',
      'PF/serum bilirubin ratio 2.4',
      'Exudative chemistry',
      'Cultures initially negative',
    ],
    appearance: 'green',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'bilothorax',
    choices: ['bilothorax', 'chylothorax', 'yellow-nail-syndrome', 'trapped-lung'],
    explanation:
      'Green fluid plus pleural-to-serum bilirubin ratio above 1 points toward bilothorax and a biliary source.',
    difficulty: 'rare',
  },
  {
    id: 'pancreatic-fistula',
    stem: 'A patient with chronic pancreatitis has a large recurrent left pleural effusion.',
    findings: [
      'Pleural amylase 128,000 U/L',
      'Exudative chemistry',
      'Often large and recurrent',
      'Abdominal symptoms may be subtle',
    ],
    appearance: 'serous',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'pancreaticopleural-fistula',
    choices: [
      'pancreaticopleural-fistula',
      'esophageal-rupture',
      'congestive-heart-failure',
      'sarcoidosis-pleural-effusion',
    ],
    explanation:
      'Very high pleural amylase in chronic pancreatitis suggests pancreaticopleural fistula rather than a primary pleural process.',
    difficulty: 'advanced',
  },
  {
    id: 'hemothorax',
    stem: 'A patient on anticoagulation has a new large pleural effusion after blunt trauma.',
    findings: [
      'Grossly bloody fluid',
      'PF/blood hematocrit ratio 0.62',
      'Ultrasound hematocrit sign',
      'Acute dyspnea and pleuritic pain',
    ],
    appearance: 'bloody',
    ultrasound: 'hematocrit-sign',
    answerDiseaseId: 'hemothorax',
    choices: [
      'hemothorax',
      'pulmonary-embolism',
      'benign-asbestos-pleural-effusion',
      'mesothelioma',
    ],
    explanation:
      'Bloody fluid is nonspecific, but a PF/blood hematocrit ratio above 0.5 defines hemothorax.',
    difficulty: 'core',
  },
] as const
