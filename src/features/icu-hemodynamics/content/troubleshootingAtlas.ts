/**
 * Waveform troubleshooting reference.
 *
 * Organized the way the problem actually presents at the bedside: you see a distorted trace,
 * and you need to name it, know which number it corrupts and in which direction, and know what
 * to do about it. Content follows Ragosta & Kennedy, Textbook of Clinical Hemodynamics ch. 2,
 * including Box 2.2 "Common Sources of Error or Inaccuracy in Hemodynamic Assessment".
 */

import type { PressureArtifactKind } from '../engine/waveformArtifacts'

export const ARTIFACT_IDS = [
  'overdamped',
  'underdamped',
  'catheter-whip',
  'wall-contact',
  'spontaneous-wedge',
  'overwedging',
  'zero-level',
] as const

export type ArtifactId = (typeof ARTIFACT_IDS)[number]

export interface ArtifactWaveformCallout {
  readonly id: string
  readonly label: string
  readonly timeSeconds: number
}

export interface ArtifactDefinition {
  readonly id: ArtifactId
  readonly label: string
  readonly shortLabel: string
  readonly liveArtifact: PressureArtifactKind | null
  readonly pressureInterpretation: 'derived' | 'unreliable' | 'different-compartment' | 'offset'
  readonly appearance: readonly string[]
  readonly causes: readonly string[]
  readonly numbersTeaching: string
  readonly whyItMatters: string
  readonly actions: readonly string[]
  readonly doNot: readonly string[]
  readonly callouts: readonly ArtifactWaveformCallout[]
  readonly warning?: string
  readonly sourceIds: readonly string[]
}

