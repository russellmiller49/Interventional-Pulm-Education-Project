import type {
  EcmoChannelReadout,
  EcmoSimulationState,
  FaultId,
  PatientState,
} from '../../../engine/types'
import {
  draftPanelFor,
  faultState,
  liveNumber,
  livePercent,
  type DraftDrillPanelConfig,
} from './DraftDrillPanel'
import {
  UNAVAILABLE_INDICATION,
  channelSignalRow,
  offConsoleSignalRow,
  valueSignalRow,
  type DrillPatternRow,
  type DrillSignalRow,
} from './drillPanelPrimitives'

export type RemainingVvDrillId =
  | 'afterload-return-obstruction'
  | 'afterload-oxygenator-resistance'
  | 'acute-hypercapnia'
  | 'compensated-hypercapnia'
  | 'transport-power-loss'

function displayedPressure(readout: EcmoChannelReadout): string {
  return readout.displayed === null ? UNAVAILABLE_INDICATION : liveNumber(readout.displayed, 'mmHg')
}

function workOfBreathingLabel(value: PatientState['workOfBreathing']): string {
  if (value === 'high') return 'Marked observed effort'
  if (value === 'moderate') return 'Moderate observed effort'
  return 'Low observed effort'
}

function powerSourceLabel(state: EcmoSimulationState): string {
  return state.device.powerSource === 'ac' ? 'AC mains' : 'Internal battery'
}

function pumpStateLabel(state: EcmoSimulationState): string {
  return state.device.pumpRunning ? 'Pump running' : 'Pump stopped'
}

function modeledCauseStatus(
  state: EcmoSimulationState,
  fault: FaultId,
  active: string,
  corrected: string,
  absent: string,
): string {
  const status = faultState(state, fault)
  if (status === 'active') return active
  if (status === 'corrected') return corrected
  return absent
}

function afterloadSignalRows(state: EcmoSimulationState): readonly DrillSignalRow[] {
  const { readouts } = state.circuit

  return [
    valueSignalRow(
      'Circuit blood flow',
      'Flow probe on the return-side circuit tubing',
      liveNumber(state.circuit.bloodFlow, 'L/min', 2),
      'The amount moving past the probe. It does not localize a limitation by itself.',
      'valid',
      'circuitBloodFlow',
    ),
    channelSignalRow(
      'pVen',
      'Drainage limb, before the pump',
      readouts.pVen,
      'mmHg',
      'A circuit suction-side pressure, not the patient central venous pressure.',
      0,
      'pVen',
    ),
    channelSignalRow(
      'pInt',
      'After the pump and before the membrane lung',
      readouts.pInt,
      'mmHg',
      'One component of the post-pump pressure pattern; it is not a membrane verdict alone.',
      0,
      'pInt',
    ),
    channelSignalRow(
      'pArt',
      'After the membrane lung on the return limb',
      readouts.pArt,
      'mmHg',
      'Return-side circuit pressure, not the patient arterial blood pressure.',
      0,
      'pArt',
    ),
    channelSignalRow(
      'Across-membrane pressure difference',
      'Derived between the pInt and pArt measurement sites',
      readouts.deltaP,
      'mmHg',
      'A gradient that must be read with blood flow and this circuit’s earlier values.',
      0,
      'transmembraneDeltaP',
    ),
    offConsoleSignalRow(
      'Patient arterial saturation',
      'Independent bedside pulse oximeter',
      livePercent(state.patient.spo2, 1),
      'A patient observation, separate from every pressure inside the circuit.',
      'patientSpO2',
    ),
  ]
}

function afterloadPatternRows(state: EcmoSimulationState): readonly DrillPatternRow[] {
  const { readouts } = state.circuit

  return [
    {
      label: 'Flow probe',
      reading: liveNumber(state.circuit.bloodFlow, 'L/min', 2),
      movement: 'Compare with the retained earlier frames at a similar pump setting.',
    },
    {
      label: 'Three pressure sites',
      reading: `pVen ${displayedPressure(readouts.pVen)} · pInt ${displayedPressure(readouts.pInt)} · pArt ${displayedPressure(readouts.pArt)}`,
      movement: 'Compare the sites with one another before interpreting any one value.',
    },
    {
      label: 'Across-membrane difference',
      reading: displayedPressure(readouts.deltaP),
      movement: 'Read it beside both component pressures and blood flow, not as a cutoff.',
    },
    {
      label: 'Independent patient observation',
      reading: `Arterial saturation ${livePercent(state.patient.spo2, 1)}`,
      movement: 'Keep the patient endpoint separate from the circuit pressure locations.',
    },
  ]
}

