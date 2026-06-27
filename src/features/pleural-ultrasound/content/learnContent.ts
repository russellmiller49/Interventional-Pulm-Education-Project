import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock, LearnFigure } from '@/features/learning-module/types'

import { getUltrasoundAsset } from './assets'
import { getUltrasoundVideoAsset } from './videoAssets'

/**
 * Didactic content for the Pleural Ultrasound "Learn" section.
 *
 * Core blocks teach everyone how to read the patterns before the Practice lab
 * tests them. Go-deeper blocks (advanced dynamic signs) plus selected board
 * sections render in the collapsible layer. The board section ids below were
 * verified to resolve through the board-review parser; a unit test guards them.
 */

export const ultrasoundBoardSlug = 'pleural-effusions'

export const ultrasoundBoardSectionIds = [
  'thoracentesis-real-time-ultrasound-guided',
  'algorithm-1-new-pleural-effusion-diagnostic-initial-therapeutic-pathway',
  'table-2-thoracentesis-safety-technique-checklist',
  'equipment-setup',
] as const

export const ultrasoundObjectives = [
  'Explain why thoracic ultrasound is the standard of care before pleural procedures.',
  'Classify the four effusion patterns — simple anechoic, complex non-septated, septated/loculated, and echogenic — and state the management implication of each.',
  'Choose a safe access window and recognize sonographic clues to non-expandable lung.',
] as const

function figureFromAsset(id: string, caption: string): LearnFigure | undefined {
  const asset = getUltrasoundAsset(id)
  if (!asset) {
    return undefined
  }
  return {
    src: asset.localPath ?? asset.path,
    alt: 'Pleural ultrasound teaching image',
    caption,
    attribution: asset.attribution,
    sourceUrl: asset.sourceUrl,
    license: asset.license,
  }
}

function videoFromAsset(id: string, caption: string): LearnBlock['media'] | undefined {
  const asset = getUltrasoundVideoAsset(id)
  if (!asset) {
    return undefined
  }

  return {
    kind: 'video',
    src: asset.localPath ?? asset.path,
    type: 'video/mp4',
    label: 'Lung ultrasound teaching clip',
    caption,
    attribution: asset.attribution,
    sourceUrl: asset.sourceUrl,
    license: asset.license,
  }
}

