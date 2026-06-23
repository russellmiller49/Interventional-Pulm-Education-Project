import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Thoracentesis "Learn" section — taught before the
 * interactive planner (Practice). Core blocks cover safe access, vessel risk,
 * bleeding-risk framing, manometry, and stopping rules; go-deeper covers RPE and
 * special populations. Board section ids were verified to resolve through the
 * board-review parser; a unit test guards them.
 */

export const thoracentesisBoardSlug = 'pleural-effusions'

export const thoracentesisBoardSectionIds = [
  'thoracentesis-real-time-ultrasound-guided',
  'table-2-thoracentesis-safety-technique-checklist',
  'pre-procedure-evaluation',
  'complications-prevention-recognition-management',
  'special-populations',
] as const

export const thoracentesisObjectives = [
  'Identify the triangle of safety and choose a safe, ultrasound-confirmed access window.',
  'Relate entry position to intercostal vessel risk, and frame bleeding risk as individualized rather than a single cutoff.',
  'Interpret pleural manometry to distinguish expandable, entrapped, and trapped lung — and know when to stop draining.',
] as const

export const thoracentesisCoreBlocks: LearnBlock[] = [
  {
    id: 'triangle-of-safety',
    title: 'The triangle of safety and the ultrasound window',
    paragraphs: [
      'The classic triangle of safety marks the chest-wall zone where the muscle and lung anatomy are most forgiving. For a modern thoracentesis, ultrasound then refines it: you confirm an actual fluid pocket of adequate depth with the diaphragm in view, rather than relying on a blind landmark.',
    ],
    bullets: [
      'Anterior border: lateral edge of the pectoralis major.',
      'Posterior border: lateral edge of the latissimus dorsi.',
      'Inferior border: roughly the level of the 5th intercostal space (nipple line); apex at the base of the axilla.',
      'Then confirm with ultrasound: a real fluid pocket, adequate depth, and the diaphragm and sub-diaphragmatic organ in view before you choose the spot.',
    ],
  },
  {
    id: 'vessel-risk-where-to-enter',
    title: 'Where to put the needle — intercostal vessel anatomy',
    bullets: [
      'The neurovascular bundle runs in the costal groove on the underside of each rib, so enter just above the rib to stay away from it.',
      'In the posterior paravertebral zone (roughly within 6 cm of the spine) the intercostal artery is more exposed and tortuous — avoid posterior/medial punctures and scan laterally for a safer window.',
      'In older patients, collateral intercostal vessels can run mid-interspace, another reason to favor a lateral, ultrasound-confirmed approach.',
      'Keep the entry above the diaphragm boundary through the whole respiratory cycle to avoid the liver or spleen.',
    ],
  },
  {
    id: 'bleeding-risk-individualized',
    title: 'Bleeding risk is individualized',
    paragraphs: [
      'There is no single INR or platelet number that makes a pleural procedure safe or unsafe. Modern guidance is comparatively permissive: with ultrasound guidance and a skilled operator, many patients on anticoagulation or with mild lab abnormalities can be tapped safely, especially when the indication is urgent.',
    ],
    bullets: [
      'Weigh indication, urgency, ultrasound guidance, operator experience, the specific drug and its timing, and local policy together — not one lab value.',
      'Reserve correction for genuinely high-risk situations; routine reversal of mild coagulopathy is often unnecessary.',
      'Use the interactive planner to see how the same labs read differently depending on the rest of the picture.',
    ],
  },
  {
    id: 'manometry-and-pressure',
    title: 'Pleural manometry: what the pressure tells you',
    paragraphs: [
      'Measuring pleural pressure during drainage turns a blind procedure into an informed one. Pleural elastance (how fast pressure falls per unit volume removed) reflects whether the lung is re-expanding to fill the space. A steeply negative pressure means the lung is not keeping up — the space is being held open by suction rather than filled by lung.',
    ],
    bullets: [
      'Drain to symptoms and pressure, not to a fixed volume.',
      'Stop or slow if pleural pressure falls below about −20 cm H₂O, or if the patient develops chest pain or a relentless cough.',
      'Large-volume drainage is safe when guided this way; the old "1–1.5 L hard stop" is a rule of thumb, not a substitute for symptoms and pressure.',
    ],
  },
  {
    id: 'expandable-entrapped-trapped',
    title: 'Expandable vs. entrapped vs. trapped lung',
    paragraphs: [
      'The shape of the pressure–volume curve separates three situations that look identical on a single chest film but call for very different management.',
    ],
    bullets: [
      'Expandable lung: a normal opening pressure with a gradual decline as fluid comes off. The lung re-expands and the patient does well.',
      'Lung entrapment (partially expandable): a normal/positive opening pressure with a biphasic curve — pressure declines gently, then drops sharply at an inflection point as an active process (often malignancy) restricts further expansion.',
      'Trapped lung: a negative baseline opening pressure with an immediate, steep, monophasic drop — a chronic fibrous peel (old empyema, prior hemothorax) that will not re-expand. Repeated taps frustrate everyone; favor an indwelling pleural catheter.',
    ],
  },
  {
    id: 'stopping-rules',
    title: 'When to slow down or stop',
    bullets: [
      'Symptoms first: new chest pain, intractable cough, or vasovagal symptoms mean pause — regardless of volume.',
      'Pressure second: a steeply negative pleural pressure (≈ −20 cm H₂O) is a stop signal.',
      'Do not chase a target volume; the goal is symptom relief and diagnostic fluid, not an empty pleural space.',
      'A focused post-procedure ultrasound (lung re-expansion, residual fluid, lung sliding to exclude pneumothorax) is usually more useful than a routine chest X-ray.',
    ],
  },
]

