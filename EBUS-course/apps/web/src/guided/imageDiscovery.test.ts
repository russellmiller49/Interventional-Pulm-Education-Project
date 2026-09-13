import { describe, expect, it } from 'vitest'
import type { AcousticLabel } from '@bronchoscopy-core/acoustic'
import type { EbusWorkbenchConfig } from '../../../../../src/lib/ebus-guided-bridge'
import {
  canDiscoverImage,
  imageLabelAt,
  imagePixelAt,
  type LabelImage,
} from './imageDiscoveryPixels'

const config: EbusWorkbenchConfig = {
  sessionId: 'test',
  kind: 'simulator',
  presetKey: 'station_7_node_a::rms',
  controls: ['roll'],
  locked: false,
  reveal: false,
  view: 'sector',
  linkedLesson: 'scope-orientation',
  initialRoll: 55,
  initialDepth: 40,
  initialGain: 0,
}
describe('image discovery respects the existing disclosure boundary', () => {
  it('withholds image identities during active acquisition and locked Observe', () => {
    expect(canDiscoverImage(config)).toBe(false)
    expect(canDiscoverImage({ ...config, locked: true })).toBe(false)
    expect(canDiscoverImage({ ...config, demonstration: true })).toBe(false)
  })
  it('allows worked examples and the held frame after explanation is revealed', () => {
    expect(canDiscoverImage({ ...config, reveal: true, demonstration: true })).toBe(true)
    expect(canDiscoverImage({ ...config, reveal: true, locked: true })).toBe(true)
  })
  it('fails closed for assessment, missing config, and legacy simulators', () => {
    expect(canDiscoverImage({ ...config, reveal: true }, true)).toBe(false)
    expect(canDiscoverImage()).toBe(false)
    expect(canDiscoverImage({ ...config, reveal: true, linkedLesson: undefined })).toBe(false)
  })
})
describe('hover follows the displayed image rather than the surrounding canvas box', () => {
  const image = { width: 100, height: 100 }
  it('excludes horizontal letterboxing and maps the actual image edges', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 }
    expect(imagePixelAt(59, 70, rect, image)).toBeNull()
    expect(imagePixelAt(60, 20, rect, image)).toEqual({ x: 0, y: 0 })
    expect(imagePixelAt(159.9, 119.9, rect, image)).toEqual({ x: 99, y: 99 })
    expect(imagePixelAt(160, 70, rect, image)).toBeNull()
  })
  it('excludes vertical letterboxing and honors CSS scaling', () => {
    const rect = { left: 30, top: 40, width: 200, height: 400 }
    expect(imagePixelAt(130, 139, rect, image)).toBeNull()
    expect(imagePixelAt(130, 240, rect, image)).toEqual({ x: 50, y: 50 })
    expect(imagePixelAt(229, 339, rect, image)).toEqual({ x: 99, y: 99 })
    expect(imagePixelAt(130, 340, rect, image)).toBeNull()
  })
  it('does not identify pixels in a hidden or invalid canvas', () => {
    expect(imagePixelAt(0, 0, { left: 0, top: 0, width: 0, height: 0 }, image)).toBeNull()
    expect(imagePixelAt(NaN, 0, { left: 0, top: 0, width: 100, height: 100 }, image)).toBeNull()
  })
})
describe('image names come from the retained pixel label map', () => {
  const labels: AcousticLabel[] = [
    { id: 3, key: 'aorta', label: 'aorta', kind: 'blood' },
    { id: 25, key: 'station_7', label: 'Station 7', kind: 'node' },
  ]
  const retained: LabelImage = { width: 2, height: 2, labelImage: new Uint8Array([0, 3, 25, 99]) }
  it('keeps the retained identity when a later acquisition samples different tissue', () => {
    const next = { ...retained, labelImage: new Uint8Array([0, 25, 3, 99]) }
    expect(imageLabelAt(retained, labels, 1, 0)).toBe('aorta')
    expect(imageLabelAt(next, labels, 1, 0)).toBe('Station 7 example node')
    expect(imageLabelAt(retained, labels, 1, 0)).toBe('aorta')
  })
  it('does not name background, missing labels, or out-of-bounds coordinates', () => {
    expect(imageLabelAt(retained, labels, 0, 0)).toBeNull()
    expect(imageLabelAt(retained, labels, 1, 1)).toBeNull()
    expect(imageLabelAt(retained, labels, 2, 0)).toBeNull()
    expect(imageLabelAt(retained, labels, 0, -1)).toBeNull()
    expect(imageLabelAt(retained, labels, 0.5, 1)).toBeNull()
  })
})
