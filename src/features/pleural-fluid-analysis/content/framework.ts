import { pickLocaleContent } from '@/i18n/content'

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

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Option ids and reference ids
// mirror the English source so engine logic and citation lookups stay identical;
// only learner-facing labels/descriptions/prose differ. See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const pleuralAnalysisDisclaimerEs =
  'Este módulo es para educación y simulación. No reemplaza los protocolos locales, la consulta con especialistas ni el juicio clínico específico de cada paciente.'

const pleuralAnalysisDisclaimerZhCn =
  '本模块用于教育和模拟，不能替代当地规程、专科会诊或针对具体患者的临床判断。'

type ClinicalContextOption = { id: ClinicalContextId; label: string; description: string }
type UltrasoundPatternOption = { id: UltrasoundPattern; label: string; description: string }
type FluidAppearanceOption = { id: FluidAppearance; label: string }

const clinicalContextOptionsEs: readonly ClinicalContextOption[] = [
  {
    id: 'uncertain',
    label: 'Presentación poco clara',
    description: 'Ningún síndrome único explica el derrame antes del muestreo.',
  },
  {
    id: 'heart-failure-diuresis',
    label: 'IC tras diuresis',
    description: 'Fisiología de presión sistémica con riesgo de química de pseudoexudado.',
  },
  {
    id: 'hepatic-renal-systemic',
    label: 'Hepático / renal / albúmina baja',
    description: 'Marco de transudado sistémico, sobre todo cuando es bilateral y anecoico.',
  },
  {
    id: 'pneumonia-infection',
    label: 'Neumonía o infección',
    description:
      'El análisis del líquido debe decidir si la infección requiere drenaje o control del foco.',
  },
  {
    id: 'tb-exposure',
    label: 'TB o exposición endémica',
    description:
      'La historia de exposición cambia el valor de los linfocitos, la ADA y la biopsia.',
  },
  {
    id: 'malignancy',
    label: 'Cáncer / nodularidad pleural',
    description:
      'La citología y los objetivos pleurales importan incluso cuando la química es inespecífica.',
  },
  {
    id: 'post-procedure-lymphatic',
    label: 'Linfático / posprocedimiento',
    description:
      'Líquido lechoso, cirugía, linfoma o fenotipo de uñas amarillas desencadenan pruebas de lípidos.',
  },
  {
    id: 'trauma-hemothorax',
    label: 'Trauma / anticoagulación',
    description: 'El líquido francamente sanguinolento necesita una rama de hematocrito pleural.',
  },
  {
    id: 'pancreatic-esophageal',
    label: 'Pancreático / esofágico',
    description: 'La amilasa y la anatomía del foco pueden ser decisivas.',
  },
  {
    id: 'autoimmune',
    label: 'Pleuritis autoinmune',
    description: 'Los derrames reumatoide y lúpico pueden imitar una infección pleural.',
  },
]

const ultrasoundPatternOptionsEs: readonly UltrasoundPatternOption[] = [
  {
    id: 'anechoic-unilateral',
    label: 'Anecoico unilateral',
    description: 'Puede ser transudado o exudado; el contexto clínico decide si se muestrea.',
  },
  {
    id: 'anechoic-bilateral',
    label: 'Anecoico bilateral',
    description: 'Apoya causas sistémicas cuando la historia clínica es evidente.',
  },
  {
    id: 'septated',
    label: 'Septado',
    description: 'Aumenta la preocupación por infección, malignidad o hemotórax.',
  },
  {
    id: 'complex-homogeneous',
    label: 'Complejo homogéneo',
    description:
      'A menudo requiere pensar en drenaje cuando la infección o la sangre son plausibles.',
  },
  {
    id: 'nodular-thickened',
    label: 'Pleura nodular / engrosada',
    description: 'Una pista de malignidad de alta especificidad cuando se ve de forma convincente.',
  },
  {
    id: 'hematocrit-sign',
    label: 'Signo del hematocrito',
    description: 'Los productos hemáticos que se estratifican crean una rama de hemotórax.',
  },
  {
    id: 'too-small',
    label: 'Bolsillo < 1 cm',
    description:
      'Suele ser una decisión de seguridad y observación antes del muestreo diagnóstico.',
  },
]

