import { pickLocaleContent } from '@/i18n/content'

import type { PleuralFluidCase } from '../engine/types'

export const pleuralFluidCases: readonly PleuralFluidCase[] = [
  {
    id: 'diuresed-heart-failure',
    title: 'Diuresed heart failure',
    subtitle: 'Positive Light criteria with a systemic story',
    patient:
      'A 78-year-old with orthopnea, edema, preserved EF, bilateral anechoic effusions, and improvement after IV diuresis.',
    clinicalClues: [
      'Bilateral anechoic effusions',
      'High NT-proBNP',
      'No fever, pleuritic pain, or pleural thickening',
      'Thoracentesis performed because the left side lagged behind clinically',
    ],
    teachingFocus:
      'Recognize pseudoexudate physiology before escalating to invasive exudate workup.',
    input: {
      clinicalContext: 'heart-failure-diuresis',
      ultrasound: 'anechoic-bilateral',
      appearance: 'straw',
      serumProtein: 6.5,
      pleuralProtein: 3.3,
      serumLdh: 210,
      pleuralLdh: 145,
      serumLdhUpperLimit: 220,
      serumAlbumin: 3.8,
      pleuralAlbumin: 2.3,
      ntProBnp: 4200,
      pleuralPH: 7.48,
      pleuralGlucose: 112,
      nucleatedCells: 420,
      neutrophils: 12,
      lymphocytes: 38,
      eosinophils: 2,
      mesothelialCells: 14,
      triglycerides: 18,
      cholesterol: 38,
      ada: 8,
      amylase: 22,
      cytologyPositive: false,
      microbiologyPositive: false,
      chylomicronsPresent: false,
    },
  },
  {
    id: 'septated-pneumonia',
    title: 'Septated pneumonia effusion',
    subtitle: 'The pH/glucose/LDH branch matters more than the label',
    patient:
      'A 62-year-old with pneumonia, fever, pleuritic pain, rising oxygen need, and a complex septated right effusion on ultrasound.',
    clinicalClues: [
      'Ipsilateral pneumonia',
      'Complex septated ultrasound pattern',
      'Neutrophil-predominant fluid',
      'Low pH and low glucose',
    ],
    teachingFocus:
      'Use PFA to decide whether a parapneumonic effusion has crossed into drainage territory.',
    input: {
      clinicalContext: 'pneumonia-infection',
      ultrasound: 'septated',
      appearance: 'turbid',
      serumProtein: 6.8,
      pleuralProtein: 4.8,
      serumLdh: 210,
      pleuralLdh: 1850,
      serumLdhUpperLimit: 220,
      serumAlbumin: 3.2,
      pleuralAlbumin: 2.4,
      ntProBnp: 410,
      pleuralPH: 7.05,
      pleuralGlucose: 28,
      nucleatedCells: 65000,
      neutrophils: 92,
      lymphocytes: 4,
      eosinophils: 0,
      mesothelialCells: 1,
      triglycerides: 42,
      cholesterol: 86,
      ada: 22,
      amylase: 35,
      cytologyPositive: false,
      microbiologyPositive: true,
      chylomicronsPresent: false,
    },
  },
  {
    id: 'lymphocytic-tb-risk',
    title: 'Lymphocytic effusion after travel',
    subtitle: 'The PFA narrows; exposure history pushes',
    patient:
      'A 29-year-old with pleuritic pain, night sweats, prior work in TB-endemic regions, and unilateral anechoic effusion.',
    clinicalClues: [
      'Lymphocytes above 80%',
      'High pleural protein and LDH',
      'Exposure history matters even in a lower-prevalence region',
      'Initial stains can be negative',
    ],
    teachingFocus:
      'Pair lymphocyte-predominant exudate with travel/exposure history and biopsy strategy.',
    input: {
      clinicalContext: 'tb-exposure',
      ultrasound: 'anechoic-unilateral',
      appearance: 'serous',
      serumProtein: 6,
      pleuralProtein: 4.3,
      serumLdh: 128,
      pleuralLdh: 612,
      serumLdhUpperLimit: 220,
      serumAlbumin: 3.7,
      pleuralAlbumin: 2.6,
      ntProBnp: 180,
      pleuralPH: 7.38,
      pleuralGlucose: 59,
      nucleatedCells: 2708,
      neutrophils: 8,
      lymphocytes: 83,
      eosinophils: 1,
      mesothelialCells: 2,
      triglycerides: 35,
      cholesterol: 109,
      ada: 76,
      amylase: 40,
      cytologyPositive: false,
      microbiologyPositive: false,
      chylomicronsPresent: false,
    },
  },
  {
    id: 'malignancy-transudate-trap',
    title: 'Cancer context with bland chemistry',
    subtitle: 'A transudate label does not end the workup',
    patient:
      'A 69-year-old with weight loss, smoking history, recurrent unilateral effusion, and pleural nodularity on ultrasound.',
    clinicalClues: [
      'Recurrent unilateral effusion',
      'Pleural nodularity',
      'Cytology from the first tap was negative',
      'Concurrent renal disease could bias chemistry toward transudate',
    ],
    teachingFocus:
      'Avoid false reassurance when imaging and history keep malignant pleural disease likely.',
    input: {
      clinicalContext: 'malignancy',
      ultrasound: 'nodular-thickened',
      appearance: 'serosanguineous',
      serumProtein: 6.4,
      pleuralProtein: 2.7,
      serumLdh: 190,
      pleuralLdh: 110,
      serumLdhUpperLimit: 220,
      serumAlbumin: 3.4,
      pleuralAlbumin: 2.1,
      ntProBnp: 820,
      pleuralPH: 7.35,
      pleuralGlucose: 86,
      nucleatedCells: 1200,
      neutrophils: 18,
      lymphocytes: 62,
      eosinophils: 4,
      mesothelialCells: 6,
      triglycerides: 34,
      cholesterol: 42,
      ada: 16,
      amylase: 52,
      cytologyPositive: false,
      microbiologyPositive: false,
      chylomicronsPresent: false,
    },
  },
  {
    id: 'milky-lymphatic',
    title: 'Milky lymphatic effusion',
    subtitle: 'Appearance creates a targeted-test branch',
    patient:
      'A 76-year-old with dyspnea, lymphedema, dystrophic nails, bilateral effusions, and milky yellow fluid at thoracentesis.',
    clinicalClues: [
      'Milky fluid can be chyle or cholesterol',
      'Lymphocyte-predominant profile',
      'Triglycerides are diagnostic here',
      'Yellow-nail phenotype connects the bedside exam to PFA',
    ],
    teachingFocus:
      'Use gross appearance to order lipid studies instead of forcing every effusion through infection or malignancy.',
    input: {
      clinicalContext: 'post-procedure-lymphatic',
      ultrasound: 'anechoic-bilateral',
      appearance: 'milky',
      serumProtein: 6.1,
      pleuralProtein: 4.2,
      serumLdh: 176,
      pleuralLdh: 78,
      serumLdhUpperLimit: 220,
      serumAlbumin: 3.5,
      pleuralAlbumin: 2.4,
      ntProBnp: 620,
      pleuralPH: 7.43,
      pleuralGlucose: 96,
      nucleatedCells: 494,
      neutrophils: 14,
      lymphocytes: 66,
      eosinophils: 1,
      mesothelialCells: 8,
      triglycerides: 264,
      cholesterol: 92,
      ada: 10,
      amylase: 33,
      cytologyPositive: false,
      microbiologyPositive: false,
      chylomicronsPresent: false,
    },
  },
] as const

