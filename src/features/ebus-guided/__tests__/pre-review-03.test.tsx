import { act, cleanup, render } from '@testing-library/react'

import { Workbench } from '../components/Workbench'
import { LESSONS } from '../content/curriculum'
import { labGoalMet, labGoalRequirements } from '../content/types'
import {
  EMPTY_EBUS_OBSERVATION,
  isEbusObservation,
  type EbusObservation,
} from '@/lib/ebus-guided-bridge'
import {
  emptyLinkedSweep,
  LINKED_SWEEP_TOLERANCES,
  sampleLinkedSweep,
  stepLinkedSweep,
  type LinkedSweep,
  type LinkedSweepEvent,
} from '@/lib/ebus-linked-contract'

/**
 * EBUS-PRE-REVIEW-03 — model landmarks, camera control and sweep feedback.
 *
 * The rendered geometry (marker layout, framed cameras, arrow legibility) is measured in a real
 * browser and recorded in the handoff; the embedded helpers have their own Vitest coverage. What
 * is held here is the contract: the sweep sampler's behaviour is byte-for-byte what it was, only
 * now with its branch named; the tolerances are the historical numbers; the bridge accepts the
 * payloads it always accepted; and the host still drops demonstration observations on the floor.
 */

/** The sampler exactly as it stood before this batch, kept verbatim as the oracle. */
function legacySampleLinkedSweep(
  previous: LinkedSweep,
  frame: { roll: number; frameId: string; visible: boolean; contact: number },
): LinkedSweep {
  if (!frame.frameId || frame.frameId === previous.lastFrameId) return previous
  if (previous.phase === 'complete') return previous
  const delta = previous.lastRoll === null ? 0 : frame.roll - previous.lastRoll
  if (frame.contact < 0.45)
    return { ...emptyLinkedSweep(), lastFrameId: frame.frameId, lastRoll: frame.roll }
  const continuous = Math.abs(delta) > 0 && Math.abs(delta) <= 12
  const next = { ...previous, lastRoll: frame.roll, lastFrameId: frame.frameId }
  if (previous.phase === 'crossing') {
    if (!continuous || Math.sign(delta) !== previous.direction)
      return {
        ...emptyLinkedSweep(),
        lastRoll: frame.roll,
        lastFrameId: frame.frameId,
        outside: !frame.visible,
      }
    if (!frame.visible)
      return previous.samples >= 5 && previous.span >= 20
        ? { ...next, phase: 'complete' }
        : { ...emptyLinkedSweep(), lastRoll: frame.roll, lastFrameId: frame.frameId, outside: true }
    return {
      ...next,
      samples: previous.samples + 1,
      span: Math.abs(frame.roll - previous.startRoll),
    }
  }
  if (!frame.visible) return { ...next, outside: true }
  if (previous.outside && continuous)
    return {
      ...next,
      phase: 'crossing',
      direction: Math.sign(delta),
      samples: 1,
      startRoll: frame.roll,
    }
  return { ...next, outside: false }
}

type Frame = { roll: number; visible: boolean; contact?: number }
/** In-plane windows measured in the browser on the implementation baseline (handoff, section B). */
const RMS_VISIBLE = (roll: number) => roll >= -71 && roll <= 49
const LMS_VISIBLE = (roll: number) => roll >= -60 && roll <= 89
const run = (frames: Frame[]) => {
  let legacy = emptyLinkedSweep(),
    next = emptyLinkedSweep()
  const events: LinkedSweepEvent[] = []
  frames.forEach((frame, index) => {
    const sample = {
      roll: frame.roll,
      visible: frame.visible,
      contact: frame.contact ?? 1,
      frameId: 'f' + index,
    }
    legacy = legacySampleLinkedSweep(legacy, sample)
    const stepped = stepLinkedSweep(next, sample)
    next = stepped.sweep
    events.push(stepped.event)
    expect(sampleLinkedSweep(next, sample)).toEqual(next) // same frame id again: unchanged
  })
  return { legacy, next, events }
}
const steps = (from: number, to: number, step: number, visible: (r: number) => boolean) => {
  const out: Frame[] = []
  const dir = Math.sign(to - from)
  for (let roll = from; dir > 0 ? roll <= to : roll >= to; roll += dir * step)
    out.push({ roll, visible: visible(roll) })
  return out
}

