import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import type { EcmoSharedFoundationSectionId } from './foundationLessonRuntime'

/**
 * Prediction and transfer items for the four shared foundation lessons.
 *
 * Transfer is deliberately a different situation rather than the same question with the nouns
 * swapped: a learner who has understood the ledger should be able to reach a content problem from
 * a flow problem, and a learner who has only memorised the first answer should not.
 *
 * Saturations are written without a unit symbol throughout — the learner-copy lint bars it, and
 * the alternative spelling reads no worse.
 */
export interface EcmoFoundationLearningItems {
  readonly prediction: ClinicalLearningItem
  readonly transfer: ClinicalLearningItem
}

const coreSources = ['ecmo-book-ch9', 'elso-circuit-2022', 'bounded-educational-model'] as const

function activityId(sectionId: EcmoSharedFoundationSectionId): string {
  return `ecmo:learn:${sectionId}`
}

const authored: Readonly<Record<EcmoSharedFoundationSectionId, EcmoFoundationLearningItems>> = {
  'why-extracorporeal-support': {
    prediction: {
      id: 'ecmo.foundation.why.prediction',
      activityId: activityId('why-extracorporeal-support'),
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'context-independent',
      stem: 'An arterial saturation reading of 96 is reported in a patient whose hemoglobin is 6.4 g/dL and whose cardiac output is low. What does the saturation on its own establish about oxygen delivery to the tissues?',
      choices: [
        {
          id: 'content-and-flow-still-unknown',
          label:
            'Very little — saturation is one part of content, and content still has to be multiplied by a flow.',
          plausibility: 'best',
          rationale:
            'Delivery is flow multiplied by content, and content is dominated by hemoglobin as well as saturation. A high saturation on a low hemoglobin at a low flow can accompany markedly reduced delivery.',
        },
        {
          id: 'delivery-adequate',
          label:
            'Delivery is adequate, because the blood leaving the lungs is nearly fully saturated.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Saturation describes the fraction of available hemoglobin carrying oxygen, not how much hemoglobin there is or how fast it is moving.',
        },
        {
          id: 'only-consumption-matters',
          label: 'Nothing can be said until oxygen consumption is measured.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Consumption is genuinely part of the ledger, but the delivery side can already be recognised as compromised from the hemoglobin and the flow.',
        },
        {
          id: 'raise-saturation-first',
          label: 'Raise the saturation further before considering anything else.',
          plausibility: 'unsafe',
          rationale:
            'There is very little room left on the saturation term, and acting there leaves the two terms that are actually reduced untouched.',
        },
      ],
      correctChoiceIds: ['content-and-flow-still-unknown'],
      explanation:
        'The ledger has three separable terms. Content depends mainly on hemoglobin and its saturation; flow is separate; consumption sits on the other side. A reassuring value in one term says nothing about the other two, which is why extracorporeal support is chosen by naming the step that has given way rather than by reading one number.',
      evidenceIds: [...coreSources],
      reviewStatus: 'draft',
    },
    transfer: {
      id: 'ecmo.foundation.why.transfer',
      activityId: activityId('why-extracorporeal-support'),
      phase: 'transfer',
      itemType: 'transfer-case',
      transferVariantId: 'ecmo.foundation.why.transfer-variant',
      contextRequirement: 'context-independent',
      stem: 'A different patient has a saturation reading of 99 and a normal cardiac output, but a hemoglobin of 4.9 g/dL after ongoing bleeding. Which term of the delivery ledger has given way, and why would a saturation display be reassuring here?',
      choices: [
        {
          id: 'content-via-hemoglobin',
          label:
            'Content — the carrier itself is depleted, and saturation only reports the fraction of that reduced carrier that is loaded.',
          plausibility: 'best',
          rationale:
            'Saturation is a ratio. It stays high while the quantity being saturated falls, which is exactly why it reads as reassuring in profound anemia.',
        },
        {
          id: 'flow-term',
          label: 'Flow — a bleeding patient must have inadequate cardiac output.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Cardiac output is stated to be normal here, and can be maintained or even raised in anemia.',
        },
        {
          id: 'consumption-term',
          label: 'Consumption — bleeding raises metabolic demand.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Demand can certainly rise, but the term that has unambiguously given way in this description is the carrier itself.',
        },
      ],
      correctChoiceIds: ['content-via-hemoglobin'],
      explanation:
        'The same ledger reaches a different answer. In the earlier situation flow and content were both reduced; here flow is intact and the carrier is depleted. A saturation display behaves identically in both, which is the reason it cannot be used alone.',
      evidenceIds: [...coreSources],
      reviewStatus: 'draft',
    },
  },

  'circuit-flow-path': {
    prediction: {
      id: 'ecmo.foundation.path.prediction',
      activityId: activityId('circuit-flow-path'),
      phase: 'predict',
      itemType: 'signal-recognition',
      contextRequirement: 'context-independent',
      stem: 'Where in the blood path does the circuit report pInt?',
      choices: [
        {
          id: 'between-pump-and-membrane',
          label: 'Between the pump outlet and the membrane lung.',
          plausibility: 'best',
          rationale:
            'It sits on the pressurised side after the pump but before the membrane, which is what makes the difference between it and the return-side pressure a gradient across the membrane.',
        },
        {
          id: 'drainage-side',
          label: 'On the drainage limb, before the pump.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The drainage limb carries the negative pressure the pump generates; that channel is pVen.',
        },
        {
          id: 'after-membrane',
          label: 'After the membrane lung, on the return limb.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'That location is pArt. Placing pInt there would leave nothing to measure the membrane gradient between.',
        },
        {
          id: 'in-the-gas-path',
          label: 'On the sweep-gas line entering the membrane.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The gas path is a separate circuit. The pressure channels described here all sit in the blood path.',
        },
      ],
      correctChoiceIds: ['between-pump-and-membrane'],
      explanation:
        'Locations come before values. pVen sits on drainage, pInt after the pump and before the membrane, pArt after the membrane on the return limb, and the gradient spans pInt to pArt. A pressure interpreted at the mistaken location sends the reasoning to a different part of the circuit entirely.',
      evidenceIds: [...coreSources, 'ecmo-book-ch16'],
      reviewStatus: 'draft',
    },
    transfer: {
      id: 'ecmo.foundation.path.transfer',
      activityId: activityId('circuit-flow-path'),
      phase: 'transfer',
      itemType: 'transfer-case',
      transferVariantId: 'ecmo.foundation.path.transfer-variant',
      contextRequirement: 'context-independent',
      stem: 'Over an hour, pInt and pArt have both risen by a similar amount while the gradient between them is little changed and blood flow has drifted down. Which part of the circuit does that pattern indicate?',
      choices: [
        {
          id: 'return-side',
          label: 'The return side, downstream of the membrane.',
          plausibility: 'best',
          rationale:
            'An obstruction downstream raises the pressure everywhere upstream of it, so the two zones move together and the gradient across the membrane is left largely intact.',
        },
        {
          id: 'membrane',
          label: 'The membrane lung itself.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A membrane problem separates the two zones, so the gradient rises rather than staying put.',
        },
        {
          id: 'drainage',
          label: 'The drainage limb.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A drainage limitation shows itself on the negative-pressure side first, not as a rise in both post-pump zones.',
        },
        {
          id: 'not-enough',
          label: 'There is not enough information to localise it.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Caution is reasonable, but this particular set does discriminate: two zones moving together with a preserved gradient is the return-side pattern.',
        },
      ],
      correctChoiceIds: ['return-side'],
      explanation:
        'Direction and which zones move together carry the localisation. No cut point is needed, and none is offered here — the same reasoning holds whatever the absolute numbers happen to be on a given circuit.',
      evidenceIds: [...coreSources, 'ecmo-book-ch16'],
      reviewStatus: 'draft',
    },
  },

  'pump-and-pressure-zones': {
    prediction: {
      id: 'ecmo.foundation.pump.prediction',
      activityId: activityId('pump-and-pressure-zones'),
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'From the stable reference circuit, the pump speed is about to be raised by 200 rpm. What should happen to circuit blood flow and to the drainage pressure?',
      choices: [
        {
          id: 'flow-up-drainage-more-negative',
          label:
            'Flow should rise somewhat, and the drainage pressure should become more negative as the pump pulls harder.',
          plausibility: 'best',
          rationale:
            'A centrifugal pump turning faster generates more flow against the loading it currently has, and generates it by pulling harder on the drainage side.',
        },
        {
          id: 'flow-up-drainage-unchanged',
          label: 'Flow should rise and the drainage pressure should stay where it is.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Flow does rise, but it is produced by increased suction, so the drainage side does not stay unchanged.',
        },
        {
          id: 'flow-fixed',
          label: 'Flow is set by the speed, so it should move to exactly the expected value.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Speed is selected; flow is the result of that speed under the current loading. The same speed gives different flows under different conditions.',
        },
        {
          id: 'flow-down',
          label: 'Flow should decrease because the circuit resistance rises with speed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'In a circuit with drainage available, raising speed raises flow. Flow stops responding when drainage becomes the limit, which this reference circuit is not.',
        },
      ],
      correctChoiceIds: ['flow-up-drainage-more-negative'],
      explanation:
        'The distinction the whole section rests on is that speed is a setting and flow is a result. Watching the drainage pressure at the same time is what later separates a circuit that has room from one that has run out of it.',
      evidenceIds: [...coreSources, 'ecmo-book-ch16', 'ecmo-book-ch17'],
      reviewStatus: 'draft',
    },
    transfer: {
      id: 'ecmo.foundation.pump.transfer',
      activityId: activityId('pump-and-pressure-zones'),
      phase: 'transfer',
      itemType: 'transfer-case',
      transferVariantId: 'ecmo.foundation.pump.transfer-variant',
      contextRequirement: 'context-independent',
      stem: 'On a different circuit, the speed has been raised twice. Each time the drainage pressure became considerably more negative and the flow barely moved. Where does that pattern localise?',
      choices: [
        {
          id: 'drainage-preload',
          label: 'To drainage — the circuit is asking for more blood than it is being offered.',
          plausibility: 'best',
          rationale:
            'When flow stops responding to speed while suction rises, the limit has moved to what is available to drain rather than to what the pump can do.',
        },
        {
          id: 'membrane-resistance',
          label: 'To the membrane lung.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A membrane limit shows itself as a widening gradient between the post-pump and return zones, not as a drainage pressure that keeps falling.',
        },
        {
          id: 'return-resistance',
          label: 'To the return limb.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Return-side resistance raises the post-pump pressures together; it does not drive the drainage side steadily more negative.',
        },
        {
          id: 'insufficient-information',
          label: 'There is not enough information to say.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The flow-versus-speed relationship together with the drainage trend is the discriminating pair, and both are given.',
        },
      ],
      correctChoiceIds: ['drainage-preload'],
      explanation:
        'This is the same reasoning as the reference comparison, applied where the answer differs. Flow that will not follow speed, with suction rising to chase it, localises upstream of the pump.',
      evidenceIds: [...coreSources, 'ecmo-book-ch16', 'ecmo-book-ch17'],
      reviewStatus: 'draft',
    },
  },

  'blood-flow-versus-sweep': {
    prediction: {
      id: 'ecmo.foundation.sweep.prediction',
      activityId: activityId('blood-flow-versus-sweep'),
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'A patient on support has a rising arterial carbon dioxide value while oxygenation is relatively steady. In this model, which control principally moves the carbon dioxide response?',
      choices: [
        {
          id: 'sweep',
          label: 'The sweep-gas setting.',
          plausibility: 'best',
          rationale:
            'Carbon dioxide crosses the membrane far more readily than oxygen, and its removal is governed mostly by the gradient maintained on the gas side.',
        },
        {
          id: 'pump-speed',
          label: 'The pump speed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Blood flow principally acts on the oxygen side in this model. It is not the control that carbon dioxide clearance is most sensitive to.',
        },
        {
          id: 'gas-oxygen-fraction',
          label: 'The oxygen fraction of the sweep gas.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'That setting changes the oxygen offered to the membrane, not the gradient that carries carbon dioxide away.',
        },
        {
          id: 'both-equally',
          label: 'Both controls act on it about equally.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'They are not fully independent, but they are not equivalent either — the two controls have different principal effects, which is what this section exists to show.',
        },
      ],
      correctChoiceIds: ['sweep'],
      explanation:
        'The asymmetry between the two gases is why the circuit has two controls rather than one. The comparisons in this section are run from the same starting point, one at a time, so each response can be attributed to the control that produced it.',
      evidenceIds: [...coreSources, 'elso-adult-vv-2021'],
      reviewStatus: 'draft',
    },
    transfer: {
      id: 'ecmo.foundation.sweep.transfer',
      activityId: activityId('blood-flow-versus-sweep'),
      phase: 'transfer',
      itemType: 'transfer-case',
      transferVariantId: 'ecmo.foundation.sweep.transfer-variant',
      contextRequirement: 'context-independent',
      stem: 'The console shows an unchanged blood flow. Over the last several minutes the arterial carbon dioxide value has risen sharply and the pH has drifted down. What does the reassuring flow display establish about the gas path?',
      choices: [
        {
          id: 'nothing-about-gas',
          label:
            'Nothing — the blood path and the gas path are separate, and only one of them is displayed here.',
          plausibility: 'best',
          rationale:
            'Blood flow is measured in the blood path. An interruption between the gas source and the membrane leaves that measurement entirely untouched.',
        },
        {
          id: 'gas-must-be-intact',
          label: 'That gas delivery must be intact, since the circuit is still moving blood.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The pump will keep moving blood through a membrane that is receiving no sweep gas at all.',
        },
        {
          id: 'membrane-failing',
          label: 'That the membrane has stopped exchanging and should be changed.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'A membrane problem is one possibility, but the gas supply itself has to be examined before the membrane is blamed for not receiving it.',
        },
        {
          id: 'raise-pump-speed',
          label: 'Raise the pump speed until the carbon dioxide value comes down.',
          plausibility: 'unsafe',
          rationale:
            'This acts on the path that is working and leaves an interrupted gas supply undiscovered.',
        },
      ],
      correctChoiceIds: ['nothing-about-gas'],
      explanation:
        'This is the separation of the two paths carried into a situation where one of them is silent. A display can only report the path it measures, and the sweep-gas path has its own connection to inspect.',
      evidenceIds: [...coreSources, 'elso-adult-vv-2021'],
      reviewStatus: 'draft',
    },
  },
}

// Validate at import so a malformed item or a learner-copy violation is loud and immediate.
for (const items of Object.values(authored)) {
  clinicalLearningItemSchema.parse(items.prediction)
  clinicalLearningItemSchema.parse(items.transfer)
}

export const ecmoFoundationLearningItems = authored

export function ecmoFoundationLearningItemsFor(
  sectionId: EcmoSharedFoundationSectionId,
): EcmoFoundationLearningItems {
  return authored[sectionId]
}
