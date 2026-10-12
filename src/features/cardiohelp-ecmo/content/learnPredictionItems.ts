import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import type { PredictionControl, PredictionDirection } from '../engine/types'

import { ECMO_NUMBERS } from './teachingNumbers'

/**
 * The prediction a learner answers before acting, one for each of the twenty Learn lessons.
 * Every choice carries the prediction triple that choosing it commits; the keyed choice's triple
 * equals the scenario's own expectation. Items are validated at import.
 */
export interface EcmoLearnPredictionCommitment {
  readonly goalId: string
  readonly control: PredictionControl
  readonly direction: PredictionDirection
}

export interface EcmoLearnPrediction {
  readonly item: ClinicalLearningItem
  /** Choice id → the prediction that choice commits. Every choice must appear. */
  readonly commitments: Readonly<Record<string, EcmoLearnPredictionCommitment>>
}

const authored: Readonly<Record<string, EcmoLearnPrediction>> = {
  'startup-sensor-orientation': {
    item: {
      id: 'ecmo.learn.startup-sensor-orientation.prediction',
      activityId: 'ecmo:learn:startup-sensor-orientation',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'A venovenous circuit is primed and back in its pre-use state. The pump is stopped with the speed setpoint at zero, flow reads zero, and pVen, pInt and pArt show dashes instead of numbers. The startup diagnostic has not run. The gas source is connected and the blender is set to a sweep of 4.0 L/min at an oxygen fraction of 1.0. The ordered speed is on the chart. Nobody has traced or checked the circuit by hand. What do you do before you start support?',
      choices: [
        {
          id: 'verify-the-whole-system-first',
          label:
            'Run the startup diagnostic, trace the circuit by hand from drainage cannula to return cannula, and check gas, power, backup and the patient before you start.',
          plausibility: 'best',
          rationale:
            'The console checks itself and the sensors it can see. It cannot tell you a flow probe is on backwards, a pressure line is on the other limb, the gas is off at the wall, or how the patient looks.',
        },
        {
          id: 'diagnostic-is-the-verified-state',
          label:
            'Run the startup diagnostic and confirm the ready screen and tone; the device has checked its own pump, sensors and alarms, so set support next.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'You do need the diagnostic, but it reports on the device only. It does not see probe direction, which limb a pressure line is on, a closed gas cylinder, a loose connector or the patient.',
        },
        {
          id: 'start-then-inspect-under-flow',
          label:
            'The console shows no fault, so bring the pump to the ordered speed and trace the tubing and sensors once flow and pressures are live.',
          plausibility: 'unsafe',
          rationale:
            'A quiet console is not a checked circuit. A reversed flow probe, a swapped pressure line or a loose connector is harder and more dangerous to fix with the patient’s blood moving under pressure.',
        },
        {
          id: 'chase-the-missing-pressures',
          label:
            'pVen, pInt and pArt are showing no values, so check the three pressure sensors and their cables first; no other reading is reliable until they report.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A primed circuit has real static pressures and checking the transducers is a sound reflex at the bedside, but this simulation shows dashes whenever the pump is stopped, so here the blank channels are not a sensor fault.',
        },
        {
          id: 'gas-path-first',
          label:
            'Confirm the gas path first, from the source through the blender to the membrane, so gas exchange is ready when the pump starts; trace the tubing afterwards under flow.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The gas path does need a hand check, because a blender showing a setting looks the same whether or not gas is flowing. But it tells you nothing about the blood path, the flow probe, the pressure lines, power or backup.',
        },
      ],
      correctChoiceIds: ['verify-the-whole-system-first'],
      explanation:
        'Four things need checking and none stands in for another: the device (startup diagnostic), the circuit (a hand trace from cannula to cannula), the gas path, and the patient. The console can speak only to the first. Do all four now, with the pump stopped, because every fault is easier and safer to fix before blood is moving.',
      evidenceIds: [
        'ifu-console-workflow',
        'ifu-us-2025-scope',
        'ecmo-book-ch9',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'verify-the-whole-system-first': {
        goalId: 'safe-startup',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'diagnostic-is-the-verified-state': {
        goalId: 'safe-startup',
        control: 'initiate-support',
        direction: 'increase',
      },
      'start-then-inspect-under-flow': {
        goalId: 'initiate-vv-support',
        control: 'rpm',
        direction: 'increase',
      },
      'chase-the-missing-pressures': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'gas-path-first': {
        goalId: 'restore-gas-transfer',
        control: 'restore-gas',
        direction: 'restore',
      },
    },
  },
  'preload-drainage-collapse': {
    item: {
      id: 'ecmo.learn.preload-drainage-collapse.prediction',
      activityId: 'ecmo:learn:preload-drainage-collapse',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'Ninety minutes into a venovenous run, with pump speed unchanged, flow has fallen from about 4.6 L/min and now swings between roughly 2.8 and 3.2 L/min every few seconds. Drainage pressure has moved from about -35 to about -80 mmHg and the drainage tubing judders with each swing. pInt and pArt have drifted down with the flow, and the gradient across the membrane has narrowed. The patient was suctioned and repositioned a few minutes ago and has been coughing and straining against the ventilator since. What do you do first?',
      choices: [
        {
          id: 'unload-then-find-cause',
          label:
            'Turn the pump speed down until flow steadies, then find why venous return is short: cannula, a kinked limb, straining, or volume.',
          plausibility: 'best',
          rationale:
            'Flow has stopped following speed while suction climbs, so the limit is upstream of the pump. Less speed means less suction, the vein stops drawing shut, and you get a steady circuit to work on.',
        },
        {
          id: 'raise-speed-to-defend-flow',
          label:
            'Turn the pump speed up until flow returns toward 4.6 L/min, because the pump is what generates flow, then look for the cause once support is back.',
          plausibility: 'unsafe',
          rationale:
            'A centrifugal pump makes more flow only by pulling harder. Pulling harder on a vein that is already drawing shut deepens the suction, worsens the judder and adds hemolysis.',
        },
        {
          id: 'fluid-first',
          label:
            'Give a fluid bolus now and leave the speed alone, because a drainage pressure this negative means the patient is short of volume.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Fluid may be part of the fix, but a malpositioned cannula, a kinked limb and this patient’s coughing and straining all produce the same picture. While the bolus runs, the pump keeps sucking the vein shut.',
        },
        {
          id: 'assess-without-changing-demand',
          label:
            'Leave the console settings alone and examine the patient and the drainage limb now; change the speed only once you have found the cause.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Go to the patient, yes. But while you look, the pump keeps pulling the vein onto the cannula and flow keeps swinging. Turn the speed down first, then look.',
        },
        {
          id: 'exchange-the-oxygenator',
          label:
            'Treat this as a clotting oxygenator and call for an oxygenator exchange, because flow has fallen at an unchanged pump speed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A clotted oxygenator raises pInt and widens the gradient across the membrane. Here pInt and pArt fell and the gradient narrowed. The only pressure that moved against the flow is on the drainage side.',
        },
      ],
      correctChoiceIds: ['unload-then-find-cause'],
      explanation: `The pump is asking for more blood than the vein can give. Suction climbs, flow stops following speed, and the line judders as the vein draws shut around the cannula. Turn the speed down first to stop the suction, then fix the cause: reposition the patient or cannula, relieve a kink, settle the coughing, or give volume if the patient is dry. The manual advises avoiding negative pressures ${ECMO_NUMBERS.value('negative-pressure-caution')}. Factory pVen limits: ${ECMO_NUMBERS.value('pven-factory-limits')}.`,
      evidenceIds: [
        'ecmo-book-ch9',
        'ecmo-book-ch16',
        'ecmo-book-ch17',
        'elso-adult-vv-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'unload-then-find-cause': {
        goalId: 'restore-drainage',
        control: 'rpm',
        direction: 'decrease',
      },
      'raise-speed-to-defend-flow': {
        goalId: 'increase-effective-support',
        control: 'rpm',
        direction: 'increase',
      },
      'fluid-first': {
        goalId: 'increase-effective-support',
        control: 'resuscitate-preload',
        direction: 'drainage',
      },
      'assess-without-changing-demand': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'exchange-the-oxygenator': {
        goalId: 'restore-gas-transfer',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
    },
  },
  'afterload-return-obstruction': {
    item: {
      id: 'ecmo.learn.afterload-return-obstruction.prediction',
      activityId: 'ecmo:learn:afterload-return-obstruction',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'Over about twenty minutes on a venovenous run, with the set speed untouched, circuit blood flow has fallen from 4.0 to 2.8 L/min. pInt and pArt have each risen by roughly 100 mmHg, and the gradient between them has not widened; at the lower flow it is a little narrower. pVen is no more negative than before and the drainage line is not chattering. Neither pressure has reached its alarm limit. The patient’s saturation has drifted from 97% to 92%, and the arterial carbon dioxide has barely moved on an unaltered sweep. What is going on, and what do you do next?',
      choices: [
        {
          id: 'downstream-of-the-membrane',
          label:
            'Resistance has risen beyond the membrane. Walk the return limb from oxygenator to cannula for a kink or clamp before changing a setting.',
          plausibility: 'best',
          rationale:
            'An obstruction raises the pressure in everything upstream of it, so pInt and pArt rise together and the gradient across the membrane does not widen. pVen has not moved, so drainage is fine.',
        },
        {
          id: 'raise-the-speed',
          label:
            'Flow is what the patient has lost. Raise the pump speed until flow is back at 4.0 L/min and the saturation recovers, then look for the cause.',
          plausibility: 'unsafe',
          rationale:
            'The pump is already pushing against a block. More speed drives pInt and pArt higher, buys little flow, and adds hemolysis and the risk of blowing a connection, while the obstruction stays put.',
        },
        {
          id: 'exchange-the-membrane',
          label:
            'The oxygenator has clotted: pInt has climbed while flow fell at the same speed. Call the perfusionist and set up for an oxygenator exchange.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A clotted oxygenator pulls pInt away from pArt and widens the gradient. Here pArt rose with pInt and the gradient did not widen, so the oxygenator is not the block.',
        },
        {
          id: 'call-it-drainage',
          label:
            'The pump has run short of venous return. Turn the speed down and work on the drainage cannula and volume until flow follows speed again.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Poor drainage shows as a more negative pVen and a chattering line. pVen is unchanged and the line is quiet. Nothing upstream of the pump can raise the two pressures beyond it.',
        },
        {
          id: 'suspect-the-transducers',
          label:
            'Two pressures rising by the same amount suggests transducer drift. Re-zero both transducers and hold the settings until the numbers are reliable.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Checking the sensors is part of walking the limb. But flow is measured separately and has fallen too, and the patient has desaturated. A drifting transducer changes a display; it does not slow a pump.',
        },
      ],
      correctChoiceIds: ['downstream-of-the-membrane'],
      explanation: `pInt and pArt rising together with an unchanged gradient put the resistance beyond both sensors, in the return tubing or cannula. Walk the limb, look for a kink, a partly closed clamp or a cannula that has moved, and fix it; do not chase flow with speed. Factory pInt and pArt limits: ${ECMO_NUMBERS.value('pint-part-factory-limits')}. pArt is a circuit pressure in the return tubing, not the patient’s blood pressure.`,
      evidenceIds: [
        'ecmo-book-ch9',
        'ecmo-book-ch17',
        'elso-circuit-2022',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'downstream-of-the-membrane': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'raise-the-speed': {
        goalId: 'increase-effective-support',
        control: 'rpm',
        direction: 'increase',
      },
      'exchange-the-membrane': {
        goalId: 'restore-gas-transfer',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
      'call-it-drainage': {
        goalId: 'restore-drainage',
        control: 'rpm',
        direction: 'decrease',
      },
      'suspect-the-transducers': {
        goalId: 'maintain-continuous-support',
        control: 'inspect-circuit',
        direction: 'hold',
      },
    },
  },
  'afterload-oxygenator-resistance': {
    item: {
      id: 'ecmo.learn.afterload-oxygenator-resistance.prediction',
      activityId: 'ecmo:learn:afterload-oxygenator-resistance',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'On established venovenous support, pump speed is unchanged since this morning but circuit flow has drifted from 4.0 to 3.1 L/min. The pressure between the pump and the membrane lung reads about 330 mmHg; the pressure on the return limb after the membrane reads about 190 mmHg, a little lower than this morning. The difference between the two has widened from roughly 30 mmHg to roughly 140 mmHg. Post-membrane saturation is 88% (99% this morning) and the patient’s arterial saturation has drifted from 97% to 85%. Drainage pressure is no more negative and the sweep is unchanged. What do you do next?',
      choices: [
        {
          id: 'localize-across-the-membrane',
          label:
            'Confirm the pressure drop at unchanged flow, check for a kink or sensor fault, send a post-oxygenator gas, and call the perfusionist with the primed backup.',
          plausibility: 'best',
          rationale:
            'A resistance between two sensors widens the difference between them, and pArt has not risen, so the block is in the oxygenator and not beyond it. A failing oxygenator is exchanged, so get the backup to the bedside.',
        },
        {
          id: 'raise-speed-to-recover-flow',
          label:
            'Raise the pump speed to bring circuit flow back toward 4 L/min and the arterial saturation up with it, then look for the cause once the patient is supported.',
          plausibility: 'unsafe',
          rationale:
            'More speed pushes more blood into a clotting oxygenator. pInt climbs further, hemolysis rises, and the post-oxygenator saturation stays low. In this simulation flow improves with speed and none of that cost is shown; at the bedside it is real.',
        },
        {
          id: 'raise-the-sweep',
          label:
            'Raise the sweep gas flow, because both the post-membrane and the arterial saturation have fallen and gas transfer is the function that has been lost.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Sweep mainly clears carbon dioxide; it adds little oxygen. And a pressure difference that has widened from 30 to 140 mmHg means blood is obstructed in the oxygenator. More gas fixes neither.',
        },
        {
          id: 'clear-the-return-limb',
          label:
            'Treat the high post-pump pressure as an obstruction beyond the membrane: free the return tubing and reposition the return cannula to bring pInt down.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'An obstruction beyond the membrane raises pInt and pArt together. Here only pInt has climbed and pArt has fallen, so the return limb is not the problem.',
        },
        {
          id: 'exchange-immediately',
          label:
            'Call for an immediate circuit exchange, because a pressure difference that has widened this far at unchanged speed can only be the oxygenator.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'You have the right component, and exchange is where this ends. But a kink between the sensors or a faulty pressure line gives the same numbers, and an exchange stops support. Check first, with the backup on its way.',
        },
      ],
      correctChoiceIds: ['localize-across-the-membrane'],
      explanation: `pInt up, pArt not up, and a widening pressure drop at unchanged speed put the resistance in the oxygenator. The usual pressure drop is ${ECMO_NUMBERS.value('pressure-drop-typical')} and the factory upper limit is ${ECMO_NUMBERS.value('pressure-drop-factory-limit')}; the trend at a fixed flow matters more than one value. Confirm the trend, send the gas, call the perfusionist with the primed backup, and exchange the oxygenator.`,
      evidenceIds: [
        'ifu-anomaly-boundary',
        'ecmo-book-ch9',
        'ecmo-book-ch17',
        'ecmo-book-ch18',
        'elso-circuit-2022',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'localize-across-the-membrane': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'raise-speed-to-recover-flow': {
        goalId: 'increase-effective-support',
        control: 'rpm',
        direction: 'increase',
      },
      'raise-the-sweep': {
        goalId: 'restore-gas-transfer',
        control: 'sweep',
        direction: 'increase',
      },
      'clear-the-return-limb': {
        goalId: 'restore-effective-support',
        control: 'reposition-cannula',
        direction: 'definitive',
      },
      'exchange-immediately': {
        goalId: 'restore-membrane-function',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
    },
  },
  'vv-recirculation': {
    item: {
      id: 'ecmo.learn.vv-recirculation.prediction',
      activityId: 'ecmo:learn:vv-recirculation',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'A patient on venovenous support has deteriorated over the last hour with no setting changed: pump speed as at the start of the run, sweep 4.0 L/min, pure oxygen to the membrane. Circuit blood flow is 4.8 L/min and every circuit pressure is where it has been all shift. Blood leaving the membrane reads a saturation of 99%. Arterial saturation has drifted down to 92%, with a carbon dioxide of 46 and a pH of 7.36. The drainage-limb saturation has climbed to 83%. What is happening, and what do you do next?',
      choices: [
        {
          id: 'returned-blood-is-being-redrained',
          label:
            'The circuit is draining blood it has just returned. Check cannula position and tip separation at the bedside and on imaging before changing a setting.',
          plausibility: 'best',
          rationale:
            'Drainage blood at 83% with returned blood at 99% means much of the drainage limb is oxygenated blood on its second trip. A true venous saturation of 83% would not sit with a falling arterial saturation.',
        },
        {
          id: 'ask-for-more-flow',
          label:
            'The pump is not drawing enough venous blood, so the patient is under-supported. Raise the pump speed until the arterial saturation recovers.',
          plausibility: 'unsafe',
          rationale:
            'More speed pulls in more of the blood just returned. Displayed flow climbs, the flow doing useful work falls, the drainage saturation rises further and the patient’s saturation drops.',
        },
        {
          id: 'exchange-the-membrane',
          label:
            'The membrane lung has stopped transferring enough oxygen, which is why the patient is falling. Leave the speed alone and set up for an oxygenator exchange.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A failing oxygenator returns desaturated blood. Here blood leaves the membrane at 99% and the pressures on either side have not moved. The oxygenator is working.',
        },
        {
          id: 'turn-up-the-sweep',
          label:
            'Gas transfer across the membrane is the limit in a patient who is hypoxemic on full support. Turn the sweep gas up and watch the saturation.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Sweep clears carbon dioxide. Blood already leaves the membrane at 99% on pure oxygen, so more sweep adds no oxygen. It only drives a carbon dioxide of 46 down and the pH up.',
        },
        {
          id: 'localize-without-naming',
          label:
            'Support is being lost somewhere between drainage and return. Walk the circuit and find where it is resisting before naming a mechanism.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Going to look is right, but a resistance shows in the pressures and in flow that stops following speed, and neither has happened. The saturations have already named the mechanism.',
        },
      ],
      correctChoiceIds: ['returned-blood-is-being-redrained'],
      explanation:
        'Displayed flow counts every litre the pump moves, including blood that was returned and drained again without reaching the patient. The signature is a drainage saturation that climbs toward the returned value while the arterial saturation falls. Check cannula position and the distance between the drainage and return tips; repositioning is the fix. Raising flow makes it worse.',
      evidenceIds: [
        'ecmo-book-ch17',
        'ecmo-book-ch18',
        'elso-adult-vv-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'returned-blood-is-being-redrained': {
        goalId: 'increase-effective-support',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'ask-for-more-flow': {
        goalId: 'restore-drainage',
        control: 'rpm',
        direction: 'increase',
      },
      'exchange-the-membrane': {
        goalId: 'restore-membrane-function',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
      'turn-up-the-sweep': {
        goalId: 'restore-gas-transfer',
        control: 'sweep',
        direction: 'increase',
      },
      'localize-without-naming': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
    },
  },
  'acute-hypercapnia': {
    item: {
      id: 'ecmo.learn.acute-hypercapnia.prediction',
      activityId: 'ecmo:learn:acute-hypercapnia',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'A patient is in the stabilization phase of venovenous support. Arterial carbon dioxide is 68 mmHg, pH 7.18, bicarbonate 25 mmol/L, and work of breathing is high. Circuit blood flow is steady, the gradient across the membrane has not moved, and oxygenation is where it has been since cannulation. The gas blender is set at 2.0 L/min and delivering it, with the line to the membrane traced and intact. What do you do next?',
      choices: [
        {
          id: 'act-on-membrane-co2-clearance',
          label:
            'This is an acute respiratory acidemia. Raise the sweep gas flow in a measured step and repeat the blood gas.',
          plausibility: 'best',
          rationale:
            'A bicarbonate of 25 with a pH of 7.18 means the kidneys have not compensated, so this is acute. Sweep gas flow sets carbon dioxide removal across the membrane.',
        },
        {
          id: 'retrace-gas-source-first',
          label:
            'The sweep gas supply may have been lost. Trace the source, blender and tubing again before changing any setting.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'This is a sound first move when carbon dioxide climbs over minutes on a quiet circuit. Here the line has just been traced and the blender is delivering 2.0 L/min. The supply is intact; the dose is too low.',
        },
        {
          id: 'raise-gas-oxygen-fraction',
          label:
            'The sweep gas is not rich enough. Raise the oxygen fraction on the blender so gas exchange improves across the membrane.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Oxygen fraction sets oxygen transfer. Carbon dioxide leaves according to how much gas flows past the membrane, not what the gas contains.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'The patient is under-supported. Raise the pump speed so more blood crosses the membrane each minute and more carbon dioxide is removed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Blood flow mainly sets oxygen delivery; carbon dioxide removal depends far more on sweep. More speed adds suction and hemolysis without moving the carbon dioxide much.',
        },
        {
          id: 'hold-and-tolerate-hypercapnia',
          label:
            'Hypercapnia is tolerated on venovenous support. Leave the sweep where it is and repeat the blood gas in several hours.',
          plausibility: 'unsafe',
          rationale:
            'Tolerating a high carbon dioxide is reasonable when the pH is near normal and the patient is comfortable. A pH of 7.18 with a bicarbonate of 25 and high work of breathing is neither.',
        },
      ],
      correctChoiceIds: ['act-on-membrane-co2-clearance'],
      explanation: `Read the bicarbonate with the pH. At 25 mmol/L the kidneys have not compensated, so a pH of 7.18 is acute. Sweep gas flow is the control for carbon dioxide; you set it on the blender, not the console. Step it up and recheck the gas after each change, bringing the carbon dioxide down over ${ECMO_NUMBERS.value('paco2-correction-time')} because a rapid fall changes cerebral blood flow.`,
      evidenceIds: [
        'ecmo-book-ch16',
        'ecmo-book-ch18',
        'elso-adult-vv-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'act-on-membrane-co2-clearance': {
        goalId: 'improve-acidemia',
        control: 'sweep',
        direction: 'increase',
      },
      'retrace-gas-source-first': {
        goalId: 'restore-gas-transfer',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'raise-gas-oxygen-fraction': {
        goalId: 'restore-gas-transfer',
        control: 'gas-fio2',
        direction: 'increase',
      },
      'raise-pump-speed': {
        goalId: 'increase-effective-support',
        control: 'rpm',
        direction: 'increase',
      },
      'hold-and-tolerate-hypercapnia': {
        goalId: 'preserve-compensation',
        control: 'sweep',
        direction: 'hold',
      },
    },
  },
  'compensated-hypercapnia': {
    item: {
      id: 'ecmo.learn.compensated-hypercapnia.prediction',
      activityId: 'ecmo:learn:compensated-hypercapnia',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'A patient in the maintenance phase of venovenous support has had no setting changed since the previous evening. The morning blood gas shows an arterial carbon dioxide of 58 mmHg, a bicarbonate of 34 mEq/L and a pH of 7.39. The patient is comfortable with low work of breathing. Circuit blood flow, the post-pump and return-limb pressures, and the gradient across the membrane are where they have been for hours. What do you do about the carbon dioxide?',
      choices: [
        {
          id: 'preserve-the-compensated-state',
          label:
            'The pH is normal because the kidneys have compensated. Leave the sweep where it is and recheck the gas at the next routine review.',
          plausibility: 'best',
          rationale:
            'You treat the pH and the patient, not the carbon dioxide. A pH of 7.39 with a bicarbonate of 34 and a comfortable patient needs nothing removed.',
        },
        {
          id: 'normalize-the-carbon-dioxide-now',
          label:
            'A carbon dioxide of 58 mmHg is abnormal and the membrane can clear it. Raise the sweep gas flow now to bring it back toward 40 mmHg.',
          plausibility: 'unsafe',
          rationale:
            'The bicarbonate of 34 stays behind when you strip the carbon dioxide, so the pH swings alkaline. A fast fall in carbon dioxide also constricts cerebral vessels.',
        },
        {
          id: 'inspect-the-membrane-first',
          label:
            'A raised carbon dioxide can mean the oxygenator is losing gas transfer. Inspect the oxygenator and gas path before deciding, because steady pressures do not exclude it.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'A failing oxygenator raises carbon dioxide over minutes to hours, faster than the kidneys respond, so the pH would be low. A normal pH with a bicarbonate of 34 took days.',
        },
        {
          id: 'raise-pump-speed-for-clearance',
          label:
            'Carbon dioxide removal depends on blood reaching the membrane. Raise the pump speed so more blood crosses it each minute and more is cleared.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Pump speed mainly sets oxygen delivery; sweep sets carbon dioxide. More speed costs a more negative drainage pressure and more hemolysis, for a patient whose pH is already normal.',
        },
        {
          id: 'begin-a-separation-trial',
          label:
            'A comfortable patient with a normal pH has recovering lungs. Start a trial off sweep by turning the sweep gas to zero.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The bicarbonate of 34 is the kidneys adapting to a carbon dioxide the membrane is still clearing. It says nothing about what the native lungs can do.',
        },
      ],
      correctChoiceIds: ['preserve-the-compensated-state'],
      explanation:
        'A raised carbon dioxide with a normal pH and a high bicarbonate is chronic, compensated retention. Stripping the carbon dioxide quickly would leave the bicarbonate unopposed and the pH alkaline. Leave the sweep alone. A bicarbonate of 34 is a little more than retention alone explains, so look for a metabolic alkalosis from diuresis or chloride loss.',
      evidenceIds: [
        'ecmo-book-ch16',
        'ecmo-book-ch18',
        'elso-adult-vv-2021',
        'ifu-console-workflow',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'preserve-the-compensated-state': {
        goalId: 'preserve-compensation',
        control: 'sweep',
        direction: 'hold',
      },
      'normalize-the-carbon-dioxide-now': {
        goalId: 'improve-acidemia',
        control: 'sweep',
        direction: 'increase',
      },
      'inspect-the-membrane-first': {
        goalId: 'restore-gas-transfer',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'raise-pump-speed-for-clearance': {
        goalId: 'increase-effective-support',
        control: 'rpm',
        direction: 'increase',
      },
      'begin-a-separation-trial': {
        goalId: 'test-native-lung',
        control: 'off-sweep-trial',
        direction: 'off',
      },
    },
  },
  'gas-source-interruption': {
    item: {
      id: 'ecmo.learn.gas-source-interruption.prediction',
      activityId: 'ecmo:learn:gas-source-interruption',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'A patient on stable venovenous support deteriorates over a few minutes. Arterial carbon dioxide climbs steeply from the mid-40s, the pH follows it down, and arterial saturation drifts from 93% to 82%. Circuit blood flow sits exactly where it has all shift, the pressures on either side of the membrane and the pressure drop across it are unmoved, and nobody has touched the pump speed or the sweep setting. What do you do first?',
      choices: [
        {
          id: 'follow-the-gas-path',
          label:
            'Trace the sweep gas from the wall outlet or cylinder through the blender to the oxygenator, and reconnect whatever is not delivering.',
          rationale:
            'Carbon dioxide rising over minutes with a falling saturation and an untouched blood path means no gas is reaching the membrane.',
          plausibility: 'best',
        },
        {
          id: 'raise-the-sweep',
          label:
            'Turn the sweep up on the blender until the carbon dioxide comes back down, because a higher setting puts more gas across the membrane.',
          rationale:
            'A setting is what you asked for, not what arrives. Turning it up on a line delivering nothing changes a dial and not the patient.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'raise-the-pump-speed',
          label:
            'Raise the pump speed to bring the saturation back up, because less oxygenated blood is reaching the patient than before.',
          rationale:
            'Flow and pressures are unchanged, so the blood path is doing its job. More speed sends more blood through a membrane that is adding no oxygen.',
          plausibility: 'unsafe',
        },
        {
          id: 'work-through-the-circuit',
          label:
            'Work through the blood path first: pressures, pressure drop, visible clot and cannula position, because a change this large must show there.',
          rationale:
            'The blood path has already answered: pressures and pressure drop are unmoved. The gas path is the part the console cannot report on and the part nobody has checked.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'exchange-the-oxygenator',
          label:
            'Call for an oxygenator exchange, because a membrane that has stopped exchanging gas has to be replaced before the patient worsens.',
          rationale:
            'A failing oxygenator usually declares itself over hours with a rising pressure drop. This took minutes and the pressure drop has not moved. An oxygenator with no gas supply looks the same at the outlet, and you can exclude that in seconds.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['follow-the-gas-path'],
      explanation:
        'The console monitors the blood path, not the gas path. When sweep gas stops arriving, carbon dioxide clearance stops almost at once and the membrane returns blood it has not oxygenated, while flow and every pressure stay normal. So a fast rise in carbon dioxide with falling saturation on a quiet console sends you to the gas line first: wall outlet or cylinder, blender, tubing, oxygenator inlet. Fix the connection before you touch a setting.',
      evidenceIds: [
        'ecmo-book-ch9',
        'ecmo-book-ch18',
        'elso-adult-vv-2021',
        'elso-circuit-2022',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'follow-the-gas-path': {
        goalId: 'restore-gas-transfer',
        control: 'restore-gas',
        direction: 'restore',
      },
      'raise-the-sweep': { goalId: 'improve-acidemia', control: 'sweep', direction: 'increase' },
      'raise-the-pump-speed': {
        goalId: 'increase-effective-support',
        control: 'rpm',
        direction: 'increase',
      },
      'work-through-the-circuit': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'exchange-the-oxygenator': {
        goalId: 'maintain-continuous-support',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
    },
  },
  'arterial-bubble-stop': {
    item: {
      id: 'ecmo.learn.arterial-bubble-stop.prediction',
      activityId: 'ecmo:learn:arterial-bubble-stop',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'On a venovenous run at 3200 rpm the arterial bubble sensor raises a high-priority alarm and the pump stops on its own. Air is visible in the circuit, both near-patient clamps are still open, and the bubble stop stays latched. With no flow through the membrane lung, arterial saturation has begun to drift down from 93%. What has the pump stop achieved, and what do you do now?',
      choices: [
        {
          id: 'isolate-then-eliminate-source',
          label:
            'It only stopped forward flow. Clamp the return limb, then the drainage limb, near the patient, call for the backup circuit, and find the source.',
          plausibility: 'best',
          rationale:
            'A stopped centrifugal pump is not a valve; air can still reach the patient through open limbs. Clamp, call for help and the backup circuit, support the patient on the ventilator, then close the source and aspirate the air.',
        },
        {
          id: 'reset-to-restore-flow',
          label:
            'It bought a pause that is now costing gas exchange. Acknowledge the alarm and reset the bubble stop so the pump restarts and the saturation recovers.',
          plausibility: 'unsafe',
          rationale:
            'Air is still in the circuit and both limbs are open, so the first turns of the pump push that air toward the patient. Treat the falling saturation with the ventilator while you clamp and clear the circuit.',
        },
        {
          id: 'stopped-pump-already-isolates',
          label:
            'It separated the patient from the circuit. Leave the clamps, remove the air through a circuit port, and restart once the line looks clear.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'With the pump stopped, gravity, patient position, breathing effort and handling can still move air through open limbs. Only the clamps separate the patient from the circuit.',
        },
        {
          id: 'size-the-air-first',
          label:
            'It bought time to judge how much air is present. Estimate the volume first, because that decides how urgently to clamp and de-air.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'You will judge the amount, but it does not change the first move. Whatever the volume, both limbs are open and air is still getting in. Clamp first, then look.',
        },
        {
          id: 'blame-the-membrane',
          label:
            'It showed the oxygenator is the source, since the air was detected on the return limb beyond it. Arrange an oxygenator exchange.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The sensor tells you where air was found, not where it entered. Air usually gets in on the negative-pressure side: the drainage limb, its connectors, or a port in use.',
        },
      ],
      correctChoiceIds: ['isolate-then-eliminate-source'],
      explanation:
        'The bubble stop halts the pump; it does not clamp anything or remove air. Clamp the return limb, then the drainage limb, near the patient. Call for help and the primed backup circuit, support the patient on the ventilator, find and close the source, and aspirate the air; exchange the circuit if it cannot be cleared quickly. Resume only when the source is fixed and the circuit is free of bubbles: drainage clamp open, bubble stop reset on the Interventions screen (which restarts the pump), return clamp open last.',
      evidenceIds: [
        'ifu-console-workflow',
        'ifu-anomaly-boundary',
        'elso-circuit-2022',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'isolate-then-eliminate-source': {
        goalId: 'prevent-air-return',
        control: 'correct-cause',
        direction: 'inspect',
      },
      'reset-to-restore-flow': {
        goalId: 'restore-gas-transfer',
        control: 'initiate-support',
        direction: 'restore',
      },
      'stopped-pump-already-isolates': {
        goalId: 'maintain-continuous-support',
        control: 'correct-cause',
        direction: 'definitive',
      },
      'size-the-air-first': {
        goalId: 'safe-startup',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'blame-the-membrane': {
        goalId: 'localize-resistance',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
    },
  },
  'transport-power-loss': {
    item: {
      id: 'ecmo.learn.transport-power-loss.prediction',
      activityId: 'ecmo:learn:transport-power-loss',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'During an interfacility transport on venovenous support, the vehicle’s supply to the console drops out. The console switches to internal battery on its own, the transport screen shows a battery reserve of 24 percent and falling steadily, and there is a low-priority power message. Circuit blood flow, the circuit pressures and the patient’s oxygenation are unchanged, and the receiving unit is still some distance away. What do you do now?',
      choices: [
        {
          id: 'secure-verified-supply-now',
          label:
            'Connect the console to another power source now and confirm it is charging, recheck flow and the patient, and keep the emergency drive within reach.',
          rationale:
            'The battery is a bridge, and 24 percent is charge, not minutes. Get onto a source you have confirmed is live while the pump is still running.',
          plausibility: 'best',
        },
        {
          id: 'watch-until-the-reserve-is-low',
          label:
            'Keep monitoring the console and patient and continue the transport; the switch was automatic and 24 percent is well above empty, so act when the reserve gets low.',
          rationale:
            'Watching is fine, but the reserve gives no fixed time. How long it lasts depends on pump load and battery age, and it is already falling.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'lower-speed-to-stretch-the-battery',
          label:
            'Lower the pump speed to cut the power draw, so the remaining battery lasts until the transport reaches the receiving unit.',
          rationale:
            'This trades the patient’s support for run time. Flow, pressures and oxygenation are fine; the problem is the supply, and it is still missing after you turn the pump down.',
          plausibility: 'unsafe',
        },
        {
          id: 'change-to-emergency-drive-now',
          label:
            'Move the pump to the emergency drive and hand-crank now, because a console on battery could stop at any moment during the transport.',
          rationale:
            'The console is running normally on battery. Going to the hand crank now means clamping and stopping support in a moving vehicle before you have tried another outlet.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['secure-verified-supply-now'],
      explanation:
        'When external power drops, the console switches to battery and everything on the screen stays normal until the battery is empty. So act on the power source, not the flow number: find another supply, confirm the console is charging, recheck flow and the patient, and keep the backup console and emergency drive at hand. If the console stops, go to the emergency drive: both clamps closed, disposable across, venous clamp open, crank clockwise, arterial clamp open once speed is up. The simulated battery drains at a fixed rate; a real one depends on load and battery age.',
      evidenceIds: [
        'ifu-console-workflow',
        'ecmo-book-ch9',
        'elso-circuit-2022',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'secure-verified-supply-now': {
        goalId: 'maintain-continuous-support',
        control: 'restore-power',
        direction: 'restore',
      },
      'watch-until-the-reserve-is-low': {
        goalId: 'preserve-compensation',
        control: 'inspect-circuit',
        direction: 'hold',
      },
      'lower-speed-to-stretch-the-battery': {
        goalId: 'preserve-compensation',
        control: 'rpm',
        direction: 'decrease',
      },
      'change-to-emergency-drive-now': {
        goalId: 'initiate-vv-support',
        control: 'initiate-support',
        direction: 'temporary',
      },
    },
  },
  'va-startup-sensor-orientation': {
    item: {
      id: 'ecmo.learn.va-startup-sensor-orientation.prediction',
      activityId: 'ecmo:learn:va-startup-sensor-orientation',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'A peripheral venoarterial circuit is primed and in its pre-use state: femoral venous drainage cannula, pump and oxygenator, femoral arterial return cannula. The pump is stopped with the speed setpoint at zero, flow reads zero, and pVen, pInt and pArt show dashes instead of numbers. The startup diagnostic has not run and nothing has been traced by hand. Off support, the bedside monitor shows a right-arm saturation of 96, a femoral arterial saturation of 98.5, a mean arterial pressure of 71 mmHg and a pulse pressure of 18 mmHg. What do you do before you start support?',
      choices: [
        {
          id: 'verify-as-a-va-circuit',
          label:
            'Run the diagnostic, trace each limb by hand to its vessel, check gas, power and backup, and record the baseline right-arm saturation, pulse pressure and leg perfusion.',
          plausibility: 'best',
          rationale:
            'The console cannot tell which vessel the return limb enters; only your hand trace can. Once the pump starts, right-arm saturation, pulse pressure and the leg can all change, and without a baseline you have nothing to compare them with.',
        },
        {
          id: 'same-check-then-add-monitoring',
          label:
            'Run the same startup check as for venovenous: diagnostic, hand trace, gas, power and backup. Record the right-arm and lower-body values once the patient has settled on support.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The circuit check is right. But a right-arm saturation or pulse pressure read only after the pump starts has no baseline to be compared with.',
        },
        {
          id: 'shared-hardware-start-now',
          label:
            'Same console and hardware as venovenous, no fault showing, and the monitor is already reading. Bring the pump to the ordered speed and check the rest under flow.',
          plausibility: 'unsafe',
          rationale:
            'pArt reads the same whether the return limb is in an artery or a vein, and it reads nothing until the pump turns. A misplaced cannula shows no warning on the console.',
        },
        {
          id: 'part-is-the-arterial-pressure',
          label:
            'Once the pump is up, use pArt as the patient’s arterial pressure, since it is measured in the return limb close to the aorta, and cross-check it with the bedside trace.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'pArt is measured inside the circuit, after the oxygenator and before the cannula. It rises with a kinked limb as readily as with the patient’s vascular tone. The patient’s pressure comes from the arterial line.',
        },
        {
          id: 'distal-perfusion-plan-first',
          label:
            'Limb ischemia is the classic complication of femoral venoarterial support. Settle the distal perfusion plan for the cannulated leg before returning to the circuit.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The plan should be ready, but it does nothing about a return limb in a vein instead of the artery, a swapped pressure line or a closed gas supply.',
        },
      ],
      correctChoiceIds: ['verify-as-a-va-circuit'],
      explanation:
        'The console looks identical on venovenous and venoarterial support, so you establish the configuration by hand: which vessel each limb enters. Peripheral venoarterial support then brings two problems the console cannot show: retrograde flow meeting native ejection in the aorta, and a leg perfused past an arterial cannula. Record the right-arm saturation, the pulse pressure and the state of the leg before the pump starts, so the first minutes on support can be read against them.',
      evidenceIds: [
        'ifu-console-workflow',
        'ecmo-book-ch9',
        'elso-adult-va-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'verify-as-a-va-circuit': {
        goalId: 'safe-startup',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'same-check-then-add-monitoring': {
        goalId: 'safe-startup',
        control: 'initiate-support',
        direction: 'increase',
      },
      'shared-hardware-start-now': {
        goalId: 'initiate-va-support',
        control: 'rpm',
        direction: 'increase',
      },
      'part-is-the-arterial-pressure': {
        goalId: 'initiate-va-support',
        control: 'initiate-support',
        direction: 'perfusion',
      },
      'distal-perfusion-plan-first': {
        goalId: 'protect-cannulated-limb',
        control: 'restore-distal-perfusion',
        direction: 'perfusion',
      },
    },
  },
  'va-preload-drainage-collapse': {
    item: {
      id: 'ecmo.learn.va-preload-drainage-collapse.prediction',
      activityId: 'ecmo:learn:va-preload-drainage-collapse',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'On peripheral venoarterial support in the stabilization phase, the pump is turning at 3600 rpm. Circuit blood flow, steady near 4.5 L/min through the morning, now swings between about 2.8 and 3.2 L/min. Drainage pressure has become progressively more negative and reads about -82 mmHg, and the drainage line is chattering. Both post-pump pressures have drifted down with the flow and the gradient across the membrane has narrowed; the post-membrane gas at handover was fully saturated. Mean arterial pressure is 62 mmHg, and the arterial trace still shows native ejection with a pulse pressure of about 18 mmHg, unchanged since handover. What do you do first?',
      choices: [
        {
          id: 'ease-pump-demand-then-examine',
          label:
            'Turn the pump speed down until flow steadies, then find what is limiting venous return: cannula, tubing, volume or the chest.',
          plausibility: 'best',
          rationale:
            'A centrifugal pump cannot create venous return; it can only pull harder. Less speed stops the vein collapsing onto the cannula and steadies flow. Then find the cause, fix it, and bring support back up against perfusion.',
        },
        {
          id: 'raise-speed-to-recover-flow',
          label:
            'Raise the pump speed until flow climbs back toward 4.5 L/min, because a mean arterial pressure of 62 mmHg needs more circuit support.',
          plausibility: 'unsafe',
          rationale:
            'Every step up in speed makes the drainage pressure more negative and sucks the vein harder onto the cannula. Flow no longer rises and can fall, so the patient gets no more support, with hemolysis added.',
        },
        {
          id: 'volume-first-for-presumed-hypovolemia',
          label:
            'Give a fluid bolus now, because a drainage pressure this negative means the patient is underfilled, and leave the pump speed where it is.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Hypovolemia is one cause and volume may be part of the answer. A malpositioned or kinked cannula, coughing, tamponade and a tension pneumothorax read the same on the drainage pressure.',
        },
        {
          id: 'localize-downstream-resistance',
          label:
            'Treat the falling flow as resistance beyond the pump, and inspect the oxygenator and the arterial return limb before changing the speed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Resistance beyond the pump raises the post-pump pressures. Here both have fallen and the gradient has narrowed. The only pressure moving against flow is upstream of the pump.',
        },
        {
          id: 'assess-lv-loading-first',
          label:
            'Treat this as retrograde arterial flow loading the left ventricle, and get an echo of the ventricle before touching the pump.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A loaded left ventricle shows a pulse pressure narrowing toward nothing, a closed aortic valve and pulmonary edema. Here the pulse pressure is unchanged at 18 mmHg with native ejection, and the abnormal number is the drainage pressure.',
        },
      ],
      correctChoiceIds: ['ease-pump-demand-then-examine'],
      explanation: `Swinging flow, a drainage pressure that keeps falling and a chattering line are one problem: the pump is asking the vein for more than it can give. Falling post-pump pressures and a narrowed gradient confirm the limit is upstream of the pump. Turn the speed down to stop the suction, then work through cannula position, a kink, volume, straining, tamponade and tension pneumothorax, and fix what you find. The manual advises avoiding negative pressures ${ECMO_NUMBERS.value('negative-pressure-caution')}. Factory pVen limits: ${ECMO_NUMBERS.value('pven-factory-limits')}.`,
      evidenceIds: [
        'ecmo-book-ch9',
        'ecmo-book-ch17',
        'elso-adult-va-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'ease-pump-demand-then-examine': {
        goalId: 'restore-systemic-support',
        control: 'rpm',
        direction: 'decrease',
      },
      'raise-speed-to-recover-flow': {
        goalId: 'restore-systemic-support',
        control: 'rpm',
        direction: 'increase',
      },
      'volume-first-for-presumed-hypovolemia': {
        goalId: 'control-hemorrhagic-shock',
        control: 'resuscitate-preload',
        direction: 'drainage',
      },
      'localize-downstream-resistance': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'assess-lv-loading-first': {
        goalId: 'protect-left-heart',
        control: 'assess-lv-loading',
        direction: 'inspect',
      },
    },
  },
  'va-afterload-arterial-return-obstruction': {
    item: {
      id: 'ecmo.learn.va-afterload-arterial-return-obstruction.prediction',
      activityId: 'ecmo:learn:va-afterload-arterial-return-obstruction',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'On a peripheral venoarterial run the pump speed is untouched at 3200 rpm. Over the past several minutes circuit blood flow has fallen from about 4.0 to about 2.8 L/min. pInt, measured before the membrane lung, has risen from about 242 to about 335 mmHg, and pArt, measured after the membrane on the return limb, from about 211 to about 313 mmHg. The gradient between them reads about 22 mmHg, down from about 31 mmHg, and no pressure alarm limit has been reached. The patient’s own arterial line reads a mean near 70 with a pulsatile trace, the right radial saturation is in the mid-90s, norepinephrine is unchanged since morning, and the cannulated limb looks as it did earlier. What do you do next?',
      choices: [
        {
          id: 'localize-beyond-membrane',
          label:
            'Before changing a setting, walk the return limb beyond the oxygenator: tubing, connectors, clamps and cannula position.',
          plausibility: 'best',
          rationale:
            'Both post-pump pressures rose together and the gradient fell in step with flow, so the oxygenator is unchanged and the new resistance is beyond it. That gives you a segment, not a cause.',
        },
        {
          id: 'raise-speed-to-recover-flow',
          label:
            'Raise the pump speed until flow is back toward 4 L/min, because flow is what has been lost and speed is the control that sets it.',
          plausibility: 'unsafe',
          rationale:
            'Flow fell while both post-pump pressures climbed: the pump is already pushing against a block. More speed adds pressure, hemolysis and the risk of a blown connection, and little flow.',
        },
        {
          id: 'call-it-a-membrane-problem',
          label:
            'Treat this as a clotting oxygenator and arrange an exchange, because pInt has climbed while flow has fallen at an unchanged speed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A clotting oxygenator pulls pInt away from pArt and widens the gradient even as flow falls. Here the gradient narrowed from 31 to 22 mmHg.',
        },
        {
          id: 'treat-circuit-pressure-as-the-patients',
          label:
            'Treat the return-limb reading of 313 mmHg as dangerous arterial hypertension, and wean the norepinephrine to bring the pressure down.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'pArt is the pressure inside the return tubing. The patient’s pressure is on the arterial line, near 70, and it did not rise. Weaning norepinephrine leaves the obstruction and takes away support the patient needs.',
        },
        {
          id: 'reposition-the-return-cannula',
          label:
            'Call it a malpositioned arterial cannula and have it repositioned now, because both pressures beyond the pump have risen together.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'You have the segment, and the cannula is on the list. So are a kinked limb, a partly closed clamp, a connector and a faulty sensor. Walk the limb before you move a cannula that may be sitting well.',
        },
      ],
      correctChoiceIds: ['localize-beyond-membrane'],
      explanation: `An obstruction raises the pressure in everything upstream of it, so pInt and pArt rising together put the resistance beyond both. The gradient across the oxygenator is resistance times flow; it fell as flow fell, so the oxygenator has not changed. Walk the return limb to the cannula and fix what you find. Factory pInt and pArt limits: ${ECMO_NUMBERS.value('pint-part-factory-limits')}. pArt is a circuit pressure; the patient’s blood pressure is on the arterial line.`,
      evidenceIds: [
        'ecmo-book-ch9',
        'ecmo-book-ch17',
        'elso-adult-va-2021',
        'elso-circuit-2022',
        'ifu-console-workflow',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'localize-beyond-membrane': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'raise-speed-to-recover-flow': {
        goalId: 'restore-systemic-support',
        control: 'rpm',
        direction: 'increase',
      },
      'call-it-a-membrane-problem': {
        goalId: 'restore-membrane-function',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
      'treat-circuit-pressure-as-the-patients': {
        goalId: 'protect-left-heart',
        control: 'vasopressor',
        direction: 'decrease',
      },
      'reposition-the-return-cannula': {
        goalId: 'localize-resistance',
        control: 'correct-cause',
        direction: 'definitive',
      },
    },
  },
  'va-afterload-oxygenator-resistance': {
    item: {
      id: 'ecmo.learn.va-afterload-oxygenator-resistance.prediction',
      activityId: 'ecmo:learn:va-afterload-oxygenator-resistance',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'On peripheral venoarterial support, neither the pump speed nor the sweep gas has been changed since this morning. pInt, between the pump outlet and the membrane lung, has risen from about 240 to about 330 mmHg, while pArt on the return limb has fallen from about 210 to about 190. The gradient between them was about 30 mmHg and is now about 140. Circuit blood flow at the same speed has fallen from about 4.0 to about 3.1 L/min. A post-membrane blood gas shows a saturation of 88%, down from 99% this morning. Right radial and femoral arterial saturations are unchanged, mean arterial pressure has drifted down about 5 mmHg, and no circuit pressure alarm has sounded. What do you do next?',
      choices: [
        {
          id: 'locate-the-resistance-first',
          label:
            'Confirm the pressure drop at unchanged flow, check the sensors, repeat the post-oxygenator gas, and call the perfusionist with the backup.',
          plausibility: 'best',
          rationale:
            'pInt up, pArt down and a gradient from 30 to 140 mmHg put the resistance in the oxygenator, and a post-oxygenator saturation of 88% says gas transfer is going too. Confirm it is not a sensor or a kink, then exchange.',
        },
        {
          id: 'raise-speed-to-restore-flow',
          label:
            'Raise the pump speed until circuit flow returns to about 4.0 L/min, because the mean arterial pressure is drifting down and support has fallen short.',
          plausibility: 'unsafe',
          rationale:
            'More speed pushes more blood into the clotting oxygenator: pInt rises, hemolysis rises, and the clot stays. On venoarterial support more flow also raises left ventricular afterload.',
        },
        {
          id: 'act-on-the-return-limb',
          label:
            'Treat this as an obstruction beyond the oxygenator: free the return tubing, check the connectors and reposition the arterial cannula to restore flow.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'An obstruction beyond the oxygenator raises pArt and pInt together and leaves the gradient alone. Here pArt has fallen and the gradient has more than quadrupled.',
        },
        {
          id: 'exchange-the-membrane-now',
          label:
            'Arrange an oxygenator exchange immediately, because a gradient of about 140 mmHg is enough by itself to call the oxygenator spent.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Exchange is probably where this ends. But the gradient depends on flow and on working sensors, and an exchange stops support on a venoarterial patient. Confirm at matched flow, repeat the gas, and have the backup primed first.',
        },
        {
          id: 'raise-sweep-oxygen-fraction',
          label:
            'Raise the oxygen fraction of the sweep gas on the blender, because blood leaving the membrane is no longer fully saturated.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The gas side carries no blood pressure, so nothing done there explains a gradient of 140 mmHg or falling flow.',
        },
      ],
      correctChoiceIds: ['locate-the-resistance-first'],
      explanation: `When the two post-pump pressures rise together, look beyond the oxygenator; when they separate, the oxygenator is the resistance. The usual pressure drop is ${ECMO_NUMBERS.value('pressure-drop-typical')} and the factory upper limit is ${ECMO_NUMBERS.value('pressure-drop-factory-limit')}; the trend at a fixed flow matters more than one value. Confirm the trend, send a post-oxygenator gas, call the perfusionist with the primed backup, and exchange the oxygenator. More pump speed is not a treatment. In this simulation the post-oxygenator saturation is fixed and will not change with the sweep oxygen fraction.`,
      evidenceIds: [
        'ifu-anomaly-boundary',
        'ecmo-book-ch9',
        'elso-circuit-2022',
        'elso-adult-va-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'locate-the-resistance-first': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'raise-speed-to-restore-flow': {
        goalId: 'restore-systemic-support',
        control: 'rpm',
        direction: 'increase',
      },
      'act-on-the-return-limb': {
        goalId: 'relieve-obstruction',
        control: 'correct-cause',
        direction: 'definitive',
      },
      'exchange-the-membrane-now': {
        goalId: 'restore-membrane-function',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
      'raise-sweep-oxygen-fraction': {
        goalId: 'restore-gas-transfer',
        control: 'gas-fio2',
        direction: 'increase',
      },
    },
  },
  'va-differential-hypoxemia': {
    item: {
      id: 'ecmo.learn.va-differential-hypoxemia.prediction',
      activityId: 'ecmo:learn:va-differential-hypoxemia',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'On peripheral femoral venoarterial support, the right-hand pulse oximeter reads a saturation of 82%. A femoral arterial sample reads 99%, and blood leaving the membrane reads 99%. The arterial trace is pulsatile with a pulse pressure of 22 mmHg, echocardiography shows the aortic valve opening, and native output is estimated at 2.8 L/min. Circuit flow, both membrane pressures and the gradient across the membrane are where they have been all shift. What do you do next?',
      choices: [
        {
          id: 'verify-upper-body-and-read-both-circulations',
          label:
            'Confirm the right-arm value with a right radial blood gas, then improve native lung oxygenation on the ventilator before changing circuit flow.',
          plausibility: 'best',
          rationale:
            'The heart is ejecting 2.8 L/min of blood through sick lungs, and that blood supplies the coronaries and the brain. The right arm reads it; the femoral line and the membrane read only circuit blood.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'Raise the pump speed now, because an arterial saturation of 82% means the patient is under-supported and needs more circuit flow.',
          plausibility: 'unsafe',
          rationale:
            'More flow pushes the mixing point toward the aortic root and may lift the right-hand value for a while, but it loads a ventricle that is ejecting. It is a temporary step after the ventilator, not the first move.',
        },
        {
          id: 'recheck-sensors-and-hold',
          label:
            'Three values that disagree cannot all be reliable. Recheck the oximeter probe and the circuit sensors, and hold the settings until the readings agree.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Confirming the right-hand value is right; do it with a right radial gas. But the readings disagree because they sample two circulations, not because a sensor is off.',
        },
        {
          id: 'raise-sweep-gas-fio2',
          label:
            'Raise the oxygen fraction of the sweep gas, so the blood the circuit returns carries more oxygen to the upper body.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Blood already leaves the membrane at 99%. The desaturated blood at the right hand never went through the membrane; it came through the native lungs and out of the left ventricle.',
        },
        {
          id: 'vasopressor-for-upper-body',
          label:
            'Start or increase a vasopressor to raise mean arterial pressure and improve oxygen delivery to the brain and the coronary arteries.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The upper body is perfused; the blood reaching it is low in oxygen. A vasopressor does not change oxygen content, and it adds afterload for the ventricle and the pump.',
        },
      ],
      correctChoiceIds: ['verify-upper-body-and-read-both-circulations'],
      explanation:
        'On femoral venoarterial support, oxygenated circuit blood travels up the aorta and meets blood the heart ejects from the native lungs. When the heart recovers before the lungs, the aortic arch gets the desaturated native blood, and only a right-arm reading shows it. Confirm with a right radial gas or saturation. First improve native lung oxygenation with the ventilator. Raising circuit flow moves the mixing point toward the aortic root but loads the recovering left ventricle, so use it as a temporary step. If the right arm stays low, convert to VV when the heart has recovered, or add a venous return limb (V-AV) when both heart and lungs still need support.',
      evidenceIds: [
        'elso-adult-va-2021',
        'elso-neuro-monitoring-2024',
        'elso-dual-circulation-2024',
        'ecmo-book-ch17',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'verify-upper-body-and-read-both-circulations': {
        goalId: 'protect-upper-body',
        control: 'assess-upper-body',
        direction: 'inspect',
      },
      'raise-pump-speed': {
        goalId: 'restore-systemic-support',
        control: 'rpm',
        direction: 'increase',
      },
      'recheck-sensors-and-hold': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'raise-sweep-gas-fio2': {
        goalId: 'restore-membrane-function',
        control: 'gas-fio2',
        direction: 'increase',
      },
      'vasopressor-for-upper-body': {
        goalId: 'restore-vascular-tone',
        control: 'vasopressor',
        direction: 'perfusion',
      },
    },
  },
  'va-lv-loading': {
    item: {
      id: 'ecmo.learn.va-lv-loading.prediction',
      activityId: 'ecmo:learn:va-lv-loading',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'A patient in the maintenance phase of peripheral venoarterial support becomes harder to manage. Circuit blood flow is steady at about 4.0 L/min at the unchanged set speed. The arterial line reads a mean pressure of 70 mmHg, but the trace is nearly flat, with a pulse pressure of about 5 mmHg. Echocardiography shows the aortic valve barely opening and estimates native output at 0.8 L/min. The chest is markedly congested and the work of breathing is high. What do you do next?',
      choices: [
        {
          id: 'characterize-lv-loading-and-escalate',
          label:
            'Confirm on echo that the left ventricle is not ejecting, then turn circuit flow down to the lowest that perfuses and add an inotrope.',
          plausibility: 'best',
          rationale: `Good flow and a mean of 70 mmHg say nothing about the ventricle. A pulse pressure of 5 mmHg, a valve that barely opens and pulmonary edema mean it cannot eject against the circuit. Lower the afterload, help it eject, take volume off, and vent it if pulsatility stays ${ECMO_NUMBERS.value('lv-vent-pulsatility')}.`,
        },
        {
          id: 'raise-pump-speed',
          label:
            'Raise the pump speed for more circuit flow, because the native heart is contributing only 0.8 L/min and the patient needs more circulatory support.',
          plausibility: 'unsafe',
          rationale:
            'The ventricle is already losing against the pressure the circuit generates in the aorta. More flow raises that pressure, so the ventricle distends further, the lungs flood and blood stagnates in the chamber.',
        },
        {
          id: 'compare-arterial-sites',
          label:
            'Treat this as upper-body hypoxemia from native ejection, and compare a right-arm with a lower-body arterial saturation before changing anything.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'That problem needs a ventricle ejecting a real stream of desaturated blood. This one ejects 0.8 L/min through a valve that barely opens.',
        },
        {
          id: 'hunt-circuit-resistance',
          label:
            'Check the circuit pressures and the gradient across the oxygenator, because a rise in resistance on the return limb would raise the load on the ventricle.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The ventricle ejects against aortic pressure, which the circuit generates by design. A resistance inside the circuit would show as falling flow and rising post-pump pressures. Flow is steady at the set speed.',
        },
        {
          id: 'escalate-on-the-trace-alone',
          label:
            'Call for a mechanical vent of the left ventricle now on the flat arterial trace, and let the team work out the rest when they arrive.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The urgency is right and a vent may be needed. But a flat trace alone also fits a damped line, tamponade or a tension pneumothorax. Echo separates them in minutes, and lowering flow and adding an inotrope start before a vent arrives.',
        },
      ],
      correctChoiceIds: ['characterize-lv-loading-and-escalate'],
      explanation: `Retrograde flow raises the pressure the left ventricle ejects against. A ventricle that cannot open the aortic valve fills, distends and backs up into the lungs while circuit flow and mean pressure look fine. Then, in order: titrate circuit flow down to the lowest that perfuses, add or raise an inotrope so the ventricle ejects, take volume off with diuretics or renal replacement, and vent the ventricle (IABP, Impella, septostomy or surgical vent) if pulsatility stays ${ECMO_NUMBERS.value('lv-vent-pulsatility')}.`,
      evidenceIds: [
        'elso-adult-va-2021',
        'ecmo-book-ch9',
        'ecmo-book-ch17',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'characterize-lv-loading-and-escalate': {
        goalId: 'protect-left-heart',
        control: 'assess-lv-loading',
        direction: 'inspect',
      },
      'raise-pump-speed': {
        goalId: 'restore-systemic-support',
        control: 'rpm',
        direction: 'increase',
      },
      'compare-arterial-sites': {
        goalId: 'protect-upper-body',
        control: 'assess-upper-body',
        direction: 'inspect',
      },
      'hunt-circuit-resistance': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      'escalate-on-the-trace-alone': {
        goalId: 'protect-left-heart',
        control: 'correct-cause',
        direction: 'definitive',
      },
    },
  },
  'va-acute-hypercapnia': {
    item: {
      id: 'ecmo.learn.va-acute-hypercapnia.prediction',
      activityId: 'ecmo:learn:va-acute-hypercapnia',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'Early in the stabilization phase of peripheral venoarterial support, a right radial blood gas returns a PaCO2 of 68, a bicarbonate of 25, a pH of 7.18, and a saturation of 93%. The mean arterial pressure is 72, the lactate is 1.8, the pulse pressure is 18, the aortic valve is opening, and pulmonary congestion is mild. The patient is breathing 32 times a minute with high work of breathing. Circuit blood flow is steady, and the gas reaching the membrane is running at 2 L/min. What do you do first?',
      choices: [
        {
          id: 'increase-sweep-gas-flow',
          label:
            'Increase the sweep gas flow on the blender, leave pump speed and oxygen fraction alone, and repeat the gas.',
          plausibility: 'best',
          rationale:
            'A PaCO2 of 68 with a bicarbonate of 25 is acute respiratory acidemia. Sweep gas flow sets carbon dioxide removal, and at 2 L/min it has room to go up.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'Raise the pump speed so that more blood crosses the membrane each minute and carries more carbon dioxide out with it.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Pump speed is titrated to perfusion, and a mean of 72 with a lactate of 1.8 is adequate. It removes little extra carbon dioxide, and on venoarterial support it raises the afterload the left ventricle ejects against.',
        },
        {
          id: 'raise-sweep-gas-oxygen',
          label:
            'Raise the oxygen fraction of the sweep gas on the blender to improve gas exchange across the membrane.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The right radial saturation is 93%; oxygen is not the problem. Oxygen fraction does not change how much carbon dioxide the sweep carries away, so the pH stays at 7.18.',
        },
        {
          id: 'review-lv-loading-first',
          label:
            'Hold the settings and assess the left ventricle first: pulsatility, aortic valve opening and the lungs, before changing gas exchange.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Worth a look in a patient working this hard, but a loaded ventricle has a pulse pressure near 5, a closed valve and worsening edema. This patient has a pulse pressure of 18, an opening valve and mild congestion.',
        },
        {
          id: 'escalate-vasopressor',
          label:
            'Treat the pH of 7.18 as inadequate systemic perfusion, and increase vasopressor support before looking at gas exchange.',
          plausibility: 'unsafe',
          rationale:
            'The pH is low because of carbon dioxide, not lactate: bicarbonate is 25, lactate 1.8 and mean pressure 72. More vasoconstriction raises afterload on the left ventricle and leaves the patient breathing 32 times a minute.',
        },
      ],
      correctChoiceIds: ['increase-sweep-gas-flow'],
      explanation: `A PaCO2 of 68 with a bicarbonate of 25 puts the whole pH change on carbon dioxide: this is acute respiratory acidemia. Sweep gas flow controls carbon dioxide removal. Increase the sweep on the blender and recheck the gas, bringing the PaCO2 down over ${ECMO_NUMBERS.value('paco2-correction-time')} because a rapid fall changes cerebral blood flow. Draw the gas from the right radial.`,
      evidenceIds: [
        'ecmo-book-ch16',
        'ecmo-book-ch18',
        'elso-adult-va-2021',
        'elso-dual-circulation-2024',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'increase-sweep-gas-flow': {
        goalId: 'improve-acidemia',
        control: 'sweep',
        direction: 'increase',
      },
      'raise-pump-speed': { goalId: 'restore-gas-transfer', control: 'rpm', direction: 'increase' },
      'raise-sweep-gas-oxygen': {
        goalId: 'protect-upper-body',
        control: 'gas-fio2',
        direction: 'increase',
      },
      'review-lv-loading-first': {
        goalId: 'protect-left-heart',
        control: 'assess-lv-loading',
        direction: 'inspect',
      },
      'escalate-vasopressor': {
        goalId: 'restore-vascular-tone',
        control: 'vasopressor',
        direction: 'perfusion',
      },
    },
  },
  'va-gas-source-interruption': {
    item: {
      id: 'ecmo.learn.va-gas-source-interruption.prediction',
      activityId: 'ecmo:learn:va-gas-source-interruption',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'Minutes into a peripheral venoarterial run the patient deteriorates. Circuit blood flow, the drainage pressure, both membrane pressures and the gradient across the membrane are exactly where they have been. Blood leaving the membrane has fallen from a saturation of 99% to 72%. The right radial saturation has fallen from 96% to 80%, and a femoral sample that read 98% earlier now reads 78%. The arterial carbon dioxide has climbed quickly from the mid-40s and the pH is drifting down with it. The sweep control still displays its set value. What do you do first?',
      choices: [
        {
          id: 're-establish-the-gas-supply-path',
          label:
            'Trace the sweep gas line from the wall outlet or cylinder through the blender to the oxygenator, and restore delivery.',
          plausibility: 'best',
          rationale:
            'Pressures and flow are untouched because the blood path is fine. Blood leaving the membrane at 72%, both arterial sites falling together and carbon dioxide rising in minutes mean the membrane has no gas.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'Raise the pump speed until the arterial saturations recover, because the patient needs more oxygenated blood from the circuit.',
          plausibility: 'unsafe',
          rationale:
            'The circuit is returning blood at 72%. More flow sends more of that desaturated blood up the aorta toward the coronaries and brain, and raises left ventricular afterload, while the gas line stays unchecked.',
        },
        {
          id: 'turn-the-sweep-up',
          label:
            'Turn the sweep gas flow up, because carbon dioxide is the value moving fastest and sweep is the control that clears it.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The dial shows what you asked for, not what reaches the membrane. Blood leaving the membrane at 72% with the sweep still reading its set value means gas is not arriving.',
        },
        {
          id: 'exchange-the-oxygenator',
          label:
            'Call for an oxygenator exchange, because blood leaving the membrane at 72% means the membrane has stopped exchanging gas.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A failing oxygenator usually gives hours of warning and a rising gradient; this took minutes and the gradient is unchanged. A working oxygenator with no gas looks identical at the outlet.',
        },
        {
          id: 'resample-the-two-arterial-sites',
          label:
            'Repeat the right radial and femoral samples first, to confirm where circuit and native blood are meeting before touching the circuit.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Comparing two arterial sites is the right habit on venoarterial support, and it finds upper-body hypoxemia when the sites separate. Here both fell together, and the blood leaving the membrane fell too.',
        },
      ],
      correctChoiceIds: ['re-establish-the-gas-supply-path'],
      explanation:
        'The console monitors the blood path and has no sensor on the gas side, so when sweep gas stops arriving, flow and every pressure stay normal. What changes is fast: carbon dioxide climbs in minutes, blood leaves the membrane desaturated, and the right radial and femoral saturations fall together. Steady venoarterial flow never proves the returned blood is oxygenated. Trace the gas line by hand, from wall outlet or cylinder to blender to oxygenator, and reconnect it before you touch a setting.',
      evidenceIds: [
        'ecmo-book-ch9',
        'ecmo-book-ch18',
        'elso-circuit-2022',
        'elso-adult-va-2021',
        'elso-dual-circulation-2024',
        'elso-neuro-monitoring-2024',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      're-establish-the-gas-supply-path': {
        goalId: 'restore-gas-transfer',
        control: 'restore-gas',
        direction: 'restore',
      },
      'raise-pump-speed': {
        goalId: 'increase-effective-support',
        control: 'rpm',
        direction: 'increase',
      },
      'turn-the-sweep-up': {
        goalId: 'improve-acidemia',
        control: 'sweep',
        direction: 'increase',
      },
      'exchange-the-oxygenator': {
        goalId: 'localize-resistance',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
      'resample-the-two-arterial-sites': {
        goalId: 'protect-upper-body',
        control: 'assess-upper-body',
        direction: 'inspect',
      },
    },
  },
  'va-arterial-bubble-stop': {
    item: {
      id: 'ecmo.learn.va-arterial-bubble-stop.prediction',
      activityId: 'ecmo:learn:va-arterial-bubble-stop',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'Four seconds into a peripheral venoarterial run, a high-priority alarm sounds: air detected on the arterial return limb, past the membrane, at the flow and bubble sensor. The bubble stop has halted the pump and stays latched. Blood flow reads zero, the pressure channels show no numbers, both limbs are unclamped, and the mean arterial pressure is already falling. The alarm carries no bubble size. What do you do next?',
      choices: [
        {
          id: 'isolate-then-resolve-source',
          label:
            'Clamp the return limb, then the drainage limb, near the patient; call for the backup circuit; then find the source and clear the air.',
          plausibility: 'best',
          rationale:
            'On venoarterial support the return limb is an arterial line, so air there goes to the brain and coronaries. A stopped pump is not a valve; with both limbs open, arterial pressure drives blood backward through the circuit. Clamp the return limb first, then support the patient while you clear the air.',
        },
        {
          id: 'restart-pump-now',
          label:
            'Reset the bubble stop and restart the pump now, because a patient with no circuit flow and a falling pressure cannot wait for a circuit inspection.',
          plausibility: 'unsafe',
          rationale:
            'The air is still there, in a limb that empties into the aorta. Restarting pumps it into the patient. Lost flow is a reason to work fast, not to skip the clamps.',
        },
        {
          id: 'isolate-and-hand-over',
          label:
            'Clamp both limbs near the patient, support the circulation with inotropes and vasopressors, and leave the circuit for the perfusionist to clear.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Clamping, calling for help and supporting the patient are right. But the entry is still open; find it, close it and clear the air, or the circuit stops again when it restarts.',
        },
        {
          id: 'vasopressor-for-pressure',
          label:
            'Start a vasopressor for the falling arterial pressure, and leave the circuit alone until the pressure has come back up.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Pressure is falling because circuit flow stopped, not because tone changed. Vasopressors and inotropes belong in the sequence, after the clamps. Alone they leave air in an open arterial limb.',
        },
        {
          id: 'exchange-the-oxygenator',
          label:
            'Set up an oxygenator exchange as the first move, because air appearing after the membrane means the membrane is leaking.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The sensor shows where air was found, not where it got in. Entry is usually on the negative-pressure side: a loose connector, a stopcock, an access port. An exchange takes minutes, and it follows the clamps.',
        },
      ],
      correctChoiceIds: ['isolate-then-resolve-source'],
      explanation:
        'The bubble stop halts the pump; it does not clamp the circuit or remove the air. Clamp the return limb, then the drainage limb, near the patient. Call for help and the primed backup circuit. Support the patient with the ventilator, inotropes and vasopressors. Find and close the source and aspirate the air; exchange the circuit if it cannot be cleared quickly. Resume only when the source is fixed and the circuit is free of bubbles: drainage clamp open, bubble stop reset on the Interventions screen (which restarts the pump), return clamp open last.',
      evidenceIds: [
        'ifu-console-workflow',
        'ifu-anomaly-boundary',
        'elso-circuit-2022',
        'elso-adult-va-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'isolate-then-resolve-source': {
        goalId: 'prevent-air-return',
        control: 'correct-cause',
        direction: 'inspect',
      },
      'restart-pump-now': {
        goalId: 'maintain-continuous-support',
        control: 'initiate-support',
        direction: 'restore',
      },
      'isolate-and-hand-over': {
        goalId: 'restore-systemic-support',
        control: 'isolate-circuit',
        direction: 'temporary',
      },
      'vasopressor-for-pressure': {
        goalId: 'restore-systemic-support',
        control: 'vasopressor',
        direction: 'perfusion',
      },
      'exchange-the-oxygenator': {
        goalId: 'restore-gas-transfer',
        control: 'exchange-oxygenator',
        direction: 'definitive',
      },
    },
  },
  'va-transport-power-loss': {
    item: {
      id: 'ecmo.learn.va-transport-power-loss.prediction',
      activityId: 'ecmo:learn:va-transport-power-loss',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: 'You are moving a patient on peripheral venoarterial support out of the unit for imaging. Moments into the move the console alarms, the power indicator switches to battery on its own, and the battery reserve reads 24 percent. Circuit blood flow, both membrane pressures, the gradient across the membrane, the arterial trace and the right radial saturation are unchanged, and the patient looks the same. What do you do next?',
      choices: [
        {
          id: 'verified-source-with-backup-alongside',
          label:
            'Plug the console into a power source and confirm it is charging, recheck flow, the arterial trace and the right-arm saturation, and keep the emergency drive on the cart.',
          plausibility: 'best',
          rationale:
            'The console lost its supply and the battery is now a countdown. A source counts only once you see the console charging.',
        },
        {
          id: 'slow-the-pump-to-stretch-the-reserve',
          label:
            'Turn the pump speed down to reduce the power draw, so the battery lasts until the cart reaches an outlet at the scanner and the console can be plugged in.',
          plausibility: 'unsafe',
          rationale:
            'On venoarterial support the pump is the patient’s circulation. Turning it down trades perfusion for an unknown amount of extra run time, and the console is still on a draining battery.',
        },
        {
          id: 'readiness-then-continue-on-reserve',
          label:
            'Bring the backup console and emergency drive alongside the cart, then continue and plug in at the scanner, because the switch was automatic and 24 percent covers a short trip.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Having the backup with you is right. But 24 percent is charge, not minutes, and a held elevator or a delayed scanner stretches the trip.',
        },
        {
          id: 'search-the-circuit-for-the-alarm',
          label:
            'Check the circuit and the oxygenator for the cause of the alarm before doing anything about the power supply, in case the blood path has changed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The alarm is about power. Flow, pressures and gradient have not moved, so the blood path is fine. Every minute spent there comes off the battery.',
        },
      ],
      correctChoiceIds: ['verified-source-with-backup-alongside'],
      explanation:
        'An automatic switch to battery puts the run on a clock. Plug into a source and confirm the console is charging, recheck flow, pressures, the arterial trace and the right-arm saturation, and keep the backup console and emergency drive with the patient. If the console stops, go to the emergency drive: both clamps closed, disposable across, venous clamp open, crank clockwise, arterial clamp open once speed is up. The simulated battery drains at a fixed rate; a real one depends on load and battery age.',
      evidenceIds: [
        'ifu-console-workflow',
        'ecmo-book-ch9',
        'elso-circuit-2022',
        'elso-adult-va-2021',
        'bounded-educational-model',
      ],
      reviewStatus: 'draft',
    },
    commitments: {
      'verified-source-with-backup-alongside': {
        goalId: 'maintain-continuous-support',
        control: 'restore-power',
        direction: 'restore',
      },
      'slow-the-pump-to-stretch-the-reserve': {
        goalId: 'restore-systemic-support',
        control: 'rpm',
        direction: 'decrease',
      },
      'readiness-then-continue-on-reserve': {
        goalId: 'maintain-continuous-support',
        control: 'inspect-circuit',
        direction: 'hold',
      },
      'search-the-circuit-for-the-alarm': {
        goalId: 'localize-resistance',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
    },
  },
}

// Validate at import so a malformed item, a learner-copy violation, or a choice with no prediction
// behind it is loud and immediate.
for (const [scenarioId, entry] of Object.entries(authored)) {
  clinicalLearningItemSchema.parse(entry.item)
  for (const choice of entry.item.choices) {
    if (!entry.commitments[choice.id]) {
      throw new Error(`Learn prediction ${scenarioId}: choice ${choice.id} commits no prediction`)
    }
  }
  for (const choiceId of Object.keys(entry.commitments)) {
    if (!entry.item.choices.some((choice) => choice.id === choiceId)) {
      throw new Error(`Learn prediction ${scenarioId}: commitment ${choiceId} has no choice`)
    }
  }
}

export const ecmoLearnPredictions = authored

export function ecmoLearnPredictionFor(scenarioId: string): EcmoLearnPrediction | undefined {
  return authored[scenarioId]
}

/**
 * The same lookup, but a missing entry is a build-time failure rather than an empty question.
 *
 * A Learn step that declares itself a prediction and then finds no authored item would fall back to
 * the defect this package removes — a step with no real choice — so the lesson table refuses to
 * construct instead.
 */
export function requireEcmoLearnPrediction(scenarioId: string): EcmoLearnPrediction {
  const prediction = authored[scenarioId]
  if (!prediction) {
    throw new Error(`Missing authored Learn prediction for scenario: ${scenarioId}`)
  }
  return prediction
}
