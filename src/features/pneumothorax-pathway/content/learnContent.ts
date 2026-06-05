import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Pneumothorax "Learn" section — taught before the
 * interactive ACCP-vs-BTS pathway (Practice). Mirrors the dual-framework engine:
 * stability first, then PSP vs SSP, size is not the sole driver, the framework
 * divergence, persistent air leak, and recurrence prevention. Board sections come
 * from the pneumothorax/PAL/BPF chapter; a unit test guards the ids.
 */

export const pneumothoraxBoardSlug = 'pneumothorax-and-pal'

export const pneumothoraxBoardSectionIds = [
  'algorithm-1-adult-spontaneous-pneumothorax-initial-management',
  'algorithm-2-persistent-air-leak-apf-bpf-localization-and-closure',
  'table-1-lung-ultrasound-signs-for-pneumothorax',
  'table-2-distinguishing-apf-vs-bpf-and-implications',
  'table-3-bronchoscopic-options-for-pal-bpf',
] as const

export const pneumothoraxObjectives = [
  'Separate physiologic instability (tension) from stable decision-making.',
  'Distinguish primary from secondary pneumothorax, avoid using size as the sole driver, and compare the ACCP 2001 and BTS 2023 pathways.',
  'Manage a persistent air leak and recognize recurrence-prevention triggers.',
] as const

export const pneumothoraxCoreBlocks: LearnBlock[] = [
  {
    id: 'stability-first',
    title: 'Stability first — is this an emergency?',
    paragraphs: [
      'Before size, before primary-vs-secondary, ask whether the patient is physiologically stable. Tension physiology — hemodynamic compromise or severe hypoxia — is a clinical emergency that needs immediate decompression and drainage no matter how big the pneumothorax looks.',
    ],
    bullets: [
      'Hemodynamic compromise or severe hypoxemia → urgent decompression and a chest drain.',
      'Do not wait for imaging to treat suspected tension pneumothorax.',
      'Only once the patient is stable does the size/symptom/risk decision begin.',
    ],
  },
  {
    id: 'psp-vs-ssp',
    title: 'Primary vs. secondary',
    bullets: [
      'Primary spontaneous pneumothorax (PSP): no clinically apparent lung disease — classically tall, thin, younger smokers.',
      'Secondary spontaneous pneumothorax (SSP): underlying lung disease (COPD, ILD) with far less respiratory reserve.',
      'SSP behaves more dangerously and is generally managed with a chest drain and admission rather than observation.',
      'Ventilated and traumatic pneumothoraces also sit in the higher-risk, monitored-intervention group.',
    ],
  },
  {
    id: 'size-not-sole-driver',
    title: 'Size is not the sole driver',
    paragraphs: [
      'Modern guidance (BTS 2023, ERS/EACTS/ESTS 2024) deliberately de-emphasizes a single size cutoff for stable patients. Symptoms, the type of pneumothorax, patient priorities, and the reliability of follow-up carry the decision.',
    ],
    bullets: [
      'Stable, minimally symptomatic PSP can often be managed conservatively with safety-netting and reliable follow-up.',
      'Intervention options run from observation → needle aspiration → ambulatory device → small-bore chest drain.',
      'Avoid routine suction — it can propagate an air leak; reserve it for specific situations.',
    ],
  },
  {
    id: 'accp-vs-bts',
    title: 'ACCP 2001 vs. BTS 2023 — where they agree and diverge',
    paragraphs: [
      'The two frameworks are the heart of this module. They converge on the things physiology dictates and diverge on the stable, symptomatic primary pneumothorax.',
    ],
    bullets: [
      'They agree on emergencies (tension), on SSP/high-risk context (drain), and broadly on persistent-air-leak escalation.',
      'They diverge on stable symptomatic PSP: ACCP 2001 reacts to size (small → observe, large → aspirate/drain), while BTS 2023 prioritizes symptoms, patient preference, and ambulatory options.',
      'When the two disagree, name what is driving it — size, symptom burden, local ambulatory availability, or risk context.',
    ],
  },
  {
    id: 'persistent-air-leak',
    title: 'The persistent air leak',
    bullets: [
      'A persistent air leak is one that continues beyond roughly 3–5 days after drainage.',
      'First, troubleshoot the drain and circuit (kinks, position, connections) before assuming a true prolonged leak.',
      'Avoid unnecessary suction, and escalate to a specialist in a time-bounded way rather than waiting indefinitely.',
      'Definitive options include bronchoscopic therapies (endobronchial valves, balloon-occlusion mapping) and surgery.',
    ],
  },
  {
    id: 'recurrence-prevention',
    title: 'Recurrence prevention',
    bullets: [
      'Counsel every patient after a first pneumothorax about recurrence risk, smoking cessation, and return precautions.',
      'Offer definitive prevention (pleurodesis or surgery) for recurrence, for secondary pneumothorax, or for high-risk occupations such as aviation and diving.',
      'A high-risk occupation lowers the threshold for a definitive recurrence-prevention discussion even after a first event.',
    ],
  },
]

export const pneumothoraxGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'lung-ultrasound-ptx',
    title: 'Lung ultrasound for pneumothorax',
    level: 'advanced',
    bullets: [
      'Absent lung sliding plus absent B-lines raises pneumothorax; the M-mode "barcode/stratosphere" sign replaces the normal "seashore."',
      'The lung point — where sliding reappears — is highly specific for pneumothorax and helps gauge extent.',
      'Ultrasound is more sensitive than a supine chest X-ray for pneumothorax in the right hands.',
    ],
  },
  {
    id: 'apf-vs-bpf',
    title: 'APF vs. BPF and bronchoscopic closure',
    level: 'advanced',
    bullets: [
      'Alveolar-pleural fistula (APF): a peripheral/distal leak — often amenable to endobronchial valves after balloon-occlusion mapping.',
      'Bronchopleural fistula (BPF): a central, larger-airway communication — higher stakes and harder to close.',
      'Bronchoscopic tools include one-way endobronchial valves, spigots, sealants, and occluders, chosen by leak location and size.',
    ],
  },
]
