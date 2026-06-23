import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Pleural Infection "Learn" section — taught before the
 * interactive staging workflow (Practice). Thresholds match the staging engine
 * (pH ≤7.2, glucose <60, LDH >1000; pus or positive Gram/culture = empyema).
 * Board sections come from the dedicated `pleural-infections` chapter; a unit
 * test guards that the ids still resolve.
 */

export const infectionBoardSlug = 'pleural-infections'

export const infectionBoardSectionIds = [
  'algorithm-1-initial-evaluation-and-drainage-decision',
  'algorithm-2-escalation-after-tube-placement',
  'table-1-spectrum-of-pleural-infection-defining-features',
  'table-2-empiric-antibiotic-approach',
  'table-3-intrapleural-enzyme-therapy-iet-at-a-glance',
  'table-4-rapid-score-predicts-90-day-mortality',
] as const

export const infectionObjectives = [
  'Stage a parapneumonic effusion (uncomplicated / complicated / empyema) from pH, glucose, LDH, Gram stain or culture, pus, and ultrasound complexity.',
  'Choose antibiotics plus drainage, and know where tPA + DNase, surgery, and the irrigation fallback fit.',
  'Reassess at a checkpoint and escalate, rather than placing a drain and waiting.',
] as const

export const infectionCoreBlocks: LearnBlock[] = [
  {
    id: 'spectrum',
    title: 'The spectrum: simple → complicated → empyema',
    paragraphs: [
      'Pleural infection is a continuum, not three separate diseases. A simple parapneumonic effusion is sterile exudate that resolves with antibiotics; a complicated parapneumonic effusion has crossed into the pleural space enough to need drainage; an empyema is frank pus. The job at the bedside is to place a patient on that continuum quickly, because the further along they are, the more source control matters.',
    ],
    bullets: [
      'Uncomplicated: free-flowing, normal-ish chemistry — antibiotics and close reassessment may suffice.',
      'Complicated: drainage-level chemistry or complex/septated/large fluid — antibiotics plus a drain.',
      'Empyema: frank pus or positive Gram stain/culture — drain and pursue source control early.',
    ],
  },
  {
    id: 'fluid-that-demands-drainage',
    title: 'The fluid that demands drainage',
    paragraphs: [
      'Sample the fluid early and send it to a blood-gas analyzer for pH. The chemistry sorts complicated from uncomplicated; pus or a positive Gram stain settles it without any chemistry at all.',
    ],
    bullets: [
      'Pleural pH ≤ 7.2 is the single strongest chemical indicator for drainage.',
      'Pleural glucose < 60 mg/dL and LDH > 1000 IU/L also point toward a complicated effusion.',
      'Frank pus, or a positive Gram stain or culture, is an empyema — drain regardless of the chemistry.',
      'Complex, septated, or large collections on ultrasound raise the drainage threshold concern even when numbers are borderline.',
    ],
  },
  {
    id: 'antibiotics-and-drainage',
    title: 'Antibiotics plus early drainage',
    bullets: [
      'Start empiric antibiotics promptly and cover anaerobes; tailor to community- versus hospital-acquired risk and local resistance.',
      'For complicated effusions and empyema, place a small-bore image-guided drain — it is better tolerated and usually sufficient.',
      'Antibiotic duration is tailored to source control and response: roughly up to 2 weeks for uncomplicated, longer (often 2–6 weeks) for complicated effusion and empyema.',
      'Send pleural fluid for culture before or with the first antibiotic dose whenever possible.',
    ],
  },
  {
    id: 'tpa-dnase-mist2',
    title: 'When drainage stalls: tPA + DNase (MIST2)',
    paragraphs: [
      'When a drain is in but the collection is not clearing, intrapleural enzyme therapy can break down fibrin and thin pus. The evidence is specific about the combination.',
    ],
    bullets: [
      'Combination tissue plasminogen activator (tPA) + DNase improved radiographic clearance and reduced surgical referral and length of stay in MIST2.',
      'tPA alone did not show the same benefit, and DNase alone is a classic trap — it was not beneficial and may worsen drainage.',
      'Assess bleeding risk and medication timing before giving intrapleural lytics.',
    ],
  },
  {
    id: 'surgery-and-irrigation',
    title: 'Surgery and the irrigation fallback',
    bullets: [
      'Refer for surgery (VATS, sometimes decortication) when the patient fails to improve despite a working drain and enzyme therapy, or when the empyema is organized.',
      'Normal saline pleural irrigation is a selected alternative to discuss when lytic therapy is unsuitable or bleeding risk cannot be mitigated — supported by pilot data, not a universal replacement.',
      'Surgery is a planned escalation, not a rescue of last resort — involve thoracic surgery early in non-responders.',
    ],
  },
  {
    id: 'reassess',
    title: 'Reassess — do not set and forget',
    bullets: [
      'Set a checkpoint (around 48–72 hours): are fever, inflammatory markers, drain output, and imaging all moving the right way?',
      'If progress stalls, walk the escalation chain: confirm the drain works → flush/reimage → intrapleural tPA + DNase → irrigation when suitable → surgical review.',
      'A blocked or malpositioned drain is a common, fixable reason for apparent treatment failure — check it before escalating therapy.',
    ],
  },
]

