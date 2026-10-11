import type { BronchSectionDefinition } from '../types'

/**
 * The left lung (rewrite, brief 7). The same three steps as the right lung: the fellow learns the
 * left-sided airways from the survey stills, names six unlabelled views by clicking the opening
 * asked for, one of them rotated, and then drives from the left main bronchus into the lingula
 * and LB6 with the labels off. The simulator starts upright. Sources: the course textbook's
 * bronchial anatomy chapter (S1) and the training manual's navigation and nomenclature pages (S2).
 */
const ANATOMY = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
] as const
const NAVIGATION = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
] as const
const BASAL = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
] as const

const VIEW_LINE = 'Guided travel: the scope follows the lumen. Opening names are off.'

export const section: BronchSectionDefinition = {
  id: 'left-side',
  authoringContract: 2,
  title: 'The left lung',
  shortTitle: 'Left lung',
  minutes: 9,
  activityMinutes: 5,
  moduleIds: ['M09'],
  objectives: [
    {
      objectiveId: 'M09-O1',
      subtask:
        'Tells the upper division, the lingula and the lower lobe apart on survey frames by their parent.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M09-O2',
      subtask: 'Names the lingular segments, which do not take the names of RB4 and RB5.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M09-O3',
      subtask:
        'Enters LB4 and LB5 from the lingula, returns to the left main bronchus and enters LB6.',
      evidence: 'simulated-navigation',
    },
    {
      objectiveId: 'M09-O4',
      subtask: 'Decides what to do when the left lower lobe shows three basal openings.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M09-O5',
      subtask: 'Clicks LB7+8 among the basal openings from a stated direction, not a screen order.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D07', 'D08'],
  prerequisites: ['larynx-and-entry', 'right-side'],

  clinicalQuestion: 'You are in the left lung. Which airway is this, and which lobe owns it?',
  objective:
    'Name each airway of the left lung from its parent, and know where it differs from the right.',
  harmfulReflex:
    'Pushing on when the opening you expect is not in view. Withdraw to its parent instead.',
  harmfulReflexPatterns: [/\badvanc/i, /\bprob(e|ing)\b/i, /\bpush/i],
  anchor: {
    analogy:
      'A sibling’s house has the same room numbers and a different floor plan. Carry the numbers across from the right lung. Leave the layout and the names behind.',
    precise:
      'On the left, name the lobe before the segment: the lingula belongs to the upper lobe, and LB6 opens the lower lobe.',
    checklistLabel: 'Naming a left-sided airway',
    checklist: [
      'Say which parent you are in',
      'Name the lobe you are entering',
      'Name the division, then the segment',
      'Count the basal openings: three',
    ],
  },
  outcomes: [
    {
      id: 'name-left-airways',
      text: 'Name each left-sided airway from its parent and its lobe, on a rolled view.',
    },
    {
      id: 'reach-lb4-lb6',
      text: 'Drive from the left main bronchus into LB4, LB5 and LB6.',
    },
  ],

  spineStops: ['main-bronchi', 'lobar', 'segmental'],
  grammarRowIds: ['clear-but-lost', 'missing-expected-branch'],
  precommitDenyPatterns: [/\blonger\b/i, /until it ends/i],
  localPolicyIds: [],
  reviewItemIds: ['R01', 'R06'],

  tour: [
    { airway: 'LMSB', note: 'Long. No lobe leaves it on the way down.' },
    { airway: 'LUL', note: 'Leaves where the left main bronchus ends, and divides at once.' },
    { airway: 'LUL-UD', note: 'The upper division. It runs up toward the apex.' },
    { airway: 'LB1+2', note: 'Apicoposterior. One opening for two segments.' },
    { airway: 'LB3', note: 'Anterior.' },
    { airway: 'LB4+5', note: 'The lingula. Part of the upper lobe. It runs forward and down.' },
    { airway: 'LB4', note: 'Superior lingular segment.' },
    { airway: 'LB5', note: 'Inferior lingular segment.' },
    { airway: 'LLL', note: 'The other opening where the left main bronchus ends.' },
    { airway: 'LB6', note: 'Superior segment. Leaves the posterior wall first.' },
    { airway: 'LB7+8', note: 'Anteromedial basal. One opening on the left.' },
    { airway: 'LB9', note: 'Lateral basal.' },
    { airway: 'LB10', note: 'Posterior basal.' },
  ],

  blocks: [
    {
      id: 'left-main',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A long main bronchus',
      body: 'The left main bronchus is much longer than the right. No lobe leaves it on the way down.\n\nIt ends at two openings: the upper lobe and the lower lobe. Stop there and name both before you enter either.',
      claimClass: 'source',
      sourceRefs: ANATOMY,
    },
    {
      id: 'upper-lobe',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'One lobe, two divisions',
      body: 'The upper lobe divides at once. The upper division runs up and gives LB1+2, apicoposterior, and LB3, anterior.\n\nThe lingula runs forward and down. It is part of the upper lobe, not a lobe of its own. It gives LB4, superior, and LB5, inferior.\n\nRB4 and RB5 are lateral and medial: the numbers cross over, the names do not.',
      claimClass: 'source',
      sourceRefs: ANATOMY,
      reviewItemIds: ['R01'],
    },
    {
      id: 'lower-lobe',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The lower lobe: superior segment, then three',
      body: 'LB6, the superior segment, leaves the posterior wall first, as RB6 does on the right. It belongs to the lower lobe.\n\nPast it, count three basal openings, not four: LB7+8 anteromedial, LB9 lateral, LB10 posterior. On the left LB7 and LB8 usually share one opening; when LB7 opens separately, report it as you see it.',
      claimClass: 'source',
      sourceRefs: BASAL,
      reviewItemIds: ['R01'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Four errors to expect',
      body: 'Each one carries the right lung’s map across to the left.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Taking the long main bronchus for the lower lobe. No lobe has left yet. Keep going to the two openings.',
        'Calling the lingula a lobe, or filing its openings under the lower lobe. It leaves the upper lobe.',
        'Naming LB4 and LB5 lateral and medial. They are superior and inferior.',
        'Hunting for a fourth basal opening. Three is the full count when LB7 and LB8 share one.',
      ],
      claimClass: 'source',
      sourceRefs: NAVIGATION,
      reviewItemIds: ['R06'],
    },
  ],

  workspace: {
    kind: 'scope',
    view: {
      sectionId: 'left-side',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'LMSB', at: 'proximal' },
      controls: [],
      assists: {
        'centerline-lock': true,
        'aim-guard': true,
        'branch-labels': false,
        'reference-orientation': true,
      },
      defaults: { branchLabels: false },
      litAirways: [],
      boundary: VIEW_LINE,
    },
  },

  act: {
    kind: 'scope-lab',
    outcomeId: 'reach-lb4-lb6',
    view: {
      sectionId: 'left-side',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'LMSB', at: 'mid' },
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'recenter', 'reset'],
      assists: {
        'centerline-lock': true,
        'aim-guard': true,
        'branch-labels': false,
        'align-to-branch': false,
        recenter: true,
        'reference-orientation': true,
      },
      defaults: { branchLabels: false },
      readouts: ['currentAirway', 'parentage'],
      litAirways: ['LMSB', 'LUL', 'LB4+5', 'LB4', 'LB5', 'LLL', 'LB6'],
      boundary: VIEW_LINE,
    },
    goals: [
      {
        id: 'lingular-division',
        label: 'Enter the upper lobe, then the lingula, without entering the upper division',
        test: {
          type: 'all',
          tests: [
            { type: 'event-sequence', events: ['entered:LUL', 'entered:LB4+5'] },
            { type: 'without', event: 'entered:LUL-UD' },
          ],
        },
      },
      {
        id: 'lingular-segments',
        label: 'Enter LB4, withdraw into the lingula, then enter LB5',
        test: {
          type: 'event-sequence',
          events: ['entered:LB4', 'withdrew-to:LB4+5', 'entered:LB5'],
        },
      },
      {
        id: 'retrace',
        label: 'Withdraw from LB5 to the left main bronchus',
        test: { type: 'event-sequence', events: ['entered:LB5', 'withdrew-to:LMSB'] },
      },
      {
        id: 'superior-segment',
        label: 'Enter the lower lobe, then LB6, without entering a basal segment',
        test: {
          type: 'all',
          tests: [
            {
              type: 'event-sequence',
              events: ['entered:LB5', 'withdrew-to:LMSB', 'entered:LLL', 'entered:LB6'],
            },
            { type: 'without', event: 'entered:LB7+8' },
            { type: 'without', event: 'entered:LB9' },
            { type: 'without', event: 'entered:LB10' },
          ],
        },
      },
    ],
  },

  moreActs: {
    images: {
      kind: 'find',
      outcomeId: 'name-left-airways',
      find: {
        id: 'left-lung-views',
        prompt:
          'Six views of the left lung, as the scope saw them. Click the opening each one asks for.',
        rows: [
          {
            id: 'main-end',
            frameId: 'left-main-end',
            context: 'You have followed the left main bronchus to where it ends.',
            prompt: 'Click the left lower lobe.',
            targetId: 'lll',
            rationale:
              'The upper lobe opening shows its own division just inside: the upper division and the lingula. The lower lobe is the other opening.',
          },
          {
            id: 'upper-lobe',
            frameId: 'left-upper-lobe',
            context:
              'You are inside the left upper lobe bronchus. The patient’s head is toward the top of this view.',
            prompt: 'Click the lingula.',
            targetId: 'lingula',
            rationale:
              'The upper division runs up toward the apex. The lingula is the opening that runs down and forward, and it is still part of the upper lobe.',
          },
          {
            id: 'upper-division',
            frameId: 'left-upper-division',
            context: 'You are inside the upper division. Anterior is to the right of this view.',
            prompt: 'Click LB1+2, the apicoposterior segment.',
            targetId: 'lb1-2',
            rationale:
              'LB3 is anterior, so it is the opening on the right. LB1+2 is the other one: a single opening for the apical and posterior segments.',
          },
          {
            id: 'lingula',
            frameId: 'lingula',
            context:
              'You are in the left upper lobe, looking down the lingula. The upper division is the large opening above it.',
            prompt: 'Click LB4.',
            targetId: 'lb4',
            rationale:
              'LB4 is the superior lingular segment, so it is the opening nearer the upper division. LB5, the inferior segment, lies below it.',
          },
          {
            id: 'lower-lobe',
            frameId: 'left-lower-lobe',
            rotation: 90,
            context:
              'You have just entered the left lower lobe. The scope has been rotated a quarter turn.',
            prompt: 'Click LB6, the superior segment.',
            targetId: 'lb6',
            rationale:
              'LB6 leaves first and stands apart from the basal openings beyond it. Rotation moved it on the screen. It did not change which opening comes first.',
          },
          {
            id: 'basal',
            frameId: 'left-basal',
            context:
              'You are past LB6, at the basal openings. Posterior is to the right of this view.',
            prompt: 'Click LB7+8, the anteromedial basal segment.',
            targetId: 'lb7-8',
            rationale:
              'LB10 is posterior, so it is on the right. LB7+8 is anteromedial and sits on the opposite side. LB9, lateral, lies between them here.',
          },
        ],
        sourceRefs: ANATOMY,
      },
    },
  },

  prediction: {
    id: 'mc-left-main-length',
    itemType: 'management-decision',
    situation:
      'You finish the right lung, withdraw to the carina and enter the left main bronchus. You advance as far as the right upper lobe came on the other side, watching the walls. No opening has appeared.',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label: 'Withdraw to the carina and check which bronchus you entered',
        rationale:
          'You entered the left side, and the walls look as they should. A run with no openings is the normal left main bronchus.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Continue down the left main bronchus, lumen centred, to its end',
        rationale:
          'The left main bronchus is far longer than the right. No lobe leaves it until it ends at the upper and lower lobes.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Rotate and deflect to search the lateral wall at this level',
        rationale:
          'This stretch has no opening to find. The upper lobe leaves at the far end of the main bronchus, not beside the carina.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Record a missing left upper lobe and move to the lower lobe',
        rationale:
          'Nothing is missing. You have not reached the upper lobe yet, and the lumen ahead is still the main bronchus.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The left main bronchus is much longer than the right. No lobe leaves it until it ends, where the upper lobe and the lower lobe open together. Follow it there before you name anything.',
    objectiveIds: ['M09-O1'],
    outcomeIds: ['name-left-airways'],
    claimClass: 'source',
    sourceRefs: ANATOMY,
  },

  transfer: {
    id: 'left-side-transfer',
    itemType: 'management-decision',
    situation:
      'You are on the left when the patient coughs and the view rolls. When it settles you face an opening with two smaller openings inside. It could be the lingula or the basal end of the lower lobe.',
    stem: 'What do you do before you name them?',
    choices: [
      {
        id: 'a',
        label: 'Name them LB4 and LB5 from the count of two',
        rationale:
          'A close view of the basal openings can show two as well. The count does not tell you which lobe you are in.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Advance into the larger one and name it from inside',
        rationale:
          'Deeper is one more step from the last airway you could name. Nothing inside a segment tells you its parent.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Withdraw until the upper and lower lobe openings are both in view',
        rationale:
          'From the end of the left main bronchus you can name the lobe you enter. The division and the segment follow from that.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Pause and rotate the view until the pair looks like the atlas',
        rationale:
          'Rotation changes where the openings sit on the screen. It does not tell you which lobe you are in.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'On the left, the lobe comes first. Withdraw to the two openings where the main bronchus ends, choose the lobe, and name the division and the segment on the way back in.',
    objectiveIds: ['M09-O1', 'M09-O3'],
    outcomeIds: ['name-left-airways'],
    claimClass: 'source',
    sourceRefs: NAVIGATION,
    transferVariant:
      'Lost inside a lobe after a cough, where the prediction was on the way down the main bronchus with nothing yet passed.',
  },

  practice: [
    {
      id: 'mc-lb7-8-convention',
      presentationTitle: 'Three basal openings on the left',
      situation:
        'You are in the left lower lobe of a stable patient, past LB6. You count three basal openings. Your report template has four basal lines, as it does for the right.',
      item: {
        id: 'mc-lb7-8-convention',
        itemType: 'management-decision',
        stem: 'What do you do next?',
        choices: [
          {
            id: 'a',
            label: 'Inspect all three and record LB7+8, LB9 and LB10',
            rationale:
              'On the left LB7 and LB8 usually share one opening. Three basal openings is the full count.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Record LB7 as not seen and the lobe as incomplete',
            rationale:
              'You saw every opening this lobe has. LB7 is inside the anteromedial opening you inspected, not missing.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Advance into the medial opening to find a separate LB7',
            rationale:
              'There is no fourth opening to reach. Going deeper searches for a branch this patient does not have.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Go back to LB6 and look beside it for the fourth',
            rationale:
              'LB6 is the superior segment and has no basal neighbour. The basal openings are the three already in view.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The left lower lobe usually has three basal openings: LB7+8, LB9 and LB10. Inspect each and record them by those names. When LB7 does open separately, report four.',
        objectiveIds: ['M09-O4'],
        outcomeIds: ['name-left-airways'],
        claimClass: 'source',
        sourceRefs: BASAL,
        reviewItemIds: ['R01', 'R06'],
      },
    },
    {
      id: 'mc-lb4-name',
      presentationTitle: 'The same numbers, different names',
      situation:
        'You have surveyed the right lung and recorded RB4 as lateral and RB5 as medial. Now you are inside the lingula, at its two segmental openings.',
      item: {
        id: 'mc-lb4-name',
        seedId: 'Q02',
        itemType: 'signal-recognition',
        stem: 'What do you call LB4?',
        choices: [
          {
            id: 'a',
            label: 'Lateral lingular segment',
            rationale:
              'Lateral is the name of RB4, in the middle lobe. The lingular segments lie one above the other.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'Superior lingular segment',
            rationale:
              'The lingula divides into an upper and a lower segment. LB4 is the upper one, and LB5 is inferior.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label: 'Inferior lingular segment',
            rationale: 'Inferior is LB5. The lower number is the upper segment.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Medial lingular segment',
            rationale:
              'Medial is the name of RB5, in the middle lobe. No lingular segment is called medial.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The numbers match across the two lungs and the names do not. RB4 and RB5 are lateral and medial. LB4 and LB5 are superior and inferior.',
        objectiveIds: ['M09-O2'],
        outcomeIds: ['name-left-airways'],
        claimClass: 'source',
        sourceRefs: ANATOMY,
        reviewItemIds: ['R01'],
      },
    },
  ],
}
