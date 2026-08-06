/**
 * Post-action coaching for the Practice workflow — and, more importantly, the rule that withholds it.
 *
 * ## The timing this implements
 *
 * Practice already asks the learner to commit a frame before they touch anything. That commitment is
 * recorded and nothing is said about it: no verdict, no mechanism, no branch, no answer key. The
 * learner then acts, and the model responds on its own authored schedule. Only once that response
 * has actually happened does this module have anything to say — and what it says is built from what
 * the response *was*, not from what the case knows.
 *
 *   commit ──▶ act ──▶ observe ──▶ coaching ──▶ … ──▶ full debrief
 *              │        │
 *              │        └─ the action's own authored latency, then one of this patient's breaths
 *              └─ `applyIntervention` stamps `effectiveAt = time + latencySeconds`
 *
 * **The observation interval is not a new number.** It is composed entirely of quantities that
 * already existed:
 *
 * - `record.effectiveAt`, which the engine has always stamped on an intervention from the case's own
 *   `latencySeconds`. Until it is reached, `performedEffectIds` excludes the action, so the model has
 *   genuinely not responded yet and there is nothing truthful to report.
 * - one breath at the rate this patient was running when the action was taken. The module's own
 *   observation vocabulary is already "advance one breath for reassessment"
 *   (`ventilationLessonObservationActions`); a reading taken inside the breath the learner interrupted
 *   is not a reading of the response to it.
 *
 * The period is frozen into the baseline at the moment of the action rather than read live, so that a
 * change in rate — which several of these actions cause — cannot move the finish line.
 *
 * ## Why coaching is derived rather than authored per case
 *
 * The one thing this must not become is an answer key delivered early. So it never reads
 * `correctMechanismId`, never reads `branchResolution`, and never asks `isCaseResolved`. It reads two
 * things: the profile of the action the learner chose, and the numbers on the screen before and
 * after. Branch specificity is then emergent and honest — suctioning the patient whose airway holds
 * secretions and suctioning the patient whose tube is obstructed produce different numbers, so they
 * produce different coaching, and neither run is told what the other would have been.
 *
 * ## Three claims, kept apart
 *
 * Every coaching block separates what was *observed* (readings, before and after, at the precision
 * the console prints them), what those readings *support*, and what has *not* been demonstrated by
 * them. The third is not decoration: a treatment that moved nothing is evidence against the mechanism
 * it targets, and it is not proof that mechanism is absent — and a simulated patient keeps changing
 * whether or not anyone acts, so a reading that moved is not automatically a reading the action moved.
 *
 * ## What is deliberately absent
 *
 * The reproducibility key, the branch token, the risk accumulators, the waveform buffer depth, effect
 * and action identifiers, and every authored list of expected actions. Those live where D0/D1 put
 * them — behind the build-environment gate in `CaseWorkflow`, and in the debrief the learner reaches
 * afterwards. No threshold is published here either: the only "is this patient stable" question asked
 * is whether the ventilator is currently raising a high-priority alarm, which is already on screen.
 */
import type {
  InterventionEffectId,
  InterventionRecord,
  VentilationCaseDefinition,
  VentilationSimulationState,
} from '../engine/types'
import {
  deriveEffectivePatient,
  deriveMeasurements,
  WAVEFORM_WINDOW_SECONDS,
} from '../engine/physics'
import { plateauReadingValidity, plateauWithheldNote } from './plateauValidity'

/* ------------------------------------------------------------------------------------------------
 * Readings
 * ---------------------------------------------------------------------------------------------- */

/**
 * The signals a learner can read off the Practice workspace without opening anything: the console's
 * monitored values, the bedside vitals, and the comfort grid. Nothing here is a hidden model quantity
 * — the effort fractions, the risk burdens, and the relaxed pressures are all excluded on purpose.
 */
export type CoachingReadingId =
  | 'peak-pressure'
  | 'peak-plateau-gap'
  | 'intrinsic-peep'
  | 'exhaled-vt'
  | 'total-rate'
  | 'patient-rate'
  | 'spo2'
  | 'map'
  | 'dyspnea'
  | 'pain'
  | 'delirium'
  | 'sedation'
  | 'paco2'

export type CoachingDirection = 'rose' | 'fell' | 'held'

interface ReadingDescriptor {
  readonly label: string
  /**
   * The label as it reads mid-sentence. Spelled out rather than lower-cased mechanically, because
   * `SpO₂` and `PaCO₂` are not words and lower-casing their first letter produced `spO₂`.
   */
  readonly inlineLabel: string
  readonly unit: string
  /** The number of decimals the surface this reading comes from actually prints. */
  readonly precision: number
  /**
   * Which direction is the patient getting better. `context` means the direction alone does not say
   * — a larger breath is not better or worse until you know what was wrong.
   */
  readonly betterWhen: 'lower' | 'higher' | 'context'
}

/** Canonical presentation order, so the block reads the same way every time. */
const readingOrder: readonly CoachingReadingId[] = [
  'peak-pressure',
  'peak-plateau-gap',
  'intrinsic-peep',
  'exhaled-vt',
  'total-rate',
  'patient-rate',
  'spo2',
  'map',
  'dyspnea',
  'pain',
  'delirium',
  'sedation',
  'paco2',
]

const readingDescriptors: Readonly<Record<CoachingReadingId, ReadingDescriptor>> = {
  'peak-pressure': {
    label: 'Peak airway pressure',
    inlineLabel: 'peak airway pressure',
    unit: 'cmH₂O',
    precision: 0,
    betterWhen: 'lower',
  },
  'peak-plateau-gap': {
    label: 'Peak-to-plateau difference',
    inlineLabel: 'the peak-to-plateau difference',
    unit: 'cmH₂O',
    precision: 0,
    betterWhen: 'lower',
  },
  'intrinsic-peep': {
    label: 'Trapped end-expiratory pressure',
    inlineLabel: 'trapped end-expiratory pressure',
    unit: 'cmH₂O',
    precision: 0,
    betterWhen: 'lower',
  },
  'exhaled-vt': {
    label: 'Exhaled breath size',
    inlineLabel: 'exhaled breath size',
    unit: 'mL',
    precision: 0,
    betterWhen: 'context',
  },
  'total-rate': {
    label: 'Delivered breath rate',
    inlineLabel: 'the delivered breath rate',
    unit: '/min',
    precision: 0,
    betterWhen: 'context',
  },
  'patient-rate': {
    label: 'The patient’s own rate',
    inlineLabel: 'the patient’s own rate',
    unit: '/min',
    precision: 0,
    betterWhen: 'context',
  },
  spo2: { label: 'SpO₂', inlineLabel: 'SpO₂', unit: '%', precision: 0, betterWhen: 'higher' },
  map: {
    label: 'Mean arterial pressure',
    inlineLabel: 'mean arterial pressure',
    unit: 'mm Hg',
    precision: 0,
    betterWhen: 'higher',
  },
  dyspnea: {
    label: 'Reported breathing discomfort',
    inlineLabel: 'reported breathing discomfort',
    unit: '/ 10',
    precision: 1,
    betterWhen: 'lower',
  },
  pain: {
    label: 'Reported pain',
    inlineLabel: 'reported pain',
    unit: '/ 10',
    precision: 0,
    betterWhen: 'lower',
  },
  delirium: {
    label: 'Delirium burden',
    inlineLabel: 'delirium burden',
    unit: '/ 10',
    precision: 0,
    betterWhen: 'lower',
  },
  sedation: {
    label: 'Sedation (RASS)',
    inlineLabel: 'the sedation level',
    unit: '',
    precision: 0,
    /*
     * Deliberately valence-free. Lighter is not universally better and deeper is not universally
     * worse; which one this patient needs is the question the case is asking, and a coaching block is
     * not the place to answer it with an arrow.
     */
    betterWhen: 'context',
  },
  paco2: {
    label: 'PaCO₂',
    inlineLabel: 'PaCO₂',
    unit: 'mm Hg',
    precision: 0,
    betterWhen: 'context',
  },
}

