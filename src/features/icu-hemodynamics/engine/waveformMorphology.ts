/**
 * Shared cardiac-cycle waveform morphology.
 *
 * Every trace in this module — the live bedside monitor, the teaching atlas, and the
 * artifact comparisons — is generated from these functions so an annotation that says
 * "the v wave peaks here" points at the same place the simulator actually draws it.
 *
 * Phase is expressed as a fraction of the R-R interval, with phase 0 at the start of
 * the cycle and the QRS complex just after it. Landmark timings follow Ragosta &
 * Kennedy, Textbook of Clinical Hemodynamics (3rd ed.), ch. 2 "Normal Waveforms,
 * Artifacts, and Pitfalls".
 */

/** Fraction of the R-R interval at which each electrical and mechanical landmark occurs. */
export const CARDIAC_PHASE = {
  /** Atrial depolarization. PR interval is ~0.20 of the cycle at a normal rate. */
  pWave: 0.84,
  qWave: 0.02,
  rWave: 0.045,
  sWave: 0.075,
  tWavePeak: 0.3,
  tWaveEnd: 0.42,

  /**
   * Right atrium. The a wave follows the P wave on the ECG by about 80 ms; the c wave
   * follows the a wave as the tricuspid annulus moves toward the atrium at the onset of
   * ventricular systole; the v wave peaks at the end of ventricular systole, coinciding
   * with the end of the T wave.
   */
  atrialAWave: 0.94,
  atrialCWave: 0.1,
  atrialXDescent: 0.26,
  atrialVWave: 0.44,
  atrialYDescent: 0.6,

  /**
   * Pulmonary capillary wedge. The pressure wave is transmitted backward through the
   * pulmonary capillary bed, so the a wave follows the P wave by about 240 ms rather
   * than 80 ms, and the v wave peaks after the T wave has already been inscribed.
   * The c wave is lost to damping and is not seen on a wedge tracing.
   */
  wedgeAWave: 0.14,
  wedgeXDescent: 0.34,
  wedgeVWave: 0.64,
  wedgeYDescent: 0.82,

  /** Aortic valve closure. The pulmonic valve closes slightly later, after the T wave. */
  aorticDicroticNotch: 0.4,
  pulmonicDicroticNotch: 0.45,

  /** Systemic arterial pressure peaks early; pulmonary artery pressure peaks near the T wave. */
  arterialPeak: 0.12,
  pulmonaryArteryPeak: 0.18,
} as const

/** Millimetres of mercury per centimetre of water column (hydrostatic conversion). */
export const MMHG_PER_CM_H2O = 0.7355

function wrapPhase(phase: number): number {
  return ((phase % 1) + 1) % 1
}

/** Gaussian bump that wraps across the cycle boundary, so a wave near phase 0.95 is continuous. */
export function cyclicGaussian(phase: number, center: number, width: number): number {
  const raw = Math.abs(wrapPhase(phase) - wrapPhase(center))
  const distance = Math.min(raw, 1 - raw)
  const normalized = distance / width
  return Math.exp(-0.5 * normalized * normalized)
}

export interface AtrialWaveAmplitudes {
  /** Height of the a wave above mean pressure (atrial contraction). */
  readonly aWaveMmHg: number
  /** Height of the c wave above mean pressure. Zero on a wedge tracing. */
  readonly cWaveMmHg: number
  /** Depth of the x descent below mean pressure (atrial relaxation + annular descent). */
  readonly xDescentMmHg: number
  /** Height of the v wave above mean pressure (passive atrial filling). */
  readonly vWaveMmHg: number
  /** Depth of the y descent below mean pressure (rapid emptying after AV valve opening). */
  readonly yDescentMmHg: number
}

/**
 * Normal right atrial amplitudes. In a normal right atrium the a wave exceeds the v wave.
 */
