import { num } from '../numbers'
import type {
  AuthoredChoice,
  BronchSectionDefinition,
  MonitorReading,
  MonitorTrend,
} from '../types'

/**
 * Bleeding (rewrite pilot, brief 14). The fellow learns the first moves for bleeding after a
 * biopsy as an ordered card, the escalation beyond it, and the Nashville scale for grading it.
 * One patient then bleeds through four frames: the vital signs change with time, a wrong move
 * plays out on the monitor, and the learner recovers from there.
 *
 * Sources: the course textbook's complications chapter (S1), the training manual (S2), the
 * Nashville consensus statement (U15) for the grades, the blocker manufacturer's note (U12) and
 * the inhaled tranexamic acid trial (U13). The topical vasoconstrictor is a local-policy slot.
 */
const COMPLICATIONS = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 138, to: 143 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 27, to: 30 } },
] as const
const NASHVILLE = [
  {
    sourceId: 'U15',
    location: { kind: 'section', label: 'Nashville Bleeding Scale, grades 1 to 4' },
  },
] as const

/** The monitor at one moment of the case. Values are written for this case. */
function vitals(
  view: string,
  spo2: readonly [string, MonitorTrend, string],
  heartRate: readonly [string, MonitorTrend],
  bloodPressure?: string,
): readonly MonitorReading[] {
  return [
    { channel: 'airway-view', words: view, trend: 'new' },
    {
      channel: 'oximetry',
      words: spo2[2],
      trend: spo2[1],
      value: spo2[0],
      unit: '%',
      provenance: 'authored',
    },
    {
      channel: 'heart-rate',
      words: heartRate[1] === 'steady' ? 'Unchanged' : 'Rising',
      trend: heartRate[1],
      value: heartRate[0],
      unit: '/min',
      provenance: 'authored',
    },
    ...(bloodPressure
      ? [
          {
            channel: 'blood-pressure' as const,
            words: 'Adequate',
            trend: 'steady' as const,
            value: bloodPressure,
            unit: 'mmHg',
            provenance: 'authored' as const,
          },
        ]
      : []),
  ]
}

const GRADE_CHOICES = (
  best: 'a' | 'b' | 'c' | 'd',
  why: Record<string, string>,
): AuthoredChoice[] =>
  (['a', 'b', 'c', 'd'] as const).map((id, index) => ({
    id,
    label: `Grade ${index + 1}`,
    rationale: why[id],
    plausibility: id === best ? 'best' : 'incorrect-mechanism',
  }))