function gasSignalRows(
  state: EcmoSimulationState,
  authoredPhase: 'Stabilization frame' | 'Maintenance frame',
): readonly DrillSignalRow[] {
  return [
    valueSignalRow(
      'Clinical phase',
      'Authored case context',
      authoredPhase,
      'The same blood-gas value can carry a different question in a different phase.',
      'authored',
    ),
    offConsoleSignalRow(
      'External sweep-gas flow',
      'External blender or flowmeter feeding the membrane lung',
      liveNumber(state.gas.sweepLpm, 'L/min', 1),
      'A gas-path setting outside the CARDIOHELP touchscreen.',
      'sweepGasFlow',
    ),
    offConsoleSignalRow(
      'Sweep-gas oxygen fraction',
      'External gas blender',
      livePercent(state.gas.fio2 * 100),
      'A separate gas-path setting; it is not the sweep-flow value.',
      'sweepGasOxygenFraction',
    ),
    valueSignalRow(
      'Circuit blood flow',
      'Flow probe on the return-side circuit tubing',
      liveNumber(state.circuit.bloodFlow, 'L/min', 2),
      'A blood-path measurement, distinct from gas flow through the membrane.',
      'valid',
      'circuitBloodFlow',
    ),
    offConsoleSignalRow(
      'Patient arterial carbon dioxide',
      'Patient arterial blood-gas sample',
      liveNumber(state.patient.paCO2, 'mmHg'),
      'A simulated patient sample, not a console channel.',
      'arterialCarbonDioxide',
    ),
    offConsoleSignalRow(
      'Patient arterial pH',
      'Same patient arterial blood-gas sample',
      state.patient.pH.toFixed(2),
      'Interpreted with carbon dioxide, bicarbonate, patient state, and phase.',
      'arterialPh',
    ),
    offConsoleSignalRow(
      'Patient bicarbonate',
      'Same patient arterial blood-gas sample',
      liveNumber(state.patient.bicarbonate, 'mmol/L'),
      'A companion acid-base value rather than an isolated treatment target.',
      'bicarbonate',
    ),
    offConsoleSignalRow(
      'Observed work of breathing',
      'Independent bedside assessment',
      workOfBreathingLabel(state.patient.workOfBreathing),
      'A nonnumeric patient observation that the console cannot supply.',
    ),
  ]
}

function gasPatternRows(
  state: EcmoSimulationState,
  authoredPhase: 'Stabilization' | 'Maintenance',
): readonly DrillPatternRow[] {
  return [
    {
      label: 'Case context',
      reading: authoredPhase,
      movement: 'Keep the authored phase visible while reading the current patient values.',
    },
    {
      label: 'External gas settings',
      reading: `Sweep flow ${liveNumber(state.gas.sweepLpm, 'L/min', 1)} · oxygen fraction ${livePercent(state.gas.fio2 * 100)}`,
      movement: 'Read these as two separate settings on a path outside the console.',
    },
    {
      label: 'Blood path',
      reading: `Circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}`,
      movement: 'Compare with the gas-path and patient rows rather than merging the two flows.',
    },
    {
      label: 'Patient acid-base observations',
      reading: `Carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')} · pH ${state.patient.pH.toFixed(2)} · bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}`,
      movement: 'Read the three values as one relationship and then compare with the bedside row.',
    },
    {
      label: 'Bedside observation',
      reading: workOfBreathingLabel(state.patient.workOfBreathing),
      movement: 'Compare with the blood-gas relationship and the authored phase.',
    },
  ]
}