export const NORMAL_RIGHT_ATRIAL_AMPLITUDES: AtrialWaveAmplitudes = {
  aWaveMmHg: 2.8,
  cWaveMmHg: 1.2,
  xDescentMmHg: 1.9,
  vWaveMmHg: 2,
  yDescentMmHg: 2.1,
}

/**
 * Normal wedge amplitudes. On a wedge tracing the v wave typically exceeds the a wave —
 * the reverse of the normal right atrial relationship — and there is no c wave.
 */
export const NORMAL_WEDGE_AMPLITUDES: AtrialWaveAmplitudes = {
  aWaveMmHg: 1.9,
  cWaveMmHg: 0,
  xDescentMmHg: 1.4,
  vWaveMmHg: 2.7,
  yDescentMmHg: 1.6,
}

/**
 * A wrapped Gaussian is effectively a full Gaussian over one cardiac cycle at the widths used
 * here. Subtracting the integrated area of all component waves keeps the phasic tracing centered
 * on the displayed mean pressure instead of silently shifting it upward.
 */
const CYCLIC_GAUSSIAN_AREA_FACTOR = Math.sqrt(2 * Math.PI)

function atrialComponentMeanMmHg(
  amplitudes: AtrialWaveAmplitudes,
  widths: {
    readonly a: number
    readonly c: number
    readonly x: number
    readonly v: number
    readonly y: number
  },
): number {
  return (
    CYCLIC_GAUSSIAN_AREA_FACTOR *
    (amplitudes.aWaveMmHg * widths.a +
      amplitudes.cWaveMmHg * widths.c -
      amplitudes.xDescentMmHg * widths.x +
      amplitudes.vWaveMmHg * widths.v -
      amplitudes.yDescentMmHg * widths.y)
  )
}

/**
 * Right atrial / CVP deviation from mean pressure, in mmHg, at a given cardiac phase.
 * Produces the a-c-v waves and x-y descents in their correct positions relative to the ECG.
 */
export function rightAtrialDeviationMmHg(
  phase: number,
  amplitudes: AtrialWaveAmplitudes = NORMAL_RIGHT_ATRIAL_AMPLITUDES,
): number {
  const deviation =
    amplitudes.aWaveMmHg * cyclicGaussian(phase, CARDIAC_PHASE.atrialAWave, 0.05) +
    amplitudes.cWaveMmHg * cyclicGaussian(phase, CARDIAC_PHASE.atrialCWave, 0.028) -
    amplitudes.xDescentMmHg * cyclicGaussian(phase, CARDIAC_PHASE.atrialXDescent, 0.062) +
    amplitudes.vWaveMmHg * cyclicGaussian(phase, CARDIAC_PHASE.atrialVWave, 0.058) -
    amplitudes.yDescentMmHg * cyclicGaussian(phase, CARDIAC_PHASE.atrialYDescent, 0.05)
  return (
    deviation -
    atrialComponentMeanMmHg(amplitudes, {
      a: 0.05,
      c: 0.028,
      x: 0.062,
      v: 0.058,
      y: 0.05,
    })
  )
}

/**
 * Wedge deviation from mean pressure, in mmHg. Same wave family as the atrial tracing but
 * time-shifted by transmission through the pulmonary bed and damped, so no c wave appears.
 */
export function wedgeDeviationMmHg(
  phase: number,
  amplitudes: AtrialWaveAmplitudes = NORMAL_WEDGE_AMPLITUDES,
): number {
  const deviation =
    amplitudes.aWaveMmHg * cyclicGaussian(phase, CARDIAC_PHASE.wedgeAWave, 0.062) -
    amplitudes.xDescentMmHg * cyclicGaussian(phase, CARDIAC_PHASE.wedgeXDescent, 0.07) +
    amplitudes.vWaveMmHg * cyclicGaussian(phase, CARDIAC_PHASE.wedgeVWave, 0.075) -
    amplitudes.yDescentMmHg * cyclicGaussian(phase, CARDIAC_PHASE.wedgeYDescent, 0.058)
  return (
    deviation -
    atrialComponentMeanMmHg(amplitudes, {
      a: 0.062,
      c: 0,
      x: 0.07,
      v: 0.075,
      y: 0.058,
    })
  )
}

