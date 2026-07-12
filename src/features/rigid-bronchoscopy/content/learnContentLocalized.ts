import type { LearnBlock } from '@/features/learning-module/types'

export const rigidObjectivesEs: readonly string[] = [
  'Identificar las cuatro interfaces del cuerpo universal EFER y elegir la vía axial principal o la vía lateral para accesorios para una configuración de instrumentos compatible.',
  'Enunciar las indicaciones y contraindicaciones de la broncoscopia rígida y evaluar la vía aérea.',
  'Comparar la ventilación convencional, espontánea asistida, jet de baja frecuencia y jet de alta frecuencia en la vía aérea compartida, y anticipar fugas, atrapamiento gaseoso y barotrauma.',
  'Describir la desobstrucción mecánica, la dilatación, los stents, la extracción de cuerpos extraños y la hemostasia endobronquial, y aplicar las medidas de seguridad frente a incendios en la vía aérea.',
]

export const rigidCoreBlocksEs: LearnBlock[] = [
  {
    id: 'equipment',
    title: 'Familiarización con el equipo',
    paragraphs: [
      'El broncoscopio rígido es un tubo metálico hueco que establece una vía aérea de gran calibre y sirve como plataforma de trabajo. Este laboratorio modela el cuerpo universal EFER; otros sistemas pueden ubicar y configurar sus puertos de manera diferente.',
    ],
    bullets: [
      'El cuerpo EFER tiene cuatro interfaces distintas: un puerto de trabajo principal horizontal o axial, un puerto lateral más pequeño para accesorios, un puerto lateral más grande para el circuito de anestesia y una conexión fija para ventilación jet.',
      'El puerto axial principal acepta tapas específicas para cada configuración, destinadas al telescopio con pinzas ópticas compatibles, aspiración u otros instrumentos axiales grandes. El puerto más pequeño para accesorios acepta un obturador BB2401 o BB2402 para accesorios delgados compatibles.',
      'Los puertos del circuito de anestesia y de ventilación jet son entradas de ventilación, no vías para instrumentos. La ventilación controlada y la espontánea asistida utilizan el puerto del circuito de anestesia; la ventilación jet utiliza la conexión específica para jet.',
      'El telescopio rígido de lentes en varilla proporciona una imagen ampliada, mientras que el extremo distal biselado del tubo se utiliza para la intubación y la desobstrucción mecánica. El objetivo del telescopio, el bisel del tubo y el extremo del instrumento son referencias distintas.',
      'Adaptadores para modalidades ablativas y hemostáticas: láser Nd:YAG, coagulación con plasma de argón (APC), crioterapia e instrumentos mecánicos.',
    ],
  },
  {
    id: 'indications-contraindications',
    title: 'Indicaciones, contraindicaciones y evaluación de la vía aérea',
    bullets: [
      'Indicaciones: obstrucción central de la vía aérea, maligna o benigna, que requiera desobstrucción mecánica, dilatación o colocación de stent; hemoptisis masiva; extracción de cuerpos extraños grandes o complejos.',
      'Contraindicaciones relativas: inestabilidad de la columna cervical, limitación grave de la apertura bucal o de la movilidad cervical e incapacidad para ventilar u oxigenar.',
      'Evaluar la vía aérea —apertura bucal, dentición, movilidad cervical y nivel y longitud de la obstrucción en las imágenes— y planificar la ventilación antes de comenzar.',
    ],
  },
  {
    id: 'anesthesia-ventilation',
    title: 'Anestesia y ventilación de la vía aérea compartida',
    paragraphs: [
      'La broncoscopia rígida es un procedimiento de vía aérea compartida: el operador y el equipo de anestesia utilizan simultáneamente la misma vía aérea, por lo que la comunicación debe ser continua.',
    ],
    bullets: [
      'La ventilación convencional controlada administra inspiración con presión positiva y recibe el retorno espiratorio a través del puerto grande del circuito de anestesia, con las tapas proximales seleccionadas para los instrumentos selladas. El tubo rígido sin manguito aún puede presentar fugas alrededor de la laringe o en las interfaces proximales.',
      'La ventilación espontánea asistida conserva la inspiración generada por el paciente a través del circuito respiratorio y añade eventos claramente diferenciados de asistencia manual o por presión a través del mismo puerto del circuito de anestesia cuando el esfuerzo resulta insuficiente. No ventila a través del puerto axial principal para instrumentos.',
      'La ventilación jet de baja frecuencia produce pulsos diferenciados y menos frecuentes a través de la conexión fija para jet; la ventilación jet de alta frecuencia produce pulsos más rápidos y pequeños a través de la misma entrada específica. Ambas dependen de una salida pasiva mediante un sistema abierto y requieren monitorización específica del dispositivo.',
      'CHEST sugiere de forma condicional la ventilación jet o la ventilación controlada o espontánea asistida para la broncoscopia rígida terapéutica bajo anestesia general, con una certeza de evidencia muy baja. Por ello, el laboratorio compara las modalidades sin clasificar ninguna como universalmente preferida.',
      'La ventilación jet requiere una vía de salida espiratoria adecuada: aplicar el jet contra una obstrucción distal provoca atrapamiento gaseoso y barotrauma. La oxigenación apneica es un complemento para pausas breves del procedimiento, no un sustituto de la ventilación.',
      'Una lesión con mecanismo de válvula de bola puede permitir la entrada de gas inspirado pero restringir la espiración pasiva, por lo que el volumen distal retenido puede aumentar respiración a respiración. En cambio, una obstrucción fija completa bloquea tanto la inspiración distal como la espiración.',
      'Los tubos bronquiales largos tienen fenestraciones distales que pueden conservar una vía hacia el bronquio principal contralateral solo cuando la profundidad y la rotación alinean correctamente las aberturas. Un tubo bronquial colocado demasiado superficialmente puede dejar las fenestraciones por encima de las cuerdas vocales y producir una fuga importante.',
      'Un tubo traqueal corto sin fenestraciones no ofrece una vía contralateral por fenestraciones después de entrar en un bronquio principal, pero «sin fenestraciones» no significa «sin fugas»: un sistema sin manguito aún puede presentar fugas alrededor de la laringe o por una interfaz proximal sellada de forma incompleta.',
    ],
  },
  {
    id: 'therapeutics',
    title: 'Descripción general de las intervenciones terapéuticas',
    paragraphs: [
      'El broncoscopio rígido es una plataforma para restablecer y mantener una vía aérea central. La mayoría de los procedimientos combinan varias herramientas en una misma sesión.',
    ],
    bullets: [
      'La desobstrucción mecánica del tumor con el bisel rígido y las pinzas puede restablecer rápidamente una luz en una obstrucción endoluminal.',
      'La dilatación y los stents de la vía aérea mantienen abiertas las estenosis extrínsecas o estructurales; los stents se dimensionan para la vía aérea y tienen sus propias complicaciones.',
      'La extracción de cuerpos extraños aprovecha el gran calibre y las pinzas ópticas; la hemostasia endobronquial permite tratar el sangrado de la vía aérea central.',
      'Las modalidades ablativas —láser Nd:YAG para fotocoagulación sin contacto, APC para coagulación sin contacto y crioterapia para adhesión o desvitalización— se eligen según la tarea y el riesgo de incendio en la vía aérea.',
    ],
  },
  {
    id: 'hemostasis',
    title: 'Hemostasia endobronquial en la hemorragia de la vía aérea central',
    bullets: [
      'Proteger primero la vía aérea: colocar el lado sangrante hacia abajo y aislar los pulmones para evitar que la sangre alcance el pulmón contralateral sano.',
      'Aplicar taponamiento con un balón o con el cuerpo rígido y hemostáticos tópicos o farmacológicos, como solución salina fría, epinefrina y ácido tranexámico.',
      'Utilizar APC o láser para una fuente de sangrado visible; escalar a embolización de la arteria bronquial o cirugía cuando falle el control endobronquial.',
    ],
  },
  {
    id: 'fire-safety',
    title: 'Seguridad frente a incendios de la vía aérea en el quirófano',
    paragraphs: [
      'Cualquier dispositivo de energía utilizado en una vía aérea compartida rica en oxígeno supone un riesgo de incendio. La prevención es una responsabilidad compartida entre anestesia y el operador y se basa en la tríada del fuego.',
    ],
    bullets: [
      'La tríada del fuego está formada por un oxidante —oxígeno u óxido nitroso—, una fuente de ignición —láser o electrocirugía— y un combustible —tubo o tejido—; eliminar uno de estos componentes previene el incendio.',
      'Antes de utilizar energía en la vía aérea, reducir la FiO₂ al nivel más bajo tolerado y evitar el óxido nitroso; este es el factor controlable más importante.',
      'Si se produce un incendio: detener la energía, interrumpir los gases, retirar el tubo o el material inflamable y extinguir con solución salina; después, restablecer la ventilación y evaluar posibles lesiones.',
    ],
  },
]

