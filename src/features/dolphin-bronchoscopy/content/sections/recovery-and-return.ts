import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const recoveryAndReturn: DolphinSectionDefinition = {
  ...dolphinSectionMeta('recovery-and-return'),
  clinicalQuestion:
    'The survey and the lavage are done, and the dolphin is sedated on the platform. What has to happen before it goes back to its pool?',
  newConcept:
    'The dolphin goes back to deep water only once its breathing is regular, after a watched recovery in shallow water; reversal is for excessive sedation, not routine.',
  incrementSentence:
    'This section adds one idea to the last: the sedation you planned has to wear off where the animal can still reach the surface.',
  harmfulReflex: 'Returning the animal to deep water before its breathing is regular.',
  harmfulReflexPatterns: [/\bstraight (back )?(in)?to\b/i, /\bdeep water now\b/i],
  anchor: {
    analogy:
      'A swimmer climbing out after a hard dive stays at the shallow end, with someone watching them breathe, before swimming laps again.',
    precise:
      'Withdraw the scope, watch the breathing on the platform, reverse only for excessive sedation, then observe in shallow water. Deeper water waits until breathing is regular.',
    checklistLabel: 'Before deep water',
    checklist: [
      'Scope out in one smooth movement.',
      'Breathing watched on the platform.',
      'Flumazenil only if sedation is excessive.',
      'Shallow water, watched, until breathing is regular.',
    ],
  },
  recognizeInstruction:
    'Read the clinical question, then the two facts in the Teaching panel. The passage in the Simulator panel has the blowhole lit. Nothing is asked yet.',
  blocks: [
    {
      id: 'water-and-sedation',
      kind: 'question',
      role: 'framing',
      heading: 'A sedated dolphin and water',
      body: 'Tsang judged heavy sedation and general anesthesia undesirable in dolphins, because the animal has to go back into water soon after the procedure. In water, every breath depends on the animal bringing its blowhole to the surface.',
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'what-you-watch',
      kind: 'signals',
      role: 'signals',
      heading: 'What you watch',
      body: 'The NMMP workshop monitors the ECG, the respiratory rate, the quality of each breath and the level of sedation. Over-sedation shows first as breaths further apart and a poor response.',
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'platform-to-pool',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'From the platform to the pool',
      body: 'Tsang’s bronchoscopies lasted 10–20 min, and he removed the scope in one smooth movement. His animals were then lifted into shallow water for about 30 min, to make sure there was no dyspnea, before they went back to their usual pools.\n\nMove the animal to deeper water once breathing is regular, with someone watching it the whole time until then.',
      numberIds: ['procedure-duration', 'shallow-water-recovery'],
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'reversal',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Reversal, only when needed',
      body: 'Flumazenil reverses midazolam. Ivančić gave 0.003–0.012 mg/kg IV or IM after CT in the live dolphin. The NMMP workshop names flumazenil for reversal without a dose.\n\nGive it when sedation is excessive: breaths further apart and a poor response. A drowsy animal that is breathing regularly needs time, not reversal. Reversal does not shorten the watch in shallow water.',
      numberIds: ['flumazenil'],
      sourceIds: ['ivancic-2014', 'nmmp-workshop-2024'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each one hands the animal to deep water, or to no one, too early.',
      points: [
        'Returning the animal to its home pool while its breaths are still irregular.',
        'Reversing every animal by habit.',
        'Ending the watch early because the animal was reversed.',
        'Leaving the shallow pool unattended.',
      ],
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
  ],
  firstMoves: [
    {
      id: 'over-sedation',
      troubleRowId: 'over-sedation',
      heading: 'Breaths further apart after the procedure',
      steps: [
        'No more top-ups.',
        'Support breathing.',
        'Flumazenil.',
        'Keep the animal out of deep water until breathing is regular.',
      ],
      callForHelp:
        'Call the attending veterinarian as soon as breaths grow further apart or the animal responds poorly.',
      sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['blowhole'],
    caption:
      'The passage, with the blowhole lit: the scope is out, and the breaths are what you watch.',
  },
  act: {
    kind: 'sequence',
    sequence: {
      id: 'recovery-steps',
      prompt: 'Put the recovery steps in order, from the end of the bronchoscopy to the home pool.',
      steps: [
        {
          id: 'scope-out',
          label: 'Withdraw the scope in one smooth movement.',
          detail:
            'Tsang removed it in one action at the end. The airway is clear before anything else is judged.',
        },
        {
          id: 'watch-platform',
          label: 'Watch the breathing on the platform: rate, quality and response.',
          detail:
            'Breaths further apart and a poor response are the earliest signs of over-sedation.',
        },
        {
          id: 'reverse-if',
          label: 'Give flumazenil, 0.003–0.012 mg/kg IV or IM, only if sedation is excessive.',
          detail:
            'Ivančić’s dose, given after CT; the NMMP workshop names flumazenil without a dose. A regular breather needs time, not reversal.',
        },
        {
          id: 'shallow',
          label: 'Move the animal to shallow water, with someone watching it the whole time.',
          detail:
            'Tsang lifted his animals into shallow water for about 30 min to make sure there was no dyspnea.',
        },
        {
          id: 'deep',
          label: 'Return it to deeper water once breathing is regular.',
          detail: 'Regular breathing is the sign the animal can manage deep water on its own.',
        },
      ],
      rationale:
        'The scope comes out first, then the breathing is judged. Reversal is a decision made on the platform, not a routine. Deep water comes last, after a watched recovery with regular breathing.',
      criticalStepIds: ['shallow', 'deep'],
      numberIds: ['flumazenil', 'shallow-water-recovery'],
      sourceIds: ['tsang-2002', 'ivancic-2014', 'nmmp-workshop-2024'],
    },
  },
  prediction: {
    id: 'recovery-predict',
    itemType: 'management-decision',
    situation:
      'The scope is out after a 15-minute bronchoscopy. On the platform the dolphin breathes at a steady rhythm and responds to touch, though it is still drowsy from midazolam.',
    stem: 'What happens next?',
    choices: [
      {
        id: 'a',
        label:
          'Shallow water with someone watching, and deeper water once breathing stays regular.',
        rationale:
          'Its breathing is steady, so it needs time, not reversal. Shallow water lets the watch go on in water.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Straight back into its home pool; it is breathing well.',
        rationale:
          'Drowsy in deep water, it has to bring its blowhole up for every breath with no one to help. Watch it first.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Give flumazenil now, so it is awake before it goes in the water.',
        rationale:
          'Reversal is for excessive sedation. This animal breathes steadily; it needs time and a watch.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Keep it on the platform until fully awake, then the home pool.',
        rationale:
          'The platform is watched, but time out of water carries its own risk. Tsang moved his animals to shallow water.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A drowsy dolphin breathing steadily needs time, not reversal. Tsang lifted his animals into shallow water for about 30 min to watch for dyspnea before their usual pools. Deeper water comes once breathing is regular.',
    objectiveIds: ['O5'],
    numberIds: ['shallow-water-recovery'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  transfer: {
    id: 'recovery-transfer',
    itemType: 'management-decision',
    transferVariant:
      'Breaths further apart after two midazolam top-ups, instead of a drowsy animal breathing steadily.',
    retrievesFrom: ['sedation-and-numbing'],
    situation:
      'This dolphin needed two midazolam top-ups during the procedure. With the scope out, its breaths come further and further apart, and it barely responds to touch.',
    stem: 'What is your first move?',
    choices: [
      {
        id: 'a',
        label:
          'No more top-ups; support its breathing and give flumazenil, and keep it out of deep water.',
        rationale:
          'Breaths further apart and a poor response after extra midazolam are over-sedation. This is what reversal is for.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Move it straight to its home pool; the water will rouse it.',
        rationale: 'A sedated dolphin in deep water may not reach the surface for its next breath.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Give albuterol for the slow breathing.',
        rationale:
          'Albuterol opens narrowed airways. These slow breaths come from the sedative, which flumazenil reverses.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Give oxygen and watch on the platform.',
        rationale: 'Oxygen supports it, but the cause is the sedative. Flumazenil treats that.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Top-ups followed by breaths further apart point to over-sedation. Stop top-ups, support breathing, give flumazenil, and keep the animal out of deep water until breathing is regular. The watch in shallow water still follows reversal.',
    objectiveIds: ['O5'],
    sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
  },
  practice: [
    {
      id: 'recovery-case-dose',
      sectionId: 'recovery-and-return',
      presentationTitle: 'Drawing up a reversal dose',
      situation:
        'A 180 kg dolphin is breathing slowly and responding poorly after the procedure. You decide to reverse the midazolam.',
      troubleRowId: 'over-sedation',
      item: {
        id: 'recovery-p-dose',
        itemType: 'management-decision',
        stem: 'Which flumazenil dose do you work from?',
        choices: [
          {
            id: 'a',
            label: '0.003–0.012 mg/kg IV or IM, from Ivančić’s work in the live dolphin.',
            rationale:
              'That is the published dolphin dose, given after CT. The NMMP workshop names flumazenil without a dose.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: '0.01 mg/kg IV or IM, as on the workshop’s sedation slide.',
            rationale:
              'That figure is the workshop’s midazolam top-up. The slide gives flumazenil no dose.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: '0.06–0.08 mg/kg IM, matched to the first midazolam dose.',
            rationale:
              'That is the midazolam dose. Flumazenil is a different drug with its own, much smaller range.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Whatever the facility protocol gives; no dolphin dose is published.',
            rationale:
              'Follow your protocol, but a dolphin dose is in print: Ivančić’s 0.003–0.012 mg/kg. Know it.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Ivančić gave flumazenil 0.003–0.012 mg/kg IV or IM after CT in the live dolphin; the NMMP workshop names it without a dose. The 0.01 mg/kg on the workshop slide is the midazolam top-up.',
        objectiveIds: ['O5'],
        numberIds: ['flumazenil', 'midazolam-topup', 'midazolam-im-first'],
        sourceIds: ['ivancic-2014', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'recovery-case-shallow-pool',
      sectionId: 'recovery-and-return',
      presentationTitle: 'Uneven breaths in the shallow pool',
      situation:
        'Ten minutes into recovery in the shallow pool, the dolphin’s breaths are still uneven. The trainers are needed with another animal, and someone suggests the home pool.',
      troubleRowId: 'over-sedation',
      item: {
        id: 'recovery-p-shallow-pool',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label:
              'Keep it in the shallow pool, with one person watching, until breathing is regular.',
            rationale:
              'Uneven breaths mean recovery is not done. The watch stays until breathing is regular.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Return it to deep water now so the trainers can go.',
            rationale: 'With uneven breaths, it may not reach the surface on time in deep water.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give flumazenil so it can go to its pool sooner.',
            rationale:
              'Reversal is for excessive sedation, not for a schedule, and the watch still follows it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Leave it in the shallow pool and check back shortly.',
            rationale:
              'Shallow water fits, but uneven breathing needs someone watching the whole time.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Deeper water waits until breathing is regular, and someone watches the whole time. Tsang’s animals spent about 30 min in shallow water to make sure there was no dyspnea.',
        objectiveIds: ['O5'],
        numberIds: ['shallow-water-recovery'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'recovery-case-habit',
      sectionId: 'recovery-and-return',
      presentationTitle: 'Reversal by habit',
      situation:
        'The bronchoscopy went smoothly on one dose of midazolam. On the platform the dolphin breathes steadily and lifts its head when touched. A colleague draws up flumazenil, as after the last procedure.',
      item: {
        id: 'recovery-p-habit',
        itemType: 'management-decision',
        stem: 'Do you give it?',
        choices: [
          {
            id: 'a',
            label: 'No; it is breathing steadily, so watch it in shallow water instead.',
            rationale:
              'Nothing here needs reversing. The safeguard for this animal is the watch, not the drug.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Yes; every sedated dolphin is reversed before it goes in the water.',
            rationale: 'Reversal is for excessive sedation. This animal shows none of its signs.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Give half the dose as a precaution.',
            rationale:
              'There is nothing to reverse. The precaution is the watch in shallow water, not a smaller dose.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Yes, then return it straight to its home pool.',
            rationale: 'Reversal does not replace the watch in shallow water.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'Reverse when you must: breaths further apart and a poor response. A dolphin breathing steadily needs time and a watcher in shallow water.',
        objectiveIds: ['O5'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
    {
      id: 'recovery-case-wet-blow',
      sectionId: 'recovery-and-return',
      presentationTitle: 'A wet blow after the lavage',
      situation:
        'Just after the lavage and the scope’s removal, each blow sprays a little fluid and the dolphin coughs twice. Its breaths are regular.',
      item: {
        id: 'recovery-p-wet-blow',
        itemType: 'management-decision',
        stem: 'What does this mean for recovery?',
        choices: [
          {
            id: 'a',
            label:
              'Expected after lavage; keep watching the breathing, and go on to shallow water.',
            rationale:
              'Tsang saw lidocaine and lavage fluid blown out through the blowhole regularly. Regular breaths let recovery go on.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Return it to deep water now; the cough is clearing its lungs.',
            rationale:
              'A cough is no sign that recovery is done. The watch in shallow water comes first.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give flumazenil; the cough means it is too sedated.',
            rationale:
              'Over-sedation shows as breaths further apart and a poor response. A cough is the opposite sign.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Keep it on the platform until the blow is dry.',
            rationale:
              'The platform is safe, but with regular breaths it can move on to shallow water and its watch.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Tsang saw lidocaine and lavage fluid blown out through the blowhole regularly. With regular breaths, recovery goes on to shallow water. Staff near the head keep masks and goggles on, since the blow can carry zoonotic organisms.',
        objectiveIds: ['O5'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
  ],
  precommitDenyPatterns: [
    /\bonce breathing\b/i,
    /\bneeds time, not reversal\b/i,
    /\bbreathing (is|stays) regular\b/i,
  ],
  sourceIds: ['tsang-2002', 'ivancic-2014', 'nmmp-workshop-2024'],
}