export type CoachingReadingSnapshot = Readonly<Record<CoachingReadingId, number | null>>

/**
 * Every reading, as the surfaces print it right now. `null` means this patient does not currently
 * have that finding available — a plateau that cannot be interpreted, a repeat gas that has not
 * resulted — and a `null` is never reported as a value or as a change.
 */
export function coachingReadingSnapshot(
  state: VentilationSimulationState,
): CoachingReadingSnapshot {
  const measurements = state.measurements
  const plateau = plateauReadingValidity(state)
  const repeatGasResulted = state.lastAbgAt !== null && state.simulationTime >= state.lastAbgAt
  return {
    'peak-pressure': measurements.peakPressureCmH2O,
    'peak-plateau-gap': plateau.interpretable
      ? measurements.peakPressureCmH2O - measurements.plateauPressureCmH2O
      : null,
    'intrinsic-peep': measurements.intrinsicPeepCmH2O,
    'exhaled-vt': measurements.exhaledVtMl,
    'total-rate': measurements.totalRatePerMin,
    'patient-rate': measurements.observedPatientRatePerMin,
    spo2: state.patient.gasExchange.spo2Percent,
    map: state.patient.hemodynamics.mapMmHg,
    dyspnea: state.patient.human.dyspneaScore,
    pain: state.patient.human.painScore,
    delirium: state.patient.human.deliriumScore,
    sedation: state.patient.human.sedationScore,
    paco2: repeatGasResulted ? state.patient.gasExchange.paCO2MmHg : null,
  }
}

/* ------------------------------------------------------------------------------------------------
 * What each action does, in mechanism terms
 * ---------------------------------------------------------------------------------------------- */

/**
 * `review` actions change nothing about the patient by design — they produce a reading or a record.
 * Saying so is the point: a bedside examination that is followed by numbers moving has not treated
 * anything, and a learner who reads it that way has learned the wrong lesson.
 *
 * `treatment` actions name the one reading that moves first when the mechanism they target is the
 * operative one. That reading, and not the general trend, is what the interpretation is keyed on —
 * because a simulated patient drifts, and a drifting number is not a response.
 */
interface InterventionCoachingProfile {
  readonly kind: 'review' | 'treatment'
  /**
   * The reading this action moves when the mechanism it targets is the operative one — and `null`
   * when no monitored number is this action's to move.
   *
   * A maneuver is `null` even when it produces a value the learner reads off the screen: an
   * expiratory hold does not move `intrinsicPeepCmH2O`, which the model derives continuously and the
   * console shows whether or not the valves ever closed. Keying the hold on it printed "this
   * occlusion has not produced a usable trapped-pressure reading" directly under the row showing that
   * reading, on every case that offers the maneuver.
   */
  readonly target: CoachingReadingId | null
  /**
   * Which way the target moves when that mechanism *is* the operative one. Not inferable from the
   * reading's own valence: removing a patient's effort makes the displayed peak pressure *rise*, and
   * that rise is the expected finding rather than a deterioration.
   */
  readonly targetDirection: 'fell' | 'rose' | 'either'
  /** Restate `plateauValidity`'s rule under this action, where a mechanics claim is in play. */
  readonly plateauCaveat?: boolean
  /** Verb phrase completing “This action …”. */
  readonly acts: string
  /** Clause completing “… so …” when the targeted reading moved in the expected direction. */
  readonly whenTargetMoved: string
  /** Clause completing “… so …” when it did not. */
  readonly whenTargetHeld: string
  /** What to look at next. */
  readonly reassess: string
  /**
   * What the observation does not establish. Two of them, because the honest limit of a response and
   * the honest limit of a non-response are different claims — a first draft printed the non-response
   * caveat ("a rate that did not fall is evidence against …") under a rate that had just fallen.
   */
  readonly notDemonstratedWhenMoved: string
  readonly notDemonstratedWhenHeld: string
}

const interventionCoachingProfiles: Readonly<
  Record<InterventionEffectId, InterventionCoachingProfile>
