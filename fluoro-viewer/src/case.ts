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
  if (manifest.assets?.airwayGraphJson && !manifest.interaction) {
    errors.push('Interaction defaults are required when an airway graph is provided.')
  }
  if (manifest.ctVolume && !manifest.ctVolume.rawUrl) {
    errors.push('CT preview volume rawUrl is required.')
  }
  if (!manifest.ctSlices?.axes?.axial) errors.push('Axial CT slice axis is required.')
  const hasAtlas = !!manifest.drrAtlas?.frames?.length
  const hasVolume = !!manifest.volumeDrr?.volumeUri
  if (!hasAtlas && !hasVolume) {
    errors.push('A DRR atlas (frames) or a volumeDrr asset is required.')
  }
  if (hasAtlas && !manifest.drrAtlas?.provenance?.backend) {
    errors.push('DRR atlas provenance backend is required when frames are present.')
  }
  if (hasVolume) {
    const v = manifest.volumeDrr
    if (!v?.volumeUri) {
      errors.push('volumeDrr.volumeUri is required.')
    }
    if (!v || !Array.isArray(v.sizeXyz) || v.sizeXyz.length !== 3) {
      errors.push('volumeDrr.sizeXyz must be a 3-tuple.')
    }
    if (v?.format !== 'uint8-r8') {
      errors.push('volumeDrr.format must be "uint8-r8".')
    }
    if (v?.sampleDomain !== 'normalized-r8') {
      errors.push('volumeDrr.sampleDomain must be "normalized-r8".')
    }
    if (!Array.isArray(v?.directionLps) || v.directionLps.length !== 9) {
      errors.push('volumeDrr.directionLps must contain 9 values.')
    }
    if (!Array.isArray(v?.huRange) || v.huRange.length !== 2) {
      errors.push('volumeDrr.huRange must contain 2 values.')
    }
  }
  if (manifest.scopeAnimation) {
    if (!manifest.scopeAnimation.polylineJsonUri) {
      errors.push('scopeAnimation.polylineJsonUri is required.')
    }
    if (manifest.scopeAnimation.defaultRouteId !== 'bezier-demo') {
      errors.push('scopeAnimation.defaultRouteId must be "bezier-demo".')
    }
  }
  if (manifest.cArm?.gantryGlbUri && typeof manifest.cArm.gantryGlbUri !== 'string') {
    errors.push('cArm.gantryGlbUri must be a string when present.')
  }
  if (manifest.cArm?.transforms) {
    for (const transform of manifest.cArm.transforms) {
      if (
        !Array.isArray(transform.matrixLpsFromParent) ||
        transform.matrixLpsFromParent.length !== 16
      ) {
        errors.push('cArm transforms must contain 16-value matrixLpsFromParent arrays.')
        break
      }
    }
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
