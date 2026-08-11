import type { EcmoChannelReadout, EcmoSimulationState } from '../../../engine/types'
import {
  draftPanelFor,
  liveNumber,
  livePercent,
  type DraftDrillPanelConfig,
} from './DraftDrillPanel'
import {
  channelSignalRow,
  offConsoleSignalRow,
  valueSignalRow,
  type DrillSignalRow,
} from './drillPanelPrimitives'

export const remainingVaDrillPanelIds = [
  'va-startup-sensor-orientation',
  'va-preload-drainage-collapse',
  'va-afterload-arterial-return-obstruction',
  'va-afterload-oxygenator-resistance',
  'va-lv-loading',
  'va-acute-hypercapnia',
  'va-gas-source-interruption',
  'va-arterial-bubble-stop',
  'va-transport-power-loss',
] as const

export type RemainingVaDrillPanelId = (typeof remainingVaDrillPanelIds)[number]

type RemainingVaConfigMap = {
  readonly [K in RemainingVaDrillPanelId]: DraftDrillPanelConfig & {
    readonly scenarioId: K
    readonly supportMode: 'va'
  }
}

type PressureGuideKey = 'pVen' | 'pInt' | 'pArt' | 'transmembraneDeltaP'

const selfTestLabels = {
  pending: 'Not completed',
  passed: 'Completed successfully',
  failed: 'Failed',
} as const

const workOfBreathingLabels = {
  low: 'Low observed effort',
  moderate: 'Moderate observed effort',
  high: 'High observed effort',
} as const

const pulmonaryCongestionLabels = {
  none: 'No congestion represented',
  mild: 'Mild congestion represented',
  marked: 'Marked congestion represented',
} as const

function pumpState(state: EcmoSimulationState): string {
  return state.device.pumpRunning ? 'Pump turning' : 'Pump stopped'
}

function powerSource(state: EcmoSimulationState): string {
  return state.device.powerSource === 'ac' ? 'AC power indicated' : 'Battery power indicated'
}

function gasSource(state: EcmoSimulationState): string {
  return state.gas.sourceConnected ? 'Source connected' : 'Source interrupted'
}

function clampState(closed: boolean): string {
  return closed ? 'Closed' : 'Open'
}

function pressureRow(
  label: string,
  measuredAt: string,
  readout: EcmoChannelReadout,
  note: string,
  valueGuideKey: PressureGuideKey,
): DrillSignalRow {
  return channelSignalRow(label, measuredAt, readout, 'mmHg', note, 0, valueGuideKey)
}

function pressureText(
  label: string,
  readout: EcmoChannelReadout,
  valueGuideKey: PressureGuideKey,
): string {
  return pressureRow(
    label,
    'The corresponding circuit channel',
    readout,
    'Availability and value come from the channel state.',
    valueGuideKey,
  ).value
}

function vaCoreRows(state: EcmoSimulationState): readonly DrillSignalRow[] {
  const { circuit, device, patient } = state
  return [
    valueSignalRow(
      'Pump speed',
      'Configured on the CARDIOHELP console',
      liveNumber(device.rpmSetpoint, 'rpm'),
      'A speed request to the centrifugal pump, not a delivered-flow setting.',
      'configured',
      'pumpSpeed',
    ),
    valueSignalRow(
      'Circuit blood flow',
      'Return-limb flow probe',
      liveNumber(circuit.bloodFlow, 'L/min', 2),
      'Circuit flow is not measured total systemic flow during parallel venoarterial support.',
      'valid',
      'circuitBloodFlow',
    ),
    pressureRow(
      'pVen',
      'Drainage limb before the pump',
      circuit.readouts.pVen,
      'A circuit drainage pressure, not central venous pressure.',
      'pVen',
    ),
    pressureRow(
      'pInt',
      'After the pump and before the membrane lung',
      circuit.readouts.pInt,
      'A pre-membrane circuit pressure.',
      'pInt',
    ),
    pressureRow(
      'pArt',
      'After the membrane on the arterial return limb',
      circuit.readouts.pArt,
      'A return-side circuit pressure, not patient arterial pressure.',
      'pArt',
    ),
    offConsoleSignalRow(
      'Patient mean arterial pressure',
      'Independent patient arterial line',
      liveNumber(patient.meanArterialPressure, 'mmHg'),
      'A patient-monitor value kept separate from circuit pArt.',
      'meanArterialPressure',
    ),
  ]
}

