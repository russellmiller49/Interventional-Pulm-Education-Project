import type { StentExplorerArchitectureId, StentExplorerStation } from './types'

const METAL_HOTSPOT_IDS: Partial<Record<StentExplorerArchitectureId, readonly string[]>> = {
  'free-crossing-braid': ['wire-junctions'],
  'hook-cross-covered': ['wire-junctions', 'coverage-transitions'],
  'laser-cut-covered': ['ring-connectors', 'coverage-transitions'],
  'single-wire-knit-partial-cover': ['continuous-strand', 'coverage-transitions'],
  'balloon-expanded-metal': ['ring-connectors'],
}

export function getAvailableStentExplorerHotspots(
  station: StentExplorerStation,
  architectureId?: StentExplorerArchitectureId,
) {
  if (station.id !== 'metal-architecture' || !architectureId) return station.hotspots

  const availableIds = METAL_HOTSPOT_IDS[architectureId]
  return availableIds
    ? station.hotspots.filter((hotspot) => availableIds.includes(hotspot.id))
    : station.hotspots
}