export interface PulsatileShapeOptions {
  /** Phase of the dicrotic notch (semilunar valve closure). */
  readonly notchPhase: number
  /** Phase at which peak systolic pressure occurs. */
  readonly peakPhase: number
  /** Depth of the incisura, as a fraction of pulse pressure. */
  readonly notchDepth: number
  /** Height of the dicrotic wave that follows the incisura, as a fraction of pulse pressure. */
  readonly dicroticWaveHeight: number
  /** Fraction of pulse pressure lost between the systolic peak and valve closure. */
  readonly systolicDecline: number
  /** Exponential rate of diastolic runoff. */
  readonly runoffRate: number
}

export const SYSTEMIC_ARTERIAL_SHAPE: PulsatileShapeOptions = {
  notchPhase: CARDIAC_PHASE.aorticDicroticNotch,
  peakPhase: CARDIAC_PHASE.arterialPeak,
  notchDepth: 0.12,
  dicroticWaveHeight: 0.055,
  systolicDecline: 0.68,
  runoffRate: 5,
}

/**
 * The pulmonary artery tracing has the same anatomy as the systemic arterial tracing but a
 * later, more rounded systolic peak, a later notch (the pulmonic valve closes after the
 * aortic valve), and a slower runoff into the low-impedance pulmonary bed.
 */
export const PULMONARY_ARTERY_SHAPE: PulsatileShapeOptions = {
  notchPhase: CARDIAC_PHASE.pulmonicDicroticNotch,
  peakPhase: CARDIAC_PHASE.pulmonaryArteryPeak,
  notchDepth: 0.11,
  dicroticWaveHeight: 0.05,
  systolicDecline: 0.72,
  runoffRate: 5,
}

/**
 * Normalized pulsatile pressure shape in [0, 1], where 0 is end-diastolic pressure and 1 is
 * peak systolic pressure. Includes the rapid upstroke, systolic decline, dicrotic notch from
 * semilunar valve closure, the dicrotic wave that follows it, and exponential diastolic runoff.
 */
export function pulsatilePressureShape(phase: number, options: PulsatileShapeOptions): number {
  const cyclePhase = wrapPhase(phase)
  const { notchPhase, peakPhase, notchDepth, dicroticWaveHeight, systolicDecline, runoffRate } =
    options

  if (cyclePhase < peakPhase) {
    // Rapid systolic upstroke from end-diastolic pressure to the systolic peak.
    return Math.sin((cyclePhase / peakPhase) * (Math.PI / 2)) ** 0.85
  }

  const closurePressure = 1 - systolicDecline

  if (cyclePhase < notchPhase) {
    // Pressure decay following peak ejection, down to semilunar valve closure.
    const progress = (cyclePhase - peakPhase) / (notchPhase - peakPhase)
    return 1 - systolicDecline * progress ** 1.15
  }

  // Diastolic runoff, normalized so that pressure returns to 0 at the end of the cycle.
  const elapsed = cyclePhase - notchPhase
  const remaining = 1 - notchPhase
  const decay = Math.exp(-runoffRate * elapsed)
  const endDecay = Math.exp(-runoffRate * remaining)
  const runoff = (closurePressure * (decay - endDecay)) / (1 - endDecay)

  const incisura = notchDepth * cyclicGaussian(cyclePhase, notchPhase + 0.014, 0.014)
  const dicroticWave = dicroticWaveHeight * cyclicGaussian(cyclePhase, notchPhase + 0.055, 0.03)

  return Math.max(0, runoff - incisura + dicroticWave)
}

function meanPulsatileShape(options: PulsatileShapeOptions): number {
  const samples = 4096
  let total = 0
  for (let index = 0; index < samples; index += 1) {
    total += pulsatilePressureShape((index + 0.5) / samples, options)
  }
  return total / samples
}

