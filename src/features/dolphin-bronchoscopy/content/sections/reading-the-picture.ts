import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const readingThePicture: DolphinSectionDefinition = {
  ...dolphinSectionMeta('reading-the-picture'),
  clinicalQuestion:
    'The dolphin lies on its sternum and the scope faces the carina. Which of the two openings is the right main bronchus, and how sure can you be from the picture alone?',
  newConcept:
    'In sternal recumbency the dorsal wall is at the top of the screen and the animal’s right is on the screen left; name by counting, not by direction.',
  incrementSentence:
    'This section adds one idea to the last: the screen has sides, and in a sternal dolphin they are not the ones you may expect.',
  harmfulReflex:
    'Assuming the animal’s right is on the screen right, as in a patient lying on its back.',
  harmfulReflexPatterns: [
    /\bas in a patient on its back\b/i,
    /\bright (is|lies) on the screen right\b/i,
  ],
  anchor: {
    analogy:
      'Kneel at the head of someone lying face down and look along their back toward their feet. Their right arm is on your left.',
    precise:
      'With the animal sternal and the scope not rotated, dorsal is at the top of the screen and the animal’s right is on the screen left.',
    checklistLabel: 'Before you name a side',
    checklist: [
      'Is the dorsal wall at the top?',
      'The animal’s right is on the screen left.',
      'Choose the main bronchus by side at the carina.',
      'Name every branch after that by counting.',
    ],
  },
  recognizeInstruction:
    'The scope faces the carina. Look at the view in the Simulator panel; the labels checkbox is yours, so leave it off to read the picture yourself.',
  blocks: [
    {
      id: 'the-animal-lies-sternal',
      kind: 'question',
      role: 'framing',
      heading: 'The animal lies sternal',
      body: 'A dolphin is scoped in sternal recumbency: lying on its sternum, padded, and kept wet and cool. The section The room and the team sets up that position.',
      sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
    },
    {
      id: 'up-on-the-screen',
      kind: 'signals',
      role: 'signals',
      heading: 'Up on the screen',
      body: 'With the animal sternal and the scope not rotated, the dorsal wall is at the top of the screen and the ventral wall at the bottom. The scope looks caudally, from the head toward the tail. Before you name anything, ask where the animal’s right side must be.',
      sourceIds: ['dolphin-001-ct', 'tsang-2002'],
    },
    {
      id: 'right-on-the-screen-left',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The animal’s right is on the screen left',
      body: 'You look caudally into an animal lying face down, so its right side falls on your left. The animal’s right is on the screen left.\n\nAt the carina the right main bronchus is the screen-left opening, and the left main bronchus the screen-right one. The tracheal bronchus, from the right wall, appears on the screen left as you descend.',
      sourceIds: ['dolphin-001-ct', 'tsang-2002'],
    },
    {
      id: 'a-patient-on-its-back',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'A patient on its back is the reverse',
      body: 'Scope a patient lying on its back from the head, and the ventral wall is at the top with the patient’s right on the screen right. Turn the patient onto its sternum and the picture turns half a circle. Dorsal comes to the top, and the right moves to the screen left. Carry the first habit into a sternal dolphin and every side is reversed.',
      sourceIds: ['dolphin-001-ct'],
    },
    {
      id: 'sides-once-then-count',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'Use sides once, then count',
      body: 'Rotate the scope and the picture rotates with it; the airway does not move. So use sides once, at the carina, to choose the main bronchus. Name every branch after that by counting from the carina. When the picture stops making sense, pull back to the carina and start again.',
      sourceIds: ['nmmp-workshop-2024', 'nmmp-bronchoscopy-guide'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these reads the picture as if the animal lay on its back, or trusts the screen over the count.',
      points: [
        'Taking the screen right for the animal’s right.',
        'Naming a branch by where it sits on the screen.',
        'Naming branches after the scope has been rotated, without finding the carina again.',
      ],
      sourceIds: ['dolphin-001-ct', 'nmmp-workshop-2024'],
    },
  ],
  workspace: {
    kind: 'scope',
    start: 'carina',
    labels: 'learner',
    showLocation: true,
    caption:
      'The CT dolphin’s airway, scope in the lower trachea facing the carina. Dorsal is at the top of the view.',
  },
  act: {
    kind: 'identify',
    identify: {
      id: 'name-each-view',
      prompt:
        'Each still comes from the CT dolphin, lying sternal, with the scope not rotated. Name the place or the opening each question asks for.',
      rows: [
        {
          id: 'view-id-side-opening',
          frameId: 'trachea-rtb',
          prompt:
            'The tip is in the trachea, above where it divides. What is the single opening in the side wall?',
          choices: [
            { id: 'rtb', label: 'RTB' },
            { id: 'rmb', label: 'RMB' },
            { id: 'lmb', label: 'LMB' },
            { id: 'lb1', label: 'LB1' },
          ],
          answerId: 'rtb',
          rationale:
            'One opening in a side wall above the carina is the tracheal bronchus. It sits on the screen left because the animal’s right is there.',
        },
        {
          id: 'view-id-screen-right',
          frameId: 'carina',
          prompt:
            'The tip faces the ridge where the trachea divides. What is the opening on the screen right?',
          choices: [
            { id: 'rmb', label: 'RMB' },
            { id: 'lmb', label: 'LMB' },
            { id: 'rtb', label: 'RTB' },
          ],
          answerId: 'lmb',
          rationale:
            'The animal lies sternal, so its left is on the screen right. Of the two openings at the carina, that one is the left main bronchus.',
        },
        {
          id: 'view-id-rb1',
          frameId: 'rmb-rb1',
          prompt:
            'The scope entered the screen-left opening at the carina and has run a long way down it. What is the first side opening ahead?',
          choices: [
            { id: 'rb1', label: 'RB1' },
            { id: 'lb1', label: 'LB1' },
            { id: 'rt1', label: 'RT1' },
            { id: 'rb2', label: 'RB2' },
          ],
          answerId: 'rb1',
          rationale:
            'The screen-left opening at the carina is the right main bronchus. The first branch to leave it, counted from the carina, is RB1.',
        },
        {
          id: 'view-id-lb1',
          frameId: 'lmb-origin',
          prompt:
            'The scope entered the screen-right opening at the carina. What is the side opening close ahead?',
          choices: [
            { id: 'lb1', label: 'LB1' },
            { id: 'rb1', label: 'RB1' },
            { id: 'lb2', label: 'LB2' },
            { id: 'rt1', label: 'RT1' },
          ],
          answerId: 'lb1',
          rationale:
            'The screen-right opening at the carina is the left main bronchus. The first opening counted from the carina is LB1.',
        },
        {
          id: 'view-id-lb2',
          frameId: 'lmb-lb2',
          prompt:
            'Still in the screen-right bronchus from the carina, the scope has gone by one side opening. What is the next one?',
          choices: [
            { id: 'lb2', label: 'LB2' },
            { id: 'lb1', label: 'LB1' },
            { id: 'rb2', label: 'RB2' },
            { id: 'lb3', label: 'LB3' },
          ],
          answerId: 'lb2',
          rationale:
            'This is the left main bronchus. LB1 is behind the tip, so the next opening counted from the carina is LB2.',
        },
      ],
      sourceIds: ['dolphin-001-ct', 'tsang-2002', 'nmmp-bronchoscopy-guide'],
    },
  },
  prediction: {
    id: 'view-predict',
    itemType: 'signal-recognition',
    media: { frameId: 'carina' },
    situation:
      'The dolphin lies sternal and the scope is not rotated, so the dorsal wall is at the top of the screen. The tip faces the carina: two openings lie side by side.',
    stem: 'Which one is the right main bronchus?',
    choices: [
      {
        id: 'a',
        label: 'The opening on the screen left.',
        rationale:
          'Looking caudally into an animal lying face down, its right side falls on your left.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The opening on the screen right, as in a patient on its back.',
        rationale:
          'On its back, the ventral wall is at the top and right is on the right. Sternal, the picture is turned half a circle.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'The upper one; the right main bronchus leaves dorsally.',
        rationale:
          'The two main bronchi run virtually in parallel and lie side by side. Neither sits above the other.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Whichever is on the same side as the tracheal bronchus, seen higher up.',
        rationale:
          'A sound check, since both are on the animal’s right. But the view already tells you which side that is: the screen left.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Sternal, with the scope not rotated, dorsal is at the top and the animal’s right is on the screen left. So the right main bronchus is the screen-left opening at the carina, and the tracheal bronchus above it is on the screen left too.',
    objectiveIds: ['O1'],
    sourceIds: ['dolphin-001-ct', 'tsang-2002'],
  },
  transfer: {
    id: 'view-transfer',
    itemType: 'signal-recognition',
    transferVariant:
      'The tracheal bronchus in the trachea, instead of the main bronchi at the carina.',
    retrievesFrom: ['below-the-larynx'],
    situation:
      'Another dolphin lies sternal, and the scope is not rotated. Descending the trachea, you look ahead for the tracheal bronchus.',
    stem: 'Where on the screen do you expect its opening?',
    choices: [
      {
        id: 'a',
        label: 'On the screen left: it leaves the animal’s right wall.',
        rationale:
          'The tracheal bronchus leaves the right wall, and sternal, the animal’s right is on the screen left.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'On the screen right, as in a patient on its back.',
        rationale:
          'That holds with the ventral wall at the top. Sternal, the sides are the other way round.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'At the top of the screen: it leaves the dorsal wall.',
        rationale:
          'It leaves the right wall. Dorsal is the top of the screen, but that is not the wall it leaves.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'On the same side as the right main bronchus will be at the carina.',
        rationale: 'True, but you can say which side now: the animal’s right, on the screen left.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The tracheal bronchus leaves the right wall of the trachea, above the carina. With the animal sternal, its right is on the screen left, so that is where the opening appears.',
    objectiveIds: ['O1'],
    sourceIds: ['dolphin-001-ct', 'tsang-2002', 'nmmp-mapping-2026'],
  },
  practice: [],
  precommitDenyPatterns: [
    /\bscreen[- ]left\b/i,
    /\bleft (side )?of the screen\b/i,
    /\bon your left\b/i,
    /\bhalf a circle\b/i,
  ],
  sourceIds: [
    'dolphin-001-ct',
    'tsang-2002',
    'ivancic-2014',
    'nmmp-workshop-2024',
    'nmmp-bronchoscopy-guide',
    'nmmp-mapping-2026',
  ],
}