export const infectionGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'rapid-score',
    title: 'The RAPID score',
    level: 'advanced',
    bullets: [
      'RAPID risk-stratifies pleural infection mortality from five factors: Renal (urea), Age, Purulence of the fluid, Infection source (hospital-acquired is worse), and Dietary status (low albumin).',
      'It helps identify higher-risk patients for closer monitoring and earlier escalation discussions; it does not by itself dictate whether to drain.',
    ],
  },
  {
    id: 'bleeding-and-special',
    title: 'Bleeding risk and intrapleural therapy',
    level: 'advanced',
    bullets: [
      'Intrapleural lytics add bleeding risk; weigh anticoagulation, the specific agent and its timing, and whether it can be safely paused.',
      'When bleeding risk cannot be mitigated, saline irrigation is one of the alternatives to consider rather than forcing lytics.',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Block ids mirror the English
// source above so module progress and board-section anchors stay aligned; only
// the learner-facing prose differs. See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const infectionObjectivesEs: readonly string[] = [
  'Estadificar un derrame paraneumónico (no complicado / complicado / empiema) a partir del pH, la glucosa, la LDH, la tinción de Gram o el cultivo, el pus y la complejidad ecográfica.',
  'Elegir antibióticos más drenaje, y saber dónde encajan tPA + DNasa, la cirugía y la irrigación como alternativa.',
  'Reevaluar en un punto de control y escalar, en lugar de colocar un drenaje y esperar.',
]

const infectionCoreBlocksEs: LearnBlock[] = [
  {
    id: 'spectrum',
    title: 'El espectro: simple → complicado → empiema',
    paragraphs: [
      'La infección pleural es un continuo, no tres enfermedades separadas. Un derrame paraneumónico simple es un exudado estéril que se resuelve con antibióticos; un derrame paraneumónico complicado ha avanzado lo suficiente hacia el espacio pleural como para requerir drenaje; un empiema es pus franco. La tarea junto a la cama es situar al paciente en ese continuo con rapidez, porque cuanto más avanzado esté, más importa el control del foco.',
    ],
    bullets: [
      'No complicado: de libre flujo, química más o menos normal — los antibióticos y la reevaluación estrecha pueden bastar.',
      'Complicado: química de nivel de drenaje o líquido complejo/septado/grande — antibióticos más un drenaje.',
      'Empiema: pus franco o tinción de Gram/cultivo positivo — drena y busca el control del foco de forma temprana.',
    ],
  },
  {
    id: 'fluid-that-demands-drainage',
    title: 'El líquido que exige drenaje',
    paragraphs: [
      'Toma una muestra del líquido de forma temprana y envíala a un analizador de gases en sangre para medir el pH. La química separa el complicado del no complicado; el pus o una tinción de Gram positiva lo resuelven sin necesidad de química alguna.',
    ],
    bullets: [
      'Un pH pleural ≤ 7,2 es el indicador químico aislado más potente para el drenaje.',
      'Una glucosa pleural < 60 mg/dL y una LDH > 1000 IU/L también apuntan hacia un derrame complicado.',
      'El pus franco, o una tinción de Gram o cultivo positivo, es un empiema — drena con independencia de la química.',
      'Las colecciones complejas, septadas o grandes en la ecografía aumentan la preocupación por el umbral de drenaje incluso cuando los números son límite.',
    ],
  },
  {
    id: 'antibiotics-and-drainage',
    title: 'Antibióticos más drenaje temprano',
    bullets: [
      'Inicia antibióticos empíricos con prontitud y cubre anaerobios; adáptalos al riesgo adquirido en la comunidad frente al hospitalario y a la resistencia local.',
      'Para derrames complicados y empiema, coloca un drenaje de pequeño calibre guiado por imagen — se tolera mejor y suele ser suficiente.',
      'La duración del antibiótico se adapta al control del foco y a la respuesta: aproximadamente hasta 2 semanas para el no complicado, más tiempo (a menudo 2–6 semanas) para el derrame complicado y el empiema.',
      'Envía líquido pleural para cultivo antes de la primera dosis de antibiótico, o junto con ella, siempre que sea posible.',
    ],
  },
  {
    id: 'tpa-dnase-mist2',
    title: 'Cuando el drenaje se estanca: tPA + DNasa (MIST2)',
    paragraphs: [
      'Cuando hay un drenaje colocado pero la colección no se aclara, la terapia enzimática intrapleural puede degradar la fibrina y diluir el pus. La evidencia es específica respecto a la combinación.',
    ],
    bullets: [
      'La combinación de activador tisular del plasminógeno (tPA) + DNasa mejoró el aclaramiento radiográfico y redujo la derivación quirúrgica y la estancia hospitalaria en MIST2.',
      'El tPA solo no mostró el mismo beneficio, y la DNasa sola es una trampa clásica — no fue beneficiosa y puede empeorar el drenaje.',
      'Evalúa el riesgo de sangrado y el momento de la medicación antes de administrar líticos intrapleurales.',
    ],
  },
  {
    id: 'surgery-and-irrigation',
    title: 'La cirugía y la irrigación como alternativa',
    bullets: [
      'Deriva a cirugía (VATS, a veces decorticación) cuando el paciente no mejora a pesar de un drenaje funcionante y terapia enzimática, o cuando el empiema está organizado.',
      'La irrigación pleural con suero salino normal es una alternativa seleccionada que se puede comentar cuando la terapia lítica no es adecuada o el riesgo de sangrado no puede mitigarse — respaldada por datos piloto, no un reemplazo universal.',
      'La cirugía es una escalada planificada, no un rescate de último recurso — involucra a cirugía torácica de forma temprana en los no respondedores.',
    ],
  },
  {
    id: 'reassess',
    title: 'Reevalúa — no lo dejes y te olvides',
    bullets: [
      'Fija un punto de control (alrededor de 48–72 horas): ¿la fiebre, los marcadores inflamatorios, el débito del drenaje y la imagen van todos en la dirección correcta?',
      'Si el progreso se estanca, recorre la cadena de escalada: confirma que el drenaje funciona → lava/repite la imagen → tPA + DNasa intrapleurales → irrigación cuando sea adecuada → revisión quirúrgica.',
      'Un drenaje obstruido o mal posicionado es una causa frecuente y corregible de aparente fracaso del tratamiento — compruébalo antes de escalar la terapia.',
    ],
  },
]

const infectionGoDeeperBlocksEs: LearnBlock[] = [
  {
    id: 'rapid-score',
    title: 'La puntuación RAPID',
    level: 'advanced',
    bullets: [
      'RAPID estratifica el riesgo de mortalidad por infección pleural a partir de cinco factores: Renal (urea), Age (edad), Purulence (purulencia del líquido), Infection source (origen de la infección; el hospitalario es peor) y Dietary status (estado nutricional; albúmina baja).',
      'Ayuda a identificar a los pacientes de mayor riesgo para una monitorización más estrecha y conversaciones de escalada más tempranas; por sí sola no dicta si drenar.',
    ],
  },
  {
    id: 'bleeding-and-special',
    title: 'Riesgo de sangrado y terapia intrapleural',
    level: 'advanced',
    bullets: [
      'Los líticos intrapleurales añaden riesgo de sangrado; sopesa la anticoagulación, el agente concreto y su momento, y si puede pausarse de forma segura.',
      'Cuando el riesgo de sangrado no puede mitigarse, la irrigación con suero salino es una de las alternativas a considerar en lugar de forzar los líticos.',
    ],
  },
]

const infectionObjectivesZhCn: readonly string[] = [
  '依据 pH、葡萄糖、LDH、革兰染色或培养、脓液以及超声复杂度，对肺炎旁积液进行分期（单纯性／复杂性／脓胸）。',
  '选择抗生素加引流，并知道 tPA + DNase、外科手术以及冲洗这一替代方案各自的位置。',
  '在检查点重新评估并升级处理，而不是放置引流后一味等待。',
]

const infectionCoreBlocksZhCn: LearnBlock[] = [
  {
    id: 'spectrum',
    title: '谱系：单纯 → 复杂 → 脓胸',
    paragraphs: [
      '胸膜感染是一个连续谱，而不是三种独立的疾病。单纯性肺炎旁积液是随抗生素消退的无菌渗出液；复杂性肺炎旁积液已足够侵入胸膜腔而需要引流；脓胸则是明显的脓液。床旁的任务是迅速把患者定位到这一连续谱上，因为越靠后，控制感染源就越重要。',
    ],
    bullets: [
      '单纯性：游离流动、化验大致正常——抗生素加密切重新评估可能就足够。',
      '复杂性：达引流标准的化验，或复杂/分隔/大量积液——抗生素加引流。',
      '脓胸：明显脓液或革兰染色/培养阳性——引流并尽早寻求感染源控制。',
    ],
  },
  {
    id: 'fluid-that-demands-drainage',
    title: '需要引流的积液',
    paragraphs: [
      '尽早取样并送血气分析仪测 pH。化验可把复杂性与单纯性区分开；而脓液或革兰染色阳性无需任何化验即可下结论。',
    ],
    bullets: [
      '胸膜 pH ≤ 7.2 是支持引流的最强单项化学指标。',
      '胸膜葡萄糖 < 60 mg/dL 和 LDH > 1000 IU/L 也提示复杂性积液。',
      '明显脓液，或革兰染色或培养阳性，即为脓胸——无论化验如何都应引流。',
      '超声上复杂、分隔或大量的积液，即使数值处于临界，也会提高对引流阈值的关注。',
    ],
  },
  {
    id: 'antibiotics-and-drainage',
    title: '抗生素加早期引流',
    bullets: [
      '及时启动经验性抗生素并覆盖厌氧菌；根据社区获得性与医院获得性风险及当地耐药情况进行调整。',
      '对复杂性积液和脓胸，放置小口径影像引导引流——耐受性更好且通常已足够。',
      '抗生素疗程根据感染源控制和疗效调整：单纯性大致最多 2 周，复杂性积液和脓胸更长（常为 2–6 周）。',
      '尽可能在首剂抗生素之前或同时送胸液培养。',
    ],
  },
  {
    id: 'tpa-dnase-mist2',
    title: '当引流停滞时：tPA + DNase（MIST2）',
    paragraphs: [
      '当引流已放置但积液不消退时，胸膜腔内酶疗法可分解纤维蛋白并稀释脓液。证据对这一联合方案有明确指向。',
    ],
    bullets: [
      '组织型纤溶酶原激活剂（tPA）+ DNase 联合在 MIST2 中改善了影像学清除并减少了外科转诊和住院时间。',
      '单用 tPA 未显示同样的获益，而单用 DNase 是经典陷阱——无获益且可能使引流变差。',
      '在给予胸膜腔内溶栓药前，评估出血风险和用药时机。',
    ],
  },
  {
    id: 'surgery-and-irrigation',
    title: '外科手术与冲洗替代方案',
    bullets: [
      '当患者在引流通畅且已行酶疗法后仍不改善，或脓胸已机化时，转诊外科（VATS，有时为剥脱术）。',
      '生理盐水胸膜冲洗是一种经选择的替代方案，可在溶栓治疗不适合或出血风险无法缓解时讨论——有初步数据支持，并非普遍替代。',
      '外科手术是有计划的升级，而非最后的补救——对无应答者应尽早请胸外科介入。',
    ],
  },
  {
    id: 'reassess',
    title: '重新评估——切勿一放了之',
    bullets: [
      '设定检查点（约 48–72 小时）：发热、炎症标志物、引流量和影像是否都朝正确方向发展？',
      '若进展停滞，沿升级链推进：确认引流通畅 → 冲洗/复查影像 → 胸膜腔内 tPA + DNase → 适合时冲洗 → 外科评估。',
      '引流管阻塞或位置不当是导致表面上治疗失败的常见且可纠正的原因——在升级治疗前先检查它。',
    ],
  },
]

const infectionGoDeeperBlocksZhCn: LearnBlock[] = [
  {
    id: 'rapid-score',
    title: 'RAPID 评分',
    level: 'advanced',
    bullets: [
      'RAPID 依据五个因素对胸膜感染的死亡风险进行分层：Renal（尿素）、Age（年龄）、Purulence（积液脓性）、Infection source（感染来源；医院获得性更差）和 Dietary status（营养状况；低白蛋白）。',
      '它有助于识别更高风险的患者以进行更密切的监测和更早的升级讨论；其本身并不决定是否引流。',
    ],
  },
  {
    id: 'bleeding-and-special',
    title: '出血风险与胸膜腔内治疗',
    level: 'advanced',
    bullets: [
      '胸膜腔内溶栓药会增加出血风险；权衡抗凝、具体药物及其时机，以及能否安全暂停。',
      '当出血风险无法缓解时，生理盐水冲洗是可考虑的替代方案之一，而非强行使用溶栓药。',
    ],
  },
]

export function getInfectionObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, {
    en: infectionObjectives as readonly string[],
    es: infectionObjectivesEs,
    'zh-CN': infectionObjectivesZhCn,
  })
}

export function getInfectionCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: infectionCoreBlocks,
    es: infectionCoreBlocksEs,
    'zh-CN': infectionCoreBlocksZhCn,
  })
}

export function getInfectionGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: infectionGoDeeperBlocks,
    es: infectionGoDeeperBlocksEs,
    'zh-CN': infectionGoDeeperBlocksZhCn,
  })
}
