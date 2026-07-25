import type { CriticalCareCatalogModuleId } from './modules'

export type CriticalCareThreadId =
  | 'thread.rv-failure'
  | 'thread.heart-lung-interaction'
  | 'thread.measurement-validity'

export interface CriticalCareConcept {
  readonly id: string
  readonly title: string
  readonly shortExplanation: string
  readonly relatedConceptIds: readonly string[]
  readonly threadId?: CriticalCareThreadId
  readonly evidenceIds: readonly string[]
  readonly reviewStatus: 'draft' | 'sme-review' | 'released'
}

const concept = (definition: CriticalCareConcept): CriticalCareConcept => Object.freeze(definition)

/**
 * Shared concepts are deliberately broader than device-specific lesson topics. They are the
 * connective layer used by search, inline refreshers, feedback, and cross-module callbacks.
 */
export const criticalCareConcepts: readonly CriticalCareConcept[] = Object.freeze([
  concept({
    id: 'cc.measurement.measurand',
    title: 'Name the measurand',
    shortExplanation:
      'A displayed value is meaningful only when you can name what was actually measured. The sensor, sampling site, timing, and units define the measurand. Start there before assigning a physiologic interpretation.',
    relatedConceptIds: [
      'cc.measurement.reference-and-zero',
      'cc.measurement.measured-estimated-inferred',
    ],
    threadId: 'thread.measurement-validity',
    evidenceIds: ['arterial-pressure-five-step-2020'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.measurement.reference-and-zero',
    title: 'Reference, level, and zero',
    shortExplanation:
      'Pressure is measured relative to a reference. A misplaced level adds a hydrostatic offset, while a misplaced zero shifts the entire signal. Validate both before treating an unexpected number as a patient change.',
    relatedConceptIds: ['cc.measurement.measurand', 'cc.measurement.signal-validity'],
    threadId: 'thread.measurement-validity',
    evidenceIds: ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.measurement.signal-validity',
    title: 'Signal validity before interpretation',
    shortExplanation:
      'A precise display can still represent a poor signal. Check the measurement chain, waveform shape, timing, and agreement with independent observations. Interpretation should wait until the signal is usable for the question being asked.',
    relatedConceptIds: [
      'cc.measurement.reference-and-zero',
      'cc.measurement.trends-and-perturbations',
    ],
    threadId: 'thread.measurement-validity',
    evidenceIds: ['arterial-pressure-five-step-2020', 'pac-waveforms-part-1-2021'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.measurement.measured-estimated-inferred',
    title: 'Measured, estimated, and inferred',
    shortExplanation:
      'Measured values come directly from a sensor, estimated values depend on an algorithm, and inferred states depend on clinical reasoning. Those three layers carry different uncertainty. Keep the label visible so an estimate is not mistaken for a direct observation.',
    relatedConceptIds: ['cc.measurement.measurand', 'cc.device.selected-vs-delivered-support'],
    threadId: 'thread.measurement-validity',
    evidenceIds: ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.measurement.trends-and-perturbations',
    title: 'Trends and small perturbations',
    shortExplanation:
      'A trend often carries more information than a single value. A small, reversible change can probe whether the system responds in the direction your model predicts. Reassess several convergent signals rather than declaring success from one number.',
    relatedConceptIds: [
      'cc.measurement.signal-validity',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
    threadId: 'thread.measurement-validity',
    evidenceIds: ['esicm-shock-2025', 'icu-hemodynamics-model-v1'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.flow.pressure-gradient',
    title: 'Pressure gradient drives flow',
    shortExplanation:
      'Flow requires a pressure difference between a source and a destination. The absolute pressure at either end is not enough by itself. Ask where the gradient begins, where it ends, and whether the path between them has changed.',
    relatedConceptIds: [
      'cc.flow.resistance-and-impedance',
      'cc.device.source-active-component-destination',
    ],
    evidenceIds: ['pac-derived-part-2-2021'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.flow.resistance-and-impedance',
    title: 'Resistance and impedance',
    shortExplanation:
      'Resistance describes opposition to steady flow, while impedance also reflects pulsatility, compliance, and inertial effects. A higher opposing load can reduce flow even when the driving setting is unchanged. Use the simpler resistance model only when it answers the question without hiding important dynamics.',
    relatedConceptIds: ['cc.flow.pressure-gradient', 'cc.device.preload-afterload-dependence'],
    evidenceIds: ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.flow.transmural-pressure',
    title: 'Transmural pressure',
    shortExplanation:
      'Transmural pressure is the pressure inside a structure minus the pressure surrounding it. Changes in pleural or pericardial pressure can therefore change loading even when an intravascular display barely moves. This is why ventilation and circulation must be interpreted together.',
    relatedConceptIds: ['cc.flow.venous-return', 'cc.flow.rv-lv-coupling'],
    threadId: 'thread.heart-lung-interaction',
    evidenceIds: ['pac-derived-part-2-2021', 'tobin-3e-peep'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.flow.venous-return',
    title: 'Venous return',
    shortExplanation:
      'Venous return depends on a pressure gradient into the right heart and the resistance along that path. Volume, vascular tone, intrathoracic pressure, and downstream right-sided pressure all modify it. A device that draws from the venous side is especially sensitive to this balance.',
    relatedConceptIds: ['cc.flow.pressure-gradient', 'cc.device.preload-afterload-dependence'],
    threadId: 'thread.heart-lung-interaction',
    evidenceIds: ['pac-derived-part-2-2021', 'ecmo-book-ch17'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.flow.rv-lv-coupling',
    title: 'Right-left ventricular coupling',
    shortExplanation:
      'The ventricles share the septum, pericardial space, and a series circulation. A change in right-sided loading can alter left-sided filling and output, and the reverse is also true. Interpret either ventricle in the context of the other and of intrathoracic pressure.',
    relatedConceptIds: ['cc.flow.transmural-pressure', 'cc.perfusion.cardiac-output'],
    threadId: 'thread.rv-failure',
    evidenceIds: ['esicm-shock-2025', 'pac-derived-part-2-2021'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.perfusion.cardiac-output',
    title: 'Cardiac output and effective flow',
    shortExplanation:
      'Cardiac output is flow generated by the native circulation, but a displayed device flow may contribute a separate stream. Effective systemic flow depends on how those streams interact and where they travel. Always connect the flow number to perfusion rather than treating it as an endpoint.',
    relatedConceptIds: [
      'cc.device.native-device-effective-flow',
      'cc.perfusion.oxygen-delivery-extraction',
    ],
    evidenceIds: ['pac-derived-part-2-2021', 'mcs-bedside-reference-supplied'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.perfusion.oxygen-content',
    title: 'Oxygen content',
    shortExplanation:
      'Oxygen content is carried mainly by hemoglobin-bound oxygen, with a smaller dissolved component. Saturation alone therefore does not describe the amount of oxygen in blood. Interpret it alongside hemoglobin and the relevant blood compartment.',
    relatedConceptIds: ['cc.perfusion.oxygen-delivery-extraction', 'cc.membrane.gas-exchange'],
    evidenceIds: ['elso-adult-vv-2021'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.perfusion.oxygen-delivery-extraction',
    title: 'Oxygen delivery and extraction',
    shortExplanation:
      'Oxygen delivery combines blood flow with arterial oxygen content. Tissue extraction and consumption determine what remains in venous blood. A change in saturation, flow, or hemoglobin can therefore shift delivery through different mechanisms.',
    relatedConceptIds: ['cc.perfusion.oxygen-content', 'cc.perfusion.cardiac-output'],
    evidenceIds: ['esicm-shock-2025', 'elso-adult-vv-2021'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.perfusion.macro-micro-coherence',
    title: 'Macro- and microcirculatory coherence',
    shortExplanation:
      'Normalized global pressure or flow does not guarantee that tissue perfusion has recovered. Microcirculatory and organ-level responses can remain abnormal despite improved macroscopic numbers. Reassessment should include the patient, not only the support display.',
    relatedConceptIds: [
      'cc.perfusion.oxygen-delivery-extraction',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
    evidenceIds: ['esicm-shock-2025'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.ventilation.equation-of-motion',
    title: 'Equation of motion',
    shortExplanation:
      'Airway pressure reflects elastic load, resistive load, applied end-expiratory pressure, and patient effort. Separating those terms helps explain why the same peak pressure can arise from different problems. The model is a reasoning tool, not a complete description of a living respiratory system.',
    relatedConceptIds: ['cc.flow.resistance-and-impedance', 'cc.ventilation.breath-variables'],
    threadId: 'thread.heart-lung-interaction',
    evidenceIds: ['tobin-3e-setting-ventilator', 'bounded-ventilation-model'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.ventilation.breath-variables',
    title: 'Trigger, target, and cycle',
    shortExplanation:
      'A mechanical breath begins with a trigger, is governed by a target or control variable, and ends by a cycling rule. Naming those variables is more reliable than relying on a mode label alone. Patient effort can interact with each phase and change what is actually delivered.',
    relatedConceptIds: [
      'cc.ventilation.equation-of-motion',
      'cc.ventilation.patient-device-interaction',
    ],
    evidenceIds: ['tobin-3e-setting-ventilator', 'antonogiannaki-dyssynchrony-2017'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.ventilation.patient-device-interaction',
    title: 'Patient-ventilator interaction',
    shortExplanation:
      'The patient and ventilator form one coupled system. Trigger delay, flow mismatch, cycling mismatch, and excess or insufficient assist produce different bedside and waveform cues. Identify the phase of mismatch before changing a setting.',
    relatedConceptIds: [
      'cc.ventilation.breath-variables',
      'cc.troubleshooting.localize-before-intervene',
    ],
    threadId: 'thread.heart-lung-interaction',
    evidenceIds: ['antonogiannaki-dyssynchrony-2017', 'tobin-3e-fighting-ventilator'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.device.source-active-component-destination',
    title: 'Source, active component, destination',
    shortExplanation:
      'Every support circuit can be traced from a source, through an active component, to a destination. That path identifies what fills the device, what adds energy or transport, and where supported flow returns. Draw the path before interpreting a device problem.',
    relatedConceptIds: ['cc.flow.pressure-gradient', 'cc.device.patient-device-coupling'],
    evidenceIds: ['mcs-bedside-reference-supplied', 'ecmo-book-ch9'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.device.preload-afterload-dependence',
    title: 'Preload and afterload dependence',
    shortExplanation:
      'Many support devices deliver less flow when inflow is inadequate or outflow resistance rises. Increasing a control setting cannot overcome every loading problem and may add risk. Localize whether the limitation is before or after the active component.',
    relatedConceptIds: [
      'cc.flow.venous-return',
      'cc.troubleshooting.inflow-pre-pump',
      'cc.troubleshooting.outflow-post-pump',
    ],
    evidenceIds: ['mcs-bedside-reference-supplied', 'ecmo-book-ch17'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.device.selected-vs-delivered-support',
    title: 'Selected versus delivered support',
    shortExplanation:
      'The selected setting is an instruction, not proof of what the patient receives. Loading conditions, circuit resistance, control logic, interruptions, and measurement error can separate the selected value from delivered support. Compare the setting, display, independent signals, and patient response.',
    relatedConceptIds: [
      'cc.measurement.measured-estimated-inferred',
      'cc.device.native-device-effective-flow',
    ],
    evidenceIds: ['mcs-bedside-reference-supplied', 'ifu-console-workflow'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.device.native-device-effective-flow',
    title: 'Native, device, and effective flow',
    shortExplanation:
      'Native cardiac flow and device flow may add, compete, recirculate, or reach different vascular territories. The arithmetic sum is not automatically effective systemic flow. Use anatomy and perfusion signals to determine where each stream actually goes.',
    relatedConceptIds: ['cc.perfusion.cardiac-output', 'cc.device.selected-vs-delivered-support'],
    evidenceIds: ['mcs-bedside-reference-supplied', 'elso-adult-va-2021'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.device.normal-patient-device-state',
    title: 'Normal patient-device state',
    shortExplanation:
      'Troubleshooting begins with a clear picture of the expected patient, circuit, display, and flow direction. Without that baseline, normal variation can look like failure and abnormal coupling can be missed. Reconstruct the normal state before chasing an alarm.',
    relatedConceptIds: [
      'cc.device.source-active-component-destination',
      'cc.troubleshooting.localize-before-intervene',
    ],
    evidenceIds: ['mcs-bedside-reference-supplied', 'ifu-console-workflow'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.device.patient-device-coupling',
    title: 'Patient-device coupling',
    shortExplanation:
      "A device changes the patient, and the patient's loading conditions change the device. The same display finding can therefore arise from patient physiology, circuit mechanics, or both. Examine the coupled system with independent observations and a causal sequence.",
    relatedConceptIds: ['cc.device.preload-afterload-dependence', 'cc.troubleshooting.patient'],
    evidenceIds: ['mcs-bedside-reference-supplied', 'bounded-educational-model'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.membrane.diffusion',
    title: 'Diffusion',
    shortExplanation:
      'Diffusion moves solute down a concentration gradient across a membrane. Small-solute transfer depends on the gradient, membrane properties, and the blood and dialysate flows that maintain it. It is distinct from bulk solvent movement.',
    relatedConceptIds: ['cc.membrane.convection', 'cc.membrane.ultrafiltration'],
    evidenceIds: ['REVIEW-CKRT-CORE-2025'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.membrane.convection',
    title: 'Convection',
    shortExplanation:
      'Convection carries dissolved solute with solvent moving across a membrane. The amount transported depends on ultrafiltration and how freely the solute crosses. Predilution and postdilution change concentration and circuit conditions even when the prescribed flow looks similar.',
    relatedConceptIds: ['cc.membrane.diffusion', 'cc.membrane.ultrafiltration'],
    evidenceIds: ['REVIEW-CKRT-CORE-2025'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.membrane.ultrafiltration',
    title: 'Ultrafiltration',
    shortExplanation:
      'Ultrafiltration is solvent movement across a semipermeable membrane driven by a pressure relationship. Machine fluid removal and total effluent are related but not interchangeable ideas. Keep the circuit ledger separate from the whole-patient fluid ledger.',
    relatedConceptIds: ['cc.membrane.convection', 'cc.circuit.pressure-zones'],
    evidenceIds: ['REVIEW-CKRT-CORE-2025', 'FLUID-PM-001'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.membrane.gas-exchange',
    title: 'Membrane gas exchange',
    shortExplanation:
      'An extracorporeal gas exchanger transfers oxygen and carbon dioxide across a membrane. Blood flow, sweep gas, membrane performance, inlet conditions, and recirculation affect different parts of that exchange. Change the variable tied to the mechanism you are trying to influence.',
    relatedConceptIds: ['cc.perfusion.oxygen-content', 'cc.membrane.resistance-and-aging'],
    evidenceIds: ['ecmo-book-ch18', 'elso-circuit-2022'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.membrane.resistance-and-aging',
    title: 'Membrane resistance and aging',
    shortExplanation:
      'Deposits, clot, and changing membrane properties can raise resistance or reduce transport performance over time. Pressure trends and gas-transfer trends answer related but different questions. Interpret both in the context of blood flow, sampling, and circuit age.',
    relatedConceptIds: ['cc.membrane.gas-exchange', 'cc.troubleshooting.exchanger-filter'],
    evidenceIds: ['elso-circuit-2022', 'DEV-PM-010'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.circuit.pressure-zones',
    title: 'Circuit pressure zones',
    shortExplanation:
      'Pressure changes sign and magnitude as blood or fluid moves through access, tubing, a pump, a filter or exchanger, and return. The location of a trend change helps localize where resistance or inflow has changed. Use circuit order and flow direction, not a memorized isolated number.',
    relatedConceptIds: [
      'cc.device.source-active-component-destination',
      'cc.troubleshooting.localize-before-intervene',
    ],
    evidenceIds: ['ecmo-book-ch9', 'DEV-PM-009', 'DEV-PM-010'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.circuit.recirculation',
    title: 'Recirculation',
    shortExplanation:
      'Recirculation occurs when supported return is drawn back into a drainage path instead of reaching the intended patient circulation. A high displayed circuit flow can coexist with limited effective support. Anatomy, access position, flow, and paired saturation signals help distinguish it.',
    relatedConceptIds: ['cc.device.native-device-effective-flow', 'cc.flow.venous-return'],
    evidenceIds: ['ecmo-book-ch17', 'elso-adult-vv-2021'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.circuit.prescribed-vs-delivered-dose',
    title: 'Prescribed versus delivered therapy',
    shortExplanation:
      'A prescription describes intended therapy, while interruptions and circuit conditions determine what is delivered. Downtime, flow changes, and replacement configuration can create a meaningful gap. Review the delivered ledger before changing a prescription solely because the expected effect is absent.',
    relatedConceptIds: [
      'cc.device.selected-vs-delivered-support',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
    evidenceIds: ['DOSE-PM-001', 'REVIEW-CKRT-CORE-2025'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.localize-before-intervene',
    title: 'Localize before intervening',
    shortExplanation:
      'Begin troubleshooting by naming the failing function and locating the most likely region of the system. A premature corrective action can erase a diagnostic cue or worsen the underlying problem. Use patient, measurement, inflow, active component, outflow, and exchanger or fluid-path checks in order.',
    relatedConceptIds: [
      'cc.device.normal-patient-device-state',
      'cc.troubleshooting.reassess-convergent-signals',
    ],
    evidenceIds: ['mcs-bedside-reference-supplied', 'ICU-SCENARIO-MODEL'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.patient',
    title: 'Patient-side cause',
    shortExplanation:
      'A deteriorating patient can make a functioning device look inadequate. Reconstruct perfusion, loading, gas exchange, bleeding, rhythm, and other bedside changes alongside the device display. Never let an alarm narrow the review to the machine alone.',
    relatedConceptIds: ['cc.device.patient-device-coupling', 'cc.perfusion.macro-micro-coherence'],
    evidenceIds: ['esicm-shock-2025', 'mcs-bedside-reference-supplied'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.measurement-sensor',
    title: 'Measurement or sensor cause',
    shortExplanation:
      'A sensor problem can create a convincing but false change. Check reference, calibration, position, waveform quality, sampling conditions, and independent signals before acting. Correcting the measurement chain is itself a clinical safety action.',
    relatedConceptIds: ['cc.measurement.signal-validity', 'cc.measurement.reference-and-zero'],
    threadId: 'thread.measurement-validity',
    evidenceIds: ['arterial-pressure-five-step-2020', 'ifu-console-workflow'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.access-position',
    title: 'Access and position cause',
    shortExplanation:
      'Access position determines what enters or leaves a support circuit and what a catheter samples. Migration, contact, kinking, or patient position can change both flow and signal quality. Reconcile anatomy, waveform, pressures, and imaging or other independent confirmation.',
    relatedConceptIds: [
      'cc.device.source-active-component-destination',
      'cc.troubleshooting.inflow-pre-pump',
    ],
    evidenceIds: ['edwards-swan-ganz-ifu-2023', 'mcs-bedside-reference-supplied'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.inflow-pre-pump',
    title: 'Inflow or pre-pump cause',
    shortExplanation:
      'Inadequate inflow limits what an active component can deliver. Look for changes in venous return, access position, obstruction, collapse, and pre-pump pressure behavior. Increasing speed without restoring inflow may intensify the problem.',
    relatedConceptIds: ['cc.device.preload-afterload-dependence', 'cc.flow.venous-return'],
    evidenceIds: ['ecmo-book-ch17', 'mcs-bedside-reference-supplied'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.active-component',
    title: 'Active-component cause',
    shortExplanation:
      'The pump, controller, ventilator, or other active component may stop producing the intended work. Confirm power, control mode, setting, coupling, and the component-specific display before attributing the finding to the patient. Keep an independent support and emergency plan available.',
    relatedConceptIds: [
      'cc.device.source-active-component-destination',
      'cc.troubleshooting.controller-power',
    ],
    evidenceIds: ['ifu-console-workflow', 'mcs-bedside-reference-supplied'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.outflow-post-pump',
    title: 'Outflow or post-pump cause',
    shortExplanation:
      'A downstream obstruction or rising afterload can reduce delivered flow and raise pressures after the active component. Trace the circuit toward its destination and compare upstream with downstream changes. Accurate localization prevents an inflow problem from being treated as an outflow problem.',
    relatedConceptIds: ['cc.device.preload-afterload-dependence', 'cc.circuit.pressure-zones'],
    evidenceIds: ['ecmo-book-ch9', 'mcs-bedside-reference-supplied'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.exchanger-filter',
    title: 'Exchanger or filter cause',
    shortExplanation:
      'A filter or exchanger can develop rising resistance, impaired transport, or both. Pressure-drop trends help with resistance, while paired blood or fluid measurements help with transfer performance. Sampling error and changing flow must be excluded before declaring component failure.',
    relatedConceptIds: ['cc.membrane.resistance-and-aging', 'cc.circuit.pressure-zones'],
    evidenceIds: ['elso-circuit-2022', 'DEV-PM-010'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.gas-fluid-path',
    title: 'Gas or fluid-path cause',
    shortExplanation:
      'Some support functions depend on a separate gas, dialysate, replacement, effluent, or purge path. A problem there can change transport even when the blood path appears intact. Trace source, connection, direction, and delivery for the secondary path.',
    relatedConceptIds: ['cc.membrane.gas-exchange', 'cc.circuit.prescribed-vs-delivered-dose'],
    evidenceIds: ['ifu-console-workflow', 'DEV-PM-009'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.controller-power',
    title: 'Controller and power cause',
    shortExplanation:
      'Power source, battery state, cables, controller mode, and backup readiness are part of the support circuit. A display can remain visible while support is degraded or at risk. Verify the power path and follow current device instructions and local emergency procedures.',
    relatedConceptIds: [
      'cc.troubleshooting.active-component',
      'cc.device.normal-patient-device-state',
    ],
    evidenceIds: ['ifu-console-workflow', 'fda-heartmate-power-cord-2025-recall'],
    reviewStatus: 'sme-review',
  }),
  concept({
    id: 'cc.troubleshooting.reassess-convergent-signals',
    title: 'Reassess convergent signals',
    shortExplanation:
      'After an intervention, return to the original goal and examine several independent signals. A mechanism is more credible when patient findings, measurements, and device behavior move coherently. If they diverge, reopen localization instead of forcing the original explanation.',
    relatedConceptIds: [
      'cc.measurement.trends-and-perturbations',
      'cc.troubleshooting.localize-before-intervene',
    ],
    evidenceIds: ['esicm-shock-2025', 'ICU-SCENARIO-MODEL'],
    reviewStatus: 'sme-review',
  }),
])

export const criticalCareConceptById: ReadonlyMap<string, CriticalCareConcept> = new Map(
  criticalCareConcepts.map((item) => [item.id, item]),
)

const moduleFoundationConcepts: Readonly<Record<CriticalCareCatalogModuleId, readonly string[]>> = {
  'icu-hemodynamics': [
    'cc.measurement.signal-validity',
    'cc.flow.pressure-gradient',
    'cc.perfusion.cardiac-output',
  ],
  'mechanical-ventilation': [
    'cc.ventilation.equation-of-motion',
    'cc.ventilation.breath-variables',
    'cc.flow.transmural-pressure',
  ],
  'mechanical-circulatory-support': [
    'cc.device.source-active-component-destination',
    'cc.device.selected-vs-delivered-support',
    'cc.device.patient-device-coupling',
  ],
  'cardiohelp-ecmo': [
    'cc.device.source-active-component-destination',
    'cc.circuit.pressure-zones',
    'cc.membrane.gas-exchange',
  ],
  'baxter-crrt': ['cc.membrane.diffusion', 'cc.membrane.convection', 'cc.membrane.ultrafiltration'],
  'icu-simulation': [
    'cc.troubleshooting.localize-before-intervene',
    'cc.perfusion.macro-micro-coherence',
    'cc.troubleshooting.reassess-convergent-signals',
  ],
}

const modulePracticeConcepts: Readonly<Record<CriticalCareCatalogModuleId, readonly string[]>> = {
  'icu-hemodynamics': [
    'cc.troubleshooting.measurement-sensor',
    'cc.flow.rv-lv-coupling',
    'cc.troubleshooting.reassess-convergent-signals',
  ],
  'mechanical-ventilation': [
    'cc.ventilation.patient-device-interaction',
    'cc.troubleshooting.localize-before-intervene',
    'cc.flow.transmural-pressure',
  ],
  'mechanical-circulatory-support': [
    'cc.device.native-device-effective-flow',
    'cc.device.preload-afterload-dependence',
    'cc.troubleshooting.localize-before-intervene',
  ],
  'cardiohelp-ecmo': [
    'cc.circuit.recirculation',
    'cc.device.preload-afterload-dependence',
    'cc.troubleshooting.localize-before-intervene',
  ],
  'baxter-crrt': [
    'cc.circuit.prescribed-vs-delivered-dose',
    'cc.circuit.pressure-zones',
    'cc.troubleshooting.localize-before-intervene',
  ],
  'icu-simulation': [
    'cc.troubleshooting.patient',
    'cc.device.patient-device-coupling',
    'cc.troubleshooting.reassess-convergent-signals',
  ],
}

const keywordConcepts: readonly {
  readonly pattern: RegExp
  readonly conceptIds: readonly string[]
}[] = [
  {
    pattern: /signal|zero|level|artifact|waveform|sensor|measurement/i,
    conceptIds: ['cc.measurement.signal-validity'],
  },
  {
    pattern: /right ventr|rv |pulmonary|tamponade|pericard/i,
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.flow.transmural-pressure'],
  },
  {
    pattern: /oxygen|hypox|saturation|gas exchange/i,
    conceptIds: ['cc.perfusion.oxygen-content', 'cc.perfusion.oxygen-delivery-extraction'],
  },
  {
    pattern: /trigger|cycle|dyssynchron|breath/i,
    conceptIds: ['cc.ventilation.breath-variables', 'cc.ventilation.patient-device-interaction'],
  },
  {
    pattern: /pressure|resistance|afterload/i,
    conceptIds: ['cc.flow.pressure-gradient', 'cc.flow.resistance-and-impedance'],
  },
  {
    pattern: /preload|suction|inflow|drainage|venous return/i,
    conceptIds: ['cc.device.preload-afterload-dependence', 'cc.troubleshooting.inflow-pre-pump'],
  },
  {
    pattern: /recircul/i,
    conceptIds: ['cc.circuit.recirculation'],
  },
  {
    pattern: /sweep|membrane|oxygenator/i,
    conceptIds: ['cc.membrane.gas-exchange', 'cc.membrane.resistance-and-aging'],
  },
  {
    pattern: /filter|effluent|dose|downtime/i,
    conceptIds: ['cc.circuit.prescribed-vs-delivered-dose', 'cc.troubleshooting.exchanger-filter'],
  },
  {
    pattern: /fluid|ultrafiltration/i,
    conceptIds: ['cc.membrane.ultrafiltration'],
  },
  {
    pattern: /power|battery|controller|transport/i,
    conceptIds: ['cc.troubleshooting.controller-power'],
  },
]

function uniqueConceptIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)]
}

const conceptOrderById = new Map(
  criticalCareConcepts.map((definition, index) => [definition.id, index]),
)

export function criticalCareConceptMetadataForActivity(input: {
  readonly moduleId: CriticalCareCatalogModuleId
  readonly section: 'learn' | 'practice' | 'assess'
  readonly title: string
  readonly description: string
}): {
  readonly teachesConceptIds: readonly string[]
  readonly assumedConceptIds: readonly string[]
} {
  const searchable = `${input.title} ${input.description}`
  const keywordMatches = keywordConcepts.flatMap(({ pattern, conceptIds }) =>
    pattern.test(searchable) ? conceptIds : [],
  )
  const moduleDefaults =
    input.section === 'learn'
      ? moduleFoundationConcepts[input.moduleId]
      : modulePracticeConcepts[input.moduleId]
  const teachesConceptIds = uniqueConceptIds([...keywordMatches, ...moduleDefaults]).slice(0, 5)

  if (input.section === 'learn') {
    return { teachesConceptIds, assumedConceptIds: [] }
  }

  const assumedCandidates: Readonly<Record<CriticalCareCatalogModuleId, readonly string[]>> = {
    'icu-hemodynamics': [
      'cc.measurement.signal-validity',
      'cc.flow.pressure-gradient',
      'cc.perfusion.cardiac-output',
    ],
    'mechanical-ventilation': [
      'cc.ventilation.equation-of-motion',
      'cc.ventilation.breath-variables',
    ],
    'mechanical-circulatory-support': [
      'cc.device.source-active-component-destination',
      'cc.device.selected-vs-delivered-support',
    ],
    'cardiohelp-ecmo': [
      'cc.device.source-active-component-destination',
      'cc.circuit.pressure-zones',
    ],
    'baxter-crrt': [
      'cc.membrane.diffusion',
      'cc.membrane.convection',
      'cc.membrane.ultrafiltration',
    ],
    'icu-simulation': [
      'cc.measurement.signal-validity',
      'cc.troubleshooting.localize-before-intervene',
    ],
  }

  const earliestTaughtOrder = Math.min(
    ...teachesConceptIds.map(
      (conceptId) => conceptOrderById.get(conceptId) ?? Number.MAX_SAFE_INTEGER,
    ),
  )

  return {
    teachesConceptIds,
    assumedConceptIds: assumedCandidates[input.moduleId].filter(
      (conceptId) =>
        !teachesConceptIds.includes(conceptId) &&
        (conceptOrderById.get(conceptId) ?? Number.MAX_SAFE_INTEGER) < earliestTaughtOrder,
    ),
  }
}
