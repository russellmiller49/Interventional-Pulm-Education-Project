import { pickLocaleContent } from '@/i18n/content'
import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Pleural Ultrasound module, aligned to the Learn
 * objectives (why ultrasound first, the four patterns, safe window, dynamic
 * signs). Commit-first: the explanation only appears after the learner answers.
 */
export const ultrasoundQuizQuestions: QuizQuestion[] = [
  {
    prompt:
      'Compared with landmark-only technique, what is the main benefit of real-time ultrasound guidance for thoracentesis?',
    options: [
      'It reliably distinguishes a transudate from an exudate',
      'It reduces pneumothorax and failed ("dry") taps',
      'It removes the need for pleural fluid analysis',
      'It eliminates the need for any post-procedure assessment',
    ],
    answerIndex: 1,
    explanation:
      'Ultrasound is standard of care because real-time guidance increases success and lowers complications — fewer pneumothoraces and dry taps. It does not classify the fluid chemically; that still requires fluid analysis.',
  },
  {
    prompt:
      'A pleural effusion looks uniformly anechoic (black) with no septations. What can you conclude?',
    options: [
      'It is a transudate and needs no further work-up',
      'It is safe to leave undrained regardless of symptoms',
      'A simple appearance does not exclude an exudate, TB, or malignancy',
      'It must be infected because all anechoic fluid is purulent',
    ],
    answerIndex: 2,
    explanation:
      'A simple anechoic appearance is reassuring about access but does not establish the cause. Exudates, tuberculosis, and malignancy can all appear anechoic — pair the image with the clinical story and fluid analysis.',
  },
  {
    prompt: 'Septations and loculations within an effusion should make you think of:',
    options: [
      'A pure transudate from heart failure',
      'Fibrinous/organizing infection, blood, or malignant complexity needing drainage and source control',
      'An artifact that can be ignored',
      'A reason to avoid drainage entirely',
    ],
    answerIndex: 1,
    explanation:
      'Septations suggest fibrin deposition from infection, blood, or malignant involvement. They predict that simple aspiration will fall short and should prompt drainage and source-control thinking.',
  },
  {
    prompt: 'To minimize the risk of intercostal vessel injury, the needle should be inserted:',
    options: [
      'Just below the rib, near the costal groove',
      'Just above the rib, avoiding the posterior paravertebral zone',
      'Anywhere, as long as ultrasound shows fluid',
      'As far posteriorly and medially as possible',
    ],
    answerIndex: 1,
    explanation:
      'The neurovascular bundle runs in the costal groove below each rib, so enter just above the rib. The intercostal artery is most exposed and tortuous in the posterior paravertebral region, which should be avoided.',
  },
  {
    prompt:
      'On M-mode through an effusion you see the visceral pleura move toward the chest wall in inspiration, tracing a sine wave. This sinusoid sign indicates:',
    options: [
      'A pneumothorax',
      'Free-flowing, low-viscosity fluid that should drain readily',
      'A densely loculated empyema',
      'Trapped lung that cannot re-expand',
    ],
    answerIndex: 1,
    explanation:
      'The sinusoid sign reflects respiratory motion of free-flowing fluid and predicts that the effusion will drain readily. Heavily loculated collections lose this sign.',
  },
  {
    prompt:
      'During a focused post-procedure scan, lung sliding is absent and M-mode shows a "barcode" (stratosphere) sign instead of the seashore sign. This suggests:',
    options: ['Normal re-expanded lung', 'A large residual effusion', 'Pneumothorax', 'Hemothorax'],
    answerIndex: 2,
    explanation:
      'Lung sliding (the seashore sign on M-mode) requires apposed, moving pleura. Its loss, with a barcode/stratosphere pattern, raises pneumothorax — a key reason ultrasound can be more actionable than a routine post-tap chest X-ray.',
  },
  {
    prompt:
      'A scan shows B-lines and subpleural consolidation but no discrete fluid pocket. The best interpretation is:',
    options: [
      'This is an ideal thoracentesis target',
      'There is no drainable pleural collection in this view — it is not a thoracentesis target',
      'Drain immediately to prevent empyema',
      'The findings confirm a transudate',
    ],
    answerIndex: 1,
    explanation:
      'B-lines and subpleural consolidation are lung findings, not a pleural fluid pocket. Without a discrete drainable collection there is no safe target; keep scanning or reconsider the clinical question.',
  },
  {
    prompt:
      'Before draining a recurrent effusion, ultrasound shows atelectatic lung that does not swirl or re-expand as fluid is removed. This most likely indicates:',
    options: [
      'A simple effusion that will resolve with one tap',
      'Non-expandable (trapped) lung, which may favor an indwelling catheter over repeated taps',
      'A pneumothorax',
      'That the probe frequency is too low',
    ],
    answerIndex: 1,
    explanation:
      'Lung that fails to re-expand suggests a non-expandable/trapped lung. Recognizing it changes consent and management — repeated large-volume taps are unlikely to help, and an indwelling pleural catheter is often preferred.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. answerIndex values mirror the
// English source so scoring stays correct; only learner-facing text differs.
// ─────────────────────────────────────────────────────────────────────────────

const ultrasoundQuizQuestionsEs: QuizQuestion[] = [
  {
    prompt:
      'En comparación con la técnica basada solo en referencias anatómicas, ¿cuál es el principal beneficio de la guía ecográfica en tiempo real para la toracocentesis?',
    options: [
      'Distingue de forma fiable un trasudado de un exudado',
      'Reduce el neumotórax y las punciones fallidas («secas»)',
      'Elimina la necesidad del análisis del líquido pleural',
      'Elimina la necesidad de cualquier evaluación tras el procedimiento',
    ],
    answerIndex: 1,
    explanation:
      'La ecografía es el estándar de cuidado porque la guía en tiempo real aumenta el éxito y reduce las complicaciones — menos neumotórax y menos punciones secas. No clasifica el líquido químicamente; eso sigue requiriendo análisis del líquido.',
  },
  {
    prompt:
      'Un derrame pleural se ve uniformemente anecoico (negro) sin septos. ¿Qué puedes concluir?',
    options: [
      'Es un trasudado y no necesita más estudio',
      'Es seguro dejarlo sin drenar independientemente de los síntomas',
      'Una apariencia simple no excluye un exudado, TB o malignidad',
      'Debe estar infectado porque todo líquido anecoico es purulento',
    ],
    answerIndex: 2,
    explanation:
      'Una apariencia anecoica simple es tranquilizadora respecto al acceso, pero no establece la causa. Los exudados, la tuberculosis y la malignidad pueden verse todos anecoicos — acompaña la imagen con la historia clínica y el análisis del líquido.',
  },
  {
    prompt: 'Los septos y las tabicaciones dentro de un derrame deben hacerte pensar en:',
    options: [
      'Un trasudado puro por insuficiencia cardíaca',
      'Infección fibrinosa/organizada, sangre o complejidad maligna que requiere drenaje y control del foco',
      'Un artefacto que puede ignorarse',
      'Una razón para evitar el drenaje por completo',
    ],
    answerIndex: 1,
    explanation:
      'Los septos sugieren depósito de fibrina por infección, sangre o afectación maligna. Predicen que la simple aspiración se quedará corta y deben motivar el razonamiento de drenaje y control del foco.',
  },
  {
    prompt:
      'Para minimizar el riesgo de lesión de los vasos intercostales, la aguja debe insertarse:',
    options: [
      'Justo por debajo de la costilla, cerca del surco costal',
      'Justo por encima de la costilla, evitando la zona paravertebral posterior',
      'En cualquier sitio, siempre que la ecografía muestre líquido',
      'Lo más posterior y medial posible',
    ],
    answerIndex: 1,
    explanation:
      'El paquete neurovascular discurre por el surco costal debajo de cada costilla, así que entra justo por encima de la costilla. La arteria intercostal está más expuesta y es más tortuosa en la región paravertebral posterior, que debe evitarse.',
  },
  {
    prompt:
      'En modo M a través de un derrame ves que la pleura visceral se mueve hacia la pared torácica en inspiración, trazando una onda sinusoidal. Este signo sinusoide indica:',
    options: [
      'Un neumotórax',
      'Líquido de flujo libre y baja viscosidad que debería drenar con facilidad',
      'Un empiema densamente tabicado',
      'Pulmón atrapado que no puede reexpandirse',
    ],
    answerIndex: 1,
    explanation:
      'El signo sinusoide refleja el movimiento respiratorio del líquido de flujo libre y predice que el derrame drenará con facilidad. Las colecciones muy tabicadas pierden este signo.',
  },
  {
    prompt:
      'Durante una exploración dirigida tras el procedimiento, el deslizamiento pulmonar está ausente y el modo M muestra un signo de «código de barras» (estratosfera) en lugar del signo de la orilla. Esto sugiere:',
    options: ['Pulmón reexpandido normal', 'Un derrame residual grande', 'Neumotórax', 'Hemotórax'],
    answerIndex: 2,
    explanation:
      'El deslizamiento pulmonar (el signo de la orilla en modo M) requiere pleura en aposición y en movimiento. Su pérdida, con un patrón de código de barras/estratosfera, hace pensar en neumotórax — una razón clave por la que la ecografía puede ser más accionable que una radiografía de tórax de rutina tras la punción.',
  },
  {
    prompt:
      'Una exploración muestra líneas B y consolidación subpleural pero ningún bolsillo de líquido definido. La mejor interpretación es:',
    options: [
      'Es un objetivo ideal de toracocentesis',
      'No hay una colección pleural drenable en esta vista — no es un objetivo de toracocentesis',
      'Drenar de inmediato para prevenir el empiema',
      'Los hallazgos confirman un trasudado',
    ],
    answerIndex: 1,
    explanation:
      'Las líneas B y la consolidación subpleural son hallazgos pulmonares, no un bolsillo de líquido pleural. Sin una colección drenable definida no hay un objetivo seguro; sigue escaneando o reconsidera la pregunta clínica.',
  },
  {
    prompt:
      'Antes de drenar un derrame recurrente, la ecografía muestra pulmón atelectásico que no se arremolina ni se reexpande a medida que se retira el líquido. Esto indica con mayor probabilidad:',
    options: [
      'Un derrame simple que se resolverá con una punción',
      'Pulmón no expansible (atrapado), que puede favorecer un catéter permanente sobre punciones repetidas',
      'Un neumotórax',
      'Que la frecuencia de la sonda es demasiado baja',
    ],
    answerIndex: 1,
    explanation:
      'Un pulmón que no se reexpande sugiere un pulmón no expansible/atrapado. Reconocerlo cambia el consentimiento y el manejo — es improbable que las punciones repetidas de gran volumen ayuden, y a menudo se prefiere un catéter pleural permanente.',
  },
]

const ultrasoundQuizQuestionsZhCn: QuizQuestion[] = [
  {
    prompt: '与仅凭体表标志的技术相比，实时超声引导用于胸腔穿刺的主要益处是什么？',
    options: [
      '它能可靠地区分漏出液与渗出液',
      '它能减少气胸和失败的「干」穿刺',
      '它能免去胸膜积液分析的必要',
      '它能免去任何操作后评估的必要',
    ],
    answerIndex: 1,
    explanation:
      '超声之所以是标准诊疗手段，是因为实时引导能提高成功率并降低并发症——更少的气胸和干穿刺。它并不能在化学层面对积液进行分类；那仍然需要积液分析。',
  },
  {
    prompt: '一处胸膜积液呈均匀无回声（黑色）且无分隔。你能得出什么结论？',
    options: [
      '它是漏出液，无需进一步检查',
      '无论症状如何，都可以安全地不予引流',
      '单纯的表现并不能排除渗出液、TB 或恶性病变',
      '它一定已经感染，因为所有无回声积液都是脓性的',
    ],
    answerIndex: 2,
    explanation:
      '单纯无回声的表现在入路方面令人放心，但并不能确定病因。渗出液、结核和恶性病变都可能呈无回声——应将图像与临床病史和积液分析结合起来。',
  },
  {
    prompt: '积液内的分隔和包裹应当让你想到：',
    options: [
      '心力衰竭导致的单纯漏出液',
      '需要引流和控制感染源的纤维素性/机化性感染、血液或恶性复杂性',
      '一种可以忽略的伪像',
      '完全避免引流的理由',
    ],
    answerIndex: 1,
    explanation:
      '分隔提示感染、血液或恶性受累所致的纤维蛋白沉积。它们预示单纯抽吸将难以奏效，应促使考虑引流和控制感染源。',
  },
  {
    prompt: '为尽量降低肋间血管损伤的风险，进针应当：',
    options: [
      '紧贴肋骨下方，靠近肋沟',
      '紧贴肋骨上方，并避开后方椎旁区',
      '只要超声显示有积液，任何位置均可',
      '尽可能靠后、靠内侧',
    ],
    answerIndex: 1,
    explanation:
      '神经血管束走行于每根肋骨下方的肋沟内，因此应紧贴肋骨上缘进针。肋间动脉在后方椎旁区最为暴露且迂曲，应予避开。',
  },
  {
    prompt:
      '在穿过积液的 M型上，你看到脏层胸膜在吸气时向胸壁移动，描绘出一条正弦波。该正弦征提示：',
    options: ['气胸', '自由流动、低黏度、应当易于引流的积液', '密集包裹的脓胸', '无法复张的被困肺'],
    answerIndex: 1,
    explanation:
      '正弦征反映自由流动积液的呼吸运动，预示该积液将易于引流。严重包裹的积聚会失去此征。',
  },
  {
    prompt:
      '在操作后有针对性的扫查中，肺滑动消失，M型显示「条形码」（平流层）征而非海岸征。这提示：',
    options: ['正常复张的肺', '大量残余积液', '气胸', '血胸'],
    answerIndex: 2,
    explanation:
      '肺滑动（M型上的海岸征）需要相贴且运动的胸膜。其消失并伴有条形码/平流层模式，提示气胸——这是超声可能比常规穿刺后胸片更具可操作性的一个关键原因。',
  },
  {
    prompt: '一次扫查显示 B线和胸膜下实变，但无明确的积液腔。最佳解读是：',
    options: [
      '这是理想的胸腔穿刺目标',
      '此视图中没有可引流的胸膜积聚——它不是胸腔穿刺的目标',
      '立即引流以预防脓胸',
      '这些发现证实为漏出液',
    ],
    answerIndex: 1,
    explanation:
      'B线和胸膜下实变是肺部发现，而非胸膜积液腔。在没有明确可引流积聚的情况下，并不存在安全目标；应继续扫查或重新考虑临床问题。',
  },
  {
    prompt:
      '在引流一处复发性积液之前，超声显示肺不张组织在抽液过程中既不翻滚也不复张。这最可能提示：',
    options: [
      '一处单次穿刺即可消退的单纯积液',
      '不可复张（被困）肺，这可能更倾向于留置导管而非反复穿刺',
      '气胸',
      '探头频率过低',
    ],
    answerIndex: 1,
    explanation:
      '无法复张的肺提示不可复张/被困肺。识别它会改变知情同意和处理——反复大容量穿刺不太可能有帮助，通常更倾向于留置胸膜导管。',
  },
]

export function getUltrasoundQuizQuestions(locale: string): QuizQuestion[] {
  return pickLocaleContent(locale, {
    en: ultrasoundQuizQuestions,
    es: ultrasoundQuizQuestionsEs,
    'zh-CN': ultrasoundQuizQuestionsZhCn,
  })
}