export const defaultPleuralFluidCase = pleuralFluidCases[0]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Only learner-facing prose is
// translated; each variant reuses the English case's numeric `input` (by id) so
// the interpretation engine and the default-case selection stay identical.
// See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const caseInputById = new Map(pleuralFluidCases.map((item) => [item.id, item.input]))

type LocalizedCaseText = Pick<
  PleuralFluidCase,
  'id' | 'title' | 'subtitle' | 'patient' | 'clinicalClues' | 'teachingFocus'
>

function buildLocalizedCases(texts: readonly LocalizedCaseText[]): readonly PleuralFluidCase[] {
  return texts.map((text) => {
    const input = caseInputById.get(text.id)

    if (!input) {
      throw new Error(`Missing pleural fluid case input for id ${text.id}`)
    }

    return { ...text, input }
  })
}

const pleuralFluidCaseTextEs: readonly LocalizedCaseText[] = [
  {
    id: 'diuresed-heart-failure',
    title: 'Insuficiencia cardíaca diuresada',
    subtitle: 'Criterios de Light positivos con una historia sistémica',
    patient:
      'Persona de 78 años con ortopnea, edema, FE conservada, derrames anecoicos bilaterales y mejoría tras diuresis IV.',
    clinicalClues: [
      'Derrames anecoicos bilaterales',
      'NT-proBNP alto',
      'Sin fiebre, dolor pleurítico ni engrosamiento pleural',
      'Toracocentesis realizada porque el lado izquierdo iba clínicamente rezagado',
    ],
    teachingFocus:
      'Reconocer la fisiología del pseudoexudado antes de escalar a un estudio invasivo de exudado.',
  },
  {
    id: 'septated-pneumonia',
    title: 'Derrame paraneumónico septado',
    subtitle: 'La rama de pH/glucosa/LDH importa más que la etiqueta',
    patient:
      'Persona de 62 años con neumonía, fiebre, dolor pleurítico, aumento de la necesidad de oxígeno y un derrame derecho complejo y septado en la ecografía.',
    clinicalClues: [
      'Neumonía ipsilateral',
      'Patrón ecográfico complejo y septado',
      'Líquido de predominio neutrofílico',
      'pH bajo y glucosa baja',
    ],
    teachingFocus:
      'Usar el análisis del líquido para decidir si un derrame paraneumónico ha cruzado al territorio de drenaje.',
  },
  {
    id: 'lymphocytic-tb-risk',
    title: 'Derrame linfocítico tras un viaje',
    subtitle: 'El análisis del líquido estrecha; la historia de exposición empuja',
    patient:
      'Persona de 29 años con dolor pleurítico, sudores nocturnos, trabajo previo en regiones endémicas de TB y derrame anecoico unilateral.',
    clinicalClues: [
      'Linfocitos por encima del 80%',
      'Proteína y LDH pleurales altas',
      'La historia de exposición importa incluso en una región de menor prevalencia',
      'Las tinciones iniciales pueden ser negativas',
    ],
    teachingFocus:
      'Emparejar el exudado de predominio linfocítico con la historia de viaje/exposición y la estrategia de biopsia.',
  },
  {
    id: 'malignancy-transudate-trap',
    title: 'Contexto de cáncer con química anodina',
    subtitle: 'Una etiqueta de transudado no termina el estudio',
    patient:
      'Persona de 69 años con pérdida de peso, antecedente de tabaquismo, derrame unilateral recurrente y nodularidad pleural en la ecografía.',
    clinicalClues: [
      'Derrame unilateral recurrente',
      'Nodularidad pleural',
      'La citología de la primera punción fue negativa',
      'Una enfermedad renal concurrente podría sesgar la química hacia transudado',
    ],
    teachingFocus:
      'Evitar la falsa tranquilidad cuando la imagen y la historia mantienen probable la enfermedad pleural maligna.',
  },
  {
    id: 'milky-lymphatic',
    title: 'Derrame linfático lechoso',
    subtitle: 'El aspecto crea una rama de pruebas dirigidas',
    patient:
      'Persona de 76 años con disnea, linfedema, uñas distróficas, derrames bilaterales y líquido lechoso amarillento en la toracocentesis.',
    clinicalClues: [
      'El líquido lechoso puede ser quilo o colesterol',
      'Perfil de predominio linfocítico',
      'Los triglicéridos son diagnósticos aquí',
      'El fenotipo de uñas amarillas conecta la exploración con el análisis del líquido',
    ],
    teachingFocus:
      'Usar el aspecto macroscópico para solicitar estudios lipídicos en lugar de forzar todo derrame por la vía de infección o malignidad.',
  },
]

