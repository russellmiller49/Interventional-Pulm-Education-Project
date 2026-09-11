import type { ScopeViewSpec } from '../../components/scope/types'
import type { SourceRef } from '../../data/sources'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M05, first half — Ergonomics and the five controls. The foundation section of the Handle phase:
 * before any branch is entered, the learner separates what each control at the scope changes and
 * predicts what turning the control section does to the image and to the bending plane. Knowledge spec
 * §4.1–§4.5 (S1 PDF 89–93, 95, 98–99; S2 PDF 44–47, 106–107; S3 PDF 80; T10 00:06:57–00:09:28;
 * T11 00:01:47–00:05:01), §3.1 (S1 PDF 89–97) and drills D02 and D16.
 *
 * Branch entry, the clamped or looped shaft and forward drift belong to `branch-entry`, which
 * retrieves this section's idea in its transfer.
 */

// ── Citations, exactly as the knowledge spec's brackets give them ────────────────────────────────

/** §4.2 fundamental motions [S1, PDF 89–93, 98–99; S2, PDF 44–47, 106–107]. */
const S1_MOTIONS: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } }
const S1_98: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } }
const S2_44: SourceRef = { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } }
const S2_106: SourceRef = { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } }
/** §4.1 setup and grip [S1, PDF 89–90, 95, 98–99; S2, PDF 106–107] and [S1, PDF 89–90; S3, PDF 80]. */
const S1_SETUP: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 90 } }
const S1_95: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } }
const S3_80: SourceRef = { sourceId: 'S3', location: { kind: 'pdf-pages', from: 80 } }
/** §20.2 core practice drills, D02 [S2, PDF 23–25, 44–47, 100–117; S3, PDF 35–42, 79–83]. */
const S3_79: SourceRef = { sourceId: 'S3', location: { kind: 'pdf-pages', from: 79, to: 83 } }
/** §3.1 components: the lever deflects; rotation of the assembly changes the plane [S1, PDF 89–97]. */
const S1_COMPONENTS: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 89, to: 97 },
}
/** §4.5 the three-motion teaching sequence [T10, 00:06:57–00:09:28; T11, 00:01:47–00:05:01]. */
const T10_MOTIONS: SourceRef = {
  sourceId: 'T10',
  location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' },
}
const T11_COACHING: SourceRef = {
  sourceId: 'T11',
  location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' },
}

// ── The bench (drill D02) ────────────────────────────────────────────────────────────────────────

const BENCH_VIEW: ScopeViewSpec = {
  sectionId: 'five-controls',
  mode: 'controls-isolated',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'bench' },
  controls: ['rotate', 'deflect', 'advance', 'withdraw', 'reset'],
  assists: {},
  readouts: ['depthMm', 'rotationDeg', 'deflectionDeg'],
  boundary:
    'The tip rests on a bench, outside any airway, and keyboard, pointer or touch commands stand in for the hands. The weight and feel of the scope, and what suction actually draws, are not represented.',
}

