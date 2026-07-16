import type {
  StentExplorerArchitectureId,
  StentExplorerStation,
  StentExplorerViewMode,
  StentMechanicsModifiers,
} from '../../explorer/types'

/** Shared input contract for the persistent 3D view and its SVG text-equivalent view. */
export interface StentExplorerVisualizationProps {
  architectureId: StentExplorerArchitectureId
  className?: string
  modifiers?: StentMechanicsModifiers
  onVisibilityChange?: (visible: boolean) => void
  playing: boolean
  progress: number
  reducedMotion?: boolean
  showHotspots: boolean
  station: StentExplorerStation
  viewMode: StentExplorerViewMode
}
