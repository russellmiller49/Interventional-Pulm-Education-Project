import { maxScreenshotBytes } from './schema'

// The unannotated source image of a screenshot draft, as stored for owner-local recovery.
export type DraftImage = { blob: Blob; token: string }

// One encode per source canvas: annotations are stored beside the image, not baked into it.
const encoded = new WeakMap<HTMLCanvasElement, DraftImage | Error>()

/**
 * PNG bytes of a canvas, encoded synchronously on purpose. `canvas.toBlob` is scheduled in idle
 * time and falls back to timeouts on a busy page: the Save export was measured waiting 6.7 s for
 * its callback, against 6–9 ms here for the same image and the same bytes. Returns null when
 * the canvas cannot be encoded.
 */
export function canvasPng(canvas: HTMLCanvasElement) {
  try {
    const data = canvas.toDataURL('image/png')
    const binary = atob(data.slice(data.indexOf(',') + 1))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes.length ? new Blob([bytes], { type: 'image/png' }) : null
  } catch {
    return null
  }
}

// Encoded once, when the image is attached, so a draft write never waits on an encoder.
export function encodeScreenshotSource(source: HTMLCanvasElement): DraftImage {
  let image = encoded.get(source)
  if (!image) {
    const blob = canvasPng(source)
    image = !blob
      ? new Error('The screenshot could not be prepared for the draft.')
      : blob.size > maxScreenshotBytes
        ? new Error(
            'The screenshot is over 3 MB after processing, so it cannot be kept in the draft or saved. Use a smaller image.',
          )
        : { blob, token: crypto.randomUUID() }
    encoded.set(source, image)
  }
  if (image instanceof Error) throw image
  return image
}

export async function decodeScreenshotSource(image: DraftImage) {
  const bitmap = await createImageBitmap(image.blob)
  try {
    const source = document.createElement('canvas')
    source.width = bitmap.width
    source.height = bitmap.height
    source.getContext('2d')!.drawImage(bitmap, 0, 0)
    // Reuse the stored bytes so an unchanged image is never re-encoded or rewritten.
    encoded.set(source, image)
    return source
  } finally {
    bitmap.close()
  }
}
