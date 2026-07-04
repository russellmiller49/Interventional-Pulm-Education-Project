import {
  ACTIVE_PROFILE_STORAGE_KEY,
  DEPTH_FULL_SCALE_MM,
  GamepadScopeSource,
  LineSplitter,
  PROFILES_STORAGE_KEY,
  RollUnwrapper,
  ScopeDeltaTracker,
  VirtualScopeSource,
  decodeScopeTrackerGamepad,
  depthAxisToMm,
  depthMmToAxis,
  encodeScopeTrackerCommand,
  findScopeTrackerGamepad,
  isScopeTrackerGamepad,
  loadActiveScopeTrackerProfile,
  loadScopeTrackerProfiles,
  normalizeScopeTrackerProfile,
  parseScopeTrackerMessage,
  saveScopeTrackerProfiles,
  scheduleInputFrame,
  shapeFlexion,
  startInputFrameLoop,
  wrapAngleRad,
} from './core'
import type { GamepadLike, ScopeInputFrame } from './core'

const TRACKER_ID = 'IP ScopeTracker v4 (Vendor: 2e8a Product: 000a)'

function makePad(overrides: Partial<GamepadLike> = {}): GamepadLike {
  return {
    id: TRACKER_ID,
    index: 0,
    connected: true,
    axes: [0, -1, 0, 1],
    buttons: Array.from({ length: 8 }, () => ({ pressed: false })),
    ...overrides,
  }
}

function padWith(options: {
  flexion?: number
  depthMm?: number
  rollRad?: number
  pressed?: number[]
  id?: string
}): GamepadLike {
  const pressed = new Set(options.pressed ?? [])
  return makePad({
    id: options.id ?? TRACKER_ID,
    axes: [
      options.flexion ?? 0,
      depthMmToAxis(options.depthMm ?? 0),
      Math.sin(options.rollRad ?? 0),
      Math.cos(options.rollRad ?? 0),
    ],
    buttons: Array.from({ length: 8 }, (_, index) => ({ pressed: pressed.has(index) })),
  })
}

function makeFrame(overrides: Partial<ScopeInputFrame> = {}): ScopeInputFrame {
  const buttons = { a: false, b: false, c: false, d: false, calibrate: false }
  return {
    timestampMs: 0,
    deviceId: TRACKER_ID,
    flexion: 0,
    depthMm: 0,
    rollRad: 0,
    rollContinuousRad: 0,
    rollValid: true,
    buttons: { ...buttons },
    pressed: { ...buttons },
    released: { ...buttons },
    status: { photogate: true, lowQuality: false, fault: false },
    raw: { axes: [0, -1, 0, 1], buttons: [] },
    ...overrides,
  }
}

describe('decode', () => {
  it('maps the depth axis across its full scale', () => {
    expect(depthAxisToMm(-1)).toBe(0)
    expect(depthAxisToMm(1)).toBe(DEPTH_FULL_SCALE_MM)
    expect(depthAxisToMm(0)).toBe(DEPTH_FULL_SCALE_MM / 2)
    expect(depthMmToAxis(depthAxisToMm(0.25))).toBeCloseTo(0.25, 10)
  })

  it('decodes flexion, depth, and roll from a report', () => {
    const sample = decodeScopeTrackerGamepad(
      makePad({ axes: [0.5, 0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)] }),
      123,
    )
    expect(sample.flexion).toBe(0.5)
    expect(sample.depthMm).toBe(DEPTH_FULL_SCALE_MM / 2)
    expect(sample.rollRad).toBeCloseTo(Math.PI / 3, 10)
    expect(sample.rollValid).toBe(true)
    expect(sample.timestampMs).toBe(123)
  })

  it('clamps out-of-range axes and pads missing buttons', () => {
    const sample = decodeScopeTrackerGamepad(
      makePad({ axes: [1.5, 2, 0, 1], buttons: [{ pressed: true }] }),
      0,
    )
    expect(sample.flexion).toBe(1)
    expect(sample.depthMm).toBe(DEPTH_FULL_SCALE_MM)
    expect(sample.buttons).toEqual([true, false, false, false, false, false, false, false])
  })

  it('flags roll invalid when the sin/cos magnitude is too small', () => {
    const sample = decodeScopeTrackerGamepad(makePad({ axes: [0, 0, 0.1, 0.1] }), 0)
    expect(sample.rollValid).toBe(false)
    expect(sample.rollRad).toBe(0)
  })
})