const fluidAppearanceOptionsEs: readonly FluidAppearanceOption[] = [
  { id: 'straw', label: 'Pajizo / claro' },
  { id: 'serous', label: 'Seroso' },
  { id: 'serosanguineous', label: 'Serosanguinolento' },
  { id: 'bloody', label: 'Sanguinolento' },
  { id: 'milky', label: 'Lechoso' },
  { id: 'turbid', label: 'Turbio' },
  { id: 'purulent', label: 'Pus franco' },
  { id: 'green', label: 'Verde' },
  { id: 'food-particles', label: 'Partículas de alimento' },
  { id: 'urine-odor', label: 'Olor a orina' },
]

const clinicalContextOptionsZhCn: readonly ClinicalContextOption[] = [
  {
    id: 'uncertain',
    label: '表现不明确',
    description: '在取样前，没有单一综合征能解释该积液。',
  },
  {
    id: 'heart-failure-diuresis',
    label: '利尿后的 CHF',
    description: '全身性压力生理，伴假性渗出液生化的风险。',
  },
  {
    id: 'hepatic-renal-systemic',
    label: '肝 / 肾 / 低白蛋白',
    description: '全身性漏出液的框架，尤其在双侧无回声时。',
  },
  {
    id: 'pneumonia-infection',
    label: '肺炎或感染',
    description: '积液分析应判断感染是否需要引流或源头控制。',
  },
  {
    id: 'tb-exposure',
    label: '结核或流行区暴露',
    description: '暴露史改变了淋巴细胞、ADA 和活检的价值。',
  },
  {
    id: 'malignancy',
    label: '癌症 / 胸膜结节',
    description: '即使生化不特异，细胞学和胸膜靶点仍然重要。',
  },
  {
    id: 'post-procedure-lymphatic',
    label: '淋巴 / 术后',
    description: '乳白色液体、手术、淋巴瘤或黄甲表型会触发脂质检查。',
  },
  {
    id: 'trauma-hemothorax',
    label: '创伤 / 抗凝',
    description: '大体血性液体需要进入胸腔血细胞比容分支。',
  },
  {
    id: 'pancreatic-esophageal',
    label: '胰腺 / 食管',
    description: '淀粉酶和源头解剖可能起决定作用。',
  },
  {
    id: 'autoimmune',
    label: '自身免疫性胸膜炎',
    description: '类风湿和狼疮性积液可类似胸膜感染。',
  },
]

const ultrasoundPatternOptionsZhCn: readonly UltrasoundPatternOption[] = [
  {
    id: 'anechoic-unilateral',
    label: '单侧无回声',
    description: '可为漏出液或渗出液；由临床背景决定是否取样。',
  },
  {
    id: 'anechoic-bilateral',
    label: '双侧无回声',
    description: '当临床病史明确时支持全身性病因。',
  },
  {
    id: 'septated',
    label: '分隔',
    description: '提高对感染、恶性肿瘤或血胸的担忧。',
  },
  {
    id: 'complex-homogeneous',
    label: '复杂均质',
    description: '当感染或出血可能时，常需按引流层面思考。',
  },
  {
    id: 'nodular-thickened',
    label: '结节状 / 增厚的胸膜',
    description: '若所见确切，是高特异性的恶性肿瘤线索。',
  },
  {
    id: 'hematocrit-sign',
    label: '血细胞比容征',
    description: '分层的血液产物形成一条血胸分支。',
  },
  {
    id: 'too-small',
    label: '< 1 cm 积液腔',
    description: '在诊断性取样前，通常是安全与观察的决策。',
  },
]

