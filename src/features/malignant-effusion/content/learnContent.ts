import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Malignant Pleural Effusion "Learn" section — taught
 * before the interactive pathway (Practice). Aligns with the engine: cytology
 * sensitivity ~40–60%, escalate after nondiagnostic taps, and lung expansion
 * drives the IPC-vs-pleurodesis branch. Board sections come from the dedicated
 * Indwelling Pleural Catheters and Pleurodesis chapter; a unit test guards them.
 */

export const mpeBoardSlug = 'indwelling-pleural-catheters'

export const mpeBoardSectionIds = [
  'algorithm-a-recurrent-effusion-suspected-mpe',
  'table-1-choosing-ipc-vs-pleurodesis-in-mpe',
  'table-3-talc-pleurodesis-technique-tips',
  'algorithm-b-suspected-ipc-infection-management',
  'table-2-ipc-infection-at-a-glance-management',
  'evidence-outcomes-select-trials-and-themes',
] as const

export const mpeObjectives = [
  'Explain why negative cytology does not rule out malignant pleural effusion, and when to escalate to tissue diagnosis.',
  'Use lung expandability after drainage to choose between pleurodesis and an indwelling pleural catheter (IPC).',
  'Match pleurodesis, IPC, and combined strategies to patient goals, and counsel a patient on IPC care.',
] as const

export const mpeCoreBlocks: LearnBlock[] = [
  {
    id: 'negative-cytology',
    title: 'A negative tap is not a rule-out',
    paragraphs: [
      'Pleural fluid cytology diagnoses many malignant effusions, but its sensitivity is only about 40–60%. A negative result in a patient whose history, imaging, or recurrence keeps malignancy likely is not reassuring — it is a prompt to plan tissue.',
    ],
    bullets: [
      'After one or two nondiagnostic cytology samples with high suspicion, stop cycling fluid-only tests.',
      'Escalate to image-guided pleural biopsy or pleuroscopy, which give higher tissue yield (≈80–90%) and allow same-session poudrage.',
      'Adequate volume and a second sample can help early, but the tissue plan should already be visible when pretest probability is high.',
    ],
  },
  {
    id: 'expandability-decides',
    title: 'Lung expandability decides the path',
    paragraphs: [
      'After a therapeutic drainage, the single most useful question is: did the lung re-expand? Pleurodesis only works when the visceral and parietal pleura can appose, so expandability — not tumor type — drives the definitive-management branch.',
    ],
    bullets: [
      'Full re-expansion → a pleurodesis candidate (talc pleurodesis, IPC, or a combined strategy, by goals and fitness).',
      'Partial re-expansion → favor IPC-centered care or a selected combined/rapid pleurodesis strategy rather than assuming talc alone will work.',
      'Trapped / non-expandable lung → pleurodesis is unlikely to succeed; IPC-centered symptom control is the core pathway.',
    ],
  },
  {
    id: 'talc-pleurodesis',
    title: 'Talc pleurodesis',
    bullets: [
      'Aim: create pleural symphysis so fluid cannot re-accumulate — it needs an expandable lung that apposes the chest wall.',
      'Talc slurry through a chest tube has pleurodesis success similar to talc poudrage at thoracoscopy (TAPPS), so the route can follow logistics and whether you are already scoping.',
      'It is an inpatient, device-free endpoint when it works — attractive for patients who want nothing left on the body.',
    ],
  },
  {
    id: 'ipc',
    title: 'Indwelling pleural catheter (IPC)',
    bullets: [
      'Outpatient, tunneled catheter for home drainage — it controls breathlessness regardless of whether the lung expands, which is why it is the answer for trapped lung.',
      'About half of patients achieve spontaneous (auto-)pleurodesis over weeks and can have the catheter removed; more aggressive drainage schedules speed this up (ASAP).',
      'Counsel on home drainage support, dressing care, and infection recognition before placement.',
    ],
  },
  {
    id: 'ipc-vs-pleurodesis',
    title: 'IPC vs. pleurodesis — and combining them',
    bullets: [
      'IPC: fewer initial hospital days and works with non-expandable lung, but means a device on the body, a drainage routine, and a small infection risk.',
      'Pleurodesis: a device-free chest, but needs an admission and an expandable lung.',
      'Combined IPC + talc (IPC-Plus) increases the chance of pleurodesis while preserving outpatient management — a good option when goals favor both.',
      'There is no universal best choice; the trade-offs are matched to the individual patient.',
    ],
  },
  {
    id: 'patient-goals',
    title: 'Anchor on patient goals',
    paragraphs: [
      'The endpoint of malignant-effusion management is symptom control — usually breathlessness — not an empty pleural space and not endless taps.',
    ],
    bullets: [
      'Ask what matters most: hospital-free days, a device-free chest, speed of relief, home support, expected prognosis, infection burden, and willingness to manage a catheter.',
      'Do not keep tapping a recurrent malignant effusion — commit to a definitive strategy once recurrence is established.',
    ],
  },
]

