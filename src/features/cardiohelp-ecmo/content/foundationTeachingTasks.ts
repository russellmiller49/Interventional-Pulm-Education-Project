import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import type { EcmoCircuitWalkStopId } from './circuitWalk'
import type { EcmoPhaseLocation, EcmoSharedFoundationSectionId } from './foundationLessonRuntime'

/** Opt-in teaching sequences for the four introductory Learn sections only. */
export interface EcmoFoundationTeachingTask {
  readonly id: string
  readonly phase: CriticalCareActivityPhase
  readonly title: string
  readonly instruction: string
  readonly block: string
  readonly lookIn: EcmoPhaseLocation
  readonly actionId?: string
  readonly comparisonOf?: string
  readonly walkStopId?: EcmoCircuitWalkStopId
  readonly mapRetrieval?: boolean
  readonly attribution?: boolean
  readonly storyProblemId?: string
}

const teaching = (landmark: string): EcmoPhaseLocation => ({ pane: 'teaching', landmark })
const steps = (landmark: string): EcmoPhaseLocation => ({ pane: 'steps', landmark })
const comparison = (landmark: string): EcmoPhaseLocation => ({
  pane: 'steps',
  landmark: 'the guided comparison below',
  alsoPane: 'teaching',
  alsoLandmark: landmark,
})

export const ecmoFoundationTeachingTasks: Readonly<
  Record<EcmoSharedFoundationSectionId, readonly EcmoFoundationTeachingTask[]>
