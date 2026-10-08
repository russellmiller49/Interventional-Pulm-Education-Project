import type { VentilationAction, VentilatorControlKey } from '../engine/types'

export type LabMetric =
  | 'peak'
  | 'plateau'
  | 'volume'
  | 'rate'
  | 'minute'
  | 'ti'
  | 'expiratoryFlow'
  | 'intrinsicPeep'
  | 'spo2'
  | 'co2'
  | 'map'
  | 'effort'
  | 'missed'
  | 'dyspnea'
  | 'pain'
  | 'anxiety'
export type LabGoal =
  | { type: 'control'; key: VentilatorControlKey; value: number }
  | { type: 'mechanics'; key: 'complianceScale' | 'resistanceScale'; value: number }
  | { type: 'hold'; hold: 'inspiratory' | 'expiratory' }
  | { type: 'intervention'; id: string }
  | { type: 'pause-expiration' }
  | { type: 'inspect-inspiration' }
export interface LabRound {
  readonly title: string
  readonly caseId: string
  readonly setup?: readonly VentilationAction[]
  readonly introduction: string
  readonly look: string
  readonly prompt: string
  readonly choices: readonly [string, string, string]
  readonly correct: number
  readonly rationales: readonly [string, string, string]
  readonly task: string
  readonly goals: readonly LabGoal[]
  readonly seconds: number
  readonly watch: readonly LabMetric[]
  readonly explanation: string
  /**
   * A cue toward the discriminating feature, shown on request (MV-PRE-REVIEW-04, Q3). It used to be
   * the round's `look` line, which is already printed above the question. Each hint is drawn from
   * the round's own rationale and explanation, names no choice, and adds no clinical claim.
   */
  readonly hint: string
  /**
   * What the optional question asks for, where the maneuver does not say (Q2): a round that changes
   * a setting can still ask the learner to identify a reading or to reflect, not to predict.
   */
  readonly asks?: LabQuestionKind
  /**
   * This part deliberately repeats, or runs ahead of, another section's part (S5-1, S7-1, S11-1,
   * S12-1). Printed above the part so a repeat reads as a revisit and an early use as a preview.
   */
  readonly relation?: LabRoundRelation
}
export type LabQuestionKind = 'predict' | 'identify' | 'interpret' | 'reflect'
export interface LabRoundRelation {
  readonly kind: 'revisit' | 'preview'
  readonly unitId: string
  /** The part of that section, when the relation is to one part and not the whole section. */
  readonly part?: 1 | 2
  readonly note: string
}
export interface LearningExperiment {
  readonly unitId: string
  readonly panelId: string
  readonly rounds: readonly [LabRound, LabRound]
}
const c = (key: VentilatorControlKey, value: number): LabGoal => ({ type: 'control', key, value })
const m = (key: 'complianceScale' | 'resistanceScale', value: number): LabGoal => ({
  type: 'mechanics',
  key,
  value,
})
const hold: LabGoal = { type: 'hold', hold: 'inspiratory' }
const action = (id: string): LabGoal => ({ type: 'intervention', id })
const set = (control: VentilatorControlKey, value: number): VentilationAction => ({
  type: 'SET_CONTROL',
  control,
  value,
})
const mechanics = (complianceScale = 1, resistanceScale = 1): VentilationAction => ({
  type: 'SET_TEACHING_MECHANICS',
  overrides: { complianceScale, resistanceScale },
})
const pressureMode: readonly VentilationAction[] = [
  { type: 'SELECT_MODE', mode: 'pressure-ac' },
  { type: 'CONFIRM_MODE' },
  set('deltaPControlCmH2O', 12),
  set('inspiratoryTimeSeconds', 0.9),
]