export const artifactDefinitions = {
  overdamped: {
    id: 'overdamped',
    label: 'Overdamped pressure system',
    shortLabel: 'Overdamped',
    liveArtifact: 'overdamped',
    pressureInterpretation: 'derived',
    appearance: [
      'The PA upstroke is rounded, the peak is blunted, and pulse pressure is narrow.',
      'The pulmonic-closure notch and other high-frequency detail are markedly reduced or lost.',
      'This tracing is generated with low-pass smoothing plus amplitude attenuation, not simple vertical rescaling.',
    ],
    causes: [
      'Air or blood in the catheter-tubing-transducer circuit.',
      'A clot, kink, partial lumen obstruction, or catheter tip against the vessel wall.',
      'Low pressure-bag pressure, a loose or partially open connection, or overly compliant nonstandard tubing.',
      'An incorrect monitor scale can visually mimic damping even though it does not alter the signal itself.',
    ],
    numbersTeaching:
      'The generated trace has a lower systolic peak, higher diastolic nadir, narrower pulse pressure, and a mean that is less affected than either endpoint.',
    whyItMatters:
      'A damped PA tracing can hide a real systolic peak or closure notch and can make catheter position and pulmonary pressures look more reassuring than they are.',
    actions: [
      'Confirm the pressure display scale, transducer level, and atmospheric zero.',
      'Confirm approximately 300 mmHg in the pressure bag and inspect every stopcock, connection, and segment of tubing.',
      'Remove air or blood from the monitoring circuit and correct any kink or visible obstruction.',
      'After confirming a PA waveform and a fully deflated balloon, use a fast-flush test to verify dynamic response.',
      'When persistent wall contact or malposition is suspected, reposition according to clinician authority and local policy.',
    ],
    doNot: [
      'Do not interpret the blunted systolic value as a reliable physiologic peak.',
      'Do not fast-flush unless a PA waveform and complete balloon deflation are confirmed.',
    ],
    callouts: [{ id: 'lost-notch', label: 'closure notch lost', timeSeconds: 1.96 }],
    sourceIds: ['clinical-hemodynamics-waveforms', 'arterial-pressure-five-step-2020'],
  },
  underdamped: {
    id: 'underdamped',
    label: 'Underdamped pressure system',
    shortLabel: 'Underdamped',
    liveArtifact: 'underdamped',
    pressureInterpretation: 'derived',
    appearance: [
      'A narrow systolic overshoot rises above the source PA peak and the nadir undershoots true diastolic pressure.',
      'The notch appears unusually deep, followed by small reverberations that decay after rapid transitions.',
      'The ringing is event-triggered and fades; it is not a continuous sine wave.',
    ],
    causes: [
      'Resonance in a fluid-filled monitoring system with an unfavorable natural frequency and damping coefficient.',
      'Nonstandard extensions, excessive stopcocks, or poorly matched pressure tubing.',
      'A defective transducer or an excessively stiff monitoring assembly.',
      'Catheter motion can add mechanical contamination to the resonant response.',
    ],
    numbersTeaching:
      'The generated maximum is falsely high, the minimum falsely low, and pulse pressure falsely wide. Mean pressure is relatively preserved, not guaranteed exact.',
    whyItMatters:
      'The exaggerated peak can be mistaken for severe pulmonary hypertension or a pressure gradient that is not actually present.',
    actions: [
      'Confirm the response with a correctly performed fast-flush test.',
      'Remove unnecessary extensions and stopcocks and use tubing intended for invasive pressure monitoring.',
      'Secure the catheter and external tubing and replace a suspected defective transducer or monitoring set.',
      'Compare the mean pressure, waveform family, and clinical situation before acting on the peak alone.',
    ],
    doNot: [
      'Do not list an air bubble as the primary cause of underdamping; added compliance generally promotes damping.',
      'Do not diagnose severe pulmonary hypertension from the overshoot without correcting the signal.',
    ],
    callouts: [
      { id: 'overshoot', label: 'systolic overshoot', timeSeconds: 0.87 },
      { id: 'ringing', label: 'decaying ringing', timeSeconds: 1.31 },
    ],
    sourceIds: ['clinical-hemodynamics-waveforms', 'arterial-pressure-five-step-2020'],
  },
  'catheter-whip': {
    id: 'catheter-whip',
    label: 'Catheter whip or fling',
    shortLabel: 'Catheter whip',
    liveArtifact: 'catheter-whip',
    pressureInterpretation: 'derived',
    appearance: [
      'A recognizable PA waveform remains underneath a very narrow early-systolic mechanical spike.',
      'Spike height varies deterministically from beat to beat, with brief high-frequency motion after some spikes.',
    ],
    causes: [
      'Cardiac motion, right-ventricular contraction, valve closure, blood flow, or surface contact accelerates the catheter tip or fluid column.',
      'A redundant catheter loop or movement of the external catheter and tubing can amplify the disturbance.',
    ],
    numbersTeaching:
      'The spike can make systolic pressure spuriously high. Diastolic and mean pressure may be less affected, but all values become unreliable when contamination is severe.',
    whyItMatters:
      'A mechanical spike can masquerade as a true pressure peak and lead to an incorrect diagnosis or unnecessary treatment.',
    actions: [
      'Confirm complete balloon deflation and stop external catheter or tubing movement.',
      'Compare the spike timing with the ECG and with the underlying PA contour.',
      'When appropriate and authorized, make a small catheter-position adjustment and reassess.',
    ],
    doNot: [
      'Do not diagnose pulmonary hypertension or a true intracardiac gradient from an isolated narrow spike.',
      'Do not advance or withdraw the catheter without appropriate clinical authority.',
    ],
    callouts: [{ id: 'whip-spike', label: 'mechanical spike', timeSeconds: 1.67 }],
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021'],
  },
  'wall-contact': {
    id: 'wall-contact',
    label: 'Tip or wall contact',
    shortLabel: 'Tip/wall contact',
    liveArtifact: 'wall-contact',
    pressureInterpretation: 'unreliable',
    appearance: [
      'The PA waveform damps abruptly when the distal opening touches the vessel wall.',
      'Intermittent release restores the PA contour between affected beats; continuous contact produces near-flattening.',
    ],
    causes: [
      'The distal opening is partially or completely occluded by the vessel wall.',
      'A kink, excessive distal migration, or an unfavorable catheter orientation can maintain contact.',
    ],
    numbersTeaching:
      'All pressure values are unreliable during contact; there is no universal direction for the error.',
    whyItMatters:
      'The abrupt loss of pulsatility may be mistaken for generalized system damping, a spontaneous wedge, or a true hemodynamic change.',
    actions: [
      'Verify the patient, balloon state, insertion depth, catheter course, and external tubing.',
      'Check for a kink or excessive distal migration.',
      'Withdraw or reposition only according to clinician authority and institutional policy.',
    ],
    doNot: [
      'Do not forcefully flush against a suspected obstructed or distally positioned catheter.',
      'Do not report a precise pressure while the distal opening is occluded.',
    ],
    callouts: [{ id: 'contact', label: 'abrupt contact damping', timeSeconds: 0.98 }],
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021'],
  },
  'spontaneous-wedge': {
    id: 'spontaneous-wedge',
    label: 'Spontaneous wedge from distal migration',
    shortLabel: 'Spontaneous wedge',
    liveArtifact: null,
    pressureInterpretation: 'different-compartment',
    appearance: [
      'The tracing transitions from pulsatile PA morphology with a closure notch to a lower-amplitude atrial-type waveform.',
      'PA pulsatility and the dicrotic notch disappear as transmitted a- and v-wave morphology emerges.',
    ],
    causes: [
      'The catheter has migrated distally enough to occlude a small PA branch even though the balloon may already be deflated.',
    ],
    numbersTeaching:
      'The display is no longer measuring PA pressure; it is sampling a wedge-type compartment. The change is positional, not electronic overdamping.',
    whyItMatters:
      'An unrecognized spontaneous wedge can mislabel a wedge-type value as PA pressure and places a distal pulmonary-artery branch at risk.',
    actions: [
      'Confirm that the balloon is completely deflated and assess for distal catheter migration.',
      'When permitted, withdraw slowly until a clear PA waveform returns.',
      'Notify the responsible clinician and confirm position; obtain radiographic confirmation when indicated.',
    ],
    doNot: [
      'Do not fast-flush the distal lumen when spontaneous wedge is suspected.',
      'Do not label the new waveform as a merely damped PA signal.',
    ],
    callouts: [{ id: 'wedge-transition', label: 'PA → wedge transition', timeSeconds: 1.2 }],
    warning: 'Suspected spontaneous wedge: do not fast-flush the distal lumen.',
    sourceIds: [
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
      'emcrit-rhc-supplied-2026',
    ],
  },
  overwedging: {
    id: 'overwedging',
    label: 'Overwedging',
    shortLabel: 'Overwedging',
    liveArtifact: null,
    pressureInterpretation: 'unreliable',
    appearance: [
      'A wedge-type waveform appears, then loses pulsatility as occlusion increases.',
      'The pressure subsequently rises rather than stabilizing at a plausible wedge value.',
    ],
    causes: [
      'Excess balloon inflation or a catheter already positioned too distally can occlude the branch and press the distal opening against the vessel wall.',
    ],
    numbersTeaching:
      'The rising, progressively nonpulsatile signal is not a valid PAWP. All displayed values are unreliable.',
    whyItMatters:
      'Continued inflation or flushing against an occluded distal PA branch can contribute to pulmonary-artery injury.',
    actions: [
      'Stop inflation immediately and allow passive balloon deflation.',
      'Withdraw to a more proximal PA location and re-float or reposition under appropriate supervision.',
      'Confirm that any wedge value is physiologically plausible relative to PA diastolic pressure.',
      'Escalate immediately if pulmonary-artery injury is suspected.',
    ],
    doNot: [
      'Do not flush an overwedged catheter.',
      'Do not exceed the manufacturer-specified balloon volume.',
      'Do not continue inflating in pursuit of a prettier waveform.',
    ],
    callouts: [{ id: 'pressure-rise', label: 'pressure keeps rising', timeSeconds: 2.62 }],
    warning: 'Stop inflation immediately. Allow passive balloon deflation. Do not flush.',
    sourceIds: [
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
      'emcrit-rhc-supplied-2026',
    ],
  },
  'zero-level': {
    id: 'zero-level',
    label: 'Zero or level error',
    shortLabel: 'Zero/level error',
    liveArtifact: null,
    pressureInterpretation: 'offset',
    appearance: [
      'The PA waveform shape and pulse pressure are unchanged.',
      'Only a constant vertical offset moves the systolic, diastolic, and mean pressures together.',
    ],
    causes: [
      'The transducer is above or below the phlebostatic reference level.',
      'Atmospheric zero is incorrect or has drifted.',
      'The transducer moved with the bed or patient and was not re-leveled.',
    ],
    numbersTeaching:
      'A transducer 10 cm too low reads approximately 7.5 mmHg high; 10 cm too high reads approximately 7.5 mmHg low. Pulse pressure is unchanged.',
    whyItMatters:
      'A constant offset is easy to miss because the tracing still looks physiologic, and the relative error is especially large for PAWP and right-sided filling pressures.',
    actions: [
      'Level to the institutional reference point and zero the transducer to atmosphere as separate steps.',
      'Repeat both checks after a position or bed-height change and whenever the numbers do not fit the patient.',
    ],
    doNot: [
      'Do not blame leveling for loss of waveform morphology; leveling changes offset, not shape.',
      'Do not adjust only the mean while leaving systolic and diastolic unchanged.',
    ],
    callouts: [{ id: 'same-shape', label: 'same shape and pulse pressure', timeSeconds: 1.0 }],
    sourceIds: [
      'arterial-pressure-five-step-2020',
      'clinical-hemodynamics-waveforms',
      'emcrit-rhc-supplied-2026',
    ],
  },
} satisfies Record<ArtifactId, ArtifactDefinition>

