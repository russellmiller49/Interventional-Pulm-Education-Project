import { pickLocaleContent } from '@/i18n/content'
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

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Block ids mirror the English
// source above so module progress and board-section anchors stay aligned; only
// the learner-facing prose differs. See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const fluidObjectivesEs: readonly string[] = [
  'Clasificar el líquido como transudado vs. exudado con los criterios de Light y reconocer la trampa del pseudoexudado.',
  'Elegir pruebas dirigidas del líquido pleural a partir del aspecto macroscópico y la historia clínica.',
  'Convertir el patrón del líquido en un diagnóstico diferencial ordenado y saber cuándo escalar más allá del análisis del líquido.',
]

const fluidCoreBlocksEs: LearnBlock[] = [
  {
    id: 'lights-criteria',
    title: 'Transudado vs. exudado: los criterios de Light',
    paragraphs: [
      'La primera bifurcación en el estudio de cualquier derrame es transudado frente a exudado, y los criterios de Light son la herramienta de primera línea. El líquido es un exudado si cumple cualquiera de los tres criterios — por lo que la regla es muy sensible para los exudados.',
    ],
    bullets: [
      'Proteína del líquido pleural / proteína sérica > 0,5.',
      'LDH del líquido pleural / LDH sérica > 0,6.',
      'LDH del líquido pleural > dos tercios del límite superior de la normalidad de la LDH sérica.',
      'No cumple ninguno → transudado (piensa en una causa sistémica: insuficiencia cardíaca, cirrosis, síndrome nefrótico).',
    ],
  },
  {
    id: 'pseudoexudate',
    title: 'La trampa del pseudoexudado',
    paragraphs: [
      'Como los criterios de Light son sensibles, sobrediagnostican el exudado — más a menudo en un paciente con insuficiencia cardíaca que ha sido diuresado, lo que concentra el líquido y lo empuja a cruzar el umbral. Cuando todo el cuadro parece transudativo pero Light lo etiqueta como exudado por un margen pequeño, reconcilia antes de perseguir un estudio de exudado.',
    ],
    bullets: [
      'Un gradiente de albúmina suero-líquido pleural > 1,2 g/dL sugiere un transudado a pesar de los criterios de Light.',
      'Un gradiente de proteína suero-líquido pleural > 3,1 g/dL apunta en la misma dirección.',
      'Un NT-proBNP alto apoya un origen cardíaco (transudativo).',
      'Usa el gradiente/BNP cuando la historia sea de insuficiencia cardíaca clásica pero Light apenas sea exudativo.',
    ],
  },
  {
    id: 'what-to-order',
    title: 'Qué solicitar — y por qué',
    bullets: [
      'Siempre: recuento celular y diferencial; proteína y LDH (para Light); glucosa; pH (riesgo paraneumónico); citología cuando la malignidad esté sobre la mesa.',
      'De forma selectiva, según la historia: ADA (tuberculosis), amilasa (origen pancreático o rotura esofágica), triglicéridos y colesterol (quilotórax vs. pseudoquilotórax).',
      'Aún más selectivo: creatinina del líquido pleural (urinotórax), bilirrubina (biliotórax) y hematocrito (hemotórax).',
      'Envía el pH en un analizador de gases en sangre y empareja cada cifra con el contexto clínico.',
    ],
  },
  {
    id: 'gross-appearance',
    title: 'Lee primero el aspecto macroscópico',
    bullets: [
      'Turbio o francamente purulento → piensa en un derrame paraneumónico complicado o empiema.',
      'Lechoso → quilotórax o pseudoquilotórax (la separación triglicéridos/colesterol los distingue).',
      'Sanguinolento → malignidad, embolia pulmonar o traumatismo; confirma el hemotórax con una relación hematocrito líquido/sangre > 0,5.',
      'Otras pistas: partículas de alimento (rotura esofágica), olor a orina (urinotórax), líquido verde (biliotórax).',
    ],
  },
  {
    id: 'numbers-to-differential',
    title: 'De los números a un diagnóstico diferencial',
    bullets: [
      'Exudado con predominio de linfocitos → tuberculosis, malignidad o procesos crónicos (y empareja con ADA, citología).',
      'Exudado con predominio de neutrófilos → procesos agudos, especialmente el derrame paraneumónico.',
      'Glucosa baja / pH bajo → derrame paraneumónico/empiema, reumatoide o derrame maligno.',
      'La citología es específica pero no sensible — una punción negativa no descarta malignidad; escala a tejido cuando la sospecha se mantiene alta.',
    ],
  },
]

const fluidGoDeeperBlocksEs: LearnBlock[] = [
  {
    id: 'targeted-test-pearls',
    title: 'Perlas de pruebas dirigidas y los derrames raros',
    level: 'advanced',
    bullets: [
      'ADA elevada (a menudo > 40 IU/L) con un exudado linfocítico apoya la pleuritis tuberculosa.',
      'Amilasa muy alta → fístula pancreaticopleural o rotura esofágica.',
      'Triglicéridos > ~110 mg/dL → quilotórax; colesterol alto con triglicéridos bajos en enfermedad crónica → pseudoquilotórax.',
      'Creatinina líquido/suero > 1 → urinotórax; bilirrubina líquido/suero > 1 → biliotórax.',
    ],
  },
  {
    id: 'escalate-beyond-fluid',
    title: 'Cuándo escalar más allá del líquido',
    level: 'advanced',
    bullets: [
      'Tras una o dos muestras de citología no diagnósticas con sospecha persistente de malignidad, pasa a biopsia pleural guiada por imagen o toracoscopia en lugar de repetir pruebas solo del líquido.',
      'Deja que la probabilidad pretest y la imagen — no un único punto de corte de laboratorio — impulsen la escalada.',
    ],
  },
]