export const rigidGoDeeperBlocksEs: LearnBlock[] = [
  {
    id: 'modality-selection',
    title: 'Elección de una modalidad ablativa',
    level: 'advanced',
    bullets: [
      'Para la hemostasia y la desobstrucción inmediatas, las modalidades térmicas sin contacto —láser Nd:YAG y APC— coagulan mientras tratan; la APC es especialmente adecuada para lesiones superficiales, extensas o sangrantes.',
      'La crioterapia desvitaliza y retira tejido o coágulos por adhesión, pero no proporciona hemostasia inmediata y tiene efectos tisulares tardíos; presenta un bajo riesgo de incendio en la vía aérea.',
      'Toda energía térmica utilizada en la vía aérea está sujeta a la misma disciplina respecto a la FiO₂ y la prevención de incendios.',
    ],
  },
  {
    id: 'stent-considerations',
    title: 'Consideraciones sobre los stents de la vía aérea',
    level: 'advanced',
    bullets: [
      'Los stents alivian la obstrucción, pero pueden migrar, inducir tejido de granulación, obstruirse con secreciones o fracturarse; el dimensionamiento y el seguimiento son importantes.',
      'La decisión de colocar un stent pondera el mecanismo de la obstrucción —intrínseco, extrínseco o mixto— frente a la durabilidad prevista y la vía aérea afectada.',
    ],
  },
]

