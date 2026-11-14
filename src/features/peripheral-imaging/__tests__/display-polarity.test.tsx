import fs from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'

import { FigureCanvas } from '../components/figures/FigureCanvas'
import { displayedProjection, projectionDisplay, projectionPixels } from '../lib/ctProjection'
import {
  applyPolarity,
  CT_CONVENTION,
  DEFAULT_FLUORO_POLARITY,
  FLUORO_POLARITY_LABELS,
  getFluoroPolarity,
  polarityPixels,
  resetFluoroPolarityForTests,
  setFluoroPolarity,
  UNEXPOSED_ALPHA,
} from '../lib/displayPolarity'
import { FLUORO_LOOK } from '../lib/fluoroLook'

/*
 * Owner's ruling, 2026-11-12 (pi-display-polarity): “Offer a toggle,” with bone-dark fluoroscopy as
 * the default. One setting drives the shader, the static-figure twin and the monitor, so the live
 * image and the teaching figures cannot disagree about which way round the image is.
 */

const root = path.resolve(__dirname, '../../../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  resetFluoroPolarityForTests()
})

describe('the display polarity', () => {
  it('defaults to bone dark, and cone-beam CT keeps the CT convention', () => {
    expect(DEFAULT_FLUORO_POLARITY).toBe('bone-dark')
    expect(CT_CONVENTION).toBe('bone-bright')
    expect(getFluoroPolarity()).toBe('bone-dark')
    expect(FLUORO_POLARITY_LABELS).toEqual({
      'bone-dark': 'Bone dark',
      'bone-bright': 'Bone bright',
    })
  })

  it('draws the two polarities as monotonic inverses of each other', () => {
    const integrals = Array.from({ length: 101 }, (_, i) => (i / 100) * 1.2)
    const bright = integrals.map((value) => displayedProjection(value, 'bone-bright'))
    const dark = integrals.map((value) => displayedProjection(value, 'bone-dark'))
    for (let i = 1; i < integrals.length; i++) {
      expect(bright[i]).toBeGreaterThanOrEqual(bright[i - 1])
      expect(dark[i]).toBeLessThanOrEqual(dark[i - 1])
    }
    // Strictly monotonic across the display curve's working range, not only flat at its ends.
    expect(bright[50]).toBeGreaterThan(bright[10])
    expect(dark[50]).toBeLessThan(dark[10])
    integrals.forEach((value, i) => {
      expect(bright[i] + dark[i]).toBeCloseTo(1, 12)
      expect(bright[i]).toBe(projectionDisplay(value))
    })
    // Lung (little attenuation) is light and bone dark by default.
    expect(displayedProjection(0.035, DEFAULT_FLUORO_POLARITY)).toBe(1)
    expect(displayedProjection(FLUORO_LOOK.toneHigh, DEFAULT_FLUORO_POLARITY)).toBe(0)
    expect(applyPolarity(0.3, 'bone-bright')).toBe(0.3)
    expect(applyPolarity(0.3, 'bone-dark')).toBeCloseTo(0.7, 12)
  })

  it('is the mapping the WebGL shader applies, from the same course setting', () => {
    const shader = read('fluoro-viewer/src/volume-drr.ts')
    // The shader inverts the display value, after the display curve and before any tint.
    expect(shader).toMatch(/if \(uInvert > 0\.5\) intensity = 1\.0 - intensity;/)
    expect(shader.indexOf('intensity = 1.0 - intensity')).toBeGreaterThan(
      shader.indexOf('intensity = pow(intensity'),
    )
    expect(shader.indexOf('intensity = 1.0 - intensity')).toBeLessThan(
      shader.indexOf('vec3 color = vec3(intensity)'),
    )
    expect(shader).toMatch(/uInvert\.value = look\.invert \? 1 : 0/)
    // The suite asks for the inversion from the one setting, and nothing else sets it.
    const source = read('src/features/peripheral-imaging/components/suite/drrTextureSource.ts')
    expect(source).toMatch(/invert: this\.polarity === 'bone-dark'/)
    expect(source).toMatch(/from '..\/..\/lib\/displayPolarity'/)
    const monitor = read('src/features/peripheral-imaging/components/suite/Monitor.tsx')
    expect(monitor).toMatch(/engine\.current\?\.setPolarity\(polarity\)/)
  })

  it('keeps cone-beam CT out of the setting', () => {
    const scene = read('src/features/peripheral-imaging/components/suite/SuiteScene.tsx')
    expect(scene).toMatch(/ctConvention=\{isCbct\}/)
    const coneBeam = read('src/features/peripheral-imaging/components/suite/views/ConeBeamView.tsx')
    expect(coneBeam).not.toMatch(/displayPolarity|setPolarity/)
  })

  it('inverts a figure’s exposed pixels and leaves the unexposed field dark', () => {
    const lineIntegral = new Float32Array([0.035, 0.5, FLUORO_LOOK.toneHigh, 0.5])
    const exposed = new Uint8Array([1, 1, 1, 0])
    const stored = projectionPixels(lineIntegral, { exposed })
    expect(stored[3 * 4 + 3]).toBe(UNEXPOSED_ALPHA)
    const bright = polarityPixels(stored, 'bone-bright')
    const dark = polarityPixels(stored, 'bone-dark')
    for (let pixel = 0; pixel < 3; pixel++) {
      expect(bright[pixel * 4] + dark[pixel * 4]).toBe(255)
      expect(dark[pixel * 4 + 3]).toBe(255)
    }
    expect(dark[0]).toBe(255) // lung: light
    expect(dark[2 * 4]).toBe(0) // dense: dark
    expect(dark[3 * 4]).toBe(bright[3 * 4]) // no beam reached it: dark either way
    expect(dark[3 * 4]).toBeLessThan(20)
    expect(stored[0]).toBe(0) // the input is not changed
  })

  it('is remembered for the visit, and works without storage', () => {
    setFluoroPolarity('bone-bright')
    expect(window.sessionStorage.getItem('peripheral-imaging:fluoro-polarity')).toBe('bone-bright')
    resetFluoroPolarityForTests()
    expect(getFluoroPolarity()).toBe('bone-bright')

    window.sessionStorage.setItem('peripheral-imaging:fluoro-polarity', 'sepia')
    resetFluoroPolarityForTests()
    expect(getFluoroPolarity()).toBe('bone-dark')

    const blocked = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const blockedWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    resetFluoroPolarityForTests()
    expect(getFluoroPolarity()).toBe('bone-dark')
    expect(() => setFluoroPolarity('bone-bright')).not.toThrow()
    expect(getFluoroPolarity()).toBe('bone-bright')
    blocked.mockRestore()
    blockedWrite.mockRestore()
  })

  it('draws fluoroscopic figures in the chosen polarity and CT figures as CT', () => {
    const put = jest.fn()
    const getContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ putImageData: put } as unknown as ReturnType<
        HTMLCanvasElement['getContext']
      >)
    class FakeImageData {
      constructor(
        readonly data: Uint8ClampedArray,
        readonly width: number,
        readonly height: number,
      ) {}
    }
    const original = globalThis.ImageData
    Object.assign(globalThis, { ImageData: FakeImageData })
    try {
      const pixels = projectionPixels(new Float32Array([0.035]))
      render(
        <>
          <FigureCanvas pixels={pixels} size={1} label="Projection" fluoroscopic />
          <FigureCanvas pixels={pixels} size={1} label="Axial CT" />
        </>,
      )
      const drawn = () => put.mock.calls.map(([image]) => (image as FakeImageData).data[0])
      expect(drawn()).toEqual([255, 0])
      const [fluoro, ct] = screen
        .getAllByRole('img')
        .map((canvas) => canvas.parentElement!.getAttribute('data-display-polarity'))
      expect([fluoro, ct]).toEqual(['bone-dark', null])
      put.mockClear()
      act(() => setFluoroPolarity('bone-bright'))
      expect(drawn()).toEqual([0])
    } finally {
      Object.assign(globalThis, { ImageData: original })
      getContext.mockRestore()
    }
  })
})
