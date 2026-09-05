import type { PredictionControl, ScenarioDefinition, SupportMode } from '../engine/types'
import { ECMO_CONTROL_PANEL, ecmoLearnerCopyErrors, type EcmoControlKnobId } from './controlPanel'
import { validateEvidenceIds } from './evidence'
import { ecmoLearnPredictionFor, type EcmoLearnPrediction } from './learnPredictionItems'
import {
  ecmoLocalizationRowById,
  ecmoLocalizationRows,
  type EcmoDrillFamily,
  type EcmoLocalizationRowId,
} from './localizationCards'
import { cardiohelpCapstonePrerequisiteIdsBySupportMode, cardiohelpScenarioById } from './scenarios'

/**
 * One record per drill, holding the shapes every drill debrief reuses.
 *
 * Three of them are the recurring artifacts the pedagogy standard asks for: the small control
 * panel as a strip with each knob in one state, the diagnostic-grammar row the drill highlights,
 * and the principle carried forward to the next drill. The fourth is a guard: the phrases a
 * pre-commit surface for this drill may not carry, because they are the answer.
 *
 * The knob strip is *derived* from the scenario's expectation and the authored prediction item,
 * and the authored strip is held equal to the derivation at import. Authoring it anyway — rather
 * than only deriving it — is what lets a reviewer read the strip beside its sentence and lets a
 * scenario edit that silently changes the strip fail here, with the drill's name on it, instead of
 * rendering a debrief that disagrees with the drill it follows.
 *
 * Everything on a record is post-commit. A strip names the knob and the move; a transfer principle
 * names the mechanism; showing either beside an uncommitted prediction would answer the question
 * the drill is asking.
 */

export type EcmoKnobState = 'this-knob' | 'not-this-knob' | 'harmful-reflex' | 'not-a-control'
export type EcmoKnobVerdict = 'this-knob' | 'no-knob-find-the-cause' | 'no-knob-isolate-first'
export type EcmoClampState = 'emergency-only' | 'this-emergency'
export type EcmoKnobDirection = 'increase' | 'decrease' | 'hold'

export interface EcmoKnobStrip {
  readonly verdict: EcmoKnobVerdict
  readonly pumpSpeed: EcmoKnobState
  readonly sweep: EcmoKnobState
  readonly oxygenFraction: EcmoKnobState
  readonly clamps: EcmoClampState
  /** Present exactly when the verdict is `this-knob`. */
  readonly direction?: EcmoKnobDirection
  /** The strip in prose, in the one grammar every drill uses. */
  readonly sentence: string
}

export type EcmoDerivedKnobStrip = Omit<EcmoKnobStrip, 'sentence'>

export interface EcmoDrillSpec {
  readonly scenarioId: string
  /** Present exactly for the four pressure/gas families the diagnostic grammar has a row for. */
  readonly localizationRowId?: EcmoLocalizationRowId
  readonly controlPanel: EcmoKnobStrip
  /** One sentence naming the principle carried forward — never the next drill's fault. */
  readonly transferPrinciple: string
  /** Phrases that name this drill's answer. No pre-commit surface for the drill may carry one. */
  readonly precommitDenyPatterns: readonly RegExp[]
  /** Drawn from the scenario's own evidence or the control panel's, never from elsewhere. */
  readonly sourceIds: readonly string[]
  /** Stated as a field rather than left to each consumer to remember. */
  readonly precommitVisibility: 'never'
}

/*
 * How a prediction control maps onto the panel.
 *
 * Three controls are knobs. Everything else a learner can commit to — inspecting, assessing,
 * restoring a source, resolving a cause — is not a setting, and the strip says so.
 */
const KNOB_BY_CONTROL: Readonly<Partial<Record<PredictionControl, EcmoControlKnobId>>> = {
  rpm: 'pump-speed',
  sweep: 'sweep',
  'gas-fio2': 'oxygen-fraction',
}

const FIND_THE_CAUSE_CONTROLS: readonly PredictionControl[] = [
  'inspect-circuit',
  'assess-upper-body',
  'assess-lv-loading',
  'restore-gas',
  'restore-power',
  'correct-cause',
]

/**
 * The drill family the grammar knows this scenario by, or null where the grammar has no row.
 *
 * The scenario registry files both the return-side and the membrane drill under `afterload`; the
 * grammar tells them apart, so the corrective fault decides between them.
 */
