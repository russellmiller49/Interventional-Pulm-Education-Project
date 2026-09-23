import type { AcousticLabel } from '@bronchoscopy-core/acoustic'
import type { EbusWorkbenchConfig } from '../../../../../src/lib/ebus-guided-bridge'
import { structureDisplayName } from '../../../../../src/lib/ebus-linked-contract'

export interface LabelImage {
  width: number
  height: number
  labelImage: Uint8Array
}

// Image interpretation is withheld during acquisition and Observe, even when controls are active.
export const canDiscoverImage = (config?: EbusWorkbenchConfig, assessment = false) =>
  !!config?.linkedLesson && config.reveal && !assessment

/** Canvas pixels after CSS object-fit: contain, excluding letterboxing and image edges. */
export function imagePixelAt(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  image: Pick<LabelImage, 'width' | 'height'>,
) {
  const scale = Math.min(rect.width / image.width, rect.height / image.height)
  if (!Number.isFinite(scale) || scale <= 0) return null
  const x = (clientX - rect.left - (rect.width - image.width * scale) / 2) / scale
  const y = (clientY - rect.top - (rect.height - image.height * scale) / 2) / scale
  if (!Number.isFinite(x + y) || x < 0 || y < 0 || x >= image.width || y >= image.height)
    return null
  return { x: Math.floor(x), y: Math.floor(y) }
}

export function imageLabelAt(image: LabelImage, labels: AcousticLabel[], x: number, y: number) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= image.width ||
    y >= image.height
  )
    return null
  const id = image.labelImage[y * image.width + x]
  if (!id) return null
  const label = labels.find((entry) => entry.id === id)
  if (!label) return null
  // The course's spelling where the volume's label differs (EBUS-PRE-REVIEW-04, L3-10).
  const name = structureDisplayName(label.key, label.label)
  return label.kind === 'node' ? `${name} example node` : name
}