export const troubleshootingEntries: readonly ArtifactDefinition[] = ARTIFACT_IDS.map(
  (id) => artifactDefinitions[id],
)

export const troubleshootingById = new Map<ArtifactId, ArtifactDefinition>(
  troubleshootingEntries.map((entry) => [entry.id, entry]),
)

export function getArtifactDefinition(id: string): ArtifactDefinition {
  if (!Object.prototype.hasOwnProperty.call(artifactDefinitions, id)) {
    throw new Error(`Unknown PA-catheter troubleshooting definition: ${id}`)
  }
  return artifactDefinitions[id as ArtifactId]
}

export function troubleshootingForArtifact(
  artifact: PressureArtifactKind,
): ArtifactDefinition | undefined {
  return troubleshootingEntries.find((entry) => entry.liveArtifact === artifact)
}

export interface TroubleshootingReferenceRow {
  readonly id: string
  readonly problem: string
  readonly waveform: string
  readonly causes: string
  readonly checks: string
  readonly action: string
  readonly warning: string
}

export const troubleshootingReferenceRows: readonly TroubleshootingReferenceRow[] = [
  {
    id: 'dampened-observation',
    problem: 'Dampened waveform (observation)',
    waveform:
      'Small, smooth, or flattened PA contour; diagnose the cause before calling it overdamping.',
    causes:
      'Wrong scale; air or blood; low pressure-bag pressure; loose connection; kink or obstruction; wall contact; spontaneous wedge.',
    checks:
      'Scale, level, zero, pressure bag, connections, stopcocks, tubing, catheter depth, and whether atrial-type wedge waves replaced PA morphology.',
    action:
      'Correct the identified mechanical or display problem, then reassess the waveform family.',
    warning:
      'Leveling changes offset, not morphology. Do not fast-flush a possible spontaneous wedge.',
  },
  {
    id: 'confirmed-overdamping',
    problem: 'Confirmed overdamping',
    waveform: 'Rounded upstroke, low peak, high nadir, narrow pulse pressure, and lost notch.',
    causes:
      'Air or blood, clot, kink, partial obstruction, low pressure bag, loose connection, compliant tubing.',
    checks:
      'Confirm PA position, balloon deflation, scale, level, zero, circuit integrity, and fast-flush response.',
    action: 'Remove circuit problems, restore pressure-bag pressure, correct tubing, and retest.',
    warning: 'Do not trust the systolic or diastolic endpoint while the response remains damped.',
  },
  {
    id: 'confirmed-underdamping',
    problem: 'Confirmed underdamping',
    waveform: 'Sharp overshoot, low undershoot, deep notch, and decaying reverberations.',
    causes:
      'Resonance, excessive components, unsuitable tubing, defective transducer, or compounded catheter motion.',
    checks:
      'Fast-flush response, tubing type, extensions, stopcocks, transducer, and catheter stability.',
    action:
      'Simplify and secure the monitoring circuit; replace defective or mismatched components.',
    warning: 'Do not act on the exaggerated peak alone.',
  },
  {
    id: 'catheter-whip',
    problem: 'Catheter whip or fling',
    waveform: 'Very sharp early-systolic spike over an otherwise recognizable PA waveform.',
    causes:
      'Catheter-tip acceleration, redundant loop, cardiac motion, flow, valve or surface contact.',
    checks: 'Balloon deflation, external motion, ECG timing, depth, and catheter course.',
    action:
      'Secure the system and use a small clinician-directed repositioning maneuver when appropriate.',
    warning: 'Do not diagnose pulmonary hypertension from the isolated spike.',
  },
  {
    id: 'incorrect-monitor-scale',
    problem: 'Incorrect monitor scale',
    waveform: 'A normal signal appears tiny, flat, or clipped because the display range is wrong.',
    causes: 'A high pressure scale on a low-pressure PA signal or an inappropriately narrow scale.',
    checks: 'Read the y-axis and compare it with the expected chamber pressure range.',
    action: 'Select a clinically appropriate fixed scale, then reassess morphology.',
    warning: 'Do not diagnose damping from appearance alone when the display scale is wrong.',
  },
  {
    id: 'spontaneous-wedge',
    problem: 'Spontaneous wedge',
    waveform:
      'PA pulsatility and notch transition to lower-amplitude atrial-type wedge morphology.',
    causes: 'Distal catheter migration with branch occlusion despite a deflated balloon.',
    checks:
      'Balloon state, depth, waveform transition, patient position, and radiographic position when indicated.',
    action:
      'Withdraw slowly until PA morphology returns when authorized; notify the responsible clinician.',
    warning: 'Do not flush.',
  },
  {
    id: 'rv-migration',
    problem: 'RV migration',
    waveform:
      'Similar systolic pressure, lower diastolic pressure, no PA notch, and a ventricular or tombstone contour.',
    causes: 'Proximal catheter migration from PA into RV.',
    checks: 'Balloon deflation, rhythm, depth, PA notch, and diastolic step-down.',
    action: 'Monitor rhythm continuously and return to PA position under appropriate supervision.',
    warning: 'Do not ignore ventricular ectopy or manipulate the catheter without authority.',
  },
  {
    id: 'unable-to-wedge',
    problem: 'Unable to obtain wedge',
    waveform:
      'PA morphology persists despite cautious balloon inflation; no stable atrial-type occlusion trace appears.',
    causes:
      'Catheter too proximal, incomplete occlusion, damaged balloon system, or unfavorable pulmonary vascular anatomy.',
    checks: 'Depth, balloon integrity and volume, inflation system, and catheter course.',
    action: 'Reposition under supervision and accept that a reliable wedge may not be obtainable.',
    warning: 'Do not exceed specified balloon volume or repeatedly inflate aggressively.',
  },
  {
    id: 'overwedging',
    problem: 'Overwedging',
    waveform: 'Wedge-type signal loses pulsatility or pressure continues to rise.',
    causes: 'Excess balloon volume, distal tip position, or complete wall occlusion.',
    checks:
      'Inflation volume, time, pressure trend, PA diastolic plausibility, and catheter position.',
    action:
      'Stop inflation, allow passive deflation, withdraw proximally, and escalate injury concern.',
    warning: 'Do not flush.',
  },
  {
    id: 'absent-waveform',
    problem: 'Absent waveform',
    waveform: 'No pressure contour or an entirely flat channel.',
    causes:
      'Disconnection, closed stopcock, wrong channel or scale, failed transducer, low pressure bag, kink, obstruction, or malposition.',
    checks:
      'Patient first, then monitor channel, scale, connections, stopcocks, transducer, pressure bag, tubing, and catheter position.',
    action:
      'Restore the verified circuit and escalate if blood return or catheter patency cannot be confirmed.',
    warning:
      'Assess position before aspirating or flushing; do not flush a suspected distal occlusion.',
  },
  {
    id: 'disconnected-system',
    problem: 'Disconnected system',
    waveform: 'Abrupt loss of waveform, often with atmospheric or erratic readings.',
    causes: 'Open connection, disconnected tubing, loose transducer interface, or open stopcock.',
    checks: 'Trace the system from patient to monitor and inspect every connection and stopcock.',
    action: 'Clamp or reconnect per local protocol, maintain sterility, and re-zero when required.',
    warning: 'Do not leave an open invasive pressure circuit unattended.',
  },
  {
    id: 'balloon-failure',
    problem: 'Balloon failure or rupture',
    waveform: 'PA waveform fails to transition to wedge despite attempted inflation.',
    causes: 'Balloon or inflation-lumen damage, leak, or disconnected inflation syringe.',
    checks:
      'Inflation volume, resistance, return volume, and manufacturer-directed balloon integrity checks.',
    action:
      'Stop repeated inflation attempts and manage or replace the catheter under supervision.',
    warning: 'Do not exceed labeled balloon volume or use liquid to inflate the balloon.',
  },
  {
    id: 'lumen-obstruction',
    problem: 'Catheter or lumen obstruction',
    waveform: 'Progressive or abrupt damping, delayed response, or absent signal.',
    causes:
      'Clot, kink, blood in the lumen, closed stopcock, distal wall contact, or catheter damage.',
    checks:
      'Catheter position, course, stopcocks, tubing, blood return, and institutional patency protocol.',
    action: 'Correct external causes and escalate suspected intraluminal or distal obstruction.',
    warning:
      'Do not forcefully flush when distal occlusion, wedging, or pulmonary-artery injury is possible.',
  },
]