export function ecmoDrillFamilyForScenario(scenario: ScenarioDefinition): EcmoDrillFamily | null {
  const fault = scenario.expectation.correctiveFault
  switch (scenario.family) {
    case 'preload':
      return 'preload'
    case 'afterload':
      if (fault === 'return-obstruction') return 'return-obstruction'
      if (fault === 'oxygenator-resistance') return 'oxygenator-resistance'
      throw new Error(
        `${scenario.id}: an afterload drill corrects ${fault}, which no grammar row owns`,
      )
    case 'gas-source':
      return 'gas-source-interruption'
    default:
      return null
  }
}

export function ecmoLocalizationRowIdForFamily(family: EcmoDrillFamily): EcmoLocalizationRowId {
  const row = ecmoLocalizationRows.find((candidate) => candidate.drillFamily === family)
  if (!row) throw new Error(`No localization row owns the ${family} drill family`)
  return row.id
}

/**
 * The knob strip a scenario and its prediction item imply, with no authored input.
 *
 * `this-knob` is the knob the expectation names, with the expectation's direction. The harmful
 * reflex is whichever knob the item's `unsafe` choice commits to — a knob the expectation already
 * names keeps `this-knob`, because a strip cannot say both of one knob, and the reflex in that
 * case is the wrong *direction* of the right knob rather than the wrong knob. In the bubble family
 * the intervention has latched the pump stopped, and the reducer holds it there whatever the speed
 * setting says, so pump speed is `not-a-control` rather than merely not this setting.
 */
export function deriveKnobStrip(
  scenario: ScenarioDefinition,
  prediction: EcmoLearnPrediction,
): EcmoDerivedKnobStrip {
  const control = scenario.expectation.control
  const thisKnob = KNOB_BY_CONTROL[control] ?? null
  const isBubble = scenario.family === 'bubble'

  let verdict: EcmoKnobVerdict
  if (isBubble) verdict = 'no-knob-isolate-first'
  else if (thisKnob) verdict = 'this-knob'
  else if (FIND_THE_CAUSE_CONTROLS.includes(control)) verdict = 'no-knob-find-the-cause'
  else throw new Error(`${scenario.id}: no knob-strip verdict is defined for control ${control}`)

  const harmful = new Set<EcmoControlKnobId>()
  for (const choice of prediction.item.choices) {
    if (choice.plausibility !== 'unsafe') continue
    const commitment = prediction.commitments[choice.id]
    const knob = commitment ? KNOB_BY_CONTROL[commitment.control] : undefined
    if (knob) harmful.add(knob)
  }

  const stateOf = (knob: EcmoControlKnobId): EcmoKnobState => {
    if (thisKnob === knob) return 'this-knob'
    if (isBubble && knob === 'pump-speed') return 'not-a-control'
    if (harmful.has(knob)) return 'harmful-reflex'
    return 'not-this-knob'
  }

  const strip: EcmoDerivedKnobStrip = {
    verdict,
    pumpSpeed: stateOf('pump-speed'),
    sweep: stateOf('sweep'),
    oxygenFraction: stateOf('oxygen-fraction'),
    clamps: isBubble ? 'this-emergency' : 'emergency-only',
  }
  if (!thisKnob) return strip

  const direction = scenario.expectation.direction
  if (direction !== 'increase' && direction !== 'decrease' && direction !== 'hold') {
    throw new Error(`${scenario.id}: a knob cannot be moved in the direction ${direction}`)
  }
  return { ...strip, direction }
}

/*
 * The deny patterns, one set per family, shared by both tracks.
 *
 * Every pattern is a phrase that names the answer. They are held, at import, to two facts: for
 * the four families the grammar has a row for, the pattern matches the scenario's own diagnosis —
 * proof it denies the thing it is meant to deny — and no pattern matches the drill's prediction
 * stem, the one pre-commit surface that exists today.
 */
const DENY = {
  orientation: [
    /incomplete (?:va )?startup|self[- ]test (?:is not|does not|doesn[’']t|cannot|can[’']t)|tip[- ]to[- ]tip|whole (?:extracorporeal )?circuit/i,
  ],
  preload: [/drainage (collapse|limit)|preload|cannula collapse/i],
  return: [
    /return[- ](side|path)|downstream (of the (oxygenator|membrane)|resistance|obstruction)/i,
  ],
  membrane: [/oxygenator (resistance|dysfunction|thrombos)|membrane (fail|resistance)/i],
  recirculation: [/recirculat/i],
  acuteCarbonDioxide: [/\b(increase|raise|turn up)\b[^.]{0,20}\bsweep\b/i],
  compensated: [/compensat|hold (sweep|the setting)/i],
  gas: [/gas[- ]source|interrupt|disconnect/i],
  bubble: [/cause[- ]before[- ]reset|isolat/i],
  transport: [/backup readiness|restore (verified )?(ac|power)/i],
  differential: [/differential|watershed|mixing|north.south|harlequin/i],
  leftVentricle: [/lv[- ]loading|distension|unload/i],
} as const satisfies Readonly<Record<string, readonly RegExp[]>>

