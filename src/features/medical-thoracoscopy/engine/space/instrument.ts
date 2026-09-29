import { modelledNumber, publishedNumber } from '../../content/deviceDefinitions'

/**
 * The telescope and its sleeve as the engine models them, every number from the device definitions
 * with its kind of claim, except the three the engine authors here, each labelled so. The ribs'
 * depth, which limits the tilt across them, is measured and belongs to the port.
 */
export interface Instrument {
  readonly shaftRadiusMm: number
  readonly shaftLengthMm: number
  readonly sleeveRadiusMm: number
  /** Authored: how far past the pleura the sleeve's tip sits, along its axis. */
  readonly sleeveBeyondPleuraMm: number
  readonly fieldOfViewDeg: number
  readonly directionOfViewDeg: number
  readonly opticOffsetMm: number
  /**
   * Authored: how far the telescope sees clearly enough to count a region as seen. Long enough to
   * see across the space, so that what is out of reach is set by the port and the tilt, not by a
   * distance nobody has measured.
   */
  readonly viewRangeMm: number
  /** Authored: the tilt the sleeve allows along the ribs, where no bone stops it and soft tissue does. */
  readonly alongRibsLimitDeg: number
}

export const AUTHORED_INSTRUMENT_VALUES = {
  sleeveBeyondPleuraMm: 5,
  viewRangeMm: 200,
  alongRibsLimitDeg: 40,
} as const

export function instrument(): Instrument {
  return {
    shaftRadiusMm: publishedNumber('operative-telescope', 'shaftOuterDiameter') / 2,
    shaftLengthMm: publishedNumber('operative-telescope', 'shaftLength'),
    sleeveRadiusMm: modelledNumber('trocar-sleeve-flexible', 'outerDiameter').value / 2,
    fieldOfViewDeg: modelledNumber('operative-telescope', 'fieldOfView').value,
    directionOfViewDeg: publishedNumber('operative-telescope', 'directionOfView'),
    opticOffsetMm: modelledNumber('operative-telescope', 'opticOffsetOnTip').value,
    ...AUTHORED_INSTRUMENT_VALUES,
  }
}
