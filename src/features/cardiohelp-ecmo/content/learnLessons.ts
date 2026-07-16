import type {
  GuidedLessonDefinition,
  GuidedTarget,
  GuidedWalkthroughStep,
  ScenarioDefinition,
  SimulationAction,
  SupportMode,
} from '../engine/types'
import { cardiohelpScenarioById, cardiohelpScenarios, TIP_TO_TIP_CHECK_ID } from './scenarios'

interface ResponseStepInput {
  id: string
  target: GuidedTarget
  title: string
  instruction: string
  rationale: string
  actionLabel: string
  actions: readonly SimulationAction[]
  expectedResponse: readonly string[]
}

interface StandardLessonInput {
  scenarioId: string
  title: string
  learningObjectives: readonly string[]
  observe: {
    target: GuidedTarget
    instruction: string
    rationale: string
    expectedResponse: readonly string[]
  }
  responseSteps: readonly ResponseStepInput[]
  reassessment: {
    target: GuidedTarget
    instruction: string
    expectedResponse: readonly string[]
  }
}

function requireScenario(scenarioId: string): ScenarioDefinition {
  const scenario = cardiohelpScenarioById.get(scenarioId)
  if (!scenario) throw new Error(`Missing CARDIOHELP scenario for guided lesson: ${scenarioId}`)
  return scenario
}

function step(
  definition: Omit<GuidedWalkthroughStep, 'actions' | 'expectedResponse'> &
    Partial<Pick<GuidedWalkthroughStep, 'actions' | 'expectedResponse'>>,
): GuidedWalkthroughStep {
  return {
    actions: [],
    expectedResponse: [],
    ...definition,
  }
}

function eventActions(scenario: ScenarioDefinition): SimulationAction[] {
  const eventSecond = scenario.timedFaults.reduce(
    (latest, timedFault) => Math.max(latest, timedFault.atSecond),
    0,
  )
  return Array.from({ length: eventSecond }, () => ({ type: 'STEP' as const }))
}

function predictionAction(scenario: ScenarioDefinition): SimulationAction {
  return {
    type: 'COMMIT_PREDICTION',
    goalId: scenario.expectation.goalId,
    control: scenario.expectation.control,
    direction: scenario.expectation.direction,
  }
}

function standardLesson(input: StandardLessonInput): GuidedLessonDefinition {
  const scenario = requireScenario(input.scenarioId)
  const timedActions = eventActions(scenario)
  return {
    id: `learn-${scenario.id}`,
    scenarioId: scenario.id,
    supportMode: scenario.supportMode,
    title: input.title,
    learningObjectives: input.learningObjectives,
    steps: [
      step({
        id: `${scenario.id}-observe`,
        phase: 'observe',
        target: input.observe.target,
        title: 'Read the pattern before touching a control',
        instruction: input.observe.instruction,
        rationale: input.observe.rationale,
        actionLabel: timedActions.length
          ? `Advance ${timedActions.length} simulated seconds to the event`
          : 'Inspect the starting pattern',
        actions: timedActions,
        expectedResponse: input.observe.expectedResponse,
      }),
      step({
        id: `${scenario.id}-interpret`,
        phase: 'interpret',
        target: input.observe.target,
        title: 'Connect the observation to the goal',
        instruction: `The safe goal is “${scenario.debrief.correctWorkflow[0]}” Use ${scenario.expectation.control} and predict ${scenario.expectation.direction}.`,
        rationale: scenario.debrief.causalChain.join(' '),
        actionLabel: 'Commit the guided prediction',
        actions: [predictionAction(scenario)],
        expectedResponse: [
          `Goal: ${scenario.expectation.goalId}`,
          `Control: ${scenario.expectation.control}`,
          `Direction: ${scenario.expectation.direction}`,
        ],
      }),
      ...input.responseSteps.map((response) =>
        step({
          ...response,
          phase: 'respond',
          id: `${scenario.id}-${response.id}`,
        }),
      ),
      step({
        id: `${scenario.id}-reassess`,
        phase: 'reassess',
        target: input.reassessment.target,
        title: 'Let the model respond, then reassess three domains',
        instruction: input.reassessment.instruction,
        rationale:
          'A setpoint change or alarm acknowledgement is not the endpoint. Recheck the device, the circuit or gas path, and the patient response.',
        actionLabel: 'Advance 1 second and inspect the response',
        actions: [{ type: 'STEP' }],
        expectedResponse: input.reassessment.expectedResponse,
      }),
      step({
        id: `${scenario.id}-transfer`,
        phase: 'transfer',
        target: 'patient-monitor',
        title: 'Carry the reasoning into Practice',
        instruction: scenario.debrief.correctWorkflow.join(' '),
        rationale: scenario.debrief.diagnosis,
        actionLabel: 'Finish walkthrough',
        expectedResponse: scenario.debrief.safetyNotes,
      }),
    ],
  }
}

const orientationScenario = requireScenario('startup-sensor-orientation')

