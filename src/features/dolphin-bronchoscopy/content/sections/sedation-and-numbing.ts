import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const sedationAndNumbing: DolphinSectionDefinition = {
  ...dolphinSectionMeta('sedation-and-numbing'),
  clinicalQuestion:
    'Midazolam and lidocaine both go into the plan. Which problem does each one answer at the spout, and how much lidocaine can one dolphin have in all?',
  newConcept:
    'Numb three places — the nasal passage, the spout and glottis, and the bronchi — and count every milliliter of lidocaine against one maximum per kilogram.',
  incrementSentence:
    'This section adds one idea to the last: the drug person’s log is a ledger, with one maximum for every site.',
  harmfulReflex:
    'Topping up sedation when the airway needs more topical lidocaine, or counting each site’s lidocaine against its own maximum.',
  harmfulReflexPatterns: [
    /\bdeepen (the )?sedation\b/i,
    /\b(allowance|maximum) of (its|their) own\b/i,
    /\b(fresh|new|separate) (allowance|maximum)\b/i,
  ],
  anchor: {
    analogy:
      'Sedation dims the whole house; lidocaine silences one doorbell at a time. A cough at the spout is a doorbell ringing, and every doorbell draws on one shared budget.',
    precise:
      'Midazolam calms the animal; topical lidocaine numbs the mucosa it touches. Numb the nasal passage, the spout and glottis, and the bronchi, and count every milliliter against one maximum per kilogram.',
    checklistLabel: 'Before each drug',
    checklist: [
      'A cough at one place, or a restless animal?',
      'A cough at one place: lidocaine there, then wait for regular breaths.',
      'Still restless once numb: a midazolam top-up.',
      'Every milliliter counts against the one maximum.',
    ],
  },
  recognizeInstruction:
    'Look at the three places lit on the passage map in the Simulator panel, then read the doses in the Teaching panel. Nothing is asked yet.',
  blocks: [
    {
      id: 'what-the-plan-covers',
      kind: 'question',
      role: 'framing',
      heading: 'What the plan has to cover',
      body: 'Tsang found that dolphins tolerate bronchoscopy poorly without some sedation. Yet heavy sedation keeps a dolphin from the water afterward. On the way down, the scope touches three sensitive places: the nasal passage, the spout and glottis, and the bronchi. Tsang’s animals coughed most as the scope went through the spout.',
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'sedation-doses',
      kind: 'signals',
      role: 'normal-reference',
      heading: 'Sedation doses, side by side',
      body: 'Midazolam is the sedative in both bronchoscopy accounts. The NMMP workshop gives a first dose of 0.06–0.08 mg/kg IM, then top-ups of 0.01 mg/kg IV or IM during the procedure. Tsang gave 0.04–0.06 mg/kg IM, or diazepam 0.16–0.17 mg/kg PO instead. Ivančić’s 0.02–0.09 mg/kg IM was sedation for transport to CT, not for bronchoscopy. Oral diazepam or tramadol an hour before is optional, per the NMMP protocol.',
      numberIds: [
        'midazolam-im-first',
        'midazolam-topup',
        'midazolam-im-tsang',
        'diazepam-po-tsang',
        'midazolam-im-ivancic',
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'ivancic-2014'],
    },
    {
      id: 'lidocaine-at-each-place',
      kind: 'signals',
      role: 'normal-reference',
      heading: 'Lidocaine at each place',
      body: 'The NMMP workshop numbs the upper airway with a laryngotracheal atomizer and sterile lidocaine jelly, and the lower airway with syringes through the scope. Its worked example counts 10 mL of 1% by atomizer and 5 mL of 1% injected for catheter placement. The jelly and the bronchial syringes are added as given.\n\nTsang gave lignocaine (lidocaine): 5 mL of 4% into the blowhole, then 2 mL of 4% sprayed twice on the glottis. Below it, 2 mL of 2% went into the upper trachea, the tracheal bronchus and each main bronchus, one dose at each.',
      numberIds: ['lidocaine-split', 'lignocaine-tsang'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'calm-or-numb',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Sedation calms; lidocaine numbs',
      body: 'Midazolam settles the animal so it lies still and tolerates handling. It does not numb the mucosa. A cough when the tip touches the spout is a reflex from mucosa the lidocaine has not yet reached.\n\nSo an animal that lies quiet but coughs at each touch needs more lidocaine on that place, by atomizer or through the scope. Top up midazolam only if it stays intolerant once the airway is numb. Deeper sedation spaces the breaths further apart, and the dolphin still has to return to the water.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'one-maximum',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'One maximum for every milliliter',
      body: 'The NMMP maximum is 4 mg/kg of lidocaine, every site added together. For a 181 kg dolphin that is 724 mg: 72.4 mL of 1%, or 36.2 mL of 2%.\n\nThe atomizer and the catheter injection come off that total first. The jelly and each bronchial syringe come off it as they are given. Mind the strength: a milliliter of 2% carries twice the lidocaine of 1%, and Tsang’s 4% twice that again. One person keeps the running total.',
      numberIds: ['lidocaine-max', 'lignocaine-tsang'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'reversal',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'Reversing midazolam',
      body: 'Flumazenil reverses midazolam. Ivančić gave 0.003–0.012 mg/kg IV or IM after CT, and the NMMP protocol names flumazenil for reversal without a dose. Over-sedation shows first as breaths further apart and a poor response.',
      numberIds: ['flumazenil'],
      sourceIds: ['ivancic-2014', 'nmmp-workshop-2024'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these gives the drug to the problem it does not answer, or loses the count.',
      points: [
        'Topping up midazolam for a cough that lidocaine on the spout should stop.',
        'Counting the bronchial syringes apart from the upper-airway doses.',
        'Leaving the jelly or the catheter injection out of the running total.',
        'Reading Ivančić’s CT transport doses as bronchoscopy doses.',
        'Converting milligrams to milliliters at 1% when the bottle is 2%.',
      ],
      numberIds: ['lidocaine-max'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'ivancic-2014'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['nasal-passage', 'spout', 'main-bronchi'],
    caption:
      'The passage from the blowhole to the numbered branches. Lit: the three places the scope touches on the way down.',
  },
  act: {
    kind: 'calculate',
    prompt:
      'Work the lidocaine ledger for this dolphin: its maximum, that maximum in each strength, and what remains once the planned doses are counted.',
    ledgerId: 'workshop-181',
  },
  prediction: {
    id: 'numb-predict',
    itemType: 'mechanism-interpretation',
    situation:
      'A sedated dolphin breathes steadily, but coughs hard each time the scope tip touches the spout. Between touches it lies quiet.',
    stem: 'What does it need?',
    choices: [
      {
        id: 'a',
        label:
          'Withdraw to the nasopharynx, then more topical lidocaine onto the spout and glottis.',
        rationale:
          'The animal is calm between touches, so the sedation is holding. The cough comes from the spout, which the lidocaine has not yet reached.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'A midazolam top-up to deepen the sedation until the cough stops.',
        rationale:
          'Sedation calms the animal; it does not numb the spout. Deeper sedation spaces the breaths, and the cough may go on.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Push through during the cough; the glottis is open then.',
        rationale:
          'A cough clamps the glottis and pushes the scope back. Advancing then meets a closed glottis.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Withdraw to the nasopharynx and wait for regular breaths.',
        rationale:
          'That is the first move, but waiting alone leaves the spout as sensitive as before.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Quiet between touches and a cough at each touch is a numbing problem, not a calming one. Withdraw, numb the spout and glottis, and let the breaths settle. Top up sedation only if the animal is still intolerant once the airway is numb.',
    objectiveIds: ['O2'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  transfer: {
    id: 'numb-transfer',
    itemType: 'management-decision',
    transferVariant:
      'A restless animal before anything has touched the airway, instead of a quiet one coughing at the spout.',
    situation:
      'Well after its first midazolam dose, before the scope has touched the blowhole, a dolphin lifts its head and fights the trainers. It is breathing regularly.',
    stem: 'What does it need?',
    choices: [
      {
        id: 'a',
        label: 'A midazolam top-up of 0.01 mg/kg IV or IM before the scope goes in.',
        rationale:
          'Nothing has touched the airway, so there is nothing to numb yet. A restless animal is a sedation problem, and the protocol tops up as needed.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Lidocaine into the blowhole to settle it.',
        rationale:
          'Lidocaine numbs the mucosa it touches. It does not calm an animal that fights before anything has touched it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Start anyway; it will settle once the scope is in.',
        rationale:
          'Tsang found dolphins tolerated bronchoscopy poorly without some sedation. A fighting animal makes the spout harder still.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'More trainers to hold it still.',
        rationale:
          'Holding steadies the body, but the animal is still distressed. Sedation is what settles it.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Match the drug to the problem. A restless animal before any touch needs sedation, here the NMMP top-up of 0.01 mg/kg. A quiet animal that coughs at one place needs lidocaine there.',
    objectiveIds: ['O2'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    numberIds: ['midazolam-topup'],
  },
  practice: [
    {
      id: 'numb-p-ledger',
      sectionId: 'sedation-and-numbing',
      presentationTitle: 'Numbing the bronchi in a smaller dolphin',
      situation:
        'A 150 kg dolphin. Its lidocaine maximum is 600 mg. The atomizer used 100 mg, the catheter injection 50 mg and the jelly 100 mg. You now plan 2 mL of 2% into each main bronchus and into the tracheal bronchus.',
      item: {
        id: 'numb-p-ledger-item',
        itemType: 'management-decision',
        stem: 'Does the plan fit the ledger?',
        choices: [
          {
            id: 'a',
            label:
              'Yes: the three bronchial doses fit well inside what remains of the one maximum.',
            rationale:
              'The upper airway and the jelly used well under half of the maximum. Three small doses of 2% fit in what is left.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Yes, because the bronchi have an allowance of their own, apart from the upper airway.',
            rationale:
              'There is one maximum for the whole animal. The bronchial doses fit only because the upper airway left room.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'No: the upper airway has already used the whole maximum.',
            rationale: 'Add the three lines: they come to well under half of the maximum.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Probably; give them and add them up at the end.',
            rationale:
              'They do fit, but the count comes before each syringe, not after the last one.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'One maximum covers every site. The atomizer, the catheter injection and the jelly have used part of it, and the bronchial doses come out of what is left. Count before each syringe, at its strength.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024'],
        numberIds: ['lidocaine-max'],
      },
    },
    {
      id: 'numb-p-cough-with-room',
      sectionId: 'sedation-and-numbing',
      presentationTitle: 'A cough at the spout with room on the ledger',
      situation:
        'A 160 kg dolphin lies quiet but coughs each time the tip touches the spout. The ledger maximum is 640 mg, and 250 mg has been given.',
      troubleRowId: 'spout-cough',
      item: {
        id: 'numb-p-cough-with-room-item',
        itemType: 'management-decision',
        stem: 'What next?',
        choices: [
          {
            id: 'a',
            label:
              'Withdraw to the nasopharynx, then more lidocaine onto the spout, logged against what remains.',
            rationale:
              'A calm animal coughing at one place needs that place numbed. More than half the maximum is still free.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'A midazolam top-up to deepen the sedation before trying again.',
            rationale:
              'Sedation does not numb the spout. Deeper sedation spaces the breaths, and the cough may go on.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Advance during the next cough, when the glottis opens.',
            rationale:
              'A cough clamps the glottis and pushes the scope back. Advancing then meets a closed glottis.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'More lidocaine on the spout, and total the ledger at the end.',
            rationale:
              'The lidocaine fits the problem, but the count belongs before each dose, not after the last.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Quiet between touches and coughing at the spout is a numbing problem. Withdraw first, then numb the spout; the ledger still has room, and each dose is logged as it goes in.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
    {
      id: 'numb-p-still-fighting',
      sectionId: 'sedation-and-numbing',
      presentationTitle: 'Still fighting after the spout is numbed',
      situation:
        'At the spout the dolphin coughed. You withdrew, sprayed more lidocaine onto the spout and glottis, and waited. Now it no longer coughs, but it thrashes and lifts its head whenever the scope moves.',
      troubleRowId: 'spout-cough',
      item: {
        id: 'numb-p-still-fighting-item',
        itemType: 'management-decision',
        stem: 'What next?',
        choices: [
          {
            id: 'a',
            label: 'A midazolam top-up of 0.01 mg/kg, then wait for regular breaths.',
            rationale:
              'The cough has stopped, so the spout is numb. An animal still intolerant once numb is the case for a top-up.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Another full round of lidocaine, counted as a fresh allowance.',
            rationale:
              'There is one maximum for the whole animal. And the spout is already numb; the problem now is the animal.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'More lidocaine on the spout; the cough has only paused.',
            rationale:
              'The cough has stopped. What remains is an animal that will not lie still, and lidocaine does not calm it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Hold, and wait for it to settle on its own.',
            rationale:
              'Waiting for regular breaths is part of it, but an animal still fighting once numb needs its top-up.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Numb first, then judge. Once the cough has stopped, an animal still fighting the scope needs a midazolam top-up of 0.01 mg/kg, followed by a wait for regular breaths.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024'],
        numberIds: ['midazolam-topup'],
      },
    },
    {
      id: 'numb-p-bronchus-cough',
      sectionId: 'sedation-and-numbing',
      presentationTitle: 'A cough at the left main bronchus',
      situation:
        'The scope went through the spout quietly after its lidocaine. As the tip enters the left main bronchus the dolphin starts to cough. It lay still a moment ago.',
      item: {
        id: 'numb-p-bronchus-cough-item',
        itemType: 'management-decision',
        stem: 'What do you give?',
        choices: [
          {
            id: 'a',
            label: 'Lidocaine into the left main bronchus through the scope, logged on the ledger.',
            rationale:
              'The spout is numb; the bronchus has not had its dose. Tsang gave lignocaine into each main bronchus before examining it.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'A midazolam top-up to deepen the sedation.',
            rationale:
              'The animal was still until the tip met a bronchus without lidocaine. Sedation does not numb it, and deeper sedation spaces the breaths.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'More lidocaine on the spout, since the cough comes from the larynx.',
            rationale:
              'The spout was quiet. The cough began as the tip entered a bronchus that has had no lidocaine.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw to the trachea and wait for it to settle.',
            rationale:
              'Pausing helps, but the bronchus still needs its lidocaine before the tip goes back in.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Each of the three places needs its own lidocaine, and the bronchi are the third. A cough that starts at a new place calls for lidocaine there, counted against the same maximum.',
        objectiveIds: ['O2'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'numb-p-ct-dose',
      sectionId: 'sedation-and-numbing',
      presentationTitle: 'A sedation dose from a CT study',
      situation:
        'A colleague’s plan gives midazolam 0.09 mg/kg IM for a bronchoscopy, citing a CT study of live dolphins.',
      item: {
        id: 'numb-p-ct-dose-item',
        itemType: 'mechanism-interpretation',
        stem: 'How do you read that dose?',
        choices: [
          {
            id: 'a',
            label:
              'As CT transport sedation; the NMMP bronchoscopy first dose is 0.06–0.08 mg/kg IM.',
            rationale:
              'Ivančić’s 0.02–0.09 mg/kg IM moved dolphins to CT. The dose in the plan sits above both bronchoscopy accounts.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'As a bronchoscopy dose; the CT study imaged the same airway.',
            rationale:
              'Ivančić’s 0.02–0.09 mg/kg IM was for transport to CT, a different task with a different end.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'As close enough, since Tsang also gave midazolam IM.',
            rationale:
              'Tsang gave 0.04–0.06 mg/kg IM. The plan’s dose is above his range and above the NMMP’s.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'As a top-up dose.',
            rationale: 'The NMMP top-up is 0.01 mg/kg IV or IM, far smaller.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Read every dose with its purpose. Ivančić’s range was for CT transport. For bronchoscopy the NMMP gives 0.06–0.08 mg/kg IM and Tsang 0.04–0.06 mg/kg IM, with NMMP top-ups of 0.01 mg/kg.',
        objectiveIds: ['O2'],
        sourceIds: ['ivancic-2014', 'nmmp-workshop-2024', 'tsang-2002'],
        numberIds: [
          'midazolam-im-ivancic',
          'midazolam-im-first',
          'midazolam-im-tsang',
          'midazolam-topup',
        ],
      },
    },
  ],
  precommitDenyPatterns: [
    /\bmore topical\b/i,
    /\bnot yet (numb|reached)\b/i,
    /\bnumbing problem\b/i,
    /\bsedation is holding\b/i,
    /\bdoes not numb\b/i,
  ],
  sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'ivancic-2014'],
}
