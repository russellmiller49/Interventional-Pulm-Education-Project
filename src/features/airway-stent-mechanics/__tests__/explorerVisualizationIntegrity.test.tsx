import { render, screen } from '@testing-library/react'

import { StentExplorerCrossSection } from '../components/explorer/StentExplorerCrossSection'
import { getStationHotspots } from '../components/explorer/StentExplorerScene'
import {
  createDefaultStentExplorerControlState,
  deriveStentMechanicsModifiers,
  setStentExplorerControlValue,
} from '../explorer/controlState'
import { getStentExplorerStation } from '../explorer/stations'

describe('metallic explorer synchronized views', () => {
  const station = getStentExplorerStation('metal-architecture')

  it('exposes only hotspots that exist in the selected wire topology', () => {
    expect(getStationHotspots(station, 'free-crossing-braid').map(({ id }) => id)).toEqual([
      'wire-junctions',
    ])
    expect(getStationHotspots(station, 'hook-cross-covered').map(({ id }) => id)).toEqual([
      'wire-junctions',
      'coverage-transitions',
    ])
    expect(getStationHotspots(station, 'laser-cut-covered').map(({ id }) => id)).toEqual([
      'ring-connectors',
      'coverage-transitions',
    ])
    expect(
      getStationHotspots(station, 'single-wire-knit-partial-cover').map(({ id }) => id),
    ).toEqual(['continuous-strand', 'coverage-transitions'])
    expect(getStationHotspots(station, 'balloon-expanded-metal').map(({ id }) => id)).toEqual([
      'ring-connectors',
    ])
  })

  it('synchronizes cover inspection with the true-scale cross-section', () => {
    const architectureId = 'laser-cut-covered' as const
    const visibleState = createDefaultStentExplorerControlState(station, architectureId)
    const commonProps = {
      architectureId,
      playing: false,
      progress: 0.5,
      reducedMotion: false,
      showHotspots: true,
      station,
      viewMode: 'cross-section' as const,
    }
    const { rerender } = render(
      <StentExplorerCrossSection
        {...commonProps}
        modifiers={deriveStentMechanicsModifiers(station, visibleState, architectureId)}
      />,
    )

    expect(screen.getByTestId('stent-explorer-cross-section')).toHaveAttribute(
      'data-cover-visible',
      'true',
    )

    const hiddenState = setStentExplorerControlValue(
      station,
      visibleState,
      'cover-inspection',
      false,
      architectureId,
    )
    rerender(
      <StentExplorerCrossSection
        {...commonProps}
        modifiers={deriveStentMechanicsModifiers(station, hiddenState, architectureId)}
      />,
    )

    expect(screen.getByTestId('stent-explorer-cross-section')).toHaveAttribute(
      'data-cover-visible',
      'false',
    )
    expect(screen.getByText(/covering layer is hidden in every synchronized view/i)).toBeVisible()
  })

  it('draws an uncovered scaffold boundary without a continuous filled annulus', () => {
    const architectureId = 'free-crossing-braid' as const
    const state = createDefaultStentExplorerControlState(station, architectureId)
    const { container } = render(
      <StentExplorerCrossSection
        architectureId={architectureId}
        modifiers={deriveStentMechanicsModifiers(station, state, architectureId)}
        playing={false}
        progress={0.5}
        reducedMotion={false}
        showHotspots
        station={station}
        viewMode="cross-section"
      />,
    )

    expect(screen.getByTestId('stent-explorer-cross-section')).toHaveAttribute(
      'data-cover-visible',
      'false',
    )
    expect(container.querySelector('ellipse[stroke-dasharray="6 4"]')).not.toBeNull()
  })

  it('positions the partial-cover cross-section at the exposed end-cell pathway', () => {
    const tumorStation = getStentExplorerStation('tumor-ingrowth-overgrowth')
    const architectureId = 'single-wire-knit-partial-cover' as const
    const state = createDefaultStentExplorerControlState(tumorStation, architectureId)
    render(
      <StentExplorerCrossSection
        architectureId={architectureId}
        modifiers={deriveStentMechanicsModifiers(tumorStation, state, architectureId)}
        playing={false}
        progress={1}
        reducedMotion={false}
        showHotspots
        station={tumorStation}
        viewMode="cross-section"
      />,
    )

    expect(screen.getByTestId('stent-explorer-cross-section')).toHaveAttribute(
      'data-cover-visible',
      'false',
    )
    expect(
      screen.getByText(/section is positioned through the selected exposed end-cell zone/i),
    ).toBeVisible()
  })
})