const orientationLesson: GuidedLessonDefinition = {
  id: 'learn-startup-sensor-orientation',
  scenarioId: orientationScenario.id,
  supportMode: 'vv',
  title: 'Console, circuit, and external-control orientation',
  learningObjectives: [
    'Separate console data from circuit, gas-path, and patient assessment.',
    'Locate the core screens and physical controls without entering service surfaces.',
    'Complete self-test and a tip-to-tip pre-use inspection before support changes.',
  ],
  steps: [
    step({
      id: 'startup-orient-domains',
      phase: 'observe',
      target: 'circuit',
      title: 'Start with four information domains',
      instruction:
        'Trace drainage → pump → oxygenator → return. Then identify the device console, separate gas blender, and independent patient monitor.',
      rationale:
        'The console reports device and circuit values, but it cannot replace inspection of tubing, gas delivery, cannulas, bedside physiology, or laboratory data.',
      actionLabel: 'I can identify all four domains',
      expectedResponse: [
        'Console',
        'Circuit and sensors',
        'External gas path',
        'Independent patient data',
      ],
    }),
    step({
      id: 'startup-screen-parameters',
      phase: 'orient',
      target: 'console',
      title: 'Open the parameter list',
      instruction:
        'Open Parameter list and locate pVen, pInt, pArt, flow, and the Δp trend. Read them as a pattern rather than isolated numbers.',
      rationale:
        'The three pressure locations help distinguish drainage limitation, return obstruction, and oxygenator resistance.',
      actionLabel: 'Open Parameter list',
      actions: [{ type: 'SET_SCREEN', screen: 'parameters' }],
      expectedResponse: [
        'pVen before the pump',
        'pInt before the oxygenator',
        'pArt after the oxygenator',
      ],
    }),
    step({
      id: 'startup-screen-blood',
      phase: 'orient',
      target: 'console',
      title: 'Review blood parameters',
      instruction:
        'Open Blood parameters and distinguish monitored circuit values from independent patient oxygenation and blood-gas measurements.',
      rationale:
        'Circuit saturation and temperature trends add context, but they are not a substitute for patient assessment.',
      actionLabel: 'Open Blood parameters',
      actions: [{ type: 'SET_SCREEN', screen: 'blood' }],
      expectedResponse: [
        'Circuit blood values are device data',
        'Patient values remain on a separate monitor',
      ],
    }),
    step({
      id: 'startup-screen-transport',
      phase: 'orient',
      target: 'console',
      title: 'Find transport power status',
      instruction:
        'Open Transport and locate AC/battery source, remaining charge, and the need for verified backup readiness.',
      rationale:
        'Power-source recognition is part of transport readiness; an on-screen battery icon is not a complete backup plan.',
      actionLabel: 'Open Transport',
      actions: [{ type: 'SET_SCREEN', screen: 'transport' }],
      expectedResponse: [
        'Current power source',
        'Battery percentage',
        'Backup-console or emergency-drive readiness',
      ],
    }),
    step({
      id: 'startup-screen-interventions',
      phase: 'orient',
      target: 'console',
      title: 'Locate intervention state',
      instruction:
        'Open Interventions and identify pressure and bubble protection state. Do not treat Global Override as routine troubleshooting.',
      rationale:
        'Intervention state changes what the device does when a limit or bubble event occurs; bypassing protection changes risk, not the cause.',
      actionLabel: 'Open Interventions',
      actions: [{ type: 'SET_SCREEN', screen: 'interventions' }],
      expectedResponse: [
        'Pressure protection state',
        'Bubble protection state',
        'Cause correction before reset',
      ],
    }),
    step({
      id: 'startup-screen-timers',
      phase: 'orient',
      target: 'console',
      title: 'Review timers and menu surfaces',
      instruction:
        'Open Timers. Note start/stop/reset behavior, then remember that settings and alarm history are accessible teaching surfaces while service/password surfaces are excluded.',
      rationale:
        'Timers support workflow documentation; they do not diagnose or correct a physiologic or circuit problem.',
      actionLabel: 'Open Timers',
      actions: [{ type: 'SET_SCREEN', screen: 'timers' }],
      expectedResponse: [
        'Three elapsed timers',
        'One countdown timer',
        'Explicit start, stop, and reset',
      ],
    }),
    step({
      id: 'startup-screen-alarm-history',
      phase: 'orient',
      target: 'console',
      title: 'Use alarm history as context',
      instruction:
        'Open the six-item Alarm history. Acknowledgement pauses sound; the underlying cause remains until corrected.',
      rationale:
        'Alarm history helps reconstruct sequence and recurrence, but acknowledgement is not treatment.',
      actionLabel: 'Open Alarm history',
      actions: [{ type: 'SET_SCREEN', screen: 'alarm-history' }],
      expectedResponse: [
        'Priority and text remain visible',
        'Latest six events are retained',
        'Cause correction is separate',
      ],
    }),
    step({
      id: 'startup-physical-controls',
      phase: 'orient',
      target: 'console',
      title: 'Map the physical controls',
      instruction:
        'Return Home and locate RPM/LPM mode, the rotary setpoint control, lock, Safety chord, zero flow, power indicators, and optional alarm audio.',
      rationale:
        'LPM control depends on a valid flow signal. Safety-modified controls require deliberate held interaction, and zero flow is not the same as powering off the pump.',
      actionLabel: 'Return Home and locate the controls',
      actions: [{ type: 'SET_SCREEN', screen: 'startup' }],
      expectedResponse: [
        'RPM/LPM selector',
        'Rotary control',
        'Lock',
        'Safety + zero flow',
        'Power and battery state',
      ],
    }),
    step({
      id: 'startup-external-gas',
      phase: 'orient',
      target: 'gas-panel',
      title: 'Separate sweep and sweep-gas FiO₂ from the console',
      instruction:
        'Locate sweep flow, sweep-gas FiO₂, and source status on the separate gas panel. These are not CARDIOHELP-i touchscreen controls.',
      rationale:
        'Sweep primarily changes membrane CO₂ clearance in this model; sweep-gas FiO₂ changes oxygenator inlet gas concentration.',
      actionLabel: 'I can distinguish the two gas controls',
      expectedResponse: [
        'Sweep flow in L/min',
        'Sweep-gas FiO₂ as a fraction or percent',
        'Gas-source connection state',
      ],
    }),
    step({
      id: 'startup-interpret',
      phase: 'interpret',
      target: 'console',
      title: 'Commit the safe-startup goal',
      instruction:
        'Before operating support, choose a safe startup state, tip-to-tip inspection, and independent patient check.',
      rationale:
        'A passed self-test checks device functions; it does not verify every circuit connection, sensor orientation, gas source, cannula, or backup system.',
      actionLabel: 'Commit the guided startup prediction',
      actions: [predictionAction(orientationScenario)],
      expectedResponse: ['Goal: safe-startup', 'Control: inspect-circuit', 'Direction: inspect'],
    }),
    step({
      id: 'startup-respond',
      phase: 'respond',
      target: 'circuit',
      title: 'Complete startup and the tip-to-tip check',
      instruction:
        'Allow self-test completion, verify the audible indicator and startup screen, then inspect drainage-to-return, sensors, gas, power, and backup readiness.',
      rationale:
        'This creates a verified baseline before later pressure, flow, gas-transfer, or alarm troubleshooting.',
      actionLabel: 'Complete startup + tip-to-tip check',
      actions: [{ type: 'PERFORM_CHECK', checkId: TIP_TO_TIP_CHECK_ID }],
      expectedResponse: [
        'Self-test passed',
        'Circuit inspected',
        'Sensor and gas orientation verified',
      ],
    }),
    step({
      id: 'startup-reassess',
      phase: 'reassess',
      target: 'patient-monitor',
      title: 'Confirm the whole system, not only the screen',
      instruction:
        'Advance the model, then recheck device state, circuit integrity, gas availability, and independent patient data.',
      rationale:
        'A safe starting state is a system assessment across device, circuit, gas path, patient, and backup readiness.',
      actionLabel: 'Advance 1 second and reassess',
      actions: [{ type: 'STEP' }],
      expectedResponse: [
        'No unresolved startup fault',
        'Stable circuit values',
        'Independent patient data still required',
      ],
    }),
    step({
      id: 'startup-transfer',
      phase: 'transfer',
      target: 'console',
      title: 'Use this map in Practice',
      instruction:
        'In Practice, you will select the goal, find the correct surface, make the adjustment, and document device, circuit/gas, and patient responses without these cues.',
      rationale: orientationScenario.debrief.diagnosis,
      actionLabel: 'Finish walkthrough',
      expectedResponse: orientationScenario.debrief.safetyNotes,
    }),
  ],
}

