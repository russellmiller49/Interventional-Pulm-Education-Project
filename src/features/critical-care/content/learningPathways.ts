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
    arcSentence: 'Advance, validate, interpret, measure, and integrate',
    sections: [
      {
        id: 'catheter-advancement',
        shortTitle: 'Advance',
        title: 'Advance the PAC by waveform',
        minutes: 15,
        description:
          'Start at the introducer, then confirm the RA, RV, and PA transitions from pressure morphology.',
        stage: 'foundation',
        activityId: 'hemodynamics:learn:catheter-advancement',
      },
      {
        id: 'pressure-system',
        shortTitle: 'Validate setup',
        title: 'Level, zero, and dynamic response',
        minutes: 12,
        description:
          'Establish a valid pressure-measurement system and classify its fast-flush response.',
        stage: 'foundation',
        activityId: 'hemodynamics:learn:pressure-system',
      },
      {
        id: 'waveform-interpretation',
        shortTitle: 'Interpret',
        title: 'Interpret normal and abnormal waveforms',
        minutes: 18,
        description:
          'Identify chambers by morphology and read the wave components that carry a diagnosis.',
        stage: 'mechanism',
        activityId: 'hemodynamics:learn:waveform-interpretation',
      },
      {
        id: 'pawp-capture',
        shortTitle: 'Wedge',
        title: 'Brief end-expiratory PAWP capture',
        minutes: 15,
        description:
          'Capture, store, and promptly deflate while confirming safe return of the PA waveform.',
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
          'Integrate setup, catheter position, curve quality, derived values, and reassessment.',
        stage: 'integration',
        activityId: 'hemodynamics:learn:pac-signal-validation',
      },
    ],
  },
  {
    moduleId: 'baxter-crrt',
    arcSentence:
      'Set the goal, trace the circuit, prescribe the dose, keep it running, and localize the problem',
    sections: [
      {
        id: 'crrt-indications-modality',
        shortTitle: 'Set the goal',
        title: 'CRRT indications and modality selection',
        minutes: 12,
        description:
          'Name the solute, acid–base, and volume problem to solve before any modality label is chosen.',
        stage: 'orientation',
        activityId: 'crrt:learn:crrt-indications-modality',
      },
      {
        id: 'crrt-circuit-pressures',
        shortTitle: 'Trace the circuit',
        title: 'Circuit anatomy and pressure localization',
        minutes: 14,
        description:
          'Follow the blood path from access to return, and read each pressure as a location rather than a value.',
        stage: 'foundation',
        activityId: 'crrt:learn:crrt-circuit-pressures',
      },
      {
        id: 'crrt-solute-transport',
        shortTitle: 'Move solute',
        title: 'Solute and water transport',
        minutes: 12,
        description:
          'Separate diffusion, convection, ultrafiltration, and adsorption across the filter you just traced.',
        stage: 'foundation',
        activityId: 'crrt:learn:crrt-solute-transport',
      },
      {
        id: 'crrt-prescription-dosing',
        shortTitle: 'Prescribe',
        title: 'Prescription and delivered dose',
        minutes: 15,
        description:
          'Turn the goal into explicit flows, then reconcile the prescription against therapy actually delivered.',
        stage: 'mechanism',
        activityId: 'crrt:learn:crrt-prescription-dosing',
      },
      {
        id: 'crrt-anticoagulation',
        shortTitle: 'Anticoagulate',
        title: 'Anticoagulation and citrate safety',
        minutes: 12,
        description:
          'Hold circuit patency and patient bleeding risk together as one monitored problem.',
        stage: 'application',
        activityId: 'crrt:learn:crrt-anticoagulation',
      },
      {
        id: 'crrt-alarms-troubleshooting',
        shortTitle: 'Answer alarms',
        title: 'Alarms and cause-first troubleshooting',
        minutes: 12,
        description:
          'Preserve the safe state, identify what the device detected, and verify the cause before resuming.',
        stage: 'application',
        activityId: 'crrt:learn:crrt-alarms-troubleshooting',
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
        shortTitle: 'Localize',
        title: 'Read the pressure profile: where in the circuit is the problem?',
        minutes: 18,
        description:
          'Combine circuit anatomy, the prescription, anticoagulation, and the fluid ledger to localize one deteriorating run.',
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
        shortTitle: 'Validate',
        title: 'Validate the signal before the device',
        minutes: 12,
        description:
          'Build a pressure–flow baseline and separate patient, measurement, and device problems.',
        stage: 'foundation',
        activityId: 'mcs:learn:mcs-foundations-signals',
      },
      {
        id: 'mcs-foundations-mechanisms',
        shortTitle: 'Separate',
        title: 'Unloading, augmentation, and total flow',
        minutes: 12,
        description:
          'Distinguish what each mechanism changes before meeting the device that delivers it.',
        stage: 'foundation',
        activityId: 'mcs:learn:mcs-foundations-mechanisms',
      },
      {
        id: 'iabp-timing-triggering',
        shortTitle: 'IABP timing',
        title: 'IABP timing and triggering',
        minutes: 12,
        description:
          'Place inflation and deflation against the native beat, and match the trigger to signal quality.',
        stage: 'mechanism',
        activityId: 'mcs:learn:iabp-timing-triggering',
      },
      {
        id: 'iabp-efficacy-limits',
        shortTitle: 'IABP limits',
        title: 'IABP efficacy, limits, and escalation',
        minutes: 12,
        description:
          'Read the assisted beat against the whole circulation and recognize the support ceiling.',
        stage: 'application',
        activityId: 'mcs:learn:iabp-efficacy-limits',
      },
      {
        id: 'impella-unloading-placement',
        shortTitle: 'Impella unloading',
        title: 'Impella unloading and placement signals',
        minutes: 12,
        description:
          'Relate performance level and transvalvular position to flow and actual LV unloading.',
        stage: 'mechanism',
        activityId: 'mcs:learn:impella-unloading-placement',
      },
      {
        id: 'impella-suction-purge-rv',
        shortTitle: 'Impella limits',
        title: 'Impella suction, purge, hemolysis, and RV delivery',
        minutes: 12,
        description: 'Work the conditions in which more support produces less effective flow.',
        stage: 'application',
        activityId: 'mcs:learn:impella-suction-purge-rv',
      },
      {
        id: 'lvad-parameters-assessment',
        shortTitle: 'LVAD review',
        title: 'Durable LVAD parameters and ICU review',
        minutes: 12,
        description: 'Read speed, flow, power, and pulsatility index as one interdependent set.',
        stage: 'mechanism',
        activityId: 'mcs:learn:lvad-parameters-assessment',
      },
      {
        id: 'lvad-alarms-emergencies',
        shortTitle: 'LVAD alarms',
        title: 'Durable LVAD low flow, high power, and power emergencies',
        minutes: 12,
        description:
          'Separate opposite loading causes of one low-flow display, and act on power emergencies.',
        stage: 'application',
        activityId: 'mcs:learn:lvad-alarms-emergencies',
      },
      {
        id: 'mcs-device-selection-integration',
        shortTitle: 'Choose',
        title: 'Choosing among IABP, Impella, and durable LVAD for a shock phenotype',
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
    arcSentence:
      'Learn to read a breath, then the mechanics behind it, then what the machine and the patient do to each other',
    sections: [
      {
        id: 'waveform-anatomy',
        shortTitle: 'Anatomy',
        title: 'Waveform anatomy: three traces, one breath',
        minutes: 8,
        description:
          'What pressure, flow, and volume each plot, what sets the shape of each — and why a volume-targeted breath and a pressure-targeted one look nothing alike.',
        stage: 'orientation',
        activityId: 'ventilation:learn:waveform-anatomy',
      },
      {
        id: 'mechanics-load-and-pressure',
        shortTitle: 'Mechanics',
        title: 'Mechanics: load, pressure, and volume',
        minutes: 8,
        description:
          'Separate the pressure spent moving gas from the pressure spent distending the respiratory system.',
        stage: 'foundation',
        activityId: 'ventilation:learn:mechanics-load-and-pressure',
      },
      {
        id: 'waveform-reading-sequence',
        shortTitle: 'Waveforms',
        title: 'Waveforms: a repeatable reading sequence',
        minutes: 8,
        description:
          'Read pressure, flow, volume, and patient effort in a fixed order before naming any pattern.',
        stage: 'foundation',
        activityId: 'ventilation:learn:waveform-reading-sequence',
      },
      {
        id: 'modes-and-breath-delivery',
        shortTitle: 'Modes',
        title: 'Modes: trigger, target, cycle, and expiration',
        minutes: 8,
        description:
          'Meet the device-facing controls after the physiology they act on, and read a mode by its four variables rather than its name.',
        stage: 'orientation',
        activityId: 'ventilation:learn:modes-and-breath-delivery',
      },
      {
        id: 'triggering-and-cycling',
        shortTitle: 'Timing',
        title: 'Triggering and cycling',
        minutes: 8,
        description:
          'Localize a timing problem to the start or the end of the breath before labelling it.',
        stage: 'mechanism',
        activityId: 'ventilation:learn:triggering-and-cycling',
      },
      {
        id: 'dyssynchrony-mechanisms',
        shortTitle: 'Dyssynchrony',
        title: 'Dyssynchrony: mechanism before label',
        minutes: 8,
        description:
          'State the mechanism and the expected response before applying a dyssynchrony name.',
        stage: 'mechanism',
        activityId: 'ventilation:learn:dyssynchrony-mechanisms',
      },
      {
        id: 'oxygenation-response',
        shortTitle: 'Oxygenation',
        title: 'Oxygenation: action and consequence',
        minutes: 8,
        description:
          'Predict the pressure and hemodynamic consequence of an oxygenation change, not only the saturation.',
        stage: 'mechanism',
        activityId: 'ventilation:learn:oxygenation-response',
      },
      {
        id: 'ventilation-and-co2',
        shortTitle: 'Ventilation',
        title: 'Ventilation: measured response over time',
        minutes: 8,
        description:
          'Separate what changes immediately at the ventilator from what changes later in the measurement.',
        stage: 'mechanism',
        activityId: 'ventilation:learn:ventilation-and-co2',
      },
      {
        id: 'safety-reassessment-and-human-factors',
        shortTitle: 'Safety',
        title: 'Safety, reassessment, and the whole patient',
        minutes: 8,
        description:
          'Keep alarms, examination, communication, comfort, and explicit reassessment inside the action loop.',
        stage: 'application',
        activityId: 'ventilation:learn:safety-reassessment-and-human-factors',
      },
      {
        id: 'high-peak-pressure-integration',
        shortTitle: 'Localize',
        title: 'High peak pressure: resistance, compliance, auto-PEEP, or patient effort?',
        minutes: 14,
        description:
          'One alarm, four mechanisms: use the peak-to-plateau split, the expiratory limb, and the patient to separate them.',
        stage: 'integration',
        activityId: 'ventilation:learn:high-peak-pressure-integration',
      },
    ],
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
    sections: [
      {
        id: 'why-extracorporeal-support',
        shortTitle: 'Why ECMO',
        title:
          'Why extracorporeal support: content, delivery, consumption, and the failure it addresses',
        minutes: 12,
        description:
          'Start from oxygen delivery and consumption, and name the specific failure extracorporeal support is being asked to correct.',
        stage: 'orientation',
        activityId: 'ecmo:learn:why-extracorporeal-support',
      },
      {
        id: 'circuit-flow-path',
        shortTitle: 'Flow path',
        title: 'Drainage → pump → membrane lung → return: the circuit as a flow path',
        minutes: 12,
        description:
          'Follow blood once through the circuit and name what each component can and cannot do.',
        stage: 'foundation',
        activityId: 'ecmo:learn:circuit-flow-path',
      },
      {
        id: 'pump-and-pressure-zones',
        shortTitle: 'Pump & pressures',
        title: 'Centrifugal pump preload and afterload, and the circuit pressure zones',
        minutes: 12,
        description:
          'A centrifugal pump is preload dependent and afterload sensitive; the pressure zones make that visible.',
        stage: 'foundation',
        activityId: 'ecmo:learn:pump-and-pressure-zones',
      },
      {
        id: 'blood-flow-versus-sweep',
        shortTitle: 'Flow vs sweep',
        title: 'Blood flow versus sweep: oxygen versus CO₂ transfer',
        minutes: 12,
        description:
          'Two controls with two different jobs, and the dissociation that several later sections are built on.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:blood-flow-versus-sweep',
      },
      {
        id: 'vv-normal-state',
        shortTitle: 'Normal VV',
        title: 'The normal VV patient–circuit state',
        minutes: 12,
        description:
          'A short statement of how the circuit sits relative to the patient, then the stable run every later section is read against.',
        stage: 'foundation',
        activityId: 'ecmo:learn:vv-normal-state',
      },
      {
        id: 'vv-series-physiology',
        shortTitle: 'Series & recirculation',
        title: 'VV series physiology, effective flow, and recirculation',
        minutes: 14,
        description:
          'Now that the stable state is known: the circuit sits in series with the patient, and part of what it pumps can be blood it just returned.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:vv-series-physiology',
      },
      {
        id: 'startup-sensor-orientation',
        shortTitle: 'Console tour',
        title: 'Console, circuit, and external-control orientation',
        minutes: 12,
        description: 'Meet the console after the physiology it operates on, not before it.',
        stage: 'orientation',
        activityId: 'ecmo:learn:startup-sensor-orientation',
      },
      {
        id: 'preload-drainage-collapse',
        shortTitle: 'Drainage',
        title: 'Preload-limited flow and drainage collapse',
        minutes: 12,
        description: 'Work a preload limit on the live circuit and watch the drainage zone answer.',
        stage: 'application',
        activityId: 'ecmo:learn:preload-drainage-collapse',
      },
      {
        id: 'afterload-return-obstruction',
        shortTitle: 'Return side',
        title: 'Return-side obstruction',
        minutes: 12,
        description: 'Localize a resistance change to the return pathway.',
        stage: 'application',
        activityId: 'ecmo:learn:afterload-return-obstruction',
      },
      {
        id: 'afterload-oxygenator-resistance',
        shortTitle: 'Membrane',
        title: 'Oxygenator resistance or dysfunction pattern',
        minutes: 12,
        description:
          'Separate a membrane problem from a return-side one by where the pressure moved.',
        stage: 'application',
        activityId: 'ecmo:learn:afterload-oxygenator-resistance',
      },
      {
        id: 'vv-recirculation',
        shortTitle: 'Recirculation',
        title: 'VV recirculation despite high displayed flow',
        minutes: 12,
        description:
          'Apply the effective-flow distinction to a run whose display looks reassuring.',
        stage: 'application',
        activityId: 'ecmo:learn:vv-recirculation',
      },
      {
        id: 'acute-hypercapnia',
        shortTitle: 'Acute CO₂',
        title: 'Acute hypercapnic acidemia',
        minutes: 12,
        description: 'Use the sweep-side control, and attend to the rate of correction.',
        stage: 'application',
        activityId: 'ecmo:learn:acute-hypercapnia',
      },
      {
        id: 'compensated-hypercapnia',
        shortTitle: 'Chronic CO₂',
        title: 'Compensated hypercapnia during maintenance',
        minutes: 12,
        description: 'Distinguish a compensated steady state from an acute change.',
        stage: 'application',
        activityId: 'ecmo:learn:compensated-hypercapnia',
      },
      {
        id: 'gas-source-interruption',
        shortTitle: 'Gas source',
        title: 'Gas-source interruption with preserved blood flow',
        minutes: 12,
        description: 'Work the failure that is silent with respect to the flow display.',
        stage: 'application',
        activityId: 'ecmo:learn:gas-source-interruption',
      },
      {
        id: 'arterial-bubble-stop',
        shortTitle: 'Air',
        title: 'Arterial bubble intervention and cause-before-reset',
        minutes: 12,
        description:
          'Isolate, correct the source, then resume per the current IFU and approved local protocol.',
        stage: 'application',
        activityId: 'ecmo:learn:arterial-bubble-stop',
      },
      {
        id: 'transport-power-loss',
        shortTitle: 'Transport',
        title: 'Transport power loss and backup readiness',
        minutes: 12,
        description: 'Maintain support and backup readiness through a power interruption.',
        stage: 'application',
        activityId: 'ecmo:learn:transport-power-loss',
      },
      {
        id: 'vv-integration-capstone',
        shortTitle: 'Integrate VV',
        title: 'VV integration: displayed flow unchanged, patient deteriorating',
        minutes: 18,
        description:
          'One presentation, four circuit explanations: use the pressure zones, the gas side, and the patient to separate them.',
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
        title:
          'Why extracorporeal support: content, delivery, consumption, and the failure it addresses',
        minutes: 12,
        description:
          'Start from oxygen delivery and consumption, and name the specific failure extracorporeal support is being asked to correct.',
        stage: 'orientation',
        activityId: 'ecmo:learn:why-extracorporeal-support',
      },
      {
        id: 'circuit-flow-path',
        shortTitle: 'Flow path',
        title: 'Drainage → pump → membrane lung → return: the circuit as a flow path',
        minutes: 12,
        description:
          'Follow blood once through the circuit and name what each component can and cannot do.',
        stage: 'foundation',
        activityId: 'ecmo:learn:circuit-flow-path',
      },
      {
        id: 'pump-and-pressure-zones',
        shortTitle: 'Pump & pressures',
        title: 'Centrifugal pump preload and afterload, and the circuit pressure zones',
        minutes: 12,
        description:
          'A centrifugal pump is preload dependent and afterload sensitive; the pressure zones make that visible.',
        stage: 'foundation',
        activityId: 'ecmo:learn:pump-and-pressure-zones',
      },
      {
        id: 'blood-flow-versus-sweep',
        shortTitle: 'Flow vs sweep',
        title: 'Blood flow versus sweep: oxygen versus CO₂ transfer',
        minutes: 12,
        description:
          'Two controls with two different jobs, and the dissociation that several later sections are built on.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:blood-flow-versus-sweep',
      },
      {
        id: 'va-normal-state',
        shortTitle: 'Normal VA',
        title: 'The normal VA patient–circuit state',
        minutes: 12,
        description:
          'A short statement of how the circuit sits relative to the patient, then the stable run, including the signals that exist only because the circulations are in parallel.',
        stage: 'foundation',
        activityId: 'ecmo:learn:va-normal-state',
      },
      {
        id: 'va-parallel-physiology',
        shortTitle: 'Parallel & loading',
        title: 'VA parallel circulation, LV loading, and differential oxygenation',
        minutes: 14,
        description:
          'Now that the stable state is known: the circuit runs in parallel with the heart, and the two circulations compete for the same aorta.',
        stage: 'mechanism',
        activityId: 'ecmo:learn:va-parallel-physiology',
      },
      {
        id: 'va-startup-sensor-orientation',
        shortTitle: 'Console tour',
        title: 'VA console, femoral circuit, and independent-monitor orientation',
        minutes: 12,
        description: 'Meet the console after the physiology it operates on, not before it.',
        stage: 'orientation',
        activityId: 'ecmo:learn:va-startup-sensor-orientation',
      },
      {
        id: 'va-preload-drainage-collapse',
        shortTitle: 'Drainage',
        title: 'VA preload-limited drainage and falling systemic support',
        minutes: 12,
        description:
          'Work a preload limit where falling flow also means falling circulatory support.',
        stage: 'application',
        activityId: 'ecmo:learn:va-preload-drainage-collapse',
      },
      {
        id: 'va-afterload-arterial-return-obstruction',
        shortTitle: 'Return side',
        title: 'VA arterial-return resistance',
        minutes: 12,
        description: 'Localize resistance on the arterial return pathway.',
        stage: 'application',
        activityId: 'ecmo:learn:va-afterload-arterial-return-obstruction',
      },
      {
        id: 'va-afterload-oxygenator-resistance',
        shortTitle: 'Membrane',
        title: 'VA oxygenator resistance pattern',
        minutes: 12,
        description: 'Separate a membrane problem from an arterial-return one.',
        stage: 'application',
        activityId: 'ecmo:learn:va-afterload-oxygenator-resistance',
      },
      {
        id: 'va-differential-hypoxemia',
        shortTitle: 'Differential',
        title: 'Peripheral VA differential upper-body oxygenation',
        minutes: 12,
        description: 'Apply the mixing watershed to a recovering heart.',
        stage: 'application',
        activityId: 'ecmo:learn:va-differential-hypoxemia',
      },
      {
        id: 'va-lv-loading',
        shortTitle: 'LV loading',
        title: 'VA LV-loading recognition',
        minutes: 12,
        description:
          'Recognize distension against arterial return before it becomes a pulmonary problem.',
        stage: 'application',
        activityId: 'ecmo:learn:va-lv-loading',
      },
      {
        id: 'va-acute-hypercapnia',
        shortTitle: 'Sweep',
        title: 'VA phase-aware sweep adjustment',
        minutes: 12,
        description: 'Adjust the CO₂ control with the phase of the run in mind.',
        stage: 'application',
        activityId: 'ecmo:learn:va-acute-hypercapnia',
      },
      {
        id: 'va-gas-source-interruption',
        shortTitle: 'Gas source',
        title: 'VA gas-source interruption with continued arterial flow',
        minutes: 12,
        description: 'Work the silent gas-side failure while circulatory support continues.',
        stage: 'application',
        activityId: 'ecmo:learn:va-gas-source-interruption',
      },
      {
        id: 'va-arterial-bubble-stop',
        shortTitle: 'Air',
        title: 'VA arterial-return bubble and cause-before-reset',
        minutes: 12,
        description:
          'Isolate, correct the source, then resume per the current IFU and approved local protocol.',
        stage: 'application',
        activityId: 'ecmo:learn:va-arterial-bubble-stop',
      },
      {
        id: 'va-transport-power-loss',
        shortTitle: 'Transport',
        title: 'VA transport power loss and circulatory backup',
        minutes: 12,
        description:
          'Maintain circulatory support and backup readiness through a power interruption.',
        stage: 'application',
        activityId: 'ecmo:learn:va-transport-power-loss',
      },
      {
        id: 'va-integration-capstone',
        shortTitle: 'Integrate VA',
        title: 'VA integration: displayed flow unchanged, patient deteriorating',
        minutes: 18,
        description:
          'The same unchanged flow display, with native-circuit competition added to the differential.',
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
