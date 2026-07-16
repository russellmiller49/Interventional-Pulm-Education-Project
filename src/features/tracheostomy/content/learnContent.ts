import type { LearnBlock } from '@/features/learning-module/types'
import { pickLocaleContent } from '@/i18n/content'

export interface TracheostomyLearnBlock extends LearnBlock {
  referenceIds: string[]
}

export const tracheostomyObjectives = [
  'Relate upper-airway, laryngeal, tracheal, and neck anatomy to a tracheostomy airway.',
  'Identify tracheostomy tube components and select tube features by function, anatomy, and rescue plan.',
  'Explain cuff, airflow, humidification, suction, communication, and first-shift care principles.',
  'Describe the cognitive sequence for percutaneous dilatational tracheostomy and its confirmation checks.',
  'Recognize blocked, displaced, bleeding, and speaking-valve emergencies and activate the correct local pathway.',
] as const

export const tracheostomyCoreBlocks: TracheostomyLearnBlock[] = [
  {
    id: 'airway-identity',
    title: 'Start with airway identity and anatomy',
    paragraphs: [
      'A tracheostomy creates a stoma into the cervical trachea while usually preserving the larynx and a potentially usable upper airway. This is not the same as a total laryngectomy, where the lungs are separated from the mouth and nose. The bedhead airway plan must state which anatomy is present before an emergency occurs.',
      'For procedural orientation, relate the thyroid cartilage, cricoid, tracheal rings, thyroid isthmus, anterior vessels, skin-to-trachea depth, and the course of the innominate artery. Surface landmarks alone may be misleading in obesity, prior neck intervention, deformity, or tracheal deviation.',
    ],
    figure: {
      kind: 'image',
      src: '/tracheostomy/tracheostomy-hero.png',
      alt: 'Educational cutaway illustration of an adult neck showing a tracheostomy tube entering the anterior trachea below the larynx',
      caption:
        'Orient the stoma and tube to the larynx, tracheal rings, anterior neck, and distal airway before thinking about tube features or rescue paths.',
      attribution: 'Original educational illustration generated for this module',
      license: 'Repository-derived educational asset',
    },
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021', 'mcgrath-ntsp-2012'],
  },
  {
    id: 'tube-components',
    title: 'Know the tube as a system',
    paragraphs: [
      'A tracheostomy tube is more than its shaft. The flange anchors it at the neck; the curved outer cannula establishes the airway; the distal tip sits within the trachea; and a 15-mm connector interfaces with breathing circuits and attachments.',
    ],
    bullets: [
      'An obturator provides a smooth leading surface for insertion and is removed immediately after the tube is seated.',
      'A removable inner cannula narrows the functional internal diameter but can be removed quickly when secretions obstruct it.',
      'A cuff, inflation line, pilot balloon, and one-way inflation valve form one pressure system; the pilot balloon is an indicator, not a substitute for manometry.',
      'Optional features include fenestrations, a subglottic-suction port, specialty speaking lumens, adjustable flanges, and extended proximal or distal lengths.',
    ],
    referenceIds: ['tracheostomy-knowledge-base', 'mitchell-consensus-2013', 'ghattas-pdt-2021'],
  },
  {
    id: 'tube-selection',
    title: 'Select by function, anatomy, and the next rescue',
    paragraphs: [
      'Tube selection starts with the required function, then matches the patient anatomy. A nominal size is not enough: compare inner diameter, outer diameter, length, proximal and distal extension, curvature, cuff dimensions, and the functional inner diameter after an inner cannula is inserted.',
    ],
    bullets: [
      'Cuffed tubes support a seal for positive-pressure ventilation; uncuffed or cuff-deflated configurations permit airflow around the tube when the upper airway is patent.',
      'Dual-cannula tubes add an immediately removable inner cannula; single-cannula tubes maximize lumen but remove that rescue feature.',
      'Proximal extended length addresses increased skin-to-trachea distance; distal extended length may bypass selected tracheal anatomy. Adjustable flanges require a specific securement and depth plan.',
      'Before placement, name the planned tube, the same-size and one-size-smaller rescue tubes, and what will be used if the initial tube does not seat or ventilate.',
    ],
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021', 'mitchell-consensus-2013'],
  },
  {
    id: 'cuff-and-airflow',
    title: 'Cuff state changes the airflow circuit',
    paragraphs: [
      'With the cuff inflated, delivered gas is directed through the tracheostomy tube and lower airway. With the cuff fully deflated, gas may pass around the tube toward the larynx if the upper airway is patent. Cuff inflation does not create a perfect barrier against microaspiration.',
      'Measure cuff pressure with a manometer and follow the local protocol and device instructions. This module uses the commonly taught adult target above 20 and below 30 cm H2O as an educational reference, not a universal bedside order.',
    ],
    bullets: [
      'Recheck cuff pressure after tube manipulation, position changes, transport, or a change in ventilation performance.',
      'Unexpected leak can reflect cuff, pilot system, position, tube-size, or circuit problems; do not repeatedly add air without identifying the cause.',
      'The smallest effective tube and cuff strategy must still meet ventilation, secretion-clearance, airway-protection, communication, and procedural needs.',
    ],
    referenceIds: [
      'tracheostomy-knowledge-base',
      'mitchell-consensus-2013',
      'medrinal-consensus-2026',
    ],
  },
  {
    id: 'communication',
    title: 'Speaking valves require an expiratory exit',
    paragraphs: [
      'A one-way speaking valve allows inspiration through the tracheostomy and redirects expiration around the tube, through the larynx, and out of the mouth and nose. It therefore requires a fully deflated cuff or a cuffless tube and a patent path around the tube and through the upper airway.',
    ],
    bullets: [
      'Never place a one-way speaking valve on an inflated cuff; exhaled gas may have no exit.',
      'Assess alertness, respiratory stability, secretion burden, tube outer diameter, cuff-down tolerance, upper-airway patency, and access to trained staff before a trial.',
      'Remove the valve immediately for distress, absent or inadequate exhalation, increasing work of breathing, desaturation, or intolerance, then reassess the circuit and airway.',
      'Manometry can add objective information, but reported thresholds come from specific pathways and must not be treated as universal pass/fail values.',
    ],
    referenceIds: [
      'tracheostomy-knowledge-base',
      'ntsp-speaking-valve',
      'johnson-manometry-2009',
      'medrinal-consensus-2026',
    ],
  },
  {
    id: 'procedure-selection',
    title: 'Choose the approach before choosing the kit',
    paragraphs: [
      'Percutaneous dilatational tracheostomy is commonly performed at the ICU bedside, while surgical tracheostomy offers direct exposure and may be favored when anatomy, bleeding risk, prior surgery, infection, or an anticipated difficult tract makes open control valuable. Neither technique is automatically best for every patient.',
    ],
    bullets: [
      'Confirm the indication, expected trajectory, goals of care, upper-airway plan, neck anatomy, hemodynamic and ventilatory reserve, coagulation plan, operator expertise, and rescue strategy.',
      'Ultrasound can map midline, tracheal depth, thyroid tissue, and anterior vascular structures; bronchoscopy provides intraluminal confirmation of endotracheal-tube position, needle entry, guidewire direction, posterior-wall safety, and final tube position.',
      'Timing remains individualized. A calendar day alone should not replace assessment of liberation trajectory, reversibility, patient priorities, and anticipated benefit.',
    ],
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021', 'mussa-aarc-2021'],
  },
  {
    id: 'pdt-mental-model',
    title: 'The PDT cognitive sequence',
    paragraphs: [
      'Think of percutaneous dilatational tracheostomy as linked safety gates rather than a memorized kit demonstration: prepare and preoxygenate; position and map anatomy; maintain endotracheal-tube control; enter the trachea in the midline under visualization; keep the guidewire caudad and continuously controlled; dilate; place the tube; prove ventilation and position; then secure and hand off.',
    ],
    bullets: [
      'Stop and re-establish oxygenation if airway control, visualization, wire position, dilation, or ventilation becomes uncertain.',
      'Resistance is information: reassess the tract, wire, introducer, tube size, depth, and anatomy rather than applying unexamined force.',
      'Confirmation is multimodal: waveform capnography, delivered and exhaled volumes, chest movement and breath sounds, cuff behavior, and bronchoscopic visualization of the lumen, tip, and carina relationship.',
    ],
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021'],
  },
  {
    id: 'first-shift-care',
    title: 'The first shift builds the safety system',
    paragraphs: [
      'Immediately after placement, confirm ventilation and tube position, secure the tube, document exactly what was placed and how, and make the airway plan visible. Treat a tract as fresh or immature for at least the first 7 days or until the first planned tube change and local criteria for maturity are met.',
    ],
    bullets: [
      'At the bedside: the same-size and one-size-smaller tubes, obturator, suction, oxygen, bag-mask equipment, an interface for stoma ventilation, spare inner cannula, cuff manometer, and airway-specific signage.',
      'During every move or turn, assign a person to protect the tube and circuit; reassess depth, securement, capnography or ventilation data, and cuff afterward.',
      'Provide active or passive humidification appropriate to the circuit, assess secretions, suction for clinical indications, inspect or exchange the inner cannula, check stoma and skin, and continue oral care and mobility.',
      'Handoff must state whether the upper airway is patent, whether oral intubation is feasible or difficult, who should perform the first change, and the rescue plan for obstruction or displacement.',
    ],
    referenceIds: [
      'tracheostomy-knowledge-base',
      'mussa-aarc-2021',
      'blakeman-aarc-2022',
      'mitchell-consensus-2013',
    ],
  },
  {
    id: 'emergency-patterns',
    title: 'Recognize four time-critical patterns',
    paragraphs: [
      'In every deterioration, summon help early, identify whether the patient has a potentially patent upper airway, apply oxygen to the face and stoma when appropriate, and use waveform capnography when available. Then address the simplest reversible causes in a fixed sequence.',
    ],
    bullets: [
      'Blocked tube: remove the cap, speaking valve, or HME; remove the inner cannula; then attempt to pass a suction catheter. Do not keep ventilating through a tube that may be displaced.',
      'Fresh or immature displacement: prioritize oxygenation from above when the upper airway is patent and avoid blind reinsertion into an unformed tract; experienced replacement should use visualization and the local surgical-airway plan.',
      'Sentinel or pulsatile bleeding: treat as possible tracheo-innominate fistula until proven otherwise. Activate definitive surgical and massive-hemorrhage pathways while trained clinicians use cuff hyperinflation and, if needed, external or advanced digital compression as temporizing maneuvers.',
      'Speaking-valve distress: remove the valve immediately, restore a known patent circuit, and reassess cuff state, tube size, secretions, and upper-airway patency before any retrial.',
    ],
    referenceIds: [
      'tracheostomy-knowledge-base',
      'mcgrath-ntsp-2012',
      'ntsp-emergency-algorithm',
      'ntsp-speaking-valve',
      'allan-tif-2003',
    ],
  },
]

