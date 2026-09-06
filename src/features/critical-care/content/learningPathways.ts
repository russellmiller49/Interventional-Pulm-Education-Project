import { ventilationLearningUnits } from '@/features/mechanical-ventilation/content/learningCurriculum'
import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity/types'
import type { LearningPathway } from '@/features/learning-module/curriculum/types'

import { criticalCareModuleCatalog, type CriticalCareCatalogModuleId } from './modules'

/**
 * The authored learning order for each module, and the only place that order is declared.
 *
 * v5.1 named six structural roles per module but never named the ordered pathway as one of them,
 * assuming sequencing would fall out of `difficulty`. It did not: difficulty was section-constant.
 * These pathways are the missing artifact — they carry the order, the arc sentence, and the
 * stage of every Learn section.
 *
 * Nothing here gates. A pathway orders and signposts; every section stays reachable by URL.
 */
export const criticalCareLearningPathways: readonly LearningPathway[] = Object.freeze([
  {
    moduleId: 'icu-hemodynamics',
    arcSentence:
      'Trust the signal, read the waveform, advance the catheter, measure, and integrate',
    sections: [
      {
        id: 'pressure-system',
        shortTitle: 'Trust the signal',
        title: 'Level, zero, and dynamic response',
        minutes: 12,
        description:
          'Start here: can I trust this pressure signal? Level and zero the system, then classify its fast-flush response before any number is read.',
        stage: 'foundation',
        activityId: 'hemodynamics:learn:pressure-system',
      },
      {
        id: 'waveform-interpretation',
        shortTitle: 'Read the waveform',
        title: 'Interpret normal and abnormal waveforms',
        minutes: 18,
        description:
          'Build the normal RA, RV, PA, and wedge reference first, then read the wave components that carry a diagnosis.',
        stage: 'mechanism',
        activityId: 'hemodynamics:learn:waveform-interpretation',
      },
      {
        id: 'catheter-advancement',
        shortTitle: 'Advance',
        title: 'Advance the PAC by waveform',
        minutes: 15,
        description:
          'With a trusted signal and a normal reference in hand, work from the introducer and confirm each RA, RV, and PA transition from morphology.',
        stage: 'foundation',
        activityId: 'hemodynamics:learn:catheter-advancement',
      },
      {
        id: 'pawp-capture',
        shortTitle: 'Wedge',
        title: 'Brief end-expiratory PAWP capture',
        minutes: 15,
        description:
          'From the confirmed PA position, capture and store at end expiration, then deflate promptly and confirm the PA waveform returns.',
        stage: 'mechanism',
        activityId: 'hemodynamics:learn:pawp-capture',
      },
      {
        id: 'thermodilution-series',
        shortTitle: 'Measure CO',
        title: 'Cardiac output: thermodilution and Fick',
        minutes: 18,
        description:
          'Learn what each method measures, then standardize and review a thermodilution series.',
        stage: 'mechanism',
        activityId: 'hemodynamics:learn:thermodilution-series',
      },
      {
        id: 'derived-hemodynamics',
        shortTitle: 'Derive',
        title: 'Derived hemodynamics and validity',
        minutes: 15,
        description:
          'Trace each formula back to its source measurements before interpreting the result.',
        stage: 'application',
        activityId: 'hemodynamics:learn:derived-hemodynamics',
      },
      {
        id: 'pac-signal-validation',
        shortTitle: 'Integrate',
        title: 'PAC signal-validation capstone',
        minutes: 20,
        description:
          'Run the whole validity screen at once on a discordant case: setup, catheter position, curve quality, derived values, and reassessment.',
        stage: 'integration',
        activityId: 'hemodynamics:learn:pac-signal-validation',
      },
    ],
  },
  {
    moduleId: 'baxter-crrt',
    /**
     * C2 §4 — the recommended novice progression: treatment trajectory, the universal circuit,
     * transport, prescription construction, prescribed versus delivered dose, pressure
     * localization, citrate, fluid management, integration. Eight sections carry those nine
     * steps because prescription construction and prescribed-versus-delivered are two halves of
     * one section (`crrt-prescription-dosing`), which is why the staged builder inside it has a
     * construction stage and a predicted-consequences stage.
     *
     * The only order change is that localization now precedes citrate: a learner who cannot yet
     * name a place on the circuit has no way to read a citrate finding as belonging to the
     * circuit rather than the patient. Every section id, activity id, route, and storage key is
     * unchanged, and nothing here gates.
     */
    arcSentence:
      'Set the trajectory, trace one circuit, build the prescription, localize the pressure, and hold citrate and fluid together',
    sections: [
      {
        id: 'crrt-indications-modality',
        shortTitle: 'Set the trajectory',
        title: 'CRRT indications and modality selection',
        minutes: 12,
        description:
          'Start here. Name the solute, acid–base, and volume problem the therapy is meant to work on, and the trajectory it is meant to follow, before any modality label is chosen.',
        stage: 'orientation',
        activityId: 'crrt:learn:crrt-indications-modality',
      },
      {
        id: 'crrt-circuit-pressures',
        shortTitle: 'Trace the circuit',
        title: 'Circuit anatomy and pressure localization',
        minutes: 14,
        description:
          'Trace the one circuit every later section reuses — access lumen, pump, filter, return lumen, and the separate fluid side — and learn where each pressure is measured on it.',
        stage: 'foundation',
        activityId: 'crrt:learn:crrt-circuit-pressures',
      },
      {
        id: 'crrt-solute-transport',
        shortTitle: 'Move solute',
        title: 'Solute and water transport',
        minutes: 12,
        description:
          'Separate diffusion, convection, ultrafiltration, and adsorption across the membrane you just traced.',
        stage: 'foundation',
        activityId: 'crrt:learn:crrt-solute-transport',
      },
      {
        id: 'crrt-prescription-dosing',
        shortTitle: 'Prescribe',
        title: 'Prescription and delivered dose',
        minutes: 15,
        description:
          'Build a prescription in three steps — the job it has to do, the flows that do it, and what those flows predict — then separate prescribed intensity from therapy actually delivered.',
        stage: 'mechanism',
        activityId: 'crrt:learn:crrt-prescription-dosing',
      },
      {
        id: 'crrt-alarms-troubleshooting',
        shortTitle: 'Localize',
        title: 'Alarms and cause-first troubleshooting',
        minutes: 12,
        description:
          'Turn a changed pressure pattern into a place on the circuit you can walk to and inspect, and preserve the safe state before anything resumes.',
        stage: 'application',
        activityId: 'crrt:learn:crrt-alarms-troubleshooting',
      },
      {
        id: 'crrt-anticoagulation',
        shortTitle: 'Citrate',
        title: 'Anticoagulation and citrate safety',
        minutes: 12,
        description:
          'Follow citrate into the circuit and calcium back to the patient, and keep a circuit sample and a systemic sample answering the two different questions they answer.',
        stage: 'application',
        activityId: 'crrt:learn:crrt-anticoagulation',
      },
      {
        id: 'crrt-fluid-liberation',
        shortTitle: 'Reconcile fluid',
        title: 'Fluid management and liberation',
        minutes: 12,
        description:
          'Keep the device ledger and the whole-patient ledger separate, and make liberation a reassessed transition.',
        stage: 'application',
        activityId: 'crrt:learn:crrt-fluid-liberation',
      },
      {
        id: 'crrt-pressure-profile-integration',
        shortTitle: 'Integrate',
        title: 'Read the pressure profile: where in the circuit is the problem?',
        minutes: 18,
        description:
          'Put every earlier reading on one deteriorating run: circuit anatomy, the prescription, citrate, and the fluid ledger, read together to localize the problem.',
        stage: 'integration',
        activityId: 'crrt:learn:crrt-pressure-profile-integration',
      },
    ],
  },
  {
    moduleId: 'mechanical-circulatory-support',
    arcSentence:
      'Validate the signal, separate the mechanisms, work each device, and choose between them',
    sections: [
      {
        id: 'mcs-foundations-signals',
        shortTitle: 'Pressure and flow',
        title: 'A pressure that looks fine',
        minutes: 12,
        description:
          'Build a pressure–flow baseline and separate patient, measurement, and device problems.',
        stage: 'foundation',
        activityId: 'mcs:learn:mcs-foundations-signals',
      },
      {
        id: 'mcs-foundations-mechanisms',
        shortTitle: 'Three devices',
        title: 'Three devices called support',
        minutes: 12,
        description:
          'Distinguish what each mechanism changes before meeting the device that delivers it.',
        stage: 'foundation',
        activityId: 'mcs:learn:mcs-foundations-mechanisms',
      },
      {
        id: 'iabp-timing-triggering',
        shortTitle: 'IABP timing',
        title: 'Is the balloon inflating at the right moment?',
        minutes: 12,
        description:
          'Place inflation and deflation against the native beat, and match the trigger to signal quality.',
        stage: 'mechanism',
        activityId: 'mcs:learn:iabp-timing-triggering',
      },
      {
        id: 'iabp-efficacy-limits',
        shortTitle: 'IABP limits',
        title: 'Timed correctly, still not perfusing',
        minutes: 12,
        description:
          'Read the assisted beat against the whole circulation, and decide whether the balloon is the problem.',
        stage: 'application',
        activityId: 'mcs:learn:iabp-efficacy-limits',
      },
      {
        id: 'impella-unloading-placement',
        shortTitle: 'Impella flow',
        title: 'Where is the inlet sitting?',
        minutes: 12,
        description:
          'The setting has not changed and the flow has fallen: decide what the readings say before any setting is touched.',
        stage: 'mechanism',
        activityId: 'mcs:learn:impella-unloading-placement',
      },
      {
        id: 'impella-suction-purge-rv',
        shortTitle: 'Impella suction',
        title: 'A suction alarm at high support',
        minutes: 12,
        description: 'Work the conditions in which more support produces less effective flow.',
        stage: 'application',
        activityId: 'mcs:learn:impella-suction-purge-rv',
      },
      {
        id: 'lvad-parameters-assessment',
        shortTitle: 'LVAD flow',
        title: 'Speed unchanged, resistance rising',
        minutes: 12,
        description: 'Read speed, flow, power, and pulsatility index as one interdependent set.',
        stage: 'mechanism',
        activityId: 'mcs:learn:lvad-parameters-assessment',
      },
      {
        id: 'lvad-alarms-emergencies',
        shortTitle: 'LVAD alarms',
        title: 'An alarm at an unchanged speed',
        minutes: 12,
        description:
          'Decide which of the controller’s readings is the signal when the speed has not changed.',
        stage: 'application',
        activityId: 'mcs:learn:lvad-alarms-emergencies',
      },
      {
        id: 'mcs-device-selection-integration',
        shortTitle: 'Choose',
        title: 'Low output on left-sided support',
        minutes: 18,
        description:
          'Hold all three mechanisms against one phenotype and let the limiting problem select the device.',
        stage: 'integration',
        activityId: 'mcs:learn:mcs-device-selection-integration',
      },
    ],
  },
  {
    moduleId: 'mechanical-ventilation',
    arcSentence: 'Follow a normal breath, build the mechanisms, then reason from the whole patient',
    sections: ventilationLearningUnits.map((unit) => ({
      id: unit.id,
      shortTitle: unit.shortTitle,
      title: unit.title,
      minutes: unit.minutes,
      description: unit.outcome,
      stage: unit.stage,
      activityId: `ventilation:learn:${unit.id}`,
    })),
  },
  {
    moduleId: 'icu-simulation',
    arcSentence: 'Learn the loop, then ask of every patient: which support is limiting?',
    sections: [
      {
        id: 'workspace-orientation',
        shortTitle: 'The loop',
        title: 'The integrated workspace and the reassessment loop',
        minutes: 10,
        description:
          'Meet the shared patient and clock, and learn what it means for the limiting support to change.',
        stage: 'orientation',
        activityId: 'icu:learn:workspace-orientation',
      },
      {
        id: 'hemorrhagic',
        shortTitle: 'One mechanism',
        title: 'Active hemorrhagic hypovolemic shock',
        minutes: 15,
        description:
          'Run the loop where one mechanism dominates and the limiting support is unambiguous.',
        stage: 'foundation',
        activityId: 'icu:practice:hemorrhagic',
      },
      {
        id: 'tamponade',
        shortTitle: 'Obstructive',
        title: 'Evolving cardiac tamponade',
        minutes: 15,
        description:
          'Work a mechanism that support settings cannot fix, and recognize when the constraint is outside the device.',
        stage: 'mechanism',
        activityId: 'icu:practice:tamponade',
      },
      {
        id: 'lv-cardiogenic',
        shortTitle: 'Pump failure',
        title: 'LV cardiogenic shock with pulmonary edema',
        minutes: 15,
        description:
          'Hold a circulatory and a respiratory constraint together and watch which one moves first.',
        stage: 'mechanism',
        activityId: 'icu:practice:lv-cardiogenic',
      },
      {
        id: 'massive-pe-rv',
        shortTitle: 'RV shock',
        title: 'Massive pulmonary embolism with acute RV shock',
        minutes: 15,
        description:
          'Reclassify under time pressure as RV loading, gas exchange, and systemic flow interact.',
        stage: 'application',
        activityId: 'icu:practice:massive-pe-rv',
      },
      {
        id: 'septic-ards-aki',
        shortTitle: 'Multisystem',
        title: 'Septic shock with ARDS and evolving AKI',
        minutes: 15,
        description:
          'Run the full twelve-hour course with three supports interacting and the constraint moving repeatedly.',
        stage: 'application',
        activityId: 'icu:practice:septic-ards-aki',
      },
      {
        id: 'mixed-cardiogenic-vasodilatory',
        shortTitle: 'Integrate',
        title: 'Mixed cardiogenic–vasodilatory shock capstone',
        minutes: 15,
        description:
          'Two shock mechanisms at once, with the limiting support changing as each is addressed.',
        stage: 'integration',
        activityId: 'icu:practice:mixed-cardiogenic-vasodilatory',
      },
    ],
  },
  {
    moduleId: 'cardiohelp-ecmo',
    trackId: 'vv',
    arcSentence:
      'Understand the support, trace the circuit, learn the normal state, then work what goes wrong',
    /**
     * Every title and description on both ECMO pathways names the presentation — what the learner
     * sees on the console, the circuit and the patient — never the fault, its mechanism, the best
     * action or the reflex to resist. The section is the pre-commit surface a learner reads first;
     * its name reaching the answer would settle the drill's prediction before it was asked.
     * `learn-precommit-leak.test.ts` holds every row to its drill's deny patterns.
     */
    sections: [
      {
        id: 'why-extracorporeal-support',
        shortTitle: 'Why ECMO',
        title: 'Why extracorporeal support exists',
        minutes: 8,
        description:
          'Start from what the tissues need and the three things that decide whether they get it, then name the one a circuit can stand in for.',
        stage: 'orientation',
        activityId: 'ecmo:learn:why-extracorporeal-support',
      },
      {
        id: 'circuit-flow-path',
        shortTitle: 'Circuit walk',
        title: 'Drainage → pump → membrane lung → return: a walk round the circuit',
        minutes: 10,
        description:
          'Walk the blood once round a running circuit, one stop per component, and learn where every displayed reading is taken before you read its value.',
        stage: 'foundation',
        activityId: 'ecmo:learn:circuit-flow-path',
      },
      {
        id: 'pump-and-pressure-zones',
        shortTitle: 'Pump & pressures',
        title: 'The pump, and the pressures either side of it',
        minutes: 10,
        description:
          'Turn the speed up on a running circuit and watch what the pressures either side of the pump do, then read the three of them as a set.',
        stage: 'foundation',
        activityId: 'ecmo:learn:pump-and-pressure-zones',
      },
      {
        id: 'blood-flow-versus-sweep',
        shortTitle: 'Controls',
        title: 'The control panel: the three things you can change',
        minutes: 10,
        description:
          'You can change three things on this circuit; everything else is monitoring. Find out which problem each one reaches, and when none of them does.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:blood-flow-versus-sweep',
      },
      {
        id: 'vv-normal-state',
        shortTitle: 'Normal VV',
        title: 'A stable VV run: the baseline you read everything against',
        minutes: 8,
        description:
          'What a steady, uneventful run looks like for this patient and this circuit, so that every later change has something to be read against.',
        stage: 'foundation',
        activityId: 'ecmo:learn:vv-normal-state',
      },
      {
        id: 'vv-series-physiology',
        shortTitle: 'In series',
        title: 'In series with the heart: what the flow number counts',
        minutes: 10,
        description:
          'The circuit sits in series with the patient’s own circulation. Work out what the flow number counts and what it leaves out, using the drainage-line saturation against the patient’s own.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:vv-series-physiology',
      },
      {
        id: 'startup-sensor-orientation',
        shortTitle: 'Console tour',
        title: 'Meet the console, the circuit, and the external controls',
        minutes: 12,
        description:
          'Now that the physiology is in hand, meet the console and what it reports, the circuit and the gas panel beside it, and the pre-use state a circuit starts from.',
        stage: 'orientation',
        activityId: 'ecmo:learn:startup-sensor-orientation',
      },
      {
        id: 'preload-drainage-collapse',
        shortTitle: 'Flow falls',
        title: 'Flow falls and the drainage line judders',
        minutes: 10,
        description:
          'A run that was steady is not any more. Read the flow, the drainage pressure and the line before you decide which side of the pump to look at.',
        stage: 'application',
        activityId: 'ecmo:learn:preload-drainage-collapse',
      },
      {
        id: 'afterload-return-obstruction',
        shortTitle: 'Pressures rise',
        title: 'Two pressures rise together as flow falls',
        minutes: 10,
        description:
          'Both post-pump pressures have climbed and the flow has fallen with nothing touched. Read the pair and the gradient between them before deciding where the load sits.',
        stage: 'application',
        activityId: 'ecmo:learn:afterload-return-obstruction',
      },
      {
        id: 'afterload-oxygenator-resistance',
        shortTitle: 'Pressures separate',
        title: 'One pressure pulls away from the other',
        minutes: 10,
        description:
          'The pressures either side of the membrane no longer move together. Trend the gap at similar flow, and decide whether one reading is enough to act on.',
        stage: 'application',
        activityId: 'ecmo:learn:afterload-oxygenator-resistance',
      },
      {
        id: 'vv-recirculation',
        shortTitle: 'Flow up, patient worse',
        title: 'Flow is up and the patient is worse',
        minutes: 10,
        description:
          'The display says more, the patient says less. Compare the saturation coming back into the circuit with the patient’s own before deciding what the flow number is worth.',
        stage: 'application',
        activityId: 'ecmo:learn:vv-recirculation',
      },
      {
        id: 'acute-hypercapnia',
        shortTitle: 'Acute CO₂ rise',
        title: 'CO₂ climbing, pH falling, patient struggling',
        minutes: 8,
        description:
          'Read the gas, the pH, the bicarbonate and the work of breathing together, then decide which control reaches the problem and how fast to move it.',
        stage: 'application',
        activityId: 'ecmo:learn:acute-hypercapnia',
      },
      {
        id: 'compensated-hypercapnia',
        shortTitle: 'High CO₂, steady',
        title: 'High CO₂, normal pH, comfortable patient',
        minutes: 8,
        description:
          'The overnight team wants to know what to do about the CO₂. Read the whole acid–base picture and the phase of the run before deciding whether any setting should move.',
        stage: 'application',
        activityId: 'ecmo:learn:compensated-hypercapnia',
      },
      {
        id: 'gas-source-interruption',
        shortTitle: 'Sats fall, flow holds',
        title: 'Gas transfer falls while flow holds',
        minutes: 10,
        description:
          'Nothing on the pressure display has moved, and the patient is getting worse. Decide which path to trace.',
        stage: 'application',
        activityId: 'ecmo:learn:gas-source-interruption',
      },
      {
        id: 'arterial-bubble-stop',
        shortTitle: 'Pump stopped',
        title: 'Bubble alarm: the pump stopped itself',
        minutes: 12,
        description:
          'A high-priority alarm, a pump that has stopped on its own, and air in the circuit. Say what the stop has achieved and what still has to be true before this circuit carries blood again.',
        stage: 'application',
        activityId: 'ecmo:learn:arterial-bubble-stop',
      },
      {
        id: 'transport-power-loss',
        shortTitle: 'On battery',
        title: 'On battery, mid-transport',
        minutes: 8,
        description:
          'The supply has dropped out on the move and the console has changed over to its own reserve. Decide what that reserve buys, and what securing support means here.',
        stage: 'application',
        activityId: 'ecmo:learn:transport-power-loss',
      },
      {
        id: 'vv-integration-capstone',
        shortTitle: 'Integrate VV',
        title: 'One presentation, four explanations: flow unchanged, patient worse',
        minutes: 18,
        description:
          'The flow display has not moved and the patient is deteriorating. Name the explanation you expect and what you expect to find if you are right, then look.',
        stage: 'integration',
        activityId: 'ecmo:learn:vv-integration-capstone',
      },
    ],
  },
  {
    moduleId: 'cardiohelp-ecmo',
    trackId: 'va',
    arcSentence:
      'Understand the support, trace the circuit, learn the normal parallel state, then work what goes wrong',
    sections: [
      {
        id: 'why-extracorporeal-support',
        shortTitle: 'Why ECMO',
        title: 'Why extracorporeal support exists',
        minutes: 8,
        description:
          'Start from what the tissues need and the three things that decide whether they get it, then name the one a circuit can stand in for.',
        stage: 'orientation',
        activityId: 'ecmo:learn:why-extracorporeal-support',
      },
      {
        id: 'circuit-flow-path',
        shortTitle: 'Circuit walk',
        title: 'Drainage → pump → membrane lung → return: a walk round the circuit',
        minutes: 10,
        description:
          'Walk the blood once round a running circuit, one stop per component, and learn where every displayed reading is taken before you read its value.',
        stage: 'foundation',
        activityId: 'ecmo:learn:circuit-flow-path',
      },
      {
        id: 'pump-and-pressure-zones',
        shortTitle: 'Pump & pressures',
        title: 'The pump, and the pressures either side of it',
        minutes: 10,
        description:
          'Turn the speed up on a running circuit and watch what the pressures either side of the pump do, then read the three of them as a set.',
        stage: 'foundation',
        activityId: 'ecmo:learn:pump-and-pressure-zones',
      },
      {
        id: 'blood-flow-versus-sweep',
        shortTitle: 'Controls',
        title: 'The control panel: the three things you can change',
        minutes: 10,
        description:
          'You can change three things on this circuit; everything else is monitoring. Find out which problem each one reaches, and when none of them does.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:blood-flow-versus-sweep',
      },
      {
        id: 'va-normal-state',
        shortTitle: 'Plus two ideas',
        title: 'A stable VA run: VV plus two ideas',
        minutes: 10,
        description:
          'Everything a stable VV run has, plus the signals that exist only because the return goes to an artery and two circulations share one aorta.',
        stage: 'foundation',
        activityId: 'ecmo:learn:va-normal-state',
      },
      {
        id: 'va-parallel-physiology',
        shortTitle: 'In parallel',
        title: 'In parallel with the heart: who fills the aorta',
        minutes: 12,
        description:
          'The heart still ejects into the aorta the circuit returns to. Work out where the two streams meet, what moves that place, and which signals tell you.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:va-parallel-physiology',
      },
      {
        id: 'va-startup-sensor-orientation',
        shortTitle: 'Console tour',
        title: 'Meet the console on a VA circuit',
        minutes: 12,
        description:
          'The same console, on a circuit whose return goes to an artery. Meet what it reports, what it cannot tell you about the two circulations, and the pre-use state a VA circuit starts from.',
        stage: 'orientation',
        activityId: 'ecmo:learn:va-startup-sensor-orientation',
      },
      {
        id: 'va-preload-drainage-collapse',
        shortTitle: 'Flow falls',
        title: 'Flow falls on VA, and the patient’s pressure follows',
        minutes: 10,
        description:
          'Flow swings, the drainage pressure has moved, the line is juddering, and this time the patient’s pressure is falling with the flow. Read the circuit and the patient together before deciding what any move is for.',
        stage: 'application',
        activityId: 'ecmo:learn:va-preload-drainage-collapse',
      },
      {
        id: 'va-afterload-arterial-return-obstruction',
        shortTitle: 'Pressures rise',
        title: 'Two pressures rise together on the arterial side',
        minutes: 10,
        description:
          'Both post-pump pressures have climbed as flow fell, while the patient’s own arterial line on its own monitor has not. Read the circuit pressures beside that line before deciding where the load sits.',
        stage: 'application',
        activityId: 'ecmo:learn:va-afterload-arterial-return-obstruction',
      },
      {
        id: 'va-afterload-oxygenator-resistance',
        shortTitle: 'Pressures separate',
        title: 'One pressure pulls away from the other, on VA',
        minutes: 10,
        description:
          'The pressures either side of the membrane have separated at an unchanged speed. Trend the gap at similar flow, then reassess the territories the circuit supplies.',
        stage: 'application',
        activityId: 'ecmo:learn:va-afterload-oxygenator-resistance',
      },
      {
        id: 'va-differential-hypoxemia',
        shortTitle: 'Two saturations',
        title: 'Right arm low, groin fine, circuit reassuring',
        minutes: 12,
        description:
          'One saturation from the right arm, one from the groin, one from blood leaving the membrane, and they disagree. Say what each sample reports before deciding whether the console can change any of them.',
        stage: 'application',
        activityId: 'ecmo:learn:va-differential-hypoxemia',
      },
      {
        id: 'va-lv-loading',
        shortTitle: 'Flat pulse',
        title: 'Flow and pressure look fine; the pulse has gone flat',
        minutes: 10,
        description:
          'The flow and the mean pressure are acceptable, and the arterial trace under them is nearly flat. Decide what those two numbers establish about the heart, and which signals do.',
        stage: 'application',
        activityId: 'ecmo:learn:va-lv-loading',
      },
      {
        id: 'va-acute-hypercapnia',
        shortTitle: 'Acute CO₂ rise',
        title: 'CO₂ climbing on VA',
        minutes: 8,
        description:
          'Read the gas, the pH and the work of breathing together with the circulation and the right arm. Decide which control reaches the CO₂, and which checks it does not replace.',
        stage: 'application',
        activityId: 'ecmo:learn:va-acute-hypercapnia',
      },
      {
        id: 'va-gas-source-interruption',
        shortTitle: 'Sats fall, flow holds',
        title: 'Gas transfer falls while arterial flow holds',
        minutes: 10,
        description:
          'Nothing on the pressure display has moved, the arterial flow continues, and both saturations are falling. Decide which path to trace, and what to sample.',
        stage: 'application',
        activityId: 'ecmo:learn:va-gas-source-interruption',
      },
      {
        id: 'va-arterial-bubble-stop',
        shortTitle: 'Pump stopped',
        title: 'Bubble alarm on VA: the pump stopped itself',
        minutes: 12,
        description:
          'A high-priority alarm, a pump that has stopped on its own, and a circulation that was depending on it. Say what the stop has achieved, what it has cost, and what still has to be true before this circuit carries blood again.',
        stage: 'application',
        activityId: 'ecmo:learn:va-arterial-bubble-stop',
      },
      {
        id: 'va-transport-power-loss',
        shortTitle: 'On battery',
        title: 'On battery, mid-transport, on VA',
        minutes: 8,
        description:
          'The supply has dropped out on the move and the console has changed over to its own reserve, on a circuit the circulation depends on. Decide what that reserve buys and what securing support means here.',
        stage: 'application',
        activityId: 'ecmo:learn:va-transport-power-loss',
      },
      {
        id: 'va-integration-capstone',
        shortTitle: 'Integrate VA',
        title: 'The same unchanged flow, with a second circulation to blame',
        minutes: 18,
        description:
          'The flow display has not moved and the patient is deteriorating, and parallel circulation adds explanations VV never had. Name what you expect and what would confirm it, then look.',
        stage: 'integration',
        activityId: 'ecmo:learn:va-integration-capstone',
      },
    ],
  },
])

