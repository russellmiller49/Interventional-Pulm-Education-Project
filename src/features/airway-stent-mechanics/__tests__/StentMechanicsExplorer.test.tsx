import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

import { StentMechanicsExplorer } from '../components/explorer/StentMechanicsExplorer'
import { STENT_EXPLORER_PRECOMMIT_EVIDENCE_BOUNDARY } from '../components/explorer/StentEvidencePanel'
import { stentExplorerCasePresets } from '../explorer/cases'
import { getStentExplorerStation, stentExplorerStations } from '../explorer/stations'

const mockReplace = jest.fn()
const mockRecordSiteModuleEvent = jest.fn()
let mockReducedMotion = false

jest.mock('next/navigation', () => ({
  usePathname: () => '/en/airway-stent-mechanics',
  useRouter: () => ({ replace: mockReplace }),
}))

jest.mock('framer-motion', () => ({
  useReducedMotion: () => mockReducedMotion,
}))

jest.mock('@/i18n/handoff', () => ({
  HandoffContent: ({ children }: { children: ReactNode }) => children,
}))

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: (...args: unknown[]) => mockRecordSiteModuleEvent(...args),
}))

jest.mock('../components/explorer/StentExplorerViewportDynamic', () => ({
  StentExplorerViewportDynamic: ({
    playing,
    progress,
    reducedMotion,
    showHotspots,
    station,
    viewMode,
    modifiers,
  }: {
    playing: boolean
    progress: number
    reducedMotion: boolean
    showHotspots: boolean
    station: { id: string }
    viewMode: string
    modifiers?: Record<string, number>
  }) => (
    <div
      data-testid="mock-stent-explorer-viewport"
      data-hotspots={String(showHotspots)}
      data-playing={String(playing)}
      data-progress={String(progress)}
      data-reduced-motion={String(reducedMotion)}
      data-saddle-mismatch={String(modifiers?.saddleMismatch ?? 0)}
      data-station={station.id}
      data-view={viewMode}
    />
  ),
}))

function stationNavigator() {
  return screen.getByRole('navigation', { name: 'Airway stent clinical questions' })
}

function interactionDock() {
  return screen.getByRole('tablist', { name: 'Clinical question interaction panels' })
}

async function commitFirstPrediction(user: ReturnType<typeof userEvent.setup>) {
  const dock = screen.queryByRole('tablist', { name: 'Clinical question interaction panels' })
  if (dock) {
    await user.click(within(dock).getByRole('tab', { name: 'Self-check' }))
  }
  const heading = screen.getByRole('heading', {
    name: 'Predict before the consequence is shown',
  })
  const predictionPanel = heading.closest('section')

  expect(predictionPanel).not.toBeNull()
  await user.click(within(predictionPanel as HTMLElement).getAllByRole('radio')[0])
  await user.click(
    within(predictionPanel as HTMLElement).getByRole('button', {
      name: /Commit prediction and/,
    }),
  )
}

async function skipPrediction(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(interactionDock()).getByRole('tab', { name: 'Self-check' }))
  await user.click(screen.getByRole('button', { name: 'Skip prediction and explore' }))
}

