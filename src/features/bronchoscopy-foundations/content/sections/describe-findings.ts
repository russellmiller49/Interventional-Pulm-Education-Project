import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M11 — Descriptive airway findings. An unexpected lesion appears during an inspection: the learner
 * decides what the report can carry and what happens next with the scope still in. The course has
 * no image of an abnormal airway, so the finding is given in words (R51) against a normal still of
 * the same airway. Knowledge spec §12 (S1 PDF 35–50, 61–70, 111–131, 145–150; S2 PDF 103–109;
 * T12; T04). R18 and R19 govern every statement about a narrowing's size and behavior.
 */
export const section: BronchSectionDefinition = {
  id: 'describe-findings',
  title: 'Findings in the airway',
  shortTitle: 'Findings',
  minutes: 8,
  moduleIds: ['M11'],
  objectives: [
    {
      objectiveId: 'M11-O1',
      subtask:
        'Chooses, field by field, the structure, caliber, distal view, mucosa and contents entries the examination supports for a lesion in the right main bronchus; in a practice case, inspects the wall a cleared plug covered and keeps the secretions’ appearance apart from a diagnosis.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O2',
      subtask:
        'Commits whether to record a smooth lesion with prominent vessels by its site and appearance or by the diagnosis it suggests, and refuses a histological label in the report.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O3',
      subtask:
        'Refuses, in the report, “safe to biopsy” and a single small sample for a lesion with prominent surface vessels, and holds sampling for experienced guidance; the prediction refuses a report line that clears it for biopsy.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O4',
      subtask:
        'Refuses, in the report, a narrowing “measured” from an uncalibrated monitor image and a dynamic collapse read from a single saved still.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M11-O5',
      subtask:
        'Builds the report under structure, mucosa and contents, with the narrowing given as a visual estimate of the diameter, and works out in the transfer how much cross-sectional area a halved diameter takes away.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D18'],
  prerequisites: ['shared-airway', 'right-side', 'left-side', 'systematic-survey'],

  clinicalQuestion:
    'A lesion appears on the wall of an airway during an inspection. What should the report say, and what is the next move?',
  recognizeTitle: 'A lesion on the wall of the right main bronchus',
  objective:
    'Decide, when the bronchoscope shows an unexpected finding, what the report should say and what should happen next in the airway.',
  why: 'What you write about a finding is what the next clinician acts on. What you do next, with the scope still in, is a separate decision made at the same moment.',
  newConcept:
    'A finding is described before it is diagnosed: its structure, mucosa and contents, located, and stated only as far as the examination could show them.',
  incrementSentence:
    'This section adds one idea to the survey you can now record: an inspected airway may hold a finding, and the report carries what was seen there, kept apart from what it is thought to be.',
  harmfulReflex:
    'Sampling a lesion at once because it is visible and its border is smooth, when prominent surface vessels make it potentially vascular.',
  anchor: {
    analogy:
      'A witness statement, not a verdict: where it was, what it looked like, and what could not be seen. The verdict — the diagnosis — needs evidence the witness did not have.',
    precise:
      'Structure is the lumen and the wall; mucosa is the surface; contents are what lies on the surface or in the lumen. Each is recorded with its site, its extent and the conditions under which it was seen, apart from the provisional diagnosis it suggests.',
    checklistLabel: 'Before naming a finding, record',
    checklist: [
      'Where: the airway, and which wall',
      'Structure: the lumen, its contour and how it behaved',
      'Mucosa and contents: surface, vessels, secretions, blood, protruding tissue',
      'What could not be seen or measured',
    ],
  },

  spineStops: ['main-bronchi'],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-change-the-plan',
    states: {
      insertion: 'not-this-one',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'harmful-reflex',
    },
    sentence:
      'No control answers a finding. The tempting one is the accessory state — opening forceps on a potentially vascular lesion — and the forceps stay on the tray; what changes is the report, and the plan agreed with experienced guidance.',
  },
  precommitDenyPatterns: [
    /\bpause\b/i,
    /experienced guidance/i,
    /before any sampling/i,
    /described before it is diagnosed/i,
    /\bby eye\b/i,
  ],
  modelBoundary:
    'The finding in this section is given in words, because the course has no image of an abnormal airway; the still in the Simulator panel is a normal right main bronchus, for comparison. Choosing entries on a card is practice for the report you will write and speak, which faculty review.',
  localPolicyIds: [],
  reviewItemIds: ['R18', 'R19', 'R20', 'R34', 'R51'],

  blocks: [
    {
      id: 'something-unexpected',
      kind: 'question',
      role: 'framing',
      heading: 'Something you did not expect',
      body: 'Partway through a survey, the view shows something that is not normal airway. Two decisions arrive at once: what goes into the report, and what happens next with the scope still in.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 109 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      ],
    },
    {
      id: 'normal-right-main',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The normal right main bronchus',
      body: 'The still in the Simulator panel comes from a normal survey. The right main bronchus is open and round in contour, and its mucosa is smooth and even, without erythema, edema or nodularity. There is no mass, no blood and no narrowing; a few small bubbles cling to the upper edge of the image.\n\nThat is the reference for what follows. Normal-appearing mucosa, the contour the cartilage gives the wall and a recognizable posterior membrane are the features to recognize first, so that a change from them can be seen.',
      media: { kind: 'endoscopic-still', structureId: 'rmb', outline: false },
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 50 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 105, to: 107 } },
      ],
    },
    {
      id: 'the-finding',
      kind: 'signals',
      role: 'signals',
      heading: 'The finding, in words',
      body: 'Read the finding against the normal still in the Simulator panel.',
      pointsLabel: 'What the view and the room show',
      points: [
        'A smooth, broad-based lesion rising from the lateral wall of the proximal right main bronchus into the lumen; the airway beyond it is only partly in view',
        'Prominent vessels over its surface; no ulceration or necrotic material',
        'No blood, clot or secretions on it or around it; the scope has not touched it',
        'The lumen narrowed to about half its usual width on the monitor, with nothing of known size in view',
        'Through quiet breathing the lumen’s caliber looked the same; one still saved',
        'The indication was a chronic cough and no lesion was expected; forceps are on the tray, and the patient is stable at the planned depth of sedation',
      ],
      claimClass: 'design',
      sourceRefs: [
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:10:36', end: '00:15:50' },
        },
      ],
    },
    {
      id: 'structure-mucosa-contents',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Structure, mucosa and contents',
      body: 'Three observation categories organize a description. A report that says only “abnormal airway” loses what is needed to reason about both the diagnosis and the procedural risk.\n\nFor a narrowing, say whether the tissue is within the lumen, the wall is compressed from outside, or both, as far as the examination and imaging support it. Pink, pale, hyperemic, nodular and friable are observations; sarcoidosis, invasive fungal infection, carcinoid and cancer need further context and evidence.',
      pointsLabel: 'What each category holds',
      points: [
        'Structure: lumen size and contour, fixed or dynamic narrowing, length and distribution, fistulae, anomalous branching',
        'Mucosa: color, surface, edema, nodularity, ulceration, necrosis, vascularity, friability, distribution',
        'Contents: secretions, blood or clot, protruding tissue, aspirated material',
      ],
      claimClass: 'transcript-source',
      sourceRefs: [
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:00:36', end: '00:04:27' },
        },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:10:36', end: '00:15:50' },
        },
      ],
    },
    {
      id: 'finding-described',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The finding, described',
      body: 'A useful description answers six questions. Worked through the lesion in this section, they give the entry for the report: “A smooth, broad-based lesion with prominent surface vessels arises from the lateral wall of the proximal right main bronchus and narrows the lumen to about half its diameter by visual estimate; the airway beyond it was only partly seen. Its caliber did not change visibly in quiet breathing; change on cough or forced exhalation was not assessed. It was not touched, and its vascular appearance prompted reassessment before sampling.”',
      pointsLabel: 'The six questions, answered',
      points: [
        'Where? The lateral wall of the proximal right main bronchus.',
        'How extensive? One broad-based lesion; what lies beyond the wall cannot be seen from the lumen.',
        'What surface? Smooth, with prominent vessels; no ulceration, necrosis or blood. It has not been touched, so how it bleeds on contact is unknown.',
        'What effect on the lumen? Narrowed to about half its diameter, judged by eye; nothing was measured. The airway beyond it was only partly seen, and the scope was not advanced beyond the narrowing just to see more.',
        'How dynamic? No visible change in quiet breathing, the only condition watched; change on cough or forced exhalation was not assessed.',
        'How certain? A description. The diagnosis awaits further evidence.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 109 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:10:36', end: '00:15:50' },
        },
      ],
    },
    {
      id: 'findings-that-pause',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Findings that call for a pause',
      body: 'Some findings change the procedural risk. They call for a deliberate reassessment and experienced guidance, and the novice’s first task is to recognize and communicate the finding, not to attempt an unplanned intervention. Seeing an abnormality does not oblige an immediate biopsy, and the scope is not advanced beyond a narrowing merely to complete the survey.\n\nAppearance can also suggest more than it shows. Granulation tissue can resemble a tumor and can surround a stent or a retained object; its appearance does not establish malignancy, and it needs diagnostic evaluation like any other finding.',
      pointsLabel: 'Recognize, communicate and reassess with experienced guidance',
      points: [
        'A potentially vascular or pulsatile lesion',
        'Severe narrowing, or a friable mass near a critical narrowing',
        'Active significant bleeding: sampling stops, the site is announced and the supervisor’s bleeding plan starts at once',
        'Necrotic mucosa, or a suspected wall defect',
        'A foreign body embedded in inflamed tissue',
        'Unfamiliar postoperative anatomy',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 129, to: 130 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 145, to: 150 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 138, to: 143 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 27, to: 30 } },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:05:16', end: '00:09:15' },
        },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:13:27', end: '00:17:28' },
        },
        {
          sourceId: 'T04',
          location: { kind: 'time-span', start: '00:08:47', end: '00:11:48' },
        },
      ],
      reviewItemIds: ['R20', 'R34'],
    },
    {
      id: 'still-and-screen',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What a still and a screen cannot show',
      body: 'Apparent size changes with the distance from the tip and the viewing angle, so an uncalibrated picture gives no measurement. An estimate is written as an estimate, with the method when one is defined, the reference segment it was compared with and its uncertainty, and it says whether it describes the diameter or the cross-sectional area. In an ideal circle, area varies with the square of the diameter, so the two give different numbers for the same narrowing; that relation does not validate a visual estimate in an irregular or compressed airway. No estimate is a symptom or treatment rule: consequences depend on the site, the length, dynamic behavior, respiratory demand and the rest of the patient’s physiology.\n\nA still is a single moment and cannot establish dynamic collapse. Whether the caliber changes through breathing is described with the site, the extent, the maneuver and the conditions under which it was watched. A single collapse threshold can overlap normal findings, so expiratory narrowing is observed and correlated clinically rather than converted into a diagnosis.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 44, to: 45 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 69 } },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:00:36', end: '00:04:27' },
        },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:01:29', end: '00:03:01' },
        },
        {
          sourceId: 'T16',
          location: { kind: 'time-span', start: '00:25:57', end: '00:27:43' },
        },
      ],
      reviewItemIds: ['R18', 'R19'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors writes down more, or less, than the examination showed.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Recording the diagnosis an appearance suggests as the finding: record the appearance first; a suggested diagnosis follows as a provisional differential, labeled as one.',
        'Writing only “abnormal”: give the site, the extent, the surface, the effect on the lumen and what could not be seen.',
        'Sampling a lesion because it is visible: a potentially vascular lesion is reassessed with experienced guidance first.',
        'Reading a size off the screen: call an estimate an estimate, and say whether it means diameter or area.',
        'Calling collapse from a still: describe dynamic narrowing with the maneuver and conditions under which it was watched.',
        'Taking a cleared plug as the whole story: inspect the wall it covered, and describe it separately; an adherent clot that may be containing bleeding is not removed just to complete the inspection.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 104, to: 109 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 131 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 44, to: 45 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 69 } },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:00:36', end: '00:04:27' },
        },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:01:29', end: '00:03:01' },
        },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:10:36', end: '00:15:50' },
        },
      ],
      reviewItemIds: ['R18', 'R19'],
    },
  ],

  workspace: {
    kind: 'media',
    caption:
      'A normal right main bronchus from an annotated survey, for comparison. The finding in this section has no image; it is given in words.',
    media: [{ kind: 'endoscopic-still', structureId: 'rmb', outline: false }],
  },

  steps: {
    recognize: {
      instruction:
        'In the Simulator panel, look at the normal right main bronchus; then read “The finding, in words” in the Teaching panel and note how the finding differs from it.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.image,
        alsoPane: 'teaching',
        alsoLandmark: 'The finding, in words',
      },
    },
    act: {
      title: 'The finding, field by field',
      instruction: `For each of ${STEPS_LANDMARKS.report}, choose the entry the examination supports; an entry it does not support is refused, with the reason. The normal still stays in the Simulator panel for comparison.`,
      lookIn: {
        pane: 'steps',
        landmark: STEPS_LANDMARKS.report,
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.image,
      },
    },
    explain: {
      title: 'What the report can carry',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and “Findings that call for a pause” in the Teaching panel, then, on this card, why the other answers to the prediction do not fit.`,
    },
  },

  act: {
    kind: 'report',
    report: {
      id: 'right-main-lesion-report',
      prompt:
        'Write the report entry for the lesion in the right main bronchus, and the plan it leads to. For each field, choose what the examination supports.',
      evidenceTitle: 'What the examination showed',
      fields: [
        {
          id: 'structure',
          label: 'Structure: the wall and the lumen',
          evidence:
            'A smooth, broad-based lesion rises from the lateral wall of the proximal right main bronchus into the lumen and narrows it. Judged by eye on the monitor, with nothing of known size in view, the lumen beside it looks about half its usual width.',
          options: [
            {
              id: 'located-estimate',
              label:
                'Broad-based lesion, lateral wall of the proximal right main bronchus; lumen narrowed to about half its diameter, by visual estimate',
              supported: true,
              rationale:
                'It names the airway, the wall and the attachment, gives the effect on the lumen as a fraction of the diameter, and labels that fraction a visual estimate.',
            },
            {
              id: 'measured-area',
              label:
                'Lumen of the proximal right main bronchus narrowed by half of its cross-sectional area, as measured on the monitor',
              supported: false,
              rationale:
                'Nothing was measured. Apparent size changes with tip distance and angle on an uncalibrated image, and an impression of width is not an area.',
            },
            {
              id: 'bare-half',
              label:
                'Lesion of the lateral wall of the proximal right main bronchus, narrowing it by half',
              supported: false,
              rationale:
                '“By half” does not say whether it is the diameter or the cross-sectional area, or how it was judged, and the two give different numbers for the same narrowing.',
            },
            {
              id: 'extrinsic-unlikely',
              label:
                'Endoluminal lesion of the lateral wall of the proximal right main bronchus; extrinsic compression unlikely on appearance',
              supported: false,
              rationale:
                '“Unlikely on appearance” still reads beyond the wall. The scope sees the lumen and its surface; what lies outside the wall needs imaging and other evidence, and endoscopy alone may not define an external process.',
            },
          ],
        },
        {
          id: 'behavior',
          label: 'Caliber through breathing',
          evidence:
            'The lumen was watched during quiet breathing, when its caliber looked the same throughout, and one still was saved. No deep breath, cough or forced exhalation was observed.',
          options: [
            {
              id: 'not-assessed',
              label:
                'No visible change in caliber through quiet breathing; change on cough or forced exhalation not assessed',
              supported: true,
              rationale:
                'It records what the caliber did and the conditions it was watched under, and names the behavior that was not examined, so a reader does not take the entry for a fixed narrowing.',
            },
            {
              id: 'fixed',
              label:
                'Probably a fixed narrowing, since its caliber looked the same through quiet breathing',
              supported: false,
              rationale:
                'Only quiet breathing was watched; no deep breath, cough or forced exhalation was observed. “Fixed” claims how the lumen behaves under conditions that were not examined, however it is hedged.',
            },
            {
              id: 'collapse-on-still',
              label: 'Dynamic collapse of the airway, shown on the saved still',
              supported: false,
              rationale:
                'A still is one moment. Dynamic behavior is described from watching the lumen through breathing, with the maneuver and conditions named.',
            },
          ],
        },
        {
          id: 'beyond',
          label: 'The airway beyond the lesion',
          evidence:
            'Past the narrowing, the airway beyond the lesion is only partly in view. The scope has not been advanced beyond the narrowing.',
          options: [
            {
              id: 'partly-seen',
              label: 'Only partly seen beyond the narrowing; the scope was not advanced beyond it',
              supported: true,
              rationale:
                'It says how far the view reached and why it stopped there, so the next clinician does not read the airway beyond an obstruction as inspected.',
            },
            {
              id: 'beyond-normal',
              label: 'Normal-appearing airways beyond the lesion',
              supported: false,
              rationale:
                'Only part of the airway beyond the lesion was in view. Writing it as normal records an inspection that did not happen.',
            },
            {
              id: 'beyond-not-examined',
              label: 'Airway beyond the lesion not examined',
              supported: false,
              rationale:
                'Part of the airway beyond the lesion was in view, and the report says how much. “Not examined” discards what was seen and does not say why the view stopped at the narrowing.',
            },
          ],
        },
        {
          id: 'mucosa',
          label: 'Mucosa: the surface',
          evidence:
            'The lesion’s surface is smooth, with prominent vessels over it. No ulceration or necrotic material is seen. The mucosa around it looks like the normal still.',
          options: [
            {
              id: 'surface-described',
              label:
                'Smooth surface with prominent vessels; no ulceration or necrosis; surrounding mucosa normal-appearing',
              supported: true,
              rationale:
                'Each term is something that was seen, and the prominent vessels are recorded because they bear on bleeding risk.',
            },
            {
              id: 'carcinoid',
              label:
                'Smooth surface with prominent vessels, most likely a carcinoid; no ulceration or necrosis; surrounding mucosa normal-appearing',
              supported: false,
              rationale:
                'Every observation in it holds, but “most likely a carcinoid” is a provisional diagnosis written into the surface description. The mucosa field records what was seen; a suspected diagnosis, however hedged, needs further context and evidence and is kept apart from it.',
            },
            {
              id: 'benign',
              label: 'Benign lesion: a smooth surface without ulceration excludes malignancy',
              supported: false,
              rationale:
                'Smoothness is an observation, not a histology. A smooth surface does not prove the absence of disease beneath it.',
            },
          ],
        },
        {
          id: 'contents',
          label: 'Contents: on the lesion and in the lumen',
          evidence:
            'The lesion is tissue protruding into the lumen; its attachment and effect on the lumen are recorded under structure. No blood, clot or secretions lie on the lesion or in the lumen around it. The scope has not touched it.',
          options: [
            {
              id: 'dry-untouched',
              label:
                'Lesion tissue protruding into the lumen; no blood, clot or secretions on or around it; not touched by the scope',
              supported: true,
              rationale:
                'It records the protruding tissue, what lies on it, and that nothing has disturbed it, which the next operator needs before any contact.',
            },
            {
              id: 'no-bleeding-tendency',
              label: 'No bleeding tendency: the surface is dry and nothing has oozed',
              supported: false,
              rationale:
                'Nothing has touched the lesion, so how it bleeds on contact is unknown. A dry surface does not show what its vessels will do if sampled.',
            },
            {
              id: 'no-contact-bleeding',
              label:
                'Lesion tissue protruding into the lumen, dry, with no contact bleeding; no clot or secretions on or around it',
              supported: false,
              rationale:
                '“No contact bleeding” reports a contact that never happened. The scope has not touched the lesion, so how it bleeds on contact is unknown.',
            },
          ],
        },
        {
          id: 'sampling',
          label: 'The plan, before any sampling',
          evidence:
            'The patient is stable. Forceps are on the tray. No lesion was expected, and none was planned for sampling.',
          options: [
            {
              id: 'hold-and-review',
              label:
                'Potentially vascular: sampling held for reassessment with experienced guidance',
              supported: true,
              rationale:
                'Prominent vessels make the lesion potentially vascular, which calls for deliberate reassessment and experienced guidance before anything touches it; sampling may follow once that reassessment of vascularity and risk, and the patient’s consent, support it.',
            },
            {
              id: 'safe-to-biopsy',
              label: 'Safe to biopsy now: the border is smooth and the surface is dry',
              supported: false,
              rationale:
                'A smooth border and a dry surface do not make a lesion with prominent vessels safe to sample. Calling it safe on that basis is the error this field exists to stop.',
            },
            {
              id: 'sample-every-lesion',
              label: 'Biopsy before withdrawing, since any visible lesion should be sampled',
              supported: false,
              rationale:
                'Seeing an abnormality does not oblige a biopsy. Sampling follows the clinical question, what the patient consented to and the risk, and this lesion’s vessels have changed the risk.',
            },
            {
              id: 'one-small-sample',
              label:
                'Probably low bleeding risk on appearance: take one small forceps sample and watch the site',
              supported: false,
              rationale:
                'One small bite is still contact with a lesion whose prominent vessels make it potentially vascular. The risk is reassessed with experienced guidance before any sample, not probed with one.',
            },
          ],
        },
      ],
      sourceRefs: [
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:00:36', end: '00:04:27' },
        },
        {
          sourceId: 'T12',
          location: { kind: 'time-span', start: '00:10:36', end: '00:15:50' },
        },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 109 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        {
          sourceId: 'T09',
          location: { kind: 'time-span', start: '00:05:45', end: '00:11:55' },
        },
      ],
    },
  },

  prediction: {
    id: 'N09',
    itemType: 'management-decision',
    situation:
      'During an inspection under moderate sedation for a chronic cough, the view of the proximal right main bronchus shows a smooth, broad-based lesion rising from the lateral wall into the lumen and narrowing it, with prominent vessels over its surface. Nothing of known size is in view. There is no blood on it. The patient is stable. No lesion was expected, and forceps are on the tray.',
    stem: 'Which line should the report carry for this lesion?',
    choices: [
      {
        id: 'a',
        label:
          'Smooth, dry, broad-based lesion with prominent surface vessels, proximal right main bronchus; benign-appearing and suitable for biopsy while the scope is in position',
        rationale:
          'The observations hold, but “benign-appearing and suitable for biopsy” is a verdict the examination cannot give. Prominent vessels make the lesion potentially vascular, and a smooth, dry surface does not show what they will do on contact; a report that clears the lesion for sampling invites contact before anyone has reassessed it.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label:
          'Probable carcinoid tumor with prominent surface vessels, lateral wall of the proximal right main bronchus, narrowing it by about half',
        rationale:
          '“Probable carcinoid” puts a provisional diagnosis where the description belongs, and “about half” does not say whether it means the diameter or the area, or how it was judged. A differential, labeled as one, follows the description; it does not replace it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'Broad-based lesion, lateral wall of the proximal right main bronchus, with prominent surface vessels; narrowing estimated by eye',
        rationale:
          'It locates the lesion, records the surface feature that bears on bleeding risk, and labels the narrowing as a visual estimate: what was seen, and how, without a diagnosis the image cannot give.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Abnormal right main bronchus; a still saved for the report',
        rationale:
          'A bare “abnormal” drops the site, the surface and the vessels, so the next operator is not warned that the lesion is potentially vascular. A saved still supplements a description; it does not replace one.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'An unexpected lesion is reported as seen — site, attachment, surface, vessels and effect on the lumen, with the narrowing labeled as an estimate — and a diagnosis its appearance suggests is kept apart from the description, as a provisional differential that needs further evidence. The prominent vessels belong in the report because they make the lesion potentially vascular: a finding that calls for a pause and experienced guidance before any sampling. A smooth border does not make it safe to biopsy.',
    objectiveIds: ['M11-O2', 'M11-O3'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 109 } },
      {
        sourceId: 'T12',
        location: { kind: 'time-span', start: '00:05:16', end: '00:09:15' },
      },
    ],
  },

  transfer: {
    id: 'Q18',
    seedId: 'Q18',
    itemType: 'mechanism-interpretation',
    situation:
      'At a handover, the note from an outside bronchoscopy says only that the left main bronchus is “narrowed by half”. It does not say whether that describes the diameter or the cross-sectional area, or how it was estimated.',
    stem: 'If the note’s “half” is half the diameter of an ideal circular lumen, what has the narrowing taken away?',
    choices: [
      {
        id: 'a',
        label: 'A quarter of the cross-sectional area',
        rationale:
          'Squaring a half gives a quarter, but that quarter is the area that remains, not the area taken away; the other three-quarters is lost.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Half of the cross-sectional area',
        rationale:
          'Area varies with the square of the diameter, not in proportion to it, so a halved diameter takes away more than half the area.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Three-quarters of the cross-sectional area',
        rationale:
          'Area is proportional to the diameter squared: half the diameter leaves a half times a half, a quarter, of the area, so three-quarters is lost.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Three-quarters of the airflow through the airway',
        rationale:
          'Area arithmetic is not an airflow equation: flow and symptoms depend on the site, the length, dynamic behavior, respiratory demand and the rest of the patient’s physiology.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Area is proportional to the square of the diameter, so halving the diameter of an ideal circle leaves a quarter of the area and takes away three-quarters. “Narrowed by half” could therefore describe two very different narrowings, which is why a bare fraction should prompt the questions of which measure was meant, against which reference segment, how it was estimated and how uncertain it is. The arithmetic is not an airflow equation and does not validate a visual estimate in an irregular human airway.',
    objectiveIds: ['M11-O5'],
    claimClass: 'synthesis',
    sourceRefs: [
      {
        sourceId: 'T12',
        location: { kind: 'time-span', start: '00:01:29', end: '00:03:01' },
      },
      {
        sourceId: 'T16',
        location: { kind: 'time-span', start: '00:25:57', end: '00:27:43' },
      },
    ],
    reviewItemIds: ['R18'],
    transferVariant:
      'From writing the size entry at the scope — about half the diameter, by visual estimate — to a bare “narrowed by half” in another operator’s note: which measure a fraction names, worked as ideal-circle arithmetic.',
  },

  practice: [
    {
      id: 'mc-plug-then-lesion',
      presentationTitle: 'Thick secretions in the bronchus intermedius',
      situation:
        'During an inspection under moderate sedation for a persistent opacity in the right lower lobe, thick, adherent tan secretions fill the bronchus intermedius. Suction clears them, the patient stays stable, and the bronchus intermedius is open to view again, with a little secretion further down.',
      item: {
        id: 'mc-plug-then-lesion',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label: 'Record a cleared mucus plug as the cause of the obstruction',
            rationale:
              'A plug can occlude an otherwise normal airway, but it can also overlie a lesion. Calling the obstruction entirely secretory before the uncovered wall is inspected assumes the answer.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label:
              'Look at the newly uncovered wall of the bronchus intermedius and describe it on its own',
            rationale:
              'The secretions hid part of the wall. Inspecting what they covered, and describing it apart from the secretions, is how a lesion beneath a plug is found rather than assumed away.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label:
              'Describe the secretions’ color, consistency and extent, then inspect the airways beyond them',
            rationale:
              'Color, consistency and extent are sound secretion vocabulary, and the distal airways do need inspecting, but the wall the secretions covered is skipped on the way.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Record purulent bronchitis of the bronchus intermedius',
            rationale:
              'Thick tan secretions are recorded by color and consistency; even “purulent-appearing” is an observation, not the identification of an organism, and bronchitis is a diagnosis. The newly visible wall is still uninspected.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A mucus plug can block an otherwise normal airway, but an apparent plug can also lie over a lesion. Once the airway is safely cleared, the newly visible wall is inspected and described in its own right, and the secretions are recorded separately, by their appearance: “purulent-appearing” is an observation, not an organism.',
        objectiveIds: ['M11-O1', 'M11-O2'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 104, to: 109 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 131 } },
        ],
      },
    },
  ],
}