const pathwayKey = (moduleId: string, trackId?: string) => `${moduleId}::${trackId ?? ''}`

const pathwayByKey = new Map(
  criticalCareLearningPathways.map((pathway) => [
    pathwayKey(pathway.moduleId, pathway.trackId),
    pathway,
  ]),
)

export const criticalCareLearningPathwaysByModule: ReadonlyMap<string, readonly LearningPathway[]> =
  new Map(
    criticalCareModuleCatalog.map((module) => [
      module.id,
      criticalCareLearningPathways.filter((pathway) => pathway.moduleId === module.id),
    ]),
  )

export function criticalCareLearningPathway(
  moduleId: CriticalCareCatalogModuleId,
  trackId?: string,
): LearningPathway {
  const pathway = pathwayByKey.get(pathwayKey(moduleId, trackId))
  if (!pathway) {
    throw new Error(
      `No learning pathway declared for ${moduleId}${trackId ? ` track ${trackId}` : ''}`,
    )
  }
  return pathway
}

/**
 * Pathway invariants (WP10 §2.3, §3). The activity catalog is passed in rather than imported:
 * this module is loaded by module-side content files, and an import edge back into the catalog
 * creates an initialization cycle. `validateCriticalCareCatalogs` calls this.
 *
 * Coverage — every module declaring at least one pathway — is checked separately by
 * `validateLearningPathwayCoverage` so modules can be converted one at a time.
 */
