/** @jest-environment node */
import * as THREE from 'three'
import { TissueVolume, geometryFromData, serializeGeometry } from './tissue'
import { createLesionCollider } from '@/lib/airway-anatomy/pathology/geometry'
import { initialInstrumentState, instrumentTransition, type InstrumentContact } from './instruments'

function ball() {
  const g = new THREE.SphereGeometry(6, 32, 24)
  const colors = new Float32Array(g.getAttribute('position').count * 3).fill(0.4)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}
function closed(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position'),
    edges = new Map<string, number>()
  const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map((n) => n.toFixed(4)).join(',')
  for (let i = 0; i < (g.index?.count ?? p.count); i += 3)
    for (let j = 0; j < 3; j++) {
      const a = key(g.index?.getX(i + j) ?? i + j),
        b = key(g.index?.getX(i + ((j + 1) % 3)) ?? i + ((j + 1) % 3))
      if (a === b) continue
      const k = [a, b].sort().join('|')
      edges.set(k, (edges.get(k) ?? 0) + 1)
    }
  return [...edges.values()].every((n) => n === 2)
}
const contact: InstrumentContact = {
  origin: [0, 0, 0],
  tip: [0, 0, 10],
  target: [0, 0, 10],
  kind: 'tumor',
  touching: true,
  wallClearance: 7,
  maximumExtension: 10.3,
  stalkInLoop: true,
  stalk: [0, 0, 10],
  inward: [0, 1, 0],
}

describe('editable solid tissue', () => {
  test('a local bite makes a closed cavity and changes the collision surface', () => {
    const volume = new TissueVolume(serializeGeometry(ball()))
    const result = volume.cut({ kind: 'bite', center: [0, 0, 5.5], radius: 2 })
    const g = geometryFromData(result),
      collider = createLesionCollider(g)
    expect(result.remainingFraction).toBeGreaterThan(0.9)
    expect(result.remainingFraction).toBeLessThan(1)
    expect(closed(g)).toBe(true)
    expect(collider.clearance([0, 0, 5.5])).toBeGreaterThan(0)
    expect(collider.clearance([0, 0, 0])).toBeLessThan(0)
    const repeated = volume.cut({ kind: 'bite', center: [0, 0, 5.5], radius: 2 })
    expect(repeated.removedMm3).toBe(0)
  })
  test('snare caps the stalk and never restores removed tissue', () => {
    const volume = new TissueVolume(serializeGeometry(ball()))
    const result = volume.cut({ kind: 'snare', origin: [0, 0, 0], normal: [0, 0, 1] })
    expect(result.remainingFraction).toBeGreaterThan(0.4)
    expect(result.remainingFraction).toBeLessThan(0.55)
    const g = geometryFromData(result)
    expect(closed(g)).toBe(true)
    expect(g.boundingBox!.max.z).toBeLessThanOrEqual(0.001)
    expect(createLesionCollider(g).clearance([0, 0, -2])).toBeLessThan(0)
    const empty = volume.cut({ kind: 'bite', center: [0, 0, 0], radius: 30 })
    expect(empty.remainingFraction).toBe(0)
    expect(empty.positions.length).toBe(0)
    expect(volume.cut({ kind: 'bite', center: [0, 0, 0], radius: 2 }).positions.length).toBe(0)
  })
})
describe('instrument actions', () => {
  test('forceps needs open jaws and actual tumor contact; retrieval records tissue', () => {
    let state = { ...initialInstrumentState(), extension: 10, open: true }
    expect(
      instrumentTransition(state, { type: 'close' }, { ...contact, kind: 'wall' }).cut,
    ).toBeUndefined()
    expect(
      instrumentTransition(state, { type: 'close' }, { ...contact, touching: false }).cut,
    ).toBeUndefined()
    expect(instrumentTransition(state, { type: 'close' }, contact).cut?.kind).toBe('bite')
    expect(state.specimens).toHaveLength(0)
    state = instrumentTransition(
      state,
      { type: 'cut-complete', instrument: 'forceps', removedMm3: 8 },
      contact,
    ).state
    expect(state.pending).not.toBeNull()
    state = instrumentTransition(state, { type: 'retrieve' }, contact).state
    expect(state.specimens).toHaveLength(1)
    expect(state.extension).toBe(0)
  })
  test('freezing alone never removes tissue; extraction needs maintained adhesion and en bloc retrieval', () => {
    let state = { ...initialInstrumentState('cryoprobe'), extension: 10 }
    expect(instrumentTransition(state, { type: 'extract' }, contact).cut).toBeUndefined()
    const freeze = instrumentTransition(state, { type: 'freeze' }, contact)
    expect(freeze.cut).toBeUndefined()
    state = freeze.state
    expect(instrumentTransition(state, { type: 'retrieve' }, contact).state.unsafe).toBe(true)
    for (let i = 0; i < 30; i++)
      state = instrumentTransition(state, { type: 'tick', dt: 0.1 }, contact).state
    expect(instrumentTransition(state, { type: 'extract' }, contact).cut?.kind).toBe('bite')
    state = instrumentTransition(
      state,
      { type: 'cut-complete', instrument: 'cryoprobe', removedMm3: 40 },
      contact,
    ).state
    state = instrumentTransition(state, { type: 'retrieve' }, contact).state
    expect(state.outside).toBe(true)
    expect(state.specimens).toHaveLength(0)
    expect(instrumentTransition(state, { type: 'reenter' }, contact).state.unsafe).toBe(true)
    state = instrumentTransition(state, { type: 'transfer' }, contact).state
    expect(state.specimens).toHaveLength(1)
  })
  test('snare checks loop capture, oxygen threshold and return electrode', () => {
    let state = { ...initialInstrumentState('snare'), extension: 12, open: true }
    state = instrumentTransition(state, { type: 'close' }, contact).state
    expect(state.loopCaptured).toBe(true)
    expect(instrumentTransition(state, { type: 'energize' }, contact).cut).toBeUndefined()
    state = { ...state, returnElectrode: true, oxygen: 0.4 }
    expect(instrumentTransition(state, { type: 'energize' }, contact).cut).toBeUndefined()
    expect(
      instrumentTransition({ ...state, oxygen: 0.39 }, { type: 'energize' }, contact).cut?.kind,
    ).toBe('snare')
    expect(
      instrumentTransition(
        { ...state, oxygen: 0.3, loopCaptured: false },
        { type: 'energize' },
        contact,
      ).cut,
    ).toBeUndefined()
  })
  test('suction changes visible blood without stopping its source', () => {
    const state = { ...initialInstrumentState(), blood: 0.8, bleedingRate: 0.01, suction: true }
    const next = instrumentTransition(state, { type: 'tick', dt: 0.1 }, contact).state
    expect(next.blood).toBeLessThan(state.blood)
    expect(next.bleedingRate).toBe(state.bleedingRate)
    expect(
      instrumentTransition({ ...state, extension: 10 }, { type: 'suction', value: true }, contact)
        .state.unsafe,
    ).toBe(true)
    expect(
      instrumentTransition({ ...state, extension: 10, open: true }, { type: 'close' }, contact).cut,
    ).toBeUndefined()
  })
})

