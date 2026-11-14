import { dolphinSectionMeta } from '../sectionCatalog'
import type { DolphinSectionDefinition } from '../types'

export const beyondTheSurvey: DolphinSectionDefinition = {
  ...dolphinSectionMeta('beyond-the-survey'),
  clinicalQuestion:
    'A colleague asks whether you could dilate a narrowed bronchus while the scope is in. Which work belongs to a diagnostic survey, and which needs training of its own?',
  newConcept:
    'Therapeutic and image-guided bronchoscopy is done in dolphins by teams trained for it; recognize it, and leave it to them.',
  harmfulReflex: 'Attempting an advanced technique on the strength of a diagnostic training.',
  harmfulReflexPatterns: [/\byourself\b/i, /\bwhile the scope is in\b/i, /\bon the strength of\b/i],
  anchor: {
    analogy:
      'Reading a river map well does not make you a bridge builder. You can find the narrows and mark them; building across them is another trade.',
    precise:
      'Electrocautery, balloon dilation, stenosis repair and image-guided work have been done in dolphins by teams trained for each. The survey, lavage, a brush within view and the record are what you can plan.',
    checklistLabel: 'Is it the survey, or beyond it?',
    checklist: [
      'Does it cut, burn, dilate or repair the airway?',
      'Does a tool go past what the scope can see?',
      'Does it need fluoroscopy, contrast or 3D imaging during the procedure?',
      'Does it need general anesthesia? Any yes means its own training.',
    ],
  },
  recognizeInstruction:
    'Read the clinical question and the workshop’s list in the Teaching panel. The Simulator panel lights the airway a diagnostic survey covers.',
  blocks: [
    {
      id: 'interventional-work',
      kind: 'question',
      role: 'framing',
      heading: 'Interventional work has reached dolphins',
      body: 'Techniques from human interventional pulmonology have been carried into dolphin bronchoscopy. The NMMP workshop presented them as recent advances, from a dolphin case collaboration. Knowing they exist helps you recognize when a finding needs more than a survey.',
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'the-list',
      kind: 'signals',
      role: 'signals',
      heading: 'What the workshop listed',
      body: 'The workshop’s recent advances in dolphin interventional bronchoscopy:',
      points: [
        'Electrocautery.',
        'Repeated balloon dilation over a wire, and repair of stenosis at more than one level.',
        'Contrast bronchography and thoracic fluoroscopy.',
        '3D reconstruction imaging during the procedure.',
        'Virtual bronchoscopy.',
        'Bronchoscopy under general anesthesia, with a lower inspired oxygen fraction.',
      ],
      sourceIds: ['nmmp-workshop-2024'],
    },
    {
      id: 'why-own-training',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why each needs its own training',
      body: 'Each one changes the airway, or adds a second view to run beside the scope. Electrocautery and dilation alter the wall. Contrast, fluoroscopy and 3D imaging guide a tool past what the scope can see. General anesthesia brings an endotracheal tube and an anesthesia team. The NMMP annual training lists complications of invasive tools, such as forceps, needles and balloons, and fire among the risks of bronchoscopy.\n\nEach needs training, equipment and a team of its own. Recognize the finding, record it, and refer it.',
      sourceIds: ['nmmp-workshop-2024', 'nmmp-annual-training'],
    },
    {
      id: 'dolphin-cases',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'Dolphin cases in print',
      body: 'Van Bonn and Dover review three such cases. Needle aspiration through the channel, into nodules in the trachea, showed Aspergillus. A human pulmonology team dilated a stenosed right tracheal bronchus and right main bronchus with high-pressure balloons through a gastroscope. A Rhizopus mass from the distal trachea into the left bronchus was removed in part over three procedures, with a cryoprobe and argon plasma.\n\nReidarson’s case table adds two dolphins with tracheal Aspergillus fumigatus. One was diagnosed by transbronchial needle aspirate and PCR, the other by bronchoscopic biopsy with histopathology and culture.',
      sourceIds: ['van-bonn-2018', 'reidarson-2018'],
    },
    {
      id: 'what-the-survey-covers',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'What the survey covers',
      body: 'The diagnostic survey is done under sedation and topical lidocaine, with the animal sternal. It runs from the blowhole to the glottis, then the trachea, the tracheal bronchus, both main bronchi and the numbered branches, in a fixed order. Lavage of a named branch, a brush of a wall you can see, and the record complete it.\n\nThe simulator here is itself a virtual bronchoscopy. It was built from one dolphin’s CT to teach the map, not to plan a procedure in your patient.',
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'dolphin-001-ct'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors',
      body: 'Each treats access to the airway as permission to treat it.',
      points: [
        'Dilating or cauterizing because the scope is already in.',
        'Brushing toward a lesion beyond the view, without fluoroscopy.',
        'Reading the simulator’s CT as a plan for a particular animal.',
      ],
      sourceIds: ['nmmp-workshop-2024'],
    },
  ],
  workspace: {
    kind: 'passage',
    lit: ['trachea', 'tracheal-bronchus', 'carina', 'main-bronchi'],
    caption:
      'The passage, lit from the trachea to the numbered branches: the airway a diagnostic survey covers.',
  },
  act: {
    kind: 'sort',
    sort: {
      id: 'survey-or-advanced',
      prompt:
        'Sort each piece of work: part of the diagnostic survey you have learned, or advanced work that needs its own training.',
      origins: [
        {
          id: 'survey',
          label: 'A diagnostic survey you have learned here',
          definition:
            'Looking, lavage, brushing within view, and the record, under sedation and topical lidocaine.',
        },
        {
          id: 'advanced',
          label: 'Advanced work needing its own training',
          definition:
            'Work that changes the airway, sends a tool past the view, or needs imaging or anesthesia beyond the scope.',
        },
      ],
      rows: [
        {
          id: 'survey-order',
          statement:
            'Surveying the trachea, the tracheal bronchus and both main bronchi in a fixed order.',
          origin: 'survey',
          rationale:
            'Looking in a fixed order, under sedation and topical lidocaine, is the survey itself.',
        },
        {
          id: 'lavage-named',
          statement: 'Lavage of a named branch with warm saline, recording what comes back.',
          origin: 'survey',
          rationale:
            'Lavage of a branch you can wedge in is diagnostic sampling within the survey.',
        },
        {
          id: 'brush-in-view',
          statement: 'Brushing a reddened main bronchus wall that is in clear view.',
          origin: 'survey',
          rationale:
            'A brush of a wall you can see is within the survey. Tsang brushed the main bronchi this way.',
        },
        {
          id: 'not-reached',
          statement: 'Writing “not reached” for a branch the scope never entered.',
          origin: 'survey',
          rationale: 'An honest record is part of the survey, including what it did not reach.',
        },
        {
          id: 'brush-beyond',
          statement: 'Pushing a brush past the view toward a nodule near the pleura.',
          origin: 'advanced',
          rationale:
            'A tool beyond the view needs fluoroscopic guidance, and near the pleura it risks a pneumothorax.',
        },
        {
          id: 'balloon',
          statement: 'Repeated balloon dilation of a narrowed bronchus over a wire.',
          origin: 'advanced',
          rationale:
            'Dilation changes the airway wall. The workshop lists it among the advanced techniques.',
        },
        {
          id: 'cautery',
          statement: 'Electrocautery of tissue narrowing a main bronchus.',
          origin: 'advanced',
          rationale: 'Cautery removes tissue. It needs its own equipment, training and team.',
        },
        {
          id: 'general-anesthesia',
          statement: 'Bronchoscopy under general anesthesia, through an endotracheal tube adapter.',
          origin: 'advanced',
          rationale:
            'General anesthesia brings an airway tube and an anesthesia team. The workshop lists it with the advanced work.',
        },
        {
          id: 'contrast',
          statement: 'Contrast bronchography under thoracic fluoroscopy.',
          origin: 'advanced',
          rationale: 'Imaging run beside the scope is a second skill, with its own equipment.',
        },
      ],
      sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-form-2019'],
    },
  },
  prediction: {
    id: 'beyond-predict',
    itemType: 'management-decision',
    situation:
      'CT shows that a colleague’s dolphin has a narrowed left main bronchus. She asks whether you could dilate it during the diagnostic bronchoscopy you have planned.',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label:
          'Survey and sample as planned, record the narrowing, and refer the dilation to a team trained in it.',
        rationale:
          'The survey answers the diagnostic question and maps the narrowing. Dilation changes the airway and needs its own training, equipment and team.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Dilate it yourself while the scope is in; the steps look simple.',
        rationale:
          'Balloon dilation is listed with the advanced techniques. The steps look simple only from outside; doing them takes training of its own.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Cancel the bronchoscopy until a trained team can come.',
        rationale:
          'The diagnostic survey still answers her question, and its record helps whoever plans the dilation.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'd',
        label: 'Skip the narrowed side; it cannot be surveyed.',
        rationale: 'Survey it as far as the scope fits, and write down what was not reached.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The workshop lists balloon dilation, electrocautery and stenosis repair as advanced work. A diagnostic survey records the narrowing and samples as planned. The dilation goes to a team trained and equipped for it.',
    objectiveIds: ['O6'],
    sourceIds: ['nmmp-workshop-2024'],
  },
  transfer: {
    id: 'beyond-transfer',
    itemType: 'management-decision',
    transferVariant:
      'From a central narrowing to a peripheral nodule, where the advanced part is the imaging rather than the tool.',
    retrievesFrom: ['the-survey-and-the-record', 'brush-and-biopsy'],
    situation:
      'CT shows a nodule near the pleura, well beyond where the scope can see. A trainer asks whether you could push a brush out to it during tomorrow’s survey.',
    stem: 'What do you plan?',
    choices: [
      {
        id: 'a',
        label:
          'Lavage the branch leading toward it, brush only within view, and record the nodule for a team with fluoroscopy.',
        rationale:
          'Lavage reaches the territory without a tool past the view. A brush beyond the view needs fluoroscopic guidance, which belongs to advanced work.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Push the brush out to it yourself; the CT shows the way.',
        rationale:
          'Brushing out of view near the pleura risks a pneumothorax. The workshop guides peripheral brushing with fluoroscopy.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Brush it blind, then check the brush for blood.',
        rationale:
          'Blood on the brush comes too late. Out of view near the pleura, the risk is a pneumothorax, not only bleeding.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Leave the nodule alone and survey only the central airways.',
        rationale:
          'The survey and a lavage of the branch toward it are within reach and may answer the question.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'A tool past the scope’s view near the pleura needs fluoroscopic guidance, and the workshop names pneumothorax as the risk. Within a diagnostic survey, lavage the branch that leads toward the nodule and brush only what you can see.',
    objectiveIds: ['O6', 'O4'],
    sourceIds: ['nmmp-workshop-2024'],
  },
  practice: [],
  precommitDenyPatterns: [/\brefer\b/i, /\bteam trained in\b/i, /\bas planned\b/i],
  sourceIds: [
    'nmmp-workshop-2024',
    'nmmp-annual-training',
    'tsang-2002',
    'dolphin-001-ct',
    'van-bonn-2018',
    'reidarson-2018',
  ],
}
