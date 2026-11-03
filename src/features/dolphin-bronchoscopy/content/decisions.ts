/**
 * The five decisions every dolphin bronchoscopy turns on. The Reference tab prints them; each
 * integrated case's debrief names the one it turned on.
 */
export interface DolphinDecision {
  readonly id: 'go' | 'topical-or-sedation' | 'spout-timing' | 'next-site' | 'continue-or-stop'
  readonly title: string
  readonly question: string
  readonly sectionIds: readonly string[]
}

export const DOLPHIN_DECISIONS: readonly DolphinDecision[] = [
  {
    id: 'go',
    title: 'Go, and with what',
    question:
      'Is the workup done and the question framed? Sedation or general anesthesia? Bronchoscope or gastrointestinal scope?',
    sectionIds: ['choosing-the-instrument', 'before-the-day', 'the-room-and-the-team'],
  },
  {
    id: 'topical-or-sedation',
    title: 'More topical or more sedation',
    question:
      'The animal coughs or resists: is it the airway that needs numbing, or the animal that needs calming?',
    sectionIds: ['sedation-and-numbing', 'trouble-during-the-procedure'],
  },
  {
    id: 'spout-timing',
    title: 'Advance, hold or withdraw at the spout',
    question:
      'Is the glottis open now, with this breath? If not, hold; if the animal fights, withdraw.',
    sectionIds: ['entering-the-blowhole'],
  },
  {
    id: 'next-site',
    title: 'Which site next, and sample or not',
    question:
      'Where does the survey go next, and does what you see justify lavage, a brush or a biopsy?',
    sectionIds: ['the-survey-and-the-record', 'lavage', 'brush-and-biopsy'],
  },
  {
    id: 'continue-or-stop',
    title: 'Continue, pause, or stop and reverse',
    question: 'Something has changed. What is its earliest sign, and what is the first move?',
    sectionIds: ['trouble-during-the-procedure', 'recovery-and-return'],
  },
]