export const mpeGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'ipc-complications',
    title: 'IPC complications',
    level: 'advanced',
    bullets: [
      'Pleural infection occurs in roughly 5–6% and is often managed with antibiotics without removing the catheter.',
      'Other issues: cellulitis at the site, catheter blockage, symptomatic loculation, and catheter-tract metastasis (notably in mesothelioma).',
    ],
  },
  {
    id: 'the-trials',
    title: 'The trials behind the pathway',
    level: 'advanced',
    bullets: [
      'TIME2 and AMPLE: IPC gives breathlessness control similar to talc with fewer initial hospital days.',
      'IPC-Plus: adding talc through an IPC increases successful pleurodesis versus IPC alone.',
      'ASAP: more aggressive (daily) drainage shortens time to auto-pleurodesis.',
      'TAPPS: talc poudrage and talc slurry achieve similar pleurodesis rates.',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Block ids mirror the English
// source above so module progress and board-section anchors stay aligned; only
// the learner-facing prose differs. See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const mpeObjectivesEs: readonly string[] = [
  'Explicar por qué una citología negativa no descarta el derrame pleural maligno, y cuándo escalar al diagnóstico de tejido.',
  'Usar la expansibilidad pulmonar tras el drenaje para elegir entre pleurodesis y un catéter pleural permanente (IPC).',
  'Adecuar la pleurodesis, el IPC y las estrategias combinadas a los objetivos del paciente, y aconsejar al paciente sobre el cuidado del IPC.',
]

const mpeCoreBlocksEs: LearnBlock[] = [
  {
    id: 'negative-cytology',
    title: 'Una toracocentesis negativa no es un descarte',
    paragraphs: [
      'La citología del líquido pleural diagnostica muchos derrames malignos, pero su sensibilidad es solo de un 40–60 % aproximadamente. Un resultado negativo en un paciente cuya historia, imagen o recurrencia mantienen probable la malignidad no es tranquilizador — es una señal para planificar el tejido.',
    ],
    bullets: [
      'Tras una o dos muestras de citología no diagnósticas con alta sospecha, deja de repetir pruebas solo del líquido.',
      'Escala a biopsia pleural guiada por imagen o pleuroscopia, que dan mayor rendimiento de tejido (≈80–90 %) y permiten poudrage en la misma sesión.',
      'Un volumen adecuado y una segunda muestra pueden ayudar de forma temprana, pero el plan de tejido ya debería verse cuando la probabilidad pretest es alta.',
    ],
  },
  {
    id: 'expandability-decides',
    title: 'La expansibilidad pulmonar decide el camino',
    paragraphs: [
      'Tras un drenaje terapéutico, la pregunta más útil es: ¿se reexpandió el pulmón? La pleurodesis solo funciona cuando las pleuras visceral y parietal pueden aponerse, así que la expansibilidad — no el tipo de tumor — guía el brazo del manejo definitivo.',
    ],
    bullets: [
      'Reexpansión completa → candidato a pleurodesis (pleurodesis con talco, IPC o una estrategia combinada, según objetivos y aptitud).',
      'Reexpansión parcial → favorece la atención centrada en el IPC o una estrategia seleccionada combinada/de pleurodesis rápida, en lugar de asumir que el talco por sí solo funcionará.',
      'Pulmón atrapado / no expansible → es improbable que la pleurodesis tenga éxito; el control de síntomas centrado en el IPC es la vía principal.',
    ],
  },
  {
    id: 'talc-pleurodesis',
    title: 'Pleurodesis con talco',
    bullets: [
      'Objetivo: crear sínfisis pleural para que el líquido no pueda reacumularse — necesita un pulmón expansible que se aponga a la pared torácica.',
      'La papilla (slurry) de talco a través de un tubo torácico tiene un éxito de pleurodesis similar al poudrage de talco en la toracoscopia (TAPPS), por lo que la vía puede seguir la logística y si ya estás haciendo una endoscopia.',
      'Es un punto final hospitalario y sin dispositivo cuando funciona — atractivo para pacientes que no quieren nada dejado en el cuerpo.',
    ],
  },
  {
    id: 'ipc',
    title: 'Catéter pleural permanente (IPC)',
    bullets: [
      'Catéter tunelizado ambulatorio para el drenaje en casa — controla la disnea independientemente de si el pulmón se expande, por eso es la respuesta para el pulmón atrapado.',
      'Alrededor de la mitad de los pacientes logran una (auto)pleurodesis espontánea en semanas y pueden retirar el catéter; los esquemas de drenaje más agresivos lo aceleran (ASAP).',
      'Aconseja sobre el apoyo para el drenaje domiciliario, el cuidado del apósito y el reconocimiento de la infección antes de la colocación.',
    ],
  },
  {
    id: 'ipc-vs-pleurodesis',
    title: 'IPC frente a pleurodesis — y combinarlos',
    bullets: [
      'IPC: menos días iniciales de hospital y funciona con pulmón no expansible, pero implica un dispositivo en el cuerpo, una rutina de drenaje y un pequeño riesgo de infección.',
      'Pleurodesis: un tórax sin dispositivo, pero necesita un ingreso y un pulmón expansible.',
      'IPC + talco combinados (IPC-Plus) aumentan la probabilidad de pleurodesis preservando el manejo ambulatorio — una buena opción cuando los objetivos favorecen ambos.',
      'No hay una mejor opción universal; las ventajas y desventajas se adecuan al paciente individual.',
    ],
  },
  {
    id: 'patient-goals',
    title: 'Ancla en los objetivos del paciente',
    paragraphs: [
      'El punto final del manejo del derrame maligno es el control de síntomas — normalmente la disnea — no un espacio pleural vacío ni toracocentesis interminables.',
    ],
    bullets: [
      'Pregunta qué importa más: días sin hospital, un tórax sin dispositivo, rapidez del alivio, apoyo domiciliario, pronóstico esperado, carga de infección y disposición a manejar un catéter.',
      'No sigas puncionando un derrame maligno recurrente — comprométete con una estrategia definitiva una vez establecida la recurrencia.',
    ],
  },
]

const mpeGoDeeperBlocksEs: LearnBlock[] = [
  {
    id: 'ipc-complications',
    title: 'Complicaciones del IPC',
    level: 'advanced',
    bullets: [
      'La infección pleural ocurre en aproximadamente un 5–6 % y a menudo se maneja con antibióticos sin retirar el catéter.',
      'Otros problemas: celulitis en el sitio, obstrucción del catéter, loculación sintomática y metástasis del trayecto del catéter (notablemente en el mesotelioma).',
    ],
  },
  {
    id: 'the-trials',
    title: 'Los ensayos detrás de la vía',
    level: 'advanced',
    bullets: [
      'TIME2 y AMPLE: el IPC ofrece un control de la disnea similar al talco con menos días iniciales de hospital.',
      'IPC-Plus: añadir talco a través de un IPC aumenta la pleurodesis exitosa frente al IPC solo.',
      'ASAP: un drenaje más agresivo (diario) acorta el tiempo hasta la autopleurodesis.',
      'TAPPS: el poudrage de talco y la papilla de talco logran tasas de pleurodesis similares.',
    ],
  },
]

const mpeObjectivesZhCn: readonly string[] = [
  '解释为什么阴性细胞学不能排除恶性胸腔积液，以及何时升级到组织诊断。',
  '利用引流后的肺可复张性，在胸膜固定术与留置胸膜导管（IPC）之间做出选择。',
  '将胸膜固定术、IPC 和联合策略与患者目标相匹配，并就 IPC 护理为患者提供指导。',
]

const mpeCoreBlocksZhCn: LearnBlock[] = [
  {
    id: 'negative-cytology',
    title: '一次阴性穿刺并非排除',
    paragraphs: [
      '胸水细胞学可诊断许多恶性积液，但其敏感性仅约 40–60%。对于病史、影像或复发仍使恶性肿瘤可能的患者，阴性结果并不令人安心——它是规划获取组织的提示。',
    ],
    bullets: [
      '在高度怀疑下，经过一到两份非诊断性细胞学样本后，停止反复只做胸水检查。',
      '升级到影像引导胸膜活检或胸膜腔镜，二者组织产出更高（≈80–90%），并可在同一次操作中进行 poudrage。',
      '足量取样和第二份样本在早期可能有帮助，但当验前概率较高时，组织方案此时就应已显现。',
    ],
  },
  {
    id: 'expandability-decides',
    title: '肺可复张性决定路径',
    paragraphs: [
      '在一次治疗性引流之后，最有用的问题是：肺复张了吗？胸膜固定术只有在脏层与壁层胸膜能够贴合时才有效，因此可复张性——而非肿瘤类型——决定了明确管理的分支。',
    ],
    bullets: [
      '完全复张 → 胸膜固定术候选（根据目标和耐受性，可选滑石粉胸膜固定术、IPC 或联合策略）。',
      '部分复张 → 更倾向于以 IPC 为中心的管理或选定的联合/快速胸膜固定策略，而非假定单用滑石粉即可见效。',
      '被困/不可复张的肺 → 胸膜固定术难以成功；以 IPC 为中心的症状控制是核心路径。',
    ],
  },
  {
    id: 'talc-pleurodesis',
    title: '滑石粉胸膜固定术',
    bullets: [
      '目标：形成胸膜粘连，使液体无法再积聚——这需要一个能贴合胸壁的可复张肺。',
      '经胸管注入滑石粉混悬液（slurry）的胸膜固定成功率与胸腔镜下滑石粉喷洒（poudrage）相似（TAPPS），因此入路可根据流程安排以及你是否已在做内镜来选择。',
      '当其见效时，它是一个住院期间、不留装置的终点——对不希望体内留下任何东西的患者很有吸引力。',
    ],
  },
  {
    id: 'ipc',
    title: '留置胸膜导管（IPC）',
    bullets: [
      '门诊、隧道式导管用于家庭引流——无论肺是否复张都能控制呼吸困难，这正是它成为被困肺答案的原因。',
      '约一半患者在数周内实现自发（自体）胸膜固定并可拔除导管；更积极的引流方案能加快此过程（ASAP）。',
      '在置管前，就家庭引流支持、敷料护理和感染识别为患者提供指导。',
    ],
  },
  {
    id: 'ipc-vs-pleurodesis',
    title: 'IPC 与胸膜固定术——以及二者联合',
    bullets: [
      'IPC：初始住院天数更少，且适用于不可复张的肺，但意味着体内有装置、需要引流常规以及较小的感染风险。',
      '胸膜固定术：胸部无装置，但需要住院和可复张的肺。',
      'IPC + 滑石粉联合（IPC-Plus）可在保留门诊管理的同时提高胸膜固定的机会——当目标兼顾两者时是一个不错的选择。',
      '没有放之四海而皆准的最佳选择；各种取舍应与每位患者相匹配。',
    ],
  },
  {
    id: 'patient-goals',
    title: '锚定患者目标',
    paragraphs: [
      '恶性积液管理的终点是症状控制——通常是呼吸困难——而不是排空胸膜腔，也不是无休止的穿刺。',
    ],
    bullets: [
      '询问什么最重要：无住院天数、无装置的胸部、缓解的速度、家庭支持、预期预后、感染负担以及管理导管的意愿。',
      '不要对复发性恶性积液持续穿刺——一旦确立复发，就应确定一个明确的策略。',
    ],
  },
]

const mpeGoDeeperBlocksZhCn: LearnBlock[] = [
  {
    id: 'ipc-complications',
    title: 'IPC 并发症',
    level: 'advanced',
    bullets: [
      '胸膜感染发生率约为 5–6%，通常可用抗生素处理而无需拔除导管。',
      '其他问题：置管部位蜂窝织炎、导管堵塞、有症状的分隔，以及导管通道转移（尤其是间皮瘤）。',
    ],
  },
  {
    id: 'the-trials',
    title: '路径背后的试验',
    level: 'advanced',
    bullets: [
      'TIME2 和 AMPLE：IPC 对呼吸困难的控制与滑石粉相似，但初始住院天数更少。',
      'IPC-Plus：经 IPC 注入滑石粉可比单用 IPC 提高胸膜固定成功率。',
      'ASAP：更积极（每日）的引流可缩短至自体胸膜固定的时间。',
      'TAPPS：滑石粉喷洒与滑石粉混悬液取得相似的胸膜固定率。',
    ],
  },
]

export function getMpeObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, {
    en: mpeObjectives as readonly string[],
    es: mpeObjectivesEs,
    'zh-CN': mpeObjectivesZhCn,
  })
}

export function getMpeCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: mpeCoreBlocks,
    es: mpeCoreBlocksEs,
    'zh-CN': mpeCoreBlocksZhCn,
  })
}

export function getMpeGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: mpeGoDeeperBlocks,
    es: mpeGoDeeperBlocksEs,
    'zh-CN': mpeGoDeeperBlocksZhCn,
  })
}
