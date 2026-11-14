import type { LabelFrame } from './visibleArea';

/**
 * Where things are in one drawn image: the point a landmark's number is put at, and what a click
 * on the image lands on. Both read the frame's label image together with its reach mask
 * (`reachMask` in visibleArea.ts), so tissue behind air or bone, which the image does not show,
 * can be neither numbered nor clicked.
 */

/** A place in a frame, in its own pixels. */
export interface FramePoint {
  x: number;
  y: number;
}

/** In the label image, 255 stands for label 0 inside the sector. */
const rawOf = (labelId: number) => (labelId === 0 ? 255 : labelId);

/**
 * The point a landmark's number is put at: the pixel of the structure the beam reaches that lies
 * nearest the middle of all such pixels. It is always on the structure, also where the structure
 * is a ring or lies in two pieces. Null when the beam reaches none of it in this image.
 */
export function landmarkPoint(
  frame: Pick<LabelFrame, 'labelImage' | 'width' | 'height'>,
  reach: Uint8Array,
  labelId: number,
): FramePoint | null {
  const { labelImage, width, height } = frame;
  const raw = rawOf(labelId);
  let count = 0,
    sumX = 0,
    sumY = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      if (labelImage[at] !== raw || !reach[at]) continue;
      count++;
      sumX += x;
      sumY += y;
    }
  if (count === 0) return null;
  const middleX = sumX / count,
    middleY = sumY / count;
  let best: FramePoint | null = null,
    bestDistance = Infinity;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      if (labelImage[at] !== raw || !reach[at]) continue;
      const distance = (x - middleX) ** 2 + (y - middleY) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  return best;
}

/** How far from a structure a click may land and still count, in frame pixels: about 1% of the image. */
export function clickTolerancePx(frame: Pick<LabelFrame, 'width'>) {
  return Math.max(2, Math.round(frame.width * 0.01));
}

/**
 * Whether a click lands on a structure: on a pixel of it that the beam reaches, or within the
 * tolerance of one, so a thin or small structure is not a pixel hunt.
 */
export function clickHits(
  frame: Pick<LabelFrame, 'labelImage' | 'width' | 'height'>,
  reach: Uint8Array,
  labelId: number,
  at: FramePoint,
  tolerancePx: number,
): boolean {
  const { labelImage, width, height } = frame;
  const raw = rawOf(labelId);
  const reachOf = Math.ceil(tolerancePx);
  for (let dy = -reachOf; dy <= reachOf; dy++)
    for (let dx = -reachOf; dx <= reachOf; dx++) {
      if (dx * dx + dy * dy > tolerancePx * tolerancePx) continue;
      const x = Math.round(at.x) + dx,
        y = Math.round(at.y) + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const pixel = y * width + x;
      if (labelImage[pixel] === raw && reach[pixel]) return true;
    }
  return false;
}

/** The label id under a point where the beam reaches it, or null outside the image or in shadow. */
export function labelUnder(
  frame: Pick<LabelFrame, 'labelImage' | 'width' | 'height'>,
  reach: Uint8Array,
  at: FramePoint,
): number | null {
  const x = Math.round(at.x),
    y = Math.round(at.y);
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return null;
  const pixel = y * frame.width + x;
  const raw = frame.labelImage[pixel];
  if (raw === 0 || !reach[pixel]) return null;
  return raw === 255 ? 0 : raw;
}

/** A frame point as fractions of the image, taken at the middle of its pixel. */
export function pointFraction(frame: Pick<LabelFrame, 'width' | 'height'>, at: FramePoint) {
  return { x: (at.x + 0.5) / frame.width, y: (at.y + 0.5) / frame.height };
}
