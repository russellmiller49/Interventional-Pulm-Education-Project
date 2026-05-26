import type { PleuralSection } from '@/features/pleural-procedures/content/types'

export interface PretestItem {
  id: string
  stem: string
  options: { id: string; text: string }[]
  correctId: string
  explanation: string
  section: PleuralSection
  difficulty: 1 | 2 | 3
  referenceIds: string[]
  lastReviewed: string
  reviewer: string
}

const optionSet = {
  sample: [
    {
      id: 'a',
      text: 'Observe or treat the systemic cause when the story is classic and low risk.',
    },
    { id: 'b', text: 'Repeat blind thoracentesis until fluid is obtained.' },
    { id: 'c', text: 'Escalate to pleuroscopy before ultrasound.' },
    { id: 'd', text: 'Start suction as the diagnostic maneuver.' },
  ],
  ultrasound: [
    { id: 'a', text: 'Simple anechoic fluid can still be an exudate.' },
    { id: 'b', text: 'Anechoic fluid excludes infection and malignancy.' },
    { id: 'c', text: 'Septations prove a transudate.' },
    { id: 'd', text: 'Ultrasound is only useful after a failed tap.' },
  ],
  drainage: [
    { id: 'a', text: 'Use small-bore image-guided drainage when appropriate and reassess early.' },
    { id: 'b', text: 'Use a large-bore drain for every pleural infection.' },
    { id: 'c', text: 'Wait for final cultures before draining pus.' },
    { id: 'd', text: 'Use DNase alone when bleeding risk is high.' },
  ],
  mpe: [
    {
      id: 'a',
      text: 'Match IPC, pleurodesis, or combined approaches to lung expansion and goals.',
    },
    { id: 'b', text: 'Use pleurodesis even when the lung is trapped.' },
    { id: 'c', text: 'Keep repeating cytology indefinitely.' },
    { id: 'd', text: 'Avoid discussing home drainage preferences.' },
  ],
}

