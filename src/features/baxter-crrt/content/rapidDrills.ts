import type { CrrtEngineFaultId } from '../engine/types'
import { CRRT_RAPID_DRILL_ARTIFACT_IDS } from './artifactRegistry'
import { CRRT_NUMBERS } from './teachingNumbers'
import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

const N = CRRT_NUMBERS.value

export const CRRT_RAPID_DRILL_IDS = CRRT_RAPID_DRILL_ARTIFACT_IDS
export type CrrtRapidDrillId = (typeof CRRT_RAPID_DRILL_IDS)[number]

export interface CrrtRapidDrillPredictionOption {
  readonly id: string
  readonly disposition: 'safe' | 'accepted-alternative' | 'unsafe'
  readonly label: string
  readonly description: string
}

export interface CrrtRapidDrillDefinition {
  readonly id: CrrtRapidDrillId
  readonly contentVersion: typeof BAXTER_CRRT_CONTENT_VERSION
  readonly title: string
  readonly engineFaultIds: readonly CrrtEngineFaultId[]
  readonly openingSignal: string
  readonly predictionPrompt: string
  readonly predictionOptions: readonly CrrtRapidDrillPredictionOption[]
  readonly candidateCauseOptionId: string
  readonly acceptedAlternativeOptionId: string
  readonly unsafeOptionId: string
  readonly criticalErrorCandidate: string
  readonly deviceResponseBoundary: string
  readonly inspectionDomain: string
  readonly correctionBoundary: string
  readonly reassessmentDomain: string
  readonly sourceRecordIds: readonly string[]
  readonly reviewStatus: 'pending'
  readonly learnerRunnable: true
  readonly runnable: true
  readonly scoringAvailable: true
  readonly analyticsAvailable: true
  readonly progressPersistenceAvailable: true
  readonly competencyAvailable: false
}

interface DrillSeed {
  readonly id: CrrtRapidDrillId
  readonly title: string
  readonly engineFaultIds: readonly CrrtEngineFaultId[]
  readonly openingSignal: string
  readonly predictionPrompt: string
  readonly safeLabel: string
  readonly safeWhy: string
  readonly alternativeLabel: string
  readonly alternativeWhy: string
  readonly unsafeLabel: string
  readonly unsafeWhy: string
  /** What goes wrong for the patient if the unsafe response is taken. */
  readonly criticalErrorCandidate: string
  /** What the machine does on this alarm, from the operator's manual. */
  readonly deviceResponseBoundary: string
  readonly inspectionDomain: string
  /** What "corrected" means for this alarm: the steps that clear the cause. */
  readonly correctionBoundary: string
  readonly reassessmentDomain: string
  readonly sourceRecordIds: readonly string[]
}

