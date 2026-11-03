import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const lavage: DolphinSectionDefinition = {
  ...dolphinSectionMeta('lavage'),
  clinicalQuestion:
    'Imaging puts the pneumonia in one lung, and the survey has found the branch. How do you lavage it, and what do you do with what comes back?',
  newConcept:
    'Lavage is planned by body weight before it starts and given in aliquots into a wedged branch; a modest return is recorded, never chased.',
  incrementSentence:
    'This section adds one idea to the last: the survey chose the branch, and the lavage samples it with a volume fixed before you begin.',
  harmfulReflex: 'Adding unplanned aliquots when little fluid comes back.',
  harmfulReflexPatterns: [
    /\b(another|extra|more|a third) aliquots?\b/i,
    /\bkeep instilling\b/i,
    /\buntil (more|enough) (comes|returns)\b/i,
  ],
  anchor: {
    analogy:
      'Rinsing a sponge you cannot squeeze: measure what you pour in, take what drains back, and know that pouring more will not bring the first rinse out.',
    precise:
      'Wedge the scope in the chosen branch, instil saline in aliquots up to a total planned by weight, suction gently, and record what went in and what came back.',
    checklistLabel: 'Before and during lavage',
    checklist: [
      'The branch chosen from imaging and the survey, the scope wedged.',
      'The total planned by weight, in aliquots.',
      'Gentle hand suction; no unplanned aliquots.',
      'Label it, keep it cool, record instilled and returned.',
    ],
  },
  recognizeInstruction:
    'Read the clinical question, then look at the view in the Simulator panel: the right main bronchus just past the carina.',
  blocks: [
    {
      id: 'choose-the-branch',
      kind: 'question',
      role: 'framing',
      heading: 'Choose the branch first',
      body: 'Tsang chose his lavage site from radiographs and transthoracic ultrasound that showed which lung was consolidated. The survey then shows which branch carries the secretions. A lavage samples that branch and the lung beyond it.',
      sourceIds: ['tsang-2002'],
    },
    {
      id: 'two-volumes',
      kind: 'signals',
      role: 'signals',
      heading: 'Two sources, two volumes',
      body: 'The NMMP gives 2 mL/kg as the most saline that can be given safely for lavage; its annual-training checklist sets it as the maximum saline dose. Tsang instilled 2 × 50 mL of warm saline, with gentle suction, in two dolphins. Neither source says how much you should expect back.',
      numberIds: ['bal-volume-nmmp', 'bal-volume-tsang'],
      sourceIds: ['nmmp-annual-training', 'nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'the-steps',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The lavage, step by step',
      body: 'Wedge the scope tip in the chosen branch, so the channel opens into that lumen alone, without overwedging. Instil one aliquot of sterile saline through the channel. Draw it back by gentle hand suction into a syringe until nothing more comes. Give the next planned aliquot the same way, and stop at the planned total.\n\nTsang gave his second aliquot only once suction brought nothing more from the first.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'volume-and-return',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'Volume, temperature and the return',
      body: 'The sources differ. The NMMP’s 2 mL/kg is a ceiling set by weight; Tsang gave 2 × 50 mL in two dolphins. Tsang used warm sterile saline; the workshop slides say room temperature.\n\nNo source gives an expected return. Van Bonn and Dover know of no controlled study, standardized method or expected values for lavage in marine mammals, and clinical lavage results have varied widely. So the return is recorded, not chased. Saline that does not come back stays in the lung, and lavage can lower oxygenation.',
      numberIds: ['bal-volume-nmmp', 'bal-volume-tsang'],
      sourceIds: ['nmmp-annual-training', 'nmmp-workshop-2024', 'tsang-2002', 'van-bonn-2018'],
    },
    {
      id: 'the-sample',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The sample',
      body: 'Label each syringe or tube with the branch and the aliquot. Keep the sample cool and get it to the laboratory. The workshop’s supply list has the containers ready: cryovials, conical tubes and culture swabs. Record the volume instilled and the volume returned.\n\nLavage is the sample for culture and sensitivity. Nollens and colleagues add that PCR on lavage fluid can confirm Mycobacterium or Nocardia, so ask for it when either is in the question.',
      sourceIds: ['nmmp-workshop-2024', 'nmmp-form-2019', 'nollens-2018'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each one adds risk without adding sample.',
      points: [
        'Adding aliquots beyond the plan because little came back.',
        'Strong suction that draws the airway wall onto the tip.',
        'Lavage with the tip loose in a wide bronchus, so saline spills back toward the trachea.',
        'Recording the return without what was instilled.',
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
  ],
  firstMoves: [
    {
      id: 'poor-return',
      troubleRowId: 'poor-return',
      heading: 'When little comes back',
      steps: [
        'Confirm the scope is wedged.',
        'Gentle hand suction.',
        'No unplanned extra aliquots.',
        'Record what was instilled and what returned.',
      ],
      callForHelp:
        'Call the attending veterinarian if the breathing changes during or after the lavage.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-form-2019'],
    },
  ],
  workspace: {
    kind: 'frame',
    frameId: 'rmb-origin',
    caption:
      'The right main bronchus just past the carina, where a lavage of the right lung begins.',
  },
  act: {
    kind: 'sequence',
    sequence: {
      id: 'lavage-steps',
      prompt: 'Put the lavage steps in the order you would make them.',
      steps: [
        {
          id: 'wedge',
          label: 'Wedge the scope tip in the branch chosen from imaging and the survey.',
          detail:
            'A sealed branch keeps the saline where the disease is and lets it drain back to the scope.',
        },
        {
          id: 'instil',
          label: 'Instil one aliquot of sterile saline through the channel.',
          detail:
            'One aliquot at a time lets you stop at any point. Tsang used warm saline; the workshop says room temperature.',
        },
        {
          id: 'suction',
          label: 'Draw the fluid back by gentle hand suction until nothing more comes.',
          detail:
            'Gentle suction keeps the airway open around the tip. Tsang gave the next aliquot only once nothing more returned.',
        },
        {
          id: 'repeat',
          label: 'Give the next planned aliquot the same way, and stop at the planned total.',
          detail:
            'The total is set before you start, within 2 mL/kg. A poor return does not raise it.',
        },
        {
          id: 'label-cool',
          label: 'Label the sample with its branch and keep it cool.',
          detail:
            'A sample has to name the branch it came from, and it stays cool until the laboratory has it.',
        },
        {
          id: 'record',
          label: 'Record the volume instilled and the volume returned.',
          detail:
            'The NMMP form records the return; write what went in beside it, so the yield can be read.',
        },
      ],
      rationale:
        'Wedge first, so the saline goes where the disease is. Each aliquot is instilled and drawn back before the next. The total is fixed by weight before you begin, and the record holds both volumes.',
      criticalStepIds: ['wedge', 'repeat'],
      numberIds: ['bal-volume-nmmp', 'bal-volume-tsang'],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-form-2019'],
    },
  },
  prediction: {
    id: 'lavage-predict',
    itemType: 'management-decision',
    situation:
      'The scope is wedged in a branch of the right main bronchus. You have instilled the first of two planned aliquots of warm saline. Gentle hand suction brings back a little cloudy fluid, far less than went in, then nothing more.',
    stem: 'What do you do next?',
    choices: [
      {
        id: 'a',
        label: 'Confirm the wedge, then give only the second planned aliquot.',
        rationale:
          'Saline leaks back past a loose wedge. The plan already holds the second aliquot, and nothing beyond it.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Keep instilling aliquots until more comes back.',
        rationale:
          'Saline that does not come back stays in the lung, and lavage can lower oxygenation. More fluid adds to both.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Increase the suction to pull the fluid back out.',
        rationale:
          'Both sources use gentle suction. Strong suction draws the airway wall onto the tip and can stop the return.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Stop the lavage and send what came back.',
        rationale:
          'What came back is a sample, but the plan had a second aliquot. Check the seal and give it.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Far less back than went in calls for the poor-return moves: confirm the wedge, suction gently, give no unplanned aliquots, and record both volumes. Tsang gave his second aliquot only once suction brought nothing more from the first.',
    objectiveIds: ['O4'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  transfer: {
    id: 'lavage-transfer',
    itemType: 'management-decision',
    transferVariant: 'A small animal, where the two sources’ volumes no longer agree.',
    situation:
      'A 45 kg juvenile bottlenose dolphin has consolidation in the left lung on ultrasound. You plan lavage of a branch of the left main bronchus.',
    stem: 'How do you set the total volume?',
    choices: [
      {
        id: 'a',
        label: 'Set the total by weight, within 2 mL/kg, in smaller aliquots than Tsang used.',
        rationale:
          'At this weight, 2 mL/kg is less than Tsang’s total. Weight sets the ceiling; aliquots let you stop early.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Give two aliquots, then add more aliquots until the return looks adequate.',
        rationale:
          'A plan that grows with a poor return is no plan. What does not return stays in the lung.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Use Tsang’s 2 × 50 mL; it is the published dolphin volume.',
        rationale:
          'It is one published volume, from two dolphins. At this weight it is more than 2 mL/kg allows.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Halve Tsang’s volume to a single 50 mL aliquot.',
        rationale:
          'That lands under 2 mL/kg here, but by luck. Plan from the weight, so every animal is planned the same way.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The workshop’s 2 mL/kg is a ceiling set by weight. In a small animal it falls below Tsang’s 2 × 50 mL, so the weight decides. Plan the total and the aliquots first; a poor return does not change them.',
    objectiveIds: ['O4'],
    numberIds: ['bal-volume-nmmp', 'bal-volume-tsang'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },
  practice: [
    {
      id: 'lavage-case-spill',
      sectionId: 'lavage',
      presentationTitle: 'Saline welling up around the scope',
      situation:
        'During the first aliquot, saline wells up around the scope and runs back toward the carina. Suction returns very little.',
      troubleRowId: 'poor-return',
      item: {
        id: 'lavage-p-spill',
        itemType: 'management-decision',
        stem: 'What is your first move?',
        choices: [
          {
            id: 'a',
            label: 'Stop, re-wedge the tip so it seals the branch, then suction gently.',
            rationale:
              'Saline around the scope means the seal is lost. A wedged tip keeps the next aliquot in the branch.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Instil another aliquot to make up for what spilled.',
            rationale:
              'The seal is still loose, so it spills too. It adds fluid to the airway without adding sample.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Turn up the suction to catch the fluid as it spills.',
            rationale:
              'The fluid is escaping past the tip. Stronger suction draws the wall in; it does not bring the spill back.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Suction the spilled saline from the trachea and carry on.',
            rationale:
              'Clearing the trachea helps the animal breathe, but the loose wedge will spill the next aliquot too.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Saline around the scope means the wedge is not sealed. Re-wedge, suction gently and keep to the plan. Saline that spills back is lost to the sample and goes to the rest of the airway.',
        objectiveIds: ['O4'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
      },
    },
    {
      id: 'lavage-case-small-return',
      sectionId: 'lavage',
      presentationTitle: 'Little back after the planned aliquots',
      situation:
        'A 200 kg dolphin. You gave both planned 50 mL aliquots of warm saline into a wedged branch. In all, 18 mL of cloudy fluid came back.',
      troubleRowId: 'poor-return',
      item: {
        id: 'lavage-p-small-return',
        itemType: 'management-decision',
        stem: 'What now?',
        choices: [
          {
            id: 'a',
            label:
              'Stop, label and cool the sample, and record what was instilled and what returned.',
            rationale:
              'The plan is complete. No source gives an expected return in dolphins, so the return is recorded as it is.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Give a third aliquot to raise the return.',
            rationale:
              'What did not come back stays in the lung. A third aliquot adds to it without a plan.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Lavage the neighboring branch to make up the volume.',
            rationale:
              'The sample’s job is to show what is in the chosen branch. Another site samples another place and adds fluid.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Write the returned volume on the form and send the sample.',
            rationale:
              'The form asks for the return, but the instilled volume gives it meaning. Write both.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'No source gives an expected return in dolphins, so a small return is recorded, not chased. The lavage ends at its planned total. Label the sample, keep it cool, and write instilled and returned side by side.',
        objectiveIds: ['O4'],
        sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-form-2019'],
      },
    },
    {
      id: 'lavage-case-which-branch',
      sectionId: 'lavage',
      presentationTitle: 'Which branch to lavage',
      situation:
        'Ultrasound showed consolidation in the right lung. The survey found cloudy secretions coming from RB7; the other right branches looked clean.',
      item: {
        id: 'lavage-p-which-branch',
        itemType: 'management-decision',
        stem: 'Where do you wedge for the lavage?',
        choices: [
          {
            id: 'a',
            label: 'In RB7, the branch carrying the secretions.',
            rationale:
              'Imaging chose the lung and the survey chose the branch. The lavage samples where the disease is.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'In the right main bronchus, to sample the whole right lung.',
            rationale:
              'A main bronchus is too wide to seal. Saline would spill back rather than sample the lung beyond.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'In RB1, the first branch reached on the right.',
            rationale: 'It is easy to reach, but nothing suggests disease there.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'In RB7, then every right branch with extra aliquots.',
            rationale:
              'Each added site adds fluid beyond the plan. One chosen branch answers the question.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'Tsang chose his lavage site from radiographs and ultrasound of the consolidated lung. The survey narrows it to the branch carrying the secretions. Wedge there.',
        objectiveIds: ['O4'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'lavage-case-breaths',
      sectionId: 'lavage',
      presentationTitle: 'Breaths slowing during the lavage',
      situation:
        'Just after the second aliquot, the dolphin’s breaths come further apart and its response to touch dulls.',
      troubleRowId: 'breath-hold',
      item: {
        id: 'lavage-p-breaths',
        itemType: 'management-decision',
        stem: 'What is your first move?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw the scope to the nasopharynx or out, and let the animal breathe.',
            rationale:
              'Breaths further apart are the earliest sign of trouble at any step. The sample can wait.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Finish suctioning, then give another aliquot to complete the sample.',
            rationale: 'More saline in a lung that is already breathing less adds to the problem.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give a midazolam top-up; it is resisting the lavage.',
            rationale: 'It is breathing less, not resisting. More sedation deepens that.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Give oxygen and keep the scope wedged until the return is in.',
            rationale: 'Oxygen comes in the sequence, but the scope comes off the airway first.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Breaths further apart is the earliest sign. Withdraw, let the animal breathe, give oxygen, and stop if breathing does not recover. Lavage can lower oxygenation, so it does not resume on a guess.',
        objectiveIds: ['O4', 'O5'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
  ],
  precommitDenyPatterns: [/\bsecond planned aliquot\b/i, /\b(confirm|check) the wedge\b/i],
  sourceIds: [
    'nmmp-workshop-2024',
    'nmmp-annual-training',
    'tsang-2002',
    'nmmp-form-2019',
    'van-bonn-2018',
    'nollens-2018',
  ],
}
