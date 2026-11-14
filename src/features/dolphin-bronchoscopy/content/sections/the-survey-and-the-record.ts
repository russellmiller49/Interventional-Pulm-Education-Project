import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const theSurveyAndTheRecord: DolphinSectionDefinition = {
  ...dolphinSectionMeta('the-survey-and-the-record'),
  clinicalQuestion:
    'The scope is in the upper trachea of a sedated dolphin. In what order do you look, and what goes on the record for each site?',
  newConcept:
    'Survey in one fixed order, and write every site on the form down, including the ones the scope did not reach.',
  incrementSentence:
    'This section adds one idea to the last: once below the spout, the survey follows one order every time, and the record accounts for every site.',
  harmfulReflex: 'Writing “normal” for a site that was not seen.',
  harmfulReflexPatterns: [/\bas normal\b/i, /\bnormal,? (since|because)\b/i],
  anchor: {
    analogy:
      'A pilot’s walk-around: the same order every time, and a line on the sheet for every item, including the one that could not be checked.',
    precise:
      'Trachea, tracheal bronchus, the right then the left main bronchus with their numbered branches, then back to the carina. Every site gets a line; one never entered reads not reached.',
    checklistLabel: 'Survey and record',
    checklist: [
      'Trachea, then the right tracheal bronchus.',
      'Right main bronchus and its branches, then the left.',
      'Back to the carina before you withdraw.',
      'Every site gets a line; unseen means not reached.',
    ],
  },
  recognizeInstruction:
    'The scope is in the upper trachea. Look at the Simulator panel: the view, the 3D tree beside it and the place name under it.',
  blocks: [
    {
      id: 'one-order',
      kind: 'question',
      role: 'framing',
      heading: 'Below the larynx, a short procedure',
      body: 'Once the scope is in the trachea, there is a lot to see: the trachea, the right tracheal bronchus, both main bronchi and their numbered branches. Tsang’s procedures lasted 10–20 min. A cough or a lengthening breath-hold can end one sooner.',
      numberIds: ['procedure-duration'],
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'the-form',
      kind: 'signals',
      role: 'normal-reference',
      heading: 'The record',
      body: 'The NMMP bronchoscopy form is a drawing of the airway, after Harper’s harbor porpoise, labeled from the trachea to RB1–RB9 and LB1–LB9. Around it run free-text lines under six headings: the trachea, the right tracheal bronchus, the right and left main bronchi, and the right and left lung. Three blanks take the lavage fluid volume yield. The form has no field for drugs; they go on the procedure record.',
      sourceIds: ['nmmp-form-2019', 'nmmp-annual-training'],
    },
    {
      id: 'the-order',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The order, and why it is fixed',
      body: 'Start in the trachea and look along its complete rings. Enter the right tracheal bronchus, which leaves the right wall above the carina. At the carina, take the right main bronchus first and count its branches from the carina as far as the scope reaches. Return to the carina and do the same on the left. Finish at the carina before you withdraw.\n\nA fixed order means no site is skipped, and a lost scope always has a place to return to.',
      sourceIds: ['nmmp-form-2019', 'nmmp-bronchoscopy-guide', 'nmmp-workshop-2024'],
    },
    {
      id: 'not-reached',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Not reached is a finding',
      body: 'A scope reaches as far as its length and the lumen allow. Tsang’s 55 cm bronchoscope reached the origins of 3–4 subsegmental branches, 3–4 cm past the carina. Secretions or a narrow branch can stop a scope sooner.\n\nWrite each site the scope never entered as not reached, with the reason. A “normal” there records an observation nobody made. The next veterinarian, and every comparison over time, depends on the difference.',
      numberIds: ['scope-reach-tsang'],
      sourceIds: ['tsang-2002', 'nmmp-form-2019'],
    },
    {
      id: 'lavage-on-the-form',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'Free text, and the lavage blanks',
      body: 'The site lines are free text, with no boxes to prompt you. Write on each line whether the scope reached the site, how it looked, its secretions and any sample.\n\nThe three yield blanks sit under the right tracheal bronchus, the right lung and the left lung. Each takes the volume returned; the form has no field for the volume instilled. On that region’s lines, write the instilled volume and the branch, so the yield can be read against what went in.',
      sourceIds: ['nmmp-form-2019'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each one makes the record say more, or less, than the survey saw.',
      points: [
        'Writing normal for a branch that was never in view.',
        'Leaving a row blank, so no one can tell unseen from forgotten.',
        'Naming a branch by its direction instead of its number from the carina.',
        'Logging the lavage return with no note of what was instilled.',
      ],
      sourceIds: ['nmmp-form-2019', 'nmmp-mapping-2026'],
    },
  ],
  workspace: {
    kind: 'scope',
    start: 'trachea-mid',
    labels: 'shown',
    showLocation: true,
    tree: true,
    caption:
      'The CT dolphin’s airway, scope in the upper trachea, with the 3D tree beside the view.',
  },
  act: {
    kind: 'report',
    prompt:
      'Drive the survey in order, then write the record. Sites you entered start as reached. A site the scope never entered can only be written as not reached.',
    templateId: 'nmmp-2019',
    fromSurvey: true,
    surveyGoals: [
      {
        kind: 'reach-in-order',
        abbrs: ['TRA', 'RTB', 'RMB', 'LMB'],
        label: 'Trachea, tracheal bronchus, then the right and the left main bronchus',
      },
      {
        kind: 'reach-in-order',
        abbrs: ['RMB', 'RB1', 'LMB', 'LB1'],
        label: 'The first numbered branch on each side, right before left',
      },
      { kind: 'reach-in-order', abbrs: ['LMB', 'TRA'], label: 'Back to the carina to finish' },
    ],
  },
  prediction: {
    id: 'survey-predict',
    itemType: 'management-decision',
    situation:
      'Secretions stopped the scope in both main bronchi. You saw RB1–RB4 and LB1–LB3; the other numbered branches were never in view. Everything you did see looked healthy.',
    stem: 'How do you fill in the other numbered branches on the NMMP form?',
    choices: [
      {
        id: 'a',
        label: 'Not reached, with the reason: secretions stopped the scope.',
        rationale:
          'The record then says what was seen and what was not, and a later scope knows where to look first.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Write them as normal; everything you did see was healthy.',
        rationale:
          'Disease can sit in a branch you never saw. A “normal” there is a finding nobody made.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Copy them from this animal’s last bronchoscopy record.',
        rationale:
          'That record describes another day. Airways change with disease, and this survey did not see them.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Leave those rows blank.',
        rationale:
          'Blank does not claim a finding, but a reader cannot tell it from a row someone forgot.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A site the scope did not enter is written not reached, with the reason. “Normal” claims an observation. The next veterinarian, and any comparison over time, depends on the difference.',
    objectiveIds: ['O3'],
    sourceIds: ['nmmp-form-2019', 'tsang-2002'],
  },
  transfer: {
    id: 'survey-transfer',
    itemType: 'management-decision',
    transferVariant: 'The animal’s breathing, not secretions, cuts the survey short.',
    retrievesFrom: ['entering-the-blowhole'],
    situation:
      'Crossing the spout took many breaths. Now, in the left main bronchus, the breaths come further apart. You have seen the trachea, the tracheal bronchus, the right side to RB3, and LB1.',
    stem: 'What do you do, and what will the record say?',
    choices: [
      {
        id: 'a',
        label: 'Withdraw now, and write the unseen left branches as not reached, with the reason.',
        rationale:
          'Breaths further apart call for withdrawal first. The record then shows exactly where the survey stopped.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Withdraw now, and write the left side as normal, since the right looked healthy.',
        rationale:
          'The right side says nothing about the left. A “normal” there is a finding nobody made.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Finish the left side quickly first; the survey order comes before the breathing.',
        rationale:
          'The order keeps the survey complete, but the breathing outranks it. Breaths further apart mean withdraw.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Withdraw now, and leave the left branches blank for the next scope.',
        rationale: 'Withdrawing comes first, but a blank row cannot be told from a forgotten one.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Breaths further apart are the earliest sign of a lengthening breath-hold: withdraw and let the animal breathe. The survey stops where it stopped, and the record says so: not reached, with the reason.',
    objectiveIds: ['O3'],
    sourceIds: ['nmmp-workshop-2024', 'nmmp-form-2019'],
  },
  practice: [
    {
      id: 'survey-case-lost-count',
      sectionId: 'the-survey-and-the-record',
      presentationTitle: 'Counting branches after a cough',
      situation:
        'In the right main bronchus a cough jolts the scope. An opening lies ahead, but you no longer know whether it is RB3 or RB4.',
      troubleRowId: 'lost-orientation',
      item: {
        id: 'survey-p-lost-count',
        itemType: 'management-decision',
        stem: 'What do you do before recording anything?',
        choices: [
          {
            id: 'a',
            label:
              'Withdraw to the carina, find the tracheal bronchus above it on the right, and count again.',
            rationale:
              'The carina and the tracheal bronchus are places you can be sure of. Counting from there restores the numbers.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Name it by its direction; a lateral branch here is RB4.',
            rationale:
              'Direction varies between animals. The number counts order from the carina, so count again.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Back up one opening and count on from there.',
            rationale:
              'That may work, but you are not sure where you are. The carina is the place you can be sure of.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Write RB3 and RB4 both as normal and move to the left side.',
            rationale:
              'You do not know which branch you saw. A record that guesses is not a record.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'When what you expect does not match the picture, withdraw to the carina, find the tracheal bronchus again, and count from the carina. Then record what you saw under the number you are sure of.',
        objectiveIds: ['O3', 'O1'],
        sourceIds: ['nmmp-workshop-2024', 'nmmp-bronchoscopy-guide'],
      },
    },
    {
      id: 'survey-case-pus',
      sectionId: 'the-survey-and-the-record',
      presentationTitle: 'Pus at a branch you cannot enter',
      situation:
        'Thick pus pours from the opening of LB2. The scope is nearly as wide as the lumen, and the view turns cloudy as you try to go in.',
      troubleRowId: 'secretions',
      item: {
        id: 'survey-p-pus',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Suction, try small flushes, and go no further than you can see.',
            rationale:
              'Suction and small flushes may clear the view. Where they do not, the scope stops there.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Advance into the cloud; the branch opens out beyond the pus.',
            rationale: 'You cannot see the wall or the lumen. Never advance blind.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Note copious pus at LB2 and move straight on to LB3.',
            rationale:
              'Recording it matters, but suction may show the wall, and the pus marks a site worth sampling.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Withdraw to the trachea and end the survey.',
            rationale:
              'The animal is stable and the view is the problem. Suction comes first, and the rest of the left side is still to see.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Secretions blocking the view call for suction and small flushes, and the scope stops where it can no longer see. Record the pus at LB2; any branch beyond it you could not enter is not reached.',
        objectiveIds: ['O3'],
        sourceIds: ['nmmp-workshop-2024', 'nmmp-form-2019'],
      },
    },
    {
      id: 'survey-case-missing-rtb',
      sectionId: 'the-survey-and-the-record',
      presentationTitle: 'At the carina without the tracheal bronchus',
      situation:
        'Below the larynx you advance down the trachea and reach the carina without having seen an opening in the tracheal wall.',
      item: {
        id: 'survey-p-missing-rtb',
        itemType: 'management-decision',
        stem: 'What do you do next?',
        choices: [
          {
            id: 'a',
            label:
              'Pull back up the trachea and look along its right wall, about 5 cm above the carina.',
            rationale:
              'The right tracheal bronchus leaves the right wall about 5 cm above the carina. It is easy to slide past.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Record the tracheal bronchus as absent in this animal.',
            rationale:
              'It left the right wall of the trachea above the carina in all ten dolphins mapped. Look again first.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Write it as normal and go on to the main bronchi.',
            rationale: 'You have not seen it. A “normal” there is a finding nobody made.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Go on to the main bronchi and look for it on the way out.',
            rationale:
              'You may find it then, but the order puts it before the carina, and the procedure may end early.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'The right tracheal bronchus leaves the right wall of the trachea about 5 cm above the carina, in every dolphin mapped. Pull back and look along the right wall before going on.',
        objectiveIds: ['O3', 'O1'],
        numberIds: ['rtb-above-carina'],
        sourceIds: ['tsang-2002', 'ivancic-2014', 'nmmp-mapping-2026'],
      },
    },
    {
      id: 'survey-case-lavage-record',
      sectionId: 'the-survey-and-the-record',
      presentationTitle: 'Writing down the lavage',
      situation:
        'After the survey you lavaged a branch of the right main bronchus with two 50 mL aliquots of warm saline. In all, 24 mL came back.',
      item: {
        id: 'survey-p-lavage-record',
        itemType: 'management-decision',
        stem: 'What goes on the NMMP form for this lavage?',
        choices: [
          {
            id: 'a',
            label:
              'The return in the right-lung yield blank, with the instilled volume and the branch on those lines.',
            rationale:
              'The right lung’s blank holds the return. The instilled volume and the branch give it meaning.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The volume instilled; the form asks what went in.',
            rationale:
              'The blanks are for the fluid volume yield: what came back. The form has no field for what went in.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Only the volume returned, in the right-lung blank, as the form asks.',
            rationale:
              'That fills the blank, but a return means little without what was instilled. Write both.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Nothing; the lavage belongs on the laboratory request, not the record.',
            rationale:
              'The form has three yield blanks: under the right tracheal bronchus and under each lung.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The NMMP form has three lavage yield blanks, under the right tracheal bronchus, the right lung and the left lung. A branch of the right main bronchus goes under the right lung. Write the instilled volume and the branch beside the return, so whoever reads the record can judge it.',
        objectiveIds: ['O3', 'O4'],
        sourceIds: ['nmmp-form-2019'],
      },
    },
  ],
  precommitDenyPatterns: [/\bwith the reason\b/i, /\bnot reached,? with\b/i],
  sourceIds: [
    'nmmp-form-2019',
    'nmmp-workshop-2024',
    'nmmp-annual-training',
    'nmmp-bronchoscopy-guide',
    'nmmp-mapping-2026',
    'tsang-2002',
    'ivancic-2014',
  ],
}
