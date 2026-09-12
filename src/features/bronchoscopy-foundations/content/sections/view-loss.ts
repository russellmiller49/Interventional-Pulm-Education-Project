import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M06 (second half) — Recovery of a usable view. The section that teaches the diagnostic grammar:
 * a lost view is a sign with a differential (red-out, obscured lens, white-out, dark field, clear
 * but lost), named before any control moves. The routine recovery, and the two things that change
 * it (a deployed accessory, a scope holding back a bleed). Knowledge spec §5.3–§5.4, §5.6, §16.7
 * (S1 PDF 89–99; S2 PDF 44–47, 106–107; T11; T09; T06), drill D09, seed Q04, case C02.
 */
export const section: BronchSectionDefinition = {
  id: 'view-loss',
  title: 'Losing the view',
  shortTitle: 'View loss',
  minutes: 9,
  moduleIds: ['M06'],
  objectives: [
    {
      objectiveId: 'M06-O3',
      subtask:
        'Commits the next move for a close red field during a stable inspection with nothing deployed, then recovers a scripted red field and a smeared lens in the model, each by its own recovery.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M06-O4',
      subtask:
        'Commits a recovery for a clear view of an airway that cannot be named while a brush is exposed, accounting for the accessory before the scope is withdrawn; the exception, a scope holding back a bleed, is named after commitment and committed in the bleeding-priorities section; the practice case retraces a left-sided misidentification to the last certain parent.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D09'],
  prerequisites: ['five-controls', 'branch-entry', 'reference-frames'],

  clinicalQuestion:
    'When the bronchoscope view no longer shows a lumen you can name, what decides the next move?',
  recognizeTitle: 'A red field partway down the trachea',
  objective:
    'Distinguish the causes of a lost bronchoscope view from what the field shows, and choose a recovery that fits both the cause and what the scope is doing at the time.',
  why: 'A usable view can be lost at any moment of an examination. What recovers it depends on why it was lost, and on what the scope was doing at the time.',
  newConcept:
    'A lost view is a sign with a differential: name what the field shows — a close red field, a smeared lens, a white-out, a dark field, or a clear view of an airway you cannot name — before any control moves, because each has its own recovery and forward movement fixes none of them.',
  incrementSentence:
    'This section adds one idea to the five controls and the entry sequence: when the view is lost, stop and name what the field shows before choosing a control — the control that fits it, or none.',
  harmfulReflex:
    'Pushing forward into a field with no visible lumen, or suctioning with the lens against the wall, to get the view back.',
  anchor: {
    analogy:
      'A windscreen can go blank for different reasons — you have pulled up against a wall, it is splashed with mud, the sun is in your eyes, the headlights have gone out, or the road is clear but you have lost the map — and pressing the accelerator fixes none of them.',
    precise:
      'A close red field, a smeared lens, a white-out, a dark field and a clear view of an unnamed airway are five different problems, each with its own shortlist in Reading the view. Recovery ends when a lumen is in view and the airway can be named from landmarks and the branches already travelled.',
    checklistLabel: 'When the view is lost',
    checklist: [
      'Stop moving forward',
      'Name what the field shows',
      'Check the patient and what the scope is doing: a change in breathing or oximetry, an accessory out, or a wedge holding back a bleed',
      'Recover to a lumen you can see and an airway you can name',
    ],
  },

  spineStops: ['trachea', 'carina'],
  grammarRowIds: ['red-out', 'lens-obscured', 'white-out', 'dark-field', 'clear-but-lost'],
  controlStrip: {
    verdict: 'this-control',
    states: {
      insertion: 'this-one',
      rotation: 'not-this-one',
      deflection: 'this-one',
      suction: 'harmful-reflex',
      accessory: 'not-this-one',
    },
    sentence:
      'Two controls recover this view: insertion and withdrawal, used here only to withdraw a little, and distal deflection, eased off the wall. Suction is the tempting reflex and draws the wall onto the tip; advancing presses the lens further into it. Shaft rotation and the accessory state do not change it.',
  },
  precommitDenyPatterns: [
    /\bwithdraw\w* (slightly|a little)\b/i,
    /\beas(e|es|ing) (any|the) bend\b/i,
    /\bstop(s|ping)? (advancing|advancement|forward movement|moving forward)\b/i,
    /\blens (is |was )?(against|on) the (mucosa|wall)\b/i,
    /\bwall contact\b/i,
    /\bcolou?r alone\b/i,
  ],
  modelBoundary:
    'The bronchoscope view is a teaching model of the adult airway, and each change in the view on these steps is scripted. The model does not represent tissue or force, and nothing it records is a measure of injury or skill. The patients in the items are constructed for teaching.',
  physicalSkillNote:
    'Recovering a view is a hand skill. The app records what the scope did from keyboard, pointer or touch input; it cannot see the hands, the force used or the patient’s response, which faculty observe in the model and in supervised practice.',
  localPolicyIds: ['scope_ifu', 'bleeding_rescue'],
  reviewItemIds: ['R04', 'R34'],

  blocks: [
    {
      id: 'lumen-disappears',
      kind: 'question',
      role: 'framing',
      heading: 'When the lumen disappears',
      body: 'Partway through an examination, the airway you were following is suddenly gone from the bronchoscope view. What the screen shows instead is itself information: a color, a glare, a darkness, or a clear airway that does not match the plan.\n\nThis section is about reading that picture, and the situation around it.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      ],
    },
    {
      id: 'what-to-read',
      kind: 'signals',
      role: 'signals',
      heading: 'What the screen and the room can show',
      body: 'When the lumen disappears, the screen and the room still carry information. Each of these can be read from one or the other.',
      pointsLabel: 'What can be read when the view is lost',
      points: [
        'What fills the field: its color, its brightness, and whether anything is in focus',
        'Whether any airway structure is still visible: a lumen, rings or a carina',
        'What the scope was doing when the view changed',
        'Whether an accessory is out of the channel, and whether anything has been sampled',
        'The patient’s breathing and oximetry, against this patient’s own start',
        'The last airway you named with certainty',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      ],
    },
    {
      id: 'usable-view',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A usable view',
      body: 'A usable view shows an open lumen with its walls in focus and the next landmark ahead. In the trachea that means cartilage rings that can be followed into the distance, the posterior membranous wall, and the main carina coming into view as the tip advances. The still with this block shows the rings running ahead into an open lumen. It is usable because the airway can be named from its landmarks and the branches already travelled, not only because the picture is sharp.',
      media: { kind: 'endoscopic-still', structureId: 'trachea', outline: false },
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
      ],
    },
    {
      id: 'one-sign-five-problems',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'One sign, five problems',
      body: 'A lost view is a sign, not a diagnosis. The five rows in Reading the view are its differential: a close red field, a smeared lens, a white-out, a dark field, and a clear view of an airway you cannot name. They join the row met in branch entry, a turn of the control section that does not reach the tip. Two questions narrow them. First: is the image unusable, or clear but unnamed? Then, for an unusable image: could the cause lie in front of the lens, on it, or in the imaging system? A white-out or a dark field can arise in more than one of these places, so the shortlist for each covers both the tip’s position and the imaging system.\n\nThe same control can be the answer in one row and the harmful reflex in another. Controlled suction can clear a smeared lens in a position already confirmed; in a red field against the wall it draws mucosa onto the tip. How a lens is cleared and how the image settings are checked follow the device’s instructions.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
      ],
      localPolicyIds: ['scope_ifu'],
    },
    {
      id: 'recovery-routine',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The recovery routine, worked',
      body: 'The course practices one routine for recovering a view and orientation, worked here through the red field in the trachea. In a patient, a view that cannot be recovered promptly, or repeated trauma, is a reason for the supervisor to take over, not for more attempts.',
      pointsLabel: 'The red field, step by step',
      points: [
        'The operator says aloud that the view is lost.',
        'Forward movement stops.',
        'The accessory and patient check: no accessory is out of the channel, and breathing and oximetry are unchanged from the start.',
        'Any bend is eased and the scope withdrawn slightly, under control, until a lumen and a landmark return.',
        'The airway is named from its landmarks: here the rings, and the carina ahead.',
        'The destination is stated — the main carina — and the scope advances again along the visible lumen.',
      ],
      claimClass: 'design',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      ],
    },
    {
      id: 'accessory-out',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'An accessory out of the channel',
      body: 'The recovery routine checks for an accessory before any withdrawal, because a tool out of the channel changes what may move. The tool is returned to its protected state — forceps closed, brush retracted fully into its sheath, needle retracted into its assembly — and that state is confirmed before the tool comes back through the scope.\n\nRetracting a tool slightly in the airway is not the same as withdrawing it through the channel; say which is meant. Loading, extending and checking accessories has its own section.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 130 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 24 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 148, to: 149 } },
      ],
    },
    {
      id: 'scope-holding-a-bleed',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'A scope holding back a bleed',
      body: 'A red field after sampling, with the tip wedged in the sampled segment, is a different problem from a red field during routine travel.\n\nName what the scope is doing before changing it: the recovery routine is not applied to a scope holding back a bleed simply because the image is red. Blood burden and ventilation decide the immediate action, which is taught in its own section; the institution’s bleeding response applies.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T09', location: { kind: 'time-span', start: '00:25:10', end: '00:33:41' } },
        { sourceId: 'T06', location: { kind: 'time-span', start: '00:11:25', end: '00:12:57' } },
      ],
      localPolicyIds: ['bleeding_rescue'],
      reviewItemIds: ['R34'],
    },
    {
      id: 'darkness-not-a-direction',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Darkness is not a direction',
      body: 'One inspection lecture uses darkness as a cue toward the open lumen and stresses smooth progress through the upper airway. Darkness alone can also be shadow, fluid, a blocked view or a space not yet recognized. The course wording is: identify a patent path from visible anatomical boundaries, and advance gently only while that path stays clear. Losing the path, resistance, new bleeding or a change in the patient overrides any habit of forward progress.',
      claimClass: 'review-flag',
      sourceRefs: [
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:06:39', end: '00:08:43' } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
      ],
      reviewItemIds: ['R04'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors reads a lost view as something it is not.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Reading a red field as bleeding: red color alone does not prove hemorrhage; ask what the scope was just doing.',
        'Suctioning a close red field from wall contact: suction draws the wall onto the tip; come off the wall first. Blood or secretion on the lens is a different row, where controlled suction can help.',
        'Reading a smeared lens as a blocked airway: in a position already confirmed, clear the lens.',
        'Treating white-out as a diagnosis: recover working distance and check the imaging system.',
        'Advancing into a dark field in search of light: withdraw to a known view and check the system.',
        'Trusting a sharp image you cannot name: stop, name the last certain landmark, and return to the parent.',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
      ],
    },
  ],

  workspace: {
    kind: 'scope',
    view: {
      sectionId: 'view-loss',
      mode: 'free-drive',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'TR', at: 'mid' },
      controls: [],
      assists: {},
      script: 'red-out',
      litAirways: ['TR'],
      boundary:
        'A teaching model of the adult airway. The view here is scripted for teaching and labeled as scripted; the model does not represent tissue, force or the patient.',
    },
  },

  steps: {
    recognize: {
      instruction:
        'Compare the still under “A usable view” in the Teaching panel with the bronchoscope view in the Simulator panel: what fills the field now, and what can no longer be seen.',
      lookIn: {
        pane: 'teaching',
        landmark: 'A usable view',
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.scopeView,
      },
    },
    act: {
      title: 'Back to a usable view',
      instruction:
        'Use the scope controls under the view to bring the lumen back, then go on to the main carina. The goals on this card tick as each is met; if one stops holding, reset and begin again. The readouts under the controls count contacts and lost views as feedback, not as a measure of injury.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    observe: {
      title: 'The image changes in the lower trachea',
      instruction:
        'The tip is in the lower trachea, a position already confirmed, and the image has changed. Name what the field shows, then bring a usable view back with the scope controls under the view; the readouts under the controls show where the tip is.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'Reading a lost view',
      instruction: `Read ${TEACHING_LANDMARKS.adds}, ${TEACHING_LANDMARKS.grammar} and “An accessory out of the channel” in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: {
      sectionId: 'view-loss',
      mode: 'free-drive',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'TR', at: 'mid' },
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'suction', 'reset'],
      assists: {},
      readouts: ['contactCount', 'lossOfViewCount'],
      script: 'red-out',
      litAirways: ['TR'],
      boundary:
        'A teaching model of the adult airway. The red field is scripted: the surface is illustrative and does not model tissue behavior, force or injury, and its counts of contacts and lost views are feedback, not a measure of trauma or skill.',
    },
    goals: [
      {
        id: 'lumen-back-without-advancing',
        label: 'Bring the lumen back into view without advancing while the field is red',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'red-out-recovered' },
            { type: 'without', event: 'advanced-in-red-out' },
          ],
        },
      },
      {
        id: 'lumen-back-without-suction',
        label: 'Keep suction off until the lumen is back in view',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'red-out-recovered' },
            { type: 'without', event: 'suction-in-red-out' },
          ],
        },
      },
      {
        id: 'on-to-the-carina',
        label: 'Then advance along the visible lumen to the main carina',
        test: { type: 'event-sequence', events: ['red-out-recovered', 'reached-carina'] },
      },
    ],
    observe: {
      view: {
        sectionId: 'view-loss',
        mode: 'free-drive',
        profile: 'adult-teaching-combined-left-basal-v1',
        start: { kind: 'airway', label: 'TR', at: 'distal' },
        controls: ['advance', 'withdraw', 'rotate', 'deflect', 'suction', 'clearLens', 'reset'],
        assists: {},
        readouts: ['currentAirway'],
        script: 'lens-contamination',
        litAirways: ['TR'],
        boundary:
          'The change in the image is scripted: the model does not represent secretions, blood, suction flow or any device’s lens-clearing mechanism.',
      },
      goals: [
        {
          id: 'lens-cleared-without-advancing',
          label: 'Bring a usable view back without advancing while the image is obscured',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'lens-cleared' },
              { type: 'without', event: 'advanced-blind' },
            ],
          },
        },
      ],
      readouts: ['currentAirway'],
    },
  },

  prediction: {
    id: 'Q04',
    seedId: 'Q04',
    itemType: 'management-decision',
    situation:
      'During a supervised airway inspection under moderate sedation, the operator is advancing down the trachea toward the main carina. No accessory is in the channel and nothing has been sampled. Moments after the last advance, the bronchoscope view fills with a poorly defined pink-red field: no lumen, rings or carina can be seen. Breathing, capnography and oximetry are unchanged from the start.',
    stem: 'What is the best next move?',
    choices: [
      {
        id: 'a',
        label:
          'Apply suction to clear the red from the lens, then look again before moving the tip',
        rationale:
          'Nothing in the scene says the lens is soiled: the red appeared as the tip moved forward, not in a position already confirmed. Suction with the lens against mucosa draws more of the wall onto the tip; it is the reflex this red field tempts, and it keeps the view lost.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label:
          'Stop advancing and withdraw slightly, easing any bend, until a lumen is back in view',
        rationale:
          'The field turned red just after an advance, with no lumen in view, nothing deployed, nothing sampled and a stable patient. That pattern often means the lens is against the tracheal wall; coming back off it restores the lumen without adding force.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label:
          'Treat the red field as bleeding: hold the scope where it is, stop, and call the supervisor for help',
        rationale:
          'Red color by itself does not prove hemorrhage, and nothing here suggests one: nothing has been sampled, no accessory is out and the patient is stable. Telling the supervisor is reasonable, but holding still leaves the lens against the wall when a small withdrawal would restore the view. Holding position belongs to a scope that is containing a bleed, which is a different situation.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Keep advancing gently in the same direction until a darker lumen opens up ahead',
        rationale:
          'With no lumen in view, advancing is movement without vision: it presses the lens further into the wall and can injure the mucosa. A darker patch is not a direction; advance only along an airway you can see.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'A close, poorly defined red field that appears just after an advance — with no accessory out, nothing sampled and a stable patient — often means the lens is against the mucosa: wall contact. Red color alone does not prove hemorrhage. Stop advancing, ease any bend and withdraw slightly until the lumen returns; suction would draw the wall onto the tip, and advancing presses the lens further into it.',
    objectiveIds: ['M06-O3'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
    ],
    reviewItemIds: ['R04'],
  },

  transfer: {
    id: 'view-loss-transfer',
    itemType: 'management-decision',
    situation:
      'During a supervised inspection under moderate sedation, the operator has brought a brush toward a planned right upper lobe segment and exposed it from its sheath. Before brushing, the operator realizes that the airway in view, sharp and well lit, may not be the planned segment, and cannot name it. Breathing and oximetry are unchanged from the start.',
    stem: 'What should happen next?',
    choices: [
      {
        id: 'a',
        label:
          'Brush now, since the image is sharp and the tip was steered toward the planned segment',
        rationale:
          'A sharp image shows where the lens faces, not which airway it is. A sample from an airway that cannot be named may come from a site other than the one planned; identity comes from the parent airway.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label:
          'Withdraw the scope to the last airway named with certainty, leaving the brush out ready to sample again',
        rationale:
          'Going back to the last certain airway is the recovery this view needs, but the brush is still exposed as the scope moves. It goes back into its sheath first, and that protected state is confirmed before the scope is withdrawn.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Stop, retract the brush into its sheath, and withdraw the scope to the last airway named with certainty',
        rationale:
          'The image is clear, so the problem is where the tip is, not the lens or the wall. Stopping, protecting the brush before the scope moves back, and returning to the last certain landmark lets the segment be named from its parent before any sample is taken.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label:
          'Keep the brush out and advance a little further, since the next division may make the segment recognizable',
        rationale:
          'Advancing while the airway is unnamed goes deeper into an unidentified branch, with an exposed brush at the tip. Identity comes from the parent airway, not from the next division.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'A clear image is not the same as knowing where the tip is: this is anatomical uncertainty, not a lens, light or wall problem. The recovery is to stop, name the last certain landmark and withdraw the scope to a recognizable parent — and because the brush is exposed, it goes back into its sheath before the scope is withdrawn. Advancing, or sampling, from an airway that cannot be named risks a site other than the one planned.',
    objectiveIds: ['M06-O4', 'M06-O3'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 128 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23 } },
    ],
    transferVariant:
      'A clear image rather than a red one, near a planned right upper lobe segment rather than in the trachea, before brushing with the brush exposed: a different row of the same differential, and a recovery that has to account for the accessory.',
  },

  practice: [
    {
      id: 'C02',
      manifestCaseId: 'C02',
      presentationTitle: 'Two openings during a left-sided model examination',
      situation:
        'During a model examination, a learner sees two openings and calls the view the left lower lobe. The navigation so far places the tip within the lingular division. No accessory is deployed.',
      item: {
        id: 'C02',
        itemType: 'management-decision',
        stem: 'What should the learner do next?',
        choices: [
          {
            id: 'a',
            label:
              'Keep the lower lobe name, because two openings fit the lower lobe at least as well as the lingula',
            rationale:
              'The number of visible openings does not identify an airway. Identity comes from parentage: the bronchus the tip came through to reach this view.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label:
              'Advance into the larger opening to confirm that it leads on to the basal segments',
            rationale:
              'Advancing while asserting a name the history contradicts is the critical error in this case: each step goes further into an airway that has not been identified.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Use automatic repositioning to place the tip in the lower lobe, then carry on from there',
            rationale:
              'Automatic repositioning is an assist and is recorded as one; it moves the tip without correcting the learner’s own map. The mistake was a landmark error, and only retracing and re-identifying corrects it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'Pause, withdraw to the left main bronchial division, and re-identify from there',
            rationale:
              'The navigation history contradicts the call. The left main bronchial division is the last certain landmark; from it the upper lobe, its upper division and the lingula can be re-identified, and the two openings named by parentage.',
            plausibility: 'best',
          },
        ],
        explanation:
          'A clear image is not the same as knowing where the tip is. Identity comes from parentage: the path ran through the left upper lobe into the lingular division, while the lower lobe arises where the left main bronchus divides. Retracing to that division re-establishes the last certain landmark, and the two openings can then be named from the bronchus that leads to them.',
        objectiveIds: ['M06-O4'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
        ],
      },
    },
    {
      id: 'mc-dark-field',
      presentationTitle: 'The image darkens during a lower lobe inspection',
      situation:
        'During a supervised inspection under moderate sedation, the operator steers into a small segmental bronchus of the left lower lobe for a distal look. The image darkens: the walls at the edge of the field are faint and no lumen can be made out ahead. A moment earlier, in the lower lobe bronchus, the image was bright and clear. Breathing and oximetry are unchanged from the start.',
      item: {
        id: 'mc-dark-field',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Withdraw to the last airway seen clearly, and look again from there before going on',
            rationale:
              'The image was bright a moment ago and darkened as the tip entered a small segment. Withdrawing to the known view restores a usable view and, if that airway is bright again, shows the light and video are working.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Hold the tip where it is and check the light source and video connections first',
            rationale:
              'Checking the system belongs on the shortlist, but the image darkened as the tip entered a narrow space, and holding still leaves it there. Withdrawing first also checks the system.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'c',
            label:
              'Advance gently toward the darkest part of the field, where the lumen is likely to open up',
            rationale:
              'Darkness alone can be shadow, fluid, a blocked view or a space not yet recognized. A dark field is not permission to advance in search of light; advance only along a patent airway you can see.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Apply suction to clear whatever is blocking the view, then continue the distal look',
            rationale:
              'Darkness can hide fluid or a blocked view, but suction cannot show which: in a small segment it draws the wall onto the tip and can collapse the airway. Restore a usable view first, then decide whether anything needs clearing.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A dark field has a differential: inadequate illumination, a light or video system that is disconnected or not working, a tip directed into a narrow space, or a true obstruction. Here the image was bright in the larger airway a moment ago and darkened as the tip entered a small segment, so withdrawing to that known view both restores a usable view and checks the system. A dark field is not permission to advance in search of light.',
        objectiveIds: ['M06-O3'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
        ],
        reviewItemIds: ['R04'],
      },
    },
  ],
}
