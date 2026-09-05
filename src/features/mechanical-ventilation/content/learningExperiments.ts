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
  introduction:
    'This passive patient is receiving volume-controlled breaths. You can change the lung while the ventilator keeps its settings.',
  look: 'Compare the top of the pressure trace with the height of the volume trace.',
  prompt:
    'At the same volume and flow settings, what will a stiffer respiratory system do to the next breaths?',
  choices: [
    'Pressure rises; delivered volume stays similar',
    'Volume falls; pressure stays similar',
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
  caseId: 'MV-10',
  introduction:
    'Move from a passive model to the original obstructive patient on pressure support.',
  look: 'Compare the end of machine inspiration with the effort trace, then inspect outward flow.',
  prompt:
    'If a higher cycling threshold ends machine inspiration earlier, which immediate change should you look for?',
  choices: ['Longer machine inspiration', 'Shorter machine inspiration', 'A higher oxygen setting'],
  correct: 1,
  rationales: [
    'An earlier flow-cycle criterion ends support sooner, provided it becomes the limiting criterion.',
    'Watch measured inspiratory time and the expiratory limb. The clinical response still needs reassessment.',
    'Oxygen concentration is a separate control.',
  ],
  task: 'Raise cycling sensitivity (ETS) to 50%. Compare measured inspiratory time and emptying.',
  goals: [c('etsPercent', 50)],
  seconds: 25,
  watch: ['ti', 'expiratoryFlow', 'intrinsicPeep', 'volume'],
  explanation:
    'The setting must cross the point where flow cycling, rather than the time cap, ends this breath. The response belongs to this authored patient; the cycle-off value used here is an authored comparison setting, not a universal prescription.',
})
const flow = round({
  title: 'Move the gas faster',
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
  caseId: 'MV-01',
  introduction:
    'This original patient is making an inspiratory effort. Inspect the effort trace during the hold.',
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
        title: 'Catch one whole breath',
        introduction:
          'The ventilator is already running. Start with gas moving into this passive patient, then watch it leave.',
        look: 'Find inward flow above zero, outward flow below zero, and the volume rising then falling.',
        prompt: 'When you pause during expiration, which combination identifies gas leaving?',
        choices: [
          'Flow below zero with falling volume',
          'Flow above zero with rising volume',
          'A flat volume trace while inward flow continues',
        ],
        correct: 0,
        rationales: [
          'Outward flow is negative on this display; volume falls as gas leaves.',
          'That combination describes inspiration.',
          'Continuing inward flow adds volume, so those two signals would not fit.',
        ],
        task: 'Let a full breath pass, then pause during expiration. Use “Advance one breath” if you want another look.',
        goals: [{ type: 'pause-expiration' }],
        seconds: 0,
        watch: ['volume', 'rate', 'peak'],
        explanation:
          'The three traces are views of the same moving breath. The machine supplies inspiration; this passive system empties through recoil.',
      }),
      {
        ...flow,
        title: 'Change the pace of inspiration',
        choices: [flow.choices[1], flow.choices[2], flow.choices[0]],
        rationales: [flow.rationales[1], flow.rationales[2], flow.rationales[0]],
        correct: 2,
      },
    ],
  },
  { unitId: 'waveform-anatomy', panelId: 'waveform-anatomy', rounds: [flow, stiffVolume] },
  {
    unitId: 'controls-and-goals',
    panelId: 'modes-and-breath-delivery',
    rounds: [
      round({
        title: 'A setting and its consequences',
        introduction: 'Start from a small set of controls: volume, rate, flow, oxygen, and PEEP.',
        look: 'Distinguish the selected volume from the measured exhaled volume and the pressure needed to deliver it.',
        prompt:
          'If the volume target rises in this passive model, what is the expected pressure cost?',
        choices: [
          'Less elastic pressure',
          'More elastic pressure',
          'No change in elastic pressure',
        ],
        correct: 1,
        rationales: [
          'At the same compliance, a larger volume requires more elastic pressure.',
          'More volume stretches the same respiratory system further. Check delivery and pressure together.',
          'Compliance and baseline are unchanged; changing volume changes elastic load.',
        ],
        task: 'Increase the volume target to 500 mL, then inspect the measured result.',
        goals: [c('vtMl', 500)],
        watch: ['volume', 'peak', 'plateau'],
        explanation:
          'A setting is an input, not a guarantee of a safe result. The larger delivered breath has a pressure cost in this model.',
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
    rounds: [stiffVolume, stiffPressure],
  },
  {
    unitId: 'lung-protection',
    panelId: 'mechanics-load-and-pressure',
    rounds: [
      round({
        title: 'Reduce the size of the breath',
        setup: [set('vtMl', 600)],
        introduction:
          'This authored passive adult has a predicted body weight of 70 kg. Compare breath size and pressure together.',
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
          'A smaller passive inflation requires less elastic pressure under these conditions.',
          'Elastic pressure depends on the delivered volume as well as compliance.',
          'A smaller passive volume requires less elastic pressure. Gas exchange still needs separate follow-up.',
        ],
        task: 'Reduce volume to 420 mL, then perform an inspiratory hold. These values are authored for the comparison.',
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
    rounds: [timing, earlierCycle],
  },
  {
    unitId: 'triggering-and-cycling',
    panelId: 'triggering-and-cycling',
    rounds: [
      round({
        title: 'Help an effort start a breath',
        caseId: 'MV-07',
        introduction: 'This original patient makes more efforts than the machine delivers breaths.',
        look: 'Look for effort without a following machine inflation.',
        prompt:
          'If the trigger threshold is easier to cross, what response would support the intended mechanism?',
        choices: [
          'More efforts followed by a delivered breath',
          'Fewer efforts followed by a delivered breath',
          'A higher oxygen fraction',
        ],
        correct: 0,
        rationales: [
          'Look for improved capture, then check that false breaths have not appeared.',
          'A harder trigger can miss more efforts. That is the opposite of the intended change.',
          'Triggering does not set gas composition.',
        ],
        task: 'Set the flow-trigger threshold to 1.5 L/min. Compare efforts with delivered breaths.',
        goals: [c('triggerThreshold', 1.5)],
        seconds: 20,
        watch: ['missed', 'rate', 'effort'],
        explanation:
          'The useful result is capture without false triggering. The number is an authored experiment setting; assess the pattern after every adjustment.',
      }),
      round({
        title: 'Help support last through inspiration',
        caseId: 'MV-09',
        introduction: 'A different patient starts the breath, but machine inspiration ends early.',
        look: 'Watch the effort that persists when the machine cycles.',
        prompt:
          'What should lowering the flow-cycling threshold do when that criterion ends the breath?',
        choices: [
          'A shorter machine inspiration',
          'A longer machine inspiration',
          'A higher mandatory breath rate',
        ],
        correct: 1,
        rationales: [
          'A higher cycling threshold is reached earlier during decaying inspiratory flow.',
          'A lower fraction is reached later, extending support until another limit intervenes.',
          'The cycling control sets the end of inspiration, not the mandatory rate.',
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
        title: 'Test a pressure change in the original patient',
        caseId: 'MV-01',
        introduction:
          'The original recruitment case is hypoxemic. Make one bounded change and watch more than the saturation.',
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
        task: 'Change PEEP from 5 to 8 cmH₂O and watch 45 simulated seconds. Use 5× time if helpful.',
        goals: [c('peepCmH2O', 8)],
        seconds: 45,
        watch: ['spo2', 'map', 'peak', 'volume'],
        explanation:
          'This authored patient has a recruitment window. Compare the actual benefit and pressure/circulatory cost, then carry that tradeoff to the next patient.',
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
        caseId: 'MV-08',
        introduction:
          'Work through the original case: compare effort, machine breaths, and the circuit.',
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
        task: 'Inspect the circuit, then clear the observed condensate in this authored branch. Compare the rate.',
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
        introduction:
          'This original patient has strong effort during machine inspiration. Read the sequence again.',
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
      earlierCycle,
    ],
  },
  {
    unitId: 'safety-reassessment-and-human-factors',
    panelId: 'safety-reassessment-and-human-factors',
    rounds: [
      round({
        title: 'Use the patient’s account',
        caseId: 'MV-15',
        introduction:
          'The original distressed patient can communicate. Start with their experience of breathing.',
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
        caseId: 'MV-15',
        introduction: 'Now address the documented pain in the same authored case.',
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
          'This is a bounded comfort response. In clinical care, treatment selection and dosing require current local guidance and supervision.',
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
        setup: [mechanics(1, 3)],
        introduction:
          'A passive patient has a high peak pressure. The cause is not supplied. Measure before deciding.',
        prompt:
          'What observation during an inspiratory hold would support a large flowing-pressure component?',
        choices: [
          'Pressure remains near its flowing peak',
          'The selected volume increases',
          'Pressure falls substantially when flow stops',
        ],
        correct: 2,
        rationales: [
          'A pressure that persists during no flow indicates the elastic and baseline contribution.',
          'The hold does not select a new volume.',
          'A substantial fall after flow stops supports a large resistive contribution, if the patient is passive.',
        ],
        task: 'Perform an inspiratory hold. Use the measured split and the quiet effort signal to explain the pattern.',
        goals: [hold],
      }),
      round({
        ...resistance,
        title: 'Same presentation, a different patient',
        setup: [mechanics(0.4, 1)],
        introduction:
          'The next passive patient also has a high peak pressure. Start the measurement again.',
        prompt: 'What finding would support a larger elastic component in this patient?',
        choices: [
          'Higher pressure persisting after flow stops',
          'A larger inspiratory flow setting alone',
          'A louder alarm alone',
        ],
        correct: 0,
        rationales: [
          'Pressure that persists during a valid no-flow hold reflects elastic and baseline load.',
          'Flow adds resistive pressure and does not establish elastic load.',
          'Alarm behavior cannot localize the mechanism.',
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