describe('detect', () => {
  it('matches on the ScopeTracker product string', () => {
    expect(isScopeTrackerGamepad(makePad())).toBe(true)
    expect(isScopeTrackerGamepad(makePad({ id: 'scope_tracker rev b' }))).toBe(true)
  })

  it('rejects other controllers and disconnected pads', () => {
    expect(
      isScopeTrackerGamepad(
        makePad({ id: 'Xbox Wireless Controller (Vendor: 045e Product: 02fd)' }),
      ),
    ).toBe(false)
    expect(isScopeTrackerGamepad(makePad({ connected: false }))).toBe(false)
    expect(isScopeTrackerGamepad(null)).toBe(false)
  })

  it('falls back to the Raspberry Pi vendor id with plausible axis/button counts', () => {
    const pico = makePad({ id: 'Pico Board (Vendor: 2e8a Product: 000a)' })
    expect(isScopeTrackerGamepad(pico)).toBe(true)
    expect(isScopeTrackerGamepad({ ...pico, axes: [0, 0] })).toBe(false)
  })

  it('prefers an exact profile-pinned id over pattern matches', () => {
    const generic = makePad()
    const pinned = makePad({ id: 'My Custom Board (Vendor: 1234 Product: 5678)', index: 1 })
    expect(findScopeTrackerGamepad([generic, pinned], pinned.id)).toBe(pinned)
    expect(findScopeTrackerGamepad([generic, pinned], null)).toBe(generic)
    expect(findScopeTrackerGamepad([null, undefined])).toBeNull()
  })
})

describe('RollUnwrapper', () => {
  it('accumulates continuous roll across wrap boundaries', () => {
    const unwrapper = new RollUnwrapper()
    let physical = 0
    for (let step = 0; step < 100; step += 1) {
      physical += 0.25
      unwrapper.update(wrapAngleRad(physical))
    }
    expect(unwrapper.value).toBeCloseTo(physical, 8)
  })

  it('tracks negative rotation and resets cleanly', () => {
    const unwrapper = new RollUnwrapper()
    let physical = 0
    for (let step = 0; step < 60; step += 1) {
      physical -= 0.3
      unwrapper.update(wrapAngleRad(physical))
    }
    expect(unwrapper.value).toBeCloseTo(physical, 8)
    unwrapper.reset()
    expect(unwrapper.update(0.5)).toBeCloseTo(0.5, 10)
  })
})

describe('shapeFlexion', () => {
  const shaping = { invert: false, deadzone: 0.1, trim: 0, expo: 0 }

  it('zeroes inside the deadzone and rescales outside it', () => {
    expect(shapeFlexion(0.05, shaping)).toBe(0)
    expect(shapeFlexion(1, shaping)).toBeCloseTo(1, 10)
    expect(shapeFlexion(0.55, shaping)).toBeCloseTo(0.5, 10)
    expect(shapeFlexion(-0.55, shaping)).toBeCloseTo(-0.5, 10)
  })

  it('applies trim before the deadzone', () => {
    expect(shapeFlexion(0.2, { ...shaping, trim: 0.2 })).toBe(0)
  })

  it('applies expo and invert', () => {
    expect(shapeFlexion(0.5, { ...shaping, deadzone: 0, expo: 1 })).toBeCloseTo(0.125, 10)
    expect(shapeFlexion(1, { ...shaping, deadzone: 0, expo: 1 })).toBeCloseTo(1, 10)
    expect(shapeFlexion(0.5, { ...shaping, deadzone: 0, invert: true })).toBeCloseTo(-0.5, 10)
  })
})