export const thoracentesisGoDeeperBlocks: LearnBlock[] = [
  {
    id: 're-expansion-pulmonary-edema',
    title: 'Re-expansion pulmonary edema (RPE)',
    level: 'advanced',
    bullets: [
      'Rare but serious: unilateral edema in the re-expanded lung, occasionally with hypotension.',
      'Risk rises with very negative pleural pressures, rapid removal of a large volume, lung that has been collapsed for a long time, and poor performance status.',
      'Prevention is the manometry-and-symptom approach above; treatment is supportive (oxygen, hemodynamic support), and you stop draining.',
    ],
  },
  {
    id: 'special-situations',
    title: 'Special situations',
    level: 'advanced',
    bullets: [
      'Mechanically ventilated patients: positive pressure changes the risk profile; ultrasound guidance and an experienced operator matter even more.',
      'Anticoagulated or uremic patients: individualize as above; uremic platelet dysfunction is not captured by the platelet count alone.',
      'Suspected trapped/non-expandable lung: counsel the patient before the tap that repeated drainage may not relieve symptoms and that an indwelling catheter may be the better path.',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Block ids mirror the English
// source above so module progress and board-section anchors stay aligned; only
// the learner-facing prose differs. See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const thoracentesisObjectivesEs: readonly string[] = [
  'Identificar el triángulo de seguridad y elegir una ventana de acceso segura y confirmada por ecografía.',
  'Relacionar la posición de entrada con el riesgo de vasos intercostales y enmarcar el riesgo de sangrado como individualizado en lugar de un único punto de corte.',
  'Interpretar la manometría pleural para distinguir el pulmón expansible, con atrapamiento (entrapment) y atrapado (trapped) — y saber cuándo dejar de drenar.',
]

const thoracentesisCoreBlocksEs: LearnBlock[] = [
  {
    id: 'triangle-of-safety',
    title: 'El triángulo de seguridad y la ventana ecográfica',
    paragraphs: [
      'El clásico triángulo de seguridad marca la zona de la pared torácica donde la anatomía muscular y pulmonar es más indulgente. Para una toracocentesis moderna, la ecografía lo refina: confirmas un bolsillo de líquido real con profundidad adecuada y el diafragma a la vista, en lugar de basarte en una referencia anatómica a ciegas.',
    ],
    bullets: [
      'Borde anterior: borde lateral del pectoral mayor.',
      'Borde posterior: borde lateral del dorsal ancho.',
      'Borde inferior: aproximadamente el nivel del 5.º espacio intercostal (línea del pezón); vértice en la base de la axila.',
      'Luego confirma con ecografía: un bolsillo de líquido real, profundidad adecuada y el diafragma y el órgano subdiafragmático a la vista antes de elegir el punto.',
    ],
  },
  {
    id: 'vessel-risk-where-to-enter',
    title: 'Dónde colocar la aguja — anatomía de los vasos intercostales',
    bullets: [
      'El paquete neurovascular discurre por el surco costal en la cara inferior de cada costilla, así que entra justo por encima de la costilla para alejarte de él.',
      'En la zona paravertebral posterior (aproximadamente dentro de 6 cm de la columna) la arteria intercostal está más expuesta y es más tortuosa — evita las punciones posteriores/mediales y escanea lateralmente para una ventana más segura.',
      'En pacientes mayores, los vasos intercostales colaterales pueden discurrir por la mitad del espacio intercostal, otra razón para preferir un abordaje lateral confirmado por ecografía.',
      'Mantén la entrada por encima del límite del diafragma durante todo el ciclo respiratorio para evitar el hígado o el bazo.',
    ],
  },
  {
    id: 'bleeding-risk-individualized',
    title: 'El riesgo de sangrado es individualizado',
    paragraphs: [
      'No hay un único valor de INR o de plaquetas que haga que un procedimiento pleural sea seguro o inseguro. Las guías modernas son comparativamente permisivas: con guía ecográfica y un operador experto, muchos pacientes anticoagulados o con alteraciones leves de laboratorio pueden puncionarse de forma segura, sobre todo cuando la indicación es urgente.',
    ],
    bullets: [
      'Sopesa juntos la indicación, la urgencia, la guía ecográfica, la experiencia del operador, el fármaco concreto y su momento, y la política local — no un único valor de laboratorio.',
      'Reserva la corrección para situaciones genuinamente de alto riesgo; revertir de forma rutinaria una coagulopatía leve suele ser innecesario.',
      'Usa el planificador interactivo para ver cómo los mismos laboratorios se interpretan de forma distinta según el resto del cuadro.',
    ],
  },
  {
    id: 'manometry-and-pressure',
    title: 'Manometría pleural: qué te dice la presión',
    paragraphs: [
      'Medir la presión pleural durante el drenaje convierte un procedimiento a ciegas en uno informado. La elastancia pleural (qué tan rápido cae la presión por unidad de volumen extraído) refleja si el pulmón se está reexpandiendo para llenar el espacio. Una presión muy negativa significa que el pulmón no está siguiendo el ritmo — el espacio se mantiene abierto por la succión en lugar de llenarse con pulmón.',
    ],
    bullets: [
      'Drena según los síntomas y la presión, no según un volumen fijo.',
      'Detente o reduce si la presión pleural cae por debajo de unos −20 cm H₂O, o si el paciente desarrolla dolor torácico o una tos persistente.',
      'El drenaje de gran volumen es seguro cuando se guía así; el antiguo «límite estricto de 1–1,5 L» es una regla práctica, no un sustituto de los síntomas y la presión.',
    ],
  },
  {
    id: 'expandable-entrapped-trapped',
    title: 'Pulmón expansible vs. con atrapamiento vs. atrapado',
    paragraphs: [
      'La forma de la curva presión–volumen separa tres situaciones que parecen idénticas en una sola radiografía de tórax pero que requieren un manejo muy distinto.',
    ],
    bullets: [
      'Pulmón expansible: una presión de apertura normal con un descenso gradual a medida que sale el líquido. El pulmón se reexpande y el paciente evoluciona bien.',
      'Atrapamiento pulmonar (parcialmente expansible): una presión de apertura normal/positiva con una curva bifásica — la presión desciende suavemente y luego cae bruscamente en un punto de inflexión cuando un proceso activo (a menudo malignidad) restringe la expansión adicional.',
      'Pulmón atrapado: una presión de apertura basal negativa con una caída inmediata, pronunciada y monofásica — una corteza fibrosa crónica (empiema antiguo, hemotórax previo) que no se reexpande. Las punciones repetidas frustran a todos; prefiere un catéter pleural permanente.',
    ],
  },
  {
    id: 'stopping-rules',
    title: 'Cuándo reducir o detenerse',
    bullets: [
      'Primero los síntomas: dolor torácico nuevo, tos intratable o síntomas vasovagales obligan a pausar — independientemente del volumen.',
      'Después la presión: una presión pleural muy negativa (≈ −20 cm H₂O) es una señal de detención.',
      'No persigas un volumen objetivo; el objetivo es el alivio de los síntomas y el líquido diagnóstico, no un espacio pleural vacío.',
      'Una ecografía dirigida tras el procedimiento (reexpansión pulmonar, líquido residual, deslizamiento pulmonar para excluir neumotórax) suele ser más útil que una radiografía de tórax de rutina.',
    ],
  },
]

const thoracentesisGoDeeperBlocksEs: LearnBlock[] = [
  {
    id: 're-expansion-pulmonary-edema',
    title: 'Edema pulmonar por reexpansión (EPR)',
    level: 'advanced',
    bullets: [
      'Raro pero grave: edema unilateral en el pulmón reexpandido, ocasionalmente con hipotensión.',
      'El riesgo aumenta con presiones pleurales muy negativas, la extracción rápida de un gran volumen, un pulmón colapsado durante mucho tiempo y un mal estado funcional.',
      'La prevención es el enfoque de manometría y síntomas anterior; el tratamiento es de soporte (oxígeno, soporte hemodinámico) y se detiene el drenaje.',
    ],
  },
  {
    id: 'special-situations',
    title: 'Situaciones especiales',
    level: 'advanced',
    bullets: [
      'Pacientes con ventilación mecánica: la presión positiva cambia el perfil de riesgo; la guía ecográfica y un operador experimentado importan aún más.',
      'Pacientes anticoagulados o urémicos: individualiza como arriba; la disfunción plaquetaria urémica no se refleja solo en el recuento de plaquetas.',
      'Sospecha de pulmón atrapado/no expansible: aconseja al paciente antes de la punción que el drenaje repetido puede no aliviar los síntomas y que un catéter permanente puede ser la mejor opción.',
    ],
  },
]

const thoracentesisObjectivesZhCn: readonly string[] = [
  '识别安全三角，选择安全且经超声确认的入路窗。',
  '将进针位置与肋间血管风险联系起来，并把出血风险视为个体化的，而非单一的截断值。',
  '解读胸膜测压以区分可复张肺、肺嵌顿（entrapment）和被困肺（trapped）——并知道何时停止引流。',
]

const thoracentesisCoreBlocksZhCn: LearnBlock[] = [
  {
    id: 'triangle-of-safety',
    title: '安全三角与超声窗',
    paragraphs: [
      '经典的安全三角标示出胸壁上肌肉和肺解剖最为宽容的区域。对于现代胸腔穿刺，超声会进一步细化它：你确认一处深度足够的真实积液腔且膈肌在视野内，而不是依赖盲法体表标志。',
    ],
    bullets: [
      '前界：胸大肌外侧缘。',
      '后界：背阔肌外侧缘。',
      '下界：大致为第 5 肋间隙水平（乳头线）；顶点位于腋窝底部。',
      '然后用超声确认：在选择穿刺点前，看到真实的积液腔、足够的深度，以及膈肌和膈下器官。',
    ],
  },
  {
    id: 'vessel-risk-where-to-enter',
    title: '在哪里进针——肋间血管解剖',
    bullets: [
      '神经血管束走行于每根肋骨下缘的肋沟内，因此应紧贴肋骨上缘进针以避开它。',
      '在后方椎旁区（大约距脊柱 6 cm 以内），肋间动脉更为暴露且迂曲——避免后方/内侧穿刺，向外侧扫查以寻找更安全的窗。',
      '在老年患者中，侧支肋间血管可能走行于肋间隙中部，这是更倾向于经超声确认的外侧入路的又一原因。',
      '在整个呼吸周期中保持进针点位于膈肌界线以上，以避开肝脏或脾脏。',
    ],
  },
  {
    id: 'bleeding-risk-individualized',
    title: '出血风险是个体化的',
    paragraphs: [
      '没有单一的 INR 或血小板数值能决定胸膜操作是否安全。现代指南相对宽松：在超声引导和熟练操作者的前提下，许多正在抗凝或有轻度实验室异常的患者都可以安全穿刺，尤其当指征紧迫时。',
    ],
    bullets: [
      '综合权衡指征、紧迫性、超声引导、操作者经验、具体药物及其用药时机，以及当地政策——而非单一的实验室数值。',
      '将纠正措施留给真正高风险的情形；对轻度凝血障碍常规逆转往往没有必要。',
      '使用交互式规划器，看看相同的化验结果如何因整体情况不同而有不同解读。',
    ],
  },
  {
    id: 'manometry-and-pressure',
    title: '胸膜测压：压力告诉你什么',
    paragraphs: [
      '在引流过程中测量胸膜压力，能把盲目的操作变成有据可依的操作。胸膜弹性（每抽出单位体积压力下降的快慢）反映肺是否在复张以填充该空间。压力急剧变负意味着肺跟不上——该空间是靠负压撑开，而不是被肺填满。',
    ],
    bullets: [
      '按症状和压力引流，而不是按固定容量。',
      '若胸膜压力降至约 −20 cm H₂O 以下，或患者出现胸痛或不止的咳嗽，则停止或减缓。',
      '在这样指导下，大容量引流是安全的；旧有的「1–1.5 L 硬性上限」只是经验法则，不能替代症状和压力。',
    ],
  },
  {
    id: 'expandable-entrapped-trapped',
    title: '可复张肺 vs. 肺嵌顿 vs. 被困肺',
    paragraphs: [
      '压力—容量曲线的形状区分了三种情况：它们在单张胸片上看起来相同，但处理方式截然不同。',
    ],
    bullets: [
      '可复张肺：开放压正常，随着液体排出而逐渐下降。肺复张，患者预后良好。',
      '肺嵌顿（部分可复张）：开放压正常/为正，曲线呈双相——压力先缓慢下降，随后在拐点处急剧下降，因为某种活动性病变（常为恶性肿瘤）限制了进一步复张。',
      '被困肺：基线开放压为负，并出现立即、陡峭、单相的下降——慢性纤维板（陈旧脓胸、既往血胸）使肺无法复张。反复穿刺让各方都受挫；优先选择留置胸膜导管。',
    ],
  },
  {
    id: 'stopping-rules',
    title: '何时减缓或停止',
    bullets: [
      '症状优先：新发胸痛、顽固性咳嗽或血管迷走症状都意味着暂停——无论容量多少。',
      '其次是压力：胸膜压力急剧变负（≈ −20 cm H₂O）是停止信号。',
      '不要追求目标容量；目标是缓解症状和获取诊断性液体，而不是排空胸膜腔。',
      '操作后有针对性的超声（肺复张、残余液体、肺滑动以排除气胸）通常比常规胸片更有用。',
    ],
  },
]

const thoracentesisGoDeeperBlocksZhCn: LearnBlock[] = [
  {
    id: 're-expansion-pulmonary-edema',
    title: '复张性肺水肿（RPE）',
    level: 'advanced',
    bullets: [
      '罕见但严重：复张侧肺出现单侧水肿，偶伴低血压。',
      '风险随胸膜压力非常负、快速大量抽液、肺长期塌陷以及一般状况差而升高。',
      '预防即上述测压加症状的方法；治疗为支持性（吸氧、血流动力学支持），并停止引流。',
    ],
  },
  {
    id: 'special-situations',
    title: '特殊情况',
    level: 'advanced',
    bullets: [
      '机械通气患者：正压改变了风险特征；超声引导和经验丰富的操作者更为重要。',
      '抗凝或尿毒症患者：如上个体化处理；尿毒症的血小板功能障碍无法仅凭血小板计数反映。',
      '怀疑被困/不可复张肺：在穿刺前告知患者，反复引流可能无法缓解症状，留置导管可能是更好的选择。',
    ],
  },
]

export function getThoracentesisObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, {
    en: thoracentesisObjectives as readonly string[],
    es: thoracentesisObjectivesEs,
    'zh-CN': thoracentesisObjectivesZhCn,
  })
}

export function getThoracentesisCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: thoracentesisCoreBlocks,
    es: thoracentesisCoreBlocksEs,
    'zh-CN': thoracentesisCoreBlocksZhCn,
  })
}

export function getThoracentesisGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: thoracentesisGoDeeperBlocks,
    es: thoracentesisGoDeeperBlocksEs,
    'zh-CN': thoracentesisGoDeeperBlocksZhCn,
  })
}
