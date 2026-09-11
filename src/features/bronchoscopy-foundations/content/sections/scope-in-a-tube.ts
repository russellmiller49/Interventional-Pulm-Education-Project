import type { ScopeViewSpec } from '../../components/scope/types'
import type { SourceRef } from '../../data/sources'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M16, first half — The scope inside an artificial airway. The mechanism section of the Respond
 * phase for ventilated patients: the learner reads the geometric space a scope leaves inside an
 * endotracheal tube for two teaching pairings, and separates that geometry from ventilation, which
 * is read on the ventilator and in the patient. Knowledge spec §17.1–§17.2 (S1 PDF 154–158), §17.7
 * (T15 00:02:49–00:04:03, 00:16:23–00:22:00), §17.9 (T15 00:16:23–00:21:18), §3.2 for the transfer
 * (S1 PDF 95–96, 155–156), drill D15, seed Q26, register R31 and acceptance test A36.
 *
 * Pressure-controlled breaths and time cycling (§17.8, R29) and the lecture's own case with its
 * revealed outcome (C17, R30) belong to `icu-physiology`, which retrieves this section's idea.
 *
 * The practice case decides the return after a paused loss of ventilation, not the response at the
 * moment of the change: that decision is capstone C09's, made once and cold.
 */

// ── Citations, exactly as the knowledge spec's brackets give them ────────────────────────────────

/** §17.1 bronchoscopy through an endotracheal or tracheostomy tube [S1, PDF 155–158]. */
const S1_TUBE: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } }
/** §17.2 nonintubated ICU patients [S1, PDF 154–158]. */
const S1_ICU: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } }
/** §3.2 scope selection and artificial-airway compatibility [S1, PDF 95–96, 155–156]. */
const S1_SELECT: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95, to: 96 } }
const S1_SELECT_TUBE: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 155, to: 156 },
}
/** §17.7 the lecture's scope and tube [T15, 00:02:49–00:04:03, 00:16:23–00:22:00]. */
const T15_CASE: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:02:49', end: '00:04:03' },
}
const T15_TUBE: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:16:23', end: '00:22:00' },
}
/** §17.9 the cumulative burden and the team's plan [T15, 00:16:23–00:21:18]. */
const T15_BURDEN: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:16:23', end: '00:21:18' },
}

// ── The tube scene ───────────────────────────────────────────────────────────────────────────────

/**
 * First pairing: the §17.1 teaching example, a 6 mm scope in an 8 mm tube (a little under half of
 * the area left). Second pairing, for Observe: the §17.7 lecture dimensions, 6.2 mm in 7.5 mm (just
 * under a third left). Authored teaching values, not taken from any product's instructions for use
 * (A36). Suction is left out of the scene: its readouts cannot show the gas suction draws.
 */
const TUBE_VIEW: ScopeViewSpec = {
  sectionId: 'scope-in-a-tube',
  mode: 'tube',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'tube' },
  controls: ['advance', 'withdraw', 'rotate', 'deflect', 'recenter', 'reset'],
  assists: { recenter: true },
  defaults: { tube: { kind: 'ett', idMm: 8 }, scopeOdMm: 6 },
  readouts: ['annularAreaFraction', 'annularAreaMm2'],
  boundary:
    'A model endotracheal tube with the scope inside it. Tube and scope are drawn as ideal circles at teaching sizes from the course’s worked examples, not taken from any product’s instructions for use, and the space readouts are calculated from those two diameters. Contact with the tube is counted, not felt.',
}

const TIGHTER_VIEW: ScopeViewSpec = {
  ...TUBE_VIEW,
  defaults: { tube: { kind: 'ett', idMm: 7.5 }, scopeOdMm: 6.2 },
  boundary:
    'The second teaching pairing uses the sizes from the lecture’s example, drawn the same way: ideal circles, with readouts calculated from the two diameters, not taken from any product’s instructions for use. Contact with the tube is counted, not felt.',
}