> = {
  'assess-patient': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    acts: 'looks at the patient and records what the examination shows',
    whenTargetMoved:
      'anything that moved did so on the patient’s own trajectory — looking at someone does not treat them',
    whenTargetHeld: 'nothing about the patient should have changed, and nothing did',
    reassess:
      'Take the examination back to the traces: decide which of the findings you just recorded the waveforms agree with.',
    notDemonstratedWhenMoved:
      'An examination narrows what is possible. It cannot show whether the mechanism is reversible — only an action aimed at that mechanism can do that.',
    notDemonstratedWhenHeld:
      'An examination narrows what is possible. It cannot show whether the mechanism is reversible — only an action aimed at that mechanism can do that.',
  },
  'review-waveforms': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    acts: 'reads the pressure, flow, volume, and effort traces against each other',
    whenTargetMoved:
      'the numbers that moved did so on the patient’s own trajectory, not because the traces were read',
    whenTargetHeld: 'reading the traces changes nothing about the patient, and nothing changed',
    reassess:
      'Name the one feature on the trace that separates the mechanism you committed to from the next most likely one.',
    notDemonstratedWhenMoved:
      'A pattern on the trace is consistent with a mechanism; it does not establish one. Two mechanisms can draw the same breath.',
    notDemonstratedWhenHeld:
      'A pattern on the trace is consistent with a mechanism; it does not establish one. Two mechanisms can draw the same breath.',
  },
  'inspiratory-hold': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    plateauCaveat: true,
    acts: 'closes the valves at end-inspiration so the airway equilibrates with the alveolus',
    whenTargetMoved:
      'anything that moved did so on the patient’s own trajectory — an occlusion measures, it does not treat',
    whenTargetHeld: 'nothing about the patient changed, which is what a measurement should do',
    reassess:
      'Repeat the occlusion across a few breaths and watch whether the held value settles rather than swinging.',
    notDemonstratedWhenMoved:
      'A plateau is a measurement, not a diagnosis. It says how the load divides; it does not say what put the load there. And a hold on a patient who is pulling reports the patient rather than the lung, in the reassuring direction.',
    notDemonstratedWhenHeld:
      'A plateau is a measurement, not a diagnosis. It says how the load divides; it does not say what put the load there. And a hold on a patient who is pulling reports the patient rather than the lung, in the reassuring direction.',
  },
  'expiratory-hold': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    acts: 'closes the valves at end-expiration so trapped gas can show its own pressure',
    whenTargetMoved:
      'anything that moved did so on the patient’s own trajectory — an occlusion measures, it does not treat',
    whenTargetHeld: 'nothing about the patient changed, which is what a measurement should do',
    reassess:
      'Compare the trapped pressure the occlusion held against expiratory flow at the moment the next breath begins — the two should tell the same story.',
    notDemonstratedWhenMoved:
      'Trapped pressure says how much gas failed to leave. It does not say why, and it does not separate airway narrowing from too little time to exhale.',
    notDemonstratedWhenHeld:
      'Trapped pressure says how much gas failed to leave. It does not say why, and it does not separate airway narrowing from too little time to exhale.',
  },
  'order-abg': {
    kind: 'review',
    target: 'paco2',
    targetDirection: 'either',
    acts: 'samples gas exchange after allowing simulated time for the current settings to act',
    whenTargetMoved: 'gas exchange under the settings now running has been sampled directly',
    whenTargetHeld:
      'the sample has not resulted yet, so gas exchange is still being read from the monitor rather than from blood',
    reassess:
      'Read the gas against the minute ventilation that produced it, not against the previous gas alone.',
    notDemonstratedWhenMoved:
      'A gas describes where the patient has been. It does not tell you whether the trajectory is still moving.',
    notDemonstratedWhenHeld:
      'Nothing about gas exchange has been established yet. The monitor is still the only source, and it is not the same measurement.',
  },
  'communicate-plan': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    acts: 'states the safety goal, the action, and the reassessment to the team and the patient',
    whenTargetMoved:
      'anything that moved did so on the patient’s own trajectory — stating a plan does not treat one',
    whenTargetHeld: 'stating the plan changes nothing about the patient, and nothing changed',
    reassess:
      'Check that the reassessment you named is one this patient can actually produce in the time you gave it.',
    notDemonstratedWhenMoved:
      'A closed loop makes the plan reviewable by someone else. It does not make the plan right.',
    notDemonstratedWhenHeld:
      'A closed loop makes the plan reviewable by someone else. It does not make the plan right.',
  },
  'disconnect-bag': {
    kind: 'treatment',
    target: 'intrinsic-peep',
    targetDirection: 'fell',
    acts: 'separates the patient from the circuit so gas that could not leave in time has somewhere to go',
    whenTargetMoved:
      'gas trapped behind the next breath was part of what these numbers were reporting',
    whenTargetHeld:
      'the response does not support trapped gas as the dominant load on this patient over this interval',
    reassess:
      'Watch blood pressure through the disconnection and immediately after reconnection — a rise that reverses is itself the finding.',
    notDemonstratedWhenMoved:
      'Relieving trapped gas is a rescue, not a correction. It has not shown what caused the trapping, and the trapping returns when the same settings do.',
    notDemonstratedWhenHeld:
      'A pressure that did not fall is evidence against trapped gas being the load here. It does not exclude a smaller amount of trapping, and it says nothing about airway narrowing within the breath.',
  },
  'treat-drive': {
    kind: 'treatment',
    target: 'patient-rate',
    targetDirection: 'fell',
    acts: 'treats the non-ventilator reason this patient is breathing so hard',
    whenTargetMoved:
      'the drive itself was part of what the ventilator was struggling to keep up with',
    whenTargetHeld:
      'the response does not support what was treated as the operative driver over this interval, and the demand on the ventilator is where it was',
    reassess:
      'Watch the patient’s own rate and effort over several minutes rather than at one breath — this one works slowly.',
    notDemonstratedWhenMoved:
      'A rate that fell is consistent with that being a driver. It does not exclude a second one that has not been treated.',
    notDemonstratedWhenHeld:
      'A rate that did not fall is evidence against what was treated being the driver. It is not evidence that the drive is fixed, and this treatment works over minutes rather than breaths.',
  },
  'reduce-sedation': {
    kind: 'treatment',
    target: 'sedation',
    targetDirection: 'rose',
    acts: 'lightens sedation so the patient’s own breathing pattern can return',
    whenTargetMoved:
      'the patient is less suppressed than they were, and whatever pattern sedation was hiding is now available to look at',
    whenTargetHeld:
      'sedation is where it was, so nothing it may have been hiding has been uncovered yet',
    reassess:
      'Look for variability returning — breath-to-breath difference in timing and size — rather than for one number.',
    notDemonstratedWhenMoved:
      'A lighter patient shows you more. It does not by itself correct the ventilator timing they are breathing against, and the pattern that returns still has to be read.',
    notDemonstratedWhenHeld:
      'Sedation that has not moved has shown nothing either way about what it was hiding.',
  },
  'deepen-sedation': {
    kind: 'treatment',
    target: 'sedation',
    targetDirection: 'fell',
    acts: 'suppresses the visible effort without changing what the effort was responding to',
    whenTargetMoved:
      'the patient is more deeply suppressed than they were — but the mechanism that produced the effort has not been touched, and that effort was what made the mechanism visible',
    whenTargetHeld: 'sedation is where it was, and nothing has been corrected either',
    reassess:
      'Re-read the traces now that effort is suppressed: whatever remains is the machine’s contribution, and it was there before.',
    notDemonstratedWhenMoved:
      'Quiet is not correction. Suppressing effort removes the signal that was telling you where the problem is, and it adds a risk of its own.',
    notDemonstratedWhenHeld:
      'Nothing has been corrected and nothing has been learned, and the risk that comes with deeper sedation has been taken anyway.',
  },
  'neuromuscular-blockade': {
    kind: 'treatment',
    target: 'peak-pressure',
    targetDirection: 'either',
    acts: 'removes the patient’s own effort from every pressure the ventilator measures',
    whenTargetMoved:
      'the pressures on the screen were being shaped by that effort, and what is on them now is the respiratory system alone',
    whenTargetHeld:
      'the response does not support the patient’s own effort as what was shaping these pressures over this interval',
    reassess:
      'If blockade is complete and the hold is technically valid, repeat the plateau measurement; active respiratory effort no longer confounds the pressure split. Blockade is not a way of obtaining a plateau — it is temporary, for immediate lung protection while the cause is corrected, and the measurement is a by-product of that decision rather than a reason for it.',
    notDemonstratedWhenMoved:
      'A pressure that rose when effort stopped is not a deterioration — it is the load that was always there becoming visible. Nothing about the timing problem has been corrected.',
    notDemonstratedWhenHeld:
      'Pressures that did not move do not support the patient’s own effort as what was shaping them over this interval. They say nothing about whether the timing the patient was fighting has been corrected, and they are not a reason to continue blockade.',
  },
  bronchodilator: {
    kind: 'treatment',
    target: 'peak-pressure',
    targetDirection: 'fell',
    acts: 'relaxes airway smooth muscle, if constricted muscle is what is narrowing the path',
    whenTargetMoved:
      'constricted airways were part of the resistance the same breath was being pushed through',
    whenTargetHeld:
      'the response does not support constricted airway muscle as the dominant narrowing over this interval — the pressure the same breath needs is where it was',
    reassess:
      'Recheck the peak-to-plateau difference over several minutes — this one keeps working after the first breath.',
    notDemonstratedWhenMoved:
      'A response in that direction does not establish that this was the whole narrowing. Read how far the pressure moved against how far it had to go: if the same breath still needs most of the pressure it did, something else is still in the path.',
    notDemonstratedWhenHeld:
      'A pressure that did not fall is evidence against constricted airways being the dominant narrowing here. It does not establish the absence of bronchospasm, and a partial response can be hidden by a second narrowing that is still in place.',
  },
  'suction-airway': {
    kind: 'treatment',
    target: 'peak-pressure',
    targetDirection: 'fell',
    acts: 'removes material sitting inside the airway and the tube',
    whenTargetMoved:
      'material in the lumen was part of what the same breath was being pushed through',
    whenTargetHeld:
      'the response does not support material in the lumen as the dominant narrowing over this interval — removing what could be removed did not change the pressure the same breath needs',
    reassess:
      'Note whether the catheter passed freely, and recheck the peak-to-plateau difference on the next quiet breaths.',
    notDemonstratedWhenMoved:
      'A response in that direction does not establish that this was the whole narrowing. Read how far the pressure moved against how far it had to go: if the same breath still needs most of the pressure it did, something else is still in the path — the tube itself, or the airways beyond it.',
    notDemonstratedWhenHeld:
      'A pressure that did not fall is evidence against secretions being the operative narrowing. It does not exclude a smaller amount of material, and it says nothing about the airway walls or the tube itself.',
  },
  'inspect-circuit': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    acts: 'looks along the tube, cuff, filter, connections, and flow sensor without changing any of them',
    whenTargetMoved:
      'anything that moved did so on the patient’s own trajectory — inspection changes nothing',
    whenTargetHeld: 'inspection changes nothing about the patient, and nothing changed',
    reassess:
      'Take what the inspection found back to the trigger and the trace, and decide which of them it explains.',
    notDemonstratedWhenMoved:
      'Finding something in the circuit does not establish that it is what the ventilator is answering. Removing it and watching the signal is what would.',
    notDemonstratedWhenHeld:
      'Finding nothing is not the same as there being nothing. An inspection reaches what it can see, and the trigger answers what it can feel.',
  },
  'drain-condensate': {
    kind: 'treatment',
    target: 'total-rate',
    targetDirection: 'fell',
    acts: 'removes water that was moving near the flow sensor',
    whenTargetMoved:
      'the ventilator had been reading that movement as the start of a breath, and it has stopped',
    whenTargetHeld:
      'the response does not support water at the sensor as the operative trigger source over this interval — removing it did not change how often a breath is delivered',
    reassess:
      'Compare the delivered rate against the patient’s own rate, and watch the expiratory limb for the artifact returning.',
    notDemonstratedWhenMoved:
      'The delivered rate falling toward the patient’s own is what a false trigger stopping looks like. It does not establish that the trigger is now set where it should be, and water re-collects.',
    notDemonstratedWhenHeld:
      'A rate that did not fall is evidence against condensate being the trigger source. It does not exclude another signal in the circuit, and it does not exclude a genuinely oversensitive trigger.',
  },
  'correct-leak': {
    kind: 'treatment',
    target: 'total-rate',
    targetDirection: 'fell',
    acts: 'seals a continuing escape of gas from the cuff or circuit',
    whenTargetMoved:
      'continuous leak flow had been crossing the trigger the way an inspiratory effort does',
    whenTargetHeld:
      'the response does not support leak flow as the operative trigger source over this interval — sealing it did not change how often a breath is delivered',
    reassess:
      'Compare delivered and exhaled breath size now, and watch whether the breath still ends late.',
    notDemonstratedWhenMoved:
      'Sealing the leak removed one signal the trigger was answering. It does not establish that the trigger threshold itself is appropriate for this patient.',
    notDemonstratedWhenHeld:
      'A rate that did not change is evidence against leak flow being the trigger source. It does not exclude a smaller leak, and it does not exclude water or cardiac oscillation at the sensor.',
  },
  'remove-hme': {
    kind: 'treatment',
    target: 'peak-pressure',
    targetDirection: 'fell',
    acts: 'takes an obstructed component out of the gas path',
    whenTargetMoved: 'the obstruction was in the apparatus rather than in the patient',
    whenTargetHeld:
      'the response does not support that component as the dominant narrowing over this interval — taking it out of the path did not change the pressure the same breath needs',
    reassess:
      'Recheck the peak-to-plateau difference, and confirm humidification is still being provided some other way.',
    notDemonstratedWhenMoved:
      'A pressure that fell locates the narrowing in the apparatus. It does not establish that the apparatus was the only narrowing, and humidification now has to come from somewhere else.',
    notDemonstratedWhenHeld:
      'A pressure that did not fall is evidence against that component being the narrowing. The tube beyond it, and the airways beyond that, have not been separated by this.',
  },
  'reposition-ett': {
    kind: 'treatment',
    target: 'peak-pressure',
    targetDirection: 'fell',
    acts: 'corrects or replaces the tube itself as the narrowest part of the gas path',
    whenTargetMoved: 'the tube was the narrowing, and the bore the gas travels through is restored',
    whenTargetHeld:
      'the response does not support the tube as the dominant narrowing over this interval — correcting it did not change the pressure the same breath needs',
    reassess:
      'Confirm tube position and passage directly, then recheck the peak-to-plateau difference on the next quiet breaths.',
    notDemonstratedWhenMoved:
      'A pressure that fell locates the narrowing at the tube. It does not exclude narrowing further down that the tube was masking.',
    notDemonstratedWhenHeld:
      'A pressure that did not fall is evidence against the tube being the operative narrowing. It does not exclude material inside it that has since moved, or narrowing beyond it.',
  },
  'decompress-pneumothorax': {
    kind: 'treatment',
    target: 'map',
    targetDirection: 'rose',
    acts: 'relieves pressure in the pleural space that was obstructing filling of the heart',
    whenTargetMoved:
      'the circulation was being obstructed rather than merely underfilled, and relieving it is what moved the blood pressure',
    whenTargetHeld:
      'the response does not support obstruction of cardiac filling as what is holding the blood pressure down over this interval',
    reassess:
      'Watch blood pressure, oxygenation, and chest movement together, and expect the improvement to need securing rather than to hold on its own.',
    notDemonstratedWhenMoved:
      'An emergency decompression is a rescue. It does not establish definitive treatment, and a response that fades is the expected course rather than a new problem.',
    notDemonstratedWhenHeld:
      'A blood pressure that did not move is evidence against obstruction being the dominant limit on it. It does not exclude a pneumothorax this did not reach, and it does not exclude a second cause holding the pressure down alongside it.',
  },
  'pleural-drainage': {
    kind: 'treatment',
    /*
     * The pressure the same breath needs, not the blood pressure.
     *
     * The hemodynamic rescue belongs to the emergency decompression that has to precede this: by the
     * time drainage is established the circulation has already recovered, so a blood pressure that
     * holds is the expected course rather than a failure. What continuing drainage moves in the model
     * is the compliance of the respiratory system, and on this volume-targeted patient that shows as
     * the same breath needing less pressure.
     */
    target: 'peak-pressure',
    targetDirection: 'fell',
    acts: 'establishes continuing drainage so the space cannot refill',
    whenTargetMoved:
      'the lung has more room than the emergency decompression alone gave it, and the same breath is being delivered for less pressure',
    whenTargetHeld:
      'the response does not support the pleural space as what is still limiting the mechanics over this interval',
    reassess:
      'Blood pressure still has to be watched, but it is not the reading that answers whether the drainage worked — the rescue that raised it was the decompression before this. Watch instead whether the pressure this breath needs stays where it has been put.',
    notDemonstratedWhenMoved:
      'One interval does not show that the space will stay controlled. Securing it also does not treat whatever caused it, and a blood pressure that is holding is holding on the decompression, not yet on this.',
    notDemonstratedWhenHeld:
      'A blood pressure that has not moved is not evidence against this action: the hemodynamic rescue was the decompression, and it has already happened. What this interval has not shown is a mechanical gain, and one interval cannot show that the space will stay controlled either.',
  },
  'communication-board': {
    kind: 'treatment',
    target: null,
    targetDirection: 'either',
    acts: 'gives the patient a way to say what breathing feels like',
    whenTargetMoved:
      'what moved did so on the patient’s own trajectory — being able to answer is not itself a treatment',
    whenTargetHeld:
      'no monitored number should move for this, and none did: what changed is what the patient can now tell you',
    reassess:
      'Ask specifically about air hunger, effort, and timing, and treat what the answer names rather than what the monitor shows.',
    notDemonstratedWhenMoved:
      'Being able to communicate makes distress describable. It does not show which of several reversible causes is producing it.',
    notDemonstratedWhenHeld:
      'Being able to communicate makes distress describable. It does not show which of several reversible causes is producing it.',
  },
  'treat-pain': {
    kind: 'treatment',
    target: 'pain',
    targetDirection: 'fell',
    acts: 'treats pain directly, in a way that keeps the patient able to answer',
    whenTargetMoved: 'pain was one of the reversible things driving this patient’s breathing',
    whenTargetHeld:
      'the response does not support pain — or at least the pain this treatment reaches — as the operative driver over this interval',
    reassess:
      'Ask again, and watch the reported breathing discomfort over minutes rather than breaths.',
    notDemonstratedWhenMoved:
      'Pain falling is consistent with pain having been a driver. It does not exclude another reversible cause still in place, and comfort is not the same as corrected timing.',
    notDemonstratedWhenHeld:
      'Pain that did not fall is evidence against what was treated being its dominant source. It does not exclude pain from somewhere the treatment did not reach, and it does not exclude pain that needs longer than this.',
  },
  'relieve-bladder': {
    kind: 'treatment',
    target: 'pain',
    targetDirection: 'fell',
    acts: 'relieves bladder distension as a reversible source of distress',
    whenTargetMoved: 'distension was one of the reversible things driving this patient',
    whenTargetHeld:
      'the response does not support distension as an operative source of this patient’s distress over this interval',
    reassess:
      'Ask what changed from the patient’s side, and recheck reported discomfort over the next few minutes.',
    notDemonstratedWhenMoved:
      'One reversible cause treated does not mean the others have been looked for. Discomfort with several sources falls in steps.',
    notDemonstratedWhenHeld:
      'No response here narrows the list by one. It does not tell you which of the remaining causes to look at next.',
  },
  reorient: {
    kind: 'treatment',
    target: 'delirium',
    targetDirection: 'fell',
    acts: 'provides calm, consistent orientation to where the patient is and what is happening',
    whenTargetMoved: 'disorientation was contributing to what this patient was showing you',
    whenTargetHeld:
      'the response does not support disorientation as the limiting problem over this interval — which for something this slow is a weak reading either way',
    reassess:
      'Watch across a longer stretch than a ventilator change needs, and check whether the patient can follow the plan you stated.',
    notDemonstratedWhenMoved:
      'Orientation improving does not treat pain, air hunger, or ventilator timing, and delirium that improves briefly is not delirium resolved.',
    notDemonstratedWhenHeld:
      'This is one of the slowest things available here. A flat reading over this interval is weak evidence either way.',
  },
  'reduce-noise': {
    kind: 'treatment',
    target: 'delirium',
    targetDirection: 'fell',
    acts: 'removes environmental disruption that has been preventing rest',
    whenTargetMoved: 'the environment was part of what this patient was reacting to',
    whenTargetHeld:
      'the response does not support the environment as the limiting problem over this interval — and this is the slowest change available here, so an interval this short says little',
    reassess:
      'This one is measured over a night rather than a breath — plan the reassessment accordingly.',
    notDemonstratedWhenMoved:
      'A quieter room does not treat pain, retention, or under-assistance, and one improved interval is not a night of rest.',
    notDemonstratedWhenHeld:
      'This is the slowest change available here, and a flat reading over an interval this short says almost nothing about it.',
  },
  'assess-strength': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    acts: 'tests how much of the breathing effort this patient is able to generate',
    whenTargetMoved:
      'anything that moved did so on the patient’s own trajectory — measuring strength does not change it',
    whenTargetHeld: 'measuring strength changes nothing about the patient, and nothing changed',
    reassess:
      'Read the trigger settings against what you just found the patient can actually produce.',
    notDemonstratedWhenMoved:
      'Weakness explains why an effort might not reach the trigger. It does not establish that the trigger is set where it should be.',
    notDemonstratedWhenHeld:
      'Weakness explains why an effort might not reach the trigger. It does not establish that the trigger is set where it should be.',
  },
  'prone-plan': {
    kind: 'review',
    target: null,
    targetDirection: 'either',
    acts: 'records escalation planning without changing anything currently being delivered',
    whenTargetMoved:
      'anything that moved did so on the patient’s own trajectory — planning is not a delivered change',
    whenTargetHeld: 'planning changes nothing currently delivered, and nothing changed',
    reassess:
      'Return to the mechanics in front of you: the escalation is planned, and the current breath is still the one being delivered.',
    notDemonstratedWhenMoved:
      'Documenting escalation does not substitute for the ventilator-side reasoning the case is asking for.',
    notDemonstratedWhenHeld:
      'Documenting escalation does not substitute for the ventilator-side reasoning the case is asking for.',
  },
}