export const section: BronchSectionDefinition = {
  id: 'bleeding-priorities',
  authoringContract: 2,
  title: 'Bleeding',
  shortTitle: 'Bleeding',
  minutes: 9,
  activityMinutes: 3,
  moduleIds: ['M15'],
  objectives: [
    {
      objectiveId: 'M15-O2',
      subtask:
        'Makes the first moves for bleeding after a biopsy, in order, through one evolving case.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M15-O5',
      subtask:
        'Changes priority when the wedge is lost and blood reaches the carina, and escalates when the first moves fail.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D13'],
  prerequisites: ['view-loss', 'protected-accessories', 'deterioration'],

  clinicalQuestion: 'Blood fills the view after a biopsy. What do you do in the next ten seconds?',
  objective: 'Make the first moves for airway bleeding in order, and grade the bleed afterwards.',
  harmfulReflex:
    'Pulling the scope back when the view turns red. The wedge is your control: stay in.',
  harmfulReflexPatterns: [
    /\b(pull|withdraw)\w*\b.*\b(scope|back|a little)\b/i,
    /\bremove the scope\b/i,
  ],
  anchor: {
    analogy:
      'A wedged scope is a finger on a cut. Lift it to look and the blood runs free. Keep the pressure on and a clot forms under it.',
    precise:
      'Keep the scope wedged in the bleeding segment, suction what escapes, and turn the bleeding side down.',
    checklistLabel: 'When blood fills the view',
    checklist: [
      'Stay in and wedge',
      'Suction, then cold saline',
      'Bleeding side down',
      'Oxygen on, call for help early',
    ],
  },
  outcomes: [
    {
      id: 'first-moves',
      text: 'Make the first moves for bleeding after a biopsy in order, and escalate when they fail.',
    },
    { id: 'grade-bleeding', text: 'Grade airway bleeding on the Nashville scale.' },
  ],

  spineStops: ['segmental', 'main-bronchi'],
  grammarRowIds: ['red-field-wedged-bleeding', 'red-out'],
  // "The left lung" is also a section title in the course map, so the guard keeps the pronoun.
  precommitDenyPatterns: [/\bher left lung\b/i, /\bother lung\b/i],
  localPolicyIds: ['bleeding_rescue', 'blocker_ifu_and_rescue'],
  reviewItemIds: ['R33', 'R34', 'R37', 'R42'],

  blocks: [
    {
      id: 'the-threat',
      kind: 'pattern',
      role: 'framing',
      heading: 'Why a small bleed matters',
      body: 'Airway bleeding kills by flooding the lungs, long before it empties the circulation. A volume that would not matter anywhere else can block the central airways.\n\nSo every first move does one of two jobs. It keeps the blood where it started, or it keeps it out of the other lung.',
      claimClass: 'source',
      sourceRefs: COMPLICATIONS,
    },
    {
      id: 'first-moves',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: blood after a biopsy',
      body: 'Say it out loud, with the site: “Bleeding, right lower lobe.” Then work down the card. Stop at the step where the bleeding stops.',
      steps: [
        'Keep the scope in. Wedge the tip in the bleeding segment and hold it there.',
        'Suction. Keep the airways you still need clear, and leave a forming clot alone.',
        'Instil cold saline in small aliquots through the wedged scope.',
        `Instil a topical vasoconstrictor: ${num('topical-vasoconstrictor')}.`,
        'Turn the patient bleeding side down.',
        'Give oxygen, stop sampling, and call for help.',
      ],
      callForHelp:
        'early: when one wedge and suction have not stopped it, or the oxygen saturation is falling.',
      claimClass: 'source',
      sourceRefs: COMPLICATIONS,
      localPolicyIds: ['bleeding_rescue'],
      reviewItemIds: ['R33', 'R34'],
    },
    {
      id: 'escalation',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'When the wedge does not hold',
      body: 'Blood at the carina means the wedge has failed. Clear the central airway before you go back to the source.\n\nIf the card has not stopped it, escalate in this order, with help in the room.',
      pointsLabel: 'Escalation',
      points: [
        'A bronchial blocker or balloon in the bleeding bronchus',
        'Selective intubation of the non-bleeding lung',
        'Rigid bronchoscopy',
        'Bronchial artery embolization',
        'Tranexamic acid, inhaled, reduced bleeding in one small trial of non-massive hemoptysis. It does not replace airway control.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        ...COMPLICATIONS,
        { sourceId: 'U12', location: { kind: 'section', label: 'Wire-guided blocker placement' } },
        { sourceId: 'U13', location: { kind: 'section', label: 'Trial result and exclusions' } },
      ],
      localPolicyIds: ['blocker_ifu_and_rescue'],
      reviewItemIds: ['R37'],
    },
    {
      id: 'nashville',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'Grade it afterwards',
      body: 'The Nashville scale grades a bleed by what it took to stop it. Put the grade in the report.',
      pointsLabel: 'Nashville grades',
      points: [
        `Grade 1: ${num('nashville-grade-1')}.`,
        `Grade 2: ${num('nashville-grade-2')}.`,
        `Grade 3: ${num('nashville-grade-3')}.`,
        `Grade 4: ${num('nashville-grade-4')}.`,
      ],
      claimClass: 'update',
      sourceRefs: NASHVILLE,
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Four errors to expect',
      body: 'Each one gives up control of the airway for a better look.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Pulling back to see. You release the blood into clear airways. Stay wedged.',
        'Suctioning the clot away to check. A quiet field with a clot is control. Leave it.',
        'Reading the suction trap. Saline is in it too. Judge the airway and the saturation.',
        'Turning the bleeding side up. Gravity now drains blood into the lung you need.',
      ],
      claimClass: 'source',
      sourceRefs: COMPLICATIONS,
      reviewItemIds: ['R34', 'R42'],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption: 'Before the biopsy',
    readings: vitals('Clear', ['96', 'steady', 'On nasal oxygen'], ['88', 'steady'], '132/76'),
  },

  act: {
    kind: 'scenario',
    outcomeId: 'first-moves',
    scenario: {
      id: 'right-lower-lobe-bleed',
      title: 'Bleeding after a transbronchial biopsy',
      frames: [
        {
          id: 'blood-fills-the-view',
          time: 'Seconds after the fourth biopsy',
          situation:
            'A 58-year-old woman is having transbronchial biopsies of the right lower lobe under moderate sedation. As the forceps come out, blood wells up around the tip and the view turns red.',
          readings: vitals(
            'Red. The tip is still in the segment',
            ['95', 'steady', 'On 2 L/min nasal oxygen'],
            ['92', 'steady'],
            '134/78',
          ),
          prompt: 'What do you do first?',
          choices: [
            {
              id: 'a',
              label: 'Advance the tip and wedge it in the segment',
              rationale:
                'The wedge keeps the blood in the segment it came from, so a clot can form behind the tip.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Pull the scope back to the carina for a clear view',
              rationale: 'Pulling back releases the blood into airways that were clear.',
              plausibility: 'unsafe',
              consequence: {
                situation:
                  'Blood follows the scope up the right main bronchus and reaches the carina. She coughs.',
                readings: vitals(
                  'Blood at the carina',
                  ['90', 'falling', 'Falling'],
                  ['108', 'rising'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Pause sampling and wait for the bleeding to slow',
              rationale:
                'Stopping sampling is right. Waiting without a wedge lets the blood track up the lower lobe.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Blood fills the lower lobe bronchus and spills toward the middle lobe.',
                readings: vitals(
                  'Red. Blood is moving up the lower lobe',
                  ['92', 'falling', 'Falling'],
                  ['98', 'rising'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Suction hard at the biopsy site until you can see',
              rationale: 'Hard suction at the site strips the clot and keeps the bleeding going.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The view clears for a second, then fills again, faster than before.',
                readings: vitals('Red again', ['93', 'falling', 'Falling'], ['100', 'rising']),
              },
            },
          ],
        },
        {
          id: 'wedged-and-red',
          time: '1 minute after the biopsy',
          situation:
            'The tip is wedged in the segment and nothing is escaping past it. The view is still red. Suction returns blood mixed with saline.',
          readings: vitals(
            'Red. Nothing escaping past the tip',
            ['94', 'steady', 'Holding'],
            ['96', 'steady'],
            '138/80',
          ),
          prompt: 'The view is still red. What now?',
          choices: [
            {
              id: 'a',
              label: 'Hold the wedge and instil cold saline',
              rationale:
                'A red view behind a working wedge is expected. Cold saline is the next step, and the wedge stays.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Withdraw a little to check whether it has stopped',
              rationale:
                'The wedge is the control. Checking by withdrawing releases whatever has not clotted.',
              plausibility: 'unsafe',
              consequence: {
                situation: 'Blood runs past the tip into the lower lobe bronchus.',
                readings: vitals(
                  'Blood escaping past the tip',
                  ['91', 'falling', 'Falling'],
                  ['104', 'rising'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Call it controlled and take the last two biopsies',
              rationale:
                'Sampling ends when a bleed needs a wedge. The forceps will dislodge the clot.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The forceps knock the clot loose and the bleeding restarts.',
                readings: vitals('Red, brisker', ['92', 'falling', 'Falling'], ['102', 'rising']),
              },
            },
            {
              id: 'd',
              label: 'Turn her onto her left side',
              rationale:
                'Left side down puts the bleeding lung on top. Blood then drains across the carina.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Blood crosses the carina and enters the left main bronchus.',
                readings: vitals(
                  'Blood in the left main bronchus',
                  ['88', 'falling', 'Falling'],
                  ['112', 'rising'],
                ),
              },
            },
          ],
        },
        {
          id: 'wedge-lost',
          time: '3 minutes after the biopsy',
          situation:
            'She coughs hard and the tip is pushed out of the segment. Blood is in the right main bronchus and at the carina.',
          readings: vitals(
            'Blood at the carina',
            ['88', 'falling', 'Falling'],
            ['114', 'rising'],
            '150/88',
          ),
          prompt: 'The wedge is lost. What do you do?',
          choices: [
            {
              id: 'a',
              label: 'Clear the carina and left main, right side down, call for help',
              rationale:
                'The left lung is now keeping her alive. Clear it, let gravity hold the blood on the right, and get help coming.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Go straight back and re-wedge the right lower lobe segment',
              rationale:
                'The source can wait a few seconds. Blood in the left main bronchus cannot.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'You find the segment again, but the left main bronchus fills while you work.',
                readings: vitals(
                  'Wedged. The left side is unseen',
                  ['84', 'falling', 'Falling'],
                  ['120', 'rising'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Remove the scope so she can cough it clear',
              rationale:
                'Without the scope you cannot suction or see. A sedated patient will not clear this alone.',
              plausibility: 'unsafe',
              consequence: {
                situation: 'She coughs weakly. Blood pools in both main bronchi.',
                readings: vitals('No view', ['82', 'falling', 'Falling'], ['124', 'rising']),
              },
            },
            {
              id: 'd',
              label: 'Instil the vasoconstrictor at the carina and wait',
              rationale:
                'A drug at the carina does not reach the source, and waiting leaves the airway full.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The carina stays covered. Nothing has changed at the source.',
                readings: vitals(
                  'Blood at the carina',
                  ['85', 'falling', 'Falling'],
                  ['118', 'rising'],
                ),
              },
            },
          ],
        },
        {
          id: 'still-bleeding',
          time: '6 minutes after the biopsy',
          situation:
            'She is right side down on high-flow oxygen and help has arrived. The left side is clear. Blood keeps welling from the right lower lobe despite a second wedge and cold saline.',
          readings: vitals(
            'Fresh blood from the right lower lobe',
            ['91', 'steady', 'Holding on high-flow oxygen'],
            ['110', 'steady'],
            '146/86',
          ),
          prompt: 'It has not stopped. What is the next step?',
          choices: [
            {
              id: 'a',
              label: 'Place a bronchial blocker in the right lower lobe bronchus',
              rationale:
                'Wedge, saline and position have failed. A blocker isolates the bleeding lobe and frees the scope.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Keep wedging and repeat cold saline for ten more minutes',
              rationale:
                'Repeating a step that has failed costs time while she bleeds. Move up the list.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Ten minutes on, the bleeding continues and she is tiring.',
                readings: vitals('Fresh blood', ['89', 'falling', 'Falling'], ['116', 'rising']),
              },
            },
            {
              id: 'c',
              label: 'Send her for bronchial artery embolization now',
              rationale:
                'She may need it, but she cannot travel with an unprotected airway. Isolate the lobe first.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'In the lift the wedge slips and no one can reach the airway.',
                readings: vitals('No view', ['83', 'falling', 'Falling'], ['126', 'rising']),
              },
            },
            {
              id: 'd',
              label: 'Pause, and intubate with a standard tube in the trachea',
              rationale:
                'A tube in the trachea ventilates both lungs and protects neither. Isolation needs a blocker or a tube in the left main.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The tube is in. Blood still reaches the left lung through it.',
                readings: vitals(
                  'Blood in the tube',
                  ['87', 'falling', 'Falling'],
                  ['118', 'rising'],
                ),
              },
            },
          ],
        },
      ],
      sourceRefs: [
        ...COMPLICATIONS,
        { sourceId: 'U12', location: { kind: 'section', label: 'Wire-guided blocker placement' } },
      ],
    },
  },

  prediction: {
    id: 'Q27',
    seedId: 'Q27',
    itemType: 'management-decision',
    situation:
      'A 64-year-old woman has a transbronchial biopsy of the right lower lobe. As the forceps come out, blood fills the view. Her SpO₂ is 95% on 2 L/min.',
    stem: 'What matters most in the next minute?',
    choices: [
      {
        id: 'a',
        label: 'Keeping blood out of her left lung',
        rationale:
          'Airway bleeding kills by flooding the lungs. Her left lung is the one that must keep working, so every move protects it.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Starting a second large-bore line for fluid',
        rationale:
          'She is not short of volume. A small bleed threatens gas exchange long before it threatens the circulation.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Pulling the scope back to see how much is bleeding',
        rationale:
          'Pulling back frees the blood to run into clear airways, and you learn nothing that changes the first move.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Pausing to let the bleeding settle before you act',
        rationale:
          'Most bleeds do settle. An unwedged scope leaves the blood free to spread while you wait.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The airways hold very little. Blood that reaches the other lung stops gas exchange there too. Wedge to keep it in the segment, and position her to keep it on the right.',
    objectiveIds: ['M15-O5', 'M15-O2'],
    outcomeIds: ['first-moves'],
    claimClass: 'source',
    sourceRefs: COMPLICATIONS,
    reviewItemIds: ['R34'],
  },

  transfer: {
    id: 'bleeding-priorities-transfer',
    itemType: 'mechanism-interpretation',
    situation:
      'A 71-year-old man bleeds after a transbronchial biopsy of the left upper lobe. You wedge, suction for 2 minutes and instil cold saline twice. It stops. He goes back to the ward.',
    stem: 'Which Nashville grade is this?',
    choices: GRADE_CHOICES('b', {
      a: 'Grade 1 stops with under a minute of suction, or one wedge. This needed longer, and cold saline.',
      b: 'Suction for more than a minute and cold saline each make it grade 2. Nothing more was needed.',
      c: 'Grade 3 needs a blocker or selective intubation, or a procedure stopped early. None of those happened.',
      d: 'Grade 4 means prolonged isolation, intensive care, transfusion, embolization or resuscitation. He went back to the ward.',
    }),
    explanation: `Grade by what it took. Grade 2 is ${num('nashville-grade-2')}. He needed nothing further up the list.`,
    objectiveIds: ['M15-O2'],
    outcomeIds: ['grade-bleeding'],
    claimClass: 'update',
    sourceRefs: NASHVILLE,
    transferVariant:
      'A different patient and lobe, and a different question: the grade, not the first move.',
  },

  practice: [
    {
      id: 'mc-red-trap',
      presentationTitle: 'A red view with nothing sampled',
      situation:
        'You are advancing into the left lower lobe during a survey. Nothing has been sampled and the channel is empty. The view turns uniformly red.',
      item: {
        id: 'mc-red-trap',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Relax the bend and ease back to the lumen',
            rationale:
              'Red on the way in, with nothing sampled, is the lens against the wall. Easing back shows the lumen again.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Hold still and call for the bleeding kit',
            rationale:
              'Nothing has been sampled, so nothing is bleeding. Holding the tip against the wall keeps the view red.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Wedge the tip where it is and suction',
            rationale:
              'A wedge is for a segment you have sampled. Here suction pulls mucosa onto the lens.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Keep going forward to find the lumen beyond',
            rationale: 'With no lumen in view, forward movement drives the tip into the wall.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Context separates the two red views. After a biopsy, red with the tip in the segment is blood, and you stay. On the way in, with nothing sampled, it is wall contact, and you ease back.',
        objectiveIds: ['M15-O2'],
        outcomeIds: ['first-moves'],
        claimClass: 'source',
        sourceRefs: COMPLICATIONS,
      },
    },
    {
      id: 'mc-blocker-then-stop',
      presentationTitle: 'A blocker, then the procedure ends',
      situation:
        'A 66-year-old woman bleeds briskly after a transbronchial biopsy. A wedge and cold saline fail. A bronchial blocker is inflated for 12 minutes, the bleeding stops, and you end the procedure. She goes home that evening.',
      item: {
        id: 'mc-blocker-then-stop',
        itemType: 'mechanism-interpretation',
        stem: 'Which Nashville grade is this?',
        choices: GRADE_CHOICES('c', {
          a: 'Grade 1 stops with brief suction or one wedge. This bleed needed far more than that.',
          b: 'Grade 2 stops with longer suction, a repeat wedge or cold saline. Here those failed.',
          c: 'A blocker held for a short time, and a procedure stopped early, each make it grade 3.',
          d: 'Grade 4 needs prolonged isolation, intensive care, transfusion, embolization or resuscitation. She went home.',
        }),
        explanation: `Grade 3 is ${num('nashville-grade-3')}. Either one is enough, and she had both.`,
        objectiveIds: ['M15-O2'],
        outcomeIds: ['grade-bleeding'],
        claimClass: 'update',
        sourceRefs: NASHVILLE,
      },
    },
    {
      id: 'mc-intensive-care-after-bleed',
      presentationTitle: 'Intubated and admitted after a bleed',
      situation:
        'A 59-year-old man bleeds heavily after a transbronchial biopsy. The left main bronchus is intubated selectively for 45 minutes. He is admitted to intensive care and receives 2 units of red cells.',
      item: {
        id: 'mc-intensive-care-after-bleed',
        itemType: 'mechanism-interpretation',
        stem: 'Which Nashville grade is this?',
        choices: GRADE_CHOICES('d', {
          a: 'Grade 1 stops by itself with brief suction or one wedge. This did not.',
          b: 'Grade 2 stops with suction, a repeat wedge or cold saline. He needed airway isolation.',
          c: 'Grade 3 is isolation for a short time. His lasted longer, and he needed intensive care and blood.',
          d: 'Prolonged selective intubation, a new intensive care admission and transfusion each make it grade 4.',
        }),
        explanation: `Grade 4 is ${num('nashville-grade-4')}. Any one of these is enough.`,
        objectiveIds: ['M15-O5'],
        outcomeIds: ['grade-bleeding'],
        claimClass: 'update',
        sourceRefs: NASHVILLE,
      },
    },
  ],
}