export const rigidObjectivesZhCn: readonly string[] = [
  '识别 EFER 通用镜筒的四个接口，并为相容的器械配置选择主轴向通道或侧方附件通道。',
  '说明硬质支气管镜检查的适应证和禁忌证，并评估气道。',
  '比较共享气道中的常规控制通气、自主辅助通气、低频喷射通气和高频喷射通气，并预判漏气、气体潴留和气压伤。',
  '描述机械性肿瘤清除、扩张、气道支架、异物取出和支气管内止血，并应用气道防火措施。',
]

export const rigidCoreBlocksZhCn: LearnBlock[] = [
  {
    id: 'equipment',
    title: '设备识别',
    paragraphs: [
      '硬质支气管镜是一根中空金属管，可建立大口径气道并作为操作平台。本实验室模拟 EFER 通用镜筒；其他系统的端口位置和配置可能不同。',
    ],
    bullets: [
      'EFER 镜筒有四个不同的接口：主水平或轴向工作口、较小的侧方附件口、较大的侧方麻醉呼吸回路口，以及固定的喷射通气接口。',
      '主轴向口可安装针对具体配置的密封帽，以容纳观察镜及相容的光学钳、吸引器或其他大型轴向器械。较小的附件口可安装 BB2401 或 BB2402 闭孔器，以容纳相容的细径附件。',
      '麻醉呼吸回路口和喷射通气口是通气入口，不是器械通道。控制通气和自主辅助通气使用麻醉呼吸回路口；喷射通气使用专用喷射接口。',
      '棒状透镜观察镜提供放大视野，而镜管远端的斜面用于插管和机械性肿瘤清除。观察镜物镜、镜管斜面和器械末端是三个不同的定位标志。',
      '消融和止血设备的适配器包括 Nd:YAG 激光、氩等离子体凝固（APC）、冷冻治疗和机械器械。',
    ],
  },
  {
    id: 'indications-contraindications',
    title: '适应证、禁忌证和气道评估',
    bullets: [
      '适应证：需要机械性清除、扩张或置入支架的恶性或良性中央气道阻塞；大咯血；较大或复杂异物的取出。',
      '相对禁忌证：颈椎不稳定、张口或颈部活动严重受限，以及无法维持通气或氧合。',
      '开始前应评估气道，包括张口度、牙列、颈部活动度，以及影像上阻塞的位置和长度，并预先制定通气方案。',
    ],
  },
  {
    id: 'anesthesia-ventilation',
    title: '麻醉与共享气道通气',
    paragraphs: [
      '硬质支气管镜检查是一项共享气道操作：术者和麻醉团队同时使用同一气道，因此必须持续沟通。',
    ],
    bullets: [
      '常规控制通气通过较大的麻醉呼吸回路口输送正压吸气并接受呼气回流，同时需密封所选的近端器械接口。无套囊硬质镜管仍可能在喉部周围或近端接口处漏气。',
      '自主辅助通气保留患者经呼吸回路自主产生的吸气；当自主努力不足时，通过同一个麻醉呼吸回路口给予明确区分的手控或压力辅助。它不通过主轴向器械口进行通气。',
      '低频喷射通气通过固定喷射接口产生间隔较长、彼此分离的脉冲；高频喷射通气通过同一专用入口产生更快、更小的脉冲。两者均依赖开放系统中的被动排气，并需要针对具体设备进行监测。',
      'CHEST 指南有条件地建议，在全身麻醉下进行硬质治疗性支气管镜操作时，可采用喷射通气或控制通气／自主辅助通气，但证据确定性很低。因此，本实验室只比较各种模式，不将任何一种列为普遍首选。',
      '喷射通气必须有充分的呼气排出通路；在远端气道受阻时继续喷射会导致气体潴留和气压伤。无呼吸氧合仅可作为短暂操作暂停时的辅助措施，不能替代通气。',
      '球阀样病变可能允许吸入气体进入，却限制被动呼气，因此远端潴留容量可随每次呼吸逐渐增加。固定性完全阻塞则同时阻断远端吸气和呼气。',
      '长型支气管镜管具有远端侧孔；只有当插入深度和旋转方向均使这些开口正确对准时，才可能保留通向对侧主支气管的路径。支气管镜管放置过浅可使侧孔位于声带上方并造成明显漏气。',
      '短型无侧孔气管镜管进入主支气管后没有通过侧孔通向对侧的路径，但“无侧孔”并不等于“无漏气”：无套囊系统仍可在喉部周围或未完全密封的近端接口处漏气。',
    ],
  },
  {
    id: 'therapeutics',
    title: '治疗操作概述',
    paragraphs: [
      '硬质支气管镜是恢复并维持中央气道通畅的平台。多数病例会在同一次操作中联合使用多种工具。',
    ],
    bullets: [
      '使用硬质镜管斜面和钳进行机械性肿瘤清除，可迅速恢复腔内型阻塞的气道管腔。',
      '扩张和气道支架可撑开外压性或结构性狭窄；支架需根据气道尺寸选择，并有其特有并发症。',
      '异物取出利用大口径通道和光学钳；支气管内止血用于处理中央气道出血。',
      '消融方式包括 Nd:YAG 激光非接触式光凝、APC 非接触式凝固和通过黏附或组织失活起效的冷冻治疗；应根据操作目标和气道火灾风险选择。',
    ],
  },
  {
    id: 'hemostasis',
    title: '中央气道出血的支气管内止血',
    bullets: [
      '首先保护气道：使出血侧朝下并进行肺隔离，防止血液进入对侧相对健康的肺。',
      '使用球囊或硬质镜筒压迫止血，并使用冷盐水、肾上腺素和氨甲环酸等局部或药物止血措施。',
      '对于可见出血点可使用 APC 或激光；若支气管内控制失败，应升级至支气管动脉栓塞或外科治疗。',
    ],
  },
  {
    id: 'fire-safety',
    title: '手术室气道防火安全',
    paragraphs: [
      '在富氧的共享气道中使用任何能量设备都有火灾风险。防火是麻醉团队与术者的共同责任，其基础是火灾三要素。',
    ],
    bullets: [
      '火灾三要素包括氧化剂（氧气或氧化亚氮）、点火源（激光或电外科）和燃料（镜管或组织）；去除其中任何一个要素即可预防火灾。',
      '在气道内使用能量前，应将 FiO₂ 降至患者能够耐受的最低水平并避免使用氧化亚氮；这是最可控的因素。',
      '一旦发生火灾：停止能量输出，停止气体供应，移除镜管或其他可燃材料，并用生理盐水灭火；随后重新建立通气并评估损伤。',
    ],
  },
]

export const rigidGoDeeperBlocksZhCn: LearnBlock[] = [
  {
    id: 'modality-selection',
    title: '选择消融方式',
    level: 'advanced',
    bullets: [
      '需要立即止血和清除阻塞时，Nd:YAG 激光和 APC 等非接触式热消融方式可在治疗同时产生凝固；APC 尤其适合浅表、范围较广或正在出血的病变。',
      '冷冻治疗通过黏附使组织或血凝块失活并将其取出，但不能立即止血，且有延迟性组织效应；其气道火灾风险较低。',
      '所有气道内热能操作都必须遵守相同的 FiO₂ 控制和防火原则。',
    ],
  },
  {
    id: 'stent-considerations',
    title: '气道支架注意事项',
    level: 'advanced',
    bullets: [
      '支架可缓解阻塞，但也可能移位、引起肉芽组织、被分泌物堵塞或发生断裂，因此支架尺寸选择和随访都很重要。',
      '是否置入支架需要权衡阻塞机制（腔内型、外压型或混合型）、预期持久性以及受累气道部位。',
    ],
  },
]
