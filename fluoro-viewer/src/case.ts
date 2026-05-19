import type { DrrAtlasFrame, DrrBlendFrame, FluoroCaseManifest } from './types'

export function findNearestDrrFrame(
  frames: DrrAtlasFrame[],
  raoLaoDeg: number,
  cranialCaudalDeg: number,
): DrrAtlasFrame | null {
  if (!frames.length) {
    return null
  }
  return frames.reduce((best, frame) => {
    const bestDistance = angleDistance(best, raoLaoDeg, cranialCaudalDeg)
    const frameDistance = angleDistance(frame, raoLaoDeg, cranialCaudalDeg)
    return frameDistance < bestDistance ? frame : best
  }, frames[0])
}

export function findDrrBlendFrames(
  frames: DrrAtlasFrame[],
  raoLaoDeg: number,
  cranialCaudalDeg: number,
): DrrBlendFrame[] {
  if (!frames.length) {
    return []
  }

  const raoBracket = bracketAngle(
    uniqueSortedAngles(frames.map((frame) => frame.raoLaoDeg)),
    raoLaoDeg,
  )
  const cranialBracket = bracketAngle(
    uniqueSortedAngles(frames.map((frame) => frame.cranialCaudalDeg)),
    cranialCaudalDeg,
  )
  const frameMap = new Map(
    frames.map((frame) => [angleKey(frame.raoLaoDeg, frame.cranialCaudalDeg), frame]),
  )
  const weightedFrames = new Map<string, DrrBlendFrame>()

  addCorner(
    weightedFrames,
    frameMap,
    raoBracket.low,
    cranialBracket.low,
    (1 - raoBracket.t) * (1 - cranialBracket.t),
  )
  addCorner(
    weightedFrames,
    frameMap,
    raoBracket.high,
    cranialBracket.low,
    raoBracket.t * (1 - cranialBracket.t),
  )
  addCorner(
    weightedFrames,
    frameMap,
    raoBracket.low,
    cranialBracket.high,
    (1 - raoBracket.t) * cranialBracket.t,
  )
  addCorner(
    weightedFrames,
    frameMap,
    raoBracket.high,
    cranialBracket.high,
    raoBracket.t * cranialBracket.t,
  )

  const blendFrames = Array.from(weightedFrames.values())
  const totalWeight = blendFrames.reduce((total, item) => total + item.weight, 0)
  if (totalWeight <= 0) {
    const nearest = findNearestDrrFrame(frames, raoLaoDeg, cranialCaudalDeg)
    return nearest ? [{ frame: nearest, weight: 1 }] : []
  }

  return blendFrames
    .map((item) => ({ ...item, weight: item.weight / totalWeight }))
    .filter((item) => item.weight > 0.0001)
    .sort((a, b) => a.weight - b.weight)
}

export function validateFluoroCaseManifest(candidate: unknown): string[] {
  const manifest = candidate as Partial<FluoroCaseManifest> | null
  const errors: string[] = []
  if (!manifest || typeof manifest !== 'object') {
    return ['Manifest is not an object.']
  }
  if (!manifest.id) errors.push('Manifest id is required.')
  if (!manifest.title) errors.push('Manifest title is required.')
  if (!manifest.safetyLabel?.toLowerCase().includes('not for diagnosis')) {
    errors.push('Safety label must include non-diagnostic wording.')
  }
  if (!manifest.geometry) errors.push('Geometry config is required.')
  if (!manifest.assets?.airwayGlb) errors.push('Airway GLB asset is required.')
  if (!manifest.ctSlices?.axes?.axial) errors.push('Axial CT slice axis is required.')
  if (!manifest.drrAtlas?.frames?.length) errors.push('At least one DRR atlas frame is required.')
  if (!manifest.drrAtlas?.provenance?.backend) {
    errors.push('DRR atlas provenance backend is required.')
  }
  return errors
}

function angleDistance(frame: DrrAtlasFrame, raoLaoDeg: number, cranialCaudalDeg: number): number {
  const primary = frame.raoLaoDeg - raoLaoDeg
  const secondary = frame.cranialCaudalDeg - cranialCaudalDeg
  return primary * primary + secondary * secondary
}

function uniqueSortedAngles(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b)
}

function bracketAngle(angles: number[], value: number): { low: number; high: number; t: number } {
  if (!angles.length) {
    return { low: value, high: value, t: 0 }
  }
  if (value <= angles[0]) {
    return { low: angles[0], high: angles[0], t: 0 }
  }
  const lastAngle = angles[angles.length - 1]
  if (value >= lastAngle) {
    return { low: lastAngle, high: lastAngle, t: 0 }
  }

  for (let index = 0; index < angles.length - 1; index += 1) {
    const low = angles[index]
    const high = angles[index + 1]
    if (value >= low && value <= high) {
      const span = high - low
      return { low, high, t: span === 0 ? 0 : (value - low) / span }
    }
  }

  return { low: lastAngle, high: lastAngle, t: 0 }
}

function addCorner(
  weightedFrames: Map<string, DrrBlendFrame>,
  frameMap: Map<string, DrrAtlasFrame>,
  raoLaoDeg: number,
  cranialCaudalDeg: number,
  weight: number,
) {
  if (weight <= 0) return
  const key = angleKey(raoLaoDeg, cranialCaudalDeg)
  const frame = frameMap.get(key)
  if (!frame) return
  const existing = weightedFrames.get(key)
  if (existing) {
    existing.weight += weight
  } else {
    weightedFrames.set(key, { frame, weight })
  }
}

function angleKey(raoLaoDeg: number, cranialCaudalDeg: number): string {
  return `${raoLaoDeg}:${cranialCaudalDeg}`
}
