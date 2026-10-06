import type { ThoracoscopySectionSpec } from '../types'

/**
 * Section 6, "A normal hemithorax from inside". Foundation, Equipment and anatomy.
 *
 * The one new idea is the map: the regions of a normal right pleural space, each told apart by
 * what is in view rather than by the direction the picture seems to face. Normal comes first:
 * disease is not shown until section 12. The tour is fully guided, so the section uses no control
 * of the model; turning the telescope is section 7's.
 */
export const section: ThoracoscopySectionSpec = {
  id: 'normal-pleural-space',
  revision: 1,
  spinePhase: 'Survey',
  objective:
    'Name the region of a normal right pleural space that is in view through the telescope, and say what tells you.',
  suggestedBackground: ['the-instrument', 'the-chest-wall'],
  newConcept: 'A normal pleural space has named regions, each told apart by what is in view.',
  increment:
    'The chest wall you cross to get in, plus one idea: the space inside it, named region by region.',
  clinicalQuestion: 'Once the telescope is inside, which part of the space is in view?',
  anchor: {
    analogy:
      'Finding your way in a dark room with a torch. Before looking for anything, you find the floor, the walls and the ceiling by what is on them, not by guessing which way you are facing.',
    precise:
      'The parietal pleura lines the whole space: over the ribs, on the diaphragm, along the mediastinum and into the apex at the end toward the head. The lung, covered by visceral pleura, lies within it. Most regions have a landmark of their own. The front, side and back of the chest wall share the ribs, and are told apart by where they lie: toward the sternum, around the port, or toward the spine. Where the telescope was aimed is a first guess, what is in view confirms it, and the top of the screen does neither.',
    checklistLabel: 'What tells the regions apart',
    checklist: [
      'Chest wall: the ribs, with the spaces between them',
      'Diaphragm: the dome at the base of the space, toward the feet',
      'Mediastinum: the inner wall, with the heart behind it',
      'Apex: the space narrowing like a cone toward the head',
    ],
    application:
      'On the tour in the Scope view, say at each stop what tells you where you are, before the name of the region appears.',
    claimIds: [
      'MT-C-0007',
      'MT-C-0009',
      'MT-C-0010',
      'MT-C-0011',
      'MT-C-0012',
      'MT-C-0013',
      'MT-C-0016',
    ],
  },
  teachingExample: 'space-made',
  controls: { shown: [], operable: [] },
  blocks: [
    {
      id: 'why-name-the-regions',
      role: 'framing',
      when: 'before-question',
      heading: 'Why the regions have names',
      body: 'Everything later in the course is placed by region: the order of the survey, where a finding is, where a sample is taken. The regions are named here, on a space that looks normal, so that a finding later has somewhere to be.\n\nThe division into seven regions is the course’s own, chosen for teaching.',
      zoneList: true,
      claimIds: ['MT-C-0009'],
    },
    {
      id: 'the-lining',
      role: 'normal-reference',
      when: 'before-question',
      heading: 'The lining and what it covers',
      body: 'The parietal pleura lines the inside of the chest: over the ribs and intercostal spaces, on the diaphragm, along the side of the mediastinum, and into the apex at the end toward the head. The heart lies in the mediastinum, behind that inner wall. The visceral pleura covers the lung, and between the two layers is the pleural space.',
      claimIds: ['MT-C-0010', 'MT-C-0011'],
    },
    {
      id: 'what-normal-looks-like',
      role: 'normal-reference',
      when: 'before-question',
      heading: 'What a normal space looks like',
      body: 'Through a normal parietal pleura the ribs can be seen, with the intercostal spaces between them. The diaphragm lies at the base of the space, toward the feet; in a patient it moves with each breath. The apex narrows like a cone.\n\nThe lung is pink and soft, with a fine network of lobules and scattered dark specks of anthracotic pigment. On the right, its oblique and horizontal fissures meet where the three lobes join.',
      claimIds: ['MT-C-0012', 'MT-C-0013', 'MT-C-0014', 'MT-C-0015', 'MT-C-0016'],
    },
    {
      id: 'what-is-in-view',
      role: 'mechanism',
      when: 'before-question',
      heading: 'What is in view, not which way is up',
      body: 'The patient lies on their side, and the picture on the screen can turn, so the top of the screen is not a fixed direction in the patient. What is in view keeps its meaning wherever it appears: ribs are chest wall anywhere on the screen.\n\nThe front, side and back of the chest wall all show ribs. They are told apart by where they lie: toward the sternum, around the port, or toward the spine.',
      claimIds: ['MT-C-0007', 'MT-C-0009', 'MT-C-0016'],
    },
  ],
  workedExample: {
    heading: 'Naming the first view',
    situation:
      'Suppose the first view is filled by a pink, soft surface with a fine network of lines and a few dark specks.',
    steps: [
      {
        action: 'Look for ribs beneath the lining.',
        reason:
          'Evenly spaced ribs with spaces between them would mean chest wall. There are none.',
      },
      {
        action: 'Look at the surface itself.',
        reason: 'Pink and soft, with a network of lobules and dark specks, is how the lung looks.',
      },
      {
        action: 'Name each region that comes into view around it.',
        reason:
          'Each is named by its own landmark: the chest wall by its ribs, the diaphragm by its place toward the feet.',
      },
    ],
    outcome:
      'The first view was the lung, named by its surface. The regions around it were named by their landmarks, not by which way the picture seemed to face.',
    claimIds: ['MT-C-0012', 'MT-C-0015', 'MT-C-0016'],
  },
  activity: {
    kind: 'tour',
    prompt:
      'The tour in the Scope view takes the telescope to each region in turn. At each stop, say what tells you where you are before the name of the region appears.',
    stops: [
      {
        zone: 'diaphragm',
        landmarks: ['diaphragm'],
        notice:
          'The dome at the base of the space, toward the feet. In a patient it moves with each breath.',
      },
      {
        zone: 'costophrenic-recess',
        landmarks: ['costophrenic-recess'],
        notice: 'The narrow angle where the diaphragm meets the chest wall, all the way round.',
      },
      {
        zone: 'posterior-chest-wall',
        landmarks: ['ribs'],
        notice: 'Ribs on the back of the chest wall, toward the spine.',
      },
      {
        zone: 'apex',
        landmarks: ['apex-cone'],
        notice: 'The space narrowing like a cone toward the head.',
      },
      {
        zone: 'anterior-chest-wall',
        landmarks: ['ribs'],
        notice: 'Ribs on the front of the chest wall, toward the sternum.',
      },
      {
        zone: 'mediastinum',
        landmarks: ['heart'],
        notice: 'The inner wall of the space, with the heart behind it.',
      },
      {
        zone: 'lateral-chest-wall',
        landmarks: ['ribs'],
        notice:
          'Ribs around the port. A straight-viewing telescope cannot look back at the wall it passes through, so part of this region stays out of view.',
      },
    ],
    claimIds: ['MT-C-0009', 'MT-C-0011', 'MT-C-0012', 'MT-C-0013', 'MT-C-0016', 'MT-C-0023'],
  },
  question: {
    id: 'MT-Q-06-a',
    kind: 'retrieval',
    purpose: 'Retrieval after the tour: from what is in view to the surface it belongs to.',
    stem: 'Beneath the lining in view, evenly spaced bands run side by side, with narrower gaps between them. Which surface is this?',
    choices: [
      {
        id: 'a',
        label: 'The diaphragm',
        feedback:
          'The diaphragm is the dome at the base of the space, toward the feet. Evenly spaced bands are not part of it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'The lung',
        feedback:
          'The lung is pink and soft, with a network of lobules. Bands with gaps between them lie beneath the parietal pleura, not the visceral.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'The chest wall',
        feedback:
          'Evenly spaced bands with gaps between them are ribs and intercostal spaces, seen through the parietal pleura of the chest wall.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'The mediastinum',
        feedback: 'The mediastinum is the inner wall, with the heart behind it. It has no ribs.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Ribs and the intercostal spaces between them can be seen through a normal parietal pleura, and they belong to the chest wall. The diaphragm is told by its place toward the feet, the mediastinum by the heart behind it, and the lung by its pink, lobular surface.',
    answerPhrases: [/chest wall/i],
    claimIds: ['MT-C-0010', 'MT-C-0011', 'MT-C-0012', 'MT-C-0015', 'MT-C-0016'],
  },
  transfer: {
    id: 'MT-Q-06-b',
    kind: 'retrieval',
    purpose:
      'The same principle when the picture has turned: what is in view, not the screen, names the region.',
    whatChanged:
      'A different landmark, with the picture turned, so that a reading by screen position leads elsewhere.',
    stem: 'The picture has turned, and a space narrowing like a cone now sits at the bottom of the screen. Which region is this?',
    choices: [
      {
        id: 'a',
        label: 'Diaphragm',
        feedback:
          'Once the picture has turned, the bottom of the screen is not the feet. The diaphragm is a dome, not a narrowing cone.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Costophrenic recess',
        feedback:
          'The recess is a narrow angle that runs all the way round where the diaphragm meets the chest wall. It does not close like a cone.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Mediastinum',
        feedback:
          'The mediastinum is the inner wall, with the heart behind it. It does not narrow like a cone.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Apex',
        feedback: 'A space narrowing like a cone is the apex, wherever it appears on the screen.',
        plausibility: 'best',
      },
    ],
    explanation:
      'Once the picture turns, the top and bottom of the screen are not fixed directions in the patient. What is in view names the region: the cone of the apex is the apex anywhere on the screen, just as ribs are chest wall anywhere on it.',
    answerPhrases: [/\bapex\b/i],
    claimIds: ['MT-C-0007', 'MT-C-0012', 'MT-C-0013', 'MT-C-0016'],
  },
  harmfulReflex: {
    move: 'Naming the region from which way the telescope seems to face, or from the top of the screen, instead of from what is in view.',
    risk: 'Every later step depends on knowing which surface is in view. Samples are usually taken from the parietal pleura rather than the lung, because a torn lung can bleed and leak air.',
    inThisModel:
      'The tour shows the name of each region after you have named it or asked. What a step on a misnamed surface would do is not modeled.',
    claimIds: ['MT-C-0008', 'MT-C-0019'],
  },
  misconceptions: [],
  modelLeavesOut: {
    shared: ['authored-anatomy', 'scan-position', 'no-motion'],
    section: [
      'The colour, sheen and small vessels of real pleura are not reproduced. The surfaces are drawn by the author on the scan.',
      'The scan comes from a patient with an effusion. The pleura is shown as it looks when normal, and what caused the effusion is not modeled.',
      'The right side only. The left side is not in the model.',
    ],
  },
  signals: [
    {
      name: 'Ribs, diaphragm, heart and great vessels',
      provenance: 'derived',
      label: 'Derived from CT segmentation',
      detail:
        'Built from the segmentation of one CT scan, with each structure identified by what the scan shows rather than by its segment name.',
      claimIds: ['MT-C-0017'],
    },
    {
      name: 'Pleura',
      provenance: 'authored',
      label: 'Authored construct',
      detail:
        'The scan does not show the pleura. It is drawn by the author on the scan’s surfaces.',
      claimIds: ['MT-C-0017'],
    },
    {
      name: 'Regions',
      provenance: 'authored',
      label: 'Authored construct',
      detail: 'The seven regions are the course’s own division, chosen for teaching.',
      claimIds: ['MT-C-0009'],
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
  usedAgainBy: ['four-controls', 'systematic-survey', 'reading-the-pleura'],
}
