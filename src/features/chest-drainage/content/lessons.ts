export interface ClinicalStatement {
  id: string
  statement: string
  referenceIds: string[]
  lastReviewed: string
  reviewer: string
}

export interface ChestDrainageLesson {
  id: string
  title: string
  timeMinutes: number
  objectives: string[]
  statements: ClinicalStatement[]
}

export const chestDrainageLessons: ChestDrainageLesson[] = [
  {
    id: 'pressure-primer',
    title: 'Pressure and the Pleural Space',
    timeMinutes: 10,
    objectives: [
      'Explain chest drainage as pressure management rather than a box-and-tube ritual.',
      'Predict how spontaneous and positive-pressure ventilation change visible tidaling.',
      'Describe why a one-way seal prevents retrograde air movement.',
    ],
    statements: [
      {
        id: 'pressure-system',
        statement:
          'A safe drainage system lets air or fluid leave the pleural space, prevents retrograde flow, maintains or restores appropriate pleural pressure, and gives interpretable feedback.',
        referenceIds: ['zisis-2015', 'sorino-2024'],
        lastReviewed: '2026-05-17',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'patient-first',
        statement:
          'Troubleshooting begins with patient assessment, then moves through tube, drainage unit, suction source, and disease physiology.',
        referenceIds: ['bts-2023', 'sorino-2024'],
        lastReviewed: '2026-05-17',
        reviewer: 'Pending clinical review',
      },
    ],
  },
  {
    id: 'dry-seal-knobology',
    title: 'Dry Seal / Dry Suction Knobology',
    timeMinutes: 15,
    objectives: [
      'Set a dry suction regulator and verify the suction indicator rather than trusting the dial alone.',
      'Interpret air leak bubbling levels alongside patient state and tube position.',
      'Recognize when a water seal chamber, patient pressure float, clamp, or collection chamber changes the next step.',
    ],
    statements: [
      {
        id: 'dry-suction-source',
        statement:
          'In a dry suction unit, the dial is the target setting, but a visible suction indicator depends on adequate source suction and correct setup; this simulator uses 16 L/min as the source-flow adequacy floor and calls out the Atrium-style -80 mmHg source-vacuum check separately.',
        referenceIds: ['zisis-2015', 'atrium-express-manual', 'sorino-2024'],
        lastReviewed: '2026-05-23',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'air-leak-context',
        statement:
          'Bubbling or a digital air-leak value should be interpreted as a trend in clinical context, not as a single isolated number.',
        referenceIds: ['george-2016', 'bts-2023'],
        lastReviewed: '2026-05-17',
        reviewer: 'Pending clinical review',
      },
    ],
  },
  {
    id: 'troubleshooting-rounds',
    title: 'Troubleshooting Rounds',
    timeMinutes: 25,
    objectives: [
      'Differentiate patient air leak from system leak without unsafe clamping habits.',
      'Explain absent tidaling using a differential diagnosis rather than a reflex action.',
      'Respond to high negativity, obstruction alarms, knocked-over systems, and re-expansion risk.',
    ],
    statements: [
      {
        id: 'clamping-caution',
        statement:
          'Clamping a tube with an active air leak can create dangerous pressure if air cannot evacuate; any clamping decision must follow local policy and bedside supervision.',
        referenceIds: ['bts-2023', 'sorino-2024'],
        lastReviewed: '2026-05-17',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'reexpansion-caution',
        statement:
          'Large chronic pneumothorax or large effusion scenarios require caution with abrupt high negative pressure and rapid expansion in this educational model.',
        referenceIds: ['bts-2023', 'sorino-2024'],
        lastReviewed: '2026-05-17',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]

export const chestDrainageDisclaimer =
  'This module is for education and simulation only. It does not provide patient-specific medical advice. Actual chest drainage setup, troubleshooting, suction strategy, tube management, removal decisions, and device-specific steps depend on the patient, indication, device model, current manufacturer instructions for use, local policy, imaging, procedural conditions, and clinician judgment.'