function round(
  r: Omit<LabRound, 'caseId' | 'seconds'> & Partial<Pick<LabRound, 'caseId' | 'seconds'>>,
): LabRound {
  return { caseId: 'MV-LAB', seconds: 12, ...r }
}
const stiffVolume = round({
  title: 'Change the lung, keep the volume',
  hint: 'Volume control holds one of the two things you are comparing. Decide which trace the machine is holding, then ask what a stiffer system does to the other.',
  introduction:
    'This passive patient is receiving volume-controlled breaths. You can change the lung while the ventilator keeps its settings.',
  look: 'Compare the top of the pressure trace with the height of the volume trace.',
  prompt:
    'At the same volume and flow settings, what will a stiffer respiratory system do to the next breaths?',
  choices: [
    'Pressure rises; delivered volume stays similar',
    'Volume falls; the pressure stays about the same',
    'Pressure and volume both fall',
  ],
  correct: 0,
  rationales: [
    'Volume is the controlled variable. More pressure is needed to deliver it into a less compliant system.',
    'That is the pressure-control prediction. Here the machine is still targeting volume.',
    'A stiffer system requires more pressure for a given volume, not less.',
  ],
  task: 'Move compliance to 0.5× and watch several new breaths. Leave the ventilator settings unchanged.',
  goals: [m('complianceScale', 0.5)],
  watch: ['peak', 'volume', 'plateau'],
  explanation:
    'The volume target stays the same, while the pressure cost changes. Check that the pressure limit has not interrupted delivery before interpreting the comparison.',
})
const stiffPressure = round({
  ...stiffVolume,
  title: 'Now control pressure',
  hint: 'This mode holds a different trace from the one before. Find the trace that is held, then follow the one that is free to move.',
  setup: pressureMode,
  introduction:
    'The same passive model is now receiving pressure-controlled breaths. Repeat the change in lung stiffness.',
  prompt: 'With pressure and inspiratory time held constant, what will stiffening this system do?',
  choices: [
    'Pressure rises while volume stays fixed',
    'Pressure stays similar while volume falls',
    'The mode prevents any effect of stiffness',
  ],
  correct: 1,
  rationales: [
    'That describes volume-targeted delivery. This machine is holding inspiratory pressure.',
    'The pressure target is unchanged; the stiffer respiratory system takes a smaller volume.',
    'A mode controls a variable. It does not remove the effects of lung mechanics.',
  ],
  explanation:
    'The same change in the lung now appears mainly in delivered volume. A mode name is a starting point for deciding what to monitor.',
})
const resistance = round({
  title: 'Find the pressure spent moving gas',
  hint: 'A hold stops flow. Ask which part of the airway pressure exists only while gas is moving.',
  introduction:
    'The muscles are quiet. Compare flowing pressure with the pressure during an actual occlusion.',
  look: 'Find the peak on a delivered breath. An inspiratory hold will stop flow at the end of inspiration.',
  prompt: 'After increasing resistance, which pattern should an inspiratory hold help reveal?',
  choices: [
    'A larger peak-to-plateau gap',
    'A smaller peak-to-plateau gap',
    'A larger volume target',
  ],
  correct: 0,
  rationales: [
    'Resistance adds a pressure cost while gas flows. The hold removes that flowing component.',
    'More resistance increases the flowing pressure cost; it does not make the gap smaller.',
    'The volume target is a ventilator setting and has not changed.',
  ],
  task: 'Set resistance to 2×, then perform an inspiratory hold. Watch it occur at a breath boundary.',
  goals: [m('resistanceScale', 2), hold],
  seconds: 12,
  watch: ['peak', 'plateau', 'volume'],
  explanation:
    'Use the actual hold, together with the effort signal. Separating resistance from elastic load requires a valid passive measurement.',
})
const timing = round({
  title: 'Give expiration less time',
  hint: 'Each cycle lasts 60 seconds divided by the rate, and inspiration takes as long as it did before. Work out what is left.',
  setup: [mechanics(1, 4), set('ratePerMin', 12)],
  introduction:
    'This passive model has increased resistance. Leave breath size and flow alone and change only how often a breath starts.',
  look: 'Watch how close expiratory flow gets to zero before the next inspiration.',
  prompt: 'What should increasing the mandatory rate do to this patient’s opportunity to empty?',
  choices: [
    'More time for passive emptying',
    'Unchanged time between breaths',
    'Less time for passive emptying',
  ],
  correct: 2,
  rationales: [
    'A higher rate shortens the cycle when inspiratory delivery is unchanged.',
    'The cycle duration changes when the rate changes.',
    'The next inspiration starts sooner. Check the remaining outward flow rather than assuming the lung emptied.',
  ],
  task: 'Raise rate from 12 to 26/min. Compare the end of expiration across several breaths.',
  goals: [c('ratePerMin', 26)],
  seconds: 20,
  watch: ['rate', 'expiratoryFlow', 'volume'],
  explanation:
    'More breaths per minute can leave less time for gas to leave. In this simplified patient, read the actual expiratory trace; a setting alone does not establish complete emptying.',
})
const earlierCycle = round({
  title: 'Give expiration time back',
  hint: 'Inspiratory flow falls from its peak during a supported breath. Ask whether a higher percentage of that peak is reached earlier or later.',
  caseId: 'MV-10',
  introduction:
    'A different simulated patient: the obstructive patient of case MV-10, breathing on pressure support. On pressure support the patient starts each breath, and the ventilator ends it when inspiratory flow has fallen to a set percentage of its peak: the cycle-off threshold (expiratory trigger sensitivity, ETS).',
  look: 'Compare the end of machine inspiration with the effort trace, then inspect outward flow.',
  prompt:
    'You raise the cycle-off threshold on this supported breath. Which immediate change on the traces should you look for?',
  choices: [
    'A longer machine inspiration',
    'Shorter machine inspiration',
    'A larger delivered volume',
  ],
  correct: 1,
  rationales: [
    'A higher threshold is met sooner on the decaying inspiratory flow, so support ends earlier, not later.',
    'A higher flow-cycle threshold is reached sooner on the decaying inspiratory flow, so support ends earlier — provided flow cycling, and not the time cap, is what ends this breath. Watch the measured inspiratory time and the expiratory limb; the clinical response still needs reassessment.',
    'Ending support sooner gives each breath less time to fill, so the delivered volume tends to fall rather than rise.',
  ],
  task: 'Raise cycling sensitivity (ETS) to 50%. Compare measured inspiratory time and emptying.',
  goals: [c('etsPercent', 50)],
  seconds: 25,
  watch: ['ti', 'expiratoryFlow', 'intrinsicPeep', 'volume'],
  explanation:
    'The setting must cross the point where flow cycling, rather than the time cap, ends this breath. The response belongs to this patient; the cycle-off value used here is set for this comparison, not a universal prescription.',
})
const flow = round({
  title: 'Move the gas faster',
  hint: 'Flow is a rate and tidal volume is an amount. Hold the amount fixed and ask how long it takes at the new rate.',
  introduction: 'You can change inspiratory flow without changing the selected tidal volume.',
  look: 'Follow the flow rectangle and the time taken for the volume trace to reach its peak.',
  prompt: 'If flow rises while the tidal-volume target stays fixed, what should happen?',
  choices: [
    'The same volume arrives sooner',
    'The selected volume must rise',
    'The breath must take longer to fill',
  ],
  correct: 0,
  rationales: [
    'A higher rate of delivery reaches the same total sooner. Pressure during flow can also change.',
    'Flow is a rate; the separate volume target stays fixed.',
    'Faster delivery shortens the time needed for the same volume.',
  ],
  task: 'Increase peak flow to 60 L/min. Watch the flow, volume, and pressure traces together.',
  goals: [c('peakFlowLMin', 60)],
  watch: ['ti', 'volume', 'peak'],
  explanation:
    'Flow describes how fast gas moves. Volume describes how much has moved. Their relationship becomes visible when you change one and watch the other.',
})
const oxygen = round({
  title: 'Separate oxygen from breath delivery',
  hint: 'Ask on which of the three traces — pressure, flow or volume — the oxygen setting appears at all.',
  asks: 'identify',
  introduction: 'Keep this passive patient’s volume, rate, flow, and PEEP unchanged.',
  look: 'Use the three tracings for breath delivery and SpO₂ for the oxygenation response.',
  prompt: 'What does an increase in the oxygen control directly change?',
  choices: [
    'The volume delivered with each machine inflation',
    'The gas mixture entering the circuit',
    'The interval before the next machine inflation',
  ],
  correct: 1,
  rationales: [
    'Volume is a separate setting.',
    'The oxygen fraction changes immediately at the device. The patient response evolves with simulated time.',
    'The respiratory cycle is set by other controls.',
  ],
  task: 'Increase oxygen from 40% to 60%. Let the patient run and compare gas exchange with the breath traces.',
  goals: [c('oxygenPercent', 60)],
  seconds: 30,
  watch: ['spo2', 'volume', 'rate', 'co2'],
  explanation:
    'A change in gas composition does not directly select a different tidal volume or rate. Oxygenation, CO₂ clearance, and mechanical delivery need distinct observations.',
})
const effortHold = round({
  title: 'Test the measurement in an active patient',
  hint: 'Find the dashed effort trace during the hold. Ask which way a patient who is pulling in moves the airway pressure.',
  caseId: 'MV-01',
  introduction:
    'A different simulated patient: the patient of case MV-01, who has stiffer lungs and is making inspiratory efforts. Inspect the effort trace during the hold.',
  look: 'Use the dashed effort signal with pressure and flow. A displayed plateau is not automatically a passive mechanics measurement.',
  prompt: 'What could make a low airway pressure during the hold misleading?',
  choices: [
    'Airway pressure elevated by residual flow',
    'Stable airway pressure with quiet respiratory muscles',
    'Muscle effort lowering airway pressure',
  ],
  correct: 2,
  rationales: [
    'Residual flow can add resistive pressure; it does not explain an effort-related underestimate.',
    'A stable pressure during a passive no-flow hold supports the measurement rather than making it misleading.',
    'Patient effort can lower airway pressure while adding to the distending pressure. Inspect the effort before using the number.',
  ],
  task: 'Perform an inspiratory hold and inspect whether the effort signal is quiet.',
  goals: [hold],
  watch: ['peak', 'plateau', 'effort'],
  explanation:
    'Compare the validity flag and the live effort signal with the earlier passive hold. Do not interpret an effort-contaminated reading as reassuring lung mechanics.',
})

