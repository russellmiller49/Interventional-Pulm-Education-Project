import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M07 — Upper airway, larynx, and tracheal entry. The Enter phase: the learner examines the larynx
 * before crossing it, crosses the glottis while the true folds are apart and without force,
 * re-identifies the trachea, and plans a withdrawal that neither claims an unseen larynx nor removes
 * an established airway to see it. Knowledge spec §5.6, §6.1, §10, §16.4, §17.1 (S1 PDF 51–65,
 * 71–79, 98–100, 115–117, 155–158; S2 PDF 27, 46, 106–107, 161–163; S3 PDF 81; T03; T11). Register
 * items R04, R05, R08, R13.
 */
export const section: BronchSectionDefinition = {
  id: 'larynx-and-entry',
  title: 'The larynx and entry to the trachea',
  shortTitle: 'Larynx and entry',
  minutes: 7,
  moduleIds: ['M07'],
  objectives: [
    {
      objectiveId: 'M07-O1',
      subtask:
        'Decides, in a practice case on the airway model, what the tip is aimed at when the arytenoid region is taken for the opening, and which pair of folds bounds the opening into the trachea.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M07-O2',
      subtask:
        'Commits the moment to cross from the movement of the true folds with breathing and phonation, and records a larynx hidden by a tube as not assessed.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M07-O3',
      subtask:
        'Decides, in a practice case, what resistance, pain and bleeding during a nasal entry change, including a change to the oral approach; controlled model entry is observed by faculty.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M07-O4',
      subtask:
        'In the bronchoscope view, crosses the glottis while the true folds are apart, without advancing against closure, and names the trachea below by its rings and membranous wall; the hand skill on a model is observed by faculty.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M07-O5',
      subtask:
        'Commits a withdrawal plan through an endotracheal tube: a deliberate look below the tube on the way out, the covered larynx and trachea recorded as not assessed, and the tube left to the airway team.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D03'],
  prerequisites: [
    'sedation-and-monitoring',
    'five-controls',
    'branch-entry',
    'reference-frames',
    'view-loss',
  ],

  clinicalQuestion:
    'With the larynx in view during an oral or nasal entry, what must be identified, and when may the scope go through into the trachea?',
  recognizeTitle: 'The larynx seen from above',
  objective:
    'Tell the laryngeal structures apart, decide when the scope may cross the glottis, and state what an examination of the larynx can and cannot claim.',
  why: 'The larynx protects the airway and moves with breathing and voice. How the scope goes through it, and what the report later says about it, both depend on what was actually seen there.',
  newConcept:
    'What the larynx shows sets what may be done there: the aligned tip crosses gently only while the opening between the true folds is seen, usually on the breath in; folds that stay closed mean stopping stimulation and reassessing, and a larynx hidden by a tube is recorded as not assessed. Neither is forced.',
  incrementSentence:
    'This section adds one idea to steering and view recovery: at the larynx, what is seen sets what may be done, so the scope crosses only while the opening between the true folds is in view, and folds that stay closed, or a larynx hidden by a tube, are never forced.',
  harmfulReflex:
    'Advancing against closed vocal folds, or pushing harder when entry meets resistance, to keep the procedure moving.',
  anchor: {
    analogy:
      'A door that opens and closes on its own rhythm: you walk through as it opens, not by shouldering it while it is shut.',
    precise:
      'The true vocal folds abduct with inspiration and adduct with phonation. In a spontaneously breathing patient the aligned tip crosses, gently and under vision, as the opening between them widens — usually on inspiration — and is not pushed against closed folds. Below them, the tracheal lumen is re-identified before the scope goes on.',
    checklistLabel: 'Before the tip goes through',
    checklist: [
      'The patient and the airway prepared',
      'The epiglottis identified, and the true folds told apart from the false folds and the arytenoid region',
      'In a responsive patient, the folds watched with breathing and voice',
      'The tip aligned with the opening, the folds seen apart, then a gentle advance',
    ],
  },

  spineStops: ['larynx', 'trachea'],
  grammarRowIds: ['red-out', 'dark-field'],
  controlStrip: {
    verdict: 'this-control',
    states: {
      insertion: 'this-one',
      rotation: 'this-one',
      deflection: 'this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'Shaft rotation, where needed, brings the opening into the bending plane and distal deflection aligns the tip with it; insertion, timed to the folds parting, carries it through, and the same insertion against closed folds is the harmful reflex. Suction and the accessory state play no part in the crossing.',
  },
  precommitDenyPatterns: [
    /\bbreath(es)? in\b/i,
    /\binspir\w*/i,
    /\babduct\w*/i,
    /\bfolds\b[^.]{0,15}\b(part|apart)\b/i,
    /\bagainst (the )?(closed|closing) folds\b|\bagainst closure\b/i,
  ],
  modelBoundary:
    'The larynx in this course is a model. Its folds move on a scripted cycle that stands in for a patient’s; its tissue has no feel and does not cough, bleed or swell; and contact is counted, not felt as force. A patient’s larynx can be narrower, can close on contact and can cough, so the ease of crossing here says nothing about crossing in a patient. A still image is a single frame and cannot show how the folds move.',
  physicalSkillNote:
    'The app cannot see your hands. Oral or nasal entry on a model, a supported shaft, depth held while the lever moves, and a crossing of the glottis without force are observed by faculty before any supervised patient practice. Crossing in this scene shows the timing and the target, not the hand skill.',
  localPolicyIds: ['topical_anesthetic_policy', 'icu_bronchoscopy_policy'],
  reviewItemIds: ['R04', 'R05', 'R08', 'R13'],

  blocks: [
    {
      id: 'before-the-trachea',
      kind: 'question',
      role: 'framing',
      heading: 'Before the trachea',
      body: 'An oral or nasal bronchoscopy reaches the larynx before the trachea. The larynx protects the airway and serves breathing and voice; it is a structure to examine, not only an obstacle on the way down.\n\nThis section is about what to identify there, when the scope may go through, and what the examination of the larynx can claim afterwards.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
      ],
    },
    {
      id: 'in-view-above',
      kind: 'signals',
      role: 'signals',
      heading: 'What can be seen on the way to the trachea',
      body: 'Name each of these before the tip moves toward it.',
      pointsLabel: 'From the entry to the trachea',
      points: [
        'Through the mouth: the tongue base, the soft palate and the uvula; through the nose: the nasal floor and the turbinates',
        'The vallecula, the epiglottis, the aryepiglottic folds, the arytenoid region and the piriform recesses',
        'The false vocal folds, above',
        'The true vocal folds, below, and the opening between them: the glottis',
        'Below the true folds: the subglottis, then the trachea',
        'In a responsive patient: how the folds move with breathing and with voice',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
      ],
    },
    {
      id: 'normal-laryngeal-examination',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A normal laryngeal examination',
      body: 'In a normal examination the epiglottis is identified first and the view is carried beyond it to the laryngeal inlet. The operator names the arytenoid region, the false folds and the true folds, and the opening between the true folds. In an appropriately responsive patient the folds are watched through breathing and phonation, and the description covers their symmetry and mobility, with any swelling, lesion or abnormal closure.\n\nThe description names its conditions — the sedation, any airway device, the secretions, the urgency — because each changes what the larynx can show. Recognizing abnormal motion is expected; a definitive functional diagnosis from one image without its context is not.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
      ],
    },
    {
      id: 'crossing-on-the-opening',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Crossing on the opening',
      body: 'The true vocal folds abduct with inspiration and adduct with phonation; in a responsive patient, their movement with both is watched before the scope crosses. With the patient and the airway prepared, the tip is aligned with the opening between the true folds and advanced gently while they are apart — usually on inspiration in a spontaneously breathing patient — under vision, not pushed against closed folds. Speech narrows the opening, so a responsive patient agrees on a simple signal for discomfort rather than speaking while the scope crosses.\n\nFolds that stay closed are not pushed through: closure with instrumentation can be laryngospasm, so stimulation stops, the problem is announced, and oxygenation and ventilation are assessed. Below the folds, avoid prolonged irritating contact and unnecessary pausing just beneath the glottis. Re-identify the tracheal lumen — cartilage rings anteriorly and laterally, the membranous wall posteriorly — and adapt to its curve.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 81 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 50, to: 59 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 79 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 115, to: 117 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 27 } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors treats the larynx as an obstacle to get past rather than a structure to read.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Aiming at the arytenoid region as though it were the opening: find the true folds and aim between them.',
        'Failing to recognize the epiglottis: identify it before approaching the larynx; it is the landmark on the way to the inlet, not the opening.',
        'Confusing the false folds with the true folds: the opening into the trachea lies between the true folds, below the false folds.',
        'Advancing during closure: hold the tip aligned and still, and cross when the folds are apart.',
        'Stopping for a long anatomical explanation while the scope irritates the subglottis: move off the subglottis to a stable position, re-identify the trachea, and explain afterwards.',
        'Losing depth while working the deflection lever: hold the depth, then bend.',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 81 } },
      ],
    },
    {
      id: 'darkness-above-the-glottis',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Darkness above the glottis',
      body: 'Above the glottis, the visible boundaries of the path are the true folds on either side of the opening. A dark space reached by aiming at the arytenoid region is not that opening.\n\nThe dark-field row in Reading the view applies here too. One lecture in this course’s sources uses darkness as a cue and encourages steady forward progress through the upper airway; the course’s wording stays the same at the larynx: identify a patent path by its visible anatomical boundaries, and advance gently only while that path stays clear. Loss of the path, resistance, new bleeding or a change in the patient overrides any wish to keep moving.',
      claimClass: 'review-flag',
      sourceRefs: [
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:06:39', end: '00:08:43' } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 81 } },
      ],
      reviewItemIds: ['R04'],
    },
    {
      id: 'mouth-or-nose',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Through the mouth or the nose',
      body: 'Through the mouth, a bite block protects the scope — apparent deep sedation does not replace it — and the shaft is held in a controlled position while the tongue base and the epiglottis are identified before the larynx is approached. When soft tissue closes the view, a jaw thrust or another airway-opening maneuver by a trained assistant may be needed; pressing the scope against the tongue or the back of the pharynx is not a substitute for opening the airway.\n\nThrough the nose, suitability is assessed first, the chosen nostril is prepared according to local practice, and the scope advances gently along the nasal passage under vision. Resistance, pain or bleeding is a reason to reassess the approach, not to push harder, and steering upward blindly is not a way round it. The choice between the two approaches weighs coagulopathy, anatomy and the instrument’s size; the oral approach is the alternative when nasal access is unsuitable.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 65 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 100 } },
      ],
      localPolicyIds: ['topical_anesthetic_policy'],
    },
    {
      id: 'where-to-look',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Where to look during entry',
      body: 'Two lectures in this course’s sources give different advice on where to look. The difficult-airway lecture says to watch the mouth while a videolaryngoscope blade or a tube goes in, before the device shows it on its camera; the bronchoscopy lecture says to use the endoscopic view as the scope enters the airway. They describe different devices and phases, not one universal rule.\n\nIntroduce the scope safely under direct external view, then keep continuous awareness of its visible path, with an assistant protecting the entry point where that helps.',
      claimClass: 'design',
      sourceRefs: [
        { sourceId: 'T03', location: { kind: 'time-span', start: '00:01:16', end: '00:02:21' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:06:39', end: '00:07:20' } },
      ],
      reviewItemIds: ['R05'],
    },
    {
      id: 'entry-and-withdrawal',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Entry and withdrawal are two looks',
      body: 'Crossing the glottis may provoke cough, and a detailed look at the subglottis straight after crossing can be difficult. With the scope stable in the trachea, clear of the subglottis, the patient and the team can pause to reassess before going on; no fixed waiting interval is required. On the way out, a deliberate look at the proximal trachea and the subglottis may show what was not seen well on entry.\n\nAn endotracheal tube, a supraglottic airway, deep anesthesia, heavy secretions or urgency can each keep the native larynx from a meaningful examination, and fold movement during coughing, instrumentation or a changed depth of anesthesia is not over-read. The report names the limitation rather than a finding.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:18:56', end: '00:21:13' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:43:45' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
      ],
    },
  ],

  workspace: {
    kind: 'media',
    media: [{ kind: 'endoscopic-still', structureId: 'larynx', outline: false }],
    caption:
      'The larynx from above: one still from the course’s annotated normal survey, authored teaching media pending review',
  },

  steps: {
    recognize: {
      instruction:
        'Look at the image in the Simulator panel and name each structure you can see; then read “What can be seen on the way to the trachea” in the Teaching panel.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.image,
        alsoPane: 'teaching',
        alsoLandmark: 'What can be seen on the way to the trachea',
      },
    },
    act: {
      title: 'Into the trachea',
      instruction:
        'Use the scope controls under the view: watch the true folds in the bronchoscope view through a few breaths, align the tip with the opening between them, advance into the trachea, then name it in the inspection record. An advance against closed folds leaves the last goal unmet; reset and begin again. The goals on this card fill in as each one is met.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.scopeView,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'What the larynx allows',
      instruction: `In the Teaching panel, read ${TEACHING_LANDMARKS.adds} and “Crossing on the opening”; then, on this card, why the other answers do not fit.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: {
      sectionId: 'larynx-and-entry',
      mode: 'larynx-entry',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'larynx' },
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'declare', 'recenter', 'reset'],
      assists: { recenter: true },
      ledger: { expected: ['TR'] },
      script: 'breathing-cords',
      litAirways: ['TR'],
      boundary:
        'A model larynx: the folds open on each breath in and close on each breath out, on a scripted cycle rather than a patient’s own pattern. A patient’s folds also come together with voice and can close on contact. The tissue does not cough or bleed, and contact is counted, not felt. The ease of crossing here says nothing about a patient.',
    },
    goals: [
      {
        id: 'cross-glottis-open',
        label: 'Cross the glottis while the true folds are apart',
        test: { type: 'event', event: 'glottis-crossed-open' },
      },
      {
        id: 'name-the-trachea',
        label: 'Below the folds, name the trachea by its rings and membranous wall',
        test: { type: 'event-sequence', events: ['entered:TR', 'declared:TR:identified'] },
      },
      {
        id: 'no-advance-against-closure',
        label: 'Reach the trachea without advancing against closed folds',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'entered:TR' },
            { type: 'without', event: 'advanced-against-closure' },
          ],
        },
      },
    ],
  },

  prediction: {
    id: 'N04',
    itemType: 'management-decision',
    situation:
      'An oral entry for an airway inspection under moderate sedation, with topical anesthesia given and a bite block in place. The epiglottis has been identified and the tip sits above the laryngeal inlet, aligned with it: the arytenoid region, the false folds and the true folds are in view. The patient is breathing spontaneously and responds when spoken to; the laryngeal examination is complete, and the true folds move symmetrically.',
    stem: 'When should the tip advance through the glottis?',
    choices: [
      {
        id: 'a',
        label: 'On the next breath in, advancing gently under vision',
        rationale:
          'The true folds abduct with inspiration, so in a spontaneously breathing patient the opening between them is usually widest on the breath in. With the tip already aligned and the examination done, a gentle advance under vision crosses without pushing on tissue.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Now, while the tip is aligned, advancing steadily until it slips through',
        rationale:
          'Aligned is not open. Advancing now, and on until the tip slips through, meets the folds whenever they are closing and pushes on the structure that protects the airway; the advance waits for the opening, and resistance is a reason to pause and reassess.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'While the patient sustains a spoken sound, advancing gently under vision',
        rationale:
          'Phonation brings the true folds together, so advancing while the patient sustains a sound meets closing folds: the advance during closure the scope must not make. Watching the folds during speech belongs to the examination before crossing; while the scope crosses, the patient is not asked to speak.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'During the next cough, advancing gently while the folds move the most',
        rationale:
          'A cough is a protective reflex, and fold movement during coughing is easy to misread as an opening. Crossing may itself provoke cough; with the tip held stable, the team lets it settle rather than advancing into it.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The true vocal folds abduct with inspiration and adduct with phonation, so in a spontaneously breathing patient the opening between them is usually widest on the breath in, and the aligned tip advances then, while the folds are apart, gently and under vision. Advancing as soon as the tip is aligned, or while the patient speaks, risks meeting closing folds and pushing against closed folds; timing the advance to a cough mistakes a protective reflex for an opening. If the folds stay closed, stimulation stops and the team reassesses rather than pushing.',
    objectiveIds: ['M07-O2', 'M07-O4'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
      { sourceId: 'S3', location: { kind: 'pdf-pages', from: 81 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 50, to: 59 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 79 } },
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:18:56', end: '00:21:13' } },
    ],
  },

  transfer: {
    id: 'Q17',
    seedId: 'Q17',
    itemType: 'management-decision',
    situation:
      'In the intensive care unit, a ventilated patient has had a bronchoscopy through the existing endotracheal tube, whose tip sits in the mid trachea, and the airways beyond it have been inspected. The scope is about to be withdrawn, and the report template has a line for the larynx. Ventilation and oxygenation have stayed stable on the monitor throughout.',
    stem: 'What is the plan for the withdrawal?',
    choices: [
      {
        id: 'a',
        label:
          'Look below the tube tip on the way out; record the larynx and tube-covered trachea as not assessed',
        rationale:
          'With the patient stable, the withdrawal is a second, deliberate look at the trachea below the tube, which cough and movement may have limited on the way in. The larynx and the trachea inside the tube were never in view, so the record says not assessed rather than normal.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Ask the airway team to draw the tube back as the scope comes out, and record the larynx as then seen',
        rationale:
          'Removing or repositioning an established airway is a separate airway decision for the airway team, not a way to finish an inspection. Withdrawing the bronchoscope is not withdrawing the endotracheal tube; the unseen larynx is documented as a limitation.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Look below the tube tip on the way out; record the larynx as normal, like the airways below it',
        rationale:
          'The second look holds, but normal airways below the tube say nothing about a larynx the tube covered; a line reading normal describes a larynx the tube kept out of view.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label:
          'Withdraw without a second look; record the larynx and tube-covered trachea as not assessed',
        rationale:
          'The record is honest, but the way out is a second chance to look at the trachea below the tube, which cough or movement may have limited going in.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Withdrawing the bronchoscope is not removing the endotracheal tube. In a stable patient the withdrawal is a planned second look at the trachea below the tube; the larynx and the tube-covered trachea were never in view, so the record says not assessed rather than normal. Any change to an established airway is coordinated with the airway team, not made to complete an inspection.',
    objectiveIds: ['M07-O5', 'M07-O2'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:43:45' } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } },
    ],
    reviewItemIds: ['R08'],
    transferVariant:
      'The end of a procedure in a ventilated patient, through an endotracheal tube: what the withdrawal may do and what the report may claim about a larynx the tube covers.',
  },

  practice: [
    {
      id: 'mc-arytenoids-as-glottis',
      presentationTitle: 'A pink view on the airway model',
      situation:
        'On the airway model, a trainee has come over the epiglottis and is aiming at the mounds of mucosa at the back of the laryngeal inlet, toward a dark space behind them. Each small advance ends with the lens against mucosa and a pink view. Two pairs of folds are visible further forward, one above the other.',
      item: {
        id: 'mc-arytenoids-as-glottis',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw slightly, find the true folds, and aim at the opening between them',
            rationale:
              'The mounds at the back of the inlet are the arytenoid region, and the pink view is the lens against mucosa. Withdrawing restores a view; the opening into the trachea lies between the true folds, the lower of the two pairs, in front of the arytenoid region.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Advance a little further toward the dark space behind the mounds',
            rationale:
              'The mounds are the arytenoid region, and the dark space behind them is not the opening between the true folds; darkness is not proof of a lumen. Advancing into it moves the tip where no airway has been identified.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Withdraw slightly, aim between the upper pair of folds, and advance under vision',
            rationale:
              'The upper pair are the false folds; the true folds lie below them, with the ventricle between. Taking the space between the false folds for the glottis means advancing before the opening between the true folds has been seen, onto folds that may be closing.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Hold this aim and wait for the two mounds to open into the airway',
            rationale:
              'The mounds are the arytenoid region, not the true folds; waiting for them to open keeps the tip aimed at the back of the inlet. The true folds lie further forward, and the opening between them is the glottis.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The arytenoid region forms the back of the laryngeal inlet; approaching it as though it were the opening is a common error, and repeated contact gives a pink view. Withdraw slightly to restore a view, identify the false folds and the true folds below them, and aim at the opening between the true folds.',
        objectiveIds: ['M07-O1'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
          { sourceId: 'S3', location: { kind: 'pdf-pages', from: 81 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
        ],
        reviewItemIds: ['R04'],
      },
    },
    {
      id: 'mc-nasal-resistance',
      presentationTitle: 'Resistance during a nasal entry',
      situation:
        'A nasal entry for an airway inspection under moderate sedation, with the chosen nostril prepared according to local practice. Partway along the nasal passage the tip meets resistance, the patient winces, and a streak of blood appears on the mucosa. The passage ahead looks narrow.',
      item: {
        id: 'mc-nasal-resistance',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw a little, reassess the passage, and plan the oral approach',
            rationale:
              'Resistance, pain and bleeding are reasons to reassess the approach, not to increase force. With the passage narrow and bleeding, the oral approach is the alternative to plan.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Advance with steadier pressure to get beyond the narrow part of the passage',
            rationale:
              'Resistance with pain and fresh blood is a reason to reassess, not to increase force; steadier pressure drives the tip against the same narrowing.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Steer the tip upward, above the narrowing, and keep advancing',
            rationale:
              'Steering upward looks for a way round the narrowing instead of reassessing it. The upper nasal passage is not a path anyone has identified, and resistance, pain and fresh blood already call for a reassessment; the scope advances only along a passage it can see.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Withdraw a little, give more topical anesthetic, and try the same passage again',
            rationale:
              'More topical anesthetic may ease discomfort, but it does not explain the resistance or the bleeding, and the same passage meets the same narrowing; resistance with pain and blood calls for a change of approach, not a repeat. Any added dose also goes on the team’s shared running total under the local topical-anesthetic policy.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Resistance, pain or bleeding during a nasal entry is a reason to reassess the approach, not to increase force or search blindly for a way through. The scope advances along the nasal passage gently and under vision; when nasal access is unsuitable, the oral approach is the alternative.',
        objectiveIds: ['M07-O3'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 65 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
        ],
        reviewItemIds: ['R13'],
      },
    },
  ],
}