const fluidObjectivesZhCn: readonly string[] = [
  '用 Light 标准将积液分类为漏出液与渗出液，并识别假性渗出液（pseudoexudate）陷阱。',
  '根据大体外观和临床病史选择有针对性的胸腔积液检查。',
  '将积液特征转化为分层的鉴别诊断，并知道何时升级到积液检查之外的手段。',
]

const fluidCoreBlocksZhCn: LearnBlock[] = [
  {
    id: 'lights-criteria',
    title: '漏出液 vs. 渗出液：Light 标准',
    paragraphs: [
      '任何积液检查的第一个分叉都是漏出液还是渗出液，而 Light 标准是一线工具。只要满足三条标准中的任意一条，积液即为渗出液——因此该规则对渗出液非常敏感。',
    ],
    bullets: [
      '胸腔积液蛋白 / 血清蛋白 > 0.5。',
      '胸腔积液 LDH / 血清 LDH > 0.6。',
      '胸腔积液 LDH > 血清 LDH 正常上限的三分之二。',
      '三条均不满足 → 漏出液（考虑全身性病因：心力衰竭、肝硬化、肾病综合征）。',
    ],
  },
  {
    id: 'pseudoexudate',
    title: '假性渗出液陷阱',
    paragraphs: [
      '由于 Light 标准敏感，它会把渗出液过度判定——最常见于经过利尿的心力衰竭患者，利尿浓缩了积液，使其略微越过阈值。当整体情况看起来像漏出液，但 Light 以微小差距将其标为渗出液时，应先加以核对，再去做渗出液方向的检查。',
    ],
    bullets: [
      '血清-胸腔积液白蛋白梯度 > 1.2 g/dL 提示漏出液，即使 Light 标准为阳性。',
      '血清-胸腔积液蛋白梯度 > 3.1 g/dL 指向同一方向。',
      'NT-proBNP 升高支持心源性（漏出液）来源。',
      '当病史是典型心力衰竭但 Light 仅勉强为渗出液时，使用梯度/BNP。',
    ],
  },
  {
    id: 'what-to-order',
    title: '该查什么——以及为什么',
    bullets: [
      '常规：细胞计数与分类；蛋白和 LDH（用于 Light）；葡萄糖；pH（肺炎旁风险）；考虑恶性肿瘤时送细胞学。',
      '依病史选择性检查：ADA（结核）、淀粉酶（胰源或食管破裂）、甘油三酯和胆固醇（乳糜胸 vs. 假性乳糜胸）。',
      '更具选择性：胸腔积液肌酐（尿胸）、胆红素（胆汁胸）和血细胞比容（血胸）。',
      '用血气分析仪送检 pH，并将每一个数值与临床背景结合。',
    ],
  },
  {
    id: 'gross-appearance',
    title: '先看大体外观',
    bullets: [
      '浑浊或明显脓性 → 考虑复杂性肺炎旁积液或脓胸。',
      '乳白色 → 乳糜胸或假性乳糜胸（甘油三酯/胆固醇的分布可加以区分）。',
      '血性 → 恶性肿瘤、肺栓塞或创伤；以积液/血液血细胞比容比值 > 0.5 确认血胸。',
      '其他线索：食物颗粒（食管破裂）、尿味（尿胸）、绿色液体（胆汁胸）。',
    ],
  },
  {
    id: 'numbers-to-differential',
    title: '从数值到鉴别诊断',
    bullets: [
      '以淋巴细胞为主的渗出液 → 结核、恶性肿瘤或慢性病变（并结合 ADA、细胞学）。',
      '以中性粒细胞为主的渗出液 → 急性病变，尤其是肺炎旁积液。',
      '低葡萄糖 / 低 pH → 肺炎旁/脓胸、类风湿或恶性积液。',
      '细胞学特异但不敏感——一次阴性穿刺不能排除恶性肿瘤；当怀疑持续较高时升级取组织。',
    ],
  },
]

const fluidGoDeeperBlocksZhCn: LearnBlock[] = [
  {
    id: 'targeted-test-pearls',
    title: '有针对性检查的要点与罕见积液',
    level: 'advanced',
    bullets: [
      'ADA 升高（常 > 40 IU/L）伴淋巴细胞性渗出液支持结核性胸膜炎。',
      '淀粉酶极高 → 胰源性胸膜瘘或食管破裂。',
      '甘油三酯 > 约 110 mg/dL → 乳糜胸；慢性病变中胆固醇高而甘油三酯低 → 假性乳糜胸。',
      '积液/血清肌酐 > 1 → 尿胸；积液/血清胆红素 > 1 → 胆汁胸。',
    ],
  },
  {
    id: 'escalate-beyond-fluid',
    title: '何时升级到积液之外',
    level: 'advanced',
    bullets: [
      '在一到两次非诊断性细胞学样本后仍持续怀疑恶性肿瘤时，应转为影像引导下胸膜活检或胸腔镜检查，而不是重复仅做积液的检查。',
      '让验前概率和影像——而非单一的实验室截断值——来推动升级。',
    ],
  },
]

export function getFluidObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, {
    en: fluidObjectives as readonly string[],
    es: fluidObjectivesEs,
    'zh-CN': fluidObjectivesZhCn,
  })
}

export function getFluidCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: fluidCoreBlocks,
    es: fluidCoreBlocksEs,
    'zh-CN': fluidCoreBlocksZhCn,
  })
}

export function getFluidGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: fluidGoDeeperBlocks,
    es: fluidGoDeeperBlocksEs,
    'zh-CN': fluidGoDeeperBlocksZhCn,
  })
}