export const section: BronchSectionDefinition = {
  id: 'five-controls',
  title: 'The five controls at the scope',
  shortTitle: 'Five controls',
  minutes: 8,
  moduleIds: ['M05'],
  objectives: [
    {
      objectiveId: 'M05-O1',
      subtask:
        'Decides, in a practice case, what to reset first when a trainee follows the image by walking around the bed with a raised elbow; the working position itself is observed at a faculty model station.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M05-O2',
      subtask:
        'Predicts what turning the control section does to the image and the bending plane, then uses rotation, deflection, advancement and withdrawal, and suction one at a time at the bench; the hands are observed at the faculty stations.',
      evidence: 'observed-physical-skill-required',
    },
  ],
  drillIds: ['D02', 'D16'],
  prerequisites: ['shared-airway', 'pre-use-check'],

  clinicalQuestion:
    'When one control at the bronchoscope moves, what changes at the tip and in the image?',
  recognizeTitle: 'The bronchoscope tip on a bench',
  objective:
    'Predict what each control at the scope will change at the tip, in the image and in the working channel, before moving it.',
  why: 'Novices often advance, rotate and bend at once, then cannot tell which movement changed the view. Knowing what each control does on its own is what makes a later movement deliberate.',
  newConcept:
    'Aiming the tip takes two controls working together: shaft rotation turns the camera and the plane the tip bends in, and distal deflection bends the tip within that plane; insertion changes depth, not aim.',
  incrementSentence:
    'This section adds one idea to the scope you checked before use: the tip is aimed by two controls together — rotation chooses the plane, deflection bends within it — while insertion only changes depth.',
  harmfulReflex:
    'Pushing the scope forward toward an opening the tip is not yet aimed at, and letting the airway wall redirect it, instead of aiming the tip first with rotation and deflection.',
  anchor: {
    analogy:
      'A desk lamp with a single hinge folds only one way. To aim it at something off to the side, you turn the base until the target lies in the line of the hinge, then fold.',
    precise:
      'Shaft rotation turns the camera and the bending plane together; distal deflection bends the tip within that plane, which keeps a fixed place in the image (top to bottom on the teaching scope; on another model, as its instructions for use give); insertion and withdrawal change depth, not aim.',
    checklistLabel: 'Before moving a control, name what it will change',
    checklist: [
      'Insertion and withdrawal: depth, not aim',
      'Shaft rotation: the image and the bending plane, together',
      'Distal deflection: the bend, within that plane',
      'Suction: what the channel draws, not where the tip is',
    ],
  },

  spineStops: [],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'this-control',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'Shaft rotation is the control here: it turns the camera and the bending plane together. Deflection bends only within that plane, and advancing changes depth, not aim — pushing forward toward an opening the tip is not yet aimed at is the reflex to resist.',
  },
  precommitDenyPatterns: [
    /plane turns on the bench/i,
    /lens and the bending section/i,
    /rotation turns the camera/i,
    /(camera|image) and the (bending )?plane/i,
    /shaft rotation/i,
  ],
  modelBoundary:
    'The bench in this section is a keyboard, pointer and touch model of one teaching scope. It does not reproduce the weight or feel of the instrument, the resistance of the lever, torque transmission along a real shaft in a curved airway, or suction behavior: what the channel actually draws, or the wall drawn onto the tip. Goals met here show the idea, not the hands; the hands are observed by faculty at a model station.',
  physicalSkillNote:
    'The app sees keyboard, pointer or touch commands, not hands. The working position, the grip on the control section, the turn of the control section, thumb deflection, the index finger on suction and depth control at the entry point are observed by faculty at a model station: isolated controls with the tip protected on a bench, and three-motion coaching with an external observer, who watches both hands and the image while the learner fixes an inefficient movement and explains the fix. Goals met in this section are not evidence of those skills.',
  localPolicyIds: ['scope_ifu'],
  reviewItemIds: ['R03'],

  blocks: [
    {
      id: 'what-the-hands-change',
      kind: 'question',
      role: 'framing',
      heading: 'What the hands can change',
      body: 'A flexible bronchoscope is steered from outside the patient. One hand holds the control section — the handle; the other guides the insertion tube and manages depth near the entry point. The tip is at the far end, out of reach, and its movements start as movements of these hands.\n\nAt the scope you control five things, and the image and the patient are monitoring. This section takes the controls one at a time and asks what each one changes.',
      claimClass: 'synthesis',
      sourceRefs: [S1_SETUP, S1_COMPONENTS, S2_44],
    },
    {
      id: 'what-to-watch',
      kind: 'signals',
      role: 'signals',
      heading: 'What to watch at the bench',
      body: 'With the tip on a bench, the effect of each movement can be seen before it matters in a patient. Before moving a control, say which of these you expect it to change.',
      pointsLabel: 'What can change when one control moves',
      points: [
        'The image in the bronchoscope view',
        'The bend of the tip: straight or bent, and how far',
        'How far the tip has been advanced: its depth',
        'Whether anything is drawn through the working channel',
      ],
      claimClass: 'design',
      sourceRefs: [S2_44],
    },
    {
      id: 'working-position',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A working position that allows control',
      body: 'The patient, bed, monitor, tower and assistant are arranged before insertion. The monitor can be watched without holding the neck turned, the working height lets the shoulders relax, cables do not pull on the handle or cross the working area, and the shaft follows a smooth, manageable path rather than forming a large loop. The patient’s face and eyes are not a fulcrum.\n\nThe usual setup puts the control section in the left hand, the thumb on the deflection lever and the index finger free for the suction valve, while the other hand manages depth near the entry point. Either hand may hold the control section. A grip is acceptable when it keeps steering, suction, depth control, protection of the scope and the assistant’s access.',
      media: {
        kind: 'scope-photo',
        imageId: 'full-scope',
        highlight: 'full-scope-control-section-1',
      },
      claimClass: 'synthesis',
      sourceRefs: [S1_SETUP, S1_95, S1_98, S2_106, S3_80],
      reviewItemIds: ['R03'],
    },
    {
      id: 'what-each-control-changes',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What each control changes',
      body: 'Each control has its own effect, and two of them together aim the tip: rotation chooses the plane, and deflection bends within it. The lens and the bending section both sit in the tip, so turning the control section turns the camera and the bending plane together relative to the airway: the picture turns on the screen, and the plane keeps its place in the image.\n\nHow far the tip bends, how the bending plane lies in the image, and whether a scope has a rotary function like the one named in the pre-use check differ between models and come from that scope’s instructions for use.',
      pointsLabel: 'The five controls, and what each changes',
      points: [
        'Insertion and withdrawal: the depth of the tip. Advance in small steps while looking along the airway. Withdrawal is an active steering task: coming back out of an angled branch, the bend is released as the tip withdraws, and a small withdrawal often gives the room to see a branch point and redirect. Depth alone does not change which way the tip faces.',
        'Shaft rotation: the orientation of the camera and of the one plane the tip bends in. The image turns; the anatomy does not. The insertion hand guides the shaft rather than clamping it against the turn, and a large loop in the shaft can absorb the turn before it reaches the tip; twisting against a held or constrained shaft gives poor control and can damage the scope.',
        'Distal deflection: the bend of the tip within that plane, on the teaching scope toward the top or the bottom of the image. Lever movement is not left or right in the patient.',
        'Suction: what is drawn through the working channel. It does not move the tip.',
        'Accessory state: what is exposed at the tip. It is taught with the sampling tools.',
        'The image and the patient: monitoring, not settings.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_COMPONENTS, S1_MOTIONS, S1_98, S2_44, S2_106],
      localPolicyIds: ['scope_ifu'],
    },
    {
      id: 'bench-sequence',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The bench sequence, worked',
      body: 'The teaching sequence separates the movements before combining them, and asks for a prediction before each one. Worked through at the bench in this section:',
      pointsLabel: 'One movement at a time',
      points: [
        'Hold the depth and turn the control section through a small, comfortable range: the image turns.',
        'Hold the rotation and move the lever: the tip bends toward the top or the bottom of the image, in one plane only.',
        'Keep the bend and turn the control section again: the bend is carried around into a new plane.',
        'Release the lever, keep the rotation, then advance and withdraw: the depth changes and the tip keeps facing the same way. In an airway, the bend is released as the tip comes back out of an angled branch.',
        'Apply and release suction: the channel draws, and the tip does not move.',
        'Only then combine two controls, and after that enter a branch.',
      ],
      claimClass: 'design',
      sourceRefs: [T10_MOTIONS, T11_COACHING, S1_MOTIONS, S2_44],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these lets one control stand in for another, or lets the body stand in for the hands.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Advancing, rotating and fully bending at once: when the view changes, no one can tell which movement did it. Move one control, watch, then the next.',
        'Steering the control section like a joystick, or sweeping it sideways: that moves the shaft, not the tip’s plane. Rotate the control section instead.',
        'Treating the lever as left or right in the patient: it bends the tip in one plane of the image. Rotation chooses the plane.',
        'Pushing forward to reach an opening outside the bending plane: advancing changes depth, not aim. Turn the plane onto the opening first.',
        'Lifting the elbow and walking around the bed to follow the image: reset the working height and stance, and turn from the hand and forearm.',
        'Holding one elbow angle or one grip as the only acceptable one: adapt to handedness, body, bed and scope; the aim is relaxed, controlled movement.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_MOTIONS, S1_98, S2_106, T10_MOTIONS, T11_COACHING],
      reviewItemIds: ['R03'],
    },
    {
      id: 'faculty-station',
      kind: 'boundary',
      role: 'boundary',
      heading: 'What only a faculty station can show',
      body: 'Two stations for this section are run by faculty with a physical scope. At the isolated-controls station the tip is protected on a bench and each movement is shown on its own. At the three-motion coaching station an instructor introduces excess shaft curvature or a clamped insertion hand at a model bifurcation, and an external observer watches both hands and the image while the learner isolates advancement, rotation and deflection, corrects the inefficient motion, reaches the intended branch smoothly without forward drift, and explains the correction. Advancing against the wall to make up for ineffective rotation is the critical error.\n\nThe app sees commands, not hands. A goal met on the bench here shows the idea; the faculty station shows the skill.',
      claimClass: 'design',
      sourceRefs: [S2_44, S3_79, T10_MOTIONS, T11_COACHING],
    },
  ],

  workspace: { kind: 'scope', view: BENCH_VIEW },

  steps: {
    recognize: {
      instruction: `In the Simulator panel, look at ${SIMULATOR_LANDMARKS.scopeView}: the tip rests on a bench, outside any airway, and ${SIMULATOR_LANDMARKS.controls} stay locked until you commit. Then read ${TEACHING_LANDMARKS.purpose} and the blocks under it, in the Teaching panel.`,
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.scopeView,
        alsoPane: 'teaching',
        alsoLandmark: TEACHING_LANDMARKS.purpose,
      },
    },
    act: {
      title: 'One control at a time',
      instruction: `With ${SIMULATOR_LANDMARKS.controls}, turn the control section with the tip straight, move the lever, then turn the bent tip again the same way, watching ${SIMULATOR_LANDMARKS.scopeView}, ${SIMULATOR_LANDMARKS.readouts} and ${STEPS_LANDMARKS.goals}. The depth must not change: if the tip is advanced or withdrawn, press reset and begin again.`,
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    observe: {
      title: 'Depth and suction on their own',
      instruction: `The tip now starts turned, with the lever released. With ${SIMULATOR_LANDMARKS.controls}, advance and withdraw it, then apply and release suction, and in ${SIMULATOR_LANDMARKS.readouts} note which values change and which stay where they were.`,
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'Aiming the tip',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and ${TEACHING_LANDMARKS.strip} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: BENCH_VIEW,
    goals: [
      {
        id: 'turn-the-control-section',
        label:
          'With the tip straight, turn the control section and watch the bronchoscope view turn',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'control-used:rotation' },
            { type: 'metric', metric: 'rotationDeg', op: 'abs>=', value: 30 },
          ],
        },
      },
      {
        id: 'move-the-lever',
        label: 'Move the lever and watch the bronchoscope view swing toward its top or bottom edge',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'control-used:deflection' },
            { type: 'metric', metric: 'deflectionDeg', op: 'abs>=', value: 30 },
          ],
        },
      },
      {
        id: 'turn-the-bent-tip',
        label: 'Keep the tip bent and turn the control section again, with the depth unchanged',
        test: {
          type: 'all',
          tests: [
            {
              type: 'event-sequence',
              events: ['control-used:rotation', 'control-used:deflection', 'control-used:rotation'],
            },
            { type: 'metric', metric: 'deflectionDeg', op: 'abs>=', value: 30 },
            { type: 'without', event: 'control-used:insertion' },
          ],
        },
      },
    ],
    observe: {
      view: {
        ...BENCH_VIEW,
        controls: ['advance', 'withdraw', 'suction', 'reset'],
        /** An authored teaching pose (turned, lever released), not a device value. */
        defaults: { rotationDeg: 90, deflectionDeg: 0 },
        readouts: ['depthMm', 'rotationDeg', 'deflectionDeg', 'suction'],
      },
      goals: [
        {
          id: 'advance-and-withdraw',
          label: 'Advance the tip, then withdraw it, reading the depth each time',
          test: {
            type: 'event-sequence',
            events: ['control-used:insertion', 'control-used:insertion'],
          },
        },
        {
          id: 'apply-and-release-suction',
          label: 'Apply suction, then release it',
          test: {
            type: 'event-sequence',
            events: ['control-used:suction', 'control-used:suction'],
          },
        },
      ],
      readouts: ['depthMm', 'rotationDeg', 'deflectionDeg', 'suction'],
    },
  },

  prediction: {
    id: 'N03',
    itemType: 'mechanism-interpretation',
    situation:
      'In a model session the bronchoscope tip rests on a bench, outside any airway, with the lever at rest so the tip is straight. The depth is held steady, and the control hand turns the control section clockwise through a small, comfortable range.',
    stem: 'What happens to the image on the screen, and to the bending plane (the plane in which the lever bends the tip) relative to the bench?',
    choices: [
      {
        id: 'a',
        label:
          'The image turns on the screen, and the bending plane turns on the bench by the same amount',
        rationale:
          'The lens and the bending section both sit in the tip, and turning the control section turns the whole insertion tube. The picture and the bending plane therefore turn together relative to the bench, and on the screen the plane keeps its place in the image.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'The image turns on the screen, but the bending plane stays fixed to the bench as before',
        rationale:
          'That separates the picture from the tip, as though only the display had been turned. Turning the control section turns the insertion tube, so the plane turns on the bench with the lens; on the screen it keeps its place in the image.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'Neither turns while the tip is straight: the image stays upright, the plane fixed to the bench',
        rationale:
          'A straight tip still turns about its own long axis when the control section turns. Its position stays where it was, but the lens turns with it, so the picture turns, and the plane the lever will bend in turns by the same movement; a bend only makes that turn visible as a swing.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label:
          'The bending plane turns on the bench, but the image stays upright on the screen as before',
        rationale:
          'The lens sits in the tip, so the picture turns whenever the tip turns. Rotation changes the orientation of the camera as well as of the bending plane; neither is held fixed to the room or the patient.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Turning the control section turns the whole insertion tube, and the lens and the bending section at its tip turn with it. So the image turns on the screen, and the bending plane turns on the bench by the same amount; on the screen the plane keeps its place in the image, and the lever only bends the tip within it. On a bench with a straight shaft the turn reaches the tip directly; in a curved airway the tip may not follow the handle one for one.',
    objectiveIds: ['M05-O2'],
    claimClass: 'synthesis',
    sourceRefs: [S1_COMPONENTS, S1_MOTIONS, S1_98, S2_44, S2_106, T10_MOTIONS],
  },

  transfer: {
    id: 'five-controls-transfer',
    itemType: 'management-decision',
    situation:
      'In a teaching model the tip lies straight in a model airway, on the same scope as the bench. A side-branch opening sits near the bottom edge of the image, a short way ahead, with its lumen visible.',
    stem: 'What should the next movement be?',
    choices: [
      {
        id: 'a',
        label: 'Advance straight on until the tip is level with the opening, then bend into it',
        rationale:
          'Advancing changes depth, not aim. A straight tip moving forward carries the opening off the bottom edge of the image before the tip reaches it, so the last part of the approach is blind and the bend is made against the wall rather than into the lumen.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label:
          'Turn the control section first to set the bending plane, then deflect toward the opening',
        rationale:
          'The opening already lies in the plane the lever bends in, which on this scope runs toward the top and the bottom of the image. Turning first moves the opening toward the side of the image, out of that plane, so a further turn is then needed to bring it back.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Deflect toward the opening until it is centered, then advance along its lumen',
        rationale:
          'An opening at the bottom edge already lies in the bending plane, which keeps its place in the image and on this scope runs toward the top and the bottom. Deflection bends the tip toward it under vision; once the lumen is centered the tip advances along what it can see, and no turn is needed.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label:
          'Sweep the control section down toward the floor, so the shaft is angled at the opening',
        rationale:
          'Sweeping the control section moves the shaft outside the patient; it neither bends nor turns the tip. The opening is reached by bending the tip within its plane, not by angling the handle.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Whether a turn is needed depends on where the target lies relative to the bending plane, which keeps its place in the image and on this scope runs toward its top and bottom. An opening at the bottom edge already lies in that plane, so deflection alone brings it toward the center, and turning first would move it out of the plane. Advancing changes depth, not aim, and does not replace the bend.',
    objectiveIds: ['M05-O2'],
    claimClass: 'synthesis',
    sourceRefs: [S1_COMPONENTS, S1_MOTIONS, S2_44, T10_MOTIONS, T11_COACHING],
    transferVariant:
      'Inside a model airway with the target already in the bending plane, instead of a straight tip turned on a bench: the same relation between rotation and deflection, now deciding that no turn is needed.',
  },

  practice: [
    {
      id: 'mc-trainee-circling-bed',
      presentationTitle: 'A trainee walking around the bed during a model session',
      situation:
        'During a model session a trainee holds the control section in the right hand. The monitor sits off to one side, so the trainee’s neck stays turned toward it. Each time the image turns, the trainee lifts the elbow toward shoulder height and steps around the head of the bed to follow it. The model airway looks as expected.',
      item: {
        id: 'mc-trainee-circling-bed',
        itemType: 'management-decision',
        stem: 'What should the instructor ask for first?',
        choices: [
          {
            id: 'a',
            label:
              'Turn the monitor to face the trainee, then carry on with the same stance and elbow position',
            rationale:
              'Moving the monitor ends the turned neck, but the trainee still lifts the elbow and steps around the bed each time the image turns. The working height and stance still push the body to do the hands’ work, so the setup is only half reset.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'b',
            label: 'Keep the elbow tucked at one fixed angle for the rest of the session',
            rationale:
              'No single elbow angle suits every bed, body and scope, and forcing one can push the wrist into an extreme position. The target is a relaxed shoulder and controlled movement from the hand and forearm.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label:
              'Pause, reset the monitor, bed height and stance, then turn from the hand and forearm',
            rationale:
              'The monitor position is turning the neck, and the height and stance are pushing the body to do the hands’ work. Resetting the setup first lets the control section turn from the hand and forearm with a relaxed shoulder.',
            plausibility: 'best',
          },
          {
            id: 'd',
            label: 'Move the control section to the trainee’s left hand and carry on as before',
            rationale:
              'Either hand may hold the control section. The problem in the room is the monitor position, the working height and the stance, and a change of hand leaves all three as they are.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Walking around the bed and raising the elbow are whole-body movements standing in for hand control, and a monitor that holds the neck turned adds to them. The fix is the setup: a monitor watched without neck rotation, a working height that lets the shoulders relax, and a stance from which the control section turns from the hand and forearm. Either hand may hold the control section, and no single elbow angle is required.',
        objectiveIds: ['M05-O1'],
        claimClass: 'synthesis',
        sourceRefs: [S1_SETUP, S1_95, S1_98, S2_106, S3_80, T10_MOTIONS, T11_COACHING],
        reviewItemIds: ['R03'],
      },
    },
  ],
}
