import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const theRoomAndTheTeam: DolphinSectionDefinition = {
  ...dolphinSectionMeta('the-room-and-the-team'),
  clinicalQuestion:
    'The dolphin is out of the water and on the mat. Who does what, and who needs protecting from what leaves the blowhole?',
  newConcept: 'One role per person, and the head end is a zoonotic exposure.',
  incrementSentence:
    'This section adds one idea to the last: the plan becomes a room, with one job for each person and protection at the head.',
  harmfulReflex:
    'The person at the scope also watching the breathing, or anyone at the head end without a mask and eye protection.',
  harmfulReflexPatterns: [/\balso watch(es|ing)?\b/i, /\bgloves only\b/i, /\bmask is enough\b/i],
  anchor: {
    analogy:
      'Think of a pit crew. Each person owns one job, nobody changing a tire is also watching the fuel, and everyone near the car wears the gear.',
    precise:
      'Each person holds one role: the scope, the breathing and heart, the drugs, the record, the holding. Everyone near the head wears gloves, a mask and eye protection.',
    checklistLabel: 'Before the scope goes in',
    checklist: [
      'Sternal, padded, wet and cool.',
      'One named person on the breaths and the ECG.',
      'Masks and goggles on everyone at the head.',
      'Emergency drugs and oxygen at the table.',
    ],
  },
  recognizeInstruction:
    'Look at the lit blowhole on the passage map in the Simulator panel, then read the two blocks in the Teaching panel. Nothing is asked yet.',
  blocks: [
    {
      id: 'out-of-the-water',
      kind: 'question',
      role: 'framing',
      heading: 'Out of the water',
      body: 'Tsang hoisted each animal in a sling onto a thick mattress on a raised platform, laid it sternal, and set trainers around it to keep it still. Towels wrapped about the rostrum steadied the head. The NMMP workshop asks for a padded table or padding on the ground, sternal recumbency, and an animal kept wet and cool throughout.',
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'what-leaves-the-blowhole',
      kind: 'signals',
      role: 'signals',
      heading: 'What leaves the blowhole',
      body: 'During Tsang’s procedures, anesthetic and lavage fluid were exhaled through the blowhole regularly. His program had met dolphins infected with Burkholderia pseudomallei, which may be zoonotic.',
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'one-role-each',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'One role for each person',
      body: 'Give each job to one named person. One drives the scope and watches the screen. One watches the breaths, their quality, the ECG and the depth of sedation. One draws up, gives and logs every drug, including each milliliter of lidocaine. One writes the record. The trainers hold the animal steady and keep it wet and cool.\n\nThe person at the scope is looking at the screen. If they also count breaths, a lengthening breath-hold goes unseen.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'procedure-record',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The procedure record',
      body: 'The NMMP procedure record holds the drugs and the monitoring. Each drug gets a line: its dosage in mg/kg, the dose in mg, the way it was given, the time given and the time of effect. Every 5 min the sheet takes the respiratory rate, the heart rate and the rectal temperature. It closes with the time out of the water, the time back in and the total.\n\nThe heart rate is written three ways: tachy, mean and brady. Haulena and Schmitt describe why it varies. The dolphin heart slows in the dive and speeds with each breath, a marked sinus arrhythmia seen under sedation as a split rate.',
      numberIds: ['procedure-record'],
      sourceIds: ['nmmp-annual-training', 'haulena-2018'],
    },
    {
      id: 'protection-at-the-head',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Protection at the head end',
      body: 'The NMMP workshop puts masks and protective goggles on the whole bronchoscopy team and on any staff or trainers near the head. The bronchoscopy team wears sterile gloves; everyone else wears nonsterile gloves. Tsang’s team wore protective clothing, masks and spectacles against zoonoses such as Burkholderia.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'ready-at-the-table',
      kind: 'after-commitment',
      role: 'first-moves',
      heading: 'Ready before the scope goes in',
      body: 'Set out the emergency drugs, furosemide and albuterol, with oxygen, per the NMMP protocol. Albuterol opens the airways; furosemide treats pulmonary edema. Place an IV catheter, or a needle with a line, so a drug can go in at once. Lay out the large syringes for lavage, the smaller ones for lidocaine, an ice saline bath and the specimen containers.\n\nPlug the light source and the video equipment only into power with a ground-fault interrupter. Mains equipment near salt water, or in wet weather, carries a risk of electrocution.',
      sourceIds: ['nmmp-workshop-2024', 'dover-2001'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these leaves a job or a person uncovered.',
      points: [
        'The scope operator counting breaths as well.',
        'Trainers at the head without masks or goggles.',
        'Letting the skin dry while the team sets up.',
        'Fetching the emergency drugs after the breathing changes.',
        'Running the light source from an outlet with no ground-fault interrupter.',
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'dover-2001'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['blowhole'],
    caption:
      'The passage from the blowhole to the numbered branches. Lit: the blowhole, where the scope goes in and each breath comes out.',
  },
  act: {
    kind: 'sort',
    sort: {
      id: 'who-does-what',
      prompt: 'Sort each task to the one person who holds it.',
      origins: [
        {
          id: 'scope',
          label: 'At the scope',
          definition: 'Drives the scope and watches the screen.',
        },
        {
          id: 'breaths',
          label: 'Breathing and heart',
          definition: 'Watches the breaths, the ECG and the depth of sedation.',
        },
        {
          id: 'drugs',
          label: 'Drugs and lidocaine',
          definition: 'Draws up, gives and logs every drug.',
        },
        {
          id: 'holders',
          label: 'Trainers holding the animal',
          definition: 'Keep it still, sternal, wet and cool.',
        },
      ],
      rows: [
        {
          id: 'late-breath',
          statement: 'Calls out when a breath is late.',
          origin: 'breaths',
          rationale:
            'The person at the scope is watching the screen. A lengthening breath-hold needs its own watcher.',
        },
        {
          id: 'ecg',
          statement: 'Watches the ECG and how deeply the animal is sedated.',
          origin: 'breaths',
          rationale:
            'The NMMP monitoring list puts the ECG, the breaths and the sedation level together.',
        },
        {
          id: 'ledger',
          statement: 'Keeps the running total of lidocaine against the maximum.',
          origin: 'drugs',
          rationale: 'One person counting means every syringe is added once and none is missed.',
        },
        {
          id: 'top-up',
          statement: 'Draws up and gives a midazolam top-up when it is called for.',
          origin: 'drugs',
          rationale:
            'The operator’s hands stay on the scope. The drug person gives the dose and logs it.',
        },
        {
          id: 'wet-skin',
          statement: 'Pours water over the skin through the procedure.',
          origin: 'holders',
          rationale:
            'The animal is kept wet and cool at all times, and the trainers are beside it.',
        },
        {
          id: 'rostrum',
          statement: 'Steadies the head with towels about the rostrum.',
          origin: 'holders',
          rationale:
            'Tsang’s team steadied the head this way, which keeps the blowhole still for the scope.',
        },
        {
          id: 'advance',
          statement: 'Advances only as the glottis opens.',
          origin: 'scope',
          rationale:
            'Timing the advance to the breath takes the operator’s full attention on the screen.',
        },
        {
          id: 'suction',
          statement: 'Suctions mucus to keep the view clear.',
          origin: 'scope',
          rationale:
            'The suction button is on the scope’s control section, under the operator’s hand.',
        },
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
  },
  prediction: {
    id: 'room-predict',
    itemType: 'management-decision',
    situation:
      'The team is short today: you at the scope, one person for the drugs, and trainers holding the animal. No one else is free.',
    stem: 'Who watches the breathing?',
    choices: [
      {
        id: 'a',
        label: 'One trainer, taken off holding, given the breaths and the ECG and nothing else.',
        rationale:
          'Breathing needs someone whose eyes stay on the animal. A trainer who knows it can call a late breath at once.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'You do; the scope operator also watches the breathing between views.',
        rationale:
          'Your eyes are on the screen while you drive. A breath-hold that lengthens then goes unseen.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'No one; the ECG will warn of trouble.',
        rationale:
          'The earliest sign is a breath that does not come when due. Someone has to be counting.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'The person giving the drugs, between doses.',
        rationale:
          'Better than no one, but drawing up and logging lidocaine takes their eyes off the blowhole.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'One role per person. The breaths need a watcher with nothing else to do, because a lengthening breath-hold is the earliest sign of trouble. Take that person from the holders, not from the scope or the drugs.',
    objectiveIds: ['O2'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  transfer: {
    id: 'room-transfer',
    itemType: 'management-decision',
    transferVariant: 'From who watches the breathing to who is protected at the head.',
    retrievesFrom: ['before-the-day'],
    situation:
      'The workup history notes that this dolphin’s blow grew Burkholderia pseudomallei last month. The plan is a lavage of the right main bronchus. A new trainer will steady the head.',
    stem: 'What does that trainer wear?',
    choices: [
      {
        id: 'a',
        label:
          'A mask, protective goggles and gloves, as everyone at the head does at every bronchoscopy.',
        rationale:
          'The NMMP protocol puts masks and goggles on everyone near the head at every bronchoscopy. The culture shows why, not when.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Gloves only; the trainer is not on the bronchoscopy team.',
        rationale:
          'Masks and goggles cover everyone near the head, not only the bronchoscopy team. Fluid is exhaled at the blowhole.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Nothing extra; the organism stays in the lavage syringe.',
        rationale:
          'Tsang saw anesthetic and lavage fluid exhaled through the blowhole regularly. The head end is where it comes out.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'A mask, and stand back from the blowhole.',
        rationale:
          'Distance helps, but someone has to hold the head, and exhaled fluid reaches the eyes too.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The head end is an exposure at every bronchoscopy, not only when a culture names a zoonotic organism. The history makes the risk concrete; the protection is the same: mask, goggles and gloves for anyone near the head.',
    objectiveIds: ['O2'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  practice: [
    {
      id: 'room-p-drying',
      sectionId: 'the-room-and-the-team',
      presentationTitle: 'Drying skin while the team sets up',
      situation:
        'Twenty minutes into setting up, the dolphin lies on the mat in sun and wind. Its skin is drying while the team waits for the scope.',
      item: {
        id: 'room-p-drying-item',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Wet and shade it now, and give one trainer that job throughout.',
            rationale:
              'The protocol keeps the animal wet and cool at all times. One named trainer makes sure it stays that way.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Cover it with a dry towel against the sun.',
            rationale: 'A dry towel neither wets nor cools the skin.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Hurry the scope in so the animal can go back sooner.',
            rationale:
              'Rushing the spout trades one risk for another. The skin needs water now, whatever the pace.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Splash it once the scope is ready.',
            rationale:
              'Once is not throughout. The protocol keeps the animal wet and cool at all times.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Keeping the animal wet and cool is a standing job, not a step. Give it to one trainer for the whole procedure.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
    {
      id: 'room-p-drugs-away',
      sectionId: 'the-room-and-the-team',
      presentationTitle: 'Emergency drugs left in the clinic',
      situation:
        'The animal is sedated and the scope is ready. Someone asks where the albuterol and oxygen are; they are still in the clinic building.',
      troubleRowId: 'breath-hold',
      item: {
        id: 'room-p-drugs-away-item',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Hold the scope until the emergency drugs and oxygen are at the table.',
            rationale:
              'The first moves for a lengthening breath-hold include oxygen and albuterol. They have to be within reach before anything starts.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Go ahead; they can be fetched if the breathing changes.',
            rationale:
              'When breathing changes, the first moves come at once. Furosemide, albuterol and oxygen sit ready, per the NMMP protocol.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Go ahead with oxygen only, and send for the rest.',
            rationale:
              'Oxygen is one of three. Albuterol opens the airways and furosemide treats pulmonary edema; oxygen alone answers neither.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Give albuterol now, before starting, as a precaution.',
            rationale:
              'The protocol lists albuterol as an emergency drug, kept ready rather than given in advance.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Emergency drugs are part of the room, laid out before the scope goes in. Furosemide, albuterol and oxygen sit at the table, per the NMMP protocol.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
    {
      id: 'room-p-goggles',
      sectionId: 'the-room-and-the-team',
      presentationTitle: 'A trainer at the head without eye protection',
      situation:
        'A trainer steadying the rostrum has a mask on but no eye protection. The scope is about to enter the blowhole.',
      item: {
        id: 'room-p-goggles-item',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Pause and get goggles on the trainer before the scope goes in.',
            rationale:
              'Anyone near the head wears a mask and goggles. Fluid leaves the blowhole with the breaths.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Carry on; a mask is enough for someone off the bronchoscopy team.',
            rationale:
              'The NMMP protocol puts goggles on any staff or trainers near the head, not only on the bronchoscopy team.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give the trainer sterile gloves instead.',
            rationale:
              'Sterile gloves are for the bronchoscopy team’s hands. They do nothing for the eyes.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Ask the trainer to turn away when the blowhole opens.',
            rationale:
              'Turning away helps, but the blowhole opens with every breath and the trainer has to watch the animal.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'The head end is an exposure for everyone near it. A mask without eye protection leaves the eyes open to what the blowhole exhales.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
    {
      id: 'room-p-rolling',
      sectionId: 'the-room-and-the-team',
      presentationTitle: 'An animal rolling on the mat',
      situation:
        'The dolphin is lifted onto the mat and starts to roll onto its side as the trainers settle around it.',
      item: {
        id: 'room-p-rolling-item',
        itemType: 'management-decision',
        stem: 'How should it lie for the procedure?',
        choices: [
          {
            id: 'a',
            label: 'Sternal, on padding, steadied by the trainers, with towels about the rostrum.',
            rationale:
              'Both accounts place the animal sternal, on a mattress or padding. The views you will read are built on that position.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'On its side, which is easier for the trainers to hold.',
            rationale:
              'Both accounts lay the animal sternal. On its side the blowhole and the views turn with it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'On its back, so the chest is easy to watch.',
            rationale: 'That turns the blowhole down against the mat.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Sternal, on the bare platform to keep it cool.',
            rationale:
              'Sternal holds, but the NMMP protocol pads the table or the ground. Keep it cool with water instead.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Sternal recumbency on padding, steadied by the trainers, with the head held by towels about the rostrum. That is how both accounts position the animal.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
  ],
  precommitDenyPatterns: [/\bnothing else\b/i, /\btaken off holding\b/i, /\bits own watcher\b/i],
  sourceIds: [
    'nmmp-workshop-2024',
    'nmmp-annual-training',
    'tsang-2002',
    'haulena-2018',
    'dover-2001',
  ],
}