export const tracheostomyAdvancedBlocks: TracheostomyLearnBlock[] = [
  {
    id: 'guidance-tradeoffs',
    title: 'Ultrasound and bronchoscopy answer different questions',
    level: 'advanced',
    paragraphs: [
      'Pre-procedure ultrasound is strongest for external anatomy: midline, skin-to-trachea depth, thyroid isthmus, tracheal deviation, and vessels in the planned path. Bronchoscopy is strongest for intraluminal events: endotracheal-tube withdrawal, midline needle entry, guidewire direction, posterior-wall protection, and final tube position. They are complementary adjuncts, not interchangeable guarantees.',
    ],
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021'],
  },
  {
    id: 'specialty-tubes',
    title: 'Specialty tubes solve a defined problem and create new tradeoffs',
    level: 'advanced',
    bullets: [
      'Fenestration may improve upper-airway flow but requires correct alignment and monitoring for granulation or malposition.',
      'Subglottic-suction tubes add a separate lumen that requires clear identification and protocolized use.',
      'Adjustable-flange and extended-length tubes help match depth or distal anatomy but make documented insertion depth and securement especially important.',
      'Foam cuffs, tight-to-shaft cuffs, talking tubes, metal tubes, and mini-tracheostomy devices have distinct indications and connection limits; confirm the exact device instructions rather than generalizing from a standard cuffed tube.',
    ],
    referenceIds: ['tracheostomy-knowledge-base', 'mitchell-consensus-2013', 'ntsp-speaking-valve'],
  },
  {
    id: 'weaning-decannulation',
    title: 'Weaning and decannulation are protocolized but individualized',
    level: 'advanced',
    paragraphs: [
      'Readiness integrates the original indication, ventilator liberation, cough, secretion burden and suction frequency, swallowing and communication assessment, upper-airway patency, tube tolerance, and the ability to rescue if the tube is removed. Evidence supports multidisciplinary protocols, but there is no universal capping duration, pressure cutoff, or single decannulation score.',
      'A randomized ICU trial found a suction-frequency-based strategy could shorten time to decannulation compared with a 24-hour capping strategy in its study population. Apply that result through a locally approved protocol rather than converting it into a universal bedside rule.',
    ],
    referenceIds: [
      'mussa-aarc-2021',
      'hernandez-decannulation-2020',
      'johnson-manometry-2009',
      'medrinal-consensus-2026',
    ],
  },
]

export function getTracheostomyObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, { en: tracheostomyObjectives as readonly string[] })
}

export function getTracheostomyCoreBlocks(locale: string): TracheostomyLearnBlock[] {
  return pickLocaleContent(locale, { en: tracheostomyCoreBlocks })
}

export function getTracheostomyAdvancedBlocks(locale: string): TracheostomyLearnBlock[] {
  return pickLocaleContent(locale, { en: tracheostomyAdvancedBlocks })
}