export const pretestItems: readonly PretestItem[] = [
  {
    id: 'anatomy-pleural-window',
    stem: 'A learner is choosing an access site for thoracentesis. Which concept best fits pleural access anatomy?',
    options: optionSet.sample,
    correctId: 'a',
    explanation:
      'Pleural access starts with ultrasound-confirmed pocket, rib-space anatomy, patient position, and risk assessment rather than a fixed blind site.',
    section: 'anatomy',
    difficulty: 1,
    referenceIds: ['bts-procedures-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'anatomy-intercostal-vessels',
    stem: 'The safest needle path avoids which anatomy-related pitfall?',
    options: [
      { id: 'a', text: 'A posterior/medial path near tortuous intercostal vessels.' },
      { id: 'b', text: 'A lateral ultrasound-confirmed pocket.' },
      { id: 'c', text: 'A visible diaphragm boundary.' },
      { id: 'd', text: 'A rib-space scan before local anesthesia.' },
    ],
    correctId: 'a',
    explanation:
      'The intercostal vessel course is more vulnerable posteriorly and medially; safe teaching emphasizes lateral planning and ultrasound confirmation.',
    section: 'anatomy',
    difficulty: 2,
    referenceIds: ['bts-procedures-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'ultrasound-anechoic',
    stem: 'A pleural effusion is simple anechoic on ultrasound. What should the learner remember?',
    options: optionSet.ultrasound,
    correctId: 'a',
    explanation:
      'A simple anechoic pattern can be transudative or exudative; the clinical context still matters.',
    section: 'ultrasound',
    difficulty: 1,
    referenceIds: ['bts-pleural-2023', 'creative-commons-catalog'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'ultrasound-septated',
    stem: 'A septated or echogenic effusion most strongly changes the management frame toward what?',
    options: [
      {
        id: 'a',
        text: 'Drainage/source-control thinking when infection, blood, or malignancy fits.',
      },
      { id: 'b', text: 'Automatic discharge without sampling.' },
      { id: 'c', text: 'Light criteria no longer matter.' },
      { id: 'd', text: 'Pleurodesis before diagnosis.' },
    ],
    correctId: 'a',
    explanation:
      'Complex, septated, or echogenic fluid should push learners to integrate infection, hemothorax, malignancy, and drainage needs.',
    section: 'ultrasound',
    difficulty: 2,
    referenceIds: ['bts-pleural-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'fluid-lights',
    stem: 'What is the most defensible role of Light criteria?',
    options: [
      { id: 'a', text: 'First-pass exudate classification that must be reconciled with context.' },
      { id: 'b', text: 'A final diagnosis.' },
      { id: 'c', text: 'A replacement for ultrasound.' },
      { id: 'd', text: 'A rule that excludes malignancy when negative.' },
    ],
    correctId: 'a',
    explanation:
      'Light criteria are a high-sensitivity classification step, but pseudoexudates and high-risk clinical contexts require reconciliation.',
    section: 'fluid',
    difficulty: 1,
    referenceIds: ['light-2001'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'fluid-pseudoexudate',
    stem: 'A diuresed heart-failure patient crosses Light criteria by a small margin. What should happen next?',
    options: [
      {
        id: 'a',
        text: 'Check gradients and natriuretic peptide context before anchoring on exudate.',
      },
      { id: 'b', text: 'Diagnose empyema.' },
      { id: 'c', text: 'Place an IPC immediately.' },
      { id: 'd', text: 'Ignore paired serum studies.' },
    ],
    correctId: 'a',
    explanation:
      'Diuresis can concentrate pleural fluid and create a pseudoexudate; the module teaches reconciliation rather than reflex escalation.',
    section: 'fluid',
    difficulty: 2,
    referenceIds: ['light-2001'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'fluid-bloody',
    stem: 'Grossly bloody pleural fluid should trigger which targeted test?',
    options: [
      { id: 'a', text: 'Pleural hematocrit compared with blood hematocrit.' },
      { id: 'b', text: 'Only repeat LDH.' },
      { id: 'c', text: 'No additional branch.' },
      { id: 'd', text: 'Immediate talc poudrage.' },
    ],
    correctId: 'a',
    explanation:
      'Bloody fluid can have many causes; hematocrit ratio distinguishes hemothorax physiology from nonspecific blood staining.',
    section: 'fluid',
    difficulty: 2,
    referenceIds: ['bts-pleural-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'thoracentesis-ultrasound',
    stem: 'Which safety habit belongs in every thoracentesis plan?',
    options: [
      { id: 'a', text: 'Use ultrasound to define pocket, depth, diaphragm, and safe trajectory.' },
      { id: 'b', text: 'Use blind posterior access.' },
      { id: 'c', text: 'Use suction first for all effusions.' },
      { id: 'd', text: 'Skip reassessment if no fluid returns.' },
    ],
    correctId: 'a',
    explanation:
      'Thoracic ultrasound improves success and reduces complications by defining a real-time safe window.',
    section: 'thoracentesis',
    difficulty: 1,
    referenceIds: ['bts-procedures-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'thoracentesis-manometry-stop',
    stem: 'During large-volume drainage the patient develops pleuritic pain and persistent cough with markedly negative pressure. Best teaching response?',
    options: [
      { id: 'a', text: 'Stop or slow drainage and reassess symptoms and pressure.' },
      { id: 'b', text: 'Continue to drain the planned volume no matter what.' },
      { id: 'c', text: 'Apply high suction.' },
      { id: 'd', text: 'Ignore symptoms if oxygenation is normal.' },
    ],
    correctId: 'a',
    explanation:
      'Symptom-limited or manometry-guided drainage teaches prevention of excessive negative pressure and re-expansion risk.',
    section: 'thoracentesis',
    difficulty: 2,
    referenceIds: ['feller-kopman-manometry-2006', 'bts-procedures-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'chest-tube-water-seal',
    stem: 'What is the point of a water seal in chest drainage?',
    options: [
      { id: 'a', text: 'Permit egress while preventing retrograde air movement.' },
      { id: 'b', text: 'Guarantee no ongoing leak.' },
      { id: 'c', text: 'Replace patient assessment.' },
      { id: 'd', text: 'Measure cytology yield.' },
    ],
    correctId: 'a',
    explanation:
      'Chest drainage education should frame the system as pressure management with interpretable feedback.',
    section: 'chest-tube',
    difficulty: 1,
    referenceIds: ['bts-procedures-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'chest-tube-troubleshoot',
    stem: 'A drain stops tidaling. What should the learner do first?',
    options: [
      { id: 'a', text: 'Assess the patient and system before declaring the tube blocked.' },
      { id: 'b', text: 'Clamp and leave.' },
      { id: 'c', text: 'Remove the tube immediately.' },
      { id: 'd', text: 'Increase suction without assessment.' },
    ],
    correctId: 'a',
    explanation:
      'Troubleshooting begins with patient state, then tube, drainage unit, suction source, and disease physiology.',
    section: 'chest-tube',
    difficulty: 1,
    referenceIds: ['bts-procedures-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'infection-ph',
    stem: 'A pneumonia-associated effusion has pleural pH 7.18. What is the high-yield management implication?',
    options: optionSet.drainage,
    correctId: 'a',
    explanation:
      'Low pH in pleural infection is a drainage-level signal when technically safe and clinically appropriate.',
    section: 'infection',
    difficulty: 2,
    referenceIds: ['bts-pleural-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'infection-lytics',
    stem: 'After tube drainage, residual loculated pleural infection persists. Which intrapleural regimen has the strongest trial teaching signal?',
    options: [
      { id: 'a', text: 'tPA plus DNase together.' },
      { id: 'b', text: 'DNase alone.' },
      { id: 'c', text: 'tPA alone as the preferred approach.' },
      { id: 'd', text: 'No reassessment for a week.' },
    ],
    correctId: 'a',
    explanation:
      'MIST2 supports combination therapy directionally; monotherapy is a teaching trap.',
    section: 'infection',
    difficulty: 2,
    referenceIds: ['mist2-2011'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'infection-anticoag',
    stem: 'A patient with pleural infection cannot safely pause therapeutic anticoagulation. What should the teaching pathway include?',
    options: [
      {
        id: 'a',
        text: 'Bleeding-risk mitigation, reduced-dose lytic consideration, or irrigation alternative.',
      },
      { id: 'b', text: 'Full-dose lytic without discussion.' },
      { id: 'c', text: 'DNase monotherapy.' },
      { id: 'd', text: 'No drainage if fluid is purulent.' },
    ],
    correctId: 'a',
    explanation:
      'The infection module should explicitly teach anticoagulation as a risk modifier rather than a one-size-fits-all prohibition.',
    section: 'infection',
    difficulty: 3,
    referenceIds: ['bts-pleural-2023', 'pit-2015', 'mist2-2011'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'pneumothorax-size',
    stem: 'In current pneumothorax teaching, what should not be the only decision driver?',
    options: [
      { id: 'a', text: 'Size alone.' },
      { id: 'b', text: 'Hemodynamic compromise.' },
      { id: 'c', text: 'Severe hypoxemia.' },
      { id: 'd', text: 'Underlying lung disease.' },
    ],
    correctId: 'a',
    explanation:
      'Modern pneumothorax teaching emphasizes stability, symptoms, PSP/SSP, risk, and setting rather than size alone.',
    section: 'pneumothorax',
    difficulty: 1,
    referenceIds: ['bts-pleural-2023', 'ers-eacts-ests-2024'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'pneumothorax-pal',
    stem: 'A persistent air leak remains after several days of drainage. What should the pathway emphasize?',
    options: [
      {
        id: 'a',
        text: 'Check tube/system patency, minimize unnecessary suction, and escalate if prolonged.',
      },
      { id: 'b', text: 'Clamp continuously.' },
      { id: 'c', text: 'Ignore because all leaks close.' },
      { id: 'd', text: 'Use pleurodesis before confirming lung expansion.' },
    ],
    correctId: 'a',
    explanation:
      'Persistent air leak teaching combines system checks, water-seal strategy, time-bounded escalation, and recurrence prevention.',
    section: 'pneumothorax',
    difficulty: 2,
    referenceIds: ['ers-eacts-ests-2024', 'bts-pleural-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'malignant-trapped',
    stem: 'A patient with recurrent symptomatic MPE has non-expandable lung after drainage. Best pathway frame?',
    options: optionSet.mpe,
    correctId: 'a',
    explanation:
      'Non-expandable lung makes pleurodesis less likely to succeed; IPC-centered symptom control is usually the teaching branch.',
    section: 'malignant',
    difficulty: 2,
    referenceIds: ['mpe-ats-sts-str-2018', 'time2-2012', 'ample-2017'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'malignant-cytology',
    stem: 'Cytology has been nondiagnostic twice but imaging still strongly suggests pleural malignancy. What should the module teach?',
    options: [
      { id: 'a', text: 'Stop fluid-only cycling and escalate toward pleural tissue diagnosis.' },
      { id: 'b', text: 'Repeat cytology indefinitely.' },
      { id: 'c', text: 'Declare malignancy excluded.' },
      { id: 'd', text: 'Avoid discussing biopsy.' },
    ],
    correctId: 'a',
    explanation:
      'Repeated nondiagnostic fluid tests should not delay tissue strategy when pretest probability remains high.',
    section: 'malignant',
    difficulty: 2,
    referenceIds: ['mpe-ats-sts-str-2018', 'bts-pleural-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'malignant-rapid-pleurodesis',
    stem: 'Which combined MPE strategy preserves outpatient control while trying to increase pleurodesis success?',
    options: [
      { id: 'a', text: 'IPC-centered pathway with selected talc/rapid pleurodesis approach.' },
      { id: 'b', text: 'Daily blind taps.' },
      { id: 'c', text: 'Suction-only strategy.' },
      { id: 'd', text: 'Pleurodesis despite trapped lung.' },
    ],
    correctId: 'a',
    explanation:
      'Selected combined IPC/talc strategies can increase pleurodesis while preserving patient-centered outpatient management.',
    section: 'malignant',
    difficulty: 3,
    referenceIds: ['ipc-plus-2018', 'tapps-2020', 'asap-2017'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'outpatient-two-tap',
    stem: 'In an outpatient pleural clinic, two nondiagnostic thoracenteses have not explained a high-risk unilateral effusion. What is the teaching point?',
    options: [
      {
        id: 'a',
        text: 'Use a guardrail against further fluid-only cycling and escalate deliberately.',
      },
      { id: 'b', text: 'Schedule weekly diagnostic taps forever.' },
      { id: 'c', text: 'Dismiss the effusion.' },
      { id: 'd', text: 'Start pleurodesis without diagnosis.' },
    ],
    correctId: 'a',
    explanation:
      'The outpatient simulator should reward a timely shift from repeated sampling to tissue or pathway escalation.',
    section: 'outpatient',
    difficulty: 2,
    referenceIds: ['mpe-ats-sts-str-2018', 'bts-pleural-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'outpatient-ipc-care',
    stem: 'Which outpatient IPC teaching point belongs in the course?',
    options: [
      {
        id: 'a',
        text: 'Drainage trend, symptoms, infection signs, and catheter patency all matter.',
      },
      { id: 'b', text: 'Positive culture alone always requires catheter removal.' },
      { id: 'c', text: 'Home drainage goals do not matter.' },
      { id: 'd', text: 'Daily drainage is never used.' },
    ],
    correctId: 'a',
    explanation:
      'Outpatient care should train learners to follow symptoms, volumes, infection features, loculations, and patient goals.',
    section: 'outpatient',
    difficulty: 1,
    referenceIds: ['asap-2017', 'mpe-ats-sts-str-2018'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'algorithms-ultrasound-first',
    stem: 'What is the course-wide algorithmic habit?',
    options: [
      {
        id: 'a',
        text: 'Use ultrasound and clinical context before selecting tests or procedures.',
      },
      { id: 'b', text: 'Use one universal pleural algorithm for every patient.' },
      { id: 'c', text: 'Skip patient goals.' },
      { id: 'd', text: 'Let color alone carry risk information.' },
    ],
    correctId: 'a',
    explanation:
      'The integrated course should train ultrasound-first, context-aware reasoning with accessible, text-backed visual states.',
    section: 'algorithms',
    difficulty: 1,
    referenceIds: ['bts-pleural-2023', 'bts-procedures-2023'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'algorithms-reviewer',
    stem: 'Why keep clinical statements in content files?',
    options: [
      {
        id: 'a',
        text: 'So reviewers can audit statements, citations, and review metadata directly.',
      },
      { id: 'b', text: 'So components can hide sources.' },
      { id: 'c', text: 'So thresholds are duplicated in JSX.' },
      { id: 'd', text: 'So tests are unnecessary.' },
    ],
    correctId: 'a',
    explanation:
      'Reviewer-facing data keeps clinical claims auditable and prevents important thresholds from being buried in UI code.',
    section: 'algorithms',
    difficulty: 1,
    referenceIds: ['bts-quality-2026'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
  {
    id: 'algorithms-accessibility',
    stem: 'Which design requirement improves teaching for every module?',
    options: [
      {
        id: 'a',
        text: 'Keyboard-operable controls with text equivalents for dynamic visual states.',
      },
      { id: 'b', text: 'Canvas-only answers.' },
      { id: 'c', text: 'Color-only feedback.' },
      { id: 'd', text: 'Hidden disclaimers.' },
    ],
    correctId: 'a',
    explanation:
      'The pleural modules must teach through accessible controls and text, not color or animation alone.',
    section: 'algorithms',
    difficulty: 1,
    referenceIds: ['bts-quality-2026'],
    lastReviewed: '2026-05-25',
    reviewer: 'Pending clinical review',
  },
]
