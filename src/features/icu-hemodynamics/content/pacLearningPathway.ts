import type { PacGuidedSkillId } from './pacGuidedSkills'

export type PacLearningPathwaySectionId = PacGuidedSkillId | 'pac-signal-validation'

export interface PacLearningPathwaySection {
  readonly id: PacLearningPathwaySectionId
  readonly shortTitle: string
  readonly title: string
  readonly minutes: number
  readonly description: string
  readonly kind: 'skill' | 'capstone'
}

/**
 * The learner-facing order intentionally begins at the introducer and follows the catheter
 * through the right heart. Signal validation remains available as an ungated final integration
 * station instead of masquerading as a duplicate introductory module.
 */
export const pacLearningPathwaySections: readonly PacLearningPathwaySection[] = [
  {
    id: 'catheter-advancement',
    shortTitle: 'Advance',
    title: 'Advance the PAC by waveform',
    minutes: 15,
    description:
      'Start at the introducer, then confirm the RA, RV, and PA transitions from pressure morphology.',
    kind: 'skill',
  },
  {
    id: 'pressure-system',
    shortTitle: 'Validate setup',
    title: 'Level, zero, and dynamic response',
    minutes: 12,
    description:
      'Establish a valid pressure-measurement system and classify its fast-flush response.',
    kind: 'skill',
  },
  {
    id: 'waveform-interpretation',
    shortTitle: 'Interpret',
    title: 'Interpret normal and abnormal waveforms',
    minutes: 18,
    description:
      'Identify chambers by morphology and read the wave components that carry a diagnosis.',
    kind: 'skill',
  },
  {
    id: 'pawp-capture',
    shortTitle: 'Wedge',
    title: 'Brief end-expiratory PAWP capture',
    minutes: 15,
    description:
      'Capture, store, and promptly deflate while confirming safe return of the PA waveform.',
    kind: 'skill',
  },
  {
    id: 'thermodilution-series',
    shortTitle: 'Measure CO',
    title: 'Cardiac output: thermodilution and Fick',
    minutes: 18,
    description:
      'Learn what each method measures, then standardize and review a thermodilution series.',
    kind: 'skill',
  },
  {
    id: 'derived-hemodynamics',
    shortTitle: 'Derive',
    title: 'Derived hemodynamics and validity',
    minutes: 15,
    description:
      'Trace each formula back to its source measurements before interpreting the result.',
    kind: 'skill',
  },
  {
    id: 'pac-signal-validation',
    shortTitle: 'Integrate',
    title: 'PAC signal-validation capstone',
    minutes: 20,
    description:
      'Integrate setup, catheter position, curve quality, derived values, and reassessment.',
    kind: 'capstone',
  },
]

export const firstPacLearningPathwaySectionId = pacLearningPathwaySections[0].id

export function isPacLearningPathwaySectionId(
  value: unknown,
): value is PacLearningPathwaySectionId {
  return (
    typeof value === 'string' && pacLearningPathwaySections.some((section) => section.id === value)
  )
}