/* ------------------------------------------------------------------------------------------------
 * The baseline, captured at the moment of the action
 * ---------------------------------------------------------------------------------------------- */

/**
 * Readings the console computes from the trace it is displaying, rather than reporting directly.
 *
 * The peak is the maximum over the whole waveform buffer and the exhaled breath is integrated from
 * it, so neither can report a change until the buffer holds breaths taken after the change. The
 * plateau is estimated off the same trace, so the peak-to-plateau difference inherits it.
 */
const traceDerivedReadings: readonly CoachingReadingId[] = [
  'peak-pressure',
  'peak-plateau-gap',
  'exhaled-vt',
]

function settleSecondsFor(effectId: InterventionEffectId | null, breathSeconds: number): number {
  const target = effectId ? interventionCoachingProfiles[effectId]?.target : null
  return target && traceDerivedReadings.includes(target)
    ? Math.max(breathSeconds, WAVEFORM_WINDOW_SECONDS)
    : breathSeconds
}

/**
 * The ventilator settings, as one comparable value.
 *
 * A control change records no intervention, so without this a learner who suctioned and then raised
 * PEEP while the suction was developing would be shown the combined response attributed to the
 * suction alone.
 */
function settingsFingerprint(state: VentilationSimulationState): string {
  return JSON.stringify(state.ventilator.settings)
}

