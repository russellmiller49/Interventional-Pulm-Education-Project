/** The sole ordering authority for the rebuilt course. Existing lesson/case IDs stay valid. */
export const VENTILATION_FINAL_CHECK_ID = 'final-mixed'

export type VentilationObjective =
  | 'breath'
  | 'mechanics'
  | 'interaction'
  | 'gas-exchange'
  | 'safety'
export type VentilationStage =
  | 'orientation'
  | 'foundation'
  | 'mechanism'
  | 'application'
  | 'integration'

export const ventilationObjectives: readonly {
  id: VentilationObjective
  title: string
  description: string
}[] = [
  {
    id: 'breath',
    title: 'Read a breath',
    description: 'Distinguish what you set from what the patient receives.',
  },
  {
    id: 'mechanics',
    title: 'Explain the pressure',
    description: 'Separate resistance, stiffness, and incomplete emptying; assess lung protection.',
  },
  {
    id: 'interaction',
    title: 'Find the mismatch',
    description: 'Locate a problem in the patient’s effort, breath delivery, or timing.',
  },
  {
    id: 'gas-exchange',
    title: 'Choose the right goal',
    description: 'Separate oxygenation from CO₂ clearance and name what to reassess.',
  },
  {
    id: 'safety',
    title: 'Bring it back to the patient',
    description: 'Prioritize a deteriorating patient and explain your next assessment.',
  },
]

export const ventilationStages: readonly {
  id: VentilationStage
  title: string
  description: string
}[] = [
  {
    id: 'orientation',
    title: 'Meet the breath',
    description: 'Walk through the whole system once.',
  },
  {
    id: 'foundation',
    title: 'Learn to see',
    description: 'Connect the traces and the controls to that breath.',
  },
  {
    id: 'mechanism',
    title: 'Build your reasoning',
    description: 'Change one idea at a time. Predict what follows.',
  },
  {
    id: 'application',
    title: 'Read the patient and the machine',
    description: 'Use familiar mechanisms with less guidance.',
  },
  {
    id: 'integration',
    title: 'Put it together',
    description: 'One presentation. Several possible explanations.',
  },
]

export interface VentilationLearningUnit {
  readonly id: string
  readonly title: string
  readonly shortTitle: string
  readonly stage: VentilationStage
  readonly minutes: number
  readonly objective: VentilationObjective
  readonly outcome: string
  readonly why: string
  readonly increment: string
  readonly prerequisites: readonly string[]
  readonly recallUnit?: string
  readonly spine: 'whole' | 'trigger' | 'delivery' | 'cycle' | 'expiration'
  readonly analogy: string
  readonly explanation: string
  readonly checklist: readonly string[]
  readonly example: {
    readonly situation: string
    readonly reasoning: readonly string[]
    readonly conclusion: string
  }
  readonly boundary: string
  readonly evidenceIds: readonly string[]
  readonly caseIds: readonly string[]
  readonly visual: 'breath' | 'controls' | 'protection' | 'expiration' | 'existing'
}

const textbook = ['tobin-3e-setting-ventilator', 'tobin-3e-monitoring']
const mechanics = ['tobin-3e-monitoring', 'tobin-3e-fighting-ventilator']
const interaction = ['antonogiannaki-dyssynchrony-2017', 'tobin-3e-fighting-ventilator']
const constructed =
  'This is an authored teaching example. It teaches a relationship, not a setting for a real patient.'

