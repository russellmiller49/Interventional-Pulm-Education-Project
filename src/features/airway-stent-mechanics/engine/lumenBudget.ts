function assertFinitePositive(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite.`)
  }

  if (value <= 0) {
    throw new RangeError(`${name} must be greater than 0.`)
  }
}

/**
 * Derives the open inner diameter of a circular tube from its outer diameter
 * and a uniform wall thickness. Values are expressed in the same units.
 */
export function deriveInnerDiameterMm(outerDiameterMm: number, wallThicknessMm: number) {
  assertFinitePositive(outerDiameterMm, 'outerDiameterMm')
  assertFinitePositive(wallThicknessMm, 'wallThicknessMm')

  const innerDiameterMm = outerDiameterMm - wallThicknessMm * 2
  if (innerDiameterMm <= 0) {
    throw new RangeError('wallThicknessMm must be less than half of outerDiameterMm.')
  }

  return innerDiameterMm
}

/** Returns the geometric area of a circle in square millimetres. */
export function circleAreaMm2(diameterMm: number) {
  assertFinitePositive(diameterMm, 'diameterMm')
  return Math.PI * (diameterMm / 2) ** 2
}

/**
 * Returns the fraction of the outer circular envelope occupied by the open
 * inner lumen. This is a geometric ratio only, not an airflow model.
 */
export function lumenAreaFraction(innerDiameterMm: number, outerDiameterMm: number) {
  assertFinitePositive(innerDiameterMm, 'innerDiameterMm')
  assertFinitePositive(outerDiameterMm, 'outerDiameterMm')

  if (innerDiameterMm > outerDiameterMm) {
    throw new RangeError('innerDiameterMm must not exceed outerDiameterMm.')
  }

  return circleAreaMm2(innerDiameterMm) / circleAreaMm2(outerDiameterMm)
}
