import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M08 — Right-sided bronchial anatomy and navigation. The learner names the right-sided airways by
 * the parent each arises from, recovers an upper lobe origin left behind by withdrawing to its
 * parent (drill D05), moves between two parents in the B4–B5–B6 sequence (D06), and meets the
 * early medial basal origin and the grouping that is not a division (D08). Knowledge spec §6.2–6.8
 * and §11.3–11.5 (S1 PDF 61–70; S2 PDF 44–47, 103, 106, 159–160; T11; T12), case C11.
 */
const BOUNDARY =
  'One declared teaching profile of normal right-sided anatomy, with in-view labels off and the camera roll set to a reference view at the upper and middle lobes. Guided travel follows the centerline and will not advance until the tip is aimed at a branch; contact and red-out are feedback signals, not measurements of force or injury.'

export const section: BronchSectionDefinition = {
  id: 'right-side',
  title: 'The right bronchial tree',
  shortTitle: 'Right side',
  minutes: 10,
  moduleIds: ['M08'],
  objectives: [
    {
      objectiveId: 'M08-O1',
      subtask:
        'Commits which structure the scope is in after a steady advance from the right main bronchus, when an anterior opening lies ahead with the lumen continuing beyond it.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M08-O2',
      subtask:
        'Commits the name and parent of a posteriorly directed opening at the middle lobe level in a practice case, after the normal reference names RB1 to RB10 by parent; the scope tasks bring RB1 to RB3 into view and enter RB4 to RB6 with the parentage readout as an assist, not as identification.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M08-O3',
      subtask:
        'Enters RB4 and RB5 from the middle lobe, returns through the bronchus intermedius and enters RB6 from the right lower lobe; the hand skill itself needs faculty observation.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M08-O4',
      subtask:
        'Commits the next move when three large basal openings are in view and the medial basal origin has not been seen, and explains why the basal group is a grouping rather than one division.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M08-O5',
      subtask:
        'Decides, in a practice case, what to do when a teaching model shows two right upper lobe openings and a separate opening in the proximal trachea.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D05', 'D06', 'D08'],
  prerequisites: ['branch-entry', 'reference-frames', 'view-loss', 'larynx-and-entry'],

  clinicalQuestion:
    'In the right lung, how do you know which airway the scope is in, and what is the next move when an opening you expected is not in view?',
  recognizeTitle: 'Advancing down the right main bronchus',
  objective:
    'Distinguish the airways of the right lung by where each arises, and decide the next move when an expected opening is not in view.',
  why: 'Every description, photograph and sample is filed under an airway’s name. A misnamed right-sided airway files them under another airway in the record.',
  newConcept:
    'On the right, the order in which origins arise from the main carina in the declared profile — the upper lobe early, then the bronchus intermedius to the middle and lower lobes, the superior segment near the middle lobe level, and a medial basal origin that may arise early — tells you which origins the tip has already gone beyond; an expected origin not yet seen may be behind the tip, and it is found again from its parent.',
  incrementSentence:
    'This section adds one idea to naming by parentage: on the right, the order of origins from the main carina tells you whether an opening you have not seen is already behind the tip.',
  harmfulReflex:
    'Bending harder toward the right upper lobe from inside the bronchus intermedius, or advancing further in search of it, instead of withdrawing to the right main bronchus where its origin can be seen.',
  anchor: {
    analogy:
      'A corridor with a side door just inside its entrance: once you have walked beyond the door, the hallway you are in is named by the door behind you, not by the rooms ahead, and the way to the door is to step back until it is in front of you, not to lean around the corner.',
    precise:
      'The right main bronchus is short before the right upper lobe origin; distal to that origin the airway is the bronchus intermedius, leading to the middle and lower lobes. An origin behind the tip is exposed by withdrawing to its parent, rotated into the bending plane, and entered from there.',
    checklistLabel: 'Naming a right-sided airway',
    checklist: [
      'Name the last airway you are certain of',
      'Name the origin expected next, and whether the tip is already beyond it',
      'Withdraw to its parent when that origin is not in view',
      'Advance only along the lumen you can see',
    ],
  },

  spineStops: ['main-bronchi', 'lobar', 'segmental'],
  grammarRowIds: ['missing-expected-branch', 'clear-but-lost'],
  controlStrip: {
    verdict: 'no-control-retrace',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'not-this-one',
      deflection: 'harmful-reflex',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No single control recovers an origin the tip has gone beyond; the fix is a retrace: name the last airway you are certain of, withdraw to it until the origin is in view, rotate the origin into the bending plane, deflect until its lumen is in view, and enter. Advancing further, or bending harder from the airway beyond, is the reflex to resist.',
  },
  precommitDenyPatterns: [
    /\bintermedius\b/i,
    /\bwithdraw\w*\s+(back\s+)?(in)?to\s+(its|the)\s+(parent|right main bronchus)\b/i,
  ],
  modelBoundary:
    'This section drives one declared teaching profile of normal right-sided anatomy. A variant such as a tracheal bronchus appears only in a practice case, in words; the scope shows no variant. Guided, centerline-locked travel and a camera roll set to a reference view at the upper and middle lobes are assists, and contact and red-out are feedback signals, not measurements of force, mucosal injury or hand skill.',
  physicalSkillNote:
    'The scope tasks here use guided, centerline-locked travel from a keyboard, pointer or touch. The app cannot see how rotation and the thumb lever are coordinated at the handle, how torque reaches the tip, or the force at the airway wall; navigating RB4, RB5 and RB6 with the hands is shown only under faculty observation.',
  localPolicyIds: [],
  reviewItemIds: ['R01', 'R04', 'R06', 'R07'],

  blocks: [
    {
      id: 'short-right-main',
      kind: 'question',
      role: 'framing',
      heading: 'Into the right lung',
      body: 'From the main carina, the scope enters the right main bronchus on its way to the lobar and segmental airways of the right lung.\n\nThis section is about how those airways are named, and what to do when an opening you expected is not in front of the lens.',
      claimClass: 'source',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } }],
    },
    {
      id: 'what-names-an-airway',
      kind: 'signals',
      role: 'signals',
      heading: 'What tells you where you are',
      body: 'Each of these helps name a right-sided airway. Before naming one, say which of them the name rests on.',
      pointsLabel: 'Information available at a right-sided branch',
      points: [
        'The last airway you are certain of, and the branches travelled since',
        'How many openings are in view, against the pattern you expected',
        'Which way each opening is directed in the patient, not where it sits on the screen',
        'The CT and the declared teaching profile, where they are supplied',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 66, to: 67 } },
      ],
    },
    {
      id: 'right-side-in-order',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'The right side, airway by airway',
      body: 'The declared teaching profile, walked from the main carina. Names follow the parent first, then the segment number. The upper lobe trifurcation is a useful first pattern, not a promise that every patient branches the same way.',
      pointsLabel: 'From the main carina, in order',
      points: [
        'Right main bronchus: short; its first branch, the right upper lobe, comes early and is easy to go beyond.',
        'Right upper lobe: RB1 apical, RB2 posterior, RB3 anterior.',
        'Bronchus intermedius: the continuation distal to the upper lobe origin, leading to the middle and lower lobes. A bronchus, not a lobe.',
        'Right middle lobe: arises anteriorly or anterolaterally; RB4 lateral, RB5 medial.',
        'Right lower lobe: RB6, the superior segment, is posteriorly directed near the middle lobe level and belongs to the lower lobe.',
        'Basal airways: RB7 medial basal, RB8 anterior basal, RB9 lateral basal, RB10 posterior basal.',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 67 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106 } },
      ],
      reviewItemIds: ['R01'],
    },
    {
      id: 'beyond-and-back',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Going beyond the upper lobe origin, and coming back',
      body: 'Because the right main bronchus is short before the upper lobe origin, a scope advanced steadily from the main carina can reach the bronchus intermedius before that origin has been seen. From there the origin is behind the tip. The correction is the entry sequence’s recovery from an overshoot: withdraw until the branch point is visible, rotate the origin into the bending plane, deflect until its lumen is in view, and advance along it without dragging the tip across the carina between the upper lobe and the bronchus intermedius. Bending harder from too far downstream does not solve the geometry.\n\nThe same correction applies inside the upper lobe. Wedged deep in one segment, the other two cannot be named from that view; withdraw until their common origin is visible.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      ],
      reviewItemIds: ['R04'],
    },
    {
      id: 'two-parents',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Two parents at one level',
      body: 'Beyond the upper lobe, the bronchus intermedius leads to the middle lobe origin and to the lower lobe. The middle lobe arises anteriorly or anterolaterally and divides into RB4, lateral, and RB5, medial. RB6, the superior segment of the lower lobe, is posteriorly directed near the same level. Where each opening sits on the screen depends on shaft rotation; its parent and its direction in the patient do not.\n\nRB6 is not a third middle-lobe segment. The second scope task in this section moves between two parents on purpose: into the middle lobe branches, back to a parent view, then into the superior segment from the lower lobe.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 66, to: 67 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46, to: 47 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
      ],
    },
    {
      id: 'grouping-not-division',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'A grouping is not a division',
      body: 'The teaching profile lists RB7 to RB10 together as the right basal group. That is an educational grouping: it does not claim that the four basal segments arise from one simultaneous four-way division. RB7, the medial basal, may arise separately and early, and is easily left out when three large openings ahead look like the whole group.\n\nIdentify each actual origin, and return to a recognizable parent view between branches when needed. The depth that matters is the depth the inspection needs, limited by caliber, view and safety; the far end of the model is not a target.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 47 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
      ],
      reviewItemIds: ['R06'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Most of these take an airway’s name from the view in front of the lens rather than from its parent.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Calling the bronchus intermedius the right upper lobe: ask which branch is already behind the tip, then withdraw to show the upper lobe origin.',
        'Bending hard toward the upper lobe from inside the bronchus intermedius: withdraw to the right main bronchus, rotate the origin into the bending plane, then deflect and enter.',
        'Placing RB6 in the middle lobe because its opening sits near it: name its parent, the lower lobe.',
        'Swapping RB4 and RB5: RB4 is lateral and RB5 medial, whatever the screen shows.',
        'Recording the basal airways from three large openings: identify the medial basal origin, which may arise separately and earlier than the other three.',
        'Reading RB4 as lymph-node station 4R: B names a bronchus; a station is a lymph-node location.',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 67 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 146, to: 147 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 47 } },
      ],
    },
    {
      id: 'missing-branch',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'When an expected branch is missing',
      body: 'The row for a missing expected branch, under Reading the view, gives what fewer openings than expected can mean and the retrace that follows.\n\nIn one narrated inspection, the right upper lobe lacked its expected apical branch because the apical supply arose from a tracheal bronchus, whose origin can be partly concealed by secretions. In that example the retrace reaches the trachea: acknowledge that the familiar pattern is absent, look there and on any CT for another origin of the missing supply, and ask for help while identity is uncertain. No arbitrary opening is labeled RB1 to complete a list, and no second RB1 is recorded in the usual place unless a reviewed case truly has a supernumerary branch. Not every tracheal bronchus supplies the same territory, so the region it supplies is settled on review, not assumed.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:36:14', end: '00:37:48' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:42:21' } },
        { sourceId: 'T12', location: { kind: 'time-span', start: '00:09:15', end: '00:10:08' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      ],
      reviewItemIds: ['R07', 'R06'],
    },
  ],

  workspace: {
    kind: 'scope',
    view: {
      sectionId: 'right-side',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'RMSB', at: 'proximal' },
      controls: [],
      assists: {
        'centerline-lock': true,
        'aim-guard': true,
        'branch-labels': false,
        'reference-orientation': true,
      },
      defaults: { branchLabels: false },
      litAirways: [],
      boundary: BOUNDARY,
    },
  },

  steps: {
    recognize: {
      instruction:
        'In the bronchoscope view in the Simulator panel, the tip sits just inside the right main bronchus. Count the openings ahead of it and note which way each is directed in the patient.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.scopeView },
    },
    act: {
      title: 'Find the right upper lobe',
      instruction:
        'The tip starts in the bronchus intermedius, beyond the right upper lobe origin, with the in-view labels off. Use the scope controls under the view to meet the goals on this card.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    observe: {
      title: 'From the middle lobe to the lower lobe',
      instruction:
        'Starting just proximal to the middle and lower lobe origins, enter each airway the goals on this card name, and watch the parentage in the readouts under the controls as you go.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.readouts,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'Named by the parent',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and ${TEACHING_LANDMARKS.grammar} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: {
      sectionId: 'right-side',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'BI', at: 'mid' },
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'recenter', 'reset'],
      assists: {
        'centerline-lock': true,
        'aim-guard': true,
        'branch-labels': false,
        'align-to-branch': false,
        recenter: true,
        'reference-orientation': true,
      },
      defaults: { branchLabels: false },
      readouts: ['currentAirway', 'parentage'],
      litAirways: ['RMSB', 'RUL', 'BI'],
      boundary: BOUNDARY,
    },
    goals: [
      {
        id: 'expose-upper-lobe-origin',
        label: 'Bring the right upper lobe origin into view',
        test: { type: 'event-sequence', events: ['withdrew-to:RMSB', 'ostium-visualized:RUL'] },
      },
      {
        id: 'enter-from-parent',
        label:
          'Enter the right upper lobe without wall contact and without entering the middle or lower lobe',
        test: {
          type: 'all',
          tests: [
            { type: 'event-sequence', events: ['withdrew-to:RMSB', 'entered:RUL'] },
            { type: 'without', event: 'wall-contact' },
            { type: 'without', event: 'advanced-in-red-out' },
            { type: 'without', event: 'entered:RML' },
            { type: 'without', event: 'entered:RLL' },
          ],
        },
      },
      {
        id: 'upper-lobe-segments',
        label: 'Enter the right upper lobe and bring RB1, RB2 and RB3 into view',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'entered:RUL' },
            { type: 'event', event: 'ostium-visualized:RB1' },
            { type: 'event', event: 'ostium-visualized:RB2' },
            { type: 'event', event: 'ostium-visualized:RB3' },
          ],
        },
      },
    ],
    observe: {
      view: {
        sectionId: 'right-side',
        mode: 'guided-walk',
        profile: 'adult-teaching-combined-left-basal-v1',
        start: { kind: 'airway', label: 'BI', at: 'distal' },
        controls: ['advance', 'withdraw', 'rotate', 'deflect', 'recenter', 'reset'],
        assists: {
          'centerline-lock': true,
          'aim-guard': true,
          'branch-labels': false,
          'align-to-branch': false,
          recenter: true,
          'reference-orientation': true,
        },
        defaults: { branchLabels: false },
        readouts: ['currentAirway', 'parentage'],
        litAirways: ['BI', 'RML', 'RB4', 'RB5', 'RLL', 'RB6'],
        boundary: BOUNDARY,
      },
      goals: [
        {
          id: 'enter-lateral',
          label: 'Enter RB4, the lateral segment of the right middle lobe',
          test: { type: 'event', event: 'entered:RB4' },
        },
        {
          id: 'enter-medial',
          label: 'Enter RB5, the medial segment of the right middle lobe',
          test: { type: 'event', event: 'entered:RB5' },
        },
        {
          id: 'superior-from-lower-lobe',
          label:
            'After the middle lobe, return to the bronchus intermedius and enter RB6 from the right lower lobe',
          test: {
            type: 'event-sequence',
            events: ['entered:RML', 'withdrew-to:BI', 'entered:RLL', 'entered:RB6'],
          },
        },
      ],
      readouts: ['currentAirway', 'parentage'],
    },
  },

  prediction: {
    id: 'Q01',
    seedId: 'Q01',
    itemType: 'signal-recognition',
    situation:
      'During a supervised airway inspection, the trainee entered the right main bronchus from the main carina and advanced steadily without naming a branch on the way. The view now shows an opening in the anterior wall ahead, with the lumen continuing beyond it.',
    stem: 'Which structure is the scope in now?',
    choices: [
      {
        id: 'a',
        label: 'The right upper lobe bronchus',
        rationale:
          'The right upper lobe arises early from the right main bronchus, and a steady advance can go beyond its origin without entering it. Inside the upper lobe the view would show its segmental openings, not a lobar opening with the lumen continuing past it. Calling this airway the upper lobe is a documented novice error; ask which branch is already behind you.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'The bronchus intermedius',
        rationale:
          'Distal to the right upper lobe origin, the right-sided airway continues as the bronchus intermedius. From its distal end the middle lobe arises anteriorly and the lower lobe continues beyond it. It is a bronchus, not a lobe.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'The superior segment of the right lower lobe',
        rationale:
          'RB6 is a single segmental branch of the lower lobe, posteriorly directed near the level of the middle lobe origin. The anterior opening ahead is the middle lobe origin, which arises from the bronchus intermedius, not from a lower lobe segment.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'A separate intermediate lobe of the right lung',
        rationale:
          'The right lung has three lobes: upper, middle and lower. The airway between the upper lobe origin and the middle and lower lobes is a bronchus; no lobe of its own lies there.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The right main bronchus is short before the right upper lobe origin, so a steady advance can go beyond it unseen. Distal to that origin the airway is the bronchus intermedius, a bronchus rather than a lobe; from its distal end the middle lobe arises anteriorly and the lower lobe continues beyond it. From here the upper lobe origin is behind the tip, and it is found again by withdrawing to the right main bronchus.',
    objectiveIds: ['M08-O1'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
    ],
  },

  transfer: {
    id: 'N05',
    itemType: 'management-decision',
    situation:
      'Later in the same right-sided inspection, RB6 has been entered and left. Advancing down the right lower lobe, the trainee now sees three large openings ahead and names them the anterior, lateral and posterior basal segments. The trainee proposes to record the basal airways and move to the left side.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label:
          'Withdraw to a proximal view of the lower lobe and look for a separate medial basal origin',
        rationale:
          'RB7 may arise separately and earlier than the other basal branches, so it is seen from a more proximal view of the lower lobe, not from where three openings fill the screen. Withdrawing to that parent view is the same correction as for an upper lobe origin left behind.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Record the basal airways as complete, because the three openings ahead make up the basal group',
        rationale:
          'The basal group is a teaching grouping, not one division that shows all four basal segments together. Three large openings account for three segments and leave the medial basal unaccounted for.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'Advance into the largest of the three openings to look for the medial basal segment beyond it',
        rationale:
          'When the medial basal arises separately, its origin lies proximal to the three openings, so advancing into one of them takes the tip away from it. Advancing in search of an origin the view does not show is the reflex this section warns against; deeper in one basal bronchus, the medial basal stays unseen.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'Withdraw to the bronchus intermedius and look for the medial basal origin beside the middle lobe',
        rationale:
          'The medial basal is a lower lobe segment: when it arises separately, its origin lies within the lower lobe, proximal to the three openings. The medial airway near the middle lobe is RB5, a branch of the middle lobe itself; looking there mistakes one medial airway for another with a different parent.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The right basal group is an educational grouping, not a claim that four basal segments arise from one simultaneous division. RB7, the medial basal, may arise separately and early, and is easily left out when three large openings ahead look like the whole group. As with an upper lobe origin left behind, withdraw to a proximal view of the lower lobe, its parent, where the origin can be seen; nothing goes in the record that was not seen.',
    objectiveIds: ['M08-O4'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 47 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
    ],
    reviewItemIds: ['R06'],
    transferVariant:
      'A different airway and a later point in the survey: in the lower lobe’s basal airways, a medial basal origin already behind the tip, where the prediction asked about the airway beyond the upper lobe origin.',
  },

  practice: [
    {
      id: 'C11',
      manifestCaseId: 'C11',
      presentationTitle: 'Two openings where three were expected',
      situation:
        'A stable adult teaching model is being inspected under supervision. Inside what the trainee takes to be the right upper lobe, two segmental openings are visible rather than the expected three, and no apical opening is identified. The model also has a separate airway opening in the proximal trachea, and the instructor has supplied the model’s CT.',
      item: {
        id: 'C11',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Return to the parent airway and review the supplied CT to find which region the tracheal opening supplies',
            rationale:
              'The trifurcation is a reference, not proof that a third opening is hidden. Confirming the location from the parent and reviewing the CT for the region the tracheal opening supplies is how a missing branch is reconciled with an actual variant.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Probe with the tip where the third opening should be, to find a hidden apical branch',
            rationale:
              'No lumen is visible there, so probing drives the tip into mucosa: the critical error in this case. It risks the wall and cannot find an opening that is not there.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Label the larger of the two openings RB1, so that all three right upper lobe segments appear in the record',
            rationale:
              'Naming an opening to complete a list invents an identity. The larger opening belongs to whichever segment it actually supplies, and the apical supply may arise somewhere else entirely.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'Record RB1 twice: at the tracheal opening and at its usual place in the right upper lobe',
            rationale:
              'One supplied airway gets one identity. A second RB1 in the usual place invents an opening the model does not have; the record follows the verified topology.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The expected trifurcation is a reference, not proof that a third opening must be hidden. Confirm from the parent airway that the scope is in the right upper lobe, then review the CT with the instructor to find which region the tracheal opening supplies: in this model, the apical region. Not every tracheal bronchus supplies the same territory. Inspect that branch when it is accessible, give it one identity, and document the variant and any limits — no second RB1, and no label on an arbitrary opening.',
        objectiveIds: ['M08-O5'],
        claimClass: 'transcript-source',
        sourceRefs: [
          { sourceId: 'T11', location: { kind: 'time-span', start: '00:35:21', end: '00:37:00' } },
          { sourceId: 'T12', location: { kind: 'time-span', start: '00:09:15', end: '00:10:08' } },
        ],
        reviewItemIds: ['R07'],
      },
    },
    {
      id: 'mc-rb6-parentage',
      presentationTitle: 'A posterior opening at the middle lobe level',
      situation:
        'During a supervised right-sided inspection, the scope has come down the bronchus intermedius to the level of the middle lobe origin. A posteriorly directed opening is visible at about the same level. The trainee enters it and now has to name it in the record.',
      item: {
        id: 'mc-rb6-parentage',
        itemType: 'mechanism-interpretation',
        stem: 'How should the record name this airway?',
        choices: [
          {
            id: 'a',
            label: 'RB6, recorded under the right lower lobe',
            rationale:
              'A posteriorly directed branch near the middle lobe level is RB6, the superior segment. It belongs to the lower lobe, however close its opening sits to the middle lobe origin.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'RB6, recorded under the right middle lobe with RB4 and RB5',
            rationale:
              'The middle lobe divides into RB4, lateral, and RB5, medial. RB6 is not a third middle-lobe segment; entering the three in one sequence does not make them siblings.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'RB4, the superior segment of the right middle lobe',
            rationale:
              'RB4 is the lateral segment of the middle lobe, not a superior one. On the right, the superior segment is RB6, in the lower lobe.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'RB5, the medial segment of the right middle lobe',
            rationale:
              'RB5 is a branch inside the middle lobe, reached after entering it. Nearness on the screen does not give an opening’s parent; its origin and its direction in the patient do.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The middle lobe arises anteriorly or anterolaterally and divides into RB4, lateral, and RB5, medial. RB6, the superior segment, is posteriorly directed near the middle lobe level but arises from the lower lobe; where it sits on the screen depends on shaft rotation. The record names an airway by its parent.',
        objectiveIds: ['M08-O3', 'M08-O2'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 66, to: 67 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
        ],
      },
    },
  ],
}
