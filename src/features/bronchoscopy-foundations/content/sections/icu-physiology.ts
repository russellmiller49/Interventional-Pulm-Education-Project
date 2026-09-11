import type { SourceRef } from '../../data/sources'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M16, second half — The ventilator’s breath, and the procedures beyond inspection. The ICU
 * application section after `scope-in-a-tube`, built around one idea: a conventional mandatory
 * pressure-control breath is pressure-targeted and time-cycled, so the volume it delivers is the
 * result, and added resistance can lower it while the pressure and the timing look unchanged (§17.8,
 * R29, U8). The Act carries M16-O3: sampling procedures sorted by compartment and guidance (§15.5,
 * §17.3–§17.5, R27). Radiation protection (M16-O4) is taught as principles only (§17.6, S2 PDF
 * 41–43), with device settings and occupational rules left to local radiation-safety review (U5).
 * Drill D23; practice adapts C17 and keeps its revealed contralateral tension pneumothorax and the
 * broader differential (R30); two micro-cases carry M16-O4: fluoroscopy while the team decides, and
 * forceps experience as no readiness for cryobiopsy (§17.3).
 */

// ── Citations, exactly as the knowledge spec's brackets give them ────────────────────────────────

/** §17.1 bronchoscopy through an endotracheal or tracheostomy tube [S1, PDF 155–158]. */
const S1_TUBE: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } }
/** §17.8 pressure control is not pressure-cycled ventilation [T15, 00:18:49–00:20:25; U8]. */
const T15_PC: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:18:49', end: '00:20:25' },
}
const U8_MODES: SourceRef = {
  sourceId: 'U8',
  location: { kind: 'section', label: 'ventilation modes' },
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
/** §17.9 the cumulative physiologic burden [T15, 00:16:23–00:21:18]. */
const T15_BURDEN: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:16:23', end: '00:21:18' },
}
/** C17 [T15, U8; 00:02:49–00:04:03; 00:18:49–00:22:00]. */
const T15_C17: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:18:49', end: '00:22:00' },
}
/** R31 scope/tube and ventilator rules [T15, 00:21:18–00:22:00]. */
const T15_RULES: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:21:18', end: '00:22:00' },
}
/** §15.5 name the tissue compartment and the guidance separately [T06, 00:02:35–00:06:36, 00:12:57–00:16:47]. */
const T06_COMPARTMENT: SourceRef = {
  sourceId: 'T06',
  location: { kind: 'time-span', start: '00:02:35', end: '00:06:36' },
}
const T06_GUIDANCE: SourceRef = {
  sourceId: 'T06',
  location: { kind: 'time-span', start: '00:12:57', end: '00:16:47' },
}
/** §14.2 brushing [S1, PDF 127–128]; §14.3 endobronchial forceps biopsy [S1, PDF 129–130]. */
const S1_BRUSH: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127, to: 128 } }
const S1_EBB: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 129, to: 130 } }
/** §17.3 transbronchial lung biopsy [S1, PDF 134–144]. */
const S1_TBLB: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 134, to: 144 } }
/** §17.4 conventional TBNA and EBUS [S1, PDF 140, 145–150, 169–174]. */
const S1_TBNA: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 145, to: 150 } }
const S1_EBUS: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 169, to: 174 } }
/** §14.4 needle safety is a prerequisite, not a license [S1, PDF 148–149; S2, PDF 24]. */
const S1_NEEDLE: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 148, to: 149 } }
/** §17.5 bronchoscopic intubation and therapeutic procedures [S2, PDF 24; S1, PDF 114]. */
const S2_ADVANCED: SourceRef = { sourceId: 'S2', location: { kind: 'pdf-pages', from: 24 } }
/** §17.6 foundational radiation safety [S2, PDF 41–43; U5]. */
const S2_RADIATION: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 41, to: 43 },
}
const U5_STAFF: SourceRef = {
  sourceId: 'U5',
  location: { kind: 'section', label: 'staff protection and pregnant workers' },
}

