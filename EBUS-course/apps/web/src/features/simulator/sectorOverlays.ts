/**
 * Drawing over the simulated ultrasound image, kept apart from the image itself.
 *
 * Nothing here changes a rendered frame: its pixels, its label image and the frame id computed
 * from them stay exactly as the acoustic renderer produced them, so held images, comparisons and
 * acquisition evidence are unaffected. Two things are drawn on separate canvases above it:
 *
 * - an outline and a number on each structure the learner has already found, so it can be
 *   followed as the plane moves;
 * - arterial pulsation, as a small periodic widening of each artery about its own centre.
 */

/** The acoustic volume's arteries. Veins and heart chambers are left still. */
export const ARTERY_KEYS: readonly string[] = [
  'aorta',
  'pulmonary_artery',
  'brachiocephalic_trunk',
  'right_subclavian_artery',
  'left_subclavian_artery',
  'right_common_carotid_artery',
  'left_common_carotid_artery',
]
/** One beat, in milliseconds, and how far the wall moves out at its peak (fraction of radius). */
export const PULSE_PERIOD_MS = 1000
export const PULSE_AMPLITUDE = 0.03
/** How far beyond the lumen the moving region is feathered, in image pixels. */
export const PULSE_REACH_PX = 5

/**
 * How wide the artery is at a moment in the beat, as a scale on its resting size: a quick
 * systolic widening over the first 15% of the beat, then a slower return to rest by its end.
 */
export function pulseScale(timeMs: number) {
  const phase = (((timeMs % PULSE_PERIOD_MS) + PULSE_PERIOD_MS) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS
  const swell =
    phase < 0.15
      ? Math.sin((Math.PI / 2) * (phase / 0.15))
      : Math.exp(-(phase - 0.15) / 0.25) * ((1 - phase) / 0.85)
  return 1 + PULSE_AMPLITUDE * swell
}

export interface StructureOutline {
  /** Pixel indices on the structure's edge. */
  edge: Int32Array
  /** A pixel of the structure itself nearest its centroid: where its number goes. */
  anchor: [number, number]
  count: number
}
/** The edge of one labelled structure in a frame, or null when too little of it is in view. */
export function structureOutline(
  labelImage: Uint8Array,
  width: number,
  height: number,
  id: number,
  minPixels = 40,
): StructureOutline | null {
  const edge: number[] = []
  let sx = 0,
    sy = 0,
    count = 0
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (labelImage[i] !== id) continue
      sx += x
      sy += y
      count += 1
      if (
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        labelImage[i - 1] !== id ||
        labelImage[i + 1] !== id ||
        labelImage[i - width] !== id ||
        labelImage[i + width] !== id
      )
        edge.push(i)
    }
  if (count < minPixels) return null
  const cx = sx / count,
    cy = sy / count
  let best = Infinity,
    ax = Math.round(cx),
    ay = Math.round(cy)
  // The centroid of a crescent can lie outside it: use the structure's own nearest pixel.
  if (labelImage[ay * width + ax] !== id)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (labelImage[y * width + x] !== id) continue
        const d = (x - cx) ** 2 + (y - cy) ** 2
        if (d < best) {
          best = d
          ax = x
          ay = y
        }
      }
  return { edge: Int32Array.from(edge), anchor: [ax, ay], count }
}

export interface PulseRegion {
  /** Pixel indices that are redrawn: the lumen and a feathered margin around it. */
  indices: Int32Array
  /** How fully each is redrawn, 1 in the lumen falling to 0 at the margin's edge. */
  weights: Float32Array
  centre: [number, number]
}
/**
 * The region that moves with one artery: its lumen plus a margin of soft tissue that is carried
 * with the wall. Pixels outside the sector (label 0) are never part of it.
 */
export function pulseRegion(
  labelImage: Uint8Array,
  width: number,
  height: number,
  id: number,
  reach = PULSE_REACH_PX,
  minPixels = 120,
): PulseRegion | null {
  const distance = new Int16Array(width * height).fill(-1)
  let frontier: number[] = []
  let sx = 0,
    sy = 0
  for (let i = 0; i < labelImage.length; i++)
    if (labelImage[i] === id) {
      distance[i] = 0
      frontier.push(i)
      sx += i % width
      sy += Math.floor(i / width)
    }
  const lumen = frontier.length
  if (lumen < minPixels) return null
  const all = [...frontier]
  for (let step = 1; step <= reach; step++) {
    const next: number[] = []
    for (const i of frontier) {
      const x = i % width,
        y = Math.floor(i / width)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const n = ny * width + nx
        // Only tissue is carried with the wall: not the outside of the sector, not air.
        if (distance[n] !== -1 || labelImage[n] !== 1) continue
        distance[n] = step
        next.push(n)
      }
    }
    all.push(...next)
    frontier = next
  }
  const weights = new Float32Array(all.length)
  for (let k = 0; k < all.length; k++) weights[k] = 1 - distance[all[k]] / (reach + 1)
  return { indices: Int32Array.from(all), weights, centre: [sx / lumen, sy / lumen] }
}

/**
 * Draw one artery at a given width into `out` (RGBA, transparent elsewhere): each pixel of its
 * region shows the frame's own pixel from nearer the centre, so the lumen and its wall move out.
 * A source pixel outside the sector is left alone, so the sector's edge never moves.
 */
export function drawPulse(
  rgba: Uint8ClampedArray,
  labelImage: Uint8Array,
  width: number,
  height: number,
  region: PulseRegion,
  scale: number,
  out: Uint8ClampedArray,
) {
  const [cx, cy] = region.centre
  for (let k = 0; k < region.indices.length; k++) {
    const i = region.indices[k],
      x = i % width,
      y = Math.floor(i / width)
    const fx = cx + (x - cx) / scale,
      fy = cy + (y - cy) / scale
    const x0 = Math.floor(fx),
      y0 = Math.floor(fy)
    if (x0 < 0 || y0 < 0 || x0 >= width - 1 || y0 >= height - 1) continue
    if (labelImage[Math.round(fy) * width + Math.round(fx)] === 0) continue
    const tx = fx - x0,
      ty = fy - y0,
      a = (y0 * width + x0) * 4
    const gray =
      (rgba[a] * (1 - tx) + rgba[a + 4] * tx) * (1 - ty) +
      (rgba[a + width * 4] * (1 - tx) + rgba[a + width * 4 + 4] * tx) * ty
    const o = i * 4
    out[o] = out[o + 1] = out[o + 2] = gray
    out[o + 3] = Math.round(255 * region.weights[k])
  }
}