export const commonErrorSources: readonly string[] = [
  'Incorrect display scale, level, or atmospheric zero',
  'Air, blood, clot, kink, obstruction, or a low pressure bag',
  'Loose connections, open stopcocks, or a defective transducer',
  'Catheter whip, wall contact, spontaneous wedge, RV migration, or overwedging',
]

export interface WedgeValidityCheck {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly definitive: boolean
}

/** What has to be true before a wedge pressure may be believed. */
export const wedgeValidityChecks: readonly WedgeValidityCheck[] = [
  {
    id: 'waves',
    label: 'Well-defined a and v waves',
    detail:
      'The wedge should show atrial morphology. The a wave is absent in atrial fibrillation, and phasic waves may be indistinct when pressures are low, so this check alone is not sufficient.',
    definitive: false,
  },
  {
    id: 'position',
    label: 'Catheter tip in a distal pulmonary artery',
    detail:
      'The tip should sit in the distal pulmonary artery with no apparent motion once the balloon is inflated.',
    definitive: false,
  },
  {
    id: 'oximetry',
    label: 'Oxygen saturation above 90% from the wedged tip',
    detail:
      'Blood drawn from a true wedge is arterialized pulmonary capillary blood. This is the most confirmatory sign of a true wedge, and the one that settles an ambiguous tracing.',
    definitive: true,
  },
  {
    id: 'deflation',
    label: 'Distinct abrupt rise in mean pressure on deflation',
    detail:
      'Releasing the balloon should return the pulmonary artery waveform immediately and unmistakably.',
    definitive: false,
  },
]

