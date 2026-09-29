import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import {
  ContactRun,
  ContactTable,
  TOOL_CONTACT_WORDS,
  ToolContactPrototype,
  tryWords,
} from '../components/prototype/ToolContactPrototype'
import { SPACE_KEY_MAP } from '../components/space/spaceKeyMap'
import { PIVOT_WORDS, TOOL_WORDS } from '../components/space/spaceWords'
import {
  PIVOT_HAND_DIRECTIONS,
  spaceControlId,
  type PivotHandDirection,
  type ScopePose,
  type SpaceCommand,
} from '../components/space/types'
import { toolContact } from '../content/anatomy'
import { createResolver } from '../engine/space/loadSpace'
import { spaceSnapshot } from '../engine/space/spaceSnapshot'
import { reduce, startEngine, type EngineState } from '../engine/space/spaceReducer'
import type { CurrentToolContact } from '../engine/space/teachingTarget'
import { contactScene } from '../test-support/spaceScenes'

/**
 * The tool-contact spike's page (slice 13), on the analytic contact scene: driven by the keys and by
 * the dock's buttons, the DOM alternative, through the three demonstrations. The engine is the real
 * one; only the geometry is analytic.
 */

const scene = contactScene()
const pose = (depthMm: number): ScopePose => ({
  tiltAcrossRibsDeg: 0,
  tiltAlongRibsDeg: 0,
  depthMm,
  rollDeg: 0,
})

/** The way of the hand that sweeps the forceps, out as far as they go, into the scene's lung. */
function handTowardTheLung(): PivotHandDirection {
  const resolver = createResolver(scene.space)
  const press = (state: EngineState, command: SpaceCommand) =>
    reduce(
      state,
      { type: 'command', command, input: 'scripted', snapshot: state.snapshot },
      resolver,
    )
  let out = startEngine(resolver, {
    scenario: 'probe',
    lungStep: 1,
    pose: pose(40),
    reducedMotion: true,
    snapshot: spaceSnapshot('probe', 1),
    tool: { authorised: true },
  })
  for (let n = 0; n < 21; n += 1) out = press(out, { kind: 'tool', direction: 'extend' })
  const found = PIVOT_HAND_DIRECTIONS.find((hand) => {
    let state = out
    for (let n = 0; n < 8; n += 1) {
      state = press(state, { kind: 'pivot', hand })
      if (state.limit) return state.limit.kind === 'lung'
    }
    return false
  })
  if (!found) throw new Error('No pivot sweeps the forceps into the lung')
  return found
}

const TOWARD_THE_LUNG = handTowardTheLung()
const ANALYTIC: CurrentToolContact = {
  nodule: { on: 'costal-pleura', zone: 'anterior-chest-wall', centre: [131, 0, 0], radiusMm: 5 },
  places: [
    { id: 'facing-the-nodule', pose: pose(100), lungStep: 1 },
    { id: 'beside-the-lung', pose: pose(40), lungStep: 1 },
  ],
  towardTheLung: TOWARD_THE_LUNG,
  geometry: 'nodule 131 0 0 r 5',
}
const load = async () => scene.space
const HAND_KEY = Object.entries(SPACE_KEY_MAP).find(
  ([, action]) => action.kind === 'pivot' && action.hand === TOWARD_THE_LUNG,
)?.[0] as string

async function openRun() {
  const view = render(
    <ContactRun contact={ANALYTIC} load={load} reducedMotion={true} drawIn3d={false} />,
  )
  const pane = screen.getByRole('region', { name: 'The pleural space' })
  await waitFor(() => expect(pane).toHaveAttribute('data-readiness', 'ready'))
  return { ...view, pane }
}

const refusal = () => document.querySelector('[aria-live="polite"]')?.textContent ?? ''

/** Act until the refusal line says something, at most a number of times. */
function until(act1: () => void, times: number) {
  for (let n = 0; n < times; n += 1) {
    act(act1)
    if (refusal() !== '') return n + 1
  }
  return times
}

function key(pane: HTMLElement, value: string) {
  return () => {
    fireEvent.keyDown(pane, { key: value })
  }
}

function button(id: string) {
  return () => {
    fireEvent.click(document.getElementById(spaceControlId(id)) as HTMLElement, { detail: 0 })
  }
}

const jawsRule = () =>
  document.querySelector('tr[data-part="working-element"]')?.getAttribute('data-rule')

