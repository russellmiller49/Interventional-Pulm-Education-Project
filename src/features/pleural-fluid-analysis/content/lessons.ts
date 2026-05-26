import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

export const pleuralAnalysisLessons: PleuralLesson[] = [
  {
    id: 'diagnostic-reconciliation',
    title: 'Pleural Fluid Reconciliation',
    timeMinutes: 25,
    objectives: [
      'Classify fluid with Light criteria and reconcile pseudoexudates.',
      'Use gross appearance and targeted tests to select diagnostic branches.',
      'Escalate beyond repeat cytology when malignant pleural disease remains likely.',
    ],
    statements: [
      {
        id: 'negative-cytology-escalation',
        statement:
          'When pleural malignancy remains clinically likely after two nondiagnostic cytology samples, teaching should prompt pleural tissue diagnosis rather than continued fluid-only testing.',
        referenceIds: ['mpe-ats-sts-str-2018', 'bts-pleural-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