export interface WestZoneDefinition {
  readonly zone: 1 | 2 | 3
  readonly region: string
  readonly relationship: string
  readonly valid: boolean
  readonly explanation: string
}

/**
 * A wedge pressure reflects left atrial pressure only where an uninterrupted column of blood
 * runs from the catheter tip to the left atrium — which is only true in West zone 3.
 */
export const westZones: readonly WestZoneDefinition[] = [
  {
    zone: 1,
    region: 'Lung apex',
    relationship: 'Alveolar > arterial > venous',
    valid: false,
    explanation:
      'Alveolar pressure is highest and compresses both vessels, so no blood column connects the tip to the left atrium.',
  },
  {
    zone: 2,
    region: 'Mid lung',
    relationship: 'Arterial > alveolar > venous',
    valid: false,
    explanation:
      'Alveolar pressure still exceeds venous pressure, so pulmonary capillary collapse is present and the wedge does not estimate left atrial pressure.',
  },
  {
    zone: 3,
    region: 'Lung base',
    relationship: 'Arterial > venous > alveolar',
    valid: true,
    explanation:
      'Alveolar pressure is lower than both vascular pressures, so pressure is transmitted directly from the left atrium to the wedged tip. In the supine patient most of the lung is zone 3, and blood flow carries the balloon-tipped catheter there.',
  },
]

export const wedgeValidityModifiers: readonly string[] = [
  'PEEP below 10 cmH2O does not significantly affect the wedge. Above that, a suggested correction is that the wedge rises 2 to 3 cm for every 5 cmH2O increment in PEEP.',
  'Positive end-expiratory pressure also raises alveolar pressure, which can convert a zone 3 position into a non-zone 3 position.',
  'A catheter tip below the level of the left atrium is the position most likely to be in zone 3.',
  'The wedge does not track left ventricular end-diastolic pressure in mitral stenosis, severe mitral or aortic regurgitation, pulmonary vascular obstruction, marked increases in PEEP, left atrial myxoma, marked left ventricular non-compliance, or a non-zone 3 tip position.',
]
