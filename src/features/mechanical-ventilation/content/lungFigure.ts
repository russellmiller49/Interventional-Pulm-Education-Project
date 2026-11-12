/**
 * The lungs at one instant of a breath, as a drawing.
 *
 * The console draws a breath as three or four traces. A learner new to them has to hold the picture
 * in their head: which way gas is moving, how full the lung is, whether the patient is pulling. The
 * figure draws that picture for the one instant the console's cursor is on (or, while the clock
 * runs, for the newest sample).
 *
 * It is given only what the console's own cursor read-out states for that instant: flow, the
 * volume the trace draws, and the model effort where the step shows the effort trace. The two
 * patient properties are drawn only on a step that hands the learner their sliders. So it never
 * shows anything the screen beside it has not already said, and cannot answer a question the
 * traces do not.
 */
import type { TeachingMechanicsOverride } from '../engine/types'

/** One instant, as the cursor read-out reports it. */
export interface BreathCursorReading {
  readonly flowLMin: number
  /** The volume the trace draws: above the breath's first inspiratory sample when `anchored`. */
  readonly volumeMl: number
  readonly anchored: boolean
  readonly pmusCmH2O: number
  readonly phase: 'inspiration' | 'expiration'
}

export interface LungFigureModel {
  /** 0 to 1: how far the lungs are drawn inflated. A fixed scale, so 600 mL is drawn larger than 420. */
  readonly inflation: number
  readonly flow: 'in' | 'out' | 'none'
  /** 0 to 1 while the patient pulls; null on a step that does not show the effort trace. */
  readonly effort: number | null
  /** The airway's drawn width against normal (1); null unless the learner sets it on this step. */
  readonly airway: number | null
  /** How stiff the lungs are drawn, 0 (as this patient's) to 1; null unless the learner sets it. */
  readonly stiffness: number | null
  /** What the drawing says, in words, one fact a line. */
  readonly lines: readonly string[]
}

/** The volume at which the drawing is fully inflated. A drawing scale, not a clinical limit. */
export const LUNG_FIGURE_FULL_SCALE_ML = 1000
/** The effort at which the diaphragm is drawn fully descended. A drawing scale. */
export const LUNG_FIGURE_FULL_EFFORT_CMH2O = 15

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function lungFigureModel(
  reading: BreathCursorReading,
  options: {
    readonly effortShown: boolean
    /** The teaching patient's multipliers, on a step whose sliders set them. */
    readonly mechanics?: TeachingMechanicsOverride | null
    /** Which of the two the step's sliders offer. */
    readonly mechanicsKeys?: readonly (keyof TeachingMechanicsOverride)[]
  },
): LungFigureModel {
  // The read-out prints flow to one decimal; a flow it prints as 0.0 is drawn as no flow.
  const shownFlow = Number(reading.flowLMin.toFixed(1))
  const flow = shownFlow > 0 ? 'in' : shownFlow < 0 ? 'out' : 'none'
  const effortCmH2O = Math.max(0, -reading.pmusCmH2O)
  const keys = options.mechanics ? (options.mechanicsKeys ?? []) : []
  const resistanceScale = keys.includes('resistanceScale')
    ? options.mechanics!.resistanceScale
    : null
  const complianceScale = keys.includes('complianceScale')
    ? options.mechanics!.complianceScale
    : null

  const lines: string[] = [
    flow === 'in' ? 'Gas flowing in' : flow === 'out' ? 'Gas flowing out' : 'No gas flowing',
    // The trace's own row label: "Volume from first inspiratory sample", or the raw volume.
    `${reading.volumeMl.toFixed(0)} mL · ${
      reading.anchored ? 'from first inspiratory sample' : 'above the trace baseline'
    }`,
  ]
  if (options.effortShown)
    lines.push(
      effortCmH2O.toFixed(1) === '0.0'
        ? `No patient effort · machine ${reading.phase}`
        : `Patient effort ${effortCmH2O.toFixed(1)} cmH₂O · machine ${reading.phase}`,
    )
  // The sliders' own words, so the drawing and the control beside it name one thing one way.
  if (resistanceScale !== null) lines.push(`Patient resistance ${resistanceScale.toFixed(2)}×`)
  if (complianceScale !== null) lines.push(`Patient compliance ${complianceScale.toFixed(2)}×`)

  return {
    inflation: clamp01(reading.volumeMl / LUNG_FIGURE_FULL_SCALE_ML),
    flow,
    effort: options.effortShown ? clamp01(effortCmH2O / LUNG_FIGURE_FULL_EFFORT_CMH2O) : null,
    // Resistance in a tube goes with the fourth power of its radius; the drawing follows that.
    airway: resistanceScale === null ? null : Math.min(1.25, Math.pow(1 / resistanceScale, 0.25)),
    stiffness: complianceScale === null ? null : clamp01(1 - complianceScale),
    lines,
  }
}