describe('the tool-contact spike', () => {
  it('shows the three demonstrations, driven by the keys', async () => {
    const { pane } = await openRun()
    expect(jawsRule()).toBe('refuse')
    expect(document.querySelector('[data-part="target"]')).not.toBeNull()

    until(key(pane, 'w'), 40)
    expect(refusal()).toBe(
      'Stopped: The telescope. It is against the nodule and is kept clear of it, so it goes no further this way.',
    )
    for (let n = 0; n < 3; n += 1) act(key(pane, 's'))
    expect(refusal()).toBe('')
    until(key(pane, 'f'), 25)
    expect(refusal()).toBe(
      'Stopped: The forceps’ jaws. They touch the nodule and go no further this way.',
    )
    expect(jawsRule()).toBe('may-touch')
    expect(document.querySelector('[data-touching="true"]')).toHaveTextContent(TOOL_WORDS.touching)
    expect(document.querySelector('[data-part="forceps"]')).not.toBeNull()
    act(key(pane, 'w'))
    expect(refusal()).toMatch(/^Stopped: The forceps’ jaws\./)

    fireEvent.click(screen.getByRole('button', { name: TOOL_CONTACT_WORDS.beside }))
    expect(screen.getByRole('button', { name: TOOL_CONTACT_WORDS.beside })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(refusal()).toBe('')
    expect(jawsRule()).toBe('refuse')
    until(key(pane, 'f'), 25)
    expect(refusal()).toBe('Stopped: The forceps. They are out as far as this model lets them go.')
    until(key(pane, HAND_KEY), 8)
    expect(refusal()).toMatch(
      /^Stopped: The forceps’ (shaft|jaws)\. The lung is in the way, so it goes no further this way\.$/,
    )
    until(key(pane, 'b'), 25)
    expect(refusal()).toBe(
      'Stopped: The forceps. They are back in the channel and go no further in.',
    )
    act(key(pane, HAND_KEY))
    expect(refusal()).toBe('')
  })

  it('shows them the same way with the dock’s buttons', async () => {
    await openRun()
    until(button('depth-in'), 40)
    expect(refusal()).toMatch(/^Stopped: The telescope\. It is against the nodule/)
    for (let n = 0; n < 3; n += 1) act(button('depth-out'))
    until(button('tool-extend'), 25)
    expect(refusal()).toMatch(/^Stopped: The forceps’ jaws\. They touch the nodule/)

    fireEvent.click(screen.getByRole('button', { name: TOOL_CONTACT_WORDS.beside }))
    until(button('tool-extend'), 25)
    until(button(`pivot-${TOWARD_THE_LUNG}`), 8)
    expect(refusal()).toMatch(/^Stopped: The forceps’ (shaft|jaws)\. The lung is in the way/)
    until(button('tool-retract'), 25)
    act(button(`pivot-${TOWARD_THE_LUNG}`))
    expect(refusal()).toBe('')

    // facing the nodule again, the telescope stops at it as before
    fireEvent.click(screen.getByRole('button', { name: TOOL_CONTACT_WORDS.facing }))
    until(button('depth-in'), 40)
    expect(refusal()).toMatch(/^Stopped: The telescope\. It is against the nodule/)
  })

  it('names the dock’s buttons in what it asks the learner to try', () => {
    const words = tryWords(TOWARD_THE_LUNG).join(' ')
    for (const label of [TOOL_WORDS.extend, TOOL_WORDS.retract, PIVOT_WORDS[TOWARD_THE_LUNG]])
      expect(words).toContain(`“${label}”`)
  })

  it('has no number, no word the learner-copy gate refuses, and no accessibility violation', async () => {
    const { container } = await openRun()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\d/)
    expect(flaggedLearnerCopyTerms(text)).toEqual([])
    expect(await axe(container)).toHaveNoViolations()
  })

  it('reads the table of contact for the forceps as they are', () => {
    const { rerender } = render(<ContactTable tool={undefined} />)
    expect(jawsRule()).toBe('refuse')
    rerender(
      <ContactTable
        tool={{ phase: 'extended', extensionMm: 4, touching: false, authorised: true }}
      />,
    )
    expect(jawsRule()).toBe('may-touch')
    for (const part of ['sleeve', 'telescope', 'tool-shaft'])
      expect(document.querySelector(`tr[data-part="${part}"]`)).toHaveAttribute(
        'data-rule',
        'refuse',
      )
    rerender(
      <ContactTable
        tool={{ phase: 'extended', extensionMm: 4, touching: false, authorised: false }}
      />,
    )
    expect(jawsRule()).toBe('refuse')
  })
})

describe('the page around it', () => {
  const realFetch = global.fetch
  beforeEach(() => {
    global.fetch = jest.fn(async () => {
      throw new Error('No network in the tests')
    }) as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = realFetch
  })

  it('heads itself as an engineering prototype, and says where the nodule is and why', async () => {
    const { container } = render(<ToolContactPrototype />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(TOOL_CONTACT_WORDS.heading)
    expect(screen.getByText(TOOL_CONTACT_WORDS.purpose)).toBeInTheDocument()
    const where = container.querySelector('[data-nodule-on]') as HTMLElement
    expect(where).toHaveAttribute('data-nodule-on', toolContact.nodule.on)
    expect(where).toHaveTextContent(
      toolContact.nodule.on === 'lung-surface'
        ? TOOL_CONTACT_WORDS.onLung
        : TOOL_CONTACT_WORDS.onWall,
    )
    // no network here: the pane says it could not load, and the page stays readable
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'The pleural space' })).toHaveAttribute(
        'data-readiness',
        'unavailable',
      ),
    )
    expect(
      within(screen.getByRole('region', { name: 'The pleural space' })).getAllByRole('status')
        .length,
    ).toBeGreaterThan(0)
  })
})
