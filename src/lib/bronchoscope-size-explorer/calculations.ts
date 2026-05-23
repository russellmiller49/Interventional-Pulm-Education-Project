import type {
  AirwayGeneration,
  AirwayReachResult,
  BronchoscopeDevice,
  BronchoscopyInstrument,
  FitClassification,
  FitStatus,
} from './types'

export const DEFAULT_AIRWAY_CLEARANCE_MM = 0.3
export const DEFAULT_INSTRUMENT_CLEARANCE_MM = 0.1
export const LOW_RESIDUAL_AREA_RATIO = 0.25

const BORDERLINE_AIRWAY_CLEARANCE_MM = 0.2
const BORDERLINE_CHANNEL_MARGIN_MM = 0.2

export function circleAreaMm2(diameterMm: number): number {
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) {
    return 0
  }

  return Math.PI * (diameterMm / 2) ** 2
}

export function workingChannelAreaMm2(channelDiameterMm: number): number {
  return circleAreaMm2(channelDiameterMm)
}

export function remainingChannelAreaMm2(
  channelDiameterMm: number,
  instrumentDiameterMm?: number,
): number | null {
  if (instrumentDiameterMm === undefined) {
    return null
  }

  return Math.max(0, circleAreaMm2(channelDiameterMm) - circleAreaMm2(instrumentDiameterMm))
}

export const getRemainingChannelAreaMm2 = remainingChannelAreaMm2

export function classifyInstrumentFit(
  workingChannelMm: number,
  instrument: BronchoscopyInstrument,
  clearanceMm = DEFAULT_INSTRUMENT_CLEARANCE_MM,
): FitStatus {
  if (!Number.isFinite(workingChannelMm) || workingChannelMm <= 0) {
    return 'unknown'
  }

  if (instrument.minimumWorkingChannelMm !== undefined) {
    const difference = workingChannelMm - instrument.minimumWorkingChannelMm

    if (difference >= 0) {
      return 'fits'
    }

    if (Math.abs(difference) <= BORDERLINE_CHANNEL_MARGIN_MM) {
      return 'borderline'
    }

    return 'does-not-fit'
  }

  if (instrument.outerDiameterMm !== undefined) {
    if (workingChannelMm >= instrument.outerDiameterMm + clearanceMm) {
      return 'fits'
    }

    if (workingChannelMm >= instrument.outerDiameterMm) {
      return 'borderline'
    }

    return 'does-not-fit'
  }

  return 'unknown'
}

export function canInstrumentFit(
  channelDiameterMm: number,
  instrument: BronchoscopyInstrument,
  clearanceMm = DEFAULT_INSTRUMENT_CLEARANCE_MM,
): boolean | null {
  const status = classifyInstrumentFit(channelDiameterMm, instrument, clearanceMm)

  if (status === 'unknown') {
    return null
  }

  return status === 'fits' || status === 'borderline'
}

export function classifyFitResult(
  scope: BronchoscopeDevice,
  instrument: BronchoscopyInstrument,
  clearanceMm = DEFAULT_INSTRUMENT_CLEARANCE_MM,
): FitClassification {
  const status = classifyInstrumentFit(scope.workingChannelMm, instrument, clearanceMm)
  const channelAreaMm2 = workingChannelAreaMm2(scope.workingChannelMm)
  const instrumentAreaMm2 =
    instrument.outerDiameterMm !== undefined ? circleAreaMm2(instrument.outerDiameterMm) : null
  const remainingAreaMm2 =
    instrument.outerDiameterMm !== undefined
      ? remainingChannelAreaMm2(scope.workingChannelMm, instrument.outerDiameterMm)
      : null
  const residualAreaRatio =
    remainingAreaMm2 !== null && channelAreaMm2 > 0 ? remainingAreaMm2 / channelAreaMm2 : null
  const hasLowResidualArea =
    status !== 'does-not-fit' &&
    residualAreaRatio !== null &&
    residualAreaRatio < LOW_RESIDUAL_AREA_RATIO

  return {
    status,
    channelAreaMm2,
    instrumentAreaMm2,
    remainingAreaMm2,
    residualAreaRatio,
    clearanceMm,
    message: getFitMessage(status),
    caution: hasLowResidualArea
      ? 'Instrument may technically fit, but little channel area remains for suction or fluid clearance.'
      : undefined,
  }
}

export function estimateReachGeneration(
  scopeOuterDiameterMm: number,
  airwayModel: AirwayGeneration[],
  clearanceMm = DEFAULT_AIRWAY_CLEARANCE_MM,
): AirwayReachResult[] {
  return airwayModel.map((airway) => {
    let status: AirwayReachResult['status'] = 'unreachable'

    if (airway.approximateDiameterMm >= scopeOuterDiameterMm + clearanceMm) {
      status = 'reachable'
    } else if (
      airway.approximateDiameterMm >=
      scopeOuterDiameterMm + clearanceMm - BORDERLINE_AIRWAY_CLEARANCE_MM
    ) {
      status = 'borderline'
    }

    return {
      ...airway,
      status,
    }
  })
}

export const getReachableGenerations = estimateReachGeneration

export function getMaxReachableGeneration(reachResults: AirwayReachResult[]): number {
  const reachable = reachResults.filter((result) => result.status === 'reachable')

  if (!reachable.length) {
    return -1
  }

  return Math.max(...reachable.map((result) => result.generation))
}

export function getEstimatedReachLabel(maxReachableGeneration: number): string {
  if (maxReachableGeneration < 0) {
    return 'Not size-compatible in this model'
  }

  if (maxReachableGeneration <= 2) {
    return 'Central/lobar'
  }

  if (maxReachableGeneration <= 4) {
    return 'Segmental/proximal subsegmental'
  }

  if (maxReachableGeneration <= 6) {
    return 'Subsegmental/distal subsegmental'
  }

  return 'Very distal/small-airway territory'
}

function getFitMessage(status: FitStatus): string {
  switch (status) {
    case 'fits':
      return 'Fits by the selected educational sizing rule.'
    case 'borderline':
      return 'Borderline fit. Confirm exact device instructions and workflow requirements.'
    case 'does-not-fit':
      return 'Does not fit by the selected educational sizing rule.'
    case 'unknown':
      return 'Compatibility is unknown because the selected instrument does not include a usable diameter or channel requirement.'
  }
}
