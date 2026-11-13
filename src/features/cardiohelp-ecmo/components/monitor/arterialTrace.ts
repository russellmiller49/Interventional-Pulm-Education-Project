// The arterial pressure trace on the bedside monitor, as arithmetic. No react: jest loads this
// file directly and holds the drawing to the patient model's own numbers.

/** What the patient model supplies. Nothing else goes into the drawing. */
export interface ArterialTraceInput {
  readonly meanArterialPressure: number
  readonly pulsePressure: number
  readonly heartRate: number
  /** The monitor's own "Aortic-valve opening" row. */
  readonly aorticValveOpening: boolean
}

/** Seconds of trace on the strip. */
export const ARTERIAL_TRACE_SECONDS = 4
/** The strip's pressure axis, mmHg. Fixed, so the same pulse is the same height in every state. */
export const ARTERIAL_TRACE_AXIS = { min: 20, max: 120 } as const
export const ARTERIAL_TRACE_GRID = [40, 80, 120] as const
/** The drawing's own coordinate space (an SVG viewBox). */
export const ARTERIAL_TRACE_VIEW = { width: 480, height: 110, padTop: 6, padBottom: 6 } as const

const SAMPLES_PER_BEAT = 60

const ease = (t: number) => t * t * (3 - 2 * t)
const between = (from: number, to: number, t: number) => from + (to - from) * ease(t)

/**
 * One beat as drawn while the model reports the aortic valve opening: upstroke, peak, a notch,
 * run-off. A drawing choice, the same in every such state; it is not derived from the patient.
 * Returns a height in 0..1 before normalising; `phase` is 0..1 through the beat.
 */
function ejectingBeat(phase: number): number {
  if (phase < 0.12) return between(0, 1, phase / 0.12)
  if (phase < 0.36) return between(1, 0.52, (phase - 0.12) / 0.24)
  if (phase < 0.4) return between(0.52, 0.46, (phase - 0.36) / 0.04)
  if (phase < 0.47) return between(0.46, 0.55, (phase - 0.4) / 0.07)
  return between(0.55, 0, (phase - 0.47) / 0.53)
}

/**
 * One beat as drawn while the model reports the valve not opening: a slow rise and fall with no
 * notch. Also a drawing choice. The model can still report a small pulse pressure in this state
 * (5 mmHg in LV loading); the strip draws that ripple and the note beside it says what it is not.
 */
function nonEjectingBeat(phase: number): number {
  if (phase < 0.3) return between(0, 1, phase / 0.3)
  return between(1, 0, (phase - 0.3) / 0.7)
}

interface BeatShape {
  /** Height through one beat, scaled so trough is 0 and peak is 1. */
  readonly samples: readonly number[]
  /** The time-mean of `samples`. */
  readonly mean: number
}

/**
 * Where the mean of a beat sits between its trough and its peak: one third of the way up.
 *
 * This is the bedside convention for an arterial trace (mean ≈ diastolic + pulse pressure ÷ 3),
 * used here only to shape the drawing, so that a reader who takes a systolic and a diastolic value
 * off the strip gets the pair that convention gives for the monitor's mean and pulse pressure.
 */
export const ARTERIAL_TRACE_MEAN_FRACTION = 1 / 3

const meanOf = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

function beatShape(sample: (phase: number) => number): BeatShape {
  const raw = Array.from({ length: SAMPLES_PER_BEAT }, (_, index) =>
    sample(index / SAMPLES_PER_BEAT),
  )
  const low = Math.min(...raw)
  const span = Math.max(...raw) - low
  const unit = raw.map((value) => (value - low) / span)
  // Raise the 0..1 shape to the power that puts its mean at the convention's third. A power keeps
  // the trough at 0, the peak at 1 and every rise, fall and notch where it was.
  let lowPower = 0.2
  let highPower = 8
  for (let step = 0; step < 60; step += 1) {
    const power = (lowPower + highPower) / 2
    if (meanOf(unit.map((value) => value ** power)) > ARTERIAL_TRACE_MEAN_FRACTION) lowPower = power
    else highPower = power
  }
  const samples = unit.map((value) => value ** ((lowPower + highPower) / 2))
  return { samples, mean: meanOf(samples) }
}

const EJECTING = beatShape(ejectingBeat)
const NON_EJECTING = beatShape(nonEjectingBeat)

export interface ArterialTracePoint {
  /** Seconds from the left edge of the strip. */
  readonly seconds: number
  readonly pressure: number
}

/**
 * The pressure at each moment of the strip.
 *
 * One beat shape, repeated at the monitor's heart rate, placed and scaled by exactly two numbers:
 * its time-mean is the monitor's mean arterial pressure and its peak-to-trough height is the
 * monitor's pulse pressure. The systolic and diastolic values a reader takes off the trace follow
 * from those two and from the shape, whose mean sits a third of the way up
 * (`ARTERIAL_TRACE_MEAN_FRACTION`); no other pressure is supplied.
 */