export interface PostActionBaseline {
  readonly recordId: string
  readonly interventionId: string
  readonly effectId: InterventionEffectId | null
  readonly actionLabel: string
  readonly actionSeconds: number
  /** The engine's own stamp: when the case says this action's effect reaches the model. */
  readonly effectiveAtSeconds: number
  /**
   * How long after the effect reaches the model before its response can be *read*.
   *
   * One breath at the rate this patient was running for a reading the model reports directly. For a
   * reading the console computes from the trace it is displaying, one length of that trace — the
   * displayed peak is the maximum over the whole buffer, so until the buffer is a buffer of the
   * response it is still reporting the breaths before the action. Measured on MV-13: suctioning the
   * patient whose airway holds secretions drops resistance from 30 to 12 at the instant the effect
   * lands, and the printed peak stays at 43 cmH₂O for a further 11 seconds before falling to 24.
   *
   * Both numbers already existed: the patient's own rate, and `WAVEFORM_WINDOW_SECONDS`.
   */
  readonly settleSeconds: number
  readonly readings: CoachingReadingSnapshot
  readonly criticalErrorCount: number
  /** What the ventilator was set to when the action was taken. See `settingsFingerprint`. */
  readonly settingsFingerprint: string
}

/**
 * Snapshot the observable state as it was *before* the action reached the model.
 *
 * The "before" is reconstructed rather than remembered. `applyIntervention` adds the record and
 * recomputes measurements from it; it advances no time and touches no waveform. So dropping that one
 * record and re-deriving gives exactly the numbers the console was printing the instant before the
 * button was pressed — which matters, because a zero-latency action is effective the moment it is
 * recorded, and a snapshot taken from the post-dispatch state would report every one of them as
 * having changed nothing.
 *
 * Reconstructing also means the caller does not have to hold the previous render's state, and the
 * function gives the same answer whether it is handed the state from just before the action or the
 * one from just after it.
 */
