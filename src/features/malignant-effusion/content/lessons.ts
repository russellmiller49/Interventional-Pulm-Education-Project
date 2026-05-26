import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

export const malignantEffusionLessons: PleuralLesson[] = [
  {
    id: 'diagnosis-and-definitive-management',
    title: 'MPE Diagnosis and Definitive Management',
    timeMinutes: 24,
    objectives: [
      'Recognize when nondiagnostic cytology should trigger tissue diagnosis.',
      'Branch IPC, pleurodesis, and rapid pleurodesis pathways by lung expansion and goals.',
      'Compare modality tradeoffs without declaring one universal best choice.',
    ],
    statements: [
      {
        id: 'cytology-escalation',
        statement:
          'When malignant pleural effusion remains likely after one or two nondiagnostic cytology samples, teaching should prompt tissue diagnosis rather than indefinite repeat thoracentesis.',
        referenceIds: ['mpe-ats-sts-str-2018', 'bts-pleural-2023'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'trapped-lung-ipc',
        statement:
          'Non-expandable or trapped lung makes pleurodesis less likely to succeed and should shift malignant effusion teaching toward IPC-centered symptom control.',
        referenceIds: ['mpe-ats-sts-str-2018', 'time2-2012', 'ample-2017'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'combined-strategies',
        statement:
          'Selected IPC plus talc or rapid pleurodesis strategies can increase pleurodesis while preserving outpatient management, but patient goals and local expertise should guide the pathway.',
        referenceIds: ['ipc-plus-2018', 'tapps-2020', 'asap-2017'],
        lastReviewed: '2026-05-25',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