const afterloadReturnObstruction = {
  scenarioId: 'afterload-return-obstruction',
  supportMode: 'vv',
  clinicalQuestion:
    'What relationship among circuit flow and the three pressure sites best accounts for the current state?',
  signalRows: afterloadSignalRows,
  signalSummary: (state) =>
    `Circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}; pVen ${displayedPressure(state.circuit.readouts.pVen)}, pInt ${displayedPressure(state.circuit.readouts.pInt)}, pArt ${displayedPressure(state.circuit.readouts.pArt)}, and across-membrane difference ${displayedPressure(state.circuit.readouts.deltaP)}. Patient arterial saturation ${livePercent(state.patient.spo2, 1)}.`,
  patternRows: afterloadPatternRows,
  patternSummary:
    'Read flow, all three pressure sites, the across-membrane difference, and the independent patient value as concurrent observations. No location has been assigned yet.',
  discriminators: [
    {
      question: 'Have pInt and pArt separated, or are they moving in the same direction?',
      whereToLook: 'The two post-pump pressure rows, compared over retained frames.',
    },
    {
      question:
        'Does the across-membrane difference change by itself or with both component pressures?',
      whereToLook: 'pInt, pArt, and their displayed difference, read beside circuit flow.',
    },
    {
      question: 'Is there a competing drainage-side signal or an unavailable pressure channel?',
      whereToLook: 'pVen, readout availability, and the bedside circuit inspection.',
    },
  ],
  mechanism: (state) =>
    `The modeled mechanism is increased resistance in the return path after the membrane lung. Pressure therefore backs up at pArt and pInt together while the across-membrane difference changes much less than it would for a change centered within the membrane segment; available flow falls. ${modeledCauseStatus(
      state,
      'return-obstruction',
      'That modeled return-path state remains active.',
      'The modeled cause has been corrected, so the live flow-pressure pattern should be reassessed as it evolves.',
      'That modeled cause is not active in the current frame; do not retain the label if the live pattern no longer fits it.',
    )}`,
  competingExplanations: [
    {
      candidate: 'A change centered across the membrane lung',
      standing:
        'It remains plausible until pInt, pArt, the across-membrane trend, blood flow, and sensor plausibility are compared. A growing separation between pInt and pArt would support it more strongly than both pressures moving together.',
    },
    {
      candidate: 'Drainage-side limitation',
      standing:
        'It can also lower flow, but would need a fitting pVen, drainage-line, cannula, or patient-side finding rather than this post-pump relationship alone.',
    },
  ],
  fittingResponse:
    'Keep the pressure sites attached to their physical locations. Inspect the return tubing, clamps, connectors, cannula position, and sensor plausibility; correct the identified cause through the approved local workflow, then reassess the whole circuit and patient rather than chasing the flow number.',
  responseByDomain: {
    device:
      'Avoid repeated speed escalation. Recheck displayed flow, all pressure channels, alarm context, and readout availability after the cause is addressed.',
    circuitOrGas:
      'Inspect the return path and compare pInt with pArt and the across-membrane trend; verify the physical finding before any local corrective action.',
    patient:
      'Reassess independent oxygenation, hemodynamics, and the clinical consequence of reduced support; pArt is not the patient arterial pressure.',
  },
  harmfulReflex: {
    action: 'Repeatedly increasing pump speed to chase the lower displayed flow.',
    explanation:
      'A centrifugal pump cannot remove a downstream limitation by being asked to push harder. The request can raise circuit pressure while leaving delivered flow constrained and delays localization of the cause.',
  },
  boundaries: [
    'The pressure and flow magnitudes are bounded teaching values. No displayed number is a universal limit, target, or intervention threshold.',
    'This simulation compresses many possible bedside causes into a single circuit pattern. It cannot establish tubing, connector, cannula, patient-position, thrombus, or sensor causes without physical assessment.',
    'The panel teaches localization and escalation, not a cannula manipulation, component replacement, or other hands-on procedure.',
  ],
  textEquivalent: (state) =>
    `Return-path drill. Live signals: circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pVen ${displayedPressure(state.circuit.readouts.pVen)}, pInt ${displayedPressure(state.circuit.readouts.pInt)}, pArt ${displayedPressure(state.circuit.readouts.pArt)}, across-membrane difference ${displayedPressure(state.circuit.readouts.deltaP)}, and patient arterial saturation ${livePercent(state.patient.spo2, 1)}. After commitment, the modeled explanation is resistance after the membrane lung, which raises pArt and pInt together while flow is constrained; a membrane-centered change and drainage limitation remain competitors until the full pattern and sensor plausibility are checked. The fitting response is return-path inspection, local cause correction, then device, circuit, and patient reassessment. Repeated speed escalation is the harmful reflex. These are bounded model values, not thresholds, and the simulation does not identify a physical cause or teach a corrective procedure. Source claims are limited to centrifugal-pump pressure-zone and flow relationships plus this model’s deterministic pattern.`,
  sourceSupport: [
    {
      evidenceId: 'ecmo-book-ch9',
      claim:
        'Supports centrifugal-pump afterload sensitivity, circuit pressure zones, sensor orientation, and inspection as general teaching concepts; it supplies no universal pressure threshold.',
    },
    {
      evidenceId: 'ecmo-book-ch17',
      claim:
        'Supports interpreting circuit blood flow as a context-dependent dose rather than a guaranteed result of pump demand.',
    },
    {
      evidenceId: 'bounded-educational-model',
      claim:
        'Supports only the deterministic pressure-flow relationship rendered in this scenario; it is not a patient prediction.',
    },
  ],
} as const satisfies DraftDrillPanelConfig