export function capturePostActionBaseline(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  record: InterventionRecord,
): PostActionBaseline {
  const intervention = definition.interventions.find((item) => item.id === record.interventionId)
  const withoutAction: VentilationSimulationState = {
    ...state,
    interventions: state.interventions.filter((item) => item.id !== record.id),
    simulationTime: record.time,
    /*
     * `applyIntervention` also stamps `lastAbgAt` forward for an ordered gas, and that stamp survives
     * the spread above. Rewinding it makes the reconstruction right by construction rather than by
     * coincidence: a gas that had not resulted at the moment of the action had not resulted, and one
     * that had is kept.
     */
    lastAbgAt: state.lastAbgAt !== null && state.lastAbgAt <= record.time ? state.lastAbgAt : null,
  }
  const patient = deriveEffectivePatient(withoutAction, definition)
  const before: VentilationSimulationState = {
    ...withoutAction,
    patient,
    measurements: deriveMeasurements(withoutAction, definition, patient),
  }
  return {
    recordId: record.id,
    interventionId: record.interventionId,
    effectId: intervention?.effectId ?? null,
    actionLabel: record.label,
    actionSeconds: record.time,
    /*
     * The later of the two times the case itself declares.
     *
     * `applyIntervention` stamps `effectiveAt = time` for an assessment or ventilator action, because
     * those effects reach the *model* immediately. Their authored `latencySeconds` is a different
     * statement — how long before the learner can read the result — and for `order-abg` it is 60
     * seconds. Taking only `effectiveAt` closed the interval after one breath and latched
     * "the sample has not resulted yet" as this action's whole report. Both numbers are the case's
     * own; neither is invented here.
     */
    effectiveAtSeconds: Math.max(
      record.effectiveAt,
      record.time + (intervention?.latencySeconds ?? 0),
    ),
    settleSeconds: settleSecondsFor(
      intervention?.effectId ?? null,
      60 / Math.max(1, before.measurements.totalRatePerMin),
    ),
    readings: coachingReadingSnapshot(before),
    criticalErrorCount: state.criticalErrors.length,
    settingsFingerprint: settingsFingerprint(state),
  }
}

/* ------------------------------------------------------------------------------------------------
 * The observation interval
 * ---------------------------------------------------------------------------------------------- */

export interface PostActionObservation {
  /** Simulated second at which the response has both happened and been watched for a breath. */
  readonly completeAtSeconds: number
  readonly secondsRemaining: number
  readonly complete: boolean
}

export function postActionObservation(
  state: VentilationSimulationState,
  baseline: PostActionBaseline,
): PostActionObservation {
  const completeAtSeconds = baseline.effectiveAtSeconds + baseline.settleSeconds
  const secondsRemaining = Math.max(0, completeAtSeconds - state.simulationTime)
  return { completeAtSeconds, secondsRemaining, complete: secondsRemaining <= 0 }
}

/* ------------------------------------------------------------------------------------------------
 * Coaching
 * ---------------------------------------------------------------------------------------------- */

export interface CoachingReading {
  readonly id: CoachingReadingId
  readonly label: string
  /** The label as it reads mid-sentence, for the observed-summary line. */
  readonly inlineLabel: string
  readonly unit: string
  readonly precision: number
  /** `null` when the reading was not available before the action — a value revealed, not changed. */
  readonly before: number | null
  readonly after: number
  readonly direction: CoachingDirection
  /** `null` when the direction alone does not say whether this is better or worse. */
  readonly favourable: boolean | null
  /** True for the one reading this action moves first when its target mechanism is operative. */
  readonly targeted: boolean
}

export type CoachingVerdict = 'improved' | 'worsened' | 'mixed' | 'unchanged'

