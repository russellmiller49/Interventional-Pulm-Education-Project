import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M06, part one — Three frames of reference. The patient's anatomy, the CT display and the camera
 * image each carry their own directions: screen position belongs to the camera or the display, and
 * an airway is named from landmarks and parentage, read on CT with the display's own letters.
 * Knowledge spec §5.1, §5.2, §5.5 and §6.2, drill D17 and case C12 (S1 PDF 35–38, 61–70; S2 PDF
 * 44–47; T02 00:00:45–00:02:19; T11 00:19:46–00:34:48).
 *
 * The CT slices and endoscopic stills are the course's own teaching media (crosshair and outline
 * placed by the airway lesson); no lecture image is described (R51).
 */
export const section: BronchSectionDefinition = {
  id: 'reference-frames',
  title: 'Three frames of reference',
  shortTitle: 'Reference frames',
  minutes: 8,
  moduleIds: ['M06'],
  objectives: [
    {
      objectiveId: 'M06-O1',
      subtask:
        'Places the trachea’s ringless membranous wall in the patient’s frame, then names each marked airway on one path down the right side, across coronal and axial CT slices and a camera still, from the main carina and the main-bronchial relationships.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M06-O2',
      subtask:
        'Commits what decides which opening leads toward the lower lobe after a shaft rotation has turned the image and, in practice, reads an atlas clock position against the view from the patient’s side.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M06-O5',
      subtask:
        'Traces the right upper lobe takeoff, the bronchus intermedius and the middle lobe across CT slices, and commits what a quarter-turn rotation of a displayed still changes.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D17'],
  prerequisites: ['five-controls', 'branch-entry'],

  clinicalQuestion:
    'When the image on the monitor has turned and a CT is open beside it, what tells you which airway is in view?',
  recognizeTitle: 'A camera still beside an axial CT',
  objective:
    'Decide what fixes an airway’s name while the image on the monitor turns and a CT display sits beside it.',
  why: 'Every sample, finding and report is filed under an airway’s name. A misnamed airway sends the sample, the report or the next move somewhere other than intended.',
  newConcept:
    'Screen position belongs to the camera or the display; an airway’s identity belongs to the patient, fixed by landmarks and parentage, read on CT with the display’s own orientation letters.',
  incrementSentence:
    'This section adds one idea to shaft rotation as you have used it: the camera image, the CT display and the patient each carry their own directions, and only the patient’s frame names an airway.',
  harmfulReflex:
    'Naming an airway from where it sits on the monitor or on one CT slice, then advancing into it or choosing it for a sample.',
  anchor: {
    analogy:
      'A street map turned on the table still names the same streets: the street signs, not the edge of the paper nearest you, say where you are.',
    precise:
      'The camera image turns with the shaft and the CT display follows its own convention, so a direction on a screen names a direction in the patient only once its frame is stated. The patient’s frame is fixed by the cartilage rings anteriorly and laterally and the membranous wall posteriorly in the trachea, by the main carina, and by the order in which the branches arise.',
    checklistLabel: 'Before naming an airway on a turned image',
    checklist: [
      'In the trachea, find the membranous wall: it is posterior',
      'Name the parent, then the daughter',
      'Describe a screen position only with its frame stated',
      'On CT, read the edge letters and follow the airway across adjacent slices',
    ],
  },

  spineStops: ['trachea', 'carina', 'main-bronchi', 'lobar'],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-retrace',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No control names an airway. Rotation turns the picture and deflection bends the tip within it; the name comes from landmarks and the branches already travelled, and advancing into an airway named from the screen is the reflex to resist.',
  },
  precommitDenyPatterns: [
    /recogni[sz]able anatomy/i,
    /path taken from the carina/i,
    /order in which (the )?branch(es)? (arose|arise)/i,
    /(does not|doesn['’]t) turn with the camera/i,
    /landmarks and parentage/i,
    /identity belongs to the patient/i,
    /screen position belongs to/i,
  ],
  modelBoundary:
    'The CT slices and camera stills are authored teaching media, pending review: fixed, pre-rendered views from normal teaching airways, with crosshairs and outlines placed by the lesson. They are not a stack you can scroll, they are not offered as one patient’s matched study, and they show no variant anatomy.',
  localPolicyIds: [],
  reviewItemIds: ['R51'],

  blocks: [
    {
      id: 'which-airway',
      kind: 'question',
      role: 'framing',
      heading: 'Which airway is this?',
      body: 'During a bronchoscopy, the airway in front of the scope appears on the monitor as a camera image, and often on a CT display beside it. Several cues are on hand for naming it, and they do not always agree.\n\nThis section is about which of them can tell you which airway you are in.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 38 } },
        { sourceId: 'T02', location: { kind: 'time-span', start: '00:00:45', end: '00:02:19' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:00:55' } },
      ],
    },
    {
      id: 'on-hand-at-the-scope',
      kind: 'signals',
      role: 'signals',
      heading: 'What is on hand at the scope',
      body: 'Each of these is available during an inspection; the next step asks which of them an airway’s name depends on.',
      pointsLabel: 'Information available at the scope',
      points: [
        'The camera image on the monitor',
        'An axial CT on a second screen, with letters at its edges',
        'The walls and openings in view',
        'The airways entered since the main carina',
        'How far, and which way, the shaft has been turned',
        'Where the operator is standing',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      ],
    },
    {
      id: 'trachea-to-bronchus-intermedius',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'From the trachea to the bronchus intermedius',
      body: 'In the trachea, cartilage rings support the anterior and lateral walls, and the flat membranous wall runs posteriorly. The main carina separates the right and left main bronchi. The right main bronchus is short: the right upper lobe arises early from it, and the continuation beyond that origin is the bronchus intermedius, a bronchus rather than a lobe. The left main bronchus is longer and divides into the upper and lower lobes.\n\nAt the distal bronchus intermedius, the middle lobe bronchus runs anteriorly, the superior segment of the lower lobe (RB6) runs posteriorly, and the basal continuation carries on inferiorly.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:23:09', end: '00:28:21' } },
      ],
    },
    {
      id: 'how-each-display-is-made',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'How each display is made',
      body: 'A conventional axial CT display is commonly viewed as if looking from the patient’s feet, and the letters at its edges name the patient’s directions for that display. A coronal slice is a second display of the same chest, with letters of its own.\n\nThe camera image is made from the tip of the scope, looking along an airway: it shows the view from wherever the tip is, turned however the shaft is turned.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 38 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'T02', location: { kind: 'time-span', start: '00:00:45', end: '00:02:19' } },
      ],
    },
    {
      id: 'one-airway-three-frames',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'One airway, three frames',
      body: 'The camera image turns whenever the shaft rotates or the display is digitally rotated, so one structure can sit at the top of one image and at the side of the next. The axial CT follows its own display convention, and a side shown on it is not automatically the same side of the camera image. The operator may stand at the head of the bed or at the patient’s side: the stance changes, the anatomy does not.\n\nThe anatomy is the reference that does not turn. The trachea’s cartilage rings and membranous wall, the main carina and the order in which branches leave their parents hold wherever they sit on the screen, and they are more dependable than an opening memorized at a fixed clock position.\n\nA clock position is meaningful only when its frame is stated. “With this image orientation, the anterior middle-lobe opening is at the top of the screen” describes one image; a rule placing the middle lobe at one clock position in every image is not acceptable. Name the airway from its landmarks and its parent, then say where it sits in this image.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'T02', location: { kind: 'time-span', start: '00:00:45', end: '00:02:19' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:19:46', end: '00:34:48' } },
      ],
    },
    {
      id: 'tracing-the-right-side',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'Tracing the right side through the slices',
      body: 'A CT trace follows one airway from a known parent across consecutive slices, naming each branch as it leaves. The aim is continuity, not recognizing a single slice.',
      pointsLabel: 'The trace, level by level',
      points: [
        'At the main carina: both main bronchi, the right one short.',
        'The right upper lobe takeoff, on consecutive slices. One axial slice may show its anterior and posterior branches while the apical branch needs a slice further up.',
        'Below the takeoff: the bronchus intermedius, continuing toward the middle and lower lobes.',
        'At the distal bronchus intermedius: the middle lobe runs anteriorly and the superior segment of the lower lobe (RB6) posteriorly.',
        'Beyond them, the basal continuation, followed inferiorly.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:23:09', end: '00:28:21' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these names an airway from a picture’s frame instead of the patient’s.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Reading the patient’s left from the left of the screen: on CT, read the display’s edge letters; on the camera image, read the anatomy.',
        'Carrying a clock position from an atlas to a turned image: state this image’s frame, and name the airway from its parent.',
        'Laying the axial CT over the camera image as if they shared a viewpoint: find the same parent bronchus and branch in each.',
        'Naming an airway from one attractive CT slice: follow it from its parent through the adjacent slices.',
        'Calling a right-sided airway the bronchus intermedius without tracing it: the upper lobe bronchus branches away; the bronchus intermedius continues.',
        'Saving or sharing a teaching image with no record of its frame: note the patient position, scope entry direction, camera roll and any digital rotation.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 38 } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:23:09', end: '00:28:21' } },
      ],
    },
  ],

  workspace: {
    kind: 'media',
    media: [
      { kind: 'ct-slice', structureId: 'rmb', plane: 'axial' },
      { kind: 'endoscopic-still', structureId: 'rmb', outline: false },
    ],
    caption:
      'An axial CT slice with letters at its edges, and a camera still looking down the right main bronchus — authored teaching media, pending review',
  },

  steps: {
    recognize: {
      instruction:
        'Look at the image in the Simulator panel: an axial CT slice beside a camera still looking down the right main bronchus. For each, note what it shows and which way it is oriented.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.image },
    },
    act: {
      title: 'One path down the right side',
      instruction:
        'In the views to name on this card, name each marked wall or airway from its landmarks and its parent, then check each name.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.identifyRows },
    },
    explain: {
      title: 'Three frames, one airway',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'identify',
    identify: {
      id: 'right-side-trace',
      prompt:
        'Two camera stills, in the trachea and the right main bronchus, and four CT views following one path from the main carina down the right side. The stills and the CT come from different teaching airways. Name each marked wall or airway from its landmarks and its parent.',
      rows: [
        {
          id: 'still-trachea-membranous-wall',
          media: { kind: 'endoscopic-still', structureId: 'trachea', outline: false },
          prompt:
            'A camera still in the trachea, above the main carina, with cartilage rings running ahead. Which way does the tracheal wall without rings face in the patient?',
          choices: [
            { id: 'anterior', label: 'Toward the patient’s front' },
            { id: 'posterior', label: 'Toward the patient’s back' },
            { id: 'right', label: 'Toward the patient’s right' },
            { id: 'left', label: 'Toward the patient’s left' },
          ],
          answerId: 'posterior',
          rationale:
            'In the trachea, cartilage rings support the anterior and lateral walls, and the flat membranous wall, without rings, runs posteriorly. It faces the patient’s back wherever the camera’s roll puts it on the screen, so finding it sets the patient’s front, back and sides before the main carina.',
        },
        {
          id: 'coronal-takeoff',
          media: { kind: 'ct-slice', structureId: 'rul', plane: 'coronal' },
          prompt:
            'A coronal slice through the trachea and both main bronchi. Read the edge letters, then name the airway under the crosshair.',
          choices: [
            { id: 'rul', label: 'Right upper lobe bronchus' },
            { id: 'lul', label: 'Left upper lobe bronchus' },
            { id: 'bi', label: 'Bronchus intermedius' },
            { id: 'rml', label: 'Right middle lobe bronchus' },
          ],
          answerId: 'rul',
          rationale:
            'The letter R marks the patient’s right on the left of this display. The crosshair sits on the first branch of the short main bronchus on that side: the right upper lobe bronchus. Read from the left of the screen, it would be misnamed the left upper lobe.',
        },
        {
          id: 'axial-takeoff',
          media: { kind: 'ct-slice', structureId: 'rul', plane: 'axial' },
          prompt:
            'An axial slice at the level of the coronal crosshair, displayed as if from the patient’s feet. Read the edge letters, then name the airway under the crosshair.',
          choices: [
            { id: 'bi', label: 'Bronchus intermedius' },
            { id: 'rul', label: 'Right upper lobe bronchus' },
            { id: 'rb6', label: 'Superior segment of the right lower lobe (RB6)' },
            { id: 'lul', label: 'Left upper lobe bronchus' },
          ],
          answerId: 'rul',
          rationale:
            'The edge letters again put the patient’s right on the left of the display. At the level of the takeoff, the airway leaving the right main bronchus is the right upper lobe bronchus; the bronchus intermedius is the continuation, found on lower slices. Labeling a lateral right-sided airway from one slice is how the upper lobe bronchus gets misnamed as the continuation.',
        },
        {
          id: 'axial-continuation',
          media: { kind: 'ct-slice', structureId: 'bronchus-intermedius', plane: 'axial' },
          prompt:
            'Several slices lower, toward the feet; no new branch has left on the right on the slices between. Read the edge letters, then name the airway under the crosshair.',
          choices: [
            { id: 'rul', label: 'Right upper lobe bronchus' },
            { id: 'bi', label: 'Bronchus intermedius' },
            { id: 'rll', label: 'Right lower lobe bronchus' },
            { id: 'rmsb', label: 'Right main bronchus' },
          ],
          answerId: 'bi',
          rationale:
            'Below the upper lobe takeoff, the continuation of the right main bronchus is the bronchus intermedius: a bronchus, not a lobe. It leads toward the middle and lower lobes, whose origins lie on lower slices, so neither of their names fits yet.',
        },
        {
          id: 'axial-anterior-branch',
          media: { kind: 'ct-slice', structureId: 'rml', plane: 'axial' },
          prompt:
            'Lower again. The crosshair sits where a branch leaves toward the edge lettered A. Read the side from the edge letters, then name the branch.',
          choices: [
            { id: 'rml', label: 'Right middle lobe bronchus' },
            { id: 'rb6', label: 'Superior segment of the right lower lobe (RB6)' },
            { id: 'rul', label: 'Right upper lobe bronchus' },
            { id: 'lul', label: 'Left upper lobe bronchus' },
          ],
          answerId: 'rml',
          rationale:
            'At the distal bronchus intermedius, the middle lobe bronchus runs anteriorly and the superior segment of the lower lobe runs posteriorly, while the basal continuation carries on inferiorly. A branch heading toward A, on the side lettered R and below the continuation named on the last CT view, is the right middle lobe bronchus; read from the left of the screen, it could be misnamed a branch of the left upper lobe.',
        },
        {
          id: 'still-takeoff',
          media: { kind: 'endoscopic-still', structureId: 'rul', outline: true },
          prompt:
            'A camera still from the right main bronchus, below the main carina; the camera’s roll for this image was not recorded. Name the outlined opening that leaves its wall here.',
          choices: [
            { id: 'rul', label: 'Right upper lobe bronchus' },
            { id: 'bi', label: 'Bronchus intermedius' },
            { id: 'rml', label: 'Right middle lobe bronchus' },
            { id: 'lul', label: 'Left upper lobe bronchus' },
          ],
          answerId: 'rul',
          rationale:
            'The first branch of the short right main bronchus is the right upper lobe bronchus, wherever this image’s roll puts it on the screen; its name comes from its parent and its early origin, not its screen position.',
        },
      ],
      sourceRefs: [
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:23:09', end: '00:28:21' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 38 } },
      ],
    },
  },

  prediction: {
    id: 'Q03',
    seedId: 'Q03',
    itemType: 'mechanism-interpretation',
    situation:
      'During a supervised inspection, the scope has entered the right main bronchus from the main carina. To look into an opening, the trainee rotated the shaft, and the image on the monitor turned with it. An axial CT is open on a second screen. The plan is to continue toward the right lower lobe, and the trainee is no longer sure which opening leads there.',
    stem: 'What should decide which opening leads toward the right lower lobe?',
    choices: [
      {
        id: 'a',
        label: 'The walls in view and the path taken from the carina',
        rationale:
          'The walls and openings in view, and the order in which branches have arisen since the carina, belong to the patient and stay put when the camera rolls. They say which opening continues toward the lower lobe however the image is turned.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Where each opening sits on the monitor, with down read as the feet',
        rationale:
          'Screen-up changes with camera roll: after this rotation the top of the monitor can face any wall. Following the opening that sits low on the screen can put the scope, and a later sample, in an airway other than the one intended.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'A clock position learned from an atlas picture of this bronchus',
        rationale:
          'A clock position means something only when its image frame is stated. The atlas picture had its own orientation and this turned image has another, so the same opening sits at a different hour.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'How far, and which way, the shaft has been turned since the carina',
        rationale:
          'Keeping count of the turn helps state this image’s frame, but it records what the hand did, not where the tip faces: a clamped grip or a loop outside the patient can take up part of the turn, and a count cannot restore orientation once it is lost. Only the anatomy says which opening continues toward the lower lobe.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'The image turned with the shaft, so where an opening sits on the monitor and an atlas clock position describe the picture, not the patient, and a remembered turn of the shaft records only what the hand did. Recognizable anatomy does not turn with the camera: the walls in view, the main carina and the order in which the branches arose fix which opening continues toward the lower lobe. Name the airway from those, then describe where it sits in this image.',
    objectiveIds: ['M06-O2'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 90 } },
    ],
  },

  transfer: {
    id: 'Q15',
    seedId: 'Q15',
    itemType: 'mechanism-interpretation',
    situation:
      'At a teaching conference after the procedure, a captured still of the right middle lobe orifice is shown on the review screen. To match an atlas picture, the presenter uses the display software to rotate the still a quarter turn (90 degrees) and saves the turned copy to the teaching file.',
    stem: 'What does the rotation change?',
    choices: [
      {
        id: 'a',
        label: 'Which parent bronchus the opening in the still arises from',
        rationale:
          'Rotating the display does not change parentage: the opening arises from the bronchus intermedius before and after the turn, so it is the same airway.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Which direction counts as anterior in the patient',
        rationale:
          'The patient’s anterior is fixed to the body. Turning the display moves where anterior appears on the screen; it cannot redefine the patient’s frame.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Where each structure appears on the screen',
        rationale:
          'A display rotation, like camera roll, transforms the picture: every structure moves on the screen together while the anatomy stays as it was.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Nothing a later reader needs to know, as it now matches the atlas',
        rationale:
          'The turn moved every structure on the screen. A saved copy with no note of the turn looks like the atlas picture, and a later reader cannot tell which wall faced which direction in the patient.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Camera roll and display rotation change the picture’s frame, not the patient’s. Every structure moves on the screen together; the opening’s parent, its lobe and the patient’s anterior are as they were. That is why a turned teaching still is saved with a note of the turn, and why turning an image to match an atlas names nothing by itself.',
    objectiveIds: ['M06-O5'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:19:46', end: '00:34:48' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
    ],
    transferVariant:
      'After the procedure, on a review screen, a captured still turned by display software rather than a live image turned by the shaft: the same principle in a different phase of care, with a different cause of rotation.',
  },

  practice: [
    {
      id: 'C12',
      manifestCaseId: 'C12',
      presentationTitle: 'A lower-lobe target chosen at the planning workstation',
      situation:
        'Planning a simulated lower-lobe task, a trainee labels a lateral right-sided airway on one axial CT image as the bronchus intermedius and selects it as the target. The rest of the study, axial and coronal, is open on the workstation beside the simulator’s camera view.',
      item: {
        id: 'C12',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label: 'Trace the airway from the carina through adjacent slices and the coronal view',
            rationale:
              'Continuity from a known parent is what establishes an airway connection. Followed from the main carina, the upper lobe bronchus branches away while the bronchus intermedius carries on toward the middle and lower lobes, and the coronal view has to agree.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Accept the label and assign the sampling site from this slice',
            rationale:
              'One slice shows where an airway lies, not what it connects to. A sampling site assigned from a single unverified screen position can send the sample to another lobe.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Confirm it on the coronal view by finding an airway in the same screen position',
            rationale:
              'A match of screen positions between two displays is still a screen position. The axial and coronal displays cut the chest in different planes, so a similar place on each need not hold the same airway.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Turn the simulator’s camera view until the airway sits where the CT shows it',
            rationale:
              'The axial display and the camera image have different viewpoints. Turning the camera image until it resembles a slice matches two pictures by eye; it does not show which airway either one contains.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A single slice shows position, not connection. Identity comes from parentage: follow the candidate from the trachea and main carina through adjacent slices, where the upper lobe bronchus branches away and the bronchus intermedius continues toward the middle and lower lobes. The same identity has to hold on the coronal view before the target is accepted, and later in the camera image, which can be rotated without changing it.',
        objectiveIds: ['M06-O5', 'M06-O1'],
        claimClass: 'transcript-source',
        sourceRefs: [
          { sourceId: 'T11', location: { kind: 'time-span', start: '00:23:09', end: '00:25:15' } },
          { sourceId: 'T11', location: { kind: 'time-span', start: '00:27:36', end: '00:30:34' } },
        ],
      },
    },
    {
      id: 'mc-rotated-image',
      presentationTitle: 'Naming the middle lobe from the patient’s side',
      situation:
        'For this procedure the operator stands at the patient’s side, not at the head of the bed. The scope is at the distal bronchus intermedius with two openings in view, and the axial CT is open on a second screen. A trainee names the opening at the top of the monitor as the right middle lobe, because an atlas picture shows the middle lobe at twelve o’clock.',
      item: {
        id: 'mc-rotated-image',
        itemType: 'mechanism-interpretation',
        stem: 'What is the best reading of the atlas rule here?',
        choices: [
          {
            id: 'a',
            label: 'It described that picture’s orientation; this image needs its own reference',
            rationale:
              'A clock position is meaningful only when its frame is stated. “With this image orientation, the anterior opening is at the top of the screen” is an observation about one image; it does not carry over to an image made with the scope held another way.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'It is a fixed fact of the anatomy, so the label at the top stands',
            rationale:
              'What the middle lobe keeps is its direction in the patient — it arises from the bronchus intermedius and runs anteriorly — not its place on a screen. How the scope is held and turned decides where the anterior opening appears on the monitor.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label:
              'It does not transfer; read the CT’s anterior letter onto the monitor image instead',
            rationale:
              'The CT’s edge letters name directions on a display viewed as if from the feet; the camera looks along the airway from the tip. Carrying the A from one display onto the other matches two pictures by position, and the anterior opening still has to be found in the camera image from its own landmarks.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'It applies once the operator is back at the head of the bed',
            rationale:
              'Stance is only one part of the frame. The image’s orientation also depends on how the scope is held and turned, so returning to the head of the bed does not by itself put the middle lobe at twelve o’clock; the name still comes from the anatomy.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A clock position describes one image in one orientation. The middle lobe is named by its parent and its direction in the patient: it arises from the bronchus intermedius and runs anteriorly, while the superior segment of the lower lobe runs posteriorly, and neither changes with the operator’s stance, the scope’s roll or the display beside it. Re-establish that direction from landmarks already identified, then say where the opening sits in this image.',
        objectiveIds: ['M06-O2'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 38 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
          { sourceId: 'T11', location: { kind: 'time-span', start: '00:23:09', end: '00:28:21' } },
        ],
      },
    },
  ],
}
