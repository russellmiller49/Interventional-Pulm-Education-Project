import type { BronchSectionDefinition } from '../types'

/**
 * Findings and the report (rewrite, brief 10; absorbs `honest-report`). The fellow learns to
 * describe a finding by structure, mucosa and contents, to call a narrowing endoluminal,
 * extrinsic or mixed with an estimated percentage, and the lesion not to biopsy on the spot. They
 * name six findings from descriptions, read one annotated report, and then write the report for
 * one survey.
 *
 * Brief 10 asks for four images in contrast pairs. No abnormal image is in the repository yet, so
 * the findings are named from descriptions (`moreActs.findings`), in three contrast pairs. Replace
 * that activity with image questions when the abnormal images are cleared. Sources: the course
 * textbook's chapters on findings and on the report (S1) and the training manual's reporting
 * pages (S2).
 */
const FINDINGS = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 109 } },
] as const
const LESION = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 138, to: 143 } },
] as const
const REPORT = [
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
] as const

export const section: BronchSectionDefinition = {
  id: 'describe-findings',
  authoringContract: 2,
  title: 'Findings and the report',
  shortTitle: 'Findings',
  minutes: 10,
  activityMinutes: 4,
  moduleIds: ['M11', 'M17'],
  objectives: [
    {
      objectiveId: 'M11-O1',
      subtask: 'Names six findings from their description, in pairs that are easy to confuse.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O2',
      subtask: 'Writes a finding by site and appearance, and leaves the diagnosis to pathology.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O3',
      subtask: 'Decides what to do with a smooth red lesion that has vessels on its surface.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O4',
      subtask: 'Writes a size seen on the screen as an estimate, not as a measurement.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O5',
      subtask: 'Calls a narrowing endoluminal, extrinsic or mixed, with the share of lumen lost.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O1',
      subtask: 'Writes the report for one survey, line by line, from what the survey showed.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O2',
      subtask: 'Changes a line the template filled in for something the scope never saw.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O4',
      subtask: 'Names who reviews a pending result, and when.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O5',
      subtask: 'Rewrites a draft note for a procedure that was cut short.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D14', 'D18'],
  prerequisites: ['sedation-and-monitoring', 'right-side', 'left-side', 'systematic-survey'],

  clinicalQuestion: 'You see something you did not expect. What do you write, and what do you do?',
  objective:
    'Describe a finding in words another clinician can act on, and write a report that says only what you saw.',
  harmfulReflex: 'Taking a biopsy of a lesion because it is in view. Describe it and plan first.',
  harmfulReflexPatterns: [/\bbiops/i, /\bbrush the\b/i],
  anchor: {
    analogy:
      'A witness gives a statement, not a verdict. The statement says what was there, where it was and how big. The verdict is someone else’s, and it rests on the statement being exact.',
    precise:
      'Describe every finding by its site, its structure, its mucosa and its contents, and report only what you saw.',
    checklistLabel: 'Describing a finding',
    checklist: [
      'Where it is',
      'Structure: the wall and the lumen',
      'Mucosa, then contents',
      'What you did not see or did not do',
    ],
  },
  outcomes: [
    {
      id: 'describe-a-finding',
      text: 'Describe a finding by site, structure, mucosa and contents, without naming a diagnosis.',
    },
    {
      id: 'write-the-report',
      text: 'Write a report that says what was seen, what was not, what was done and who follows up.',
    },
  ],

  spineStops: ['main-bronchi'],
  grammarRowIds: [],
  precommitDenyPatterns: [/\bmay be very vascular\b/i, /\bbleeding you cannot control\b/i],
  localPolicyIds: [],
  reviewItemIds: ['R06', 'R18', 'R19', 'R20', 'R34'],

  blocks: [
    {
      id: 'three-headings',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Structure, mucosa, contents',
      body: 'Say where the finding is. Then describe it under three headings, in this order. Use words for what you see, and leave the diagnosis to pathology.',
      pointsLabel: 'The three headings',
      points: [
        'Structure: the wall and the lumen. Its shape, its length, how much lumen is left.',
        'Mucosa: the surface. Its color, vessels, swelling, ulcers or nodules.',
        'Contents: what lies in the lumen. Secretions, blood, clot or a foreign body.',
      ],
      claimClass: 'source',
      sourceRefs: FINDINGS,
    },
    {
      id: 'obstruction',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Where a narrowing comes from',
      body: 'Endoluminal: tissue inside the lumen. Extrinsic: the wall is pushed in from outside, and the mucosa over it is intact. Mixed: both.\n\nMake the call. Then say how much of the lumen is lost, as a percentage by eye, and write “estimated”.',
      claimClass: 'source',
      sourceRefs: FINDINGS,
      reviewItemIds: ['R18'],
    },
    {
      id: 'findings-list',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'Pairs that are easy to confuse',
      body: 'One feature tells each pair apart.',
      pointsLabel: 'The pairs',
      points: [
        'Secretions move with suction and breathing. Clot is dark and shiny, and keeps its shape.',
        'Edema is pale, swollen mucosa. Anthracosis is flat black pigment in the wall.',
        'Stenosis is fixed. Malacia moves: open on the breath in, closing on the breath out.',
        'A sharp main carina is normal. A wide, blunt one suggests enlarged nodes beneath it.',
      ],
      claimClass: 'source',
      sourceRefs: FINDINGS,
      reviewItemIds: ['R19'],
    },
    {
      id: 'vascular-lesion',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'The lesion you leave alone',
      body: 'A smooth, red or pulsating lesion with vessels on its surface can bleed heavily. Being in view is no reason to sample it.\n\nDescribe it and leave it untouched. Then plan: imaging, the right room, and bleeding control ready.',
      claimClass: 'source',
      sourceRefs: LESION,
      reviewItemIds: ['R20', 'R34'],
    },
    {
      id: 'model-report',
      kind: 'pattern',
      role: 'worked-example',
      heading: 'One report, with notes',
      body: 'The wording is a template, not a standard. Use your unit’s if it has one. Some lines carry a note.',
      pointsLabel: 'The report',
      points: [
        'Larynx: vocal cords normal, moving symmetrically. Write this only if you watched them move.',
        'Trachea and carina: normal caliber, sharp carina.',
        'Right lung: all segments seen. Left lung: all seen except LB10, not reachable. Name what you did not see.',
        'Finding: endoluminal lesion, medial wall, left main bronchus; a third of the lumen, estimated. Smooth, pale. No blood.',
        'Done: forceps biopsies of the lesion. Brief oozing, stopped with cold saline.',
        'After: no other complication. Histology pending, reviewed by the referring physician in clinic. Name who owns the result.',
      ],
      claimClass: 'source',
      sourceRefs: REPORT,
      reviewItemIds: ['R06'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Six errors to expect',
      body: 'Each one puts something on the page that you did not see.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Writing a diagnosis where a description belongs. Describe it. Pathology names it.',
        'Writing “abnormal” and nothing else. Say where, what and how much.',
        'Giving a size from the screen as a measurement. Write “estimated”.',
        'Calling collapse from one still. Watch through breathing and a cough.',
        'Signing a line the template filled in. Check it against what you saw.',
        'Writing “results to follow” with no name beside it. Say who reviews them, and when.',
      ],
      claimClass: 'source',
      sourceRefs: REPORT,
      reviewItemIds: ['R18', 'R19'],
    },
  ],

  workspace: {
    kind: 'map',
    lit: [
      'TR',
      'RMSB',
      'RUL',
      'RB1',
      'RB2',
      'RB3',
      'BI',
      'RML',
      'RB4',
      'RB5',
      'RLL',
      'RB6',
      'RB7',
      'RB8',
      'RB9',
      'LMSB',
      'LUL',
      'LUL-UD',
      'LB1+2',
      'LB3',
      'LB4+5',
      'LB4',
      'LB5',
      'LLL',
      'LB6',
      'LB7+8',
      'LB9',
      'LB10',
    ],
    caption: 'The survey this report is for. An airway is lit where it was seen.',
  },

  act: {
    kind: 'report',
    outcomeId: 'write-the-report',
    report: {
      id: 'report-for-one-survey',
      prompt:
        'A man with a cough and a right lower lobe opacity had a bronchoscopy under moderate sedation, through the mouth. You surveyed both lungs. For each line of the report, choose what the survey supports.',
      evidenceTitle: 'What the survey showed',
      fields: [
        {
          id: 'larynx',
          label: 'Larynx',
          evidence:
            'You passed the cords during a fit of coughing. They looked normal. You did not watch them move.',
          options: [
            {
              id: 'movement-not-assessed',
              label: 'Vocal cords normal in appearance; movement not assessed, because of coughing',
              supported: true,
              rationale: 'It says what you saw, and it names the part you did not check.',
            },
            {
              id: 'moving-symmetrically',
              label: 'Vocal cords normal, moving symmetrically',
              supported: false,
              rationale: 'You did not watch them move. That half of the line is a guess.',
            },
            {
              id: 'not-examined',
              label: 'Larynx not examined',
              supported: false,
              rationale: 'You did see the cords, and they looked normal. Do not throw that away.',
            },
          ],
        },
        {
          id: 'extent',
          label: 'How far the survey went',
          evidence:
            'You saw every segment of both lungs except RB10. Its opening was narrowed, and the scope would not pass without force.',
          options: [
            {
              id: 'all-but-one',
              label: 'All segments seen except RB10: opening narrowed, not reachable',
              supported: true,
              rationale: 'The reader knows what was looked at, what was not, and why.',
            },
            {
              id: 'subsegmental',
              label: 'Normal airways to the subsegmental level on both sides',
              supported: false,
              rationale: 'You went as far as the segments, and one of those you did not enter.',
            },
            {
              id: 'not-seen',
              label: 'All segments seen except RB10, not seen',
              supported: false,
              rationale: 'You saw its opening and know what stopped you. Not reachable says both.',
            },
          ],
        },
        {
          id: 'structure',
          label: 'The finding: structure',
          evidence:
            'In the right lower lobe bronchus, tissue grows from the lateral wall into the lumen. The wall around it keeps its shape. It fills about half the lumen by eye.',
          options: [
            {
              id: 'endoluminal-estimated',
              label:
                'Endoluminal lesion, lateral wall of the right lower lobe bronchus; about half the lumen lost, estimated',
              supported: true,
              rationale:
                'Tissue in the lumen with the wall in shape is endoluminal. The size is an estimate.',
            },
            {
              id: 'extrinsic',
              label:
                'Extrinsic compression of the right lower lobe bronchus; about half the lumen lost',
              supported: false,
              rationale:
                'Extrinsic means the wall is pushed in with intact mucosa over it. Here the tissue is inside the lumen.',
            },
            {
              id: 'measured',
              label: 'Lesion of the right lower lobe bronchus narrowing it by half, as measured',
              supported: false,
              rationale: 'Nothing was measured. A size read from the screen is an estimate.',
            },
          ],
        },
        {
          id: 'surface',
          label: 'The finding: mucosa and contents',
          evidence:
            'Its surface is smooth, with prominent vessels. There is no ulcer and no necrosis. No blood or secretions lie on it. You did not touch it.',
          options: [
            {
              id: 'described',
              label: 'Smooth surface with prominent vessels; no ulceration; no blood; not touched',
              supported: true,
              rationale: 'Surface, then contents, in words for what you saw.',
            },
            {
              id: 'carcinoid',
              label: 'Appearance typical of a carcinoid tumor',
              supported: false,
              rationale: 'That is a diagnosis. The report describes, and pathology names.',
            },
            {
              id: 'benign',
              label: 'Smooth, benign-appearing lesion',
              supported: false,
              rationale:
                'A smooth surface does not make a lesion benign. Describe the surface and stop.',
            },
          ],
        },
        {
          id: 'done',
          label: 'What was done',
          evidence:
            'A biopsy was planned. Because of the vessels on the lesion you did not take one. You washed the right lower lobe and sent the washing for cytology.',
          options: [
            {
              id: 'washing-only',
              label:
                'Lesion not sampled: vascular surface. Right lower lobe washing sent for cytology',
              supported: true,
              rationale: 'It records what you did, what you chose not to do, and the reason.',
            },
            {
              id: 'as-planned',
              label: 'Endobronchial biopsy of the lesion, as planned',
              supported: false,
              rationale: 'That was the plan and not the procedure. Write what happened.',
            },
            {
              id: 'as-requested',
              label: 'Specimens obtained and sent as requested',
              supported: false,
              rationale:
                'It names no specimen and no site, and hides that the lesion was left alone.',
            },
          ],
        },
        {
          id: 'after',
          label: 'Events and follow-up',
          evidence:
            'His oxygen saturation fell briefly with the coughing at the cords and recovered with oxygen. The cytology takes several days. The referring pulmonologist has a clinic visit booked.',
          options: [
            {
              id: 'event-and-owner',
              label:
                'Brief desaturation at the larynx, resolved with oxygen. Cytology pending: referring pulmonologist, at the booked visit',
              supported: true,
              rationale: 'An event that resolved is still an event. The result has a named owner.',
            },
            {
              id: 'none-to-follow',
              label: 'No complications. Results to follow',
              supported: false,
              rationale: 'The desaturation happened, and “to follow” gives the result to nobody.',
            },
            {
              id: 'laryngospasm',
              label: 'Laryngospasm, resolved. Will call if the cytology is abnormal',
              supported: false,
              rationale:
                'You saw a cough and a fall in saturation, not laryngospasm. A normal result needs a reader too.',
            },
          ],
        },
      ],
      sourceRefs: REPORT,
    },
  },

  moreActs: {
    findings: {
      kind: 'sort',
      outcomeId: 'describe-a-finding',
      sort: {
        id: 'name-the-finding',
        prompt: 'Six findings, in three pairs. Match each description to its name.',
        origins: [
          {
            id: 'endoluminal',
            label: 'Endoluminal obstruction',
            definition: 'Tissue inside the lumen.',
          },
          {
            id: 'extrinsic',
            label: 'Extrinsic compression',
            definition: 'The wall pushed in from outside.',
          },
          { id: 'stenosis', label: 'Stenosis', definition: 'A fixed narrowing.' },
          { id: 'malacia', label: 'Malacia', definition: 'A wall that collapses with breathing.' },
          { id: 'secretions', label: 'Secretions', definition: 'Mucus or pus in the lumen.' },
          { id: 'clot', label: 'Clot', definition: 'Blood that has set.' },
        ],
        rows: [
          {
            id: 'tissue-in-lumen',
            statement:
              'Tissue grows from one wall into the lumen. The wall around it keeps its round shape.',
            origin: 'endoluminal',
            rationale: 'The tissue is inside the lumen and the wall is not displaced.',
          },
          {
            id: 'wall-bulges-in',
            statement:
              'One wall bulges into the lumen. The mucosa over the bulge is smooth and unbroken.',
            origin: 'extrinsic',
            rationale: 'Intact mucosa over a bulge means the cause is outside the wall.',
          },
          {
            id: 'fixed-ring',
            statement:
              'A pale ring of scar narrows the trachea. It is the same size on the breath in, the breath out and a cough.',
            origin: 'stenosis',
            rationale: 'A narrowing that does not change with breathing is fixed.',
          },
          {
            id: 'closes-on-expiration',
            statement:
              'The trachea is wide on the breath in. On the breath out its walls come together.',
            origin: 'malacia',
            rationale: 'The caliber changes with breathing, so the wall is soft, not scarred.',
          },
          {
            id: 'moves-with-suction',
            statement:
              'Thick yellow material lies in a segment. It streams toward the tip when you suction.',
            origin: 'secretions',
            rationale: 'It moves with suction. Clear it, then describe the wall beneath.',
          },
          {
            id: 'dark-cast',
            statement:
              'A dark red, shiny cast fills a segment. It holds its shape and barely moves with suction.',
            origin: 'clot',
            rationale:
              'Dark, shiny and formed is clot. Do not pull at one that is stuck to the wall.',
          },
        ],
        sourceRefs: FINDINGS,
      },
    },
  },

  prediction: {
    id: 'N09',
    itemType: 'management-decision',
    situation:
      'In the right main bronchus you find a smooth, round, red lesion on the lateral wall, with vessels running across its surface. It has not bled. The forceps are on the tray, and the patient is stable.',
    stem: 'What do you do next?',
    choices: [
      {
        id: 'a',
        label: 'Take one small biopsy from its edge, away from the vessels',
        rationale:
          'A small bite of a vascular lesion can bleed as much as a large one, and you have nothing ready to stop it.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Leave it untouched, describe it, and plan the sampling',
        rationale:
          'Vessels on a smooth red lesion mean it may bleed heavily. The description is today’s job. The sample comes with a plan.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Suction its surface to see whether it bleeds on contact',
        rationale: 'That is a test whose positive result is the bleed you are trying to avoid.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Record it as a carcinoid and finish the survey',
        rationale:
          'Finishing the survey is right. The name is not yours to give: describe it, and pathology names it.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A smooth red lesion with surface vessels may be very vascular, and a biopsy can start bleeding you cannot control in this room. Describe it, do not touch it, and plan: imaging, the right room, bleeding control ready.',
    objectiveIds: ['M11-O3', 'M11-O2'],
    outcomeIds: ['describe-a-finding'],
    claimClass: 'source',
    sourceRefs: LESION,
    reviewItemIds: ['R20'],
  },

  transfer: {
    id: 'Q11',
    seedId: 'Q11',
    itemType: 'management-decision',
    situation:
      'You examine a ventilated patient through the endotracheal tube and clear a mucus plug from the left lower lobe. The report template opens with a line already filled in: “Vocal cords: normal.”',
    stem: 'What do you do with that line?',
    choices: [
      {
        id: 'a',
        label: 'Leave it, as the intubation went without difficulty',
        rationale:
          'An easy intubation is someone else’s observation from another day. This examination did not see the cords.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Copy the cords line from last month’s bronchoscopy report',
        rationale: 'That describes a different examination. This report covers this one.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Change it to: not seen, scope passed through the tube',
        rationale:
          'The line now says what happened, and the reader knows the larynx was not examined.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Pause and delete the line, so the report has no larynx entry',
        rationale: 'A missing line reads as forgotten. Not seen, with the reason, is an entry.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A template line is a prompt, not a finding. Through a tube the scope never sees the cords, so the line says not seen and gives the reason.',
    objectiveIds: ['M17-O2'],
    outcomeIds: ['write-the-report'],
    claimClass: 'source',
    sourceRefs: REPORT,
    transferVariant:
      'A line of the report that was never examined, where the prediction was a lesion in view and what to do about it.',
  },

  practice: [
    {
      id: 'mc-plug-then-lesion',
      presentationTitle: 'What the plug was covering',
      situation:
        'Tan secretions fill the bronchus intermedius. You suction them clear, and the lumen opens.',
      item: {
        id: 'mc-plug-then-lesion',
        itemType: 'management-decision',
        stem: 'What do you do next?',
        choices: [
          {
            id: 'a',
            label: 'Record a mucus plug as the cause and go on',
            rationale:
              'A plug can sit on top of the thing that caused it. You have not looked yet.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'Look at the wall the plug was covering, and describe it',
            rationale:
              'Contents are the last heading for a reason. Clear them, then describe the structure and the mucosa beneath.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label: 'Describe the secretions, then survey the lobes beyond',
            rationale: 'Both are worth doing. The wall you have just uncovered comes first.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Record purulent bronchitis of the bronchus intermedius',
            rationale:
              'That is a diagnosis from the color of the secretions. Describe what you saw.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Secretions hide the wall. Once they are cleared, inspect what was underneath and describe it: structure, mucosa, then what the contents were.',
        objectiveIds: ['M11-O1', 'M11-O2'],
        outcomeIds: ['describe-a-finding'],
        claimClass: 'source',
        sourceRefs: FINDINGS,
      },
    },
    {
      id: 'mc-wall-pushed-in',
      presentationTitle: 'A slit where a round lumen should be',
      situation:
        'The left main bronchus is narrowed to a slit. The mucosa is smooth and unbroken, and the posterior wall bulges forward into the lumen. The slit does not change with breathing.',
      item: {
        id: 'mc-wall-pushed-in',
        itemType: 'mechanism-interpretation',
        stem: 'What do you write?',
        choices: [
          {
            id: 'a',
            label: 'Endoluminal tumor of the left main bronchus; lumen almost closed',
            rationale:
              'Nothing grows inside the lumen, and the mucosa is intact. Tumor is also a diagnosis.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'Malacia of the left main bronchus; most of the lumen lost',
            rationale: 'Malacia changes with breathing. This slit stays the same.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Extrinsic compression, posterior wall; most of the lumen lost, estimated',
            rationale:
              'A wall pushed in under intact mucosa is extrinsic. The site, the amount and “estimated” complete the line.',
            plausibility: 'best',
          },
          {
            id: 'd',
            label: 'Abnormal left main bronchus with severe narrowing; see images',
            rationale: 'The reader learns nothing they can act on. Say where, what and how much.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Make the call between endoluminal, extrinsic and mixed from what the wall and the mucosa show. Then give the site and the share of lumen lost, as an estimate.',
        objectiveIds: ['M11-O5', 'M11-O4'],
        outcomeIds: ['describe-a-finding'],
        claimClass: 'source',
        sourceRefs: FINDINGS,
        reviewItemIds: ['R18'],
      },
    },
    {
      id: 'mc-curtailed-note',
      presentationTitle: 'A draft that says more than happened',
      situation:
        'In the ICU you suction a plug from the left lower lobe of a ventilated patient. Her saturation falls and you stop before looking at the right lung. The draft note reads: “Complete airway inspection. BAL performed.”',
      item: {
        id: 'mc-curtailed-note',
        itemType: 'management-decision',
        stem: 'What do you do with the draft?',
        choices: [
          {
            id: 'a',
            label: 'Sign it, as the plug was the reason for the procedure',
            rationale:
              'The note says the right lung was inspected and a lavage was done. Neither is true.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'Rewrite it: plug aspirated, right lung not seen, desaturation',
            rationale: 'It records what was done, what was not, and why the procedure ended.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label: 'Keep “BAL performed”, as fluid was instilled and suctioned',
            rationale:
              'Aspirating a plug is not a lavage. The laboratory and the next reader treat them differently.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Add that the right lung was clear on the morning chest radiograph',
            rationale: 'A radiograph is not a look. The report says what the scope saw.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A procedure that stops early is reported as one that stopped early. Name what was done, what was not seen and the event that ended it.',
        objectiveIds: ['M17-O5', 'M17-O2'],
        outcomeIds: ['write-the-report'],
        claimClass: 'source',
        sourceRefs: REPORT,
      },
    },
  ],
}