export function arterialTracePoints(input: ArterialTraceInput): ArterialTracePoint[] {
  const shape = input.aorticValveOpening ? EJECTING : NON_EJECTING
  const pulse = Math.max(0, input.pulsePressure)
  const beatSeconds = input.heartRate > 0 ? 60 / input.heartRate : Infinity
  const points: ArterialTracePoint[] = []
  const step = Number.isFinite(beatSeconds)
    ? beatSeconds / SAMPLES_PER_BEAT
    : ARTERIAL_TRACE_SECONDS
  for (let index = 0; ; index += 1) {
    const seconds = Math.min(index * step, ARTERIAL_TRACE_SECONDS)
    const height = Number.isFinite(beatSeconds)
      ? shape.samples[index % SAMPLES_PER_BEAT]
      : shape.mean
    points.push({
      seconds,
      pressure: input.meanArterialPressure + pulse * (height - shape.mean),
    })
    if (seconds >= ARTERIAL_TRACE_SECONDS) return points
  }
}

/** A pressure as a y coordinate in the drawing; pressures off the axis are held at its edge. */
export function arterialTraceY(pressure: number): number {
  const { min, max } = ARTERIAL_TRACE_AXIS
  const { height, padTop, padBottom } = ARTERIAL_TRACE_VIEW
  const clamped = Math.min(max, Math.max(min, pressure))
  return padTop + ((max - clamped) / (max - min)) * (height - padTop - padBottom)
}

export function arterialTraceX(seconds: number): number {
  return (seconds / ARTERIAL_TRACE_SECONDS) * ARTERIAL_TRACE_VIEW.width
}

/** The trace as an SVG path. */
export function arterialTracePath(input: ArterialTraceInput): string {
  return arterialTracePoints(input)
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${arterialTraceX(point.seconds).toFixed(1)},${arterialTraceY(point.pressure).toFixed(1)}`,
    )
    .join(' ')
}

/**
 * Below this pulse pressure the monitor already marks the reading "low simulated pulsatility"
 * (`PatientMonitor`). The trace's description uses the same line, not one of its own.
 */
export const LOW_PULSATILITY_BELOW_MMHG = 10

/*
 * What the strip is, said on the strip (clinical review, 2026-11-13).
 *
 * The trace is synthesized from four numbers of the patient model: mean arterial pressure, pulse
 * pressure, heart rate and the aortic-valve-opening state. Its level, height and beat spacing are
 * those numbers. Its upstroke, the position and depth of its notch and its run-off are one drawn
 * shape, the same in every state, and carry no information about this patient. A learner who read
 * the exact morphology as a measured signal would be reading the drawing.
 *
 * Two things follow, and both are on screen:
 * - the strip is named schematic and simulated, and its upstroke and notch illustrative;
 * - a nearly flat strip is a low pulse pressure and nothing more. The model's 5 mmHg with the
 *   valve not opening is a ripple, not ejection; and a low pulse pressure on VA support is not by
 *   itself proof that the heart is ejecting nothing. The row that says whether the valve opens is
 *   the monitor's own "Aortic-valve opening" row, so the note sends the reader to it.
 */
export const ARTERIAL_TRACE_LABEL = 'Arterial line · schematic'
export const ARTERIAL_TRACE_SCHEMATIC_NOTE =
  'Schematic simulated trace: its level and height follow MAP and pulse pressure; the upstroke and notch are illustrative, not measured.'
export const ARTERIAL_TRACE_FLAT_NOTE =
  'A nearly flat trace is a low pulse pressure. It does not by itself show whether the ventricle is ejecting: read the aortic-valve opening row.'

/** The trace in words, for a reader who cannot see it. */
export function arterialTraceDescription(input: ArterialTraceInput): string {
  const shape =
    input.pulsePressure < LOW_PULSATILITY_BELOW_MMHG
      ? 'The trace is nearly flat: low pulsatility.'
      : 'The trace is pulsatile.'
  // The notch is part of the drawn shape, not a finding: it is described as drawn, with no cause.
  const notch = input.aorticValveOpening
    ? 'Each beat is drawn with a notch.'
    : 'Each beat is drawn without a notch.'
  return `Schematic simulated arterial pressure trace over ${ARTERIAL_TRACE_SECONDS} seconds. Mean arterial pressure ${input.meanArterialPressure} mmHg, pulse pressure ${input.pulsePressure} mmHg, heart rate ${input.heartRate} per minute. ${shape} ${notch} The upstroke and notch are illustrative, not measured.`
}