/**
 * Fraction of pulse pressure above diastolic pressure represented by the temporal mean.
 * These constants let the numerical MAP/mPAP and the area under the rendered trace agree.
 */
export const SYSTEMIC_ARTERIAL_MEAN_FRACTION = meanPulsatileShape(SYSTEMIC_ARTERIAL_SHAPE)
export const PULMONARY_ARTERY_MEAN_FRACTION = meanPulsatileShape(PULMONARY_ARTERY_SHAPE)

export interface VentricularShapeOptions {
  /** Height of the end-diastolic a wave, as a fraction of the systolic excursion. */
  readonly aWaveFraction: number
  /** End-diastolic pressure, as a fraction of the systolic excursion above the early-diastolic nadir. */
  readonly endDiastolicFraction: number
}

export const NORMAL_RIGHT_VENTRICULAR_SHAPE: VentricularShapeOptions = {
  aWaveFraction: 0,
  endDiastolicFraction: 0.16,
}

/**
 * Normalized right ventricular pressure in [0, ~1], where 0 is the early-diastolic nadir and
 * 1 is peak systolic pressure.
 *
 * Reproduces the features that identify a ventricular tracing: a rapid pressure rise during
 * contraction, a rapid decay during relaxation, and a diastolic phase that starts low and
 * gradually increases. An end-diastolic a wave is not normal and appears only when
 * `aWaveFraction` is raised — it indicates reduced ventricular compliance.
 */
export function ventricularPressureShape(
  phase: number,
  options: VentricularShapeOptions = NORMAL_RIGHT_VENTRICULAR_SHAPE,
): number {
  const cyclePhase = wrapPhase(phase)
  const contractionStart = 0.045
  const peak = 0.16
  const ejectionEnd = 0.39
  const relaxationEnd = 0.5
  const { aWaveFraction, endDiastolicFraction } = options

  const aWave = aWaveFraction * cyclicGaussian(cyclePhase, CARDIAC_PHASE.atrialAWave, 0.045)

  if (cyclePhase >= contractionStart && cyclePhase < peak) {
    // Isovolumic contraction and rapid ejection.
    const progress = (cyclePhase - contractionStart) / (peak - contractionStart)
    return endDiastolicFraction + (1 - endDiastolicFraction) * Math.sin(progress * (Math.PI / 2))
  }

  if (cyclePhase >= peak && cyclePhase < ejectionEnd) {
    // Reduced ejection: a rounded dome that falls continuously rather than a square plateau.
    const progress = (cyclePhase - peak) / (ejectionEnd - peak)
    const roundedDecline = (1 - Math.cos(progress * Math.PI)) / 2
    return 1 - 0.48 * roundedDecline
  }

  if (cyclePhase >= ejectionEnd && cyclePhase < relaxationEnd) {
    // Rapid isovolumic relaxation down to the early-diastolic nadir.
    const progress = (cyclePhase - ejectionEnd) / (relaxationEnd - ejectionEnd)
    return 0.52 * (1 - Math.sin(progress * (Math.PI / 2)) ** 0.72)
  }

  // Diastole: an initially low pressure that gradually increases toward end-diastole.
  const diastoleStart = relaxationEnd
  const diastoleLength = 1 - diastoleStart + contractionStart
  const elapsed = wrapPhase(cyclePhase - diastoleStart)
  const progress = Math.min(1, elapsed / diastoleLength)
  return endDiastolicFraction * (1 - Math.exp(-3.4 * progress)) + aWave
}

/**
 * Normalized lead-II ECG in millivolts: P wave, QRS complex with Q and S deflections, and T wave.
 */