const pleuralFluidCaseTextZhCn: readonly LocalizedCaseText[] = [
  {
    id: 'diuresed-heart-failure',
    title: '已利尿的心力衰竭',
    subtitle: 'Light 标准阳性，但伴有全身性病史',
    patient: '78 岁，端坐呼吸、水肿、EF 保留、双侧无回声积液，IV 利尿后改善。',
    clinicalClues: [
      '双侧无回声积液',
      'NT-proBNP 升高',
      '无发热、胸膜炎性疼痛或胸膜增厚',
      '因左侧在临床上恢复滞后而行胸腔穿刺',
    ],
    teachingFocus: '在升级到有创的渗出液检查之前，识别假性渗出液的生理机制。',
  },
  {
    id: 'septated-pneumonia',
    title: '分隔的肺炎旁积液',
    subtitle: 'pH/葡萄糖/LDH 这条分支比标签更重要',
    patient: '62 岁，肺炎、发热、胸膜炎性疼痛、氧需求上升，超声示右侧复杂分隔积液。',
    clinicalClues: ['同侧肺炎', '复杂分隔的超声表现', '以中性粒细胞为主的液体', '低 pH 和低葡萄糖'],
    teachingFocus: '用积液分析判断肺炎旁积液是否已进入需要引流的范畴。',
  },
  {
    id: 'lymphocytic-tb-risk',
    title: '旅行后的淋巴细胞性积液',
    subtitle: '积液分析缩小范围；暴露史推动判断',
    patient: '29 岁，胸膜炎性疼痛、盗汗、既往在结核流行地区工作，单侧无回声积液。',
    clinicalClues: [
      '淋巴细胞高于 80%',
      '胸腔积液蛋白和 LDH 升高',
      '即使在低流行地区，暴露史仍然重要',
      '初次染色可为阴性',
    ],
    teachingFocus: '将以淋巴细胞为主的渗出液与旅行/暴露史和活检策略结合起来。',
  },
  {
    id: 'malignancy-transudate-trap',
    title: '癌症背景但生化平淡',
    subtitle: '漏出液的标签并不能结束检查',
    patient: '69 岁，体重下降、吸烟史、复发性单侧积液，超声示胸膜结节。',
    clinicalClues: [
      '复发性单侧积液',
      '胸膜结节',
      '首次穿刺的细胞学阴性',
      '合并肾病可能使生化偏向漏出液',
    ],
    teachingFocus: '当影像和病史仍提示恶性胸膜病变可能时，避免错误的放心。',
  },
  {
    id: 'milky-lymphatic',
    title: '乳白色淋巴性积液',
    subtitle: '外观引出一条有针对性的检查分支',
    patient: '76 岁，呼吸困难、淋巴水肿、营养不良性指甲、双侧积液，胸腔穿刺时为乳白偏黄液体。',
    clinicalClues: [
      '乳白色液体可为乳糜或胆固醇',
      '以淋巴细胞为主的特征',
      '此处甘油三酯具有诊断价值',
      '黄甲表型把床旁查体与积液分析联系起来',
    ],
    teachingFocus: '利用大体外观去开具脂质检查，而不是把每一例积液都硬套进感染或恶性肿瘤的路径。',
  },
]

const pleuralFluidCasesEs = buildLocalizedCases(pleuralFluidCaseTextEs)
const pleuralFluidCasesZhCn = buildLocalizedCases(pleuralFluidCaseTextZhCn)

export function getPleuralFluidCases(locale: string): readonly PleuralFluidCase[] {
  return pickLocaleContent(locale, {
    en: pleuralFluidCases,
    es: pleuralFluidCasesEs,
    'zh-CN': pleuralFluidCasesZhCn,
  })
}