export const ventilationLearningUnits: readonly VentilationLearningUnit[] = [
  {
    id: 'breathing-with-support',
    title: 'Follow one supported breath',
    shortTitle: 'The whole breath',
    stage: 'orientation',
    minutes: 5,
    objective: 'breath',
    outcome: 'Locate inspiration and expiration within one supported breath.',
    why: 'At a patient’s bedside, every setting and waveform belongs to a part of the breath.',
    increment: 'Start with one complete breath, before learning individual controls.',
    prerequisites: [],
    spine: 'whole',
    analogy:
      'Think of filling and releasing a balloon through a tube: getting air in is only half the cycle.',
    explanation:
      'A ventilator helps move gas into the respiratory system. A signal starts inspiration, support is delivered, inspiration ends, and gas flows out. Moving gas supports breathing; oxygen transfer and CO₂ removal still depend on the patient’s lungs and circulation.',
    checklist: [
      'Find the beginning of inspiration.',
      'Follow gas moving in.',
      'Find the change to expiration.',
      'Follow gas moving out before the next breath.',
    ],
    example: {
      situation: 'Watch the normal supported breath below. The patient is passive in this drawing.',
      reasoning: [
        'The machine starts inspiration and gas moves inward.',
        'Inspiration ends and the respiratory system recoils.',
        'The outward flow gets smaller as the system empties.',
      ],
      conclusion: 'Read the complete cycle. A breath includes time to empty.',
    },
    boundary:
      'This diagram shows a passive, single-compartment breath. It omits leaks, uneven lung filling, and active patient effort.',
    evidenceIds: textbook,
    caseIds: ['MV-01'],
    visual: 'breath',
  },
  {
    id: 'waveform-anatomy',
    title: 'Three traces, one breath',
    shortTitle: 'Read the traces',
    stage: 'foundation',
    minutes: 6,
    objective: 'breath',
    outcome: 'Distinguish pressure, flow, and volume on the same breath.',
    why: 'A change on a patient’s flow trace means something different from a change in breath size.',
    increment: 'Add three views of the breath you just followed.',
    prerequisites: ['breathing-with-support'],
    recallUnit: 'breathing-with-support',
    spine: 'whole',
    analogy:
      'Flow is like the speed of water from a tap; volume is how much has collected in the container.',
    explanation:
      'Pressure describes the push at the airway opening. Flow describes how fast gas moves and in which direction. Volume accumulates as gas enters and falls as gas leaves. Read all three against the same time axis.',
    checklist: [
      'Pressure: how much push?',
      'Flow: how fast, and in which direction?',
      'Volume: how much gas?',
      'Time: which part of the breath?',
    ],
    example: {
      situation: 'On the illustrated inspiration, flow stays level while volume climbs.',
      reasoning: [
        'A level flow means gas enters at a steady rate.',
        'Gas keeps accumulating, so volume rises.',
        'These are two descriptions of the same event.',
      ],
      conclusion: 'A flat flow trace does not mean volume has stopped increasing.',
    },
    boundary:
      'The volume trace is referenced to this illustrated breath. A ventilator volume tracing alone does not measure absolute lung volume.',
    evidenceIds: textbook,
    caseIds: ['MV-01', 'MV-04'],
    visual: 'breath',
  },
  {
    id: 'controls-and-goals',
    title: 'What you set. What you check.',
    shortTitle: 'Settings and results',
    stage: 'foundation',
    minutes: 6,
    objective: 'breath',
    outcome: 'Pair a control with the delivered result that needs checking.',
    why: 'A patient can receive something different from the number you entered on the ventilator.',
    increment: 'Add one distinction: a setting is an instruction; a measurement is the result.',
    prerequisites: ['breathing-with-support', 'waveform-anatomy'],
    recallUnit: 'waveform-anatomy',
    spine: 'delivery',
    analogy:
      'Setting a thermostat is a request. Reading the room thermometer tells you what happened.',
    explanation:
      'Group the controls into oxygen concentration, pressure between breaths, breath size or support, breath frequency, and timing. Everything else helps you judge delivery and tolerance. Begin with the patient’s goal, then choose a control and a specific reassessment.',
    checklist: [
      'Name the goal.',
      'Choose a relevant control.',
      'Check the delivered result.',
      'Check the patient’s tolerance.',
    ],
    example: {
      situation: 'You set a mandatory breath rate, but the displayed total rate is higher.',
      reasoning: [
        'The set rate describes mandatory breath timing.',
        'Patient-triggered breaths can increase the total rate.',
        'Read effort and the breath sequence before deciding why the rates differ.',
      ],
      conclusion: 'Compare the request with the result; do not assume either number is wrong.',
    },
    boundary:
      'Control labels vary by device and mode. The five groups are a teaching aid, not a manufacturer control taxonomy.',
    evidenceIds: textbook,
    caseIds: ['MV-01', 'MV-07'],
    visual: 'controls',
  },
  {
    id: 'mechanics-load-and-pressure',
    title: 'Where does the pressure go?',
    shortTitle: 'Pressure and load',
    stage: 'mechanism',
    minutes: 8,
    objective: 'mechanics',
    outcome:
      'Distinguish pressure used to move gas from pressure used to distend the respiratory system.',
    why: 'The same peak-pressure alarm can reflect an airway problem or a change in the lung and chest wall.',
    increment: 'Add one relationship: airway pressure contains more than one load.',
    prerequisites: ['waveform-anatomy', 'controls-and-goals'],
    recallUnit: 'waveform-anatomy',
    spine: 'delivery',
    analogy:
      'Blowing through a narrow straw takes pressure; inflating a stiff balloon also takes pressure. Those are different loads.',
    explanation:
      'During a passive breath, pressure above the end-expiratory baseline supplies flow resistance and elastic distension. When flow stops during a valid inspiratory hold, the resistive contribution falls away. Patient effort, leaks, or an unstable hold make a simple peak-to-plateau interpretation unreliable.',
    checklist: [
      'Check whether the patient is passive.',
      'Compare at similar flow and tidal volume.',
      'Compare peak with a valid plateau.',
      'Interpret the result with the patient and circuit.',
    ],
    example: {
      situation:
        'At unchanged volume and flow, a passive patient’s peak rises while a valid plateau stays near baseline.',
      reasoning: [
        'The elastic pressure needed for that volume has changed little.',
        'The added pressure appears while gas is moving.',
        'Inspect the tube, circuit, and airways to localize the resistance.',
      ],
      conclusion: 'The pattern favors added resistance; the peak alone could not tell you that.',
    },
    boundary:
      'A plateau estimates respiratory-system pressure under valid no-flow conditions. It is not a direct measure of transpulmonary pressure.',
    evidenceIds: mechanics,
    caseIds: ['MV-13', 'MV-14'],
    visual: 'existing',
  },
  {
    id: 'modes-and-breath-delivery',
    title: 'What does this breath hold constant?',
    shortTitle: 'Breath delivery',
    stage: 'mechanism',
    minutes: 8,
    objective: 'breath',
    outcome:
      'Predict the dependent variable in conventional volume- and pressure-controlled breaths.',
    why: 'When a patient’s mechanics change, the variable you must watch depends on the breath being delivered.',
    increment: 'Add one idea: choosing what to control determines what can change.',
    prerequisites: ['waveform-anatomy', 'controls-and-goals', 'mechanics-load-and-pressure'],
    recallUnit: 'mechanics-load-and-pressure',
    spine: 'delivery',
    analogy:
      'You can ask for a particular amount of air or apply a particular push. A changing load makes those different promises.',
    explanation:
      'In conventional volume control, the ventilator targets volume and pressure varies with load and effort. In conventional pressure control, it targets pressure and delivered volume varies. Limits, leaks, and patient interaction still matter. Adaptive modes require a separate description of what changes between breaths.',
    checklist: [
      'Identify what starts the breath.',
      'Identify the controlled variable.',
      'Identify what ends inspiration.',
      'Monitor the dependent variable and the patient.',
    ],
    example: {
      situation:
        'A passive patient becomes stiffer during a pressure-controlled breath with unchanged settings.',
      reasoning: [
        'The machine continues to target the same pressure.',
        'A stiffer respiratory system accepts less volume for that pressure.',
        'Check the exhaled volume and gas exchange.',
      ],
      conclusion: 'The unchanged pressure does not prove unchanged ventilation.',
    },
    boundary:
      'These comparisons concern conventional control modes. Adaptive, proportional, and dual-control modes cannot be reduced to the mode name alone.',
    evidenceIds: textbook,
    caseIds: ['MV-01', 'MV-04'],
    visual: 'existing',
  },
  {
    id: 'lung-protection',
    title: 'Is this breath appropriate for this lung?',
    shortTitle: 'Lung protection',
    stage: 'mechanism',
    minutes: 7,
    objective: 'mechanics',
    outcome: 'Use predicted body weight and valid pressure measurements to assess lung protection.',
    why: 'An acceptable saturation can coexist with excessive mechanical stress on an injured lung.',
    increment: 'Add one reference: assess breath size against predicted body weight.',
    prerequisites: ['mechanics-load-and-pressure', 'modes-and-breath-delivery'],
    recallUnit: 'modes-and-breath-delivery',
    spine: 'delivery',
    analogy:
      'Choose a container’s fill by its capacity, not by the weight of everything around it.',
    explanation:
      'Predicted body weight (PBW), calculated from height and sex using the applicable reference, is the basis for tidal-volume scaling. For adults with acute respiratory distress syndrome (ARDS), ATS guidance recommends 4–8 mL/kg PBW and plateau pressure below 30 cmH₂O. These are assessed together with effort, gas exchange, and the clinical situation.',
    checklist: [
      'Verify height and the PBW calculation.',
      'Express delivered tidal volume in mL/kg PBW.',
      'Check a valid plateau and patient effort.',
      'Reassess after changes with the clinical team.',
    ],
    example: {
      situation: 'An adult with ARDS has gained fluid weight. Their height has not changed.',
      reasoning: [
        'Fluid weight does not increase the PBW reference.',
        'Recalculate if the height or recorded inputs were wrong, not because the scale rose.',
        'Judge delivered volume and pressure together.',
      ],
      conclusion: 'Do not enlarge the breath simply to follow actual body weight.',
    },
    boundary:
      'The stated ATS limits apply to adult ARDS and are not a complete ventilator prescription. Individual adjustment requires current guidance, bedside assessment, and supervision.',
    evidenceIds: ['ats-ards-2024', 'aarc-assessment-2024'],
    caseIds: ['MV-01', 'MV-03'],
    visual: 'protection',
  },
  {
    id: 'expiration-and-air-trapping',
    title: 'Does the breath have time to finish?',
    shortTitle: 'Time to empty',
    stage: 'mechanism',
    minutes: 8,
    objective: 'mechanics',
    outcome: 'Recognize incomplete expiration and predict the effect of less emptying time.',
    why: 'A patient with slow exhalation can trap more gas when breaths arrive more frequently.',
    increment: 'Add one idea: expiration needs enough time for this respiratory system.',
    prerequisites: [
      'breathing-with-support',
      'waveform-anatomy',
      'mechanics-load-and-pressure',
      'modes-and-breath-delivery',
    ],
    recallUnit: 'mechanics-load-and-pressure',
    spine: 'expiration',
    analogy:
      'Try emptying a balloon through a narrow straw before filling it again. Start too soon and some gas remains.',
    explanation:
      'Resistance and compliance influence how quickly the respiratory system empties. Expiratory flow still present when the next breath starts suggests incomplete emptying. The resulting intrinsic PEEP is additional to the set PEEP; a valid expiratory hold can help assess it.',
    checklist: [
      'Find the expiratory flow limb.',
      'Check it just before the next breath.',
      'Assess total pressure with a valid measurement.',
      'Consider expiration time, airway load, and circulation.',
    ],
    example: {
      situation:
        'In an obstructive pattern, the next inspiration begins before outward flow has settled.',
      reasoning: [
        'The previous breath has not finished emptying.',
        'Increasing rate can leave even less time.',
        'Reassess the expiratory limb and the patient before chasing CO₂ with rate.',
      ],
      conclusion: 'More breaths do not guarantee more effective ventilation.',
    },
    boundary:
      'Flow suggests incomplete emptying but does not quantify all trapped gas. Leaks and active breathing can confound measurements.',
    evidenceIds: ['tobin-3e-copd', 'tobin-3e-monitoring'],
    caseIds: ['MV-05', 'MV-06', 'MV-10'],
    visual: 'expiration',
  },
  {
    id: 'triggering-and-cycling',
    title: 'Do the two breath clocks agree?',
    shortTitle: 'Patient and machine timing',
    stage: 'mechanism',
    minutes: 8,
    objective: 'interaction',
    outcome: 'Localize a timing mismatch to breath initiation or the end of inspiration.',
    why: 'A patient may be asking for a breath the machine misses, or still inspiring after machine support ends.',
    increment: 'Add the patient’s timing to the machine breath you already know.',
    prerequisites: [
      'breathing-with-support',
      'modes-and-breath-delivery',
      'expiration-and-air-trapping',
    ],
    recallUnit: 'expiration-and-air-trapping',
    spine: 'trigger',
    analogy:
      'Two people carrying a load need to start and stop together. Helping at the wrong time can still make the work harder.',
    explanation:
      'Triggering is the start of machine inspiration. Cycling is the switch to expiration. Compare the onset and end of patient effort with those two events. A miss at the start and a mismatch at the end call for different reasoning.',
    checklist: [
      'Locate the patient’s effort.',
      'Find the start of the machine breath.',
      'Find the end of machine inspiration.',
      'Describe the timing difference before naming it.',
    ],
    example: {
      situation: 'Patient effort continues after machine inspiratory flow has ended.',
      reasoning: [
        'The breath started, so this is not simply a missed trigger.',
        'Support ended before the patient’s inspiration ended.',
        'Assess cycling and the factors driving prolonged effort.',
      ],
      conclusion: 'The location in the breath guides the next assessment.',
    },
    boundary:
      'The effort trace is an educator-only model signal, not a routine directly measured ventilator signal. Confirm bedside interpretations clinically.',
    evidenceIds: interaction,
    caseIds: ['MV-07', 'MV-09', 'MV-10'],
    visual: 'existing',
  },
  {
    id: 'oxygenation-response',
    title: 'Did oxygenation improve at a cost?',
    shortTitle: 'Oxygenation and tolerance',
    stage: 'mechanism',
    minutes: 7,
    objective: 'gas-exchange',
    outcome:
      'Separate oxygen concentration from pressure support for oxygenation and select reassessment.',
    why: 'A patient’s saturation can rise while a pressure change worsens circulatory tolerance.',
    increment: 'Add the tradeoff between oxygenation and the effects of pressure.',
    prerequisites: ['controls-and-goals', 'mechanics-load-and-pressure', 'lung-protection'],
    recallUnit: 'lung-protection',
    spine: 'whole',
    analogy:
      'Supplying more oxygen and keeping a doorway open are different ways to help oxygen reach a destination.',
    explanation:
      'FiO₂ changes oxygen concentration at the airway. PEEP changes end-expiratory pressure and may help maintain aerated lung; it can also overdistend lung or affect circulation. Improved saturation is one result, not the whole reassessment.',
    checklist: [
      'Check oxygenation.',
      'Check pressure and delivered volume.',
      'Check blood pressure and perfusion.',
      'Compare the benefit with the patient’s tolerance.',
    ],
    example: {
      situation: 'After PEEP rises, saturation improves but blood pressure falls.',
      reasoning: [
        'The oxygenation response is real within the example.',
        'Pressure can affect both the lung and circulation.',
        'Assess the patient and reconsider the overall response with the team.',
      ],
      conclusion: 'Judge benefit and cost together.',
    },
    boundary:
      'PEEP response varies with recruitability, volume status, and cardiopulmonary physiology. No universal PEEP titration sequence is taught here.',
    evidenceIds: ['tobin-3e-peep', 'aarc-assessment-2024'],
    caseIds: ['MV-01'],
    visual: 'existing',
  },
  {
    id: 'ventilation-and-co2',
    title: 'What will change the CO₂?',
    shortTitle: 'Effective ventilation',
    stage: 'mechanism',
    minutes: 7,
    objective: 'gas-exchange',
    outcome:
      'Distinguish effective ventilation from oxygen delivery and plan a timed reassessment.',
    why: 'Turning up oxygen does not correct a patient’s inadequate CO₂ clearance.',
    increment:
      'Add one distinction: total gas moved and gas reaching exchanging lung are different.',
    prerequisites: [
      'controls-and-goals',
      'modes-and-breath-delivery',
      'expiration-and-air-trapping',
      'oxygenation-response',
    ],
    recallUnit: 'oxygenation-response',
    spine: 'expiration',
    analogy:
      'Moving more vehicles does not mean more reach the destination if some keep taking a dead-end road.',
    explanation:
      'Alveolar ventilation is the portion of ventilation reaching gas-exchanging lung. CO₂ also depends on production. A rate change alters breath timing promptly, but a blood-gas response takes time; in obstruction, more rate may worsen trapping instead of improving effective ventilation.',
    checklist: [
      'Check delivered volume and total rate.',
      'Check whether expiration finishes.',
      'Consider dead space and CO₂ production.',
      'Reassess gas exchange after an appropriate interval.',
    ],
    example: {
      situation: 'Oxygen saturation is acceptable but CO₂ is rising. Expiration is incomplete.',
      reasoning: [
        'Oxygen concentration is not the missing CO₂ control.',
        'The expiratory pattern constrains a rate increase.',
        'Assess ventilation, emptying, and the underlying load before changing support.',
      ],
      conclusion:
        'Choose the mechanism and then the reassessment, rather than a single number to chase.',
    },
    boundary:
      'The simulator uses a bounded delayed gas-exchange response. Its clock is not a bedside blood-gas sampling schedule.',
    evidenceIds: ['tobin-3e-setting-ventilator', 'tobin-3e-copd'],
    caseIds: ['MV-05', 'MV-06'],
    visual: 'existing',
  },
  {
    id: 'waveform-reading-sequence',
    title: 'Read the whole breath in order',
    shortTitle: 'A systematic read',
    stage: 'application',
    minutes: 7,
    objective: 'interaction',
    outcome: 'Combine pressure, flow, volume, and effort to decide what to assess next.',
    why: 'A striking feature on one trace can distract you from the signal that explains a patient’s problem.',
    increment: 'Combine the signals you already know into one repeatable read.',
    prerequisites: [
      'waveform-anatomy',
      'mechanics-load-and-pressure',
      'modes-and-breath-delivery',
      'expiration-and-air-trapping',
      'triggering-and-cycling',
      'ventilation-and-co2',
    ],
    recallUnit: 'triggering-and-cycling',
    spine: 'whole',
    analogy: 'Read a sentence from beginning to end before deciding what one word means.',
    explanation:
      'First assess the patient. Then follow each breath from initiation through delivery, cycling, and expiration. Compare pressure, flow, volume, and available evidence of effort at the same moment. Describe the observation before assigning a mechanism.',
    checklist: [
      'Start: effort and breath initiation.',
      'Delivery: pressure, flow, and volume.',
      'End: machine cycling versus effort.',
      'Expiration: emptying before the next breath.',
    ],
    example: {
      situation:
        'The displayed respiratory rate is high. Several machine breaths have no preceding visible effort.',
      reasoning: [
        'A rate alone cannot distinguish demand from extra machine breaths.',
        'Compare effort with the start of each breath.',
        'Inspect the circuit and trigger-related signals as well as the patient.',
      ],
      conclusion: 'The sequence identifies the missing discriminating observation.',
    },
    boundary:
      'A waveform is evidence, not a diagnosis. Bedside findings and signal validity remain part of the interpretation.',
    evidenceIds: ['tobin-3e-monitoring', 'antonogiannaki-dyssynchrony-2017'],
    caseIds: ['MV-07', 'MV-08'],
    visual: 'existing',
  },
  {
    id: 'dyssynchrony-mechanisms',
    title: 'Locate the mismatch before changing support',
    shortTitle: 'Explain the mismatch',
    stage: 'application',
    minutes: 8,
    objective: 'interaction',
    outcome: 'Distinguish a delivery mismatch from a trigger or cycling mismatch.',
    why: 'Making a distressed patient less visibly active can leave the underlying interaction unchanged.',
    increment: 'Combine effort, delivery, and timing with less guidance.',
    prerequisites: [
      'modes-and-breath-delivery',
      'triggering-and-cycling',
      'waveform-reading-sequence',
    ],
    recallUnit: 'modes-and-breath-delivery',
    spine: 'delivery',
    analogy: 'Ask whether help arrived late, was too small, or stopped at the wrong moment.',
    explanation:
      'Patient–ventilator mismatch can involve breath initiation, delivery during inspiration, cycling, or the amount of assist. The same visible distress can arise from different mechanisms. Describe where the mismatch happens, then assess a change and its consequence.',
    checklist: [
      'Locate the mismatch in the breath.',
      'Compare assist with patient demand.',
      'Consider pain, drive, and other patient causes.',
      'Reassess effort, delivery, and comfort together.',
    ],
    example: {
      situation:
        'A patient pulls strongly during a volume-controlled inspiration and the pressure trace dips inward.',
      reasoning: [
        'The effort occurs during delivery.',
        'Assess whether the delivered inspiratory flow meets demand.',
        'Also assess why demand is high; a ventilator change alone may not address it.',
      ],
      conclusion:
        'Localize first. A dyssynchrony label is useful only when it explains the next assessment.',
    },
    boundary:
      'Sedation and other treatments require individualized clinical judgment. This lesson teaches mechanism recognition, not medication dosing.',
    evidenceIds: interaction,
    caseIds: ['MV-02', 'MV-03', 'MV-04', 'MV-07', 'MV-08', 'MV-09', 'MV-10', 'MV-11', 'MV-12'],
    visual: 'existing',
  },
  {
    id: 'safety-reassessment-and-human-factors',
    title: 'The alarm and the person',
    shortTitle: 'Patient first',
    stage: 'application',
    minutes: 7,
    objective: 'safety',
    outcome: 'Prioritize a deteriorating patient while localizing a ventilator-related problem.',
    why: 'A hypotensive, hypoxemic patient needs a different response from a stable patient with the same alarm.',
    increment: 'Combine your breath assessment with urgency, comfort, and communication.',
    prerequisites: [
      'controls-and-goals',
      'lung-protection',
      'oxygenation-response',
      'ventilation-and-co2',
      'waveform-reading-sequence',
      'dyssynchrony-mechanisms',
    ],
    recallUnit: 'oxygenation-response',
    spine: 'whole',
    analogy: 'An alarm is a doorbell: acknowledging it does not deal with the reason it rang.',
    explanation:
      'Assess the patient, airway, and circuit promptly. When the patient is unstable, summon help and support oxygenation and ventilation while the cause is localized according to local emergency protocols. Acknowledgment, documentation, and communication do not themselves correct physiology.',
    checklist: [
      'Judge stability at the bedside.',
      'Assess patient, airway, and circuit.',
      'Coordinate support and cause-directed action.',
      'Name and perform the reassessment.',
    ],
    example: {
      situation:
        'A high-pressure alarm accompanies falling blood pressure and new asymmetric breath sounds.',
      reasoning: [
        'The patient is deteriorating, so stabilization and help take priority.',
        'The examination changes the differential.',
        'Do not wait for a perfect waveform analysis before responding to instability.',
      ],
      conclusion: 'Use the signals to support urgent bedside care, not to postpone it.',
    },
    boundary:
      'Emergency procedures and manual ventilation require trained supervision and the current local protocol. This online activity cannot establish those hands-on skills.',
    evidenceIds: ['tobin-3e-fighting-ventilator', 'aarc-assessment-2024'],
    caseIds: ['MV-13', 'MV-14', 'MV-15'],
    visual: 'existing',
  },
  {
    id: 'high-peak-pressure-integration',
    title: 'One alarm, different patients',
    shortTitle: 'Put it together',
    stage: 'integration',
    minutes: 10,
    objective: 'safety',
    outcome: 'Justify a mechanism and priority from the complete patient and waveform pattern.',
    why: 'The next patient’s high-pressure alarm may have a different cause from the one you just solved.',
    increment: 'No new mechanism: combine pressure, emptying, effort, gas exchange, and urgency.',
    prerequisites: [
      'mechanics-load-and-pressure',
      'lung-protection',
      'expiration-and-air-trapping',
      'triggering-and-cycling',
      'oxygenation-response',
      'ventilation-and-co2',
      'waveform-reading-sequence',
      'dyssynchrony-mechanisms',
      'safety-reassessment-and-human-factors',
    ],
    recallUnit: 'expiration-and-air-trapping',
    spine: 'whole',
    analogy:
      'The same warning light can have different causes. The pattern around it tells you where to look.',
    explanation:
      'Use the patient’s stability first, then valid pressure comparisons, expiratory flow, and effort. Ask which finding supports your explanation and which competing explanation remains. Reassess after an action using the same discriminating signals.',
    checklist: [
      'Assess stability.',
      'Validate and compare the pressure components.',
      'Read emptying and effort.',
      'Name the mechanism, uncertainty, and reassessment.',
    ],
    example: {
      situation:
        'Two passive patients have a similar peak-pressure rise. One has a stable plateau; the other has rising plateau and incomplete expiration.',
      reasoning: [
        'The first pattern supports added resistance at matched settings.',
        'The second requires evaluation of trapped pressure and elastic load.',
        'The same peak does not establish the same mechanism.',
      ],
      conclusion: 'Transfer the reading sequence, not the previous answer.',
    },
    boundary:
      constructed +
      ' Several mechanisms can coexist; no single waveform rules out every competing cause.',
    evidenceIds: ['tobin-3e-monitoring', 'tobin-3e-copd', 'tobin-3e-fighting-ventilator'],
    caseIds: ['MV-13', 'MV-05', 'MV-14', 'MV-06'],
    visual: 'existing',
  },
]

