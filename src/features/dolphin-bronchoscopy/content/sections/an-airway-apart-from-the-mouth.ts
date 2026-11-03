import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const anAirwayApartFromTheMouth: DolphinSectionDefinition = {
  ...dolphinSectionMeta('an-airway-apart-from-the-mouth'),
  clinicalQuestion:
    'You have scoped dogs, horses and birds. Where does a scope have to go to reach a dolphin’s larynx?',
  newConcept:
    'The larynx stands up into the nasopharynx as the laryngeal spout, so air never crosses the mouth.',
  harmfulReflex: 'Reaching for the larynx through the mouth, as in most mammals you scope.',
  harmfulReflexPatterns: [/\bmouth\b/i, /\bpast the tongue\b/i],
  anchor: {
    analogy:
      'Think of a snorkel pushed up through the floor of a room into the attic. Food moves through the room; air only ever moves through the attic and down the snorkel.',
    precise:
      'The arytenoid and epiglottic cartilages form the laryngeal spout, held in the nasopharynx by a sphincter. Food passes either side of it to the esophagus.',
    checklistLabel: 'The two separate paths',
    checklist: [
      'Air: blowhole, nasal passage, nasopharynx, spout, larynx.',
      'Food: mouth, around the spout, esophagus.',
      'The scope takes the air path only.',
    ],
  },
  recognizeInstruction:
    'Turn the 3D dolphin in the Simulator panel: drag to rotate, scroll to zoom. Find the blowhole on top of the head.',
  blocks: [
    {
      id: 'top-of-the-head',
      kind: 'question',
      role: 'framing',
      heading: 'The nares moved to the top of the head',
      body: 'The dolphin skull is telescoped: the facial bones have shifted back over the braincase and carried the nares to the top of the head. One blowhole, closed at rest by the nasal plugs, opens onto two bony nasal passages.',
      sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
    },
    {
      id: 'no-filter',
      kind: 'signals',
      role: 'signals',
      heading: 'What is missing',
      body: 'There are no turbinates and no other upper-airway filter. Nothing warms or cleans the air between the blowhole and the lungs.',
      sourceIds: ['venn-watson-2012', 'nmmp-workshop-2024'],
    },
    {
      id: 'the-spout',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The laryngeal spout',
      body: 'The arytenoid and epiglottic cartilages form a long tube, the laryngeal spout or goosebeak. It rises into the nasopharynx and is held there by the palatopharyngeal sphincter. The glottis opens at its tip, a rosette-shaped opening with no separate epiglottic flap.\n\nSwallowed food passes on either side of the spout to reach the esophagus. Breathing and swallowing follow separate paths.',
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these carries a habit from other species into the dolphin.',
      points: [
        'Looking for the larynx past the tongue.',
        'Expecting an epiglottis to fold over the glottis.',
        'Expecting turbinates to warm and filter what the scope passes.',
      ],
      sourceIds: ['tsang-2002'],
    },
  ],
  workspace: {
    kind: 'anatomy',
    preset: 'airway-in-body',
    caption:
      'The dolphin from CT, seen from the right with the body made transparent. Drag to turn it.',
  },
  act: {
    kind: 'anatomy-pick',
    prompt: 'Pick each structure in the 3D dolphin. A pick shows its name and why it matters.',
    preset: 'airway-in-body',
    prompts: [
      {
        id: 'pick-nasal',
        prompt: 'Pick the passages that run from the blowhole down through the skull.',
        answerId: 'nasal-passages',
        rationale: 'The bony nasal passages are the scope’s first stage, below the nasal plugs.',
      },
      {
        id: 'pick-airway',
        prompt: 'Pick the tube that carries air from the larynx to the lungs.',
        answerId: 'airway',
        rationale:
          'Spout, larynx, trachea and bronchi: the path the scope follows after the nasopharynx.',
      },
      {
        id: 'pick-esophagus',
        prompt: 'Pick the tube that swallowed fish takes to the stomach.',
        answerId: 'esophagus',
        rationale:
          'Food reaches it by passing either side of the spout. It never crosses the air path.',
      },
    ],
    sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
  },
  prediction: {
    id: 'apart-predict',
    itemType: 'mechanism-interpretation',
    situation: 'A dolphin swallows a fish between two breaths.',
    stem: 'Where does the fish cross the air path?',
    choices: [
      {
        id: 'a',
        label: 'It does not; it passes either side of the laryngeal spout to the esophagus.',
        rationale: 'The spout stays seated in the nasopharynx, so food goes around it.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Over the glottis, once the epiglottis folds down, as in a dog.',
        rationale:
          'That is the pattern of most mammals. Here the glottis sits up in the nasopharynx, out of the food path.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Through the nasopharynx, above the spout.',
        rationale: 'The nasopharynx is the air chamber. Food reaching it would be aspirated.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Only when the blowhole is closed, so the timing keeps it out.',
        rationale:
          'The blowhole closes at rest anyway. The anatomy keeps food out, not the timing.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The larynx is pulled up into the nasopharynx as a tube, the spout, and held there. Food travels around it to the esophagus. So the only way to the trachea is from above, through the nasopharynx.',
    objectiveIds: ['O6', 'O1'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  transfer: {
    id: 'apart-transfer',
    itemType: 'mechanism-interpretation',
    transferVariant: 'From swallowing to the scope’s own entry.',
    stem: 'Where does the scope enter to reach a dolphin’s trachea?',
    choices: [
      {
        id: 'a',
        label: 'The blowhole, then a bony nasal passage and the nasopharynx to the spout.',
        rationale: 'That is the air path, and the only one that leads to the glottis.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The mouth, past the tongue to the larynx.',
        rationale: 'The larynx is not reachable there; it is sealed up in the nasopharynx.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'The esophagus, then across into the trachea.',
        rationale: 'There is no crossing below the spout. The esophagus leads only to the stomach.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Either bony nasal passage, straight down to the trachea.',
        rationale:
          'The nasal passage leads to the nasopharynx first. The spout still has to be found there.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Blowhole, nasal passage, nasopharynx, spout. Each later section drives one stretch of that path.',
    objectiveIds: ['O1'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  practice: [],
  precommitDenyPatterns: [/\baround the spout\b/i, /either side of (the|it)/i, /\bseated\b/i],
  sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'venn-watson-2012', 'ivancic-2014'],
}