describe('rejected actions and recovery', () => {
  test('a shallow tumor allows a smaller forceps bite while normal wall remains protected', () => {
    const state = { ...initialInstrumentState(), extension: 10, open: true }
    const shallow = { ...contact, wallClearance: 1.2 }
    const response = instrumentTransition(state, { type: 'close' }, shallow)
    expect(response.cut?.kind).toBe('bite')
    if (response.cut?.kind === 'bite') expect(response.cut.radius).toBeCloseTo(0.8)
    expect(
      instrumentTransition(state, { type: 'close' }, { ...shallow, kind: 'wall' }).cut,
    ).toBeUndefined()
  })
  test('loss of cryoprobe contact releases adhesion without removing tissue', () => {
    const state = {
      ...initialInstrumentState('cryoprobe'),
      extension: 10,
      freezing: true,
      adhesion: 0.8,
    }
    const response = instrumentTransition(
      state,
      { type: 'tick', dt: 0.1 },
      { ...contact, touching: false },
    )
    expect(response.state.adhesion).toBe(0)
    expect(response.state.freezing).toBe(false)
    expect(response.cut).toBeUndefined()
    expect(
      instrumentTransition(initialInstrumentState(), { type: 'freeze' }, contact).cut,
    ).toBeUndefined()
    expect(
      instrumentTransition({ ...state, freezing: false }, { type: 'open' }, contact).state.unsafe,
    ).toBe(true)
  })
  test('an empty cut cannot create a phantom specimen and an uncaptured snare cannot resect', () => {
    let state = { ...initialInstrumentState(), extension: 10 }
    state = instrumentTransition(
      state,
      { type: 'cut-complete', instrument: 'forceps', removedMm3: 0 },
      contact,
    ).state
    state = instrumentTransition(state, { type: 'retrieve' }, contact).state
    expect(state.specimens).toHaveLength(0)
    const snare = instrumentTransition(
      { ...initialInstrumentState('snare'), extension: 12, open: true },
      { type: 'close' },
      { ...contact, stalkInLoop: false },
    ).state
    expect(snare.loopCaptured).toBe(false)
    expect(
      instrumentTransition({ ...snare, returnElectrode: true }, { type: 'energize' }, contact).cut,
    ).toBeUndefined()
  })
  test('an empty residual is a valid renderable geometry with finite sphere bounds', () => {
    const geometry = geometryFromData({
      positions: new Float32Array(0),
      colors: new Float32Array(0),
      indices: new Uint32Array(0),
    })
    expect(geometry.boundingSphere!.radius).toBe(0)
    expect(geometry.boundingSphere!.center.toArray().every(Number.isFinite)).toBe(true)
  })
})