const MODEL = 'bounded-educational-model'

function spec(definition: Omit<EcmoDrillSpec, 'precommitVisibility'>): EcmoDrillSpec {
  return { ...definition, precommitVisibility: 'never' }
}

const authored: readonly EcmoDrillSpec[] = [
  // ── VV ────────────────────────────────────────────────────────────────────────────────────────
  spec({
    scenarioId: 'startup-sensor-orientation',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and starting the pump before the circuit has been walked is the reflex to resist. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a startup: the diagnostic covers the device, and the circuit, the sensors, the gas and the power are walked by hand.',
    },
    transferPrinciple:
      'A diagnostic that finishes tells you about the device; what it cannot see, you establish by hand before you trust a reading.',
    precommitDenyPatterns: DENY.orientation,
    sourceIds: ['ifu-console-workflow', 'ecmo-book-ch9'],
  }),
  spec({
    scenarioId: 'preload-drainage-collapse',
    localizationRowId: 'drainage-limitation',
    controlPanel: {
      verdict: 'this-knob',
      pumpSpeed: 'this-knob',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      direction: 'decrease',
      sentence:
        'Pump speed — this is the setting, and it goes down, as a holding move. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. Then find the cause: it is not on the panel.',
    },
    transferPrinciple:
      'Speed is a setting and flow is a result; when flow stops following speed, the limit is somewhere on the path, and the setting is not the fix.',
    precommitDenyPatterns: DENY.preload,
    sourceIds: ['ecmo-book-ch9', 'ecmo-book-ch17', MODEL],
  }),
  spec({
    scenarioId: 'afterload-return-obstruction',
    localizationRowId: 'return-path-resistance',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and driving it harder against the load is the reflex to resist. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a load: find it on the return path, from the membrane outlet to the cannula.',
    },
    transferPrinciple:
      'A load downstream raises everything upstream of it, so both post-pump pressures move together when the load sits beyond the membrane.',
    precommitDenyPatterns: DENY.return,
    sourceIds: ['ecmo-book-ch9', 'ecmo-book-ch17', MODEL],
  }),
  spec({
    scenarioId: 'afterload-oxygenator-resistance',
    localizationRowId: 'membrane-resistance',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and driving it harder through the membrane is the reflex to resist. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a widening gradient: trend it at similar flow, corroborate it with what the membrane returns, and escalate through the pathway your unit uses.',
    },
    transferPrinciple:
      'A gradient is a resistance multiplied by a flow, so it is read against this circuit’s own earlier value at similar flow, never against a carried number.',
    precommitDenyPatterns: DENY.membrane,
    sourceIds: ['ifu-anomaly-boundary', 'ecmo-book-ch9', 'elso-circuit-2022', MODEL],
  }),
  spec({
    scenarioId: 'vv-recirculation',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and asking for more flow is the reflex to resist, because it recruits more of the blood just returned. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers recirculation: the cause is where the returned blood goes, at the cannulas.',
    },
    transferPrinciple:
      'Circuit flow and effective flow are different quantities, and the drainage-line saturation is what tells them apart.',
    precommitDenyPatterns: DENY.recirculation,
    sourceIds: ['ecmo-book-ch17', 'elso-adult-vv-2021', MODEL],
  }),
  spec({
    scenarioId: 'acute-hypercapnia',
    controlPanel: {
      verdict: 'this-knob',
      pumpSpeed: 'not-this-knob',
      sweep: 'this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      direction: 'increase',
      sentence:
        'Pump speed — not this setting. Sweep — this is the setting, and it goes up, in a small step. Oxygen fraction — not this setting. Clamps — not for this. Then let the response appear, and reassess the gas and the patient before the next step.',
    },
    transferPrinciple:
      'One control for one axis, moved in bounded steps and reassessed, because the response is neither instant nor linear.',
    precommitDenyPatterns: DENY.acuteCarbonDioxide,
    sourceIds: ['ecmo-book-ch16', 'ecmo-book-ch18', MODEL],
  }),
  spec({
    scenarioId: 'compensated-hypercapnia',
    controlPanel: {
      verdict: 'this-knob',
      pumpSpeed: 'not-this-knob',
      sweep: 'this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      direction: 'hold',
      sentence:
        'Pump speed — not this setting. Sweep — this is the setting, and it stays where it is. Oxygen fraction — not this setting. Clamps — not for this. A settled state is left settled; the number on its own is not the goal.',
    },
    transferPrinciple:
      'An abnormal number in a settled state is a reason to read the whole picture, not a reason to change a setting.',
    precommitDenyPatterns: DENY.compensated,
    sourceIds: ['ecmo-book-ch18', MODEL],
  }),
  spec({
    scenarioId: 'gas-source-interruption',
    localizationRowId: 'gas-path-failure',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and raising it because less oxygenated blood is reaching the patient is the reflex to resist. Sweep — not this setting: the setting is a request, and the request is still displayed. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a gas path: trace it from the source to the membrane and re-establish delivery you have confirmed.',
    },
    transferPrinciple:
      'Unchanged pressures with worsening gas values point away from the blood path; a setting is a request, and delivery is confirmed separately.',
    precommitDenyPatterns: DENY.gas,
    sourceIds: ['ecmo-book-ch9', 'ecmo-book-ch18', 'elso-circuit-2022', MODEL],
  }),
  spec({
    scenarioId: 'arterial-bubble-stop',
    controlPanel: {
      verdict: 'no-knob-isolate-first',
      pumpSpeed: 'not-a-control',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'this-emergency',
      sentence:
        'Pump speed — not a control while the intervention holds the pump stopped. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — this is what they are for: isolate the patient, return limb then drainage limb, near the patient. Then find and clear the air source; how support is resumed belongs to the current IFU and your unit’s air-emergency protocol.',
    },
    transferPrinciple:
      'A device’s stop, the patient’s isolation, the air source and the restart are four separate acts, and the first does not accomplish the second.',
    precommitDenyPatterns: DENY.bubble,
    sourceIds: ['ifu-console-workflow', 'ifu-anomaly-boundary', 'elso-circuit-2022'],
  }),
  spec({
    scenarioId: 'transport-power-loss',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and lowering it to stretch the reserve is the reflex to resist. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a power loss: put the console on a source you have confirmed live, with the backup within reach.',
    },
    transferPrinciple:
      'Reserve power buys time and nothing else; securing support means a confirmed source, not a slower pump.',
    precommitDenyPatterns: DENY.transport,
    sourceIds: ['ifu-console-workflow', 'ecmo-book-ch9', 'elso-circuit-2022'],
  }),
  // ── VA ────────────────────────────────────────────────────────────────────────────────────────
  spec({
    scenarioId: 'va-startup-sensor-orientation',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and starting the pump on shared hardware before its destinations have been confirmed is the reflex to resist. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a startup: the console cannot tell a vein from an artery, so the return, the right-arm monitor and the cannulated limb are established by hand.',
    },
    transferPrinciple:
      'Shared hardware does not know its destinations; on VA the console cannot show the vein from the artery, the upper body or the limb, so those are established by hand.',
    precommitDenyPatterns: DENY.orientation,
    sourceIds: ['ifu-console-workflow', 'ecmo-book-ch9', 'elso-adult-va-2021', MODEL],
  }),
  spec({
    scenarioId: 'va-preload-drainage-collapse',
    localizationRowId: 'drainage-limitation',
    controlPanel: {
      verdict: 'this-knob',
      pumpSpeed: 'this-knob',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      direction: 'decrease',
      sentence:
        'Pump speed — this is the setting, and it goes down, as a holding move. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. Then find the cause: it is not on the panel, and the endpoint is the patient’s perfusion rather than the flow display.',
    },
    transferPrinciple:
      'On VA, circuit flow is one contributor to systemic perfusion, so a holding move is judged at the patient, not on the flow display.',
    precommitDenyPatterns: DENY.preload,
    sourceIds: ['ecmo-book-ch9', 'ecmo-book-ch17', 'elso-adult-va-2021', MODEL],
  }),
  spec({
    scenarioId: 'va-afterload-arterial-return-obstruction',
    localizationRowId: 'return-path-resistance',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and driving it harder against the load is the reflex to resist. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a load: find it on the arterial return path, reading the patient’s own arterial pressure from its own monitor beside the circuit pressures.',
    },
    transferPrinciple:
      'The circuit’s return pressure is not the patient’s arterial pressure; the independent monitor sits beside the circuit pressures and is read with them.',
    precommitDenyPatterns: DENY.return,
    sourceIds: ['ecmo-book-ch9', 'ecmo-book-ch17', 'elso-adult-va-2021', MODEL],
  }),
  spec({
    scenarioId: 'va-afterload-oxygenator-resistance',
    localizationRowId: 'membrane-resistance',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and driving it harder through the membrane is the reflex to resist, and on VA it also raises what the left ventricle ejects against. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a widening gradient: trend it at similar flow, then reassess the territories the circuit supplies, because the gradient says nothing about the patient’s pressure.',
    },
    transferPrinciple:
      'A widening gradient belongs to the membrane and says nothing about the patient’s pressure or the territories the circuit supplies.',
    precommitDenyPatterns: DENY.membrane,
    sourceIds: ['ifu-anomaly-boundary', 'ecmo-book-ch9', 'elso-circuit-2022', MODEL],
  }),
  spec({
    scenarioId: 'va-differential-hypoxemia',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and raising it to lift the right-hand number is the reflex to resist, because it loads a ventricle that is still ejecting. Sweep — not this setting. Oxygen fraction — not this setting: what leaves the membrane is already well saturated, and the problem is where it goes. Clamps — not for this. No setting answers a mixing point: sample the right arm, read the two circulations against each other, and escalate the support strategy.',
    },
    transferPrinciple:
      'The sampling site is part of the measurement: each arterial site reports its own territory, and one reassuring number describes one place.',
    precommitDenyPatterns: DENY.differential,
    sourceIds: ['elso-adult-va-2021', 'elso-neuro-monitoring-2024', MODEL],
  }),
  spec({
    scenarioId: 'va-lv-loading',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and raising it is the reflex to resist, because it adds to the pressure a ventricle that is barely ejecting has to open against. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers loading: read the pulse pressure, the valve and the lungs, and escalate for unloading evaluation.',
    },
    transferPrinciple:
      'An acceptable flow and mean pressure do not establish ejection; pulsatility, the valve and the lungs do.',
    precommitDenyPatterns: DENY.leftVentricle,
    sourceIds: ['elso-adult-va-2021', MODEL],
  }),
  spec({
    scenarioId: 'va-acute-hypercapnia',
    controlPanel: {
      verdict: 'this-knob',
      pumpSpeed: 'not-this-knob',
      sweep: 'this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      direction: 'increase',
      sentence:
        'Pump speed — not this setting. Sweep — this is the setting, and it goes up, in a small step. Oxygen fraction — not this setting. Clamps — not for this. Then reassess the gas, the right arm and the circulation; the VA checks do not stop because a knob was turned.',
    },
    transferPrinciple:
      'The gas control answers the gas axis and nothing else; on VA the circulation, the upper body and the lungs are reassessed regardless.',
    precommitDenyPatterns: DENY.acuteCarbonDioxide,
    sourceIds: ['ecmo-book-ch16', 'ecmo-book-ch18', 'elso-adult-va-2021', MODEL],
  }),
  spec({
    scenarioId: 'va-gas-source-interruption',
    localizationRowId: 'gas-path-failure',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and raising it is the reflex to resist, because it sends the artery more of the blood the membrane is no longer oxygenating. Sweep — not this setting: the setting is a request, and the request is still displayed. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a gas path: trace it from the source to the membrane, re-establish delivery you have confirmed, and sample the upper body.',
    },
    transferPrinciple:
      'Ongoing arterial flow is not oxygenated flow; when the gas path fails, what the circuit returns is sampled, not assumed.',
    precommitDenyPatterns: DENY.gas,
    sourceIds: ['ecmo-book-ch9', 'ecmo-book-ch18', 'elso-circuit-2022', 'elso-adult-va-2021'],
  }),
  spec({
    scenarioId: 'va-arterial-bubble-stop',
    controlPanel: {
      verdict: 'no-knob-isolate-first',
      pumpSpeed: 'not-a-control',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'this-emergency',
      sentence:
        'Pump speed — not a control while the intervention holds the pump stopped. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — this is what they are for: isolate the patient, arterial return limb then drainage limb, near the patient, while the circulation carries on without the circuit’s share. Then find and clear the air source; how support is resumed belongs to the current IFU and your unit’s air-emergency protocol.',
    },
    transferPrinciple:
      'A pump stop halts the circuit’s share of the circulation without isolating the artery, so isolation is a deliberate act and what is lost meanwhile is named.',
    precommitDenyPatterns: DENY.bubble,
    sourceIds: [
      'ifu-console-workflow',
      'ifu-anomaly-boundary',
      'elso-circuit-2022',
      'elso-adult-va-2021',
    ],
  }),
  spec({
    scenarioId: 'va-transport-power-loss',
    controlPanel: {
      verdict: 'no-knob-find-the-cause',
      pumpSpeed: 'harmful-reflex',
      sweep: 'not-this-knob',
      oxygenFraction: 'not-this-knob',
      clamps: 'emergency-only',
      sentence:
        'Pump speed — not this setting, and lowering it to stretch the reserve is the reflex to resist, because it trades circulation for run time. Sweep — not this setting. Oxygen fraction — not this setting. Clamps — not for this. No setting answers a power loss: put the console on a source you have confirmed live, with the backup within reach, and confirm the circulation paid nothing for the changeover.',
    },
    transferPrinciple:
      'Trading flow for reserve trades circulation; a confirmed source secures support without spending what the move exists to protect.',
    precommitDenyPatterns: DENY.transport,
    sourceIds: ['ifu-console-workflow', 'ecmo-book-ch9', 'elso-circuit-2022', 'elso-adult-va-2021'],
  }),
]

