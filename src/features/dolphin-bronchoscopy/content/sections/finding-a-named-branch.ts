import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const findingANamedBranch: DolphinSectionDefinition = {
  ...dolphinSectionMeta('finding-a-named-branch'),
  clinicalQuestion:
    'The plan asks for a lavage in a named branch, and a real screen has no labels. How do you get the scope there, and what do you do when you are no longer sure where it is?',
  newConcept: 'none (applies the numbered map and the view)',
  harmfulReflex: 'Driving on when the count no longer matches the picture.',
  harmfulReflexPatterns: [/\bdrive on\b/i, /\bkeep (going|driving|advancing)\b/i],
  anchor: {
    analogy:
      'Counting stops on a train with the announcements off. Miss one and every stop after it is misnamed, so you go back to a station you are sure of and count again.',
    precise:
      'Choose the main bronchus at the carina by side, then count its branches from the carina. When the count and the picture disagree, withdraw to the last fork you are sure of.',
    checklistLabel: 'Driving to a named branch',
    checklist: [
      'At the carina: which main bronchus?',
      'Count each branch as it leaves.',
      'Two branches from one point count as two.',
      'Count lost: back to the last fork you are sure of.',
    ],
  },
  recognizeInstruction:
    'The scope faces the carina with the labels and the location readout off. Look at the view and at the 3D tree beside it.',
  blocks: [
    {
      id: 'no-labels-in-the-room',
      kind: 'question',
      role: 'framing',
      heading: 'No labels in the room',
      body: 'On a real screen nothing is labelled, but the plan still names a site, such as LB3 or RB2. You reach it with two things you already have: the sides at the carina, and the count.',
      sourceIds: ['nmmp-bronchoscopy-guide'],
    },
    {
      id: 'counting-from-the-carina',
      kind: 'signals',
      role: 'signals',
      heading: 'Counting from the carina',
      body: 'At the carina, choose the main bronchus by side: with the animal sternal, its right is on the screen left. Advance slowly, keep off the walls, and count each branch as it leaves the main bronchus. Each main bronchus has its own count, from one. Two branches arising from one point count as two.',
      sourceIds: ['nmmp-bronchoscopy-guide', 'nmmp-workshop-2024', 'nmmp-mapping-2026'],
    },
    {
      id: 'when-the-count-stops-matching',
      kind: 'after-commitment',
      role: 'first-moves',
      heading: 'When the count stops matching',
      body: 'If the picture does not match what the count predicts, stop. Withdraw to the last fork you are sure of: the origin of the main bronchus, or the carina. If you are still unsure, find the tracheal bronchus again, cranial and on the right. Then count the branches again from the carina.',
      sourceIds: ['nmmp-workshop-2024', 'nmmp-bronchoscopy-guide'],
    },
    {
      id: 'pairs-on-this-ct',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'Pairs on this CT',
      body: 'On this CT, RB2 and RB3 arise from almost one point, and so do RB4 and RB5. The count brings you to the pair, not to one branch of it. Within this one animal, its own map tells them apart: here RB2 and RB4 run lateral, RB3 and RB5 dorsal. Another dolphin’s pair may run differently.',
      sourceIds: ['dolphin-001-ct', 'nmmp-mapping-2026'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these trusts a guess over the count.',
      points: [
        'Driving on when the count no longer matches.',
        'Starting the count at the tracheal bronchus.',
        'Counting two branches from one point as one.',
        'Choosing the main bronchus as if the animal lay on its back.',
      ],
      sourceIds: ['nmmp-workshop-2024', 'nmmp-bronchoscopy-guide'],
    },
  ],
  workspace: {
    kind: 'scope',
    start: 'carina',
    labels: 'hidden',
    showLocation: false,
    tree: true,
    caption:
      'The CT dolphin’s airway, scope in the lower trachea facing the carina, with no labels. The 3D tree follows the tip.',
  },
  act: {
    kind: 'branch-drill',
    prompt:
      'Labels are off. Drive to each named branch by counting from the carina. If the count stops matching the picture, withdraw to the last fork you are sure of.',
    set: 'near-branches',
    count: 4,
  },
  prediction: {
    id: 'findbranch-predict',
    itemType: 'management-decision',
    situation:
      'Labels are off and you are driving to LB3. In the left main bronchus you went by one opening, perhaps two; mucus blurred the view. Another opening lies ahead.',
    stem: 'What is your next move?',
    choices: [
      {
        id: 'a',
        label: 'Withdraw to the carina, the last fork you are sure of, and count again from there.',
        rationale:
          'The count is lost, and only a fork you are sure of can restart it. Here that fork is the carina.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Drive on and call it LB3; the count is probably right.',
        rationale:
          'A count you are unsure of may name a different branch. A lavage there samples a site the record does not name.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Name it by its direction: LB3 runs lateral.',
        rationale:
          'On this CT LB1, LB3 and LB6 all run lateral, and direction varies between dolphins. It cannot repair the count.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Pull back a little and look at this opening again.',
        rationale:
          'A clearer view of this opening helps, but it cannot tell you how many you went by. Only a fork you are sure of restarts the count.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'When the picture and the count disagree, the count is lost. Withdraw to the last fork you are sure of, here the carina, and count the branches again. The NMMP rule is the same: when lost, pull back to the carina and the main bronchi.',
    objectiveIds: ['O1'],
    sourceIds: ['nmmp-workshop-2024', 'nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
  },
  transfer: {
    id: 'findbranch-transfer',
    itemType: 'management-decision',
    transferVariant:
      'The other main bronchus entered at the carina, on the way to a right-sided target.',
    retrievesFrom: ['the-numbered-map', 'reading-the-picture'],
    situation:
      'Labels are off in another dolphin, lying sternal. The plan asks for RB1. At the carina you enter the screen-right opening and soon meet a side opening close ahead.',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label:
          'Withdraw to the carina and enter the screen-left opening; RB1 is the first branch there.',
        rationale:
          'The screen-left opening is the animal’s right, the right main bronchus. Its first branch from the carina is RB1.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Drive on into it; the first branch past the carina is RB1.',
        rationale:
          'The screen-right opening at the carina is the left main bronchus. Its first branch is LB1, not RB1.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Enter it; RB1 is whichever branch lies closest to the carina.',
        rationale:
          'RB numbers belong to the right main bronchus only. The screen-right opening is the left main bronchus, so this opening is LB1.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Withdraw to the carina and start again.',
        rationale:
          'Withdrawing is the first move. Then say where the count starts: the screen-left opening, the animal’s right.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Sides choose the main bronchus; the count names the branch. With the animal sternal, its right is on the screen left, so RB1 is the first branch of the screen-left opening. The screen-right one leads to LB1.',
    objectiveIds: ['O1'],
    sourceIds: ['nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
  },
  practice: [],
  precommitDenyPatterns: [
    /\blast fork\b/i,
    /\bcount again\b/i,
    /\bwithdraw to the carina\b/i,
    /\bback out\b/i,
  ],
  sourceIds: [
    'nmmp-bronchoscopy-guide',
    'nmmp-workshop-2024',
    'nmmp-mapping-2026',
    'dolphin-001-ct',
  ],
}