export const ultrasoundCoreBlocks: LearnBlock[] = [
  {
    id: 'why-ultrasound-first',
    title: 'Why ultrasound comes first',
    paragraphs: [
      'Thoracic ultrasound is the standard of care for diagnostic and therapeutic pleural procedures. Compared with landmark-only technique, real-time guidance increases success and reduces complications — fewer pneumothoraces and fewer failed or "dry" taps.',
      'At the bedside it answers three questions: Is there fluid? How large is it and where is the safe pocket to enter? What do the fluid and the underlying lung look like? Ultrasound narrows the procedure plan — it does not, by itself, diagnose the cause. Always pair the image with the clinical story and pleural fluid analysis.',
    ],
  },
  {
    id: 'probe-and-technique',
    title: 'Probe, patient position, and scanning technique',
    paragraphs: [
      'A low-frequency curvilinear probe (roughly 2–5 MHz) gives the depth needed to see the pleural space and diaphragm; a high-frequency linear probe is better for inspecting the pleural line itself and for pneumothorax.',
    ],
    bullets: [
      'Position the patient upright and leaning slightly forward when they can tolerate it; for the unwell or ventilated patient, scan the most dependent zone in a lateral decubitus or supine position.',
      'Scan the posterolateral chest and always identify the diaphragm and the organ beneath it (liver on the right, spleen on the left) to avoid a sub-diaphragmatic puncture.',
      'Enter just above a rib to protect the neurovascular bundle that runs below each rib, and avoid the posterior paravertebral zone where the intercostal artery is most exposed.',
      'Mark and puncture in the same patient position you scanned in — fluid pockets shift when the patient moves.',
    ],
  },
  {
    id: 'four-patterns-overview',
    title: 'The four effusion patterns',
    paragraphs: [
      'Pleural fluid sits on a spectrum from anechoic (black) to densely echogenic, and four named patterns capture most of what you will see. Each one shifts the plan: simple and complex non-septated fluid are usually safe to sample when the pocket is adequate, while septated/loculated and echogenic fluid raise infection, blood, and malignancy — and with them, drainage and source-control questions.',
    ],
  },
  {
    id: 'pattern-simple-anechoic',
    title: 'Pattern 1 — Simple anechoic',
    bullets: [
      'Uniformly black fluid with no internal echoes and no septations.',
      'A simple appearance does NOT prove a transudate — exudate, tuberculosis, and malignancy can all look anechoic. The image never replaces fluid analysis.',
    ],
    figure: figureFromAsset(
      'simple-anechoic-reference',
      'Simple anechoic effusion: a uniformly black pocket without internal echoes or septations.',
    ),
  },
  {
    id: 'pattern-complex-nonseptated',
    title: 'Pattern 2 — Complex non-septated',
    bullets: [
      'Internal echoes or swirling debris, but no discrete septations.',
      'Often still safe to sample when the pocket is accessible; the broader clinical story decides urgency.',
    ],
    figure: figureFromAsset(
      'complex-nonseptated-reference',
      'Complex non-septated effusion: internal echoes within the fluid but no clear fibrin strands.',
    ),
  },
  {
    id: 'pattern-septated',
    title: 'Pattern 3 — Septated / loculated',
    bullets: [
      'Fibrin strands and septations divide the fluid into pockets.',
      'Suggests fibrinous or organizing infection, blood, or malignant complexity — think drainage and source control, and expect simple aspiration to fall short.',
    ],
    figure: figureFromAsset(
      'septated-reference',
      'Septated effusion: fibrin strands partition the fluid into loculated pockets.',
    ),
  },
  {
    id: 'pattern-echogenic',
    title: 'Pattern 4 — Echogenic',
    bullets: [
      'Densely echogenic material — pus, blood, or heavy cellular debris.',
      'Do not treat this as a simple free-flowing effusion; it usually needs a drain and a search for the source.',
    ],
    figure: figureFromAsset(
      'echogenic-reference',
      'Echogenic pleural collection: dense internal echoes consistent with pus, blood, or debris.',
    ),
  },
  {
    id: 'when-ultrasound-changes-the-plan',
    title: 'When ultrasound changes the plan',
    bullets: [
      'Real-time guidance rescues the dry tap and lowers pneumothorax risk — use it for every tap and every tube.',
      'Confirm a safe fluid window of adequate depth between the chest wall and the lung or diaphragm across the whole respiratory cycle, not just at one instant.',
      'Look for clues to non-expandable (trapped) lung — atelectatic lung that does not swirl or re-expand. This changes consent and may favor an indwelling pleural catheter over repeated taps.',
      'A focused post-procedure scan (residual fluid, lung re-expansion, and lung sliding to exclude pneumothorax) is often more actionable than a routine chest X-ray.',
    ],
  },
]

