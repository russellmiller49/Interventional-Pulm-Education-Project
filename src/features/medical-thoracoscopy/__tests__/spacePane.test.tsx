import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { ControlDock, DOCK_OPERABLE_CONTROLS } from '../components/space/ControlDock'
import { SpaceFallbackPane } from '../components/space/SpaceFallbackPane'
import { SPACE_KEY_HELP, SPACE_KEY_MAP, spaceKeyAction } from '../components/space/spaceKeyMap'
import { ledgerWords, SEEN_WORDS } from '../components/space/spaceWords'
import {
  emptyLedger,
  ledgerProblems,
  sameSnapshot,
  spaceControlId,
  type SpaceCommand,
  type SpacePaneProps,
  type SpacePaneState,
} from '../components/space/types'
import { HOLD_DELAY_MS, HOLD_INTERVAL_MS } from '../components/space/useHeldCommand'
import { MODEL_CONTROLS } from '../content/controlPanel'
import { PLEURAL_ZONE_IDS, pleuralZone } from '../content/pleuralZones'
import { WRITTEN_SECTIONS } from '../content/sections'
import {
  createSpaceDouble,
  DOUBLE_SNAPSHOT,
  SpacePaneDouble,
} from '../test-support/spaceTestDouble'

/**
 * The space pane's contract (slice 9): the ledger's rules, the dock, the keys, the pane that works
 * without WebGL, and the promise that whichever pane draws the state, the same commands give the same
 * ledger. The engine is a test double here; the 3D scene arrives behind the same contract.
 */

// jsdom has no PointerEvent, and a pointer event built from a plain Event carries no button or
// pointer type; the dock rightly ignores such a press. A small stand-in makes the events whole.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventStandIn extends MouseEvent {
      readonly pointerId: number
      readonly pointerType: string
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
        this.pointerType = init.pointerType ?? 'mouse'
      }
    }
    Object.defineProperty(window, 'PointerEvent', {
      value: PointerEventStandIn,
      configurable: true,
    })
  }
})

const SECTION_SEVEN = { shown: ['port', 'scope', 'tool', 'space'], operable: ['scope'] } as const
const SECTION_ELEVEN = { shown: ['scope'], operable: ['scope'] } as const

function props(state: SpacePaneState, overrides: Partial<SpacePaneProps> = {}): SpacePaneProps {
  return {
    state,
    shown: SECTION_ELEVEN.shown,
    operable: SECTION_ELEVEN.operable,
    reducedMotion: false,
    onCommand: jest.fn(),
    ...overrides,
  }
}

function surveyed() {
  const double = createSpaceDouble()
  const run: SpaceCommand[] = [
    { kind: 'depth', direction: 'in' },
    { kind: 'depth', direction: 'in' },
    ...Array.from({ length: 4 }, (): SpaceCommand => ({ kind: 'pivot', hand: 'head' })),
    { kind: 'pivot', hand: 'head' },
    { kind: 'roll', direction: 'clockwise' },
  ]
  for (const command of run) double.apply(command)
  return double
}

describe('the pane contract', () => {
  it('keeps the ledger to every zone once, in the survey order, in the three states', () => {
    expect(ledgerProblems(emptyLedger())).toEqual([])
    expect(ledgerProblems(surveyed().state.ledger)).toEqual([])
    const reordered = [...emptyLedger()].reverse()
    expect(ledgerProblems(reordered)).not.toEqual([])
    const seenWithReason = emptyLedger().map((entry, index) =>
      index === 0 ? { ...entry, seen: 'seen' as const } : entry,
    )
    expect(ledgerProblems(seenWithReason).join()).toMatch(/seen whole has no reason/)
    // Part of a region seen, and the rest not looked at yet, is a region partly seen (section 11).
    const partlyUnlooked = emptyLedger().map((entry, index) =>
      index === 0 ? { ...entry, seen: 'partly-seen' as const } : entry,
    )
    expect(ledgerProblems(partlyUnlooked)).toEqual([])
    const noReason = emptyLedger().map((entry, index) =>
      index === 0 ? { ...entry, reason: null } : entry,
    )
    expect(ledgerProblems(noReason).join()).toMatch(/needs one of the three reasons/)
  })

  it('names a result by its snapshot, part by part', () => {
    expect(sameSnapshot(DOUBLE_SNAPSHOT, { ...DOUBLE_SNAPSHOT })).toBe(true)
    expect(
      sameSnapshot(DOUBLE_SNAPSHOT, { ...DOUBLE_SNAPSHOT, lungAndFluid: 'another step' }),
    ).toBe(false)
  })

  it('has commands for every control a written section lets the learner use', () => {
    for (const section of WRITTEN_SECTIONS) {
      for (const control of section.controls.operable) {
        expect(DOCK_OPERABLE_CONTROLS).toContain(control)
      }
    }
  })
})

