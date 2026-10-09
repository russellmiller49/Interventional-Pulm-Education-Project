import { num } from '../numbers'
import type { AuthoredChoice, BronchSectionDefinition } from '../types'

/**
 * The scope and the setup (rewrite, brief 2). The fellow names the parts of the bronchoscope on
 * photographs, reads a scope by its two diameters, runs the pre-use check and finds the fault when
 * it fails, and sets up the room. Reprocessing gets one screen.
 *
 * Sources: the course textbook (S1) and training manual (S2); the lectures on the instrument (T02,
 * T10, T14) for the suction path; CDC guidance (U3) for reprocessing. Scope dimensions come from
 * the numbers register (row 22).
 */
const INSTRUMENT = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 97 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
] as const
const READY = [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } }] as const
const SUCTION_PATH = [
  { sourceId: 'T10', location: { kind: 'time-span', start: '00:09:41', end: '00:10:15' } },
  { sourceId: 'T14', location: { kind: 'time-span', start: '00:03:51', end: '00:04:33' } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
] as const
const DIAMETERS = [
  { sourceId: 'T02', location: { kind: 'time-span', start: '00:05:10', end: '00:06:17' } },
  { sourceId: 'T10', location: { kind: 'time-span', start: '00:03:30', end: '00:06:57' } },
] as const
const RELEASE = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
  { sourceId: 'U3', location: { kind: 'section', label: 'recommendations 2, 3, and 7' } },
] as const
const ROOM = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 59 } },
] as const

const choices = (
  labels: readonly [string, string, string, string],
  rationales: readonly [string, string, string, string],
  unsafe?: 'b' | 'c' | 'd',
): AuthoredChoice[] =>
  (['a', 'b', 'c', 'd'] as const).map((id, index) => ({
    id,
    label: labels[index],
    rationale: rationales[index],
    plausibility: index === 0 ? 'best' : id === unsafe ? 'unsafe' : 'incorrect-mechanism',
  }))

