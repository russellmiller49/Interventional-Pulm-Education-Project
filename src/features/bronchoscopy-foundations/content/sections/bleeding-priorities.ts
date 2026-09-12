import type { SourceRef } from '../../data/sources'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M15, second half — Bleeding priorities. When blood appears after sampling, the first move depends
 * on what the scope is doing and where the blood is: a wedge holding back a fresh peripheral bleed
 * is kept while help comes, and once blood reaches the central airway, patency and the usable lung
 * may take priority over the source, so the scope’s role is decided again as the bleed changes.
 * Knowledge spec §16.3, §16.7 and §16.8 (S1 PDF 138–143; S2 PDF 27–30; S1 PDF 138–140, 143 and
 * S3 PDF 56 for suction; T05, T16, T09, T06), case C21, drill D13, seed Q27.
 * Register R33 (no topical agent or dose), R34 (no context-free suction, withdrawal or survey rule),
 * R37 (blockers only under device instructions and a trained team) and R42 (no indiscriminate clot
 * removal). The transfer retrieves the diagnostic grammar from `view-loss` (spec §5.3).
 */

/** §16.3 — a streak versus ongoing bleeding; announce, stop sampling, the supervisor's plan. */
const S1_BLEEDING: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 138, to: 143 },
}
const S2_BLEEDING: SourceRef = { sourceId: 'S2', location: { kind: 'pdf-pages', from: 27, to: 30 } }
/** §16.3 — suction requires context. */
const S1_SUCTION: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 138, to: 140 },
}
const S1_SUCTION_143: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 143 } }
const S3_SUCTION: SourceRef = { sourceId: 'S3', location: { kind: 'pdf-pages', from: 56 } }
/** §16.7 — blood threatens ventilation first; help is called while stabilization proceeds. */
const T05_IMPACT: SourceRef = {
  sourceId: 'T05',
  location: { kind: 'time-span', start: '00:00:00', end: '00:01:19' },
}
const T05_PRIORITIES: SourceRef = {
  sourceId: 'T05',
  location: { kind: 'time-span', start: '00:07:24', end: '00:11:36' },
}
const T16_PRIORITIES: SourceRef = {
  sourceId: 'T16',
  location: { kind: 'time-span', start: '00:06:15', end: '00:12:12' },
}
/** §16.7 — the scope's role: a contained peripheral bleed versus an airway already holding blood. */
const T09_SCOPE_ROLE: SourceRef = {
  sourceId: 'T09',
  location: { kind: 'time-span', start: '00:25:10', end: '00:33:41' },
}
const T06_SCOPE_ROLE: SourceRef = {
  sourceId: 'T06',
  location: { kind: 'time-span', start: '00:11:25', end: '00:12:57' },
}
/** C21 — two bleeding situations, two immediate priorities. */
const T09_C21: SourceRef = {
  sourceId: 'T09',
  location: { kind: 'time-span', start: '00:26:02', end: '00:32:24' },
}
/** §16.8 — topical agents need a local protocol; medication shortcuts must not delay rescue. */
const T05_AGENTS: SourceRef = {
  sourceId: 'T05',
  location: { kind: 'time-span', start: '00:15:03', end: '00:17:07' },
}
const T09_AGENTS: SourceRef = {
  sourceId: 'T09',
  location: { kind: 'time-span', start: '00:17:34', end: '00:19:49' },
}
/** §5.3 — wall contact, retrieved by the transfer. */
const S1_VIEW_LOSS: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 89, to: 99 },
}
const S2_VIEW_LOSS: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 44, to: 47 },
}

