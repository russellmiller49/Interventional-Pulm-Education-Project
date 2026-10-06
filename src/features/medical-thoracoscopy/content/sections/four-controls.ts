import type { ThoracoscopySectionSpec } from '../types'

/**
 * Section 7, "Four things you control". Mechanism, Access and orientation.
 *
 * The one new idea is the pivot: the port fixes the telescope at one point in the chest wall, so
 * the hand and the tip move opposite ways. The four controls of the model are the frame the idea
 * sits in; each is taught in full in its own section, and only the telescope's controls work here.
 * The question is a prediction, so the pivot is taught after it.
 */
export const section: ThoracoscopySectionSpec = {
  id: 'four-controls',
  revision: 1,
  spinePhase: 'Survey',
  objective:
    'Predict which way the tip of the telescope moves when the hand moves, and tell apart what pivot, depth and roll each change.',
  suggestedBackground: ['the-instrument', 'normal-pleural-space'],
  newConcept: 'The port is a pivot: the hand and the tip of the telescope move opposite ways.',
  increment:
    'The regions of the last section, plus one idea: how the telescope moves about the port.',
  clinicalQuestion: 'To bring a region into view, which way does the hand move?',
  anchor: {
    analogy:
      'An oar resting in a rowlock. Pull the handle toward you and the blade swings away; lift the handle and the blade dips. The rowlock is the port.',
    precise:
      'The hand holds the eyepiece end, and the telescope turns about the port, close to where the sleeve crosses the chest wall; in this model that is a fixed point. Tilting the eyepiece end one way swings the tip the other way, and further when more of the telescope is inside the chest. Depth moves the tip along the line the telescope already lies on. Roll turns the telescope about its own length: the line of sight stays where it was because the telescope looks straight ahead, and the picture turns because the camera is fixed to the eyepiece in this model.',
    checklistLabel: 'Before a movement, say which of the four you are changing',
    checklist: [
      'Where the port goes: chosen before entry, and fixed once the sleeve is in',
      'Where the scope looks: pivot, depth and roll',
      'Which tool is in the channel',
      'What is in the space: fluid out, air in',
    ],
    application:
      'In the Scope view, aim toward the diaphragm and then toward the apex, and say each time which way your hand will go before you move it.',
    claimIds: ['MT-C-0004', 'MT-C-0005', 'MT-C-0007'],
  },
  teachingExample: 'space-made',
  controls: { shown: ['port', 'scope', 'tool', 'space'], operable: ['scope'] },
  blocks: [
    {
      id: 'four-and-everything-else',
      role: 'framing',
      when: 'before-question',
      heading: 'Four controls, and everything else',
      body: 'In this course you change four things. Everything else is watched or managed by the team: the lung, the heart, the diaphragm, breathing and sedation. The lung responds to what is in the space; you do not move it directly.\n\nThe four are controls of the model, not a description of the procedure. Whether to go on, take a sample, treat, stop or call for help is a clinical decision, and none of the four makes it for you.',
      list: {
        label: 'The four controls of the model',
        items: [
          'Where the port goes: where the sleeve crosses the chest wall. Fixed in this model, and taught in “Choosing the port site”.',
          'Where the scope looks: pivot, depth and roll. Taught here.',
          'Which tool is in the channel. Taught in “Parietal biopsies”.',
          'What is in the space: fluid out, air in. Taught in “Fluid out, air in”.',
        ],
      },
      claimIds: ['MT-C-0001', 'MT-C-0004'],
    },
    {
      id: 'the-pivot',
      role: 'mechanism',
      when: 'after-question',
      heading: 'The port is a pivot',
      body: 'Once the sleeve is through the chest wall, the telescope turns about the port. The part outside and the part inside lie on one straight line through it, so they move opposite ways: the eyepiece end toward the head, the tip toward the feet.\n\nHow far the tip moves depends on how the telescope is divided at the port. With much of it inside the chest, a small movement of the hand sweeps the tip a long way. Drawn back, the same movement moves the tip much less.\n\nThe reversal has to be learned. In a laboratory study of 22 novices, those whose picture was flipped top to bottom made more of the required cuts than those with a normal picture. The authors took this to show that the reversal itself makes early skill harder to learn. The study was laparoscopic, not thoracoscopic.',
      claimIds: ['MT-C-0005', 'MT-C-0006'],
    },
    {
      id: 'depth-and-roll',
      role: 'mechanism',
      when: 'after-question',
      heading: 'Depth and roll',
      body: 'Depth moves the tip in or out along its line and does not change the direction it faces. It brings a region closer, and closer shows less of it at once.\n\nRoll turns the telescope about its own length. The telescope in this course looks straight ahead, so rolling it leaves the line of sight where it was. In this model the camera is fixed to the eyepiece, so the picture turns as you roll. The working channel turns in the chest but stays in the same place in the picture, and so does a tool in it.',
      claimIds: ['MT-C-0005', 'MT-C-0007'],
    },
    {
      id: 'movements-that-mislead',
      role: 'common-errors',
      when: 'after-question',
      heading: 'Movements that do not do what they seem to',
      body: 'Each of these feels as if it should bring a region into view, and none of them does.',
      list: {
        label: 'What each one does',
        items: [
          'Moving the hand toward the region: the tip goes the other way.',
          'Pushing deeper to see something off to the side: the tip goes further along the same line, toward whatever lies ahead, which may be the lung.',
          'Rolling to bring a region into view: the picture turns, and the line of sight stays where it was.',
          'Tilting hard against a rib: in the model the chest wall does not give, and the movement stops. What forcing it would do in a patient is not modeled.',
        ],
      },
      claimIds: ['MT-C-0005', 'MT-C-0007', 'MT-C-0008'],
    },
  ],
  workedExample: {
    heading: 'Aiming at the apex',
    situation:
      'The telescope is well inside the chest, looking at the lung. The apex is out of view, toward the head.',
    steps: [
      {
        action: 'With Depth, draw the telescope back a little.',
        reason:
          'With less of the telescope inside, the same tilt sweeps the tip through a shorter arc.',
      },
      {
        action: 'With Pivot, move the eyepiece end toward the feet.',
        reason: 'The telescope turns about the port, so the tip swings toward the head.',
      },
      {
        action: 'With Depth, advance slowly along the new line.',
        reason:
          'Depth now moves the tip toward the apex without changing where the telescope looks.',
      },
    ],
    outcome:
      'The tip now faces the apex. The hand went toward the feet to send the tip toward the head.',
    claimIds: ['MT-C-0005'],
  },
  activity: {
    kind: 'pivot',
    prompt:
      'In the Scope view, aim at each region in turn. Before each movement, say which way your hand will go.',
    targets: [
      {
        zone: 'diaphragm',
        handAndTip: 'The diaphragm lies toward the feet, so the hand moves toward the head.',
      },
      {
        zone: 'apex',
        handAndTip: 'The apex lies toward the head, so the hand moves toward the feet.',
      },
      {
        zone: 'posterior-chest-wall',
        handAndTip:
          'The back of the chest wall lies toward the spine, so the hand moves toward the front of the chest.',
      },
      {
        zone: 'anterior-chest-wall',
        handAndTip:
          'The front of the chest wall lies toward the sternum, so the hand moves toward the back.',
      },
    ],
    claimIds: ['MT-C-0005', 'MT-C-0009'],
  },
  question: {
    id: 'MT-Q-07-a',
    kind: 'prediction',
    purpose:
      'A prediction of the reversal before trying it: the one new idea, applied to one region.',
    stem: 'The diaphragm is out of view, toward the patient’s feet. Which movement of the eyepiece end brings the tip toward it?',
    choices: [
      {
        id: 'a',
        label: 'Toward the patient’s feet',
        feedback:
          'This is the natural move, and it sends the tip the other way: toward the head, away from the diaphragm.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Toward the patient’s head',
        feedback:
          'The telescope turns about the port, so moving the eyepiece end toward the head swings the tip toward the feet, where the diaphragm is.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Push the telescope deeper',
        feedback:
          'Depth moves the tip along the line it already lies on, not toward the feet. Pushed deeper, the tip goes on into whatever lies ahead, which may be the lung.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Roll the telescope',
        feedback:
          'Rolling leaves the line of sight where it was, because the telescope looks straight ahead; only the picture turns. The diaphragm stays out of view.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The sleeve holds the telescope at the port, and the parts inside and outside the chest lie on one line through it, so they move opposite ways: moving the eyepiece end toward the head swings the tip toward the feet. Depth and roll change how far in the tip is and how the picture is turned, not which way the telescope looks.',
    answerPhrases: [/toward the (patient’s )?head/i, /opposite|other way/i],
    claimIds: ['MT-C-0005', 'MT-C-0007', 'MT-C-0008'],
  },
  transfer: {
    id: 'MT-Q-07-b',
    kind: 'retrieval',
    purpose:
      'The reversal when the picture is upside down: it holds in the patient, whatever the screen shows.',
    whatChanged:
      'The picture has been rolled upside down, and the target lies toward the patient’s back.',
    stem: 'The telescope has been rolled half a turn, so the picture is upside down. You want to look further toward the patient’s back. Which way does the eyepiece end go?',
    choices: [
      {
        id: 'a',
        label: 'Toward the patient’s front',
        feedback:
          'The tip moves opposite to the hand however the picture is turned, so the eyepiece end goes toward the front to send the tip toward the back.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Toward the patient’s back',
        feedback:
          'That sends the tip toward the front. The tip moves opposite to the hand, and rolling does not change that.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'It depends on which way the picture has turned',
        feedback:
          'The picture’s turn changes how the screen looks, not how the telescope moves. The tip still moves opposite to the hand.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Toward the patient’s head',
        feedback:
          'That swings the tip toward the feet, along the other direction. It does not bring the tip toward the back.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Rolling turns the picture, not the rule. The telescope still turns about the port, so to take the tip toward the back, the eyepiece end goes toward the front, whatever the screen shows.',
    answerPhrases: [/toward the (patient’s )?front/i],
    claimIds: ['MT-C-0005', 'MT-C-0007'],
  },
  harmfulReflex: {
    move: 'Pushing the telescope deeper, or on against resistance, to see a region that lies off to the side.',
    risk: 'Depth only moves the tip along its line, so the tip goes on into whatever lies ahead, which may be the lung. A telescope pushed into the lung can injure it, and a torn lung can bleed and leak air.',
    inThisModel:
      'The model stops the telescope before it enters the lung and names the part in the way. This is a limit of the model; in a patient nothing stops the telescope. What an injury would do is not modeled.',
    claimIds: ['MT-C-0008'],
  },
  misconceptions: [
    {
      belief: 'The tip of the telescope moves the same way as the hand.',
      correction:
        'Through a port the tip moves the opposite way, about the point where the sleeve crosses the chest wall.',
      claimIds: ['MT-C-0005', 'MT-C-0006'],
    },
  ],
  modelLeavesOut: {
    shared: ['no-forces', 'rigid-ribs', 'scan-position', 'no-motion'],
    section: [
      'Your hands are keyboard, pointer or touch commands. The weight of the telescope and the feel of the sleeve in the chest wall are not represented.',
      'The port is a fixed point in the model.',
    ],
  },
  signals: [
    {
      name: 'Telescope and sleeve',
      provenance: 'derived',
      label: 'Educational rendering from published dimensions',
      detail:
        'Built from the manufacturer’s published dimensions and from measurements of its reference images. Not manufacturer CAD.',
      claimIds: [],
      deviceIds: ['operative-telescope', 'trocar-sleeve-flexible'],
    },
    {
      name: 'Field of view',
      provenance: 'authored',
      label: 'Authored construct',
      detail: 'Chosen by the author. The manufacturer has not published it.',
      claimIds: [],
      deviceIds: ['operative-telescope'],
    },
    {
      name: 'Port',
      provenance: 'authored',
      label: 'Authored construct',
      detail: 'Placed by the author on this scan. Not a recommended site.',
      claimIds: ['MT-C-0003'],
    },
    {
      name: 'Lung, fallen away',
      provenance: 'authored',
      label: 'Awaiting clinical review',
      detail:
        'The lung falls away from the chest wall once air is in. The lesson depends on this relationship, and it has not been clinically reviewed.',
      claimIds: ['MT-C-0001'],
    },
    {
      name: 'How far the lung has fallen',
      provenance: 'authored',
      label: 'Authored, illustrative',
      detail:
        'Set so that the lung fills about a quarter of the space: the middle value measured beside large effusions on CT in other patients, not in this one. Where the lung rests is chosen by the author.',
      claimIds: ['MT-C-0002'],
    },
  ],
  usedAgainBy: ['choosing-the-port', 'making-room', 'systematic-survey', 'taking-biopsies'],
}
