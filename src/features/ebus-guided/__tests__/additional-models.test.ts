import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  MODEL_GEOMETRY,
  MODEL_PACKAGES,
  MODEL_REVISION,
  MODEL_STEPS,
  initialModelState,
  modelReducer,
  modelComplete,
  modelFrameId,
  needleGeometry,
  phantomSections,
  measurePhantom,
  routeDefinition,
  routeSupported,
  type ModelState,
  type NeedleState,
  type MeasurementState,
  type RouteState,
  type ModelAction,
} from '@/lib/ebus-model-contract'
import { EMPTY_EBUS_OBSERVATION, isEbusConfig, isEbusObservation } from '@/lib/ebus-guided-bridge'
import { LESSONS } from '../content/curriculum'
import { labGoalMet } from '../content/types'
const apply = (s: ModelState, ...actions: ModelAction[]) => actions.reduce(modelReducer, s)
const readyNeedle = () =>
  apply(
    initialModelState('needle'),
    { type: 'sheath', value: 1 },
    { type: 'secure' },
    { type: 'extend' },
  ) as NeedleState
it('links handle travel, distal tip and finite imaging-plane visibility, with live and resistance guards', () => {
  const s = readyNeedle()
  expect(needleGeometry(s).tipVisible).toBe(true)
  const lost = modelReducer(s, { type: 'lost' }) as NeedleState
  expect(needleGeometry(lost).tip).toEqual(needleGeometry(s).tip)
  expect(needleGeometry(lost).tipVisible).toBe(false)
  expect(modelReducer(lost, { type: 'extend' })).toMatchObject({
    extension: s.extension,
    steps: s.steps,
  })
  const frozen = modelReducer(s, { type: 'live' }) as NeedleState
  expect(frozen.held?.extension).toBe(s.extension)
  expect(modelReducer(frozen, { type: 'extend' })).toMatchObject({ extension: s.extension })
  expect(modelReducer({ ...s, contact: false }, { type: 'extend' })).toMatchObject({
    extension: s.extension,
  })
  expect(modelReducer({ ...s, resistance: true }, { type: 'extend' })).toMatchObject({
    extension: s.extension,
  })
  expect(modelComplete(lost)).toBe(false)
})
it('blocks exposed removal and requires independent lost-tip and resistance responses before completion', () => {
  let s: ModelState = readyNeedle()
  const unsafe = modelReducer(s, { type: 'remove' }) as NeedleState
  expect(unsafe.removed).toBe(false)
  expect(unsafe.notice).toMatch(/Do not remove/)
  s = apply(
    s,
    { type: 'lost' },
    { type: 'stop' },
    { type: 'restore' },
    { type: 'resistance' },
    { type: 'stop' },
  )
  expect(modelComplete(s)).toBe(false)
  s = apply(s, { type: 'retract' }, { type: 'remove' })
  expect(modelComplete(s)).toBe(true)
  expect(modelComplete(modelReducer(s, { type: 'reset' }))).toBe(false)
})
it('keeps an uncoupled window absent regardless of gain and requires every contact comparison', () => {
  let s = apply(initialModelState('contact'), { type: 'gain', value: 100 }, { type: 'inspect' })
  expect(s).toMatchObject({ mode: 'gap' })
  expect(modelComplete(s)).toBe(false)
  for (const mode of ['direct', 'balloon', 'bubble', 'shadow'])
    s = apply(s, { type: 'mode', value: mode }, { type: 'inspect' })
  expect(modelComplete(s)).toBe(true)
})
it('computes sections of fixed phantoms with empty margins, plane dependence, and distinct adjacent objects', () => {
  const unchanged = JSON.stringify(MODEL_GEOMETRY.phantoms)
  expect(phantomSections('sphere', 0)[0]).toMatchObject({ rx: 10, ry: 10 })
  expect(phantomSections('sphere', 6)[0].rx).toBeCloseTo(8)
  expect(phantomSections('sphere', 12)).toHaveLength(0)
  const pair = phantomSections('adjacent', 0)
  expect(pair).toHaveLength(2)
  expect(pair[0].x + pair[0].rx).toBeLessThan(pair[1].x - pair[1].rx)
  expect(JSON.stringify(MODEL_GEOMETRY.phantoms)).toBe(unchanged)
})
it('rejects separated, wrong-axis, off-center and unfrozen calipers, and records actual phantom coordinates', () => {
  let s = {
    ...initialModelState('measurement'),
    shape: 'ellipsoid',
    offset: 0,
    frozen: true,
    station: 'Phantom station 7',
    calipers: [
      [0, 14],
      [0, 30],
    ],
  } as MeasurementState
  expect(measurePhantom(s)).toMatchObject({ valid: true, value: 16 })
  for (const patch of [
    { frozen: false },
    { offset: 6 },
    { axis: 'long' },
    {
      calipers: [
        [-16, 22],
        [16, 22],
      ],
    },
    {
      calipers: [
        [-20, 3],
        [24, 40],
      ],
    },
  ])
    expect(measurePhantom({ ...s, ...patch } as MeasurementState).valid).toBe(false)
  s = modelReducer(s, { type: 'record' }) as MeasurementState
  expect(s.record).toMatchObject({ value: 16, label: expect.stringContaining('Phantom station 7') })
  expect(modelComplete(s)).toBe(false)
  for (const shape of ['sphere', 'ellipsoid', 'adjacent', 'lobulated']) {
    s = modelReducer(s, { type: 'shape', value: shape }) as MeasurementState
    // Merely jumping to both endpoints does not demonstrate an intervening sweep.
    s = modelReducer(s, { type: 'offset', value: 12 }) as MeasurementState
    expect(s.steps.includes(shape + '-sweep')).toBe(false)
    for (let offset = -12; offset <= 12; offset += 2)
      s = modelReducer(s, { type: 'offset', value: offset }) as MeasurementState
    expect(s.steps).toContain(shape + '-sweep')
  }
  s = apply(
    s,
    { type: 'shape', value: 'ellipsoid' },
    { type: 'offset', value: 0 },
    { type: 'freeze' },
    { type: 'caliper', value: [0, 14] },
    { type: 'caliper', value: [0, 30] },
    { type: 'station', value: 'Phantom station 7' },
    { type: 'record' },
  ) as MeasurementState
  expect(modelComplete(s)).toBe(true)
  expect(modelComplete(modelReducer(s, { type: 'freeze' }))).toBe(false)
})
it('retains the same target across registered route views and represents unsupported windows explicitly', () => {
  let s = initialModelState('routes') as RouteState
  for (const station of ['4L', '7']) {
    s = modelReducer(s, { type: 'station', value: station }) as RouteState
    const target = routeDefinition(s)?.target
    for (const route of ['airway', 'esophagus']) {
      s = apply(s, { type: 'route', value: route }, { type: 'inspect' }) as RouteState
      expect(routeDefinition(s)?.target).toEqual(target)
      expect(routeSupported(s)).toBe(true)
    }
  }
  s = apply(s, { type: 'station', value: '8' }, { type: 'inspect' }) as RouteState
  expect(modelComplete(s)).toBe(false)
  s = apply(s, { type: 'station', value: '11R' }, { type: 'inspect' }) as RouteState
  expect(routeSupported(s)).toBe(false)
  expect(modelComplete(s)).toBe(true)
  expect(routeSupported({ ...s, station: '9' })).toBe(false)
  expect(routeSupported({ ...s, station: '8', route: 'airway' })).toBe(false)
})
it('requires complete, current, unannotated model evidence and accepts not-ready clearing observations', () => {
  for (const pkg of MODEL_PACKAGES) {
    const lab = LESSONS.find((l) => l.lab?.modelPackage === pkg)!.lab!
    const observation = {
      ...EMPTY_EBUS_OBSERVATION,
      ready: true,
      frameReady: true,
      actionCount: 9,
      model: {
        package: pkg,
        revision: MODEL_REVISION,
        frameId: modelFrameId(initialModelState(pkg)),
        steps: [...MODEL_STEPS[pkg]],
        complete: true,
        annotations: false,
      },
    }
    expect(isEbusObservation(observation)).toBe(true)
    expect(labGoalMet(lab, observation)).toBe(true)
    for (const patch of [
      { complete: false },
      { steps: [] },
      { annotations: true },
      { frameId: '' },
      { revision: 'old' },
    ])
      expect(labGoalMet(lab, { ...observation, model: { ...observation.model, ...patch } })).toBe(
        false,
      )
    expect(
      isEbusObservation({
        ...observation,
        ready: false,
        frameReady: false,
        model: { ...observation.model, frameId: '', complete: false },
      }),
    ).toBe(true)
    expect(
      isEbusObservation({ ...observation, model: { ...observation.model, steps: ['invented'] } }),
    ).toBe(false)
    expect(
      isEbusConfig({
        sessionId: 'test',
        kind: 'model',
        modelPackage: pkg,
        presetKey: pkg,
        controls: [],
        locked: false,
        reveal: false,
        view: 'sector',
        initialRoll: 0,
        initialDepth: 40,
        initialGain: 0,
      }),
    ).toBe(true)
  }
})
it('ships optimized semantic assets matching their analytic and dependency validation', () => {
  const dir = 'EBUS-course/apps/web/public/simulator/case-001/models/guided-v2/'
  const manifest = JSON.parse(readFileSync(dir + 'asset-manifest.json', 'utf8'))
  const proof = JSON.parse(readFileSync(dir + 'geometry-validation.json', 'utf8'))
  expect(manifest.assets).toHaveLength(4)
  for (const a of manifest.assets) {
    const raw = readFileSync(dir + a.path)
    expect(createHash('sha256').update(raw).digest('hex')).toBe(a.sha256)
    expect(proof.assets.find((p: { path: string }) => p.path === a.path).sha256).toBe(a.sha256)
    const gltf = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString())
    for (const o of a.objects)
      expect(gltf.nodes.some((n: { name: string }) => n.name === o.id)).toBe(true)
  }
  expect(
    proof.assets.find((a: { path: string }) => a.path === 'measurement-phantoms.glb')
      .maxEllipsoidEquationResidual,
  ).toBeLessThan(0.00001)
  expect(proof.totalBytes).toBeLessThan(500000)
})