export const remainingVaDrillPanelConfigs = Object.freeze({
  'va-startup-sensor-orientation': {
    scenarioId: 'va-startup-sensor-orientation',
    supportMode: 'va',
    clinicalQuestion:
      'Before this peripheral femoral venoarterial circuit is relied on, which claims have actually been established by the console, circuit, external gas path, and independent patient observations?',
    signalRows: (state) => [
      valueSignalRow(
        'Startup diagnostic',
        'CARDIOHELP console',
        selfTestLabels[state.device.selfTest],
        'A device check reports on the console and functions it can interrogate; it does not inspect the whole system.',
        'valid',
      ),
      valueSignalRow(
        'Pump state',
        'CARDIOHELP console and pump head',
        pumpState(state),
        'This state says whether the pump is turning, not whether the circuit is ready for patient support.',
        'valid',
      ),
      valueSignalRow(
        'Pump speed',
        'Configured on the CARDIOHELP console',
        liveNumber(state.device.rpmSetpoint, 'rpm'),
        'A configured speed request rather than evidence that a safe flow path exists.',
        'configured',
        'pumpSpeed',
      ),
      valueSignalRow(
        'Circuit blood flow',
        'Return-limb flow probe',
        liveNumber(state.circuit.bloodFlow, 'L/min', 2),
        'A flow-probe value; it does not verify probe direction, cannula position, or patient perfusion.',
        'valid',
        'circuitBloodFlow',
      ),
      pressureRow(
        'pVen',
        'Femoral venous drainage limb before the pump',
        state.circuit.readouts.pVen,
        'The channel may be unavailable in this state; its label still identifies the drainage location.',
        'pVen',
      ),
      pressureRow(
        'pInt',
        'After the pump and before the membrane lung',
        state.circuit.readouts.pInt,
        'The channel may be unavailable in this state; its label identifies the pre-membrane location.',
        'pInt',
      ),
      pressureRow(
        'pArt',
        'After the membrane on the femoral arterial return limb',
        state.circuit.readouts.pArt,
        'This is a circuit pressure and never the patient arterial-line pressure.',
        'pArt',
      ),
      valueSignalRow(
        'Circuit walk',
        'Bedside tubing and both cannulas',
        state.circuit.circuitInspected ? 'Recorded complete' : 'Not recorded complete',
        'A physical inspection state that the console cannot establish.',
        'bedside',
      ),
      valueSignalRow(
        'External gas path',
        'Source, blender, and line to the membrane',
        gasSource(state),
        'The gas path is outside the CARDIOHELP touchscreen.',
        'off-console',
      ),
      offConsoleSignalRow(
        'Right-radial saturation',
        'Independent upper-body monitor',
        livePercent(state.patient.rightRadialSpo2, 1),
        'A patient value from the upper body, not a console channel.',
        'rightRadialSaturation',
      ),
      offConsoleSignalRow(
        'Pulse pressure',
        'Independent patient arterial line',
        liveNumber(state.patient.pulsePressure, 'mmHg'),
        'One off-console clue to native ejection in this modeled configuration.',
        'pulsePressure',
      ),
    ],
    signalSummary: (state) =>
      `Startup diagnostic: ${selfTestLabels[state.device.selfTest]}. ${pumpState(state)} at ${liveNumber(state.device.rpmSetpoint, 'rpm')}; circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}. The bedside circuit walk is ${state.circuit.circuitInspected ? 'recorded complete' : 'not recorded complete'}, the external gas path is ${state.gas.sourceConnected ? 'connected' : 'interrupted'}, and right-radial saturation is ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    patternRows: (state) => [
      {
        label: 'Device domain',
        reading: `${selfTestLabels[state.device.selfTest]}; ${pumpState(state)}; ${powerSource(state)}`,
        movement: 'Read only as statements about device state.',
      },
      {
        label: 'Blood-path domain',
        reading: `Circuit walk ${state.circuit.circuitInspected ? 'recorded complete' : 'not recorded complete'}; flow probe ${state.circuit.flowSensorConnected ? 'connected' : 'not connected'}`,
        movement: 'Compare the bedside path with the channel locations.',
      },
      {
        label: 'Gas-path domain',
        reading: gasSource(state),
        movement: 'Read at the external source and blender, not on the touchscreen.',
      },
      {
        label: 'Patient domain',
        reading: `Right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}; pulse pressure ${liveNumber(state.patient.pulsePressure, 'mmHg')}`,
        movement: 'Compare with the independent monitor and bedside assessment.',
      },
    ],
    patternSummary: (state) =>
      `Four information domains are present. Their current states are device diagnostic ${selfTestLabels[state.device.selfTest]}, circuit walk ${state.circuit.circuitInspected ? 'complete' : 'not complete'}, gas source ${state.gas.sourceConnected ? 'connected' : 'interrupted'}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    discriminators: [
      {
        question:
          'Which observations come from the console, and which require a bedside or external-device check?',
        whereToLook: 'The measured-at and provenance columns in the signal table.',
      },
      {
        question:
          'Do unavailable pressure channels represent a failed sensor, or a state in which this simulation has no flowing-circuit value to show?',
        whereToLook: 'The availability reason printed beside each pressure channel.',
      },
      {
        question:
          'Which facts establish the venous drainage limb and arterial return limb as physically correct?',
        whereToLook: 'The bedside circuit-walk state, not a console number.',
      },
    ],
    mechanism:
      'The best explanation is an incomplete system-level startup state. A device diagnostic can establish only the device functions it checks. It cannot establish the physical femoral venous-to-femoral arterial flow path, sensor placement, external gas continuity, cannula security, backup readiness, or independent patient state.',
    competingExplanations: [
      {
        candidate: 'A device diagnostic alone establishes readiness',
        standing:
          'That would fit only if every relevant circuit, gas-path, backup, and patient fact were visible to the console. They are not.',
      },
      {
        candidate: 'Live numbers can substitute for a pre-use physical check',
        standing:
          'Numbers become interpretable only after sensor location and flow-path orientation have been established independently.',
      },
    ],
    fittingResponse:
      'Complete the authored pre-use sequence before relying on the circuit: finish the device diagnostic, trace femoral venous drainage through pump and membrane to femoral arterial return, verify sensors, gas and power/backup, and record the required regional, pulsatility, perfusion, and cannulated-limb baselines under the reviewed local workflow.',
    responseByDomain: {
      device:
        'Confirm the startup diagnostic, device state, indicated power source, and immediate backup readiness.',
      circuitOrGas:
        'Trace both limbs and every represented sensor, then verify the external gas path without treating a blender setting as proof of delivery.',
      patient:
        'Confirm and record the required right-arm and lower-body oxygenation, pulsatility/native-heart, perfusion, and cannulated-limb baselines independently of the console.',
    },
    harmfulReflex: {
      action: 'Starting support because the console is quiet or the diagnostic passes.',
      explanation:
        'A quiet console cannot detect every reversed, misplaced, disconnected, unsecured, or externally supplied element, and it has no direct view of the patient.',
    },
    boundaries: [
      'The startup diagnostic, channel availability, and inspection state are simplified educational representations; they do not reproduce a complete manufacturer or local pre-use checklist.',
      'Cannulation, distal-perfusion setup, sterile connection, and hands-on backup-drive competency are not taught or certified here.',
      'The live numbers are authored model states, not minimum readiness values or patient targets.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial startup draft. The device diagnostic is ${selfTestLabels[state.device.selfTest]}, the pump is ${state.device.pumpRunning ? 'turning' : 'stopped'} at ${liveNumber(state.device.rpmSetpoint, 'rpm')}, circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, and the circuit walk is ${state.circuit.circuitInspected ? 'recorded complete' : 'not recorded complete'}. pVen is ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}, pInt is ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, and pArt is ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}. The external gas source is ${state.gas.sourceConnected ? 'connected' : 'interrupted'}, right-radial saturation is ${livePercent(state.patient.rightRadialSpo2, 1)}, and pulse pressure is ${liveNumber(state.patient.pulsePressure, 'mmHg')}. After commitment, the panel identifies an incomplete system-level startup state, keeps device-only readiness as a competing explanation, and calls for the authored diagnostic; tip-to-tip circuit, gas, and backup checks; and recording required right-arm and lower-body oxygenation, pulsatility or native-heart, perfusion, and cannulated-limb baselines under the reviewed local workflow. Starting from a quiet console is the harmful reflex. This simulation does not reproduce a full pre-use checklist or certify cannulation or backup-drive competency, and none of its numbers is a readiness target.`,
    sourceSupport: [
      {
        evidenceId: 'ifu-console-workflow',
        claim:
          'Supports the represented CARDIOHELP controls, startup surfaces, channels, power status, and device workflow only.',
      },
      {
        evidenceId: 'ecmo-book-ch9',
        claim:
          'Supports circuit-component, sensor-orientation, inspection, and backup-readiness concepts.',
      },
      {
        evidenceId: 'elso-adult-va-2021',
        claim:
          'Supports independent patient assessment during adult peripheral venoarterial support.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the deterministic startup state and modeled channel availability shown here.',
      },
    ],
  },

  'va-preload-drainage-collapse': {
    scenarioId: 'va-preload-drainage-collapse',
    supportMode: 'va',
    clinicalQuestion:
      'At a fixed pump-speed request, circuit flow is unstable, the drainage-side channel has changed, and the venous tubing moves visibly. Which location and independent patient observations should be reconciled before a setting is changed?',
    signalRows: (state) => [
      ...vaCoreRows(state),
      pressureRow(
        'Membrane pressure drop',
        'Derived across the membrane from the two post-pump channels',
        state.circuit.readouts.deltaP,
        'A flow-dependent circuit gradient that must be read with the current flow.',
        'transmembraneDeltaP',
      ),
      valueSignalRow(
        'Drainage-line motion',
        'Femoral venous drainage tubing at the bedside',
        state.circuit.drainageChatter
          ? 'Intermittent line motion present'
          : 'No intermittent line motion visible',
        'A physical circuit observation, not a console channel.',
        'bedside',
      ),
    ],
    signalSummary: (state) =>
      `At ${liveNumber(state.device.rpmSetpoint, 'rpm')}, circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pVen is ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}, and intermittent drainage-line motion is ${state.circuit.drainageChatter ? 'present' : 'not visible'}. Patient mean arterial pressure is ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}.`,
    patternRows: (state) => [
      {
        label: 'Pump request and flow result',
        reading: `${liveNumber(state.device.rpmSetpoint, 'rpm')} with ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}`,
        movement: 'Read the requested speed beside the flow actually produced.',
      },
      {
        label: 'Drainage side',
        reading: `pVen ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}; line motion ${state.circuit.drainageChatter ? 'present' : 'not visible'}`,
        movement: 'Compare the pressure-channel state with the bedside tubing.',
      },
      {
        label: 'Post-pump circuit',
        reading: `pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}; pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}; gradient ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')}`,
        movement: 'Compare all three at the same flow snapshot.',
      },
      {
        label: 'Independent patient',
        reading: `Mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}`,
        movement: 'Read beside perfusion and native-heart observations, not as a circuit pressure.',
      },
    ],
    patternSummary: (state) =>
      `The current snapshot pairs ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)} circuit flow with pVen ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}, ${state.circuit.drainageChatter ? 'visible intermittent drainage-line motion' : 'no visible intermittent drainage-line motion'}, and patient mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}.`,
    discriminators: [
      {
        question:
          'Which pressure channel changes nearest the venous drainage cannula and pump inlet?',
        whereToLook: 'pVen and the measured-at column, read with the tubing itself.',
      },
      {
        question:
          'Do the post-pump pressures and membrane gradient move in the same pattern as the drainage-side observation?',
        whereToLook: 'pInt, pArt, membrane pressure drop, and flow in one snapshot.',
      },
      {
        question:
          'Which patient or cannula finding could limit what reaches the pump despite an unchanged speed request?',
        whereToLook:
          'Independent filling, intrathoracic, cannula-position, and perfusion observations.',
      },
    ],
    mechanism:
      'The pattern is venous drainage limited by available preload during peripheral femoral venoarterial support. Venous return cannot meet the pump demand, so the drainage pressure becomes more negative, the line can intermittently collapse, and circuit flow becomes unstable while systemic support may fall.',
    competingExplanations: [
      {
        candidate: 'Immediate volume treatment from the console pattern alone',
        standing:
          'Hypovolemia is one possible cause, but the console cannot distinguish it from cannula position, tamponade, intrathoracic pressure, or other limits on venous return. The cause must be assessed before a patient intervention is assumed.',
      },
      {
        candidate: 'Resistance after the pump',
        standing:
          'This remains plausible when the post-pump pressure pattern rises against flow rather than following the drainage-side change shown here.',
      },
      {
        candidate: 'A patient perfusion problem with an adequate drainage path',
        standing:
          'Patient vascular tone or native-heart function can change MAP, but it does not by itself explain a concordant pVen and drainage-line pattern.',
      },
    ],
    fittingResponse:
      'Temporarily reduce pump demand while urgently assessing the venous drainage limb and patient causes, correct the identified limitation, then retitrate support against perfusion and native-heart endpoints under the reviewed local protocol.',
    responseByDomain: {
      device:
        'Confirm the speed request and flow response without escalating pump demand into an unstable drainage pattern.',
      circuitOrGas:
        'Inspect the femoral venous drainage limb, cannula path, tubing, and sensor plausibility; confirm the post-pump pattern remains distinct.',
      patient:
        'Assess venous filling, intrathoracic causes, cannula relationship, MAP, perfusion, and native-heart findings; correct the identified cause.',
    },
    harmfulReflex: {
      action: 'Increasing pump speed to chase the displayed flow.',
      explanation:
        'When the drainage path cannot supply the requested flow, more pump demand can deepen intermittent collapse and further reduce stable support.',
    },
    boundaries: [
      'The drainage capacity, pressure response, and line-motion behavior are authored educational-model relationships, not clinical thresholds.',
      'This panel cannot identify volume status, tamponade, intrathoracic pressure, or cannula position from the console alone.',
      'No RPM value, fluid action, or perfusion target shown here transfers to a real patient without the reviewed local protocol and expert assessment.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial drainage-pattern draft. Pump speed is ${liveNumber(state.device.rpmSetpoint, 'rpm')}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pVen ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}, pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, and membrane pressure drop ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')}. Intermittent drainage-line motion is ${state.circuit.drainageChatter ? 'present' : 'not visible'}, and patient mean arterial pressure is ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}. After commitment, the panel identifies venous drainage limited by available preload, retains post-pump resistance, a separate patient perfusion problem, and immediate volume treatment from console data alone as competitors, and calls for a temporary reduction in pump demand while the venous drainage and patient cause are found and corrected. Raising speed to chase flow is the harmful reflex. The capacity and response are model-authored, the console cannot identify the patient cause, and no displayed number is a bedside target.`,
    sourceSupport: [
      {
        evidenceId: 'ecmo-book-ch9',
        claim:
          'Supports centrifugal-pump preload dependence and drainage-side pressure-zone reasoning.',
      },
      {
        evidenceId: 'ecmo-book-ch17',
        claim: 'Supports treating blood flow as a titrated dose constrained by available drainage.',
      },
      {
        evidenceId: 'elso-adult-va-2021',
        claim:
          'Supports independent patient and circulatory assessment during adult venoarterial support.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the deterministic flow, pressure, and line-motion response displayed by this case.',
      },
    ],
  },

  'va-afterload-arterial-return-obstruction': {
    scenarioId: 'va-afterload-arterial-return-obstruction',
    supportMode: 'va',
    clinicalQuestion:
      'With pump speed unchanged, circuit flow and both post-pump pressure channels have changed. Which segment of the femoral venoarterial flow path should be localized, and which patient pressure must remain a separate measurement?',
    signalRows: (state) => [
      ...vaCoreRows(state),
      pressureRow(
        'Membrane pressure drop',
        'Derived across the membrane from pInt and pArt',
        state.circuit.readouts.deltaP,
        'Read only with the current flow and the two component pressures.',
        'transmembraneDeltaP',
      ),
      valueSignalRow(
        'Arterial return clamp',
        'Femoral arterial return limb near the patient',
        clampState(state.circuit.returnClampClosed),
        'A bedside circuit state with no console sensor confirming it.',
        'bedside',
      ),
    ],
    signalSummary: (state) =>
      `At ${liveNumber(state.device.rpmSetpoint, 'rpm')}, flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pInt is ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt is ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, membrane pressure drop is ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')}, and patient mean arterial pressure is ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}.`,
    patternRows: (state) => [
      {
        label: 'Pump request and delivered circuit flow',
        reading: `${liveNumber(state.device.rpmSetpoint, 'rpm')} and ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}`,
        movement: 'Read the result at the unchanged request.',
      },
      {
        label: 'Before and after the membrane',
        reading: `pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}; pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}`,
        movement: 'Compare whether the two post-pump channels move together or separate.',
      },
      {
        label: 'Across the membrane',
        reading: pressureText(
          'membrane pressure drop',
          state.circuit.readouts.deltaP,
          'transmembraneDeltaP',
        ),
        movement: 'Read beside the current flow rather than as a standalone cutoff.',
      },
      {
        label: 'Patient arterial line',
        reading: liveNumber(state.patient.meanArterialPressure, 'mmHg'),
        movement: 'Keep this patient measurement separate from circuit pArt.',
      },
    ],
    patternSummary: (state) =>
      `The current pressure-location comparison is pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, and membrane pressure drop ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')} at flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}. Patient mean arterial pressure is independently ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}.`,
    discriminators: [
      {
        question: 'Do pInt and pArt move together, or does one separate from the other?',
        whereToLook: 'The two post-pump pressure channels at the same flow and speed snapshot.',
      },
      {
        question:
          'Has the gradient between the two post-pump channels changed proportionally with flow?',
        whereToLook: 'Membrane pressure drop and circuit flow, compared with the earlier state.',
      },
      {
        question:
          'Could the patient arterial line, tubing, connector, clamp, cannula path, or sensor explain a different part of the pattern?',
        whereToLook: 'The physical return limb and independent patient arterial measurement.',
      },
    ],
    mechanism:
      'The pattern best fits increased resistance downstream of the membrane in the femoral arterial return pathway. That resistance is seen upstream by both pArt and pInt, while flow falls at the same pump-speed request. Circuit pArt remains distinct from patient mean arterial pressure.',
    competingExplanations: [
      {
        candidate: 'Increased resistance across the membrane lung',
        standing:
          'That becomes more likely when pInt separates from pArt and the membrane pressure-drop trend rises at comparable flow.',
      },
      {
        candidate: 'Patient afterload or an implausible pressure channel',
        standing:
          'Both can contribute to or mimic part of the pattern and require an independent arterial line, sensor check, and full return-path inspection.',
      },
    ],
    fittingResponse:
      'Inspect the arterial return tubing, connectors, clamp state, cannula path, pressure-channel plausibility, and independent patient afterload; correct the identified cause and reassess before retitrating pump demand.',
    responseByDomain: {
      device:
        'Hold the pressure channels, speed request, and flow in one comparison; do not equate pArt with patient arterial pressure.',
      circuitOrGas:
        'Inspect the post-membrane arterial return path from oxygenator outlet to femoral arterial cannula and correct the identified circuit cause.',
      patient:
        'Reassess mean arterial pressure, systemic perfusion, native-heart contribution, and the cannulated limb independently.',
    },
    harmfulReflex: {
      action: 'Increasing pump speed before locating the resistance.',
      explanation:
        'This bounded model may show a short-term rise in displayed flow and patient MAP as speed rises, but pInt and pArt also rise, the downstream restriction remains, and the action earns no corrective credit. The partial gain is not resolution.',
    },
    boundaries: [
      'The simulated resistance and pressure response are authored directions, not a prediction of magnitude for a real circuit.',
      'This panel cannot distinguish tubing, connector, cannula, vessel, patient-afterload, and sensor causes without bedside assessment.',
      'No pressure number shown here is a universal intervention or exchange threshold.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial post-pump pressure-location draft. At ${liveNumber(state.device.rpmSetpoint, 'rpm')}, circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, membrane pressure drop ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')}, and independent patient mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}. After commitment, the panel identifies resistance downstream of the membrane in the arterial return path, retains membrane resistance and patient-afterload or sensor explanations, and calls for a physical return-path, sensor, and independent-patient assessment before correction and retitration. Raising pump speed before localization is the harmful reflex: this model can briefly raise displayed flow and MAP while pInt and pArt rise and the restriction remains, so that partial gain is not resolution. The response magnitude is model-authored, the exact cause cannot be established from the console, and no displayed pressure is a universal threshold.`,
    sourceSupport: [
      {
        evidenceId: 'ecmo-book-ch9',
        claim:
          'Supports centrifugal-pump afterload sensitivity and circuit pressure-zone localization.',
      },
      {
        evidenceId: 'ecmo-book-ch17',
        claim:
          'Supports interpreting blood flow with preload and afterload limits rather than as a speed-equivalent value.',
      },
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'Supports circuit-component monitoring and cause-first safety context.',
      },
      {
        evidenceId: 'elso-adult-va-2021',
        claim: 'Supports independent hemodynamic assessment during adult venoarterial support.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim: 'Supports only the deterministic pressure and flow directions represented here.',
      },
    ],
  },

  'va-afterload-oxygenator-resistance': {
    scenarioId: 'va-afterload-oxygenator-resistance',
    supportMode: 'va',
    clinicalQuestion:
      'At an unchanged speed request, flow and the two post-pump pressure channels no longer match their earlier relationship. Which locations and concurrent observations need comparison before the change is assigned?',
    signalRows: (state) => [
      ...vaCoreRows(state),
      pressureRow(
        'Membrane pressure drop',
        'Derived across the membrane from pInt and pArt',
        state.circuit.readouts.deltaP,
        'A flow-dependent gradient that requires an earlier comparable-flow value.',
        'transmembraneDeltaP',
      ),
      offConsoleSignalRow(
        'Post-oxygenator saturation',
        'Sample after the membrane on the return limb',
        livePercent(state.circuit.postOxygenatorSaturation, 1),
        'A modeled off-console sample; it does not by itself establish membrane health.',
        'postOxygenatorSaturation',
      ),
    ],
    signalSummary: (state) =>
      `At ${liveNumber(state.device.rpmSetpoint, 'rpm')}, circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pInt is ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt is ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, membrane pressure drop is ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')}, and post-oxygenator saturation is ${livePercent(state.circuit.postOxygenatorSaturation, 1)}.`,
    patternRows: (state) => [
      {
        label: 'Pump request and flow',
        reading: `${liveNumber(state.device.rpmSetpoint, 'rpm')} and ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}`,
        movement: 'Compare the delivered flow with the unchanged request.',
      },
      {
        label: 'Pre- and post-membrane pressures',
        reading: `pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}; pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}`,
        movement: 'Read whether the two values move together or separate.',
      },
      {
        label: 'Membrane gradient',
        reading: pressureText(
          'membrane pressure drop',
          state.circuit.readouts.deltaP,
          'transmembraneDeltaP',
        ),
        movement: 'Compare with this circuit earlier at a similar flow.',
      },
      {
        label: 'Gas-transfer sample',
        reading: `Post-oxygenator saturation ${livePercent(state.circuit.postOxygenatorSaturation, 1)}`,
        movement: 'Read with the pressure pattern and gas path, not alone.',
      },
    ],
    patternSummary: (state) =>
      `The current cross-component comparison is pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')} versus pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, with membrane pressure drop ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')} at flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)} and post-oxygenator saturation ${livePercent(state.circuit.postOxygenatorSaturation, 1)}.`,
    discriminators: [
      {
        question: 'Which post-pump observations changed together, and which separated?',
        whereToLook: 'The two channel values and their concurrent flow snapshot.',
      },
      {
        question: 'Which operating conditions were comparable between the retained frames?',
        whereToLook:
          'Flow and speed history, blood-property context, channel availability, and the full circuit inspection.',
      },
      {
        question:
          'Do gas-transfer observations and physical circuit inspection support the same location?',
        whereToLook:
          'Post-oxygenator sample, gas path, membrane appearance, and sensor plausibility.',
      },
    ],
    mechanism:
      'The pattern best fits increased resistance or dysfunction across the membrane lung: pressure before the membrane rises relative to pressure after it, the cross-membrane gradient increases at comparable flow, and available circuit flow can become constrained.',
    competingExplanations: [
      {
        candidate: 'Resistance in the arterial return pathway',
        standing:
          'That becomes more likely when pInt and pArt rise together while the cross-membrane gradient remains comparatively unchanged.',
      },
      {
        candidate: 'Changed flow, viscosity, temperature, or a pressure-channel problem',
        standing:
          'Each can alter a gradient or its apparent trend, so matched-flow comparison and sensor plausibility remain necessary.',
      },
    ],
    fittingResponse:
      'Confirm the pressure relationship at comparable flow, inspect sensor plausibility and membrane/gas-transfer findings, protect ongoing support, and escalate through the reviewed local circuit-exchange pathway without inventing a fixed cutoff.',
    responseByDomain: {
      device:
        'Trend pInt, pArt, membrane pressure drop, speed, and flow together; do not convert one gradient into an alarm rule.',
      circuitOrGas:
        'Inspect the membrane lung, circuit, pressure channels, and gas-transfer sample, and activate the reviewed circuit-response pathway.',
      patient:
        'Reassess MAP, perfusion, upper-body oxygenation, and native-heart contribution while support is protected.',
    },
    harmfulReflex: {
      action: 'Increasing pump speed repeatedly to restore the flow number.',
      explanation:
        'More pump demand does not remove a cross-component restriction and can add circuit stress while delaying confirmation and escalation.',
    },
    boundaries: [
      'The model uses an authored resistance coefficient and cannot predict clot burden, hemolysis, or the response magnitude of a real circuit.',
      'No universal membrane pressure-drop threshold or alarm priority is encoded because the supplied source set does not support one.',
      'Higher pump speed may briefly raise displayed flow and MAP in this bounded model while pInt and the membrane pressure difference worsen. That apparent benefit does not correct the represented membrane problem and earns no corrective credit.',
      'This draft does not teach or simulate the hands-on component-exchange procedure.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial membrane-pattern draft. Pump speed is ${liveNumber(state.device.rpmSetpoint, 'rpm')}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, membrane pressure drop ${pressureText('membrane pressure drop', state.circuit.readouts.deltaP, 'transmembraneDeltaP')}, and post-oxygenator saturation ${livePercent(state.circuit.postOxygenatorSaturation, 1)}. After commitment, the panel identifies increased resistance or dysfunction across the membrane, retains arterial-return resistance and changed-flow, viscosity, temperature, or sensor explanations, and calls for matched-flow confirmation, circuit and gas-transfer inspection, protection of support, and reviewed escalation. Repeated speed escalation is the harmful reflex: higher RPM can briefly raise displayed flow and MAP while pInt and the membrane pressure difference worsen, so that apparent benefit is not correction. The resistance coefficient is authored, no universal gradient threshold or alarm priority is encoded, and component exchange is not simulated.`,
    sourceSupport: [
      {
        evidenceId: 'ecmo-book-ch9',
        claim: 'Supports circuit pressure zones and centrifugal-pump sensitivity to resistance.',
      },
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'Supports circuit-component monitoring, emergency planning, and safety context.',
      },
      {
        evidenceId: 'ifu-anomaly-boundary',
        claim: 'Supports withholding a fixed pressure-drop alarm-priority claim from this module.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the deterministic resistance, pressure, flow, and sample directions displayed here.',
      },
    ],
  },

  'va-lv-loading': {
    scenarioId: 'va-lv-loading',
    supportMode: 'va',
    clinicalQuestion:
      'Circuit flow and patient mean arterial pressure appear reassuring, while independent native-heart and lung observations do not. What does each domain establish, and what remains unmeasured by the console?',
    signalRows: (state) => [
      ...vaCoreRows(state),
      offConsoleSignalRow(
        'Pulse pressure',
        'Independent patient arterial line',
        liveNumber(state.patient.pulsePressure, 'mmHg'),
        'One waveform clue to native ejection; it is not a console channel or a standalone threshold.',
        'pulsePressure',
      ),
      valueSignalRow(
        'Aortic-valve opening',
        'Modeled echocardiographic observation',
        state.patient.aorticValveOpening ? 'Opening represented' : 'No opening represented',
        'A simplified off-console state label; the simulation does not render echocardiography.',
        'estimated',
      ),
      valueSignalRow(
        'Native cardiac output',
        'Latent educational-model estimate',
        liveNumber(state.patient.nativeCardiacOutputLpm, 'L/min', 1),
        'A model estimate rather than a CARDIOHELP measurement.',
        'estimated',
        'nativeCardiacOutput',
      ),
      valueSignalRow(
        'Pulmonary congestion',
        'Independent lung and imaging assessment',
        pulmonaryCongestionLabels[state.patient.pulmonaryCongestion],
        'A simplified clinical state label outside the console.',
        'off-console',
      ),
      valueSignalRow(
        'Observed breathing effort',
        'Patient bedside assessment',
        workOfBreathingLabels[state.patient.workOfBreathing],
        'A bedside state represented without ventilator waveforms or examination detail.',
        'off-console',
      ),
    ],
    signalSummary: (state) =>
      `Circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)} and patient mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}; independently, pulse pressure is ${liveNumber(state.patient.pulsePressure, 'mmHg')}, aortic-valve opening is ${state.patient.aorticValveOpening ? 'represented' : 'not represented'}, native output is ${liveNumber(state.patient.nativeCardiacOutputLpm, 'L/min', 1)}, and pulmonary congestion is ${pulmonaryCongestionLabels[state.patient.pulmonaryCongestion].toLowerCase()}.`,
    patternRows: (state) => [
      {
        label: 'Circuit contribution',
        reading: `Flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)} at ${liveNumber(state.device.rpmSetpoint, 'rpm')}`,
        movement:
          'Read as circuit delivery rather than total systemic or native-heart performance.',
      },
      {
        label: 'Patient pressure',
        reading: `Mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}`,
        movement: 'Compare with perfusion and the native-heart observations below.',
      },
      {
        label: 'Native ejection observations',
        reading: `Pulse pressure ${liveNumber(state.patient.pulsePressure, 'mmHg')}; aortic valve ${state.patient.aorticValveOpening ? 'opening represented' : 'no opening represented'}; native output ${liveNumber(state.patient.nativeCardiacOutputLpm, 'L/min', 1)}`,
        movement: 'Read these off-console observations together.',
      },
      {
        label: 'Lung observations',
        reading: `${pulmonaryCongestionLabels[state.patient.pulmonaryCongestion]}; ${workOfBreathingLabels[state.patient.workOfBreathing]}`,
        movement: 'Compare with the native-heart observations rather than with circuit flow alone.',
      },
    ],
    patternSummary: (state) =>
      `The snapshot contains circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, patient mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}, pulse pressure ${liveNumber(state.patient.pulsePressure, 'mmHg')}, aortic-valve opening ${state.patient.aorticValveOpening ? 'represented' : 'not represented'}, native output ${liveNumber(state.patient.nativeCardiacOutputLpm, 'L/min', 1)}, and ${pulmonaryCongestionLabels[state.patient.pulmonaryCongestion].toLowerCase()}.`,
    discriminators: [
      {
        question:
          'Does the arterial waveform show meaningful native pulsatility, and is the aortic valve represented as opening?',
        whereToLook: 'Independent pulse pressure and the modeled echocardiographic state.',
      },
      {
        question:
          'Do the lung observations agree with the apparently reassuring circuit flow and patient pressure?',
        whereToLook:
          'Pulmonary congestion, breathing effort, and independent imaging or examination.',
      },
      {
        question:
          'Could rhythm, valve disease, monitoring quality, vascular tone, or loading conditions explain part of the off-console pattern?',
        whereToLook: 'The patient waveform, echocardiography, examination, and perfusion data.',
      },
    ],
    mechanism:
      'The pattern is concerning for left-ventricular loading with inadequate native ejection during peripheral femoral venoarterial support. Retrograde arterial support can increase left-heart afterload, so acceptable circuit flow and MAP can coexist with narrow pulsatility, absent aortic-valve opening, and pulmonary congestion.',
    competingExplanations: [
      {
        candidate: 'A waveform or monitoring problem',
        standing:
          'Poor signal quality or an altered arterial site can change pulse pressure and must be checked against echocardiography and examination.',
      },
      {
        candidate: 'Primary lung disease without a left-heart contribution',
        standing:
          'Lung injury can explain congestion or breathing effort, but it does not by itself settle the valve-opening and native-ejection observations.',
      },
    ],
    fittingResponse:
      'Treat the console values as incomplete: urgently integrate the arterial waveform, aortic-valve opening, left-heart imaging, lung findings, and perfusion, then escalate for expert unloading evaluation under the reviewed local protocol.',
    responseByDomain: {
      device:
        'Confirm circuit flow and speed without treating either as evidence that the left ventricle is ejecting adequately.',
      circuitOrGas:
        'Inspect circuit function and gas transfer while preserving the distinction between circuit delivery and native-heart performance.',
      patient:
        'Reassess pulsatility, valve opening, left-heart size or stasis, pulmonary findings, and systemic perfusion; escalate urgently to the ECMO team.',
    },
    harmfulReflex: {
      action: 'Increasing pump speed or reassuring the team from circuit flow and MAP alone.',
      explanation:
        'Those values can remain acceptable or improve while native ejection stays poor and pulmonary consequences remain outside the console. More retrograde circuit demand is not a substitute for characterizing the native-heart pattern and can increase the load the ventricle faces.',
    },
    boundaries: [
      'The simulation reduces echocardiography, valve opening, congestion, and native output to simplified state labels and estimates.',
      'In this VA model, work of breathing does not change in response to the represented loading correction. It remains a clinical reassessment obligation, not a responsive signal that can validate the action here.',
      'No pulse-pressure, MAP, flow, or imaging value is an unloading threshold in this draft.',
      'No unloading device, cannulation strategy, or hands-on intervention is selected or simulated here.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial native-heart draft. Circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)} at ${liveNumber(state.device.rpmSetpoint, 'rpm')}, patient mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}, pulse pressure ${liveNumber(state.patient.pulsePressure, 'mmHg')}, aortic-valve opening ${state.patient.aorticValveOpening ? 'represented' : 'not represented'}, native cardiac output ${liveNumber(state.patient.nativeCardiacOutputLpm, 'L/min', 1)}, pulmonary congestion ${pulmonaryCongestionLabels[state.patient.pulmonaryCongestion].toLowerCase()}, and breathing effort ${workOfBreathingLabels[state.patient.workOfBreathing].toLowerCase()}. After commitment, the panel identifies concerning left-ventricular loading with inadequate native ejection, retains monitoring artifact and primary lung disease as competitors, and calls for urgent integration of waveform, echo, lung, and perfusion findings with expert escalation. Increasing pump speed or taking reassurance from circuit flow and MAP alone is the harmful reflex. Echo and loading are simplified, work of breathing does not change in this VA response and cannot validate it, no number is an unloading threshold, and no unloading device or procedure is selected.`,
    sourceSupport: [
      {
        evidenceId: 'elso-adult-va-2021',
        claim:
          'Supports recognition of native ejection, left-ventricular loading, and the need for independent patient assessment during adult VA support.',
      },
      {
        evidenceId: 'ecmo-book-ch17',
        claim:
          'Supports interpreting circuit blood flow as a titrated dose rather than a complete patient endpoint.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the simplified pulse-pressure, valve, native-output, congestion, and recovery states represented here.',
      },
    ],
  },

  'va-acute-hypercapnia': {
    scenarioId: 'va-acute-hypercapnia',
    supportMode: 'va',
    clinicalQuestion:
      'The blood-gas pattern and observed breathing effort have changed while peripheral femoral venoarterial support continues. Which control domain is relevant, and which circulatory and regional observations must remain separate?',
    signalRows: (state) => [
      valueSignalRow(
        'External sweep-gas flow',
        'External gas blender or flowmeter',
        liveNumber(state.gas.sweepLpm, 'L/min', 1),
        'A configured gas-path value outside the CARDIOHELP touchscreen.',
        'configured',
        'sweepGasFlow',
      ),
      valueSignalRow(
        'Sweep-gas oxygen fraction',
        'External gas blender',
        livePercent(state.gas.fio2 * 100),
        'A gas composition setting distinct from sweep-gas flow and circuit blood flow.',
        'configured',
        'sweepGasOxygenFraction',
      ),
      valueSignalRow(
        'Circuit blood flow',
        'Return-limb flow probe',
        liveNumber(state.circuit.bloodFlow, 'L/min', 2),
        'Circuit flow supports the parallel circulation but is not the external gas-flow control.',
        'valid',
        'circuitBloodFlow',
      ),
      offConsoleSignalRow(
        'Arterial carbon dioxide',
        'Independent arterial blood gas',
        liveNumber(state.patient.paCO2, 'mmHg'),
        'A modeled blood-gas result rather than a console channel.',
        'arterialCarbonDioxide',
      ),
      offConsoleSignalRow(
        'Arterial pH',
        'Independent arterial blood gas',
        liveNumber(state.patient.pH, '', 2).trim(),
        'A modeled blood-gas value interpreted with carbon dioxide, bicarbonate, and phase.',
        'arterialPh',
      ),
      offConsoleSignalRow(
        'Bicarbonate',
        'Independent arterial blood gas',
        liveNumber(state.patient.bicarbonate, 'mmol/L'),
        'A modeled acid-base value used with pH and carbon dioxide.',
        'bicarbonate',
      ),
      valueSignalRow(
        'Observed breathing effort',
        'Patient bedside assessment',
        workOfBreathingLabels[state.patient.workOfBreathing],
        'A simplified bedside state rather than a console measurement.',
        'off-console',
      ),
      offConsoleSignalRow(
        'Right-radial saturation',
        'Independent upper-body monitor',
        livePercent(state.patient.rightRadialSpo2, 1),
        'A regional patient value that must remain part of VA assessment.',
        'rightRadialSaturation',
      ),
      offConsoleSignalRow(
        'Patient mean arterial pressure',
        'Independent patient arterial line',
        liveNumber(state.patient.meanArterialPressure, 'mmHg'),
        'A circulatory value outside the gas-path decision.',
        'meanArterialPressure',
      ),
    ],
    signalSummary: (state) =>
      `External sweep-gas flow is ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, sweep-gas oxygen fraction ${livePercent(state.gas.fio2 * 100)}, arterial carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, pH ${state.patient.pH.toFixed(2)}, bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}, and breathing effort ${workOfBreathingLabels[state.patient.workOfBreathing].toLowerCase()}. Circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}, and mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}.`,
    patternRows: (state) => [
      {
        label: 'External gas settings',
        reading: `Sweep ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}; oxygen fraction ${livePercent(state.gas.fio2 * 100)}`,
        movement: 'Read these as two separate settings on the external gas path.',
      },
      {
        label: 'Blood-gas context',
        reading: `Carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}; pH ${state.patient.pH.toFixed(2)}; bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}`,
        movement: 'Interpret the three together and with the phase of support.',
      },
      {
        label: 'Patient effort',
        reading: workOfBreathingLabels[state.patient.workOfBreathing],
        movement: 'Compare with the blood-gas pattern rather than one value alone.',
      },
      {
        label: 'VA circulation and region',
        reading: `Flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}; right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}; MAP ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}`,
        movement: 'Continue reading these independently of the current acid-base question.',
      },
    ],
    patternSummary: (state) =>
      `The current gas and patient snapshot is sweep ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, pH ${state.patient.pH.toFixed(2)}, bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}, ${workOfBreathingLabels[state.patient.workOfBreathing].toLowerCase()}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    discriminators: [
      {
        question:
          'What do pH and bicarbonate add to the carbon-dioxide value about the phase of the change?',
        whereToLook: 'The complete blood-gas set and the stated phase of support.',
      },
      {
        question:
          'Are external sweep-gas flow and sweep-gas oxygen fraction being treated as distinct settings?',
        whereToLook: 'The two separate rows on the external gas panel.',
      },
      {
        question:
          'Could source continuity, native ventilation, production, sampling, or another metabolic process contribute?',
        whereToLook:
          'Gas-source state, patient/ventilator assessment, repeat blood gas, and the broader clinical context.',
      },
    ],
    mechanism:
      'The pattern is acute hypercapnic acidemia with insufficient membrane carbon-dioxide clearance for the current stabilization goal. External sweep-gas flow is the primary modeled carbon-dioxide control; it is distinct from pump speed, circuit blood flow, and sweep-gas oxygen fraction.',
    competingExplanations: [
      {
        candidate: 'A left-ventricular loading problem that should be characterized first',
        standing:
          'That concern remains clinically important, but it requires reduced pulsatility, impaired aortic-valve opening, worsening lung findings, or other loading evidence rather than high effort and this blood gas alone.',
      },
      {
        candidate: 'Interrupted or ineffective external gas delivery',
        standing:
          'A disconnected source or failed gas path can produce a similar blood-gas pattern and must be checked before interpreting a setpoint as delivered flow.',
      },
      {
        candidate: 'A ventilation, production, sampling, or mixed acid-base problem',
        standing:
          'Those remain plausible when the broader patient context or repeat blood gas does not fit a primary sweep-side limitation.',
      },
    ],
    fittingResponse:
      'Name the carbon-dioxide and pH goal, verify gas-source continuity, make the bounded external sweep adjustment authored by the lesson, and reassess the blood gas, work of breathing, right-arm oxygenation, circulation, and native lungs.',
    responseByDomain: {
      device:
        'Leave pump and pressure interpretation separate from the gas-path adjustment; confirm ongoing circuit flow and alarms.',
      circuitOrGas:
        'Verify source continuity and adjust external sweep-gas flow without confusing it with sweep-gas oxygen fraction.',
      patient:
        'Reassess carbon dioxide, pH, bicarbonate, effort, native ventilation, right-arm oxygenation, MAP, and perfusion.',
      circuitOrGasLabel: 'Gas path',
    },
    harmfulReflex: {
      action:
        'Escalating vasopressor support, pump speed, or sweep-gas oxygen fraction to correct this carbon-dioxide pattern.',
      explanation:
        'The blood gas identifies a respiratory acid-base problem while the authored perfusion observations do not establish shock. Those controls answer different questions, can add VA afterload, and make the next observation harder to interpret without correcting the primary modeled carbon-dioxide-control problem.',
    },
    boundaries: [
      'The blood-gas response curve and its speed are simplified; no exact response magnitude or bedside timing is predicted.',
      'Ventilator mechanics, carbon-dioxide production, sampling delay, and mixed metabolic disorders are not fully represented.',
      'In this VA model, work of breathing does not change through the represented sweep response. It is a clinical reassessment obligation, not a responsive signal that can validate the modeled action.',
      'No sweep value, pH, or carbon-dioxide value in this case is a universal prescription or target.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial carbon-dioxide-control draft. External sweep is ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, sweep-gas oxygen fraction ${livePercent(state.gas.fio2 * 100)}, arterial carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, pH ${state.patient.pH.toFixed(2)}, bicarbonate ${liveNumber(state.patient.bicarbonate, 'mmol/L')}, and breathing effort ${workOfBreathingLabels[state.patient.workOfBreathing].toLowerCase()}. Circuit flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}, and mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}. After commitment, the panel identifies acute hypercapnic acidemia with insufficient modeled membrane carbon-dioxide clearance, retains gas-delivery failure and ventilation, production, sampling, mixed acid-base, or LV-loading explanations, and calls for source verification, a bounded authored sweep adjustment, and full gas, regional, and circulatory reassessment. Escalating vasopressor support, pump speed, or sweep-gas oxygen fraction for carbon dioxide is the harmful reflex. The response kinetics are simplified, work of breathing does not change in this VA response and cannot validate it, omitted contributors remain possible, and no displayed value is a universal target.`,
    sourceSupport: [
      {
        evidenceId: 'ecmo-book-ch18',
        claim:
          'Supports sweep-gas flow as the primary membrane carbon-dioxide control and its distinction from sweep-gas oxygen fraction.',
      },
      {
        evidenceId: 'ecmo-book-ch16',
        claim: 'Supports naming a patient-centered support goal before changing the support dose.',
      },
      {
        evidenceId: 'elso-adult-va-2021',
        claim:
          'Supports continued independent circulatory and patient assessment during adult VA support.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the deterministic blood-gas direction and authored response curve represented here.',
      },
    ],
  },

  'va-gas-source-interruption': {
    scenarioId: 'va-gas-source-interruption',
    supportMode: 'va',
    clinicalQuestion:
      'Circuit blood flow continues while gas-transfer and patient observations change. Which claims can the console establish, and which essential off-console gas-path fact remains unverified?',
    signalRows: (state) => [
      valueSignalRow(
        'External gas-path status',
        'External equipment feeding the membrane',
        'Requires bedside verification',
        'The CARDIOHELP console cannot establish whether this external path is continuous or delivering gas.',
        'bedside',
      ),
      valueSignalRow(
        'External sweep-gas flow setting',
        'External gas blender or flowmeter',
        liveNumber(state.gas.sweepLpm, 'L/min', 1),
        'A requested gas flow; a setpoint is not proof that gas reaches the membrane.',
        'configured',
        'sweepGasFlow',
      ),
      valueSignalRow(
        'Sweep-gas oxygen fraction',
        'External gas blender',
        livePercent(state.gas.fio2 * 100),
        'A gas composition setting distinct from continuity and sweep-gas flow.',
        'configured',
        'sweepGasOxygenFraction',
      ),
      valueSignalRow(
        'Circuit blood flow',
        'Arterial return-limb flow probe',
        liveNumber(state.circuit.bloodFlow, 'L/min', 2),
        'Evidence that the blood pump is moving blood, not that membrane gas transfer is intact.',
        'valid',
        'circuitBloodFlow',
      ),
      pressureRow(
        'pVen',
        'Femoral venous drainage limb before the pump',
        state.circuit.readouts.pVen,
        'A blood-path pressure channel.',
        'pVen',
      ),
      pressureRow(
        'pInt',
        'After the pump and before the membrane',
        state.circuit.readouts.pInt,
        'A blood-path pressure channel.',
        'pInt',
      ),
      pressureRow(
        'pArt',
        'After the membrane on the arterial return limb',
        state.circuit.readouts.pArt,
        'A blood-path pressure channel, not patient arterial pressure.',
        'pArt',
      ),
      offConsoleSignalRow(
        'Post-oxygenator saturation',
        'Sample from blood leaving the membrane',
        livePercent(state.circuit.postOxygenatorSaturation, 1),
        'A modeled off-console sample of returned blood.',
        'postOxygenatorSaturation',
      ),
      offConsoleSignalRow(
        'Arterial carbon dioxide',
        'Independent patient blood gas',
        liveNumber(state.patient.paCO2, 'mmHg'),
        'A modeled patient value outside the console.',
        'arterialCarbonDioxide',
      ),
      offConsoleSignalRow(
        'Right-radial saturation',
        'Independent upper-body monitor',
        livePercent(state.patient.rightRadialSpo2, 1),
        'A regional patient value during peripheral femoral VA support.',
        'rightRadialSaturation',
      ),
    ],
    signalSummary: (state) =>
      `External gas-path status requires bedside verification; the external sweep setting is ${liveNumber(state.gas.sweepLpm, 'L/min', 1)} and oxygen fraction ${livePercent(state.gas.fio2 * 100)}. Circuit blood flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, post-oxygenator saturation ${livePercent(state.circuit.postOxygenatorSaturation, 1)}, arterial carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    patternRows: (state) => [
      {
        label: 'External gas-path status',
        reading: `Bedside verification required; sweep setting ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}; oxygen fraction ${livePercent(state.gas.fio2 * 100)}`,
        movement: 'Keep the unverified physical state separate from the two configured settings.',
      },
      {
        label: 'Blood-path operation',
        reading: `Flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}; pVen ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}; pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}; pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}`,
        movement: 'Read as blood-path evidence only.',
      },
      {
        label: 'Membrane-output sample',
        reading: livePercent(state.circuit.postOxygenatorSaturation, 1),
        movement: 'Compare with bedside gas-path verification and patient values.',
      },
      {
        label: 'Patient gas and region',
        reading: `Carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}; right radial ${livePercent(state.patient.rightRadialSpo2, 1)}`,
        movement: 'Read both independently of the circuit-flow display.',
      },
    ],
    patternSummary: (state) =>
      `External gas-path status remains a bedside question. The visible pattern combines a sweep setting of ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, ongoing circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, post-oxygenator saturation ${livePercent(state.circuit.postOxygenatorSaturation, 1)}, arterial carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    discriminators: [
      {
        question: 'Which live state is not represented by either configured gas setting?',
        whereToLook:
          'The off-console equipment and an appropriate bedside verification; the console cannot answer this.',
      },
      {
        question:
          'Have the circuit-flow and pressure observations changed with the gas-path observations?',
        whereToLook:
          'Flow and all three pressure channels beside source state and gas-transfer samples.',
      },
      {
        question:
          'Could a membrane, patient-lung, sampling, or regional-circulation issue produce part of the same patient pattern?',
        whereToLook:
          'Post-oxygenator data, native-lung assessment, repeat blood gas, and right-arm monitoring.',
      },
    ],
    mechanism:
      'The pattern is an interruption of the external sweep-gas source during ongoing peripheral femoral venoarterial blood flow. The pump can continue arterial return while absent gas delivery removes membrane carbon-dioxide clearance and oxygen-transfer contribution.',
    competingExplanations: [
      {
        candidate: 'Membrane dysfunction with intact external gas delivery',
        standing:
          'That remains plausible if source continuity is verified but post-oxygenator transfer and the pressure/gas pattern remain abnormal.',
      },
      {
        candidate: 'Native-lung, sampling, or regional mixed-circulation change',
        standing:
          'Those can change patient values and require right-arm, lung, and repeat-sample assessment even after the gas path is restored.',
      },
    ],
    fittingResponse:
      'Inspect the external gas path, restore verified source continuity, and then reassess actual gas delivery, post-oxygenator transfer, blood gas, right-arm oxygenation, circuit flow, and perfusion.',
    responseByDomain: {
      device:
        'Confirm ongoing pump operation, flow, pressure channels, and alarms without treating litres per minute as proof of gas exchange.',
      circuitOrGas:
        'Inspect source, blender, and line to the membrane; restore verified continuity and confirm delivery rather than only the setpoint.',
      patient:
        'Reassess carbon dioxide and pH, right-arm oxygenation, native lungs, MAP, perfusion, and the clinical response.',
      circuitOrGasLabel: 'Gas path',
    },
    harmfulReflex: {
      action: 'Changing sweep, oxygen fraction, or pump speed before confirming source continuity.',
      explanation:
        'A setpoint cannot deliver gas through an interrupted source path, and pump flow answers the blood path rather than the missing gas path.',
    },
    boundaries: [
      'The console cannot establish physical continuity from source through blender and tubing to the membrane; those off-console components are not represented connection by connection.',
      'The gas-transfer response is a bounded educational curve and does not predict an exact bedside magnitude or time course.',
      'Ongoing circuit flow in this model does not establish total systemic perfusion or regional oxygen delivery.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial gas-source draft. The external source is ${state.gas.sourceConnected ? 'connected' : 'interrupted'}, sweep setting ${liveNumber(state.gas.sweepLpm, 'L/min', 1)}, sweep-gas oxygen fraction ${livePercent(state.gas.fio2 * 100)}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pVen ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}, pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, post-oxygenator saturation ${livePercent(state.circuit.postOxygenatorSaturation, 1)}, arterial carbon dioxide ${liveNumber(state.patient.paCO2, 'mmHg')}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}. After commitment, the panel identifies external sweep-gas interruption with ongoing arterial circuit flow, retains membrane dysfunction and native-lung, sampling, or regional explanations, and calls for verified source restoration plus gas, circuit, regional, and perfusion reassessment. Changing settings before confirming source continuity is the harmful reflex. The physical gas system is collapsed to one state, response kinetics are authored, and ongoing flow does not establish systemic or regional delivery.`,
    sourceSupport: [
      {
        evidenceId: 'ecmo-book-ch18',
        claim:
          'Supports the role of external sweep gas in membrane carbon-dioxide clearance and its distinction from blood flow.',
      },
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'Supports circuit-component monitoring and emergency gas-path safety context.',
      },
      {
        evidenceId: 'elso-adult-va-2021',
        claim:
          'Supports independent regional, circulatory, and patient assessment during adult VA support.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the source-state switch and deterministic gas-transfer response shown here.',
      },
    ],
  },

  'va-arterial-bubble-stop': {
    scenarioId: 'va-arterial-bubble-stop',
    supportMode: 'va',
    clinicalQuestion:
      'A protective return-side intervention is active and forward circuit flow has stopped. Which device, physical-circuit, and patient facts are established, and which remain separate before the next action?',
    signalRows: (state) => [
      valueSignalRow(
        'Pump state',
        'CARDIOHELP console and pump head',
        pumpState(state),
        'A device state that answers only whether the pump is turning.',
        'valid',
      ),
      valueSignalRow(
        'Circuit blood flow',
        'Arterial return-limb flow probe',
        liveNumber(state.circuit.bloodFlow, 'L/min', 2),
        'A measured circuit-flow state, not the same fact as clamp position.',
        'valid',
        'circuitBloodFlow',
      ),
      valueSignalRow(
        'Protective return-side intervention',
        'Post-oxygenator arterial return protection state',
        state.circuit.arterialBubbleDetected ? 'Intervention active' : 'Intervention not active',
        'A device/circuit protection state that must be read separately from pump, latch, and clamp states.',
        'valid',
      ),
      valueSignalRow(
        'Reset latch',
        'CARDIOHELP intervention state',
        state.circuit.bubbleResetRequired ? 'Reset remains required' : 'No reset requirement shown',
        'A device state separate from the physical circuit and patient observations.',
        'valid',
      ),
      valueSignalRow(
        'Arterial return clamp',
        'Return limb near the patient',
        clampState(state.circuit.returnClampClosed),
        'A bedside physical state with no console channel confirming its position.',
        'bedside',
      ),
      valueSignalRow(
        'Venous drainage clamp',
        'Drainage limb near the patient',
        clampState(state.circuit.drainageClampClosed),
        'A second bedside physical state with no console channel confirming its position.',
        'bedside',
      ),
      offConsoleSignalRow(
        'Patient mean arterial pressure',
        'Independent patient arterial line',
        liveNumber(state.patient.meanArterialPressure, 'mmHg'),
        'A patient perfusion value during interrupted forward VA support.',
        'meanArterialPressure',
      ),
      offConsoleSignalRow(
        'Right-radial saturation',
        'Independent upper-body monitor',
        livePercent(state.patient.rightRadialSpo2, 1),
        'A regional patient observation outside the console.',
        'rightRadialSaturation',
      ),
    ],
    signalSummary: (state) =>
      `${pumpState(state)} with circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}. The protective return-side intervention is ${state.circuit.arterialBubbleDetected ? 'active' : 'not active'}, reset is ${state.circuit.bubbleResetRequired ? 'still required' : 'not required'}, the arterial return clamp is ${clampState(state.circuit.returnClampClosed).toLowerCase()}, the venous drainage clamp is ${clampState(state.circuit.drainageClampClosed).toLowerCase()}, patient mean arterial pressure is ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}, and right-radial saturation is ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    patternRows: (state) => [
      {
        label: 'Device state',
        reading: `${pumpState(state)}; reset ${state.circuit.bubbleResetRequired ? 'required' : 'not required'}`,
        movement:
          'Read as device facts, not as proof of isolation or correction of the initiating cause.',
      },
      {
        label: 'Two bedside circuit states',
        reading: `Arterial return clamp ${clampState(state.circuit.returnClampClosed)}; venous drainage clamp ${clampState(state.circuit.drainageClampClosed)}`,
        movement: 'Read each limb at the patient and keep both separate from device status.',
      },
      {
        label: 'Return-side protection state',
        reading: state.circuit.arterialBubbleDetected
          ? 'Protective intervention active'
          : 'Protective intervention not active',
        movement: 'Read separately from pump, latch, clamp, and patient states.',
      },
      {
        label: 'Patient state',
        reading: `MAP ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}; right radial ${livePercent(state.patient.rightRadialSpo2, 1)}`,
        movement: 'Read during the interruption of forward circuit support.',
      },
    ],
    patternSummary: (state) =>
      `The current state separates ${pumpState(state).toLowerCase()}, flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, an ${state.circuit.arterialBubbleDetected ? 'active' : 'inactive'} protective return-side intervention, return clamp ${clampState(state.circuit.returnClampClosed).toLowerCase()}, drainage clamp ${clampState(state.circuit.drainageClampClosed).toLowerCase()}, and patient MAP ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}.`,
    discriminators: [
      {
        question: 'Which facts come from the device, and which require direct bedside observation?',
        whereToLook: 'Pump, latch, and protection state beside the two physical clamp states.',
      },
      {
        question: 'Does the location of the protective indication establish the initiating cause?',
        whereToLook:
          'The full drainage-to-return circuit inspection and recently handled connections.',
      },
      {
        question: 'Which state transitions have occurred, and which have not?',
        whereToLook:
          'The event history, physical circuit observations, return-path assessment, and reset latch.',
      },
    ],
    mechanism:
      'This is a scenario-triggered arterial-return bubble intervention with automatic pump stop during peripheral femoral venoarterial support. The device stop interrupts forward support but does not physically isolate the patient or identify and correct the air source.',
    competingExplanations: [
      {
        candidate: 'A false or implausible detection state',
        standing:
          'Sensor plausibility must be considered, but the patient remains protected as an air event until the circuit and source are inspected and cleared under protocol.',
      },
      {
        candidate: 'The membrane lung is necessarily the entry source',
        standing:
          'The return-side detection location says where air was found, not where it entered; the entire negative-pressure and recently handled path remains relevant.',
      },
    ],
    fittingResponse:
      'Perform near-patient circuit isolation and source control in the order required by the current IFU and approved local air-emergency protocol, identify and correct the source, confirm the circuit clear, and resume support only through that reviewed workflow.',
    responseByDomain: {
      device:
        'Confirm pump/intervention state and keep acknowledgement or reset separate from source correction and protocol-governed resumption.',
      circuitOrGas:
        'Confirm the protocol-required near-patient isolation state, inspect the full circuit, correct the entry source, and establish that the arterial return path is clear.',
      patient:
        'Provide the program-approved support while off circuit and reassess MAP, perfusion, right-arm oxygenation, and clinical state throughout.',
    },
    harmfulReflex: {
      action: 'Acknowledging or resetting the device before isolation and source correction.',
      explanation:
        'A device-state change neither removes circuit air nor prevents an unisolated arterial return path from exposing the patient.',
    },
    boundaries: [
      'The event has no modeled event quantity and no encoded numerical trigger threshold because the supplied IFU record is internally inconsistent on that value.',
      'The engine models an ordered clamp sequence, but the registered evidence metadata does not establish that order as a transferable bedside procedure. This draft therefore defers physical ordering to the current IFU and approved local protocol and remains on hold for source confirmation.',
      'Clamp, reset, and bounded-resumption actions can recompute patient values without elapsed model time. Do not interpret same-timestamp patient movement as physiology caused by clamp manipulation; only an explicit time-stepped trajectory may support a temporal inference.',
      'The simulation represents protective preconditions but not the exact ordering of clamp opening, pump restart, and console reset during resumption.',
      'The response is one bounded model state; it does not certify hands-on circuit-emergency or backup-circulation competency.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial air-event draft. The pump is ${state.device.pumpRunning ? 'turning' : 'stopped'}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, the return-side air indication is ${state.circuit.arterialBubbleDetected ? 'present' : 'not active'}, reset is ${state.circuit.bubbleResetRequired ? 'required' : 'not required'}, the arterial return clamp is ${clampState(state.circuit.returnClampClosed).toLowerCase()}, the venous drainage clamp is ${clampState(state.circuit.drainageClampClosed).toLowerCase()}, patient mean arterial pressure is ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}. After commitment, the panel identifies a scenario-triggered arterial-return bubble intervention with pump stop, retains sensor plausibility and an uncertain entry source as competitors, and calls for protocol-governed isolation, source correction, circuit clearance, patient support, and resumption. Reset before isolation and correction is the harmful reflex. Registered evidence does not establish the engine's clamp order as a transferable procedure, so physical ordering defers to the current IFU and approved local protocol. Clamp, reset, and resumption actions can also recompute patient values without elapsed time; same-timestamp movement is not physiological evidence caused by clamp manipulation. There is no bubble volume or numerical threshold, exact resumption choreography is outside this simulation, and this panel does not certify air-emergency competency.`,
    sourceSupport: [
      {
        evidenceId: 'ifu-console-workflow',
        claim:
          'Supports the represented CARDIOHELP bubble-intervention and device-state workflow only.',
      },
      {
        evidenceId: 'ifu-anomaly-boundary',
        claim:
          'Supports withholding a numerical bubble trigger because the supplied manufacturer record is internally inconsistent.',
      },
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'Supports emergency circuit planning, isolation, and safety context.',
      },
      {
        evidenceId: 'elso-adult-va-2021',
        claim:
          'Supports independent patient and perfusion assessment during interrupted adult VA support.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the injected event, latch, clamp, and patient-response states shown here.',
      },
    ],
  },

  'va-transport-power-loss': {
    scenarioId: 'va-transport-power-loss',
    supportMode: 'va',
    clinicalQuestion:
      'During transport, the console power indication changes while forward venoarterial support initially continues. What does the current device state establish, and which transport facts are not represented by that display?',
    signalRows: (state) => [
      valueSignalRow(
        'Power source',
        'CARDIOHELP transport status',
        powerSource(state),
        'A current device-source indication, not proof of source reliability or backup readiness.',
        'valid',
      ),
      valueSignalRow(
        'Battery indication',
        'CARDIOHELP transport status',
        livePercent(state.device.batteryPercent),
        'A modeled device-status value to read beside source, pump, flow, physical transport setup, and patient state.',
        'valid',
        'batteryReserve',
      ),
      valueSignalRow(
        'Pump state',
        'CARDIOHELP console and pump head',
        pumpState(state),
        'A current device state that still requires direct confirmation of forward support.',
        'valid',
      ),
      valueSignalRow(
        'Pump speed',
        'Configured on the CARDIOHELP console',
        liveNumber(state.device.rpmSetpoint, 'rpm'),
        'A configured speed request rather than a guarantee of delivered support.',
        'configured',
        'pumpSpeed',
      ),
      valueSignalRow(
        'Circuit blood flow',
        'Arterial return-limb flow probe',
        liveNumber(state.circuit.bloodFlow, 'L/min', 2),
        'A current circuit-flow measurement, not total systemic perfusion.',
        'valid',
        'circuitBloodFlow',
      ),
      pressureRow(
        'pVen',
        'Femoral venous drainage limb before the pump',
        state.circuit.readouts.pVen,
        'A live drainage-side circuit channel when available.',
        'pVen',
      ),
      pressureRow(
        'pInt',
        'After the pump and before the membrane',
        state.circuit.readouts.pInt,
        'A live pre-membrane circuit channel when available.',
        'pInt',
      ),
      pressureRow(
        'pArt',
        'After the membrane on the arterial return limb',
        state.circuit.readouts.pArt,
        'A live return-side circuit channel, not patient arterial pressure.',
        'pArt',
      ),
      offConsoleSignalRow(
        'Patient mean arterial pressure',
        'Independent patient arterial line',
        liveNumber(state.patient.meanArterialPressure, 'mmHg'),
        'A patient perfusion value outside the console power state.',
        'meanArterialPressure',
      ),
      offConsoleSignalRow(
        'Right-radial saturation',
        'Independent upper-body monitor',
        livePercent(state.patient.rightRadialSpo2, 1),
        'A regional patient observation during transport.',
        'rightRadialSaturation',
      ),
    ],
    signalSummary: (state) =>
      `${powerSource(state)} with battery indication ${livePercent(state.device.batteryPercent)}, ${pumpState(state).toLowerCase()}, circuit flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, patient mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    patternRows: (state) => [
      {
        label: 'Current electrical source',
        reading: `${powerSource(state)}; battery indication ${livePercent(state.device.batteryPercent)}`,
        movement: 'Read as the current device state, not a forecast of future availability.',
      },
      {
        label: 'Current pump and circuit state',
        reading: `${pumpState(state)}; speed ${liveNumber(state.device.rpmSetpoint, 'rpm')}; flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}`,
        movement: 'Confirm that forward flow is actually present.',
      },
      {
        label: 'Circuit channels',
        reading: `pVen ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}; pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}; pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}`,
        movement:
          'Read availability and current values without treating them as power-source proof.',
      },
      {
        label: 'Independent patient state',
        reading: `MAP ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}; right radial ${livePercent(state.patient.rightRadialSpo2, 1)}`,
        movement: 'Compare with perfusion and the full transport assessment.',
      },
    ],
    patternSummary: (state) =>
      `The transport snapshot is ${powerSource(state).toLowerCase()} with battery indication ${livePercent(state.device.batteryPercent)}, ${pumpState(state).toLowerCase()}, flow ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, patient MAP ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}.`,
    discriminators: [
      {
        question: 'Which electrical fact is displayed, and which physical facts are not?',
        whereToLook:
          'Transport status beside the physical power connection and wider transport setup.',
      },
      {
        question:
          'Is the pump still producing forward circuit flow, and do the patient observations remain concordant?',
        whereToLook:
          'Pump state, return-limb flow, pressure channels, MAP, perfusion, and right-arm monitoring.',
      },
      {
        question: 'Which required preparedness facts have no state in this simulation?',
        whereToLook:
          'The reviewed transport checklist and physical equipment, kept separate from the console icon.',
      },
    ],
    mechanism:
      'The pattern is loss of the external AC source during transport with automatic changeover to battery while peripheral femoral venoarterial support initially continues. Battery operation is a temporary device state, not a verified durable source or backup plan.',
    competingExplanations: [
      {
        candidate: 'A display or connection-state discrepancy rather than true source loss',
        standing:
          'The physical power connection and source must be checked because an icon alone does not identify the failed link.',
      },
      {
        candidate: 'A separate pump, circuit, or patient deterioration during the transport event',
        standing:
          'Flow, pressures, MAP, regional oxygenation, and perfusion still require independent reassessment after power continuity is restored.',
      },
    ],
    fittingResponse:
      'Restore a verified AC source promptly, confirm ongoing forward flow and patient perfusion, and verify that the program-approved backup console or emergency-drive pathway is immediately ready.',
    responseByDomain: {
      device:
        'Confirm the indicated source, restore verified AC, and recheck battery status, pump state, alarms, and immediate backup readiness.',
      circuitOrGas:
        'Confirm forward flow, all available pressure channels, circuit integrity, and the transport connections.',
      patient:
        'Reassess MAP, perfusion, right-arm oxygenation, native-heart state, and clinical trajectory throughout the event.',
    },
    harmfulReflex: {
      action:
        'Reducing pump speed or using the battery percentage as permission to delay source restoration.',
      explanation:
        'Reducing support does not stop the modeled battery decline and visibly reduces flow and patient MAP. The displayed percentage also does not predict real remaining runtime or establish that another support pathway is ready.',
    },
    boundaries: [
      'The battery discharge curve, transport duration, and response to restored power are authored and do not predict real remaining runtime.',
      'This panel represents recognition and readiness only; it does not certify hands-on emergency-drive or console-exchange competency.',
      'No battery percentage or time interval shown here is a transport threshold.',
    ],
    textEquivalent: (state) =>
      `Peripheral femoral venoarterial transport-power draft. The console indicates ${state.device.powerSource === 'ac' ? 'AC power' : 'battery power'} with battery ${livePercent(state.device.batteryPercent)}, the pump is ${state.device.pumpRunning ? 'turning' : 'stopped'} at ${liveNumber(state.device.rpmSetpoint, 'rpm')}, flow is ${liveNumber(state.circuit.bloodFlow, 'L/min', 2)}, pVen ${pressureText('pVen', state.circuit.readouts.pVen, 'pVen')}, pInt ${pressureText('pInt', state.circuit.readouts.pInt, 'pInt')}, pArt ${pressureText('pArt', state.circuit.readouts.pArt, 'pArt')}, patient mean arterial pressure ${liveNumber(state.patient.meanArterialPressure, 'mmHg')}, and right-radial saturation ${livePercent(state.patient.rightRadialSpo2, 1)}. After commitment, the panel identifies external AC-source loss with automatic battery changeover, retains a display or connection discrepancy and separate pump, circuit, or patient deterioration as competitors, and calls for verified AC restoration, forward-flow and patient reassessment, and immediate backup readiness. Reducing pump speed or delaying because of the battery percentage is the harmful reflex: the model continues battery decline while lower RPM reduces flow and MAP. The battery curve and duration are authored, backup readiness is not a represented state, emergency-drive competency is not certified, and no percentage or interval is a threshold.`,
    sourceSupport: [
      {
        evidenceId: 'ifu-console-workflow',
        claim:
          'Supports the represented CARDIOHELP power-source, battery-status, and transport-screen workflow; it does not establish program backup readiness.',
      },
      {
        evidenceId: 'ecmo-book-ch9',
        claim: 'Supports circuit inspection and immediate backup-readiness concepts.',
      },
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'Supports circuit emergency planning and continuity-of-support context.',
      },
      {
        evidenceId: 'elso-adult-va-2021',
        claim: 'Supports independent patient and circulatory monitoring during adult VA support.',
      },
      {
        evidenceId: 'bounded-educational-model',
        claim:
          'Supports only the authored source switch, battery curve, and deterministic response shown here.',
      },
    ],
  },
}) satisfies RemainingVaConfigMap

type DraftPanelComponent = ReturnType<typeof draftPanelFor>

export const remainingVaDrillPanelComponents: Readonly<
  Record<RemainingVaDrillPanelId, DraftPanelComponent>
> = Object.freeze({
  'va-startup-sensor-orientation': draftPanelFor(
    remainingVaDrillPanelConfigs['va-startup-sensor-orientation'],
  ),
  'va-preload-drainage-collapse': draftPanelFor(
    remainingVaDrillPanelConfigs['va-preload-drainage-collapse'],
  ),
  'va-afterload-arterial-return-obstruction': draftPanelFor(
    remainingVaDrillPanelConfigs['va-afterload-arterial-return-obstruction'],
  ),
  'va-afterload-oxygenator-resistance': draftPanelFor(
    remainingVaDrillPanelConfigs['va-afterload-oxygenator-resistance'],
  ),
  'va-lv-loading': draftPanelFor(remainingVaDrillPanelConfigs['va-lv-loading']),
  'va-acute-hypercapnia': draftPanelFor(remainingVaDrillPanelConfigs['va-acute-hypercapnia']),
  'va-gas-source-interruption': draftPanelFor(
    remainingVaDrillPanelConfigs['va-gas-source-interruption'],
  ),
  'va-arterial-bubble-stop': draftPanelFor(remainingVaDrillPanelConfigs['va-arterial-bubble-stop']),
  'va-transport-power-loss': draftPanelFor(remainingVaDrillPanelConfigs['va-transport-power-loss']),
})
