import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

export const pneumothoraxLessons: PleuralLesson[] = [
  {
    id: 'current-pathway',
    title: 'Current Pneumothorax Pathway',
    timeMinutes: 22,
    objectives: [
      'Separate physiologic instability from stable decision-making.',
      'Avoid using pneumothorax size alone as the decision driver.',
      'Recognize persistent air leak escalation and recurrence-prevention triggers.',
    ],
    statements: [
      {
        id: 'size-not-alone',
        statement:
          'Current pneumothorax teaching should not use size alone as the only treatment driver; stability, symptoms, primary versus secondary pneumothorax, patient risk, and follow-up setting matter.',
        referenceIds: ['bts-pleural-2023', 'ers-eacts-ests-2024'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'pal-escalation',
        statement:
          'A persistent air leak should prompt drain and system checks, avoidance of unnecessary suction, and time-bounded specialist escalation when it persists.',
        referenceIds: ['ers-eacts-ests-2024'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
