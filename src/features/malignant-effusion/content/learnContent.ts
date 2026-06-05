import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Malignant Pleural Effusion "Learn" section — taught
 * before the interactive pathway (Practice). Aligns with the engine: cytology
 * sensitivity ~40–60%, escalate after nondiagnostic taps, and lung expansion
 * drives the IPC-vs-pleurodesis branch. Board sections come from the dedicated
 * Indwelling Pleural Catheters and Pleurodesis chapter; a unit test guards them.
 */

export const mpeBoardSlug = 'indwelling-pleural-catheters'

export const mpeBoardSectionIds = [
  'algorithm-a-recurrent-effusion-suspected-mpe',
  'table-1-choosing-ipc-vs-pleurodesis-in-mpe',
  'table-3-talc-pleurodesis-technique-tips',
  'algorithm-b-suspected-ipc-infection-management',
  'table-2-ipc-infection-at-a-glance-management',
  'evidence-outcomes-select-trials-and-themes',
] as const

export const mpeObjectives = [
  'Explain why negative cytology does not rule out malignant pleural effusion, and when to escalate to tissue diagnosis.',
  'Use lung expandability after drainage to choose between pleurodesis and an indwelling pleural catheter (IPC).',
  'Match pleurodesis, IPC, and combined strategies to patient goals, and counsel a patient on IPC care.',
] as const

export const mpeCoreBlocks: LearnBlock[] = [
  {
    id: 'negative-cytology',
    title: 'A negative tap is not a rule-out',
    paragraphs: [
      'Pleural fluid cytology diagnoses many malignant effusions, but its sensitivity is only about 40–60%. A negative result in a patient whose history, imaging, or recurrence keeps malignancy likely is not reassuring — it is a prompt to plan tissue.',
    ],
    bullets: [
      'After one or two nondiagnostic cytology samples with high suspicion, stop cycling fluid-only tests.',
      'Escalate to image-guided pleural biopsy or pleuroscopy, which give higher tissue yield (≈80–90%) and allow same-session poudrage.',
      'Adequate volume and a second sample can help early, but the tissue plan should already be visible when pretest probability is high.',
    ],
  },
  {
    id: 'expandability-decides',
    title: 'Lung expandability decides the path',
    paragraphs: [
      'After a therapeutic drainage, the single most useful question is: did the lung re-expand? Pleurodesis only works when the visceral and parietal pleura can appose, so expandability — not tumor type — drives the definitive-management branch.',
    ],
    bullets: [
      'Full re-expansion → a pleurodesis candidate (talc pleurodesis, IPC, or a combined strategy, by goals and fitness).',
      'Partial re-expansion → favor IPC-centered care or a selected combined/rapid pleurodesis strategy rather than assuming talc alone will work.',
      'Trapped / non-expandable lung → pleurodesis is unlikely to succeed; IPC-centered symptom control is the core pathway.',
    ],
  },
  {
    id: 'talc-pleurodesis',
    title: 'Talc pleurodesis',
    bullets: [
      'Aim: create pleural symphysis so fluid cannot re-accumulate — it needs an expandable lung that apposes the chest wall.',
      'Talc slurry through a chest tube has pleurodesis success similar to talc poudrage at thoracoscopy (TAPPS), so the route can follow logistics and whether you are already scoping.',
      'It is an inpatient, device-free endpoint when it works — attractive for patients who want nothing left on the body.',
    ],
  },
  {
    id: 'ipc',
    title: 'Indwelling pleural catheter (IPC)',
    bullets: [
      'Outpatient, tunneled catheter for home drainage — it controls breathlessness regardless of whether the lung expands, which is why it is the answer for trapped lung.',
      'About half of patients achieve spontaneous (auto-)pleurodesis over weeks and can have the catheter removed; more aggressive drainage schedules speed this up (ASAP).',
      'Counsel on home drainage support, dressing care, and infection recognition before placement.',
    ],
  },
  {
    id: 'ipc-vs-pleurodesis',
    title: 'IPC vs. pleurodesis — and combining them',
    bullets: [
      'IPC: fewer initial hospital days and works with non-expandable lung, but means a device on the body, a drainage routine, and a small infection risk.',
      'Pleurodesis: a device-free chest, but needs an admission and an expandable lung.',
      'Combined IPC + talc (IPC-Plus) increases the chance of pleurodesis while preserving outpatient management — a good option when goals favor both.',
      'There is no universal best choice; the trade-offs are matched to the individual patient.',
    ],
  },
  {
    id: 'patient-goals',
    title: 'Anchor on patient goals',
    paragraphs: [
      'The endpoint of malignant-effusion management is symptom control — usually breathlessness — not an empty pleural space and not endless taps.',
    ],
    bullets: [
      'Ask what matters most: hospital-free days, a device-free chest, speed of relief, home support, expected prognosis, infection burden, and willingness to manage a catheter.',
      'Do not keep tapping a recurrent malignant effusion — commit to a definitive strategy once recurrence is established.',
    ],
  },
]

export const mpeGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'ipc-complications',
    title: 'IPC complications',
    level: 'advanced',
    bullets: [
      'Pleural infection occurs in roughly 5–6% and is often managed with antibiotics without removing the catheter.',
      'Other issues: cellulitis at the site, catheter blockage, symptomatic loculation, and catheter-tract metastasis (notably in mesothelioma).',
    ],
  },
  {
    id: 'the-trials',
    title: 'The trials behind the pathway',
    level: 'advanced',
    bullets: [
      'TIME2 and AMPLE: IPC gives breathlessness control similar to talc with fewer initial hospital days.',
      'IPC-Plus: adding talc through an IPC increases successful pleurodesis versus IPC alone.',
      'ASAP: more aggressive (daily) drainage shortens time to auto-pleurodesis.',
      'TAPPS: talc poudrage and talc slurry achieve similar pleurodesis rates.',
    ],
  },
]
