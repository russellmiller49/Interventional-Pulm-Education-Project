import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M13 — Brush, forceps and protected accessory states. The learner decides which state of an
 * accessory permits movement through the working channel and what confirms it: a command is
 * complete only when the observed state agrees. Knowledge spec §14.1–§14.6, §3.4, §5.3, §8.2 and
 * drills D10, D12, D21 (S1 PDF 89–100, 127–131, 148–149; S2 PDF 23–25, 44–47, 103–107; S3 PDF 55;
 * T13).
 *
 * The prediction adapts Q08 (needle withdrawal). The Act is a brush exchange against a scripted
 * assistant who reports a protected state the view contradicts (D21). The transfer changes the
 * accessory, the phase and the signal (forceps reported closed while a smeared lens hides the jaws)
 * and retrieves the smeared-lens recovery from view-loss, so Q23 — the Act's own situation — is not
 * reused.
 */
export const section: BronchSectionDefinition = {
  id: 'protected-accessories',
  title: 'Accessories in the working channel',
  shortTitle: 'Accessories',
  minutes: 8,
  moduleIds: ['M13'],
  objectives: [
    {
      objectiveId: 'M13-O1',
      subtask:
        'Loads the brush into the working channel in its sheath in the Simulator panel, and commits, in the transfer, the next move when a smeared lens hides forceps jaws reported closed before they are drawn into the channel.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M13-O2',
      subtask:
        'Works a brush exchange against a scripted assistant in the Simulator panel and, as the assistant in a practice case, makes an ambiguous command specific before anything moves; the spoken exchange itself is observed by faculty.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M13-O3',
      subtask:
        'Reads the forceps sequence, including the look at the site after the sample, and commits the forceps decision in the transfer; the handling itself is observed by faculty with an inert training accessory.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M13-O4',
      subtask:
        'Commits, in the prediction, the state to confirm before a needle catheter is drawn back through the scope, and commits, in a practice case, that confirming it is basic handling rather than competence in needle aspiration.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M13-O5',
      subtask:
        'In the Simulator panel, loads the brush sheathed, extends and exposes it beyond the tip, and draws it into the channel only after checking its sheathed state at the tip against a scripted assistant’s report.',
      evidence: 'simulated-navigation',
    },
  ],
  drillIds: ['D10', 'D12', 'D21'],
  prerequisites: [
    'pre-use-check',
    'five-controls',
    'view-loss',
    'systematic-survey',
    'describe-findings',
  ],

  clinicalQuestion:
    'Before a brush, forceps or needle moves through the working channel, what has to be true of it, and what tells you that it is?',
  recognizeTitle: 'A needle catheter drawn back through the scope',
  objective:
    'Decide which state of a brush, forceps or needle permits movement through the working channel, and which source of information confirms that state.',
  why: 'Brushes, forceps and needles move into and out of the scope while the operator and the assistant share the work: one holds the view, the other the accessory handle. Errors in that shared exchange can damage the scope and injure the patient.',
  newConcept:
    'A command is complete only when the observed state agrees: the state that permits movement through the working channel is the one seen at the tip, or checked on the mechanism when the tip cannot be seen, not the one heard or remembered.',
  incrementSentence:
    'This section adds one idea to the accessory state, one of the five controls: a command to protect an accessory is complete only when the state seen at the tip, or checked on the mechanism, agrees with it.',
  harmfulReflex:
    'Drawing an accessory back into the working channel because the assistant said it was closed or sheathed, or because it was protected earlier, without seeing its state at the tip or checking the mechanism.',
  anchor: {
    analogy:
      'Hearing “it’s locked” is not the same as seeing the bolt across: before you walk away, you look at the bolt.',
    precise:
      'An accessory moves through the working channel only in its protected state — forceps closed, brush inside its sheath, needle retracted within its protective assembly. The assistant’s confirmation says the maneuver was done; the view of the tip shows the result, and when the tip cannot be seen, a check of the mechanism does.',
    checklistLabel: 'Before any movement through the channel',
    checklist: [
      'Name one part and one movement',
      'Hear the assistant confirm the maneuver',
      'See the protected state at the tip, or check the mechanism',
      'Then move the accessory through the channel',
    ],
  },

  spineStops: [],
  grammarRowIds: ['state-disagrees'],
  controlStrip: {
    verdict: 'this-control',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'this-one',
    },
    sentence:
      'The accessory state is the control here: restore the protected state and confirm it at the tip, or on the mechanism when the tip cannot be seen. The reflex to resist is movement before the observed state agrees — the accessory drawn into the channel, or the scope withdrawn with it.',
  },
  precommitDenyPatterns: [
    /fully retracted/i,
    /\bretract/i,
    /protective/i,
    /observed state agrees/i,
    /not the one heard/i,
  ],
  modelBoundary:
    'The accessory’s state in this scene is drawn from the model, and the assistant’s words are scripted for teaching. The scene does not measure how far an accessory extends, force at the tip, tissue engagement, bleeding or specimen quality, and it has no device profile: channel size, working length and compatibility come from the device’s instructions.',
  physicalSkillNote:
    'Brushing and forceps handling are hand and team skills: holding the view while the assistant moves the catheter, a short supported reach, closing under coordinated control, and looking at the site after the sample. This app can check your decisions; it cannot see your hands or hear the exchange. Faculty observe these at a station with an inert training accessory.',
  localPolicyIds: ['scope_ifu', 'specimen_directory', 'bleeding_rescue'],
  reviewItemIds: ['R02', 'R28', 'R51'],

  blocks: [
    {
      id: 'one-channel',
      kind: 'question',
      role: 'framing',
      heading: 'One channel, three accessories',
      body: 'Brushes, forceps and needles reach the airway through the working channel, the same channel that carries suction and fluid. Each has a working end that changes at the tip: forceps jaws open and close, a brush is pushed out of its sheath, and a needle is advanced from the end of its catheter.\n\nThis section is about what has to be true of an accessory before it moves through that channel, and how the team knows.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 97 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 130 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 148, to: 149 } },
      ],
    },
    {
      id: 'team-signals',
      kind: 'signals',
      role: 'signals',
      heading: 'What the team can see, feel and hear',
      body: 'During an accessory exchange the operator and the assistant each hold part of the information below. This section asks which of it a decision to move an accessory can rest on.',
      pointsLabel: 'Information available during an accessory exchange',
      points: [
        'The bronchoscope view of the working end, once it is beyond the tip',
        'The accessory handle, usually in the assistant’s hands',
        'The assistant’s spoken confirmation of each command',
        'Resistance felt as the accessory moves in the channel',
        'The operator’s command, word for word',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 25 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:20:40', end: '00:22:51' } },
      ],
    },
    {
      id: 'where-it-sits',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'Where an accessory sits',
      body: 'The working channel opens at the scope tip beside the lens. An accessory inside the channel is out of sight; as it reaches the tip it enters the edge of the view on the side of the channel exit, and beyond the tip its working end lies in front of the lens, toward the target.\n\nWhich edge of the image the channel exits on belongs to the model in use. Take it from the device’s instructions: scopes differ, and no single clock position holds for all of them.',
      pointsLabel: 'Three positions an accessory can occupy',
      points: [
        'In the channel: out of sight',
        'At the tip: entering the edge of the view',
        'Beyond the tip: the working end in front of the lens',
      ],
      claimClass: 'local-policy',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 97 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 24 } },
      ],
      localPolicyIds: ['scope_ifu'],
      reviewItemIds: ['R02'],
    },
    {
      id: 'brush-exchange-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'A brush exchange, worked',
      body: 'A complete exchange is more than an echoed word: the operator names one part and one movement, the assistant confirms the maneuver, the operator sees the result at the tip, and only then does the next movement begin. With the brush in the channel, deflection and suction may be reduced; hold the view steady while the assistant advances, and do not force the brush or bend the scope sharply around it.',
      pointsLabel: 'The brush, from loading to retrieval',
      points: [
        'Before loading: the brush’s identity, integrity, channel compatibility and working length checked with the assistant, and the target in clear view.',
        'Loading: with the scope clear of and proximal to the target, the brush enters the channel in its sheath, and the operator names it as it emerges beyond the tip.',
        'Exposure: with only a short length of sheath beyond the tip and aimed, “Expose the brush”; the assistant confirms; the bristles are seen; the scope and brush then approach the target together.',
        'Sampling: controlled strokes on the intended surface, with the view held.',
        'Resheathing: “Retract the brush into its sheath”; the assistant confirms; the operator sees the bristles covered.',
        'Retrieval: only then is the catheter drawn into the channel, and the specimen goes to its labeled destination.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 90, to: 99 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 128 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 24 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:20:40', end: '00:22:51' } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:19:55', end: '00:20:40' } },
      ],
      localPolicyIds: ['scope_ifu', 'specimen_directory'],
      reviewItemIds: ['R28', 'R51'],
    },
    {
      id: 'forceps-short-supported',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Forceps: a short, supported reach',
      body: 'The target and a safe approach are chosen, with bleeding risk and the rescue plan considered, before the forceps go in. They travel closed through the channel, and the jaws are seen beyond the tip before they open. Aligned with the chosen tissue, they close under coordinated control and are retrieved without dragging open jaws through the channel, with the view kept to look at the site once the sample is out.\n\nForceps are loaded clear of the target; the scope and forceps are then brought toward it together, with only a short, useful length out of the channel. A long unsupported length with the scope far back loses fine control and overshoots more easily. No fixed length applies: the useful length depends on the tool, the optics, the target and the airway.\n\nStop and reassess when engagement is uncertain, the forceps cannot be controlled, resistance is abnormal or bleeding changes the balance of risk and benefit. Holding against the target never means pushing harder against resistance, and a fixed number of pieces does not replace diagnostic planning and specimen quality.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 129, to: 131 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:15:44', end: '00:19:55' } },
      ],
      localPolicyIds: ['bleeding_rescue'],
      reviewItemIds: ['R28'],
    },
    {
      id: 'en-bloc',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Two meanings of en bloc',
      body: 'During a close approach, en bloc can mean moving the scope and the accessory together so that their relative position holds. During foreign-body or some cryoprobe extraction, it can mean removing the scope and the captured material together from the airway. These are different tasks, and neither means pulling a deployed tool through the working channel while it is open, frozen to tissue or holding something too large to fit.\n\nBefore either, name which parts will move and which will stay still. If an instrument sticks or cannot be safely resheathed, stop and get experienced help; removing the scope and instrument together may be needed, but it is not an automatic first action.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:15:44', end: '00:19:55' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
      ],
    },
    {
      id: 'needle-rule',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'A needle rule, not a needle procedure',
      body: 'The foundational needle lesson is the protected state: the sharp needle stays retracted within its protective assembly while it moves through the bronchoscope, and the relationship of sheath and needle is confirmed before the catheter is drawn back. A verbal assumption does not replace a check when the mechanism can be checked.\n\nKnowing this rule is not competence in conventional transbronchial needle aspiration (TBNA) or EBUS-TBNA. Those procedures need extraluminal anatomy, target selection and imaging, device-specific technique, specimen handling and separate supervised evaluation.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 148, to: 149 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 24 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 55 } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors moves something before the state, the position or the command is settled.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Drawing the brush into the channel because the assistant said “sheathed” while bristles are still visible: the word and the view disagree, and the correction is that row in Reading the view.',
        'Exposing the brush or opening the jaws inside the channel: identify the tool beyond the tip, then deploy it.',
        'Brushing the adjacent carina instead of the lesion, or losing alignment as the assistant advances: stop the brush and restore the view of the lesion before it moves again.',
        'A long, unsupported reach with the scope far back: bring the scope and the accessory toward the target together.',
        '“Pull it back” when it could mean the brush into its sheath, the catheter a short way back in the airway, or the whole catheter drawn back through the scope: name the part, the movement and where it stops.',
        'A sample with no labeled destination: name where it goes before it is taken.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 128 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 25 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:15:44', end: '00:19:55' } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:20:40', end: '00:22:51' } },
      ],
      reviewItemIds: ['R28'],
    },
  ],

  workspace: {
    kind: 'media',
    media: [
      {
        kind: 'scope-photo',
        imageId: 'biopsy-adapter-setup',
        highlight: 'biopsy-adapter-setup-working-channel-port-2',
      },
    ],
    caption:
      'The working-channel port of a flexible bronchoscope, where every brush, forceps and needle enters and leaves the scope',
  },

  steps: {
    recognize: {
      instruction:
        'Look at the bronchoscope photograph in the Simulator panel: the port where accessories enter and leave the working channel. Then read What the team can see, feel and hear in the Teaching panel.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.photograph,
        alsoPane: 'teaching',
        alsoLandmark: 'What the team can see, feel and hear',
      },
    },
    act: {
      title: 'A brush exchange with a scripted assistant',
      instruction:
        'Use the scope controls under the view to load, extend, expose and retrieve the brush, meeting the goals on this card. The assistant’s scripted reports appear on the bronchoscope view; the scope controls include a check that records the accessory state you see at the tip, and a reset that starts the exchange again.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'The word and the view',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: {
      sectionId: 'protected-accessories',
      mode: 'accessory',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'LMSB', at: 'mid' },
      controls: ['advance', 'withdraw', 'accessory', 'verifyAccessory', 'reset'],
      assists: {},
      defaults: { accessory: 'brush-sheathed', accessoryPosition: 'none' },
      script: 'assistant-misreport',
      boundary:
        'Scripted for teaching: the assistant’s reports are authored, and the brush is drawn from its state in the model. Extension length, force at the tip and tissue contact are not represented.',
    },
    goals: [
      {
        id: 'load-sheathed',
        label: 'Load the brush into the working channel in its sheath',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'accessory-moved:in-channel' },
            { type: 'without', event: 'accessory-unsafe' },
          ],
        },
      },
      {
        id: 'extend-and-expose',
        label: 'Advance the sheath beyond the tip, then expose the brush',
        test: {
          type: 'all',
          tests: [
            {
              type: 'event-sequence',
              events: ['accessory-moved:extended', 'accessory:brush-exposed'],
            },
            { type: 'without', event: 'accessory-unsafe' },
          ],
        },
      },
      {
        id: 'retrieve-protected',
        label: 'Draw the brush back into the working channel with its bristles covered',
        test: {
          type: 'all',
          tests: [
            {
              type: 'event-sequence',
              events: [
                'accessory:brush-exposed',
                'accessory:brush-sheathed',
                'accessory-state-verified',
                'accessory-moved:in-channel',
              ],
            },
            { type: 'without', event: 'accessory-unsafe' },
          ],
        },
      },
    ],
  },

  prediction: {
    id: 'Q08',
    seedId: 'Q08',
    itemType: 'management-decision',
    situation:
      'During a supervised procedure, your supervisor finishes sampling with a needle catheter and asks you to draw the catheter back out through the working channel. Its end is beyond the scope tip, in the bronchoscope view.',
    stem: 'Before the catheter moves back through the channel, which state must you confirm?',
    choices: [
      {
        id: 'a',
        label: 'The needle left extended so the aspirated sample is kept',
        rationale:
          'Keeping the aspirate is what makes this tempting, but it means an exposed sharp needle is drawn back through the working channel, which can damage the channel and create a risk of injury. The protected state comes first, whatever the needle holds.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'The bronchoscope tip straightened so the catheter moves easily',
        rationale:
          'Easing a sharp bend does help, because extreme bending can hinder safe device movement. But it is a state of the scope, not of the needle: an exposed needle drawn through a straight channel can still damage it.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'c',
        label: 'The needle fully retracted within its protective assembly',
        rationale:
          'The sharp needle has to be inside its protective assembly while it moves through the bronchoscope. With the catheter end in view, the relationship of sheath and needle can be checked before the catheter moves.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'The needle state the assistant confirmed before the last sample',
        rationale:
          'A state confirmed before the last sample says nothing about now: the needle has been advanced to sample since. The protected state is checked for this movement, not carried over from an earlier confirmation.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'An exposed needle drawn through the working channel can damage the channel and create a risk of injury, so the needle is fully retracted within its protective assembly before the catheter moves, and that state is checked for this movement rather than taken from an earlier confirmation. Straightening the tip helps the catheter move, but it is a state of the scope and leaves an exposed needle exposed. Confirming this state is basic accessory handling; it is not competence in needle aspiration procedures, which need their own supervised training.',
    objectiveIds: ['M13-O4'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 148, to: 149 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 24 } },
      { sourceId: 'S3', location: { kind: 'pdf-pages', from: 55 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
    ],
  },

  transfer: {
    id: 'protected-accessories-transfer',
    itemType: 'management-decision',
    situation:
      'During a supervised endobronchial forceps biopsy, the open jaws are against the lesion when the operator asks for them to be closed. As the assistant says “closed,” secretion smears the lens, and the jaws can no longer be seen in the bronchoscope view.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label: 'Draw the forceps into the channel on the assistant’s “closed”',
        rationale:
          '“Closed” reports the maneuver; nothing on the screen now shows the result. Drawing the forceps in on the word alone risks dragging open jaws through the working channel, the movement the closed state exists to prevent.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Hold the forceps still until the view of the jaws is restored',
        rationale:
          'The word says the maneuver was done, and the smeared lens hides the result. Holding the forceps still while the lens is cleared in place brings back the view that can show the jaws; they are drawn into the channel once they are seen closed, or, if the view cannot be restored, once the mechanism is checked.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Withdraw the scope with the forceps out to clean the lens outside',
        rationale:
          'Withdrawing to clean is for a lens that cannot be cleared in place, and here it would carry forceps of unknown state out with the scope. An accessory out of the channel is accounted for before the scope is withdrawn, and removing the scope and forceps together is not a first move.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Hold the forceps still until the assistant repeats “closed” aloud',
        rationale:
          'Holding still is right, but a repeated word is read-back: it confirms what was heard, not where the jaws are. The state is confirmed on the view, or on the mechanism when the view cannot be restored, before the forceps move.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A command is complete only when the observed state agrees, and a smeared lens leaves the jaws unseen. The forceps stay where they are until the view is restored and the jaws are seen closed, or, if it cannot be, until the mechanism is checked; a second “closed” adds nothing the first did not. Withdrawing the scope to clean the lens would carry forceps of unknown state with it: an accessory out of the channel is accounted for first.',
    objectiveIds: ['M13-O1', 'M13-O3'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 129, to: 130 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
      { sourceId: 'T13', location: { kind: 'time-span', start: '00:20:40', end: '00:22:51' } },
      { sourceId: 'T13', location: { kind: 'time-span', start: '00:26:03', end: '00:27:44' } },
    ],
    transferVariant:
      'A different accessory, phase and signal: forceps reported closed on a sample while a smeared lens hides the jaws, where the prediction drew a needle catheter back with its end in view and the Act retrieved a brush the view showed exposed against a spoken report.',
    retrievesFrom: 'view-loss',
  },

  practice: [
    {
      id: 'mc-role-swap',
      presentationTitle: 'Taking the assistant’s place at a brushing station',
      situation:
        'At a simulation station the trainees swap roles, and you now hold the brush handle for a colleague. The sheath is beyond the scope tip and the bristles are exposed against the target when the operator, watching the bronchoscope image, says: “Pull it back.”',
      item: {
        id: 'mc-role-swap',
        itemType: 'management-decision',
        stem: 'As the assistant, what do you do?',
        choices: [
          {
            id: 'a',
            label: 'Draw the whole catheter back through the channel, as the words asked',
            rationale:
              'With the bristles exposed, drawing the whole catheter back drags them through the working channel. Doing what the words seemed to say, when they could mean more than one movement, completes the unsafe one.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label: 'Retract the brush into its sheath, since that is the likely meaning',
            rationale:
              'Retracting the brush is a safe movement here, but it is a guess: the operator may have meant something else, and the exchange stays open until the command is made specific and the maneuver confirmed.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'c',
            label: 'Ask which part the operator means to move, and how far',
            rationale:
              '“Pull it back” names neither the part nor the movement: the brush into its sheath, the catheter a short way back in the airway, or the whole catheter drawn back through the scope. Asking makes the command specific; you then confirm the maneuver aloud, and the operator sees the brush sheathed before the catheter is drawn into the channel.',
            plausibility: 'best',
          },
          {
            id: 'd',
            label: 'Hold still and say nothing until the operator repeats the command',
            rationale:
              'A command is not complete until the receiver understands it. Silence leaves the operator assuming something is happening at the tip; the receiver’s part of the exchange is to ask.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'With the bristles exposed, retracting the brush into its sheath, moving the catheter a short way back in the airway and drawing the whole catheter back through the channel are three different movements, and the last is unsafe until the bristles are covered. In a closed loop the receiver makes an ambiguous command specific and confirms the maneuver; the operator then sees the protected state before the catheter moves through the channel.',
        objectiveIds: ['M13-O2'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 25 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 130 } },
          { sourceId: 'T13', location: { kind: 'time-span', start: '00:20:40', end: '00:22:51' } },
        ],
      },
    },
    {
      id: 'mc-needle-rule-not-aspiration',
      presentationTitle: 'An enlarged node on the afternoon list',
      situation:
        'At a simulation station, a trainee has spent the morning brushing and taking forceps samples, and has confirmed the needle retracted within its protective assembly each time a needle catheter was drawn back through the scope. The supervisor then asks whether that work means the trainee is ready to perform the conventional transbronchial needle aspiration of an enlarged mediastinal lymph node on the afternoon patient list.',
      item: {
        id: 'mc-needle-rule-not-aspiration',
        itemType: 'management-decision',
        stem: 'What does the morning’s needle handling support?',
        choices: [
          {
            id: 'a',
            label: 'Performing the aspiration, since the needle was handled safely all morning',
            rationale:
              'Confirming the protected needle state is the foundational handling rule, not the procedure. Needle aspiration also needs extraluminal anatomy, target selection and imaging, device-specific technique and specimen handling, with separate supervised evaluation.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label: 'Basic needle handling, not readiness for the aspiration itself',
            rationale:
              'The morning shows the protected needle state handled safely in a model, which is basic accessory handling. The aspiration adds extraluminal anatomy, target selection and imaging, device-specific technique and specimen handling, and needs its own supervised evaluation.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label: 'Performing the aspiration, once the node is seen clearly on the CT',
            rationale:
              'A node seen clearly on CT is one input to target selection; it does not give the trainee the extraluminal anatomy, device-specific technique or specimen handling the aspiration needs, or its separate supervised evaluation.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Nothing yet, since the handling was on a model rather than a patient',
            rationale:
              'The station does show something: the protected needle state handled safely in a model, which is the basic handling this rule requires. What it does not show is readiness for the aspiration itself.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Confirming the needle retracted within its protective assembly is a foundational handling rule; it does not confer competence in conventional transbronchial needle aspiration or EBUS-TBNA. Those procedures need extraluminal anatomy, target selection and imaging, device-specific technique, specimen handling and separate supervised evaluation. The morning shows that basic handling in a model: a prerequisite for the procedure, not a license to perform it.',
        objectiveIds: ['M13-O4'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 148, to: 149 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 24 } },
          { sourceId: 'S3', location: { kind: 'pdf-pages', from: 55 } },
        ],
      },
    },
  ],
}