> = {
  'why-extracorporeal-support': [
    {
      id: 'recognize',
      phase: 'recognize',
      title: 'Start with oxygen delivery',
      block: 'delivery',
      instruction:
        'Read the relationship between blood flow and oxygen content. Then distinguish oxygen saturation from oxygen delivery.',
      lookIn: teaching('Oxygen delivery, component by component'),
    },
    {
      id: 'worked-example',
      phase: 'explain',
      title: 'Follow a worked example',
      block: 'support-example',
      instruction:
        'Follow the example of rising oxygen demand. Read what ECMO supports on your selected track and what still needs treatment.',
      lookIn: teaching('Support while the cause is treated'),
    },
    {
      id: 'predict',
      phase: 'predict',
      title: 'Apply the relationship',
      block: 'application',
      instruction:
        'A new patient. Decide what the saturation does and does not tell you about oxygen delivery.',
      lookIn: steps('the answer choices below'),
    },
    {
      id: 'act',
      phase: 'act',
      title: 'Identify what each change affects',
      block: 'application',
      attribution: true,
      instruction:
        'For each change, choose the part of the oxygen balance it acts on: blood flow, oxygen content, or oxygen consumption.',
      lookIn: steps('the changes to attribute below'),
    },
    {
      id: 'transfer',
      phase: 'transfer',
      title: 'Consider a different patient',
      block: 'application',
      instruction: 'Read the new case and identify the impaired part of the oxygen balance.',
      lookIn: steps('the answer choices below'),
    },
  ],
  'circuit-flow-path': [
    {
      id: 'recognize',
      phase: 'recognize',
      title: 'Follow the blood',
      block: 'blood-path',
      instruction:
        'Follow blood from drainage through the pump and membrane lung to return. Each stop is highlighted in yellow on the circuit map.',
      lookIn: teaching('Circuit walk'),
    },
    {
      id: 'gas-path',
      phase: 'explain',
      title: 'Follow the separate gas path',
      block: 'gas-path',
      instruction:
        'Trace gas from the supply through the membrane lung to exhaust. Compare the dashed gas path with the blood path.',
      lookIn: teaching('Sweep-gas path'),
    },
    {
      id: 'pressure-sites',
      phase: 'act',
      title: 'Find the pressure measurements',
      block: 'pressure-sites',
      instruction:
        'Select pVen, pInt, pArt and Δp on the left, one at a time. The circuit map rings where each one is measured. Δp, the pressure drop the console calculates between pInt and pArt, is not a fourth sensor; the readouts show it as the Δp trend.',
      lookIn: teaching('Pressure measurements'),
    },
    {
      id: 'observe',
      phase: 'observe',
      title: 'Compare circuit and patient readings',
      block: 'circuit-patient',
      instruction:
        'Compare the circuit’s pArt with the patient’s MAP. Both are highlighted in yellow: pArt on the circuit map, MAP on the bedside monitor.',
      lookIn: teaching('Circuit pressure and patient pressure'),
    },
    {
      id: 'predict',
      phase: 'predict',
      // S2-1 (ECMO-FELLOW-04): this said "from memory" and that the map "now omits pressure labels",
      // while the stage draws the map with its sensor flags and Δp bracket on every task. The labels
      // stay — they are the teaching — and the task now describes the optional check it actually is.
      title: 'Locate a measurement on the map',
      block: 'application',
      mapRetrieval: true,
      // The labels are withheld until the answer is in; the host now honours `mapRetrieval` (it
      // passed "full" for every task, and a tester answered with the pInt label in view).
      instruction:
        'Find where the circuit measures this pressure. The map’s sensor labels are hidden until you answer.',
      lookIn: { pane: 'simulator', landmark: 'the map question and Submit answer control' },
    },
    {
      id: 'transfer',
      phase: 'transfer',
      title: 'Interpret a different reading',
      block: 'application',
      instruction:
        'Apply the distinction between a circuit measurement and a patient measurement to this new example.',
      lookIn: steps('the answer choices below'),
    },
  ],
  'pump-and-pressure-zones': [
    {
      id: 'recognize',
      phase: 'recognize',
      title: 'Read the settled reference',
      block: 'pump-setting',
      walkStopId: 'walk-pump-under-load',
      instruction:
        'Read the two numbers on the left: pump speed is the setting, blood flow is the result. The next tasks change one thing at a time and watch the other.',
      lookIn: teaching('Setting and resulting flow'),
    },
    {
      id: 'act',
      phase: 'act',
      title: 'Watch one speed change',
      block: 'pump-speed',
      actionId: 'increase-rpm',
      walkStopId: 'walk-pump-under-load',
      instruction:
        'Use Increase pump speed by 300 rpm below, then read what changed: flow, pVen, and the pressures after the pump.',
      lookIn: comparison('The speed comparison'),
    },
    {
      id: 'loading',
      phase: 'act',
      title: 'Keep speed, change the load',
      block: 'pump-load',
      actionId: 'load-return-resistance',
      walkStopId: 'walk-downstream-load',
      instruction:
        'Load the existing return-resistance preview using the guided comparison below. Compare its speed and flow with the unchanged reference circuit.',
      lookIn: comparison('The loading comparison'),
    },
    {
      id: 'predict',
      phase: 'predict',
      title: 'Predict a different speed change',
      block: 'application',
      instruction:
        'Apply what you observed to a speed decrease on a circuit with unchanged loading. Choose an answer if you want to check your reasoning; the explanation can also be opened without answering.',
      lookIn: steps('the answer choices below'),
    },
    {
      id: 'decrease',
      phase: 'act',
      title: 'Check the speed decrease',
      block: 'pump-result',
      actionId: 'decrease-rpm',
      instruction:
        'Run the separate decrease by 300 rpm from the unchanged reference. Compare the observed response with your prediction.',
      lookIn: comparison('Read the saved comparison'),
    },
    {
      id: 'transfer',
      phase: 'transfer',
      title: 'Apply the loading principle',
      block: 'application',
      instruction:
        'Use the speed, flow and drainage-pressure trend in this case to decide where the problem is.',
      lookIn: { pane: 'simulator', landmark: 'the map question and Submit answer control' },
    },
  ],
  'blood-flow-versus-sweep': [
    {
      id: 'recognize',
      phase: 'recognize',
      title: 'Find the three adjustments',
      block: 'controls',
      instruction:
        'Locate pump speed on the console and the two external gas adjustments. The display is observation-only here; use the guided controls in the next steps.',
      lookIn: teaching('Three adjustments, two control locations'),
    },
    {
      id: 'pump',
      phase: 'act',
      title: 'Watch the pump-speed comparison',
      block: 'control-pump',
      actionId: 'increase-rpm-for-gas-comparison',
      instruction:
        'Read the pump-speed explanation, then use the guided comparison below. Compare its result with the retained starting values.',
      lookIn: comparison('Pump speed'),
    },
    {
      id: 'sweep',
      phase: 'act',
      title: 'Watch the sweep comparison',
      block: 'control-sweep',
      actionId: 'increase-sweep',
      instruction:
        'Run the sweep comparison below. It starts from the original reference, so the earlier pump-speed change is not carried into it.',
      lookIn: comparison('Sweep-gas flow'),
    },
    {
      id: 'oxygen',
      phase: 'act',
      title: 'Watch the oxygen-fraction comparison',
      block: 'control-oxygen',
      actionId: 'compare-oxygen-fraction',
      instruction:
        'Run the oxygen-fraction comparison below. It lowers the sweep-gas oxygen fraction from the same reference while holding sweep and pump speed unchanged.',
      lookIn: comparison('Sweep-gas oxygen fraction'),
    },
    {
      id: 'predict',
      phase: 'predict',
      title: 'Choose a control for a new example',
      block: 'application',
      instruction:
        'Use the three-control distinction to answer this teaching case. A response to a control does not by itself diagnose the cause of a patient problem.',
      lookIn: steps('the answer choices below'),
    },
    {
      id: 'sweep-story',
      phase: 'observe',
      title: 'Try the sweep story',
      block: 'application',
      actionId: 'double-sweep',
      storyProblemId: 'story-doubled-sweep',
      instruction:
        'Predict the response in this story, then run its own comparison from the reference. Read the result before continuing.',
      lookIn: steps('the story choices and guided comparison below'),
    },
    {
      id: 'speed-story',
      phase: 'observe',
      title: 'Try the speed story',
      block: 'application',
      actionId: 'increase-rpm-by-400',
      storyProblemId: 'story-raised-speed',
      instruction:
        'Predict the response in the second story, then run its separate comparison. The previous sweep change is not carried into it.',
      lookIn: steps('the story choices and guided comparison below'),
    },
    {
      id: 'transfer',
      phase: 'transfer',
      title: 'Interpret the flow display',
      block: 'application',
      instruction:
        'Read the changed clinical example and decide what the displayed blood flow establishes.',
      lookIn: steps('the answer choices below'),
    },
  ],
}
