import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AcousticLabel } from '@bronchoscopy-core/acoustic'
import { imageLabelAt, type LabelImage } from './imageDiscoveryPixels'
import {
  LINKED_LANDMARKS,
  STRUCTURE_DISPLAY_NAMES,
} from '../../../../../src/lib/ebus-linked-contract'

/**
 * EBUS-PRE-REVIEW-04, L3-10: the discovery layer and the model views show the course's spelling
 * ("azygos vein", "left atrium", "left atrial appendage", "11Ri") while the label volume, the
 * mesh ids and the landmark answers keep theirs.
 */
const volume = JSON.parse(
  readFileSync(
    join(__dirname, '../../public/simulator/case-001/geometry/acoustic-v2.json'),
    'utf8',
  ),
) as { labels: AcousticLabel[] }

describe('structure names on the retained image use the course spelling', () => {
  const at = (key: string) => {
    const label = volume.labels.find((entry) => entry.key === key)!
    const image: LabelImage = { width: 1, height: 1, labelImage: new Uint8Array([label.id]) }
    return imageLabelAt(image, volume.labels, 0, 0)
  }
  it.each([
    ['azygous', 'azygos vein'],
    ['left_atrium', 'left atrium'],
    ['atrial_appendage_left', 'left atrial appendage'],
    ['superior_vena_cava', 'superior vena cava'],
    ['right_ventricle', 'right ventricle'],
    ['aorta', 'aorta'],
    ['station_11ri', 'Station 11Ri example node'],
  ])('%s → %s', (key, name) => {
    expect(at(key)).toBe(name)
  })
  it('never shows an underscore or a model-only spelling', () => {
    for (const label of volume.labels) {
      if (!label.id) continue
      const name = at(label.key)!
      expect(name).not.toMatch(/_|azygous|Atrium|Ventricle|appendage left/)
    }
  })
  it('keeps every id the evidence keys on', () => {
    expect(volume.labels.find((entry) => entry.key === 'azygous')).toBeTruthy()
    expect(LINKED_LANDMARKS['right-paratracheal']).toEqual([
      'azygous',
      'superior_vena_cava',
      'left_brachiocephalic_vein',
    ])
    for (const id of Object.keys(STRUCTURE_DISPLAY_NAMES)) expect(id).toMatch(/^[a-z0-9_]+$/)
  })
})
