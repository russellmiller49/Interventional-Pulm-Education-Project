/**
 * jsdom (jest-environment-jsdom) does not implement ImageData; the shared
 * B-mode render loop constructs one when renderImage is true. Tests that
 * exercise the render path install this minimal spec-compatible stand-in.
 */
class ImageDataPolyfill {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = widthOrHeight
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
    } else {
      this.data = dataOrWidth
      this.width = widthOrHeight
      this.height = height ?? dataOrWidth.length / (4 * widthOrHeight)
    }
  }
}

export function installImageDataPolyfill() {
  if (typeof globalThis.ImageData === 'undefined') {
    ;(globalThis as { ImageData?: unknown }).ImageData = ImageDataPolyfill
  }
}