const fluidAppearanceOptionsZhCn: readonly FluidAppearanceOption[] = [
  { id: 'straw', label: '草黄色 / 清亮' },
  { id: 'serous', label: '浆液性' },
  { id: 'serosanguineous', label: '血清血性' },
  { id: 'bloody', label: '血性' },
  { id: 'milky', label: '乳白色' },
  { id: 'turbid', label: '浑浊' },
  { id: 'purulent', label: '明显脓性' },
  { id: 'green', label: '绿色' },
  { id: 'food-particles', label: '食物颗粒' },
  { id: 'urine-odor', label: '尿味' },
]

type FrameworkStep = { title: string; body: string }
type PatternEntry = { pattern: string; signal: string; move: string }

const analysisFrameworkStepsEs: readonly FrameworkStep[] = [
  {
    title: 'Empieza antes del tubo',
    body: 'La historia, la exploración, la lateralidad, la cronicidad, el carácter ecográfico y la probabilidad pretest determinan lo que el análisis del líquido puede y no puede demostrar.',
  },
  {
    title: 'Decide si el muestreo es necesario',
    body: 'Bolsillos pequeños inseguros, derrames sistémicos anecoicos bilaterales evidentes y pequeños derrames asociados a EP pueden manejarse sin toracocentesis diagnóstica.',
  },
  {
    title: 'Envía el núcleo de rutina',
    body: 'Aspecto, proteína y LDH emparejadas, pH, glucosa y recuento celular con diferencial dan el primer pase de mayor rendimiento.',
  },
  {
    title: 'Clasifica, luego desconfía con suavidad',
    body: 'Los criterios de Light son sensibles para los exudados, pero la IC diuresada, el hidrotórax hepático y la fisiología post-CABG pueden disfrazarse de exudados.',
  },
  {
    title: 'Deja que las pruebas especiales respondan preguntas concretas',
    body: 'Triglicéridos, hematocrito, creatinina, bilirrubina, amilasa, ADA, citología, flujo y cultivos deben seguir una rama clínica, no un panel reflejo.',
  },
  {
    title: 'Reconcilia las discordancias',
    body: 'Cuando el análisis del líquido y la historia clínica divergen, revisa la imagen, la calidad de la muestra, el manejo del pH, los diagnósticos competidores y la necesidad de biopsia o seguimiento.',
  },
]

const patternLibraryEs: readonly PatternEntry[] = [
  {
    pattern: 'Pseudoexudado',
    signal:
      'Criterios de Light positivos por un margen pequeño tras diuresis o en fisiología hepática/sistémica',
    move: 'Comprueba el gradiente de albúmina suero-pleural, el gradiente de proteína y el NT-proBNP.',
  },
  {
    pattern: 'Derrame paraneumónico complicado',
    signal:
      'Contexto de neumonía con pH < 7,2, glucosa < 60, LDH > 1.000, células muy altas o microbiología positiva',
    move: 'Piensa en drenaje y manejo de loculación, no solo en la clasificación del exudado.',
  },
  {
    pattern: 'Fenotipo de TB',
    signal:
      'Exudado de predominio linfocítico con riesgo de exposición, proteína alta, bajas células mesoteliales y ADA elevada',
    move: 'Envía cultivos, pero planifica una biopsia pleural cuando la sospecha se mantenga alta.',
  },
  {
    pattern: 'Quilotórax',
    signal:
      'Líquido lechoso o turbio con triglicéridos > 110 mg/dL, o quilomicrones con triglicéridos intermedios',
    move: 'Busca traumatismo, cirugía torácica, linfoma, trastornos linfáticos o cirrosis.',
  },
  {
    pattern: 'Hemotórax',
    signal:
      'Líquido francamente sanguinolento o signo del hematocrito ecográfico con relación hematocrito LP/sangre > 0,5',
    move: 'Escala el pensamiento de drenaje y control del foco.',
  },
  {
    pattern: 'Trampa de malignidad',
    signal:
      'Derrame unilateral recurrente, nodularidad pleural, pérdida de peso o antecedente de cáncer a pesar de una química anodina',
    move: 'Haz bien la citología y luego biopsia si la probabilidad pretest se mantiene alta.',
  },
  {
    pattern: 'Síndrome de las uñas amarillas',
    signal:
      'Derrame recurrente con linfedema, uñas amarillas distróficas, bronquiectasias y líquido de predominio linfocítico',
    move: 'Deja que el fenotipo clínico reabra el diferencial linfático, incluso cuando la química de rutina sea inespecífica.',
  },
  {
    pattern: 'Derrame de origen extravascular',
    signal:
      'Proteína muy baja o una relación específica del líquido como creatinina, bilirrubina, glucosa, amilasa o beta-2 transferrina',
    move: 'Deja de repetir punciones diagnósticas y busca la vía de origen que alimenta el espacio pleural.',
  },
]