describe('the keys', () => {
  it('mean one thing each, and the help lists every one', () => {
    const listed = SPACE_KEY_HELP.map((row) => row.key)
    for (const key of Object.keys(SPACE_KEY_MAP)) {
      expect(listed).toContain(key.length === 1 ? key.toLowerCase() : key)
    }
    expect(spaceKeyAction('ArrowRight')).toEqual({ kind: 'pivot', hand: 'head' })
    expect(spaceKeyAction('W')).toEqual(spaceKeyAction('w'))
    expect(spaceKeyAction('x')).toBeNull()
    expect(spaceKeyAction('toString')).toBeNull()
  })
})

describe('the control dock', () => {
  afterEach(() => jest.useRealTimers())

  it('offers the three parts of the second control, and shows the others with where they are used', () => {
    const state = createSpaceDouble().state
    render(<ControlDock {...props(state, SECTION_SEVEN)} />)
    for (const key of [
      'pivot-head',
      'pivot-feet',
      'pivot-front',
      'pivot-back',
      'depth-in',
      'depth-out',
    ]) {
      expect(document.getElementById(spaceControlId(key))).toHaveAttribute('aria-disabled', 'false')
    }
    for (const id of ['port', 'tool', 'space'] as const) {
      const control = MODEL_CONTROLS.find((entry) => entry.id === id)
      const block = document.querySelector(`[data-control="${id}"]`) as HTMLElement
      expect(within(block).getByText(control?.name ?? '')).toBeInTheDocument()
      expect(within(block).getByText(/^Shown here, used from “.+”\.$/)).toBeInTheDocument()
    }
  })

  it('refuses a control it has no commands for', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const state = createSpaceDouble().state
    expect(() =>
      render(<ControlDock {...props(state, { operable: ['tool'], shown: ['tool'] })} />),
    ).toThrow(/no commands for: tool/)
    ;(console.error as jest.Mock).mockRestore()
  })

  it('takes one step for a click from the keyboard, and keeps stepping while held', () => {
    jest.useFakeTimers()
    const onCommand = jest.fn()
    render(<ControlDock {...props(createSpaceDouble().state, { onCommand })} />)
    const deeper = document.getElementById(spaceControlId('depth-in')) as HTMLElement
    fireEvent.click(deeper, { detail: 0 })
    expect(onCommand).toHaveBeenLastCalledWith({ kind: 'depth', direction: 'in' }, 'keyboard')
    onCommand.mockClear()
    fireEvent.pointerDown(deeper, { button: 0, pointerId: 1, pointerType: 'mouse' })
    expect(onCommand).toHaveBeenCalledTimes(1)
    act(() => jest.advanceTimersByTime(HOLD_DELAY_MS + 3 * HOLD_INTERVAL_MS))
    expect(onCommand).toHaveBeenCalledTimes(4)
    expect(onCommand).toHaveBeenLastCalledWith({ kind: 'depth', direction: 'in' }, 'pointer')
    fireEvent.pointerUp(deeper, { pointerId: 1 })
    act(() => jest.advanceTimersByTime(10 * HOLD_INTERVAL_MS))
    expect(onCommand).toHaveBeenCalledTimes(4)
  })

  it('lets go of a held control when the window loses focus or the tab is hidden', () => {
    jest.useFakeTimers()
    const onCommand = jest.fn()
    render(<ControlDock {...props(createSpaceDouble().state, { onCommand })} />)
    const head = document.getElementById(spaceControlId('pivot-head')) as HTMLElement
    fireEvent.pointerDown(head, { button: 0, pointerId: 1, pointerType: 'touch' })
    act(() => jest.advanceTimersByTime(HOLD_DELAY_MS + HOLD_INTERVAL_MS))
    const before = onCommand.mock.calls.length
    expect(onCommand).toHaveBeenLastCalledWith({ kind: 'pivot', hand: 'head' }, 'touch')
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    act(() => jest.advanceTimersByTime(10 * HOLD_INTERVAL_MS))
    expect(onCommand).toHaveBeenCalledTimes(before)

    fireEvent.pointerDown(head, { button: 0, pointerId: 2, pointerType: 'mouse' })
    act(() => jest.advanceTimersByTime(HOLD_DELAY_MS + HOLD_INTERVAL_MS))
    const again = onCommand.mock.calls.length
    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(10 * HOLD_INTERVAL_MS))
    expect(onCommand).toHaveBeenCalledTimes(again)
    visibility.mockRestore()
  })

  it('takes one step per press when motion is reduced, and offers Step while the model waits', () => {
    jest.useFakeTimers()
    const onCommand = jest.fn()
    const double = createSpaceDouble()
    const { rerender } = render(
      <ControlDock {...props(double.state, { onCommand, reducedMotion: true })} />,
    )
    const out = document.getElementById(spaceControlId('depth-out')) as HTMLElement
    fireEvent.pointerDown(out, { button: 0, pointerId: 1, pointerType: 'mouse' })
    act(() => jest.advanceTimersByTime(HOLD_DELAY_MS + 5 * HOLD_INTERVAL_MS))
    expect(onCommand).toHaveBeenCalledTimes(1)
    expect(document.getElementById(spaceControlId('step'))).toBeNull()
    rerender(<ControlDock {...props(double.holdClock(), { onCommand, reducedMotion: true })} />)
    fireEvent.click(document.getElementById(spaceControlId('step')) as HTMLElement)
    expect(onCommand).toHaveBeenLastCalledWith({ kind: 'step-clock' }, 'pointer')
    rerender(<ControlDock {...props(double.state, { onCommand, reducedMotion: false })} />)
    expect(document.getElementById(spaceControlId('step'))).toBeNull()
  })

  it('waits, and says why, while the anatomy loads or cannot be had; trying again is offered', () => {
    const onCommand = jest.fn()
    const double = createSpaceDouble({
      readiness: { kind: 'loading', what: 'Loading the anatomy.' },
    })
    const { rerender } = render(<ControlDock {...props(double.state, { onCommand })} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      /Loading the anatomy\. The controls wait until it is ready/,
    )
    const head = document.getElementById(spaceControlId('pivot-head')) as HTMLElement
    expect(head).toHaveAttribute('aria-disabled', 'true')
    fireEvent.pointerDown(head, { button: 0, pointerId: 1, pointerType: 'mouse' })
    fireEvent.click(head, { detail: 0 })
    expect(onCommand).not.toHaveBeenCalled()
    rerender(<ControlDock {...props(double.loseGeometry(true), { onCommand })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try loading again' }))
    expect(onCommand).toHaveBeenCalledWith({ kind: 'retry-geometry' }, 'pointer')
  })
})