describe('GamepadScopeSource', () => {
  it('returns null and reports disconnected when no tracker is present', () => {
    const source = new GamepadScopeSource({ getGamepads: () => [] })
    expect(source.sample(0)).toBeNull()
    expect(source.connected).toBe(false)
    expect(source.deviceId).toBeNull()
  })

  it('produces button edges exactly once per press and release', () => {
    let pads: GamepadLike[] = [padWith({ pressed: [] })]
    const source = new GamepadScopeSource({ getGamepads: () => pads })
    source.sample(0)

    pads = [padWith({ pressed: [0] })]
    let frame = source.sample(16)
    expect(frame?.buttons.a).toBe(true)
    expect(frame?.pressed.a).toBe(true)

    frame = source.sample(32)
    expect(frame?.buttons.a).toBe(true)
    expect(frame?.pressed.a).toBe(false)

    pads = [padWith({ pressed: [] })]
    frame = source.sample(48)
    expect(frame?.released.a).toBe(true)
    expect(frame?.pressed.a).toBe(false)
  })

  it('maps status flags from buttons 5-7', () => {
    const source = new GamepadScopeSource({
      getGamepads: () => [padWith({ pressed: [5, 6] })],
    })
    const frame = source.sample(0)
    expect(frame?.status).toEqual({ photogate: true, lowQuality: true, fault: false })
  })

  it('honors the swapAB profile option', () => {
    const profile = normalizeScopeTrackerProfile({ buttons: { swapAB: true } })
    const source = new GamepadScopeSource({
      profile,
      getGamepads: () => [padWith({ pressed: [0] })],
    })
    const frame = source.sample(0)
    expect(frame?.buttons.b).toBe(true)
    expect(frame?.buttons.a).toBe(false)
  })

  it('holds depth through sub-noise-gate jitter', () => {
    let depthMm = 100
    const source = new GamepadScopeSource({
      profile: normalizeScopeTrackerProfile({ depth: { noiseGateMm: 0.5 } }),
      getGamepads: () => [padWith({ depthMm })],
    })
    expect(source.sample(0)?.depthMm).toBeCloseTo(100, 3)
    depthMm = 100.2
    expect(source.sample(16)?.depthMm).toBeCloseTo(100, 3)
    depthMm = 101
    expect(source.sample(32)?.depthMm).toBeCloseTo(101, 3)
  })

  it('holds the last good roll while the sin/cos pair is invalid', () => {
    let axes: number[] = [0, -1, Math.sin(1), Math.cos(1)]
    const source = new GamepadScopeSource({
      getGamepads: () => [makePad({ axes })],
    })
    expect(source.sample(0)?.rollContinuousRad).toBeCloseTo(1, 8)
    axes = [0, -1, 0, 0]
    const frame = source.sample(16)
    expect(frame?.rollValid).toBe(false)
    expect(frame?.rollContinuousRad).toBeCloseTo(1, 8)
  })

  it('unwraps roll continuously and resets on device change', () => {
    let rollRad = 0
    let id = TRACKER_ID
    const source = new GamepadScopeSource({
      getGamepads: () => [padWith({ rollRad, id })],
    })
    for (let step = 0; step < 50; step += 1) {
      rollRad += 0.3
      source.sample(step)
    }
    expect(source.sample(999)?.rollContinuousRad).toBeCloseTo(rollRad, 6)

    id = 'Other ScopeTracker (Vendor: 2e8a Product: 000b)'
    rollRad = 0.4
    const frame = source.sample(1000)
    expect(frame?.rollContinuousRad).toBeCloseTo(0.4, 8)
  })

  it('inverts roll when the profile asks for it', () => {
    const source = new GamepadScopeSource({
      profile: normalizeScopeTrackerProfile({ roll: { invert: true } }),
      getGamepads: () => [padWith({ rollRad: 0.5 })],
    })
    expect(source.sample(0)?.rollRad).toBeCloseTo(-0.5, 10)
  })

  it('resets to disconnected when the pad goes away', () => {
    let pads: Array<GamepadLike | null> = [padWith({ depthMm: 50 })]
    const source = new GamepadScopeSource({ getGamepads: () => pads })
    expect(source.sample(0)).not.toBeNull()
    expect(source.connected).toBe(true)
    pads = [null]
    expect(source.sample(16)).toBeNull()
    expect(source.connected).toBe(false)
  })
})

