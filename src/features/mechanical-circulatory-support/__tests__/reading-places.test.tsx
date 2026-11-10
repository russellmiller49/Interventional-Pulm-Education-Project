import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import {
  MCS_SEGMENT_HEART_MESHES,
  mcsHeartMeshesFor,
  mcsReadingPlace,
  type McsReadingId,
} from '../content/readingPlaces'
import { mcsMapSegmentIds } from '../content/supportSpine'
import { mcsMonitorTargets } from '../content/primarySurfaces'
import {
  answerIdentification,
  currentStepId,
  mountSection,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

/**
 * Pointing at a reading lights where it is taken.
 *
 * A tester on the ECMO module (2026-10-15) asked to hover over a name in the text and have its
 * place light on the simulation. Here each reading taken at a place on the circulation points at
 * that place on the circulation map, on the three-dimensional heart and on the monitor.
 */
const READINGS: readonly McsReadingId[] = [
  'mean-arterial-pressure',
  'right-atrial-pressure',
  'wedge-pressure',
  'native-flow',
  'left-pump-estimate',
  'right-pump-estimate',
  'effective-systemic-flow',
  'lv-volume',
  'pump-power',
  'pulsatility-index',
]

/** The mesh names in the CT heart model, read from the file the scene loads. */
function heartMeshNames(): ReadonlySet<string> {
  const glb = readFileSync(join(process.cwd(), 'public/models/cardiac/heart-ct-animated-v1.glb'))
  const jsonLength = glb.readUInt32LE(12)
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as {
    nodes: { name?: string; mesh?: number }[]
  }
  return new Set(json.nodes.filter((node) => node.mesh !== undefined).map((node) => node.name!))
}

describe('where each reading is taken', () => {
  it('names only segments the map draws and monitor regions the monitor tags', () => {
    for (const id of READINGS)
      for (const device of ['iabp', 'impella', 'lvad'] as const) {
        const place = mcsReadingPlace(id, device)
        if (!place) continue
        expect(place.segmentIds.length).toBeGreaterThan(0)
        for (const segment of place.segmentIds) expect(mcsMapSegmentIds).toContain(segment)
        expect(mcsMonitorTargets[place.monitorTarget]).toBeDefined()
        expect(place.sentence('This reading')).toMatch(/^This reading .+\.$/)
      }
  })

  it('gives the controller quantities no place on the loop', () => {
    expect(mcsReadingPlace('pump-power', 'lvad')).toBeNull()
    expect(mcsReadingPlace('pulsatility-index', 'lvad')).toBeNull()
  })

  it('puts the pressures where they are read', () => {
    expect(mcsReadingPlace('right-atrial-pressure', 'iabp')!.segmentIds).toEqual(['right-atrium'])
    expect(mcsReadingPlace('wedge-pressure', 'iabp')!.segmentIds).toEqual(['left-atrium'])
    expect(mcsReadingPlace('native-flow', 'impella')!.segmentIds).toEqual(['aortic-valve'])
    expect(mcsReadingPlace('left-pump-estimate', 'lvad')!.segmentIds).toEqual([
      'left-ventricle',
      'ascending-aorta',
    ])
  })

  it('maps every segment to structures that exist in the heart model', () => {
    const meshes = heartMeshNames()
    for (const segment of mcsMapSegmentIds)
      for (const name of MCS_SEGMENT_HEART_MESHES[segment]) expect(meshes).toContain(name)
    expect(mcsHeartMeshesFor(['ascending-aorta', 'descending-aorta'])).toEqual(['CT_Aorta'])
  })
})

describe('pointing at a reading, through the host', () => {
  beforeEach(() => setupMcsStage())
  afterEach(() => {
    cleanup()
    teardownMcsStage()
  })

  const row = (id: McsReadingId) => document.querySelector<HTMLElement>(`[data-reading="${id}"]`)!
  const hint = () => document.querySelector<HTMLElement>('[data-readings-hint]')!
  const map = () => document.querySelector<HTMLElement>('[data-circulation-map]')!

  it('lights the place on the map, says it in words, and lets go on leaving', () => {
    mountSection('lvad-alarms-emergencies')
    expect(hint()).toHaveTextContent('Point at a reading to see where it is taken.')

    fireEvent.mouseEnter(row('right-atrial-pressure'))
    expect(hint()).toHaveTextContent('Right atrial pressure is read in the right atrium.')
    expect(row('right-atrial-pressure')).toHaveAttribute('data-pointed')
    expect(map()).toHaveAttribute('data-map-emphasis-tone', 'implicated')
    expect(map().querySelector('[data-map-emphasis-caption]')).toHaveTextContent(
      'Right atrial pressure is read in the right atrium.',
    )

    fireEvent.mouseLeave(row('right-atrial-pressure'))
    expect(hint()).toHaveTextContent('Point at a reading to see where it is taken.')
    expect(row('right-atrial-pressure')).not.toHaveAttribute('data-pointed')
  })

  it('points from the keyboard: the label is a button', () => {
    mountSection('lvad-alarms-emergencies')
    const button = row('wedge-pressure').querySelector('button')!
    fireEvent.focus(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(hint()).toHaveTextContent(
      'Wedge pressure stands in for the pressure in the left atrium.',
    )
    fireEvent.blur(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('leaves the controller quantities as plain rows', () => {
    mountSection('lvad-alarms-emergencies')
    expect(row('pump-power').querySelector('button')).toBeNull()
    expect(row('pulsatility-index')).not.toHaveAttribute('data-pointable')
  })

  it('does not point while a place on the map is the question, and does once it is answered', () => {
    mountSection('impella-suction-purge-rv')
    expect(currentStepId()).toBe('impella-suction-purge-rv-recognize')
    // A lit place would be a hint, so the readings are plain rows until the answer is committed.
    expect(document.querySelector('[data-task-readings]')).not.toBeNull()
    expect(document.querySelector('[data-point-place]')).toBeNull()
    expect(document.querySelector('[data-readings-hint]')).toBeNull()

    answerIdentification('impella-suction-purge-rv')
    expect(document.querySelector('[data-point-place]')).not.toBeNull()
  })
})
