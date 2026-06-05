import type { LearnBlock, LearnFigure } from '@/features/learning-module/types'

import { getUltrasoundAsset } from './assets'

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
]