export const ultrasoundGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'dynamic-signs',
    title: 'Dynamic pleural signs (M-mode and real-time)',
    level: 'advanced',
    bullets: [
      'Lung sliding / seashore sign (M-mode): shimmering pleural movement shows the two pleural layers are apposed. Its absence — a "barcode" or "stratosphere" sign instead of the seashore — raises pneumothorax.',
      'Sinusoid sign (M-mode through an effusion): the visceral pleura moves toward the chest wall in inspiration, tracing a sine wave. It marks free-flowing, low-viscosity fluid that should drain readily.',
      'Plankton / swirling sign: floating echogenic particles swirling within the fluid, associated with exudates, empyema, and malignant effusions.',
      'Spine sign: seeing the thoracic vertebrae above the diaphragm (they normally fade as aerated lung scatters the beam) indicates fluid or consolidation has replaced aerated lung.',
      'Curtain sign: aerated lung sweeping down like a curtain over the costophrenic recess in inspiration — a normal finding that marks the lung edge and the limit of a safe window.',
    ],
  },
  {
    id: 'normal-a-lines-video',
    title: 'Video example — normal A-lines',
    level: 'advanced',
    paragraphs: [
      'Use this clip to separate a normal aerated-lung pattern from a pleural-fluid target before committing to a procedure plan.',
    ],
    media: videoFromAsset(
      'dynamic-normal-a-lines',
      'Normal A-lines: horizontal reverberation artifacts beneath a sliding pleural line.',
    ),
  },
  {
    id: 'b-lines-pleural-irregularity-video',
    title: 'Video example — B-lines and pleural irregularity',
    level: 'advanced',
    paragraphs: [
      'This clip is a lung-pattern teaching example. It should steer the learner toward interstitial or pleural-line interpretation, not thoracentesis.',
    ],
    media: videoFromAsset(
      'dynamic-b-lines-pleural-irregularity',
      'B-lines with pleural-line irregularity: a dynamic lung finding rather than a drainable pocket.',
    ),
  },
  {
    id: 'subpleural-consolidation-video',
    title: 'Video example — subpleural consolidation',
    level: 'advanced',
    paragraphs: [
      'Subpleural consolidation can sit right against the pleural line; the teaching move is to verify whether there is a separate fluid window.',
    ],
    media: videoFromAsset(
      'dynamic-subpleural-consolidation',
      'Subpleural consolidation with pleural-line abnormality: keep scanning if the clinical question is drainage.',
    ),
  },
  {
    id: 'lung-curtain-video',
    title: 'Video example — lung curtain / no target',
    level: 'advanced',
    paragraphs: [
      'The lung curtain is a dynamic no-target sign near the diaphragm. It is especially useful when learners are deciding whether a lower-chest view is safe for access.',
    ],
    media: videoFromAsset(
      'dynamic-lung-curtain-no-target',
      'Lung curtain: aerated lung sweeps across the upper abdominal organ rather than revealing a pleural-fluid pocket.',
    ),
  },
  {
    id: 'effusion-adjacent-consolidation-video',
    title: 'Video example — effusion with adjacent consolidation',
    level: 'advanced',
    paragraphs: [
      'This is the bridge between lung-pathology clips and pleural-procedure planning: fluid may be present, but the surrounding context changes what the learner should think about next.',
    ],
    media: videoFromAsset(
      'dynamic-effusion-adjacent-consolidation',
      'Effusion with adjacent consolidation: confirm access-window adequacy and think infection/source control before defaulting to a simple tap.',
    ),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Block ids mirror the English
// source above so module progress and board-section anchors stay aligned; the
// figure/video media (asset paths, attributions) are reused unchanged and only
// the learner-facing prose differs. See docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const ultrasoundObjectivesEs: readonly string[] = [
  'Explicar por qué la ecografía torácica es el estándar de cuidado antes de los procedimientos pleurales.',
  'Clasificar los cuatro patrones de derrame — anecoico simple, complejo no septado, septado/tabicado y ecogénico — y enunciar la implicación de manejo de cada uno.',
  'Elegir una ventana de acceso segura y reconocer las pistas ecográficas del pulmón no expansible.',
]