const seeds: readonly DrillSeed[] = [
  {
    id: 'DRILL-AIR',
    title: 'Air detected in blood',
    engineFaultIds: ['air-detected'],
    openingSignal:
      'The Air Detected in Blood alarm sounds. The air bubble detector on the return line has seen air below the deaeration chamber.',
    predictionPrompt: 'The alarm has just sounded. What do you do first?',
    safeLabel: 'Leave the return clamp closed, look at the patient, then find where the air got in',
    safeWhy:
      'The closed clamp is what stands between the air and the patient, so it stays closed. Then check the patient, and trace the set from the access connection to the chamber for a loose connection, an empty bag or an unprimed line. Remove Air comes after the source is fixed.',
    alternativeLabel:
      'Leave the clamp closed and change the set, because air fills the return line',
    alternativeWhy:
      'When air fills the whole return line, the manual’s instruction is Discard Set and a new set. Do not try to walk that much air back to the chamber.',
    unsafeLabel: 'Use Remove Air and restart before finding where the air got in',
    unsafeWhy:
      'Remove Air clears the air that is there now. With the leak still open, the pump draws in more on the negative side and the alarm returns, with more air in the line each time.',
    criticalErrorCandidate:
      'Opening the return clamp or restarting the blood pump with air still in the return line sends that air to the patient.',
    deviceResponseBoundary:
      'On this alarm PrisMax stops all pumps and closes the return clamp. Nothing moves until you act.',
    inspectionDomain:
      'the catheter connections, the access line and pre-blood-pump line, each bag and its spike, the blood warmer and syringe line, and the deaeration chamber level',
    correctionBoundary:
      'Fix the source: tighten or replace the loose connection, replace the empty bag, reposition a catheter that is drawing air. Then tap Remove Air and follow the screen. If the alarm returns, the manual describes manual air removal with a syringe at the chamber. Air through the whole return line means a new set.',
    reassessmentDomain:
      'the patient’s breathing, saturation and blood pressure, the chamber level, the return line below the detector, and the time off treatment',
    sourceRecordIds: ['DEV-PM-008', 'SYNTH-DRILL-AIR-001'],
  },
  {
    id: 'DRILL-BLOOD-LEAK',
    title: 'Blood leak detected',
    engineFaultIds: ['blood-leak-detected'],
    openingSignal:
      'The Blood Leak Detected alarm sounds. The optical detector on the effluent line is reading less light than its limit.',
    predictionPrompt: 'The alarm has just sounded. What do you do first?',
    safeLabel:
      'Look at the effluent line and bag for pink or red, then check the detector for a bubble or a badly seated line',
    safeWhy:
      'The detector reads light through the effluent line, so a bubble, debris or a line out of its channel trips it as well as blood. Your eyes sort the two in seconds. Clear effluent with a bubble in the detector is a false alarm; pink effluent is a membrane leak until proven otherwise.',
    alternativeLabel:
      'Send an effluent sample for a red-cell count and change the set if it is positive',
    alternativeWhy:
      'This is the manual’s answer when the effluent looks stained or you cannot tell. Blood in the effluent means the membrane has ruptured and the set is finished.',
    unsafeLabel: 'Re-normalize the detector so the alarm clears',
    unsafeWhy: `Normalizing resets the detector’s zero to whatever is in the line now. Done over a real leak, it teaches the detector that blood is normal. The manual puts an effluent sample before normalization for that reason, and refuses to normalize below an ${N('blood-leak-normalization-floor')} signal.`,
    criticalErrorCandidate:
      'Resetting or re-normalizing over a real membrane leak lets the patient keep losing blood into the effluent bag, unmonitored.',
    deviceResponseBoundary:
      'PrisMax treats a blood leak as a high-priority alarm: it holds a safe state and shows the corrective steps until the cause is cleared.',
    inspectionDomain:
      'the color of the effluent line and bag, the line’s seating in the detector, bubbles or debris in the detector’s channel, and a kinked effluent line',
    correctionBoundary:
      'For a bubble: tap Alarm Off to dislodge it, and if bubbles keep coming, look for a kinked effluent line or lower the blood flow. For a displaced or dirty line: reseat it and wipe the channel dry. For blood in the effluent: send the sample, tap Discard Set and change the set. Think of hemolysis or myoglobin if the effluent is tinted and the cell count is negative.',
    reassessmentDomain:
      'hemoglobin if blood was lost, effluent color over the next hour, the new set’s pressures, and the time off treatment',
    sourceRecordIds: ['DEV-PM-008', 'SYNTH-DRILL-BLOOD-LEAK-001'],
  },
  {
    id: 'DRILL-GAIN-LOSS',
    title: 'Unintended fluid gain or loss',
    engineFaultIds: ['fluid-gain-loss'],
    openingSignal:
      'PrisMax reports an unintended patient fluid gain. The scales show that what the pumps moved does not match what was set.',
    predictionPrompt: 'The machine is reporting an unintended gain. What do you do first?',
    safeLabel:
      'Read the unintended gain in mL, then check every bag and line for a clamp, a pulled line or a bag resting on something',
    safeWhy: `The machine weighs the bags to know what it delivered. A clamped line, tension on the tubing or a bag that is partly supported makes the scale read falsely, and those are the usual causes. The error keeps adding up over a rolling ${N('gain-loss-window')} until you find it.`,
    alternativeLabel:
      'Write the unintended mL in the patient’s fluid chart and re-examine their volume status',
    alternativeWhy:
      'The reported gain is fluid the patient really received or kept. It belongs in the fluid chart beside the intake and output the machine never sees, and the patient is the check on whether it mattered.',
    unsafeLabel: 'Raise patient fluid removal to cancel out the reported gain',
    unsafeWhy:
      'That treats a measuring fault as a prescription problem. The scale is still wrong, so the error keeps growing, and you have now added a second change on top of it.',
    criticalErrorCandidate:
      'Leaving the cause in place lets the error reach the gain/loss limit. At the limit the fluid pumps stop for good and the treatment has to be ended.',
    deviceResponseBoundary: `PrisMax adds up the fluid error over the last ${N('gain-loss-window')}. Reaching the gain/loss limit suspends treatment permanently: the fluid pumps will not restart and the set must be changed.`,
    inspectionDomain:
      'each scale and its bag, lines hanging freely without tension, clamps, bags touching the machine or each other, and the effluent bag',
    correctionBoundary:
      'Free the line, open the clamp, or rehang the bag so it hangs clear, and confirm the Flow Problem alarm clears. If the limit has been reached, note the unintended mL for the chart, end the treatment, and start again with a new set.',
    reassessmentDomain:
      'the History screen’s unintended gain or loss, the patient’s whole fluid balance, blood pressure and filling, and the time off treatment',
    sourceRecordIds: ['DEV-PM-012', 'SYNTH-DRILL-GAIN-LOSS-001'],
  },
  {
    id: 'DRILL-BAG-SCALE',
    title: 'Bag empty or scale open',
    engineFaultIds: ['supply-bag-empty', 'effluent-bag-full', 'scale-open'],
    openingSignal:
      'A bag alarm stops the fluid pumps: Bag Empty, Effluent Bag Full or Scale Open, naming one scale.',
    predictionPrompt: 'A bag alarm names one scale. What do you do first?',
    safeLabel:
      'Go to the scale the alarm names and check that bag’s label, how it hangs, and that the scale is closed',
    safeWhy:
      'The alarm names a scale, so start there. A bag that is partly supported reads as empty, and a scale that is not pushed home reads as open. The label matters because each scale feeds one pump: dialysate, replacement or pre-blood-pump.',
    alternativeLabel:
      'Use Change Bag for that scale and hang the same solution, checking its label against the order',
    alternativeWhy:
      'When the bag really is empty or full, this is the fix. Change Bag lets the machine re-weigh the new bag, and reading the label at the moment of the swap is how the wrong solution is caught.',
    unsafeLabel: 'Hang the nearest spare bag on that scale and tap Continue',
    unsafeWhy:
      'It clears the alarm and may put the wrong fluid on the wrong pump. Dialysate, replacement and citrate bags look alike and are not interchangeable.',
    criticalErrorCandidate:
      'A solution on the wrong scale is delivered by the wrong pump at the wrong rate, and the machine cannot tell.',
    deviceResponseBoundary:
      'These are medium-priority alarms. PrisMax stops the fluid pumps and shows the bag-change steps; the solution pumps restart within a few seconds of the alarm clearing.',
    inspectionDomain:
      'the named scale and its handle, the bag’s label and volume, the line from that bag to its pump, and anything the bag is touching',
    correctionBoundary:
      'Close the scale, remove whatever is supporting the bag, or change the bag through Change Bag. Empty or replace a full effluent bag. Confirm the line still runs to the same pump before you continue.',
    reassessmentDomain:
      'that flows have resumed at the set rates, the unintended gain or loss figure, and the time off treatment',
    sourceRecordIds: ['DEV-PM-013', 'SYNTH-DRILL-BAG-SCALE-001'],
  },
  {
    id: 'DRILL-WRONG-SOLUTION',
    title: 'Wrong solution on the machine',
    engineFaultIds: [],
    openingSignal:
      'At a bag change, the second checker reads a label that does not match the order. The bag has been running.',
    predictionPrompt: 'A running bag does not match the order. What do you do first?',
    safeLabel:
      'Stop that fluid, then work out what the bag contains and how long it has been running',
    safeWhy:
      'Stopping the fluid ends the exposure. What to do next depends on two facts: what differs between the bag and the order (potassium, calcium, bicarbonate, citrate) and the volume delivered, which is the rate multiplied by the time.',
    alternativeLabel:
      'Stop that fluid, hang the ordered solution, and send the electrolytes the wrong bag could have moved',
    alternativeWhy:
      'The same first move, followed straight away by the measurement. A potassium-free bag run for hours, or a calcium-containing bag on a citrate circuit, shows up in the patient’s chemistry before it shows up anywhere else.',
    unsafeLabel: 'Let the bag finish, because the packaging and volume match',
    unsafeWhy:
      'CRRT solutions share packaging and differ in potassium, calcium and buffer. At CRRT flow rates, a few more hours is a large dose of the difference.',
    criticalErrorCandidate:
      'Hours of a solution with the wrong potassium or calcium can produce a dangerous level with no alarm, because the machine weighs bags and does not read them.',
    deviceResponseBoundary:
      'No alarm fires for this. PrisMax weighs each bag; it has no way to know what is inside. The independent label check is the only safeguard.',
    inspectionDomain:
      'the order, the bag label, which scale and pump the bag is on, the rate, and the time the bag was hung',
    correctionBoundary:
      'Hang the ordered solution on the right scale with a second checker. Send potassium, ionized calcium, bicarbonate and any other electrolyte that differs. Tell the prescriber what ran, at what rate and for how long, and report it.',
    reassessmentDomain:
      'the repeat electrolytes, the ECG if potassium or calcium moved, and the other bags on the machine',
    sourceRecordIds: ['DEV-PM-013', 'GUID-RRT-ICU-2026'],
  },
]

