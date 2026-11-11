import { describe, expect, it } from 'vitest'
import {
  LINKED_ALONG_AIRWAY,
  emptyLinkedSweep,
  stepLinkedSweep,
  type LinkedSweep,
} from '../../../../../src/lib/ebus-linked-contract'
import { describeAirwayView, describeAlongAirway, describeLinkedSweep } from './sweepStatus'

const base = { frameReady: true, contact: 1, targetName: 'The node' }
const step = (sweep: LinkedSweep, roll: number, visible: boolean, contact = 1) =>
  stepLinkedSweep(sweep, { roll, frameId: `f${roll}:${visible}:${contact}`, visible, contact })

describe('rotation sweep', () => {
  it('asks for rotation before anything has been sampled', () => {
    const s = describeLinkedSweep({ ...base, sweep: emptyLinkedSweep(), targetVisible: false })
    expect(s.state).toBe('start')
    expect(s.next).toMatch(/Scope rotation slider/)
  })
  it('completes after 20° of rotation with the node seen, however large the steps', () => {
    let sweep = step(emptyLinkedSweep(), 85, false).sweep
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: false }).state).toBe('sweeping')
    // One drag of the slider: a single large step onto the node.
    const done = step(sweep, 55, true)
    expect(done.event).toBe('complete')
    sweep = done.sweep
    expect(sweep).toMatchObject({ phase: 'complete', span: 30, samples: 1 })
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: true }).state).toBe('complete')
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: false }).state).toBe(
      'complete-off-target',
    )
  })
  it('counts rotation in either direction and says how much is left', () => {
    let sweep = step(emptyLinkedSweep(), 10, true).sweep
    sweep = step(sweep, 18, true).sweep
    sweep = step(sweep, 4, true).sweep
    expect(sweep).toMatchObject({ phase: 'crossing', span: 14, startRoll: 4 })
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: true }).next).toMatch(/6° more/)
    expect(step(sweep, 24, true).sweep.phase).toBe('complete')
  })
  it('does not complete on rotation that never showed the node', () => {
    let sweep = step(emptyLinkedSweep(), 90, false).sweep
    sweep = step(sweep, 60, false).sweep
    expect(sweep.phase).toBe('find-edge')
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: false }).next).toMatch(
      /comes into the image/,
    )
  })
  it('ignores frames without tissue contact instead of restarting', () => {
    let sweep = step(emptyLinkedSweep(), 10, true).sweep
    const lost = step(sweep, 40, true, 0.2)
    expect(lost.event).toBe('no-contact')
    expect(lost.sweep).toMatchObject({ span: 0, samples: 1 })
    sweep = lost.sweep
    expect(describeLinkedSweep({ ...base, sweep, contact: 0.2, targetVisible: false }).state).toBe(
      'no-window',
    )
  })
})

describe('advance and withdraw', () => {
  const at = (targetLateral: number | null, extra: Partial<typeof base> = {}) =>
    describeAlongAirway({ ...base, ...extra, targetLateral })
  it('says where the node is across the image, and stops at the middle', () => {
    expect(at(0.63).state).toBe('right')
    expect(at(0.38).state).toBe('left')
    expect(at(0.5).state).toBe('centre')
    expect(at(0.5 + LINKED_ALONG_AIRWAY.centreHalfWidth).state).toBe('centre')
    expect(at(0.5 + LINKED_ALONG_AIRWAY.centreHalfWidth + 0.01).state).toBe('right')
    expect(at(0.5).next).toMatch(/Continue with this image/)
  })
  it('never says which way to move: that is the task', () => {
    for (const lateral of [0.3, 0.4, 0.6, 0.7]) {
      const status = at(lateral)
      expect(status.heading).toMatch(/^Node (left|right) of the middle$/)
      expect(status.next).toBe(
        'Advance or withdraw with the Scope position slider until the node sits in the middle of the image.',
      )
    }
  })
  it('reports a node that has left the image and a lost window', () => {
    expect(at(null).state).toBe('out')
    expect(at(null).next).toMatch(/the other way along the airway/)
    expect(at(0.5, { contact: 0.2 }).state).toBe('no-window')
    expect(at(0.5, { frameReady: false }).state).toBe('pending')
  })
})

describe('look along the airway, then bring back the image', () => {
  const view = (opticalWallMm: number | null, contact: number, airwayViewed: boolean) =>
    describeAirwayView({ opticalWallMm, contact, airwayViewed, frameReady: true })
  it('asks for the airway view first, even with the tip already on the wall', () => {
    expect(view(9, 0.45, false).state).toBe('find-airway')
    expect(view(4, 1, false).state).toBe('find-airway')
    expect(view(4, 1, false).heading).toBe('Flex the tip down')
  })
  it('says what the airway view costs, then asks for the wall', () => {
    const airway = view(20, 0.04, true)
    expect(airway.state).toBe('airway')
    expect(airway.next).toMatch(/no ultrasound image/)
    expect(view(9, 0.45, true).state).toBe('find-wall')
    expect(view(4, 1, true).state).toBe('wall')
    expect(view(4, 1, true).next).toMatch(/Continue with this image/)
  })
  it('does not count deep downward flexion as the wall, whatever the contact index says', () => {
    expect(view(21, 1, true).state).toBe('airway')
    expect(describeAirwayView({ opticalWallMm: 4, contact: 1, airwayViewed: true, frameReady: false }).state).toBe('pending')
  })
})