export const ecmoDrillSpecs: Readonly<Record<string, EcmoDrillSpec>> = Object.freeze(
  Object.fromEntries(authored.map((definition) => [definition.scenarioId, definition])),
)

export function ecmoDrillSpec(scenarioId: string): EcmoDrillSpec {
  const definition = ecmoDrillSpecs[scenarioId]
  if (!definition) throw new Error(`Unknown ECMO drill spec: ${scenarioId}`)
  return definition
}

/** The specs of one track, in the order the capstone prerequisites list them. */
export function ecmoDrillSpecsForSupportMode(supportMode: SupportMode): readonly EcmoDrillSpec[] {
  return cardiohelpCapstonePrerequisiteIdsBySupportMode[supportMode].map(ecmoDrillSpec)
}

/*
 * The strip's grammar, so a sentence cannot drift from the states beside it.
 *
 * Every sentence walks the panel in the same order with the same labels, and each clause opens
 * with the words its state owns. The harmful-reflex clause names the reflex; the plain
 * not-this-knob clause may not, or the two states become indistinguishable in prose.
 */
const STRIP_LABELS = [
  { key: 'pumpSpeed', label: 'Pump speed — ' },
  { key: 'sweep', label: 'Sweep — ' },
  { key: 'oxygenFraction', label: 'Oxygen fraction — ' },
  { key: 'clamps', label: 'Clamps — ' },
] as const

