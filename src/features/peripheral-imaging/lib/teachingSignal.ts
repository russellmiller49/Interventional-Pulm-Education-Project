/**
 * Simulated appearance effects for Section 6's CT-derived comparison (owner decision OD4-06,
 * 2026-09-22: simulated CT-derived examples now, clearly labelled).
 *
 * Neither function is a device, exposure or scatter model, and the figure says so. They exist so
 * that the three look-alike causes of poor conspicuity can be compared on the course's own anatomy
 * instead of on square-block cartoons:
 *
 * - `simulateQuantumNoise` follows the section's own idea that signal-to-noise scales with the
 *   square root of the detected photon count. Each pixel's detected count is drawn from the count
 *   its attenuation allows (a Gaussian approximation to Poisson counting), so the mottle is finest
 *   and heaviest where fewer photons get through. The photon numbers are illustrative only.
 * - `addUniformVeil` is a drawing-level effect: a uniform added signal, which lowers contrast
 *   evenly across dense and soft structures while leaving edges where they are. The course has no
 *   scatter model; this does not calculate scatter.
 *
 * Both are deterministic (a fixed seed), so the same figure draws the same pixels every time.
 */

/** Attenuation (natural-log units) per unit of the projection's line integral. Illustrative. */
export const TEACHING_ATTENUATION_PER_UNIT = 12

/** A small, fast, seedable generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal draws from a uniform generator (Box–Muller). */
export function normalDraws(random: () => number): () => number {
  let spare: number | null = null
  return () => {
    if (spare !== null) {
      const value = spare
      spare = null
      return value
    }
    let u = 0
    while (u === 0) u = random()
    const v = random()
    const radius = Math.sqrt(-2 * Math.log(u))
    spare = radius * Math.sin(2 * Math.PI * v)
    return radius * Math.cos(2 * Math.PI * v)
  }
}

/**
 * The same projection re-read from a finite number of detected photons per pixel.
 * `photonsPerPixel` is the unattenuated count; fewer photons, heavier mottle.
 */
export function simulateQuantumNoise(
  lineIntegral: Float32Array,
  options: { readonly photonsPerPixel: number; readonly seed: number },
): Float32Array {
  const normal = normalDraws(seededRandom(options.seed))
  const k = TEACHING_ATTENUATION_PER_UNIT
  const n0 = options.photonsPerPixel
  const result = new Float32Array(lineIntegral.length)
  for (let i = 0; i < lineIntegral.length; i++) {
    const expected = n0 * Math.exp(-k * lineIntegral[i])
    const detected = Math.max(1, expected + Math.sqrt(expected) * normal())
    result[i] = -Math.log(detected / n0) / k
  }
  return result
}

/**
 * A uniform added signal over the exposed field, as a fraction of the field's mean primary signal.
 * Pixels outside `exposed` are left as they are (they are drawn unexposed anyway).
 */
export function addUniformVeil(
  lineIntegral: Float32Array,
  options: { readonly fractionOfMean: number; readonly exposed?: Uint8Array },
): Float32Array {
  const k = TEACHING_ATTENUATION_PER_UNIT
  let sum = 0
  let count = 0
  for (let i = 0; i < lineIntegral.length; i++) {
    if (options.exposed && options.exposed[i] !== 1) continue
    sum += Math.exp(-k * lineIntegral[i])
    count++
  }
  const veil = count > 0 ? (sum / count) * options.fractionOfMean : 0
  const result = new Float32Array(lineIntegral.length)
  for (let i = 0; i < lineIntegral.length; i++) {
    const inside = !options.exposed || options.exposed[i] === 1
    result[i] = inside ? -Math.log(Math.exp(-k * lineIntegral[i]) + veil) / k : lineIntegral[i]
  }
  return result
}

/**
 * Shift a projection's level (never its contrast) until its mean displayed brightness over the
 * exposed field matches `targetMean`. Section 6 teaches that the monitor can stay similarly bright
 * while the signal behind it changes; a veiled image shown at the reference's brightness reads as
 * washed out rather than as darker, which is what the learner meets.
 */
export function matchMeanBrightness(
  lineIntegral: Float32Array,
  display: (value: number) => number,
  targetMean: number,
  exposed?: Uint8Array,
): Float32Array {
  const meanAt = (offset: number) => {
    let sum = 0
    let count = 0
    for (let i = 0; i < lineIntegral.length; i++) {
      if (exposed && exposed[i] !== 1) continue
      sum += display(lineIntegral[i] + offset)
      count++
    }
    return count > 0 ? sum / count : 0
  }
  let low = -1
  let high = 1
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    if (meanAt(mid) < targetMean) low = mid
    else high = mid
  }
  const offset = (low + high) / 2
  return lineIntegral.map((value, i) => (exposed && exposed[i] !== 1 ? value : value + offset))
}

/** Mean displayed brightness over the exposed field, 0–1. */
export function meanBrightness(
  lineIntegral: Float32Array,
  display: (value: number) => number,
  exposed?: Uint8Array,
): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < lineIntegral.length; i++) {
    if (exposed && exposed[i] !== 1) continue
    sum += display(lineIntegral[i])
    count++
  }
  return count > 0 ? sum / count : 0
}

/** Spread of the displayed signal inside a region: the contrast the eye has to work with. */
export function regionContrast(values: Float32Array, exposed?: Uint8Array): number {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < values.length; i++) {
    if (exposed && exposed[i] !== 1) continue
    min = Math.min(min, values[i])
    max = Math.max(max, values[i])
  }
  return Number.isFinite(max - min) ? max - min : 0
}
