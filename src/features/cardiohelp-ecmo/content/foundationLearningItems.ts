import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import type { EcmoInteractiveFoundationSectionId } from './foundationLessonRuntime'

/**
 * Prediction and transfer items for the seven interactive foundation lessons.
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

function activityId(sectionId: EcmoInteractiveFoundationSectionId): string {
  return `ecmo:learn:${sectionId}`
}

const authored: Readonly<Record<EcmoInteractiveFoundationSectionId, EcmoFoundationLearningItems>> =
  {
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

    'vv-series-physiology': {
      prediction: {
        id: 'ecmo.foundation.series.prediction',
        activityId: activityId('vv-series-physiology'),
        phase: 'predict',
        itemType: 'mechanism-interpretation',
        contextRequirement: 'context-independent',
        stem: 'Over the last hour on venovenous support the displayed circuit flow has risen, systemic oxygenation has worsened, and the venous-line saturation the console reads has climbed from a saturation of 71 to a saturation of 83. What best accounts for all three together?',
        choices: [
          {
            id: 'recirculation-has-risen',
            label:
              'A larger share of what the circuit returns is being drained straight back, so the pump counts blood that never reached the tissues.',
            plausibility: 'best',
            rationale:
              'The drainage limb is a mixture of systemic venous return and freshly oxygenated blood pulled back in. As that share grows, the drainage saturation climbs toward the post-membrane value while the flow that does useful work falls, and the display cannot tell the two apart.',
          },
          {
            id: 'membrane-losing-transfer',
            label: 'The membrane lung has stopped transferring oxygen properly.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'A membrane losing transfer lowers the post-membrane saturation, and the drainage value follows the systemic value down with it. Here the drainage value has moved the other way.',
          },
          {
            id: 'native-lung-improving',
            label:
              'The native lungs have recovered, which is raising the saturations the circuit sees.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'Recovering native lungs would improve systemic oxygenation rather than worsen it, and the description states that systemic oxygenation is getting worse.',
          },
          {
            id: 'not-enough-information',
            label: 'There is not enough information to choose between the explanations.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Caution is reasonable, but this particular combination does discriminate: a drainage saturation moving away from systemic oxygenation, rather than with it, is the finding that separates re-drainage from the alternatives.',
          },
          {
            id: 'raise-the-speed',
            label: 'Raise the pump speed until the displayed flow brings oxygenation back up.',
            plausibility: 'unsafe',
            rationale:
              'This acts on the one number that cannot distinguish useful flow from re-drained flow. The sources for this section describe raising speed against established re-drainage as usually making it worse rather than better.',
          },
        ],
        correctChoiceIds: ['recirculation-has-risen'],
        explanation:
          'Displayed circuit flow counts every litre the pump moved, including blood returned and drained again without going anywhere. The saturation the console reports comes from the drainage limb, so re-drainage pushes it up while the flow that reaches the tissues falls. Those two moving in opposite directions is the whole signature, and it is invisible if only the flow display is being watched.',
        evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch17'],
        reviewStatus: 'draft',
      },
      transfer: {
        id: 'ecmo.foundation.series.transfer',
        activityId: activityId('vv-series-physiology'),
        phase: 'transfer',
        itemType: 'transfer-case',
        transferVariantId: 'ecmo.foundation.series.transfer-variant',
        contextRequirement: 'context-independent',
        stem: 'A different patient has the return cannula repositioned. Afterwards the displayed circuit flow is slightly higher than it was, the venous-line saturation has fallen from a saturation of 84 to a saturation of 72, and systemic oxygenation has improved. Which reading of that combination is best supported?',
        choices: [
          {
            id: 'true-increase-in-useful-support',
            label:
              'Useful support has genuinely increased: less of what is returned is being drained again, so the drainage limb now looks more like systemic venous blood.',
            plausibility: 'best',
            rationale:
              'When the re-drained share falls, the drainage saturation drops back toward the systemic value and more of what the pump moves reaches the tissues. Improving systemic oxygenation is the confirmation that the extra flow is doing work.',
          },
          {
            id: 'increased-recirculation',
            label: 'Re-drainage has increased and the display is flattering the change.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'More re-drainage pushes the drainage saturation up and systemic oxygenation down. Both have moved in the opposite direction here.',
          },
          {
            id: 'membrane-dysfunction',
            label:
              'The membrane lung is beginning to give way, which is why the drainage value fell.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'A membrane losing transfer lowers the post-membrane saturation and worsens systemic oxygenation. Systemic oxygenation has improved here.',
          },
          {
            id: 'insufficient-information',
            label: 'There is not enough information to say which of these has happened.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Three findings moving together in a consistent direction after a deliberate change to the return position is about as discriminating as this situation gets. Caution is fair, but the pattern is not ambiguous.',
          },
        ],
        correctChoiceIds: ['true-increase-in-useful-support'],
        explanation:
          'The same three signals as before, moving the other way. What separates a real increase in useful support from a higher display is what the drainage saturation and the patient did — not how much the flow number changed. Nothing here prescribes a cannula position or a repositioning technique; the sources for this section describe the reasoning, not the procedure.',
        evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch17'],
        reviewStatus: 'draft',
      },
    },

    'vv-normal-state': {
      prediction: {
        id: 'ecmo.foundation.normal.prediction',
        activityId: activityId('vv-normal-state'),
        phase: 'predict',
        itemType: 'mechanism-interpretation',
        contextRequirement: 'context-independent',
        stem: 'You take over a venovenous run and find a drainage pressure more negative than any you have seen on another patient. Circuit flow has matched the set speed for eight hours without hunting, the gradient across the membrane has not moved, gas exchange is unchanged on an unaltered sweep, and the patient is as they were this morning. What does that single unfamiliar value establish on its own?',
        choices: [
          {
            id: 'very-little-on-its-own',
            label:
              'Very little — it has to be read against this circuit’s own history, its cannula and configuration, the patient’s context, and whether that channel is reporting properly.',
            plausibility: 'best',
            rationale:
              'Cannula size and position, patient size, temperature, hemoglobin, volume state and the device configuration all move this number without anything having gone awry. What carries information is the relationship among the signals and how it has behaved over time.',
          },
          {
            id: 'establishes-drainage-limitation',
            label:
              'It establishes drainage limitation, because a more negative drainage pressure means the circuit is running short of volume.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'Drainage limitation shows itself as flow that stops following speed while suction rises to chase it. Here flow has matched the set speed for hours.',
          },
          {
            id: 'deserves-attention',
            label: 'It deserves attention, because any unfamiliar value should be looked into.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Looking into it is sensible. The question is what it establishes, and on its own — with every other signal steady — it establishes very little.',
          },
          {
            id: 'lower-the-speed',
            label: 'Lower the pump speed until the drainage value looks more familiar.',
            plausibility: 'unsafe',
            rationale:
              'This gives up support to make a display resemble one from a different patient and a different cannula, on the basis of a single unexplained number.',
          },
        ],
        correctChoiceIds: ['very-little-on-its-own'],
        explanation:
          'A baseline is established for this patient and this circuit, and it is read against itself. An unfamiliar absolute value sitting inside a relationship that has held steady for hours is a different situation from the same value appearing as a change. This module publishes no target ranges for these signals because the values depend on things that differ between every two patients.',
        evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch18'],
        reviewStatus: 'draft',
      },
      transfer: {
        id: 'ecmo.foundation.normal.transfer',
        activityId: activityId('vv-normal-state'),
        phase: 'transfer',
        itemType: 'transfer-case',
        transferVariantId: 'ecmo.foundation.normal.transfer-variant',
        contextRequirement: 'context-independent',
        stem: 'A second patient is much larger and cannulated differently, and every circuit pressure is unlike the first patient’s. Over six hours the flow has matched the set speed without hunting, the gradient has not moved, gas exchange has been steady on an unchanged sweep, and neither the ventilator nor the sedation has been altered. Which feature most strongly supports that this is a stable baseline rather than an acute circuit problem?',
        choices: [
          {
            id: 'relationship-held-over-hours',
            label:
              'The relationship among the signals has held steady over hours while nothing was deliberately changed.',
            plausibility: 'best',
            rationale:
              'Steadiness over a window, with the inputs held constant, is what distinguishes a baseline from a departure. It transfers between patients in a way that no particular value does.',
          },
          {
            id: 'gas-exchange-adequate',
            label: 'Gas exchange is adequate at the moment.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Adequate gas exchange belongs in the picture, but adequacy at one moment says nothing about whether the state has been steady or is on its way somewhere.',
          },
          {
            id: 'values-resemble-first-patient',
            label:
              'The values resemble the first patient’s, so they are within the expected picture.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'They do not resemble them, and they have no need to. Two patients of different size with different cannulae will sit at different values while both are entirely steady.',
          },
          {
            id: 'gradient-is-smaller',
            label: 'The gradient across the membrane is smaller than the first patient’s.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'A gradient compared between two different circuits, at two different flows, with two different oxygenators, is a comparison of different things.',
          },
        ],
        correctChoiceIds: ['relationship-held-over-hours'],
        explanation:
          'Everything absolute about this patient differs from the previous one, and none of it matters to the judgement. What is being read is whether the signals still stand in the relationship they stood in earlier, over a window during which nothing was changed. That is the property the next several sections depend on, because each of them is a departure from a run that was previously steady.',
        evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch18'],
        reviewStatus: 'draft',
      },
    },

    'vv-integration-capstone': {
      prediction: {
        id: 'ecmo.foundation.integration.prediction',
        activityId: activityId('vv-integration-capstone'),
        phase: 'predict',
        itemType: 'mechanism-interpretation',
        contextRequirement: 'context-independent',
        stem: 'A patient on stable venovenous support is deteriorating: systemic oxygenation is falling and the arterial carbon dioxide value has climbed quickly over minutes with the pH following it down. The displayed circuit flow is exactly where it was. Which explanation do you commit to before you look further, and what would you expect to find if you are right?',
        choices: [
          {
            id: 'gas-side-interrupted',
            label:
              'The gas side has been interrupted — expect an intact blood path, every circuit pressure unchanged, a post-membrane saturation that has fallen, and something to find at the gas connection.',
            plausibility: 'best',
            rationale:
              'Nothing else on this list moves carbon dioxide this quickly. Losing the gradient on the gas side removes carbon dioxide clearance almost at once while the pump goes on moving blood through an undisturbed circuit.',
          },
          {
            id: 'recirculation-risen',
            label:
              'Re-drainage has risen — expect a venous-line saturation that has climbed away from the systemic value while the flow that does useful work has fallen.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'A real member of this list, and the predicted finding is right. But re-drainage acts on oxygenation through the flow that reaches the tissues and leaves carbon dioxide clearance largely alone, so it does not account for a carbon dioxide value moving this fast.',
          },
          {
            id: 'membrane-failing',
            label:
              'The membrane is failing — expect a gradient that has been climbing and a post-membrane saturation that no longer looks like the output of a working lung.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Also a real member of this list with the right predicted finding. A membrane usually announces itself over hours in a climbing gradient rather than over minutes, so the speed here fits it poorly.',
          },
          {
            id: 'patient-side-change',
            label:
              'The patient has changed — expect new ventilator mechanics, a new chest finding, or a rise in demand, with the whole circuit undisturbed.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'A full member of this list, not a diagnosis of exclusion, and the predicted finding is the right one to look for. It moves carbon dioxide more slowly than losing the gas supply does.',
          },
        ],
        correctChoiceIds: ['gas-side-interrupted'],
        explanation:
          'All four explanations survive an unchanged flow display, which is why the display is a poor place to reason from. What separates them is what each one predicts elsewhere, and here the speed of the carbon dioxide change is the discriminating feature: the gas path can be lost in a moment, and the blood path shows nothing when it is. Committing to a named finding before looking is what allows the next observation to contradict you.',
        evidenceIds: [
          ...coreSources,
          'elso-adult-vv-2021',
          'ecmo-book-ch16',
          'ecmo-book-ch17',
          'ecmo-book-ch18',
        ],
        reviewStatus: 'draft',
      },
      transfer: {
        id: 'ecmo.foundation.integration.transfer',
        activityId: activityId('vv-integration-capstone'),
        phase: 'transfer',
        itemType: 'transfer-case',
        transferVariantId: 'ecmo.foundation.integration.transfer-variant',
        contextRequirement: 'context-independent',
        stem: 'In the re-drainage preview beside you, three things are true at once: the displayed circuit flow is higher than the reference circuit’s, the venous-line saturation is much higher, and the flow left after the re-drained share is removed is much lower. Which single statement accounts for all three?',
        choices: [
          {
            id: 'returned-blood-drained-again',
            label:
              'A large share of what the pump returns is drained again immediately — so the pump counts it, the drainage limb is diluted by it, and very little of it reaches the tissues.',
            plausibility: 'best',
            rationale:
              'One mechanism produces all three readings. The pump cannot distinguish blood on its second circuit from blood on its first, the drainage limb is a mixture that the returned blood pulls upward, and what is left over after re-drainage is what actually does work.',
          },
          {
            id: 'membrane-transferring-more',
            label:
              'The membrane is transferring more oxygen than before, which raises every saturation the circuit reports.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'The post-membrane saturation has not changed, and the patient’s systemic oxygenation is worse rather than better.',
          },
          {
            id: 'patient-venous-improved',
            label:
              'The patient’s own venous saturation has improved, and the drainage limb is reporting that improvement.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'The modeled systemic venous value has moved in the opposite direction. The drainage limb and the systemic estimate diverging is the finding, not a shared improvement.',
          },
          {
            id: 'just-a-faster-pump',
            label: 'The pump is simply running faster, so all three readings move together.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'A faster pump accounts for the higher displayed flow and nothing else. It does not explain why the drainage saturation climbed or why the flow left after re-drainage fell.',
          },
        ],
        correctChoiceIds: ['returned-blood-drained-again'],
        explanation:
          'This is the same discipline applied to a case whose mechanism is different from the one worked a moment ago. Here the display is not merely unchanged — it is higher, and higher for exactly the reason the patient is worse. A number that rises while the thing it is supposed to represent falls is the most misleading kind of reassurance a console can offer.',
        evidenceIds: [...coreSources, 'elso-adult-vv-2021', 'ecmo-book-ch16', 'ecmo-book-ch17'],
        reviewStatus: 'draft',
      },
    },

    'va-parallel-physiology': {
      prediction: {
        id: 'ecmo.foundation.parallel.prediction',
        activityId: activityId('va-parallel-physiology'),
        phase: 'predict',
        itemType: 'mechanism-interpretation',
        contextRequirement: 'context-independent',
        stem: 'A patient on peripheral venoarterial support is being monitored from a right radial arterial line. Over the morning that saturation has fallen from a saturation of 96 to a saturation of 82. A sample drawn from a femoral line reads a saturation of 98. Circuit flow, both membrane pressures, the gradient across the membrane and the post-membrane saturation are all exactly what they were. What best accounts for this?',
        choices: [
          {
            id: 'watershed-moved-distally',
            label:
              'The heart is ejecting more of its own poorly oxygenated blood, so the place where the two circulations meet has moved further down the aorta and the upper body is now being supplied by the native lungs.',
            plausibility: 'best',
            rationale:
              'Circuit blood travels up the aorta from a femoral return cannula while native blood travels down it. Recovering ejection pushes their meeting place distally, so the vessels arising from the arch — including the coronary and cerebral circulations — receive native blood whose oxygenation reflects the native lungs.',
          },
          {
            id: 'membrane-losing-transfer',
            label: 'The membrane lung has stopped transferring oxygen properly.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'A membrane losing transfer lowers the post-membrane saturation, and the femoral value would fall with it. Both are unchanged, and the femoral sample is the one nearest the return cannula.',
          },
          {
            id: 'circuit-flow-too-low',
            label: 'Circuit flow has become inadequate and should be increased.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'Displayed flow is unchanged, and the lower body is well saturated. Raising flow acts on a circulation that is already delivering what it was delivering.',
          },
          {
            id: 'sampling-artefact',
            label: 'The two samples disagree, so one of them is unreliable and should be repeated.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Repeating a sample is never unreasonable, but two arterial sites disagreeing is the expected consequence of two circulations in parallel rather than evidence of a bad sample. Treating the difference as noise discards the finding.',
          },
          {
            id: 'reassuring-recovery',
            label:
              'Native cardiac function is recovering, so this is good news and needs no action.',
            plausibility: 'unsafe',
            rationale:
              'Recovering ejection is indeed what produces this pattern, which is exactly why it is dangerous: the improvement in the heart is delivering poorly oxygenated blood to the brain and the coronary circulation. It is a finding that calls for attention to the native lungs, not for reassurance.',
          },
        ],
        correctChoiceIds: ['watershed-moved-distally'],
        explanation:
          'Two arterial saturations from one patient are not a repeated measurement. In peripheral venoarterial support they sample two different circulations, and the difference between them is the finding. Every circuit signal here is unchanged, which is why the monitoring site — not the console — is what discovers this.',
        evidenceIds: [...coreSources, 'elso-adult-va-2021', 'ecmo-book-ch17'],
        reviewStatus: 'draft',
      },
      transfer: {
        id: 'ecmo.foundation.parallel.transfer',
        activityId: activityId('va-parallel-physiology'),
        phase: 'transfer',
        itemType: 'transfer-case',
        transferVariantId: 'ecmo.foundation.parallel.transfer-variant',
        contextRequirement: 'context-independent',
        stem: 'A different patient on peripheral venoarterial support deteriorates. Circuit flow, both membrane pressures and the gradient are unchanged. The arterial trace has become almost flat, echocardiography reports that the aortic valve is no longer opening, and the chest has become markedly congested. Right radial and femoral saturations are close to one another and both are reassuring. Which reading is best supported?',
        choices: [
          {
            id: 'ventricle-distended-against-return',
            label:
              'The left ventricle is distended and can no longer eject against the returning arterial blood.',
            plausibility: 'best',
            rationale:
              'Arterial return raises what the ventricle must eject against while drainage lowers what reaches it. A ventricle that cannot open the aortic valve produces a flat arterial trace, and blood that cannot leave the left heart backs up into the lungs.',
          },
          {
            id: 'watershed-problem',
            label: 'The mixing watershed has moved and the upper body is receiving native blood.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'That mechanism separates the two arterial saturations. Here they agree with each other, and a ventricle that is not ejecting is not contributing a competing stream at all.',
          },
          {
            id: 'membrane-dysfunction',
            label: 'The membrane lung is failing.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'A failing membrane shows itself in the gradient across it and in the post-membrane saturation. Both are unchanged, and neither explains a valve that has stopped opening.',
          },
          {
            id: 'raise-circuit-flow',
            label: 'Raise circuit flow to improve the systemic circulation.',
            plausibility: 'unsafe',
            rationale:
              'Raising flow raises the arterial pressure the ventricle is already unable to eject against. The sources for this section describe this as worsening distension rather than relieving it.',
          },
        ],
        correctChoiceIds: ['ventricle-distended-against-return'],
        explanation:
          'The same unchanged circuit, a different mechanism. Loading shows itself in pulsatility, in whether the valve opens, and in the lungs — none of which the console reports. Two reassuring arterial saturations do not exclude it, because a ventricle that is not ejecting produces no second stream to disagree with.',
        evidenceIds: [...coreSources, 'elso-adult-va-2021', 'ecmo-book-ch17'],
        reviewStatus: 'draft',
      },
    },

    'va-normal-state': {
      prediction: {
        id: 'ecmo.foundation.va-normal.prediction',
        activityId: activityId('va-normal-state'),
        phase: 'predict',
        itemType: 'mechanism-interpretation',
        contextRequirement: 'context-independent',
        stem: 'You take over a peripheral venoarterial run. Drainage pressure is steadily negative, flow matches the set speed, the gradient across the membrane has not moved for hours, and gas exchange is unchanged on an unaltered sweep. Nothing on the console has moved. What does that establish about the state of this patient on support?',
        choices: [
          {
            id: 'circuit-stable-patient-unestablished',
            label:
              'That the circuit is behaving steadily — and nothing yet about pulsatility, whether the valve is opening, the difference between two arterial sampling sites, or the cannulated limb.',
            plausibility: 'best',
            rationale:
              'Every signal listed belongs to the circuit. The findings that distinguish a stable venoarterial run from a deteriorating one live outside the console, and an unchanged console is silent about all of them.',
          },
          {
            id: 'run-is-stable',
            label: 'That the run is stable and the patient can be reviewed at the next round.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'This treats the circuit display as a summary of the patient. In venoarterial support a distended ventricle, a moved watershed and a threatened limb can all develop with the console entirely unchanged.',
          },
          {
            id: 'needs-published-targets',
            label:
              'Nothing, until each value is compared against the published target range for venoarterial support.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Cannulation strategy, native function, patient size, temperature, hemoglobin and the monitoring site all move these values while the run itself is entirely unremarkable. What transfers is the relationship among the signals over time, not a value being familiar.',
          },
          {
            id: 'gas-exchange-proves-circulation',
            label:
              'That the circulation is adequate, because gas exchange is unchanged on an unaltered sweep.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'Gas exchange describes what the membrane is doing. In venoarterial support the circuit also carries a circulatory role, and adequacy of that role is not reported by the sweep or by the membrane.',
          },
        ],
        correctChoiceIds: ['circuit-stable-patient-unestablished'],
        explanation:
          'A venoarterial baseline review is the venovenous one plus everything parallel circulation adds — pulsatility, aortic-valve opening, two arterial sampling sites read against each other, and a limb distal to an arterial cannula. None of those is on the console, and none of them is established by the console being unchanged.',
        evidenceIds: [...coreSources, 'elso-adult-va-2021', 'elso-neuro-monitoring-2024'],
        reviewStatus: 'draft',
      },
      transfer: {
        id: 'ecmo.foundation.va-normal.transfer',
        activityId: activityId('va-normal-state'),
        phase: 'transfer',
        itemType: 'transfer-case',
        transferVariantId: 'ecmo.foundation.va-normal.transfer-variant',
        contextRequirement: 'context-independent',
        stem: 'A colleague hands over a peripheral venoarterial patient whose absolute values are unlike any you have looked after: the drainage pressure and the membrane gradient are both further from your usual than you expect. They tell you every one of those values has held the same relationship to the others across two consecutive shifts, that pulsatility has been present and steady throughout, and that the cannulated limb has been examined each round. How should that handover be read?',
        choices: [
          {
            id: 'stability-over-time-is-the-evidence',
            label:
              'As a stable baseline for this patient, because the relationships among the signals have held over a long observed window.',
            plausibility: 'best',
            rationale:
              'A steady relationship across two shifts is far stronger evidence about this circuit than any single value resembling one seen on a different patient. The parallel-circulation signals have been watched as well, which is what completes the picture in this track.',
          },
          {
            id: 'unfamiliar-values-are-concerning',
            label:
              'As concerning, because several values sit outside what you usually see on support.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'Cannula size and position, patient size, native function, temperature and hemoglobin all move these numbers while the run itself is entirely unremarkable. Unfamiliarity is a fact about your experience, not about this patient.',
          },
          {
            id: 'need-a-new-baseline',
            label:
              'As unusable, because you did not observe the earlier readings and must establish your own baseline before interpreting anything.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Establishing your own reading is good practice, but a documented relationship holding across two shifts is exactly the evidence a baseline review is trying to build. Discarding it starts the window again for no gain.',
          },
          {
            id: 'console-values-suffice',
            label:
              'As adequate on the circuit values alone, since those are what the console reports.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'The handover is strong because it includes pulsatility and the limb alongside the circuit values. Had it covered only the console, the venoarterial-specific part of the baseline would still be unknown.',
          },
        ],
        correctChoiceIds: ['stability-over-time-is-the-evidence'],
        explanation:
          'The same discipline as the venovenous normal state, extended by the signals that only exist because the circulations are in parallel. A relationship holding over an observed window transfers between patients; a remembered absolute value does not.',
        evidenceIds: [...coreSources, 'elso-adult-va-2021', 'elso-neuro-monitoring-2024'],
        reviewStatus: 'draft',
      },
    },

    'va-integration-capstone': {
      prediction: {
        id: 'ecmo.foundation.va-integration.prediction',
        activityId: activityId('va-integration-capstone'),
        phase: 'predict',
        itemType: 'mechanism-interpretation',
        contextRequirement: 'context-independent',
        stem: 'A patient on stable peripheral venoarterial support deteriorates. Displayed circuit flow is unchanged, the arterial pressure the monitor shows is unchanged, and every membrane pressure and the gradient are unchanged. Which single next step separates the largest number of the remaining explanations?',
        choices: [
          {
            id: 'sample-both-arterial-sites',
            label:
              'Read an upper-body and a lower-body arterial saturation against each other, and look at the arterial trace and whether the valve is opening.',
            plausibility: 'best',
            rationale:
              'A gap between the two sites indicates a moved watershed; a flat trace with a valve that has stopped opening indicates a distended ventricle. One look at those two things separates the two explanations that an unchanged circuit is most likely to be hiding.',
          },
          {
            id: 'raise-circuit-flow',
            label: 'Raise circuit flow, since more support should help a deteriorating patient.',
            plausibility: 'unsafe',
            rationale:
              'Raising flow raises what the ventricle ejects against and pushes the watershed further from the arch. If either of the two leading explanations is operating, this makes the situation worse before it is understood.',
          },
          {
            id: 'change-the-membrane',
            label: 'Arrange a membrane change, since the membrane is the component that fails.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'A membrane losing performance shows itself in the gradient across it and in the post-membrane saturation. Both are stated to be unchanged, so this acts on the one component the findings already argue against.',
          },
          {
            id: 'wait-and-repeat',
            label: 'Repeat the same circuit observations in an hour and see whether they move.',
            plausibility: 'reasonable-but-incomplete',
            rationale:
              'Repeating a set of signals that is already stated to be unchanged does not add information. The explanations still open are precisely the ones the circuit does not report.',
          },
        ],
        correctChoiceIds: ['sample-both-arterial-sites'],
        explanation:
          'In venoarterial support the flow display is joined by a second reassuring number: an arterial pressure the circuit is generating on the patient’s behalf. Neither discriminates. The findings that do — two arterial sites read against each other, the pulsatility, the valve, the lungs and the cannulated limb — all require going and looking.',
        evidenceIds: [...coreSources, 'elso-adult-va-2021', 'elso-neuro-monitoring-2024'],
        reviewStatus: 'draft',
      },
      transfer: {
        id: 'ecmo.foundation.va-integration.transfer',
        activityId: activityId('va-integration-capstone'),
        phase: 'transfer',
        itemType: 'transfer-case',
        transferVariantId: 'ecmo.foundation.va-integration.transfer-variant',
        contextRequirement: 'context-independent',
        stem: 'On another venoarterial patient the carbon dioxide value rises quickly and the pH follows it down over minutes. Displayed circuit flow, every membrane pressure, the gradient and the arterial pressure are all completely unchanged, and both arterial saturations fall together rather than apart. Which explanation does that combination point to?',
        choices: [
          {
            id: 'gas-path-interrupted',
            label:
              'The gas supply to the membrane has been interrupted, while the pump continues to move blood through it.',
            plausibility: 'best',
            rationale:
              'Nothing else on the differential moves carbon dioxide this quickly, and the gas path contains no pressure channel at all, so an interruption leaves every circuit pressure exactly where it was. Both saturations falling together implicates the blood the membrane returns rather than a competition between two circulations.',
          },
          {
            id: 'watershed-moved',
            label: 'The mixing watershed has moved and the upper body is receiving native blood.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'That mechanism separates the two arterial saturations rather than lowering both, and it does not move carbon dioxide quickly.',
          },
          {
            id: 'ventricular-distension',
            label: 'The left ventricle has distended against the returning arterial blood.',
            plausibility: 'incorrect-mechanism',
            rationale:
              'Distension shows itself in the arterial trace, in whether the valve opens and in the lungs. It does not produce a carbon dioxide rise over minutes with an entirely undisturbed circuit.',
          },
          {
            id: 'sweep-is-set-so-gas-is-flowing',
            label:
              'The gas side can be excluded, because the sweep control is still set where it was.',
            plausibility: 'unsafe',
            rationale:
              'A setting on a control establishes what was asked for, not what is arriving at the membrane. Excluding the gas path without looking at the connection is how the fastest and most reversible explanation gets missed.',
          },
        ],
        correctChoiceIds: ['gas-path-interrupted'],
        explanation:
          'The same discipline as the venovenous capstone, applied where the circuit does eventually report the consequence. Speed is the discriminator, and the direction the two arterial saturations move relative to each other separates a gas-side problem from a mixing one. The finding itself is at the gas panel and the tubing, and it is reached by inspection.',
        evidenceIds: [
          ...coreSources,
          'elso-adult-va-2021',
          'elso-neuro-monitoring-2024',
          'ecmo-book-ch17',
        ],
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
  sectionId: EcmoInteractiveFoundationSectionId,
): EcmoFoundationLearningItems {
  return authored[sectionId]
}