function freezeDrill(seed: DrillSeed): CrrtRapidDrillDefinition {
  const prefix = seed.id.toLowerCase()
  const {
    safeLabel,
    safeWhy,
    alternativeLabel,
    alternativeWhy,
    unsafeLabel,
    unsafeWhy,
    ...definition
  } = seed
  return Object.freeze({
    ...definition,
    contentVersion: BAXTER_CRRT_CONTENT_VERSION,
    predictionOptions: Object.freeze([
      Object.freeze({
        id: `${prefix}-safe`,
        disposition: 'safe' as const,
        label: safeLabel,
        description: safeWhy,
      }),
      Object.freeze({
        id: `${prefix}-alternative`,
        disposition: 'accepted-alternative' as const,
        label: alternativeLabel,
        description: alternativeWhy,
      }),
      Object.freeze({
        id: `${prefix}-unsafe`,
        disposition: 'unsafe' as const,
        label: unsafeLabel,
        description: unsafeWhy,
      }),
    ]),
    candidateCauseOptionId: `${prefix}-safe`,
    acceptedAlternativeOptionId: `${prefix}-alternative`,
    unsafeOptionId: `${prefix}-unsafe`,
    sourceRecordIds: Object.freeze([...seed.sourceRecordIds]),
    engineFaultIds: Object.freeze([...seed.engineFaultIds]),
    reviewStatus: 'pending' as const,
    learnerRunnable: true as const,
    runnable: true as const,
    scoringAvailable: true as const,
    analyticsAvailable: true as const,
    progressPersistenceAvailable: true as const,
    competencyAvailable: false as const,
  })
}

export const baxterCrrtRapidDrills: readonly CrrtRapidDrillDefinition[] = Object.freeze(
  seeds.map(freezeDrill),
)

export const baxterCrrtRapidDrillManifest = baxterCrrtRapidDrills

if (baxterCrrtRapidDrills.map((drill) => drill.id).join('|') !== CRRT_RAPID_DRILL_IDS.join('|')) {
  throw new Error('CRRT rapid-drill registry must contain every stable drill exactly once.')
}

export function getBaxterCrrtRapidDrill(drillId: CrrtRapidDrillId): CrrtRapidDrillDefinition {
  const drill = baxterCrrtRapidDrills.find((candidate) => candidate.id === drillId)
  if (!drill) throw new Error(`Unknown CRRT rapid drill: ${drillId}`)
  return drill
}

export function isBaxterCrrtRapidDrillId(value: string): value is CrrtRapidDrillId {
  return (CRRT_RAPID_DRILL_IDS as readonly string[]).includes(value)
}