export interface PostActionCoaching {
  readonly recordId: string
  readonly actionLabel: string
  readonly kind: 'review' | 'treatment'
  readonly verdict: CoachingVerdict
  readonly verdictLabel: string
  readonly observed: readonly CoachingReading[]
  /** What changed, in one sentence. */
  readonly observedSummary: string
  /** The physiologic reading of those findings, and nothing beyond them. */
  readonly interpretation: string
  /** What this observation has not shown. */
  readonly notDemonstrated: string
  readonly reassess: string
  readonly stabilizationRequired: boolean
  readonly stabilization: string
}

/**
 * The label says *readings*, not *patient*, on purpose.
 *
 * These four are computed from the numbers over the interval, and a simulated patient is on a
 * trajectory of its own throughout it. Calling the summary "the patient improved" would attribute
 * that trajectory to the learner's action, which is the exact error the coaching then spends a
 * paragraph warning against. "No better, no worse" covers both nothing moving and only a reading
 * whose direction carries no valence moving — a delivered rate or a breath size on its own.
 */
const verdictLabels: Readonly<Record<CoachingVerdict, string>> = {
  improved: 'Readings moved toward better',
  worsened: 'Readings moved toward worse',
  mixed: 'Readings moved both ways',
  unchanged: 'No better, no worse',
}

/**
 * A reading "changed" when it differs by at least one unit of the precision the surface prints it at.
 *
 * Still a display rule and not a clinical one — it is the resolution of the instrument, not a
 * statement about how much of a change matters to a patient. Publishing "a fall of N cmH₂O counts"
 * would be exactly the universal target this module refuses to invent.
 *
 * Comparing the *rounded* values instead, which is what this did first, made a rounding boundary
 * into a finding. Measured on MV-13 with no action performed at all, the printed peak wanders 43.8
 * to 43.2 over the same interval an action is watched across — under one cmH₂O, but across the 44/43
 * boundary. Two treatments that reach nothing on that patient were reported as having lowered the
 * pressure, and the block then credited the mechanism they target. One printed unit is the smallest
 * change the surface can actually assert.
 */
function direction(before: number, after: number, precision: number): CoachingDirection {
  const resolution = 10 ** -precision
  const change = after - before
  if (change >= resolution - 1e-9) return 'rose'
  if (change <= -(resolution - 1e-9)) return 'fell'
  return 'held'
}

function favourability(descriptor: ReadingDescriptor, movement: CoachingDirection): boolean | null {
  if (movement === 'held' || descriptor.betterWhen === 'context') return null
  return descriptor.betterWhen === 'lower' ? movement === 'fell' : movement === 'rose'
}

/** Readings the console and bedside always show, so "nothing moved" is a reported finding. */
const coreReadings: readonly CoachingReadingId[] = ['peak-pressure', 'spo2', 'map']

function buildReadings(
  baseline: PostActionBaseline,
  current: CoachingReadingSnapshot,
  target: CoachingReadingId | null,
): readonly CoachingReading[] {
  const selected: CoachingReading[] = []
  for (const id of readingOrder) {
    const after = current[id]
    if (after === null) continue
    const before = baseline.readings[id]
    const descriptor = readingDescriptors[id]
    const movement = before === null ? 'held' : direction(before, after, descriptor.precision)
    const isTarget = id === target
    const revealed = before === null
    const include = isTarget || revealed || coreReadings.includes(id) || movement !== 'held'
    if (!include) continue
    selected.push({
      id,
      label: descriptor.label,
      inlineLabel: descriptor.inlineLabel,
      unit: descriptor.unit,
      precision: descriptor.precision,
      before,
      after,
      direction: movement,
      favourable: before === null ? null : favourability(descriptor, movement),
      targeted: isTarget,
    })
  }
  return selected
}

