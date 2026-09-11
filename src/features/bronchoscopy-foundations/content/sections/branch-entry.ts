import type { ScopeViewSpec } from '../../components/scope/types'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M05 (second half) — Branch entry. The five controls, combined: the entry sequence at the main
 * carina, withdrawal as steering, and the one fault a novice meets first — a control section that
 * turns while the image barely moves. Knowledge spec §4.2–§4.6 and §5.1 (S1 PDF 61–70, 89–99;
 * S2 PDF 44–47, 106–107; S3 PDF 80; T10, T11). Grammar row `handle-turns-view-static` is taught here.
 */
const GUIDED_ASSISTS = {
  'centerline-lock': true,
  'aim-guard': true,
  'branch-labels': true,
} as const

const GUIDED_BOUNDARY =
  'Guided walk: the tip follows each airway’s centerline, an advance waits until the tip is aimed at an opening, and in-view labels are on. All three are assists, recorded as such. Wall contact is a feedback signal, not a measure of force.'

const CARINA_VIEW: ScopeViewSpec = {
  sectionId: 'branch-entry',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label: 'TR', at: 'distal' },
  controls: ['advance', 'withdraw', 'rotate', 'deflect', 'branchLabels'],
  assists: GUIDED_ASSISTS,
  defaults: { branchLabels: true },
  readouts: ['currentAirway', 'contactCount'],
  litAirways: ['TR', 'RMSB', 'LMSB'],
  boundary: GUIDED_BOUNDARY,
}