type StripClauseKey = (typeof STRIP_LABELS)[number]['key']

export function ecmoKnobStripClauses(
  sentence: string,
): Readonly<Record<StripClauseKey, string>> | null {
  const positions = STRIP_LABELS.map(({ label }) => sentence.indexOf(label))
  if (positions[0] !== 0) return null
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index] <= positions[index - 1]) return null
  }
  const clauses = {} as Record<StripClauseKey, string>
  STRIP_LABELS.forEach(({ key, label }, index) => {
    const start = positions[index] + label.length
    const end = index + 1 < positions.length ? positions[index + 1] : sentence.length
    clauses[key] = sentence.slice(start, end).trim()
  })
  return clauses
}

const KNOB_STATE_OPENING: Readonly<Record<EcmoKnobState, RegExp>> = {
  'this-knob': /^this is the setting\b/,
  'not-this-knob': /^not this setting\b/,
  'harmful-reflex': /^not this setting\b/,
  'not-a-control': /^not a control\b/,
}

const CLAMP_OPENING: Readonly<Record<EcmoClampState, RegExp>> = {
  'emergency-only': /^not for this\b/,
  'this-emergency': /^this is what they are for\b/,
}

const DIRECTION_WORDING: Readonly<Record<EcmoKnobDirection, RegExp>> = {
  increase: /\bgoes up\b/,
  decrease: /\bgoes down\b/,
  hold: /\bstays where it is\b/,
}