export const section: BronchSectionDefinition = {
  id: 'scope-in-a-tube',
  title: 'The scope inside an artificial airway',
  shortTitle: 'Scope in a tube',
  minutes: 7,
  moduleIds: ['M16'],
  objectives: [
    {
      objectiveId: 'M16-O1',
      subtask:
        'Commits, in the transfer, what should settle the choice between a larger-channel scope and a slimmer one that both go through the tube: the task’s suction needs weighed against the ventilation consequences of each external diameter, not fit alone.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M16-O2',
      subtask:
        'Decides, in a practice case, the next move after a paused loss of ventilation with the scope in the tube when raising the alarm limits is offered: reassess, then plan any return with the respiratory therapist, with the scope-in time and pause agreed and the alarms as set.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M16-O6',
      subtask:
        'Commits how to read the geometric space left around a scope in a tube, then reads it for two teaching pairings in the tube scene; in the practice case keeps pneumothorax among the causes when ventilation falls with the scope in.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D15'],
  prerequisites: ['shared-airway', 'pre-use-check', 'five-controls', 'deterioration'],

  clinicalQuestion:
    'When a bronchoscopy is done through a ventilated patient’s endotracheal tube, what can the sizes of the scope and the tube tell the team?',
  recognizeTitle: 'A bronchoscope inside an endotracheal tube',
  objective:
    'Judge what a scope’s fit in an artificial airway, and the space it leaves, can tell the team about a ventilated patient’s breathing.',
  why: 'In a ventilated patient the bronchoscope and every breath share one tube. How the team reads the equipment sizes shapes the plan it makes before the scope goes in.',
  newConcept:
    'The space left around a scope in a tube is geometry, not airflow: it does not say how much gas each breath moves, so ventilation is read on the ventilator and in the patient for as long as the scope is in.',
  incrementSentence:
    'This section adds one idea to the check before use, where getting through the tube showed access and nothing more: even the space left around the scope is geometry, not airflow, so ventilation is read on the ventilator and in the patient while the scope is in.',
  harmfulReflex:
    'Treating a scope that went through the tube easily, or the space left around it, as proof that ventilation is adequate — and carrying on, or raising the alarm limits to finish, while peak pressure rises and exhaled volume falls.',
  anchor: {
    analogy:
      'A cable threaded through a water pipe: that it went in shows it fits, and the free cross-section shows how much of the pipe is still open, but neither says how much water gets through. That depends on the pressure, the length of the pipe and what has built up inside it.',
    precise:
      'For ideal circles, the share of the tube’s cross-section left around the scope is one minus the square of the scope’s external diameter divided by the tube’s internal diameter. That is a share of area, not airflow: delivered and exhaled volume depend on the tube’s length and shape, the scope’s position, secretions, the ventilator’s settings and the patient’s lungs, and they are read on the ventilator and in the patient.',
    checklistLabel: 'With the scope in the tube, keep watching',
    checklist: [
      'Delivered and exhaled volume, against this patient’s values before the scope',
      'Airway pressure, and whether expiration finishes before the next breath',
      'The patient: chest movement, blood pressure, and oximetry, which can hold while ventilation falls',
      'The agreed moment to pause and let ventilation recover',
    ],
  },

  spineStops: [],
  grammarRowIds: ['pressure-up-volume-down'],
  controlStrip: {
    verdict: 'no-control-stop-and-communicate',
    states: {
      insertion: 'not-this-one',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No single control answers rising pressure and falling exhaled volume with the scope in the tube. The team pauses and restores ventilation as appropriate, which can mean bringing the scope out, while it works the cause through with the respiratory therapist and supervisor; suctioning more by reflex draws more gas and does not answer the pattern.',
  },
  precommitDenyPatterns: [
    /does not say how much gas/i,
    /not a forecast of airflow/i,
    /safe-size calculator/i,
    /is geometry, not airflow/i,
  ],
  modelBoundary:
    'The tube scene draws one tube and one scope as ideal circles, at teaching sizes from the course’s worked examples, not taken from any product’s instructions for use, and calculates its readouts from those two diameters. It is not a physiological model, and contact with the tube is counted, not felt.',
  localPolicyIds: ['icu_bronchoscopy_policy', 'scope_ifu'],
  reviewItemIds: ['R31'],

  blocks: [
    {
      id: 'one-tube',
      kind: 'question',
      role: 'framing',
      heading: 'A scope in the breathing tube',
      body: 'In a ventilated patient the bronchoscope goes in through an endotracheal or tracheostomy tube. For as long as it is there, it shares that tube with every breath the ventilator delivers and every breath the patient exhales.\n\nBefore the scope goes in, the team knows two sizes: the tube’s internal diameter and the scope’s external diameter. This section is about what those sizes tell the team.',
      claimClass: 'synthesis',
      sourceRefs: [S1_TUBE],
    },
    {
      id: 'what-the-team-can-read',
      kind: 'signals',
      role: 'signals',
      heading: 'What the team can read',
      body: 'Before and during a bronchoscopy through a tube, the team has these to work from.',
      pointsLabel: 'Information available for a bronchoscopy through a tube',
      points: [
        'The tube: its type, position and usable internal diameter, including any inner cannula or connector',
        'The scope: its maximum external diameter, including the distal portion',
        'The space the two diameters leave around the scope',
        'On the ventilator: delivered and exhaled volume, airway pressure and minute ventilation',
        'Whether expiration finishes before the next breath begins',
        'The patient: chest movement, oximetry and blood pressure',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_SELECT_TUBE, S1_TUBE],
      localPolicyIds: ['scope_ifu'],
    },
    {
      id: 'steady-procedure',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: 'A steady procedure through a tube',
      body: 'In a steady procedure the circuit stays connected through a suitable bronchoscopy adapter and the tube stays where it was secured. Delivered and exhaled volumes and airway pressure stay within the changes the team agreed to accept for this patient, expiration finishes before the next breath, and oximetry and blood pressure hold at the patient’s own values. The team has agreed who will call a pause.\n\nEvery later change is measured against this patient’s own values before the scope went in, not a remembered number. The scope in the tube can itself change these values, which is why the team agrees in advance how much change it will accept.',
      claimClass: 'synthesis',
      sourceRefs: [S1_TUBE, T15_BURDEN],
      localPolicyIds: ['icu_bronchoscopy_policy'],
    },
    {
      id: 'space-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The space around the scope, worked',
      body: 'The space left around the scope is the annular area. For ideal circles, its share of the tube’s cross-section is one minus the square of the scope’s external diameter over the tube’s internal diameter. It is arithmetic about area, used here to show why fitting is not enough. It is not a bedside tool.',
      pointsLabel: 'The two teaching pairings in the tube scene',
      points: [
        'The course’s teaching example, a 6 mm scope in an 8 mm tube: a little under half of the tube’s area is left.',
        'The lecture’s 6.2 mm scope in a 7.5 mm tube: just under a third is left, from a diameter difference of 1.3 mm.',
        'Between the two pairings the scope is only slightly larger and the tube slightly smaller, yet the share left falls from a little under half to just under a third, because the ratio is squared.',
        'None of these figures is a share of normal airflow, a delivered tidal volume or a safe size.',
      ],
      claimClass: 'design',
      sourceRefs: [T15_CASE, T15_TUBE],
    },
    {
      id: 'fitting-is-not-ventilating',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why fitting is not ventilating',
      body: 'A scope that goes through the tube shows that its external diameter fits. For as long as it is in, the tube and scope together can greatly increase resistance and limit expiration, and suction draws gas as well as secretions and can contribute to loss of lung volume. A nominally compatible scope can still create a clinically important obstruction, more so with another device, secretions or a partly obstructed tube, or when the scope stays in longer than planned.\n\nReal flow depends on the tube’s length and shape, the scope’s position, the pressure and flow pattern, secretions, resistance elsewhere, compliance and the time available. So the team combines the size check with a baseline and an ongoing watch of delivered and exhaled volume, airway pressure, minute ventilation, expiratory emptying and hemodynamics. A high-pressure alarm is not automatically coughing, and a normal oxygen saturation does not exclude reduced ventilation.',
      claimClass: 'synthesis',
      sourceRefs: [S1_TUBE, T15_CASE, T15_TUBE],
      reviewItemIds: ['R31'],
    },
    {
      id: 'plan-before',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Agree the plan before the scope goes in',
      body: 'The bronchoscopist, the airway team and the respiratory therapist agree the plan before the scope goes in. Any change to the tube or the ventilator — rate, inspiratory flow or time, pressure limits, PEEP or support — has trade-offs and belongs to the clinical team; your institution’s policy for bronchoscopy in ventilated patients applies.',
      pointsLabel: 'Agreed before the scope goes in',
      points: [
        'The actual airway device: usable internal diameter, position, securement and adapter, and any inner cannula or connector that limits the scope',
        'The planned scope; a tube exchange is the airway team’s decision, not a novice’s answer to a scope that does not fit',
        'The oxygen and ventilation plan, how long the scope should stay in, and when it comes out to let ventilation recover',
        'Which changes in delivered volume or pressure matter, and who will call a pause',
        'Alarms stay on and their limits are not raised to finish; temporary ventilator or oxygen changes are restored deliberately afterwards',
        'Without a tube, a patient on substantial respiratory support needs a risk–benefit and rescue plan and experienced help; no oxygen-flow cutoff is a universal trigger for intubation',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_TUBE, S1_ICU, T15_BURDEN],
      localPolicyIds: ['icu_bronchoscopy_policy'],
      reviewItemIds: ['R31'],
    },
    {
      id: 'when-ventilation-worsens',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'When ventilation worsens with the scope in',
      body: 'A falling exhaled volume, new difficulty ventilating, hypotension, findings on one side, or worsening gas exchange call for a pause and for restoring safe ventilation as appropriate while the team looks for the cause. Obstruction by the scope in the tube, dynamic hyperinflation, pneumothorax, bleeding or clot, a displaced device, medication effects and the underlying illness can each produce it, and several can act together.\n\nThe sizes do not settle which. A tight fit does not prove the scope is the cause, a roomy one does not exclude it, and coughing at the start is not a reason to call later deterioration a need for more sedation. The pattern of rising pressure and falling exhaled volume is in Reading the view, in the Teaching panel.',
      claimClass: 'synthesis',
      sourceRefs: [T15_BURDEN, S1_TUBE],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors lets the equipment sizes stand in for the patient.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Reading easy passage through the tube as adequate ventilation: it shows the external diameter fits; watch volume, pressure and expiration while the scope is in.',
        'Reading the share of area left as the share of airflow or delivered volume: it is arithmetic about area; flow depends on the tube, the scope’s position, secretions, the settings and the lungs.',
        'Treating a 2-mm difference between the diameters as proof of adequate ventilation: it is a screening heuristic, and another device, secretions or a partly blocked tube change the picture.',
        'Taking a tracheostomy tube’s nominal size for its usable internal diameter: an inner cannula or a connector can narrow it.',
        'Answering a high-pressure alarm with more sedation because the patient coughed earlier: reassess for obstruction, air trapping, pneumothorax, a displaced tube and clot.',
        'Raising or silencing alarm limits to finish: the limits stay as set; the first moves for rising pressure and falling exhaled volume are in Reading the view.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_TUBE, S1_SELECT_TUBE, T15_TUBE, T15_BURDEN],
      reviewItemIds: ['R31'],
      registerExemptions: [
        {
          reviewItemId: 'R31',
          reason:
            'Names the 2-mm difference as the error it is when read as proof of ventilation, and corrects it to screening information.',
        },
      ],
    },
  ],

  workspace: { kind: 'scope', view: TUBE_VIEW },

  steps: {
    recognize: {
      instruction:
        'In the Simulator panel, look at the bronchoscope view and the readouts under the controls: the scope sits inside an endotracheal tube, and the readouts give the space left around it, the annular area, as a share of the tube’s cross-section and in square millimeters.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.readouts },
    },
    act: {
      title: 'Through the tube',
      instruction:
        'With the scope controls under the view, advance along the tube, beyond its end and down the trachea to the main carina without touching the wall, watching the readouts under the controls on the way. The goals on this card mark each one as it holds.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    observe: {
      title: 'A tighter pairing',
      instruction:
        'The bronchoscope view now holds the second teaching pairing: a slightly larger scope in a smaller tube. Advance along the tube and beyond its end without touching the wall, and read the share left in the readouts under the controls against the first pairing’s, a little under half.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.readouts,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'Fit and ventilation',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and Why fitting is not ventilating in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: TUBE_VIEW,
    goals: [
      {
        id: 'advance-along-tube',
        label:
          'Advance along the tube without touching its wall, and read the space left around the scope',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'control-used:insertion' },
            { type: 'without', event: 'wall-contact' },
          ],
        },
      },
      {
        id: 'beyond-the-tube',
        label: 'Advance beyond the end of the tube into the trachea without touching the wall',
        test: {
          type: 'all',
          tests: [
            { type: 'event', event: 'tube-exited' },
            { type: 'without', event: 'wall-contact' },
          ],
        },
      },
      {
        id: 'reach-carina',
        label: 'Advance down the trachea to the main carina',
        test: { type: 'event', event: 'reached-carina' },
      },
    ],
    observe: {
      view: TIGHTER_VIEW,
      goals: [
        {
          id: 'advance-tighter-tube',
          label:
            'Advance along the tighter tube without touching its wall, and read the readouts under the controls again',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'control-used:insertion' },
              { type: 'without', event: 'wall-contact' },
            ],
          },
        },
        {
          id: 'beyond-tighter-tube',
          label: 'Advance beyond the end of this tube into the trachea without touching the wall',
          test: {
            type: 'all',
            tests: [
              { type: 'event', event: 'tube-exited' },
              { type: 'without', event: 'wall-contact' },
            ],
          },
        },
      ],
      readouts: ['annularAreaFraction', 'annularAreaMm2'],
    },
  },

  prediction: {
    id: 'Q26',
    seedId: 'Q26',
    itemType: 'mechanism-interpretation',
    situation:
      'A ventilated adult in the intensive care unit is to have a supervised bronchoscopy through the endotracheal tube. In this teaching example the scope’s external diameter is 6 mm and the tube’s internal diameter 8 mm. Worked out for ideal circles, a little under half of the tube’s cross-sectional area would remain around the scope.',
    stem: 'What does that figure tell the team?',
    choices: [
      {
        id: 'a',
        label:
          'How much of the tube is left open, which does not say how much gas each breath will move',
        rationale:
          'The figure is the share of the tube’s cross-section left around the scope, for ideal circles. It bears on ventilation, because the tube and scope together can greatly increase resistance and limit expiration, but how much gas moves also depends on the tube’s length and shape, the scope’s position, secretions, the ventilator’s pressure and flow pattern, the patient’s lungs and the time the scope stays in.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'That each breath will deliver about half the volume it did before the scope went in',
        rationale:
          'Area left and volume delivered are different quantities. The figure is not a share of normal airflow and not a prediction of delivered tidal volume; delivered volume depends on the ventilator’s settings, the tube’s length and shape, and the patient’s lungs, none of which the figure includes.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'That with nearly half the tube still open, ventilation will stay adequate while the scope is in',
        rationale:
          'Dimensions are screening information, not a ventilation guarantee. A nominally compatible scope can still create a clinically important obstruction, and suction, secretions or a longer scope-in time change the situation after the figure is worked out; ventilation is watched on the ventilator and in the patient throughout.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'How much of the tube is left open, which matters for getting the scope in but not for ventilation',
        rationale:
          'The space left does bear on ventilation: the tube and scope together can greatly increase resistance and limit expiration, and relatively little space around the scope is a warning sign. What the figure cannot do is say by how much; that is read on the ventilator and in the patient while the scope is in.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'For ideal circles, the share of the tube’s cross-section left around a scope is one minus the square of the scope’s external diameter divided by the tube’s internal diameter: here a little under half. That is geometry — not a forecast of airflow or delivered volume, and not a safe-size calculator in either direction. It still matters, because the tube and scope together can greatly increase resistance and limit expiration, but it cannot say by how much: ventilation also depends on flow, exhalation, the ventilator’s settings and the patient’s mechanics, so it is watched on the ventilator and in the patient while the scope is in.',
    objectiveIds: ['M16-O6', 'M16-O1'],
    claimClass: 'synthesis',
    sourceRefs: [T15_CASE, T15_TUBE, S1_TUBE],
    reviewItemIds: ['R31'],
  },

  transfer: {
    id: 'scope-in-a-tube-transfer',
    itemType: 'management-decision',
    situation:
      'Thick secretions have built up in a ventilated adult’s airways, and a supervised clearance through the endotracheal tube is planned. Two scopes are on the cart, and the device information lists both for a tube of this size. One has the larger external diameter and the larger working channel; the other is slimmer, with a smaller channel.',
    stem: 'What should settle the choice?',
    choices: [
      {
        id: 'a',
        label:
          'The device listing: both are listed for this tube, so either leaves room to ventilate',
        rationale:
          'Being listed for the tube answers access and nothing more. The chosen scope then occupies the tube for as long as it is in, and the tube and scope together can greatly increase resistance and limit expiration; that consequence belongs in the choice.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label:
          'The working channel: thick secretions call for the largest channel the tube will take',
        rationale:
          'A larger working channel may improve fluid evacuation, but it does not justify compromising ventilation. The space the larger scope takes from the tube is a consequence to weigh and then watch, not one that faster clearance cancels.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'The space left: the slimmer scope leaves more of the tube open, so it keeps ventilation safe',
        rationale:
          'More space is better geometry, not a forecast of ventilation. Secretions, suction and a longer scope-in time can still reduce ventilation with the slimmer scope, so it is watched whichever scope goes in, and the smaller channel may offer less suction for thick secretions.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'The suction the task needs, set against what each scope’s diameter does to ventilation',
        rationale:
          'Selection weighs the task and the suction it needs against the ventilation consequences of each external diameter, using the device information and the team’s ventilation plan rather than a single size rule. Whichever scope goes in, delivered and exhaled volume, pressure and expiration are watched while it is there.',
        plausibility: 'best',
      },
    ],
    explanation:
      'That both scopes are listed for the tube settles access, not the choice. A larger working channel may clear fluid better and a slimmer scope leaves more of the tube open, but neither property establishes ventilation, and the larger channel does not justify compromising it. The choice weighs the task’s suction needs against the ventilation consequences of each external diameter, and ventilation is watched whichever scope goes in.',
    objectiveIds: ['M16-O1'],
    claimClass: 'synthesis',
    sourceRefs: [S1_SELECT, S1_SELECT_TUBE, T15_TUBE],
    reviewItemIds: ['R31'],
    transferVariant:
      'Before the procedure, choosing between two scopes that both go through the tube, instead of reading the space one pairing leaves: the same principle — neither getting through the tube nor the space left settles ventilation — applied to scope selection, with the working-channel diameter from the check before use.',
    retrievesFrom: 'pre-use-check',
  },

  practice: [
    {
      id: 'mc-alarm-limits',
      presentationTitle: 'Going back in after a paused secretion clearance',
      situation:
        'In the intensive care unit, a supervised bronchoscopy is clearing thick secretions through the endotracheal tube of an adult ventilated on a volume-targeted mode, with a respiratory therapist at the ventilator. The patient coughed as the scope went in. Some minutes later the high-pressure alarm sounded with each breath: peak pressure had risen and exhaled volume had fallen from this patient’s values before the scope, and the team paused and brought the scope out. With the scope out, pressure and exhaled volume are back near those values and oximetry has not changed. Secretions remain in the right lower lobe, and a colleague offers to raise the alarm limits so the clearance can be finished without interruption.',
      item: {
        id: 'mc-alarm-limits',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Reassess the patient, then go back in with the alarm limits raised so the clearance can finish',
            rationale:
              'Reassessing first is sound, but raised limits hide the next loss of ventilation instead of preventing it, and they can change the ventilator’s high-pressure protective behavior, which depends on the device and is read with the respiratory therapist. Alarm limits are not raised simply to finish a procedure.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label:
              'Go back in now with the therapist watching, since recovery with the scope out shows the scope was the cause',
            rationale:
              'Recovery with the scope out fits obstruction by the scope in the tube, but it does not settle the cause: several causes can act together, and a pneumothorax, clot or a displaced tube is still looked for. Going back in without reassessing, and without an agreed moment to pause, risks the same loss of ventilation.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label:
              'Give more sedation, then go back in, since the coughing at the start set off the alarms',
            rationale:
              'A high-pressure alarm is not automatically coughing, and deterioration is not labeled a need for more sedation because the patient coughed at first. More sedative adds its own respiratory and cardiovascular effects while the cause goes unexamined.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Reassess the patient, then go back in with a pause point agreed with the therapist, alarms as set',
            rationale:
              'Recovery with the scope out fits obstruction by the scope in the tube but does not exclude a pneumothorax, clot or a displaced tube, so the patient is reassessed first. If the clearance still goes ahead, the team agrees with the respiratory therapist how long the scope stays in and when it comes out to let ventilation recover, and the alarms stay as set so the next change is seen.',
            plausibility: 'best',
          },
        ],
        explanation:
          'With the scope out and ventilation back near this patient’s values, the picture fits obstruction by the scope in the tube, but the recovery does not settle the cause: several causes can act together, and a pneumothorax, clot or a displaced tube is looked for before going back in. If the clearance goes ahead, it is planned with the respiratory therapist — how long the scope stays in and when it comes out — with the alarms left as set so the next change is seen. Raising alarm limits to finish hides that change without treating it.',
        objectiveIds: ['M16-O2', 'M16-O6'],
        claimClass: 'synthesis',
        sourceRefs: [S1_TUBE, T15_BURDEN],
        reviewItemIds: ['R31'],
      },
    },
  ],
}
