import type { CourseChunk } from '../content/courseFlow'
import { section as rightSide } from '../content/sections/right-side'
import type {
  AuthoredChoice,
  AuthoredItem,
  AuthoredTransferItem,
  BronchSectionDefinition,
  BronchTeachingBlock,
} from '../content/types'

/**
 * A small section that follows every rewrite rule, and the flow it is shown in. The rule tests
 * change one thing at a time and expect exactly that rule to object. It borrows only its scope
 * view and identifiers from a real section; none of its sentences is course content.
 */
const SOURCES = [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 67 } }] as const

function card(id: string, heading: string, body: string): BronchTeachingBlock {
  return {
    id,
    kind: 'pattern',
    role: 'normal-reference',
    heading,
    body,
    claimClass: 'source',
    sourceRefs: SOURCES,
  }
}

const CHOICES: readonly AuthoredChoice[] = [
  {
    id: 'a',
    label: 'Withdraw to the right main bronchus',
    rationale: 'The origin is behind the tip. You see it again from its parent.',
    plausibility: 'best',
  },
  {
    id: 'b',
    label: 'Advance to look for it further on',
    rationale: 'Going deeper moves the tip further from an origin it has already passed.',
    plausibility: 'unsafe',
  },
  {
    id: 'c',
    label: 'Rotate until an opening appears',
    rationale: 'Rotation turns the picture. It does not bring back an origin behind the tip.',
    plausibility: 'incorrect-mechanism',
  },
  {
    id: 'd',
    label: 'Name the largest opening in view',
    rationale: 'Size does not name an airway. Its parent does, and that parent is not in view.',
    plausibility: 'incorrect-mechanism',
  },
]

function item(id: string, situation: string): AuthoredItem {
  return {
    id,
    itemType: 'management-decision',
    situation,
    stem: 'What do you do next?',
    choices: CHOICES,
    explanation: 'An origin you have passed is behind the tip. Withdraw to its parent to see it.',
    objectiveIds: ['M08-O1'],
    outcomeIds: ['name-by-parent'],
    claimClass: 'source',
    sourceRefs: SOURCES,
  }
}

if (rightSide.act.kind !== 'scope-lab') throw new Error('The fixture needs a scope-lab act.')

export const REWRITTEN_FIXTURE: BronchSectionDefinition = {
  id: 'right-side',
  authoringContract: 2,
  title: 'The right lung',
  shortTitle: 'Right lung',
  minutes: 6,
  activityMinutes: 3,
  moduleIds: rightSide.moduleIds,
  objectives: rightSide.objectives,
  drillIds: rightSide.drillIds,
  prerequisites: rightSide.prerequisites,
  clinicalQuestion: 'Which airway are you in, and how do you know?',
  objective: 'Name the right-sided airways from the parent each one leaves.',
  harmfulReflex: 'Advancing to look for an origin the tip has already passed.',
  harmfulReflexPatterns: [/\badvanc/i],
  anchor: {
    analogy: 'A street takes its name at the corner you turned from, not from the houses ahead.',
    precise: 'Name every airway by the parent you entered it from.',
    checklistLabel: 'Naming an airway',
    checklist: [
      'Say the parent out loud',
      'Count the openings in view',
      'Find the membranous wall',
      'Then name the branch',
    ],
  },
  outcomes: [{ id: 'name-by-parent', text: 'Name a right-sided airway from its parent.' }],
  spineStops: rightSide.spineStops,
  grammarRowIds: [],
  precommitDenyPatterns: [/\bwithdraw\w* to the right main\b/i],
  localPolicyIds: [],
  reviewItemIds: [],
  blocks: [
    card(
      'upper-lobe',
      'The right upper lobe',
      'The right main bronchus is short. The upper lobe leaves its lateral wall, then divides into RB1, RB2 and RB3.',
    ),
    card(
      'common-errors',
      'Two errors to expect',
      'You will pass the upper lobe origin. You will call RB6 a middle lobe segment. Name the parent first.',
    ),
  ],
  workspace: rightSide.workspace,
  act: {
    kind: 'scope-lab',
    view: { ...rightSide.act.view, boundary: 'Guided travel: the scope follows the lumen.' },
    goals: [
      {
        id: 'see-upper-lobe',
        label: 'Bring the right upper lobe origin into view',
        test: { type: 'event', event: 'ostium-visualized:RUL' },
      },
      {
        id: 'enter-upper-lobe',
        label: 'Enter the right upper lobe',
        test: { type: 'event', event: 'entered:RUL' },
      },
    ],
  },
  prediction: item('fixture-prediction', 'You advance from the carina and no upper lobe appears.'),
  transfer: {
    ...item('fixture-check', 'In the lower lobe you count three basal openings, not four.'),
    stem: 'Where do you look for the fourth?',
    transferVariant: 'A different lobe, the same rule.',
  } satisfies AuthoredTransferItem,
  practice: [],
}

const chunk = (
  id: string,
  kind: CourseChunk['kind'],
  blocks: readonly string[] = [],
  extra: Partial<CourseChunk> = {},
): CourseChunk => ({
  id,
  title: id,
  kind,
  presentation: 'illustrated',
  blocks,
  visual: 'none',
  ...extra,
})

export const REWRITTEN_FIXTURE_FLOW: readonly CourseChunk[] = [
  chunk('hook', 'teach', [], { anchor: true }),
  chunk('check', 'check'),
  chunk('upper-lobe', 'teach', ['upper-lobe'], { visual: 'tour' }),
  chunk('application', 'practice'),
  chunk('transfer', 'transfer'),
  chunk('review', 'debrief', ['common-errors'], { anchor: true }),
]
