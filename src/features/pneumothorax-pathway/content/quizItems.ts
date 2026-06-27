import { pickLocaleContent } from '@/i18n/content'
import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Pneumothorax module, aligned to the Learn objectives
 * (stability, PSP vs SSP, size-is-not-everything, ACCP vs BTS, persistent air
 * leak, recurrence prevention). Commit-first.
 */
export const pneumothoraxQuizQuestions: QuizQuestion[] = [
  {
    prompt:
      'A patient has a pneumothorax with hypotension and severe hypoxia. The first action is:',
    options: [
      'Observe and repeat imaging in 6 hours',
      'Immediate decompression and chest drainage regardless of measured size',
      'Send for outpatient ambulatory device fitting',
      'Start suction and wait',
    ],
    answerIndex: 1,
    explanation:
      'Tension physiology (hemodynamic compromise or severe hypoxia) is an emergency. Decompress and drain immediately — size does not change that.',
  },
  {
    prompt:
      'Compared with a primary spontaneous pneumothorax, a secondary one (e.g., in COPD) is generally:',
    options: [
      'Managed more conservatively because patients tolerate it better',
      'Managed more aggressively (chest drain and admission) because reserve is low',
      'Identical in management',
      'Never drained',
    ],
    answerIndex: 1,
    explanation:
      'Secondary spontaneous pneumothorax occurs in patients with little respiratory reserve, so it is generally treated with a chest drain and admission rather than observation.',
  },
  {
    prompt: 'In current guidance (BTS 2023 / ERS 2024), the size of a stable pneumothorax is:',
    options: [
      'The single determinant of treatment',
      'One factor among symptoms, type, patient priorities, and follow-up reliability',
      'Irrelevant in every case',
      'Only used for secondary pneumothorax',
    ],
    answerIndex: 1,
    explanation:
      'Modern pathways de-emphasize a single size cutoff for stable patients and weigh symptoms, PSP vs SSP, patient preference, and reliable follow-up.',
  },
  {
    prompt:
      'A stable, symptomatic primary spontaneous pneumothorax is where the frameworks most diverge. The key difference is:',
    options: [
      'ACCP 2001 reacts mainly to size; BTS 2023 prioritizes symptoms, patient preference, and ambulatory options',
      'BTS 2023 always recommends surgery; ACCP 2001 always observes',
      'They are identical for this scenario',
      'Both mandate immediate pleurodesis',
    ],
    answerIndex: 0,
    explanation:
      'The classic divergence: ACCP 2001 is size-driven, while BTS 2023 emphasizes symptom burden, patient priorities, and ambulatory/aspiration options.',
  },
  {
    prompt: 'Conservative (observation) management is most reasonable for:',
    options: [
      'A ventilated patient with a traumatic pneumothorax',
      'A stable, minimally symptomatic primary spontaneous pneumothorax with reliable follow-up',
      'Any secondary spontaneous pneumothorax',
      'A patient with tension physiology',
    ],
    answerIndex: 1,
    explanation:
      'Stable, minimally symptomatic PSP can often be observed with safety-netting and reliable follow-up — procedure avoidance is reasonable here.',
  },
  {
    prompt:
      'A chest drain has been in for several days with an ongoing air leak. The best next step is:',
    options: [
      'Immediately apply high suction',
      'Troubleshoot the drain and circuit, avoid unnecessary suction, and plan time-bounded specialist escalation',
      'Remove the drain and discharge',
      'Clamp the drain and observe overnight',
    ],
    answerIndex: 1,
    explanation:
      'First confirm the leak is real by checking the drain and connections. Avoid unnecessary suction (it can propagate the leak) and escalate to a specialist in a time-bounded way.',
  },
  {
    prompt:
      'Bronchoscopic management of a persistent peripheral (alveolar-pleural) air leak may include:',
    options: [
      'Endobronchial valves after balloon-occlusion mapping',
      'Routine lobectomy for all leaks',
      'High-dose systemic antibiotics alone',
      'Permanent clamping of the chest tube',
    ],
    answerIndex: 0,
    explanation:
      'Balloon-occlusion mapping localizes the culprit segment, and one-way endobronchial valves (or spigots/sealants) can reduce or stop a persistent alveolar-pleural leak.',
  },
  {
    prompt: 'Which feature most strongly prompts a definitive recurrence-prevention discussion?',
    options: [
      'A first primary pneumothorax in a non-smoker office worker',
      'A recurrence, a secondary pneumothorax, or a high-risk occupation (e.g., diving or aviation)',
      'Complete resolution on the first chest X-ray',
      'A small apical pneumothorax found incidentally and asymptomatic',
    ],
    answerIndex: 1,
    explanation:
      'Recurrence, secondary pneumothorax, and high-risk occupations (aviation, diving) lower the threshold for definitive prevention such as pleurodesis or surgery.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. answerIndex values mirror the
// English source so scoring stays correct; only learner-facing text differs.
// ─────────────────────────────────────────────────────────────────────────────

const pneumothoraxQuizQuestionsEs: QuizQuestion[] = [
  {
    prompt:
      'Un paciente tiene un neumotórax con hipotensión e hipoxia grave. La primera acción es:',
    options: [
      'Observar y repetir la imagen en 6 horas',
      'Descompresión inmediata y drenaje torácico independientemente del tamaño medido',
      'Derivar para colocación ambulatoria de un dispositivo',
      'Iniciar succión y esperar',
    ],
    answerIndex: 1,
    explanation:
      'La fisiología de tensión (compromiso hemodinámico o hipoxia grave) es una emergencia. Descomprime y drena de inmediato — el tamaño no cambia eso.',
  },
  {
    prompt:
      'En comparación con un neumotórax espontáneo primario, uno secundario (p. ej., en EPOC) generalmente se:',
    options: [
      'Maneja de forma más conservadora porque los pacientes lo toleran mejor',
      'Maneja de forma más agresiva (drenaje torácico e ingreso) porque la reserva es baja',
      'Maneja de forma idéntica',
      'Nunca se drena',
    ],
    answerIndex: 1,
    explanation:
      'El neumotórax espontáneo secundario ocurre en pacientes con poca reserva respiratoria, por lo que generalmente se trata con un drenaje torácico e ingreso en lugar de observación.',
  },
  {
    prompt: 'En las guías actuales (BTS 2023 / ERS 2024), el tamaño de un neumotórax estable es:',
    options: [
      'El único determinante del tratamiento',
      'Un factor entre los síntomas, el tipo, las prioridades del paciente y la fiabilidad del seguimiento',
      'Irrelevante en todos los casos',
      'Solo se usa para el neumotórax secundario',
    ],
    answerIndex: 1,
    explanation:
      'Las vías modernas restan peso a un único punto de corte de tamaño en pacientes estables y sopesan los síntomas, PSP frente a SSP, la preferencia del paciente y un seguimiento fiable.',
  },
  {
    prompt:
      'Un neumotórax espontáneo primario estable y sintomático es donde más divergen los marcos. La diferencia clave es:',
    options: [
      'ACCP 2001 reacciona principalmente al tamaño; BTS 2023 prioriza los síntomas, la preferencia del paciente y las opciones ambulatorias',
      'BTS 2023 siempre recomienda cirugía; ACCP 2001 siempre observa',
      'Son idénticos para este escenario',
      'Ambos exigen pleurodesis inmediata',
    ],
    answerIndex: 0,
    explanation:
      'La divergencia clásica: ACCP 2001 está guiado por el tamaño, mientras que BTS 2023 enfatiza la carga de síntomas, las prioridades del paciente y las opciones ambulatorias/de aspiración.',
  },
  {
    prompt: 'El manejo conservador (observación) es más razonable para:',
    options: [
      'Un paciente ventilado con un neumotórax traumático',
      'Un neumotórax espontáneo primario estable y con síntomas mínimos con seguimiento fiable',
      'Cualquier neumotórax espontáneo secundario',
      'Un paciente con fisiología de tensión',
    ],
    answerIndex: 1,
    explanation:
      'Un PSP estable y con síntomas mínimos a menudo puede observarse con una red de seguridad y un seguimiento fiable — evitar el procedimiento es razonable aquí.',
  },
  {
    prompt:
      'Un drenaje torácico lleva varios días colocado con una fuga de aire en curso. El mejor siguiente paso es:',
    options: [
      'Aplicar de inmediato succión alta',
      'Solucionar los problemas del drenaje y el circuito, evitar la succión innecesaria y planear una escalada a especialista acotada en el tiempo',
      'Retirar el drenaje y dar el alta',
      'Pinzar el drenaje y observar durante la noche',
    ],
    answerIndex: 1,
    explanation:
      'Primero confirma que la fuga es real comprobando el drenaje y las conexiones. Evita la succión innecesaria (puede propagar la fuga) y escala a un especialista de forma acotada en el tiempo.',
  },
  {
    prompt:
      'El manejo broncoscópico de una fuga de aire periférica (alveolo-pleural) persistente puede incluir:',
    options: [
      'Válvulas endobronquiales tras el mapeo por oclusión con balón',
      'Lobectomía rutinaria para todas las fugas',
      'Antibióticos sistémicos a dosis altas en monoterapia',
      'Pinzamiento permanente del tubo torácico',
    ],
    answerIndex: 0,
    explanation:
      'El mapeo por oclusión con balón localiza el segmento responsable, y las válvulas endobronquiales unidireccionales (o tapones/selladores) pueden reducir o detener una fuga alveolo-pleural persistente.',
  },
  {
    prompt:
      '¿Qué característica impulsa con mayor fuerza una discusión definitiva sobre la prevención de recurrencias?',
    options: [
      'Un primer neumotórax primario en un oficinista no fumador',
      'Una recurrencia, un neumotórax secundario o una ocupación de alto riesgo (p. ej., buceo o aviación)',
      'Resolución completa en la primera radiografía de tórax',
      'Un pequeño neumotórax apical hallado de forma incidental y asintomático',
    ],
    answerIndex: 1,
    explanation:
      'La recurrencia, el neumotórax secundario y las ocupaciones de alto riesgo (aviación, buceo) reducen el umbral para una prevención definitiva como la pleurodesis o la cirugía.',
  },
]

const pneumothoraxQuizQuestionsZhCn: QuizQuestion[] = [
  {
    prompt: '一名气胸患者伴有低血压和严重低氧。首先应采取的措施是：',
    options: [
      '观察并在 6 小时后复查影像',
      '无论测得的大小如何，立即减压并行胸腔引流',
      '转诊门诊安装门诊装置',
      '开始负压吸引并等待',
    ],
    answerIndex: 1,
    explanation:
      '张力性生理状态（血流动力学受损或严重低氧）是急症。应立即减压和引流——大小并不改变这一点。',
  },
  {
    prompt: '与原发性自发性气胸相比，继发性气胸（如 COPD 患者）一般：',
    options: [
      '处理更保守，因为患者耐受更好',
      '处理更积极（胸腔引流并收入院），因为储备较低',
      '处理方式完全相同',
      '从不引流',
    ],
    answerIndex: 1,
    explanation:
      '继发性自发性气胸发生于呼吸储备很少的患者，因此一般采用胸腔引流并收入院，而非观察。',
  },
  {
    prompt: '在现行指南（BTS 2023 / ERS 2024）中，稳定气胸的大小是：',
    options: [
      '治疗的唯一决定因素',
      '与症状、类型、患者优先事项和随访可靠性并列的诸多因素之一',
      '在所有情况下都无关紧要',
      '仅用于继发性气胸',
    ],
    answerIndex: 1,
    explanation:
      '现代路径淡化了对稳定患者使用单一大小截断值，而是权衡症状、PSP 与 SSP、患者偏好以及可靠的随访。',
  },
  {
    prompt: '稳定、有症状的原发性自发性气胸是两个框架分歧最大之处。关键差异在于：',
    options: [
      'ACCP 2001 主要依据大小做出反应；BTS 2023 优先考虑症状、患者偏好和门诊路径',
      'BTS 2023 总是推荐手术；ACCP 2001 总是观察',
      '在此情形下二者完全相同',
      '二者都要求立即行胸膜固定术',
    ],
    answerIndex: 0,
    explanation:
      '经典的分歧：ACCP 2001 以大小为导向，而 BTS 2023 强调症状负担、患者优先事项以及门诊/针吸选择。',
  },
  {
    prompt: '保守（观察）处理对以下哪种情况最为合理：',
    options: [
      '一名外伤性气胸的机械通气患者',
      '一名稳定、症状轻微且随访可靠的原发性自发性气胸患者',
      '任何继发性自发性气胸',
      '一名有张力性生理状态的患者',
    ],
    answerIndex: 1,
    explanation: '稳定、症状轻微的 PSP 通常可在有安全网和可靠随访下观察——此处避免操作是合理的。',
  },
  {
    prompt: '一根胸腔引流管已留置数天且仍持续漏气。最佳的下一步是：',
    options: [
      '立即施加高负压吸引',
      '排查引流管和管路，避免不必要的负压吸引，并计划以有时间界限的方式升级至专科',
      '拔除引流管并出院',
      '夹闭引流管并观察一夜',
    ],
    answerIndex: 1,
    explanation:
      '首先通过检查引流管和连接确认漏气是否真实。避免不必要的负压吸引（可能加重漏气），并以有时间界限的方式升级至专科。',
  },
  {
    prompt: '对持续性外周（肺泡-胸膜）漏气的支气管镜处理可能包括：',
    options: [
      '在球囊封堵定位后置入支气管内活瓣',
      '对所有漏气常规行肺叶切除',
      '仅大剂量全身抗生素',
      '永久夹闭胸管',
    ],
    answerIndex: 0,
    explanation:
      '球囊封堵定位可确定责任肺段，单向支气管内活瓣（或塞子/封闭剂）可减少或终止持续性肺泡-胸膜漏气。',
  },
  {
    prompt: '哪一特征最强烈地提示需要进行确定性复发预防讨论？',
    options: [
      '一名不吸烟的办公室职员首次发生原发性气胸',
      '复发、继发性气胸或高风险职业（如潜水或航空）',
      '首张胸片即完全消散',
      '偶然发现且无症状的少量肺尖气胸',
    ],
    answerIndex: 1,
    explanation:
      '复发、继发性气胸以及高风险职业（航空、潜水）会降低进行确定性预防（如胸膜固定术或手术）的门槛。',
  },
]

export function getPneumothoraxQuizQuestions(locale: string): QuizQuestion[] {
  return pickLocaleContent(locale, {
    en: pneumothoraxQuizQuestions,
    es: pneumothoraxQuizQuestionsEs,
    'zh-CN': pneumothoraxQuizQuestionsZhCn,
  })
}