export const section: BronchSectionDefinition = {
  id: 'branch-entry',
  title: 'Entering a branch and coming back',
  shortTitle: 'Branch entry',
  minutes: 9,
  moduleIds: ['M05'],
  objectives: [
    {
      objectiveId: 'M05-O3',
      subtask:
        'In the bronchoscope view, travels to the carina, enters the right main bronchus, withdraws to the trachea and enters the left with no wall contact and no advance refused for lack of aim, then stays above the carina through an image capture and the assistant’s call with no forward drift or wall contact. The same movements with real hands are shown to faculty at a model station.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M05-O4',
      subtask:
        'Commits the correction for a tip dragging along the wall while withdrawing from a sharply angled bronchus, with the landmark that ends the move. Making that correction with real hands is shown to faculty at a model station.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M05-O5',
      subtask:
        'Commits the first correction when the control section turns and the image barely moves, reading an observer’s view of both hands as well as the image, and again in a practice case with a different cause. The correction itself, with an observer watching both hands and the screen, is shown to faculty at a model station.',
      evidence: 'observed-physical-skill-required',
    },
  ],
  drillIds: ['D03', 'D04', 'D10'],
  prerequisites: ['five-controls'],

  clinicalQuestion:
    'When you enter and leave a bronchus, how do you tell whether each movement of the hands has reached the tip, and what do you do when one has not?',
  recognizeTitle: 'At the main carina, before entering a bronchus',
  objective:
    'Tell whether each movement of the hands has reached the tip while entering and leaving the main bronchi, and choose the correction when one has not.',
  why: 'Each airway the survey enters is entered and left the same way, so the habits formed at the main bronchi carry into the segments. They show most when a movement of the hands does not do what was intended.',
  newConcept:
    'Each movement of the entry sequence — name, expose, rotate, deflect, advance along the visible lumen, relax the bend — is confirmed on the image before the next; a movement that does not reach the tip is corrected where it was lost, not with more force.',
  incrementSentence:
    'This section adds one idea to the five controls: combined to enter a branch, each movement counts only once it shows on the image, and one that does not reach the tip is restored where it was lost rather than forced.',
  harmfulReflex:
    'Pushing the scope farther when a movement does not reach the tip — advancing toward the wall to make up for a turn that did not arrive — instead of stopping and restoring the movement where it was lost.',
  anchor: {
    analogy:
      'Threading a needle: bring the eye into view, line the thread up with it and push only then — and when the thread will not follow your fingers, straighten it rather than push harder.',
    precise:
      'Rotation chooses the plane, deflection bends within it and insertion moves the tip along the lumen. A turn reaches the tip only along a shaft that follows a smooth path and that the insertion hand guides rather than clamps. Advance only along a lumen you can see, let the bend come off as the airway straightens, and recover from an overshoot by withdrawing to the branch origin.',
    checklistLabel: 'Before each advance',
    checklist: [
      'The target is named and its opening is in view',
      'The opening lies in the plane the tip bends in',
      'The lumen ahead is open and visible',
      'The last movement showed on the image',
    ],
  },

  spineStops: ['trachea', 'carina', 'main-bronchi'],
  grammarRowIds: ['handle-turns-view-static'],
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
      'Shaft rotation is the control whose movement did not reach the tip; Reading the view gives the correction. Insertion is the harmful reflex — advancing adds force without freeing the turn — and a full deflection bends only within a plane rotation has not yet chosen.',
  },
  precommitDenyPatterns: [
    /loosen(s|ing)? the grip/i,
    /relax(es|ing)? the grip/i,
    /smooth (line|shaft)/i,
    /absorb(s|ed|ing)? the (rotation|turn)/i,
    /retest(s|ing)? a small (turn|rotation)/i,
  ],
  modelBoundary:
    'The scope pane shows the image and the controls you press. It cannot show your hands or the part of the scope outside the patient, and it does not represent the feel of the instrument; what the hands and the outside shaft do in this section is described in words. Guided walk keeps the tip on each airway’s centerline and waits until the tip is aimed before it advances: entry here is assisted and recorded as such. Wall contact and drift are feedback signals, not measures of force, injury or skill.',
  physicalSkillNote:
    'The app sees the image and the controls you press. It cannot see the insertion hand, the shaft between the hands, your stance, or the forward drift a hand produces when attention shifts. Coordinated entry and withdrawal without force, and correcting a turn that does not reach the tip, are shown to faculty who watch both hands and the screen at a model station; an event recorded here does not establish them.',
  localPolicyIds: ['scope_ifu'],
  reviewItemIds: ['R03', 'R04'],

  blocks: [
    {
      id: 'carina-and-back',
      kind: 'question',
      role: 'framing',
      heading: 'From the carina into a main bronchus and back',
      body: 'Entering a bronchus is the first task that combines the controls. From the trachea the scope reaches the main carina, turns into one main bronchus, comes back to the trachea and turns into the other. Any airway the survey enters is entered and left the same way; some are inspected from their opening without entry.\n\nThis section asks how you know that a movement of the hands has reached the tip, and what to change when it has not.',
      claimClass: 'design',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 79, to: 83 } },
      ],
    },
    {
      id: 'what-to-watch',
      kind: 'signals',
      role: 'signals',
      heading: 'What to watch while the hands move',
      body: 'Each movement should show on the screen before the next begins. These tell you whether it has.',
      pointsLabel: 'Signals during branch entry',
      points: [
        'The image: whether it turns, bends or moves along the lumen as the hands intended',
        'The target opening: named, and in view before any advance',
        'The lumen ahead: open, or filled with close mucosa',
        'The depth: whether the tip has crept forward while attention was elsewhere',
        'The hands, as an observer beside the operator sees them',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' } },
      ],
    },
    {
      id: 'controlled-entry',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A controlled entry, seen on the screen',
      body: 'In the trachea the cartilage rings support the anterior and lateral walls, and the flat membranous wall runs posteriorly; the main carina lies ahead. Stopping above it brings both main bronchial origins into view — the reference to come back to.\n\nFrom there a controlled entry shows one change at a time. A turn of the control section turns the image and brings the chosen opening into the plane the tip bends in — on this teaching scope, toward the top or bottom of the view. A bend of the tip then brings that opening to the center. Advancing moves the view along a lumen that stays open ahead, and as the bronchus straightens the bend comes off.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
      ],
      localPolicyIds: ['scope_ifu'],
    },
    {
      id: 'entry-sequence-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The entry sequence, worked at the right main bronchus',
      body: 'The same six steps enter any branch the survey enters. They are a sequence of intent, observation and adjustment, not a fixed number of degrees. Coming back takes the same care: withdraw under vision until the carina, the reference, is in view again.',
      pointsLabel: 'Entering the right main bronchus from the carina',
      points: [
        'Name: the right main bronchus.',
        'Expose: stop above the carina with both main bronchial origins in view.',
        'Rotate: turn the control section until the right main bronchial opening lies in the plane the tip bends in — on this teaching scope, toward the top or bottom of the image; a real scope’s instructions for use say how its bending plane lies in the image.',
        'Deflect: bend the tip toward the opening until its lumen is ahead.',
        'Advance: move forward only along the lumen you can see.',
        'Relax: as the bronchus straightens, let the bend come off.',
      ],
      claimClass: 'design',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      ],
      localPolicyIds: ['scope_ifu'],
      reviewItemIds: ['R04'],
    },
    {
      id: 'where-the-turn-goes',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Where a turn of the control section goes',
      body: 'Rotation travels from the control section — the handle — along the shaft, the insertion tube, to the tip. The insertion hand sets depth and guides the shaft; it should not clamp the shaft against a deliberate turn. A clamped grip, a large loop outside the patient, friction or wall contact can take up the rotation before it reaches the tip, and in a curved airway the tip may not turn at once by as much as the control section did.\n\nTwisting harder against a constrained shaft gives poor control and can damage the instrument; its handling limits come from its instructions for use. The operator watching the screen sees only the result. An observer who watches the insertion hand and the shaft as well as the screen can see whether the intended movement reached the tip, and where it was lost. Reading the view is the course’s table of what you see, where the problem lives, a short list of moves and which control, if any; this presentation is its first row, and the section on losing the view builds the rest.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' } },
      ],
      localPolicyIds: ['scope_ifu'],
      reviewItemIds: ['R03'],
    },
    {
      id: 'holding-the-view',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Holding the view while doing something else',
      body: 'Holding a view without forward drift — while taking a photograph, listening to the assistant, giving topical anesthetic or passing an instrument — is an active skill. The insertion hand gives gentle support near the entry point while regulating depth, without pressing on the eyes, pulling a tube, loading the teeth or levering against the face. The control hand supports the instrument without making the shaft rigid.\n\nA stable picture held by pressing the tip against the wall is not a safe position. When a pull on the tubing outside the airway disturbs the tip, remove the pull rather than brace the scope harder against the wall.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:07:48', end: '00:08:36' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:01:47', end: '00:02:36' } },
      ],
      reviewItemIds: ['R03'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each correction below is a physical action with a visible endpoint.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Pushing when the tip does not respond: stop advancing, and find where the movement was lost.',
        'Bending harder from beyond an opening that leaves at a sharp angle, such as the right upper lobe: withdraw until the branch origin is visible, then reorient.',
        'Advancing with the lens pressed against a carina: stop; more advance does not change the geometry. Withdraw until the lumen is ahead.',
        'Carrying a full bend down the next segment: reduce the deflection as the airway straightens.',
        'Turning or bending before the target is named and its opening is in view: name it, expose it, then rotate and deflect.',
        'Letting the tip creep forward when the assistant speaks: hold the insertion point, repeat the intended action, and move only after confirmation.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 80 } },
        { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' } },
      ],
      reviewItemIds: ['R03', 'R04'],
    },
  ],

  workspace: { kind: 'scope', view: CARINA_VIEW },

  steps: {
    recognize: {
      instruction:
        'In the bronchoscope view, find the main carina and both main bronchial origins. Then read What this section is for in the Teaching panel, down to A controlled entry, seen on the screen.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.scopeView,
        alsoPane: 'teaching',
        alsoLandmark: TEACHING_LANDMARKS.purpose,
      },
    },
    act: {
      title: 'From the carina into each main bronchus',
      instruction:
        'Use the scope controls under the view to go down the trachea to the main carina, into the right main bronchus, back to the trachea, and into the left. Advance only once the opening is aimed: an advance pressed earlier is refused, and the last of the goals on this card records it.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    observe: {
      title: 'Holding the carina view through a photograph',
      instruction:
        'At the carina in the bronchoscope view, the assistant speaks and an image is due. With the scope controls under the view, acknowledge the assistant and capture the image, keeping the depth and the contact count in the readouts under the controls where they started.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.readouts,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'Each movement, checked at the tip',
      instruction: `Read ${TEACHING_LANDMARKS.adds}, then Where a turn of the control section goes and ${TEACHING_LANDMARKS.grammar} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: {
      ...CARINA_VIEW,
      start: { kind: 'airway', label: 'TR', at: 'proximal' },
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'branchLabels', 'reset'],
    },
    goals: [
      {
        id: 'reach-carina',
        label: 'Advance down the trachea to the main carina',
        test: { type: 'event', event: 'reached-carina' },
      },
      {
        id: 'enter-right',
        label: 'Aim at the right main bronchus and enter it',
        test: { type: 'event-sequence', events: ['reached-carina', 'entered:RMSB'] },
      },
      {
        id: 'back-to-trachea',
        label: 'Withdraw from the right main bronchus into the trachea',
        test: { type: 'event-sequence', events: ['entered:RMSB', 'returned-to-trachea'] },
      },
      {
        id: 'enter-left',
        label: 'Aim at the left main bronchus and enter it',
        test: {
          type: 'event-sequence',
          events: ['entered:RMSB', 'returned-to-trachea', 'entered:LMSB'],
        },
      },
      {
        id: 'no-force',
        label:
          'Advance only with the opening aimed and the lumen in view, and keep the tip off the wall',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'entered:LMSB' },
            { type: 'without', event: 'wall-contact' },
            { type: 'without', event: 'aim-refused' },
            { type: 'without', event: 'advanced-blind' },
          ],
        },
      },
    ],
    observe: {
      view: {
        ...CARINA_VIEW,
        controls: ['advance', 'withdraw', 'rotate', 'deflect', 'capture', 'acknowledge'],
        readouts: ['depthMm', 'contactCount'],
        litAirways: ['TR'],
        script: 'assistant-interrupt',
        boundary:
          'Scripted: the assistant’s words and the image request are authored for teaching. Here drift is a change in depth the pane records; at a model station it comes from the insertion hand, which only an observer sees.',
      },
      goals: [
        {
          id: 'acknowledge',
          label: 'Acknowledge the assistant',
          test: { type: 'event', event: 'acknowledged' },
        },
        {
          id: 'capture',
          label: 'Capture an image from above the main carina',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'captured' },
              { type: 'location', airway: 'TR' },
            ],
          },
        },
        {
          id: 'hold',
          label: 'Stay above the carina until the hold ends',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'hold-completed' },
              { type: 'location', airway: 'TR' },
            ],
          },
        },
        {
          id: 'no-drift',
          label: 'Keep the depth steady and the tip off the wall during the hold',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'hold-completed' },
              { type: 'without', event: 'drift-detected' },
              { type: 'without', event: 'wall-contact' },
            ],
          },
        },
      ],
      readouts: ['depthMm', 'contactCount'],
    },
  },

  prediction: {
    id: 'Q14',
    seedId: 'Q14',
    itemType: 'management-decision',
    situation:
      'In an airway model, a trainee at the main carina turns the control section to bring the right main bronchial opening toward the top of the image. The control section turns, but the image barely moves. An observer watching both hands as well as the screen sees the insertion hand gripping the shaft hard at the model’s mouth, and the shaft bowed in a curve between the two hands.',
    stem: 'What is the best first correction?',
    choices: [
      {
        id: 'a',
        label:
          'Push the scope farther in so the curve straightens, then turn the control section again',
        rationale:
          'Forward force does not fix a turn that is not reaching the tip; the grip and the bowed shaft still take it up. Pushing drives the tip toward the main carina with no opening in the bending plane: uncontrolled forward drift, and the start of advancing against the wall to make up for a turn that did not arrive.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Loosen the grip, let the shaft run in a smooth line, then retest a small turn',
        rationale:
          'The observer’s view shows where the turn goes: into a hard grip and a bowed shaft. Loosening the grip and letting the shaft run smoothly lets rotation reach the tip, and a small isolated turn shows whether it now does, without moving the tip forward.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label:
          'Grip the shaft more firmly at the mouth so it cannot slip, then turn the control section again',
        rationale:
          'The observer already sees a hard grip at the mouth, and that grip is holding the shaft against the turn. Gripping more firmly takes up more of the rotation, not less, and leaves the bowed shaft as it is.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Deflect the tip to the lever’s limit so it swings toward the opening',
        rationale:
          'Deflection bends the tip only within its plane, and the opening is not yet in that plane: a full bend swings the tip toward the top or the bottom of the image, and the opening lies in neither direction yet. A maximal bend is not a substitute for the rotation that has not arrived.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Rotation reaches the tip only along the shaft. A hard insertion-hand grip and a bowed shaft absorb the rotation, so the control section turns while the image barely moves; more depth, more bend or a firmer grip leaves that constraint in place. Relaxing the grip, restoring a smooth shaft course and retesting a small, isolated turn lets the rotation reach the tip without forward drift. The observer’s view of both hands shows where the turn was lost; the image alone does not.',
    objectiveIds: ['M05-O5'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
    ],
    reviewItemIds: ['R03'],
  },

  transfer: {
    id: 'branch-entry-transfer',
    itemType: 'management-decision',
    situation:
      'In an airway model, a trainee has looked into the right upper lobe bronchus, which leaves the short right main bronchus at a sharp angle. Entering it took a strong bend of the tip. Withdrawing to come back out, the image shows one wall sliding past close to the lens while the lumen stays visible beyond it, then the dividing ridge at the upper-lobe origin, close up.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label: 'Withdraw briskly in one pull so the tip spends less time against the wall',
        rationale:
          'Speed does not change the geometry. With the bend still on, a faster pull drags the tip along the same wall and across the ridge, with less time to see what it is touching.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label:
          'Turn the control section until the ridge moves out of the image, then keep withdrawing as before',
        rationale:
          'Rotation turns the camera and the plane of the bend, but the tip stays bent. Taking the ridge out of the picture does not take the tip off the wall.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'Stop, then ease the bend off while withdrawing, until the upper-lobe origin is in view',
        rationale:
          'The tip is still bent for entry, so as it comes back it drags along one wall and across the ridge. Releasing the bend progressively while withdrawing under vision lets the tip follow the airway as it straightens; the upper-lobe origin, seen beside the bronchus intermedius, marks the tip’s return to the right main bronchus.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label:
          'Keep the bend on and withdraw slowly under vision until the main carina is back in view',
        rationale:
          'Going slowly and watching does not take the tip off the wall. The bend that entered the upper lobe still aims the tip into the wall it is leaving, so it drags along that wall and across the ridge, only more slowly.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'Withdrawal is steering, not simply pulling back. The strong bend used to enter a sharply angled bronchus has to come off as the tip leaves it; held on, it drags the tip along one wall and across the ridge. Withdraw under vision while releasing the bend, and let a landmark end the move: the upper-lobe origin and the bronchus intermedius both in view from the right main bronchus.',
    objectiveIds: ['M05-O4', 'M05-O3'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
    ],
    transferVariant:
      'A different phase, control and cause: withdrawal from a sharply angled branch, where the tip drags because the lever still holds the entry bend, not because a turn was lost between the hands. What carries over is the section’s check: which control is making the tip do what the image shows, corrected at that control rather than with more force or speed, and ended at a named landmark. It retrieves the earlier section on the five controls: withdrawing changes depth, not aim, so a held bend keeps the tip aimed at the wall.',
    retrievesFrom: 'five-controls',
  },

  practice: [
    {
      id: 'mc-handle-turns-view-static',
      presentationTitle: 'Turning toward the left main bronchus at a simulation station',
      situation:
        'At a simulation station, a trainee turns the control section to bring the left main bronchial opening toward the top of the image. The image barely turns. The observer, watching both hands as well as the screen, sees a relaxed insertion hand and the shaft hanging in a wide loop between the control section and the model’s mouth.',
      item: {
        id: 'mc-handle-turns-view-static',
        itemType: 'management-decision',
        stem: 'What is the first correction?',
        choices: [
          {
            id: 'a',
            label:
              'Loosen the insertion-hand grip still further, then turn the control section once more',
            rationale:
              'The grip is already relaxed, so loosening it further changes nothing; the loop outside the patient is where the turn is going. The correction follows the cause the observer sees, not the last correction that worked.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'Advance the scope a little to take up the slack in the loop, then turn again',
            rationale:
              'Advancing to take up slack moves the tip forward at the carina with no opening in the bending plane: forward drift with no visible path. The loop is corrected outside the patient, at the control section, not by changing depth.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Keep turning the control section farther until the image finally follows the hand',
            rationale:
              'More turning at the control section does not remove the loop that is taking it up, and excessive twisting against a constrained shaft gives poor control and can damage the instrument.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'Move the control section to take the loop out of the shaft, then try a small turn',
            rationale:
              'With the grip relaxed, the observer places the lost rotation outside the patient: the wide loop takes up the turn. Repositioning the control section so the shaft runs in a smooth arc to the model’s mouth, without changing depth, then a small isolated turn, shows whether the rotation now reaches the tip.',
            plausibility: 'best',
          },
        ],
        explanation:
          'A control section that turns while the image barely moves has more than one cause: a clamped grip, a loop outside the patient, friction or wall contact. Here the grip is relaxed and the observer sees a wide loop, so the correction is to restore a manageable shaft path and retest a small turn, without moving the tip.',
        objectiveIds: ['M05-O5'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 90 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
          { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
          { sourceId: 'T11', location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' } },
        ],
        reviewItemIds: ['R03'],
      },
    },
  ],
}