export const section: BronchSectionDefinition = {
  id: 'pre-use-check',
  authoringContract: 2,
  title: 'The scope and the setup',
  shortTitle: 'Scope and setup',
  minutes: 9,
  activityMinutes: 4,
  moduleIds: ['M03'],
  objectives: [
    {
      objectiveId: 'M03-O1',
      subtask: 'Names eight outlined parts of the bronchoscope on photographs.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M03-O2',
      subtask: 'Chooses a scope for a task by its outer diameter and its channel.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M03-O3',
      subtask:
        'Finds the fault when a pre-use check fails, starting with suction that does not draw.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M03-O4',
      subtask: 'Refuses a scope with no release record, and a single-use scope that has been used.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M03-O5',
      subtask: 'States what the outer diameter decides and what the channel decides.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D01', 'D15'],
  prerequisites: ['shared-airway'],

  clinicalQuestion: 'Is this scope ready, and is the room ready for it?',
  objective:
    'Name the parts of the bronchoscope, choose a scope by its two diameters, run the pre-use check and set up the room.',
  harmfulReflex:
    'Turning the vacuum up when suction does not draw. More vacuum does not close a leak.',
  harmfulReflexPatterns: [/\bturn\w* the vacuum up\b/i],
  anchor: {
    analogy:
      'A pilot walks around the aircraft before every flight. A fault found on the ground is a delay. The same fault found in the air is an emergency.',
    precise:
      'Before the patient arrives, show that the image, the bending, the suction and the channel all work, and that the scope was released.',
    checklistLabel: 'Before the scope goes in',
    checklist: [
      'Image and angulation work',
      'Suction moves fluid at the tip',
      'The channel takes your tool',
      'Released scope, bite block, oxygen, IV',
    ],
  },
  outcomes: [
    {
      id: 'name-parts',
      text: 'Name the parts of the bronchoscope, and choose a scope by its two diameters.',
    },
    {
      id: 'ready-or-not',
      text: 'Decide whether a scope is ready for the patient, and find the fault when it is not.',
    },
  ],

  spineStops: [],
  grammarRowIds: [],
  precommitDenyPatterns: [/\bone path\b/i, /\bport cap\b/i],
  localPolicyIds: ['scope_ifu'],
  reviewItemIds: ['R02', 'R42'],

  blocks: [
    {
      id: 'parts',
      kind: 'pattern',
      role: 'framing',
      heading: 'Three sections, one channel',
      body: 'The control section sits in your hand. The insertion tube goes into the patient. The universal cord runs to the processor.',
      pointsLabel: 'What each carries',
      points: [
        'Control section: the lever that bends the tip, the suction valve and the working-channel port',
        'Insertion tube: ends in the bending section and the tip',
        'Universal cord: light and image. It stays outside the patient.',
        'One working channel carries suction, fluid and instruments',
      ],
      claimClass: 'source',
      sourceRefs: INSTRUMENT,
    },
    {
      id: 'two-diameters',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Every scope has two diameters',
      body: 'The outer diameter decides where the scope fits and how much airway it fills. The channel decides which tools pass and how well it suctions.\n\nRead both from the scope in your hand. A name such as slim or therapeutic is not a size.',
      pointsLabel: 'Current Olympus scopes',
      points: [
        `Diagnostic: ${num('scope-diagnostic-od')} outer, ${num('scope-diagnostic-channel')} channel.`,
        `Therapeutic: ${num('scope-therapeutic-od')} outer, ${num('scope-therapeutic-channel')} channel.`,
        `Thin: ${num('scope-thin-od')} outer, ${num('scope-thin-channel')} channel.`,
      ],
      claimClass: 'transcript-source',
      sourceRefs: DIAMETERS,
      localPolicyIds: ['scope_ifu'],
      reviewItemIds: ['R02'],
    },
    {
      id: 'pre-use-check',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The pre-use check',
      body: 'Run the same five checks on every scope, before the patient is in the room. A scope that fails one is fixed or replaced.',
      pointsLabel: 'Five checks',
      points: [
        'Image. A live, sharp picture that moves with the tip, white-balanced.',
        'Angulation. The tip bends fully both ways and returns straight.',
        'Suction. Press the valve with the tip in saline. Fluid must move.',
        'Channel. It is clear, and the tool you plan to use passes.',
        'Leak test. A scope that fails is taken out of service.',
      ],
      media: { kind: 'scope-photo', imageId: 'full-scope' },
      claimClass: 'source',
      sourceRefs: READY,
    },
    {
      id: 'suction-path',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Suction is one path',
      body: 'Suction runs from the tip, up the channel, through the valve, into the trap and tubing, and to the wall. A break anywhere stops it.\n\nWhen nothing moves at the tip, do not turn the vacuum up. Trace the path.',
      pointsLabel: 'Where it breaks',
      points: [
        'The cap is off the working-channel port',
        'The suction valve is not seated',
        'The trap is full, or the tubing has come off',
        'The channel is blocked, or the tip is against the wall',
      ],
      media: {
        kind: 'scope-photo',
        imageId: 'suction-valve-setup',
        highlight: 'suction-valve-setup-suction-valve-port-2',
      },
      claimClass: 'transcript-source',
      sourceRefs: SUCTION_PATH,
      reviewItemIds: ['R42'],
    },
    {
      id: 'room',
      kind: 'pattern',
      role: 'signals',
      heading: 'Set up the room',
      body: 'Put the screen where you can see it without turning.',
      pointsLabel: 'Before the first sedative',
      points: [
        'Position: supine or semi-recumbent. Stand at the head of the bed, or face the patient.',
        'A bite block for every oral approach. It stays in until the scope is out.',
        'A working IV line.',
        'Oxygen on, and a second suction for the mouth.',
        'Rescue equipment within reach.',
      ],
      claimClass: 'synthesis',
      sourceRefs: ROOM,
    },
    {
      id: 'released',
      kind: 'pattern',
      role: 'policy',
      heading: 'Released, not just clean',
      body: 'A scope that looks clean is not ready. It is ready when it has been reprocessed and released, with a record that names the scope.\n\nA reusable scope needs at least high-level disinfection after every patient. A single-use scope is used once and thrown away, even when it still works.',
      claimClass: 'update',
      sourceRefs: RELEASE,
      localPolicyIds: ['scope_ifu'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Six errors to expect',
      body: 'Each one skips a check that takes seconds.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Turning the vacuum up when nothing moves. Trace the path first.',
        'Trusting the gauge. Watch fluid move at the tip.',
        'Moving closer to make up for a poor picture. Fix the image before you start.',
        'Taking a name for a size. Read both diameters.',
        'Using a scope because it looks clean. Find its release record.',
        'Taking the bite block out because the patient looks asleep. It stays in.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        ...SUCTION_PATH,
        ...DIAMETERS,
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } },
      ],
      reviewItemIds: ['R02', 'R42'],
    },
  ],

  workspace: {
    kind: 'media',
    caption: 'A flexible bronchoscope, photographed whole before use',
    media: [{ kind: 'scope-photo', imageId: 'full-scope' }],
  },

  act: {
    kind: 'identify',
    outcomeId: 'name-parts',
    identify: {
      id: 'scope-parts',
      prompt:
        'Eight views, each with one part of a flexible bronchoscope outlined. Name the outlined part in each.',
      rows: [
        {
          id: 'control-section',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-control-section-1',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'control-section', label: 'Control section' },
            { id: 'universal-cord', label: 'Universal cord' },
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'rotary-function', label: 'Rotary function' },
          ],
          answerId: 'control-section',
          rationale:
            'The handle in your hand. The cord leaves near its top and the insertion tube from its bottom.',
          mediaDescription:
            'Photograph of the whole bronchoscope on a white background. Outlined: the large handle in the middle of the instrument; a cord leaves near its upper end and a long, thin shaft leaves at its lower end.',
          partNote:
            'The handle held in one hand. It carries the lever that bends the distal tip, the suction valve and the working-channel port.',
        },
        {
          id: 'suction-valve',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-suction-valve-2',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'suction-valve', label: 'Suction valve' },
            { id: 'suction-valve-port', label: 'Suction valve port' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
            { id: 'working-channel-port', label: 'Working-channel port' },
          ],
          answerId: 'suction-valve',
          rationale:
            'Press it to suction through the channel. If it is missing or not seated, nothing is drawn.',
          mediaDescription:
            'Photograph of the whole bronchoscope. Outlined: a small white-topped button at the upper end of the handle.',
          partNote:
            'The valve at the top of the control section, pressed to apply suction through the working channel. It works only when it is seated in its port.',
        },
        {
          id: 'biopsy-valve-adapter',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-biopsy-valve-adapter-3',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
            { id: 'working-channel-port', label: 'Working-channel port' },
            { id: 'suction-valve', label: 'Suction valve' },
            { id: 'suction-valve-port', label: 'Suction valve port' },
          ],
          answerId: 'biopsy-valve-adapter',
          rationale:
            'The cap on the working-channel port. Left off, the port leaks and suction at the tip fails.',
          mediaDescription:
            'Photograph of the whole bronchoscope. Outlined: a small grey cap on the side of the handle, below its upper end and beside a yellow label.',
          partNote:
            'The cap on the working-channel port, lower on the control section. It keeps the port sealed, with or without an instrument through it.',
        },
        {
          id: 'insertion-tube',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-insertion-tube-4',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'universal-cord', label: 'Universal cord' },
            { id: 'control-section', label: 'Control section' },
          ],
          answerId: 'insertion-tube',
          rationale:
            'The flexible shaft that goes into the patient. Do not kink it, and protect it with a bite block.',
          mediaDescription:
            'Photograph of the whole bronchoscope. Outlined: the long, thin flexible shaft that leaves the lower end of the handle and ends free.',
          partNote:
            'The flexible shaft that leaves the bottom of the control section and ends free at the bending section and tip. It carries the working channel into the airway.',
        },
        {
          id: 'universal-cord',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-universal-cord-5',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'universal-cord', label: 'Universal cord' },
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'control-section', label: 'Control section' },
          ],
          answerId: 'universal-cord',
          rationale:
            'It carries light and image to the processor. Keep weight and sharp bends off it.',
          mediaDescription:
            'Photograph of the whole bronchoscope. Outlined: the cord that leaves the handle near its upper end, loops across the photograph and ends in a connector.',
          partNote:
            'The cord from the control section to the connector that joins the imaging and illumination system. It stays outside the patient.',
        },
        {
          id: 'rotary-function',
          media: {
            kind: 'scope-photo',
            imageId: 'full-scope',
            highlight: 'full-scope-rotary-function-6',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'rotary-function', label: 'Rotary function' },
            { id: 'insertion-tube', label: 'Insertion tube' },
            { id: 'control-section', label: 'Control section' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
          ],
          answerId: 'rotary-function',
          rationale:
            'On some models, this ring turns the insertion tube without turning the handle.',
          mediaDescription:
            'Photograph of the whole bronchoscope. Outlined: the ribbed ring at the lower end of the handle, where the long shaft continues from it.',
          partNote:
            'On models that have this function, the ring where the insertion tube leaves the control section. It turns the insertion tube relative to the control section.',
        },
        {
          id: 'suction-valve-port',
          media: {
            kind: 'scope-photo',
            imageId: 'suction-valve-setup',
            highlight: 'suction-valve-setup-suction-valve-port-2',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'suction-valve-port', label: 'Suction valve port' },
            { id: 'working-channel-port', label: 'Working-channel port' },
            { id: 'suction-valve', label: 'Suction valve' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
          ],
          answerId: 'suction-valve-port',
          rationale:
            'The opening the suction valve seats into. Suction works only once the valve is fully seated.',
          mediaDescription:
            'Close-up photograph of the upper end of the handle, with a grey valve held just above it by a hand. Outlined: the metal opening on the handle that the valve seats into.',
          partNote:
            'The opening at the top of the control section that the suction valve seats into.',
        },
        {
          id: 'working-channel-port',
          media: {
            kind: 'scope-photo',
            imageId: 'biopsy-adapter-setup',
            highlight: 'biopsy-adapter-setup-working-channel-port-2',
          },
          prompt: 'Name the outlined part.',
          choices: [
            { id: 'working-channel-port', label: 'Working-channel port' },
            { id: 'suction-valve-port', label: 'Suction valve port' },
            { id: 'biopsy-valve-adapter', label: 'Biopsy valve adapter' },
            { id: 'suction-valve', label: 'Suction valve' },
          ],
          answerId: 'working-channel-port',
          rationale:
            'The way into the working channel. Instruments, fluid and suction all share this channel.',
          mediaDescription:
            'Close-up photograph of the side of the handle, with a grey cap held beside it by a hand. Outlined: the small round metal opening on the handle, beside a yellow label, that the cap fits onto.',
          partNote:
            'The entry to the working channel, also called the accessory port. Accessories, fluid and suction share this channel.',
        },
      ],
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 97 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
        { sourceId: 'T02', location: { kind: 'time-span', start: '00:05:10', end: '00:06:17' } },
      ],
    },
  },

  moreActs: {
    faults: {
      kind: 'sort',
      outcomeId: 'ready-or-not',
      sort: {
        id: 'failed-checks',
        prompt: 'Six scopes each fail one check. Match what you find to the check that has failed.',
        origins: [
          {
            id: 'image',
            label: 'Image',
            definition: 'The picture is live, sharp and true in color.',
          },
          {
            id: 'angulation',
            label: 'Angulation',
            definition: 'The tip bends fully and returns straight.',
          },
          { id: 'suction', label: 'Suction', definition: 'Fluid moves at the tip.' },
          {
            id: 'channel',
            label: 'Channel',
            definition: 'The channel is clear and takes the tool.',
          },
          { id: 'leak', label: 'Leak test', definition: 'The scope holds pressure.' },
        ],
        rows: [
          {
            id: 'frozen-frame',
            statement: 'The picture is sharp, but it does not change when you move the tip.',
            origin: 'image',
            rationale: 'A frozen frame. Unfreeze the processor and check the picture moves.',
          },
          {
            id: 'tip-stays-bent',
            statement: 'You release the lever and the tip stays curled.',
            origin: 'angulation',
            rationale: 'The bending section is damaged. Replace the scope.',
          },
          {
            id: 'saline-does-not-move',
            statement:
              'The gauge reads normally. Saline in a cup does not move when you press the valve.',
            origin: 'suction',
            rationale: 'The gauge reads the wall. Trace the path from the tip.',
          },
          {
            id: 'forceps-stop',
            statement: 'The forceps stop halfway down and will not advance.',
            origin: 'channel',
            rationale: 'The channel is blocked or too narrow for this tool. Do not force it.',
          },
          {
            id: 'bubbles',
            statement:
              'With the tester attached, bubbles stream from the bending section under water.',
            origin: 'leak',
            rationale: 'A leak lets fluid into the scope. Take it out of service.',
          },
          {
            id: 'yellow-gauze',
            statement: 'White gauze looks yellow on the screen.',
            origin: 'image',
            rationale: 'The white balance is off. Repeat it before you judge mucosal color.',
          },
        ],
        sourceRefs: [...READY, ...SUCTION_PATH],
      },
    },
  },

  prediction: {
    id: 'N02',
    itemType: 'management-decision',
    situation:
      'You and the nurse are setting up before the patient arrives. The picture is live, and the tip bends and returns. The vacuum gauge reads normally. With the tip in a cup of saline, pressing the valve moves nothing.',
    stem: 'What do you do next?',
    choices: choices(
      [
        'Trace the suction from the tip back to the wall',
        'Turn the vacuum up until the saline moves',
        'Start anyway, since the gauge shows suction is working',
        'Pause, and change to another scope straight away',
      ],
      [
        'The gauge shows vacuum at the wall, not at the tip. The fault is a break somewhere between them.',
        'More vacuum does not close a leak. In a patient it pulls mucosa onto the tip.',
        'The gauge reads the wall. Only fluid moving at the tip shows that suction works.',
        'A fault in the tubing or the trap follows you to the next scope. Find it first.',
      ],
      'b',
    ),
    explanation:
      'Suction is one path with several joints. Check the port cap and the valve first. Each takes seconds to fix once you have found it.',
    objectiveIds: ['M03-O3'],
    outcomeIds: ['ready-or-not'],
    claimClass: 'transcript-source',
    sourceRefs: SUCTION_PATH,
  },

  transfer: {
    id: 'pre-use-check-transfer',
    itemType: 'management-decision',
    situation:
      'You plan forceps biopsies of a tumor in the right main bronchus, and you expect bleeding. The forceps packet states a minimum channel of 2.8 mm. A diagnostic and a therapeutic scope are both released and on the cart.',
    stem: 'Which scope do you take?',
    choices: choices(
      [
        'The therapeutic scope, because its channel takes the forceps',
        'The diagnostic scope, because it is thinner and easier to pass',
        'Either, because both scopes have been released',
        'The diagnostic scope, with smaller forceps from the drawer',
      ],
      [
        `Its channel is ${num('scope-therapeutic-channel')}. The forceps pass, and a wider channel clears blood better.`,
        `Its channel is ${num('scope-diagnostic-channel')}. These forceps will not go down it.`,
        'Release tells you the scope is clean. It tells you nothing about the channel.',
        'Changing the tool to suit the scope gives smaller biopsies and weaker suction, in a case where you expect bleeding.',
      ],
    ),
    explanation: `Choose by the channel first, then check that the outer diameter suits the airway. The therapeutic scope is ${num('scope-therapeutic-od')} outside.`,
    objectiveIds: ['M03-O2', 'M03-O5'],
    outcomeIds: ['name-parts'],
    claimClass: 'transcript-source',
    sourceRefs: DIAMETERS,
    reviewItemIds: ['R02'],
    transferVariant: 'A scope chosen for a tool and a task, with the dimensions to hand.',
  },

  practice: [
    {
      id: 'mc-unreleased-scope',
      presentationTitle: 'A bronchoscope found on the procedure cart',
      situation:
        'An inspection is added at the end of the day. Your usual scope is away for repair. On the cart is a clean-looking reusable scope that works, with no reprocessing record. Beside it is a single-use scope, used this morning, still in its tray.',
      item: {
        id: 'mc-unreleased-scope',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: choices(
          [
            'Send the found scope for reprocessing, and get a released one',
            'Use the found scope, since it looks clean and works',
            'Wipe it, flush the channel with sterile water, log it and use it',
            'Use the single-use scope again, since it still works',
          ],
          [
            'With no record, nobody knows what this scope has been through. A released scope is the only one you can use.',
            'Looking clean and working are not release. The channel is where organisms survive.',
            'A wipe and a flush are not reprocessing, and a log entry is not a release.',
            'Single-use means one patient. Working does not make it clean.',
          ],
        ),
        explanation:
          'Ready means released: reprocessed, inspected and recorded against this scope. A delay to find a released scope is the right cost.',
        objectiveIds: ['M03-O4'],
        outcomeIds: ['ready-or-not'],
        claimClass: 'source',
        sourceRefs: RELEASE,
      },
    },
    {
      id: 'mc-thin-scope-for-plugs',
      presentationTitle: 'A thin scope for thick secretions',
      situation:
        'A 68-year-old man has thick secretions plugging his left lower lobe. A colleague hands you the thin scope, “because it reaches further”.',
      item: {
        id: 'mc-thin-scope-for-plugs',
        itemType: 'mechanism-interpretation',
        stem: 'What does the thin scope cost you here?',
        choices: choices(
          [
            'Suction, because its channel is narrower',
            'Reach, because a thin scope bends less',
            'Space, because it fills more of the airway',
            'Nothing, because a thinner scope is the safer choice',
          ],
          [
            `Its channel is ${num('scope-thin-channel')}, against ${num('scope-therapeutic-channel')} on the therapeutic scope. Thick secretions need the wider channel.`,
            'A thin scope reaches further, not less far. Reach is what you gain.',
            'A smaller outer diameter fills less of the airway, not more.',
            'Each scope trades reach for channel. The task decides which you need.',
          ],
        ),
        explanation:
          'The outer diameter buys reach. The channel buys suction and tools. To clear plugs from a lobar bronchus you need the channel.',
        objectiveIds: ['M03-O5'],
        outcomeIds: ['name-parts'],
        claimClass: 'transcript-source',
        sourceRefs: DIAMETERS,
      },
    },
  ],
}
