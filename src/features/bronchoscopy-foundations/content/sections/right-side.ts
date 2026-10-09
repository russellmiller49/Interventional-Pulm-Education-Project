import type { BronchSectionDefinition } from '../types'

/**
 * The right lung (rewrite pilot, brief 6). The fellow learns the right-sided airways from the
 * survey stills, names six unlabelled views by clicking the opening asked for, one of them
 * rotated, and then drives from the bronchus intermedius into RB4, RB5 and RB6 with the labels
 * off. Sources: the course textbook's bronchial anatomy chapter (S1) and the training manual's
 * navigation and nomenclature pages (S2).
 */
const ANATOMY = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
] as const
const NAVIGATION = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 67 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
] as const

const VIEW_LINE = 'Guided travel: the scope follows the lumen. Opening names are off.'

export const section: BronchSectionDefinition = {
  id: 'right-side',
  authoringContract: 2,
  title: 'The right lung',
  shortTitle: 'Right lung',
  minutes: 9,
  activityMinutes: 5,
  moduleIds: ['M08'],
  objectives: [
    {
      objectiveId: 'M08-O1',
      subtask: 'Says where the tip is after an advance from the carina that passed a side opening.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M08-O2',
      subtask: 'Clicks the named right-sided opening on six survey frames, one of them rotated.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M08-O3',
      subtask:
        'Enters RB4 and RB5 from the middle lobe, returns to the bronchus intermedius and enters RB6.',
      evidence: 'simulated-navigation',
    },
    {
      objectiveId: 'M08-O4',
      subtask: 'Decides where to look when three basal openings are in view.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M08-O5',
      subtask: 'Decides what to do when the upper lobe shows two openings.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D05', 'D06', 'D08'],
  prerequisites: ['reference-frames', 'larynx-and-entry'],

  clinicalQuestion: 'You are in the right lung. Which airway is this, and how do you know?',
  objective: 'Name each airway of the right lung from its parent and the wall it leaves.',
  harmfulReflex:
    'Pushing on when the opening you expect is not in view. Withdraw to its parent instead.',
  harmfulReflexPatterns: [/\badvanc/i, /\bprob(e|ing)\b/i, /\bpush/i],
  anchor: {
    analogy:
      'A side street is named at the junction where it leaves the main road. Miss the junction and the houses ahead will not tell you where you are.',
    precise:
      'Name every right-sided airway by the parent it leaves and the wall it leaves from, never by where it sits on the screen.',
    checklistLabel: 'Naming a right-sided airway',
    checklist: [
      'Say which parent you are in',
      'Find anterior from a landmark',
      'Name each opening by the wall it leaves',
      'If the count is short, withdraw and look again',
    ],
  },
  outcomes: [
    {
      id: 'name-right-airways',
      text: 'Name each right-sided airway from its parent and its direction, on a rolled view.',
    },
    {
      id: 'reach-rb4-rb6',
      text: 'Drive from the bronchus intermedius into RB4, RB5 and RB6.',
    },
  ],

  spineStops: ['main-bronchi', 'lobar', 'segmental'],
  grammarRowIds: ['missing-expected-branch', 'clear-but-lost'],
  precommitDenyPatterns: [/\bintermedius\b/i],
  localPolicyIds: [],
  reviewItemIds: ['R01', 'R04', 'R06', 'R07'],

  tour: [
    {
      airway: 'RMSB',
      note: 'Short. The upper lobe opens on its lateral wall, close to the carina.',
    },
    { airway: 'RUL', note: 'Leaves the lateral wall of the right main bronchus.' },
    { airway: 'RB1', note: 'Apical. It runs up toward the apex.' },
    { airway: 'RB2', note: 'Posterior.' },
    { airway: 'RB3', note: 'Anterior.' },
    {
      airway: 'BI',
      note: 'The airway past the upper lobe origin. A bronchus, not a lobe.',
    },
    { airway: 'RML', note: 'Leaves the anterior wall where the bronchus intermedius ends.' },
    { airway: 'RB4', note: 'Lateral segment of the middle lobe.' },
    { airway: 'RB5', note: 'Medial segment of the middle lobe.' },
    { airway: 'RLL', note: 'Runs straight on, past the middle lobe opening.' },
    {
      airway: 'RB6',
      note: 'Superior segment. Leaves the posterior wall, opposite the middle lobe.',
    },
    { airway: 'RB7', note: 'Medial basal. Often the first basal opening, set apart.' },
    { airway: 'RB8', note: 'Anterior basal.' },
    { airway: 'RB9', note: 'Lateral basal.' },
    { airway: 'RB10', note: 'Posterior basal.' },
  ],

  blocks: [
    {
      id: 'standard-view',
      kind: 'pattern',
      role: 'framing',
      heading: 'Set the view first',
      body: 'Stand at the head of the bed. Hold the scope so the membranous wall sits at 6 o’clock. Anterior is then at 12 o’clock, and the patient’s right is on your right.\n\nA real view is often rolled. Find anterior from a landmark before you name anything.',
      claimClass: 'source',
      sourceRefs: ANATOMY,
    },
    {
      id: 'upper-lobe',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The upper lobe comes early',
      body: 'The right main bronchus is short. The upper lobe leaves its lateral wall just past the carina: 3 o’clock in the standard view.\n\nLook in and count three openings: RB1 apical, RB2 posterior, RB3 anterior. If you count two, withdraw: an upper lobe airway can leave the trachea instead.',
      claimClass: 'source',
      sourceRefs: ANATOMY,
      reviewItemIds: ['R01', 'R07'],
    },
    {
      id: 'two-lobes',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'Where the bronchus intermedius ends',
      body: 'Past the upper lobe origin you are in the bronchus intermedius. It ends at two lobes. The middle lobe is anterior and divides into RB4, lateral, and RB5, medial.\n\nRB6 leaves the posterior wall at the same level, opposite the middle lobe. It is the first segment of the lower lobe.',
      claimClass: 'source',
      sourceRefs: ANATOMY,
    },
    {
      id: 'basal-segments',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The four basal segments',
      body: 'Past RB6 the lower lobe divides into RB7 medial, RB8 anterior, RB9 lateral and RB10 posterior: M-A-L-P.\n\nRB7 often leaves early, apart from the other three. If you count three basal openings, withdraw and look medially.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63, to: 67 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
      ],
      reviewItemIds: ['R06'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Three errors to expect',
      body: 'Each one names an airway from the screen and not from its parent.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Calling the bronchus intermedius the upper lobe. Withdraw until you see the lateral opening you passed.',
        'Filing RB6 under the middle lobe. It leaves the posterior wall and belongs to the lower lobe.',
        'Swapping RB4 and RB5 on a rolled view. RB4 is lateral and RB5 is medial, wherever they sit.',
      ],
      claimClass: 'source',
      sourceRefs: NAVIGATION,
      reviewItemIds: ['R04'],
    },
  ],

  workspace: {
    kind: 'scope',
    view: {
      sectionId: 'right-side',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'RMSB', at: 'proximal' },
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
    outcomeId: 'reach-rb4-rb6',
    view: {
      sectionId: 'right-side',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'BI', at: 'distal' },
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
      litAirways: ['BI', 'RML', 'RB4', 'RB5', 'RLL', 'RB6'],
      boundary: VIEW_LINE,
    },
    goals: [
      {
        id: 'enter-lateral',
        label: 'Enter RB4, the lateral segment of the middle lobe',
        test: { type: 'event', event: 'entered:RB4' },
      },
      {
        id: 'enter-medial',
        label: 'Enter RB5, the medial segment of the middle lobe',
        test: { type: 'event', event: 'entered:RB5' },
      },
      {
        id: 'superior-from-lower-lobe',
        label: 'Withdraw to the bronchus intermedius, then enter RB6 from the lower lobe',
        test: {
          type: 'event-sequence',
          events: ['entered:RML', 'withdrew-to:BI', 'entered:RLL', 'entered:RB6'],
        },
      },
    ],
  },

  moreActs: {
    images: {
      kind: 'find',
      outcomeId: 'name-right-airways',
      find: {
        id: 'right-lung-views',
        prompt:
          'Six views of the right lung, as the scope saw them. Click the opening each one asks for.',
        rows: [
          {
            id: 'carina',
            frameId: 'carina',
            context:
              'You are above the carina. The view is rolled: the membranous wall is at 7 o’clock.',
            prompt: 'Click the right main bronchus.',
            targetId: 'rmb',
            rationale:
              'Put the membranous wall back at 6 o’clock in your head. The patient’s right is then on your right, and that opening is the right main bronchus.',
          },
          {
            id: 'right-main',
            frameId: 'right-main',
            context: 'You have just entered the right main bronchus.',
            prompt: 'Click the right upper lobe.',
            targetId: 'rul',
            rationale:
              'The upper lobe is the side opening on the lateral wall. The lumen that runs straight on is the bronchus intermedius.',
          },
          {
            id: 'upper-lobe',
            frameId: 'right-upper-lobe',
            context:
              'You are looking into the right upper lobe. Anterior is to the left of this view.',
            prompt: 'Click RB2, the posterior segment.',
            targetId: 'rb2',
            rationale:
              'RB3 is anterior, so it is the opening on the left. RB2 is posterior and sits opposite it. RB1, the apical segment, is the third.',
          },
          {
            id: 'intermedius-end',
            frameId: 'intermedius-end',
            context: 'You arrived from the bronchus intermedius and stopped where it ends.',
            prompt: 'Click RB6, the superior segment.',
            targetId: 'rb6',
            rationale:
              'The middle lobe is the separate opening on the anterior wall. RB6 leaves the posterior wall opposite it, at the mouth of the lower lobe.',
          },
          {
            id: 'middle-lobe',
            frameId: 'right-middle-lobe',
            context:
              'You are inside the middle lobe bronchus. The patient’s midline is to the left of this view.',
            prompt: 'Click RB4.',
            targetId: 'rb4',
            rationale:
              'RB5 is medial, so it is the opening toward the midline. RB4 is lateral and sits on the other side.',
          },
          {
            id: 'basal',
            frameId: 'right-basal',
            rotation: 90,
            context:
              'You are in the right lower lobe, past RB6. The scope has been rotated a quarter turn.',
            prompt: 'Click RB7, the medial basal segment.',
            targetId: 'rb7',
            rationale:
              'RB7 leaves early and stands apart from the other three. Rotation moved it on the screen. It did not change which opening stands apart.',
          },
        ],
        sourceRefs: ANATOMY,
      },
    },
  },

  prediction: {
    id: 'Q01',
    seedId: 'Q01',
    itemType: 'signal-recognition',
    situation:
      'You enter the right main bronchus and advance quickly, watching the lumen ahead and not the walls. When you stop, one opening sits on the anterior wall ahead, and the lumen runs on past it.',
    stem: 'Where is the tip of the scope?',
    choices: [
      {
        id: 'a',
        label: 'In the right upper lobe bronchus',
        rationale:
          'Inside the upper lobe you would face three segmental openings. Here one opening sits on a wall and the lumen runs on.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'In the bronchus intermedius',
        rationale:
          'You passed the upper lobe origin without seeing it. The airway beyond it is the bronchus intermedius, and the anterior opening ahead is the middle lobe.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'In the right lower lobe, at RB6',
        rationale:
          'RB6 leaves the posterior wall. The opening ahead is anterior, so it is the middle lobe, and you are still above it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Still in the right main bronchus',
        rationale:
          'The upper lobe opens on the lateral wall, almost at once. You passed it without looking. An anterior opening further on is the middle lobe.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The right main bronchus is short. Advance without looking and you pass the upper lobe origin on the lateral wall. Past it you are in the bronchus intermedius, which ends at the middle lobe, anterior, and the lower lobe.',
    objectiveIds: ['M08-O1'],
    outcomeIds: ['name-right-airways'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
    ],
  },

  transfer: {
    id: 'N05',
    itemType: 'management-decision',
    situation:
      'You have entered and left RB6. Further down the lower lobe, three large openings fill the view. You name them anterior, lateral and posterior basal.',
    stem: 'What do you do before you move on?',
    choices: [
      {
        id: 'a',
        label: 'Withdraw to a wider view of the lower lobe and look medially',
        rationale:
          'RB7 often leaves early, above the other three. You see its opening from further back, on the medial wall.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Call the basal segments complete and go to the left lung',
        rationale:
          'Three openings are three segments. The medial basal segment is not among them, so the lower lobe is not finished.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Advance into the largest opening to find the fourth',
        rationale:
          'RB7 opens above these three. Going deeper into one of them takes the tip further from it.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Withdraw to the middle lobe and look for it beside RB5',
        rationale:
          'RB5 is the medial segment of the middle lobe. RB7 is a lower lobe airway and opens inside the lower lobe.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The four basal segments do not always open together. RB7 often leaves early, on the medial wall. When the count is short, withdraw to the parent and look again from there.',
    objectiveIds: ['M08-O4'],
    outcomeIds: ['name-right-airways'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63, to: 67 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
    ],
    reviewItemIds: ['R06'],
    transferVariant:
      'The lower lobe, not the upper: a basal opening left behind where the prediction left the upper lobe origin behind.',
  },

  practice: [
    {
      id: 'C11',
      manifestCaseId: 'C11',
      presentationTitle: 'Two openings where three were expected',
      situation:
        'You are in the right upper lobe of a stable patient. You see two segmental openings, not three. The CT shows a small airway leaving the trachea above the carina.',
      item: {
        id: 'C11',
        itemType: 'management-decision',
        stem: 'What do you do next?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw to the trachea and find the opening the CT shows',
            rationale:
              'A tracheal bronchus is a known variant. It usually supplies the apical segment, which is why the upper lobe shows two openings.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Probe the wall where the third opening should be',
            rationale:
              'There is no lumen there. Pushing the tip into mucosa cannot find an opening that this patient does not have.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Call the larger opening RB1 so the report lists three',
            rationale:
              'That gives an opening a name it has not earned. The apical airway is somewhere else in this patient.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Pause and re-count the two openings more slowly',
            rationale:
              'The count is right. Two openings is the finding. The missing segment is explained by the CT, not by a second look.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Three openings is the usual pattern, not a rule. When one is missing, withdraw to the parent and check the CT. Here the apical airway leaves the trachea. Inspect it there and report the variant.',
        objectiveIds: ['M08-O5'],
        outcomeIds: ['name-right-airways'],
        claimClass: 'source',
        sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } }],
        reviewItemIds: ['R07'],
      },
    },
    {
      id: 'mc-rb6-parentage',
      presentationTitle: 'A posterior opening at the middle lobe level',
      situation:
        'You come down the bronchus intermedius. At the level of the middle lobe opening you see a second opening on the posterior wall, and you enter it.',
      item: {
        id: 'mc-rb6-parentage',
        itemType: 'mechanism-interpretation',
        stem: 'What do you call this airway in the report?',
        choices: [
          {
            id: 'a',
            label: 'RB6, right lower lobe',
            rationale:
              'A posterior opening at this level is the superior segment. It belongs to the lower lobe, however close it sits to the middle lobe.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'RB6, right middle lobe',
            rationale:
              'The middle lobe has two segments, RB4 and RB5. Entering RB6 next does not make it their sibling.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'RB4, right middle lobe',
            rationale:
              'RB4 is the lateral segment and lies inside the middle lobe. You reach it through the anterior opening, not the posterior one.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'RB7, right lower lobe',
            rationale:
              'RB7 is medial and opens further down, among the basal segments. This opening is posterior and comes first.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The middle lobe is anterior. RB6 leaves the posterior wall at the same level and is the first segment of the lower lobe. Name it by its parent.',
        objectiveIds: ['M08-O2', 'M08-O3'],
        outcomeIds: ['name-right-airways'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 66, to: 67 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
        ],
      },
    },
  ],
}
