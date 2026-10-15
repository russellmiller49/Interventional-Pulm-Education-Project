import { VENTILATION_NUMBERS } from './teachingNumbers'
import type { VentilationAction, VentilatorControlKey } from '../engine/types'

const N = VENTILATION_NUMBERS.value

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
    'This passive patient is on volume control. You will make the respiratory system stiffer; the ventilator settings stay as they are.',
  look: 'Compare peak pressure with the height of the volume trace.',
  prompt:
    'At the same volume and flow settings, what will a stiffer respiratory system do to the next breaths?',
  choices: [
    'Pressure rises; delivered volume stays similar',
    'Volume falls; the pressure stays about the same',
    'Pressure and volume both fall',
  ],
  correct: 0,
  rationales: [
    'In volume control, tidal volume is the control variable. A less compliant system needs more pressure to take the same volume.',
    'That would be pressure control. Here the ventilator is still delivering a set volume.',
    'A stiffer system requires more pressure for a given volume, not less.',
  ],
  task: 'Set the teaching patient’s compliance to 0.5× and watch several breaths. Leave the ventilator settings alone.',
  goals: [m('complianceScale', 0.5)],
  watch: ['peak', 'volume', 'plateau'],
  explanation:
    'The tidal volume stays the same and the pressure needed to deliver it rises. Before you read anything into that, check that the high-pressure limit did not cut the breath short.',
})
const stiffPressure = round({
  ...stiffVolume,
  title: 'Now control pressure',
  hint: 'This mode holds a different trace from the one before. Find the trace that is held, then follow the one that is free to move.',
  setup: pressureMode,
  introduction:
    'The same passive patient is now on pressure control. Make the same stiffness change.',
  prompt:
    'With inspiratory pressure and inspiratory time held constant, what will a stiffer respiratory system do?',
  choices: [
    'Pressure rises while volume stays fixed',
    'Pressure stays similar while volume falls',
    'The mode prevents any effect of stiffness',
  ],
  correct: 1,
  rationales: [
    'That is volume control. In pressure control the ventilator holds the inspiratory pressure.',
    'The set pressure is unchanged, so the stiffer respiratory system takes a smaller tidal volume.',
    'A mode chooses which variable is controlled. It does not cancel the effect of the lung’s mechanics.',
  ],
  explanation:
    'In pressure control the same stiffening shows up mainly as a smaller delivered tidal volume. The mode tells you which reading to watch.',
})
const resistance = round({
  title: 'Find the pressure spent moving gas',
  hint: 'A hold stops flow. Ask which part of the airway pressure exists only while gas is moving.',
  introduction:
    'This patient is passive: no respiratory effort. Compare airway pressure while gas is flowing with the pressure during an inspiratory hold.',
  look: 'Find peak pressure on a delivered breath. An inspiratory hold stops flow at end-inspiration.',
  prompt: 'After airway resistance rises, what should an inspiratory hold show?',
  choices: [
    'A larger peak-to-plateau gap',
    'A smaller peak-to-plateau gap',
    'A larger volume target',
  ],
  correct: 0,
  rationales: [
    'Resistance adds pressure only while gas is flowing. The hold stops flow, so that part falls away and the plateau is left.',
    'More resistance raises the pressure needed to move gas; it does not make the gap smaller.',
    'The set tidal volume is a ventilator setting, and it has not changed.',
  ],
  task: 'Set the teaching patient’s airway resistance to 2×, then perform an inspiratory hold. The hold happens at the end of the next inspiration.',
  goals: [m('resistanceScale', 2), hold],
  seconds: 12,
  watch: ['peak', 'plateau', 'volume'],
  explanation:
    'Peak minus plateau is the pressure spent on airway resistance, and it widens when resistance rises. Splitting resistive from elastic pressure needs a valid hold in a passive patient: check the effort trace before you trust the plateau.',
})
const timing = round({
  title: 'A higher rate in a patient who exhales slowly',
  hint: 'Each cycle lasts 60 seconds divided by the rate, and inspiration takes as long as it did before. Work out what is left.',
  setup: [mechanics(1, 4), set('ratePerMin', 12)],
  introduction:
    'This passive patient has high airway resistance and exhales slowly. Leave the tidal volume and inspiratory flow alone and change only the set rate.',
  look: 'Watch how close expiratory flow comes to zero before the next inspiration starts.',
  prompt: 'If you raise the set rate, what happens to the time this patient has to empty?',
  choices: [
    'More time for passive emptying',
    'Unchanged time between breaths',
    'Less time for passive emptying',
  ],
  correct: 2,
  rationales: [
    'A higher rate shortens each breath cycle. With inspiration unchanged, the time left for expiration gets shorter, not longer.',
    'Each cycle lasts 60 seconds divided by the rate, so the time between breaths changes whenever the rate does.',
    'The next inspiration starts sooner, so expiration is cut short. Check whether expiratory flow has reached zero rather than assuming the lung emptied.',
  ],
  task: 'Raise the set rate from 12 to 26/min, then compare the end of expiration over several breaths.',
  goals: [c('ratePerMin', 26)],
  seconds: 20,
  watch: ['rate', 'expiratoryFlow', 'volume'],
  explanation:
    'More breaths per minute can leave less time to exhale. Read the expiratory flow trace itself: whether flow reaches zero before the next breath, not the rate setting, tells you whether the lung emptied.',
})
const earlierCycle = round({
  title: 'Give expiration time back',
  hint: 'Inspiratory flow falls from its peak during a supported breath. Ask whether a higher percentage of that peak is reached earlier or later.',
  caseId: 'MV-10',
  introduction:
    'This patient has COPD and is on pressure support. The patient triggers each breath, and the ventilator cycles to expiration when inspiratory flow has decayed to a set percentage of its peak: the cycle-off threshold (expiratory trigger sensitivity, ETS).',
  look: 'Compare where the machine breath ends with the patient’s effort trace, then look at expiratory flow.',
  prompt:
    'If you raise the cycle-off threshold (ETS) on these pressure-support breaths, what immediate change should you look for on the traces?',
  choices: [
    'A longer machine inspiration',
    'Shorter machine inspiration',
    'A larger delivered volume',
  ],
  correct: 1,
  rationales: [
    'A higher threshold is reached sooner as inspiratory flow decays, so the breath cycles off earlier, not later.',
    'A higher threshold is reached sooner as inspiratory flow decays, so support ends earlier — provided flow cycling, not the maximum inspiratory time, is what ends this breath. Watch the measured inspiratory time and expiratory flow, then reassess the patient.',
    'Ending support sooner gives the breath less time to fill, so the delivered tidal volume tends to fall, not rise.',
  ],
  task: 'Raise the cycle-off threshold (ETS) to 50%, then compare the measured inspiratory time and expiratory flow.',
  goals: [c('etsPercent', 50)],
  seconds: 25,
  watch: ['ti', 'expiratoryFlow', 'intrinsicPeep', 'volume'],
  explanation:
    'Raising ETS changes the breath only when flow cycling, not the maximum inspiratory time, is what ends it. The response is this patient’s: the threshold used here suits this comparison and is not a setting for every patient.',
})
const flow = round({
  title: 'Move the gas faster',
  hint: 'Flow is a rate and tidal volume is an amount. Hold the amount fixed and ask how long it takes at the new rate.',
  introduction:
    'In volume control, inspiratory flow and tidal volume are separate settings: you can change one without the other.',
  look: 'Follow the square flow wave, and how long the volume trace takes to reach its peak.',
  prompt: 'If inspiratory flow rises and the set tidal volume stays the same, what happens?',
  choices: [
    'The same volume arrives sooner',
    'The selected volume must rise',
    'The breath must take longer to fill',
  ],
  correct: 0,
  rationales: [
    'Faster flow delivers the same volume in less time. Pressure during flow can also change.',
    'Flow is a rate; the set tidal volume is a separate setting and stays where it is.',
    'Faster delivery shortens the time needed for the same volume.',
  ],
  task: 'Set peak inspiratory flow to 60 L/min, then watch flow, volume and pressure together.',
  goals: [c('peakFlowLMin', 60)],
  watch: ['ti', 'volume', 'peak'],
  explanation:
    'Flow is how fast gas moves; volume is how much has moved. At the same tidal volume, higher flow fills the breath sooner and shortens inspiratory time.',
})
const oxygen = round({
  title: 'Separate oxygen from breath delivery',
  hint: 'Ask on which of the three traces — pressure, flow or volume — the oxygen setting appears at all.',
  asks: 'identify',
  introduction:
    'The same passive patient. Leave the tidal volume, rate, flow and PEEP where they are.',
  look: 'Read breath delivery on the three traces, and oxygenation on the SpO₂.',
  prompt: 'What does raising the set oxygen fraction (FiO₂) change directly?',
  choices: [
    'The volume delivered with each machine inflation',
    'The gas mixture entering the circuit',
    'The interval before the next machine inflation',
  ],
  correct: 1,
  rationales: [
    'Tidal volume is a separate setting.',
    'The FiO₂ changes at the ventilator at once; the patient’s response develops over time.',
    'Rate and breath timing are set by other controls.',
  ],
  task: 'Raise FiO₂ from 40% to 60%. Let the patient run, then compare oxygenation and CO₂ with the breath traces.',
  goals: [c('oxygenPercent', 60)],
  seconds: 30,
  watch: ['spo2', 'volume', 'rate', 'co2'],
  explanation:
    'Changing FiO₂ changes the gas mixture, not the tidal volume or the rate. Oxygenation, CO₂ clearance and breath delivery each have their own reading.',
})
const effortHold = round({
  title: 'An inspiratory hold in a patient making efforts',
  hint: 'Find the dashed effort trace during the hold. Ask which way a patient who is pulling in moves the airway pressure.',
  caseId: 'MV-01',
  introduction:
    'This patient has stiffer lungs and is making inspiratory efforts. Watch the effort trace during the hold.',
  look: 'Read the dashed effort trace with pressure and flow. A plateau on the screen is not automatically a passive measurement of lung mechanics.',
  prompt: 'What could make a low airway pressure during the hold misleading?',
  choices: [
    'Airway pressure elevated by residual flow',
    'Stable airway pressure with quiet respiratory muscles',
    'Muscle effort lowering airway pressure',
  ],
  correct: 2,
  rationales: [
    'Flow that has not stopped can add resistive pressure and raise the reading; it does not explain a reading pulled down by effort.',
    'A stable pressure during a no-flow hold in a passive patient supports the measurement; it does not make it misleading.',
    'An inspiratory effort can lower airway pressure while adding to the pressure that distends the lung. Check the effort trace before you use the number.',
  ],
  task: 'Perform an inspiratory hold and check whether the effort trace is quiet during it.',
  goals: [hold],
  watch: ['peak', 'plateau', 'effort'],
  explanation:
    'Compare the hold’s validity flag and the effort trace with the passive hold in Part 1. A plateau read during an inspiratory effort can be falsely low: do not take it as reassuring lung mechanics.',
})