const ultrasoundCoreBlocksEs: LearnBlock[] = [
  {
    id: 'why-ultrasound-first',
    title: 'Por qué la ecografía va primero',
    paragraphs: [
      'La ecografía torácica es el estándar de cuidado para los procedimientos pleurales diagnósticos y terapéuticos. Comparada con la técnica basada solo en referencias anatómicas, la guía en tiempo real aumenta el éxito y reduce las complicaciones — menos neumotórax y menos punciones fallidas o «secas».',
      'A la cabecera del paciente responde tres preguntas: ¿hay líquido? ¿qué tamaño tiene y dónde está el bolsillo seguro para entrar? ¿qué aspecto tienen el líquido y el pulmón subyacente? La ecografía acota el plan del procedimiento — no diagnostica por sí sola la causa. Acompaña siempre la imagen con la historia clínica y el análisis del líquido pleural.',
    ],
  },
  {
    id: 'probe-and-technique',
    title: 'Sonda, posición del paciente y técnica de exploración',
    paragraphs: [
      'Una sonda convexa de baja frecuencia (aproximadamente 2–5 MHz) da la profundidad necesaria para ver el espacio pleural y el diafragma; una sonda lineal de alta frecuencia es mejor para inspeccionar la propia línea pleural y para el neumotórax.',
    ],
    bullets: [
      'Coloca al paciente sentado e inclinado ligeramente hacia delante cuando lo tolere; en el paciente grave o ventilado, escanea la zona más declive en decúbito lateral o supino.',
      'Escanea el tórax posterolateral e identifica siempre el diafragma y el órgano situado por debajo (el hígado a la derecha, el bazo a la izquierda) para evitar una punción subdiafragmática.',
      'Entra justo por encima de una costilla para proteger el paquete neurovascular que discurre por debajo de cada costilla, y evita la zona paravertebral posterior donde la arteria intercostal está más expuesta.',
      'Marca y punciona en la misma posición del paciente en la que escaneaste — los bolsillos de líquido se desplazan cuando el paciente se mueve.',
    ],
  },
  {
    id: 'four-patterns-overview',
    title: 'Los cuatro patrones de derrame',
    paragraphs: [
      'El líquido pleural se sitúa en un espectro que va de anecoico (negro) a densamente ecogénico, y cuatro patrones con nombre capturan la mayor parte de lo que verás. Cada uno cambia el plan: el líquido simple y el complejo no septado suelen ser seguros de muestrear cuando el bolsillo es adecuado, mientras que el líquido septado/tabicado y el ecogénico hacen pensar en infección, sangre y malignidad — y con ellos, en preguntas de drenaje y control del foco.',
    ],
  },
  {
    id: 'pattern-simple-anechoic',
    title: 'Patrón 1 — Anecoico simple',
    bullets: [
      'Líquido uniformemente negro sin ecos internos ni septos.',
      'Una apariencia simple NO prueba un trasudado — el exudado, la tuberculosis y la malignidad pueden verse todos anecoicos. La imagen nunca sustituye al análisis del líquido.',
    ],
    figure: figureFromAsset(
      'simple-anechoic-reference',
      'Derrame anecoico simple: un bolsillo uniformemente negro sin ecos internos ni septos.',
    ),
  },
  {
    id: 'pattern-complex-nonseptated',
    title: 'Patrón 2 — Complejo no septado',
    bullets: [
      'Ecos internos o detritos en remolino, pero sin septos definidos.',
      'A menudo todavía es seguro muestrear cuando el bolsillo es accesible; la historia clínica más amplia decide la urgencia.',
    ],
    figure: figureFromAsset(
      'complex-nonseptated-reference',
      'Derrame complejo no septado: ecos internos dentro del líquido pero sin bandas de fibrina claras.',
    ),
  },
  {
    id: 'pattern-septated',
    title: 'Patrón 3 — Septado / tabicado',
    bullets: [
      'Bandas de fibrina y septos dividen el líquido en bolsillos.',
      'Sugiere infección fibrinosa u organizada, sangre o complejidad maligna — piensa en drenaje y control del foco, y espera que la simple aspiración se quede corta.',
    ],
    figure: figureFromAsset(
      'septated-reference',
      'Derrame septado: bandas de fibrina dividen el líquido en bolsillos tabicados.',
    ),
  },
  {
    id: 'pattern-echogenic',
    title: 'Patrón 4 — Ecogénico',
    bullets: [
      'Material densamente ecogénico — pus, sangre o abundantes detritos celulares.',
      'No lo trates como un derrame simple de flujo libre; suele necesitar un drenaje y la búsqueda del foco.',
    ],
    figure: figureFromAsset(
      'echogenic-reference',
      'Colección pleural ecogénica: ecos internos densos compatibles con pus, sangre o detritos.',
    ),
  },
  {
    id: 'when-ultrasound-changes-the-plan',
    title: 'Cuándo la ecografía cambia el plan',
    bullets: [
      'La guía en tiempo real rescata la punción seca y reduce el riesgo de neumotórax — úsala en cada punción y cada tubo.',
      'Confirma una ventana de líquido segura con profundidad adecuada entre la pared torácica y el pulmón o el diafragma durante todo el ciclo respiratorio, no solo en un instante.',
      'Busca pistas de pulmón no expansible (atrapado) — pulmón atelectásico que no se arremolina ni se reexpande. Esto cambia el consentimiento y puede favorecer un catéter pleural permanente sobre punciones repetidas.',
      'Una exploración dirigida tras el procedimiento (líquido residual, reexpansión pulmonar y deslizamiento pulmonar para excluir neumotórax) suele ser más accionable que una radiografía de tórax de rutina.',
    ],
  },
]