export const section: BronchSectionDefinition = {
  id: 'icu-physiology',
  title: 'Ventilator breaths and procedures beyond inspection',
  shortTitle: 'ICU physiology',
  minutes: 8,
  moduleIds: ['M16'],
  objectives: [
    {
      objectiveId: 'M16-O3',
      subtask:
        'Sorts eight procedures by the compartment they sample and what shows the tool in the target, separating a needle seen on ultrasound from a sample taken under direct view, and a peripheral probe from a needle beside the airway.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M16-O4',
      subtask:
        'Decides, in one practice case, what happens to fluoroscopy while the team deliberates at a supervised lung biopsy, and in another, declines a cryobiopsy on the strength of forceps experience.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M16-O5',
      subtask:
        'Commits to what ends a conventional mandatory pressure-control breath, predicts which reading can move once a scope enters a different patient’s tracheostomy tube, and weighs that breath within a broad differential in practice.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D23'],
  prerequisites: ['protected-accessories', 'deterioration', 'scope-in-a-tube'],

  clinicalQuestion:
    'Before a bronchoscopy through the tube of a patient on pressure-control ventilation, what do you need to know about the breaths the ventilator is giving?',
  recognizeTitle: 'A ventilated patient before bronchoscopy through the tube',
  objective:
    'Name what ends a conventional mandatory pressure-control breath and what the ventilator can show with a scope in the tube; separate procedures beyond inspection by what they sample and what verifies the target.',
  why: 'Bronchoscopy through an endotracheal tube happens inside the ventilator’s breaths. Explaining any change on the ventilator starts with knowing how those breaths are delivered and ended, and a request for sampling starts with knowing which procedure is being asked for.',
  newConcept:
    'A conventional mandatory pressure-control breath is pressure-targeted and time-cycled: the set inspiratory time ends it, and the volume it delivers is whatever the set pressure moves in that time, so added resistance can lower that volume with no change in the pressure or the timing.',
  incrementSentence:
    'This section adds one idea to the scope in the tube: on conventional pressure control the ventilator keeps the pressure and the timing, and what added resistance can change is the volume delivered.',
  harmfulReflex:
    'Reading an unchanged pressure and a quiet ventilator as unchanged ventilation, and carrying on while exhaled volume falls.',
  anchor: {
    analogy:
      'A garden hose run from a tap at a fixed setting for a fixed count of seconds: kink the hose and each fill still stops on the count, but less water can reach the bucket in that time.',
    precise:
      'Conventional mandatory pressure control is pressure-targeted and time-cycled. The set inspiratory time ends each breath; the volume is what the set pressure moves in that time, so added resistance or worse compliance can lower it with no change in the pressure target or the timing.',
    checklistLabel: 'Before explaining a ventilator reading during bronchoscopy, know',
    checklist: [
      'The actual mode, and what ends its breaths',
      'Exhaled volume against this patient’s own baseline',
      'What this ventilator’s alarms and protections do, from the respiratory therapist',
      'Who calls a pause, and how ventilation is restored',
    ],
  },

  spineStops: [],
  grammarRowIds: [],
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
      'No single scope control answers a falling exhaled volume on pressure control. The team pauses and restores ventilation, which can mean stopping suction and bringing the scope out, and works the reading through with the respiratory therapist and supervisor.',
  },
  precommitDenyPatterns: [
    /time[- ]cycl/i,
    /inspiratory time/i,
    /less volume|delivered volume (can )?fall/i,
    /reaching the (target|set) pressure/i,
  ],
  modelBoundary:
    'The monitor and the ventilator readings in this section are scripted in words for teaching. No waveform, value or ventilator setting is modelled, and the lecture’s original waveforms were not available. What a particular ventilator’s alarms and protective actions do comes from its instructions and the respiratory therapist. The procedure sort names what each procedure samples and how its target is verified; it teaches none of their technique.',
  localPolicyIds: ['icu_bronchoscopy_policy', 'radiation_policy'],
  reviewItemIds: ['R27', 'R29', 'R30', 'R31'],

  blocks: [
    {
      id: 'inside-the-breath',
      kind: 'question',
      role: 'framing',
      heading: 'Bronchoscopy inside the ventilator’s breaths',
      body: 'In a ventilated patient, bronchoscopy through an endotracheal or tracheostomy tube happens inside the ventilator’s breaths. The earlier section read the tube and the scope as geometry; this one reads the ventilator.\n\nBefore explaining any change on the ventilator, know the actual mode: what each mandatory breath targets, and what brings its inspiration to an end.',
      claimClass: 'synthesis',
      sourceRefs: [S1_TUBE, T15_PC, U8_MODES],
    },
    {
      id: 'ventilator-signals',
      kind: 'signals',
      role: 'signals',
      heading: 'What the ventilator and the patient report',
      body: 'Each reading reports something different. Before a decision depends on one, name what it measures.',
      pointsLabel: 'Readings available during bronchoscopy through the tube',
      points: [
        'The actual mode, and how this ventilator’s alarms and protections behave',
        'Delivered and exhaled volume',
        'Airway pressure',
        'Minute ventilation',
        'Whether expiration empties before the next breath',
        'Oximetry, capnography and blood pressure',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_TUBE, T15_PC],
    },
    {
      id: 'breath-at-baseline',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The breath at baseline',
      body: 'Before the scope enters, the mandatory breaths arrive at the rate the team has seen all shift. Exhaled volume and minute ventilation sit at this patient’s own baseline, expiration empties before the next breath, and oximetry, capnography and blood pressure are steady. The team has agreed the oxygen and ventilation plan, the anticipated scope-in time and the opportunities to let ventilation recover, what a change in delivered volume or pressure will mean, and who will call a pause.\n\nThat is the reference every later reading is compared with: this patient’s own breaths before the scope, not a remembered number.',
      claimClass: 'transcript-source',
      sourceRefs: [T15_BURDEN, S1_TUBE],
      localPolicyIds: ['icu_bronchoscopy_policy'],
    },
    {
      id: 'what-ends-the-breath',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What ends a pressure-control breath',
      body: 'Conventional mandatory pressure control is pressure-targeted and time-cycled. The ventilator brings the airway pressure to the set target and holds it; the set inspiratory time, not reaching that pressure, ends inspiration. The volume delivered is whatever the pressure moves in that time, so it can fall when resistance rises or compliance worsens while the target and the timing stay the same.\n\nOn this mode exhaled volume is the reading that shows the change: the pressure stays at the level the ventilator holds, so a fall in exhaled volume can arrive with no rise in pressure and no alarm. Airway pressure, expiratory emptying, oximetry, capnography and blood pressure are still watched.\n\nOther breaths behave differently. On a volume-targeted breath the volume is set and the pressure is the result, so added resistance shows as a rising peak pressure. A pressure-support breath is spontaneous and flow-cycled. A ventilator’s high-pressure protection is device-specific: what it does to a breath, and what its alarms mean, come from that ventilator’s instructions and the respiratory therapist.',
      claimClass: 'update',
      sourceRefs: [U8_MODES, T15_PC],
      reviewItemIds: ['R29'],
    },
    {
      id: 'compartment-and-guidance',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Compartment, tool and guidance',
      body: 'Two separate questions describe a sampling procedure: which compartment is sampled, and what verifies that the tool is in the target. An endobronchial biopsy (EBB) samples an airway lesion under direct view. A transbronchial lung biopsy (TBLB) samples tissue beyond the bronchial lumen; fluoroscopy can help localize the target and follow the tool, but does not ensure that vessels and pleura are avoided, and the risks include bleeding and pneumothorax.\n\nTransbronchial needle aspiration (TBNA) passes a needle across the airway wall to a target, or into a lesion. Conventional TBNA depends on extraluminal anatomy and target localization, without the real-time ultrasound image that convex-probe endobronchial ultrasound (EBUS) adds. A radial ultrasound probe is used to assess a peripheral target. So a needle seen on ultrasound is still transbronchial, and being out of white-light view does not make a procedure a lung biopsy.',
      claimClass: 'synthesis',
      sourceRefs: [T06_COMPARTMENT, T06_GUIDANCE, S1_TBLB, S1_TBNA, S1_EBUS],
      reviewItemIds: ['R27'],
    },
    {
      id: 'own-training',
      kind: 'after-commitment',
      role: 'boundary',
      heading: 'Procedures with their own training',
      body: 'TBLB, conventional TBNA, EBUS, bronchoscopic intubation and therapeutic procedures are distinct procedures, each needing its own training and supervised evaluation. Neither conventional TBNA nor EBUS is regular bronchoscopy with a biopsy button, and keeping a needle retracted in its sheath does not confer competence in needle aspiration. Cryobiopsy does not inherit the rules or the readiness of forceps biopsy.\n\nForeign-body extraction, dilation, debulking, stenting, ablation and rigid bronchoscopy need separate technical training and emergency preparation, and laser, electrosurgery and other energy devices add hazards that ordinary inspection does not carry. At this stage the skill is recognizing when one of these procedures, or a referral, is needed.',
      claimClass: 'source',
      sourceRefs: [S1_TBNA, S1_NEEDLE, S1_TBLB, S2_ADVANCED],
    },
    {
      id: 'fluoroscopy-principles',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Fluoroscopy answers a question',
      body: 'Fluoroscopy used for guidance should answer a specific question and then stop, rather than stay on while the operator thinks. Brightening the displayed image is not an improvement in the acquired signal.',
      pointsLabel: 'The foundational principles',
      points: [
        'Justify each use',
        'Minimize exposure: brief, necessary screening and last-image hold',
        'Collimate, and keep appropriate detector and patient geometry',
        'Avoid unnecessary magnification',
        'Use shielding, and monitor staff dose',
      ],
      claimClass: 'source',
      sourceRefs: [S2_RADIATION],
      localPolicyIds: ['radiation_policy'],
    },
    {
      id: 'radiation-and-staff',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Radiation safety for the whole team',
      body: 'IAEA guidance supports proper staff shielding, positioning and dosimetry. Pregnancy calls for an individual occupational review and appropriate protection, not automatic exclusion from all fluoroscopically guided work. Device modes, radiation settings and occupational requirements are reviewed with your institution’s radiation-safety personnel.',
      claimClass: 'update',
      sourceRefs: [U5_STAFF],
      localPolicyIds: ['radiation_policy'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors reads a setting, a picture or a procedure’s name as more than it reports.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Reading an unchanged pressure as unchanged ventilation: on pressure control the pressure is what the ventilator holds; read exhaled volume against this patient’s baseline.',
        'Describing a pressure-control breath as ending when the set pressure is reached: that is a different mechanism; on conventional pressure control the set inspiratory time ends the breath.',
        'Reading the space left around the scope as a forecast of volume: it is geometry; delivered volume also depends on the tube, secretions, compliance, the pressure and the time.',
        'Raising alarm limits or silencing alarms to finish: pause, and work the reading through with the respiratory therapist.',
        'Calling a needle seen on ultrasound endobronchial: compartment and guidance are separate questions.',
        'Brightening the displayed image to see more: brightness changes the display, not the acquired signal; image only to answer a question.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [T15_PC, U8_MODES, T15_RULES, T06_GUIDANCE, S2_RADIATION],
      reviewItemIds: ['R27', 'R29', 'R31'],
      registerExemptions: [
        {
          reviewItemId: 'R29',
          reason:
            'Names the belief that a pressure-control breath ends at the set pressure as the error it is, and replaces it with time cycling.',
        },
      ],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption:
      'An intubated patient on conventional mandatory pressure-control ventilation, before bronchoscopy through the tube — scripted for teaching',
    readings: [
      {
        channel: 'peak-pressure',
        words: 'At the level set for this patient, breath after breath',
        trend: 'steady',
      },
      {
        channel: 'exhaled-volume',
        words: 'Steady at this patient’s own baseline',
        trend: 'steady',
      },
      {
        channel: 'capnography',
        words: 'A regular trace, unchanged through the morning',
        trend: 'steady',
      },
      { channel: 'oximetry', words: 'Unchanged from earlier in the day', trend: 'steady' },
      { channel: 'blood-pressure', words: 'Steady', trend: 'steady' },
    ],
  },

  steps: {
    recognize: {
      instruction:
        'Read the monitor in the Simulator panel: this patient’s baseline on the ventilator, before the bronchoscope enters the tube.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.monitor },
    },
    act: {
      title: 'Sampling by compartment and guidance',
      instruction:
        'Place each procedure under what it samples and what shows the tool in the target, on this card, then check the placements.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.sortRows },
    },
    explain: {
      title: 'What the ventilator was doing',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and Compartment, tool and guidance in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'sort',
    sort: {
      id: 'compartment-and-guidance',
      prompt:
        'Eight procedures a bronchoscopist may be asked about. Place each under what it samples and what shows the tool in the target, or under treatment when the aim is to treat the airway.',
      origins: [
        {
          id: 'wall-direct',
          label: 'The airway wall, under direct view',
          definition:
            'An airway lesion is sampled, and the white-light image shows the tool meeting it.',
        },
        {
          id: 'across-wall-anatomy',
          label: 'Across the wall, placed from anatomy',
          definition:
            'A needle crosses the airway wall to a target beside the airway, placed from extraluminal anatomy and target localization, without the real-time ultrasound image that EBUS adds.',
        },
        {
          id: 'across-wall-ultrasound',
          label: 'Across the wall, seen on ultrasound',
          definition:
            'A needle crosses the airway wall to a target beside the airway, and a real-time ultrasound image, not the white-light view, shows it in the target.',
        },
        {
          id: 'peripheral-imaging',
          label: 'Peripheral lung tissue, located by imaging',
          definition:
            'Tissue in the peripheral lung, beyond the bronchial lumen; imaging other than the bronchoscope’s own view helps locate the target. Being out of white-light view does not by itself place a procedure here.',
        },
        {
          id: 'treats-airway',
          label: 'Treats the airway rather than sampling it',
          definition:
            'The aim is to change the airway itself, not to take a sample; each of these procedures needs its own technical training and emergency preparation.',
        },
      ],
      rows: [
        {
          id: 'ebb',
          statement: 'Forceps biopsy of a raised lesion on the wall of the right main bronchus',
          origin: 'wall-direct',
          rationale:
            'The target is an airway lesion and the jaws are seen engaging it: an endobronchial biopsy (EBB), sampled under direct white-light view.',
        },
        {
          id: 'brushing',
          statement: 'Brushing the surface of a visible lesion in the left lower lobe bronchus',
          origin: 'wall-direct',
          rationale:
            'Brushing a visible lesion samples the airway surface under direct view and retrieves mainly cells. Brushing beyond direct vision is a separate, extension procedure.',
        },
        {
          id: 'conventional-tbna',
          statement:
            'A needle through the tracheal wall into an enlarged node beside it, out of the bronchoscope’s view, aimed from the CT and the airway landmarks',
          origin: 'across-wall-anatomy',
          rationale:
            'Conventional transbronchial needle aspiration (TBNA) samples beyond the airway wall. It depends on extraluminal anatomy and target localization, with no real-time ultrasound image of the needle; being out of white-light view does not make it a lung biopsy. It is a distinct procedure with its own training and supervised evaluation.',
        },
        {
          id: 'convex-ebus',
          statement:
            'A needle through the airway wall into a node beside it, placed under endobronchial ultrasound',
          origin: 'across-wall-ultrasound',
          rationale:
            'Convex-probe endobronchial ultrasound (EBUS) samples the same compartment as conventional TBNA, beyond the wall, but ultrasound shows the needle in the target. The probe works from inside the airway and the needle still samples beyond it, so the sample is not endobronchial. It is a distinct procedure with its own training and supervised evaluation.',
        },
        {
          id: 'tblb',
          statement:
            'Forceps biopsy of lung tissue in the periphery of the right lower lobe, with fluoroscopy following the forceps',
          origin: 'peripheral-imaging',
          rationale:
            'Transbronchial lung biopsy (TBLB) samples tissue beyond the bronchial lumen. Fluoroscopy can help localize the target and follow the tool, but does not ensure that vessels and pleura are avoided; the risks include bleeding and pneumothorax. It is a distinct procedure with its own training and supervised evaluation.',
        },
        {
          id: 'radial-ebus',
          statement:
            'A radial ultrasound probe advanced toward a peripheral nodule to show whether it has been reached',
          origin: 'peripheral-imaging',
          rationale:
            'A radial probe is used to assess a target in the peripheral lung, so the ultrasound here locates a peripheral target, not a node beside the airway. It is distinct from the convex probe used for accessible structures beside the airways, and has its own training and supervised evaluation.',
        },
        {
          id: 'foreign-body',
          statement: 'Removing an inhaled object from the left main bronchus',
          origin: 'treats-airway',
          rationale:
            'Extraction treats the airway; it is not a sample. It needs its own technical training and emergency preparation, and recognizing that need is the skill at this stage.',
        },
        {
          id: 'debulking',
          statement: 'Debulking a tumor in the trachea with an energy device',
          origin: 'treats-airway',
          rationale:
            'Debulking treats the airway. Laser, electrosurgery and other energy devices add hazards absent from ordinary inspection, and their safe use cannot be inferred from basic flexible-scope skill.',
        },
      ],
      sourceRefs: [
        T06_COMPARTMENT,
        T06_GUIDANCE,
        S1_BRUSH,
        S1_EBB,
        S1_TBLB,
        S1_TBNA,
        S1_NEEDLE,
        S1_EBUS,
        S2_ADVANCED,
      ],
    },
  },

  prediction: {
    id: 'Q25',
    seedId: 'Q25',
    itemType: 'mechanism-interpretation',
    situation:
      'An intubated adult in the intensive care unit is receiving conventional mandatory pressure-control ventilation. Before a supervised bronchoscopy through the endotracheal tube, the respiratory therapist asks the fellow to describe the breaths the ventilator is giving.',
    stem: 'Which description fits these mandatory breaths?',
    choices: [
      {
        id: 'a',
        label: 'Pressure-targeted, ending when that pressure is reached',
        rationale:
          'Reaching the set pressure does not end a conventional mandatory pressure-control breath: the ventilator holds that pressure, and the set inspiratory time ends the breath. A breath cut short at a pressure is a different mechanism, such as a device’s high-pressure protection.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Pressure-targeted, ending when the inspiratory time is up',
        rationale:
          'The ventilator holds the set target pressure until the set inspiratory time ends the mandatory inspiration. The volume that pressure moves in that time is the result, not a setting.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Pressure-targeted, ending when inspiratory flow falls',
        rationale:
          'Flow cycling belongs to spontaneous pressure-support breaths, which end as the patient’s own inspiratory flow falls. A conventional mandatory pressure-control breath is ended by the set inspiratory time, whatever the flow is doing.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Pressure-targeted, ending once a set volume has been delivered',
        rationale:
          'A set volume belongs to volume-targeted breaths. On conventional pressure control no volume is set: the volume is whatever the held pressure moves in the set inspiratory time, and that time ends the breath.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A conventional mandatory pressure-control breath is pressure-targeted and time-cycled: it brings the airway pressure to the set target and holds it until the set inspiratory time ends inspiration; reaching the target pressure does not end the breath. The volume it delivers is whatever that pressure moves in that time, so delivered volume can fall when resistance rises or compliance worsens, with the target and the timing unchanged. Flow cycling belongs to spontaneous pressure-support breaths, a set volume to volume-targeted breaths, and a ventilator’s high-pressure protection is a separate, device-specific behavior.',
    objectiveIds: ['M16-O5'],
    claimClass: 'update',
    sourceRefs: [U8_MODES, T15_PC],
    reviewItemIds: ['R29'],
    registerExemptions: [
      {
        reviewItemId: 'R29',
        reason:
          'Option a states the belief that a pressure-control breath ends when its pressure is reached, and its rationale refutes it.',
      },
    ],
  },

  transfer: {
    id: 'icu-physiology-transfer',
    itemType: 'mechanism-interpretation',
    situation:
      'A patient with a tracheostomy is receiving conventional mandatory pressure-control ventilation. A supervised bronchoscopy through the tracheostomy tube is about to begin, to inspect the airway beyond the tube’s tip. The set pressure, the set inspiratory time and the alarm limits will stay as they are.',
    stem: 'Once the scope is in the tube, which change should the team be watching for?',
    choices: [
      {
        id: 'a',
        label: 'Peak pressure climbing breath by breath until the high-pressure alarm sounds',
        rationale:
          'That is the picture of a volume-targeted breath, where the volume is set and the pressure is the result. On conventional pressure control the ventilator holds the set pressure, so the pressure reading stays at its level while the scope adds resistance.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label:
          'Exhaled volume falling from baseline, while the pressure reading and the timing hold',
        rationale:
          'The ventilator keeps the set pressure for the set inspiratory time. The scope’s resistance slows flow through the tube, so less gas can arrive in that time; exhaled volume against this patient’s baseline is the reading that shows it.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label:
          'Shorter breaths, because the set pressure is now reached sooner with the scope in the tube',
        rationale:
          'Reaching the set pressure does not end a conventional mandatory pressure-control breath; the set inspiratory time does, with or without the scope. The breaths keep their length and can carry less gas.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Oximetry falling first, while the ventilator readings stay at their baseline',
        rationale:
          'Oximetry can hold while ventilation falls, so waiting for it lets a fall in exhaled volume run on unread. On this mode exhaled volume is the reading to watch: if it falls, pause, and work it through with the respiratory therapist.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'On conventional pressure control the ventilator holds the set pressure until the set inspiratory time ends the breath, so the volume is whatever that pressure moves through the tube and the scope in that time. The scope’s resistance can lower it, and obstruction can also limit expiration, with the pressure reading and the timing unchanged and no alarm sounding; a climbing peak pressure is the picture of a volume-targeted breath, not this one. Oximetry can hold while ventilation falls, and suction, the circuit or a pneumothorax can also lower exhaled volume, so read it against this patient’s baseline and, if it falls, pause and work it through with the respiratory therapist.',
    objectiveIds: ['M16-O5'],
    claimClass: 'synthesis',
    sourceRefs: [U8_MODES, T15_PC, S1_TUBE, T15_TUBE, T15_BURDEN],
    reviewItemIds: ['R29', 'R31'],
    registerExemptions: [
      {
        reviewItemId: 'R29',
        reason:
          'Option c states the belief that a pressure-control breath ends when its pressure is reached, and its rationale refutes it.',
      },
    ],
    transferVariant:
      'A different patient, a tracheostomy tube and a different task: before the scope goes in, predicting which reading can move, against the climbing-pressure picture from the scope in the tube, instead of describing what ends the breath.',
    retrievesFrom: 'scope-in-a-tube',
  },

  practice: [
    {
      id: 'C17',
      manifestCaseId: 'C17',
      presentationTitle: 'The scope fits, and the patient deteriorates',
      situation:
        'An intubated patient after surgery is having secretions cleared through a 7.5 mm internal-diameter endotracheal tube with a 6.2 mm external-diameter bronchoscope, on conventional mandatory pressure-control ventilation. The scope went through the tube easily. The clearance has gone on longer than planned, with prolonged coughing. Exhaled volume has fallen from this patient’s baseline, blood pressure is falling and oxygen saturation is dropping.',
      item: {
        id: 'C17',
        itemType: 'management-decision',
        stem: 'What should happen next?',
        choices: [
          {
            id: 'a',
            label:
              'Keep clearing, since the scope went through the tube easily and leaves room to ventilate',
            rationale:
              'That the scope went through shows its external diameter fits; the space left around it is geometry, not ventilation. Continuing because the scope physically goes through the tube is a critical error in this case, while volume, blood pressure and saturation all fall.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label:
              'Stop, restore ventilation, and evaluate the airway, air trapping, circulation and a pneumothorax',
            rationale:
              'Interrupting the provoking activity and restoring ventilation come first. Falling volume with hypotension and desaturation has several possible causes, so the team evaluates airway patency, ventilation, hemodynamics, air trapping and pneumothorax together.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label:
              'Raise the set rate, since the narrow space around the scope is retaining carbon dioxide',
            rationale:
              'This settles on carbon dioxide retention from the equipment sizes without evaluation, a critical error in this case; hypercapnia cannot be read from the two diameters. A faster rate shortens the time to exhale when air may already be trapped, and ventilator changes belong to the clinical team.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Find the cause first — the airway, air trapping, circulation or a pneumothorax — then stop clearing',
            rationale:
              'The differential is the right one, but the order is not: the clearance and its coughing go on while the team searches, and ventilation is not restored. Interrupting the provoking activity and restoring ventilation come first, with the evaluation alongside.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Several contributors can act here at once: the scope’s resistance can lower delivered volume on time-cycled pressure control, obstruction can limit expiration and trap air, prolonged coughing can compound instability, and suction can remove gas. In the lecture this case is adapted from, the deterioration proved to be a contralateral tension pneumothorax, not a hypercapnic arrest inferred from the tube and scope sizes. The narrated account cannot prove a single cause, so the first move is to stop the provoking activity, restore ventilation and evaluate airway patency, ventilation, hemodynamics, air trapping and pneumothorax with the team.',
        objectiveIds: ['M16-O5', 'M16-O6', 'M15-O3'],
        claimClass: 'transcript-source',
        sourceRefs: [T15_CASE, T15_C17, T15_BURDEN, U8_MODES],
        reviewItemIds: ['R29', 'R30', 'R31'],
      },
    },
    {
      id: 'mc-fluoroscopy-while-deciding',
      presentationTitle: 'A pause to choose the next biopsy site under fluoroscopy',
      situation:
        'At a supervised transbronchial lung biopsy, the attending and the fellow performing it stop to discuss which area to sample next. The forceps is not moving. The fluoroscopy pedal is pressed, and the live image is running on the monitor.',
      item: {
        id: 'mc-fluoroscopy-while-deciding',
        itemType: 'management-decision',
        stem: 'What should happen to the fluoroscopy while they decide?',
        choices: [
          {
            id: 'a',
            label:
              'Keep screening throughout, so the image is already live if the forceps shifts while they talk',
            rationale:
              'Screening while nobody is asking the image a question exposes the patient and the staff without answering anything. If the forceps is about to move, image then, to answer that question.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label:
              'Brighten the displayed image, so that less screening is needed for the rest of the biopsy',
            rationale:
              'Brightness changes how the displayed picture looks; it is not an improvement in the acquired signal, and it does not answer which area to sample.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label:
              'Stop screening and decide from the last held image, then image again for the next question',
            rationale:
              'Fluoroscopy should answer a specific question and then stop. Last-image hold keeps the most recent picture for the discussion without further exposure; screening resumes when there is a new question, such as where the forceps is once it moves.',
            plausibility: 'best',
          },
          {
            id: 'd',
            label:
              'Magnify the live image, so the forceps tip can be judged more closely while they talk',
            rationale:
              'Magnifying keeps the live image running while nobody is asking it a question, the same exposure as keeping the screening on, and adds magnification the principles say to avoid. A larger picture does not answer which area to sample; the image can wait for the next question.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'Fluoroscopy answers a specific question and then stops; it does not stay on while the team thinks. The foundational principles are justification, exposure minimization through brief necessary screening and last-image hold, collimation, appropriate detector and patient geometry, no unnecessary magnification, shielding and staff dose monitoring. Device modes, settings and occupational requirements come from your institution’s radiation-safety personnel.',
        objectiveIds: ['M16-O4'],
        claimClass: 'source',
        sourceRefs: [S2_RADIATION, U5_STAFF],
      },
    },
    {
      id: 'mc-cryobiopsy-readiness',
      presentationTitle: 'An offer of the cryobiopsy on next week’s list',
      situation:
        'A fellow who takes forceps biopsies of visible airway lesions without difficulty, under supervision, is offered the transbronchial lung cryobiopsy on next week’s list, since the forceps technique is already familiar.',
      item: {
        id: 'mc-cryobiopsy-readiness',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label: 'Take it, since the forceps technique carries over to the cryoprobe',
            rationale:
              'Cryobiopsy does not inherit the rules or the readiness of forceps biopsy. The probe samples lung beyond the bronchial lumen, where the risks include bleeding and pneumothorax, and its technique is taught and evaluated in its own supervised training.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label: 'Decline until cryobiopsy has its own training and supervised evaluation',
            rationale:
              'Cryobiopsy is a separate technique with its own training and supervised evaluation. Forceps biopsies of visible airway lesions, however well taken, do not supply that readiness; recognizing it is the skill at this stage.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label:
              'Take it under fluoroscopy, since the live image shows where the probe sits in the lung',
            rationale:
              'Fluoroscopy can help localize the target and follow the tool, but it does not ensure that vessels and pleura are avoided. An image of the probe is guidance for a trained operator, not readiness for the procedure.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Take it once a supervised forceps lung biopsy has also been done',
            rationale:
              'A transbronchial forceps biopsy is itself a distinct procedure with its own training, and cryobiopsy does not inherit its rules or readiness either. Readiness for the cryobiopsy comes from the cryobiopsy’s own supervised training.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Cryobiopsy is a separate technique and does not inherit the rules or the readiness of forceps biopsy. A transbronchial lung biopsy samples tissue beyond the bronchial lumen, where the risks include bleeding and pneumothorax, and fluoroscopy can help localize the target without ensuring that vessels and pleura are avoided. Each of these procedures needs its own training and supervised evaluation; at this stage the skill is recognizing that, not reading familiarity with forceps as readiness.',
        objectiveIds: ['M16-O4', 'M16-O3'],
        claimClass: 'source',
        sourceRefs: [S1_TBLB, S2_ADVANCED],
      },
    },
  ],
}