describe('ScopeDeltaTracker', () => {
  const profile = normalizeScopeTrackerProfile()

  it('emits zero deltas on the first frame and after device changes', () => {
    const tracker = new ScopeDeltaTracker()
    const first = tracker.update(makeFrame({ depthMm: 100 }), profile)
    expect(first).toMatchObject({ dDepthMm: 0, dRollRad: 0, resynced: true })
    const swapped = tracker.update(makeFrame({ depthMm: 300, deviceId: 'another one' }), profile)
    expect(swapped).toMatchObject({ dDepthMm: 0, resynced: true })
  })

  it('computes gained deltas between frames', () => {
    const tracker = new ScopeDeltaTracker()
    tracker.update(makeFrame({ timestampMs: 0, depthMm: 100, rollContinuousRad: 1 }), profile)
    const gained = normalizeScopeTrackerProfile({
      depth: { gain: 2, invert: true },
      roll: { gain: 0.5 },
    })
    const deltas = tracker.update(
      makeFrame({ timestampMs: 16, depthMm: 103, rollContinuousRad: 1.2 }),
      gained,
    )
    expect(deltas.dtMs).toBe(16)
    expect(deltas.dDepthMm).toBeCloseTo(-6, 10)
    expect(deltas.dRollRad).toBeCloseTo(0.1, 10)
    expect(deltas.resynced).toBe(false)
  })

  it('suppresses re-zero style jumps', () => {
    const tracker = new ScopeDeltaTracker()
    tracker.update(makeFrame({ depthMm: 500, rollContinuousRad: 10 }), profile)
    const deltas = tracker.update(makeFrame({ depthMm: 0, rollContinuousRad: 0 }), profile)
    expect(deltas.dDepthMm).toBe(0)
    expect(deltas.dRollRad).toBe(0)
    expect(deltas.resynced).toBe(true)
  })
})

describe('profiles', () => {
  beforeEach(() => {
    window.localStorage.removeItem(PROFILES_STORAGE_KEY)
    window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)
  })

  it('returns a default profile when storage is empty or unavailable', () => {
    expect(loadActiveScopeTrackerProfile().id).toBe('default')
    expect(loadActiveScopeTrackerProfile(null).id).toBe('default')
  })

  it('round-trips saved profiles and the active selection', () => {
    const custom = normalizeScopeTrackerProfile({
      id: 'lab-kit',
      name: 'Lab kit',
      depth: { gain: 1.5 },
    })
    saveScopeTrackerProfiles({
      profiles: [normalizeScopeTrackerProfile(), custom],
      activeId: 'lab-kit',
    })
    const active = loadActiveScopeTrackerProfile()
    expect(active.name).toBe('Lab kit')
    expect(active.depth.gain).toBe(1.5)
  })

  it('falls back to the first profile when the active id is stale', () => {
    saveScopeTrackerProfiles({
      profiles: [normalizeScopeTrackerProfile({ id: 'only' })],
      activeId: 'missing',
    })
    expect(loadScopeTrackerProfiles().activeId).toBe('only')
  })

  it('normalizes garbage into safe values', () => {
    const profile = normalizeScopeTrackerProfile({
      flexion: { deadzone: 99, trim: 'x', expo: -3 },
      depth: { gain: 0, noiseGateMm: 1000 },
      device: { gamepadId: '' },
    })
    expect(profile.flexion.deadzone).toBe(0.4)
    expect(profile.flexion.trim).toBe(0)
    expect(profile.flexion.expo).toBe(0)
    expect(profile.depth.gain).toBe(0.1)
    expect(profile.depth.noiseGateMm).toBe(5)
    expect(profile.device.gamepadId).toBeNull()
  })
})

