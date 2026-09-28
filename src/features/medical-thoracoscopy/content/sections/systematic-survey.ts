import type { ThoracoscopySectionSpec } from '../types'

/**
 * Section 11, "Look everywhere, in order". Application, Survey and intervention.
 *
 * The one new idea is the survey itself: an order, kept to, with each region noted as it is seen.
 * The learner keeps the note, in words and not stored; the Chest view shows the model's own
 * estimate beside it, and the two are compared. The space is normal; disease first appears in the
 * next section. The section opens from the loaded teaching example because making room is taught
 * in a section not written in this round (module plan, "The first round").
 */
export const section: ThoracoscopySectionSpec = {
  id: 'systematic-survey',
  revision: 1,
  spinePhase: 'Survey',
  objective:
    'Survey a normal right pleural space in one order, and say for each region whether you saw it, saw part of it or did not, and why.',
  suggestedBackground: ['normal-pleural-space', 'four-controls', 'making-room'],
  newConcept: 'A survey is an order, recorded region by region.',
  increment:
    'The four controls, plus one idea: an order to use them in, with each region noted as you go.',
  clinicalQuestion:
    'Before any sample is taken, how do you know which parts of the space you have looked at?',
  anchor: {
    analogy:
      'Reading a chest radiograph in a fixed order. You look at the same areas in the same order every time, so one striking finding does not stop you looking at the rest, and afterwards you can say what you reviewed.',
    precise:
      'A survey visits every region of the space in one order and notes each as it goes: seen, partly seen or not seen, and for a region not fully seen, why. The sources ask for the whole space to be inspected systematically and lay down no order; this course keeps one order, every time. The Chest view shows the model’s estimate of what the telescope could see, to set beside your note. Seeing every region in the model is not an adequate examination.',
    checklistLabel: 'The survey in four habits',
    checklist: [
      'Orient first: find the diaphragm at the base of the space, toward the feet',
      'Keep to one order, every time',
      'Note each region: seen, partly seen or not seen',
      'For anything not fully seen, say why',
    ],
    application:
      'In the Scope view, survey the seven regions in order, say your note for each, and then compare it with the Chest view.',
    claimIds: ['MT-C-0009', 'MT-C-0012', 'MT-C-0018', 'MT-C-0020'],
  },
  teachingExample: 'space-made',
  controls: { shown: ['scope'], operable: ['scope'] },
  blocks: [
    {
      id: 'why-an-order',
      role: 'framing',
      when: 'before-question',
      heading: 'Why an order',
      body: 'The whole pleural space is looked at before any sample is taken: the chest wall, the diaphragm, the mediastinum, the apex and the lung surface. Early metastatic deposits often lie at the back and near the diaphragm, so those regions must be seen before the space is called clear.\n\nOne recent guideline lays down no standard order. What matters is that every region is reached. An order you keep to takes you to each one, and lets you say afterwards which you saw and which you did not. Samples come after the survey; where they are taken is taught in “Parietal biopsies”.',
      claimIds: ['MT-C-0009', 'MT-C-0018'],
    },
    {
      id: 'the-order',
      role: 'normal-reference',
      when: 'before-question',
      heading: 'The order this course uses',
      body: 'The course surveys the seven regions of the parietal pleura in the order listed here. It starts at the diaphragm, where the telescope is first turned to drain the fluid. It ends with the side of the chest wall around the port, which a straight-viewing telescope cannot look back at.\n\nThe order is the course’s own, chosen for teaching.',
      zoneList: true,
      claimIds: ['MT-C-0009', 'MT-C-0012', 'MT-C-0023'],
    },
    {
      id: 'the-note-and-the-estimate',
      role: 'mechanism',
      when: 'before-question',
      heading: 'Your note and the Chest view',
      body: 'As you survey, note each region in one of three ways: seen, partly seen or not seen. A region not fully seen carries one of three reasons: not looked at yet; looked at, but hidden at the moment, for example by the lung; or out of reach of the telescope from this port.\n\nThe Chest view, the picture of the whole chest beside the Scope view, shows the model’s estimate for each region in the same words. It has no number and no total. The model cannot tell a glimpse from a careful look, so a region it shows as seen was in view, not necessarily examined.',
      claimIds: ['MT-C-0020'],
    },
    {
      id: 'what-hides-a-region',
      role: 'common-errors',
      when: 'before-question',
      heading: 'What hides a region',
      body: "A lung that has partly collapsed can hide parts of the back of the chest wall and the mediastinum from a rigid telescope. A region hidden from one position may come into view from another angle or depth; a region out of reach from this port does not. In a patient, a region that stays hidden may need a second port. This model has one port.\n\nIn other patients, adhesions or loculations can hide the back of the chest wall. They are taught in “When the lung won't fall away”.",
      claimIds: ['MT-C-0020', 'MT-C-0021', 'MT-C-0022', 'MT-C-0023'],
    },
  ],
  workedExample: {
    heading: 'A region the lung hides',
    situation:
      'Suppose that, near the end of the survey, the lung lies across part of the mediastinum.',
    steps: [
      {
        action: 'With Depth, draw back a little, then change the angle with Pivot.',
        reason:
          'A region hidden from one position may come into view from another, and drawing back first moves the tip away from the lung before it turns.',
      },
      {
        action: 'If part stays hidden, note the mediastinum as partly seen, hidden by the lung.',
        reason: 'The note says what was seen, and why the rest was not.',
      },
      {
        action: 'Go on to the last region in the order.',
        reason: 'Keeping to the order is what takes the survey to every region.',
      },
    ],
    outcome:
      'The survey ends with every region noted. One carries a reason, and anyone reading the note can see which and why.',
    claimIds: ['MT-C-0005', 'MT-C-0020'],
  },
  activity: {
    kind: 'survey',
    prompt:
      'In the Scope view, survey the seven regions in order. For each one, say whether you saw it, saw part of it or did not, and why; then compare your note with the Chest view.',
    order: [
      'diaphragm',
      'costophrenic-recess',
      'posterior-chest-wall',
      'apex',
      'anterior-chest-wall',
      'mediastinum',
      'lateral-chest-wall',
    ],
    claimIds: ['MT-C-0009', 'MT-C-0020'],
  },
  question: {
    id: 'MT-Q-11-a',
    kind: 'retrieval',
    purpose:
      'Which reason applies to a region that no angle or depth brings into view, with nothing in the way.',
    stem: 'Near the end of the survey, part of the chest wall right around the port stays out of view from every angle and depth you try, with nothing in the way. What goes in your note?',
    choices: [
      {
        id: 'a',
        label: 'Partly seen, hidden by something in the way',
        feedback:
          'Nothing was in the way. A hidden region can come into view from another position, and this one did not from any.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Seen, since the telescope was aimed at it',
        feedback: 'Aiming at a region is not seeing it. Part of it never came into view.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Partly seen, out of reach from this port',
        feedback:
          'From every angle and depth, with nothing in the way, part of the region stays out of view: it is out of reach of the telescope from this port.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Not seen, not looked at yet',
        feedback:
          'It was looked at, and part of it was seen. The reason is not that it was skipped.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Each reason says why a region was not fully seen. Hidden means something was in the way and another position might help; not looked at means it was skipped; out of reach means no angle or depth from this port brings it into view. Around the port, a straight-viewing telescope cannot look back at the wall it passes through.',
    answerPhrases: [/out of reach/i],
    claimIds: ['MT-C-0020', 'MT-C-0023'],
  },
  transfer: {
    id: 'MT-Q-11-b',
    kind: 'retrieval',
    purpose: 'The note used after the survey, to write what was seen and no more.',
    whatChanged:
      'After the survey instead of during it: the same note, used to write what the survey showed.',
    stem: 'The survey is finished and everything in view looked normal. The mediastinum and the back of the chest wall were each partly seen, hidden by the lung; the other five regions were seen. Which sentence belongs in the report?',
    choices: [
      {
        id: 'a',
        label:
          'Normal where seen; the mediastinum and the back of the chest wall were partly hidden by the lung.',
        feedback:
          'This says what was seen, what was not fully seen and why, and claims nothing beyond it.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The pleura looked normal, and the survey was complete.',
        feedback:
          'Two regions were only partly seen, so the note cannot support a complete survey or normal pleura everywhere.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Two regions were not fully seen, because the lung was in the way.',
        feedback:
          'True, but a reader needs to know which two: the back of the chest wall is among the regions that must be seen before the space is called clear.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'd',
        label:
          'The mediastinum and the back of the chest wall can be counted as normal, because the rest of the pleura was.',
        feedback:
          'What was not seen cannot be inferred from what was, and the back of the chest wall is among the regions that must be seen before the space is called clear.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A report of a survey carries the same facts as the note: what was seen, what was not fully seen, and why. A sentence that goes beyond the note, such as calling the survey complete, says more than the survey showed.',
    answerPhrases: [/normal where seen/i],
    claimIds: ['MT-C-0018', 'MT-C-0020'],
  },
  harmfulReflex: {
    move: 'Calling a region seen after a glimpse, or calling the survey complete once most of the space has been looked at.',
    risk: 'The note then claims more than the survey showed. The space may be called clear before all of it has been seen, including the back of the chest wall and the costophrenic recess, where early metastatic deposits often lie.',
    inThisModel:
      'The Chest view shows what the model estimates the telescope could see. It cannot tell a glimpse from a careful look, so a region it shows as seen may not have been examined. What a missed finding would have meant is not modeled.',
    claimIds: ['MT-C-0018', 'MT-C-0020'],
  },
  misconceptions: [],
  modelLeavesOut: {
    shared: ['authored-anatomy', 'scan-position', 'no-motion', 'not-competence'],
    section: [
      'The Chest view is the model’s estimate of what the telescope could see. It does not measure how well the pleura was examined, and seeing every region in the model is not an adequate examination.',
      'The lung surface is looked at in a real survey too. This model does not keep track of it.',
      'The space looks normal. What disease looks like, and where, is taught in “What you see and where”.',
    ],
  },
  signals: [
    {
      name: 'Regions and their order',
      provenance: 'authored',
      label: 'Authored construct',
      detail: 'The seven regions and the order are chosen by the author for teaching.',
      claimIds: ['MT-C-0009'],
    },
    {
      name: 'Chest view estimate',
      provenance: 'authored',
      label: 'Authored construct',
      detail:
        'The model’s estimate of what the telescope could see, from the field of view, the distance, the angle and whatever is in the way.',
      claimIds: ['MT-C-0020'],
    },
    {
      name: 'Ribs, diaphragm, heart and great vessels',
      provenance: 'derived',
      label: 'Derived from CT segmentation',
      detail: 'Built from the segmentation of one CT scan.',
      claimIds: ['MT-C-0017'],
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
      detail: 'Chosen by the author so that there is room to look. Not measured.',
      claimIds: ['MT-C-0002'],
    },
  ],
  usedAgainBy: ['reading-the-pleura', 'taking-biopsies', 'P3'],
}
