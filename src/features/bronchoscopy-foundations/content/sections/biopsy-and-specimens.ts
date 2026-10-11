import { num } from '../numbers'
import type { BronchSectionDefinition } from '../types'

/**
 * Biopsy, brushing and specimens (new in the rewrite, brief 12; absorbs `protected-accessories`
 * and `specimen-pathway`, and takes fluoroscopy from `icu-physiology`). The fellow learns the
 * forceps and the brush, how many biopsies to take, the protected brush, transbronchial biopsy
 * under fluoroscopy with radiation safety, and which specimen goes to which test. They name the
 * tool states on a picture, run one brush exchange in the simulator with an assistant whose report
 * cannot be taken on trust, and route five specimens.
 *
 * The practice case `mc-role-swap` ("Pull it back") is kept from the old section: its situation,
 * question, options and key are unchanged, and its rationales are shortened to the length caps.
 * Sources: the course textbook's chapters on sampling (S1) and the training manual's pages on
 * accessories and specimens (S2), with BTS 2013 (U14) for the two numbers.
 */
const TOOLS = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 131 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 25 } },
] as const
const SPECIMENS = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 121 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 147, to: 150 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 163 } },
] as const
const FLUOROSCOPY = [
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 41, to: 43 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 131 } },
] as const

export const section: BronchSectionDefinition = {
  id: 'biopsy-and-specimens',
  authoringContract: 2,
  title: 'Biopsy, brushing and specimens',
  shortTitle: 'Biopsy and specimens',
  minutes: 10,
  activityMinutes: 5,
  moduleIds: ['M13', 'M14'],
  objectives: [
    {
      objectiveId: 'M13-O1',
      subtask: 'Clicks the tool in the state asked for on a picture of the six tool states.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M13-O2',
      subtask: 'Makes an unclear command specific before any part of the brush moves.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M13-O3',
      subtask: 'Decides how many biopsies to take of a visible tumor, and what to add.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M13-O4',
      subtask: 'Sees a tool closed or sheathed before it is drawn back, whatever was said.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M13-O5',
      subtask:
        'Loads a brush sheathed, exposes it beyond the tip, and retrieves it once seen covered.',
      evidence: 'simulated-navigation',
    },
    {
      objectiveId: 'M14-O1',
      subtask: 'Routes five specimens to the container and the test each one needs.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M14-O2',
      subtask: 'Has the container and its label ready before the sample is taken.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M14-O3',
      subtask: 'Keeps tissue for culture out of formalin.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M14-O4',
      subtask: 'Says what a negative cytology result does and does not establish.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D12', 'D21', 'D22'],
  prerequisites: [
    'pre-use-check',
    'five-controls',
    'view-loss',
    'systematic-survey',
    'describe-findings',
    'washing-and-lavage',
  ],

  clinicalQuestion:
    'You are about to take a sample. Is the tool safe to move, and where does each piece go?',
  objective:
    'Handle forceps and brush safely through the channel, take enough tissue, and send each specimen to its test.',
  harmfulReflex:
    'Drawing a tool back through the channel on someone’s word, before you have seen it closed or sheathed.',
  harmfulReflexPatterns: [/\bdraw/i, /\bpush the\b/i],
  anchor: {
    analogy:
      'Someone tells you the door is locked. You are leaving for a month. You look at the bolt anyway.',
    precise:
      'A tool moves through the channel only when you have seen it closed or sheathed, and every container is ready before the sample is taken.',
    checklistLabel: 'Taking a sample',
    checklist: [
      'Closed or sheathed in the channel',
      'See it beyond the tip before it opens',
      'See it closed or sheathed before it comes back',
      'Container and label ready first',
    ],
  },
  outcomes: [
    {
      id: 'handle-the-tools',
      text: 'Pass, open, close and retrieve forceps and brush with the state seen at each step.',
    },
    {
      id: 'sample-and-route',
      text: 'Take enough tissue and send each specimen to the container and test it needs.',
    },
  ],

  spineStops: ['lobar'],
  grammarRowIds: ['state-disagrees'],
  precommitDenyPatterns: [/\bnecrotic\b/i, /\bone bite can miss\b/i],
  localPolicyIds: ['specimen_directory'],
  reviewItemIds: ['R02', 'R25', 'R28'],

  blocks: [
    {
      id: 'through-the-channel',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Through the channel, closed',
      body: 'Forceps travel with the cups closed. A brush travels inside its sheath. Open cups or bare bristles tear the channel.\n\nYour assistant works the handle and reports the state. You confirm it on the screen before anything moves.',
      claimClass: 'source',
      sourceRefs: TOOLS,
      reviewItemIds: ['R28'],
    },
    {
      id: 'endobronchial-biopsy',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Biopsy of a lesion you can see',
      body: `Keep the scope close. See the cups beyond the tip, open them, press onto the lesion, close and pull back firmly. Look at the site after each bite.\n\nTake ${num('endobronchial-biopsy-minimum')} biopsies of a visible tumor. A brushing and a washing add to the yield.`,
      pointsLabel: 'Forceps',
      points: [
        'Cup forceps: for most lesions.',
        'Toothed forceps: grip hard or slippery tissue.',
        'A central spike: holds on a flat wall.',
      ],
      claimClass: 'source',
      sourceRefs: TOOLS,
      reviewItemIds: ['R28'],
    },
    {
      id: 'brushes',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'The brush, and the protected brush',
      body: `A cytology brush is pushed out of its sheath at the lesion, rubbed across it, and sheathed again before it leaves.\n\nA protected brush has a sealed double sheath, so it carries nothing from the upper airway. It goes for culture. In suspected ventilator-associated pneumonia the diagnostic threshold is ${num('vap-brush-threshold')}.`,
      claimClass: 'source',
      sourceRefs: [
        ...TOOLS,
        { sourceId: 'U7', location: { kind: 'section', label: 'Section II recommendation' } },
      ],
      reviewItemIds: ['R25'],
    },
    {
      id: 'transbronchial-biopsy',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Biopsy beyond what you can see',
      body: `A transbronchial biopsy takes lung from past the last airway in view, and fluoroscopy shows where the forceps are. It risks bleeding and pneumothorax. A chest radiograph afterwards is needed ${num('cxr-after-tblb')}.\n\nNeedle aspiration through the airway wall (TBNA) samples lymph nodes. It is taught in the EBUS module.`,
      claimClass: 'source',
      sourceRefs: FLUOROSCOPY,
    },
    {
      id: 'radiation',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Radiation: time, distance, shielding',
      body: 'Fluoroscopy answers one question at a time. Ask it, look, and come off the pedal.',
      pointsLabel: 'Three ways to cut the dose',
      points: [
        'Time: screen in short bursts, and read the last image held on the screen.',
        'Distance: step back when you can. The dose falls steeply with distance.',
        'Shielding: lead apron and thyroid collar on everyone, with a dosimeter.',
      ],
      claimClass: 'source',
      sourceRefs: FLUOROSCOPY,
    },
    {
      id: 'specimen-to-test',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Which specimen goes where',
      body: 'Choose the container from the test, and have it labeled in the room before you sample. Formalin kills organisms and cannot be undone.',
      pointsLabel: 'The container, then the test',
      points: [
        'Formalin: tissue for histology. Molecular tests are run on the same block.',
        'Sterile saline, never formalin: tissue for culture.',
        'Slides or cytology fluid: brushings and washings for cytology.',
        'Cell block: needle rinses and fluid spun down, for stains and molecular tests.',
        'Rapid on-site evaluation (ROSE): a smear read in the room. It tells you whether to take more.',
      ],
      claimClass: 'source',
      sourceRefs: SPECIMENS,
      localPolicyIds: ['specimen_directory'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Six errors to expect',
      body: 'Each one trusts a word, or a habit, over what is in front of you.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Drawing the brush in on “sheathed” with bristles showing. Look first.',
        'Opening a tool inside the channel. See it beyond the tip.',
        'Reaching far with the scope held back. Bring the scope close.',
        'Stopping at two good biopsies of a tumor. Take the full number.',
        'Everything into formalin. Formalin ends the culture.',
        'Reading negative cytology as benign. It describes that sample.',
      ],
      claimClass: 'source',
      sourceRefs: TOOLS,
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
    caption: 'The working-channel port, where every brush and forceps enters and leaves the scope',
  },

  act: {
    kind: 'scope-lab',
    outcomeId: 'handle-the-tools',
    view: {
      sectionId: 'biopsy-and-specimens',
      mode: 'accessory',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'LMSB', at: 'mid' },
      controls: ['advance', 'withdraw', 'accessory', 'verifyAccessory', 'reset'],
      assists: {},
      defaults: { accessory: 'brush-sheathed', accessoryPosition: 'none' },
      script: 'assistant-misreport',
      boundary: 'The assistant’s reports are scripted for practice.',
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

  moreActs: {
    states: {
      kind: 'find',
      outcomeId: 'handle-the-tools',
      find: {
        id: 'tool-states',
        prompt:
          'Six tool tips: forceps, brush and needle, each in two states. Click the one each question asks for.',
        rows: [
          {
            id: 'cups-open',
            frameId: 'accessory-states',
            marks: 'tools',
            context: 'The forceps are beyond the tip, at the lesion.',
            prompt: 'Click the forceps with the cups open.',
            targetId: 'forceps-open',
            rationale:
              'Open cups are only for the moment of the bite. In this state the forceps must not be drawn back.',
          },
          {
            id: 'bristles-out',
            frameId: 'accessory-states',
            marks: 'tools',
            context: 'Your assistant says the brush is back in its sheath.',
            prompt: 'Click the brush that is NOT safe to draw back into the scope.',
            targetId: 'brush-exposed',
            rationale:
              'Bristles in view mean the brush is still out, whatever was said. Sheathe it, see it covered, then draw it back.',
          },
          {
            id: 'cups-closed',
            frameId: 'accessory-states',
            marks: 'tools',
            context: 'You have taken a bite, and the forceps are coming back.',
            prompt: 'Click the forceps as they must look before they enter the channel.',
            targetId: 'forceps-closed',
            rationale: 'Cups closed. An open cup catches the channel and drops the sample.',
          },
          {
            id: 'needle-out',
            frameId: 'accessory-states',
            marks: 'tools',
            context: 'A needle catheter is in the airway.',
            prompt: 'Click the needle that is out of its sheath.',
            targetId: 'needle-exposed',
            rationale:
              'A bare needle punctures the channel. The same rule holds: seen in its sheath before it moves.',
          },
        ],
        sourceRefs: TOOLS,
      },
    },
    route: {
      kind: 'sort',
      outcomeId: 'sample-and-route',
      sort: {
        id: 'route-five-specimens',
        prompt: 'Five specimens from one morning. Send each to the container it needs.',
        origins: [
          { id: 'formalin', label: 'Formalin', definition: 'Fixed tissue, for histology.' },
          {
            id: 'saline',
            label: 'Sterile saline',
            definition: 'Unfixed tissue, for culture.',
          },
          {
            id: 'cytology',
            label: 'Slides or cytology fluid',
            definition: 'Cells, for cytology.',
          },
          {
            id: 'cell-block',
            label: 'Cell block',
            definition: 'Fluid spun down and embedded, for stains and molecular tests.',
          },
          { id: 'rose', label: 'ROSE', definition: 'A smear read in the room.' },
        ],
        rows: [
          {
            id: 'brush-smear',
            statement: 'A brushing of the tumor surface, to look for malignant cells.',
            origin: 'cytology',
            rationale: 'A brush collects cells, not tissue. They are read as cytology.',
          },
          {
            id: 'cavity-wall',
            statement:
              'A biopsy from a lesion at a cavity’s draining bronchus. The question is tuberculosis or a fungus.',
            origin: 'saline',
            rationale: 'An organism has to be alive to grow. Formalin would end the culture.',
          },
          {
            id: 'smear-in-the-room',
            statement:
              'One pass of that needle, smeared on a slide for the cytologist waiting beside you.',
            origin: 'rose',
            rationale:
              'ROSE tells you now whether the pass hit the target and whether to take more.',
          },
          {
            id: 'tumor-bites',
            statement:
              'Forceps biopsies of a tumor in the left main bronchus. The question is the tissue diagnosis.',
            origin: 'formalin',
            rationale: 'Histology needs fixed tissue, and the molecular tests use the same block.',
          },
          {
            id: 'needle-rinse',
            statement:
              'The rinse from a needle aspirate of a lymph node, kept for immunostains and molecular tests.',
            origin: 'cell-block',
            rationale: 'Spun down and embedded, the cells can be cut and stained like tissue.',
          },
        ],
        sourceRefs: SPECIMENS,
      },
    },
  },

  prediction: {
    id: 'mc-how-many-biopsies',
    itemType: 'management-decision',
    situation:
      'A tumor grows into the right main bronchus. Your first two forceps biopsies are good-sized pieces, and the little oozing after each one stops. The question is the tissue diagnosis.',
    stem: 'What do you do next?',
    choices: [
      {
        id: 'a',
        label: 'End the sampling there, with two good pieces already in the pot',
        rationale:
          'Two pieces can both be dead surface tissue. The size of a piece does not tell you what is in it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: `Go on to ${num('endobronchial-biopsy-minimum')} biopsies, then brush and wash`,
        rationale:
          'More bites from more of the lesion raise the chance that one holds viable tumor. The brushing and washing add to it.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Pause, and wait for a frozen section on the two pieces',
        rationale:
          'That holds the patient sedated for an answer more biopsies would give you. Take the full set now.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Change to washings alone, to avoid any more oozing',
        rationale:
          'The oozing is stopping by itself. Washings alone give a lower yield and no tissue for further tests.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation: `The surface of a tumor is often necrotic, and one bite can miss. Take ${num('endobronchial-biopsy-minimum')} biopsies of a visible tumor, from different parts of it, and add a brushing and a washing.`,
    objectiveIds: ['M13-O3'],
    outcomeIds: ['sample-and-route'],
    claimClass: 'source',
    sourceRefs: TOOLS,
  },

  transfer: {
    id: 'protected-accessories-transfer',
    itemType: 'management-decision',
    situation:
      'You have taken a biopsy in the left lower lobe. Blood smears the lens, and you cannot see the forceps. Your assistant says: “Closed.”',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label: 'Draw the forceps in, as the assistant has said they are closed',
        rationale:
          'A word is a report, not a state. If the cups are open they catch the channel and the sample is lost.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Hold the forceps still, clear the lens, and see the cups closed',
        rationale:
          'Nothing moves through the channel until you have seen it. Clearing the lens takes a few seconds.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Withdraw the scope and the forceps together to the trachea',
        rationale:
          'You would be dragging a tool of unknown state along the airway, and still could not see it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Pause until the assistant says “closed” a second time',
        rationale:
          'The same report twice is still a report. The check is your own look at the cups.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The rule does not change when the view is lost. Hold the tool still, get the view back, and see it closed before it comes into the channel.',
    objectiveIds: ['M13-O1', 'M13-O4'],
    outcomeIds: ['handle-the-tools'],
    claimClass: 'source',
    sourceRefs: TOOLS,
    transferVariant:
      'A tool whose state cannot be seen, where the prediction was how much tissue to take.',
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
              'With the bristles exposed, that drags them through the working channel. It completes the unsafe one of several movements the words could mean.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label: 'Retract the brush into its sheath, since that is the likely meaning',
            rationale:
              'It is a safe movement here, and it is a guess. The exchange stays open until the command is made specific.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'c',
            label: 'Ask which part the operator means to move, and how far',
            rationale:
              '“Pull it back” names neither the part nor the movement. Asking makes it specific. You confirm aloud, and the operator sees the brush sheathed.',
            plausibility: 'best',
          },
          {
            id: 'd',
            label: 'Hold still and say nothing until the operator repeats the command',
            rationale:
              'A command is not complete until the receiver understands it. Silence leaves the operator assuming something is happening at the tip.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Sheathing the brush, moving the catheter back a little and drawing it through the channel are three movements, and the last is unsafe with bristles out. The receiver makes an unclear command specific, and the operator sees the brush covered before it moves.',
        objectiveIds: ['M13-O2'],
        outcomeIds: ['handle-the-tools'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 23, to: 25 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 130 } },
          { sourceId: 'T13', location: { kind: 'time-span', start: '00:20:40', end: '00:22:51' } },
        ],
      },
    },
    {
      id: 'mc-two-studies-one-pot',
      presentationTitle: 'Two tests and one kind of pot',
      situation:
        'A lesion in the right lower lobe bronchus could be a tumor or an infection. The request is histology and culture. The only pots on the trolley hold formalin.',
      item: {
        id: 'mc-two-studies-one-pot',
        itemType: 'management-decision',
        stem: 'What do you do before the first biopsy?',
        choices: [
          {
            id: 'a',
            label: 'Get a sterile pot with saline into the room, labeled for culture',
            rationale:
              'Culture needs living organisms. With both pots ready, each piece goes to the test it was taken for.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Put every piece in formalin and add the culture request later',
            rationale: 'Formalin kills the organisms. A culture cannot be added to fixed tissue.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Start into formalin while someone fetches a second pot',
            rationale:
              'The first pieces are often the best ones. Once they are fixed, none of them can be cultured.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Send histology alone, as it will show an infection too',
            rationale:
              'Histology may show inflammation. It does not name the organism or its sensitivities.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The test decides the container, and the container is in the room before the sample. Tissue for culture goes into sterile saline, never formalin.',
        objectiveIds: ['M14-O3', 'M14-O2'],
        outcomeIds: ['sample-and-route'],
        claimClass: 'source',
        sourceRefs: SPECIMENS,
      },
    },
    {
      id: 'mc-after-transbronchial-biopsy',
      presentationTitle: 'An hour after a transbronchial biopsy',
      situation:
        'A woman had transbronchial biopsies of the right lower lobe under fluoroscopy. An hour later she is comfortable, breathing easily, with no chest pain. Her SpO₂ is 96% on room air. The nurse asks whether she needs a chest radiograph.',
      item: {
        id: 'mc-after-transbronchial-biopsy',
        itemType: 'management-decision',
        stem: 'What do you say?',
        choices: [
          {
            id: 'a',
            label: 'No radiograph now. Observe her for pain or breathlessness',
            rationale: `A radiograph is needed ${num('cxr-after-tblb')}. She has no symptoms, so she is observed.`,
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'A chest radiograph for every patient before they go home',
            rationale: `The guidelines ask for one ${num('cxr-after-tblb')}, not as a routine.`,
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'A CT of the chest, as it is more sensitive',
            rationale:
              'It is more sensitive and adds radiation for a patient with nothing to explain.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'No radiograph, and she can leave straight away',
            rationale:
              'A pneumothorax can show itself late. She still needs her period of observation.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation: `Pneumothorax is the risk to watch for after a transbronchial biopsy. A chest radiograph is needed ${num('cxr-after-tblb')}. Observe her, and image her if anything changes.`,
        objectiveIds: ['M13-O3'],
        outcomeIds: ['sample-and-route'],
        claimClass: 'source',
        sourceRefs: FLUOROSCOPY,
      },
    },
    {
      id: 'mc-negative-is-not-benign',
      presentationTitle: 'Negative for malignant cells',
      situation:
        'You brush and wash toward an opacity in the left upper lobe that you could not see through the scope. The cytology report reads: “Negative for malignant cells.”',
      item: {
        id: 'mc-negative-is-not-benign',
        itemType: 'mechanism-interpretation',
        stem: 'What does the report establish?',
        choices: [
          {
            id: 'a',
            label: 'No malignant cells in these samples; the opacity is unexplained',
            rationale:
              'The samples may never have reached the lesion. The result describes them, not the opacity.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The opacity is benign, and follow-up imaging is enough',
            rationale:
              'A negative sample from a lesion you could not see does not rule out cancer.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'The bronchoscopy failed and has to be repeated the same way',
            rationale:
              'It did not answer the question. The same approach again is unlikely to do better.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'The samples were inadequate, as no tumor was found',
            rationale:
              'Adequacy is the laboratory’s statement about the cells it received. It is separate from the result.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Obtained, adequate, negative and non-diagnostic are four different things. A negative result from a lesion you did not see leaves the question open, and the next test has to reach the lesion.',
        objectiveIds: ['M14-O4'],
        outcomeIds: ['sample-and-route'],
        claimClass: 'source',
        sourceRefs: SPECIMENS,
      },
    },
  ],
}
