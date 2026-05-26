import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

export const thoracentesisPlannerLessons: PleuralLesson[] = [
  {
    id: 'access-safety',
    title: 'Access Safety and Bleeding Risk',
    timeMinutes: 12,
    objectives: [
      'Map the triangle of safety and diaphragm boundary.',
      'Explain why posterior/medial vessel anatomy increases bleeding concern.',
      'Frame anticoagulation and coagulation labs as individualized risk inputs.',
    ],
    statements: [
      {
        id: 'ultrasound-access',
        statement:
          'Thoracentesis teaching should start with ultrasound confirmation of fluid, depth, diaphragm, and a safe needle trajectory rather than a fixed blind landmark.',
        referenceIds: ['bts-procedures-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'bleeding-individualized',
        statement:
          'Bleeding risk for pleural procedures is individualized; INR, platelet count, antiplatelet therapy, anticoagulation, urgency, ultrasound guidance, and local policy must be considered together.',
        referenceIds: ['bts-procedures-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
    ],
  },
  {
    id: 'manometry-drainage',
    title: 'Manometry and Symptom-Limited Drainage',
    timeMinutes: 10,
    objectives: [
      'Compare expandable, partially expandable, and trapped-lung pressure curves.',
      'Stop or slow drainage when symptoms or steep negative pressures appear.',
    ],
    statements: [
      {
        id: 'symptom-limited-drainage',
        statement:
          'Large-volume thoracentesis teaching should emphasize symptom-limited or manometry-informed drainage, with caution when pleural pressure becomes markedly negative or pain and persistent cough develop.',
        referenceIds: ['feller-kopman-manometry-2006', 'bts-procedures-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