describe('serial protocol', () => {
  it('reassembles lines from arbitrary chunks', () => {
    const splitter = new LineSplitter()
    expect(splitter.push('{"t":"sta')).toEqual([])
    expect(splitter.push('te","squal":80}\r\n{"t":"ack","cmd":"zero"}\n{"t":"he')).toEqual([
      '{"t":"state","squal":80}',
      '{"t":"ack","cmd":"zero"}',
    ])
    expect(splitter.push('llo","proto":1}\n')).toEqual(['{"t":"hello","proto":1}'])
    expect(splitter.flush()).toBeNull()
  })

  it('parses known messages and rejects garbage', () => {
    const state = parseScopeTrackerMessage('{"t":"state","depth_mm":142.6,"squal":78}')
    expect(state).toMatchObject({ t: 'state', depth_mm: 142.6, squal: 78 })
    expect(parseScopeTrackerMessage('not json')).toBeNull()
    expect(parseScopeTrackerMessage('{"t":"mystery"}')).toBeNull()
    expect(parseScopeTrackerMessage('{"noType":1}')).toBeNull()
  })

  it('encodes newline-terminated commands', () => {
    expect(encodeScopeTrackerCommand({ cmd: 'zero', what: 'depth' })).toBe(
      '{"cmd":"zero","what":"depth"}\n',
    )
  })
})

describe('frame scheduler', () => {
  it('fires scheduled callbacks and honors cancel', async () => {
    const fired: number[] = []
    scheduleInputFrame((ts) => fired.push(ts))
    const cancel = scheduleInputFrame(() => fired.push(-1))
    cancel()
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(fired.length).toBe(1)
    expect(fired[0]).toBeGreaterThan(0)
  })

  it('loops until stopped', async () => {
    let ticks = 0
    const stop = startInputFrameLoop(() => {
      ticks += 1
    })
    await new Promise((resolve) => setTimeout(resolve, 120))
    stop()
    const settled = ticks
    expect(settled).toBeGreaterThan(1)
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(ticks).toBe(settled)
  })
})

describe('VirtualScopeSource', () => {
  it('runs emulated state through the real decode pipeline', () => {
    const virtual = new VirtualScopeSource({
      profile: normalizeScopeTrackerProfile({ flexion: { deadzone: 0 } }),
    })
    virtual.set({ flexion: 0.5, depthMm: 240, rollRad: 2 })
    const frame = virtual.sample(0)
    expect(frame?.flexion).toBeCloseTo(0.5, 6)
    expect(frame?.depthMm).toBeCloseTo(240, 3)
    expect(frame?.rollRad).toBeCloseTo(2, 6)
    expect(virtual.connected).toBe(true)
  })

  it('keeps continuous roll across the wrap boundary', () => {
    const virtual = new VirtualScopeSource()
    virtual.set({ rollRad: 3.0 })
    virtual.sample(0)
    virtual.set({ rollRad: 3.4 }) // wraps past PI when encoded
    const frame = virtual.sample(16)
    expect(frame?.rollContinuousRad).toBeCloseTo(3.4, 6)
  })

  it('emits a single pressed edge for pulsed buttons', () => {
    const virtual = new VirtualScopeSource()
    virtual.sample(0)
    virtual.pulseButton('a')
    expect(virtual.sample(16)?.pressed.a).toBe(true)
    const after = virtual.sample(32)
    expect(after?.pressed.a).toBe(false)
    expect(after?.released.a).toBe(true)
  })
})