const afterloadOxygenatorResistance = {
  scenarioId: 'afterload-oxygenator-resistance',
  supportMode: 'vv',
  clinicalQuestion:
    'Which explanation remains most consistent after the displayed gradient is compared with its two component pressures and blood flow?',
  signalRows: afterloadSignalRows,
  signalSummary: (state) =>
    `Circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}; pVen ${displayedPressure(state.circuit.readouts.pVen)}, pInt ${displayedPressure(state.circuit.readouts.pInt)}, pArt ${displayedPressure(state.circuit.readouts.pArt)}, and across-membrane difference ${displayedPressure(state.circuit.readouts.deltaP)}. Patient arterial saturation ${livePercent(state.patient.spo2, 1)}.`,
  patternRows: afterloadPatternRows,
  patternSummary:
    'Read the gradient only after its two pressure sites and concurrent blood flow are visible. The table describes the state without assigning a cause.',
  discriminators: [
    {
      question: 'Have pInt and pArt separated, or are they moving in the same direction?',
      whereToLook: 'The two post-pump pressure sites across retained frames.',
    },
    {
      question: 'Is the displayed difference being compared at a similar blood flow?',
      whereToLook: 'The across-membrane and flow rows together, never the difference alone.',
    },
    {
      question: 'Are both component channels reporting plausibly enough to trust the subtraction?',
      whereToLook: 'Readout availability, sensor sites, and bedside circuit inspection.',
    },
  ],
  mechanism: (state) =>
    `The modeled mechanism is increased resistance across the membrane lung. pInt rises relative to pArt, the across-membrane difference grows in this circuit’s trend, and available flow can fall at the same pump demand. ${modeledCauseStatus(
      state,
      'oxygenator-resistance',
      'That modeled membrane-segment state remains active.',
      'The modeled cause has been corrected, so the pressure difference, flow, and gas-transfer observations now require reassessment.',
      'That modeled cause is not active in the current frame; the label should not be carried forward without a fitting live pattern.',
    )}`,
  competingExplanations: [
    {
      candidate: 'A limitation farther down the return path',
      standing:
        'It can raise pInt, pArt, and constrain flow. It fits better when both post-pump pressures move together without a comparable widening between them.',
    },
    {
      candidate: 'A pressure-channel or sampling problem',
      standing:
        'The subtraction is only as trustworthy as both component channels. Availability, sensor plausibility, blood flow, and gas-transfer evidence remain necessary.',
    },
  ],
  fittingResponse:
    'Compare the oxygenator segment with the rest of the circuit: pInt, pArt, the across-membrane trend at comparable flow, gas-transfer evidence, and sensor plausibility. Inspect and escalate through the local oxygenator-evaluation and exchange pathway; no single number in this panel is an exchange command.',
  responseByDomain: {
    device:
      'Avoid repeated speed escalation. Recheck the component pressures, displayed difference, flow, alarm context, and channel availability after the cause is addressed.',
    circuitOrGas:
      'Inspect the membrane segment and the complete circuit, compare the trend at similar flow, verify gas delivery and transfer evidence, and escalate through the approved local pathway.',
    patient:
      'Reassess independent oxygenation, carbon dioxide, acid-base status, and perfusion because a pressure pattern alone does not establish patient support.',
  },
  harmfulReflex: {
    action: 'Treating one across-membrane pressure number as an automatic exchange instruction.',
    explanation:
      'The gradient changes with flow, viscosity, temperature, hematocrit, sensor fidelity, and the oxygenator itself. Acting on an isolated value can mislocalize the problem and turn a trend into an unsupported universal threshold.',
  },
  boundaries: [
    'This model supplies a deliberately simplified pressure-flow trend. It does not encode a universal across-membrane alarm priority, resistance cutoff, or exchange threshold.',
    'The simulation cannot reproduce clot distribution, blood properties, gas analyser performance, sensor calibration, or the full set of oxygenator-failure findings.',
    'This panel teaches recognition and escalation only; component exchange and circuit intervention remain governed by the current device instructions and approved local protocol.',
  ],
  textEquivalent: (state) =>
    `Membrane-segment drill. Live signals: circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pVen ${displayedPressure(state.circuit.readouts.pVen)}, pInt ${displayedPressure(state.circuit.readouts.pInt)}, pArt ${displayedPressure(state.circuit.readouts.pArt)}, across-membrane difference ${displayedPressure(state.circuit.readouts.deltaP)}, and patient arterial saturation ${livePercent(state.patient.spo2, 1)}. After commitment, the modeled explanation is increased resistance across the membrane segment, with a return-path limitation and channel error retained as competitors. The fitting response is full-pattern and gas-transfer assessment, local escalation, and device, circuit, and patient reassessment. A single gradient used as an automatic exchange instruction is the harmful reflex. The values and trend are bounded; no universal cutoff, alarm priority, exchange trigger, or hands-on procedure is encoded. Source claims are limited to pressure-zone monitoring, trending without a fixed priority claim, circuit-safety context, and this model’s deterministic relationship.`,
  sourceSupport: [
    {
      evidenceId: 'ifu-anomaly-boundary',
      claim:
        'Supports showing pressure drop as a trend while withholding a fixed alarm-priority claim; it does not support an exchange threshold.',
    },
    {
      evidenceId: 'ecmo-book-ch9',
      claim:
        'Supports circuit pressure zones, sensor orientation, inspection, and centrifugal-pump afterload sensitivity as general concepts.',
    },
    {
      evidenceId: 'elso-circuit-2022',
      claim:
        'Supports circuit monitoring and safety context only; local protocol remains authoritative for operational decisions.',
    },
    {
      evidenceId: 'bounded-educational-model',
      claim:
        'Supports only this scenario’s deterministic pressure-flow trend and no clinical threshold or patient-specific forecast.',
    },
  ],
} as const satisfies DraftDrillPanelConfig