export const ventilationLearningExperiments: readonly LearningExperiment[] = [
  {
    unitId: 'breathing-with-support',
    panelId: 'waveform-anatomy',
    rounds: [
      round({
        title: 'Identify expiration on a captured breath',
        hint: 'Look at which side of the zero line the flow trace is on at interval A, and which way the volume trace is heading.',
        introduction: 'Use the marked interval A on the captured complete breath.',
        look: 'Read all three traces at interval A, marked on the captured breath below. The phase label under the figure can be hidden while you decide and brought back at any time.',
        prompt: 'Which phase is shown at interval A?',
        choices: ['Expiration', 'Inspiration', 'A no-flow occlusion'],
        correct: 0,
        rationales: [
          'Interval A lies after inspiratory delivery: flow there is negative and breath-relative volume is coming down.',
          'In this passive example, inspiration has inward flow and accumulating volume.',
          'A no-flow occlusion would show zero flow and nearly constant volume; pausing the display does not create one.',
        ],
        task: 'Try Pause and Run on the live display. You can either pause during outward flow after a full breath, or inspect expiration on the captured complete breath and choose Use this captured interval. The captured alternative needs no timed click.',
        goals: [{ type: 'pause-expiration' }],
        seconds: 0,
        watch: [],
        explanation:
          'Identifying the phase is a separate answer from operating a playback control. At interval A gas is leaving and the breath-relative volume trace is coming down, which is what identifies expiration in this passive example.',
      }),
      round({
        title: 'Read another interval of a complete breath',
        hint: 'At interval B, check the sign of flow and whether the volume trace is rising or falling.',
        setup: [set('ratePerMin', 12)],
        introduction:
          'A second complete breath is captured on a longer respiratory cycle, with the mandatory rate set to 12/min for this part. Inspect interval B.',
        look: 'Read all three traces at interval B, marked on the captured breath below; do not change a ventilator setting.',
        prompt: 'Which phase is shown at interval B?',
        choices: ['A no-flow occlusion', 'Expiration', 'Inspiration'],
        correct: 2,
        rationales: [
          'Flow is not zero at interval B.',
          'Expiration in this passive breath has negative flow with falling volume.',
          'Positive flow accompanies accumulating volume during inspiration.',
        ],
        task: 'Inspect inspiration on this captured complete breath, then choose Use this captured interval. The exploration cursor moves with the arrow keys and interval B stays where it is. This changes only the view.',
        goals: [{ type: 'inspect-inspiration' }],
        seconds: 0,
        watch: [],
        explanation:
          'The cycle duration changed, but inspiration still shows gas entering and breath-relative volume rising. Timing the Pause button is not the identification skill.',
      }),
    ],
  },
  {
    unitId: 'waveform-anatomy',
    panelId: 'waveform-anatomy',
    rounds: [
      flow,
      {
        ...flow,
        title: 'Retrieve flow and volume on a slower inspiration',
        hint: 'The same amount is delivered at a slower rate: compare the slope of the volume trace and the length of inspiration.',
        setup: [set('peakFlowLMin', 60)],
        introduction:
          'Retrieve the relationship on a new baseline with inspiratory flow initially 60 L/min; selected tidal volume is unchanged.',
        prompt:
          'When flow decreases at the same selected tidal volume, which trace comparison should you expect?',
        choices: [
          'A steeper volume rise over less time',
          'A slower volume rise over more time',
          'The same inspiratory duration with a larger selected volume',
        ],
        correct: 1,
        rationales: [
          'A steeper rise represents faster inward flow.',
          'At lower flow the same volume accumulates over a longer inspiration.',
          'Flow and selected tidal volume are separate settings.',
        ],
        task: 'Reduce inspiratory flow to 30 L/min. Keep selected tidal volume fixed and compare the captured traces.',
        goals: [c('peakFlowLMin', 30)],
      },
    ],
  },
  {
    unitId: 'controls-and-goals',
    panelId: 'modes-and-breath-delivery',
    rounds: [
      round({
        title: 'A setting and its consequences',
        hint: 'One value is what you asked for and one is what came back. Find the one on the monitoring side of the screen.',
        asks: 'identify',
        introduction:
          'Start from the five main settings: mode, breath size, rate, PEEP and oxygen. Here the breath size is a tidal volume.',
        look: 'Distinguish the selected volume from the measured exhaled volume and the pressure needed to deliver it.',
        prompt:
          'After increasing selected tidal volume, which separate value tells you the delivered result?',
        choices: [
          'The tidal volume selected on the console',
          'The measured exhaled tidal volume',
          'The oxygen fraction selected on the console',
        ],
        correct: 1,
        rationales: [
          'The selected value is the request, not evidence of delivery.',
          'Exhaled tidal volume is a separate reported result. Compare it with the requested volume.',
          'Oxygen fraction describes the gas mixture rather than breath size.',
        ],
        task: 'Increase the volume target to 500 mL, then inspect the measured result.',
        goals: [c('vtMl', 500)],
        watch: ['volume', 'peak'],
        explanation:
          'Compare selected tidal volume with measured exhaled tidal volume. Pressure is also worth checking; the mechanics lesson develops that pressure cost.',
      }),
      oxygen,
    ],
  },
  {
    unitId: 'mechanics-load-and-pressure',
    panelId: 'mechanics-load-and-pressure',
    rounds: [
      resistance,
      {
        ...stiffVolume,
        title: 'Separate stiffness from resistance',
        task: 'Set compliance to 0.5×, then perform an inspiratory hold.',
        goals: [m('complianceScale', 0.5), hold],
        explanation:
          'Compare this pressure pattern with the resistance experiment. The elastic component persists when flow stops.',
      },
    ],
  },
  {
    unitId: 'modes-and-breath-delivery',
    panelId: 'modes-and-breath-delivery',
    rounds: [
      {
        ...stiffVolume,
        introduction:
          'Retrieve the stiffness experiment from mechanics, now focusing on what conventional VC holds constant. Selected volume and flow stay fixed.',
        relation: {
          kind: 'revisit',
          unitId: 'mechanics-load-and-pressure',
          part: 2,
          note: 'The same stiffness experiment and the same question, read here for what volume control holds constant.',
        },
      },
      {
        ...stiffPressure,
        introduction:
          'The mode has explicitly switched from conventional VC to conventional PC. The same passive baseline patient now receives fixed pressure above PEEP and fixed inspiratory time. Repeat the stiffness change.',
      },
    ],
  },
  {
    unitId: 'lung-protection',
    panelId: 'mechanics-load-and-pressure',
    rounds: [
      round({
        title: 'Reduce the size of the breath',
        hint: 'Elastic pressure is the delivered volume divided by the compliance, and the compliance has not changed here.',
        setup: [set('vtMl', 600)],
        introduction:
          'This passive adult, set for this simulation, has a predicted body weight of 70 kg. Compare breath size and pressure together.',
        look: 'Read delivered volume relative to predicted body weight, then measure pressure during a hold.',
        prompt:
          'What should reducing volume at the same compliance do to the elastic pressure requirement?',
        choices: [
          'A larger pressure requirement',
          'An unchanged pressure requirement',
          'A smaller pressure requirement',
        ],
        correct: 2,
        rationales: [
          'A smaller breath does not cost more elastic pressure: at the same compliance, less volume stretches the system less.',
          'Elastic pressure depends on the delivered volume as well as compliance.',
          'A smaller passive volume requires less elastic pressure. Gas exchange still needs separate follow-up.',
        ],
        task: 'Reduce volume to 420 mL, then perform an inspiratory hold. These values are set for this comparison.',
        goals: [c('vtMl', 420), hold],
        watch: ['volume', 'plateau', 'co2'],
        explanation:
          'Use predicted body weight for volume context and a valid plateau for pressure context. The guideline reference is available in the physiology panel; this exercise is not a patient-specific prescription.',
      }),
      effortHold,
    ],
  },
  {
    unitId: 'expiration-and-air-trapping',
    panelId: 'triggering-and-cycling',
    rounds: [
      timing,
      {
        ...earlierCycle,
        relation: {
          kind: 'preview',
          unitId: 'triggering-and-cycling',
          note: 'Pressure support and the cycle-off are taught in full there. Here the cycle-off is used for one thing only: giving expiration more time.',
        },
      },
    ],
  },
  {
    unitId: 'triggering-and-cycling',
    panelId: 'triggering-and-cycling',
    rounds: [
      round({
        title: 'Help an effort start a breath',
        hint: 'Count the efforts on the dashed trace and count the machine breaths. The change is aimed at the efforts with no breath after them.',
        caseId: 'MV-07',
        introduction:
          'A different simulated patient from the earlier sections, the patient of case MV-07, who makes more efforts than the machine delivers breaths.',
        look: 'Look for effort without a following machine inflation.',
        prompt:
          'If the trigger threshold is easier to cross, what response would support the intended mechanism?',
        choices: [
          'More efforts followed by a delivered breath',
          'Fewer efforts followed by a delivered breath',
          'Larger breaths with each captured effort',
        ],
        correct: 0,
        rationales: [
          'Look for improved capture, then check that false breaths have not appeared.',
          'A harder trigger can miss more efforts. That is the opposite of the intended change.',
          'The trigger decides whether a breath starts, not how large it is; breath size is set elsewhere.',
        ],
        task: 'Set the flow-trigger threshold to 1.5 L/min. Compare efforts with delivered breaths.',
        goals: [c('triggerThreshold', 1.5)],
        seconds: 20,
        watch: ['missed', 'rate', 'effort'],
        explanation:
          'The useful result is capture without false triggering. The number is set for this comparison; assess the pattern after every adjustment.',
      }),
      round({
        title: 'Help support last through inspiration',
        hint: 'The breath ends when inspiratory flow has decayed to the set percentage of its peak. Ask whether a lower percentage is reached sooner or later.',
        caseId: 'MV-09',
        introduction:
          'A different simulated patient again, the patient of case MV-09, who starts the breath, but machine inspiration ends early.',
        look: 'Watch the effort that persists when the machine cycles.',
        prompt:
          'What should lowering the flow-cycling threshold do when that criterion ends the breath?',
        choices: [
          'A shorter machine inspiration',
          'A longer machine inspiration',
          'Breaths that start with no effort',
        ],
        correct: 1,
        rationales: [
          'That is what raising the threshold does: a higher fraction of peak flow is reached earlier on the decaying flow. Lowering it does the reverse.',
          'A lower fraction is reached later, extending support until another limit intervenes.',
          'A breath that starts without an effort is a trigger matter. The cycling control decides only how the push ends.',
        ],
        task: 'Lower ETS to 15%, then compare machine inspiratory time and delivered volume.',
        goals: [c('etsPercent', 15)],
        seconds: 20,
        watch: ['ti', 'volume', 'dyspnea'],
        explanation:
          'Triggering starts support; cycling ends it. Extending support can also change volume, so inspect both timing and delivery.',
      }),
    ],
  },
  {
    unitId: 'oxygenation-response',
    panelId: 'oxygenation-response',
    rounds: [
      round({
        title: 'Compare oxygenation with pressure and circulation',
        hint: 'Three readings are named. Decide which one, if it moved the wrong way, would be a cost and not a benefit.',
        asks: 'interpret',
        caseId: 'MV-01',
        introduction:
          'The worked comparison keeps case, time, volume, flow and FiO₂ matched. Your separate patient below can also be used for an optional PEEP experiment.',
        look: 'Keep SpO₂, airway pressure, and MAP together.',
        prompt:
          'Which response would make an oxygenation improvement incomplete evidence of benefit?',
        choices: [
          'SpO₂ rises with unchanged exhaled volume',
          'SpO₂ rises with stable arterial pressure',
          'SpO₂ rises while MAP falls',
        ],
        correct: 2,
        rationales: [
          'Stable delivery adds context but does not identify a circulatory cost.',
          'Stable circulation is reassuring context; worsening circulation is the concern.',
          'An oxygenation gain can coexist with a circulatory cost. Check the actual response rather than assuming benefit.',
        ],
        task: 'On your separate patient, change PEEP from 5 to 10 cmH₂O and watch 45 simulated seconds. This is an authored example, not a clinical setting recommendation.',
        goals: [c('peepCmH2O', 10)],
        seconds: 45,
        watch: ['spo2', 'map', 'peak', 'volume'],
        explanation:
          'Compare your response with the matched worked example. Waiting alone changes oxygenation in this case. The model assigns a different compliance at this PEEP; the effort-affected plateau estimate does not establish measured static compliance. Review oxygenation, delivery, pressure and MAP together.',
      }),
      oxygen,
    ],
  },
  {
    unitId: 'ventilation-and-co2',
    panelId: 'ventilation-and-co2',
    rounds: [
      round({
        title: 'Follow the two response clocks',
        hint: 'Carbon dioxide follows the ventilation that reaches exchanging lung, relative to production. Production is unchanged here.',
        introduction:
          'Keep volume and lung mechanics unchanged. Watch breath timing immediately and blood gas over simulated time.',
        look: 'Read total rate and minute ventilation alongside CO₂.',
        prompt:
          'With preserved delivery and emptying, what direction should more effective ventilation drive CO₂ over time?',
        choices: ['Toward a lower value', 'Toward a higher value', 'No relation to ventilation'],
        correct: 0,
        rationales: [
          'CO₂ clearance increases relative to unchanged production. The gas response follows the mechanical change.',
          'That would fit reduced effective ventilation relative to production.',
          'Effective alveolar ventilation is central to CO₂ clearance.',
        ],
        task: 'Increase rate to 20/min and follow 90 simulated seconds. Inspect expiration as well as CO₂.',
        goals: [c('ratePerMin', 20)],
        seconds: 90,
        watch: ['rate', 'minute', 'co2', 'expiratoryFlow'],
        explanation:
          'A changed control and a changed blood gas have different clocks. The gas result is meaningful only with verified delivery, emptying, and clinical context.',
      }),
      round({
        ...stiffPressure,
        title: 'Same rate, a different delivered breath',
        hint: 'Minute ventilation is the rate times the delivered volume. The rate is unchanged; find what pressure control leaves free to move.',
        introduction:
          'Return to the passive patient on pressure control. Keep the rate unchanged and follow gas exchange when the lung becomes stiffer.',
        prompt:
          'At an unchanged rate, what should happen if pressure control now delivers smaller breaths?',
        choices: [
          'CO₂ stays similar because the selected rate is unchanged',
          'CO₂ falls because the pressure target is held constant',
          'CO₂ rises as effective ventilation falls',
        ],
        correct: 2,
        rationales: [
          'The rate alone does not establish effective ventilation; delivered breath size also matters.',
          'A constant pressure target does not guarantee volume delivery or CO₂ clearance.',
          'With other model conditions unchanged, smaller delivered breaths reduce ventilation and CO₂ rises over time.',
        ],
        task: 'Reduce compliance to 0.5×. Keep the settings unchanged and follow 90 simulated seconds.',
        seconds: 90,
        watch: ['volume', 'minute', 'co2', 'rate'],
        explanation:
          'The same set rate can accompany very different effective ventilation. Follow delivered volume and minute ventilation, then reassess the slower gas response.',
      }),
    ],
  },
  {
    unitId: 'waveform-reading-sequence',
    panelId: 'waveform-reading-sequence',
    rounds: [
      round({
        title: 'Follow extra breaths back to the circuit',
        hint: 'If the extra breaths were started by the circuit and not by the patient, ask what becomes of them once the circuit is corrected.',
        caseId: 'MV-08',
        introduction:
          'This is the patient of case MV-08. Compare effort, machine breaths, and the circuit.',
        look: 'Read timing across all three traces before attributing the rate to patient drive.',
        prompt:
          'If a circuit artifact is triggering breaths, what finding would support that explanation after correction?',
        choices: [
          'Larger volumes in the delivered breaths',
          'Fewer extra machine breaths',
          'Higher pressure during machine breaths',
        ],
        correct: 1,
        rationales: [
          'Volume selection is a separate action.',
          'Look for fewer unsupported machine triggers and a rate closer to actual patient effort.',
          'Higher pressure does not by itself identify the triggering source.',
        ],
        task: 'Inspect the circuit, then clear the observed condensate. Compare the rate.',
        goals: [action('inspect-circuit'), action('drain-condensate')],
        seconds: 25,
        watch: ['rate', 'effort', 'volume'],
        explanation:
          'A waveform pattern raises a mechanism; patient and circuit findings confirm or refute it. The modeled correction takes effect with elapsed simulation time.',
      }),
      round({
        ...flow,
        title: 'Distinguish an inspiratory delivery problem',
        caseId: 'MV-02',
        relation: {
          kind: 'revisit',
          unitId: 'waveform-anatomy',
          part: 1,
          note: 'The same flow question, asked here of a patient who is pulling hard during inspiration.',
        },
        introduction:
          'A different simulated patient, the patient of case MV-02, who has strong effort during machine inspiration. Read the sequence again.',
        task: 'Increase peak flow to 60 L/min while preserving the volume target. Watch the inspiratory pressure shape.',
        explanation:
          'The same flow control now sits in a patient with high demand. Read effort and pressure deformation as well as breath size.',
      }),
    ],
  },
  {
    unitId: 'dyssynchrony-mechanisms',
    panelId: 'dyssynchrony-mechanisms',
    rounds: [
      round({
        title: 'Test the speed of pressurization',
        hint: 'Read the first part of each push: the pressure contour and the patient’s comfort together, not either one alone.',
        caseId: 'MV-11',
        introduction:
          'Pressure support starts, but the patient is uncomfortable with slow pressurization.',
        look: 'Look at the early inspiratory pressure shape and the effort/comfort response.',
        prompt: 'What would support that the original rise time was too slow?',
        choices: [
          'Faster rise with increasing pressure overshoot',
          'Faster rise with larger uncomfortable breaths',
          'Faster rise with less discomfort',
        ],
        correct: 2,
        rationales: [
          'Overshoot raises concern that pressurization is too aggressive; more support is not automatically better.',
          'Larger breaths alone do not establish a better match with patient demand.',
          'Judge the early pressure shape and comfort together, and check for overshoot.',
        ],
        task: 'Shorten P-ramp to 100 ms. Compare the early pressure contour and dyspnea.',
        goals: [c('pRampMs', 100)],
        seconds: 20,
        watch: ['dyspnea', 'peak', 'volume'],
        explanation:
          'A more comfortable response still needs a check for excessive pressure and volume. “Faster” is not an unlimited goal.',
      }),
      {
        ...earlierCycle,
        relation: {
          kind: 'revisit',
          unitId: 'expiration-and-air-trapping',
          part: 2,
          note: 'The same patient, setup and question, read here for where on the breath the mismatch lives.',
        },
      },
    ],
  },
  {
    unitId: 'safety-reassessment-and-human-factors',
    panelId: 'safety-reassessment-and-human-factors',
    rounds: [
      round({
        title: 'Use the patient’s account',
        hint: 'Two of the choices describe what was done or recorded. One finds out something about the patient.',
        asks: 'reflect',
        caseId: 'MV-15',
        introduction:
          'The distressed patient of case MV-15 can communicate. Start with their experience of breathing.',
        look: 'Keep discomfort, effort, and delivered support in view.',
        prompt:
          'What can make the next action better targeted before you change ventilator support?',
        choices: [
          'Ask what is making breathing difficult',
          'Use silence of the alarm to judge recovery',
          'Use a written plan to judge recovery',
        ],
        correct: 0,
        rationales: [
          'Communication can reveal a reversible contributor. It does not by itself prove physiologic recovery.',
          'Acknowledgment changes alarm handling, not its cause.',
          'A written plan needs an actual intervention and reassessment.',
        ],
        task: 'Assess the patient and establish communication. Observe the modeled comfort response.',
        goals: [action('assess-patient'), action('communication-board')],
        seconds: 30,
        watch: ['anxiety', 'dyspnea', 'rate'],
        explanation:
          'Connect the intervention to what actually changes. Do not infer a physiologic improvement from task completion.',
      }),
      round({
        title: 'Reassess a reversible contributor',
        hint: 'An intervention being recorded and a patient improving are different observations. Ask which one tests the other.',
        asks: 'interpret',
        caseId: 'MV-15',
        introduction: 'Now address the documented pain in the same patient.',
        look: 'Observe pain, dyspnea, and respiratory effort over time.',
        prompt: 'Which evidence best tests whether the modeled comfort intervention helped?',
        choices: [
          'An intervention appearing in the action record',
          'Patient findings improving over time',
          'The alarm being acknowledged on the device',
        ],
        correct: 1,
        rationales: [
          'The action record proves that it was selected, not that it helped.',
          'Reassessment connects an intervention with its delayed patient response.',
          'Alarm sound is not a substitute for patient findings.',
        ],
        task: 'Select the modeled pain intervention. Allow its 120-second delay, then follow the response for 150 simulated seconds. Use 5× time if helpful. No drug or dose is prescribed here.',
        goals: [action('treat-pain')],
        seconds: 150,
        watch: ['pain', 'dyspnea', 'effort', 'rate'],
        explanation:
          'This is a simplified comfort response. In clinical care, treatment selection and dosing require current local guidance and supervision.',
      }),
    ],
  },
  {
    unitId: 'high-peak-pressure-integration',
    panelId: 'high-peak-pressure-integration',
    rounds: [
      round({
        ...resistance,
        title: 'One high-pressure presentation',
        hint: 'During the hold flow is zero. Ask what happens to the part of the pressure that was there only because gas was moving.',
        setup: [mechanics(1, 3)],
        introduction:
          'A passive patient has a high peak pressure. The cause is not supplied. Measure before deciding.',
        prompt:
          'What observation during an inspiratory hold would support a large flowing-pressure component?',
        choices: [
          'Pressure that remains close to its flowing peak',
          'A wider swing on the volume trace',
          'Pressure falls substantially when flow stops',
        ],
        correct: 2,
        rationales: [
          'A pressure that persists during no flow indicates the elastic and baseline contribution.',
          'The hold does not change the delivered volume; the split is read on the pressure trace.',
          'A substantial fall after flow stops supports a large resistive contribution, if the patient is passive.',
        ],
        task: 'Perform an inspiratory hold. Use the measured split and the quiet effort signal to explain the pattern.',
        goals: [hold],
      }),
      round({
        ...resistance,
        title: 'Same presentation, a different patient',
        hint: 'Ask which part of the pressure remains once flow has stopped, and what that part depends on.',
        setup: [mechanics(0.4, 1)],
        introduction:
          'The next passive patient also has a high peak pressure. Start the measurement again.',
        prompt: 'What finding would support a larger elastic component in this patient?',
        choices: [
          'Higher pressure persisting after flow stops',
          'A large fall from the peak as soon as flow stops',
          'A wider swing on the volume trace',
        ],
        correct: 0,
        rationales: [
          'Pressure that persists during a valid no-flow hold reflects elastic and baseline load.',
          'A large fall once flow stops is the flowing, resistive pattern — the previous patient’s, not this one’s.',
          'The delivered volume is set and does not change with a hold; the split is read on the pressure trace.',
        ],
        task: 'Perform the hold and compare the measured pattern with the previous patient.',
        goals: [hold],
        explanation:
          'Similar peak pressures can come from different mechanisms. Bring the measured split, baseline, expiration, effort, and patient together before choosing the clinical action.',
      }),
    ],
  },
]
export const ventilationExperimentByUnit = new Map(
  ventilationLearningExperiments.map((experiment) => [experiment.unitId, experiment]),
)
