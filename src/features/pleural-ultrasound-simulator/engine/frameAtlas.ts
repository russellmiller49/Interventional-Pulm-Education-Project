import type {
  PleuralFrameAtlas,
  PleuralFrameAtlasEntry,
  PleuralFrameAtlasTolerance,
  PleuralProbeState,
} from '../types'

export const defaultFrameAtlasTolerance: PleuralFrameAtlasTolerance = {
  lateralMm: 8,
  craniocaudalMm: 8,
  tiltDeg: 4,
  rotationDeg: 6,
  depthCm: 0.6,
  sectorAngleDeg: 4,
}

export interface AtlasFrameSelection {
  entry: PleuralFrameAtlasEntry
  normalizedDistance: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasProbeState(value: unknown): value is PleuralProbeState {
  const probe = value as PleuralProbeState
  return (
    isFiniteNumber(probe?.lateralMm) &&
    isFiniteNumber(probe?.posteriorMm) &&
    isFiniteNumber(probe?.craniocaudalMm) &&
    isFiniteNumber(probe?.tiltDeg) &&
    isFiniteNumber(probe?.rotationDeg) &&
    isFiniteNumber(probe?.depthCm) &&
    isFiniteNumber(probe?.gain) &&
    isFiniteNumber(probe?.dynamicRangeDb) &&
    isFiniteNumber(probe?.sectorAngleDeg) &&
    isFiniteNumber(probe?.needleAngleDeg)
  )
}

function isAtlasEntry(value: unknown): value is PleuralFrameAtlasEntry {
  const entry = value as PleuralFrameAtlasEntry
  return (
    typeof entry?.id === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.imageUrl === 'string' &&
    hasProbeState(entry.probe) &&
    !!entry.metrics &&
    !!entry.metrics.centralNeedle &&
    typeof entry.groundTruthPattern === 'string' &&
    !!entry.generator &&
    typeof entry.generator.name === 'string' &&
    typeof entry.generator.source === 'string' &&
    (entry.reviewStatus === 'reviewed' || entry.reviewStatus === 'needs-review')
  )
}

export function normalizeFrameAtlas(atlas: PleuralFrameAtlas | null | undefined) {
  if (!atlas || !Array.isArray(atlas.entries)) {
    return null
  }

  const entries = atlas.entries.filter(isAtlasEntry)
  if (entries.length === 0) {
    return null
  }

  return {
    ...atlas,
    selectionTolerance: {
      ...defaultFrameAtlasTolerance,
      ...(atlas.selectionTolerance ?? {}),
    },
    entries,
  } satisfies PleuralFrameAtlas
}

export function poseDistanceWithinTolerance(
  probe: PleuralProbeState,
  entry: PleuralFrameAtlasEntry,
  tolerance: PleuralFrameAtlasTolerance,
) {
  const deltas = [
    Math.abs(probe.lateralMm - entry.probe.lateralMm) / tolerance.lateralMm,
    Math.abs(probe.craniocaudalMm - entry.probe.craniocaudalMm) / tolerance.craniocaudalMm,
    Math.abs(probe.tiltDeg - entry.probe.tiltDeg) / tolerance.tiltDeg,
    Math.abs(probe.rotationDeg - entry.probe.rotationDeg) / tolerance.rotationDeg,
    Math.abs(probe.depthCm - entry.probe.depthCm) / tolerance.depthCm,
    Math.abs(probe.sectorAngleDeg - entry.probe.sectorAngleDeg) / tolerance.sectorAngleDeg,
  ]
  const maxDelta = Math.max(...deltas)
  const euclidean = Math.sqrt(deltas.reduce((total, value) => total + value * value, 0))

  return {
    withinTolerance: maxDelta <= 1,
    normalizedDistance: euclidean,
  }
}

export function selectNearestReviewedAtlasFrame(
  atlas: PleuralFrameAtlas | null | undefined,
  probe: PleuralProbeState,
): AtlasFrameSelection | null {
  const normalizedAtlas = normalizeFrameAtlas(atlas)
  if (!normalizedAtlas) {
    return null
  }

  const tolerance = {
    ...defaultFrameAtlasTolerance,
    ...normalizedAtlas.selectionTolerance,
  }

  let bestSelection: AtlasFrameSelection | null = null

  for (const entry of normalizedAtlas.entries) {
    if (entry.reviewStatus !== 'reviewed') {
      continue
    }

    const distance = poseDistanceWithinTolerance(probe, entry, tolerance)
    if (!distance.withinTolerance) {
      continue
    }

    if (!bestSelection || distance.normalizedDistance < bestSelection.normalizedDistance) {
      bestSelection = {
        entry,
        normalizedDistance: distance.normalizedDistance,
      }
    }
  }

  return bestSelection
}