describe('the pane without WebGL', () => {
  it('draws the cut, the ledger and what is in view, all from the state it is given', () => {
    const double = surveyed()
    const { container } = render(<SpaceFallbackPane {...props(double.state)} />)
    const runs = container.querySelectorAll('polyline[data-zone]')
    expect(runs).toHaveLength(PLEURAL_ZONE_IDS.length)
    for (const run of Array.from(runs)) {
      const entry = double.state.ledger.find((item) => item.zone === run.getAttribute('data-zone'))
      expect(run.getAttribute('data-seen')).toBe(entry?.seen)
    }
    const ledgerRows = container.querySelectorAll('tr[data-zone]')
    expect(Array.from(ledgerRows).map((row) => row.getAttribute('data-zone'))).toEqual([
      ...PLEURAL_ZONE_IDS,
    ])
    const names = double.state.inView.map((zone) => pleuralZone(zone).name).join(', ')
    expect(double.state.inView).toEqual(['diaphragm', 'costophrenic-recess'])
    expect(screen.getByText(`In view now: ${names}.`)).toBeInTheDocument()
  })

  it('takes keys only while it has focus itself, and leaves every other key alone', () => {
    const onCommand = jest.fn()
    render(<SpaceFallbackPane {...props(createSpaceDouble().state, { onCommand })} />)
    const pane = screen.getByRole('region', { name: 'The pleural space' })
    pane.focus()
    const allowed = fireEvent.keyDown(pane, { key: 'ArrowRight' })
    expect(allowed).toBe(false)
    expect(onCommand).toHaveBeenLastCalledWith({ kind: 'pivot', hand: 'head' }, 'keyboard')
    onCommand.mockClear()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Show the keys' }), { key: 'ArrowRight' })
    fireEvent.keyDown(pane, { key: 'ArrowRight', ctrlKey: true })
    expect(fireEvent.keyDown(pane, { key: 'x' })).toBe(true)
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('leaves the arrows to the page while the anatomy is not ready', () => {
    const onCommand = jest.fn()
    const double = createSpaceDouble({
      readiness: { kind: 'loading', what: 'Loading the anatomy.' },
    })
    render(<SpaceFallbackPane {...props(double.state, { onCommand })} />)
    const pane = screen.getByRole('region', { name: 'The pleural space' })
    expect(fireEvent.keyDown(pane, { key: 'ArrowUp' })).toBe(true)
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('moves one step per press under reduced motion, whatever a held key repeats', () => {
    const onCommand = jest.fn()
    render(
      <SpaceFallbackPane
        {...props(createSpaceDouble().state, { onCommand, reducedMotion: true })}
      />,
    )
    const pane = screen.getByRole('region', { name: 'The pleural space' })
    fireEvent.keyDown(pane, { key: 'w' })
    fireEvent.keyDown(pane, { key: 'w', repeat: true })
    fireEvent.keyDown(pane, { key: 'w', repeat: true })
    expect(onCommand).toHaveBeenCalledTimes(1)
  })

  it('shows and hides the keys with ?, the table read from the key map', () => {
    render(<SpaceFallbackPane {...props(createSpaceDouble().state)} />)
    const pane = screen.getByRole('region', { name: 'The pleural space' })
    fireEvent.keyDown(pane, { key: '?' })
    expect(screen.getByRole('button', { name: 'Hide the keys' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('Pivot: hand toward the head')).toBeInTheDocument()
    expect(screen.getByText('Roll: turn anticlockwise')).toBeInTheDocument()
    fireEvent.keyDown(pane, { key: '?' })
    expect(screen.getByRole('button', { name: 'Show the keys' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('names the part that stopped a movement', () => {
    const double = createSpaceDouble()
    for (let step = 0; step < 20; step += 1) double.apply({ kind: 'depth', direction: 'in' })
    render(<SpaceFallbackPane {...props(double.state)} />)
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Stopped: The telescope. The lung is in the way, so it goes no deeper here.',
    )
  })

  it('never marks a region seen by trying again after the anatomy was lost', () => {
    const double = surveyed()
    const before = double.state.ledger
    double.loseGeometry(true)
    double.apply({ kind: 'retry-geometry' })
    expect(double.state.readiness.kind).toBe('loading')
    expect(double.state.ledger).toEqual(before)
    double.finishLoading()
    expect(double.state.ledger).toEqual(before)
  })

  it('gives the same ledger for the same commands, whichever pane draws it', () => {
    const double = surveyed()
    const { container: fallback } = render(<SpaceFallbackPane {...props(double.state)} />)
    const fromFallback = Array.from(fallback.querySelectorAll('tr[data-zone] td')).map(
      (cell) => cell.textContent,
    )
    const { container: plain } = render(<SpacePaneDouble {...props(double.state)} />)
    const fromDouble = Array.from(plain.querySelectorAll('li[data-zone]')).map(
      (item) => item.textContent,
    )
    expect(fromFallback).toEqual(fromDouble)
    expect(fromFallback).toEqual(double.state.ledger.map(ledgerWords))
    expect(fromFallback.filter((words) => words?.startsWith(SEEN_WORDS.seen))).not.toHaveLength(0)
  })

  it('shows no number, and no word the learner-copy gate refuses', () => {
    const { container } = render(<SpaceFallbackPane {...props(surveyed().state, SECTION_SEVEN)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the keys' }))
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\d/)
    expect(flaggedLearnerCopyTerms(text)).toEqual([])
  })

  it.each([
    ['ready, after part of a survey', () => surveyed().state],
    [
      'loading',
      () =>
        createSpaceDouble({ readiness: { kind: 'loading', what: 'Loading the anatomy.' } }).state,
    ],
    ['unavailable, with a retry', () => createSpaceDouble().loseGeometry(true)],
  ])('has no accessibility violations when %s', async (_, make) => {
    const { container } = render(<SpaceFallbackPane {...props(make(), SECTION_SEVEN)} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