export const section: BronchSectionDefinition = {
  id: 'bleeding-priorities',
  title: 'Bleeding during bronchoscopy',
  shortTitle: 'Bleeding',
  minutes: 8,
  moduleIds: ['M15'],
  objectives: [
    {
      objectiveId: 'M15-O2',
      subtask:
        'Turns down an indiscriminate withdrawal or suction rule in the committed items — the recovery routine run on a wedged bleed, repeated suction to clear the view, waiting on a volume, and holding still for a red field from wall contact after a sample elsewhere — and, in practice, judges a bleed by the view and the patient rather than the suction trap.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M15-O5',
      subtask:
        'Commits the first move for a fresh biopsy bleed with the tip still wedged, then chooses, frame by frame, the priorities as the bleed changes — a wedge holding while a look at the other side is urged, blood reaching the carina and the right main bronchus, and a quieter field that is not source control — with help called from the start.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D13'],
  prerequisites: ['view-loss', 'protected-accessories', 'deterioration'],

  clinicalQuestion: 'When blood appears during a bronchoscopy, what decides the first move?',
  recognizeTitle: 'A red field after a left upper lobe biopsy',
  objective:
    'Choose the immediate priorities when blood appears during a bronchoscopy, and choose them again as the bleed changes.',
  why: 'Bleeding is a complication a trainee can meet at an early biopsy, and blood in the airway is a problem for breathing as well as for the circulation.',
  newConcept:
    'The scope’s role in a bleed is decided again as the bleed changes: while a wedge contains a fresh peripheral bleed it is part of the treatment and is not withdrawn by reflex, and once containment is lost and blood reaches the central airway, restoring patency to the usable lung may take priority over staying at the source.',
  incrementSentence:
    'This section adds one idea to the recovery routine for a lost view and the response to deterioration: the scope’s role in a bleed changes as the bleed changes, so the first move is decided again when containment is lost or blood reaches the central airway.',
  harmfulReflex:
    'Running the recovery routine for a lost view on a bleed: withdrawing from a wedge that is holding back a fresh biopsy bleed, to regain a wide view or to look at the other side.',
  anchor: {
    analogy:
      'A wedged scope can work like a finger pressed on a cut: lifting it to take a look lets the blood out. But once blood is running into the main airway, keeping that airway open can matter more than the finger.',
    precise:
      'With an effective wedge isolating a new peripheral bleed, unnecessary withdrawal can release blood into airways that are still clear. With blood in the central airway and ventilation falling, restoring patency and ventilating the usable lung may take priority over staying at the source. In both, sampling stops, the site is announced and help comes early.',
    checklistLabel: 'When blood appears after sampling',
    checklist: [
      'Announce the bleeding and its site, and stop sampling',
      'Name what the scope is doing before changing it',
      'Judge the breathing and where the blood is going, not a volume',
      'Suction, isolation and escalation follow the supervisor’s plan',
    ],
  },

  spineStops: ['segmental', 'main-bronchi'],
  grammarRowIds: ['red-field-wedged-bleeding', 'red-out'],
  controlStrip: {
    verdict: 'no-control-stop-and-communicate',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No control movement treats a bleed, though a wedge left in place may help limit its spread. Withdrawal is the tempting reflex, and from a useful wedge it can release blood into clear airways; suction clears airways that are still working when the supervisor directs it. The first moves are to hold position, stop sampling, announce the site and get help.',
  },
  precommitDenyPatterns: [
    /\b(hold|keep)(s|ing)? the (tip )?wedge/i,
    /\bstop(s|ping)? (further )?sampling\b/i,
    /\bhold(s|ing)? back\b/i,
    /\brelease\w* blood\b/i,
    /\bannounc\w*/i,
    /\bcontain(s|ing|ed)? the bleed/i,
  ],
  modelBoundary:
    'The monitor and the airway view in this section are scripted in words for teaching. They are not a physiological or bleeding model, no amount or reading on these steps is a threshold for your patient, and the patients are constructed. A real bleed is managed by the supervising team under your institution’s bleeding response.',
  localPolicyIds: ['bleeding_rescue', 'blocker_ifu_and_rescue'],
  reviewItemIds: ['R33', 'R34', 'R37', 'R42'],

  blocks: [
    {
      id: 'blood-after-a-sample',
      kind: 'question',
      role: 'framing',
      heading: 'Blood after a sample',
      body: 'A forceps biopsy has just been taken from a peripheral segment, and blood appears. The view beyond the tip turns red, and the image that guided the procedure is gone.\n\nThis section is about the first minutes of a bleed: what to read, and what decides the first move.',
      claimClass: 'synthesis',
      sourceRefs: [S1_BLEEDING, T09_SCOPE_ROLE],
    },
    {
      id: 'what-to-read',
      kind: 'signals',
      role: 'signals',
      heading: 'What to read when blood appears',
      body: 'Blood changes the view, and the view is not the only thing to read. Each of these can be read at the scope or in the room.',
      pointsLabel: 'What can be read when blood appears',
      points: [
        'Where the blood is: the sampled segment, its lobe, the trachea or the other side',
        'Whether it is slowing, continuing or spreading, and whether it hides the view',
        'Where the tip is',
        'Breathing, airflow, capnography and oximetry, against this patient’s own start',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_BLEEDING, T09_SCOPE_ROLE],
    },
    {
      id: 'expected-after-biopsy',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'What a biopsy site can do',
      body: 'After a forceps biopsy, a small streak of blood can run from the sampled site and stop on its own. The view of the airway returns, and breathing, airflow and oximetry stay at this patient’s own starting values.\n\nThat is the reference. What differs from it is ongoing bleeding: bleeding that hides the view, threatens ventilation or reaches other airways.',
      claimClass: 'source',
      sourceRefs: [S1_BLEEDING, S2_BLEEDING],
    },
    {
      id: 'what-the-scope-is-doing',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What the scope is doing',
      body: 'The first move depends on what the scope is doing. With the tip wedged in a segment just sampled, the wedge may be isolating a new peripheral bleed, and unnecessary withdrawal can release blood into airways that are still clear. With an unprotected airway that already holds blood or clot, restoring patency and ventilating the usable lung may take priority over lingering at the source.\n\nSo the scope’s present role is named before it is changed, and named again when the bleed changes: a wedge that was containing a bleed is no longer doing that job once blood is in the central airway. The recovery routine is for a view or orientation lost during routine travel, such as a lens against the wall; it is not run on a scope holding back a bleed because the image is red.',
      claimClass: 'transcript-source',
      sourceRefs: [T09_SCOPE_ROLE, T06_SCOPE_ROLE, S1_VIEW_LOSS],
      localPolicyIds: ['bleeding_rescue'],
      reviewItemIds: ['R34'],
    },
    {
      id: 'breathing-before-circulation',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Blood threatens breathing first',
      body: 'The hemoptysis lectures put clinical impact first: blood can threaten ventilation and oxygenation before blood loss produces circulatory collapse. The first priority is preventing airway obstruction and protecting the lung that still works.\n\nA fixed expectorated volume cannot define safety for every patient. Bleeding of large volume is a multidisciplinary emergency, and specialist and airway support are called while stabilization proceeds, not after a long attempt to complete the diagnosis.',
      claimClass: 'transcript-source',
      sourceRefs: [T05_IMPACT, T05_PRIORITIES, T16_PRIORITIES],
    },
    {
      id: 'first-moves-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The first moves, worked',
      body: 'Worked through the biopsy bleed in this section, with the tip still wedged in the anterior segment of the left upper lobe:',
      pointsLabel: 'The bleed, step by step',
      points: [
        'The bleeding and its site are said aloud — the sampled segment of the left upper lobe — and no further sample is taken.',
        'The supervisor’s bleeding plan starts, and help is called early.',
        'Oxygenation and ventilation are watched from the start and supported with the team.',
        'The scope’s role is named: the wedge may be holding the bleed back, so it stays unless the supervisor decides otherwise.',
        'The patient and where the blood is going are judged, not the trap: suctioned volume can be mixed with instilled fluid, and a relatively small volume can obstruct a vulnerable airway.',
        'Suction, isolation, positioning and escalation follow the supervisor’s direction.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_BLEEDING, S2_BLEEDING, T09_SCOPE_ROLE],
      localPolicyIds: ['bleeding_rescue'],
    },
    {
      id: 'suction-has-a-purpose',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Suction has a purpose',
      body: 'Suction can clear blood and keep the view. Aggressive, repeated suction at a bleeding site can also disrupt an evolving clot or undo a deliberate tamponade, and failing to clear airways that are threatened but still working can impair ventilation.\n\nThe sources describe different wedge and observation approaches and establish no single suction rule. The course teaches the objective — keep the usable airways open without undoing containment — and the technique comes from the supervisor.',
      claimClass: 'source',
      sourceRefs: [S1_SUCTION, S1_SUCTION_143, S3_SUCTION],
      localPolicyIds: ['bleeding_rescue'],
    },
    {
      id: 'temporary-control',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Temporary control is not treatment',
      body: 'Bronchoscopy can clear obstructing blood, localize the bleeding and support isolation. CT angiography, embolization, further bronchoscopic treatment or surgery may then be needed, according to the patient’s stability and the cause.\n\nA quieter field, or bleeding that has paused, is not proof that the source is controlled. Reassessment and definitive treatment are planned with the team.',
      claimClass: 'transcript-source',
      sourceRefs: [T09_C21, T05_PRIORITIES],
    },
    {
      id: 'your-bleeding-response',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Your institution’s bleeding response',
      body: 'Larger-bore airway access, a bronchial blocker, rigid bronchoscopy, interventional radiology, surgery or other definitive support may be needed, depending on the situation. These are escalation options chosen by the team, not tasks for a trainee alone; a blocker is used under its device instructions by a trained team.\n\nThe textbook’s historical epinephrine examples are not a drug prompt. Topical saline, vasoconstrictors and other hemostatic agents need a current local protocol that accounts for concentration, cumulative exposure, hemodynamics and the airway problem at hand, and the team watches for adverse effects. This course gives no agent recipe, dose or escalation sequence.',
      claimClass: 'local-policy',
      sourceRefs: [S1_BLEEDING, T05_AGENTS, T09_AGENTS],
      localPolicyIds: ['bleeding_rescue', 'blocker_ifu_and_rescue'],
      reviewItemIds: ['R33', 'R37'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors applies one rule to every bleed, or reads a quieter picture as a solved problem.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Running the recovery routine on a red field after sampling: first name what the scope is doing; a wedge may be holding the bleed back.',
        '“Always withdraw” to see where the blood is going: withdrawing from a useful wedge can release blood into airways that are still clear.',
        '“Always suction,” or no suction at all: aggressive suction at the site can disrupt an evolving clot, and leaving threatened airways uncleared can impair ventilation.',
        '“Always inspect the opposite side first”: a look at the other side is no reason to abandon a useful wedge; blood burden and ventilation decide the next move.',
        'Waiting for a volume before calling for help: no fixed volume defines safety, and help is called early.',
        'Stripping an adherent clot to complete the inspection, or reading a quiet field as a treated source: the clot may be what is holding; plan reassessment and definitive care.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_BLEEDING, S1_SUCTION, T09_SCOPE_ROLE, T06_SCOPE_ROLE],
      reviewItemIds: ['R34', 'R42'],
      registerExemptions: [
        {
          reviewItemId: 'R34',
          reason:
            'Quotes the context-free bleeding rules the register refuses, each followed by its correction.',
        },
      ],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption:
      'The patient just after a peripheral forceps biopsy under moderate sedation — scripted for teaching',
    readings: [
      {
        channel: 'airway-view',
        words:
          'The tip wedged in the sampled segment; blood fills the segment beyond it and no lumen is in view',
        trend: 'new',
      },
      { channel: 'respiratory-effort', words: 'Unchanged from before the biopsy', trend: 'steady' },
      { channel: 'capnography', words: 'The trace keeps its shape', trend: 'steady' },
      { channel: 'oximetry', words: 'At the patient’s own starting value', trend: 'steady' },
    ],
  },

  steps: {
    recognize: {
      instruction:
        'Read the monitor in the Simulator panel: what the airway view shows beyond the tip, and what each of the patient’s signals is doing.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.monitor },
    },
    act: {
      title: 'One bleed, frame by frame',
      instruction:
        'For each frame, read the monitor in the Simulator panel, then choose the next move in the decision on this card. A move that would harm the patient is refused, and the frame stays.',
      lookIn: {
        pane: 'steps',
        landmark: STEPS_LANDMARKS.decision,
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.monitor,
      },
    },
    explain: {
      title: 'Reading a bleed',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and ${TEACHING_LANDMARKS.grammar} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scenario',
    scenario: {
      id: 'left-upper-lobe-bleed',
      title: 'Bleeding after a left upper lobe biopsy',
      boundary:
        'The monitor and the airway view are scripted in words for teaching, not a physiological or bleeding model. Each frame teaches a decision; the team’s actions between frames are narrated, not simulated, and nothing here measures blood loss.',
      frames: [
        {
          id: 'wedge-holding',
          situation:
            'The bleeding and its site have been announced, sampling has stopped, and the supervisor has started the bleeding plan; more help is on the way. The tip is still wedged in LB3, with blood filling the segment beyond it. Breathing, capnography and oximetry are unchanged. The survey checklist on the procedure screen still shows the right side as not yet inspected.',
          readings: [
            {
              channel: 'airway-view',
              words: 'The tip wedged in LB3; blood fills the segment beyond it',
              trend: 'steady',
            },
            {
              channel: 'respiratory-effort',
              words: 'Unchanged from before the biopsy',
              trend: 'steady',
            },
            { channel: 'capnography', words: 'The trace keeps its shape', trend: 'steady' },
            { channel: 'oximetry', words: 'At the patient’s own starting value', trend: 'steady' },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label:
                'Keep the tip wedged and watch the patient, leaving the next step to the supervisor',
              rationale:
                'The blood is in the segment the tip is wedged in, and breathing and oximetry are unchanged: the wedge is doing useful work. Keeping it while watching the patient protects the airways that are still clear; suction, positioning and escalation follow the supervisor’s plan.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label:
                'Withdraw to the main carina to complete the right side of the checklist while help arrives',
              rationale:
                'Withdrawing from a useful wedge to look elsewhere is the critical error in this situation: it can release blood from the segment into the airways that are still clear, including the right side the look is meant to check. The checklist waits; blood burden and ventilation decide.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label:
                'Ask the supervisor to turn the patient sampled side up, so blood can drain from the segment',
              rationale:
                'Turning the sampled side up drains the bleeding segment toward the airways that still work, including the other lung: the spill the wedge is limiting. Where positioning is feasible, the bleeding side goes down to help protect the other lung, and asking the supervisor for the opposite turn does not change where the blood runs.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label:
                'Keep the wedge for now, then withdraw if the view is still red once help arrives',
              rationale:
                'The view is red because the wedge is holding blood in the segment, and it stays red while the wedge works. Whether the wedge stays depends on containment and the patient’s breathing, decided with the supervisor, not on the image.',
              plausibility: 'incorrect-mechanism',
            },
          ],
        },
        {
          id: 'blood-at-the-carina',
          situation:
            'Before more help arrives, the patient coughs forcefully and the tip is dislodged from the segment. With the scope brought back to the main carina, the view shows blood pooling in the lower trachea and running into the right main bronchus. The patient is coughing blood, breathing is labored and oximetry is falling from the patient’s own start.',
          readings: [
            {
              channel: 'airway-view',
              words: 'Blood pooling at the main carina and running into the right main bronchus',
              trend: 'new',
            },
            { channel: 'respiratory-effort', words: 'Labored, with coughing', trend: 'rising' },
            {
              channel: 'oximetry',
              words: 'Falling from the patient’s own starting value',
              trend: 'falling',
            },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label:
                'Say the blood has spread, and with the supervisor clear the airway to the right lung',
              rationale:
                'The wedge is lost, blood is in the central airway and entering the right main bronchus, and oxygenation is falling: the lung that still works is threatened. Restoring patency to the right lung may take priority over staying at the source, while the team supports oxygenation and ventilation and airway support is called; isolation, positioning the bleeding side down where feasible, and escalation follow the supervisor’s plan.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label:
                'Ask the supervisor to re-wedge the bleeding segment before anything else, since that held it',
              rationale:
                'The wedge was useful while it kept the blood in the segment. Now blood is already in the central airway and oxygenation is falling, so going back to the source before clearing the airway to the right lung leaves the lung that still works unprotected, whoever makes the move.',
              plausibility: 'incorrect-mechanism',
            },
            {
              id: 'c',
              label:
                'Hold off suction so a clot can form at the source, and keep watching the oximetry',
              rationale:
                'Sparing the clot made sense while the wedge kept the blood in the segment. Now blood is entering the right main bronchus and oximetry is falling: leaving threatened airways uncleared can impair ventilation of the lung that still works, and a clot at the source does not clear them.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label:
                'Instill a topical agent through the channel and wait at the bleeding segment for it to work',
              rationale:
                'Waiting at the source for a medication while blood fills the central airway and oxygenation falls delays what the patient needs now: an open airway to the right lung. A medication shortcut must not delay rescue, and any topical agent, its dose and when to use it need current local approval and the supervisor’s decision.',
              plausibility: 'unsafe',
            },
          ],
        },
        {
          id: 'quiet-field',
          situation:
            'With the supervisor directing, blood has been cleared from the trachea and the right main bronchus, the patient has been turned with the bleeding side down, and the team has arrived. The field is now quiet: a clot fills the opening of the sampled segment and no fresh blood is seen. Oximetry is rising back toward the patient’s own start.',
          readings: [
            {
              channel: 'airway-view',
              words: 'A clot at the opening of the sampled segment; no fresh blood',
              trend: 'steady',
            },
            {
              channel: 'oximetry',
              words: 'Rising back toward the patient’s own starting value',
              trend: 'rising',
            },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label:
                'Leave the clot alone, and plan reassessment and any definitive treatment with the team',
              rationale:
                'The clot may be what is holding the bleeding, and a quiet field is not proof that the source is controlled. Leaving it undisturbed, reassessing with the team and deciding whether definitive treatment is needed — CT angiography, embolization, further bronchoscopic treatment or surgery, by stability and cause — is the next step.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label:
                'Clear the clot from the opening of the segment to confirm that the bleeding has stopped',
              rationale:
                'Removing an adherent clot to complete the inspection can undo what is holding the bleeding. A quiet field is reassessed with the team, not proven by stripping the clot.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label:
                'Resume the planned biopsies from the segment now that the field has gone quiet',
              rationale:
                'Sampling stopped when the bleeding started, and a field that has gone quiet is not a controlled source. Whether anything more is done in this procedure is the supervising team’s decision after reassessment.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label:
                'Agree with the team to record the bleeding as resolved, since no fresh blood is seen',
              rationale:
                'Neither a transiently clear view nor a pause in the bleeding shows that the source is controlled, so “resolved” claims more than was seen, whoever agrees to it. The event, its site and what was done are recorded as they happened, and reassessment with the team follows.',
              plausibility: 'incorrect-mechanism',
            },
          ],
        },
      ],
      sourceRefs: [T09_C21, T05_PRIORITIES, T05_AGENTS, S1_BLEEDING, S1_SUCTION, S3_SUCTION],
    },
  },

  prediction: {
    id: 'Q27',
    seedId: 'Q27',
    itemType: 'management-decision',
    situation:
      'Under moderate sedation, a supervised trainee has taken a forceps biopsy from the anterior segment of the left upper lobe (LB3), with the tip wedged in the segmental opening. As the forceps come back through the channel, blood fills the segment beyond the tip and the view turns red; no lumen can be seen, and how far the blood has spread cannot be seen from the tip. Breathing, capnography and oximetry are unchanged from the start, and the supervisor is at the bedside.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label: 'Stop sampling, announce the site, and keep the tip wedged in the sampled segment',
        rationale:
          'Blood is filling the segment the tip is wedged in, and breathing and oximetry are unchanged, so the wedge is likely containing the bleed. Keeping it there may limit spill into the airways that are still clear while the supervisor’s bleeding plan starts and help comes.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Stop sampling, announce the site, and withdraw to the left upper lobe bronchus to see where the blood goes',
        rationale:
          'The view is lost because blood fills the segment, not because the lens is on the wall. Withdrawing to see where the blood goes can abandon the useful containment the wedge provides and release blood into airways that are still clear.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Stop sampling, announce the site, and suction repeatedly until the view beyond the tip clears',
        rationale:
          'Suction aimed at clearing the picture treats the red image as the problem. Aggressive, repeated suction at a bleeding site can disrupt an evolving clot or undo the containment the wedge provides; whether suction is used through a wedge, and how, is the supervisor’s technique, chosen for the patient rather than the view.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'Stop sampling, announce the site, and let the trap volume decide whether help is needed',
        rationale:
          'A volume in the trap cannot define how serious this is: suctioned blood can be mixed with instilled fluid, and a relatively small volume can obstruct a vulnerable airway. Help is called early, while the team stabilizes the patient.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A red view after sampling, with the tip wedged in the sampled segment, is not a lens against the wall: the wedge may be holding back the bleed. With an effective wedge containing the bleed, unnecessary withdrawal can release blood into airways that are still clear, so the tip stays wedged while sampling stops, the site is announced and help comes early. Suction and every further step follow the supervisor’s bleeding plan, with oxygenation and ventilation watched throughout.',
    objectiveIds: ['M15-O5', 'M15-O2'],
    claimClass: 'transcript-source',
    sourceRefs: [T09_SCOPE_ROLE, T16_PRIORITIES, S1_BLEEDING],
    reviewItemIds: ['R34'],
  },

  transfer: {
    id: 'bleeding-priorities-transfer',
    itemType: 'management-decision',
    situation:
      'During a supervised bronchoscopy under moderate sedation, brushings were taken from the apicoposterior segment of the left upper lobe (LB1+2) a few minutes ago; a streak of blood followed, was said aloud and stopped, and that segment’s opening is now clear. The brush has been removed from the channel. The operator then steers down the left lower lobe bronchus toward the basal segments for the planned washing, and just after an advance the view fills with a close, poorly defined pink-red field with no lumen in view. Breathing, capnography and oximetry are unchanged from the start.',
    stem: 'What should happen next?',
    choices: [
      {
        id: 'a',
        label:
          'Stop advancing, reduce the bend and withdraw slightly until the lower lobe lumen shows',
        rationale:
          'The red appeared as the tip advanced in the lower lobe, away from the sampled segment, with nothing in the channel: often the lens is against the wall. Withdrawing slightly with the bend reduced restores the lumen without force; red color alone does not prove hemorrhage.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Hold the tip still and start the bleeding plan, since a sample was taken only minutes ago',
        rationale:
          'A sample was taken, but in the upper lobe, and its streak has stopped with the opening clear. This tip is travelling, not wedged in a sampled segment; holding still leaves the lens on the wall, and the bleeding plan answers a bleed the scene does not show.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'Keep advancing toward the basal segments, since their openings lie just beyond the red',
        rationale:
          'With no lumen in view, advancing is movement without vision and presses the lens further into the wall; the tip advances only along an airway in view.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'Suction at the tip to clear blood from the lens before moving the scope any further',
        rationale:
          'The red appeared the moment the tip moved forward, not in a position already seen clearly, so nothing suggests blood on the lens. Suction against mucosa draws the wall onto the tip and deepens the problem.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'A red image has more than one cause, and what the scope is doing separates two of them, not whether a sample has been taken. A red field that appears as the tip advances in an airway other than the one sampled, with nothing in the channel, often means the lens is against the wall, and the recovery routine applies: stop advancing, reduce the bend, withdraw slightly. A red field after sampling, with the tip wedged in the sampled segment and blood filling the segment beyond it, may be a bleed the scope is holding back, and that scope is not withdrawn reflexively.',
    objectiveIds: ['M15-O2', 'M06-O3'],
    claimClass: 'synthesis',
    sourceRefs: [S1_VIEW_LOSS, S2_VIEW_LOSS, T09_SCOPE_ROLE],
    reviewItemIds: ['R34'],
    transferVariant:
      'After a sample rather than before one, with the tip travelling in another lobe rather than wedged in the sampled segment: the same red image, where what the scope is doing suggests wall contact and the recovery routine fits.',
    retrievesFrom: 'view-loss',
  },

  practice: [
    {
      id: 'mc-red-trap',
      presentationTitle: 'A red suction trap after a right middle lobe brushing',
      situation:
        'Under moderate sedation, the operator brushes the lateral segment of the right middle lobe (RB4) for cytology, then instills saline to wash the segment and recovers it into the suction trap. The trap now holds red fluid, and a colleague says that much blood means a major bleed. In the bronchoscope view, a thin streak of blood runs from the brushed segment and is slowing, and the right middle lobe bronchus and the bronchus intermedius are clear. Breathing, capnography and oximetry are unchanged from the start.',
      item: {
        id: 'mc-red-trap',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Say it aloud and keep watching the segment, the airways beyond it and the patient',
            rationale:
              'The streak is slowing, the right middle lobe bronchus and the bronchus intermedius are clear and breathing is unchanged: a small streak, not ongoing bleeding. It is still said aloud, and the view and the patient, not the trap, decide whether that changes.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Say it aloud and let the volume of red fluid in the trap set how serious the bleed is',
            rationale:
              'The trap holds the washing saline as well as blood, so its color and volume cannot say how much blood was lost, and no fixed volume defines safety: a relatively small volume can obstruct a vulnerable airway. What the blood is doing in the airway sets how serious the bleed is.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label:
              'Say it aloud and hold suction on at the brushed segment until the return runs clear',
            rationale:
              'Aggressive, repeated suction at a bleeding site can disrupt an evolving clot, and a clear return afterwards does not prove the bleeding has stopped. Suction has a purpose, and the supervisor directs it.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Say it aloud and wedge the tip in the lateral segment until the red in the trap fades',
            rationale:
              'Wedging is a way to limit spill from a bleed into other airways, and this streak is slowing with the airways beyond it clear. The red in the trap is washing saline mixed with blood, and it is not what a wedge treats.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The trap mixes the washing saline with blood, so its color and volume cannot say how much blood was lost, and no fixed volume would define safety anyway: a relatively small volume can obstruct a vulnerable airway. What separates a small self-limited streak from ongoing bleeding is what the blood does: whether it hides the view, threatens ventilation or reaches other airways. Here it does none of those, so the streak is said aloud and the segment and the patient are watched.',
        objectiveIds: ['M15-O2'],
        claimClass: 'source',
        sourceRefs: [S1_BLEEDING, S2_BLEEDING],
      },
    },
  ],
}
