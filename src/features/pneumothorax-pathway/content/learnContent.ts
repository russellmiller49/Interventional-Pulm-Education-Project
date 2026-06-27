import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Pneumothorax "Learn" section — taught before the
 * interactive ACCP-vs-BTS pathway (Practice). Mirrors the dual-framework engine:
 * stability first, then PSP vs SSP, size is not the sole driver, the framework
 * divergence, persistent air leak, and recurrence prevention. Board sections come
 * from the pneumothorax/PAL/BPF chapter; a unit test guards the ids.
 */

export const pneumothoraxBoardSlug = 'pneumothorax-and-pal'

export const pneumothoraxBoardSectionIds = [
  'algorithm-1-adult-spontaneous-pneumothorax-initial-management',
  'algorithm-2-persistent-air-leak-apf-bpf-localization-and-closure',
  'table-1-lung-ultrasound-signs-for-pneumothorax',
  'table-2-distinguishing-apf-vs-bpf-and-implications',
  'table-3-bronchoscopic-options-for-pal-bpf',
] as const

export const pneumothoraxObjectives = [
  'Separate physiologic instability (tension) from stable decision-making.',
  'Distinguish primary from secondary pneumothorax, avoid using size as the sole driver, and compare the ACCP 2001 and BTS 2023 pathways.',
  'Manage a persistent air leak and recognize recurrence-prevention triggers.',
] as const

export const pneumothoraxCoreBlocks: LearnBlock[] = [
  {
    id: 'stability-first',
    title: 'Stability first — is this an emergency?',
    paragraphs: [
      'Before size, before primary-vs-secondary, ask whether the patient is physiologically stable. Tension physiology — hemodynamic compromise or severe hypoxia — is a clinical emergency that needs immediate decompression and drainage no matter how big the pneumothorax looks.',
    ],
    bullets: [
      'Hemodynamic compromise or severe hypoxemia → urgent decompression and a chest drain.',
      'Do not wait for imaging to treat suspected tension pneumothorax.',
      'Only once the patient is stable does the size/symptom/risk decision begin.',
    ],
  },
  {
    id: 'psp-vs-ssp',
    title: 'Primary vs. secondary',
    bullets: [
      'Primary spontaneous pneumothorax (PSP): no clinically apparent lung disease — classically tall, thin, younger smokers.',
      'Secondary spontaneous pneumothorax (SSP): underlying lung disease (COPD, ILD) with far less respiratory reserve.',
      'SSP behaves more dangerously and is generally managed with a chest drain and admission rather than observation.',
      'Ventilated and traumatic pneumothoraces also sit in the higher-risk, monitored-intervention group.',
    ],
  },
  {
    id: 'size-not-sole-driver',
    title: 'Size is not the sole driver',
    paragraphs: [
      'Modern guidance (BTS 2023, ERS/EACTS/ESTS 2024) deliberately de-emphasizes a single size cutoff for stable patients. Symptoms, the type of pneumothorax, patient priorities, and the reliability of follow-up carry the decision.',
    ],
    bullets: [
      'Stable, minimally symptomatic PSP can often be managed conservatively with safety-netting and reliable follow-up.',
      'Intervention options run from observation → needle aspiration → ambulatory device → small-bore chest drain.',
      'Avoid routine suction — it can propagate an air leak; reserve it for specific situations.',
    ],
  },
  {
    id: 'accp-vs-bts',
    title: 'ACCP 2001 vs. BTS 2023 — where they agree and diverge',
    paragraphs: [
      'The two frameworks are the heart of this module. They converge on the things physiology dictates and diverge on the stable, symptomatic primary pneumothorax.',
    ],
    bullets: [
      'They agree on emergencies (tension), on SSP/high-risk context (drain), and broadly on persistent-air-leak escalation.',
      'They diverge on stable symptomatic PSP: ACCP 2001 reacts to size (small → observe, large → aspirate/drain), while BTS 2023 prioritizes symptoms, patient preference, and ambulatory options.',
      'When the two disagree, name what is driving it — size, symptom burden, local ambulatory availability, or risk context.',
    ],
  },
  {
    id: 'persistent-air-leak',
    title: 'The persistent air leak',
    bullets: [
      'A persistent air leak is one that continues beyond roughly 3–5 days after drainage.',
      'First, troubleshoot the drain and circuit (kinks, position, connections) before assuming a true prolonged leak.',
      'Avoid unnecessary suction, and escalate to a specialist in a time-bounded way rather than waiting indefinitely.',
      'Definitive options include bronchoscopic therapies (endobronchial valves, balloon-occlusion mapping) and surgery.',
    ],
  },
  {
    id: 'recurrence-prevention',
    title: 'Recurrence prevention',
    bullets: [
      'Counsel every patient after a first pneumothorax about recurrence risk, smoking cessation, and return precautions.',
      'Offer definitive prevention (pleurodesis or surgery) for recurrence, for secondary pneumothorax, or for high-risk occupations such as aviation and diving.',
      'A high-risk occupation lowers the threshold for a definitive recurrence-prevention discussion even after a first event.',
    ],
  },
]