describe('StentMechanicsExplorer shell', () => {
  beforeEach(() => {
    mockReducedMotion = false
    mockReplace.mockClear()
    mockRecordSiteModuleEvent.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('makes all eleven stations immediately selectable without lesson gating', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    expect(stentExplorerStations).toHaveLength(11)
    expect(screen.getByText('Eleven open clinical questions')).toBeVisible()
    expect(screen.getByText(/There is no required order, score, or completion gate/i)).toBeVisible()
    expect(mockRecordSiteModuleEvent).toHaveBeenCalledWith({
      eventType: 'module_interaction',
      moduleId: 'airway-stent-mechanics',
      section: 'architecture-lumen',
      eventPayload: {
        interaction: 'station_selected',
        stationId: 'architecture-lumen',
        entry: 'initial',
      },
    })

    for (const station of stentExplorerStations) {
      const button = within(stationNavigator()).getByRole('button', {
        name: new RegExp(station.shortLabel, 'i'),
      })

      expect(button).toBeEnabled()
      await user.click(button)
      expect(screen.getByRole('heading', { name: station.title })).toBeVisible()
      expect(button).toHaveAttribute('aria-current', 'page')
    }
  })

  it('keeps every station freely available alongside the compact interaction dock', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    const navigator = stationNavigator()
    expect(within(navigator).getAllByRole('button')).toHaveLength(stentExplorerStations.length)

    const dock = interactionDock()
    for (const label of ['Stent details', 'Self-check', 'Explore', 'Inspect']) {
      expect(within(dock).getByRole('tab', { name: label })).toBeVisible()
    }

    const destination = stentExplorerStations.at(-1)!
    await user.click(
      within(navigator).getByRole('button', {
        name: new RegExp(destination.shortLabel, 'i'),
      }),
    )

    expect(screen.getByRole('heading', { name: destination.title })).toBeVisible()
    expect(
      within(stationNavigator()).getByRole('button', {
        name: new RegExp(destination.shortLabel, 'i'),
      }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('tablist', { name: 'Clinical question interaction panels' }),
    ).toBeVisible()
  })

  it.each([
    ['commit', 'Commit prediction and animate'],
    ['skip', 'Skip prediction and explore'],
  ] as const)(
    'unlocks Explore after prediction %s without forcing a tab change',
    async (_path, actionLabel) => {
      const user = userEvent.setup()
      render(<StentMechanicsExplorer />)

      const dock = interactionDock()
      const selfCheck = within(dock).getByRole('tab', { name: 'Self-check' })
      await user.click(selfCheck)

      if (actionLabel === 'Commit prediction and animate') {
        const predictionPanel = screen
          .getByRole('heading', { name: 'Predict before the consequence is shown' })
          .closest('section')
        expect(predictionPanel).not.toBeNull()
        await user.click(within(predictionPanel as HTMLElement).getAllByRole('radio')[0])
      }

      await user.click(screen.getByRole('button', { name: actionLabel }))

      expect(selfCheck).toHaveAttribute('aria-selected', 'true')
      const explore = within(interactionDock()).getByRole('tab', { name: 'Explore' })
      expect(explore).toBeEnabled()
      await user.click(explore)
      expect(explore).toHaveAttribute('aria-selected', 'true')
    },
  )

  it('keeps Play active and offers a guided choice before revealing the model', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    const play = screen.getByRole('button', { name: 'Play' })
    expect(play).toBeEnabled()
    await user.click(play)

    const prompt = screen.getByRole('dialog', { name: 'Predict first, or explore now?' })
    expect(prompt).toBeVisible()
    expect(within(prompt).getByRole('button', { name: 'Go to self-check' })).toHaveFocus()

    await user.click(within(prompt).getByRole('button', { name: 'Go to self-check' }))

    const selfCheck = within(interactionDock()).getByRole('tab', { name: 'Self-check' })
    expect(selfCheck).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(selfCheck).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('starts playback automatically when prediction is skipped from the Play prompt', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    await user.click(screen.getByRole('button', { name: 'Play' }))
    await user.click(screen.getByRole('button', { name: 'Skip prediction & play' }))

    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled()
    expect(within(interactionDock()).getByRole('tab', { name: 'Explore' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-hotspots',
      'true',
    )
  })

  it('reveals hotspot and debrief content in Inspect after exploration is unlocked', async () => {
    const user = userEvent.setup()
    const station = stentExplorerStations[0]
    render(<StentMechanicsExplorer initialStationId={station.id} />)

    await skipPrediction(user)
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))

    expect(screen.getByText(station.hotspots[0].description)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Why it matters' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'What to inspect' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Conceptual response' })).toBeVisible()
  })

  it('enters a focused workspace and exits it with Escape', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    const focusWorkspace = screen.getByRole('button', { name: 'Focus workspace' })
    expect(focusWorkspace).toHaveAttribute('aria-pressed', 'false')

    await user.click(focusWorkspace)
    expect(focusWorkspace).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('{Escape}')
    expect(focusWorkspace).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not mount the legacy course, mastery, completion, or progress-storage system', async () => {
    const user = userEvent.setup()
    const getItem = jest.spyOn(Storage.prototype, 'getItem')
    const setItem = jest.spyOn(Storage.prototype, 'setItem')

    render(<StentMechanicsExplorer />)
    await user.click(
      within(stationNavigator()).getByRole('button', {
        name: new RegExp(stentExplorerStations[1].shortLabel, 'i'),
      }),
    )

    expect(screen.queryByText(/clinical decision lab/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/65-minute/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/mastery threshold/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/lesson \d+ of \d+/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /complete lesson|mark (?:lesson|case) complete/i }),
    ).not.toBeInTheDocument()
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()

    getItem.mockRestore()
    setItem.mockRestore()
  })

  it('hides the clinical debrief until prediction commit', async () => {
    mockReducedMotion = true
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))
    expect(screen.getByText('The clinical debrief is intentionally hidden.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'What changed' })).not.toBeInTheDocument()

    await commitFirstPrediction(user)
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))

    expect(screen.getByText('Clinical debrief revealed')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Why it matters' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'What to inspect' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Conceptual response' })).toBeVisible()
  })

  it('keeps prediction optional by unlocking exploration through an explicit skip path', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    expect(screen.getByRole('button', { name: 'Cutaway' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hotspots' })).toBeDisabled()
    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-hotspots',
      'false',
    )
    expect(
      screen.queryByText(stentExplorerStations[0].hotspots[0].description),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(stentExplorerStations[0].evidenceNote)).not.toBeInTheDocument()
    expect(screen.queryByText(stentExplorerStations[0].evidenceBoundary)).not.toBeInTheDocument()
    expect(screen.getByText(STENT_EXPLORER_PRECOMMIT_EVIDENCE_BOUNDARY)).toBeVisible()

    await skipPrediction(user)

    expect(screen.getByText('Exploration unlocked without a prediction.')).toBeVisible()
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))
    expect(screen.getByText('Clinical debrief available')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cutaway' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Hotspots' })).toBeEnabled()
    expect(screen.getByText(stentExplorerStations[0].hotspots[0].description)).toBeVisible()
    expect(screen.getByText(stentExplorerStations[0].evidenceNote)).toBeVisible()
    expect(screen.getByText(stentExplorerStations[0].evidenceBoundary)).toBeVisible()
    expect(mockRecordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'module_interaction',
        eventPayload: expect.objectContaining({ interaction: 'prediction_skipped' }),
      }),
    )
  })

  it('resets prediction reveal when architecture or station changes', async () => {
    mockReducedMotion = true
    const user = userEvent.setup()
    render(<StentMechanicsExplorer initialStationId="architecture-lumen" />)

    await commitFirstPrediction(user)
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))
    expect(screen.getByText('Clinical debrief revealed')).toBeVisible()

    const architectureOptions = getStentExplorerStation('architecture-lumen').architectureOptions
    expect(architectureOptions.length).toBeGreaterThan(1)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Choose stent architecture' }),
      architectureOptions[1].id,
    )

    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))
    expect(screen.getByText('The clinical debrief is intentionally hidden.')).toBeVisible()
    expect(screen.queryByText('Clinical debrief revealed')).not.toBeInTheDocument()
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Self-check' }))
    const resetPredictionChoices = within(
      screen
        .getByRole('heading', { name: 'Predict before the consequence is shown' })
        .closest('section') as HTMLElement,
    ).getAllByRole('radio')
    for (const choice of resetPredictionChoices) {
      expect(choice).not.toBeChecked()
    }

    await commitFirstPrediction(user)
    await user.click(
      within(stationNavigator()).getByRole('button', {
        name: new RegExp(stentExplorerStations[1].shortLabel, 'i'),
      }),
    )

    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))
    expect(screen.getByText('The clinical debrief is intentionally hidden.')).toBeVisible()
    expect(screen.queryByText('Clinical debrief revealed')).not.toBeInTheDocument()
  })

  it('opens a case preset at its configured initial station', async () => {
    const user = userEvent.setup()
    const preset = stentExplorerCasePresets.find(
      (candidate) => candidate.initialStationId === 'migration',
    )
    expect(preset).toBeDefined()

    render(<StentMechanicsExplorer />)
    await user.click(screen.getByRole('button', { name: new RegExp(preset!.label, 'i') }))

    const station = getStentExplorerStation(preset!.initialStationId)
    expect(screen.getByRole('heading', { name: station.title })).toBeVisible()
    expect(mockReplace).toHaveBeenLastCalledWith(
      `/en/airway-stent-mechanics?station=${station.id}`,
      { scroll: false },
    )
  })

  it('keeps the clinical lens aligned with direct station navigation', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer initialStationId="architecture-lumen" />)

    const stationLensLabel = screen.getByText('Current question lens')
    const lens = stationLensLabel.closest('aside')
    expect(lens).not.toBeNull()
    expect(within(lens as HTMLElement).getByText('Architecture & lumen')).toBeVisible()

    const migrationPreset = stentExplorerCasePresets.find(
      (preset) => preset.initialStationId === 'migration',
    )!
    await user.click(screen.getByRole('button', { name: new RegExp(migrationPreset.label, 'i') }))
    expect(screen.getByText('Current clinical lens')).toBeVisible()

    await user.click(
      within(stationNavigator()).getByRole('button', { name: /Architecture & lumen/i }),
    )
    expect(screen.getByText('Current question lens')).toBeVisible()
  })

  it('treats a station deep link as a question lens until a case is explicitly selected', () => {
    render(<StentMechanicsExplorer initialStationId="curve-buckle" />)

    expect(screen.getByText('Current question lens')).toBeVisible()
    expect(screen.queryByText('Current clinical lens')).not.toBeInTheDocument()
    expect(screen.getAllByText(getStentExplorerStation('curve-buckle').clinicalHook)).toHaveLength(
      2,
    )
  })

  it('switches views, renders the cross-section, and toggles hotspots', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer />)

    const viewport = screen.getByTestId('mock-stent-explorer-viewport')
    expect(viewport).toHaveAttribute('data-view', 'external')
    expect(viewport).toHaveAttribute('data-hotspots', 'false')

    expect(screen.getByRole('button', { name: 'Cutaway' })).toBeDisabled()
    await skipPrediction(user)
    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-hotspots',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Cutaway' }))
    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-view',
      'cutaway',
    )

    const hotspots = screen.getByRole('button', { name: 'Hotspots' })
    expect(hotspots).toHaveAttribute('aria-pressed', 'true')
    await user.click(hotspots)
    expect(hotspots).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-hotspots',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Cross-section' }))
    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-view',
      'cross-section',
    )
    expect(screen.getByRole('button', { name: 'Cross-section' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('feeds station-specific control changes into the visualization modifiers', async () => {
    const user = userEvent.setup()
    render(<StentMechanicsExplorer initialStationId="y-stent" />)

    await skipPrediction(user)
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Explore' }))
    const saddleControl = screen.getByRole('slider', { name: 'Saddle mismatch' })
    expect(saddleControl).toBeEnabled()
    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-saddle-mismatch',
      '0.25',
    )

    fireEvent.change(saddleControl, { target: { value: '1' } })

    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-saddle-mismatch',
      '1',
    )
  })

  it('shows metallic construction facts before prediction and gates the load-path interpretation', async () => {
    const user = userEvent.setup()
    const station = getStentExplorerStation('metal-architecture')
    render(<StentMechanicsExplorer initialStationId={station.id} />)

    await user.click(within(interactionDock()).getByRole('tab', { name: 'Stent details' }))
    const selectedArchitecture = station.architectureOptions[0]
    expect(screen.getByText('Architecture fingerprint')).toBeVisible()
    expect(screen.getByText(selectedArchitecture.topology)).toBeVisible()
    expect(screen.getByText(selectedArchitecture.material)).toBeVisible()
    expect(screen.queryByText(selectedArchitecture.loadPath)).not.toBeInTheDocument()

    await skipPrediction(user)

    await user.click(within(interactionDock()).getByRole('tab', { name: 'Stent details' }))
    expect(screen.getByText(selectedArchitecture.loadPath)).toBeVisible()
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Explore' }))
    expect(screen.getByRole('combobox', { name: 'Imposed constraint' })).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Visible displacement' })).toBeVisible()
  })

  it('keeps the learner-facing hotspot list synchronized with the selected metal topology', async () => {
    const user = userEvent.setup()
    const station = getStentExplorerStation('metal-architecture')
    render(<StentMechanicsExplorer initialStationId={station.id} />)

    await skipPrediction(user)
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))
    expect(screen.getByText('Crossings or junctions')).toBeVisible()
    expect(screen.queryByText('Ring connectors')).not.toBeInTheDocument()
    expect(screen.queryByText('Continuous knitted strand')).not.toBeInTheDocument()

    const laserCut = station.architectureOptions.find(
      (architecture) => architecture.id === 'laser-cut-covered',
    )!
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Choose stent architecture' }),
      laserCut.id,
    )
    await skipPrediction(user)
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))

    expect(screen.getByText('Ring connectors')).toBeVisible()
    expect(screen.getByText('Coverage transitions')).toBeVisible()
    expect(screen.queryByText('Crossings or junctions')).not.toBeInTheDocument()
  })

  it('reveals the final static teaching state when reduced motion is active', async () => {
    mockReducedMotion = true
    const user = userEvent.setup()
    const station = stentExplorerStations[0]
    render(<StentMechanicsExplorer initialStationId={station.id} />)

    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )
    expect(screen.getByText(/Reduced motion is active/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled()

    await commitFirstPrediction(user)

    expect(screen.getByTestId('mock-stent-explorer-viewport')).toHaveAttribute('data-progress', '1')
    expect(screen.getByText(station.phases.at(-1)!.textEquivalent)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Replay' })).toBeEnabled()
    await user.click(within(interactionDock()).getByRole('tab', { name: 'Inspect' }))
    expect(screen.getByText('Clinical debrief revealed')).toBeVisible()
  })

  it('plays the full animation when a reduced-motion learner explicitly selects Play', async () => {
    mockReducedMotion = true
    const user = userEvent.setup()
    render(<StentMechanicsExplorer initialStationId="cough-motion" />)

    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByText(/reveal representative static states/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Skip prediction & play' }))

    const viewport = screen.getByTestId('mock-stent-explorer-viewport')
    expect(viewport).toHaveAttribute('data-reduced-motion', 'false')
    expect(viewport).toHaveAttribute('data-playing', 'true')
    expect(viewport).toHaveAttribute('data-progress', '0')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled()
    expect(screen.getByText(/Animation is enabled for this module/i)).toBeVisible()
    expect(
      screen.queryByRole('group', { name: 'Reduced-motion static state' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use static states' }))

    expect(viewport).toHaveAttribute('data-reduced-motion', 'true')
    expect(viewport).toHaveAttribute('data-playing', 'false')
    expect(viewport).toHaveAttribute('data-progress', '1')
    expect(screen.getByRole('group', { name: 'Reduced-motion static state' })).toBeVisible()
  })

  it('offers static baseline, loaded, and recovered states for metallic reduced motion', async () => {
    mockReducedMotion = true
    const user = userEvent.setup()
    render(<StentMechanicsExplorer initialStationId="metal-architecture" />)

    await commitFirstPrediction(user)

    const viewport = screen.getByTestId('mock-stent-explorer-viewport')
    const staticStates = screen.getByRole('group', { name: 'Reduced-motion static state' })
    expect(viewport).toHaveAttribute('data-progress', '0.5')
    expect(within(staticStates).getByRole('button', { name: 'Loaded' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(within(staticStates).getByRole('button', { name: 'Baseline' }))
    expect(viewport).toHaveAttribute('data-progress', '0')

    await user.click(within(staticStates).getByRole('button', { name: 'Recovered / consequence' }))
    expect(viewport).toHaveAttribute('data-progress', '1')
  })
})
