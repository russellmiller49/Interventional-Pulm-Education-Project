import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { useEffect, type ReactNode } from 'react'

import { SpacePane } from '../components/space/SpacePane'
import { READINESS_WORDS, SCENE_WORDS, VIEW_WORDS } from '../components/space/spaceWords'
import { useSpaceEngine, type SpaceLoader } from '../components/space/useSpaceEngine'
import type { LoadedSpace } from '../engine/space/loadSpace'
import { scene } from '../test-support/spaceScenes'

/**
 * The space pane that draws in 3D where it can (slice 11): it chooses the scene or the cut, says why
 * when it cannot draw, and keeps one shell around either, so the same commands give the same ledger
 * with the scene and without it. The engine here is the real one, on an analytic scene; the 3D views
 * are a stand-in, since jsdom has no WebGL (the real canvas is checked in a browser).
 */

const support = { webgl: true }
jest.mock('../components/space/useSpaceSupport', () => ({
  useWebGLSupport: () => support.webgl,
  useReducedMotion: () => false,
}))

const sceneBehaviour: { status: 'ready' | 'failed' } = { status: 'ready' }
jest.mock('next/dynamic', () => () => {
  function SceneStandIn({ onStatus }: { onStatus: (status: 'ready' | 'failed') => void }) {
    useEffect(() => onStatus(sceneBehaviour.status), [onStatus])
    return (
      <div data-three-state={sceneBehaviour.status} data-testid="scene-stand-in">
        <h3>{SCENE_WORDS.chestHeading}</h3>
        <h3>{SCENE_WORDS.scopeHeading}</h3>
      </div>
    )
  }
  return SceneStandIn
})

const START = {
  scenario: 'test scene',
  lungStep: 2,
  pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0 },
} as const
const loadScene: SpaceLoader = async () => scene('spheres').space

function Host({ load = loadScene, drawIn3d = true }: { load?: SpaceLoader; drawIn3d?: boolean }) {
  const session = useSpaceEngine(START, { reducedMotion: false, load })
  return (
    <SpacePane
      state={session.paneState}
      space={session.space}
      shown={['scope']}
      operable={['scope']}
      reducedMotion={false}
      onCommand={session.onCommand}
      drawIn3d={drawIn3d}
    />
  )
}

const pane = () => screen.getByRole('region', { name: VIEW_WORDS.paneLabel })
const ledgerRows = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent)

async function ready() {
  await waitFor(() => expect(pane()).toHaveAttribute('data-readiness', 'ready'))
}

const SEQUENCE = [
  ...Array(8).fill('w'),
  ...Array(10).fill('ArrowUp'),
  ...Array(12).fill('w'),
  ...Array(20).fill('ArrowDown'),
  ...Array(6).fill('ArrowLeft'),
  ...Array(4).fill('s'),
  'e',
  'e',
]

async function run(ui: ReactNode) {
  const view = render(ui)
  await ready()
  act(() => {
    for (const key of SEQUENCE) fireEvent.keyDown(pane(), { key })
  })
  const result = {
    ledger: ledgerRows(),
    refusal: screen.getByRole('status').textContent,
  }
  view.unmount()
  return result
}

beforeEach(() => {
  support.webgl = true
  sceneBehaviour.status = 'ready'
})

describe('the pane that draws in 3D where it can', () => {
  it('draws the scene where the browser can, and the cut on request, with no note', async () => {
    const { unmount } = render(<Host />)
    await ready()
    expect(screen.getByTestId('scene-stand-in')).toBeInTheDocument()
    expect(screen.queryByText(SCENE_WORDS.drawnWithout)).not.toBeInTheDocument()
    unmount()
    render(<Host drawIn3d={false} />)
    await ready()
    expect(screen.getByRole('heading', { name: VIEW_WORDS.chestHeading })).toBeInTheDocument()
    expect(screen.queryByText(SCENE_WORDS.drawnWithout)).not.toBeInTheDocument()
  })

  it('draws the cut, and says why, where the browser has no WebGL', async () => {
    support.webgl = false
    render(<Host />)
    await ready()
    expect(screen.getByRole('heading', { name: VIEW_WORDS.chestHeading })).toBeInTheDocument()
    expect(screen.getByText(SCENE_WORDS.drawnWithout)).toBeInTheDocument()
  })

  it('falls back to the cut, saying so, when the scene cannot be drawn', async () => {
    sceneBehaviour.status = 'failed'
    render(<Host />)
    await ready()
    await waitFor(() => expect(screen.getByText(SCENE_WORDS.drawnWithout)).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: VIEW_WORDS.chestHeading })).toBeInTheDocument()
  })

  it('gives the same ledger and the same refusal for the same commands, with the scene and without it', async () => {
    const withScene = await run(<Host />)
    const withCut = await run(<Host drawIn3d={false} />)
    support.webgl = false
    const withoutWebgl = await run(<Host />)
    expect(withScene).toEqual(withCut)
    expect(withScene).toEqual(withoutWebgl)
    // the commands did something the ledger shows
    expect(
      withScene.ledger.some((row) => row?.includes('Partly seen') || row?.startsWith('Seen')),
    ).toBe(true)
  })

  it('has no accessibility violations, with the scene and with the cut', async () => {
    const { container, unmount } = render(<Host />)
    await ready()
    expect(await axe(container)).toHaveNoViolations()
    unmount()
    support.webgl = false
    const cut = render(<Host />)
    await ready()
    expect(await axe(cut.container)).toHaveNoViolations()
  })
})

describe('the engine’s host', () => {
  it('says the anatomy is loading, then hands the pane the engine’s state', async () => {
    let finish: (space: LoadedSpace) => void = () => {}
    const load: SpaceLoader = () => new Promise((resolve) => (finish = resolve))
    render(<Host load={load} drawIn3d={false} />)
    expect(pane()).toHaveAttribute('data-readiness', 'loading')
    expect(screen.getAllByText(READINESS_WORDS.loading).length).toBeGreaterThan(0)
    await act(async () => finish(scene('spheres').space))
    await ready()
  })

  it('offers to load again after a failure, and trying again marks nothing seen', async () => {
    let attempts = 0
    const load: SpaceLoader = async () => {
      attempts += 1
      if (attempts === 1) throw new Error('no network')
      return scene('spheres').space
    }
    render(<Host load={load} drawIn3d={false} />)
    await waitFor(() => expect(pane()).toHaveAttribute('data-readiness', 'unavailable'))
    expect(screen.getAllByText(READINESS_WORDS.unavailable).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Try loading again/ }))
    await ready()
    expect(attempts).toBe(2)
    expect(ledgerRows().every((row) => row?.includes('not looked at yet'))).toBe(true)
  })

  it('drops a result that a newer attempt has overtaken', async () => {
    // Two loads under way at once, as when the loader changes while the first is still loading: the
    // first's late result is dropped, whatever it holds, and only the newer one counts.
    let finishFirst: (space: LoadedSpace) => void = () => {}
    let finishSecond: (space: LoadedSpace) => void = () => {}
    const first: SpaceLoader = () => new Promise((resolve) => (finishFirst = resolve))
    const second: SpaceLoader = () => new Promise((resolve) => (finishSecond = resolve))
    const { rerender } = render(<Host load={first} drawIn3d={false} />)
    rerender(<Host load={second} drawIn3d={false} />)
    await act(async () => finishFirst(scene('plate').space))
    expect(pane()).toHaveAttribute('data-readiness', 'loading')
    await act(async () => finishSecond(scene('spheres').space))
    await ready()
  })
})
