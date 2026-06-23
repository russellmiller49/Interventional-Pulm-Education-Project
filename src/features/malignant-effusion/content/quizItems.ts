import { pickLocaleContent } from '@/i18n/content'
import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Malignant Pleural Effusion module, aligned to the
 * Learn objectives (cytology escalation, expandability-driven choice, talc,
 * IPC, combined strategies, patient goals). Commit-first.
 */
export const mpeQuizQuestions: QuizQuestion[] = [
  {
    prompt: 'Pleural fluid cytology in suspected malignant effusion has a sensitivity of about:',
    options: ['95–99%', '40–60%', 'Under 10%', 'Exactly 75% in all tumors'],
    answerIndex: 1,
    explanation:
      'Cytology sensitivity is roughly 40–60%, so a negative result does not rule out malignancy. With high suspicion after one or two nondiagnostic taps, escalate to tissue diagnosis.',
  },
  {
    prompt:
      'After two nondiagnostic cytology samples in a patient who still looks like MPE, the best next step is:',
    options: [
      'Keep repeating thoracentesis for cytology',
      'Escalate to pleural biopsy or pleuroscopy for tissue',
      'Declare the effusion benign',
      'Start empiric chemotherapy without tissue',
    ],
    answerIndex: 1,
    explanation:
      'Repeated nondiagnostic cytology should not falsely reassure. Escalate to image-guided biopsy or pleuroscopy (≈80–90% yield) rather than cycling fluid-only tests.',
  },
  {
    prompt: 'Which single factor most determines whether pleurodesis can succeed?',
    options: [
      'The tumor histology',
      'Whether the lung re-expands and the pleura can appose',
      'The pleural fluid LDH',
      'The patient’s age',
    ],
    answerIndex: 1,
    explanation:
      'Pleurodesis requires apposition of the visceral and parietal pleura, so lung expandability after drainage is the decisive factor — not tumor type.',
  },
  {
    prompt:
      'A patient with recurrent MPE has a trapped (non-expandable) lung after drainage. The most appropriate definitive option is:',
    options: [
      'Talc pleurodesis',
      'An indwelling pleural catheter (IPC) for symptom control',
      'Repeated weekly thoracentesis indefinitely',
      'Observation only',
    ],
    answerIndex: 1,
    explanation:
      'Pleurodesis fails without lung apposition, so a trapped lung favors an IPC, which controls breathlessness regardless of expandability.',
  },
  {
    prompt:
      'Compared with talc poudrage at thoracoscopy, talc slurry via a chest tube (TAPPS) achieves:',
    options: [
      'Markedly worse pleurodesis',
      'Similar pleurodesis success',
      'No pleurodesis at all',
      'Pleurodesis only in mesothelioma',
    ],
    answerIndex: 1,
    explanation:
      'TAPPS showed similar pleurodesis success for slurry and poudrage, so the route can follow logistics and whether thoracoscopy is already being done.',
  },
  {
    prompt:
      'Adding talc through an indwelling pleural catheter (the IPC-Plus approach) is intended to:',
    options: [
      'Reduce the chance of pleurodesis',
      'Increase successful pleurodesis while keeping outpatient management',
      'Replace the need for any drainage',
      'Treat catheter infection',
    ],
    answerIndex: 1,
    explanation:
      'IPC-Plus combines IPC with talc to increase the rate of pleurodesis while preserving outpatient, catheter-centered care — useful when goals favor both.',
  },
  {
    prompt: 'Pleural infection associated with an IPC is:',
    options: [
      'Almost always fatal',
      'Common (about 50%) and always requires removal',
      'Uncommon (about 5–6%) and often managed with antibiotics without removing the catheter',
      'Impossible because the catheter is tunneled',
    ],
    answerIndex: 2,
    explanation:
      'IPC-related pleural infection occurs in roughly 5–6% and can frequently be managed with antibiotics while leaving the catheter in place.',
  },
  {
    prompt: 'The overall goal of malignant pleural effusion management is best described as:',
    options: [
      'Achieving a radiographically empty pleural space at any cost',
      'Controlling symptoms (usually breathlessness) in line with patient goals',
      'Maximizing the number of thoracenteses',
      'Always achieving device-free pleurodesis',
    ],
    answerIndex: 1,
    explanation:
      'The endpoint is symptom control matched to what the patient values (hospital-free days, a device-free chest, speed of relief), not an empty space or endless taps.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. answerIndex values mirror the
// English source so scoring stays correct; only learner-facing text differs.
// ─────────────────────────────────────────────────────────────────────────────

const mpeQuizQuestionsEs: QuizQuestion[] = [
  {
    prompt:
      'La citología del líquido pleural en el derrame maligno sospechado tiene una sensibilidad de aproximadamente:',
    options: ['95–99 %', '40–60 %', 'Menos del 10 %', 'Exactamente 75 % en todos los tumores'],
    answerIndex: 1,
    explanation:
      'La sensibilidad de la citología es de aproximadamente 40–60 %, por lo que un resultado negativo no descarta la malignidad. Con alta sospecha tras una o dos toracocentesis no diagnósticas, escala al diagnóstico de tejido.',
  },
  {
    prompt:
      'Tras dos muestras de citología no diagnósticas en un paciente que sigue pareciendo un derrame pleural maligno, el mejor paso siguiente es:',
    options: [
      'Seguir repitiendo la toracocentesis para citología',
      'Escalar a biopsia pleural o pleuroscopia para obtener tejido',
      'Declarar benigno el derrame',
      'Iniciar quimioterapia empírica sin tejido',
    ],
    answerIndex: 1,
    explanation:
      'Una citología no diagnóstica repetida no debe tranquilizar falsamente. Escala a biopsia guiada por imagen o pleuroscopia (≈80–90 % de rendimiento) en lugar de repetir pruebas solo del líquido.',
  },
  {
    prompt: '¿Qué factor único determina más si la pleurodesis puede tener éxito?',
    options: [
      'La histología del tumor',
      'Si el pulmón se reexpande y la pleura puede aponerse',
      'La LDH del líquido pleural',
      'La edad del paciente',
    ],
    answerIndex: 1,
    explanation:
      'La pleurodesis requiere la aposición de las pleuras visceral y parietal, por lo que la expansibilidad pulmonar tras el drenaje es el factor decisivo — no el tipo de tumor.',
  },
  {
    prompt:
      'Un paciente con derrame pleural maligno recurrente tiene un pulmón atrapado (no expansible) tras el drenaje. La opción definitiva más apropiada es:',
    options: [
      'Pleurodesis con talco',
      'Un catéter pleural permanente (IPC) para el control de síntomas',
      'Toracocentesis semanal repetida de forma indefinida',
      'Solo observación',
    ],
    answerIndex: 1,
    explanation:
      'La pleurodesis fracasa sin aposición pulmonar, por lo que un pulmón atrapado favorece un IPC, que controla la disnea independientemente de la expansibilidad.',
  },
  {
    prompt:
      'En comparación con el poudrage de talco en la toracoscopia, la papilla de talco a través de un tubo torácico (TAPPS) logra:',
    options: [
      'Una pleurodesis notablemente peor',
      'Un éxito de pleurodesis similar',
      'Ninguna pleurodesis en absoluto',
      'Pleurodesis solo en el mesotelioma',
    ],
    answerIndex: 1,
    explanation:
      'TAPPS mostró un éxito de pleurodesis similar para la papilla y el poudrage, por lo que la vía puede seguir la logística y si ya se está realizando una toracoscopia.',
  },
  {
    prompt:
      'Añadir talco a través de un catéter pleural permanente (el abordaje IPC-Plus) tiene la intención de:',
    options: [
      'Reducir la probabilidad de pleurodesis',
      'Aumentar la pleurodesis exitosa manteniendo el manejo ambulatorio',
      'Sustituir la necesidad de cualquier drenaje',
      'Tratar la infección del catéter',
    ],
    answerIndex: 1,
    explanation:
      'IPC-Plus combina el IPC con talco para aumentar la tasa de pleurodesis preservando la atención ambulatoria centrada en el catéter — útil cuando los objetivos favorecen ambos.',
  },
  {
    prompt: 'La infección pleural asociada a un IPC es:',
    options: [
      'Casi siempre mortal',
      'Frecuente (alrededor del 50 %) y siempre requiere retirada',
      'Poco frecuente (alrededor del 5–6 %) y a menudo manejada con antibióticos sin retirar el catéter',
      'Imposible porque el catéter está tunelizado',
    ],
    answerIndex: 2,
    explanation:
      'La infección pleural relacionada con el IPC ocurre en aproximadamente un 5–6 % y con frecuencia puede manejarse con antibióticos dejando el catéter en su sitio.',
  },
  {
    prompt: 'El objetivo general del manejo del derrame pleural maligno se describe mejor como:',
    options: [
      'Lograr un espacio pleural radiográficamente vacío a cualquier coste',
      'Controlar los síntomas (normalmente la disnea) en línea con los objetivos del paciente',
      'Maximizar el número de toracocentesis',
      'Lograr siempre una pleurodesis sin dispositivo',
    ],
    answerIndex: 1,
    explanation:
      'El punto final es el control de síntomas adecuado a lo que el paciente valora (días sin hospital, un tórax sin dispositivo, rapidez del alivio), no un espacio vacío ni toracocentesis interminables.',
  },
]

const mpeQuizQuestionsZhCn: QuizQuestion[] = [
  {
    prompt: '在疑似恶性积液中，胸水细胞学的敏感性约为：',
    options: ['95–99%', '40–60%', '低于 10%', '在所有肿瘤中恰好为 75%'],
    answerIndex: 1,
    explanation:
      '细胞学敏感性约为 40–60%，因此阴性结果不能排除恶性肿瘤。在一到两次非诊断性穿刺后仍高度怀疑时，应升级到组织诊断。',
  },
  {
    prompt: '在一名仍像 MPE 的患者中，经过两份非诊断性细胞学样本后，最佳的下一步是：',
    options: [
      '继续重复胸腔穿刺以获取细胞学',
      '升级到胸膜活检或胸膜腔镜以获取组织',
      '判定积液为良性',
      '在无组织的情况下开始经验性化疗',
    ],
    answerIndex: 1,
    explanation:
      '反复的非诊断性细胞学不应带来虚假的安心。应升级到影像引导活检或胸膜腔镜（≈80–90% 产出），而非反复只做胸水检查。',
  },
  {
    prompt: '哪一个单一因素最能决定胸膜固定术能否成功？',
    options: ['肿瘤组织学类型', '肺是否复张且胸膜能否贴合', '胸水 LDH', '患者年龄'],
    answerIndex: 1,
    explanation:
      '胸膜固定术需要脏层与壁层胸膜贴合，因此引流后的肺可复张性是决定性因素——而非肿瘤类型。',
  },
  {
    prompt: '一名复发性 MPE 患者在引流后出现被困（不可复张）肺。最恰当的明确选择是：',
    options: [
      '滑石粉胸膜固定术',
      '留置胸膜导管（IPC）以控制症状',
      '无限期地每周重复胸腔穿刺',
      '仅观察',
    ],
    answerIndex: 1,
    explanation:
      '没有肺贴合，胸膜固定术会失败，因此被困肺更倾向于 IPC，它无论可复张性如何都能控制呼吸困难。',
  },
  {
    prompt: '与胸腔镜下滑石粉喷洒相比，经胸管注入滑石粉混悬液（TAPPS）可取得：',
    options: [
      '明显更差的胸膜固定',
      '相似的胸膜固定成功率',
      '完全无胸膜固定',
      '仅在间皮瘤中可胸膜固定',
    ],
    answerIndex: 1,
    explanation:
      'TAPPS 显示混悬液与喷洒的胸膜固定成功率相似，因此入路可根据流程安排以及是否已在做胸腔镜来选择。',
  },
  {
    prompt: '经留置胸膜导管注入滑石粉（IPC-Plus 方法）的目的是：',
    options: [
      '降低胸膜固定的机会',
      '在保持门诊管理的同时提高胸膜固定成功率',
      '取代任何引流的需要',
      '治疗导管感染',
    ],
    answerIndex: 1,
    explanation:
      'IPC-Plus 将 IPC 与滑石粉结合，以在保留以导管为中心的门诊管理的同时提高胸膜固定率——当目标兼顾两者时很有用。',
  },
  {
    prompt: '与 IPC 相关的胸膜感染是：',
    options: [
      '几乎总是致命',
      '常见（约 50%）且总是需要拔除',
      '不常见（约 5–6%）且通常可用抗生素处理而无需拔除导管',
      '不可能发生，因为导管是隧道式的',
    ],
    answerIndex: 2,
    explanation: 'IPC 相关的胸膜感染发生率约为 5–6%，且常可在保留导管的情况下用抗生素处理。',
  },
  {
    prompt: '恶性胸腔积液管理的总体目标最恰当的描述是：',
    options: [
      '不惜一切代价使胸膜腔在影像上排空',
      '按患者目标控制症状（通常是呼吸困难）',
      '使胸腔穿刺次数最大化',
      '总是实现无装置的胸膜固定',
    ],
    answerIndex: 1,
    explanation:
      '终点是与患者所看重的相匹配的症状控制（无住院天数、无装置的胸部、缓解的速度），而非排空腔隙或无休止地穿刺。',
  },
]

export function getMpeQuizQuestions(locale: string): QuizQuestion[] {
  return pickLocaleContent(locale, {
    en: mpeQuizQuestions,
    es: mpeQuizQuestionsEs,
    'zh-CN': mpeQuizQuestionsZhCn,
  })
}
