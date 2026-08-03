import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import type { PredictionControl, PredictionDirection } from '../engine/types'

/**
 * The authored prediction a learner answers before acting, one for every Learn lesson.
 *
 * All twenty Learn prediction steps are here: the eighteen drills and the two console-orientation
 * lessons, which had the same defect in a quieter form — they did not print the answer in prose,
 * but they still handed the payload over with no option set to choose from.
 *
 * These replace a generated step that handed over the answer. The old prompt read "The safe goal is
 * X. Use <control> and predict <direction>.", its rationale printed the scenario's whole causal
 * chain above the button, and the single button dispatched the scenario's own expectation as the
 * payload — so the learner was credited for reading rather than for reasoning.
 *
 * Each item is a clinical question with distractors a real learner would consider. Every choice
 * carries the prediction triple that choosing it commits the learner to, so the engine scores what
 * the learner actually decided: the best choice's triple equals the scenario's expectation, and the
 * others are the triples a learner holding that particular wrong model would pick.
 *
 * Authored to the standard set by `foundationLearningItems.ts` and validated at import, so a
 * malformed item or a learner-copy violation is loud and immediate rather than a runtime surprise.
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
      stem: 'You have finished the tour of the console on a freshly primed venovenous circuit and brought the pump back to a stop. The startup diagnostic has not yet been allowed to run through, the ordered speed and sweep are written on the chart, and the flow reads zero while pVen, pInt and pArt show the unavailable indication rather than numbers. Nothing about the circuit has been touched by hand yet: the tubing runs from the drainage cannula to the pump, through the oxygenator and back to the return cannula, and the gas line and the blender are hanging on the side of the trolley. What do you commit to before support is established?',
      choices: [
        {
          id: 'verify-the-whole-system-first',
          label:
            'Work the whole pre-use sequence before support is set: let the startup diagnostic run through, then walk the circuit by hand from drainage cannula to return cannula — flow-probe orientation, which pressure location sits on which limb, the gas source and blender, every connection and both cannulas, power and an immediately available backup — and pair it with the patient data the console has no way of producing.',
          plausibility: 'best',
          rationale:
            'This is the only option that treats the four information domains the tour just established as four separate things to verify. The console reports on itself and on the sensors it can see; it says nothing about which way round the flow probe was clipped on, which limb a pressure line was tied to, whether the gas is actually flowing, how the cannulas are secured, or what the patient looks like. Doing it now, on a stopped and unpressurised circuit, is also the only moment when finding a problem costs nothing.',
        },
        {
          id: 'diagnostic-is-the-verified-state',
          label:
            'Let the startup diagnostic run through and confirm the startup screen and the audible indicator — a device that reports itself ready is the verified starting state, so move on to setting support.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Everything named here is real and does have to happen; a device that will not come up ready must not be used. What makes it a partial commitment is the inference drawn from it. The diagnostic exercises device functions and the sensors the device can interrogate, and it reports on that scope only. It cannot look at flow-probe direction, at which limb carries which pressure line, at an unopened gas cylinder, at a connection that is finger-tight, or at whether a backup console is in the room — and it has no view of the patient at all. Declaring the system verified on the strength of the one component that reports on itself leaves the rest unexamined.',
        },
        {
          id: 'start-then-inspect-under-flow',
          label:
            'Nothing on the console is showing a fault, so bring the pump up to the ordered speed now and walk the tubing and sensors once support is running and the numbers are live.',
          plausibility: 'unsafe',
          rationale:
            'A quiet console is not a verified circuit, and the reasoning inverts the sequence that makes the walk safe. Every finding this step exists to catch — a flow probe clipped on backwards, a pressure line on the limb it is not labelled for, a gas source still closed, a connection that has not been tightened — is invisible to the device and becomes far more dangerous to put right once the patient’s blood is moving through the circuit under pressure. Waiting for the numbers to go live also gets the dependency backwards: the numbers only become interpretable once you know which sensor is on which limb.',
        },
        {
          id: 'chase-the-missing-pressures',
          label:
            'The pressure channels are showing nothing where pVen, pInt and pArt should be, so start with the pressure sensors and their cables — no reading can be trusted until those three report.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Absent numbers usually do mean a sensor or cable problem, and that reflex is worth having. It is refuted here by the state the circuit is in rather than by anything clinical. The pump is stopped, and the three circuit pressures are flow-dependent patterns that this educational model has nothing to report for a settled pump-off circuit — which is why the console shows the unavailable indication rather than a number. Flow is the contrast that gives it away: with its sensor connected it reads zero, and zero is a real value rather than an absent one. The pressure channels are expected to start reporting once the pump is brought up.',
        },
        {
          id: 'gas-path-first',
          label:
            'Open and confirm the gas source and set sweep and sweep-gas oxygen on the blender first, so membrane gas exchange is ready the instant the pump starts; the tubing can be traced after that.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The gas path genuinely does need verifying by hand, and it is one of the things the console will not warn about — a separate blender and a closed cylinder look identical from the touchscreen. The gap is that this names one limb of the check and then treats it as the check. The gas source sits on the same list as flow-probe orientation, the three pressure locations, the cannulas and connections, power and backup readiness, and the independent patient data. Setting the blender establishes nothing about whether the blood path is right.',
        },
      ],
      correctChoiceIds: ['verify-the-whole-system-first'],
      explanation:
        'What separates these is the scope each one claims. A device diagnostic is a statement about device functions; a walk from cannula to cannula is a statement about the circuit; the blender is a statement about the gas path; the bedside and the blood gas are statements about the patient. None of the four substitutes for another, and the console can only speak to the first two. The stopped, unpressurised circuit in front of you is the one state in which the other three can be checked without cost, which is why the verification comes before support rather than after it. Model boundary: this is a bounded educational simulation rather than a patient twin. The circuit walk here resolves to a single check rather than to the dozens of individual confirmations a real pre-use list contains, and the absent pressure numbers are this model declining to produce flow-dependent values for a stopped pump rather than a reproduction of what any particular console displays. Local pre-use documentation, the manufacturer instructions, and the unit’s backup and escalation policy govern the real sequence.',
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
      stem: 'Ninety minutes into a venovenous run the pump speed has not been altered. Displayed circuit flow has fallen from about 4.6 L/min and now swings between roughly 2.8 and 3.2 L/min every few seconds, the drainage pressure has moved from about -35 to about -80 mmHg over the same period, and the drainage tubing is visibly juddering with each swing. pInt and pArt have drifted down with the flow rather than up, and the gradient across the membrane has narrowed with the flow rather than widened. The patient was suctioned and repositioned a few minutes ago and has been coughing and straining against the ventilator since. Which action do you commit to first?',
      choices: [
        {
          id: 'unload-then-find-cause',
          label:
            'Back the pump off now, and use the calmer circuit to work out why venous return has fallen short — cannula position, a kinked or compressed drainage limb, the straining, and volume state.',
          plausibility: 'best',
          rationale:
            'Flow that no longer follows the speed while suction on the drainage limb keeps climbing puts the limitation upstream of the pump, in what is being offered to it rather than in what the pump can do. Less demand means less suction, so the intermittent collapse and the juddering settle and there is a steady circuit to reason on. The limitation itself is untouched until its cause is found and put right, which is what makes this a holding measure rather than the end of the sequence.',
        },
        {
          id: 'raise-speed-to-defend-flow',
          label:
            'Bring the speed up until the flow display comes back toward where it was, then look for the cause.',
          plausibility: 'unsafe',
          rationale:
            'This treats the flow display as the thing to be defended and the pump as the source of the deficit. A centrifugal pump can only produce more flow by pulling harder, and pulling harder on a limb that is already drawing shut intermittently deepens the same collapse. The finding that refutes the reasoning is already on the console: suction is climbing while flow has stopped following the speed.',
        },
        {
          id: 'fluid-first',
          label:
            'Give a fluid bolus straight away, since a drainage pressure this negative means the patient is under-filled.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Low circulating volume is one real cause of a preload-limited circuit, and volume may well turn out to be part of the answer here. What leaves this incomplete as a first commitment is that it names a cause before looking for one: cannula position, a kinked or compressed drainage limb, and the straining described here all produce this same pattern. The pump goes on asking for more than it is being offered while the fluid runs in, and a bolus given on this assumption loads a patient whose limitation may be entirely mechanical.',
        },
        {
          id: 'assess-without-changing-demand',
          label:
            'Change nothing on the console and go straight to the patient and the drainage limb; the setting should stay where it is until the cause has been named.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Going to the patient is right, and the cause does have to be named before anything is called settled. The gap is what happens during the look: the pump keeps asking for more than the circulation is offering, so the suction that is drawing the vessel or cannula shut is applied throughout, and support goes on swinging while the search proceeds. Unloading the pump and looking for the cause are not alternatives to one another.',
        },
        {
          id: 'exchange-the-oxygenator',
          label: 'Read this as a failing membrane lung and escalate for an oxygenator exchange.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads any fall in achievable flow as something obstructing the path, and a fouled membrane is a genuine version of that story. It is refuted by where the pressures moved: a membrane that is itself the resistance raises pInt relative to pArt and widens the gradient across it, whereas here the gradient has narrowed with the flow and both post-pump pressures have drifted down. The pressure that changed is on the drainage side of the pump.',
        },
      ],
      correctChoiceIds: ['unload-then-find-cause'],
      explanation:
        'The location of the pressure change localises this. A pump that cannot get what it is asking for shows it on the side it is pulling from: suction climbs, flow stops tracking the speed, and the drainage limb judders as the vessel or cannula intermittently draws shut. Nothing downstream is limiting the circuit here, since the post-pump pressures and the gradient across the membrane fell with the flow instead of rising. Taking demand off the pump is a holding measure that quiets the collapse and makes the circuit steady enough to search on; the search is what finds the cannula, the kink, the strain, or the volume, and until one of those has been put right the limitation is still present. Model boundary: this is a bounded educational simulation rather than a patient twin. The juddering is a flag this model switches on below a drainage pressure it chooses, not a rendering of how a real drainage line kicks, and the numbers come from simplified response curves. The console does carry adjustable pressure limits, but those are device alarm limits rather than a taught cut point: no number for how negative is too negative is offered here, because that value depends on cannula size, patient size, and configuration. At the bedside the same decision also draws on echocardiography, imaging of cannula position, and the volume picture, none of which this lab reproduces.',
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
      stem: 'A venovenous run that has been steady all shift begins to change over about twenty minutes. The set speed has not been touched, and circuit blood flow has fallen from 4.0 to 2.8 L/min. pInt and pArt have each risen by roughly 100 mmHg above where they sat this morning, and the gradient between them has not widened — at the lower flow it is a little narrower than it was. pVen is no more negative than before and the drainage line is not chattering. Neither pressure has reached its alarm limit. The patient has drifted from a saturation of 97 to a saturation of 92 as the flow fell, and the arterial carbon dioxide value has barely moved on an unaltered sweep. Which explanation do you commit to, and what does committing to it oblige you to do next?',
      choices: [
        {
          id: 'downstream-of-the-membrane',
          label:
            'Something downstream of the membrane lung is resisting the blood on its way back to the patient — walk the return limb from the membrane outlet to the cannula before any setting is moved.',
          plausibility: 'best',
          rationale:
            'An obstruction downstream of the membrane raises the pressure in every segment between it and the pump, so the two post-pump zones rise together while the gradient across the membrane does not widen — that gradient is a resistance multiplied by the flow through it, so at a lower flow it narrows a little even though the membrane itself has not changed. A drainage side that has not become more negative places the limit downstream of the pump rather than upstream of it. What the walk covers is tubing, clamps, connectors, cannula position, and whether the pressure channels are reporting plausibly; naming the segment first is what makes the next action land on the obstruction instead of on the display.',
        },
        {
          id: 'raise-the-speed',
          label:
            'Flow is what has been lost — raise the pump speed until the displayed flow comes back to where it sat this morning.',
          plausibility: 'unsafe',
          rationale:
            'This treats displayed flow as the thing to be restored rather than as the consequence of a mechanical limit. The circuit is already pushing against something that has not moved: more speed drives pInt and pArt higher against the same obstruction, buys little flow, and adds hemolysis risk while the cause stays unnamed behind a display that looks slightly better. The sources for this drill describe chasing a mechanically limited flow with repeated speed escalation as the reflex to resist.',
        },
        {
          id: 'exchange-the-membrane',
          label:
            'The membrane lung has fouled and is now the resistance — begin the local process for an oxygenator exchange while support continues.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads any rise in pInt as a verdict on the membrane, but the return path lies downstream of pInt as well, so pInt rises for either reason. What separates them is the pressure after the membrane: a membrane resisting more pulls pInt away from pArt and widens the gradient between them. Here pArt has risen with pInt and the gradient has not widened, which argues against the very component this action would replace.',
        },
        {
          id: 'call-it-drainage',
          label:
            'The circuit has run out of drainage — bring the speed down and work on the venous side until flow follows the pump again.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads a falling flow at an unchanged speed as a starved circuit. A drainage limitation announces itself on the suction side, as a pVen becoming more negative while chasing a flow that will not follow, usually with chatter in the drainage line. pVen is no more negative here and the line is quiet, and nothing upstream of the pump raises the two pressures that sit downstream of it.',
        },
        {
          id: 'suspect-the-transducers',
          label:
            'The pressure channels themselves are suspect — re-zero the transducers and hold support where it is until the numbers can be relied on.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Sensor plausibility genuinely belongs in this workup, which is why walking the return limb includes it rather than being replaced by it. What makes this insufficient on its own is that flow is measured on a separate channel and has fallen alongside the pressures, and the patient has followed it down. A transducer reading falsely high moves a display; it does not slow a pump or desaturate a patient.',
        },
      ],
      correctChoiceIds: ['downstream-of-the-membrane'],
      explanation:
        'Two post-pump pressures rising together with a gradient that has not widened puts the resistance downstream of both of them, and a drainage pressure that has not become more negative puts it downstream of the pump. That is enough to name a segment and go to it, which is what lets the next action land on the obstruction rather than on a setting. Boundaries worth carrying out of this drill. In this educational model the obstruction is one fixed resistance at a single downstream location, so it neither varies with posture nor eases on its own, while a real return-side problem is often positional, partial, or intermittent. The gradient across the membrane is generated here as a resistance multiplied by the flow through it, so it moves with flow whether or not the membrane has changed; it is read against this circuit’s own earlier value at a similar flow, and no threshold for it is published in this module. Carbon dioxide clearance in this model follows the sweep alone, so it does not move when circuit blood flow falls; in a real circuit a fall of this size would trim it somewhat, and a fouling membrane can go on clearing carbon dioxide well after its oxygen transfer has dropped — so a steady carbon dioxide value is not what separates these two mechanisms here; the pressure pattern is. And pArt names a pressure in the return-side tubing, not the patient’s arterial blood pressure — in venovenous support that limb returns oxygenated blood into the venous circulation, and the patient’s blood pressure still comes from the independent monitor.',
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
      stem: 'A patient on established venovenous support has had no change made to the pump speed since this morning, but displayed circuit flow has drifted from 4.0 to 3.1 L/min across the shift. The pressure between the pump and the membrane lung now reads about 330 mmHg, while the pressure on the return limb after the membrane reads about 190 mmHg, a little lower than this morning rather than higher; the difference between the two has widened from roughly 30 mmHg to roughly 140 mmHg over the same period. The post-membrane saturation reads 88 where it read 99 this morning, the patient’s arterial saturation has drifted from a saturation of 97 to a saturation of 85, the drainage pressure is no more negative than it was, and the sweep setting is unchanged. What do you commit to next, and on what grounds?',
      choices: [
        {
          id: 'localize-across-the-membrane',
          label:
            'Localize the problem to the segment between those two pressure locations: go to the membrane lung and the channels that bracket it, satisfy yourself that each channel is reporting plausibly, and take what you find to the local exchange protocol.',
          plausibility: 'best',
          rationale:
            'The gradient is what does the localizing. A resistance lying between the two sensors widens the difference between them, and the pressure after the membrane has not moved up with the one before it, which is what separates this from a limb obstructed further downstream. The falling post-membrane saturation is a second and independent line: a membrane fouling its blood path is often exchanging gas less well too, although the two need not move together, which is why both are read rather than either alone. Channel plausibility belongs in the same look, because one mis-sited or faulty pressure sensor reproduces the pressure half of this picture and none of the gas half.',
        },
        {
          id: 'raise-speed-to-recover-flow',
          label:
            'Bring displayed circuit flow back toward 4 L/min by raising the pump speed, and look for a cause once support is restored.',
          plausibility: 'unsafe',
          rationale:
            'This treats flow as a setting to be dialled back in rather than as the result of the loading the pump is working against. The widening gradient refutes it: the resistance lies inside the blood path, so more speed drives more blood across an already-abnormal membrane, raising the pressure before the membrane further and the hemolysis concern with it while the membrane goes on transferring poorly — the post-membrane saturation does not recover because more blood was pushed through it. Driving a mechanically limited flow harder is the reflex this pattern exists to interrupt.',
        },
        {
          id: 'raise-the-sweep',
          label:
            'Raise the sweep gas, since both the patient’s saturation and the post-membrane saturation have fallen and gas transfer is the function that has given way.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The model behind this is that any deterioration in oxygenation is answered at the gas control. Sweep principally moves carbon dioxide clearance, and the pressure pattern refutes the reading anyway: a membrane whose gradient has widened several-fold is obstructing blood as well as exchanging poorly, and offering it more gas restores neither.',
        },
        {
          id: 'clear-the-return-limb',
          label:
            'Read the high post-pump pressure as an obstruction downstream and act on the return limb, freeing the tubing and repositioning the return cannula.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The mental model is that a high pressure after the pump means something is blocking the way out, without asking which locations moved together. The return-limb pressure refutes it: an obstruction downstream of the membrane lifts both post-pump pressures together and leaves the gradient tracking flow, whereas here only the pressure before the membrane has climbed and the one beyond it has not.',
        },
        {
          id: 'exchange-immediately',
          label: 'Name the membrane as the problem and call for an immediate circuit exchange.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The mechanism named here is the one the pattern supports, which is what makes moving straight to the remedy tempting. What it skips is the step that keeps a faulty pressure channel, a kink between the two sensors, or a clotted connector from being answered with a circuit exchange. The exchange is itself a high-risk manoeuvre, timed by the local protocol and the team against gas transfer, hemolysis and platelet trends rather than by a single gradient reading.',
        },
      ],
      correctChoiceIds: ['localize-across-the-membrane'],
      explanation:
        'Three facts from the pressurised side localize this: the location before the membrane has risen, the location beyond it has not, and the difference between them has widened while flow fell at an unaltered speed. A resistance downstream of the membrane raises both post-pump locations together and leaves that difference tracking flow; a resistance in the membrane separates them. The post-membrane saturation is the second and independent line, and it is what distinguishes the membrane itself from tubing kinked between the two sensors. Boundaries worth carrying to the bedside: this module publishes no numeric threshold for the gradient and no alarm priority for it, because the supplied device labeling is internally inconsistent on that point, so the gradient is read as a trend against this circuit’s own earlier behaviour. Hemolysis, fibrin and thrombus burden are named here as concerns but are not represented in the bounded model these numbers come from, so if you go on to drive this circuit faster the lab will show you a flow that improves and none of the cost that makes speed the harmful answer at a bedside. The decision to exchange a membrane belongs to the local protocol and the team.',
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
      stem: 'A patient on venovenous support has been deteriorating over the last hour, and nothing has been changed to explain it: the pump sits at the speed the run opened with, the sweep gas has been at 4.0 L/min all shift, and the blender is delivering pure oxygen to the membrane. The console reports 4.8 L/min of circuit blood flow, and every circuit pressure sits where it has sat all shift. Blood leaving the membrane reads a saturation of 99. The patient’s arterial saturation has drifted down to 92, with a carbon dioxide of 46 and a pH of 7.36, and the drainage-limb saturation the console reports has climbed to 83 — moving toward the patient’s own arterial value rather than sitting well below it. Which reading of this pattern do you commit to, and what does it make the next step?',
      choices: [
        {
          id: 'returned-blood-is-being-redrained',
          label:
            'The circuit is draining back much of what it just returned, so the displayed litres count the same blood twice — go and read the circuit and the cannulae before changing a setting.',
          plausibility: 'best',
          rationale:
            'The drainage limb carries systemic venous blood mixed with blood the circuit has just returned. A drainage value of 83 against returned blood of 99 puts a large share of that limb on its second circuit, and the patient drifting down while that value climbs is the divergence that separates re-drainage from the alternatives — a systemic venous saturation of 83 would be a surprising finding in a patient whose arterial saturation is falling. No channel on this console separates blood on its second circuit from blood on its first, so the next information comes from the circuit and the cannulae rather than from another number on the screen.',
        },
        {
          id: 'ask-for-more-flow',
          label:
            'The drainage limb looks diluted because the pump is not drawing enough systemic venous blood — ask the circuit for more flow until the saturation comes back.',
          plausibility: 'unsafe',
          rationale:
            'This reads a high drainage value as too little drainage, and it is the reflex this pattern invites. Pulling harder on a circuit that is already re-draining its own return recruits more of that return than it recruits systemic venous blood: the displayed L/min climbs, the flow doing useful work falls, and the drainage saturation rises further. In this simulation, asking for more than the speed the run opened with moves the arterial saturation down rather than up.',
        },
        {
          id: 'exchange-the-membrane',
          label:
            'The membrane lung has stopped transferring oxygen, which is why the patient is falling — prepare to exchange the component and leave the speed where it is.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A membrane losing transfer lowers the saturation of the blood it returns, and the drainage value follows it downward. Here the returned blood reads a saturation of 99 and the pressures on either side of the membrane have not moved, so this commits a definitive intervention against the one component these findings already exonerate.',
        },
        {
          id: 'turn-up-the-sweep',
          label:
            'Gas transfer across the membrane is the limit in a patient who is hypoxemic despite full support — turn the sweep gas up and watch the saturation.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This treats sweep as an oxygenation control. Sweep flow carries carbon dioxide away from the membrane, while the oxygen the blood picks up there is already as complete as it gets — which is what a returned saturation of 99 on pure oxygen reports. In this simulation, taking the sweep to 6.0 L/min leaves the arterial saturation where it is and drives the carbon dioxide from 46 down to about 31 with a pH near 7.5, a change this patient did not need.',
        },
        {
          id: 'localize-without-naming',
          label:
            'Support is being lost somewhere between drainage and return — go and localize where the circuit is resisting before naming a mechanism.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Going to look is the right instinct, and this would probably reach the finding eventually. But it treats a resistance problem and re-drainage as indistinguishable when they are not: resistance announces itself in the pressures on either side of the membrane and in a flow that stops following the speed, and neither has happened here. A drainage saturation climbing while the patient drifts down, with the returned blood fully saturated, has already named the mechanism.',
        },
      ],
      correctChoiceIds: ['returned-blood-is-being-redrained'],
      explanation:
        'Displayed L/min counts every litre the pump moved, including blood returned and drained again without having gone anywhere. At the share this case carries, roughly half of what the drainage limb holds is blood the circuit has just returned, so of the 4.8 L/min on the screen only about 2.5 L/min is on its first circuit — and that is the quantity the patient follows. The drainage saturation and the patient moving in opposite directions is the whole signature, and it is invisible if only the flow display is watched. Three boundaries of this simulation are worth naming. The re-drained share is authored as a property of this case at and below the speed it opened with and widens when the circuit is asked for more, while cannula position, cannula design, volume state and native venous return — the things that set recirculation at the bedside — are not modeled at all. The systemic venous value that the drainage saturation is read against is a modeled estimate rather than a device reading. And separating re-drainage from a genuinely high systemic venous saturation at the bedside takes cannula and imaging data this console cannot supply, which is the other reason the move here is to go and look. No share threshold, flow target, or cannula position is taught here; the sources describe the reasoning, not the procedure.',
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
      stem: 'A patient is in the stabilization phase of venovenous support. The arterial carbon dioxide value is 68 mmHg, the pH is 7.18, the bicarbonate is 25 mmol/L, and the work of breathing is high. Circuit blood flow is steady, the gradient across the membrane has not moved, systemic oxygenation is where it has been since cannulation, and the external gas blender is set at 2.0 L/min and delivering it, with the line to the membrane traced and intact. What do you commit to next, and what in this acid-base picture supports it?',
      choices: [
        {
          id: 'act-on-membrane-co2-clearance',
          label:
            'Read this as an acute, uncompensated acidemia, and raise the sweep in a bounded step, re-checking a blood gas after it.',
          plausibility: 'best',
          rationale:
            'A bicarbonate of 25 mmol/L beside a pH of 7.18 says the kidney has not yet defended the pH, so this is an acute rise rather than a tolerated chronic one, and the high work of breathing says the patient is still paying for it during a phase whose whole point is to take that work over. Carbon dioxide crosses the membrane readily, and what limits its removal is the partial-pressure difference for carbon dioxide held between blood and gas across that membrane. Moving more gas through the membrane each minute keeps that difference wide, which is what makes it the lever with both the mechanism and the room to move.',
        },
        {
          id: 'retrace-gas-source-first',
          label:
            'Read the retained carbon dioxide as a sweep-gas supply that has been lost, and trace the source and its connections again before changing any setting.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The model behind this is that a rising carbon dioxide value means the gas path has been interrupted. That instinct is a good one, and it is the right first move when the rise arrives over minutes on an otherwise undisturbed circuit. What refutes it here is that the tracing has already been done and the blender is delivering what it was set to: this is clearance that was never sufficient for the goal, not clearance that disappeared. Repeating an intact inspection leaves an acute acidemia running while it is repeated.',
        },
        {
          id: 'raise-gas-oxygen-fraction',
          label:
            'Read the problem as gas that is not rich enough, and raise the oxygen fraction of the sweep gas.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This treats the gas side as a single setting — make the gas richer and both gases improve. The oxygen fraction sets what is offered on the oxygen side, while carbon dioxide leaves down its own partial-pressure difference, which is held by how much gas moves through the membrane and carries it away. Oxygenation is also not what has moved here: it is where it has been since cannulation, so the side this setting does act on is not the side that is short.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'Read the retained carbon dioxide as under-dosed support, and raise the pump speed so more blood reaches the membrane each minute.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The model behind this is that carbon dioxide clearance follows the dose of blood flow the way oxygen delivery does. Blood flow does carry carbon dioxide to the membrane, but clearance is far more sensitive to the gas side than to the blood side, and in this model blood flow principally acts on the oxygen side. The steady flow and the unmoved pressure gradient across the membrane say the blood path is already doing what it was doing, so asking the pump for more against an intact blood path adds drainage suction and shear without moving the value that is off.',
        },
        {
          id: 'hold-and-tolerate-hypercapnia',
          label:
            'Read this as hypercapnia the patient is being allowed to tolerate on support, hold the sweep where it is, and re-check a blood gas in several hours.',
          plausibility: 'unsafe',
          rationale:
            'This carries a maintenance-phase habit into a stabilization-phase patient: an elevated carbon dioxide value is tolerated when the acid-base picture shows it has been compensated and the patient is comfortable. The bicarbonate of 25 mmol/L refutes that reading — a compensated state carries a bicarbonate well above normal alongside a pH near normal, which the contrasting patient in this station has and this one does not. Holding leaves a pH of 7.18 and a high work of breathing in place while the thing that is short is clearance the circuit can give now.',
        },
      ],
      correctChoiceIds: ['act-on-membrane-co2-clearance'],
      explanation:
        'Two facts have to be read together. The bicarbonate says how long this has been going on: at 25 mmol/L the kidney has not begun to defend the pH, so a pH of 7.18 is an acute drop rather than the settled state of someone who has lived at a high carbon dioxide value for weeks. The clinical phase says what the goal is: during stabilization the circuit exists to take over work the patient is doing badly, and the high work of breathing shows that work is still being paid for. The contrasting patient in this station — a carbon dioxide value of 58 mmHg with a bicarbonate of 34 mmol/L, a pH of 7.39 and low work of breathing — earns a different answer from the same lever, which is why one number never decides. Model boundary: the response returned here is a single bounded educational relationship between the gas setting and an arterial carbon dioxide value, approached at a fixed rate. It carries no dead space, no membrane ageing and no independent contribution from the patient’s own breathing, so the size and speed of what is shown are properties of that relationship rather than predictions for a patient. At the bedside the step is sized with the pH in mind — a large, fast fall in carbon dioxide swings pH and cerebral blood flow, and that risk is greatest in the chronic retainer — and each step is re-checked on a blood gas. The change is also made on the external gas blender rather than on the console touchscreen.',
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
      stem: 'A patient in the maintenance phase of venovenous support has had no setting altered since the previous evening. The morning blood gas shows an arterial carbon dioxide of 58 mmHg, a bicarbonate of 34 mEq/L and a pH of 7.39. The patient is comfortable with a low work of breathing. Circuit blood flow, the post-pump and return-limb pressures, and the gradient across the membrane are all where they have been for hours. The overnight team has asked what should be done about the carbon dioxide. What do you commit to, and which goal does that commitment serve?',
      choices: [
        {
          id: 'preserve-the-compensated-state',
          label:
            'Read the pattern as retention the kidney has already answered, hold the sweep-gas flow where it is, and let a fresh review of pH, bicarbonate, the carbon dioxide trend, symptoms, work of breathing and the phase of the run decide whether anything moves.',
          plausibility: 'best',
          rationale:
            'What carries information here is not that the carbon dioxide is raised but that the pH is normal while it is raised, which happens only once base has been retained to sit alongside it. Acid-base management serves the pH and the patient, and both are where you would want them, so there is no patient problem that removing more carbon dioxide would solve. Holding is an active decision rather than the absence of one: it keeps the compensated state intact and hands the question to the next full review instead of to a single abnormal number.',
        },
        {
          id: 'normalize-the-carbon-dioxide-now',
          label:
            'Raise the sweep-gas flow now to bring the carbon dioxide back toward 40 mmHg, since 58 is plainly abnormal.',
          plausibility: 'unsafe',
          rationale:
            'The model behind this is that an abnormal carbon dioxide is itself the thing being treated. The normal pH refutes it: base has already been retained alongside this carbon dioxide, so clearing the carbon dioxide quickly leaves that base unopposed and drives the pH up and away from the 7.39 it currently holds, which is exactly what the bounded response in this lab will show. Beyond the acid-base overshoot, a carbon dioxide that falls quickly in a patient who has been living at 58 also constricts the cerebral circulation, which is why rapid normalization on extracorporeal support is approached cautiously rather than reflexively.',
        },
        {
          id: 'inspect-the-membrane-first',
          label:
            'Read the raised carbon dioxide as a membrane losing gas transfer, and inspect the circuit and the gas path before committing to anything about support.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Inspecting is never unreasonable, and an oxygenator losing carbon-dioxide transfer is a genuine cause of a raised carbon dioxide. Steady pressures do not exclude it either: those channels report blood-side resistance, and a membrane can lose gas transfer with its resistance and its gradient unchanged. What argues against it is the direction of the pH. A membrane losing clearance drives the carbon dioxide up over minutes to hours, far faster than any renal response, so the pH falls with it. A raised carbon dioxide sitting beside a normal pH and a raised bicarbonate is not the shape an acute gas-path problem makes.',
        },
        {
          id: 'raise-pump-speed-for-clearance',
          label:
            'Raise the pump speed so that more blood reaches the membrane and more carbon dioxide is cleared.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This borrows the control that principally moves oxygen and applies it to carbon dioxide. Carbon-dioxide clearance tracks the gas side far more closely than the blood side, and nothing described here — no oxygenation deficit, no drainage limitation, no re-drainage pattern — argues for more blood flow. The step is not free either: more speed means a more negative drainage pressure and more blood-side trauma, bought for a patient whose pH is already where it should be.',
        },
        {
          id: 'begin-a-separation-trial',
          label:
            'Take the comfortable, compensated blood gas as evidence that the native lungs are ready, and open a separation trial by taking the sweep gas to zero.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads renal compensation as pulmonary recovery. The bicarbonate of 34 is the kidney adapting to a carbon dioxide the membrane is still clearing; it says nothing about how much of that clearance the native lung could take back. Separation in venovenous support is judged deliberately, with circuit blood flow maintained and the patient reviewed in a set order, at a moment chosen for it — not inferred from one comfortable maintenance gas in the middle of a stable run.',
        },
      ],
      correctChoiceIds: ['preserve-the-compensated-state'],
      explanation:
        'The informative finding is not the raised carbon dioxide on its own but the normal pH sitting beside it, which happens only once base has been retained alongside the retained carbon dioxide. The goal is therefore to preserve that compensation: hold sweep — an external gas-blender control, not a CARDIOHELP-i touchscreen control — where it is, and let a fresh look at pH, bicarbonate, the carbon dioxide trend, symptoms, work of breathing and the phase of the run decide whether anything moves. One honest caveat sits inside the numbers: the pH is fully normal rather than a little low, and the bicarbonate is a few mEq above what retention alone would usually be expected to produce, which raises the possibility of a metabolic alkalosis running alongside — from diuresis or chloride loss, for instance. That is a reason to look at the metabolic side, not a reason to strip carbon dioxide out quickly. None of this is a general permission for a raised carbon dioxide: the same patient early in a run, with climbing work of breathing, or with a specific reason to avoid hypercapnia, is reasoned to a different answer by the same steps. Model boundary — this lab moves the carbon dioxide value along a bounded curve set by the sweep flow and by whether gas is reaching the membrane at all, and it holds the bicarbonate fixed, so the pH shown is arithmetic and no renal response can appear in it. Carbon-dioxide production, native ventilation and dead space are not modeled, and blood flow does not move the carbon dioxide here at all, even though at the bedside it contributes something. What the lab shows is a direction, never a bedside prescription.',
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
      stem: 'A patient on stable venovenous support deteriorates over a few minutes. The arterial carbon dioxide value climbs steeply from the mid-40s, the pH follows it down, and arterial oxygen saturation drifts from a saturation of 93 to a saturation of 82. Displayed circuit blood flow sits exactly where it has all shift, the pressures on either side of the membrane and the pressure drop across it are unmoved, and no one has touched the pump speed or the sweep setting since the run was steady. What do you act on first, and what would you expect to find if that reading holds?',
      choices: [
        {
          id: 'follow-the-gas-path',
          label:
            'Follow the sweep-gas path itself — source, blender and the line into the membrane — and re-establish delivery to the oxygenator; expect an entirely undisturbed blood path and a carbon dioxide value that turns as soon as gas is arriving again.',
          rationale:
            'Carbon dioxide clearance depends on a gradient the sweep gas maintains at the membrane, so it collapses within a circuit transit or two when nothing arrives on the gas side, and the membrane begins returning blood it has not oxygenated. No other explanation offered here moves carbon dioxide that fast. The blood path stays silent because every pressure channel the console reports sits in that blood path, which is exactly why circuit flow, the pressures either side of the membrane and the pressure drop across it can all look untouched while gas transfer has stopped.',
          plausibility: 'best',
        },
        {
          id: 'raise-the-sweep',
          label: 'Turn the sweep control up until the carbon dioxide value comes back down.',
          rationale:
            'This holds that a climbing carbon dioxide value always means the sweep is set too low. Nobody has altered the sweep since the run was steady, so the setting is not what changed. A setting also states what is being asked for rather than what is arriving at the membrane, so turning it up on a line delivering nothing moves a number on a panel and nothing in the patient — while the carbon dioxide value goes on climbing.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'raise-the-pump-speed',
          label:
            'Raise the pump speed to bring the saturation back up, since less oxygenated blood is evidently reaching the patient.',
          rationale:
            'The model behind this reads a falling saturation as insufficient circuit support. Displayed flow and every circuit pressure are unchanged, so the blood path is delivering exactly what it delivered while gas exchange was steady; more speed only drives more blood through a membrane that is oxygenating none of it, and pulls harder on drainage to do it. The real harm is time — the console looks attended to while the one explanation that is reversible in a minute goes unlooked-for and the acidemia deepens.',
          plausibility: 'unsafe',
        },
        {
          id: 'work-through-the-circuit',
          label:
            'Work through the blood path first — pressures, pressure drop, visible clot, cannula position — before anything else.',
          rationale:
            'Inspecting the circuit is never unreasonable, and it is where reasoning confined to the blood path leads. But the pressures and the pressure drop across the membrane are given as unmoved, so the blood path has already answered the question put to it. The path the console cannot report on is the one still unexamined, and its interruption is the only thing here that produces this combination in minutes.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'exchange-the-oxygenator',
          label:
            'Call for an oxygenator exchange, since a membrane that has stopped exchanging gas has to be replaced.',
          rationale:
            'This treats lost gas transfer as synonymous with a membrane that has given way. Both leave the membrane returning blood it has not oxygenated, so a falling post-membrane saturation does not separate them; what separates them is that a membrane giving way usually declares itself over hours with a rising pressure drop across it, and that pressure drop has not moved while this change took minutes. An exchange also commits the patient to an interruption of support and fresh air-handling risk for the one component these findings argue against.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['follow-the-gas-path'],
      explanation:
        'Every explanation on this list survives an unchanged flow display, which is why the display is a poor place to reason from. Two features separate them: how fast the change came on, and where the console has nothing to report. Carbon dioxide crosses the membrane on a gradient the sweep gas maintains, so clearance stops almost at once when the supply is absent, while the pump goes on moving blood through an undisturbed circuit and the membrane returns blood it has not oxygenated. Sweep flow and the oxygen fraction of the sweep gas are settings on a supply; neither delivers anything when the supply itself is not arriving, which is why the connection comes before the setpoint. Model boundary: this simulation carries the modeled patient along bounded educational curves — an arterial saturation settling near 82 and a carbon dioxide value climbing toward 90 within roughly half a modeled minute rather than over the few minutes described here — and the gas panel is a schematic stand-in for a source, a blender and a line. Those speeds and endpoints are teaching shapes, not a bedside prediction for any particular patient.',
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
      stem: 'You are at the bedside of a venovenous run at 3200 rpm when the arterial bubble channel raises a high-priority alarm and the pump stops on its own. Air is visible in the circuit, both near-patient clamps are still open, the console is holding the bubble intervention latched, and the arterial saturation has begun to drift down from a saturation of 93 now that there is no forward flow through the membrane lung. What has the automatic pump stop actually achieved, and what has to be true before this circuit carries blood to the patient again?',
      choices: [
        {
          id: 'isolate-then-eliminate-source',
          label:
            'Only that forward flow has ceased. The patient is still continuous with both limbs, so they have to be closed off near the patient, and the place where air is entering the circuit has to be found and eliminated.',
          plausibility: 'best',
          rationale:
            'A centrifugal head is not an occlusive valve. Stopping it removes the forward push and leaves an open column between the circuit air and the patient, which is what the near-patient clamps close. Nothing available at the console can remove air or stop it entering, so the work belongs at the tubing, the connections and any line being handled, while the patient is carried on conventional ventilation and hemodynamic support. Reopening the limbs and releasing the latched intervention both wait on the entry site being eliminated and the circuit being confirmed clear.',
        },
        {
          id: 'reset-to-restore-flow',
          label:
            'It has bought a pause, and the pause is now costing gas exchange. The saturation is falling with no extracorporeal support, so acknowledge the alarm and reset the bubble intervention to get the pump turning again.',
          plausibility: 'unsafe',
          rationale:
            'This treats the alarm as the emergency and the stopped pump as the harm. Two findings refute it: air is still in the circuit, and both limbs are still open to the patient, so the first revolutions after a reset would drive that air toward the return cannula. A saturation falling because circuit flow has stopped is answered with conventional ventilation and hemodynamic support while the circuit is isolated and cleared, not by restarting a circuit that still holds air.',
        },
        {
          id: 'stopped-pump-already-isolates',
          label:
            'It has already separated the patient from the circuit. Nothing needs to happen at the clamps, so the air can be dealt with directly and the circuit resumed once it is clear.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The model behind this is that air moves only when the pump moves it. A centrifugal head is not occlusive: with it stopped, both limbs stay hydraulically continuous with the patient, and gravity, cannula and patient position, spontaneous respiratory effort and any handling of the tubing can still move an air column. Both clamps being open is the finding that refutes it, because that open path to the patient is exactly what isolation removes.',
        },
        {
          id: 'size-the-air-first',
          label:
            'The amount of air has to be established first, because how much is in the circuit is what decides how urgent the isolation and the de-airing are.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Judging how much air is present is real bedside reasoning and a clinician will do it. What makes it a poor place to start is that it changes nothing about what has to happen: whatever the volume, the limbs are open and the entry site is unaddressed, and estimating while both remain true spends the interval in which isolation is still cheap. This exercise also carries no air-volume cut value, deliberately, so there is no threshold here for an estimate to be weighed against.',
        },
        {
          id: 'blame-the-membrane',
          label:
            'The membrane lung has to come out. Air appearing on the return side identifies it as the source, so arrange an oxygenator exchange.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A membrane lung genuinely can be a source of circuit air, so the suspicion is not unreasonable — but the detector reports where air was found, not where it entered. Air is drawn in wherever circuit pressure sits below atmospheric, which is the drainage limb, its connections and any line being handled near the patient, and it is then carried forward past the membrane; a return-side detection is where air of almost any origin would announce itself. Committing to an exchange before the entry site is located leaves the actual source in place and adds a fresh set of connections to it.',
        },
      ],
      correctChoiceIds: ['isolate-then-eliminate-source'],
      explanation:
        'The device intervention and the isolation are two different acts. Stopping the pump removes the forward push; only the near-patient clamps separate the patient from an air column, and only finding where air is entering keeps it from returning as soon as flow does. That ordering is why the reset is a deliberate last step rather than a response to the alarm, and why the patient is carried conventionally in the meantime. Two boundaries belong with this. The exercise injects an air event with no volume assigned to it and no threshold behind it, because the manufacturer document supplied for this module is internally inconsistent on a bubble-size threshold; it therefore teaches a sequence rather than a rule about how much air matters. And the order taught here — return limb then drainage limb to isolate, drainage limb then return limb to resume — is one bounded sequence chosen for consistency. Local protocol governs at the bedside, and this simplified model does not represent the physical work of de-airing a real circuit.',
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
      stem: "During an interfacility transport on venovenous support, the vehicle's supply to the console drops out. The power-source indicator changes over to internal battery on its own, the transport screen shows a battery reserve reading of 24 and falling steadily, and the console is showing a low-priority power message rather than an insistent alarm. Circuit blood flow, the circuit pressures and the patient's oxygenation are all unchanged from the readings taken before the supply dropped out, and the receiving unit is still some distance away. What does this moment call for?",
      choices: [
        {
          id: 'secure-verified-supply-now',
          label:
            'Act on the power supply now, while blood flow is uninterrupted: connect a verified alternate source, confirm flow and the patient, and keep the backup console and emergency drive to hand.',
          rationale:
            'The changeover to battery is the one thing that has actually changed, and it buys an interval rather than settling anything. Securing a verified source while the circuit is still running is what keeps support continuous, and naming the backup console and the emergency drive keeps a fallback ready in case the interval runs out before a source is found.',
          plausibility: 'best',
        },
        {
          id: 'watch-until-the-reserve-is-low',
          label:
            'Keep watching the console and the patient as the transport continues, and act on the power situation once the reserve indicator gets low.',
          rationale:
            'Watching is not misplaced, and nothing in the circuit has moved yet. The model underneath waiting is that the displayed reserve is a clock with a threshold to act at, but it reports remaining charge rather than minutes, and how long that charge lasts depends on the load the console is carrying and on the age of the battery. The reserve is already falling and the power message only becomes more insistent as it falls further, so waiting for the display to escalate spends the very interval the decision depends on.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'lower-speed-to-stretch-the-battery',
          label: 'Lower the pump speed so that the remaining battery reserve lasts longer.',
          rationale:
            'This treats circuit support as the expendable term and console run time as the one worth protecting. It gives away patient support for a power problem that has not touched the circuit — flow, pressures and oxygenation are all stated to be unchanged — and it leaves the missing supply exactly where it was, so the reserve still runs down in the end.',
          plausibility: 'unsafe',
        },
        {
          id: 'change-to-emergency-drive-now',
          label:
            'Change over to the emergency drive straight away, on the basis that the console is about to stop.',
          rationale:
            'The mental model here reads a battery indicator and an imminent pump stop as the same event. The console is running normally on battery with unchanged flow, and no alternate source has been looked for yet, so this interrupts support in a moving vehicle before the simpler remedy has been tried. At this point the emergency drive belongs in the readiness plan rather than in the hands.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['secure-verified-supply-now'],
      explanation:
        'Losing the external supply during transport changes one thing and leaves the rest alone: where the console is drawing power from. The automatic changeover to battery is a bridge rather than a remedy — it opens an interval whose true length is not on the screen, because run time depends on the load the console is carrying and on the condition of the battery. Everything the circuit displays stays reassuring throughout that interval, and on a real console it stays reassuring right up to the moment the reserve is gone, which is why this decision is taken from the power source rather than from the flow number, and why the fallback is named out loud before it is needed. Model boundary: this drill drains the reserve at a fixed simulated rate whatever the pump is doing, and it does not simulate what an exhausted battery would do to the pump — so the falling reading is not a run-time prediction and must not be read as minutes remaining. The drill exercises recognition and readiness only: naming the backup console and the emergency drive is not the same as being trained to drive a pump by hand, which is learned at the device itself.',
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
      stem: 'A peripheral venoarterial circuit is primed and connected: a femoral venous drainage cannula, the same pump and oxygenator hardware you have just toured, and a femoral arterial return cannula. The pump is stopped, the startup diagnostic has not been allowed to run through, and the ordered speed and sweep are written on the chart. The bedside monitor is showing a single pulse oximetry probe on the left hand, there is no arterial line yet, and the pulse pressure recorded before this circuit was connected was 18 mmHg. The console in front of you is the identical unit used for the venovenous circuits on this ward. What do you commit to before support is established?',
      choices: [
        {
          id: 'verify-as-a-va-circuit',
          label:
            'Work the pre-use sequence on this circuit as a peripheral venoarterial circuit specifically: let the startup diagnostic run through, walk drainage to return by hand confirming which vessel each limb actually enters and which pressure line sits where, verify gas, power and an immediately available backup — and put the independent monitoring in place first, meaning right-arm oximetry, an arterial line, and a way of watching the native heart and the cannulated leg.',
          plausibility: 'best',
          rationale:
            'The hardware is shared with the venovenous circuits but the consequences are not, and both halves of that follow from the same fact: the console cannot tell you which vessel the return limb enters. It reads the same circuit pressure either way. So the hand-walk is what establishes the configuration, and the independent monitoring is what makes the configuration’s two signature problems visible — mixed circulation in the upper body, and perfusion of the leg the arterial cannula sits in. Both begin the moment the pump does, so both have to be watchable before it starts.',
        },
        {
          id: 'same-check-then-add-monitoring',
          label:
            'Run the same startup sequence used on the venovenous circuits — diagnostic, walk from cannula to cannula, gas, power and backup — then add right-arm oximetry, the arterial line and a look at the heart once the patient is on support and settled.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The circuit walk is right and it is the larger half of the work; nothing in it is wasted. What is deferred is the half that is specific to peripheral venoarterial support. Retrograde flow up the aorta begins meeting native ejection the instant the pump starts, and where the two meet moves with both. Right-arm oximetry, an arterial line and a view of the native heart are what make that visible, and adding them afterwards means the minutes in which the mixing point moves most are the minutes nothing is watching it. The cannulated leg has the same problem: distal perfusion is easiest to judge against a baseline taken before the arterial cannula started carrying full flow.',
        },
        {
          id: 'shared-hardware-start-now',
          label:
            'This is the same hardware and the same console as a venovenous circuit and it is reporting no fault, so bring the pump up to the ordered speed and sort the monitoring out once support is running.',
          plausibility: 'unsafe',
          rationale:
            'Identical hardware with a different consequence is exactly why this cannot be reasoned from the console. A return limb connected to a vessel it was never meant to enter, or an arterial cannula that is not where it is believed to be, produces no distinguishing reading: pArt is a pressure measured inside the disposable and it rises against a vein or an artery alike. Starting first also commits the patient to mixed circulation with nothing in place to detect it — with the only oximetry probe on the left hand there is no upper-body signal to compare, and no baseline for the cannulated leg to be judged against later.',
        },
        {
          id: 'part-is-the-arterial-pressure',
          label:
            'With the return limb in the femoral artery, the post-oxygenator pressure the console already reports is the patient’s arterial pressure — so read it as the arterial line, confirm it is adequate, and start support.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This is refuted by where the sensor sits rather than by anything clinical. pArt is measured inside the disposable, after the membrane and before the cannula, so what it reports is the pressure the pump is generating against everything downstream of it at once — the remaining tubing, the cannula, and the patient’s circulation together. It rises when the return limb kinks and it rises when the patient’s vascular tone rises, and nothing in the number separates the two. A patient arterial line measures the patient, and on peripheral venoarterial support where it is sited also decides which circulation it is reporting on.',
        },
        {
          id: 'distal-perfusion-plan-first',
          label:
            'Limb ischaemia is the complication peripheral venoarterial support is known for, so settle the distal perfusion plan for the cannulated leg before anything else on the circuit is revisited.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Ischaemia of the cannulated limb is a real and characteristic problem, and having the plan settled before it is needed is good practice rather than an error. It is incomplete as the commitment here because it promotes one item on the list above the item the whole sequence depends on. The circuit still has to be shown to run the way it is believed to run, the pressure lines still have to be on the limbs they are labelled for, and the gas, power and backup still have to be verified by hand. A distal perfusion plan does nothing about a return limb that is not in the vessel it is believed to be in.',
        },
      ],
      correctChoiceIds: ['verify-as-a-va-circuit'],
      explanation:
        'The console is the same on both configurations, and that is the whole difficulty: nothing it displays distinguishes a venovenous circuit from a peripheral venoarterial one, because every channel it carries is a circuit measurement. Which vessel each limb enters is established by hand, before support. What the configuration then produces — retrograde arterial flow meeting native ejection somewhere in the aorta, and a leg whose supply now runs past a cannula — is visible only through data the console does not hold: right-arm oximetry against a lower-body site, an arterial line, a view of the native heart, and the leg itself. Putting those in place before the pump starts is what makes the first minutes of support readable rather than reconstructed afterwards. Model boundary: this is a bounded educational simulation rather than a patient twin. It reports right-arm and femoral values directly and resolves the pre-use walk to a single check, where the bedside would involve echocardiography, imaging of cannula position, serial limb examination and a full pre-use list. No target value for pulse pressure, right-arm oxygenation or distal perfusion is taught here; those depend on the patient, the cannulae and the local protocol.',
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
      stem: 'A peripheral venoarterial run is in its stabilization phase and the pump is turning at 3600 rpm. Circuit blood flow, steady near 4.5 L/min at this speed through the morning, is now swinging between about 2.8 and 3.2 L/min from one moment to the next; the drainage pressure has become progressively more negative and reads about -82 mmHg; and the drainage line is chattering against its holder. Both post-pump pressures have drifted down with the flow rather than climbing, and the gradient across the membrane has narrowed with it; the post-membrane blood gas drawn at handover was fully saturated. The mean arterial pressure is 62 mmHg, and the arterial trace still shows native ejection with a pulse pressure of about 18 mmHg, unchanged since handover. What does this pattern call for as the first move?',
      choices: [
        {
          id: 'ease-pump-demand-then-examine',
          label:
            'Ease the demand the pump is placing on the drainage limb, then work out what is limiting venous return.',
          plausibility: 'best',
          rationale:
            'A centrifugal pump cannot manufacture venous return; it can only pull harder on what is offered it. Pulling harder on a vein that is already collapsing onto the drainage ports is what produces the swing in flow and the chatter, so relieving the suction is what steadies the circuit. It is a holding move: cannula position and depth, tubing, venous filling and intrathoracic causes still have to be worked through, the limitation removed, and support retitrated against perfusion and native-heart endpoints under local protocol.',
        },
        {
          id: 'raise-speed-to-recover-flow',
          label:
            'Ask the pump for more speed until the displayed flow climbs back toward where it ran this morning.',
          plausibility: 'unsafe',
          rationale:
            'This treats the displayed flow as the thing that has gone astray and the pump as the way to retrieve it. The drainage pressure refutes it: already deeply negative, it falls further with every increment of speed, drawing the vein harder onto the drainage ports and repeating the suction events, so effective systemic support falls while the display is chased. Reflexive speed escalation against a low displayed flow is the reflex this drill exists to interrupt.',
        },
        {
          id: 'volume-first-for-presumed-hypovolemia',
          label:
            'Read the drainage pressure as underfilling, give volume straight away, and leave the pump speed where it is.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Hypovolemia is a genuine cause of this picture and volume may well end up being part of the answer, but the model behind this choice is that a deeply negative drainage pressure names its own cause. It does not: cannula position and depth, a kink, coughing or straining, tamponade and rising intrathoracic pressure all read the same way on this channel. Nothing offered so far separates them, and volume aimed at a cause that is not the one present leaves the suction running meanwhile.',
        },
        {
          id: 'localize-downstream-resistance',
          label:
            'Read the falling flow as resistance beyond the pump, and inspect the membrane and the arterial return path first.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This applies the afterload pattern to a drainage picture. Resistance downstream of the pump raises the post-pump pressures — both together when the return limb is the problem, with a widening gradient when the membrane is. Here both post-pump pressures have fallen with the flow, the gradient has narrowed rather than widened, and the only pressure moving against the flow sits upstream of the pump.',
        },
        {
          id: 'assess-lv-loading-first',
          label:
            'Read this as retrograde arterial flow loading the left heart, and assess the left ventricle before touching the pump.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Left-heart loading is a genuine hazard of peripheral retrograde support, but it announces itself through pulsatility narrowing toward nothing, an aortic valve that stops opening, and pulmonary congestion — not through a drainage pressure that keeps falling and a line that chatters. The pulse pressure here is unchanged and the trace still shows native ejection, so the finding that would raise the concern is the one that is absent.',
        },
      ],
      correctChoiceIds: ['ease-pump-demand-then-examine'],
      explanation:
        'Flow that will not sit still, a drainage pressure that keeps falling, and a chattering line are one pattern rather than three findings: the vein and the drainage ports are being asked for more blood than they can offer, and each brief occlusion is what the swing and the chatter are made of. Both post-pump pressures falling with the flow, and a membrane gradient that narrowed with it rather than widening, place the limit upstream of the pump rather than downstream of it. Easing demand buys a steadier circuit; it treats nothing, and what support is finally retitrated against is perfusion and the native heart rather than a flow display. No drainage-pressure cut point is published here; about -82 mmHg matters as a trend on this circuit rather than as a threshold. Where this drill simplifies: it offers a single step that removes whatever was limiting drainage, so hypovolemia, a malpositioned or kinked cannula, straining, and rising intrathoracic pressure collapse into one action. At the bedside each is a different problem with a different treatment, and naming which one is present is the work this drill leaves to you. The modelled flow here also still creeps upward when the pump is asked for more, far more gently than the drainage pressure falls; a vein that is genuinely collapsing often gives no flow gain at all.',
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
      stem: 'You are called to a peripheral venoarterial run. The pump speed has not been touched and still reads 3200 rpm. Over the past several minutes circuit blood flow has fallen from about 4.0 to about 2.8 L/min. pInt, measured after the pump and before the membrane lung, has risen from about 242 to about 335 mmHg, and pArt, measured after the membrane on the return limb, has risen from about 211 to about 313 mmHg. The gradient between them now reads about 22 mmHg, where it read about 31 mmHg at the earlier flow, and no pressure alarm limit on this console has been reached. The patient’s own arterial line has not risen with the circuit pressures — it reads a mean pressure near 70 with a pulsatile trace — the right radial saturation is in the mid-90s, a norepinephrine infusion has been unchanged since morning, and the cannulated limb looks as it did earlier. Which next step do you commit to, and on what reasoning?',
      choices: [
        {
          id: 'localize-beyond-membrane',
          label:
            'Before any setting is moved, work along the blood path beyond the membrane — return tubing, connectors, clamps, cannula position, sensor plausibility, and the load the patient’s own circulation offers.',
          plausibility: 'best',
          rationale:
            'A resistance raises the pressure in every zone upstream of it, which is why both post-pump zones climbed together. The gradient is what places it: a gradient is a resistance multiplied by a flow, and this one fell about as much as flow did, which is what an unchanged membrane resistance does. The added resistance therefore sits beyond the membrane, on the return path. That names a zone rather than a cause, and the zone holds tubing, connectors, a partly closed clamp, cannula position, an implausible sensor, and the patient’s own arterial load — which is why the path is walked before a control is moved.',
        },
        {
          id: 'raise-speed-to-recover-flow',
          label: 'Raise the pump speed until circuit blood flow comes back toward 4 L/min.',
          plausibility: 'unsafe',
          rationale:
            'This treats the displayed flow as the problem and the speed control as its answer. The pressures refute it: flow fell while both post-pump pressures climbed, which is a pump already turning against a load it cannot overcome. More speed drives more pressure into an obstructed path, buys little flow, leaves the resistance where it is, and adds hemolysis and the risk of circuit or cannula disruption to the situation.',
        },
        {
          id: 'call-it-a-membrane-problem',
          label: 'Read this as a clotting membrane lung and arrange a circuit exchange.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The mental model is that a high post-pump pressure means the membrane. A membrane that had become the resistance separates the two zones: pInt climbs away from pArt and the gradient widens even while flow is falling. Here the gradient fell roughly in step with flow, so the membrane is the one part of the path this pattern argues against. Saturations would not settle it either way — a membrane can be laying down clot before its gas transfer changes — which is why the gradient, read against this circuit’s own earlier value, is the finding that discriminates.',
        },
        {
          id: 'treat-circuit-pressure-as-the-patients',
          label:
            'Take the return-limb reading of 313 as the patient’s arterial pressure, call it dangerous hypertension, and wean the norepinephrine to bring it down.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads a circuit pressure as a patient pressure. pArt sits inside the return tubing and reports what the circuit is pushing against on its way out; the patient’s pressure comes from the independent arterial line, which reads near 70 and did not climb when the circuit pressures did. They are different measurands rather than two readings of one pressure. Weaning vasoactive support to lower a number that was never the patient’s leaves the resistance untouched and removes support this patient may still need.',
        },
        {
          id: 'reposition-the-return-cannula',
          label: 'Commit now to a malpositioned arterial cannula and have it repositioned.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The zone is right and cannula position is a genuine member of the return-side list, which is what makes this the tempting one. It is incomplete because it moves from a zone to a single cause without the walk that separates them: a kinked limb, a partly closed clamp, a connector, a sensor reading implausibly, and the patient’s own arterial load all produce this same console pattern, and moving a cannula that was sitting properly is not a neutral act.',
        },
      ],
      correctChoiceIds: ['localize-beyond-membrane'],
      explanation:
        'Two post-pump zones rising together put the added resistance downstream of both, because an obstruction raises the pressure in everything upstream of it. The gradient is what keeps the membrane out of it. A gradient is a resistance multiplied by a flow, so it falls when flow falls, and it is interpretable only against this circuit’s own earlier value at a comparable flow; here it fell about as much as flow did, where a membrane that had become the resistance would have widened it instead. What the reasoning buys is a zone, not a diagnosis: tubing, a connector, a partly closed clamp, cannula position, an implausible sensor and the patient’s own arterial load all sit inside it, and no single console value separates them. The second half of the reading is where pArt is measured. It is a pressure inside the return tubing, reporting what the circuit pushes against on its way out, while the patient’s arterial pressure comes from an independent monitor and reads near 70 here — different measurands, not two readings of one pressure. Model boundary: this simulation carries one authored return-side resistance that clears once its cause is dealt with, its flow and pressure responses are bounded teaching curves, and the patient’s pressure here tracks circuit flow with no vasoactive drug modeled. A real return path can hold more than one contributing cause at once, patient afterload can be part of the picture, and none of these numbers belong at a bedside circuit.',
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
      stem: 'You take over a patient on peripheral venoarterial support whose speed setting has not been altered since this morning, and neither has the sweep gas. Against the values documented then, pInt — the pressure between the pump outlet and the membrane lung — has risen from about 240 to about 330 mmHg, while pArt on the return limb has moved the other way, from about 210 to about 190. The gradient between them was about 30 mmHg and is now about 140. Circuit blood flow at that same speed has fallen from about 4.0 to about 3.1 L/min. A blood gas drawn from the post-membrane port shows a saturation of 88, where it was a saturation of 99 this morning. Right radial and femoral arterial saturations are where they were, the mean arterial pressure has drifted down about 5 mmHg, and no circuit pressure alarm has annunciated. Which next move does this pattern call for?',
      choices: [
        {
          id: 'locate-the-resistance-first',
          label:
            'Establish where the resistance sits before any support setting is changed, reading the two post-pump pressures and the gradient against each other at matched flow and speed, alongside sensor plausibility and gas transfer.',
          plausibility: 'best',
          rationale:
            'A gradient that has widened while the return-limb pressure moved down places the resistance in the membrane itself rather than beyond it, and a post-membrane saturation that has dropped fits the same component behaving the same way. What none of that settles on its own is whether the pressure channels are reporting plausibly, or whether the comparison was made at like flow and speed — a gradient is a resistance multiplied by whatever flow it is read at, so a slower circuit and a fouled membrane pull the number in opposite directions. Localizing the resistance is also what an escalation under the reviewed local exchange protocol rests on, which is why it comes before the support setting is touched.',
        },
        {
          id: 'raise-speed-to-restore-flow',
          label:
            'Raise the pump speed until the displayed circuit flow returns to this morning’s value, on the reasoning that support has fallen short.',
          plausibility: 'unsafe',
          rationale:
            'The model behind this reads a falling flow as a shortfall of pump output. It is instead what the pump is already doing against a resistance, and the widened gradient beside a return-limb pressure that has not risen is the finding that says so. Driving more blood through the component that is the resistance raises pInt further, adds shear across a restricted membrane, and leaves the cause untouched. On peripheral venoarterial support it also raises the pressure the left ventricle has to eject against, so left-heart loading can be deepened while nothing about the membrane has been addressed.',
        },
        {
          id: 'act-on-the-return-limb',
          label:
            'Take this as an obstruction beyond the membrane and act on the return limb — free the tubing, check the connectors, reposition the arterial cannula — since flow has fallen while a post-pump pressure has risen.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This is the neighbouring pattern, and the model behind it is that any post-pump pressure rise sits downstream of the membrane. Resistance there raises pArt and pInt together and leaves the gradient across the membrane tracking flow as it always did. Here pArt has moved down while the gradient has more than quadrupled, and that pair is what separates the two situations. A second problem on the return limb is never excluded by reasoning alone, but nothing in this pattern argues for one, and acting on the limb ahead of locating the resistance treats a site that has not been implicated.',
        },
        {
          id: 'exchange-the-membrane-now',
          label:
            'Arrange a membrane-lung exchange straight away, on the reasoning that a gradient of this size is by itself enough to declare the membrane spent.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'An exchange may well be where this reasoning ends, so the instinct is close. The model behind it is that a gradient has a value above which a membrane is finished. This module encodes no such value: the number is a resistance multiplied by the flow it is read at, it differs between oxygenators, and it depends on the channel reporting properly — and the supplied device labeling is itself internally inconsistent about pressure-drop alarm priority. Reading the gradient at matched flow and speed, beside gas transfer and sensor plausibility, is what turns this into an escalation under the reviewed local protocol rather than a single number acted on.',
        },
        {
          id: 'raise-sweep-oxygen-fraction',
          label:
            'Raise the oxygen fraction of the sweep gas, since the blood leaving the membrane is no longer fully saturated.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The falling post-membrane saturation is real, and the model behind this choice reads it as too little oxygen being offered to the membrane. The gas path carries no blood-side pressure at all, so nothing done there widens the gradient between pInt and pArt or constrains flow at an unaltered speed. Those two findings are what refute a gas-side explanation: one component has become harder to push blood through and is transferring less oxygen at the same time.',
        },
      ],
      correctChoiceIds: ['locate-the-resistance-first'],
      explanation:
        'Two post-pump pressures and the gradient between them are what localize a resistance: risen together indicates something beyond the membrane, separated indicates the membrane itself. Here they separated, flow fell at an unaltered speed, and the post-membrane saturation drifted down — one component reporting three ways. None of it tripped a console pressure limit, and no threshold arrives with any of it: this module publishes no gradient value at which a membrane is declared finished, both because the number is a resistance multiplied by whatever flow it happens to be read at and because the supplied device labeling is internally inconsistent on pressure-drop alarm priority. Model boundary: the whole pattern comes from a single fault flag that raises the membrane-resistance coefficient, cuts flow at the set speed, rewrites the return-limb pressure and pins the post-membrane saturation at a fixed value — so it is fully present the moment the drill opens rather than evolving in front of you, and that saturation will not move if the sweep oxygen fraction is changed. The systemic saturations are likewise held steady by the model rather than by anything established about the patient. A real membrane usually declares itself over hours to days alongside findings this model does not produce: clot visible in the fibre bundle, a falling platelet count, hemolysis, a widening carbon dioxide difference across the membrane. And pArt is a circuit pressure on the return limb; it is not the patient’s arterial line or mean arterial pressure.',
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
      stem: 'A patient on peripheral femoral venoarterial support has a right-hand pulse oximeter reading a saturation of 82 on the bedside monitor. A sample drawn from the femoral arterial line reads a saturation of 99, and the blood leaving the membrane reads a saturation of 99. The arterial trace is pulsatile with a pulse pressure of 22 mmHg, echocardiography shows the aortic valve opening, and native output is estimated at 2.8 L/min. Circuit flow, both membrane pressures and the gradient across the membrane are where they have been all shift. A colleague notes that the two saturations of 99 are reassuring and asks whether the right-hand number can be set aside. What does this combination of findings call for next?',
      choices: [
        {
          id: 'verify-upper-body-and-read-both-circulations',
          label:
            'Confirm the upper-body value with a right radial blood gas and read it against native ejection, the native lungs and the circuit data before a circuit setting is changed.',
          plausibility: 'best',
          rationale:
            'An upper-body saturation and a lower-body one are not two attempts at the same number. Retrograde circuit blood and antegrade native blood meet somewhere along the aorta, and the right hand reports what the brachiocephalic vessels are carrying. A native output near 2.8 L/min with a pulse pressure of 22 mmHg and an opening aortic valve says the native stream is real, so the femoral value describes the circulation nearest the return cannula and the post-membrane value describes the circuit alone; neither settles what the brain and the coronary arteries are receiving. Confirming the upper-body reading and then reading the heart, the native lungs, the circuit and the likely mixing region together is what names the mechanism, and it is the picture the ECMO team needs before the support or cannulation strategy is revised under the reviewed local protocol.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'Raise pump speed now — a systemic saturation of 82 means the patient is under-supported and needs more circuit flow.',
          plausibility: 'unsafe',
          rationale:
            'The model here is that a low saturation means a shortage of circuit flow. Raising retrograde flow does move the meeting place of the two circulations more proximally, toward the aortic root, and can lift the right-hand value for a time, which is what makes the reflex convincing. It also raises what the left ventricle must eject against, and this ventricle is ejecting — a pulse pressure of 22 mmHg with an opening aortic valve — so native ejection can be suppressed and the left heart and lungs loaded, while the poorly oxygenated native stream reaching the upper body is untouched. Acting before the mechanism is named also leaves a rising flow and pressure display to be read as though the upper body had been settled.',
        },
        {
          id: 'recheck-sensors-and-hold',
          label:
            'The three values cannot all be trustworthy — recheck the oximeter probe and the circuit sensors, and hold the current settings until the readings agree with each other.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Verifying a reading is never unreasonable, and this is the option worth taking seriously. What does not hold is the model underneath it — that a value disagreeing with two others must be defective. Disagreement between an upper-body and a lower-body arterial site is the expected finding when two circulations run in parallel, and the femoral and post-membrane values agree with each other because both sit downstream of the membrane, not because they are the truthful ones. Nothing in the circuit data suggests a sensor problem, so the reading to confirm is the upper-body one, at the patient, and holding the current settings while cerebral and coronary blood may be arriving poorly oxygenated spends time this finding does not allow.',
        },
        {
          id: 'raise-sweep-gas-fio2',
          label:
            'Raise the oxygen fraction of the sweep gas, so that the blood the circuit returns to the patient carries more oxygen to the upper body.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This treats the hypoxemia as a membrane-output problem. The blood leaving the membrane already reads a saturation of 99, so a higher sweep-gas oxygen fraction has almost nothing left to add, and the poorly oxygenated blood arriving at the right hand never travelled through the membrane at all — it came from the native lungs by way of the ejecting ventricle.',
        },
        {
          id: 'vasopressor-for-upper-body',
          label:
            'Start or increase a vasopressor to raise mean arterial pressure and drive better oxygen delivery to the head and the coronary arteries.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The model is that poor upper-body oxygenation reflects inadequate perfusion pressure. Pressure is not what is missing here: the upper body is being perfused, by a stream whose oxygen content is low. Raising vascular tone changes neither the oxygen content of that stream nor the native lung that loaded it, while adding to the load that both the ventricle and the pump are already working against.',
        },
      ],
      correctChoiceIds: ['verify-upper-body-and-read-both-circulations'],
      explanation:
        'Two arterial oxygenation readings taken from different parts of one patient are not one number measured twice; in femoral venoarterial support they report two circulations, and the site nearest the return cannula is the least able to say what the brain is receiving. Everything the console shows here is behaving. Everything that discriminates lives at the patient — where the reading was taken, whether the ventricle is ejecting, what the native lungs are doing to the blood it ejects, and where along the aorta the two streams meet. That is why the first commitment establishes the pattern rather than moving a setting, and why a reassuring femoral or post-membrane value is the most misleading number on this display. Model boundary: this lab reproduces the upper-body oxygenation cue with a bounded educational response curve. It does not model ventilator settings, cannulation options or cerebral oximetry, so the native-lung and configuration answers a real team would weigh here sit outside what can be committed to here. The modeled response stands for verification and escalation through the reviewed local protocol, not for a bedside maneuver that resolves differential oxygenation on its own.',
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
      stem: 'A patient in the maintenance phase of peripheral venoarterial support becomes harder to manage. The console shows circuit blood flow steady at about 4.0 L/min at the unchanged set speed. The arterial line reads a mean pressure of 70 mmHg, but the trace under it is nearly flat, with a pulse pressure of about 5 mmHg. Echocardiography reports that the aortic valve is barely seen to open and estimates the native output at 0.8 L/min. The chest is markedly congested and the work of breathing is high. What next step does this combination support, and what are you acting to achieve?',
      choices: [
        {
          id: 'characterize-lv-loading-and-escalate',
          label:
            'Treat the steady flow and the mean pressure of 70 mmHg as silent about native ejection, characterize the loading pattern at the patient, and escalate urgently for expert unloading evaluation.',
          plausibility: 'best',
          rationale:
            'Retrograde arterial return raises what the left ventricle must eject against while drainage lowers what reaches it, so an acceptable displayed flow and an acceptable mean pressure can sit on top of a ventricle that is barely emptying. What establishes that lies elsewhere: a pulse pressure of 5 mmHg, an aortic valve barely seen to open, a native output of 0.8 L/min, left ventricular size and stasis on the images, a markedly congested chest, and the systemic perfusion. Every one of them is found at the patient rather than on the console. Gathering them as one pattern, rather than acting on whichever was noticed first, is what makes the escalation specific enough for the team to act on, and this draft goes no further than escalation.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'Raise pump speed for more circuit flow, since the native heart is contributing almost nothing and this patient plainly needs more circulatory support than it is getting.',
          plausibility: 'unsafe',
          rationale:
            'This reads a native output of 0.8 L/min as a reason to substitute more retrograde flow for a ventricle that has nearly stopped working, treating circuit flow as the only circulation that matters. The nearly flat trace and the valve that barely opens refute it: the ventricle is already losing the contest against the arterial pressure the circuit is generating, and more circuit flow raises exactly that pressure. In the sources cited here and in this bounded model, added retrograde flow deepens distension, pulmonary congestion and stasis rather than relieving them.',
        },
        {
          id: 'compare-arterial-sites',
          label:
            'Read this as the mixing point having moved, and compare a right-arm with a lower-body arterial saturation to find an upper body being supplied by native blood.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This borrows the mechanism from the differential-oxygenation pattern, in which two circulations compete and the two arterial sampling sites separate from each other. That pattern needs a ventricle ejecting a substantial competing anterograde stream; here the native output is 0.8 L/min with a pulse pressure of 5 mmHg and a valve barely seen to open, so there is very little second stream to meet the returning blood. A markedly congested chest is not part of the mixing mechanism either, since a mixing point that has moved does not fill the lungs.',
        },
        {
          id: 'hunt-circuit-resistance',
          label:
            'Look first at the circuit pressures and the gradient across the membrane, since something on the return side must have raised the load the ventricle is working against.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This places the added load inside the tubing. What the left ventricle ejects against is the arterial pressure in the aorta, which this circuit is generating on purpose. Resistance rising inside the circuit announces itself in the circuit’s own signals instead: flow falls away from the set speed, with the two post-pump pressures rising together and the gradient across the membrane little changed when the obstruction sits beyond the membrane, or with that gradient widening when the oxygenator itself is the site. Flow here is steady at the set speed, so neither pattern is present, and the findings that discriminate sit at the patient.',
        },
        {
          id: 'escalate-on-the-trace-alone',
          label:
            'Call for a definitive unloading intervention now on the flat arterial trace alone, and leave the rest of the picture for the team to work out when they arrive.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The urgency and the direction of the concern are both right, and holding an escalation back to finish a tidy write-up would be worse. What is thin is the description handed over: a narrow pulse pressure on its own also follows from a damped arterial line, from low native output of any cause, and from obstructive physiology such as tamponade or a tension pneumothorax, and the findings that separate those from loading take one round of looking. This draft also names no unloading device and no threshold, so what transfers to the team is the pattern rather than a chosen intervention.',
        },
      ],
      correctChoiceIds: ['characterize-lv-loading-and-escalate'],
      explanation:
        'Circuit flow and an arterial mean pressure are two reassuring numbers a venoarterial circuit can produce largely on its own, and neither establishes that the left ventricle is emptying. The return raises the load the ventricle ejects against while drainage reduces what fills it, so loading declares itself in pulsatility, in whether the valve opens, in left ventricular size and stasis, in the lungs and in the perfusion, none of which the console reports. Model boundary: this bounded educational model lets pulsatility and aortic-valve opening recover once the escalation is recorded, which is a teaching cue rather than a claim about how a real patient responds, and it stops short of naming any unloading device, threshold or patient-specific algorithm.',
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
      stem: 'Early in the stabilization phase of peripheral venoarterial support, a right radial blood gas returns a PaCO2 of 68, a bicarbonate of 25, a pH of 7.18, and a saturation of 93. The mean arterial pressure is 72, the lactate is 1.8, the pulse pressure is 18, the aortic valve is opening, and pulmonary congestion is mild. The patient is breathing 32 times a minute with high work of breathing. Circuit blood flow has been steady, and the gas reaching the membrane is running at 2 L/min. Which first move acts on the derangement this blood gas describes?',
      choices: [
        {
          id: 'increase-sweep-gas-flow',
          label:
            'Increase the external sweep-gas flow through the membrane, leaving pump speed and sweep-gas oxygen fraction where they are.',
          plausibility: 'best',
          rationale:
            'Carbon dioxide crosses the membrane readily, so what limits its removal is the gradient the flowing gas holds on the far side of it. A bicarbonate of 25 alongside a PaCO2 of 68 dates this as acute rather than compensated, so there is a named acid-base goal to act on, and the gas-side flow is the one setting in this description that is sitting low.',
        },
        {
          id: 'raise-pump-speed',
          label:
            'Raise pump speed so that more blood moves through the membrane each minute and carries more carbon dioxide out with it.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This collapses two separate controls into a single dose knob. Blood flow is titrated principally against oxygen delivery, and nothing here describes support that is short of flow, with a mean arterial pressure of 72 and a lactate of 1.8. Blood flow does make some real contribution to carbon dioxide removal at the bedside, but the sources for this drill place the dominant control on the gas side, and on retrograde arterial support extra pump speed also raises the afterload the native ventricle ejects against.',
        },
        {
          id: 'raise-sweep-gas-oxygen',
          label: 'Raise the oxygen fraction of the gas being delivered to the membrane.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads the situation as an upper-body oxygenation problem. That is a real hazard of peripheral venoarterial support, but it is not what has moved: the right radial saturation is 93 and the value out of place is the PaCO2. The oxygen fraction sets what is offered on the oxygen side of the membrane and does not change the gradient that carries carbon dioxide away, so the acidemia would be left where it is.',
        },
        {
          id: 'review-lv-loading-first',
          label:
            'Hold the current settings and review the left ventricle first — pulsatility, aortic-valve opening, and the lungs — before changing gas exchange.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Loading of the left ventricle is a genuine hazard of retrograde arterial support and is worth looking for in a patient working this hard. The findings that define it are absent: the loading pattern is a pulse pressure near 5 with a valve that stops opening and worsening pulmonary congestion, while this patient has a pulse pressure of 18, an opening valve, and mild congestion. Looking does no harm; leaving an acute acidemia untouched while looking is what makes this an incomplete answer.',
        },
        {
          id: 'escalate-vasopressor',
          label:
            'Read the pH of 7.18 as inadequate systemic perfusion and escalate vasopressor support before the gas path is examined.',
          plausibility: 'unsafe',
          rationale:
            'This is the reflex that treats any low pH as shock. The acid-base data refute it, since the pH is being carried by the carbon dioxide term while the bicarbonate sits at 25, and so do the perfusion data, with a mean arterial pressure of 72 and a lactate of 1.8. Vasoconstriction also raises the afterload that retrograde circuit blood is driven against and can worsen loading of the left ventricle, while the patient goes on breathing 32 times a minute against carbon dioxide that nobody has removed.',
        },
      ],
      correctChoiceIds: ['increase-sweep-gas-flow'],
      explanation:
        'A PaCO2 of 68 with a bicarbonate of 25 puts the whole pH movement on the carbon dioxide term. This is an acute respiratory acidemia, not the compensated maintenance picture in which bicarbonate has climbed and the pH has drifted back toward normal, and the two are handled differently. Carbon dioxide crosses the membrane readily, so its removal is limited by the gradient held on the gas side: the flow of gas through the membrane is the control that moves it, while the oxygen fraction of that same gas and the blood-side dose act principally on oxygen. The circulatory data given, a mean arterial pressure of 72, a lactate of 1.8, a pulse pressure of 18 with an opening aortic valve, and mild pulmonary congestion, describe neither shock nor the loading pattern that would send the reasoning elsewhere. Whatever is changed, the reassessment has to cover PaCO2 and pH, right-arm oxygenation, native lung function, and perfusion, because a venoarterial patient is never described by a blood gas alone. Model boundary: here the carbon dioxide value walks along a straight-line teaching curve toward a target fixed by the gas-side setting alone, the bicarbonate is held constant so the pH follows the carbon dioxide term at once, and a single PaCO2 is carried for the whole patient, so upper-body and lower-body carbon dioxide cannot diverge here the way arterial saturations can during peripheral venoarterial support. At the bedside, removal also varies with membrane surface, blood flow, native ventilation, and carbon dioxide production; the response is neither immediate nor linear; and how quickly an acute acidemia should be brought back is a patient-specific judgement made under local protocol, since an abrupt drop in PaCO2 carries hazards of its own. The numbers here are bounded teaching values, not a bedside prescription.',
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
      stem: 'Minutes into a peripheral venoarterial run the patient deteriorates. Displayed circuit blood flow, the drainage pressure, both membrane pressures and the gradient across the membrane are all exactly where they have been. Blood leaving the membrane has fallen from a saturation of 99 to a saturation of 72. The right radial saturation has fallen from a saturation of 96 to a saturation of 80, and a femoral sample that read a saturation of 98 earlier now reads a saturation of 78. The arterial carbon dioxide value has climbed quickly from the mid-40s and the pH is drifting down with it. The sweep control still displays the value it was set to. What do you commit to first, and what are you acting to achieve?',
      choices: [
        {
          id: 're-establish-the-gas-supply-path',
          label:
            'Go to the gas supply itself — wall outlet or cylinder, blender, and the tubing running to the membrane — and re-establish delivery, with the aim of bringing membrane gas transfer back.',
          plausibility: 'best',
          rationale:
            'Every pressure and flow channel is untouched because the interruption is not in the blood path: the pump goes on moving blood through a membrane that has nothing to exchange with. What has moved is everything that depends on gas transfer — blood leaving the membrane at a saturation of 72, two arterial saturations falling together rather than apart, and a carbon dioxide value climbing over minutes. That combination is the signature of an absent gas supply, and it is also the only item on this list that can be put back within seconds, at a connection rather than at a setting.',
        },
        {
          id: 'raise-pump-speed',
          label: 'Raise the pump speed until the arterial saturations come back up.',
          plausibility: 'unsafe',
          rationale:
            'This holds that a deteriorating patient on support must be receiving too little support. Unchanged flow, unchanged drainage pressure and unchanged membrane pressures already argue against that. Sending more blood through a membrane that is transferring nothing returns more poorly oxygenated blood rather than less, and it drives the mixing point more proximally, toward the aortic root, so more of the body — the upper body included — comes to be supplied by blood the membrane never oxygenated. In peripheral venoarterial support the added return also raises what the left ventricle must eject against, so distension and pulmonary congestion can deepen while the gas supply stays undiscovered.',
        },
        {
          id: 'turn-the-sweep-up',
          label: 'Turn the sweep flow up, since carbon dioxide is the value moving fastest.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The mental model here is that a control which is set is a control which is delivering. A setting states what was asked for, not what is arriving at the membrane, and an interruption anywhere between the source and the membrane leaves the dialed value sitting above no delivery at all. Blood leaving the membrane at a saturation of 72 while that control reads what it always read is the finding that refutes it. Carbon dioxide is indeed the value moving fastest, and that speed is a property of losing the gas supply rather than of needing more of it.',
        },
        {
          id: 'exchange-the-oxygenator',
          label:
            'Arrange an oxygenator exchange, since blood is leaving the membrane at a saturation of 72.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads a membrane that has given way from its output alone. A membrane that is failing usually announces itself over hours, most often with a gradient across it that has been climbing, and this gradient has not moved. A membrane can also lose transfer with an unchanged gradient — condensation and plasma leak do exactly that — so what argues against acting here is not that the membrane is above suspicion but that an intact membrane receiving no gas produces this same output, and the gas path is the one item that can be excluded in seconds. Exchanging first interrupts support to replace a component that may well be working.',
        },
        {
          id: 'resample-the-two-arterial-sites',
          label:
            'Draw the upper-body and lower-body arterial samples again first, to confirm the difference between the two sites before acting.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Reading two arterial sites against each other is the right habit in peripheral venoarterial support, and it is what discovers a mixing point that has moved distally. The model behind this choice is that a low upper-body saturation in this configuration is a mixing problem until shown otherwise. Here both sites have fallen together rather than separating, which is what argues against that, so the repeat sample confirms a difference that is not the finding while the membrane still has no gas to work with and the carbon dioxide goes on climbing.',
        },
      ],
      correctChoiceIds: ['re-establish-the-gas-supply-path'],
      explanation:
        'The blood path is instrumented on the console and the gas side is not: sweep and its source sit outside the touchscreen, and no channel reports what is arriving at the membrane, so an interruption there leaves flow, drainage pressure, both membrane pressures and the gradient exactly where they were. Three findings do the discriminating — how quickly the carbon dioxide value moved, blood leaving the membrane at a saturation that no longer resembles the output of a working lung, and two arterial saturations falling together rather than separating, which is what distinguishes this from a mixing point that has moved distally. Ongoing venoarterial blood flow never establishes that the blood being returned is oxygenated, and that is the safety idea this drill exists for. Model boundary: this lab removes the supply cleanly at one instant, names it on the gas panel, and drives the modelled saturations and carbon dioxide toward fixed bounded values. At the bedside nothing is guaranteed to name it for you — a blender may or may not alarm on lost source pressure, a real flowmeter may itself drop toward zero, and the interruption may be partial, intermittent, or silent. The numbers here are bounded teaching values rather than a prediction for any patient, and the order in which the supply path is inspected follows local protocol.',
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
      stem: 'Four seconds into a peripheral venoarterial run, a high-priority alarm annunciates: air has been detected on the arterial return limb, past the membrane at the flow and bubble sensor. The bubble intervention has stopped the pump. Displayed blood flow reads zero, the pressure channels have stopped reporting numbers, and the intervention stays latched, so the pump will not restart on its own. Both limbs are unclamped, and with forward flow gone the mean arterial pressure is already falling. The alarm carries no bubble size. Which of these do you commit to next?',
      choices: [
        {
          id: 'isolate-then-resolve-source',
          label:
            'Separate the patient from the circuit at the near-patient clamps, then find where the air entered, resolve it, and confirm the return limb is clear.',
          plausibility: 'best',
          rationale:
            'The stop took away forward flow; it did not take away the air. On venoarterial support the return limb is an arterial line into the patient, so that limb is what gets closed first — a stopped centrifugal pump is not a valve, and with both limbs open the patient’s own arterial pressure drives blood retrograde through the circuit. Air more often enters upstream of the pump than at the sensor that alarmed, so the endpoint is a resolved entry and a return limb confirmed clear.',
        },
        {
          id: 'restart-pump-now',
          label:
            'Reset the bubble intervention and restart the pump straight away, on the grounds that a patient with no circuit flow cannot wait for a circuit inspection.',
          plausibility: 'unsafe',
          rationale:
            'This treats the stop as the emergency and the alarm as the obstacle in front of a circulation. What refutes it is that nothing about the air has changed: the pump was stopped because air was detected in a limb that empties into the aorta, and restarting drives whatever remains into the patient. A reset before the source is resolved is a critical safety error in this drill. The lost flow is real — it is why the rest of the sequence is done fast, not why it is skipped.',
        },
        {
          id: 'isolate-and-hand-over',
          label:
            'Close both clamps to separate the patient from the circuit, support the circulation by conventional means, and leave the circuit itself to the perfusion team.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Isolation genuinely is the first move, and calling for help belongs inside it — which is what makes this feel finished. It stops one step short of ending the event: the entry is still open, so support re-established through a limb that was never cleared reproduces the same alarm and the same stop. The authored sequence runs on to a resolved entry and a limb confirmed clear, then unclamping drainage before return, then a deliberate reset.',
        },
        {
          id: 'vasopressor-for-pressure',
          label:
            'Start a vasopressor for the falling arterial pressure and leave the circuit untouched until the pressure has come back up.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads a mechanical event as a vasoplegic one. The pressure is falling because forward circuit flow stopped, not because vascular tone changed, and a vasoactive infusion does nothing about air in a limb that empties into the aorta while the patient is still joined to it. Vasoactive support may well run alongside the sequence during the interval without flow; as the whole response it treats the consequence and leaves the cause in place.',
        },
        {
          id: 'exchange-the-oxygenator',
          label:
            'Prepare an oxygenator exchange as the first move, since air appearing after the membrane means the membrane has developed a leak.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Detection after the membrane says where the air was found, not where it got in. Entry sits more often on the negative-pressure side of the pump — a loose connector, a stopcock, an access port, a cannula side hole — than across the membrane. An exchange is also a prepared procedure lasting minutes, during which the patient stays joined to an arterial limb holding air. If the membrane does turn out to be the entry, that is established by looking, and the exchange then follows isolation rather than standing in for it.',
        },
      ],
      correctChoiceIds: ['isolate-then-resolve-source'],
      explanation:
        'On venoarterial support the return limb is an arterial line into the patient, and that is what separates this alarm from the same alarm on venovenous support: what is being prevented is systemic embolism, cerebral and coronary beds included, rather than a fall in gas transfer. Where air actually lands depends on where circuit return meets native ejection, so the threat is not narrowed to one bed here. The intervention buys that protection by taking the circulation away, which is why the response is quick and ordered rather than deferred: clamp the return limb and then the drainage limb near the patient, resolve the entry, confirm the limb is clear, open drainage before return, then reset deliberately and re-establish support while reassessing perfusion. Where this model simplifies: one air event is injected with no size attached to it, because the manufacturer’s document is internally inconsistent about a bubble-size threshold and this module declines to encode a number its own source disputes. Resolving the entry is a single action here, whereas at the bedside finding it is the slow part. Clamp and unclamp order follows local protocol; one bounded sequence is taught here so the reasoning stays consistent.',
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
      // Exactly the scenario's own expectation for `va-arterial-bubble-stop`.
      'isolate-then-resolve-source': {
        goalId: 'prevent-air-return',
        control: 'correct-cause',
        direction: 'inspect',
      },
      // "The circulation is the emergency; get support back without a break."
      'restart-pump-now': {
        goalId: 'maintain-continuous-support',
        control: 'initiate-support',
        direction: 'restore',
      },
      // "Separate the patient and perfuse them by other means until someone else clears the circuit."
      'isolate-and-hand-over': {
        goalId: 'restore-systemic-support',
        control: 'isolate-circuit',
        direction: 'temporary',
      },
      // Same goal as the choice above, reached with the wrong lever: tone instead of flow.
      // ('protect-upper-body' is this module's differential-hypoxemia goal and does not fit a pressor-for-MAP model.)
      'vasopressor-for-pressure': {
        goalId: 'restore-systemic-support',
        control: 'vasopressor',
        direction: 'perfusion',
      },
      // "The membrane failed; replace it." Mislocalizes the entry to the oxygenator.
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
      stem: 'You are moving a patient on peripheral venoarterial support out of the unit for imaging. Moments into the move the console alarms, the power indicator changes over to battery on its own, and the battery reserve reads 24. Circuit blood flow, both membrane pressures, the gradient across the membrane, the arterial trace and the right radial saturation are all exactly what they were before the move, and the patient looks the same. What does the team’s next action have to accomplish?',
      choices: [
        {
          id: 'verified-source-with-backup-alongside',
          label:
            'Put the console back on a verified power source now, and in the same action confirm flow, membrane pressures, perfusion and right-arm monitoring while the backup console and emergency drive stay within reach of the cart.',
          plausibility: 'best',
          rationale:
            'What has given way is the supply of power, and the reserve is a countdown that began the moment the changeover happened. A source counts only once it has been confirmed live, since the cart’s own cord, the outlet offered at the far end and the console itself are each candidates for what has given way. A verified source stops the countdown, confirming the patient establishes that the changeover cost the circulation nothing, and keeping the backup beside the cart covers the one threat a live source does not — losing the console outright. These belong in one action because on a moving cart they compete for the same pair of hands.',
        },
        {
          id: 'slow-the-pump-to-stretch-the-reserve',
          label: 'Bring the pump speed down so the reserve lasts until the cart reaches an outlet.',
          plausibility: 'unsafe',
          rationale:
            'The model behind this is that run time is the thing under threat and pump demand is the way to buy it. On venoarterial support the circuit carries a circulatory load and not only gas exchange, and how much of this patient’s systemic circulation rests on it is established nowhere in the situation — so this spends perfusion, the thing the move exists to protect, for an unstated amount of extra run time. Flow, the arterial trace and the right radial saturation are unchanged because support has been uninterrupted, not because it is surplus. The console is still on a draining reserve afterwards, so the threat itself is untouched.',
        },
        {
          id: 'readiness-then-continue-on-reserve',
          label:
            'Bring the backup console and emergency drive alongside the cart, then carry on and plug in at the scanner — the changeover was automatic and a reserve of 24 covers the trip.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Half of this is the taught answer: readiness travelling with the patient is exactly what an automatic changeover should trigger, and a learner who does this has understood that a battery is a bridge. What it leaves undone is the length of the bridge. A reserve of 24 is a reading under an unknown draw rather than a duration, and a move has no guaranteed end time — a held lift or a delayed scanner extends it. Readiness answers the console being lost outright; it does nothing about the reserve emptying.',
        },
        {
          id: 'search-the-circuit-for-the-alarm',
          label:
            'Look through the circuit and the membrane for the cause of the alarm before touching the power arrangement.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'This reads a console alarm as a statement about the blood path, which is the habit most circuit drills reward. Here the alarm names the power source, the console changed its own source without being asked, and blood flow, both membrane pressures and the gradient are the one part of the situation that has not moved. Time spent in the blood path is time the reserve is spending on a place where nothing is happening.',
        },
      ],
      correctChoiceIds: ['verified-source-with-backup-alongside'],
      explanation:
        'A power indicator changing over by itself is a device doing what it was built to do, not a problem that has been handled. What the changeover announces is that the run now has a clock on it, and each choice here is a position on what that clock means. The unchanged patient signals are the consequence of support having continued, not evidence that it is safe to let it continue on a countdown, and a reserve reading is a quantity under an unknown draw rather than a duration. Readiness and a live source answer two different threats — the console being lost outright, and the reserve emptying — which is why the taught workflow names both instead of choosing between them. Model boundary: this simulation drains the reserve at one fixed rate that does not vary with pump speed, ambient temperature or battery age; it does not model the pump stopping when the reserve is exhausted, and it does not model hand-driven operation of the pump head. Those simplifications are what make the drill repeatable, and they are the reason the run time seen here should never be read as a real console’s endurance. Recognition and readiness are what this drill teaches; handling an emergency drive is learned on the device itself.',
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