const ultrasoundGoDeeperBlocksEs: LearnBlock[] = [
  {
    id: 'dynamic-signs',
    title: 'Signos pleurales dinámicos (modo M y tiempo real)',
    level: 'advanced',
    bullets: [
      'Deslizamiento pulmonar / signo de la orilla (modo M): el movimiento pleural centelleante muestra que las dos capas pleurales están en aposición. Su ausencia — un signo de «código de barras» o «estratosfera» en lugar de la orilla — hace pensar en neumotórax.',
      'Signo sinusoide (modo M a través de un derrame): la pleura visceral se mueve hacia la pared torácica en inspiración, trazando una onda sinusoidal. Marca líquido de flujo libre y baja viscosidad que debería drenar con facilidad.',
      'Signo del plancton / remolino: partículas ecogénicas flotantes que se arremolinan dentro del líquido, asociadas a exudados, empiema y derrames malignos.',
      'Signo de la columna: ver las vértebras torácicas por encima del diafragma (normalmente se desvanecen porque el pulmón aireado dispersa el haz) indica que líquido o consolidación han reemplazado al pulmón aireado.',
      'Signo de la cortina: pulmón aireado que baja como una cortina sobre el receso costofrénico en inspiración — un hallazgo normal que marca el borde del pulmón y el límite de una ventana segura.',
    ],
  },
  {
    id: 'normal-a-lines-video',
    title: 'Ejemplo en vídeo — líneas A normales',
    level: 'advanced',
    paragraphs: [
      'Usa este clip para separar un patrón normal de pulmón aireado de un objetivo de líquido pleural antes de comprometerte con un plan de procedimiento.',
    ],
    media: videoFromAsset(
      'dynamic-normal-a-lines',
      'Líneas A normales: artefactos de reverberación horizontales bajo una línea pleural que se desliza.',
    ),
  },
  {
    id: 'b-lines-pleural-irregularity-video',
    title: 'Ejemplo en vídeo — líneas B e irregularidad pleural',
    level: 'advanced',
    paragraphs: [
      'Este clip es un ejemplo didáctico de patrón pulmonar. Debe orientar al estudiante hacia la interpretación intersticial o de la línea pleural, no hacia la toracocentesis.',
    ],
    media: videoFromAsset(
      'dynamic-b-lines-pleural-irregularity',
      'Líneas B con irregularidad de la línea pleural: un hallazgo pulmonar dinámico más que un bolsillo drenable.',
    ),
  },
  {
    id: 'subpleural-consolidation-video',
    title: 'Ejemplo en vídeo — consolidación subpleural',
    level: 'advanced',
    paragraphs: [
      'La consolidación subpleural puede situarse justo contra la línea pleural; la maniobra didáctica es verificar si existe una ventana de líquido separada.',
    ],
    media: videoFromAsset(
      'dynamic-subpleural-consolidation',
      'Consolidación subpleural con anomalía de la línea pleural: sigue escaneando si la pregunta clínica es el drenaje.',
    ),
  },
  {
    id: 'lung-curtain-video',
    title: 'Ejemplo en vídeo — cortina pulmonar / sin objetivo',
    level: 'advanced',
    paragraphs: [
      'La cortina pulmonar es un signo dinámico de ausencia de objetivo cerca del diafragma. Es especialmente útil cuando los estudiantes deciden si una vista del tórax inferior es segura para el acceso.',
    ],
    media: videoFromAsset(
      'dynamic-lung-curtain-no-target',
      'Cortina pulmonar: el pulmón aireado barre sobre el órgano abdominal superior en lugar de revelar un bolsillo de líquido pleural.',
    ),
  },
  {
    id: 'effusion-adjacent-consolidation-video',
    title: 'Ejemplo en vídeo — derrame con consolidación adyacente',
    level: 'advanced',
    paragraphs: [
      'Este es el puente entre los clips de patología pulmonar y la planificación del procedimiento pleural: puede haber líquido, pero el contexto circundante cambia lo que el estudiante debe pensar a continuación.',
    ],
    media: videoFromAsset(
      'dynamic-effusion-adjacent-consolidation',
      'Derrame con consolidación adyacente: confirma la adecuación de la ventana de acceso y piensa en infección/control del foco antes de optar por una punción simple.',
    ),
  },
]

const ultrasoundObjectivesZhCn: readonly string[] = [
  '解释为何胸部超声是胸膜操作前的标准诊疗手段。',
  '对四种积液模式分类——单纯无回声、复杂无分隔、有分隔/包裹以及强回声——并说明各自的处理意义。',
  '选择安全的入路窗，并识别提示不可复张肺的超声线索。',
]

