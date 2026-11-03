import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'

import type { DolphinObjectiveId } from './objectives'
import type { DolphinSectionId } from './sectionIds'

/**
 * What every section is called, how long it takes, where it sits and what it assumes.
 *
 * The section files spread their entry (`...dolphinSectionMeta(id)`), so a title or a time is
 * written once. Titles name the situation, never the answer.
 */
export interface DolphinSectionMeta {
  readonly title: string
  readonly shortTitle: string
  readonly minutes: number
  readonly activityMinutes: number
  readonly stage: CriticalCareCurriculumStage
  readonly objectiveIds: readonly DolphinObjectiveId[]
  readonly prerequisites: readonly DolphinSectionId[]
  /** One sentence on what the section adds. */
  readonly summary: string
}

export const DOLPHIN_SECTION_META: Readonly<Record<DolphinSectionId, DolphinSectionMeta>> = {
  'why-scope-a-dolphin': {
    title: 'Why look below the blowhole',
    shortTitle: 'Why look',
    minutes: 8,
    activityMinutes: 3,
    stage: 'orientation',
    objectiveIds: ['O6'],
    prerequisites: [],
    summary:
      'Lower-airway disease is common in dolphins, and a blowhole sample does not stand for it.',
  },
  'an-airway-apart-from-the-mouth': {
    title: 'An airway built apart from the mouth',
    shortTitle: 'Airway apart',
    minutes: 10,
    activityMinutes: 4,
    stage: 'orientation',
    objectiveIds: ['O6', 'O1'],
    prerequisites: ['why-scope-a-dolphin'],
    summary: 'The larynx stands up into the nasopharynx, so air never crosses the mouth.',
  },
  'from-blowhole-to-spout': {
    title: 'From the blowhole to the spout',
    shortTitle: 'Blowhole to spout',
    minutes: 12,
    activityMinutes: 6,
    stage: 'foundation',
    objectiveIds: ['O1'],
    prerequisites: ['an-airway-apart-from-the-mouth'],
    summary: 'Drive the bony nasal passage and the nasopharynx to the glottis.',
  },
  'below-the-larynx': {
    title: 'Below the larynx',
    shortTitle: 'Below the larynx',
    minutes: 10,
    activityMinutes: 5,
    stage: 'foundation',
    objectiveIds: ['O1'],
    prerequisites: ['from-blowhole-to-spout'],
    summary: 'A bronchus leaves the trachea on the right before the carina.',
  },
  'the-numbered-map': {
    title: 'The numbered map of the main bronchi',
    shortTitle: 'Numbered map',
    minutes: 10,
    activityMinutes: 5,
    stage: 'foundation',
    objectiveIds: ['O1'],
    prerequisites: ['below-the-larynx'],
    summary: 'No lobes: each main bronchus gives branches numbered in order from the carina.',
  },
  'same-in-every-dolphin': {
    title: 'What is the same in every dolphin',
    shortTitle: 'What varies',
    minutes: 8,
    activityMinutes: 3,
    stage: 'mechanism',
    objectiveIds: ['O6'],
    prerequisites: ['the-numbered-map'],
    summary: 'The proximal airway is conserved; branch direction varies, so names count order.',
  },
  'reading-the-picture': {
    title: 'Reading the picture in sternal recumbency',
    shortTitle: 'Reading the view',
    minutes: 12,
    activityMinutes: 6,
    stage: 'mechanism',
    objectiveIds: ['O1'],
    prerequisites: ['the-numbered-map'],
    summary: 'Which way is up on the screen, and which side is the animal’s right.',
  },
  'finding-a-named-branch': {
    title: 'Finding a named branch',
    shortTitle: 'Finding a branch',
    minutes: 12,
    activityMinutes: 9,
    stage: 'application',
    objectiveIds: ['O1'],
    prerequisites: ['the-numbered-map', 'reading-the-picture'],
    summary: 'Drive to a branch by name with the labels off, counting from the carina.',
  },
  'choosing-the-instrument': {
    title: 'Choosing the instrument',
    shortTitle: 'The instrument',
    minutes: 8,
    activityMinutes: 4,
    stage: 'foundation',
    objectiveIds: ['O2'],
    prerequisites: ['from-blowhole-to-spout'],
    summary:
      'Bronchoscope or gastrointestinal scope: length, reach and what each does to the airway.',
  },
  'before-the-day': {
    title: 'Before the day',
    shortTitle: 'Before the day',
    minutes: 10,
    activityMinutes: 4,
    stage: 'foundation',
    objectiveIds: ['O2'],
    prerequisites: ['why-scope-a-dolphin'],
    summary: 'Bronchoscopy answers a question the workup has framed.',
  },
  'the-room-and-the-team': {
    title: 'The room and the team',
    shortTitle: 'Room and team',
    minutes: 8,
    activityMinutes: 4,
    stage: 'application',
    objectiveIds: ['O2'],
    prerequisites: ['before-the-day'],
    summary:
      'One role per person, the animal sternal and wet, and the head end treated as an exposure.',
  },
  'sedation-and-numbing': {
    title: 'Sedation and numbing',
    shortTitle: 'Sedation and numbing',
    minutes: 14,
    activityMinutes: 7,
    stage: 'mechanism',
    objectiveIds: ['O2'],
    prerequisites: ['the-room-and-the-team'],
    summary: 'Numb three places and count every milliliter of lidocaine against one maximum.',
  },
  'entering-the-blowhole': {
    title: 'Entering the blowhole and passing the spout',
    shortTitle: 'Through the spout',
    minutes: 12,
    activityMinutes: 7,
    stage: 'application',
    objectiveIds: ['O3', 'O1'],
    prerequisites: ['from-blowhole-to-spout', 'sedation-and-numbing'],
    summary: 'Advance in stages with the breaths, never blind and never against a closed glottis.',
  },
  'the-survey-and-the-record': {
    title: 'The survey and the record',
    shortTitle: 'Survey and record',
    minutes: 12,
    activityMinutes: 8,
    stage: 'application',
    objectiveIds: ['O3'],
    prerequisites: ['the-numbered-map', 'entering-the-blowhole'],
    summary: 'A fixed order, and every site written down, including the ones not reached.',
  },
  lavage: {
    title: 'Lavage',
    shortTitle: 'Lavage',
    minutes: 10,
    activityMinutes: 5,
    stage: 'application',
    objectiveIds: ['O4'],
    prerequisites: ['the-survey-and-the-record'],
    summary: 'Wedge, instil by weight in aliquots, expect a modest return, keep the sample cool.',
  },
  'tools-through-the-channel': {
    title: 'The tools through the channel',
    shortTitle: 'The tools',
    minutes: 10,
    activityMinutes: 6,
    stage: 'application',
    objectiveIds: ['O4'],
    prerequisites: ['lavage'],
    summary:
      'How the forceps and the brush travel the working channel, what the hand does at each handle, and which brush a culture needs.',
  },
  'brush-and-biopsy': {
    title: 'Brush, biopsy, and when to stop',
    shortTitle: 'Brush and biopsy',
    minutes: 8,
    activityMinutes: 4,
    stage: 'application',
    objectiveIds: ['O4'],
    prerequisites: ['tools-through-the-channel'],
    summary:
      'Each step up in sampling is a step up in a bleeding risk this species has not measured.',
  },
  'trouble-during-the-procedure': {
    title: 'Trouble during the procedure',
    shortTitle: 'Trouble',
    minutes: 14,
    activityMinutes: 9,
    stage: 'integration',
    objectiveIds: ['O5'],
    prerequisites: ['sedation-and-numbing', 'entering-the-blowhole'],
    summary: 'For each complication, its earliest sign and the first move, in order.',
  },
  'recovery-and-return': {
    title: 'Recovery and return to the water',
    shortTitle: 'Recovery',
    minutes: 7,
    activityMinutes: 3,
    stage: 'application',
    objectiveIds: ['O5'],
    prerequisites: ['sedation-and-numbing'],
    summary: 'Reverse only when you must, then shallow water with someone watching.',
  },
  'beyond-the-survey': {
    title: 'Beyond the diagnostic survey',
    shortTitle: 'Beyond the survey',
    minutes: 6,
    activityMinutes: 2,
    stage: 'orientation',
    objectiveIds: ['O6'],
    prerequisites: ['the-survey-and-the-record'],
    summary: 'Therapeutic and image-guided work exists; recognize it, do not attempt it from here.',
  },
  'what-this-module-can-say': {
    title: 'What completion means',
    shortTitle: 'Closing',
    minutes: 4,
    activityMinutes: 1,
    stage: 'integration',
    objectiveIds: ['O6'],
    prerequisites: ['why-scope-a-dolphin'],
    summary: 'What these sections establish, and what only supervised practice can.',
  },
}

export function dolphinSectionMeta(id: DolphinSectionId): DolphinSectionMeta & {
  readonly id: DolphinSectionId
} {
  return { id, ...DOLPHIN_SECTION_META[id] }
}
