import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

export const pleuralInfectionLessons: PleuralLesson[] = [
  {
    id: 'source-control',
    title: 'Source Control and Early Reassessment',
    timeMinutes: 25,
    objectives: [
      'Stage parapneumonic effusions using chemistry, microbiology, pus, and imaging.',
      'Choose drainage, tPA/DNase, irrigation, or surgery from a reassessment pathway.',
      'Teach anticoagulation as a bleeding-risk modifier for intrapleural therapy.',
    ],
    statements: [
      {
        id: 'low-ph-drainage',
        statement:
          'In pleural infection teaching, frank pus, positive Gram stain or culture, pleural pH at or below 7.20, low glucose, high LDH, or complex imaging should prompt drainage-level source-control thinking when safe.',
        referenceIds: ['bts-pleural-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'mist2-combination',
        statement:
          'MIST2 supports teaching tPA plus DNase as combination intrapleural therapy for selected residual pleural infection; single-agent tPA or DNase should not be taught as equivalent.',
        referenceIds: ['mist2-2011'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'irrigation-alternative',
        statement:
          'Pleural saline irrigation can be presented as a selected alternative when lytic bleeding risk cannot be mitigated, while acknowledging that it is supported by pilot data and not a universal replacement.',
        referenceIds: ['pit-2015'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