const ultrasoundCoreBlocksZhCn: LearnBlock[] = [
  {
    id: 'why-ultrasound-first',
    title: '为何超声为先',
    paragraphs: [
      '胸部超声是诊断性和治疗性胸膜操作的标准诊疗手段。与仅凭体表标志的技术相比，实时引导能提高成功率并减少并发症——更少的气胸，以及更少的失败或「干」穿刺。',
      '在床旁，它回答三个问题：是否有积液？它有多大、安全的进针腔在哪里？积液和其下的肺看起来如何？超声能缩小操作方案的范围——但单凭它并不能诊断病因。务必将图像与临床病史和胸膜积液分析结合起来。',
    ],
  },
  {
    id: 'probe-and-technique',
    title: '探头、患者体位与扫查技术',
    paragraphs: [
      '低频凸阵探头（大约 2–5 MHz）可提供观察胸膜腔和膈肌所需的深度；高频线阵探头则更适合检查胸膜线本身以及气胸。',
    ],
    bullets: [
      '在患者能耐受时，让其取坐位并略向前倾；对于病重或机械通气的患者，则在侧卧位或仰卧位扫查最低垂的区域。',
      '扫查后外侧胸部，并始终辨认膈肌及其下方的器官（右侧为肝脏，左侧为脾脏），以避免膈下穿刺。',
      '紧贴肋骨上缘进针，以保护走行于每根肋骨下方的神经血管束，并避开肋间动脉最为暴露的后方椎旁区。',
      '在与扫查时相同的患者体位下标记并穿刺——患者移动时积液腔会发生移位。',
    ],
  },
  {
    id: 'four-patterns-overview',
    title: '四种积液模式',
    paragraphs: [
      '胸膜积液处于从无回声（黑）到密集强回声的一个谱系上，四种有名称的模式涵盖了你将见到的大部分情况。每一种都会改变方案：当积液腔足够时，单纯积液和复杂无分隔积液通常可以安全取样，而有分隔/包裹积液和强回声积液则提示感染、血液和恶性病变——并随之带来引流和控制感染源的问题。',
    ],
  },
  {
    id: 'pattern-simple-anechoic',
    title: '模式 1 — 单纯无回声',
    bullets: [
      '均匀的黑色积液，无内部回声，无分隔。',
      '单纯的表现并不能证明是漏出液——渗出液、结核和恶性病变都可能呈无回声。图像永远不能替代积液分析。',
    ],
    figure: figureFromAsset(
      'simple-anechoic-reference',
      '单纯无回声积液：一处均匀的黑色腔，无内部回声或分隔。',
    ),
  },
  {
    id: 'pattern-complex-nonseptated',
    title: '模式 2 — 复杂无分隔',
    bullets: [
      '存在内部回声或翻滚的碎屑，但无明确的分隔。',
      '当积液腔可及时，通常仍可安全取样；更广泛的临床病史决定其紧迫性。',
    ],
    figure: figureFromAsset(
      'complex-nonseptated-reference',
      '复杂无分隔积液：积液内有内部回声，但无清晰的纤维蛋白条索。',
    ),
  },
  {
    id: 'pattern-septated',
    title: '模式 3 — 有分隔 / 包裹',
    bullets: [
      '纤维蛋白条索和分隔将积液分隔成多个腔。',
      '提示纤维素性或机化性感染、血液或恶性复杂性——应考虑引流和控制感染源，并预期单纯抽吸难以奏效。',
    ],
    figure: figureFromAsset('septated-reference', '有分隔积液：纤维蛋白条索将积液分隔成包裹性腔。'),
  },
  {
    id: 'pattern-echogenic',
    title: '模式 4 — 强回声',
    bullets: [
      '密集的强回声物质——脓液、血液或大量细胞碎屑。',
      '不要将其当作单纯的自由流动积液；它通常需要置管并寻找感染源。',
    ],
    figure: figureFromAsset(
      'echogenic-reference',
      '强回声胸膜积聚：密集的内部回声，符合脓液、血液或碎屑。',
    ),
  },
  {
    id: 'when-ultrasound-changes-the-plan',
    title: '超声何时改变方案',
    bullets: [
      '实时引导能挽救干穿刺并降低气胸风险——每一次穿刺和每一次置管都应使用它。',
      '在整个呼吸周期内（而非仅在某一瞬间）确认胸壁与肺或膈肌之间存在一处深度足够的安全积液窗。',
      '寻找不可复张（被困）肺的线索——不翻滚、不复张的肺不张组织。这会改变知情同意，并可能更倾向于留置胸膜导管而非反复穿刺。',
      '操作后有针对性的扫查（残余积液、肺复张以及肺滑动以排除气胸）通常比常规胸片更具可操作性。',
    ],
  },
]

