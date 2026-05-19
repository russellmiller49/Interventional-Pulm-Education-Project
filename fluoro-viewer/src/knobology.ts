export type MagnificationMode = 'none' | 'digital' | 'detector' | 'geometric'

export interface FluoroSettings {
  kvp: number
  ma: number
  pulseWidthMs: number
  pulseRateFps: number
  collimationX: number
  collimationY: number
  magnificationMode: MagnificationMode
  magnificationFactor: number
  abcEnabled: boolean
  scatterEnabled: boolean
  noiseEnabled: boolean
  detectorBlurPx: number
  highDoseMode: boolean
}

export interface DoseState {
  cumulativeFrames: number
  cumulativeRelativeAirKerma: number
  cumulativeRelativeKap: number
  elapsedFluoroSeconds: number
}

export const DEFAULT_FLUORO_SETTINGS: FluoroSettings = {
  kvp: 80,
  ma: 2,
  pulseWidthMs: 8,
  pulseRateFps: 7.5,
  collimationX: 1,
  collimationY: 1,
  magnificationMode: 'none',
  magnificationFactor: 1,
  abcEnabled: true,
  scatterEnabled: true,
  noiseEnabled: true,
  detectorBlurPx: 0.4,
  highDoseMode: false,
}

export const EMPTY_DOSE_STATE: DoseState = {
  cumulativeFrames: 0,
  cumulativeRelativeAirKerma: 0,
  cumulativeRelativeKap: 0,
  elapsedFluoroSeconds: 0,
}

export function fieldAreaFraction(settings: FluoroSettings): number {
  return clamp(settings.collimationX, 0.05, 1) * clamp(settings.collimationY, 0.05, 1)
}

export function noiseSigma(settings: FluoroSettings): number {
  const photons = Math.max(settings.ma * settings.pulseWidthMs, 0.1)
  const highDoseQuality = settings.highDoseMode ? 2 : 1
  return 1 / Math.sqrt(photons * highDoseQuality)
}

export function doseMultiplierForMagnification(settings: FluoroSettings): number {
  const factor = Math.max(settings.magnificationFactor, 1)
  return settings.magnificationMode === 'detector' ? factor * factor : 1
}

export function estimateRelativeDoseRate(settings: FluoroSettings, thicknessProxy = 1): number {
  const exposure = settings.ma * settings.pulseWidthMs * settings.pulseRateFps
  const abc = settings.abcEnabled ? Math.max(thicknessProxy, 0.2) : 1
  const highDose = settings.highDoseMode ? 2 : 1
  return (exposure * abc * highDose * doseMultiplierForMagnification(settings)) / 100
}

export function updateDoseState(
  state: DoseState,
  settings: FluoroSettings,
  frameCount: number,
  thicknessProxy = 1,
): DoseState {
  const frames = Math.max(0, Math.round(frameCount))
  const seconds = frames / Math.max(settings.pulseRateFps, 0.1)
  const airKerma = estimateRelativeDoseRate(settings, thicknessProxy) * seconds
  const kap = airKerma * fieldAreaFraction(settings)
  return {
    cumulativeFrames: state.cumulativeFrames + frames,
    cumulativeRelativeAirKerma: state.cumulativeRelativeAirKerma + airKerma,
    cumulativeRelativeKap: state.cumulativeRelativeKap + kap,
    elapsedFluoroSeconds: state.elapsedFluoroSeconds + seconds,
  }
}

export function imageFilterForSettings(settings: FluoroSettings, thicknessProxy = 1): string {
  const brightness = imageBrightnessForSettings(settings, thicknessProxy)
  const contrast = imageContrastForSettings(settings)
  const blur = Math.max(settings.detectorBlurPx, 0)
  return [
    `grayscale(1)`,
    `contrast(${contrast.toFixed(3)})`,
    `brightness(${brightness.toFixed(3)})`,
    `blur(${blur.toFixed(2)}px)`,
  ].join(' ')
}

export function imageBrightnessForSettings(settings: FluoroSettings, thicknessProxy = 1): number {
  const baselineMas = DEFAULT_FLUORO_SETTINGS.ma * DEFAULT_FLUORO_SETTINGS.pulseWidthMs
  const pulseMas = Math.max(settings.ma * settings.pulseWidthMs, 0.1)
  const exposureGain = Math.pow(pulseMas / baselineMas, 0.35)
  const kvpGain = Math.pow(clamp(settings.kvp / DEFAULT_FLUORO_SETTINGS.kvp, 0.75, 1.5), 0.35)
  const abcGain = settings.abcEnabled
    ? clamp(1.02 + (thicknessProxy - 1) * 0.08, 0.92, 1.16)
    : clamp(1.08 - thicknessProxy * 0.08, 0.82, 1.02)
  const highDoseGain = settings.highDoseMode ? 1.14 : 1
  return clamp(1.04 * exposureGain * kvpGain * abcGain * highDoseGain, 0.58, 2.65)
}

export function imageContrastForSettings(settings: FluoroSettings): number {
  const kvpContrast = clamp(1.32 - (settings.kvp - 60) / 170, 0.84, 1.34)
  const highDoseSharpness = settings.highDoseMode ? 1.04 : 1
  return kvpContrast * highDoseSharpness
}

export function noiseOpacityForSettings(settings: FluoroSettings): number {
  if (!settings.noiseEnabled) {
    return 0
  }
  return clamp(noiseSigma(settings) * 0.9, 0.02, 0.28)
}

export function scatterOpacityForSettings(settings: FluoroSettings, thicknessProxy = 1): number {
  if (!settings.scatterEnabled) {
    return 0
  }
  return clamp(fieldAreaFraction(settings) * thicknessProxy * 0.18, 0.02, 0.26)
}

export function collimationClipPath(settings: FluoroSettings): string {
  const xInset = ((1 - clamp(settings.collimationX, 0.05, 1)) / 2) * 100
  const yInset = ((1 - clamp(settings.collimationY, 0.05, 1)) / 2) * 100
  return `inset(${yInset.toFixed(2)}% ${xInset.toFixed(2)}%)`
}

export function imageScaleForSettings(settings: FluoroSettings): number {
  if (settings.magnificationMode === 'none') {
    return 1
  }
  return clamp(settings.magnificationFactor, 1, 2.5)
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}
