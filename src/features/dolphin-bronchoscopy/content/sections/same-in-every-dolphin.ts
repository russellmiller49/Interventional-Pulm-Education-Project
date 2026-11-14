import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const sameInEveryDolphin: DolphinSectionDefinition = {
  ...dolphinSectionMeta('same-in-every-dolphin'),
  clinicalQuestion:
    'You know this CT dolphin’s airway well. Tomorrow you scope a different dolphin. What will be where you expect it, and how will you name a branch you have never seen?',
  newConcept:
    'The proximal airway (RTB, RMB, LMB) is the same in every dolphin mapped; branch direction varies, so the numbers count order, not direction.',
  incrementSentence:
    'This section adds one idea to the last: the numbers carry from one dolphin to the next because they do not depend on direction.',
  harmfulReflex: 'Identifying a branch by which way it runs.',
  harmfulReflexPatterns: [
    /\bwhich way it (runs|points)\b/i,
    /\blook for the (lateral|dorsal|medial|ventral|dorsolateral|dorsomedial)\b/i,
    /\bthe (lateral|dorsal|medial|ventral|dorsolateral|dorsomedial) one\b/i,
  ],
  anchor: {
    analogy:
      'Towns built on one plan share the same main square and the same two avenues. Their side streets bend differently, so you find one by counting, not by its bend.',
    precise:
      'The trachea, the right tracheal bronchus and the two main bronchi were the same in every dolphin mapped. A numbered branch’s direction varies, so its number counts order from the carina.',
    checklistLabel: 'In a dolphin you have not scoped',
    checklist: [
      'Expect the tracheal bronchus on the right, above the carina.',
      'Expect two main bronchi at the carina.',
      'Count numbered branches from the carina.',
      'Treat a branch’s direction as this animal’s, not the rule.',
    ],
  },
  recognizeInstruction:
    'Turn the 3D lungs and airway in the Simulator panel. Find the trachea, the carina and the two main bronchi.',
  blocks: [
    {
      id: 'ten-dolphins',
      kind: 'question',
      role: 'framing',
      heading: 'One plan, ten dolphins',
      body: 'The NMMP mapped the airways of ten bottlenose dolphins from CT, five of each sex. The work is in preparation. For each animal the team named every branch with the guide’s names and recorded which way it ran.',
      numberIds: ['mapping-sample'],
      sourceIds: ['nmmp-mapping-2026'],
    },
    {
      id: 'two-kinds-of-finding',
      kind: 'signals',
      role: 'signals',
      heading: 'Two kinds of finding',
      body: 'Some findings are about place: is a bronchus present, and where does it leave its parent airway? Others are about direction: which way does a numbered branch run? As you sort, ask of each one whether it held in all ten animals.',
      sourceIds: ['nmmp-mapping-2026'],
    },
    {
      id: 'what-held',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The same in every dolphin mapped',
      body: 'In all ten dolphins the right tracheal bronchus left the right wall of the trachea above the carina. All ten had a right and a left main bronchus, dividing at the carina. RB1 ran dorsolateral in every one.',
      numberIds: ['mapping-sample', 'mapping-rb1'],
      sourceIds: ['nmmp-mapping-2026'],
    },
    {
      id: 'what-varied',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What varied',
      body: 'LB1 ran lateral in all 5 females and dorsolateral in all 5 males. LB10 ran lateral in all 5 females; in the 5 males it ran lateral in 2, dorsomedial in 2 and ventral in 1.\n\nSome neighbors arose together from one point: RB2 with RB3 in 4 of 10 dolphins, and RB4 with RB5 in 2. A few other pairs did so in 1 animal each.',
      numberIds: ['mapping-lb1', 'mapping-lb10', 'mapping-paired-branches'],
      sourceIds: ['nmmp-mapping-2026'],
    },
    {
      id: 'order-not-direction',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why the names count order',
      body: 'A name that meant a direction would hold in one dolphin and mislead in the next. So the NMMP numbers count order from the carina, a landmark every dolphin mapped shares. Even where a direction held in all ten, as for RB1, the count is what names the branch.',
      sourceIds: ['nmmp-mapping-2026', 'nmmp-bronchoscopy-guide'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these carries one dolphin’s directions into another.',
      points: [
        'Looking for “the lateral branch” in a new animal.',
        'Expecting a male’s branches to run as a female’s do.',
        'Reading one animal’s CT as the map of every dolphin.',
      ],
      sourceIds: ['nmmp-mapping-2026'],
    },
  ],
  workspace: {
    kind: 'anatomy',
    preset: 'lungs-and-ribs',
    caption:
      'The CT dolphin’s lungs, airway and ribs, seen from the right with the body hidden. Drag to turn it.',
  },
  act: {
    kind: 'sort',
    sort: {
      id: 'held-or-varied',
      prompt:
        'Sort each finding from the ten-dolphin series: did it hold in every animal, or did it vary?',
      origins: [
        {
          id: 'same',
          label: 'The same in every dolphin mapped',
          definition: 'Held in all ten animals of the series.',
        },
        {
          id: 'varies',
          label: 'Varies between dolphins',
          definition: 'Differed between animals, or between males and females.',
        },
      ],
      rows: [
        {
          id: 'rtb-place',
          statement: 'Where the right tracheal bronchus leaves the trachea.',
          origin: 'same',
          rationale: 'It left the right wall above the carina in all 10 dolphins mapped.',
        },
        {
          id: 'carina-division',
          statement: 'The trachea dividing at the carina into a right and a left main bronchus.',
          origin: 'same',
          rationale: 'All 10 had both main bronchi, dividing at the carina.',
        },
        {
          id: 'rb1-direction',
          statement: 'The direction RB1 runs.',
          origin: 'same',
          rationale:
            'Dorsolateral in all 10. Its name still comes from the count: it is the first branch of the right main bronchus.',
        },
        {
          id: 'lb1-direction',
          statement: 'The direction LB1 runs.',
          origin: 'varies',
          rationale: 'Lateral in all 5 females, dorsolateral in all 5 males.',
        },
        {
          id: 'lb10-direction',
          statement: 'The direction LB10 runs.',
          origin: 'varies',
          rationale:
            'Lateral in all 5 females; in the 5 males, lateral in 2, dorsomedial in 2 and ventral in 1.',
        },
        {
          id: 'rb2-rb3-pair',
          statement: 'Whether RB2 and RB3 arise together from one point.',
          origin: 'varies',
          rationale: 'Together in 4 of 10 dolphins, separate in the rest.',
        },
        {
          id: 'rb4-rb5-pair',
          statement: 'Whether RB4 and RB5 arise together from one point.',
          origin: 'varies',
          rationale: 'Together in 2 of 10 dolphins, separate in the rest.',
        },
      ],
      sourceIds: ['nmmp-mapping-2026'],
      numberIds: [
        'mapping-sample',
        'mapping-rb1',
        'mapping-lb1',
        'mapping-lb10',
        'mapping-paired-branches',
      ],
    },
  },
  prediction: {
    id: 'varies-predict',
    itemType: 'management-decision',
    situation:
      'On this CT, a male dolphin, LB10 runs lateral. Next week you scope a different male, and the plan asks for a lavage in LB10.',
    stem: 'How will you find LB10 in him?',
    choices: [
      {
        id: 'a',
        label: 'Enter the left main bronchus at the carina and count its branches to the tenth.',
        rationale:
          'The carina and the main bronchi are where you expect in every dolphin mapped. The count from there names LB10.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Look for the lateral branch near the end of the left main bronchus.',
        rationale:
          'LB10 ran lateral in only 2 of the 5 males mapped. In him it may run dorsomedial or ventral.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Expect nothing to carry over; map his airway from scratch as you go.',
        rationale:
          'The trachea, the tracheal bronchus and the main bronchi were the same in every dolphin mapped. What varied was the direction of numbered branches.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Read his CT first, if he has one, and look where it shows LB10.',
        rationale:
          'His own CT would help you plan. At the scope you still name the branch by counting from the carina.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The directions of numbered branches vary between dolphins, and LB10 varies among males. The proximal airway does not: the carina and both main bronchi are where you expect. So count from the carina; the tenth branch of the left main bronchus is LB10.',
    objectiveIds: ['O6'],
    sourceIds: ['nmmp-mapping-2026', 'nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
    numberIds: ['mapping-lb10'],
  },
  transfer: {
    id: 'varies-transfer',
    itemType: 'signal-recognition',
    transferVariant:
      'A branch whose direction differs from the last dolphin, met in the scope rather than planned.',
    retrievesFrom: ['the-numbered-map'],
    situation:
      'In the last dolphin you scoped, LB1 ran lateral. In today’s dolphin, the first branch to leave the left main bronchus below the carina runs dorsolateral.',
    stem: 'What is this branch?',
    choices: [
      {
        id: 'a',
        label: 'LB1: it is the first branch counted from the carina, whichever way it runs.',
        rationale:
          'The number comes from its place in the count. Its direction belongs to this animal.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Not LB1, since LB1 is the lateral one; look further down for it.',
        rationale:
          'Direction does not name a branch. In the series LB1 ran dorsolateral in all 5 males, so this one fits well.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'An extra branch this dolphin has before LB1.',
        rationale:
          'A branch is named by its place in the count. The first to leave the left main bronchus is LB1, wherever it runs.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Probably LB1, if the animal turns out to be male.',
        rationale:
          'A dorsolateral LB1 fits the males in the series, but the count already names it, whatever the sex.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The first branch of the left main bronchus below the carina is LB1, whichever way it runs. In the series LB1 ran lateral in all 5 females and dorsolateral in all 5 males. Direction tells you about the animal, not the name.',
    objectiveIds: ['O6', 'O1'],
    sourceIds: ['nmmp-mapping-2026', 'nmmp-bronchoscopy-guide'],
    numberIds: ['mapping-lb1'],
  },
  practice: [],
  precommitDenyPatterns: [
    /\bcount\w* (its |the )?(branches|openings)\b/i,
    /\btenth\b/i,
    /\bcount\w* from the carina\b/i,
  ],
  sourceIds: ['nmmp-mapping-2026', 'nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
}
