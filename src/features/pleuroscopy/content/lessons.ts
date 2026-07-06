import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

/**
 * Teaching statements for the Pleuroscopy (medical thoracoscopy) module. Each
 * statement is paraphrased in our own words and carries `referenceIds` into the
 * shared `pleuralReferences` list; the references page renders exactly the set
 * cited here. Simulation/education framing only.
 */
export const pleuroscopyLessons: PleuralLesson[] = [
  {
    id: 'indications-selection',
    title: 'Indications and patient selection',
    timeMinutes: 20,
    objectives: [
      'Recognize the core indications for medical thoracoscopy.',
      'Identify the main contraindications and the need for an accessible pleural space.',
    ],
    statements: [
      {
        id: 'lat-indications',
        statement:
          'Medical (local-anaesthetic) thoracoscopy is taught for an undiagnosed exudative effusion — particularly when malignancy is suspected — and for talc poudrage pleurodesis, performed under local anaesthetic with sedation.',
        referenceIds: ['bts-lat-2010', 'bts-pleural-2023'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'contraindication-space',
        statement:
          'An obliterated pleural space (dense adhesions with no accessible space) is the principal contraindication to medical thoracoscopy; uncorrectable coagulopathy and unstable cardiorespiratory status are additional cautions.',
        referenceIds: ['bts-lat-2010', 'bts-procedures-2023'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
    ],
  },
  {
    id: 'technique-safety',
    title: 'Access, inspection, and biopsy technique',
    timeMinutes: 25,
    objectives: [
      'Use ultrasound to select a safe single-access entry site.',
      'Take parietal biopsies over ribs to protect the intercostal bundle.',
    ],
    statements: [
      {
        id: 'ultrasound-siting',
        statement:
          'Ultrasound is taught to confirm a safe intercostal entry site with an accessible pleural space and to avoid the diaphragm and underlying organs before single-port entry.',
        referenceIds: ['bts-procedures-2023'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'biopsy-over-rib',
        statement:
          'Parietal biopsies are taught to be taken over a rib to keep clear of the intercostal neurovascular bundle in the lower border groove, reducing bleeding risk.',
        referenceIds: ['bts-lat-2010', 'bts-procedures-2023'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
    ],
  },
  {
    id: 'pleurodesis',
    title: 'Talc poudrage and drainage',
    timeMinutes: 15,
    objectives: [
      'Explain graded-talc poudrage and the need for pleural apposition.',
      'Anticipate re-expansion oedema and air leak in post-procedure management.',
    ],
    statements: [
      {
        id: 'graded-talc',
        statement:
          'Talc poudrage for malignant pleural effusion is taught with graded (large-particle) talc to promote pleurodesis while limiting the systemic small-particle spread associated with talc-related pneumonitis.',
        referenceIds: ['talc-safety-2007', 'tapps-2020'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'apposition',
        statement:
          'Poudrage is taught to require pleural apposition: the lung must re-expand for the surfaces to fuse, so a trapped, non-expandable lung is a poor pleurodesis candidate.',
        referenceIds: ['tapps-2020', 'bts-pleural-2023'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