export const ventilationLearningExperiments: readonly LearningExperiment[] = [
  {
    unitId: 'breathing-with-support',
    panelId: 'waveform-anatomy',
    rounds: [
      round({
        title: 'Reading interval A',
        hint: 'Look at which side of the zero line the flow trace is on at interval A, and which way the volume trace is heading.',
        introduction: 'Interval A is marked on one complete breath, held still on the console.',
        look: 'Read pressure, flow and volume at interval A on the frozen breath.',
        prompt: 'Which phase is marked at interval A?',
        choices: ['Expiration', 'Inspiration', 'A no-flow occlusion'],
        correct: 0,
        rationales: [
          'Interval A falls after inspiratory flow has ended: flow is below zero and the volume above baseline is falling.',
          'During inspiration in this passive breath, flow is above zero and volume rises.',
          'An occlusion would show zero flow and a flat volume trace. Freezing the display is not an occlusion.',
        ],
        task: 'Press Run, then Pause while gas is flowing out. Or, on the frozen breath, move the cursor into expiration and choose Use this captured interval.',
        goals: [{ type: 'pause-expiration' }],
        seconds: 0,
        watch: [],
        explanation:
          'At interval A gas is leaving the lungs: flow is below zero and volume is falling back toward its starting level. That pattern, not the moment you pressed Pause, identifies expiration in a passive breath.',
      }),
      round({
        title: 'Reading interval B',
        hint: 'At interval B, check the sign of flow and whether the volume trace is rising or falling.',
        setup: [set('ratePerMin', 12)],
        introduction:
          'For this part the set rate is 12/min, so each breath lasts longer. Interval B is marked on one complete breath, held still on the console.',
        look: 'Read pressure, flow and volume at interval B on the frozen breath. No setting changes in this part.',
        prompt: 'Which phase is marked at interval B?',
        choices: ['A no-flow occlusion', 'Expiration', 'Inspiration'],
        correct: 2,
        rationales: [
          'Flow is not zero at interval B.',
          'During expiration in this passive breath, flow is below zero and volume falls.',
          'During inspiration, flow is above zero and volume rises.',
        ],
        task: 'On the frozen breath, move the cursor into inspiration and choose Use this captured interval. The cursor moves with the arrow keys; interval B stays where it is.',
        goals: [{ type: 'inspect-inspiration' }],
        seconds: 0,
        watch: [],
        explanation:
          'A slower rate makes the whole cycle longer, but inspiration still looks the same: flow above zero and volume rising. Reading the traces, not timing a Pause, is the skill.',
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
        title: 'Lower inspiratory flow, same tidal volume',
        hint: 'The same amount is delivered at a slower rate: compare the slope of the volume trace and the length of inspiration.',
        setup: [set('peakFlowLMin', 60)],
        introduction:
          'A new starting point: inspiratory flow is 60 L/min and the set tidal volume is unchanged.',
        prompt:
          'If inspiratory flow falls and the set tidal volume stays the same, how will the volume trace compare?',
        choices: [
          'A steeper volume rise over less time',
          'A slower volume rise over more time',
          'The same inspiratory duration with a larger selected volume',
        ],
        correct: 1,
        rationales: [
          'A steeper rise represents faster inward flow.',
          'At lower flow the same volume accumulates over a longer inspiration.',
          'Flow and set tidal volume are separate settings.',
        ],
        task: 'Set inspiratory flow to 30 L/min, leave the tidal volume where it is, and compare the captured breaths.',
        goals: [c('peakFlowLMin', 30)],
      },
    ],
  },
  {
    unitId: 'controls-and-goals',
    panelId: 'modes-and-breath-delivery',
    rounds: [
      round({
        title: 'A setting and the measurement that checks it',
        hint: 'One value is what you asked for and one is what came back. Find the one on the monitoring side of the screen.',
        asks: 'identify',
        introduction:
          'Start from the five main settings: mode, breath size, rate, PEEP and oxygen. In volume control, breath size is the set tidal volume.',
        look: 'Find the set tidal volume, the exhaled volume the ventilator reports, and the peak pressure it took to deliver the breath.',
        prompt:
          'After you raise the set tidal volume, which value tells you what the patient actually received?',
        choices: [
          'The tidal volume selected on the console',
          'The measured exhaled tidal volume',
          'The oxygen fraction selected on the console',
        ],
        correct: 1,
        rationales: [
          'The set value is the request, not proof of delivery.',
          'Exhaled tidal volume is measured. Compare it with the set volume.',
          'The oxygen fraction (FiO₂) describes the gas mixture, not breath size.',
        ],
        task: 'Set the tidal volume to 500 mL, then read the measured exhaled volume.',
        goals: [c('vtMl', 500)],
        watch: ['volume', 'peak'],
        explanation:
          'The set tidal volume is the request; the measured exhaled tidal volume is the result. Check the peak pressure too: Section 4 explains what that pressure is made of.',
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
        task: 'Set the teaching patient’s compliance to 0.5×, then perform an inspiratory hold.',
        goals: [m('complianceScale', 0.5), hold],
        explanation:
          'Compare this with the resistance experiment. Elastic pressure does not go away when flow stops, so a stiffer system shows on the plateau.',
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
          'The stiffness experiment from Section 4, read here for what volume control (VC) holds constant. The set tidal volume and flow stay fixed.',
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
          'The mode is now pressure control (PC). The same passive patient receives a set pressure above PEEP for a set inspiratory time. Make the same stiffness change.',
      },
    ],
  },
  {
    unitId: 'lung-protection',
    panelId: 'mechanics-load-and-pressure',
    rounds: [
      round({
        title: 'Size the breath to predicted body weight',
        hint: 'Elastic pressure is the delivered volume divided by the compliance, and the compliance has not changed here.',
        setup: [set('vtMl', 600)],
        introduction:
          'This passive adult has a predicted body weight of 70 kg. Read the size of the breath and the pressure it takes together.',
        look: 'Read the exhaled tidal volume against predicted body weight, then the plateau pressure on an inspiratory hold.',
        prompt:
          'If you lower the set tidal volume and compliance is unchanged, what happens to the elastic pressure the breath requires?',
        choices: [
          'A larger pressure requirement',
          'An unchanged pressure requirement',
          'A smaller pressure requirement',
        ],
        correct: 2,
        rationales: [
          'At the same compliance, a smaller tidal volume stretches the respiratory system less, so it cannot need more elastic pressure.',
          'Elastic pressure depends on the delivered tidal volume as well as on compliance, so a smaller breath changes it.',
          'In a passive patient, a smaller tidal volume needs less elastic pressure. Gas exchange still needs its own check.',
        ],
        task: 'Lower the set tidal volume to 420 mL — 6 mL/kg at this patient’s predicted body weight of 70 kg — then perform an inspiratory hold.',
        goals: [c('vtMl', 420), hold],
        watch: ['volume', 'plateau', 'co2'],
        explanation: `Size the breath by predicted body weight and judge it by a valid plateau. In ARDS the goal is ${N('vt-ards-goal')} with a plateau ${N('pplat-limit')}; a smaller breath lowers the plateau and raises PaCO₂, so recheck the blood gas.`,
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
        title: 'Trigger sensitivity and unanswered efforts',
        hint: 'Count the efforts on the dashed trace and count the machine breaths. The change is aimed at the efforts with no breath after them.',
        caseId: 'MV-07',
        introduction:
          'This patient makes more inspiratory efforts than the ventilator delivers breaths.',
        look: 'Look for efforts on the dashed trace that are not followed by a machine breath.',
        prompt:
          'If you make the flow trigger more sensitive, which response would show it is doing what you intended?',
        choices: [
          'More efforts followed by a delivered breath',
          'Fewer efforts followed by a delivered breath',
          'Larger breaths with each captured effort',
        ],
        correct: 0,
        rationales: [
          'More of the patient’s efforts now trigger a breath. Then check that no breaths have appeared without an effort before them.',
          'A less sensitive trigger can miss more efforts: the opposite of the intended change.',
          'The trigger decides whether a breath starts, not how large it is; breath size is set elsewhere.',
        ],
        task: 'Set the flow trigger to 1.5 L/min, then compare the efforts on the dashed trace with the breaths delivered.',
        goals: [c('triggerThreshold', 1.5)],
        seconds: 20,
        watch: ['missed', 'rate', 'effort'],
        explanation:
          'The result you want is efforts that trigger breaths, without breaths that start with no effort behind them. This threshold is set for this comparison; reassess the pattern after every adjustment.',
      }),
      round({
        title: 'Effort that outlasts the machine breath',
        hint: 'The breath ends when inspiratory flow has decayed to the set percentage of its peak. Ask whether a lower percentage is reached sooner or later.',
        caseId: 'MV-09',
        introduction:
          'This patient triggers each pressure-support breath, but the ventilator cycles to expiration before the patient’s effort has ended.',
        look: 'Watch the effort that is still going when the ventilator cycles.',
        prompt:
          'If you lower the cycle-off threshold (ETS), and flow cycling is what ends these breaths, what changes?',
        choices: [
          'A shorter machine inspiration',
          'A longer machine inspiration',
          'Breaths that start with no effort',
        ],
        correct: 1,
        rationales: [
          'That is what raising the threshold does: a higher percentage of peak flow is reached earlier as flow decays. Lowering it does the reverse.',
          'A lower percentage of peak flow is reached later as flow decays, so support lasts longer, until another limit ends the breath.',
          'A breath that starts without an effort is a triggering problem. The cycle-off decides only when inspiration ends.',
        ],
        task: 'Lower the cycle-off threshold (ETS) to 15%, then compare the measured inspiratory time and the tidal volume.',
        goals: [c('etsPercent', 15)],
        seconds: 20,
        watch: ['ti', 'volume', 'dyspnea'],
        explanation:
          'Triggering starts the breath; cycling ends it. Lengthening inspiration can also change the tidal volume, so check both the timing and the volume delivered.',
      }),
    ],
  },
  {
    unitId: 'oxygenation-response',
    panelId: 'oxygenation-response',
    rounds: [
      round({
        title: 'Oxygenation against airway pressure and blood pressure',
        hint: 'Three readings are named. Decide which one, if it moved the wrong way, would be a cost and not a benefit.',
        asks: 'interpret',
        caseId: 'MV-01',
        introduction:
          'In the matched comparison the patient, the elapsed time, the tidal volume, the flow and the FiO₂ are the same in both arms. Your own patient on the console is separate, and you can make the same PEEP change there.',
        look: 'Read SpO₂, airway pressure and mean arterial pressure (MAP) together.',
        prompt:
          'SpO₂ rises after the PEEP change. Which accompanying finding means that rise is not, by itself, evidence of benefit?',
        choices: [
          'SpO₂ rises with unchanged exhaled volume',
          'SpO₂ rises with stable arterial pressure',
          'SpO₂ rises while MAP falls',
        ],
        correct: 2,
        rationales: [
          'An unchanged exhaled volume is useful context, but it does not show a circulatory cost.',
          'A stable blood pressure is reassuring context; a falling one is the concern.',
          'A better SpO₂ can come with a circulatory cost. Read the whole response before you call it a benefit.',
        ],
        task: 'On your own patient, raise PEEP from 5 to 10 cmH₂O and watch for 45 simulated seconds.',
        goals: [c('peepCmH2O', 10)],
        seconds: 45,
        watch: ['spo2', 'map', 'peak', 'volume'],
        explanation:
          'Compare your patient’s response with the matched comparison. Waiting alone changes oxygenation in this case. This patient’s compliance is different at the new PEEP, but a plateau read during inspiratory effort does not establish static compliance. Read oxygenation, tidal volume, airway pressure and MAP together.',
      }),
      oxygen,
    ],
  },
  {
    unitId: 'ventilation-and-co2',
    panelId: 'ventilation-and-co2',
    rounds: [
      round({
        title: 'A rate change and the blood gas',
        hint: 'Carbon dioxide follows the ventilation that reaches exchanging lung, relative to production. Production is unchanged here.',
        introduction:
          'Leave the tidal volume and the lung mechanics as they are. Breath timing changes at once; the blood gas changes over time.',
        look: 'Read the total rate and the minute ventilation alongside the CO₂.',
        prompt:
          'With the delivered tidal volume and expiratory emptying preserved, which way should more effective ventilation move the CO₂ over time?',
        choices: ['Toward a lower value', 'Toward a higher value', 'No relation to ventilation'],
        correct: 0,
        rationales: [
          'CO₂ clearance rises while CO₂ production is unchanged, and the blood gas follows the ventilator change after a delay.',
          'That would fit less effective ventilation relative to CO₂ production.',
          'Effective alveolar ventilation is central to CO₂ clearance.',
        ],
        task: 'Raise the set rate to 20/min and follow the patient for 90 simulated seconds. Check expiration as well as the CO₂.',
        goals: [c('ratePerMin', 20)],
        seconds: 90,
        watch: ['rate', 'minute', 'co2', 'expiratoryFlow'],
        explanation:
          'A setting changes at once; the blood gas follows over time. The CO₂ means something only once you have checked the delivered volume, complete emptying and the clinical context.',
      }),
      round({
        ...stiffPressure,
        title: 'The same set rate on pressure control',
        hint: 'Minute ventilation is the rate times the delivered volume. The rate is unchanged; find what pressure control leaves free to move.',
        introduction:
          'The same passive patient, now on pressure control. Leave the rate where it is and follow gas exchange as the respiratory system becomes stiffer.',
        prompt:
          'The set rate is unchanged and pressure control now delivers smaller tidal volumes. What happens to the CO₂?',
        choices: [
          'CO₂ stays similar because the selected rate is unchanged',
          'CO₂ falls because the pressure target is held constant',
          'CO₂ rises as effective ventilation falls',
        ],
        correct: 2,
        rationales: [
          'The rate alone does not determine effective ventilation; the delivered tidal volume matters too.',
          'A constant set pressure does not guarantee the tidal volume or CO₂ clearance.',
          'With everything else unchanged, smaller tidal volumes reduce ventilation, and CO₂ rises over time.',
        ],
        task: 'Set the teaching patient’s compliance to 0.5×, leave the ventilator settings alone, and follow the patient for 90 simulated seconds.',
        seconds: 90,
        watch: ['volume', 'minute', 'co2', 'rate'],
        explanation:
          'The same set rate can come with very different effective ventilation. Follow the delivered tidal volume and minute ventilation, then recheck the CO₂, which changes more slowly.',
      }),
    ],
  },
  {
    unitId: 'waveform-reading-sequence',
    panelId: 'waveform-reading-sequence',
    rounds: [
      round({
        title: 'Breaths above the set rate',
        hint: 'If the extra breaths were started by the circuit and not by the patient, ask what becomes of them once the circuit is corrected.',
        caseId: 'MV-08',
        introduction:
          'This patient’s total rate is above the set rate. Compare the patient’s efforts, the machine breaths and the circuit.',
        look: 'Read the timing on all three traces against the effort trace before you put the high rate down to the patient’s drive.',
        prompt:
          'If the circuit, not the patient, is triggering breaths, what finding after the correction would support that?',
        choices: [
          'Larger volumes in the delivered breaths',
          'Fewer extra machine breaths',
          'Higher pressure during machine breaths',
        ],
        correct: 1,
        rationales: [
          'Setting the tidal volume is a separate action.',
          'Expect fewer breaths with no effort before them, and a total rate closer to the rate of the patient’s own efforts.',
          'A higher pressure does not, by itself, tell you what triggered the breath.',
        ],
        task: 'Inspect the circuit, then clear the condensate you find. Compare the total rate with the patient’s efforts.',
        goals: [action('inspect-circuit'), action('drain-condensate')],
        seconds: 25,
        watch: ['rate', 'effort', 'volume'],
        explanation:
          'The waveform suggests a mechanism; examining the patient and the circuit confirms or refutes it. Clearing the condensate takes a little time to show in the rate.',
      }),
      round({
        ...flow,
        title: 'Inspiratory flow in a patient pulling hard',
        caseId: 'MV-02',
        relation: {
          kind: 'revisit',
          unitId: 'waveform-anatomy',
          part: 1,
          note: 'The same flow question, asked here of a patient who is pulling hard during inspiration.',
        },
        introduction:
          'This patient makes a strong inspiratory effort during machine inspiration. Read the breath in order again, from the trigger to expiration.',
        task: 'Raise peak inspiratory flow to 60 L/min, leave the set tidal volume alone, and watch the shape of airway pressure during inspiration.',
        explanation:
          'The same flow setting, now in a patient with a high inspiratory demand. Read the effort trace and how it pulls the pressure trace down, as well as the tidal volume.',
      }),
    ],
  },
  {
    unitId: 'dyssynchrony-mechanisms',
    panelId: 'dyssynchrony-mechanisms',
    rounds: [
      round({
        title: 'Rise time on pressure support',
        hint: 'Read the first part of each push: the pressure contour and the patient’s comfort together, not either one alone.',
        caseId: 'MV-11',
        introduction:
          'This patient triggers each pressure-support breath but is uncomfortable while airway pressure rises slowly to the set level.',
        look: 'Watch the shape of airway pressure early in inspiration, and the patient’s effort and comfort.',
        prompt:
          'Which response to a shorter rise time would support that the original rise time was too slow?',
        choices: [
          'Faster rise with increasing pressure overshoot',
          'Faster rise with larger uncomfortable breaths',
          'Faster rise with less discomfort',
        ],
        correct: 2,
        rationales: [
          'Pressure overshoot suggests the rise is now too fast; a faster rise is not automatically better.',
          'Larger tidal volumes alone do not show a better match to the patient’s demand.',
          'A faster rise that leaves the patient more comfortable fits a rise time that was too slow. Judge the early pressure shape and comfort together, and check for overshoot.',
        ],
        task: 'Shorten the rise time (P-ramp) to 100 ms, then compare the early pressure contour and the patient’s dyspnea.',
        goals: [c('pRampMs', 100)],
        seconds: 20,
        watch: ['dyspnea', 'peak', 'volume'],
        explanation:
          'Even when the patient is more comfortable, check for pressure overshoot and an excessive tidal volume. A faster rise is not better without limit.',
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
        title: 'A distressed patient who can communicate',
        hint: 'Two of the choices describe what was done or recorded. One finds out something about the patient.',
        asks: 'reflect',
        caseId: 'MV-15',
        introduction: 'This patient is awake, distressed and able to communicate.',
        look: 'Keep the patient’s distress, breathing effort and the support being delivered in view.',
        prompt:
          'Before you change ventilator support, what would best help you target the next step?',
        choices: [
          'Ask what is making breathing difficult',
          'Use silence of the alarm to judge recovery',
          'Use a written plan to judge recovery',
        ],
        correct: 0,
        rationales: [
          'The patient’s answer can reveal a reversible cause. It does not by itself show physiologic recovery.',
          'Silencing an alarm changes how the alarm is handled, not what caused it.',
          'A written plan still needs an intervention and a reassessment of the patient.',
        ],
        task: 'Assess the patient and establish communication, then watch how their comfort changes.',
        goals: [action('assess-patient'), action('communication-board')],
        seconds: 30,
        watch: ['anxiety', 'dyspnea', 'rate'],
        explanation:
          'Tie each intervention to what actually changes in the patient. Completing a task is not evidence that the patient improved.',
      }),
      round({
        title: 'Treating the documented pain',
        hint: 'An intervention being recorded and a patient improving are different observations. Ask which one tests the other.',
        asks: 'interpret',
        caseId: 'MV-15',
        introduction: 'Now treat the documented pain in the same patient.',
        look: 'Follow pain, dyspnea and respiratory effort over time.',
        prompt: 'Which observation best shows whether treating the pain helped?',
        choices: [
          'An intervention appearing in the action record',
          'Patient findings improving over time',
          'The alarm being acknowledged on the device',
        ],
        correct: 1,
        rationales: [
          'The action record shows that the treatment was given, not that it helped.',
          'Reassessing the patient links the treatment to its response, which comes after a delay.',
          'Whether the alarm is sounding is no substitute for examining the patient.',
        ],
        task: 'Choose Treat the pain in Bedside actions. Allow for its 120-second delay, then follow the response for 150 simulated seconds; 5× time is fine.',
        goals: [action('treat-pain')],
        seconds: 150,
        watch: ['pain', 'dyspnea', 'effort', 'rate'],
        explanation:
          'Pain drives rate and effort. Treat it before you adjust the ventilator for a fast, effortful patient, then read the ventilator again.',
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
          'This passive patient has a high peak pressure, and the cause is not given. Measure before you decide.',
        prompt:
          'What finding on an inspiratory hold would show that much of this peak pressure is spent moving gas?',
        choices: [
          'Pressure that remains close to its flowing peak',
          'A wider swing on the volume trace',
          'Pressure falls substantially when flow stops',
        ],
        correct: 2,
        rationales: [
          'Pressure that persists once flow has stopped reflects the elastic and baseline (end-expiratory) pressure.',
          'The hold does not change the delivered volume; the split between the two pressures is read on the pressure trace.',
          'A large drop from peak to plateau once flow stops supports a large resistive component, provided the patient is passive.',
        ],
        task: 'Perform an inspiratory hold. Read peak and plateau pressure, confirm that the effort trace is quiet, and explain the pattern.',
        goals: [hold],
      }),
      round({
        ...resistance,
        title: 'Same presentation, a different patient',
        hint: 'Ask which part of the pressure remains once flow has stopped, and what that part depends on.',
        setup: [mechanics(0.4, 1)],
        introduction:
          'A second passive patient also has a high peak pressure. Measure again from the start.',
        prompt:
          'What finding on the hold would support a larger elastic component in this patient?',
        choices: [
          'Higher pressure persisting after flow stops',
          'A large fall from the peak as soon as flow stops',
          'A wider swing on the volume trace',
        ],
        correct: 0,
        rationales: [
          'Pressure that persists during a valid no-flow hold reflects the elastic and baseline pressure.',
          'A large drop once flow stops is the resistive pattern: the first patient’s, not this one’s.',
          'The delivered volume is set and does not change with a hold; the split is read on the pressure trace.',
        ],
        task: 'Perform an inspiratory hold and compare peak and plateau with the first patient’s.',
        goals: [hold],
        explanation:
          'The same peak pressure can come from different mechanisms. Put the peak-to-plateau difference, the baseline pressure, expiration, the effort trace and the patient together before you choose the clinical action.',
      }),
    ],
  },
]
export const ventilationExperimentByUnit = new Map(
  ventilationLearningExperiments.map((experiment) => [experiment.unitId, experiment]),
)
