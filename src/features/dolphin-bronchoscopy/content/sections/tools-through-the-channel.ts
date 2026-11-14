import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const toolsThroughTheChannel: DolphinSectionDefinition = {
  ...dolphinSectionMeta('tools-through-the-channel'),
  clinicalQuestion:
    'The plan calls for a culture from the wall of the left main bronchus, then a forceps biopsy of a plaque beside it. Which brush goes down the channel for the culture, and how does each tool go down and come back?',
  newConcept:
    'A tool travels the working channel closed or sheathed and opens only beyond the scope tip; a culture needs a brush that stays sealed until it is in the bronchus.',
  incrementSentence:
    'This section adds one idea to the last: lavage fluid runs down the channel freely, but a tool goes down it in a state you choose and check.',
  harmfulReflex:
    'Forcing a tool through the channel, opening or exposing it before it is clear of the scope tip, or bringing it back open.',
  harmfulReflexPatterns: [
    /\bpush harder\b/i,
    /\bstill at the channel\b/i,
    /\bpush the open cups\b/i,
    /\bwithdraw the open\b/i,
    /\bhalf open\b/i,
  ],
  anchor: {
    analogy:
      'Carry the scissors closed down the corridor, open them only at the table, and close them before you walk back.',
    precise:
      'A tool travels the working channel closed or sheathed. It opens only once it is clear of the scope tip and in view, and is closed or sheathed again before it comes back. A culture brush stays sealed until it is in the bronchus.',
    checklistLabel: 'Each time a tool goes down the channel',
    checklist: [
      'Cups closed or the brush sheathed, and the scope tip eased toward straight.',
      'Advance until the tool is clear of the tip and in view.',
      'Open or put out only on your word.',
      'Close or sheathe before it comes back.',
    ],
  },
  recognizeInstruction:
    'The Simulator panel shows biopsy forceps and a sheathed brush, each beside its handle. Try each control once, then read the two signals in the Teaching panel. Nothing is asked yet.',
  blocks: [
    {
      id: 'two-tools',
      kind: 'question',
      role: 'framing',
      heading: 'Two tools, one channel',
      body: 'Both NMMP scopes have a working channel 2.8 mm across. The forceps and the brush go down it, and the assistant works their handles on your word. The forceps open and close at a spool; their cups come smooth, with a central prong, or serrated. The brush on the NMMP tray is a sterile, single-use sheathed cytology brush. Its bristles open to 3.0 mm out of a 1.7 mm sheath, on a shaft 115 cm long. Its plunger puts the brush out of the sheath and draws it back in.',
      numberIds: ['scope-sizes-annual', 'brush-nmmp'],
      sourceIds: ['nmmp-annual-training', 'judge-2014', 'owner-bench-clips'],
    },
    {
      id: 'read-the-screen',
      kind: 'signals',
      role: 'signals',
      heading: 'What the screen tells you',
      body: 'Watch the tip on the screen, not the handle. Closed cups leave the channel as one smooth bead; open, they spread into two jaws. The sheath comes out first as a plain tube, and the brush appears at its end. Until the tool is clear of the scope tip, the rim of the channel frames it.',
      sourceIds: ['owner-bench-clips'],
    },
    {
      id: 'sealed-brush',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'A culture needs a sealed brush',
      body: 'The scope reaches the bronchus through the blowhole, the nasal passage and the spout. Its channel carries what it meets. A sheathed cytology brush is open at the end. Its sheath keeps cells from being lost on the way out. It does not keep the channel’s contents off the bristles.\n\nA protected brush sits inside two telescoping catheters. It opens only in the bronchus, so what grows comes from the lower airway. Tsang brushed the main bronchi with double-sheath sterile brushes.',
      sourceIds: ['judge-2014', 'tsang-2002'],
    },
    {
      id: 'closed-in-closed-out',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Closed going down, closed coming back',
      body: 'Each tool goes down closed or sheathed and is advanced until it is clear of the scope tip and in view. Only then does the assistant open the cups or put out the brush. It comes back the same way: the cups closed on the bite, the brush drawn into its sheath, then withdrawn.\n\nDo not force a tool. One too large for the channel, pushed hard, or worked through a sharply bent tip damages the channel; ease the bend first.',
      sourceIds: ['dover-2001', 'owner-bench-clips'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these damages the channel or loses the sample.',
      points: [
        'Opening the cups as they appear, before they are clear of the tip.',
        'Pulling the forceps back half open to spare the bite.',
        'Withdrawing the brush without drawing it into its sheath.',
        'Forcing a sheathed brush through a hard-bent tip.',
        'Sending a culture from a brush that was open to the channel.',
      ],
      sourceIds: ['dover-2001', 'judge-2014', 'owner-bench-clips'],
    },
  ],
  workspace: {
    kind: 'instruments',
    instruments: ['forceps', 'brush'],
    caption:
      'Biopsy forceps and a sheathed brush, each beside its handle. Work the catheter and the handle; the side view shows the tip.',
  },
  act: {
    kind: 'instrument-drill',
    prompt:
      'In the Simulator panel, take the forceps and then the brush through their whole sequence, from the channel to the plaque and back.',
    instruments: ['forceps', 'brush'],
  },
  prediction: {
    id: 'tools-predict',
    itemType: 'management-decision',
    situation:
      'You want a culture from the wall of the left main bronchus. On the tray are a sheathed cytology brush and a double-sheath sterile brush. The scope is in the trachea.',
    stem: 'Which brush do you send down the channel for the culture?',
    choices: [
      {
        id: 'a',
        label:
          'The double-sheath brush, opened only in the bronchus, so the culture is from the lower airway.',
        rationale:
          'It stays sealed through the channel and opens at the wall you want, so the channel’s contents stay off the bristles.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The sheathed cytology brush; its sheath keeps the culture clean.',
        rationale:
          'Its sheath is open at the end. It keeps cells from being lost on the way out, not the channel’s contents off the bristles.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Either brush, as long as it comes sterile out of its pack.',
        rationale:
          'Sterile in the pack, but a brush open to the channel picks up what the scope carried down from the blowhole and the spout.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'd',
        label: 'Neither; lavage is the only sample that can be cultured.',
        rationale:
          'Lavage fluid can be cultured, but the question names the bronchial wall, and a protected brush samples that wall.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A culture must come from the wall, not from what the channel carried down. A double-sheath brush stays sealed until it is in the bronchus; an open-ended sheath protects the cells on the way out but not the bristles on the way down. Tsang used double-sheath sterile brushes.',
    objectiveIds: ['O4'],
    sourceIds: ['judge-2014', 'tsang-2002'],
  },
  transfer: {
    id: 'tools-transfer',
    itemType: 'management-decision',
    transferVariant: 'The forceps instead of the brush, and the moment of opening.',
    retrievesFrom: ['choosing-the-instrument'],
    situation:
      'Your assistant has advanced the closed forceps. On the screen the cups have just appeared in the rim of the channel, not yet clear of the scope tip. The plaque is ahead.',
    stem: 'When do you say "open"?',
    choices: [
      {
        id: 'a',
        label: 'Once the closed cups are clear of the scope tip and in view, short of the plaque.',
        rationale:
          'Clear of the tip, the jaws spread in the airway, not in the channel, and you see them open.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Now, while the cups are still at the channel rim.',
        rationale: 'Jaws opened in the channel scrape it and can catch on the rim.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Only after pressing the closed cups firmly against the plaque.',
        rationale:
          'Against the wall the jaws have no room to spread. Open just short of the target, then advance onto it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Once the cups are clear of the tip, whether or not you can see them.',
        rationale: 'Clear of the tip is the condition, but open only what is in view.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Open the cups only once they are clear of the scope tip and in view, just short of the target; then advance onto it and close. Opened in the channel, the jaws damage it.',
    objectiveIds: ['O4'],
    sourceIds: ['owner-bench-clips', 'dover-2001'],
  },
  practice: [
    {
      id: 'tools-p-early',
      sectionId: 'tools-through-the-channel',
      presentationTitle: 'The cups open too soon',
      situation:
        'You say "open" as the forceps appear. The assistant opens at once; on the screen the cups are still half inside the rim of the channel.',
      item: {
        id: 'tools-p-early-item',
        itemType: 'management-decision',
        stem: 'What do you say next?',
        choices: [
          {
            id: 'a',
            label: '"Close." Advance until the cups are clear of the tip, then open again.',
            rationale: 'Closing takes the jaws off the channel; clear of the tip they open freely.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Keep going: push the open cups out and take the bite.',
            rationale: 'Open jaws dragged along the channel rim scrape it on the way out.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Withdraw the open forceps and start again.',
            rationale:
              'Pulling them back open drags the jaws through the channel; close them first.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: '"Close," and wait for the next breath before going on.',
            rationale:
              'Closing is the first move, but the breath does not matter here; advance until the cups are clear.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Close at once, advance until the cups are clear of the scope tip and in view, then open. Say "open" only when you can see the cups clear of the tip.',
        objectiveIds: ['O4'],
        sourceIds: ['owner-bench-clips', 'dover-2001'],
      },
    },
    {
      id: 'tools-p-bite',
      sectionId: 'tools-through-the-channel',
      presentationTitle: 'A piece in the cups',
      situation:
        'The cups have closed on the plaque and pulled a piece free. The assistant asks whether to look at it before bringing the forceps back.',
      item: {
        id: 'tools-p-bite-item',
        itemType: 'management-decision',
        stem: 'What next?',
        choices: [
          {
            id: 'a',
            label:
              'Keep the cups closed, withdraw the forceps, and open them over the specimen container.',
            rationale: 'Closed, the piece stays in the cups all the way out of the channel.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Open the cups at the scope tip to check the bite first.',
            rationale: 'Opened in the airway, the piece falls back into it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Pull the forceps back with the cups half open so the piece is not crushed.',
            rationale: 'Half-open jaws catch the channel and drop the piece.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Withdraw them closed, and take more bites before sending anything.',
            rationale:
              'More than one bite raises the yield, but each comes out closed and goes into the container before the next.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'A bite comes back in closed cups and is opened over its container. More than one bite raises the yield; each makes the same trip closed.',
        objectiveIds: ['O4'],
        sourceIds: ['owner-bench-clips', 'judge-2014'],
      },
    },
    {
      id: 'tools-p-bend',
      sectionId: 'tools-through-the-channel',
      presentationTitle: 'The brush stops in the channel',
      situation:
        'The sheathed brush stops partway down the channel. The scope tip is bent hard toward a branch.',
      item: {
        id: 'tools-p-bend-item',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Ease the bend toward straight, then advance the sheathed brush gently.',
            rationale:
              'A tool worked through a sharply bent tip can damage the channel; with the bend eased it goes on through.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push harder until the brush comes through the bend.',
            rationale: 'Force against a hard bend damages the channel.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Withdraw it and use a smaller brush.',
            rationale: 'The brush fits the channel; the bend is what stops it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw the brush, straighten the scope, and start it down again.',
            rationale:
              'That works, but easing the bend with the brush in place does the same without starting over.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'A tool that stops in the channel is meeting the bend. Ease the tip toward straight and advance gently; forcing it damages the channel.',
        objectiveIds: ['O4'],
        sourceIds: ['dover-2001'],
      },
    },
  ],
  precommitDenyPatterns: [
    /\bsealed until\b/i,
    /\bstays sealed\b/i,
    /\btelescoping\b/i,
    /\bopen at the end\b/i,
    /\bopen-ended sheath\b/i,
    /\bcarried down\b/i,
  ],
  sourceIds: [
    'nmmp-annual-training',
    'judge-2014',
    'tsang-2002',
    'dover-2001',
    'owner-bench-clips',
  ],
}