export function ecgShapeMv(phase: number): number {
  const cyclePhase = wrapPhase(phase)
  return (
    0.16 * cyclicGaussian(cyclePhase, CARDIAC_PHASE.pWave, 0.022) -
    0.11 * cyclicGaussian(cyclePhase, CARDIAC_PHASE.qWave, 0.006) +
    1.15 * cyclicGaussian(cyclePhase, CARDIAC_PHASE.rWave, 0.0085) -
    0.22 * cyclicGaussian(cyclePhase, CARDIAC_PHASE.sWave, 0.008) +
    0.3 * cyclicGaussian(cyclePhase, CARDIAC_PHASE.tWavePeak, 0.045)
  )
}

export interface AtrialAmplitudeDrivers {
  /** Ventricular compliance; below 1 stiffens the ventricle and enlarges the a wave. */
  readonly ventricularCompliance: number
  /** Pericardial pressure in mmHg. Tamponade physiology blunts the y descent. */
  readonly pericardialPressureMmHg: number
  /** Tricuspid regurgitation severity in [0, 1]. Obliterates the x descent and fuses c and v. */
  readonly tricuspidRegurgitationSeverity?: number
}

/**
 * Derives right atrial wave amplitudes from the modeled circulation.
 *
 * A stiff right ventricle produces a prominent a wave. Pericardial constraint preserves the
 * x descent but blunts the y descent, because rapid early filling is what the pericardium
 * prevents. Tricuspid regurgitation replaces the x descent with a broad systolic cv wave —
 * the ventricularized right atrial tracing.
 */
export function rightAtrialAmplitudesFor(drivers: AtrialAmplitudeDrivers): AtrialWaveAmplitudes {
  const stiffness = Math.max(0, 1 / Math.max(0.25, drivers.ventricularCompliance) - 1)
  const constraint = Math.min(1, Math.max(0, drivers.pericardialPressureMmHg) / 18)
  const regurgitation = Math.min(1, Math.max(0, drivers.tricuspidRegurgitationSeverity ?? 0))
  const base = NORMAL_RIGHT_ATRIAL_AMPLITUDES

  return {
    aWaveMmHg: base.aWaveMmHg * (1 + stiffness * 0.85) * (1 - regurgitation * 0.4),
    cWaveMmHg: base.cWaveMmHg * (1 + regurgitation * 1.6),
    xDescentMmHg: base.xDescentMmHg * (1 + constraint * 0.45) * (1 - regurgitation * 0.95),
    vWaveMmHg: base.vWaveMmHg * (1 + stiffness * 0.5) * (1 + regurgitation * 2.4),
    yDescentMmHg: base.yDescentMmHg * (1 - constraint * 0.85) * (1 + regurgitation * 0.5),
  }
}

export interface WedgeAmplitudeDrivers {
  /** Left ventricular compliance; below 1 enlarges both a and v waves. */
  readonly leftVentricularCompliance: number
  /** Pericardial pressure in mmHg. */
  readonly pericardialPressureMmHg: number
}

/**
 * Derives wedge wave amplitudes. A stiff left ventricle or a poorly compliant left atrium
 * produces a large v wave — the pattern that, when severe, is transmitted from mitral
 * regurgitation and can be mistaken for a pulmonary artery tracing.
 */
export function wedgeAmplitudesFor(drivers: WedgeAmplitudeDrivers): AtrialWaveAmplitudes {
  const stiffness = Math.max(0, 1 / Math.max(0.25, drivers.leftVentricularCompliance) - 1)
  const constraint = Math.min(1, Math.max(0, drivers.pericardialPressureMmHg) / 18)
  const base = NORMAL_WEDGE_AMPLITUDES

  return {
    aWaveMmHg: base.aWaveMmHg * (1 + stiffness * 0.7),
    cWaveMmHg: 0,
    xDescentMmHg: base.xDescentMmHg * (1 + constraint * 0.4),
    vWaveMmHg: base.vWaveMmHg * (1 + stiffness * 1.5),
    yDescentMmHg: base.yDescentMmHg * (1 - constraint * 0.8),
  }
}
