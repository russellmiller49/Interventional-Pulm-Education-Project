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
