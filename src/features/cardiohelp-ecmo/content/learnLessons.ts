import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import type {
  CircuitViewPreference,
  GuidedLessonDefinition,
  GuidedTarget,
  GuidedWalkthroughStep,
  ScenarioDefinition,
  SimulationAction,
  SupportMode,
} from '../engine/types'
import { ecmoDrillSpec } from './drillSpecs'
import { requireEcmoLearnPrediction } from './learnPredictionItems'
import { cardiohelpScenarioById, cardiohelpScenarios, TIP_TO_TIP_CHECK_ID } from './scenarios'
import { ecmoSectionSpecById, ecmoSectionSpec } from './sectionSpecs'

interface ResponseStepInput {
  id: string
  target: GuidedTarget
  title: string
  instruction: string
  rationale: string
  actionLabel: string
  actions: readonly SimulationAction[]
  expectedResponse: readonly string[]
  /**
   * Declared on the clamp and resumption steps: those controls exist in the bedside 3D scene, so a
   * learner who arrived from a pressure step reading the map is taken back to where the clamp is.
   */
  preferredCircuitView?: CircuitViewPreference
}

interface StandardLessonInput {
  scenarioId: string
  /**
   * The observe step is the first thing a learner reads, and the prediction follows it. Its
   * instruction says what to read and compare, its rationale says why those readings are the
   * ones to compare, and its expected response lists observable signals — a number that moved, a
   * line that judders, a status that changed. None of the three says why the pattern arose, which
   * control answers it, or which reflex to resist: that is the drill's answer, and it belongs to
   * the verdict. `learn-precommit-leak.test.ts` holds every observe step to its drill's deny
   * patterns.
   */
  observe: {
    target: GuidedTarget
    instruction: string
    rationale: string
    expectedResponse: readonly string[]
    /**
     * The circuit surface the observe step — and the prediction that follows it — are read on.
     *
     * A pressure-pattern case is answered by comparing pVen, pInt, pArt and the Δp trend, which
     * only the pressure-zone map lays out side by side. The prediction inherits it because the
     * learner is answering the same question they were just asked to look at.
     */
    preferredCircuitView?: CircuitViewPreference
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

/**
 * A lesson is named by the pathway row that lists it, and by nothing else.
 *
 * The lesson header and the pathway rail show the same string, and the human-testing packet pins
 * that string, so a second authored copy here could only drift from the first. Every title on the
 * pathway names the presentation the learner sees — never the fault, its mechanism, the move that
 * answers it or the reflex to resist — because the header stays on screen through the prediction.
 */
function pathwaySectionTitle(supportMode: SupportMode, scenarioId: string): string {
  const section = criticalCareLearningPathway('cardiohelp-ecmo', supportMode).sections.find(
    (candidate) => candidate.id === scenarioId,
  )
  if (!section) {
    throw new Error(`No ${supportMode} pathway section names the guided lesson ${scenarioId}`)
  }
  return section.title
}

/**
 * The one objective a lesson states, verbatim from the section spec: the discrimination the
 * learner will be able to make, never the action the drill ends in.
 */
function lessonObjectives(scenarioId: string): readonly string[] {
  return [ecmoSectionSpec(scenarioId).objective]
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

/**
 * The one step in a lesson the learner answers rather than performs.
 *
 * Everything the step says has to survive being read by someone who has not answered yet, so the
 * copy here is deliberately the same for every lesson: the clinical question, its options and its
 * reasoning all live in the authored item, which the player does not show until the learner has
 * committed. The step carries no action — the selected choice supplies the payload — and no
 * expected response, because previewing the response would be the answer.
 *
 * `requireEcmoLearnPrediction` is called for its failure: a lesson that declares a prediction step
 * without an authored item to answer refuses to construct rather than rendering an empty question.
 */
function predictionStep(
  scenario: ScenarioDefinition,
  target: GuidedTarget,
  preferredCircuitView?: CircuitViewPreference,
): GuidedWalkthroughStep {
  requireEcmoLearnPrediction(scenario.id)
  return step({
    id: `${scenario.id}-interpret`,
    phase: 'interpret',
    target,
    preferredCircuitView,
    title: 'Commit to a prediction before you act',
    instruction:
      'Read the pattern in front of you and commit to one course of action, together with what you expect it to do. The options are alternatives a reasoning clinician would weigh, and the reasoning behind each of them is held back until you have chosen.',
    rationale:
      'Committing before acting is what makes the next few minutes diagnostic rather than merely eventful. A read that is only stated after the response has been seen cannot be shown to have been mistaken, so the model it came from is never examined — and it is the model, not the single action, that carries forward to the next patient.',
    actionLabel: 'Commit this prediction',
    actions: [],
    expectedResponse: [],
    predictionScenarioId: scenario.id,
  })
}

function standardLesson(input: StandardLessonInput): GuidedLessonDefinition {
  const scenario = requireScenario(input.scenarioId)
  const timedActions = eventActions(scenario)
  return {
    id: `learn-${scenario.id}`,
    scenarioId: scenario.id,
    supportMode: scenario.supportMode,
    title: pathwaySectionTitle(scenario.supportMode, scenario.id),
    learningObjectives: lessonObjectives(scenario.id),
    steps: [
      step({
        id: `${scenario.id}-observe`,
        phase: 'observe',
        target: input.observe.target,
        preferredCircuitView: input.observe.preferredCircuitView,
        title: 'Read the pattern before touching a control',
        instruction: input.observe.instruction,
        rationale: input.observe.rationale,
        actionLabel: timedActions.length
          ? `Advance ${timedActions.length} simulated seconds to the event`
          : 'Inspect the starting pattern',
        actions: timedActions,
        expectedResponse: input.observe.expectedResponse,
      }),
      predictionStep(scenario, input.observe.target, input.observe.preferredCircuitView),
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
        title: 'Let the circuit respond, then reassess device, circuit and patient',
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
  title: pathwaySectionTitle('vv', orientationScenario.id),
  learningObjectives: lessonObjectives(orientationScenario.id),
  steps: [
    step({
      id: 'startup-orient-domains',
      phase: 'observe',
      target: 'circuit',
      // The tour's subject is where the sensors sit, and the pressure-zone map draws every one of
      // them with a leader to its place on the tubing — the geometry a table of names cannot show.
      preferredCircuitView: 'diagnostic',
      title: 'Start with four sources of information',
      instruction:
        'Trace drainage → pump → oxygenator → return. Then identify the device console, separate gas blender, and independent patient monitor.',
      rationale:
        'The console reports device and circuit values, but it cannot replace inspection of tubing, gas delivery, cannulas, bedside physiology, or laboratory data.',
      actionLabel: 'I can identify all four sources',
      expectedResponse: [
        'Console',
        'Circuit and sensors',
        'External gas path',
        'Independent patient data',
      ],
    }),
    // A short recognition activity on the stopped circuit, and then the tour proper on a running
    // one. The stopped pump is worth exactly one question — which channels still mean anything —
    // and is a poor state in which to meet every tile for the first time.
    step({
      id: 'startup-screen-parameters',
      phase: 'orient',
      target: 'console',
      title: 'The pump is stopped: which channels still mean anything?',
      instruction:
        'Open Parameter list. In this settled initial pump-off state pVen, pInt, pArt and the Δp trend show the unavailable indication rather than a number. Work out what the console can still tell you here, and why the pressure channels are not part of it.',
      rationale:
        'Dashes are a statement, not a gap. The three pressure locations distinguish drainage limitation, return obstruction and oxygenator resistance, but they are flow-dependent circuit-pressure patterns that this educational model does not report in the settled pump-off state. Flow is different: with the sensor connected, zero is a real reading rather than an absent one.',
      actionLabel: 'Open Parameter list',
      actions: [{ type: 'SET_SCREEN', screen: 'parameters' }],
      expectedResponse: [
        'Flow reads zero, and with its sensor connected that is a real value rather than an absent one',
        'Speed setpoint, power source and alarm or device state remain interpretable',
        'The pressure channels do not report, being flow-dependent patterns this model does not produce in the settled pump-off state',
      ],
    }),
    step({
      id: 'startup-bring-circuit-up',
      phase: 'orient',
      target: 'console',
      title: 'Bring a reference circuit up before touring the rest',
      instruction:
        'Bring the pump up to 3200 rpm on the rotary control. Hold the control rather than tapping it — the simulated setpoint climbs progressively while it is held. This is a reference circuit brought up so the console has something to report; it is not the startup sequence, which comes later on a fresh one.',
      rationale:
        'Meeting every tile on a stopped circuit would teach the wrong first impression of what each one looks like, so the tour needs a circuit that is working. What it does not need is a completed startup — nothing here has been diagnostically checked or inspected, and none of it counts toward the pre-use sequence. The progressive climb simulates a ramp; it is not a claim about how any particular unit brings a pump up.',
      actionLabel: 'Ramp to 3200 rpm',
      actions: [{ type: 'SET_RPM', rpm: 3200 }],
      expectedResponse: [
        'The speed setpoint reaches 3200 rpm',
        'The circuit’s response follows when the model is advanced, which is the next step',
      ],
    }),
    /*
     * The step this correction added, and the reason it exists.
     *
     * `SET_RPM` moves a setpoint and nothing else: this model restarts the pump and recomputes flow
     * and the pressure channels inside `advance`. On a paused scenario with no `STEP` the learner
     * arrived at "now that it reports" with the pump still stopped, flow at zero and all four
     * channels still showing the unavailable indication — the exact state the previous step had
     * taught them to recognise. Advancing the model is a statement about the simulation, not about
     * how a pump behaves when its speed is raised.
     *
     * Which is why it is `task-pane`. Presented as a console step it read as an instruction to find
     * a control on the CARDIOHELP — there is none, and the owner's smoke test caught exactly that.
     */
    step({
      id: 'startup-settle-circuit',
      phase: 'orient',
      target: 'console',
      interaction: 'task-pane',
      title: 'Let the circuit respond',
      instruction:
        'No console action is required. Select the button below to update the simulation after the RPM change.',
      rationale:
        'This model advances in discrete steps, so a changed setting and the circuit’s response to it are two separate moments. The console showing dashes a moment ago and numbers now is that mechanic, not a device behaviour: on a real unit the response follows the speed continuously.',
      actionLabel: 'Let the circuit respond',
      actions: [{ type: 'STEP' }, { type: 'STEP' }],
      expectedResponse: [
        'The pump is running and flow appears',
        'pVen, pInt, pArt and the Δp trend begin reporting numbers',
        'Nothing about this circuit has been verified — this is orientation, not startup',
      ],
    }),
    step({
      id: 'startup-screen-parameters-running',
      phase: 'orient',
      target: 'console',
      title: 'Read the parameter list again, now that it reports',
      instruction:
        'Return to Parameter list and locate pVen, pInt, pArt, flow and the Δp trend now that each one carries a value. Note where each sits in the circuit rather than what the number happens to be.',
      rationale:
        'This is the first exposure that should stick: the four channels as they look on a circuit that is working. pVen, pInt and pArt are this console’s own labels for three locations, and pArt is a circuit pressure rather than the patient’s arterial pressure.',
      actionLabel: 'Open Parameter list',
      actions: [{ type: 'SET_SCREEN', screen: 'parameters' }],
      expectedResponse: [
        'pVen before the pump',
        'pInt before the oxygenator',
        'pArt after the oxygenator',
        'pArt is a circuit pressure, not the patient’s arterial pressure',
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
        'Open Transport and locate the AC/battery source and the remaining charge; backup-console and emergency-drive readiness is not on this screen and is confirmed at the bedside.',
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
    /*
     * The demonstration ends here, and the circuit goes back to the state a pre-use sequence
     * actually starts from.
     *
     * Without this the startup prediction was asked of a circuit already turning at 3200 rpm: the
     * learner planned a pre-use check for a machine that was, on its own display, already
     * supporting a patient — and the authored stem described a stopped one. Reloading the scenario
     * is the module's existing reset, and it restores exactly the opening state: setpoint zero,
     * pump stopped, diagnostic not run through, circuit uninspected.
     */
    step({
      id: 'startup-return-to-pre-use',
      phase: 'orient',
      target: 'circuit',
      title: 'End the demonstration and return to the pre-use state',
      instruction:
        'The tour is finished. Put the circuit back to the state a pre-use sequence starts from — pump stopped, nothing yet verified — because everything from here on is that sequence rather than a demonstration.',
      rationale:
        'Running the circuit showed you what the console looks like when it has something to report. It was not a startup: the diagnostic has not been run through and no one has walked the tubing, so none of what you have just seen is evidence that this circuit is fit to support a patient. Planning a startup from a circuit that happens to be turning would be planning from a state that should not have existed.',
      actionLabel: 'Return the circuit to its pre-use state',
      actions: [{ type: 'LOAD_SCENARIO', scenarioId: orientationScenario.id, mode: 'guided' }],
      expectedResponse: [
        'The pump is stopped and the speed setpoint returns to zero',
        'The pressure channels stop reporting, as they did at the start',
        'Nothing about the circuit has been verified yet: no diagnostic has run and no one has walked the tubing',
      ],
    }),
    // Shares its id shape with the drills so the VA lesson below can substitute its own scenario's
    // prediction while remapping the rest of the tour.
    { ...predictionStep(orientationScenario, 'console'), id: 'startup-interpret' },
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
      title: 'Use this orientation in Practice',
      instruction:
        'In Practice, you will select the goal, find the correct surface, make the adjustment, and document device, circuit/gas, and patient responses without these cues.',
      rationale: orientationScenario.debrief.diagnosis,
      actionLabel: 'Finish walkthrough',
      expectedResponse: orientationScenario.debrief.safetyNotes,
    }),
  ],
}

const vaOrientationScenario = requireScenario('va-startup-sensor-orientation')
// This lesson remaps the venovenous tour rather than building its own steps, so the authored VA
// prediction has to be demanded here or its absence would only show up as an empty question.
requireEcmoLearnPrediction(vaOrientationScenario.id)

const vaOrientationLesson: GuidedLessonDefinition = {
  ...orientationLesson,
  id: 'learn-va-startup-sensor-orientation',
  scenarioId: vaOrientationScenario.id,
  supportMode: 'va',
  title: pathwaySectionTitle('va', vaOrientationScenario.id),
  learningObjectives: lessonObjectives(vaOrientationScenario.id),
  steps: orientationLesson.steps.map((item) => ({
    ...item,
    id: `va-${item.id}`,
    instruction:
      item.id === 'startup-orient-domains'
        ? 'Trace femoral venous drainage → pump → oxygenator → femoral arterial return. Identify the separate venous and arterial cannulas, then locate the console, gas blender, and independent patient monitor.'
        : item.instruction,
    rationale:
      item.id === 'startup-transfer' ? vaOrientationScenario.debrief.diagnosis : item.rationale,
    // The VA lesson asks its own authored question, not the venovenous one.
    predictionScenarioId:
      item.id === 'startup-interpret' ? vaOrientationScenario.id : item.predictionScenarioId,
    // And returns to its own circuit. Inheriting the venovenous reload would drop the learner onto
    // a VV circuit for the startup plan and every step after it.
    actions:
      item.id === 'startup-return-to-pre-use'
        ? [{ type: 'LOAD_SCENARIO', scenarioId: vaOrientationScenario.id, mode: 'guided' }]
        : item.actions,
  })),
}

/** The one title every transfer step carries; the step is what changes, not its name. */
export const ECMO_TRANSFER_STEP_TITLE = 'Carry the reasoning to a new circuit'

/**
 * Where a transfer instruction cannot avoid naming the fix — a supply that has to be re-established,
 * a clamp that has to be closed — the disclosure is made explicit rather than hidden, and the drill
 * it leads into is a worked example for the learner who reads it. Exactly the transfers into the
 * gas-path and air drills carry it; the registry validator holds that to be so.
 */
export const ECMO_SCAFFOLDED_TRANSFER_PREFIX = 'Worked example — '

interface GuidedTransferVariant {
  readonly scenarioId: string
  readonly target: GuidedTarget
  /**
   * Names the presentation on the new circuit and the class of action to take on it — a look at
   * a screen, a bounded move on one control, a walk of the circuit — never the fault the next
   * drill will ask the learner to find, its mechanism, or the reflex to resist. The transfer step
   * is the last thing read before that drill's prediction, so `learn-precommit-leak.test.ts`
   * holds it to the next drill's deny patterns.
   */
  readonly instruction: string
  readonly actionLabel: string
  readonly action: SimulationAction
  /** Observable signals after the action, on the new circuit. */
  readonly expectedResponse: readonly string[]
  readonly setupActions?: readonly SimulationAction[]
  /** Set where the transfer action is a bedside control rather than a pressure comparison. */
  readonly preferredCircuitView?: CircuitViewPreference
  /** The instruction names the fix, and says so with `ECMO_SCAFFOLDED_TRANSFER_PREFIX`. */
  readonly scaffolded?: true
}

const guidedTransferVariantByLessonScenarioId: Readonly<Record<string, GuidedTransferVariant>> = {
  'startup-sensor-orientation': {
    scenarioId: 'preload-drainage-collapse',
    target: 'console',
    instruction:
      'A newly unstable VV patient: flow is falling, pVen is more negative than it was, and the drainage line is juddering. Take a step off the pump speed on the rotary control as a holding move, then go and look for what changed.',
    actionLabel: 'Reduce the new patient to 3300 RPM',
    action: { type: 'SET_RPM', rpm: 3300 },
    expectedResponse: [
      'The speed setpoint falls to the new value',
      'pVen and the drainage line answer the lower demand, or do not',
      'The cause of the change is still to be found',
    ],
  },
  'preload-drainage-collapse': {
    scenarioId: 'afterload-return-obstruction',
    target: 'console',
    instruction:
      'The new patient’s flow is falling while pInt and pArt rise together. Open Parameter list and work out whether the load sits before, across or after the membrane.',
    actionLabel: 'Open Parameter list for the new pressure pattern',
    action: { type: 'SET_SCREEN', screen: 'parameters' },
    expectedResponse: [
      'Parameter list open',
      'pInt and pArt read side by side with the Δp trend',
      'Flow read against an unchanged speed',
    ],
  },
  'afterload-return-obstruction': {
    scenarioId: 'afterload-oxygenator-resistance',
    target: 'console',
    instruction:
      'In this contrasting pattern pInt pulls away from pArt and the Δp trend climbs. Open Parameter list and compare the three pressure locations against where they sat earlier.',
    actionLabel: 'Open Parameter list for the second pressure pattern',
    action: { type: 'SET_SCREEN', screen: 'parameters' },
    expectedResponse: [
      'Parameter list open',
      'pInt, pArt and the Δp trend read against where they sat earlier',
      'Flow read against an unchanged speed',
    ],
  },
  'afterload-oxygenator-resistance': {
    scenarioId: 'vv-recirculation',
    target: 'console',
    instruction:
      'Displayed flow is high and the patient’s oxygenation is not keeping up. Open Blood parameters and compare the pre-oxygenator saturation with the patient’s own before deciding what the flow number is worth.',
    actionLabel: 'Open Blood parameters for the new patient',
    action: { type: 'SET_SCREEN', screen: 'blood' },
    expectedResponse: [
      'Blood parameters open',
      'Pre-oxygenator saturation read beside the patient’s own',
      'Displayed flow read beside both',
    ],
  },
  'vv-recirculation': {
    scenarioId: 'acute-hypercapnia',
    target: 'gas-panel',
    instruction:
      'The new patient’s CO₂ is climbing and the pH is following it down, with oxygenation steady. Move the sweep on the separate blender by one small step, then read the PaCO₂ and pH again.',
    actionLabel: 'Set transfer sweep to 4.0 L/min',
    action: { type: 'SET_SWEEP', sweep: 4 },
    expectedResponse: [
      'Sweep set to the new value on the separate blender',
      'PaCO₂ and pH re-read after the model responds',
      'Pump speed and sweep-gas oxygen fraction untouched',
    ],
  },
  'acute-hypercapnia': {
    scenarioId: 'compensated-hypercapnia',
    target: 'console',
    instruction:
      'The new patient’s CO₂ is high, the pH is near normal and the breathing is comfortable. Open Blood parameters and read the whole acid–base picture before deciding whether any setting should move.',
    actionLabel: 'Open Blood parameters for the new patient',
    action: { type: 'SET_SCREEN', screen: 'blood' },
    expectedResponse: [
      'Blood parameters open',
      'PaCO₂ read beside pH, bicarbonate and work of breathing',
      'No setting changed yet',
    ],
  },
  'compensated-hypercapnia': {
    scenarioId: 'gas-source-interruption',
    target: 'gas-panel',
    instruction:
      'Blood flow persists but the external gas source has just been interrupted. Restore the verified source on the separate gas panel and reassess membrane gas transfer.',
    actionLabel: 'Restore the verified gas source',
    action: { type: 'RESTORE_GAS_SOURCE' },
    expectedResponse: [
      'Source shows connected',
      'Set sweep and delivered sweep agree again',
      'PaCO₂ and post-membrane saturation re-read after the model responds',
    ],
    setupActions: [{ type: 'TICK', seconds: 5 }],
    scaffolded: true,
  },
  'gas-source-interruption': {
    scenarioId: 'arterial-bubble-stop',
    target: 'circuit',
    instruction:
      'A distinct arterial-bubble event stops the pump. Begin the isolation sequence by closing the return-limb clamp near the patient; do not treat acknowledgement as correction.',
    actionLabel: 'Close the new patient return-limb clamp',
    action: { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
    expectedResponse: [
      'Return clamp CLOSED',
      'Pump still stopped, latch still set',
      'Drainage clamp still open — the sequence continues in the drill',
    ],
    preferredCircuitView: 'bedside',
    setupActions: [{ type: 'TICK', seconds: 4 }],
    scaffolded: true,
  },
  'arterial-bubble-stop': {
    scenarioId: 'transport-power-loss',
    target: 'console',
    instruction:
      'During transport the supply drops out and the console changes over to a low reserve. From the Transport screen, put the console back on a source you have confirmed live, then check that flow never paused and that the fallback is within reach.',
    actionLabel: 'Put the transfer console on confirmed AC power',
    action: { type: 'RESTORE_AC_POWER' },
    expectedResponse: [
      'Power-source indicator shows the supply again',
      'Reserve reading no longer falling',
      'Flow read against its value before the changeover',
    ],
    setupActions: [{ type: 'TICK', seconds: 3 }],
  },
  'transport-power-loss': {
    scenarioId: 'startup-sensor-orientation',
    target: 'circuit',
    instruction:
      'A fresh circuit is at startup rather than in transport. Walk it from the drainage cannula to the return cannula, with every sensor, before any support is adjusted.',
    actionLabel: 'Perform the transfer circuit check',
    action: { type: 'PERFORM_CHECK', checkId: TIP_TO_TIP_CHECK_ID },
    expectedResponse: [
      'Circuit walked from the drainage cannula to the return cannula',
      'Sensors, gas and power read as separate facts',
      'Nothing on this circuit is assumed from the console alone',
    ],
  },
  'va-startup-sensor-orientation': {
    scenarioId: 'va-preload-drainage-collapse',
    target: 'console',
    instruction:
      'A newly unstable VA patient: flow is falling and swinging, pVen is more negative than it was, the drainage line is juddering, and the patient’s pressure is drifting down with the flow. Take a step off the pump speed as a holding move, then look for what changed.',
    actionLabel: 'Reduce the new patient to 3300 RPM',
    action: { type: 'SET_RPM', rpm: 3300 },
    expectedResponse: [
      'The speed setpoint falls to the new value',
      'pVen, the drainage line and the patient’s pressure answer the lower demand, or do not',
      'The cause of the change is still to be found',
    ],
  },
  'va-preload-drainage-collapse': {
    scenarioId: 'va-afterload-arterial-return-obstruction',
    target: 'console',
    instruction:
      'The new case now shows pInt and pArt rising together with falling flow, while the patient’s own arterial line has not moved. Open Parameter list and read the circuit pressures beside the arterial line and MAP.',
    actionLabel: 'Open Parameter list for the new pressure pattern',
    action: { type: 'SET_SCREEN', screen: 'parameters' },
    expectedResponse: [
      'Parameter list open',
      'pInt and pArt read beside the patient’s own arterial line',
      'Flow read against an unchanged speed',
    ],
  },
  'va-afterload-arterial-return-obstruction': {
    scenarioId: 'va-afterload-oxygenator-resistance',
    target: 'console',
    instruction:
      'The new pattern has pInt pulling away from pArt with a rising pressure-drop trend. Open Parameter list and compare matched flow, speed and the three pressure locations against where they sat earlier.',
    actionLabel: 'Open Parameter list for the second pressure pattern',
    action: { type: 'SET_SCREEN', screen: 'parameters' },
    expectedResponse: [
      'Parameter list open',
      'pInt, pArt and the pressure-drop trend read against where they sat earlier',
      'Flow read against an unchanged speed',
    ],
  },
  'va-afterload-oxygenator-resistance': {
    scenarioId: 'va-differential-hypoxemia',
    target: 'console',
    instruction:
      'The circuit is returning well-saturated blood while the right-arm saturation is low. Open Blood parameters and compare the circuit’s readings with the upper- and lower-body samples.',
    actionLabel: 'Open Blood parameters for the new patient',
    action: { type: 'SET_SCREEN', screen: 'blood' },
    expectedResponse: [
      'Blood parameters open',
      'Post-membrane saturation read beside the right-arm and femoral samples',
      'The arterial trace read beside all three',
    ],
  },
  'va-differential-hypoxemia': {
    scenarioId: 'va-lv-loading',
    target: 'console',
    instruction:
      'The new patient has an acceptable flow and MAP, a narrow pulse pressure, an aortic valve that is not seen to open, and a congested chest. Open Parameter list and read the console flow beside the native-heart signals.',
    actionLabel: 'Open Parameter list for the flat-pulse variant',
    action: { type: 'SET_SCREEN', screen: 'parameters' },
    expectedResponse: [
      'Parameter list open',
      'Console flow read beside the pulse pressure, the valve and the chest',
      'MAP read as one number among those',
    ],
  },
  'va-lv-loading': {
    scenarioId: 'va-acute-hypercapnia',
    target: 'gas-panel',
    instruction:
      'The new VA patient’s CO₂ is climbing and the pH is following it down. Move the sweep on the external blender by one bounded step, and keep reading the circulation and the right-arm saturation while you do.',
    actionLabel: 'Set transfer sweep to 4.0 L/min',
    action: { type: 'SET_SWEEP', sweep: 4 },
    expectedResponse: [
      'Sweep set to the new value on the external blender',
      'PaCO₂ and pH re-read after the model responds',
      'Right-arm saturation and the arterial trace re-read with them',
    ],
  },
  'va-acute-hypercapnia': {
    scenarioId: 'va-gas-source-interruption',
    target: 'gas-panel',
    instruction:
      'VA blood flow persists after an external gas-source interruption. Restore the verified source and reassess post-oxygenator transfer, right-arm oxygenation, PaCO₂, and perfusion.',
    actionLabel: 'Restore the verified gas source',
    action: { type: 'RESTORE_GAS_SOURCE' },
    expectedResponse: [
      'Source shows connected',
      'Set sweep and delivered sweep agree again',
      'Post-membrane saturation, both arterial saturations and PaCO₂ re-read after the model responds',
    ],
    setupActions: [{ type: 'TICK', seconds: 5 }],
    scaffolded: true,
  },
  'va-gas-source-interruption': {
    scenarioId: 'va-arterial-bubble-stop',
    target: 'circuit',
    instruction:
      'A distinct VA arterial-return bubble event stops forward support. Begin isolation by closing the arterial return-limb clamp near the patient, before source correction, de-airing, and resumption.',
    actionLabel: 'Close the VA return-limb clamp',
    action: { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
    expectedResponse: [
      'Arterial return clamp CLOSED',
      'Pump still stopped, latch still set',
      'Drainage clamp still open — the sequence continues in the drill',
    ],
    preferredCircuitView: 'bedside',
    setupActions: [{ type: 'TICK', seconds: 4 }],
    scaffolded: true,
  },
  'va-arterial-bubble-stop': {
    scenarioId: 'va-transport-power-loss',
    target: 'console',
    instruction:
      'The supply drops out during VA transport and the reserve is limited. Put the console back on a source you have confirmed live, then check that the circulation paid nothing for the changeover and that the fallback is within reach.',
    actionLabel: 'Put the transfer console on confirmed AC power',
    action: { type: 'RESTORE_AC_POWER' },
    expectedResponse: [
      'Power-source indicator shows the supply again',
      'Reserve reading no longer falling',
      'Flow, pressures and the arterial trace read against their values before the changeover',
    ],
    setupActions: [{ type: 'TICK', seconds: 3 }],
  },
  'va-transport-power-loss': {
    scenarioId: 'va-startup-sensor-orientation',
    target: 'circuit',
    instruction:
      'A new VA circuit is at startup. Trace femoral venous drainage to femoral arterial return and walk every sensor before support changes.',
    actionLabel: 'Perform the VA transfer circuit check',
    action: { type: 'PERFORM_CHECK', checkId: TIP_TO_TIP_CHECK_ID },
    expectedResponse: [
      'Circuit walked from femoral venous drainage to femoral arterial return',
      'Sensors, gas, power and the right-arm monitor read as separate facts',
      'Nothing on this circuit is assumed from the console alone',
    ],
  },
}

/**
 * The transfer step of every lesson: one observable action on a different authored circuit.
 *
 * The step's title is a constant, its rationale is the principle the drill spec carries forward
 * from the lesson just finished, and its instruction names the new presentation and the class of
 * action. What it may not carry is the next scenario's name, causal chain or safety notes — the
 * first thing a learner reads before that drill's own prediction cannot be that drill's answer.
 */
function withRealTransferVariant(lesson: GuidedLessonDefinition): GuidedLessonDefinition {
  const variant = guidedTransferVariantByLessonScenarioId[lesson.scenarioId]
  if (!variant) return lesson
  // Called for its failure: a transfer into a scenario that does not exist refuses to construct.
  requireScenario(variant.scenarioId)
  const { transferPrinciple } = ecmoDrillSpec(lesson.scenarioId)
  return {
    ...lesson,
    steps: lesson.steps.map((lessonStep) =>
      lessonStep.phase === 'transfer'
        ? {
            ...lessonStep,
            title: ECMO_TRANSFER_STEP_TITLE,
            instruction: variant.scaffolded
              ? `${ECMO_SCAFFOLDED_TRANSFER_PREFIX}${variant.instruction}`
              : variant.instruction,
            rationale: transferPrinciple,
            target: variant.target,
            preferredCircuitView: variant.preferredCircuitView,
            actionLabel: variant.actionLabel,
            actions: [variant.action],
            expectedResponse: variant.expectedResponse,
            transferScenarioId: variant.scenarioId,
            transferVariantId: `${lesson.scenarioId}-to-${variant.scenarioId}`,
            transferSetupActions: variant.setupActions ?? [],
          }
        : lessonStep,
    ),
  }
}

const baseCardiohelpLearnLessons: readonly GuidedLessonDefinition[] = [
  orientationLesson,
  standardLesson({
    scenarioId: 'preload-drainage-collapse',
    observe: {
      target: 'circuit',
      instruction:
        'Read blood flow, pVen and the drainage line as one pattern, then read the two post-pump pressures against them.',
      preferredCircuitView: 'diagnostic',
      rationale:
        'Three readings sit on the drainage side of the pump and two sit beyond it. Which of them moved, and in which direction, is what the pattern has to tell you before any setting is touched.',
      expectedResponse: [
        'Flow falling, or swinging from one moment to the next',
        'pVen more negative than at the opening of the run',
        'Drainage chatter shown on the line and named in text',
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
    observe: {
      target: 'circuit',
      instruction: 'Compare pInt, pArt, the Δp trend and flow as one pressure pattern.',
      preferredCircuitView: 'diagnostic',
      rationale:
        'Two pressures sit either side of the membrane, and the Δp trend is their difference over time. Read whether the two moved together or apart, and what the flow did while they moved.',
      expectedResponse: [
        'pInt rises',
        'pArt rises with it',
        'Flow falls at an unchanged speed',
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
    observe: {
      target: 'circuit',
      instruction:
        'Compare pre-oxygenator pInt with post-oxygenator pArt, and the direction of the Δp trend.',
      preferredCircuitView: 'diagnostic',
      rationale:
        'The same two pressures, read the same way: together or apart, and what the flow did at an unchanged speed. Compare the Δp trend with where it sat earlier in the run at a similar flow, and read the post-membrane saturation beside it.',
      expectedResponse: [
        'pInt rises while pArt does not',
        'Δp trend rises',
        'Flow lower at the same speed',
        'Post-membrane saturation lower than this morning',
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
    observe: {
      target: 'patient-monitor',
      instruction:
        'Read displayed flow beside the patient’s SpO₂ and the pre-oxygenator saturation, and note which way each has moved since the run was steady.',
      rationale:
        // A reason to look, not the mechanism. This rationale runs on the step before the
        // prediction, so it names the three places to read and the comparison to make, and leaves
        // what the comparison means to the verdict.
        'Three readings from three places: the flow at the pump, the saturation drawn back into the circuit, and the patient’s own. Compare the second with the third before deciding what the first is worth.',
      expectedResponse: [
        'Displayed flow high, and unchanged or rising',
        'Patient SpO₂ drifting down',
        'Pre-oxygenator saturation climbing toward the patient’s own',
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
          'No speed escalation was needed, and none would have helped',
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
    observe: {
      target: 'patient-monitor',
      instruction:
        'Read PaCO₂, pH, bicarbonate, work of breathing, and the stabilization phase together.',
      rationale:
        'Four readings and a phase. Read the pH beside the CO₂, the bicarbonate beside both, and the work of breathing beside all three, and note whether the picture is settled or still moving.',
      expectedResponse: [
        'PaCO₂ high and climbing',
        'pH low',
        'Bicarbonate not raised',
        'Work of breathing high',
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
    observe: {
      target: 'patient-monitor',
      instruction:
        'Compare the PaCO₂ with the pH, the bicarbonate, the work of breathing and the phase of the run.',
      rationale:
        'The same four readings and the same phase question as before. Read them as one picture and note which of them has moved and which has not.',
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
    observe: {
      target: 'gas-panel',
      instruction:
        'Advance to the event, then compare the gas panel, the blood flow, the circuit pressures, the PaCO₂ and the patient’s oxygenation.',
      rationale:
        'Four rows to read rather than one status: the blood path, the gas panel, what the membrane is returning, and the patient. Compare what has moved with what has not.',
      expectedResponse: [
        'Set sweep and delivered sweep disagree',
        'Blood flow and the circuit pressures unchanged',
        'PaCO₂ rising',
        'Post-membrane saturation falls',
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
    observe: {
      target: 'console',
      instruction:
        'Advance to the bubble event and read the text alarm, pump state, and circuit bubble latch.',
      rationale:
        'Read the alarm text, the pump state, the flow, the two clamps and the latch as five separate facts. Note which of them the device changed on its own and which it did not.',
      expectedResponse: [
        'High-priority arterial bubble alarm',
        'Pump stopped, flow reading zero',
        'Both near-patient clamps still open',
        'Bubble latch set; reset still required',
      ],
    },
    responseSteps: [
      {
        id: 'isolate-return-clamp',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Isolate the patient: clamp the return limb',
        instruction:
          'The device stopped the pump, but a stopped pump does not isolate the air column. Close the return-limb clamp near the patient first.',
        rationale:
          'The near-patient return clamp is what stops circuit air from reaching the patient.',
        actionLabel: 'Close the return-limb clamp',
        actions: [{ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }],
        expectedResponse: ['Return clamp CLOSED', 'Patient isolated from the return limb'],
      },
      {
        id: 'isolate-drainage-clamp',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Complete isolation: clamp the drainage limb',
        instruction:
          'Close the drainage-limb clamp near the patient so the circuit is fully isolated before de-airing.',
        rationale:
          'With both limbs clamped, the circuit can be worked on without exposing the patient.',
        actionLabel: 'Close the drainage-limb clamp',
        actions: [{ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true }],
        expectedResponse: ['Drainage clamp CLOSED', 'Circuit isolated from the patient'],
      },
      {
        id: 'correct-bubble-source',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Correct and clear the air source',
        instruction:
          'With the circuit isolated, correct the source of air and confirm the return path is bubble free.',
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
        id: 'resume-support',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Resume support per the current IFU and approved local protocol',
        instruction:
          'With the source corrected and the circuit confirmed clear, resume support according to the current manufacturer instructions for use (IFU) and your unit’s approved ECMO air-emergency protocol.',
        rationale:
          'This module does not teach where clamp opening, pump restart and console reset fall relative to one another during resumption: that choreography is device- and program-specific. What it does teach is the precondition — nothing resumes until the air source is corrected and the circuit is confirmed clear. This single simulated action stands in for the device- and program-specific resumption sequence; it does not reproduce or teach that sequence.',
        actionLabel: 'Resume support per current IFU and approved local protocol',
        actions: [{ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }],
        expectedResponse: [
          'Support resumes as one bounded step, with no moment where both limbs are open on a stopped pump',
          'The bubble latch clears and the pump runs',
          'Where clamp opening, pump restart and console reset fall relative to one another is governed by the current IFU and your approved local protocol, not by this simulation',
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
    observe: {
      target: 'console',
      instruction:
        'Advance to the event, then read the power-source indicator, the reserve reading, the circuit flow and the patient.',
      rationale:
        'Four readings: which source the console says it is on, how much reserve it reports and which way that is moving, whether flow paused, and whether the patient changed. Read them before deciding what the moment calls for.',
      expectedResponse: [
        'Power-source indicator shows battery',
        'Reserve reading falling',
        'Circuit flow and pressures unchanged',
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
        actionLabel: 'Restore AC power',
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
    observe: {
      target: 'circuit',
      instruction:
        'Read flow, pVen and the drainage line together, then the MAP, the arterial trace and the patient’s perfusion beside them.',
      preferredCircuitView: 'diagnostic',
      rationale:
        'The same three drainage-side readings as on VV, and now two more on the patient: the mean pressure and the pulse under it. Read which moved with the flow and which did not.',
      expectedResponse: [
        'Flow swinging from one moment to the next',
        'pVen more negative than at handover',
        'Drainage chatter shown on the line and named in text',
        'MAP lower than at handover, with the pulse under it unchanged',
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
    observe: {
      target: 'circuit',
      instruction:
        'Compare pInt, pArt, the pressure-drop trend, flow, the arterial return limb, and the independent MAP.',
      preferredCircuitView: 'diagnostic',
      rationale:
        'Two circuit pressures and their trend, then the patient’s own arterial line on its own monitor beside them. Read whether the circuit pair moved together or apart, and whether the patient’s pressure moved with them.',
      expectedResponse: [
        'pInt and pArt rise together',
        'Flow falls at an unchanged speed',
        'Pressure-drop trend changes comparatively little',
        'Patient MAP and pulse unchanged on the independent monitor',
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
    observe: {
      target: 'circuit',
      instruction:
        'Compare pInt, pArt, the pressure-drop trend, matched flow and speed, and gas transfer.',
      preferredCircuitView: 'diagnostic',
      rationale:
        'The same pair read the same way, at an unchanged speed. Compare the trend between them with where it sat earlier at a similar flow, and read the post-membrane saturation beside it.',
      expectedResponse: [
        'pInt rises while pArt does not',
        'Pressure-drop trend rises',
        'Flow lower at the same speed',
        'Post-membrane saturation lower than this morning',
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
    observe: {
      target: 'patient-monitor',
      instruction:
        'Compare right-radial saturation, femoral-arterial saturation, post-oxygenator saturation, pulse pressure, and native lung status.',
      rationale:
        'Three saturations from three places, and the arterial trace beside them. Read which of the three disagree, and whether the trace shows the heart is ejecting.',
      expectedResponse: [
        'Low right-radial SpO₂',
        'Femoral and post-oxygenator saturations high',
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
    observe: {
      target: 'patient-monitor',
      instruction:
        'Compare flow and MAP with pulse pressure, aortic-valve opening, native output, and pulmonary congestion.',
      rationale:
        'Two numbers that look acceptable, and four signals that do not: the pulse pressure, the valve, the estimated native output and the chest. Read the second group beside the first.',
      expectedResponse: [
        'Narrow pulse pressure',
        'Aortic valve not seen to open',
        'Marked pulmonary congestion',
        'Flow and MAP in their usual range',
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
          'This module teaches recognition and escalation rather than a universal unloading device or threshold.',
        actionLabel: 'Escalate for unloading evaluation',
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
    observe: {
      target: 'patient-monitor',
      instruction:
        'Read PaCO₂, pH, bicarbonate, right-arm oxygenation, perfusion, and phase together.',
      rationale:
        'The acid–base readings first, then everything VA adds: the right-arm saturation, the pressure and the pulse, the lactate and the chest. Read which group has moved.',
      expectedResponse: [
        'PaCO₂ high',
        'pH low, with the bicarbonate not raised',
        'Right-arm saturation, MAP and pulse pressure unchanged',
      ],
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
        'Device, circuit and patient still each need reading',
      ],
    },
  }),
  standardLesson({
    scenarioId: 'va-gas-source-interruption',
    observe: {
      target: 'gas-panel',
      instruction:
        'Advance to the event, then compare the gas panel, the circuit flow and pressures, the post-membrane saturation, both arterial saturations and the PaCO₂.',
      rationale:
        'Five rows: the blood path, the gas panel, what the membrane is returning, the two arterial sites, and the gas values. Compare what has moved with what has not, and note whether the two arterial sites moved together or apart.',
      expectedResponse: [
        'Set sweep and delivered sweep disagree',
        'Circuit flow and pressures unchanged',
        'Post-membrane saturation falls',
        'Right-arm and femoral saturations fall together',
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
    observe: {
      target: 'console',
      instruction:
        'Advance to the event and read the text alarm, pump state, flow, and arterial-return bubble latch.',
      rationale:
        'Read the alarm text, the pump state, the flow, the two clamps, the latch and the patient’s pressure as separate facts. Note which the device changed on its own, and what the circulation is doing without the circuit’s share.',
      expectedResponse: [
        'High-priority bubble alarm on the arterial return limb',
        'Pump stopped, flow reading zero',
        'Both near-patient clamps still open',
        'MAP falling; bubble latch set',
      ],
    },
    responseSteps: [
      {
        id: 'isolate-return-clamp',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Isolate the patient: clamp the arterial return limb',
        instruction:
          'The device stopped the pump, but arterial air remains a direct embolic threat. Close the return-limb clamp near the patient first.',
        rationale:
          'On VA support the return limb feeds the arterial circulation; the near-patient clamp is the isolation step.',
        actionLabel: 'Close the return-limb clamp',
        actions: [{ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }],
        expectedResponse: ['Return clamp CLOSED', 'Arterial circulation isolated from circuit air'],
      },
      {
        id: 'isolate-drainage-clamp',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Complete isolation: clamp the drainage limb',
        instruction: 'Close the drainage-limb clamp so the circuit is fully isolated.',
        rationale:
          'Full isolation lets the team manage the patient conventionally while the circuit is cleared.',
        actionLabel: 'Close the drainage-limb clamp',
        actions: [{ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true }],
        expectedResponse: ['Drainage clamp CLOSED', 'Circuit isolated from the patient'],
      },
      {
        id: 'correct-bubble-source',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Correct and clear the air source',
        instruction:
          'Identify and correct the source of air and confirm the arterial return path is clear.',
        rationale: 'Premature reset risks arterial air return and is a critical Practice error.',
        actionLabel: 'Correct the source and clear the circuit',
        actions: [{ type: 'CORRECT_FAULT', fault: 'arterial-bubble' }],
        expectedResponse: ['Air source corrected', 'Reset remains deliberate and separate'],
      },
      {
        id: 'resume-support',
        target: 'circuit',
        preferredCircuitView: 'bedside',
        title: 'Resume support per the current IFU and approved local protocol',
        instruction:
          'With the source corrected and the circuit confirmed clear, resume venoarterial support according to the current manufacturer instructions for use (IFU) and your unit’s approved ECMO air-emergency protocol.',
        rationale:
          'This module does not teach where clamp opening, pump restart and console reset fall relative to one another during resumption: that choreography is device- and program-specific. What it does teach is the precondition — nothing resumes until the air source is corrected and the circuit is confirmed clear. This single simulated action stands in for the device- and program-specific resumption sequence; it does not reproduce or teach that sequence.',
        actionLabel: 'Resume support per current IFU and approved local protocol',
        actions: [{ type: 'RESUME_SUPPORT_AFTER_BUBBLE' }],
        expectedResponse: [
          'Support resumes as one bounded step, with no moment where both limbs are open on a stopped pump',
          'The bubble latch clears and the pump runs',
          'Where clamp opening, pump restart and console reset fall relative to one another is governed by the current IFU and your approved local protocol, not by this simulation',
        ],
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
    observe: {
      target: 'console',
      instruction:
        'Advance to the event, then read the power-source indicator, the reserve reading, the circuit flow and pressures, the arterial trace and the right-arm saturation.',
      rationale:
        'The same four readings as on VV — source, reserve and its direction, flow, patient — and now the arterial trace beside them, because here the circulation is what the flow is carrying.',
      expectedResponse: [
        'Power-source indicator shows battery',
        'Reserve reading falling',
        'Circuit flow, pressures and the arterial trace unchanged',
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
        actionLabel: 'Restore AC power',
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

export const cardiohelpLearnLessons: readonly GuidedLessonDefinition[] =
  baseCardiohelpLearnLessons.map(withRealTransferVariant)

export const cardiohelpLearnLessonByScenarioId = new Map(
  cardiohelpLearnLessons.map((lesson) => [lesson.scenarioId, lesson]),
)

export const cardiohelpLearnLessonsBySupportMode: Readonly<
  Record<SupportMode, readonly GuidedLessonDefinition[]>
> = {
  vv: cardiohelpLearnLessons.filter((lesson) => lesson.supportMode === 'vv'),
  va: cardiohelpLearnLessons.filter((lesson) => lesson.supportMode === 'va'),
}

const CAPSTONE_SCENARIO_IDS = new Set(['vv-off-sweep-capstone', 'va-mixed-circulation-capstone'])

/**
 * A capstone scenario may be wrapped by exactly one guided lesson: the track's integration lesson
 * (WP10 §5.1). The unseen assessment capstone on the same scenario is unaffected. Before WP10 any
 * lesson wrapping a capstone scenario was rejected outright, which made a capstone lesson
 * impossible to author.
 */
export function capstoneLessonErrors(lesson: GuidedLessonDefinition): string[] {
  if (!CAPSTONE_SCENARIO_IDS.has(lesson.scenarioId)) return []
  if (lesson.curriculumStage === 'integration') return []
  return [
    `${lesson.id}: only an integration-stage lesson may wrap the capstone scenario ${lesson.scenarioId}`,
  ]
}

export function validateGuidedLessonRegistry(): string[] {
  const errors: string[] = []
  const lessonIds = new Set<string>()
  const scenarioIds = new Set<string>()
  const capstoneIds = new Set(['vv-off-sweep-capstone', 'va-mixed-circulation-capstone'])
  const eligibleScenarioIds = cardiohelpScenarios
    .filter((scenario) => !capstoneIds.has(scenario.id))
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
    errors.push(...capstoneLessonErrors(lesson))
    if (!lesson.title.trim()) errors.push(`${lesson.id}: missing title`)
    if (!lesson.learningObjectives.length) errors.push(`${lesson.id}: missing objectives`)

    // The lesson header and the pathway rail show one string, and the human-testing packet pins
    // it: the lesson is named by its pathway row, on the track it belongs to.
    const pathwaySection = criticalCareLearningPathway(
      'cardiohelp-ecmo',
      lesson.supportMode,
    ).sections.find((section) => section.id === lesson.scenarioId)
    if (!pathwaySection) {
      errors.push(`${lesson.id}: no ${lesson.supportMode} pathway section carries it`)
    } else if (pathwaySection.title !== lesson.title) {
      errors.push(
        `${lesson.id}: titled "${lesson.title}" where the pathway says "${pathwaySection.title}"`,
      )
    }

    // One objective, and it is the section spec's: the discrimination, never the move.
    const sectionSpec = ecmoSectionSpecById.get(lesson.scenarioId)
    if (!sectionSpec) {
      errors.push(`${lesson.id}: no section spec states its objective`)
    } else if (
      lesson.learningObjectives.length !== 1 ||
      lesson.learningObjectives[0] !== sectionSpec.objective
    ) {
      errors.push(
        `${lesson.id}: states an objective other than the section spec's, or more than one`,
      )
    }

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
      if (item.phase === 'transfer') {
        if (!item.transferVariantId || !item.transferScenarioId) {
          errors.push(`${lesson.id}/${item.id}: transfer requires an authored scenario variant`)
        }
        if (item.transferScenarioId === lesson.scenarioId) {
          errors.push(`${lesson.id}/${item.id}: transfer must use a different scenario`)
        }
        if (item.title !== ECMO_TRANSFER_STEP_TITLE) {
          errors.push(`${lesson.id}/${item.id}: a transfer step carries the one transfer title`)
        }
        if (item.rationale !== ecmoDrillSpec(lesson.scenarioId).transferPrinciple) {
          errors.push(
            `${lesson.id}/${item.id}: the transfer rationale is the drill's transfer principle`,
          )
        }
        // Exactly the transfers into the gas-path and air drills are worked examples, and say so.
        const transferTarget = item.transferScenarioId
          ? cardiohelpScenarioById.get(item.transferScenarioId)
          : undefined
        const mustDisclose =
          transferTarget?.family === 'gas-source' || transferTarget?.family === 'bubble'
        const discloses = item.instruction.startsWith(ECMO_SCAFFOLDED_TRANSFER_PREFIX)
        if (mustDisclose && !discloses) {
          errors.push(
            `${lesson.id}/${item.id}: a transfer into a ${transferTarget?.family} drill names the fix and must say it is a worked example`,
          )
        }
        if (discloses && !mustDisclose) {
          errors.push(
            `${lesson.id}/${item.id}: only a transfer into a gas-path or air drill is a worked example`,
          )
        }
        if (item.actions.length !== 1) {
          errors.push(`${lesson.id}/${item.id}: transfer requires one observable learner action`)
        }
        const transferScenario = item.transferScenarioId
          ? cardiohelpScenarioById.get(item.transferScenarioId)
          : undefined
        if (!transferScenario || transferScenario.supportMode !== lesson.supportMode) {
          errors.push(`${lesson.id}/${item.id}: transfer scenario must exist in the same track`)
        }
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

    // Families where escalating speed is the reflex the lesson exists to discourage, and where the
    // engine now issues a critical error for it. A scripted step that told the learner to do it
    // would score them for following the instructions.
    if (scenario?.family === 'preload' || scenario?.family === 'recirculation') {
      const initialRpm = scenario?.initialState.device?.rpmSetpoint ?? 0
      if (
        lesson.steps.some((item) =>
          item.actions.some((action) => action.type === 'SET_RPM' && action.rpm > initialRpm),
        )
      ) {
        errors.push(`${lesson.id}: ${scenario.family} lesson cannot escalate RPM`)
      }
    }

    if (scenario?.family === 'bubble') {
      const actions = lesson.steps.flatMap((item) => item.actions)
      const correctIndex = actions.findIndex(
        (action) => action.type === 'CORRECT_FAULT' && action.fault === 'arterial-bubble',
      )
      const resumeIndex = actions.findIndex(
        (action) => action.type === 'RESUME_SUPPORT_AFTER_BUBBLE',
      )
      if (correctIndex < 0 || resumeIndex < 0 || resumeIndex < correctIndex) {
        errors.push(`${lesson.id}: bubble source correction must precede resumption`)
      }
      const clampIndex = (limb: 'drainage' | 'return', closed: boolean) =>
        actions.findIndex(
          (action) =>
            action.type === 'TOGGLE_CIRCUIT_CLAMP' &&
            action.limb === limb &&
            (action.closed ?? true) === closed,
        )
      const closeReturn = clampIndex('return', true)
      const closeDrainage = clampIndex('drainage', true)
      if (
        closeReturn < 0 ||
        closeDrainage < 0 ||
        closeReturn > correctIndex ||
        closeDrainage > correctIndex
      ) {
        errors.push(`${lesson.id}: both clamps must close before the air source is corrected`)
      }
      /*
       * Nothing may touch a clamp after the source is corrected.
       *
       * Isolation is taught because it is what separates the patient from an air column, and it is
       * supported wherever air is found. Coming back is different: the order of clamps, pump and
       * reset is set by the manufacturer instructions and the unit's own protocol, and the order
       * this module used to teach walked the learner through both limbs open on a stopped
       * centrifugal pump. Resumption is one bounded action now, and this keeps it that way.
       */
      if (
        actions.slice(correctIndex + 1).some((action) => action.type === 'TOGGLE_CIRCUIT_CLAMP')
      ) {
        errors.push(
          `${lesson.id}: teaches a clamp order for resumption; resume with one bounded action instead`,
        )
      }
    }
  }

  for (const scenarioId of eligibleScenarioIds) {
    if (!scenarioIds.has(scenarioId)) errors.push(`Missing guided lesson for ${scenarioId}`)
  }

  return errors
}