const analysisFrameworkStepsZhCn: readonly FrameworkStep[] = [
  {
    title: '在置管之前就开始',
    body: '病史、查体、侧别、慢性程度、超声特征和验前概率，决定了积液分析能证明什么、不能证明什么。',
  },
  {
    title: '判断是否需要取样',
    body: '不安全的小积液腔、明显的双侧无回声全身性积液，以及与肺栓塞相关的小积液，可不必做诊断性胸腔穿刺即可处理。',
  },
  {
    title: '送检常规核心项目',
    body: '外观、配对的蛋白和 LDH、pH、葡萄糖以及带分类的细胞计数，可提供产率最高的首轮检查。',
  },
  {
    title: '先分类，再温和地存疑',
    body: 'Light 标准对渗出液敏感，但利尿后的 CHF、肝性胸水和 CABG 术后生理都可能伪装成渗出液。',
  },
  {
    title: '让特殊检查回答具体问题',
    body: '甘油三酯、血细胞比容、肌酐、胆红素、淀粉酶、ADA、细胞学、流式和培养，都应沿临床分支进行，而非反射式地全套开单。',
  },
  {
    title: '核对不一致之处',
    body: '当积液分析与床旁病史不一致时，重新审视影像、样本质量、pH 处理、竞争性诊断以及活检或随访的必要性。',
  },
]

const patternLibraryZhCn: readonly PatternEntry[] = [
  {
    pattern: '假性渗出液',
    signal: '利尿后或在肝性/全身性生理下，以微小差距满足 Light 标准',
    move: '检查血清-胸腔白蛋白梯度、蛋白梯度和 NT-proBNP。',
  },
  {
    pattern: '复杂性肺炎旁积液',
    signal: '肺炎背景下 pH < 7.2、葡萄糖 < 60、LDH > 1,000、细胞极高或微生物学阳性',
    move: '考虑引流和分隔处理，而不仅是渗出液分类。',
  },
  {
    pattern: '结核表型',
    signal: '以淋巴细胞为主的渗出液，伴暴露风险、高蛋白、低间皮细胞和 ADA 升高',
    move: '送培养，但当怀疑持续较高时计划胸膜活检。',
  },
  {
    pattern: '乳糜胸',
    signal: '乳白或浑浊液体，甘油三酯 > 110 mg/dL，或甘油三酯中等但存在乳糜微粒',
    move: '寻找创伤、胸外科手术、淋巴瘤、淋巴系统疾病或肝硬化。',
  },
  {
    pattern: '血胸',
    signal: '大体血性液体或超声血细胞比容征，积液/血液血细胞比容比值 > 0.5',
    move: '升级引流和源头控制的思路。',
  },
  {
    pattern: '恶性肿瘤陷阱',
    signal: '尽管生化平淡，仍有复发性单侧积液、胸膜结节、体重下降或癌症史',
    move: '正确地做细胞学，若验前概率仍高则活检。',
  },
  {
    pattern: '黄甲综合征',
    signal: '复发性积液伴淋巴水肿、营养不良性黄甲、支气管扩张和以淋巴细胞为主的液体',
    move: '即使常规生化不特异，也让床旁表型重新打开淋巴系统的鉴别诊断。',
  },
  {
    pattern: '血管外来源积液',
    signal: '蛋白极低，或某种积液特异比值，如肌酐、胆红素、葡萄糖、淀粉酶或 β-2 转铁蛋白',
    move: '停止反复做诊断性穿刺，转而寻找通向胸膜腔的来源通路。',
  },
]