const ultrasoundGoDeeperBlocksZhCn: LearnBlock[] = [
  {
    id: 'dynamic-signs',
    title: '动态胸膜征象（M型与实时）',
    level: 'advanced',
    bullets: [
      '肺滑动 / 海岸征（M型）：闪烁的胸膜运动表明两层胸膜相贴。其消失——出现「条形码」或「平流层」征而非海岸征——提示气胸。',
      '正弦征（穿过积液的 M型）：脏层胸膜在吸气时向胸壁移动，描绘出正弦波。它标志着自由流动、低黏度、应当易于引流的积液。',
      '浮游生物征 / 翻滚征：漂浮的强回声颗粒在积液内翻滚，与渗出液、脓胸和恶性积液相关。',
      '脊柱征：在膈肌上方看到胸椎（正常情况下含气肺会使声束散射而使其消隐）表明积液或实变已取代含气肺。',
      '帘征：吸气时含气肺像帘子一样落下覆盖肋膈隐窝——这是正常表现，标志着肺的边缘以及安全窗的界限。',
    ],
  },
  {
    id: 'normal-a-lines-video',
    title: '视频示例 — 正常 A线',
    level: 'advanced',
    paragraphs: ['在确定操作方案前，用这段视频把正常的含气肺模式与胸膜积液目标区分开来。'],
    media: videoFromAsset('dynamic-normal-a-lines', '正常 A线：在滑动的胸膜线下方的水平混响伪像。'),
  },
  {
    id: 'b-lines-pleural-irregularity-video',
    title: '视频示例 — B线与胸膜不规则',
    level: 'advanced',
    paragraphs: [
      '这段视频是肺部模式的教学示例。它应当引导学习者转向间质或胸膜线的解读，而非胸腔穿刺。',
    ],
    media: videoFromAsset(
      'dynamic-b-lines-pleural-irregularity',
      'B线伴胸膜线不规则：这是一个动态的肺部发现，而非可引流的腔。',
    ),
  },
  {
    id: 'subpleural-consolidation-video',
    title: '视频示例 — 胸膜下实变',
    level: 'advanced',
    paragraphs: ['胸膜下实变可能紧贴胸膜线；教学要点是核实是否存在一处独立的积液窗。'],
    media: videoFromAsset(
      'dynamic-subpleural-consolidation',
      '胸膜下实变伴胸膜线异常：如果临床问题是引流，则继续扫查。',
    ),
  },
  {
    id: 'lung-curtain-video',
    title: '视频示例 — 肺帘征 / 无目标',
    level: 'advanced',
    paragraphs: [
      '肺帘征是膈肌附近一个动态的无目标征象。当学习者在判断下胸部视图是否适合安全入路时，它尤其有用。',
    ],
    media: videoFromAsset(
      'dynamic-lung-curtain-no-target',
      '肺帘征：含气肺扫过上腹部器官，而非显露出胸膜积液腔。',
    ),
  },
  {
    id: 'effusion-adjacent-consolidation-video',
    title: '视频示例 — 积液伴邻近实变',
    level: 'advanced',
    paragraphs: [
      '这是连接肺部病理视频与胸膜操作规划的桥梁：可能存在积液，但周围的背景会改变学习者接下来应当思考的内容。',
    ],
    media: videoFromAsset(
      'dynamic-effusion-adjacent-consolidation',
      '积液伴邻近实变：在默认进行单纯穿刺之前，先确认入路窗是否充分，并考虑感染/控制感染源。',
    ),
  },
]

export function getUltrasoundObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, {
    en: ultrasoundObjectives as readonly string[],
    es: ultrasoundObjectivesEs,
    'zh-CN': ultrasoundObjectivesZhCn,
  })
}

export function getUltrasoundCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: ultrasoundCoreBlocks,
    es: ultrasoundCoreBlocksEs,
    'zh-CN': ultrasoundCoreBlocksZhCn,
  })
}

export function getUltrasoundGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: ultrasoundGoDeeperBlocks,
    es: ultrasoundGoDeeperBlocksEs,
    'zh-CN': ultrasoundGoDeeperBlocksZhCn,
  })
}
