import { pickLocaleContent } from '@/i18n/content'
import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Thoracentesis module, aligned to the Learn
 * objectives (safe access, vessel risk, bleeding-risk framing, manometry, and
 * stopping rules). Commit-first: explanations appear only after answering.
 */
export const thoracentesisQuizQuestions: QuizQuestion[] = [
  {
    prompt: 'To avoid the intercostal neurovascular bundle, the needle should pass:',
    options: [
      'Just below the rib, in the costal groove',
      'Just above the rib',
      'Through the middle of the interspace, posteriorly',
      'It does not matter if ultrasound shows fluid',
    ],
    answerIndex: 1,
    explanation:
      'The main neurovascular bundle runs in the costal groove on the underside of each rib, so entering just above the rib keeps the needle away from it.',
  },
  {
    prompt: 'Why is a posterior, paravertebral entry (within ~6 cm of the spine) discouraged?',
    options: [
      'The lung is thicker there',
      'The intercostal artery is more exposed and tortuous in that zone',
      'Ultrasound cannot image the posterior chest',
      'The diaphragm is always higher posteriorly',
    ],
    answerIndex: 1,
    explanation:
      'Near the spine the intercostal artery is more exposed and takes a variable, tortuous course, raising bleeding risk. Scanning laterally for a safer window is preferred.',
  },
  {
    prompt:
      'A patient on therapeutic anticoagulation needs a thoracentesis for a symptomatic effusion. The best framing of bleeding risk is:',
    options: [
      'Any anticoagulation is an absolute contraindication',
      'Only the INR matters; if it is under 1.5 proceed',
      'Risk is individualized — weigh indication, urgency, ultrasound guidance, drug/timing, and local policy together',
      'Platelets above 50,000 guarantee safety regardless of other factors',
    ],
    answerIndex: 2,
    explanation:
      'No single lab value decides safety. With ultrasound guidance and a skilled operator, risk is individualized across indication, urgency, the specific drug and its timing, and local policy.',
  },
  {
    prompt: 'During large-volume drainage, the recommended stopping signals are:',
    options: [
      'A fixed volume of exactly 1 liter, always',
      'Symptoms (chest pain, relentless cough) or pleural pressure falling below about −20 cm H₂O',
      'Only when fluid stops flowing completely',
      'When the patient asks how much longer it will take',
    ],
    answerIndex: 1,
    explanation:
      'Drain to symptoms and pressure, not a fixed volume. Stop or slow for chest pain, intractable cough, or a steeply negative pleural pressure (≈ −20 cm H₂O).',
  },
  {
    prompt:
      'Manometry shows a negative baseline opening pressure and an immediate, steep, monophasic pressure drop with minimal fluid removed. This pattern indicates:',
    options: [
      'A normal, fully expandable lung',
      'Trapped lung (a chronic fibrous peel that will not re-expand)',
      'A pneumothorax',
      'Operator error in zeroing the manometer',
    ],
    answerIndex: 1,
    explanation:
      'A negative baseline with an immediate steep monophasic drop is the ex vacuo signature of trapped lung — a chronic restrictive peel. Repeated taps rarely help; an indwelling catheter is often better.',
  },
  {
    prompt:
      'A normal/positive opening pressure with a biphasic curve — gentle decline, then a sharp inflection where pressure falls fast — best fits:',
    options: [
      'Fully expandable lung',
      'Lung entrapment (partial expansion limited by an active process such as malignancy)',
      'Trapped lung',
      'Re-expansion pulmonary edema',
    ],
    answerIndex: 1,
    explanation:
      'A biphasic curve with an inflection point reflects lung entrapment: the lung expands partially before an active process restricts it. This differs from the chronic, monophasic trapped lung.',
  },
  {
    prompt: 'Which combination most increases the risk of re-expansion pulmonary edema?',
    options: [
      'Small-volume drainage of a 2-day-old effusion at near-zero pressure',
      'Rapid removal of a large volume with very negative pleural pressures from a chronically collapsed lung',
      'Stopping early for cough',
      'Using ultrasound guidance',
    ],
    answerIndex: 1,
    explanation:
      'RPE risk rises with rapid large-volume removal, very negative pleural pressures, and lung that has been collapsed a long time. Manometry- and symptom-guided drainage is the main prevention.',
  },
  {
    prompt:
      'Ultrasound and manometry suggest a non-expandable (trapped) lung in a patient with a recurrent effusion. The most appropriate plan is:',
    options: [
      'Schedule weekly large-volume taps indefinitely',
      'Counsel the patient and favor an indwelling pleural catheter over repeated taps',
      'Proceed with talc pleurodesis immediately',
      'Avoid any drainage entirely',
    ],
    answerIndex: 1,
    explanation:
      'A trapped lung will not appose the chest wall, so pleurodesis tends to fail and repeated taps give little durable relief. Counsel the patient and favor an indwelling pleural catheter.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. answerIndex values mirror the
// English source so scoring stays correct; only learner-facing text differs.
// ─────────────────────────────────────────────────────────────────────────────

const thoracentesisQuizQuestionsEs: QuizQuestion[] = [
  {
    prompt: 'Para evitar el paquete neurovascular intercostal, la aguja debe pasar:',
    options: [
      'Justo por debajo de la costilla, en el surco costal',
      'Justo por encima de la costilla',
      'Por la mitad del espacio intercostal, en posición posterior',
      'No importa si la ecografía muestra líquido',
    ],
    answerIndex: 1,
    explanation:
      'El paquete neurovascular principal discurre por el surco costal en la cara inferior de cada costilla, por lo que entrar justo por encima de la costilla mantiene la aguja alejada de él.',
  },
  {
    prompt:
      '¿Por qué se desaconseja una entrada posterior, paravertebral (dentro de ~6 cm de la columna)?',
    options: [
      'El pulmón es más grueso allí',
      'La arteria intercostal está más expuesta y es más tortuosa en esa zona',
      'La ecografía no puede visualizar el tórax posterior',
      'El diafragma siempre está más alto en la parte posterior',
    ],
    answerIndex: 1,
    explanation:
      'Cerca de la columna, la arteria intercostal está más expuesta y sigue un trayecto variable y tortuoso, lo que aumenta el riesgo de sangrado. Se prefiere escanear lateralmente para una ventana más segura.',
  },
  {
    prompt:
      'Un paciente con anticoagulación terapéutica necesita una toracocentesis por un derrame sintomático. El mejor enmarque del riesgo de sangrado es:',
    options: [
      'Cualquier anticoagulación es una contraindicación absoluta',
      'Solo importa el INR; si es menor de 1,5, procede',
      'El riesgo es individualizado — sopesa juntos la indicación, la urgencia, la guía ecográfica, el fármaco/momento y la política local',
      'Las plaquetas por encima de 50.000 garantizan la seguridad independientemente de otros factores',
    ],
    answerIndex: 2,
    explanation:
      'Ningún valor de laboratorio aislado decide la seguridad. Con guía ecográfica y un operador experto, el riesgo se individualiza según la indicación, la urgencia, el fármaco concreto y su momento, y la política local.',
  },
  {
    prompt: 'Durante el drenaje de gran volumen, las señales de detención recomendadas son:',
    options: [
      'Un volumen fijo de exactamente 1 litro, siempre',
      'Síntomas (dolor torácico, tos persistente) o presión pleural que cae por debajo de unos −20 cm H₂O',
      'Solo cuando el líquido deja de fluir por completo',
      'Cuando el paciente pregunta cuánto más va a tardar',
    ],
    answerIndex: 1,
    explanation:
      'Drena según los síntomas y la presión, no según un volumen fijo. Detente o reduce ante dolor torácico, tos intratable o una presión pleural muy negativa (≈ −20 cm H₂O).',
  },
  {
    prompt:
      'La manometría muestra una presión de apertura basal negativa y una caída de presión inmediata, pronunciada y monofásica con una extracción mínima de líquido. Este patrón indica:',
    options: [
      'Un pulmón normal, totalmente expansible',
      'Pulmón atrapado (una corteza fibrosa crónica que no se reexpande)',
      'Un neumotórax',
      'Error del operador al poner a cero el manómetro',
    ],
    answerIndex: 1,
    explanation:
      'Una basal negativa con una caída monofásica inmediata y pronunciada es la firma ex vacuo del pulmón atrapado — una corteza restrictiva crónica. Las punciones repetidas rara vez ayudan; a menudo es mejor un catéter permanente.',
  },
  {
    prompt:
      'Una presión de apertura normal/positiva con una curva bifásica — descenso suave y luego una inflexión brusca donde la presión cae rápido — corresponde mejor a:',
    options: [
      'Pulmón totalmente expansible',
      'Atrapamiento pulmonar (expansión parcial limitada por un proceso activo como la malignidad)',
      'Pulmón atrapado',
      'Edema pulmonar por reexpansión',
    ],
    answerIndex: 1,
    explanation:
      'Una curva bifásica con un punto de inflexión refleja atrapamiento pulmonar: el pulmón se expande parcialmente antes de que un proceso activo lo restrinja. Esto difiere del pulmón atrapado crónico y monofásico.',
  },
  {
    prompt: '¿Qué combinación aumenta más el riesgo de edema pulmonar por reexpansión?',
    options: [
      'Drenaje de pequeño volumen de un derrame de 2 días a una presión casi nula',
      'Extracción rápida de un gran volumen con presiones pleurales muy negativas de un pulmón colapsado crónicamente',
      'Detenerse pronto por la tos',
      'Usar guía ecográfica',
    ],
    answerIndex: 1,
    explanation:
      'El riesgo de EPR aumenta con la extracción rápida de gran volumen, presiones pleurales muy negativas y un pulmón colapsado durante mucho tiempo. El drenaje guiado por manometría y síntomas es la principal prevención.',
  },
  {
    prompt:
      'La ecografía y la manometría sugieren un pulmón no expansible (atrapado) en un paciente con un derrame recurrente. El plan más apropiado es:',
    options: [
      'Programar punciones de gran volumen semanales de forma indefinida',
      'Aconsejar al paciente y preferir un catéter pleural permanente en lugar de punciones repetidas',
      'Proceder de inmediato con pleurodesis con talco',
      'Evitar por completo cualquier drenaje',
    ],
    answerIndex: 1,
    explanation:
      'Un pulmón atrapado no se apone a la pared torácica, por lo que la pleurodesis tiende a fallar y las punciones repetidas ofrecen poco alivio duradero. Aconseja al paciente y prefiere un catéter pleural permanente.',
  },
]

const thoracentesisQuizQuestionsZhCn: QuizQuestion[] = [
  {
    prompt: '为避开肋间神经血管束，进针应当：',
    options: [
      '紧贴肋骨下方，在肋沟内',
      '紧贴肋骨上方',
      '从肋间隙中部、偏后方穿过',
      '只要超声显示有积液，进针位置无所谓',
    ],
    answerIndex: 1,
    explanation: '主要的神经血管束走行于每根肋骨下缘的肋沟内，因此紧贴肋骨上缘进针可使针远离它。',
  },
  {
    prompt: '为什么不建议采用后方椎旁入路（距脊柱约 6 cm 以内）？',
    options: [
      '那里的肺更厚',
      '该区域的肋间动脉更暴露且更迂曲',
      '超声无法成像后胸部',
      '后方的膈肌总是更高',
    ],
    answerIndex: 1,
    explanation:
      '在脊柱附近，肋间动脉更暴露且走行多变、迂曲，增加出血风险。更建议向外侧扫查以获得更安全的窗。',
  },
  {
    prompt: '一名接受治疗性抗凝的患者因有症状的胸腔积液需要胸腔穿刺。对出血风险最恰当的判断是：',
    options: [
      '任何抗凝都是绝对禁忌证',
      '只有 INR 重要；若低于 1.5 即可进行',
      '风险是个体化的——综合权衡指征、紧迫性、超声引导、药物/时机和当地政策',
      '血小板高于 50,000 即可保证安全，与其他因素无关',
    ],
    answerIndex: 2,
    explanation:
      '没有单一的化验值能决定安全性。在超声引导和熟练操作者的前提下，风险应结合指征、紧迫性、具体药物及其时机以及当地政策来个体化判断。',
  },
  {
    prompt: '在大容量引流过程中，推荐的停止信号是：',
    options: [
      '始终以恰好 1 升的固定容量为准',
      '症状（胸痛、不止的咳嗽）或胸膜压力降至约 −20 cm H₂O 以下',
      '仅当液体完全停止流出时',
      '当患者询问还要多久时',
    ],
    answerIndex: 1,
    explanation:
      '按症状和压力引流，而非固定容量。出现胸痛、顽固性咳嗽或胸膜压力急剧变负（≈ −20 cm H₂O）时应停止或减缓。',
  },
  {
    prompt:
      '测压显示基线开放压为负，且在抽出极少液体时即出现立即、陡峭、单相的压力下降。该模式提示：',
    options: [
      '正常、完全可复张的肺',
      '被困肺（无法复张的慢性纤维板）',
      '气胸',
      '操作者在测压计归零时出错',
    ],
    answerIndex: 1,
    explanation:
      '基线为负且出现立即、陡峭、单相的下降，是被困肺的「真空（ex vacuo）」特征——一种慢性限制性纤维板。反复穿刺很少有帮助；留置导管往往更好。',
  },
  {
    prompt: '开放压正常/为正且曲线呈双相——先缓慢下降，随后在拐点处压力快速下降——最符合：',
    options: [
      '完全可复张的肺',
      '肺嵌顿（部分复张，受恶性肿瘤等活动性病变限制）',
      '被困肺',
      '复张性肺水肿',
    ],
    answerIndex: 1,
    explanation:
      '带拐点的双相曲线反映肺嵌顿：肺先部分复张，随后被某种活动性病变限制。这与慢性、单相的被困肺不同。',
  },
  {
    prompt: '哪种组合最会增加复张性肺水肿的风险？',
    options: [
      '在接近零的压力下，对 2 天的积液进行小容量引流',
      '从慢性塌陷的肺中以非常负的胸膜压力快速抽出大量液体',
      '因咳嗽而提早停止',
      '使用超声引导',
    ],
    answerIndex: 1,
    explanation:
      'RPE 风险随快速大量抽液、非常负的胸膜压力以及肺长期塌陷而升高。以测压和症状为指导的引流是主要的预防手段。',
  },
  {
    prompt: '在一名复发性胸腔积液患者中，超声和测压提示不可复张（被困）肺。最恰当的方案是：',
    options: [
      '无限期地每周安排大容量穿刺',
      '与患者沟通，优先选择留置胸膜导管而非反复穿刺',
      '立即进行滑石粉胸膜固定术',
      '完全避免任何引流',
    ],
    answerIndex: 1,
    explanation:
      '被困肺无法贴合胸壁，因此胸膜固定术往往失败，反复穿刺也几乎不能带来持久缓解。应与患者沟通，优先选择留置胸膜导管。',
  },
]

export function getThoracentesisQuizQuestions(locale: string): QuizQuestion[] {
  return pickLocaleContent(locale, {
    en: thoracentesisQuizQuestions,
    es: thoracentesisQuizQuestionsEs,
    'zh-CN': thoracentesisQuizQuestionsZhCn,
  })
}