const acuteHypercapnia = {
  scenarioId: 'acute-hypercapnia',
  supportMode: 'vv',
  clinicalQuestion:
    'Which interpretation fits the current blood gas, bedside state, circuit flow, and external gas settings as a whole?',
  signalRows: (state) => gasSignalRows(state, 'Stabilization frame'),
  signalSummary: (state) =>
    `Stabilization frame with external sweep flow ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, sweep-gas oxygen fraction ${livePercent(state.gas.fio2 * 100)}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, patient carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, pH ${state.patient.pH.toFixed(2)}, bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}, and ${workOfBreathingLabel(state.patient.workOfBreathing).toLowerCase()}.`,
  patternRows: (state) => gasPatternRows(state, 'Stabilization'),
  patternSummary:
    'Keep the external gas settings, circuit blood flow, three acid-base values, bedside effort, and clinical phase separate until their relationship has been judged.',
  discriminators: [
    {
      question: 'Do carbon dioxide, pH, and bicarbonate describe the same time course?',
      whereToLook: 'The three values from the same arterial blood-gas sample.',
    },
    {
      question: 'Is the observed respiratory effort concordant with the blood-gas relationship?',
      whereToLook: 'The bedside observation beside the patient sample, not the circuit console.',
    },
    {
      question: 'Are sweep flow and sweep-gas oxygen fraction being read as two separate settings?',
      whereToLook:
        'The two external gas-path rows and the patient variable each principally influences.',
    },
  ],
  mechanism: (state) =>
    `The modeled mechanism is carbon-dioxide clearance that is insufficient for this stabilization goal. Sweep-gas flow principally changes carbon-dioxide removal across the membrane, while the patient interpretation comes from carbon dioxide, pH, bicarbonate, symptoms, and phase together. ${modeledCauseStatus(
      state,
      'acute-hypercapnia',
      'That modeled acid-base state remains active.',
      'The modeled cause has been corrected, so the patient sample and bedside state should be reassessed after the bounded response.',
      'That modeled cause is not active in the current frame; do not infer it from one carbon-dioxide value alone.',
    )}`,
  competingExplanations: [
    {
      candidate: 'A patient-side change in ventilation or carbon-dioxide production',
      standing:
        'This remains clinically plausible because the model simplifies both. It requires independent patient assessment rather than attribution to the membrane gas setting alone.',
    },
    {
      candidate: 'Interrupted or ineffective gas delivery to the membrane',
      standing:
        'A displayed setpoint is only a request. Source, blender, tubing, and post-membrane evidence would have to establish that gas is actually arriving.',
    },
  ],
  fittingResponse:
    'Name the patient-centered acid-base goal for this phase, verify the external gas path, make only a bounded goal-directed sweep-flow adjustment through the trained local workflow, allow a response, and reassess the patient rather than treating one sample as a standing prescription.',
  responseByDomain: {
    device:
      'Leave pump speed and blood-flow controls out of a carbon-dioxide-only correction, then recheck that circuit flow and console state remain stable.',
    circuitOrGasLabel: 'Gas path',
    circuitOrGas:
      'Verify source, blender, and delivery to the membrane; adjust external sweep flow only for the named goal and recheck the gas-path setting.',
    patient:
      'Repeat the arterial blood-gas assessment and reassess pH, carbon dioxide, bicarbonate, work of breathing, symptoms, and trajectory.',
  },
  harmfulReflex: {
    action: 'Changing pump speed or sweep-gas oxygen fraction to chase the carbon-dioxide value.',
    explanation:
      'Those controls answer different questions in this model. Moving them obscures whether carbon-dioxide clearance responded to the relevant gas-flow change and can disturb otherwise adequate support.',
  },
  boundaries: [
    'The carbon-dioxide and pH response is a fast, deterministic teaching curve. Its timing and magnitude do not predict a bedside response.',
    'No value in this case is a universal carbon-dioxide, pH, bicarbonate, or sweep-flow target; the intended endpoint depends on the patient and clinical phase.',
    'The external source, blender, analyser, tubing, ventilation, production, distribution kinetics, renal effects, and mixed acid-base disorders are simplified or not physically represented.',
  ],
  textEquivalent: (state) =>
    `Acid-base stabilization drill. Live signals: sweep flow ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, sweep-gas oxygen fraction ${livePercent(state.gas.fio2 * 100)}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, arterial carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, pH ${state.patient.pH.toFixed(2)}, bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}, and ${workOfBreathingLabel(state.patient.workOfBreathing).toLowerCase()}. After commitment, the modeled explanation is insufficient carbon-dioxide clearance for the named stabilization goal; patient-side ventilation or production and interrupted gas delivery remain competitors. The fitting response is goal definition, gas-path verification, a bounded sweep-flow change through local workflow, and device, gas-path, and patient reassessment. Changing pump speed or gas oxygen fraction to chase carbon dioxide is the harmful reflex. The response curve is simplified and fast, and none of the values is a universal target. Sources support principal sweep effects, phase-aware titration, independent patient assessment, and only the modeled direction—not an exact response.`,
  sourceSupport: [
    {
      evidenceId: 'ecmo-book-ch18',
      claim:
        'Supports sweep flow as the principal carbon-dioxide-clearance control, its distinction from sweep-gas oxygen fraction, and phase-aware reassessment; it supplies no universal target.',
    },
    {
      evidenceId: 'ecmo-book-ch16',
      claim:
        'Supports naming a patient-centered endpoint before changing support, without prescribing the endpoint used for an individual patient.',
    },
    {
      evidenceId: 'elso-adult-vv-2021',
      claim:
        'Supports independent patient assessment alongside circuit data in adult VV ECMO; it does not validate this case’s response magnitude.',
    },
    {
      evidenceId: 'bounded-educational-model',
      claim:
        'Supports only the deterministic direction and repeatability of the simulated acid-base response.',
    },
  ],
} as const satisfies DraftDrillPanelConfig