const vaOrientationScenario = requireScenario('va-startup-sensor-orientation')
const vaOrientationLesson: GuidedLessonDefinition = {
  ...orientationLesson,
  id: 'learn-va-startup-sensor-orientation',
  scenarioId: vaOrientationScenario.id,
  supportMode: 'va',
  title: 'VA console, femoral circuit, and independent-monitor orientation',
  learningObjectives: [
    'Trace femoral venous drainage and femoral arterial return as two distinct limbs.',
    'Separate post-oxygenator circuit values from patient arterial pressure and upper-body oxygenation.',
    'Pair the shared console with pulsatility, native-heart, right-arm, and cannulated-limb assessment.',
  ],
  steps: orientationLesson.steps.map((item) => ({
    ...item,
    id: `va-${item.id}`,
    instruction:
      item.id === 'startup-orient-domains'
        ? 'Trace femoral venous drainage → pump → oxygenator → femoral arterial return. Identify the separate venous and arterial cannulas, then locate the console, gas blender, and independent patient monitor.'
        : item.instruction,
    rationale:
      item.id === 'startup-transfer' ? vaOrientationScenario.debrief.diagnosis : item.rationale,
    actions:
      item.id === 'startup-interpret' ? [predictionAction(vaOrientationScenario)] : item.actions,
  })),
}

