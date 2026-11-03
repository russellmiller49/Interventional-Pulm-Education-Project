import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const troubleDuringTheProcedure: DolphinSectionDefinition = {
  ...dolphinSectionMeta('trouble-during-the-procedure'),
  clinicalQuestion:
    'Partway through a dolphin bronchoscopy something changes: a cough, a long pause between breaths, blood, a view you no longer recognize. What do your hands do first?',
  newConcept: 'none (the trouble grammar, applied)',
  harmfulReflex:
    'Pushing on, or adding sedation, when the first move is to withdraw and let the animal breathe.',
  harmfulReflexPatterns: [
    /\bpush on\b/i,
    /\bkeep advancing\b/i,
    /\banother top-up\b/i,
    /\bmore midazolam\b/i,
    /\bfinish the (survey|sample|sampling|left side)\b/i,
  ],
  anchor: {
    analogy:
      'When the road ices over, you lift your foot off the gas before you reach for anything else. In the airway, the gas pedal is the scope.',
    precise:
      'For most changes the first move is to stop, bring the scope back to a place you know, and let the animal breathe. Bleeding is the exception: stay wedged.',
    checklistLabel: 'When something changes',
    checklist: [
      'Stop advancing.',
      'Name the earliest sign and the trouble it belongs to.',
      'Back to a place you know, unless it is blood: then stay wedged.',
      'Call the attending veterinarian as your hands move, not instead.',
    ],
  },
  recognizeInstruction:
    'Read the clinical question and the earliest signs in the Teaching panel. The passage map in the Simulator panel lights the places where trouble most often starts.',
  blocks: [
    {
      id: 'place-and-sign',
      kind: 'question',
      role: 'framing',
      heading: 'Each trouble has a place and an earliest sign',
      body: 'Most trouble in a dolphin bronchoscopy starts at a predictable place: a cough at the spout, a lost view among the numbered branches, blood after a brush. A long pause between breaths can come at any point.\n\nEach has an earliest sign that comes before the animal is in danger. A team that watches for it has time to act.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'what-to-watch',
      kind: 'signals',
      role: 'signals',
      heading: 'What to watch',
      body: 'A dolphin holds each breath at full inspiration, then exhales and inhales in one fast burst. A pause is normal; one longer than this animal’s own pattern is not. Watch the heart rate, the breathing rate and quality, and mentation throughout.',
      points: [
        'Spout: a cough; the glottis clamps and pushes the scope back.',
        'Any point: breaths further apart, or no breath when one is due.',
        'Branches: what you expect to see does not match the picture.',
        'After a brush or biopsy: blood fills the lumen.',
        'Lavage: far less returns than was instilled.',
        'Deep branches: a cloudy view, the scope nearly as wide as the lumen.',
      ],
      sourceIds: ['ivancic-2014', 'venn-watson-2012', 'nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'why-back-first',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why the first move is back',
      body: 'The scope is the one thing you added to the airway, and the one thing you can take away at once. Withdrawn to the nasopharynx, it leaves the glottis free to open and close, and the animal free to breathe.\n\nSedation works the other way. Too much of it spaces the breaths out, the same sign as a long breath-hold, so more of it deepens what you are seeing. On a cough it calms the animal but does not numb the spout.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'numb-before-sedate',
      kind: 'after-commitment',
      role: 'first-moves',
      heading: 'At the spout, numb before you sedate',
      body: 'A cough when the tip touches the spout is the airway answering the scope. Withdraw to the nasopharynx and give more topical lidocaine, by atomizer or through the scope. Count it against the 4 mg/kg maximum. Wait for regular breaths before the next approach.\n\nTop up midazolam only if the animal stays intolerant once the airway is numb.',
      numberIds: ['lidocaine-max'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'when-you-hold',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'When you hold instead of backing out',
      body: 'Two changes call for holding still. After a brush or biopsy, blood fills the lumen: keep the scope wedged in that branch. Wedged, it tamponades the branch and keeps blood out of the others. Then suction, cold saline, wait, and stop sampling. The workshop also names topical tranexamic acid and epinephrine, given per the NMMP protocol.\n\nAt a closed glottis with a calm, numb animal, hold at the spout and advance only in the moment it opens. Never push.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these keeps the scope moving, or adds a drug, before the first move.',
      points: [
        'Pushing through a cough at the spout, between coughs.',
        'Treating a long breath-hold with more midazolam.',
        'Finishing the survey before withdrawing, because it is nearly done.',
        'Pulling out of a bleeding branch to see where the blood goes.',
        'Driving on when lost, hoping the next branch explains the view.',
        'Calling for help and waiting, with the scope still where the trouble began.',
      ],
      sourceIds: ['nmmp-workshop-2024'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['spout', 'trachea', 'carina', 'main-bronchi'],
    caption:
      'The passage, lit where trouble most often starts: the spout, the trachea, the carina and the numbered branches.',
  },
  act: {
    kind: 'scenario',
    scenario: {
      id: 'trouble-scenario',
      title: 'One bronchoscopy, from the spout to the brush',
      frames: [
        {
          id: 'trouble-frame-spout',
          time: 'At the spout',
          troubleRowId: 'spout-cough',
          situation:
            'A 205 kg female, sedated with midazolam IM, the atomizer and catheter lidocaine given. The scope tip touches the laryngeal spout. She coughs hard, the glottis clamps, and the scope is pushed back.',
          prompt: 'What do your hands do first?',
          choices: [
            {
              id: 'a',
              label: 'Stop, withdraw to the nasopharynx, and give more topical lidocaine.',
              rationale:
                'The cough is the spout reacting to the tip. Backing off frees the glottis; lidocaine numbs the place that coughed.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Push on through the glottis between coughs.',
              rationale:
                'The glottis is clamping. Pushing against it risks laryngospasm and injury to the spout.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Give more midazolam with the scope where it is.',
              rationale:
                'She was calm before the tip touched. Sedation does not numb the spout, and it spaces her breaths.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label: 'Hold the tip on the spout until the cough stops.',
              rationale:
                'Waiting is in the sequence, but not with the tip still touching the spout that coughed.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
        {
          id: 'trouble-frame-breath',
          time: 'In the trachea',
          troubleRowId: 'breath-hold',
          situation:
            'Numbed and settled, she lets the scope through the glottis. Halfway down the trachea, the trainer at her head calls that a breath is due and has not come.',
          prompt: 'What is your first move?',
          choices: [
            {
              id: 'a',
              label: 'Withdraw to the nasopharynx, or out, and let her breathe.',
              rationale:
                'No breath when one is due is the earliest sign. The scope across the glottis is the one thing you can take away at once.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Push on to the carina and finish the survey before the next breath.',
              rationale:
                'Breathing comes before the survey. Every moment with the scope across the glottis lets the hold lengthen.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Give albuterol through the scope and keep the tip where it is.',
              rationale:
                'Albuterol comes later, per the NMMP protocol, once the scope is out of the glottis and she is breathing.',
              plausibility: 'incorrect-mechanism',
            },
            {
              id: 'd',
              label: 'Call the attending veterinarian and wait for instructions.',
              rationale:
                'Call, yes, but while your hands withdraw. Waiting leaves the scope across the glottis.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
        {
          id: 'trouble-frame-lost',
          time: 'Among the right branches',
          troubleRowId: 'lost-orientation',
          situation:
            'She is breathing regularly again, and you are back down the right main bronchus. Counting branches, you reach an opening you cannot place: the picture no longer matches the count.',
          prompt: 'What do you do?',
          choices: [
            {
              id: 'a',
              label:
                'Withdraw to the carina, find the tracheal bronchus again, and count from the carina.',
              rationale:
                'The carina and the tracheal bronchus are landmarks you cannot mistake. Counting again from there restores the map.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Keep advancing; the next branch will show where you are.',
              rationale:
                'Advancing when lost is advancing blindly. The further you go, the harder the way back.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Give the opening the next number and carry on.',
              rationale:
                'Paired branches do occur, so the count can slip. A guess written into the record outlives the procedure; count again first.',
              plausibility: 'reasonable-but-incomplete',
            },
            {
              id: 'd',
              label: 'Withdraw out of the blowhole and start the survey again.',
              rationale:
                'It would restore orientation, but the carina is a known landmark you can reach at once, without passing the spout again.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
        {
          id: 'trouble-frame-bleed',
          time: 'After the brush',
          troubleRowId: 'bleeding',
          situation:
            'You brush a reddened wall in a branch of the right main bronchus. As the brush comes back, blood fills the lumen of that branch.',
          prompt: 'What do your hands do first?',
          choices: [
            {
              id: 'a',
              label: 'Keep the scope wedged in that branch, suction, and instil cold saline.',
              rationale:
                'Wedged, the scope tamponades the branch and keeps blood out of the others. Suction and cold saline follow, then wait.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Brush again to finish the sample, then deal with the blood.',
              rationale:
                'Sampling stops when the bleeding starts. Another stroke of the brush adds to it.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Pull back to the carina to see where the blood is going.',
              rationale:
                'Pulling out of the branch lets blood spill into the others. The wedge confines it.',
              plausibility: 'incorrect-mechanism',
            },
            {
              id: 'd',
              label: 'Stop sampling and call the attending veterinarian.',
              rationale:
                'Both are in the sequence, after the wedge, the suction and the cold saline. Hands first.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-bronchoscopy-guide'],
    },
  },
  prediction: {
    id: 'trouble-predict',
    itemType: 'management-decision',
    situation:
      'The scope is at the carina, twelve minutes in. The dolphin starts to shift on the mat, and her breaths are coming further apart than at the start.',
    stem: 'What do your hands do first?',
    choices: [
      {
        id: 'a',
        label: 'Withdraw to the nasopharynx, or out, and let her breathe.',
        rationale:
          'Breaths spacing out is the earliest sign. Backing out frees the glottis, and nothing you add helps until she is breathing.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Give another top-up of midazolam so she settles for the survey.',
        rationale:
          'Shifting looks like resistance, but the breaths spacing out is the sign that matters. More sedation spaces them further.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Finish the survey quickly, then withdraw.',
        rationale:
          'The survey can wait; breathing cannot. Every minute with the scope across the glottis lets the sign deepen.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Call the attending veterinarian and wait with the scope where it is.',
        rationale:
          'Calling belongs in the sequence, but while your hands withdraw. Waiting leaves the scope across the glottis.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Breaths spacing out is the earliest sign of a lengthening breath-hold. The first move is to withdraw to the nasopharynx, or out, and let the animal breathe. Oxygen follows, and the procedure stops if breathing does not recover. Sedation is never the answer to slowing breaths.',
    objectiveIds: ['O5'],
    sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
  },
  transfer: {
    id: 'trouble-transfer',
    itemType: 'management-decision',
    transferVariant:
      'From a lengthening breath-hold at the carina to a cough at the spout, with the lidocaine ledger in play.',
    retrievesFrom: ['sedation-and-numbing', 'entering-the-blowhole'],
    situation:
      'A 190 kg male, sedated with midazolam IM. The atomizer and catheter lidocaine are in, well under his maximum. On his second approach to the spout he coughs hard and the glottis clamps.',
    stem: 'Which order of first moves fits?',
    choices: [
      {
        id: 'a',
        label:
          'Stop, withdraw to the nasopharynx, give more topical lidocaine, then wait for regular breaths.',
        rationale:
          'The cough is the airway answering the tip. Backing off frees the glottis; lidocaine numbs the spout that coughed.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Give another top-up of midazolam and push on while he is quiet.',
        rationale:
          'He is calm between coughs; the airway is what reacts. Pushing against a clamping glottis risks laryngospasm.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Stop, withdraw, and top up the sedation before the next approach.',
        rationale:
          'Sedation calms the animal but does not numb the spout. It comes after more lidocaine, and only if he stays intolerant.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Hold at the spout and advance in the moment the glottis opens.',
        rationale:
          'That is the move at a closed glottis with a numb airway. A cough says the spout is not numb yet.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A cough at the spout is the airway, not the sedation. Withdraw, numb the spout again and wait for regular breaths. Count the extra lidocaine against the 4 mg/kg maximum. A midazolam top-up is kept for an animal still intolerant once the airway is numb.',
    objectiveIds: ['O5', 'O2'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    numberIds: ['lidocaine-max'],
  },
  practice: [
    {
      id: 'trouble-case-slowing',
      sectionId: 'trouble-during-the-procedure',
      presentationTitle: 'Slowing breaths after the top-ups',
      troubleRowId: 'over-sedation',
      situation:
        'Twenty minutes in, the dolphin has had her first midazolam dose and two top-ups. Her breaths are coming further apart, and she barely responds to the trainer’s hand on her melon.',
      item: {
        id: 'trouble-oversedation',
        itemType: 'management-decision',
        stem: 'What is your next move?',
        choices: [
          {
            id: 'a',
            label: 'No further top-ups; withdraw, support breathing, and have flumazenil ready.',
            rationale:
              'Breaths further apart and a poor response after repeated top-ups point to over-sedation. Stop adding, clear the glottis, support breathing, then reverse.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Give another top-up so she lies still for the rest of the survey.',
            rationale:
              'She is still because she is over-sedated. Another dose spaces the breaths further.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give flumazenil and carry on with the survey.',
            rationale:
              'Reversal may be needed, but the scope still sits across the glottis. Withdraw and support breathing first; the survey waits.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Move her to deep water so she can breathe freely.',
            rationale:
              'Deep water is the last place for a dolphin whose breathing is slow. She stays out of it until breathing is regular.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'After repeated top-ups, breaths further apart and a poor response mean over-sedation. Give no further top-ups, withdraw, support breathing, then flumazenil per the NMMP protocol. Ivančić reversed midazolam with 0.003–0.012 mg/kg IV or IM after CT.',
        objectiveIds: ['O5'],
        sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
        numberIds: ['flumazenil'],
      },
    },
    {
      id: 'trouble-case-little-back',
      sectionId: 'trouble-during-the-procedure',
      presentationTitle: 'Little comes back from the first aliquot',
      troubleRowId: 'poor-return',
      situation:
        'Lavage of a branch of the right main bronchus. You instil the first aliquot of warm saline. Gentle hand suction brings back only a few milliliters, and you can see lumen around the scope tip.',
      item: {
        id: 'trouble-poor-return',
        itemType: 'management-decision',
        stem: 'What is your first move?',
        choices: [
          {
            id: 'a',
            label: 'Re-seat the scope so it is wedged, then try gentle hand suction again.',
            rationale:
              'Lumen around the tip means the scope is not wedged, so the saline has somewhere else to go. Wedged, the branch returns what it can.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Instil extra aliquots until the return matches what went in.',
            rationale:
              'A modest return is expected. Unplanned aliquots add to the fluid left in the lung and do not fix the leak around the tip.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Turn up to strong wall suction to pull the fluid out.',
            rationale:
              'Strong suction pulls the airway wall onto the tip and returns less. The workshop uses hand suction or gentle wall suction.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Record what went in and what came back, and move on.',
            rationale:
              'Recording belongs in the sequence, but the scope is not wedged yet. Re-seat it and recover the saline first.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Little return with lumen visible around the tip means the wedge has been lost. Re-seat the wedge and use gentle hand suction. Add no unplanned aliquots, and record what was instilled and what returned.',
        objectiveIds: ['O5', 'O4'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-form-2019'],
      },
    },
    {
      id: 'trouble-case-resistance',
      sectionId: 'trouble-during-the-procedure',
      presentationTitle: 'Resistance at the spout',
      troubleRowId: 'closed-glottis',
      situation:
        'The cough has settled after more lidocaine. At the spout tip you feel resistance. No lumen shows ahead, and the dolphin strains.',
      item: {
        id: 'trouble-closed-glottis',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label:
              'Hold at the spout and advance only in the moment the glottis opens with a breath.',
            rationale:
              'Resistance with no lumen is a closed glottis. It opens for a fraction of a second with each breath, and that moment is the way in.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on gently; the glottis will give.',
            rationale:
              'A closed glottis does not give safely. Pushing risks laryngospasm and injury to the spout.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give another top-up to relax the larynx.',
            rationale:
              'The cough has settled, so the airway is numb. Sedation will not open the glottis, and it spaces the breaths you are waiting for.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Withdraw to the nasopharynx and wait for regular breaths.',
            rationale:
              'That is the move for a cough or an animal that fights. Here the airway is numb and the glottis is closed: hold and time the advance.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Resistance and no lumen at the spout tip mean a closed glottis. Never push. Hold at the spout and advance only in the moment it opens, in stages. If the animal fights, withdraw instead.',
        objectiveIds: ['O5', 'O3'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'trouble-case-cloudy',
      sectionId: 'trouble-during-the-procedure',
      presentationTitle: 'A cloudy view deep in a branch',
      troubleRowId: 'secretions',
      situation:
        'Deep in a numbered branch of the left main bronchus, the scope is nearly as wide as the lumen. Thick secretions cloud the view.',
      item: {
        id: 'trouble-secretions',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Suction and small flushes; go no deeper than you can see.',
            rationale:
              'The scope fills the lumen, so secretions have nowhere to go but the lens. Clear them, and stop where the scope’s reach ends.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on a little further; the lumen will clear beyond the plug.',
            rationale:
              'Advancing blind in a lumen the scope already fills presses the tip into the wall.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Instil a large flush to clear it in one go.',
            rationale:
              'A large volume floods a branch the scope already blocks. Small flushes with suction clear the lens.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw fully and end the procedure.',
            rationale:
              'The branch can be cleared without ending the day. Suction and small flushes come first; back off to where you can see if they do not work.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Secretions with the scope nearly as wide as the lumen leave the lens nowhere clean. Suction, give small flushes, and stop at the scope’s reach. Never advance blind.',
        objectiveIds: ['O5'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
  ],
  firstMoves: [
    {
      id: 'first-moves-spout-cough',
      troubleRowId: 'spout-cough',
      heading: 'A cough at the spout',
      steps: [
        'Stop advancing.',
        'Withdraw to the nasopharynx.',
        'Give more topical lidocaine, by atomizer or through the scope, and count it in the ledger.',
        'Top up midazolam only if the animal is still intolerant.',
        'Wait for regular breaths before the next approach.',
      ],
      callForHelp:
        'Tell the attending veterinarian as you withdraw. Any sedation top-up is their call, per the NMMP protocol.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'first-moves-breath-hold',
      troubleRowId: 'breath-hold',
      heading: 'A long breath-hold',
      steps: [
        'Withdraw to the nasopharynx, or out.',
        'Let the animal breathe.',
        'Give oxygen.',
        'Stop the procedure if breathing does not recover.',
        'Albuterol per the NMMP protocol.',
      ],
      callForHelp:
        'Call the attending veterinarian at the first missed breath, while your hands withdraw the scope. Albuterol and any further drugs follow the NMMP protocol.',
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'first-moves-over-sedation',
      troubleRowId: 'over-sedation',
      heading: 'Breaths slowing after the top-ups',
      steps: [
        'Give no further top-ups.',
        'Withdraw the scope and support breathing.',
        'Flumazenil, per the NMMP protocol.',
        'Keep the animal out of deep water until breathing is regular.',
      ],
      callForHelp:
        'Call the attending veterinarian as soon as the breaths space out. Reversal is given on their order, per the NMMP protocol.',
      sourceIds: ['nmmp-workshop-2024', 'ivancic-2014'],
    },
    {
      id: 'first-moves-bleeding',
      troubleRowId: 'bleeding',
      heading: 'Blood after a brush or biopsy',
      steps: [
        'Keep the scope wedged in the bleeding branch.',
        'Suction.',
        'Instil cold saline.',
        'Wait.',
        'Stop sampling.',
        'Escalate per the NMMP protocol.',
      ],
      callForHelp:
        'Have a team member call the attending veterinarian while you hold the wedge. Escalation, including topical drugs, follows the NMMP protocol.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'first-moves-lost',
      troubleRowId: 'lost-orientation',
      heading: 'Lost among the branches',
      steps: [
        'Stop advancing.',
        'Withdraw to the carina or the main bronchus.',
        'Find the tracheal bronchus again: cranial, on the right.',
        'Count the branches again from the carina.',
      ],
      callForHelp:
        'If the count still does not fit, ask a second bronchoscopist or the attending veterinarian to read the screen before you advance again.',
      sourceIds: ['nmmp-workshop-2024', 'nmmp-bronchoscopy-guide'],
    },
  ],
  precommitDenyPatterns: [
    /\bwithdraw to the nasopharynx\b/i,
    /\blet (the animal|it|her|him) breathe\b/i,
    /\bwithdraw first\b/i,
  ],
  sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'ivancic-2014', 'nmmp-bronchoscopy-guide'],
}