const compensatedHypercapnia = {
  scenarioId: 'compensated-hypercapnia',
  supportMode: 'vv',
  clinicalQuestion:
    'How should the current carbon-dioxide value be interpreted alongside pH, bicarbonate, patient state, and clinical phase?',
  signalRows: (state) => gasSignalRows(state, 'Maintenance frame'),
  signalSummary: (state) =>
    `Maintenance frame with external sweep flow ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, sweep-gas oxygen fraction ${livePercent(state.gas.fio2 * 100)}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, patient carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, pH ${state.patient.pH.toFixed(2)}, bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}, and ${workOfBreathingLabel(state.patient.workOfBreathing).toLowerCase()}.`,
  patternRows: (state) => gasPatternRows(state, 'Maintenance'),
  patternSummary:
    'The carbon-dioxide value is one row in a phase-specific acid-base and bedside pattern. The precommit view does not assign a target or response.',
  discriminators: [
    {
      question:
        'Is the carbon-dioxide value isolated, or accompanied by pH and bicarbonate changes pointing the same way?',
      whereToLook: 'All three values from the same patient sample.',
    },
    {
      question:
        'Does the current bedside effort support the same degree of urgency as the isolated value?',
      whereToLook: 'Observed work of breathing and the wider patient assessment.',
    },
    {
      question: 'What patient-centered goal, if any, has been named for this maintenance frame?',
      whereToLook: 'The clinical phase and the stated goal, not a generic reference interval.',
    },
  ],
  mechanism: (state) =>
    `The modeled mechanism is a compensated carbon-dioxide state in maintenance rather than an automatic mandate to normalize one value. The bicarbonate and pH show why carbon dioxide must be interpreted with time course, symptoms, work of breathing, and the phase-specific goal. ${modeledCauseStatus(
      state,
      'compensated-hypercapnia',
      'That modeled compensated state remains active.',
      'The modeled state has been marked corrected; the blood gas and patient trajectory still require reassessment before assigning meaning to the new value.',
      'That modeled state is not active in the current frame; do not retain the label if the live acid-base relationship no longer fits.',
    )}`,
  competingExplanations: [
    {
      candidate: 'A newly worsening acid-base disturbance',
      standing:
        'It remains important if pH, bicarbonate, symptoms, effort, or trajectory change. A carbon-dioxide value alone cannot distinguish it from an already compensated state.',
    },
    {
      candidate: 'A patient-specific goal that requires a different carbon-dioxide direction',
      standing:
        'That may be appropriate, but it has to be explicitly named from the patient context; this authored maintenance case does not create a universal permissive target.',
    },
  ],
  fittingResponse:
    'Preserve the current compensation unless a patient-centered goal justifies a bounded change. Verify the gas path, review symptoms and work of breathing, and reassess the blood gas and trajectory instead of using a generic reference interval as the treatment endpoint.',
  responseByDomain: {
    device:
      'Do not use pump speed to normalize an isolated carbon-dioxide value. Recheck blood flow and console state while the patient-centered plan is reviewed.',
    circuitOrGasLabel: 'Gas path',
    circuitOrGas:
      'Verify source and current external settings. Hold them or make only a bounded, explicitly goal-directed change through the trained local workflow, then recheck delivery.',
    patient:
      'Reassess pH, carbon dioxide, bicarbonate, symptoms, work of breathing, phase, and trend before deciding whether the relationship remains acceptable for this patient.',
  },
  harmfulReflex: {
    action:
      'Rapidly normalizing carbon dioxide because the isolated value is outside a reference interval.',
    explanation:
      'That ignores compensation and phase. An abrupt goal-free change can overshoot the intended acid-base state and replaces patient-centered reasoning with treatment of one number.',
  },
  boundaries: [
    'This case does not define a universal permissive-hypercapnia, carbon-dioxide, pH, bicarbonate, or sweep-flow target.',
    'The model simplifies renal compensation, mixed acid-base disorders, ventilation, carbon-dioxide production, symptoms, and the time course of response.',
    'The displayed response is a bounded teaching curve. Its exact size and timing are not a patient forecast or dosing instruction.',
  ],
  textEquivalent: (state) =>
    `Maintenance acid-base drill. Live signals: sweep flow ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, sweep-gas oxygen fraction ${livePercent(state.gas.fio2 * 100)}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, arterial carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, pH ${state.patient.pH.toFixed(2)}, bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}, and ${workOfBreathingLabel(state.patient.workOfBreathing).toLowerCase()}. After commitment, the modeled explanation is a compensated carbon-dioxide state that cannot be interpreted from carbon dioxide alone; a newly worsening disturbance or a specifically named patient goal remains a competitor. The fitting response is to preserve compensation unless a patient-centered goal supports a bounded change, while reassessing device, gas path, and patient. Rapid goal-free normalization is the harmful reflex. No universal permissive target is taught, and renal, metabolic, respiratory, symptom, and response timing are simplified. Sources support phase-aware sweep reasoning and the bounded model only.`,
  sourceSupport: [
    {
      evidenceId: 'ecmo-book-ch18',
      claim:
        'Supports phase-aware sweep-gas titration and interpreting the response with more than one isolated value; it supplies no universal permissive target.',
    },
    {
      evidenceId: 'bounded-educational-model',
      claim:
        'Supports only the authored compensated pattern and deterministic response used for this exercise, not a bedside target or forecast.',
    },
  ],
} as const satisfies DraftDrillPanelConfig