function knobStripSentenceErrors(scenarioId: string, strip: EcmoKnobStrip): readonly string[] {
  const errors: string[] = []
  const clauses = ecmoKnobStripClauses(strip.sentence)
  if (!clauses) {
    return [`${scenarioId}: the strip sentence does not walk the panel in order`]
  }

  const knobs: readonly { key: 'pumpSpeed' | 'sweep' | 'oxygenFraction'; state: EcmoKnobState }[] =
    [
      { key: 'pumpSpeed', state: strip.pumpSpeed },
      { key: 'sweep', state: strip.sweep },
      { key: 'oxygenFraction', state: strip.oxygenFraction },
    ]
  for (const { key, state } of knobs) {
    const clause = clauses[key]
    if (!KNOB_STATE_OPENING[state].test(clause)) {
      errors.push(`${scenarioId}: the ${key} clause does not open the way ${state} is written`)
    }
    const namesReflex = /\breflex\b/i.test(clause)
    if (state === 'harmful-reflex' && !namesReflex) {
      errors.push(
        `${scenarioId}: the ${key} clause is the harmful reflex but does not name a reflex`,
      )
    }
    if (state === 'not-this-knob' && namesReflex) {
      errors.push(`${scenarioId}: the ${key} clause names a reflex the strip does not declare`)
    }
    if (
      state === 'this-knob' &&
      strip.direction &&
      !DIRECTION_WORDING[strip.direction].test(clause)
    ) {
      errors.push(`${scenarioId}: the ${key} clause does not say the knob goes ${strip.direction}`)
    }
  }

  if (!CLAMP_OPENING[strip.clamps].test(clauses.clamps)) {
    errors.push(`${scenarioId}: the clamps clause does not open the way ${strip.clamps} is written`)
  }

  const findsTheCause = /\bNo setting answers\b/.test(strip.sentence)
  if (strip.verdict === 'no-knob-find-the-cause' && !findsTheCause) {
    errors.push(`${scenarioId}: a find-the-cause verdict must say that no setting answers it`)
  }
  if (strip.verdict === 'this-knob' && findsTheCause) {
    errors.push(`${scenarioId}: a this-knob verdict cannot say that no setting answers it`)
  }
  if (strip.verdict === 'no-knob-isolate-first' && !/\bisolate\b/i.test(strip.sentence)) {
    errors.push(`${scenarioId}: an isolate-first verdict must say to isolate`)
  }
  return errors
}

