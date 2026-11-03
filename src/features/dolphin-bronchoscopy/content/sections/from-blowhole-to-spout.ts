import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const fromBlowholeToSpout: DolphinSectionDefinition = {
  ...dolphinSectionMeta('from-blowhole-to-spout'),
  clinicalQuestion:
    'At the foot of the nasopharynx three openings lie ahead. Which one leads to the trachea, and how do you know before you enter it?',
  newConcept:
    'The glottis is at the tip of the laryngeal spout, in the midline, with a blind fornix on each side.',
  incrementSentence:
    'This section adds one idea to the last: the spout has a blind pouch on each side, and only the spout tip leads on.',
  harmfulReflex: 'Advancing into whichever lumen looks largest or lies straight ahead.',
  harmfulReflexPatterns: [/\bkeep advancing\b/i, /\bpush on\b/i, /\blargest\b/i],
  anchor: {
    analogy:
      'Three doors at the end of a hall, two of them closets. The real door is the one in the middle that opens when the house breathes.',
    precise:
      'The glottis opens at the tip of the laryngeal spout, in the midline. A nasopharyngeal fornix on each side is a blind pouch.',
    checklistLabel: 'At the foot of the nasopharynx',
    checklist: [
      'Find both fornices before you choose.',
      'Aim at the midline spout tip.',
      'Watch for the glottis to move with a breath.',
      'A smooth blind end means pull back.',
    ],
  },
  recognizeInstruction:
    'The scope sits in the left bony nasal passage. Look at the Simulator panel: the view, with the steering arrows at its lower left and Advance and Withdraw at its lower right.',
  blocks: [
    {
      id: 'the-nasal-stage',
      kind: 'signals',
      role: 'signals',
      heading: 'The nasal passage and the nasopharynx',
      body: 'Below the nasal plugs the scope enters one of two bony nasal passages, each 5–7 cm long and 2–3 cm across. Expect copious, tenacious mucus. The passages open into the nasopharynx, a chamber 4–5 cm across.',
      numberIds: ['bony-nasal-passage', 'nasopharynx-width'],
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'how-to-drive',
      kind: 'signals',
      role: 'framing',
      heading: 'Driving the scope',
      body: 'Steer with the arrows on the view or the arrow keys, then advance. The scope enters the opening you point at. Drag on the view to look around. Labels name the openings ahead.',
      sourceIds: ['dolphin-001-ct'],
    },
    {
      id: 'the-spout-tip',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The glottis at the spout tip',
      body: 'The glottis opens at the tip of the laryngeal spout, in the midline of the nasopharynx: a triangular opening through the pale, rounded tip, its apex dorsal. On each side of the spout is a nasopharyngeal fornix: a blind pouch that can look like an open lumen from above.\n\nThe spout and the glottis move with each breath. The wall of a fornix does not open that way.',
      sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'All three come from choosing an opening before both fornices are in view.',
      points: [
        'Following the larger lumen into a fornix.',
        'Advancing before the spout tip is centered in the view.',
        'Reading pooled mucus as the end of the passage.',
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
  ],
  workspace: {
    kind: 'scope',
    start: 'naris',
    labels: 'shown',
    showLocation: true,
    caption:
      'The CT dolphin’s airway, scope in the left bony nasal passage. Dorsal is at the top of the view.',
  },
  act: {
    kind: 'scope-lab',
    prompt:
      'Drive from the nasal passage, down the nasopharynx, and into the glottis. If you enter a blind pouch, pull back and choose again.',
    goals: [
      {
        kind: 'reach-in-order',
        abbrs: ['LNP', 'NPX', 'LS'],
        label: 'Nasal passage, nasopharynx, then into the glottis',
      },
      {
        kind: 'avoid',
        abbr: 'NPF',
        label: 'Stay out of the fornix',
        hint: 'This is a nasopharyngeal fornix, a blind pouch beside the spout. Pull back until both fornices are in view, then aim at the midline spout tip.',
      },
    ],
  },
  prediction: {
    id: 'spout-predict',
    itemType: 'signal-recognition',
    situation:
      'The scope is at the foot of the nasopharynx. Three openings lie ahead: one in the midline and one on each side. The side ones look larger.',
    stem: 'Which one leads to the trachea?',
    choices: [
      {
        id: 'a',
        label: 'The midline one, at the tip of the laryngeal spout.',
        rationale: 'The glottis opens at the spout tip, and the spout sits in the midline.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The largest side opening; keep advancing and it will open out.',
        rationale:
          'The side openings are the fornices, blind pouches. Size does not mark the airway.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Either side one; both join the larynx lower down.',
        rationale: 'Neither joins anything. Each fornix ends blind.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Whichever one moves; check it before choosing.',
        rationale:
          'Movement with a breath is the right check, but you still need to know where to look: the midline.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The glottis is a midline opening at the tip of the spout. The fornices lie either side and end blind. Find both fornices first; the spout tip is between them.',
    objectiveIds: ['O1'],
    sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide'],
  },
  transfer: {
    id: 'spout-transfer',
    itemType: 'management-decision',
    transferVariant: 'Already inside a blind pouch rather than choosing at the fork.',
    situation:
      'Near the foot of the nasopharynx you advance toward an opening on the left. It ends in a smooth blind pouch, and nothing moves with the next breath.',
    stem: 'What is your first move?',
    choices: [
      {
        id: 'a',
        label: 'Pull back until both fornices are in view, then aim at the midline spout tip.',
        rationale:
          'You are in a fornix. Backing out restores the fork, and the spout lies between them.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Push on; the lumen will open further down.',
        rationale: 'A fornix ends blind. Pushing on presses the tip into the mucosa.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Suction and wait for the view to clear.',
        rationale: 'The view is not lost; the tip is in a blind pouch. Suction will not move it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Withdraw fully and start again from the other nasal passage.',
        rationale: 'It would work, but you only need to back out of the pouch.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A smooth blind end with no movement is a fornix. The first move is to pull back until both fornices are in view, then aim between them at the spout tip.',
    objectiveIds: ['O1'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  practice: [],
  precommitDenyPatterns: [
    /\bspout tip\b/i,
    /\btip of the (laryngeal )?spout\b/i,
    /\bmidline (one|opening) (leads|is)\b/i,
    /\bblind pouch\b/i,
  ],
  sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide', 'nmmp-workshop-2024', 'dolphin-001-ct'],
}
