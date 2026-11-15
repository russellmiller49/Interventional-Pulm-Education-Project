import fs from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'

import { FigureCanvas } from '../components/figures/FigureCanvas'
import { displayedProjection, projectionDisplay, projectionPixels } from '../lib/ctProjection'
import {
  applyPolarity,
  BONE_DARK_CURVE,
  boneDarkDisplay,
  CT_CONVENTION,
  DEFAULT_FLUORO_POLARITY,
  FLUORO_POLARITY_LABELS,
  getFluoroPolarity,
  polarityLook,
  polarityPixels,
  repolarize,
  repolarizeTable,
  resetFluoroPolarityForTests,
  setFluoroPolarity,
  UNEXPOSED_ALPHA,
} from '../lib/displayPolarity'
import { FLUORO_LOOK } from '../lib/fluoroLook'

/*
 * Owner's ruling, 2026-11-12 (pi-display-polarity): “Offer a toggle,” with bone-dark fluoroscopy as
 * the default. One setting drives the shader, the static-figure twin and the monitor, so the live
 * image and the teaching figures cannot disagree about which way round the image is.
 *
 * Owner's ruling, 2026-11-15 (on #552, the bone-dark image is pale): “Tune contrast before merge.”
 * Bone dark is drawn through a window and a gamma after the inversion; bone bright is unchanged.
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

  it('draws the two polarities as monotonic inverses of each other in density order', () => {
    const integrals = Array.from({ length: 101 }, (_, i) => (i / 100) * 1.2)
    const bright = integrals.map((value) => displayedProjection(value, 'bone-bright'))
    const dark = integrals.map((value) => displayedProjection(value, 'bone-dark'))
    for (let i = 1; i < integrals.length; i++) {
      expect(bright[i]).toBeGreaterThanOrEqual(bright[i - 1])
      expect(dark[i]).toBeLessThanOrEqual(dark[i - 1])
      // Wherever one display tells two densities apart, so does the other, the other way round.
      if (bright[i] > bright[i - 1]) expect(dark[i]).toBeLessThan(dark[i - 1])
    }
    // Strictly monotonic across the display curve's working range, not only flat at its ends.
    expect(bright[50]).toBeGreaterThan(bright[10])
    expect(dark[50]).toBeLessThan(dark[10])
    integrals.forEach((value, i) => {
      // Bone bright is the display curve itself, unchanged; bone dark is its inversion through
      // the window and gamma, and maps back to it exactly.
      expect(bright[i]).toBe(projectionDisplay(value))
      expect(dark[i]).toBe(boneDarkDisplay(1 - bright[i]))
      expect(repolarize(dark[i], 'bone-dark', 'bone-bright')).toBeCloseTo(bright[i], 12)
    })
    // Least attenuation is lightest and the densest darkest by default.
    expect(displayedProjection(0.035, DEFAULT_FLUORO_POLARITY)).toBe(Math.max(...dark))
    expect(displayedProjection(FLUORO_LOOK.toneHigh, DEFAULT_FLUORO_POLARITY)).toBe(0)
    expect(applyPolarity(0.3, 'bone-bright')).toBe(0.3)
    expect(applyPolarity(0.3, 'bone-dark')).toBeCloseTo((0.7 / 1.1) ** 2, 12)
  })

  it('draws bone dark as a fluoroscopy monitor does: grey lung, darker bone, the nodule no fainter', () => {
    expect(BONE_DARK_CURVE).toEqual({ black: 0, white: 1.1, gamma: 2 })
    // Aerated lung on the course's frontal image (denser-is-higher 0.07–0.3, typically about 0.16)
    // is mid-to-light grey, not the near white of a straight inversion.
    const lung = applyPolarity(0.16, 'bone-dark')
    expect(lung).toBeGreaterThan(0.5)
    expect(lung).toBeLessThan(0.7)
    expect(1 - 0.16).toBeGreaterThan(0.8)
    // An unattenuated beam is light grey, not glare.
    expect(applyPolarity(0, 'bone-dark')).toBeCloseTo(1 / 1.1 ** 2, 12)
    // Rib (about 0.3) and mediastinum (about 0.6) are clearly darker than the lung.
    expect(lung - applyPolarity(0.3, 'bone-dark')).toBeGreaterThan(0.15)
    expect(applyPolarity(0.6, 'bone-dark')).toBeLessThan(0.15)
    // Through the lung's range the curve is at least as steep as bone bright (slope 1), so a nodule
    // in the lung differs from the lung round it by at least as many grey levels.
    for (let value = 0.05; value <= 0.3; value += 0.01) {
      const slope =
        (applyPolarity(value, 'bone-dark') - applyPolarity(value + 0.01, 'bone-dark')) / 0.01
      expect(slope).toBeGreaterThanOrEqual(1)
    }
  })

  it('redraws a stored frame in the other polarity through the same curve', () => {
    for (let value = 0; value <= 1; value += 0.05) {
      expect(repolarize(value, 'bone-bright', 'bone-dark')).toBe(applyPolarity(value, 'bone-dark'))
      expect(repolarize(value, 'bone-bright', 'bone-bright')).toBe(value)
    }
    const toBright = repolarizeTable('bone-dark', 'bone-bright')
    const toDark = repolarizeTable('bone-bright', 'bone-dark')
    expect(toBright).toHaveLength(129)
    for (let i = 1; i < 129; i++) {
      expect(toBright[i]).toBeLessThanOrEqual(toBright[i - 1])
      expect(toDark[i]).toBeLessThanOrEqual(toDark[i - 1])
    }
    // The table (piecewise linear in a browser) takes a bone-dark pixel back to its bone-bright
    // value within a grey level, short of the densest end, which bone dark draws near black.
    const lookup = (table: number[], value: number) => {
      const at = value * (table.length - 1)
      const low = Math.floor(at)
      const high = Math.min(table.length - 1, low + 1)
      return table[low] + (table[high] - table[low]) * (at - low)
    }
    for (let value = 0; value <= 0.9; value += 0.01)
      expect(
        Math.abs(lookup(toBright, applyPolarity(value, 'bone-dark')) - value) * 255,
      ).toBeLessThan(1)
  })

  it('is the mapping the WebGL shader applies, from the same course setting', () => {
    const shader = read('fluoro-viewer/src/volume-drr.ts')
    // The shader inverts the display value through the window and gamma, after the display curve
    // and before any tint: the formula of `boneDarkDisplay`, on uInvertCurve = (black, white, gamma).
    expect(shader).toMatch(/if \(uInvert > 0\.5\) intensity = invertedDisplay\(intensity\);/)
    expect(shader).toMatch(
      /float t = clamp\(\s*\(1\.0 - denserIsHigher - uInvertCurve\.x\) \/ \(uInvertCurve\.y - uInvertCurve\.x\),\s*0\.0,\s*1\.0\s*\);\s*return pow\(t, uInvertCurve\.z\);/,
    )
    expect(shader.indexOf('intensity = invertedDisplay(intensity)')).toBeGreaterThan(
      shader.indexOf('intensity = pow(intensity'),
    )
    expect(shader.indexOf('intensity = invertedDisplay(intensity)')).toBeLessThan(
      shader.indexOf('vec3 color = vec3(intensity)'),
    )
    // A ray that misses the volume is drawn as no attenuation, through the same curve.
    expect(shader).toMatch(/uInvert > 0\.5 \? invertedDisplay\(0\.0\) : 0\.0/)
    expect(shader).toMatch(/uInvert\.value = look\.invert \? 1 : 0/)
    expect(shader).toMatch(/uInvertCurve\.value\.set\(\.\.\.look\.invertCurve\)/)
    expect(polarityLook('bone-dark')).toEqual({
      invert: true,
      invertCurve: [BONE_DARK_CURVE.black, BONE_DARK_CURVE.white, BONE_DARK_CURVE.gamma],
    })
    expect(polarityLook('bone-bright').invert).toBe(false)
    // The suite asks for the inversion from the one setting, and nothing else sets it.
    const source = read('src/features/peripheral-imaging/components/suite/drrTextureSource.ts')
    expect(source).toMatch(/\.\.\.polarityLook\(this\.polarity\)/)
    expect(source).not.toMatch(/invert:/)
    expect(source).toMatch(/from '..\/..\/lib\/displayPolarity'/)
    const fallback = read('src/features/peripheral-imaging/components/ProjectionView.tsx')
    expect(fallback).toMatch(/look: polarityLook\(/)
    expect(fallback).not.toMatch(/invert:/)
    const monitor = read('src/features/peripheral-imaging/components/suite/Monitor.tsx')
    expect(monitor).toMatch(/engine\.current\?\.setPolarity\(polarity\)/)
  })

  it('keeps cone-beam CT out of the setting', () => {
    const scene = read('src/features/peripheral-imaging/components/suite/SuiteScene.tsx')
    expect(scene).toMatch(/ctConvention=\{isCbct\}/)
    const coneBeam = read('src/features/peripheral-imaging/components/suite/views/ConeBeamView.tsx')
    expect(coneBeam).not.toMatch(/displayPolarity|setPolarity/)
  })

  it('draws a figure’s exposed pixels through the same curve and leaves the unexposed field dark', () => {
    const lineIntegral = new Float32Array([0.035, 0.5, FLUORO_LOOK.toneHigh, 0.5])
    const exposed = new Uint8Array([1, 1, 1, 0])
    const stored = projectionPixels(lineIntegral, { exposed })
    expect(stored[3 * 4 + 3]).toBe(UNEXPOSED_ALPHA)
    const bright = polarityPixels(stored, 'bone-bright')
    const dark = polarityPixels(stored, 'bone-dark')
    for (let pixel = 0; pixel < 3; pixel++) {
      expect(bright[pixel * 4]).toBe(stored[pixel * 4]) // bone bright: the pixels as stored
      expect(dark[pixel * 4]).toBe(
        Math.round(applyPolarity(stored[pixel * 4] / 255, 'bone-dark') * 255),
      )
      expect(dark[pixel * 4 + 1]).toBe(dark[pixel * 4])
      expect(dark[pixel * 4 + 3]).toBe(255)
    }
    expect(dark[0]).toBe(Math.round(255 / 1.1 ** 2)) // least attenuation: light grey
    expect(dark[2 * 4]).toBe(0) // dense: dark
    expect(dark[3 * 4]).toBe(bright[3 * 4]) // no beam reached it: dark either way
    expect(dark[3 * 4]).toBeLessThan(20)
    expect(stored[0]).toBe(0) // the input is not changed
    // Every byte, in density order: the darker for every step denser.
    const ramp = new Uint8ClampedArray(256 * 4)
    for (let value = 0; value < 256; value++) {
      ramp.fill(value, value * 4, value * 4 + 3)
      ramp[value * 4 + 3] = 255
    }
    const drawn = polarityPixels(ramp, 'bone-dark')
    for (let value = 1; value < 256; value++)
      expect(drawn[value * 4]).toBeLessThanOrEqual(drawn[(value - 1) * 4])
    expect(polarityPixels(ramp, 'bone-bright')).toEqual(ramp)
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
      expect(drawn()).toEqual([Math.round(255 / 1.1 ** 2), 0])
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
