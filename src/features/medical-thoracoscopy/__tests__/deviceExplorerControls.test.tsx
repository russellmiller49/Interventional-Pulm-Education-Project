import { act, fireEvent, render, screen, within } from '@testing-library/react'

import { DeviceExplorer } from '../components/device-explorer/DeviceExplorer'
import type { ExplorerViewportProps } from '../components/device-explorer/ExplorerViewport'
import {
  ASSEMBLY,
  explorerReducer,
  initialExplorerState,
} from '../components/device-explorer/explorerState'
import type { ExplorerAssetSource } from '../components/device-explorer/sceneLink'
import { createSequenceClock } from '../components/device-explorer/sequenceClock'
import { EXPLORER_DEVICES } from '../content/deviceExplorerCatalogue'
import { ASSEMBLY_SECONDS, ASSEMBLY_STEPS, STEP_STARTS } from '../engine/deviceExplorer/assembly'

/**
 * Every action the viewport offers is also an ordinary control. The 3D view is replaced by a stub
 * that records what the explorer hands it, so these tests read the explorer's state without a GPU.
 */
const viewport = jest.fn<void, [ExplorerViewportProps]>()
function StubViewport(props: ExplorerViewportProps) {
  viewport(props)
  return <div data-testid="viewport" />
}

const source: ExplorerAssetSource = {
  name: 'Test models',
  urlOf: (id) => `/test/${id}.glb`,
  sleeveSeatMm: 58.761336519744475,
  sizes: new Map(),
}

function renderExplorer() {
  viewport.mockClear()
  render(<DeviceExplorer source={source} Viewport={StubViewport} />)
  if (viewport.mock.calls.length === 0) throw new Error('The viewport was not rendered')
  return () => viewport.mock.lastCall![0]
}

const devices = () => screen.getByRole('navigation', { name: 'Devices' })

