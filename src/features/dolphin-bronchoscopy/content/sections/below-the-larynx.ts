import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const belowTheLarynx: DolphinSectionDefinition = {
  ...dolphinSectionMeta('below-the-larynx'),
  clinicalQuestion:
    'You are driving down a dolphin’s trachea for the first time. What is the first opening you will meet, and how do you tell it from a main bronchus?',
  newConcept:
    'A bronchus leaves the trachea on the right before the carina: the right tracheal bronchus.',
  incrementSentence:
    'This section adds one idea to the last: below the larynx, the trachea gives off one bronchus on the right before it divides.',
  harmfulReflex: 'Taking the first right-sided opening in the trachea for the right main bronchus.',
  harmfulReflexPatterns: [
    /^the right main bronchus\b/i,
    /\bthe trachea has (already )?divided\b/i,
    /\bfirst opening on the right is\b/i,
  ],
  anchor: {
    analogy:
      'A side street leaves the main road a block before the big fork. Take it for the fork and every street name after it is off by one.',
    precise:
      'The right tracheal bronchus leaves the right wall of the trachea above the carina. The right main bronchus begins only at the carina.',
    checklistLabel: 'Down the trachea',
    checklist: [
      'Watch the right wall on the way down.',
      'An opening above the carina is the tracheal bronchus.',
      'The main bronchi begin at the carina.',
      'Count numbered branches from the carina, never from the tracheal bronchus.',
    ],
  },
  recognizeInstruction:
    'The scope sits just below the glottis. Look at the Simulator panel: the view, the 3D tree beside it and the CT that follows the tip.',
  blocks: [
    {
      id: 'past-the-glottis',
      kind: 'question',
      role: 'framing',
      heading: 'Past the glottis',
      body: 'Past the glottis the scope enters the larynx, a pear-shaped cavity 4–5 cm on its long axis. On this CT it measures 40–50 mm. Below it the trachea begins: short, wide, and held open by complete cartilage rings along its length.',
      numberIds: ['laryngeal-cavity'],
      sourceIds: ['tsang-2002', 'dolphin-001-ct'],
    },
    {
      id: 'watching-the-trachea',
      kind: 'signals',
      role: 'signals',
      heading: 'Watching the trachea',
      body: 'Keep off the walls and drive slowly. Look at both side walls as you go, not only straight ahead. Note every opening you meet before the trachea divides, and which wall it leaves. Labels name each opening; the 3D tree and the CT show where the tip is.',
      sourceIds: ['nmmp-workshop-2024', 'dolphin-001-ct'],
    },
    {
      id: 'the-tracheal-bronchus',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The right tracheal bronchus',
      body: 'A bronchus of its own leaves the right wall of the trachea above the carina: the right tracheal bronchus, RTB. Tsang places it about 10 cm below the lower end of the laryngeal spout and about 5 cm above the carina. Ivančić measured a mean of 5.1 cm on CT; this CT measures 57 mm.\n\nIt is wide: 1.53 cm at its widest, about 42% of the 3.63 cm trachea. It leaves at T1–T2, and the carina lies between T3 and the T4–T5 disc.',
      numberIds: [
        'rtb-below-spout',
        'rtb-above-carina',
        'rtb-diameter',
        'rtb-level',
        'carina-level',
      ],
      sourceIds: ['tsang-2002', 'ivancic-2014', 'dolphin-001-ct'],
    },
    {
      id: 'carina-and-main-bronchi',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The carina and the main bronchi',
      body: 'Below the tracheal bronchus the trachea runs on to the carina, where it divides into the right and left main bronchi. The two run virtually in parallel, so the carina shows two openings side by side.\n\nThe tracheal bronchus divides on its own. Tsang describes three subsegments; this CT shows three divisions, RT1, RT2 and RT3.',
      sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these comes from expecting the trachea to divide only once.',
      points: [
        'Taking the first opening on the right for the right main bronchus.',
        'Counting the tracheal bronchus or one of its divisions as RB1.',
        'Driving past the right wall of the trachea without looking at it.',
      ],
      sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide'],
    },
  ],
  workspace: {
    kind: 'scope',
    start: 'larynx',
    labels: 'shown',
    showLocation: true,
    ct: true,
    tree: true,
    caption:
      'The CT dolphin’s airway, scope just inside the larynx. Dorsal is at the top of the view.',
  },
  act: {
    kind: 'scope-lab',
    prompt:
      'Drive down the trachea and into the first opening in its side wall. Then back out, go on to the carina, and enter each main bronchus.',
    goals: [
      {
        kind: 'reach-in-order',
        abbrs: ['LX', 'TRA', 'RTB'],
        label: 'Larynx, trachea, then into the tracheal bronchus',
      },
      {
        kind: 'visit-all',
        abbrs: ['RMB', 'LMB'],
        label: 'Back out and enter both main bronchi',
      },
    ],
  },
  prediction: {
    id: 'below-predict',
    itemType: 'signal-recognition',
    situation:
      'The scope has gone through the larynx into a wide, ringed trachea. Well before the trachea divides, a round opening appears in its right wall.',
    stem: 'What is this opening?',
    choices: [
      {
        id: 'a',
        label: 'The right tracheal bronchus; the carina and both main bronchi lie further down.',
        rationale:
          'One bronchus leaves the trachea on the right above the carina. The trachea runs on past it.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The right main bronchus; the trachea has divided.',
        rationale:
          'The trachea divides only at the carina, further down. Taking this opening for the right main bronchus puts every later name on another airway.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'A blind pouch like the fornix; pull back.',
        rationale:
          'It is an open bronchus with divisions of its own. The fornices lie beside the spout, above the larynx.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'A bronchus to the right lung; enter it to find out which.',
        rationale:
          'It does lead into the right lung, but its place already names it: one opening in the right wall, above the carina.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The trachea gives off one bronchus before the carina: the right tracheal bronchus, from its right wall. The carina and the two main bronchi lie further down. Take it for the right main bronchus and every branch after it is misnamed.',
    objectiveIds: ['O1'],
    sourceIds: ['tsang-2002', 'ivancic-2014', 'nmmp-bronchoscopy-guide'],
  },
  transfer: {
    id: 'below-transfer',
    itemType: 'mechanism-interpretation',
    transferVariant: 'A record read back from video, instead of the view in front of you.',
    retrievesFrom: ['from-blowhole-to-spout'],
    situation:
      'A colleague’s record from last year reads “lavage, RB1”. The video shows the scope go through the glottis at the spout tip, run down the trachea, and turn into an opening in its right wall, well above the carina.',
    stem: 'Where was the lavage done?',
    choices: [
      {
        id: 'a',
        label: 'In the tracheal bronchus or one of its divisions, not in RB1.',
        rationale:
          'The opening was in the right wall, above the carina. RB numbers start below the carina, in the right main bronchus.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'In RB1, as recorded: the first opening on the right is RB1.',
        rationale:
          'The first opening on the right is the tracheal bronchus. RB1 is a branch of the right main bronchus, below the carina.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'In the left main bronchus; the record has the sides reversed.',
        rationale:
          'The opening was in the right wall, and the left main bronchus begins only at the carina.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Somewhere on the right; the record cannot be read further.',
        rationale:
          'The video says more than that. One opening in the right wall above the carina is the tracheal bronchus.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Place a site between landmarks you already know: the spout above, the carina below. The tracheal bronchus leaves the right wall about 10 cm below the lower end of the spout and about 5 cm above the carina. An opening there cannot be RB1.',
    objectiveIds: ['O1'],
    sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide'],
    numberIds: ['rtb-below-spout', 'rtb-above-carina'],
  },
  practice: [],
  precommitDenyPatterns: [/\btracheal bronchus\b/i, /\bRTB\b/, /\bfurther down\b/i],
  sourceIds: [
    'tsang-2002',
    'ivancic-2014',
    'nmmp-bronchoscopy-guide',
    'nmmp-workshop-2024',
    'dolphin-001-ct',
  ],
}
