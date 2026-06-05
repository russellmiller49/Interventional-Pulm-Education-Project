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
