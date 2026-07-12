import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StentArchitectureLab } from '../components/learning-lab/StentArchitectureLab'

jest.mock('../components/learning-lab/StentArchitectureViewport', () => ({
  StentArchitectureViewport: () => <div data-testid="mock-stent-viewport" />,
}))

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
    writable: true,
  })
}

describe('StentArchitectureLab learning-lab controls', () => {
  beforeEach(() => {
    installMatchMedia(false)
    delete window.__airwayStentLab
  })

  afterEach(() => {
    delete window.__airwayStentLab
  })

  it('exposes topology-specific controls and a deterministic verification hook in practice', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<StentArchitectureLab experience="force-practice" />)

    expect(screen.getByTestId('mock-stent-viewport')).toBeVisible()
    expect(window.__airwayStentLab?.architectures()).toHaveLength(7)

    const firstFrame = window.__airwayStentLab?.frameAt(0.42)
    const repeatedFrame = window.__airwayStentLab?.frameAt(0.42)
    expect(repeatedFrame).toEqual(firstFrame)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Architecture' }), 'silicone-y')

    expect(screen.queryByRole('button', { name: 'Focal ovalization' })).not.toBeInTheDocument()
    expect(screen.queryByText('Visible diameter vs unloaded')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(window.__airwayStentLab?.readout().architectureId).toBe('silicone-y')
    })
    expect(window.__airwayStentLab?.loadModes()).not.toContain('ovalization')
    expect(() => window.__airwayStentLab?.setLoadMode('ovalization')).toThrow('does not support')

    act(() => window.__airwayStentLab?.setArchitecture('laser-cut-covered'))
    await waitFor(() => {
      expect(window.__airwayStentLab?.readout().architectureId).toBe('laser-cut-covered')
    })
    expect(screen.getByRole('button', { name: 'Inspect scaffold' })).toBeVisible()

    act(() => window.__airwayStentLab?.setAmplitude(-5))
    await waitFor(() => {
      expect(window.__airwayStentLab?.readout().amplitude).toBe(0.2)
    })
    expect(() => window.__airwayStentLab?.setAmplitude(Number.NaN)).toThrow('finite')
    expect(() => window.__airwayStentLab?.setArchitecture('not-a-stent')).toThrow('Unknown')

    unmount()
    expect(window.__airwayStentLab).toBeUndefined()
  })

  it('keeps one viewport in the architecture explorer and updates the selected load teaching cue', async () => {
    const user = userEvent.setup()
    render(
      <StentArchitectureLab
        experience="architecture-explorer"
        initialArchitectureId="free-crossing-braid"
      />,
    )

    const cockpit = screen.getByTestId('stent-architecture-cockpit')
    expect(cockpit).toBeVisible()
    expect(within(cockpit).getAllByTestId('stent-architecture-viewport')).toHaveLength(1)
    expect(within(cockpit).getAllByTestId('mock-stent-viewport')).toHaveLength(1)

    const radialButton = within(cockpit).getByRole('button', {
      name: 'Radial compression. Apply symmetric diameter reduction to the scaffold and airway.',
    })
    await user.click(radialButton)

    expect(within(cockpit).getByText('Visible diameter vs unloaded')).toBeVisible()
    expect(within(cockpit).getByText('Visible length vs unloaded')).toBeVisible()

    const radialCue = within(cockpit).getByText(
      'Watch diameter narrow while braided and knitted scaffolds visibly lengthen.',
    )
    expect(radialCue.closest('[aria-live="polite"]')).toBeVisible()

    await user.click(
      within(cockpit).getByRole('button', {
        name: 'Deployment coupling. Move between constrained and expanded geometry to reveal length coupling.',
      }),
    )

    const deploymentCue = within(cockpit).getByText(
      'Watch the constrained, elongated scaffold expand and shorten—visible foreshortening.',
    )
    expect(deploymentCue).toBeVisible()
    expect(deploymentCue.closest('[aria-live="polite"]')).toBeVisible()
  })

  it('constrains guided Force Lab controls and reports completion only after all scenes open', async () => {
    const user = userEvent.setup()
    const onExperienceProgress = jest.fn()
    render(
      <StentArchitectureLab
        experience="guided-force"
        onExperienceProgress={onExperienceProgress}
      />,
    )

    expect(screen.getByRole('region', { name: 'Guided airway stent Force Lab' })).toBeVisible()
    expect(window.__airwayStentLab?.architectures()).toEqual(['free-crossing-braid'])
    expect(window.__airwayStentLab?.loadModes()).toEqual(['radial', 'ovalization', 'breathing'])
    expect(window.__airwayStentLab?.readout()).toEqual(
      expect.objectContaining({
        architectureId: 'free-crossing-braid',
        playing: false,
        requestedPlaying: false,
      }),
    )
    expect(() => window.__airwayStentLab?.setArchitecture('laser-cut-covered')).toThrow(
      'not available in this learning experience',
    )

    expect(screen.queryByRole('combobox', { name: 'Architecture' })).not.toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inspect scaffold' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Restore cover' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Airway shown' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Airway hidden' })).not.toBeInTheDocument()

    const guidedScenes = screen.getByRole('group', { name: 'Guided scenes' })
    expect(within(guidedScenes).getAllByRole('button')).toHaveLength(3)
    expect(
      within(guidedScenes).getByRole('button', {
        name: 'Radial compression',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    const ovalizationScene = within(guidedScenes).getByRole('button', {
      name: 'Focal ovalization',
    })
    const breathingScene = within(guidedScenes).getByRole('button', {
      name: 'Breathing motion',
    })

    await waitFor(() => {
      expect(onExperienceProgress).toHaveBeenLastCalledWith({
        completedIds: ['guided-radial-compression'],
        complete: false,
      })
    })
    expect(onExperienceProgress).not.toHaveBeenCalledWith(
      expect.objectContaining({ complete: true }),
    )

    await user.click(ovalizationScene)
    await waitFor(() => {
      expect(onExperienceProgress).toHaveBeenLastCalledWith({
        completedIds: ['guided-radial-compression', 'guided-focal-ovalization'],
        complete: false,
      })
    })
    expect(onExperienceProgress).not.toHaveBeenCalledWith(
      expect.objectContaining({ complete: true }),
    )

    await user.click(breathingScene)
    await waitFor(() => {
      expect(onExperienceProgress).toHaveBeenLastCalledWith({
        completedIds: [
          'guided-radial-compression',
          'guided-focal-ovalization',
          'guided-breathing-motion',
        ],
        complete: true,
      })
    })
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 scenes viewed')
  })

  it('keeps the guided experience static when reduced motion is requested', async () => {
    installMatchMedia(true)
    render(<StentArchitectureLab experience="guided-force" />)

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
    expect(
      screen.getByText(
        'Reduced motion is enabled. Each load remains at a representative static pose.',
      ),
    ).toBeVisible()

    act(() => window.__airwayStentLab?.play())
    await waitFor(() => {
      expect(window.__airwayStentLab?.readout()).toEqual(
        expect.objectContaining({
          playing: false,
          reducedMotion: true,
          requestedPlaying: true,
        }),
      )
    })
  })

  it('keeps practice conclusions hidden until commit and completes after three mission attempts', async () => {
    const user = userEvent.setup()
    const onExperienceProgress = jest.fn()
    render(
      <StentArchitectureLab
        experience="force-practice"
        onExperienceProgress={onExperienceProgress}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Architecture' })).toBeVisible()
    expect(screen.getByRole('slider')).toBeVisible()
    expect(window.__airwayStentLab?.architectures()).toHaveLength(7)

    const loadControls = screen.getByRole('group', { name: 'Applied displacement' })
    expect(within(loadControls).getAllByRole('button')).toHaveLength(7)
    for (const label of [
      'Unloaded',
      'Radial compression',
      'Bend',
      'Focal ovalization',
      'Breathing',
      'Cough pulse',
      'Deployment coupling',
    ]) {
      expect(within(loadControls).getByRole('button', { name: label })).toBeVisible()
    }

    const missionTabs = screen.getByLabelText('Force Lab practice missions')
    expect(within(missionTabs).getAllByRole('button')).toHaveLength(3)
    expect(
      within(missionTabs).getByRole('button', {
        name: 'Mission 1 Defend a curved-airway observation',
      }),
    ).toBeVisible()
    expect(
      within(missionTabs).getByRole('button', {
        name: 'Mission 2 Interpret eccentric loading',
      }),
    ).toBeVisible()
    expect(
      within(missionTabs).getByRole('button', {
        name: 'Mission 3 Compare matched radial displacement',
      }),
    ).toBeVisible()

    expect(
      screen.queryByText(
        'Watch diameter narrow while braided and knitted scaffolds visibly lengthen.',
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        'Imposed diameter change redistributes bending and contact along many wires; sliding at crossings permits reconfiguration but introduces friction and possible fretting.',
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Teaching cues stay hidden until the active mission is committed.'),
    ).toBeVisible()
    expect(screen.getByText('Interpretation hidden until mission commit.')).toBeVisible()

    await user.click(
      screen.getByRole('radio', {
        name: 'Infer a radial-force ranking from the bent pose alone.',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit configuration and answer' }))

    expect(screen.getByRole('status')).toHaveTextContent('Reframe the comparison')
    expect(
      screen.getByText(
        'The scene applies visible motion but does not measure force, fixture response, or material properties.',
      ),
    ).toBeVisible()
    await waitFor(() => {
      expect(onExperienceProgress).toHaveBeenLastCalledWith({
        completedIds: ['mission-curved-airway'],
        complete: false,
      })
    })

    await user.click(
      within(missionTabs).getByRole('button', {
        name: 'Mission 2 Interpret eccentric loading',
      }),
    )
    await user.click(
      screen.getByRole('radio', {
        name: 'Uniform radial compression fully represents the focal lesion.',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit configuration and answer' }))
    await waitFor(() => {
      expect(onExperienceProgress).toHaveBeenLastCalledWith({
        completedIds: ['mission-curved-airway', 'mission-eccentric-load'],
        complete: false,
      })
    })

    await user.click(
      within(missionTabs).getByRole('button', {
        name: 'Mission 3 Compare matched radial displacement',
      }),
    )
    await waitFor(() => {
      expect(screen.getByText('Case mission 3 of 3')).toBeVisible()
    })

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Architecture' }),
      'laser-cut-covered',
    )
    await waitFor(() => {
      expect(window.__airwayStentLab?.readout().architectureId).toBe('laser-cut-covered')
    })
    await user.click(
      screen.getByRole('radio', {
        name: 'The two schematics show different geometric responses to the displayed constraint.',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit configuration and answer' }))

    expect(screen.getByRole('status')).toHaveTextContent('Defensible interpretation')
    await waitFor(() => {
      expect(onExperienceProgress).toHaveBeenLastCalledWith({
        completedIds: ['mission-curved-airway', 'mission-eccentric-load', 'mission-matched-radial'],
        complete: true,
      })
    })
  })
})