/** The inline labels are written for mid-sentence use, so a clause that starts one has to re-case. */
function upperFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function listPhrase(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

function observedSummary(
  readings: readonly CoachingReading[],
  newSafetyInterruption: boolean,
): string {
  const moved = readings.filter(
    (reading) => reading.direction !== 'held' && reading.before !== null,
  )
  const revealed = readings.filter((reading) => reading.before === null)
  /*
   * "Was not available when you acted" rather than "for the first time": `lastAbgAt` is a single slot,
   * so once a second gas is ordered the engine no longer knows that an earlier one had resulted, and
   * claiming a first reading would sometimes be false. What is always true is that the value was not
   * on the screen at the moment of the action and is now.
   */
  const revealedClause = revealed.length
    ? ` ${upperFirst(listPhrase(revealed.map((reading) => reading.inlineLabel)))} was not available when you acted, and is now.`
    : ''
  const safetyClause = newSafetyInterruption
    ? ' A safety interruption opened while you were watching; it is above, and it takes precedence over the rest of this.'
    : ''
  if (moved.length === 0) {
    return `None of the readings above is printing a different number than it was when you acted.${revealedClause}${safetyClause}`
  }
  const fell = moved.filter((reading) => reading.direction === 'fell')
  const rose = moved.filter((reading) => reading.direction === 'rose')
  const parts: string[] = []
  if (fell.length) parts.push(`${listPhrase(fell.map((r) => r.inlineLabel))} fell`)
  if (rose.length) parts.push(`${listPhrase(rose.map((r) => r.inlineLabel))} rose`)
  const valencedMoved = moved.some((reading) => reading.favourable !== null)
  const valenceClause = valencedMoved ? '' : ' Nothing that would say better or worse moved at all.'
  return `Over the interval you watched, ${listPhrase(parts)}; everything else above is printing the number it was.${valenceClause}${revealedClause}${safetyClause}`
}

/**
 * The summary of what the numbers did — not a judgement of the action.
 *
 * A new safety interruption deliberately does *not* force this to `worsened`. On MV-14 an
 * interruption opens from accumulated hypotension while an emergency decompression is visibly
 * rescuing the patient in every reading; calling that "worse" would be a false report of the
 * measurements. The interruption is stated where it belongs — as an observation, and in the
 * stabilization answer — rather than folded into a summary of readings it is not one of.
 */
function computeVerdict(readings: readonly CoachingReading[]): CoachingVerdict {
  const valenced = readings.filter((reading) => reading.favourable !== null)
  const better = valenced.some((reading) => reading.favourable === true)
  const worse = valenced.some((reading) => reading.favourable === false)
  if (better && worse) return 'mixed'
  if (better) return 'improved'
  if (worse) return 'worsened'
  /*
   * Nothing whose direction means better or worse moved. A breath size or a delivered rate may still
   * have changed, and that is reported as a reading — but on its own it is neither an improvement nor
   * a deterioration, and it is not called one.
   */
  return 'unchanged'
}

/** Held apart from "did not move", because they are different findings and read differently. */
type TargetResponse = 'responded' | 'opposed' | 'held'

/**
 * Did the reading this action moves first move the way it moves when the mechanism is operative?
 *
 * Keyed on the targeted reading rather than on the overall summary, because the summary includes the
 * patient's own trajectory and the targeted reading is the one the action can be argued to have
 * moved.
 *
 * Three answers rather than two. A first version returned a boolean, so "did not move" and "moved
 * the wrong way" both selected the not-responded copy — and on MV-03 that printed "the pressures were
 * already reporting the respiratory system rather than the effort" under a peak pressure that had
 * just risen from 40 to 42, while on MV-08 it printed "releasing it changed nothing" under a trapped
 * pressure that had gone up. A reading that moved against the action is a finding of its own and gets
 * said as one.
 *
 * A profile that names a target whose reading is *unavailable* — a plateau split on a patient who is
 * pulling — counts as `held`: an unavailable reading has not shown anything.
 */
function targetResponse(
  profile: InterventionCoachingProfile,
  readings: readonly CoachingReading[],
): TargetResponse {
  if (profile.target === null) {
    // No monitored number is this action's to move, so the question is only whether anything moved.
    return readings.some((reading) => reading.direction !== 'held' && reading.before !== null)
      ? 'responded'
      : 'held'
  }
  const targetReading = readings.find((reading) => reading.targeted)
  if (!targetReading) return 'held'
  // A value that was not available before and is now is a response to the maneuver that produced it.
  if (targetReading.before === null) return 'responded'
  if (targetReading.direction === 'held') return 'held'
  if (profile.targetDirection === 'either') return 'responded'
  return targetReading.direction === profile.targetDirection ? 'responded' : 'opposed'
}

function interpretation(
  profile: InterventionCoachingProfile,
  response: TargetResponse,
  target: CoachingReading | undefined,
  verdict: CoachingVerdict,
): string {
  const lead = `This action ${profile.acts}.`
  const body =
    response === 'opposed' && target
      ? `${lead} ${target.label} moved the other way instead — not the direction this action produces when the mechanism it targets is what is at work. Something else is moving that number, or that is not the mechanism at work here.`
      : `${lead} On the readings above, ${
          response === 'responded' ? profile.whenTargetMoved : profile.whenTargetHeld
        }.`
  return verdict === 'mixed'
    ? `${body} Some readings went the other way over the same interval, and both are findings — neither cancels the other.`
    : body
}

/**
 * The plateau caveat is added only where a resistive/elastic claim is actually in play — an action
 * aimed at the pressure a breath needs, or at the split itself. Attaching it to a comfort action
 * would be noise, and the rule it restates is `plateauValidity`'s, not a new one.
 */
function plateauClaimInPlay(profile: InterventionCoachingProfile): boolean {
  return (
    profile.plateauCaveat === true ||
    profile.target === 'peak-pressure' ||
    profile.target === 'peak-plateau-gap'
  )
}

function notDemonstrated(
  profile: InterventionCoachingProfile,
  readings: readonly CoachingReading[],
  response: TargetResponse,
  baseline: PostActionBaseline,
  state: VentilationSimulationState,
): string {
  const clauses = [
    response === 'responded' ? profile.notDemonstratedWhenMoved : profile.notDemonstratedWhenHeld,
  ]
  /*
   * A setting changed between the action and this reading, so the two are confounded and the block
   * has to say so. `SET_CONTROL` records no intervention, so nothing else here would notice.
   */
  if (settingsFingerprint(state) !== baseline.settingsFingerprint) {
    clauses.push(
      'A ventilator setting was also changed while this was developing, so what moved over the interval cannot be attributed to the action on its own.',
    )
  }
  const untargetedMovers = readings.filter(
    (reading) => !reading.targeted && reading.before !== null && reading.direction !== 'held',
  )
  if (untargetedMovers.length > 0) {
    clauses.push(
      'This patient keeps changing whether or not anyone acts, so a reading that moved over this interval is not automatically a reading this action moved.',
    )
  }
  const validity = plateauReadingValidity(state)
  if (plateauClaimInPlay(profile) && !validity.interpretable) {
    clauses.push(
      `The peak-to-plateau split is withheld rather than reported here — ${plateauWithheldNote(validity)}.`,
    )
  }
  return clauses.join(' ')
}

function stabilizationAnswer(state: VentilationSimulationState): {
  required: boolean
  text: string
} {
  if (state.criticalErrors.length > 0) {
    return {
      required: true,
      text: 'Yes. A safety interruption is open on this case and takes precedence over any further localizing.',
    }
  }
  const urgent = state.alarms.filter((alarm) => alarm.priority === 'high' && alarm.active)
  if (urgent.length > 0) {
    return {
      required: true,
      text: `Yes. ${listPhrase(urgent.map((alarm) => alarm.message))} ${urgent.length === 1 ? 'is' : 'are'} active on the ventilator now — stabilize before continuing to localize.`,
    }
  }
  /*
   * Two checks, named as two checks. The earlier wording — "no high-priority alarm is active, so
   * continue localizing rather than escalating" — turned the absence of an alarm into a conclusion
   * about the patient, which is the same error the rest of the block spends its length avoiding.
   */
  return {
    required: false,
    text: 'No active safety interruption or high-priority ventilator alarm is shown. Continue immediate bedside reassessment; those two checks alone do not establish that no stabilization or escalation is needed.',
  }
}

/**
 * The coaching for the most recent action, or `null` while it is still being withheld.
 *
 * Returns `null` — and therefore renders nothing at all — unless every one of these holds:
 *
 * 1. this is the independent Practice workflow (Learn shows its own answer; Assess shows none);
 * 2. the learner's frame has been committed, so nothing here can precede the commitment;
 * 3. an action has been performed and the supplied baseline is that action's;
 * 4. the case's own latency for that action has elapsed and one of this patient's breaths has been
 *    delivered since — the observation interval.
 */
export function ventilationPostActionCoaching(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  baseline: PostActionBaseline | null,
): PostActionCoaching | null {
  if (baseline === null) return null
  if (state.experience !== 'practice') return null
  if (!state.prediction.committed) return null
  const record = state.interventions.at(-1)
  if (!record || record.id !== baseline.recordId) return null
  if (!postActionObservation(state, baseline).complete) return null
  const profile = baseline.effectId ? interventionCoachingProfiles[baseline.effectId] : undefined
  if (!profile) return null

  const current = coachingReadingSnapshot(state)
  const readings = buildReadings(baseline, current, profile.target)
  const newSafetyInterruption = state.criticalErrors.length > baseline.criticalErrorCount
  const verdict = computeVerdict(readings)
  const response = targetResponse(profile, readings)
  const stabilization = stabilizationAnswer(state)

  return {
    recordId: baseline.recordId,
    actionLabel: baseline.actionLabel,
    kind: profile.kind,
    verdict,
    verdictLabel: verdictLabels[verdict],
    observed: readings,
    observedSummary: observedSummary(readings, newSafetyInterruption),
    interpretation: interpretation(
      profile,
      response,
      readings.find((reading) => reading.targeted),
      verdict,
    ),
    notDemonstrated: notDemonstrated(profile, readings, response, baseline, state),
    reassess: profile.reassess,
    stabilizationRequired: stabilization.required,
    stabilization: stabilization.text,
  }
}

/** Every effect the coaching model can speak about, for the coverage test. */
export const coachedInterventionEffectIds = Object.keys(
  interventionCoachingProfiles,
) as readonly InterventionEffectId[]
