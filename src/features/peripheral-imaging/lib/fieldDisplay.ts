/**
 * What the collimated field does to the displayed image, for the collimation section's monitor
 * (owner's teaching, 2026-10-11).
 *
 * Two of the three mechanisms the section teaches are drawn on the projection itself:
 *
 * - Automatic image processing. The display range is set from the pixels inside the collimated
 *   field (their 1st to 99th percentile). While the spine and mediastinum are in the field they
 *   take the bright end of that range; once they are collimated out, the same range is spread over
 *   the lung, the lesion and the tool.
 * - Scatter. Scatter is produced in the irradiated tissue, so its share of the detector signal is
 *   taken to rise with the irradiated area, and it is drawn the way FluoroView draws it: as a veil
 *   that lowers contrast evenly. The veil is gone by the width at which the spine leaves the field.
 *
 * The third, automatic exposure control, is taught in the text and reported by the "Spine in the
 * field" readout; the projection's beam quality is not changed.
 *
 * The numbers are for teaching. They show the direction and rough size of each effect on the
 * course's CT, not the response of a particular system.
 */

/** Scatter-to-primary ratio taken for the open field; it scales with the irradiated area. */
export const OPEN_FIELD_SCATTER_TO_PRIMARY = 0.8
/** The area fraction at and below which the drawn veil is gone (a field about 45% wide). */
export const VEIL_FREE_AREA_FRACTION = 0.2
/** The display range is never narrower than this share of the raw range. */
export const MIN_DISPLAY_WINDOW = 0.18

const TABLE_SIZE = 33

export interface FieldRect {
  /** Left edge, top edge and side of the collimated field, as fractions of the image (0–1). */
  readonly left: number
  readonly top: number
  readonly size: number
}

export interface FieldDisplay {
  /** The display range, as raw image values 0–1: black point and white point. */
  readonly window: readonly [number, number]
  /** Contrast kept after the scatter veil, 0–1. */
  readonly veilContrast: number
  /** Displayed contrast per unit of raw contrast, relative to the open field of the same image. */
  readonly gain: number
  /** Output for equally spaced inputs 0–1: an SVG `feFunc` table. */
  readonly table: readonly number[]
}

function percentileWindow(histogram: Uint32Array, count: number): [number, number] {
  if (count === 0) return [0, 1]
  const at = (share: number) => {
    const target = share * (count - 1)
    let seen = 0
    for (let value = 0; value < 256; value++) {
      seen += histogram[value]
      if (seen > target) return value / 255
    }
    return 1
  }
  let low = at(0.01)
  let high = at(0.99)
  if (high - low < MIN_DISPLAY_WINDOW) {
    const middle = (low + high) / 2
    low = Math.max(0, middle - MIN_DISPLAY_WINDOW / 2)
    high = Math.min(1, low + MIN_DISPLAY_WINDOW)
    low = high - MIN_DISPLAY_WINDOW
  }
  return [low, high]
}

/** Contrast kept under the scatter veil for a field covering `areaFraction` of the open field. */
export function veilContrast(areaFraction: number): number {
  const kept = (area: number) => 1 / (1 + OPEN_FIELD_SCATTER_TO_PRIMARY * area)
  return Math.min(1, kept(Math.min(1, Math.max(0, areaFraction))) / kept(VEIL_FREE_AREA_FRACTION))
}

/**
 * The display mapping for one frame.
 *
 * `gray` is the frame's luminance, one byte per pixel, row-major, `width` pixels to a row. `field`
 * is the collimated field on that frame and `areaFraction` its area as a share of the open field.
 */
export function fieldDisplay(
  gray: ArrayLike<number>,
  width: number,
  field: FieldRect,
  areaFraction: number,
): FieldDisplay {
  const height = Math.floor(gray.length / width)
  const inside = new Uint32Array(256)
  const whole = new Uint32Array(256)
  let insideCount = 0
  const left = field.left * width
  const right = (field.left + field.size) * width
  const top = field.top * height
  const bottom = (field.top + field.size) * height
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      const value = Math.min(255, Math.max(0, Math.round(gray[row * width + col])))
      whole[value]++
      if (col + 0.5 >= left && col + 0.5 <= right && row + 0.5 >= top && row + 0.5 <= bottom) {
        inside[value]++
        insideCount++
      }
    }
  const window = percentileWindow(inside, insideCount)
  const open = percentileWindow(whole, width * height)
  const veil = veilContrast(areaFraction)
  const span = window[1] - window[0]
  const table = Array.from({ length: TABLE_SIZE }, (_, index) => {
    const raw = index / (TABLE_SIZE - 1)
    const windowed = Math.min(1, Math.max(0, (raw - window[0]) / span))
    return Number((0.5 + (windowed - 0.5) * veil).toFixed(4))
  })
  const gain = veil / span / (veilContrast(1) / (open[1] - open[0]))
  return { window, veilContrast: veil, gain, table }
}

/** Luminance bytes from RGBA pixels (the projection is grey, so the red channel is the value). */
export function luminanceOf(rgba: ArrayLike<number>): Uint8Array {
  const gray = new Uint8Array(Math.floor(rgba.length / 4))
  for (let i = 0; i < gray.length; i++) gray[i] = rgba[i * 4]
  return gray
}