export const ventilationUnitById = new Map(ventilationLearningUnits.map((unit) => [unit.id, unit]))
export const ventilationCourseMinutes = ventilationLearningUnits.reduce(
  (total, unit) => total + unit.minutes,
  0,
)
export const ventilationUnitHref = (id: string) =>
  `/mechanical-ventilation/learn?activity=${encodeURIComponent(id)}`

/** A single table is introduced progressively and reused at debrief; never rendered during checks. */
export const ventilationDecisionTable = [
  {
    id: 'resistance',
    unitId: 'mechanics-load-and-pressure',
    signal: 'Peak rises; valid plateau changes little at matched flow and volume',
    location: 'Flow resistance',
    check: 'Patient, tube, circuit, and airways',
  },
  {
    id: 'elastic',
    unitId: 'mechanics-load-and-pressure',
    signal: 'Valid plateau rises for the same volume and total PEEP',
    location: 'Elastic load',
    check: 'Lung, chest wall, and clinical context',
  },
  {
    id: 'emptying',
    unitId: 'expiration-and-air-trapping',
    signal: 'Expiratory flow persists into the next breath',
    location: 'Incomplete emptying',
    check: 'Expiration time, airway load, total PEEP, and circulation',
  },
  {
    id: 'timing',
    unitId: 'triggering-and-cycling',
    signal: 'Patient effort and machine inspiration do not align',
    location: 'Patient–ventilator interaction',
    check: 'Start, delivery, end, and amount of support',
  },
  {
    id: 'oxygen',
    unitId: 'oxygenation-response',
    signal: 'Oxygenation changes after support changes',
    location: 'Gas exchange and tolerance',
    check: 'Oxygen concentration, aeration, pressure, and circulation',
  },
  {
    id: 'co2',
    unitId: 'ventilation-and-co2',
    signal: 'CO₂ changes despite acceptable oxygenation',
    location: 'Effective ventilation',
    check: 'Delivered volume, total rate, emptying, dead space, and production',
  },
] as const

/** Alternates mechanisms; the casebook and its scoring remain the authoritative runtime. */
export const ventilationPracticeOrder = [
  'MV-01',
  'MV-07',
  'MV-05',
  'MV-09',
  'MV-13',
  'MV-02',
  'MV-08',
  'MV-10',
  'MV-14',
  'MV-03',
  'MV-11',
  'MV-04',
  'MV-12',
  'MV-15',
  'MV-06',
] as const
