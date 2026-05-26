import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

export const pleuralUltrasoundLessons: PleuralLesson[] = [
  {
    id: 'pattern-management',
    title: 'Ultrasound Pattern to Management',
    timeMinutes: 18,
    objectives: [
      'Classify common effusion sonographic patterns.',
      'Connect complexity to sampling, drainage, and source-control thinking.',
      'Avoid false reassurance from a simple anechoic appearance.',
    ],
    statements: [
      {
        id: 'anechoic-not-benign',
        statement:
          'A simple anechoic effusion does not exclude exudate, infection, tuberculosis, or malignancy; ultrasound findings must be interpreted with the clinical context.',
        referenceIds: ['bts-pleural-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'septated-drainage-frame',
        statement:
          'Septated, loculated, or echogenic pleural fluid should prompt learners to consider pleural infection, blood, malignant complexity, and need for drainage or adjunctive source control when the case fits.',
        referenceIds: ['bts-pleural-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