describe('device explorer controls', () => {
  it('lists the assembled system and every model, and frames the one chosen', () => {
    const props = renderExplorer()
    const nav = devices()
    expect(within(nav).getByRole('button', { name: /Assembled system/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const device of EXPLORER_DEVICES) {
      expect(
        within(nav).getByRole('button', { name: new RegExp(`^${device.title}`) }),
      ).toBeInTheDocument()
    }
    const before = props().state.cameraSerial
    fireEvent.click(within(nav).getByRole('button', { name: /^Operative telescope/ }))
    expect(props().state.selection).toBe('operative-telescope')
    expect(props().state.cameraSerial).toBeGreaterThan(before)
    const card = screen.getByRole('complementary', { name: 'Details' })
    expect(within(card).getByRole('heading', { name: 'Operative telescope' })).toBeInTheDocument()
    expect(within(card).getByText('Class A')).toBeInTheDocument()
    expect(within(card).getByText('8920.401')).toBeInTheDocument()
    expect(
      within(card).getByText('Parametric educational model — awaiting manufacturer fact-check'),
    ).toBeInTheDocument()
  })

  it('marks the tower as an illustrative blockout wherever it is shown', () => {
    renderExplorer()
    fireEvent.click(within(devices()).getByRole('button', { name: /^Tower/ }))
    const card = screen.getByRole('complementary', { name: 'Details' })
    expect(within(card).getByText('Class C')).toBeInTheDocument()
    expect(
      within(card).getAllByText(/Illustrative blockout — awaiting manufacturer reference or CAD/)
        .length,
    ).toBeGreaterThan(0)
  })

  it('switches the telescope between the normal and the cutaway drawing', () => {
    const props = renderExplorer()
    fireEvent.click(within(devices()).getByRole('button', { name: /^Operative telescope/ }))
    const cutaway = screen.getByRole('checkbox', { name: 'Cutaway' })
    expect(cutaway).not.toBeChecked()
    fireEvent.click(cutaway)
    expect(props().state.selection).toBe('operative-telescope-illustrative-cutaway')
    expect(screen.getByRole('checkbox', { name: 'Cutaway' })).toBeChecked()
    expect(screen.getByText('Internal paths illustrative')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cutaway' }))
    expect(props().state.selection).toBe('operative-telescope')
  })

  it('plays, pauses and scrubs the assembly from ordinary controls', () => {
    const props = renderExplorer()
    const clock = props().clock
    fireEvent.click(screen.getByRole('button', { name: 'Play from the start' }))
    expect(clock.get().playing).toBe(true)
    expect(clock.get().seconds).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(clock.get().playing).toBe(false)
    const slider = screen.getByRole('slider', { name: 'Assembly progress' })
    fireEvent.change(slider, { target: { value: String(STEP_STARTS[6] + 1) } })
    expect(clock.get().seconds).toBeCloseTo(STEP_STARTS[6] + 1, 6)
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/^Step 7 of 10/))
    fireEvent.change(slider, { target: { value: '1' } })
    expect(clock.get().seconds).toBe(1)
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/^Step 1 of 10/))
  })

  it('shows each step’s result from the step list and the step buttons', () => {
    const props = renderExplorer()
    const clock = props().clock
    const steps = screen.getByRole('heading', { name: 'Assembly steps' }).closest('section')!
    fireEvent.click(within(steps).getByRole('button', { name: /^4 The distal end/ }))
    const end4 = STEP_STARTS[3] + ASSEMBLY_STEPS[3].seconds
    expect(clock.get().seconds).toBeCloseTo(end4, 2)
    expect(within(steps).getByRole('button', { name: /^4 The distal end/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(clock.get().seconds).toBeCloseTo(STEP_STARTS[4] + ASSEMBLY_STEPS[4].seconds, 2)
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
    expect(clock.get().seconds).toBeCloseTo(end4, 2)
  })

  it('switches the cutaway on and off as the sequence crosses the cutaway steps', () => {
    const props = renderExplorer()
    const clock = props().clock
    act(() => clock.scrub(STEP_STARTS[5] + 0.5))
    expect(props().state.cutaway).toBe(true)
    act(() => clock.scrub(ASSEMBLY_SECONDS))
    expect(props().state.cutaway).toBe(false)
    // In between, the viewer's own choice stands.
    act(() => clock.scrub(STEP_STARTS[6]))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cutaway' }))
    act(() => clock.scrub(STEP_STARTS[7]))
    expect(props().state.cutaway).toBe(false)
  })

  it('explodes and reassembles the system', () => {
    const props = renderExplorer()
    fireEvent.click(screen.getByRole('button', { name: 'Exploded view' }))
    expect(props().state.exploded).toBe(true)
    expect(screen.getByRole('button', { name: 'Exploded view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    act(() => props().clock.scrub(2))
    fireEvent.click(screen.getByRole('button', { name: 'Assemble' }))
    expect(props().state.exploded).toBe(false)
    expect(props().clock.get().seconds).toBe(ASSEMBLY_SECONDS)
  })

  it('opens the jaws only once they are past the channel exit', () => {
    const props = renderExplorer()
    const jaws = () => screen.getByRole('group', { name: 'Jaws' })
    expect(jaws()).not.toBeDisabled()
    fireEvent.click(within(jaws()).getByRole('button', { name: 'Open' }))
    expect(props().state.jaw).toBe(1)
    act(() => props().clock.scrub(STEP_STARTS[6] + 1))
    expect(jaws()).toBeDisabled()
    expect(
      screen.getByText('The jaws open once they are past the channel exit.'),
    ).toBeInTheDocument()
    fireEvent.click(within(devices()).getByRole('button', { name: /^Dissection forceps/ }))
    expect(jaws()).toBeDisabled()
    expect(
      screen.getByText('The opening of these jaws has not been measured, so they stay closed.'),
    ).toBeInTheDocument()
    fireEvent.click(within(devices()).getByRole('button', { name: /^Double-spoon forceps/ }))
    expect(jaws()).not.toBeDisabled()
    fireEvent.change(within(jaws()).getByRole('slider', { name: 'Jaw opening' }), {
      target: { value: '0.5' },
    })
    expect(props().state.jaw).toBe(0.5)
  })

  it('explains a hotspot with its kinds of claim kept apart', () => {
    const props = renderExplorer()
    fireEvent.click(within(devices()).getByRole('button', { name: /^Operative telescope/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Light post' }))
    expect(props().state.hotspot).toBe('lightPost')
    const detail = screen.getByRole('heading', { name: 'Light post', level: 3 }).closest('section')!
    expect(within(detail).getByText('Authored geometry')).toBeInTheDocument()
    expect(within(detail).getByText('Unresolved manufacturer detail')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Working channel entry' }))
    const entry = screen
      .getByRole('heading', { name: 'Working channel entry', level: 3 })
      .closest('section')!
    expect(within(entry).getByText('Sourced device fact')).toBeInTheDocument()
    expect(within(entry).getAllByText('Derived measurement').length).toBeGreaterThan(0)
    expect(within(entry).getByText(/291\.5 ± 2 mm/)).toBeInTheDocument()
  })

  it('resets the camera and switches labels from ordinary controls', () => {
    const props = renderExplorer()
    const before = props().state.cameraSerial
    fireEvent.click(screen.getByRole('button', { name: 'Reset camera' }))
    expect(props().state.cameraSerial).toBe(before + 1)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Labels' }))
    expect(props().state.labels).toBe(false)
  })
})

describe('device explorer state', () => {
  it('lets the viewer take the camera and hands it back to the sequence', () => {
    let state = explorerReducer(initialExplorerState, { type: 'follow', on: false })
    expect(state.follow).toBe(false)
    state = explorerReducer(state, { type: 'resetCamera' })
    expect(state.follow).toBe(true)
    state = explorerReducer(state, { type: 'hotspot', key: 'telescope:eyepiece' })
    expect(state.follow).toBe(false)
  })

  it('starts a new model closed, assembled and unselected', () => {
    let state = explorerReducer(initialExplorerState, { type: 'jaw', value: 1 })
    state = explorerReducer(state, { type: 'explode', on: true })
    state = explorerReducer(state, { type: 'select', id: 'probe' })
    expect(state).toMatchObject({ selection: 'probe', jaw: 0, exploded: false, hotspot: null })
    expect(explorerReducer(state, { type: 'select', id: 'not-a-model' })).toBe(state)
    expect(explorerReducer(state, { type: 'select', id: ASSEMBLY }).selection).toBe(ASSEMBLY)
  })
})

describe('sequence clock', () => {
  it('plays to the end and stops there, and plays again from the start', () => {
    const clock = createSequenceClock(ASSEMBLY_SECONDS - 0.5)
    clock.play()
    clock.advance(1)
    expect(clock.get()).toMatchObject({ seconds: ASSEMBLY_SECONDS, playing: false })
    const jumps = clock.get().jumps
    clock.play()
    expect(clock.get()).toMatchObject({ seconds: 0, playing: true, jumps: jumps + 1 })
  })

  it('keeps the playhead inside the sequence', () => {
    const clock = createSequenceClock()
    clock.scrub(-3)
    expect(clock.get().seconds).toBe(0)
    clock.scrub(ASSEMBLY_SECONDS + 10)
    expect(clock.get().seconds).toBe(ASSEMBLY_SECONDS)
    clock.advance(5)
    expect(clock.get().seconds).toBe(ASSEMBLY_SECONDS)
  })
})
