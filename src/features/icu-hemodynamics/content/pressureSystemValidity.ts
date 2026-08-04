/**
 * The repeatable validity sequence taught by the first Learn section (H0/H1 requirement 3).
 *
 * The module already carried every one of these checks — scattered across the leveling visual, the
 * fast-flush lab, the troubleshooting atlas rows, and the capstone. What it lacked was a *named,
 * ordered* sequence a novice can run the same way every time, and an explicit last step that
 * permits the answer "this number should not be interpreted at all."
 *
 * Every step is authored from material already reviewed in this module; `sourceIds` point at the
 * registered sources that license the claim. No step introduces a universal bedside target, and
 * no step asserts a numeric alarm threshold — the module has no source that supplies one.
 */
export interface PressureSystemValidityStep {
  readonly id: string
  readonly shortLabel: string
  /** The question the learner asks, in their own words. */
  readonly question: string
  readonly whatYouCheck: string
  readonly whatItEstablishes: string
  /** The step's boundary — what a clean result here still does not license. */
  readonly whatItDoesNotEstablish: string
  /** One concrete way this step is skipped or misread at the bedside. */
  readonly howItMisleads: string
  readonly sourceIds: readonly string[]
}

export const pressureSystemValiditySteps: readonly PressureSystemValidityStep[] = [
  {
    id: 'patient-context',
    shortLabel: 'Patient',
    question: 'Who is this patient, and does the tracing fit them at all?',
    whatYouCheck:
      'Look at the patient and the clinical picture before the monitor: rhythm, ventilation and effort, position, and whether anything just changed.',
    whatItEstablishes:
      'The context that every later check is judged against, and an early warning when the displayed values and the patient plainly disagree.',
    whatItDoesNotEstablish:
      'A stable-looking patient does not make the signal valid, and an unstable patient does not make it invalid.',
    howItMisleads:
      'Starting at the number invites you to explain a measurement artifact as physiology, and to treat it.',
    sourceIds: ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied'],
  },
  {
    id: 'level',
    shortLabel: 'Level',
    question: 'Is the transducer at the reference level?',
    whatYouCheck:
      'The transducer against the institutional phlebostatic reference, re-checked after any bed-height or patient-position change.',
    whatItEstablishes:
      'That the displayed pressure is not carrying a hydrostatic offset. A transducer 10 cm too low reads about 7.4 mmHg high; 10 cm too high reads about 7.4 mmHg low.',
    whatItDoesNotEstablish:
      'Leveling changes the offset, not the shape. A correctly leveled system can still be badly damped.',
    howItMisleads:
      'The offset is easy to miss because the tracing still looks physiologic, and the relative error is largest exactly where it matters most — right-sided filling pressures and PAWP.',
    sourceIds: [
      'arterial-pressure-five-step-2020',
      'clinical-hemodynamics-waveforms',
      'emcrit-rhc-supplied-2026',
    ],
  },
  {
    id: 'zero',
    shortLabel: 'Zero',
    question: 'Has the system been zeroed to atmosphere?',
    whatYouCheck:
      'Open the transducer to air and establish atmospheric zero as a step of its own, separate from leveling.',
    whatItEstablishes: 'The reference against which every displayed pressure is reported.',
    whatItDoesNotEstablish:
      'Zeroing does not physically move the transducer, and it does not repair a distorted dynamic response.',
    howItMisleads:
      'Level and zero are routinely collapsed into one action, so a system can be zeroed but still off level — or leveled but never zeroed.',
    sourceIds: ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied'],
  },
  {
    id: 'plumbing',
    shortLabel: 'Tubing',
    question: 'Is the fluid path between the patient and the transducer intact?',
    whatYouCheck:
      'Trace the circuit from patient to monitor: connections and stopcocks, air or blood in the line, kinks or obstruction, and the pressure bag.',
    whatItEstablishes:
      'That the pressure at the catheter tip can actually reach the transducer — the physical precondition for every other check.',
    whatItDoesNotEstablish:
      'An intact circuit does not tell you where the catheter tip is, or which chamber you are measuring.',
    howItMisleads:
      'Air, blood, a loose connection, or a low pressure bag all produce a small, smooth tracing that is easy to name "overdamped" without ever finding the mechanical cause.',
    sourceIds: ['monitor-workflow-supplied', 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'scale-and-channel',
    shortLabel: 'Scale',
    question: 'Am I reading the right channel, on a scale that fits this pressure?',
    whatYouCheck:
      'Read the y-axis and the channel label, and compare the display range with the pressure range you expect from that chamber.',
    whatItEstablishes:
      'That the shape you are about to interpret is the signal, and not the display range you happened to be on.',
    whatItDoesNotEstablish: 'A sensible scale does not make the underlying signal valid.',
    howItMisleads:
      'A high scale makes a normal pulmonary-artery signal look tiny and flat; a narrow scale clips it. Both invite a damping diagnosis from appearance alone.',
    sourceIds: ['monitor-workflow-supplied', 'emcrit-rhc-supplied-2026'],
  },
  {
    id: 'dynamic-response',
    shortLabel: 'Dynamic response',
    question: 'How does the system behave when it is disturbed?',
    whatYouCheck:
      'Perform a fast flush from a confirmed, safe position and watch the release: prompt return with one or two rapidly decaying oscillations, a sluggish rounded return, or persistent ringing.',
    whatItEstablishes:
      'Whether the system reproduces, attenuates, or exaggerates rapid pressure change — and therefore whether systolic, diastolic, and pulse pressure can be read at all.',
    whatItDoesNotEstablish:
      'A well-behaved system measures faithfully whatever it is connected to. It says nothing about catheter position.',
    howItMisleads:
      'Mean pressure stays relatively preserved in both overdamping and underdamping, so a plausible mean is often taken as proof that the whole tracing is trustworthy.',
    sourceIds: ['arterial-pressure-five-step-2020', 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'respiratory-phase',
    shortLabel: 'Respiratory phase',
    question: 'Where in the respiratory cycle am I reading?',
    whatYouCheck:
      'Identify end expiration on the tracing and read there, accounting for whether the patient is receiving positive-pressure ventilation or breathing spontaneously.',
    whatItEstablishes:
      'A consistent point in the respiratory cycle, which is what makes two readings — or two clinicians — comparable.',
    whatItDoesNotEstablish:
      'End-expiratory timing does not remove transmitted surrounding pressure; it only stops you from adding respiratory swing on top of it.',
    howItMisleads:
      'Reading the respiratory mean, or the inspiratory peak under positive pressure, changes the number without anything changing in the circulation.',
    sourceIds: ['cvp-measurement-2017', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'morphology',
    shortLabel: 'Morphology',
    question: 'Does the shape match the chamber the catheter is supposed to be in?',
    whatYouCheck:
      'Name the waveform family from its contour and its timing against the ECG, and compare that with where the catheter is supposed to be.',
    whatItEstablishes:
      'Which pressure compartment is actually being sampled — the measurand, before any value is attached to it.',
    whatItDoesNotEstablish:
      'A recognizable contour does not certify the numbers on it if the earlier steps failed.',
    howItMisleads:
      'A tracing can be perfectly clean and still be the wrong chamber — a spontaneous wedge, for instance, replaces pulmonary-artery pulsatility with atrial-type morphology at an unchanged depth.',
    sourceIds: ['pac-waveforms-part-1-2021', 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'interpret-or-withhold',
    shortLabel: 'Interpret?',
    question: 'Given all of that, should this number be interpreted at all?',
    whatYouCheck:
      'Decide explicitly, and out loud: interpret it, interpret only the part that survives (often the mean rather than systolic and diastolic), or withhold interpretation until the chain is repaired.',
    whatItEstablishes:
      'That "I cannot use this yet" is a real, available answer, and one that has to be reached deliberately rather than by default.',
    whatItDoesNotEstablish:
      'Withholding interpretation is not the same as ignoring the patient; the clinical picture still needs a response while the signal is being repaired.',
    howItMisleads:
      'A monitor always displays a number. Availability of a value is not evidence that it means anything, and precision is not validity.',
    sourceIds: ['arterial-pressure-five-step-2020', 'pac-derived-part-2-2021'],
  },
] as const

export const pressureSystemValidityStepIds = pressureSystemValiditySteps.map((step) => step.id)

export function pressureSystemValidityStep(id: string): PressureSystemValidityStep {
  const step = pressureSystemValiditySteps.find((candidate) => candidate.id === id)
  if (!step) throw new Error(`Unknown pressure-system validity step: ${id}`)
  return step
}
