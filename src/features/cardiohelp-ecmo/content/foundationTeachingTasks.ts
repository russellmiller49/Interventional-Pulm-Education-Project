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
        'Use the information in this separate teaching case to interpret the saturation. Choose an answer, then submit it.',
      lookIn: steps('the answer choices below'),
    },
    {
      id: 'act',
      phase: 'act',
      title: 'Identify what each change affects',
      block: 'application',
      attribution: true,
      instruction:
        'For each proposed change, choose blood flow, oxygen content, or oxygen consumption. Submit the set to read the reasoning.',
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
        'Use Next in the Circuit walk to follow blood from drainage through the pump and membrane lung to return. The same segment is marked on the existing circuit map.',
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
        'Select each pressure label in the Teaching panel. Its location is named beside the reading and marked on the map. Finish with the derived pressure difference, ΔP.',
      lookIn: teaching('Pressure measurements'),
    },
    {
      id: 'observe',
      phase: 'observe',
      title: 'Compare circuit and patient readings',
      block: 'circuit-patient',
      instruction:
        'Read circuit pArt alongside the independent patient monitor. These measurements describe different places.',
      lookIn: teaching('Circuit pressure and patient pressure'),
    },
    {
      id: 'predict',
      phase: 'predict',
      title: 'Locate a measurement from memory',
      block: 'application',
      mapRetrieval: true,
      instruction:
        'The map now omits pressure labels and stop highlighting for this retrieval check. Select a numbered location, then submit beside the map.',
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
        'Identify pump speed as the selected setting and blood flow as its measured result. Read how drainage and downstream resistance affect that relationship.',
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
        'Use Increase pump speed by 300 rpm below. The guided control restores the reference, changes only speed, and retains the response after six modeled seconds.',
      lookIn: comparison('The speed comparison'),
    },
    {
      id: 'observe',
      phase: 'observe',
      title: 'Compare the result',
      block: 'pump-result',
      comparisonOf: 'act',
      instruction:
        'Read Before, After, and Change for flow and pressures. These are the saved values from your speed comparison.',
      lookIn: steps('the saved comparison below'),
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
        'Apply what you observed to a speed decrease on a circuit with unchanged loading. Submit your prediction before reading the explanation.',
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
        'Use the speed, flow, and drainage-pressure trend in this separate case. Select a place on the map and submit beside it.',
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
        'Predict the response in this authored story, then run its own comparison from the reference. Read the result before continuing.',
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
