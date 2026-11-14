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
 * is held here is the contract: the sweep rule and its named events; the bridge accepts the
 * payloads it always accepted; and the host still drops demonstration observations on the floor.
 */

describe('the rotation sweep', () => {
  it('asks only for contact and 20° of rotation', () => {
    expect(LINKED_SWEEP_TOLERANCES).toEqual({ minContact: 0.45, minSpanDeg: 20 })
  })
  it('names what each frame did', () => {
    let sweep: LinkedSweep = emptyLinkedSweep()
    const events: LinkedSweepEvent[] = []
    for (const [roll, visible, contact] of [
      [85, false, 1],
      [80, true, 0.2],
      [75, true, 1],
      [50, true, 1],
      [40, true, 1],
    ] as const) {
      const stepped = stepLinkedSweep(sweep, { roll, visible, contact, frameId: 'f' + roll })
      sweep = stepped.sweep
      events.push(stepped.event)
      expect(sampleLinkedSweep(sweep, { roll, visible, contact, frameId: 'f' + roll })).toBe(sweep)
    }
    expect(events).toEqual(['outside', 'no-contact', 'sample', 'complete', 'already-complete'])
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
