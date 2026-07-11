import type { FrameAtlas, FrameAtlasEntry, FrameAtlasTolerance, ThoracicProbeState } from '../types'

export const defaultFrameAtlasTolerance: FrameAtlasTolerance = {
  lateralMm: 8,
  posteriorMm: 12,
  craniocaudalMm: 8,
  approachDeg: 8,
  tiltDeg: 4,
  rotationDeg: 6,
  depthCm: 0.6,
  sectorAngleDeg: 4,
}

export interface AtlasFrameSelection<T> {
  entry: T
  normalizedDistance: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function circularAngleDeltaDeg(a = 0, b = 0) {
  const wrapped = ((a - b + 540) % 360) - 180
  return Math.abs(wrapped)
}

export function hasProbeState(value: unknown): value is ThoracicProbeState {
  const probe = value as ThoracicProbeState
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

/**
 * Normalised pose distance between two probe states, scaled by per-axis
 * tolerance. `withinTolerance` is true when every axis is inside its tolerance;
 * `normalizedDistance` is the Euclidean magnitude used to rank candidates.
 */
export function poseDistanceWithinTolerance(
  probe: ThoracicProbeState,
  reference: ThoracicProbeState,
  tolerance: FrameAtlasTolerance,
) {
  const deltas = [
    Math.abs(probe.lateralMm - reference.lateralMm) / tolerance.lateralMm,
    Math.abs(probe.posteriorMm - reference.posteriorMm) / tolerance.posteriorMm,
    Math.abs(probe.craniocaudalMm - reference.craniocaudalMm) / tolerance.craniocaudalMm,
    circularAngleDeltaDeg(probe.approachDeg, reference.approachDeg) / tolerance.approachDeg,
    Math.abs(probe.tiltDeg - reference.tiltDeg) / tolerance.tiltDeg,
    Math.abs(probe.rotationDeg - reference.rotationDeg) / tolerance.rotationDeg,
    Math.abs(probe.depthCm - reference.depthCm) / tolerance.depthCm,
    Math.abs(probe.sectorAngleDeg - reference.sectorAngleDeg) / tolerance.sectorAngleDeg,
  ]
  const maxDelta = Math.max(...deltas)
  const euclidean = Math.sqrt(deltas.reduce((total, value) => total + value * value, 0))

  return {
    withinTolerance: maxDelta <= 1,
    normalizedDistance: euclidean,
  }
}

function isGenericAtlasEntry(value: unknown): value is FrameAtlasEntry {
  const entry = value as FrameAtlasEntry
  return (
    typeof entry?.id === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.imageUrl === 'string' &&
    hasProbeState(entry.probe) &&
    !!entry.metrics &&
    !!entry.metrics.centralNeedle &&
    typeof entry.groundTruthKey === 'string' &&
    !!entry.generator &&
    typeof entry.generator.name === 'string' &&
    typeof entry.generator.source === 'string' &&
    (entry.reviewStatus === 'reviewed' || entry.reviewStatus === 'needs-review')
  )
}

export function normalizeFrameAtlas(atlas: FrameAtlas | null | undefined) {
  if (!atlas || !Array.isArray(atlas.entries)) {
    return null
  }

  const entries = atlas.entries.filter(isGenericAtlasEntry)
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
  } satisfies FrameAtlas
}

export function selectNearestReviewedFrame(
  atlas: FrameAtlas | null | undefined,
  probe: ThoracicProbeState,
): AtlasFrameSelection<FrameAtlasEntry> | null {
  const normalizedAtlas = normalizeFrameAtlas(atlas)
  if (!normalizedAtlas) {
    return null
  }

  const tolerance = {
    ...defaultFrameAtlasTolerance,
    ...normalizedAtlas.selectionTolerance,
  }

  let bestSelection: AtlasFrameSelection<FrameAtlasEntry> | null = null

  for (const entry of normalizedAtlas.entries) {
    if (entry.reviewStatus !== 'reviewed') {
      continue
    }

    const distance = poseDistanceWithinTolerance(probe, entry.probe, tolerance)
    if (!distance.withinTolerance) {
      continue
    }

    if (!bestSelection || distance.normalizedDistance < bestSelection.normalizedDistance) {
      bestSelection = { entry, normalizedDistance: distance.normalizedDistance }
    }
  }

  return bestSelection
}
