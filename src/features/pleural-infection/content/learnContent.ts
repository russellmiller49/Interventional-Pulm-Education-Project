import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Pleural Infection "Learn" section — taught before the
 * interactive staging workflow (Practice). Thresholds match the staging engine
 * (pH ≤7.2, glucose <60, LDH >1000; pus or positive Gram/culture = empyema).
 * Board sections come from the dedicated `pleural-infections` chapter; a unit
 * test guards that the ids still resolve.
 */

export const infectionBoardSlug = 'pleural-infections'

export const infectionBoardSectionIds = [
  'algorithm-1-initial-evaluation-and-drainage-decision',
  'algorithm-2-escalation-after-tube-placement',
  'table-1-spectrum-of-pleural-infection-defining-features',
  'table-2-empiric-antibiotic-approach',
  'table-3-intrapleural-enzyme-therapy-iet-at-a-glance',
  'table-4-rapid-score-predicts-90-day-mortality',
] as const

export const infectionObjectives = [
  'Stage a parapneumonic effusion (uncomplicated / complicated / empyema) from pH, glucose, LDH, Gram stain or culture, pus, and ultrasound complexity.',
  'Choose antibiotics plus drainage, and know where tPA + DNase, surgery, and the irrigation fallback fit.',
  'Reassess at a checkpoint and escalate, rather than placing a drain and waiting.',
] as const

export const infectionCoreBlocks: LearnBlock[] = [
  {
    id: 'spectrum',
    title: 'The spectrum: simple → complicated → empyema',
    paragraphs: [
      'Pleural infection is a continuum, not three separate diseases. A simple parapneumonic effusion is sterile exudate that resolves with antibiotics; a complicated parapneumonic effusion has crossed into the pleural space enough to need drainage; an empyema is frank pus. The job at the bedside is to place a patient on that continuum quickly, because the further along they are, the more source control matters.',
    ],
    bullets: [
      'Uncomplicated: free-flowing, normal-ish chemistry — antibiotics and close reassessment may suffice.',
      'Complicated: drainage-level chemistry or complex/septated/large fluid — antibiotics plus a drain.',
      'Empyema: frank pus or positive Gram stain/culture — drain and pursue source control early.',
    ],
  },
  {
    id: 'fluid-that-demands-drainage',
    title: 'The fluid that demands drainage',
    paragraphs: [
      'Sample the fluid early and send it to a blood-gas analyzer for pH. The chemistry sorts complicated from uncomplicated; pus or a positive Gram stain settles it without any chemistry at all.',
    ],
    bullets: [
      'Pleural pH ≤ 7.2 is the single strongest chemical indicator for drainage.',
      'Pleural glucose < 60 mg/dL and LDH > 1000 IU/L also point toward a complicated effusion.',
      'Frank pus, or a positive Gram stain or culture, is an empyema — drain regardless of the chemistry.',
      'Complex, septated, or large collections on ultrasound raise the drainage threshold concern even when numbers are borderline.',
    ],
  },
  {
    id: 'antibiotics-and-drainage',
    title: 'Antibiotics plus early drainage',
    bullets: [
      'Start empiric antibiotics promptly and cover anaerobes; tailor to community- versus hospital-acquired risk and local resistance.',
      'For complicated effusions and empyema, place a small-bore image-guided drain — it is better tolerated and usually sufficient.',
      'Antibiotic duration is tailored to source control and response: roughly up to 2 weeks for uncomplicated, longer (often 2–6 weeks) for complicated effusion and empyema.',
      'Send pleural fluid for culture before or with the first antibiotic dose whenever possible.',
    ],
  },
  {
    id: 'tpa-dnase-mist2',
    title: 'When drainage stalls: tPA + DNase (MIST2)',
    paragraphs: [
      'When a drain is in but the collection is not clearing, intrapleural enzyme therapy can break down fibrin and thin pus. The evidence is specific about the combination.',
    ],
    bullets: [
      'Combination tissue plasminogen activator (tPA) + DNase improved radiographic clearance and reduced surgical referral and length of stay in MIST2.',
      'tPA alone did not show the same benefit, and DNase alone is a classic trap — it was not beneficial and may worsen drainage.',
      'Assess bleeding risk and medication timing before giving intrapleural lytics.',
    ],
  },
  {
    id: 'surgery-and-irrigation',
    title: 'Surgery and the irrigation fallback',
    bullets: [
      'Refer for surgery (VATS, sometimes decortication) when the patient fails to improve despite a working drain and enzyme therapy, or when the empyema is organized.',
      'Normal saline pleural irrigation is a selected alternative to discuss when lytic therapy is unsuitable or bleeding risk cannot be mitigated — supported by pilot data, not a universal replacement.',
      'Surgery is a planned escalation, not a rescue of last resort — involve thoracic surgery early in non-responders.',
    ],
  },
  {
    id: 'reassess',
    title: 'Reassess — do not set and forget',
    bullets: [
      'Set a checkpoint (around 48–72 hours): are fever, inflammatory markers, drain output, and imaging all moving the right way?',
      'If progress stalls, walk the escalation chain: confirm the drain works → flush/reimage → intrapleural tPA + DNase → irrigation when suitable → surgical review.',
      'A blocked or malpositioned drain is a common, fixable reason for apparent treatment failure — check it before escalating therapy.',
    ],
  },
]

export const infectionGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'rapid-score',
    title: 'The RAPID score',
    level: 'advanced',
    bullets: [
      'RAPID risk-stratifies pleural infection mortality from five factors: Renal (urea), Age, Purulence of the fluid, Infection source (hospital-acquired is worse), and Dietary status (low albumin).',
      'It helps identify higher-risk patients for closer monitoring and earlier escalation discussions; it does not by itself dictate whether to drain.',
    ],
  },
  {
    id: 'bleeding-and-special',
    title: 'Bleeding risk and intrapleural therapy',
    level: 'advanced',
    bullets: [
      'Intrapleural lytics add bleeding risk; weigh anticoagulation, the specific agent and its timing, and whether it can be safely paused.',
      'When bleeding risk cannot be mitigated, saline irrigation is one of the alternatives to consider rather than forcing lytics.',
    ],
  },
]