export const cardiohelpLearnLessons: readonly GuidedLessonDefinition[] = [
  orientationLesson,
  standardLesson({
    scenarioId: 'preload-drainage-collapse',
    title: 'Preload-limited flow and drainage collapse',
    learningObjectives: [
      'Recognize falling flow, increasingly negative pVen, and chattering as a drainage pattern.',
      'Reduce pump demand before correcting the drainage cause.',
      'Avoid escalating RPM during collapse.',
    ],
    observe: {
      target: 'circuit',
      instruction:
        'Compare blood flow, pVen, and the drainage line. Do not begin by chasing the lower flow number.',
      rationale:
        'When venous return cannot meet pump demand, drainage pressure becomes more negative and the cannula or vessel can intermittently collapse.',
      expectedResponse: [
        'Falling or unstable flow',
        'More negative pVen',
        'Visible and text-labeled drainage chatter',
      ],
    },
    responseSteps: [
      {
        id: 'reduce-rpm',
        target: 'console',
        title: 'Reduce pump demand first',
        instruction: 'Reduce the setpoint by 300 RPM while you localize the cause.',
        rationale:
          'Lower pump demand can reduce collapse; increasing RPM can worsen the suction pattern.',
        actionLabel: 'Reduce RPM from 3600 to 3300',
        actions: [{ type: 'SET_RPM', rpm: 3300 }],
        expectedResponse: [
          'RPM decreases',
          'No critical RPM-escalation error',
          'The underlying cause still needs correction',
        ],
      },
      {
        id: 'correct-drainage-cause',
        target: 'circuit',
        title: 'Correct the drainage limitation',
        instruction:
          'Assess cannula position, kinks, coughing or straining, venous volume, and other patient/circuit causes; correct the identified cause.',
        rationale:
          'A temporary RPM reduction manages pump demand but does not by itself remove the drainage problem.',
        actionLabel: 'Correct the identified drainage cause',
        actions: [{ type: 'CORRECT_FAULT', fault: 'preload-limited' }],
        expectedResponse: ['Drainage cause cleared', 'Chatter should resolve as the model updates'],
      },
    ],
    reassessment: {
      target: 'trend-panel',
      instruction:
        'Recheck flow stability, pVen, chattering, and the patient before retitrating support.',
      expectedResponse: [
        'pVen becomes less negative',
        'Chatter resolves',
        'Flow stabilizes without blind RPM escalation',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'afterload-return-obstruction',
    title: 'Return-side obstruction',
    learningObjectives: [
      'Recognize pInt and pArt rising together while flow falls.',
      'Use the Δp trend to distinguish downstream resistance from oxygenator resistance.',
    ],
    observe: {
      target: 'circuit',
      instruction: 'Compare pInt, pArt, Δp trend, and flow as one pressure pattern.',
      rationale:
        'Resistance after the oxygenator raises both pre- and post-oxygenator pressures, while the pressure drop across the oxygenator may change little.',
      expectedResponse: [
        'pInt rises',
        'pArt rises with it',
        'Flow falls',
        'Δp trend changes little',
      ],
    },
    responseSteps: [
      {
        id: 'correct-return-obstruction',
        target: 'circuit',
        title: 'Inspect and clear the return path',
        instruction:
          'Inspect return tubing, clamps, connectors, cannula position, and pressure-sensor plausibility before changing pump demand.',
        rationale: 'The location of the pressure rise points downstream of the oxygenator.',
        actionLabel: 'Remove the identified return obstruction',
        actions: [{ type: 'CORRECT_FAULT', fault: 'return-obstruction' }],
        expectedResponse: [
          'Return resistance clears',
          'pInt and pArt can fall together',
          'Flow can recover at the same RPM',
        ],
      },
    ],
    reassessment: {
      target: 'trend-panel',
      instruction: 'Recheck the full pressure pattern, flow, tubing, and patient response.',
      expectedResponse: [
        'pArt and pInt trend down',
        'Δp remains comparatively stable',
        'Flow improves',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'afterload-oxygenator-resistance',
    title: 'Oxygenator resistance or dysfunction pattern',
    learningObjectives: [
      'Recognize pInt rising relative to pArt with a rising Δp trend.',
      'Escalate the circuit/oxygenator problem without inventing a fixed Δp alarm priority.',
    ],
    observe: {
      target: 'circuit',
      instruction:
        'Compare pre-oxygenator pInt with post-oxygenator pArt and the direction of the Δp trend.',
      rationale:
        'Resistance across the membrane increases the pressure difference between pInt and pArt and can constrain flow.',
      expectedResponse: [
        'pInt rises relative to pArt',
        'Δp trend rises',
        'Flow becomes constrained',
      ],
    },
    responseSteps: [
      {
        id: 'correct-oxygenator-resistance',
        target: 'circuit',
        title: 'Escalate the oxygenator/circuit cause',
        instruction:
          'Inspect sensor plausibility, oxygenator/circuit resistance, and gas transfer; escalate according to the local exchange protocol.',
        rationale:
          'A rising cross-oxygenator pattern should not be managed by repeatedly increasing RPM.',
        actionLabel: 'Escalate the identified oxygenator/circuit problem',
        actions: [{ type: 'CORRECT_FAULT', fault: 'oxygenator-resistance' }],
        expectedResponse: [
          'Resistance cause addressed',
          'No fixed Δp threshold or priority is taught',
        ],
      },
    ],
    reassessment: {
      target: 'trend-panel',
      instruction: 'Reassess pInt, pArt, Δp trend, flow, gas transfer, and patient status.',
      expectedResponse: [
        'Δp trend falls',
        'pInt-pArt relationship improves',
        'Flow and gas-transfer context are reassessed',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'vv-recirculation',
    title: 'VV recirculation despite high displayed flow',
    learningObjectives: [
      'Distinguish displayed circuit flow from effective systemic support.',
      'Recognize the patient/pre-oxygenator saturation pattern of recirculation.',
    ],
    observe: {
      target: 'patient-monitor',
      instruction:
        'Compare displayed flow with patient SpO₂ and pre-oxygenator saturation rather than assuming more L/min means more support.',
      rationale:
        'Oxygenated return blood can be drawn back into the drainage cannula, raising displayed flow without proportional patient benefit.',
      expectedResponse: [
        'High displayed flow',
        'Limited oxygenation response',
        'Pre-oxygenator saturation rises toward patient saturation',
      ],
    },
    responseSteps: [
      {
        id: 'correct-recirculation',
        target: 'circuit',
        title: 'Correct the recirculation cause',
        instruction:
          'Reassess cannula position/configuration and seek the efficient flow point rather than escalating RPM reflexively.',
        rationale: 'The target is effective VV support, not the largest displayed flow value.',
        actionLabel: 'Correct the cannula/recirculation cause',
        actions: [{ type: 'CORRECT_FAULT', fault: 'recirculation' }],
        expectedResponse: [
          'Recirculation decreases',
          'Effective support can improve without a higher displayed flow',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck patient SpO₂, pre-oxygenator saturation, flow efficiency, and cannula/circuit findings.',
      expectedResponse: [
        'Patient oxygenation improves',
        'Pre-oxygenator saturation separates from return blood',
        'Flow is interpreted as effective support',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'acute-hypercapnia',
    title: 'Acute hypercapnic acidemia',
    learningObjectives: [
      'Use sweep—not pump RPM or sweep-gas FiO₂—as the primary CO₂ control.',
      'Make a bounded change and reassess pH, PaCO₂, and work of breathing.',
    ],
    observe: {
      target: 'patient-monitor',
      instruction:
        'Read PaCO₂, pH, bicarbonate, work of breathing, and the stabilization phase together.',
      rationale:
        'Acute CO₂ retention with acidemia is different from a compensated maintenance state.',
      expectedResponse: [
        'PaCO₂ 68 mmHg',
        'pH 7.18',
        'Bicarbonate 25 mmol/L',
        'High work of breathing',
      ],
    },
    responseSteps: [
      {
        id: 'increase-sweep',
        target: 'gas-panel',
        title: 'Increase external sweep flow',
        instruction:
          'Increase sweep from 2.0 to 3.0 L/min. Leave sweep-gas FiO₂ and pump RPM unchanged for this CO₂-focused step.',
        rationale: 'Sweep primarily changes membrane CO₂ clearance in this educational model.',
        actionLabel: 'Increase sweep to 3.0 L/min',
        actions: [{ type: 'SET_SWEEP', sweep: 3 }],
        expectedResponse: [
          'Sweep increases by 1.0 L/min',
          'The gas control—not the touchscreen—changes',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Allow a response, then reassess PaCO₂, pH, work of breathing, and the patient goal.',
      expectedResponse: [
        'PaCO₂ begins to fall',
        'pH begins to improve',
        'Work of breathing remains part of assessment',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'compensated-hypercapnia',
    title: 'Compensated hypercapnia during maintenance',
    learningObjectives: [
      'Interpret PaCO₂ with pH, bicarbonate, symptoms, and clinical phase.',
      'Avoid blind normalization of a compensated value.',
    ],
    observe: {
      target: 'patient-monitor',
      instruction:
        'Compare PaCO₂ 58 with pH 7.39, bicarbonate 34, low work of breathing, and the maintenance phase.',
      rationale:
        'An elevated PaCO₂ does not automatically mean the same corrective action in every acid-base state or clinical phase.',
      expectedResponse: [
        'Elevated PaCO₂',
        'Near-normal pH',
        'Elevated bicarbonate',
        'Low work of breathing',
      ],
    },
    responseSteps: [
      {
        id: 'hold-sweep',
        target: 'gas-panel',
        title: 'Hold sweep and reassess the goal',
        instruction: 'Hold sweep at 3.5 L/min rather than chasing a normal PaCO₂.',
        rationale:
          'Abrupt normalization can overshoot the intended acid-base goal in a compensated state.',
        actionLabel: 'Hold sweep at 3.5 L/min',
        actions: [{ type: 'SET_SWEEP', sweep: 3.5 }],
        expectedResponse: [
          'Sweep remains unchanged',
          'The compensated state is acknowledged',
          'No universal PaCO₂ target is implied',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction: 'Recheck pH, bicarbonate, PaCO₂ trend, symptoms, work of breathing, and phase.',
      expectedResponse: [
        'pH remains acceptable in the model',
        'No unnecessary rapid CO₂ correction',
        'Clinical phase remains explicit',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'gas-source-interruption',
    title: 'Gas-source interruption with preserved blood flow',
    learningObjectives: [
      'Recognize that circuit blood flow can persist without membrane gas flow.',
      'Restore the source before changing sweep or sweep-gas FiO₂.',
    ],
    observe: {
      target: 'gas-panel',
      instruction:
        'Advance to the interruption, then compare gas-source status, blood flow, PaCO₂, and oxygenation.',
      rationale:
        'A normal-looking flow value does not prove intact sweep-gas delivery or membrane gas exchange.',
      expectedResponse: [
        'Gas source interrupted',
        'Blood flow persists',
        'PaCO₂ rises',
        'Oxygenator contribution falls',
      ],
    },
    responseSteps: [
      {
        id: 'restore-gas-source',
        target: 'gas-panel',
        title: 'Restore the verified gas source',
        instruction:
          'Restore source continuity. Do not confuse restoring supply with turning sweep up or changing sweep-gas FiO₂.',
        rationale:
          'Neither sweep nor FiO₂ setpoints can deliver gas when the source path is interrupted.',
        actionLabel: 'Restore verified gas source',
        actions: [{ type: 'RESTORE_GAS_SOURCE' }],
        expectedResponse: [
          'Source shows connected',
          'Sweep delivery becomes available again',
          'Blood flow was never the missing variable',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck source status, sweep delivery, blood flow, PaCO₂, SpO₂, and patient status.',
      expectedResponse: [
        'PaCO₂ begins to improve',
        'Gas-transfer contribution returns',
        'Circuit flow remains interpreted separately',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'arterial-bubble-stop',
    title: 'Arterial bubble intervention and cause-before-reset',
    learningObjectives: [
      'Recognize the scenario-triggered bubble alarm and automatic pump stop.',
      'Correct and clear the air source before deliberate reset.',
    ],
    observe: {
      target: 'console',
      instruction:
        'Advance to the bubble event and read the text alarm, pump state, and circuit bubble latch.',
      rationale:
        'The exercise intentionally uses no numerical bubble-size threshold; it teaches response sequence.',
      expectedResponse: [
        'High-priority arterial bubble alarm',
        'Pump stopped with intervention enabled',
        'Reset remains required',
      ],
    },
    responseSteps: [
      {
        id: 'correct-bubble-source',
        target: 'circuit',
        title: 'Correct and clear the air source first',
        instruction:
          'Inspect the patient and circuit, correct the source of air, and confirm the return path is bubble free.',
        rationale:
          'Resetting before source correction risks returning air and is a critical shortcut in Practice.',
        actionLabel: 'Correct the source and clear the circuit',
        actions: [{ type: 'CORRECT_FAULT', fault: 'arterial-bubble' }],
        expectedResponse: [
          'Air source corrected',
          'Circuit inspection precedes reset',
          'Bubble reset remains latched',
        ],
      },
      {
        id: 'reset-bubble-intervention',
        target: 'console',
        title: 'Reset only after the circuit is clear',
        instruction:
          'Use the deliberate intervention reset after cause correction and confirmation that the circuit is clear.',
        rationale: 'Acknowledgement or reset does not substitute for eliminating the air source.',
        actionLabel: 'Reset the bubble intervention',
        actions: [{ type: 'RESET_BUBBLE' }],
        expectedResponse: [
          'Pump can restart',
          'Bubble latch clears',
          'No premature-reset penalty is created',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Reconfirm support, circuit integrity, alarm state, and patient condition after reset.',
      expectedResponse: [
        'Pump running',
        'No active bubble indication',
        'Patient and circuit reassessed',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'transport-power-loss',
    title: 'Transport power loss and backup readiness',
    learningObjectives: [
      'Recognize automatic transition from AC to battery power.',
      'Restore verified power while maintaining immediate backup readiness.',
    ],
    observe: {
      target: 'console',
      instruction:
        'Advance to AC loss and identify the new power source, battery percentage, circuit flow, and patient state.',
      rationale:
        'Battery operation buys time; it does not remove the need to restore a verified source and prepare backup support.',
      expectedResponse: [
        'Power source changes to battery',
        'Battery begins at 24%',
        'Circuit support continues initially',
      ],
    },
    responseSteps: [
      {
        id: 'restore-ac-power',
        target: 'console',
        title: 'Restore verified AC and confirm backup readiness',
        instruction:
          'Restore a verified AC source, then confirm flow, patient status, and immediate backup-console/emergency-drive readiness.',
        rationale:
          'Transport safety depends on continuous support and a prepared fallback, not only the power icon.',
        actionLabel: 'Restore AC power + verify backup readiness',
        actions: [{ type: 'RESTORE_AC_POWER' }],
        expectedResponse: [
          'Power source returns to AC',
          'Battery loss stops',
          'Backup readiness remains explicit',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck power, battery, circuit blood flow, alarms, patient status, and backup readiness.',
      expectedResponse: [
        'AC source verified',
        'Flow remains continuous',
        'Patient and backup status are reassessed',
      ],
    },
  }),
  vaOrientationLesson,
  standardLesson({
    scenarioId: 'va-preload-drainage-collapse',
    title: 'VA preload-limited drainage and falling systemic support',
    learningObjectives: [
      'Recognize increasingly negative pVen, chatter, and unstable VA flow as a drainage pattern.',
      'Reduce pump demand before correcting the drainage cause.',
      'Reassess perfusion and native-heart endpoints rather than displayed flow alone.',
    ],
    observe: {
      target: 'circuit',
      instruction:
        'Compare flow, pVen, venous drainage-line motion, MAP, and patient perfusion before changing the pump.',
      rationale:
        'The pump cannot create venous return; escalating RPM can worsen caval or cannula collapse.',
      expectedResponse: [
        'Unstable flow',
        'Increasingly negative pVen',
        'Visible and text-labeled drainage chatter',
      ],
    },
    responseSteps: [
      {
        id: 'reduce-rpm',
        target: 'console',
        title: 'Reduce pump demand first',
        instruction: 'Reduce the setpoint from 3600 to 3300 RPM while the cause is localized.',
        rationale:
          'A bounded reduction can relieve suction while the underlying VA drainage problem is assessed.',
        actionLabel: 'Reduce RPM to 3300',
        actions: [{ type: 'SET_RPM', rpm: 3300 }],
        expectedResponse: [
          'RPM decreases',
          'No RPM-escalation critical error',
          'Cause correction remains required',
        ],
      },
      {
        id: 'correct-drainage-cause',
        target: 'circuit',
        title: 'Correct the venous drainage limitation',
        instruction:
          'Assess cannula position, tubing, venous filling, and intrathoracic causes; correct the identified limitation.',
        rationale:
          'Changing RPM manages demand but does not remove the source of inadequate drainage.',
        actionLabel: 'Correct the identified drainage cause',
        actions: [{ type: 'CORRECT_FAULT', fault: 'preload-limited' }],
        expectedResponse: ['Drainage cause clears', 'Chatter resolves as the model updates'],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck flow stability, pVen, MAP, perfusion, pulsatility, and the venous drainage limb.',
      expectedResponse: [
        'pVen becomes less negative',
        'Flow stabilizes',
        'Perfusion is reassessed independently',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-afterload-arterial-return-obstruction',
    title: 'VA arterial-return resistance',
    learningObjectives: [
      'Recognize pInt and pArt rising together while flow falls.',
      'Keep circuit pArt separate from patient MAP and arterial-line pressure.',
    ],
    observe: {
      target: 'circuit',
      instruction:
        'Compare pInt, pArt, pressure-drop trend, flow, the arterial return limb, and independent MAP.',
      rationale:
        'Resistance after the oxygenator raises both post-pump circuit pressures; patient afterload may contribute but is not measured by pArt.',
      expectedResponse: [
        'pInt and pArt rise together',
        'Flow falls',
        'Pressure-drop trend changes comparatively little',
      ],
    },
    responseSteps: [
      {
        id: 'clear-arterial-return',
        target: 'circuit',
        title: 'Inspect the arterial return path and patient afterload',
        instruction:
          'Inspect tubing, connectors, clamps, cannula path, pressure-sensor plausibility, and independent patient afterload before retitrating.',
        rationale:
          'The full pattern localizes resistance downstream of the oxygenator without assuming one cause from one number.',
        actionLabel: 'Correct the identified return-side cause',
        actions: [{ type: 'CORRECT_FAULT', fault: 'return-obstruction' }],
        expectedResponse: [
          'Return resistance clears',
          'pInt and pArt begin to fall together',
          'Flow can improve at the same RPM',
        ],
      },
    ],
    reassessment: {
      target: 'trend-panel',
      instruction:
        'Recheck flow, all three circuit pressures, MAP, systemic perfusion, and cannulated-limb findings.',
      expectedResponse: [
        'Circuit pressures improve',
        'Flow recovers',
        'Patient and limb data remain independent',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-afterload-oxygenator-resistance',
    title: 'VA oxygenator resistance pattern',
    learningObjectives: [
      'Recognize pInt separating from pArt with a rising pressure-drop trend.',
      'Evaluate the trend at comparable flow/RPM without inventing a fixed threshold.',
    ],
    observe: {
      target: 'circuit',
      instruction: 'Compare pInt, pArt, pressure-drop trend, matched flow/RPM, and gas transfer.',
      rationale:
        'Resistance across the oxygenator raises pre-oxygenator pressure relative to post-oxygenator pressure.',
      expectedResponse: [
        'pInt rises relative to pArt',
        'Pressure-drop trend rises',
        'Flow becomes constrained',
      ],
    },
    responseSteps: [
      {
        id: 'escalate-oxygenator',
        target: 'circuit',
        title: 'Escalate the oxygenator/circuit problem',
        instruction:
          'Check sensor plausibility, resistance, gas transfer, and the circuit; escalate under the reviewed exchange protocol.',
        rationale:
          'Repeated RPM escalation does not correct a rising cross-oxygenator resistance pattern.',
        actionLabel: 'Escalate the identified oxygenator problem',
        actions: [{ type: 'CORRECT_FAULT', fault: 'oxygenator-resistance' }],
        expectedResponse: [
          'Resistance cause addressed',
          'No fixed pressure-drop alarm threshold is taught',
        ],
      },
    ],
    reassessment: {
      target: 'trend-panel',
      instruction:
        'Reassess pInt, pArt, pressure-drop trend, flow, gas transfer, and patient perfusion.',
      expectedResponse: [
        'Pressure relationship improves',
        'Flow and gas-transfer context are rechecked',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-differential-hypoxemia',
    title: 'Peripheral VA differential upper-body oxygenation',
    learningObjectives: [
      'Recognize two competing circulations during femoral VA support.',
      'Prioritize right-arm data over reassuring post-oxygenator or lower-body values for upper-body oxygenation.',
    ],
    observe: {
      target: 'patient-monitor',
      instruction:
        'Compare right-radial saturation, femoral-arterial saturation, post-oxygenator saturation, pulse pressure, and native lung status.',
      rationale:
        'Antegrade native output can supply the upper body with poorly oxygenated blood while retrograde ECMO return oxygenates the lower body.',
      expectedResponse: [
        'Low right-radial SpO₂',
        'High femoral/post-oxygenator saturation',
        'Native pulsatility present',
      ],
    },
    responseSteps: [
      {
        id: 'verify-and-escalate-mixing',
        target: 'patient-monitor',
        title: 'Verify the upper-body mismatch and escalate',
        instruction:
          'Verify right-arm oxygenation, assess native ejection and lung oxygenation, compare circuit data, and escalate the support strategy.',
        rationale:
          'No single pump or sweep adjustment safely represents every differential-oxygenation cause.',
        actionLabel: 'Verify the pattern and escalate the reviewed response',
        actions: [{ type: 'CORRECT_FAULT', fault: 'differential-hypoxemia' }],
        expectedResponse: [
          'Upper-body pattern recognized',
          'Heart, lungs, circuit, and mixing are assessed together',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck right-radial and lower-body oxygenation, native ejection, lung status, circuit gas transfer, and perfusion.',
      expectedResponse: [
        'Right-radial oxygenation begins to improve',
        'The two circulations remain explicitly compared',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-lv-loading',
    title: 'VA LV-loading recognition',
    learningObjectives: [
      'Recognize that acceptable console flow and MAP can coexist with poor native LV ejection.',
      'Use pulsatility, aortic-valve opening, lung, echo, and perfusion data to trigger expert escalation.',
    ],
    observe: {
      target: 'patient-monitor',
      instruction:
        'Compare flow and MAP with pulse pressure, aortic-valve opening, native output, and pulmonary congestion.',
      rationale:
        'Retrograde arterial support can raise LV afterload; console flow cannot establish adequate native ejection.',
      expectedResponse: [
        'Narrow pulse pressure',
        'Aortic valve not opening',
        'Marked pulmonary congestion',
        'Apparently adequate flow/MAP',
      ],
    },
    responseSteps: [
      {
        id: 'escalate-lv-loading',
        target: 'patient-monitor',
        title: 'Escalate concerning LV-loading cues',
        instruction:
          'Integrate pulsatility, valve opening, LV/echo and lung findings, then escalate for expert unloading evaluation.',
        rationale:
          'This draft teaches recognition and escalation rather than a universal unloading device or threshold.',
        actionLabel: 'Escalate the reviewed LV-loading response',
        actions: [{ type: 'CORRECT_FAULT', fault: 'lv-loading' }],
        expectedResponse: [
          'Expert escalation documented',
          'No device-selection algorithm is implied',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck pulse pressure, aortic-valve opening, pulmonary congestion, perfusion, and circuit flow.',
      expectedResponse: [
        'Pulsatility begins to improve',
        'Aortic-valve opening returns in the bounded model',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-acute-hypercapnia',
    title: 'VA phase-aware sweep adjustment',
    learningObjectives: [
      'Use the external sweep control for a CO₂-focused problem.',
      'Continue independent upper-body, circulatory, and native-lung assessment.',
    ],
    observe: {
      target: 'patient-monitor',
      instruction:
        'Read PaCO₂, pH, bicarbonate, right-arm oxygenation, perfusion, and phase together.',
      rationale:
        'Sweep changes membrane CO₂ clearance; it does not replace VA circulatory or mixed-circulation assessment.',
      expectedResponse: ['PaCO₂ 68 mmHg', 'pH 7.18', 'Acute rather than compensated pattern'],
    },
    responseSteps: [
      {
        id: 'increase-sweep',
        target: 'gas-panel',
        title: 'Increase external sweep flow',
        instruction:
          'Increase sweep from 2.0 to 3.0 L/min while leaving pump RPM and sweep-gas FiO₂ unchanged.',
        rationale: 'This isolates the primary membrane CO₂ control in the educational model.',
        actionLabel: 'Increase sweep to 3.0 L/min',
        actions: [{ type: 'SET_SWEEP', sweep: 3 }],
        expectedResponse: ['Sweep increases by 1.0 L/min', 'The external gas control changes'],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction: 'Reassess PaCO₂, pH, right-arm oxygenation, lung status, flow, and perfusion.',
      expectedResponse: [
        'PaCO₂ begins to fall',
        'pH begins to improve',
        'VA assessment remains multi-domain',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-gas-source-interruption',
    title: 'VA gas-source interruption with continued arterial flow',
    learningObjectives: [
      'Recognize that VA circuit flow can continue without membrane gas transfer.',
      'Restore the source before interpreting sweep or FiO₂ setpoints.',
    ],
    observe: {
      target: 'gas-panel',
      instruction:
        'Advance to the interruption and compare source status, circuit flow, post-oxygenator data, right-arm oxygenation, and PaCO₂.',
      rationale:
        'Ongoing arterial return flow is not evidence that returned blood is being oxygenated or ventilated by the membrane.',
      expectedResponse: [
        'Gas source interrupted',
        'VA blood flow persists',
        'Gas transfer deteriorates',
      ],
    },
    responseSteps: [
      {
        id: 'restore-gas-source',
        target: 'gas-panel',
        title: 'Restore the verified source',
        instruction: 'Restore source continuity before changing sweep or sweep-gas FiO₂.',
        rationale: 'A setpoint cannot deliver gas through a disconnected source path.',
        actionLabel: 'Restore verified gas source',
        actions: [{ type: 'RESTORE_GAS_SOURCE' }],
        expectedResponse: ['Source reconnects', 'Membrane gas delivery becomes available'],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck gas source, post-oxygenator transfer, right-arm oxygenation, PaCO₂/pH, flow, and perfusion.',
      expectedResponse: [
        'Gas-transfer contribution returns',
        'Flow and gas delivery remain separate variables',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-arterial-bubble-stop',
    title: 'VA arterial-return bubble and cause-before-reset',
    learningObjectives: [
      'Recognize the bubble intervention and loss of forward VA support.',
      'Correct and clear the source before deliberate reset.',
    ],
    observe: {
      target: 'console',
      instruction:
        'Advance to the event and read the text alarm, pump state, flow, and arterial-return bubble latch.',
      rationale:
        'The response sequence matters without assigning a disputed numerical bubble threshold.',
      expectedResponse: [
        'High-priority bubble alarm',
        'Pump stopped',
        'VA circulatory support interrupted',
        'Reset latched',
      ],
    },
    responseSteps: [
      {
        id: 'correct-bubble-source',
        target: 'circuit',
        title: 'Correct and clear the air source first',
        instruction:
          'Identify and correct the source of air and confirm the arterial return path is clear.',
        rationale: 'Premature reset risks arterial air return and is a critical Practice error.',
        actionLabel: 'Correct the source and clear the circuit',
        actions: [{ type: 'CORRECT_FAULT', fault: 'arterial-bubble' }],
        expectedResponse: ['Air source corrected', 'Reset remains deliberate and separate'],
      },
      {
        id: 'reset-bubble',
        target: 'console',
        title: 'Reset only after the return path is clear',
        instruction:
          'Use the intervention reset after cause correction, then re-establish support.',
        rationale: 'Acknowledgement and reset do not substitute for eliminating the air source.',
        actionLabel: 'Reset the bubble intervention',
        actions: [{ type: 'RESET_BUBBLE' }],
        expectedResponse: ['Pump can restart', 'Bubble latch clears', 'No premature-reset penalty'],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Reconfirm forward flow, circuit integrity, perfusion, right-arm monitoring, and alarm state.',
      expectedResponse: [
        'VA support restored',
        'No active bubble indication',
        'Patient and circuit reassessed',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-transport-power-loss',
    title: 'VA transport power loss and circulatory backup',
    learningObjectives: [
      'Recognize automatic battery transition during VA support.',
      'Restore verified power while preserving immediate circulatory backup readiness.',
    ],
    observe: {
      target: 'console',
      instruction:
        'Advance to AC loss and identify source, battery, circuit flow, pressures, perfusion, and backup readiness.',
      rationale:
        'Battery operation buys time but does not remove the need for a verified source and prepared backup.',
      expectedResponse: [
        'Power changes to battery',
        'Battery begins at 24%',
        'VA support initially continues',
      ],
    },
    responseSteps: [
      {
        id: 'restore-ac',
        target: 'console',
        title: 'Restore verified AC and confirm backup',
        instruction:
          'Restore verified AC, then confirm flow, perfusion, patient status, and backup-console/emergency-drive readiness.',
        rationale:
          'Continuity of circulatory support depends on both current power and a prepared fallback.',
        actionLabel: 'Restore AC power + verify backup readiness',
        actions: [{ type: 'RESTORE_AC_POWER' }],
        expectedResponse: [
          'Power returns to AC',
          'Battery decline stops',
          'Backup readiness remains explicit',
        ],
      },
    ],
    reassessment: {
      target: 'patient-monitor',
      instruction:
        'Recheck power, battery, flow, pressures, perfusion, right-arm data, and backup readiness.',
      expectedResponse: [
        'AC verified',
        'Flow remains continuous',
        'Patient and backup status reassessed',
      ],
    },
  }),
] as const

export const cardiohelpLearnLessonByScenarioId = new Map(
  cardiohelpLearnLessons.map((lesson) => [lesson.scenarioId, lesson]),
)

export const cardiohelpLearnLessonsBySupportMode: Readonly<
  Record<SupportMode, readonly GuidedLessonDefinition[]>
> = {
  vv: cardiohelpLearnLessons.filter((lesson) => lesson.supportMode === 'vv'),
  va: cardiohelpLearnLessons.filter((lesson) => lesson.supportMode === 'va'),
}

export function validateGuidedLessonRegistry(): string[] {
  const errors: string[] = []
  const lessonIds = new Set<string>()
  const scenarioIds = new Set<string>()
  const eligibleScenarioIds = cardiohelpScenarios
    .filter((scenario) => !scenario.hiddenUntilAssessment)
    .map((scenario) => scenario.id)

  for (const lesson of cardiohelpLearnLessons) {
    if (lessonIds.has(lesson.id)) errors.push(`Duplicate guided lesson id: ${lesson.id}`)
    if (scenarioIds.has(lesson.scenarioId)) {
      errors.push(`Duplicate guided scenario coverage: ${lesson.scenarioId}`)
    }
    lessonIds.add(lesson.id)
    scenarioIds.add(lesson.scenarioId)

    const scenario = cardiohelpScenarioById.get(lesson.scenarioId)
    if (!scenario) errors.push(`${lesson.id}: missing scenario`)
    if (scenario && scenario.supportMode !== lesson.supportMode) {
      errors.push(`${lesson.id}: support mode does not match ${scenario.id}`)
    }
    if (scenario?.hiddenUntilAssessment)
      errors.push(`${lesson.id}: capstone must remain Practice-only`)
    if (!lesson.title.trim()) errors.push(`${lesson.id}: missing title`)
    if (!lesson.learningObjectives.length) errors.push(`${lesson.id}: missing objectives`)

    const stepIds = new Set<string>()
    for (const item of lesson.steps) {
      if (stepIds.has(item.id)) errors.push(`${lesson.id}: duplicate step id ${item.id}`)
      stepIds.add(item.id)
      if (!item.title.trim() || !item.instruction.trim() || !item.rationale.trim()) {
        errors.push(`${lesson.id}/${item.id}: incomplete teaching copy`)
      }
      if (!item.actionLabel.trim()) errors.push(`${lesson.id}/${item.id}: missing action label`)
      if (item.actions.some((action) => action.type === 'TOGGLE_GLOBAL_OVERRIDE')) {
        errors.push(`${lesson.id}/${item.id}: Global Override cannot be a Learn action`)
      }
    }

    for (const requiredPhase of [
      'observe',
      'interpret',
      'respond',
      'reassess',
      'transfer',
    ] as const) {
      if (!lesson.steps.some((item) => item.phase === requiredPhase)) {
        errors.push(`${lesson.id}: missing ${requiredPhase} phase`)
      }
    }

    if (scenario?.family === 'preload') {
      const initialRpm = scenario?.initialState.device?.rpmSetpoint ?? 0
      if (
        lesson.steps.some((item) =>
          item.actions.some((action) => action.type === 'SET_RPM' && action.rpm > initialRpm),
        )
      ) {
        errors.push(`${lesson.id}: preload lesson cannot escalate RPM`)
      }
    }

    if (scenario?.family === 'bubble') {
      const actions = lesson.steps.flatMap((item) => item.actions)
      const correctIndex = actions.findIndex(
        (action) => action.type === 'CORRECT_FAULT' && action.fault === 'arterial-bubble',
      )
      const resetIndex = actions.findIndex((action) => action.type === 'RESET_BUBBLE')
      if (correctIndex < 0 || resetIndex < 0 || resetIndex < correctIndex) {
        errors.push(`${lesson.id}: bubble source correction must precede reset`)
      }
    }
  }

  for (const scenarioId of eligibleScenarioIds) {
    if (!scenarioIds.has(scenarioId)) errors.push(`Missing guided lesson for ${scenarioId}`)
  }

  return errors
}