const transportPowerLoss = {
  scenarioId: 'transport-power-loss',
  supportMode: 'vv',
  clinicalQuestion:
    'What does the current combination of supply indication, battery display, circuit flow, and patient state establish, and what remains uncertain?',
  signalRows: (state) => [
    valueSignalRow(
      'Console power source',
      'Transport status display on the console',
      powerSourceLabel(state),
      'The source currently carrying the console; it does not by itself state whether blood flow persists.',
      'valid',
    ),
    valueSignalRow(
      'Console battery indication',
      'Transport status display on the console',
      livePercent(state.device.batteryPercent, 1),
      'A live reserve indication to trend. It is not a prediction of remaining minutes.',
      'valid',
      'batteryReserve',
    ),
    valueSignalRow(
      'Pump state',
      'Console and pump unit',
      pumpStateLabel(state),
      'A nonnumeric device state, separate from the measured flow value.',
      'valid',
    ),
    valueSignalRow(
      'Circuit blood flow',
      'Flow probe on the return-side circuit tubing',
      liveNumber(state.circuit.bloodFlow, 'L/min', 2),
      'The live blood-path measurement used to confirm whether support is moving at this instant.',
      'valid',
      'circuitBloodFlow',
    ),
    offConsoleSignalRow(
      'Patient arterial saturation',
      'Independent bedside pulse oximeter',
      livePercent(state.patient.spo2, 1),
      'A patient observation that must be checked independently of the console power display.',
      'patientSpO2',
    ),
  ],
  signalSummary: (state) =>
    `Power source ${powerSourceLabel(state)}; battery indication ${livePercent(state.device.batteryPercent, 1)}; ${pumpStateLabel(state).toLowerCase()}; circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}; patient arterial saturation ${livePercent(state.patient.spo2, 1)}. The battery percentage does not encode remaining runtime.`,
  patternRows: (state) => [
    {
      label: 'Power path',
      reading: `${powerSourceLabel(state)} · battery indication ${livePercent(state.device.batteryPercent, 1)}`,
      movement: 'Read source and reserve as separate device-status facts.',
    },
    {
      label: 'Device support state',
      reading: pumpStateLabel(state),
      movement: 'Compare with measured circuit flow rather than inferring flow from power source.',
    },
    {
      label: 'Blood path',
      reading: `Circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}`,
      movement: 'Compare with its earlier frame and the independent patient observation.',
    },
    {
      label: 'Patient',
      reading: `Arterial saturation ${livePercent(state.patient.spo2, 1)}`,
      movement: 'Reconcile this with flow and the wider bedside assessment.',
    },
  ],
  patternSummary:
    'Power source, battery reserve, pump state, measured blood flow, and patient state answer different questions. The percentage is not translated into time.',
  discriminators: [
    {
      question: 'Which display establishes the source currently carrying the console?',
      whereToLook: 'The transport power-source indication, separate from the reserve percentage.',
    },
    {
      question: 'Does the flow probe show that blood support is continuing at this moment?',
      whereToLook: 'The circuit blood-flow row, checked against pump state and patient assessment.',
    },
    {
      question: 'Can the displayed percentage alone establish remaining runtime?',
      whereToLook: 'The reserve row and its model boundary; no duration is supplied.',
    },
  ],
  mechanism: (state) =>
    `After the modeled source change, the mechanism is loss of AC mains during transport with automatic changeover to the internal battery. Blood flow can continue while reserve declines, so power-source status and immediate support continuity are related but not interchangeable questions. ${modeledCauseStatus(
      state,
      'ac-power-loss',
      'The modeled mains-loss state remains active.',
      'A verified AC source has been restored in the simulation; device, circuit, and patient continuity still require confirmation.',
      'The modeled mains-loss state is not active in this frame; retain the transport-readiness checks without carrying forward the diagnosis.',
    )}`,
  competingExplanations: [
    {
      candidate: 'A pump or blood-path failure occurring during transport',
      standing:
        'It remains important if measured flow, pump state, pressure pattern, or patient status deteriorates. A changed power-source indication alone does not establish it.',
    },
    {
      candidate: 'An unreliable external power connection or status indication',
      standing:
        'Physical verification is required because this simulation represents the source as a state and does not reproduce outlets, cables, connectors, or electrical testing.',
    },
  ],
  fittingResponse:
    'Recognize the source change, restore a verified AC source through the approved transport workflow, confirm circuit flow and patient status, and maintain immediate backup-console or emergency-drive readiness according to trained local policy. Do not use the percentage as permission to wait.',
  responseByDomain: {
    device:
      'Confirm the displayed power source and reserve indication, restore verified AC through the approved workflow, and recheck device status and alarms after restoration.',
    circuitOrGas:
      'Confirm measured blood flow and inspect circuit continuity; keep the locally required backup support equipment ready without improvising an untrained procedure.',
    patient:
      'Reassess oxygenation, perfusion, and the wider bedside state during the source transition and again after power is restored.',
  },
  harmfulReflex: {
    action: 'Treating the battery percentage as a promise of safe remaining runtime.',
    explanation:
      'The number is a status indication, not a transport clock. Waiting on an inferred duration can consume the margin needed to verify alternate power and backup readiness.',
  },
  boundaries: [
    'The battery discharge curve is deliberately accelerated and authored for this exercise. A displayed percentage cannot be converted into remaining minutes or a safe transport interval.',
    'The simulation does not reproduce outlets, cables, connectors, battery health, load-dependent runtime, backup-console setup, or emergency-drive operation.',
    'Recognition and readiness are taught here; hands-on power transfer and emergency-drive competency require the current device instructions and approved local training.',
  ],
  textEquivalent: (state) =>
    `Transport power drill. Live signals: source ${powerSourceLabel(state)}, battery indication ${livePercent(state.device.batteryPercent, 1)}, ${pumpStateLabel(state).toLowerCase()}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, and patient arterial saturation ${livePercent(state.patient.spo2, 1)}. After commitment, the modeled explanation is AC mains loss with automatic battery changeover; a pump or blood-path failure and an unreliable external connection remain competitors. The fitting response is verified AC restoration through the approved transport workflow, confirmation of device, circuit, and patient continuity, and trained backup readiness. Treating the percentage as promised runtime is the harmful reflex. The accelerated discharge curve predicts no real duration, and cables, outlets, battery health, backup setup, and emergency-drive operation are not modeled. Sources support console power-state recognition and general emergency readiness, not the exact percentage trajectory or hands-on procedure.`,
  sourceSupport: [
    {
      evidenceId: 'ifu-console-workflow',
      claim:
        'Supports console power controls, power-state display, and alarm workflow; it does not validate the simulation’s accelerated discharge rate.',
    },
    {
      evidenceId: 'ecmo-book-ch9',
      claim:
        'Supports circuit inspection and backup readiness as general teaching concepts, not a specific emergency-drive procedure.',
    },
    {
      evidenceId: 'elso-circuit-2022',
      claim:
        'Supports emergency-planning and circuit-safety context while leaving operational decisions to current local policy and device training.',
    },
    {
      evidenceId: 'bounded-educational-model',
      claim:
        'Supports only the authored battery trajectory and repeatable scenario timing; neither predicts actual runtime.',
    },
  ],
} as const satisfies DraftDrillPanelConfig

export const remainingVvDrillPanelConfigs = {
  'afterload-return-obstruction': afterloadReturnObstruction,
  'afterload-oxygenator-resistance': afterloadOxygenatorResistance,
  'acute-hypercapnia': acuteHypercapnia,
  'compensated-hypercapnia': compensatedHypercapnia,
  'transport-power-loss': transportPowerLoss,
} as const satisfies Readonly<Record<RemainingVvDrillId, DraftDrillPanelConfig>>

export const remainingVvDrillPanelComponents = {
  'afterload-return-obstruction': draftPanelFor(
    remainingVvDrillPanelConfigs['afterload-return-obstruction'],
  ),
  'afterload-oxygenator-resistance': draftPanelFor(
    remainingVvDrillPanelConfigs['afterload-oxygenator-resistance'],
  ),
  'acute-hypercapnia': draftPanelFor(remainingVvDrillPanelConfigs['acute-hypercapnia']),
  'compensated-hypercapnia': draftPanelFor(remainingVvDrillPanelConfigs['compensated-hypercapnia']),
  'transport-power-loss': draftPanelFor(remainingVvDrillPanelConfigs['transport-power-loss']),
} as const satisfies Readonly<Record<RemainingVvDrillId, ReturnType<typeof draftPanelFor>>>
