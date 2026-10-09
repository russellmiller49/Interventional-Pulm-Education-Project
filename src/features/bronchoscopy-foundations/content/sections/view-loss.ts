import type { BronchSectionDefinition } from '../types'

/**
 * Losing and regaining the view (rewrite, brief 8). The fellow learns the five causes of a lost
 * view and the recovery as a first-move card, names the cause of five described fields, then
 * recovers twice in the simulator: from a red field with the lens on the wall, and from a smeared
 * lens.
 *
 * Brief 8 asks for each cause on a still and for the causes to be named on five stills. No
 * photograph of a red-out, a fogged lens, secretions or blood is in the repository yet, so the
 * causes are named from descriptions here. Replace `moreActs.causes` with image questions when the
 * abnormal images are cleared. Sources: the course textbook's chapter on technique (S1) and the
 * training manual's navigation pages (S2).
 */
const VIEW_LOSS = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
] as const
const ACCESSORY = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 128 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23 } },
] as const

export const section: BronchSectionDefinition = {
  id: 'view-loss',
  authoringContract: 2,
  title: 'Losing and regaining the view',
  shortTitle: 'Lost view',
  minutes: 8,
  activityMinutes: 4,
  moduleIds: ['M06'],
  objectives: [
    {
      objectiveId: 'M06-O3',
      subtask:
        'Names the cause of a lost view from what fills the screen and what the scope was doing.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M06-O4',
      subtask:
        'Recovers a lumen without advancing blind, with a tool out of the channel accounted for first.',
      evidence: 'simulated-navigation',
    },
  ],
  drillIds: ['D09'],
  prerequisites: ['five-controls', 'larynx-and-entry'],

  clinicalQuestion:
    'The lumen has gone from the screen. What is in the way, and what do you do first?',
  objective: 'Name the cause of a lost view and get a lumen back without advancing blind.',
  harmfulReflex: 'Advancing when you cannot see a lumen. Stop, name the cause, and come back.',
  harmfulReflexPatterns: [/\badvanc/i, /\bpush/i],
  anchor: {
    analogy:
      'A windscreen can go blank from mud, from mist or from a wall in front of you. You do not drive on to find out which. You stop, name it, and clear it.',
    precise:
      'A lost view has five causes, and what fills the screen tells you which: stop advancing and name it before you touch a control.',
    checklistLabel: 'When the view is lost',
    checklist: [
      'Stop advancing',
      'Name what fills the screen',
      'Withdraw, then irrigate and suction, then wipe',
      'Still lost: back to the carina',
    ],
  },
  outcomes: [
    {
      id: 'name-the-cause',
      text: 'Name the cause of a lost view from the screen and from what the scope was doing.',
    },
    {
      id: 'recover-the-view',
      text: 'Get a lumen back in order: withdraw, irrigate and suction, wipe, then the carina.',
    },
  ],

  spineStops: ['trachea', 'carina'],
  grammarRowIds: ['red-out', 'lens-obscured', 'white-out', 'dark-field', 'clear-but-lost'],
  precommitDenyPatterns: [/\blens is on the mucosa\b/i, /\bpulls the wall onto\b/i],
  localPolicyIds: [],
  reviewItemIds: ['R04', 'R34'],

  tour: [{ airway: 'TR', note: 'Home base. Still lost? Come back to here and find the carina.' }],

  blocks: [
    {
      id: 'usable-view',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'What a usable view is',
      body: 'A usable view has an open lumen, walls in focus and a landmark you can name. Lose one and you have lost the view.\n\nDo not advance without it. Stop, and name what fills the screen.',
      media: { kind: 'endoscopic-still', structureId: 'trachea', outline: false },
      claimClass: 'source',
      sourceRefs: VIEW_LOSS,
      reviewItemIds: ['R04'],
    },
    {
      id: 'five-causes',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Five causes, five looks',
      body: 'Red is not always blood. Ask what the scope was just doing.',
      pointsLabel: 'The cause, then how it looks',
      points: [
        'Wall contact: a flat pink or red field, straight after an advance or a bend.',
        'Smear or fog: the whole picture is hazy, wherever you point.',
        'Secretions: white or yellow material that shifts with breathing.',
        'Blood: red that flows, pools and comes from one place.',
        'Disorientation: a sharp picture of an airway you cannot name.',
      ],
      claimClass: 'source',
      sourceRefs: VIEW_LOSS,
    },
    {
      id: 'recovery',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: the view is gone',
      body: 'Say it out loud: “I have lost the view.” Stop advancing, and put any tool back in its sheath. Then work down the card until the lumen comes back.',
      steps: [
        'Withdraw to the last lumen you were sure of, easing the bend as you come back.',
        'Irrigate with saline, then suction. Suction on the wall pulls mucosa onto the lens.',
        'Wipe the lens with a gentle touch of the tip on the mucosa.',
        'Still lost? Go back to the carina and start again from there.',
      ],
      callForHelp:
        'when blood keeps coming, or the oxygen saturation falls while you cannot see. A scope wedged on a bleeding segment stays where it is.',
      claimClass: 'source',
      sourceRefs: VIEW_LOSS,
      reviewItemIds: ['R34'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Five errors to expect',
      body: 'Each one acts before the cause has a name.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Reading every red field as bleeding. Ask what the scope was just doing.',
        'Suctioning with the lens on the wall. Come off the wall first.',
        'Taking a smeared lens for a blocked airway. Clear the lens and look again.',
        'Advancing into the dark. Withdraw to a view you know.',
        'Trusting a sharp picture you cannot name. Go back to the parent, or to the carina.',
      ],
      claimClass: 'source',
      sourceRefs: VIEW_LOSS,
      reviewItemIds: ['R04'],
    },
  ],

  workspace: {
    kind: 'scope',
    view: {
      sectionId: 'view-loss',
      mode: 'free-drive',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'TR', at: 'mid' },
      controls: [],
      assists: {},
      script: 'red-out',
      litAirways: ['TR'],
      boundary: 'The red field is scripted for practice.',
    },
  },

  act: {
    kind: 'scope-lab',
    outcomeId: 'recover-the-view',
    view: {
      sectionId: 'view-loss',
      mode: 'free-drive',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'TR', at: 'mid' },
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'suction', 'reset'],
      assists: {},
      readouts: ['contactCount', 'lossOfViewCount'],
      script: 'red-out',
      litAirways: ['TR'],
      boundary: 'The red field is scripted for practice.',
    },
    goals: [
      {
        id: 'lumen-back-without-advancing',
        label: 'Bring the lumen back without advancing while the field is red',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'red-out-recovered' },
            { type: 'without', event: 'advanced-in-red-out' },
          ],
        },
      },
      {
        id: 'lumen-back-without-suction',
        label: 'Keep suction off until the lumen is back',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'red-out-recovered' },
            { type: 'without', event: 'suction-in-red-out' },
          ],
        },
      },
      {
        id: 'on-to-the-carina',
        label: 'Then, with the lumen back, advance as far as the main carina',
        test: { type: 'event-sequence', events: ['red-out-recovered', 'reached-carina'] },
      },
    ],
  },

  moreActs: {
    causes: {
      kind: 'sort',
      outcomeId: 'name-the-cause',
      sort: {
        id: 'lost-view-causes',
        prompt: 'Five lost views. Match each one to its cause.',
        origins: [
          { id: 'wall', label: 'Wall contact', definition: 'The lens is on the mucosa.' },
          { id: 'lens', label: 'Smear or fog', definition: 'A film is on the lens.' },
          {
            id: 'secretions',
            label: 'Secretions',
            definition: 'Material lies in the airway ahead.',
          },
          { id: 'blood', label: 'Blood', definition: 'The airway is bleeding.' },
          {
            id: 'lost',
            label: 'Disorientation',
            definition: 'The picture is clear and you cannot name it.',
          },
        ],
        rows: [
          {
            id: 'flat-red-after-advance',
            statement:
              'You advance with the tip bent. The whole screen turns an even pink-red. The patient is unchanged.',
            origin: 'wall',
            rationale: 'A flat red field straight after an advance is mucosa at touching distance.',
          },
          {
            id: 'hazy-everywhere',
            statement:
              'You can make out the lumen, but it is hazy. It stays hazy wherever you point the scope.',
            origin: 'lens',
            rationale: 'A film on the lens travels with the scope. Irrigate, suction, then wipe.',
          },
          {
            id: 'pale-pool',
            statement:
              'A thick yellow-white pool covers the lower half of the view and shifts as the patient breathes.',
            origin: 'secretions',
            rationale:
              'Material in the airway moves with the breath, not with the scope. Suction it.',
          },
          {
            id: 'red-welling',
            statement:
              'A minute after a biopsy, red fluid wells up from one segment and spreads across the view.',
            origin: 'blood',
            rationale:
              'Red that flows from one place is blood. Hold the scope there and work the bleeding card.',
          },
          {
            id: 'sharp-unnamed',
            statement:
              'The picture is sharp: a carina and two openings. You cannot say which lobe you are in.',
            origin: 'lost',
            rationale: 'Clear and lost. Withdraw to the last airway you could name.',
          },
        ],
        sourceRefs: VIEW_LOSS,
      },
    },
    lens: {
      kind: 'scope-lab',
      outcomeId: 'recover-the-view',
      view: {
        sectionId: 'view-loss',
        mode: 'free-drive',
        profile: 'adult-teaching-combined-left-basal-v1',
        start: { kind: 'airway', label: 'TR', at: 'distal' },
        controls: ['advance', 'withdraw', 'rotate', 'deflect', 'suction', 'clearLens', 'reset'],
        assists: {},
        readouts: ['currentAirway'],
        script: 'lens-contamination',
        litAirways: ['TR'],
        boundary: 'The smear is scripted for practice.',
      },
      goals: [
        {
          id: 'lens-cleared-without-advancing',
          label: 'Clear the lens, with no advance made while the picture is smeared',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'lens-cleared' },
              { type: 'without', event: 'advanced-blind' },
            ],
          },
        },
      ],
    },
  },

  prediction: {
    id: 'Q04',
    seedId: 'Q04',
    itemType: 'signal-recognition',
    situation:
      'You are halfway down the trachea of a sedated patient. No tool is out and nothing has been sampled. You advance with the tip bent, and the screen turns an even pink-red. The patient is unchanged.',
    stem: 'What has most likely happened?',
    choices: [
      {
        id: 'a',
        label: 'The tracheal wall has started to bleed',
        rationale:
          'Nothing has been sampled, and the field came with the advance. Blood flows and pools. This field is flat and even.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'The lens is against the tracheal wall',
        rationale:
          'A flat pink-red field straight after an advance with the tip bent is mucosa, seen from touching distance.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Secretions have covered the lens',
        rationale:
          'A smear blurs the picture you had. It does not swap it for an even red field in one movement.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'The light source has failed',
        rationale: 'A failed light gives a dark screen. This one is bright and red.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The lens is on the mucosa. Stop advancing, withdraw a little and ease the bend, and the lumen comes back. Do not suction first: it pulls the wall onto the tip.',
    objectiveIds: ['M06-O3'],
    outcomeIds: ['name-the-cause'],
    claimClass: 'source',
    sourceRefs: VIEW_LOSS,
    reviewItemIds: ['R04'],
  },

  transfer: {
    id: 'view-loss-transfer',
    itemType: 'management-decision',
    situation:
      'You are near a right upper lobe segment with a cytology brush out of its sheath. The patient coughs. When the picture settles it is sharp, and you cannot name the airway in front of you.',
    stem: 'What do you do first?',
    choices: [
      {
        id: 'a',
        label: 'Brush the airway in view now, while the picture is sharp',
        rationale:
          'A sharp picture of an airway you cannot name gives a specimen from a place you cannot report.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Withdraw all the way to the carina with the brush still out',
        rationale:
          'The destination is right and the order is not. An exposed brush drags along every wall it passes.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Sheath the brush, then withdraw to the last airway you named',
        rationale:
          'The tool is made safe before the scope moves. Then you go back to the last lumen you were sure of.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Advance to the next carina to get your bearings',
        rationale:
          'Deeper is further from the last airway you could name, and the brush goes with you.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'A clear picture is not a known position. Put the tool away first, then withdraw to the last lumen you were sure of. If that does not place you, go back to the carina.',
    objectiveIds: ['M06-O4', 'M06-O3'],
    outcomeIds: ['recover-the-view'],
    claimClass: 'source',
    sourceRefs: [...VIEW_LOSS, ...ACCESSORY],
    transferVariant:
      'A clear picture with a tool out, where the prediction was a red field with nothing deployed.',
  },

  practice: [
    {
      id: 'C02',
      manifestCaseId: 'C02',
      presentationTitle: 'A sharp picture and a doubtful name',
      situation:
        'You enter the left upper lobe and take the lower of its two openings. The picture is sharp. Your assistant labels the two openings ahead as basal segments of the lower lobe.',
      item: {
        id: 'C02',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Keep the label and photograph both openings',
            rationale:
              'Your path went through the upper lobe. Two clear openings here are the lingular segments, whatever the label says.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'Advance into the larger opening to see what lies beyond',
            rationale:
              'Nothing inside a segment names its parent. Deeper only adds a step to the way back.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Pause and have the assistant count the openings again',
            rationale:
              'The count is not in doubt. The parent is, and you can only see that from further back.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw to where the left main bronchus ends and name again',
            rationale:
              'From there you see both lobes, and the path you took names what you entered.',
            plausibility: 'best',
          },
        ],
        explanation:
          'This is disorientation with a clear picture. The path, not the look of the openings, names an airway. Withdraw to the last lumen you were sure of and come forward again.',
        objectiveIds: ['M06-O4'],
        outcomeIds: ['recover-the-view'],
        claimClass: 'source',
        sourceRefs: [
          ...VIEW_LOSS,
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        ],
      },
    },
    {
      id: 'mc-dark-field',
      presentationTitle: 'The picture goes dark',
      situation:
        'You enter a small segment of the left lower lobe. The picture was bright a moment ago. Now most of it is dark, and you cannot see a lumen.',
      item: {
        id: 'mc-dark-field',
        itemType: 'management-decision',
        stem: 'What do you do first?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw to the last airway that was bright and clear',
            rationale:
              'From a view you know you can tell shadow from fluid from a blocked airway, and choose the next move.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Stay where you are and turn up the light on the processor',
            rationale:
              'The light was fine a moment ago. Check it once you are back where you can see.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'c',
            label: 'Advance toward the darkest part of the field',
            rationale:
              'Darkness is not a direction. It may be a wall in shadow, pooled fluid or a blocked airway.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Suction, to lift whatever is blocking the light',
            rationale:
              'You do not know that anything is there, or that the tip is off the wall. Come back first.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A dark field in a small airway has several causes, and none is fixed by going deeper. Withdraw to the last clear lumen and work down the card from there.',
        objectiveIds: ['M06-O3'],
        outcomeIds: ['name-the-cause'],
        claimClass: 'source',
        sourceRefs: VIEW_LOSS,
        reviewItemIds: ['R04'],
      },
    },
  ],
}
