import { pickLocaleContent } from '@/i18n/content'
import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Pleural Infection module, aligned to the Learn
 * objectives (staging, drainage thresholds, MIST2, surgery, irrigation, RAPID).
 * Commit-first: explanations appear only after answering.
 */
export const infectionQuizQuestions: QuizQuestion[] = [
  {
    prompt:
      'Which pleural-fluid value is the single strongest chemical indicator that a parapneumonic effusion needs drainage?',
    options: ['pH ≤ 7.2', 'Protein > 3 g/dL', 'Lymphocyte predominance', 'Amylase > 100 IU/L'],
    answerIndex: 0,
    explanation:
      'A pleural pH of 7.2 or lower is the strongest single chemical indicator for drainage. Low glucose (<60 mg/dL) and high LDH (>1000 IU/L) support it, but pH carries the most weight.',
  },
  {
    prompt: 'Frank pus is aspirated from the pleural space. The correct framing is:',
    options: [
      'Treat with antibiotics alone and recheck chemistry first',
      'It is an empyema — drain and pursue source control regardless of the pH',
      'Send pH; only drain if pH < 7.2',
      'Observe unless the patient is febrile',
    ],
    answerIndex: 1,
    explanation:
      'Frank pus (or a positive Gram stain/culture) defines empyema. It mandates drainage and source control; you do not need chemistry to make that call.',
  },
  {
    prompt: 'Based on MIST2, the intrapleural enzyme regimen that improves outcomes is:',
    options: ['DNase alone', 'tPA alone', 'Combination tPA + DNase', 'Streptokinase alone'],
    answerIndex: 2,
    explanation:
      'MIST2 showed combination tPA + DNase improved radiographic clearance and reduced surgical referral and length of stay. Single-agent tPA did not show the same benefit.',
  },
  {
    prompt: 'In MIST2, intrapleural DNase given alone was:',
    options: [
      'The most effective single agent',
      'Equivalent to combination therapy',
      'Not beneficial (and a recognized teaching trap)',
      'Contraindicated because of allergy risk',
    ],
    answerIndex: 2,
    explanation:
      'DNase monotherapy was not beneficial and may worsen drainage — a classic trap. The benefit comes from the tPA + DNase combination, not either agent alone.',
  },
  {
    prompt: 'When should empiric antibiotics for pleural infection cover anaerobes?',
    options: [
      'Never — pleural infection is always pneumococcal',
      'Routinely — anaerobic coverage is part of standard empiric therapy',
      'Only if the culture grows anaerobes',
      'Only in immunocompromised patients',
    ],
    answerIndex: 1,
    explanation:
      'Anaerobes are common in pleural infection, so empiric regimens should cover them, then be tailored to community- versus hospital-acquired risk, local resistance, and culture results.',
  },
  {
    prompt:
      'A patient with empyema has a working drain and has received tPA + DNase but continues to deteriorate with an organized collection. The next step is:',
    options: [
      'Stop antibiotics',
      'Surgical referral (e.g., VATS)',
      'Repeat the same lytic course indefinitely',
      'Remove the drain and observe',
    ],
    answerIndex: 1,
    explanation:
      'Failure to improve despite a working drain and enzyme therapy, or an organized empyema, is an indication for surgery. Surgical referral should be a planned escalation, made early in non-responders.',
  },
  {
    prompt: 'Normal saline pleural irrigation is best presented as:',
    options: [
      'The first-line therapy for all empyemas',
      'A selected alternative when lytic therapy is unsuitable or bleeding risk cannot be mitigated',
      'A replacement for antibiotics',
      'Equivalent to surgery in all patients',
    ],
    answerIndex: 1,
    explanation:
      'Saline irrigation is supported by pilot data as a selected alternative — useful when lytics are unsuitable or bleeding risk is prohibitive — not a universal replacement for drainage, combination therapy, or surgery.',
  },
  {
    prompt: 'The RAPID score in pleural infection is used to:',
    options: [
      'Decide the antibiotic dose',
      'Risk-stratify mortality to guide monitoring and escalation discussions',
      'Set the exact chest-tube size',
      'Diagnose the causative organism',
    ],
    answerIndex: 1,
    explanation:
      'RAPID (Renal/urea, Age, Purulence, Infection source, Dietary/albumin) risk-stratifies mortality. It informs how closely to monitor and when to escalate — it does not itself dictate whether to drain.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. answerIndex values mirror the
// English source so scoring stays correct; only learner-facing text differs.
// ─────────────────────────────────────────────────────────────────────────────

const infectionQuizQuestionsEs: QuizQuestion[] = [
  {
    prompt:
      '¿Qué valor del líquido pleural es el indicador químico aislado más potente de que un derrame paraneumónico necesita drenaje?',
    options: ['pH ≤ 7,2', 'Proteínas > 3 g/dL', 'Predominio de linfocitos', 'Amilasa > 100 IU/L'],
    answerIndex: 0,
    explanation:
      'Un pH pleural de 7,2 o menor es el indicador químico aislado más potente para el drenaje. La glucosa baja (<60 mg/dL) y la LDH alta (>1000 IU/L) lo apoyan, pero el pH tiene el mayor peso.',
  },
  {
    prompt: 'Se aspira pus franco del espacio pleural. El enfoque correcto es:',
    options: [
      'Tratar solo con antibióticos y volver a comprobar la química primero',
      'Es un empiema — drena y busca el control del foco con independencia del pH',
      'Enviar el pH; drenar solo si el pH < 7,2',
      'Observar a menos que el paciente esté febril',
    ],
    answerIndex: 1,
    explanation:
      'El pus franco (o una tinción de Gram/cultivo positivo) define el empiema. Obliga al drenaje y al control del foco; no necesitas la química para tomar esa decisión.',
  },
  {
    prompt: 'Según MIST2, el régimen enzimático intrapleural que mejora los resultados es:',
    options: ['DNasa sola', 'tPA solo', 'Combinación tPA + DNasa', 'Estreptocinasa sola'],
    answerIndex: 2,
    explanation:
      'MIST2 mostró que la combinación tPA + DNasa mejoró el aclaramiento radiográfico y redujo la derivación quirúrgica y la estancia hospitalaria. El tPA en monoterapia no mostró el mismo beneficio.',
  },
  {
    prompt: 'En MIST2, la DNasa intrapleural administrada sola fue:',
    options: [
      'El agente único más eficaz',
      'Equivalente a la terapia combinada',
      'No beneficiosa (y una trampa didáctica reconocida)',
      'Contraindicada por riesgo de alergia',
    ],
    answerIndex: 2,
    explanation:
      'La DNasa en monoterapia no fue beneficiosa y puede empeorar el drenaje — una trampa clásica. El beneficio proviene de la combinación tPA + DNasa, no de cualquiera de los agentes por separado.',
  },
  {
    prompt: '¿Cuándo deben los antibióticos empíricos para la infección pleural cubrir anaerobios?',
    options: [
      'Nunca — la infección pleural siempre es neumocócica',
      'De forma rutinaria — la cobertura anaeróbica forma parte de la terapia empírica estándar',
      'Solo si el cultivo desarrolla anaerobios',
      'Solo en pacientes inmunodeprimidos',
    ],
    answerIndex: 1,
    explanation:
      'Los anaerobios son frecuentes en la infección pleural, por lo que los regímenes empíricos deben cubrirlos y luego adaptarse al riesgo comunitario frente al hospitalario, la resistencia local y los resultados del cultivo.',
  },
  {
    prompt:
      'Un paciente con empiema tiene un drenaje funcionante y ha recibido tPA + DNasa, pero sigue deteriorándose con una colección organizada. El siguiente paso es:',
    options: [
      'Suspender los antibióticos',
      'Derivación quirúrgica (p. ej., VATS)',
      'Repetir el mismo curso lítico de forma indefinida',
      'Retirar el drenaje y observar',
    ],
    answerIndex: 1,
    explanation:
      'No mejorar a pesar de un drenaje funcionante y terapia enzimática, o un empiema organizado, es indicación de cirugía. La derivación quirúrgica debe ser una escalada planificada, hecha de forma temprana en los no respondedores.',
  },
  {
    prompt: 'La irrigación pleural con suero salino normal se presenta mejor como:',
    options: [
      'La terapia de primera línea para todos los empiemas',
      'Una alternativa seleccionada cuando la terapia lítica no es adecuada o el riesgo de sangrado no puede mitigarse',
      'Un reemplazo de los antibióticos',
      'Equivalente a la cirugía en todos los pacientes',
    ],
    answerIndex: 1,
    explanation:
      'La irrigación con suero salino está respaldada por datos piloto como una alternativa seleccionada — útil cuando los líticos no son adecuados o el riesgo de sangrado es prohibitivo — no un reemplazo universal del drenaje, la terapia combinada o la cirugía.',
  },
  {
    prompt: 'La puntuación RAPID en la infección pleural se utiliza para:',
    options: [
      'Decidir la dosis de antibiótico',
      'Estratificar el riesgo de mortalidad para guiar la monitorización y las conversaciones de escalada',
      'Fijar el calibre exacto del tubo torácico',
      'Diagnosticar el microorganismo causal',
    ],
    answerIndex: 1,
    explanation:
      'RAPID (Renal/urea, Age/edad, Purulence/purulencia, Infection source/origen, Dietary/albúmina) estratifica el riesgo de mortalidad. Informa con qué frecuencia monitorizar y cuándo escalar — no dicta por sí solo si drenar.',
  },
]

const infectionQuizQuestionsZhCn: QuizQuestion[] = [
  {
    prompt: '哪个胸液数值是提示肺炎旁积液需要引流的最强单项化学指标？',
    options: ['pH ≤ 7.2', '蛋白 > 3 g/dL', '淋巴细胞为主', '淀粉酶 > 100 IU/L'],
    answerIndex: 0,
    explanation:
      '胸膜 pH 为 7.2 或更低是支持引流的最强单项化学指标。低葡萄糖（<60 mg/dL）和高 LDH（>1000 IU/L）可作支持，但 pH 权重最大。',
  },
  {
    prompt: '从胸膜腔抽出明显脓液。正确的判断是：',
    options: [
      '仅用抗生素治疗，并先复查化验',
      '这是脓胸——无论 pH 如何都应引流并寻求感染源控制',
      '送检 pH；仅当 pH < 7.2 时引流',
      '除非患者发热，否则观察',
    ],
    answerIndex: 1,
    explanation:
      '明显脓液（或革兰染色/培养阳性）即可诊断脓胸。它要求引流和感染源控制；做出该决定无需化验。',
  },
  {
    prompt: '根据 MIST2，能改善结局的胸膜腔内酶疗法方案是：',
    options: ['单用 DNase', '单用 tPA', 'tPA + DNase 联合', '单用链激酶'],
    answerIndex: 2,
    explanation:
      'MIST2 显示 tPA + DNase 联合改善了影像学清除并减少了外科转诊和住院时间。单用 tPA 未显示同样的获益。',
  },
  {
    prompt: '在 MIST2 中，单独给予胸膜腔内 DNase：',
    options: [
      '是最有效的单一药物',
      '与联合治疗等效',
      '无获益（且是公认的教学陷阱）',
      '因过敏风险而禁用',
    ],
    answerIndex: 2,
    explanation:
      '单用 DNase 无获益且可能使引流变差——一个经典陷阱。获益来自 tPA + DNase 联合，而非任一单药。',
  },
  {
    prompt: '胸膜感染的经验性抗生素何时应覆盖厌氧菌？',
    options: [
      '从不——胸膜感染总是肺炎球菌所致',
      '常规——厌氧菌覆盖是标准经验性治疗的一部分',
      '仅当培养出厌氧菌时',
      '仅在免疫功能低下的患者中',
    ],
    answerIndex: 1,
    explanation:
      '厌氧菌在胸膜感染中常见，故经验性方案应覆盖之，随后再根据社区获得性与医院获得性风险、当地耐药情况和培养结果进行调整。',
  },
  {
    prompt: '一名脓胸患者引流通畅并已接受 tPA + DNase，但仍持续恶化且积液机化。下一步是：',
    options: ['停用抗生素', '外科转诊（如 VATS）', '无限期重复同一溶栓疗程', '拔除引流并观察'],
    answerIndex: 1,
    explanation:
      '在引流通畅且已行酶疗法后仍不改善，或脓胸已机化，是外科手术的指征。外科转诊应是有计划的升级，并对无应答者尽早进行。',
  },
  {
    prompt: '生理盐水胸膜冲洗最恰当的定位是：',
    options: [
      '所有脓胸的一线治疗',
      '当溶栓治疗不适合或出血风险无法缓解时的一种经选择的替代方案',
      '抗生素的替代品',
      '在所有患者中与外科手术等效',
    ],
    answerIndex: 1,
    explanation:
      '生理盐水冲洗有初步数据支持，作为一种经选择的替代方案——在溶栓药不适合或出血风险过高时有用——而非引流、联合治疗或外科手术的普遍替代。',
  },
  {
    prompt: '胸膜感染中的 RAPID 评分用于：',
    options: [
      '决定抗生素剂量',
      '对死亡风险进行分层，以指导监测和升级讨论',
      '确定胸管的确切口径',
      '诊断致病微生物',
    ],
    answerIndex: 1,
    explanation:
      'RAPID（Renal/尿素、Age/年龄、Purulence/脓性、Infection source/感染来源、Dietary/白蛋白）对死亡风险进行分层。它指导监测的密切程度和升级时机——其本身并不决定是否引流。',
  },
]

export function getInfectionQuizQuestions(locale: string): QuizQuestion[] {
  return pickLocaleContent(locale, {
    en: infectionQuizQuestions,
    es: infectionQuizQuestionsEs,
    'zh-CN': infectionQuizQuestionsZhCn,
  })
}