function sentenceCount(value: string): number {
  return value.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0).length
}

function faultKey(scenario: ScenarioDefinition): string {
  return `${scenario.family}:${scenario.expectation.correctiveFault}`
}

export function validateEcmoDrillSpecs(
  specs: Readonly<Record<string, EcmoDrillSpec>> = ecmoDrillSpecs,
): readonly string[] {
  const errors: string[] = []
  const expectedIds = [
    ...cardiohelpCapstonePrerequisiteIdsBySupportMode.vv,
    ...cardiohelpCapstonePrerequisiteIdsBySupportMode.va,
  ]
  const declaredIds = Object.keys(specs)

  for (const id of expectedIds) {
    if (!(id in specs)) errors.push(`${id}: drill has no spec`)
  }
  for (const id of declaredIds) {
    if (!expectedIds.includes(id)) errors.push(`${id}: spec for something that is not a drill`)
  }

  const resolved = declaredIds.flatMap((id) => {
    const definition = specs[id]
    if (!definition) return []
    if (definition.scenarioId !== id) errors.push(`${id}: keyed under a different scenario id`)
    const scenario = cardiohelpScenarioById.get(definition.scenarioId)
    if (!scenario) {
      errors.push(`${id}: unknown scenario`)
      return []
    }
    const prediction = ecmoLearnPredictionFor(definition.scenarioId)
    if (!prediction) {
      errors.push(`${id}: no authored prediction item`)
      return []
    }
    return [{ definition, scenario, prediction }]
  })

  for (const { definition, scenario, prediction } of resolved) {
    const id = definition.scenarioId
    if (scenario.family === 'capstone') errors.push(`${id}: capstones carry no drill strip`)

    // The authored strip is the derived strip, field for field, or the debrief disagrees with
    // the drill it follows.
    const derived = deriveKnobStrip(scenario, prediction)
    const authoredStrip: EcmoDerivedKnobStrip = {
      verdict: definition.controlPanel.verdict,
      pumpSpeed: definition.controlPanel.pumpSpeed,
      sweep: definition.controlPanel.sweep,
      oxygenFraction: definition.controlPanel.oxygenFraction,
      clamps: definition.controlPanel.clamps,
      ...(definition.controlPanel.direction
        ? { direction: definition.controlPanel.direction }
        : {}),
    }
    for (const key of [
      'verdict',
      'pumpSpeed',
      'sweep',
      'oxygenFraction',
      'clamps',
      'direction',
    ] as const) {
      if (authoredStrip[key] !== derived[key]) {
        errors.push(
          `${id}: ${key} is authored as ${String(authoredStrip[key])} but derives as ${String(derived[key])}`,
        )
      }
    }

    // The grammar row: present exactly where the grammar has one, and the right one.
    const family = ecmoDrillFamilyForScenario(scenario)
    if (family === null && definition.localizationRowId !== undefined) {
      errors.push(`${id}: names a localization row, but the grammar has no row for this family`)
    }
    if (family !== null) {
      if (definition.localizationRowId === undefined) {
        errors.push(
          `${id}: the grammar has a row for the ${family} family, and the spec names none`,
        )
      } else {
        const row = ecmoLocalizationRowById.get(definition.localizationRowId)
        if (!row) errors.push(`${id}: unknown localization row ${definition.localizationRowId}`)
        else if (row.drillFamily !== family) {
          errors.push(`${id}: row ${row.id} belongs to ${row.drillFamily}, not ${family}`)
        }
        if (definition.localizationRowId !== ecmoLocalizationRowIdForFamily(family)) {
          errors.push(`${id}: names a row other than the one the ${family} family owns`)
        }
      }
    }

    errors.push(...ecmoLearnerCopyErrors(`${id}.sentence`, definition.controlPanel.sentence))
    errors.push(...knobStripSentenceErrors(id, definition.controlPanel))

    errors.push(...ecmoLearnerCopyErrors(`${id}.transferPrinciple`, definition.transferPrinciple))
    if (sentenceCount(definition.transferPrinciple) !== 1) {
      errors.push(`${id}: the transfer principle is one sentence`)
    }

    if (definition.precommitDenyPatterns.length === 0) errors.push(`${id}: no deny patterns`)
    for (const pattern of definition.precommitDenyPatterns) {
      if (!(pattern instanceof RegExp)) {
        errors.push(`${id}: a deny pattern is not a regular expression`)
        continue
      }
      if (!pattern.flags.includes('i'))
        errors.push(`${id}: deny pattern ${pattern} is case-sensitive`)
      if (pattern.global)
        errors.push(`${id}: deny pattern ${pattern} is global, so its matching is stateful`)
      if (pattern.test(prediction.item.stem)) {
        errors.push(`${id}: deny pattern ${pattern} matches the drill's own prediction stem`)
      }
    }
    if (
      family !== null &&
      !definition.precommitDenyPatterns.some((pattern) => pattern.test(scenario.debrief.diagnosis))
    ) {
      errors.push(`${id}: no deny pattern matches the diagnosis "${scenario.debrief.diagnosis}"`)
    }

    if (definition.sourceIds.length === 0) errors.push(`${id}: no sources`)
    if (!validateEvidenceIds(definition.sourceIds)) {
      errors.push(`${id}: names a source that is not registered`)
    }
    for (const sourceId of definition.sourceIds) {
      if (
        !scenario.evidenceIds.includes(sourceId) &&
        !(ECMO_CONTROL_PANEL.sourceIds as readonly string[]).includes(sourceId)
      ) {
        errors.push(
          `${id}: cites ${sourceId}, which neither the scenario nor the panel established`,
        )
      }
    }

    if (definition.precommitVisibility !== 'never') {
      errors.push(`${id}: a drill spec is never shown before the prediction is committed`)
    }
  }

  // A transfer principle carries a principle forward; it may not name another drill's fault.
  for (const { definition, scenario } of resolved) {
    for (const other of resolved) {
      if (faultKey(other.scenario) === faultKey(scenario)) continue
      for (const pattern of other.definition.precommitDenyPatterns) {
        if (pattern.test(definition.transferPrinciple)) {
          errors.push(
            `${definition.scenarioId}: the transfer principle names the ${other.definition.scenarioId} fault (${pattern})`,
          )
        }
      }
    }
  }

  return errors
}

const drillSpecErrors = validateEcmoDrillSpecs()
if (drillSpecErrors.length > 0) {
  throw new Error(`Invalid ECMO drill specs:\n- ${drillSpecErrors.join('\n- ')}`)
}