type ReferenceEntry = { id: string; citation: string; source: string; useNote: string }

const referenceById = new Map<string, ReferenceEntry>(
  pleuralAnalysisReferences.map((reference) => [reference.id, reference]),
)

function buildLocalizedReferences(
  notes: readonly { id: string; useNote: string }[],
): readonly ReferenceEntry[] {
  return notes.map((note) => {
    const reference = referenceById.get(note.id)

    if (!reference) {
      throw new Error(`Missing pleural analysis reference for id ${note.id}`)
    }

    return { ...reference, useNote: note.useNote }
  })
}

const pleuralAnalysisReferencesEs = buildLocalizedReferences([
  {
    id: 'chopra-2025-pfa',
    useNote:
      'Criterios de Light, pseudoexudados, pruebas dirigidas, inspección macroscópica y tablas de patrones del análisis del líquido.',
  },
  {
    id: 'chopra-2025-clinical',
    useNote:
      'Contexto clínico, historia, ecografía, patrones radiográficos, análisis de sangre y algoritmo diagnóstico.',
  },
  {
    id: 'light-pleural-diseases',
    useNote:
      'Exploración clínica clásica, separación transudado-exudado, interpretación de pH/glucosa/recuento celular y limitaciones de las pruebas.',
  },
])

const pleuralAnalysisReferencesZhCn = buildLocalizedReferences([
  {
    id: 'chopra-2025-pfa',
    useNote: 'Light 标准、假性渗出液、有针对性的检查、大体观察以及积液分析的模式表。',
  },
  {
    id: 'chopra-2025-clinical',
    useNote: '临床背景、病史、超声、影像学模式、血液检查以及诊断流程。',
  },
  {
    id: 'light-pleural-diseases',
    useNote: '经典临床查体、漏出液-渗出液的区分、pH/葡萄糖/细胞计数的解读，以及检查的局限性。',
  },
])

export function getPleuralAnalysisDisclaimer(locale: string): string {
  return pickLocaleContent(locale, {
    en: pleuralAnalysisDisclaimer,
    es: pleuralAnalysisDisclaimerEs,
    'zh-CN': pleuralAnalysisDisclaimerZhCn,
  })
}

export function getClinicalContextOptions(locale: string): readonly ClinicalContextOption[] {
  return pickLocaleContent(locale, {
    en: clinicalContextOptions,
    es: clinicalContextOptionsEs,
    'zh-CN': clinicalContextOptionsZhCn,
  })
}

export function getUltrasoundPatternOptions(locale: string): readonly UltrasoundPatternOption[] {
  return pickLocaleContent(locale, {
    en: ultrasoundPatternOptions,
    es: ultrasoundPatternOptionsEs,
    'zh-CN': ultrasoundPatternOptionsZhCn,
  })
}

export function getFluidAppearanceOptions(locale: string): readonly FluidAppearanceOption[] {
  return pickLocaleContent(locale, {
    en: fluidAppearanceOptions,
    es: fluidAppearanceOptionsEs,
    'zh-CN': fluidAppearanceOptionsZhCn,
  })
}

export function getAnalysisFrameworkSteps(locale: string): readonly FrameworkStep[] {
  return pickLocaleContent(locale, {
    en: analysisFrameworkSteps,
    es: analysisFrameworkStepsEs,
    'zh-CN': analysisFrameworkStepsZhCn,
  })
}

export function getPatternLibrary(locale: string): readonly PatternEntry[] {
  return pickLocaleContent(locale, {
    en: patternLibrary,
    es: patternLibraryEs,
    'zh-CN': patternLibraryZhCn,
  })
}

export function getPleuralAnalysisReferences(locale: string): readonly ReferenceEntry[] {
  return pickLocaleContent(locale, {
    en: pleuralAnalysisReferences,
    es: pleuralAnalysisReferencesEs,
    'zh-CN': pleuralAnalysisReferencesZhCn,
  })
}