export const pneumothoraxGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'lung-ultrasound-ptx',
    title: 'Lung ultrasound for pneumothorax',
    level: 'advanced',
    bullets: [
      'Absent lung sliding plus absent B-lines raises pneumothorax; the M-mode "barcode/stratosphere" sign replaces the normal "seashore."',
      'The lung point — where sliding reappears — is highly specific for pneumothorax and helps gauge extent.',
      'Ultrasound is more sensitive than a supine chest X-ray for pneumothorax in the right hands.',
    ],
  },
  {
    id: 'apf-vs-bpf',
    title: 'APF vs. BPF and bronchoscopic closure',
    level: 'advanced',
    bullets: [
      'Alveolar-pleural fistula (APF): a peripheral/distal leak — often amenable to endobronchial valves after balloon-occlusion mapping.',
      'Bronchopleural fistula (BPF): a central, larger-airway communication — higher stakes and harder to close.',
      'Bronchoscopic tools include one-way endobronchial valves, spigots, sealants, and occluders, chosen by leak location and size.',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Block ids mirror the English
// source above so module progress and board-section anchors stay aligned; only
// the learner-facing prose differs. See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const pneumothoraxObjectivesEs: readonly string[] = [
  'Separar la inestabilidad fisiológica (tensión) de la toma de decisiones en el paciente estable.',
  'Distinguir el neumotórax primario del secundario, evitar usar el tamaño como único factor y comparar las vías ACCP 2001 y BTS 2023.',
  'Manejar una fuga de aire persistente y reconocer los desencadenantes de la prevención de recurrencias.',
]

const pneumothoraxCoreBlocksEs: LearnBlock[] = [
  {
    id: 'stability-first',
    title: 'Primero la estabilidad — ¿es una emergencia?',
    paragraphs: [
      'Antes del tamaño, antes de primario frente a secundario, pregunta si el paciente está fisiológicamente estable. La fisiología de tensión —compromiso hemodinámico o hipoxia grave— es una emergencia clínica que requiere descompresión y drenaje inmediatos sin importar cuán grande parezca el neumotórax.',
    ],
    bullets: [
      'Compromiso hemodinámico o hipoxemia grave → descompresión urgente y un drenaje torácico.',
      'No esperes a la imagen para tratar un neumotórax a tensión sospechado.',
      'Solo una vez que el paciente está estable comienza la decisión de tamaño/síntomas/riesgo.',
    ],
  },
  {
    id: 'psp-vs-ssp',
    title: 'Primario vs. secundario',
    bullets: [
      'Neumotórax espontáneo primario (PSP): sin enfermedad pulmonar clínicamente aparente — clásicamente fumadores jóvenes, altos y delgados.',
      'Neumotórax espontáneo secundario (SSP): enfermedad pulmonar subyacente (EPOC, EPID) con mucha menos reserva respiratoria.',
      'El SSP se comporta de forma más peligrosa y suele manejarse con un drenaje torácico e ingreso, en lugar de observación.',
      'Los neumotórax en pacientes ventilados y los traumáticos también se sitúan en el grupo de mayor riesgo y de intervención monitorizada.',
    ],
  },
  {
    id: 'size-not-sole-driver',
    title: 'El tamaño no es el único factor',
    paragraphs: [
      'Las guías modernas (BTS 2023, ERS/EACTS/ESTS 2024) deliberadamente restan peso a un único punto de corte de tamaño en pacientes estables. Los síntomas, el tipo de neumotórax, las prioridades del paciente y la fiabilidad del seguimiento llevan la decisión.',
    ],
    bullets: [
      'Un PSP estable y con síntomas mínimos a menudo puede manejarse de forma conservadora con una red de seguridad y un seguimiento fiable.',
      'Las opciones de intervención van de la observación → aspiración con aguja → dispositivo ambulatorio → drenaje torácico de pequeño calibre.',
      'Evita la succión rutinaria — puede propagar una fuga de aire; resérvala para situaciones específicas.',
    ],
  },
  {
    id: 'accp-vs-bts',
    title: 'ACCP 2001 vs. BTS 2023 — dónde coinciden y dónde divergen',
    paragraphs: [
      'Los dos marcos son el corazón de este módulo. Convergen en lo que dicta la fisiología y divergen en el neumotórax primario estable y sintomático.',
    ],
    bullets: [
      'Coinciden en las emergencias (tensión), en el contexto de SSP/alto riesgo (drenaje) y, en términos generales, en la escalada de la fuga de aire persistente.',
      'Divergen en el PSP estable y sintomático: ACCP 2001 reacciona al tamaño (pequeño → observar, grande → aspirar/drenar), mientras que BTS 2023 prioriza los síntomas, la preferencia del paciente y las opciones ambulatorias.',
      'Cuando los dos discrepan, nombra qué lo está impulsando — tamaño, carga de síntomas, disponibilidad ambulatoria local o contexto de riesgo.',
    ],
  },
  {
    id: 'persistent-air-leak',
    title: 'La fuga de aire persistente',
    bullets: [
      'Una fuga de aire persistente es la que continúa más allá de aproximadamente 3–5 días tras el drenaje.',
      'Primero, soluciona los problemas del drenaje y el circuito (acodaduras, posición, conexiones) antes de asumir una fuga prolongada verdadera.',
      'Evita la succión innecesaria y escala a un especialista de forma acotada en el tiempo, en lugar de esperar indefinidamente.',
      'Las opciones definitivas incluyen terapias broncoscópicas (válvulas endobronquiales, mapeo por oclusión con balón) y cirugía.',
    ],
  },
  {
    id: 'recurrence-prevention',
    title: 'Prevención de recurrencias',
    bullets: [
      'Aconseja a todo paciente tras un primer neumotórax sobre el riesgo de recurrencia, el abandono del tabaco y las precauciones de reconsulta.',
      'Ofrece prevención definitiva (pleurodesis o cirugía) ante una recurrencia, un neumotórax secundario o ocupaciones de alto riesgo como la aviación y el buceo.',
      'Una ocupación de alto riesgo reduce el umbral para una discusión definitiva sobre la prevención de recurrencias, incluso tras un primer episodio.',
    ],
  },
]

const pneumothoraxGoDeeperBlocksEs: LearnBlock[] = [
  {
    id: 'lung-ultrasound-ptx',
    title: 'Ecografía pulmonar para el neumotórax',
    level: 'advanced',
    bullets: [
      'La ausencia de deslizamiento pulmonar junto con la ausencia de líneas B sugiere neumotórax; el signo del «código de barras/estratosfera» en modo M reemplaza al normal «de la orilla del mar».',
      'El punto pulmonar —donde reaparece el deslizamiento— es altamente específico de neumotórax y ayuda a estimar la extensión.',
      'La ecografía es más sensible que una radiografía de tórax en decúbito supino para el neumotórax en manos expertas.',
    ],
  },
  {
    id: 'apf-vs-bpf',
    title: 'APF vs. BPF y cierre broncoscópico',
    level: 'advanced',
    bullets: [
      'Fístula alveolo-pleural (APF): una fuga periférica/distal — a menudo abordable con válvulas endobronquiales tras el mapeo por oclusión con balón.',
      'Fístula broncopleural (BPF): una comunicación central, de vía aérea de mayor calibre — de mayor riesgo y más difícil de cerrar.',
      'Las herramientas broncoscópicas incluyen válvulas endobronquiales unidireccionales, tapones (spigots), selladores y oclusores, elegidos según la localización y el tamaño de la fuga.',
    ],
  },
]

const pneumothoraxObjectivesZhCn: readonly string[] = [
  '将生理性不稳定（张力性）与稳定患者的决策区分开来。',
  '区分原发性与继发性气胸，避免将大小作为唯一决策依据，并比较 ACCP 2001 与 BTS 2023 两条路径。',
  '处理持续性漏气，并识别复发预防的触发因素。',
]

const pneumothoraxCoreBlocksZhCn: LearnBlock[] = [
  {
    id: 'stability-first',
    title: '稳定性优先——这是急症吗？',
    paragraphs: [
      '在考虑大小、在区分原发性与继发性之前，先问患者在生理上是否稳定。张力性生理状态——血流动力学受损或严重低氧——是一种临床急症，无论气胸看起来多大，都需要立即减压和引流。',
    ],
    bullets: [
      '血流动力学受损或严重低氧血症 → 紧急减压并放置胸腔引流管。',
      '对怀疑张力性气胸者，不要等待影像即开始处理。',
      '只有在患者稳定之后，才开始大小/症状/风险的决策。',
    ],
  },
  {
    id: 'psp-vs-ssp',
    title: '原发性 vs. 继发性',
    bullets: [
      '原发性自发性气胸（PSP）：无临床可见的肺部疾病——典型为高瘦的年轻吸烟者。',
      '继发性自发性气胸（SSP）：存在基础肺部疾病（COPD、ILD），呼吸储备明显更少。',
      'SSP 表现更为危险，通常采用胸腔引流并收入院，而非观察。',
      '机械通气和外伤性气胸同样属于高风险、需监护性干预的一组。',
    ],
  },
  {
    id: 'size-not-sole-driver',
    title: '大小并非唯一决定因素',
    paragraphs: [
      '现代指南（BTS 2023、ERS/EACTS/ESTS 2024）有意淡化对稳定患者使用单一大小截断值。症状、气胸类型、患者优先考虑事项以及随访的可靠性才是决策的关键。',
    ],
    bullets: [
      '稳定、症状轻微的 PSP 通常可在有安全网和可靠随访的前提下保守处理。',
      '干预选择从观察 → 针吸 → 门诊装置 → 小口径胸腔引流管。',
      '避免常规负压吸引——它可能加重漏气；仅在特定情况下使用。',
    ],
  },
  {
    id: 'accp-vs-bts',
    title: 'ACCP 2001 vs. BTS 2023——它们在哪里一致、在哪里分歧',
    paragraphs: [
      '这两个框架是本模块的核心。它们在生理决定的方面趋于一致，而在稳定、有症状的原发性气胸上出现分歧。',
    ],
    bullets: [
      '在急症（张力性）、SSP/高风险情形（引流）以及大体上的持续性漏气升级处理上，二者一致。',
      '它们在稳定、有症状的 PSP 上出现分歧：ACCP 2001 依据大小做出反应（小 → 观察，大 → 针吸/引流），而 BTS 2023 优先考虑症状、患者偏好以及门诊路径。',
      '当二者不一致时，指出究竟是什么在主导——大小、症状负担、当地门诊条件，还是风险背景。',
    ],
  },
  {
    id: 'persistent-air-leak',
    title: '持续性漏气',
    bullets: [
      '持续性漏气是指引流后大约 3–5 天仍持续存在的漏气。',
      '首先排查引流管和管路问题（打折、位置、连接），再判定是否为真正的长期漏气。',
      '避免不必要的负压吸引，并以有时间界限的方式升级至专科，而非无限期等待。',
      '确定性的处理包括支气管镜治疗（支气管内活瓣、球囊封堵定位）和手术。',
    ],
  },
  {
    id: 'recurrence-prevention',
    title: '复发预防',
    bullets: [
      '对每一位首次气胸后的患者，都应就复发风险、戒烟和再就诊注意事项进行宣教。',
      '对复发、继发性气胸或航空、潜水等高风险职业者，提供确定性预防（胸膜固定术或手术）。',
      '高风险职业即便在首次发作后，也会降低进行确定性复发预防讨论的门槛。',
    ],
  },
]

const pneumothoraxGoDeeperBlocksZhCn: LearnBlock[] = [
  {
    id: 'lung-ultrasound-ptx',
    title: '肺部超声诊断气胸',
    level: 'advanced',
    bullets: [
      '肺滑动消失加上 B 线消失提示气胸；M 型上的「条形码/平流层」征取代了正常的「海岸」征。',
      '肺点——肺滑动重新出现之处——对气胸高度特异，并有助于判断范围。',
      '在熟练操作者手中，超声诊断气胸比仰卧位胸片更敏感。',
    ],
  },
  {
    id: 'apf-vs-bpf',
    title: 'APF vs. BPF 与支气管镜下封堵',
    level: 'advanced',
    bullets: [
      '肺泡-胸膜瘘（APF）：外周/远端漏气——常可在球囊封堵定位后用支气管内活瓣处理。',
      '支气管胸膜瘘（BPF）：中央、较大气道的交通——风险更高且更难封闭。',
      '支气管镜工具包括单向支气管内活瓣、塞子（spigot）、封闭剂和封堵器，依据漏气的位置和大小来选择。',
    ],
  },
]

export function getPneumothoraxObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, {
    en: pneumothoraxObjectives as readonly string[],
    es: pneumothoraxObjectivesEs,
    'zh-CN': pneumothoraxObjectivesZhCn,
  })
}

export function getPneumothoraxCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: pneumothoraxCoreBlocks,
    es: pneumothoraxCoreBlocksEs,
    'zh-CN': pneumothoraxCoreBlocksZhCn,
  })
}

export function getPneumothoraxGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: pneumothoraxGoDeeperBlocks,
    es: pneumothoraxGoDeeperBlocksEs,
    'zh-CN': pneumothoraxGoDeeperBlocksZhCn,
  })
}