describe('the sweep sampler is unchanged and its branches are now named', () => {
  it('keeps the historical tolerances', () => {
    expect(LINKED_SWEEP_TOLERANCES).toEqual({
      minContact: 0.45,
      maxStepDeg: 12,
      minSamples: 5,
      minSpanDeg: 20,
    })
  })
  it.each([
    ['J1 outside → cross → exit (RMS)', steps(85, -80, 10, RMS_VISIBLE)],
    ['J2 default start inside the target (LMS)', steps(85, -40, 5, LMS_VISIBLE)],
    [
      'J2b leave on the far side, then return (LMS)',
      [...steps(85, -70, 5, LMS_VISIBLE), ...steps(-65, -20, 5, LMS_VISIBLE)],
    ],
    [
      'J3 reverse partway (RMS)',
      [...steps(85, 20, 10, RMS_VISIBLE), ...steps(30, 40, 10, RMS_VISIBLE)],
    ],
    [
      'J4 jump across the edge (RMS)',
      [
        { roll: 85, visible: false },
        { roll: 30, visible: true },
        { roll: 20, visible: true },
      ],
    ],
    [
      'contact lost mid-pass',
      [...steps(85, 20, 10, RMS_VISIBLE), { roll: 10, visible: true, contact: 0.2 }],
    ],
    [
      'early exit',
      [
        { roll: 60, visible: false },
        { roll: 50, visible: false },
        { roll: 45, visible: true },
        { roll: 40, visible: true },
        { roll: 35, visible: false },
      ],
    ],
    [
      'zero step is ignored by frame identity elsewhere; here a same-roll new frame',
      [
        { roll: 60, visible: false },
        { roll: 50, visible: true },
        { roll: 50, visible: true },
      ],
    ],
  ])('%s: stepLinkedSweep === legacy sampler', (_name, frames) => {
    const { legacy, next } = run(frames)
    expect(next).toEqual(legacy)
  })
  it('names the seven journeys the way the workbench reports them', () => {
    expect(run(steps(85, -80, 10, RMS_VISIBLE)).events.at(-1)).toBe('complete')
    const j2 = run(steps(85, -40, 5, LMS_VISIBLE))
    expect(new Set(j2.events)).toEqual(new Set(['inside']))
    expect(j2.next.phase).toBe('find-edge')
    expect(j2.next.samples).toBe(0)
    const j3 = run([...steps(85, 20, 10, RMS_VISIBLE), ...steps(30, 40, 10, RMS_VISIBLE)])
    expect(j3.events.at(-2)).toBe('reset-reversed')
    const j4 = run([
      { roll: 85, visible: false },
      { roll: 30, visible: true },
      { roll: 20, visible: true },
    ])
    expect(j4.events).toEqual(['outside', 'entered-too-fast', 'inside'])
    const lost = run([...steps(85, 20, 10, RMS_VISIBLE), { roll: 10, visible: true, contact: 0.2 }])
    expect(lost.events.at(-1)).toBe('reset-contact')
    const early = run([
      { roll: 60, visible: false },
      { roll: 50, visible: false },
      { roll: 45, visible: true },
      { roll: 40, visible: true },
      { roll: 35, visible: false },
    ])
    expect(early.events.at(-1)).toBe('reset-early-exit')
    const big = run([
      { roll: 85, visible: false },
      { roll: 75, visible: false },
      { roll: 65, visible: false },
      { roll: 55, visible: false },
      { roll: 45, visible: true },
      { roll: 10, visible: true },
    ])
    expect(big.events.at(-1)).toBe('reset-step')
  })
})

