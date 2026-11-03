import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const whatThisModuleCanSay: DolphinSectionDefinition = {
  ...dolphinSectionMeta('what-this-module-can-say'),
  clinicalQuestion:
    'You have worked every section and every integrated case. What does that let you claim before your first dolphin bronchoscopy, and what does it leave open?',
  newConcept:
    'These sections reach knowing how, with navigation shown in a simulator; scope handling, sedation and sampling in a living dolphin are learned only in supervised practice.',
  harmfulReflex: 'Treating completion as readiness to scope a living dolphin without supervision.',
  harmfulReflexPatterns: [
    /\bon (her|his|your|their) own\b/i,
    /\bwithout (supervision|a supervisor)\b/i,
    /\bready to (scope|lead)\b/i,
    /\bunsupervised\b/i,
  ],
  anchor: {
    analogy:
      'A flight simulator teaches the instruments, the checklists and the emergencies. The first real landings still happen with an instructor in the other seat.',
    precise:
      'What you can show here is the map, the plan, the ledger, the survey order and the first moves. Handling the scope, sedating and sampling a living dolphin are learned beside a supervising veterinarian.',
    checklistLabel: 'Before your first dolphin bronchoscopy',
    checklist: [
      'Can you name each stop on the passage and what lies ahead?',
      'Can you plan the day, the team and the lidocaine ledger?',
      'Do you know the first move for each trouble, in order?',
      'Who will supervise your hands on the scope?',
    ],
  },
  recognizeInstruction:
    'Read the clinical question and the two kinds of learning in the Teaching panel. The Simulator panel lights the whole passage you have learned.',
  blocks: [
    {
      id: 'what-you-have-done',
      kind: 'question',
      role: 'framing',
      heading: 'What you have done here',
      body: 'You have followed the passage from the blowhole to the numbered branches and driven to named branches with the labels off. You have planned the day and the team, worked the lidocaine ledger, surveyed and written the record, and chosen the first move for each kind of trouble.\n\nAll of it was on one dolphin’s CT and on cases.',
      sourceIds: ['dolphin-001-ct', 'nmmp-workshop-2024'],
    },
    {
      id: 'two-kinds',
      kind: 'signals',
      role: 'signals',
      heading: 'Two kinds of learning',
      body: 'Some of what a bronchoscopist needs is knowledge and judgment: the map, the plan, the order, the first move. Some lives in the hands and in a living animal: the feel of the scope at the spout, a sedated dolphin’s breathing, the pull of a wedged scope during lavage.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'worked-example',
      kind: 'pattern',
      role: 'worked-example',
      heading: 'Worked example',
      body: 'A veterinarian is booked to assist at her first dolphin bronchoscopy next month. Each week before it, she reworks one integrated case and reads its debrief. She opens the Reference tab and finds the first moves for each trouble and the five decisions. Then she writes a lidocaine ledger for the animal’s own weight.',
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'where-each-is-learned',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Where each kind is learned',
      body: 'Knowledge and judgment can be built and checked here, and the simulator adds navigation: you have driven to named branches with the labels off. That is knowing how, with navigation shown in simulation.\n\nThe rest is learned on living dolphins, beside an experienced bronchoscopist and the attending veterinarian: handling the scope, sedating the animal and taking samples. The cases rehearse the decisions; supervised procedures add the hands.',
      sourceIds: ['nmmp-workshop-2024', 'dolphin-001-ct'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these takes the simulator for the animal.',
      points: [
        'Taking a simulator drive for the feel of a real scope at the spout.',
        'Reading one dolphin’s CT as every dolphin’s airway.',
        'Treating a case debrief as a protocol; the NMMP protocol and the attending veterinarian set the day.',
      ],
      sourceIds: ['nmmp-workshop-2024', 'nmmp-mapping-2026'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: [
      'blowhole',
      'nasal-passage',
      'nasopharynx',
      'spout',
      'larynx',
      'trachea',
      'tracheal-bronchus',
      'carina',
      'main-bronchi',
    ],
    caption:
      'The whole passage, every stop lit: what these sections have taught, from the blowhole to the numbered branches.',
  },
  act: {
    kind: 'read',
    prompt:
      'Open the Integrated cases tab and work one case end to end, debrief included. Then open the Reference tab and find the first moves for each trouble and the five decisions.',
  },
  prediction: {
    id: 'closing-predict',
    itemType: 'mechanism-interpretation',
    situation:
      'A colleague has worked every section and every integrated case, and has driven the simulator to named branches with the labels off. Her first dolphin bronchoscopy is next month.',
    stem: 'What has she established?',
    choices: [
      {
        id: 'a',
        label:
          'She knows the map, the plan and the first moves, and can navigate the simulator; hands-on skills still need supervision.',
        rationale:
          'Knowledge, judgment and simulated navigation are what these sections build. Scope handling, sedation and sampling in a living dolphin are learned on supervised procedures.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'She is ready to scope a dolphin on her own, since the simulator used a real CT.',
        rationale:
          'A real CT gives a true map, not the feel of a scope at a living spout or a sedated animal’s breathing.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Nothing useful; only live procedures teach bronchoscopy.',
        rationale:
          'The map, the plan, the ledger and the first moves are learned and checked here. Supervised procedures build on them rather than starting from nothing.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'She can plan and navigate, so she can run the sedation while someone else drives.',
        rationale:
          'Sedating a living dolphin is itself a hands-on skill, learned under the attending veterinarian and the NMMP protocol.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Completing the sections and cases shows the map, the plan, the ledger, the survey order and the first moves, with navigation shown in a simulator. Handling the scope, sedating and sampling a living dolphin are learned only in supervised practice.',
    objectiveIds: ['O6'],
    sourceIds: ['nmmp-workshop-2024', 'dolphin-001-ct'],
  },
  transfer: {
    id: 'closing-transfer',
    itemType: 'management-decision',
    transferVariant:
      'From a colleague new to bronchoscopy to an experienced scopist of another species.',
    retrievesFrom: ['an-airway-apart-from-the-mouth'],
    situation:
      'An equine veterinarian who scopes horses every week has worked every section here. Her aquarium asks her to lead its first dolphin bronchoscopy next week; no one on staff has done one.',
    stem: 'What does she bring, and what does she still need?',
    choices: [
      {
        id: 'a',
        label:
          'The map, the plan and the first moves; someone experienced in dolphin bronchoscopy beside her for the first procedures.',
        rationale:
          'Her scope skills carry over in part, and the sections give her the dolphin map and plan. The spout, the breath-hold and dolphin sedation are learned on dolphins, with help.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Her horse experience and these sections mean she can lead it on her own.',
        rationale:
          'Horse cases do not teach the spout, a glottis that opens only with each breath, or the long breath-hold. Those are learned on dolphins, beside someone experienced.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Watch one dolphin bronchoscopy first, then lead the next.',
        rationale:
          'Watching helps, but scope handling at the spout and dolphin sedation are learned with her hands on the scope and someone experienced beside her.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'd',
        label: 'Her horse experience covers the scope work; only the dolphin map is new.',
        rationale:
          'The spout, the breath-hold and the sedation protocol differ from a horse. Hands that know a horse still need supervised dolphin cases.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Experience in other species carries the general scope skills, and the sections add the dolphin map, plan and first moves. What only dolphins teach, the spout, the breath-hold and the sedation, is learned beside someone who has done it.',
    objectiveIds: ['O6'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'ivancic-2014'],
  },
  practice: [],
  // The module frame's standing line ("Build the hands-on skill under supervision") is on every
  // page, so "hands-on" alone is not a leak here; the keyed answer's own phrasing is.
  precommitDenyPatterns: [
    /\bneeds? supervision\b/i,
    /\bnavigate the simulator\b/i,
    /\bknows the map, the plan\b/i,
  ],
  sourceIds: ['nmmp-workshop-2024', 'dolphin-001-ct', 'tsang-2002'],
}
