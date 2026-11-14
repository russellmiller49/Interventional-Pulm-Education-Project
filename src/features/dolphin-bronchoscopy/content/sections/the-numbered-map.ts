import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const theNumberedMap: DolphinSectionDefinition = {
  ...dolphinSectionMeta('the-numbered-map'),
  clinicalQuestion:
    'A lavage record from another clinic names the site as LB3. Where is that in the left lung, and how do you find it?',
  newConcept: 'No lobes: each main bronchus gives branches numbered in order from the carina.',
  incrementSentence:
    'This section adds one idea to the last: below the carina, every branch is named by its place in a count.',
  harmfulReflex: 'Naming a branch by the way it runs, or by human lobe names.',
  harmfulReflexPatterns: [
    /\blobe\b/i,
    /\bthat runs (lateral|dorsal|medial|ventral|dorsolateral|dorsomedial)\b/i,
    /\bby (its|the) direction\b/i,
  ],
  anchor: {
    analogy:
      'House numbers on a long street: number three is the third door from the corner, whichever way it faces. The carina is the corner.',
    precise:
      'The dolphin lung has no lobes. The guide numbers the branches of each main bronchus in order from the carina: RB1 onward on the right, LB1 onward on the left.',
    checklistLabel: 'Naming a branch',
    checklist: [
      'Start at the carina.',
      'Choose the main bronchus: right or left.',
      'Count each branch as it leaves.',
      'Never name it by its direction or by a lobe.',
    ],
  },
  recognizeInstruction:
    'The scope sits just inside the left main bronchus. Look at the labels in the view and at the 3D tree beside it.',
  blocks: [
    {
      id: 'no-lobes',
      kind: 'question',
      role: 'framing',
      heading: 'A lung without lobes',
      body: 'The dolphin lung has no lobation: neither lung is divided into lobes. Cartilage reaches far toward the periphery of the airways. CT shows 16–19 airway generations, a mean of 17.',
      numberIds: ['airway-generations-ct'],
      sourceIds: ['ivancic-2014'],
    },
    {
      id: 'the-guide-names',
      kind: 'signals',
      role: 'signals',
      heading: 'The guide’s names',
      body: 'The NMMP/NMMF guide gives every airway below the larynx a short name. The trachea is TRA. The bronchus that leaves it on the right above the carina is RTB, with divisions RT1, RT2 and RT3. The main bronchi are RMB and LMB. Their branches carry numbers: RB1, RB2 and on down the right; LB1, LB2 and on down the left.',
      sourceIds: ['nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
    },
    {
      id: 'numbered-from-the-carina',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'Numbered in order from the carina',
      body: 'Each main bronchus gives off its branches one after another, and the guide numbers them in that order, starting at the carina. LB1 is the first branch to leave the left main bronchus; LB3 is the third.\n\nOn this CT, LB1 leaves close to the carina, while RB1 leaves much further down the right. Some neighbors arise together from almost one point; here RB2 and RB3 do.',
      sourceIds: ['nmmp-bronchoscopy-guide', 'nmmp-mapping-2026', 'dolphin-001-ct'],
    },
    {
      id: 'how-many',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'How many branches',
      body: 'The NMMP mapping series, ten dolphins read from CT and still in preparation, records 14 numbered branches off each main bronchus. This CT shows 13 on the right; RB14 is not traced here. The NMMP bronchoscopy form, drawn after the harbor porpoise, has room for 9 a side: RB1 to RB9 and LB1 to LB9.',
      numberIds: ['branches-per-main-bronchus'],
      sourceIds: ['nmmp-mapping-2026', 'nmmp-form-2019', 'dolphin-001-ct'],
    },
    {
      id: 'no-direction',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why the numbers carry no direction',
      body: 'In Harper’s harbor porpoise names, a branch’s number also encodes its direction: rightward branches carry even numbers. The NMMP names deliberately do not. Branch direction varies between dolphins, so a name that meant lateral would mislead in the next animal. A count from the carina does not depend on direction.',
      sourceIds: ['harper-2001', 'nmmp-bronchoscopy-guide', 'nmmp-mapping-2026'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these names a branch by something other than its place in the count.',
      points: [
        'Using human or canine lobe names for a dolphin bronchus.',
        'Naming a branch by the way it runs.',
        'Starting the count at the tracheal bronchus instead of the carina.',
        'Expecting only 9 branches a side because the porpoise-based form lists 9.',
      ],
      numberIds: ['branches-per-main-bronchus'],
      sourceIds: ['nmmp-bronchoscopy-guide', 'nmmp-form-2019', 'ivancic-2014'],
    },
  ],
  workspace: {
    kind: 'scope',
    start: 'lmb-origin',
    labels: 'shown',
    showLocation: true,
    tree: true,
    caption:
      'The CT dolphin’s airway, scope just inside the left main bronchus. Labels name the openings ahead.',
  },
  act: {
    kind: 'scope-lab',
    prompt:
      'Labels are on. Enter LB1, LB2 and LB3 in turn, backing out to the left main bronchus between them.',
    goals: [
      {
        kind: 'reach-in-order',
        abbrs: ['LB1', 'LB2', 'LB3'],
        label: 'LB1, LB2, then LB3, down the left main bronchus',
      },
    ],
  },
  prediction: {
    id: 'numbered-predict',
    itemType: 'mechanism-interpretation',
    situation:
      'A record from another clinic reads “BAL, LB3”. The scope is just inside the left main bronchus.',
    stem: 'Which opening is LB3?',
    choices: [
      {
        id: 'a',
        label: 'The third branch to leave the left main bronchus, counted from the carina.',
        rationale:
          'The guide numbers each main bronchus’s branches in the order they leave it, starting at the carina.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The bronchus to the third lobe of the left lung.',
        rationale:
          'The dolphin lung has no lobes. Reading LB3 as a lobe sends you looking for an airway that is not there.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'The third branch counted back from the far end of the left main bronchus.',
        rationale:
          'The far end is not a point you can see from here. The count starts at the carina.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'A branch of the left main bronchus; the number is only a label.',
        rationale:
          'It is on the left, but the number does give its place: third in order from the carina.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'With no lobes to name, the guide names branches by order. LB3 is the third branch to leave the left main bronchus, counting from the carina. RB numbers count the same way down the right main bronchus.',
    objectiveIds: ['O1'],
    sourceIds: ['nmmp-bronchoscopy-guide', 'ivancic-2014'],
  },
  transfer: {
    id: 'numbered-transfer',
    itemType: 'management-decision',
    transferVariant: 'The right main bronchus, with a direction offered as the cue.',
    retrievesFrom: ['below-the-larynx'],
    situation:
      'Same dolphin, now on the right. The plan asks for RB6. A colleague suggests looking for “the lateral branch about halfway down”.',
    stem: 'How do you find RB6?',
    choices: [
      {
        id: 'a',
        label:
          'Enter the right main bronchus at the carina and count to the sixth branch to leave it.',
        rationale:
          'RB6 is the sixth branch of the right main bronchus in order from the carina, however it runs.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Look for the branch that runs lateral, about halfway down.',
        rationale:
          'On this CT RB2, RB4, RB6, RB8, RB9 and RB13 all run lateral. Direction alone cannot single out RB6.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Count six openings down from the larynx.',
        rationale:
          'That count takes in the tracheal bronchus, above the carina. RB numbers start at the carina.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Count six branches down the right side.',
        rationale:
          'The count is the tool. Start it at the carina, and count only branches of the right main bronchus.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Order names a branch; direction does not. Choose the right main bronchus at the carina, then count its branches as they leave it. RB6 is the sixth.',
    objectiveIds: ['O1'],
    sourceIds: ['nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
  },
  practice: [],
  precommitDenyPatterns: [
    /\bthe third\b/i,
    /\bthird (branch|opening)\b/i,
    /\bcount(ed|ing)? from the carina\b/i,
  ],
  sourceIds: [
    'ivancic-2014',
    'nmmp-bronchoscopy-guide',
    'nmmp-mapping-2026',
    'nmmp-form-2019',
    'harper-2001',
    'dolphin-001-ct',
  ],
}