describe('bridge and gate are untouched', () => {
  it('accepts the observation shape older workbenches send, with no new required field', () => {
    const lesson = LESSONS.find((l) => l.id === 'station-seven')!
    const observation: EbusObservation = {
      ...EMPTY_EBUS_OBSERVATION,
      ready: true,
      frameReady: true,
      actionCount: 3,
      linked: {
        assetsReady: true,
        selectedStructure: '',
        modelSectionViewed: false,
        approach: 'rms',
        scannedApproaches: [],
        frameId: 'abc',
        sweeps: { rms: emptyLinkedSweep() },
      },
    }
    expect(isEbusObservation(observation)).toBe(true)
    expect(labGoalMet(lesson.lab!, observation)).toBe(false)
    expect(
      labGoalRequirements(lesson.lab!, observation).find((r) => r.id === 'linked-sweep')?.met,
    ).toBe(false)
  })
})

describe('demonstration work is not learner work (host side)', () => {
  afterEach(cleanup)
  const lab = LESSONS.find((l) => l.id === 'station-seven')!.lab!
  let originalContext: typeof HTMLCanvasElement.prototype.getContext
  let originalMatchMedia: typeof window.matchMedia
  beforeEach(() => {
    // jsdom has no WebGL and no matchMedia; the workbench gate needs both to decide it can mount.
    originalContext = HTMLCanvasElement.prototype.getContext
    originalMatchMedia = window.matchMedia
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ getExtension: () => null })) as never
    window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as never
  })
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalContext
    window.matchMedia = originalMatchMedia
  })
  const boot = (demonstration: boolean) => {
    const onObservation = jest.fn()
    const { container } = render(
      <Workbench
        lab={lab}
        locked={false}
        reveal={demonstration}
        sessionId="s"
        onObservation={onObservation}
        demonstration={demonstration}
      />,
    )
    const iframe = container.querySelector('iframe')!
    const source = iframe.contentWindow!
    const sent: unknown[] = []
    source.postMessage = ((data: unknown) => sent.push(data)) as never
    const post = (data: unknown) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', { data, origin: window.location.origin, source }),
        )
      })
    post({ version: 1, type: 'ready' })
    const configure = sent.find((m) => (m as { type: string }).type === 'configure') as {
      config: { sessionId: string; demonstration?: boolean; observationRequest?: number }
    }
    return { onObservation, post, configure }
  }
  it('drops a demonstration iframe’s observations and forwards a real one’s under its session', () => {
    for (const demonstration of [true, false]) {
      const { onObservation, post, configure } = boot(demonstration)
      expect(configure.config.demonstration).toBe(demonstration)
      const before = onObservation.mock.calls.length
      const observation = {
        ...EMPTY_EBUS_OBSERVATION,
        ready: true,
        frameReady: true,
        actionCount: 5,
      }
      post({
        version: 1,
        type: 'observation',
        observationRequest: configure.config.observationRequest,
        sessionId: configure.config.sessionId,
        observation,
      })
      const forwarded = onObservation.mock.calls
        .slice(before)
        .map((call) => call[0] as EbusObservation)
        .filter((o) => o.actionCount === 5)
      if (demonstration) expect(forwarded).toHaveLength(0)
      else {
        expect(forwarded).toHaveLength(1)
        expect(forwarded[0].acquisitionSession).toBe(configure.config.sessionId)
      }
      // A session id the host did not issue is dropped in both modes.
      const count = onObservation.mock.calls.length
      post({
        version: 1,
        type: 'observation',
        observationRequest: configure.config.observationRequest,
        sessionId: 'forged',
        observation: { ...observation, actionCount: 9 },
      })
      expect(onObservation.mock.calls.length).toBe(count)
      cleanup()
    }
  })
})
