import { pickLocaleContent } from '@/i18n/content'

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

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. id / appearance / ultrasound /
// answerDiseaseId / choices / difficulty mirror the English source so scoring
// and disease lookup stay correct; only learner-facing text differs. Choice
// labels come from the localized disease profiles, so `choices` keeps the ids.
// ─────────────────────────────────────────────────────────────────────────────

const pleuralAnalysisQuizItemsEs: readonly PleuralAnalysisQuizItem[] = [
  {
    id: 'pseudoexudate-chf',
    stem: 'Un paciente con ortopnea y edema tiene derrames anecoicos bilaterales tras una diuresis agresiva.',
    findings: [
      'Cumple los criterios de Light solo por la relación de proteínas',
      'Gradiente de albúmina suero-pleural de 1,5 g/dL',
      'NT-proBNP sérico de 4.200 pg/mL',
      'pH 7,48, glucosa 112 mg/dL',
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
      'Esta es la trampa clásica del pseudoexudado: los criterios de Light son sensibles, pero el gradiente de albúmina y el NT-proBNP devuelven el diagnóstico hacia la insuficiencia cardíaca.',
    difficulty: 'core',
  },
  {
    id: 'empyema-pattern',
    stem: 'Un paciente febril con neumonía tiene un derrame complejo y septado.',
    findings: ['pH pleural 7,05', 'Glucosa 28 mg/dL', 'LDH 1.850 U/L', 'Neutrófilos 92%'],
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
      'El contexto de neumonía con pH bajo, glucosa baja, LDH alta, neutrófilos y septos apunta a un derrame paraneumónico complicado o empiema.',
    difficulty: 'core',
  },
  {
    id: 'tb-lymphocytic',
    stem: 'Un paciente joven con exposición a TB tiene un derrame exudativo unilateral.',
    findings: ['Linfocitos 86%', 'Proteína 5,2 g/dL', 'ADA 74 IU/L', 'Células mesoteliales 2%'],
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
      'La historia de exposición más un exudado de predominio linfocítico con proteína alta, ADA alta y bajas células mesoteliales es el patrón de TB.',
    difficulty: 'core',
  },
  {
    id: 'yellow-nail',
    stem: 'Un paciente tiene derrames pleurales recurrentes, linfedema de piernas, bronquiectasias y uñas amarillas distróficas de crecimiento lento.',
    findings: [
      'Derrame de predominio linfocítico',
      'A menudo seroso o con tinte lipídico',
      'Cultivos y citología negativos',
      'Los derrames pueden ser recurrentes y bilaterales',
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
      'El síndrome de las uñas amarillas es un trastorno linfático; el paso diagnóstico es conectar el linfedema y las uñas amarillas distróficas con el derrame.',
    difficulty: 'rare',
  },
  {
    id: 'pseudochylothorax',
    stem: 'Un derrame lechoso crónico ocurre en un paciente con pleuritis tuberculosa remota.',
    findings: [
      'Triglicéridos 42 mg/dL',
      'Colesterol 310 mg/dL',
      'Sin quilomicrones',
      'Enfermedad pleural de larga evolución',
    ],
    appearance: 'milky',
    ultrasound: 'complex-homogeneous',
    answerDiseaseId: 'pseudochylothorax',
    choices: ['pseudochylothorax', 'chylothorax', 'parapneumonic-empyema', 'hepatic-hydrothorax'],
    explanation:
      'El líquido lechoso no es automáticamente quilo. Colesterol alto con triglicéridos bajos e historia pleural crónica favorece el pseudoquilotórax.',
    difficulty: 'rare',
  },
  {
    id: 'urinothorax',
    stem: 'Un paciente desarrolla un derrame ipsilateral tras una uropatía obstructiva.',
    findings: [
      'El líquido pleural huele a orina',
      'Relación creatinina LP/suero de 1,7',
      'Proteína 0,8 g/dL',
      'pH 7,18',
    ],
    appearance: 'urine-odor',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'urinothorax',
    choices: ['urinothorax', 'bilothorax', 'parapneumonic-empyema', 'congestive-heart-failure'],
    explanation:
      'El urinotórax es un derrame raro de origen extravascular; el olor a orina y la relación creatinina LP/suero por encima de 1 son las claves.',
    difficulty: 'rare',
  },
  {
    id: 'bilothorax',
    stem: 'Un paciente tiene un derrame derecho tras una cirugía hepatobiliar.',
    findings: [
      'Líquido pleural verde',
      'Relación bilirrubina LP/suero de 2,4',
      'Química exudativa',
      'Cultivos inicialmente negativos',
    ],
    appearance: 'green',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'bilothorax',
    choices: ['bilothorax', 'chylothorax', 'yellow-nail-syndrome', 'trapped-lung'],
    explanation:
      'El líquido verde más una relación bilirrubina pleural/suero por encima de 1 apunta hacia el biliotórax y un origen biliar.',
    difficulty: 'rare',
  },
  {
    id: 'pancreatic-fistula',
    stem: 'Un paciente con pancreatitis crónica tiene un gran derrame pleural izquierdo recurrente.',
    findings: [
      'Amilasa pleural 128.000 U/L',
      'Química exudativa',
      'A menudo grande y recurrente',
      'Los síntomas abdominales pueden ser sutiles',
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
      'Una amilasa pleural muy alta en pancreatitis crónica sugiere una fístula pancreaticopleural en lugar de un proceso pleural primario.',
    difficulty: 'advanced',
  },
  {
    id: 'hemothorax',
    stem: 'Un paciente anticoagulado tiene un nuevo derrame pleural grande tras un traumatismo cerrado.',
    findings: [
      'Líquido francamente sanguinolento',
      'Relación hematocrito LP/sangre de 0,62',
      'Signo del hematocrito en ecografía',
      'Disnea aguda y dolor pleurítico',
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
      'El líquido sanguinolento es inespecífico, pero una relación hematocrito LP/sangre por encima de 0,5 define el hemotórax.',
    difficulty: 'core',
  },
]

const pleuralAnalysisQuizItemsZhCn: readonly PleuralAnalysisQuizItem[] = [
  {
    id: 'pseudoexudate-chf',
    stem: '一名有端坐呼吸和水肿的患者在积极利尿后出现双侧无回声积液。',
    findings: [
      '仅凭蛋白比值满足 Light 标准',
      '血清-胸腔白蛋白梯度 1.5 g/dL',
      '血清 NT-proBNP 4,200 pg/mL',
      'pH 7.48，葡萄糖 112 mg/dL',
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
      '这是典型的假性渗出液陷阱：Light 标准敏感，但白蛋白梯度和 NT-proBNP 把诊断拉回心力衰竭。',
    difficulty: 'core',
  },
  {
    id: 'empyema-pattern',
    stem: '一名发热的肺炎患者出现复杂分隔的积液。',
    findings: ['胸腔 pH 7.05', '葡萄糖 28 mg/dL', 'LDH 1,850 U/L', '中性粒细胞 92%'],
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
      '肺炎背景下 pH 低、葡萄糖低、LDH 高、中性粒细胞为主并有分隔，指向复杂性肺炎旁积液或脓胸。',
    difficulty: 'core',
  },
  {
    id: 'tb-lymphocytic',
    stem: '一名有结核暴露史的年轻患者出现单侧渗出性积液。',
    findings: ['淋巴细胞 86%', '蛋白 5.2 g/dL', 'ADA 74 IU/L', '间皮细胞 2%'],
    appearance: 'serous',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'tuberculous-pleural-effusion',
    choices: [
      'tuberculous-pleural-effusion',
      'congestive-heart-failure',
      'urinothorax',
      'pulmonary-embolism',
    ],
    explanation: '暴露史加上以淋巴细胞为主、高蛋白的渗出液、高 ADA 和低间皮细胞，即为结核的特征。',
    difficulty: 'core',
  },
  {
    id: 'yellow-nail',
    stem: '一名患者有复发性胸腔积液、下肢淋巴水肿、支气管扩张以及生长缓慢的营养不良性黄甲。',
    findings: [
      '以淋巴细胞为主的积液',
      '常为浆液性或带脂质色调',
      '培养和细胞学阴性',
      '积液可反复出现且为双侧',
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
      '黄甲综合征是一种淋巴系统疾病；诊断的关键在于把淋巴水肿和营养不良性黄甲与积液联系起来。',
    difficulty: 'rare',
  },
  {
    id: 'pseudochylothorax',
    stem: '一名既往有结核性胸膜炎的患者出现慢性乳白色积液。',
    findings: ['甘油三酯 42 mg/dL', '胆固醇 310 mg/dL', '无乳糜微粒', '长期存在的胸膜病变'],
    appearance: 'milky',
    ultrasound: 'complex-homogeneous',
    answerDiseaseId: 'pseudochylothorax',
    choices: ['pseudochylothorax', 'chylothorax', 'parapneumonic-empyema', 'hepatic-hydrothorax'],
    explanation:
      '乳白色液体并不一定是乳糜。胆固醇高而甘油三酯低，加上慢性胸膜病史，更倾向于假性乳糜胸。',
    difficulty: 'rare',
  },
  {
    id: 'urinothorax',
    stem: '一名患者在梗阻性尿路病变后出现同侧积液。',
    findings: ['胸腔积液有尿味', '积液/血清肌酐比值 1.7', '蛋白 0.8 g/dL', 'pH 7.18'],
    appearance: 'urine-odor',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'urinothorax',
    choices: ['urinothorax', 'bilothorax', 'parapneumonic-empyema', 'congestive-heart-failure'],
    explanation: '尿胸是一种罕见的血管外来源积液；尿味和积液/血清肌酐比值大于 1 是关键线索。',
    difficulty: 'rare',
  },
  {
    id: 'bilothorax',
    stem: '一名患者在肝胆手术后出现右侧积液。',
    findings: ['绿色胸腔积液', '积液/血清胆红素比值 2.4', '渗出性生化', '培养初期阴性'],
    appearance: 'green',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'bilothorax',
    choices: ['bilothorax', 'chylothorax', 'yellow-nail-syndrome', 'trapped-lung'],
    explanation: '绿色液体加上胸腔/血清胆红素比值大于 1，指向胆汁胸及胆道来源。',
    difficulty: 'rare',
  },
  {
    id: 'pancreatic-fistula',
    stem: '一名慢性胰腺炎患者出现大量复发性左侧胸腔积液。',
    findings: ['胸腔淀粉酶 128,000 U/L', '渗出性生化', '常为大量且复发', '腹部症状可能轻微'],
    appearance: 'serous',
    ultrasound: 'anechoic-unilateral',
    answerDiseaseId: 'pancreaticopleural-fistula',
    choices: [
      'pancreaticopleural-fistula',
      'esophageal-rupture',
      'congestive-heart-failure',
      'sarcoidosis-pleural-effusion',
    ],
    explanation: '慢性胰腺炎中胸腔淀粉酶极高，提示胰源性胸膜瘘，而非原发性胸膜病变。',
    difficulty: 'advanced',
  },
  {
    id: 'hemothorax',
    stem: '一名抗凝患者在钝性创伤后出现新发的大量胸腔积液。',
    findings: [
      '大体血性液体',
      '积液/血液血细胞比容比值 0.62',
      '超声血细胞比容征',
      '急性呼吸困难和胸膜炎性疼痛',
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
    explanation: '血性液体并不特异，但积液/血液血细胞比容比值大于 0.5 即定义为血胸。',
    difficulty: 'core',
  },
]

export function getPleuralAnalysisQuizItems(locale: string): readonly PleuralAnalysisQuizItem[] {
  return pickLocaleContent(locale, {
    en: pleuralAnalysisQuizItems,
    es: pleuralAnalysisQuizItemsEs,
    'zh-CN': pleuralAnalysisQuizItemsZhCn,
  })
}
