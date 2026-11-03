import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const choosingTheInstrument: DolphinSectionDefinition = {
  ...dolphinSectionMeta('choosing-the-instrument'),
  clinicalQuestion:
    'The CT shows disease around a branch far down the left main bronchus. Which scope will reach it from the blowhole, and what will that scope do in the airway?',
  newConcept:
    'Working length decides how far past the carina a scope reaches through the blowhole, and a gastrointestinal scope’s air stays off in the airway.',
  incrementSentence:
    'This section adds one idea to the last: the passage you drove uses up scope length before the first numbered branch.',
  harmfulReflex:
    'Choosing the scope by its diameter alone, or insufflating air through a gastrointestinal scope inside the airway.',
  harmfulReflexPatterns: [
    /\binsufflat(e|ing) air\b/i,
    /\bblow(ing)? air\b/i,
    /\bthinnest\b/i,
    /\bdiameter alone\b/i,
  ],
  anchor: {
    analogy:
      'Choose a ladder by the window you have to reach, not by how slim it is. If the tall one comes with a leaf blower, use its height and leave the blower off.',
    precise:
      'Working length sets how far past the carina a scope reaches through the blowhole. The gastrointestinal scope is longer, and its air has no place in an airway held open by cartilage.',
    checklistLabel: 'Before you choose the scope',
    checklist: [
      'Name the farthest site the question needs.',
      'Check that the working length reaches it through the blowhole.',
      'Know which lever or knobs steer the tip.',
      'With a gastrointestinal scope, leave the air button alone in the airway.',
    ],
  },
  recognizeInstruction:
    'Look at the passage map in the Simulator panel: the lit stops are the stretch the scope must fit and the far end it must reach. Then read the two signals in the Teaching panel. Nothing is asked yet.',
  blocks: [
    {
      id: 'two-scopes',
      kind: 'question',
      role: 'framing',
      heading: 'Two scopes on the shelf',
      body: 'The NMMP workshop sets two flexible scopes side by side. The bronchoscope has a working length of 600 mm and one thumb lever that bends the tip up or down. It has a suction button and no air button. The gastrointestinal endoscope has a working length of 1030 mm, two knobs that steer the tip in four directions, and an air and water button.',
      numberIds: ['scope-working-length'],
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'length-before-branches',
      kind: 'signals',
      role: 'signals',
      heading: 'Length spent before the first branch',
      body: 'From the blowhole the scope crosses the bony nasal passage, the nasopharynx, the spout, the larynx and the trachea before any numbered branch. In Tsang’s dolphins a 55 cm Olympus BF P30 bronchoscope reached the origins of 3–4 subsegmental branches, 3–4 cm past the carina. It went no farther.',
      numberIds: ['scope-reach-tsang'],
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'reach-decides',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Reach decides first',
      body: 'Tsang judged the standard 55 cm bronchoscope too short for the subsegmental level of most dolphin airways. When the question names a site deep along a main bronchus, plan the longer gastrointestinal scope.\n\nIn the nasal passage, width rarely decides. The bony nasal passage is 2–3 cm across. Harper’s group used an Olympus GIF-100 gastroscope in the harbor porpoise: 104 cm working length, 9.5 mm across, with a 2.8 mm channel.',
      numberIds: ['scope-reach-tsang', 'bony-nasal-passage', 'scope-harper'],
      sourceIds: ['tsang-2002', 'harper-2001'],
    },
    {
      id: 'what-each-does',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What each scope does in the airway',
      body: 'A gastrointestinal scope blows air to open a collapsed gut. The airway needs none: complete rings run the length of the trachea, and cartilage reaches far toward the periphery. A dolphin also holds each breath at full inspiration behind a shut glottis, so air blown in adds to a full lung. With the gastrointestinal scope, keep a finger off the air button.\n\nThe steering differs too. The bronchoscope’s single thumb lever bends the tip up or down; turn the whole scope to aim sideways. The gastrointestinal scope’s two knobs steer in four directions.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'ivancic-2014'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these chooses or handles the scope by a habit from another organ.',
      points: [
        'Choosing the thinner scope when the site lies beyond its reach.',
        'Using the gastrointestinal scope’s air to open the view, as in the stomach.',
        'Hunting for a side-to-side knob on the bronchoscope instead of turning the scope.',
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['nasal-passage', 'main-bronchi'],
    caption:
      'The passage from the blowhole to the numbered branches. Lit: the stretch the scope must fit and the far end it must reach.',
  },
  act: {
    kind: 'sort',
    sort: {
      id: 'bronchoscope-or-gi-scope',
      prompt: 'Sort each feature to the scope it belongs to.',
      origins: [
        { id: 'bronch', label: 'Bronchoscope', definition: 'The scope built for the airway.' },
        {
          id: 'gi',
          label: 'Gastrointestinal endoscope',
          definition: 'The scope built for the gut.',
        },
      ],
      rows: [
        {
          id: 'len-600',
          statement: 'A working length of 600 mm.',
          origin: 'bronch',
          rationale:
            'The bronchoscope on the NMMP workshop slide. Tsang’s was shorter still, at 55 cm.',
        },
        {
          id: 'len-1030',
          statement: 'A working length of 1030 mm.',
          origin: 'gi',
          rationale: 'The gastrointestinal scope on the same slide, the longer of the two.',
        },
        {
          id: 'thumb-lever',
          statement: 'One thumb lever that bends the tip up or down.',
          origin: 'bronch',
          rationale: 'To aim sideways, turn the whole scope.',
        },
        {
          id: 'two-knobs',
          statement: 'Two knobs that steer the tip in four directions, and a fixation lever.',
          origin: 'gi',
          rationale: 'Built for the turns of the gut. The same knobs steer it in the airway.',
        },
        {
          id: 'air-button',
          statement: 'An air and water button.',
          origin: 'gi',
          rationale: 'Made to blow open a collapsed gut. In the airway it stays untouched.',
        },
        {
          id: 'suction-only',
          statement: 'A suction button and no insufflation.',
          origin: 'bronch',
          rationale:
            'Cartilage holds the airway open, so the bronchoscope has no need to blow air.',
        },
        {
          id: 'tsang-reach',
          statement: 'Stopped 3–4 cm past the carina through a dolphin’s blowhole.',
          origin: 'bronch',
          rationale: 'Tsang’s 55 cm BF P30 reached only the origins of 3–4 subsegmental branches.',
        },
        {
          id: 'gif-100',
          statement: 'The Olympus GIF-100 used in the harbor porpoise.',
          origin: 'gi',
          rationale: 'A gastroscope: 104 cm working length, 9.5 mm across, with a 2.8 mm channel.',
        },
      ],
      numberIds: ['scope-working-length', 'scope-reach-tsang', 'scope-harper'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'harper-2001'],
    },
  },
  prediction: {
    id: 'instr-predict',
    itemType: 'management-decision',
    situation:
      'An adult bottlenose dolphin’s CT shows consolidation around a branch far down the left main bronchus. On the shelf are a bronchoscope and a gastrointestinal endoscope.',
    stem: 'Which do you plan to take, and how will you use it?',
    choices: [
      {
        id: 'a',
        label: 'The gastrointestinal scope, for its length, with its air never used in the airway.',
        rationale:
          'Its length reaches past where a bronchoscope stops. The airway, held open by cartilage, needs no air.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The gastrointestinal scope, insufflating air to open the view as in the stomach.',
        rationale:
          'The airway is not a collapsed gut. Air blown in adds to a lung already held full behind a shut glottis.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'The bronchoscope; it is made for airways, so it reaches every branch.',
        rationale:
          'Made for human airways. Through a dolphin’s blowhole a 55 cm bronchoscope stopped 3–4 cm past the carina.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'The bronchoscope, sampling whatever lies within its reach.',
        rationale:
          'A sample near the carina is from the lower airway, but not from the branch the CT shows.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Length decides what a scope reaches through the blowhole. Tsang found the standard 55 cm bronchoscope too short for the subsegmental level of most dolphin airways. The longer gastrointestinal scope reaches farther, but its air button was made for the gut; the cartilage-held airway needs no air.',
    objectiveIds: ['O2'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    numberIds: ['scope-reach-tsang', 'scope-working-length'],
  },
  transfer: {
    id: 'instr-transfer',
    itemType: 'management-decision',
    transferVariant: 'A site above the carina instead of one far down a main bronchus.',
    retrievesFrom: ['below-the-larynx'],
    situation:
      'Another dolphin’s CT shows disease in the right tracheal bronchus, which leaves the trachea above the carina. Both scopes are ready.',
    stem: 'Which do you plan to take?',
    choices: [
      {
        id: 'a',
        label: 'The bronchoscope: the site lies within its reach, and it has no air button.',
        rationale:
          'Tsang’s bronchoscope reached past the carina, so a site above it is in reach. Nothing on it can blow air.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The gastrointestinal scope, blowing air to hold the airway open as you go.',
        rationale:
          'Cartilage holds the airway open. Air blown in adds to a lung held full behind a shut glottis.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'The gastrointestinal scope, because the longer scope always reaches more.',
        rationale:
          'Length past the site adds nothing here, and it brings an air button to leave alone.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Either; both reach the tracheal bronchus.',
        rationale:
          'Both reach it. The bronchoscope does so with one thumb lever and nothing that can blow air.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Plan the scope from the farthest site the question needs. The tracheal bronchus lies above the carina, within a bronchoscope’s reach, so the longer scope and its air button bring nothing here.',
    objectiveIds: ['O2'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  practice: [
    {
      id: 'instr-p-mucus',
      sectionId: 'choosing-the-instrument',
      presentationTitle: 'Mucus on the lens in the trachea',
      situation:
        'The gastrointestinal scope is midway down the trachea. Mucus smears the lens and the view turns cloudy.',
      troubleRowId: 'secretions',
      item: {
        id: 'instr-p-mucus-item',
        itemType: 'management-decision',
        stem: 'How do you clear the view?',
        choices: [
          {
            id: 'a',
            label: 'Suction, then small saline flushes through the channel if needed.',
            rationale:
              'Suction lifts the mucus off the lens and the wall. Small flushes rinse what suction leaves.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Insufflate air to blow the mucus clear, as in the stomach.',
            rationale:
              'The airway needs no air, and air blown in adds to a lung held full behind a shut glottis. Suction clears mucus.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Advance; the view will clear lower down.',
            rationale:
              'Advancing without a view breaks the rule never to advance blindly, and mucus on the lens moves with the tip.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw to the larynx and wait for the view to clear.',
            rationale:
              'Pulling back is safe, but the mucus stays on the lens until suction or a flush clears it.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Mucus on the lens is cleared by suction and small flushes. The air button belongs to the gut, and the rule is never to advance blindly.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
    {
      id: 'instr-p-steer',
      sectionId: 'choosing-the-instrument',
      presentationTitle: 'Aiming into a main bronchus',
      situation:
        'The bronchoscope sits at the carina. The main bronchus you want lies off to one side of the view, and the thumb lever bends the tip only up and down.',
      item: {
        id: 'instr-p-steer-item',
        itemType: 'management-decision',
        stem: 'How do you aim into it?',
        choices: [
          {
            id: 'a',
            label:
              'Turn the whole scope until the opening lies above or below center, then bend the tip.',
            rationale:
              'Turning the scope brings the opening into the lever’s plane, so the lever can then bend the tip into it.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Use the second knob to steer the tip sideways.',
            rationale:
              'The bronchoscope has one thumb lever. Side-to-side knobs belong to the gastrointestinal scope.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Push forward and let the wall guide the tip in.',
            rationale:
              'That drives the tip along the wall. The rules are to keep off the walls and never advance blindly.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw to the trachea and come down again.',
            rationale:
              'Coming down again meets the carina at the same angle. The scope still has to be turned.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'A bronchoscope bends in one plane. Turn the scope to bring the opening into that plane, then bend the tip with the thumb lever.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
    {
      id: 'instr-p-narrow',
      sectionId: 'choosing-the-instrument',
      presentationTitle: 'A colleague’s case for the narrower scope',
      situation:
        'A colleague suggests the narrower of the two scopes, because the blowhole looks tight. The CT shows disease at a branch deep along the right main bronchus.',
      item: {
        id: 'instr-p-narrow-item',
        itemType: 'management-decision',
        stem: 'What should decide the choice?',
        choices: [
          {
            id: 'a',
            label:
              'Whether its working length reaches that branch; the nasal passage is 2–3 cm across.',
            rationale:
              'The bony nasal passage is wide enough. A scope that stops short of the branch cannot answer the question.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Diameter alone: the thinnest scope is the safest through the blowhole.',
            rationale:
              'Thin does not mean long. The scope that reaches the branch deep along the right main bronchus is the one that answers the question.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'The channel, so the brush and syringes fit.',
            rationale:
              'The channel matters for the tools, but a scope that stops short samples nothing at the branch.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Whichever scope the team used last time.',
            rationale:
              'Last time’s site may have been nearer the carina. The length needed comes from this CT.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Length decides first. The bony nasal passage is 2–3 cm across, so width rarely limits the choice there; a thin scope that stops near the carina leaves a deep site unsampled.',
        objectiveIds: ['O2'],
        sourceIds: ['tsang-2002'],
        numberIds: ['bony-nasal-passage'],
      },
    },
    {
      id: 'instr-p-full-length',
      sectionId: 'choosing-the-instrument',
      presentationTitle: 'The scope at its full length',
      situation:
        'The bronchoscope is in to its full working length. The branch the plan names is still ahead, out of reach.',
      item: {
        id: 'instr-p-full-length-item',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label:
              'Stop there, and record where the tip got to and that the planned branch was not reached.',
            rationale:
              'The scope can go no farther. An honest record tells the next plan that a longer scope is needed.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Bend the tip hard and push for the last few centimeters.',
            rationale:
              'Bending adds no length, and pressing on the wall breaks the rule to keep off the walls.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Lavage here and record it under the planned branch’s name.',
            rationale: 'The record would name a site the fluid never reached.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Lavage where the tip is, if it still serves the question.',
            rationale:
              'Sampling here may help, but the record must also say the planned branch was not reached.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Stop at the scope’s reach and never advance blind. Write down where the tip got to and what it did not reach; that tells the next plan which scope it needs.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
  ],
  precommitDenyPatterns: [
    /\bair (is )?never used\b/i,
    /\bneeds no air\b/i,
    /\bnot long enough\b/i,
    /\btoo short\b/i,
    /\bleave the air\b/i,
  ],
  sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'harper-2001', 'ivancic-2014'],
}
