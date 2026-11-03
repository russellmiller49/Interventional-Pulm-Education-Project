import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const brushAndBiopsy: DolphinSectionDefinition = {
  ...dolphinSectionMeta('brush-and-biopsy'),
  clinicalQuestion:
    'The lavage is done, and the wall of a main bronchus looks inflamed. Do you brush it, biopsy it, or stop?',
  newConcept:
    'Each step from lavage to brush to biopsy disturbs more of the wall, and how a dolphin airway bleeds after sampling has never been measured.',
  incrementSentence:
    'This section adds one idea to the last: after the lavage, every further sample is weighed against a bleeding risk no one has measured.',
  harmfulReflex: 'Taking a biopsy as routine, or pulling the scope out when bleeding starts.',
  harmfulReflexPatterns: [
    /\bas routine\b/i,
    /\broutine(ly)? biops/i,
    /\bbiopsy every\b/i,
    /\b(withdraw|pull) the scope (out|back)\b/i,
    /\bremove the scope\b/i,
  ],
  anchor: {
    analogy:
      'Each sample past the lavage is a step onto ice no one has measured. Go only as far as the question needs, and know your way back.',
    precise:
      'Lavage, brush and biopsy disturb more of the wall in that order, and dolphin bleeding risk is unmeasured. Sample only as far as the question needs; if blood fills the lumen, stay wedged.',
    checklistLabel: 'Before you step up',
    checklist: [
      'Does the question need more than the lavage?',
      'Brush a visible lesion; biopsy only with a stated reason.',
      'Bleeding: stay wedged, suction, cold saline, wait.',
      'Once blood appears, sampling stops.',
    ],
  },
  recognizeInstruction:
    'Read the clinical question in the Steps panel, then the two facts in the Teaching panel. Nothing is asked yet.',
  blocks: [
    {
      id: 'three-ways',
      kind: 'question',
      role: 'framing',
      heading: 'Three ways to sample',
      body: 'Lavage washes the lung beyond a wedged branch. A brush scrapes cells and organisms from the wall it touches. A biopsy takes a piece of the wall with forceps. Each one disturbs more of the wall than the one before.',
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'the-workup',
      kind: 'signals',
      role: 'signals',
      heading: 'What the workup gives you',
      body: 'The NMMP pre-procedure workup includes a CBC and chemistry, with clotting times as an option, and thoracic imaging. The workshop lists bleeding as a complication of both brush and biopsy.',
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'what-tsang-did',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'What has been done in dolphins',
      body: 'Tsang brushed the main bronchi with double-sheath sterile brushes. He took no bronchial biopsies, because the bleeding tendency of cetaceans for the procedure was unknown. The workshop’s bleeding guidance comes from human practice, with no dolphin data.\n\nSo a biopsy is an exception with a stated reason: a visible lesion in the lumen or the mucosa that lavage and a brush have not answered.',
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
    {
      id: 'when-it-bleeds',
      kind: 'after-commitment',
      role: 'first-moves',
      heading: 'When blood fills the lumen',
      body: 'Keep the scope where it is, wedged in the bleeding branch. The wedge tamponades the site and keeps blood out of the rest of the airway. Suction, instil cold saline, and wait. Sampling stops. Escalate per the NMMP protocol.\n\nPulling the scope out removes the tamponade. Blood then runs into the trachea and the other lung, and you lose the view of where it comes from.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each one takes on bleeding risk the question did not need, or loses control of it.',
      points: [
        'A biopsy as routine after every lavage.',
        'Withdrawing the scope when blood appears.',
        'Sampling again after bleeding has started.',
        'Brushing beyond what you can see, out toward the lung edge.',
      ],
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
  ],
  firstMoves: [
    {
      id: 'bleeding',
      troubleRowId: 'bleeding',
      heading: 'Blood fills the lumen',
      steps: [
        'Keep the scope wedged.',
        'Suction.',
        'Cold saline.',
        'Wait.',
        'Stop sampling.',
        'Escalate per the NMMP protocol.',
      ],
      callForHelp:
        'Call the attending veterinarian as soon as blood fills the lumen; do not wait to see whether it stops.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['main-bronchi'],
    caption:
      'The passage, with the main bronchi and their numbered branches lit: where a brush or biopsy is taken.',
  },
  act: {
    kind: 'scenario',
    scenario: {
      id: 'plaque-then-blood',
      title: 'A plaque after the lavage, then blood',
      frames: [
        {
          id: 'after-lavage',
          time: 'After the lavage',
          situation:
            'The lavage of RB4 is in two labeled tubes. Just inside RB4 the wall is red, with a raised pale plaque on it. The animal breathes regularly.',
          prompt: 'What do you sample next?',
          choices: [
            {
              id: 'a',
              label: 'Brush the plaque with a double-sheath brush under direct view.',
              rationale:
                'A visible lesion is what a brush is for, and the sheath keeps the sample from the upper airway.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Biopsy it as routine; a plaque always needs tissue.',
              rationale:
                'How a dolphin airway bleeds after biopsy has not been measured. A brush samples the plaque at a lower step.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Lavage over the plaque again to wash cells off it.',
              rationale:
                'Lavage samples the lung beyond a wedged branch, not a plaque on the wall.',
              plausibility: 'incorrect-mechanism',
            },
            {
              id: 'd',
              label: 'Photograph it and sample nothing more.',
              rationale:
                'The image belongs on the record, but a brush adds what is on the plaque at a small step in risk.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
        {
          id: 'blood',
          time: 'As the brush comes back',
          situation:
            'As you draw the brush back into its sheath, blood wells from the plaque and fills the lumen of RB4. The view turns red.',
          prompt: 'What is your first move?',
          troubleRowId: 'bleeding',
          choices: [
            {
              id: 'a',
              label: 'Keep the scope wedged in RB4 and suction.',
              rationale:
                'Staying put tamponades the site and keeps blood out of the rest of the airway. Suction keeps the view.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Pull the scope out so the blood can drain through the blowhole.',
              rationale:
                'Out of the branch, the scope no longer tamponades it, and blood spills into the trachea and the other lung.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Brush again quickly to finish the sample before it clots.',
              rationale: 'More sampling feeds the bleeding. Sampling stops once blood appears.',
              plausibility: 'incorrect-mechanism',
            },
            {
              id: 'd',
              label: 'Instil cold saline and watch.',
              rationale:
                'Cold saline comes in the sequence, once the scope is held wedged and suction is running.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
        {
          id: 'settling',
          time: 'A minute later',
          situation:
            'The scope is still wedged in RB4. Suction and cold saline have slowed the bleeding, and the return is turning pink. The breaths are regular.',
          prompt: 'What now?',
          troubleRowId: 'bleeding',
          choices: [
            {
              id: 'a',
              label:
                'Wait wedged, sample nothing more, and escalate per the NMMP protocol if it does not settle.',
              rationale:
                'Waiting lets the site clot under the wedge. Once blood has appeared, sampling is over for the procedure.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Pull the scope back to the trachea to look at the other lung.',
              rationale:
                'Leaving the branch before it has settled lets it bleed into the trachea again.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Biopsy the plaque now as routine, while it is still in view.',
              rationale: 'A site that has just bled is the last place to take more tissue.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label: 'Wait until it stops, then lavage again to wash the blood out.',
              rationale: 'Waiting is the step; a further lavage disturbs the clot and adds fluid.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
      ],
      sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
    },
  },
  prediction: {
    id: 'sample-predict',
    itemType: 'management-decision',
    situation:
      'The lavage of LB3 is done. The wall of the left main bronchus is red and swollen, with no mass. The question was which organism is growing in the left lung.',
    stem: 'What do you take next?',
    choices: [
      {
        id: 'a',
        label: 'A double-sheath brush of the inflamed wall, and no biopsy.',
        rationale:
          'A sheathed brush adds organisms from the wall at a small step in risk. A biopsy answers a question this case did not ask.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'A biopsy of the inflamed wall, as routine after every lavage.',
        rationale:
          'How a dolphin airway bleeds after biopsy has not been measured. Routine biopsy takes that risk without a reason.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'A biopsy instead of a brush; a brush bleeds just as much.',
        rationale:
          'A brush scrapes the surface; forceps take a piece of the wall. Bleeding risk rises from one to the other.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Nothing more; the lavage is enough.',
        rationale:
          'It may be, since the lavage answers the organism question. A sheathed brush of the inflamed wall adds a second sample at little added risk.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Lavage, brush and biopsy disturb more of the wall at each step, and bleeding after sampling has not been measured in dolphins. Tsang brushed the main bronchi with double-sheath brushes and took no biopsies for that reason. Step up only as far as the question needs.',
    objectiveIds: ['O4'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  transfer: {
    id: 'sample-transfer',
    itemType: 'management-decision',
    transferVariant: 'A mass that may need tissue, after a lavage that came back blood-tinged.',
    retrievesFrom: ['lavage'],
    situation:
      'In another dolphin a smooth mass narrows LB2. The lavage of LB2 came back pink-tinged. The workup asked whether this is infection or a tumor.',
    stem: 'What do you take today?',
    choices: [
      {
        id: 'a',
        label: 'A sheathed brush of the mass, no biopsy today, and a plan made with the team.',
        rationale:
          'The pink lavage says this wall already bleeds. A brush samples the mass at a lower step.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Biopsy the mass as routine; a mass always needs tissue.',
        rationale:
          'The wall has already bled into the lavage, and biopsy bleeding in dolphins is unmeasured.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'A further lavage of LB2 to wash cells off the mass.',
        rationale:
          'Lavage samples the lung beyond the branch. It adds fluid and more pink return, not cells from the mass.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'No further sampling at all; stop now.',
        rationale:
          'Stopping is safe, but a sheathed brush answers part of the question at a lower step.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A mass may in the end need tissue, but biopsy bleeding is unmeasured in dolphins, and this lavage has already come back pink. Brush it, record it, and plan any biopsy with the team and a stated reason.',
    objectiveIds: ['O4'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },
  practice: [
    {
      id: 'sample-case-which-brush',
      sectionId: 'brush-and-biopsy',
      presentationTitle: 'Two brushes on the tray',
      situation:
        'You plan to brush an inflamed main bronchus for culture. Two brushes are on the tray: a bare cytology brush and a double-sheath sterile brush.',
      item: {
        id: 'sample-p-which-brush',
        itemType: 'management-decision',
        stem: 'Which do you use?',
        choices: [
          {
            id: 'a',
            label: 'The double-sheath brush; its sheaths keep it clean on the way to the wall.',
            rationale:
              'The scope crossed the nasal passages and the spout. A sheathed brush meets only the wall it brushes.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The bare brush; it collects more cells for culture.',
            rationale:
              'It also collects whatever lines the channel on the way down. That is not what you want to culture.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Neither; the lavage already covers culture.',
            rationale:
              'Lavage covers the lung beyond; a brush covers the wall. A sheath keeps that sample its own.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Skip the brush and biopsy as routine for culture.',
            rationale:
              'A biopsy adds bleeding risk no one has measured in dolphins, for a culture a brush can take.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'Tsang brushed the main bronchi with double-sheath sterile brushes. The sheath protects the brush on its way down the channel, so what grows came from the wall you brushed.',
        objectiveIds: ['O4'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
    {
      id: 'sample-case-blood',
      sectionId: 'brush-and-biopsy',
      presentationTitle: 'Blood right after a brush',
      situation:
        'Right after you brush LB3, blood fills its lumen. A trainer calls out that the breaths are still regular.',
      troubleRowId: 'bleeding',
      item: {
        id: 'sample-p-blood',
        itemType: 'management-decision',
        stem: 'What do you do first with the scope?',
        choices: [
          {
            id: 'a',
            label: 'Keep it wedged in LB3 and suction.',
            rationale: 'The wedged scope is the tamponade, and suction keeps the view.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Pull the scope out to give the animal a clear airway.',
            rationale:
              'Out of the branch, the scope no longer tamponades it. Blood runs into the trachea and the other lung.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Advance past the blood to see where it comes from.',
            rationale: 'Advancing blind into blood loses both the view and the seal.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Instil cold saline right away.',
            rationale:
              'Cold saline is in the sequence, once the wedge is held and suction is running.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Keep the scope wedged, suction, cold saline, wait, stop sampling, and escalate per the NMMP protocol. The scope in the branch is what keeps the blood out of the rest of the airway.',
        objectiveIds: ['O4', 'O5'],
        sourceIds: ['nmmp-workshop-2024'],
      },
    },
    {
      id: 'sample-case-after-bleed',
      sectionId: 'brush-and-biopsy',
      presentationTitle: 'Another lesion after a bleed',
      situation:
        'Bleeding from a brushed branch settled with the scope wedged and cold saline. A second lesion at LB5 has not been sampled.',
      troubleRowId: 'bleeding',
      item: {
        id: 'sample-p-after-bleed',
        itemType: 'management-decision',
        stem: 'What about LB5?',
        choices: [
          {
            id: 'a',
            label: 'Record LB5 and leave its sampling for another day.',
            rationale:
              'Sampling stopped when blood appeared, and it stays stopped for this procedure.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Biopsy LB5 as routine now that the bleeding has stopped.',
            rationale:
              'This animal has just shown that its airway bleeds. A biopsy is the largest step up.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Brush LB5; brushes do not bleed, only biopsies.',
            rationale:
              'The brush just bled. Brushes and forceps both bleed; they differ in how much wall they disturb.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Wait a few minutes, then brush LB5 gently.',
            rationale:
              'The first site settled, but this animal has shown it bleeds. Sampling stops for the day.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Once blood has filled a lumen, sampling stops for the procedure. Record the lesion at LB5, with what it looked like, so it can be sampled on another day.',
        objectiveIds: ['O4'],
        sourceIds: ['nmmp-workshop-2024', 'nmmp-form-2019'],
      },
    },
    {
      id: 'sample-case-biopsy-reason',
      sectionId: 'brush-and-biopsy',
      presentationTitle: 'A lesion only tissue can name',
      situation:
        'A firm white mass narrows the right main bronchus. Brush and lavage earlier this year did not explain it, and the team suspects a tumor.',
      item: {
        id: 'sample-p-biopsy-reason',
        itemType: 'management-decision',
        stem: 'Is a biopsy justified today?',
        choices: [
          {
            id: 'a',
            label:
              'Yes, with a stated reason, the team briefed for bleeding and the first moves ready.',
            rationale:
              'A visible lesion that brush and lavage have not answered is the reason a biopsy needs.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Yes, and biopsy every abnormal site as routine while you are there.',
            rationale:
              'The reason covers this mass, not every site. Each extra biopsy adds unmeasured bleeding risk.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'No; biopsy is never done in dolphins.',
            rationale:
              'Tsang did not biopsy because the bleeding risk was unknown, not because it is ruled out.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Brush it again first.',
            rationale:
              'A brush has already not answered this. Another sample of the same kind adds risk without a new answer.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'Biopsy is an exception with a reason: a visible lesion that lavage and brush cannot answer. Because dolphin bleeding risk is unmeasured, take it with the bleeding first moves ready and the team briefed.',
        objectiveIds: ['O4'],
        sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
      },
    },
  ],
  precommitDenyPatterns: [
    /\bdouble-sheath\b/i,
    /\bno biopsy\b/i,
    /\bnot been measured\b/i,
    /\bbleeding tendency\b/i,
  ],
  sourceIds: ['tsang-2002', 'nmmp-workshop-2024', 'nmmp-form-2019'],
}
