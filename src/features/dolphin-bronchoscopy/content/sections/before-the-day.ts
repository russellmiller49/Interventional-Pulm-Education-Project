import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const beforeTheDay: DolphinSectionDefinition = {
  ...dolphinSectionMeta('before-the-day'),
  clinicalQuestion:
    'A dolphin has coughed for a week and its blow is cloudy. The keepers ask whether it can be scoped tomorrow. What must be settled before the scope goes in?',
  newConcept:
    'Bronchoscopy answers a question the workup has framed: the sites to see and sample, and what each result would change.',
  incrementSentence:
    'This section adds one idea to the first: a blow sample starts the workup, and the workup ends in a question for the scope.',
  harmfulReflex: 'Scoping to look and see, without a question the workup has framed.',
  harmfulReflexPatterns: [/\blook and see\b/i, /\bsee what (is there|turns up|we find)\b/i],
  anchor: {
    analogy:
      'A bronchoscopy is a trip with a shopping list. Without the list you walk every aisle and come home with whatever caught your eye.',
    precise:
      'The history, bloodwork and thoracic imaging locate the disease. The plan names the sites to see and sample, and what each result would change.',
    checklistLabel: 'Before you book the day',
    checklist: [
      'What question will the scope answer?',
      'Which branches does the imaging lead you to?',
      'Sedation or general anesthesia, and which scope?',
      'Is the fast set for the morning?',
    ],
  },
  recognizeInstruction:
    'Read the clinical question, then the two blocks in the Teaching panel. The passage map in the Simulator panel shows where a sample can come from. Nothing is asked yet.',
  blocks: [
    {
      id: 'tsangs-animals',
      kind: 'question',
      role: 'framing',
      heading: 'Why Tsang’s dolphins were scoped',
      body: 'Tsang’s dolphins came to bronchoscopy for recurrent pneumonia. They were listing, anorectic and showed malaise. Their blood showed a high sedimentation rate and leukocytosis, and radiographs or transthoracic ultrasound showed lung consolidation.',
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'what-the-workup-gathers',
      kind: 'signals',
      role: 'signals',
      heading: 'What the workup gathers',
      body: 'The NMMP workshop lists the work done before a bronchoscopy. Bloodwork: a CBC and chemistry, with clotting times when needed. Thoracic imaging: CT, radiographs or ultrasound. The animal’s sedation history. And a map of the lesion onto the airway.',
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'from-workup-to-question',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'From workup to question',
      body: 'The workup tells you where the disease is. The question tells the scope what to do there. Write it before the day: which numbered branches to see, which to lavage or brush, and what each result would change.\n\nTsang located the pneumonic lung by radiology and transthoracic ultrasound before each lavage. A scope sent to look around may spend its sedation and its time in the other lung.',
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'what-the-question-settles',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'What the question settles',
      body: 'Sedation or general anesthesia. The NMMP protocol scopes under midazolam with topical lidocaine. Tsang held heavy sedation and general anesthesia undesirable, because a dolphin should return to the water soon after. The NMMP checklist keeps an endotracheal tube adapter for cases done under general anesthesia.\n\nThe instrument. A site deep along a main bronchus needs a scope long enough to reach it.\n\nThe fast. Tsang fasted his dolphins 4–6 h. The NMMP protocol keeps food and water minimal, with a full fast ideal.',
      numberIds: ['fasting-tsang'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'what-ultrasound-misses',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What a clean lung ultrasound leaves open',
      body: 'Lung ultrasound sees only the peripheral lung. Lesions deep in aerated lung or behind the ribs are missed, even a few centimeters below the pleura. Smith and colleagues put it plainly: a normal lung ultrasound does not rule out pulmonary disease. Radiographs and CT find the deep lesion.',
      sourceIds: ['smith-2012'],
    },
    {
      id: 'when-to-go-carefully',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'When to go carefully',
      body: 'Bronchoscopy carries risk to the animal. Van Bonn and Dover advise caution in any dolphin with an obvious or suspected thoracic effusion, a pulmonary mass, a cardiovascular concern or doubtful ventilation. Name any of these in the plan, and weigh with the attending veterinarian whether the question is worth that risk.\n\nTime on land is part of the risk. In Smith’s NMMP series, animals with respiratory compromise sometimes turned tachypneic or dyspneic out of the water, most often with significant lung disease. Plan the time out of the water short, and the way back in ready.',
      sourceIds: ['van-bonn-2018', 'smith-2012'],
    },
    {
      id: 'scope-before-and-after',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'The scope, before and after',
      body: 'Van Bonn and Dover clean and disinfect the endoscope before and after every use. If it will go through the glottis, they sterilize it and work aseptically. The NMMP annual training prepares the scope in two steps: the standard cleaning protocol, then gas or liquid sterilization. Sterilize the scope and its accessories: the buttons, the suction tubing and the water bottle.\n\nA lavage culture is only as clean as the channel it came through.',
      sourceIds: ['van-bonn-2018', 'nmmp-annual-training'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each of these sends the scope in before the question is clear.',
      points: [
        'Booking the scope before imaging has located the disease.',
        'Reading a normal lung ultrasound as a clear lung.',
        'Planning to look first, then sample wherever something shows.',
        'Reaching for general anesthesia when sedation and topical lidocaine will do.',
        'Feeding on the morning of the procedure.',
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'smith-2012'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['blowhole', 'main-bronchi'],
    caption:
      'The passage from the blowhole to the numbered branches. Lit: where a blow sample comes from, and where the sites of a plan usually lie.',
  },
  act: {
    kind: 'sequence',
    sequence: {
      id: 'workup-to-the-day',
      prompt:
        'Put the workup and the plan in the order you do them, from the first history to the morning of the procedure.',
      steps: [
        {
          id: 'history',
          label: 'Take the history: the signs, the blow results and how past sedations went.',
          detail:
            'The question starts from what the animal shows. Its sedation history shapes the sedation plan.',
        },
        {
          id: 'blood-imaging',
          label:
            'Draw bloodwork and image the chest: CBC, chemistry, clotting times if needed; CT, radiographs or ultrasound.',
          detail:
            'Imaging locates the disease. Bloodwork shows how sick the animal is and whether clotting needs checking before any sampling.',
        },
        {
          id: 'question',
          label:
            'Map the lesion onto the airway and write the question: which branches, which samples.',
          detail:
            'Only now do you know where to go. The question names the sites and what each result would change.',
        },
        {
          id: 'means',
          label:
            'Choose sedation or general anesthesia, and a scope long enough for those branches.',
          detail:
            'Both follow from the sites. A deep site needs length; a prompt return to the water favors sedation.',
        },
        {
          id: 'fast',
          label: 'On the day, hold food: the fast before sedation.',
          detail:
            'Tsang fasted his dolphins 4–6 h. The NMMP protocol keeps food and water minimal, a full fast being ideal.',
        },
      ],
      rationale:
        'The order runs from the animal to the question, then from the question to the means. Every choice after the question depends on the sites it names.',
      criticalStepIds: ['question'],
      numberIds: ['fasting-tsang'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
  },
  prediction: {
    id: 'day-predict',
    itemType: 'management-decision',
    situation:
      'A dolphin has coughed for a week. Bloodwork shows leukocytosis, and CT shows consolidation in the caudal left lung. The keepers ask to book bronchoscopy.',
    stem: 'Before you book it, what do you write down?',
    choices: [
      {
        id: 'a',
        label: 'The question: which branches to see and sample, and what each result would change.',
        rationale:
          'The CT has located the disease. The question turns that into sites and samples, and sets what the scope must reach.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Nothing yet; scope it, then look and see where the disease is.',
        rationale:
          'The CT has already shown where. Scoping without a question spends sedation and time and may never reach the caudal left lung.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'A lavage of every numbered branch, so nothing is missed.',
        rationale:
          'Each lavage adds saline and time in a sedated animal. The CT has already named the caudal left lung.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'The antibiotic to start once the culture returns.',
        rationale:
          'Treatment follows, but it depends on what is sampled and where. That is the question to write first.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Bronchoscopy answers a question the workup has framed. Here the CT has found the disease, so the plan names the branches of the caudal left lung, the samples, and what each result would change. That plan then decides the scope and the sedation.',
    objectiveIds: ['O2'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  transfer: {
    id: 'day-transfer',
    itemType: 'management-decision',
    transferVariant: 'No imaging yet, and a blow culture in hand.',
    retrievesFrom: ['why-scope-a-dolphin'],
    situation:
      'A different dolphin is eating poorly. Its blow culture grows a heavy mixed growth. No imaging or bloodwork has been done, and the scope is free tomorrow.',
    stem: 'What is your next step?',
    choices: [
      {
        id: 'a',
        label: 'Image the chest and draw bloodwork first, then frame the question.',
        rationale:
          'The blow speaks for the path out. Imaging locates any lower-airway disease, and only then can you name sites.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Scope tomorrow, and look and see what the airway shows.',
        rationale:
          'Without imaging you do not know which side or branch to reach, or which scope reaches it.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Treat on the blow culture and skip the workup.',
        rationale:
          'The blow may have grown anything it met on the way out. It cannot name the lung pathogen.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Repeat the blow sample to confirm the growth.',
        rationale: 'A second blow samples the same path. It cannot locate disease in the lung.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A blow culture can start a workup but cannot end it. Bloodwork and thoracic imaging locate the disease; then the question names the sites, and only then is the scope booked.',
    objectiveIds: ['O2'],
    sourceIds: ['nmmp-workshop-2024', 'venn-watson-2012'],
  },
  practice: [
    {
      id: 'day-p-fed',
      sectionId: 'before-the-day',
      presentationTitle: 'A full feed on the morning',
      situation:
        'On the morning of the procedure a trainer mentions the dolphin had its usual full feed an hour ago. Sedation is due in thirty minutes.',
      item: {
        id: 'day-p-fed-item',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Postpone until the fast is met; Tsang held food 4–6 h.',
            rationale:
              'Both protocols fast the animal before sedation. A full feed an hour ago meets neither.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Go ahead; the airway is separate from the mouth, so the stomach does not matter.',
            rationale:
              'The airway is separate, but both protocols still fast the animal before sedation.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Go ahead with a lighter sedation dose.',
            rationale:
              'The fast and the sedation are separate parts of the plan. A lighter dose does not make up for the feed.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Go ahead and shorten the survey.',
            rationale:
              'A shorter survey does not change the feed, and it may leave the question unanswered.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The fast is part of the plan, set before the day. Tsang held food 4–6 h, and the NMMP protocol keeps food and water minimal. When the fast has not been met, move the procedure.',
        objectiveIds: ['O2'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
        numberIds: ['fasting-tsang'],
      },
    },
    {
      id: 'day-p-no-site',
      sectionId: 'before-the-day',
      presentationTitle: 'A plan without a site',
      situation:
        'CT shows consolidation in the right lung beside the tracheal bronchus. The plan on the board reads only “bronchoscopy with lavage”.',
      item: {
        id: 'day-p-no-site-item',
        itemType: 'management-decision',
        stem: 'What does the plan still need?',
        choices: [
          {
            id: 'a',
            label:
              'The site: lavage from the right tracheal bronchus, and what its result would change.',
            rationale:
              'The CT has located the disease. Naming the site sets the scope, the time and the sample.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Nothing; look and see on the day, then decide where to wash.',
            rationale:
              'The CT already shows where. Deciding at the blowhole spends sedation and time searching.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'A lavage of both main bronchi, as a standard.',
            rationale:
              'Neither main bronchus is where the CT shows disease. A standard site is not the question’s site.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'The sedation drugs and their doses.',
            rationale:
              'Needed, but they follow the site. The site decides the reach and the time under sedation.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'A plan names its site and what the result would change. Here the CT puts the disease beside the right tracheal bronchus, so that is where the lavage goes.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
    {
      id: 'day-p-anesthesia',
      sectionId: 'before-the-day',
      presentationTitle: 'A proposal for general anesthesia',
      situation:
        'The plan is a single lavage from the left main bronchus. A colleague proposes general anesthesia to keep the dolphin still.',
      item: {
        id: 'day-p-anesthesia-item',
        itemType: 'management-decision',
        stem: 'What do you plan?',
        choices: [
          {
            id: 'a',
            label:
              'Sedation with topical lidocaine, so the dolphin can return to the water soon after.',
            rationale:
              'Tsang held general anesthesia undesirable here, because a dolphin should go back to the water soon after. A single lavage needs no more than sedation and a numb airway.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'General anesthesia; a secured airway is always the safer choice.',
            rationale:
              'Tsang held general anesthesia undesirable, because a dolphin should return to the water soon after the procedure.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'General anesthesia, since the checklist includes an endotracheal tube adapter.',
            rationale:
              'The adapter serves the cases that need general anesthesia. The question here does not ask for one.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'No sedation at all; topical lidocaine is enough.',
            rationale:
              'Tsang found that dolphins tolerated the procedure poorly without some sedation.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The question here is small: one lavage. Sedation with a numb airway answers it, and lets the dolphin return to the water soon after, which Tsang counted against general anesthesia.',
        objectiveIds: ['O2'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'day-p-platelets',
      sectionId: 'before-the-day',
      presentationTitle: 'A low platelet count before a brush',
      situation:
        'The plan names a lavage and a brush of the left main bronchus. Bloodwork the day before shows a low platelet count.',
      troubleRowId: 'bleeding',
      item: {
        id: 'day-p-platelets-item',
        itemType: 'management-decision',
        stem: 'What do you change?',
        choices: [
          {
            id: 'a',
            label: 'Keep the lavage, drop the brush, and look into the count before any brushing.',
            rationale:
              'The workshop lists bleeding among the complications of brushing, and a low platelet count among the bleeding risks.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Nothing; a brush does not bleed.',
            rationale:
              'Bleeding is a listed complication of brushing, and a low platelet count raises the risk.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Add a biopsy, since the scope will be there anyway.',
            rationale:
              'That adds a sample that bleeds to an animal already at risk. Tsang took no biopsies, because the bleeding tendency of cetaceans was unknown.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Postpone the whole procedure.',
            rationale:
              'Possible, but lavage alone may still answer the question without the brush’s bleeding risk.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Bloodwork is in the workup so that it can change the plan. A low platelet count raises the bleeding risk of brushing; a lavage may still answer the question while the count is explained.',
        objectiveIds: ['O2'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
  ],
  precommitDenyPatterns: [
    /\bwhat (each|its) result would change\b/i,
    /\bwhich branches to (see|sample)\b/i,
    /\bwrite (down )?the question\b/i,
    /\bthe question:/i,
  ],
  sourceIds: [
    'nmmp-workshop-2024',
    'nmmp-annual-training',
    'tsang-2002',
    'venn-watson-2012',
    'van-bonn-2018',
    'smith-2012',
  ],
}
