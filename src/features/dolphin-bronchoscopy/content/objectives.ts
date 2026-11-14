import type { DolphinSectionId } from './sectionIds'

export type DolphinObjectiveId = 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6'

export interface DolphinObjective {
  readonly id: DolphinObjectiveId
  /** The discrimination, starting from what the learner is given. */
  readonly text: string
  readonly bloom: 'understand' | 'apply' | 'analyze' | 'evaluate'
  /** Miller level reached here. Hands-on competence stays with supervised practice. */
  readonly miller: 'knows' | 'knows how' | 'shows how (simulation)'
  readonly primarySections: readonly DolphinSectionId[]
}

export const DOLPHIN_OBJECTIVES: readonly DolphinObjective[] = [
  {
    id: 'O1',
    text: 'Given where the scope tip is and what it shows, name the place and what lies ahead along the passage, from the naris to a numbered branch.',
    bloom: 'analyze',
    miller: 'shows how (simulation)',
    primarySections: [
      'from-blowhole-to-spout',
      'below-the-larynx',
      'the-numbered-map',
      'reading-the-picture',
      'finding-a-named-branch',
    ],
  },
  {
    id: 'O2',
    text: 'Given a dolphin, its weight and the question, plan the procedure: workup, instrument, position, protective equipment, sedation, and a lidocaine ledger that stays within the maximum.',
    bloom: 'apply',
    miller: 'knows how',
    primarySections: [
      'choosing-the-instrument',
      'before-the-day',
      'the-room-and-the-team',
      'sedation-and-numbing',
    ],
  },
  {
    id: 'O3',
    text: 'Given the view and the breathing, decide when to advance, hold or withdraw at the spout, and in what order to survey and write the record.',
    bloom: 'analyze',
    miller: 'shows how (simulation)',
    primarySections: ['entering-the-blowhole', 'the-survey-and-the-record'],
  },
  {
    id: 'O4',
    text: 'Given a sampling goal, choose lavage, brush or biopsy, with its volume and order, and recognize when not to sample.',
    bloom: 'evaluate',
    miller: 'knows how',
    primarySections: ['lavage', 'brush-and-biopsy'],
  },
  {
    id: 'O5',
    text: 'Given a change during the procedure, name its earliest sign and make the first move.',
    bloom: 'analyze',
    miller: 'knows how',
    primarySections: ['trouble-during-the-procedure', 'recovery-and-return'],
  },
  {
    id: 'O6',
    text: 'State what is the same in every dolphin airway, what varies, and what this module does and does not establish.',
    bloom: 'understand',
    miller: 'knows',
    primarySections: [
      'why-scope-a-dolphin',
      'an-airway-apart-from-the-mouth',
      'same-in-every-dolphin',
      'beyond-the-survey',
      'what-this-module-can-say',
    ],
  },
]

export const dolphinObjectiveById = new Map(DOLPHIN_OBJECTIVES.map((o) => [o.id, o] as const))
