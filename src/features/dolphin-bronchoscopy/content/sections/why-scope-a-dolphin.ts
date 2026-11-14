import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const whyScopeADolphin: DolphinSectionDefinition = {
  ...dolphinSectionMeta('why-scope-a-dolphin'),
  clinicalQuestion:
    'A dolphin has a soft cough and a cloudy blow. What can a sample from the blow tell you about its lungs?',
  newConcept:
    'Lower-airway disease is common in dolphins, and a sample taken at the blowhole does not stand for it.',
  harmfulReflex: 'Treating a blow culture as the diagnosis of the lungs.',
  harmfulReflexPatterns: [/\btreat on\b/i, /\blungs are clear\b/i, /\bnames the lung pathogen\b/i],
  anchor: {
    analogy:
      'A blow sample is a postcard from the front door. It tells you who came by on the way out, not what is happening in the back rooms.',
    precise:
      'A blow or blowhole sample carries whatever it met on the way out. Only a sample from a named bronchus shows the lower airway.',
    checklistLabel: 'Before you act on a blow sample',
    checklist: [
      'Where along the passage did this sample come from?',
      'Could the nasal passages or the water have grown it?',
      'Does the picture point at the lower airway?',
      'Would a lavage from a named bronchus change the plan?',
    ],
  },
  recognizeInstruction:
    'Read the clinical question in the Steps panel, then the two facts in the Teaching panel. Nothing is asked yet.',
  blocks: [
    {
      id: 'common-and-deep',
      kind: 'question',
      role: 'framing',
      heading: 'Pneumonia is common in dolphins',
      body: 'In a thirty-year review of U.S. Navy bottlenose dolphins, pneumonia was confirmed at death in about half of the animals (21 of 42). Staphylococcus aureus was the pathogen confirmed most often.',
      numberIds: ['pneumonia-necropsy-share'],
      sourceIds: ['venn-watson-2012'],
    },
    {
      id: 'one-fast-breath',
      kind: 'signals',
      role: 'signals',
      heading: 'One breath, very fast',
      body: 'A dolphin exchanges 75–90% of the air in its lungs in one-third of a second. It has no turbinates to filter that air on the way in or out. The blow you collect is that one explosive breath.',
      numberIds: ['tidal-exchange'],
      sourceIds: ['venn-watson-2012'],
    },
    {
      id: 'what-the-blow-carries',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What the blow carries',
      body: 'The blow passes the main bronchi, the trachea, the larynx, the nasopharynx, the nasal passages and the blowhole before it reaches your plate. Pool water sits at the blowhole between breaths. Whatever grows may have come from anywhere on that path.\n\nA lavage or brush from a named bronchus samples the place the disease is. It also lets you see the airway wall and its secretions.',
      sourceIds: ['nmmp-workshop-2024', 'venn-watson-2012'],
    },
    {
      id: 'culture-and-sensitivity',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Where culture and sensitivity come from',
      body: 'Nollens and colleagues expect a blow or blowhole sample to help with disease of the upper respiratory passages. They do not expect it to give accurate information about the lower airway. Bronchoscopy and lavage are their procedures for finding the cause of lower-airway disease.\n\nFor culture and in vitro sensitivities, lavage is the sample to send, or an aspirate of a pleural effusion if there is one. Cultures of blow swabs and exhalates, and cultures that grow mixed bacteria, they call overwhelmingly unreliable.',
      sourceIds: ['nollens-2018'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these treats the blow as if it were the lung.',
      points: [
        'Treating on a blow culture’s sensitivities as if it named the lung pathogen.',
        'Reading a blow with no growth as a clear lower airway.',
        'Scoping without a question the workup has framed. The section Before the day builds that question.',
      ],
      sourceIds: ['nmmp-workshop-2024'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['blowhole', 'main-bronchi'],
    caption:
      'The passage from the blowhole to the numbered branches. Lit: the two ends a sample can come from.',
  },
  act: {
    kind: 'sort',
    sort: {
      id: 'where-a-sample-comes-from',
      prompt: 'Sort each sample by what it can speak for.',
      origins: [
        {
          id: 'lower',
          label: 'Speaks for the lower airway',
          definition: 'Taken in a named bronchus, where lower-airway disease is.',
        },
        {
          id: 'path',
          label: 'Could come from anywhere on the way out',
          definition: 'Taken above the larynx, or from air that passed the whole passage.',
        },
      ],
      rows: [
        {
          id: 'blow-plate',
          statement: 'A blow collected on a culture plate held over the blowhole.',
          origin: 'path',
          rationale: 'The breath crossed the nasal passages and the wet blowhole before the plate.',
        },
        {
          id: 'bal-named',
          statement: 'Lavage fluid returned from a branch of the right main bronchus.',
          origin: 'lower',
          rationale: 'The saline sat in that branch and came back from it.',
        },
        {
          id: 'blowhole-swab',
          statement: 'A swab of the blowhole rim.',
          origin: 'path',
          rationale: 'The rim is the outermost part of the passage and sits in pool water.',
        },
        {
          id: 'brush-lmb',
          statement: 'A brush from a numbered branch of the left main bronchus.',
          origin: 'lower',
          rationale: 'The brush touched the wall of that branch and nothing else.',
        },
        {
          id: 'suction-npx',
          statement: 'Mucus suctioned while the scope tip was in the nasopharynx.',
          origin: 'path',
          rationale: 'The nasopharynx is above the larynx, so its mucus is upper-airway mucus.',
        },
        {
          id: 'secretions-seen',
          statement: 'Pus seen pooling at the opening of a named branch.',
          origin: 'lower',
          rationale:
            'You saw where it was. That is the lower airway, and it tells you where to sample.',
        },
      ],
      sourceIds: ['nmmp-workshop-2024'],
    },
  },
  prediction: {
    id: 'why-predict',
    itemType: 'mechanism-interpretation',
    situation:
      'A 20-year-old bottlenose dolphin has had a soft cough and a cloudy blow for a week. A blow sample on a plate grows a heavy mixed culture.',
    stem: 'What does the culture tell you about the lungs?',
    choices: [
      {
        id: 'a',
        label: 'What was on the passage out; on its own it cannot say what is in the lower airway.',
        rationale: 'The breath crossed every part of the upper airway and the wet blowhole first.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'It names the lung pathogen; treat on its sensitivities.',
        rationale:
          'The growth may come from the nasal passages or the water. Treating on it may miss what is in the lung.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Nothing; a blow sample has no use.',
        rationale:
          'It has use as a screen and as a trend over time. It just cannot stand for the lower airway alone.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'It reflects the lungs because the breath came from them.',
        rationale: 'The air came from the lungs, but it picked up everything on the way out.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A blow sample is the last thing the breath touched, not the first. It can screen and it can trend. Nollens and colleagues call blow cultures, and mixed growth, overwhelmingly unreliable. To know what is in the lower airway you need a sample from a named bronchus.',
    objectiveIds: ['O6'],
    sourceIds: ['nmmp-workshop-2024', 'venn-watson-2012', 'nollens-2018'],
  },
  transfer: {
    id: 'why-transfer',
    itemType: 'mechanism-interpretation',
    transferVariant: 'An empty plate instead of a heavy growth.',
    situation:
      'Another dolphin coughs after feeding and has lost interest in fish. Its blow culture grows nothing.',
    stem: 'What does the empty plate tell you?',
    choices: [
      {
        id: 'a',
        label: 'Little about the lower airway; disease there can sit behind a clean blow.',
        rationale:
          'The blow only samples the path out, so an empty plate cannot rule out the lungs.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The lungs are clear; stop the workup.',
        rationale:
          'An empty plate does not see the lower airway. Stopping here may miss pneumonia.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'The sample was taken badly and means nothing.',
        rationale: 'It may have been taken well. It answers a different question: the path out.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Repeat the blow until something grows.',
        rationale: 'More blows sample the same path. They cannot reach the lower airway.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A clean blow and a sick lung can sit together. If the history suggests the lower airway, the next step is a plan for a sample from a named bronchus.',
    objectiveIds: ['O6'],
    sourceIds: ['nmmp-workshop-2024'],
  },
  practice: [],
  precommitDenyPatterns: [/\bcannot (say|stand|speak)/i, /\bon the way out\b/i, /\bpassage out\b/i],
  sourceIds: ['venn-watson-2012', 'nmmp-workshop-2024', 'nollens-2018'],
}