export function validateCriticalCareLearningPathways(
  activities: readonly CriticalCareActivityDefinition[],
): readonly string[] {
  const errors: string[] = []
  const seenKeys = new Set<string>()
  const activityById = new Map(activities.map((activity) => [activity.id, activity]))

  for (const pathway of criticalCareLearningPathways) {
    const key = pathwayKey(pathway.moduleId, pathway.trackId)
    if (seenKeys.has(key)) errors.push(`${key}: duplicate learning pathway`)
    seenKeys.add(key)

    if (!pathway.arcSentence.trim()) errors.push(`${key}: missing arc sentence`)
    if (pathway.sections.length === 0) errors.push(`${key}: pathway has no sections`)

    const seenSectionIds = new Set<string>()
    const seenActivityIds = new Set<string>()
    const lastStageOrder = new Map<string, number>()

    for (const section of pathway.sections) {
      if (seenSectionIds.has(section.id)) errors.push(`${key}: duplicate section ${section.id}`)
      seenSectionIds.add(section.id)
      if (seenActivityIds.has(section.activityId)) {
        errors.push(`${key}: activity ${section.activityId} appears in more than one section`)
      }
      seenActivityIds.add(section.activityId)

      const activity = activityById.get(section.activityId)
      if (!activity) {
        errors.push(`${key}/${section.id}: unknown activity ${section.activityId}`)
        continue
      }
      if (activity.moduleId !== pathway.moduleId) {
        errors.push(`${key}/${section.id}: ${section.activityId} belongs to ${activity.moduleId}`)
      }
      if (activity.curriculumStage !== section.stage) {
        errors.push(
          `${key}/${section.id}: section stage ${section.stage} disagrees with activity stage ${activity.curriculumStage}`,
        )
      }
      if (activity.estimatedMinutes !== section.minutes) {
        errors.push(
          `${key}/${section.id}: section minutes ${section.minutes} disagree with activity estimate ${activity.estimatedMinutes}`,
        )
      }
      const previous = lastStageOrder.get(activity.curriculumStage)
      if (previous !== undefined && activity.stageOrder <= previous) {
        errors.push(
          `${key}/${section.id}: stageOrder ${activity.stageOrder} is out of order within ${activity.curriculumStage}`,
        )
      }
      lastStageOrder.set(activity.curriculumStage, activity.stageOrder)
    }

    const integrationCount = pathway.sections.filter(
      (section) => section.stage === 'integration',
    ).length
    if (integrationCount !== 1) {
      errors.push(`${key}: expected exactly one integration section, found ${integrationCount}`)
    }

    const moduleHasFoundation = activities.some(
      (activity) =>
        activity.moduleId === pathway.moduleId && activity.curriculumStage === 'foundation',
    )
    if (!moduleHasFoundation) {
      errors.push(`${pathway.moduleId}: module has no foundation-stage activity`)
    }
  }

  return errors
}

/** Every catalog module declares at least one pathway (WP10 §7). */
export function validateLearningPathwayCoverage(): readonly string[] {
  return criticalCareModuleCatalog.flatMap((module) =>
    (criticalCareLearningPathwaysByModule.get(module.id) ?? []).length === 0
      ? [`${module.id}: declares no learning pathway`]
      : [],
  )
}
